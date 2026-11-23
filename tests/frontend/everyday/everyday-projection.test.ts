import { expect, test } from 'bun:test';
import { createDefaultDelta } from '../../../core/account/state/delta';
import { deriveDelta } from '../../../core/account/utils';
import { createEmptyAccountJClaimAccumulator } from '../../../core/account/j-claims/j-claim-accumulator';
import type { Delta, RuntimeAdapterEntitySummary, RuntimeAdapterViewFrame } from '../../../core/api/public/runtime-module';
import { classifyExternalRequest, projectEverydayWallet, type EverydayExternalBalanceRow } from '../../../frontend/src/lib/everyday/everyday-projection';
import { readWalletPosture, subscribeWalletPosture, WALLET_POSTURE_STORAGE_KEY, writeWalletPosture } from '../../../frontend/src/lib/everyday/wallet-posture';

type ActiveEntity = NonNullable<RuntimeAdapterViewFrame['activeEntity']>;
type AccountDoc = ActiveEntity['accounts']['items'][number];

const SELF = `0x${'11'.repeat(32)}`;
const HUB = `0x${'22'.repeat(32)}`;
const ALICE = `0x${'33'.repeat(32)}`;
const BOB = `0x${'44'.repeat(32)}`;
const SIGNER = `0x${'55'.repeat(20)}`;
const HASH = `0x${'66'.repeat(32)}`;

const makeAccountDoc = (
  peerId: string,
  deltas: Map<number, Delta>,
  extras: {
    status?: AccountDoc['status'];
    disputePrepare?: AccountDoc['disputePrepare'];
    activeDispute?: AccountDoc['activeDispute'];
    lendingBalances?: AccountDoc['lendingBalances'];
  } = {},
): AccountDoc => {
  const [leftEntity, rightEntity] = SELF < peerId ? [SELF, peerId] : [peerId, SELF];
  return {
    state: {
      leftEntity,
      rightEntity,
      domain: { chainId: 31337, depositoryAddress: `0x${'77'.repeat(20)}` },
      watchSeed: '',
      deltas,
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
    lendingBalances: extras.lendingBalances ?? new Map(),
    shadow: { rebalance: { policy: new Map(), submittedAtByToken: new Map() } },
    ...(extras.disputePrepare ? { disputePrepare: extras.disputePrepare } : {}),
    ...(extras.activeDispute ? { activeDispute: extras.activeDispute } : {}),
  };
};

const makeFrame = (options: {
  accounts: AccountDoc[];
  entities: RuntimeAdapterEntitySummary[];
  reserves?: Map<number, bigint>;
  outgoingDebt?: Map<number, bigint>;
}): RuntimeAdapterViewFrame => {
  const selfSummary: ActiveEntity['summary'] = { entityId: SELF, signerId: SIGNER, height: 7, label: 'Me', isHub: false };
  return {
    height: 7,
    head: {
      schemaVersion: 1, latestHeight: 7, latestMaterializedHeight: 7, latestSnapshotHeight: 0,
      snapshotPeriodFrames: 100, retainSnapshots: 1, epochMaxBytes: 1_048_576,
      accountMerkleRadix: 16, epochReplayBytes: 0, retainedWalBytes: 0,
    },
    entities: [selfSummary, ...options.entities],
    activeEntityId: SELF,
    activeEntity: {
      summary: selfSummary,
      core: {
        entityId: SELF,
        signerId: SIGNER,
        isProposer: true,
        height: 7,
        timestamp: 1000,
        nonces: new Map(),
        proposals: new Map(),
        entityEncryptionPublicKey: '',
        config: { mode: 'proposer-based', threshold: 1n, validators: [SIGNER], shares: { [SIGNER]: 1n }, jurisdiction: { name: 'Local', address: 'http://127.0.0.1:8545', chainId: 31337, entityProviderAddress: SIGNER, depositoryAddress: SIGNER } },
        reserves: options.reserves ?? new Map(),
        debtTotals: { incoming: new Map(), outgoing: options.outgoingDebt ?? new Map() },
        lastFinalizedJHeight: 3,
        profile: { name: 'Me', isHub: false, avatar: '', bio: '', website: '' },
        paybook: { entries: new Map(), feesEarned: 0n },
      },
      accounts: { items: options.accounts, nextCursor: null, totalItems: options.accounts.length },
      books: { items: [], nextCursor: null, totalItems: 0 },
    },
  };
};

const withMockLocalStorage = (initial: Record<string, string>, fn: () => void): void => {
  const store = new Map(Object.entries(initial));
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    },
  });
  try {
    fn();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
};

test('cash projects onchain + reserve + secured hub collateral while offline-hub arriving stays strictly separate', () => {
  const hubDelta: Delta = {
    ...createDefaultDelta(1, { left: 0n, right: 250_000_000n }),
    collateral: 20_000_000n,
    ondelta: 35_000_000n,
  };
  const hubDoc = makeAccountDoc(HUB, new Map([[1, hubDelta]]));
  hubDoc.state.requestedRebalance.set(1, 15_000_000n);
  const frame = makeFrame({
    accounts: [hubDoc],
    entities: [{ entityId: HUB, height: 7, label: 'Main Hub', isHub: true }],
    reserves: new Map([[1, 12_000_000n]]),
    outgoingDebt: new Map([[1, 2_000_000n]]),
  });
  const externalRows: EverydayExternalBalanceRow[] = [
    { tokenId: 1, balance: 5_000_000n },
    { tokenId: 1, balance: 99_000_000n, error: 'RPC_TIMEOUT' },
    { tokenId: 1, balance: 88_000_000n, readError: 'READ_FAILED' },
  ];

  const projected = projectEverydayWallet({ frame, externalRows, deriveDeltaFn: deriveDelta });
  // onchain ($5) + net reserve ($12 - $2 = $10) + hub collateral ($20) = $35; $15 outPeerCredit stays in arriving
  expect(projected.primary.cash).toBe(35_000_000n);
  expect(projected.primary.arriving).toBe(15_000_000n);
  expect(projected.primaryHubId).toBe(HUB);
  expect(projected.friendTabs).toEqual([]);
});

test('friends & tabs separates !isHub peers from hub rails and tracks owed vs owing magnitudes', () => {
  const aliceDelta: Delta = {
    ...createDefaultDelta(1, { left: 100_000_000n, right: 100_000_000n }),
    offdelta: 40_000_000n, // SELF (0x11) < ALICE (0x33) -> Alice owes Self $40
  };
  const bobDelta: Delta = {
    ...createDefaultDelta(1, { left: 100_000_000n, right: 100_000_000n }),
    offdelta: -15_000_000n, // SELF (0x11) < BOB (0x44) -> Self owes Bob $15
  };
  const settledPeerId = `0x${'49'.repeat(32)}`;
  const settledDoc = makeAccountDoc(settledPeerId, new Map([[1, createDefaultDelta(1)], [2, createDefaultDelta(2)]]));
  const hubDoc = makeAccountDoc(HUB, new Map([[1, { ...createDefaultDelta(1), collateral: 10_000_000n, ondelta: 10_000_000n }]]));

  const frame = makeFrame({
    accounts: [makeAccountDoc(ALICE, new Map([[1, aliceDelta]])), makeAccountDoc(BOB, new Map([[1, bobDelta]])), settledDoc, hubDoc],
    entities: [
      { entityId: ALICE, height: 7, label: 'Alice', isHub: false },
      { entityId: BOB, height: 7, label: 'Bob', isHub: false },
      { entityId: settledPeerId, height: 7, label: 'Zed', isHub: false },
      { entityId: HUB, height: 7, label: 'Hub', isHub: true },
    ],
  });

  const projected = projectEverydayWallet({ frame, deriveDeltaFn: deriveDelta });
  expect(projected.primary.friendsOweYou).toBe(40_000_000n);
  expect(projected.primary.youOweFriends).toBe(15_000_000n);
  expect(projected.primary.friendTabs.map(tab => [tab.label, tab.signedAmount])).toEqual([
    ['Alice', 40_000_000n],
    ['Bob', -15_000_000n],
    ['Zed', 0n],
  ]);
  expect(projected.primary.cash).toBe(10_000_000n);
});

test('savings stays strictly separate from cash and respects left/right perspective', () => {
  const hubDoc = makeAccountDoc(HUB, new Map([[1, createDefaultDelta(1)]]), {
    lendingBalances: new Map([[1, 75_000_000n]]),
  });
  const frame = makeFrame({
    accounts: [hubDoc],
    entities: [{ entityId: HUB, height: 7, label: 'Hub', isHub: true }],
  });
  const projected = projectEverydayWallet({ frame, deriveDeltaFn: deriveDelta });
  expect(projected.primary.savings).toBe(75_000_000n);
  expect(projected.primary.cash).toBe(0n);
  expect(projected.primary.arriving).toBe(0n);
});

test('zero L1 gas on active/preparing unilateral exit sets needsL1GasForUnilateralExit and excludes disputed arriving float', () => {
  const hubDelta: Delta = {
    ...createDefaultDelta(1, { left: 0n, right: 250_000_000n }),
    ondelta: 25_000_000n,
  };
  const disputedHub = makeAccountDoc(HUB, new Map([[1, hubDelta]]), {
    status: 'dispute_preparing',
    disputePrepare: { startedAt: 900, readyAfter: 1000, reason: 'hub-offline' },
  });
  const frame = makeFrame({
    accounts: [disputedHub],
    entities: [{ entityId: HUB, height: 7, label: 'Offline Hub', isHub: true }],
  });

  const noGas = projectEverydayWallet({ frame, nativeBalance: 0n, deriveDeltaFn: deriveDelta });
  expect(noGas.hasZeroL1Gas).toBe(true);
  expect(noGas.primary.arriving).toBe(0n);
  expect(noGas.disputes).toEqual([
    { counterpartyId: HUB, label: 'Offline Hub', phase: 'preparing', startedByUs: true, timeout: 0, needsL1GasForUnilateralExit: true },
  ]);

  const withGas = projectEverydayWallet({ frame, nativeBalance: 10_000_000_000_000_000n, deriveDeltaFn: deriveDelta });
  expect(withGas.hasZeroL1Gas).toBe(false);
  expect(withGas.disputes[0]?.needsL1GasForUnilateralExit).toBe(false);

  const closedFrame = makeFrame({
    accounts: [makeAccountDoc(HUB, new Map([[1, hubDelta]]), { status: 'disputed' })],
    entities: [{ entityId: HUB, height: 7, label: 'Closed Hub', isHub: true }],
  });
  const closedNoGas = projectEverydayWallet({ frame: closedFrame, nativeBalance: 0n, deriveDeltaFn: deriveDelta });
  expect(closedNoGas.disputes[0]?.needsL1GasForUnilateralExit).toBe(false);
});

test('classifyExternalRequest blocks disguised hub-credit bait and classifies everyday vs pro flows', () => {
  expect(classifyExternalRequest({ txType: 'htlcPayment', amountLabel: '$12', counterpartyLabel: 'Cafe' }).kind).toBe('cash-spend');
  const friendTab = classifyExternalRequest({ txType: 'extendCredit', isHubTarget: false, counterpartyLabel: 'Alice', amountLabel: '$40' });
  expect(friendTab.kind).toBe('open-friend-tab');
  expect(friendTab.riskNote).toContain('actually know and trust');
  expect(classifyExternalRequest({ txType: 'extendCredit', isHubTarget: true, counterpartyLabel: 'Hub' }).kind).toBe('escalate-pro');
  expect(classifyExternalRequest({ txType: 'placeSwapOffer' }).kind).toBe('escalate-pro');
  expect(classifyExternalRequest({ txType: 'lendingBorrow' }).kind).toBe('escalate-pro');
  expect(classifyExternalRequest({ txType: 'lendingOffer', amountLabel: '$100' }).kind).toBe('savings-deposit');

  const before = createDefaultDelta(1, { left: 0n, right: 10_000_000n });
  const afterUnbacked: Delta = { ...before, ondelta: 5_000_000n };
  expect(classifyExternalRequest({ beforeDelta: before, afterDelta: afterUnbacked, isLeft: true, deriveDeltaFn: deriveDelta }).kind).toBe('escalate-pro');
  const afterCredit = createDefaultDelta(1, { left: 0n, right: 50_000_000n });
  expect(classifyExternalRequest({ beforeDelta: before, afterDelta: afterCredit, isLeft: true, isHubTarget: true, deriveDeltaFn: deriveDelta }).kind).toBe('escalate-pro');
  expect(classifyExternalRequest({ beforeDelta: before, afterDelta: afterCredit, isLeft: true, isHubTarget: false, deriveDeltaFn: deriveDelta }).kind).toBe('open-friend-tab');
});

test('wallet-posture defaults to everyday, notifies subscribers, and honors query overrides without mutating storage', () => {
  withMockLocalStorage({}, () => {
    expect(readWalletPosture('')).toBe('everyday');
    expect(readWalletPosture('?mode=pro')).toBe('pro');
    expect(localStorage.getItem(WALLET_POSTURE_STORAGE_KEY)).toBeNull();
    const seen: string[] = [];
    const unsubscribe = subscribeWalletPosture(posture => seen.push(posture));
    writeWalletPosture('pro');
    expect(readWalletPosture('')).toBe('pro');
    expect(readWalletPosture('?mode=everyday')).toBe('everyday');
    expect(seen).toEqual(['pro']);
    unsubscribe();
    writeWalletPosture('everyday');
    expect(seen).toEqual(['pro']);
  });
});

test('classifyExternalRequest fails closed on unlisted core txTypes and ambiguous credit targets', () => {
  const before = createDefaultDelta(1, { left: 0n, right: 10_000_000n });
  const afterCredit = createDefaultDelta(1, { left: 0n, right: 50_000_000n });

  // Payment allowlist (including omitted txType for /#pay/... invoice links)
  expect(classifyExternalRequest({ invoice: { targetEntityId: ALICE, amount: '12', description: 'Coffee' } }).kind).toBe('cash-spend');
  for (const txType of ['htlcPayment', 'directPayment', 'direct_payment', 'htlc_lock']) {
    expect(classifyExternalRequest({ txType, amountLabel: '$12', counterpartyLabel: 'Alice' }).kind).toBe('cash-spend');
  }

  // Empty / whitespace txType fails closed
  expect(classifyExternalRequest({ txType: '' }).kind).toBe('escalate-pro');
  expect(classifyExternalRequest({ txType: '   ' }).kind).toBe('escalate-pro');

  // Savings allowlist
  for (const txType of ['lendingOffer', 'lending_fund']) {
    expect(classifyExternalRequest({ txType, amountLabel: '$100' }).kind).toBe('savings-deposit');
  }

  // Credit allowlist requires explicit isHubTarget === false
  for (const txType of ['extendCredit', 'openAccount', 'set_credit_limit']) {
    expect(classifyExternalRequest({ txType, isHubTarget: false, counterpartyLabel: 'Alice', amountLabel: '$40' }).kind).toBe('open-friend-tab');
    expect(classifyExternalRequest({ txType, isHubTarget: true, counterpartyLabel: 'Hub' }).kind).toBe('escalate-pro');
    expect(classifyExternalRequest({ txType, counterpartyLabel: 'Unknown' }).kind).toBe('escalate-pro');
  }

  // Unlisted core AccountTx / EntityTx types always escalate to Pro
  const unlistedCoreTxTypes = [
    'settle_propose', 'settle_update', 'settle_approve', 'settle_execute', 'settle_transition',
    'c2r', 'r2e', 'e2r', 'r2c', 'r2r', 'requestCollateral', 'request_collateral', 'rebalance_policy',
    'swap_offer', 'swap_cancel_request', 'swap_resolve', 'crossPullClose', 'cross_pull_lock', 'cross_pull_close',
    'lendingApprove', 'lendingClosePosition', 'lending_borrow_request', 'lending_repay', 'lending_disburse',
    'lending_close_request', 'lending_close_payout', 'entityProviderTransfer', 'entityProviderReleaseControlShares',
    'entityProviderProposeControlBoard', 'entityProviderActivateBoard', 'requestCredit', 'credit_request',
    'prepareDispute', 'disputeStart', 'disputeFinalize', 'mintReserves', 'resolveHtlcLock', 'htlc_resolve',
    'propose', 'vote', 'setHubConfig', 'setRebalancePolicy', 'unknownExternalTx',
  ];
  for (const txType of unlistedCoreTxTypes) {
    expect(classifyExternalRequest({ txType, isHubTarget: false, counterpartyLabel: 'Peer', amountLabel: '$10' }).kind).toBe('escalate-pro');
  }

  // Delta + txType combinations fail closed
  expect(classifyExternalRequest({ beforeDelta: before, afterDelta: afterCredit, isLeft: true, deriveDeltaFn: deriveDelta }).kind).toBe('escalate-pro');
  expect(classifyExternalRequest({ txType: 'htlcPayment', beforeDelta: before, afterDelta: afterCredit, isLeft: true, isHubTarget: false, deriveDeltaFn: deriveDelta }).kind).toBe('escalate-pro');
  expect(classifyExternalRequest({ txType: 'settle_propose', beforeDelta: before, afterDelta: afterCredit, isLeft: true, isHubTarget: false, deriveDeltaFn: deriveDelta }).kind).toBe('escalate-pro');
});
