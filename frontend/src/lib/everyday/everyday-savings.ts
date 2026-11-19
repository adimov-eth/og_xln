import { createDefaultDelta } from '@xln/core/account/state/delta';
import { asTokenDecimals } from '@xln/core/account/tx/units';
import type { EntityTx, RuntimeAdapterViewFrame, XLNModule } from '@xln/core/api/public/runtime-module';
import type { LendingBankTerms } from '@xln/core/types/finance/lending';
import { sleep } from '../utils/primitives';
import { buildLendingOfferTx, previewSavingsRisk } from '../../../../ui/src/runtime/financial/lending';
import {
  isAccountDisputed,
  planEverydayCapacityFunding,
  type EverydayExternalRow,
} from './everyday-autopilot';
import { claimFundingSubmission, fundingSubmissionKey, releaseFundingSubmission } from './funding-submission';

type AccountDoc = NonNullable<RuntimeAdapterViewFrame['activeEntity']>['accounts']['items'][number];

export type SavingsTerms = Pick<LendingBankTerms, 'termId' | 'savingsInterestBps'>;

const CONFIRMATION_TIMEOUT_MS = 60_000;
const CONFIRMATION_POLL_MS = 250;

/** What a shell supplies: how it reads the view frame, signs and sends, approves the depository, and finds the active offer. */
export type SavingsDepositAdapter = {
  deriveDelta: XLNModule['deriveDelta'];
  readViewFrame: (entityId: string) => Promise<RuntimeAdapterViewFrame | null>;
  sendEntityTxs: (txs: EntityTx[]) => Promise<unknown>;
  approveDepository: (approval: { tokenAddress: string; amount: bigint }) => Promise<void>;
  resolveTerms: (hubDoc: AccountDoc) => Promise<SavingsTerms>;
  onStage?: (stage: string) => void;
};

export type SavingsDepositParams = {
  frame: RuntimeAdapterViewFrame | null;
  entityId: string;
  hubId: string;
  tokenId: number;
  amount: bigint;
  amountText: string;
  decimals: number;
  externalRows: readonly EverydayExternalRow[];
  nativeBalance: bigint | null;
};

const findHubDoc = (frame: RuntimeAdapterViewFrame | null, hubId: string): AccountDoc | undefined => {
  const hub = hubId.toLowerCase();
  return frame?.activeEntity?.accounts.items.find(a => a.state.leftEntity.toLowerCase() === hub || a.state.rightEntity.toLowerCase() === hub);
};

const isLeftOf = (doc: AccountDoc, entityId: string): boolean => doc.state.leftEntity.toLowerCase() === entityId;

// Independent of funding-submission's batch handoff: observeFundingBatches clears the
// funding claim once the draft r2c appears, while Savings still awaits confirmation to
// submit the follow-up lendingOffer. Without this set, a second tap mid-poll deposits twice.
const savingsDepositsInFlight = new Set<string>();

/** One Savings deposit per entity, hub and token: a second submit before the first batch shows in the frame would fund the hub twice. */
export async function submitSavingsDeposit(params: SavingsDepositParams, adapter: SavingsDepositAdapter): Promise<void> {
  if (params.amount <= 0n) throw new Error('Enter an amount greater than zero.');
  const self = params.entityId.toLowerCase();
  const hub = params.hubId.toLowerCase();
  if (!findHubDoc(params.frame, hub)) throw new Error('Savings is unavailable right now.');
  const key = fundingSubmissionKey(self, hub, params.tokenId);
  if (savingsDepositsInFlight.has(key)) throw new Error('A deposit to Savings is already in progress.');
  savingsDepositsInFlight.add(key);
  let claimed = false;
  try {
    claimFundingSubmission(key);
    claimed = true;
    await depositToSavings({ ...params, entityId: self, hubId: hub }, adapter);
  } finally {
    if (claimed) releaseFundingSubmission(key);
    savingsDepositsInFlight.delete(key);
  }
}

async function depositToSavings(params: SavingsDepositParams, adapter: SavingsDepositAdapter): Promise<void> {
  const { entityId: self, hubId: hub, tokenId, amount } = params;
  const hubDoc = findHubDoc(params.frame, hub);
  if (!hubDoc) throw new Error('Savings is unavailable right now.');
  const terms = await adapter.resolveTerms(hubDoc);
  const freshFrame = await ensureHubCapacity(params, adapter);
  const freshHub = findHubDoc(freshFrame, hub);
  if (!freshHub) throw new Error('Savings is unavailable right now.');
  const risk = previewSavingsRisk(
    { doc: freshHub, isLeft: isLeftOf(freshHub, self) },
    tokenId,
    params.amountText,
    String(terms.savingsInterestBps),
    asTokenDecimals(params.decimals),
  );
  if (!risk?.ok) throw new Error(risk?.error ?? 'Savings terms are unavailable right now.');
  adapter.onStage?.('Moving to Savings...');
  const txs: EntityTx[] = [];
  if (risk.requiredLimit > risk.currentLimit) {
    txs.push({ type: 'extendCredit', data: { counterpartyEntityId: hub, tokenId, amount: risk.requiredLimit } });
  }
  txs.push(buildLendingOfferTx({ hubEntityId: hub, tokenId, amount, termId: terms.termId, interestBps: terms.savingsInterestBps }));
  await adapter.sendEntityTxs(txs);
}

async function ensureHubCapacity(params: SavingsDepositParams, adapter: SavingsDepositAdapter): Promise<RuntimeAdapterViewFrame> {
  const { entityId: self, hubId: hub, tokenId, amount } = params;
  const plan = planEverydayCapacityFunding({
    frame: params.frame,
    entityId: self,
    counterpartyId: hub,
    tokenId,
    amount,
    externalRows: params.externalRows,
    nativeBalance: params.nativeBalance,
    deriveDeltaFn: adapter.deriveDelta,
  });
  switch (plan.kind) {
    case 'ready':
      if (!params.frame) throw new Error('Savings is unavailable right now.');
      return params.frame;
    case 'disputed':
      throw new Error('Savings is paused while your hub account is in recovery.');
    case 'insufficient':
      throw new Error('Not enough Cash available to add this amount to Savings.');
    case 'needs-gas':
      throw new Error('Add a small amount of network gas before adding to Savings.');
    case 'pending-funding':
      if (plan.reason === 'sent-batch') throw new Error('A deposit is already finishing. Try again in a moment.');
      // A queued batch that already funds this hub is reused: only wait for it.
      break;
    case 'fund':
      if (plan.needsApprovalAmount > 0n) {
        await adapter.approveDepository({ tokenAddress: plan.tokenAddress, amount: plan.needsApprovalAmount });
      }
      adapter.onStage?.('Moving from your Cash...');
      await adapter.sendEntityTxs(plan.fundingTxs);
      break;
  }
  adapter.onStage?.('Confirming deposit...');
  const deadline = Date.now() + CONFIRMATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const nextFrame = await adapter.readViewFrame(self);
    const nextDoc = findHubDoc(nextFrame, hub);
    if (isAccountDisputed(nextDoc)) throw new Error('Savings is paused while your hub account is in recovery.');
    if (nextFrame && nextDoc && adapter.deriveDelta(nextDoc.state.deltas.get(tokenId) ?? createDefaultDelta(tokenId), isLeftOf(nextDoc, self)).outCapacity >= amount) {
      return nextFrame;
    }
    await sleep(CONFIRMATION_POLL_MS);
  }
  throw new Error('Savings funding is still confirming on-chain.');
}
