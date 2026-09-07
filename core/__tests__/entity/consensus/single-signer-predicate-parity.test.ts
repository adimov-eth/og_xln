import { describe, expect, test } from 'bun:test';

import {
  isSingleSignerBoard,
  isSingleSignerEntity,
} from '../../../entity/consensus/replica-validation';
import type { ConsensusConfig, EntityState } from '../../../entity/types';
import { assertRustEngineSingleSignerBoard } from '../../../orchestrator/process/hub-engine-plan';

const A = `0x${'a1'.repeat(20)}`;
const B = `0x${'b2'.repeat(20)}`;

const board = (shares: Record<string, bigint>, threshold: bigint): ConsensusConfig => ({
  mode: 'proposer-based',
  threshold,
  validators: Object.keys(shares),
  shares,
});

// Same vectors as the Rust `EntityFrameAuthority::is_single_signer`: exactly one
// validator whose own share reaches the threshold.
const vectors: ReadonlyArray<readonly [string, ConsensusConfig, boolean]> = [
  ['{A:1,t:1}', board({ [A]: 1n }, 1n), true],
  ['{A:5,t:5}', board({ [A]: 5n }, 5n), true],
  ['{A:5,t:1}', board({ [A]: 5n }, 1n), true],
  ['{A:1,t:5}', board({ [A]: 1n }, 5n), false],
  ['{A:1,B:1,t:1}', board({ [A]: 1n, [B]: 1n }, 1n), false],
  ['{A:1,B:1,t:2}', board({ [A]: 1n, [B]: 1n }, 2n), false],
];

describe('single-signer predicate parity', () => {
  test('single-signer-predicate-parity', () => {
    for (const [label, config, expected] of vectors) {
      expect([label, isSingleSignerBoard(config)]).toEqual([label, expected]);
      expect([label, isSingleSignerEntity({ config } as EntityState)]).toEqual([label, expected]);
    }
  });

  test('a validator without a share entry never counts as single-signer', () => {
    expect(isSingleSignerBoard({ ...board({ [A]: 1n }, 1n), shares: {} })).toBe(false);
  });

  test('the Rust engine refuses any board that is not single-signer', () => {
    for (const [label, config, expected] of vectors) {
      if (expected) {
        expect(assertRustEngineSingleSignerBoard(config, label)).toBe(config);
        continue;
      }
      expect(() => assertRustEngineSingleSignerBoard(config, label)).toThrow(
        new RegExp(`^RUST_ENGINE_SINGLE_SIGNER_ONLY:${label.replace(/[{}]/g, '\\$&')}:validators=${String(config.validators.length)}:threshold=${String(config.threshold)}$`),
      );
    }
  });
});
