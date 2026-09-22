import { Bar } from '../Bars';
import { formatUsd } from '../../runtime/format';
import { useApp } from '../../runtime/store';
import type { WalletView } from '../../runtime/views';

export function BalanceDetails({ wallet }: { wallet: WalletView }) {
  const scaleMode = useApp(s => s.scaleMode);
  const setScaleMode = useApp(s => s.setScaleMode);
  const places = useApp(s => s.places);
  const parts = [
    {
      visible: places.accounts,
      kind: 'coll' as const,
      amount: wallet.usd.secured,
      id: 'home-secured',
      label: 'Backed by collateral',
      description: 'Money owed to you, covered by funds locked on the blockchain.',
    },
    {
      visible: places.accounts,
      kind: 'risk' as const,
      amount: wallet.usd.risk,
      id: 'home-risk',
      label: 'Without collateral',
      description: 'Money owed to you. Repayment depends on the other party.',
    },
    {
      visible: places.onchain,
      kind: 'onchain' as const,
      amount: wallet.usd.onchain,
      id: 'home-onchain',
      label: 'In your blockchain wallet',
      description: 'Funds held directly at your blockchain address.',
    },
    {
      visible: places.reserve,
      kind: 'reserve' as const,
      amount: wallet.usd.reserve,
      id: 'home-reserve',
      label: 'In your reserve',
      description: 'Your funds in the XLN contract, not allocated to a payment account.',
    },
  ].filter(part => part.visible);
  return (
    <section className="wallet-breakdown" aria-label="Balance breakdown" data-testid="home-balance-breakdown">
      <h3 className="caps">Balance breakdown</h3>
      <p className="note">How your funds are held · fixed reference prices, not live market value</p>
      <Bar segments={parts.map(part => ({ usd: part.amount, kind: part.kind }))} />
      <p className="note wallet-scale-note">
        Same dollar value = same bar length · {scaleMode === 'auto' ? 'Auto scale' : 'Fixed scale'}
        {scaleMode === 'fixed' && (
          <button type="button" className="more" onClick={() => setScaleMode('auto')}>
            Fit all balances
          </button>
        )}
      </p>
      <div className="balance-parts">
        {parts.map(part => (
          <div key={part.id} className="balance-part">
            <div data-testid={part.id}>
              <span>
                <i className={`sw c-${part.kind}`} />
                {part.label}
              </span>
              <strong className="num">{formatUsd(part.amount)}</strong>
            </div>
            <p className="note">{part.description}</p>
          </div>
        ))}
      </div>
      {places.accounts && wallet.usd.owed > 0 && (
        <p className="note">
          <i className="sw c-debt" />
          You owe {formatUsd(wallet.usd.owed)}. This is deducted from your total balance.
        </p>
      )}
      {places.reserve && wallet.usd.pending > 0 && (
        <p className="note st-pending">{formatUsd(wallet.usd.pending)} being deposited · not yet in your balance</p>
      )}
    </section>
  );
}
