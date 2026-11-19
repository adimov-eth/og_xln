;; p2-sovereign.scm — POV 2: risk truth and consent. Author: claude-fable-5-2, 2026-11-19.
;;
;; NOT A COLD ENTRY. Before writing this I had read personal.scm, written rounds/r1-custdev-claude.scm,
;; and seen a four-line summary of p4's hostile programs. I did not open perspectives/p4-*.scm or probes/.
;; What each sheet shows is derived from transaction fields in core/types/entity-tx.ts, not from those traps.
;;
;; No model or person has read any sentence marked (guess ...) below. A green check proves structure only.
;;
;; Position, in four lines:
;;   1. Consent is per risk class, not universal. One sheet with every warning on it trains people to skip it.
;;   2. Five sheets. An ordinary payment carries no warning. A credit grant can never be shown as anything else.
;;   3. The sheet does not need the kernel/program split. It can go into the one-bar wallet as it stands.
;;   4. So the baseline plus the sheets is the first step I would argue for; the kernel is the second, and unproven.
;;
;; Gaps in DSL v2 that this file cannot express, recorded here instead of worked around:
;;   - 'fee-exact is the only fee field. htlcPayment.maxSenderDebit and placeSwapOffer.maxFee are ceilings.
;;     A ceiling shown as an exact fee is a false statement. The sheet needs a 'fee-ceiling field.
;;   - :warns is unconditional per sheet. I use one sheet per risk class to get conditionality.
;;     A rule such as "warn only when the limit rises" has nowhere to live.
;;   - Nothing says a sheet is drawn by the wallet from the transaction and never from program text.
;;     That is the whole defence against a hostile program and it is only a comment here.
;;   - :fee-before #t is forced on every sheet, including exit, where the cost is chain gas the wallet may not know.
;;   - A sheet is chosen by what the request changes, not by its verbs. :covers can only list verbs.
;;
;; Changed 2026-11-19 after the signing sweep and my reruns (probes/verify-claude/README.md):
;;   - The sheet is chosen from the computed change. Any rise in a credit limit or in unbacked exposure gets
;;     sheet-exposure, whatever the verb. So 'instant-swap and 'open-account are listed under both A and B:
;;     a swap into an unbacked claim is B; an account opened with no credit granted is A.
;;   - A shows the credit-limit change even when it is zero, so a reader need not infer that an account
;;     opening granted nothing. This is by argument only: a later run approved the sheet 6 of 6 without the line.
;;     The checkout that Sonnet 5.5 rejected 6 of 6 listed send-routed and send-direct together; that was the cause.
;;   - B shows the locked amount leaving. The first version hid the 1,000 given up in the swap scenario.

;; ── Sheets, by what the signature can do to the signer ────────────────────────────────────────────

;; A. Money leaves. No warning: this is the ordinary case and must stay quiet.
(signing-sheet 'sheet-spend
  :covers     ['send-direct 'send-routed 'instant-swap 'move-r2r 'open-account]
  :shows      ['program-origin 'counterparty 'delta-secured 'delta-unbacked-risk 'delta-credit-limit 'fee-exact]
  :fee-before #t
  :survival   (guess "This payment is final once both sides sign it.")
  :warns      []
  :why        (guess "A sheet that warns on every payment is not read by the time it matters. The amount leaving, who gets it and the most it can cost are enough. For a routed payment the cost shown is maxSenderDebit minus amount, a ceiling.")
  :sources    ["core/types/entity-tx.ts" "ui/src/screens/Pay.tsx"])

;; B. Someone may owe me more with nothing locked behind it. The only sheet that interrupts.
(signing-sheet 'sheet-exposure
  :covers     ['open-account 'extend-peer-tab 'set-hub-credit 'deposit-savings 'rebalance-policy 'instant-swap]
  :shows      ['program-origin 'counterparty 'delta-secured 'delta-credit-limit 'delta-unbacked-risk 'fee-exact]
  :fee-before #t
  :survival   (as-is "ui/src/components/LendingRiskConsent.tsx" "Only collateral secures recovery.")
  :warns      [(guess "You are letting them owe you up to this amount with nothing locked behind it.")
               (as-is "ui/src/components/home/CreditDetails.tsx" "Credit does not guarantee repayment.")]
  :why        (from-code "ui/src/runtime/hosted.ts" "The first hub Account is opened with creditAmount set, so a 10,000 USDC limit arrives inside openAccount with no question asked. Any transaction that can raise a credit limit or the soft limit for unbacked exposure gets this sheet, whatever the requesting program calls it. The new total is shown, not the amount added.")
  :sources    ["ui/src/runtime/hosted.ts" "core/types/entity-tx.ts" "ui/src/components/LendingRiskConsent.tsx" "docs/studies/ui/surfaces/AS-IS.md"])

;; C. My position gets safer, for a fee.
(signing-sheet 'sheet-secure
  :covers     ['request-cover 'move-r2c]
  :shows      ['counterparty 'delta-secured 'delta-unbacked-risk 'fee-exact]
  :fee-before #t
  :survival   (guess "Once locked, you can take this money out yourself. It takes a waiting period and does not need them.")
  :warns      []
  :why        (from-code "ui/src/components/account/ManageSheet.tsx" "The shipped sheet already states the fee and the net before the action. It has no sentence afterwards saying what covered money is good for. The spec's earlier sentence for that failed with cold readers twice, on the words Depository and dispute exit; this one avoids both and is untested.")
  :sources    ["ui/src/components/account/ManageSheet.tsx" "docs/studies/ui/custdev-r1/report.md" "docs/studies/ui/surfaces/AS-IS.md"])

;; D. A commitment with a clock: a resting order, a cross-network swap, a loan.
(signing-sheet 'sheet-term
  :covers     ['place-limit-order 'cancel-order 'cross-j-swap 'borrow-facility 'repay-loan 'close-savings]
  :shows      ['program-origin 'counterparty 'delta-secured 'delta-unbacked-risk 'delta-owed 'expiry-deadline 'fee-exact]
  :fee-before #t
  :survival   (guess "Until the deadline this amount is held and you cannot spend it.")
  :warns      [(guess "If it does not complete by the deadline, the held amount returns to you.")]
  :why        (guess "What these share is time. The signer needs the amount held, until when, and what is owed at the end. I have not verified the return-on-expiry sentence for every verb here; it is a guess about HTLC and offer expiry.")
  :sources    ["core/types/entity-tx.ts" "ui/src/screens/Swap.tsx" "ui/src/screens/Lending.tsx"])

;; E. Leaving. Kernel only: no program origin is shown because no program may ask for it.
(signing-sheet 'sheet-exit
  :covers     ['unilateral-exit 'finalize-dispute]
  :shows      ['counterparty 'delta-secured 'delta-unbacked-risk 'expiry-deadline 'fee-exact]
  :fee-before #t
  :survival   (guess "You get back what is locked. What they owe you beyond that stays owed.")
  :warns      [(guess "This ends the Account with them. It cannot be undone.")]
  :why        (from-code "jurisdictions/contracts/Depository.sol" "The contract comment above _settleShortfall says a shortfall carries no external claim and no seizure right. So exit recovers collateral and nothing more, and the sheet has to say that before the signature, with both figures. I have not run a dispute in either wallet.")
  :sources    ["jurisdictions/contracts/Depository.sol" "ui/src/screens/AccountDetail.tsx" "ui/src/screens/Sovereignty.tsx"])

;; ── Surface 1: the baseline at full strength (todo.md: one capacity bar, Pro toggle on by default) ─
;; Where it wins: one shell, already built twice, no new trust boundary, lowest parity cost.
;; It needs nothing from the kernel idea except the five sheets above.
(surface 'one-bar-wallet
  :who      (canon "todo.md" "One capacity bar and a Pro toggle (on by default) in both wallets.")
  :entry    'home
  :modes    ['always 'pro-only]
  :terms    {:secured  (term-copy :label (as-is "ui/src/components/home/BalanceDetails.tsx" "Backed by collateral")
                                  :note  (as-is "ui/src/components/home/BalanceDetails.tsx" "Covered by funds locked on-chain.")
                                  :note-when 'non-zero)
             :unbacked (term-copy :label (as-is "ui/src/components/home/BalanceDetails.tsx" "Without collateral")
                                  :note  (as-is "ui/src/components/home/BalanceDetails.tsx" "Repayment depends on the other party.")
                                  :note-when 'non-zero)
             :owed     (guess "You owe")
             :net      (as-is "ui/src/components/home/BalancePanel.tsx" "Balance")
             :send-room (guess "Can send now")
             :receive-room (guess "Can receive now")
             :peer-credit (as-is "ui/src/components/home/CreditDetails.tsx" "You extend")
             :dispute  (as-is "ui/src/screens/AccountDetail.tsx" "Dispute")}
  :defaults [(default-rule 'first-hub-credit
               :value "10,000 USDC"
               :risk-bearer 'user
               :consent (guess "sheet-exposure, shown when the Account is opened")
               :why (from-code "ui/src/runtime/hosted.ts" "The baseline keeps the shipped default so a new wallet can receive at once. The only change is that the grant is shown and signed for.")
               :sources ["ui/src/runtime/hosted.ts" "docs/studies/ui/surfaces/AS-IS.md"])]
  :screens  [
    (screen 'home
      :purpose   (guess "One bar: locked, owed to you unlocked, and room left. The total above it, as shipped.")
      :headline  'net-position
      :figures   ['net-position 'secured-receivable 'unbacked-exposure 'send-capacity 'receive-capacity]
      :bars      ['secured-receivable 'unbacked-exposure 'send-capacity]
      :actions   ['pay 'receive 'convert]
      :why       (guess "The shipped Home already shows the total and the split. The v3 run found the unbacked label is read correctly when its note is present, so the baseline keeps both.")
      :sources   ["docs/studies/ui/surfaces/AS-IS.md" "docs/studies/ui/custdev-r1/report.md" "todo.md"])
    (screen 'account
      :purpose   (guess "One counterparty: what they owe you, how much of it is locked, cover it, or leave.")
      :headline  'unbacked-exposure
      :figures   ['unbacked-exposure 'secured-receivable 'peer-credit-granted 'dispute-phase]
      :actions   ['cover 'set-limit 'exit 'finalize]
      :sources   ["ui/src/screens/AccountDetail.tsx" "docs/studies/ui/surfaces/AS-IS.md"])
    (screen 'pro
      :purpose   (guess "Everything else the wallet ships today, behind the toggle: orders, cross-network, lending, reserve moves.")
      :headline  'account-lanes
      :figures   ['account-lanes 'orderbook-frame 'reserve-cash 'onchain-cash]
      :actions   ['limit-order 'cross-swap 'save 'to-collateral]
      :mode      'pro-only
      :sources   ["ui/src/screens/Swap.tsx" "ui/src/screens/Lending.tsx" "ui/src/screens/Move.tsx"])
  ]
  :flows    [
    (flow 'pay         :verb 'send-routed       :before (as-is "ui/src/components/home/BalancePanel.tsx" "Pay")     :pending (guess "Sending…")            :done (guess "Paid.")                         :failed (guess "Not sent. Nothing changed."))
    (flow 'receive     :verb 'open-account      :before (guess "Receive")                            :pending (guess "Opening the Account…") :done (guess "Ready to receive.")             :failed (guess "Not opened. Nothing changed."))
    (flow 'convert     :verb 'instant-swap      :before (guess "Swap")                               :pending (guess "Swapping…")           :done (guess "Swapped.")                      :failed (guess "Not swapped. Nothing changed."))
    (flow 'cover       :verb 'request-cover     :before (as-is "ui/src/screens/AccountDetail.tsx" "Cover it") :pending (as-is "ui/src/components/account/ManageSheet.tsx" "Sending…") :done (guess "Locked. You can take this out yourself now.") :failed (guess "Not locked. They still owe you the same amount."))
    (flow 'set-limit   :verb 'extend-peer-tab   :before (guess "Change what they may owe you")       :pending (guess "Signing the new limit…") :done (guess "New limit signed.")         :failed (guess "Limit unchanged."))
    (flow 'exit        :verb 'unilateral-exit   :before (as-is "ui/src/screens/AccountDetail.tsx" "Dispute") :pending (guess "Sent to the chain. Waiting for their answer.") :done (guess "The waiting period has started.") :failed (guess "Not sent. Safe to try again."))
    (flow 'finalize    :verb 'finalize-dispute  :before (guess "Take out what is locked")            :pending (guess "Finishing on the chain…") :done (guess "Done. The locked amount is yours.") :failed (guess "Not finished. Safe to try again."))
    (flow 'limit-order :verb 'place-limit-order :before (guess "Place order")                        :pending (guess "Placing…")            :done (guess "Order is resting.")             :failed (guess "Not placed. Nothing held."))
    (flow 'cross-swap  :verb 'cross-j-swap      :before (guess "Swap across networks")               :pending (guess "Both sides are locking…") :done (guess "Swapped on both networks.") :failed (guess "Did not complete. The held amount returns."))
    (flow 'save        :verb 'deposit-savings   :before (guess "Lend to the hub")                    :pending (guess "Opening…")            :done (guess "Lent. This is owed to you, not locked.") :failed (guess "Not lent. Nothing changed."))
    (flow 'to-collateral :verb 'move-r2c        :before (guess "Lock your own funds")                :pending (guess "Sending on-chain…")   :done (guess "Locked.")                       :failed (guess "Not moved."))
  ]
  :doors    ['set-bank-rates 'propose-multisig 'vote-multisig]
  :why      (guess "Simplicity and parity cost are on this side. Its weakness is not the bar or the toggle: it is that every screen signs directly, so the 10,000 grant and any future program request reach the key with no common question in between. The sheets fix that without changing the shell.")
  :sources  ["todo.md" "docs/studies/ui/surfaces/BRIEF.md" "docs/studies/ui/surfaces/AS-IS.md" "docs/studies/ui/surfaces/AS-IS-SCREENS.md"])

;; ── Surface 2: a small kernel, with everything else as programs that ask it to sign ───────────────
(surface 'sovereign-kernel
  :who      (guess "Whoever holds the key, at the moment something asks for a signature. Not a kind of person.")
  :entry    'holdings
  :modes    ['always]
  :terms    {:secured  (term-copy :label (as-is "ui/src/components/home/BalanceDetails.tsx" "Backed by collateral")
                                  :note  (as-is "ui/src/components/home/BalanceDetails.tsx" "Covered by funds locked on-chain.")
                                  :note-when 'non-zero)
             :unbacked (term-copy :label (as-is "ui/src/components/home/BalanceDetails.tsx" "Without collateral")
                                  :note  (as-is "ui/src/components/home/BalanceDetails.tsx" "Repayment depends on the other party.")
                                  :note-when 'non-zero)
             :owed     (guess "You owe")
             :net      (as-is "ui/src/components/home/BalancePanel.tsx" "Balance")
             :peer-credit (as-is "ui/src/components/home/CreditDetails.tsx" "You extend")
             :dispute  (as-is "ui/src/screens/AccountDetail.tsx" "Dispute")}
  :defaults [(default-rule 'first-hub-credit
               :value "0 USDC"
               :risk-bearer 'user
               :consent (guess "sheet-exposure, the first time a payment would arrive unlocked")
               :why (guess "A kernel that refuses to hide risk cannot grant it silently. The cost is real: a new wallet cannot receive until its holder answers one question. I do not know that this is the better trade; the shipped default exists so that receiving just works.")
               :sources ["ui/src/runtime/hosted.ts" "ui/src/components/LendingRiskConsent.tsx"])]
  :screens  [
    (screen 'holdings
      :purpose   (guess "What you have, split by who it depends on: locked, owed to you by a named counterparty, owed by you.")
      :headline  'net-position
      :figures   ['net-position 'secured-receivable 'unbacked-exposure 'owed-payable]
      :bars      ['secured-receivable 'unbacked-exposure]
      :actions   ['pay 'receive]
      :why       (guess "I keep the shipped total as the headline. I was ready to lead with the locked figure; the only evidence I have is one small run where removing the total hid the fee. Not enough to change what ships.")
      :sources   ["docs/studies/ui/surfaces/AS-IS.md" "docs/studies/ui/custdev-r1/report.md"])
    (screen 'counterparty
      :purpose   (guess "One counterparty by name: what they owe you unlocked, what is locked, the limit you set, and the two things you can do alone.")
      :headline  'unbacked-exposure
      :figures   ['unbacked-exposure 'secured-receivable 'peer-credit-granted 'dispute-phase]
      :actions   ['cover 'set-limit 'exit]
      :sources   ["ui/src/screens/AccountDetail.tsx" "docs/studies/ui/surfaces/AS-IS.md"])
    (screen 'leaving
      :purpose   (guess "Shown while an Account is in dispute: the deadline, what you will get back, what stays owed, and the button to finish.")
      :headline  'dispute-phase
      :figures   ['dispute-phase 'secured-receivable 'unbacked-exposure]
      :actions   ['exit 'finalize]
      :when      (lambda (s) (:disputed s))
      :why       (guess "In dispute nothing else matters, so nothing else is on the screen.")
      :sources   ["ui/src/screens/Sovereignty.tsx" "ui/src/screens/AccountDetail.tsx"])
  ]
  :flows    [
    (flow 'pay       :verb 'send-routed      :before (as-is "ui/src/components/home/BalancePanel.tsx" "Pay")     :pending (guess "Sending…")              :done (guess "Paid.")                          :failed (guess "Not sent. Nothing changed."))
    (flow 'receive   :verb 'open-account     :before (guess "Receive")                            :pending (guess "Opening the Account…")   :done (guess "Ready to receive.")              :failed (guess "Not opened. Nothing changed."))
    (flow 'cover     :verb 'request-cover    :before (as-is "ui/src/screens/AccountDetail.tsx" "Cover it") :pending (as-is "ui/src/components/account/ManageSheet.tsx" "Sending…") :done (guess "Locked. You can take this out yourself now.") :failed (guess "Not locked. They still owe you the same amount."))
    (flow 'set-limit :verb 'extend-peer-tab  :before (guess "Change what they may owe you")       :pending (guess "Signing the new limit…") :done (guess "New limit signed.")              :failed (guess "Limit unchanged."))
    (flow 'exit      :verb 'unilateral-exit  :before (as-is "ui/src/screens/AccountDetail.tsx" "Dispute") :pending (guess "Sent to the chain. Waiting for their answer.") :done (guess "The waiting period has started.") :failed (guess "Not sent. Safe to try again."))
    (flow 'finalize  :verb 'finalize-dispute :before (guess "Take out what is locked")            :pending (guess "Finishing on the chain…") :done (guess "Done. The locked amount is yours.") :failed (guess "Not finished. Safe to try again."))
  ]
  :doors    ['instant-swap 'place-limit-order 'cancel-order 'cross-j-swap 'deposit-savings 'borrow-facility 'repay-loan 'close-savings 'set-bank-rates 'set-hub-credit 'rebalance-policy 'move-r2c 'move-r2r 'move-r2e 'propose-multisig 'vote-multisig]
  :why      (guess "The kernel holds what must be true whoever built the screen in front of it: the split, the counterparty, the limit, cover, exit, and the sheets. Where it beats the baseline is narrow: a program cannot reach the key except through a sheet the wallet draws. Where it loses: three screens are not a wallet anyone can use for a day without programs, and those programs do not exist.")
  :sources  ["docs/studies/ui/surfaces/BRIEF.md" "docs/studies/ui/surfaces/AS-IS.md" "docs/studies/ui/surfaces/AS-IS-SCREENS.md"])

;; ── Programs: what the kernel leaves out, asking it to sign ───────────────────────────────────────
(xln-app 'checkout
  :kind        'external
  :render      'fixed
  :audience    (guess "Someone paying a shop or an invoice from a link.")
  :reads       ['send-capacity]
  :requests    ['send-routed]
  :claim-shown (guess "Pay 25.00 USDC to the shop named on the invoice.")
  :why         (guess "The simplest program and the test of sheet-spend: if the sheet slows this down, the sheet is wrong.")
  :sources     ["ui/src/screens/Pay.tsx" "ui/src/screens/Receive.tsx"])

(xln-app 'trade
  :kind        'embedded
  :render      'fixed
  :audience    (guess "Someone placing orders or swapping across networks.")
  :reads       ['orderbook-frame 'send-capacity 'receive-capacity]
  :requests    ['instant-swap 'place-limit-order 'cancel-order 'cross-j-swap]
  :claim-shown (guess "Sell 20 USDC for WETH at the price you picked.")
  :why         (from-code "ui/src/screens/Swap.tsx" "Swap.tsx is 1,111 lines holding conversion, a book, cross-network orders and open orders. It is already an application living inside a wallet screen.")
  :sources     ["ui/src/screens/Swap.tsx" "docs/studies/ui/surfaces/AS-IS-SCREENS.md"])

(xln-app 'savings
  :kind        'embedded
  :render      'fixed
  :audience    (guess "Someone lending to a hub for interest.")
  :reads       ['unbacked-exposure 'peer-credit-granted 'receive-capacity]
  :requests    ['deposit-savings 'close-savings]
  :claim-shown (as-is "frontend/src/lib/components/Entity/lending/LendingPanel.svelte" "Savings are claims against the bank. Only collateral secures recovery.")
  :why         (from-code "ui/src/components/LendingRiskConsent.tsx" "Lending already has the only consent card in the wallet. As a program it keeps its own screen and loses its private consent step to sheet-exposure, which every other credit grant then shares.")
  :sources     ["ui/src/screens/Lending.tsx" "ui/src/components/LendingRiskConsent.tsx"])

;; ── Stories ───────────────────────────────────────────────────────────────────────────────────────
(story 'first-money-in
  :surface 'sovereign-kernel
  :given   'empty
  :steps   ['holdings 'receive]
  :outcome (guess "The Account is open. The holder has seen sheet-exposure once and chose the limit. Money that arrives shows under Without collateral with its note.")
  :why     (guess "This is where the shipped wallets grant 10,000 without asking. It is also the story most likely to lose people.")
  :sources ["ui/src/runtime/hosted.ts" "docs/studies/ui/surfaces/AS-IS.md"])

(story 'cover-what-is-owed
  :surface 'sovereign-kernel
  :given   'uncovered
  :steps   ['holdings 'counterparty 'cover]
  :outcome (guess "99.89 of 100.00 is locked after a stated fee of 0.11. The last line says the holder can now take it out alone.")
  :why     (from-code "ui/src/components/account/ManageSheet.tsx" "Observed live in both wallets on 19 November: the fee is stated before, and nothing afterwards says what changed for the holder.")
  :sources ["docs/studies/ui/surfaces/AS-IS.md"])

(story 'hub-goes-quiet
  :surface 'sovereign-kernel
  :given   'disputed
  :steps   ['leaving 'exit 'finalize]
  :outcome (guess "The holder has the locked part. The sheet told them before they signed that the unlocked part stays owed.")
  :why     (guess "The sentence nobody wants on the screen, and the one a wallet that claims risk truth has to print. I have never run this flow.")
  :sources ["jurisdictions/contracts/Depository.sol" "ui/src/screens/Sovereignty.tsx"])

(story 'same-cover-in-the-baseline
  :surface 'one-bar-wallet
  :given   'uncovered
  :steps   ['home 'account 'cover]
  :outcome (guess "Identical to cover-what-is-owed. The baseline with the sheets reaches the same end state in the same number of steps.")
  :why     (guess "The comparison the brief asks for. On the flows I can check, the kernel buys nothing the baseline plus sheets does not.")
  :sources ["docs/studies/ui/surfaces/AS-IS.md" "todo.md"])
