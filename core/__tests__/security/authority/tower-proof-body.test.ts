import { describe, expect, test } from 'bun:test';

import { decodeTowerProofBody } from '../../../storage/recovery/tower-proof-body';

const validProofBody = {
  watchSeed: `0x${'12'.repeat(32)}`,
  leftResponseSeconds: 10n,
  rightResponseSeconds: 10n,
  offdeltas: [{ high: -1n, low: (1n << 256n) - 7n }],
  tokenIds: [1n],
  transformers: [
    {
      transformerAddress: `0x${'34'.repeat(20)}`,
      encodedBatch: '0x1234',
      allowances: [
        {
          deltaIndex: 0n,
          rightAllowance: 5n,
          leftAllowance: 0n,
        },
      ],
    },
  ],
};

describe('watchtower proof-body boundary', () => {
  test('constructs an exact independent proof body', () => {
    const decoded = decodeTowerProofBody(validProofBody);

    expect(decoded).toEqual({ ...validProofBody, offdeltas: [-7n] });
    expect(decoded).not.toBe(validProofBody);
    expect(decoded.transformers[0]).not.toBe(validProofBody.transformers[0]);
    expect(decoded.transformers[0]?.allowances[0]).not.toBe(
      validProofBody.transformers[0]?.allowances[0],
    );
  });

  test('rejects malformed persisted evidence before tower publication', () => {
    expect(() =>
      decodeTowerProofBody({
        ...validProofBody,
        offdeltas: ['-7'],
      }),
    ).toThrow('ABI_MONEY_TUPLE:Int512');
  });

  test('converts signed upper limbs without narrowing or accepting retired scalars', () => {
    expect(decodeTowerProofBody({
      ...validProofBody,
      offdeltas: [{ high: -(1n << 44n), low: 7n }],
    }).offdeltas).toEqual([-(1n << 300n) + 7n]);
    expect(() => decodeTowerProofBody({ ...validProofBody, offdeltas: [-7n] }))
      .toThrow('ABI_MONEY_TUPLE:Int512');
    expect(() => decodeTowerProofBody({ ...validProofBody, offdeltas: [{ high: 0n, low: -1n }] }))
      .toThrow('ABI_MONEY_WIDTH:Int512.low');
  });
});
