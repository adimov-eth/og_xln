import { useEffect, useState, type FormEvent } from 'react';
import { readStewardPin, writeStewardPin, type StewardPin as Pin } from '@xln/frontend/lib/governance/steward-request';
import { useApp } from '../../runtime/store';
import '../sign-sheets.css';

const storage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/**
 * The person pins the steward whose signed requests this wallet will open. Pinning happens
 * here only, never from a link. The pin lives on this device; after a reset, requests are
 * refused until the person pins again.
 */
export function StewardPin() {
  const entityId = useApp(s => s.activeEntityId);
  const [pin, setPin] = useState<Pin | null>(null);
  const [stewardEntityId, setStewardEntityId] = useState('');
  const [stewardSigner, setStewardSigner] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setPin(entityId ? readStewardPin(storage(), entityId) : null);
  }, [entityId]);

  if (!entityId) return null;

  const save = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const store = storage();
    if (!store) {
      setError('This browser does not allow saving a steward on this device.');
      return;
    }
    try {
      writeStewardPin(store, entityId, { stewardEntityId, stewardSigner, label, pinnedAt: Date.now() });
      setPin(readStewardPin(store, entityId));
      setStewardEntityId('');
      setStewardSigner('');
      setLabel('');
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : String(cause);
      setError(code === 'STEWARD_PIN_SIGNER_INVALID' ? 'The signer must be a 0x address (40 hex digits).' : 'The steward must be a 0x Entity id (64 hex digits).');
    }
  };

  const unpin = () => {
    const store = storage();
    if (store) writeStewardPin(store, entityId, null);
    setPin(null);
  };

  return (
    <div className="setting steward-pin" data-testid="steward-pin">
      <div>
        <div className="t">Steward</div>
        <div className="s">
          {pin
            ? `Requests signed by ${pin.label || 'this steward'} open as a sheet you sign or decline. Nothing is signed for you.`
            : 'Pin an agent Entity to read its signed requests. Without a pin, every request link is refused.'}
        </div>
        {pin ? (
          <dl className="steward-pin-facts">
            <dt>Entity</dt>
            <dd className="mono">{pin.stewardEntityId}</dd>
            <dt>Signer</dt>
            <dd className="mono">{pin.stewardSigner}</dd>
          </dl>
        ) : (
          <form className="steward-pin-form" onSubmit={save}>
            <label className="field">
              Label
              <input className="input" value={label} maxLength={40} onChange={event => setLabel(event.target.value)} data-testid="steward-pin-label" />
            </label>
            <label className="field">
              Steward Entity id
              <input className="input mono" required value={stewardEntityId} onChange={event => setStewardEntityId(event.target.value)} data-testid="steward-pin-entity" />
            </label>
            <label className="field">
              Steward signer address
              <input className="input mono" required value={stewardSigner} onChange={event => setStewardSigner(event.target.value)} data-testid="steward-pin-signer" />
            </label>
            {error ? <p role="alert">{error}</p> : null}
            <button className="btn sm" type="submit" data-testid="steward-pin-save">
              Pin steward
            </button>
          </form>
        )}
      </div>
      {pin ? (
        <button type="button" className="btn sm" onClick={unpin} data-testid="steward-unpin">
          Unpin
        </button>
      ) : null}
    </div>
  );
}
