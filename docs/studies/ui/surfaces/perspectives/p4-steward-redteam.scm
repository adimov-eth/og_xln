;; p4-steward-redteam.scm — Round 1 Cold-Entry Perspective (POV 4: Autonomous Steward Programs + Adversarial Red-Team)
;; Focus: Universal Kernel intent firewall, bounded Steward mandates (mppx/x402, auto-cover, scheduled payouts),
;; and 4 adversarial red-team XLN Programs proving why UI-only Pro toggles cannot substitute for a signing boundary.

;; ── 1. Universal Wallet Kernel Signing Sheet (Intent Firewall & Steward Mandate Boundary) ────────────
(signing-sheet 'kernel-intent-firewall
  :covers [
    'send-direct 'send-routed 'open-account 'request-cover
    'extend-peer-tab 'set-hub-credit 'instant-swap 'place-limit-order
    'cancel-order 'cross-j-swap 'move-r2c 'move-r2r 'move-r2e
    'rebalance-policy 'deposit-savings 'borrow-facility 'repay-loan
    'close-savings 'set-bank-rates 'unilateral-exit 'finalize-dispute
    'propose-multisig 'vote-multisig 'export-backup 'reset-testnet
  ]
  :shows [
    'program-origin
    'counterparty
    'delta-secured
    'delta-unbacked-risk
    'delta-credit-limit
    'delta-owed
    'fee-exact
    'expiry-deadline
  ]
  :fee-before #t
  :survival (guess "If the other party disappears right after you sign, only your collateral-backed balance and contract reserve are enforceable on-chain; unbacked balances and credit lines recover zero.")
  :warns [
    (guess "Credit ceiling increase: you are authorizing uncollateralized debt owed to you. Zero cash arrives today, and on-chain recovery on this limit is zero.")
    (guess "Collateral downgrade: this intent trades funds locked on-chain for an unbacked counterparty promise. A higher nominal total does not protect principal on default.")
    (guess "Worst-case fee ceiling: this sheet displays the maximum protocol debit or recurring policy fee your signature permits, overriding lower estimates shown by any app.")
    (guess "Stalled counterparty hazard: never sign new credit limits, term lockups, or direct transfers to release stuck funds. Use Wallet Kernel unilateral exit to settle on-chain alone.")
  ]
  :why (from-code "core/types/entity-tx.ts" "Simulates deriveDelta and worst-case protocol ceilings (maxSenderDebit, feeAmount, maxFee, maxAcceptableFee, disputeConfig) directly over proposed EntityTx/AccountTx payloads rather than Program UI claims, covering all 25 canonical verbs so neither Steward runners nor hostile Programs have an unguarded path.")
  :sources [
    "docs/studies/ui/surfaces/AS-IS.md"
    "docs/studies/ui/surfaces/AS-IS-SCREENS.md"
    "ui/src/components/LendingRiskConsent.tsx"
    "cli/agent-payment.ts"
    "core/types/entity-tx.ts"
  ])

;; ── 2. Steward-Enabled Sovereign Wallet Kernel Surface ───────────────────────────────────────────────
(surface 'steward-kernel
  :who (guess "Everyday users, autonomous AI/CLI steward operators, and treasury signers who need exact collateral truth, bounded delegation, and unspoofable unilateral exit across React and Svelte.")
  :entry 'vault
  :modes ['always 'pro-only]
  :terms {
    :secured      (term-copy
                    :label     (as-is "ui/src/components/home/BalanceDetails.tsx" "Backed by collateral")
                    :note      (as-is "ui/src/components/home/BalanceDetails.tsx" "Covered by funds locked on-chain.")
                    :note-when 'always)
    :unbacked     (term-copy
                    :label     (as-is "ui/src/components/home/BalanceDetails.tsx" "Without collateral")
                    :note      (as-is "ui/src/components/home/BalanceDetails.tsx" "Repayment depends on the other party.")
                    :note-when 'non-zero)
    :owed         (term-copy
                    :label     (as-is "ui/src/screens/AccountDetail.tsx" "You owe")
                    :note      (guess "Obligations deducted before net claims.")
                    :note-when 'non-zero)
    :onchain      (term-copy
                    :label     (as-is "ui/src/components/home/BalanceDetails.tsx" "Blockchain wallet")
                    :note      (as-is "ui/src/components/home/BalanceDetails.tsx" "Held directly at your blockchain address.")
                    :note-when 'non-zero)
    :reserve      (term-copy
                    :label     (as-is "ui/src/components/home/BalanceDetails.tsx" "Contract reserve")
                    :note      (as-is "ui/src/components/home/BalanceDetails.tsx" "Your funds in the XLN contract, not allocated to a payment account.")
                    :note-when 'non-zero)
    :send-room    (term-copy
                    :label     (guess "Spendable now")
                    :note      (guess "Immediate outbound payment room across active accounts.")
                    :note-when 'always)
    :receive-room (term-copy
                    :label     (guess "Inbound room")
                    :note      (guess "Immediate inbound room under current collateral and credit ceilings.")
                    :note-when 'non-zero)
    :peer-credit  (term-copy
                    :label     (guess "Unbacked tab you grant")
                    :note      (guess "Maximum uncollateralized balance a counterparty may owe you.")
                    :note-when 'always)
    :own-credit   (term-copy
                    :label     (guess "Credit granted to you")
                    :note      (guess "Unsecured hub line available to spend; not owned cash.")
                    :note-when 'non-zero)
    :lanes        (guess "Counterparty accounts")
    :dispute      (term-copy
                    :label     (guess "On-chain enforcement")
                    :note      (guess "Co-signed account state enforceable on-chain without counterparty cooperation.")
                    :note-when 'always)
    :board        (guess "Entity signers")
  }
  :defaults [
    (default-rule 'hub-credit
      :value       "0 USDC"
      :risk-bearer 'none
      :consent     (guess "New hub accounts start with zero unbacked credit; any positive limit requires an explicit signing-sheet signature.")
      :why         (from-code "ui/src/components/LendingRiskConsent.tsx" "Restores the documented invariant that opening an Account never authorizes unsecured risk, eliminating silent 10,000 USDC onboarding exposure.")
      :sources     ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/components/LendingRiskConsent.tsx"])
    (default-rule 'steward-mandate-bounds
      :value       "0 autonomous spend; explicit counterparty, per-tx, epoch, fee, and expiry caps required"
      :risk-bearer 'user
      :consent     (guess "Sign a bounded steward mandate with hard spend cap, worst-case fee limit, and automatic expiry.")
      :why         (from-code "cli/agent-payment.ts" "Keeps root keys out of prompts and tool outputs while serializing bounded intents on the owner lane.")
      :sources     ["cli/agent-payment.ts" "core/types/entity-tx.ts"])
    (default-rule 'kernel-recovery-exclusivity
      :value       "Kernel-only unilateral-exit, finalize-dispute, export-backup, and reset-testnet"
      :risk-bearer 'none
      :consent     (guess "Dispute exits, encrypted backups, and testnet resets execute exclusively on fixed Wallet Kernel screens.")
      :why         (guess "Prevents hostile or hallucinating Programs from spoofing emergency recovery or intercepting backup bundles.")
      :sources     ["docs/studies/ui/surfaces/BRIEF.md" "ui/src/screens/Sovereignty.tsx"])
  ]
  :screens [
    (screen 'vault
      :purpose   (guess "Separate collateral-backed cash from unbacked promises at a glance, with immediate cover, payment, and emergency exit.")
      :headline  'secured-receivable
      :figures   ['secured-receivable 'unbacked-exposure 'owed-payable 'send-capacity 'onchain-cash]
      :bars      ['secured-receivable 'unbacked-exposure 'owed-payable]
      :actions   ['connect-hub 'pay 'cover 'emergency-exit]
      :mode      'always
      :max-words 45
      :why       (guess "Promotes collateral-backed receivable over summed net balance so unbacked IOUs never masquerade as cash, and puts Cover directly on the entry screen.")
      :sources   ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/components/home/BalanceDetails.tsx"])

    (screen 'mandates
      :purpose   (guess "Inspect delegated steward budgets, tighten counterparty credit ceilings, and set fee-capped automatic collateral cover.")
      :headline  'peer-credit-granted
      :figures   ['peer-credit-granted 'unbacked-exposure 'secured-receivable 'receive-capacity 'account-lanes]
      :bars      ['secured-receivable 'unbacked-exposure]
      :actions   ['set-auto-cover 'cap-peer-tab 'cap-hub-credit 'cover]
      :mode      'always
      :when      (lambda (s) (> (:hubs s) 0))
      :max-words 45
      :why       (guess "Gives humans one place to audit and revoke every standing credit ceiling and autonomous rebalance/steward policy.")
      :sources   ["ui/src/screens/AccountDetail.tsx" "cli/agent-payment.ts" "core/types/entity-tx.ts"])

    (screen 'exit-desk
      :purpose   (guess "Submit co-signed account state on-chain without counterparty help, finalize settled disputes, export backups, or reset retired testnets.")
      :headline  'dispute-phase
      :figures   ['dispute-phase 'secured-receivable 'unbacked-exposure 'owed-payable 'entity-board]
      :bars      ['secured-receivable 'unbacked-exposure]
      :actions   ['emergency-exit 'settle-dispute 'save-backup 'wipe-retired-testnet]
      :mode      'always
      :max-words 45
      :why       (from-code "ui/src/screens/Sovereignty.tsx" "Keeps unilateral exit, dispute finalization, encrypted backup, and key-preserving testnet reset reachable in every state, especially disputed.")
      :sources   ["ui/src/screens/Sovereignty.tsx" "docs/studies/ui/surfaces/AS-IS.md" "todo.md"])

    (screen 'treasury-ops
      :purpose   (guess "Move contract reserves into account collateral, withdraw to external addresses, and co-sign multi-signer board actions.")
      :headline  'reserve-cash
      :figures   ['reserve-cash 'onchain-cash 'secured-receivable 'entity-board 'account-lanes]
      :bars      ['secured-receivable 'reserve-cash 'onchain-cash]
      :actions   ['fund-collateral 'withdraw-onchain 'propose-board 'vote-board]
      :mode      'pro-only
      :when      (lambda (s) (not (:disputed s)))
      :max-words 45
      :why       (canon "AGENTS.md" "Retains deterministic reserve plumbing and Hanko board co-signing in a compact Pro view without shipping cancelled Companies/IPO share screens.")
      :sources   ["AGENTS.md" "docs/studies/ui/surfaces/AS-IS-SCREENS.md"])
  ]
  :flows [
    (flow 'connect-hub
      :verb    'open-account
      :before  (guess "Open zero-credit account")
      :pending (guess "Opening account with 0 USDC credit ceiling...")
      :done    (guess "Account active with zero unbacked exposure.")
      :failed  (guess "Account not opened; balances unchanged.")
      :why     (guess "Binds onboarding to explicit 0 USDC default credit.")
      :sources ["docs/studies/ui/surfaces/AS-IS.md" "core/types/entity-tx.ts"])

    (flow 'pay
      :verb    'send-routed
      :before  (guess "Review & pay")
      :pending (guess "Payment committed; awaiting co-signed settlement...")
      :done    (guess "Payment settled across co-signed state.")
      :failed  (guess "Payment rejected or expired; funds unchanged.")
      :why     (from-code "cli/agent-payment.ts" "Distinguishes durable command observation from settled bilateral execution and enforces maxSenderDebit fee ceiling.")
      :sources ["cli/agent-payment.ts" "core/types/entity-tx.ts"])

    (flow 'cover
      :verb    'request-cover
      :before  (guess "Cover unbacked balance")
      :pending (guess "Requesting on-chain collateral lock...")
      :done    (guess "Debt locked as on-chain enforceable collateral.")
      :failed  (guess "Cover request declined; unbacked exposure remains.")
      :why     (guess "Surfaces exact fee deduction and post-cover on-chain survival directly from entry and mandate screens.")
      :sources ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/screens/AccountDetail.tsx"])

    (flow 'set-auto-cover
      :verb    'rebalance-policy
      :before  (guess "Save auto-cover mandate")
      :pending (guess "Committing automatic cover thresholds...")
      :done    (guess "Auto-cover policy active within fee ceiling.")
      :failed  (guess "Policy unchanged.")
      :why     (from-code "core/types/entity-tx.ts" "Maps directly to setRebalancePolicy soft/hard limits and maxAcceptableFee.")
      :sources ["core/types/entity-tx.ts"])

    (flow 'cap-peer-tab
      :verb    'extend-peer-tab
      :before  (guess "Set counterparty tab cap")
      :pending (guess "Updating unbacked credit ceiling...")
      :done    (guess "Counterparty credit ceiling updated.")
      :failed  (guess "Credit ceiling unchanged.")
      :why     (from-code "ui/src/components/LendingRiskConsent.tsx" "Makes every peerCreditLimit grant or reduction an explicit, revocable risk decision.")
      :sources ["ui/src/components/LendingRiskConsent.tsx" "core/types/entity-tx.ts"])

    (flow 'cap-hub-credit
      :verb    'set-hub-credit
      :before  (guess "Set hub routing limit")
      :pending (guess "Applying hub credit ceiling...")
      :done    (guess "Hub credit ceiling updated.")
      :failed  (guess "Hub limit unchanged.")
      :why     (from-code "core/types/account.ts" "Exposes Account-layer set_credit_limit under the same signing firewall.")
      :sources ["core/types/account.ts" "docs/studies/ui/surfaces/AS-IS.md"])

    (flow 'emergency-exit
      :verb    'unilateral-exit
      :before  (guess "Exit to chain alone")
      :pending (guess "Submitting co-signed state on-chain...")
      :done    (guess "Dispute active on-chain; challenge timer started.")
      :failed  (guess "Submission did not broadcast; co-signed proof remains safe to retry.")
      :why     (from-code "ui/src/screens/Sovereignty.tsx" "Guarantees 1-step unilateral settlement when any counterparty or hub stalls.")
      :sources ["ui/src/screens/Sovereignty.tsx" "core/types/entity-tx.ts"])

    (flow 'settle-dispute
      :verb    'finalize-dispute
      :before  (guess "Claim settled collateral")
      :pending (guess "Finalizing expired dispute window on-chain...")
      :done    (guess "Collateral settled to your contract reserve.")
      :failed  (guess "Challenge window still open or network busy; safe to retry.")
      :why     (from-code "core/types/entity-tx.ts" "Completes unilateral recovery via disputeFinalize once the response timer elapses.")
      :sources ["core/types/entity-tx.ts" "ui/src/screens/Sovereignty.tsx"])

    (flow 'save-backup
      :verb    'export-backup
      :before  (guess "Export encrypted backup")
      :pending (guess "Encrypting co-signed states and recovery bundle...")
      :done    (guess "Encrypted recovery bundle saved.")
      :failed  (guess "Backup cancelled; existing state untouched.")
      :why     (from-code "ui/src/screens/Sovereignty.tsx" "Preserves off-device unilateral exit evidence.")
      :sources ["ui/src/screens/Sovereignty.tsx"])

    (flow 'wipe-retired-testnet
      :verb    'reset-testnet
      :before  (guess "Reset retired testnet state")
      :pending (guess "Clearing obsolete chain state while keeping keys...")
      :done    (guess "Testnet state cleared; signer keys preserved.")
      :failed  (guess "Reset aborted; keys and state untouched.")
      :why     (canon "AGENTS.md" "Brings React to parity with Svelte's key-preserving retired-testnet reset after dev/testnet redeploys.")
      :sources ["AGENTS.md" "todo.md" "docs/studies/ui/surfaces/AS-IS.md"])

    (flow 'fund-collateral
      :verb    'move-r2c
      :before  (guess "Lock reserve as collateral")
      :pending (guess "Allocating contract reserve to account...")
      :done    (guess "Collateral locked on-chain for this account.")
      :failed  (guess "Reserve allocation unchanged.")
      :why     (from-code "core/types/entity-tx.ts" "Binds explicit r2c collateral funding for Pro/treasury operators.")
      :sources ["core/types/entity-tx.ts"])

    (flow 'withdraw-onchain
      :verb    'move-r2e
      :before  (guess "Withdraw to external address")
      :pending (guess "Queueing on-chain reserve withdrawal...")
      :done    (guess "Withdrawn to external blockchain address.")
      :failed  (guess "Reserve untouched; safe to retry.")
      :why     (from-code "core/types/entity-tx.ts" "Provides clean r2e exit from contract reserve to external wallet.")
      :sources ["core/types/entity-tx.ts"])

    (flow 'propose-board
      :verb    'propose-multisig
      :before  (guess "Propose board mandate")
      :pending (guess "Submitting multi-signer proposal...")
      :done    (guess "Proposal recorded for co-signers.")
      :failed  (guess "Proposal rejected; board state unchanged.")
      :why     (from-code "core/types/entity-tx.ts" "Enables Hanko multi-signer governance over treasury and steward policies.")
      :sources ["core/types/entity-tx.ts" "AGENTS.md"])

    (flow 'vote-board
      :verb    'vote-multisig
      :before  (guess "Co-sign board proposal")
      :pending (guess "Recording signer approval...")
      :done    (guess "Co-signature committed.")
      :failed  (guess "Vote not applied; proposal unchanged.")
      :why     (from-code "core/types/entity-tx.ts" "Completes threshold authorization for treasury mandates.")
      :sources ["core/types/entity-tx.ts"])
  ]
  :doors [
    'send-direct
    'instant-swap
    'place-limit-order
    'cancel-order
    'cross-j-swap
    'move-r2r
    'deposit-savings
    'borrow-facility
    'repay-loan
    'close-savings
    'set-bank-rates
  ]
  :why (guess "Shrinks dual-wallet React+Svelte parity surface from 16 screens to 4 Kernel screens (keeping todo.md's single composite exposure bar and Pro treasury split) while delegating swaps, orderbooks, lending desks, and autonomous stewards to XLN Programs gated by one unbypassable signing-sheet.")
  :sources [
    "docs/studies/ui/surfaces/BRIEF.md"
    "docs/studies/ui/surfaces/AS-IS.md"
    "docs/studies/ui/surfaces/AS-IS-SCREENS.md"
    "todo.md"
    "AGENTS.md"
  ])

;; ── 3. Autonomous Steward XLN Programs (:kind 'steward) ──────────────────────────────────────────────

;; Steward 1: Metered mppx / x402 API Spend Allowance
(xln-app 'mppx-spend-steward
  :kind        'steward
  :render      'generative
  :audience    (guess "Developers and AI agent operators paying per-request x402/mppx APIs without exposing root wallet keys to LLM prompts.")
  :reads       ['send-capacity 'secured-receivable 'unbacked-exposure 'account-lanes]
  :requests    ['send-routed]
  :claim-shown (guess "Authorize up to 25.00 USDC over 24 hours for metered x402/mppx API calls (max 0.25 USDC per call, max 0.01 USDC routing fee).")
  :why         (from-code "cli/agent-payment.ts" "Synthesizes task-scoped API budget cards dynamically while delegating execution to a serialized owner-lane runner (prepare -> wx intent file -> send) bounded by htlcPayment.maxSenderDebit and Kernel signing-sheet caps.")
  :sources     ["cli/agent-payment.ts" "core/types/entity-tx.ts" "docs/studies/ui/surfaces/BRIEF.md"])

;; Steward 2: Automatic Unbacked-Exposure Cover Steward
(xln-app 'auto-cover-steward
  :kind        'steward
  :render      'generative
  :audience    (guess "Merchants, API sellers, and savers receiving frequent hub payments who want unbacked IOUs converted into on-chain collateral automatically.")
  :reads       ['unbacked-exposure 'secured-receivable 'peer-credit-granted 'account-lanes]
  :requests    ['rebalance-policy 'request-cover]
  :claim-shown (guess "Automatically lock on-chain collateral whenever unbacked hub receivables exceed 50.00 USDC and the conversion fee is at or below 0.20%.")
  :why         (from-code "core/types/entity-tx.ts" "Replaces manual AccountDetail 'Cover it' babysitting with a generative fee-vs-exposure curve that compiles down to deterministic setRebalancePolicy and requestCollateral bounds checked by kernel-intent-firewall.")
  :sources     ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/screens/AccountDetail.tsx" "core/types/entity-tx.ts"])

;; Steward 3: Scheduled Supplier & Payroll Settlement Steward
(xln-app 'scheduled-payout-steward
  :kind        'steward
  :render      'generative
  :audience    (guess "Operations leads and multi-signer treasuries settling recurring contractor payroll or milestone supplier invoices on deterministic schedules.")
  :reads       ['secured-receivable 'send-capacity 'reserve-cash 'account-lanes 'entity-board]
  :requests    ['send-routed 'send-direct 'move-r2r]
  :claim-shown (guess "Execute approved Friday supplier and payroll schedule totaling 4,800.00 USDC across 6 verified recipient entities with 2.40 USDC maximum routing fee.")
  :why         (from-code "core/types/entity-tx.ts" "Renders dynamic invoice/payroll run tables outside the minimal Wallet Kernel while compiling into deterministic scheduledWake-compatible payout intents whose exact recipient set, total debit, and fee cap are verified by kernel-intent-firewall.")
  :sources     ["core/types/entity-tx.ts" "cli/agent-payment.ts" "docs/studies/ui/surfaces/BRIEF.md"])

;; ── 4. Adversarial Red-Team Attack XLN Programs (:kind 'hostile-test) ────────────────────────────────

;; Hostile Test 1: Zero-Cash 10,000 USDC Unbacked Credit Grant Disguised as Onboarding Reward
(xln-app 'disguised-10k-credit-reward
  :kind        'hostile-test
  :render      'generative
  :audience    (guess "Retail newcomer or airdrop hunter clicking a promotional zero-fee hub reward card.")
  :reads       ['own-credit-granted 'peer-credit-granted 'receive-capacity]
  :requests    ['set-hub-credit 'extend-peer-tab]
  :claim-shown (guess "Claim your 50.00 USDC welcome reward and unlock zero-fee instant receiving.")
  :why         (from-code "core/types/entity-tx.ts" "Exploits the fact that extendCredit and set_credit_limit transfer 0 USDC at signing time (mirroring AS-IS.md's silent 10,000 USDC onboarding grant), allowing a malicious hub to borrow or route against the victim's 10,000 USDC credit ceiling. Defeated by kernel-intent-firewall showing program-origin, counterparty, +10,000 USDC delta-credit-limit, the zero-recovery credit warning, and 0 USDC on-chain survival.")
  :sources     ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/components/LendingRiskConsent.tsx" "core/types/entity-tx.ts" "core/types/account.ts"])

;; Hostile Test 2: Collateral-to-IOU Swap Bait Exploiting Nominal Net-Balance Framing
(xln-app 'unbacked-swap-bait
  :kind        'hostile-test
  :render      'generative
  :audience    (guess "Stablecoin holder tempted by a +0.50% promotional market-maker swap quote.")
  :reads       ['secured-receivable 'net-position 'orderbook-frame]
  :requests    ['extend-peer-tab 'instant-swap 'deposit-savings]
  :claim-shown (guess "Swap 1,000.00 USDC for 1,005.00 USDT instantly (+0.50% maker rebate, 100% backed).")
  :why         (from-code "ui/src/runtime/views.ts" "Exploits wallets that headline summed TokenTotals.net: trading 1,000 USDC of on-chain collateral for 1,005 USDT of uncollateralized counterparty debt makes nominal balance rise by +$5 while wiping out on-chain backing. Defeated by kernel-intent-firewall pairing delta-secured (-1,000 USDC) directly against delta-unbacked-risk (+1,005 USDT) and firing the collateral-downgrade warning.")
  :sources     ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/runtime/views.ts" "core/types/entity-tx.ts"])

;; Hostile Test 3: Inflated maxSenderDebit & Recurring Rebalance Fee Skim Behind "Zero Fee" Copy
(xln-app 'hidden-fee-drain
  :kind        'hostile-test
  :render      'generative
  :audience    (guess "Developer or steward user approving a routine 5 USDC API pass or free liquidity optimizer.")
  :reads       ['send-capacity 'secured-receivable 'account-lanes]
  :requests    ['send-routed 'request-cover 'rebalance-policy]
  :claim-shown (guess "Pay 5.00 USDC for monthly API access — routing and maintenance fees sponsored (0.00 USDC).")
  :why         (from-code "core/types/entity-tx.ts" "Hides a 245 USDC htlcPayment.maxSenderDebit route skim plus high requestCollateral.feeAmount and recurring setRebalancePolicy.maxAcceptableFee behind '0.00 USDC fee' UI copy. Defeated by kernel-intent-firewall enforcing :fee-before #t and computing fee-exact from worst-case protocol fields before signing.")
  :sources     ["core/types/entity-tx.ts" "cli/agent-payment.ts" "docs/studies/ui/surfaces/AS-IS.md"])

;; Hostile Test 4: Fake "Fast-Track Sync Release" Luring Disputed Users Away From Unilateral Exit
(xln-app 'stalled-hub-trap
  :kind        'hostile-test
  :render      'fixed
  :audience    (guess "Anxious user whose hub stopped co-signing or stalled a 500 USDC payment and who searches for an instant release button.")
  :reads       ['dispute-phase 'unbacked-exposure 'secured-receivable]
  :requests    ['open-account 'deposit-savings 'send-direct]
  :claim-shown (guess "Hub sync delayed — sign fast-track bridge release to unlock your stuck 500.00 USDC without waiting on-chain.")
  :why         (from-code "ui/src/screens/Sovereignty.tsx" "Lures a user facing a stalled hub into opening a long-disputeConfig account, locking claims into lendingOffer, or sending an unconditioned trusted directPayment instead of exiting on-chain. Defeated in two layers: Programs cannot touch Kernel unilateral-exit, and kernel-intent-firewall exposes expiry-deadline plus the stalled-counterparty warning pointing straight to exit-desk.")
  :sources     ["ui/src/screens/Sovereignty.tsx" "core/types/entity-tx.ts" "docs/studies/ui/surfaces/BRIEF.md"])

;; ── 5. End-to-End User & Steward Journeys ────────────────────────────────────────────────────────────

(story 'zero-credit-onboard-and-reject-reward-bait
  :surface 'steward-kernel
  :given   'empty
  :steps   ['vault 'connect-hub 'exit-desk 'save-backup]
  :outcome (guess "User opens a hub account with 0 USDC unbacked credit, rejects disguised-10k-credit-reward when kernel-intent-firewall reveals +10,000 USDC delta-credit-limit and zero on-chain recovery, and saves an encrypted backup.")
  :why     (guess "Proves that zero-credit onboarding plus delta-credit-limit disclosure eliminates silent 10,000 USDC exposure from day one.")
  :sources ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/components/LendingRiskConsent.tsx"])

(story 'steward-auto-cover-uncovered-balance
  :surface 'steward-kernel
  :given   'uncovered
  :steps   ['vault 'cover 'mandates 'set-auto-cover]
  :outcome (guess "User sees $0.00 collateral-backed above $100.00 unbacked on vault, locks 99.89 USDC on-chain after reviewing the 0.11 USDC fee on kernel-intent-firewall, and activates auto-cover-steward capped at 0.20% max fee.")
  :why     (guess "Fixes AS-IS.md's buried Cover action and automates ongoing protection within a human-signed fee ceiling.")
  :sources ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/screens/AccountDetail.tsx" "core/types/entity-tx.ts"])

(story 'mppx-allowance-and-hostile-swap-fee-rejection
  :surface 'steward-kernel
  :given   'partlyCovered
  :steps   ['vault 'mandates 'cap-peer-tab 'pay]
  :outcome (guess "User keeps counterparty credit tightly capped, signs a 25 USDC / 24h mppx-spend-steward allowance with 0.01 USDC max routing fee, and rejects both unbacked-swap-bait (-45 USDC delta-secured) and hidden-fee-drain (245 USDC fee-exact).")
  :why     (from-code "cli/agent-payment.ts" "Demonstrates side-by-side operation of legitimate metered machine payments and deterministic rejection of collateral-downgrade and fee-skim attacks.")
  :sources ["cli/agent-payment.ts" "core/types/entity-tx.ts" "docs/studies/ui/surfaces/BRIEF.md"])

(story 'pro-treasury-scheduled-payroll-settlement
  :surface 'steward-kernel
  :given   'partlyCovered
  :steps   ['treasury-ops 'fund-collateral 'propose-board 'vote-board 'vault 'pay]
  :outcome (guess "Multi-signer treasury allocates contract reserve into collateral, co-signs the scheduled-payout-steward batch mandate, and settles 6 supplier payouts under an exact routing-fee ceiling.")
  :why     (canon "AGENTS.md" "Verifies Pro reserve management and Hanko board approval working cleanly with an externalized Steward Program.")
  :sources ["AGENTS.md" "core/types/entity-tx.ts" "docs/studies/ui/surfaces/AS-IS-SCREENS.md"])

(story 'stalled-hub-trap-refusal-and-unilateral-exit
  :surface 'steward-kernel
  :given   'disputed
  :steps   ['vault 'exit-desk 'emergency-exit 'settle-dispute 'save-backup]
  :outcome (guess "When the hub stalls, user refuses stalled-hub-trap after kernel-intent-firewall flags the lockup deadline and unbacked debit, triggers emergency-exit on exit-desk to enforce the 45 USDC collateralized state on-chain alone, finalizes after timeout, and saves backup.")
  :why     (from-code "ui/src/screens/Sovereignty.tsx" "Confirms unilateral on-chain recovery remains 1-click reachable in disputed state and immune to generative or phishing UI interception.")
  :sources ["ui/src/screens/Sovereignty.tsx" "core/types/entity-tx.ts" "docs/studies/ui/surfaces/AS-IS.md"])

;; ── 6. Explicit Architectural Forks (Baseline Comparison & Steward Authority Locus) ──────────────────

(fork 'f-p4-toggle-vs-kernel-firewall
  :status   'open
  :decider  'maintainer
  :question "Should React and Svelte implement todo.md's single capacity bar + Pro toggle inside the existing 16-screen monolith, or shrink both wallets to a 4-screen Kernel + universal signing-sheet while moving desks and stewards to XLN Programs?"
  :affects  ['kernel-intent-firewall 'steward-kernel 'app/mppx-spend-steward 'app/auto-cover-steward 'app/scheduled-payout-steward]
  :options  {
    :monolith-pro-toggle  "Keep 16 screens in React and Svelte behind an on-by-default Pro toggle and one capacity bar."
    :kernel-plus-programs "Ship one 3-segment exposure bar and a Pro treasury tab inside a 4-screen Kernel, enforce one signing-sheet over all 25 verbs, and run desks/stewards as XLN Programs."
  }
  :current  'kernel-plus-programs
  :why      (guess "todo.md's single bar + Pro toggle wins on day-one diff size if users only click trusted first-party forms, but a UI toggle neither cuts 16-screen React+Svelte parity maintenance nor guards sendEntityTxs against deep links, mppx/x402 runners, or hostile apps. A 4-screen Kernel + universal signing-sheet preserves the single bar and Pro split while cutting dual-wallet surface area and blocking all 4 red-team exploits.")
  :sources  ["todo.md" "docs/studies/ui/surfaces/BRIEF.md" "docs/studies/ui/surfaces/AS-IS.md" "docs/studies/ui/surfaces/AS-IS-SCREENS.md"])

(fork 'f-p4-steward-mandate-enforcement
  :status   'open
  :decider  'code
  :question "Where should bounded steward allowances (spend cap, counterparty allowlist, max fee, expiry) be enforced: exclusively in the local Wallet Kernel / trusted runner or also as scoped sub-signers in EntityState?"
  :affects  ['kernel-intent-firewall 'steward-kernel 'app/mppx-spend-steward 'app/scheduled-payout-steward]
  :options  {
    :runner-enforced  "Enforce signed mandate bounds in the Wallet Kernel and cli/agent-payment.ts owner-lane runner without changing consensus types."
    :entity-subsigner "Commit scoped sub-signer allowances (verb set, token cap, fee cap, expiry) in EntityState so multi-signer boards enforce bounds in consensus."
  }
  :current  'runner-enforced
  :why      (from-code "cli/agent-payment.ts" "Runner-enforced mandates work today over RemoteRuntimeAdapter and SignedEntityCommandV1 without frozen-core consensus churn; EntityState sub-signers become warranted when multi-party Hanko boards delegate to a remote daemon without sharing a full board key.")
  :sources  ["cli/agent-payment.ts" "core/types/entity-tx.ts" "AGENTS.md"])
