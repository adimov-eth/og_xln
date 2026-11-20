import { useEffect, useMemo, useState } from 'react';
import { createArmedPress, type ArmState } from '@xln/frontend/lib/utils/control/armed-press';
import { EVERYDAY_COPY } from '@xln/frontend/lib/everyday/wallet-posture';
import { resetReactRetiredTestnetState } from '../../runtime/deploy-version';
import { useApp } from '../../runtime/store';

const copy = EVERYDAY_COPY.flows.resetDemo;

/** Clearing test data is irreversible, so it takes two deliberate presses (see createArmedPress). */
export function useClearTestData(): {
  arm: ArmState;
  armed: boolean;
  resetting: boolean;
  label: string;
  failed: boolean;
  press: () => void;
  disarm: () => void;
} {
  const toast = useApp(s => s.toast);
  const [arm, setArm] = useState<ArmState>('idle');
  const [resetting, setResetting] = useState(false);
  const [failed, setFailed] = useState(false);
  const machine = useMemo(() => createArmedPress(setArm), []);
  useEffect(() => machine.disarm, [machine]);

  const press = (): void => {
    if (resetting || !machine.press()) return;
    setResetting(true);
    setFailed(false);
    void resetReactRetiredTestnetState().catch(failure => {
      setResetting(false);
      setFailed(true);
      console.error('[reset] clear test data failed', failure);
      toast(copy.failed, 'danger');
    });
  };

  const armed = arm !== 'idle';
  const label = resetting ? copy.pending : armed ? copy.confirm : copy.before;
  return { arm, armed, resetting, label, failed, press, disarm: machine.disarm };
}
