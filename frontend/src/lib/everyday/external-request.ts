import { getJurisdictionStackId, type Delta, type DerivedDelta } from '@xln/core/api/public/runtime-module';
import type { ParsedXlnInvoice } from '../utils/xlnInvoice';

export type ExternalRequestKind = 'cash-spend' | 'open-friend-tab' | 'savings-deposit' | 'escalate-pro';

export type ExternalRequestClassification = {
  kind: ExternalRequestKind;
  title: string;
  summary: string;
  riskNote?: string;
};

export type ClassifyExternalRequestParams = {
  txType?: string | undefined;
  amountLabel?: string | undefined;
  counterpartyLabel?: string | undefined;
  isHubTarget?: boolean | undefined;
  invoice?: Pick<ParsedXlnInvoice, 'targetEntityId' | 'amount' | 'description'> | null | undefined;
  beforeDelta?: Delta | undefined;
  afterDelta?: Delta | undefined;
  isLeft?: boolean | undefined;
  deriveDeltaFn?: ((delta: Delta, isLeft: boolean) => DerivedDelta) | undefined;
};

const PAYMENT_TX_TYPES = new Set(['htlcPayment', 'directPayment', 'direct_payment', 'htlc_lock']);
const CREDIT_TX_TYPES = new Set(['extendCredit', 'openAccount', 'set_credit_limit']);
const SAVINGS_TX_TYPES = new Set(['lendingOffer', 'lending_fund']);

const makeResult = (
  kind: ExternalRequestKind,
  title: string,
  summary: string,
  riskNote?: string,
): ExternalRequestClassification => ({
  kind,
  title,
  summary,
  ...(riskNote ? { riskNote } : {}),
});

/**
 * Jurisdiction ids an invoice may name for this wallet: its own name and stack id,
 * plus every catalog key (`/api/jurisdictions`) whose chain and depository are the same stack.
 * Same rule as the React wallet's resolveAcceptedInvoiceJurisdictions.
 */
export function acceptedInvoiceJurisdictions(
  local: { name?: string | undefined; chainId?: number | undefined; depositoryAddress?: string | undefined } | null | undefined,
  catalogPayload: unknown,
): string[] {
  const stackId = local ? getJurisdictionStackId(local) : '';
  const accepted = new Set([local?.name ?? '', stackId].filter(Boolean));
  const entries = catalogPayload && typeof catalogPayload === 'object'
    ? (catalogPayload as { jurisdictions?: unknown }).jurisdictions
    : undefined;
  if (stackId && entries && typeof entries === 'object') {
    for (const [key, raw] of Object.entries(entries as Record<string, unknown>)) {
      const config = (raw ?? {}) as { chainId?: unknown; contracts?: { depository?: unknown } };
      const entryId = getJurisdictionStackId({
        chainId: typeof config.chainId === 'number' ? config.chainId : undefined,
        depositoryAddress: typeof config.contracts?.depository === 'string' ? config.contracts.depository : undefined,
      });
      if (entryId === stackId) accepted.add(key);
    }
  }
  return [...accepted];
}

/**
 * Whether a request target is a hub, as far as the wallet knows.
 * Returns false only for an entity known not to be a hub; an unknown entity is
 * undefined, which classifyExternalRequest treats as a hub (fail closed).
 */
export function resolveHubTarget(knownHub: boolean, entry: { isHub?: boolean | undefined } | undefined): boolean | undefined {
  return knownHub || entry?.isHub;
}

/** Extracts the raw `txType` query parameter from an invoice URL or `#pay/...` hash safely. */
export function readTxTypeParam(raw: string): string | undefined {
  let target = raw;
  const idx = raw.toLowerCase().indexOf('#pay/');
  if (idx >= 0) {
    try {
      target = decodeURIComponent(raw.slice(idx + 5));
    } catch {
      target = raw.slice(idx + 5);
    }
  }
  const queryIdx = target.indexOf('?');
  if (queryIdx < 0) return undefined;
  const value = new URLSearchParams(target.slice(queryIdx + 1)).get('txType');
  return value === null ? undefined : value;
}

export function classifyExternalRequest(params: ClassifyExternalRequestParams): ExternalRequestClassification {
  const peer = params.counterpartyLabel || params.invoice?.targetEntityId?.slice(0, 10) || 'this contact';
  const amountText = params.amountLabel || (params.invoice?.amount ? `$${params.invoice.amount}` : 'this request');

  const hasTxType = params.txType !== undefined;
  const txType = params.txType?.trim() ?? '';
  if (hasTxType && !txType) {
    return makeResult('escalate-pro', 'Advanced operator action', 'This request is missing a recognized action type.', 'Switch to Pro in Settings if you intended to sign an operator transaction.');
  }
  const isPaymentTx = !hasTxType || PAYMENT_TX_TYPES.has(txType);
  const isCreditTx = hasTxType && CREDIT_TX_TYPES.has(txType);
  const isSavingsTx = hasTxType && SAVINGS_TX_TYPES.has(txType);
  if (!isPaymentTx && !isCreditTx && !isSavingsTx) {
    return makeResult('escalate-pro', 'Advanced operator action', `This action (${txType}) belongs in Pro tools.`, 'Switch to Pro in Settings if you intended to sign an operator transaction.');
  }

  if (params.beforeDelta && params.afterDelta && params.isLeft !== undefined && params.deriveDeltaFn) {
    const before = params.deriveDeltaFn(params.beforeDelta, params.isLeft);
    const after = params.deriveDeltaFn(params.afterDelta, params.isLeft);
    if (after.peerCreditLimit > before.peerCreditLimit) {
      if (params.isHubTarget !== false || isSavingsTx || (hasTxType && isPaymentTx)) {
        return makeResult('escalate-pro', 'Advanced credit change', `This request changes your credit line with ${peer}.`, 'Open Trading & operator tools (Pro) in Settings to inspect credit policy changes.');
      }
      return makeResult('open-friend-tab', `Open tab with ${peer}`, `Allow a shared tab up to ${amountText} with ${peer}.`, 'Only open a tab with someone you actually know and trust.');
    }
    if (after.outPeerCredit > before.outPeerCredit && after.outCollateral <= before.outCollateral) {
      return makeResult('escalate-pro', 'Advanced settlement request', `This change increases unbacked balance from ${peer}.`, 'Open Trading & operator tools (Pro) in Settings to inspect it.');
    }
  }

  if (isCreditTx) {
    if (params.isHubTarget !== false) {
      return makeResult('escalate-pro', 'Advanced credit change', `This request changes your credit limit with ${peer}.`, 'Open Trading & operator tools (Pro) in Settings to inspect credit policy changes.');
    }
    return makeResult('open-friend-tab', `Open tab with ${peer}`, `Let ${peer} share a tab for ${amountText}.`, 'Only open a tab with someone you actually know and trust.');
  }
  if (isSavingsTx) {
    return makeResult('savings-deposit', `Move ${amountText} to Savings`, `Earn interest by lending ${amountText}.`, 'Lent to earn interest — not protected like Cash.');
  }

  const desc = params.invoice?.description?.trim();
  return makeResult('cash-spend', `Pay ${peer}`, desc ? `${amountText} · ${desc}` : `Send ${amountText} from your Cash.`);
}
