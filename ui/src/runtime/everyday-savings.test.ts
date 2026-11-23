import { afterAll, afterEach, expect, spyOn, test } from 'bun:test';
import { createDefaultDelta } from '@xln/core/account/state/delta';
import { asTokenDecimals } from '@xln/core/account/tx/units';
import { deriveDelta } from '@xln/core/account/utils';
import type { RuntimeAdapterEntitySummary, RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import { EVERYDAY_COPY } from '@xln/frontend/lib/everyday/wallet-posture';
import type { AccountView, WalletView } from './views';

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
  executeEverydaySavingsDeposit,
  quoteEverydaySettleTabRoute,
  resolveCounterpartySummaries,
} = await import('../components/everyday/everyday-actions');
const adapterMod = await import('./adapter');
const lendingMod = await import('./financial/lending');
const moveMod = await import('./financial/move');
const txMod = await import('./tx');
const xlnLoaderMod = await import('./xln-loader');

afterAll(() => {
  while (restoreGlobals.length > 0) restoreGlobals.pop()?.();
});

const SELF = `0x${'11'.repeat(32)}`;
const HUB = `0x${'22'.repeat(32)}`;
const FRIEND = `0x${'33'.repeat(32)}`;
const SIGNER = `0x${'44'.repeat(20)}`;
const TOKEN_ADDR = `0x${'55'.repeat(20)}`;

const makeHubDoc = (outCollateral: bigint, hasRisk = true) =>
  ({
    status: 'active',
    lendingRisk: hasRisk
      ? new Map([[1, { leftLimit: 0n, rightLimit: 0n, leftCouponCapacity: 0n, rightCouponCapacity: 0n }]])
      : new Map(),
    state: {
      leftEntity: SELF,
      rightEntity: HUB,
      deltas: new Map([[1, { ...createDefaultDelta(1), collateral: outCollateral, ondelta: outCollateral }]]),
    },
  }) as unknown as AccountView['doc'];

const makeWallet = (opts: {
  outCollateral?: bigint;
  reserve?: bigint;
  sentBatch?: boolean;
  hasHub?: boolean;
  hasRisk?: boolean;
}): WalletView => {
  const doc = makeHubDoc(opts.outCollateral ?? 0n, opts.hasRisk ?? true);
  const delta = doc.state.deltas.get(1)!;
  const account: AccountView = {
    counterpartyId: HUB,
    isLeft: true,
    label: 'Hub',
    isHub: true,
    tokens: [{ tokenId: 1, delta, derived: deriveDelta(delta, true), signed: 0n }],
    disputed: false,
    dispute: 'none',
    settlement: 'none',
    frameHeight: 1,
    doc,
  };
  const frame = {
    activeEntity: {
      core: {
        reserves: new Map([[1, opts.reserve ?? 0n]]),
        jBatchState: opts.sentBatch ? { sentBatch: { nonce: 1 } } : {},
      },
      accounts: { items: [doc] },
    },
  } as unknown as RuntimeAdapterViewFrame;
  return {
    entityId: SELF,
    signerId: SIGNER,
    accounts: opts.hasHub === false ? [] : [account],
    frame,
  } as unknown as WalletView;
};

const spies: Array<{ mockRestore: () => void }> = [];
afterEach(() => {
  while (spies.length > 0) spies.pop()?.mockRestore();
});

test('executeEverydaySavingsDeposit validates startup, amount, hub, sentBatch, balance, and gas guards', async () => {
  const baseTerms = { termId: 'demand' as const, savingsInterestBps: 500 };
  const peekSpy = spyOn(xlnLoaderMod, 'peekXLN').mockReturnValue(null);
  spies.push(peekSpy);

  await expect(
    executeEverydaySavingsDeposit({
      wallet: makeWallet({ outCollateral: 10_000_000n }),
      externalWallet: null,
      hubId: HUB,
      tokenId: 1,
      amount: 10_000_000n,
      amountText: '10',
      decimals: asTokenDecimals(6),
      terms: baseTerms,
    }),
  ).rejects.toThrow('Wallet runtime is still starting.');

  peekSpy.mockReturnValue({ deriveDelta } as unknown as ReturnType<typeof xlnLoaderMod.peekXLN>);

  await expect(
    executeEverydaySavingsDeposit({
      wallet: makeWallet({ outCollateral: 10_000_000n }),
      externalWallet: null,
      hubId: HUB,
      tokenId: 1,
      amount: 0n,
      amountText: '0',
      decimals: asTokenDecimals(6),
      terms: baseTerms,
    }),
  ).rejects.toThrow('Enter an amount greater than zero.');

  await expect(
    executeEverydaySavingsDeposit({
      wallet: makeWallet({ hasHub: false }),
      externalWallet: null,
      hubId: HUB,
      tokenId: 1,
      amount: 10_000_000n,
      amountText: '10',
      decimals: asTokenDecimals(6),
      terms: baseTerms,
    }),
  ).rejects.toThrow('Savings is unavailable right now.');

  await expect(
    executeEverydaySavingsDeposit({
      wallet: makeWallet({ outCollateral: 0n, sentBatch: true }),
      externalWallet: null,
      hubId: HUB,
      tokenId: 1,
      amount: 10_000_000n,
      amountText: '10',
      decimals: asTokenDecimals(6),
      terms: baseTerms,
    }),
  ).rejects.toThrow('A deposit is already finishing');

  await expect(
    executeEverydaySavingsDeposit({
      wallet: makeWallet({ outCollateral: 0n }),
      externalWallet: { native: 1_000n, rows: [{ address: TOKEN_ADDR, tokenId: 1, balance: 5_000_000n, allowance: 10_000_000n }] } as never,
      hubId: HUB,
      tokenId: 1,
      amount: 10_000_000n,
      amountText: '10',
      decimals: asTokenDecimals(6),
      terms: baseTerms,
    }),
  ).rejects.toThrow('Not enough Cash available to add this amount to Savings.');

  await expect(
    executeEverydaySavingsDeposit({
      wallet: makeWallet({ outCollateral: 0n, reserve: 10_000_000n }),
      externalWallet: { native: 0n, rows: [] } as never,
      hubId: HUB,
      tokenId: 1,
      amount: 10_000_000n,
      amountText: '10',
      decimals: asTokenDecimals(6),
      terms: baseTerms,
    }),
  ).rejects.toThrow('Add a small amount of network gas before adding to Savings.');
});

test('executeEverydaySavingsDeposit handles direct capacity, approval+waitFor polling, and fails closed when previewSavingsRisk is !ok', async () => {
  spies.push(spyOn(xlnLoaderMod, 'peekXLN').mockReturnValue({ deriveDelta } as unknown as ReturnType<typeof xlnLoaderMod.peekXLN>));
  const baseTerms = { termId: 'demand' as const, savingsInterestBps: 500 };

  // Direct capacity skips approveDepository & waitFor, emits [extendCredit, lendingOffer]
  const sentBatches: unknown[][] = [];
  const sendSpy = spyOn(txMod, 'sendEntityTxs').mockImplementation(async (_e, _s, txs) => {
    sentBatches.push(txs);
    return { ok: true } as never;
  });
  const approveSpy = spyOn(moveMod, 'approveDepository').mockResolvedValue(undefined as never);
  spies.push(sendSpy, approveSpy);

  const stages: string[] = [];
  await executeEverydaySavingsDeposit({
    wallet: makeWallet({ outCollateral: 10_000_000n }),
    externalWallet: null,
    hubId: HUB,
    tokenId: 1,
    amount: 10_000_000n,
    amountText: '10',
    decimals: asTokenDecimals(6),
    terms: baseTerms,
    onStage: s => stages.push(s),
  });
  expect(approveSpy).toHaveBeenCalledTimes(0);
  expect(stages).toEqual(['Moving to Savings...']);
  expect(sentBatches[0]?.map((t: any) => t.type)).toEqual(['extendCredit', 'lendingOffer']);

  // Approval + waitFor polls until refreshed activeHub has outCapacity >= amount, then fails closed if risk is !ok
  spies.push(spyOn(txMod, 'waitFor').mockImplementation(async pred => { while (!(await pred())) {} }));
  let frameReads = 0;
  spies.push(spyOn(adapterMod, 'requireAdapter').mockReturnValue({
    read: async () => {
      frameReads += 1;
      return {
        activeEntity: {
          accounts: { items: [makeHubDoc(frameReads >= 2 ? 10_000_000n : 0n, false)] },
        },
      };
    },
  } as never));
  spies.push(spyOn(lendingMod, 'previewSavingsRisk').mockReturnValue({ ok: false, error: 'Bank risk projection is unavailable' }));

  await expect(
    executeEverydaySavingsDeposit({
      wallet: makeWallet({ outCollateral: 0n }),
      externalWallet: { native: 1_000n, rows: [{ address: TOKEN_ADDR, tokenId: 1, balance: 20_000_000n, allowance: null }] } as never,
      hubId: HUB,
      tokenId: 1,
      amount: 10_000_000n,
      amountText: '10',
      decimals: asTokenDecimals(6),
      terms: baseTerms,
    }),
  ).rejects.toThrow('Bank risk projection is unavailable');
  expect(approveSpy).toHaveBeenCalledTimes(1);
  expect(frameReads).toBe(2);
  // Only the funding tx batch was sent; lendingOffer MUST NOT be submitted when previewSavingsRisk fails!
  expect(sentBatches).toHaveLength(2);
  // Disputed hub, empty tokenAddress, and queued batchFundsPair reuse guards
  const disputedWallet = makeWallet({ outCollateral: 0n });
  disputedWallet.frame!.activeEntity!.accounts.items[0]!.status = 'disputed';
  await expect(
    executeEverydaySavingsDeposit({
      wallet: disputedWallet,
      externalWallet: null,
      hubId: HUB,
      tokenId: 1,
      amount: 10_000_000n,
      amountText: '10',
      decimals: asTokenDecimals(6),
      terms: baseTerms,
    }),
  ).rejects.toThrow('Savings is paused while your hub account is in recovery.');

  await expect(
    executeEverydaySavingsDeposit({
      wallet: makeWallet({ outCollateral: 0n }),
      externalWallet: { native: 1_000n, rows: [{ address: '   ', tokenId: 1, balance: 50_000_000n, allowance: 50_000_000n }] } as never,
      hubId: HUB,
      tokenId: 1,
      amount: 10_000_000n,
      amountText: '10',
      decimals: asTokenDecimals(6),
      terms: baseTerms,
    }),
  ).rejects.toThrow('Not enough Cash available to add this amount to Savings.');

  // Queued r2c batch funding the same hub skips duplicate funding submission and only waits
  const queuedWallet = makeWallet({ outCollateral: 0n });
  queuedWallet.frame!.activeEntity!.core.jBatchState = {
    batch: { reserveToCollateral: [{ tokenId: 1, receivingEntity: SELF, pairs: [{ entity: HUB, amount: 10_000_000n }] }] },
  } as never;
  const batchesBefore = sentBatches.length;
  spies.push(spyOn(lendingMod, 'previewSavingsRisk').mockReturnValue({
    ok: true,
    requiredLimit: 10_500_000n,
    currentLimit: 0n,
    couponCapacity: 0n,
    interest: 500_000n,
  } as never));
  await executeEverydaySavingsDeposit({
    wallet: queuedWallet,
    externalWallet: null,
    hubId: HUB,
    tokenId: 1,
    amount: 10_000_000n,
    amountText: '10',
    decimals: asTokenDecimals(6),
    terms: baseTerms,
  });
  expect(sentBatches.length).toBe(batchesBefore + 1);
  expect(sentBatches.at(-1)?.map((t: any) => t.type)).toEqual(['extendCredit', 'lendingOffer']);
});

test('executeEverydaySavingsDeposit aborts immediately if hub enters dispute during funding poll and normalizes mixed-case IDs', async () => {
  spies.push(spyOn(xlnLoaderMod, 'peekXLN').mockReturnValue({ deriveDelta } as unknown as ReturnType<typeof xlnLoaderMod.peekXLN>));
  const baseTerms = { termId: 'demand' as const, savingsInterestBps: 500 };
  const sentBatches: unknown[][] = [];
  spies.push(spyOn(txMod, 'sendEntityTxs').mockImplementation(async (_e, _s, txs) => {
    sentBatches.push(txs);
    return { ok: true } as never;
  }));
  spies.push(spyOn(moveMod, 'approveDepository').mockResolvedValue(undefined as never));
  spies.push(spyOn(txMod, 'waitFor').mockImplementation(async pred => { while (!(await pred())) {} }));

  const mixedHub = `0x${'22'.repeat(31)}AA`;
  let pollReads = 0;
  spies.push(spyOn(adapterMod, 'requireAdapter').mockReturnValue({
    read: async () => {
      pollReads += 1;
      const disputedHub = makeHubDoc(0n, true);
      disputedHub.status = 'disputed';
      disputedHub.state.rightEntity = mixedHub.toLowerCase();
      return { activeEntity: { accounts: { items: [disputedHub] } } };
    },
  } as never));

  const mixedWallet = makeWallet({ outCollateral: 0n, reserve: 10_000_000n });
  mixedWallet.accounts[0]!.counterpartyId = mixedHub.toLowerCase();
  mixedWallet.frame!.activeEntity!.accounts.items[0]!.state.rightEntity = mixedHub.toLowerCase();

  await expect(
    executeEverydaySavingsDeposit({
      wallet: { ...mixedWallet, entityId: SELF.toUpperCase().replace('0X', '0x') },
      externalWallet: { native: 1_000n, rows: [] } as never,
      hubId: mixedHub,
      tokenId: 1,
      amount: 10_000_000n,
      amountText: '10',
      decimals: asTokenDecimals(6),
      terms: baseTerms,
    }),
  ).rejects.toThrow('Savings is paused while your hub account is in recovery.');
  expect(pollReads).toBe(1);
  // Only the funding tx was sent; lendingOffer was aborted and funding lock was released.
  expect(sentBatches).toHaveLength(1);
  expect(sentBatches[0]?.map((t: any) => t.type)).not.toContain('lendingOffer');

  // Lock was released after dispute abort so a subsequent call enters cleanly (and hits the same dispute guard)
  await expect(
    executeEverydaySavingsDeposit({
      wallet: { ...mixedWallet, entityId: SELF },
      externalWallet: { native: 1_000n, rows: [] } as never,
      hubId: mixedHub.toLowerCase(),
      tokenId: 1,
      amount: 10_000_000n,
      amountText: '10',
      decimals: asTokenDecimals(6),
      terms: baseTerms,
    }),
  ).rejects.toThrow('Savings is paused while your hub account is in recovery.');
});

test('quoteEverydaySettleTabRoute rethrows non-E_NOT_FOUND errors and fails on empty routes; resolveCounterpartySummaries fetches when isHub is undefined', async () => {
  await expect(
    quoteEverydaySettleTabRoute(
      { wallet: { entityId: SELF, frame: null }, targetEntityId: FRIEND, tokenId: 1, amount: 10_000_000n, primaryHubId: HUB },
      async () => { throw Object.assign(new Error('BACKEND_UNAVAILABLE'), { code: 'E_INTERNAL' }); },
    ),
  ).rejects.toThrow('BACKEND_UNAVAILABLE');

  await expect(
    quoteEverydaySettleTabRoute(
      { wallet: { entityId: SELF, frame: null }, targetEntityId: FRIEND, tokenId: 1, amount: 10_000_000n, primaryHubId: HUB },
      async () => [],
    ),
  ).rejects.toThrow(EVERYDAY_COPY.flows.settleTab.failed);

  let gossip = 0;
  let reads = 0;
  const partial: RuntimeAdapterEntitySummary = { entityId: FRIEND, label: 'Friend', height: 1, signerId: SIGNER };
  const resolved: RuntimeAdapterEntitySummary = { ...partial, isHub: false };
  const out = await resolveCounterpartySummaries(FRIEND, [partial], false, {
    ensureGossip: async () => { gossip += 1; },
    readEntities: async () => { reads += 1; return [resolved]; },
  });
  expect(gossip).toBe(1);
  expect(reads).toBe(1);
  expect(out).toEqual([resolved]);
});
