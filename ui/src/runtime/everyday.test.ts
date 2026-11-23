import { afterEach, expect, test } from 'bun:test';
import { asTokenDecimals } from '@xln/core/account/tx/units';
import { asTokenId } from '@xln/core/protocol/units';
import { ensureDefaultTowerProtection } from '@xln/frontend/lib/everyday/everyday-recovery';
import { getOpenAccountRebalancePolicyData } from '@xln/frontend/lib/utils/onboarding/onboardingPreferences';
import {
  emptyEverydayProjection,
  formatEverydayAmount,
  latchPostureFromSearch,
  resetLatchedPosture,
  resolveEffectivePosture,
  setPersistedWalletPosture,
  stripModeParam,
  subscribeEffectivePosture,
  toEverydayExternalRows,
  withPostureQuery,
} from './everyday';
import {
  checkReactDeployVersion,
  DEPLOY_VERSION_KEY,
  resolveReactRedirectPath,
} from './deploy-version';
import {
  readRecoveryShieldStatus,
  subscribeRecoveryShieldStatus,
  writeRecoveryShieldStatus,
} from './recovery';

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function installMockStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: storage,
  });
  return { map, storage };
}

afterEach(() => {
  resetLatchedPosture();
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

test('posture defaults to everyday, latches ?mode=pro without mutating localStorage, and clears cleanly on toggle', () => {
  const { map } = installMockStorage();
  expect(resolveEffectivePosture('')).toBe('everyday');

  // Latch ?mode=pro in memory without persisting to localStorage
  expect(latchPostureFromSearch('?mode=pro')).toBe('pro');
  expect(map.get('xln-wallet-posture')).toBeUndefined();
  expect(resolveEffectivePosture('')).toBe('pro');
  expect(withPostureQuery('/manage', '?mode=pro')).toBe('/manage?mode=pro');
  expect(withPostureQuery('/settings', '')).toBe('/settings?mode=pro');

  // Settings toggle persists and strips ?mode=
  const events: string[] = [];
  const off = subscribeEffectivePosture(() => events.push(resolveEffectivePosture('')));
  setPersistedWalletPosture('everyday');
  off();
  expect(map.get('xln-wallet-posture')).toBe('everyday');
  expect(resolveEffectivePosture('')).toBe('everyday');
  expect(stripModeParam('?mode=pro&tab=1')).toBe('?tab=1');
  expect(stripModeParam('?mode=pro')).toBe('');
  expect(withPostureQuery('/settings', '')).toBe('/settings');
  expect(events).toEqual(['everyday']);
});

test('toEverydayExternalRows maps address to tokenAddress and filters errored rows', () => {
  const rows = toEverydayExternalRows([
    { address: '0xusdc', tokenId: 1, balance: 25_000_000n, allowance: 5_000_000n },
    { address: '0xbad', tokenId: 2, balance: 0n, allowance: null, error: 'RPC_TIMEOUT' },
  ]);
  expect(rows).toEqual([
    { tokenAddress: '0xusdc', tokenId: 1, balance: 25_000_000n, allowance: 5_000_000n },
  ]);
});

test('formatEverydayAmount formats USD stablecoins with $ and other tokens with symbol', () => {
  expect(formatEverydayAmount(12_340_000n, { symbol: 'USDC', decimals: asTokenDecimals(6) }, true)).toBe('$12.34');
  expect(formatEverydayAmount(1_500_000_000_000_000_000n, { symbol: 'WETH', decimals: asTokenDecimals(18) }, false)).toBe('1.50 WETH');
  expect(emptyEverydayProjection('0xAbCd').entityId).toBe('0xabcd');
});

test('resolveReactRedirectPath normalizes /ui/ and / across hosted and standalone builds', () => {
  expect(resolveReactRedirectPath('/ui/', '/ui/settings')).toBe('/ui/');
  expect(resolveReactRedirectPath('/ui', '/ui')).toBe('/ui/');
  expect(resolveReactRedirectPath('/', '/ui/settings')).toBe('/ui/');
  expect(resolveReactRedirectPath('/', '/settings')).toBe('/');
});

test('checkReactDeployVersion handles persist, continue, ephemeral reset, recovery block, and offline', async () => {
  const { map, storage } = installMockStorage();
  const mockJsonResponse = (body: unknown, ok = true): Response =>
    ({
      ok,
      status: ok ? 200 : 503,
      json: async () => body,
    }) as Response;

  const first = await checkReactDeployVersion({
    fetchFn: async () => mockJsonResponse({ deployVersion: 'dep-1', ephemeralTestnet: false }),
    storage,
    hostname: 'xln.finance',
    isDev: false,
  });
  expect(first).toEqual({ status: 'ok', ephemeralTestnet: false });
  expect(map.get(DEPLOY_VERSION_KEY)).toBe('dep-1');

  const same = await checkReactDeployVersion({
    fetchFn: async () => mockJsonResponse({ deployVersion: 'dep-1', ephemeralTestnet: false }),
    storage,
    hostname: 'xln.finance',
    isDev: false,
  });
  expect(same).toEqual({ status: 'ok', ephemeralTestnet: false });

  const prodChange = await checkReactDeployVersion({
    fetchFn: async () => mockJsonResponse({ deployVersion: 'dep-2', ephemeralTestnet: false }),
    storage,
    hostname: 'xln.finance',
    isDev: false,
  });
  expect(prodChange).toEqual({
    status: 'require-recovery',
    ephemeralTestnet: false,
    storedVersion: 'dep-1',
    currentVersion: 'dep-2',
  });

  let resetCalled = 0;
  const localChange = await checkReactDeployVersion({
    fetchFn: async () => mockJsonResponse({ deployVersion: 'dep-2', ephemeralTestnet: true }),
    storage,
    hostname: 'localhost',
    isDev: true,
    onReset: async () => {
      resetCalled += 1;
    },
  });
  expect(localChange).toEqual({ status: 'resetting', ephemeralTestnet: true });
  expect(resetCalled).toBe(1);

  const offline = await checkReactDeployVersion({
    fetchFn: async () => {
      throw new Error('offline');
    },
    storage,
    hostname: 'localhost',
    isDev: true,
  });
  expect(offline).toEqual({ status: 'offline', ephemeralTestnet: true });
});

test('writeRecoveryShieldStatus notifies subscribers across local, error, and tower transitions', () => {
  let notifications = 0;
  const off = subscribeRecoveryShieldStatus(() => {
    notifications += 1;
  });
  writeRecoveryShieldStatus('vault-1', {
    mode: 'local',
    towers: [],
    lastBackupHeight: 1,
    lastBackupAt: null,
    backupError: null,
    protectionReceiptsCount: 0,
    automaticResponseEnabled: false,
    protectionError: null,
    unsupportedChains: [],
  });
  expect(notifications).toBe(1);
  expect(readRecoveryShieldStatus('vault-1')?.mode).toBe('local');

  writeRecoveryShieldStatus('vault-1', {
    mode: 'tower',
    towers: ['https://tower.example'],
    lastBackupHeight: 2,
    lastBackupAt: null,
    backupError: 'TOWER_UNREACHABLE',
    protectionReceiptsCount: 0,
    automaticResponseEnabled: false,
    protectionError: null,
    unsupportedChains: [],
  });
  off();
  expect(notifications).toBe(2);
  expect(readRecoveryShieldStatus('vault-1')?.backupError).toBe('TOWER_UNREACHABLE');
});

test('?mode=everyday latch overrides persisted pro storage for effective posture and rebalance policy without mutating localStorage', () => {
  const { map } = installMockStorage({ 'xln-wallet-posture': 'pro' });
  expect(resolveEffectivePosture('')).toBe('pro');

  expect(latchPostureFromSearch('?mode=everyday')).toBe('everyday');
  expect(resolveEffectivePosture('')).toBe('everyday');
  expect(map.get('xln-wallet-posture')).toBe('pro');
  expect(getOpenAccountRebalancePolicyData(asTokenId(1), resolveEffectivePosture(''))).toEqual({
    r2cRequestSoftLimit: 1_000_000n,
    hardLimit: 250_000_000n,
    maxAcceptableFee: 2_000_000n,
  });
});

test('latched ?mode=pro prevents ensureDefaultTowerProtection from enrolling tower backups when search and localStorage are empty', () => {
  installMockStorage();
  const savedConfigs: Array<{ mode: string; towers: string[] }> = [];
  expect(latchPostureFromSearch('?mode=pro')).toBe('pro');

  const whilePro = ensureDefaultTowerProtection({
    posture: resolveEffectivePosture(''),
    vaultId: 'vault-latch',
    readExplicitConfig: () => null,
    saveConfig: (_vaultId, config) => savedConfigs.push(config),
    resolveUrls: () => ['https://tower.example'],
  });
  expect(whilePro).toBeNull();
  expect(savedConfigs).toHaveLength(0);

  resetLatchedPosture();
  const afterReset = ensureDefaultTowerProtection({
    posture: resolveEffectivePosture(''),
    vaultId: 'vault-latch',
    readExplicitConfig: () => null,
    saveConfig: (_vaultId, config) => savedConfigs.push(config),
    resolveUrls: () => ['https://tower.example'],
  });
  expect(afterReset).toEqual({ mode: 'tower', towers: ['https://tower.example'] });
});

test('parseModeParam trims whitespace/case, latchPostureFromSearch(null) suppresses notifications, and withPostureQuery preserves mode & hash', async () => {
  const { parseModeParam } = await import('./everyday');
  expect(parseModeParam('?mode=%20PRO%20')).toBe('pro');
  expect(parseModeParam('?mode=Everyday')).toBe('everyday');
  expect(parseModeParam('')).toBeNull();

  let notifications = 0;
  const off = subscribeEffectivePosture(() => { notifications += 1; });
  try {
    expect(latchPostureFromSearch('')).toBeNull();
    resetLatchedPosture();
    expect(notifications).toBe(0);
  } finally {
    off();
  }

  expect(withPostureQuery('/pay?amount=5#frag', '?mode=pro')).toBe('/pay?amount=5&mode=pro#frag');
  expect(withPostureQuery('/pay?mode=everyday#frag', '?mode=pro')).toBe('/pay?mode=everyday#frag');
});

test('ensureReactDefaultTowerProtection preserves all configured tower URLs from JSON/CSV overrides', async () => {
  installMockStorage({
    'xln-watchtower-urls': JSON.stringify(['https://t1.example/', { url: 'https://t2.example/' }]),
  });
  const prevWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: { location: { hostname: 'localhost', origin: 'http://localhost:8080', search: '' } },
  });
  try {
    const { ensureReactDefaultTowerProtection, readExplicitRecovery } = await import('./recovery');
    const saved = ensureReactDefaultTowerProtection('vault-multi-tower');
    expect(saved).toEqual({ mode: 'tower', towers: ['https://t1.example', 'https://t2.example'] });
    expect(readExplicitRecovery('vault-multi-tower')).toEqual({
      mode: 'tower',
      towers: ['https://t1.example', 'https://t2.example'],
    });
  } finally {
    if (prevWindow) Object.defineProperty(globalThis, 'window', prevWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
