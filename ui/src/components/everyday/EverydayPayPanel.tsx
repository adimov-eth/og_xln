import { useEffect, useMemo, useRef, useState } from 'react';
import {
  planEverydaySend,
  type EverydaySendRoute,
} from '@xln/frontend/lib/everyday/everyday-autopilot';
import type { EverydayWalletProjection } from '@xln/frontend/lib/everyday/everyday-projection';
import {
  findDirectBilateralRoute,
  resolveEverydayDeliveryMode,
} from '@xln/frontend/lib/everyday/everyday-routes';
import { SURFACES } from '@xln/surfaces/surfaces.generated';
import { toEverydayExternalRows } from '../../runtime/everyday';
import { formatEverydayMoney } from '../../runtime/use-everyday-wallet';
import { parseAmount } from '../../runtime/format';
import { useApp } from '../../runtime/store';
import { getTokenMeta } from '../../runtime/token-meta';
import type { WalletView } from '../../runtime/views';
import { peekXLN } from '../../runtime/xln-loader';
import { resolvePayRecipient } from '../../screens/pay-intent';
import { Icon } from '../Icons';
import { quoteEverydayPaymentRoutes } from './everyday-actions';
import { executeEverydaySend, explainEverydaySendBlock } from './send-executor';

export function EverydayPayPanel({
  wallet,
  projection,
  tokenId,
  onClose,
}: {
  wallet: WalletView;
  projection: EverydayWalletProjection;
  tokenId: number;
  onClose: () => void;
}) {
  const commandReady = useApp(state => state.commandReady);
  const externalWallet = useApp(state => state.externalWallet);
  const toast = useApp(state => state.toast);
  const meta = getTokenMeta(tokenId);

  const [toText, setToText] = useState('');
  const [pickedEntityId, setPickedEntityId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [routes, setRoutes] = useState<EverydaySendRoute[] | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [busyStage, setBusyStage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const quoteSeq = useRef(0);

  const contacts = useMemo(() => {
    const map = new Map<string, { entityId: string; label: string }>();
    for (const tab of projection.friendTabs) {
      map.set(tab.counterpartyId, { entityId: tab.counterpartyId, label: tab.label });
    }
    for (const summary of wallet.summaries) {
      const id = summary.entityId.toLowerCase();
      if (summary.isHub || id === wallet.entityId || map.has(id)) continue;
      map.set(id, { entityId: id, label: summary.label?.trim() || id.slice(0, 10) });
    }
    return [...map.values()];
  }, [projection.friendTabs, wallet.summaries, wallet.entityId]);

  const recipient = useMemo(
    () => resolvePayRecipient(toText, pickedEntityId, contacts),
    [toText, pickedEntityId, contacts],
  );

  const parsedAmount = useMemo(() => {
    const trimmed = amountText.trim();
    if (!trimmed) return 0n;
    try {
      const value = parseAmount(trimmed, meta.decimals);
      return value > 0n ? value : 0n;
    } catch {
      return 0n;
    }
  }, [amountText, meta.decimals]);

  const tokenCash = projection.byToken.get(tokenId)?.cash ?? 0n;
  const hasCash = tokenCash > 0n;
  const directRoute = useMemo(() => {
    const xln = peekXLN();
    if (!xln || !recipient.target || parsedAmount <= 0n || recipient.target === wallet.entityId) return null;
    return findDirectBilateralRoute({
      frame: wallet.frame,
      entityId: wallet.entityId,
      targetEntityId: recipient.target,
      tokenId,
      amount: parsedAmount,
      deriveDeltaFn: xln.deriveDelta,
    });
  }, [wallet.frame, wallet.entityId, recipient.target, tokenId, parsedAmount]);

  useEffect(() => {
    const seq = ++quoteSeq.current;
    setRoutes(null);
    setQuoteError('');
    if (!recipient.target || parsedAmount <= 0n || recipient.target === wallet.entityId) {
      setQuoting(false);
      return;
    }
    if (directRoute) {
      setRoutes([directRoute]);
      setQuoting(false);
      return;
    }
    setQuoting(true);
    const timer = setTimeout(() => {
      void quoteEverydayPaymentRoutes({
        sourceEntityId: wallet.entityId,
        targetEntityId: recipient.target,
        tokenId,
        amount: parsedAmount,
        primaryHubId: projection.primaryHubId,
        cash: tokenCash,
      })
        .then(({ routes: next }) => {
          if (seq !== quoteSeq.current) return;
          setRoutes(next);
          if (next.length === 0) setQuoteError('No route found to this recipient yet.');
        })
        .catch(failure => {
          if (seq !== quoteSeq.current) return;
          setQuoteError(failure instanceof Error ? failure.message : 'Could not quote fee.');
        })
        .finally(() => {
          if (seq === quoteSeq.current) setQuoting(false);
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [recipient.target, parsedAmount, wallet.entityId, tokenId, projection.primaryHubId, hasCash, directRoute]);

  const route = useMemo(() => {
    if (!routes?.length) return null;
    return routes.find(candidate => candidate.path.length === 2) ?? routes[0] ?? null;
  }, [routes]);
  const deliveryMode = route ? resolveEverydayDeliveryMode(route) : 'instant';

  const plan = useMemo(() => {
    const xln = peekXLN();
    if (!xln || !wallet.frame || !route || !recipient.target) return null;
    return planEverydaySend({
      frame: wallet.frame,
      entityId: wallet.entityId,
      signerId: wallet.signerId,
      targetEntityId: recipient.target,
      tokenId,
      deliveryMode,
      description: note.trim(),
      route,
      externalRows: toEverydayExternalRows(externalWallet?.rows),
      nativeBalance: externalWallet?.native ?? null,
      deriveDeltaFn: xln.deriveDelta,
    });
  }, [wallet.frame, wallet.entityId, wallet.signerId, route, recipient.target, tokenId, deliveryMode, note, externalWallet]);

  const feeLabel = useMemo(() => {
    if (quoting) return 'Checking fee...';
    if (!route) return 'Fee shown before sending';
    return route.totalFee === 0n ? 'Fee: Free' : `Fee: ${formatEverydayMoney(route.totalFee, tokenId)}`;
  }, [quoting, route, tokenId]);

  const planWarning = useMemo(() => {
    if (recipient.ambiguous) return 'More than one contact has this name. Pick one above.';
    if (quoteError) return quoteError;
    if (!plan) return '';
    if (plan.kind === 'ready' || plan.kind === 'fund-and-pay') return '';
    return explainEverydaySendBlock(plan);
  }, [recipient.ambiguous, quoteError, plan]);

  const canPay = Boolean(
    commandReady &&
      !busyStage &&
      route &&
      plan &&
      (plan.kind === 'ready' || plan.kind === 'fund-and-pay'),
  );

  const submit = async (): Promise<void> => {
    if (!route || !recipient.target || busyStage) return;
    setError('');
    setDone('');
    try {
      await executeEverydaySend({
        wallet,
        externalWallet,
        targetEntityId: recipient.target,
        tokenId,
        deliveryMode,
        description: note.trim(),
        route,
        onStage: setBusyStage,
      });
      const label = SURFACES.everyday.flows.pay.done.text;
      setDone(`${label} ${formatEverydayMoney(parsedAmount, tokenId)}`);
      setAmountText('');
      setNote('');
      toast(`${label} ${formatEverydayMoney(parsedAmount, tokenId)}`);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : SURFACES.everyday.flows.pay.failed.text,
      );
    } finally {
      setBusyStage(null);
    }
  };

  return (
    <section className="everyday-panel" aria-label="Pay someone">
      <div className="everyday-panel-head">
        <strong>{SURFACES.everyday.flows.pay.before.text}</strong>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close pay panel">
          <Icon name="close" size={18} />
        </button>
      </div>
      {contacts.length > 0 ? (
        <div className="chips">
          {contacts.slice(0, 6).map(contact => (
            <button
              key={contact.entityId}
              type="button"
              className={pickedEntityId === contact.entityId ? 'active' : ''}
              onClick={() => {
                setPickedEntityId(contact.entityId);
                setToText(contact.label);
                setError('');
                setDone('');
              }}
            >
              {contact.label}
            </button>
          ))}
        </div>
      ) : null}
      <label className="field">
        <span className="field-label">To</span>
        <input
          className="input boxed"
          placeholder="Name or 0x address"
          value={toText}
          onChange={event => {
            setToText(event.target.value);
            setPickedEntityId(null);
            setError('');
            setDone('');
          }}
          data-testid="everyday-pay-to"
        />
      </label>
      <label className="field">
        <span className="field-label">Amount</span>
        <input
          className="input boxed num"
          inputMode="decimal"
          placeholder="0.00"
          value={amountText}
          onChange={event => {
            setAmountText(event.target.value);
            setError('');
            setDone('');
          }}
          data-testid="everyday-pay-amount"
        />
      </label>
      <label className="field">
        <span className="field-label">Note (optional)</span>
        <input
          className="input boxed"
          placeholder="Dinner, rent, coffee..."
          value={note}
          onChange={event => setNote(event.target.value)}
          data-testid="everyday-pay-note"
        />
      </label>
      <div className="everyday-fee-line" data-testid="everyday-pay-fee">
        {feeLabel}
      </div>
      {planWarning ? <p className="everyday-alert" role="status">{planWarning}</p> : null}
      {error ? <p className="everyday-alert" role="alert">{error}</p> : null}
      {done ? <p className="everyday-note" role="status">{done}</p> : null}
      <button
        type="button"
        className="btn primary"
        disabled={!canPay}
        onClick={() => void submit()}
        data-testid="everyday-pay-submit"
      >
        {busyStage
          ? busyStage
          : parsedAmount > 0n
            ? `${SURFACES.everyday.flows.pay.before.text} ${formatEverydayMoney(parsedAmount, tokenId)}`
            : SURFACES.everyday.flows.pay.before.text}
      </button>
    </section>
  );
}
