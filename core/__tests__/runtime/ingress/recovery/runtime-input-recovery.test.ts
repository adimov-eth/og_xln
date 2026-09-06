import { afterEach, describe, expect, test } from 'bun:test';

import { createEmptyEnv } from '../../../../runtime';
import { createFrameExecutionState } from '../../../../runtime/frame/intake/execution-state';
import { restoreUndurableRuntimeInput } from '../../../../runtime/frame/intake/recovery';
import { discardRejectedEntityInput } from '../../../../runtime/frame/intake/discard';
import { RuntimeEntityInputApplyError } from '../../../../runtime/mempool/entity-inputs';
import { MalformedEntityFrameInputError } from '../../../../entity/tx/processing/invariant-errors';
import { registerStructuredLogSink, type StructuredLogEvent } from '../../../../support/logger';
import { rejectMalformedEntityInput } from '../../../../runtime/admit/entity-input-staging';
import { createRuntimeEntityInputBatchContext } from '../../../../runtime/admit/entity-input-contract';
import { createRuntimeRoutingApi } from '../../../../runtime/loop/loop-routing';
import { notifyRuntimeStateChanged } from '../../../../runtime/frame/notifications';
import type { RoutedEntityInput, RuntimeInput } from '../../../../runtime/types';

const address = (byte: string): string => `0x${byte.repeat(20)}`;
const hash = (byte: string): string => `0x${byte.repeat(32)}`;

const entityInput = (byte: string): RoutedEntityInput => ({
  from: address(byte),
  entityId: hash(byte),
  signerId: address(byte),
  entityTxs: [],
});

describe('Runtime undurable input recovery', () => {
  afterEach(() => {
    delete process.env['XLN_REJECT_FAIL_FAST'];
  });
  test('Entity rejection remains observable under the production WARN threshold', () => {
    const env = createEmptyEnv('runtime-entity-reject-warn');
    env.scenarioMode = false;
    const previousLevel = process.env['XLN_LOG_LEVEL'];
    process.env['XLN_LOG_LEVEL'] = 'warn';
    const events: StructuredLogEvent[] = [];
    const unsubscribe = registerStructuredLogSink(event => {
      if (event.scope === 'runtime.entity_inputs') events.push(event);
    });
    const context = createRuntimeEntityInputBatchContext([]);
    const cause = new MalformedEntityFrameInputError('openAccount', 'RUNTIME_REPLICA_NOT_FOUND: rejected');
    try {
      expect(rejectMalformedEntityInput(
        env, new RuntimeEntityInputApplyError(entityInput('66'), false, cause), 3, context,
        { isReplay: false, routingDeps: createRuntimeRoutingApi({ notifyEnvChange: notifyRuntimeStateChanged }).getRuntimeOutputRoutingDeps() },
      )).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        level: 'error', inputIndex: 3, rejectionCode: 'RUNTIME_REPLICA_NOT_FOUND: rejected', cause: cause.message,
      });
      expect(context.inputOutcomes[0]?.outcome).toEqual({ kind: 'rejected', code: 'RUNTIME_REPLICA_NOT_FOUND: rejected' });
      expect(env.state.height).toBe(0);
    } finally {
      unsubscribe();
      if (previousLevel === undefined) delete process.env['XLN_LOG_LEVEL'];
      else process.env['XLN_LOG_LEVEL'] = previousLevel;
    }
  });

  test('pre-drain discard restores each retained ingress item exactly once', async () => {
    const rejected = entityInput('11');
    const retained = entityInput('22');
    const arrivedDuringAttempt = entityInput('33');
    const frameInput: RuntimeInput = {
      runtimeTxs: [],
      entityInputs: [rejected, retained],
      queuedAt: 100,
    };
    const liveEnv = createEmptyEnv('runtime-input-recovery-pre-drain');
    liveEnv.runtimeMempool = {
      runtimeTxs: [],
      entityInputs: [arrivedDuringAttempt],
      queuedAt: 200,
    };
    const frame = createFrameExecutionState();
    frame.transaction = {
      liveEnv,
      frameMempool: frameInput,
      liveFrameEventBaseLength: 0,
      published: false,
    };

    await restoreUndurableRuntimeInput({
      frame,
      liveEnv,
      attemptedEnv: liveEnv,
      runtimeInput: frameInput,
      mempoolQueuedAt: 100,
      frameTimestampBeforeTick: 0,
      discardMalformedRemoteInput: input => ({
        ...input,
        entityInputs: input.entityInputs.filter(candidate => candidate !== rejected),
      }),
      discardedError: error => error,
    }, new Error('malformed remote input'));

    expect(frame.inputDrained).toBe(false);
    expect(liveEnv.runtimeMempool?.entityInputs).toEqual([
      retained,
      arrivedDuringAttempt,
    ]);
    expect(liveEnv.runtimeMempool?.queuedAt).toBe(200);
  });

  test('quiet Runtime logs retain the exact rejected ingress cause outside WAL', () => {
    // Production reject policy: log and drop (default is fail-fast).
    process.env['XLN_REJECT_FAIL_FAST'] = '0';
    const env = createEmptyEnv('runtime-input-discard-quiet');
    env.scenarioMode = false;
    env.quietRuntimeLogs = true;
    const rejected = entityInput('44');
    const retained = entityInput('55');
    const events: StructuredLogEvent[] = [];
    const unsubscribe = registerStructuredLogSink(event => {
      if (event.scope === 'runtime.input_discard') events.push(event);
    });
    const cause = new MalformedEntityFrameInputError('openAccount', 'RUNTIME_REPLICA_NOT_FOUND: diagnostic');
    try {
      const result = discardRejectedEntityInput(
        env,
        { runtimeTxs: [], entityInputs: [rejected, retained] },
        new RuntimeEntityInputApplyError(rejected, false, cause),
      );
      expect(result?.entityInputs).toEqual([retained]);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        level: 'error',
        message: 'entity_input.discarded',
        entityId: rejected.entityId,
        signerId: rejected.signerId,
        sourceRuntimeId: rejected.from,
        discardedInputs: 1,
        cause: cause.message,
      });
      expect(env.state.height).toBe(0);
    } finally {
      unsubscribe();
    }
  });
});
