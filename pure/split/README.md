# The module split

`xln.ts` was one 48k-line module. `bun split/split.ts` splits it into four layers and turns `xln.ts` into the
barrel that re-exports them, so every importer keeps importing `xln.ts`:

| layer | file | holds |
| --- | --- | --- |
| base | `xln/base.ts` | vocabulary, matching, grammars, collections, canonical text, hex, ABI, signatures, RLP |
| account | `xln/account.ts` | the Account: state, commitment, txs, settlement, swaps, the cross-j kernel it carries, proofs, Account consensus and disputes |
| entity | `xln/entity.ts` | the Entity: state, txs, consensus, J events and the J prefix, disputes, hub books |
| runtime | `xln/runtime.ts` | the Runtime: intake, J submit, due wakes, cross-j atomic admission, the R -> E -> A cascade, WAL, outbox, watchtower |

Imports point down only: `base <- account <- entity <- runtime`. `bun style/check.ts` counts an upward import as a
`layering` hit (baseline 0), so the direction stays a gate after the split.

## How a declaration finds its layer

`split/layers.ts` is the module map, written in declaration names:

- `RUNS` gives each run of declarations in file order a home layer (a run starts at a named declaration).
- `PINS` are the anchors, the model each layer is named after: `AccountReplica`, `EntityState`, `EntityReplica`,
  `Runtime`. An anchor never moves.

The script then settles every declaration: it sinks to the lowest layer that uses it, and rises to the highest anchor
it uses. So a helper an Account needs lives in account even when its section is an Entity one, and code that reads the
`Runtime` lives in runtime even when its section is an Entity one. When an anchor would have to sink, the split stops
and names the user. Every declaration that left its run's layer is listed in `split/moves.txt` with the reason.

## Why the split is neutral

- Every statement of the layers is a statement of the monolith, byte for byte, in the monolith's order within its
  layer; the script checks that the two sets are equal before it writes. It adds only import lists, `export { .. }`
  lists for declarations a higher layer uses, the section headers each layer's statements sat under, and a two-line
  header per file.
- No layer imports a higher one, so no import cycle can reorder module evaluation. The one top-level side effect,
  msgpackr's `addExtension`, stays right before `binaryPack`, which needs it.
- `xln.ts` re-exports every layer with `export *`, so tests and tools import the same names from the same path.

## Re-running it after main moves

The layers are generated, so a merge conflict in `xln.ts` or `xln/*.ts` is resolved by regenerating, never by hand.
From `pure/`, after `git merge origin/main` on the split branch:

```sh
git checkout origin/main -- xln.ts   # main's monolith, with every fix that landed
bun split/split.ts                    # regenerates xln/*.ts, the barrel and split/moves.txt
../node_modules/.bin/tsc --noEmit -p . && bun style/check.ts && bun diff/walk.ts --seeds 3
```

If a fix renamed or deleted a declaration `split/layers.ts` names, the script stops and names it; point the entry at
the new name. A new declaration needs no entry: it takes its run's home and settles like the rest.

After the split merges, `xln.ts` is the barrel and `split/split.ts` refuses to run; new code goes straight into the
layer it belongs to.
