import {
  createEmptyEnv,
  closeInfraDb,
  enqueueRuntimeInput,
  startRuntimeLoop,
  stopRuntimeLoopAndWait,
} from '../../../runtime';
import { reportManagedChildFatal } from '../../../orchestrator/process/managed-child-fatal-ipc';
import type { RuntimeTx } from '../../../runtime/types';
import { assertRuntimeCommandReady } from '../../../runtime/replica/lifecycle';

const env = createEmptyEnv(`managed-child-fatal-ipc-${process.pid}`);
enqueueRuntimeInput(env, {
  runtimeTxs: [{ type: 'managed-child-fatal-ipc-fixture' } as unknown as RuntimeTx],
  entityInputs: [],
});
const healthy = createEmptyEnv(`managed-child-fatal-ipc-healthy-${process.pid}`);
const watchdog = setTimeout(() => {
  console.error('MANAGED_CHILD_FATAL_IPC_FIXTURE_TIMEOUT');
  process.exit(2);
}, 5_000);
let acknowledged = false;
try {
  startRuntimeLoop(env, {
    onFatal: async payload => {
      const fingerprint = await reportManagedChildFatal({
        runtimeId: env.runtimeId,
        ...payload,
      });
      acknowledged = true;
      console.log(`MANAGED_CHILD_FATAL_IPC_ACK:${fingerprint}`);
    },
  });
  const failedLoop = env.infrastructure?.loopPromise;
  if (!failedLoop) throw new Error('TEST_FAILED_LOOP_MISSING');
  await failedLoop;
  if (!acknowledged) throw new Error('TEST_FATAL_LOOP_FINISHED_BEFORE_ACK');
  if (env.infrastructure?.operatorStatus !== 'HALTED_REQUIRES_OPERATOR' || env.state.height !== 0) {
    throw new Error('TEST_FAILED_RUNTIME_NOT_ISOLATED');
  }
  let rejected = false;
  try { assertRuntimeCommandReady(env); } catch (error) {
    if (!(error instanceof Error) || error.message !== 'RUNTIME_COMMAND_NOT_READY:HALTED_REQUIRES_OPERATOR') throw error;
    rejected = true;
  }
  if (!rejected) throw new Error('TEST_HALTED_RUNTIME_ACCEPTS_COMMANDS');
  // Fatal reporting belongs to the managed process; stopping one sovereign
  // Runtime must not terminate that host or another healthy Runtime.
  startRuntimeLoop(healthy);
  assertRuntimeCommandReady(healthy);
  console.log('MANAGED_CHILD_FATAL_IPC_ISOLATION_CONFIRMED');
} finally {
  clearTimeout(watchdog);
  await stopRuntimeLoopAndWait(healthy);
  await closeInfraDb(env);
  await closeInfraDb(healthy);
  process.disconnect();
}
