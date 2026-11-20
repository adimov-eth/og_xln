import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  clearBrowserRuntimeData,
  clearRetiredTestnetState,
  RESET_CONFIRMATION,
  RESET_WARNING,
  runRetiredTestnetReset,
} from '../../../frontend/src/lib/utils/control/resetBrowserData';
import {
  markRetiredTestnetRebootstrapRuntimes,
  resetEverything,
  resetRetiredTestnetState,
} from '../../../frontend/src/lib/utils/control/resetEverything';
import {
  clearRetiredTestnetRebootstrap,
  hasRetiredTestnetRebootstrap,
  RETIRED_TESTNET_REBOOTSTRAP_KEY,
} from '../../../frontend/src/lib/stores/vault/vault-recovery';

const appLayoutSource = readFileSync(join(import.meta.dir, '../../../frontend/src/routes/app/+layout.svelte'), 'utf8');

const replaceGlobal = (key: string, value: unknown): (() => void) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  return () => (previous ? Object.defineProperty(globalThis, key, previous) : Reflect.deleteProperty(globalThis, key));
};

const storage = (entries: Record<string, string>) => {
  const values = new Map(Object.entries(entries));
  return {
    values,
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, String(value));
    },
    removeItem: (key: string) => values.delete(key),
  };
};

test('reset deletes only named XLN stores and preserves other applications, caches and workers', async () => {
  const runtime = `level-js-db-0x${'1'.repeat(40)}-storage-current`;
  const owned = ['xln-vault-keys-v1', 'xln-runtime-command-journal-v1', runtime, 'level-js-db-default-wal'];
  const unrelated = ['vault', 'runtime', 'other-app', 'xln-unrecognized', 'level-js-db-other-app-wal'];
  const local = storage({
    'xln-vaults': 'vault',
    'xln-password-vault:alice': 'secret',
    'xln-ui-vaults': 'vault',
    'xln-ui-recovery': '{"v1":{"mode":"local","towers":[]}}',
    'xln-wallet-posture': 'pro',
    'xln-deploy-version': 'old',
    'xln-remote-runtime-imports': 'secret',
    'other-app': 'keep',
    'xln-unrecognized': 'keep',
  });
  const session = storage({ 'xln-runtime-adapter-key': 'secret', 'other-session': 'keep' });
  const deleted: string[] = [];
  const untouched: string[] = [];
  const restore = [
    replaceGlobal('localStorage', local),
    replaceGlobal('sessionStorage', session),
    replaceGlobal('indexedDB', {
      databases: async () => [...owned, ...unrelated].map(name => ({ name })),
      deleteDatabase: (name: string) => {
        const request: Record<string, unknown> = {};
        deleted.push(name);
        queueMicrotask(() => (request['onsuccess'] as () => void)());
        return request;
      },
    }),
    replaceGlobal('caches', {
      keys: async () => {
        untouched.push('cache');
        return [];
      },
    }),
    replaceGlobal('navigator', {
      serviceWorker: {
        getRegistrations: async () => {
          untouched.push('workers');
          return [];
        },
      },
    }),
  ];
  try {
    await clearBrowserRuntimeData(RESET_CONFIRMATION);
    expect(deleted).toEqual(owned);
    expect([...local.values]).toEqual([
      ['other-app', 'keep'],
      ['xln-unrecognized', 'keep'],
    ]);
    expect([...session.values]).toEqual([['other-session', 'keep']]);
    expect(untouched).toEqual([]);
  } finally {
    restore.reverse().forEach(restoreGlobal => restoreGlobal());
  }
});

test('a retired testnet deployment loses its state but keeps vault keys, passwords and preferences', async () => {
  const runtime = `level-js-db-0x${'1'.repeat(40)}-storage-current`;
  const retired = ['xln-runtime-command-journal-v1', runtime, 'level-js-db-default-wal'];
  const local = storage({
    'xln-vaults': 'vault',
    'xln-ui-vaults': 'vault',
    'xln-ui-recovery': '{"v1":{"mode":"local","towers":[]}}',
    'xln-password-vault:alice': 'secret',
    'xln-settings': 'prefs',
    'xln-wallet-posture': 'pro',
    'xln-deploy-version': 'old',
    'xln-jmachines': 'old chain',
    'xln-onboarding-complete:alice': '1',
    'other-app': 'keep',
  });
  const deleted: string[] = [];
  const redirects: string[] = [];
  const restore = [
    replaceGlobal('localStorage', local),
    replaceGlobal('sessionStorage', storage({ 'xln-runtime-adapter-key': 'secret' })),
    replaceGlobal('indexedDB', {
      databases: async () => ['xln-vault-keys-v1', ...retired, 'other-app'].map(name => ({ name })),
      deleteDatabase: (name: string) => {
        const request: Record<string, unknown> = {};
        deleted.push(name);
        queueMicrotask(() => (request['onsuccess'] as () => void)());
        return request;
      },
    }),
    replaceGlobal('window', {
      location: { replace: (path: string) => redirects.push(path) },
    }),
  ];
  try {
    await clearRetiredTestnetState();
    expect(deleted).toEqual(retired);
    expect([...local.values.keys()]).toEqual([
      'xln-vaults',
      'xln-ui-vaults',
      'xln-ui-recovery',
      'xln-password-vault:alice',
      'xln-settings',
      'xln-wallet-posture',
      'other-app',
    ]);
    await runRetiredTestnetReset({
      redirectPath: '/ui/',
      stopRuntime: async () => {},
      broadcastReset: () => {},
    });
    expect(redirects).toEqual(['/ui/']);
  } finally {
    restore.reverse().forEach(restoreGlobal => restoreGlobal());
  }
});

test('browser reset fails loudly when an owned database deletion is blocked', async () => {
  const local = storage({ 'xln-vaults': 'keep on failure' });
  const restore = [
    replaceGlobal('localStorage', local),
    replaceGlobal('sessionStorage', storage({})),
    replaceGlobal('indexedDB', {
      databases: async () => [{ name: 'xln-vault-keys-v1' }],
      deleteDatabase: () => {
        const request: Record<string, unknown> = {};
        queueMicrotask(() => (request['onblocked'] as () => void)());
        return request;
      },
    }),
  ];
  try {
    await expect(clearBrowserRuntimeData(RESET_CONFIRMATION)).rejects.toThrow(
      'RESET_INDEXED_DB_DELETE_BLOCKED:xln-vault-keys-v1',
    );
    expect(local.values.get('xln-vaults')).toBe('keep on failure');
  } finally {
    restore.reverse().forEach(restoreGlobal => restoreGlobal());
  }
});

test('cancelled, absent or incorrect typed confirmation never touches data or starts shutdown', async () => {
  expect(RESET_WARNING).toContain('encrypted vaults');
  for (const confirmation of [null, '', 'yes', 'delete xln data', 'DELETE XLN DATA ']) {
    const restore = replaceGlobal('window', {
      prompt: (warning: string) => {
        expect(warning).toBe(RESET_WARNING);
        return confirmation;
      },
    });
    try {
      await resetEverything({ reason: 'test' });
      await expect(clearBrowserRuntimeData(confirmation ?? '')).rejects.toThrow('RESET_CONFIRMATION_REQUIRED');
    } finally {
      restore();
    }
  }
});

test('hashes and deploy-version changes cannot trigger a reset', () => {
  expect(appLayoutSource).not.toContain('maybeHandleResetHash');
  expect(appLayoutSource).not.toContain('isResetHashActive');
  expect(appLayoutSource).not.toContain("reason: 'hash-reset'");
  expect(appLayoutSource).not.toContain("reason: 'deploy-version-change-testnet'");
  for (const source of [
    appLayoutSource,
    readFileSync(join(import.meta.dir, '../../../frontend/src/routes/testnet/+page.svelte'), 'utf8'),
    readFileSync(
      join(import.meta.dir, '../../../frontend/src/lib/components/Entity/workspace/shell/ContextSwitcher.svelte'),
      'utf8',
    ),
  ])
    expect(source).not.toContain('confirmed: true');
});

test('resetRetiredTestnetState clears cached promise on rejection so retry succeeds and deduplicates in-flight calls', async () => {
  const runtimeId = `0x${'a'.repeat(40)}`;
  const local = storage({
    'xln-vaults': JSON.stringify({ runtimes: { [runtimeId]: { id: runtimeId } } }),
    'xln-wallet-posture': 'everyday',
    'xln-deploy-version': 'old',
  });
  let dbCalls = 0;
  const deleted: string[] = [];
  const redirects: string[] = [];
  const restore = [
    replaceGlobal('localStorage', local),
    replaceGlobal('sessionStorage', storage({})),
    replaceGlobal('indexedDB', {
      databases: async () => {
        dbCalls += 1;
        if (dbCalls === 1) throw new Error('TRANSIENT_IDB_FAIL');
        return [{ name: 'level-js-db-default-wal' }];
      },
      deleteDatabase: (name: string) => {
        const request: Record<string, unknown> = {};
        deleted.push(name);
        queueMicrotask(() => (request['onsuccess'] as () => void)());
        return request;
      },
    }),
    replaceGlobal('window', {
      location: { replace: (path: string) => redirects.push(path) },
    }),
  ];
  try {
    const deps = { stopRuntime: async () => {}, broadcastReset: () => {} };
    const firstA = resetRetiredTestnetState('/app', deps);
    const firstB = resetRetiredTestnetState('/app', deps);
    await expect(firstA).rejects.toThrow('TRANSIENT_IDB_FAIL');
    await expect(firstB).rejects.toThrow('TRANSIENT_IDB_FAIL');
    expect(dbCalls).toBe(1);
    expect(redirects).toEqual([]);

    await resetRetiredTestnetState('/app', deps);
    expect(dbCalls).toBe(2);
    expect(deleted).toEqual(['level-js-db-default-wal']);
    expect(redirects).toEqual(['/app']);
    expect(hasRetiredTestnetRebootstrap(runtimeId)).toBe(true);
  } finally {
    restore.reverse().forEach(restoreGlobal => restoreGlobal());
  }
});

test('rebootstrap marker tracks preserved runtimes, clears individually or on full wipe', async () => {
  const { getAddress } = await import('ethers');
  const runtimeA = `0x${'ab'.repeat(20)}`;
  const runtimeB = `0x${'cd'.repeat(20)}`;
  const local = storage({
    'xln-vaults': JSON.stringify({ runtimes: { [runtimeA]: { id: runtimeA }, [runtimeB]: { id: runtimeB } } }),
  });
  const restore = [
    replaceGlobal('localStorage', local),
    replaceGlobal('sessionStorage', storage({})),
    replaceGlobal('indexedDB', {
      databases: async () => [],
      deleteDatabase: () => ({}),
    }),
  ];
  try {
    markRetiredTestnetRebootstrapRuntimes();
    expect(hasRetiredTestnetRebootstrap(getAddress(runtimeA))).toBe(true);
    expect(hasRetiredTestnetRebootstrap(runtimeB)).toBe(true);

    clearRetiredTestnetRebootstrap(runtimeA);
    expect(hasRetiredTestnetRebootstrap(runtimeA)).toBe(false);
    expect(hasRetiredTestnetRebootstrap(runtimeB)).toBe(true);

    // A marker saved before markers carried a time still counts.
    local.setItem(RETIRED_TESTNET_REBOOTSTRAP_KEY, JSON.stringify([runtimeB]));
    expect(hasRetiredTestnetRebootstrap(runtimeB)).toBe(true);

    // An unfinished rebuild relaxes the strict restore check for at most a day.
    local.setItem(RETIRED_TESTNET_REBOOTSTRAP_KEY, JSON.stringify({ ids: [runtimeB], markedAt: Date.now() - 25 * 60 * 60 * 1000 }));
    expect(hasRetiredTestnetRebootstrap(runtimeB)).toBe(false);
    local.setItem(RETIRED_TESTNET_REBOOTSTRAP_KEY, JSON.stringify({ ids: [runtimeB], markedAt: Date.now() }));
    expect(hasRetiredTestnetRebootstrap(runtimeB)).toBe(true);

    await clearBrowserRuntimeData(RESET_CONFIRMATION);
    expect(local.values.has(RETIRED_TESTNET_REBOOTSTRAP_KEY)).toBe(false);
    expect(hasRetiredTestnetRebootstrap(runtimeB)).toBe(false);
  } finally {
    restore.reverse().forEach(restoreGlobal => restoreGlobal());
  }
});
