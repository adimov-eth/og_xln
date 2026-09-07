# Shared stand ownership

Use `bun run stand:status`, then `bun run stand:run --reason <task> -- <command>`
for a heavy command that does not acquire the stand itself. Capacity remains one.
Do not clear RAM/caches, disable the lock, or kill processes by executable name.

## Current guarantees

- Metadata publication, dead-owner reclamation and release share a kernel
  advisory lock. Never delete `metadata.lock` while any client can use the stand:
  its inode is the synchronization authority. Bun on macOS/Linux is required.
- Age does not revoke a live owner. Missing or malformed owner metadata leaves
  a slot blocked; inspect it manually instead of assuming it is abandoned.
- A release requires the matching token. A registered child group must have
  exited before release; a living group also prevents dead-owner reclamation.
- The manual runner creates its own process group, forwards cancellation,
  escalates after two seconds, and verifies group termination before release.
  Its default command budget is 30 seconds. `--timeout-ms` may extend this only
  within an explicitly owner-approved budget. Timeout returns 124.
- Status is read-only. The focused regressions use private temporary roots and
  real competing/child processes, never the active machine lock.

```sh
bun test core/__tests__/testing/tooling/stand/stand-lock.test.ts core/__tests__/testing/tooling/stand/stand-run.test.ts
```

## Boundaries still requiring implementation

The wrapper does not yet guarantee cleanup of descendants that call `setsid`
or launch detached groups (including separately launched test browsers).
Do not treat group cleanup as complete process-tree ownership. A browser lease
must identify its run, PID and OS start identity before automatic cleanup is safe.
Do not kill pre-existing orphan browsers merely because their executable matches.

Waiting currently polls; there is no persisted FIFO queue or XLN priority yet.
PID reuse is conservatively blocking, not proof that an old run still exists.
SIGKILL can prevent user-space cleanup, and a crash before child registration
is not covered by the current supervisor. These boundaries must be resolved
before claiming lossless ownership across arbitrary nested runners.
