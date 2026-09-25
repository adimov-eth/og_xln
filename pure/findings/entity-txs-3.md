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
| T3-7 | prepareDispute / disputeStart | entity/tx/handlers/dispute | PARTIAL | Ported: cooldown readiness, the admission then evidence order, jBatchState.batch.disputeStarts rows, the batch limits, og status messages, and ogProofBody equal to og canonicalizeProofBodyStruct. Tested on 60 random calls. REMAINING: removing orderbook rows on prepare (the invariant is DISPUTE_PREPARE_ORDERBOOK_REMOVAL_NOT_PORTED). Also remaining: the starter-argument override (DISPUTE_START_ARGUMENT_OVERRIDE_NOT_PORTED), proofs carrying locks, swaps or pulls, and the cross-j route (DISPUTE_START_CROSS_J_ROUTE_MISSING). The live og test has no success-path fixture with a counterparty hanko, so success is checked through the rewrite and the og refusal classes |
| T3-8 | J7 side effects | j-events.ts | REMAINING | The crontab dispute-deadline hook, the jBatch scrub, the counter-proof, and the HTLC / cross-j settlement on finality all need og's crontab and cross-j subsystems |
| ER-4b | Quorum board binding (assertQuorumBoardBinding) | hanko/signing.ts | REMAINING | The check was ported and then reverted. It needs og's certified-board registry (board-registry, 676 lines), and without it 11 fixture tests in entity-runtime, oracle and entity-consensus-2 fail, because they use non-lazy multi-signer ids |
| AC-13b | certified-board registry, refresh producer | entity board rotation | REMAINING | same registry as ER-4b |
| T3-9 | Admission wrapper | local admission | REMAINING | og local admission only dedups lifecycle txs. The rewrite's admitAt runs a trial fold, so policy txs are admitted with a real clock timestamp |
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
| disputeFinalize | BLOCKED | og finalize-proof selection, the timing gates and the crontab hooks (core/entity/tx/handlers/dispute/finalize.ts, crontab) |
| scheduledWake | BLOCKED | og executeCrontab scheduler (core/entity/crontab) |
| proposeAccountsNow | BLOCKED | the rewrite does not keep og's pendingAccountInput bytes |
| boardHandover, entityProviderActivateBoard, entityProviderCancelAction, entityProviderProposeControlBoard, entityProviderReleaseControlShares, entityProviderTransfer | BLOCKED | the certified-board registry and EntityProvider action state (board-registry, entity-provider actions) |
| settle_propose, settle_update, settle_approve, settle_execute, settle_reject | BLOCKED | og entity settlement orchestration (core/entity/tx/handlers/payments/settle.ts: settlement workspace, co-signing, jBatch settle rows) |
| resolveHtlcLock, processHtlcTimeouts | BLOCKED | owned by the htlc agent (paybook lock lifecycle) |
| initOrderbookExt | BLOCKED | owned by the orderbook agent (orderbook extension state) |
| runtimeOutput, crossPullClose, prepareCrossJurisdictionSwap, registerCrossJurisdictionSwap, admitCrossJurisdictionBookOrder, removeCrossJurisdictionBookOrder, crossJurisdictionBookOrderRemoved, crossJurisdictionFillNotice, crossJurisdictionForceSiblingDispute, crossJurisdictionSalvage, materializeCrossJurisdictionClear, materializeCrossJurisdictionSwap, orderbookSweepCrossJurisdiction, requestCrossJurisdictionClear | BLOCKED | owned by the cross-j agent (og cross-J route and book state) |
| j_event, j_broadcast, r2r, r2c, r2e, e2r | HOST-ONLY | the rewrite handles these in the Host J layer (JOp / applyJ), not as entity txs |
| j_rebroadcast, j_abort_sent_batch, j_clear_batch, mintReserves | BLOCKED | og J submit lifecycle (jBatch broadcast / abort state, J adapter) |
