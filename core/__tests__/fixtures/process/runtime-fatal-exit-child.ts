import {
  createEmptyEnv,
  closeInfraDb,
  enqueueRuntimeInput,
  startRuntimeLoop,
  stopRuntimeLoopAndWait,
} from '../../../runtime';
import type { RuntimeTx } from '../../../runtime/types';
import { assertRuntimeCommandReady } from '../../../runtime/replica/lifecycle';

const env = createEmptyEnv(`runtime-fatal-exit-${process.pid}`);
enqueueRuntimeInput(env, {
  runtimeTxs: [{ type: 'fatal-exit-fixture' } as unknown as RuntimeTx],
  entityInputs: [],
});
const watchdog = setTimeout(() => {
  console.error('RUNTIME_FATAL_EXIT_FIXTURE_TIMEOUT');
  process.exit(2);
}, 5_000);
const healthy = createEmptyEnv(`runtime-fatal-isolation-healthy-${process.pid}`);
try {
  startRuntimeLoop(env);
  const failedLoop = env.infrastructure?.loopPromise;
  if (!failedLoop) throw new Error('TEST_FAILED_LOOP_MISSING');
  await failedLoop;
  if (env.infrastructure?.operatorStatus !== 'HALTED_REQUIRES_OPERATOR' || env.state.height !== 0) {
    throw new Error('TEST_FAILED_RUNTIME_NOT_ISOLATED');
  }
  let rejected = false;
  try { assertRuntimeCommandReady(env); } catch (error) {
    if (!(error instanceof Error) || error.message !== 'RUNTIME_COMMAND_NOT_READY:HALTED_REQUIRES_OPERATOR') throw error;
    rejected = true;
  }
  if (!rejected) throw new Error('TEST_HALTED_RUNTIME_ACCEPTS_COMMANDS');
  startRuntimeLoop(healthy);
  assertRuntimeCommandReady(healthy);
  console.log('RUNTIME_FATAL_ISOLATION_CONFIRMED');
} finally {
  clearTimeout(watchdog);
  await stopRuntimeLoopAndWait(healthy);
  await closeInfraDb(env);
  await closeInfraDb(healthy);
}
