import { afterEach, expect, test } from 'bun:test';
import {
  checkReactDeployVersion,
  DEPLOY_VERSION_KEY,
  isResettingRetiredTestnet,
  resetReactRetiredTestnetState,
  resolveReactRedirectPath,
  subscribeRetiredTestnetReset,
} from './deploy-version';

const prevStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const prevSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
const prevIdb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
const prevWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

function installBrowserMocks(opts: { databases?: () => Promise<Array<{ name?: string }>> }) {
  const ls = new Map<string, string>();
  const ss = new Map<string, string>();
  const replaced: string[] = [];
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      length: 0,
      key: () => null,
      getItem: (k: string) => ls.get(k) ?? null,
      setItem: (k: string, v: string) => { ls.set(k, v); },
      removeItem: (k: string) => { ls.delete(k); },
    },
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    writable: true,
    value: {
      length: 0,
      key: () => null,
      getItem: (k: string) => ss.get(k) ?? null,
      setItem: (k: string, v: string) => { ss.set(k, v); },
      removeItem: (k: string) => { ss.delete(k); },
      clear: () => ss.clear(),
    },
  });
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    writable: true,
    value: {
      databases: opts.databases ?? (async () => []),
      deleteDatabase: () => ({ onsuccess: null, onerror: null, onblocked: null }),
    },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: {
      location: {
        pathname: '/ui/',
        hostname: 'localhost',
        replace: (url: string) => replaced.push(url),
      },
    },
  });
  return { replaced };
}

afterEach(() => {
  const restore = (key: string, desc: PropertyDescriptor | undefined) => {
    if (desc) Object.defineProperty(globalThis, key, desc);
    else Reflect.deleteProperty(globalThis, key);
  };
  restore('localStorage', prevStorage);
  restore('sessionStorage', prevSession);
  restore('indexedDB', prevIdb);
  restore('window', prevWindow);
});

test('resetReactRetiredTestnetState deduplicates concurrent calls, notifies listeners, and recovers on failure', async () => {
  let dbCalls = 0;
  let resolveDb!: (dbs: Array<{ name?: string }>) => void;
  let rejectNext = true;
  const { replaced } = installBrowserMocks({
    databases: () => {
      dbCalls += 1;
      return new Promise((resolve, reject) => {
        resolveDb = dbs => (rejectNext ? reject(new Error('IDB_TRANSIENT')) : resolve(dbs));
      });
    },
  });

  const states: boolean[] = [];
  const off = subscribeRetiredTestnetReset(() => states.push(isResettingRetiredTestnet()));
  try {
    expect(isResettingRetiredTestnet()).toBe(false);
    const p1 = resetReactRetiredTestnetState('/ui/');
    const p2 = resetReactRetiredTestnetState('/ui/');
    expect(p1).toBe(p2);
    expect(isResettingRetiredTestnet()).toBe(true);
    while (dbCalls < 1) await Bun.sleep(1);

    resolveDb([]);
    await expect(p1).rejects.toThrow('IDB_TRANSIENT');
    expect(isResettingRetiredTestnet()).toBe(false);
    expect(dbCalls).toBe(1);
    expect(states).toEqual([true, false]);

    rejectNext = false;
    const p3 = resetReactRetiredTestnetState('/ui/');
    while (dbCalls < 2) await Bun.sleep(1);
    resolveDb([]);
    await p3;
    expect(dbCalls).toBe(2);
    expect(isResettingRetiredTestnet()).toBe(false);
    expect(replaced).toEqual(['/ui/']);
    expect(states).toEqual([true, false, true, false]);
  } finally {
    off();
  }
});

test('checkReactDeployVersion handles non-OK HTTP, JSON parse error, non-object payloads, empty versions, alternate keys, and localDisposable', async () => {
  const storageMap = new Map<string, string>();
  const storage = {
    getItem: (k: string) => storageMap.get(k) ?? null,
    setItem: (k: string, v: string) => { storageMap.set(k, v); },
  };

  expect(await checkReactDeployVersion({
    fetchFn: async () => new Response(JSON.stringify({ deployVersion: 'v1' }), { status: 503 }),
    storage,
    hostname: 'xln.finance',
    isDev: false,
  })).toEqual({ status: 'offline', ephemeralTestnet: false });

  expect(await checkReactDeployVersion({
    fetchFn: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('HTML 502'); } } as unknown as Response),
    storage,
    hostname: 'localhost',
    isDev: true,
  })).toEqual({ status: 'offline', ephemeralTestnet: true });

  for (const body of [null, [], { deployVersion: '   ', networkVersion: '', version: '' }]) {
    expect(await checkReactDeployVersion({
      fetchFn: async () => ({ ok: true, status: 200, json: async () => body } as unknown as Response),
      storage,
      hostname: 'xln.finance',
      isDev: false,
    })).toEqual({ status: 'offline', ephemeralTestnet: false });
  }

  // networkVersion alternate key + localDisposable overriding ephemeralTestnet: false
  expect(await checkReactDeployVersion({
    fetchFn: async () => ({ ok: true, status: 200, json: async () => ({ networkVersion: 'net-2', ephemeralTestnet: false }) } as unknown as Response),
    storage,
    hostname: 'localhost',
    isDev: true,
  })).toEqual({ status: 'ok', ephemeralTestnet: true });
  expect(storageMap.get(DEPLOY_VERSION_KEY)).toBe('net-2');

  // version alternate key
  storageMap.clear();
  expect(await checkReactDeployVersion({
    fetchFn: async () => ({ ok: true, status: 200, json: async () => ({ version: 'ver-3', ephemeralTestnet: false }) } as unknown as Response),
    storage,
    hostname: 'xln.finance',
    isDev: false,
  })).toEqual({ status: 'ok', ephemeralTestnet: false });
  expect(storageMap.get(DEPLOY_VERSION_KEY)).toBe('ver-3');

  expect(resolveReactRedirectPath('ui', '/')).toBe('/ui/');
});
