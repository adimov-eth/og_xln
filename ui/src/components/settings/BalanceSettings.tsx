import { Bar } from '../Bars';
import { clampUsdPerPx, USD_PER_PX_MAX, USD_PER_PX_MIN, useApp, type PlaceKey } from '../../runtime/store';

const PRESETS = [1, 2, 5, 10, 25, 100, 1000];
const LOG_MIN = Math.log10(USD_PER_PX_MIN);
const LOG_MAX = Math.log10(USD_PER_PX_MAX);

const sliderToUsd = (value: number): number =>
  clampUsdPerPx(Math.pow(10, LOG_MIN + ((LOG_MAX - LOG_MIN) * value) / 1000));
const usdToSlider = (usd: number): number => Math.round(((Math.log10(usd) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 1000);
const roundUsd = (usd: number): number => (usd >= 10 ? Math.round(usd) : Math.round(usd * 10) / 10);

const PLACES: Array<{ key: PlaceKey; title: string; detail: string }> = [
  {
    key: 'onchain',
    title: 'On-chain wallet',
    detail: 'Tokens held by your signer on the chain itself. Slow, fully yours.',
  },
  { key: 'reserve', title: 'Reserve', detail: 'Escrowed in the Depository. Enforceable on-chain, funds collateral.' },
  { key: 'accounts', title: 'Accounts', detail: 'Bilateral credit and collateral with hubs and people. Instant.' },
];

const PREVIEW_AMOUNTS = [100, 1_000, 10_000, 100_000];

/** The scale, shown as money: the same bar the whole wallet draws. */
export function ScalePreview({ usdPerPx }: { usdPerPx: number }) {
  return (
    <div className="card">
      <h3 className="caps">At this scale</h3>
      {PREVIEW_AMOUNTS.map(amount => (
        <div key={amount} style={{ marginTop: 12 }}>
          <div className="kv" style={{ padding: '0 0 6px', border: 0 }}>
            <span className="k">${amount.toLocaleString('en-US')}</span>
            <span className="v num" style={{ color: 'var(--ink-3)' }}>
              {Math.max(1, Math.round(amount / usdPerPx)).toLocaleString('en-US')} px
            </span>
          </div>
          <Bar segments={[{ usd: amount, kind: 'credit' }]} height={6} />
        </div>
      ))}
      <p className="note" style={{ marginTop: 14 }}>
        A bar wider than its card fades out at the edge. Raise dollars per pixel to fit big balances; lower it to see
        small payments.
      </p>
    </div>
  );
}

export function BalanceSettings() {
  const usdPerPx = useApp(s => s.usdPerPx);
  const setUsdPerPx = useApp(s => s.setUsdPerPx);
  const scaleMode = useApp(s => s.scaleMode);
  const setScaleMode = useApp(s => s.setScaleMode);
  const places = useApp(s => s.places);
  const setPlaceVisible = useApp(s => s.setPlaceVisible);
  return (
    <>
      <details className="card" style={{ marginTop: 0 }} data-testid="settings-advanced">
        <summary className="caps" style={{ cursor: 'pointer' }}>
          Advanced · bar scale{' '}
          <span className="more num" style={{ marginLeft: 8 }}>
            1 px = ${roundUsd(usdPerPx)}
          </span>
        </summary>
        <div className="setting first" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
          <div>
            <div className="t">What one pixel of bar is worth</div>
            <div className="s">
              Every bar in the wallet is drawn to this one scale, so amounts stay comparable at a glance.
              {scaleMode === 'auto'
                ? ' Auto follows your largest balance; pick a value to pin it.'
                : ' Pinned; choose Auto to follow your largest balance.'}
            </div>
          </div>
          <div className="scale-row">
            <input
              type="range"
              min={0}
              max={1000}
              value={usdToSlider(usdPerPx)}
              onChange={event => setUsdPerPx(roundUsd(sliderToUsd(Number(event.target.value))))}
              aria-label="Dollars per pixel"
            />
            <output className="num">1 px = ${roundUsd(usdPerPx)}</output>
          </div>
          <div className="chips">
            <button
              type="button"
              className={scaleMode === 'auto' ? 'active' : ''}
              onClick={() => setScaleMode('auto')}
              title="Fit the largest bar on Home to the track"
            >
              Auto
            </button>
            {PRESETS.map(value => (
              <button
                key={value}
                type="button"
                className={scaleMode === 'fixed' && usdPerPx === value ? 'active' : ''}
                onClick={() => setUsdPerPx(value)}
              >
                ${value}
              </button>
            ))}
          </div>
        </div>
      </details>

      <div className="sect">
        <h3 className="caps">Home</h3>
      </div>
      {PLACES.map((place, index) => (
        <div key={place.key} className={`setting${index === 0 ? ' first' : ''}`}>
          <div>
            <div className="t">{place.title}</div>
            <div className="s">{place.detail}</div>
          </div>
          <button
            type="button"
            className={`switch${places[place.key] ? ' on' : ''}`}
            role="switch"
            aria-checked={places[place.key]}
            aria-label={`Show ${place.title}`}
            onClick={() => setPlaceVisible(place.key, !places[place.key])}
          />
        </div>
      ))}
    </>
  );
}
