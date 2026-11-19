import { deriveDelta } from '@xln/core/account/utils';
import type { TokenDecimals } from '@xln/core/account/tx/units';
import type {
  PaymentDeliveryMode,
  RuntimeAdapterEntitySummary,
  RuntimeAdapterViewFrame,
} from '@xln/core/api/public/runtime-module';
import type { LendingBankTerms } from '@xln/core/types/finance/lending';
import type { EverydaySendRoute } from '@xln/frontend/lib/everyday/everyday-autopilot';
import {
  quoteEverydayRoutes,
  quoteSettleTabRoute,
  type EverydayRouteQuery,
} from '@xln/frontend/lib/everyday/everyday-routes';
import { submitSavingsDeposit } from '@xln/frontend/lib/everyday/everyday-savings';
import { EVERYDAY_COPY } from '@xln/frontend/lib/everyday/wallet-posture';
import { nativeInvoiceJurisdictionKeys } from '../../native/payment-request';
import { getEmbeddedEnv, requireAdapter } from '../../runtime/adapter';
import { toEverydayExternalRows } from '../../runtime/everyday';
import type { ExternalWallet } from '../../runtime/financial/external';
import { approveDepository } from '../../runtime/financial/move';
import { quotePaymentRoutes } from '../../runtime/financial/payments';
import { loadStackJurisdictions, type StackJurisdiction } from '../../runtime/hosted';
import { sendEntityTxs } from '../../runtime/tx';
import { VIEW_FRAME_QUERY, type WalletView } from '../../runtime/views';
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
    noPathMessage: EVERYDAY_COPY.flows.settleTab.failed,
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
  const selfId = input.wallet.entityId.toLowerCase();
  const signerId = input.wallet.signerId;
  if (!input.wallet.accounts.some(account => account.counterpartyId.toLowerCase() === input.hubId.toLowerCase())) {
    throw new Error('Savings is unavailable right now.');
  }
  await submitSavingsDeposit(
    {
      frame: input.wallet.frame,
      entityId: selfId,
      hubId: input.hubId,
      tokenId: input.tokenId,
      amount: input.amount,
      amountText: input.amountText,
      decimals: input.decimals,
      externalRows: toEverydayExternalRows(input.externalWallet?.rows),
      nativeBalance: input.externalWallet?.native ?? null,
    },
    {
      deriveDelta: xln.deriveDelta,
      readViewFrame: entityId => requireAdapter().read<RuntimeAdapterViewFrame>('view-frame', { entityId, ...VIEW_FRAME_QUERY }),
      sendEntityTxs: txs => sendEntityTxs(selfId, signerId, txs),
      approveDepository: async ({ tokenAddress, amount }) => {
        input.onStage?.('Approving token...');
        await approveDepository(selfId, signerId, tokenAddress, amount, input.tokenId);
      },
      resolveTerms: async () => input.terms,
      ...(input.onStage ? { onStage: input.onStage } : {}),
    },
  );
}
