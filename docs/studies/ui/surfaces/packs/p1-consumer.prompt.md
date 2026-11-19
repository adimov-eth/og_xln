# Cold-Entry Prompt Pack: POV 1 — Zero-Plumbing Consumer Radical (Apple Pay + Splitwise)

## Your Assignment
Optimize ruthlessly for everyday non-operator people and households.
- Hide XLN internal storage buckets (EOA, Contract Reserve, Collateral, Unbacked Credit) from routine daily screens.
- Make the Base Wallet tiny (entry screen, activity, safety/unilateral-exit, and one rock-solid `(signing-sheet ...)`).
- Model everyday workflows—Pay/Request Link, Household/Friend Tab (`Splitwise`), Merchant Checkout, Instant Convert, and Simple Savings—as clean user stories and `(xln-app ...)` Programs (using `:render 'generative` only where ephemeral calculators/splits genuinely beat fixed UI).
- Show honestly when and how counterparty risk consent surfaces without turning Screen 1 into an accounting ledger.

- **Output file:** `docs/studies/ui/surfaces/perspectives/p1-consumer.scm` (return ONLY valid Arrival Scheme code for this file, or write it directly if you have repo access and run `bun docs/studies/ui/surfaces/check.ts --perspective docs/studies/ui/surfaces/perspectives/p1-consumer.scm` until green).
- **Anti-priming rule:** Do NOT read other files in `perspectives/`, `rounds/`, `personal.scm`, `pro.scm`, or `forks.scm`.

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
# Design Room Brief: Human Everyday Wallet (Venmo + Splitwise), Autopilot & XLN Programs (`2026-11-19`)

## 1. Primary Product North Star (Regular People First)

For a regular person, XLN must feel **as effortless, calm, and reliable as Venmo + Splitwise** — **not** an inspection panel for bilateral accounting:

1. **One `Cash` balance (`Venmo`), separate `Friends & tabs` (`Splitwise`), opt-in `Savings`:**
   - Regular people never stare at 4 storage buckets (`Backed by collateral`, `Without collateral`, `Blockchain wallet`, `Contract reserve`), `[---===|---]` capacity bars, or manual `[Cover it]` buttons.
   - Everyone naturally understands **"Cash: \$200"** vs **"Alex owes you \$40"** in Splitwise without a single word of crypto or finance legalese.
2. **Reliability Through Invisible `(autopilot ...)`, Not Warning Lectures:**
   - Opening the app grants **\$0** silent hub credit.
   - Incoming hub transit float is **automatically settled into protected on-chain Cash** in the background under a tiny built-in fee cap (`auto-settle-incoming`).
   - Bucket routing (`e2r`/`r2c`/`r2e`) and stalled-provider recovery (`prepareDispute`/`disputeFinalize` + encrypted backup) run **automatically under the hood** (`auto-route-funds`, `auto-recovery-shield`), surfacing calm status only if needed.
3. **Zero MetaMask Popup Theater on First-Party Actions:**
   - Tapping `Pay` or `Split a bill` inside the wallet uses `:delivery 'inline-quiet` (showing recipient and fee inline on the button, zero second confirmation modal).
   - Interrupt confirmation sheets (`:delivery 'interrupt-sheet`) appear **only** when crossing an external app/link boundary or explicitly taking on operator/credit risk.
4. **Operator / OTC / Steward Tools Stay Out of Everyday Sight:**
   - Dense multi-account lane tables (`Desk`), orderbooks, manual reserve pipes (`Move`), hub rate cards, and Hanko boards live in the **`Pro` operator surface** (`pro.scm`) and **XLN Programs** (`programs.scm`), **off by default** for regular users.

---

## 2. Mechanical Compiler Laws (`dsl.ts` + `check.ts`, DSL v3)

- `:posture 'human-everyday` (`everyday.scm`) is mechanically checked by `check.ts`:
  - **Bans `:bars`** on every everyday screen.
  - **Bans plumbing/protocol jargon** (`collateral`, `unbacked`, `counterparty`, `credit limit`, `credit ceiling`, `reserve`, `depository`, `htlc`, `hanko`, `co-signed`, `frame`, `lane`, `watchtower`) in all user-facing copy.
  - **Bans manual plumbing buttons** (`request-cover`, `rebalance-policy`, `move-r2c`, `set-hub-credit`, etc.), requiring them to be absorbed by `(autopilot ...)` or doored to `pro`.
- Historical Round-0/Round-1 bucketed baselines (`personal.scm`, `perspectives/p1..p5.scm`) remain preserved under `:posture 'legacy-bucket-baseline` so earlier empirical sweeps (`custdev-r1`, `probes/report-signing.md`) remain reproducible.

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
;; base.scm — Shared xln runtime projections, verbs, and 16-screen disposition map (DSL v3).
;; Grounded against origin/main (bdc53c7b -> 8f8a4a6a): shared by React (ui/) and Svelte (frontend/).

;; ── 1. Canonical Figures (each :source resolves to AST; :term links to surface :terms) ───────────
(figure 'everyday-cash
  :term    'cash
  :meaning (from-code "ui/src/runtime/views.ts" "Unified spendable cash after background autopilot settles incoming float and hides storage buckets.")
  :source  "TokenTotals.secured")

(figure 'friends-tabs
  :term    'people
  :meaning (from-code "ui/src/runtime/views.ts" "Splitwise-style per-person balances ('Alex owes you' / 'You owe Sam'), kept separate from Cash.")
  :source  "WalletView.accounts")

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
(verb 'export-backup     :layer 'local   :tx "localExportBackup"            :summary (from-code "ui/src/runtime/recovery.ts" "Export encrypted recovery state and tower coverage bundle."))
(verb 'reset-testnet     :layer 'local   :tx "localResetRetiredTestnet"     :summary (from-code "todo.md" "Reset retired testnet state while keeping user keys."))

;; ── 3. Exhaustive 16-Screen Disposition Map (checked against ui/src/screens/*.tsx on disk) ────────
(legacy-screen "Gate.tsx"            :disposition 'shared-shell :into ['everyday/home 'personal/home 'pro/desk]       :why (from-code "ui/src/screens/Gate.tsx" "Onboarding and key unlock precede surface entry.") :sources ["ui/src/screens/Gate.tsx"])
(legacy-screen "Home.tsx"            :disposition 'split        :into ['everyday/home 'personal/home 'pro/desk]       :why (guess "Everyday shows one calm Cash number (Venmo); Pro shows dense multi-account desk.") :sources ["ui/src/screens/Home.tsx" "fork:f10-everyday-autopilot-vs-bucket-bars"])
(legacy-screen "Pay.tsx"             :disposition 'keep         :into ['everyday/home 'personal/pay 'pro/desk]        :why (from-code "ui/src/screens/Pay.tsx" "One-tap inline Pay on Everyday; operator route controls in Pro.") :sources ["ui/src/screens/Pay.tsx"])
(legacy-screen "Receive.tsx"         :disposition 'keep         :into ['everyday/home 'personal/receive 'pro/desk]    :why (from-code "ui/src/screens/Receive.tsx" "Request link / QR on Everyday; inbound capacity planning in Pro.") :sources ["ui/src/screens/Receive.tsx"])
(legacy-screen "Swap.tsx"            :disposition 'split        :into ['everyday/home 'personal/convert 'pro/book 'pro/cross-swap] :why (guess "Automatic currency conversion behind Pay on Everyday; resting book and cross-J legs in Pro.") :sources ["ui/src/screens/Swap.tsx"])
(legacy-screen "Lending.tsx"         :disposition 'split        :into ['everyday/earn 'personal/savings 'pro/lending] :why (canon "AGENTS.md" "Simple opt-in Savings on Everyday; hub bank/facility desk in Pro.") :sources ["ui/src/screens/Lending.tsx" "fork:f3-savings-in-personal"])
(legacy-screen "Activity.tsx"        :disposition 'keep         :into ['everyday/activity 'personal/activity 'pro/desk] :why (from-code "ui/src/screens/Activity.tsx" "Plain human payment and split feed.") :sources ["ui/src/screens/Activity.tsx"])
(legacy-screen "Settings.tsx"        :disposition 'keep         :into ['everyday/activity 'personal/settings 'pro/watchtower] :why (from-code "ui/src/screens/Settings.tsx" "Account settings and key-preserving testnet reset.") :sources ["ui/src/screens/Settings.tsx" "todo.md"])
(legacy-screen "Sovereignty.tsx"     :disposition 'split        :into ['everyday/activity 'personal/safety 'pro/watchtower] :why (from-code "ui/src/screens/Sovereignty.tsx" "Automatic background recovery on Everyday; manual tower/proof admin in Pro.") :sources ["ui/src/screens/Sovereignty.tsx" "fork:f10-everyday-autopilot-vs-bucket-bars"])
(legacy-screen "Desk.tsx"            :disposition 'move         :into ['pro/desk]                      :why (from-code "ui/src/screens/Desk.tsx" "Dense multi-lane operator matrix, hidden from regular users.") :sources ["ui/src/screens/Desk.tsx"])
(legacy-screen "Move.tsx"            :disposition 'move         :into ['pro/move]                      :why (from-code "ui/src/screens/Move.tsx" "Explicit r2c/r2r/r2e plumbing replaced by Cash out + autopilot on Everyday.") :sources ["ui/src/screens/Move.tsx"])
(legacy-screen "Manage.tsx"          :disposition 'move         :into ['everyday/people 'pro/credit-lanes] :why (from-code "ui/src/screens/Manage.tsx" "Human Splitwise friend tabs on Everyday; hub credit/rebalance knobs in Pro.") :sources ["ui/src/screens/Manage.tsx"])
(legacy-screen "AccountDetail.tsx"   :disposition 'split        :into ['everyday/people 'personal/home 'pro/credit-lanes] :why (guess "Friend tab history on Everyday; autopilot replaces manual Cover it button.") :sources ["ui/src/screens/AccountDetail.tsx"])
(legacy-screen "Assets.tsx"          :disposition 'move         :into ['pro/assets]                    :why (from-code "ui/src/screens/Assets.tsx" "Per-jurisdiction token catalog and PlaceRow breakdown.") :sources ["ui/src/screens/Assets.tsx"])
(legacy-screen "Ownership.tsx"       :disposition 'move         :into ['pro/multisig]                  :why (canon "AGENTS.md" "Multi-signer Hanko security remains; Companies/IPO share trading is outside launch scope.") :sources ["ui/src/screens/Ownership.tsx" "AGENTS.md"])
(legacy-screen "CustomContracts.tsx" :disposition 'unavailable  :into []                               :why (canon "AGENTS.md" "Opaque custom-contract admission remains unavailable under canonical testnet policy.") :sources ["ui/src/screens/CustomContracts.tsx" "AGENTS.md"])
```
