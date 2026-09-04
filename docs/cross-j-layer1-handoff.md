# Cross-J: Layer 1 is merged → rscore rewrite handoff

Paste this to the next agent (Claude / Codex / GPT) as-is.

---

You continue the XLN cross-jurisdiction swap simplification. Layer 1 (fill progress out
of consensus/committed state/cohort) is MERGED into `main` (merge `24de5964c`, branch
`crossj-layer1-progress`, base `adde297ae`). Work in a NEW worktree off current `main`
(`git worktree add /Users/zigota/xln-crossj-rs -b crossj-rscore main`). Never edit `main`
directly. One stable commit per step. Answer in Russian, tersely. Owner rules: delete
more than you add; TS canon first, then Rust parity; cancel is decided by the book
owner/hub, the user only requests; ask the owner which LLM models to use for quorums
(always the newest); no praise, no padding.

## State you inherit (gates green on main after the merge)
- matcher → `CrossJurisdictionFillInstruction` (`core/extensions/cross-j/orderbook.ts`)
  → book owner applies it in the same Entity frame
  (`core/entity/tx/handlers/cross-j/book-order.ts: applyCrossJurisdictionBookFillToState`)
  → source hub applies the same uint16 ratio locally or via ONE non-authoritative sibling tx
  `crossJurisdictionFillNotice` (`core/entity/tx/handlers/account-cross-j-followups.ts:
  applySourceHubCrossJurisdictionFillProgress`, the single decision point: terminal fill and
  removal-ACK both go through it) → terminal ⇒ `requestCrossJurisdictionClear` self-output
  → proposer materializes the paired `cross_pull_close` at the committed ratio.
- Account layer: `cross_pull_close` (`core/account/tx/handlers/settlement/pull.ts`) checks
  ladder-verified ratio == proof ratio, this leg == floor(|amount|·r/65535), binaryHash,
  hub authorship; deletes the source offer. Pull binding = `{orderId, routeHash, leg, status}`.
- Runtime close cohort (`core/runtime/delivery/topology/entity-routing.ts crossCloseKey`)
  is the cross-leg ratio equality: unpaired or mismatching closes are rejected on the
  receiving (user) runtime. Do not add an Account-level ratio marker.
- Rust mirror: `rscore/crates/entity-kernel/src/cross_j/{mod.rs,committed.rs}`
  (`with_fill_progress`, `apply_source_hub_fill_progress`, `apply_book_fill_to_state`,
  `commit_cross_jurisdiction_book_fill`, `apply_cross_jurisdiction_cancel_request`),
  `orderbook/matcher.rs::apply_cross_jurisdiction_fill_deltas`, engine `apply_pull_close`.
- Tests for the path: `core/__tests__/cross-j/swap/cross-jurisdiction-fill-progress.test.ts`,
  `cross-jurisdiction-removal-ack-idempotence.test.ts`. Fixtures:
  `rscore/fixtures/{account-semantics,cross-j-entity-kinds,cross-j-opening}`, tx-wire vectors.
- Known pre-existing red (not yours): `DisputeStarted relays payment secrets` test,
  E2E payment `.receipt-card`, `security:failure-taxonomy` (missing `core/runtime/frame/clone.ts`).
  Compare every TS failure list against a clean `main` worktree: zero new names.

## Gates (run before every commit)
```
bun run check:runtime-types && bun test core/__tests__/cross-j && bun test core/__tests__/rscore
bun core/scripts/checks/consensus/check-canonical-fill-scan.ts && bun run check:nested-hash-coverage && bun run check:unused-surface
cd rscore && cargo clippy --workspace --all-targets --all-features -- -D warnings && cargo fmt --all -- --check
CARGO_TARGET_DIR=/Users/zigota/xln/rscore/target bun tools/run-rscore-tests.ts
XLN_RSCORE_REQUIRE_BINARY=1 bun core/scripts/checks/rscore/check-rscore-parity.ts
XLN_RUNTIME_SEED=$(openssl rand -hex 32) bun core/scripts/e2e/runners/run-with-test-cleanup.ts --reason=mm-mesh -- bun core/scenarios/run.ts mm-mesh
```
Use `CARGO_TARGET_DIR=/Users/zigota/xln/rscore/target` for cargo (dependency cache); the
parity gate builds its own release binary inside the worktree. Never run stand scenarios in
parallel with other heavy runs (mm-mesh false-fails on contention).

## Owner decisions (2026-09-04) — implement, do not reopen
1. Account `cross_pull_close` outcome: plain "applied" + delete the source offer, in BOTH.
   Drop TS `swap_cancelled` and its orderbook-cancel event (the Entity followup already
   removes the book row). Regenerate `account-semantics` fixtures.
2. Entity-level close check, ONE rule in both: `cumulativeSourceAmount == floor(sourceTotal·r/65535)`
   and `cumulativeTargetAmount == floor(targetTotal·r/65535)` computed from the PROOF ratio,
   plus `r >= mirror ratio`. Replace Rust `committed_fill`/mirror-amount comparison
   (`ECONOMICS_MISMATCH`) and the TS rollback-only check with this.
3. `cross_pull_close` for an unknown pullId → REJECT at Account validation (delete the
   "already closed" no-op path) in TS and Rust. Repeat delivery is prevented by the cohort.
4. No FillNotice to the target hub; it learns progress from the carried route at close.
5. Invalid/foreign `crossJurisdictionFillNotice` keeps fail-stop (siblings are same-runtime by
   construction; same code tag in TS and Rust, Rust wraps it in `ENTITY_LOCAL_TX_INVALID`).
6. No Account-level ratio marker; multisig hubs out of scope (`validators[0]` self-signer
   stays); sub-lot remainders rest until expiry sweep or cancel.

## Your task: "ideal cross-J in rscore" — minimum code, same invariants
Step 0 — apply decisions 1–3 in TS first (canon), regenerate fixtures, then Rust; commit.
Step 1 — read `docs/consensus-invariants.md` (cross-J section) and the memory note
  `cross-j-atomic-cohort-simplification-2026-09-04.md` (keep Design A: source-first close,
  no target-first close — theft found by Kimi K3).
Step 2 — in Rust collapse the cross-J entity surface to ONE module with the minimal state
  machine: route mirror `{orderId, routeHash, legs, pulls, fillSeq, ratio, status,
  clearingPolicy, closeProofs}`; admission `{status, route}`; transitions
  admit → fill(ratio) → clear_requested → clearing → settled|cancelled|expired, plus
  dispute/salvage. Rust orderbook: mutate the cross-J row in place; delete the
  `offers` + `resolving_offers` re-materialization detour
  (`apply_cross_jurisdiction_fill_deltas`) if parity stays exact.
Step 3 — every deletion keeps `rscore:parity` exact against the TS fixtures; when TS has
  dead code that Rust exposes, delete it in TS first, regenerate fixtures, then Rust.
Step 4 — per step report: net LOC, list of deleted surfaces, gate tails. Before the final
  commit run a 5-model quorum audit (ask the owner for the model list) and fix what ≥2
  models confirm with a traced code path; reject claims without file:line evidence.

Invariants that MUST survive: ladder reveal is the only settlement authority; both legs
claim floor(total·r/65535) for one r (Runtime close cohort); partial reveal stays
disputable on-chain; atomic opening/close cohorts unchanged; TS and Rust produce identical
ordered outputs and state.
---
