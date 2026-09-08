import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  executeCertifiedBoardRotationVector,
  executeIntraFrameBoardOrderingVector,
} from '../../../../rscore/fixtures/certified-board-rotation/cases';
import { safeStringify } from '../../../protocol/serialization';

const fixturePath = join(
  import.meta.dir,
  '../../../../rscore/fixtures/certified-board-rotation/rotation-v1.json',
);

test('certified board rotation vector matches the committed Rust/TypeScript fixture', () => {
  const actual = JSON.parse(safeStringify(executeCertifiedBoardRotationVector()));
  const expected = JSON.parse(readFileSync(fixturePath, 'utf8'));
  expect(actual).toEqual(expected);
});

test('resolveObserverCertifiedBoardRecord answers the new board right after BoardActivated', () => {
  const vector = executeCertifiedBoardRotationVector();
  const [bootstrapped, registered, rotated] = vector.steps;

  expect(bootstrapped?.event).toBe('FoundationBootstrapped');
  expect(bootstrapped?.resolvedPeerBoard).toBeNull();

  expect(registered?.event).toBe('EntityRegistered');
  expect(registered?.resolvedPeerBoard?.entityId).toBe(vector.peerEntityId);
  expect(registered?.resolvedPeerBoard?.boardEpoch).toBe(0);

  // The divergence this vector guards: the observer must resolve the rotated
  // board from committed Entity state in the same process, with no restore.
  // Rust asserts the same three roots and records through
  // `RuntimeEntityState::certified_board_authority` in
  // rscore/crates/runtime/tests/certified_board_rotation_parity.rs.
  expect(rotated?.event).toBe('BoardActivated');
  expect(rotated?.resolvedPeerBoard?.source).toBe('BoardActivated');
  expect(rotated?.resolvedPeerBoard?.boardEpoch).toBe(1);
  expect(rotated?.resolvedPeerBoard?.previousBoardHash).toBe(registered?.resolvedPeerBoard?.boardHash);
  expect(rotated?.resolvedPeerBoard?.boardHash).not.toBe(registered?.resolvedPeerBoard?.boardHash);
  expect(rotated?.boardRegistryRoot).not.toBe(registered?.boardRegistryRoot);
});

// ---------------------------------------------------------------------------
// Intra-frame ordering. TypeScript applies one Entity frame's transactions
// strictly in order (`core/entity/consensus/frame/application.ts`,
// `applyEntityTxsInOrder`), and the certified J range is prepended to the
// proposal (`core/entity/consensus/proposal/selection.ts`). So when a frame
// carries a `j_event` activating a counterparty's board followed by an
// `accountInput` from that counterparty, the row is verified against the NEW
// board.
//
// Rust freezes the same resolution from the state at the START of the frame
// (`rscore/crates/runtime/src/machine/apply.rs`, `resolve_certified_boards`),
// before the kernel applies that frame's J events
// (`rscore/crates/entity-kernel/src/resident.rs`), so the row is verified
// against the RETIRED board. The two Rust tests named below run the same frame
// through the production reducers in each engine's order and record the two
// different rejects.
//
// This test is the TypeScript half of that divergence record. It documents
// current behaviour, not agreed behaviour: when the engines are reconciled,
// one of the two halves must change with the fix.
// ---------------------------------------------------------------------------
test('a same-frame BoardActivated is visible to that frame\'s accountInput (TypeScript order)', () => {
  const ordering = executeIntraFrameBoardOrderingVector();

  // Before the frame, and therefore what Rust resolves for the whole frame:
  // see `rust_resolves_account_rows_before_the_same_frame_s_board_activation`.
  expect(ordering.beforeFrame?.boardHash).toBe(ordering.registeredBoardHash);
  expect(ordering.beforeFrame?.activatedAtJHeight).toBe(2);

  // What TypeScript resolves for the accountInput in the same frame: see
  // `typescript_order_resolves_account_rows_after_the_same_frame_s_board_activation`.
  expect(ordering.accountInputResolved?.boardHash).toBe(ordering.rotatedBoardHash);
  expect(ordering.accountInputResolved?.activatedAtJHeight).toBe(3);
  expect(ordering.accountInputResolved?.logIndex).toBe(0);
});
