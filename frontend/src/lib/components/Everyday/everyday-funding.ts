import type { RuntimeAdapterViewFrame, RuntimeInput, RuntimeReplica, XLNModule } from '@xln/core/api/public/runtime-module';
import { runtimeQueryClient } from '#lib/stores/runtimeQueryClient.ts';
import { submitEntityInputs, submitRuntimeInput } from '#lib/stores/xlnStore.ts';
import { resolveEverydayApiBase } from '#lib/stores/everyday/everydayApiBase.ts';
import { requireUnknownRecord } from '#lib/utils/boundary/index.ts';
import {
  explainEverydaySendBlock,
  type EverydayExternalRow,
  type EverydaySendPlan,
} from '#lib/everyday/everyday-autopilot.ts';
import { submitSavingsDeposit } from '#lib/everyday/everyday-savings.ts';
import { decodeLendingState, pickActiveSavingsOffer, type LendingState } from '../../../../../ui/src/runtime/financial/lending';
import { sleep } from '#lib/utils/primitives.ts';

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

type SavingsDepositParams = {
  frame: RuntimeAdapterViewFrame | null; entityId: string; signerId: string; hubId: string; tokenId: number;
  amountText: string; principal: bigint; decimals: number; lendingState?: LendingState | null;
  externalRows: readonly EverydayExternalRow[]; nativeBalance: bigint | null; liveEnv: RuntimeReplica | null;
  xln: XLNModule; onStage?: (text: string) => void;
};

export async function submitEverydaySavingsDeposit(params: SavingsDepositParams): Promise<void> {
  const { signerId, onStage } = params;
  await submitSavingsDeposit(
    {
      frame: params.frame, entityId: params.entityId, hubId: params.hubId, tokenId: params.tokenId,
      amount: params.principal, amountText: params.amountText, decimals: params.decimals,
      externalRows: params.externalRows, nativeBalance: params.nativeBalance,
    },
    {
      deriveDelta: params.xln.deriveDelta,
      readViewFrame: entityId => runtimeQueryClient.readViewFrame({ entityId }),
      sendEntityTxs: entityTxs => submitEntityInputs([{ entityId: params.entityId, signerId, entityTxs }]),
      approveDepository: ({ tokenAddress, amount }) => approveEverydayDepository({
        entityId: params.entityId.toLowerCase(), signerId, tokenAddress, amount, tokenId: params.tokenId,
        liveEnv: params.liveEnv, xln: params.xln, ...(onStage ? { onStage } : {}),
      }),
      resolveTerms: async hubDoc => {
        const lending = params.lendingState ?? await readEverydayLendingSnapshot(params.hubId, params.entityId, params.tokenId);
        const offer = pickActiveSavingsOffer(lending.terms, hubDoc.state.domain, params.tokenId);
        if (offer.kind !== 'active') throw new Error('Savings is not offered right now.');
        return offer.terms;
      },
      ...(onStage ? { onStage } : {}),
    },
  );
}
