import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { signalProcessGroup, stopProcessGroup } from '../../../scripts/e2e/runners/process-group';
import { watchProcessGroup } from './process-watchdog';

// Owned group leader pids.
const owned = new Set<number>();

// Register ownership before callers can await readiness or fail an assertion.
// Detached children have their own group, so descendants are owned as well.
//
// Per-test cleanup is the caller's: call cleanupTestProcesses() in afterEach
// (or afterAll for groups started in beforeAll). A hook registered here would
// bind only to the first test file that imports this module. Groups the caller
// never stops die with the test process via the exit/signal hooks below or,
// when no hook runs (end of a bun run, SIGKILL), via their watchdog.
export const spawnTestProcess = (command: string, args: readonly string[], options: SpawnOptionsWithoutStdio = {}) => {
  const child = spawn(command, args, { ...options, detached: true });
  if (child.pid) {
    owned.add(child.pid);
    watchProcessGroup(child.pid);
  }
  return child;
};

export const cleanupTestProcesses = async (): Promise<void> => {
  const results = await Promise.allSettled(
    [...owned].map(async pid => {
      await stopProcessGroup({
        pid,
        termTimeoutMs: 1_200,
        killTimeoutMs: 1_200,
        timeoutError: `TEST_PROCESS_GROUP_CLEANUP_TIMEOUT:pid=${pid}`,
      });
      owned.delete(pid);
    }),
  );
  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length) throw new AggregateError(failures, 'TEST_PROCESS_CLEANUP_FAILED');
};

const killOwnedGroups = (): void => {
  for (const pid of [...owned]) {
    try {
      signalProcessGroup(pid, 'SIGKILL');
      owned.delete(pid);
    } catch (error) {
      // The group's watchdog retries once this process is gone.
      process.stderr.write(`TEST_PROCESS_ABORT_CLEANUP_FAILED:pid=${pid}:${String(error)}\n`);
      process.exitCode = 1;
    }
  }
};

process.once('exit', killOwnedGroups);
for (const [signal, code] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
] as const) {
  process.once(signal, () => {
    killOwnedGroups();
    process.exit(code);
  });
}
