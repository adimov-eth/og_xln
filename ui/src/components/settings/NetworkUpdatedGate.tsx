import { useState } from 'react';
import { RESET_CONFIRMATION, RESET_WARNING } from '@xln/frontend/lib/utils/control/resetBrowserData';
import { resetReactLocalData } from '../../runtime/deploy-version';

/**
 * The deployment changed under saved state on a network that is not disposable. As in the Svelte wallet, the only
 * way forward deletes the wallets on this device, keys included, so it takes the typed phrase; the versions are the evidence.
 */
export function NetworkUpdatedGate({ storedVersion, currentVersion }: { storedVersion: string; currentVersion: string }) {
  const [resetting, setResetting] = useState(false);
  const [failed, setFailed] = useState(false);

  const reset = (): void => {
    if (resetting) return;
    const confirmation = window.prompt(RESET_WARNING);
    if (confirmation !== RESET_CONFIRMATION) return;
    setResetting(true);
    setFailed(false);
    void resetReactLocalData(confirmation).catch(failure => {
      console.error('[reset] reset local data failed', failure);
      setResetting(false);
      setFailed(true);
    });
  };

  return (
    <div className="gate">
      <div className="gate-sheet">
        <h1 className="gate-title">Network updated</h1>
        <p className="gate-sub muted">
          The data saved on this device belongs to an earlier version of the network and can't be opened here.
          Resetting deletes the wallets saved on this device; have your recovery phrase or backup file ready to get
          them back.
        </p>
        <button
          type="button"
          className="btn reset-action"
          disabled={resetting}
          onClick={reset}
          data-testid="network-updated-reset"
        >
          {resetting ? 'Resetting…' : 'Reset local data'}
        </button>
        {failed ? (
          <p className="gate-error" role="alert">
            Couldn't finish resetting. Reload the page to continue.
          </p>
        ) : null}
        <code className="gate-diagnostic">
          {storedVersion} → {currentVersion}
        </code>
      </div>
    </div>
  );
}
