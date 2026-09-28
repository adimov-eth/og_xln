# Creative review: `pure/xln.ts` at `0d3a097b782b65b08358299fa0419e65498edc57`

Read-only review. The recommendations below preserve the existing wire/WAL shapes, roots, error precedence, and positional output order. No source edit or test run was made.

## What already works

- The core already expresses failures as closed `Result` values and has exhaustive transaction dispatch (`applyArm`, lines 7570–7620), tagged Account/Entity replicas, and transition tables (lines 121–193). These are useful domain boundaries; a second generic reducer across R/E/A would erase their different authorities.
- `mapAccumResult` (56–65) **already** owns one transient array and exposes only a readonly result. This is a sound pragmatic FP choice: private local mutation with a pure observable transition. `strictFold` (215–220) preserves sequential effects. There is no need to replace it with repeated immutable array spreads.
- The Runtime cross-j pair has a good local ADT, `PairRun` (40016–40020): the `refused` arm cannot also carry staged commits. `stagePairLeg` (40280+) and `finishPair` (40346+) show a legitimate state machine whose tag never enters committed state.

## Recommended small changes, if a refactor pass is requested

1. **Make `foldResult`'s iteration claim true or narrow the claim.** Its comment says later items are not visited after a refusal, but `[...xs].reduce(...)` (43–47) exhausts an `Iterable` before the first step. It skips later callbacks, not iterator work. A direct `for...of` over `xs`, returning on the first `!acc.ok`, would match the stated control flow and avoid the full copy. This is the most interesting apparent impurity: a local loop is the clearest implementation of the pure externally observable fold. Counterargument: if a caller relies on iterator exhaustion or on the timing of a generator's side effects, behavior changes. Inventory iterable callers first; preserve old error and output order in an exact replay fixture. The least risky immediate change is to correct the comment.

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

2. **Keep phase extraction adjacent to the consumer.** `applyAccountInput` (11335–11351) appropriately distinguishes local `propose/freeze/resume`, authenticated peer envelopes, and J `external_finality`; `applyEntityInput` (29061–29075) checks entity/signer before dispatch. If a future handler again needs the same validated phase facts, a small *ephemeral* view returned by `checkEnvelope` or the existing matcher could eliminate repeated checks. The view must be minted by the relevant verifier, carry no new wire tag, and not recast `EntityInput` as a globally exclusive union. Counterargument: extraction now would mostly add a layer between one check and one handler. Current direct dispatch is easier to audit, so defer until there are repeated concrete uses.

3. **Give collection mutation one lexical owner where measured.** `inputUnits` (40399–40406) repeatedly spreads the growing `units` array. `dedupeNetwork` (41294–41296) threads a `ReadonlyMap` through `intoSlot`; `groupedBy` (39057–39060) already uses a local grouping operation. If profiling names one of the first two as a material phase, use a local owned array/map builder and publish a readonly value once, like `mapAccumResult`. Preserve first-seen slot order and the exact merge error precedence. Counterargument: neither path is shown to be a bottleneck here; eager optimization would complicate an exact consensus path for conjectural gain.

## Ideas to entertain, not current recommendations

- **A context-local composition helper rather than another framework.** `bookPhase` (26519–26528) reads as three ordered transitions: committed cancels, cancel requests, matcher. A local `thenDraft` helper could shorten several such nests, but its single use would hide which stage produces `resumePairIds`. The existing `chain` and explicit names are likely clearer. A generic workflow/effect system would be especially misleading because Runtime, Entity, and Account have distinct authority and commit boundaries.
- **Distinguish independent validation from dependency.** `all({ ... })` (82–88) receives an object whose member expressions have *already* run. It preserves first error by object entry order but is not lazy validation. That is appropriate when checks are independent and their execution cannot change a protocol-visible result. In a dependency chain, keep `chain` or direct guards, as `applyAccountBody` (7619–7630) does to preserve og handler error priority. Replacing all `chain` nesting with `all` would be a semantic change, not a style change.
- **A narrower local ADT for a Runtime phase.** `InputBatch` (39990–40000) bundles queue, deferred replicas, outputs, and cross-pair markers. One might split a `StageResult` into admitted/rejected/committed variants to prevent a staged output from being routed twice. The nearby `StagedIn`, `PairRun`, and `settleStaged` already encode the important branches, so prove a concrete invalid combination is reachable before adding another tag. Never put such a phase in `RuntimeState` or a durable field.

## The version that seems wrong

A superficially "more functional" rewrite could replace `mapAccumResult`'s owned `push`, `InputBatch`'s ordered arrays, and `Slots`' first-seen `Map` with generic immutable folds and a universal R/E/A reducer. It would likely increase copying, obscure commit ownership, and make positional output order harder to see. The stronger direction is *local mutation with narrow ownership* inside otherwise deterministic transitions, plus narrow ADTs only where a real impossible state or authority boundary becomes explicit. This accords with `docs/fints.md` §1–4 and §8: type elegance ranks below exact roots and bytes.
