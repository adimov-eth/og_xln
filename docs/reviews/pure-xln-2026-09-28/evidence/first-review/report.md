**Review of pure/xln.ts — 28 September 2026**

The file is a substantial functional port with useful ADTs, explicit transition ownership, and credible sampled differential tests. The reviewed evidence does **not** establish full compatibility or make all illegal states impossible. The most valuable next changes concern failed validation being hidden or bypassed. Adding a broader functional abstraction would not address those problems.

No production source was edited. This report, ten individual reviews, and verification evidence are the deliverables. No commit, push, benchmark, or deployment was performed.

**Scope and evidence**

| Item | Observed result |
|---|---|
| Reviewed revision | `0d3a097b782b65b08358299fa0419e65498edc57`, initially clean |
| Source SHA-256 | `6c92501b4550f06af462fda8e10b9b47aab64a9de60e9e9a44b85d75a056346b`, unchanged after review |
| Main file | 47,878 lines; 2,892 function items; 1,328 exported items |
| Structural counts | 97 functions exceed 30 lines; longest is 88 lines; 595 `as` expressions; 1,182 `chain` calls |
| Independent reviewers | 10 requested lenses, each GPT-6-Sol with Medium reasoning |
| Selected semantic checks | **114 passed, 0 failed, 15,553 assertions**, five files |
| Pure project typecheck | Passed with local TypeScript **5.9.3** |
| Pure style gate | Passed all seven rules |
| Compiler counterexamples | Strict TypeScript fixture accepted malformed proposal import, mutable Map ownership, and missing generic tag payload |
| Repository check | **Failed:** missing `jurisdictions/lib/forge-std/src/*`; parallel siblings cancelled |
| Production replay / TPS / cost | Not measured or run in this review |

Counts come from ast-grep syntax, not semantic complexity scores. A cast count is not a count of defects. The review combines a complete structural map with bounded, targeted source inspection; nobody independently read all 47,878 lines. Agreement between reviewers is not additional test coverage.

The declared old-code baseline is `566c850`. `git diff 566c850 HEAD -- core jurisdictions` was empty. Existing tests therefore compare unchanged old implementation sources at this revision. The superseded first-wave `pure/findings/SUMMARY.md` was not used as current defect evidence.

**Priority findings independently checked by the primary reviewer**

| ID | Priority | Finding | Evidence and boundary |
|---|---|---|---|
| F1 | P1 | A failed J-history prune becomes the old history | Runtime accepted an inconsistent finalized/scanned history; original prune threw |
| F2 | P2 | Generic map import claims unvalidated proposal types | Compiler accepts input; runtime imports a string as `StoredProposal` |
| F3 | P2 | Held-frame retry trusts the claimed frame hash | Altered transaction body plus original signature is accepted; cached state remains unchanged |
| F4 | P2, ownership-dependent | Commitment memoization assumes immutable aliases | Fully typed mutable alias produces different cached and freshly projected roots |
| F5 | P3 | `foldResult` eagerly exhausts its iterable | Iterator consumed 3/3 values despite first callback refusal |
| F6 | P3 | `tag` permits an omitted required generic payload | Compiler says `signature: string`; runtime value is `undefined` |

P1/P2/P3 describe recommended engineering priority. F4 is a demonstrated public-API ownership failure; a canonical production alias escape was not demonstrated. None of these findings proves fund loss or a deployed exploit.

**F1 — propagate the J-history failure**

At [xln.ts:39020](/Users/adimov/XLN/og_xln/pure/xln.ts:39020), `replicaJHistory` does this:

```ts
return unwrapOr(pruneFinalizedJHistory(h, r.state.jFinality.height), () => h);
```

The prune rejects a finalized height greater than the scanned height at [xln.ts:36644](/Users/adimov/XLN/og_xln/pure/xln.ts:36644). The old implementation throws `J_HISTORY_LOCAL_PRUNE_HEIGHT_INVALID` at [local-history/index.ts:568](/Users/adimov/XLN/og_xln/core/jurisdiction/machine/local-history/index.ts:568). The wrapper discards that evidence. Both input context creation and committed-history maintenance consume this wrapper.

The reproduction used finalized height **2**, scanned height **1**. The old prune threw; the pure prune returned an error; `applyRuntime` returned success with the old history. This particular empty-input reproduction did not advance a frame. It proves a hidden invariant failure, not a corrupted committed frame.

Proposed shape, to be threaded through the two callers:

```ts
const replicaJHistory = (rt: Runtime, key: string, r: EntityReplica) =>
  pruneFinalizedJHistory(rt.replicaLocal.get(key)?.jHistory, r.state.jFinality.height);

// At each caller: chain the result before constructing context or committed locals.
// Preserve the failure code, finalized height, scanned height, and replica key.
```

Do not convert this consistency failure into a peer transaction rejection. Preserve the existing invariant/fail-stop classification at the Runtime boundary. Add one complete-state regression and compare its disposition with production before broader refactoring.

**F2 — decode map entries before granting their type**

At [xln.ts:13039](/Users/adimov/XLN/og_xln/pure/xln.ts:13039), `importMap<V>` proves only that a value is a `Map`, then casts all keys and values to the requested generic types. It is used for `nonces` and `proposals`. The exported `withOgSections` and `createEntity` import paths consequently accept malformed committed sections.

This compiles without a cast by the caller:

```ts
const imported = withOgSections(entity, {
  proposals: new Map([["id", "oops"]]),
});
if (imported.ok) {
  imported.value.proposals.get("id")?.votes.has("signer");
}
```

The runtime reproduction returned `accepted: true`, with a string proposal and no `votes`. Consumers such as `foldVote` and `votedTxs` trust those fields. The later vote transition was not executed by the primary reviewer; the admitted malformed state itself is proven.

Replace the two generic uses with field-specific decoders. Validate keys, complete proposal records, actions, vote values and containers, and nonce values. Preserve valid Map insertion order and existing wire forms. A sketch of the boundary is:

```ts
// Sketch: parseStoredProposal must prove the complete existing StoredProposal shape.
const importProposals = (value: Binary | undefined) => {
  if (value === undefined) return ok(new Map<string, StoredProposal>());
  if (!(value instanceof Map)) return err("a non-map proposals");
  return map(traverse(value, ([key, raw]) =>
    chain(parseProposalKey(key), (id) =>
      map(parseStoredProposal(raw), (proposal) => [id, proposal] as const))),
    (entries) => new Map(entries));
};
```

This is a proposed decoder shape, not an implemented or compiled patch. Avoid introducing another generic cast-based importer. Historical legal records need explicit positive vectors before tightening acceptance.

**F3 — verify duplicate bytes before taking the fast path**

At [xln.ts:10772](/Users/adimov/XLN/og_xln/pure/xln.ts:10772), `proposalOnReceived` compares only the supplied `stateHash` to the held candidate after receipt authentication. Receipt checks the signature over that supplied hash; it does not recompute the altered frame's hash.

A valid proposed credit-limit frame was received using the existing real-key fixture. The retry changed the limit from **7 to 999**, retained the original hash and Hanko, and returned success. Recomputing the hash independently detected the change. The held candidate stayed unchanged, so this is acceptance of conflicting evidence rather than application of the altered payment data.

Inside the retry branch, reuse existing validation before preserving the canonical candidate:

```ts
const valid = acceptFrame(input.frame, replicaId(r), other(ctx.party.left));
if (!valid.ok) return valid;
if (!sameHex(input.frameHanko, r.candidate.frameHanko))
  return err({ _tag: "ack_conflict", field: "frameHanko" });
// Keep the existing hash comparison and cached evidence after these checks.
```

The exact unchanged retry must remain idempotent. Cover changed body, changed hash, changed Hanko, and unchanged retry separately. Old production's committed-frame retry validation at [replay.ts:145](/Users/adimov/XLN/og_xln/core/account/consensus/incoming/replay.ts:145) supports the byte/certificate invariant; do not assume its committed phase and the pure held phase have identical ACK timing.

**F4 — make the cache's ownership requirement explicit and enforce it at admission**

At [xln.ts:8900](/Users/adimov/XLN/og_xln/pure/xln.ts:8900), `committedView` and preparation caches are keyed by `AccountBody` identity. `ReadonlyMap` prevents writes through one reference; it does not prevent writes through a retained mutable alias.

This fully typed reproduction demonstrated stale cached commitment data:

```ts
const original = genesisAB().state;
const deltas = new Map(original.account.deltas);
const body: AccountBody = { ...original, account: { ...original.account, deltas } };
const before = unwrap(committedRoot(body));
deltas.set(TOKEN, zeroDelta(TOKEN));
const cached = unwrap(committedRoot(body));
const fresh = unwrap(committedRoot({ ...body }));
// before === cached, but cached !== fresh
```

Observed prefixes: cached `0xd83f8740…`, fresh `0xe9e64906…`. This goes beyond a general TypeScript warning: the cache changes which content gets represented for the same current data, depending on object history.

First establish ownership at the actual decoded/imported-body boundary: copy externally owned containers and nested mutable values, keep builder references private, and publish owned readonly views. A shallow Map copy protects only the container, not mutable Delta objects inside it. `Object.freeze(map)` does not disable Map mutation. If ownership cannot be established, remove or redesign this identity cache with measured cost evidence; do not copy the whole graph on every transition as a speculative fix. No canonical production alias escape or performance tradeoff was measured here.

**F5 — choose and implement the iterable contract honestly**

At [xln.ts:43](/Users/adimov/XLN/og_xln/pure/xln.ts:43), `[...xs].reduce(...)` fully consumes the iterable before the first callback. The documented first-refusal behavior holds for callback invocation, but not for iterator production. A generator that throws on its second yield can throw before the first callback runs.

The reproduction recorded all three iterator values even though the first callback rejected. For normal array inputs this is not an observed protocol divergence.

If lazy consumption is intended, a local loop is the straightforward implementation:

```ts
let state = init;
let index = 0;
for (const x of xs) {
  const next = f(state, x, index++);
  if (!next.ok) return next;
  state = next.value;
}
return ok(state);
```

This changes iterator timing and requires a deliberate exception to `pure/style`'s no-loop/no-let rules. Alternatively, narrow/document the helper as an eager snapshot fold. Preserve array order, index values, first error, and collected outputs. Do not claim speed from this review. Also, this change alone would not make `everyResult` and `someResult` stop iterator consumption on a boolean answer: those wrappers encode it as success, not failure.

**F6 — remove the generic default that fabricates a payload**

At [xln.ts:21](/Users/adimov/XLN/og_xln/pure/xln.ts:21), `x: X = {} as X` permits callers to omit a payload whose explicitly supplied type has required fields:

```ts
const signed = tag("signed")<{ readonly signature: string }>();
const signature: string = signed.signature; // accepted by the compiler
// Runtime: { _tag: "signed" }; signature is undefined.
```

The primary strict compiler fixture accepted this, and the runtime confirmed it. No current production caller using this bad instantiation was found. It is a helper-contract hole relevant to the stated illegal-state goal, not evidence of a forged financial certificate.

Require the payload argument; existing payload-free callers can pass `{}`. Also keep ownership of `_tag` inside the constructor when defining the precise argument type. The successful runtime object shape need not change.

**What is already well solved in the inspected scope**

- `Result`, `map`, `chain`, `traverse`, and the strict/lenient folds provide a compact shared language. Handler errors and ordered outputs remain visible. The 114 selected tests include old encoder/root comparisons and real old handler/outbox comparisons.
- Proposed/received Account replicas require a candidate; Entity proposed/locked variants carry their phase data. `Cases` and `Handler` constrain handler definitions against transition tables. These are useful static guarantees even though callers still need validated inputs and ownership.
- The R → E → A ownership direction is recognizable. Runtime produces inert outputs; the pure module's lack of filesystem/network I/O is desirable. A shared financial base reducer would obscure different trust boundaries.
- The owned transient array in `mapAccumResult` is a good existing exception to surface-level immutability. It avoids repeated output-array copying while keeping its mutable reference private.
- Compatibility-sensitive details are documented: positional output order, Map insertion order, omission of absent fields, witness stripping, and exact rejection text. The Account validator's old-code check order is protocol behavior; its length does not justify deleting it.

“Perfectly solved” would overstate these checks. They are strong choices supported by inspected code and selected passing evidence.

**Higher-order forms worth considering**

Most useful higher-order vocabulary already exists. Prefer reusing it and removing dead surfaces before adding another layer.

| Candidate | Real uses / locations | Proposed form and preservation condition |
|---|---|---|
| Read-modify-write on one Map key | 8856, 26437, 39617, 40459 | Optional `mapModify`; invoke the callback once, preserve key identity, insertion order and fresh-map behavior |
| Independent writes into one Map | `withProgress` at 40458; existing `mapSetAll` at 256 | Reuse `mapSetAll` when each result depends only on the original map; retain sequential folds for dependent writes |
| Long dependent validation chains | Claim stamping at 9531; Hanko checks at 3661; cross fill at 46011 | Named local functions or early returns; keep first-refusal order; a new generic pipeline is unnecessary |
| Repeated optional-field inclusion | Existing `opt` at 24, widely reused | Retain it; do not replace omitted keys with explicit undefined on a hash-reachable value |
| Repeated field-specific decoding | Existing `fields`/`decodeFields`, J normalizers | Reuse decoding primitives for F2; keep domain validators responsible for authority |

One optional new helper has four concrete uses:

```ts
const mapModify = <K, V>(
  m: ReadonlyMap<K, V>, key: K, f: (old: V | undefined) => V,
): ReadonlyMap<K, V> => mapSet(m, key, f(m.get(key)));

// Before
mapSet(m, h.tokenId, addHold(m.get(h.tokenId) ?? NO_TOTALS, h));
// After
mapModify(m, h.tokenId, (old) => addHold(old ?? NO_TOTALS, h));
```

This removes repeated key spelling; it does not reduce full-map copy cost. Keep it only if the real call sites read better together.

For `withProgress`, repeated updates set the same timestamp and preserve the other original fields, so an existing helper can express the batch:

```ts
mapSetAll(local, outs.flatMap((o) => o.progressed === undefined ? [] : [
  [o.progressed, { ...(local.get(o.progressed) ?? {}), lastConsensusProgressAt: at }] as const,
]));
```

This is a proposed behavior-preserving shape, not an applied or benchmarked change. Do not apply this rewrite blindly to `withWitnesses`, failure accumulation, or other folds whose later writes depend on earlier writes.

**Small cuts and readability**

The two deletion reviews overlap. Their estimates of 38–47 and 75–95 lines are **not additive** and are not verified diffs. The clearest static candidates are unused kind-name arrays and fixture-shaped adapters (`encodeFrameHash`, `readJEventVector`), with unused helper islands as a second pass. Current repository consumer searches found none for the listed candidates; external consumers were not established.

Keep canonical encoders, authenticated evidence checks, and final transaction-kind completeness. Removing a redundant array must not remove the completeness check it was documenting. Moving unused vector adapters to a test adapter is an alternative if their external use is intentional.

The 47,878-line module is difficult to navigate despite mostly short functions. A later physical split could follow existing protocol sections and retain one implementation per operation. Do not split by line count, introduce a service for each helper, or add wrappers only to preserve a new folder scheme. Correctness fixes and their vectors should come first.

**Compatibility limits and review disagreements**

| Topic | Primary review decision |
|---|---|
| Full protocol compatibility | Unsupported as an unqualified claim. `scenario.test.ts:1–15` explicitly excludes WAL `frameHash` and checkpoint-frame `postStateHash`; transport ingress validation is outside the port |
| Pure module has no WAL/fsync host | A production integration/evidence gap, not a reason to introduce I/O into pure reducers |
| Optional recovery output rows | Existing test at `runtime-2.test.ts:425–434` proves rows are required when transport retirement occurs. Missing rows fail replay verification. Tighten the production entrypoint contract; do not call this a demonstrated silent-corruption bug |
| Malformed wallet lists accepted as empty | Adversarial observation is real, but old `event-normalizers-wallet.ts` has the same behavior. Rejecting them only in the rewrite breaks malformed-input parity. Treat as an explicit shared-policy decision |
| Subroot errors replaced with `ZERO_WORD` at 27007–27008 | Concerning fail-soft path. No legal transaction path to unencodable data was demonstrated. Track a corruption/admission vector; do not label it a proven remote exploit |
| Hash failures replaced by `canon` for merge keys | Simplify review identified real substitutions. Whether a malformed input reaches a divergent externally visible outcome remains unverified; trace old merge and rejection behavior first |
| `frameTxMessages` failure becomes `[]` | Real code shape, but no failure after a correctly admitted candidate was reproduced. Retain as a scoped investigation, not a confirmed dropped-output defect |
| Disputed/CrossRoute optional fields | Do not force mutually exclusive states without proving legal historical combinations. A finalized disputed account may legitimately have no active witness |
| Refresh marker issued fields | Promising erased union refinement; verify persisted markers and all producers first. Preserve the existing reason/field bytes |
| Native Map mutation proposals | Potential owned-builder technique; not a verified line or speed saving and conflicts with current style rules unless deliberately exempted |

The critic also found that one randomized leaf test skips settlement-workspace cases and one dispute-text test normalizes a hash because the fixtures differ. Other tests cover related surfaces, so these observations narrow particular assertions; they do not invalidate the entire suite.

The architecture review labels some missing production evidence P1. This synthesis treats those as claim/integration limits, distinct from F1's demonstrated semantic failure. The critic's possible missing ACK on a held retry is unproven and separate from F3's demonstrated changed-byte acceptance.

**Every requested reviewer**

| Lens | Full report | Main contribution |
|---|---|---|
| Evidence-driven type hardening | [Type hardening](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/agents/type-hardening.md) | Unsafe map import; ownership and premature-brand limits; avoids speculative lifecycle tightening |
| Ponytail audit, xln.ts only | [Ponytail](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/agents/ponytail-audit.md) | Ranked deletion candidates and bounded copy simplifications |
| Review-agent | [Defect review](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/agents/defect-review.md) | Held-frame retry evidence check |
| code-simplifier plugin | [Code simplifier](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/agents/code-simplifier.md) | Fold contract, dependent-chain readability, narrow Map helper |
| Senior solution architect | [Architecture](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/agents/architecture.md) | J prune failure, pure/host distinction, recovery evidence contract |
| Overbuild review | [Overbuild](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/agents/overbuild.md) | Unused catalogs, adapters and helper islands; no new framework |
| Critic field | [Critic](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/agents/critic.md) | Strongest defense of sampled parity and exact limits of the broader claim |
| Creative field | [Creative](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/agents/creative.md) | Locally owned mutation as a pure implementation technique; rejects speculative abstractions |
| Adversarial field | [Adversarial](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/agents/adversarial.md) | Wallet normalizer and subroot fallbacks, with reachability limits |
| Simplify field | [Simplify](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/agents/simplify.md) | Refresh-marker refinement and specific failure-erasing surfaces |

Individual reports preserve each reviewer's scope and uncertainty; recommendations are subject to the adjudication above. The type-hardening reviewer reports a TypeScript 6.0.2 run without a retained version transcript. The primary reproduction and project check used independently verified **5.9.3**, and that is the compiler evidence relied on here. The critic's isolated “43k” wording is stale; the measured file length is 47,878.

The primary review applied refactoring, pure-ts, code-discipline, modern-fp, and orchestrator guidance. The explicitly requested parallel execution was already authorized. The orchestrator's discovery skill was not installed; the actual installed skills, plugin agent, tools and filesystem were inspected directly. The code-simplifier agent definition was available locally. The configured `ast-grep-server` launcher was absent, but a working local ast-grep MCP implementation was found and used over stdio.

**Reproducible verification record**

| Command / artifact | Result |
|---|---|
| `bun test pure/diff/hashes.test.ts pure/diff/account-consensus.test.ts` | 79 passed, 6,687 assertions; [log](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/evidence/focused-tests-installed.log) |
| `bun run stand:run --reason xln-review-semantic-vectors -- bun test pure/diff/runtime-2.test.ts pure/diff/final-sweep.test.ts pure/diff/entity-consensus-2.test.ts` | 35 passed, 8,866 assertions, stand held; [log](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/evidence/integration-tests.log) |
| `bun node_modules/typescript/bin/tsc -p pure/tsconfig.json` | Exit 0; [log](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/evidence/pure-typecheck.log) |
| `bun style/check.ts` from `pure/` | Seven gates pass; [log](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/evidence/style.log) |
| `bun /tmp/xln-review-20260928/repros.ts` | F1, F3, F5 assertions reproduced; [source](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/evidence/repros.ts.txt), [log](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/evidence/repros.log) |
| Malformed-map reproduction | Accepted string as proposal; [log](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/evidence/importmap-repro.log) |
| Strict type fixture plus runtime | F2, F4, F6 compile; F4 and F6 runtime observations; [source](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/evidence/type-proof.ts.txt), [config](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/evidence/tsconfig.json.txt), [compiler log](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/evidence/type-proof.log), [runtime log](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/evidence/cache-repro.log) |
| `bun run check` | Exit 1: missing Forge standard-library sources; [full log](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/evidence/check-installed.log) |
| ast-grep MCP | `dump_syntax_tree`, `test_match_code_rule`, `find_code_by_rule`, `find_code` succeeded; fallback query returned 24 sites; [log](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/evidence/ast-mcp.log), [raw results](/Users/adimov/XLN/og_xln/docs/reviews/pure-xln-2026-09-28/evidence/ast-mcp.json) |

Initial tests/check could not load dependencies. Root and pure locked dependencies were installed with `--frozen-lockfile --ignore-scripts`; manifests and lockfiles remained unchanged. Only then were the affected checks rerun. The full repository gate's sibling SIGTERMs are cancellations following its contract-invariant failure, not evidence of independent defects in all named siblings. Contract artifact sync completed without tracked artifact changes. No frozen-core approval or bypass was used.

All commands had bounded wall times; the semantic integration run held the stand lock. Its measured test duration is not TPS or a performance result. Evidence assembly copied completed artifacts and did not rerun expensive verification. The source digest was independently rechecked after report assembly.

**Recommended next sequence**

1. Fix F1 with its smallest complete-state regression, then compare the original failure disposition.
2. Address F2 and F3 separately, preserving valid imported bytes and exact duplicate behavior. Give each a named negative vector and unchanged positive control.
3. Establish actual boundary ownership for F4. Resolve F5's eager/lazy contract and F6's constructor argument without bundling unrelated protocol changes.
4. With those boundaries green, take the small dead-surface cuts and only the higher-order changes that improve real call sites. Keep compatibility evidence attached to each change.
5. Before claiming production replacement, compare the currently excluded WAL/checkpoint bytes, verify persisted recovery/outbox behavior through the intended host, and rerun the repository gate in a complete environment.

NEXT: A) J-history fail-stop regression. B) Proposal import and duplicate-evidence fixes. C) Ownership, readability and exact compatibility gates.
