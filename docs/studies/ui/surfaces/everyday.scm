;; everyday.scm — Canonical Regular-Person Wallet (Venmo + Splitwise + Invisible Autopilot, DSL v3).
;;
;; Enforced mechanically by check.ts (:posture 'human-everyday):
;;   1. Zero channel/capacity :bars on any screen.
;;   2. Zero protocol/plumbing jargon in user-facing copy (collateral, unbacked, counterparty,
;;      credit limit/ceiling, reserve, depository, htlc, hanko, co-signed, frame, lane, watchtower).
;;   3. Zero manual plumbing buttons (request-cover, rebalance-policy, move-r2c, set-hub-credit):
;;      protocol mechanics are absorbed by deterministic (autopilot ...) rules under the hood.
;;   4. First-party actions use calm inline previews (:delivery 'inline-quiet), never popup modals;
;;      interrupt sheets fire ONLY when an external app/link asks for money or a new tab.

;; ── 1. Inline First-Party Preview vs External Request Sheet ───────────────────────────────────────

(signing-sheet 'everyday-inline-action
  :delivery   'inline-quiet
  :covers     ['send-routed 'send-direct 'request-payment-link 'move-r2e 'extend-peer-tab 'deposit-savings 'close-savings]
  :shows      ['human-summary 'fee-ceiling]
  :fee-before #t
  :warns      []
  :why        (guess "Inside the wallet, paying a friend, splitting dinner, or cashing out shows recipient and fee inline on the button itself — never a second MetaMask-style confirmation popup.")
  :sources    ["ui/src/screens/Pay.tsx" "docs/studies/ui/surfaces/probes/report-signing.md"])

(signing-sheet 'external-request-sheet
  :delivery   'interrupt-sheet
  :covers     ['send-routed 'send-direct 'extend-peer-tab]
  :shows      ['program-origin 'human-summary 'fee-ceiling 'expiry-deadline]
  :fee-before #t
  :survival   (as-is "frontend/src/lib/everyday/wallet-posture.ts" "Completed payments are final; shared tabs stay between you and the person you named.")
  :warns      [(as-is "frontend/src/lib/everyday/wallet-posture.ts" "Only open a tab with someone you actually know and trust.")]
  :why        (sweep "docs/studies/ui/surfaces/probes/runs-signing/summary-nous-oauth-frontier.json" "Fires only when an outside checkout link or embedded split calculator proposes an action, rendering the single concrete action in plain human words.")
  :sources    ["frontend/src/lib/everyday/wallet-posture.ts" "docs/studies/ui/surfaces/probes/report-signing.md"])

;; ── 2. Everyday Human Surface (Venmo Cash + Splitwise Friends + Invisible Reliability) ────────────

(surface 'everyday
  :posture 'human-everyday
  :who     (guess "Regular people paying friends, splitting shared expenses like Splitwise, getting paid like Venmo, and cashing out without ever seeing blockchain or accounting plumbing.")
  :entry   'home
  :modes   ['personal-only]
  :terms   {
    :cash     (term-copy
                :label     (as-is "frontend/src/lib/everyday/wallet-posture.ts" "Cash")
                :note      (as-is "frontend/src/lib/everyday/wallet-posture.ts" "Your money, ready to spend or cash out anytime.")
                :note-when 'always)
    :arriving (term-copy
                :label     (as-is "frontend/src/lib/everyday/wallet-posture.ts" "Arriving")
                :note      (as-is "frontend/src/lib/everyday/wallet-posture.ts" "Finishing automatically before it joins your Cash.")
                :note-when 'non-zero)
    :people   (term-copy
                :label     (as-is "frontend/src/lib/everyday/wallet-posture.ts" "Friends & tabs")
                :note      (as-is "frontend/src/lib/everyday/wallet-posture.ts" "Shared bills and tabs with people you know.")
                :note-when 'non-zero)
    :owed     (term-copy
                :label     (as-is "frontend/src/lib/everyday/wallet-posture.ts" "You owe")
                :note      (as-is "frontend/src/lib/everyday/wallet-posture.ts" "Settle up in one tap whenever you are ready.")
                :note-when 'non-zero)
    :savings  (term-copy
                :label     (as-is "frontend/src/lib/everyday/wallet-posture.ts" "Savings")
                :note      (as-is "frontend/src/lib/everyday/wallet-posture.ts" "Lent to earn interest — not protected like Cash; separate from Cash and requires explicit consent.")
                :note-when 'always)
  }
  :defaults [
    (default-rule 'bounded-hub-transit-buffer
      :value       "$250 transit cap · $1 immediate auto-settle"
      :risk-bearer 'none
      :consent     (guess "$250 transit cap · $1 immediate auto-settle — incoming payments settle into Cash automatically instead of opening silent tabs.")
      :why         (from-code "frontend/src/lib/everyday/everyday-autopilot.ts" "Replaces the silent 10,000 onboarding grant with EVERYDAY_HUB_POLICY_USD ($250 transit cap, $1 r2cRequestSoftLimit) so incoming hub payments auto-settle into Cash.")
      :sources     ["frontend/src/lib/everyday/everyday-autopilot.ts" "ui/src/runtime/hosted.ts" "docs/studies/ui/surfaces/AS-IS.md"])
    (default-rule 'pro-hidden-by-default
      :value       "off"
      :risk-bearer 'none
      :consent     (guess "Trading desks and operator tools stay out of the way.")
      :why         (guess "Reverses the old engineer-POV Pro-on-by-default toggle so regular people open a calm Venmo/Splitwise app.")
      :sources     ["fork:f10-everyday-autopilot-vs-bucket-bars"])
  ]
  :autopilots [
    (autopilot 'auto-settle-incoming
      :verbs    ['open-account 'request-cover 'rebalance-policy]
      :trigger  (from-code "core/account/tx/handlers/rebalance/request-collateral.ts" "Whenever an incoming hub payment arrives as unsettled hub float.")
      :behavior (guess "Automatically settles incoming hub float into protected on-chain Cash under a built-in <= 0.20% fee cap, showing 'Incoming · finishing...' for a few seconds instead of a manual Cover button.")
      :fallback (guess "Payment still finishing — we will keep retrying automatically.")
      :sources  ["core/account/tx/handlers/rebalance/request-collateral.ts" "ui/src/screens/AccountDetail.tsx"])
    (autopilot 'auto-route-funds
      :verbs    ['move-r2c 'instant-swap]
      :trigger  (from-code "ui/src/runtime/financial/move.ts" "Whenever Pay or Cash out crosses internal wallet/contract buckets or token pairs.")
      :behavior (guess "Automatically routes across wallet, contract, and stablecoin pairs behind one Cash balance so the user never manages four buckets.")
      :fallback (guess "Could not complete right now — your Cash was not touched.")
      :sources  ["ui/src/runtime/financial/move.ts" "ui/src/screens/Swap.tsx"])
    (autopilot 'auto-recovery-shield
      :verbs    ['unilateral-exit 'finalize-dispute 'export-backup]
      :trigger  (from-code "ui/src/screens/Sovereignty.tsx" "Encrypted backup on setup, plus automatic on-chain claim if a payment hub ever stops responding.")
      :behavior (guess "Automatically submits the latest signed proof and returns settled funds to Cash without asking the user to act as a lawyer or operator.")
      :fallback (guess "Provider offline — recovery service blocks stale claims automatically, while starting your own on-chain exit requires network gas (0 ETH available).")
      :sources  ["ui/src/screens/Sovereignty.tsx" "frontend/src/lib/everyday/everyday-recovery.ts" "jurisdictions/contracts/Depository.sol"])
  ]
  :screens [
    (screen 'home
      :purpose   (guess "See your Cash, pay anyone, or request money in one tap.")
      :headline  'everyday-cash
      :figures   ['everyday-cash 'arriving-cash]
      :actions   ['pay 'request-link 'cash-out]
      :mode      'personal-only
      :max-words 20
      :why       (guess "Venmo-simple entry: one Cash number, arriving status when non-zero, zero capacity bars, zero storage buckets.")
      :sources   ["ui/src/screens/Home.tsx" "frontend/src/lib/everyday/everyday-projection.ts" "fork:f10-everyday-autopilot-vs-bucket-bars"])
    (screen 'people
      :purpose   (guess "See who owes whom, split a shared bill, or settle up.")
      :headline  'friends-tabs
      :figures   ['friends-tabs 'owed-payable]
      :actions   ['split-tab 'settle-tab]
      :mode      'personal-only
      :max-words 20
      :why       (guess "Splitwise-simple human tabs: 'Alex owes you $40' needs zero finance jargon because everyone understands a friend tab.")
      :sources   ["ui/src/screens/Manage.tsx" "ui/src/screens/Pay.tsx"])
    (screen 'earn
      :purpose   (guess "Put money aside to earn interest, separate from your Cash.")
      :headline  'savings-balance
      :figures   ['savings-balance 'everyday-cash]
      :actions   ['save-in 'save-out]
      :mode      'personal-only
      :max-words 20
      :why       (canon "AGENTS.md" "Keeps opt-in Savings clearly separated from everyday Cash.")
      :sources   ["ui/src/screens/Lending.tsx" "AGENTS.md"])
    (screen 'activity
      :purpose   (guess "Recent payments, splits, and automatic protection status.")
      :headline  'everyday-cash
      :figures   ['everyday-cash 'friends-tabs]
      :actions   ['reset-demo]
      :mode      'personal-only
      :max-words 20
      :why       (from-code "ui/src/screens/Activity.tsx" "Plain timeline; if a hub stalls in disputed state, displays auto-recovery-shield progress calmly.")
      :sources   ["ui/src/screens/Activity.tsx" "ui/src/screens/Sovereignty.tsx"])
  ]
  :flows [
    (flow 'pay        :verb 'send-routed     :before (guess "Pay")              :pending (guess "Sending...")                    :done (guess "Sent")                             :failed (guess "Not sent — your Cash is untouched."))
    (flow 'request-link :verb 'request-payment-link :before (guess "Request")     :pending (guess "Creating request link...")       :done (guess "Request link ready to share")      :failed (guess "Could not create request link."))
    (flow 'settle-tab :verb 'send-direct     :before (guess "Settle up")        :pending (guess "Settling tab...")               :done (guess "All settled up")                   :failed (guess "Could not reach them — tab unchanged."))
    (flow 'split-tab  :verb 'extend-peer-tab :before (guess "Split a bill")     :pending (guess "Sharing split...")              :done (guess "Added to tab")                     :failed (guess "Split cancelled."))
    (flow 'cash-out   :verb 'move-r2e        :before (guess "Cash out")         :pending (guess "Sending to your account...")    :done (guess "Cashed out")                       :failed (guess "Cash out cancelled — balance unchanged."))
    (flow 'save-in    :verb 'deposit-savings :before (guess "Add to Savings")   :pending (guess "Moving to Savings...")          :done (guess "Earning interest in Savings")      :failed (guess "Stayed in Cash."))
    (flow 'save-out   :verb 'close-savings   :before (guess "Move to Cash")     :pending (guess "Moving back to Cash...")        :done (guess "Back in Cash")                     :failed (guess "Still in Savings — safe to retry."))
    (flow 'reset-demo :verb 'reset-testnet   :before (guess "Clear test data")  :pending (guess "Clearing test data...")         :done (guess "Test data cleared; login kept.")   :failed (guess "Nothing changed."))
  ]
  :doors [
    'place-limit-order 'cancel-order 'cross-j-swap
    'move-r2r 'set-hub-credit
    'borrow-facility 'repay-loan 'set-bank-rates
    'propose-multisig 'vote-multisig
  ]
  :why     (guess "Designs from the regular human outward (Venmo + Splitwise): one Cash balance, natural friend tabs, inline 1-tap actions, and deterministic autopilot hiding settlement, bucket routing, and on-chain recovery.")
  :sources ["ui/src/screens/Home.tsx" "docs/studies/ui/surfaces/AS-IS.md" "fork:f10-everyday-autopilot-vs-bucket-bars"])

;; ── 3. Everyday Human Stories ──────────────────────────────────────────────────────────────────────

(story 'pay-friend-like-venmo
  :surface 'everyday
  :given   'partlyCovered
  :steps   ['home 'pay]
  :outcome (guess "User sees Cash, taps Pay $25 to CornerCoffee with $0.05 fee shown inline on the button, and finishes in one tap with zero popup modal.")
  :why     (guess "First-party payments should feel like Venmo/Apple Cash, never a multi-row accounting audit.")
  :sources ["ui/src/screens/Pay.tsx"])

(story 'split-dinner-like-splitwise
  :surface 'everyday
  :given   'empty
  :steps   ['people 'split-tab 'settle-tab]
  :outcome (guess "User splits dinner on Friends & tabs ('Alex owes you $40') and settles up later in one tap — zero mention of bilateral credit ceilings.")
  :why     (guess "People already understand friend tabs intuitively when framed as people rather than protocol exposure.")
  :sources ["ui/src/screens/Manage.tsx"])

(story 'incoming-payment-auto-settled
  :surface 'everyday
  :given   'uncovered
  :steps   ['home 'activity]
  :outcome (guess "Incoming $100 hub payment shows 'Incoming · finishing...' for a few seconds while auto-settle-incoming locks it into Cash ($99.89) automatically — user never sees 'Without collateral' or a 'Cover it' button.")
  :why     (from-code "core/account/tx/handlers/rebalance/request-collateral.ts" "Turns manual collateral babysitting into invisible reliability.")
  :sources ["core/account/tx/handlers/rebalance/request-collateral.ts" "docs/studies/ui/surfaces/AS-IS.md"])

(story 'provider-stall-auto-recovered
  :surface 'everyday
  :given   'disputed
  :steps   ['activity]
  :outcome (guess "When a hub stops responding, auto-recovery-shield blocks stale claims automatically while Activity calmly discloses when starting your own on-chain exit requires network gas (0 ETH available).")
  :why     (from-code "jurisdictions/contracts/Depository.sol" "Delivers genuine self-custody reliability without forcing regular people to operate a dispute console.")
  :sources ["ui/src/screens/Sovereignty.tsx" "jurisdictions/contracts/Depository.sol"])
