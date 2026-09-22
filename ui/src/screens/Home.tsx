import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CopyId } from '../components/CopyId';
import { TokenRow, AccountRow } from '../components/home/Balances';
import { WalletScale } from '../components/home/WalletScale';
import { BalanceDetails } from '../components/home/BalanceDetails';
import { TestMoney } from '../components/home/TestMoney';
import { OpenAccountSheet } from '../components/home/OpenAccountSheet';
import { EntitySwitcher } from '../components/EntitySwitcher';
import { Icon } from '../components/Icons';
import { PendingBatch } from '../components/PendingBatch';
import { Sheet } from '../components/Sheet';
import { useApp } from '../runtime/store';
import { formatAmount, getTokenMeta } from '../runtime/format';
import { useWallet } from '../runtime/views';
import { USER_ACTIVITY_TYPES, useMovements } from '../runtime/financial/movements';
import { ActivityRow } from './Activity';

export function Home() {
  const commandReady = useApp(s => s.commandReady);
  const entityId = useApp(s => s.activeEntityId);
  const places = useApp(s => s.places);
  const wallet = useWallet(entityId);
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set());
  const [showZero, setShowZero] = useState(false);
  const [opening, setOpening] = useState(false);
  const [addingMoney, setAddingMoney] = useState(false);
  const [selectedToken, setSelectedToken] = useState(1);
  const accountIds = useMemo(() => wallet.accounts.map(account => account.counterpartyId), [wallet.accounts]);
  const recent = useMovements(entityId, USER_ACTIVITY_TYPES, 80, accountIds);
  const movements = recent.movements.filter(row => row.kind !== 'account').slice(0, 5);
  const totals = wallet.totals.filter(total => showZero || total.active);
  const emptyCount = wallet.totals.filter(total => !total.active).length;
  const balanceTokens = wallet.totals.filter(total => total.active || total.tokenId === 1);
  const balanceToken = balanceTokens.find(total => total.tokenId === selectedToken) ?? balanceTokens[0];
  const meta = balanceToken ? getTokenMeta(balanceToken.tokenId) : null;
  const visibleNet = balanceToken ?
    (places.onchain ? balanceToken.onchain : 0n) +
    (places.reserve ? balanceToken.reserve : 0n) +
    (places.accounts ? balanceToken.receivable + balanceToken.owed : 0n) : 0n;
  const money = (amount: bigint) => meta ? `${formatAmount(amount, meta.decimals, meta.decimals)} ${meta.symbol}` : '0';
  const held = wallet.accounts.reduce(
    (sum, account) =>
      sum + account.tokens.filter(token => token.tokenId === balanceToken?.tokenId)
        .reduce((amount, token) => amount + token.derived.outTotalHold, 0n),
    0n,
  );

  return (
    <WalletScale>
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
          {places.onchain && places.reserve && places.accounts ? 'Balance' : 'Selected balances'}
        </span>
        {balanceToken && <select className="input" style={{ width: 'auto', marginBottom: 8 }} aria-label="Balance asset" data-testid="home-balance-asset"
          value={balanceToken.tokenId} onChange={event => setSelectedToken(Number(event.target.value))}>
          {balanceTokens.map(token => <option key={token.tokenId} value={token.tokenId}>{getTokenMeta(token.tokenId).symbol}</option>)}
        </select>}
        {wallet.frame ? (
          <div className="display num" style={{ fontSize: 52, overflowWrap: 'anywhere' }} data-testid="home-total">
            {meta ? formatAmount(visibleNet, meta.decimals, meta.decimals) : '0'}
          </div>
        ) : (
          <p className="hero-label" role="status">
            {wallet.error ? 'Balance unavailable' : 'Loading balance…'}
          </p>
        )}
        {wallet.frame && places.accounts && (
          <p className="note" data-testid="home-send-capacity">
            {!commandReady
              ? 'Wallet connection stopped. Reopen the wallet to continue.'
              : `Payment capacity: ${money(balanceToken?.sendCapacity ?? 0n)} · includes available credit`}
          </p>
        )}
        {held > 0n && (
          <button type="button" className="wallet-pending" onClick={() => navigate('/activity')}>
            {money(held)} pending · View activity <Icon name="chevronRight" size={14} />
          </button>
        )}
      </section>
      <div className="actions wallet-actions">
        <button
          type="button"
          className="btn primary"
          disabled={!commandReady || !wallet.frame || Boolean(wallet.error)}
          onClick={() => navigate('/pay')}
          data-testid="home-pay"
        >
          <Icon name="pay" size={18} />
          Pay
        </button>
        <button type="button" className="btn" onClick={() => navigate('/receive')} data-testid="home-receive">
          <Icon name="receive" size={18} />
          Receive
        </button>
        <button
          type="button"
          className="btn"
          disabled={!commandReady || !wallet.frame || Boolean(wallet.error)}
          onClick={() => navigate('/swap')}
          data-testid="home-swap"
        >
          <Icon name="swap" size={18} />
          Swap
        </button>
      </div>
      <PendingBatch wallet={wallet} compact />
      <TestMoney key={wallet.entityId} wallet={wallet} />
      <BalanceDetails wallet={wallet} />
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
              open={!collapsed.has(total.tokenId)}
              onToggle={() =>
                setCollapsed(previous => {
                  const next = new Set(previous);
                  if (next.has(total.tokenId)) next.delete(total.tokenId);
                  else next.add(total.tokenId);
                  return next;
                })
              }
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
              {showZero
                ? 'Hide zero balances'
                : `Show ${emptyCount} ${emptyCount === 1 ? 'asset' : 'assets'} with zero balance`}
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
          {recent.loading && (
            <p className="note" role="status">
              Loading recent activity…
            </p>
          )}
          {movements.map((movement, index) => (
            <ActivityRow
              key={movement.id}
              movement={movement}
              names={wallet.names}
              first={index === 0}
              onClick={() => navigate('/activity', { state: { movementId: movement.id } })}
            />
          ))}
          {movements.length === 0 &&
            !recent.loading &&
            !recent.error &&
            (recent.nextBeforeHeight !== null ? (
              <button type="button" className="more" onClick={() => navigate('/activity')}>
                Open full payment history
              </button>
            ) : (
              <p className="note wallet-empty">Your payments and swaps will appear here.</p>
            ))}
          {recent.error && (
            <p role="alert" className="note">
              Activity unavailable: {recent.error}
            </p>
          )}
        </section>
      </div>
      <footer className="wallet-details">
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
        <details className="disclosure">
          <summary>Wallet address and technical details</summary>
          <div className="kv">
            <span className="k">Payment address (Entity ID)</span>
            <CopyId value={wallet.entityId} label="Entity ID" full />
          </div>
          <p className="note">Confirmed frame: {wallet.frameHeight}</p>
        </details>
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
    </WalletScale>
  );
}
