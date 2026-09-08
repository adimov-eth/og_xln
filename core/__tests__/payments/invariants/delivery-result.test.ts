import { expect, test } from 'bun:test';

import {
  classifyUndeliveredDelivery,
  deliveryAccepted,
  deliveryDeferred,
  deliveryFailure,
  isDeliveryDelivered,
  isDeliveryRecipientNotReady,
  isDeliveryResult,
  requireDeliveryDelivered,
  requireDeliveryResult,
  shouldRetryDelivery,
} from '../../../protocol/payments/delivery-result';

test('only an exact recipient-readiness deferral can retain an unsent outbox unit', () => {
  for (const code of [
    'ROUTE_DIRECT_SESSION_NOT_READY',
    'ROUTE_DIRECT_RECIPIENT_NOT_READY',
    'P2P_DIRECT_RECIPIENT_NOT_READY',
    // The sender's own signed return route is not published on this socket yet.
    // The transport announced it and handed off no bytes, so the committed
    // output waits for the next frame instead of raising ROUTE_SEND_NOT_DELIVERED.
    'P2P_DIRECT_SOURCE_PROFILE_NOT_READY',
  ]) {
    const waiting = deliveryDeferred({ outcome: 'deferred', code });
    expect(isDeliveryRecipientNotReady(waiting)).toBe(true);
    expect(isDeliveryRecipientNotReady({ ...waiting, outcome: 'failed' })).toBe(false);
    expect(isDeliveryRecipientNotReady({ ...waiting, outcome: 'queued' })).toBe(false);
    expect(isDeliveryRecipientNotReady({ ...waiting, retryable: false })).toBe(false);
    expect(isDeliveryRecipientNotReady({ ...waiting, fatal: true })).toBe(false);
    expect(isDeliveryRecipientNotReady({ ...waiting, terminal: true })).toBe(false);
  }
  expect(isDeliveryRecipientNotReady(deliveryDeferred({
    outcome: 'deferred', code: 'ROUTE_DIRECT_MISS_FAILOVER',
  }))).toBe(false);
  expect(isDeliveryRecipientNotReady(deliveryAccepted())).toBe(false);
});

test('delivery result helpers validate the shared delivery contract', () => {
  const delivered = deliveryAccepted('DELIVERED');
  expect(isDeliveryResult(delivered)).toBe(true);
  expect(isDeliveryDelivered(delivered)).toBe(true);
  expect(shouldRetryDelivery(delivered)).toBe(false);
  expect(requireDeliveryResult(delivered, 'TEST_INVALID')).toBe(delivered);

  expect(isDeliveryResult(true)).toBe(false);
  expect(isDeliveryResult({ outcome: 'delivered', code: 'PARTIAL' })).toBe(false);
  expect(isDeliveryResult({
    outcome: 'accepted',
    code: 'UNKNOWN_OUTCOME',
    retryable: false,
    fatal: false,
    terminal: true,
  })).toBe(false);
  expect(isDeliveryResult({
    outcome: 'failed',
    code: 'MALFORMED_FAILURE',
    retryable: true,
    fatal: false,
    terminal: false,
    failure: {
      category: 'TransientRace',
      code: 'MALFORMED_FAILURE',
      retryable: true,
      fatal: false,
    },
  })).toBe(false);
  expect(isDeliveryResult({
    outcome: 'deferred',
    code: 'TRANSIENT',
    retryable: true,
    fatal: false,
    terminal: false,
    failure: {
      category: 'TransientRace',
      code: 'TRANSIENT',
      message: 'TRANSIENT',
      retryable: true,
      fatal: false,
    },
  })).toBe(false);
  expect(isDeliveryResult({
    outcome: 'failed',
    code: 'TRANSIENT_WRONG_CODE',
    retryable: true,
    fatal: false,
    terminal: false,
    failure: {
      category: 'TransientRace',
      code: 'TRANSIENT',
      message: 'TRANSIENT',
      retryable: true,
      fatal: false,
    },
  })).toBe(false);
  expect(isDeliveryResult({
    outcome: 'failed',
    code: 'TRANSIENT',
    retryable: false,
    fatal: false,
    terminal: false,
    failure: {
      category: 'TransientRace',
      code: 'TRANSIENT',
      message: 'TRANSIENT',
      retryable: true,
      fatal: false,
    },
  })).toBe(false);
  expect(() => requireDeliveryResult(true, 'TEST_INVALID')).toThrow(
    'TEST_INVALID: expected DeliveryResult',
  );
});

test('delivered assertion centralizes hard delivery requirements', () => {
  const delivered = deliveryAccepted('DELIVERED');
  expect(requireDeliveryDelivered(delivered, 'MUST_DELIVER')).toBe(delivered);

  const deferred = deliveryDeferred({ outcome: 'deferred', code: 'DEFERRED' });
  expect(() => requireDeliveryDelivered(
    deferred,
    (delivery) => `MUST_DELIVER: code=${delivery.code}`,
  )).toThrow('MUST_DELIVER: code=DEFERRED');
});

test('undelivered disposition centralizes retry/drop event decisions', () => {
  const deferred = deliveryDeferred({ outcome: 'deferred', code: 'DEFERRED' });
  expect(classifyUndeliveredDelivery(deferred, {
    retry: 'RETRY',
    terminal: 'DROP',
  })).toEqual({
    retry: true,
    level: 'warn',
    code: 'RETRY',
  });

  const terminalFailure = deliveryFailure({
    category: 'TransientRace',
    code: 'EXPIRED',
    terminal: true,
  });
  expect(classifyUndeliveredDelivery(terminalFailure, {
    retry: 'RETRY',
    terminal: 'DROP',
  })).toEqual({
    retry: false,
    level: 'error',
    code: 'DROP',
  });

  expect(() => classifyUndeliveredDelivery(deliveryAccepted('DELIVERED'), {
    retry: 'RETRY',
    terminal: 'DROP',
  })).toThrow('DELIVERY_DISPOSITION_DELIVERED: code=DELIVERED');
});

test('delivery retry helper retains only non-terminal delivery attempts', () => {
  const deferred = deliveryDeferred({ outcome: 'deferred', code: 'DEFERRED' });
  expect(isDeliveryDelivered(deferred)).toBe(false);
  expect(shouldRetryDelivery(deferred)).toBe(true);

  const retryableFailure = deliveryFailure({
    category: 'TransientRace',
    code: 'TRANSIENT',
    terminal: false,
  });
  expect(shouldRetryDelivery(retryableFailure)).toBe(true);

  const expiredFailure = deliveryFailure({
    category: 'TransientRace',
    code: 'EXPIRED',
    terminal: true,
  });
  expect(shouldRetryDelivery(expiredFailure)).toBe(false);
});
