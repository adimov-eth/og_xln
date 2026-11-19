import { afterEach, expect, spyOn, test } from 'bun:test';
import { createDefaultDelta } from '../../../core/account/state/delta';
import { deriveDelta } from '../../../core/account/utils';
import type { RuntimeAdapterViewFrame, XLNModule } from '../../../core/api/public/runtime-module';
import { submitEverydaySavingsDeposit } from '../../../frontend/src/lib/components/Everyday/everyday-funding';
import { runtimeQueryClient } from '../../../frontend/src/lib/stores/runtimeQueryClient';

const SELF = `0x${'11'.repeat(32)}`;
const HUB = `0x${'33'.repeat(32)}`;
const DEPOSITORY = `0x${'55'.repeat(20)}`;
const realFetch = globalThis.fetch;
const spies: Array<{ mockRestore: () => void }> = [];
afterEach(() => {
  globalThis.fetch = realFetch;
  while (spies.length > 0) spies.pop()?.mockRestore();
});

const frame = {
  activeEntity: { accounts: { items: [{ state: { leftEntity: SELF, rightEntity: HUB, domain: {}, deltas: new Map() } }] } },
} as unknown as RuntimeAdapterViewFrame;

const params = {
  frame, entityId: SELF, signerId: `0x${'44'.repeat(20)}`, hubId: HUB, tokenId: 1,
  amountText: '25', principal: 25_000_000n, decimals: 6,
  externalRows: [], nativeBalance: null, liveEnv: null, xln: {} as XLNModule,
};

test('a second Savings deposit to the same hub is refused while the first is in progress', async () => {
  let release!: () => void;
  globalThis.fetch = (() => new Promise<Response>((_resolve, reject) => {
    release = () => reject(new Error('stop'));
  })) as unknown as typeof fetch;

  const first = submitEverydaySavingsDeposit(params);
  await expect(submitEverydaySavingsDeposit(params)).rejects.toThrow('already in progress');

  release();
  await expect(first).rejects.toThrow();
  // The lock is released when the first deposit ends, whatever its outcome.
  globalThis.fetch = (() => Promise.reject(new Error('stop again'))) as unknown as typeof fetch;
  await expect(submitEverydaySavingsDeposit(params)).rejects.toThrow('stop again');
});

test('Svelte Savings funding poll aborts immediately if hub enters dispute and releases the lock', async () => {
  const domain = { chainId: 31337, depositoryAddress: DEPOSITORY };
  const queuedFrame = {
    activeEntity: {
      core: {
        reserves: new Map(),
        jBatchState: {
          batch: { reserveToCollateral: [{ tokenId: 1, receivingEntity: SELF, pairs: [{ entity: HUB, amount: 25_000_000n }] }] },
        },
      },
      accounts: {
        items: [{
          status: 'active',
          state: { leftEntity: SELF, rightEntity: HUB, domain, deltas: new Map([[1, createDefaultDelta(1)]]) },
        }],
      },
    },
  } as unknown as RuntimeAdapterViewFrame;

  let reads = 0;
  spies.push(spyOn(runtimeQueryClient, 'readViewFrame').mockImplementation(async () => {
    reads += 1;
    return {
      activeEntity: {
        accounts: {
          items: [{
            status: 'disputed',
            state: { leftEntity: SELF, rightEntity: HUB, domain, deltas: new Map([[1, createDefaultDelta(1)]]) },
          }],
        },
      },
    } as unknown as RuntimeAdapterViewFrame;
  }));

  const lendingState = {
    terms: [{
      chainId: 31337,
      depositoryAddress: DEPOSITORY,
      tokenId: 1,
      termId: 'demand' as const,
      savingsInterestBps: 500,
      loanInterestBps: 800,
      loanLateMs: 0,
      expiresAt: Date.now() + 60_000,
    }],
    savings: [],
    loans: [],
  };

  await expect(
    submitEverydaySavingsDeposit({
      ...params,
      frame: queuedFrame,
      lendingState: lendingState as never,
      xln: { deriveDelta } as unknown as XLNModule,
    }),
  ).rejects.toThrow('Savings is paused while your hub account is in recovery.');
  expect(reads).toBe(1);

  // Lock was released so a second call runs instead of failing with 'already in progress'
  await expect(
    submitEverydaySavingsDeposit({
      ...params,
      frame: queuedFrame,
      lendingState: lendingState as never,
      xln: { deriveDelta } as unknown as XLNModule,
    }),
  ).rejects.toThrow('Savings is paused while your hub account is in recovery.');
  expect(reads).toBe(2);
});
