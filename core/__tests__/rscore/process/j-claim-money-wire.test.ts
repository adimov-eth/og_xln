import { expect, test } from 'bun:test';
import { encodeInt512 } from '../../../protocol/crypto/abi-money';
import { jEventClaimFromWire, jEventClaimWire } from '../../../rscore/process/j-claim-wire';
import type { AccountTx } from '../../../types/account';

const ZERO = `0x${'00'.repeat(32)}`;
const LEFT = `0x${'11'.repeat(32)}`;
const RIGHT = `0x${'22'.repeat(32)}`;
type Claim = Extract<AccountTx, { type: 'j_event_claim' }>;

const claim = (offdeltas: bigint[]): Claim => ({
  type: 'j_event_claim',
  data: {
    jHeight: 7,
    jBlockHash: ZERO,
    events: [{
      type: 'CounterDisputeRegistered',
      data: {
        sender: LEFT,
        counterentity: RIGHT,
        nonce: 1,
        proposerIsLeft: true,
        proofbodyHash: ZERO,
        counterProofbody: {
          watchSeed: ZERO,
          leftResponseSeconds: 10,
          rightResponseSeconds: 20,
          offdeltas: offdeltas.map(encodeInt512),
          tokenIds: offdeltas.map((_, index) => BigInt(index + 1)),
          transformers: [],
        },
      },
    }],
  },
});

test('Int512 claim proofs retain Rust decimal wire and roundtrip every signed edge', () => {
  const values = [0n, (1n << 256n) - 1n, -(1n << 511n), (1n << 511n) - 1n];
  const input = claim(values);
  const wire = jEventClaimWire(input);
  // Rust checkpoint_wire/j_event encodes logical BigInt as decimal Text, not ABI limbs.
  expect(wire[4]).toEqual([[
    14, [null, null, null, null, null], LEFT, RIGHT, 1, true, Buffer.alloc(32),
    [ZERO, 10, 20, values.map(String), ['1', '2', '3', '4'], []],
  ]]);
  expect(jEventClaimFromWire(wire)).toEqual(input);
});

test('incoming claim rejects an unrepresentable proof before accepting its hash', () => {
  const wire = jEventClaimWire(claim([0n]));
  wire[4] = [[
    14, [null, null, null, null, null], LEFT, RIGHT, 1, true, Buffer.alloc(32),
    [ZERO, 10, 20, [(1n << 511n).toString()], ['1'], []],
  ]];
  expect(() => jEventClaimFromWire(wire)).toThrow('ABI_MONEY_WIDTH:Int512');
});
