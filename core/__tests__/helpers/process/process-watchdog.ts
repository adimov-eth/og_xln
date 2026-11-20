import { spawn } from 'node:child_process';

// Bun's test runner emits no process 'exit' at the end of a run, a module-level
// hook binds only to the first test file that imports it, and a SIGKILLed
// runner runs nothing at all. A detached sh per owned process group is the one
// cleanup that survives all of these: once this test process is gone it kills
// the group and, if given, removes that group's scratch directory. It exits on
// its own as soon as the group is gone, so callers never need to stop it.
//
// The watchdog must not be a child of this process: after a timed-out test bun
// kills the processes that test spawned. A detached launcher (own session and
// group) backgrounds the watchdog and exits, leaving it reparented to init.
//
// `kill -KILL -PGID` and `kill -0 -PGID` are the forms both dash and macOS sh
// accept (dash rejects `kill -9 -- -PGID`). Only ESRCH means the group is gone:
// Darwin answers EPERM while an exited member awaits reaping, so any other
// failure counts as alive (same rule as process-group.ts).
export const SCRATCH_PREFIX = 'xln-test-anvil-';

const WATCHDOG = [
  'trap "" INT HUP',
  'gone() { case "$(kill -0 -$1 2>&1)" in *"No such process"*) return 0 ;; esac; return 1; }',
  'while kill -0 "$1" 2>/dev/null && ! gone "$2"; do sleep 1; done',
  'kill -0 "$1" 2>/dev/null && exit 0',
  'i=0; while ! gone "$2" && [ $i -lt 50 ]; do kill -KILL -$2 2>/dev/null; sleep 0.2; i=$((i + 1)); done',
  // Only an absolute, non-symlink directory shaped like mkdtemp(SCRATCH_PREFIX).
  `case "$3" in /?*/${SCRATCH_PREFIX}??????) [ -d "$3" ] && [ ! -L "$3" ] && rm -rf -- "$3" ;; esac`,
].join('\n');

const LAUNCH = `(\n${WATCHDOG}\n) </dev/null >/dev/null 2>&1 &`;

// `groupId` is the pid of a detached child, which leads its own process group.
export const watchProcessGroup = (groupId: number, scratchDir = ''): void => {
  spawn('/bin/sh', ['-c', LAUNCH, 'xln-test-watchdog', String(process.pid), String(groupId), scratchDir], {
    detached: true,
    stdio: 'ignore',
  }).unref();
};
