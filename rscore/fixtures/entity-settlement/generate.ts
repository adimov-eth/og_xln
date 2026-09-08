/**
 * TypeScript production-reducer oracle for the Entity settlement + dispute-start
 * family (`settle_propose`, `settle_update`, `settle_approve`, `settle_reject`,
 * `settle_execute`, `disputeStart`).
 *
 * These six kinds were the only Entity transactions without a cross-engine
 * semantic vector, and the production H1 replay diverged inside exactly that
 * family: TypeScript keeps a signed ProofBody offset as the Solidity
 * `Int512 { high, low }` tuple in `jBatchState`, the Rust projection flattened
 * it to one BigInt, and the Entity state root split at the first dispute start.
 *
 * Run from the repository root:
 *   bun rscore/fixtures/entity-settlement/generate.ts
 */
import { createHash } from 'node:crypto';

import { createEmptyAccountJClaimAccumulator } from '../../../core/account/j-claims/j-claim-accumulator';
import { PersistentAccountStateMap } from '../../../core/account/state/persistent-state-map';
import { createDefaultDelta } from '../../../core/account/state/delta';
import { deriveSignerAddressSync, deriveSignerKeySync, registerSignerKey } from '../../../core/account/crypto';
import { buildAccountProofBodyFromJurisdictions } from '../../../core/account/consensus/helpers';
import {
  computeCanonicalEntityConsensusStateHashCold,
  computeEntityAccountValueHash,
  computeEntityConsensusSectionDigestsCold,
} from '../../../core/entity/consensus/state-root';
import { readEntityFrameEvents, clearEntityFrameEvents } from '../../../core/entity/frame-events';
import { initCrontab } from '../../../core/entity/scheduler';
import { PersistentEntityAccountMap } from '../../../core/entity/state/persistent-account-map';
import { PersistentEntityCollectionMap } from '../../../core/entity/state/persistent-collection-map';
import { applyEntityTx } from '../../../core/entity/tx/apply';
import { createEntityFrameCandidateState } from '../../../core/entity/state-clone';
import { createEmptyEnv } from '../../../core/runtime';
import { encodeSignedHanko } from '../../../core/hanko/codec';
import { resolveHankoBoardDelays } from '../../../core/hanko/claims';
import { lazySingleSignerEntityId } from '../../../core/hanko/short';
import { createDisputeProofHashWithNonce, createSettlementHashWithNonce } from '../../../core/protocol/dispute/proof-builder';
import { createSettlementWorkspaceHash } from '../../../core/account/tx/handlers/settlement/transition';
import { compileOps } from '../../../core/protocol/settlement/operations';
import { projectSettlementDeltaOverrides } from '../../../core/account/settlement/settlement-projection';
import { safeStringify } from '../../../core/protocol/serialization';
import { encodeCanonicalConsensusBytes } from '../../../core/protocol/serialization/binary-codec';
import type { AccountReplica, SettlementOp } from '../../../core/types/account';
import type { ConsensusConfig, EntityState } from '../../../core/entity/types';
import type { EntityRuntimeContext } from '../../../core/entity/runtime-context';
import type { EntityTx } from '../../../core/types/entity-tx';
import type { RuntimeReplica } from '../../../core/runtime/types';

const RUNTIME_SEED = 'entity-settlement-semantic-fixture';
const DEPOSITORY = `0x${'88'.repeat(20)}`;
const ENTITY_PROVIDER = `0x${'99'.repeat(20)}`;
const DELTA_TRANSFORMER = `0x${'77'.repeat(20)}`;
const ACCOUNT_CONTRACT = `0x${'66'.repeat(20)}`;
const CHAIN_ID = 31_337;
const JURISDICTION = {
  name: 'EntitySettlementFixture',
  address: 'rpc://entity-settlement-fixture',
  chainId: CHAIN_ID,
  blockTimeMs: 1_000,
  depositoryAddress: DEPOSITORY,
  entityProviderAddress: ENTITY_PROVIDER,
};
const TIMESTAMP = 2_000;
const WATCH_SEED = `0x${'f1'.repeat(32)}`;

const digest = (value: unknown): string =>
  `0x${createHash('sha256').update(encodeCanonicalConsensusBytes(value)).digest('hex')}`;

const canonicalJson = (value: unknown): unknown => JSON.parse(safeStringify(value));

const singleSignerConfig = (signer: string): ConsensusConfig => ({
  mode: 'proposer-based',
  threshold: 1n,
  validators: [signer],
  shares: { [signer]: 1n },
  jurisdiction: JURISDICTION,
});

/** One deterministic Runtime that owns both boards and both signer keys. */
const buildContext = (): Readonly<{
  context: RuntimeReplica & EntityRuntimeContext;
  localSigner: string;
  peerSigner: string;
  localEntityId: string;
  peerEntityId: string;
  localConfig: ConsensusConfig;
  peerConfig: ConsensusConfig;
}> => {
  const context = createEmptyEnv(RUNTIME_SEED) as RuntimeReplica & EntityRuntimeContext;
  context.state.timestamp = TIMESTAMP;
  context.activeJurisdiction = JURISDICTION.name;
  const localSigner = deriveSignerAddressSync(RUNTIME_SEED, 'local').toLowerCase();
  const peerSigner = deriveSignerAddressSync(RUNTIME_SEED, 'peer').toLowerCase();
  registerSignerKey(context, localSigner, deriveSignerKeySync(RUNTIME_SEED, 'local'));
  registerSignerKey(context, peerSigner, deriveSignerKeySync(RUNTIME_SEED, 'peer'));
  context.runtimeId = localSigner;
  context.state.jReplicas.set(JURISDICTION.name, {
    name: JURISDICTION.name,
    chainId: CHAIN_ID,
    rpcs: [JURISDICTION.address],
    contracts: {
      depository: DEPOSITORY,
      entityProvider: ENTITY_PROVIDER,
      account: ACCOUNT_CONTRACT,
      deltaTransformer: DELTA_TRANSFORMER,
    },
    blockTimeMs: JURISDICTION.blockTimeMs,
  } as never);
  const localConfig = singleSignerConfig(localSigner);
  const peerConfig = singleSignerConfig(peerSigner);
  return {
    context,
    localSigner,
    peerSigner,
    localEntityId: lazySingleSignerEntityId(localSigner),
    peerEntityId: lazySingleSignerEntityId(peerSigner),
    localConfig,
    peerConfig,
  };
};

const baseState = (entityId: string, config: ConsensusConfig): EntityState => ({
  entityId,
  entityEncryptionPublicKey: `0x${'55'.repeat(32)}`,
  height: 0,
  timestamp: TIMESTAMP,
  nonces: new Map(),
  proposals: new Map(),
  config,
  reserves: new Map(),
  accounts: PersistentEntityAccountMap.empty(entityId, computeEntityAccountValueHash),
  lastFinalizedJHeight: 0,
  profile: { name: 'entity-settlement-fixture', isHub: true, avatar: '', bio: '', website: '' },
  paybook: { entries: PersistentEntityCollectionMap.empty('paybookHashlock'), feesEarned: 0n },
  crontabState: initCrontab(),
  hubRebalanceConfig: {
    matchingStrategy: 'amount',
    policyVersion: 1,
    routingFeePPM: 1,
    baseFee: 0n,
    swapTakerFeeBps: 1,
    rebalanceLiquidityFeeBps: 1n,
  },
});

const makeAccount = (leftEntity: string, rightEntity: string): AccountReplica => ({
  state: {
    leftEntity,
    rightEntity,
    domain: { chainId: CHAIN_ID, depositoryAddress: DEPOSITORY },
    watchSeed: WATCH_SEED,
    deltas: PersistentAccountStateMap.empty('deltas'),
    locks: PersistentAccountStateMap.empty('locks'),
    swapOffers: PersistentAccountStateMap.empty('swapOffers'),
    leftPendingJClaims: createEmptyAccountJClaimAccumulator(),
    rightPendingJClaims: createEmptyAccountJClaimAccumulator(),
    lastFinalizedJHeight: 0,
    disputeConfig: { leftResponseSeconds: 86_400, rightResponseSeconds: 3_600 },
    jNonce: 0,
    requestedRebalance: PersistentAccountStateMap.empty('requestedRebalance'),
    requestedRebalanceFeeState: PersistentAccountStateMap.empty('requestedRebalanceFeeState'),
  },
  status: 'active',
  mempool: [],
  currentFrame: {
    height: 0,
    timestamp: 0,
    jHeight: 0,
    accountTxs: [],
    prevFrameHash: '',
    accountStateRoot: `0x${'00'.repeat(32)}`,
    deltas: [],
    stateHash: '',
    byLeft: true,
  },
  currentHeight: 0,
  rollbackCount: 0,
  proofHeader: { fromEntity: leftEntity, toEntity: rightEntity, nextProofNonce: 0 },
  pendingWithdrawals: PersistentAccountStateMap.empty('pendingWithdrawals'),
  shadow: {
    rebalance: {
      policy: PersistentAccountStateMap.empty('rebalanceShadowPolicy'),
      submittedAtByToken: PersistentAccountStateMap.empty('rebalanceShadowSubmitted'),
    },
  },
});

/**
 * Non-zero, both-sign offdeltas: the exact production shape whose `Int512`
 * limbs split the two engines' `jBatchState` section.
 */
const fundAccount = (account: AccountReplica): void => {
  account.state.deltas = account.state.deltas
    .updated(1, { ...createDefaultDelta(1), collateral: 10_000n, offdelta: 5_200_080_000n })
    .updated(2, { ...createDefaultDelta(2), collateral: 10_000n, offdelta: -80_040_000_000_000_000n })
    .updated(3, { ...createDefaultDelta(3), collateral: 10_000n, offdelta: 0n });
};

/**
 * Full single-signer envelope over a lazy 1-of-1 board. Off-chain consensus
 * always verifies the envelope; the 65-byte chain shortcut is a submission-time
 * compaction and would not decode here.
 */
const hankoFor = (hash: string, label: 'local' | 'peer', entityId: string): string =>
  encodeSignedHanko({
    digest: hash,
    privateKeys: [deriveSignerKeySync(RUNTIME_SEED, label)],
    placeholders: [],
    claims: [{
      entityId: entityId as `0x${string}`,
      entityIndexes: [0n],
      weights: [1n],
      threshold: 1n,
      ...resolveHankoBoardDelays(),
    }],
    memberSignatures: [],
  });

const projectState = (state: EntityState) => ({
  root: computeCanonicalEntityConsensusStateHashCold(state),
  sections: computeEntityConsensusSectionDigestsCold(state),
});

const changedSections = (
  before: ReturnType<typeof projectState>,
  after: ReturnType<typeof projectState>,
): string[] => {
  const beforeByField = new Map(before.sections.map(({ field, digest: value }) => [field, value]));
  return after.sections
    .filter(({ field, digest: value }) => beforeByField.get(field) !== value)
    .map(({ field }) => field);
};

type Fixture = {
  entityId: string;
  counterpartyEntityId: string;
  localIsLeft: boolean;
  state: EntityState;
  account: AccountReplica;
  context: EntityRuntimeContext;
};

/**
 * `prepare` runs before the Account enters the persistent Entity map: the map
 * freezes the replica it stores, exactly as production Account admission does.
 */
const setup = (
  prepare: (account: AccountReplica, fixture: Readonly<{
    entityId: string;
    counterpartyEntityId: string;
    localIsLeft: boolean;
    context: EntityRuntimeContext;
  }>) => void = () => undefined,
): Fixture => {
  const built = buildContext();
  const state = baseState(built.localEntityId, built.localConfig);
  const localIsLeft = built.localEntityId.toLowerCase() < built.peerEntityId.toLowerCase();
  const account = makeAccount(
    localIsLeft ? built.localEntityId : built.peerEntityId,
    localIsLeft ? built.peerEntityId : built.localEntityId,
  );
  fundAccount(account);
  prepare(account, {
    entityId: built.localEntityId,
    counterpartyEntityId: built.peerEntityId,
    localIsLeft,
    context: built.context,
  });
  state.accounts = state.accounts.updated(built.peerEntityId, account);
  return {
    entityId: built.localEntityId,
    counterpartyEntityId: built.peerEntityId,
    localIsLeft,
    state,
    account,
    context: built.context,
  };
};

const setupSummary = (fixture: Fixture) => ({
  entityId: fixture.entityId,
  counterpartyEntityId: fixture.counterpartyEntityId,
  localIsLeft: fixture.localIsLeft,
  timestamp: fixture.state.timestamp,
  deltaTransformer: DELTA_TRANSFORMER,
  domain: { chainId: CHAIN_ID, depositoryAddress: DEPOSITORY },
  disputeConfig: fixture.account.state.disputeConfig,
  watchSeed: WATCH_SEED,
  offdeltas: [...fixture.account.state.deltas.entries()].map(([tokenId, delta]) => ({
    tokenId,
    offdelta: delta.offdelta,
    collateral: delta.collateral,
  })),
});

/**
 * Exactly the Account projection the Rust Entity kernel consumes
 * (`LocalAccountFinancialView`), so the Rust vector starts from the same
 * committed Account facts this TypeScript reducer read.
 */
const accountView = (fixture: Fixture) => {
  const account = fixture.account;
  const workspace = account.state.settlementWorkspace ?? null;
  const settlementExecution = workspace?.settlementHash && workspace.nonceAtSign
    ? (() => {
        const { diffs, forgiveTokenIds } = compileOps(workspace.ops, workspace.lastModifiedByLeft);
        return {
          revision: workspace.revision,
          workspaceHash: workspace.workspaceHash,
          nonce: workspace.nonceAtSign,
          diffs,
          forgiveTokenIds,
          counterpartyHanko: fixture.localIsLeft ? workspace.rightHanko : workspace.leftHanko,
        };
      })()
    : null;
  return {
    ownerIsLeft: fixture.localIsLeft,
    status: account.status ?? 'active',
    jNonce: account.state.jNonce,
    settlementTransitionPending: false,
    settlementWorkspace: workspace,
    settlementExecution,
    disputePrepare: account.disputePrepare ?? null,
    counterpartyDispute: account.counterpartyDisputeProofHanko
      ? {
          hanko: account.counterpartyDisputeProofHanko,
          nonce: account.counterpartyDisputeProofNonce,
          proofBodyHash: account.counterpartyDisputeProofBodyHash,
          proposerIsLeft: account.counterpartyDisputeProofProposerIsLeft,
        }
      : null,
  };
};

const applyCase = async (
  name: string,
  tx: EntityTx,
  fixture: Fixture,
  extra: Record<string, unknown> = {},
) => {
  clearEntityFrameEvents(fixture.state);
  const before = projectState(fixture.state);
  const summary = setupSummary(fixture);
  const view = accountView(fixture);
  // Entity handlers may only write an Account inside a frame candidate, exactly
  // as `applyEntityFrame` does in production.
  const candidate = createEntityFrameCandidateState(fixture.state);
  const result = await applyEntityTx(fixture.context, candidate, tx, { mutableFrameState: true });
  const after = projectState(result.newState);
  const evidence = {
    events: readEntityFrameEvents(result.newState),
    accountTxs: (result.accountTxs ?? []).map(({ accountId, tx: accountTx }) => ({ accountId, tx: accountTx })),
    outputs: result.outputs,
    jOutputs: result.jOutputs ?? [],
    hashesToSign: result.hashesToSign ?? [],
    ...extra,
  };
  return canonicalJson({
    name,
    tx,
    setup: summary,
    accountView: view,
    before,
    after,
    changedSections: changedSections(before, after),
    evidence,
    evidenceDigest: digest(evidence),
    jBatchState: result.newState.jBatchState ?? null,
    accountStatus: result.newState.accounts.get(fixture.counterpartyEntityId)?.status ?? null,
  });
};

const OPS: SettlementOp[] = [
  { type: 'r2c', tokenId: 1, amount: 500n },
];
const UPDATED_OPS: SettlementOp[] = [
  { type: 'r2c', tokenId: 1, amount: 700n },
];

type PrepareInfo = Readonly<{
  entityId: string;
  counterpartyEntityId: string;
  localIsLeft: boolean;
  context: EntityRuntimeContext;
}>;

/**
 * Install the committed workspace that update/approve/reject/execute act on.
 * Runs before the Account is frozen into the persistent Entity map.
 */
const installWorkspace = (
  account: AccountReplica,
  info: PrepareInfo,
  ops: SettlementOp[],
  options: { signed?: boolean } = {},
): void => {
  const workspace = {
    workspaceHash: '',
    ops: structuredClone(ops),
    lastModifiedByLeft: info.localIsLeft,
    status: 'draft',
    revision: 1,
    createdAt: TIMESTAMP,
    lastUpdatedAt: TIMESTAMP,
    executorIsLeft: info.localIsLeft,
  } as NonNullable<AccountReplica['state']['settlementWorkspace']>;
  account.state.settlementWorkspace = workspace;
  workspace.workspaceHash = createSettlementWorkspaceHash(account.state, workspace);
  if (!options.signed) return;
  const { diffs, forgiveTokenIds } = compileOps(workspace.ops, workspace.lastModifiedByLeft);
  const settlementNonce = 1;
  const settlementHash = createSettlementHashWithNonce(
    account.state,
    diffs,
    forgiveTokenIds,
    { chainId: CHAIN_ID, depositoryAddress: DEPOSITORY },
    settlementNonce,
  );
  workspace.settlementHash = settlementHash;
  workspace.nonceAtSign = settlementNonce;
  workspace.status = 'ready_to_submit';
  const counterpartyHanko = hankoFor(settlementHash, 'peer', info.counterpartyEntityId);
  if (info.localIsLeft) workspace.rightHanko = counterpartyHanko;
  else workspace.leftHanko = counterpartyHanko;
  workspace.leftHanko ??= hankoFor(settlementHash, 'local', info.entityId);
  workspace.rightHanko ??= hankoFor(settlementHash, 'local', info.entityId);
  // The executor may only submit a settlement whose post-state dispute proof is
  // already bilaterally signed at `signedNonce + 1`.
  const postNonce = settlementNonce + 1;
  const projected = projectSettlementDeltaOverrides(account, diffs, forgiveTokenIds);
  const postProof = buildAccountProofBodyFromJurisdictions(info.context.state, account, projected);
  const postDisputeHash = createDisputeProofHashWithNonce(
    account.state,
    postProof.proofBodyHash,
    { chainId: CHAIN_ID, depositoryAddress: DEPOSITORY },
    postNonce,
    info.localIsLeft,
  );
  workspace.postSettlementDisputeProof = {
    proofBodyHash: postProof.proofBodyHash,
    disputeHash: postDisputeHash,
    nonce: postNonce,
    proposerIsLeft: info.localIsLeft,
    leftHanko: hankoFor(
      postDisputeHash,
      info.localIsLeft ? 'local' : 'peer',
      info.localIsLeft ? info.entityId : info.counterpartyEntityId,
    ),
    rightHanko: hankoFor(
      postDisputeHash,
      info.localIsLeft ? 'peer' : 'local',
      info.localIsLeft ? info.counterpartyEntityId : info.entityId,
    ),
  };
  workspace.workspaceHash = createSettlementWorkspaceHash(account.state, workspace);
};

/** Counterparty-signed dispute evidence, exactly as a prepared Account holds it. */
const installDisputeEvidence = (account: AccountReplica, info: PrepareInfo) => {
  const proof = buildAccountProofBodyFromJurisdictions(info.context.state, account);
  const signedNonce = 20;
  const proposerIsLeft = !info.localIsLeft;
  const disputeHash = createDisputeProofHashWithNonce(
    account.state,
    proof.proofBodyHash,
    { chainId: CHAIN_ID, depositoryAddress: DEPOSITORY },
    signedNonce,
    proposerIsLeft,
  );
  account.counterpartyDisputeProofHanko = hankoFor(disputeHash, 'peer', info.counterpartyEntityId);
  account.counterpartyDisputeProofBodyHash = proof.proofBodyHash;
  account.counterpartyDisputeProofNonce = signedNonce;
  account.counterpartyDisputeProofProposerIsLeft = proposerIsLeft;
  account.counterpartyDisputeHash = disputeHash;
  account.status = 'dispute_preparing';
  account.disputePrepare = {
    startedAt: TIMESTAMP,
    readyAfter: TIMESTAMP,
    reason: 'fixture-prepare',
    startIntent: { description: 'fixture-dispute' },
  };
  return {
    counterpartyDispute: {
      hanko: account.counterpartyDisputeProofHanko,
      proofBodyHash: proof.proofBodyHash,
      nonce: signedNonce,
      proposerIsLeft,
      disputeHash,
    },
    proofBody: proof.proofBodyStruct,
  };
};

const proposeCase = async () => {
  const fixture = setup();
  return applyCase('settle_propose', {
    type: 'settle_propose',
    data: { counterpartyEntityId: fixture.counterpartyEntityId, ops: OPS, memo: 'fixture-propose' },
  }, fixture);
};

const updateCase = async () => {
  const fixture = setup((account, info) => installWorkspace(account, info, OPS));
  return applyCase('settle_update', {
    type: 'settle_update',
    data: { counterpartyEntityId: fixture.counterpartyEntityId, ops: UPDATED_OPS, memo: 'fixture-update' },
  }, fixture);
};

const approveCase = async () => {
  const fixture = setup((account, info) => installWorkspace(account, info, OPS));
  return applyCase('settle_approve', {
    type: 'settle_approve',
    data: {
      counterpartyEntityId: fixture.counterpartyEntityId,
      workspaceHash: fixture.account.state.settlementWorkspace!.workspaceHash,
    },
  }, fixture);
};

const rejectCase = async () => {
  const fixture = setup((account, info) => installWorkspace(account, info, OPS));
  return applyCase('settle_reject', {
    type: 'settle_reject',
    data: { counterpartyEntityId: fixture.counterpartyEntityId, reason: 'fixture-reject' },
  }, fixture);
};

const executeCase = async () => {
  const fixture = setup((account, info) => installWorkspace(account, info, OPS, { signed: true }));
  return applyCase('settle_execute', {
    type: 'settle_execute',
    data: { counterpartyEntityId: fixture.counterpartyEntityId },
  }, fixture);
};

const disputeStartCase = async () => {
  let evidence: ReturnType<typeof installDisputeEvidence> | null = null;
  const fixture = setup((account, info) => {
    evidence = installDisputeEvidence(account, info);
  });
  return applyCase('disputeStart', {
    type: 'disputeStart',
    data: { counterpartyEntityId: fixture.counterpartyEntityId, description: 'fixture-dispute' },
  }, fixture, evidence ?? {});
};

const fixture = {
  version: 1,
  canonicalSource: 'TypeScript production Entity settlement and dispute-start reducers',
  cases: [
    await proposeCase(),
    await updateCase(),
    await approveCase(),
    await rejectCase(),
    await executeCase(),
    await disputeStartCase(),
  ],
};

await Bun.write(new URL('./settlement-v1.json', import.meta.url), `${safeStringify(fixture, 2)}\n`);
