export const EVERYDAY_COPY = {
  terms: {
    cash: { label: 'Cash', note: 'Your money, ready to spend or cash out anytime.' },
    arriving: { label: 'Arriving', note: 'Finishing automatically before it joins your Cash.' },
    people: { label: 'Friends & tabs', note: 'Shared bills and tabs with people you know.' },
    owed: { label: 'You owe', note: 'Settle up in one tap whenever you are ready.' },
    savings: {
      label: 'Savings',
      note: 'Lent to earn interest — not protected like Cash; separate from Cash and requires explicit consent.',
    },
  },
  flows: {
    pay: { before: 'Pay', pending: 'Sending...', done: 'Sent', failed: 'Not sent — your Cash is untouched.' },
    requestLink: {
      before: 'Request',
      pending: 'Creating request link...',
      done: 'Request link ready to share',
      failed: 'Could not create request link.',
    },
    settleTab: {
      before: 'Settle up',
      pending: 'Settling tab…',
      // Shown when the payment is accepted, before both legs settle; the tab row says when it is clear.
      done: 'Sent. The tab clears once both wallets confirm.',
      failed: 'Could not reach them — tab unchanged.',
    },
    splitTab: {
      before: 'Split a bill',
      pending: 'Sharing split...',
      done: 'Added to tab',
      failed: 'Split cancelled.',
    },
    cashOut: {
      before: 'Cash out',
      pending: 'Sending to your account...',
      done: 'Cashed out',
      failed: 'Cash out cancelled — balance unchanged.',
    },
    saveIn: {
      before: 'Add to Savings',
      pending: 'Moving to Savings...',
      done: 'Earning interest in Savings',
      failed: 'Stayed in Cash.',
    },
    saveOut: {
      before: 'Move to Cash',
      pending: 'Moving back to Cash...',
      done: 'Back in Cash',
      failed: 'Still in Savings — safe to retry.',
    },
    resetDemo: {
      before: 'Clear test data',
      confirm: 'Confirm clear',
      pending: 'Clearing…',
      done: 'Test data cleared; login kept.',
      failed: "Couldn't finish clearing. Reload the page to continue.",
    },
  },
  externalRequestSheet: {
    survival: 'Completed payments are final; shared tabs stay between you and the person you named.',
    warns: ['Only open a tab with someone you actually know and trust.'],
  },
} as const;

export type WalletPosture = 'everyday' | 'pro';

export const WALLET_POSTURE_STORAGE_KEY = 'xln-wallet-posture';

const listeners = new Set<(posture: WalletPosture) => void>();

export function parseWalletPostureParam(search?: string): WalletPosture | null {
  const raw =
    search !== undefined
      ? search
      : typeof window !== 'undefined'
        ? window.location.search
        : '';
  if (!raw) return null;
  const normalized = raw.startsWith('?') ? raw.slice(1) : raw;
  const mode = new URLSearchParams(normalized).get('mode')?.trim().toLowerCase();
  if (mode === 'pro') return 'pro';
  if (mode === 'everyday') return 'everyday';
  return null;
}

export function readWalletPosture(search?: string): WalletPosture {
  const paramMode = parseWalletPostureParam(search);
  if (paramMode !== null) return paramMode;
  if (typeof localStorage !== 'undefined') {
    try {
      if (localStorage.getItem(WALLET_POSTURE_STORAGE_KEY) === 'pro') return 'pro';
    } catch {
      // Storage may be unavailable in restricted contexts; default remains everyday.
    }
  }
  return 'everyday';
}

export function writeWalletPosture(posture: WalletPosture): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(WALLET_POSTURE_STORAGE_KEY, posture);
  }
  const effective = readWalletPosture();
  for (const listener of listeners) {
    listener(effective);
  }
}

export type SplitMoneyDisplay = {
  readonly major: string;
  readonly minor: string;
  readonly suffix: string;
};

/**
 * Splits a formatted money string (`$99.89`, `1.25 ETH`) into whole, fractional,
 * and trailing-unit spans so UI surfaces can render raised tabular cents while
 * keeping `innerText` identical to the original formatted string.
 */
export function splitMoneyDisplay(formatted: string): SplitMoneyDisplay {
  const match = formatted.match(/^([^\d.]*[\d,]+)(\.\d+)(.*)$/);
  if (!match) return { major: formatted, minor: '', suffix: '' };
  return { major: match[1] ?? formatted, minor: match[2] ?? '', suffix: match[3] ?? '' };
}

export type EverydayDesignPreviewId = 'empty' | 'settled' | 'arriving' | 'syncing' | 'savings';

export type EverydayDesignPreviewState = {
  readonly id: EverydayDesignPreviewId;
  readonly tabLabel: string;
  readonly heading: string;
  readonly amount: string;
  readonly subline: string;
  readonly sublineKind: 'muted' | 'delta-in';
  readonly truth: string;
  readonly arrivingAmount: string | null;
  readonly syncing: boolean;
  readonly savings: boolean;
  readonly showActions: boolean;
};

/** Canonical state fixtures shared by the React and Svelte Everyday design-system previews. */
export const EVERYDAY_DESIGN_PREVIEW_STATES: readonly EverydayDesignPreviewState[] = [
  {
    id: 'empty',
    tabLabel: '$0 Start',
    heading: 'Cash',
    amount: '$0.00',
    subline: 'Your money, ready to spend or cash out anytime.',
    sublineKind: 'muted',
    truth: 'Connected via Hub H1.',
    arrivingAmount: null,
    syncing: false,
    savings: false,
    showActions: true,
  },
  {
    id: 'settled',
    tabLabel: 'Settled',
    heading: 'Cash',
    amount: '$99.89',
    subline: '+$100.00, −$0.11 settle fee',
    sublineKind: 'delta-in',
    truth: 'Connected via Hub H1.',
    arrivingAmount: null,
    syncing: false,
    savings: false,
    showActions: true,
  },
  {
    id: 'arriving',
    tabLabel: 'Arriving',
    heading: 'Cash',
    amount: '$99.89',
    subline: 'Your money, ready to spend or cash out anytime.',
    sublineKind: 'muted',
    truth: 'Connected via Hub H1.',
    arrivingAmount: '+$25.00 arriving',
    syncing: false,
    savings: false,
    showActions: true,
  },
  {
    id: 'syncing',
    tabLabel: 'Syncing',
    heading: 'Cash',
    amount: '$99.89',
    subline: 'Syncing latest balance. Sending resumes in a moment.',
    sublineKind: 'muted',
    truth: 'Connected via Hub H1.',
    arrivingAmount: null,
    syncing: true,
    savings: false,
    showActions: true,
  },
  {
    id: 'savings',
    tabLabel: 'Savings',
    heading: 'Savings · separate from Cash',
    amount: '$250.00',
    subline: 'Lent out to earn interest — not protected like Cash.',
    sublineKind: 'muted',
    truth: 'Available Cash: $99.89 · Hub H1 Savings.',
    arrivingAmount: null,
    syncing: false,
    savings: true,
    showActions: false,
  },
] as const;

function getMotionPermissionRequest(): (() => Promise<'granted' | 'denied'>) | null {
  if (typeof window === 'undefined') return null;
  const ctor: unknown = Reflect.get(window, 'DeviceOrientationEvent');
  if (ctor === null || (typeof ctor !== 'object' && typeof ctor !== 'function')) return null;
  const fn: unknown = Reflect.get(ctor, 'requestPermission');
  return typeof fn === 'function' ? () => Promise.resolve(fn.call(ctor)) : null;
}

function hasDeviceOrientationCtor(): boolean {
  if (typeof window === 'undefined') return false;
  const ctor: unknown = Reflect.get(window, 'DeviceOrientationEvent');
  return ctor !== null && (typeof ctor === 'object' || typeof ctor === 'function');
}

/** True only on coarse-pointer browsers (iOS Safari) that gate `deviceorientation` behind a user-gesture prompt. */
export function needsEverydayMotionPermission(): boolean {
  if (typeof window === 'undefined') return false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarsePointer && getMotionPermissionRequest() !== null;
}

/** Requests iOS Safari motion permission inside a user tap and notifies active Everyday glare listeners. */
export async function requestEverydayMotionPermission(): Promise<boolean> {
  const fn = getMotionPermissionRequest();
  if (!fn) return true;
  try {
    const result = await fn();
    if (result === 'granted') {
      window.dispatchEvent(new Event('xln-everyday-motion-granted'));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Connects the Obsidian & Silver Everyday specular glare to device tilt
 * (`deviceorientation`) on phones and to the pointer on desktop: a few percent of
 * drift that settles within a second.
 * Respects `prefers-reduced-motion` and `forced-colors`, stops RAF at rest
 * (0% idle CPU), and never triggers unsolicited iOS permission dialogs.
 */
export function attachEverydayGlare(target: HTMLElement | null): () => void {
  if (!target || typeof window === 'undefined') return () => {};
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const forcedColors = window.matchMedia?.('(forced-colors: active)').matches;
  if (reducedMotion || forcedColors) return () => {};

  const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
  const rest = { x: 54, y: -12, angle: 128, pos: 46 };
  const goal = { ...rest };
  const cur = { ...rest };
  let rafId = 0;
  let hasOrientation = false;
  let listeningOrientation = false;
  // The light follows with a time constant, not a per-frame fraction: it arrives in about 3τ and
  // then stops dead, at any frame rate. A long tail of sub-pixel creep reads as the ground being alive.
  let tau = 200;
  let lastPaint = 0;

  const paint = (now: number = performance.now()): void => {
    rafId = 0;
    const dt = lastPaint ? Math.min(64, Math.max(0, now - lastPaint)) : 16;
    lastPaint = now;
    const k = 1 - Math.exp(-dt / tau);
    const settled =
      Math.abs(goal.x - cur.x) < 0.1 &&
      Math.abs(goal.y - cur.y) < 0.1 &&
      Math.abs(goal.angle - cur.angle) < 0.1 &&
      Math.abs(goal.pos - cur.pos) < 0.1;
    if (settled) {
      Object.assign(cur, goal);
      lastPaint = 0;
    } else {
      cur.x += (goal.x - cur.x) * k;
      cur.y += (goal.y - cur.y) * k;
      cur.angle += (goal.angle - cur.angle) * k;
      cur.pos += (goal.pos - cur.pos) * k;
      rafId = window.requestAnimationFrame(paint);
    }
    write('--ev-light-x', `${cur.x.toFixed(1)}%`);
    write('--ev-light-y', `${cur.y.toFixed(1)}%`);
    write('--ev-bevel-angle', `${cur.angle.toFixed(1)}deg`);
    write('--ev-glare-pos', `${cur.pos.toFixed(1)}%`);
  };

  // Each write restyles every ring, glint and streak below the target, so only real changes are written.
  const written = new Map<string, string>();
  const write = (name: string, value: string): void => {
    if (written.get(name) === value) return;
    written.set(name, value);
    target.style.setProperty(name, value);
  };

  // A held phone jitters by a fraction of a degree on every sensor tick. Goals that move less than the
  // deadband are ignored, so the loop rests instead of chasing noise for as long as the phone is held.
  const DEADBAND = 0.25;
  const aim = (x: number, y: number, angle: number, pos: number): void => {
    if (
      Math.abs(x - goal.x) < DEADBAND &&
      Math.abs(y - goal.y) < DEADBAND &&
      Math.abs(angle - goal.angle) < DEADBAND &&
      Math.abs(pos - goal.pos) < DEADBAND
    ) {
      return;
    }
    Object.assign(goal, { x, y, angle, pos });
    schedule();
  };

  const schedule = (): void => {
    if (!rafId && document.visibilityState !== 'hidden') {
      rafId = window.requestAnimationFrame(paint);
    }
  };

  const onOrientation = (event: DeviceOrientationEvent): void => {
    if (event.gamma === null || event.beta === null) return;
    hasOrientation = true;
    // Tilt nudges the light; it never swings it. Amplitudes are about a third of a full sweep.
    tau = 160;
    const nx = clamp(event.gamma / 36, -1, 1);
    const ny = clamp((event.beta - 45) / 32, -1, 1);
    aim(52 + nx * 6, -10 + ny * 4, 128 + nx * 5, 46 + nx * 5 - ny * 1.5);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (hasOrientation || event.pointerType === 'touch') return;
    // Pointer movement is barely felt: a few percent of drift, settled within a second.
    tau = 200;
    const nx = clamp((event.clientX / (window.innerWidth || 1)) * 2 - 1, -1, 1);
    const ny = clamp((event.clientY / (window.innerHeight || 1)) * 2 - 1, -1, 1);
    aim(54 + nx * 3, -12 + ny * 2, 128 + nx * 2, 46 + nx * 3 - ny * 0.75);
  };

  const onPointerLeave = (): void => {
    if (hasOrientation) return;
    Object.assign(goal, rest);
    schedule();
  };

  const bindOrientation = (): void => {
    if (listeningOrientation) return;
    listeningOrientation = true;
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
  };

  if (hasDeviceOrientationCtor() && !needsEverydayMotionPermission()) {
    bindOrientation();
  }
  window.addEventListener('xln-everyday-motion-granted', bindOrientation);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', onPointerLeave, { passive: true });

  return () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    if (listeningOrientation) window.removeEventListener('deviceorientation', onOrientation);
    window.removeEventListener('xln-everyday-motion-granted', bindOrientation);
    window.removeEventListener('pointermove', onPointerMove);
    document.documentElement.removeEventListener('mouseleave', onPointerLeave);
    target.style.removeProperty('--ev-light-x');
    target.style.removeProperty('--ev-light-y');
    target.style.removeProperty('--ev-bevel-angle');
    target.style.removeProperty('--ev-glare-pos');
  };
}

export function subscribeWalletPosture(listener: (posture: WalletPosture) => void): () => void {
  listeners.add(listener);
  if (typeof window === 'undefined') {
    return () => {
      listeners.delete(listener);
    };
  }
  const onStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === WALLET_POSTURE_STORAGE_KEY) {
      listener(readWalletPosture());
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}
