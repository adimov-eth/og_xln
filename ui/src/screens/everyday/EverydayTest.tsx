import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VALUELESS_CHAIN_IDS } from '@xln/core/jurisdiction/adapter/chain-ids';
import { armedAttribute } from '@xln/frontend/lib/utils/control/armed-press';
import { EVERYDAY_COPY } from '@xln/frontend/lib/everyday/wallet-posture';
import { requireAdapter } from '../../runtime/adapter';
import { requestExternalWalletRefresh, requestFaucet } from '../../runtime/financial/external';
import { receiveTestMoney } from '../../runtime/financial/test-money';
import { useApp } from '../../runtime/store';
import { getTokenMeta } from '../../runtime/token-meta';
import { useEverydayWallet } from '../../runtime/use-everyday-wallet';
import { useClearTestData } from '../../components/settings/useClearTestData';

type BusyAction = 'cash' | 'gas' | 'erc20' | 'reset' | null;

export function EverydayTest() {
  const navigate = useNavigate();
  const entityId = useApp(state => state.activeEntityId);
  const selectedTokenId = useApp(state => state.selectedTokenId);
  const commandReady = useApp(state => state.commandReady);
  const { wallet, projection } = useEverydayWallet(entityId, selectedTokenId);

  const [busy, setBusy] = useState<BusyAction>(null);
  const reset = useClearTestData();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const tokenId = projection.primaryTokenId;
  const token = getTokenMeta(tokenId);
  const chainId = wallet.frame?.activeEntity?.core?.config.jurisdiction?.chainId;
  const isDemoChain = chainId !== undefined && VALUELESS_CHAIN_IDS.has(Number(chainId));

  const runAction = async (kind: BusyAction, task: () => Promise<string>): Promise<void> => {
    if (busy || !isDemoChain) return;
    setBusy(kind);
    setError('');
    setStatus('');
    try {
      const doneText = await task();
      setStatus(doneText);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Test action failed.');
    } finally {
      setBusy(null);
    }
  };

  const addTestCash = (): Promise<void> =>
    runAction('cash', async () => {
      await receiveTestMoney(wallet, () => {});
      requestExternalWalletRefresh();
      return 'Sent $100.00 test cash. Settling into Cash.';
    });

  const addTestGas = (): Promise<void> =>
    runAction('gas', async () => {
      await requestFaucet('gas', {
        entityId: wallet.entityId,
        signerId: wallet.signerId,
        runtimeId: requireAdapter().runtimeId,
        jurisdiction: wallet.jurisdiction,
        tokenId,
        tokenSymbol: token.symbol,
        amount: '0',
      });
      requestExternalWalletRefresh();
      return 'Added test gas to your address.';
    });

  const addTestTokens = (): Promise<void> =>
    runAction('erc20', async () => {
      await requestFaucet('erc20', {
        entityId: wallet.entityId,
        signerId: wallet.signerId,
        runtimeId: requireAdapter().runtimeId,
        jurisdiction: wallet.jurisdiction,
        tokenId,
        tokenSymbol: token.symbol,
        amount: '100',
      });
      requestExternalWalletRefresh();
      return `Added 100 test ${token.symbol} to your external address.`;
    });

  if (!isDemoChain) {
    return (
      <div className="everyday-screen fade-in">
        <section className="everyday-hero-card" aria-label="Test tools unavailable">
          <span className="everyday-label">Test tools</span>
          <p className="everyday-note">Test actions are only available on test networks.</p>
          <button type="button" className="btn" onClick={() => navigate('/')}>
            Back to Cash
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="everyday-screen fade-in">
      <section className="everyday-hero-card" aria-label="Test tools">
        <span className="everyday-label">Test tools</span>
        <p className="everyday-note">Faucets and reset actions for test networks.</p>
      </section>

      <div className="everyday-list-card">
        <div className="everyday-list-row">
          <div className="everyday-row-meta">
            <span className="everyday-row-title">Add $100 test cash</span>
            <span className="everyday-row-sub">
              $100.00 sent · about $99.89 after ~$0.11 settle fee
            </span>
          </div>
          <button
            type="button"
            className="btn primary"
            disabled={busy !== null || !commandReady || !projection.primaryHubId}
            onClick={() => void addTestCash()}
            data-testid="home-faucet"
          >
            {busy === 'cash' ? 'Adding...' : 'Add $100'}
          </button>
        </div>

        <div className="everyday-list-row">
          <div className="everyday-row-meta">
            <span className="everyday-row-title">Add test gas</span>
            <span className="everyday-row-sub">Funds native gas for on-chain actions.</span>
          </div>
          <button
            type="button"
            className="btn"
            disabled={busy !== null}
            onClick={() => void addTestGas()}
            data-testid="everyday-test-gas"
          >
            {busy === 'gas' ? 'Adding...' : 'Add gas'}
          </button>
        </div>

        <div className="everyday-list-row">
          <div className="everyday-row-meta">
            <span className="everyday-row-title">Add 100 test {token.symbol}</span>
            <span className="everyday-row-sub">Mints test tokens to your external address.</span>
          </div>
          <button
            type="button"
            className="btn"
            disabled={busy !== null}
            onClick={() => void addTestTokens()}
            data-testid="everyday-test-erc20"
          >
            {busy === 'erc20' ? 'Adding...' : `Add ${token.symbol}`}
          </button>
        </div>

        <div className="everyday-list-row">
          <div className="everyday-row-meta">
            <span className="everyday-row-title">{EVERYDAY_COPY.flows.resetDemo.before}</span>
            <span className="everyday-row-sub">Your test balance goes to zero and test accounts and activity leave this device. Your login stays.</span>
          </div>
          <button
            type="button"
            className={reset.armed || reset.resetting ? 'btn danger reset-action' : 'btn reset-action'}
            disabled={busy !== null || reset.resetting}
            onClick={reset.press}
            onBlur={reset.disarm}
            data-armed={armedAttribute(reset.arm)}
            data-testid="everyday-test-reset"
          >
            {reset.resetting || reset.armed ? reset.label : 'Clear'}
          </button>
        </div>
      </div>

      {error ? <p className="everyday-alert" role="alert">{error}</p> : null}
      {status ? <p className="everyday-cash-delta" role="status">{status}</p> : null}

      <div className="everyday-actions">
        <button type="button" className="btn" onClick={() => navigate('/')}>
          Back to Cash
        </button>
      </div>
    </div>
  );
}
