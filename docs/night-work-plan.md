# Autonomous xln work

## Owner correction — core before browser acceptance (2026-09-09)

E2E is paused. The 18/18 scenario result covers TS only; the six-engine 111-frame
replay does not establish every scenario on native Rust. The scenario runner invokes
the TS Runtime directly; embedded Rust authority is explicitly retired. Use native
xlnrs production scenarios and retain the same financial assertions, not an engine
environment flag on a TS-only runner. First current native artifact: cross-J full fill
and process restart/recovery, W1, /tmp/xln-native-cross-recovery-w1-20260909.log.
After individual scenario equivalence, measure current TS and Rust W1/W4 on identical
production H1 load, collect phase profiles and optimize only measured bottlenecks.
There is no current W1/W4 TPS matrix or established largest phase. Historical W8
numbers do not answer that request. Resume both frontend E2E only after core gates.

### Native cross-J recovery: first real failure fixed

W1 cross-chain full fill passes; restarting the same production processes exposed
RRS_RESTORE_ENTITY_GRAPH:ROOT_COUNT:2 during the next checkpoint projection.
Projection now selects its exact owner's manifest from the shared Runtime graph;
full hydration still rejects foreign/multiple roots. Named Rust regression1/1 and
root check39/39 pass (/tmp/xln-native-owner-regression.log, /tmp/xln-native-owner-check.log).
Repeated real swap/restart advances past that error and exposes the NEXT boundary:
RRS_STORAGE_CHECKPOINT_REQUIRED:101. Evidence:
/tmp/xln-native-cross-recovery-w1-r3-20260909/server.log.
Storage enforces Runtime-relative cadence but projection only requests checkpoints
from Entity outputs. Align checkpoint preparation with canonical durable HEAD cadence,
then rerun this exact production artifact before any broader scenario or E2E.
The first attempt's MM Bun crash is separately evidenced in macOS DiagnosticReports
bun-2026-09-09-031918.ips (pid42093,303threads); W1 explicitly set for TS peers as well
as Rust passed startup and the swap. This is not a proven causal crash fix.

### Runtime checkpoint cadence fixed — 2026-09-09 00:34 UTC

The committer now answers checkpoint cadence from the canonical durable HEAD after
the preceding fsync, and Runtime projection materializes every Entity when due.
No new durable state, fallback or relaxed storage validation. Regression advances
101 frames without Entity work, verifies unchanged Account root, checkpoint101 and
empty WAL tail on reopen. Genesis socket coalescing still proves two authenticated
inputs -> one Runtime frame with zero economic outputs; frame1 now materializes as TS.
Rust W1 cross-J full fill + process restart recovery passes in36.9s:
/tmp/xln-native-cross-recovery-w1-r4-20260909/production-cross-swap-recovery-report.json.
Hub92->120, load25->35, settled route preserved. This is economic descendant recovery,
NOT equal full-state hashes at different heights. Check39/39 passes:
/tmp/xln-native-cadence-check-r2.log. Next: same native scenario W4, TS equivalents,
then remaining named scenarios and updated exact replay; no E2E yet.

### Post-fix evidence and method review — 2026-09-09 00:47 UTC

At52e5190a4, cross-J full fill + replacement/recovery passes TS/Rust W1/W4 (4/4).
All reports agree source10201020000, target10200000000, settled, different server PIDs.
Artifacts: /tmp/xln-native-cross-recovery-w1-r4-20260909,
/tmp/xln-native-cross-recovery-w4-20260909, /tmp/xln-ts-cross-recovery-w1-20260909,
/tmp/xln-ts-cross-recovery-w4-20260909. Those use the launcher's default fail-fast policy;
they prove happy-path financial recovery, not production rejection handling.
Exact111-frame replay also passes6/6 TS/Rust W1/W4/W8 on binary
0xde0d43a94696325c28ad5d35d108be16abb32fa1a6865fbc7313a3bfb3770af0.
Result .logs/hlt-evidence/2026-09-07T22-27-58-651Z/replays/1788914371662-parity.json.
Log /tmp/xln-parity-checkpoint-fix-20260909.log. No parity assertion weakened.
Production NODE_ENV=production mm-mesh adversaries pass4/4: hub-kill and mm-restart,
each with TS and Rust H1 W4. Logs /tmp/xln-native-hub-kill-prod-w4-20260909.log,
/tmp/xln-ts-hub-kill-prod-w4-20260909.log,
/tmp/xln-rust-mm-restart-prod-w4-20260909.log,
/tmp/xln-ts-mm-restart-prod-w4-20260909.log. Checks prove PID replacement and restored
same/cross books. They are not independent payment-conservation or TPS evidence.
Initial hub-kill used default dev fail-fast and correctly halted a TS neighbour on
unexpected socket close; explicitly rerun production policy without changing core.
Method review: continue missing native financial scenarios before TPS/E2E. Existing
TS-only in-process18-scenario runner is not a Rust gate; do not relabel its result.
Full scenario equivalence, live J on the new binary, final transaction-kind execution
coverage, current W1/W4 TPS/profile and both frontend E2E remain unfinished.

### Live J and the first missing native BFT boundary — 2026-09-09

Current-binary Rust W1/W4 production live J gates both pass: 5000/5000 payments,
freeze/business-input rejection/finalized dispute, plus r2r/r2c/c2r with independent
on-chain reserve/collateral arithmetic. Functional five-second runs, NOT TPS.
Artifacts /tmp/xln-native-j-dispute-move-w1-20260909 and
/tmp/xln-native-j-dispute-move-w4-20260909, dispute and settlement JSON reports.
Critical remaining implementation gap: native Entity consensus is single-signer.
RuntimeEntityInput::decode rejects proposedFrame/hashPrecommits/hashPrecommitFrame/
leaderTimeoutVote; restore rejects multi-validator authority with SINGLE_SIGNER_REQUIRED.
Therefore multi-sig and multi-validator company scenarios cannot currently pass natively.
Do not remove those guards without implementing the corresponding TS BFT transitions.
Recorded the real TS multi-sig132-frame input/output trace, 1514792 bytes:
/tmp/xln-multisig-native-oracle-20260909/inputs.json. First proposal at Runtime5,
first precommit at6;92 proposedFrame inputs and102 hashPrecommits inputs.
The existing --trail is only UI graph evidence; new --input-trace=FILE preserves raw
scenario wire inputs/outputs using the existing scoped collector. It refuses empty
traces and all-scenario runs. This is NOT a checkpoint/WAL/root parity artifact.
Check39/39 passed at /tmp/xln-bft-input-trace-check.log.
Next implementation boundary: native processing of the actual Runtime5 proposal,
with TS Entity consensus as the canonical algorithm; do not substitute more one-signer
smokes for the owner's requested all-scenario native equivalence.

### Durable multi-sig oracle — 2026-09-09 01:05 UTC

Scenario runner --recording=FILE now exports the existing signed RuntimeRecording
(checkpoint + actual persisted WAL), with canonical hash period1 enabled before boot.
It refuses a recording without a journal tail. Initial run failed correctly at
RECOVERY_BUNDLE_JOURNAL_CANONICAL_STATE_HASH_REQUIRED:height=2; enabling the existing
hash cadence, without weakening bundle validation, makes the repeated scenario pass.
Artifact /tmp/xln-multisig-native-oracle-20260909/recording.json: checkpoint1,
131 WAL frames through132. Independent TS restore from that file reaches root
0x5a6d0688542333ad8af4134fbdf1fcbe8af89f59750a7c6f13173bd16bcb6dba.
Manifest 0xea42e714864df2b00d7a1a5e6e101927b9131cbd2077676e9b93c3ed540dae4c.
Logs /tmp/xln-multisig-persisted-r2-20260909.log and
/tmp/xln-multisig-recording-replay-20260909.log. This is TS evidence, not native parity.
Native BFT requires more than admitting new fields: Runtime apply currently immediately
certifies the resident result; EntitySingleSigner also emits single-member Hankos.
Reuse the existing resident Account base/candidate mechanism for speculative state,
and port TS authenticated proposal replay, manifest signature collection, quorum commit
and output publication before removing single-signer guards. No protocol changes made.
Root check39/39 passed at /tmp/xln-multisig-recording-check.log.
The portable restore is read-only recovery evidence; it is NOT a certified W1/W4
authority benchmark. Setting worker-count environment variables alone does not
prove which executor the recovery path used.

### Window checkpoint — 2026-09-09 01:10 UTC

SHA1d686464d. Last green: bun run check,39/39,
/tmp/xln-multisig-recording-check.log. First executed native red: actual TS Runtime5
proposal decoded by RuntimeEntityInput::decode gives
EntityInputFieldUnsupported("proposedFrame"),0/1 tests,0 ignored.
Log /tmp/xln-native-bft-first-boundary-r2.log; temporary regression body retained at
/tmp/xln-native-bft-first-boundary-regression.rs. Temporary test insertion was removed;
production source is unchanged. The first diagnostic filter matched0 tests and is
NOT evidence; only the r2 log contains the executed failure.
Next single diagnostic command (already-built diagnostic binary, not release binary):
bun tools/stand-lock.ts run --reason native-bft-proposal-boundary --timeout-ms 60000 -- rscore/target/debug/deps/xln_rscore_runtime-269ac9f64eb6ede3 --exact machine::tests::multisig_recorded_runtime_5_proposal_native_admission --nocapture
Existing Account candidate selection is in resident_consensus.rs entity_inbound_inner;
reuse it for BFT, do not add a parallel Account store. Remaining final gates unchanged:
full native BFT + all scenarios, per-frame roots and ordered outputs, live J and cfg(test),
current W1/W4 TPS/profile, bounded verified Quorum, E2E both frontends. Automation xln-10
paused at the recorded window boundary. Goal remains incomplete; no production-ready claim.

## Current acceptance window — 2026-09-08 22:07 UTC

Owner authorized several hours of prioritized production work and ten-minute status updates.
Work window: through 2026-09-09 01:10 UTC; review the method every 30 minutes.
No subagents or usage resets. Owner now explicitly authorizes a bounded Quorum review
after scenarios/parity, under the existing shared reservation ledger and budget.
Preserve both frontend and ui.
Report completed/total checks per stage, never an invented production-readiness percentage.

Owner explicitly interrupted the sequence for a narrow Home faucet UX fix and Quorum review
(2026-09-08 23:44 UTC). Restore the scenario/parity-first sequence after that fix.
Quorum job `faucet-ux-20260909-01`: one completed GLM-5.3 low subscription review of the
textual UX proposal, not a code audit or screenshot review. No retry; USD0.25 reservation
retained because actual cash cost is unknown. Result `/tmp/xln-faucet-ux-quorum-result.json`.
Compact faucet follows the old Svelte inline layout; one committed success message and
one-click funding retained. Tour E2E 2/2 in 15.2s:
`/tmp/xln-faucet-ux-r2-20260909/wallet-results.json`. UI types green.

### Scenario/parity acceptance — 2026-09-08 23:57 UTC

All 18 canonical TS scenarios passed individually on isolated RPC chains under the stand
lock at `ad0742a62`: rebalance, lock-ahb, htlc-lazy, ahb, swap, settle, htlc-4hop, grid,
swap-market, multi-sig, company-ipo, rapid-fire, settle-rebalance, processbatch,
dispute-lifecycle, dispute-transformer, cross-j, mm-mesh. Logs:
`/tmp/xln-scenario-<id>-20260909.log`. IPO includes durable recovery at height212 with root
`0xd9ce07f383f95fe337ecac978ce0028d389d469c736d1c23d5d4887b6c85b8e0`.
Cross-J/MM run child Runtimes (outer Frames:0 is not zero economic execution).

New binary semantic replay: 6/6 TS/Rust W1/W4/W8, 111 frames, all checked roots and ordered
outputs equal; 170.2s. `/tmp/xln-parity-scenarios-20260909.log`, canonical result
`.logs/qa/hlt/replays/1788911794633-parity.json`. Logging restricted to runtime scope to
avoid Entity log overhead; assertions unchanged. No resume/provenance bypass used.
Binary SHA256 `7bfc2c7ad6a058af6ce7f29e493f9ffbe590693ea1b604a2ed3e39b365cf6461`.
Native live J + c2r settlement passed with 5,000/5,000 payments; Account32->38, jNonce25->29.
`/tmp/xln-live-j-final-20260909.log`. Five-second functional window is NOT TPS evidence.
Production/cfg(test) compilation is in the green check39/39. The 111-frame WAL still does
not by itself prove transaction-kind completeness or all adversarial scenario variants.

### Independent Quorum review — 2026-09-08 23:59 UTC

One code/evidence packet at `ad0742a62`, job `cross-remainder-review-20260909-01`, completed
GLM-5.3 low subscription; no retries. Result `/tmp/xln-cross-review-quorum-result.json`.
USD0.25 reservation retained; cash unknown. Findings were independently checked:
1. Claimed restored price substitution: disproved by the exact partial-fill snapshot test.
   Changing page price to8888 rejects with PAGES_ROOT_MISMATCH; committed page roots remain
   authoritative. Added this adversarial assertion to the existing regression.
2. Claimed TS accepts zero-lot resize while Rust rejects: incorrect. TS
   `core/orderbook/cross-j/index.ts:resizeBookOrderById` rejects <=0 with ORDERBOOK_RESIZE_INVALID.
   Reachability of a dust route is not established by the supplied counterexample.
3. Skipping fresh lot admission for authenticated committed remainders is the intended fix;
   no external mutation counterexample was supplied. No production approval inferred.

### Method review and wallet journey — 2026-09-09 00:12 UTC

Capacity, hosted entry, sovereignty and catch-up are green. Hosted now verifies the actual
connected Account entity ID against /api/hubs, not stale UI wording; absent servers fail.
Full same-wallet journey passed in21.8s: funding, Pay25, same-chain/cross-chain swaps,
dispute finality, recovered reserve moved to H2, reload and exact preserved state.
Artifact `/tmp/xln-ui-journey-r5-20260909/wallet-results.json`.
The journey requires a fresh private genesis at least three days old; configured with
ANVIL_GENESIS_TIMESTAMP=1788652800. The launcher supports this optional genesis setting,
rejects its use with persisted chain state, and never changes host authentication clocks.
Advancing only the browser clock was rejected as a method: it correctly triggers hello
clock-skew protection when connecting a new peer. That attempt was removed, not bypassed.
Dispute receipts are compared to the signed bilateral windows, never hard-coded24h.
Check39/39 and UI types passed. Next: five remaining React E2E files, production UI artifact,
Svelte full suite, parity transaction-kind coverage. No cosmetic work or TPS tuning yet.

## Owner priority override — 2026-09-08 23:43 UTC

Active Codex goal: all applicable production scenarios and full semantic parity, then
bounded Quorum review, then all E2E on both frontends. Do not switch to cosmetic work.

1. Run every applicable canonical scenario; fix the first real failure and rerun it.
   Include Pay, Swap, partial fill/cancel, Move, settlement, dispute, Cross-J and recovery.
2. Complete immutable mixed-WAL TS/Rust parity across worker configurations: every R/E/A
   root and ordered event/effect/outbox digest; live J and production/cfg(test) builds.
   The earlier 111-frame bundle does not establish complete transaction-kind coverage.
3. Quorum: one bounded read-only review of an immutable SHA and actual evidence. Use the
   existing reservation owner; independently reproduce findings before changing code.
   No new money allowance is inferred from this request; preserve the shared budget/expiry.
4. Run all applicable React ui and Svelte frontend E2E, including public production-build
   coverage and desktop/mobile tutorial interactions. Skips do not count as green.
5. Final applicable gates and checked milestone on main. Report exact remaining blockers;
   cosmetic changes and TPS tuning stay behind correctness. Lending remains disabled.

Every financial scenario must prove actual committed outcomes and recovery, not only rendered UI.
Use one heavy stand. Freeze source and builds throughout browser runs; previous live tests were
invalidated by development hot reload. Commit verified milestones on main; preserve unrelated edits.
Automation `xln-10` reports on this task every ten minutes and expires with this window.

Acceptance evidence at 2026-09-08 22:27 UTC:
- TS/Rust W1/W4/W8 exact replay: 6/6 engines, 111 frames; `.logs/qa/hlt/replays/1788905603729-parity.json`.
- Real browser Cross-J: 1/1, 21.5s, both legs, no holds, reload recovery; `.logs/qa/wallet/cross-j-ts-20260908/`.
- Real browser dispute: 1/1, 14.3s, early rejection and exact 100 USDC release; `.logs/qa/wallet/dispute-ts-20260908/`.
- Browser evidence above uses the diagnostic UI against isolated production servers. It does not claim production-build coverage.
- Final acceptance requires scenarios, E2E, parity and all applicable gates green; skips do not count as passes.


## Method review — 2026-09-08 22:40 UTC

Owner prioritized HLT parity and measured TS/Rust throughput while preserving the remaining E2E goal.
Keep one failing production boundary at a time. Do not repeat setup hypotheses without fresh evidence.
The isolated browser runner now proves Cross-J and dispute rather than skipping them.
The Rust H1-only launcher had created a secondary owner without its quote authority; genesis now
selects matching jurisdiction and owner inventories using the existing primary-only setting.
Native live J/Move passed on the current binary: 5,000/5,000 payments and account settlement.

HLT measured sequentially: 1,000 sovereign users, five processes, 8 workers, 20-second window,
1,000 offered payments/s, real H1 WAL/fsync; one sample per engine, not saturation capacity.
- TS: 20,000/20,000 completed, 672.65 payments/s, complete at 29,733ms, drain at 29,896ms.
  REJECT for TPS acceptance: the five-second drain deadline is 25,000ms.
- Rust: 20,000/20,000 completed, 952.38 TPS, complete at 21,000ms, drain at 22,787ms; no pending ACKs.
- Reports: `/tmp/xln-tps-ts-20260909/hlt-payment-load-report.json` and
  `/tmp/xln-tps-rust-20260909/hlt-payment-load-report.json`.
- The existing HLT checker incorrectly started the five-second drain after settlement. Fixed the
  publication gate to enforce the offered-window deadline; actual reports now reject TS and accept Rust.
  Focused genesis and HLT regressions: 50/50, 1,190 assertions.
- Pending: final source check/commit, verify the simplified wallet entry in browser, remaining scenarios
  and E2E. TS throughput acceptance remains red; do not claim all gates green.

## Method review — 2026-09-08 23:11 UTC

Native browser Cross-J exposed `cross-quote-lot-misaligned` after a real partial maker fill.
The previous payment-only HLT replay did not cover this counterexample. Preserve that evidence
scope: it is not full Cross-J parity. Fix the first divergence before expanding UI polish or load.
Committed signed fill ratios round both remaining amounts; Rust incorrectly reapplied fresh-order
lot admission to the remainder. The focused regression now covers two fills separated by an
orderbook snapshot/restore. Entity-kernel unit suite: 207/207 green. Fresh native build and the same browser Cross-J run passed (1/1, no skips):
`/tmp/xln-ui-cross-rust-r3-20260909/wallet-results.json`. Final exact replay and
`bun run check` remain required.
The owner reported the wallet gate at `/settings`; code shows disconnected sessions display
Gate without changing the URL. A reload clears memory-only unlocked seeds; no evidence yet
identifies whether this specific session reloaded, was locked, or disconnected.

### Verified partial-fill milestone — 2026-09-08 23:18 UTC

`bun run check`: 39/39 green (`/tmp/xln-cross-final-check.log`). Native Cross-J browser:
1/1 green; entity-kernel 207/207. Six-engine replay reached five completed configurations
before the 180-second wall limit killed Rust W8. Do not claim a new six-engine verdict.
Evidence: `/tmp/xln-cross-fixed-parity.log`. Resume correctly refuses the dirty shared tree
(`HLT_MIXED_PARITY_RESUME_REQUIRES_CLEAN_TREE`); preserve unrelated owner changes and do not
bypass provenance. Previous complete 6/6 evidence remains tied to the earlier binary.
Next: complete bounded parity with valid provenance; TS five-second HLT drain remains red.

### Wallet recovery and Move — 2026-09-08 23:37 UTC

Four more real browser checks passed: Manage/token lane/dispute (1), Move LEFT/RIGHT (2),
and tower restoration on a clean device (1). Move conserves all 100 USDC and drains pending
work. Tower recovery compares the canonical Runtime root and Account proofs, then refuses
an overwrite of existing local storage. Reports:
- `/tmp/xln-ui-move-manage-r2-20260909/wallet-results.json` (3/3, 27.5s).
- `/tmp/xln-ui-tower-restore-r3-20260909/wallet-results.json` (1/1, 18.8s).
The Manage test had a case-sensitive stale label (90s wasted); fixed and bounded to 60s.
The tower test dynamically imported core into Vite and triggered dependency optimization
and a page reload. It now bundles the unchanged canonical hash helper before opening a
wallet. A discarded plain serialization attempt could not preserve persistent collections;
the final test hashes the original loaded state and retains every semantic assertion.
Next: capacity, remaining browser scenarios and Svelte, exact new-binary parity, TS drain.

## Active owner scope — 2026-09-07

The latest owner instruction supersedes every earlier first-launch Lending
requirement in this document. Lending is OUT OF SCOPE and stays disabled.
Do not implement it or ask further Lending questions. Do not weaken existing
admission rejection, restore retired financial paths, skip tests, or increase
budgets. The sole objective is the existing core: Pay, Swap, Move, Dispute,
Cross-J and recovery, with all scenarios, tests and end-to-end checks green on
TypeScript and the native Rust hub engine.

## Current todo, in execution order

- [x] Close the HTLC boundary: 23/23 focused tests on canonical Paybook;
  corrected duplicate TS self-cycle HtlcFinalized emission to outbound-only,
  matching Rust. Money partition now 748/748, 29,500 assertions.
  Preserve same-frame forwarding, secret propagation, timeouts and idempotence.
- [ ] Build the fresh native xlnrs executable and reach the first live native
  Cross-J boundary; run final bun run check after production evidence is exact. Native rejection and exact signed
  duplicate execute currently pass 336/336 Rust runtime tests; TS settlement
  52/52. Preserve outer-command nonce, rollback and ordered outputs.
- [ ] Run the actual existing Pay/Swap/Move/Dispute/Cross-J scenarios on TS and
  native Rust H1. Prioritize native live Cross-J fill + restart next; previous
  66-frame cross-J replay was exact in TS W1/W4 and Rust W1/W4 but does not replace
  live native evidence. Exercise real J/TVM where the scenario requires it.
- [ ] Run production-mode browser E2E for the same feature flows, plus actual
  crash/recovery and outbox drain. Fix first production divergence and replay
  that exact artifact before expanding work. Remote-command E2E is now 1/1 green.
- [ ] Finish all unit/scenario/E2E partitions with bounded sequential runs,
  compile production and cfg(test) Rust, replay one immutable production WAL
  through all four engines with per-frame R/E/A roots and ordered outputs,
  and run final bun run check. No completion claim with failing or skipped
  required tests. Preserve unrelated shared-tree changes.

## Method review — 2026-09-07 03:36 UTC

The fastest useful method was exact first-frame evidence: native frame 85's
four immutable WAL rows exposed transport grouping, and the TS dispatcher
provided the exact oracle. Keep that method; do not change financial guards
to clear a transport failure. The new release build is green; run r8 now.
For hanging child tests, semantic completion and process completion are separate:
identify actual process-owned workers/handles before another timeout trial.
Open RPC sockets alone did not prove ownership. Use one bounded diagnostic,
then the documented lifecycle; no timeout increase or hidden skip.
After the native boundary, freeze writers once and run Move/Dispute on the
same prepared browser build. Then finish remaining core E2E/unit partitions
and final four-engine replay/check. Lending remains excluded.

## Current evidence and constraints

Runtime units: 238/238, 1896 assertions, 18.03s.
Money suites: 748/748, 29,500 assertions, 15.77s; /tmp/xln-core-money-final-r2.log.
Native live Cross-J exposed a real missing secondary Entity at genesis.
Canonical native control reads and explicit isolated endpoints are fixed.
Two-owner genesis and untouched sibling checkpoint/WAL recovery now pass
focused tests; fresh binary built and used for live Cross-J retries.
No live native Cross-J success yet.
Full TS RPC catalog 18/18 passed, including production mm-mesh.
Production browser Pay/recovery 1/1 (30.9s), Swap partial/cancel 1/1 (26.2s).
Browser Move and Dispute both hit the ordinary 60s process deadline; neither
is green. Owner question pending for a narrowly bounded 180s exception for
these two exact targets. Do not exceed 60s without an answer.
Historical core regression cluster: 116/116 green. Storage: 207/207 green.
Entity and network integrated: 466/466 green with real Runtime workers.
API wallet fixtures: 7/7 green. Adapter: 94/94, 627 assertions; full level
depth preserved independently of the bounded visible order page.
Remaining storage/recovery partition: 114/114, 941 assertions.
J-batch fixture cluster: 18/18; RPC timeout boundary: 4/4 (25ms timeout kept).
Faucet response/evidence and transient error regressions: 21/21, 91 assertions.
Native two-owner release built in 21.38s; Runtime 336/336, genesis 2/2.
Live native Cross-J r8 FILL GREEN: 1/1, 566ms, committed full-fill authority,
Runtime height83→90. This is functional evidence, not TPS. H85 grouping is
fixed with 337 Rust runtime tests and exact TS oracle; original WAL retained.
Restart first red: J_PREFIX_PENDING_RANGE_WITHOUT_OBSERVATION at Runtime91,
Entity87, J base44/attestable47. Restore accepted J evidence consistently;
no clearing pending work, fallback, new durable oracle or success claim.
Immutable artifacts: /tmp/xln-core-native-cross-j-r8-20260907.
J-submit partition 66/66; separate real-RPC SIGKILL recovery has exact money
proof but still leaks a process resource after both adapter closes. Diagnose
the resource owner; do not hide with process.exit or increase the timeout.
Primary TS RPC scenarios 7/7: lock-ahb, swap, settle, dispute-lifecycle,
dispute-transformer, cross-j, company-ipo (recovery exact at height 211).
Fresh immutable Cross-J replay 4/4 engines, 66 frames:
/tmp/xln-core-four-replay-r1.log. Rust self-cycle regression 2/2.
Current check: frontend and all 38 Rust test executables passed; the complete
check timed out at 60s during parity compilation, so it is not green.
Account SIGKILL/commitment focused cluster: 11/11, including 3 real crash/recover
cases. Remote command observation: 90/90 unit assertions cases and 1/1 real
browser E2E. Native live Pay/Move/Dispute and same-J Swap have earlier functional
artifacts; rerun when new core changes require it. No TPS or mainnet-ready claim.

The J-watcher fixture is still protected by macOS uchg. Prepared patch
/tmp/xln-j-watcher-int512.patch has a verified 6/6 copy; owner answer to the
existing protection question is pending. Do not silently bypass that question.

One machine, one heavy stand; normal verification process limit 60s, existing
record/replay/live economic exception 180s. Agents own disjoint areas; stop all
writers for final fingerprinted E2E and commits. No unrelated redesign, module
scoring, cosmetic cleanup, new features or new audit campaign.

Quorum was used once in this wave with zero retries. The existing shared
reservation owner and cumulative ledger remain authoritative: unresolved USD0.25
for this call and prior USD0.25 remain reserved; historical USD100 hold unchanged.
No new allocation, renewal, paid consultation or usage reset is implied here.

Last method review: 2026-09-07 02:32 UTC. Next review: 03:02 UTC.
Method change from measured outcomes: all 18 TS scenarios and the first two
browser money flows are green. Stop blind retries of the two 60s browser
timeouts; inspect their last completed stages and await the explicit bounded
budget answer. Native live Cross-J remains the first production blocker: finish
its canonical read-only control boundary, test real fsync snapshots, rebuild
xlnrs, and rerun the exact fill/restart workload. Keep remaining fixture repairs
parallel and disjoint; no Lending, new features, or broad audit detours.

## Superseded planning and execution history

The material below is historical evidence. Its Lending implementation requests
and wider priorities are superseded by the active scope above.

# Autonomous xln work

Owner instruction updated: 2026-09-06 18:31:42 UTC.
Last strategy review: 2026-09-07 01:39 UTC. Next review: 02:09 UTC.

## Objective and cadence

## Current execution order after draft1 review (2026-09-07)

Owner explicitly authorized agents, garbage removal and Quorum in this wave.
Method review at 01:39: the fresh broad unit run reached 1757 pass / 21 fail
before its 60-second process budget, so it is not a complete suite result.
Do not repeat the whole prefix: finish the newly demonstrated production
boundaries, then partition the remaining suite into bounded sequential runs.
Stable evidence: money fixtures 114/114 (441 assertions), exact Hardhat 3 stack
deployment and compiler-output binding 2/2, recovery Int512-to-tower-wire 36/36
plus browser codec 8/8, and telemetry/raw-input redaction 8/8 scoped tests.
No Solidity or encrypted recovery wire change was needed.
Native exact outer rejection passed runtime 333/333, but independent review
found a multiple-segment same-Entity context collision; implementer is fixing
that concrete replay boundary before release build. UI observation also exposed
a real command-specific confirmation defect: already-observed retries wait an
extra height and pending commands can be mistaken for unrelated frame progress.
Use the existing exact command identity/sequence retry, never add a receipt store.
The protected J-watcher fixture remains unchanged pending the owner's answer;
its prepared patch has a verified 6/6 copy. Full check and release remain open.

Method review at 01:08: disjoint ownership closed the known stale-test cluster
(164/164 integrated tests, 1804 assertions), removed 28 generated files (317721117
bytes), fixed owned-only Lending funding in both engines and Rust multi-clause
dispute bytes/arguments. Production Rust Move now passes R2R/R2C/C2R with exact
chain balances plus 5000/5000 payments and dispute under NODE_ENV=production.
The same immutable 66-frame Cross-J WAL remains exact in TS W1/W4 and Rust W1/W4
after the Rust changes: `/tmp/xln-draft1-four-replay.log`.

Do not extend a coarse signer-lane catch to hide the native duplicate-execute
failure. TS evicts the exact outer command; Rust must preserve that boundary,
nonce and accepted outputs. This remains open. Browser verification exposed a
separate real defect: the process shim selected development rejection policy even
in production bundles. Correct both browser builds and verify actual Chromium.
The production UI now passes using public UI only: identity import, faucet,
Move, Pay and recovery, 1/1 in 14.177 browser seconds. Production browser shim
policy is fixed and verified in real Chromium page and worker (4/4).
Full check r1/r2/r3 exposed formatting, lint and an index-signature error; those
are corrected, but the full check awaits the stable native rejection candidate.
The broad unit run observed 65 failures and did not complete the whole suite.
Follow-up focused runs have fixed Pull/Swap (18/18), orderbook (41/41), scenario
isolation (6/6), and custody (2/2). Preserve semantic assertions; unrelated async
test failures must not be misreported as Cross-J parity failures. The isolated
Cross-J opening vector is green (1/1). No release readiness or TPS claim.

Quorum used one bounded GLM5.3 Coding Plan consultation, zero retries, with the
existing reservation owner. USD0.25 remains reserved because cash cost is unknown;
managed allowance reported USD9.50 after this and the previous unresolvedUSD0.25.
Historical USD100 hold is unchanged. Opinion errors were rejected against real
TS vectors. Source packet/results: `/Users/zigota/quorum/data/packets/dispute-chunk-20260907-01/`.

Source: `/private/tmp/claude-501/-Users-zigota-xln/1eb1a950-0843-45d1-863f-bdeb86d3d990/scratchpad/report/draft1.pdf`,
19 pages read. Treat the report as evidence to verify, not protocol authority.
Pages 5 and 6 contain an unfinished findings table and an empty parity matrix.
Do not adopt its proposed wallet deletion, permanent Rust scope reduction, risk-cap
removal or compiler changes as owner decisions.

1. Finish the current money boundary: native Rust R2R/R2C/C2R must assert actual
   reserve/collateral conservation. Re-run the corrected isolated-jurisdiction
   binding, then reproduce and fix dispute ProofBody chunking/per-clause parity.
   Fix the first failing production transition before expanding the test scope.
2. Restore meaningful money and recovery regressions on the current ABI. The fresh
   four-file run is 61 pass, 7 fail, 1 error in 2.40 seconds; evidence:
   `/tmp/xln-draft1-first-boundaries.log`. Failures include three settlement
   transitions, two Runtime atomicity cases, stale committed-output dispatch
   dependencies and a removed ensureDelta import. Diagnose fixture drift versus
   production defects; preserve semantic assertions and never blindly repin goldens.
3. Prove delivery safety with production reject policy and real peer crash windows:
   commit-before-send, send-before-ACK, exact duplicate delivery, retained outbox.
   Sender-caused rejection must preserve healthy work; storage failures remain halt.
4. Complete Pay/Swap/Move/Dispute/Cross-J scenario evidence in TS and native Rust,
   including partial/cancel/expiry, unilateral exit and recovery. Cross-J currently
   has a fresh 66-frame production WAL exact through all four replay engines;
   native live Cross-J and native TVM remain separate outstanding gates.
5. Implement required first-launch Lending on the existing book: own-funded deposit,
   signed term claim, manual hub approval, principal transferred once, drawn debt,
   partial/full repayment, maturity/default and hub liability, then TS/Rust recovery.
   Keep admission closed until the complete economic lifecycle is proven.
6. Stabilize atomic commits on main, including code, artifacts, fixtures and tooling;
   preserve unrelated work. Run the complete relevant unit/scenario/E2E suites and
   bun run check, then bind final mixed WAL and four-engine replay to that candidate.
   Finish live Rust J/TVM, semantic completeness, production/test Rust compilation,
   production-mode E2E, authorized soak and valid live TPS before release review.

Fresh evidence supersedes report snapshots: stand is free; the five old selective
reruns are resolved; TS Move round-trip is green; native Rust has 5000/5000 payments
and 2500 matched swaps. These are functional results, not TPS or release approval.
The new native Move helper is not yet green after fixing its isolated chain binding.
Do not delay production fixes for module scores, bulk refactoring, a new audit
campaign or rewriting both wallets. Existing owner Lending choices remain binding.

## Earlier execution history

Owner decisions in the soft-mainnet successor task, 2026-09-07: the hub retains
the obligation to term depositors after borrower default; each loan disburses
principal exactly once as a transfer, not a revolving credit-limit grant.
These choices are approved. Complete the current full-check boundary, then
implement Lending against these economics using the existing TS/Rust book.
Admission remains closed until the economic lifecycle is proven.

Method review at 23:27: the first failed production boundary now has exact
evidence. Journey R5 again completes all six money phases and exact historical
Runtime/Account recovery; only the live drain fails. Its retained output is the
exact tip WAL output: Account ACK h4 from Runtime frame48, addressed to active H2.
The signed H2 route is known, but direct peers are empty and canDeliver is false.
This confirms the cold-start circular dependency: the writer waits for a ready
connection while connection preparation only happens inside dispatch. Do not
drop the ACK, weaken readiness, or change financial state. One transport owner
is adding lifecycle preparation using the existing direct-route API and a real
authenticated WebSocket regression, including late profiles and an unready peer.
The same frozen journey will run immediately after the scoped fix is reviewed.
Evidence: /tmp/xln-ui-journey-r5-pending-delivery-20260907.json and
/tmp/xln-ui-journey-isolated-1788736707195. Startup18.965s, browser38.454s.
In parallel, the already reviewed compact-view fix gets a fresh read-only Svelte
browser proof; owner storage is preserved. No broad audit or heavy TVM run before
the UI boundary is resolved. Native TVM preparation types now pass after a
types-only EventEmitter correction; actual stand cleanup tests remain6/6.
No Lending economic choice, new paid model call, commit or push in this interval.

Owner update at 22:04 UTC: Lending IS required for first launch. Desired shape:
hub opt-in extension, lendbook, explicit current-to-N-day term positions, manual
borrower approval and credit underwriting. The owner then asked to read all
relevant existing TS and Rust code before deciding what to finish. Root owns
UI/API/docs, one reader TS and one reader Rust; no admission changes or competing
implementers. Existing six TS state/API tests pass (46 assertions, 2.01 s), which
does not prove the currently prohibited production lifecycle. Preserve that red.
Pay R7 now passes 1/1 in 23.2 s: invalid drafts, revocation of an old recipient
quote, exactly one initiated/finalized payment after double click, exact fee/debit,
same-wallet roots/balances/activity after reload and no repeated receipt. Evidence:
/tmp/xln-ui-payment-edges-r7-20260907.log. Shared Activity deliberately suppresses
raw htlcPayment inputs: its assertion now uses the certified HtlcInitiated event.
Cross-swap R3 and its same-wallet recovery now pass. The full check remains
pending. This is no release completion claim.

Lending review results: TS7/7 and Rust7/7 existing focused tests pass, but bypass
live admission. Two actual-handler accounting counterexamples reproduce in109ms:
own balance0+credit100 can fund pool100; spent loan100 restored with owned R2C101,
then repay101/revoke0 becomes loan=repaid while Account debt100 remains. R2C is a
controlled finality input, not a chain run. Evidence:
/tmp/xln-lending-accounting-counterexamples-20260907.json. Findings and remaining
term-claim/approval/default/full-width issues: docs/lending-review-2026-09-07.md.
The owner was asked whether the hub retains the term-deposit liability or the
depositor accepts a pool loss. No Lending economics/admission was changed.
An earlier full check advanced past artifact drift and first failed at
FOUNDRY_ANVIL_TMP_CLEANUP_BLOCKED for owner dev Anvils87762/87763 on8545/8546;
the other parallel failures are cancellation, not separately established bugs.
Do not kill the owner's live stack or bypass this cleanup guard. No push.

Method review at 22:57: real progress remains measurable: Cross with same-wallet
recovery and signed-proof export are green; full check advanced past artifact,
cache ownership, compiler-intermediate budget and Solidity invariants15/15.
The full same-wallet journey now passes5/6 financial phases: initial100 funding,
Pay, same-J swap, cross-J swap, and actual DisputeFinalized with USDC+WETH payout.
Its first unresolved boundary is the next H2 Account opening: the browser clock
advanced48h for the dispute while hub clocks stayed real, correctly rejected as
a future Account timestamp. Do not weaken timestamp/auth rules or fund again.
The next approach is an existing mutually signed dispute-window setting or
consistent private-stand clocks; another locator-only rerun cannot solve it.
Frontend compact/full-Replica type confusion is now type-green0errors/0warnings;
its owner is freezing the minimal read-view chain for review and the next full check.
Native TVM monetary-ABI wave is prepared but not executed; preserve UI priority.
No Lending economic choice or admission change, no paid model call, no push.

At23:09 the compact-view review found and fixed a real remote-display regression:
four readers were using a live-only resolver even when remote mode intentionally
has env=null. They now read the selected compact/historical view; action authority
still requires a real live Runtime. Numeric regression passes5/5,69assertions,
Svelte0errors/0warnings; independent narrow rereview passes4/4 display consumers.
Existing in-app browser data was preserved when /app rejected deployment-version
change v3-1be66e5f8a49→v1-5d3956f48227; no Reset local data was clicked. A fresh
read-only remote-H1 browser proof is being prepared. Its runtime-import preflight
reports networkready=false; allowPartial is inspection only, not a readiness bypass.

The UI journey clock approach was checked on an actual private Anvil: an old
genesis preserves its mining offset. R4 keeps browser/hub/Runtime clocks real,
advances only J across the observed signed deadline and accepts either legal
dispute finalizer, recording its role. It still requires exactly one receipt,
the same nonce/proof, both exact token payouts, zero work queues and same-wallet
recovery. No race to a particular finalize button is treated as correctness.
R4 source review additionally required exact restored Runtime frame and WETH
reserve after reload; its owner is running that unchanged complete financial route.
R4 completed all six financial operations and exact historical Runtime/Account
recovery, then failed the live drain: pendingNetworkOutputs=1 for15s, other16
queues zero, Runtime height47 unchanged. USDC40,001,976 atoms is inH2 and WETH
5,997,400,200,000,000 atoms is inReserve. Do not call the full journey green.
Artifact: /tmp/xln-ui-journey-isolated-1788736248194; log:
/tmp/xln-ui-journey-isolated-r4-20260907.log. The browser phase took38.055s,
startup19.401s; cleanup completed and stand is free.
Read-only delivery review found a plausible cold-route liveness cycle: loop work
requires canDeliver(target), but lazy direct route preparation happens inside
committed dispatch. A wake alone cannot enter that branch. The exact retained
output and peer state still need evidence before attributing or fixing R4.
ACK evidence cannot be discarded merely because local balances/roots are right.

Method review at 22:27: the previous turn made progress: cross-swap R2 passed
1/1 (13.1 s browser test, 18.755 s startup), with exact 50-USDC debit,
49.995-USDT receipt, both settled route copies, permanent credit54.9945,
zero debt and actual pending/mempool/pull counts. Its first red was an obsolete
test oracle: a 49.995 receipt is below the actual 500-USDT auto-collateral
threshold, so the correct request count and charged fee are exactly zero.
The committed tariff and policy remain checked; production policy was not changed.
Artifact: /tmp/xln-ui-cross-swap-isolated-1788733346809/economic-evidence.json.
Next: prove reload of this same identity and operation, then actual signed-proof
export. Lending review is delivered; its two economics choices remain pending.
Do not rerun the known D3 rejection or enable unsafe accounting.

The full-check cleanup blocker was traced to four orphan Anvil cache directories,
87.03 GiB, all predating both live Anvil processes. Installed Foundry1.7.1 source
creates a unique cache TempDir per process. Root rechecked exact inodes, all file
birth/modify times, live process identities and chain IDs before targeted removal.
Foundry usage fell from97.29 to10.28GiB; both owner PIDs87762/87763 and their live
cache directories remained, and both chain heights advanced. No dev reset,
history deletion or guard bypass. Evidence:
/tmp/xln-orphan-anvil-cleanup-20260907-{before,after}.json.
For future starts, both wrappers now pass Anvil's actual --cache-path option;
TMPDIR alone does not redirect its persisted-state cache. Shell syntax passes;
existing owner processes have not been restarted.
Preserve the 50-GiB check and existing state files. No new external-model spend.

At 22:33, cross R3 passes1/1 in16.5s (startup18.636s): same-wallet recovery
preserves historical Runtime h23 frame/post-state hashes and both Account roots,
balances, credit, tariffs and settled routes. Exactly two accepted preparations
share one Runtime frame; each Account retains one lock and one close, with no
repeated execution or pending work. Artifact:
/tmp/xln-ui-cross-swap-isolated-1788733836717/economic-recovery-evidence.json.
Funded proof export passes1/1 in18.9s: downloaded frame/dispute Hankos match the
wallet's committed historical read surface (not independent cryptographic
verification), followed by Desk/command-palette navigation. Evidence:
/tmp/xln-ui-sovereignty-r1-20260907.log.

Full check then exposed an exact downward unsafe-type ratchet mismatch:
proof-builder removed batchStruct! via union narrowing. Independent AST comparison
found no added assertions; the exact baseline is now176files/637assertions, and
the focused gate passes. Rustfmt required only ordering two module declarations
in resident_entity.rs; formatting now passes. Next full-check failure is the
workspace50GiB budget (74.6GB measured), with 242,588 generated Rust rcgu objects
left in debug/deps. Root is clearing only pre-18:31 compiler object intermediates
with compilers confirmed idle; executables, libraries, incremental cache, release
outputs and economic evidence remain. Cleanup completed233,416 old rcgu objects;
workspace fell from69.47 to41.43GiB while retained libraries/binaries/incremental
cache remain reusable. The unchanged budget passes; contract invariants now
pass15/15 in7.65s. Do not weaken the storage budget.

Next full-check first red: four Svelte types expect a complete AccountReplica
from compact RuntimeAdapterActiveDispute, which intentionally omits raw proof
arguments. One frontend owner is replacing that false reconstruction with honest
read-view types while preserving real live action handles. No empty proof fields
or casts may hide the mismatch. Payment blocking regression passes3/3,21assertions;
remaining EntityPanel consumer types are being adapted. This is not a green
whole frontend or release claim.

The corrected dev Anvil cache path has an actual private-node proof: mined4096
blocks into its isolated cache, graceful shutdown, restart with exact height4096
and unchanged account balance; global cache directory set stayed unchanged.
Two orderly shutdowns completed; owner nodes untouched. Evidence:
/tmp/xln-dev-anvil-cache-path-r2-20260907.log. The first diagnostic call's five-second
bulk-RPC timeout was fixed by four bounded1024-block calls, not a longer test budget.

The remaining old full UI journey is not evidence: it requests excessive faucet
amounts, skips missing APIs, leaves cross as TODO and does not finalize its dispute.
One owner is replacing that test with a same-wallet economic sequence funded
once: reserve100 → Move → Pay → same-J swap → cross-J swap → dispute payout →
Move recovered funds to another hub. No extra token faucet may mask the exit.

Method review at 21:57: Pay double-click reproduced two actual 25-USDC payments.
The form now synchronously locks one submission intent through successful navigation;
errors unlock retry. Final Pay E2E remains red, so do not expand the heavy stand yet.
R2/R3 exposed incorrect test assumptions: exact route fee is 25 atomic units, while
the displayed quote authorizes a 50-unit maximum. Read the committed HtlcInitiated
and HtlcFinalized journals through the embedded UI's production reader, then assert
one hashlock, exact debit and same-wallet recovery. R5 stopped before Pay because
the test read Home before faucet settlement; wait for exact funded Account and UI
balance, rather than assuming request acceptance means completion. Preserve all
financial assertions. Native process-group cleanup now handles observed macOS EPERM
without releasing a live stand; real native tests pass 6/6 and R5 released its slot.
The repeated lending_fund rejection was already documented under D3: rerunning it
was wasted work. Do not repeat it or remove its protocol exclusion. Explicit UI
unavailability is prepared; actual Lending remains blocked on the owner's launch
scope decision. Cross-swap and proof-export tests are prepared, awaiting their real
browser artifacts after Pay. Solidity generation checkpoint is 64b5f62b7 (56 files),
37 commits ahead of origin/main, no push. Full check has not yet rerun after that
checkpoint. No new external-model spend, new TVM execution or production TPS proof.

Method review at 21:24: real faucet and isolated dispute artifacts are now green.
Faucet: four funding destinations, 13.6 s; dispute R6: 14.5 s plus 18.63 s
startup, exact one payout of 100 USDC, the scheduled wake bound to the sent
batch and chain receipt, early-finalize rejection, closed UI and empty queues.
Evidence: /tmp/xln-ui-dispute-isolated-r6-20260907.log. Do not rerun unchanged
private stands. Next first UI boundary: lending principal roundtrip with real
100-USDC faucet fixture, true mempoolCount, whole-limit 10% buffer, and visible
collateral tariff before close. Then actual cross-swap; the old journey has a
TODO cross act and cannot establish coverage. Discovery lists 16 functional
cases, not 16 passing cases. Keep each browser invocation below 60 seconds.
A separate read-only owner verified the exact 56-file Solidity generation
checkpoint, canonical artifact hashes and previous 116/116 controls. Preserve
unrelated work; checkpoint only after writers freeze and formatting/diff checks.
No release claim, new TVM execution, production TPS or new external spend.

Method review at 20:54: the owner reports the faucet is hard to find and does
not give money. Root follows this actual UI boundary now: direct Home/Desk
entry, persistent response/error, then exact on-chain/reserve/off-chain balance
checks through real faucet controls. The old Assets test assumed obsolete
BrowserVM prefunding and never proved ERC20 minting; replace that test. Original
wallet failure details remain requested, not inferred from the screenshot.
Tutorial is now green 23/23 steps in 28.0 s with confirmed DisputeStarted.
The compact Account API omitted dispute details and redacted mempool to []; it
now exposes bounded dispute fields and the true mempoolCount (4/4 vectors,
148 assertions). Earlier Move/recovery queue claims using [] were not queue
drain evidence; corrected count assertions passed the later runs listed below.
The final faucet browser run is green 1/1 (four real funding destinations) in
13.6 s: exactly 100 USDC each in signer wallet, Reserve and Account; an explicit
gas request adds 0.1 ETH. Five requests include one rejected 101-USDC public
faucet mint, then four successes; no duplicate issuance. Credit remains zero
until explicit approval, then 110 USDC. Home/Desk expose the faucet directly;
Assets shows current Account/Reserve balances and one persistent result/error.
Evidence: /tmp/xln-ui-faucet-four-balances-r2-20260906.log and its screenshots.
Corrected true-queue assertions passed Move LEFT/RIGHT and funded same-wallet
Pay recovery (3 passed; combined 55 s budget stopped the fourth from starting).
That fourth empty-wallet recovery passed separately in 16.8 s.
Swap and incoming capacity / prepayment Move passed 2/2 in 33.1 s.

Isolated dispute R3 exposed historical timer ingress after a 48-hour clock jump.
Live wake admission now captures current host time while preserving dueAt and
replay inputs; the named regression failed before the fix and passed after it.
Related wake/ingress tests pass 46/46, 133 assertions. R4 now actually paid the
100-USDC dispute: reserve100, collateral0, activeDispute absent, nonce2, exact
matching chain state and empty queues. Its test still incorrectly expects a
separate Runtime disputeFinalize input: canonical scheduledWake executes local
approved actions inside the same signed Entity frame. Correct this oracle and
the UI's stale "Dispute sent" label before claiming the full E2E green.
The full check was run and stopped at contract-artifact-drift: synchronized new
Solidity artifacts differ from the Git index; compiler metadata parity passed.
No push or release. No new external spend.

Owner priority update at 19:43: first diagnose the actual React UI vault recovery
failure (`RECOVERY_JOURNAL_POST_STATE_HASH_MISMATCH`, height 2) without clearing
the wallet; then run and complete the real tutorial through pay, swap, move and
dispute, including meaningful edge and same-wallet recovery assertions. Other
launch work follows. A live browser observation subsequently shows that vault
open at frame 15; this does not establish a recovery fix. Existing payment E2E
imports a fresh random phrase after reload, so replace that false recovery test
with the same identity and persisted financial state. Root owns recovery; the
TS test owner now owns the isolated dispute-finality test; the Move owner finished
the coordinated stack/payment recovery helper changes. Use the UI's own installed
Playwright runner: the repository runner and UI runner differ and cannot mix.

Method review at 20:19: preserve the original h2 wallet; its screenshot mismatch
is still unproven. Two independently reproduced failures are fixed: secondary HD
signers now register before WAL replay (same empty wallet reload 1/1, 9.6 s), and
React catch-up reuses the canonical watcher drain predicate with a captured
finalized target instead of waiting for a durable empty tail. Funded pay 100→75
then SAME-wallet reload is green 1/1 in 14.9 s with identity, historical frame,
Account roots and exact balances unchanged. The second payment run exposed a
test route assumption (Activity restores as Activity); fixed that test helper.
Move found RIGHT collateral omitted from Home and Pay net ownership: both now
derive the view from canonical deriveDelta. Deterministic LEFT/RIGHT Move is
green 2/2 in 23.2 s total: reserve100→0, collateral0→100, owned100 unchanged,
Home100, pending/mempool/draft/sent empty; unfunded action is disabled and inert.
Current sequence: rerun the entire tutorial requiring observed DisputeStarted,
then isolated real dispute timeout/finalize/payout, then swap/capacity negative
cases. One owner per test area; one live stand; no cross-j/TVM expansion until
these user-prioritized financial UI boundaries work. Successful tutorial steps
alone are not exhaustive edge-case coverage or mainnet readiness.

Replacement print completed as job7, one A4 sheet: diagrams left, report right,
center blank. Artifact docs/reports/xln-status-2026-09-06-safe-columns.pdf.
Printer still reports low toner; physical repair/legibility requires observation.

Method review at 19:49: new money ABI is synchronized; Solidity 116/116, TS ABI
45/45, Rust 90/90 focused checks passed. Native Tron selected nine targets compile
in 47.63 seconds and match EVM ABI entries, but new TVM execution remains unproven.
The prior R7 replay evidence uses the old ABI. Cross-j h91 transport now rejects
incomplete close cohorts before publication; producer scheduling remains open.
Freeze those separate areas while the single live stand runs the UI boundary.
The owner also requested a replacement one-page print with a blank center band:
printer reports toner-low-warning and estimated toner 0%; physical legibility of
the previous completed job failed. A printer owner prepares and verifies one new
page, diagrams left and report text right, without changing printer configuration.

New owner instruction at 18:31:42 explicitly approves removing all arbitrary Solidity
monetary ceilings, including the arithmetic/ABI direction in money-domain.md. Preserve
funds, existing signed-state migration, nonce/signature authority, solvency and actual
integer representation. One Solidity owner implements the first full-width settlement
counterexample using the existing harness, then synchronizes artifacts for bytecode
review. No deployment or asset transfer has been performed. Other requested deliverables
remain active; TS/Rust integration follows a stable shared ABI rather than competing edits.

The same message authorizes a new prospective shared Quorum budget of USD 10 per rolling
hour, beginning 2026-09-06 18:31:42 UTC. One reservation owner handles every external call.
Unresolved calls keep their full maximum allocation across hour boundaries; known final
costs occupy the window for 60 minutes after settlement. Keep the historical overnight
grant, its holds and unresolved bills intact; this new explicit authorization is separate.
One bounded GLM 5.3 review was dispatched through the verified subscription route:
HTTP 200 in 26.107 s, 5,867 input tokens, 1,536 completion tokens (1,523 reasoning),
but no final answer. No retry. USD 0.25 remains reserved; the actual bill is unknown.
Available managed allowance is USD 9.75, subject to other later ledger reservations.
An empty answer provides no quality evidence. Any later review must reserve its
own maximum and allow enough output for an actual answer within that cash bound.

Method review at 19:15: Solidity now compiles without MAX_MONEY, full-width asset
lifecycle and the original signed-boundary counterexample pass. Existing financial
controls are 97/98; the actual remaining R2C 4x64 gas boundary fell from 17,197,196
to 15,092,056 against the unchanged 15,000,000 assertion. Remove repeated external
calls and transient allocations while retaining exact event bytes/order and all
256 pairs. Public monetary tuples are frozen; assign one TS owner and one Rust
owner to canonical ABI boundaries while Solidity finishes the same failing vector.
Do not treat old deployed graphs or replay evidence as proof of the new ABI.

The real R7 live cross attempt reached immutable outbox h44 and exposed missing
Rust atomic-pair inference. TS selects the two exact source/target proposals;
Rust forwarded them without the required pair marker. The separate cross-j task
owns transport/routing plus the actual sibling EntityProfile signer lookup, using
the captured real rows as regression evidence. Fix these observed boundaries before
another stand run. Root batches a guarded build after all Rust writers freeze;
new money ABI integration must be coordinated with this old-graph live artifact.
The two obsolete Rust test fixtures now pass (watcher 12/12 and all 62 EntityTx
byte round-trips); full check and production TPS still have no final green result.
The requested one-page report printed successfully: one completed sheet, job 6.

Method review at 18:35: the same immutable R7 now replays exactly through R13 W1/W4
(67 frames, 68 Runtime roots, five ordered comparison counts each 67, both Account
roots). Ordinary live startup restores h90 exactly, catches up to ready h92, and
commits a new policy at h93 in 1.652 s with three checked WAL lineage links and
immutable source copies. The former Account-root assertion compared against h90;
actual h91 creates 18 expired cross-pull cancellation proposals before readiness.
Compare a policy-only command against ready h92, preserving the original exact
restore assertion. These are proposals, not bilateral completion without peer ACKs.

Production and cfg(test) all-target Rust clippy now pass in 16.97 s. Full check first
exposed orchestrator file size; move the exact readiness wait into the existing reset
startup owner, without compressing source or relaxing the limit. Its short stage now
passes; the next first failure is one newly introduced non-null assertion. One TS
owner fixes that boundary while one Solidity owner implements the newly approved
numeric change. A separate task prepares real existing MM/custody peers privately;
it does not edit the continuation driver or start a competing stand. Freeze the
contract ABI before assigning TS/Rust mirrors, then rebuild and rerun exact evidence.

Continue toward evidence-backed xln launch readiness on main. The owner's new instruction
supersedes the old one-hour window and outgoing credit slider in the active goal text.
Incoming uses one credit/collateral spectrum; outgoing uses the owner's reserve/onchain
funds through Move before reviewing the payment. No automatic payment after funding.

Every 10 minutes report verified results, first failure, next action and external spend.
Every 30 minutes review this plan against actual artifacts, reorder work when evidence
changes, and improve the method. After two failed attempts at one hypothesis without
new evidence, change the hypothesis, observation or implementation approach. Preserve
the first failing evidence; do not repeatedly rerun an unchanged expensive stand.

Keep one implementer per area and one heavy stand on this machine. Review stable diffs,
then run focused semantic checks and required final gates. Fast feedback must preserve
financial assertions. Mainnet readiness and live TPS require their actual evidence.
Method review at 18:05: same-socket native payment/ACK and actual saturated ingress
now pass (0.58 s / 0.55 s). A guarded canonical build with 451 unchanged inputs
replays the immutable R7 exactly in W1/W4, including native restart. Ordinary live
continuation passes TS/native h90 root/outbox comparison but stops at
RRS_LIVE_J_WATCHER:TOKEN_REGISTRY_MISSING. Read both implementations before choosing
the fix: TS reads Depository.getTokensLength/_tokens for each selected watcher range;
Rust wrongly requires a cached registry. Match the existing TS live reader, with
strict failure before cursor advancement. Do not persist a derivable extra field,
invent an empty fallback, migrate R7 or record a replacement to evade this boundary.

Native Tron now has two actual committed RPC-attested authority inputs (Foundation
at 25, EntityRegistered at 49, solidified through 60). An observer without an Entity
does not advance the Entity-certified J cursor: validate its actual authority WAL,
not an invented blockNumber expectation. Next verify restoration of the same WAL
and native adapter selection. The receive UI reaches a correct 30.25 USDC buffered
increment; its test mixed innerText with textContent, now corrected without weakening
financial assertions. One Bun/JSC worker crash remains unexplained: 31 isolated
worker-import/signing processes did not reproduce it. A later successful UI boot is
not proof of a Bun fix.

Method change: coordinate all Rust writers across the separate cross-j task before
guarded build, since test edits alone can stale a reviewed binary. That task owns
domain/matcher; this task owns transport/startup/watchers. Preserve the same artifact,
repair the first failing production boundary, then run related fixture/final gates.
The stand sequence is receive UI, native Tron same-WAL restart, then the fresh Rust
R7 live continuation. No new paid calls; the shared USD 100 hold remains in force.

Historical method review at 17:35: the previous answer reconstructed decisions and did not
complete a new implementation gate. The next safe actions are available: the genuine
two-Runtime ACK regression was red in 3.53 s and is now green in 0.57 s; the Rust owner
finishes actual saturated-ingress coverage before freezing. A live-continuation driver
is ready, but it must use the next fresh reviewed build, not bypass binary freshness.
Root integrates and owns native Tron authority; one UI owner changes the credit buffer.
Use the single stand sequentially for continuation, receive UI and native Tron. Do not
repeat a workload until its observed failure or implementation has changed.

Owner decisions at 17:31 supersede earlier proposals in this file:
- Native Tron may use any configured RPC, owned or external, optionally a quorum.
  Implement explicit RPC-attested native evidence; do not claim independent execution
  proof or require a managed local FullNode. The former trust-choice blocker is resolved.
- The default optional +10% buffer applies to the entire required credit limit.
  Collateral preparation is per request with a timeout, not an arbitrary time lease.
- We operate H1/H2/H3 and MM and sign deployment/endorsements. Independent operators
  are a later stage, not a launch dependency. Deliver launch, discovery and economics.
- Owner accepts the proposed platform schedule: 30 days free, then 1 bp/completed
  payment and 3 bp/completed swap, separately disclosed from hub fees/spread/gas.
- Owner asks why the monetary ceiling is being removed; explain the existing removal
  request and arithmetic dependency. ABI migration is still not explicitly approved.
  Preserve states/funds/history and the already authorized removal of arbitrary caps.
Paid calls remain held in the shared ledger. No spending or funding was executed.

Earlier reviews below are historical evidence, not authority over these newer decisions.
Method review at 17:01: R7 is exact on all four current engine/worker combinations,
including native restart. The first live failure was 1,000 authenticated sockets
rejected on delivery_ready, not slow population startup. Preserve the original
5 s readiness deadline and 1,000-user workload; fix the actual protocol boundary.
Transport and startup/J ownership are separate. Review stable transport while its
startup owner finishes the fixed-target barrier, then freeze both before release.
Transport L1 passes 18/18 in 0.32 s. Root review confirms the authenticated-control
and outbox-retention changes, but also identifies an existing production gap:
dialed sessions decode financial replies only under cfg(test). Advertising readiness
does not prove that receive path. After the next inbound H1 live-J artifact, require
a real bidirectional production-socket regression and route replies into the existing
ingress owner; do not add another queue or accept test-only coverage as production.
Paid external calls remain held; no new spending or usage-reset redemption occurred.
Remote main was fetched: 0 behind / 36 ahead. Final check/TPS/push still await proof.

Boundary update at 17:18: R8 authenticated readiness was correct; the orchestrator
sent its financial bootstrap policy before J catch-up, received the intended 503,
then tore down H1. Gate only that financial policy on validated native deliveryReady;
keep earlier identity/profile publication available. L1: 13/13, 25 assertions, 530 ms;
independent stable-diff review found no actionable issue. R9 then completed in
19.386 s: 1,000 sovereign Runtimes in five processes, 5,000/5,000 payments over the
five-second functional window, no pending Account frames/runtime work/outbox rows,
no rejected sessions or queue rejections before teardown. Actual native Account
settlement traversed proposal, bilateral Hankos, J broadcast and finality in 1.197 s;
Account height 23→29, J nonce 0→24. The same binary replays R7 exactly in W1/W4,
including native restart. Evidence: docs/evidence/rust-live-j-20260906/summary.json.
This is local EVM functional evidence, not 20-second TPS, native Tron authority or
TS-to-Rust live cutover. The Rust owner now builds the real two-Runtime, one-socket
payment→ACK→WAL regression before fixing dialed financial replies in the existing
reactor. Root retains integration/evidence ownership; no paid external calls.

Resume review at 16:33: the previous implementation turn ended at the usage limit;
no continuous work or intervening strategy reviews are claimed. Current main is
744817492, ahead of origin/main by 36 commits, with 306 shared worktree entries.
Neighbor commits changed production recovery since R7, so revalidate that immutable
recording against current TS as well as the corrected Rust binary. The R7 h29
regression exists; its production reader remains unfixed. One Rust owner resumes
that bounded fix while root checks current-source replay and build provenance.
Preserve existing evidence and other writers' changes; paid calls remain on hold.
Method review at 05:08: preserve immutable failing recordings. Progress that cycle:
47/65 R6 → 67/67 fresh R7, a proven TS recovery fix and completed native TVM governance.
R7's same-native restart was that review's first red boundary. Keep restart → W4 → live J →
final completeness/compilation/check → valid TPS as the critical path. New features
do not displace it. A mismatch identifies a boundary, not which engine is wrong:
prove independent source semantics before changing either side. R6 h73's exact
first-seen union of prior touches proved the TS bug; Rust did not inherit that leak.
R7 restart h29 proves all context keys/digests exist, but canonical encoded key order
differs from raw string order for 111/112-byte keys. Fix the reader's map interpretation,
preserving signed bytes and positional financial outputs. Diagnostic console output
uses an allowlist of heights, counts and hashes; full signed inputs remain private files.
The current loop advances, so keep its first-divergence approach. A terminal missing
context can hide an earlier Entity hash mismatch; compare signed commits in exact
order before diagnosing later cascade work. Inspect state sections, then frame events
and replica metadata separately. Matching money alone does not prove signed parity.
A private diagnostic driver now captures the exact signed input, Entity commit links,
events and section digests in one run at a requested height (h69: 2.903 seconds).
Every run uses fresh source-bound WAL copies; raw signed inputs stay in private files.
Existing native section traces avoid rebuilding for observation. Prove unchanged
section hashes before reusing a later dump. Root supplies independent TS evidence and
reviews stable diffs while one Rust owner fixes the boundary. After two attempts with
no new evidence, change observation or hypothesis. Do not weaken the root comparison.
After R7 W1/W4 exact, run the existing live Rust J settlement command. That launcher
uses native genesis, not TS-to-Rust live cutover; keep these evidence claims separate.
The h72 boundary is recorded transport retirement, not a new financial transition.
Follow the existing TS recovery witness: retained output must match prior verified
native bytes and order; current financial outputs remain independently generated.
Preserve current routing, sender-settled pruning and full final digest validation.
Do not refactor the live publisher or add another durable queue to fit this replay.
Replay does not prove independent delivery/liveness; the later live gate must do that.
Production files now stay frozen during builds; child agents write only their owned
tests. Record source hashes before/after release builds and discard mismatched builds.
Native governance runs use idle stand windows while Rust implementation proceeds.
Persist disposable fixture authority privately before funding, so a failing native
check can resume the same funded Entity instead of abandoning it or resetting the chain.
Cross R14 and same-J now share one production bootstrap and pass in 38.099 seconds.
The actual signed collateral fee is disclosed through its committed conditional tariff
before submission. Mobile clearance is 12 px, with zero horizontal overflow. Preserve
the distinction between UI receipt settlement and later jurisdiction rebalance finality.
Run full check after the current corrected production/replay boundary works.
Root owns artifact integration/provenance; one owner each implements Rust parity and
native jurisdiction connection. Source WAL and signed checkpoint remain immutable.
The native authority proof and wide monetary ABI are genuine protocol forks awaiting the
owner's answers; keep those boundaries closed and continue independent replay/UI work.
Fresh-wallet Cross now uses the canonical per-jurisdiction Entity import. For economic
browser proof, obtain an actual executable opposite MM order through the existing
production reader before choosing the pair/amount; a resting unsupported pair is not
evidence of a settlement bug. Use the same real UI actions with sufficient fixture funds.

## Current production boundaries

1. Remove arbitrary monetary ceilings coherently in TS, Rust and Solidity. Credit grants
   may use their full uint256 representation. Existing contract MAX_MONEY = 2^200 also
   supports intermediate arithmetic; replace that dependency with exact arithmetic before
   accepting states the contract cannot settle. Preserve authority, available capacity,
   signed-state representability and unrelated anti-DoS protections.
2. Native Tron: official java-tron 4.8.2.1, mainnet feature settings and JDK17 run locally.
   All eight contracts deployed. Real deposit/withdrawal passed: reserve 0→1,000,000→0,
   nonce 1→2, external balance restored, solid receipts and canonical events observed.
   Evidence: /tmp/xln-tron-native-20260905/economic.json. Native cross-j replay remains.
   The canonical provisioner now accepts the actual native graph with distinct contract
   addresses, native endpoints and solid finality (14.019 s including boot; verification
   86 ms). All nine compiled creation/runtime templates match the earlier graph. Continue
   through the existing Hub adapter factory reached the real first failure:
   J_AUTHORITY_RECEIPT_MPT_PROOF_MISSING:FoundationBootstrapped:25:3. Stock Tron headers
   do not commit receipt/log roots; a successful transaction proof cannot authenticate
   arbitrary authority logs. The validating-FullNode versus portable-proof decision is
   pending. Evidence: docs/evidence/tron-native-20260905/manifest.json (13 verified files).
   Additional actual TVM governance R1 registered numbered Entity 2, proved both
   100-billion supplies and reserve 0→1,000,000 with nonce 0→1, then mined board
   commit/proposal/activation through block 54. Verification stopped because generic
   ethers getBlock rejects native Tron's stateRoot="0x". Preserve that native shape;
   read the exact block timestamp through the canonical parser. Restart then proved
   that the unsolid activation block 54 was replaced, restoring the actual old board.
   The same funded Entity and pending proposal were recovered without registration
   or another deposit: reactivation 55, old-board mined REVERT 58, new-board payout 59.
   Activation and payout now wait for solidity. Reserve returns to 0, external balance
   to 1,000,000,000,000; the failed transaction preserves nonce 1 and payout advances
   it to 2. Execution 20.761 s plus boot 11.513 s. Original failure evidence remains in
   /tmp/xln-tron-native-20260905/governance-r1; final evidence is economic.json and
   /tmp/xln-tron-native-governance-r1-finality-recovery-20260905.log. This is direct L1
   contract evidence and does not close the native J authority-proof decision.
3. Receive/Pay UI: browser R10 passed in 28.926 seconds: credit 25→27.5, own reserve
   top-up 25.000025 including route fee, return to enabled Pay with no automatic send.
   Evidence: /tmp/xln-react-capacity-1788573224783. Downstream fee-capacity correction
   is included. A real LevelDB activity-view repair race was then reproduced and fixed
   under the existing per-path view queue; authoritative commits remain independent.
   R10 has zero activity-view gap warnings. Same-j Swap then passed in 24.100 seconds:
   199.999992 USDC debited, 0.0799760016 WETH received, permanent credit 0.0879824 WETH,
   zero pending work. Evidence: /tmp/xln-react-swap-1788573446670/browser.log.
   Fresh-wallet Cross setup passed in 22.381 s after restoring the existing vault's
   per-jurisdiction signer/import path. A subsequent 0.03 WETH receiving intent explicitly
   granted 0.033 credit without pre-click money movement, but had no opposite MM market.
   The test now reads the actual production MM order before selecting its UI pair/size.
   Cross R10 then passed in 27.139 s: both routes settled, 10,200 USDC debited,
   gross 10,198.98 USDT received, net 10,197.860102 plus a signed 1.119898 collateral
   request fee. Account frame 6 proves net + fee = gross; debt and pending work are zero,
   permanent credit remains 11,218.878 USDT. Evidence:
   /tmp/xln-react-cross-swap-1788576931486/browser.log. The auto-rebalance fee was not
   disclosed before Swap. The corrected R14 now shows the existing committed tariff
   and conditional nature before submission, without inventing an exact future net quote.
   Same-J and Cross pass together: startup 18.761 s, browser 19.338 s, two tests with
   fresh wallet contexts and one stand bootstrap. Mobile fee text clears the Swap button
   by 12 px with zero horizontal overflow. Evidence:
   /tmp/xln-react-cross-swap-1788578133651/browser.log. Receive/Pay R13 also passes in
   29.489 s, including the explicit default-credit CTA, 25→27.5 permanent limit, own
   reserve top-up and return to review without auto-send. Evidence:
   /tmp/xln-react-capacity-1788578008372/browser.log. Lending R1 reached the first real
   failure before position creation: the UI exposes Offer, but canonical TS/Rust live
   admission rejects lending_fund under D3. Account state remains unchanged; a real
   worker/stage regression proves the error. Aggregate logging now retains both apply
   and discard causes. Spectrum/close payout and fee assertions were not reached.
   Evidence: /tmp/xln-react-lending-1788578675867/browser.log and
   /tmp/xln-lending-stage-diagnostic-green.log. Existing Lending handlers and direct
   semantic vectors exist in both engines; these do not prove live admission/consensus.
4. Current R7 production plus real process replacement/recovery passes in 38.681 s;
   one cross-j swap settles in 625 ms. PID 95392→95745, both routes settled. Frozen
   checkpoint 23 plus tail 24–90 contains 67 frames, 108 Entity inputs and 104 outputs.
   Current-source TS W1 (2.909 s) and W4 (3.031 s), rechecked September 6, match all
   five evidence arrays and the original TS results. Native W1 originally verified
   every frame/root/ordered digest and fsync, then failed the mandatory same-native
   restart: RRS_NATIVE_RESTORE_STORAGE:RRS_ENTITY_CONTEXT_FRAME_REFS. Actual native
   h29 has two complete context payloads with exact keys and digests. The reader
   incorrectly required raw string order while the canonical codec orders encoded
   keys (different lengths). The corrected reader validates encoded order/uniqueness,
   then compares map membership in the existing String index. Real append/reopen,
   duplicate rejection and changed-manifest rejection pass in 0.10 s after a 3.04 s
   compile. Root review found no actionable issue. Release build: 20.510 s, all 407
   source files unchanged. Same immutable R7 now passes native W1 and W4 including
   native restart: 67 frames, 68 runtime-root comparisons, all five ordered comparison
   counts 67, 108 inputs, 104 outputs, both Account roots exact. Whole driver wall:
   W1 1.444 s, W4 0.607 s; these are replay measurements, not TPS. Evidence:
   /tmp/xln-cross-j-parity-r7-20260906-1633/rust-worker-comparison.json and
   rust-context29-fixed-w{1,4}-20260906.log in the original R7 replay directory.
   Public summary: docs/evidence/r7-parity-20260906/summary.json.
   Next production boundary is live Rust J settlement on this binary. Its first
   September 6 run booted in 2.910 s but stopped before any financial input:
   RRS_TRANSPORT_INBOUND:unsupported-direct-message:delivery_ready. All 1,000
   sovereign Runtimes started and authenticated; Rust rejected all 1,000 sessions.
   HLT_HOST_READINESS_INCOMPLETE:missing=855 is a later readiness snapshot, not
   evidence that those Runtimes never started. Preserve the 5 s readiness deadline;
   port the existing authenticated readiness control and recipient outbox gate to
   native transport, with local readiness owned by actual startup J catch-up.
   Current TS readiness/outbox regressions pass 4/4, 86 assertions, 361 ms.
   Evidence: /tmp/xln-rust-live-j-r7-20260906/server.log (first rejection line 37;
   1,000 authenticated/rejected sessions and zero inputs at line 1038).
   Source: /tmp/xln-cross-j-wal-r7-20260905/recording-manifest.json; replay/import:
   /tmp/xln-cross-j-parity-r7-20260905. Original signed checkpoint fields, snapshot,
   tail and source binding remain exact after offline import (140→154 rows).
   Prior cross-j WAL binds checkpoint 22 and 35 frames through 57, with 64 Entity
   inputs and 56 outputs. TS W1 and W4 verify every frame/root and ordered output. All five
   per-frame evidence arrays match exactly; the recording contains one pending outbox at
   its first failure boundary, so this replay is not a drained live TPS claim. Manifest:
   /tmp/xln-cross-j-wal-r4-20260905/recording-manifest.json. Report:
   /tmp/xln-cross-j-parity-r4-20260905/ts-worker-comparison.json. Native exact range,
   whole-Runtime checkpoint root, plural Entity restore and offline Account import pass.
   The canonical imported manifest preserves five signed checkpoint fields and the source
   binding; its source WAL is frozen separately from each mutable replay copy. Rust now
   matches frames 23–44 (22/35). Corrections preserve positional Account publications,
   per-owner continuations, canonical events, per-input admission and per-owner immediate
   cascades. Related Rust machine tests now pass 85/85. Frame 45 isolated the TS worker bypass:
   whole-mempool proposal precedes cohort selection; the later guard sees an empty mempool.
   Four real worker regressions failed in 1.385 s. The corrected worker path, including
   failed-HTLC continuation, passes 52 tests and 41,146 assertions in 9.42 s. Fresh R6
   production recording and actual process replacement/recovery pass in 38.387 s;
   the single cross-j swap settled in 650 ms. Frozen R6 checkpoint 24 and tail 25–89
   contain 65 frames, 105 Entity inputs and 104 outbox envelopes. TS W1 (2.837 s) and
   W4 (3.115 s) match every frame and all five evidence arrays exactly. Manifest:
   /tmp/xln-cross-j-wal-r6-20260905/recording-manifest.json; comparison:
   /tmp/xln-cross-j-parity-r6-20260905/ts-worker-comparison.json. Rust W1 matches 25–42
   and first diverges at 43: all 23 sections of both committed Entity states agree,
   but two pending Account proposal roots differ. Exact candidate logging and caller
   inspection isolated cross_pull_lock.createdHeight: TS passes J height, Rust passed
   Account height. The unequal-height test reproduces 4 vs 24; the caller fix passes
   five focused tests and R6 now matches h43 (19 frames exact). Next red at h44:
   ENTITY_REPLAY_CONTEXT_UNCONSUMED, one source Entity frame. The tagged ACK pair must
   stage both legs against the same pre-pair sibling view and publish both before
   normal AccountWork sees updated views; Rust exposed the first leg too early. Fix
   this narrow publication boundary with its regression, then replay R6. The fix passes
   its named regression and advances the same R6 through that boundary. A second h44
   mismatch came from projecting Cross-J venues into same-J pair policies; the corrected
   derived policy projection passes three focused tests. The next failure was only
   source orderbookExt metadata: target 23/23 sections, source 22/23, all four individual
   books and the complete ordered outbox were exact. Rust inserted pairDimensions for
   a Cross-J book; TS keeps that metadata only for same-J. The corrected writer and
   restore validation pass three tests, preserving canonical Cross route validation
   and explicitly rejecting the former incorrect persisted shape. R6 then advances
   through h64. At h65, remote runtimeOutput wrongly split an ordinary deferred input
   from its preceding Account ACK; the corrected grouping passes its real regression
   and R6 now matches h66. The three h67 corrections preserve the pre-trade published
   Cross book, execute the existing reveal without an extra offer-presence condition,
   and count only committed matches in runtime metrics. Named regressions pass; R6
   now matches every root and ordered digest through h67.
   At h68, scheduling the existing hub-rebalance kick from each
   successful Account input's immediate readiness restores all 46 Entity sections,
   the canonical state hash and the outbox. The remaining frame event incorrectly said
   an absent order was removed merely because a book existed. Exact indexed membership
   fixes the event, with a named regression. R6 now passes h68 fully (44/65 frames).
   h69 now executes the scheduled collective self-action in the same signed Entity
   frame, records exactly the rebalance Account touch, and compares the same eight
   financial effect kinds as TS. Debug diagnostics remain in production outputs;
   receipt removal, mutation and reordering still change the financial-effect digest.
   R6 passes through h72 fully (48/65). The verified transport-retirement witness
   preserves exact prior native WAL evidence, current routes, sender-pending pruning
   and positional delivery merging. Seven regressions pass, including a real payment
   whose new output cannot be hidden by an empty recorded outbox. Release 26.70 s;
   all 406 source hashes match before/after. That candidate's first red h73 has exact Entity
   roots, contexts, replica metadata and ordered outbox, but TS records 16 old Account
   touches and two book owners while Rust records none. This is the first live frame
   after restart. TS replay accumulates currentStorageOverlayMarks without the cleanup
   performed by live commits. The real regression reproduces a payment of 10, six
   replayed WAL frames and two stale Account touches in the next no-account frame.
   Clear only per-frame marks after successful authority finalization. The same test
   now passes 31 assertions in 2.12 s, with the cumulative four-record overlay and
   financial roots preserved. Fresh R7 above replaces this defective production
   artifact; no historical dirty-mark behavior was added to Rust.
   The old TS replay evidence verifies roots/events/outbox, not independent regeneration
   of the recorded touch list. Evidence: /tmp/xln-cross-j-parity-r6-20260905/
   recording-native-import.json.w1.diffs/first-divergence-h73.json and
   rust-h72-transport-complete-l1.log in the same directory.
   Evidence: /tmp/xln-cross-j-parity-r6-20260905/rust-w1-policy.log.stderr and
   ts-h44-diagnostic/section-comparison.json within the same evidence directory.
   Production r5 cross-swap plus full process replacement/recovery passed in 42.866 s;
   swap 627 ms, all Account/runtime pending work drained. Initial base remains immutable.
   Evidence: /tmp/xln-cross-j-wal-r5-20260905.log.
5. Quorum remains standalone in /Users/zigota/quorum. Record useful independent judgments,
   provenance and costs; paid review must resolve a concrete uncertainty, not displace work.
6. Full check exposed and resolved import cycles, two new lint violations and 14 GiB of
   disposable Rust incremental cache exceeding the test workspace budget. Newly added
   tests/helpers are grouped by their existing responsibility; folder-width now passes
   without increasing thresholds. Full-check r4 passed 15 contract invariant tests in
   8.23 seconds; a new parity test exceeded folder width and has since been grouped.
   Finish full check on the stable candidate after the current replay boundary works.
7. Company IPO/governance: actual Anvil RPC scenario passes 211 frames and exact recovery.
   One buyback moves 10 billion CONTROL against 1 trillion six-decimal USDT fixture units;
   eight bilateral asset copies verify the movement, with fee 0 under that fixture's policy.
   Four focused EDR Solidity tests pass: initial 100 billion supplies, old-board financial
   rejection and retained historical dispute authorization. Logs:
   /tmp/xln-company-ipo-20260905.log and /tmp/xln-company-governance-20260905.log.

## Historical overnight external-model authorization

The newer USD 10/hour instruction above supersedes this expired grant for prospective
work. The following records and unresolved billing remain historical evidence.

One cumulative **USD 100** budget for this overnight session, across every model, harness,
agent, retry, reasoning/output token and paid tool. It does not reset per wave or wakeup.
The reported USD 200 OpenRouter account balance is not extra authorization.
USD 1 remains an economical default wave target; the owner now permits autonomous
reallocation within the USD 100 session total. Future nights do not inherit another USD 100.

Owner-reported routes: Grok subscription, OpenCode Go, pi with OpenRouter, GLM 5.3
subscription, Cursor CLI and Claude. Verify actual installed version, exact model,
subscription/API billing route and available account access before dispatch. Prefer
confirmed subscriptions. Do not silently fall back to paid API billing.

The Quorum budget owner alone reserves and dispatches external calls. All other agents
request allocations through that owner. Use one shared reservation ledger; uncertain
bills remain reserved until reconciled. No independent per-agent spending counters.
Two controlled GLM 5.3 subscription requests: first timed out at 60 seconds, second
returned a final answer in 19.481 seconds after reducing the packet and effort. Actual
cost remains unknown; USD 0.50 stays reserved. The completed review contained an unsafe
boundary formula, which independent checking rejected. Do not invent a quality score
from one response. Other independently running harness costs are unknown; this ledger
is not a claim about total account usage or the Codex subscription. The BrainVault task
reports USD 0.288243 from three finished harness receipts (not billing-reconciled), plus
four Qwen calls with unknown cost. Its last pi/OpenRouter Qwen ended output_limit after
550.119 seconds without a final answer. No model calls remain active there. Reconcile
these receipts in the central ledger before allocating another paid review. Reconciliation
now preserves all seven BrainVault observations and fourteen source hashes. Receipts lack
provider generation IDs; aggregate account usage cannot establish this session's cost.
A USD 99.50 administrative hold plus the existing USD 0.50 reservations blocks new paid
calls. This is a conservative reservation, not a claim that USD 100 was spent. Evidence:
/Users/zigota/quorum/docs/budget-reconciliation.md.

At 03:38, an independent UI receipt reconciliation confirms USD 0.494164962 through
16 provider generation lookups. This is a partial billed subtotal, not the total
night spend. Two pi estimates were half the actual billed amount. Nine ZAI costs,
20 errored UI turns, one unfinished turn and previous BrainVault/GLM observations
remain unresolved. Keep the existing single hold unchanged. Evidence:
/Users/zigota/quorum/data/reconciliations/2026-09-05-ui-review.json.

## Final gates still required

Focused L1/L2, real UI/F12, synchronized contract artifacts and explicit bytecode/hash
review for Solidity changes, exact replay, live J, production and test Rust compilation,
transaction-kind coverage, bun run check and valid live TPS. Preserve unrelated changes;
stop concurrent writers and inspect the specific diff before commit or push on main.

### Owner-requested Claude audit — 2026-09-09 22:00 UTC

Scope: one read-only audit each of keys/unlock, payment state, and recovery/publication,
against 57b48293e8161513c39e0154d167b1968f9ed4a7. Authorization is this request only;
no retries or model substitution. Claude Code2.1.259, requested claude-fable-5-1,
effort high, Read/Grep/Glob only, immutable source snapshot in
/tmp/xln-audit-57b48293e. Auth status confirmed claude.ai Max subscription, first-party.
First invocation returned “out of usage credits”, modelUsage empty, reported cost0;
no audit was produced and the other two were not launched. No paid API route used.
Prepared packets and exact failure are in that directory. Quorum paid reservations unchanged.
