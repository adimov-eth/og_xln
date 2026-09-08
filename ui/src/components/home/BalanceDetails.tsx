import { CopyId } from '../CopyId';
import { formatUsd } from '../../runtime/format';
import { useApp } from '../../runtime/store';
import type { WalletView } from '../../runtime/views';
export function BalanceDetails({ wallet }: { wallet: WalletView }) {
  const places = useApp(s => s.places);
  return (
    <details className="disclosure">
      <summary>Balance details</summary>
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
          <span>
            <i className="sw c-coll" />
            Secured <b className="num">{formatUsd(wallet.usd.secured)}</b>
          </span>
        )}
        {places.accounts && (
          <span data-testid="home-risk">
            <i className="sw c-risk" />
            <span title="A hub owes you this and has only promised to pay. Move it into collateral, or dispute, to make the chain enforce it.">
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
        Secured funds are backed by collateral. Unsecured funds depend on your counterparty paying.
      </p>
      <div className="kv">
        <span className="k">Entity · frame {wallet.frameHeight}</span>
        <CopyId value={wallet.entityId} label="Entity ID" full />
      </div>
    </details>
  );
}
