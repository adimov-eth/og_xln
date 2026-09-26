# cross-j-final: remaining og cross-j Entity txs and flows

og (core/ + jurisdictions/ at 566c850) is the spec. The tests are in `pure/diff/cross-j-final.test.ts`, which has 8 MATCH tests against live og.

| # | og item | og file | Rewrite | Status |
|---|---|---|---|---|
| 1 | `requestCrossJurisdictionClear` (pure cancel vs filled reveal, clear_requested route, followup ladder close, self wake) | handlers/cross-j/clear.ts | `requestCrossClear`. `CROSS_J_CLEAR_UNPORTED` is removed. | FIXED. MATCH on 600 random routes. |
| 2 | `materializeCrossJurisdictionClear` | handlers/cross-j/clear.ts | `materializeCrossClear` | FIXED. MATCH on 400 cases. |
| 3 | Default-proposer clear reveal | cross-j-proposer-materialization.ts `appendDefaultProposerCrossJMaterializations` | `crossClearReveals` in `crossMaterializations`, with `clear:` pending keys and the commit-phase fill-notice predicate | FIXED. MATCH on 300 cases. |
| 4 | `crossPullClose` Entity tx and its runtimeOutput authority | payments/pull.ts, runtime-output authority | `crossPullCloseTx`, plus a `crossPullClose` case in `runtimeOutputAuthError` | FIXED. MATCH on 500 cases for the tx and 400 for authority. |
| 5 | `orderbookSweepCrossJurisdiction` (crontab cross-j sweep) | handlers/cross-j/sweep.ts, scheduler due-hooks | `crossSweep`. The `ORDERBOOK_SWEEP_CROSS_J_ENTITY_TX_NOT_PORTED` wake invariant is removed, and it is a SELF_CONTINUATION. | FIXED. MATCH on 300 cases. |
| 6 | Committed `cross_pull_lock` followup: route binding, authorization, `scheduleHook` `cross-j-expiry:<orderId>`, local book admission or a sibling owner output, created swap offer | account-cross-j-followups.ts | `committedCrossFollowup` and `crossFollowups`, wired into the accountInput ack / ack_frame chains | FIXED. MATCH on 500 cases. |
| 7 | Committed `cross_pull_close` followup: terminal replay, economics, settle/cancel, cancelHook, book removal or a sibling removal request | account-cross-j-followups.ts | `committedCrossFollowup` | FIXED. MATCH on 500 cases. |
| 8 | Peer frames carrying `cross_pull_lock` / `cross_pull_close` | account apply | `entityAcceptsPeerTx` accepts them | FIXED (Entity side). |
| 9 | Runtime atomic admission of paired legs, sibling cohort gating (`selectCrossJOpeningAccountProposalTxs`) | runtime/frame/cross-j/atomic-admission.ts | not ported | FIXED (runtime-final RF-14 for sibling cohort gating, RF-15 for atomic admission of paired legs). | |
| 10 | `crossJurisdictionBookOrderRemoved` dispute branch, and `DISPUTE_PREPARE_CROSS_J_BOOK_REMOVAL_NOT_PORTED` (`removeDisputedAccountOrdersFromBook` output, `pendingOrderbookRemovalIds`, `orderbookRemovals:N` readiness, `draftPreparedDisputeStartIfReady`) | dispute/index.ts, dispute/shared.ts | the invariant is kept | REMAINING. og `handlePrepareDispute` also runs `planCrossJurisdictionTargetRecovery` (cross-j recovery, row 12). The rewrite `DisputePrepare` envelope and readiness belong to the disputes region. Porting only the removal half would diverge on the recovery state. |
| 11 | `crossJurisdictionSalvage`, `crossJurisdictionForceSiblingDispute` | handlers/cross-j/salvage.ts | not ported | REMAINING. They drive `disputeStart` / hash-ladder registration through `stashPendingRegistryReveal`, `queueHashLadderRevealRegistration` and jBatch. Those are the J-event lane and jBatch, which belong to the J owner (parallel), and the rewrite has no Entity J-event lane. |
| 12 | Cross-j recovery, source hub claims on finalize, secrets in starter arguments, proofs carrying locks/swaps/pulls | j-events.ts, proof-builder.ts, dispute-arguments.ts | the invariants `DISPUTE_*_NOT_PORTED` are kept | REMAINING. The rewrite `ProofBody` omits locks/swaps/pulls, and there is no Entity J-event lane (J / disputes owners). |
| 13 | `flushDeferredHashLadderReveals` | j-events-htlc/index.ts | not called | REMAINING. Only og's J-event `stashPendingRegistryReveal` writes the pending reveals, and that is not reachable in the rewrite (row 11). og's flush returns 0 on every reachable state. |

Notes:
- Minimal edits outside this region: `HubAccount.pulls` / `hubView`, `WakeTx` / `foldWake`, `entityAcceptsPeerTx`, the accountInput ack chains, and `selectCommitPhaseTxs` / `crossMaterializations`.
- Ordering: og runs the cross followup for each tx interleaved with the HTLC followup. The rewrite runs `htlcFollowups` and then `crossFollowups`. The tx sets are disjoint, so the only possible difference is message/output order within a frame that carries both.
