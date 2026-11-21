# Unresolved amounts: the flows that can occur, and which power each one uses

Research, not a spec. Owner question O3 from the claim ledger: an "unresolved 800" can mean
different things, and each needs a different power. This maps the situations two parties can
actually be in to what xln has at `c3a5f6140`, what that power costs, and where nothing exists.
Labels as in the ledger: [M] read in code at the pin, [R] relayed and not re-read here.

## The powers that exist

| Power | Who signs | What changes in shared state | Account keeps trading? |
|---|---|---|---|
| Do nothing / private note | nobody | nothing | yes |
| `direct_payment` back (refund, netting) | the payer | delta moves; optional `description` is signed text, not meaning [M] `core/types/account.ts` | yes |
| `credit_request` | the requester | records an intent only; the line moves when the other side proposes `set_credit_limit` [M] `credit-request.ts:3-14` | yes |
| `set_credit_limit` | the grantor | prospective limit; already-drawn exposure stays owed [M] `set-credit-limit.ts:1-7` | yes |
| `htlc_lock` / `htlc_resolve` | payer locks, payee reveals | a hold that subtracts from capacity; refund after the timelock expiry [R] P7 | yes |
| `forgive` in a settlement | both, through a settlement workspace | writes off the whole debt in one token, settled on-chain [M] `core/types/account.ts:609`, `settlement/transition.ts:114` | yes |
| Dispute | one party | finality sets `disputed` and freezes the account [M] `j-finality.ts:194-195`; no reopen path [M] `docs/roadmap.md:156-160` | **no, permanently** |

## Situations

1. **Asked to pay, and I don't think I owe it.** A request link or a steward proposal arrives.
   Nothing is signed until I pay, so declining leaves shared state untouched. Power: none. The
   surface must not present declining as incomplete.

2. **Paid, but we disagree what it was for** (loan vs. gift, deposit vs. payment). The frame
   records that value moved and its signed `description`; it cannot record whose reading is right.
   Resolution is a payment back or nothing. No protocol power settles meaning.

3. **I accepted a debt, then dispute part of it** (I owe 42.50, I now say 30). The debt is a
   signed delta. Options: the creditor pays back the difference (`direct_payment`, keeps trading),
   or the creditor forgives, but `forgive` erases the whole token debt, not a part, and goes
   through on-chain settlement. My own unilateral option is to refuse to pay further; the
   creditor's is a dispute, which freezes the whole account.
   **Gap:** a partial write-off (forgive an amount, not the token) does not exist.

4. **The other side wants more credit than I want to give.** `credit_request` records the ask;
   I answer with `set_credit_limit` or not at all. Lowering a limit later does not reclaim what
   was drawn.

5. **Pay only when a condition is met** (on delivery, on a document). An HTLC holds the amount
   until the payee reveals a preimage, and refunds after expiry. It works only if the condition can
   be turned into a secret the payee learns. It cannot express "release at time T" [R] P7, nor
   "release when a third party is satisfied".
   **Gap:** a time-released or attested release.

6. **Payment in flight, outcome unknown** (hub down, pending frame, held lock). The lock refunds
   on expiry; the wallet shows the amount as held or arriving, not settled. A missing response is
   not permission to send again [R] `docs/agent-payments.md`.

7. **Counterparty unresponsive while holding my exposure.** The only unilateral path is a
   dispute, and it ends that account for good. Recovering without closing needs the other side's
   signature.

8. **"I hold 800 open on my side; keep trading."** Three different powers wear this label:
   - my private note: nothing shared, always available;
   - an agreed reservation: an HTLC-style hold both sides accepted, rest of the line payable;
   - an enforceable objection to a claim the other side already holds: **does not exist**. The
     dispute that does exist freezes everything.

## What does not exist, in one list

- Partial write-off of a debt (only whole-token `forgive`).
- Release at a time, or on a third party's attestation (only hashlock + expiry).
- A unilateral objection to part of an account that keeps the rest trading.
- Any signed record of what a payment was for beyond free text.
- Bilateral reopen of a disputed account.

Each of these is new protocol, not a wallet feature. A surface that offers "dispute" for an
unresolved amount must name the freeze and must not be the only action offered
([`clerk-boundary.md`](../clerk-boundary.md), product bounds).

## Open for the owner

- Which of the gaps, if any, is in launch scope. Partial write-off and an attested release are the
  two that change what a hub can offer; the partial objection is the most expensive.
