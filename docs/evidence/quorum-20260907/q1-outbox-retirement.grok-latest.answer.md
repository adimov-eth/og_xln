# q1-outbox-retirement.grok-latest.out

harness: pi 0.84 --mode json, provider openrouter, packet-only, 2026-09-07 14:40 UTC, cost unknown (not reconciled)

{
  "verdict": "B",
  "answer": "B is the minimal safe fix. The hole is real: transport-accept retirement plus no Runtime re-emit of pendingAccountInput means a peer that dies after ws.write but before apply never sees the proposal, while sender N+1 has already dropped the row. Account already keeps pendingFrame until peer ACK, and accountProposalSettledBySender already names the terminal condition; it is simply unused for retirement. A needs a new Account resend path. C adds a receipt frame that duplicates the bilateral ACK.\n\nRust publisher.rs must stop retiring Account-proposal envelopes on successful WebSocket write. Write completion is only an in-flight throttle. Delete the row only when the pendingFrame no longer matches that height/stateHash (same predicate as accountProposalSettledBySender). On reconnect, republish every non-terminal proposal row, matching wal.md §9.\n\nRegression: WAL-commit a proposal, accept on the socket, kill the receiver before apply, let sender commit N+1; the row must remain. Restart the receiver; the same frame is republished, applied once, then retired, and pendingFrame clears.\n\nLiveness: throttle must not be permanent—reconnect or bounded retry must republish unsettled rows. Duplicates are safe: exact same proposal/ACK is idempotent; a different hash is a loud reject, so resend the cached pending frame only.",
  "references": [
    "core/runtime/delivery/dispatch.ts:411-451 (retire on transport accept; filter pendingNetworkOutputs by accepted routeKey)",
    "rscore/crates/runtime/src/transport/publisher.rs:168-170 (WS write retires envelope; no positive ACK)",
    "core/runtime/delivery/identity.ts:123-151 (accountProposalSettledBySender exists, unused for retirement)",
    "docs/wal.md §9 (terminal receipt before outbox delete; recovery restores non-terminal entries)",
    "Facts: no Runtime re-emit of pendingAccountInput after retirement; duplicate proposal/ACK idempotent; sender crash-before-send covered; gap is peer death after accept before apply"
  ]
}
