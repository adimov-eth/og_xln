import { useState } from 'react';
import {
  EVERYDAY_DESIGN_PREVIEW_STATES,
  splitMoneyDisplay,
  type EverydayDesignPreviewId,
} from '@xln/frontend/lib/everyday/wallet-posture';

/**
 * Interactive design-system preview using the real Everyday tokens and classes.
 * Lives inside Settings so theme, surface material, and numeral typography changes
 * can be inspected across every Cash and Savings state without leaving the app.
 */
export function EverydayDesignPreview() {
  const [selectedId, setSelectedId] = useState<EverydayDesignPreviewId>('settled');
  const [truthOpen, setTruthOpen] = useState(false);

  const current =
    EVERYDAY_DESIGN_PREVIEW_STATES.find(entry => entry.id === selectedId)
    ?? EVERYDAY_DESIGN_PREVIEW_STATES[1]!;
  const parts = splitMoneyDisplay(current.amount);

  const previewEvState =
    current.id === 'arriving' ? 'arriving' : current.syncing ? 'syncing' : 'settled';

  return (
    <div
      className="everyday-preview-stage"
      data-ev-state={previewEvState}
      data-testid="everyday-design-preview"
    >
      <div className="everyday-preview-pills" role="group" aria-label="Preview wallet state">
        {EVERYDAY_DESIGN_PREVIEW_STATES.map(entry => (
          <button
            key={entry.id}
            type="button"
            className="everyday-preview-pill"
            aria-pressed={entry.id === current.id}
            onClick={() => setSelectedId(entry.id)}
            data-testid={`everyday-preview-${entry.id}`}
          >
            {entry.tabLabel}
          </button>
        ))}
      </div>

      <span className="everyday-label">{current.heading}</span>
      <button
        type="button"
        className="everyday-balance-trigger"
        aria-expanded={truthOpen}
        onClick={() => setTruthOpen(open => !open)}
      >
        <div
          className={`everyday-cash-value${current.syncing ? ' is-syncing' : ''}${current.savings ? ' is-savings' : ''}`}
        >
          <span>{parts.major}</span>
          {parts.minor ? <span className="everyday-cents">{parts.minor}</span> : null}
          {parts.suffix ? <span className="everyday-unit-suffix">{parts.suffix}</span> : null}
        </div>
      </button>

      {current.sublineKind === 'delta-in' ? (
        <p className="everyday-cash-delta">{current.subline}</p>
      ) : (
        <p className="everyday-note">{current.subline}</p>
      )}

      {truthOpen ? <p className="everyday-balance-truth">{current.truth}</p> : null}

      {current.arrivingAmount ? (
        <span className="everyday-arriving-pill">{current.arrivingAmount}</span>
      ) : null}

      {current.showActions ? (
        <div className="everyday-actions" aria-hidden="true">
          <span className="btn primary">Pay</span>
          <span className="btn">Request</span>
          <span className="btn">Cash out</span>
        </div>
      ) : null}
    </div>
  );
}
