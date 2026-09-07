import { describe, expect, test } from 'bun:test';
import { ethers } from 'ethers';
import { DepositoryBounds__factory } from '../../../../jurisdictions/typechain-types/factories/DepositoryBounds__factory';
import { UINT256_MAX } from '../../../protocol/boundary/integer-ranges';
import { createEmptyBatch, encodeJBatch, decodeJBatch } from '../../../jurisdiction/machine/batch';
import { validateJBatch } from '../../../jurisdiction/machine/batch-validation';
import { createSettlementHashWithNonce } from '../../../protocol/dispute/proof-builder';
import { encodeCooperativeUpdateHankoPayload } from '../../../hanko/onchain-domain';

const LEFT = `0x${'11'.repeat(32)}`;
const RIGHT = `0x${'22'.repeat(32)}`;
const DOMAIN = { chainId: 31337, depositoryAddress: '0x1111111111111111111111111111111111111111' };
const CODER = ethers.AbiCoder.defaultAbiCoder();
const batchParam = DepositoryBounds__factory.createInterface().getFunction('assertBatch')?.inputs[0];
if (!batchParam) throw new Error('CONTRACT_BATCH_ABI_MISSING');
const diffsParam = batchParam.components
  ?.find(field => field.name === 'settlements')
  ?.arrayChildren?.components?.find(field => field.name === 'diffs');
if (!diffsParam) throw new Error('CONTRACT_SETTLEMENT_DIFF_ABI_MISSING');

const settlement = {
  leftEntity: LEFT,
  rightEntity: RIGHT,
  diffs: [{ tokenId: 1, leftDiff: -UINT256_MAX, rightDiff: UINT256_MAX, collateralDiff: 0n, ondeltaDiff: -1n }],
  forgiveDebtsInTokenIds: [],
  sig: '0x',
  nonce: 1,
};
// Fixed sign/magnitude vector, independent of the production limb converter.
const contractDiffs = [
  {
    tokenId: 1,
    leftDiff: { negative: true, magnitude: UINT256_MAX },
    rightDiff: { negative: false, magnitude: UINT256_MAX },
    collateralDiff: { negative: false, magnitude: 0n },
    ondeltaDiff: { negative: true, magnitude: 1n },
  },
];

describe('uint256 custody, SignedAmount movements and Int512 proof ABI', () => {
  test('full uint256 custody roundtrips and only unrepresentable amounts reject', () => {
    const batch = createEmptyBatch();
    batch.reserveToReserve.push({ receivingEntity: RIGHT, tokenId: 1, amount: UINT256_MAX });
    expect(() => validateJBatch(batch, 'T')).not.toThrow();
    expect(decodeJBatch(encodeJBatch(batch))).toEqual(batch);
    const over = { ...batch, reserveToReserve: [{ receivingEntity: RIGHT, tokenId: 1, amount: UINT256_MAX + 1n }] };
    expect(() => validateJBatch(over, 'T')).toThrow('ABI_MONEY_WIDTH:T_R2R_0_AMOUNT');
  });

  test('production batch encoder matches the contract tuple and restores scalar runtime diffs', () => {
    const batch = { ...createEmptyBatch(), settlements: [settlement] };
    const expected = CODER.encode([batchParam], [{ ...batch, settlements: [{ ...settlement, diffs: contractDiffs }] }]);
    expect(encodeJBatch(batch)).toBe(expected);
    expect(decodeJBatch(expected)).toEqual(batch);
  });

  test('cooperative Hanko binds the exact same wide movement bytes, nonce and deployment domain', () => {
    const accountKey = ethers.solidityPacked(['bytes32', 'bytes32'], [LEFT, RIGHT]);
    const expected = CODER.encode(
      ['uint256', 'uint256', 'address', 'bytes', 'uint256', diffsParam, 'uint256[]'],
      [0, DOMAIN.chainId, DOMAIN.depositoryAddress, accountKey, 1, contractDiffs, []],
    );
    expect(encodeCooperativeUpdateHankoPayload(DOMAIN, accountKey, 1, settlement.diffs, [])).toBe(expected);
    const hash = createSettlementHashWithNonce(
      { leftEntity: LEFT, rightEntity: RIGHT },
      settlement.diffs,
      [],
      DOMAIN,
      1,
    );
    expect(hash).toBe(ethers.keccak256(expected));
    expect(
      createSettlementHashWithNonce({ leftEntity: LEFT, rightEntity: RIGHT }, settlement.diffs, [], DOMAIN, 2),
    ).not.toBe(hash);
    expect(
      createSettlementHashWithNonce(
        { leftEntity: LEFT, rightEntity: RIGHT },
        settlement.diffs,
        [],
        { ...DOMAIN, chainId: 31338 },
        1,
      ),
    ).not.toBe(hash);
  });

  test('negative zero from untrusted contract calldata is rejected before runtime admission', () => {
    const first = contractDiffs[0];
    if (!first) throw new Error('FIXED_SETTLEMENT_VECTOR_MISSING');
    const encoded = CODER.encode(
      [batchParam],
      [
        {
          ...createEmptyBatch(),
          settlements: [{ ...settlement, diffs: [{ ...first, leftDiff: { negative: true, magnitude: 0n } }] }],
        },
      ],
    );
    expect(() => decodeJBatch(encoded)).toThrow('ABI_MONEY_NEGATIVE_ZERO');
  });

  test('signed movement above uint256 magnitude cannot enter a batch or Hanko', () => {
    const diffs = [{ tokenId: 1, leftDiff: 0n, rightDiff: 0n, collateralDiff: 0n, ondeltaDiff: -(UINT256_MAX + 1n) }];
    const batch = { ...createEmptyBatch(), settlements: [{ ...settlement, diffs }] };
    expect(() => validateJBatch(batch, 'T')).toThrow('ABI_MONEY_WIDTH:T_SETTLEMENTS_0_DIFFS_0_ONDELTADIFF');
    expect(() => createSettlementHashWithNonce({ leftEntity: LEFT, rightEntity: RIGHT }, diffs, [], DOMAIN, 1)).toThrow(
      'ABI_MONEY_WIDTH:SETTLEMENT_ONDELTA_DIFF:token=1',
    );
  });
});
