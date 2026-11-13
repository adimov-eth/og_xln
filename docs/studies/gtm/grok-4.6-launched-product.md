# Launched product

- **Whose vision:** grok-4.6, Grok Build CLI, `2026-11-13`
- **Status:** one person's picture of a launched object. Not owner canon. Not `todo.md`. Not `AGENTS.md` RELEASE SCOPE.
- **SHA this was written against:** `019d45beb`

This is the product I would ship. The four-flow public network is a different object. I do not ship that object.

---

## 1. What it is

A **USDT credit book** owned by one legal person (Egor, or a vehicle he funds), recorded on one XLN Account, on Ethereum.

XLN is the machine that keeps that book: signed obligations, exact money, dispute, exit. It is not the product customers buy. They buy days of USDT they did not have to prefund, against a named limit, with a retained signed frame if the relationship breaks.

On launch day there are two Entities and one Account. There is no network. There is no second corridor. There is no token. There is no public landing that says “payments for AI agents.”

Call the operator **the Desk**. Call the other side **the Name**. Those are the only two users.

---

## 2. Who it is for

**The Name** is one unaffiliated firm that already sends or receives USDT with the Desk on a live commercial flow. The name comes from a phone, not from a segment. If that name does not exist, there is no product to launch.

**The Desk** is the creditor. It posts principal. It sets `creditLimit`. It runs the hub, the watchtower, and the hosted replica for the Name until the Name can run their own. It eats default.

Nobody else has an account. There is no self-serve. Mainnet is not open.

---

## 3. The object

One bilateral Account. USDT. Ethereum. Same jurisdiction.

- Left/right are the two Entity ids, lexicographic, as the machine already requires.
- The Desk grants a **bounded unsecured limit** toward the Name, sized to a real recurring need (working-capital days, not a demo $100).
- Collateral in Depository is optional and named in the intent: either the Name locks some, or they do not. The product is the unsecured sleeve. Collateral is a reduction of the Desk’s tail, not the sales pitch.
- Every payment is an AccountTx through the canonical paybook. No swap. No cross-J. No lendbook pool. No `xln/charge`.
- The economic unit is **credit-days**: the Desk charges for days the limit is drawn, in the same way a payout financier charges 1–5 day money. Platform bps on notional are not the tariff.

MML on launch is the obligations on this one commercial edge. Affiliated hops do not count. Two of Egor’s Entities do not count.

---

## 4. A day in the product

Morning. The Name needs to pay a recipient. They do not wait for their inbound USDT. They draw on the Account. The Desk’s limit covers it. A signed Account frame exists. The Name’s customer got paid.

Within the agreed window (days, not blocks) the Name replenishes. The drawn amount falls. Credit-days accrue to the Desk.

If they do not replenish: the Desk has the last signed state. Watchtower is live. Dispute on Ethereum is a real button, not a slide. Exit is a real button. The Name knew this on day one. The first dispute is part of the product, not an embarrassment. The code was always written for that reader.

If they do replenish, nothing public happens. No dashboard of exposure. No `DebtCreated` as marketing. The row exists on chain when it must. The pitch is private.

That is the whole product. Repeat.

---

## 5. Capital

The Desk writes the check. USDT into Depository, enough to honour the limit plus dispute gas plus a buffer for one failed exit. Size is the Name’s real band, not a protocol cap and not “open to anyone with their own funds.”

Outside LPs, MMs, hub-operators-as-a-market, HLP vaults, points, airdrops: absent. Attracting other people’s inventory onto an empty book is not a launch step. If this book later has a track record, others may be invited **into this warehouse**. That is a later product.

Hedge sits on the Desk. If the Name’s flow is Tron-leg and the Account is Ethereum USDT, the Desk warehouses basis the way a payout desk already does. USDT0/Relay remain how the Desk moves coins when the Account is the wrong rail. The Account does not replace the rail. It replaces the undocumented credit sleeve next to the rail.

---

## 6. What you see

Two seats. React `ui/` only.

**The Name** sees: one Account, limit, drawn, due, last frame hash, a pay control, a repay control, dispute/exit status, a human-readable history of *this* Account. Not a graph of the universe. Not agent 402. Not swap tickets.

**The Desk** sees the same plus: principal posted, credit-days accrued, watchtower liveness, replica health, gas for dispute.

Import that takes 32 seconds is unacceptable for this object. Launch does not wait for a 1,000-user wallet. It needs two people to sign. Session/hardware signer for those two is in the launch, or the product is a CLI the Desk already runs and a hosted signing flow for the Name. The public wallet slogans are out.

The Name does not have to operate a sovereign Runtime on day one. The Desk hosts their replica. Their keys stay theirs. Hosting is an operational fact of a two-party book, not a protocol religion. When they want to run it themselves, they can: the state is in the frames.

Svelte `frontend/` stays a static site. It does not sell this product as “the Lightning Network of all value.” If it says anything, it says the Desk exists and is not taking public deposits.

---

## 7. What the chain is for

Ethereum is the dispute and the reserve, not the payment hop.

Ordinary activity is agreed by the two replicas. J holds collateral and the transformer ABI. Dispute gas is assumed; tickets below a serious multiple of that cost do not belong on this Account. The Desk does not onboard micropayments.

Contracts stay what they are. Launch does not wait for a completed external audit of 6k lines. The Name is told, in writing, that the bytecode is UNLICENSED and unaudited, that Depository is a pooled address and can be frozen as one object, that the Desk is the creditor, and that unsecured remainder is debt. If that disclosure kills the Name, the product is dead and that is a valid death.

A priced audit (named firm, who pays, wait) can be a condition of a *second* Name. It is not a condition of sitting down with the first if the first already takes Telegram risk with the Desk.

Runtime licence (AGPL) and contract licence (UNLICENSED) are stated to the Name on day one. The Desk grants whatever they need to run a replica. This is owner paperwork, not engineering.

---

## 8. Operations

One hub: the Desk. Not three independent operators. Independence is a later political fact, not a launch requirement.

Watchtower: the Desk, for both sides, at launch. The Name can add their own later. Absence of a second tower is disclosed.

Recovery: checkpoint plus WAL, as the machine already does. A crash of the hosted replica does not invent balances. The signed frames are the book.

There is no 1,000-user TPS number attached to this product. There is no soak-as-GTM. There is no native TRON headline. There is no cross-swap. There is no pooled savings bank. Those are other products. Shipping them as P0 is how this one never launches.

Sepolia exists as the rehearsal of *this* Account: fund, pay, repay, dispute, exit, recover. Not as a catalog of all tx kinds.

---

## 9. What is not in the box

- Pay / Swap / Cross-swap / Lending as a public matrix
- Native TRON as a launch rail
- AI-agent homepage and MPP as GTM
- Open mainnet, invite-free, “bring your own funds”
- Three hubs, two contracted MMs
- XLNC, points, airdrop
- Companies / IPO / Entity share trading
- BrainVault as a door into this book (it may ship separately; it does not prove this Account)
- Live exposure dashboards, assignable debt, public default as marketing
- Fee schedule of 1/3 bp competing with Bitfinex 0 and Relay ~1 bp

If a later Name demands TRON or swap, that is a second product, staffed after this Account has MML > 0.

---

## 10. Legal shape

The Desk is a lender / payout principal, not a permissionless protocol. Credit and holding the Name’s collateral (if any) sit in a money-transmitter / lending perimeter depending on where the two firms are. That is a lawyer’s hour before the first $10k, not an LLM’s. If the answer is “you need a licence,” the vehicle is formed or the launch stops. It does not proceed as “open source, users bring funds.”

The Name’s customers are the Name’s customers. The Desk does not take retail deposits. Savers in a common pool are a bank. This launch is not that bank.

---

## 11. How it is allowed to grow

Only after this Account has a track record the Desk can stand on (repeated draw/repay, at least one recovery drill, money that is real):

1. **Second Name**, same asset, same chain, same Desk book. Still the Desk’s principal.
2. **Warehouse:** if the strategy (credit-days minus defaults minus hedge) is a number, invite outside capital *into this book*, HLP-style: they share this PnL, they do not invent a new MM market. Caps, lock, disclosure.
3. **Distributor cut:** if some interface already has the Name’s clerks, pay that interface from the Desk’s take, builder-code style. Do not recruit Phantom to sell Accounts.
4. **Self-hosted Name:** they run their Runtime. The Desk remains the creditor until someone else posts principal.

HIP-3 / “AWS of liquidity” is not on this map. That is Hyperliquid chapter three, after a liquid perp market. This object never becomes that unless it first becomes a book people already use.

---

## 12. Launch is this sentence

> Egor’s vehicle extends a named USDT limit on Ethereum to one unaffiliated firm it already transacts with, recorded on one XLN Account, with dispute and exit live, charging credit-days, hosting what the firm cannot yet host, disclosing the bytecode.

If that sentence cannot be true, the product is not launched. Everything else in the repository can keep running as a lab.

---

## 13. Death

The product is dead if:

- there is no Name in the phone, or
- the Name will not sit on unaudited bytecode and will not name a priced audit, or
- the Desk will not write the check, or
- the only draw is affiliated, or
- the first real dispute cannot be executed.

Then what remains is literature, a deterministic engine, and optionally BrainVault as a one-player tool. Those are not this product.

---

## 14. Relation to the machine

RJEA, Hanko, WAL, exact replay, fail-closed reject policy: keep them. They are why the book is a book and not a spreadsheet. They are not why anyone sits down.

The launched product uses the smallest surface of that machine that a two-party credit sleeve needs: Entity, Account, pay, collateral, dispute, exit, recovery. The rest of the catalog waits.

This is a bank with a very good memory, two customers, and one jurisdiction. I would launch that.
