import { createDefaultDelta } from '@xln/core/account/state/delta';
import { asTokenDecimals } from '@xln/core/account/tx/units';
import type { EntityTx, RuntimeAdapterViewFrame, RuntimeInput, RuntimeReplica, XLNModule } from '@xln/core/api/public/runtime-module';
import { runtimeQueryClient } from '#lib/stores/runtimeQueryClient.ts';
import { submitEntityInputs, submitRuntimeInput } from '#lib/stores/xlnStore.ts';
import { resolveEverydayApiBase } from '#lib/stores/everyday/everydayApiBase.ts';
import { requireUnknownRecord } from '#lib/utils/boundary/index.ts';
import {
  explainEverydaySendBlock,
  isAccountDisputed,
  planEverydayCapacityFunding,
  type EverydayExternalRow,
  type EverydaySendPlan,
} from '#lib/everyday/everyday-autopilot.ts';
import { buildLendingOfferTx, decodeLendingState, pickActiveSavingsOffer, previewSavingsRisk, type LendingState } from '../../../../../ui/src/runtime/financial/lending';

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export type EverydaySendExecutionDeps = {
  approvalTimeoutMs?: number;
  pollIntervalMs?: number;
  submitEntityInputsFn?: typeof submitEntityInputs;
  submitRuntimeInputFn?: (input: RuntimeInput) => Promise<unknown>;
};

async function approveEverydayDepository(params: {
  entityId: string; signerId: string; tokenAddress: string; amount: bigint; tokenId: number;
  liveEnv: RuntimeReplica | null; xln: XLNModule | null; onStage?: (text: string) => void;
  timeoutMs?: number; pollIntervalMs?: number;
}): Promise<void> {
  if (!params.liveEnv || !params.xln?.getEntityJAdapter || !params.xln?.getCachedSignerPrivateKey) {
    throw new Error('Unlock your in-browser wallet to authorize this transfer.');
  }
  const jadapter = params.xln.getEntityJAdapter(params.liveEnv, params.entityId, params.signerId);
  const privKey = params.xln.getCachedSignerPrivateKey(params.liveEnv, params.signerId);
  const spender = String(jadapter?.addresses?.depository || '').trim();
  if (!jadapter || !privKey || !spender) throw new Error('Wallet signing adapter is unavailable.');
  params.onStage?.('Approving token transfer...');
  await jadapter.approveErc20(privKey, params.tokenAddress, spender, params.amount, { entityId: params.entityId, tokenId: params.tokenId });
  const deadline = Date.now() + (params.timeoutMs ?? 5_000);
  const intervalMs = params.pollIntervalMs ?? 200;
  for (;;) {
    const allowance = await jadapter.getErc20Allowance(params.tokenAddress, params.signerId, spender);
    if (allowance >= params.amount) return;
    if (Date.now() > deadline) throw new Error('APPROVAL_NOT_CONFIRMED');
    await sleep(intervalMs);
  }
}

export async function executeEverydaySendPlan(params: {
  plan: EverydaySendPlan; entityId: string; signerId: string; tokenId: number;
  liveEnv: RuntimeReplica | null; xln: XLNModule | null; refreshPlan: () => Promise<EverydaySendPlan>;
  onStage?: (text: string) => void; deps?: EverydaySendExecutionDeps;
}): Promise<void> {
  const submitEntity = params.deps?.submitEntityInputsFn ?? submitEntityInputs;
  const submitRuntime = params.deps?.submitRuntimeInputFn ?? submitRuntimeInput;
  let current = params.plan;
  if (current.kind === 'ready') { await submitRuntime(current.paymentInput); return; }
  if (current.kind === 'fund-and-pay') {
    if (current.needsApprovalAmount > 0n) {
      await approveEverydayDepository({
        entityId: params.entityId, signerId: params.signerId, tokenAddress: current.tokenAddress,
        amount: current.needsApprovalAmount, tokenId: params.tokenId, liveEnv: params.liveEnv, xln: params.xln,
        ...(params.onStage ? { onStage: params.onStage } : {}),
        ...(params.deps?.approvalTimeoutMs !== undefined ? { timeoutMs: params.deps.approvalTimeoutMs } : {}),
        ...(params.deps?.pollIntervalMs !== undefined ? { pollIntervalMs: params.deps.pollIntervalMs } : {}),
      });
    }
    params.onStage?.('Preparing payment route...');
    await submitEntity([{ entityId: params.entityId, signerId: params.signerId, entityTxs: current.fundingTxs }]);
    current = { kind: 'pending-funding', reason: 'queued-deposit', paymentInput: current.paymentInput };
  }
  if (current.kind === 'pending-funding') {
    params.onStage?.('Finishing funding before sending...');
    const deadline = Date.now() + 45_000;
    const pollMs = params.deps?.pollIntervalMs ?? 250;
    while (Date.now() < deadline) {
      const next = await params.refreshPlan();
      if (next.kind === 'ready') { params.onStage?.('Sending...'); await submitRuntime(next.paymentInput); return; }
      if (next.kind === 'disputed') throw new Error(explainEverydaySendBlock(next));
      await sleep(pollMs);
    }
    throw new Error('Payment is still waiting for on-chain funding to confirm.');
  }
  throw new Error(explainEverydaySendBlock(current));
}

export async function readEverydayLendingSnapshot(hubEntityId: string, userEntityId: string, tokenId: number): Promise<LendingState> {
  const url = new URL('/api/lending/state', resolveEverydayApiBase());
  url.searchParams.set('hubEntityId', hubEntityId);
  url.searchParams.set('userEntityId', userEntityId);
  url.searchParams.set('tokenId', String(tokenId));
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  const result = requireUnknownRecord(await res.json(), 'LENDING_RESPONSE_INVALID');
  if (!res.ok || result['success'] !== true) throw new Error(String(result['error'] ?? `Savings unavailable (${res.status})`));
  return decodeLendingState(result, { hubEntityId });
}

const findHubDoc = (frame: RuntimeAdapterViewFrame | null, hubId: string) => {
  const hub = hubId.toLowerCase();
  return frame?.activeEntity?.accounts.items.find(a => a.state.leftEntity.toLowerCase() === hub || a.state.rightEntity.toLowerCase() === hub);
};

async function ensureEverydayHubCapacity(params: {
  frame: RuntimeAdapterViewFrame | null; entityId: string; signerId: string; hubId: string;
  tokenId: number; amount: bigint; externalRows: readonly EverydayExternalRow[];
  nativeBalance: bigint | null; liveEnv: RuntimeReplica | null; xln: XLNModule; onStage?: (text: string) => void;
}): Promise<RuntimeAdapterViewFrame> {
  const self = params.entityId.toLowerCase();
  const hub = params.hubId.toLowerCase();
  if (!findHubDoc(params.frame, hub) || !params.frame?.activeEntity) throw new Error('Savings is unavailable right now.');
  const plan = planEverydayCapacityFunding({
    frame: params.frame,
    entityId: self,
    counterpartyId: hub,
    tokenId: params.tokenId,
    amount: params.amount,
    externalRows: params.externalRows,
    nativeBalance: params.nativeBalance,
    deriveDeltaFn: params.xln.deriveDelta,
  });
  switch (plan.kind) {
    case 'ready':
      return params.frame;
    case 'disputed':
      throw new Error('Savings is paused while your hub account is in recovery.');
    case 'insufficient':
      throw new Error('Not enough Cash available to add this amount to Savings.');
    case 'needs-gas':
      throw new Error('Add a small amount of network gas before adding to Savings.');
    case 'pending-funding':
      if (plan.reason === 'sent-batch') {
        throw new Error('A deposit is already finishing. Try again in a moment.');
      }
      break;
    case 'fund':
      if (plan.needsApprovalAmount > 0n) {
        await approveEverydayDepository({
          entityId: self,
          signerId: params.signerId,
          tokenAddress: plan.tokenAddress,
          amount: plan.needsApprovalAmount,
          tokenId: params.tokenId,
          liveEnv: params.liveEnv,
          xln: params.xln,
          ...(params.onStage ? { onStage: params.onStage } : {}),
        });
      }
      params.onStage?.('Moving from your Cash...');
      await submitEntityInputs([{ entityId: self, signerId: params.signerId, entityTxs: plan.fundingTxs }]);
      break;
  }
  params.onStage?.('Confirming deposit...');
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const nextFrame = await runtimeQueryClient.readViewFrame({ entityId: self });
    const nextDoc = findHubDoc(nextFrame, hub);
    if (isAccountDisputed(nextDoc)) {
      throw new Error('Savings is paused while your hub account is in recovery.');
    }
    if (nextDoc && params.xln.deriveDelta(nextDoc.state.deltas.get(params.tokenId) ?? createDefaultDelta(params.tokenId), nextDoc.state.leftEntity.toLowerCase() === self).outCapacity >= params.amount) {
      return nextFrame;
    }
    await sleep(250);
  }
  throw new Error('Savings funding is still confirming on-chain.');
}

type SavingsDepositParams = {
  frame: RuntimeAdapterViewFrame | null; entityId: string; signerId: string; hubId: string; tokenId: number;
  amountText: string; principal: bigint; decimals: number; lendingState?: LendingState | null;
  externalRows: readonly EverydayExternalRow[]; nativeBalance: bigint | null; liveEnv: RuntimeReplica | null;
  xln: XLNModule; onStage?: (text: string) => void;
};

// One Savings deposit at a time per entity, hub and token. Without it a second
// submit made before the first batch shows in the frame funds the hub twice.
const savingsDepositsInFlight = new Set<string>();

export async function submitEverydaySavingsDeposit(params: SavingsDepositParams): Promise<void> {
  if (params.principal <= 0n) throw new Error('Enter an amount greater than zero.');
  const key = `${params.entityId}:${params.hubId}:${params.tokenId}`.toLowerCase();
  if (savingsDepositsInFlight.has(key)) throw new Error('A deposit to Savings is already in progress.');
  savingsDepositsInFlight.add(key);
  try {
    await depositToSavings(params);
  } finally {
    savingsDepositsInFlight.delete(key);
  }
}

async function depositToSavings(params: SavingsDepositParams): Promise<void> {
  const hubDoc = findHubDoc(params.frame, params.hubId);
  if (!hubDoc) throw new Error('Savings is unavailable right now.');
  const lending = params.lendingState ?? await readEverydayLendingSnapshot(params.hubId, params.entityId, params.tokenId);
  const activeOffer = pickActiveSavingsOffer(lending.terms, hubDoc.state.domain, params.tokenId);
  if (activeOffer.kind !== 'active') throw new Error('Savings is not offered right now.');
  const freshFrame = await ensureEverydayHubCapacity({ ...params, amount: params.principal });
  const freshHub = findHubDoc(freshFrame, params.hubId);
  if (!freshHub) throw new Error('Savings is unavailable right now.');
  const risk = previewSavingsRisk({ doc: freshHub, isLeft: freshHub.state.leftEntity.toLowerCase() === params.entityId.toLowerCase() }, params.tokenId, params.amountText, String(activeOffer.terms.savingsInterestBps), asTokenDecimals(params.decimals));
  if (!risk || !risk.ok) throw new Error(risk?.error ?? 'Savings terms are unavailable right now.');
  params.onStage?.('Moving to Savings...');
  const txs: EntityTx[] = [
    ...(risk.requiredLimit > risk.currentLimit ? [{ type: 'extendCredit' as const, data: { counterpartyEntityId: params.hubId, tokenId: params.tokenId, amount: risk.requiredLimit } }] : []),
    buildLendingOfferTx({ hubEntityId: params.hubId, tokenId: params.tokenId, amount: params.principal, termId: activeOffer.terms.termId, interestBps: activeOffer.terms.savingsInterestBps }),
  ];
  await submitEntityInputs([{ entityId: params.entityId, signerId: params.signerId, entityTxs: txs }]);
}
