import { requireBoundaryRecord } from '../../../protocol/boundary-validation';
import { decodeRoutedEntityInput } from '../../../runtime/delivery/topology/routing-validation';
import type { RuntimeReplica } from '../../../runtime/types';
import { prepareRuntimeOutputRows } from '../../wal/outbox-payload';
import type { PersistedFrameJournal } from '../../types';
import { verifyPersistedFrameState } from '../verify';
import type { RuntimeRecoveryBundleV1 } from './types';

type SnapshotFrameBundle = Pick<RuntimeRecoveryBundleV1,
  'runtimeId' | 'runtimeHeight' | 'runtimeTimestamp' | 'checkpoint' | 'frames'>;

/** The signed snapshot carries its existing tip journal as evidence, never as replay input. */
export const requireRecoveryCheckpointFrame = (bundle: SnapshotFrameBundle): PersistedFrameJournal | null => {
  const checkpoint = requireBoundaryRecord(bundle.checkpoint, 'RECOVERY_BUNDLE_CHECKPOINT_REQUIRED');
  if (checkpoint['height'] !== bundle.runtimeHeight || checkpoint['timestamp'] !== bundle.runtimeTimestamp) {
    throw new Error('RECOVERY_BUNDLE_CHECKPOINT_COORDINATES_MISMATCH');
  }
  const frames = bundle.frames ?? [];
  if (!Array.isArray(frames)) throw new Error('RECOVERY_BUNDLE_CHECKPOINT_FRAME_INVALID');
  if (bundle.runtimeHeight === 0 && frames.length === 0) return null;
  if (frames.length !== 1) throw new Error('RECOVERY_BUNDLE_CHECKPOINT_FRAME_REQUIRED');
  const frame = frames[0];
  if (frame === undefined) throw new Error('RECOVERY_BUNDLE_CHECKPOINT_FRAME_INVALID');
  requireBoundaryRecord(frame, 'RECOVERY_BUNDLE_CHECKPOINT_FRAME_INVALID');
  if (frame.height !== bundle.runtimeHeight || frame.timestamp !== bundle.runtimeTimestamp) {
    throw new Error('RECOVERY_BUNDLE_CHECKPOINT_FRAME_COORDINATES_MISMATCH');
  }
  if (frame.runtimeMachine && frame.runtimeMachine['runtimeId'] !== bundle.runtimeId) {
    throw new Error('RECOVERY_BUNDLE_CHECKPOINT_FRAME_RUNTIME_MISMATCH');
  }
  const outputs = frame.runtimeOutputs ?? [];
  if (!Array.isArray(outputs)) throw new Error('RECOVERY_BUNDLE_CHECKPOINT_OUTBOX_INVALID');
  outputs.forEach(decodeRoutedEntityInput);
  const { commitment } = prepareRuntimeOutputRows(frame.height, outputs);
  if (commitment.count !== frame.runtimeOutputCount || commitment.digest !== frame.runtimeOutputsDigest) {
    throw new Error('RECOVERY_BUNDLE_CHECKPOINT_OUTBOX_DIGEST_MISMATCH');
  }
  return frame;
};

export const restoreRecoveryCheckpointOutbox = (
  env: RuntimeReplica,
  bundle: RuntimeRecoveryBundleV1,
): void => {
  const frame = requireRecoveryCheckpointFrame(bundle);
  if (!frame) return;
  // The owner's signature binds snapshot and tip together. Recompute the tip's
  // post-state commitment before admitting its ordered output bytes: a signed
  // snapshot from another same-height state must not authorize their delivery.
  if (!verifyPersistedFrameState(env, frame).ok) {
    throw new Error('RECOVERY_BUNDLE_CHECKPOINT_FRAME_STATE_MISMATCH');
  }
  env.pendingNetworkOutputs = structuredClone(frame.runtimeOutputs ?? []);
};
