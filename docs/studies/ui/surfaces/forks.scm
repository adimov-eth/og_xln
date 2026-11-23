;; forks.scm — Explicit contested design choices grounded in origin/main (bdc53c7b).
;; Models may explore options by flipping :current, NEVER set :status "closed" on maintainer/person forks.

(fork 'f0-toggle-vs-surfaces
  :status   "open"
  :decider  "maintainer"
  :question "Should Personal vs Pro be an on-by-default Pro toggle inside one wallet shell (todo.md) or two distinct surfaces over one shared runtime?"
  :affects  ['personal/home 'pro/desk]
  :options  {
    :pro-toggle-in-one-shell "Follow todo.md: one capacity bar on Home + a Pro toggle (on by default) in both React and Svelte wallets."
    :separate-surfaces       "Separate Personal and Pro surfaces so entry screen, vocabulary, and default credit posture can differ per audience."
  }
  :current  'separate-surfaces
  :why      (canon "todo.md" "Upstream todo.md specifies a Pro toggle (on by default) in both wallets; multi-surface separation must prove why a toggle is insufficient if a non-pro user exists.")
  :sources  ["todo.md" "AGENTS.md" "ui/src/screens/Home.tsx"])

(fork 'f1-personal-who
  :status   "open"
  :decider  "maintainer"
  :question "Who is the concrete non-pro user of Personal at launch, given OTC/MM/payout operators are the active interview cohort in todo.md?"
  :affects  ['personal/home]
  :options  {
    :payout-recipient    "End recipient of an OTC/payout firm who receives, holds, covers, or withdraws without managing hub lanes."
    :household-peer-user "Retail person paying peers, holding savings, and splitting bilateral tabs."
    :defer-personal      "No non-pro launch user yet; ship Pro-first (toggle on by default) until operator interviews surface a second persona."
  }
  :current  'payout-recipient
  :why      (canon "todo.md" "todo.md queues 10 OTC/MM/payout firm conversations; retail persona remains unconfirmed.")
  :sources  ["todo.md" "docs/owner-profile.md"])

(fork 'f2-peer-tabs-vs-hub-credit
  :status   "open"
  :decider  "maintainer"
  :question "Should Personal expose bounded peer tabs (extendCredit) while dooring hub routing credit limits (set_credit_limit)?"
  :affects  ['personal/pay 'extend-peer-tab 'set-hub-credit]
  :options  {
    :split-peer-vs-hub "Allow bounded (extendCredit) peer tabs in Personal while keeping hub routing (set_credit_limit) in Pro."
    :door-all-credit   "Door both in Personal; Personal only transacts over collateral plus explicit hub receive consent."
  }
  :current  'split-peer-vs-hub
  :why      (from-code "core/types/entity-tx.ts" "Both peer tabs and hub lines compile to bilateral credit limits; splitting them is a UI policy boundary.")
  :sources  ["core/types/entity-tx.ts" "core/types/account.ts" "ui/src/screens/Manage.tsx"])

(fork 'f3-savings-in-personal
  :status   "open"
  :decider  "maintainer"
  :question "Does Personal include the retail savings slice of Lending.tsx (with LendingRiskConsent), or keep all Lending in Pro?"
  :affects  ['personal/savings 'pro/lending 'deposit-savings]
  :options  {
    :savings-in-personal "Expose demand/term savings deposit + close (with LendingRiskConsent) in Personal; keep borrow/bank-rates in Pro."
    :lending-pro-only    "Keep all Lending flows in Pro."
  }
  :current  'savings-in-personal
  :why      (from-code "ui/src/screens/Lending.tsx" "AGENTS.md includes savings in launch scope and Lending.tsx already implements LendingRiskConsent.")
  :sources  ["AGENTS.md" "ui/src/screens/Lending.tsx"])

(fork 'f4-emergency-exit-split
  :status   "open"
  :decider  "code"
  :question "How is Sovereignty.tsx split so Personal users never lose unilateral on-chain exit when watchtower admin moves to Pro?"
  :affects  ['personal/safety 'pro/watchtower 'unilateral-exit]
  :options  {
    :one-button-exit-in-personal "Personal keeps 1-step unilateral dispute/finalize exit (visible whenever secured > 0 or disputed); tower URLs and raw proofs live in Pro."
    :full-sovereignty-both       "Expose full Sovereignty.tsx screen in both surfaces."
  }
  :current  'one-button-exit-in-personal
  :why      (from-code "ui/src/screens/Sovereignty.tsx" "Dooring prepareDispute/disputeFinalize in Personal would strand Depository collateral if a hub stalls.")
  :sources  ["ui/src/screens/Sovereignty.tsx" "todo.md"])

(fork 'f5-first-hub-credit-default
  :status   "open"
  :decider  "person"
  :question "Should a newcomer's first hub Account start at 0 unbacked credit until explicit consent, or keep the instant-receive credit default?"
  :affects  ['personal/receive 'personal/home]
  :options  {
    :zero-until-consent "Start at 0 unbacked credit; prompt for explicit consent on first unbacked receive."
    :instant-default    "Pre-grant receive credit on onboarding with prominent disclosure on Home."
  }
  :current  'zero-until-consent
  :why      (guess "Silent unbacked credit surprises newcomers when they discover hub receivable is not collateralized.")
  :sources  ["ui/src/runtime/first-hub-account.test.ts" "docs/studies/ui/wallet-symptoms-claude-fable-5-2-2026-11-18.md"])

(fork 'f6-home-headline
  :status   "open"
  :decider  "person"
  :question "What headline figure should lead Personal Home (and/or the single capacity bar in todo.md)?"
  :affects  ['personal/home 'secured-receivable 'net-position]
  :options  {
    :secured-first       "Lead with Backed by collateral (TokenTotals.secured); show Without collateral separately below."
    :single-capacity-bar "Follow todo.md: one unified capacity/position bar encoding secured vs unbacked visually."
  }
  :current  'secured-first
  :why      (canon "todo.md" "Compares separate secured headline against todo.md's single capacity bar direction.")
  :sources  ["todo.md" "ui/src/screens/Home.tsx"])

(fork 'f7-dual-wallet-parity
  :status   "open"
  :decider  "maintainer"
  :question "How should emitted vocabulary and flow copy serve both active wallets (React ui/ and Svelte frontend/) required by AGENTS.md?"
  :affects  ['pro/multisig 'personal/home]
  :options  {
    :shared-ts-emit "Emit one framework-agnostic TypeScript vocabulary/flow module imported by both ui/src/ and frontend/src/lib/."
    :ui-only-pilot  "Pilot emitted vocabulary in ui/src/ first, then mirror to frontend/src/lib/ once copy stabilizes."
  }
  :current  'shared-ts-emit
  :why      (canon "AGENTS.md" "AGENTS.md (2026-11-09) requires functional parity across Svelte frontend/ and React ui/.")
  :sources  ["AGENTS.md" "todo.md"])

(fork 'f8-signing-sheet-dispatch
  :status    'closed
  :decider   'measurement
  :question  "Should Entity/Account signing use one all-warning sheet (p4), verb-routed risk-class sheets (p2 as drafted), or deriveDelta risk-transition sheets?"
  :affects   ['sheet-spend 'sheet-exposure 'sheet-treasury-admin]
  :options   {
    :single-all-warnings  "One universal sheet printing all risk warnings on every action (p4)."
    :verb-dispatched      "Five risk-class sheets selected by tx verb name (p2 draft)."
    :delta-risk-dispatched "Risk-class sheets selected by computed deriveDelta state transitions (exit > exposure > term > admin > secure > spend), with quiet spend finality."
  }
  :current   'delta-risk-dispatched
  :why       (sweep "docs/studies/ui/surfaces/probes/runs-signing/summary-frontier.json" "Across 63 blind subscription runs (Frontier + Fast), single all-warning sheets caused 5/7 false rejections on a 25 USDC coffee payment (C5), static claimable-collateral survival misled 2/3 Frontier models on outbound spend (C6), and verb-routed instant-swap fooled 2/3 skimmers on collateral-to-IOU swap bait (C3), whereas deriveDelta risk-class dispatch achieved 7/7 REJECT on C4 and 7/7 APPROVE on C7.")
  :sources   ["docs/studies/ui/surfaces/probes/report-signing.md" "docs/studies/ui/surfaces/rounds/r2-signing-critique.scm"]
  :closed-by "round2-signing-sweep-2026-11-19"
  :evidence  (sweep "docs/studies/ui/surfaces/probes/runs-signing/summary-frontier.json" "63 blind runs across grok-4.7, claude-flagship, gemini-pro, grok-4.6, grok-4.7-build-fast, claude-haiku, and gemini-flash-lite."))

(fork 'f9-monolith-vs-kernel-programs
  :status    'open
  :decider   'maintainer
  :question  "After landing the deriveDelta signing sheets and zero-credit onboarding inside both existing wallets (Phase A), should React and Svelte shrink to a 4-screen Kernel while moving Swap/Lending/OTC/Stewards to XLN Programs (Phase B)?"
  :affects   ['personal/home 'pro/desk 'app/instant-convert 'app/otc-room 'app/mppx-spend-steward]
  :options   {
    :phase-a-sheets-in-monolith "Keep 16 screens behind todo.md's on-by-default Pro toggle in both wallets, adding deriveDelta signing sheets and fixing AS-IS bugs."
    :phase-b-kernel-and-programs "Follow Phase A by shrinking dual-wallet parity scope to a minimal Kernel + postMessage/runner XLN Program bridge."
  }
  :current   'phase-a-sheets-in-monolith
  :why       (canon "todo.md" "Phase A captures 100% of the consent and safety wins at lowest dual-wallet parity cost; Phase B earns its keep once external deal rooms and steward runners ship.")
  :sources   ["todo.md" "AGENTS.md" "docs/studies/ui/surfaces/perspectives/p2-sovereign.scm" "docs/studies/ui/surfaces/perspectives/p4-steward-redteam.scm"])

(fork 'f10-everyday-autopilot-vs-bucket-bars
  :status   'open
  :decider  'maintainer
  :question "Should the regular-user wallet be a Venmo/Splitwise human surface ('everyday: one Cash number, Friends & tabs, inline actions, invisible autopilot, Pro off) rather than todo.md:82's channel-capacity bar + Pro-on-by-default?"
  :affects  ['everyday/home 'everyday/people 'everyday/auto-settle-incoming 'personal/home 'pro/desk]
  :options  {
    :everyday-venmo-splitwise "Lead with 'everyday (Cash + Friends & tabs + opt-in Savings; autopilot hides hub cover, bucket routing, and dispute recovery; zero bars; Pro off by default for regular users)."
    :capacity-bar-pro-on      "Follow todo.md:82 literally: one capacity bar and Pro toggle on by default in both wallets."
  }
  :current  'everyday-venmo-splitwise
  :why      (guess "Channel-capacity bars and manual Cover buttons project internal protocol accounting onto regular people; absorbing hub cover and bucket routing into deterministic autopilot makes XLN feel as effortless and reliable as Venmo + Splitwise while keeping Pro intact for OTC/hub operators.")
  :sources  ["todo.md" "docs/studies/ui/surfaces/everyday.scm" "docs/studies/ui/surfaces/AS-IS.md"])
