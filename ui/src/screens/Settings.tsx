import { Networks } from '../components/Networks';
import { CopyId } from '../components/CopyId';
import { Appearance } from '../components/settings/Appearance';
import { BalanceSettings, ScalePreview } from '../components/settings/BalanceSettings';
import { Profile } from '../components/settings/Profile';
import { Vault } from '../components/settings/Vault';
import { getAdapter } from '../runtime/adapter';
import { useApp } from '../runtime/store';

export function SettingsScreen() {
  const height = useApp(s => s.height);
  const usdPerPx = useApp(s => s.usdPerPx);
  const adapter = getAdapter();
  return (
    <div className="screen fade-in">
      <div className="screen-header">
        <span className="screen-title">Settings</span>
      </div>
      <div className="two-col">
        <div>
          <Profile />
          <Appearance />
          <BalanceSettings />
          <div className="sect">
            <h3 className="caps">Runtime</h3>
          </div>
          <Networks />
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

          <Vault />
        </div>
        <div className="aside">
          <ScalePreview usdPerPx={usdPerPx} />
        </div>
      </div>
    </div>
  );
}
