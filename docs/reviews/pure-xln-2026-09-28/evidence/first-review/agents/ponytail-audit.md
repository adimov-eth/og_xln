# ponytail-audit: `pure/xln.ts`

Pinned SHA: `0d3a097b782b65b08358299fa0419e65498edc57`. Read-only scope: over-engineering in `pure/xln.ts`. I inspected the 47,878-line file, its 5,264-line syntax outline, and `pure/` consumers. No source edit or test run.

## Ranked cuts

1. **delete:** Five exported kind-name arrays (`AccountTxNames`, `LendingTxNames`, `EntityTxNames`, `AccountInputKinds`, `EntityInputKinds`) have no TypeScript consumer in `pure/`; `AccountKinds` and the actual unions already own the kinds. Delete the five arrays; retain the typed `AccountKinds` catalog. [`pure/xln.ts:195–205`] **Estimated saving: 11 lines.**
2. **delete:** Two vector-format adapters, `encodeFrameHash` and `readJEventVector`, have no `pure/` consumer and wrap canonical functions with alternate input/output shapes. Delete both and their now-unused `AmountTx` type; use `accountFrameHash` and `readJEvents` directly at future call sites. [`pure/xln.ts:940–949`, `:1549–1552`] **Estimated saving: 15 lines.**
3. **delete:** `Eq`, `NextAccountPhase`, `AccountCases`, and `NextEntityPhase` are exported type aliases with no `pure/` consumer. Delete them while retaining `Grammar`, `Cases`, `Next`, and the actual phase definitions used by transitions. [`pure/xln.ts:20`, `:9886–9887`, `:12306`] **Estimated saving: 4 lines.**
4. **shrink:** Three Runtime-local update passes (`withProgress`, `withPrunedHistory`, `withWitnesses`) copy an entire map for each key through `mapSet`; one private `Map(local)` per pass with ordered `set` calls yields the same final map and insertion order. Keep sequential reads from the working map in `withPrunedHistory`. [`pure/xln.ts:40458–40499`] **Estimated saving: 8–15 lines; copy-count reduction is unmeasured.**
5. **stdlib:** `mapSet` and `mapDelete` spread/filter whole maps. Use `const next = new Map(m); next.set(k, v)` and `next.delete(k)`; native `Map` keeps insertion order when replacing a key. Preserve returned `ReadonlyMap` and absence behavior. [`pure/xln.ts:250–259`] **Estimated saving: 0–2 lines; allocation reduction is unmeasured.**

net: **estimated -38 to -47 lines, -0 deps possible.** These are audit suggestions, not verified changes.

## Consumer boundary and strengths

An identifier scan found 31 exported declarations appearing only once in `pure/xln.ts` and nowhere in other `pure/*.ts` files. I listed only the clearest disposable groups above. The rest include likely intentional public protocol operations (for example `restoreAccount` and `verifyBoardProof`); their absence from the current test harness does not prove they should be removed. Search excluded generated bundles and documentation references, which are not runtime consumers.

The file already uses one typed `AccountKinds` table, canonical `accountFrameHash`/`readJEvents` functions, and `mapSetAll` for one bulk map update. Its ordered financial error text, commitment serialization, and phase-transition grammar carry protocol meaning. This audit does **not** recommend deleting or collapsing those surfaces.

## Before / after sketches

`withProgress`: `outs.flatMap(...).reduce((acc, key) => mapSet(acc, key, {...}), local)` → make one `Map(local)`, loop over progress keys in output order, and `set(key, {...next.get(key), lastConsensusProgressAt: at})`; return the map. This preserves repeated-key last-write behavior and iteration order.

`mapDelete`: `new Map([...m].filter(([key]) => key !== k))` → `const next = new Map(m); next.delete(k); return next;`. This keeps the source immutable and uses the map's own deletion operation.
