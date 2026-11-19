;; personal.scm — Converged Risk-Class Signing Sheets (DSL v2) and Baseline Personal Surface.

;; ── Converged Wallet Kernel Signing Sheets (Dispatched by deriveDelta Risk Class, Never Verb Alone) ─
;; Dispatch precedence (highest triggered class wins):
;;   1. sheet-exit           (unilateral-exit / finalize-dispute; Kernel-only, never Program-originated)
;;   2. sheet-exposure       (any tx where deltaCreditLimit > 0 OR deltaUnbackedRisk > 0, regardless of verb)
;;   3. sheet-term           (resting order, cross-J HTLC, facility draw/repay, or lockup deadline)
;;   4. sheet-treasury-admin (reserve withdrawal r2e, bank rate card, Hanko board proposal/vote, backup/reset)
;;   5. sheet-secure         (request-cover or r2c collateral lock; position becomes safer for a stated fee)
;;   6. sheet-spend          (pure collateral/credit-neutral outbound spend; quiet :warns [])

(signing-sheet 'sheet-spend
  :covers     ['send-direct 'send-routed 'instant-swap 'move-r2r]
  :shows      ['program-origin 'counterparty 'delta-secured 'delta-unbacked-risk 'fee-exact]
  :fee-before #t
  :survival   (guess "This payment is final once both sides sign it.")
  :warns      []
  :why        (sweep "docs/studies/ui/surfaces/probes/runs-signing/summary-frontier.json" "Round 2 (C7 vs C5/C6): quiet spend sheet achieved 7/7 APPROVE and 3/3 Frontier Q4 finality accuracy, whereas all-warning sheets caused 5/7 false rejections and static claimable-collateral survival misled 2/3 Frontier models on outbound spend. Escalates to sheet-exposure whenever deriveDelta yields deltaUnbackedRisk > 0 or deltaCreditLimit > 0.")
  :sources    ["core/types/entity-tx.ts" "ui/src/screens/Pay.tsx" "docs/studies/ui/surfaces/probes/report-signing.md"])

(signing-sheet 'sheet-exposure
  :covers     ['open-account 'extend-peer-tab 'set-hub-credit 'deposit-savings 'rebalance-policy]
  :shows      ['program-origin 'counterparty 'delta-secured 'delta-unbacked-risk 'delta-credit-limit 'fee-exact]
  :fee-before #t
  :survival   (as-is "ui/src/components/LendingRiskConsent.tsx" "Only collateral secures recovery.")
  :warns      [
    (guess "You are letting them owe you up to this amount with nothing locked behind it.")
    (as-is "ui/src/components/home/CreditDetails.tsx" "Credit does not guarantee repayment.")
  ]
  :why        (sweep "docs/studies/ui/surfaces/probes/runs-signing/summary-frontier.json" "Round 2 (C2 & C4): achieved 7/7 REJECT on both disguised 10,000 USDC onboarding credit lures and collateral-to-IOU swap bait once routed by deriveDelta risk transition.")
  :sources    ["ui/src/runtime/hosted.ts" "ui/src/components/LendingRiskConsent.tsx" "docs/studies/ui/surfaces/AS-IS.md" "docs/studies/ui/surfaces/probes/report-signing.md"])

(signing-sheet 'sheet-secure
  :covers     ['request-cover 'move-r2c]
  :shows      ['counterparty 'delta-secured 'delta-unbacked-risk 'fee-exact]
  :fee-before #t
  :survival   (guess "For cover requests, you pay the fee now and nothing new is locked until their on-chain deposit confirms; once locked, you can claim it yourself after the waiting period without them.")
  :warns      []
  :why        (from-code "jurisdictions/contracts/Depository.sol" "Reconciles request-collateral.ts:8-15 (upfront fee, async hub R->C batch) with Depository.sol:1018,1025 (_increaseReserve pays locked collateral to the creditor on unilateral exit once confirmed).")
  :sources    ["jurisdictions/contracts/Depository.sol" "core/account/tx/handlers/rebalance/request-collateral.ts" "ui/src/components/account/ManageSheet.tsx" "docs/studies/ui/custdev-r1/report.md"])

(signing-sheet 'sheet-term
  :covers     ['place-limit-order 'cancel-order 'cross-j-swap 'borrow-facility 'repay-loan 'close-savings]
  :shows      ['program-origin 'counterparty 'delta-secured 'delta-unbacked-risk 'delta-owed 'expiry-deadline 'fee-exact]
  :fee-before #t
  :survival   (guess "Until the deadline this amount is held and you cannot spend it.")
  :warns      [(guess "If it does not complete by the deadline, the held amount returns to you.")]
  :why        (from-code "core/types/entity-tx.ts" "Time-bounded orders, cross-jurisdiction HTLC legs, and loan obligations expose exact leg amounts, debt owed, fee ceiling, and expiry deadline before signing.")
  :sources    ["core/types/entity-tx.ts" "ui/src/screens/Swap.tsx" "ui/src/screens/Lending.tsx"])

(signing-sheet 'sheet-exit
  :covers     ['unilateral-exit 'finalize-dispute]
  :shows      ['counterparty 'delta-secured 'delta-unbacked-risk 'expiry-deadline 'fee-exact]
  :fee-before #t
  :survival   (guess "You get back what is locked. What they owe you beyond that stays owed.")
  :warns      [(guess "This ends the Account with them. It cannot be undone.")]
  :why        (from-code "jurisdictions/contracts/Depository.sol" "Kernel-only sheet (never Program-invocable): states Depository _settleShortfall truth before on-chain dispute submission.")
  :sources    ["jurisdictions/contracts/Depository.sol" "ui/src/screens/AccountDetail.tsx" "ui/src/screens/Sovereignty.tsx"])

(signing-sheet 'sheet-treasury-admin
  :covers     ['move-r2e 'set-bank-rates 'propose-multisig 'vote-multisig 'export-backup 'reset-testnet]
  :shows      ['program-origin 'counterparty 'delta-secured 'delta-owed 'fee-exact 'expiry-deadline]
  :fee-before #t
  :survival   (guess "Coins withdrawn to your external address and reserve unassigned to an Account remain yours without counterparty cooperation.")
  :warns      [
    (guess "Each Account stays on its own line with its own fee; a batch never collapses into one blended figure.")
    (guess "If the board is short of its count, this only queues a proposal. No money has moved.")
  ]
  :why        (from-code "ui/src/screens/Ownership.tsx" "Carries p3-commercial's per-lane batch decomposition, Hanko sub-threshold proposal clarity, and gated backup/testnet-reset confirmation.")
  :sources    ["ui/src/screens/Move.tsx" "ui/src/screens/Ownership.tsx" "docs/studies/ui/surfaces/perspectives/p3-commercial.scm"])

;; ── Round-1 3-Bucket Control Surface (preserved for custdev-r1/run.ts comparison) ─────────────────
(surface 'personal
  :posture 'legacy-bucket-baseline
  :who     (undecided 'f1-personal-who)
  :entry   'home
  :modes   ['personal-only]
  :terms {
    :secured     (term-copy
                   :label     (as-is "ui/src/components/home/BalanceDetails.tsx" "Backed by collateral")
                   :note      (as-is "ui/src/components/home/BalanceDetails.tsx" "Covered by funds locked on-chain.")
                   :note-when 'non-zero)
    :unbacked    (term-copy
                   :label     (as-is "ui/src/components/home/BalanceDetails.tsx" "Without collateral")
                   :note      (as-is "ui/src/components/home/BalanceDetails.tsx" "Repayment depends on the other party.")
                   :note-when 'non-zero)
    :owed        (as-is "ui/src/components/home/BalanceDetails.tsx" "You owe")
    :cover       (as-is "ui/src/screens/AccountDetail.tsx" "Cover it")
    :peer-credit (guess "Tab limit")
    :hub         (as-is "ui/src/components/home/Balances.tsx" "Payment hub")
    :exit        (guess "Withdraw on-chain")
  }
  :defaults [
    (default-rule 'first-hub-credit
      :value       "0 USDC"
      :risk-bearer 'user
      :consent     (guess "Explicit opt-in sheet before granting uncollateralized receive room to a hub.")
      :why         (from-code "ui/src/components/LendingRiskConsent.tsx" "Match LendingRiskConsent principle: opening an Account never silently authorizes unsecured risk.")
      :sources     ["ui/src/components/LendingRiskConsent.tsx" "docs/studies/ui/surfaces/AS-IS.md" "fork:f5-first-hub-credit-default"])
  ]
  :screens [
    (screen 'home
      :purpose   (guess "Show collateral-backed vs unbacked exposure with notes and surface Pay, Receive, Convert, and Cover.")
      :headline  'secured-receivable
      :figures   ['secured-receivable 'unbacked-exposure 'owed-payable]
      :bars      ['secured-receivable 'unbacked-exposure]
      :actions   ['pay 'receive 'convert 'cover]
      :max-words 40
      :why       (guess "Contrast candidate Personal Home against the shipped Balance-first Home documented in AS-IS.md.")
      :sources   ["ui/src/screens/Home.tsx" "docs/studies/ui/surfaces/AS-IS.md" "fork:f6-home-headline"])
    (screen 'pay
      :purpose   (as-is "ui/src/screens/Pay.tsx" "Pay")
      :headline  'send-capacity
      :figures   ['send-capacity]
      :actions   ['pay 'pay-direct 'open-tab]
      :sources   ["ui/src/screens/Pay.tsx" "fork:f2-peer-tabs-vs-hub-credit"])
    (screen 'receive
      :purpose   (as-is "ui/src/screens/Receive.tsx" "Receive")
      :headline  'receive-capacity
      :figures   ['receive-capacity 'own-credit-granted]
      :actions   ['receive]
      :sources   ["ui/src/screens/Receive.tsx"])
    (screen 'convert
      :purpose   (guess "2-field instant token conversion without orderbook depth tables.")
      :headline  'send-capacity
      :figures   ['send-capacity 'receive-capacity]
      :actions   ['convert]
      :sources   ["ui/src/screens/Swap.tsx"])
    (screen 'savings
      :purpose   (canon "AGENTS.md" "Simple hub savings deposit and withdrawal with explicit credit-risk consent.")
      :headline  'secured-receivable
      :figures   ['secured-receivable 'unbacked-exposure]
      :actions   ['save-deposit 'save-close]
      :sources   ["ui/src/screens/Lending.tsx" "fork:f3-savings-in-personal"])
    (screen 'safety
      :when      (lambda (s) (or (:disputed s) (> (:secured s) 0)))
      :purpose   (as-is "ui/src/screens/Sovereignty.tsx" "Security and recovery")
      :headline  'dispute-phase
      :figures   ['secured-receivable 'dispute-phase]
      :actions   ['exit 'finalize-exit]
      :why       (from-code "ui/src/screens/Sovereignty.tsx" "Ensure collateralized funds remain unilaterally withdrawable during hub stalls.")
      :sources   ["ui/src/screens/Sovereignty.tsx" "fork:f4-emergency-exit-split"])
    (screen 'activity
      :purpose   (as-is "ui/src/screens/Activity.tsx" "Activity")
      :headline  'net-position
      :figures   ['net-position]
      :actions   []
      :sources   ["ui/src/screens/Activity.tsx"])
    (screen 'settings
      :purpose   (as-is "ui/src/screens/Settings.tsx" "Settings")
      :headline  'onchain-cash
      :figures   ['onchain-cash]
      :actions   ['backup 'reset-retired]
      :sources   ["ui/src/screens/Settings.tsx" "todo.md"])
  ]
  :flows [
    (flow 'pay          :verb 'send-routed      :before (as-is "ui/src/screens/Pay.tsx" "Pay")                  :pending (guess "Sending payment...")                             :done (guess "Payment settled in signed Account frame.")                                  :failed (guess "Payment did not complete; balances unchanged."))
    (flow 'pay-direct   :verb 'send-direct      :before (guess "Pay directly")                                  :pending (guess "Co-signing bilateral payment...")                :done (guess "Direct payment settled.")                                                    :failed (guess "Counterparty did not co-sign; balances unchanged."))
    (flow 'receive      :verb 'open-account     :before (as-is "ui/src/screens/Receive.tsx" "Receive")          :pending (guess "Preparing receive link...")                       :done (guess "Account ready to receive.")                                                  :failed (guess "Could not open hub Account."))
    (flow 'convert      :verb 'instant-swap     :before (as-is "ui/src/screens/Swap.tsx" "Swap")                :pending (guess "Filling swap quote...")                           :done (guess "Conversion settled.")                                                        :failed (guess "Quote expired; balances unchanged."))
    (flow 'cover        :verb 'request-cover    :before (as-is "ui/src/screens/AccountDetail.tsx" "Cover it")   :pending (guess "Asking hub to lock on-chain collateral (fee deducted from amount)...") :done (guess "99.89 USDC is now locked on the blockchain for your Account; you can withdraw it yourself even if the hub disappears.") :failed (guess "Hub did not lock collateral; unbacked balance unchanged."))
    (flow 'open-tab     :verb 'extend-peer-tab  :before (guess "Set peer tab limit")                            :pending (guess "Co-signing peer tab...")                          :done (guess "Peer tab active.")                                                           :failed (guess "Peer rejected tab update."))
    (flow 'save-deposit :verb 'deposit-savings  :before (guess "Review rate and set maximum unsecured risk")    :pending (guess "Opening savings position...")                     :done (guess "Savings position active.")                                                   :failed (guess "Savings offer rejected."))
    (flow 'save-close   :verb 'close-savings    :before (guess "Withdraw savings position")                     :pending (guess "Closing position...")                             :done (guess "Principal and accrued yield returned to Account.")                          :failed (guess "Cooperative close timed out; dispute exit available."))
    (flow 'exit         :verb 'unilateral-exit  :before (as-is "ui/src/screens/AccountDetail.tsx" "Take the last page you both signed to the chain. You never need the other side") :pending (guess "On-chain dispute window active...") :done (guess "Dispute registered on the blockchain; claim funds when timer ends.") :failed (guess "Chain transaction failed; signed frame remains intact to retry."))
    (flow 'finalize-exit :verb 'finalize-dispute :before (guess "Claim settled funds to wallet")                :pending (guess "Finalizing on-chain settlement...")               :done (guess "Funds settled to your blockchain address and contract reserve.")            :failed (guess "Window still open or transaction reverted."))
    (flow 'backup       :verb 'export-backup    :before (guess "Save encrypted recovery file")                  :pending (guess "Encrypting recovery bundle...")                   :done (as-is "ui/src/screens/Sovereignty.tsx" "Encrypted backup saved")                   :failed (guess "Backup export cancelled."))
    (flow 'reset-retired :verb 'reset-testnet   :before (canon "todo.md" "Reset retired testnet state and keep keys") :pending (guess "Clearing obsolete local state...")        :done (canon "todo.md" "Local state reset; signer keys preserved.")                        :failed (guess "Reset aborted; stop active runtime first."))
  ]
  :doors [
    'place-limit-order 'cancel-order 'cross-j-swap
    'move-r2c 'move-r2r 'move-r2e 'rebalance-policy 'set-hub-credit
    'borrow-facility 'repay-loan 'set-bank-rates
    'propose-multisig 'vote-multisig
  ]
  :why     (guess "Candidate non-operator surface isolating everyday payment, conversion, savings, and unilateral exit.")
  :sources ["ui/src/screens/Home.tsx" "docs/studies/ui/surfaces/AS-IS.md" "fork:f0-toggle-vs-surfaces"])

;; ── Personal User Stories ──────────────────────────────────────────────────────────────────────────
(story 'receive-then-cover
  :surface 'personal
  :given   'uncovered
  :steps   ['home 'cover]
  :outcome (guess "99.89 USDC locked on-chain after 0.11 USDC fee; recoverable without hub cooperation.")
  :why     (sweep "docs/studies/ui/custdev-r1/report.md" "Custdev round 1 showed post-cover wording must avoid insider 'Depository' noun and state fee up front.")
  :sources ["docs/studies/ui/custdev-r1/report.md" "docs/studies/ui/surfaces/AS-IS.md"])

(story 'disputed-unilateral-exit
  :surface 'personal
  :given   'disputed
  :steps   ['home 'safety 'exit 'finalize-exit]
  :outcome (from-code "ui/src/screens/Sovereignty.tsx" "User recovers collateralized Account balance on-chain without switching to Pro.")
  :why     (from-code "ui/src/screens/Sovereignty.tsx" "Dooring Pro watchtower administration must never strand Personal users during a dispute.")
  :sources ["ui/src/screens/Sovereignty.tsx" "fork:f4-emergency-exit-split"])
