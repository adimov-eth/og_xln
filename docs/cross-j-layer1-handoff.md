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

## Owner decisions (2026-09-04) — already implemented on main, do not reopen
1. Account `cross_pull_close` outcome: plain "applied" + delete the source offer (TS = Rust).
   Unknown pullId is rejected; binding leg and closeMode are validated at admission.
2. Entity close check, ONE rule in both: `cumulativeSourceAmount == floor(S·r/65535)`,
   `cumulativeTargetAmount == floor(T·r/65535)` from the PROOF ratio, `r >= mirror ratio`,
   proof binds this route (orderId/routeHash/pullIds). Only HUB mirrors must be in the
   clearing states; a user's mirror settles from the close alone.
3. No FillNotice to the target hub; it learns at close. Invalid sibling data fail-stops.
4. Removal ACK carries the book owner's progress; the source hub cancels from the later of
   mirror/ACK at `currentSeq + 1`. A removal ACK releases a waiting dispute even after settle.
5. Sibling `crossPullClose`: expectation built at the proof ratio, rollback only is rejected.
6. User-authored conflicts (prepare/materialize) are `MalformedEntityFrameInputError`
   (skipped, never a halt). Clear on a terminal route is a soft no-op.
7. Matcher: fills applied AFTER the matcher book is installed (row rests at the quantized
   remainder); fills that move only one leg claim are absorbed; conservation nets every
   executed fill; an absorbed IOC taker fill still cancels the remainder.
8. No Account-level ratio marker; multisig hubs out of scope; sub-lot dust rests until sweep.

Audit history: 4 quorum rounds (gpt-5.4, gemini-3.1-pro, deepseek-v4-pro, glm-5.3, kimi-k3,
grok) — see memory note `crossj-layer1-worktree-2026-09-04`. Round D scores: gpt 1000,
deepseek 960, grok 880, gemini 800, glm 660 (their remaining items are fixed in 52ce4288a
or listed below).

## Reject policy (owner canon 2026-09-05, implemented) — see `docs/reject-policy.md`
A user or peer can never take a Runtime down. Sender-caused failures are rejections:
logged, fail-fast by default (tests/dev), log-and-drop in production
(`NODE_ENV=production` or `XLN_REJECT_FAIL_FAST=0`). TS: `MalformedEntityFrameInputError`
+ `rejectFailFast()`; Rust: `EntityKernelError::RejectedEntityTx` (returned before any
mutation) + `reject_fail_fast()`, `kernel.rs` drops the tx, `resident.rs` drops a rejected
inbound Account frame. IOC/FOK are supported in the Rust book and matcher (TS parity).

## Open items (owner decision, not fixed)
- In log-and-drop mode TS drops the whole remote input origin (and retries the round);
  Rust drops the single rejected tx and continues the frame — multi-tx remote inputs
  carrying one rejected tx can differ. Fail-fast mode halts in both.
- Rust Account layer does not recompute `routeHash` at `cross_pull_lock` (TS rejects a
  non-canonical route); a bad hash is caught at Entity commit in Rust.
- Rust drafts `disputeStart` after a book-removal ACK in a later wake, TS in the same frame.
- Remote book owner's mirror stays `partially_filled` on a duplicate same-seq cancel (UI only).
- Rust entity `committed_pull_close` re-verifies the ladder where TS only decodes — perf only.

## Your task: "ideal cross-J in rscore" — minimum code, same invariants
Step 0 — decide the open items above with the owner; the rest of this file is the plan.
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
