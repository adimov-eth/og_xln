# CRITIC review — SHA 0d3a097b782b65b08358299fa0419e65498edc57

Scope: read-only review of `pure/xln.ts`, selected `pure/diff` tests, `docs/fints.md`, and current `pure/findings/final-sweep.md`. Old `SUMMARY.md` is superseded. No source edits or test execution. Existing reported evidence: 79 focused hash/account tests, 6,687 assertions green; pure tsc/style green; repository `bun run check` blocked by missing `forge-std`.

## Judgment

The rewrite has substantial, credible *sampled differential parity* with the old implementation, including exact hashes and some encoded outbox rows. The broader claims “full compatibility with older XLN” and “illegal states impossible” are unsupported. The former requires the requested production WAL, per-frame R/E/A roots and ordered digests, live J path, and a green release gate; the current final-sweep document itself lists approximations and an unmodeled ingress validator. The latter is too absolute for TypeScript and for the exposed runtime values; `docs/fints.md` explicitly says types apply only after decoding and validation.

## Strongest objection — fail-stop violation

`pure/xln.ts:39023` (`replicaJHistory`) calls `pruneFinalizedJHistory` and then `unwrapOr(..., () => h)`. The prune at `:36644` returns `J_HISTORY_LOCAL_PRUNE_HEIGHT_INVALID` if the finalized height exceeds `scannedThroughHeight`, but the caller silently supplies the original `h`. Its own comment says a failed prune fails the commit. A malformed or inconsistent finalized-height/history pair therefore reaches subsequent Entity work with stale history instead of stopping at the first invariant failure. This is a semantic divergence and a direct violation of the documented no-silent-fallback rule, independent of parity test breadth. Smallest regression: construct an Entity replica whose `jFinality.height` exceeds its Runtime-local history `scannedThroughHeight`; assert the Runtime transition returns the exact prune failure and does not advance the frame, publish effects, or mutate the retained history. Compare old production on that same complete state.

A second reported candidate at `:10772` is the `received` held-frame path: after `receipt` says continue, equal `stateHash` returns `ok(done(r))` with no ACK. Verify whether a duplicate peer proposal after restart should resend the certified ACK, using `restoreAccount` at `:11374` and a full old Account replay. Existing `account-consensus.test.ts:450` covers duplicate delivery of a committed *open* head, not this held `received` phase. This is actionable but I did not independently prove the old behavior from a complete state.

## Strengths and strongest defense

- `pure/diff/hashes.test.ts:62–90` compares canonical encodings to both old encoder and old oracle; `:121–176` compares Patricia roots and Account frame hashes over randomized inputs. This is meaningful independent byte/root evidence, not a self-comparison.
- `pure/diff/final-sweep.test.ts:369–435` compares 400 sampled retained outbox cases by old `encodeBuffer` bytes, including outcomes and order. `:170–198` compares 80 lockstep Account sequences, accepted roots, rejection texts, and explicit coverage counts.
- The old authority does not appear to have drifted from the declared `566c850` pin in `core/` or `jurisdictions/`: `git diff --stat 566c850..HEAD -- core jurisdictions` was empty at review SHA. The test seed is replayable through `SEEDX` (`pure/diff/seed.ts`).

The best defense is that the claim may mean *typed reachable committed protocol states* rather than arbitrary input objects, and *observational parity on implemented production surfaces* rather than a universal equivalence proof. Under that narrower statement, the evidence is impressive and the remaining list is fairly candid. The public statement should use those precise bounds and name the unverified gates.

## Test-contract limits that matter

- Some `MATCH` assertions intentionally compare only acceptance booleans, a selected field, normalized error shape, or a projected event. Example: `pure/diff/account-consensus.test.ts:545–546` replaces a hash with `<hash>` before comparing a dispute reason because the bodies differ. This does not establish exact observable text or hash parity for that case.
- `pure/diff/hashes.test.ts:640–667` skips randomly generated settlement-workspace cases after computing old roots (`if (settlementHankos) continue`), then requires only `compared > 50`. Other H5 tests may cover workspace commitment, but this specific random optional-field test does not cover its announced settlement-Hanko subset. State the exclusion in the test name or make a dedicated exact-case assertion.
- `pure/findings/final-sweep.md` explicitly excludes `validateDeliverableEntityInput` and injects gossip signature recovery; it also permits frame-clock text where old code uses wall time. These may be sensible pure-core boundaries, but they preclude an unqualified full-compatibility claim.
- Differential tests import old code live from `core/`, so a later change there can change the oracle silently. At this SHA, the declared baseline appears pinned by identical core/jurisdictions diff; a final parity artifact should record both SHAs and source hashes for reproducibility.

## Scope limit and next evidence

I did not run verification, build a full production WAL, or inspect every reducer in the 43k-line file. Prioritize the J prune regression and the held-`received` ACK case, then run the exact production replay and live J gate before describing compatibility as complete. Do not infer failure of all other surfaces from these bounded findings.
