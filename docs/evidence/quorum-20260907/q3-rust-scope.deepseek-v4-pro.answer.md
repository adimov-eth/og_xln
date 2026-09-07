# q3-rust-scope.deepseek-v4-pro.out

harness: pi 0.84 --mode json, provider openrouter, packet-only, 2026-09-07 14:40 UTC, cost unknown (not reconciled)

```json
{
  "verdict_a": "1",
  "verdict_b": "i",
  "answer": "Q3a: Option 1. All five launch entities (H1–H3 hubs + 2 market makers) are single-signer today. Porting full BFT before launch adds consensus-surface risk with zero launch utility. The predicate divergence (TS `threshold===1n` vs Rust `threshold == share`) is a real bug with potential safety impact if the two paths ever compare outcomes — unify to the canonical predicate immediately. Engine selector must loudly reject multi-validator boards (not silent fallback). Document the single-signer restriction in AGENTS.md under the Rust H1 section. BFT porting belongs post-launch when multisig entities go live.\n\nQ3b: Option (i). The chain already verifies Hanko signatures under two historical boards. Off-chain rejecting a chain-validated dispute Hanko is a safety-critical divergence: a counterparty holding a first-retired-board Hanko sees chain accept, off-chain reject → fork in dispute resolution. Add `previousBoardHash2`/`previousBoardValidUntil2` to `CertifiedBoardRecord` in both TS and Rust, accept both slots in signature verification. Minimal surface: two fields, one grace-window check per slot. No contract change needed. Test: board rotate×2 within grace window, sign under board[0], verify chain + off-chain acceptance.\n\nLaunch risk: A is low (all launch entities single-signer). B without (i) is medium — dispute Hanko divergence is a real scenario under board rotation churn. Combined test budget: ~6 focused vectors (3 authority predicates + 3 grace-slot combos).",
  "references": [
    "core/entity/consensus/replica-validation.ts:142-149",
    "rscore/crates/entity-kernel/src/consensus/single_signer.rs:319-321",
    "entity-kernel/consensus/authority.rs:331-345",
    "runtime/src/restore/entity/entity_consensus.rs:176-181",
    "HankoVerifier.sol:346-357",
    "core/hanko/signing.ts:663-666",
    "engine/consensus/signing.rs:388-393"
  ]
}
```
