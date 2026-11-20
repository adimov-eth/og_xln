import { armedAttribute } from '@xln/frontend/lib/utils/control/armed-press';
import { EVERYDAY_COPY } from '@xln/frontend/lib/everyday/wallet-posture';
import { useClearTestData } from './useClearTestData';

/** The deployment changed under saved state: one deliberate, two-press way forward, with the versions as evidence. */
export function NetworkUpdatedGate({ storedVersion, currentVersion }: { storedVersion: string; currentVersion: string }) {
  const reset = useClearTestData();
  return (
    <div className="gate">
      <div className="gate-sheet">
        <h1 className="gate-title">Network updated</h1>
        <p className="gate-sub muted">
          The data saved on this device belongs to an earlier version of the network and can't be opened. Save your
          backup, then clear it. Your login stays.
        </p>
        <button
          type="button"
          className={reset.armed || reset.resetting ? 'btn danger reset-action' : 'btn reset-action'}
          disabled={reset.resetting}
          onClick={reset.press}
          onBlur={reset.disarm}
          data-armed={armedAttribute(reset.arm)}
          data-testid="settings-clear-test-data"
        >
          {reset.label}
        </button>
        <span className="sr-only" role="status">
          {reset.armed ? 'Press again to clear test data. This cannot be undone.' : ''}
        </span>
        {reset.failed ? (
          <p className="gate-error" role="alert">
            {EVERYDAY_COPY.flows.resetDemo.failed}
          </p>
        ) : null}
        <code className="gate-diagnostic">
          {storedVersion} → {currentVersion}
        </code>
      </div>
    </div>
  );
}
