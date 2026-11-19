import { useState } from 'react';
import { EVERYDAY_COPY } from '@xln/frontend/lib/everyday/wallet-posture';
import { CopyId } from '../components/CopyId';
import { EverydaySettingsPanel } from '../components/everyday/EverydaySettingsPanel';
import { Networks } from '../components/Networks';
import { PageHead } from '../components/PageHead';
import { Appearance } from '../components/settings/Appearance';
import { BalanceSettings, ScalePreview } from '../components/settings/BalanceSettings';
import { Consensus } from '../components/settings/Consensus';
import { Profile } from '../components/settings/Profile';
import { StackManager } from '../components/settings/StackManager';
import { Vault } from '../components/settings/Vault';
import { getAdapter, getEmbeddedEnv } from '../runtime/adapter';
import { resetReactRetiredTestnetState } from '../runtime/deploy-version';
import { useApp } from '../runtime/store';
import { useWalletPosture } from '../runtime/use-everyday-wallet';
import { peekXLN } from '../runtime/xln-loader';

export function SettingsScreen() {
  const { posture, setPosture } = useWalletPosture();
  const [section, setSection] = useState<'general' | 'consensus'>('general');
  const height = useApp(s => s.height);
  const usdPerPx = useApp(s => s.usdPerPx);
  const toast = useApp(s => s.toast);
  const adapter = getAdapter();
  const [diagnostics, setDiagnostics] = useState('');
  const [resetting, setResetting] = useState(false);

  const clearTestData = (): void => {
    if (resetting) return;
    setResetting(true);
    void resetReactRetiredTestnetState().catch(failure => {
      setResetting(false);
      toast(failure instanceof Error ? failure.message : EVERYDAY_COPY.flows.resetDemo.failed, 'danger');
    });
  };

  if (posture === 'everyday') {
    return (
      <div className="everyday-screen fade-in">
        <PageHead title="Settings" sub="Profile, backups, theme, and Pro tools." />
        <EverydaySettingsPanel />
      </div>
    );
  }

  const inspect = () => {
    const env = getEmbeddedEnv();
    if (!env) return setDiagnostics('No local runtime');
    const infra = env.infrastructure;
    const p2p = peekXLN()?.getP2P(env);
    setDiagnostics(
      JSON.stringify(
        {
          height: env.state.height,
          phase: infra?.lifecyclePhase,
          loopActive: infra?.loopActive,
          halted: infra?.halted,
          fatal: infra?.fatalDebugPayload?.message,
          paused: infra?.persistencePaused,
          quiescing: infra?.persistenceQuiescing,
          inputsReady: infra?.entityInputsReady,
          networkInbox: env.networkInbox?.length,
          peers: p2p?.getDirectPeerState(),
          queues: p2p?.getQueueState(),
          accounts: [...env.state.eReplicas.values()].flatMap(entity =>
            [...entity.state.accounts].map(([id, account]) => ({
              owner: entity.entityId,
              peer: id,
              height: account.currentHeight,
              pending: account.pendingFrame?.height,
              mempool: account.mempool.length,
            })),
          ),
        },
        null,
        2,
      ),
    );
  };

  return (
    <div className="screen fade-in">
      <PageHead title="Settings" eyebrow="Wallet" sub="Identity, appearance, the guided tour, runtime and vault." />
      <div className="segc" role="group" aria-label="Settings sections" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className={section === 'general' ? 'active' : ''}
          aria-pressed={section === 'general'}
          onClick={() => setSection('general')}
        >
          General
        </button>
        <button
          type="button"
          className={section === 'consensus' ? 'active' : ''}
          data-testid="settings-consensus-tab"
          aria-pressed={section === 'consensus'}
          onClick={() => setSection('consensus')}
        >
          Consensus
        </button>
      </div>
      {section === 'consensus' ? (
        <Consensus />
      ) : (
        <div className="two-col">
          <div className="flat-col">
            <div className="setting first">
              <div>
                <div className="t">Trading &amp; operator tools (Pro)</div>
                <div className="s">Turn off to return to the calm Everyday wallet view.</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={posture === 'pro'}
                aria-label="Trading and operator tools (Pro)"
                className="everyday-switch"
                onClick={() => setPosture('everyday')}
                data-testid="toggle-pro-mode"
              >
                <span className="everyday-switch-track">
                  <span className="everyday-switch-thumb" />
                </span>
              </button>
            </div>
            <div className="setting">
              <div>
                <div className="t">Reset test network data</div>
                <div className="s">Clears retired testnet state while preserving your vault keys.</div>
              </div>
              <button
                type="button"
                className="btn sm"
                disabled={resetting}
                onClick={clearTestData}
                data-testid="settings-clear-test-data"
              >
                {resetting
                  ? EVERYDAY_COPY.flows.resetDemo.pending
                  : EVERYDAY_COPY.flows.resetDemo.before}
              </button>
            </div>
            <Profile />
            <Appearance />
            <BalanceSettings />
            <div className="sect">
              <h3 className="caps">Runtime</h3>
            </div>
            <Networks />
            <StackManager />
            <div className="setting first">
              <div className="t">Mode</div>
              <span className="muted">{adapter?.mode ?? '—'}</span>
            </div>
            <div className="setting" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <div className="t">Runtime id</div>
              <CopyId value={adapter ? adapter.runtimeId : ''} label="Runtime id" full />
            </div>
            <div className="setting">
              <div className="t">Frame</div>
              <span className="mono muted">#{height.toLocaleString('en-US')}</span>
            </div>

            <details className="disclosure">
              <summary>Connection diagnostics</summary>
              <button type="button" className="btn sm" onClick={inspect}>
                Inspect connection
              </button>
              <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{diagnostics}</pre>
            </details>
            <Vault />
          </div>
          <div className="aside">
            <ScalePreview usdPerPx={usdPerPx} />
          </div>
        </div>
      )}
    </div>
  );
}
