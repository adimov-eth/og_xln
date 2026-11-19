import type { AccountRoleEvidenceSource } from '@xln/core/account/config/dispute-config';
import type { EntityTx, RuntimeAdapterViewFrame, RuntimeInput, RuntimeReplica, XLNModule } from '@xln/core/api/public/runtime-module';
import { asTokenId } from '@xln/core/protocol/units';
import { errorLog } from '#lib/stores/errorLogStore.ts';
import { submitRuntimeInput } from '#lib/stores/xlnStore.ts';
import { rejectExtraKeys, requireFiniteNumber, requireString, requireUnknownRecord } from '#lib/utils/boundary/index.ts';
import { normalizeEntityId } from '#lib/utils/identity/entityReplica.ts';
import { getHubOpeningCredit, getOpenAccountRebalancePolicyData, readHubJoinPreference } from '#lib/utils/onboarding/onboardingPreferences.ts';
import { buildHubOpenAccountRuntimeInput, hubDiscoveryJurisdictionKey } from '#lib/components/Entity/onboarding/hub-discovery-profile.ts';
import { resolveEverydayApiBase } from './everydayApiBase.ts';
import { sleep } from '../../utils/primitives';

export type AutoHubJoinDeps = {
  fetchFn?: typeof fetch;
  submitRuntimeInputFn?: (input: RuntimeInput) => Promise<unknown>;
  readPreferenceFn?: typeof readHubJoinPreference;
  apiBase?: string;
  p2pPollTimeoutMs?: number;
  p2pPollIntervalMs?: number;
};

export type AutoHubJoinParams = {
  runtimeId: string;
  entityId: string;
  signerId: string;
  jurisdiction: string;
  frame: RuntimeAdapterViewFrame | null;
  hubAccountsCount: number;
  liveEnv: RuntimeReplica | null;
  xln: XLNModule | null;
  commandReady: boolean;
  deps?: AutoHubJoinDeps;
};

type DecodedHub = {
  entityId: string;
  online: boolean;
  roleSource: Extract<AccountRoleEvidenceSource, 'operator-config' | 'verified-gossip-profile'>;
  jurisdiction?: { name: string; chainId?: number; depositoryAddress?: string; entityProviderAddress?: string };
};

const MAX_ATTEMPTS = 2;
const inFlightJoins = new Map<string, Promise<void>>();
const completedJoins = new Set<string>();
const failedAttempts = new Map<string, number>();

const norm = (value: unknown): string => String(value || '').trim().toLowerCase();

export function resetEverydayHubJoinStateForTests(): void {
  inFlightJoins.clear();
  completedJoins.clear();
  failedAttempts.clear();
}

function decodePublicHubs(value: unknown): DecodedHub[] {
  const record = requireUnknownRecord(value, 'PUBLIC_HUB_RESPONSE_INVALID');
  rejectExtraKeys(record, ['ok', 'count', 'serverTime', 'hubs'], 'PUBLIC_HUB_RESPONSE_EXTRA_FIELD');
  if (record['ok'] !== true || !Array.isArray(record['hubs'])) throw new Error('PUBLIC_HUB_RESPONSE_SHAPE_INVALID');
  requireFiniteNumber(record['count'], 'PUBLIC_HUB_COUNT_INVALID');
  requireFiniteNumber(record['serverTime'], 'PUBLIC_HUB_SERVER_TIME_INVALID');
  return record['hubs'].map(entry => {
    const hub = requireUnknownRecord(entry, 'PUBLIC_HUB_INVALID');
    rejectExtraKeys(hub, ['entityId', 'runtimeId', 'name', 'bio', 'website', 'wsUrl', 'publicAccounts', 'metadata', 'lastUpdated', 'online', 'roleSource'], 'PUBLIC_HUB_EXTRA_FIELD');
    const metadata = requireUnknownRecord(hub['metadata'], 'PUBLIC_HUB_METADATA_INVALID');
    rejectExtraKeys(metadata, ['isHub', 'jurisdiction'], 'PUBLIC_HUB_METADATA_EXTRA_FIELD');
    const roleSource = hub['roleSource'];
    if (metadata['isHub'] !== true || (roleSource !== 'operator-config' && roleSource !== 'verified-gossip-profile')) {
      throw new Error('PUBLIC_HUB_AUTHORITY_INVALID');
    }
    const rawJurisdiction = metadata['jurisdiction'];
    let jurisdiction: DecodedHub['jurisdiction'];
    if (rawJurisdiction !== undefined) {
      const item = requireUnknownRecord(rawJurisdiction, 'PUBLIC_HUB_JURISDICTION_INVALID');
      rejectExtraKeys(item, ['name', 'chainId', 'depositoryAddress', 'entityProviderAddress'], 'PUBLIC_HUB_JURISDICTION_EXTRA_FIELD');
      jurisdiction = {
        name: requireString(item['name'], 'PUBLIC_HUB_JURISDICTION_NAME_INVALID'),
        ...(item['chainId'] === undefined ? {} : { chainId: requireFiniteNumber(item['chainId'], 'PUBLIC_HUB_JURISDICTION_CHAIN_ID_INVALID') }),
        ...(item['depositoryAddress'] === undefined ? {} : { depositoryAddress: requireString(item['depositoryAddress'], 'PUBLIC_HUB_JURISDICTION_DEPOSITORY_INVALID') }),
        ...(item['entityProviderAddress'] === undefined ? {} : { entityProviderAddress: requireString(item['entityProviderAddress'], 'PUBLIC_HUB_JURISDICTION_PROVIDER_INVALID') }),
      };
    }
    return {
      entityId: requireString(hub['entityId'], 'PUBLIC_HUB_ENTITY_ID_INVALID'),
      online: hub['online'] !== false,
      roleSource,
      ...(jurisdiction ? { jurisdiction } : {}),
    };
  });
}

const opensCounterparty = (tx: EntityTx, counterpartyId: string): boolean =>
  tx.type === 'openAccount' && normalizeEntityId(tx.data.targetEntityId) === normalizeEntityId(counterpartyId);

function hasPendingOrCommittedAccount(env: RuntimeReplica | null, entityId: string, counterpartyId: string): boolean {
  if (!env) return false;
  const self = normalizeEntityId(entityId);
  const peer = normalizeEntityId(counterpartyId);
  if (!self || !peer) return false;
  if ((env.runtimeMempool?.entityInputs ?? []).some(input => normalizeEntityId(input.entityId) === self && (input.entityTxs ?? []).some(tx => opensCounterparty(tx, peer)))) {
    return true;
  }
  for (const [key, replica] of env.state?.eReplicas?.entries?.() ?? []) {
    if (normalizeEntityId(String(key).split(':')[0]) !== self) continue;
    if (replica.state?.accounts?.get?.(peer) || replica.state?.accounts?.get?.(counterpartyId)) return true;
    if (replica.mempool?.some(tx => opensCounterparty(tx, peer))) return true;
    if (replica.proposal?.txs?.some(tx => opensCounterparty(tx, peer))) return true;
    if (replica.lockedFrame?.txs?.some(tx => opensCounterparty(tx, peer))) return true;
  }
  return false;
}

export function maybeAutoJoinEverydayHub(params: AutoHubJoinParams): Promise<void> {
  const readPref = params.deps?.readPreferenceFn ?? readHubJoinPreference;
  if (!params.commandReady || !params.runtimeId || !params.entityId || !params.signerId || !params.jurisdiction) return Promise.resolve();
  if (readPref() === 'manual' || params.hubAccountsCount > 0) return Promise.resolve();
  const active = params.frame?.activeEntity;
  const selfId = normalizeEntityId(params.entityId);
  if (!active || normalizeEntityId(active.summary.entityId) !== selfId) return Promise.resolve();
  const key = `${params.runtimeId.trim().toLowerCase()}:${selfId}:${params.jurisdiction.toLowerCase()}`;
  if (completedJoins.has(key) || (failedAttempts.get(key) ?? 0) >= MAX_ATTEMPTS) return Promise.resolve();
  const existing = inFlightJoins.get(key);
  if (existing) return existing;

  const task = (async () => {
    let selectedHubId = '';
    try {
      const fetchFn = params.deps?.fetchFn ?? fetch;
      const apiBase = params.deps?.apiBase ?? resolveEverydayApiBase();
      const res = await fetchFn(`${apiBase}/api/hubs?ts=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(5_000) });
      if (!res.ok) throw new Error(`PUBLIC_HUB_HTTP_${res.status}`);
      const hubs = decodePublicHubs(await res.json());
      const entityJKey = hubDiscoveryJurisdictionKey(active.core.config.jurisdiction) || hubDiscoveryJurisdictionKey(active.summary.jurisdiction);
      const candidates = hubs
        .filter(hub => {
          const hubId = normalizeEntityId(hub.entityId);
          if (!hubId || hubId === selfId) return false;
          const hubJKey = hubDiscoveryJurisdictionKey(hub.jurisdiction);
          if (entityJKey && hubJKey) return entityJKey === hubJKey;
          return norm(hub.jurisdiction?.name) === norm(params.jurisdiction);
        })
        .sort((a, b) => Number(b.online) - Number(a.online));
      const hub = candidates[0];
      // An empty list can be transient: count it as a failed attempt, not a finished join.
      if (!hub) throw new Error('PUBLIC_HUB_NONE_FOR_JURISDICTION');
      selectedHubId = normalizeEntityId(hub.entityId);
      const alreadyInFrame = active.accounts.items.some(
        a => normalizeEntityId(a.state.leftEntity) === selectedHubId || normalizeEntityId(a.state.rightEntity) === selectedHubId,
      );
      if (alreadyInFrame || hasPendingOrCommittedAccount(params.liveEnv, selfId, selectedHubId)) {
        completedJoins.add(key);
        return;
      }
      if (params.liveEnv) {
        const timeoutMs = params.deps?.p2pPollTimeoutMs ?? 8_000;
        const intervalMs = params.deps?.p2pPollIntervalMs ?? 100;
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          if (readPref() === 'manual' || hasPendingOrCommittedAccount(params.liveEnv, selfId, selectedHubId)) {
            completedJoins.add(key);
            return;
          }
          const p2p = params.liveEnv.infrastructure?.p2p;
          if (!p2p || p2p.isConnected?.() !== false) break;
          await sleep(intervalMs);
        }
        await params.xln?.ensureGossipProfiles?.(params.liveEnv, [selectedHubId]).catch(() => false);
        if (readPref() === 'manual' || hasPendingOrCommittedAccount(params.liveEnv, selfId, selectedHubId)) {
          completedJoins.add(key);
          return;
        }
      }
      const committedRoles = new Map<string, boolean>();
      for (const entry of params.frame?.entities ?? []) {
        if (entry.signerId && typeof entry.isHub === 'boolean') {
          committedRoles.set(normalizeEntityId(entry.entityId), entry.isHub);
        }
      }
      if (active.summary.signerId) committedRoles.set(selfId, active.summary.isHub === true);
      if (committedRoles.get(selectedHubId) === false) {
        completedJoins.add(key);
        return;
      }
      const creditAmount = getHubOpeningCredit(asTokenId(1), 'everyday');
      const rebalancePolicy = getOpenAccountRebalancePolicyData(asTokenId(1), 'everyday');
      const runtimeInput = buildHubOpenAccountRuntimeInput({
        sourceEntityId: selfId,
        signerId: params.signerId,
        hubEntityId: selectedHubId,
        sourceRoleEvidence: { entityId: selfId, isHub: active.summary.isHub === true, source: 'committed-profile' },
        hubRoleEvidence: { entityId: selectedHubId, isHub: true, source: hub.roleSource },
        committedRoles,
        creditAmount,
        tokenId: 1,
        rebalancePolicy,
      });
      await (params.deps?.submitRuntimeInputFn ?? submitRuntimeInput)(runtimeInput);
      completedJoins.add(key);
      failedAttempts.delete(key);
    } catch (error) {
      failedAttempts.set(key, (failedAttempts.get(key) ?? 0) + 1);
      errorLog.log('Everyday auto hub open failed', 'Everyday Onboarding', {
        entityId: selfId,
        hubId: selectedHubId,
        error,
      });
    }
  })().finally(() => {
    inFlightJoins.delete(key);
  });

  inFlightJoins.set(key, task);
  return task;
}
