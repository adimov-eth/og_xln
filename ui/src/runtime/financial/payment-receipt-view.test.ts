import { expect, test } from 'bun:test';
import { paymentReceiptFacts } from './payment-receipt-view';

test('same amount for different payments never invents a final recipient from local intent', () => {
  const event = { toEntity: 'Hub', tokenId: 1, amount: '25', description: 'invoice' };
  const first = paymentReceiptFacts('HtlcFinalized', { ...event, hashlock: 'alice-hash' });
  const second = paymentReceiptFacts('HtlcFinalized', { ...event, hashlock: 'bob-hash' });
  expect(first.counterparty).toBe('hub');
  expect(second.counterparty).toBe('hub');
  expect(first.amount).toBe(25n);
});

test('missing receipt fields are unknown, never a fabricated zero USDC receipt', () => {
  expect(paymentReceiptFacts('HtlcReceived', {})).toEqual({ sent: false, counterparty: '', tokenId: null, amount: null });
  expect(paymentReceiptFacts('HtlcReceived', { amount: 'invalid', tokenId: 'invalid' }).amount).toBeNull();
});

test('recipient evidence binds by canonical hashlock and owner, never equal amounts', async () => {
  const { originatedRecipient } = await import('./payment-receipt-view');
  const event = { id: 'a', height: 1, timestamp: 1, kind: 'offchain' as const, type: 'payment' as const, source: 'runtime_log' as const, direction: 'out' as const, title: '', subtitle: '', status: 'initiated', entityId: 'owner', rawType: 'HtlcInitiated', amount: '25', tokenId: 1 };
  const events = [{ ...event, hash: 'alice-hash', counterpartyId: 'alice' }, { ...event, id: 'b', hash: 'bob-hash', counterpartyId: 'bob' }];
  expect(originatedRecipient(events, 'owner', 'alice-hash')).toBe('alice');
  expect(originatedRecipient(events, 'owner', 'bob-hash')).toBe('bob');
  expect(originatedRecipient(events, 'other-owner', 'alice-hash')).toBeNull();
  expect(() => originatedRecipient([...events, { ...events[0]!, counterpartyId: 'mallory' }], 'owner', 'alice-hash')).toThrow('PAYMENT_RECIPIENT_EVIDENCE_CONFLICT');
});
