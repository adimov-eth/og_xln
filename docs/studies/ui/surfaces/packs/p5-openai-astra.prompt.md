# Cold-Entry Prompt Pack: POV 5 — Protocol-Minimalist & Dual-Wallet Parity Architect

## Your Assignment
Design the minimum-footprint, maximum-invariant boundary between the dual wallets (React `ui/` + Svelte `frontend/`) and client XLN Programs (`xln-app`), optimizing for proportion over blind minimalism (`AGENTS.md`: Svelte + React parity, `<300` lines/file target, zero silent fallback, pure `deriveDelta` math):
- Author `(signing-sheet ...)` form(s) that protect user keys without training users into warning blindness, stating exact limitations where DSL v2 forces approximations.
- Encode `todo.md`'s single-capacity-bar + on-by-default `Pro` toggle baseline alongside your proposed Kernel + XLN Programs split (`embedded`, `external`, `steward`), showing honestly where the baseline beats your split and where your split earns its complexity.
- Ground every claim in `AS-IS.md`, `AS-IS-SCREENS.md`, and `ui/` / `frontend/` / `core/types/` source files, ensuring `unilateral-exit` is reachable in `'disputed` state.

- **Output file:** `docs/studies/ui/surfaces/perspectives/p5-openai-astra.scm` (start line 1 with `;; Author: openai/gpt-6.2-astra (p5-openai-astra)`, write the file, and run `bun docs/studies/ui/surfaces/check.ts --perspective docs/studies/ui/surfaces/perspectives/p5-openai-astra.scm` until it prints `VALID STRUCTURE` and exits 0).
- **Strict anti-priming rule:** Do NOT read any other file in `docs/studies/ui/surfaces/perspectives/`, `rounds/`, `probes/`, `personal.scm`, `pro.scm`, `programs.scm`, `forks.scm`, `CHAT.md`, or `design-*.md`. You MAY read `ui/`, `frontend/`, `core/`, `jurisdictions/`, `cli/`, `AGENTS.md`, and `todo.md`.

## Arrival Scheme UI DSL v2 Reference (Exact Syntax)

Allowed forms (do NOT redefine figures or verbs from `base.scm`; reference them by symbol like `'secured-receivable` or `'send-routed`):

```scheme
;; Provenance wrappers (REQUIRED on claims — bare strings are rejected!):
(guess "Proposed copy or design rationale")
(as-is "ui/src/components/home/BalanceDetails.tsx" "Without collateral") ; MUST exist verbatim in that exact file!
(from-code "ui/src/screens/Lending.tsx" "Summary grounded in cited file")
(canon "AGENTS.md" "Rule from AGENTS.md or todo.md")

;; Optional term with subtitle note:
(term-copy
  :label     (guess "On hub tab")
  :note      (guess "Owed by the hub; not locked on-chain.")
  :note-when 'non-zero) ; 'always | 'non-zero

;; 1. Universal Signing Sheet (MUST cover every verb used by your surface flows and non-hostile xln-apps!):
;; Allowed :shows symbols: 'delta-secured 'delta-unbacked-risk 'delta-credit-limit 'delta-owed 'fee-exact 'counterparty 'expiry-deadline 'program-origin
(signing-sheet 'my-signing-sheet
  :covers     ['send-routed 'send-direct 'request-cover 'extend-peer-tab 'unilateral-exit 'finalize-dispute]
  :shows      ['program-origin 'counterparty 'delta-secured 'delta-unbacked-risk 'delta-credit-limit 'fee-exact]
  :fee-before #t
  :survival   (guess "Plain sentence stating what survives on-chain if the counterparty disappears.")
  :warns      [(guess "Warning shown when extending unbacked credit.")]
  :why        (guess "Why this sheet is structured this way.")
  :sources    ["docs/studies/ui/surfaces/AS-IS.md"])

;; 2. Wallet Surface (MUST include at least one screen visible in 'disputed state with a flow invoking 'unilateral-exit!):
(surface 'my-wallet
  :who      (guess "Target user of this surface")
  :entry    'home
  :modes    ['always] ; optional: 'always | 'pro-only | 'personal-only
  :terms    {:secured (guess "Locked on-chain") :unbacked (term-copy :label (guess "Unbacked") :note (guess "Owed by counterparty"))}
  :defaults [(default-rule 'hub-credit :value "0 USDC" :risk-bearer 'user :consent (guess "Explicit prompt") :why (guess "Reason") :sources ["docs/studies/ui/surfaces/AS-IS.md"])]
  :screens  [
    (screen 'home
      :purpose   (guess "Under 45 words describing screen purpose.")
      :headline  'secured-receivable
      :figures   ['secured-receivable 'unbacked-exposure]
      :bars      ['secured-receivable 'unbacked-exposure] ; optional composite visual bar
      :actions   ['pay 'cover 'exit]
      :when      (lambda (s) (or (:disputed s) (>= (:secured s) 0))) ; optional predicate over {:secured :risk :owed :onchain :reserve :disputed :hubs}
      :max-words 45
      :why       (guess "Rationale")
      :sources   ["docs/studies/ui/surfaces/AS-IS.md"])
  ]
  :flows    [
    (flow 'pay   :verb 'send-routed     :before (guess "Pay")      :pending (guess "Sending...") :done (guess "Paid.")      :failed (guess "Unchanged."))
    (flow 'cover :verb 'request-cover   :before (guess "Lock it")  :pending (guess "Locking...") :done (guess "Locked.")    :failed (guess "Unchanged."))
    (flow 'exit  :verb 'unilateral-exit :before (guess "Withdraw") :pending (guess "Exiting...") :done (guess "Submitted.") :failed (guess "Safe to retry."))
  ]
  :doors    ['place-limit-order 'set-bank-rates]
  :why      (guess "Why this surface boundary holds.")
  :sources  ["docs/studies/ui/surfaces/BRIEF.md"])

;; 3. XLN Program (Client App proposing intents to the Wallet signing-sheet):
;; :kind is 'embedded | 'external | 'steward | 'hostile-test
;; :render is 'fixed | 'generative (NOTE: 'generative CANNOT request 'unilateral-exit, 'finalize-dispute, 'export-backup, or 'reset-testnet!)
(xln-app 'my-program
  :kind        'external
  :render      'fixed
  :audience    (guess "Who opens this Program")
  :reads       ['send-capacity 'secured-receivable]
  :requests    ['send-routed 'request-cover]
  :claim-shown (guess "What the Program UI tells the user it is doing")
  :why         (guess "Why this lives as a Program rather than a permanent Wallet tab")
  :sources     ["docs/studies/ui/surfaces/BRIEF.md"])

;; 4. End-to-End User Story (:given is 'empty | 'uncovered | 'partlyCovered | 'disputed; :steps are screen/flow IDs in :surface):
(story 'my-journey
  :surface 'my-wallet
  :given   'uncovered
  :steps   ['home 'cover]
  :outcome (guess "User state after completing steps")
  :why     (guess "Why this flow matters")
  :sources ["docs/studies/ui/surfaces/AS-IS.md"])
```

---
# Design Room Brief: XLN Wallet Kernel, Signing Sheet & XLN Programs (`2026-11-19`)

> **Cold-Entry Protocol (Anti-Priming):**
> 1. Read **only** this `BRIEF.md`, [`AS-IS.md`](./AS-IS.md), [`AS-IS-SCREENS.md`](./AS-IS-SCREENS.md), and [`base.scm`](./base.scm) (plus any linked source files in `ui/src/` or `frontend/src/`).
> 2. **Do NOT read** other files in `perspectives/`, `rounds/`, `personal.scm`, `pro.scm`, or `forks.scm` until after your own Round 1 perspective file (`perspectives/<pov>.scm`) is written and passes `bun docs/studies/ui/surfaces/check.ts --perspective perspectives/<pov>.scm`.
> 3. Use `(guess "...")` honestly for every proposed screen, flow, signing rule, or XLN Program; use `(as-is "exact/repo/path" "verbatim string")` **only** when quoting verbatim UI text from that exact file. Never use forbidden glossary words (`channel`, `wave`, `round`, `receipt`, `delivery sequence`) in user-facing copy.

---

## 1. The Architectural Problem

XLN (`8f8a4a6a` / `origin/main` `bdc53c7b`) ships a deterministic bilateral state machine (`Jurisdictions` -> `Entities` -> `Accounts`, `deriveDelta` over on-chain collateral + bilateral unsecured `creditLimit`s + programmable clauses, across EVM and native TRON) and maintains **two active wallets in functional parity**: React (`ui/`) and Svelte (`frontend/`).

Today, `ui/` crams **16 screens** (`~5,600` lines of TSX) into one shell with:
- **Four storage buckets on `Home`** (`Backed by collateral`, `Without collateral`, `Blockchain wallet`, `Contract reserve`),
- **Silent `10,000.00 USDC` first-hub unsecured credit** on onboarding (contradicting `LendingRiskConsent.tsx`'s comment that *"opening an Account never authorizes unsecured risk"*),
- **Zero shared signing/consent boundary** (`RuntimeCommandGate.tsx` only checks sync readiness; every screen dispatches `EntityTx`s directly), and
- **Four different audiences** (everyday payer/saver, OTC/market-maker trader, hub operator, multi-signer board) competing for the same screens.

Meanwhile, [`todo.md`](../../../../todo.md) proposes:
> `- One capacity bar and a Pro toggle (on by default) in both wallets.`
> `- Owner: 10 conversations with OTC/MM/payout firms -> at least 2 written intents.`

## 2. Core Questions Every Round-1 Perspective Must Answer in Arrival Scheme (`.scm`)

1. **Where does the Base Wallet Kernel end and an XLN Program (`xln-app`) begin?**
   - What belongs permanently inside the deterministic Base Wallet (keys, exposure truth, universal `signing-sheet`, unilateral exit, core flows)?
   - What works better as **XLN Programs** (embedded, external link/checkout, `Pro` workspace apps, generative deal/tab builders, or delegated AI stewards) that construct intents and ask the Wallet Kernel's `signing-sheet` to sign?
2. **User Stories First:**
   - Express your concrete end-to-end user stories (`(story ...)`) across realistic states (`empty`, `uncovered`, `partlyCovered`, `disputed`), showing exact screen/flow steps and what happens when a counterparty stalls or charges a fee.
3. **The Universal Signing Sheet (`(signing-sheet ...)`):**
   - What exact deltas (`delta-secured`, `delta-unbacked-risk`, `delta-credit-limit`, `fee-exact`, `counterparty`, `program-origin`), fee disclosures, and plain-English survival rules must the Wallet Kernel show so neither a naive user nor a hostile `xln-app` can confuse an unbacked IOU or `10,000 USDC` credit grant with collateralized cash?
4. **Honest Comparison With the Single-Bar + Pro-Toggle Baseline:**
   - Where does `todo.md`'s single capacity bar + on-by-default `Pro` toggle win on simplicity and React+Svelte parity cost, and where (if anywhere) does your proposed architecture beat it enough to justify changing course?

---
# As-is: Home and cover in both wallets

- **Author:** claude-fable-5-2 · Claude Code · `2026-11-19`
- **Tree:** `8f8a4a6a` (`origin/main` `bdc53c7b` plus three docs commits), local dev stack, chain 31337
- **Scope:** the first screen with 100 test USDC uncovered, and the cover flow. Nothing else.
- **Marks:** **[live]** seen on screen on 19 November · **[18th]** seen on 18 November, not re-checked · **[src]** read in source, not seen

Text in quotes is verbatim.

## React `ui/` at `/ui/`

### Home, 100 USDC uncovered [live]

In order, at 603 px wide:

1. Banner: "Jurisdiction · Testnet", "Chain 31337", "Tutorial · all features", "Contract stack"
2. Faucet strip: "TESTNET FAUCET · For trying payments · no real value", "Get 100 test USDC"
3. "Balance · Balance" **$100.00**
4. "Payment capacity: $100.00 · includes available credit"
5. Buttons: "Pay", "Receive", "Swap", "Add", "Move"
6. "How your money is held", starting 654 px down the page:
   - "Backed by collateral" $0.00
   - "Without collateral" $100.00, and under it "Repayment depends on the other party."
   - "Blockchain wallet" $0.00
   - "Contract reserve" $0.00
   - "Fixed reference prices, not live market value."
7. "Credit limits · Not a balance": "You extend $10,000.00", "Extended to you $0.00", "Credit does not guarantee repayment."
8. Assets → USDC → H1: "Collateral-backed", "At risk", "Can send now", "Can receive now 10,000.00 USDC", "View account and adjust limits →"

Facts the spec and the custdev run got wrong about this screen:

- **Each row's note is hidden while its amount is zero.** With 100 uncovered, only the "Without collateral" note shows. The "Covered by funds locked on-chain." note appears once something is covered. [live, and `BalanceDetails.tsx:57`]
- **Home has no cover action.** "Cover it" is on the account screen. [live, and the only hit is `AccountDetail.tsx:215`]
- **Home always shows the total.** There is no arm of the shipped Home without "Balance".
- **"You owe" is not a row.** It appears as a sentence only when something is owed. [src `BalanceDetails.tsx:70`]

### Cover [live]

1. Home → "View account and adjust limits →" → account screen.
2. Under "What is at stake": "At risk · they owe you $100.00" with a small "Cover it" beside the figure.
3. Sheet "Manage · H1", Collateral tab: "Ask H1 to lock collateral on-chain against what they owe you. They charge their published fee, taken from the amount; the rest becomes enforceable collateral."
4. "Gross amount" is empty. "Cover the promise" fills 100. Note: "H1 owes you 100.00 USDC that no collateral stands behind."
5. "Their fee 0.10 + 0.01%". After an amount: "Fee on this request 0.11", "Collateral you get 99.89".
6. "Request collateral" → toast "Collateral request sent to H1"; the sheet closes.
7. About seven seconds later the account screen reads "At risk · they owe you $0.00", "Their debt covered by collateral $99.89", "Collateral you posted $99.89".

So the fee is stated before the action, and there is a confirmation. No sentence after it says what covered money is good for. "Collateral you posted" is shown for collateral the hub locked.

### Entry [live]

"Continue" on the wallet saved before the stack restart fails with `RESTORE_JADAPTERS_FAILED` (`RPC_ENTITY_PROVIDER_DEPLOYMENT_RECEIPT_MISSING` in the console). The local chain was redeployed, so this may be expected on a dev stack. A fresh test wallet opens normally.

## Svelte `frontend/` at `/app`

### First screen [18th]

"No accounts established", with H1, H2 and H3 each offering "Connect" and "DETAILS".

### Accounts, 100 USDC uncovered [live]

1. The same banner as React.
2. Entity name and full 64-character ID.
3. **$100.00** "TOTAL BALANCE"
4. "AVAILABLE TO PAY: $100.00 · INCLUDES CREDIT"
5. "Balance explained", collapsed. Expanded, one paragraph: "…a 50 USDC credit limit does not make you 50 USDC richer…"
6. Account card "H1 (Testnet)", "#3", "0%"; per token a bar, the amount, and "← Receivable 9,900".
7. Ten tabs under the card: Open Account, Pay, Receive, Swap, Move, Lending, History, Manage, Activity, Appearance; then "How this works".

There are no words for backed or unbacked on this screen. The split is the "0%" and the bar. "Without collateral" does not appear anywhere in `frontend/src`.

### Cover [live]

1. Manage → "Request Collateral" (one of six sub-tabs: Extend Credit, Request Credit, Request Collateral, Add Token, Load Testing, Dispute).
2. Amount is prefilled at the maximum. "Suggested gross max: 100 USDC".
3. "Gross 100 USDC − exact fee 0.11 USDC = net collateral 99.89 USDC USDC" (the unit is printed twice).
4. "Request Collateral". Six seconds later: total "$99.89", card "100%", "Receivable 10,000", "Suggested gross max: 0 USDC".

I did not see a confirmation message. I looked six seconds after the press, not in the first second, so a short toast is not ruled out.

### The credit figure, reconciled [src]

With 100 owed to me the card says "Receivable 9,900", and after cover "Receivable 10,000". The Manage panel says "Current signed limit you extend: 0 USDC" throughout. React shows "You extend $10,000.00" for the same hub.

The Svelte form reads the wrong field. `CreditForm.svelte:40` shows `ownCreditLimit` in extend mode. In `core/account/utils.ts:30-38` `ownCreditLimit` bounds my own debt (`outOwnCredit = ownCreditLimit - inOwnCredit`), so it is the credit extended to me, which is 0. The credit I extend is `peerCreditLimit`, which is what React's "You extend" reads (`CreditDetails.tsx:18`) and what the card's "Receivable" reflects. Request mode has the same swap.

Read in source and consistent with the live figures. I have not run a test for it. Two scenario comments (`core/scenarios/consensus/ahb.ts:720`, `core/scenarios/payments/lock-ahb.ts:508`) say the opposite of the derivation: "leftCreditLimit = credit extended by LEFT to RIGHT".

### "Collateral you posted", confirmed [src]

`AccountDetail.tsx:226` sums `derived.collateral`, the account's whole collateral, whoever locked it. The label is wrong whenever the hub locked it, as here.

## Not covered

- Svelte: payment, swap, lending, dispute. Read on the 18th, never executed.
- React: pay and swap were executed on the 18th at `00c9bc5`, not on this tree.
- Phone width today. The 603 px width is the pane's.
- Anything a person did.

---
# As-Is Companion: Remaining Screens, Consent Surfaces & Svelte Tabs (`8f8a4a6a` / `bdc53c7b`)

- **Companion to:** [`AS-IS.md`](./AS-IS.md) (`Home` and `Cover` `[live]` walk by `claude-fable-5-2` — read both together).
- **Tree:** `8f8a4a6a` (`origin/main` `bdc53c7b` + 3 `docs(gtm)` commits).
- **Marks:** **[src]** read directly from source at `8f8a4a6a` (verbatim strings in quotes).

---

## 1. Consent & Readiness Surfaces Today (`ui/src/components/`)

- **[`RuntimeCommandGate.tsx`](../../../../ui/src/components/RuntimeCommandGate.tsx) (`61L`) [src]:**
  Readiness/sync status banner only (`"Wallet is syncing (j-catchup). Payments open when sync completes."` in [`commands.ts:24`](../../../../ui/src/runtime/commands.ts#L24)). **Not** a user consent or transaction-signing sheet.
- **[`LendingRiskConsent.tsx`](../../../../ui/src/components/LendingRiskConsent.tsx) (`39L`) [src]:**
  The **only** explicit risk-authorization card in `ui/src/` today (`data-testid="lending-risk-consent"`):
  - Comment at `L7`: `"The saver authorizes a maximum exposure; opening an Account never does."` (Contradicts first-hub onboarding, which pre-grants `10,000.00 USDC` on `H1`; see [`AS-IS.md`](./AS-IS.md) `L27`).
  - Copy (`L32-35`): `"Your current maximum unsecured risk with this bank is <X>."` / `"Including this deposit's interest requires <Y>. This limit covers all obligations on this Account. Only collateral secures recovery."` / Button: `"Set maximum risk to <Y>"` (`extendCredit`).
- **No universal signing sheet exists:** `Pay`, `Swap`, `Move`, `Manage`, `Lending`, and `Ownership` each call `sendEntityTxs` / `submitRuntimeCommand` directly from their own form button without a shared Wallet Kernel confirmation boundary.

---

## 2. Navigation Shell (`ui/src/components/Shell.tsx`) [src]

- Bottom/side `NAV` has 4 destinations (`L25-49`): `"Home"` (`/`), `"Activity"` (`/activity`), `"Manage"` (`/manage`, matching `/assets`, `/lend`, `/ownership`, `/sovereignty`, `/desk`), `"Settings"` (`/settings`).
- `FLOW_ROUTES` (`L52`): `/pay`, `/receive`, `/swap`, `/move` hide the tab bar and push over `Home` with a back button.

---

## 3. Remaining 14 React Screens (`ui/src/screens/*.tsx`) [src]

1. **`Gate.tsx` (`711L`):** Entry, BrainVault passphrase/seed unlock, passkey/device unlock, and hub discovery (`"Connect"`). Fails with `RESTORE_JADAPTERS_FAILED` on saved wallet after dev-chain redeploy (`todo.md` queues React parity with Svelte's keys-preserving testnet state reset).
2. **`Pay.tsx` (`636L`):** Recipient picker (`data-testid="pay-to"`), QR invoice scanner (`"Scan invoice"`, `"That QR is not an xln invoice"`), amount input, `"Delivery"` mode selector (`instant` / `async` / direct), `"Route"` cards (`data-testid="pay-quote"`), optional note (`"What is this for?"`), primary submit (`data-testid="pay-submit"`), toast `"Payment submitted: <amount> <symbol> to <name>"`.
3. **`Receive.tsx` (`187L`):** `"Receive"`, `"Share"` QR + URL + plain-text request (`"The code and the amount on paper, or as a PDF to attach to an invoice"`, `"The same request as plain text, for a wallet that has no browser"`, `"Opens the installed xln app directly"`, `"Entity ID"`).
4. **`Swap.tsx` (`1,111L`):** Combines simple conversion, `"Book"` resting orderbook (`Orderbook.tsx`), `"Cross-network orders"` (`Legs`, `prepareCrossJurisdictionSwap`, `requestCrossJurisdictionClear`), `"Receiving fees"`, and `"Your open orders"` (`proposeCancelSwap`) on one `1,111`-line screen.
5. **`Move.tsx` (`414L`):** Explicit placement transfers across `"Blockchain wallet"`, `"Contract reserve"`, and `"Account"` (`r2c`, `r2r`, `r2e`, ERC-20 approve `"Depository may now pull <X>"`, batch draft `"Added to the on-chain batch"` vs immediate `"Sent on-chain · <hash>"`, `"Settlement proposed to the counterparty"`, section `"What happens"`).
6. **`Lending.tsx` (`331L`):** Side toggle (`lend` / `borrow`), term picker (`demand` / fixed terms), `LendingRiskConsent`, `ReceiveCapacity` prompt when `principal > inCapacity` (`L69`), `"Your offers"`, `"Your loans"`, `LendingRepay`, `LendingClose`, plus embedded hub-operator `BankLendingPolicy` (`lendingSetTerms`).
7. **`Manage.tsx` (`174L`) & `AccountDetail.tsx` (`269L`):** `"Where your money stands"`, `"Needs attention"`, `"Accounts"` list; `AccountDetail` holds `"What is at stake"`, `"Cover it"` (`L215`), `"Extend credit"` (`extendCredit`), rebalance policy, and `"Take the last page you both signed to the chain. You never need the other side"`.
8. **`Desk.tsx` (`292L`):** Operator multi-counterparty table (`data-testid="desk-table"`), `"Frames both sides signed"`, `desk-net`, `desk-revenue`, quick-jump buttons (`Pay`, `Swap`, `Move`, faucet, `Security and recovery`), `"Recent"`.
9. **`Assets.tsx` (`417L`):** Per-token / per-jurisdiction catalog, `"On-chain wallet"`, `"Debts"`, `"Test network funds"` faucets.
10. **`Activity.tsx` (`213L`):** `"Every movement shown here, with frame height and hash, for your books"`, filterable movement rows + printable detail view.
11. **`Sovereignty.tsx` (`266L`):** `"Security and recovery"`, `"Keys"`, `"Ledger"` (`"This page as a printed report or PDF, for a board or an auditor"`, encrypted backup `"Encrypted backup saved"`), `"Per counterparty"` dispute status and unilateral exit triggers.
12. **`Ownership.tsx` (`248L`):** `"Board"` (`Hanko` signers & threshold proposals), **plus** `"Shares"` (`"Share issuance submitted to the board"`) and `"Take control of another entity"`—even though `AGENTS.md` scopes `Companies/IPO` outside this launch.
13. **`Settings.tsx` (`120L`):** `"Settings"`, `"Runtime"`, `"Inspect connection"`, network/RPC controls.
14. **`CustomContracts.tsx` (`68L`):** `"Contract source preview"` (read-only preview; opaque custom-contract admission is unavailable per `AGENTS.md`).

---

## 4. Svelte Wallet (`frontend/src/`) Summary [src + AS-IS.md]

- Single-page 10-tab layout under the active Entity/Account card (`Open Account`, `Pay`, `Receive`, `Swap`, `Move`, `Lending`, `History`, `Manage`, `Activity`, `Appearance`), with `Manage` holding 6 sub-tabs (`Extend Credit`, `Request Credit`, `Request Collateral`, `Add Token`, `Load Testing`, `Dispute`).
- Implements the keys-preserving retired-testnet state reset (`167d66b8b`), which React has not yet ported (`todo.md`).

---
## Canonical `base.scm` (Already Loaded in Scope — Reference These Exact Figure & Verb IDs)
```scheme
;; base.scm — Shared xln runtime projections, verbs, and 16-screen disposition map (DSL v2).
;; Grounded against origin/main (bdc53c7b -> 8f8a4a6a): shared by React (ui/) and Svelte (frontend/).

;; ── 1. Canonical Figures (each :source resolves to AST; :term links to surface :terms) ───────────
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
(verb 'export-backup     :layer 'local   :tx "localExportBackup"            :summary (from-code "ui/src/runtime/recovery.ts" "Export encrypted recovery state and tower coverage bundle."))
(verb 'reset-testnet     :layer 'local   :tx "localResetRetiredTestnet"     :summary (from-code "todo.md" "Reset retired testnet state while keeping user keys."))

;; ── 3. Exhaustive 16-Screen Disposition Map (checked against ui/src/screens/*.tsx on disk) ────────
(legacy-screen "Gate.tsx"            :disposition 'shared-shell :into ['personal/home 'pro/desk]       :why (from-code "ui/src/screens/Gate.tsx" "Onboarding and key unlock precede surface entry.") :sources ["ui/src/screens/Gate.tsx"])
(legacy-screen "Home.tsx"            :disposition 'split        :into ['personal/home 'pro/desk]       :why (guess "Separate retail balance overview from dense multi-account exposure.") :sources ["ui/src/screens/Home.tsx" "fork:f0-toggle-vs-surfaces"])
(legacy-screen "Pay.tsx"             :disposition 'keep         :into ['personal/pay 'pro/desk]        :why (from-code "ui/src/screens/Pay.tsx" "Core launch payment flow.") :sources ["ui/src/screens/Pay.tsx"])
(legacy-screen "Receive.tsx"         :disposition 'keep         :into ['personal/receive 'pro/desk]    :why (from-code "ui/src/screens/Receive.tsx" "Core launch receive flow.") :sources ["ui/src/screens/Receive.tsx"])
(legacy-screen "Swap.tsx"            :disposition 'split        :into ['personal/convert 'pro/book 'pro/cross-swap] :why (guess "Split 2-field instant conversion from resting orderbook and cross-J legs.") :sources ["ui/src/screens/Swap.tsx"])
(legacy-screen "Lending.tsx"         :disposition 'split        :into ['personal/savings 'pro/lending] :why (canon "AGENTS.md" "Lending includes both retail savings and hub/operator bank rate facilities.") :sources ["ui/src/screens/Lending.tsx" "fork:f3-savings-in-personal"])
(legacy-screen "Activity.tsx"        :disposition 'keep         :into ['personal/activity 'pro/desk]   :why (from-code "ui/src/screens/Activity.tsx" "Historical movement log.") :sources ["ui/src/screens/Activity.tsx"])
(legacy-screen "Settings.tsx"        :disposition 'keep         :into ['personal/settings 'pro/watchtower] :why (from-code "ui/src/screens/Settings.tsx" "Backup, network, and retired-testnet key-preserving reset.") :sources ["ui/src/screens/Settings.tsx" "todo.md"])
(legacy-screen "Sovereignty.tsx"     :disposition 'split        :into ['personal/safety 'pro/watchtower] :why (from-code "ui/src/screens/Sovereignty.tsx" "Personal keeps 1-step unilateral dispute exit; Pro holds tower ops and proof details.") :sources ["ui/src/screens/Sovereignty.tsx" "fork:f4-emergency-exit-split"])
(legacy-screen "Desk.tsx"            :disposition 'move         :into ['pro/desk]                      :why (from-code "ui/src/screens/Desk.tsx" "Dense multi-lane operator matrix.") :sources ["ui/src/screens/Desk.tsx"])
(legacy-screen "Move.tsx"            :disposition 'move         :into ['pro/move]                      :why (from-code "ui/src/screens/Move.tsx" "Explicit r2c/r2r/r2e contract reserve plumbing.") :sources ["ui/src/screens/Move.tsx"])
(legacy-screen "Manage.tsx"          :disposition 'move         :into ['pro/credit-lanes]              :why (from-code "ui/src/screens/Manage.tsx" "Hub credit limits, rebalance policies, and bilateral administration.") :sources ["ui/src/screens/Manage.tsx"])
(legacy-screen "AccountDetail.tsx"   :disposition 'split        :into ['personal/home 'pro/credit-lanes] :why (guess "Surface cover action directly on Personal Home while keeping frame/policy inspector in Pro.") :sources ["ui/src/screens/AccountDetail.tsx"])
(legacy-screen "Assets.tsx"          :disposition 'move         :into ['pro/assets]                    :why (from-code "ui/src/screens/Assets.tsx" "Per-jurisdiction token catalog and PlaceRow breakdown.") :sources ["ui/src/screens/Assets.tsx"])
(legacy-screen "Ownership.tsx"       :disposition 'move         :into ['pro/multisig]                  :why (canon "AGENTS.md" "Multi-signer Hanko security remains; Companies/IPO share trading is outside launch scope.") :sources ["ui/src/screens/Ownership.tsx" "AGENTS.md"])
(legacy-screen "CustomContracts.tsx" :disposition 'unavailable  :into []                               :why (canon "AGENTS.md" "Opaque custom-contract admission remains unavailable under canonical testnet policy.") :sources ["ui/src/screens/CustomContracts.tsx" "AGENTS.md"])
```
