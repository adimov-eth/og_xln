;; Author: openai/gpt-6.2-astra (p5-openai-astra)

(signing-sheet 'wallet-review
  :covers ['open-account 'send-direct 'send-routed 'request-cover 'extend-peer-tab
           'instant-swap 'place-limit-order 'cancel-order 'cross-j-swap
           'deposit-savings 'borrow-facility 'repay-loan 'close-savings
           'unilateral-exit 'finalize-dispute 'export-backup]
  :shows ['program-origin 'counterparty 'delta-secured 'delta-unbacked-risk 'delta-owed 'delta-credit-limit 'fee-exact 'expiry-deadline]
  :fee-before #t
  :survival (guess "If they disappear, you can take valid signed proof to the chain without them. After the challenge period, your collateral-backed share returns to your reserve. Debt beyond collateral can be collected from their available reserve; any unpaid part is still debt, not money you can withdraw.")
  :warns [(guess "You are raising how much this party may owe you without collateral. This limit applies to the whole account, not just this purchase.")
          (guess "You will owe more after this payment. The part you borrow must be repaid.")]
  :why (guess "One wallet-owned review and one approval per intent, not one warning per click. Start with the actual action, origin, signing entity, recipient, token, network, amount and fee. Show changed rows as before → after; keep unchanged rows inspectable. Add the relevant warning only for an increased credit ceiling or new borrowing. Never warn for merely reading a quote. Neither Pro nor a familiar origin skips review. The wallet derives effects from the exact typed command and current signed state, not the program's description. Recheck signer authority, state, quote and deadline at approval; if anything changed, discard approval and show a new review. No signature, seed or runtime command handle is returned to the program.")
  :sources ["docs/studies/ui/surfaces/AS-IS-SCREENS.md" "ui/src/components/RuntimeCommandGate.tsx" "ui/src/components/LendingRiskConsent.tsx" "core/types/entity-tx.ts" "frontend/src/lib/components/Entity/account/ui/AccountConfigurePanel.svelte"])

;; v2's :shows and :warns are static lists, not executable bindings or per-verb predicates.
;; The proposed review needs per-leg asset/network/amount, rate, maturity, route debit bound,
;; credit direction, exact quoted fee (including zero) and a separately labelled network cost cap.
;; A cap is not the final gas charge. A cover request previews payment of the fee now versus
;; collateral IF fulfilled; an order previews limits, not a guaranteed fill. Unknown effects or
;; unbounded costs block signing. v2 cannot enforce any of this, sandbox code, or bind approval
;; to exact bytes. :covers on a local export means a local unlock/confirmation, not a chain signature.

(surface 'toggle-wallet
  :who (guess "A payer or dealer staying inside either installed wallet.")
  :entry 'overview :modes ['always]
  :terms {:send-room (guess "Can send now · includes credit") :receive-room (guess "Can receive now")
          :secured (as-is "ui/src/components/home/BalanceDetails.tsx" "Backed by collateral")
          :unbacked (as-is "ui/src/components/home/BalanceDetails.tsx" "Without collateral")
          :owed (guess "You owe") :dispute (guess "Account exit")}
  :defaults [(default-rule 'pro-toggle :value "on" :risk-bearer 'user :consent (guess "Hide or show deal details at any time.")
               :why (canon "todo.md" "One capacity bar and a Pro toggle (on by default) in both wallets.") :sources ["todo.md"])
             (default-rule 'hub-credit :value "0 USDC" :risk-bearer 'user :consent (guess "Opening is not a credit grant.")
               :why (from-code "core/types/entity-tx.ts" "openAccount can carry creditAmount. A wallet default is therefore a financial choice, not just copy.") :sources ["ui/src/runtime/first-hub-account.test.ts" "docs/studies/ui/surfaces/AS-IS.md"])]
  :screens [(screen 'overview :purpose (guess "Check payment room. Read how much is backed, how much is a promise and how much you owe. Trade here with Pro on; hide detail without hiding risk or exit.")
             :headline 'send-capacity :figures ['send-capacity 'receive-capacity 'secured-receivable 'unbacked-exposure 'owed-payable 'dispute-phase]
             :bars ['send-capacity 'receive-capacity] :actions ['pay 'cover 'convert 'order 'exchange 'save 'exit]
             :max-words 45 :why (guess "Use one two-ended capacity bar for the selected account and token, not a wealth total. Pro adds order controls in place. Exposure is labelled text outside the bar in both modes.")
             :sources ["todo.md" "docs/studies/ui/surfaces/AS-IS.md" "ui/src/screens/Swap.tsx" "frontend/src/lib/components/Entity/swap/SwapPanel.svelte"])]
  :flows [(flow 'pay :verb 'send-routed :before (guess "Review payment") :pending (guess "Payment submitted") :done (guess "Paid") :failed (guess "Check payment status before trying again."))
          (flow 'cover :verb 'request-cover :before (guess "Review fee and net collateral") :pending (guess "Waiting for collateral") :done (guess "Collateral confirmed") :failed (guess "Check the request and fee in activity."))
          (flow 'convert :verb 'instant-swap :before (guess "Review conversion") :pending (guess "Offer submitted") :done (guess "Exchange confirmed") :failed (guess "Check fills before trying again."))
          (flow 'order :verb 'place-limit-order :before (guess "Review price and size") :pending (guess "Submitting order") :done (guess "Order accepted; check fills") :failed (guess "Check open orders."))
          (flow 'exchange :verb 'cross-j-swap :before (guess "Review both networks") :pending (guess "Waiting on both sides") :done (guess "Exchange confirmed on both sides") :failed (guess "Inspect each side and its deadline."))
          (flow 'save :verb 'deposit-savings :before (guess "Review savings offer") :pending (guess "Awaiting acceptance") :done (guess "Savings position opened") :failed (guess "Check offers and positions."))
          (flow 'exit :verb 'unilateral-exit :before (guess "Review on-chain exit") :pending (guess "Preparing signed proof") :done (guess "Exit in progress; check the deadline") :failed (guess "Inspect proof and chain status."))]
  :doors []
  :why (guess "Comparator, not a second production wallet: keep the same consent rule and change only navigation. A dealer checking a price and posting a limit order stays on one screen. Two native toggles are cheaper to build and test than two intent hosts plus origin attribution and return navigation. Use this first for first-party controls. A toggle alone does not constrain who can spend a key.")
  :sources ["todo.md" "docs/studies/ui/surfaces/AS-IS-SCREENS.md" "ui/src/components/Shell.tsx" "ui/src/screens/Swap.tsx" "frontend/src/lib/components/Entity/account/ui/AccountConfigurePanel.svelte"])

(surface 'wallet-kernel
  :who (guess "The person or authorized signer responsible for this account, whether they started here or arrived from a link.")
  :entry 'home :modes ['always]
  :terms {:secured (guess "Owed to you · backed on-chain")
          :unbacked (term-copy :label (as-is "ui/src/components/home/BalanceDetails.tsx" "Without collateral") :note (as-is "ui/src/components/home/BalanceDetails.tsx" "Repayment depends on the other party.") :note-when 'non-zero)
          :owed (guess "You owe") :send-room (guess "Can send now · includes credit") :receive-room (guess "Can receive now")
          :peer-credit (guess "How much you let them owe") :own-credit (guess "How much they let you owe")
          :onchain (as-is "ui/src/components/home/BalanceDetails.tsx" "Blockchain wallet") :reserve (as-is "ui/src/components/home/BalanceDetails.tsx" "Contract reserve")
          :dispute (guess "Exit status and deadline")}
  :defaults [(default-rule 'hub-credit :value "0 USDC" :risk-bearer 'user :consent (guess "Connect at zero. Set a separate maximum only if you want to accept their debt.")
               :why (guess "Do not put the first hub's 10,000 USDC grant inside openAccount. Zero unsecured receive room may be inconvenient; offer collateral or a separate, named limit review. Never silently substitute credit.")
               :sources ["ui/src/runtime/first-hub-account.test.ts" "core/types/entity-tx.ts" "ui/src/components/LendingRiskConsent.tsx" "docs/studies/ui/surfaces/AS-IS.md"])
             (default-rule 'pro-toggle :value "on" :risk-bearer 'user :consent (guess "Hide desk shortcuts without changing account permissions.")
               :why (guess "Keep the familiar entry. Pro controls density, not access to a launch task, proof or keys.") :sources ["todo.md" "AGENTS.md"])]
  :screens [(screen 'home :purpose (guess "Pick an account and asset. See what is backed before you spend. Pay, share a payment request, ask for cover, or open Swap or Lending. Recovery stays here even if a program closes.")
             :headline 'secured-receivable :figures ['secured-receivable 'unbacked-exposure 'owed-payable 'send-capacity 'receive-capacity]
             :bars ['send-capacity 'receive-capacity] :actions ['connect 'pay 'pay-direct 'cover 'exit]
             :max-words 45 :why (guess "Keep the two directions on one bar, with numbers, not a percent standing in for risk. Put cover by the unsecured amount. A shared payment request needs no spending permission.")
             :sources ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/screens/AccountDetail.tsx" "ui/src/screens/Receive.tsx" "ui/src/runtime/views.ts" "frontend/src/lib/components/Entity/account/ui/CollateralForm.svelte"])
            (screen 'limits :purpose (guess "For this party and asset, compare what they owe now with the maximum you let them owe. A higher limit does not add money.")
             :headline 'peer-credit-granted :figures ['peer-credit-granted 'own-credit-granted 'unbacked-exposure 'owed-payable] :actions ['set-limit]
             :max-words 35 :why (guess "Both wallets must consume the same deriveDelta(delta, isLeft) projection. peerCreditLimit is the ceiling I grant; ownCreditLimit is the one I receive. Do not infer the side from labels or hand-read left/right limits. Test both signers on one asymmetric account.")
             :sources ["core/account/utils.ts" "core/types/account.ts" "ui/src/components/home/CreditDetails.tsx" "frontend/src/lib/components/Entity/account/ui/CreditForm.svelte" "docs/studies/ui/surfaces/AS-IS.md"])
            (screen 'safety :purpose (guess "See the signed proof, where your funds are, and the next on-chain deadline. Start or follow an exit without the other party. Save an encrypted backup here.")
             :headline 'dispute-phase :figures ['dispute-phase 'secured-receivable 'unbacked-exposure 'reserve-cash 'onchain-cash] :actions ['exit 'finish 'backup]
             :max-words 40 :why (guess "Always reachable, including while disputed or offline from the peer. Reaching exit must not start a second dispute. Select prepare, track or finalize from the committed phase. Require valid proof and an available chain for submission, not for viewing the case.")
             :sources ["ui/src/screens/Sovereignty.tsx" "ui/src/screens/AccountDetail.tsx" "frontend/src/lib/components/Entity/account/ui/AccountConfigurePanel.svelte" "core/types/entity-tx.ts"])]
  :flows [(flow 'connect :verb 'open-account :before (guess "Open account · grant no credit") :pending (guess "Waiting for both signatures") :done (guess "Account open") :failed (guess "Inspect account status."))
          (flow 'pay :verb 'send-routed :before (guess "Review recipient, amount and route fee") :pending (guess "Payment submitted") :done (guess "Paid") :failed (guess "Check payment and any locked amount."))
          (flow 'pay-direct :verb 'send-direct :before (guess "Pay this party directly") :pending (guess "Waiting for confirmation") :done (guess "Paid directly") :failed (guess "Check signed activity."))
          (flow 'cover :verb 'request-cover :before (guess "Review fee and net collateral") :pending (guess "Requested · not yet covered") :done (guess "Collateral confirmed on-chain") :failed (guess "Check fee paid and exposure still outstanding."))
          (flow 'set-limit :verb 'extend-peer-tab :before (guess "Set their new total limit") :pending (guess "Waiting for signed limit") :done (guess "New limit in effect") :failed (guess "Read the current signed limit."))
          (flow 'exit :verb 'unilateral-exit :before (guess "Review on-chain exit") :pending (guess "Preparing signed proof") :done (guess "Dispute started; watch the deadline") :failed (guess "Inspect proof and chain status. No payment is promised."))
          (flow 'finish :verb 'finalize-dispute :before (guess "Review final settlement") :pending (guess "Waiting for chain confirmation") :done (guess "Account closed; check reserve and unpaid debt") :failed (guess "Check the deadline and chain status."))
          (flow 'backup :verb 'export-backup :before (guess "Save encrypted backup") :pending (guess "Encrypting locally") :done (guess "Backup saved") :failed (guess "Backup not confirmed. Check the destination."))]
  :doors ['instant-swap 'place-limit-order 'cancel-order 'cross-j-swap 'deposit-savings 'borrow-facility 'repay-loan 'close-savings]
  :why (guess "Keep unlock, signed exposure, payment requests, consent, committed activity, backups and exit under wallet control. Programs may select terms; only the wallet may submit. Embed required Swap and Lending in both shells, not behind Pro, a website or a steward. Reuse one pure review model with small React and Svelte renderers; aim below 300 lines per file, not two financial implementations. No new protocol message, durable state or signature scheme.")
  :sources ["AGENTS.md" "docs/studies/ui/surfaces/AS-IS.md" "docs/studies/ui/surfaces/AS-IS-SCREENS.md" "ui/src/runtime/views.ts" "core/types/account.ts" "core/types/entity-tx.ts" "frontend/src/lib/components/Entity/account/ui/CreditForm.svelte"])

(xln-app 'trade-ticket :kind 'embedded :render 'fixed
  :audience (guess "A payer converting now or a dealer leaving a priced order.") :reads ['orderbook-frame 'send-capacity 'receive-capacity]
  :requests ['instant-swap 'place-limit-order 'cancel-order 'cross-j-swap]
  :claim-shown (guess "Choose what to give and receive. Review each asset, network, price bound, fee and expiry in your wallet.")
  :why (guess "One installed ticket in each wallet keeps same-network and cross-network trading available on EVM and native TRON. Pro reveals book detail. The ticket owns order entry, not custody, settlement or a second quote formula.")
  :sources ["ui/src/screens/Swap.tsx" "frontend/src/lib/components/Entity/swap/SwapPanel.svelte" "core/types/entity-tx.ts" "AGENTS.md"])

(xln-app 'bank-offer :kind 'embedded :render 'fixed
  :audience (guess "A saver comparing terms or a borrower managing a loan.") :reads ['unbacked-exposure 'peer-credit-granted 'receive-capacity 'owed-payable]
  :requests ['deposit-savings 'borrow-facility 'repay-loan 'close-savings]
  :claim-shown (guess "Compare principal, interest and due date. Your wallet reviews the selected terms. A savings offer cannot raise your credit limit.")
  :why (guess "Keep the signed facility lifecycle installed in both wallets. If principal plus interest needs a larger limit, stop and open Limits as a separate choice. Do not bundle a credit grant with a deposit or pass bank policy authority to a saver.")
  :sources ["ui/src/screens/Lending.tsx" "ui/src/components/LendingRiskConsent.tsx" "frontend/src/lib/components/Entity/lending/LendingPanel.svelte" "core/types/entity-tx.ts"])

(xln-app 'invoice-link :kind 'external :render 'fixed
  :audience (guess "Someone opening a merchant's invoice.") :reads [] :requests ['send-routed]
  :claim-shown (guess "Open this invoice in your wallet. Check who gets paid and the total debit before paying.")
  :why (guess "An invoice needs no account history, key or balance query. The wallet resolves identity and quotes the route. Reject any verb other than payment from this entry, even if the link calls a credit grant a purchase.")
  :sources ["ui/src/screens/Receive.tsx" "ui/src/screens/Pay.tsx" "core/types/entity-tx.ts" "docs/studies/ui/surfaces/AS-IS-SCREENS.md"])

(xln-app 'cover-adviser :kind 'steward :render 'generative
  :audience (guess "A signer who wants help spotting debt that lacks collateral.") :reads ['unbacked-exposure] :requests ['request-cover]
  :claim-shown (guess "I can suggest a cover request for this account. Only you can approve its fee.")
  :why (guess "Give the adviser only the selected account and token's exposure with permission. It can draft a request, never submit on a timer, extend a limit, export a key or run recovery. Dismiss it and nothing changes.")
  :sources ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/runtime/financial/manage.ts" "frontend/src/lib/components/Entity/account/ui/CollateralForm.svelte" "core/types/entity-tx.ts"])

(story 'dealer-in-place :surface 'toggle-wallet :given 'partlyCovered :steps ['overview 'order]
  :outcome (guess "With Pro already on, the dealer sees capacity and exposure, sets a limit price and approves one order. Acceptance is not a fill. No workspace switch or app permission prompt.")
  :why (guess "The toggle wins for a repeat first-party trade. Test that journey with dealers before adding an app boundary for navigation alone.") :sources ["todo.md" "ui/src/screens/Swap.tsx" "docs/studies/ui/surfaces/AS-IS-SCREENS.md"])

(story 'first-account :surface 'wallet-kernel :given 'empty :steps ['home 'connect 'limits]
  :outcome (guess "H1 is connected. The ceiling you granted is 0 USDC, not 10,000 USDC. If neither side has funded or extended room, connecting alone has not made a payment possible.")
  :why (guess "Opening an account and underwriting its peer are different decisions.") :sources ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/runtime/first-hub-account.test.ts" "core/types/entity-tx.ts"])

(story 'cover-quote :surface 'wallet-kernel :given 'uncovered :steps ['home 'cover 'home]
  :outcome (guess "For H1's 100 USDC debt the wallet quotes 0.11 USDC fee and 99.89 USDC net. Only after confirmed cover: backed 99.89 USDC, unsecured 0 USDC. No claim that you posted H1's collateral.")
  :why (guess "Use the observed request as a parity vector: same gross, fee, conditional net and committed result in React and Svelte; never treat submission as cover.") :sources ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/runtime/financial/manage.ts" "ui/src/screens/AccountDetail.tsx" "frontend/src/lib/components/Entity/account/ui/CollateralForm.svelte"])

(story 'hub-stalls :surface 'wallet-kernel :given 'partlyCovered :steps ['home 'cover 'safety 'exit]
  :outcome (guess "H1 did not supply more collateral. The request is not counted as cover; check the prepaid fee. Take the existing signed proof to chain. The backed portion can settle, not a guaranteed payout of the whole debt.")
  :why (guess "A program may go away along with H1. Neither is on the path to proof or exit.") :sources ["core/types/entity-tx.ts" "ui/src/screens/Sovereignty.tsx" "frontend/src/lib/components/Entity/account/ui/AccountConfigurePanel.svelte"])

(story 'dispute-in-progress :surface 'wallet-kernel :given 'disputed :steps ['home 'safety 'exit 'safety 'finish]
  :outcome (guess "Exit opens the existing case without starting it again. Read the challenge deadline; if an older state is asserted, answer in time with valid evidence. Finalize when eligible, then inspect the confirmed reserve and outstanding debt.")
  :why (guess "Keep exit reachable with Pro off. A visible action is not authorization to submit an invalid or premature transaction.") :sources ["ui/src/screens/AccountDetail.tsx" "ui/src/screens/Sovereignty.tsx" "frontend/src/lib/components/Entity/account/ui/AccountConfigurePanel.svelte" "core/types/entity-tx.ts"])

;; :modes and a default-rule record a display choice; v2 has no toggle transition or per-action
;; guard. :bars names the two ends, not geometry or scale. :doors names verbs, not app routes;
;; read-only Receive and the local status view need no fake signing verb. :given has one disputed
;; bit, not evidence, phase, timeout or gas. The safety flow specifies reachability, not readiness.
;; Stories are proposed parity cases, not human tests or proof of either chain's execution.
