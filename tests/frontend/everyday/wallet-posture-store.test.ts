import { expect, mock, test } from 'bun:test';

test('walletPostureStore strips ?mode=pro on toggle, refreshes on 0->1 subscribe, and never drops <100ms updates', async () => {
  const replaceCalls: string[] = [];
  mock.module('$app/navigation', () => ({
    replaceState: (url: string) => replaceCalls.push(url),
  }));
  const ls = new Map<string, string>();
  const prevStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const prevWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let search = '?mode=pro';
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (k: string) => ls.get(k) ?? null,
      setItem: (k: string, v: string) => {
        ls.set(k, v);
      },
      removeItem: (k: string) => {
        ls.delete(k);
      },
    },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: {
      location: {
        get href() {
          return `http://localhost:8080/app${search}`;
        },
        get search() {
          return search;
        },
        pathname: '/app',
        hash: '',
      },
      history: { state: null, replaceState: () => {} },
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
  try {
    const { walletPosture, setWalletPosture, resolveEffectivePosture } = await import(
      '../../../frontend/src/lib/stores/everyday/walletPostureStore'
    );

    expect(resolveEffectivePosture('everyday', '?mode=pro')).toBe('pro');
    expect(resolveEffectivePosture('everyday', '?mode=%20PRO%20')).toBe('pro');
    expect(resolveEffectivePosture('pro', '?mode=everyday')).toBe('everyday');
    expect(resolveEffectivePosture('pro', '')).toBe('pro');

    // Subscribe, toggle while ?mode=pro is in URL, unsubscribe immediately (<100ms)
    const seen1: string[] = [];
    const unsub1 = walletPosture.subscribe(v => seen1.push(v));
    search = '';
    setWalletPosture('everyday');
    unsub1();

    // Immediate resubscribe AND post-150ms resubscribe both see 'everyday' (never stale 'pro')
    let immediate = '';
    const unsubImmediate = walletPosture.subscribe(v => {
      immediate = v;
    });
    unsubImmediate();

    await Bun.sleep(150);
    let delayed = '';
    const unsubDelayed = walletPosture.subscribe(v => {
      delayed = v;
    });
    unsubDelayed();

    expect(replaceCalls).toEqual([]);
    expect(ls.get('xln-wallet-posture')).toBe('everyday');
    expect(immediate).toBe('everyday');
    expect(delayed).toBe('everyday');

    // Now test ?mode=pro URL stripping when ?mode=pro is present during toggle
    search = '?mode=pro';
    const unsubStrip = walletPosture.subscribe(() => {});
    setWalletPosture('everyday');
    unsubStrip();
    expect(replaceCalls).toEqual(['/app']);

    // Writing storage while 0 subscribers are active refreshes on next 0->1 subscribe
    search = '';
    ls.set('xln-wallet-posture', 'pro');
    let refreshed = '';
    const unsubRefresh = walletPosture.subscribe(v => {
      refreshed = v;
    });
    unsubRefresh();
    expect(refreshed).toBe('pro');
  } finally {
    if (prevStorage) Object.defineProperty(globalThis, 'localStorage', prevStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    if (prevWindow) Object.defineProperty(globalThis, 'window', prevWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
