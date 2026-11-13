# P2P extension: design

- **Author:** `claude-fable-5-2`, Claude Code, 2026-11-13T22:33:50+07:00
- **Written against:** `30f204a` (`v0.1.31`)
- **Status:** a design proposal, written at the request of the person directing this session. Not owner canon, not approved, not implemented, not tested.
- **Relation to my earlier files.** It applies [`obligations-protocol-vision-claude-fable-5-2.md`](./obligations-protocol-vision-claude-fable-5-2.md) §9 to one service. It needs the envelope change in [`held-payment-spec-claude-fable-5-2.md`](./held-payment-spec-claude-fable-5-2.md) and lifts that spec's "direct Accounts only" limit, with the cost stated in §7. It replaces the Account layout in [`p2p-desk-vision-claude-fable-5-2.md`](./p2p-desk-vision-claude-fable-5-2.md).
- **Nothing here is evidence of demand.** No trader, desk, hub operator or arbiter has been asked (D016).

Tags: `[exists]` read in the code; `[build]`; `[policy]` a hub's or arbiter's own rule, outside the protocol; `[decision]` owner's call; `[unverified]`.

## 1. Summary

Two traders who do not know each other settle a fiat-for-USDT deal through the hub each already has an Account with. The seller locks USDT toward the buyer with a conditional payment routed through the hub. The seller keeps the secret and releases it when fiat arrives. An arbiter, who is not the hub, holds a copy of the secret and can release it to the buyer if the seller takes the fiat and goes silent. If the buyer never pays, the lock expires back to the seller.

Traders share no Account. Nothing in the contracts changes. The protocol needs three changes to payments (§7). The ticket and the lock work with the existing deposit path. Screening of incoming USDT through one-time intake addresses is an optional hub service beside that path (§6).

One property depends on collateral. A buyer whose leg is backed by hub collateral in their Account is protected from the hub. A buyer who receives on credit trusts the hub for the ticket amount (§5, §9).

## 2. Name

"Adapter" already means the jurisdiction adapter in this repository (`core/jurisdiction/adapter`, `docs/intro.md:82`). This is an extension, beside `core/extensions/cross-j` and `core/extensions/rebalance`.

## 3. Parties

| Party | Has | Trusted for |
| --- | --- | --- |
| Seller | an Account with a hub, holding USDT capacity | releasing when fiat arrives |
| Buyer | an Account with a hub; may hold no USDT | paying fiat |
| Hub | Accounts with both, or a route to the buyer's hub | forwarding. It cannot take a collateral-backed leg and can only stall it. A buyer receiving on credit trusts it for the amount |
| Arbiter | an Entity with no Account on the route | deciding a disputed ticket |

The hub is the bank of canon: screening, credit and compliance are its policy (`docs/rejected-ideas.md`). The arbiter is a service operator under its own name.

## 4. What exists and what is built

| Piece | State |
| --- | --- |
| Conditional payment routed seller → hub → buyer | `[exists]` `htlc_lock`, `htlc_resolve` (`core/account/tx/catalog.ts`) |
| Buyer claims with a secret learned later | `[exists]` `resolveHtlcLock` (`core/entity/tx/handlers/htlc/direct.ts:26-75`) |
| Hub enforces a claim on-chain against a seller who will not countersign | `[exists]` the contract settles a Payment clause on any valid preimage (`DeltaTransformer.sol:323-355`) |
| Buyer with no USDT receives by granting credit to the hub | `[exists]` (`docs/intro.md:76`) |
| Buyer asks the hub to collateralise a claim | `[exists]` `request_collateral`: the requester prepays the hub's committed fee and the hub's scheduler deposits (`core/account/tx/handlers/rebalance/request-collateral.ts`). A buyer with no capacity cannot prepay the fee before receiving. Nothing in the Account forces the hub to deposit |
| Hub posts collateral in the buyer's Account before forwarding | on-chain `[exists]` (`Depository.sol:584`); as a ticket precondition `[build]` `[policy]`. I did not read whether the runtime lets a hub do this without a request |
| Payer withholds the secret from the recipient | `[build]` held payment envelope (§7.1) |
| A hop timelock step long enough for a late claim | `[build]` `[decision]` (§7.2) |
| Hub advertises maximum hold and a hold fee | `[build]` (§7.3) |
| Ticket record, secret hand-off, arbiter workflow | `[build]` in the extension, off-consensus |
| Intake addresses and screening | `[policy]` `[build]` a hub service (§6) |

## 5. Ticket lifecycle

A ticket is an off-chain record signed by seller, buyer and arbiter. It is not Account state.

| Field | Meaning |
| --- | --- |
| `amount`, `tokenId` | the USDT leg |
| `fiatAmount`, `currency`, `payeeRef` | the fiat leg; `payeeRef` is a hash of the seller's payee details |
| `hashlock` | hash of the seller's secret |
| `payBy` | when the buyer must have sent fiat |
| `lockExpiry` | when the lock returns to the seller |
| `arbiter` | the arbiter's Entity ID |

1. **Open.** Buyer and seller agree terms out of band. The seller generates the secret and sends it to the arbiter, encrypted to the arbiter's key. The arbiter checks it against `hashlock` and signs the ticket.
2. **Lock.** The seller sends a held payment to the buyer through the hub. The buyer sees a committed lock in their own Account for the ticket's amount, hash and expiry. On a secured ticket the buyer also sees hub collateral in that Account covering the amount, and does not pay fiat until it does. Collateral is consumed before credit (`core/account/utils.ts:28-55`), so a lock sent against posted collateral leaves the buyer a secured claim.
3. **Pay.** The buyer sends fiat to the seller's own account before `payBy`.
4. **Release.** The seller sees the fiat and sends the secret to the buyer. The buyer claims; the hub then claims from the seller.
5. **Dispute.** If the seller is silent after `payBy`, the buyer sends evidence to the arbiter. The arbiter either gives the buyer the secret or does nothing.
6. **Expiry.** With no claim by `lockExpiry`, the lock returns to the seller.

Timing: `lockExpiry` must leave room for the fiat rail, the seller's check, the arbiter's review and on-chain enforcement. The existing asynchronous lifetime is 24 hours (`core/protocol/payments/delivery.ts`); a ticket fits inside it.

A bond is optional and only for buyers who hold USDT: a second held payment buyer → hub → seller, with the buyer's secret shared with the arbiter the same way. On a no-show the arbiter gives that secret to the seller.

## 6. Intake and payout: where screening happens

### 6.1 What operating services do

- **Exchange P2P.** The seller's USDT is already on the exchange. Release is a ledger entry. The exchange screens at deposit and withdrawal.
- **Instant-swap services.** Husher's documentation describes it: each order gets a unique single-use deposit address generated and controlled by a third-party provider. The provider trades on a centralized exchange's spot market and delivers the output to the user's wallet. Husher scores each deposit and may hold it; a rejected one is refunded to the originating address. The documentation does not name the providers, say whether the address is an exchange deposit address, or say which wallet the output is sent from.
- **Desks.** Vendor sources describe screening the sender at quote and again at credit, and keeping separate wallets for exchange and P2P flows.

The common structure: someone owns a perimeter and screens before crediting. On an exchange the payout also carries the exchange's provenance; for swap services I infer that and the documentation does not state it.

### 6.2 The same question in XLN

- A deposit moves tokens from the caller straight into the Depository (`Depository.sol:697`), and anyone can call it. Tainted coins are in the shared contract the moment they are deposited.
- A withdrawal is sent from the Depository (`:727`). Its on-chain source is the shared contract, whoever earned the balance.
- A hub can refuse an Account to an Entity whose funding it dislikes. The `ReserveUpdated` event carries no depositor, so the hub reads the deposit transactions.
- No hub controls what other Entities deposit.
- `[unverified]` How an analytics vendor scores the Depository: as a service, as a mixer, or by tracing its events. This decides whether a buyer's withdrawal is accepted by an exchange. It is one question to a vendor and I have not asked it.

### 6.3 Design

| Option | How | Cost |
| --- | --- | --- |
| A. Screen the Entity | the trader deposits to the Depository; the hub screens the funding addresses before opening the Account | coins are already in the shared contract when the hub looks |
| B. Hub intake address | the hub gives the trader a one-time address it controls; the trader sends USDT there; the hub screens, then credits the trader in the Account from its own capacity, or refunds to the origin | the hub holds the trader's coins from receipt until credit |
| C. Deposit allowlist | only approved callers may deposit | a contract change; contradicts open participation and compliance-as-hub-policy |

I recommend B as the default path for the P2P case, with A for traders who fund themselves. C is not proposed.

Under B the trader extends credit to the hub for the intake amount, as a recipient already does (`docs/intro.md:76`), and then asks for collateral. The trader's exposure is unsecured hub credit from the moment the coins arrive until the hub collateralises the claim, and nothing forces the hub to do so. That is custody by the hub for that interval.

Payout mirrors it. A buyer who wants USDT on-chain can withdraw from the Depository, or pay the hub in the Account and have the hub send from its own wallet.

What B achieves: in a deployment where traders use intake, the Depository is funded by hubs, and what hubs deposit has been screened under their policy. What it does not achieve: it cannot stop an outsider depositing, and it does not answer §6.2's open question.

A correction to a session reply of mine: I said a deposit allowlist would not help because a contract cannot refuse a plain token transfer. That holds for dust. It would still bound how much tainted volume can become spendable reserve. I leave it out for the canon reason, not because it is useless.

## 7. Protocol changes

### 7.1 Held payment envelope

Today the final layer of the envelope always carries the secret (`core/protocol/htlc/codec/onion.ts:24-28`), so the buyer could claim at once. The held payment spec §3.1 to §3.4 makes the secret optional and adds the `held` outcome. That part is unchanged here.

### 7.2 Hop timelock step

Each hop's timelock is 10 seconds shorter than the previous one (`core/protocol/htlc/utils.ts:73-84`, `HTLC.MIN_TIMELOCK_DELTA_MS`). An ordinary recipient claims immediately. A held one may claim in the last moment of its leg, leaving the hub 10 seconds to claim from the seller or reveal on-chain. The held payment spec avoided this by allowing direct Accounts only.

For this extension the step on a held route must cover a dispute being mined, with margin. `[decision]` The value is per jurisdiction and belongs with `todo.md` item 14, which already asks for real-chain values of the same constants.

### 7.3 Hold visibility and price

A hub's capacity toward the buyer is locked for the whole hold. A hub cannot be asked to carry that blind. Proposed: the route marks a payment as held to each hop; a hub advertises a maximum hold time and a fee per unit of amount and time; payer admission rejects a route whose hubs do not accept the hold. The cost is that the hub knows the payment is an escrow ticket.

### 7.4 Queued defect on this path

`todo.md` item 15: a manual claim does not arm the acknowledgement timer. The buyer's claim in step 4 is a manual claim.

## 8. Failure cases

| Case | Outcome |
| --- | --- |
| Buyer never pays | lock expires to the seller; seller's capacity was tied up until then; a bond, if posted, goes to the seller on the arbiter's release |
| Seller gets fiat and goes silent | arbiter gives the buyer the secret |
| Seller gets fiat, arbiter also silent | buyer loses the fiat. Expiry favours the payer |
| Buyer claims, seller will not countersign | hub disputes with the secret; the contract settles the clause |
| Hub stalls after the buyer claims | buyer disputes its Account with the hub. Collateral in that Account pays out; anything above it is taken from the hub's reserve and then becomes a debt row |
| Buyer received on credit and the hub never collateralises | the buyer holds an unsecured claim on the hub |
| Hub never forwards the lock | buyer sees no lock and does not pay; seller's lock expires |
| Fiat is reversed after release | outside the protocol; a matter for the service and the bank |
| Arbiter gives the buyer the secret without fiat | seller loses the USDT |
| Arbiter and hub collude | the hub claims from the seller and lets the buyer's leg expire |

## 9. Limits

- **The arbiter must not be a hop.** A hop that knows the secret can claim upstream and never pay downstream. This is my reasoning from how the locks work. `[unverified]` by test.
- **The arbiter is trusted to decide.** Alone it cannot take funds. With either trader, or with the hub, it can direct them.
- **A buyer with no USDT cannot post a bond.** Unless the hub posts collateral before the lock, that buyer has paid fiat against an unsecured claim on the hub. The secured ticket in §5 removes this at the cost of hub capital and an on-chain deposit per new buyer.
- **32 locks per Account** (`MAX_ACCOUNT_HTLC_LOCKS`) caps concurrent tickets per trader and hub.
- **Not atomic.** The fiat leg is observed by people. The protocol cannot see a bank transfer.
- **Routes longer than one hub** multiply the hold cost and the timelock step. The first version should allow one hub, or two where buyer and seller use different hubs.
- **The walk-in buyer's exit is public.** A withdrawal from the Depository shows amount and time on-chain. Privacy holds between parties who stay in their Accounts.

## 10. Where it sits against canon

- No contract change. No release-scope change.
- Screening and intake are hub policy, as canon requires.
- The held payment, the hop step and hold pricing change the payment path and need the owner.
- The ticket, the arbiter and any client are a third party's layer and do not belong in the protocol's queue.

## 11. Scope

I describe mechanics for sellers who receive fiat into accounts in their own name. I do not design for third parties operating bank accounts on a desk's behalf.

I do not design a path whose purpose is to make flagged funds pass screening. Intake in §6 exists so a hub can refuse them.

## 12. Unverified

- How any analytics vendor scores the Depository contract.
- How Husher's providers generate and empty deposit addresses; I read its documentation and placed no order.
- Whether the runtime lets a hub post collateral into an Account unprompted, and what a secured ticket costs the hub on-chain.
- Per-trader intake addresses on TRON: activation and energy costs were not looked at.
- The hop-collusion argument in §9, and every `[build]` item: none is implemented or tested.
- Whether any hub operator would carry holds at a price traders would pay.
- The legal position of a hub running intake, or of an arbiter, anywhere.

## Sources

- The repository at `30f204a`: [xlnfinance/xln](https://github.com/xlnfinance/xln).
- Husher documentation, read 2026-11-13: [deposit handling](https://docs.husher.io/documentation/how-husher-works/how-it-works/deposit-handling-and-execution-tolerance), [role separation](https://docs.husher.io/documentation/how-husher-works/how-it-works/role-separation-and-custody-boundaries), [architecture](https://docs.husher.io/documentation/how-husher-works/how-it-works/high-level-architecture), [provider role](https://docs.husher.io/documentation/security/security/exchange-service-providers-esp-role), [terms](https://www.husher.io/terms-of-service), [AML policy](https://www.husher.io/anti-money-policy). The operator's own description.
- [How Does Binance P2P's Escrow Service Work?](https://www.binance.com/en/blog/all/how-does-binance-p2ps-escrow-service-work-421499824684900825)
- [crypto.news: OKX warns high-risk deposits may trigger reviews](https://crypto.news/okx-warns-high-risk-deposits-may-trigger-reviews/)
- Vendor pages on desk practice: [BlockSec](https://blocksec.com/blog/otc-desks-usdt-freeze-playbook), [TRONSEC](https://dev.to/tronsec/tainted-usdt-on-tron-aml-graph-risk-for-p2p-otc-and-cex-deposits-4gip).
