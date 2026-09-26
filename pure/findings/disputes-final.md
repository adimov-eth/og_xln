# disputes-final: disputes and cross-j recovery

og (core/ + jurisdictions/ at 566c850) is the spec. The tests are in `pure/diff/disputes-final.test.ts`. Run them from `pure/` with `bun test diff/disputes-final.test.ts`: 17 pass, 0 fail. Every test is `MATCH:` and runs live og on seeded random inputs.

## Rows closed

| Row | og item | Rewrite | Status |
|---|---|---|---|
| entity-j EJ-R1 | j-events.ts `DisputeStarted` / `CounterDisputeRegistered` / `DisputeFinalized` / `HashLadderRevealRegistered` Entity handlers, `flushDeferredHashLadderReveals` | `finalizedJEvent` cases `disputeStartedJEvent`, `counterRegisteredJEvent`, `disputeFinalizedJEvent`, `ladderRegisteredJEvent`. An unknown finalized event halts with `FINALIZED_J_EVENT_HANDLER_MISSING`. | FIXED (5ae3355). MATCH: 200 random signed dispute events and 150 random signed secret/ladder ranges, through og `applyJEvent`. |
| entity-j EJ-R2 | `applySecretRevealedJEvent` → `applyKnownHtlcSecret` | `knownSecret`: paybook route, fee, inbound `htlc_resolve`, cross-j relay output | FIXED (5ae3355). Covered by the 150 range MATCH. |
| scheduler-disputes 14 | Proofs carrying locks/swaps/pulls, the arguments built from them, and the reveal flush on finalize | `accountProofBody` clauses (6688ad8); arguments (102f0d2); the flush in `batchProcessedJEvent` and `entityJBroadcast` (5ae3355) | FIXED. MATCH: 600 random Accounts' ProofBodies, 500 argument sets, and 250 flush states. |
| scheduler-disputes 15 | Starter-argument secrets (`applyKnownHtlcSecret`), cross-j recovery, and source hub claims on finalize | `disputeStartedJEvent` starter secrets and recovery plan; `finalitySettlements`; `eventSourceClaims` | FIXED (5ae3355). Covered by the 200 dispute-event MATCH. |
| cross-j-final 10 | `crossJurisdictionBookOrderRemoved` dispute branch; `handlePrepareDispute` recovery, book removal and readiness | `disputeRemovalAck`, `prepareDispute` (`planTargetRecovery`, `disputeBookRemoval`, `pendingOrderbookRemovalIds`) | FIXED (1abcef3). MATCH: 200 removal ACKs and 250 prepare / sibling cases. |
| cross-j-final 11 | `crossJurisdictionSalvage`, `crossJurisdictionForceSiblingDispute` | `crossSalvage`, `forceSiblingDispute` | FIXED (d2773bd). MATCH: 250 reveal ports; sibling fanout is inside the 250 prepare / sibling cases. |
| cross-j-final 12 | Cross-j recovery, source hub claims, starter secrets, proofs with locks/swaps/pulls | as rows 14, 15 and 10 | FIXED. |
| cross-j-final 13 | `flushDeferredHashLadderReveals` | `flushDeferredReveals`, called on `j_broadcast` and on an exact `HankoBatchProcessed` finalize | FIXED (d2773bd, 5ae3355). MATCH: 250 flush states. `stashPendingRegistryReveal` is now reachable through salvage and `HashLadderRevealRegistered`. |
| cross-book 18 | `crossJurisdictionBookOrderRemoved` dispute branch (`confirmDisputeBookRemoval`, `draftPreparedDisputeStartIfReady`) | `disputeRemovalAck`, `draftPreparedStart` | FIXED (1abcef3). MATCH: 200 random ACKs (proof in d6dee21). |
| entity-consensus-2 33 | prepareDispute, disputeStart, disputeFinalize | prepare with book removal and recovery; start with argument overrides (`DISPUTE_INCREMENTED_ARGUMENT_OVERRIDE_UNSUPPORTED` is og's own halt); finalize with proof selection and the crontab hook | FIXED. MATCH: 200 `disputeStart` with real Hankos and overrides; 250 prepares; 400 finalizations (scheduler-disputes); hooks inside the 200 dispute-event MATCH. |
| entity-lane 31 | The other cross-j Entity txs | salvage and sibling dispute here; the book txs in cross-book.md; clear / pullClose / sweep in cross-j-final.md | FIXED. |
| entity-lane 32 | Cross-j `disputeStart` / `resolveHtlcLock` runtimeOutput authority (`assertRuntimeCrossJRecoveryAuthority`) | `recoveryAuthority` in `runtimeOutputAuthError` | FIXED. MATCH: 800 random envelopes against og `assertRuntimeOutputAuthorization`. Force-sibling via runtimeOutput is refused by both. |
| entity-lane 33 | `flushDeferredHashLadderReveals` | as cross-j-final 13 | FIXED. |
| cross-j 47 | Secret-ACK deadline dispute (due hook); `persistVerifiedPaymentSecret` on dispute paths | The due hook is in scheduler-disputes (MATCH there). `unsafeAccountFrame` ports og `handleUnsafeAccountFrame` (b21994f). | FIXED. MATCH: 200 random unsafe frames against og `handleUnsafeAccountFrame`; 200 `resolveHtlcLock`. |
| cross-j 49 | Entity cross-j handlers and collections | all ported (rows above, cross-book.md, cross-j-final.md) | FIXED. |
| cross-j 50 | `flushDeferredHashLadderReveals` | as cross-j-final 13 | FIXED. |
| settle-jsubmit SJ-19 | finalize latches (`finalizeQueued`) in j-abort / j-clear | `disputeFinalize` sets the latch (`latchFinalize`), and `releaseEntityLatches` clears it | FIXED. The row was stale. MATCH: 200 random aborts and clears (a12dd12). |

## Behaviour changed in this area

- **Unsafe Account frames.** An Account input refused with a dispute disposition used to only freeze the Account, and its `start_dispute` output was dropped. It now runs og `handleUnsafeAccountFrame`:
  - A just-created inbound Account is dropped.
  - The secret-window evidence secret is persisted, then resolved upstream with its ACK deadline.
  - `handlePrepareDispute` runs.
  - A queued start latches `autoBroadcastDraft` and emits a self `j_broadcast`.
  - No committed followups run.
- **`finalizedJEvent`.** Its default is now a halt, not `J_EVENT_<type>_ENTITY_HANDLER_NOT_PORTED`.
- **`foldTx` is exported.** Tests use it to inspect one tx without the Entity frame's Account proposals.

## Divergences found and not fixed (outside the rows above)

- **Unsafe-frame reason text.** og's `AccountInputDisputeRequired.reason` for a replay failure is the failing Account tx's free-form error text. It flows into the committed `disputePrepare.reason` and the start description. The rewrite reproduces og's text only for the secret-window violation; other causes carry `ACCOUNT_FRAME_DISPUTE_REQUIRED:<cause tag>`. Closing this needs og's replay error strings for every Account refusal.
- **`rejectedFrameEvidence` in the root.** The rewrite keeps the frame evidence on the frozen replica, but `installedAccount` never commits it (`EntityRootAccount.rejectedFrameEvidence` is typed but not derived). That belongs to the hashes owner.
- **Mempool on DisputeFinalized.** The rewrite's `disputeFinalized` Account finality empties the whole mempool; og removes only `settle_transition`. This is Account consensus scope.
- **Refusal texts.** For `dispute_finalized`, Account finality refusals surface as the generic `ACCOUNT_EXTERNAL_FINALITY_REFUSED`, and the `DISPUTE_CANONICAL_DELTA_BATCH_INVALID` text differs from og's. No MATCH test in this area reaches either.
