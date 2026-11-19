import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EverydaySendRoute } from '@xln/frontend/lib/everyday/everyday-autopilot';
import { planFriendSplitTxs } from '@xln/frontend/lib/everyday/everyday-cashout';
import {
  findDirectBilateralRoute,
  resolveEverydayDeliveryMode,
} from '@xln/frontend/lib/everyday/everyday-routes';
import {
  classifyExternalRequest,
  readTxTypeParam,
  resolveHubTarget,
} from '@xln/frontend/lib/everyday/external-request';
import { parseXlnInvoice } from '@xln/frontend/lib/utils/xlnInvoice';
import { SIGNING_SHEETS, SURFACES } from '@xln/surfaces/surfaces.generated';
import { pickActiveSavingsOffer } from '../../runtime/financial/lending';
import { fetchLendingState } from '../../runtime/financial/lending-http';
import { jurisdictionRef } from '../../runtime/financial/swap';
import { parseAmount } from '../../runtime/format';
import { useApp } from '../../runtime/store';
import { getTokenMeta } from '../../runtime/token-meta';
import { sendEntityTxs } from '../../runtime/tx';
import { formatEverydayMoney, useEverydayWallet, useWalletPosture } from '../../runtime/use-everyday-wallet';
import { displayEntityName } from '../../runtime/views';
import { peekXLN } from '../../runtime/xln-loader';
import { assertInvoiceJurisdiction, invoiceNote } from '../../screens/pay-intent';
import { Sheet } from '../Sheet';
import {
  executeEverydaySavingsDeposit,
  quoteEverydayPaymentRoutes,
  resolveAcceptedInvoiceJurisdictions,
  resolveCounterpartySummaries,
} from './everyday-actions';
import { executeEverydaySend } from './send-executor';

export function ExternalRequestSheet({ rawInvoice, onClose }: { rawInvoice: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { setPosture } = useWalletPosture();
  const entityId = useApp(state => state.activeEntityId);
  const externalWallet = useApp(state => state.externalWallet);
  const commandReady = useApp(state => state.commandReady);
  const toast = useApp(state => state.toast);
  const { wallet, projection } = useEverydayWallet(entityId);

  const [amountText, setAmountText] = useState('');
  const [acceptSavingsRisk, setAcceptSavingsRisk] = useState(false);
  const [route, setRoute] = useState<EverydaySendRoute | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [jurisdictionChecking, setJurisdictionChecking] = useState(false);
  const [jurisdictionError, setJurisdictionError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setAmountText(''); setAcceptSavingsRisk(false); setError(''); setRouteError('');
  }, [rawInvoice]);

  const parsed = useMemo(() => {
    try { return { ok: true as const, invoice: parseXlnInvoice(rawInvoice) }; }
    catch (failure) { return { ok: false as const, error: failure instanceof Error ? failure.message : 'Invalid request' }; }
  }, [rawInvoice]);

  const txType = useMemo(() => readTxTypeParam(rawInvoice), [rawInvoice]);
  const tokenId = parsed.ok ? (parsed.invoice.tokenId ?? 1) : 1;
  const meta = getTokenMeta(tokenId);
  const hasFixedAmount = parsed.ok && Boolean(parsed.invoice.amount.trim());
  const effectiveAmountText = parsed.ok ? (hasFixedAmount ? parsed.invoice.amount.trim() : amountText.trim()) : '';

  const parsedAmount = useMemo(() => {
    if (!effectiveAmountText) return 0n;
    try { const v = parseAmount(effectiveAmountText, meta.decimals); return v > 0n ? v : 0n; }
    catch { return 0n; }
  }, [effectiveAmountText, meta.decimals]);

  const invalidAmount = parsed.ok && Boolean(effectiveAmountText) && parsedAmount <= 0n;
  const invoiceJurisdictionId = parsed.ok ? parsed.invoice.jurisdictionId : '';
  const invoiceIdentity = jurisdictionRef(wallet.frame);
  const hasTokenCash = (projection.byToken.get(tokenId)?.cash ?? 0n) > 0n;

  const classification = useMemo(() => {
    if (!parsed.ok) return null;
    const target = parsed.invoice.targetEntityId.toLowerCase();
    const isHubTarget = resolveHubTarget(
      wallet.hubs.has(target),
      wallet.summaries.find(summary => summary.entityId.toLowerCase() === target),
    );
    return classifyExternalRequest({
      invoice: parsed.invoice,
      txType,
      amountLabel: parsedAmount > 0n ? formatEverydayMoney(parsedAmount, tokenId) : undefined,
      counterpartyLabel: displayEntityName(wallet.names, target),
      isHubTarget,
    });
  }, [parsed, txType, parsedAmount, tokenId, wallet.hubs, wallet.summaries, wallet.names]);

  const hasFrame = Boolean(wallet.frame);

  useEffect(() => {
    if (!invoiceJurisdictionId) { setJurisdictionChecking(false); setJurisdictionError(''); return; }
    if (!hasFrame) { setJurisdictionChecking(true); setJurisdictionError(''); return; }
    let alive = true;
    setJurisdictionChecking(true);
    setJurisdictionError('');
    void resolveAcceptedInvoiceJurisdictions(wallet.jurisdiction, invoiceIdentity)
      .then(accepted => { if (alive && parsed.ok) { assertInvoiceJurisdiction(parsed.invoice, accepted); setJurisdictionError(''); } })
      .catch(f => { if (alive) setJurisdictionError(f instanceof Error ? f.message : 'Invoice jurisdiction does not match the active jurisdiction'); })
      .finally(() => { if (alive) setJurisdictionChecking(false); });
    return () => { alive = false; };
  }, [parsed, invoiceJurisdictionId, hasFrame, wallet.jurisdiction, invoiceIdentity]);

  const directRoute = useMemo(() => {
    const xln = peekXLN();
    if (!xln || !parsed.ok || classification?.kind !== 'cash-spend' || parsedAmount <= 0n || !wallet.entityId) return null;
    return findDirectBilateralRoute({
      frame: wallet.frame,
      entityId: wallet.entityId,
      targetEntityId: parsed.invoice.targetEntityId,
      tokenId,
      amount: parsedAmount,
      deriveDeltaFn: xln.deriveDelta,
    });
  }, [parsed, classification?.kind, parsedAmount, wallet.frame, wallet.entityId, tokenId]);

  useEffect(() => {
    if (!parsed.ok || classification?.kind !== 'cash-spend' || parsedAmount <= 0n || !wallet.entityId || jurisdictionError) {
      setRoute(null); setRouteError(''); setQuoting(false); return;
    }
    if (directRoute) {
      setRoute(directRoute); setRouteError(''); setQuoting(false); return;
    }
    let alive = true;
    setQuoting(true); setRoute(null); setRouteError('');
    const timer = setTimeout(() => {
      void quoteEverydayPaymentRoutes({
        sourceEntityId: wallet.entityId, targetEntityId: parsed.invoice.targetEntityId,
        tokenId, amount: parsedAmount, primaryHubId: projection.primaryHubId, cash: hasTokenCash ? 1n : 0n,
      })
        .then(({ routes: list }) => {
          if (!alive) return;
          const picked = list.find(candidate => candidate.path.length === 2) ?? list[0] ?? null;
          setRoute(picked);
          setRouteError(picked ? '' : 'No payment route available right now.');
        })
        .catch(f => { if (alive) setRouteError(f instanceof Error ? f.message : 'Could not quote payment.'); })
        .finally(() => { if (alive) setQuoting(false); });
    }, hasFixedAmount ? 0 : 150);
    return () => { alive = false; clearTimeout(timer); };
  }, [parsed, classification?.kind, parsedAmount, wallet.entityId, tokenId, projection.primaryHubId, hasTokenCash, jurisdictionError, hasFixedAmount, directRoute]);

  const confirm = async (): Promise<void> => {
    if (!parsed.ok || !classification || busy || parsedAmount <= 0n) return;
    setError('');
    try {
      if (parsed.invoice.jurisdictionId) {
        assertInvoiceJurisdiction(parsed.invoice, await resolveAcceptedInvoiceJurisdictions(wallet.jurisdiction, invoiceIdentity));
      }
      if (classification.kind === 'cash-spend') {
        if (!route) throw new Error(routeError || 'Waiting for payment route.');
        await executeEverydaySend({
          wallet, externalWallet, targetEntityId: parsed.invoice.targetEntityId, tokenId,
          deliveryMode: resolveEverydayDeliveryMode(route),
          description: invoiceNote(parsed.invoice).description, route, onStage: setBusy,
        });
        toast(SURFACES.everyday.flows.pay.done.text); onClose(); return;
      }
      if (classification.kind === 'open-friend-tab') {
        const xln = peekXLN();
        if (!xln) throw new Error('Wallet runtime is still starting.');
        setBusy('Opening tab...');
        const target = parsed.invoice.targetEntityId.toLowerCase();
        const existing = wallet.accounts.find(a => a.counterpartyId === target)?.doc.state ?? null;
        const summaries = await resolveCounterpartySummaries(target, wallet.summaries, Boolean(existing));
        if (summaries.find(summary => summary.entityId.toLowerCase() === target)?.isHub) {
          throw new Error('This request targets a hub account and cannot open a friend tab.');
        }
        const txs = planFriendSplitTxs({
          entityId: wallet.entityId, counterpartyEntityId: target, tokenId,
          splitAmount: parsedAmount, existingAccount: existing, deriveDeltaFn: xln.deriveDelta, summaries,
        });
        await sendEntityTxs(wallet.entityId, wallet.signerId, txs);
        toast(SURFACES.everyday.flows['split-tab'].done.text); onClose(); return;
      }
      if (classification.kind === 'savings-deposit') {
        // Deposit only with the hub that sent the request, never a different one.
        const hubId = parsed.invoice.targetEntityId.toLowerCase();
        const hub = wallet.hubs.has(hubId) ? wallet.accounts.find(a => a.counterpartyId === hubId) : undefined;
        if (!hub) throw new Error('This request is from a hub you have no account with.');
        setBusy('Checking Savings...');
        const state = await fetchLendingState({ hubEntityId: hubId, userEntityId: wallet.entityId, tokenId });
        const activeTerm = pickActiveSavingsOffer(state.terms, hub.doc.state.domain, tokenId);
        if (activeTerm.kind !== 'active') throw new Error('Savings is not offered right now.');
        await executeEverydaySavingsDeposit({
          wallet, externalWallet, hubId, tokenId, amount: parsedAmount,
          amountText: effectiveAmountText, decimals: meta.decimals, terms: activeTerm.terms, onStage: setBusy,
        });
        toast(SURFACES.everyday.flows['save-in'].done.text); onClose();
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not complete request.');
    } finally {
      setBusy(null);
    }
  };

  if (!parsed.ok || !classification) {
    return (
      <Sheet title="External request" onClose={onClose} testId="external-request-sheet">
        <p className="everyday-alert" role="alert">{parsed.ok ? 'Unsupported request' : parsed.error}</p>
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </Sheet>
    );
  }

  return (
    <Sheet title={classification.title} onClose={onClose} testId="external-request-sheet">
      <div className="stack" style={{ gap: 12 }}>
        <span className="everyday-label">External request</span>
        {classification.kind === 'escalate-pro' ? (
          <div className="stack" style={{ gap: 10 }} data-testid="external-request-escalate">
            <strong>This looks like an advanced contract setup</strong>
            <p className="everyday-note">{classification.summary}</p>
            {classification.riskNote ? <p className="everyday-alert">{classification.riskNote}</p> : null}
            <div className="actions">
              <button
                type="button" className="btn primary" data-testid="external-request-open-pro"
                onClick={() => { setPosture('pro'); onClose(); void navigate('/pay', { state: { invoice: rawInvoice } }); }}
              >
                Open Pro tools
              </button>
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <p className="everyday-note">{classification.summary}</p>
            {!hasFixedAmount ? (
              <label className="field">
                <span className="field-label">Amount ({meta.symbol})</span>
                <input
                  className="input boxed num" inputMode="decimal" placeholder="0.00" value={amountText}
                  onChange={event => { setAmountText(event.target.value); setError(''); }}
                  data-testid="external-request-amount"
                />
              </label>
            ) : null}
            {classification.kind === 'cash-spend' && !routeError ? (
              <div className="everyday-fee-line">
                {parsedAmount <= 0n ? 'Enter an amount to check fee' : quoting ? 'Checking fee...'
                  : route ? (route.totalFee === 0n ? 'Fee: Free' : `Fee: ${formatEverydayMoney(route.totalFee, tokenId)}`) : ''}
              </div>
            ) : null}
            {classification.riskNote ? <p className="everyday-note">{classification.riskNote}</p> : null}
            {SIGNING_SHEETS['external-request-sheet'].survival ? (
              <p className="everyday-note">{SIGNING_SHEETS['external-request-sheet'].survival}</p>
            ) : null}
            {classification.kind === 'savings-deposit' ? (
              <label className="everyday-consent-row">
                <input
                  type="checkbox" checked={acceptSavingsRisk}
                  onChange={event => setAcceptSavingsRisk(event.target.checked)} data-testid="external-savings-consent"
                />
                <span>I understand Savings is lent out to earn interest and is not protected like Cash.</span>
              </label>
            ) : null}
            {invalidAmount ? <p className="everyday-alert" role="alert">Request amount must be greater than zero.</p> : null}
            {jurisdictionError ? <p className="everyday-alert" role="alert">{jurisdictionError}</p> : null}
            {routeError ? <p className="everyday-alert" role="status">{routeError}</p> : null}
            {error ? <p className="everyday-alert" role="alert">{error}</p> : null}
            <div className="actions">
              <button
                type="button" className="btn primary" data-testid="external-request-confirm"
                disabled={
                  !commandReady || Boolean(busy) || jurisdictionChecking || Boolean(jurisdictionError) ||
                  parsedAmount <= 0n || (classification.kind === 'cash-spend' && (!route || quoting)) ||
                  (classification.kind === 'savings-deposit' && !acceptSavingsRisk)
                }
                onClick={() => void confirm()}
              >
                {busy ?? (classification.kind === 'cash-spend' ? 'Pay' : classification.kind === 'open-friend-tab' ? 'Open tab' : 'Add to Savings')}
              </button>
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
