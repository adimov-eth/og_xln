import { CopyId } from '../CopyId';
import { Bar } from '../Bars';
import { formatUsd } from '../../runtime/format';
import { useApp } from '../../runtime/store';
import type { WalletView } from '../../runtime/views';
export function BalanceDetails({ wallet }: { wallet: WalletView }) {
  const places = useApp(s => s.places);
  return (
    <section className="wallet-breakdown" aria-label="Where your money is" data-testid="home-balance-breakdown">
      <h3 className="caps">Where your money is</h3>
      <Bar
        segments={[
          { usd: places.onchain ? wallet.usd.onchain : 0, kind: 'onchain' },
          { usd: places.reserve ? wallet.usd.reserve : 0, kind: 'reserve' },
          { usd: places.accounts ? wallet.usd.secured : 0, kind: 'coll' },
          { usd: places.accounts ? wallet.usd.risk : 0, kind: 'risk' },
        ]}
      />
      <div className="tiers">
        {places.onchain && (
          <span data-testid="home-onchain">
            <i className="sw c-onchain" />
            On-chain <b className="num">{formatUsd(wallet.usd.onchain)}</b>
          </span>
        )}
        {places.reserve && (
          <span>
            <i className="sw c-reserve" />
            Reserve <b className="num">{formatUsd(wallet.usd.reserve)}</b>
            {wallet.usd.pending > 0 ? (
              <span className="st-pending num"> +{formatUsd(wallet.usd.pending)} pending</span>
            ) : null}
          </span>
        )}
        {places.accounts && (
          <span data-testid="home-secured">
            <i className="sw c-coll" />
            Collateral-backed <b className="num">{formatUsd(wallet.usd.secured)}</b>
          </span>
        )}
        {places.accounts && (
          <span data-testid="home-risk">
            <i className="sw c-risk" />
            <span title="Your counterparty owes you this amount without on-chain collateral backing it.">
              Unsecured
            </span>{' '}
            <b className="num">{formatUsd(wallet.usd.risk)}</b>
            {wallet.usd.owed > 0 ? (
              <span className="num" style={{ color: 'var(--debt)' }}>
                {' '}
                · you owe {formatUsd(wallet.usd.owed)}
              </span>
            ) : null}
          </span>
        )}
      </div>
      <p className="note">
        Collateral is locked on-chain. Unsecured funds are what your counterparty owes you without collateral.
      </p>
      <details className="disclosure">
        <summary>Wallet identity</summary>
        <div className="kv">
          <span className="k">Entity · frame {wallet.frameHeight}</span>
          <CopyId value={wallet.entityId} label="Entity ID" full />
        </div>
      </details>
    </section>
  );
}
