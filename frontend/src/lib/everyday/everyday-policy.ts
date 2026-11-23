import { effectiveRebalanceTerms } from '@xln/core/account/config/term-notice';
import type {
  Delta,
  DerivedDelta,
  JBatch,
  RuntimeAdapterViewFrame,
} from '@xln/core/api/public/runtime-module';
import type { WalletPosture } from './wallet-posture';

export const EVERYDAY_HUB_POLICY_USD = {
  transitCreditUsd: 250,
  softLimitUsd: 1,
  hardLimitUsd: 250,
  maxFeeUsd: 2,
} as const;

export const PRO_HUB_POLICY_USD = {
  transitCreditUsd: 10_000,
  softLimitUsd: 500,
  hardLimitUsd: 10_000,
  maxFeeUsd: 15,
} as const;

export type HubPolicyUsd = {
  transitCreditUsd: number;
  softLimitUsd: number;
  hardLimitUsd: number;
  maxFeeUsd: number;
};

export function resolvePolicyForPosture(
  posture: WalletPosture,
  proOverride?: { softLimitUsd: number; hardLimitUsd: number; maxFeeUsd: number },
): HubPolicyUsd {
  if (posture === 'everyday') return { ...EVERYDAY_HUB_POLICY_USD };
  if (!proOverride) return { ...PRO_HUB_POLICY_USD };
  return {
    transitCreditUsd: PRO_HUB_POLICY_USD.transitCreditUsd,
    softLimitUsd: proOverride.softLimitUsd,
    hardLimitUsd: proOverride.hardLimitUsd,
    maxFeeUsd: proOverride.maxFeeUsd,
  };
}

const norm = (value: unknown): string => String(value || '').trim().toLowerCase();

/** Reserve movement already queued in the draft batch, so available reserve never double-spends. */
export function draftReserveDelta(entityId: string, batch: JBatch | null | undefined, tokenId: number): bigint {
  if (!batch) return 0n;
  const self = norm(entityId);
  let delta = 0n;
  for (const op of batch.externalTokenToReserve ?? []) {
    if ((op.entity ? norm(op.entity) : self) === self && op.internalTokenId === tokenId) delta += op.amount;
  }
  for (const op of batch.collateralToReserve ?? []) {
    if (op.tokenId === tokenId) delta += op.amount;
  }
  for (const settlement of batch.settlements ?? []) {
    for (const diff of settlement.diffs ?? []) {
      if (diff.tokenId !== tokenId) continue;
      if (norm(settlement.leftEntity) === self) delta += diff.leftDiff;
      else if (norm(settlement.rightEntity) === self) delta += diff.rightDiff;
    }
  }
  for (const op of batch.reserveToReserve ?? []) {
    if (op.tokenId !== tokenId) continue;
    delta -= op.amount;
    if (norm(op.receivingEntity) === self) delta += op.amount;
  }
  for (const op of batch.reserveToExternalToken ?? []) {
    if (op.tokenId === tokenId) delta -= op.amount;
  }
  for (const op of batch.reserveToCollateral ?? []) {
    if (op.tokenId !== tokenId) continue;
    for (const pair of op.pairs ?? []) delta -= pair.amount;
  }
  return delta;
}

export function batchFundsPair(
  batch: JBatch | null | undefined,
  owner: string,
  peer: string,
  tokenId: number,
): boolean {
  const normalizedOwner = norm(owner);
  const normalizedPeer = norm(peer);
  return Boolean(
    batch?.reserveToCollateral?.some(
      op =>
        op.tokenId === tokenId &&
        norm(op.receivingEntity) === normalizedOwner &&
        op.pairs.some(pair => norm(pair.entity) === normalizedPeer && pair.amount > 0n),
    ),
  );
}

type EntityCoreView = NonNullable<RuntimeAdapterViewFrame['activeEntity']>['core'];
type AccountDoc = NonNullable<RuntimeAdapterViewFrame['activeEntity']>['accounts']['items'][number];

export const isAccountDisputed = (
  doc: Pick<AccountDoc, 'activeDispute' | 'disputePrepare' | 'status'> | null | undefined,
): boolean =>
  Boolean(
    doc &&
      (doc.activeDispute ||
        doc.disputePrepare ||
        String(doc.status || '').toLowerCase().includes('dispute')),
  );

export function availableReserveBalance(
  entityId: string,
  core: EntityCoreView | null | undefined,
  tokenId: number,
): bigint {
  if (!core) return 0n;
  const reserve = (core.reserves?.get(tokenId) ?? 0n) + draftReserveDelta(entityId, core.jBatchState?.batch, tokenId);
  const debt = core.debtTotals?.outgoing?.get(tokenId) ?? 0n;
  return reserve > debt ? reserve - debt : 0n;
}

export type HubRebalanceInspection = {
  status: 'settled' | 'settling' | 'fee-above-cap' | 'fee-consumes-transfer' | 'below-soft-limit' | 'pending-queue';
  outPeerCredit: bigint;
  requestedAmount: bigint;
  /** Fee the provider will charge when the deposit is requested; zero once it is requested. */
  computedFee: bigint;
  /** Fee already taken for the deposit in flight; zero until it is requested. */
  paidFee: bigint;
  maxAcceptableFee: bigint;
};

export function inspectHubRebalanceStatus(params: {
  doc: Pick<AccountDoc, 'state' | 'currentFrame'>;
  isLeft: boolean;
  tokenId: number;
  policy: { r2cRequestSoftLimit: bigint; hardLimit: bigint; maxAcceptableFee: bigint };
  deriveDeltaFn: (delta: Delta, isLeft: boolean) => DerivedDelta;
  nowMs?: number | undefined;
}): HubRebalanceInspection {
  const delta = params.doc.state.deltas.get(params.tokenId);
  const outPeerCredit = delta ? params.deriveDeltaFn(delta, params.isLeft).outPeerCredit : 0n;
  const requestedAmount = params.doc.state.requestedRebalance.get(params.tokenId) ?? 0n;
  const base = { outPeerCredit, requestedAmount, paidFee: 0n, maxAcceptableFee: params.policy.maxAcceptableFee };
  if (outPeerCredit === 0n) return { ...base, status: 'settled', computedFee: 0n };
  if (requestedAmount > 0n) {
    const feeState = params.doc.state.requestedRebalanceFeeState?.get(params.tokenId);
    const paidFee = feeState ? feeState.feePaidUpfront - (feeState.refund?.refundedAmount ?? 0n) : 0n;
    return { ...base, status: 'settling', computedFee: 0n, paidFee: paidFee > 0n ? paidFee : 0n };
  }
  const side = params.isLeft ? 'right' : 'left';
  const snapshot = params.doc.state.rebalanceFeePolicies?.get(params.tokenId)?.[side];
  if (!snapshot) return { ...base, status: 'pending-queue', computedFee: 0n };
  const terms = effectiveRebalanceTerms(snapshot, params.doc.currentFrame?.timestamp ?? params.nowMs ?? 0);
  const computedFee = terms.baseFee + terms.gasFee + (outPeerCredit * terms.liquidityFeeBps) / 10_000n;
  if (outPeerCredit < params.policy.r2cRequestSoftLimit) {
    return { ...base, status: 'below-soft-limit', computedFee };
  }
  if (computedFee > params.policy.maxAcceptableFee) {
    return { ...base, status: 'fee-above-cap', computedFee };
  }
  if (outPeerCredit <= computedFee) {
    return { ...base, status: 'fee-consumes-transfer', computedFee };
  }
  return { ...base, status: 'pending-queue', computedFee };
}

export const EVERYDAY_ARRIVING_FEE_CAP_NOTE =
  'Automatic deposit paused — provider fee is above the $2 limit.';

/**
 * What the person is told while money is arriving. The provider's fee is known before it is
 * charged, so the note states it and what will actually join Cash; nothing is left to infer
 * from a balance that lands smaller than the amount that was sent.
 */
export function formatEverydayArrivingNote(
  inspection: Pick<HubRebalanceInspection, 'status'> & Partial<Pick<HubRebalanceInspection, 'outPeerCredit' | 'computedFee' | 'paidFee'>> | null | undefined,
  defaultNote: string,
  money?: (amount: bigint) => string,
): string {
  if (inspection?.status === 'fee-above-cap' || inspection?.status === 'fee-consumes-transfer') {
    return EVERYDAY_ARRIVING_FEE_CAP_NOTE;
  }
  if (!inspection || !money) return defaultNote;
  const arriving = inspection.outPeerCredit ?? 0n;
  const fee = inspection.computedFee ?? 0n;
  const paid = inspection.paidFee ?? 0n;
  if (inspection.status === 'pending-queue' && fee > 0n && arriving > fee) {
    return `A ${money(fee)} provider fee comes out first, so ${money(arriving - fee)} joins your Cash.`;
  }
  if (inspection.status === 'settling' && paid > 0n) {
    return `${money(paid)} provider fee paid. ${money(arriving)} joins your Cash when this finishes.`;
  }
  return defaultNote;
}
