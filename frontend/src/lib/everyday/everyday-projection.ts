import type { Delta, DerivedDelta, RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import { accountNetBalance } from '../utils/ui/accountBalance';
import { resolveAccountDisputePhase, type EverydayDisputeNotice } from './everyday-recovery';
export { classifyExternalRequest, type ClassifyExternalRequestParams, type ExternalRequestClassification, type ExternalRequestKind } from './external-request';
export type { EverydayDisputeNotice, EverydayDisputePhase } from './everyday-recovery';

export type FriendTabRow = {
  counterpartyId: string;
  label: string;
  tokenId: number;
  signedAmount: bigint;
  peerCreditLimit: bigint;
  ownCreditLimit: bigint;
  disputed: boolean;
};
export type EverydayTokenProjection = { tokenId: number; cash: bigint; arriving: bigint; savings: bigint; friendsOweYou: bigint; youOweFriends: bigint };
export type EverydayProjection = {
  cash: bigint;
  arriving: bigint;
  savings: bigint;
  friendTabs: FriendTabRow[];
  friendsOweYou: bigint;
  youOweFriends: bigint;
};
export type EverydayExternalBalanceRow = { tokenId: number | undefined; balance: bigint; error?: string | undefined; readError?: string | undefined };
export type EverydayWalletProjection = {
  entityId: string;
  signerId: string | null;
  jurisdiction: string | null;
  primaryTokenId: number;
  primary: EverydayProjection;
  byToken: Map<number, EverydayTokenProjection>;
  friendTabs: FriendTabRow[];
  hubAccounts: string[];
  disputes: EverydayDisputeNotice[];
  primaryHubId: string | null;
  hasZeroL1Gas: boolean;
};
export type ProjectEverydayWalletParams = {
  frame: RuntimeAdapterViewFrame | null | undefined;
  entityId?: string | null | undefined;
  externalRows?: readonly EverydayExternalBalanceRow[] | undefined;
  nativeBalance?: bigint | null | undefined;
  primaryTokenId?: number | undefined;
  deriveDeltaFn: (delta: Delta, isLeft: boolean) => DerivedDelta;
};
const norm = (value: unknown): string => String(value || '').trim().toLowerCase();
const emptyToken = (tokenId: number): EverydayTokenProjection => ({ tokenId, cash: 0n, arriving: 0n, savings: 0n, friendsOweYou: 0n, youOweFriends: 0n });
const ensureToken = (byToken: Map<number, EverydayTokenProjection>, tokenId: number): EverydayTokenProjection => {
  const existing = byToken.get(tokenId);
  if (existing) return existing;
  const created = emptyToken(tokenId);
  byToken.set(tokenId, created);
  return created;
};
export function projectEverydayWallet(params: ProjectEverydayWalletParams): EverydayWalletProjection {
  const primaryTokenId = params.primaryTokenId ?? 1;
  const frame = params.frame;
  const active = frame?.activeEntity ?? null;
  const targetId = norm(params.entityId) || norm(frame?.activeEntityId) || norm(active?.summary.entityId);
  const matchingActive = active && (!targetId || norm(active.summary.entityId) === targetId) ? active : null;
  const hasZeroL1Gas = params.nativeBalance !== null && params.nativeBalance !== undefined && params.nativeBalance <= 0n;
  const byToken = new Map<number, EverydayTokenProjection>([[primaryTokenId, emptyToken(primaryTokenId)]]);
  for (const row of params.externalRows ?? []) {
    if (!row.error && !row.readError && typeof row.tokenId === 'number' && row.tokenId > 0 && row.balance > 0n) ensureToken(byToken, row.tokenId).cash += row.balance;
  }
  const friendTabs: FriendTabRow[] = [];
  const hubAccounts: string[] = [];
  const disputedHubs = new Set<string>();
  const disputes: EverydayDisputeNotice[] = [];
  if (matchingActive) {
    const entityMap = new Map((frame?.entities ?? []).map(entity => [norm(entity.entityId), entity]));
    for (const [tokenId, reserve] of matchingActive.core.reserves ?? []) {
      const outgoing = matchingActive.core.debtTotals?.outgoing?.get(tokenId) ?? 0n;
      if (reserve > outgoing) ensureToken(byToken, tokenId).cash += reserve - outgoing;
    }
    const rawSavings = new Map<number, bigint>();
    for (const doc of matchingActive.accounts.items) {
      const isLeft = norm(doc.state.leftEntity) === targetId;
      const counterpartyId = norm(isLeft ? doc.state.rightEntity : doc.state.leftEntity);
      const summary = entityMap.get(counterpartyId);
      const label = summary?.label?.trim() || counterpartyId.slice(0, 10);
      const isHub = summary?.isHub === true;
      const dispute = resolveAccountDisputePhase(doc, isLeft, counterpartyId, matchingActive.core.jBatchState?.batch);
      if (dispute.phase !== 'none') {
        if (isHub) disputedHubs.add(counterpartyId);
        disputes.push({ counterpartyId, label, phase: dispute.phase, startedByUs: dispute.startedByUs, timeout: dispute.timeout, needsL1GasForUnilateralExit: dispute.phase !== 'closed' && hasZeroL1Gas });
      }
      for (const [tokenId, leftAmount] of doc.lendingBalances ?? []) rawSavings.set(tokenId, (rawSavings.get(tokenId) ?? 0n) + (isLeft ? leftAmount : -leftAmount));
      if (isHub) {
        hubAccounts.push(counterpartyId);
        for (const [tokenId, delta] of doc.state.deltas) {
          const derived = params.deriveDeltaFn(delta, isLeft);
          const bucket = ensureToken(byToken, tokenId);
          bucket.cash += derived.outCollateral;
          // Transient hub float stays strictly outside Cash until collateral settles on-chain.
          if (dispute.phase === 'none') bucket.arriving += derived.outPeerCredit;
        }
        continue;
      }
      let emitted = false;
      for (const [tokenId, delta] of doc.state.deltas) {
        const derived = params.deriveDeltaFn(delta, isLeft);
        const signedAmount = accountNetBalance(derived);
        if (signedAmount === 0n && derived.peerCreditLimit === 0n && derived.ownCreditLimit === 0n && dispute.phase === 'none') continue;
        emitted = true;
        const bucket = ensureToken(byToken, tokenId);
        if (signedAmount > 0n) bucket.friendsOweYou += signedAmount;
        else if (signedAmount < 0n) bucket.youOweFriends += -signedAmount;
        friendTabs.push({ counterpartyId, label, tokenId, signedAmount, peerCreditLimit: derived.peerCreditLimit, ownCreditLimit: derived.ownCreditLimit, disputed: dispute.phase !== 'none' });
      }
      if (!emitted) {
        const settledTokenId = doc.state.deltas.has(primaryTokenId) ? primaryTokenId : (doc.state.deltas.keys().next().value ?? primaryTokenId);
        friendTabs.push({ counterpartyId, label, tokenId: settledTokenId, signedAmount: 0n, peerCreditLimit: 0n, ownCreditLimit: 0n, disputed: false });
      }
    }
    for (const [tokenId, netSavings] of rawSavings) if (netSavings > 0n) ensureToken(byToken, tokenId).savings += netSavings;
  }
  friendTabs.sort((a, b) => a.label.localeCompare(b.label) || a.counterpartyId.localeCompare(b.counterpartyId) || a.tokenId - b.tokenId);
  disputes.sort((a, b) => a.counterpartyId.localeCompare(b.counterpartyId));
  const primaryBucket = byToken.get(primaryTokenId) ?? emptyToken(primaryTokenId);
  return {
    entityId: targetId,
    signerId: matchingActive?.summary.signerId ?? matchingActive?.core.signerId ?? null,
    jurisdiction: matchingActive?.summary.jurisdiction?.name ?? matchingActive?.core.config.jurisdiction?.name ?? null,
    primaryTokenId,
    primary: { cash: primaryBucket.cash, arriving: primaryBucket.arriving, savings: primaryBucket.savings, friendTabs: friendTabs.filter(t => t.tokenId === primaryTokenId), friendsOweYou: primaryBucket.friendsOweYou, youOweFriends: primaryBucket.youOweFriends },
    byToken, friendTabs, hubAccounts, disputes,
    primaryHubId: hubAccounts.find(id => !disputedHubs.has(id)) ?? hubAccounts[0] ?? null,
    hasZeroL1Gas,
  };
}
