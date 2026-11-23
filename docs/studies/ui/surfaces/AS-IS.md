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
