;; programs.scm — Converged Round-3 Catalog of Client XLN Programs (DSL v2).
;; Synthesizes consumer (p1/p2), commercial (p3), steward (p4), and red-team regression (p4) programs.
;; Every non-hostile program proposes typed EntityTx/AccountTx intents and crosses the deriveDelta-dispatched
;; Wallet Kernel signing sheets in personal.scm; no program ever touches signer keys or unilateral-exit.

;; ── 1. Consumer & Retail Programs (p1-consumer + p2-sovereign) ─────────────────────────────────────

(xln-app 'merchant-checkout
  :kind        'external
  :render      'fixed
  :audience    (guess "Person paying a merchant page, deep link, or HTTP 402 invoice.")
  :reads       ['send-capacity 'secured-receivable]
  :requests    ['send-routed 'send-direct]
  :claim-shown (guess "Pay this merchant 25.00 USDC. You see who is paid and the fee ceiling before signing.")
  :why         (from-code "ui/src/screens/Pay.tsx" "External checkout pages propose a payment only; keeping open-account out of ordinary checkout requests avoids conflating spend with onboarding.")
  :sources     ["ui/src/screens/Pay.tsx" "ui/src/screens/Receive.tsx" "docs/studies/ui/surfaces/perspectives/p1-consumer.scm"])

(xln-app 'group-tab
  :kind        'embedded
  :render      'generative
  :audience    (guess "Household or friends splitting shared expenses over bounded bilateral tabs.")
  :reads       ['unbacked-exposure 'owed-payable 'peer-credit-granted 'secured-receivable]
  :requests    ['extend-peer-tab 'send-direct 'send-routed 'request-cover]
  :claim-shown (guess "Split a shared bill; any tab ceiling, payment, or lock request signs through the wallet sheet.")
  :why         (guess "Multi-person split layouts vary per group and fit disposable generative UI, while credit limits and payments remain gated by sheet-exposure and sheet-spend.")
  :sources     ["ui/src/screens/AccountDetail.tsx" "docs/studies/ui/surfaces/perspectives/p1-consumer.scm" "fork:f2-peer-tabs-vs-hub-credit"])

(xln-app 'instant-convert
  :kind        'embedded
  :render      'fixed
  :audience    (guess "Person converting one token for another at a quoted price.")
  :reads       ['send-capacity 'orderbook-frame]
  :requests    ['instant-swap]
  :claim-shown (guess "Swap now at the quoted price, then confirm collateral and unbacked deltas on the wallet sheet.")
  :why         (from-code "ui/src/screens/Swap.tsx" "Separates 2-field instant conversion from resting orderbooks; if the fill increases unbacked exposure, deriveDelta escalates from sheet-spend to sheet-exposure.")
  :sources     ["ui/src/screens/Swap.tsx" "docs/studies/ui/surfaces/probes/report-signing.md"])

(xln-app 'simple-savings
  :kind        'embedded
  :render      'fixed
  :audience    (guess "Saver depositing with a hub after setting an explicit maximum unsecured exposure.")
  :reads       ['secured-receivable 'own-credit-granted 'peer-credit-granted]
  :requests    ['deposit-savings 'close-savings]
  :claim-shown (guess "Deposit into hub savings only after signing the maximum unsecured amount at risk.")
  :why         (from-code "ui/src/components/LendingRiskConsent.tsx" "Isolates saver deposit/close from operator rate-card publishing and routes deposits to sheet-exposure.")
  :sources     ["ui/src/screens/Lending.tsx" "ui/src/components/LendingRiskConsent.tsx" "AGENTS.md"])

;; ── 2. Commercial, OTC & Corridor Programs (p3-commercial) ─────────────────────────────────────────

(xln-app 'otc-room
  :kind        'external
  :render      'fixed
  :audience    (guess "Two OTC desks co-signing a bilateral settlement or room hosted by the counterparty.")
  :reads       ['send-capacity 'secured-receivable 'unbacked-exposure 'peer-credit-granted 'own-credit-granted]
  :requests    ['send-direct 'request-cover 'extend-peer-tab]
  :claim-shown (guess "Co-sign one bilateral OTC deal with locked collateral, unbacked IOU, credit ceiling, and fee itemized on the wallet sheet.")
  :why         (guess "External deal rooms are session-scoped and untrusted; the wallet sheet enforces exact per-lane deltas regardless of room prose.")
  :sources     ["ui/src/screens/Pay.tsx" "docs/studies/ui/surfaces/perspectives/p3-commercial.scm"])

(xln-app 'b2b-netting
  :kind        'embedded
  :render      'fixed
  :audience    (guess "Treasurer netting open items across a supplier or freight mesh and settling residuals.")
  :reads       ['account-lanes 'owed-payable 'unbacked-exposure 'net-position 'send-capacity]
  :requests    ['send-routed 'send-direct]
  :claim-shown (guess "Net open supplier items across your Accounts and sign one itemized residual line per counterparty.")
  :why         (from-code "ui/src/screens/Desk.tsx" "Computes netting proposals outside the Kernel while signing per-lane residual payments without granting new credit.")
  :sources     ["ui/src/screens/Desk.tsx" "docs/studies/ui/surfaces/perspectives/p3-commercial.scm"])

(xln-app 'cross-j-rfq
  :kind        'embedded
  :render      'fixed
  :audience    (guess "Market maker quoting and executing cross-jurisdiction legs and resting limit orders.")
  :reads       ['orderbook-frame 'send-capacity 'receive-capacity 'reserve-cash 'onchain-cash]
  :requests    ['cross-j-swap 'place-limit-order 'cancel-order 'instant-swap]
  :claim-shown (guess "Review exact two-network legs, fee ceiling, and expiry deadline before signing.")
  :why         (from-code "ui/src/screens/Swap.tsx" "Fixed leg rendering prevents quote drift between preview and sheet-term signature.")
  :sources     ["ui/src/screens/Swap.tsx" "docs/studies/ui/surfaces/perspectives/p3-commercial.scm"])

(xln-app 'hub-facility
  :kind        'embedded
  :render      'fixed
  :audience    (guess "Hub operator publishing bank rates and commercial treasurer drawing or repaying credit facilities.")
  :reads       ['reserve-cash 'account-lanes 'peer-credit-granted 'own-credit-granted]
  :requests    ['set-bank-rates 'borrow-facility 'repay-loan]
  :claim-shown (guess "Publish hub bank terms or draw/repay a signed facility with debt and deadline itemized.")
  :why         (canon "AGENTS.md" "Keeps commercial bank/facility/term-loan workflows distinct from retail saver deposits.")
  :sources     ["ui/src/screens/Lending.tsx" "AGENTS.md" "docs/studies/ui/surfaces/perspectives/p3-commercial.scm"])

;; ── 3. Bounded Autonomous Steward Programs (p4-steward-redteam) ────────────────────────────────────

(xln-app 'mppx-spend-steward
  :kind        'steward
  :render      'generative
  :audience    (guess "Developer or AI operator funding metered x402/mppx API calls under a capped allowance without exposing root keys.")
  :reads       ['send-capacity 'secured-receivable 'unbacked-exposure 'account-lanes]
  :requests    ['send-routed]
  :claim-shown (guess "Authorize up to 25.00 USDC over 24 hours for metered API calls (0.25 USDC max per call, 0.01 USDC max routing fee).")
  :why         (from-code "cli/agent-payment.ts" "Binds dynamic task budget cards to the serialized owner-lane prepare/send runner capped by htlcPayment.maxSenderDebit.")
  :sources     ["cli/agent-payment.ts" "core/types/entity-tx.ts" "docs/studies/ui/surfaces/perspectives/p4-steward-redteam.scm"])

(xln-app 'auto-cover-steward
  :kind        'steward
  :render      'generative
  :audience    (guess "Merchant or recipient wanting incoming unbacked hub receivables converted into locked collateral automatically under a fee cap.")
  :reads       ['unbacked-exposure 'secured-receivable 'peer-credit-granted 'account-lanes]
  :requests    ['rebalance-policy 'request-cover]
  :claim-shown (guess "Request on-chain collateral cover whenever unbacked receivables exceed 50.00 USDC at <= 0.20% fee.")
  :why         (from-code "core/types/entity-tx.ts" "Compiles human-signed fee-vs-exposure rules into deterministic setRebalancePolicy and requestCollateral intents.")
  :sources     ["ui/src/screens/AccountDetail.tsx" "core/types/entity-tx.ts" "docs/studies/ui/surfaces/perspectives/p4-steward-redteam.scm"])

(xln-app 'scheduled-payout-steward
  :kind        'steward
  :render      'generative
  :audience    (guess "Multi-signer treasury executing recurring contractor payroll or milestone supplier schedules.")
  :reads       ['secured-receivable 'send-capacity 'reserve-cash 'account-lanes 'entity-board]
  :requests    ['send-routed 'send-direct 'move-r2r]
  :claim-shown (guess "Queue Friday supplier and payroll schedule across verified recipients with per-lane lines and fee ceiling.")
  :why         (from-code "core/types/entity-tx.ts" "Synthesizes invoice schedules into deterministic payout batches co-signed via Hanko board proposals.")
  :sources     ["core/types/entity-tx.ts" "cli/agent-payment.ts" "docs/studies/ui/surfaces/perspectives/p4-steward-redteam.scm"])

;; ── 4. Hostile Red-Team Regression Programs (p4-steward-redteam) ───────────────────────────────────

(xln-app 'disguised-10k-credit-reward
  :kind        'hostile-test
  :render      'generative
  :audience    (guess "Newcomer clicking a promotional hub onboarding reward card.")
  :reads       ['own-credit-granted 'peer-credit-granted 'receive-capacity]
  :requests    ['set-hub-credit 'extend-peer-tab]
  :claim-shown (guess "Claim your 50.00 USDC welcome reward and unlock zero-fee instant receiving.")
  :why         (sweep "docs/studies/ui/surfaces/probes/runs-signing/summary-frontier.json" "Regression vector H1 (C1/C2): defeated 7/7 by sheet-exposure disclosing +10,000 USDC unsecured credit limit and zero collateral recovery.")
  :sources     ["docs/studies/ui/surfaces/AS-IS.md" "docs/studies/ui/surfaces/probes/report-signing.md"])

(xln-app 'unbacked-swap-bait
  :kind        'hostile-test
  :render      'generative
  :audience    (guess "Holder tempted by an above-par +0.50% instant swap rebate.")
  :reads       ['secured-receivable 'net-position 'orderbook-frame]
  :requests    ['instant-swap 'extend-peer-tab]
  :claim-shown (guess "Swap 1,000.00 USDC for 1,005.00 USDT instantly (+0.50% maker rebate, 100% backed).")
  :why         (sweep "docs/studies/ui/surfaces/probes/runs-signing/summary-frontier.json" "Regression vector H2 (C3 vs C4): proves sheet selection must dispatch on deriveDelta (deltaUnbackedRisk > 0 -> sheet-exposure, 7/7 REJECT) rather than verb instant-swap.")
  :sources     ["ui/src/runtime/views.ts" "docs/studies/ui/surfaces/probes/report-signing.md"])

(xln-app 'hidden-fee-drain
  :kind        'hostile-test
  :render      'generative
  :audience    (guess "Developer approving a 5 USDC API pass claiming sponsored zero fees.")
  :reads       ['send-capacity 'secured-receivable 'account-lanes]
  :requests    ['send-routed 'request-cover 'rebalance-policy]
  :claim-shown (guess "Pay 5.00 USDC for monthly API access — routing and maintenance fees sponsored (0.00 USDC).")
  :why         (sweep "docs/studies/ui/surfaces/probes/runs-signing/summary-frontier.json" "Regression vector H4a (C8): defeated 7/7 by Kernel-computed 245.00 USDC worst-case fee ceiling.")
  :sources     ["core/types/entity-tx.ts" "docs/studies/ui/surfaces/probes/report-signing.md"])

(xln-app 'stalled-hub-trap
  :kind        'hostile-test
  :render      'fixed
  :audience    (guess "Disputed user searching for an instant release button when a hub stalls.")
  :reads       ['dispute-phase 'unbacked-exposure 'secured-receivable]
  :requests    ['open-account 'deposit-savings 'send-direct]
  :claim-shown (guess "Hub sync delayed — sign fast-track bridge release to unlock your stuck 500.00 USDC without waiting on-chain.")
  :why         (sweep "docs/studies/ui/surfaces/probes/runs-signing/summary-frontier.json" "Regression vector H4b (C9): defeated 7/7 by Kernel-owned exit isolation plus 365-day lockup and unbacked delta disclosure.")
  :sources     ["ui/src/screens/Sovereignty.tsx" "docs/studies/ui/surfaces/probes/report-signing.md"])
