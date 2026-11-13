# Margin account: terms and disclosure (draft)

**Status 2026-11-13T17:16:07+07:00: template only.** It was written for a specific firm that turned out not to exist. The mechanics and risk list are checked against the code; the commercial terms describe no real relationship.

Drafted by `claude-fable-5-2` on 2026-11-13 for the owner to edit. Not legal advice and not reviewed by counsel. Square brackets are blanks for the owner. "We" is the Desk; "you" is the firm.

## What we are offering

Today we pay out USDT on Ethereum for you and you repay us later, up to about **[L0]** outstanding at any time. You have asked for more than that.

Nothing about that arrangement changes. In addition, if you place **[M]** USDT as margin in a smart contract account between us, we will pay out up to **[M]** more against it. That gives you up to **[L0 + M]** outstanding in total. You choose on each payout whether it draws on our credit or on your margin. Margin you have not drawn against stays yours. You do not send it to our wallet.

Account fee: **[none / 1 bp per payment after 30 days]**. Our payout pricing stays as it is today.

## What changes for you

1. **Payouts against margin are paid for by the margin.** When you draw on the account, that part of your margin becomes ours. Our existing credit to you is separate, stays outside the account, and is not secured by the margin.
2. **Every draw on the account is signed by both of us** in the account software. Each of us keeps the signed record.
3. **You can take unused margin back.** Normally we both sign and it leaves in one transaction. If we do not respond, you can withdraw without us by starting a dispute on Ethereum and waiting out the response period. A dispute closes this account permanently; continuing afterwards means opening a new one.

## What does not change

- We still pay your recipients from our own wallet, on Ethereum, as today.
- You repay our credit by ordinary transfer, as today.
- You top up margin by depositing into the account. A deposit needs no signature from us.
- The **[L0]** we front today stays free.

## How it works

1. You create a key in the wallet. Nobody else holds it.
2. You approve USDT and deposit **[M]** into the account. This is two Ethereum transactions the first time.
3. You ask for a payout against margin. We pay your recipient on-chain first, as today, and send you the transaction. You then sign the debit. Until you sign, that payout is our risk.
4. To restore capacity, you deposit more margin.
5. When you want unused margin back, we both sign a withdrawal to an address you name.

You use the web wallet. Your key is created and kept in your browser. You need to be online to sign a draw.

## Risks you are taking

Read these before depositing anything.

1. **The contracts are not audited.** No outside security firm has reviewed them. A fault could lose your margin. Deposit only what you can afford to lose to a software error. We suggest starting at **[small M]**.
2. **All users' funds sit at one contract address.** Tether can freeze USDT at an address. If it froze this one, your margin would be frozen with everyone else's, whatever the reason.
3. **Leaving without us takes time and gas.** The response period signed into this account is **[25 hours]**. A dispute is two transactions; finalizing alone has been measured at about 0.9 million gas, at whatever the gas price is that day. Margin smaller than about 100 times that cost is not worth disputing over, and you should treat it as resting on our cooperation.
4. **We run the watchtower.** A watchtower answers a dispute for you if you are offline. At the start the only one is ours. If we filed a dispute with an out-of-date record while you were offline and our tower did not answer, you would have to answer yourself within the response period.
5. **The software is new.** It has run on test networks. This would be among its first uses with real funds.
6. **Nothing is insured or guaranteed.** This is not a bank account or a custody service.
7. **The code licence.** Most of the contract source is published without an open licence. We will give you written permission to run and inspect everything you need.

## Risks we are taking

- Our existing **[L0]** of credit to you stays unsecured, as today.
- Each payout is unsecured until you sign its debit.
- If you default, recovering margin takes us the same response period and gas.

## What we commit to

- Pay out within **[time]** of a request that is within your undrawn margin.
- Sign a withdrawal of unused margin within **[time]** of your request.
- Give you the full signed record on request, in a form you can check without us.
- Tell you at once about any fault we find in the software or contracts.

## Ending it

Either of us can end the arrangement at any time. We both sign the withdrawal of your unused margin and the account is closed. Our ordinary arrangement continues or not as we agree separately.

## Later, if this works

If you want more capacity than **[L0 + M]**, we can discuss a credit line inside the account, above your margin. That part would be unsecured lending by us, charged per day drawn, and agreed in writing separately. It is not part of these terms.

## Blanks for the owner

| Blank | Note |
| --- | --- |
| `L0` | what you front today |
| `M` | start small; must be worth disputing over at a stressed gas price (about 0.092 ETH per gwei) |
| response period | default is 1 hour for a hub plus 24 hours for a user, 25 in total, if your Entity is registered as a hub; 48 if it is not; fixed when the account is created |
| account fee | `launch-pilot.md:64-65` records 1 bp per payment after 30 days; waiving it for this firm is your decision |
| payout, repayment and withdrawal times | what you can actually keep to |
| legal names, governing law, signatures | for counsel |

## Not yet true, and must be before this is sent

- The contracts are not deployed on Ethereum mainnet and USDT is not listed there.
- The exit has not been timed on Sepolia with real response periods on current code.
- Counsel has not reviewed the Desk's position as a documented lender or holder of a margin arrangement.
- A hosted copy of the account software for the firm, with the key staying with the firm, is not something I found in the code. The draft offers the web wallet instead.

## Checked against the code

- Co-signed withdrawal: `Account.processC2R` requires the counterparty's signature and a fresh nonce, moves collateral to the caller's reserve, and `_reserveToExternalToken` then pays the address named in the batch.
- Exit without cooperation: `timeout = start + leftResponseSeconds + rightResponseSeconds` (`Account.sol:1786-1789`).
- Watchtower: the tower acts only on an appointment the account owner signed, and only after a dispute has started (`docs/watchtower-services.md`, `Depository.sol` `watchtowerCounterDispute`). I read the document, not the full appointment flow.
- Debt beyond margin: recorded as a debt row and collected from the debtor's later reserves (`docs/evidence/sepolia-20261011/unsecured-exit.json`).
- A limit is a plain number with no accrual; lowering it keeps drawn exposure (`set-credit-limit.ts`).
- Capacity: a party can send its share of collateral plus the credit the other side granted (`core/account/utils.ts:28-55`). So margin `M` plus a grant of `L0` gives `L0 + M`, and collateral is consumed before credit.
- Deposit into an Account needs no counter-signature (`Account.processR2C`).
- A finalized dispute leaves the Account permanently closed (`core/scenarios/disputes/lifecycle.ts`).
