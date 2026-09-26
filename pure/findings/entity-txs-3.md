# entity-txs-3 findings (wave 3)

Scope: the REMAINING entity-tx items in `entity-consensus-2.md` and `entity-runtime.md`, plus the J7 dispute J-event wiring. og (core/ + jurisdictions/ at 566c850) is the authority. The tests are in `pure/diff/entity-txs-3.test.ts`, and every MATCH test runs og live.

## Fixes and gaps

| ID | Area | og source | Status | Notes / test |
|----|------|-----------|--------|--------------|
| T3-1 | entityCommand codec, hashes, stack keys, generateProposalId | core/entity/command/command-codec.ts, auth/authorization.ts, tx/processing/proposals.ts | FIXED | 200 random commands and 150 collective batches, compared with og |
| T3-2 | Governance propose / vote inside signed commands (the lanes top, command, collective; nonces; thresholds) | system/basic.ts, command/index.ts | FIXED | 40 random governance runs with tampering: the same accept / evict / refuse class, proposals, nonces, events and profile. A plain propose or vote is og ENTITY_COMMAND_REQUIRED |
| T3-3 | Entity frame events certified in the frame hash | frame-events.ts, createEntityFrameHashFromStateRoot | FIXED | extendCredit / lending status events and a signed collective frame hash, compared with og |
| H7-b | Leaf shadow rebalance policy (policyRoot) | open-account.ts seedOpenAccountPolicies, createInboundAccountState | FIXED | The requested policy plus the jurisdiction whole-USD defaults, scaled by token decimals {1:6,2:18,3:6,4:6,5:18}. The root equals og PersistentAccountStateMap (120 random cases), and the inbound defaults are seeded for [1,3,2] |
| T3-4 | JurisdictionConfig.rebalancePolicyUsd holds whole-USD numbers | jurisdiction config | FIXED | covered by H7-b |
| T3-5 | setHubConfig | lifecycle/admin.ts handleSetHubConfigEntityTx, buildHubConfig | FIXED | Covers validation, the policyVersion rule, the committed config, profile.isHub, the event, the per-Account per-token rebalance_policy queue and the wake. Tested on 150 chained configs. A hub's openAccount queues the policy txs between the add_deltas and the credit line |
| T3-6 | setRebalancePolicy and checkAutoRebalance | lifecycle/admin.ts, auto-rebalance | FIXED | A missing Account is a no-op, and an invalid policy is a plain Error. Every skip gate is covered. Tested on 300 random Accounts |
| J7 | DisputeStarted / DisputeFinalized J events reach the Account | core/entity/tx/j-events.ts | FIXED | Host `disputeFinalityOf` resolves the counterparty the og way and checks the frozen proof-body hash, then applies external_finality. Tested on 120 random events against og createAccountDispute*Input / applyAccountDispute* |
| H7-c | Leaf disputePrepare, and a queued activeDispute (observedOnChain:false) | dispute/prepare.ts, dispute/start.ts | FIXED | tested in the 60-case prepare/start test |
| T3-7 | prepareDispute / disputeStart | entity/tx/handlers/dispute | PARTIAL | Ported: cooldown readiness, the admission then evidence order, jBatchState.batch.disputeStarts rows, the batch limits, og status messages, and ogProofBody equal to og canonicalizeProofBodyStruct. Tested on 60 random calls. Removing the Account's orderbook rows on prepare is FIXED (og removeDisputedAccountOrdersFromBook, MATCH on 40 random books); a cross-j order whose book another Entity owns remains (DISPUTE_PREPARE_CROSS_J_BOOK_REMOVAL_NOT_PORTED: needs the removeCrossJurisdictionBookOrder Entity output). The starter-argument override is FIXED (og sanitizeOptionalDisputeArgument, scheduler-disputes.md #7; DISPUTE_START_ARGUMENT_OVERRIDE_NOT_PORTED removed). Also remaining: proofs carrying locks, swaps or pulls, and the cross-j route (DISPUTE_START_CROSS_J_ROUTE_MISSING). The live og test has no success-path fixture with a counterparty hanko, so success is checked through the rewrite and the og refusal classes |
| T3-8 | J7 side effects | j-events.ts | PARTIAL | FIXED: the jBatch scrub, counter-proof scrub, recovery prepend, nonce sync and broadcast continuation on the Host J-event path, and the crontab dispute-deadline hook / messages as Entity functions (scheduler-disputes.md #6). REMAINING: HTLC secrets in starter arguments (DISPUTE_STARTED_SECRET_ARGUMENTS_NOT_PORTED) and cross-j settlement on finality |
| ER-4b | Quorum board binding (assertQuorumBoardBinding) | hanko/signing.ts | FIXED | Ported together with the certified-board registry; fixtures use og-valid lazy ids (see boards.md) |
| AC-13b | certified-board registry, refresh producer | entity board rotation | FIXED | FIXED (consensus-final.md): the producer is ported (boards.md AC-13b-send). |
| T3-9 | Admission wrapper | local admission | FIXED | FIXED (consensus-final.md): admitAt queues like og (book-admission.test.ts "og applyAccountEnqueue timing"). |
| T3-10 | Account-level frame events | account frame events | REMAINING | the Account reducer emits no og account events |

## og EntityTx enumeration (63 types, `core/types/entity-tx.ts`, enumerated with ast-grep property_signature `type`)

| og tx | Status | Blocking og subsystem / notes |
|-------|--------|-------------------------------|
| openAccount, accountInput, extendCredit, directPayment, requestCollateral, profile-update, chat, chatMessage | PORTED | earlier waves; openAccount gains rebalancePolicy (H7-b) |
| entityCommand, propose, vote | PORTED | T3-1, T3-2 |
| setHubConfig, setRebalancePolicy | PORTED | T3-5, T3-6 |
| prepareDispute, disputeStart | PORTED (partial) | T3-7 |
| lendingOffer, lendingBorrow, lendingRepay, lendingClosePosition | PORTED | lending area |
| placeSwapOffer, proposeCancelSwap | PORTED | orderbook area (og swap-requests.ts shape) |
| htlcPayment | PORTED | cross-j / htlc area (merged from the lead branch) |
| disputeFinalize | PORTED | scheduler-disputes.md #5 (proofs with locks/swaps/pulls remain, #14) |
| scheduledWake | PORTED | scheduler-disputes.md #1-#4 |
| proposeAccountsNow | BLOCKED | the rewrite does not keep og's pendingAccountInput bytes |
| entityProviderActivateBoard, entityProviderCancelAction, entityProviderProposeControlBoard, entityProviderReleaseControlShares, entityProviderTransfer | FIXED | see boards.md EP-1..EP-5 |
| boardHandover | FIXED | entity-j.md EJ-3 (j_event entity tx) and EJ-6 (frame config) |
| settle_propose, settle_update, settle_approve, settle_execute, settle_reject | BLOCKED | og entity settlement orchestration (core/entity/tx/handlers/payments/settle.ts: settlement workspace, co-signing, jBatch settle rows) |
| processHtlcTimeouts | PORTED | scheduler-disputes.md #4 |
| resolveHtlcLock | BLOCKED | owned by the htlc agent (paybook lock lifecycle) |
| initOrderbookExt | BLOCKED | owned by the orderbook agent (orderbook extension state) |
| runtimeOutput, crossPullClose, prepareCrossJurisdictionSwap, registerCrossJurisdictionSwap, admitCrossJurisdictionBookOrder, removeCrossJurisdictionBookOrder, crossJurisdictionBookOrderRemoved, crossJurisdictionFillNotice, crossJurisdictionForceSiblingDispute, crossJurisdictionSalvage, materializeCrossJurisdictionClear, materializeCrossJurisdictionSwap, orderbookSweepCrossJurisdiction, requestCrossJurisdictionClear | BLOCKED | owned by the cross-j agent (og cross-J route and book state) |
| j_event, j_broadcast, r2r, r2c, r2e, e2r | HOST-ONLY | the rewrite handles these in the Host J layer (JOp / applyJ), not as entity txs |
| j_rebroadcast, j_abort_sent_batch, j_clear_batch, mintReserves | BLOCKED | og J submit lifecycle (jBatch broadcast / abort state, J adapter) |
