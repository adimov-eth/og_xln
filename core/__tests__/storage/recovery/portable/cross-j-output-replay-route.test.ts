import { expect, test } from 'bun:test';
import { createEmptyEnv } from '../../../../runtime';
import { createRuntimeRoutingApi } from '../../../../runtime/loop/loop-routing';
import { notifyRuntimeStateChanged } from '../../../../runtime/frame/notifications';
import { planEntityOutputs } from '../../../../runtime/delivery/plan';
import {
  clearReplayOutputRuntimeRoutes,
  installReplayOutputRuntimeRoutes,
} from '../../../../runtime/delivery/replay-output-route';
import type { RoutedEntityInput } from '../../../../runtime/types';

test('replay preserves the exact WAL cross-j target without volatile profile authority', () => {
  const env = createEmptyEnv('cross-j-wal-route-evidence');
  const deps = createRuntimeRoutingApi({ notifyEnvChange: notifyRuntimeStateChanged }).getRuntimeOutputRoutingDeps();
  const output: RoutedEntityInput = {
    entityId: `0x${'22'.repeat(32)}`, signerId: `0x${'33'.repeat(20)}`,
    runtimeId: `0x${'44'.repeat(20)}`, sourceRuntimeFrame: { height: 19, timestamp: 1900 },
    entityTxs: [{ type: 'runtimeOutput', data: {
      protocol: 'cross-j', sourceEntityId: `0x${'11'.repeat(32)}`, sourceSignerId: env.runtimeId!,
      targetEntityId: `0x${'22'.repeat(32)}`,
      entityTxs: [{ type: 'crossJurisdictionFillNotice', data: {
        orderId: 'wal-cross-route', fillSeq: 1, cumulativeFillRatio: 100,
      } }],
    } }],
  };
  expect(() => planEntityOutputs(env, [output], deps)).toThrow('CROSS_J_RUNTIME_OUTPUT_TARGET_UNVERIFIED');
  installReplayOutputRuntimeRoutes(env, [output]);
  try {
    expect(planEntityOutputs(env, [output], deps).remoteOutputs[0]?.output).toEqual(output);
    expect(env.infrastructure?.verifiedProfileRoutes?.size ?? 0).toBe(0);
    expect(() => planEntityOutputs(env, [{ ...output, signerId: `0x${'55'.repeat(20)}` }], deps))
      .toThrow('CROSS_J_RUNTIME_OUTPUT_TARGET_UNVERIFIED');
    expect(() => planEntityOutputs(env, [{ ...output, runtimeId: `0x${'66'.repeat(20)}` }], deps))
      .toThrow('REPLAY_OUTPUT_RUNTIME_ROUTE_MISMATCH');
  } finally {
    clearReplayOutputRuntimeRoutes(env);
  }
  expect(() => planEntityOutputs(env, [output], deps)).toThrow('CROSS_J_RUNTIME_OUTPUT_TARGET_UNVERIFIED');
});
