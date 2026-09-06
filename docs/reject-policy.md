# Rejected remote input policy

Owner canon (2026-09-05): **a user or peer can never take a Runtime down.** Any input a
Runtime rejects because the *sender* is wrong (malformed remote EntityInput, a conflicting
user-authored prepare/materialize, an authenticated peer Account frame whose tx fails
validation) is a **rejection**, never a runtime fault.

| mode | when | behaviour |
|---|---|---|
| fail-fast (default) | tests, dev, CI, any `NODE_ENV != production` | the rejection is logged **and halts** the Runtime, so a hostile or buggy peer surfaces in tests |
| log-and-drop | `NODE_ENV=production` or `XLN_REJECT_FAIL_FAST=0` | the rejection is logged and the offending input/tx is dropped; the Runtime keeps serving |

`XLN_REJECT_FAIL_FAST=1` forces fail-fast even in production.

## The log line to watch
- TS: `runtime.input_discard` → `entity_input.discarded` (error level, always emitted), and
  `REMOTE_INPUT_REJECTED` / `FRAME_CONSENSUS_FAILED` halts in fail-fast mode.
- Rust: stderr `[ERROR][reject] entity tx rejected and dropped …` and
  `[ERROR][reject] inbound account frame rejected and dropped …`.

Every such line in a test, scenario or stand run is a bug to investigate (fail-fast makes
it a halt). In production it is the audit trail of peers to inspect.

## Where it is enforced
- TS `core/support/process/runtime-process.ts` `rejectFailFast()`.
- TS `core/runtime/frame/intake/discard.ts` (remote malformed ingress),
  `core/entity/tx/handlers/account/input-phases.ts` (peer Account frame rejected).
- Rust `entity-kernel/src/error.rs` `reject_fail_fast()` + `EntityKernelError::RejectedEntityTx`
  (handlers return it **before any mutation**), `kernel.rs` (cross-J tx drop),
  `resident.rs reject_failed_inbound_frames` (peer Account frame drop).

TS drops the whole remote input origin and retries the round without it; Rust drops the
rejected tx and continues the frame. Multi-tx remote inputs carrying one rejected tx can
therefore differ between the two in log-and-drop mode; in fail-fast mode both halt.
