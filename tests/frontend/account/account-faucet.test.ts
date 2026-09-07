import { describe, expect, test } from 'bun:test';

import {
  OFFCHAIN_FAUCET_REQUEST_TIMEOUT_MS,
  faucetPendingKey,
  decodeFaucetApiResult,
} from '../../../frontend/src/lib/components/Entity/account/account-faucet';

// Exact successful response captured from the isolated Move E2E, block 42.
const confirmedReserveResponse = {
  amount: '100',
  events: [{
    args: { entity: '0x9d9b994688372719a33eac156e9c6d63e50611a5a13330081c983cde0e7950de', newBalance: '100000000', tokenId: '1' },
    blockHash: '0x92b58f817a71fcdca3e167fed6896189eb8a26611d0db635ccab626cc6059316',
    blockNumber: 42, name: 'ReserveUpdated', observedAt: 1788749020856,
    transactionHash: '0x5b58fa4016af0dd4c3ac7b0d564008d0363a304010bb2a85634ca8ac347a2dbc',
  }],
  from: '0xbf2891acf55a36...', requestId: '5d1ed040-235f-4f17-9904-26af991ad807',
  success: true, to: '0x9d9b9946883727...', tokenId: 1, type: 'reserve',
};

describe('account faucet UI state', () => {
  test('accepts the committed reserve receipt without turning success into a faucet error', () => {
    expect(decodeFaucetApiResult(confirmedReserveResponse)).toBe(confirmedReserveResponse);
    expect(confirmedReserveResponse.events[0]!.args.newBalance).toBe('100000000');
  });

  test('keeps the event contract strict for observation timestamps and unknown keys', () => {
    const event = confirmedReserveResponse.events[0]!;
    for (const observedAt of [undefined, '1788749020856', -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => decodeFaucetApiResult({ ...confirmedReserveResponse, events: [{ ...event, observedAt }] }))
        .toThrow('FAUCET_RESPONSE_INVALID');
    }
    expect(() => decodeFaucetApiResult({ ...confirmedReserveResponse, events: [{ ...event, unexpected: true }] }))
      .toThrow('FAUCET_RESPONSE_INVALID');
  });
  test('uses one canonical key only while the POST is in flight', () => {
    expect(faucetPendingKey('0xABCD', 1)).toBe('0xabcd:1');
  });

  test('faucet request timeout is short because server only queues input', () => {
    expect(OFFCHAIN_FAUCET_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(3_000);
  });

});
