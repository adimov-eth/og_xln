# q1-outbox-retirement.deepseek-v4-pro.out

harness: pi 0.84 --mode json, provider openrouter, packet-only, 2026-09-07 14:40 UTC, cost unknown (not reconciled)

```json
{
  "verdict": "B",
  "answer": "Option B is minimal and safe: the necessary predicate (`accountProposalSettledBySender`) already exists in identity.ts:123–151 but is unused for retirement. Wire it into dispatch.ts finalize: Account-proposal outputs skip the `accepted` set on transport success; the `finally` filter retains them until the peer ACK clears `pendingFrame`. Transport-accept reverts to a pure send throttle. This directly satisfies wal.md §9 (terminal receipt before deletion) and recovery-restores-every-non-terminal-entry. No new protocol frame, no Account-layer resend path.\n\nRust publisher.rs:168–170 must mirror the same guard. After a successful `WsWrite::write`, do not immediately drop the row from `pending_network_outputs`; hold Account-proposal entries until the Entity replica observes the peer's ACK and clears the pending frame (same stateHash/height check). The outbox retention datastructure becomes: `BTreeMap<OutputRouteKey, Envelope>` where transport-accepted rows stay until ACK.\n\nRegression test: two-runtime scenario. Runtime A commits an Account proposal, sends it, socket write succeeds. Runtime B's process dies *after* the TCP buffer accepts bytes but *before* WAL apply. Restart B from checkpoint+WAL. Assert A's outbox still contains the proposal row (not retired). Assert A re-publishes it on next dispatch. Assert B applies it idempotently on resend. Assert A retires it only after observing B's ACK.\n\nLiveness risk: unbounded outbox growth if peer never ACKs — requires the same timeout/eviction policy already needed by Account-layer `pendingFrame`. Duplicate risk: zero. Exact proposal replay (same height, stateHash) hits receiver idempotency; different hash is loud reject per the stated invariant.",
  "references": [
    "core/runtime/delivery/dispatch.ts:411-451 (dispatchEntityOutputs, accepted/retirement logic)",
    "core/runtime/delivery/identity.ts:123-151 (accountProposalSettledBySender, unused)",
    "rscore/crates/runtime/src/transport/publisher.rs:168-170 (current transport-accept retirement)",
    "docs/wal.md §9 (terminal receipt before deletion, recovery restores non-terminal)"
  ]
}
```
