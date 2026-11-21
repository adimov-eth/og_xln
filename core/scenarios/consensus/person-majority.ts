/**
 * Person-majority board: a person and a steward agent share one Entity.
 *
 * Signer and authority: board [person: 2 shares, steward: 1 share], threshold 2. The person
 * alone reaches the threshold; the steward alone cannot.
 * Sequence:
 *   A. The person's own collective tx commits with no steward signature.
 *   B. It still commits while the steward is offline; the steward catches up afterwards.
 *   C. A steward-authored tx becomes a pending proposal and changes nothing.
 *   D. The person's plain `vote` yes (the shape a wallet sends) executes the exact batch.
 *   E. The person's `no` deletes the next steward proposal; nothing moves.
 *   F. Same shares with the steward as frame leader: its own signature (power 1) is below the
 *      threshold, so its frame stays open with only that signature and commits only after the
 *      person precommits.
 * Counterexample: if a proposer that holds the threshold waited for a precommit from a member
 * that cannot add quorum, the person could never act alone and the board would stall at A.
 *
 * Run with: bun core/scenarios/run.ts person-majority
 */

import { asTokenId } from '../../protocol/units';
import { wholeUsdToTokenAmount } from '../../jurisdiction/machine/config/usd-reference-rate';
import type { ConsensusConfig } from '../../entity/types';
import type { RuntimeReplica } from '../../runtime/types';
import type { EntityTx } from '../../types/entity-tx';
import { encodeBoard, hashBoard } from '../../entity/factory';
import {
  bindScenarioJReplica,
  createJReplica,
  createJurisdictionConfig,
  ensureJAdapter,
  getJAdapterMode,
  resolveScenarioBoardSigner,
  resolveScenarioJurisdictionAddress,
} from '../harness/boot';
import {
  assert,
  commitRuntimeInput,
  convergeWithOffline,
  enableStrictScenario,
  ensureSignerKeysFromSeed,
  processJEvents,
  processUntil,
  processWithOffline,
  requireRuntimeSeed,
} from '../harness/helpers';
import { importBoardReplicas, requireReplica } from './multi-sig';

const USDC = asTokenId(1);
const usd = (amount: number) => wholeUsdToTokenAmount(USDC, BigInt(amount));
const mint = (amount: number): EntityTx => ({ type: 'mintReserves', data: { tokenId: USDC, amount: usd(amount) } });

export async function personMajority(env: RuntimeReplica): Promise<void> {
  const restoreStrict = enableStrictScenario(env, 'Person-Majority');
  const prevScenarioMode = env.scenarioMode;
  try {
    env.scenarioMode = true;
    const { clearSignerKeys } = await import('../../account/crypto');
    requireRuntimeSeed(env, 'Person-Majority');
    clearSignerKeys(env);
    ensureSignerKeysFromSeed(env, ['1', '2'], 'Person-Majority');
    const person = resolveScenarioBoardSigner(env, '1');
    const steward = resolveScenarioBoardSigner(env, '2');
    if (env.state.height === 0) env.state.timestamp = 1;

    const jMode = getJAdapterMode();
    const jadapter = await ensureJAdapter(env, jMode);
    bindScenarioJReplica(env, createJReplica(env, 'PersonMajority', jadapter.addresses.depository, { x: 0, y: 600, z: 0 }), jadapter);
    jadapter.startWatching(env);
    const jurisdiction = createJurisdictionConfig(
      'PersonMajority',
      jadapter.addresses.depository,
      jadapter.addresses.entityProvider,
      resolveScenarioJurisdictionAddress(jMode),
      Number(jadapter.chainId),
    );

    const config: ConsensusConfig = {
      mode: 'proposer-based',
      threshold: 2n,
      validators: [person, steward],
      shares: { [person]: 2n, [steward]: 1n },
      jurisdiction,
    };
    // A lazy id is the hash of the full board, so unequal shares are part of the identity.
    const entityId = hashBoard(encodeBoard(config, env)).toLowerCase();
    const both = [person, steward];
    const offline = new Set<string>();
    const reserve = (signerId: string): bigint => requireReplica(env, entityId, signerId).state.reserves.get(USDC) ?? 0n;
    const proposals = (signerId: string) => requireReplica(env, entityId, signerId).state.proposals;
    const assertReserve = (signerIds: string[], expected: number, label: string): void => {
      for (const signerId of signerIds) {
        assert(reserve(signerId) === usd(expected), `${label}: ${signerId.slice(0, 8)} reserve ${reserve(signerId)} === ${usd(expected)}`, env);
      }
    };
    // Reserves can agree by coincidence; the committed frame head cannot.
    const assertSameHead = (id: string, label: string): void => {
      const [a, b] = both.map(signerId => requireReplica(env, id, signerId).state);
      const head = (state: typeof a) => `${state!.height}/${String(state!.prevFrameHash).slice(0, 10)}`;
      assert(head(a) === head(b) && a!.prevFrameHash === b!.prevFrameHash, `${label}: replicas share head ${head(a)} === ${head(b)}`, env);
    };

    await commitRuntimeInput(env, { runtimeTxs: importBoardReplicas(env, entityId, config, 0), entityInputs: [] });
    await processJEvents(env);
    await convergeWithOffline(env, offline, 20, 'person-majority-import');

    // A. The person acts alone.
    await processWithOffline(env, [{ entityId, signerId: person, entityTxs: [mint(100)] }], offline, 'A-person-alone');
    await convergeWithOffline(env, offline, 20, 'A-person-alone');
    assertReserve(both, 100, 'A: the person commits a collective tx alone');
    assertSameHead(entityId, 'A');
    assert(proposals(person).size === 0, 'A: acting alone leaves no proposal behind', env);

    // B. The person acts while the steward is offline; the steward catches up later.
    offline.add(steward);
    await processWithOffline(env, [{ entityId, signerId: person, entityTxs: [mint(50)] }], offline, 'B-steward-offline');
    await convergeWithOffline(env, offline, 20, 'B-steward-offline');
    assertReserve([person], 150, 'B: the person commits with the steward offline');
    const height = (id: string, signerId: string): number => requireReplica(env, id, signerId).state.height;
    // Measured: the steward still received the mint frame (height 4) despite the offline set, but
    // not the J-finality frame (height 5) that the person committed with no steward input.
    assert(height(entityId, steward) < height(entityId, person), `B: the offline steward is behind (${height(entityId, steward)} < ${height(entityId, person)})`, env);
    offline.delete(steward);
    await convergeWithOffline(env, offline, 30, 'B-steward-returns');
    assertReserve(both, 150, 'B: the steward catches up after returning');
    assertSameHead(entityId, 'B');

    // C. A steward-authored tx is only a proposal.
    await processWithOffline(env, [{ entityId, signerId: steward, entityTxs: [mint(10)] }], offline, 'C-steward-proposes');
    await convergeWithOffline(env, offline, 20, 'C-steward-proposes');
    const [first] = [...proposals(person).values()];
    assert(first !== undefined && first.proposer.toLowerCase() === steward.toLowerCase(), 'C: the steward proposal is pending', env);
    assert(proposals(steward).has(first!.id), 'C: both replicas hold the same pending proposal', env);
    assertReserve(both, 150, 'C: a pending steward proposal moves nothing');

    // D. The person's plain vote, exactly as a wallet sends it, executes the stored batch.
    const vote = (proposalId: string, choice: 'yes' | 'no'): EntityTx => ({ type: 'vote', data: { proposalId, voter: person, choice } });
    await processWithOffline(env, [{ entityId, signerId: person, entityTxs: [vote(first!.id, 'yes')] }], offline, 'D-person-yes');
    await convergeWithOffline(env, offline, 20, 'D-person-yes');
    assertReserve(both, 160, 'D: the person\'s yes executes the steward batch');
    assertSameHead(entityId, 'D');
    assert(!proposals(person).has(first!.id) && !proposals(steward).has(first!.id), 'D: an executed proposal is removed', env);

    // E. The person's no deletes the next proposal.
    await processWithOffline(env, [{ entityId, signerId: steward, entityTxs: [mint(10)] }], offline, 'E-steward-proposes');
    await convergeWithOffline(env, offline, 20, 'E-steward-proposes');
    const [second] = [...proposals(person).values()];
    assert(second !== undefined, 'E: the second steward proposal is pending', env);
    await processWithOffline(env, [{ entityId, signerId: person, entityTxs: [vote(second!.id, 'no')] }], offline, 'E-person-no');
    await convergeWithOffline(env, offline, 20, 'E-person-no');
    assert(!proposals(person).has(second!.id) && !proposals(steward).has(second!.id), 'E: the person\'s no deletes the proposal', env);
    assertReserve(both, 160, 'E: a declined proposal moves nothing');
    assertSameHead(entityId, 'E');

    // F. A leader below the threshold cannot finalize its own frame: it must hold an open
    // proposal carrying only its own signature until the person precommits.
    const stewardLed: ConsensusConfig = { ...config, validators: [steward, person] };
    const stewardLedId = hashBoard(encodeBoard(stewardLed, env)).toLowerCase();
    assert(stewardLedId !== entityId, 'F: validator order is part of the board identity', env);
    await commitRuntimeInput(env, { runtimeTxs: importBoardReplicas(env, stewardLedId, stewardLed, 100), entityInputs: [] });
    await processJEvents(env);
    await convergeWithOffline(env, offline, 20, 'F-import');
    assertSameHead(stewardLedId, 'F-import');
    const headBefore = height(stewardLedId, steward);
    const stewardReplica = () => requireReplica(env, stewardLedId, steward);
    await processWithOffline(env, [{ entityId: stewardLedId, signerId: steward, entityTxs: [mint(5)] }], offline, 'F-steward-leads');
    await processUntil(env, () => stewardReplica().proposal !== undefined || height(stewardLedId, steward) > headBefore, 10, 'F-steward-proposal');
    const open = stewardReplica().proposal;
    assert(open !== undefined && height(stewardLedId, steward) === headBefore, `F: steward leader holds an open frame at ${headBefore}`, env);
    assert([...(open!.collectedSigs?.keys() ?? [])].join() === steward.toLowerCase(), 'F: the open frame carries only the steward signature', env);
    await convergeWithOffline(env, offline, 30, 'F-person-precommits');
    assert(height(stewardLedId, steward) > headBefore, 'F: the person precommit commits the steward frame', env);
    assertSameHead(stewardLedId, 'F');
    assert(requireReplica(env, stewardLedId, person).state.proposals.size === 1, 'F: the committed steward command is a pending proposal', env);

    console.log('✅ Person-majority board: person acts alone (also offline steward), steward only proposes, yes executes, no deletes, steward leader waits');
  } finally {
    env.scenarioMode = prevScenarioMode ?? false;
    restoreStrict();
  }
}
