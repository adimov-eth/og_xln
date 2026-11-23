import { expect, test } from 'bun:test';
import { createDefaultDelta } from '../../../core/account/state/delta';
import { checkAutoRebalance } from '../../../core/account/tx/handlers/rebalance/request-collateral';
import { deriveDelta } from '../../../core/account/utils';
import { createEmptyAccountJClaimAccumulator } from '../../../core/account/j-claims/j-claim-accumulator';
import type { Delta, JBatch, RuntimeAdapterViewFrame } from '../../../core/api/public/runtime-module';
import { PersistentAccountStateMap } from '../../../core/account/state/persistent-state-map';
import { makeAccount, putTestAccountDelta } from '../../../core/__tests__/helpers/cross-j';
import {
  classifyRecoveryShieldState,
  ensureDefaultTowerProtection,
  EVERYDAY_HUB_POLICY_USD,
  explainEverydayCashOutBlock,
  inspectHubRebalanceStatus,
  parseEverydayTowerUrls,
  planEverydayCashOut,
  planEverydaySend,
  planFriendSplitTxs,
  PRO_HUB_POLICY_USD,
  resolveDefaultTowerUrls,
  resolvePolicyForPosture,
} from '../../../frontend/src/lib/everyday/everyday-autopilot';
import { buildReserveToExternalEoaTx } from '../../../frontend/src/lib/components/Entity/account/entity-action-txs';

type ActiveEntity = NonNullable<RuntimeAdapterViewFrame['activeEntity']>;
type AccountDoc = ActiveEntity['accounts']['items'][number];

const SELF = `0x${'11'.repeat(32)}`;
const HUB = `0x${'22'.repeat(32)}`;
const FRIEND = `0x${'33'.repeat(32)}`;
const SIGNER = `0x${'44'.repeat(20)}`;
const EOA_RECIPIENT = `0x${'55'.repeat(20)}`;
const USDC_ADDR = `0x${'66'.repeat(20)}`;
const HASH = `0x${'77'.repeat(32)}`;

const makeAccountDoc = (
  peerId: string,
  delta: Delta,
  extras: { status?: AccountDoc['status'] } = {},
): AccountDoc => {
  const [leftEntity, rightEntity] = SELF < peerId ? [SELF, peerId] : [peerId, SELF];
  return {
    state: {
      leftEntity,
      rightEntity,
      domain: { chainId: 31337, depositoryAddress: `0x${'88'.repeat(20)}` },
      watchSeed: '',
      deltas: new Map([[1, delta]]),
      locks: new Map(),
      swapOffers: new Map(),
      leftPendingJClaims: createEmptyAccountJClaimAccumulator(),
      rightPendingJClaims: createEmptyAccountJClaimAccumulator(),
      lastFinalizedJHeight: 3,
      disputeConfig: { leftResponseSeconds: 3600, rightResponseSeconds: 86400 },
      jNonce: 1,
      requestedRebalance: new Map(),
      requestedRebalanceFeeState: new Map(),
    },
    status: extras.status ?? 'active',
    currentHeight: 5,
    currentFrame: {
      height: 5, timestamp: 1000, jHeight: 3, accountTxs: [],
      prevFrameHash: HASH, accountStateRoot: HASH, stateHash: HASH,
    },
    mempool: [],
    mempoolCount: 0,
    rollbackCount: 0,
    proofHeader: { fromEntity: SELF, toEntity: peerId, nextProofNonce: 2 },
    pendingWithdrawals: new Map(),
    lendingRisk: new Map(),
    lendingBalances: new Map(),
    shadow: { rebalance: { policy: new Map(), submittedAtByToken: new Map() } },
  };
};

const makeFrame = (options: {
  accounts: AccountDoc[];
  reserves?: Map<number, bigint>;
  jBatchState?: ActiveEntity['core']['jBatchState'];
  settlementContinuations?: ActiveEntity['core']['settlementContinuations'];
  chainId?: number;
}): RuntimeAdapterViewFrame => ({
  height: 7,
  head: {
    schemaVersion: 1, latestHeight: 7, latestMaterializedHeight: 7, latestSnapshotHeight: 0,
    snapshotPeriodFrames: 100, retainSnapshots: 1, epochMaxBytes: 1_048_576,
    accountMerkleRadix: 16, epochReplayBytes: 0, retainedWalBytes: 0,
  },
  entities: [
    { entityId: SELF, signerId: SIGNER, height: 7, label: 'Me', isHub: false },
    { entityId: HUB, height: 7, label: 'Hub', isHub: true },
    { entityId: FRIEND, height: 7, label: 'Friend', isHub: false },
  ],
  activeEntityId: SELF,
  activeEntity: {
    summary: { entityId: SELF, signerId: SIGNER, height: 7, label: 'Me', isHub: false },
    core: {
      entityId: SELF,
      signerId: SIGNER,
      isProposer: true,
      height: 7,
      timestamp: 1000,
      nonces: new Map(),
      proposals: new Map(),
      entityEncryptionPublicKey: '',
      config: {
        mode: 'proposer-based',
        threshold: 1n,
        validators: [SIGNER],
        shares: { [SIGNER]: 1n },
        ...(options.chainId !== undefined
          ? {
              jurisdiction: {
                name: options.chainId === 3448148188 ? 'TRON Shasta' : 'Local',
                address: 'http://127.0.0.1:8545',
                chainId: options.chainId,
                entityProviderAddress: SIGNER,
                depositoryAddress: SIGNER,
              },
            }
          : {}),
      },
      reserves: options.reserves ?? new Map(),
      debtTotals: { incoming: new Map(), outgoing: new Map() },
      ...(options.jBatchState ? { jBatchState: options.jBatchState } : {}),
      ...(options.settlementContinuations ? { settlementContinuations: options.settlementContinuations } : {}),
      lastFinalizedJHeight: 3,
      profile: { name: 'Me', isHub: false, avatar: '', bio: '', website: '' },
      paybook: { entries: new Map(), feesEarned: 0n },
    },
    accounts: { items: options.accounts, nextCursor: null, totalItems: options.accounts.length },
    books: { items: [], nextCursor: null, totalItems: 0 },
  },
});

const emptyBatch = (): JBatch => ({
  reserveToCollateral: [],
  collateralToReserve: [],
  settlements: [],
  reserveToReserve: [],
  disputeStarts: [],
  counterDisputes: [],
  disputeFinalizations: [],
  externalTokenToReserve: [],
  reserveToExternalToken: [],
  revealSecrets: [],
  hashLadderRegistrations: [],
});

const batchStateWith = (
  batch: JBatch,
  sentBatch?: NonNullable<ActiveEntity['core']['jBatchState']>['sentBatch'],
): NonNullable<ActiveEntity['core']['jBatchState']> => ({
  batch,
  jurisdiction: null,
  lastBroadcast: 0,
  broadcastCount: 0,
  failedAttempts: 0,
  status: sentBatch ? 'sent' : 'accumulating',
  ...(sentBatch ? { sentBatch } : {}),
});

test('resolvePolicyForPosture enforces $250/$1/$2 in everyday and preserves pro overrides', () => {
  expect(EVERYDAY_HUB_POLICY_USD).toEqual({ transitCreditUsd: 250, softLimitUsd: 1, hardLimitUsd: 250, maxFeeUsd: 2 });
  expect(resolvePolicyForPosture('everyday', { softLimitUsd: 500, hardLimitUsd: 10_000, maxFeeUsd: 15 })).toEqual(EVERYDAY_HUB_POLICY_USD);
  expect(resolvePolicyForPosture('pro')).toEqual(PRO_HUB_POLICY_USD);
  expect(resolvePolicyForPosture('pro', { softLimitUsd: 100, hardLimitUsd: 5_000, maxFeeUsd: 5 })).toEqual({
    transitCreditUsd: 10_000, softLimitUsd: 100, hardLimitUsd: 5_000, maxFeeUsd: 5,
  });
});

test('planEverydaySend composes e2r/r2c, resumes idempotently after reload, and handles gas/sentBatch/dispute', () => {
  const route = { path: [SELF, HUB, FRIEND], totalFee: 0n, senderAmount: 25_000_000n, recipientAmount: 25_000_000n };
  const baseArgs = {
    entityId: SELF, signerId: SIGNER, targetEntityId: FRIEND, tokenId: 1,
    deliveryMode: 'instant' as const, description: 'Lunch', route, deriveDeltaFn: deriveDelta,
  };

  // 1. Cold start: $10 in reserve + $15 external with 0 allowance -> e2r($15) + r2c($25) + j_broadcast
  const emptyDoc = makeAccountDoc(HUB, createDefaultDelta(1));
  const plan1 = planEverydaySend({
    ...baseArgs,
    frame: makeFrame({ accounts: [emptyDoc], reserves: new Map([[1, 10_000_000n]]) }),
    externalRows: [{ tokenAddress: USDC_ADDR, tokenId: 1, balance: 20_000_000n, allowance: 0n }],
    nativeBalance: 10n ** 16n,
  });
  expect(plan1.kind).toBe('fund-and-pay');
  if (plan1.kind !== 'fund-and-pay') throw new Error('EXPECTED_FUND_AND_PAY');
  expect(plan1.fromReserve).toBe(10_000_000n);
  expect(plan1.fromExternal).toBe(15_000_000n);
  expect(plan1.needsApprovalAmount).toBe(15_000_000n);
  expect(plan1.fundingTxs.map(tx => tx.type)).toEqual(['e2r', 'r2c', 'j_broadcast']);

  // 2. Unhappy path: 0 L1 gas blocks funding before submitting
  const noGasPlan = planEverydaySend({
    ...baseArgs,
    frame: makeFrame({ accounts: [emptyDoc], reserves: new Map([[1, 10_000_000n]]) }),
    externalRows: [{ tokenAddress: USDC_ADDR, tokenId: 1, balance: 20_000_000n, allowance: 20_000_000n }],
    nativeBalance: 0n,
  });
  expect(noGasPlan).toMatchObject({ kind: 'needs-gas', requiredTx: 'e2r' });

  // 3. Unhappy path: sentBatch / queued-deposit prevents duplicate funding after reload
  const queuedBatch: JBatch = {
    ...emptyBatch(),
    reserveToCollateral: [{ tokenId: 1, receivingEntity: SELF, pairs: [{ entity: HUB, amount: 25_000_000n }] }],
  };
  expect(planEverydaySend({
    ...baseArgs,
    frame: makeFrame({ accounts: [emptyDoc], jBatchState: batchStateWith(queuedBatch) }),
    externalRows: [],
  }).kind).toBe('pending-funding');
  expect(planEverydaySend({
    ...baseArgs,
    frame: makeFrame({
      accounts: [emptyDoc],
      jBatchState: batchStateWith(emptyBatch(), {
        batch: queuedBatch, batchHash: HASH, encodedBatch: '0x', entityNonce: 1,
        firstSubmittedAt: 1, lastSubmittedAt: 1, submitAttempts: 1,
      }),
    }),
    externalRows: [],
  })).toMatchObject({ kind: 'pending-funding', reason: 'sent-batch' });

  // 4. Reload mid-sweep after e2r already landed in reserve: plans [r2c, j_broadcast] only (no duplicate e2r!)
  const afterE2r = planEverydaySend({
    ...baseArgs,
    frame: makeFrame({ accounts: [emptyDoc], reserves: new Map([[1, 25_000_000n]]) }),
    externalRows: [{ tokenAddress: USDC_ADDR, tokenId: 1, balance: 5_000_000n, allowance: 5_000_000n }],
    nativeBalance: 10n ** 16n,
  });
  expect(afterE2r.kind).toBe('fund-and-pay');
  if (afterE2r.kind !== 'fund-and-pay') throw new Error('EXPECTED_R2C_ONLY');
  expect(afterE2r.fromExternal).toBe(0n);
  expect(afterE2r.needsApprovalAmount).toBe(0n);
  expect(afterE2r.fundingTxs.map(tx => tx.type)).toEqual(['r2c', 'j_broadcast']);

  // 5. Reload after r2c landed -> ready
  const fundedDoc = makeAccountDoc(HUB, { ...createDefaultDelta(1), collateral: 25_000_000n, ondelta: 25_000_000n });
  expect(planEverydaySend({ ...baseArgs, frame: makeFrame({ accounts: [fundedDoc] }), externalRows: [] }).kind).toBe('ready');

  // 6. Disputed hub blocks send
  const disputedDoc = makeAccountDoc(HUB, createDefaultDelta(1), { status: 'disputed' });
  expect(planEverydaySend({ ...baseArgs, frame: makeFrame({ accounts: [disputedDoc] }), externalRows: [] })).toEqual({ kind: 'disputed', counterpartyId: HUB });
});

test('planEverydayCashOut never spends arriving outPeerCredit when hub goes offline mid-batch', () => {
  const arrivingOnlyDoc = makeAccountDoc(HUB, {
    ...createDefaultDelta(1, { left: 0n, right: 250_000_000n }),
    ondelta: 50_000_000n, // outPeerCredit = $50 arriving, outCollateral = $0
  });
  const offlinePlan = planEverydayCashOut({
    frame: makeFrame({ accounts: [arrivingOnlyDoc] }),
    entityId: SELF, recipientEoa: EOA_RECIPIENT, tokenId: 1, amount: 20_000_000n,
    nativeBalance: 10n ** 16n, deriveDeltaFn: deriveDelta,
  });
  expect(offlinePlan).toEqual({ kind: 'insufficient', shortfall: 20_000_000n, available: 0n });
  if (offlinePlan.kind === 'insufficient') {
    expect(explainEverydayCashOutBlock(offlinePlan, amount => `$${amount}`)).toContain('Only $0 is ready to cash out right now.');
  }

  const disputedHub = makeAccountDoc(HUB, { ...createDefaultDelta(1), collateral: 30_000_000n, ondelta: 30_000_000n }, { status: 'disputed' });
  const disputedPlan = planEverydayCashOut({
    frame: makeFrame({ accounts: [disputedHub] }),
    entityId: SELF, recipientEoa: EOA_RECIPIENT, tokenId: 1, amount: 20_000_000n,
    nativeBalance: 10n ** 16n, deriveDeltaFn: deriveDelta,
  });
  expect(disputedPlan).toEqual({ kind: 'disputed', counterpartyId: HUB });
  if (disputedPlan.kind === 'disputed') {
    expect(explainEverydayCashOutBlock(disputedPlan, amount => `$${amount}`)).toContain('paused for recovery');
  }

  const backedDoc = makeAccountDoc(HUB, {
    ...createDefaultDelta(1),
    collateral: 30_000_000n,
    ondelta: 30_000_000n,
  });
  const combined = planEverydayCashOut({
    frame: makeFrame({ accounts: [backedDoc], reserves: new Map([[1, 10_000_000n]]) }),
    entityId: SELF, recipientEoa: EOA_RECIPIENT, tokenId: 1, amount: 25_000_000n,
    nativeBalance: 10n ** 16n, deriveDeltaFn: deriveDelta,
  });
  expect(combined.kind).toBe('from-hub-collateral');
  if (combined.kind !== 'from-hub-collateral') throw new Error('EXPECTED_HUB_CASHOUT');
  expect(combined.fromReserve).toBe(10_000_000n);
  expect(combined.fromCollateral).toBe(15_000_000n);
  expect(combined.entityTxs[0]?.type).toBe('settle_propose');

  expect(planEverydayCashOut({
    frame: makeFrame({ accounts: [backedDoc], reserves: new Map([[1, 10_000_000n]]) }),
    entityId: SELF, recipientEoa: EOA_RECIPIENT, tokenId: 1, amount: 25_000_000n,
    nativeBalance: 0n, deriveDeltaFn: deriveDelta,
  })).toEqual({ kind: 'needs-gas' });
});

test('hub fee above maxAcceptableFee stalls checkAutoRebalance and inspectHubRebalanceStatus surfaces fee-above-cap', () => {
  const account = makeAccount(SELF, HUB, { chainId: 31337, depositoryAddress: `0x${'88'.repeat(20)}` });
  const delta: Delta = { ...createDefaultDelta(1, { left: 0n, right: 250_000_000n }), ondelta: 20_000_000n };
  putTestAccountDelta(account, delta);
  const policy = { r2cRequestSoftLimit: 1_000_000n, hardLimit: 250_000_000n, maxAcceptableFee: 2_000_000n };
  account.shadow.rebalance.policy = PersistentAccountStateMap.fromEntries('rebalanceShadowPolicy', [[1, policy]]);

  const highFeeSnapshot = {
    policyVersion: 1, baseFee: 3_000_000n, gasFee: 0n, liquidityFeeBps: 0n,
    updatedAt: 100, effectiveAt: 100, noticePeriodSeconds: 3600,
  };
  account.state.rebalanceFeePolicies = PersistentAccountStateMap.fromEntries('rebalanceFeePolicies', [[1, { right: highFeeSnapshot }]]);

  expect(checkAutoRebalance(account, SELF, HUB, 1000)).toEqual([]);
  const doc = makeAccountDoc(HUB, delta);
  doc.state.rebalanceFeePolicies = new Map([[1, { right: highFeeSnapshot }]]);
  const highStatus = inspectHubRebalanceStatus({ doc, isLeft: true, tokenId: 1, policy, deriveDeltaFn: deriveDelta });
  expect(highStatus.status).toBe('fee-above-cap');
  expect(highStatus.computedFee).toBe(3_000_000n);

  const lowFeeSnapshot = { ...highFeeSnapshot, baseFee: 500_000n };
  account.state.rebalanceFeePolicies = PersistentAccountStateMap.fromEntries('rebalanceFeePolicies', [[1, { right: lowFeeSnapshot }]]);
  expect(checkAutoRebalance(account, SELF, HUB, 1000).map(tx => tx.type)).toEqual(['request_collateral']);
  doc.state.rebalanceFeePolicies = new Map([[1, { right: lowFeeSnapshot }]]);
  expect(inspectHubRebalanceStatus({ doc, isLeft: true, tokenId: 1, policy, deriveDeltaFn: deriveDelta }).status).toBe('pending-queue');
});

test('planFriendSplitTxs opens private peer accounts and extends existing credit', () => {
  const openTxs = planFriendSplitTxs({
    entityId: SELF, counterpartyEntityId: FRIEND, tokenId: 1, splitAmount: 25_000_000n,
    existingAccount: null, deriveDeltaFn: deriveDelta,
    summaries: [{ entityId: SELF, height: 1, label: 'Me', isHub: false }, { entityId: FRIEND, height: 1, label: 'Friend', isHub: false }],
  });
  expect(openTxs).toEqual([{
    type: 'openAccount',
    data: { targetEntityId: FRIEND, disputeConfig: { leftResponseSeconds: 86400, rightResponseSeconds: 86400 }, tokenId: 1, creditAmount: 25_000_000n, pinPublic: true },
  }]);

  const extendTxs = planFriendSplitTxs({
    entityId: SELF, counterpartyEntityId: FRIEND, tokenId: 1, splitAmount: 15_000_000n,
    existingAccount: { leftEntity: SELF, rightEntity: FRIEND, deltas: new Map([[1, createDefaultDelta(1, { left: 0n, right: 20_000_000n })]]) },
    deriveDeltaFn: deriveDelta,
  });
  expect(extendTxs).toEqual([{ type: 'extendCredit', data: { counterpartyEntityId: FRIEND, tokenId: 1, amount: 35_000_000n } }]);
});

test('resolveDefaultTowerUrls, ensureDefaultTowerProtection, and classifyRecoveryShieldState handle localhost/pro/zero-gas', () => {
  expect(resolveDefaultTowerUrls({ hostname: 'localhost' })).toEqual([]);
  expect(resolveDefaultTowerUrls({ hostname: '[::1]' })).toEqual([]);
  expect(resolveDefaultTowerUrls({ hostname: 'localhost', envUrls: 'http://127.0.0.1:9100' })).toEqual(['http://127.0.0.1:9100']);
  expect(resolveDefaultTowerUrls({ hostname: 'xln.finance', origin: 'https://xln.finance' })).toEqual(['https://xln.finance']);

  const saved: unknown[] = [];
  expect(ensureDefaultTowerProtection({
    posture: 'pro', vaultId: 'v1', readExplicitConfig: () => null,
    saveConfig: (_id, cfg) => saved.push(cfg), resolveUrls: () => ['https://xln.finance'],
  })).toBeNull();
  expect(ensureDefaultTowerProtection({
    posture: 'everyday', vaultId: 'v1', readExplicitConfig: () => ({ mode: 'local', towers: [] }),
    saveConfig: (_id, cfg) => saved.push(cfg), resolveUrls: () => ['https://xln.finance'],
  })).toBeNull();
  expect(ensureDefaultTowerProtection({
    posture: 'everyday', vaultId: 'v1', readExplicitConfig: () => null,
    saveConfig: (_id, cfg) => saved.push(cfg), resolveUrls: () => ['https://xln.finance'],
  })).toEqual({ mode: 'tower', towers: ['https://xln.finance'] });
  expect(saved).toHaveLength(1);

  expect(classifyRecoveryShieldState({
    shieldStatus: { mode: 'tower', towers: ['https://xln.finance'], backupError: null, protectionError: null, automaticResponseEnabled: true },
    disputes: [{ needsL1GasForUnilateralExit: true }],
    hasZeroL1Gas: true,
  }).category).toBe('unilateral-exit-needs-gas');
  expect(classifyRecoveryShieldState({
    shieldStatus: { mode: 'tower', towers: ['https://xln.finance'], backupError: null, protectionError: null, automaticResponseEnabled: false },
    disputes: [],
    hasZeroL1Gas: false,
  }).category).toBe('tower-issue');
  expect(parseEverydayTowerUrls('["https://t1.example/", {"url":"https://t2.example/"}, "https://t1.example"]'))
    .toEqual(['https://t1.example', 'https://t2.example']);
  expect(parseEverydayTowerUrls([{ url: 'https://t3.example/' }, 'ftp://bad.example'])).toEqual(['https://t3.example']);
});

const sampleProofBody = (): JBatch['disputeStarts'][number]['initialProofbody'] => ({
  watchSeed: HASH,
  leftResponseSeconds: 3600,
  rightResponseSeconds: 86400,
  offdeltas: [],
  tokenIds: [],
  transformers: [],
});

const sentBatchOf = (batch: JBatch): NonNullable<ActiveEntity['core']['jBatchState']>['sentBatch'] => ({
  batch,
  batchHash: HASH,
  encodedBatch: '0x',
  entityNonce: 1,
  firstSubmittedAt: 1,
  lastSubmittedAt: 1,
  submitAttempts: 1,
});

test('planEverydayCashOut gates from-reserve on sentBatch and settlementContinuations before needs-gas', () => {
  const emptyDoc = makeAccountDoc(HUB, createDefaultDelta(1));
  const r2eBatch: JBatch = {
    ...emptyBatch(),
    reserveToExternalToken: [{ receivingEntity: EOA_RECIPIENT, tokenId: 1, amount: 20_000_000n }],
  };
  const disputeStartBatch: JBatch = {
    ...emptyBatch(),
    disputeStarts: [{
      counterentity: HUB, nonce: 1, proposerIsLeft: true, proofbodyHash: HASH, initialProofbody: sampleProofBody(),
      watchSeed: HASH, sig: '0x', starterInitialArguments: '0x', starterCounterArguments: '0x', starterCounterProofCommitment: HASH,
    }],
  };

  // In-flight r2e sentBatch blocks from-reserve even when nativeBalance is 0n
  for (const nativeBalance of [10n ** 16n, 0n]) {
    expect(planEverydayCashOut({
      frame: makeFrame({ accounts: [emptyDoc], reserves: new Map([[1, 25_000_000n]]), jBatchState: batchStateWith(emptyBatch(), sentBatchOf(r2eBatch)) }),
      entityId: SELF, recipientEoa: EOA_RECIPIENT, tokenId: 1, amount: 20_000_000n, nativeBalance, deriveDeltaFn: deriveDelta,
    })).toEqual({ kind: 'pending-settlement' });
  }

  // Empty sentBatch (still triggers SENT_BATCH_PENDING in handleJBroadcast) & disputeStarts sentBatch also block
  for (const batch of [emptyBatch(), disputeStartBatch]) {
    expect(planEverydayCashOut({
      frame: makeFrame({ accounts: [emptyDoc], reserves: new Map([[1, 25_000_000n]]), jBatchState: batchStateWith(emptyBatch(), sentBatchOf(batch)) }),
      entityId: SELF, recipientEoa: EOA_RECIPIENT, tokenId: 1, amount: 20_000_000n, nativeBalance: 10n ** 16n, deriveDeltaFn: deriveDelta,
    })).toEqual({ kind: 'pending-settlement' });
  }

  // Pending settlementContinuations also block from-reserve before needs-gas
  expect(planEverydayCashOut({
    frame: makeFrame({
      accounts: [emptyDoc],
      reserves: new Map([[1, 25_000_000n]]),
      settlementContinuations: new Map([[HUB, { actions: [{ type: 'r2e', receivingEntity: EOA_RECIPIENT, tokenId: 1, amount: 20_000_000n }], broadcast: true, workspaceHash: HASH }]]),
    }),
    entityId: SELF, recipientEoa: EOA_RECIPIENT, tokenId: 1, amount: 20_000_000n, nativeBalance: 0n, deriveDeltaFn: deriveDelta,
  })).toEqual({ kind: 'pending-settlement' });

  // from-hub-collateral blocks on empty sentBatch or disputeFinalizations sentBatch
  const backedDoc = makeAccountDoc(HUB, { ...createDefaultDelta(1), collateral: 30_000_000n, ondelta: 30_000_000n });
  const disputeFinBatch: JBatch = {
    ...emptyBatch(),
    disputeFinalizations: [{
      counterentity: HUB, initialNonce: 1, finalNonce: 2, proposerIsLeft: true, initialProofbodyHash: HASH,
      finalProofbody: sampleProofBody(), starterArguments: '0x', otherArguments: '0x', sig: '0x', startedByLeft: true, cooperative: false,
    }],
  };
  for (const batch of [emptyBatch(), disputeFinBatch]) {
    expect(planEverydayCashOut({
      frame: makeFrame({ accounts: [backedDoc], jBatchState: batchStateWith(emptyBatch(), sentBatchOf(batch)) }),
      entityId: SELF, recipientEoa: EOA_RECIPIENT, tokenId: 1, amount: 20_000_000n, nativeBalance: 10n ** 16n, deriveDeltaFn: deriveDelta,
    })).toEqual({ kind: 'pending-settlement' });
  }

  // Unfunded $0 account with sentBatch still reports insufficient rather than pending-settlement
  expect(planEverydayCashOut({
    frame: makeFrame({ accounts: [emptyDoc], jBatchState: batchStateWith(emptyBatch(), sentBatchOf(emptyBatch())) }),
    entityId: SELF, recipientEoa: EOA_RECIPIENT, tokenId: 1, amount: 20_000_000n, nativeBalance: 10n ** 16n, deriveDeltaFn: deriveDelta,
  })).toEqual({ kind: 'insufficient', shortfall: 20_000_000n, available: 0n });
});

test('planEverydaySend gates on sentBatch and returns positive shortfall when tokenAddress is missing', () => {
  const route = { path: [SELF, HUB, FRIEND], totalFee: 0n, senderAmount: 10_000_000n, recipientAmount: 10_000_000n };
  const emptyDoc = makeAccountDoc(HUB, createDefaultDelta(1));
  const baseArgs = {
    entityId: SELF, signerId: SIGNER, targetEntityId: FRIEND, tokenId: 1,
    deliveryMode: 'instant' as const, description: 'Coffee', route, deriveDeltaFn: deriveDelta,
  };

  // Empty sentBatch and revealSecrets sentBatch both trigger pending-funding
  const revealBatch: JBatch = { ...emptyBatch(), revealSecrets: [{ transformer: USDC_ADDR, secret: HASH }] };
  for (const batch of [emptyBatch(), revealBatch]) {
    expect(planEverydaySend({
      ...baseArgs,
      frame: makeFrame({ accounts: [emptyDoc], jBatchState: batchStateWith(emptyBatch(), sentBatchOf(batch)) }),
      externalRows: [],
    })).toMatchObject({ kind: 'pending-funding', reason: 'sent-batch' });
  }

  // Missing / whitespace tokenAddress yields strictly positive shortfall = fromExternal regardless of external balance
  expect(planEverydaySend({
    ...baseArgs,
    frame: makeFrame({ accounts: [emptyDoc] }),
    externalRows: [{ tokenAddress: '', tokenId: 1, balance: 50_000_000n, allowance: 50_000_000n }],
    nativeBalance: 10n ** 16n,
  })).toEqual({ kind: 'insufficient', shortfall: 10_000_000n });
  expect(planEverydaySend({
    ...baseArgs,
    frame: makeFrame({ accounts: [emptyDoc] }),
    externalRows: [{ tokenAddress: '   ', tokenId: 1, balance: 50_000_000n, allowance: 50_000_000n }],
    nativeBalance: 10n ** 16n,
  })).toEqual({ kind: 'insufficient', shortfall: 10_000_000n });
  expect(planEverydaySend({
    ...baseArgs,
    frame: makeFrame({ accounts: [emptyDoc] }),
    externalRows: [{ tokenAddress: '', tokenId: 1, balance: 2_000_000n, allowance: 0n }],
    nativeBalance: 10n ** 16n,
  })).toEqual({ kind: 'insufficient', shortfall: 10_000_000n });

  // Valid tokenAddress with partial external balance computes exact remaining shortfall
  expect(planEverydaySend({
    ...baseArgs,
    frame: makeFrame({ accounts: [emptyDoc] }),
    externalRows: [{ tokenAddress: USDC_ADDR, tokenId: 1, balance: 2_000_000n, allowance: 0n }],
    nativeBalance: 10n ** 16n,
  })).toEqual({ kind: 'insufficient', shortfall: 8_000_000n });

  // When reserve covers deposit (fromExternal === 0n), missing tokenAddress is not required
  const reserveCovered = planEverydaySend({
    ...baseArgs,
    frame: makeFrame({ accounts: [emptyDoc], reserves: new Map([[1, 10_000_000n]]) }),
    externalRows: [{ tokenAddress: '', tokenId: 1, balance: 0n, allowance: 0n }],
    nativeBalance: 10n ** 16n,
  });
  expect(reserveCovered.kind).toBe('fund-and-pay');
  if (reserveCovered.kind === 'fund-and-pay') {
    expect(reserveCovered.fundingTxs.map(tx => tx.type)).toEqual(['r2c', 'j_broadcast']);
  }
});

test('planEverydayCashOut normalizes TRON Base58 recipients and returns typed invalid-recipient on bad or cross-jurisdiction addresses', () => {
  const TRON_BASE58 = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC';
  const TRON_EVM_HEX = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf';
  const expectedR2e = buildReserveToExternalEoaTx(TRON_EVM_HEX, 1, 20_000_000n);
  const emptyDoc = makeAccountDoc(HUB, createDefaultDelta(1));
  const backedDoc = makeAccountDoc(HUB, { ...createDefaultDelta(1), collateral: 30_000_000n, ondelta: 30_000_000n });

  // TRON Base58 with explicit jurisdictionMode: 'tron' -> normalized in both from-reserve and from-hub-collateral
  const tronReservePlan = planEverydayCashOut({
    frame: makeFrame({ accounts: [emptyDoc], reserves: new Map([[1, 25_000_000n]]) }),
    entityId: SELF, recipientEoa: TRON_BASE58, tokenId: 1, amount: 20_000_000n,
    jurisdictionMode: 'tron', nativeBalance: 10n ** 16n, deriveDeltaFn: deriveDelta,
  });
  expect(tronReservePlan.kind).toBe('from-reserve');
  if (tronReservePlan.kind === 'from-reserve') {
    expect(tronReservePlan.entityTxs[0]).toEqual(expectedR2e);
  }

  const tronCollateralPlan = planEverydayCashOut({
    frame: makeFrame({ accounts: [backedDoc] }),
    entityId: SELF, recipientEoa: TRON_BASE58, tokenId: 1, amount: 20_000_000n,
    jurisdictionMode: 'tron', nativeBalance: 10n ** 16n, deriveDeltaFn: deriveDelta,
  });
  expect(tronCollateralPlan.kind).toBe('from-hub-collateral');
  if (tronCollateralPlan.kind === 'from-hub-collateral' && tronCollateralPlan.entityTxs[0]?.type === 'settle_propose') {
    expect(tronCollateralPlan.entityTxs[0].data.continuation?.actions[0]).toEqual({
      type: 'r2e',
      receivingEntity: expectedR2e.data.receivingEntity,
      tokenId: 1,
      amount: 20_000_000n,
    });
  }

  // TRON Base58 detected via frame chainId (3448148188 Shasta) without explicit jurisdictionMode
  const tronFramePlan = planEverydayCashOut({
    frame: makeFrame({ accounts: [emptyDoc], reserves: new Map([[1, 25_000_000n]]), chainId: 3448148188 }),
    entityId: SELF, recipientEoa: TRON_BASE58, tokenId: 1, amount: 20_000_000n,
    nativeBalance: 10n ** 16n, deriveDeltaFn: deriveDelta,
  });
  expect(tronFramePlan.kind).toBe('from-reserve');

  // Cross-jurisdiction rejection: TRON Base58 on EVM (31337) or unspecified jurisdiction returns invalid-recipient without throwing
  for (const chainId of [31337, undefined]) {
    expect(planEverydayCashOut({
      frame: makeFrame({ accounts: [emptyDoc], reserves: new Map([[1, 25_000_000n]]), ...(chainId !== undefined ? { chainId } : {}) }),
      entityId: SELF, recipientEoa: TRON_BASE58, tokenId: 1, amount: 20_000_000n,
      nativeBalance: 10n ** 16n, deriveDeltaFn: deriveDelta,
    })).toEqual({ kind: 'invalid-recipient', message: 'Recipient must be a valid EOA address' });
  }

  // Empty, malformed, and bad-checksum / lowercased TRON Base58 return invalid-recipient without throwing
  for (const badRecipient of ['', '   ', 'not-an-address', '0x1234', TRON_BASE58.toLowerCase()]) {
    expect(planEverydayCashOut({
      frame: makeFrame({ accounts: [emptyDoc], reserves: new Map([[1, 25_000_000n]]), chainId: 3448148188 }),
      entityId: SELF, recipientEoa: badRecipient, tokenId: 1, amount: 20_000_000n,
      jurisdictionMode: 'tron', nativeBalance: 10n ** 16n, deriveDeltaFn: deriveDelta,
    })).toEqual({ kind: 'invalid-recipient', message: 'Recipient must be a valid EOA address' });
  }

  expect(planEverydayCashOut({
    frame: makeFrame({ accounts: [emptyDoc] }),
    entityId: SELF, recipientEoa: '', tokenId: 1, amount: 0n,
    nativeBalance: 10n ** 16n, deriveDeltaFn: deriveDelta,
  })).toEqual({ kind: 'insufficient', shortfall: 0n, available: 0n });
});
