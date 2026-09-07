/**
 * `proposeAccountsNow` re-emits an Account proposal a peer never received.
 *
 * The outbox is best effort: an offline peer simply never gets the bytes, and
 * nothing resends them. The Account keeps `pendingFrame` plus the exact
 * `pendingAccountInput` it signed, so recovery must be a pure re-emission of
 * those retained bytes — never a rebuilt or dropped frame.
 */
import { describe, expect, test } from 'bun:test';

import { initCrontab } from '../../../entity/scheduler';
import { deriveSignerAddressSync, deriveSignerKeySync, registerSignerKey } from '../../../account/crypto';
import { prepareLocallyAuthoredEntityTxs } from '../../../entity/command';
import { generateLazyEntityId } from '../../../entity/factory';
import { provisionTestEntityEncryptionKey } from '../../../qa/entity-creation-fixture';
import { applyEntityFrameWithMaterializedTestInfraContext } from '../../helpers/entity-frame';
import { createEmptyEnv } from '../../../runtime';
import { safeStringify } from '../../../protocol/serialization';
import { installJurisdictions, makeAccount, makeJurisdiction } from '../../helpers/cross-j';
import { PersistentEntityAccountMap } from '../../../entity/state/persistent-account-map';
import { computeEntityAccountValueHash } from '../../../entity/consensus/state-root';
import { assertProposeAccountsNowMatchesState } from '../../../entity/consensus/account/propose-accounts-now-validation';
import type { EntityOutput, EntityState } from '../../../entity/types';
import type { RuntimeReplica } from '../../../runtime/types';
import type { EntityTx } from '../../../types/entity-tx';

const entityId = (byte: string): string => `0x${byte.repeat(32)}`;
const addr20 = (byte: string): string => `0x${byte.repeat(20)}`;

const PEER = entityId('b2');
const OTHER_PEER = entityId('c3');
const ABSENT_PEER = entityId('e5');

const jurisdiction = makeJurisdiction('ProposeAccountsNowTest', 31_337, '91', '92');

const makeState = (hub: string, proposer: string, timestamp: number): EntityState => ({
  entityId: hub,
  entityEncryptionPublicKey: '',
  height: 0,
  timestamp,
  nonces: new Map(),
  proposals: new Map(),
  config: {
    mode: 'proposer-based',
    threshold: 1n,
    validators: [proposer],
    shares: { [proposer]: 1n },
    jurisdiction,
  },
  reserves: new Map(),
  accounts: PersistentEntityAccountMap.empty(hub, computeEntityAccountValueHash),
  deferredAccountProposals: new Map(),
  lastFinalizedJHeight: 0,
  profile: { name: 'propose-accounts-now-hub', isHub: true, avatar: '', bio: '', website: '' },
  paybook: { entries: new Map(), feesEarned: 0n },
  swapTradingPairs: [],
  crontabState: initCrontab(),
});

const withAccount = (state: EntityState, counterparty: string): void => {
  if (!(state.accounts instanceof PersistentEntityAccountMap)) throw new Error('TEST_ACCOUNTS_NOT_COMMITTED_GRAPH');
  state.accounts = state.accounts.updated(
    counterparty,
    makeAccount(state.entityId, counterparty, jurisdiction),
  );
};

const proposeAccountsNowTx = (proposer: string, counterparties: string[]): EntityTx => ({
  type: 'proposeAccountsNow',
  data: { version: 1, proposerSignerId: proposer, counterparties },
});

const accountInputOutputs = (outputs: readonly EntityOutput[], target: string): EntityOutput[] =>
  outputs.filter(output =>
    output.entityId.toLowerCase() === target.toLowerCase() &&
    output.entityTxs?.length === 1 &&
    output.entityTxs[0]?.type === 'accountInput');

type OfflineProposal = Readonly<{
  env: RuntimeReplica;
  proposer: string;
  state: EntityState;
  outputs: readonly EntityOutput[];
}>;

/**
 * The Hub proposes an Account frame while the peer runtime is offline. The
 * output is produced but never delivered anywhere in this test — exactly the
 * production failure mode: best-effort transport with no resend layer.
 */
const proposeWhilePeerOffline = async (
  label: string,
  counterparties: readonly string[],
  idleAccounts: readonly string[] = [],
): Promise<OfflineProposal> => {
  const env = createEmptyEnv(label);
  env.state.timestamp = 1_000;
  installJurisdictions(env, jurisdiction);
  const seed = env.runtimeSeed;
  if (!seed) throw new Error('TEST_RUNTIME_SEED_REQUIRED');
  const proposer = deriveSignerAddressSync(seed, '1').toLowerCase();
  registerSignerKey(env, proposer, deriveSignerKeySync(seed, '1'));
  // A lazy entity id is its own board hash, so the single signer already owns
  // canonical command authority without a registered board record.
  const hub = generateLazyEntityId([proposer], 1n).toLowerCase();
  const state = makeState(hub, proposer, 1_000);
  state.entityEncryptionPublicKey = provisionTestEntityEncryptionKey(env, hub).publicKey;
  for (const counterparty of [...counterparties, ...idleAccounts]) withAccount(state, counterparty);
  const frameTxs = prepareLocallyAuthoredEntityTxs(env, state, proposer, counterparties.map(counterparty => ({
    type: 'extendCredit',
    data: { counterpartyEntityId: counterparty, tokenId: 1, amount: 25n },
  })));
  const applied = await applyEntityFrameWithMaterializedTestInfraContext(env, state, frameTxs, 1_000);
  return { env, proposer, state: applied.newState, outputs: applied.outputs };
};

describe('proposeAccountsNow', () => {
  test('re-emits the exact retained proposal bytes for a peer that was offline', async () => {
    const offline = await proposeWhilePeerOffline('propose-accounts-now-exact', [PEER]);
    const account = offline.state.accounts.get(PEER);
    if (!account) throw new Error('TEST_ACCOUNT_MISSING');
    // The undelivered proposal is retained verbatim by the Account.
    expect(account.pendingFrame).toBeDefined();
    expect(account.pendingAccountInput).toBeDefined();
    const retainedFrame = safeStringify(account.pendingFrame);
    const retainedInput = safeStringify(account.pendingAccountInput);
    const originalOutputs = accountInputOutputs(offline.outputs, PEER);
    expect(originalOutputs).toHaveLength(1);

    const recovery = await applyEntityFrameWithMaterializedTestInfraContext(
      offline.env,
      offline.state,
      [proposeAccountsNowTx(offline.proposer, [PEER])],
      1_001,
    );

    const reEmitted = accountInputOutputs(recovery.outputs, PEER);
    expect(reEmitted).toHaveLength(1);
    // Byte-identical to what the Account still holds, and to what was sent.
    expect(safeStringify(reEmitted[0])).toBe(safeStringify(originalOutputs[0]));
    expect(safeStringify(reEmitted[0]!.entityTxs![0]!.data)).toBe(retainedInput);

    // The frame was never dropped, replaced or rebuilt.
    const after = recovery.newState.accounts.get(PEER);
    if (!after) throw new Error('TEST_ACCOUNT_MISSING_AFTER');
    expect(safeStringify(after.pendingFrame)).toBe(retainedFrame);
    expect(safeStringify(after.pendingAccountInput)).toBe(retainedInput);
    expect(after.currentHeight).toBe(account.currentHeight);
  });

  test('is idempotent: the same payload twice produces the same outputs and no state change', async () => {
    const offline = await proposeWhilePeerOffline('propose-accounts-now-idempotent', [PEER]);
    const before = safeStringify(offline.state.accounts.get(PEER));
    const tx = proposeAccountsNowTx(offline.proposer, [PEER]);

    const firstRecovery = await applyEntityFrameWithMaterializedTestInfraContext(
      offline.env, offline.state, [tx], 1_001,
    );
    const secondRecovery = await applyEntityFrameWithMaterializedTestInfraContext(
      offline.env, firstRecovery.newState, [structuredClone(tx)], 1_002,
    );

    expect(safeStringify(firstRecovery.newState.accounts.get(PEER))).toBe(before);
    expect(safeStringify(secondRecovery.newState.accounts.get(PEER))).toBe(before);
    expect(safeStringify(accountInputOutputs(secondRecovery.outputs, PEER)))
      .toBe(safeStringify(accountInputOutputs(firstRecovery.outputs, PEER)));
  });

  test('a validator replaying the exact payload produces the proposer outputs', async () => {
    const proposerSide = await proposeWhilePeerOffline('propose-accounts-now-proposer', [PEER]);
    const validatorSide = await proposeWhilePeerOffline('propose-accounts-now-proposer', [PEER]);
    const tx = proposeAccountsNowTx(proposerSide.proposer, [PEER]);

    const proposed = await applyEntityFrameWithMaterializedTestInfraContext(
      proposerSide.env, proposerSide.state, [tx], 1_001,
    );
    const replayed = await applyEntityFrameWithMaterializedTestInfraContext(
      validatorSide.env, validatorSide.state, [structuredClone(tx)], 1_001,
    );

    expect(safeStringify(accountInputOutputs(replayed.outputs, PEER)))
      .toBe(safeStringify(accountInputOutputs(proposed.outputs, PEER)));
  });

  test('skips counterparties without a retained proposal instead of failing', async () => {
    // OTHER_PEER has an Account but never proposed; ABSENT_PEER has no Account.
    const offline = await proposeWhilePeerOffline('propose-accounts-now-noop', [PEER], [OTHER_PEER]);
    const counterparties = [PEER, OTHER_PEER, ABSENT_PEER].map(id => id.toLowerCase()).sort();

    const recovery = await applyEntityFrameWithMaterializedTestInfraContext(
      offline.env,
      offline.state,
      [proposeAccountsNowTx(offline.proposer, counterparties)],
      1_001,
    );

    expect(accountInputOutputs(recovery.outputs, PEER)).toHaveLength(1);
    expect(accountInputOutputs(recovery.outputs, OTHER_PEER)).toHaveLength(0);
    expect(accountInputOutputs(recovery.outputs, ABSENT_PEER)).toHaveLength(0);
    expect(recovery.newState.accounts.get(OTHER_PEER)?.pendingFrame).toBeUndefined();
    expect(recovery.newState.accounts.get(ABSENT_PEER)).toBeUndefined();
  });

  test('rejects a foreign proposer or a non-canonical counterparty list', async () => {
    const offline = await proposeWhilePeerOffline('propose-accounts-now-invalid', [PEER]);
    const { state, proposer } = offline;

    expect(() => assertProposeAccountsNowMatchesState(state, {
      type: 'proposeAccountsNow',
      data: { version: 1, proposerSignerId: addr20('ff'), counterparties: [PEER] },
    })).toThrow('PROPOSE_ACCOUNTS_NOW_PROPOSER_MISMATCH');

    expect(() => assertProposeAccountsNowMatchesState(state, {
      type: 'proposeAccountsNow',
      data: { version: 1, proposerSignerId: proposer, counterparties: [] },
    })).toThrow(/PROPOSE_ACCOUNTS_NOW_INVALID_PAYLOAD/);

    expect(() => assertProposeAccountsNowMatchesState(state, {
      type: 'proposeAccountsNow',
      data: { version: 1, proposerSignerId: proposer, counterparties: [PEER.toUpperCase()] },
    })).toThrow(/PROPOSE_ACCOUNTS_NOW_COUNTERPARTY_INVALID/);

    expect(() => assertProposeAccountsNowMatchesState(state, {
      type: 'proposeAccountsNow',
      data: { version: 1, proposerSignerId: proposer, counterparties: [OTHER_PEER, PEER] },
    })).toThrow(/PROPOSE_ACCOUNTS_NOW_ORDER_INVALID/);

    expect(() => assertProposeAccountsNowMatchesState(state, {
      type: 'proposeAccountsNow',
      data: { version: 1, proposerSignerId: proposer, counterparties: [PEER, PEER] },
    })).toThrow(/PROPOSE_ACCOUNTS_NOW_ORDER_INVALID/);
  });
});
