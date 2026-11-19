import { useState } from 'react';
import {
  EVERYDAY_COPY,
  needsEverydayMotionPermission,
  requestEverydayMotionPermission,
} from '@xln/frontend/lib/everyday/wallet-posture';
import { lockEmbeddedRuntime } from '../../runtime/adapter';
import { resetReactRetiredTestnetState } from '../../runtime/deploy-version';
import { MATERIALS, NUMBER_FONTS } from '../../runtime/design';
import { useApp } from '../../runtime/store';
import { sendEntityTxs } from '../../runtime/tx';
import { useEverydayWallet, useWalletPosture } from '../../runtime/use-everyday-wallet';
import { Icon } from '../Icons';
import { Sheet } from '../Sheet';
import { EverydayDesignPreview } from './EverydayDesignPreview';
import { EverydayRecoveryNotice } from './EverydayRecoveryNotice';

export function EverydaySettingsPanel() {
  const { posture, setPosture } = useWalletPosture();
  const entityId = useApp(state => state.activeEntityId);
  const activeVaultId = useApp(state => state.activeVaultId);
  const sessionSeeds = useApp(state => state.sessionSeeds);
  const theme = useApp(state => state.theme);
  const setTheme = useApp(state => state.setTheme);
  const design = useApp(state => state.design);
  const setDesign = useApp(state => state.setDesign);
  const commandReady = useApp(state => state.commandReady);
  const toast = useApp(state => state.toast);
  const { wallet, projection } = useEverydayWallet(entityId);

  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [revealConfirmed, setRevealConfirmed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showMotionPrompt, setShowMotionPrompt] = useState(() => needsEverydayMotionPermission());

  const enableTiltGlare = async (): Promise<void> => {
    if (await requestEverydayMotionPermission()) setShowMotionPrompt(false);
  };

  const seed = activeVaultId ? sessionSeeds[activeVaultId] : undefined;

  const saveName = async (): Promise<void> => {
    const trimmed = displayName.trim();
    if (!trimmed || !wallet.entityId || !wallet.signerId || savingName) return;
    setSavingName(true);
    try {
      await sendEntityTxs(wallet.entityId, wallet.signerId, [
        {
          type: 'profile-update',
          data: {
            profile: {
              entityId: wallet.entityId,
              name: trimmed,
              bio: '',
              website: '',
            },
          },
        },
      ]);
      toast('Display name updated');
      setDisplayName('');
    } catch (failure) {
      toast(failure instanceof Error ? failure.message : 'Could not update display name.', 'danger');
    } finally {
      setSavingName(false);
    }
  };

  const clearTestData = (): void => {
    if (resetting) return;
    setResetting(true);
    void resetReactRetiredTestnetState().catch(failure => {
      setResetting(false);
      toast(failure instanceof Error ? failure.message : EVERYDAY_COPY.flows.resetDemo.failed, 'danger');
    });
  };

  return (
    <>
      <div className="everyday-panel">
        <span className="everyday-label">Display name</span>
        <div className="field-row">
          <input
            aria-label="Display name"
            className="input boxed"
            placeholder={wallet.name}
            value={displayName}
            onChange={event => setDisplayName(event.target.value)}
            data-testid="profile-name"
          />
          <button
            type="button"
            className="btn"
            disabled={savingName || !commandReady || !displayName.trim()}
            onClick={() => void saveName()}
            data-testid="profile-publish"
          >
            {savingName ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="everyday-panel">
        <span className="everyday-label">Backup &amp; protection</span>
        <EverydayRecoveryNotice
          disputes={projection.disputes}
          hasZeroL1Gas={projection.hasZeroL1Gas}
          testId="everyday-backup-status"
        />
        <div className="actions">
          {seed ? (
            <button type="button" className="btn" onClick={() => setRevealing(true)}>
              <Icon name="eye" size={16} />
              Reveal recovery phrase
            </button>
          ) : null}
          <button
            type="button"
            className="btn"
            onClick={() =>
              void lockEmbeddedRuntime().catch(failure =>
                toast(failure instanceof Error ? failure.message : 'Could not lock wallet.', 'danger'),
              )
            }
          >
            <Icon name="lock" size={16} />
            Lock
          </button>
        </div>
      </div>

      <div className="everyday-panel">
        <div className="everyday-panel-head">
          <span className="everyday-label">Appearance &amp; design</span>
          <span className="segc">
            <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>
              <Icon name="moon" size={14} /> Dark
            </button>
            <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>
              <Icon name="sun" size={14} /> Light
            </button>
          </span>
        </div>
        <div className="everyday-panel-head">
          <span className="everyday-row-sub">Surface</span>
          <span className="segc">
            {MATERIALS.map(entry => (
              <button
                key={entry.id}
                type="button"
                className={design.material === entry.id ? 'active' : ''}
                onClick={() => setDesign({ material: entry.id })}
                data-testid={`design-material-${entry.id}`}
              >
                {entry.title}
              </button>
            ))}
          </span>
        </div>
        <div className="everyday-panel-head">
          <span className="everyday-row-sub">Numbers</span>
          <span className="segc">
            {NUMBER_FONTS.map(entry => (
              <button
                key={entry.id}
                type="button"
                className={design.numbers === entry.id ? 'active' : ''}
                onClick={() => setDesign({ numbers: entry.id })}
                data-testid={`design-numbers-${entry.id}`}
              >
                {entry.title}
              </button>
            ))}
          </span>
        </div>
        {showMotionPrompt ? (
          <div className="everyday-panel-head">
            <span className="everyday-row-sub">Tilt glare</span>
            <button
              type="button"
              className="btn"
              onClick={() => void enableTiltGlare()}
              data-testid="everyday-enable-tilt"
            >
              Enable motion
            </button>
          </div>
        ) : null}
        <EverydayDesignPreview />
      </div>

      <div className="everyday-panel">
        <div className="everyday-panel-head">
          <div className="everyday-row-meta">
            <span className="everyday-row-title">Trading &amp; operator tools (Pro)</span>
            <span className="everyday-row-sub">
              Order books, capacity bars, manual transfers, and developer diagnostics.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={posture === 'pro'}
            aria-label="Trading and operator tools (Pro)"
            className="everyday-switch"
            onClick={() => setPosture(posture === 'pro' ? 'everyday' : 'pro')}
            data-testid="toggle-pro-mode"
          >
            <span className="everyday-switch-track">
              <span className="everyday-switch-thumb" />
            </span>
          </button>
        </div>
      </div>

      <div className="everyday-panel">
        <div className="everyday-panel-head">
          <div className="everyday-row-meta">
            <span className="everyday-row-title">Reset test network data</span>
            <span className="everyday-row-sub">Clears local test state while keeping your wallet login.</span>
          </div>
          <button
            type="button"
            className="btn"
            disabled={resetting}
            onClick={clearTestData}
            data-testid="settings-clear-test-data"
          >
            {resetting
              ? EVERYDAY_COPY.flows.resetDemo.pending
              : EVERYDAY_COPY.flows.resetDemo.before}
          </button>
        </div>
      </div>

      {revealing && seed ? (
        <Sheet
          title="Recovery phrase"
          onClose={() => {
            setRevealing(false);
            setRevealConfirmed(false);
          }}
        >
          <p className="everyday-note">Anyone with these words controls the money. Read them in private.</p>
          {!revealConfirmed ? (
            <button type="button" className="btn primary" onClick={() => setRevealConfirmed(true)} data-testid="reveal-confirm">
              <Icon name="eye" size={16} /> I am alone, show the words
            </button>
          ) : (
            <p className="mono" style={{ fontSize: 14, lineHeight: 1.9, userSelect: 'all' }}>{seed}</p>
          )}
          <button
            type="button"
            className="btn"
            disabled={!revealConfirmed}
            onClick={() =>
              void navigator.clipboard.writeText(seed).then(
                () => toast('Copied. Clear your clipboard after use.'),
                () => toast('Could not copy the recovery phrase.', 'danger'),
              )
            }
          >
            <Icon name="copy" size={16} /> Copy
          </button>
        </Sheet>
      ) : null}
    </>
  );
}
