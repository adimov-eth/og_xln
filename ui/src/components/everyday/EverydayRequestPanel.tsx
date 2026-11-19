import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { buildWalletPayHref } from '@xln/frontend/lib/utils/xlnInvoice';
import { SURFACES } from '@xln/surfaces/surfaces.generated';
import { useApp } from '../../runtime/store';
import { Icon } from '../Icons';

export function EverydayRequestPanel({
  entityId,
  tokenId,
  onClose,
}: {
  entityId: string;
  tokenId: number;
  onClose: () => void;
}) {
  const toast = useApp(state => state.toast);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const requestHref = useMemo(() => {
    if (!entityId) return '';
    const trimmedAmount = amount.trim();
    const trimmedNote = note.trim();
    return buildWalletPayHref({
      targetEntityId: entityId,
      tokenId,
      ...(trimmedAmount ? { amount: trimmedAmount } : {}),
      ...(trimmedNote ? { description: trimmedNote } : {}),
    });
  }, [entityId, tokenId, amount, note]);

  useEffect(() => {
    let alive = true;
    if (!requestHref) {
      setQrUrl('');
      return;
    }
    void QRCode.toDataURL(requestHref, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 280,
    })
      .then(url => {
        if (alive) setQrUrl(url);
      })
      .catch(() => {
        if (alive) setQrUrl('');
      });
    return () => {
      alive = false;
    };
  }, [requestHref]);

  const copyLink = (): void => {
    if (!requestHref) return;
    void navigator.clipboard.writeText(requestHref).then(
      () => {
        setCopied(true);
        toast(SURFACES.everyday.flows['request-link'].done.text);
      },
      () => {
        toast(SURFACES.everyday.flows['request-link'].failed.text, 'danger');
      },
    );
  };

  return (
    <section className="everyday-panel" aria-label="Request money">
      <div className="everyday-panel-head">
        <strong>{SURFACES.everyday.flows['request-link'].before.text}</strong>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close request panel">
          <Icon name="close" size={18} />
        </button>
      </div>
      <label className="field">
        <span className="field-label">Amount (optional)</span>
        <input
          className="input boxed num"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={event => {
            setAmount(event.target.value);
            setCopied(false);
          }}
          data-testid="everyday-request-amount"
        />
      </label>
      <label className="field">
        <span className="field-label">Note (optional)</span>
        <input
          className="input boxed"
          placeholder="What is it for?"
          value={note}
          onChange={event => {
            setNote(event.target.value);
            setCopied(false);
          }}
          data-testid="everyday-request-note"
        />
      </label>
      {requestHref ? (
        <div className="everyday-qr-wrap">
          {qrUrl ? <img className="everyday-qr-img" src={qrUrl} alt="Payment request QR code" /> : null}
          <code className="mono" style={{ fontSize: 12, overflowWrap: 'anywhere' }} data-testid="everyday-request-link">
            {requestHref}
          </code>
          <button
            type="button"
            className="btn primary"
            onClick={copyLink}
            data-testid="everyday-request-copy"
          >
            <Icon name={copied ? 'check' : 'copy'} size={16} />
            {copied ? SURFACES.everyday.flows['request-link'].done.text : 'Copy request link'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
