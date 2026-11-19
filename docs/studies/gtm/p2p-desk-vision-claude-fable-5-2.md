# XLN for P2P desks: vision (revision 2)

- **Author:** `claude-fable-5-2`, Claude Code, 2026-11-13T18:21:36+07:00
- **Written against:** `019d45b` (`v0.1.31`)
- **Status:** one model's recommendation, written at the request of the person directing this session. Not owner canon. A second candidate for the first product, beside [`synthesis-claude-fable-5-2.md`](./synthesis-claude-fable-5-2.md).
- **Revision 2** replaces the first version after a review by another model and my own re-reading of the code (D019 in [`chat.md`](./chat.md)). What changed is listed in §15.
- **Nothing here is evidence of demand.** No desk, broker or trader has been asked (D016).
- **Reviewed (added 2026-11-19):** by grok-4.6 on 2026-11-14 in [`p2p-desk-review-grok-4.6.md`](./p2p-desk-review-grok-4.6.md); not revised in response. See D031.
- **Scope limit.** This is written for operators who receive fiat into bank accounts in their own name. It does not cover, and I will not design for, arrangements in which third parties operate bank accounts on a desk's behalf.

Tags: `[exists]` read in the code this session; `[build]`; `[decision]` owner's call; `[calc]` my arithmetic; `[hypothesis]` unverified.

## 1. The product in one paragraph

Desks that exchange USDT for local currency deal with each other and with the brokers who bring them clients. Those relationships run on trust, with standing balances and one side always sending first. XLN gives each such pair one Account in which unspent collateral stays with whoever posted it (a broker's reserve is the exception, §6), and gives each deal a ticket: the crypto leg is locked, a release-holder both sides chose releases it when the bank payment is confirmed from the expected sender, and it returns if not. One-off clients never hold an Account; the desk or broker serving them pays out to their wallet. XLN does not run a marketplace, list offers or find clients. The ticket lock is not available today (§5).

## 2. Who holds an Account

| Relationship | What sits in the Account | Why an Account and not a transfer |
| --- | --- | --- |
| desk and desk | each side's inventory for the other; a limit either way | balances stay, deals go both ways and net |
| desk and introducing broker | the broker's fees and a reserve against bad introductions | a rolling balance with a signed record of what is reserved and until when |
| desk and a frequent business client | the client's standing balance | repeat two-way use |

Not in an Account: a one-off client. A client changing a few hundred dollars is below any sensible dispute cost (§8) and has no use for a balance that takes a day or more to exit.

## 3. A ticket

Seller desk S has USDT. Buyer side B is a desk or broker whose client pays fiat to S's own bank account. R is the release-holder.

| Step | What happens | Who is exposed |
| --- | --- | --- |
| quote | S and B agree amount, rate, the paying account's name, R, and two clocks | nobody |
| lock | S locks USDT to B under a hash whose secret R holds; B locks a small no-show bond to S under a second hash R holds | S's coins and B's bond are held, not moved |
| send window (short) | the client pays; B submits the bank reference | S, if the window passes with nothing: S's coins stay held until the lock expires, and R gives S the bond secret as compensation |
| check | R confirms amount, reference and that the sender's name matches the declared one | B, to R being slow or wrong |
| release | R gives B the secret; B claims; the bond lock expires back to B | B, if S will not countersign. Account frames are signed by both sides, so a seller holding the fiat can stall the claim. B's remedy is to publish the secret on-chain before the lock's reveal deadline and then dispute, which closes the Account |
| short payment | R releases the matching fraction | untraced; see §5 |
| lock window (long) ends without release | the lock returns to S | B's client, who has paid fiat, unless R ruled in time |
| payout | B sends coins on-chain to the client's wallet from its own funds | the client, to B |

The two clocks exist because a single one fails either way. A long one lets a non-paying buyer hold the seller's coins for free; a short one makes a buyer with a slow bank lose. The bond is needed because before expiry only the beneficiary can cancel a lock (`core/account/tx/handlers/htlc/resolve.ts:57-66`), so a silent buyer cannot be forced to release the seller's coins early. A review proposed that the release-holder co-sign an early cancel; the code does not allow that.

What the two clocks do not fix: if R is unavailable for the whole long window, the seller keeps the coins and the fiat. R must be bonded against failing to act, a named fallback must be able to release, and R must rule early enough to leave B time for an on-chain reveal. The claim is therefore not atomic against an uncooperative seller. That is the same weakness §11 notes in RoboSats, moved from the operator to the counterparty, with an on-chain remedy that only makes sense above the floor in §8.

## 4. The release-holder

| | Seller | Chosen guarantor | Proof service |
| --- | --- | --- | --- |
| releases when | it sees the fiat | it has checked the evidence | a bank confirmation verifies |
| can take the coins | no | no; it only picks S or B | no |
| can cheat by | not releasing | siding with one party | its operator siding with one party, or a wrong check |
| restrained by | its record, its collateral in the Account | its bond and record; both sides chose it | its bond; a named human fallback; checks that others can repeat |

In every column only S or B can receive the coins. That is the difference from a guarantor who takes custody.

A proof service reading bank confirmations inside a hardware enclave was proposed in review, with specific Thai and Vietnamese payment rails. `[hypothesis]` I have not checked that those confirmations are obtainable by a third party, on what terms, or what the enclave adds beyond trust in its operator.

## 5. State of the mechanism

- Hash-locked, timed payments with held capacity, released when the beneficiary presents the secret: `[exists]` (`htlc_lock`, `htlc_resolve`, `resolveHtlcLock`).
- **Contracts need no change.** In a dispute a payment clause settles on any preimage of its hash, revealed on-chain or supplied in arguments, with no check on who produced it (`DeltaTransformer.sol:323-355`, `:442-454`). `[exists]`
- **A lock whose secret the payer does not know: `[build]`, in TypeScript, on both ends.** Today the payer's runtime generates the secret (`core/paybook/payment-admission.ts:192-197`), the envelope's final layer always carries it (`core/protocol/htlc/codec/onion.ts:24-28`), and the recipient rejects an envelope whose secret does not match the lock (`core/paybook/materialize-context.ts:289-291`). All three change. The review estimated about 100 lines; I have no basis for a count, and the repository's rules add Rust wire parity, hash coverage and browser scenarios.
- No-show bond as a reverse lock: `[build]` on the same change. It needs B to have capacity in the Account, which is why B is a desk or broker and not a one-off client.
- Partial release: `[hypothesis]`. `HashLadder` commits to a 16-bit fill ratio and a Pull settles on the ratio registered by its beneficiary (`HashLadder.sol:5-17`, `DeltaTransformer.sol:403-424`). A third party could generate the ladder secrets. I have not traced whether a fiat ticket can use the Pull path.
- Lock lifetime: a constant sets 24 hours for the asynchronous mode (`core/types/finance/payment.ts`). I did not read how that mode behaves on a direct lock.
- Collateral and per-counterparty credit limit: `[exists]`. A party can send its share of collateral plus credit granted to it, and collateral is consumed first (`core/account/utils.ts:28-55`).
- Withdrawal: both sign, or one disputes and waits both response windows, 48 hours by default between two non-hub Entities, 25 with one hub and 2 between two hubs (`Account.sol:1786-1789`, `dispute-config.ts`). A dispute closes the Account. `[exists]`
- Guarantor role, proof service, sender-name check, broker reserve rules: `[build]`, outside the protocol.

## 6. Fraud controls

| Risk | Control | State |
| --- | --- | --- |
| fiat paid from a third party's account | the ticket names the paying account holder; R releases only on a match | `[build]`; this is the control that matters |
| reversal or a bank claim after release | part of the introducing broker's fee stays in its Account for a set period and absorbs first loss | `[build]`. A bank claim can arrive days later and a lock lives about a day, so the reserve cannot be a lock. It is an obligation the broker signs when introducing, which makes that amount the desk's by signed state until the desk cancels it. This is a deposit with the desk, as today. What XLN adds is a signed record of amount and period, and that anything beyond the signed amount stays the broker's |
| anonymous strangers | no public offer book; every client arrives through a named desk or broker | `[decision]` |
| fake track records | signed history between the two parties | partly `[exists]` in `docs/credit-officer.md`, which is testnet only and does not set Account limits |

Uniqueness proofs and agent registries were in the first version. They address no row above, and are moved to "later" in §9.

## 7. Capital

- A desk-to-desk Account is funded on-chain once by each side and reused. Capacity is per token per Account (`Depository.sol:65`), so a desk posts inventory per counterparty. That is acceptable for a handful of standing lines and unworkable for many small ones.
- A lock holds capacity for its lifetime. The no-show bond is what pays for that.
- Routing a ticket through a hub is not in this version. Every ticket is on a direct Account.

## 8. Chain and ticket size

- `[hypothesis]` This trade settles mostly in USDT on TRON. Native TRON is `todo.md` item 3 and unproven. If the hypothesis holds, item 3 comes first.
- `[calc]` Canon protects a balance at about 100 times dispute cost (`rejected-ideas.md:8-9`). On Ethereum a measured exit is 921,213 gas, about 0.092 ETH of minimum balance per gwei of gas price. A TRON exit is unmeasured.
- Standing lines between desks and broker reserves can clear the floor. Single client tickets cannot, which is another reason clients stay outside Accounts.

## 9. Rungs

| Rung | What runs | Needs |
| --- | --- | --- |
| 0 | counsel's view on each country and operator type; ten conversations with desks and brokers using the D010 questions | nothing built |
| 1 | two desks, one Account, tickets with the seller as release-holder, on a test network. No bond is possible here, since the seller would hold its secret. Over simply not sending, this gives the buyer only proof that the coins are reserved for it | the lock change in §5; owner confirmation |
| 2 | a chosen guarantor as release-holder with a bond; no-show bond | rung 1 |
| 3 | sender-name check by a proof service with a named fallback | an operator; verified access to bank confirmations |
| 4 | broker Accounts with a first-loss reserve | rung 2 |
| 5 | partial release | the Pull path traced |
| later | attestations and published history as inputs to limits | issuers a desk accepts |

The first version's rung with no lock is removed. A desk has no reason to deposit into unaudited contracts to send unlocked payments to someone it already trusts.

## 10. Against my five tests

| Test | Result |
| --- | --- |
| a paying flow exists elsewhere | yes; I have no spread or volume figures |
| the first user is the owner or already served | **fails**; no desk or broker is named. A review asserted a network exists; I treat that as unverified |
| two-way, fast capital turns | plausible for desk-to-desk lines |
| uses credit and partial collateral | yes |
| clears the dispute floor | plausible for standing lines; unmeasured on TRON |

## 11. Precedents

- **OpenPeer** (2022–2025): escrow marketplace for strangers with a staff arbitrator and many growth levers; one account says it ran out of runway. Its "marked as paid" rule stopped the seller cancelling and let a buyer hold coins for free.
- **RoboSats**: fiat deals over Lightning hold invoices with bonds from both sides and staff rulings. A search digest says its seller and buyer legs are not atomic; I did not read the primary text.
- **Peer, formerly ZKP2P**: release on cryptographic proof of the bank payment; reported locked value about USD 72k in October 2026. Good release mechanics have not produced a large market.
- **Telegram guarantee markets**: operators take custody; the largest reported are tied to fraud, and one was shut in May 2025 after a reported USD 27 billion of illicit flow.

## 12. Risks

- **Who it attracts.** A no-custody lock for USDT against fiat is what a fraud market wants. Hence no public book, named introducers, sender-name matching, and the scope limit at the top.
- **One pooled contract address.** Tether can freeze an address. If any user of the Depository draws that, every user's balance is frozen with it. One contract per counterparty pair would contain this and is not how XLN is built.
- **Legal position** of each role in each country. I cannot judge it.
- **Bank freezes and fiat fraud** remain with the desk.
- **Unaudited contracts and an exit of a day or more.**

## 13. Where this collides with canon

- Fiat P2P is not in `AGENTS.md` release scope.
- Native TRON would move from queue item 3 to first.
- The lock change alters payment admission and the envelope format on both ends. `AGENTS.md` requires the owner's confirmation for a new protocol choice.
- Swap, cross-swap, pooled lending and load targets are not needed for rungs 0–4.

## 14. Stop conditions

- Counsel says the operators this is written for cannot lawfully use it.
- Ten conversations produce no desk that names a counterparty it would move onto an Account.
- Desks say the informal arrangement is preferred because it is unrecorded.
- The owner declines the lock change.
- A client loses fiat to an expired lock.
- The first users turn out not to be within the scope limit.

## 15. What changed from the first version

- Centred on desk-to-desk and desk-to-broker Accounts; one-off clients moved outside.
- The no-lock first rung removed.
- Stated that contracts need no change, and that the recipient enforces the secret, so the change spans both ends.
- Added the two-clock ticket, the no-show bond, sender-name matching and the broker reserve.
- Uniqueness proofs and ERC-8004 moved to "later".
- Added the scope limit.

## 16. Unverified

- That this trade is large, on TRON, and structured as desks and brokers.
- Spreads, fees and credit terms. No figure appears in this document.
- That bank confirmations can be checked by a third-party service.
- That a fiat ticket can use the Pull path for partial release.
- The size of the lock change.
- The licensing position of any operator.

## Sources

- [openpeer/openpeer](https://github.com/openpeer/openpeer), [openpeer_contracts](https://github.com/openpeer/openpeer_contracts), [YapBay blog, March 2025](https://yapbay-www.pages.dev/blog/yapbay-2025)
- [RoboSats in Bitcoin Magazine](https://bitcoinmagazine.com/business/robosats-private-bitcoin-exchange), [hold invoices (Voltage)](https://voltage.cloud/blog/understanding-hold-invoices-on-the-lightning-network)
- [Peer on DefiLlama](https://defillama.com/protocol/peer), [ZKP2P interview](https://defillama.com/research/interview/zkp2p-core-contributor-on-trustless-fiat-ramps-and-the-power-of-zk-tls)
- [Flare on guarantee marketplaces](https://flare.io/learn/resources/blog/prehistory-chinese-language-guarantee-marketplaces), [Recorded Future](https://www.recordedfuture.com/research/evolution-of-the-chinese-language)
