import { useCallback, useEffect, useMemo, useState } from 'react';
import { EVERYDAY_COPY } from '@xln/frontend/lib/everyday/wallet-posture';
import { executeEverydaySavingsDeposit } from '../../components/everyday/everyday-actions';
import { pickActiveSavingsOffer, type LendingState } from '../../runtime/financial/lending';
import { fetchLendingState } from '../../runtime/financial/lending-http';
import { parseAmount } from '../../runtime/format';
import { useApp } from '../../runtime/store';
import { getTokenMeta } from '../../runtime/token-meta';
import { sendEntityTxs } from '../../runtime/tx';
import { formatEverydayMoney, useEverydayWallet } from '../../runtime/use-everyday-wallet';

export function EverydaySavings() {
  const entityId = useApp(state => state.activeEntityId);
  const selectedTokenId = useApp(state => state.selectedTokenId);
  const externalWallet = useApp(state => state.externalWallet);
  const commandReady = useApp(state => state.commandReady);
  const toast = useApp(state => state.toast);
  const { wallet, projection } = useEverydayWallet(entityId, selectedTokenId);

  const tokenId = projection.primaryTokenId;
  const meta = getTokenMeta(tokenId);
  const hubId = projection.primaryHubId;
  const hub = useMemo(
    () => (hubId ? wallet.accounts.find(account => account.counterpartyId === hubId) : undefined),
    [hubId, wallet.accounts],
  );

  const [lending, setLending] = useState<LendingState | null>(null);
  const [lendingError, setLendingError] = useState('');
  const [amountText, setAmountText] = useState('');
  const [acceptRisk, setAcceptRisk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const loadState = useCallback(async () => {
    if (!hubId || !wallet.entityId) return;
    try {
      const next = await fetchLendingState({ hubEntityId: hubId, userEntityId: wallet.entityId, tokenId });
      setLending(next);
      setLendingError('');
    } catch {
      setLendingError("Savings isn't offered right now. Your Cash is safe.");
    }
  }, [hubId, wallet.entityId, tokenId]);

  useEffect(() => {
    void loadState();
  }, [loadState, wallet.frameHeight]);

  const offer = useMemo(() => {
    if (!lending || !hub) return null;
    return pickActiveSavingsOffer(lending.terms, hub.doc.state.domain, tokenId);
  }, [lending, hub, tokenId]);

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

  const myPools = useMemo(
    () =>
      (lending?.savings ?? []).filter(
        pool =>
          pool.lenderEntityId.toLowerCase() === wallet.entityId &&
          (pool.status === 'open' || pool.status === 'queued'),
      ),
    [lending, wallet.entityId],
  );

  const overBalance = parsedAmount > projection.primary.cash;

  const addToSavings = async (): Promise<void> => {
    if (!hubId || !hub || offer?.kind !== 'active' || parsedAmount <= 0n || overBalance || !acceptRisk || busy) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await executeEverydaySavingsDeposit({
        wallet,
        externalWallet,
        hubId,
        tokenId,
        amount: parsedAmount,
        amountText,
        decimals: meta.decimals,
        terms: offer.terms,
      });
      const doneText = EVERYDAY_COPY.flows.saveIn.done;
      setStatus(doneText);
      setAmountText('');
      setAcceptRisk(false);
      toast(doneText);
      await loadState();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : EVERYDAY_COPY.flows.saveIn.failed);
    } finally {
      setBusy(false);
    }
  };

  const moveToCash = async (positionId: string, positionHubId: string): Promise<void> => {
    if (closingId || !commandReady) return;
    setClosingId(positionId);
    setError('');
    setStatus('');
    try {
      await sendEntityTxs(wallet.entityId, wallet.signerId, [
        { type: 'lendingClosePosition', data: { hubEntityId: positionHubId, positionId } },
      ]);
      const doneText = EVERYDAY_COPY.flows.saveOut.done;
      setStatus(doneText);
      toast(doneText);
      await loadState();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : EVERYDAY_COPY.flows.saveOut.failed);
    } finally {
      setClosingId(null);
    }
  };

  return (
    <div className="everyday-screen fade-in">
      <section className="everyday-hero-card" aria-label="Savings balance">
        <span className="everyday-label">{EVERYDAY_COPY.terms.savings.label}</span>
        <div className="everyday-cash-value" data-testid="everyday-savings-balance">
          {formatEverydayMoney(projection.primary.savings, tokenId)}
        </div>
        <p className="everyday-note">{EVERYDAY_COPY.terms.savings.note}</p>
        <span className="everyday-row-sub">
          Available Cash: {formatEverydayMoney(projection.primary.cash, tokenId)}
        </span>
      </section>

      <section className="everyday-panel" aria-label="Add to Savings">
        <div className="everyday-panel-head">
          <strong>{EVERYDAY_COPY.flows.saveIn.before}</strong>
          {offer?.kind === 'active' ? (
            <span className="everyday-row-sub">{(offer.terms.savingsInterestBps / 100).toFixed(2)}% per year</span>
          ) : null}
        </div>
        {lendingError ? (
          <p className="everyday-note">{lendingError}</p>
        ) : offer?.kind !== 'active' ? (
          <p className="everyday-note">Savings isn&apos;t offered right now. Your Cash is safe.</p>
        ) : (
          <>
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
                  setStatus('');
                }}
                data-testid="everyday-savings-amount"
              />
            </label>
            <label className="everyday-consent-row">
              <input
                type="checkbox"
                checked={acceptRisk}
                onChange={event => setAcceptRisk(event.target.checked)}
                data-testid="everyday-savings-consent"
              />
              <span>I understand Savings is lent out to earn interest and is not protected like Cash.</span>
            </label>
            <button
              type="button"
              className="btn primary"
              disabled={!acceptRisk || parsedAmount <= 0n || overBalance || !commandReady || busy}
              onClick={() => void addToSavings()}
              data-testid="everyday-savings-add"
            >
              {busy ? EVERYDAY_COPY.flows.saveIn.pending : EVERYDAY_COPY.flows.saveIn.before}
            </button>
          </>
        )}
        {error ? <p className="everyday-alert" role="alert">{error}</p> : null}
        {status ? <p className="everyday-note" role="status">{status}</p> : null}
      </section>

      {myPools.length > 0 ? (
        <section className="everyday-list-card" aria-label="Active savings">
          {myPools.map(pool => (
            <div key={pool.positionId} className="everyday-list-row">
              <div className="everyday-row-meta">
                <span className="everyday-row-title">{formatEverydayMoney(pool.closeAmount, pool.tokenId)}</span>
                <span className="everyday-row-sub">
                  {pool.status === 'queued'
                    ? 'Moving back to Cash — finishes automatically shortly.'
                    : `${(pool.interestBps / 100).toFixed(2)}% per year`}
                </span>
              </div>
              {pool.status === 'open' ? (
                <button
                  type="button"
                  className="btn"
                  disabled={!commandReady || closingId === pool.positionId}
                  onClick={() => void moveToCash(pool.positionId, pool.hubEntityId)}
                  data-testid="everyday-savings-move"
                >
                  {closingId === pool.positionId
                    ? EVERYDAY_COPY.flows.saveOut.pending
                    : EVERYDAY_COPY.flows.saveOut.before}
                </button>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
