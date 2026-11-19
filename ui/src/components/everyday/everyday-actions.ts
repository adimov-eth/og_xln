import { createDefaultDelta } from '@xln/core/account/state/delta';
import { deriveDelta } from '@xln/core/account/utils';
import type { TokenDecimals } from '@xln/core/account/tx/units';
import type {
  EntityTx,
  PaymentDeliveryMode,
  RuntimeAdapterEntitySummary,
  RuntimeAdapterViewFrame,
} from '@xln/core/api/public/runtime-module';
import type { LendingBankTerms } from '@xln/core/types/finance/lending';
import {
  isAccountDisputed,
  planEverydayCapacityFunding,
  type EverydaySendRoute,
} from '@xln/frontend/lib/everyday/everyday-autopilot';
import {
  quoteEverydayRoutes,
  quoteSettleTabRoute,
  type EverydayRouteQuery,
} from '@xln/frontend/lib/everyday/everyday-routes';
import { SURFACES } from '@xln/surfaces/surfaces.generated';
import { nativeInvoiceJurisdictionKeys } from '../../native/payment-request';
import { getEmbeddedEnv, requireAdapter } from '../../runtime/adapter';
import { toEverydayExternalRows } from '../../runtime/everyday';
import type { ExternalWallet } from '../../runtime/financial/external';
import {
  claimFundingSubmission,
  fundingSubmissionKey,
  releaseFundingSubmission,
} from '../../runtime/financial/funding-submission';
import { buildLendingOfferTx, previewSavingsRisk } from '../../runtime/financial/lending';
import { approveDepository } from '../../runtime/financial/move';
import { quotePaymentRoutes } from '../../runtime/financial/payments';
import { loadStackJurisdictions, type StackJurisdiction } from '../../runtime/hosted';
import { sendEntityTxs, waitFor } from '../../runtime/tx';
import { VIEW_FRAME_QUERY, type AccountView, type WalletView } from '../../runtime/views';
import { peekXLN } from '../../runtime/xln-loader';

declare const __XLN_STACK_ORIGIN__: string;

type QuoteRoutesFn = (query: EverydayRouteQuery) => Promise<readonly EverydaySendRoute[]>;

/** Quotes direct/existing routes first; if none exist and Cash > 0, retries funded via the primary hub. */
export async function quoteEverydayPaymentRoutes(
  input: {
    sourceEntityId: string;
    targetEntityId: string;
    tokenId: number;
    amount: bigint;
    primaryHubId: string | null;
    cash: bigint;
  },
  quoteFn: QuoteRoutesFn = quotePaymentRoutes,
): Promise<{ routes: EverydaySendRoute[]; fundedByHub: boolean }> {
  return quoteEverydayRoutes({
    sourceEntityId: input.sourceEntityId,
    targetEntityId: input.targetEntityId,
    tokenId: input.tokenId,
    amount: input.amount,
    primaryHubId: input.primaryHubId,
    canFundFromHub: input.cash > 0n,
    fetchRoutes: quoteFn,
  });
}

/** Resolves the route for Settle up: direct bilateral -> hub self-cycle [self, hub, friend, self]; nothing else clears the tab. */
export async function quoteEverydaySettleTabRoute(
  input: {
    wallet: Pick<WalletView, 'entityId' | 'frame'>;
    targetEntityId: string;
    tokenId: number;
    amount: bigint;
    primaryHubId: string | null;
  },
  quoteFn: QuoteRoutesFn = quotePaymentRoutes,
): Promise<{ route: EverydaySendRoute; deliveryMode: PaymentDeliveryMode; targetEntityId: string }> {
  return quoteSettleTabRoute({
    frame: input.wallet.frame,
    entityId: input.wallet.entityId,
    targetEntityId: input.targetEntityId,
    tokenId: input.tokenId,
    amount: input.amount,
    primaryHubId: input.primaryHubId,
    deriveDeltaFn: peekXLN()?.deriveDelta ?? deriveDelta,
    fetchRoutes: quoteFn,
    noPathMessage: SURFACES.everyday.flows['settle-tab'].failed.text,
  });
}

export async function resolveAcceptedInvoiceJurisdictions(
  jurisdiction: string,
  identity: string,
  loadCatalog: (origin: string) => Promise<StackJurisdiction[]> = loadStackJurisdictions,
): Promise<string[]> {
  const local = [jurisdiction, identity].filter(Boolean);
  try {
    const origin =
      typeof __XLN_STACK_ORIGIN__ === 'string' && __XLN_STACK_ORIGIN__
        ? __XLN_STACK_ORIGIN__
        : typeof window !== 'undefined'
          ? window.location.origin
          : '';
    if (!origin && loadCatalog === loadStackJurisdictions) return local;
    const catalog = await loadCatalog(origin);
    return [...new Set([...local, ...nativeInvoiceJurisdictionKeys(identity, catalog)])];
  } catch {
    return local;
  }
}

export async function resolveCounterpartySummaries(
  targetEntityId: string,
  currentSummaries: readonly RuntimeAdapterEntitySummary[],
  hasExistingAccount: boolean,
  deps?: {
    ensureGossip?: (target: string) => Promise<void>;
    readEntities?: (target: string) => Promise<RuntimeAdapterEntitySummary[]>;
  },
): Promise<readonly RuntimeAdapterEntitySummary[]> {
  const target = targetEntityId.toLowerCase();
  if (hasExistingAccount) return currentSummaries;
  const existing = currentSummaries.find(entry => entry.entityId.toLowerCase() === target);
  if (existing && typeof existing.isHub === 'boolean') return currentSummaries;
  if (deps?.ensureGossip) {
    await deps.ensureGossip(target);
  } else {
    const env = getEmbeddedEnv();
    const xln = peekXLN();
    if (env && xln) await xln.ensureGossipProfiles(env, [target]);
  }
  if (deps?.readEntities) return deps.readEntities(target);
  return requireAdapter().read<RuntimeAdapterEntitySummary[]>('entities', { entityId: target });
}

type SavingsDepositInput = {
  wallet: WalletView;
  externalWallet: ExternalWallet | null;
  hubId: string;
  tokenId: number;
  amount: bigint;
  amountText: string;
  decimals: TokenDecimals;
  terms: Pick<LendingBankTerms, 'termId' | 'savingsInterestBps'>;
  onStage?: (stage: string) => void;
};

export async function executeEverydaySavingsDeposit(input: SavingsDepositInput): Promise<void> {
  const xln = peekXLN();
  if (!xln) throw new Error('Wallet runtime is still starting.');
  if (input.amount <= 0n) throw new Error('Enter an amount greater than zero.');
  const selfId = input.wallet.entityId.toLowerCase();
  const hubId = input.hubId.toLowerCase();
  const hub = input.wallet.accounts.find(account => account.counterpartyId.toLowerCase() === hubId);
  if (!hubId || !hub) throw new Error('Savings is unavailable right now.');

  const key = fundingSubmissionKey(selfId, hubId, input.tokenId);
  claimFundingSubmission(key);
  try {
    await depositToSavings(xln, hub, selfId, hubId, input);
  } finally {
    releaseFundingSubmission(key);
  }
}

async function depositToSavings(
  xln: NonNullable<ReturnType<typeof peekXLN>>,
  hub: AccountView,
  selfId: string,
  hubId: string,
  input: SavingsDepositInput,
): Promise<void> {
  const plan = planEverydayCapacityFunding({
    frame: input.wallet.frame,
    entityId: selfId,
    counterpartyId: hubId,
    tokenId: input.tokenId,
    amount: input.amount,
    externalRows: toEverydayExternalRows(input.externalWallet?.rows),
    nativeBalance: input.externalWallet?.native ?? null,
    deriveDeltaFn: xln.deriveDelta,
  });

  let activeHub: Pick<AccountView, 'doc' | 'isLeft'> = hub;
  switch (plan.kind) {
    case 'ready':
      break;
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
      // A queued batch that already funds this hub is reused: only wait for it.
      break;
    case 'fund':
      if (plan.needsApprovalAmount > 0n) {
        input.onStage?.('Approving token...');
        await approveDepository(
          selfId,
          input.wallet.signerId,
          plan.tokenAddress,
          plan.needsApprovalAmount,
          input.tokenId,
        );
      }
      input.onStage?.('Moving from your Cash...');
      await sendEntityTxs(selfId, input.wallet.signerId, plan.fundingTxs);
      break;
  }

  if (plan.kind === 'fund' || plan.kind === 'pending-funding') {
    input.onStage?.('Confirming deposit...');
    await waitFor(
      async () => {
        const frame = await requireAdapter().read<RuntimeAdapterViewFrame>('view-frame', {
          entityId: selfId,
          ...VIEW_FRAME_QUERY,
        });
        const nextHub = frame.activeEntity?.accounts.items.find(
          item => item.state.leftEntity.toLowerCase() === hubId || item.state.rightEntity.toLowerCase() === hubId,
        );
        if (!nextHub) return false;
        if (isAccountDisputed(nextHub)) {
          throw new Error('Savings is paused while your hub account is in recovery.');
        }
        const nextIsLeft = nextHub.state.leftEntity.toLowerCase() === selfId;
        const nextDerived = xln.deriveDelta(
          nextHub.state.deltas.get(input.tokenId) ?? createDefaultDelta(input.tokenId),
          nextIsLeft,
        );
        if (nextDerived.outCapacity < input.amount) return false;
        activeHub = { doc: nextHub, isLeft: nextIsLeft };
        return true;
      },
      'savings funding confirmation',
      60_000,
      250,
    );
  }

  input.onStage?.('Moving to Savings...');
  const risk = previewSavingsRisk(activeHub, input.tokenId, input.amountText, String(input.terms.savingsInterestBps), input.decimals);
  if (!risk?.ok) throw new Error(risk?.error ?? 'Savings terms are unavailable right now.');
  const txs: EntityTx[] = [];
  if (risk.requiredLimit > risk.currentLimit) {
    txs.push({ type: 'extendCredit', data: { counterpartyEntityId: hubId, tokenId: input.tokenId, amount: risk.requiredLimit } });
  }
  txs.push(buildLendingOfferTx({ hubEntityId: hubId, tokenId: input.tokenId, amount: input.amount, termId: input.terms.termId, interestBps: input.terms.savingsInterestBps }));
  await sendEntityTxs(selfId, input.wallet.signerId, txs);
}
