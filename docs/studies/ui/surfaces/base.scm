;; base.scm — Shared xln runtime projections, verbs, and 16-screen disposition map (DSL v3).
;; Grounded against origin/main (bdc53c7b -> 8f8a4a6a): shared by React (ui/) and Svelte (frontend/).

;; ── 1. Canonical Figures (each :source resolves to AST; :term links to surface :terms) ───────────
(figure 'everyday-cash
  :term    'cash
  :meaning (from-code "frontend/src/lib/everyday/everyday-projection.ts" "Unified spendable Cash (onchain + reserve + hub/peer secured collateral), strictly excluding transient arriving hub float.")
  :source  "EverydayProjection.cash")

(figure 'arriving-cash
  :term    'arriving
  :meaning (from-code "frontend/src/lib/everyday/everyday-projection.ts" "Transient hub float currently auto-settling into Cash, kept strictly separate until confirmed on-chain.")
  :source  "EverydayProjection.arriving")

(figure 'friends-tabs
  :term    'people
  :meaning (from-code "frontend/src/lib/everyday/everyday-projection.ts" "Splitwise-style per-person balances ('Alex owes you' / 'You owe Sam') from !isHub accounts, kept separate from Cash.")
  :source  "EverydayProjection.friendTabs")

(figure 'savings-balance
  :term    'savings
  :meaning (from-code "ui/src/screens/Lending.tsx" "Opt-in interest-bearing savings balance, kept clearly separate from everyday Cash.")
  :source  "WalletView.frame")

(figure 'secured-receivable
  :term    'secured
  :meaning (from-code "ui/src/runtime/views.ts" "Receivable backed by collateral locked on-chain in the XLN contract.")
  :source  "TokenTotals.secured")

(figure 'unbacked-exposure
  :term    'unbacked
  :meaning (from-code "ui/src/runtime/views.ts" "Receivable backed only by counterparty signature without collateral.")
  :source  "TokenTotals.risk")

(figure 'owed-payable
  :term    'owed
  :meaning (from-code "ui/src/runtime/views.ts" "Account liabilities and unresolved on-chain obligations we owe.")
  :source  "TokenTotals.owed")

(figure 'net-position
  :term    'net
  :meaning (from-code "ui/src/runtime/views.ts" "Summed net token position across wallet, reserve, secured, and unbacked.")
  :source  "TokenTotals.net")

(figure 'onchain-cash
  :term    'onchain
  :meaning (from-code "ui/src/runtime/views.ts" "Funds held directly at the user's blockchain address outside the XLN contract.")
  :source  "TokenTotals.onchain")

(figure 'reserve-cash
  :term    'reserve
  :meaning (from-code "ui/src/runtime/views.ts" "Unallocated funds in the XLN contract not assigned to a bilateral Account.")
  :source  "TokenTotals.reserve")

(figure 'send-capacity
  :term    'send-room
  :meaning (from-code "ui/src/runtime/views.ts" "Instant outbound payment room across active accounts.")
  :source  "TokenTotals.sendCapacity")

(figure 'receive-capacity
  :term    'receive-room
  :meaning (from-code "ui/src/runtime/views.ts" "Instant inbound receive room across active accounts.")
  :source  "TokenTotals.receiveCapacity")

(figure 'peer-credit-granted
  :term    'peer-credit
  :meaning (from-code "core/types/account.ts" "Uncollateralized credit ceiling we granted to a counterparty.")
  :source  "DerivedDelta.peerCreditLimit")

(figure 'own-credit-granted
  :term    'own-credit
  :meaning (from-code "core/types/account.ts" "Uncollateralized credit ceiling a counterparty granted to us.")
  :source  "DerivedDelta.ownCreditLimit")

(figure 'account-lanes
  :term    'lanes
  :meaning (from-code "ui/src/runtime/views.ts" "All bilateral Account projections, capacities, and hub flags.")
  :source  "WalletView.accounts")

(figure 'orderbook-frame
  :term    'book
  :meaning (from-code "ui/src/runtime/views.ts" "Resting same-J and cross-J orderbook quotes in the committed view frame.")
  :source  "WalletView.frame")

(figure 'dispute-phase
  :term    'dispute
  :meaning (from-code "ui/src/runtime/views.ts" "Active on-chain dispute phase and response timer for an Account.")
  :source  "AccountView.dispute")

(figure 'entity-board
  :term    'board
  :meaning (from-code "ui/src/runtime/views.ts" "Entity signer summaries and multi-sig Hanko threshold metadata.")
  :source  "WalletView.summaries")

;; ── 2. Canonical Verbs (each :tx resolves to EntityTx / AccountTx or explicit local wallet op) ────
(verb 'send-direct       :layer 'entity  :tx "directPayment"                :summary (from-code "core/types/entity-tx.ts" "Send direct bilateral payment on an Account."))
(verb 'send-routed       :layer 'entity  :tx "htlcPayment"                  :summary (from-code "core/types/entity-tx.ts" "Send hash-locked payment across hub hops."))
(verb 'open-account      :layer 'entity  :tx "openAccount"                  :summary (from-code "core/types/entity-tx.ts" "Open a bilateral Account with optional initial parameters."))
(verb 'request-cover     :layer 'entity  :tx "requestCollateral"            :summary (from-code "core/types/entity-tx.ts" "Ask counterparty to lock on-chain collateral against debt."))
(verb 'extend-peer-tab   :layer 'entity  :tx "extendCredit"                 :summary (from-code "core/types/entity-tx.ts" "Grant a bounded bilateral credit ceiling to a counterparty."))
(verb 'set-hub-credit    :layer 'account :tx "set_credit_limit"             :summary (from-code "core/types/account.ts" "Configure routing/hub credit limit on an Account."))
(verb 'instant-swap      :layer 'entity  :tx "placeSwapOffer"               :summary (from-code "core/types/entity-tx.ts" "Take immediate liquidity from the best available swap quote."))
(verb 'place-limit-order :layer 'entity  :tx "placeSwapOffer"               :summary (from-code "core/types/entity-tx.ts" "Post or manage a resting limit order on the book."))
(verb 'cancel-order      :layer 'entity  :tx "proposeCancelSwap"            :summary (from-code "core/types/entity-tx.ts" "Cancel an open resting swap offer."))
(verb 'cross-j-swap      :layer 'entity  :tx "prepareCrossJurisdictionSwap" :summary (from-code "core/types/entity-tx.ts" "Execute atomic cross-jurisdiction swap across two chains."))
(verb 'move-r2c          :layer 'entity  :tx "r2c"                          :summary (from-code "core/types/entity-tx.ts" "Allocate XLN contract reserve into bilateral Account collateral."))
(verb 'move-r2r          :layer 'entity  :tx "r2r"                          :summary (from-code "core/types/entity-tx.ts" "Transfer XLN contract reserve between Entities."))
(verb 'move-r2e          :layer 'entity  :tx "r2e"                          :summary (from-code "core/types/entity-tx.ts" "Withdraw XLN contract reserve to external blockchain wallet."))
(verb 'rebalance-policy  :layer 'entity  :tx "setRebalancePolicy"           :summary (from-code "core/types/entity-tx.ts" "Configure automatic r2c rebalance thresholds and fee bounds."))
(verb 'deposit-savings   :layer 'entity  :tx "lendingOffer"                 :summary (from-code "ui/src/screens/Lending.tsx" "Fund a hub savings position with explicit credit-risk consent."))
(verb 'borrow-facility   :layer 'entity  :tx "lendingBorrow"                :summary (from-code "core/types/entity-tx.ts" "Draw liquidity from a negotiated lending facility."))
(verb 'repay-loan        :layer 'entity  :tx "lendingRepay"                 :summary (from-code "core/types/entity-tx.ts" "Repay principal and interest on an active loan."))
(verb 'close-savings     :layer 'entity  :tx "lendingClosePosition"         :summary (from-code "core/types/entity-tx.ts" "Close and withdraw an active savings/lending position."))
(verb 'set-bank-rates    :layer 'entity  :tx "lendingSetTerms"              :summary (from-code "core/types/entity-tx.ts" "Publish hub bank lending and savings rate policy."))
(verb 'unilateral-exit   :layer 'entity  :tx "prepareDispute"               :summary (from-code "core/types/entity-tx.ts" "Submit co-signed frame on-chain to enforce unilateral settlement."))
(verb 'finalize-dispute  :layer 'entity  :tx "disputeFinalize"              :summary (from-code "core/types/entity-tx.ts" "Finalize settled dispute after response window expires."))
(verb 'propose-multisig  :layer 'entity  :tx "propose"                      :summary (from-code "core/types/entity-tx.ts" "Propose a multi-signer Entity governance or threshold update."))
(verb 'vote-multisig     :layer 'entity  :tx "vote"                         :summary (from-code "core/types/entity-tx.ts" "Co-sign or reject a pending Entity proposal."))
(verb 'request-payment-link :layer 'local :tx "localRequestLink"             :summary (from-code "ui/src/screens/Receive.tsx" "Generate a shareable payment request link or QR code."))
(verb 'export-backup        :layer 'local :tx "localExportBackup"            :summary (from-code "ui/src/runtime/recovery.ts" "Export encrypted recovery state and tower coverage bundle."))
(verb 'reset-testnet        :layer 'local :tx "localResetRetiredTestnet"     :summary (from-code "todo.md" "Reset retired testnet state while keeping user keys."))

;; ── 3. Exhaustive 15-Screen Disposition Map (checked against ui/src/screens/*.tsx on disk) ────────
(legacy-screen "Gate.tsx"            :disposition 'shared-shell :into ['everyday/home 'personal/home 'pro/desk]       :why (from-code "ui/src/screens/Gate.tsx" "Onboarding and key unlock precede surface entry.") :sources ["ui/src/screens/Gate.tsx"])
(legacy-screen "Home.tsx"            :disposition 'split        :into ['everyday/home 'personal/home 'pro/desk]       :why (guess "Everyday shows one calm Cash number (Venmo); Pro shows dense multi-account desk.") :sources ["ui/src/screens/Home.tsx" "fork:f10-everyday-autopilot-vs-bucket-bars"])
(legacy-screen "Pay.tsx"             :disposition 'keep         :into ['everyday/home 'personal/pay 'pro/desk]        :why (from-code "ui/src/screens/Pay.tsx" "One-tap inline Pay on Everyday; operator route controls in Pro.") :sources ["ui/src/screens/Pay.tsx"])
(legacy-screen "Receive.tsx"         :disposition 'keep         :into ['everyday/home 'personal/receive 'pro/desk]    :why (from-code "ui/src/screens/Receive.tsx" "Request link / QR on Everyday; inbound capacity planning in Pro.") :sources ["ui/src/screens/Receive.tsx"])
(legacy-screen "Swap.tsx"            :disposition 'split        :into ['everyday/home 'personal/convert 'pro/book 'pro/cross-swap] :why (guess "Automatic currency conversion behind Pay on Everyday; resting book and cross-J legs in Pro.") :sources ["ui/src/screens/Swap.tsx"])
(legacy-screen "Lending.tsx"         :disposition 'split        :into ['everyday/earn 'personal/savings 'pro/lending] :why (canon "AGENTS.md" "Simple opt-in Savings on Everyday; hub bank/facility desk in Pro.") :sources ["ui/src/screens/Lending.tsx" "fork:f3-savings-in-personal"])
(legacy-screen "Activity.tsx"        :disposition 'keep         :into ['everyday/activity 'personal/activity 'pro/desk] :why (from-code "ui/src/screens/Activity.tsx" "Plain human payment and split feed.") :sources ["ui/src/screens/Activity.tsx"])
(legacy-screen "Settings.tsx"        :disposition 'keep         :into ['everyday/activity 'personal/settings 'pro/watchtower] :why (from-code "ui/src/screens/Settings.tsx" "Account settings and key-preserving testnet reset.") :sources ["ui/src/screens/Settings.tsx" "todo.md"])
(legacy-screen "Sovereignty.tsx"     :disposition 'split        :into ['everyday/activity 'personal/safety 'pro/watchtower] :why (from-code "ui/src/screens/Sovereignty.tsx" "Automatic background recovery on Everyday; manual tower/proof admin in Pro.") :sources ["ui/src/screens/Sovereignty.tsx" "fork:f10-everyday-autopilot-vs-bucket-bars"])
(legacy-screen "Move.tsx"            :disposition 'move         :into ['pro/move]                      :why (from-code "ui/src/screens/Move.tsx" "Explicit r2c/r2r/r2e plumbing replaced by Cash out + autopilot on Everyday.") :sources ["ui/src/screens/Move.tsx"])
(legacy-screen "Manage.tsx"          :disposition 'move         :into ['everyday/people 'pro/credit-lanes] :why (from-code "ui/src/screens/Manage.tsx" "Human Splitwise friend tabs on Everyday; hub credit/rebalance knobs in Pro.") :sources ["ui/src/screens/Manage.tsx"])
(legacy-screen "AccountDetail.tsx"   :disposition 'split        :into ['everyday/people 'personal/home 'pro/credit-lanes] :why (guess "Friend tab history on Everyday; autopilot replaces manual Cover it button.") :sources ["ui/src/screens/AccountDetail.tsx"])
(legacy-screen "Assets.tsx"          :disposition 'move         :into ['pro/assets]                    :why (from-code "ui/src/screens/Assets.tsx" "Per-jurisdiction token catalog and PlaceRow breakdown.") :sources ["ui/src/screens/Assets.tsx"])
(legacy-screen "Ownership.tsx"       :disposition 'move         :into ['pro/multisig]                  :why (canon "AGENTS.md" "Multi-signer Hanko security remains; Companies/IPO share trading is outside launch scope.") :sources ["ui/src/screens/Ownership.tsx" "AGENTS.md"])
(legacy-screen "CustomContracts.tsx" :disposition 'unavailable  :into []                               :why (canon "AGENTS.md" "Opaque custom-contract admission remains unavailable under canonical testnet policy.") :sources ["ui/src/screens/CustomContracts.tsx" "AGENTS.md"])
