import { useState } from 'react';
import { Sheet } from '../Sheet';
import { Icon } from '../Icons';
import { useApp } from '../../runtime/store';
import { disconnectAdapter } from '../../runtime/adapter';

export function Vault() {
  const vaults = useApp(s => s.vaults);
  const activeVaultId = useApp(s => s.activeVaultId);
  const sessionSeeds = useApp(s => s.sessionSeeds);
  const lockAll = useApp(s => s.lockAll);
  const removeVault = useApp(s => s.removeVault);
  const toast = useApp(s => s.toast);
  const [revealing, setRevealing] = useState(false);
  const [revealConfirmed, setRevealConfirmed] = useState(false);

  const activeVault = vaults.find(v => v.id === activeVaultId) ?? null;
  const seed = activeVaultId ? sessionSeeds[activeVaultId] : undefined;

  const lock = (): void => {
    lockAll();
    disconnectAdapter();
  };

  return (
    <>
      <div className="sect">
        <h3 className="caps">Vault</h3>
      </div>
      <div className="setting first">
        <div>
          <div className="t">{activeVault?.name ?? '—'}</div>
          <div className="s">{activeVault?.kind ?? ''}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        {seed && (
          <button type="button" className="btn ghost sm" onClick={() => setRevealing(true)}>
            <Icon name="eye" size={14} /> Reveal recovery phrase
          </button>
        )}
        <button type="button" className="btn ghost sm" onClick={lock}>
          <Icon name="lock" size={14} /> Lock
        </button>
        {activeVault && activeVault.kind !== 'sandbox' && (
          <button
            type="button"
            className="btn danger sm"
            onClick={() => {
              removeVault(activeVault.id);
              lock();
              toast('Vault forgotten on this device. The name and passphrase still recover it anywhere.');
            }}
          >
            <Icon name="trash" size={14} /> Forget vault
          </button>
        )}
      </div>

      {revealing && seed && (
        <Sheet
          title="Recovery phrase"
          onClose={() => {
            setRevealing(false);
            setRevealConfirmed(false);
          }}
        >
          <p className="note">Anyone with these words controls the money. Read them in private.</p>
          {!revealConfirmed ? (
            <button type="button" className="btn" onClick={() => setRevealConfirmed(true)} data-testid="reveal-confirm">
              <Icon name="eye" size={14} /> I am alone, show the words
            </button>
          ) : (
            <p className="mono" style={{ fontSize: 14, lineHeight: 1.9, userSelect: 'all' }}>
              {seed}
            </p>
          )}
          <button
            type="button"
            className="btn ghost"
            disabled={!revealConfirmed}
            onClick={() => {
              void navigator.clipboard.writeText(seed).then(
                () => toast('Copied. Clear your clipboard after use.'),
                () => toast('Could not copy the recovery phrase.', 'danger'),
              );
            }}
          >
            <Icon name="copy" size={14} /> Copy
          </button>
        </Sheet>
      )}
    </>
  );
}
