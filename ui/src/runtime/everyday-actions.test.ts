import { afterAll, expect, test } from 'bun:test';
import { createEmptyAccountJClaimAccumulator } from '@xln/core/account/j-claims/j-claim-accumulator';
import { createDefaultDelta } from '@xln/core/account/state/delta';
import { deriveDelta } from '@xln/core/account/utils';
import { buildPaymentRuntimeInput } from '@xln/core/api/payments/command';
import type { RuntimeAdapterEntitySummary, RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import { planEverydaySend, type EverydaySendRoute } from '@xln/frontend/lib/everyday/everyday-autopilot';
import { findDirectBilateralRoute } from '@xln/frontend/lib/everyday/everyday-routes';
import { parseXlnInvoice } from '@xln/frontend/lib/utils/xlnInvoice';
import type { StackJurisdiction } from './hosted';

const restoreGlobals: Array<() => void> = [];
const ensureGlobal = (key: string, value: unknown) => {
  if (key in globalThis && (globalThis as Record<string, unknown>)[key] !== undefined) return;
  const prev = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  restoreGlobals.push(() => {
    if (prev) Object.defineProperty(globalThis, key, prev);
    else Reflect.deleteProperty(globalThis, key);
  });
};

const lsMap = new Map<string, string>();
ensureGlobal('localStorage', {
  getItem: (k: string) => lsMap.get(k) ?? null,
  setItem: (k: string, v: string) => { lsMap.set(k, v); },
  removeItem: (k: string) => { lsMap.delete(k); },
});
ensureGlobal('window', {
  location: { hostname: 'localhost', origin: 'http://localhost:8080', pathname: '/ui/', search: '' },
  addEventListener: () => {},
  removeEventListener: () => {},
  history: { state: null, replaceState: () => {} },
});
ensureGlobal('document', {
  documentElement: { dataset: {}, setAttribute: () => {}, style: { setProperty: () => {}, removeProperty: () => {} } },
  createElement: () => ({}),
  head: { appendChild: () => {} },
});

const {
  quoteEverydayPaymentRoutes,
  quoteEverydaySettleTabRoute,
  resolveAcceptedInvoiceJurisdictions,
  resolveCounterpartySummaries,
} = await import('../components/everyday/everyday-actions');
const { assertInvoiceJurisdiction, invoiceNote } = await import('../screens/pay-intent');

afterAll(() => {
  while (restoreGlobals.length > 0) restoreGlobals.pop()?.();
});

const ALICE = `0x${'11'.repeat(32)}`;
const BOB = `0x${'22'.repeat(32)}`;
const HUB = `0x${'33'.repeat(32)}`;
const SIGNER = `0x${'44'.repeat(20)}`;
const HASH = `0x${'55'.repeat(32)}`;

const sampleRoute = (path: string[]): EverydaySendRoute => ({
  path,
  totalFee: 0n,
  senderAmount: 5_000_000n,
  recipientAmount: 5_000_000n,
});

const routeNotFoundError = (): Error & { code: string } =>
  Object.assign(new Error('no payment route from source to target'), { code: 'E_NOT_FOUND' });

test('quoteEverydayPaymentRoutes returns un-funded routes first without retrying via hub', async () => {
  const calls: Array<{ fundingAccountId?: string }> = [];
  const result = await quoteEverydayPaymentRoutes(
    { sourceEntityId: ALICE, targetEntityId: BOB, tokenId: 1, amount: 5_000_000n, primaryHubId: HUB, cash: 10_000_000n },
    async input => {
      calls.push(input.fundingAccountId ? { fundingAccountId: input.fundingAccountId } : {});
      return [sampleRoute([ALICE, BOB])];
    },
  );
  expect(result.fundedByHub).toBe(false);
  expect(result.routes).toHaveLength(1);
  expect(calls).toEqual([{}]);
});

test('quoteEverydayPaymentRoutes retries with fundingAccountId on E_NOT_FOUND or empty routes when cash > 0 and primaryHubId exists', async () => {
  const calls: Array<{ fundingAccountId?: string }> = [];
  const result = await quoteEverydayPaymentRoutes(
    { sourceEntityId: ALICE, targetEntityId: BOB, tokenId: 1, amount: 5_000_000n, primaryHubId: HUB, cash: 10_000_000n },
    async input => {
      calls.push(input.fundingAccountId ? { fundingAccountId: input.fundingAccountId } : {});
      if (!input.fundingAccountId) throw routeNotFoundError();
      return [sampleRoute([ALICE, HUB, BOB])];
    },
  );
  expect(result.fundedByHub).toBe(true);
  expect(result.routes[0]?.path).toEqual([ALICE, HUB, BOB]);
  expect(calls).toEqual([{}, { fundingAccountId: HUB }]);

  const emptyRetryCalls: Array<{ fundingAccountId?: string }> = [];
  const emptyRetry = await quoteEverydayPaymentRoutes(
    { sourceEntityId: ALICE, targetEntityId: BOB, tokenId: 1, amount: 5_000_000n, primaryHubId: HUB, cash: 10_000_000n },
    async input => {
      emptyRetryCalls.push(input.fundingAccountId ? { fundingAccountId: input.fundingAccountId } : {});
      return input.fundingAccountId ? [sampleRoute([ALICE, HUB, BOB])] : [];
    },
  );
  expect(emptyRetry.fundedByHub).toBe(true);
  expect(emptyRetryCalls).toEqual([{}, { fundingAccountId: HUB }]);
});

test('quoteEverydayPaymentRoutes does not retry when cash === 0, primaryHubId is null, or error is non-route', async () => {
  const rejectNoRoute = async () => { throw routeNotFoundError(); };
  await expect(
    quoteEverydayPaymentRoutes({ sourceEntityId: ALICE, targetEntityId: BOB, tokenId: 1, amount: 5_000_000n, primaryHubId: HUB, cash: 0n }, rejectNoRoute),
  ).rejects.toThrow('no payment route');
  await expect(
    quoteEverydayPaymentRoutes({ sourceEntityId: ALICE, targetEntityId: BOB, tokenId: 1, amount: 5_000_000n, primaryHubId: null, cash: 10_000_000n }, rejectNoRoute),
  ).rejects.toThrow('no payment route');
  await expect(
    quoteEverydayPaymentRoutes({ sourceEntityId: ALICE, targetEntityId: BOB, tokenId: 1, amount: 5_000_000n, primaryHubId: HUB, cash: 10_000_000n }, async () => {
      throw Object.assign(new Error('profile sync pending'), { code: 'E_INTERNAL' });
    }),
  ).rejects.toThrow('profile sync pending');
});

test('resolveAcceptedInvoiceJurisdictions validates matching/native jId, rejects foreign jId, handles offline catalog, and keeps u= attribution', async () => {
  const depository = `0x${'dd'.repeat(20)}`;
  const identity = `stack:31337:${depository}`;
  const catalog: StackJurisdiction[] = [{
    key: 'local-anvil', name: 'Local Anvil', chainId: 31337, rpcUrl: 'http://localhost:8545', blockTimeMs: 1000, entityProviderDeploymentBlock: 1,
    contracts: { account: `0x${'aa'.repeat(20)}`, depository, entityProvider: `0x${'ee'.repeat(20)}`, deltaTransformer: `0x${'ff'.repeat(20)}` },
  }];
  const accepted = await resolveAcceptedInvoiceJurisdictions('Local Anvil', identity, async () => catalog);
  expect(accepted).toContain('local-anvil');

  const localInvoice = parseXlnInvoice(`https://xln.finance/#pay/${BOB}?amount=5&token=1&desc=Coffee&u=alice&jId=local-anvil`);
  expect(() => assertInvoiceJurisdiction(localInvoice, accepted)).not.toThrow();
  expect(invoiceNote(localInvoice).description).toBe('Coffee | uid:alice');

  const foreignInvoice = parseXlnInvoice(`https://xln.finance/#pay/${BOB}?amount=5&token=1&jId=sepolia-other`);
  expect(() => assertInvoiceJurisdiction(foreignInvoice, accepted)).toThrow('Invoice jurisdiction does not match the active jurisdiction');

  const offlineAccepted = await resolveAcceptedInvoiceJurisdictions('Local Anvil', identity, async () => { throw new Error('offline'); });
  expect(offlineAccepted).toEqual(['Local Anvil', identity]);
  expect(() => assertInvoiceJurisdiction(foreignInvoice, offlineAccepted)).toThrow('Invoice jurisdiction does not match the active jurisdiction');
});

test('resolveCounterpartySummaries skips fetch when cached or existing and refreshes when missing', async () => {
  const existingSummary: RuntimeAdapterEntitySummary = {
    entityId: BOB, label: 'Bob', isHub: false, runtimeId: 'rt-1', height: 1,
    jurisdiction: { name: 'Local', chainId: 31337, depositoryAddress: `0x${'dd'.repeat(20)}` },
  };
  let gossipCalls = 0;
  let readCalls = 0;
  const deps = {
    ensureGossip: async () => { gossipCalls += 1; },
    readEntities: async () => { readCalls += 1; return [existingSummary]; },
  };

  expect(await resolveCounterpartySummaries(BOB, [], true, deps)).toEqual([]);
  expect(gossipCalls).toBe(0);
  expect(readCalls).toBe(0);

  expect(await resolveCounterpartySummaries(BOB, [existingSummary], false, deps)).toEqual([existingSummary]);
  expect(gossipCalls).toBe(0);
  expect(readCalls).toBe(0);

  expect(await resolveCounterpartySummaries(BOB, [], false, deps)).toEqual([existingSummary]);
  expect(gossipCalls).toBe(1);
  expect(readCalls).toBe(1);
});

const makeFrameWithPeers = (
  selfId: string,
  peers: Array<{ counterpartyId: string; outCapacity: bigint; isHub?: boolean; disputed?: boolean }>,
): RuntimeAdapterViewFrame => ({
  height: 1,
  head: { schemaVersion: 1, latestHeight: 1, latestMaterializedHeight: 1, latestSnapshotHeight: 0, snapshotPeriodFrames: 100, retainSnapshots: 1, epochMaxBytes: 1_048_576, accountMerkleRadix: 16, epochReplayBytes: 0, retainedWalBytes: 0 },
  entities: [
    { entityId: selfId, signerId: SIGNER, height: 1, label: 'Self', isHub: false },
    ...peers.map(p => ({ entityId: p.counterpartyId, signerId: SIGNER, height: 1, label: p.counterpartyId.slice(0, 8), isHub: p.isHub ?? false })),
  ],
  activeEntityId: selfId,
  activeEntity: {
    summary: { entityId: selfId, signerId: SIGNER, height: 1, label: 'Self', isHub: false },
    core: {
      entityId: selfId, signerId: SIGNER, isProposer: true, height: 1, timestamp: 1000, nonces: new Map(), proposals: new Map(), entityEncryptionPublicKey: '',
      config: { mode: 'proposer-based', threshold: 1n, validators: [SIGNER], shares: { [SIGNER]: 1n } },
      reserves: new Map(), debtTotals: { incoming: new Map(), outgoing: new Map() }, lastFinalizedJHeight: 1,
      profile: { name: 'Self', isHub: false, avatar: '', bio: '', website: '' }, paybook: { entries: new Map(), feesEarned: 0n },
    },
    accounts: {
      items: peers.map(p => {
        const isLeft = selfId < p.counterpartyId;
        const [leftEntity, rightEntity] = isLeft ? [selfId, p.counterpartyId] : [p.counterpartyId, selfId];
        const delta = createDefaultDelta(1);
        if (isLeft) delta.leftCreditLimit = p.outCapacity;
        else delta.rightCreditLimit = p.outCapacity;
        return {
          state: {
            leftEntity, rightEntity, domain: { chainId: 31337, depositoryAddress: `0x${'88'.repeat(20)}` },
            watchSeed: '', deltas: new Map([[1, delta]]), locks: new Map(), swapOffers: new Map(),
            leftPendingJClaims: createEmptyAccountJClaimAccumulator(), rightPendingJClaims: createEmptyAccountJClaimAccumulator(),
            lastFinalizedJHeight: 1, disputeConfig: { leftResponseSeconds: 3600, rightResponseSeconds: 86400 },
            jNonce: 1, requestedRebalance: new Map(), requestedRebalanceFeeState: new Map(),
          },
          status: p.disputed ? 'disputed' : 'active',
          ...(p.disputed ? { activeDispute: { observedOnChain: true } } : {}),
          currentHeight: 1, mempool: [], mempoolCount: 0, rollbackCount: 0,
          currentFrame: { height: 1, timestamp: 1000, jHeight: 1, accountTxs: [], prevFrameHash: HASH, accountStateRoot: HASH, stateHash: HASH },
          proofHeader: { fromEntity: leftEntity, toEntity: rightEntity, nextProofNonce: 1 },
          pendingWithdrawals: new Map(), lendingRisk: new Map(), lendingBalances: new Map(),
          shadow: { rebalance: { policy: new Map(), submittedAtByToken: new Map() } },
        };
      }),
      nextCursor: null, totalItems: peers.length,
    },
    books: { items: [], nextCursor: null, totalItems: 0 },
  },
} as unknown as RuntimeAdapterViewFrame);

test('findDirectBilateralRoute synthesizes a 2-hop fee-free route only for non-disputed non-hub tabs with capacity', () => {
  const frame = makeFrameWithPeers(BOB, [
    { counterpartyId: ALICE, outCapacity: 40_000_000n },
    { counterpartyId: HUB, outCapacity: 100_000_000n, isHub: true },
  ]);
  expect(findDirectBilateralRoute({ frame, entityId: BOB, targetEntityId: ALICE, tokenId: 1, amount: 40_000_000n, deriveDeltaFn: deriveDelta })).toEqual({
    path: [BOB, ALICE], totalFee: 0n, senderAmount: 40_000_000n, recipientAmount: 40_000_000n,
  });
  expect(findDirectBilateralRoute({ frame, entityId: BOB, targetEntityId: ALICE, tokenId: 1, amount: 40_000_001n, deriveDeltaFn: deriveDelta })).toBeNull();
  expect(findDirectBilateralRoute({ frame, entityId: BOB, targetEntityId: HUB, tokenId: 1, amount: 10_000_000n, deriveDeltaFn: deriveDelta })).toBeNull();
  expect(findDirectBilateralRoute({
    frame: makeFrameWithPeers(BOB, [{ counterpartyId: ALICE, outCapacity: 40_000_000n, disputed: true }]),
    entityId: BOB, targetEntityId: ALICE, tokenId: 1, amount: 10_000_000n, deriveDeltaFn: deriveDelta,
  })).toBeNull();
});

test('quoteEverydaySettleTabRoute prefers direct bilateral capacity, then self-cycle [self, hub, friend, self], and refuses a plain hub route', async () => {
  const direct = await quoteEverydaySettleTabRoute(
    { wallet: { entityId: BOB, frame: makeFrameWithPeers(BOB, [{ counterpartyId: ALICE, outCapacity: 40_000_000n }]) }, targetEntityId: ALICE, tokenId: 1, amount: 40_000_000n, primaryHubId: HUB },
    async () => { throw new Error('should not query pathfinder when direct capacity fits'); },
  );
  expect(direct.deliveryMode).toBe('direct');
  expect(direct.targetEntityId).toBe(ALICE);
  expect(direct.route.path).toEqual([BOB, ALICE]);

  const cycleCalls: Array<{ targetEntityId: string; fundingAccountId?: string | undefined }> = [];
  const cycle = await quoteEverydaySettleTabRoute(
    { wallet: { entityId: BOB, frame: makeFrameWithPeers(BOB, [{ counterpartyId: ALICE, outCapacity: 0n }]) }, targetEntityId: ALICE, tokenId: 1, amount: 40_000_000n, primaryHubId: HUB },
    async query => {
      cycleCalls.push({ targetEntityId: query.targetEntityId, fundingAccountId: query.fundingAccountId });
      return [sampleRoute([BOB, HUB, `0x${'44'.repeat(32)}`, BOB]), sampleRoute([BOB, HUB, ALICE, BOB])];
    },
  );
  expect(cycle.deliveryMode).toBe('instant');
  expect(cycle.targetEntityId).toBe(BOB);
  expect(cycle.route.path).toEqual([BOB, HUB, ALICE, BOB]);
  expect(cycleCalls).toEqual([{ targetEntityId: BOB, fundingAccountId: HUB }]);

  // Without a self-cycle there is no route that clears the tab; a plain hub
  // payment would pay ALICE and leave BOB's tab debt in place.
  const stdCalls: Array<{ targetEntityId: string; fundingAccountId?: string | undefined }> = [];
  await expect(quoteEverydaySettleTabRoute(
    { wallet: { entityId: BOB, frame: makeFrameWithPeers(BOB, [{ counterpartyId: ALICE, outCapacity: 0n }]) }, targetEntityId: ALICE, tokenId: 1, amount: 40_000_000n, primaryHubId: HUB },
    async query => {
      stdCalls.push({ targetEntityId: query.targetEntityId, fundingAccountId: query.fundingAccountId });
      if (query.targetEntityId === BOB) throw routeNotFoundError();
      return [sampleRoute([BOB, HUB, ALICE])];
    },
  )).rejects.toThrow();
  expect(stdCalls).toEqual([{ targetEntityId: BOB, fundingAccountId: HUB }]);
});

const makeBobHubFrame = (reserveAmount: bigint): RuntimeAdapterViewFrame => ({
  height: 7,
  head: { schemaVersion: 1, latestHeight: 7, latestMaterializedHeight: 7, latestSnapshotHeight: 0, snapshotPeriodFrames: 100, retainSnapshots: 1, epochMaxBytes: 1_048_576, accountMerkleRadix: 16, epochReplayBytes: 0, retainedWalBytes: 0 },
  entities: [{ entityId: BOB, signerId: SIGNER, height: 7, label: 'Bob', isHub: false }],
  activeEntityId: BOB,
  activeEntity: {
    summary: { entityId: BOB, signerId: SIGNER, height: 7, label: 'Bob', isHub: false },
    core: {
      entityId: BOB, signerId: SIGNER, isProposer: true, height: 7, timestamp: 1000, nonces: new Map(), proposals: new Map(), entityEncryptionPublicKey: '',
      config: { mode: 'proposer-based', threshold: 1n, validators: [SIGNER], shares: { [SIGNER]: 1n } },
      reserves: new Map([[1, reserveAmount]]), debtTotals: { incoming: new Map(), outgoing: new Map() }, lastFinalizedJHeight: 3,
      profile: { name: 'Bob', isHub: false, avatar: '', bio: '', website: '' }, paybook: { entries: new Map(), feesEarned: 0n },
    },
    accounts: {
      items: [{
        state: {
          leftEntity: BOB, rightEntity: HUB, domain: { chainId: 31337, depositoryAddress: `0x${'88'.repeat(20)}` },
          watchSeed: '', deltas: new Map([[1, createDefaultDelta(1)]]), locks: new Map(), swapOffers: new Map(),
          leftPendingJClaims: createEmptyAccountJClaimAccumulator(), rightPendingJClaims: createEmptyAccountJClaimAccumulator(),
          lastFinalizedJHeight: 3, disputeConfig: { leftResponseSeconds: 3600, rightResponseSeconds: 86400 },
          jNonce: 1, requestedRebalance: new Map(), requestedRebalanceFeeState: new Map(),
        },
        status: 'active', currentHeight: 5, mempool: [], mempoolCount: 0, rollbackCount: 0,
        currentFrame: { height: 5, timestamp: 1000, jHeight: 3, accountTxs: [], prevFrameHash: HASH, accountStateRoot: HASH, stateHash: HASH },
        proofHeader: { fromEntity: BOB, toEntity: HUB, nextProofNonce: 2 },
        pendingWithdrawals: new Map(), lendingRisk: new Map(), lendingBalances: new Map(),
        shadow: { rebalance: { policy: new Map(), submittedAtByToken: new Map() } },
      }],
      nextCursor: null, totalItems: 1,
    },
    books: { items: [], nextCursor: null, totalItems: 0 },
  },
});

test('E5 Settle up chains quoteEverydaySettleTabRoute -> planEverydaySend -> buildPaymentRuntimeInput on [BOB, HUB, ALICE, BOB]', async () => {
  const quoted = await quoteEverydaySettleTabRoute(
    { wallet: { entityId: BOB, frame: makeFrameWithPeers(BOB, [{ counterpartyId: ALICE, outCapacity: 0n }]) }, targetEntityId: ALICE, tokenId: 1, amount: 40_000_000n, primaryHubId: HUB },
    async () => [{
      path: [BOB, HUB, ALICE, BOB],
      totalFee: 40_000n, senderAmount: 40_040_000n, recipientAmount: 40_000_000n,
    }],
  );
  expect(quoted.targetEntityId).toBe(BOB);
  expect(quoted.deliveryMode).toBe('instant');

  const plan = planEverydaySend({
    frame: makeBobHubFrame(100_000_000n), entityId: BOB, signerId: SIGNER, targetEntityId: quoted.targetEntityId,
    tokenId: 1, deliveryMode: quoted.deliveryMode, description: 'Settled tab',
    route: quoted.route, externalRows: [], nativeBalance: 1_000_000n, deriveDeltaFn: deriveDelta,
  });
  expect(plan.kind).toBe('fund-and-pay');
  if (plan.kind !== 'fund-and-pay') throw new Error(`Expected fund-and-pay, got ${plan.kind}`);
  expect(plan.paymentInput.entityInputs?.[0]?.entityTxs?.[0]?.type).toBe('htlcPayment');

  const runtimeInput = buildPaymentRuntimeInput({
    entityId: BOB, signerId: SIGNER, targetEntityId: quoted.targetEntityId,
    tokenId: 1, deliveryMode: quoted.deliveryMode, description: 'Settled tab', route: quoted.route,
  });
  expect(runtimeInput.entityInputs?.[0]?.entityTxs?.[0]).toMatchObject({
    type: 'htlcPayment',
    data: { targetEntityId: BOB, route: [BOB, HUB, ALICE, BOB], deliveryMode: 'instant' },
  });
  expect(() =>
    buildPaymentRuntimeInput({
      entityId: BOB, signerId: SIGNER, targetEntityId: ALICE,
      tokenId: 1, deliveryMode: quoted.deliveryMode, description: 'Settled tab', route: quoted.route,
    }),
  ).toThrow('Payment route endpoints mismatch');
});
