import { useEffect, useState, useSyncExternalStore } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { WalletPosture } from '@xln/frontend/lib/everyday/wallet-posture';
import { EVERYDAY_COPY } from '@xln/frontend/lib/everyday/wallet-posture';
import { ExternalRequestSheet } from './components/everyday/ExternalRequestSheet';
import { PaymentReceiptSheet } from './components/PaymentReceipt';
import { RuntimeCommandGate } from './components/RuntimeCommandGate';
import { NetworkUpdatedGate } from './components/settings/NetworkUpdatedGate';
import { Shell } from './components/Shell';
import { Toasts } from './components/Toasts';
import {
  checkReactDeployVersion,
  isResettingRetiredTestnet,
  subscribeRetiredTestnetReset,
  type DeployVersionCheckResult,
} from './runtime/deploy-version';
import { withPostureQuery } from './runtime/everyday';
import { startPaymentTerminal } from './runtime/financial/receipts';
import { useApp } from './runtime/store';
import { useWalletPosture } from './runtime/use-everyday-wallet';
import { AccountDetail } from './screens/AccountDetail';
import { ActivityScreen } from './screens/Activity';
import { Assets } from './screens/Assets';
import { CustomContracts } from './screens/CustomContracts';
import { EverydayFriends } from './screens/everyday/EverydayFriends';
import { EverydayHome } from './screens/everyday/EverydayHome';
import { EverydaySavings } from './screens/everyday/EverydaySavings';
import { EverydayTest } from './screens/everyday/EverydayTest';
import { Gate } from './screens/Gate';
import { Home } from './screens/Home';
import { Lending } from './screens/Lending';
import { Manage } from './screens/Manage';
import { Move } from './screens/Move';
import { Ownership } from './screens/Ownership';
import { Pay } from './screens/Pay';
import { Receive } from './screens/Receive';
import { SettingsScreen } from './screens/Settings';
import { Sovereignty } from './screens/Sovereignty';
import { Swap } from './screens/Swap';

/** `/#pay/<invoice>` is the canonical wallet link; Pro opens Pay, Everyday opens ExternalRequestSheet. */
function useInvoiceDeepLink(
  posture: WalletPosture,
  onEverydayInvoice: (rawInvoice: string) => void,
): void {
  const navigate = useNavigate();
  const { pathname, hash, search } = useLocation();
  useEffect(() => {
    const raw = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!raw.toLowerCase().startsWith('pay/')) return;
    const invoiceHref = new URL(`#${raw}`, window.location.href).href;
    if (posture === 'everyday') {
      onEverydayInvoice(invoiceHref);
      void navigate({ pathname, search, hash: '' }, { replace: true });
      return;
    }
    void navigate(withPostureQuery('/pay', search), { replace: true, state: { invoice: invoiceHref } });
  }, [pathname, hash, search, posture, navigate, onEverydayInvoice]);
}

export default function App() {
  return (
    <>
      <RuntimeCommandGate />
      <WalletApp />
    </>
  );
}

function WalletApp() {
  const { posture } = useWalletPosture();
  const status = useApp(s => s.adapterStatus);
  const booting = useApp(s => s.booting);
  const activeEntityId = useApp(s => s.activeEntityId);
  const connected = status === 'connected' && !booting && Boolean(activeEntityId);
  const [externalInvoice, setExternalInvoice] = useState<string | null>(null);
  const [deployState, setDeployState] = useState<DeployVersionCheckResult | null>(null);
  const retiredResetting = useSyncExternalStore(
    subscribeRetiredTestnetReset,
    isResettingRetiredTestnet,
    () => false,
  );

  useEffect(() => {
    let alive = true;
    void checkReactDeployVersion().then(result => {
      if (alive) setDeployState(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  useInvoiceDeepLink(posture, setExternalInvoice);

  useEffect(() => {
    if (!connected) return;
    return startPaymentTerminal();
  }, [connected]);

  if (deployState?.status === 'resetting' || retiredResetting) {
    return (
      <div className="gate">
        <div className="gate-sheet">
          <p className="caps">{retiredResetting ? EVERYDAY_COPY.flows.resetDemo.pending : 'Updating test network…'}</p>
        </div>
      </div>
    );
  }

  if (deployState?.status === 'require-recovery') {
    return <NetworkUpdatedGate storedVersion={deployState.storedVersion} currentVersion={deployState.currentVersion} />;
  }

  if (!connected) {
    return (
      <>
        <Gate ephemeralTestnet={Boolean(deployState?.ephemeralTestnet)} />
        <Toasts />
      </>
    );
  }

  return (
    <Shell>
      {posture === 'everyday' ? (
        <Routes>
          <Route path="/" element={<EverydayHome onOpenExternalRequest={setExternalInvoice} />} />
          <Route path="/friends" element={<EverydayFriends />} />
          <Route path="/savings" element={<EverydaySavings />} />
          <Route path="/activity" element={<ActivityScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/test" element={<EverydayTest />} />
          <Route path="*" element={<EverydayHome onOpenExternalRequest={setExternalInvoice} />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/manage/custom-contracts" element={<CustomContracts />} />
          <Route path="/accounts/:counterpartyId" element={<AccountDetail />} />
          <Route path="/pay" element={<Pay />} />
          <Route path="/swap" element={<Swap />} />
          <Route path="/receive" element={<Receive />} />
          <Route path="/move" element={<Move />} />
          <Route path="/sovereignty" element={<Sovereignty />} />
          <Route path="/manage" element={<Manage />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/lend" element={<Lending />} />
          <Route path="/ownership" element={<Ownership />} />
          <Route path="/activity" element={<ActivityScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Home />} />
        </Routes>
      )}
      {posture === 'everyday' && externalInvoice ? (
        <ExternalRequestSheet rawInvoice={externalInvoice} onClose={() => setExternalInvoice(null)} />
      ) : null}
      {posture === 'pro' ? <PaymentReceiptSheet /> : null}
    </Shell>
  );
}
