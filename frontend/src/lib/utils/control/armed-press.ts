export type ArmState = 'idle' | 'arming' | 'armed';

/** A double tap must not count as a confirmation: presses are ignored until the armed state settles. */
export const ARM_SETTLE_MS = 400;
/** An armed action lapses back to rest on its own. */
export const ARM_WINDOW_MS = 4_000;

/**
 * Irreversible actions take two deliberate presses. The first press arms, presses during the settle
 * beat are ignored, and a press while armed confirms. `press` returns true only for the confirming press.
 */
export function createArmedPress(onChange: (state: ArmState) => void): {
  press: () => boolean;
  disarm: () => void;
} {
  let state: ArmState = 'idle';
  let timers: ReturnType<typeof setTimeout>[] = [];
  const set = (next: ArmState): void => {
    state = next;
    onChange(next);
  };
  const disarm = (): void => {
    timers.forEach(clearTimeout);
    timers = [];
    if (state !== 'idle') set('idle');
  };
  const press = (): boolean => {
    if (state === 'arming') return false;
    if (state === 'idle') {
      set('arming');
      timers = [
        setTimeout(() => {
          if (state === 'arming') set('armed');
        }, ARM_SETTLE_MS),
        setTimeout(disarm, ARM_WINDOW_MS),
      ];
      return false;
    }
    disarm();
    return true;
  };
  return { press, disarm };
}

export function armedAttribute(state: ArmState): 'arming' | 'true' | undefined {
  return state === 'idle' ? undefined : state === 'arming' ? 'arming' : 'true';
}
