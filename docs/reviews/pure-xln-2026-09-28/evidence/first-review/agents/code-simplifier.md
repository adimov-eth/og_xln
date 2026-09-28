# Code simplifier lens: `pure/xln.ts`

Read-only review of immutable SHA `0d3a097b782b65b08358299fa0419e65498edc57` (47,878 lines). I used the supplied outline, targeted `ast-grep` structure searches, and local source inspection. No production edits or tests. This is a proposal list, not a whole-file correctness audit.

## What already reads well

- The opening `Result` vocabulary gives `map`, `chain`, `traverse`, and `foldResult` one consistent meaning. Comments explicitly state refusal order, and the financial callers use those primitives rather than inventing local error plumbing.
- `mapSet` and `mapSetAll` explain insertion order and copy costs. `mapAccumResult` documents its one transient array and why it exists. These comments protect subtle behavior.
- Domain checks often carry the old `og` operation name and an exact refusal/error reason. The orderbook comments at 44,874-45,025 explain why a row is accepted, cancelled, or halted.

## Proposals, highest value first

1. **Make `foldResult` actually stop visiting a generic iterable after refusal** (`pure/xln.ts:42-46`). Its comment promises later items are not visited, but `[...xs].reduce(...)` exhausts `xs` before the reducer sees the first error. For arrays the callback short-circuits, but generator producers still run. An explicit `for...of` with an index would match the stated contract and avoid eager materialization:

   ```ts
   let state = init;
   let index = 0;
   for (const x of xs) {
     const result = f(state, x, index++);
     if (!result.ok) return result;
     state = result.value;
   }
   return ok(state);
   ```

   Test with a generator that throws if advanced after the first refusal. This is a contract repair, not strictly behavior preserving for iterables with side effects; arrays and ordinary deterministic replay inputs should remain unchanged. Check `mapAccumResult`, `traverse`, `strictFold`, and `everyResult` as direct beneficiaries. Preserve the exact first error and dense index.

2. **Flatten the `j_event_claim` stamping validation in one local function** (`pure/xln.ts:9531-9544`). Four nested `chain`/`map` callbacks conceal the order of authority and witness checks. Use sequential named results and early returns in `stampClaim`; retain the existing `foldResult` around transactions:

   ```ts
   const own = claimRowOf(tx, byLeft);
   if (!own.ok) return own;
   const witnesses = claimWitnesses(accountKey, acc.cursor, own.value);
   if (!witnesses.ok) return witnesses;
   const next = claimStep(acc.cursor, own.value);
   if (!next.ok) return next;
   return map(claimEvidence(tx.events), ({ events }) =>
     stampedClaim(acc, tx, witnesses.value, next.value, events.map((e) => e.data.nonce)));
   ```

   The same technique may help `checkAccountHanko` (`3661-3676`) and `planCrossFill` (`46011-46033`), but each should be judged independently. Preserve evaluation order, first refusal, and exact error identity. In particular, do **not** replace these chains with `all({ ... })`: construction eagerly evaluates every check and may change the first refusal or run an unauthorized later operation.

3. **Consider one narrowly named `mapModify` helper for the repeated read-modify-write shape** (`8855-8859`, `26437`, `39617`, `40459-40461`). These are four actual uses, meeting the three-use threshold:

   ```ts
   const mapModify = <K, V>(m: ReadonlyMap<K, V>, k: K, f: (old: V | undefined) => V): ReadonlyMap<K, V> =>
     mapSet(m, k, f(m.get(k)));
   // e.g. mapModify(m, h.tokenId, (old) => addHold(old ?? NO_TOTALS, h))
   ```

   This removes duplicated key spelling and makes the update dependency explicit. Keep the helper only if the four call sites become easier to read together. It must call `f` once, retain `mapSet`'s fresh-map and insertion-order behavior, and never delete a zero/empty entry. It does not solve repeated full-map copies inside folds; do not silently switch to a mutable accumulator. The project explicitly documents the one allowed transient accumulator in the opening vocabulary.

4. **Use descriptive names for the two ABI cursor constructors** (`pure/xln.ts:466-491`). `T` and `L` appear six times in a short decoder section, while the exported types already say `AbiTuple` and `AbiLength`. `asAbiTuple` and `asAbiLength` make casts visible at call sites (`asAbiLength(h + Number(wordAt(...)))`). This is a contained readability change: only the helper identifiers change; cursor arithmetic and validation must stay byte-for-byte equivalent. Do not sweep all short names across the 47k-line file: `t = A.tuple` is local ABI notation, and `map`/`chain`/`ok`/`err` are established vocabulary.

## Explicitly rejected abstractions

- A generic `pipe`/do-notation layer over all `chain` calls would hide the ordered refusal boundary and add vocabulary without three examples that share the same domain semantics.
- A universal Runtime/Entity/Account reducer or map updater would cross distinct trust boundaries forbidden by `AGENTS.md` and `docs/fints.md`.
- Replacing the parallel same-j and cross-j orderbook event handling with one generic event fold would merge different reject and settlement rules. The repeated `REJECT`/`TRADE` extraction at `44892-44893` and `45942/45981` is small; a helper there is not worth obscuring those rules.
- A global rename of exported `at` to avoid confusion with `Array.prototype.at` would touch many call sites and potentially external imports. The local ABI constructor rename has a better risk-to-clarity ratio.

## Compatibility bar for any adopted proposal

For any change beyond the `foldResult` contract repair, compare canonical wire/WAL bytes, state roots, and ordered event/effect/outbox digests on the existing deterministic vector or exact replay. Preserve hash-reachable object shape, `Map` insertion order, output positions, first typed rejection, and error text. Use the smallest focused regression first and run `bun run check` before a completion claim. No broad new helper should precede a production artifact.
