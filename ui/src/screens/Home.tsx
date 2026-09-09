import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UsdAmount } from '../components/Amount';
import { TokenRow, AccountRow } from '../components/home/Balances';
import { BalanceDetails } from '../components/home/BalanceDetails';
import { TestMoney } from '../components/home/TestMoney';
import { OpenAccountSheet } from '../components/home/OpenAccountSheet';
import { EntitySwitcher } from '../components/EntitySwitcher';
import { Icon } from '../components/Icons';
import { PendingBatch } from '../components/PendingBatch';
import { Sheet } from '../components/Sheet';
import { useApp } from '../runtime/store';
import { formatUsd } from '../runtime/format';
import { usdOf } from '../runtime/financial/prices';
import { useWallet } from '../runtime/views';
import { USER_ACTIVITY_TYPES, useMovements } from '../runtime/financial/movements';
import { ActivityRow } from './Activity';

export function Home() {
  const entityId = useApp(s => s.activeEntityId);
  const places = useApp(s => s.places);
  const wallet = useWallet(entityId);
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showZero, setShowZero] = useState(false);
  const [opening, setOpening] = useState(false);
  const [addingMoney, setAddingMoney] = useState(false);
  const accountIds = useMemo(() => wallet.accounts.map(account => account.counterpartyId), [wallet.accounts]);
  const recent = useMovements(entityId, USER_ACTIVITY_TYPES, 80, accountIds);
  const movements = recent.movements.filter(row => row.kind !== 'account').slice(0, 5);
  const totals = wallet.totals.filter(total => showZero || total.active);
  const emptyCount = wallet.totals.filter(total => !total.active).length;
  const visibleNet =
    (places.onchain ? wallet.usd.onchain : 0) +
    (places.reserve ? wallet.usd.reserve : 0) +
    (places.accounts ? wallet.usd.receivable - wallet.usd.owed : 0);
  const held = wallet.accounts.reduce(
    (sum, account) =>
      sum + account.tokens.reduce((amount, token) => amount + usdOf(token.tokenId, token.derived.outTotalHold), 0),
    0,
  );

  return (
    <div className="screen wallet-home fade-in">
      <div className="screen-header">
        <EntitySwitcher name={wallet.name} status={<span className="note">Wallet</span>} />
        <button
          type="button"
          className="icon-btn"
          onClick={() => navigate('/sovereignty')}
          aria-label="Security and recovery"
          data-testid="home-sovereignty"
        >
          <Icon name="shield" size={18} />
        </button>
        <span hidden data-testid="home-entity-id">
          {wallet.entityId}
        </span>
      </div>
      <section className="wallet-overview" aria-label="Your balance">
        <span className="hero-label">
          {places.onchain && places.reserve && places.accounts ? 'Total balance' : 'Selected balances'}
        </span>
        {wallet.frame ? (
          <UsdAmount value={visibleNet} size={52} testId="home-total" />
        ) : (
          <p className="hero-label" role="status">{wallet.error ? 'Balance unavailable' : 'Loading balance…'}</p>
        )}
        {wallet.frame && places.accounts && (
          <p className="note" data-testid="home-send-capacity">
            {Math.abs(visibleNet - wallet.usd.sendCapacity) < 0.005
              ? 'Ready to send'
              : `${formatUsd(wallet.usd.sendCapacity)} available to send`}
          </p>
        )}
        {held > 0 && (
          <button type="button" className="wallet-pending" onClick={() => navigate('/activity')}>
            {formatUsd(held)} pending · View activity <Icon name="chevronRight" size={14} />
          </button>
        )}
      </section>
      <div className="actions wallet-actions">
        <button type="button" className="btn primary" disabled={!wallet.frame || Boolean(wallet.error)} onClick={() => navigate('/pay')} data-testid="home-pay">
          <Icon name="pay" size={18} />
          Pay
        </button>
        <button type="button" className="btn" onClick={() => navigate('/receive')} data-testid="home-receive">
          <Icon name="receive" size={18} />
          Receive
        </button>
        <button type="button" className="btn" disabled={!wallet.frame || Boolean(wallet.error)} onClick={() => navigate('/swap')} data-testid="home-swap">
          <Icon name="swap" size={18} />
          Swap
        </button>
      </div>
      <PendingBatch wallet={wallet} compact />
      <TestMoney key={wallet.entityId} wallet={wallet} />
      <div className="wallet-sections">
        <section aria-label="Assets">
          <div className="sect">
            <h3 className="caps">Assets</h3>
            <button type="button" className="more" onClick={() => setAddingMoney(true)} data-testid="home-add-money">
              Add money
            </button>
          </div>
          {totals.map((total, index) => (
            <TokenRow
              key={total.tokenId}
              total={total}
              wallet={wallet}
              first={index === 0}
              open={expanded === total.tokenId}
              onToggle={() => setExpanded(expanded === total.tokenId ? null : total.tokenId)}
              onAccount={id => navigate(`/accounts/${id}`)}
            />
          ))}
          {totals.length === 0 && !wallet.loading && !wallet.error && (
            <p className="note wallet-empty">No funds yet. Get test money above to make your first payment.</p>
          )}
          {emptyCount > 0 && (
            <button
              type="button"
              className="more wallet-show-assets"
              aria-expanded={showZero}
              data-testid="home-show-zero"
              onClick={() => setShowZero(value => !value)}
            >
              {showZero ? 'Hide zero balances' : 'Show all assets'}
            </button>
          )}
        </section>
        <section aria-label="Recent activity">
          <div className="sect">
            <h3 className="caps">Recent activity</h3>
            <button type="button" className="more" onClick={() => navigate('/activity')}>
              View all
            </button>
          </div>
          {movements.map((movement, index) => (
            <ActivityRow
              key={movement.id}
              movement={movement}
              names={wallet.names}
              first={index === 0}
              onClick={() => navigate('/activity', { state: { movementId: movement.id } })}
            />
          ))}
          {movements.length === 0 && !recent.loading && !recent.error && (
            recent.nextBeforeHeight !== null ? (
              <button type="button" className="more" onClick={() => navigate('/activity')}>View earlier activity</button>
            ) : (
              <p className="note wallet-empty">Your payments and swaps will appear here.</p>
            )
          )}
          {recent.error && (
            <p role="alert" className="note">
              Activity unavailable: {recent.error}
            </p>
          )}
        </section>
      </div>
      <footer className="wallet-details">
        <BalanceDetails wallet={wallet} />
        <section className="wallet-connections" data-testid="home-accounts">
          <h3 className="caps">Connected accounts</h3>
          {wallet.accounts.map((account, index) => (
            <AccountRow
              key={account.counterpartyId}
              account={account}
              first={index === 0}
              onClick={() => navigate(`/accounts/${account.counterpartyId}`)}
            />
          ))}
          <button type="button" className="btn quiet sm" onClick={() => setOpening(true)}>
            Connect another account
          </button>
        </section>
        <button type="button" className="more" onClick={() => navigate('/move')} data-testid="home-move">
          Transfer between accounts
        </button>
      </footer>
      {opening && <OpenAccountSheet wallet={wallet} onClose={() => setOpening(false)} />}
      {addingMoney && (
        <Sheet title="Add money" onClose={() => setAddingMoney(false)}>
          <div className="stack">
            <button
              type="button"
              className="btn"
              data-testid="add-money-hub"
              onClick={() => {
                setAddingMoney(false);
                document.querySelector<HTMLElement>('[data-testid=home-faucet]')?.focus();
              }}
            >
              Get test USDC
            </button>
            <button type="button" className="btn" data-testid="add-money-request" onClick={() => navigate('/receive')}>
              Receive a payment
            </button>
            <button type="button" className="btn" data-testid="add-money-onchain" onClick={() => navigate('/assets')}>
              Deposit from the blockchain
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
