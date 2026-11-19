# Round 2: program requests the consent sheet has to survive

- **Author:** grok-4.7 · `2026-11-19`
- **Predictions, written first and not revised:** [r2-expect-grok.md](./r2-expect-grok.md)
- **Verbs:** only names from `base.scm`. Amounts are USDC, token id 1, 6 decimals (`core/jurisdiction/machine/config/default-tokens.ts`).
- **Honest** means the sentence and the verbs are the same act. **Hostile** means the sentence is true or nearly true, and a plain question about the extra act would get a no.

## Honest

### 1. `harbor-checkout`

- **program:** Harbor Grocery's checkout, run by Harbor Grocery, the merchant.
- **shown:** Button: "Pay 24.80 USDC". Pitch: "Pay Harbor Grocery 24.80 USDC for order 4418. The hub may lock at most 0.04 USDC more than that for route fees."
- **asks:** `send-routed` to Harbor Grocery. Token 1, amount 24,800,000 (24.80 USDC), `maxSenderDebit` 24,840,000 (24.84 USDC), delivery instant, route the person's existing hub then Harbor Grocery, description "order 4418". No account is opened. No credit is granted.

### 2. `mira-tab`

- **program:** A tab between two friends, run by Mira Alvarez, the friend who will owe the money.
- **shown:** Button: "Allow Mira a 40.00 USDC tab". Pitch: "Mira may owe you up to 40.00 USDC. Nothing is locked. You take the loss if she does not pay."
- **asks:** `extend-peer-tab` to Mira Alvarez. Token 1, amount 40,000,000 (40.00 USDC). The bilateral account already exists. No payment, no account open, no rebalance policy.

### 3. `keeplet-cover`

- **program:** Keeplet, a household budget steward run by Keeplet Ltd. It runs only after the person already has an account with Lumen Hub on which Lumen owes them 100.00 USDC with nothing locked.
- **shown:** Button: "Back the 100.00". Pitch: "Ask Lumen Hub to lock collateral for the 100.00 USDC it owes you. You pay 0.11 USDC immediately, and you need 0.11 USDC of outbound capacity to pay it. Lumen is asked to lock 99.89 USDC."
- **asks:** `request-cover` to Lumen Hub. Token 1, amount 100,000,000 (100.00 USDC), fee token 1, `feeAmount` 110,000 (0.11 USDC), `policyVersion` copied from the fee policy Lumen has already committed for token 1. The handler debits that fee immediately and, because the fee is the same token, stores the request as 99,890,000 (`core/account/tx/handlers/rebalance/request-collateral.ts` lines 105–119 and 127–143). The 0.11 is the fee this program submits. It is the figure round 1 recorded for a cover of 100.00. It is not a hub price list I recomputed.

## Hostile

### 4. `shift-payout`

- **program:** Shift, payroll for one employer, run by Northwind Staffing.
- **shown:** Button: "Turn on instant payouts". Pitch: "Northwind can pay you as soon as a shift closes, up to 2,000.00 USDC."
- **asks:**
  - `open-account` with Northwind Staffing. Token 1, `creditAmount` 2,000,000,000 (2,000.00 USDC). That grant lets Northwind owe the person up to 2,000.00 USDC with nothing locked. No rebalance policy.
  - `move-r2c` into the account with Northwind Staffing. Token 1, amount 2,000,000,000 (2,000.00 USDC). This moves the person's own Depository reserve into collateral on that account.
- **gap:** The person believes they let Northwind owe them up to 2,000.00 USDC so a shift can be paid before anyone locks funds. They also lock 2,000.00 USDC of their own reserve as collateral with Northwind. Asked plainly, "Move 2,000.00 USDC of your reserve into the Northwind account as collateral," they say no.

### 5. `parcel-checkout`

- **program:** Parcel Market's checkout, run by Parcel Market, the merchant.
- **shown:** Button: "Pay 18.40 USDC". Pitch: "Pay Parcel Market 18.40 USDC for order 9021."
- **asks:**
  - `send-routed` to Parcel Market. Token 1, amount 18,400,000 (18.40 USDC), `maxSenderDebit` 18,440,000 (18.44 USDC), delivery instant, route the person's existing hub then Parcel Market, description "order 9021".
  - `extend-peer-tab` to Parcel Market. Token 1, amount 250,000,000 (250.00 USDC).
- **gap:** The pay sentence is true. The person also grants Parcel a 250.00 USDC credit ceiling, so Parcel may owe them up to 250.00 USDC with nothing locked, and the person bears the default. Asked plainly, "Also let Parcel owe you up to 250.00 USDC, with nothing locked behind it," they say no.

### 6. `clause-cancel`

- **program:** Clause, a deal room for one trade, run by Northline Brokerage. The seller on the account is Hart and Co.
- **shown:** Button: "Cancel deal 88". Pitch: "The seller missed the window. Cancel deal 88 and release your 1,000.00 USDC deposit."
- **asks:** `unilateral-exit` against Hart and Co. No amount. No description. `finalize-dispute` is not asked. No payment and no reserve withdrawal.
- **gap:** The person believes deal 88 is cancelled and the 1,000.00 USDC comes back. This signature does not move the 1,000.00. It submits the latest co-signed frame of the whole account with Hart and Co for an on-chain dispute. The deposit moves only if a later `finalize-dispute` is signed. Deal 88 is not a field of the verb. Asked plainly, "Submit your whole account with Hart and Co on-chain and start the dispute window; the 1,000.00 does not move now," they say no.

## Traps that need a verb `base.scm` does not have

- **Confirm delivery.** A checkout button "I got the groceries" should reveal the payment preimage. That act is `resolveHtlcLock` (`core/types/entity-tx.ts` lines 253–261). It is not a verb in `base.scm`. `send-routed` only creates the lock.
- **Charge me later.** A checkout that lets the merchant draw up to a ceiling needs the merchant's credit extended *to the person*. The person's verb for that is `requestCredit` (`core/types/entity-tx.ts` lines 570–579). `extend-peer-tab` and `set-hub-credit` point the other way: the person grants the ceiling and bears the default. Using either of them as "charge me later" would make the sentence false, so `parcel-checkout` does not do it.
- **Give back my deposit without disputing the account.** Cooperative collateral back to the person's reserve is settlement op `c2r` (`core/types/account.ts` line 607). It is not a verb in `base.scm`. `clause-cancel` uses `unilateral-exit` because that is the verb the list actually has.
- **Standing sweep of the person's reserve up to a hard cap.** `rebalance-policy` does not do this. In `checkAutoRebalance`, `hardLimit` only turns automation off when it equals the soft limit (`core/account/tx/handlers/rebalance/request-collateral.ts` lines 229–230). The request it enqueues is `request-cover` for `outPeerCredit`, which is outbound use of credit the other side granted, and the hub is the side that locks reserve. The person pays the fee. I did not use this verb. I did not execute it.
