# SIMPLIFY review — `pure/xln.ts` at `0d3a097b782b65b08358299fa0419e65498edc57`

Read-only, no tests or edits. Scope: cognitive simplification with canonical behavior and FinTS safety preserved. The existing `Result`, `matchBy`, `foldResult`, and phase-tagged Account replicas are useful boundaries; I found no reason for a new functional library, one universal reducer, or splitting the 47,878 lines by size alone.

## 1. Close the existing refresh marker shape (small, type-level)

`RefreshMigration` at `pure/xln.ts:9783-9790` admits `{reason:"issued"}` with neither `issuedFrameHeight` nor `issuedFrameHash`, and admits those fields on unrelated reasons. `refreshMarker` at `16910-16917` accepts independent `reason` and `issued` arguments; `needsBoardRefresh` at `16925-16931` compensates with `?? ""`. The actual issued producer at `17035-17045` passes both values. A two-arm **view over the same runtime fields** would encode this existing rule: `reason:"issued"` requires both issued fields; all other reasons exclude both with `?: never`. Split the constructor into `issuedRefreshMarker(activation, height, hash)` and `unissuedRefreshMarker(activation, reason)` only if there are enough real callers to justify two names; otherwise keep one constructor with a union argument. No new serialized `kind` or wrapper. First verify historical persisted markers and the parser: an old incomplete marker must be rejected explicitly or handled by a deliberate migration, not cast into the stronger type. This matches FinTS 4.1 and 4.2 and eliminates one misleading fallback.

## 2. Remove alternate identities on canonical hash failure (higher priority, behavioral)

`frameIdOf` at `29613` changes from `hashEntityFrame` to `canon(frame)` on hash error; `conflictingProposal` at `29858-29862` uses that value to judge whether two proposals conflict. `jPrefixKey` at `29696-29704` and `laneKey` at `29706-29714` similarly substitute `canon(unsigned)` and `canon(vote)` for failed protocol hashes. These are two identities for one signed object. A malformed object can enter a different merge lane or conflict path instead of producing the hash error. Use the already established `Result` path: make the key/comparison functions return `Result<..., RuntimeError>` and propagate the original hash error with context at the merge boundary. Do this as one focused production change, not a global `unwrapOr` purge. Preserve successful key bytes and exact input order; add a named malformed-frame/vote/attestation vector that exercises the first observable failure. This is a correctness concern under the project's no-silent-fallback rule, so parity evidence is required before calling it a refactor.

## 3. Do not silently erase an Account frame's message replay failure

`frameTxMessages` at `7779-7790` folds Account transactions with `applyAccountBody`, then maps every error to `[]`. Its only caller is `acceptReceived` at `10497-10523`, after `install` has built the committed step. The empty list is indistinguishable from a valid frame with no messages; the frame's ordered output digest can therefore look valid after a replay failure. Return `Result<readonly string[], BodyError>` and chain it before constructing the output step, or reuse a previously validated fold if it contains these exact messages. Confirm the latter rather than assuming it. Keep message order and wording byte-identical for successful frames. A regression should force the replay error and show that the candidate is rejected rather than accepted with missing messages.

## Boundaries to retain / ideas rejected

- `Lane` at `29615-29628` is an ephemeral merge projection. Its optional proposal, precommit, transaction, vote, and J-prefix slots reflect permitted combinations. A globally exclusive union would contradict FinTS 4.5; narrow only at each consumer.
- `AccountEnv`, `Held`, `Frozen`, and the existing `open/proposed/received/preparing/disputed` tags at `9757-9840` follow the canonical replica lifecycle. Replacing them wholesale with new generic typestate would increase migration risk without removing bytes or branching. Keep the trust-boundary-specific transition tables.
- `SubmitJournal` at `29251-29264` repeats last-result fingerprint beside a bounded fingerprint map, but `journalFingerprint` at `31689-31707` cross-checks them and uses the last result after bounded retention. Deletion is not justified without replay/recovery evidence.
- `HostChange.changed` at `46109-46110` is a local operation result used for progress decisions at `46392-46403`; deriving change from object identity would be unreliable because immutable copies can represent no semantic change. A tagged union would add ceremony without reducing required information.

## Suggested sequence

1. First production boundary: make the canonical hash-based merge keys fail through `Result`, and run the smallest divergent vector, then the focused merge scenario. Preserve valid keys and output order.
2. Once that is green, close the refresh-marker type and constructor while checking persisted legacy values; compare serialized Entity roots on existing refresh vectors.
3. Then address message replay error propagation with one failing frame vector and exact ordered output comparison. Finish with the project's required `bun run check` gate. Do not combine these into one diff: each has a separate first failure and rollback point.

Confidence: high on the observed alternate hash identity and suppressed message error; medium on whether historical refresh markers permit an immediate closed union. No completion or production parity claim follows from this review.
