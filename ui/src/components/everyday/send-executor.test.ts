import { afterEach, expect, spyOn, test } from 'bun:test';
import { createDefaultDelta } from '@xln/core/account/state/delta';
import { deriveDelta } from '@xln/core/account/utils';
import type { RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import { SURFACES } from '@xln/surfaces/surfaces.generated';
import * as adapterMod from '../../runtime/adapter';
import * as commandsMod from '../../runtime/commands';
import * as moveMod from '../../runtime/financial/move';
import * as storeMod from '../../runtime/store';
import * as txMod from '../../runtime/tx';
import * as xlnLoaderMod from '../../runtime/xln-loader';
import type { WalletView } from '../../runtime/views';
import { executeEverydaySend, explainEverydaySendBlock } from './send-executor';

const SELF = `0x${'11'.repeat(32)}`;
const HUB = `0x${'22'.repeat(32)}`;
const FRIEND = `0x${'33'.repeat(32)}`;
const SIGNER = `0x${'44'.repeat(20)}`;
const TOKEN_ADDR = `0x${'55'.repeat(20)}`;

const makeFrame = (opts: {
  outCollateral?: bigint;
  reserve?: bigint;
  disputed?: boolean;
  sentBatch?: boolean;
}): RuntimeAdapterViewFrame =>
  ({
    activeEntityId: SELF,
    entities: [{ entityId: SELF, signerId: SIGNER, height: 1, label: 'Bob', isHub: false }],
    activeEntity: {
      summary: { entityId: SELF, signerId: SIGNER, height: 1, label: 'Bob', isHub: false },
      core: {
        signerId: SIGNER,
        reserves: new Map([[1, opts.reserve ?? 0n]]),
        jBatchState: opts.sentBatch ? { sentBatch: { nonce: 1 } } : {},
        config: {},
      },
      accounts: {
        items: [
          {
            status: opts.disputed ? 'disputed' : 'active',
            ...(opts.disputed ? { activeDispute: { observedOnChain: true } } : {}),
            state: {
              leftEntity: SELF,
              rightEntity: HUB,
              deltas: new Map([
                [1, { ...createDefaultDelta(1), collateral: opts.outCollateral ?? 0n, ondelta: opts.outCollateral ?? 0n }],
              ]),
            },
          },
        ],
      },
    },
  }) as unknown as RuntimeAdapterViewFrame;

const makeWallet = (frame: RuntimeAdapterViewFrame): WalletView =>
  ({ entityId: SELF, signerId: SIGNER, frame }) as unknown as WalletView;

const route = { path: [SELF, HUB, FRIEND], totalFee: 0n, senderAmount: 10_000_000n, recipientAmount: 10_000_000n };

const spies: Array<{ mockRestore: () => void }> = [];
afterEach(() => {
  while (spies.length > 0) spies.pop()?.mockRestore();
});

test('explainEverydaySendBlock maps all 4 blocked plan kinds to exact messages', () => {
  const paymentInput = { runtimeTxs: [], entityInputs: [] };
  expect(explainEverydaySendBlock({ kind: 'pending-funding', reason: 'queued-deposit', paymentInput }))
    .toBe('A deposit is already finishing. Try again in a moment.');
  expect(explainEverydaySendBlock({ kind: 'needs-gas', requiredTx: 'e2r', paymentInput }))
    .toBe('Add a small amount of network gas before sending.');
  expect(explainEverydaySendBlock({ kind: 'disputed', counterpartyId: HUB }))
    .toBe('This account is paused for recovery right now.');
  expect(explainEverydaySendBlock({ kind: 'insufficient', shortfall: 5n }))
    .toBe('Not enough Cash is available for this payment.');
});

test('executeEverydaySend throws when runtime is starting, sends ready directly, and rejects blocked plans without claiming lock', async () => {
  const peekSpy = spyOn(xlnLoaderMod, 'peekXLN').mockReturnValue(null);
  spies.push(peekSpy);
  await expect(
    executeEverydaySend({
      wallet: makeWallet(makeFrame({ outCollateral: 10_000_000n })),
      externalWallet: null,
      targetEntityId: FRIEND,
      tokenId: 1,
      deliveryMode: 'instant',
      description: 'Pay',
      route,
    }),
  ).rejects.toThrow('Wallet runtime is still starting.');

  peekSpy.mockReturnValue({ deriveDelta } as unknown as ReturnType<typeof xlnLoaderMod.peekXLN>);
  const stages: string[] = [];
  const sendSpy = spyOn(commandsMod, 'sendRuntimeInput').mockResolvedValue({ ok: true } as never);
  const approveSpy = spyOn(moveMod, 'approveDepository').mockResolvedValue(undefined as never);
  spies.push(sendSpy, approveSpy);

  await executeEverydaySend({
    wallet: makeWallet(makeFrame({ outCollateral: 10_000_000n })),
    externalWallet: null,
    targetEntityId: FRIEND,
    tokenId: 1,
    deliveryMode: 'instant',
    description: 'Pay',
    route,
    onStage: s => stages.push(s),
  });
  expect(stages).toEqual([SURFACES.everyday.flows.pay.pending.text]);
  expect(sendSpy).toHaveBeenCalledTimes(1);
  expect(approveSpy).toHaveBeenCalledTimes(0);

  for (const frame of [
    makeFrame({ outCollateral: 0n, sentBatch: true }),
    makeFrame({ outCollateral: 0n, disputed: true }),
    makeFrame({ outCollateral: 0n }),
  ]) {
    await expect(
      executeEverydaySend({
        wallet: makeWallet(frame),
        externalWallet: null,
        targetEntityId: FRIEND,
        tokenId: 1,
        deliveryMode: 'instant',
        description: 'Pay',
        route,
      }),
    ).rejects.toThrow();
  }
  await expect(
    executeEverydaySend({
      wallet: makeWallet(makeFrame({ outCollateral: 0n, reserve: 10_000_000n })),
      externalWallet: { native: 0n, rows: [] } as never,
      targetEntityId: FRIEND,
      tokenId: 1,
      deliveryMode: 'instant',
      description: 'Pay',
      route,
    }),
  ).rejects.toThrow('Add a small amount of network gas before sending.');
});

test('executeEverydaySend deduplicates concurrent fund-and-pay, releases key on failure, polls transient states, and aborts immediately on disputed', async () => {
  spies.push(spyOn(xlnLoaderMod, 'peekXLN').mockReturnValue({ deriveDelta } as unknown as ReturnType<typeof xlnLoaderMod.peekXLN>));
  const externalWallet = {
    native: 1_000_000n,
    rows: [{ address: TOKEN_ADDR, tokenId: 1, balance: 20_000_000n, allowance: 0n }],
  };
  spies.push(spyOn(storeMod.useApp, 'getState').mockReturnValue({ externalWallet } as never));

  let releaseApprove!: () => void;
  let rejectFirstApprove = false;
  const approveSpy = spyOn(moveMod, 'approveDepository').mockImplementation(
    () =>
      new Promise<bigint>((resolve, reject) => {
        releaseApprove = () => (rejectFirstApprove ? reject(new Error('APPROVE_FAILED')) : resolve(0n));
      }),
  );
  spies.push(approveSpy);

  const firstAttempt = executeEverydaySend({
    wallet: makeWallet(makeFrame({ outCollateral: 0n })),
    externalWallet: externalWallet as never,
    targetEntityId: FRIEND,
    tokenId: 1,
    deliveryMode: 'instant',
    description: 'Pay',
    route,
  });
  await expect(
    executeEverydaySend({
      wallet: makeWallet(makeFrame({ outCollateral: 0n })),
      externalWallet: externalWallet as never,
      targetEntityId: FRIEND,
      tokenId: 1,
      deliveryMode: 'instant',
      description: 'Pay',
      route,
    }),
  ).rejects.toThrow('This account already has a top-up awaiting confirmation.');

  rejectFirstApprove = true;
  releaseApprove();
  await expect(firstAttempt).rejects.toThrow('APPROVE_FAILED');

  // Key was released by finally -> retry succeeds, polling past transient states until ready
  approveSpy.mockResolvedValue(0n);
  const sendEntitySpy = spyOn(txMod, 'sendEntityTxs').mockResolvedValue({ ok: true } as never);
  const sendRuntimeSpy = spyOn(commandsMod, 'sendRuntimeInput').mockResolvedValue({ ok: true } as never);
  spies.push(sendEntitySpy, sendRuntimeSpy);

  const transientFrames = [
    makeFrame({ outCollateral: 0n, sentBatch: true }),
    makeFrame({ outCollateral: 0n, reserve: 0n }),
    makeFrame({ outCollateral: 10_000_000n }),
  ];
  let reads = 0;
  spies.push(
    spyOn(adapterMod, 'requireAdapter').mockReturnValue({
      read: async () => transientFrames[Math.min(reads++, transientFrames.length - 1)]!,
    } as never),
  );
  spies.push(
    spyOn(txMod, 'waitFor').mockImplementation(async pred => {
      while (!(await pred())) {
        // poll immediately without waiting 250ms
      }
    }),
  );

  await executeEverydaySend({
    wallet: makeWallet(makeFrame({ outCollateral: 0n })),
    externalWallet: externalWallet as never,
    targetEntityId: FRIEND,
    tokenId: 1,
    deliveryMode: 'instant',
    description: 'Pay',
    route,
  });
  expect(reads).toBe(3);
  expect(sendRuntimeSpy).toHaveBeenCalledTimes(1);

  // Immediate abort on 'disputed' during waitFor + key release verified by subsequent call
  spies.push(
    spyOn(adapterMod, 'requireAdapter').mockReturnValue({
      read: async () => makeFrame({ outCollateral: 0n, disputed: true }),
    } as never),
  );
  await expect(
    executeEverydaySend({
      wallet: makeWallet(makeFrame({ outCollateral: 0n })),
      externalWallet: externalWallet as never,
      targetEntityId: FRIEND,
      tokenId: 1,
      deliveryMode: 'instant',
      description: 'Pay',
      route,
    }),
  ).rejects.toThrow('This account is paused for recovery right now.');
});
