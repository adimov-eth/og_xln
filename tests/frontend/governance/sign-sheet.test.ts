import { expect, test } from 'bun:test';
import type { EntityTx } from '../../../core/types/entity-tx';
import {
  batchCommitted,
  buildSignSheet,
  captureSignBaseline,
  formatExpiry,
  formatSignSheetAmount,
  type SignSheetSource,
} from '../../../frontend/src/lib/components/Entity/core/sign-sheet';

const self = '0x' + 'aa'.repeat(32);
const bob = '0x' + '0b'.repeat(32);
const stranger = '0x' + '7a'.repeat(32);
const USDC = { symbol: 'USDC', decimals: 6 };

const pay = (target: string, amount: bigint): EntityTx => ({
  type: 'directPayment',
  data: { targetEntityId: target, tokenId: 1, amount, route: [self, target], deliveryMode: 'direct' },
});
const credit = (amount: bigint): EntityTx => ({ type: 'extendCredit', data: { counterpartyEntityId: bob, tokenId: 1, amount } });

const source = (overrides: Partial<SignSheetSource> = {}): SignSheetSource => ({
  token: tokenId => (tokenId === 1 ? USDC : null),
  hasAccount: entityId => entityId === bob,
  extendedCreditLimit: entityId => (entityId === bob ? 100_000_000n : null),
  sendCapacity: entityId => (entityId === bob ? 50_000_000n : null),
  offdelta: entityId => (entityId === bob ? 0n : null),
  ...overrides,
});
const sheetFor = (txs: EntityTx[], note: string | null = null) =>
  buildSignSheet({ id: 'n1', requester: 'Ledger', origin: 'Signed by your pinned steward · Expires in 2 h', txs, note, terms: [] }, source());

test('amounts are exact, always with cents, and an unknown token stays in raw units', () => {
  expect(formatSignSheetAmount(1_200_000_000n, 1, USDC)).toBe('1,200.00 USDC');
  expect(formatSignSheetAmount(42_505_000n, 1, USDC)).toBe('42.505 USDC');
  expect(formatSignSheetAmount(1n, 1, USDC)).toBe('0.000001 USDC');
  expect(formatSignSheetAmount(1234n, 9, null)).toBe('1,234 units of token 9');
});

test('the expiry comes from the signed request', () => {
  expect(formatExpiry(1_000 + 9 * 60_000, 1_000)).toBe('Expires in 9 min');
  expect(formatExpiry(1_000 + 2 * 3_600_000, 1_000)).toBe('Expires in 2 h');
  expect(formatExpiry(1_000, 2_000)).toBe('Expired');
});

test('a payment through an account you have is one press, with the exact room before and after', () => {
  const sheet = sheetFor([pay(bob, 42_500_000n)], 'Dinner at Sora');
  expect(sheet.facts).toEqual([{ verb: 'Pay', amount: '42.50 USDC', preposition: 'to', party: { entityId: bob, fingerprint: '0x0b0b…0b0b', hasAccount: true } }]);
  expect(sheet.hold.required).toBe(false);
  expect(sheet.primaryLabel).toBe('Pay 42.50 USDC');
  expect(sheet.note).toBe('Dinner at Sora');
  expect(sheet.rows).toEqual([{ label: 'You can send to 0x0b0b…0b0b', was: '50.00 USDC', now: '7.50 USDC', tone: 'plain' }]);
  expect(sheet.blocked).toBeNull();
});

test('a payment the account cannot carry says that signing moves nothing', () => {
  const sheet = sheetFor([pay(bob, 60_000_000n)]);
  expect(sheet.rows).toEqual([{ label: 'You can send to 0x0b0b…0b0b', was: '50.00 USDC', now: 'not enough', tone: 'plain' }]);
  expect(sheet.notices).toEqual([]);
  expect(sheet.blocked).toBe('This account cannot carry this payment now, so there is nothing to sign yet.');
});

test('a payment to a key with no account needs a hold and says why', () => {
  const sheet = sheetFor([pay(stranger, 1_200_000_000n)]);
  expect(sheet.hold).toEqual({ required: true, reasons: ['no-account'], hint: 'You have no account with this key: hold for one second.' });
  expect(sheet.primaryLabel).toBe('Hold to pay 1,200.00 USDC');
  expect(sheet.armedLabel).toBe('Press again to pay 1,200.00 USDC');
  expect(sheet.notices).toEqual(['You have no account with this key.']);
  expect(sheet.blocked).toBe('There is no signed account to send this through, so there is nothing to sign yet.');
});

test('raising a credit limit shows the signed limit before and after, and what could be lost', () => {
  const sheet = sheetFor([credit(500_000_000n)]);
  expect(sheet.rows).toEqual([{ label: '0x0b0b…0b0b can owe you', was: '100.00 USDC', now: '500.00 USDC', tone: 'risk' }]);
  expect(sheet.consequence).toBe('If 0x0b0b…0b0b never pays, you could lose up to 500.00 USDC.');
  expect(sheet.primaryLabel).toBe('Hold to raise to 500.00 USDC');
});

test('lowering a credit limit lowers exposure and takes one press', () => {
  const sheet = sheetFor([credit(50_000_000n)]);
  expect(sheet.hold.required).toBe(false);
  expect(sheet.primaryLabel).toBe('Lower to 50.00 USDC');
});

test('a batch is never reduced to its first change', () => {
  const sheet = sheetFor([pay(bob, 1_000_000n), credit(500_000_000n)]);
  expect(sheet.facts.map(fact => fact.verb)).toEqual(['Pay', 'Let 0x0b0b…0b0b owe you up to']);
  expect(sheet.hold.reasons).toEqual(['several', 'raises-exposure']);
  expect(sheet.primaryLabel).toBe('Hold to sign 2 changes');
  expect(sheet.terms.filter(([key]) => key.startsWith('tx '))).toHaveLength(2);
});

test('the outcome is read from committed state, not from having sent', () => {
  const txs = [pay(bob, 42_500_000n), credit(500_000_000n)];
  const baseline = captureSignBaseline(txs, source());
  expect(batchCommitted(txs, baseline, source())).toBe(false);
  expect(batchCommitted(txs, baseline, source({ offdelta: () => -42_500_000n, extendedCreditLimit: () => 500_000_000n }))).toBe(true);
  // A partial commit is not "done".
  expect(batchCommitted(txs, baseline, source({ offdelta: () => -42_500_000n }))).toBe(false);
});
