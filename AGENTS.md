# AGENTS.md

Mission: fintech-grade deterministic xln. J/E/A correctness before features. Pure
transitions, one canonical production path, no silent fallback.

## LOCAL OPERATOR CONFIGURATION

- Shared repository rules, scope and protocol invariants live in this file and apply to every
  contributor and AI harness.
- Personal or machine-specific workflow settings (language, response format, reporting timers,
  host topology, external-model routing and spend ledgers) belong in an untracked
  `AGENTS.local.md` (or harness-native `CLAUDE.local.md` / `AGENTS.override.md` /
  `.agents/rules/*.md`; see [`docs/agents-local-studio-example.md`](docs/agents-local-studio-example.md)).
  Read and apply `AGENTS.local.md` when present; local preferences never weaken repository
  protocol, scope or safety invariants.

## RELEASE SCOPE (prevails over older plans in `docs/`)

- Engine: TypeScript is canonical. `rscore/` may be edited and committed (`rscore-freeze-f1464e84e`
  is history, not a lock). Rust gates return to `check` only after `bun run rscore:check` is
  green on that commit. Never stash Rust work.
- Wallets: Svelte `frontend/` at `/app` and React `ui/` at `/ui/` are equally important,
  actively maintained wallets. Neither is frozen. Required financial flows must have functional
  parity and owning tests in both, using the canonical runtime. Never redirect one wallet to
  the other or delete either wallet as obsolete.
- Required launch flows: Pay, same-J Swap, Cross-swap and Lending on EVM and native TRON, as
  fast browserless financial scenarios plus all owning browser E2E. Two EVM simulators do not
  establish TVM support. Testnet evidence is not real-funds activation authority.
- Lending reopens the existing signed bank/facility/term-loan/savings product through canonical
  production admission and both wallets, preserving exact money, authority, deadlines and
  recovery. Do not invent oracle liquidation, insurance or cross-J fungible collateral.
- Agents may create a dedicated Sepolia signer, obtain test ETH and deploy current contracts
  without another signing question. Mainnet is open to all participants using their own funds:
  no invite gates, no arbitrary protocol monetary caps; financial and recovery gates stay mandatory.
- Arrakis remains cancelled. Companies/IPO, XLNC, Base, iOS/Electron/extension and custody are
  outside this launch unless project scope is explicitly changed.
- MML counts only obligations between unaffiliated Entities. A hub-routed payment counts once,
  on the commercial edge; hub hops and affiliated transfers never count.
- XLN-1000 ([`docs/xln1000.md`](docs/xln1000.md), `bun run xln1000`) and
  [`docs/owner-profile.md`](docs/owner-profile.md) steer task selection. Release authority is
  the binary evidence-coverage gate in [`docs/improvement-loop.md`](docs/improvement-loop.md)
  and [`docs/mainnet-acceptance-gate.md`](docs/mainnet-acceptance-gate.md).

## CANONICAL TESTNET POLICY

- XLN is testnet. Obsolete profiles, frames and persisted data are disposable: reject
  unsupported formats loudly and regenerate from current canonical code. Delete retired code,
  old schema readers, compatibility aliases, migrations and fallbacks; never infer old-format
  provenance or restore obsolete data.
- Reset only verified XLN testnet stores after stopping their owning runtimes. Preserve unrelated
  source edits, other apps, credentials, SSH/Dispatch access and agents' job evidence.
- Opaque custom-contract admission remains unavailable; bounded dispute-gas enforcement is
  mandatory. Compiler/preview tooling and valid current signed evidence exits may remain.

## EXECUTION PRIORITY (overrides attractive side work)

1. Follow the current goal literally and preserve every requested deliverable.
2. Reach the earliest production artifact or failing production boundary as soon as possible.
3. Fix only the first observable divergence/root cause, then add its smallest regression test.
4. Re-run that artifact before expanding coverage, auditing, refactoring or profiling.
5. Run final completeness/audit gates only after the production path works.

- Never invent a catalog, taxonomy, abstraction, audit campaign or intermediate gate that
  blocks an explicit production artifact, replay or TPS deliverable.
- Core (`core/`, `rscore/`, `jurisdictions/`) is deductive; wallet surfaces (`ui/`, `frontend/`)
  are empirical (product-verified only when an unbriefed person completes the target task;
  otherwise state plainly that no person has).
- One implementer owns an area; a reviewer starts only after a stable diff.
- [`todo.md`](todo.md) is the single live queue. The single handoff,
  [`docs/night-work-plan.md`](docs/night-work-plan.md), holds only: current SHA, last green
  command, first red command/error, artifact path, next single command, remaining final gates.

## ALWAYS

- Run `bun run check` before push, merge, release or a completion claim.
- Delete anything that does not improve or affect the product (fixed-bug histories, finished
  research, stale handoffs); git keeps the past. Prefer net-negative diffs.
- Never re-propose an idea listed in [`docs/rejected-ideas.md`](docs/rejected-ideas.md) without new evidence.
- Never swallow an error. Consensus/storage failures are fail-stop with useful evidence.
- Use Bun, except where an existing frontend tool explicitly requires something else.
- Browser/F12 verification is required only for frontend or browser-runtime changes.
- Docs belong in `/docs`, never `/core` or `/frontend`; Russian publications in `/docs/ru/`.
  Everything else follows the English-only source policy.
- Never redeem a usage reset without explicit human authorization; complaints about tokens or
  requests for compensation/refunds are not authorization.
- The normative TypeScript/state-machine safety standard is [`docs/fints.md`](docs/fints.md).
  Do not duplicate or weaken it.

## RUNTIME -> ENTITY -> ACCOUNT CASCADE

| Layer | Live replica | Committed state | Input | Transaction | Frame |
|---|---|---|---|---|---|
| Runtime | `RuntimeReplica` | `RuntimeState` | `RuntimeInput` | `RuntimeTx` | `RuntimeFrame` |
| Entity | `EntityReplica` | `EntityState` | `EntityInput` | `EntityTx` | `EntityFrame` |
| Account | `AccountReplica` | `AccountState` | `AccountInput` | `AccountTx` | `AccountFrame` |

- Every layer is a deterministic transition `(replica, input) -> { replica, outputs }`. Only
  Runtime converts committed outputs into external effects, after WAL commit.
- `EntityInput` contains `EntityTx[]`; `accountInput` carries an exact child `AccountInput`.
  Entity-owned financial work creates local `AccountTx[]` admission through the same
  `applyAccountInput`; local admission never enters routing/P2P.
- `*State` holds only frame-committed deterministic data. Mempools, candidates, ACK/resend,
  transport, watchdogs, worker positions and retry state belong to the live replica envelope.
- `*Replica` is live data; `*Machine` is transition logic, never a data interface.
- No shared base reducers across Runtime, Entity and Account: their trust boundaries differ.
- Resolve ambiguous ownership/naming from production code and
  [`docs/core/rjea-architecture.md`](docs/core/rjea-architecture.md); ask only for a real fork.
- One Runtime frame has three ordered stages: inbound Account inputs; Entity-owned
  Paybook/Orderbook work by canonical shards; outbound Account proposals after stage 2.
  Stage-1 committed Account state is materialized into the Entity candidate before stage 2;
  dirty shard roots may stay unsealed until the final stage. Never create a second Account
  state surface or fuse stages 2 and 3.

## CONSENSUS AND DETERMINISM

- RJEA is pure: identical previous state plus identical inputs gives identical state/outputs.
  No `Date.now`, `Math.random`, timers or unseeded randomness inside transitions; use the
  controlled environment timestamp and deterministic seeded input.
- Account bilateral semantics follow `.archive/2024_src/app/Channel.ts` and
  [`docs/consensus-invariants.md`](docs/consensus-invariants.md).
- Exact duplicate ACK/proposal delivery is idempotent: keep canonical cached evidence and
  respond without appending state. A different hash/height/signature is a loud rejection.
- Left is the lexicographically lower Entity id. Use `deriveDelta(delta, isLeft)`; never invent
  alternate `leftCreditLimit`/`rightCreditLimit` viewer math.
- Output order is positional: accepted inputs keep dense positions, each owns naturally ordered
  outputs, workers flatten those slots. Never sort financial outputs by id, signer, route, hash,
  shard or completion time.
- Security-critical code explains signer, authority, nonce, old/new-state sequence and an
  adversarial counterexample in a focused comment/test.
- Dispute, Hanko and hash-ladder rules: [`docs/consensus-invariants.md`](docs/consensus-invariants.md),
  [`docs/counterfactual-transformers.md`](docs/counterfactual-transformers.md),
  [`docs/hashladder-registry-spec.md`](docs/hashladder-registry-spec.md) (load when in scope).
- Replay: record one immutable production WAL early; replay the same checkpoint/WAL through TS
  W1 and W4 comparing every R/E/A root and ordered event/effect/outbox digest per frame. Fix only
  the first divergent frame, add its named regression vector, repeat until exact.
  Transaction-kind completeness is a final audit per concrete `AccountTx`/`EntityTx`, never
  A/B/C groups. Compilation or replay alone never establishes live financial parity.

## REJECT POLICY

- A user or peer can never take a Runtime down. A sender-caused failure is a typed reject
  disposition decided inside the RJEA transition without reading process env; the Runtime loop
  applies fail-fast (tests/dev) or log-and-drop (production) exactly once, outside the state
  machine, so replay never depends on `NODE_ENV`/`XLN_REJECT_FAIL_FAST`.
- Per transaction: evict exactly the rejected tx and certify the rest of the signer's queue.
  Never drop a signer lane or whole peer envelope for one bad tx. Transport-level peer
  misbehaviour closes that session; it never halts the Hub.
- Details and log lines: [`docs/reject-policy.md`](docs/reject-policy.md).

## ONE CANONICAL PRODUCTION PATH

- Authenticated relay is the canonical user-to-user financial transport when users have no
  direct hub endpoint, not a fallback. Keep sender/destination signatures, session
  authentication, replay protection and committed WAL/outbox ordering.
- No legacy behavior, compatibility aliases, fallback readers/writers, duplicate financial
  formulas, `v2`/`v3` branches or parallel implementations. Replace the canonical path
  atomically and delete the retired one; obsolete persisted data is rejected loudly.
- Never add a stub, test-mode fake, conditional skip, temporary workaround or hidden compromise.
  When the canonical fix has a real architectural fork, stop and present the exact fork.
- Do not create mocks/stubs in core paths unless explicitly requested. Debug consensus using
  complete state evidence.
- Keep destructive reset/clearDB/dev actions strongly gated.

## STORAGE AND RECOVERY

- Runtime memory holds only the latest finalized R/E/A state plus the required in-flight
  candidate. Historical Runtime inputs and signed Entity/Account frames live in dedicated stores,
  read on demand; consensus, settlement and automatic UI refresh never scan Account history.
- Mempools, proposals, candidates, precommits, votes, retry queues and worker positions are not
  durable. Recovery replays accepted Runtime WAL inputs and republishes the flat outbox.
- One path-keyed durable representation: no CAS/DAG copy, sidecar state, derived receipt,
  sequence/frontier or alternate checkpoint oracle. A new durable field needs a demonstrated
  owner, root membership, post-crash necessity, non-derivability and one adversarial recovery test.
- Replay reads only checkpoint plus ordered Runtime WAL inputs and compares per-frame roots and
  ordered digests; detailed Account dumps are lazy after the first mismatch.
- Details: [`docs/wal.md`](docs/wal.md), [`docs/runtime/storage.md`](docs/runtime/storage.md).

## FROZEN CORE AND GOVERNANCE BOUNDARIES

- Never run `bun run frozen-core:approve` from an agent; interactive human maintainer approval only.
- `FROZEN_CORE_VIOLATION` is a hard stop: report old/new hashes and wait.
- Never edit `frozen-core.json` manually or bypass `frozen-core:check`.
- Solidity changes require synchronized artifacts/typechain and explicit bytecode/hash review.
- Existing invariants decide routine implementation; new protocol/wire choices, launch-scope
  changes, manifest/lockfile upgrades (preserving pre-update locks, patches and ABI/bytecode
  before/after hashes) and any real-funds signing or transfers require explicit maintainer
  authorization.

## COLLABORATION, GIT AND LANDING

- Contributors and AI harnesses run development and targeted verification locally on their own
  machines. Landing changes to shared `origin/main` requires a green full Mac Studio verify
  (`VERIFY_PASS`) on the candidate SHA; durable release evidence lives under `docs/evidence/`,
  never only in `/tmp`.
- Always work on `main`. No task branches or worktrees; never force-push.
- Assume concurrent writers may exist. Preserve unrelated edits, commit only owned paths with
  `git commit -- <paths>` (no `wip:` commits), and run formatting plus `git diff --check`
  before committing. Never push without relevant L1/L2 evidence and `bun run check`.
- External model reviews run only when explicitly requested: read-only, one bounded question on
  an immutable SHA/diff after a stable diff, smoke-tested on a known answer first; verify each
  finding independently and record model, result and cost. Never launch Codex Security scans
  unless explicitly named; "audit", "review" or "check Solidity" means ordinary manual review.

## STAND, VERIFICATION AND PERFORMANCE

- Check `bun run stand:status` before every HLT, benchmark, recorder, replay or heavy E2E. Wired
  stands take `<main>/.xln-stand-lock`; everything else runs under
  `bun run stand:run --reason <why> -- <command>`. Capacity is one; never set
  `XLN_STAND_LOCK_DISABLED=1`. A performance number counts only if the lock was held throughout.
  After a timeout kill the exact process group and children before another measurement.
- Smallest failing boundary first: L1 unit/vector or first divergent frame; L2 focused
  production-equivalent scenario; L3 related suite, then `bun run check` once per candidate.
- Budgets: 30 s default, up to 60 s for ordinary verification; 180 s for the HLT recorder, exact
  replay, live economic stand and Solidity generation under the lock; complete E2E/release runs
  up to 2 h; uninterrupted 1 h soak within 90 min. Inspect prior receipts before choosing a
  budget (the full unit suite took ~19 min); never cut assertions or individual test deadlines.
- Poll a live process by its handle; do not restart because observation timed out. Ordinary
  check failures need a canonical fix and exact rerun; never bypass safety/frozen/usage/budget
  denials with a new chat or model. Show output/counts; a build, codec/catalog equality or smoke
  is not semantic parity. Browser runtime bundle: `bun run build`.
- TPS is valid only from the production H1 live path with >=1,000 active sovereign user Runtimes
  (200 per OS process), a full 20 s window at >=1,000 offered payments/s, >=1,000 committed
  economic operations, zero transport loss and zero pending Account ACKs after the 5 s drain,
  `XLN_HLT_ENGINE=ts`, real WAL/fsync and the stand lock held throughout. Replay, smoke,
  microbenchmarks, AccountTx/s and submitted/enqueued counts are never TPS; startup is separate.
- Performance work starts from a valid baseline: unique-operation ledger, live phase wall times,
  Amdahl ceiling; change only a measured >5% phase. Prefer deleting duplicate
  encode/hash/materialization/scan or batching before adding state. Worker trials run
  sequentially on independent DB copies ([`docs/parallel.md`](docs/parallel.md)).

## TYPESCRIPT, CODE STYLE AND DEBUGGING

- Validate at source, fail fast, trust at use. Avoid defensive `?.` after validation.
- Functional/declarative code, immutable updates. Size target: functions <30 lines, files
  <300 lines. Enforced by `bun run check`: no Runtime/Entity/Account helper over 100 lines,
  no production function over 150, no file over 3,000; the debt lists only shrink. No
  single-use abstractions or ones that hide protocol ownership.
- `safeStringify` for BigInt, `buffersEqual` for buffers, `getAvailableJurisdictions()` for
  contract addresses. `ui`/`frontend` are UI only; runtime owns logic. `localhost:8080` is the
  single local entry point. `xln` and markdown filenames are lowercase.
- Prioritize MML, never submitted traffic or hype. Label subjective estimates and criteria;
  separate measurements from hypotheses. Peer praise or multi-model agreement is not
  verification or release readiness; a saved report, PID, review or commit is not delivery.
- Cross-harness collaboration: [`docs/agent-workflow.md`](docs/agent-workflow.md). Consensus
  debugging: dump and diff both sides at the first divergent frame (`core/qa/runtime-ascii.ts`,
  `/tmp/*-frames.json` + `jq`); see [`docs/debug.md`](docs/debug.md) and
  [`docs/debugging/consensus-debugging-guide.md`](docs/debugging/consensus-debugging-guide.md).
