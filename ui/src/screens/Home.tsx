import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UsdAmount } from '../components/Amount';
import { Bar } from '../components/Bars';
import { CopyId } from '../components/CopyId';
import { TokenRow, AccountRow } from '../components/home/Balances';
import { TestMoney } from '../components/home/TestMoney';
import { OpenAccountSheet } from '../components/home/OpenAccountSheet';
import { EntitySwitcher } from '../components/EntitySwitcher';
import { Icon } from '../components/Icons';
import { PendingBatch } from '../components/PendingBatch';
import { Sheet } from '../components/Sheet';
import { useApp } from '../runtime/store';
import { formatUsd, shortId } from '../runtime/format';
import { usdOf } from '../runtime/financial/prices';
import { useWallet } from '../runtime/views';
import { USER_ACTIVITY_TYPES, useMovements } from '../runtime/financial/movements';
import { ActivityRow } from './Activity';

export function Home() {
  const [addingMoney, setAddingMoney] = useState(false);
  const entityId = useApp(s => s.activeEntityId);
  const places = useApp(s => s.places);
  const usdPerPx = useApp(s => s.usdPerPx);
  const scaleMode = useApp(s => s.scaleMode);
  const fitScale = useApp(s => s.fitScale);
  const wallet = useWallet(entityId);
  const navigate = useNavigate();
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const [opening, setOpening] = useState(false);

  const accountIds = useMemo(() => wallet.accounts.map(account => account.counterpartyId), [wallet.accounts]);
  const recent = useMovements(entityId, USER_ACTIVITY_TYPES, 40, accountIds);
  const recentMovements = recent.movements.slice(0, 4);

  const activeTotals = useMemo(() => wallet.totals.filter(total => total.active), [wallet.totals]);

  // The largest balance drawn on this screen sets the auto scale. Capacity bars
  // (credit lines dwarf balances) may run past their track and fade: that fade
  // is the signal that there is more room than money.
  const largestBarUsd = useMemo(
    () => Math.max(wallet.usd.net, ...activeTotals.map(total => usdOf(total.tokenId, total.net))),
    [wallet.usd.net, activeTotals],
  );
  useEffect(() => fitScale(largestBarUsd), [largestBarUsd, fitScale]);

  const toggle = (tokenId: number): void =>
    setOpen(current => {
      const next = new Set(current);
      if (next.has(tokenId)) next.delete(tokenId);
      else next.add(tokenId);
      return next;
    });

  const heroSegments = [
    { usd: places.onchain ? wallet.usd.onchain : 0, kind: 'onchain' as const },
    { usd: places.reserve ? wallet.usd.reserve : 0, kind: 'reserve' as const },
    { usd: places.reserve ? wallet.usd.pending : 0, kind: 'pend' as const },
    { usd: places.accounts ? wallet.usd.secured : 0, kind: 'coll' as const },
    { usd: places.accounts ? wallet.usd.risk : 0, kind: 'risk' as const },
  ];
  const visibleNet =
    (places.onchain ? wallet.usd.onchain : 0) +
    (places.reserve ? wallet.usd.reserve : 0) +
    (places.accounts ? wallet.usd.receivable - wallet.usd.owed : 0);

  return (
    <div className="screen fade-in">
      <div className="screen-header">
        <span className="screen-title">
          <EntitySwitcher
            name={wallet.name}
            status={
              <span
                className="state st-settled"
                style={{ fontSize: 11 }}
                data-testid="home-frame"
                title={`Frame ${wallet.frameHeight.toLocaleString('en-US')}`}
              >
                frame {wallet.frameHeight.toLocaleString('en-US')}
              </span>
            }
          />
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => navigate('/sovereignty')}
          aria-label="Sovereignty"
          title="Keys, proofs, what is at risk"
          data-testid="home-sovereignty"
        >
          <Icon name="shield" size={18} />
        </button>
        <span className="hash" style={{ display: 'none' }} data-testid="home-entity-id">
          {wallet.entityId}
        </span>
      </div>

      <div className="two-col">
        <div>
          <div className="hero">
            <div className="hero-label">
              {places.onchain && places.reserve && places.accounts ? 'Total balance' : 'Selected balances'}
            </div>
            <UsdAmount value={visibleNet} size={52} testId="home-total" />
            <div className="rb">
              <Bar segments={heroSegments} height={8} />
            </div>
            <details className="disclosure">
              <summary>Balance breakdown & verification</summary>
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
                      Promised
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
                Secured funds are backed by collateral. Promised funds depend on your counterparty paying.
              </p>
              <div className="kv">
                <span className="k">Entity · frame {wallet.frameHeight}</span>
                <CopyId value={wallet.entityId} label="Entity ID" full />
              </div>
            </details>
            {addingMoney ? (
              <Sheet title="Add money" onClose={() => setAddingMoney(false)}>
                <div className="stack" style={{ gap: 10 }}>
                  <button
                    type="button"
                    className="row tappable first"
                    onClick={() => {
                      setAddingMoney(false);
                      document.querySelector<HTMLElement>('[data-testid=home-faucet]')?.focus();
                    }}
                    data-testid="add-money-hub"
                  >
                    <span className="rt">
                      <span className="tx">
                        <span className="t">From a hub, instantly</span>
                        <span className="s">
                          A hub pays you over the credit line you grant it. On this test network the faucet plays the
                          hub&apos;s payer.
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="row tappable"
                    onClick={() => {
                      setAddingMoney(false);
                      navigate('/receive');
                    }}
                    data-testid="add-money-request"
                  >
                    <span className="rt">
                      <span className="tx">
                        <span className="t">Ask someone to pay you</span>
                        <span className="s">
                          A payment link or QR code with the amount filled in. They pay from any xln wallet.
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="row tappable"
                    onClick={() => {
                      setAddingMoney(false);
                      navigate('/assets');
                    }}
                    data-testid="add-money-onchain"
                  >
                    <span className="rt">
                      <span className="tx">
                        <span className="t">From the blockchain</span>
                        <span className="s">
                          Send tokens to your on-chain address{wallet.signerId ? ` (${shortId(wallet.signerId)})` : ''},
                          then move them into your reserve.
                        </span>
                      </span>
                    </span>
                  </button>
                  <p className="note">This network uses test money only.</p>
                </div>
              </Sheet>
            ) : null}
            {places.accounts && (
              <div className="tiers" style={{ marginTop: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--accent-2)', display: 'inline-flex' }}>
                    <Icon name="bolt" size={13} />
                  </span>
                  <span data-testid="home-send-capacity">
                    Spendable now <b className="num">{formatUsd(wallet.usd.sendCapacity)}</b> · can receive{' '}
                    <b className="num">{formatUsd(wallet.usd.receiveCapacity)}</b>
                  </span>
                </span>
              </div>
            )}
          </div>

          <div className="actions">
            <button type="button" className="btn primary" onClick={() => navigate('/pay')} data-testid="home-pay">
              <Icon name="pay" size={18} />
              Pay
            </button>
            <button type="button" className="btn" onClick={() => navigate('/receive')} data-testid="home-receive">
              <Icon name="receive" size={18} />
              Receive
            </button>
            <button type="button" className="btn" onClick={() => navigate('/swap')} data-testid="home-swap">
              <Icon name="swap" size={18} />
              Swap
            </button>
          </div>

          <PendingBatch wallet={wallet} compact />
          <TestMoney key={wallet.entityId} wallet={wallet} />

          <div className="sect">
            <h3 className="caps">Balances</h3>
            <button
              type="button"
              className="more"
              style={{ marginRight: 12 }}
              onClick={() => setAddingMoney(true)}
              data-testid="home-add-money"
              title="Every way money can come in"
            >
              Add money
            </button>
            <button
              type="button"
              className="more"
              style={{ marginRight: 12 }}
              onClick={() => navigate('/move')}
              data-testid="home-move"
            >
              Move
            </button>
            {wallet.totals.length > activeTotals.length ? (
              <button
                type="button"
                className="more"
                onClick={() => navigate('/settings')}
                title={`Every bar is drawn to one scale: 1 px = $${usdPerPx.toLocaleString('en-US')}${scaleMode === 'auto' ? ' (auto)' : ''}. Empty balances are hidden.`}
              >
                Show {wallet.totals.length - activeTotals.length} empty
              </button>
            ) : null}
          </div>
          {activeTotals.map((total, index) => (
            <TokenRow
              key={total.tokenId}
              total={total}
              wallet={wallet}
              first={index === 0}
              open={open.has(total.tokenId)}
              onToggle={() => toggle(total.tokenId)}
              onAccount={counterpartyId => navigate(`/accounts/${counterpartyId}`)}
            />
          ))}
          {activeTotals.length === 0 && !wallet.loading && (
            <p className="note" style={{ padding: '18px 0' }}>
              Your first payment starts here. Add test money or share your receiving address.
            </p>
          )}
        </div>

        <div className="aside">
          <div className="card" data-testid="home-accounts">
            <h3 className="caps">Accounts</h3>
            {wallet.accounts.map((account, index) => (
              <AccountRow
                key={account.counterpartyId}
                account={account}
                first={index === 0}
                onClick={() => navigate(`/accounts/${account.counterpartyId}`)}
              />
            ))}
            {wallet.accounts.length === 0 && !wallet.loading && (
              <p className="note" style={{ padding: '6px 0 10px' }}>
                Connect to a hub to send and receive payments.
              </p>
            )}
            <button type="button" className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => setOpening(true)}>
              <Icon name="plus" size={15} />
              Open account
            </button>
          </div>

          <div className="card">
            <h3 className="caps">Recent</h3>
            {recentMovements.map((movement, index) => (
              <ActivityRow key={movement.id} movement={movement} names={wallet.names} first={index === 0} />
            ))}
            {recentMovements.length === 0 && !recent.loading && (
              <p className="note" style={{ padding: '6px 0' }}>
                Payments and swaps will appear here.
              </p>
            )}
            {recentMovements.length > 0 && (
              <button
                type="button"
                className="btn quiet"
                style={{ marginTop: 10 }}
                onClick={() => navigate('/activity')}
              >
                All activity
              </button>
            )}
          </div>
        </div>
      </div>

      {opening && <OpenAccountSheet wallet={wallet} onClose={() => setOpening(false)} />}
    </div>
  );
}
