import { useEffect, useRef, useState } from 'react';
import { VALUELESS_CHAIN_IDS } from '@xln/core/jurisdiction/adapter/chain-ids';
import { formatEverydayArrivingNote } from '@xln/frontend/lib/everyday/everyday-policy';
import { EVERYDAY_COPY, splitMoneyDisplay } from '@xln/frontend/lib/everyday/wallet-posture';
import { EverydayCashOutPanel } from '../../components/everyday/EverydayCashOutPanel';
import { EverydayPayPanel } from '../../components/everyday/EverydayPayPanel';
import { EverydayRequestPanel } from '../../components/everyday/EverydayRequestPanel';
import { Icon } from '../../components/Icons';
import { ScanSheet } from '../../components/ScanSheet';
import { receiveTestMoney } from '../../runtime/financial/test-money';
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
  const [faucetBusy, setFaucetBusy] = useState(false);
  const [faucetError, setFaucetError] = useState('');
  const [showTruth, setShowTruth] = useState(false);
  const [deltaNotice, setDeltaNotice] = useState<BalanceDelta | null>(null);
  const lastCashRef = useRef<{ entityId: string; cash: bigint } | null>(null);
  const faucetPendingRef = useRef(false);

  const tokenId = projection.primaryTokenId;
  const chainId = wallet.frame?.activeEntity?.core?.config.jurisdiction?.chainId;
  const isDemoChain = chainId !== undefined && VALUELESS_CHAIN_IDS.has(Number(chainId));
  const showTestFaucet =
    isDemoChain &&
    projection.primary.cash === 0n &&
    projection.primary.arriving === 0n &&
    Boolean(projection.primaryHubId);

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
    if (diff > 0n && faucetPendingRef.current) {
      faucetPendingRef.current = false;
      const expectedGross = 100_000_000n;
      if (tokenId === 1 && diff < expectedGross && diff > 95_000_000n) {
        const fee = expectedGross - diff;
        setDeltaNotice({
          positive: true,
          text: `+$100.00, −${formatEverydayMoney(fee, tokenId)} settle fee`,
        });
        return;
      }
    }
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

  const requestTestCash = async (): Promise<void> => {
    if (faucetBusy || !commandReady) return;
    setFaucetBusy(true);
    setFaucetError('');
    faucetPendingRef.current = true;
    try {
      await receiveTestMoney(wallet, () => {});
    } catch (failure) {
      faucetPendingRef.current = false;
      setFaucetError(failure instanceof Error ? failure.message : 'Could not add test cash.');
    } finally {
      setFaucetBusy(false);
    }
  };

  return (
    <div className="everyday-screen fade-in">
      <section className="everyday-hero-card" aria-label="Cash balance">
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

        {showTestFaucet ? (
          <div className="stack" style={{ gap: 6 }}>
            <button
              type="button"
              className="btn primary"
              disabled={faucetBusy || !commandReady}
              onClick={() => void requestTestCash()}
              data-testid="home-faucet"
            >
              {faucetBusy ? 'Adding test cash...' : 'Add $100 test cash'}
            </button>
            <span className="everyday-fee-line">
              $100.00 sent · about $99.89 after ~$0.11 settle fee
            </span>
            {faucetError ? <p className="everyday-alert" role="alert">{faucetError}</p> : null}
          </div>
        ) : null}
      </section>

      <div className="everyday-actions">
        <button
          type="button"
          className={`btn ${(!showTestFaucet && action === null) || action === 'pay' ? 'primary' : ''}`}
          onClick={() => setAction(current => (current === 'pay' ? null : 'pay'))}
          data-testid="everyday-pay-btn"
        >
          <Icon name="pay" size={18} />
          {EVERYDAY_COPY.flows.pay.before}
        </button>
        <button
          type="button"
          className={`btn ${action === 'request' ? 'primary' : ''}`}
          onClick={() => setAction(current => (current === 'request' ? null : 'request'))}
          data-testid="everyday-request-btn"
        >
          <Icon name="receive" size={18} />
          {EVERYDAY_COPY.flows.requestLink.before}
        </button>
        <button
          type="button"
          className={`btn ${action === 'cashout' ? 'primary' : ''}`}
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
