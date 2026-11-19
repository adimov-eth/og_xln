import { useState } from 'react';
import { VALUELESS_CHAIN_IDS } from '@xln/core/jurisdiction/adapter/chain-ids';
import { formatEverydayArrivingNote } from '@xln/frontend/lib/everyday/everyday-policy';
import { SURFACES } from '@xln/surfaces/surfaces.generated';
import { EverydayCashOutPanel } from '../../components/everyday/EverydayCashOutPanel';
import { EverydayPayPanel } from '../../components/everyday/EverydayPayPanel';
import { EverydayRequestPanel } from '../../components/everyday/EverydayRequestPanel';
import { Icon } from '../../components/Icons';
import { ScanSheet } from '../../components/ScanSheet';
import { receiveTestMoney } from '../../runtime/financial/test-money';
import { useApp } from '../../runtime/store';
import { formatEverydayMoney, useEverydayWallet } from '../../runtime/use-everyday-wallet';

type ActiveAction = 'pay' | 'request' | 'cashout' | null;

export function EverydayHome({
  onOpenExternalRequest,
}: {
  onOpenExternalRequest: (raw: string) => void;
}) {
  const entityId = useApp(state => state.activeEntityId);
  const selectedTokenId = useApp(state => state.selectedTokenId);
  const commandReady = useApp(state => state.commandReady);
  const toast = useApp(state => state.toast);
  const { wallet, projection, hubRebalance } = useEverydayWallet(entityId, selectedTokenId);

  const [action, setAction] = useState<ActiveAction>(null);
  const [scanning, setScanning] = useState(false);
  const [faucetBusy, setFaucetBusy] = useState(false);
  const [faucetError, setFaucetError] = useState('');

  const tokenId = projection.primaryTokenId;
  const chainId = wallet.frame?.activeEntity?.core?.config.jurisdiction?.chainId;
  const isDemoChain = chainId !== undefined && VALUELESS_CHAIN_IDS.has(Number(chainId));
  const showTestFaucet =
    isDemoChain &&
    projection.primary.cash === 0n &&
    projection.primary.arriving === 0n &&
    Boolean(projection.primaryHubId);

  const arrivingNote = formatEverydayArrivingNote(
    hubRebalance,
    SURFACES.everyday.terms.arriving.note,
  );

  const requestTestCash = async (): Promise<void> => {
    if (faucetBusy || !commandReady) return;
    setFaucetBusy(true);
    setFaucetError('');
    try {
      await receiveTestMoney(wallet, () => {});
      toast('Added $100 test cash');
    } catch (failure) {
      setFaucetError(failure instanceof Error ? failure.message : 'Could not add test cash.');
    } finally {
      setFaucetBusy(false);
    }
  };

  return (
    <div className="everyday-screen fade-in">
      <section className="everyday-hero-card" aria-label="Cash balance">
        <span className="everyday-label">{SURFACES.everyday.terms.cash.text}</span>
        <div className="everyday-cash-value" data-testid="everyday-cash">
          {formatEverydayMoney(projection.primary.cash, tokenId)}
        </div>
        <p className="everyday-note">{SURFACES.everyday.terms.cash.note}</p>

        {projection.primary.arriving > 0n ? (
          <div className="stack" style={{ gap: 6 }}>
            <span className="everyday-arriving-pill" data-testid="everyday-arriving">
              +{formatEverydayMoney(projection.primary.arriving, tokenId)} arriving · finishing...
            </span>
            <span className="everyday-note">{arrivingNote}</span>
          </div>
        ) : null}

        {showTestFaucet ? (
          <div className="stack" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn primary"
              disabled={faucetBusy || !commandReady}
              onClick={() => void requestTestCash()}
              data-testid="home-faucet"
            >
              {faucetBusy ? 'Adding test cash...' : 'Add $100 test cash'}
            </button>
            {faucetError ? <p className="everyday-alert" role="alert">{faucetError}</p> : null}
          </div>
        ) : null}
      </section>

      <div className="everyday-actions">
        <button
          type="button"
          className={`btn ${action === 'pay' ? 'primary' : ''}`}
          onClick={() => setAction(current => (current === 'pay' ? null : 'pay'))}
          data-testid="everyday-pay-btn"
        >
          <Icon name="pay" size={18} />
          {SURFACES.everyday.flows.pay.before.text}
        </button>
        <button
          type="button"
          className={`btn ${action === 'request' ? 'primary' : ''}`}
          onClick={() => setAction(current => (current === 'request' ? null : 'request'))}
          data-testid="everyday-request-btn"
        >
          <Icon name="receive" size={18} />
          {SURFACES.everyday.flows['request-link'].before.text}
        </button>
        <button
          type="button"
          className={`btn ${action === 'cashout' ? 'primary' : ''}`}
          onClick={() => setAction(current => (current === 'cashout' ? null : 'cashout'))}
          data-testid="everyday-cashout-btn"
        >
          <Icon name="arrow" size={18} />
          {SURFACES.everyday.flows['cash-out'].before.text}
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
