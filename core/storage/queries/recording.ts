import {
  buildRuntimeRecoveryBundle,
  buildRuntimeRecoveryCheckpointBundle,
} from '../recovery/bundle';
import {
  buildRuntimeRecording,
  validateRuntimeRecording,
} from '../recovery/bundle/recording';
import { buildRuntimeRecoveryCheckpointSnapshot } from '../wal/snapshot';
import { computeCanonicalStateHashFromEnv } from '../canonical-hash';
import type { PersistedFrameJournal } from '../types';
import type {
  RuntimeRecording,
  RuntimeRecoveryBundleV1,
  RuntimeRecoveryMetaV1,
  RuntimeRecoverySignerV1,
} from '../recovery/bundle/types';
import type { RuntimeReplica } from '../../runtime/types';
import type { PersistenceQueryDeps } from './deps';
import type { createPersistenceEntityQueries } from './entity';
import type { createPersistenceHistoryQueries } from './history';

type EntityQueries = ReturnType<typeof createPersistenceEntityQueries>;
type HistoryQueries = ReturnType<typeof createPersistenceHistoryQueries>;

export type DetachedRuntimeRecordingAdapter = {
  readonly runtimeId: string;
  readonly baseHeight: number;
  readonly targetHeight: number;
  readAtHeight(height: number): Promise<RuntimeReplica>;
  close(): Promise<void>;
};

const MAX_RUNTIME_RECORDING_JOURNAL_FRAMES = 10_000;

const verifyRecordingFrames = async (
  deps: PersistenceQueryDeps,
  env: RuntimeReplica,
  snapshot: RuntimeRecoveryBundleV1,
  frames: PersistedFrameJournal[],
): Promise<PersistedFrameJournal[]> => {
  if (!env.runtimeSeed || !env.runtimeId) throw new Error('RUNTIME_RECORDING_TRUSTED_IDENTITY_REQUIRED');
  const restored = await deps.restoreEnvFromRecoveryBundles([snapshot], {
    runtimeSeed: env.runtimeSeed, runtimeId: env.runtimeId,
    targetHeight: snapshot.runtimeHeight, readOnly: true,
  });
  const verified: PersistedFrameJournal[] = [];
  const results = await Promise.allSettled([
    deps.replayRecoveryFrameJournals(restored, frames, {
      verify: true,
      onVerifiedFrame(frame) {
        // Sparse WAL omits some full roots. Derive them only after canonical
        // replay verifies the stored commitments and ordered outputs. Never
        // sign a tip root as an earlier frame's root or weaken tail validation.
        verified.push({ ...frame, canonicalStateHash: computeCanonicalStateHashFromEnv(restored) });
      },
    }),
  ]);
  results.push(...await Promise.allSettled([deps.closeRuntimeDb(restored), deps.closeInfraDb(restored)]));
  const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'RUNTIME_RECORDING_REPLAY_AND_CLEANUP_FAILED');
  return verified;
};

const readCheckpointSnapshot = async (
  deps: PersistenceQueryDeps,
  env: RuntimeReplica,
  height: number,
): Promise<Record<string, unknown> | null> => {
  const targetHeight = Number.isFinite(height) ? Math.floor(height) : 0;
  if (targetHeight <= 0) return null;
  return deps.withStorageConsistentRead(env, async () => {
    // Replay borrows the caller's one open LevelDB handle. Open it inside the
    // consistent-read lease before constructing the detached Runtime.
    if (!(await deps.tryOpenRuntimeWalDb(env))) return null;
    const restored = await deps.loadEnvFromStorageByReplay(
      env.runtimeId,
      env.runtimeSeed,
      targetHeight,
      {
        prunedTargetReturnsNull: true,
        borrowRuntimeWalFrom: env,
        readOnly: true,
      },
    );
    if (!restored || restored.env.state.height !== targetHeight) {
      if (restored?.env) await deps.closeRuntimeDb(restored.env);
      return null;
    }
    try {
      return buildRuntimeRecoveryCheckpointSnapshot(restored.env);
    } finally {
      await deps.closeRuntimeDb(restored.env);
    }
  });
};

export const createPersistenceRecordingQueries = (
  deps: PersistenceQueryDeps,
  entityQueries: EntityQueries,
  historyQueries: HistoryQueries,
) => {
  const readCheckpointFrames = async (env: RuntimeReplica, height: number) => {
    if (height === 0) return [];
    const frame = await historyQueries.readPersistedFrameJournal(env, height);
    if (!frame) throw new Error(`RECOVERY_BUNDLE_CHECKPOINT_FRAME_MISSING:${height}`);
    return [frame];
  };

  const readPersistedCheckpointSnapshot = async (
    env: RuntimeReplica,
    height: number,
  ): Promise<Record<string, unknown> | null> => readCheckpointSnapshot(deps, env, height);

  const buildPersistedRuntimeRecording = async (
    env: RuntimeReplica,
    options: {
      signers: RuntimeRecoverySignerV1[];
      meta?: RuntimeRecoveryMetaV1;
      createdAt?: number;
    },
  ): Promise<RuntimeRecording> => {
    const createdAt = Math.max(0, Math.floor(Number(options.createdAt ?? Date.now())));
    const latestHeight = await entityQueries.getPersistedLatestHeight(env);
    if (latestHeight !== env.state.height) {
      throw new Error(
        `RUNTIME_RECORDING_LIVE_HEAD_MISMATCH:persisted=${latestHeight}:env=${env.state.height}`,
      );
    }
    if (latestHeight <= 0) {
      return buildRuntimeRecording([
        buildRuntimeRecoveryBundle(env, { ...options, createdAt, kind: 'snapshot', frames: [] }),
      ], createdAt);
    }

    const minimumBaseHeight = Math.max(1, latestHeight - MAX_RUNTIME_RECORDING_JOURNAL_FRAMES);
    const checkpointHeights = (await entityQueries.listPersistedCheckpointHeights(env))
      .filter(height => height >= minimumBaseHeight && height <= latestHeight)
      .sort((left, right) => left - right);
    let baseHeight = latestHeight;
    let checkpoint: Record<string, unknown> | null = null;
    for (const candidateHeight of checkpointHeights) {
      const candidate = await readPersistedCheckpointSnapshot(env, candidateHeight);
      if (!candidate) continue;
      baseHeight = candidateHeight;
      checkpoint = candidate;
      break;
    }
    if (!checkpoint) {
      return buildRuntimeRecording([
        buildRuntimeRecoveryBundle(env, {
          ...options, createdAt, kind: 'snapshot', frames: await readCheckpointFrames(env, latestHeight),
        }),
      ], createdAt);
    }
    const snapshotBundle = buildRuntimeRecoveryCheckpointBundle(env, {
      ...options,
      checkpoint,
      frames: await readCheckpointFrames(env, baseHeight),
      createdAt,
    });
    if (baseHeight === latestHeight) return buildRuntimeRecording([snapshotBundle], createdAt);

    const expectedFrameCount = latestHeight - baseHeight;
    const frames = await historyQueries.readPersistedFrameJournals(env, {
      fromHeight: baseHeight + 1,
      toHeight: latestHeight,
      limit: expectedFrameCount,
    });
    if (
      frames.length !== expectedFrameCount
      || frames[0]?.height !== baseHeight + 1
      || frames.at(-1)?.height !== latestHeight
    ) {
      throw new Error(
        `RUNTIME_RECORDING_JOURNAL_INCOMPLETE:base=${baseHeight}:target=${latestHeight}:` +
        `expected=${expectedFrameCount}:actual=${frames.length}`,
      );
    }
    const tailBundle = buildRuntimeRecoveryBundle(env, {
      ...options,
      createdAt,
      kind: 'journal_tail',
      baseCheckpoint: {
        height: baseHeight,
        hash: snapshotBundle.checkpointHash!,
      },
      frames: await verifyRecordingFrames(deps, env, snapshotBundle, frames),
    });
    return buildRuntimeRecording([snapshotBundle, tailBundle], createdAt);
  };

  const openDetachedRuntimeRecording = (
    recording: RuntimeRecording,
    runtimeSeed: string,
  ): DetachedRuntimeRecordingAdapter => {
    const validated = validateRuntimeRecording(recording);
    let closed = false;
    let activeProjection: RuntimeReplica | null = null;
    return {
      runtimeId: validated.runtimeId,
      baseHeight: validated.baseHeight,
      targetHeight: validated.targetHeight,
      async readAtHeight(height: number): Promise<RuntimeReplica> {
        if (closed) throw new Error('RUNTIME_RECORDING_ADAPTER_CLOSED');
        if (!Number.isSafeInteger(height) || height < validated.baseHeight || height > validated.targetHeight) {
          throw new Error(
            `RUNTIME_RECORDING_HEIGHT_UNAVAILABLE:height=${height}:` +
            `range=${validated.baseHeight}-${validated.targetHeight}`,
          );
        }
        activeProjection = await deps.restoreEnvFromRecoveryBundles(validated.bundles, {
          runtimeSeed,
          runtimeId: validated.runtimeId,
          targetHeight: height,
          readOnly: true,
        });
        return activeProjection;
      },
      async close(): Promise<void> {
        if (closed) return;
        closed = true;
        activeProjection = null;
      },
    };
  };

  return {
    readPersistedCheckpointSnapshot,
    buildPersistedRuntimeRecording,
    openDetachedRuntimeRecording,
  };
};
