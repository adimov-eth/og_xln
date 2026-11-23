import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { VALUELESS_CHAIN_IDS } from '@xln/core/jurisdiction/adapter/chain-ids';
import { attachEverydayGlare } from '@xln/frontend/lib/everyday/wallet-posture';
import { SignSheets } from './SignSheets';
import { getJurisdictionBadgeInfo } from '@xln/frontend/lib/utils/identity/jurisdictionBadge';
import { getAdapter, getEmbeddedEnv } from '../runtime/adapter';
import { useExternalWalletSync } from '../runtime/financial/external';
import { observeFundingBatches } from '@xln/frontend/lib/everyday/funding-submission';
import { useRecoverySync } from '../runtime/recovery-sync';
import { useApp } from '../runtime/store';
import { useWalletPosture } from '../runtime/use-everyday-wallet';
import { useWallet } from '../runtime/views';
import { Guide } from './guide/Guide';
import { Icon, type IconName } from './Icons';
import { JurisdictionBanner } from './JurisdictionBanner';
import { Logo } from './Logo';
import { NetworkRpc } from './Networks';
import { Palette } from './Palette';
import { Toasts } from './Toasts';
import { Tour } from './Tour';

type NavDestination = {
  to: string;
  label: string;
  testId: string;
  icon: IconName;
  match: (pathname: string) => boolean;
};

const PRO_NAV: NavDestination[] = [
  {
    to: '/',
    label: 'Home',
    testId: 'nav-home',
    icon: 'home',
    match: pathname =>
      pathname === '/' ||
      pathname.startsWith('/accounts') ||
      pathname === '/pay' ||
      pathname === '/receive' ||
      pathname === '/swap' ||
      pathname === '/move',
  },
  { to: '/activity', label: 'Activity', testId: 'nav-activity', icon: 'activity', match: pathname => pathname.startsWith('/activity') },
  {
    to: '/manage',
    label: 'Manage',
    testId: 'nav-manage',
    icon: 'accounts',
    match: pathname =>
      pathname.startsWith('/manage') ||
      pathname.startsWith('/assets') ||
      pathname.startsWith('/lend') ||
      pathname.startsWith('/ownership') ||
      pathname.startsWith('/sovereignty'),
  },
  { to: '/settings', label: 'Settings', testId: 'nav-settings', icon: 'settings', match: pathname => pathname.startsWith('/settings') },
];

const EVERYDAY_NAV: NavDestination[] = [
  { to: '/', label: 'Cash', testId: 'nav-cash', icon: 'wallet', match: pathname => pathname === '/' },
  { to: '/friends', label: 'Friends', testId: 'nav-friends', icon: 'accounts', match: pathname => pathname.startsWith('/friends') },
  { to: '/savings', label: 'Savings', testId: 'nav-savings', icon: 'bank', match: pathname => pathname.startsWith('/savings') },
  { to: '/activity', label: 'Activity', testId: 'nav-activity', icon: 'activity', match: pathname => pathname.startsWith('/activity') },
  { to: '/settings', label: 'Settings', testId: 'nav-settings', icon: 'settings', match: pathname => pathname.startsWith('/settings') },
];

/** Screens with their own back control and one primary action; the tab bar would compete with them on a phone. */
const FLOW_ROUTES = new Set(['/pay', '/receive', '/swap', '/move']);

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { posture, preserveModeTo } = useWalletPosture();
  const entityId = useApp(s => s.activeEntityId);
  const wallet = useWallet(entityId);
  useRecoverySync();
  const assets = useExternalWalletSync(wallet.entityId, wallet.signerId);
  const [contentMounted, setContentMounted] = useState(false);
  useEffect(() => {
    if (assets.ready) setContentMounted(true);
  }, [assets.ready]);
  const batches = wallet.frame?.activeEntity?.core?.jBatchState;
  useEffect(() => {
    observeFundingBatches(wallet.entityId, [
      batches?.batch,
      batches?.sentBatch?.batch,
      ...(batches?.recoveryBatches ?? []),
    ]);
  }, [wallet.entityId, batches]);
  const clearToasts = useApp(s => s.clearToasts);
  useEffect(() => clearToasts(), [pathname, clearToasts]);
  const appRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (posture !== 'everyday') return;
    return attachEverydayGlare(appRef.current);
  }, [posture]);

  const navItems = posture === 'pro' ? PRO_NAV : EVERYDAY_NAV;
  const navigate = useNavigate();
  const commandReady = useApp(s => s.commandReady);
  const runtimeId = getAdapter()?.runtimeId ?? '';
  const chainId = wallet.frame?.activeEntity?.core?.config.jurisdiction?.chainId;
  const isDemoChain = chainId !== undefined && VALUELESS_CHAIN_IDS.has(Number(chainId));
  const onTestScreen = pathname.startsWith('/test');
  const hasDisputed = wallet.accounts.some(account => account.disputed);
  const hasArriving = wallet.accounts.some(
    account => account.isHub && !account.disputed && account.tokens.some(token => token.derived.outPeerCredit > 0n),
  );
  const evState = hasDisputed ? 'disputed' : !commandReady ? 'syncing' : hasArriving ? 'arriving' : 'settled';

  return (
    <div
      ref={appRef}
      className="app jurisdiction-surface"
      data-posture={posture}
      data-ev-state={posture === 'everyday' ? evState : undefined}
      data-jurisdiction={
        getJurisdictionBadgeInfo(wallet.jurisdiction, wallet.frame?.activeEntity?.core?.config.jurisdiction?.chainId)
          ?.className ?? 'generic'
      }
    >
      <a className="skip-link" href="#wallet-content">
        Skip to content
      </a>
      {posture === 'pro' ? <Palette /> : null}
      <nav className="rail" aria-label="Primary">
        <div className="rail-brand" aria-hidden>
          <span className="rail-mark">
            <Logo size={17} />
          </span>
          <span className="rail-brand-name">xln</span>
        </div>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={preserveModeTo(item.to)}
            className={`rail-item${item.match(pathname) ? ' active' : ''}`}
            data-testid={item.testId}
            aria-label={item.label}
            title={item.label}
          >
            <Icon name={item.icon} size={18} />
            <span className="rail-label">{item.label}</span>
          </NavLink>
        ))}
        <div className="rail-spacer" />
        {posture === 'pro' ? (
          <div className="rail-foot">
            <span className="net-badge">{wallet.jurisdiction || 'Testnet'}</span>
            <span>Frame #{wallet.frameHeight.toLocaleString('en-US')}</span>
          </div>
        ) : null}
      </nav>

      <main className="main" id="wallet-content" tabIndex={-1}>
        {posture === 'pro' ? (
          <div
            data-testid={wallet.entityId ? 'context-current' : undefined}
            data-runtime-id={runtimeId}
            data-entity-id={wallet.entityId}
          >
            <JurisdictionBanner wallet={wallet} />
          </div>
        ) : wallet.entityId ? (
          <div
            className="everyday-topbar"
            data-testid="context-current"
            data-runtime-id={runtimeId}
            data-entity-id={wallet.entityId}
          >
            <span className="everyday-brand">
              <span className="rail-mark" aria-hidden="true">
                <Logo size={17} />
              </span>
              <span className="everyday-brand-name">xln</span>
            </span>
            {isDemoChain ? (
              <button
                type="button"
                className={`everyday-test-trigger${onTestScreen ? ' active' : ''}`}
                onClick={() => navigate(preserveModeTo(onTestScreen ? '/' : '/test'))}
                aria-pressed={onTestScreen}
                data-testid="everyday-test-btn"
              >
                Test
              </button>
            ) : null}
          </div>
        ) : null}
        {posture === 'pro' ? <Tour /> : null}
        <SignSheets />
        <div hidden={!assets.ready} inert={!assets.ready} style={{ display: assets.ready ? 'contents' : 'none' }}>
          {contentMounted || assets.ready ? children : null}
        </div>
        {!assets.ready ? (
          <section
            className="stack"
            role={assets.error && !assets.sourceAdvance ? 'alert' : 'status'}
            data-testid="asset-snapshot-status"
          >
            <p>
              {assets.sourceAdvance
                ? 'The chain advanced during the balance read. Waiting for a consistent snapshot…'
                : assets.error
                  ? 'Could not load your wallet.'
                  : 'Loading your wallet…'}
            </p>
            {assets.error && (
              <>
                <p className="note">{assets.error}</p>
                <button className="btn" onClick={assets.retry}>
                  Retry
                </button>
                {posture === 'pro' ? <AssetRpcRecovery name={wallet.jurisdiction} onReplaced={assets.retry} /> : null}
              </>
            )}
          </section>
        ) : null}
      </main>

      <nav className={`tabbar${posture === 'pro' && FLOW_ROUTES.has(pathname) ? ' flow' : ''}`} aria-label="Primary">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={preserveModeTo(item.to)}
            className={`tabbar-item${item.match(pathname) ? ' active' : ''}`}
            data-testid={item.testId}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {posture === 'pro' ? <Guide /> : null}
      <Toasts />
    </div>
  );
}

/** The published RPC may be the stopped Hub's gateway: the owner must still reach the chain. */
function AssetRpcRecovery({ name, onReplaced }: { name: string; onReplaced: () => void }) {
  const published = getEmbeddedEnv()?.state.jReplicas.get(name)?.rpcs?.[0];
  return published ? <NetworkRpc name={name} published={published} onReplaced={onReplaced} /> : null;
}
