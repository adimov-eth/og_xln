You are a senior consensus reviewer. Answer ONLY from this packet; no tools. Project: xln deterministic Runtime→Entity→Account state machines; TypeScript is the reference, Rust must replay the same WAL to identical roots. Owner canon (2026-09-05): "a user or peer can never take a Runtime down": sender-caused failures are rejected+logged, never halt (fail-fast is allowed only outside production). HEAD f7ba455fc.
Question 2: the two engines disagree on the GRANULARITY of a rejection during proposal building, and the drop/halt decision is taken from process env inside the state machine.
--- TS core/entity/consensus/proposal/start.ts:562-575 (proposer path) ---
for (round...) { try { return await buildEntityProposal(context, selection, profile); } catch (error) {
  if (!(error instanceof MalformedEntityFrameInputError) || error.frameTx === undefined) throw error;
  const rejectedTx = error.frameTx; ... if (!inProposal || !inMempool || selection.proposalTxs.length === 1) throw error;
  entityLog.warn('proposal.tx_evicted', {...});
  context.workingReplica.mempool = mempool.filter(tx => tx !== rejectedTx);
  selection.proposalTxs = selection.proposalTxs.filter(tx => tx !== rejectedTx); } }
=> TS evicts exactly the rejected tx and certifies the rest of the same signer's txs.
--- Rust rscore/crates/entity-kernel/src/kernel.rs:1025-1040 ---
Err(EntityKernelError::RejectedEntityTx { kind, detail }) if !crate::error::reject_fail_fast() => {
    // Owner canon: a user can never take the hub down. The handler rejected before any mutation; log and drop.
    // TS discards the whole origin lane: drop what is still queued from this signer in the frame as well.
    let before = local_txs.len(); local_txs.retain(|queued| queued.signer_id != signer_id);
    eprintln!("[ERROR][reject] entity tx rejected and dropped: ... laneDropped={}", before - local_txs.len()); continue; }
=> Rust drops the rejected tx AND every still-queued tx of that signer in the frame; only two cross-J producers return RejectedEntityTx; other user-invalid txs (kernel.rs:973-1002 Financial/Control arms use `?`) become InvalidLocalEntityTx → fail_stop even in production.
--- env dependence --- TS core/entity/tx/handlers/account/input-phases.ts:157-177: `if (rejectFailFast()) throw haltRuntimeFailure('FRAME_CONSENSUS_FAILED'...) ; throw new MalformedEntityFrameInputError(...)`. rejectFailFast() reads XLN_REJECT_FAIL_FAST / NODE_ENV (core/support/process/runtime-process.ts:82-86). Rust error.rs:54-69 reads the same env via OnceLock. The WAL journals the input, not the decision. A replay process without NODE_ENV=production would halt where live production dropped.
--- Facts --- No gate/scenario ever runs NODE_ENV=production; scenario mode short-circuits the drop paths (discard.ts:38, entity-input-staging.ts:306). AGENTS.md contains no written reject canon.
Questions: (a) Which granularity should be canonical for determinism and for the owner canon: per-tx eviction (TS) or per-signer-lane drop (Rust)? (b) Should the reject-vs-halt decision be removed from RJEA transitions entirely (always return a typed reject disposition; the Runtime loop applies the fail-fast/drop policy once, outside the state machine), so replay is env-independent? (c) Minimal regression tests (name + assertion) that pin both engines.
Required output: JSON {verdict: "per-tx"|"per-lane"|"other", answer (≤250 words), references}.
