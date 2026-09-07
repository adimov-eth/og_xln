# q2-reject-granularity.deepseek-v4-pro.out

harness: pi 0.84 --mode json, provider openrouter, packet-only, 2026-09-07 14:40 UTC, cost unknown (not reconciled)

```json
{
  "verdict": "per-tx",
  "answer": "Granularity: per-tx eviction (TS) is canonical. Per-signer-lane drop (Rust) violates the owner canon's intent — an unrelated valid tx from the same signer must not be collateral-damaged by a sibling's malformation. The TS path matches the idempotency principle (AGENTS.md: exact duplicate delivery is idempotent, different hash is a loud rejection) and the minimal-interference discipline: evict only the provably-rejected input, certify the rest. Rust must align.\n\nEnv dependence: remove the reject-vs-halt decision from RJEA entirely. Reading XLN_REJECT_FAIL_FAST / NODE_ENV inside the state machine breaks the AGENTS.md purity contract: 'identical previous state plus identical inputs produces identical state/outputs.' The typed reject disposition must be a deterministic output of the transition; the Runtime loop applies the fail-fast/drop policy once, outside the state machine, never journaled as part of the frame. This ensures replay is env-independent.\n\nRegression tests:\n1. reject_evicts_exactly_malformed_tx — 3 txs from signer A (valid, malformed, valid); after proposal build, frame contains tx[0] and tx[2]; tx[1] is mempool-evicted. Assert per-frame ordered outputs exclude only tx[1].\n2. reject_disposition_env_independent — same input replayed under NODE_ENV=production and NODE_ENV=development; assert identical frame roots, ordered outputs, and RejectedEntityTx disposition fields; assert no halt in either run.\n3. rust_per_tx_eviction_parity — Rust proposal builder with same 3-tx input; assert identical frame roots and eviction set as TS reference.",
  "references": [
    "AGENTS.md: RJEA purity, identical inputs → identical state/outputs",
    "AGENTS.md: 'a user or peer can never take a Runtime down'",
    "AGENTS.md: 'Validate at source, fail fast, trust at use'",
    "AGENTS.md: idempotency — exact duplicate is idempotent, different hash is loud rejection",
    "docs/fints.md: normative TypeScript and state-machine safety standard",
    "TS core/entity/consensus/proposal/start.ts:562-575 (per-tx eviction)",
    "Rust rscore/crates/entity-kernel/src/kernel.rs:1025-1040 (per-lane drop, diverges)",
    "TS core/support/process/runtime-process.ts:82-86 (env read inside state machine)",
    "Rust error.rs:54-69 (parallel env read via OnceLock)"
  ]
}
```
