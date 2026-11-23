import { afterEach, expect, spyOn, test } from 'bun:test';
import { createDefaultDelta } from '../../../core/account/state/delta';
import { deriveDelta } from '../../../core/account/utils';
import type { EntityTx, JBatch, RuntimeAdapterViewFrame, XLNModule } from '../../../core/api/public/runtime-module';
import { submitEverydaySavingsDeposit } from '../../../frontend/src/lib/components/Everyday/everyday-funding';
import { submitSavingsDeposit } from '../../../frontend/src/lib/everyday/everyday-savings';
import {
  claimFundingSubmission,
  fundingSubmissionKey,
  hasFundingSubmission,
  observeFundingBatches,
  releaseFundingSubmission,
} from '../../../frontend/src/lib/everyday/funding-submission';
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

test('mid-poll observeFundingBatches clearing submissions cannot admit a second Savings lendingOffer', async () => {
  const domain = { chainId: 31337, depositoryAddress: DEPOSITORY };
  const draftBatch = {
    reserveToCollateral: [{ tokenId: 1, receivingEntity: SELF, pairs: [{ entity: HUB, amount: 25_000_000n }] }],
  } as unknown as JBatch;
  const reserveFrame = {
    activeEntity: {
      core: { reserves: new Map([[1, 25_000_000n]]), jBatchState: {} },
      accounts: {
        items: [{
          status: 'active',
          state: { leftEntity: SELF, rightEntity: HUB, domain, deltas: new Map([[1, createDefaultDelta(1)]]) },
        }],
      },
    },
  } as unknown as RuntimeAdapterViewFrame;
  const draftVisibleFrame = {
    activeEntity: {
      core: { reserves: new Map(), jBatchState: { batch: draftBatch } },
      accounts: reserveFrame.activeEntity!.accounts,
    },
  } as unknown as RuntimeAdapterViewFrame;
  const lendingRisk = new Map([[1, { leftLimit: 0n, rightLimit: 0n, leftCouponCapacity: 0n, rightCouponCapacity: 0n }]]);
  const confirmedFrame = {
    activeEntity: {
      core: { reserves: new Map(), jBatchState: {} },
      accounts: {
        items: [{
          status: 'active',
          lendingRisk,
          state: {
            leftEntity: SELF,
            rightEntity: HUB,
            domain,
            deltas: new Map([[1, { ...createDefaultDelta(1), collateral: 25_000_000n, ondelta: 25_000_000n }]]),
          },
        }],
      },
    },
  } as unknown as RuntimeAdapterViewFrame;

  let releasePoll!: () => void;
  let pollStarted!: () => void;
  const pollGate = new Promise<void>(resolve => { releasePoll = resolve; });
  const enteredPoll = new Promise<void>(resolve => { pollStarted = resolve; });
  const sentBatches: EntityTx[][] = [];

  const adapter = {
    deriveDelta,
    readViewFrame: async () => {
      pollStarted();
      await pollGate;
      return confirmedFrame;
    },
    sendEntityTxs: async (txs: EntityTx[]) => { sentBatches.push(txs); },
    approveDepository: async () => {},
    resolveTerms: async () => ({ termId: 'demand' as const, savingsInterestBps: 500 }),
  };

  const first = submitSavingsDeposit({
    frame: reserveFrame,
    entityId: SELF,
    hubId: HUB,
    tokenId: 1,
    amount: 25_000_000n,
    amountText: '25',
    decimals: 6,
    externalRows: [],
    nativeBalance: 10n ** 17n,
  }, adapter);

  await enteredPoll;
  // Shell.tsx calls observeFundingBatches as soon as the draft r2c batch appears in the frame.
  observeFundingBatches(SELF, [draftBatch]);
  expect(hasFundingSubmission(fundingSubmissionKey(SELF, HUB, 1))).toBe(false);

  // A second tap mid-poll must still be rejected so buildLendingOfferTx cannot fire twice.
  await expect(submitSavingsDeposit({
    frame: draftVisibleFrame,
    entityId: SELF,
    hubId: HUB,
    tokenId: 1,
    amount: 25_000_000n,
    amountText: '25',
    decimals: 6,
    externalRows: [],
    nativeBalance: 10n ** 17n,
  }, adapter)).rejects.toThrow('already in progress');

  releasePoll();
  await first;
  const offerCount = sentBatches.flat().filter(tx => tx.type === 'lendingOffer').length;
  expect(offerCount).toBe(1);
});

test('a throwing funding claim preserves the other caller lock and leaves Savings unstuck', async () => {
  const key = fundingSubmissionKey(SELF, HUB, 1);
  claimFundingSubmission(key);
  try {
    await expect(submitSavingsDeposit({
      frame,
      entityId: SELF,
      hubId: HUB,
      tokenId: 1,
      amount: 25_000_000n,
      amountText: '25',
      decimals: 6,
      externalRows: [],
      nativeBalance: null,
    }, {
      deriveDelta,
      readViewFrame: async () => frame,
      sendEntityTxs: async () => {},
      approveDepository: async () => {},
      resolveTerms: async () => ({ termId: 'demand' as const, savingsInterestBps: 500 }),
    })).rejects.toThrow('awaiting confirmation');
    // Savings did not clear Pay's active funding claim.
    expect(hasFundingSubmission(key)).toBe(true);
  } finally {
    releaseFundingSubmission(key);
  }
  // Savings is not stuck in savingsDepositsInFlight after the failed claim.
  await expect(submitSavingsDeposit({
    frame,
    entityId: SELF,
    hubId: HUB,
    tokenId: 1,
    amount: 25_000_000n,
    amountText: '25',
    decimals: 6,
    externalRows: [],
    nativeBalance: null,
  }, {
    deriveDelta,
    readViewFrame: async () => frame,
    sendEntityTxs: async () => {},
    approveDepository: async () => {},
    resolveTerms: async () => { throw new Error('reached-terms'); },
  })).rejects.toThrow('reached-terms');
});
