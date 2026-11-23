import { describe, expect, test } from 'bun:test';

import { signedCreditLimitFor } from '../../../frontend/src/lib/components/Entity/account/account-credit-view';

// Direction is fixed by core/account/utils.ts deriveDelta: ownCreditLimit = granted to us,
// peerCreditLimit = granted by us. The form showed them swapped.
describe('signed credit limit shown by the credit form', () => {
  test('extend reads the limit we grant, request reads the limit granted to us', () => {
    const signed = { ownCreditLimit: 7n, peerCreditLimit: 10_000n };
    expect(signedCreditLimitFor('extend', signed)).toBe(10_000n);
    expect(signedCreditLimitFor('request', signed)).toBe(7n);
  });
});
