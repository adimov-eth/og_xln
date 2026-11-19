import { useMemo, useState } from 'react';
import { planFriendSplitTxs } from '@xln/frontend/lib/everyday/everyday-cashout';
import type { FriendTabRow } from '@xln/frontend/lib/everyday/everyday-projection';
import { SURFACES } from '@xln/surfaces/surfaces.generated';
import {
  quoteEverydaySettleTabRoute,
  resolveCounterpartySummaries,
} from '../../components/everyday/everyday-actions';
import { executeEverydaySend } from '../../components/everyday/send-executor';
import { parseAmount } from '../../runtime/format';
import { useApp } from '../../runtime/store';
import { getTokenMeta } from '../../runtime/token-meta';
import { sendEntityTxs } from '../../runtime/tx';
import { formatEverydayMoney, useEverydayWallet } from '../../runtime/use-everyday-wallet';
import { peekXLN } from '../../runtime/xln-loader';
import { resolvePayRecipient } from '../pay-intent';

export function EverydayFriends() {
  const entityId = useApp(state => state.activeEntityId);
  const selectedTokenId = useApp(state => state.selectedTokenId);
  const externalWallet = useApp(state => state.externalWallet);
  const commandReady = useApp(state => state.commandReady);
  const toast = useApp(state => state.toast);
  const { wallet, projection } = useEverydayWallet(entityId, selectedTokenId);

  const tokenId = projection.primaryTokenId;
  const meta = getTokenMeta(tokenId);
  const [targetText, setTargetText] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [busySplit, setBusySplit] = useState(false);
  const [settlingKey, setSettlingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const knownPeople = useMemo(() => {
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

  const resolvedTarget = useMemo(
    () => resolvePayRecipient(targetText, pickedId, knownPeople),
    [targetText, pickedId, knownPeople],
  );

  const parsedSplitAmount = useMemo(() => {
    const trimmed = amountText.trim();
    if (!trimmed) return 0n;
    try {
      const value = parseAmount(trimmed, meta.decimals);
      return value > 0n ? value : 0n;
    } catch {
      return 0n;
    }
  }, [amountText, meta.decimals]);

  const splitBill = async (): Promise<void> => {
    const xln = peekXLN();
    if (!xln || !resolvedTarget.target || parsedSplitAmount <= 0n || busySplit) return;
    setBusySplit(true);
    setError('');
    setStatus('');
    try {
      const target = resolvedTarget.target.toLowerCase();
      if (wallet.hubs.has(target)) {
        throw new Error('This address targets a hub account and cannot open a friend tab.');
      }
      const existing = wallet.accounts.find(a => a.counterpartyId === target)?.doc.state ?? null;
      const summaries = await resolveCounterpartySummaries(target, wallet.summaries, Boolean(existing));
      if (wallet.hubs.has(target) || Boolean(summaries.find(s => s.entityId.toLowerCase() === target)?.isHub)) {
        throw new Error('This address targets a hub account and cannot open a friend tab.');
      }
      const txs = planFriendSplitTxs({
        entityId: wallet.entityId,
        counterpartyEntityId: target,
        tokenId,
        splitAmount: parsedSplitAmount,
        existingAccount: existing,
        deriveDeltaFn: xln.deriveDelta,
        summaries,
      });
      await sendEntityTxs(wallet.entityId, wallet.signerId, txs);
      const doneText = SURFACES.everyday.flows['split-tab'].done.text;
      setStatus(doneText);
      setAmountText('');
      toast(doneText);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : SURFACES.everyday.flows['split-tab'].failed.text,
      );
    } finally {
      setBusySplit(false);
    }
  };

  const settleTab = async (tab: FriendTabRow): Promise<void> => {
    const key = `${tab.counterpartyId}:${tab.tokenId}`;
    if (settlingKey || tab.signedAmount >= 0n || tab.disputed) return;
    setSettlingKey(key);
    setError('');
    setStatus('');
    try {
      const amount = -tab.signedAmount;
      const { route, deliveryMode, targetEntityId } = await quoteEverydaySettleTabRoute({
        wallet,
        targetEntityId: tab.counterpartyId,
        tokenId: tab.tokenId,
        amount,
        primaryHubId: projection.primaryHubId,
      });
      await executeEverydaySend({
        wallet,
        externalWallet,
        targetEntityId,
        tokenId: tab.tokenId,
        deliveryMode,
        description: 'Settled tab',
        route,
      });
      const doneText = SURFACES.everyday.flows['settle-tab'].done.text;
      setStatus(doneText);
      toast(doneText);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : SURFACES.everyday.flows['settle-tab'].failed.text,
      );
    } finally {
      setSettlingKey(null);
    }
  };

  return (
    <div className="everyday-screen fade-in">
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="page-title">{SURFACES.everyday.terms.people.text}</h1>
        <p className="everyday-note">{SURFACES.everyday.terms.people.note}</p>
        {projection.primary.friendsOweYou > 0n || projection.primary.youOweFriends > 0n ? (
          <div className="actions">
            {projection.primary.friendsOweYou > 0n ? (
              <span className="everyday-note">
                Owed to you: <strong>{formatEverydayMoney(projection.primary.friendsOweYou, tokenId)}</strong>
              </span>
            ) : null}
            {projection.primary.youOweFriends > 0n ? (
              <span className="everyday-note">
                {SURFACES.everyday.terms.owed.text}:{' '}
                <strong>{formatEverydayMoney(projection.primary.youOweFriends, tokenId)}</strong>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <section className="everyday-panel" aria-label="Split a bill">
        <strong>{SURFACES.everyday.flows['split-tab'].before.text}</strong>
        {knownPeople.length > 0 ? (
          <div className="chips">
            {knownPeople.slice(0, 6).map(person => (
              <button
                key={person.entityId}
                type="button"
                className={pickedId === person.entityId ? 'active' : ''}
                onClick={() => {
                  setPickedId(person.entityId);
                  setTargetText(person.label);
                  setError('');
                  setStatus('');
                }}
              >
                {person.label}
              </button>
            ))}
          </div>
        ) : null}
        <label className="field">
          <span className="field-label">Friend</span>
          <input
            className="input boxed"
            placeholder="Name or 0x address"
            value={targetText}
            onChange={event => {
              setTargetText(event.target.value);
              setPickedId(null);
              setError('');
              setStatus('');
            }}
            data-testid="everyday-split-target"
          />
        </label>
        <label className="field">
          <span className="field-label">Their share</span>
          <input
            className="input boxed num"
            inputMode="decimal"
            placeholder="0.00"
            value={amountText}
            onChange={event => {
              setAmountText(event.target.value);
              setError('');
              setStatus('');
            }}
            data-testid="everyday-split-amount"
          />
        </label>
        {resolvedTarget.ambiguous ? (
          <p className="everyday-alert">More than one person shares this name. Pick one above.</p>
        ) : null}
        {error ? <p className="everyday-alert" role="alert">{error}</p> : null}
        {status ? <p className="everyday-note" role="status">{status}</p> : null}
        <button
          type="button"
          className="btn primary"
          disabled={!commandReady || busySplit || !resolvedTarget.target || parsedSplitAmount <= 0n}
          onClick={() => void splitBill()}
          data-testid="everyday-split-btn"
        >
          {busySplit
            ? SURFACES.everyday.flows['split-tab'].pending.text
            : SURFACES.everyday.flows['split-tab'].before.text}
        </button>
      </section>

      <section className="everyday-list-card" aria-label="Friends list" data-testid="everyday-friends-list">
        {projection.friendTabs.length === 0 ? (
          <div className="everyday-list-row">
            <span className="everyday-note">No shared tabs yet. Split a bill above to start one.</span>
          </div>
        ) : (
          projection.friendTabs.map(tab => {
            const key = `${tab.counterpartyId}:${tab.tokenId}`;
            const abs = tab.signedAmount < 0n ? -tab.signedAmount : tab.signedAmount;
            const formatted = formatEverydayMoney(abs, tab.tokenId);
            return (
              <div key={key} className="everyday-list-row">
                <div className="everyday-row-meta">
                  <span className="everyday-row-title">{tab.label}</span>
                  <span className="everyday-row-sub">
                    {tab.disputed
                      ? 'In recovery — tab paused'
                      : tab.signedAmount > 0n
                        ? `${tab.label} owes you ${formatted}`
                        : tab.signedAmount < 0n
                          ? `You owe ${tab.label} ${formatted}`
                          : tab.peerCreditLimit > 0n
                            ? `Tab open · up to ${formatEverydayMoney(tab.peerCreditLimit, tab.tokenId)}`
                            : 'All settled up'}
                  </span>
                </div>
                {tab.signedAmount < 0n ? (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!commandReady || tab.disputed || settlingKey === key}
                    onClick={() => void settleTab(tab)}
                    data-testid="everyday-settle-btn"
                  >
                    {settlingKey === key
                      ? SURFACES.everyday.flows['settle-tab'].pending.text
                      : SURFACES.everyday.flows['settle-tab'].before.text}
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
