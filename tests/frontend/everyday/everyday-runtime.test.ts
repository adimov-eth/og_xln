import { expect, test } from 'bun:test';
import { createDefaultDelta } from '../../../core/account/state/delta';
import { deriveDelta } from '../../../core/account/utils';
import { buildRuntimeActivityEvents } from '../../../core/api/public/activity-history';
import type {
  Delta,
  RuntimeAdapterViewFrame,
  RuntimeInput,
  RuntimeReplica,
  XLNModule,
} from '../../../core/api/public/runtime-module';
import type { RuntimeAdapter } from '../../../core/api/runtime-adapter/types';
import { buildPaymentRuntimeInput } from '../../../core/api/payments/command';
import {
  classifyRecoveryShieldState,
  planEverydaySend,
  type EverydaySendPlan,
} from '../../../frontend/src/lib/everyday/everyday-autopilot';
import { projectEverydayActivityRows } from '../../../frontend/src/lib/components/Everyday/everyday-activity';
import { executeEverydaySendPlan } from '../../../frontend/src/lib/components/Everyday/everyday-funding';
import {
  quoteEverydayRoute,
  quoteSettleTabRoute,
  resolveContactTarget,
  resolveEverydayDeliveryMode,
  resolveRecoveryShieldInput,
} from '../../../frontend/src/lib/components/Everyday/everyday-runtime';
import {
  maybeAutoJoinEverydayHub,
  resetEverydayHubJoinStateForTests,
} from '../../../frontend/src/lib/stores/everyday/everyday-hub-join';

const SELF = `0x${'11'.repeat(32)}`;
const HUB = `0x${'22'.repeat(32)}`;
const FRIEND = `0x${'33'.repeat(32)}`;
const SIGNER = `0x${'44'.repeat(20)}`;
const USDC_ADDR = `0x${'66'.repeat(20)}`;
const SPENDER = `0x${'77'.repeat(20)}`;
const HASH = `0x${'88'.repeat(32)}`;
const RUNTIME_ID = `0x${'99'.repeat(20)}`;

const makeFrame = (accounts: Array<{ peer: string; delta: Delta; isHub: boolean; label: string }>): RuntimeAdapterViewFrame => {
  const items = accounts.map(({ peer, delta }) => {
    const [leftEntity, rightEntity] = SELF < peer ? [SELF, peer] : [peer, SELF];
    return {
      status: 'active' as const,
      state: { leftEntity, rightEntity, deltas: new Map([[1, delta]]) },
    };
  });
  return {
    activeEntityId: SELF,
    entities: [
      { entityId: SELF, signerId: SIGNER, height: 1, label: 'Bob', isHub: false },
      ...accounts.map(({ peer, isHub, label }) => ({ entityId: peer, signerId: SIGNER, height: 1, label, isHub })),
    ],
    activeEntity: {
      summary: {
        entityId: SELF,
        signerId: SIGNER,
        height: 1,
        label: 'Bob',
        isHub: false,
        jurisdiction: { name: 'sepolia', chainId: 11155111, depositoryAddress: SPENDER },
      },
      core: {
        signerId: SIGNER,
        reserves: new Map(),
        config: { jurisdiction: { name: 'sepolia', chainId: 11155111, depositoryAddress: SPENDER } },
      },
      accounts: { items },
    },
  } as unknown as RuntimeAdapterViewFrame;
};

test('executeEverydaySendPlan throws APPROVAL_NOT_CONFIRMED on allowance timeout without submitting funding txs', async () => {
  const paymentInput = buildPaymentRuntimeInput({
    entityId: SELF,
    signerId: SIGNER,
    targetEntityId: FRIEND,
    tokenId: 1,
    deliveryMode: 'instant',
    description: 'Dinner',
    route: { path: [SELF, HUB, FRIEND], totalFee: 0n, senderAmount: 15_000_000n, recipientAmount: 15_000_000n },
  });
  const plan: EverydaySendPlan = {
    kind: 'fund-and-pay',
    requiredDeposit: 15_000_000n,
    fromReserve: 0n,
    fromExternal: 15_000_000n,
    needsApprovalAmount: 15_000_000n,
    tokenAddress: USDC_ADDR,
    fundingTxs: [{ type: 'j_broadcast', data: {} }],
    paymentInput,
  };
  let approveCalls = 0;
  let entityCalls = 0;
  let runtimeCalls = 0;
  let allowanceReads = 0;

  const mockXln = {
    getEntityJAdapter: () => ({
      addresses: { depository: SPENDER },
      approveErc20: async () => {
        approveCalls += 1;
        return '0xapprove';
      },
      getErc20Allowance: async () => {
        allowanceReads += 1;
        return 0n;
      },
    }),
    getCachedSignerPrivateKey: () => `0x${'aa'.repeat(32)}`,
  } as unknown as XLNModule;

  await expect(
    executeEverydaySendPlan({
      plan,
      entityId: SELF,
      signerId: SIGNER,
      tokenId: 1,
      liveEnv: {} as RuntimeReplica,
      xln: mockXln,
      refreshPlan: async () => ({ kind: 'ready', paymentInput }),
      deps: {
        approvalTimeoutMs: 20,
        pollIntervalMs: 5,
        submitEntityInputsFn: async () => {
          entityCalls += 1;
          return [];
        },
        submitRuntimeInputFn: async () => {
          runtimeCalls += 1;
        },
      },
    }),
  ).rejects.toThrow('APPROVAL_NOT_CONFIRMED');
  expect(approveCalls).toBe(1);
  expect(allowanceReads).toBeGreaterThanOrEqual(1);
  expect(entityCalls).toBe(0);
  expect(runtimeCalls).toBe(0);

  let polls = 0;
  const happyXln = {
    ...mockXln,
    getEntityJAdapter: () => ({
      addresses: { depository: SPENDER },
      approveErc20: async () => '0xapprove',
      getErc20Allowance: async () => {
        polls += 1;
        return polls >= 2 ? 15_000_000n : 0n;
      },
    }),
  } as unknown as XLNModule;
  await executeEverydaySendPlan({
    plan,
    entityId: SELF,
    signerId: SIGNER,
    tokenId: 1,
    liveEnv: {} as RuntimeReplica,
    xln: happyXln,
    refreshPlan: async () => ({ kind: 'ready', paymentInput }),
    deps: {
      approvalTimeoutMs: 200,
      pollIntervalMs: 5,
      submitEntityInputsFn: async () => {
        entityCalls += 1;
        return [];
      },
      submitRuntimeInputFn: async () => {
        runtimeCalls += 1;
      },
    },
  });
  expect(entityCalls).toBe(1);
  expect(runtimeCalls).toBe(1);
});

test('quoteEverydayRoute skips funding retry when cash=0, retries with fundingAccountId when cash>0, and picks lowest fee', async () => {
  let zeroCashCalls = 0;
  await expect(
    quoteEverydayRoute({
      entityId: SELF,
      targetEntityId: FRIEND,
      tokenId: 1,
      amount: 10_000_000n,
      primaryHubId: HUB,
      cash: 0n,
      deps: {
        adapter: {
          read: async () => {
            zeroCashCalls += 1;
            throw new Error(`no payment route from ${SELF} to ${FRIEND}`);
          },
        } as unknown as Pick<RuntimeAdapter, 'read'>,
      },
    }),
  ).rejects.toThrow('no payment route');
  expect(zeroCashCalls).toBe(1);

  const queries: Array<Record<string, unknown>> = [];
  const quoted = await quoteEverydayRoute({
    entityId: SELF,
    targetEntityId: FRIEND,
    tokenId: 1,
    amount: 10_000_000n,
    primaryHubId: HUB,
    cash: 100_000_000n,
    deps: {
      adapter: {
        read: async (_path, query) => {
          queries.push(query as Record<string, unknown>);
          if (!('fundingAccountId' in (query as Record<string, unknown>))) {
            throw new Error(`no payment route from ${SELF} to ${FRIEND}`);
          }
          return {
            routes: [
              { path: [SELF, HUB, FRIEND], hops: [{}, {}], totalFee: '500', senderAmount: '10000500', recipientAmount: '10000000' },
              { path: [SELF, HUB, FRIEND], hops: [{}, {}], totalFee: '100', senderAmount: '10000100', recipientAmount: '10000000' },
            ],
          };
        },
      } as unknown as Pick<RuntimeAdapter, 'read'>,
    },
  });
  expect(queries).toHaveLength(2);
  expect(queries[1]?.['fundingAccountId']).toBe(HUB);
  expect(quoted.totalFee).toBe(100n);
});

test('quoteSettleTabRoute selects bilateral direct or atomic self-cycle [self, Hub, friend, self] compatible with planEverydaySend', async () => {
  expect(resolveEverydayDeliveryMode({ path: [SELF, FRIEND] })).toBe('direct');
  expect(resolveEverydayDeliveryMode({ path: [SELF, HUB, FRIEND] })).toBe('instant');
  expect(resolveEverydayDeliveryMode({ path: [SELF, HUB, FRIEND, SELF] })).toBe('instant');

  // Bilateral direct capacity available -> 2-hop direct without hitting adapter
  const directFrame = makeFrame([
    { peer: FRIEND, delta: createDefaultDelta(1, { left: 40_000_000n, right: 0n }), isHub: false, label: 'Alice' },
  ]);
  const directQuote = await quoteSettleTabRoute({
    frame: directFrame,
    entityId: SELF,
    targetEntityId: FRIEND,
    tokenId: 1,
    amount: 40_000_000n,
    primaryHubId: HUB,
    deriveDeltaFn: deriveDelta,
    deps: {
      adapter: {
        read: async () => {
          throw new Error('should not query payment-routes when direct tab has capacity');
        },
      } as unknown as Pick<RuntimeAdapter, 'read'>,
    },
  });
  expect(directQuote.deliveryMode).toBe('direct');
  expect(directQuote.route.path).toEqual([SELF, FRIEND]);

  // Self owes Alice $40 (inOwnCredit=40M, outCapacity=0) and has $100 collateral on Hub -> picks [SELF, HUB, FRIEND, SELF]
  const bobOwesDelta = SELF < FRIEND
    ? { ...createDefaultDelta(1, { left: 40_000_000n, right: 0n }), offdelta: -40_000_000n }
    : { ...createDefaultDelta(1, { left: 0n, right: 40_000_000n }), offdelta: 40_000_000n };
  const hubDelta = { ...createDefaultDelta(1, { left: 0n, right: 250_000_000n }), ondelta: 100_000_000n };
  const settleFrame = makeFrame([
    { peer: FRIEND, delta: bobOwesDelta, isHub: false, label: 'Alice' },
    { peer: HUB, delta: hubDelta, isHub: true, label: 'Hub' },
  ]);
  const cycleQuote = await quoteSettleTabRoute({
    frame: settleFrame,
    entityId: SELF,
    targetEntityId: FRIEND,
    tokenId: 1,
    amount: 40_000_000n,
    primaryHubId: HUB,
    deriveDeltaFn: deriveDelta,
    deps: {
      adapter: {
        read: async (_path, query) => {
          const q = query as Record<string, unknown>;
          expect(q['sourceEntityId']).toBe(SELF);
          expect(q['targetEntityId']).toBe(SELF);
          expect(q['fundingAccountId']).toBe(HUB);
          return {
            routes: [{
              path: [SELF, HUB, FRIEND, SELF],
              hops: [{}, {}, {}],
              totalFee: '80120',
              senderAmount: '40080120',
              recipientAmount: '40000000',
            }],
          };
        },
      } as unknown as Pick<RuntimeAdapter, 'read'>,
    },
  });
  expect(cycleQuote.deliveryMode).toBe('instant');
  expect(cycleQuote.route.path).toEqual([SELF, HUB, FRIEND, SELF]);

  // Regression: targetEntityId must be route.path.at(-1) (SELF), never counterpartyId (FRIEND)
  expect(() =>
    planEverydaySend({
      frame: settleFrame,
      entityId: SELF,
      signerId: SIGNER,
      targetEntityId: FRIEND,
      tokenId: 1,
      deliveryMode: cycleQuote.deliveryMode,
      description: 'Settled tab',
      route: cycleQuote.route,
      externalRows: [],
      nativeBalance: 0n,
      deriveDeltaFn: deriveDelta,
    }),
  ).toThrow('Payment route endpoints mismatch');

  const validSelfCyclePlan = planEverydaySend({
    frame: settleFrame,
    entityId: SELF,
    signerId: SIGNER,
    targetEntityId: cycleQuote.route.path.at(-1) ?? FRIEND,
    tokenId: 1,
    deliveryMode: cycleQuote.deliveryMode,
    description: 'Settled tab',
    route: cycleQuote.route,
    externalRows: [],
    nativeBalance: 0n,
    deriveDeltaFn: deriveDelta,
  });
  expect(validSelfCyclePlan.kind).toBe('ready');
});

test('projectEverydayActivityRows folds HTLCs, emits Sent/Received/pending/failed, and strips all plumbing and raw strings', () => {
  const now = new Date('2026-11-19T14:05:00Z').getTime();
  type Journal = Parameters<typeof buildRuntimeActivityEvents>[0];
  const htlcJournalEvents = [
    ...buildRuntimeActivityEvents({
      height: 10,
      timestamp: now - 10_000,
      runtimeInput: {
        runtimeTxs: [],
        entityInputs: [{
          entityId: SELF,
          signerId: SIGNER,
          entityTxs: [
            {
              type: 'htlcPayment',
              data: { targetEntityId: FRIEND, tokenId: 1, amount: 10_000_000n, route: [SELF, HUB, FRIEND], deliveryMode: 'instant', maxSenderDebit: 10_000_000n },
            },
            { type: 'j_broadcast', data: {} },
            { type: 'request_collateral', data: { tokenId: 1, amount: 10_000_000n } },
            { type: 'set_credit_limit', data: { counterpartyEntityId: FRIEND, tokenId: 1, amount: 10_000_000n } },
            { type: 'openAccount', data: { targetEntityId: FRIEND } },
          ],
        }],
        jInputs: [],
      },
      logs: [
        { category: 'system', level: 'info', message: 'HtlcInitiated', entityId: SELF, data: { fromEntity: SELF, toEntity: FRIEND, tokenId: 1, amount: '10000000', hashlock: HASH } },
        { category: 'system', level: 'info', message: 'HtlcFinalized', entityId: SELF, data: { fromEntity: SELF, toEntity: FRIEND, tokenId: 1, amount: '10000000', hashlock: HASH } },
        { category: 'system', level: 'info', message: 'JBatchQueued', entityId: SELF, data: {} },
      ],
    } as unknown as Journal, { entityId: SELF, types: ['payment', 'htlc'] }),
    ...buildRuntimeActivityEvents({
      height: 11,
      timestamp: now - 5_000,
      runtimeInput: {
        runtimeTxs: [],
        entityInputs: [{
          entityId: SELF,
          signerId: SIGNER,
          entityTxs: [{
            type: 'accountInput',
            data: {
              fromEntityId: FRIEND,
              toEntityId: SELF,
              proposal: { frame: { accountTxs: [{ type: 'direct_payment', data: { fromEntityId: FRIEND, toEntityId: SELF, tokenId: 1, amount: 5_000_000n } }] } },
            },
          }],
        }],
        jInputs: [],
      },
      logs: [],
    } as unknown as Journal, { entityId: SELF, types: ['payment', 'htlc'] }),
  ];

  const rows = projectEverydayActivityRows({
    events: htlcJournalEvents,
    entityId: SELF,
    accountIds: [HUB, FRIEND],
    entities: [
      { entityId: SELF, signerId: SIGNER, height: 1, label: 'Bob', isHub: false },
      { entityId: HUB, signerId: SIGNER, height: 1, label: 'Hub', isHub: true },
      { entityId: FRIEND, signerId: SIGNER, height: 1, label: 'Alice', isHub: false },
    ],
    decimals: 6,
    now,
  });

  expect(rows).toHaveLength(2);
  expect(rows.map(r => r.title)).toEqual(['Received', 'Sent']);
  expect(rows.map(r => r.amountText)).toEqual(['+$5.00', '−$10.00']);
  const serialized = JSON.stringify(rows);
  for (const forbidden of ['JBatchQueued', 'system/info', 'token 1', 'requestCollateral', 'request_collateral', 'r2c', 'set_credit_limit', 'Confirmed frame #', '10000000']) {
    expect(serialized).not.toContain(forbidden);
  }

  const inflightHash = `0x${'ab'.repeat(32)}`;
  const failedHash = `0x${'cd'.repeat(32)}`;
  const edgeRows = projectEverydayActivityRows({
    events: [
      ...buildRuntimeActivityEvents({
        height: 12,
        timestamp: now - 2_000,
        runtimeInput: {
          runtimeTxs: [],
          entityInputs: [{
            entityId: SELF,
            signerId: SIGNER,
            entityTxs: [{
              type: 'accountInput',
              data: {
                fromEntityId: SELF,
                toEntityId: HUB,
                proposal: { frame: { accountTxs: [{ type: 'htlc_lock', data: { tokenId: 1, amount: 2_000_000n, hashlock: inflightHash } }] } },
              },
            }],
          }],
          jInputs: [],
        },
        logs: [],
      } as unknown as Journal, { entityId: SELF, types: ['payment', 'htlc'] }),
      ...buildRuntimeActivityEvents({
        height: 13,
        timestamp: now - 1_000,
        runtimeInput: {
          runtimeTxs: [],
          entityInputs: [{
            entityId: SELF,
            signerId: SIGNER,
            entityTxs: [{
              type: 'accountInput',
              data: {
                fromEntityId: SELF,
                toEntityId: HUB,
                proposal: {
                  frame: {
                    accountTxs: [
                      { type: 'htlc_lock', data: { tokenId: 1, amount: 3_000_000n, hashlock: failedHash } },
                    ],
                  },
                },
              },
            }],
          }],
          jInputs: [],
        },
        logs: [
          { category: 'system', level: 'warn', message: 'HtlcFailed', entityId: SELF, data: { fromEntity: SELF, toEntity: HUB, tokenId: 1, amount: '3000000', hashlock: failedHash } },
        ],
      } as unknown as Journal, { entityId: SELF, types: ['payment', 'htlc'] }),
    ],
    entityId: SELF,
    accountIds: [HUB, FRIEND],
    entities: [{ entityId: HUB, signerId: SIGNER, height: 1, label: 'Hub', isHub: true }],
    decimals: 6,
    now,
  });
  expect(edgeRows.map(r => r.title)).toEqual(['Payment failed', 'Payment pending']);
});

test('maybeAutoJoinEverydayHub is idempotent, skips manual preference/existing accounts, and opens 1 hub with $250 + $1/$250/$2', async () => {
  resetEverydayHubJoinStateForTests();
  const submitted: RuntimeInput[] = [];
  const frame = makeFrame([]);
  const hubResponse = {
    ok: true,
    count: 1,
    serverTime: 1000,
    hubs: [{
      entityId: HUB,
      online: true,
      roleSource: 'operator-config',
      metadata: { isHub: true, jurisdiction: { name: 'sepolia', chainId: 11155111, depositoryAddress: SPENDER } },
    }],
  };

  // Manual preference skipped
  await maybeAutoJoinEverydayHub({
    runtimeId: RUNTIME_ID, entityId: SELF, signerId: SIGNER, jurisdiction: 'sepolia', frame,
    hubAccountsCount: 0, liveEnv: null, xln: null, commandReady: true,
    deps: {
      readPreferenceFn: () => 'manual',
      fetchFn: (async () => new Response(JSON.stringify(hubResponse), { status: 200 })) as unknown as typeof fetch,
      submitRuntimeInputFn: async input => { submitted.push(input); },
    },
  });
  expect(submitted).toHaveLength(0);

  // Demo ('1') opens 1 hub account once; second concurrent/subsequent call is idempotent
  const deps = {
    readPreferenceFn: () => '1' as const,
    apiBase: 'http://127.0.0.1:8080',
    fetchFn: (async () => new Response(JSON.stringify(hubResponse), { status: 200 })) as unknown as typeof fetch,
    submitRuntimeInputFn: async (input: RuntimeInput) => { submitted.push(input); },
  };
  await Promise.all([
    maybeAutoJoinEverydayHub({ runtimeId: RUNTIME_ID, entityId: SELF, signerId: SIGNER, jurisdiction: 'sepolia', frame, hubAccountsCount: 0, liveEnv: null, xln: null, commandReady: true, deps }),
    maybeAutoJoinEverydayHub({ runtimeId: RUNTIME_ID, entityId: SELF, signerId: SIGNER, jurisdiction: 'sepolia', frame, hubAccountsCount: 0, liveEnv: null, xln: null, commandReady: true, deps }),
  ]);
  await maybeAutoJoinEverydayHub({ runtimeId: RUNTIME_ID, entityId: SELF, signerId: SIGNER, jurisdiction: 'sepolia', frame, hubAccountsCount: 0, liveEnv: null, xln: null, commandReady: true, deps });
  expect(submitted).toHaveLength(1);
  const openTx = submitted[0]?.entityInputs?.[0]?.entityTxs?.[0];
  expect(openTx?.type).toBe('openAccount');
  if (openTx?.type === 'openAccount') {
    expect(openTx.data.targetEntityId).toBe(HUB);
    expect(openTx.data.creditAmount).toBe(250_000_000n);
    expect(openTx.data.rebalancePolicy).toEqual({
      r2cRequestSoftLimit: 1_000_000n,
      hardLimit: 250_000_000n,
      maxAcceptableFee: 2_000_000n,
    });
  }
});

test('resolveContactTarget, classifyRecoveryShieldState, and resolveRecoveryShieldInput cover contact names, gas suffix, and tower failures', () => {
  expect(resolveContactTarget('Alice', [{ entityId: FRIEND, label: 'Alice' }])).toEqual({ target: FRIEND, ambiguous: false });
  expect(resolveContactTarget('Bob', [{ entityId: SELF, label: 'Bob' }, { entityId: FRIEND, label: 'Bob' }])).toEqual({ target: '', ambiguous: true });

  expect(classifyRecoveryShieldState({ shieldStatus: null, disputes: [], hasZeroL1Gas: true }).summary)
    .toBe('Backups stay on this device only. Unilateral on-chain exit still requires network gas.');
  expect(classifyRecoveryShieldState({
    shieldStatus: { mode: 'tower', towers: ['https://tower.example'], backupError: null, protectionError: 'ERR', automaticResponseEnabled: true },
    disputes: [],
    hasZeroL1Gas: true,
  }).summary)
    .toBe('Dispute protection needs attention (ERR). Unilateral on-chain exit still requires network gas.');
  expect(classifyRecoveryShieldState({
    shieldStatus: { mode: 'tower', towers: ['https://tower.example'], backupError: null, protectionError: null, automaticResponseEnabled: true },
    disputes: [],
    hasZeroL1Gas: true,
  }).summary)
    .toBe('Protected automatically for counter-disputes; unilateral on-chain exit still requires network gas.');

  const shield = resolveRecoveryShieldInput({
    id: RUNTIME_ID,
    label: 'Bob',
    seed: 'test',
    signers: [],
    activeSignerIndex: 0,
    createdAt: 0,
    recovery: {
      towers: [{ id: 't1', url: 'https://tower.example', towerMode: 'delayed_last_resort', enabled: true }],
      lastTowerUploadAttemptAt: 200,
      lastTowerUploadAttemptHeight: 5,
      lastTowerReceipts: [{ towerUrl: 'https://tower.example', towerMode: 'blind_backup', height: 5, bundleHash: '0x1', sequence: 1, receivedAt: 201, appointmentSequence: null }],
      lastTowerFailures: [
        { towerUrl: 'https://tower.example', towerMode: 'delayed_last_resort', checkedAt: 202, error: 'WATCHTOWER_TRON_SUBMISSION_UNSUPPORTED' },
        { towerUrl: 'https://tower.example', towerMode: 'delayed_last_resort', checkedAt: 203, error: 'APPOINT_REJECTED' },
      ],
    },
  });
  expect(shield?.backupError).toBeNull();
  expect(shield?.protectionError).toBe('APPOINT_REJECTED');
});
