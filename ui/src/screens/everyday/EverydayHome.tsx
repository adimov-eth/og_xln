import { useEffect, useRef, useState } from 'react';
import { formatEverydayArrivingNote } from '@xln/frontend/lib/everyday/everyday-policy';
import { EVERYDAY_COPY, splitMoneyDisplay } from '@xln/frontend/lib/everyday/wallet-posture';
import { EverydayCashOutPanel } from '../../components/everyday/EverydayCashOutPanel';
import { EverydayPayPanel } from '../../components/everyday/EverydayPayPanel';
import { EverydayRequestPanel } from '../../components/everyday/EverydayRequestPanel';
import { Icon } from '../../components/Icons';
import { ScanSheet } from '../../components/ScanSheet';
import { useApp } from '../../runtime/store';
import { formatEverydayMoney, useEverydayWallet } from '../../runtime/use-everyday-wallet';

type ActiveAction = 'pay' | 'request' | 'cashout' | null;

type BalanceDelta = {
  readonly positive: boolean;
  readonly text: string;
};

export function EverydayHome({
  onOpenExternalRequest,
}: {
  onOpenExternalRequest: (raw: string) => void;
}) {
  const entityId = useApp(state => state.activeEntityId);
  const selectedTokenId = useApp(state => state.selectedTokenId);
  const commandReady = useApp(state => state.commandReady);
  const { wallet, projection, hubRebalance } = useEverydayWallet(entityId, selectedTokenId);

  const [action, setAction] = useState<ActiveAction>(null);
  const [scanning, setScanning] = useState(false);
  const [showTruth, setShowTruth] = useState(false);
  const [deltaNotice, setDeltaNotice] = useState<BalanceDelta | null>(null);
  const [sheenTick, setSheenTick] = useState(0);
  const lastCashRef = useRef<{ entityId: string; cash: bigint } | null>(null);

  const tokenId = projection.primaryTokenId;
  const cashFormatted = formatEverydayMoney(projection.primary.cash, tokenId);
  const cashParts = splitMoneyDisplay(cashFormatted);
  const activeHub = wallet.accounts.find(account => account.counterpartyId === projection.primaryHubId)
    ?? wallet.accounts.find(account => account.isHub)
    ?? null;

  useEffect(() => {
    const prev = lastCashRef.current;
    if (!prev || prev.entityId !== projection.entityId) {
      lastCashRef.current = { entityId: projection.entityId, cash: projection.primary.cash };
      setDeltaNotice(null);
      return;
    }
    const diff = projection.primary.cash - prev.cash;
    if (diff === 0n) return;
    lastCashRef.current = { entityId: projection.entityId, cash: projection.primary.cash };
    if (diff > 0n) setSheenTick(tick => tick + 1);
    setDeltaNotice({
      positive: diff > 0n,
      text: diff > 0n
        ? `+${formatEverydayMoney(diff, tokenId)} settled`
        : `−${formatEverydayMoney(-diff, tokenId)} sent`,
    });
  }, [projection.entityId, projection.primary.cash, tokenId]);

  const arrivingNote = formatEverydayArrivingNote(
    hubRebalance,
    EVERYDAY_COPY.terms.arriving.note,
    amount => formatEverydayMoney(amount, tokenId),
  );

  const balanceTruthLine = activeHub
    ? activeHub.disputed
      ? `Connected via ${activeHub.label}. Protection is active on this hub.`
      : `Connected via ${activeHub.label}.`
    : 'No hub connected yet.';

  return (
    <div className="everyday-screen fade-in">
      <section
        key={sheenTick}
        className={`everyday-hero-card${sheenTick > 0 ? ' is-sheen' : ''}`}
        aria-label="Cash balance"
      >
        <span className="everyday-label">{EVERYDAY_COPY.terms.cash.label}</span>
        <button
          type="button"
          className="everyday-balance-trigger"
          aria-expanded={showTruth}
          onClick={() => setShowTruth(open => !open)}
        >
          <div
            className={`everyday-cash-value${!commandReady ? ' is-syncing' : ''}`}
            data-testid="everyday-cash"
          >
            <span>{cashParts.major}</span>
            {cashParts.minor ? <span className="everyday-cents">{cashParts.minor}</span> : null}
            {cashParts.suffix ? <span className="everyday-unit-suffix">{cashParts.suffix}</span> : null}
          </div>
        </button>

        {!commandReady ? (
          <p className="everyday-note" role="status">
            Syncing latest balance. Sending resumes in a moment.
          </p>
        ) : deltaNotice ? (
          <p
            className={`everyday-cash-delta${deltaNotice.positive ? '' : ' is-out'}`}
            data-testid="everyday-cash-delta"
            role="status"
          >
            {deltaNotice.text}
          </p>
        ) : (
          <p className="everyday-note">{EVERYDAY_COPY.terms.cash.note}</p>
        )}

        {showTruth ? (
          <p className="everyday-balance-truth" data-testid="everyday-balance-truth">
            {balanceTruthLine}
          </p>
        ) : null}

        {projection.primary.arriving > 0n ? (
          <div className="stack" style={{ gap: 6 }}>
            <span className="everyday-arriving-pill" data-testid="everyday-arriving">
              +{formatEverydayMoney(projection.primary.arriving, tokenId)} arriving
            </span>
            <span className="everyday-note">{arrivingNote}</span>
          </div>
        ) : null}
      </section>

      {/* One primary per view: Pay at rest; once a flow opens its submit is the primary and the tile sinks. */}
      <div className="everyday-actions">
        <button
          type="button"
          className={`btn ${action === null ? 'primary' : ''}`}
          aria-pressed={action === 'pay'}
          onClick={() => setAction(current => (current === 'pay' ? null : 'pay'))}
          data-testid="everyday-pay-btn"
        >
          <Icon name="pay" size={18} />
          {EVERYDAY_COPY.flows.pay.before}
        </button>
        <button
          type="button"
          className="btn"
          aria-pressed={action === 'request'}
          onClick={() => setAction(current => (current === 'request' ? null : 'request'))}
          data-testid="everyday-request-btn"
        >
          <Icon name="receive" size={18} />
          {EVERYDAY_COPY.flows.requestLink.before}
        </button>
        <button
          type="button"
          className="btn"
          aria-pressed={action === 'cashout'}
          onClick={() => setAction(current => (current === 'cashout' ? null : 'cashout'))}
          data-testid="everyday-cashout-btn"
        >
          <Icon name="arrow" size={18} />
          {EVERYDAY_COPY.flows.cashOut.before}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setScanning(true)}
          aria-label="Scan request"
          data-testid="everyday-scan-btn"
        >
          <Icon name="scan" size={18} />
          Scan
        </button>
      </div>

      {action === 'pay' ? (
        <EverydayPayPanel
          wallet={wallet}
          projection={projection}
          tokenId={tokenId}
          onClose={() => setAction(null)}
        />
      ) : null}

      {action === 'request' ? (
        <EverydayRequestPanel
          entityId={wallet.entityId}
          tokenId={tokenId}
          onClose={() => setAction(null)}
        />
      ) : null}

      {action === 'cashout' ? (
        <EverydayCashOutPanel
          wallet={wallet}
          projection={projection}
          tokenId={tokenId}
          onClose={() => setAction(null)}
        />
      ) : null}

      {scanning ? (
        <ScanSheet
          onClose={() => setScanning(false)}
          onDecode={value => {
            setScanning(false);
            onOpenExternalRequest(value);
          }}
        />
      ) : null}
    </div>
  );
}
