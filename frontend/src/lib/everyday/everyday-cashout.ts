import { defaultAccountDisputeConfigForParties, type AccountDisputeConfig } from '@xln/core/account/config/dispute-config';
import { createDefaultDelta } from '@xln/core/account/state/delta';
import {
  isTronChainId,
  type AccountCapacitySource,
  type Delta,
  type DerivedDelta,
  type EntityTx,
  type RuntimeAdapterEntitySummary,
  type RuntimeAdapterViewFrame,
} from '@xln/core/api/public/runtime-module';
import {
  buildBroadcastTx,
  buildMoveSettlementContinuation,
  buildReserveToExternalEoaTx,
} from '../components/Entity/account/entity-action-txs';
import { normalizeExternalRecipient } from '../components/Entity/move/external-recipient';
import { withdrawableCollateral } from '../components/Entity/move-routes';
import { availableReserveBalance, isAccountDisputed } from './everyday-policy';

export type EverydayCashOutPlan =
  | { kind: 'from-reserve'; entityTxs: EntityTx[] }
  | { kind: 'from-hub-collateral'; fromReserve: bigint; fromCollateral: bigint; entityTxs: EntityTx[] }
  | { kind: 'pending-settlement' }
  | { kind: 'needs-gas' }
  | { kind: 'disputed'; counterpartyId: string }
  | { kind: 'invalid-recipient'; message: string }
  | { kind: 'insufficient'; shortfall: bigint; available: bigint };

export function explainEverydayCashOutBlock(
  plan: Exclude<EverydayCashOutPlan, { kind: 'from-reserve' | 'from-hub-collateral' }>,
  formatAvailable: (available: bigint) => string,
): string {
  switch (plan.kind) {
    case 'pending-settlement':
      return 'A previous cash out is still finishing.';
    case 'needs-gas':
      return 'Add a small amount of network gas to cash out on-chain.';
    case 'disputed':
      return 'This account is paused for recovery right now.';
    case 'invalid-recipient':
      return plan.message;
    case 'insufficient':
      return `Only ${formatAvailable(plan.available)} is ready to cash out right now. Arriving money finishes automatically first.`;
  }
}

const norm = (value: unknown): string => String(value || '').trim().toLowerCase();

export function planEverydayCashOut(params: {
  frame: RuntimeAdapterViewFrame | null | undefined;
  entityId: string;
  recipientEoa: string;
  tokenId: number;
  amount: bigint;
  jurisdictionMode?: string | undefined;
  hubAccountId?: string | null | undefined;
  nativeBalance?: bigint | null | undefined;
  deriveDeltaFn: (delta: Delta, isLeft: boolean) => DerivedDelta;
}): EverydayCashOutPlan {
  const self = norm(params.entityId);
  if (params.amount <= 0n) return { kind: 'insufficient', shortfall: 0n, available: 0n };
  const active = params.frame?.activeEntity;
  const core = active?.core;
  const chainId = core?.config?.jurisdiction?.chainId ?? active?.summary?.jurisdiction?.chainId;
  const jurisdictionMode =
    params.jurisdictionMode ?? (chainId !== undefined && chainId !== '' && isTronChainId(Number(chainId)) ? 'tron' : undefined);
  let recipientEoa: string;
  try {
    recipientEoa = normalizeExternalRecipient(params.recipientEoa, jurisdictionMode);
  } catch (error) {
    return { kind: 'invalid-recipient', message: error instanceof Error && error.message ? error.message : 'Recipient must be a valid EOA address' };
  }
  const availReserve = availableReserveBalance(self, core, params.tokenId);
  const zeroGas = params.nativeBalance !== null && params.nativeBalance !== undefined && params.nativeBalance <= 0n;
  const hasPendingBatchOrContinuation =
    Boolean(core?.jBatchState?.sentBatch) || (core?.settlementContinuations?.size ?? 0) > 0;
  if (availReserve >= params.amount) {
    if (hasPendingBatchOrContinuation) return { kind: 'pending-settlement' };
    if (zeroGas) return { kind: 'needs-gas' };
    return { kind: 'from-reserve', entityTxs: [buildReserveToExternalEoaTx(recipientEoa, params.tokenId, params.amount), buildBroadcastTx()] };
  }
  const hubIds = new Set((params.frame?.entities ?? []).filter(entry => entry.isHub === true).map(entry => norm(entry.entityId)));
  const preferred = norm(params.hubAccountId);
  let best: { counterpartyId: string; withdrawable: bigint; busy: boolean } | null = null;
  let firstDisputedHub: string | null = null;
  for (const doc of active?.accounts?.items ?? []) {
    const isLeft = norm(doc.state.leftEntity) === self;
    const peer = norm(isLeft ? doc.state.rightEntity : doc.state.leftEntity);
    if ((!preferred && !hubIds.has(peer)) || (preferred && peer !== preferred)) continue;
    if (isAccountDisputed(doc)) {
      firstDisputedHub ??= peer;
      continue;
    }
    const delta = doc.state.deltas.get(params.tokenId);
    // Outgoing cash-out uses withdrawableCollateral (outCollateral - holds) and never outPeerCredit.
    const avail = delta ? withdrawableCollateral(params.deriveDeltaFn(delta, isLeft)) : 0n;
    const busy = Boolean(doc.state.settlementWorkspace);
    if (!best || avail > best.withdrawable) best = { counterpartyId: peer, withdrawable: avail, busy };
  }
  if (!best && firstDisputedHub) return { kind: 'disputed', counterpartyId: firstDisputedHub };
  const totalAvailable = availReserve + (best?.withdrawable ?? 0n);
  if (!best || totalAvailable < params.amount) {
    return { kind: 'insufficient', shortfall: params.amount - totalAvailable, available: totalAvailable };
  }
  if (hasPendingBatchOrContinuation || best.busy) return { kind: 'pending-settlement' };
  if (zeroGas) return { kind: 'needs-gas' };
  const fromCollateral = params.amount - availReserve;
  return {
    kind: 'from-hub-collateral',
    fromReserve: availReserve,
    fromCollateral,
    entityTxs: [{
      type: 'settle_propose',
      data: {
        counterpartyEntityId: best.counterpartyId,
        executorIsLeft: self < best.counterpartyId,
        memo: 'asset-c2r',
        ops: [{ type: 'c2r', tokenId: params.tokenId, amount: fromCollateral }],
        continuation: buildMoveSettlementContinuation(self, params.tokenId, params.amount, { type: 'r2e', recipientEoa }, true),
      },
    }],
  };
}

export function planFriendSplitTxs(input: {
  entityId: string;
  counterpartyEntityId: string;
  tokenId: number;
  splitAmount: bigint;
  existingAccount: AccountCapacitySource | null;
  deriveDeltaFn: (delta: Delta, isLeft: boolean) => DerivedDelta;
  summaries?: readonly RuntimeAdapterEntitySummary[] | undefined;
  disputeConfig?: AccountDisputeConfig | undefined;
}): EntityTx[] {
  const self = norm(input.entityId);
  const counterparty = norm(input.counterpartyEntityId);
  if (!self || !counterparty || self === counterparty || input.splitAmount <= 0n) {
    throw new Error('EVERYDAY_FRIEND_SPLIT_INVALID');
  }
  if (input.existingAccount) {
    const isLeft = norm(input.existingAccount.leftEntity) === self;
    const derived = input.deriveDeltaFn(input.existingAccount.deltas.get(input.tokenId) ?? createDefaultDelta(input.tokenId), isLeft);
    return [{ type: 'extendCredit', data: { counterpartyEntityId: counterparty, tokenId: input.tokenId, amount: derived.peerCreditLimit + input.splitAmount } }];
  }
  let config = input.disputeConfig;
  if (!config) {
    const selfSummary = input.summaries?.find(entry => norm(entry.entityId) === self);
    const peerSummary = input.summaries?.find(entry => norm(entry.entityId) === counterparty);
    if (typeof selfSummary?.isHub !== 'boolean' || typeof peerSummary?.isHub !== 'boolean') {
      throw new Error('ACCOUNT_ROLE_UNAVAILABLE');
    }
    config = defaultAccountDisputeConfigForParties(self, selfSummary.isHub, counterparty, peerSummary.isHub);
  }
  return [{ type: 'openAccount', data: { targetEntityId: counterparty, disputeConfig: config, tokenId: input.tokenId, creditAmount: input.splitAmount, pinPublic: true } }];
}
