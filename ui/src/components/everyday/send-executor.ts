import type {
  PaymentDeliveryMode,
  RuntimeAdapterViewFrame,
} from '@xln/core/api/public/runtime-module';
import {
  explainEverydaySendBlock,
  planEverydaySend,
  type EverydaySendPlan,
  type EverydaySendRoute,
} from '@xln/frontend/lib/everyday/everyday-autopilot';
import { SURFACES } from '@xln/surfaces/surfaces.generated';
import { requireAdapter } from '../../runtime/adapter';
import { toEverydayExternalRows } from '../../runtime/everyday';
import { sendRuntimeInput } from '../../runtime/commands';
import type { ExternalWallet } from '../../runtime/financial/external';
import {
  claimFundingSubmission,
  fundingSubmissionKey,
  releaseFundingSubmission,
} from '../../runtime/financial/funding-submission';
import { approveDepository } from '../../runtime/financial/move';
import { useApp } from '../../runtime/store';
import { sendEntityTxs, waitFor } from '../../runtime/tx';
import { VIEW_FRAME_QUERY, type WalletView } from '../../runtime/views';
import { peekXLN } from '../../runtime/xln-loader';

export { explainEverydaySendBlock };

export async function executeEverydaySend(input: {
  wallet: WalletView;
  externalWallet: ExternalWallet | null;
  targetEntityId: string;
  tokenId: number;
  deliveryMode: PaymentDeliveryMode;
  description: string;
  route: EverydaySendRoute;
  onStage?: (stage: string) => void;
}): Promise<void> {
  const xln = peekXLN();
  if (!xln) throw new Error('Wallet runtime is still starting.');
  const externalRows = toEverydayExternalRows(input.externalWallet?.rows);
  const initialPlan = planEverydaySend({
    frame: input.wallet.frame,
    entityId: input.wallet.entityId,
    signerId: input.wallet.signerId,
    targetEntityId: input.targetEntityId,
    tokenId: input.tokenId,
    deliveryMode: input.deliveryMode,
    description: input.description,
    route: input.route,
    externalRows,
    nativeBalance: input.externalWallet?.native ?? null,
    deriveDeltaFn: xln.deriveDelta,
  });

  if (initialPlan.kind === 'ready') {
    input.onStage?.(SURFACES.everyday.flows.pay.pending.text);
    await sendRuntimeInput(initialPlan.paymentInput);
    return;
  }

  if (initialPlan.kind !== 'fund-and-pay') {
    throw new Error(explainEverydaySendBlock(initialPlan));
  }

  const firstHop = (input.route.path[1] ?? input.targetEntityId).toLowerCase();
  const key = fundingSubmissionKey(input.wallet.entityId, firstHop, input.tokenId);
  claimFundingSubmission(key);
  try {
    if (initialPlan.needsApprovalAmount > 0n) {
      input.onStage?.('Approving token...');
      await approveDepository(
        input.wallet.entityId,
        input.wallet.signerId,
        initialPlan.tokenAddress,
        initialPlan.needsApprovalAmount,
        input.tokenId,
      );
    }
    input.onStage?.('Moving from your Cash...');
    await sendEntityTxs(input.wallet.entityId, input.wallet.signerId, initialPlan.fundingTxs);

    let readyPlan: Extract<EverydaySendPlan, { kind: 'ready' }> | null = null;
    await waitFor(
      async () => {
        const frame = await requireAdapter().read<RuntimeAdapterViewFrame>('view-frame', {
          entityId: input.wallet.entityId,
          ...VIEW_FRAME_QUERY,
        });
        const liveExternal = useApp.getState().externalWallet;
        const nextPlan = planEverydaySend({
          frame,
          entityId: input.wallet.entityId,
          signerId: input.wallet.signerId,
          targetEntityId: input.targetEntityId,
          tokenId: input.tokenId,
          deliveryMode: input.deliveryMode,
          description: input.description,
          route: input.route,
          externalRows: toEverydayExternalRows(liveExternal?.rows),
          nativeBalance: liveExternal?.native ?? null,
          deriveDeltaFn: xln.deriveDelta,
        });
        if (nextPlan.kind === 'ready') {
          readyPlan = nextPlan;
          return true;
        }
        if (nextPlan.kind === 'disputed') {
          throw new Error(explainEverydaySendBlock(nextPlan));
        }
        return false;
      },
      'payment funding confirmation',
      60_000,
      250,
    );
    if (!readyPlan) throw new Error('Payment could not finish right now.');
    const confirmed: Extract<EverydaySendPlan, { kind: 'ready' }> = readyPlan;
    input.onStage?.(SURFACES.everyday.flows.pay.pending.text);
    await sendRuntimeInput(confirmed.paymentInput);
  } finally {
    releaseFundingSubmission(key);
  }
}
