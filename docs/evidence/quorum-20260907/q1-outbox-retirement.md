You are a senior distributed-systems reviewer. Answer ONLY from this packet; do not use tools, do not explore. Project: xln, a deterministic bilateral-consensus payment runtime (TypeScript reference, Rust port), HEAD f7ba455fc.
Design question 1 (outbox retirement rule). Today both engines retire a committed Runtime output row from the durable outbox as soon as the transport accepts the bytes (ws.send returned true / WebSocket write completed), not when the receiver commits or ACKs. The Account layer is bilateral: a proposal (frame) stays `pendingFrame` on the sender until the peer's ACK; a peer re-proposal/resend path for a lost proposal does NOT exist in the Runtime outbox (nothing re-emits pendingAccountInput after the row is retired). Excerpts:
--- core/runtime/delivery/dispatch.ts:411-451 ---
export const dispatchEntityOutputs = (env, outputs, deps, graph = createPreparedOutputGraph()) => {
  const groups = buildOutputEnvelopeGroups(outputs, graph);
  env.pendingNetworkOutputs = outputs.flatMap(({ output }) => graph.split(output));
  const accepted = new Set<string>();
  try {
    for (const group of groups) {
      ...
      if (!dispatchOutputEnvelope(env, group, sendable, envelope, deps)) continue;
      // Retirement follows exact accepted transport units. A later peer may still
      // be catching up or a send may fail: retain every untouched original slot.
      for (const output of group.sources) accepted.add(graph.prepare(output).routeKey);
    }
  } finally {
    env.pendingNetworkOutputs = env.pendingNetworkOutputs.filter(output => !accepted.has(graph.prepare(output).routeKey));
  }
};
--- rscore/crates/runtime/src/transport/publisher.rs:168-170 ---
/// Publish only rows proven durable by the exact token returned after LevelDB sync and directory fsync.
/// A successful WebSocket write retires the envelope in memory; the transport has deliberately no positive ACK.
--- core/runtime/delivery/identity.ts:123-151 (exists but is NOT used for retirement) ---
export const accountProposalSettledBySender = (env, output): boolean => { ... return !(pending?.height === proposal.frame.height && pending.stateHash === proposal.frame.stateHash) ... }
--- docs/wal.md §9 (doc, not code) --- "A terminal receipt is committed before the outbox entry may be deleted. Recovery restores every non-terminal entry."
--- Facts --- Transport is authenticated WebSocket with per-frame HMAC and strictly increasing encSeq; the receiver applies inputs into its own Runtime WAL; exact duplicate proposal/ACK delivery is idempotent on the receiver (different hash = loud reject). Sender crash after WAL commit but before send is covered (frame N outbox rows are restored and republished). The gap: peer process dies after the socket accepted the bytes but before applying; sender commits N+1 whose outbox no longer carries the row.
Options: (A) keep transport-accept retirement and rely on Account-layer resend (would need a new resend path); (B) retire an Account-proposal row only when accountProposalSettledBySender is true (peer ACK/commit observed), keep transport-accept only as a send throttle; (C) receiver-side application receipt message over the same session (new protocol frame) and retire on receipt.
Required output: JSON with fields verdict (A|B|C|other), answer (≤250 words: which option is minimal and safe, what must also change in Rust publisher.rs, what regression test proves it, any liveness/duplicate risk), references (the excerpt lines you relied on).
