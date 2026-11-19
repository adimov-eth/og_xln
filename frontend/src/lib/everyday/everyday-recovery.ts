import type { JBatch, RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import type { WalletPosture } from './wallet-posture';

export type EverydayDisputePhase = 'none' | 'preparing' | 'queued' | 'sent' | 'active' | 'closed';

export type EverydayDisputeNotice = {
  counterpartyId: string;
  label: string;
  phase: Exclude<EverydayDisputePhase, 'none'>;
  startedByUs: boolean;
  timeout: number;
  needsL1GasForUnilateralExit: boolean;
};

type AccountDoc = NonNullable<RuntimeAdapterViewFrame['activeEntity']>['accounts']['items'][number];

export function resolveAccountDisputePhase(
  doc: AccountDoc,
  isLeft: boolean,
  counterpartyId: string,
  batch: JBatch | null | undefined,
): { phase: EverydayDisputePhase; startedByUs: boolean; timeout: number } {
  const active = doc.activeDispute;
  if (active?.observedOnChain === true) {
    return { phase: 'active', startedByUs: active.startedByLeft === isLeft, timeout: Number(active.disputeTimeout || 0) };
  }
  if (active) {
    const queued = batch?.disputeStarts?.some(start => String(start.counterentity || '').trim().toLowerCase() === counterpartyId) ?? false;
    return { phase: queued ? 'queued' : 'sent', startedByUs: true, timeout: 0 };
  }
  if (String(doc.status || '') === 'dispute_preparing' || doc.disputePrepare) return { phase: 'preparing', startedByUs: true, timeout: 0 };
  if (doc.status === 'disputed') return { phase: 'closed', startedByUs: false, timeout: 0 };
  return { phase: 'none', startedByUs: false, timeout: 0 };
}

export type EverydayRecoveryMode = 'tower' | 'local';
export type EverydayRecoveryConfig = { mode: EverydayRecoveryMode; towers: string[] };
export type RecoveryShieldStatusInput = {
  mode: EverydayRecoveryMode;
  towers: readonly string[];
  backupError: string | null;
  protectionError: string | null;
  automaticResponseEnabled: boolean;
};
export type RecoveryShieldCategory = 'protected' | 'unilateral-exit-needs-gas' | 'tower-issue' | 'local-only';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

const normalizeBaseUrl = (value: string): string | null => {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
};

const extractRawTowerEntries = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.flatMap(extractRawTowerEntries);
  }
  if (raw && typeof raw === 'object' && typeof (raw as { url?: unknown }).url === 'string') {
    return [(raw as { url: string }).url];
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') || trimmed.startsWith('{') || trimmed.startsWith('"')) {
      try {
        return extractRawTowerEntries(JSON.parse(trimmed));
      } catch {
        // Fall through to comma-separated URL parsing when not valid JSON.
      }
    }
    return trimmed.split(',');
  }
  return [];
};

export function parseEverydayTowerUrls(raw: unknown): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const entry of extractRawTowerEntries(raw)) {
    const normalized = normalizeBaseUrl(entry);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      urls.push(normalized);
    }
  }
  return urls;
}

export function resolveDefaultTowerUrls(options: {
  hostname: string;
  origin?: string | undefined;
  globalUrls?: unknown;
  localUrls?: unknown;
  envUrls?: unknown;
}): string[] {
  const fromGlobal = parseEverydayTowerUrls(options.globalUrls);
  if (fromGlobal.length > 0) return fromGlobal;
  const fromLocal = parseEverydayTowerUrls(options.localUrls);
  if (fromLocal.length > 0) return fromLocal;
  const fromEnv = parseEverydayTowerUrls(options.envUrls);
  if (fromEnv.length > 0) return fromEnv;
  const host = String(options.hostname || '').trim().toLowerCase();
  if (LOOPBACK_HOSTS.has(host)) return [];
  const originUrl = options.origin ? normalizeBaseUrl(options.origin) : null;
  return [originUrl ?? 'https://xln.finance'];
}

export function ensureDefaultTowerProtection<TConfig extends EverydayRecoveryConfig>(options: {
  posture: WalletPosture;
  vaultId: string;
  readExplicitConfig: (vaultId: string) => TConfig | null;
  saveConfig: (vaultId: string, config: EverydayRecoveryConfig) => void;
  resolveUrls: () => string[];
}): EverydayRecoveryConfig | null {
  if (options.posture !== 'everyday') return null;
  if (options.readExplicitConfig(options.vaultId) !== null) return null;
  const towers = parseEverydayTowerUrls(options.resolveUrls());
  if (towers.length === 0) return null;
  const next: EverydayRecoveryConfig = { mode: 'tower', towers };
  options.saveConfig(options.vaultId, next);
  return next;
}

const ZERO_GAS_EXIT_SUFFIX = ' Unilateral on-chain exit still requires network gas.';
const withZeroGasSuffix = (summary: string, hasZeroL1Gas: boolean): string =>
  hasZeroL1Gas ? `${summary}${ZERO_GAS_EXIT_SUFFIX}` : summary;

export function classifyRecoveryShieldState(input: {
  shieldStatus: RecoveryShieldStatusInput | null | undefined;
  disputes: readonly { needsL1GasForUnilateralExit: boolean }[];
  hasZeroL1Gas: boolean;
}): { category: RecoveryShieldCategory; summary: string } {
  if (input.disputes.some(dispute => dispute.needsL1GasForUnilateralExit)) {
    return {
      category: 'unilateral-exit-needs-gas',
      summary: 'Your provider is offline and your wallet has 0 gas for an on-chain exit. Add network gas to finish recovery on your own.',
    };
  }
  const status = input.shieldStatus;
  if (!status || status.mode === 'local' || status.towers.length === 0) {
    return {
      category: 'local-only',
      summary: withZeroGasSuffix('Backups stay on this device only.', input.hasZeroL1Gas),
    };
  }
  if (status.backupError) {
    return {
      category: 'tower-issue',
      summary: withZeroGasSuffix(
        `Automatic backup could not reach your recovery service (${status.backupError}).`,
        input.hasZeroL1Gas,
      ),
    };
  }
  if (status.protectionError) {
    return {
      category: 'tower-issue',
      summary: withZeroGasSuffix(
        `Dispute protection needs attention (${status.protectionError}).`,
        input.hasZeroL1Gas,
      ),
    };
  }
  if (!status.automaticResponseEnabled) {
    return {
      category: 'tower-issue',
      summary: withZeroGasSuffix(
        'Encrypted backups are saved, but automatic dispute defense is turned off on this service.',
        input.hasZeroL1Gas,
      ),
    };
  }
  if (input.hasZeroL1Gas) {
    return {
      category: 'protected',
      summary: 'Protected automatically for counter-disputes; unilateral on-chain exit still requires network gas.',
    };
  }
  return { category: 'protected', summary: 'Protected automatically.' };
}
