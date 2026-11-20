import {
  spawn,
  type ChildProcess,
  type ChildProcessWithoutNullStreams,
  type SpawnOptions,
  type SpawnOptionsWithoutStdio,
} from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { signalProcessGroup, stopProcessGroup } from '../../../scripts/e2e/runners/process-group';
import { SCRATCH_PREFIX, watchProcessGroup } from './process-watchdog';

// Anvil persists block states to `anvil-state-*` under ~/.foundry/anvil/tmp
// unless --cache-path is given (TMPDIR does not move it), and leaves that
// directory behind on SIGTERM as well as SIGKILL. Each test Anvil therefore
// gets a private cache root that this helper owns and removes.
//
// Callers stop Anvil explicitly (afterAll / finally). If the test process dies
// first, however it ends, the group watchdog kills Anvil and removes its cache.

const owned = new Map<ChildProcess, string>();

export function spawnTestAnvil(args: readonly string[], options?: SpawnOptionsWithoutStdio): ChildProcessWithoutNullStreams;
export function spawnTestAnvil(args: readonly string[], options: SpawnOptions): ChildProcess;
export function spawnTestAnvil(args: readonly string[], options: SpawnOptions = {}): ChildProcess {
  const root = mkdtempSync(join(tmpdir(), SCRATCH_PREFIX));
  const child = spawn('anvil', [...args, '--cache-path', root], {
    ...options,
    detached: true,
    env: { ...(options.env ?? process.env), TMPDIR: root },
  });
  if (child.pid) watchProcessGroup(child.pid, root);
  owned.set(child, root);
  return child;
}

const exited = (child: ChildProcess): Promise<void> =>
  child.exitCode !== null || child.signalCode !== null
    ? Promise.resolve()
    : new Promise(resolve => child.once('exit', () => resolve()));

const release = (child: ChildProcess, root: string): void => {
  owned.delete(child);
  rmSync(root, { recursive: true, force: true });
};

// SIGTERM, then SIGKILL after termTimeoutMs. Idempotent; safe mid-test.
// Under heavy swap a SIGKILLed Anvil can take seconds to page in and die, so
// the kill wait is generous, and the cache root goes even if the stop throws.
export const stopTestAnvil = async (child: ChildProcess | null | undefined, termTimeoutMs = 3_000): Promise<void> => {
  const root = child ? owned.get(child) : undefined;
  if (!child || root === undefined) return;
  try {
    if (child.pid) {
      await stopProcessGroup({
        pid: child.pid,
        termTimeoutMs,
        killTimeoutMs: 10_000,
        timeoutError: `TEST_ANVIL_STOP_TIMEOUT:pid=${child.pid}`,
      });
      await exited(child);
    }
  } finally {
    release(child, root);
  }
};

// Explicit process.exit() does emit 'exit'; clean up now rather than wait for the watchdog.
process.once('exit', () => {
  for (const [child, root] of owned) {
    try {
      if (child.pid) signalProcessGroup(child.pid, 'SIGKILL');
    } catch (error) {
      process.stderr.write(`TEST_ANVIL_EXIT_CLEANUP_FAILED:pid=${child.pid}:${String(error)}\n`);
    }
    release(child, root);
  }
});
