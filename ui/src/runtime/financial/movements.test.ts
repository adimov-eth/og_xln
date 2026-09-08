import { expect, test } from 'bun:test';
import type { RuntimeActivityEvent } from '@xln/core/api/public/runtime-module';
import { walletMovements } from './movement-projection';

const swap = (type: 'swap' | 'cross_swap'): RuntimeActivityEvent => ({
  id: 'order-event', height: 7, timestamp: 1000, kind: 'offchain', type,
  source: 'runtime_input', direction: 'out', title: 'Swap placed', subtitle: '',
  status: 'placed', entityId: 'self', counterpartyId: 'remote-entity',
  tokenId: 1, amount: '1000000', quoteTokenId: 2, quoteAmount: '2000000',
  orderId: 'order-7', rawType: 'placeSwapOffer',
});

test('swap history retains both quoted assets and the order identity', () => {
  const result = walletMovements([swap('swap')], 'self', ['remote-entity']);
  expect(result).toHaveLength(1);
  expect(result[0]!.amount).toBe(1000000n);
  expect(result[0]!.quoteAmount).toBe(2000000n);
  expect(result[0]!.quoteTokenId).toBe(2);
  expect(result[0]!.detail).toBe('Order order-7');
});

test('cross-jurisdiction history retains the remote recipient without a bilateral account', () => {
  expect(walletMovements([swap('cross_swap')], 'self', ['hub'])).toHaveLength(1);
  expect(walletMovements([swap('cross_swap')], 'other', ['hub'])).toHaveLength(0);
});

test('equal direct payments remain separate across counterparties and nearby frames', () => {
  const payment = (id: string, counterpartyId: string, height: number): RuntimeActivityEvent => ({
    ...swap('swap'), id, counterpartyId, height, type: 'payment', rawType: 'direct_payment', status: 'committed',
  });
  const records = [payment('first', 'alice', 7), payment('second', 'alice', 8), payment('third', 'bob', 8)];
  expect(walletMovements(records, 'self', ['alice', 'bob'])).toHaveLength(3);
});

test('on-chain observations remain visible without a bilateral account', () => {
  const event: RuntimeActivityEvent = { ...swap('swap'), kind: 'onchain', type: 'j_event', source: 'j_input', rawType: 'ReserveUpdated', title: 'Reserve updated' };
  const rows = walletMovements([event], 'self', []);
  expect(rows).toHaveLength(1);
  expect(rows[0]!.kind).toBe('onchain');
});

test('repeated settings do not claim an unproven bilateral update', () => {
  const event: RuntimeActivityEvent = { ...swap('swap'), type: 'account', rawType: 'set_credit_limit' };
  const rows = walletMovements([event, { ...event, id: 'next', height: 8 }], 'self', ['remote-entity']);
  expect(rows).toHaveLength(2);
  expect(rows.every(row => row.detail !== 'both ways')).toBe(true);
});

test('equal HTLC sends keep separate identities and only their observed accounts', () => {
  const payment = (hash: string): RuntimeActivityEvent => ({ ...swap('swap'), id: hash, hash, type: 'htlc', rawType: 'HtlcFinalized', source: 'runtime_log', status: 'finalized', counterpartyId: 'hub' });
  const rows = walletMovements([payment('hash-alice'), payment('hash-bob')], 'self', ['hub']);
  expect(rows).toHaveLength(2);
  expect(rows.map(row => row.counterpartyId)).toEqual(['hub', 'hub']);
  expect(rows.every(row => row.viaId === null)).toBe(true);
});

test('chain liveness and account resend markers are not money movements', () => {
  const events: RuntimeActivityEvent[] = [
    { ...swap('swap'), type: 'j_event', kind: 'onchain', source: 'j_input', rawType: 'liveness' },
    { ...swap('swap'), type: 'account', rawType: 'proposeAccountsNow' },
  ];
  expect(walletMovements(events, 'self', [])).toEqual([]);
});
