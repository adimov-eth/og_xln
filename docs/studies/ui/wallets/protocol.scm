;; protocol.scm — figures, transactions and laws of the protocol.

;; ─────────────────────────────────────────────────────────────────────────────
;; Figures: numbers about one Account a person could be shown
;; ─────────────────────────────────────────────────────────────────────────────

;; The account as a whole

(figure 'balance-raw :core "DerivedDelta.delta"
  :means (protocol "docs/core/12_invariant.md" "The left party's allocation of the account (the party whose entity id sorts lower). A payment from left to right lowers it and a payment from right to left raises it. Below zero it means left owes right; above the collateral it means right owes left. It is the same number for both parties and is not flipped for the viewer, so for the right party it is not their balance and must never be shown as one."))

(figure 'collateral-total :core "DerivedDelta.collateral"
  :means (protocol "core/account/utils.ts" "All collateral locked in this account for this token, both parties' shares together. It is not mine; only my share of it is."))

(figure 'account-size :core "DerivedDelta.totalCapacity"
  :means (protocol "core/account/utils.ts" "The full width of the account: the collateral plus the credit each side has granted the other (or the debt already drawn, if that is larger). The same number for both parties."))

;; Collateral

(figure 'collateral-mine :core "DerivedDelta.outCollateral"
  :means (protocol "core/account/utils.ts" "My share of the locked collateral, seen from my side of the account. This part of what I hold here is secured: the chain pays it to me in a dispute without the counterparty's help."))

(figure 'collateral-theirs :core "DerivedDelta.inCollateral"
  :means (protocol "core/account/utils.ts" "The counterparty's share of the locked collateral. As they pay me, this share moves to my side."))

;; Unsecured amounts

(figure 'owed-to-me-unsecured :core "DerivedDelta.outPeerCredit"
  :means (protocol "core/account/utils.ts" "Seen from my side: what the counterparty owes me beyond the collateral, with nothing locked behind it. It is drawn from the credit I granted them. I can lose it if they cannot pay."))

(figure 'owed-by-me-unsecured :core "DerivedDelta.inOwnCredit"
  :means (protocol "core/account/utils.ts" "Seen from my side: what I owe the counterparty beyond the collateral, drawn from the credit they granted me. A later cut to my credit line does not erase it."))

(figure 'credit-they-use :core "DerivedDelta.ownCreditUsed"
  :means (protocol "core/types/account.ts" "The same number as owed-to-me-unsecured, under its other name: credit I granted that the counterparty is using."))

(figure 'credit-i-use :core "DerivedDelta.peerCreditUsed"
  :means (protocol "core/types/account.ts" "The same number as owed-by-me-unsecured, under its other name: credit the counterparty granted me that I am using."))

;; Credit lines

(figure 'credit-granted-to-me :core "DerivedDelta.ownCreditLimit"
  :means (protocol "core/account/utils.ts" "The credit line the counterparty granted me: how far I may go into debt to them. It is their risk, not money I have."))

(figure 'credit-i-grant :core "DerivedDelta.peerCreditLimit"
  :means (protocol "core/account/utils.ts" "The credit line I granted the counterparty: how much they may come to owe me with nothing locked behind it. It is my risk."))

(figure 'credit-left-to-me :core "DerivedDelta.outOwnCredit"
  :means (protocol "core/account/utils.ts" "How much more I can still spend on the credit line granted to me, before I hit its limit."))

(figure 'credit-left-to-them :core "DerivedDelta.inPeerCredit"
  :means (protocol "core/account/utils.ts" "How much more the counterparty can still come to owe me on the credit line I granted, before it hits its limit."))

;; Spendable now

(figure 'can-send :core "DerivedDelta.outCapacity"
  :means (protocol "core/account/utils.ts" "Seen from my side: what I can send through this account right now: my collateral share, plus what they owe me, plus unused credit granted to me, minus what is held for pending payments and orders. Part of it may be borrowed."))

(figure 'can-receive :core "DerivedDelta.inCapacity"
  :means (protocol "core/account/utils.ts" "Seen from my side: what I can receive through this account right now: paying off my debt, plus their collateral share, plus unused credit I granted them, minus what they have held. Receiving beyond their collateral share means trusting them."))

(figure 'held-outgoing :core "DerivedDelta.outTotalHold"
  :means (protocol "core/account/tx/hold-utils.ts" "Part of my sending room held for my own payments, swap orders and settlements that have not finished. It comes back if they fail."))

(figure 'held-incoming :core "DerivedDelta.inTotalHold"
  :means (protocol "core/account/tx/hold-utils.ts" "Part of the counterparty's sending room held for their unfinished payments and orders, many of them payments to me that are not yet mine."))

(figure 'set-aside-mine :core "DerivedDelta.outAllowance"
  :means (guess "Value on my side set aside for signed programmable terms that only matter in a dispute. deriveDelta subtracts it from what I can send; in live use I found it written only while building a dispute proof, so it is probably zero on screen."))

(figure 'set-aside-theirs :core "DerivedDelta.inAllowance"
  :means (guess "The same set-aside on the counterparty's side, subtracted from what I can receive; probably zero in live use."))

;; The account's state

(figure 'account-status :core "AccountReplica.status"
  :means (protocol "core/types/account.ts" "Whether this account is in normal use, preparing to leave without the counterparty (normal activity stopped), or in a started dispute."))

(figure 'top-up-pending :core "AccountState.requestedRebalance"
  :means (protocol "core/account/tx/handlers/rebalance/request-collateral.ts" "The collateral I have asked the counterparty to lock on this token and that has not yet arrived. While it is open no new request is made, by me or my wallet's automation."))

;; A payment in flight

(figure 'pending-amount :core "HtlcLock.amount"
  :means (protocol "core/account/tx/handlers/htlc/lock.ts" "The amount of one payment that is promised on this account but not finished. It is held until the recipient proves receipt or it expires."))

(figure 'pending-expires-at :core "HtlcLock.timelock"
  :means (protocol "core/account/tx/handlers/htlc/resolve.ts" "When a pending payment stops being claimable by time (unix milliseconds). It also stops when the chain passes the block deadline, whichever comes first. After that, the payer can take it back."))

(figure 'pending-expires-block :core "HtlcLock.revealBeforeHeight"
  :means (protocol "core/types/account.ts" "The chain block by which a pending payment must be claimed; it is the deadline the chain itself enforces."))

;; A swap order resting at the counterparty

(figure 'order-give :core "SwapOffer.giveAmount"
  :means (protocol "core/types/account.ts" "How much I still offer to give in a swap order. Partial fills reduce it; it stays held while the order is open."))

(figure 'order-want :core "SwapOffer.wantAmount"
  :means (protocol "core/types/account.ts" "How much I want in return for the remaining amount, at the order's price."))

(figure 'order-price :core "SwapOffer.priceTicks"
  :means (protocol "core/types/account.ts" "The order's limit price, in steps of one ten-thousandth of the quote token per unit of the other."))

(figure 'order-max-fee :core "SwapOffer.maxFee"
  :means (protocol "core/types/account.ts" "The most fee I allowed to be charged on what remains of this order."))

(figure 'order-min-receive :core "SwapOffer.minNetReceive"
  :means (protocol "core/types/account.ts" "The least I accept to receive after fees on what remains of this order."))

;; A cross-chain swap leg

(figure 'cross-leg-amount :core "PullCommitment.amount"
  :means (guess "The amount locked on this account for one leg of a swap between two chains."))

(figure 'cross-leg-deadline :core "PullCommitment.deadline"
  :means (protocol "core/types/account.ts" "The signed deadline, in seconds, for revealing the proof that settles a cross-chain swap leg."))

;; Savings and loans with a hub

(figure 'loan-principal :core "AccountLendingCovenant.principal"
  :means (protocol "core/types/account.ts" "The amount lent or borrowed under one savings or loan agreement on this account. It moved when the agreement was funded."))

(figure 'loan-rate :core "AccountLendingCovenant.interestBps"
  :means (protocol "core/types/account.ts" "The agreed interest rate, in hundredths of a percent."))

(figure 'loan-interest-so-far :core "AccountLendingCovenant.accruedInterest"
  :means (protocol "core/types/account.ts" "Interest counted so far, up to the last settled checkpoint."))

(figure 'loan-term :core "AccountLendingCovenant.termMs"
  :means (protocol "core/types/account.ts" "The length of the agreement, in milliseconds."))

(figure 'loan-late-window :core "AccountLendingCovenant.lateMs"
  :means (protocol "core/types/account.ts" "How long simple interest keeps running after maturity; zero for fixed savings."))

;; Leaving without the counterparty

(figure 'exit-window-left :core "AccountState.leftResponseSeconds"
  :means (protocol "core/account/config/dispute-config.ts" "Seconds the left party has to respond in a dispute. Signed when the account opens. Default one hour for a hub, twenty-four hours for anyone else. Mine if my entity id sorts lower."))

(figure 'exit-window-right :core "AccountState.rightResponseSeconds"
  :means (protocol "core/account/config/dispute-config.ts" "Seconds the right party has to respond in a dispute, under the same defaults. Mine if my entity id sorts higher."))

(figure 'exit-ready-at :core "AccountReplica.readyAfter"
  :means (protocol "core/types/account.ts" "When the local pause before a dispute ends and the dispute can be sent to the chain. The chain never sees this time."))

(figure 'exit-started-by-left :core "AccountReplica.startedByLeft"
  :means (protocol "core/types/account.ts" "Whether the party that put the dispute on the chain is the left party. It is not flipped for the viewer: I started it if I am left and this is true, or I am right and it is false."))

(figure 'exit-ends-at :core "AccountReplica.disputeTimeout"
  :means (protocol "core/types/account.ts" "The moment, in seconds, at which a started dispute's challenge window ends and it can be finished on the chain."))

;; Fees the counterparty or a hub can charge

(figure 'route-fee-rate :core "EntityTxPayload.routingFeePPM"
  :means (protocol "core/pathfinding/htlc-quote.ts" "A hub's fee for forwarding a payment, in millionths of the amount, adjusted by how much room the hub has in that direction. Default one millionth."))

(figure 'route-base-fee :core "EntityTxPayload.baseFee"
  :means (protocol "core/pathfinding/htlc-quote.ts" "A hub's flat fee per forwarded payment, added to its rate. Default zero."))

(figure 'swap-fee-rate :core "EntityTxPayload.swapTakerFeeBps"
  :means (protocol "core/entity/tx/handlers/account/lifecycle/admin.ts" "A hub's fee on swaps that take an existing order, in hundredths of a percent. Default zero."))

(figure 'pay-most-debited :core "EntityTxPayload.maxSenderDebit"
  :means (protocol "core/types/entity-tx.ts" "The most I agree to be debited for a routed payment, the amount plus every hub's fee along the way."))

(figure 'top-up-fee-paid :core "AccountTx.feeAmount"
  :means (protocol "core/account/tx/handlers/rebalance/request-collateral.ts" "The fee I prepay when I ask the counterparty to lock more collateral; it is taken from my side at the moment I ask."))

(figure 'top-up-base-fee :core "AccountTx.baseFee"
  :means (protocol "core/account/tx/handlers/rebalance/policy.ts" "The counterparty's flat fee for locking more collateral at my request, as they last announced it on this account."))

(figure 'top-up-rate :core "AccountTx.liquidityFeeBps"
  :means (protocol "core/account/tx/handlers/rebalance/policy.ts" "The counterparty's fee for locking more collateral, in hundredths of a percent of the amount locked."))

(figure 'top-up-chain-fee :core "AccountTx.gasFee"
  :means (protocol "core/account/tx/handlers/rebalance/policy.ts" "The counterparty's flat charge for chain costs when locking more collateral."))

(figure 'fee-notice :core "AccountTx.noticePeriodSeconds"
  :means (protocol "core/account/config/term-notice.ts" "How long a worse collateral fee waits before it applies to me, counted from its announcement under the notice period of the terms in force. Default thirty days. A shorter notice period also counts as worse."))

(figure 'auto-top-up-at :core "EntityTxPayload.r2cRequestSoftLimit"
  :means (protocol "core/account/tx/handlers/rebalance/request-collateral.ts" "When what the counterparty owes me without collateral reaches this amount, my wallet asks them to lock more collateral by itself and pays the fee. The request is for the whole unsecured amount. A new account starts with this switched on for every standard token (by code default 500 dollars' worth as the trigger, unless the jurisdiction's config says otherwise); it is off only when this equals the ceiling."))

(figure 'auto-top-up-max-fee :core "EntityTxPayload.maxAcceptableFee"
  :means (protocol "core/account/tx/handlers/rebalance/request-collateral.ts" "The most fee my wallet may pay on its own for one automatic collateral request."))

(figure 'auto-top-up-hard :core "EntityTxPayload.hardLimit"
  :means (protocol "core/account/tx/handlers/rebalance/request-collateral.ts" "A ceiling stored with the automatic collateral policy. It must be at least the trigger amount, and when it equals the trigger the automatic request is skipped (manual mode). I found no other place that reads it. By code default 10,000 dollars' worth."))

;; A cooperative settlement proposal

(figure 'settle-reserve-left :core "SettlementDiff.leftDiff"
  :means (protocol "core/types/account.ts" "How a proposed settlement changes the left party's money on the chain outside the account. A negative number takes from it."))

(figure 'settle-reserve-right :core "SettlementDiff.rightDiff"
  :means (protocol "core/types/account.ts" "How a proposed settlement changes the right party's money on the chain outside the account."))

(figure 'settle-collateral :core "SettlementDiff.collateralDiff"
  :means (protocol "core/types/account.ts" "How a proposed settlement changes the collateral locked in the account. The three changes always sum to zero."))

;; ─────────────────────────────────────────────────────────────────────────────
;; Transactions a wallet holder could be asked to sign
;; ─────────────────────────────────────────────────────────────────────────────

;; The envelope

(tx 'signed-command :core "entityCommand"
  :does (protocol "core/types/entity-tx.ts" "The signed envelope one board member puts around any list of the actions below. Nothing in it moves money by itself; the other board members check and replay it before it counts."))

;; Opening and credit

(tx 'open-account :core "openAccount"
  :does (protocol "core/entity/tx/handlers/account/lifecycle/open-account.ts" "Open an account with one counterparty and fix both sides' dispute response times. It creates the account with the standard tokens at zero and installs the default automatic collateral top-up for each. It can grant the counterparty a credit line in the same step, which is risk I take on, and by default lists this account publicly in my routing profile."))

(tx 'grant-credit :core "extendCredit"
  :does (protocol "core/entity/tx/handlers/account/lifecycle/admin.ts" "Set the credit line I grant one counterparty to an exact amount. Raising it lets them owe me more with nothing locked behind it; lowering it blocks new debt but does not erase what they already owe."))

(tx 'ask-credit :core "requestCredit"
  :does (protocol "core/entity/tx/handlers/account/credit-request.ts" "Ask a hub to grant me a credit line. It moves no money; the hub answers by raising my line up to a fixed cap (1,000 dollars' worth per request in code), and never lowers a larger line I already have. A token with no reference rate gets no grant."))

(tx 'credit-line-set :core "set_credit_limit"
  :does (protocol "core/account/tx/handlers/balance/set-credit-limit.ts" "Account-level form of a credit grant. Whoever proposes it sets the line they grant the other side; when the counterparty proposes it, my credit line changes."))

(tx 'credit-ask-step :core "credit_request"
  :does (protocol "core/account/tx/handlers/balance/credit-request.ts" "Account-level form of asking for credit. It records the request only; balances are untouched, and the same request cannot be answered twice."))

(tx 'token-add :core "add_delta"
  :does (protocol "core/account/tx/handlers/balance/add-delta.ts" "Add a token to an account with everything at zero. Either side may propose it."))

;; Paying

(tx 'pay-direct :core "directPayment"
  :does (protocol "core/entity/tx/handlers/payments/direct-payment.ts" "Pay at once and without conditions, either straight to my counterparty or through one named go-between I trust to pass it on. The payment to the go-between is unconditional."))

(tx 'pay-leg :core "direct_payment"
  :does (protocol "core/account/tx/handlers/balance/direct-payment.ts" "Account-level form of an unconditional payment. The side that proposes it is the payer; when the counterparty proposes it, I am paid."))

(tx 'pay-routed :core "htlcPayment"
  :does (protocol "core/entity/tx/handlers/htlc/payment.ts" "Pay someone through one or more hubs. The amount plus every hub's fee is held on my first account up to the limit I set, and moves only if the recipient proves receipt before the deadline; otherwise it returns to me. The deadline is about two minutes or more in instant mode (longer with more hubs) and about a day in async mode."))

(tx 'pay-lock :core "htlc_lock"
  :does (protocol "core/account/tx/handlers/htlc/lock.ts" "Account-level form of one step of a routed payment. The payer's side holds the amount until the recipient proves receipt or time runs out; when the counterparty proposes it, an incoming payment is promised but not yet mine."))

(tx 'claim-payment :core "resolveHtlcLock"
  :does (protocol "core/entity/tx/handlers/htlc/direct.ts" "Claim a pending payment on one account by revealing the secret that proves it was received. The held amount then moves to my side."))

(tx 'pay-unlock :core "htlc_resolve"
  :does (protocol "core/account/tx/handlers/htlc/resolve.ts" "Account-level end of a pending payment: with the secret, the amount moves to the recipient; with a failure, the hold is released back to the payer. Before the deadline only the recipient can end it."))

;; Collateral and money on the chain

(tx 'fund-account :core "r2c"
  :does (protocol "core/entity/tx/handlers/j-batch/r2c.ts" "Move my money from the chain into an account's collateral. By default it becomes my secured share in that account once the chain confirms it; it can instead name another entity as the one it is credited to. It queues for the next chain submission and is refused if my spendable money on the chain, after debts, is too small."))

(tx 'ask-top-up :core "requestCollateral"
  :does (protocol "core/account/tx/handlers/rebalance/request-collateral.ts" "Ask the counterparty to lock more of their money as collateral in our account, so less of what they owe me is unsecured. The fee is taken from my side immediately, at their announced price, and when it is in the same token the request is for the amount minus the fee. Only one request per token can be open; a second is ignored until the first is finished."))

(tx 'top-up-ask-step :core "request_collateral"
  :does (protocol "core/account/tx/handlers/rebalance/request-collateral.ts" "Account-level form of a collateral request. It debits the prepaid fee in the same step and is rejected if my sending room cannot cover the fee; for a hub, receiving one is an order it has been paid to fill."))

(tx 'top-up-refund :core "rebalance_refund"
  :does (protocol "core/account/tx/handlers/rebalance/refund.ts" "The counterparty returns all or part of a prepaid collateral fee, for example when the request timed out. Only the side that was paid can propose it."))

(tx 'top-up-terms :core "rebalance_policy"
  :does (protocol "core/account/tx/handlers/rebalance/policy.ts" "The counterparty announces its collateral fees on this account. A worse fee applies only after the notice period; a better one applies at once."))

(tx 'set-auto-top-up :core "setRebalancePolicy"
  :does (protocol "core/entity/tx/handlers/account/lifecycle/admin.ts" "Let my wallet ask a counterparty for more collateral by itself when their unsecured debt to me reaches a set amount, paying each fee up to a set maximum without asking me again."))

(tx 'send-from-reserve :core "r2r"
  :does (protocol "core/entity/tx/handlers/j-batch/r2r.ts" "Send my money on the chain, outside any account, to another entity. It queues for the next chain submission."))

(tx 'withdraw-out :core "r2e"
  :does (protocol "core/entity/tx/handlers/j-batch/r2e.ts" "Send my money on the chain out to an ordinary external address, leaving the protocol. It queues for the next chain submission and fails if debts recorded against me take precedence."))

(tx 'deposit-in :core "e2r"
  :does (protocol "core/entity/tx/handlers/j-batch/e2r.ts" "Bring tokens from an ordinary external address into my money on the chain. It queues for the next chain submission."))

(tx 'chain-submit :core "j_broadcast"
  :does (protocol "core/entity/tx/handlers/j-batch/j-broadcast.ts" "Sign and send every queued chain action as one batch. This is the step that actually costs chain fees and makes queued deposits, withdrawals, settlements and disputes happen."))

(tx 'chain-resubmit :core "j_rebroadcast"
  :does (protocol "core/entity/tx/handlers/j-batch/j-rebroadcast.ts" "Send the same pending batch again unchanged, optionally with a higher chain fee."))

(tx 'chain-abandon :core "j_abort_sent_batch"
  :does (protocol "core/entity/tx/handlers/j-batch/j-abort-sent-batch.ts" "Give up on a batch already sent, either dropping it or moving its actions back into the queue."))

(tx 'chain-clear :core "j_clear_batch"
  :does (protocol "core/entity/tx/handlers/j-batch/j-clear-batch.ts" "Throw away queued chain actions that have not been signed yet. It does not cancel settlements under negotiation."))

(tx 'chain-event-claim :core "j_event_claim"
  :does (guess "Record finished chain events, such as a deposit into collateral or a settlement, into the account so both sides agree on them. Proposed automatically by either side."))

;; Settling cooperatively

(tx 'settle-propose :core "settle_propose"
  :does (protocol "core/types/account.ts" "Propose a settlement with the counterparty: move money between my chain money and the account's collateral, pay them on the chain, or forgive a debt. Taking collateral back to my chain money this way needs their signature."))

(tx 'settle-change :core "settle_update"
  :does (protocol "core/entity/tx/handlers/payments/settle.ts" "Replace the operations of a settlement still under negotiation."))

(tx 'settle-approve :core "settle_approve"
  :does (protocol "core/entity/tx/handlers/payments/settle.ts" "Sign the counterparty's settlement proposal. One cannot approve one's own proposal. A settlement that takes from my chain money or my collateral share, forgives a debt, or uses a raw custom movement is never signed for me automatically."))

(tx 'settle-submit :core "settle_execute"
  :does (protocol "core/entity/tx/handlers/payments/settle.ts" "Queue an approved settlement for the chain. Only the side chosen to submit does this."))

(tx 'settle-reject :core "settle_reject"
  :does (protocol "core/entity/tx/handlers/payments/settle.ts" "Drop a settlement under negotiation without carrying it out."))

(tx 'settle-step :core "settle_transition"
  :does (protocol "core/types/account.ts" "Account-level form of every settlement step. Creating or changing a settlement also holds the amounts it would move."))

;; Leaving without the counterparty

(tx 'exit-prepare :core "prepareDispute"
  :does (protocol "core/entity/tx/handlers/dispute/index.ts" "Begin leaving an account without the counterparty. Normal activity on it stops, my open orders there are withdrawn, and an optional local pause runs before anything reaches the chain."))

(tx 'exit-start :core "disputeStart"
  :does (protocol "core/entity/tx/handlers/dispute/start.ts" "Put my latest jointly signed state of the account on the chain. The challenge window starts; the counterparty may answer with a newer signed state."))

(tx 'exit-finish :core "disputeFinalize"
  :does (protocol "core/entity/tx/handlers/dispute/finalize.ts" "Close a started dispute once the rules allow it. The chain pays each side its collateral share; anything owed beyond that is taken from the debtor's money on the chain if there is any, and the rest is recorded as a debt. It can reveal secrets for payments I was owed, so they count."))

;; Swaps

(tx 'swap-place :core "placeSwapOffer"
  :does (protocol "core/account/tx/handlers/swap/offer/commit.ts" "Place a swap order at a hub: offer one token for another at a limit price. The amount I offer is held in my account with the hub while the order is open."))

(tx 'swap-offer-step :core "swap_offer"
  :does (protocol "core/account/tx/handlers/swap/offer/commit.ts" "Account-level form of a swap order. When a user proposes it to a hub, the hub's account with that user holds the user's offered amount."))

(tx 'swap-cancel :core "proposeCancelSwap"
  :does (protocol "core/account/tx/handlers/swap/lifecycle/cancel.ts" "Ask the hub to cancel my open swap order. It is only a request; the hub carries out the cancellation, and the held amount stays held until it does."))

(tx 'swap-cancel-step :core "swap_cancel_request"
  :does (protocol "core/account/tx/handlers/swap/lifecycle/cancel.ts" "Account-level form of a cancellation request. It changes nothing in the account."))

(tx 'swap-fill :core "swap_resolve"
  :does (protocol "core/account/tx/handlers/swap/resolve/index.ts" "The hub fills all or part of my order, exchanging both tokens in one step and taking its fee, and keeps or cancels what is left. Only the side that did not place the order can propose it."))

(tx 'swap-across-start :core "prepareCrossJurisdictionSwap"
  :does (guess "Start a swap whose two tokens live on different chains, by stating the route and terms; the hubs on each side then pair the two legs."))

(tx 'swap-across-authorize :core "registerCrossJurisdictionSwap"
  :does (guess "Authorize the paired legs of a cross-chain swap, so the amount on my side is locked against a proof that settles both chains."))

(tx 'swap-across-close :core "requestCrossJurisdictionClear"
  :does (guess "Ask the hub to settle a cross-chain order at its current fill, optionally cancelling the rest."))

(tx 'swap-across-settle :core "crossPullClose"
  :does (guess "Settle one leg of a cross-chain swap on an account by presenting the revealed proof of how much was filled."))

(tx 'swap-across-recover :core "crossJurisdictionSalvage"
  :does (protocol "core/entity/tx/handlers/cross-j/salvage.ts" "Recover my side of a cross-chain swap after the hub has claimed the other side on its chain, by registering the published proof on my chain under my own key."))

(tx 'cross-lock :core "cross_pull_lock"
  :does (guess "Account-level lock of an amount for one cross-chain swap leg, released by a proof before a signed deadline."))

(tx 'cross-close :core "cross_pull_close"
  :does (guess "Account-level settlement of a cross-chain swap leg at the proven fill."))

;; Savings and loans with a hub

(tx 'lend :core "lendingOffer"
  :does (protocol "core/account/tx/handlers/balance/lending.ts" "Lend my own money to a hub as savings, fixed or on demand, at a stated rate. Only money I already hold counts; credit granted to me cannot fund it."))

(tx 'lend-fund-step :core "lending_fund"
  :does (protocol "core/account/tx/handlers/balance/lending.ts" "Account-level form of lending to a hub; the principal moves to the hub's side and a savings agreement is recorded."))

(tx 'lend-withdraw :core "lendingClosePosition"
  :does (protocol "core/entity/tx/handlers/payments/lending.ts" "Ask the hub to close my savings and pay it back. The hub completes it with a payout."))

(tx 'lend-close-step :core "lending_close_request"
  :does (protocol "core/account/tx/handlers/balance/lending.ts" "Account-level form of asking to close savings; it records the choice between early and mature closing."))

(tx 'lend-payout :core "lending_close_payout"
  :does (protocol "core/account/tx/handlers/balance/lending.ts" "The hub pays back savings, at least the principal, and the agreement ends in the same step."))

(tx 'lend-rate-change :core "lending_rate"
  :does (protocol "core/account/tx/handlers/balance/lending.ts" "The hub sets a new rate on on-demand savings, for the future only. Only the hub proposes it."))

(tx 'borrow :core "lendingBorrow"
  :does (protocol "core/entity/tx/handlers/payments/lending.ts" "Ask a hub for a loan, stating the most interest and lateness I accept and when the request expires."))

(tx 'borrow-ask-step :core "lending_borrow_request"
  :does (protocol "core/account/tx/handlers/balance/lending.ts" "Account-level form of a loan request. Only this signed request lets the hub create a debt for me."))

(tx 'borrow-paid-out :core "lending_disburse"
  :does (protocol "core/account/tx/handlers/balance/lending.ts" "The hub pays out a loan within the terms I asked for; I now owe the principal plus interest. Only the hub proposes it."))

(tx 'repay :core "lendingRepay"
  :does (protocol "core/types/entity-tx.ts" "Repay all or part of a loan, up to an amount I set; I am never charged more than is owed."))

(tx 'repay-step :core "lending_repay"
  :does (protocol "core/types/account.ts" "Account-level form of a repayment, bound to the exact current state of the loan so it cannot be charged twice."))

(tx 'lend-terms :core "lendingSetTerms"
  :does (protocol "core/entity/tx/handlers/payments/lending-policy.ts" "A lending hub sets its savings rate, loan rate and late terms for one token until a given time. Only the hub's own board can do this."))

(tx 'lend-approve :core "lendingApprove"
  :does (protocol "core/entity/tx/handlers/payments/lending-policy.ts" "A lending hub approves one borrower for loans up to an amount until a given time. A borrower cannot approve themself."))

;; Running a hub

(tx 'hub-terms :core "setHubConfig"
  :does (protocol "core/entity/tx/handlers/account/lifecycle/admin.ts" "Declare this entity a hub and set its forwarding fees, swap fee, collateral fees and notice period. New collateral fees are sent to every account it has."))

(tx 'market-open :core "initOrderbookExt"
  :does (protocol "core/entity/tx/handlers/system/basic.ts" "A hub opens a swap market: the pairs it lists, the minimum trade, and how the spread is split between maker, taker, hub and referrers."))

;; Governing an entity with several signers

(tx 'board-propose :core "propose"
  :does (protocol "core/entity/tx/handlers/system/basic.ts" "Propose an action for the entity's board. If my voting weight alone reaches the threshold it happens at once; otherwise it waits for votes."))

(tx 'board-vote :core "vote"
  :does (protocol "core/entity/tx/handlers/system/basic.ts" "Vote yes or no on a board proposal. When yes votes reach the threshold, the proposed actions run."))

(tx 'note :core "chat"
  :does (protocol "core/entity/tx/handlers/system/basic.ts" "Record a short message in the entity's own history. It moves no money."))

(tx 'message :core "chatMessage"
  :does (protocol "core/entity/tx/handlers/system/basic.ts" "Record a message with optional details about an account. It moves no money."))

(tx 'shares-transfer :core "entityProviderTransfer"
  :does (protocol "core/types/entity-tx.ts" "Transfer some of this entity's ownership shares. Only the board acting together can do it."))

(tx 'shares-release :core "entityProviderReleaseControlShares"
  :does (protocol "core/types/entity-tx.ts" "Release control and dividend shares to a custodian the board chose. Only the board acting together can do it."))

(tx 'shares-cancel :core "entityProviderCancelAction"
  :does (protocol "core/types/entity-tx.ts" "Cancel this entity's current pending ownership action. Only the board acting together can do it."))

(tx 'board-replace :core "entityProviderProposeControlBoard"
  :does (protocol "core/entity/tx/handlers/control-board-proposal.ts" "As a shareholder, vote to replace another entity's board with a specific new one."))

(tx 'board-activate :core "entityProviderActivateBoard"
  :does (protocol "core/types/entity-tx.ts" "Put an approved new board into effect once its waiting period has passed. Anyone may send it."))

;; ─────────────────────────────────────────────────────────────────────────────
;; Laws: what the protocol guarantees or refuses
;; ─────────────────────────────────────────────────────────────────────────────

(law 'accounts-are-bilateral :source "docs/core/12_invariant.md"
  :quote "Accounts are bilateral financial relationships between entities."
  :means "Every balance is a relationship with one named counterparty. There is no balance held by the network as a whole.")

(law 'balance-bound :source "docs/core/12_invariant.md"
  :quote "−leftCreditLimit ≤ Δ ≤ collateral + rightCreditLimit"
  :means "In each account and token, left's allocation cannot fall below minus the credit right granted it, and cannot rise above the collateral plus the credit left granted right. So nobody can be owed more without collateral than the credit they granted, and nobody can owe more than the credit granted to them.")

(law 'collateral-split :source "docs/core/12_invariant.md"
  :quote "Left receives Δ; Right receives the remaining collateral"
  :means "The locked collateral is split between the two sides by their current balance. Whatever lies beyond the collateral is a debt from one side to the other.")

(law 'collateral-secured :source "docs/core/12_invariant.md"
  :quote "Only the claimant's allocated share of actual collateral is secured; the total collateral must never be promised independently to both parties."
  :means "Only my share of the locked collateral is safe if the counterparty disappears. The whole collateral is never mine to count.")

(law 'credit-not-money :source "docs/core/12_invariant.md"
  :quote "A credit limit caps the grantor's accepted unsecured risk on this account and asset. It is not money, collateral or a repayment guarantee."
  :means "A credit line is how much someone agrees to be owed without security. Credit granted to me is not my money, and credit I grant is risk I carry.")

(law 'credit-direction :source "core/account/utils.ts"
  :quote "From viewer isLeft: ownCreditLimit = peer granted us; peerCreditLimit = we granted peer."
  :means "For the person looking, the credit line marked as their own is the one the counterparty gave them, and the one marked as the counterparty's is the one they gave.")

(law 'credit-starts-zero :source "core/account/utils.ts"
  :quote "CRITICAL: Default credit is 0 - credit must be explicitly extended via set_credit_limit"
  :means "A new account grants no credit either way. Someone has to choose to grant it.")

(law 'credit-cut-keeps-debt :source "docs/core/12_invariant.md"
  :quote "Credit-limit reductions govern new admission and cannot retroactively eliminate existing signed exposure."
  :means "Lowering a credit line stops new borrowing. It cannot erase debt already owed, in either direction.")

(law 'unsecured-no-seizure :source "jurisdictions/contracts/Depository.sol"
  :quote "interest, no external claim and no seizure right: the jurisdiction can"
  :means "What is owed beyond the collateral is first taken from the debtor's money on the chain; whatever remains becomes a debt that earns no interest and gives no right to take anything else. The chain can only collect it from money that later arrives for the debtor in the same token. It can be lost entirely.")

(law 'exit-alone :source "docs/core/00_QA.md"
  :quote "claim the secured entitlement under J's rules; any remaining unsecured receivable follows the actual reserve/debt enforcement path."
  :means "Anyone can leave an account without the counterparty's help. The rules entitle them to their collateral share; anything the counterparty owed beyond it is paid from the counterparty's money on the chain if there is any, and the rest only if and when more arrives.")

(law 'exit-timing :source "docs/core/00_QA.md"
  :quote "Current code sums signed hub/user windows, yielding 25 hours with the default one-hour/24-hour policy."
  :means "As the code stands today, the challenge window of a dispute is both sides' response times added together: twenty-five hours between a person and a hub by default. The document says this rule may still change. The side that started it must wait the whole window.")

(law 'exit-early-if-answered :source "core/entity/tx/handlers/dispute/finalize.ts"
  :quote "the starter has no fresh response from its peer and therefore waits T"
  :means "Whoever starts a dispute waits the whole window. The counterparty may instead accept the state the starter put forward and end it at once, except when a cross-chain swap leg is open on the account, or when a newer state was registered on the chain: then both wait for the window (and for every swap deadline).")

(law 'keep-evidence :source "docs/core/10_UFT.md"
  :quote "Parties or their delegates must retain their own usable evidence."
  :means "Each side keeps its own evidence, and a person who leaves alone needs theirs: the last state both sides signed. Nobody else is obliged to supply it, so a lost device or a helper that did not keep it is the holder's loss.")

(law 'hub-is :source "docs/core/11_Jurisdiction_Machine.md"
  :quote "In the implementation, a hub is a Runtime with the hub role, serving financial relationships through its jurisdiction-specific Entities."
  :means "A hub is an ordinary entity running with the hub role, serving financial relationships with others. What a hub decides alone inside an account is stated in the transactions above: filling or cancelling swap orders placed with it, announcing fees with notice, and setting rates on savings it holds.")

(law 'hub-failure-spreads :source "docs/core/12_invariant.md"
  :quote "Bounds constrain direct account exposure; a common hub failure can still affect many accounts and routes at once."
  :means "Limits cap what one account can lose, but when a hub that many people use fails, all of their unsecured amounts with it are at risk together.")

(law 'entity-is :source "docs/core/11_Jurisdiction_Machine.md"
  :quote "An E-machine represents a person or organization with authority rules, state and financial relationships."
  :means "An entity is a person or an organization. It owns accounts and decides through its own rules who may act for it.")

(law 'entity-signers :source "docs/core/rjea-architecture.md"
  :quote "Validators replay the exact transactions and sign the exact frame and secondary hash manifest. The candidate installs only after certification."
  :means "An entity's actions are replayed and signed by its validators and take effect only after that certification. A single person is an entity with one signer, going through the same steps with an immediate local certificate.")

(law 'auto-top-up-default :source "core/account/config/defaults.ts"
  :quote "Both sides seed byte-identical Account rebalance policy from committed"
  :means "A new account starts with automatic collateral top-up already on for both sides, using the jurisdiction's defaults (in code, trigger 500 dollars' worth, ceiling 10,000, fee limit 15). Nobody asks the person; turning it off is a later choice.")

(law 'pay-routed-locks :source "core/account/tx/handlers/htlc/lock.ts"
  :quote "Creates conditional payment, holds capacity until reveal/timeout"
  :means "A payment through hubs is promised on each account along the way at once, and becomes final on all of them only when the recipient proves receipt.")

(law 'pay-fails-returns :source "core/account/tx/handlers/htlc/resolve.ts"
  :quote "Payment failed — release hold, propagate reason backward"
  :means "A payment that does not complete is undone on every account it touched, and the payer gets the held amount back with the reason.")

(law 'payer-cannot-recall :source "core/account/tx/handlers/htlc/resolve.ts"
  :quote "Only beneficiary can release an active HTLC; payer can cancel only after expiry"
  :means "Once a payment is on its way, the payer cannot take it back before its deadline. Only the recipient's side can turn it down early.")

(law 'route-fee-cap :source "core/types/entity-tx.ts"
  :quote "Caller-authorized maximum gross first-hop lock, including all route fees."
  :means "Before a routed payment leaves, the payer sets the most it may cost in total, fees included. It cannot be charged more.")

(law 'collateral-fee-prepaid :source "core/account/tx/handlers/rebalance/request-collateral.ts"
  :quote "Request frame debits prepaid fee immediately (user pays hub upfront)"
  :means "Asking a counterparty to lock more collateral costs a fee paid at the moment of asking, before the collateral arrives. It is refunded only if the counterparty sends it back.")

(law 'fee-rise-notice :source "core/account/config/term-notice.ts"
  :quote "Any increased component can hurt a customer, even if another fee falls."
  :means "If any part of a counterparty's collateral fee goes up, the old fees keep applying until the notice period has passed, thirty days by default.")

(law 'swap-cancel-ask-only :source "core/account/tx/handlers/swap/lifecycle/cancel.ts"
  :quote "Maker can only REQUEST cancellation. Counterparty/hub decides final cancel via swap_resolve."
  :means "Someone with an open swap order cannot cancel it on their own. They can only ask the hub, and the amount stays held until the hub acts.")

(law 'settle-needs-me :source "core/protocol/settlement/operations.ts"
  :quote "If my reserve decreases, I need to manually approve"
  :means "A cooperative settlement that lowers my money on the chain is never signed for me automatically. The same holds in the code for ones that lower my collateral share, forgive a debt or use a raw custom movement. One that only adds to my side may be signed for me.")
