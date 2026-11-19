# xln verified fixes and `AGENTS.md` audit (`00c9bc5`, 2026-11-18)

> **Tree status (`2026-11-18`):** Originally authored against `00c9bc5c` (`12` commits behind `origin/main` `bdc53c7b`). Checkout is now rebased onto `origin/main` (`bdc53c7b` -> `8f8a4a6a`), and each fix below is stored as a standalone, clean-apply, test-verified patch in [`docs/studies/ui/patches/`](studies/ui/patches/) (`htlc-secret-ack-watchdog-2026-11-18.patch`, `eth-receipt-header-fence-2026-11-18.patch`, `check-frontend-file-size-ui-2026-11-18.patch`) while keeping `main`'s tracked code clean.

> **Related (added 2026-11-19):** [`pure-xln-protocol-critique-2026-11-18.md`](studies/gtm/pure-xln-protocol-critique-2026-11-18.md) was written against the same `00c9bc5`. Fix 1 addresses `todo.md` item 15, which came out of the GTM study (commit `a6e339c64`).

---

## 1. HTLC Secret-ACK Watchdog (`todo.md` #15 + `j-events-htlc` + `rscore` Parity)

### Root Cause (`docs/fints.md` §4 Optional-Field Bag)
`PaybookEntry` (`core/entity/types.ts:59-75`) models secret-ACK enforcement via loose optional fields (`secret?`, `secretAckPending?`, `secretAckStartedAt?`, `secretAckDeadlineAt?`). Five TypeScript call sites and five Rust `rscore` call sites queued outbound `htlc_resolve` (`outcome: 'secret'`) on an inbound route; **two out of five in both engines** set `secret` without arming `secretAckPending`:

1. **Direct & cross-J target claim (`core/entity/tx/handlers/htlc/direct.ts:60-74` + `rscore/crates/entity-kernel/src/local_financial/payments/resolve_htlc.rs:90-107`):**
   - Called both directly and by cross-J target claims (`committed-htlc-followups.ts:338`, `j-events-htlc/index.ts:891`).
   - Set `entry.secret = secret` (`persistVerifiedPaymentSecret`), causing `applyHtlcSecretFollowups` (`committed-htlc-followups.ts:311`) to skip the route at `if (!route || route.secret) continue`.
   - `collectDerivedDeadlines` (`derived-deadlines.ts:103-115`) never emitted `htlc_secret_ack_timeout`, so a counterparty withholding ACK past `lock.timelock` escaped auto-dispute.
   - **Forwarder guard (`!localSentLock`):** On a forwarder (`A -> H -> B`) where `route.inboundEntity = A` already exists, an outbound `resolveHtlcLock` (`counterpartyEntityId = B`, `localSentLock === true`) must **not** arm `secretAckPending` against `A` before queueing `htlc_resolve` to `A` (pinned by `fixpay_4` in `resolve_htlc.rs:133-208` and `htlc-events-and-dispute-tail.test.ts`).
2. **On-chain `SecretRevealed` / `DisputeStarted` recovery (`core/entity/tx/j-events-htlc/index.ts:867-888` + `rscore/crates/entity-kernel/src/j_events/ingress.rs:637-649`):**
   - `applyKnownHtlcSecret` / `apply_known_htlc_secret` set `route.secret = secret` and queued `htlc_resolve` upstream to `route.inboundEntity` without arming `secretAckPending`. An intermediary recovering a preimage from a downstream on-chain reveal never auto-disputed a stalling upstream peer before `timelock - HTLC_ENFORCEMENT_RESERVE_MS`.
3. **Engine parity masked the bug:** `rscore/fixtures/entity-kernel/same-j-financial-v1.json` (`resolveHtlcLock`) locked the unarmed `PaybookEntry` projection across both engines.

### Fix Applied
- **Single TS seam (`core/paybook/lifecycle.ts:108-129`):** Added `queueInboundSecretResolution(state, entry, accountTxs, lockId)` which atomically pushes `htlc_resolve` (`outcome: 'secret'`) to `entry.inboundEntity` and calls `armPaymentSecretAckTimeout(state, entry)`. Routed all 5 TS sites through it (`direct.ts`, `j-events-htlc/index.ts`, `dispute-input.ts`, and both sites in `committed-htlc-followups.ts`).
- **Single Rust seam (`rscore/crates/entity-kernel/src/paybook/mod.rs:19-33`):** Added `arm_payment_secret_ack_timeout(timestamp, &mut entry)` and routed all 5 Rust sites through it (`paybook/mod.rs` ×3, `resolve_htlc.rs` when `!local_sent`, `j_events/ingress.rs` when `route.inbound_entity.is_some()`).
- **Vector & regression tests:** Regenerated `rscore/fixtures/entity-kernel/same-j-financial-v1.json` and added adversarial assertions in `core/__tests__/payments/htlc/htlc-events-and-dispute-tail.test.ts`, `resolve_htlc.rs`, and `j_events/ingress.rs`.

---

## 2. `O(1)` Post-Receipt Tip Fence on Ethereum (`todo.md` #5, `core/jurisdiction/adapter/receipt/reader.ts:441-459`)

### Root Cause & Exact Batch Numbers
- `BLOCKCHAIN.J_WATCHER_MAX_BLOCKS_PER_POLL` is **`8,191` blocks** (`8,192` headers including anchor = `64` JSON-RPC batches of `128`).
- `readAuthenticatedReceiptRange` (`reader.ts:424-449`) fetched and hashed all `8,192` headers in Pass 1 (`64` batches), skipped receipt fetches on bloom-negative blocks (`line 430`), and then fetched and hashed **all `8,192` headers a second time** in Pass 2 (`64` more batches = **`16,384` `eth_getBlockByNumber` calls and `128` batches per window**).

### Cryptographic Equivalence & TRON Boundary
- On `ethereum-trie` (`withStateRoot === true`), Pass 1 verifies `ethereumHeaderHash(raw) === block.hash` (`reader.ts:109-112`) and `child.parentHash === parent.jBlockHash` (`assertContiguousBlocks`, `lines 156-177`) across `[anchorHeight..toBlock]`. Under Keccak-256 collision resistance, `tipBlock.hash` at `toBlock` commits the entire header slice (every interior `receiptsRoot`, `logsBloom`, `stateRoot`, and `parentHash`).
- Re-reading and `ethereumHeaderHash`-verifying **only `[toBlock]`** (`1` header) after receipt reads detects any reorg at any height in `[anchorHeight..toBlock]`, cutting an `8,191`-block Ethereum window from **`16,384` headers (`128` batches) to `8,193` headers (`65` batches: `64 × 128 + 1`)**.
- On `tron-complete-receipts` (`withStateRoot === false`), JSON-RPC exposes no locally hashable Ethereum header, so the full `rangeHeights` Pass-2 fence is preserved unchanged.
- Updated `rpc-watcher-poll.ts:215` (`<= N+2P` on Ethereum, `<= 2(N+P)` on TRON) and all 4 batch-count assertions in `core/__tests__/jurisdiction/watchers/j-watcher-receipt-batching.test.ts` (including explicit TRON interior-mutation coverage).

---

## 3. Five Checkable `AGENTS.md` / Script Discrepancies Fixed in `AGENTS.md` (`282 -> 162` lines)

1. **Size rule vs. actual check scripts:** `AGENTS.md:253` stated `functions <30 lines, files <300 lines`, while `check-state-machine-size.ts:11-13` and `check-production-function-size.ts:5-6` actually enforce `<=100` LOC state-machine helpers, `<=150` LOC coordinators, and `<=3,000` LOC files—and `check-frontend-file-size.ts:11` checked frozen `frontend/src` while omitting React `ui/src`. Added `'ui/src'` to `check-frontend-file-size.ts` and aligned `AGENTS.md` §5 to the real gates.
2. **Conflicting confidence percentages (`95%` at lines `4, 174` vs `90%` at line `147`):** Replaced with deterministic decision authority in §7 (`existing invariant decides -> execute; new protocol/authority/money choice -> stop and ask owner`).
3. **Timestamp archaeology across three files (`AGENTS.md`, `docs/owner-profile.md`, `docs/rejected-ideas.md`):** Assigned one canonical home per subject in §4 (`todo.md`, `docs/night-work-plan.md`, `docs/roadmap.md`, `docs/rejected-ideas.md`, `docs/fints.md`, `docs/mac-studio.md`) with zero dated overrides in `AGENTS.md`.
4. **Core vs. Surface workflow + Collaborator config:** Kept all five protocol invariant sections (`RUNTIME → ENTITY → ACCOUNT CASCADE`, `CONSENSUS AND DETERMINISM`, `REJECT POLICY`, `ONE CANONICAL PRODUCTION PATH`, `STORAGE AND RECOVERY`) verbatim in §3; separated deductive Core rules from empirical `ui/` Surface rules in §6; moved personal language/cadence/host rules to Collaborator local config (§2) while preserving owner scope/protocol authority; removed mandatory `NEXT: A) B) C)` so agents can state plainly when the blocker is outside the repo (§7).
5. **Blank purpose gate (§1):** Left `<OWNER: one sentence — who opens xln first, and what they came to do>` explicitly for Egor, gating reports to correctness/verification progress until filled.
