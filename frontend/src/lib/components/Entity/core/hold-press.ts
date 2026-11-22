/**
 * Press-and-hold for a signature that raises risk, shared by both wallets.
 *
 * A finger or pointer holds for `holdMs`; releasing early cancels. Keyboard and assistive
 * technology get an armed second press instead: the first activation arms for `armMs`, a second
 * activation signs, the timeout disarms. Key repeat never signs: a held Enter or Space arms once.
 */
export type HoldPressPhase = 'idle' | 'holding' | 'armed' | 'done';

export type HoldPress = Readonly<{
  pointerDown: () => void;
  pointerRelease: () => void;
  activate: (repeat: boolean) => void;
  dispose: () => void;
}>;

export const createHoldPress = (options: Readonly<{
  holdMs?: number;
  armMs?: number;
  onChange: (phase: HoldPressPhase) => void;
  onConfirm: () => void;
}>): HoldPress => {
  const holdMs = options.holdMs ?? 1000;
  const armMs = options.armMs ?? 5000;
  let phase: HoldPressPhase = 'idle';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const set = (next: HoldPressPhase) => {
    phase = next;
    options.onChange(next);
  };
  const confirm = () => {
    clear();
    set('done');
    options.onConfirm();
  };
  return {
    pointerDown: () => {
      if (phase === 'done' || phase === 'holding') return;
      clear();
      set('holding');
      timer = setTimeout(confirm, holdMs);
    },
    pointerRelease: () => {
      if (phase !== 'holding') return;
      clear();
      set('idle');
    },
    activate: repeat => {
      if (repeat || phase === 'done' || phase === 'holding') return;
      if (phase === 'armed') {
        confirm();
        return;
      }
      set('armed');
      timer = setTimeout(() => set('idle'), armMs);
    },
    dispose: clear,
  };
};
