import { expect, test } from 'bun:test';
import { createDefaultDelta } from '../../../core/account/state/delta';
import { deriveDelta } from '../../../core/account/utils';
import { buildPaymentRuntimeInput } from '../../../core/api/payments/command';
import type { Delta, RuntimeAdapterViewFrame, RuntimeReplica } from '../../../core/api/public/runtime-module';
import type { RuntimeAdapter } from '../../../core/api/runtime-adapter/types';
import { type EverydaySendPlan } from '../../../frontend/src/lib/everyday/everyday-autopilot';
import { executeEverydaySendPlan } from '../../../frontend/src/lib/components/Everyday/everyday-funding';
import { findDirectBilateralRoute, quoteSettleTabRoute } from '../../../frontend/src/lib/components/Everyday/everyday-runtime';
import {
  maybeAutoJoinEverydayHub,
  resetEverydayHubJoinStateForTests,
} from '../../../frontend/src/lib/stores/everyday/everyday-hub-join';

const SELF = `0x${'11'.repeat(32)}`;
const HUB = `0x${'22'.repeat(32)}`;
const FRIEND = `0x${'33'.repeat(32)}`;
const OTHER = `0x${'44'.repeat(32)}`;
const SIGNER = `0x${'55'.repeat(20)}`;
const SPENDER = `0x${'66'.repeat(20)}`;
const RUNTIME_ID = `0x${'77'.repeat(20)}`;

const makeFrame = (accounts: Array<{ peer: string; delta: Delta; isHub: boolean; label: string; activeDispute?: boolean }>): RuntimeAdapterViewFrame => ({
  activeEntityId: SELF,
  entities: [
    { entityId: SELF, signerId: SIGNER, height: 1, label: 'Bob', isHub: false },
    ...accounts.map(({ peer, isHub, label }) => ({ entityId: peer, signerId: SIGNER, height: 1, label, isHub })),
  ],
  activeEntity: {
    summary: {
      entityId: SELF, signerId: SIGNER, height: 1, label: 'Bob', isHub: false,
      jurisdiction: { name: 'sepolia', chainId: 11155111, depositoryAddress: SPENDER },
    },
    core: {
      signerId: SIGNER, reserves: new Map(),
      config: { jurisdiction: { name: 'sepolia', chainId: 11155111, depositoryAddress: SPENDER } },
    },
    accounts: {
      items: accounts.map(({ peer, delta, activeDispute }) => {
        const [leftEntity, rightEntity] = SELF < peer ? [SELF, peer] : [peer, SELF];
        return {
          status: 'active' as const,
          ...(activeDispute ? { activeDispute: { observedOnChain: true } } : {}),
          state: { leftEntity, rightEntity, deltas: new Map([[1, delta]]) },
        };
      }),
    },
  },
} as unknown as RuntimeAdapterViewFrame);

const validHubPayload = (overrides?: { ok?: boolean; extra?: boolean; isHub?: boolean; roleSource?: string }) => ({
  ok: overrides?.ok ?? true,
  count: 1,
  serverTime: 1000,
  hubs: [{
    entityId: HUB,
    online: true,
    roleSource: overrides?.roleSource ?? 'operator-config',
    ...(overrides?.extra ? { unexpected: 1 } : {}),
    metadata: { isHub: overrides?.isHub ?? true, jurisdiction: { name: 'sepolia', chainId: 11155111, depositoryAddress: SPENDER } },
  }],
});

test('maybeAutoJoinEverydayHub rejects malformed /api/hubs payloads and trips MAX_ATTEMPTS=2', async () => {
  resetEverydayHubJoinStateForTests();
  const frame = makeFrame([]);
  const badPayloads = [
    validHubPayload({ ok: false }),
    validHubPayload({ extra: true }),
    validHubPayload({ isHub: false }),
    validHubPayload({ roleSource: 'self-claim' }),
  ];
  for (let i = 0; i < badPayloads.length; i += 1) {
    resetEverydayHubJoinStateForTests();
    let submitted = 0;
    await maybeAutoJoinEverydayHub({
      runtimeId: RUNTIME_ID, entityId: SELF, signerId: SIGNER, jurisdiction: 'sepolia', frame,
      hubAccountsCount: 0, liveEnv: null, xln: null, commandReady: true,
      deps: {
        readPreferenceFn: () => '1',
        apiBase: 'http://127.0.0.1:8080',
        fetchFn: (async () => new Response(JSON.stringify(badPayloads[i]), { status: 200 })) as unknown as typeof fetch,
        submitRuntimeInputFn: async () => { submitted += 1; },
      },
    });
    expect(submitted).toBe(0);
  }

  resetEverydayHubJoinStateForTests();
  let fetches = 0;
  const failDeps = {
    readPreferenceFn: () => '1' as const,
    apiBase: 'http://127.0.0.1:8080',
    fetchFn: (async () => { fetches += 1; return new Response('err', { status: 500 }); }) as unknown as typeof fetch,
  };
  await maybeAutoJoinEverydayHub({ runtimeId: RUNTIME_ID, entityId: SELF, signerId: SIGNER, jurisdiction: 'sepolia', frame, hubAccountsCount: 0, liveEnv: null, xln: null, commandReady: true, deps: failDeps });
  await maybeAutoJoinEverydayHub({ runtimeId: RUNTIME_ID, entityId: SELF, signerId: SIGNER, jurisdiction: 'sepolia', frame, hubAccountsCount: 0, liveEnv: null, xln: null, commandReady: true, deps: failDeps });
  await maybeAutoJoinEverydayHub({ runtimeId: RUNTIME_ID, entityId: SELF, signerId: SIGNER, jurisdiction: 'sepolia', frame, hubAccountsCount: 0, liveEnv: null, xln: null, commandReady: true, deps: failDeps });
  expect(fetches).toBe(2);

  // Transient empty /api/hubs must not permanently lock out retries
  resetEverydayHubJoinStateForTests();
  let emptyAttempt = 0;
  let joinedAfterRetry = 0;
  const transientEmptyDeps = {
    readPreferenceFn: () => '1' as const,
    apiBase: 'http://127.0.0.1:8080',
    fetchFn: (async () => {
      emptyAttempt += 1;
      const payload = emptyAttempt === 1
        ? { ok: true, count: 0, serverTime: 1000, hubs: [] }
        : validHubPayload();
      return new Response(JSON.stringify(payload), { status: 200 });
    }) as unknown as typeof fetch,
    submitRuntimeInputFn: async () => { joinedAfterRetry += 1; },
  };
  await maybeAutoJoinEverydayHub({ runtimeId: RUNTIME_ID, entityId: SELF, signerId: SIGNER, jurisdiction: 'sepolia', frame, hubAccountsCount: 0, liveEnv: null, xln: null, commandReady: true, deps: transientEmptyDeps });
  expect(joinedAfterRetry).toBe(0);
  await maybeAutoJoinEverydayHub({ runtimeId: RUNTIME_ID, entityId: SELF, signerId: SIGNER, jurisdiction: 'sepolia', frame, hubAccountsCount: 0, liveEnv: null, xln: null, commandReady: true, deps: transientEmptyDeps });
  expect(emptyAttempt).toBe(2);
  expect(joinedAfterRetry).toBe(1);
});

test('maybeAutoJoinEverydayHub records completedJoins on mid-poll exit and aborts when committedRoles marks hub non-hub', async () => {
  resetEverydayHubJoinStateForTests();
  const frame = makeFrame([]);
  let pref: '1' | 'manual' = '1';
  let fetches = 0;
  let submits = 0;
  const liveEnv = {
    runtimeMempool: { entityInputs: [] },
    state: { eReplicas: new Map() },
    infrastructure: {
      p2p: {
        isConnected: () => {
          pref = 'manual';
          return false;
        },
      },
    },
  } as unknown as RuntimeReplica;

  await maybeAutoJoinEverydayHub({
    runtimeId: RUNTIME_ID, entityId: SELF, signerId: SIGNER, jurisdiction: 'sepolia', frame,
    hubAccountsCount: 0, liveEnv, xln: null, commandReady: true,
    deps: {
      readPreferenceFn: () => pref,
      apiBase: 'http://127.0.0.1:8080',
      p2pPollTimeoutMs: 50,
      p2pPollIntervalMs: 5,
      fetchFn: (async () => { fetches += 1; return new Response(JSON.stringify(validHubPayload()), { status: 200 }); }) as unknown as typeof fetch,
      submitRuntimeInputFn: async () => { submits += 1; },
    },
  });
  expect(fetches).toBe(1);
  expect(submits).toBe(0);

  // Flipping back to '1' must stay completed (no duplicate join/fetch) because mid-poll exit added completedJoins(key)
  pref = '1';
  await maybeAutoJoinEverydayHub({
    runtimeId: RUNTIME_ID, entityId: SELF, signerId: SIGNER, jurisdiction: 'sepolia', frame,
    hubAccountsCount: 0, liveEnv, xln: null, commandReady: true,
    deps: {
      readPreferenceFn: () => pref,
      apiBase: 'http://127.0.0.1:8080',
      fetchFn: (async () => { fetches += 1; return new Response(JSON.stringify(validHubPayload()), { status: 200 }); }) as unknown as typeof fetch,
      submitRuntimeInputFn: async () => { submits += 1; },
    },
  });
  expect(fetches).toBe(1);
  expect(submits).toBe(0);

  // committedRoles.get(hubId) === false aborts openAccount
  resetEverydayHubJoinStateForTests();
  const nonHubFrame = makeFrame([{ peer: HUB, delta: createDefaultDelta(1), isHub: false, label: 'NotHub' }]);
  let nonHubSubmits = 0;
  await maybeAutoJoinEverydayHub({
    runtimeId: RUNTIME_ID, entityId: SELF, signerId: SIGNER, jurisdiction: 'sepolia', frame: nonHubFrame,
    hubAccountsCount: 0, liveEnv: null, xln: null, commandReady: true,
    deps: {
      readPreferenceFn: () => '1',
      apiBase: 'http://127.0.0.1:8080',
      fetchFn: (async () => new Response(JSON.stringify(validHubPayload()), { status: 200 })) as unknown as typeof fetch,
      submitRuntimeInputFn: async () => { nonHubSubmits += 1; },
    },
  });
  expect(nonHubSubmits).toBe(0);
});

test('executeEverydaySendPlan polls through transient insufficient/needs-gas during pending-funding and aborts on disputed', async () => {
  const paymentInput = buildPaymentRuntimeInput({
    entityId: SELF, signerId: SIGNER, targetEntityId: FRIEND, tokenId: 1, deliveryMode: 'instant', description: 'Pay',
    route: { path: [SELF, HUB, FRIEND], totalFee: 0n, senderAmount: 10_000_000n, recipientAmount: 10_000_000n },
  });
  const pendingPlan: EverydaySendPlan = { kind: 'pending-funding', reason: 'queued-deposit', paymentInput };
  let step = 0;
  let sent = 0;
  await executeEverydaySendPlan({
    plan: pendingPlan, entityId: SELF, signerId: SIGNER, tokenId: 1, liveEnv: null, xln: null,
    refreshPlan: async () => {
      step += 1;
      if (step === 1) return { kind: 'insufficient', shortfall: 10_000_000n };
      if (step === 2) return { kind: 'needs-gas', requiredTx: 'r2c', paymentInput };
      return { kind: 'ready', paymentInput };
    },
    deps: { pollIntervalMs: 5, submitRuntimeInputFn: async () => { sent += 1; } },
  });
  expect(step).toBe(3);
  expect(sent).toBe(1);

  await expect(executeEverydaySendPlan({
    plan: pendingPlan, entityId: SELF, signerId: SIGNER, tokenId: 1, liveEnv: null, xln: null,
    refreshPlan: async () => ({ kind: 'disputed', counterpartyId: HUB }),
    deps: { pollIntervalMs: 5, submitRuntimeInputFn: async () => {} },
  })).rejects.toThrow('paused for recovery');
});

test('findDirectBilateralRoute and quoteSettleTabRoute reject disputed/hub/short/wrong-penultimate cycles and null primaryHubId', async () => {
  const disputedFrame = makeFrame([
    { peer: FRIEND, delta: createDefaultDelta(1, { left: 40_000_000n, right: 0n }), isHub: false, label: 'Alice', activeDispute: true },
    { peer: HUB, delta: createDefaultDelta(1, { left: 40_000_000n, right: 0n }), isHub: true, label: 'Hub' },
  ]);
  expect(findDirectBilateralRoute({ frame: disputedFrame, entityId: SELF, targetEntityId: FRIEND, tokenId: 1, amount: 10_000_000n, deriveDeltaFn: deriveDelta })).toBeNull();
  expect(findDirectBilateralRoute({ frame: disputedFrame, entityId: SELF, targetEntityId: HUB, tokenId: 1, amount: 10_000_000n, deriveDeltaFn: deriveDelta })).toBeNull();
  expect(findDirectBilateralRoute({ frame: disputedFrame, entityId: SELF, targetEntityId: SELF, tokenId: 1, amount: 10_000_000n, deriveDeltaFn: deriveDelta })).toBeNull();

  // <4-hop [SELF, HUB, SELF] and wrong penultimate [SELF, HUB, OTHER, SELF] are both rejected
  await expect(quoteSettleTabRoute({
    frame: disputedFrame, entityId: SELF, targetEntityId: FRIEND, tokenId: 1, amount: 40_000_000n,
    primaryHubId: HUB, deriveDeltaFn: deriveDelta,
    deps: {
      adapter: {
        read: async () => ({
          routes: [
            { path: [SELF, HUB, SELF], hops: [{}, {}], totalFee: '0', senderAmount: '40000000', recipientAmount: '40000000' },
            { path: [SELF, HUB, OTHER, SELF], hops: [{}, {}, {}], totalFee: '0', senderAmount: '40000000', recipientAmount: '40000000' },
          ],
        }),
      } as unknown as Pick<RuntimeAdapter, 'read'>,
    },
  })).rejects.toThrow('No settlement path is available for this tab right now.');

  // primaryHubId === null fails closed without querying adapter
  await expect(quoteSettleTabRoute({
    frame: disputedFrame, entityId: SELF, targetEntityId: FRIEND, tokenId: 1, amount: 40_000_000n,
    primaryHubId: null, deriveDeltaFn: deriveDelta,
    deps: {
      adapter: {
        read: async () => { throw new Error('must not query when primaryHubId is null'); },
      } as unknown as Pick<RuntimeAdapter, 'read'>,
    },
  })).rejects.toThrow('No settlement path is available for this tab right now.');
});

test('resolveDefaultTowerUrls treats unbracketed IPv6 ::1 as loopback', async () => {
  const { resolveDefaultTowerUrls } = await import('../../../frontend/src/lib/everyday/everyday-recovery');
  expect(resolveDefaultTowerUrls({ hostname: '::1', origin: 'http://[::1]:8080' })).toEqual([]);
  expect(resolveDefaultTowerUrls({ hostname: '[::1]', origin: 'http://[::1]:8080' })).toEqual([]);
});
