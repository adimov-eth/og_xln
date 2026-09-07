import { expect, test } from 'bun:test';
import {
  closeInfraDb, closeRuntimeDb, createEmptyEnv, readPersistedFrameJournal,
  restoreEnvFromRecoveryBundles, saveEnvToDB,
} from '../../../../runtime';
import { buildRuntimeRecoveryBundle, validateRuntimeRecoveryBundle } from '../../../../storage/recovery/bundle';
import { computeCanonicalStateHashFromEnv } from '../../../../storage/canonical-hash';
import type { RoutedEntityInput } from '../../../../runtime/types';

test('snapshot-only recovery restores the committed ordered outbox without replaying its tip', async () => {
  const seed = `snapshot-only-outbox-${Date.now()}`;
  const env = createEmptyEnv(seed);
  env.quietRuntimeLogs = true;
  env.state.height = 1;
  env.state.timestamp = 100;
  const outputs: RoutedEntityInput[] = ['31', '32'].map(byte => ({
    entityId: `0x${byte.repeat(32)}`,
    signerId: env.runtimeId!,
    runtimeId: `0x${byte.repeat(20)}`,
    entityTxs: [],
    sourceRuntimeFrame: { height: 1, timestamp: 100 },
  }));
  env.pendingNetworkOutputs = outputs;
  try {
    // Enter the actual WAL boundary with two valid, undelivered output rows.
    // The exported frame is read from LevelDB; no synthetic journal is supplied.
    await saveEnvToDB(env, { runtimeTxs: [], entityInputs: [] }, outputs, new Map());
    const frame = await readPersistedFrameJournal(env, 1);
    if (!frame) throw new Error('TEST_COMMITTED_TIP_MISSING');
    const options = { signers: [{ index: 1, address: env.runtimeId!, name: 'Owner' }], frames: [frame] };
    const bundle = buildRuntimeRecoveryBundle(env, options);
    const restored = await restoreEnvFromRecoveryBundles([bundle], { runtimeSeed: seed, readOnly: true });
    expect(restored.state.height).toBe(1);
    expect(restored.state.timestamp).toBe(100);
    expect(computeCanonicalStateHashFromEnv(restored)).toBe(computeCanonicalStateHashFromEnv(env));
    expect(restored.pendingNetworkOutputs).toEqual(outputs);
    expect(bundle.checkpoint!['pendingNetworkOutputs']).toBeUndefined();
    expect(bundle.frames).toHaveLength(1);
    expect(restored.pendingNetworkOutputs).not.toBe(bundle.frames![0]!.runtimeOutputs);

    const missing = { ...bundle, frames: [] };
    expect(() => validateRuntimeRecoveryBundle(missing)).toThrow('RECOVERY_BUNDLE_CHECKPOINT_FRAME_REQUIRED');
    expect(() => buildRuntimeRecoveryBundle(env, { ...options, frames: [{ ...frame, timestamp: 101 }] }))
      .toThrow('RECOVERY_BUNDLE_CHECKPOINT_FRAME_COORDINATES_MISMATCH');
    expect(() => buildRuntimeRecoveryBundle(env, {
      ...options, frames: [{ ...frame, runtimeOutputs: [...outputs].reverse() }],
    })).toThrow('RECOVERY_BUNDLE_CHECKPOINT_OUTBOX_DIGEST_MISMATCH');

    const wrongState = buildRuntimeRecoveryBundle(env, {
      ...options, frames: [{ ...frame, postStateHash: `0x${'ab'.repeat(32)}` }],
    });
    await expect(restoreEnvFromRecoveryBundles([wrongState], { runtimeSeed: seed, readOnly: true }))
      .rejects.toThrow('RECOVERY_BUNDLE_CHECKPOINT_FRAME_STATE_MISMATCH');
  } finally {
    await closeRuntimeDb(env);
    await closeInfraDb(env);
  }
});
