import { expect, test } from 'bun:test';
import type { Proposal } from '../../../core/entity/types';
import type { EntityTx } from '../../../core/types/entity-tx';
import {
  buildProposalVoteTx,
  pendingProposalsForSigner,
  proposalTxFact,
} from '../../../frontend/src/lib/components/Entity/core/proposal-facts';

const person = '0x' + 'aa'.repeat(20);
const steward = '0x' + 'bb'.repeat(20);
const outsider = '0x' + 'cc'.repeat(20);
const bob = '0x' + '0b'.repeat(32);

const proposal = (id: string, proposer: string, action: Proposal['action'], votes: Proposal['votes'] = new Map([[proposer, 'yes']]), created = 1): Proposal => ({
  id, proposer, boardHash: '0xboard', boardEpoch: 0, action, actionHash: '0xaction', votes, created,
});
const batch = (txs: EntityTx[]): Proposal['action'] => ({ type: 'entity_transaction', data: { version: 1, actionHash: '0xaction', txs } });
const pay = (amount: bigint, description?: string): EntityTx => ({
  type: 'directPayment',
  data: { targetEntityId: bob.toUpperCase().replace('0X', '0x'), tokenId: 1, amount, route: [], deliveryMode: 'direct', ...(description ? { description } : {}) },
});

const core = (proposals: Proposal[]) => ({
  proposals: new Map(proposals.map(item => [item.id, item])),
  config: { validators: [person, steward], shares: { [person]: 1n, [steward]: 1n }, threshold: 2n },
});

test('the facts come from the batch, and the proposer text stays apart', () => {
  expect(proposalTxFact(pay(4_250n, 'Dinner at Sora'))).toEqual({
    kind: 'pay', counterpartyEntityId: bob, viaEntityId: bob, tokenId: 1, amount: 4_250n, description: 'Dinner at Sora',
  });
  expect(proposalTxFact({ type: 'extendCredit', data: { counterpartyEntityId: bob, tokenId: 1, amount: 500n } })).toEqual({
    kind: 'credit-limit', counterpartyEntityId: bob, tokenId: 1, amount: 500n,
  });
  expect(proposalTxFact({
    type: 'htlcPayment',
    data: { targetEntityId: bob, tokenId: 1, amount: 100n, maxSenderDebit: 102n, route: [], deliveryMode: 'instant' },
  })).toEqual({ kind: 'pay-locked', counterpartyEntityId: bob, tokenId: 1, amount: 100n, maxSenderDebit: 102n });
  // A type the sheet does not model is named, never interpreted.
  expect(proposalTxFact({ type: 'r2r', data: { toEntityId: bob, tokenId: 1, amount: 1n } } as unknown as EntityTx)).toEqual({ kind: 'other', txType: 'r2r' });
});

test('only proposals another board member authored and this signer has not answered are pending', () => {
  const fromSteward = proposal('p-steward', steward, batch([pay(4_250n)]));
  const fromMe = proposal('p-mine', person, batch([pay(1n)]));
  const answered = proposal('p-answered', outsider, batch([pay(2n)]), new Map([[outsider, 'yes'], [person.toUpperCase().replace('0X', '0x'), 'no']]));
  const note = proposal('p-note', steward, { type: 'collective_message', data: { message: 'Bob says use this new address' } }, undefined, 0);

  const pending = pendingProposalsForSigner(core([fromSteward, fromMe, answered, note]), person.toUpperCase().replace('0X', '0x'));
  expect(pending.map(item => item.id)).toEqual(['p-note', 'p-steward']);
  expect(pending[1]?.facts).toEqual([{ kind: 'pay', counterpartyEntityId: bob, viaEntityId: bob, tokenId: 1, amount: 4_250n, description: null }]);
  expect(pending[1]?.yesShares).toBe(1n);
  expect(pending[1]?.threshold).toBe(2n);
  // The proposer's message is kept as text and produces no facts.
  expect(pending[0]?.message).toBe('Bob says use this new address');
  expect(pending[0]?.facts).toEqual([]);
});

test('a signer who is not on the board has nothing to sign', () => {
  expect(pendingProposalsForSigner(core([proposal('p', steward, batch([pay(1n)]))]), outsider)).toEqual([]);
  expect(pendingProposalsForSigner(null, person)).toEqual([]);
});

test('declining is a recorded no from this signer', () => {
  expect(buildProposalVoteTx('p-steward', person.toUpperCase().replace('0X', '0x'), 'no')).toEqual({
    type: 'vote', data: { proposalId: 'p-steward', voter: person, choice: 'no' },
  });
});
