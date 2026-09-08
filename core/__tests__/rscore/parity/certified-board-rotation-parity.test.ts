import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { executeCertifiedBoardRotationVector } from '../../../../rscore/fixtures/certified-board-rotation/cases';
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
