**Review of pure/xln.ts — corrected after the second audit**

My first report overstated its strongest findings. I reproduced suspicious local behavior, then gave it more weight than the surrounding protocol justified. The second audit changes the recommended priorities substantially.

I withdraw the **P1 J-history fix-first recommendation** and downgrade the **P2 held-frame retry finding to a standalone API edge case**. Both have downstream handling that the first review missed. The import and `tag` type holes remain real. The cache counterexample requires caller mutation; the fold observation concerns its iterable contract. None of the six findings establishes financial-state corruption through the normal Runtime path.

The code has substantial, useful functional structure. My main concern is the distance between a check, the authority it grants, and the caller that completes the operation. That distance caused concrete mistakes in this review. More generic composition would not necessarily help. Better boundary contracts and a few small, explicit corrections would.

No production source was changed. This document supersedes the [first report](evidence/first-review/report.md). All ten original reviewer texts are preserved under `evidence/first-review/agents`; the current reviewer files below carry primary-review corrections.

**What survived the second pass**

| Claim                                                      | Second-pass result                                                                                                                                            | Disposition                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| F1: the hidden J-history failure warrants a P1 Runtime fix | A committing input preserves the error in Runtime `rejected`; Entity head stays at 0. Runtime advances to record the rejected input                           | Withdraw the P1 fix-first recommendation; the committing path retains the failure |
| F2: proposal import grants an unproved type                | Malformed map compiles, imports, and throws during a later vote. Observed adapter caller is a differential test; Runtime genesis supplies empty proposal maps | Retain API contract defect; production ingress/persistence exposure unproven      |
| F3: altered held-frame retry is accepted                   | Isolated `ReceivedAccount` returns the same replica and no outputs. Normal Entity handling acknowledges the first frame, then rejects the altered retry       | Retain narrow Account-API inconsistency; no production bypass demonstrated        |
| F4: memoization becomes stale                              | Confirmed after mutation through a caller-retained Map alias; unchanged data gives consistent roots                                                           | Retain ownership precondition; no production alias escape established             |
| F5: fold does not stop visiting the iterable               | It consumes all iterator values, but correctly stops invoking the callback after the first error                                                              | Clarify eager snapshot versus lazy iteration; no observed protocol divergence     |
| F6: `tag` can fabricate a required payload                 | Strict compiler accepts missing payload; runtime has no signature. A payload can also overwrite `_tag`                                                        | Retain concrete generic-helper contract hole                                      |
| Native `mapDelete` is a compatible simplification          | False for `NaN`: existing helper retains the key, native deletion removes it                                                                                  | Reject as an unconditional behavior-preserving rewrite                            |
| 114 passing tests establish broad parity                   | Counts are correct; one passing test explicitly asserts a divergence and several compare projections                                                          | Report test contracts, not pass count as parity coverage                          |

**F1 — the existing commit guard matters**

The fallback at [39023](../../../pure/xln.ts#L39023) returns old history when pruning fails. But [afterCommit](../../../pure/xln.ts#L28249) repeats the prune and propagates the error, and [applyEntityInput](../../../pure/xln.ts#L29075) runs it whenever the Entity head advances.

The second probe used finalized height 2, scanned height 1, and a real signed chat transaction. Without the inconsistent local history, Entity head advanced to 1. With it, Runtime returned success with `advanced: true`, Entity head remained 0, and `rejected` contained `J_PREFIX_INVALID`, message `J_HISTORY_LOCAL_PRUNE_HEIGHT_INVALID:2:1`, disposition `reject`.

The early context wrapper does discard the prune error locally. The committing path rechecks the same condition, records the error and prevents the Entity commit. My initial probe used empty input and never attempted a commit; the first report acknowledged that limit but still assigned P1 and recommended a fix before tracing this later guard. That priority was not justified.

A rejection-versus-fatal-failure question remains: the old commit helper throws, while this pure Runtime records a typed rejection. I did not run the same complete state through the original Runtime, so I cannot claim a full-boundary disposition mismatch. Changing `entityContextFor` to fail earlier, as initially recommended, could change idle/admission behavior. **Do not apply that patch based on the original report.**

**F2 — an importer promises more than it proves**

At [13039](../../../pure/xln.ts#L13039), `importMap<V>` checks `instanceof Map`, then asserts arbitrary key/value types. This is a real contract defect:

```ts
const imported = withOgSections(entity, {
  proposals: new Map([['id', 'oops']]),
}); // accepted as Result<EntityState, EntityError>
```

The second probe followed this with a `yes` vote through `applyEntityInput`; it threw a `TypeError` while spreading the missing votes container. The first report had only inferred downstream failure.

However, “unchecked persisted ingress” was too specific. The observed `withOgSections` use is [pure/diff/og-state.ts](../../../pure/diff/og-state.ts#L17). The in-module Runtime [genesis importer](../../../pure/xln.ts#L30366) passes internally constructed empty proposal/nonces maps. No untrusted persisted record reaching this function through the intended host was demonstrated.

If this API decodes legacy/untrusted records, validate keys and complete proposal/vote records before returning `EntityState`. If it is a trusted test/import adapter, require a trusted typed input and keep it out of untrusted decoding. Do not introduce a large decoder without settling that boundary. Preserve valid Map order and stored representations; malformed-input acceptance still needs a deliberate contract.

Example of the intended validation boundary, **not a compiled patch**:

```ts
// Complete entry validation must precede construction of the trusted Map.
return map(traverse(entries, parseStoredProposalEntry), pairs => new Map(pairs));
```

**F3 — the isolated phase and the Entity transaction differ**

[proposalOnReceived](../../../pure/xln.ts#L10772) authenticates the supplied hash and accepts a matching claimed hash without recomputing the body. The real-key probe changed credit limit 7 to 999 while retaining the original hash/signature. It returned the exact same held replica and an empty output array. No altered financial data was applied.

The stronger probe delivered the original proposal through `applyEntityInput`. Its Account immediately became `open`, head 1. The altered retry then returned `frame_hash_mismatch`. [signReceived](../../../pure/xln.ts#L26128) and [answerFrame](../../../pure/xln.ts#L18726) explain this: the Entity answers and installs a received frame within the transaction. The committed duplicate path already revalidates it.

For deliberate standalone Account callers, a stricter held-retry guard could be justified:

```ts
// Inside the held-retry branch, before returning the cached replica:
const valid = acceptFrame(input.frame, replicaId(r), other(ctx.party.left));
if (!valid.ok) return valid;
```

That is a proposed API behavior change, not a demonstrated production repair. The original proposal also added Hanko equality; its exact phase contract and error precedence were not validated. Preserve the unchanged retry as a positive control. The old committed-frame handler is not an equivalent held phase, so it cannot alone establish compatibility for this change.

**F4 — purity depends on ownership**

The identity cache at [8900](../../../pure/xln.ts#L8900) assumes an Account body and its reachable data remain unchanged. A mutable Map is assignable to `ReadonlyMap`, so a caller can violate that assumption without a cast:

```ts
const deltas = new Map(original.account.deltas);
const body: AccountBody = { ...original, account: { ...original.account, deltas } };
const before = unwrap(committedRoot(body));
deltas.set(TOKEN, zeroDelta(TOKEN));
const cached = unwrap(committedRoot(body));
const fresh = unwrap(committedRoot({ ...body }));
// before === cached; cached !== fresh
```

The second probe confirms this and equality before mutation. Cached root starts `0xd83f8740`; fresh projection after mutation starts `0xe9e64906`.

This demonstrates an unenforced ownership precondition. It does not show normal reducers mutate inputs or leak a builder alias. My original “public-API ownership failure” label treated violation of a possible caller contract as an implementation bug without establishing that contract.

Document and test ownership at real admission/decoding boundaries. Copy externally retained containers if that boundary must accept them; a Map copy alone does not isolate mutable values inside it. `Object.freeze(map)` does not prevent Map mutation. **Do not remove memoization or deep-copy every transition on this evidence.** No relevant cost or production alias path was measured.

**F5 and F6 — small helper contracts, with different answers**

[foldResult](../../../pure/xln.ts#L43) eagerly snapshots its iterable. The probe recorded iterator reads `[1, 2, 3]`, callback calls `[1]`; an iterator throwing on its second yield threw before any callback. The callback's first-error contract works.

I would first describe the current behavior accurately: “Snapshots the iterable, then folds in order; callbacks stop at the first refusal.” A lazy `for...of` changes iterator timing, closing, and behavior if callbacks mutate the source collection. It also needs a no-loop/no-let style exception. It is not automatically a compatible cleanup. `everyResult`/`someResult` would still need their own stopping mechanism for boolean answers.

[tag](../../../pure/xln.ts#L21) has a more direct problem:

```ts
const signed = tag('signed')<{ readonly signature: string }>();
const signature: string = signed.signature; // actually undefined
const changed = tag('expected')({ _tag: 'unexpected' });
const claimed: 'expected' = changed._tag; // actually "unexpected"
```

Both compile under strict project settings. Require the payload argument when its type requires fields, and reserve `_tag` for the constructor. The simplest internal API uses a required payload, with `{}` for empty variants; checked overloads could retain empty zero-argument variants. Preserve object field order if changing construction. No bad production caller was established, but these are concrete holes in a helper intended to construct trustworthy tags.

**What survives the positive review**

- `Result` requires its branch payload. Proposed Account replicas require a branded candidate; handler types reject a wrong destination phase. Three negative compiler checks verified those specific guarantees. They do not enforce exact objects, deep ownership or external-byte validation.
- `mapAccumResult` privately owns its transient array and publishes it after construction. An ordered-output probe also passed. There is no need to remove this design for aesthetic purity.
- The inspected R → E → A cascade keeps child work inside its Entity and returns inert Runtime outputs. Static inspection supports no direct clock/network/filesystem calls in the machine; transitive purity was not exhaustively proved.
- Differential tests compare real old encoders, roots, handlers and outbox representations on selected cases. Comments protecting check order, field omission and positional outputs are valuable. Exact rejection behavior is part of compatibility.

**Higher-order extraction and deletion**

The vocabulary is already extensive. I do not think this file needs another general functional framework.

| Candidate                                   | Verdict                                                                                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mapModify`: 8856, 26437, 39617, 40459      | Four real read-modify-write shapes. Optional readability helper; no reduction in map copies                                                          |
| `mapSetAll` for `withProgress`: 40458       | Plausible reuse: repeated keys get the same timestamp and preserve original other fields. Does not generalize to dependent witness/history updates   |
| Early returns in `stampClaim`: 9531         | Credible readability option if authority/witness/error order remains exact. Proposed patch was not compiled                                          |
| Existing `opt`, `fields`, `decodeFields`    | Reuse where contracts fit. Preserve omitted fields on hash-reachable objects                                                                         |
| Unused catalogs, aliases and helper islands | Named candidates have no observed repository TS consumers. Export deletion still changes an API; no external-consumer proof or deletion patch exists |
| Native Map builders                         | Need ownership and style-rule consideration. No measured speed benefit. Generic `mapDelete` replacement is false for `NaN`                           |

```ts
const mapModify = <K, V>(m: ReadonlyMap<K, V>, k: K, f: (v: V | undefined) => V) => mapSet(m, k, f(m.get(k)));
```

The deletion reviews' 38–47 / 75–95 line estimates and “31 unused exports” aggregate lack a complete independently reproduced list/diff. They are not measured results. Named candidates were rechecked. `readJEvents` is not a drop-in replacement for JSON-shaped `readJEventVector`; a Result-returning encoder is not identical to a throwing adapter. Delete unused adapters where appropriate without pretending their contracts are identical.

A later physical split along protocol ownership could improve navigation. That is my judgment, not a tested fix. The missed post-commit guard is a concrete reason to make call completion easier to see. Arbitrary line limits or a shared reducer would not solve that problem.

**Remaining observations and limits**

| Observation                                      | Established / unestablished                                                                                                                                                      |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wallet non-array lists normalize as empty        | Both old and pure code do it. Pure-only rejection breaks malformed-input parity; hostile watcher reachability was not demonstrated                                               |
| Failed Account subroots become `ZERO_WORD`       | Static fallback confirmed; no legal admitted transaction producing the encoding failure shown                                                                                    |
| Merge-key hash errors become `canon(...)`        | Static fallback confirmed; no complete malformed-input comparison establishes a different external outcome                                                                       |
| `frameTxMessages` returns `[]` on replay failure | Static fallback confirmed; no valid admitted candidate triggering it demonstrated                                                                                                |
| Refresh marker optional fields                   | Types allow incomplete `issued` markers; inspected producer supplies both fields. Old persisted types also permit omission; stronger union needs historical/boundary validation  |
| Disputed/CrossRoute optional fields              | No evidence justifies making all fields mutually exclusive; preserve potentially legal overlap                                                                                   |
| Claim `Hash` casts permit empty sentinel         | Premature static authority exists; downstream claim validation was found. No invalid certified claim demonstrated                                                                |
| Optional recovery output rows                    | Existing test needs rows after transport retirement and fails verification without them. No silent corruption; identify authoritative retained evidence before changing host API |
| WAL/checkpoint exclusions                        | Scenario test excludes WAL `frameHash` and checkpoint-frame `postStateHash`; this limits exact durable-format compatibility, not the value of pure reducers                      |

“Full compatibility” needs a stated observational boundary. Pure financial semantics, exact errors/effects, durable bytes and a production-integrated crash-safe host are different claims. Current evidence supports sampled comparisons. Absence of broader evidence is not itself a defect; this review did not require a Rust/TPS campaign to judge a TypeScript module.

**Evidence and coverage**

| Item                    | Checked result                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Revision                | `0d3a097b782b65b08358299fa0419e65498edc57`; old `core`/`jurisdictions` unchanged from `566c850`                                                                                           |
| Source digest           | `6c92501b4550f06af462fda8e10b9b47aab64a9de60e9e9a44b85d75a056346b`, unchanged                                                                                                             |
| AST inventory           | 47,878 lines; 2,892 function items; 1,328 exported items; 97 functions over 30 lines; maximum 88; 595 casts; 1,182 `chain` calls                                                          |
| Original selected tests | 114 passed, 0 failed, 15,553 assertions across five files; completed logs reused                                                                                                          |
| Meaning of passes       | Includes `DIVERGES` at hashes.test.ts:614: old-root sensitivity tested without calling the rewrite in that case. Its stale title is not proof the current full Entity root lacks sections |
| Test limits             | One optional-leaf random test skips settlement-workspace cases; one dispute-text test normalizes a differing hash. Other related tests exist; these do not invalidate the suite           |
| Type/style              | Original pure typecheck and seven style rules passed. Second-pass strict fixtures passed on TypeScript 5.9.3, including three expected compiler rejections                                |
| Repository gate         | Original `bun run check` failed on absent `forge-std`; siblings cancelled. No source/environment change justified rerunning the unchanged candidate                                       |
| New probes              | Commit versus idle; Entity versus isolated retry; malformed-proposal vote; alias control; iterator timing; tag payload/discriminant; NaN deletion                                         |

Counts are observations, not coverage percentages. Nobody independently read every reducer. Ten first-pass lenses were requested as GPT-6-Sol Medium, but some received earlier findings; they were **not ten blind independent validations**. Two additional bounded audits checked simplification/evidence claims while I retraced and reproduced the six findings. Their agreement adds no protocol coverage.

The first type-hardening report's TypeScript 6.0.2 attribution lacked a retained version record; it is withdrawn as relied-on evidence. The independently checked compiler is 5.9.3. Original verification records remain in [verification.json](evidence/verification.json). The MCP recheck traced post-commit, prune and import call sites through the actual ast-grep server.

Second-pass evidence: [boundary source](evidence/recheck/boundaries.ts.txt), [boundary log](evidence/recheck/boundaries.log), [contract source](evidence/recheck/contracts.ts.txt), [contract log](evidence/recheck/contracts.log), [evidence claim audit](evidence/recheck/evidence-audit.md), [simplification claim audit](evidence/recheck/simplification-audit.md).

**Every reviewer lens**

| Lens            | Corrected report                    | Retained contribution                    |
| --------------- | ----------------------------------- | ---------------------------------------- |
| Type hardening  | [Report](agents/type-hardening.md)  | Import authority and ownership           |
| Ponytail audit  | [Report](agents/ponytail-audit.md)  | Named cuts; native deletion correction   |
| Defect review   | [Report](agents/defect-review.md)   | Isolated retry gap, Entity containment   |
| Code simplifier | [Report](agents/code-simplifier.md) | Fold contract and local readability      |
| Architecture    | [Report](agents/architecture.md)    | Commit correction, pure/host distinction |
| Overbuild       | [Report](agents/overbuild.md)       | Dead-surface candidates with API limits  |
| Critic          | [Report](agents/critic.md)          | Scope of parity assertions               |
| Creative        | [Report](agents/creative.md)        | Owned mutation; abstraction restraint    |
| Adversarial     | [Report](agents/adversarial.md)     | Shared policy and conditional fallbacks  |
| Simplify        | [Report](agents/simplify.md)        | Boundary-dependent type refinements      |

**My revised priorities**

I would fix `tag`, establish what the legacy-section importer promises, and retain a focused negative vector at each. I would keep memoization while investigating actual ownership, clarify the eager fold contract, and avoid changing held-retry semantics until its standalone API contract is explicit. Then I would take small, proven unused-surface cuts and judge any `mapModify` extraction by its real call sites.

I would not launch the original J-history fix-first sequence. The second pass has not earned that recommendation.

NEXT: A) Constructor and import contracts. B) Ownership and fold documentation. C) Focused readability with matching compatibility evidence.
