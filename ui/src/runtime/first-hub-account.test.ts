import { afterAll, expect, mock, spyOn, test } from 'bun:test';

// Bun shares one module registry across test files and a mock.module cannot be
// undone. Only the wallet store, adapter and command bus are replaced: they
// need a browser (storage, document theme) or Vite build defines to load, so
// no Bun test can use the real ones. Every other dependency is the real
// module, spied on, with each spy restored when this file ends.
const shown: string[] = [];
mock.module('./store', () => ({
  useApp: { getState: () => ({ toast: (text: string) => shown.push(text), setChainSync: () => {} }) },
}));
const sends: unknown[] = [];
mock.module('./commands', () => ({
  sendRuntimeInput: async (input: unknown) => {
    sends.push(input);
    return { ok: true };
  },
}));
mock.module('./adapter', () => ({
  getAdapter: () => null,
  getEmbeddedEnv: () => null,
  requireAdapter: () => ({ read: async () => [] }),
  connectEmbedded: async () => {},
  lockEmbeddedRuntime: async () => {},
}));
const roles = await import('./financial/roles');
const onboarding = await import('@xln/frontend/lib/utils/onboarding/onboardingPreferences');
let releaseHydration: () => void = () => {};
const spies = [
  spyOn(roles, 'accountDisputeConfig').mockImplementation(() => ({ leftResponseSeconds: 10, rightResponseSeconds: 10 })),
  spyOn(onboarding, 'hydrateJurisdictionPolicyDefaults').mockImplementation(
    () => new Promise(resolve => (releaseHydration = () => resolve({ softLimitUsd: 1, hardLimitUsd: 250, maxFeeUsd: 2 }))),
  ),
];
afterAll(() => {
  for (const spy of spies) spy.mockRestore();
});

const { openFirstHubAccount } = await import('./hosted');
const { isChainCatchupCancelled } = await import('./chain-catchup');
const { latchPostureFromSearch, resetLatchedPosture } = await import('./everyday');

const hubId = `0x${'ab'.repeat(32)}`;
const entityId = `0x${'cd'.repeat(32)}`;
const stack = {
  apiBase: 'http://localhost',
  relayUrl: 'ws://localhost/relay',
  jurisdiction: { name: 'Testnet' },
  jurisdictions: [],
  hubs: [{ entityId: hubId, name: 'H1', online: true }],
} as unknown as Parameters<typeof openFirstHubAccount>[2];
const env = { state: { eReplicas: new Map() }, runtimeMempool: { runtimeTxs: [], entityInputs: [] } } as unknown as Parameters<
  typeof openFirstHubAccount
>[1];
const xlnWith = (connected: () => boolean) =>
  ({
    getP2P: () => ({ isConnected: connected }),
    ensureGossipProfiles: async () => {},
    getTokenInfo: () => ({ decimals: 6 }),
  }) as unknown as Parameters<typeof openFirstHubAccount>[0];

const settle = (promise: Promise<void>) => promise.then(() => null, (error: unknown) => error);

test('a session replaced during policy hydration sends nothing and shows no toast', async () => {
  sends.length = 0;
  shown.length = 0;
  let session = true;
  const run = settle(openFirstHubAccount(xlnWith(() => true), env, stack, entityId, `0x${'ef'.repeat(20)}`, () => session));
  await new Promise(resolve => setTimeout(resolve, 20));
  session = false;
  releaseHydration();
  expect(isChainCatchupCancelled(await run)).toBe(true);
  expect(sends).toEqual([]);
  expect(shown).toEqual([]);
});

test('a session replaced while waiting for the relay sends nothing and shows no relay toast', async () => {
  sends.length = 0;
  shown.length = 0;
  let session = true;
  const run = settle(openFirstHubAccount(xlnWith(() => false), env, stack, entityId, `0x${'ef'.repeat(20)}`, () => session));
  await new Promise(resolve => setTimeout(resolve, 150));
  session = false;
  expect(isChainCatchupCancelled(await run)).toBe(true);
  expect(sends).toEqual([]);
  expect(shown).toEqual([]);
});

test('the first hub Account extends the Everyday $250 transit cap and $1 auto-settle policy by default', async () => {
  sends.length = 0;
  shown.length = 0;
  let session = true;
  const run = settle(openFirstHubAccount(xlnWith(() => true), env, stack, entityId, `0x${'ef'.repeat(20)}`, () => session));
  await new Promise(resolve => setTimeout(resolve, 20));
  releaseHydration();
  while (sends.length === 0) await new Promise(resolve => setTimeout(resolve, 5));
  session = false;
  expect(isChainCatchupCancelled(await run)).toBe(true);
  const input = sends[0] as { entityInputs: Array<{ entityTxs: Array<{ type: string; data: Record<string, unknown> }> }> };
  const open = input.entityInputs[0]!.entityTxs[0]!;
  expect(open.type).toBe('openAccount');
  expect(open.data['creditAmount']).toBe(250_000_000n);
  expect(open.data['rebalancePolicy']).toEqual({
    r2cRequestSoftLimit: 1_000_000n,
    hardLimit: 250_000_000n,
    maxAcceptableFee: 2_000_000n,
  });
  expect(open.data['tokenId']).toBe(1);
});

test('the first hub Account extends the Pro 10,000 USD credit line when posture is pro', async () => {
  sends.length = 0;
  shown.length = 0;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => (key === 'xln-wallet-posture' ? 'pro' : null),
      setItem: () => {},
      removeItem: () => {},
    },
  });
  let session = true;
  try {
    const run = settle(openFirstHubAccount(xlnWith(() => true), env, stack, entityId, `0x${'ef'.repeat(20)}`, () => session));
    await new Promise(resolve => setTimeout(resolve, 20));
    releaseHydration();
    while (sends.length === 0) await new Promise(resolve => setTimeout(resolve, 5));
    session = false;
    expect(isChainCatchupCancelled(await run)).toBe(true);
    const input = sends[0] as { entityInputs: Array<{ entityTxs: Array<{ type: string; data: Record<string, unknown> }> }> };
    const open = input.entityInputs[0]!.entityTxs[0]!;
    expect(open.type).toBe('openAccount');
    expect(open.data['creditAmount']).toBe(10_000_000_000n);
    expect(open.data['rebalancePolicy']).toEqual({
      r2cRequestSoftLimit: 500_000_000n,
      hardLimit: 10_000_000_000n,
      maxAcceptableFee: 15_000_000n,
    });
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('the first hub Account extends the Pro 10,000 USD credit line when ?mode=pro is latched in memory', async () => {
  sends.length = 0;
  shown.length = 0;
  spies[1]?.mockClear();
  latchPostureFromSearch('?mode=pro');
  let session = true;
  try {
    const run = settle(openFirstHubAccount(xlnWith(() => true), env, stack, entityId, `0x${'ef'.repeat(20)}`, () => session));
    await new Promise(resolve => setTimeout(resolve, 20));
    releaseHydration();
    while (sends.length === 0) await new Promise(resolve => setTimeout(resolve, 5));
    session = false;
    expect(isChainCatchupCancelled(await run)).toBe(true);
    const input = sends[0] as { entityInputs: Array<{ entityTxs: Array<{ type: string; data: Record<string, unknown> }> }> };
    const open = input.entityInputs[0]!.entityTxs[0]!;
    expect(open.type).toBe('openAccount');
    expect(open.data['creditAmount']).toBe(10_000_000_000n);
    expect(open.data['rebalancePolicy']).toEqual({
      r2cRequestSoftLimit: 500_000_000n,
      hardLimit: 10_000_000_000n,
      maxAcceptableFee: 15_000_000n,
    });
    expect(spies[1]?.mock.calls[0]?.[2]).toBe('pro');
  } finally {
    resetLatchedPosture();
  }
});
