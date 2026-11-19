import { createDefaultDelta } from '@xln/core/account/state/delta';
import { buildPaymentRuntimeInput } from '@xln/core/api/payments/command';
import type {
  Delta,
  DerivedDelta,
  EntityTx,
  PaymentDeliveryMode,
  RuntimeAdapterViewFrame,
  RuntimeInput,
} from '@xln/core/api/public/runtime-module';
import {
  buildBroadcastTx,
  buildExternalToReserveTx,
  buildReserveToCollateralTx,
} from '../components/Entity/account/entity-action-txs';
import { availableReserveBalance, batchFundsPair, isAccountDisputed } from './everyday-policy';

export * from './everyday-cashout';
export * from './everyday-policy';
export * from './everyday-recovery';

export type EverydayExternalRow = { tokenAddress: string; tokenId: number; balance: bigint; allowance: bigint | null };
export type EverydaySendRoute = { path: string[]; totalFee: bigint; senderAmount: bigint; recipientAmount: bigint };

export type EverydayCapacityPlan =
  | { kind: 'ready' }
  | {
      kind: 'fund';
      requiredDeposit: bigint;
      fromReserve: bigint;
      fromExternal: bigint;
      needsApprovalAmount: bigint;
      tokenAddress: string;
      fundingTxs: EntityTx[];
    }
  | { kind: 'pending-funding'; reason: 'sent-batch' | 'queued-deposit' }
  | { kind: 'needs-gas'; requiredTx: 'e2r' | 'r2c' }
  | { kind: 'disputed'; counterpartyId: string }
  | { kind: 'insufficient'; shortfall: bigint };

export type EverydaySendPlan =
  | { kind: 'ready'; paymentInput: RuntimeInput }
  | {
      kind: 'fund-and-pay';
      requiredDeposit: bigint;
      fromReserve: bigint;
      fromExternal: bigint;
      needsApprovalAmount: bigint;
      tokenAddress: string;
      fundingTxs: EntityTx[];
      paymentInput: RuntimeInput;
    }
  | { kind: 'pending-funding'; reason: 'sent-batch' | 'queued-deposit'; paymentInput: RuntimeInput }
  | { kind: 'needs-gas'; requiredTx: 'e2r' | 'r2c'; paymentInput: RuntimeInput }
  | { kind: 'disputed'; counterpartyId: string }
  | { kind: 'insufficient'; shortfall: bigint };

export function explainEverydaySendBlock(
  plan: Exclude<EverydaySendPlan, { kind: 'ready' | 'fund-and-pay' }>,
): string {
  switch (plan.kind) {
    case 'pending-funding':
      return 'A deposit is already finishing. Try again in a moment.';
    case 'needs-gas':
      return 'Add a small amount of network gas before sending.';
    case 'disputed':
      return 'This account is paused for recovery right now.';
    case 'insufficient':
      return 'Not enough Cash is available for this payment.';
  }
}

const norm = (value: unknown): string => String(value || '').trim().toLowerCase();
const nonNeg = (value: bigint): bigint => (value < 0n ? 0n : value);

export function planEverydayCapacityFunding(params: {
  frame: RuntimeAdapterViewFrame | null | undefined;
  entityId: string;
  counterpartyId: string;
  tokenId: number;
  amount: bigint;
  externalRows: readonly EverydayExternalRow[];
  nativeBalance?: bigint | null | undefined;
  deriveDeltaFn: (delta: Delta, isLeft: boolean) => DerivedDelta;
}): EverydayCapacityPlan {
  const self = norm(params.entityId);
  const peer = norm(params.counterpartyId);
  const core = params.frame?.activeEntity?.core;
  const doc = params.frame?.activeEntity?.accounts?.items.find(
    item =>
      (norm(item.state.leftEntity) === self && norm(item.state.rightEntity) === peer) ||
      (norm(item.state.rightEntity) === self && norm(item.state.leftEntity) === peer),
  );
  if (!doc) return { kind: 'insufficient', shortfall: params.amount };
  if (isAccountDisputed(doc)) return { kind: 'disputed', counterpartyId: peer };
  const derived = params.deriveDeltaFn(
    doc.state.deltas.get(params.tokenId) ?? createDefaultDelta(params.tokenId),
    norm(doc.state.leftEntity) === self,
  );
  const uncoveredDebt = nonNeg(derived.inOwnCredit - derived.ownCreditLimit);
  const capacityGap = nonNeg(
    params.amount + derived.outAllowance + derived.outTotalHold -
      derived.outPeerCredit - derived.outCollateral - derived.outOwnCredit,
  );
  const requiredDeposit = derived.outCapacity >= params.amount ? 0n : uncoveredDebt + capacityGap;
  if (requiredDeposit === 0n) return { kind: 'ready' };
  if (Boolean(core?.jBatchState?.sentBatch)) return { kind: 'pending-funding', reason: 'sent-batch' };
  if (batchFundsPair(core?.jBatchState?.batch, self, peer, params.tokenId)) {
    return { kind: 'pending-funding', reason: 'queued-deposit' };
  }
  const availReserve = availableReserveBalance(self, core, params.tokenId);
  const fromReserve = availReserve >= requiredDeposit ? requiredDeposit : availReserve;
  const fromExternal = requiredDeposit - fromReserve;
  const extRow = params.externalRows.find(row => row.tokenId === params.tokenId);
  const extBalance = extRow?.balance ?? 0n;
  if (fromExternal > 0n && !extRow?.tokenAddress?.trim()) return { kind: 'insufficient', shortfall: fromExternal };
  if (fromExternal > extBalance) return { kind: 'insufficient', shortfall: fromExternal - extBalance };
  if (params.nativeBalance !== null && params.nativeBalance !== undefined && params.nativeBalance <= 0n) {
    return { kind: 'needs-gas', requiredTx: fromExternal > 0n ? 'e2r' : 'r2c' };
  }
  const needsApprovalAmount =
    fromExternal > 0n && (extRow?.allowance === null || extRow === undefined || extRow.allowance < fromExternal)
      ? fromExternal
      : 0n;
  const fundingTxs: EntityTx[] = [];
  if (fromExternal > 0n && extRow) {
    fundingTxs.push(
      buildExternalToReserveTx({
        contractAddress: extRow.tokenAddress,
        amount: fromExternal,
        internalTokenId: params.tokenId,
      }),
    );
  }
  fundingTxs.push(
    buildReserveToCollateralTx({
      counterpartyEntityId: peer,
      selfEntityId: self,
      tokenId: params.tokenId,
      amount: requiredDeposit,
    }),
  );
  fundingTxs.push(buildBroadcastTx());
  return {
    kind: 'fund',
    requiredDeposit,
    fromReserve,
    fromExternal,
    needsApprovalAmount,
    tokenAddress: extRow?.tokenAddress ?? '',
    fundingTxs,
  };
}

export function planEverydaySend(params: {
  frame: RuntimeAdapterViewFrame | null | undefined;
  entityId: string;
  signerId: string;
  targetEntityId: string;
  tokenId: number;
  deliveryMode: PaymentDeliveryMode;
  description: string;
  route: EverydaySendRoute;
  externalRows: readonly EverydayExternalRow[];
  nativeBalance?: bigint | null | undefined;
  deriveDeltaFn: (delta: Delta, isLeft: boolean) => DerivedDelta;
}): EverydaySendPlan {
  const self = norm(params.entityId);
  const paymentInput = buildPaymentRuntimeInput({
    entityId: self,
    signerId: params.signerId,
    targetEntityId: params.targetEntityId,
    tokenId: params.tokenId,
    deliveryMode: params.deliveryMode,
    description: params.description,
    route: params.route,
  });
  const firstHop = norm(params.route.path[1] ?? params.targetEntityId);
  const capacity = planEverydayCapacityFunding({
    frame: params.frame,
    entityId: self,
    counterpartyId: firstHop,
    tokenId: params.tokenId,
    amount: params.route.senderAmount,
    externalRows: params.externalRows,
    nativeBalance: params.nativeBalance,
    deriveDeltaFn: params.deriveDeltaFn,
  });
  switch (capacity.kind) {
    case 'ready':
      return { kind: 'ready', paymentInput };
    case 'fund':
      return {
        kind: 'fund-and-pay',
        requiredDeposit: capacity.requiredDeposit,
        fromReserve: capacity.fromReserve,
        fromExternal: capacity.fromExternal,
        needsApprovalAmount: capacity.needsApprovalAmount,
        tokenAddress: capacity.tokenAddress,
        fundingTxs: capacity.fundingTxs,
        paymentInput,
      };
    case 'pending-funding':
      return { kind: 'pending-funding', reason: capacity.reason, paymentInput };
    case 'needs-gas':
      return { kind: 'needs-gas', requiredTx: capacity.requiredTx, paymentInput };
    case 'disputed':
    case 'insufficient':
      return capacity;
  }
}
