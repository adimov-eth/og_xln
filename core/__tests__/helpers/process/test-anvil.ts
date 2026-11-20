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

// Anvil persists block states to `anvil-state-*` under ~/.foundry/anvil/tmp
// unless --cache-path is given (TMPDIR does not move it), and leaves that
// directory behind on SIGTERM as well as SIGKILL. Each test Anvil therefore
// gets a private cache root that this helper owns and removes.
//
// Callers stop Anvil explicitly (afterAll / finally). Bun's test runner emits
// no process 'exit' at the end of a run and is sometimes SIGKILLed, so a
// detached watchdog per Anvil kills its group and removes its cache root once
// this test process is gone, however it ended.
// It exits as soon as its Anvil does, and only ever removes an absolute,
// non-symlink directory shaped like this helper's own mkdtemp.
const CACHE_PREFIX = 'xln-test-anvil-';
const WATCHDOG = [
  'trap "" INT HUP',
  'while kill -0 "$1" 2>/dev/null && kill -0 "$2" 2>/dev/null; do sleep 1; done',
  'kill -0 "$1" 2>/dev/null && exit 0',
  // Anvil has no children; a plain pid kill is the form every sh (dash too) accepts.
  'kill -9 "$2" 2>/dev/null; sleep 0.2',
  `case "$3" in /?*/${CACHE_PREFIX}??????) [ -d "$3" ] && [ ! -L "$3" ] && rm -rf -- "$3" ;; esac`,
].join('\n');

type Owned = { root: string; watchdog: ChildProcess | null };
const owned = new Map<ChildProcess, Owned>();

export function spawnTestAnvil(args: readonly string[], options?: SpawnOptionsWithoutStdio): ChildProcessWithoutNullStreams;
export function spawnTestAnvil(args: readonly string[], options: SpawnOptions): ChildProcess;
export function spawnTestAnvil(args: readonly string[], options: SpawnOptions = {}): ChildProcess {
  const root = mkdtempSync(join(tmpdir(), CACHE_PREFIX));
  const child = spawn('anvil', [...args, '--cache-path', root], {
    ...options,
    detached: true,
    env: { ...(options.env ?? process.env), TMPDIR: root },
  });
  const watchdog = child.pid
    ? spawn('/bin/sh', ['-c', WATCHDOG, 'xln-test-anvil-watchdog', String(process.pid), String(child.pid), root], {
      detached: true,
      stdio: 'ignore',
    })
    : null;
  watchdog?.unref();
  owned.set(child, { root, watchdog });
  return child;
}

const exited = (child: ChildProcess): Promise<void> =>
  child.exitCode !== null || child.signalCode !== null
    ? Promise.resolve()
    : new Promise(resolve => child.once('exit', () => resolve()));

const release = (child: ChildProcess, { root, watchdog }: Owned): void => {
  owned.delete(child);
  watchdog?.kill('SIGKILL');
  rmSync(root, { recursive: true, force: true });
};

// SIGTERM, then SIGKILL after termTimeoutMs. Idempotent; safe mid-test.
export const stopTestAnvil = async (child: ChildProcess | null | undefined, termTimeoutMs = 3_000): Promise<void> => {
  const entry = child ? owned.get(child) : undefined;
  if (!child || !entry) return;
  if (child.pid) {
    await stopProcessGroup({
      pid: child.pid,
      termTimeoutMs,
      killTimeoutMs: 3_000,
      timeoutError: `TEST_ANVIL_STOP_TIMEOUT:pid=${child.pid}`,
    });
    await exited(child);
  }
  release(child, entry);
};

// Explicit process.exit() does emit 'exit'; clean up now rather than wait for the watchdog.
process.once('exit', () => {
  for (const [child, entry] of owned) {
    try {
      if (child.pid) signalProcessGroup(child.pid, 'SIGKILL');
    } catch (error) {
      process.stderr.write(`TEST_ANVIL_EXIT_CLEANUP_FAILED:pid=${child.pid}:${String(error)}\n`);
    }
    release(child, entry);
  }
});
