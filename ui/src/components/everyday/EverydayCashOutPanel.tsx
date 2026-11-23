import { useMemo, useState } from 'react';
import {
  explainEverydayCashOutBlock,
  planEverydayCashOut,
} from '@xln/frontend/lib/everyday/everyday-cashout';
import type { EverydayWalletProjection } from '@xln/frontend/lib/everyday/everyday-projection';
import { EVERYDAY_COPY } from '@xln/frontend/lib/everyday/wallet-posture';
import { formatEverydayMoney } from '../../runtime/use-everyday-wallet';
import { parseAmount } from '../../runtime/format';
import { useApp } from '../../runtime/store';
import { getTokenMeta } from '../../runtime/token-meta';
import { sendEntityTxs } from '../../runtime/tx';
import type { WalletView } from '../../runtime/views';
import { peekXLN } from '../../runtime/xln-loader';
import { Icon } from '../Icons';

export function EverydayCashOutPanel({
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
  const meta = getTokenMeta(tokenId);
  const [address, setAddress] = useState(wallet.signerId || '');
  const [amountText, setAmountText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

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

  const plan = useMemo(() => {
    const xln = peekXLN();
    if (!xln || !wallet.frame || parsedAmount <= 0n || !address.trim()) return null;
    return planEverydayCashOut({
      frame: wallet.frame,
      entityId: wallet.entityId,
      recipientEoa: address,
      tokenId,
      amount: parsedAmount,
      hubAccountId: projection.primaryHubId,
      nativeBalance: externalWallet?.native ?? null,
      deriveDeltaFn: xln.deriveDelta,
    });
  }, [
    wallet.frame,
    wallet.entityId,
    address,
    tokenId,
    parsedAmount,
    projection.primaryHubId,
    externalWallet?.native,
  ]);

  const planError = useMemo(() => {
    if (!plan || plan.kind === 'from-reserve' || plan.kind === 'from-hub-collateral') return '';
    return explainEverydayCashOutBlock(plan, amount => formatEverydayMoney(amount, tokenId));
  }, [plan, tokenId]);

  const canSubmit = Boolean(
    commandReady &&
      !busy &&
      plan &&
      (plan.kind === 'from-reserve' || plan.kind === 'from-hub-collateral'),
  );

  const submit = async (): Promise<void> => {
    if (!plan || (plan.kind !== 'from-reserve' && plan.kind !== 'from-hub-collateral') || busy) return;
    setBusy(true);
    setError('');
    setDone('');
    try {
      await sendEntityTxs(wallet.entityId, wallet.signerId, plan.entityTxs);
      const message = EVERYDAY_COPY.flows.cashOut.done;
      setDone(message);
      setAmountText('');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : EVERYDAY_COPY.flows.cashOut.failed,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="everyday-panel" aria-label="Cash out">
      <div className="everyday-panel-head">
        <strong>{EVERYDAY_COPY.flows.cashOut.before}</strong>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close cash out panel">
          <Icon name="close" size={18} />
        </button>
      </div>
      <label className="field">
        <span className="field-label">Destination address</span>
        <input
          className="input boxed mono"
          placeholder="0x..."
          value={address}
          onChange={event => {
            setAddress(event.target.value);
            setError('');
            setDone('');
          }}
          data-testid="everyday-cashout-address"
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
          data-testid="everyday-cashout-amount"
        />
      </label>
      {planError ? <p className="everyday-alert" role="status">{planError}</p> : null}
      {error ? <p className="everyday-alert" role="alert">{error}</p> : null}
      {done ? <p className="everyday-note" role="status">{done}</p> : null}
      <button
        type="button"
        className="btn primary"
        disabled={!canSubmit}
        onClick={() => void submit()}
        data-testid="everyday-cashout-submit"
      >
        {busy
          ? EVERYDAY_COPY.flows.cashOut.pending
          : parsedAmount > 0n
            ? `${EVERYDAY_COPY.flows.cashOut.before} ${formatEverydayMoney(parsedAmount, tokenId)}`
            : EVERYDAY_COPY.flows.cashOut.before}
      </button>
    </section>
  );
}
