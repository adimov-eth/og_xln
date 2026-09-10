import { useState } from 'react';
import { useApp } from '../../runtime/store';
import type { WalletView } from '../../runtime/views';
import { requireAdapter } from '../../runtime/adapter';
import { peekXLN } from '../../runtime/xln-loader';
import { requestFaucet } from '../../runtime/financial/external';
import { readAccountState } from '../../runtime/financial/swap';
import { accountNetBalance } from '../../runtime/financial/balance';
import { sendEntityTxs, waitFor } from '../../runtime/tx';

/** Test-credit consent stays beside the action; success requires committed funds. */
export function TestMoney({ wallet }: { wallet: WalletView }) {
  const commandReady = useApp(state => state.commandReady);
  const setTour = useApp(state => state.setTour);
  const hub = wallet.accounts.find(account => account.isHub && !account.disputed);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const receive = async () => {
    if (busy || !hub || !requireAdapter().commandReady) return;
    setBusy(true);
    setError('');
    setDone(false);
    try {
      const xln = peekXLN();
      if (!xln) throw new Error('Wallet runtime is not ready');
      const entityId = wallet.entityId;
      const input = {
        ownerEntityId: entityId,
        counterpartyEntityId: hub.counterpartyId,
        tokenId: 1,
        requiredInboundAmount: 100_000_000n,
        collateralPercent: 0,
        creditBufferBps: 0 as const,
        allowOpenAccount: false,
      };
      const read = async () => {
        if (!requireAdapter().commandReady)
          throw new Error('Wallet connection stopped. Reopen the wallet before continuing.');
        const account = await readAccountState(entityId, hub.counterpartyId);
        if (!account) throw new Error('Hub account is not ready');
        return account;
      };
      const balance = (account: Awaited<ReturnType<typeof read>>) => {
        const delta = account.deltas.get(1);
        return delta
          ? accountNetBalance(xln.deriveDelta(delta, entityId.toLowerCase() === account.leftEntity.toLowerCase()))
          : 0n;
      };
      const account = await read();
      const before = balance(account);
      const plan = xln.planReceiveCapacity({ ...input, account });
      if (plan.status !== 'ready') {
        if (plan.status !== 'credit') throw new Error('This account cannot receive test money yet');
        setStage('Preparing…');
        await sendEntityTxs(entityId, wallet.signerId, [...plan.setupTxs]);
        await waitFor(
          async () => xln.planReceiveCapacity({ ...input, account: await read() }).status === 'ready',
          'hub confirmation',
        );
      }
      setStage('Receiving…');
      await requestFaucet('offchain', {
        entityId,
        signerId: wallet.signerId,
        runtimeId: requireAdapter().runtimeId,
        hubEntityId: hub.counterpartyId,
        tokenId: 1,
        tokenSymbol: 'USDC',
        amount: '100',
      });
      await waitFor(async () => balance(await read()) >= before + 100_000_000n, 'confirmed test payment');
      setDone(true);
      setStage('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setStage('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="test-money" aria-label="Test money faucet">
      <span className="test-money-label">Faucet</span>
      <span className="test-money-token">USDC</span>
      <button
        type="button"
        className="btn sm"
        disabled={busy || !hub || !commandReady}
        onClick={() => void receive()}
        data-testid="home-faucet"
        aria-label="Get 100 test USDC"
      >
        {busy ? stage || 'Receiving…' : '+100'}
      </button>
      <button type="button" className="more" onClick={() => setTour({ active: true, index: 0 })}>
        Tour
      </button>
      {hub && (
        <details className="disclosure">
          <summary>Details</summary>
          <p className="note">
            Each click adds 100 USDC of test money. Existing credit is used first; if needed, this action increases how
            much {hub.label} can owe you without collateral.
          </p>
        </details>
      )}
      {done && (
        <span role="status" data-testid="test-money-status">
          100 USDC received
        </span>
      )}
      {!hub && <p role="status">Connecting your hub account…</p>}
      {error && <p role="alert">{error} Check your balance before trying again.</p>}
    </section>
  );
}
