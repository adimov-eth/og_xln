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
 *   G. The person alone opens an Account with a 1-of-1 counterparty, which extends credit. The
 *      steward's `directPayment` is pending with the exact tx and moves nothing; the person's
 *      yes moves offdelta by exactly the amount on both board replicas and the counterparty,
 *      and reserves stay put.
 *   H. The steward's `extendCredit` is pending at limit 0; the person's yes sets the limit on
 *      all three Account views.
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
import { defaultAccountDisputeConfigForParties } from '../../account/config/dispute-config';
import { deriveDelta } from '../../account/utils';
import { buildEntityTransactionProposalAction, hashEntityProposalAction } from '../../entity/auth/authorization';
import { isLeftEntity } from '../../protocol/identity/entity-id';
import { deriveTransferOffdeltaChange } from '../../protocol/transform/delta-movement';
import { safeStringify } from '../../protocol/serialization';
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
    ensureSignerKeysFromSeed(env, ['1', '2', '3'], 'Person-Majority');
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

    // G. Account setup: the board opens an Account with an ordinary 1-of-1 counterparty.
    const counterpartySigner = resolveScenarioBoardSigner(env, '3');
    const counterpartyConfig: ConsensusConfig = {
      mode: 'proposer-based', threshold: 1n, validators: [counterpartySigner], shares: { [counterpartySigner]: 1n }, jurisdiction,
    };
    const counterparty = hashBoard(encodeBoard(counterpartyConfig, env)).toLowerCase();
    await commitRuntimeInput(env, { runtimeTxs: importBoardReplicas(env, counterparty, counterpartyConfig, 200), entityInputs: [] });
    await processJEvents(env);
    await convergeWithOffline(env, offline, 20, 'G-counterparty-import');
    await processWithOffline(env, [{ entityId, signerId: person, entityTxs: [{ type: 'openAccount', data: {
      targetEntityId: counterparty,
      disputeConfig: defaultAccountDisputeConfigForParties(entityId, false, counterparty, false),
    } }] }], offline, 'G-person-opens');
    await convergeWithOffline(env, offline, 30, 'G-person-opens');
    const account = (id: string, signerId: string, peer: string) => {
      const found = requireReplica(env, id, signerId).state.accounts.get(peer);
      if (!found) throw new Error(`PERSON_MAJORITY_ACCOUNT_MISSING:${id.slice(0, 10)}:${signerId.slice(0, 10)}:${peer.slice(0, 10)}`);
      return found;
    };
    // Every view of the one bilateral Account: both board replicas and the counterparty.
    const views = () => [
      ...both.map(signerId => ({ label: `board:${signerId.slice(0, 8)}`, account: account(entityId, signerId, counterparty), entity: entityId })),
      { label: 'counterparty', account: account(counterparty, counterpartySigner, entityId), entity: counterparty },
    ];
    for (const view of views()) assert(view.account.currentHeight > 0, `G: ${view.label} holds a committed Account (h${view.account.currentHeight})`, env);
    // Each view reads the one Delta from its own side; left is the lower Entity id.
    const derived = (view: ReturnType<typeof views>[number]) => {
      const delta = view.account.state.deltas.get(USDC);
      if (!delta) throw new Error(`PERSON_MAJORITY_DELTA_MISSING:${view.label}`);
      return { offdelta: delta.offdelta, ...deriveDelta(delta, view.account.state.leftEntity.toLowerCase() === view.entity) };
    };
    const boardIsLeft = isLeftEntity(entityId, counterparty);
    // Offdelta can agree by coincidence; the bilateral frame head cannot.
    const assertSameAccountFrame = (label: string): void => {
      const heads = views().map(view => `${view.account.currentHeight}/${view.account.currentFrame.stateHash}`);
      assert(new Set(heads).size === 1, `${label}: all three Account views share frame ${heads[0]!.slice(0, 16)}`, env);
    };
    const counterpartyCredit = usd(100);
    await processWithOffline(env, [{ entityId: counterparty, signerId: counterpartySigner, entityTxs: [
      { type: 'extendCredit', data: { counterpartyEntityId: entityId, tokenId: USDC, amount: counterpartyCredit } },
    ] }], offline, 'G-counterparty-credit');
    await convergeWithOffline(env, offline, 30, 'G-counterparty-credit');
    for (const view of views()) {
      const limit = view.entity === entityId ? derived(view).ownCreditLimit : derived(view).peerCreditLimit;
      assert(limit === counterpartyCredit, `G: ${view.label} sees credit to the board ${limit} === ${counterpartyCredit}`, env);
    }

    // The steward proposes a payment; the stored batch is the exact tx, and nothing moves.
    const assertPendingExact = (tx: EntityTx, label: string): string => {
      const [pending] = [...proposals(person).values()];
      assert(pending !== undefined && pending.proposer.toLowerCase() === steward.toLowerCase(), `${label}: the steward proposal is pending`, env);
      const expected = buildEntityTransactionProposalAction([tx]);
      for (const signerId of both) {
        const stored = proposals(signerId).get(pending!.id);
        assert(stored !== undefined && stored.actionHash === hashEntityProposalAction(expected), `${label}: ${signerId.slice(0, 8)} holds the exact action`, env);
        assert(safeStringify(stored!.action) === safeStringify(expected), `${label}: ${signerId.slice(0, 8)} stores the same ordered txs`, env);
      }
      return pending!.id;
    };
    const assertProposalGone = (id: string, label: string): void =>
      assert(both.every(signerId => !proposals(signerId).has(id)), `${label}: the executed proposal is removed on both replicas`, env);
    const pay: EntityTx = { type: 'directPayment', data: {
      targetEntityId: counterparty, tokenId: USDC, amount: usd(10), route: [entityId, counterparty], deliveryMode: 'direct',
      description: 'steward pays counterparty',
    } };
    const beforePay = views().map(derived);
    await processWithOffline(env, [{ entityId, signerId: steward, entityTxs: [pay] }], offline, 'G-steward-proposes-pay');
    await convergeWithOffline(env, offline, 30, 'G-steward-proposes-pay');
    const payId = assertPendingExact(pay, 'G');
    views().forEach((view, index) =>
      assert(derived(view).offdelta === beforePay[index]!.offdelta, `G: pending payment moves nothing on ${view.label}`, env));
    assertReserve(both, 160, 'G: pending payment leaves reserves');

    await processWithOffline(env, [{ entityId, signerId: person, entityTxs: [vote(payId, 'yes')] }], offline, 'G-person-yes');
    await convergeWithOffline(env, offline, 30, 'G-person-yes');
    const move = deriveTransferOffdeltaChange(boardIsLeft, usd(10));
    views().forEach((view, index) => {
      const after = derived(view);
      assert(after.offdelta === beforePay[index]!.offdelta + move, `G: ${view.label} offdelta ${beforePay[index]!.offdelta} -> ${after.offdelta} (exact ${move})`, env);
      if (view.entity === entityId) {
        assert(after.outCapacity === beforePay[index]!.outCapacity - usd(10), `G: ${view.label} out capacity falls by exactly 10`, env);
      }
    });
    assertProposalGone(payId, 'G');
    assertSameAccountFrame('G');
    assertReserve(both, 160, 'G: a payment debits the Account, not reserves');
    assertSameHead(entityId, 'G');

    // H. The steward proposes credit to the counterparty; the person's yes sets it on both sides.
    const boardCredit = usd(40);
    const credit: EntityTx = { type: 'extendCredit', data: { counterpartyEntityId: counterparty, tokenId: USDC, amount: boardCredit } };
    await processWithOffline(env, [{ entityId, signerId: steward, entityTxs: [credit] }], offline, 'H-steward-proposes-credit');
    await convergeWithOffline(env, offline, 30, 'H-steward-proposes-credit');
    const creditId = assertPendingExact(credit, 'H');
    for (const view of views()) {
      const limit = view.entity === entityId ? derived(view).peerCreditLimit : derived(view).ownCreditLimit;
      assert(limit === 0n, `H: pending credit leaves ${view.label} limit at 0`, env);
    }
    await processWithOffline(env, [{ entityId, signerId: person, entityTxs: [vote(creditId, 'yes')] }], offline, 'H-person-yes');
    await convergeWithOffline(env, offline, 30, 'H-person-yes');
    for (const view of views()) {
      const limit = view.entity === entityId ? derived(view).peerCreditLimit : derived(view).ownCreditLimit;
      assert(limit === boardCredit, `H: ${view.label} sees the board credit ${limit} === ${boardCredit}`, env);
    }
    assertProposalGone(creditId, 'H');
    assertSameAccountFrame('H');
    assertSameHead(entityId, 'H');

    console.log('✅ Person-majority board: person acts alone (also offline steward), steward only proposes, yes executes, no deletes, steward leader waits, steward payment and credit execute on the Account only after the person\'s yes');
  } finally {
    env.scenarioMode = prevScenarioMode ?? false;
    restoreStrict();
  }
}
