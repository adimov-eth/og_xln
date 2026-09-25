# entity-consensus-2 findings

og (`core/`, `jurisdictions/`) is the spec. Tests: `pure/diff/entity-consensus-2.test.ts` (MATCH vs live og).

| ID | Area | og source | Status | Notes |
|----|------|-----------|--------|-------|
| ER-18 | Leader failover: views, leaderTimeoutVote, timeout certificates | core/entity/consensus/leader/* | FIXED | Leader order (CEO then shares desc), timeout vote hash (`xln.entity.leader-timeout.v1`), certificate build/verify (signer-sorted), prepared-frame relay, leaderState in stateRoot and authorityRoot. The `leader_timeout_vote` hole is removed. The end-to-end view change commits `{B,1,1}` with frameHanko == og buildQuorumHanko. |
| ER-4 | Account hankos via hashesToSign secondary hashes | frame/application.ts proposePendingAccountFrames, hanko/signing.ts | FIXED | Account frames, ACKs and disputes become secondary hashesToSign. A placeholder is filled at install with the buildQuorumHanko shape (sorted signers, recovery 0/1). The rewrite-only `proposeAccount` tx is removed. |
| ER-4b | Quorum board binding (assertQuorumBoardBinding) | hanko/signing.ts | FIXED | See boards.md: enforced at proposal, validator replay and quorumHanko. |
| AC-13 | board_hanko_refresh + previous-board ACK grace | account/consensus/incoming/board-hanko-refresh.ts, ack-commit.ts | FIXED | Consumer side matches og: 800 random refreshes are checked for verdict, reason, installed hanko/record and authority flags. ACK and replay use allowPreviousBoard=true; preflight and refresh use false. `counterpartyBoardHankoRefresh` is committed in the leaf (H7 MATCH). |
| AC-13b | Refresh producer (board-rotation flush), entity counterpartyCertifiedBoard registry | entity board rotation | REMAINING | The registry and counterpartyCertifiedBoard are FIXED (boards.md). The producer is REMAINING because of the crontab hook. |
| ER-15 | Trusted gateway directPayment / gateway forward | tx/handlers/payments/direct-payment.ts, committed-htlc-followups.ts | FIXED | Route must be `[src, gateway, target]`. The first-leg wire matches og. The gateway forwards "Forwarded payment" through the `direct_payment_forward` effect (unified with cross-j) (end-to-end Alice→Bob→Carol). |
| ER-15b | Final-destination receipt | direct-payment.ts | FIXED (n/a) | Unreachable in og: direct needs route length 2 and trusted needs length 3. Nothing to port. |
| ER-24 | Watchtower stale/replay checks | watchtower store | REMAINING | The rewrite's TowerAppointmentV1 is not og's wire shape. The og store needs EncryptedRuntimeRecoveryBundleV1 and serializeTaggedJson digests, a separate storage subsystem. |
| H7-a | Leaf `publicPinned` | lifecycle/open-account.ts resolveOpenAccountPublicPin | FIXED | The opener pins unless `pinPublic===false` or 100 accounts are already pinned. The leaf root matches og. |
| H7-b | Leaf shadow rebalance policy (policyRoot) | open-account.ts | FIXED | entity-txs-3 H7-b: the policy map is seeded, and policyRoot equals og PersistentAccountStateMap root |
| H7-c | Leaf disputePrepare | dispute prepare | FIXED | entity-txs-3 H7-c: disputePrepare and the queued activeDispute are in the leaf |

## Entity tx types (og core/types/entity-tx.ts vs rewrite EntityTx)

| og tx | Status | Notes |
|-------|--------|-------|
| chat, chatMessage | FIXED | No-op state, frame hash MATCH |
| profile-update | FIXED | 300 random updates vs og handleProfileUpdateEntityTx |
| requestCollateral | FIXED | Matches og handler (missing-account skip, wire hash) |
| directPayment (trusted mode) | FIXED | ER-15 |
| openAccount pinPublic | FIXED | H7-a |
| proposeAccount (rewrite-only) | FIXED (removed) | og has no equivalent |
| propose / vote (governance proposals) | FIXED | entity-txs-3 T3-1/T3-2 (inside a signed entityCommand) |
| setHubConfig, setRebalancePolicy | FIXED | entity-txs-3 T3-5/T3-6 |
| proposeAccountsNow, scheduledWake / crontab | REMAINING | og crontab scheduler, and the rewrite does not keep pendingAccountInput bytes (entity-txs-3) |
| initOrderbookExt, placeSwapOffer (og shape), proposeCancelSwap | REMAINING | Needs an orderbook extension subsystem |
| prepareDispute, disputeStart, disputeFinalize | PARTIAL | prepare/start are FIXED (entity-txs-3 T3-7), except orderbook removal, argument override and cross-j. disputeFinalize is REMAINING (finalize-proof selection, crontab) |
| settle_* | REMAINING | og payments/settle.ts entity settlement orchestration is not ported (entity-txs-3) |
| entityProvider* | FIXED | boards.md EP-1..EP-5 |
| boardHandover | REMAINING | boards.md BH-1 |
| entityCommand, runtimeOutput | PARTIAL | entityCommand is FIXED (entity-txs-3 T3-1). runtimeOutput is REMAINING (the cross-j agent owns it) |
| j-batch / r2r / r2c, cross-j, htlcPayment / onion, lending | n/a | Owned by other agents |
