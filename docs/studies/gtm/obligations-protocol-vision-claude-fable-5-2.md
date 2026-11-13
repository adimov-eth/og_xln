# XLN as an obligations protocol: vision

- **Author:** `claude-fable-5-2`, Claude Code, 2026-11-13T20:29:33+07:00
- **Written against:** `3ef0c37` (`v0.1.31`, with the study committed)
- **Status:** one model's recommendation, written at the request of the person directing this session. Not owner canon.
- **Relation to my earlier files.** This is my current position on what XLN is. [`protocol-layer-vision-claude-fable-5-2.md`](./protocol-layer-vision-claude-fable-5-2.md) remains the list of what a third party needs in order to build on it. [`held-payment-spec-claude-fable-5-2.md`](./held-payment-spec-claude-fable-5-2.md) remains the one primitive I would add. The P2P desk document is one service that could sit on top.
- **Nothing here is evidence of demand.** No builder, desk or trader has been asked (D016).
- This document was not reviewed by a second model; the reviewer was unavailable when I wrote it.

Tags: `[exists]` read in the code this session; `[build]`; `[decision]` owner's call; `[hypothesis]` unverified.

## 1. The position in one paragraph

XLN is a protocol in which two parties record what they owe each other, choose how much of it is backed by collateral and how much is trust, and can take the signed record to a chain to have it enforced. Moving tokens is something cheap chains already do. Recording an obligation, bounding it, making it conditional, and enforcing it without the other side's consent is what XLN does. Services that add an off-chain leg, such as an escrow for a fiat deal, are a separate layer run by other people.

This is the owner's own description. `docs/intro.md` opens by saying xln makes financial accounts provable, with an Account recording "balances, obligations and agreed conditions".

## 2. A correction to the last part of this study

`docs/rejected-ideas.md` lists, as an owner decision, the rejection of "framing xln as a better Lightning, Raiden or L2", on the ground that collateral-only channels are the case where credit is zero. Late in this session the discussion, under my name and in pasted reviews, measured XLN against Lightning, earlier state-channel frameworks and Yellow Network, and at one point treated a locked-value figure for Yellow as settling the question. That was the rejected framing, and the figure was one I had not verified. Those comparisons test the credit-zero case. They are a caution about one kind of buyer, and they do not test an obligations protocol.

## 3. The obligations it can express

All `[exists]` as Account transactions (`core/account/tx/catalog.ts`) and, where a dispute must interpret them, as clauses the contract applies (`DeltaTransformer.sol:67-72`: payments, swaps, pulls, term loans).

| Obligation | What it records | How it is bounded |
| --- | --- | --- |
| balance | who is ahead and by how much, per token | `−leftCreditLimit ≤ Δ ≤ collateral + rightCreditLimit` (`Depository.sol:1005`) |
| credit | how far one side may go into the other's debt | a limit the granting side sets and can lower going forward (`set-credit-limit.ts`) |
| conditional payment | a payment that completes on a secret before a deadline | hash, timelock, reveal height (`htlc_lock`, `htlc_resolve`) |
| swap offer | a standing offer to exchange one token for another | signed terms; resolved or cancelled in the Account |
| pull with partial fill | a claim that settles for a committed fraction | a 16-bit fill ratio (`HashLadder.sol:5-17`) |
| term loan | principal, rate, term, late period | accrues in signed state (`DeltaTransformer.sol:74-87`) |

Obligations are bilateral. A payment across several parties is a chain of bilateral obligations, one per Account. Claims are not transferable: the owner rejected assignable debts and a market in them (`rejected-ideas.md`).

## 4. What "claimable on-chain" means, exactly

Either party can take the last state both signed to the chain. After the response windows, the contract settles it in three steps (`Depository.sol:996-1060`):

1. **Collateral.** Split according to the signed balance. This part is certain.
2. **The debtor's reserve at that moment.** If the balance exceeds collateral, the shortfall is taken from whatever spendable reserve the debtor holds in that Depository.
3. **A debt row.** Anything left is recorded as a debt, first come, first served, and collected from the debtor's future inflows of that token at that Depository. Enforcement runs before every outflow, and anyone may trigger it (`enforceDebts`, `:758`).

The contract's own comment states the limit plainly: the debt carries no interest, no external claim and no seizure right, and the meaning of a credit line is trust in the counterparty's future inflows and reputation (`:1038-1046`). Nothing more is possible without a legal agreement beside it.

So an unsecured obligation is enforced by exclusion. A defaulter cannot move that token through that Depository until it pays. The force of that grows with how much the debtor needs the network, and it is weak while the network is small.

The contract does not know the credit limits. Both parties sign the balance, and the signature is the consent (`:1007-1011`). The limit is enforced by each party's own software before it signs.

## 5. What it is not

- **Not a faster or cheaper way to move tokens.** A cheap chain wins that.
- **Not a channel network with credit bolted on.** Owner decision, §2.
- **Not custody.** Unspent collateral stays with whoever posted it.
- **Not a market in claims.** Rejected by the owner.
- **Not proof of a hub's solvency.** Rejected by the owner; a user relies on collateral in their own Account.
- **Not a marketplace or a venue.** It lists no offers and finds no counterparties.

## 6. Why not just use a cheap chain

| Need | Cheap chain | XLN |
| --- | --- | --- |
| send tokens you hold | yes, for a fraction of a cent | yes, with more ceremony |
| owe, and be owed, without prefunding | no; needs a contract per arrangement or trust | the credit limit |
| many updates between the same two parties with one settlement | each is a transaction | signed off-chain, settled net |
| a payment that depends on something off-chain | an escrow contract, usually with a custodian or arbiter | a conditional payment; with the held payment, a chosen release-holder who cannot take the funds |
| a record a counterparty cannot later deny | the chain's history of transfers, not of what was owed | a signed state both hold |
| keep the relationship off public view | no | only funding and exits are public |

The honest substitutes for XLN are therefore trust with a spreadsheet, a guarantor who takes custody, a legal contract, and lending protocols. Section 11 says how little is known about whether people prefer XLN to those.

## 7. Three layers

| Layer | What it is | Who runs it |
| --- | --- | --- |
| Protocol | contracts, the account state machine, obligation kinds, dispute rules, the wallet | published by the owner; run by anyone |
| Infrastructure | a hub, a watchtower, a contract deployment with its token list | anyone. Canon treats a hub as a bank: compliance, credit and regulation are its policy, not the protocol's (`rejected-ideas.md`) |
| Service | escrow for an off-chain deal, checks on bank payments or deliveries, identity, dispute staff, clients | a third party under its own name and licence |

## 8. Collateral and trust as a scale

Each party sets, per counterparty, how much is collateral and how much is credit. What moves a counterparty along that scale is the granting party's policy: history with it, identity attestations it accepts, a posted bond. The protocol stores none of that. This matches the owner's rule that compliance is a hub's policy and not a contract feature.

Two facts from the code to carry into any design:

- A party can send its share of collateral plus the credit granted to it, and collateral is consumed first (`core/account/utils.ts:28-55`). A grant on top of posted collateral adds to capacity; it does not sit behind it.
- A testnet credit officer already tiers by Account age, settled volume and repayment, says that this does not prove identity, and does not set Account limits (`docs/credit-officer.md`).

## 9. Escrow as a service layer

A deal with an off-chain leg, such as fiat for USDT, needs three things the protocol can supply and several it cannot.

| Supplied by the protocol | State |
| --- | --- |
| a locked crypto leg nobody holds in custody | `[exists]` when the payer knows the secret; `[build]` for a secret held by a third party (the held payment) |
| a bond | a second conditional payment in the other direction; needs the held payment |
| a signed obligation standing in for an unsettled fiat leg | `[exists]`; collateral under it pays out by dispute with no ruling |
| an objective default record | `[exists]` as debt rows |

Supplied only by a service: deciding whether fiat arrived, matching the sender's name, identity, handling reversals, and the licence to do any of it. The protocol cannot see a bank transfer. A release-holder that does nothing cannot be punished on-chain.

The limits in the held payment spec apply: not atomic against a payer who will not countersign, expiry favours the payer, direct Accounts only at first.

I will describe mechanics for services run by operators who receive fiat into accounts in their own name. I will not design for third parties operating bank accounts on a desk's behalf.

## 10. Yield on collateral

Posted collateral has a cost. Earlier I measured that cost against a lending rate. Two things reduce it:

- Token listing requires only a readable, non-zero supply (`Depository.sol:275-289`). A yield-bearing token that does not rebase could be listed as the collateral asset with no contract change. `[hypothesis]` A rebasing one would break internal balance accounting; I infer that from how reserves are tracked and did not test it.
- Nothing in the Depository deploys deposits elsewhere. Doing so would be a contract change and a new risk.

Obligations would then be denominated in the yield-bearing token, not in the stablecoin under it.

## 11. What is known and not known about demand

- **Shown at scale:** people use escrow for fiat-for-USDT deals, through exchange P2P desks and through guarantee markets on Telegram. Both are custodial. A large share of the guarantee-market volume is reported as illicit.
- **Shown to be small so far:** non-custodial versions. OpenPeer stopped in 2025; Peer's reported locked value was about USD 72k in October 2026.
- **Not shown:** that anyone wants bounded credit recorded in a protocol instead of on trust. No entry in this study has a named party who does.
- **Unverified:** a locked-value figure for Yellow Network quoted in a review. Its deposits may be deployable elsewhere, which would make the figure understate what is committed.
- **Unchanged all day:** no first user, builder or operator is named.

## 12. Where this sits against canon

Mostly inside it, which earlier documents of mine were not.

- **Release scope.** Pay, both swaps and Lending are the obligation kinds of §3. This position does not ask to cut them; the wide scope is what makes the protocol general.
- **Additions that need the owner:** the held payment (a change to payment admission and the envelope), licence terms a third party can use, and builder documentation.
- **Outside release scope:** a fiat escrow service. It is a third party's layer and does not belong in the protocol's queue.
- **Open in canon already:** `todo.md` items 14 and 15, found while reading the payment path. Item 14 matters more under this framing: a three-block enforcement reserve is the time an honest party has to make a conditional obligation stick.
- **Still in conflict:** `todo.md:67-69` (lines 52-54 before items 14 and 15 were added) and `launch-design.md:45` disagree on whether independent hub operators are required at launch.

## 13. What would test it

One question, put to an operator before XLN is mentioned: where is your capital prefunded or resting on trust, how much, and what does it cost you. Put it both to desks that deal with other desks and to fiat-for-USDT traders. An answer with a number in it is a candidate first pair. A shrug is a result too.

A second route is one named third party who would build an escrow service and says what it needs from §9.

I would build nothing new before one of those exists. The two queued defects are the exception; they stand regardless.

Stop conditions: no operator names capital that is stuck; no builder is named once licence terms exist; the first users are ones the owner would have to answer for.

## 14. Unverified

- How Yellow handles deposits, and its locked value.
- That a non-rebasing yield-bearing token works end to end as collateral.
- The swap and pull paths beyond their types; I read payments and disputes closely and those two only at the level of §3.
- Whether a debt row's exclusion has ever changed a debtor's behaviour. There is no network large enough to show it.
- The legal position of a hub, a release-holder or an escrow service anywhere.

## Sources

- The repository at `3ef0c37`: [xlnfinance/xln](https://github.com/xlnfinance/xln).
- [`chat.md`](./chat.md) for earlier external figures: OpenPeer and Peer (D017 to D022), guarantee markets (D017), Yellow (D025, D026). No new external source was consulted for this document.
