import { expect, test } from 'bun:test';
import { createDefaultDelta } from '../../../core/account/state/delta';
import { deriveDelta } from '../../../core/account/utils';
import type { JBatch, RuntimeAdapterViewFrame } from '../../../core/api/public/runtime-module';
import {
  draftReserveDelta,
  inspectHubRebalanceStatus,
  planEverydayCashOut,
  planEverydaySend,
} from '../../../frontend/src/lib/everyday/everyday-autopilot';
import { projectEverydayWallet } from '../../../frontend/src/lib/everyday/everyday-projection';
import { parseEverydayTowerUrls, resolveDefaultTowerUrls } from '../../../frontend/src/lib/everyday/everyday-recovery';

const SELF = `0x${'11'.repeat(32)}`;
const HUB = `0x${'22'.repeat(32)}`;
const HUB_DISPUTED = `0x${'23'.repeat(32)}`;
const FRIEND = `0x${'33'.repeat(32)}`;
const SIGNER = `0x${'44'.repeat(20)}`;
const TOKEN_ADDR = `0x${'55'.repeat(20)}`;
const EOA = `0x${'66'.repeat(20)}`;

const makeBaseFrame = (): RuntimeAdapterViewFrame => ({
  activeEntityId: SELF,
  entities: [
    { entityId: SELF, signerId: SIGNER, height: 1, label: 'Bob', isHub: false },
    { entityId: HUB, signerId: SIGNER, height: 1, label: 'Hub1', isHub: true },
    { entityId: HUB_DISPUTED, signerId: SIGNER, height: 1, label: 'HubDisputed', isHub: true },
  ],
  activeEntity: {
    summary: { entityId: SELF, signerId: SIGNER, height: 1, label: 'Bob', isHub: false, jurisdiction: { name: 'sepolia', chainId: 11155111 } },
    core: { signerId: SIGNER, reserves: new Map([[1, 20_000_000n]]), config: { jurisdiction: { name: 'sepolia', chainId: 11155111 } } },
    accounts: { items: [] },
  },
} as unknown as RuntimeAdapterViewFrame);

test('planEverydaySend covers missing hub doc, r2c needs-gas, and allowance=null approval', () => {
  const route = { path: [SELF, HUB, FRIEND], totalFee: 0n, senderAmount: 10_000_000n, recipientAmount: 10_000_000n };
  expect(planEverydaySend({
    frame: makeBaseFrame(), entityId: SELF, signerId: SIGNER, targetEntityId: FRIEND,
    tokenId: 1, deliveryMode: 'instant', description: 'Pay', route, externalRows: [], nativeBalance: 1n, deriveDeltaFn: deriveDelta,
  })).toEqual({ kind: 'insufficient', shortfall: 10_000_000n });

  const frameWithHub = makeBaseFrame();
  const [leftEntity, rightEntity] = SELF < HUB ? [SELF, HUB] : [HUB, SELF];
  frameWithHub.activeEntity!.accounts.items = [{
    status: 'active',
    state: { leftEntity, rightEntity, deltas: new Map([[1, createDefaultDelta(1)]]) },
  } as never];

  // fromReserve covers all 10M (fromExternal === 0n), but r2c still requires gas when nativeBalance === 0n
  const gasPlan = planEverydaySend({
    frame: frameWithHub, entityId: SELF, signerId: SIGNER, targetEntityId: FRIEND,
    tokenId: 1, deliveryMode: 'instant', description: 'Pay', route,
    externalRows: [{ tokenAddress: TOKEN_ADDR, tokenId: 1, balance: 0n, allowance: null }],
    nativeBalance: 0n, deriveDeltaFn: deriveDelta,
  });
  expect(gasPlan.kind).toBe('needs-gas');
  if (gasPlan.kind === 'needs-gas') expect(gasPlan.requiredTx).toBe('r2c');

  // When reserve=0 and allowance=null, needsApprovalAmount equals fromExternal
  frameWithHub.activeEntity!.core.reserves = new Map();
  const nullAllowancePlan = planEverydaySend({
    frame: frameWithHub, entityId: SELF, signerId: SIGNER, targetEntityId: FRIEND,
    tokenId: 1, deliveryMode: 'instant', description: 'Pay', route,
    externalRows: [{ tokenAddress: TOKEN_ADDR, tokenId: 1, balance: 15_000_000n, allowance: null }],
    nativeBalance: 1_000n, deriveDeltaFn: deriveDelta,
  });
  expect(nullAllowancePlan.kind).toBe('fund-and-pay');
  if (nullAllowancePlan.kind === 'fund-and-pay') {
    expect(nullAllowancePlan.needsApprovalAmount).toBe(10_000_000n);
  }
});

test('planEverydayCashOut skips disputed hubs and returns pending-settlement when settlementWorkspace is busy', () => {
  const frame = makeBaseFrame();
  frame.activeEntity!.core.reserves = new Map();
  const mkHubDoc = (hubId: string, collateral: bigint, opts?: { disputed?: boolean; busy?: boolean }) => {
    const isLeft = SELF < hubId;
    const [leftEntity, rightEntity] = isLeft ? [SELF, hubId] : [hubId, SELF];
    const delta = { ...createDefaultDelta(1), collateral, ondelta: isLeft ? collateral : 0n };
    return {
      status: opts?.disputed ? 'disputed' : 'active',
      activeDispute: opts?.disputed ? { observedOnChain: true } : undefined,
      state: {
        leftEntity, rightEntity, deltas: new Map([[1, delta]]),
        ...(opts?.busy ? { settlementWorkspace: { phase: 'proposed' } } : {}),
      },
    };
  };

  frame.activeEntity!.accounts.items = [
    mkHubDoc(HUB_DISPUTED, 50_000_000n, { disputed: true }) as never,
    mkHubDoc(HUB, 30_000_000n, { busy: false }) as never,
  ];
  const activePlan = planEverydayCashOut({
    frame, entityId: SELF, recipientEoa: EOA, tokenId: 1, amount: 25_000_000n, nativeBalance: 1_000n, deriveDeltaFn: deriveDelta,
  });
  expect(activePlan.kind).toBe('from-hub-collateral');

  frame.activeEntity!.accounts.items = [
    mkHubDoc(HUB, 30_000_000n, { busy: true }) as never,
  ];
  expect(planEverydayCashOut({
    frame, entityId: SELF, recipientEoa: EOA, tokenId: 1, amount: 25_000_000n, nativeBalance: 1_000n, deriveDeltaFn: deriveDelta,
  })).toEqual({ kind: 'pending-settlement' });
});

test('draftReserveDelta and inspectHubRebalanceStatus cover every settlement/batch op and rebalance status branch', () => {
  const batch: Partial<JBatch> = {
    externalTokenToReserve: [{ internalTokenId: 1, amount: 100n, tokenAddress: TOKEN_ADDR }],
    collateralToReserve: [{ tokenId: 1, amount: 40n, entity: SELF, counterentity: HUB }] as never,
    settlements: [
      { leftEntity: SELF, rightEntity: HUB, diffs: [{ tokenId: 1, leftDiff: 25n, rightDiff: -25n }] },
      { leftEntity: HUB, rightEntity: SELF, diffs: [{ tokenId: 1, leftDiff: -10n, rightDiff: 10n }] },
    ] as never,
    reserveToReserve: [
      { tokenId: 1, amount: 15n, receivingEntity: SELF },
      { tokenId: 1, amount: 20n, receivingEntity: HUB },
    ] as never,
    reserveToExternalToken: [{ tokenId: 1, amount: 30n }] as never,
    reserveToCollateral: [{ tokenId: 1, receivingEntity: SELF, pairs: [{ entity: HUB, amount: 5n }] }] as never,
  };
  // 100 + 40 + 25 + 10 + (15 - 15) + (0 - 20) - 30 - 5 = 120
  expect(draftReserveDelta(SELF, batch as JBatch, 1)).toBe(120n);

  const policy = { r2cRequestSoftLimit: 1_000_000n, hardLimit: 250_000_000n, maxAcceptableFee: 2_000_000n };
  const mkDoc = (outPeerCredit: bigint, requestedRebalance: bigint, feeTerms?: { baseFee: bigint; gasFee: bigint; liquidityFeeBps: bigint }) => ({
    currentFrame: { timestamp: 100 },
    state: {
      deltas: new Map([[1, { ...createDefaultDelta(1), offdelta: outPeerCredit }]]),
      requestedRebalance: requestedRebalance > 0n ? new Map([[1, requestedRebalance]]) : new Map(),
      rebalanceFeePolicies: feeTerms
        ? new Map([[1, { right: { baseFee: feeTerms.baseFee, gasFee: feeTerms.gasFee, liquidityFeeBps: feeTerms.liquidityFeeBps, effectiveAt: 0 } }]])
        : new Map(),
    },
  });

  expect(inspectHubRebalanceStatus({ doc: mkDoc(0n, 0n) as never, isLeft: true, tokenId: 1, policy, deriveDeltaFn: deriveDelta }).status).toBe('settled');
  expect(inspectHubRebalanceStatus({ doc: mkDoc(2_000_000n, 2_000_000n) as never, isLeft: true, tokenId: 1, policy, deriveDeltaFn: deriveDelta }).status).toBe('settling');
  expect(inspectHubRebalanceStatus({ doc: mkDoc(2_000_000n, 0n) as never, isLeft: true, tokenId: 1, policy, deriveDeltaFn: deriveDelta }).status).toBe('pending-queue');
  expect(inspectHubRebalanceStatus({ doc: mkDoc(500_000n, 0n, { baseFee: 10n, gasFee: 0n, liquidityFeeBps: 0n }) as never, isLeft: true, tokenId: 1, policy, deriveDeltaFn: deriveDelta }).status).toBe('below-soft-limit');
  expect(inspectHubRebalanceStatus({ doc: mkDoc(2_000_000n, 0n, { baseFee: 3_000_000n, gasFee: 0n, liquidityFeeBps: 0n }) as never, isLeft: true, tokenId: 1, policy, deriveDeltaFn: deriveDelta }).status).toBe('fee-above-cap');
  expect(inspectHubRebalanceStatus({ doc: mkDoc(1_500_000n, 0n, { baseFee: 1_500_000n, gasFee: 0n, liquidityFeeBps: 0n }) as never, isLeft: true, tokenId: 1, policy, deriveDeltaFn: deriveDelta }).status).toBe('fee-consumes-transfer');
});

test('projectEverydayWallet drops mismatched activeEntity and negates right-side lendingBalances', () => {
  const frame = makeBaseFrame();
  // SELF > OTHER_LOW so isLeft === false
  const lowPeer = `0x${'05'.repeat(32)}`;
  frame.activeEntity!.accounts.items = [{
    status: 'active',
    lendingBalances: new Map([[1, -12_000_000n]]),
    state: { leftEntity: lowPeer, rightEntity: SELF, deltas: new Map([[1, createDefaultDelta(1)]]) },
  } as never];

  const matched = projectEverydayWallet({ frame, entityId: SELF, deriveDeltaFn: deriveDelta });
  expect(matched.primary.savings).toBe(12_000_000n);
  expect(matched.primary.cash).toBe(20_000_000n);

  const mismatched = projectEverydayWallet({ frame, entityId: FRIEND, deriveDeltaFn: deriveDelta });
  expect(mismatched.primary.savings).toBe(0n);
  expect(mismatched.primary.cash).toBe(0n);
  expect(mismatched.signerId).toBeNull();
});

test('parseEverydayTowerUrls rejects non-HTTP(S) schemes and resolveDefaultTowerUrls respects precedence', () => {
  expect(parseEverydayTowerUrls('javascript:alert(1), ftp://bad, ws://bad, https://t1.example/, https://t1.example, http://t2.example/'))
    .toEqual(['https://t1.example', 'http://t2.example']);

  expect(resolveDefaultTowerUrls({
    hostname: 'app.xln.finance', origin: 'https://app.xln.finance',
    globalUrls: ['https://global.example'], localUrls: ['https://local.example'], envUrls: ['https://env.example'],
  })).toEqual(['https://global.example']);

  expect(resolveDefaultTowerUrls({
    hostname: 'app.xln.finance', origin: 'https://app.xln.finance',
    localUrls: ['https://local.example'], envUrls: ['https://env.example'],
  })).toEqual(['https://local.example']);

  expect(resolveDefaultTowerUrls({
    hostname: 'app.xln.finance', origin: 'https://app.xln.finance',
    envUrls: ['https://env.example'],
  })).toEqual(['https://env.example']);

  expect(resolveDefaultTowerUrls({ hostname: 'app.xln.finance', origin: 'https://app.xln.finance' })).toEqual(['https://app.xln.finance']);
  expect(resolveDefaultTowerUrls({ hostname: 'app.xln.finance' })).toEqual(['https://xln.finance']);
  expect(resolveDefaultTowerUrls({ hostname: 'localhost', origin: 'http://localhost:8080' })).toEqual([]);
});
