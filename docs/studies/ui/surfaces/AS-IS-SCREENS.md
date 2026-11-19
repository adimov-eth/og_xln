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
