import { isAddress, ZeroAddress } from 'ethers';
import type { Delta, DerivedDelta, JAdapter, PaymentDeliveryMode, RuntimeAdapterViewFrame, RuntimeReplica, XLNModule } from '@xln/core/api/public/runtime-module';
import type { RuntimeAdapter, RuntimeAdapterPaymentRoutesResponse, RuntimeAdapterReadQuery } from '@xln/core/api/runtime-adapter/types';
import { getRuntimeControllerAdapter, getRuntimeControllerConfig } from '#lib/stores/runtimeControllerStore.ts';
import { resolveEverydayApiBase } from '#lib/stores/everyday/everydayApiBase.ts';
import type { Runtime } from '#lib/stores/vault/vaultStore.ts';
import { unwrapLiveRuntimeEnv } from '#lib/utils/runtime/liveRuntimeEnv.ts';
import { requireUnknownRecord } from '#lib/utils/boundary/index.ts';
import { createExternalTokenCatalogLoader, fetchExternalTokenCatalog, readExternalWalletState, requestExternalWalletSnapshot, resolveExternalWalletSpender } from '../Entity/external-wallet-reader';
import { parseTokenAmountInput } from '../Entity/assets/token-amount-input';
import type { EverydaySendRoute, EverydayExternalRow } from '#lib/everyday/everyday-autopilot.ts';
import type { EverydayExternalBalanceRow } from '#lib/everyday/everyday-projection.ts';
import { formatDecimal } from '#lib/utils/format.ts';
import type { RecoveryShieldStatusInput } from '#lib/everyday/everyday-recovery.ts';
import {
  findDirectBilateralRoute,
  quoteEverydayRoutes,
  quoteSettleTabRoute as quoteCanonicalSettleTabRoute,
  resolveEverydayDeliveryMode,
  type EverydayRouteQuery,
} from '#lib/everyday/everyday-routes.ts';

export { findDirectBilateralRoute, resolveEverydayApiBase, resolveEverydayDeliveryMode };

export type EverydayTab = 'cash' | 'friends' | 'savings' | 'activity' | 'settings';
export type EverydayExternalSnapshot = { externalRows: EverydayExternalRow[]; balanceRows: EverydayExternalBalanceRow[]; nativeBalance: bigint; decimals: number; symbol: string; tokenAddress: string };

const catalogLoader = createExternalTokenCatalogLoader(() => fetchExternalTokenCatalog(resolveEverydayApiBase()));

export function formatUsd(raw: bigint, decimals = 6): string {
  const abs = raw < 0n ? -raw : raw;
  const subCent = abs > 0n && abs < 10n ** BigInt(decimals) / 100n;
  const text = subCent ? formatDecimal(abs, decimals, { max: 4 }) : formatDecimal(abs, decimals, { min: 2, max: 2 });
  return `${raw < 0n ? '−' : ''}$${text.includes('.') ? text : `${text}.00`}`;
}

export function formatSignedUsd(raw: bigint, decimals = 6): string {
  if (raw > 0n) return `+${formatUsd(raw, decimals)}`;
  return raw < 0n ? formatUsd(raw, decimals) : '$0.00';
}

export function parseUsdAmount(raw: string, decimals = 6): bigint {
  const trimmed = raw.trim();
  return parseTokenAmountInput(trimmed.startsWith('.') ? `0${trimmed}` : trimmed, decimals);
}

export function resolveContactTarget(raw: string, contacts: ReadonlyArray<{ entityId: string; label?: string | null }>): { target: string; ambiguous: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { target: '', ambiguous: false };
  const lower = trimmed.toLowerCase();
  if (/^0x[0-9a-f]{64}$/.test(lower)) return { target: lower, ambiguous: false };
  const matches = contacts.filter(c => (c.label ?? '').trim().toLowerCase() === lower);
  if (matches.length === 1) return { target: matches[0]!.entityId.toLowerCase(), ambiguous: false };
  return { target: '', ambiguous: matches.length > 1 };
}

export async function loadEverydayExternalSnapshot(params: {
  runtimeId: string; entityId: string; signerId: string; jurisdiction: string;
  frame: RuntimeAdapterViewFrame | null; liveEnv: RuntimeReplica | null; xln: XLNModule | null; force?: boolean | undefined;
}): Promise<EverydayExternalSnapshot | null> {
  if (!params.entityId || !params.signerId || !params.jurisdiction) return null;
  try {
    const tokens = await catalogLoader(params.runtimeId, params.jurisdiction);
    const jadapter: JAdapter | null = params.liveEnv && params.xln?.getEntityJAdapter ? params.xln.getEntityJAdapter(params.liveEnv, params.entityId, params.signerId) : null;
    const spender = resolveExternalWalletSpender(jadapter, params.jurisdiction, []) || String(params.frame?.activeEntity?.core.config.jurisdiction?.depositoryAddress || '').trim();
    const allowanceReads = isAddress(spender) && spender !== ZeroAddress ? tokens.filter(t => isAddress(t.address) && t.address !== ZeroAddress).map(t => ({ tokenAddress: t.address, spender })) : [];
    const observed = !params.force ? readExternalWalletState(params.frame?.activeEntity?.core.externalWallet, tokens, params.signerId, allowanceReads) : null;
    const read = observed ?? await requestExternalWalletSnapshot(resolveEverydayApiBase(), params.entityId, params.signerId, tokens, allowanceReads, jadapter);
    if (!read) return null;
    const allowanceByToken = new Map(allowanceReads.map((item, idx) => [item.tokenAddress.toLowerCase(), read.allowanceValues[idx] ?? 0n]));
    const errByToken = new Map((read.tokenErrors ?? []).map(item => [item.tokenAddress.toLowerCase(), item.error]));
    const externalRows: EverydayExternalRow[] = [];
    const balanceRows: EverydayExternalBalanceRow[] = [];
    tokens.forEach((token, idx) => {
      const balance = read.balances[idx] ?? 0n;
      const readError = errByToken.get(token.address.toLowerCase());
      balanceRows.push({ tokenId: token.tokenId, balance, ...(readError ? { readError } : {}) });
      if (typeof token.tokenId === 'number' && token.tokenId > 0) {
        externalRows.push({ tokenAddress: token.address, tokenId: token.tokenId, balance, allowance: allowanceByToken.get(token.address.toLowerCase()) ?? null });
      }
    });
    const primary = tokens.find(t => t.tokenId === 1) ?? tokens[0];
    return { externalRows, balanceRows, nativeBalance: read.nativeBalance, decimals: primary?.decimals ?? 6, symbol: primary?.symbol ?? 'USDC', tokenAddress: primary?.address ?? '' };
  } catch { return null; }
}

async function readPaymentRoutes(
  query: EverydayRouteQuery,
  ctx: { liveEnv?: RuntimeReplica | null | undefined; xln?: XLNModule | null | undefined; deps?: { adapter?: Pick<RuntimeAdapter, 'read'> } | undefined },
): Promise<EverydaySendRoute[]> {
  const wireQuery: RuntimeAdapterReadQuery = {
    sourceEntityId: query.sourceEntityId,
    targetEntityId: query.targetEntityId,
    tokenId: query.tokenId,
    amount: query.amount.toString(),
    ...(query.fundingAccountId ? { fundingAccountId: query.fundingAccountId } : {}),
  };
  let response: RuntimeAdapterPaymentRoutesResponse;
  if (ctx.deps?.adapter) {
    response = await ctx.deps.adapter.read<RuntimeAdapterPaymentRoutesResponse>('payment-routes', wireQuery);
  } else {
    const env = ctx.liveEnv ? (unwrapLiveRuntimeEnv(ctx.liveEnv) ?? ctx.liveEnv) : null;
    if (getRuntimeControllerConfig()?.mode !== 'remote' && env && ctx.xln?.findPaymentRoutes) {
      response = await ctx.xln.findPaymentRoutes(env, wireQuery);
    } else {
      const adapter = getRuntimeControllerAdapter();
      if (!adapter) throw new Error('Wallet connection is still starting.');
      response = await adapter.read<RuntimeAdapterPaymentRoutesResponse>('payment-routes', wireQuery);
    }
  }
  return response.routes.map(r => ({
    path: r.path.map(id => id.toLowerCase()),
    totalFee: BigInt(r.totalFee),
    senderAmount: BigInt(r.senderAmount),
    recipientAmount: BigInt(r.recipientAmount),
  }));
}

export async function quoteEverydayRoute(params: {
  entityId: string; targetEntityId: string; tokenId: number; amount: bigint; primaryHubId: string | null; cash: bigint;
  liveEnv?: RuntimeReplica | null | undefined; xln?: XLNModule | null | undefined;
  deps?: { adapter?: Pick<RuntimeAdapter, 'read'> };
}): Promise<EverydaySendRoute> {
  const { routes } = await quoteEverydayRoutes({
    sourceEntityId: params.entityId,
    targetEntityId: params.targetEntityId,
    tokenId: params.tokenId,
    amount: params.amount,
    primaryHubId: params.primaryHubId,
    canFundFromHub: params.cash > 0n,
    fetchRoutes: query => readPaymentRoutes(query, params),
  });
  const best = routes[0];
  if (!best) throw new Error('No payment path is available for this recipient.');
  return best;
}

export async function quoteSettleTabRoute(params: {
  frame: RuntimeAdapterViewFrame | null | undefined; entityId: string; targetEntityId: string; tokenId: number; amount: bigint;
  primaryHubId: string | null; deriveDeltaFn: (delta: Delta, isLeft: boolean) => DerivedDelta;
  liveEnv?: RuntimeReplica | null | undefined; xln?: XLNModule | null | undefined;
  deps?: { adapter?: Pick<RuntimeAdapter, 'read'> };
}): Promise<{ route: EverydaySendRoute; deliveryMode: PaymentDeliveryMode; targetEntityId: string }> {
  const self = params.entityId.toLowerCase();
  const target = params.targetEntityId.toLowerCase();
  const env = params.liveEnv ? (unwrapLiveRuntimeEnv(params.liveEnv) ?? params.liveEnv) : null;
  return quoteCanonicalSettleTabRoute({
    frame: params.frame,
    entityId: params.entityId,
    targetEntityId: params.targetEntityId,
    tokenId: params.tokenId,
    amount: params.amount,
    primaryHubId: params.primaryHubId,
    deriveDeltaFn: params.deriveDeltaFn,
    fetchRoutes: query => readPaymentRoutes(query, params),
    prepareCycleRoutes:
      !params.deps?.adapter && getRuntimeControllerConfig()?.mode !== 'remote' && env
        ? async () => {
            await params.xln?.ensureGossipProfiles?.(env, [target], { missIsRetried: true }).catch(() => false);
            await env.infrastructure?.p2p?.ensureRoutes?.(target, self, params.amount, params.tokenId).catch(() => false);
          }
        : undefined,
  });
}

export async function requestEverydayTestCash(params: { entityId: string; runtimeId: string; primaryHubId: string | null; tokenId: number; symbol: string }): Promise<void> {
  const apiBase = resolveEverydayApiBase();
  const url = params.primaryHubId ? `${apiBase}/api/faucet/offchain` : `${apiBase}/api/faucet/reserve`;
  const payload = params.primaryHubId
    ? { userEntityId: params.entityId, userRuntimeId: params.runtimeId, hubEntityId: params.primaryHubId, tokenId: params.tokenId, amount: '100' }
    : { userEntityId: params.entityId, tokenId: params.tokenId, tokenSymbol: params.symbol, amount: '100' };
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000) });
  const body = requireUnknownRecord(await res.json(), 'FAUCET_RESPONSE_INVALID');
  if (!res.ok || body['success'] !== true) throw new Error(String(body['error'] ?? `Test faucet failed (${res.status})`));
}

export function resolveRecoveryShieldInput(runtime: Runtime | null | undefined): RecoveryShieldStatusInput | null {
  const rec = runtime?.recovery;
  const towers = (rec?.towers ?? []).filter(t => t.enabled !== false && t.url).map(t => t.url);
  if (towers.length === 0) return { mode: 'local', towers: [], backupError: null, protectionError: null, automaticResponseEnabled: false };
  const hasAuto = (rec?.towers ?? []).some(t => t.enabled !== false && t.towerMode === 'delayed_last_resort');
  const receipts = rec?.lastTowerReceipts ?? [];
  const failures = (rec?.lastTowerFailures ?? []).filter(f => !f.error.includes('WATCHTOWER_TRON_SUBMISSION_UNSUPPORTED'));
  const attemptHeight = rec?.lastTowerUploadAttemptHeight ?? 0;
  const attemptAt = rec?.lastTowerUploadAttemptAt ?? 0;
  const latestBackup = receipts.find(r => r.towerMode === 'blind_backup' && r.appointmentSequence == null);
  const latestProtection = receipts.find(r => r.towerMode === 'delayed_last_resort' || r.appointmentSequence != null);
  const latestFailure = failures[0];
  const backupFailed = Boolean(latestFailure && (!latestBackup || (attemptHeight > 0 ? latestBackup.height < attemptHeight : latestFailure.checkedAt >= latestBackup.receivedAt)));
  const protectionFailure = hasAuto && !backupFailed
    ? failures.find(f => f.checkedAt >= attemptAt && (!latestProtection || (attemptHeight > 0 ? latestProtection.height < attemptHeight : f.checkedAt >= latestProtection.receivedAt)))
    : undefined;
  return { mode: 'tower', towers, backupError: backupFailed ? (latestFailure?.error ?? 'Upload failed') : null, protectionError: protectionFailure ? protectionFailure.error : null, automaticResponseEnabled: hasAuto };
}
