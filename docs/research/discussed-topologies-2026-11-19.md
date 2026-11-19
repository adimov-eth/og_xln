# Discussed topologies

Date: 2026-11-19. Status: discussion record.

Related (added 2026-11-19): the prose walk of the same surfaces in
[`surfaces-grok-4.7-2026-11-19.md`](../studies/gtm/surfaces-grok-4.7-2026-11-19.md)
and the strategic reading of T3, T4 and T7 in
[`strategic-assessment-2026-11-19.md`](../studies/gtm/strategic-assessment-2026-11-19.md).

This file formalizes the topologies examined in that discussion. It does not
amend [UFT](../core/10_UFT.md), the [RCPAN invariant](../core/12_invariant.md),
or the [accepted launch design](../launch-design.md). Where a bound is quoted,
the invariant document decides. Clauses the jurisdiction can evaluate are
Payment, Swap, Pull, and TermLoan. Hand ranking and an arbitrary English
predicate are not clauses.

## Shared geometry

```
Vertex   J | E | A | pile | clock | external
Edge     hyperedge over n vertices, n ≥ 1
Mover    subset of vertices whose signature admits a transition
Δ        Left's allocation; Left = lexicographically lower Entity id
C        collateral on that asset
Lₗ, Lᵣ  leftCreditLimit, rightCreditLimit
```

Orientation and the three regions are fixed by the invariant:

```
Δ = ondelta + offdelta
−Lₗ ≤ Δ ≤ C + Lᵣ

Credit-only:      −Lₗ ≤ Δ ≤ Lᵣ
Collateral-only:    0 ≤ Δ ≤ C
Reserve-credit:   −Lₗ ≤ Δ ≤ C + Lᵣ
```

Δ < 0 and Δ > C are unsecured claims. Only a party's share of actual collateral
is secured. A credit limit is the grantor's accepted risk, not a repayment.

J enforces a signed claim, a collateral allocation, and a named condition. J
does not read cards, a shop sticker, or the absence of a vertex. Ordinary
activity stays on the account. J is reached for registration, collateral, net
settlement, and dispute.

Two slots recur and are not the same object:

```
slot-a   a vertex the payout predicate requires, which does not exist yet
slot-b   a name a release requires, which has not been written yet
```

J can see a written name. J cannot see a missing body.

## T0 — Substrate

The existing economy, before any product cut.

```
(hyperedge economy {J, E*, A*})
(account Aᵢ) = bilateral (Eₗ, Eᵣ) ordered by Entity id
(local Aᵢ)   ordinary signed transitions
(J-visible)  = registration ∪ collateral ∪ net-settlement ∪ dispute
```

A dispute is between the two parties of one account. It closes that account.
It does not, by itself, close any other account that shares an entity.

Preserved tension: provable accounts are the mission; turnover of completed
operations is not the measure of coverage. A useful night can be evidence that
an account happened and still be invisible to the count.

## T1 — Room

The cheap shape. Many deltas inside an account that is already open.

```
(hyperedge room {Eₗ, Eᵣ, A})
(transition δ) : A → A     ; off the chain
(cost (δⁿ))    ≈ cost of one later settlement, not n chain transfers
```

What makes it cheap is repetition against the same counterparty, with the
principal staying in the room. A single delta that is then settled is the
envelope in T2, paid once for one economic act.

## T2 — Chain envelope

One on-chain act. Collateral allocation (`reserveToCollateral` inside the
batch), cooperative settlement, and dispute are each heavier than one token
transfer. A packed batch can share the envelope across many pairs; the share
is an artifact of packing, not a cheaper per-pair primitive.
`externalTokenToReserve` wraps a transfer and then the batch.

```
(cost transfer) < (cost R2C) < (cost cooperative-settlement)
(cost dispute)  = f(|payments|, assets)    ; one-asset exit is already large
```

No topology in this file becomes cheap by moving its decisive step on chain.
The cheap copy of a topology is the one whose decisive step is a T1 transition.

## T3 — OTC corridor

The accepted launch surface. Degree 2. Inventory belongs to the house.

```
(hyperedge otc {house, customer})
(inventory) = house
(assets)    = USDT·Tron × USDT·Ethereum
(fill)      = quote(house) → customer receives the other asset
(third vertex required?) = no
```

The customer faces the house. After the fill, nothing in the topology demands
another customer. A treasury desk with a recurring flow on the two chains is
the customer the launch design names. The spread, if any, is the price of not
using a bridge or an exchange withdrawal. Rebalancing the house inventory is
inside the edge. There is no stranger's resting size to hit.

Preserved tension: the surface is executable because the other customer was
deleted. Deleting that vertex also deletes the source of a crowd's spread.
"Output still sits in the account" does not add a vertex.

## T4 — Book

Degree n. Inventory belongs to whoever rested it.

```
(hyperedge book {taker, maker₁, …, makerₙ})
(hit)     = taker takes makerᵢ's resting size
(makerᵢ)  ≠ house-as-sole-inventory
```

The THB/USDT instance is a licensed exchange book: the bid is someone else's
baht, and the proceed can become a bank balance. The venue's licence is the
price of that crowd. A dealer who has just taken USDT and paid baht elsewhere
is a taker on this book, not the book.

```
(dealer-refill) = (otc or sink on the way in) then (book on the way back)
```

Preserved tension: an exchange licence on an empty book is still T3 until a
maker vertex exists. The crowd is not purchased with the paid-up capital.

## T5 — Stay and leave

A predicate on the output vertex, not a third product.

```
(stay? output)  = output remains a vertex of the recruiting component
(leave? output) = output is spent into a sink, or the customer has no further
                  edge that requires another vertex
```

T3 is a leave even when the received tokens remain credited: the recruiting
component gained no vertex. A stay is T4 or T7, where the fill or the stack
is what the next vertex came for.

```
(stay (fill against house-inventory)) = false
(stay (fill against stranger-size))   = true
(stay (stack left in a shared drawer)) = true
(stay (proceeds paid to a non-vertex)) = false
```

## T6 — Guarantor

A lock with a named presenter. The principal does not hold a veto.

```
(hyperedge guarantee {principal, beneficiary, presenter, pile, clock})
(pre-deadline mover) = {presenter}
(post-deadline)      = clock → principal
(presenter)          = beneficiary            ; first demand
                   or {beneficiary, inspector} ; inspector signs, does not open
```

The principal cannot stop a demand that the lock already named. Showing the
bytes is not the release. Before the deadline the tokens move only on the
named signature. After the deadline the clock returns them, and nobody has to
prove the other side failed. A watchtower does not open the dispute. Either
account party may. A tower may answer late only if appointed.

J checks the signatures. J does not check the English the signatures were
about. If the presenter is the house and the beneficiary was unbound at lock
time, this is the pot in T7, not a stronger object.

## T7 — Cashier

Two piles. Silence is a different transition on each. This is the cash-game
drawer: the pot is other players' bets, the house signs the result and may
take a rake, the loser does not sign the payout.

```
(bound (drawer i)
  0 ≤ Δᵢ ≤ Cᵢ
  (mover (drawer i)) = {playerᵢ}
  house ∉ mover(drawer i))

(bound (pot)
  Σ bets = Σ releases
  (named-key pot) = house
  (release pot) =
        (sign house → beneficiary)       ; beneficiary unbound at bet-time
      ∪ (silent house ∧ clock → bettors))

(not-an-input cards)
(valid (sign house → cousin))

(hyperedge hand {bettors, house, pot, clock}  cards ⊥)
(hyperedge table {seated}
  (payable? (≥ |seated| k)))

(rake (slice pot → house) | (sign house))
(clock-refund ⇒ rake = 0)
(cousin-release ⇒ rake > 0)
```

Transitions:

```
bet        drawerᵢ → pot          mover = {playerᵢ}
           names house as release key
speak      pot → designated E     mover = {house}
           designated E may be the winner or the cousin
silence    pot → bettors          mover = {clock}
sit        slot-a becomes playerᵢ ; a drawer edge appears
leave      drawer edge survives until withdraw
withdraw   playerᵢ moves own drawer ; house signature not required
```

Accounts are bilateral, so the drawer is one account per player against the
house, not one pile shared by the table. A dispute closes that player's
account. It does not close the other drawers. A single shared pot account
among all players is a different topology (T8 with quorum = all) and is not
this one.

What remains trusted is one hand's pot. What is refused is the house editing
the drawer between hands, and the house holding the night by saying nothing.
The cousin signature is valid execution: the machine pays the name the key
wrote. The table can see it. The machine will not consult the cards.

The rake is paid for the act of writing the name, whatever the name is.
Silence pays the players their bets back and pays the house nothing.

Cases inside this topology: a cash game; a club whose tables share one drawer;
a private game whose cashier used to be a person; a commissioner holding a
season's buy-ins. A pit where every bet faces the house is T3, not T7. A
payroll is T11 only when the payee must be a vertex; the payer is already
chosen, so slot-a is not a stranger the sitting parties need.

Preserved tension: the clubs whose players do not trust the drawer are the
ones least eager to offer an exit the player can force. The clubs whose
players already trust them make the signatures look like ceremony. The
topology does not decide which club sits down.

## T8 — Multisig collapse

One pile, one quorum. Each choice of quorum destroys one T7 invariant.

```
(multisig one-pile quorum) ⇒
    quorum = all players     → loser holds the pot
  | house ∈ quorum(drawer)   → silence freezes the drawer
  | quorum = {house}         → the drawer is the pocket
```

A multisig verifies that a set of keys agreed to one transfer. It does not
store a stack across a night, and it has no clock that returns a bet the
house will not resolve. T7 is not a multisig entity that is "better because
it verifies." The verification is the refusal already in force: which key
may move which pile, and what silence does.

## T9 — The two slots

```
(slot-a empty-chair)   vertex absent ; table payout waits on |seated| ≥ k
(slot-b beneficiary)   name absent   ; pot release waits on (sign house)
(slot-a ⊥ slot-b)
(J sees slot-b)
(J blind slot-a)
```

Slot-a is why a short table recruits. The people already sitting cannot be
paid the game until the missing body exists. That recruitment is inside one
cashier. It does not, by itself, move anyone off another cashier.

Slot-b is adjudication. The clock can close it by erasing the hand. Nothing
closes slot-a except a body.

UFT sees slot-b and the collateral-only drawer. It does not see slot-a, the
rake as a business, or the scar that makes a player prefer this drawer. Those
are properties of T7 as a night. They are not properties of the bound.

## T10 — Sink

An edge whose head is not a vertex of the recruiting component.

```
(hyperedge sink {inside → external})
external ∉ vertices
(stay? (proceeds of sink)) = false
```

The Thai sticker is this edge. The shop's PromptPay identifier is inside the
QR. The shop never becomes an E. The customer does not need a second chair.
The baht bid that refills the payer is T4, on a book the payer does not own.
Every scan makes the payer a taker on that book.

Economic parameters of standing up the payer, not part of the topology. Rate
used: 33.94 THB per USDT on 19 Nov 2026. The e-money floor is 100,000,000 THB
of paid-up capital. The dealer-with-custody floor is 50,000,000 THB. Dealer
application plus upfront licence fee is 1,030,000 THB. If one company holds
both and the same equity satisfies both floors, the lock is the e-money
floor, about 2.95 million USDT, plus about 30,000 USDT of fees that must not
drag equity under the floor. If the floors are two cheques, the lock is
150,000,000 THB, about 4.42 million USDT. The notification that raised the
digital-asset floors was not opened; the figures are the contemporaneous
readings of that amendment. Net capital of 25,000,000 THB for a custody
operator is inside the paid-up number, not a third cheque. Customer funds are
not the payer's investment. Held as baht, the equity can be the pile that
pays the sticker before the USDT is sold.

The documented scan debit, from the ScanPay page only: a call creates an
order, debits the merchant's USDT balance, and transfers to the payee account
encoded in a PromptPay string. The sample info body is 32 THB, order amount
1.0043942247 USDT, fee 1 USDT, rate 31.86, with payee fields null. Submit's
sample status is 22, which the order-status enum names Processing. The
order-type enum names `proxy_pay` as cryptocurrency scan-to-pay. The query
sample that uses `proxy_pay` is an ETH testnet transfer. Those two writings
disagree. The baht sender is not named. Deposit of USDT is an earlier,
separate call. No topology here may treat that unnamed sender as a licensed
Thai vertex or as the absence of one.

Preserved tension: the sticker is preinstalled distribution, and the head of
the edge is outside the vertex set. Adoption of the sticker does not adopt
an account. The account is optional ingress into a company that can run the
sink without it.

## T11 — Inside payment

The sink's head is forced to be a vertex.

```
(hyperedge pay {payer, payee, drawer})
payee ∈ vertices
(stay? (balance of payee)) = true
(slot-a) = the next payee, already named by the debt
```

A supplier, an employee, or a merchant who must be inside the wallet to be
paid. Their balance can pay the next named person. The USDT/THB conversion is
the door in and the door out, not the room. This is not T10. T10 was chosen
exactly so the shop would not have to be a vertex.

Slot-a here is named by an existing obligation. It is not a stranger the
sitting parties need before they themselves can be paid. Recruitment is
weaker than T7's empty chair for that reason.

## T12 — Credit remainder

The region UFT will not secure. Present so the other topologies cannot absorb
it by silence.

```
(unsecured) = (Δ < 0) ∪ (Δ > C)
(J enforces the signed claim)
(J does not create the missing collateral)
(insolvent drawer) remains insolvent after dispute
```

A house that pays the winner from his own pocket and collects later is in
this region. T7 avoids it only while every release is a redistribution of
bets already in the pot. The moment the house fronts the pot, T7 has grown a
T12 edge, and the cousin problem is joined by a solvency problem.

## Adjacency

The topologies are restrictions and gluings of T0. They are not a menu that
collapses into one product.

```
T1  ⊂  T0          repeated local δ
T2  ⊄  T1          the chain step is the expensive complement
T3  =  degree-2 cut of T0, inventory = house
T4  =  degree-n cut of T0, inventory = maker
T5  =  predicate on the output vertex of T3, T4, T7, T10
T6  ⊂  T7          when the presenter writes an unbound beneficiary
T7  =  collateral-only drawers  ⊕  one named-key pot  ⊕  clock
T8  =  T7 with the two mover-sets identified
T9  =  the two waits inside T7; only slot-b is J-visible
T10 =  T0 with an edge into a non-vertex; refill is T4
T11 =  T10 with the head forced back into the vertex set
T12 =  the complement of the collateral-only segment
```

What the discussion held open, and this file does not close:

- T3 can be shipped without a third vertex, and then has no crowd's spread.
- T7 fixes the drawer and correctly pays a cousin.
- T10 spreads along a rail that never adds a vertex.
- Slot-a recruits inside a night. It does not choose the cashier.
- J's question is whether the obligation is collateralized and whether the
  signature was the named one. The empty chair is a different question that
  happens to share a drawer.

## Reading

The adjacency above is formally true and it flattens the only distinction
worth staking. T3 and T7 are written as two restrictions that differ by which
vertices were deleted. They are the same emptiness. T3 is executable because
no third vertex is required, and empty because no third vertex is required.
T7, laid on a night that does not exist, waits the same way. A full drawer
with nobody sitting and an empty quote are one disappointment.

The machine is competent on one side of T7 and blind on the other. It can
refuse the house the drawer. It can pay the name the house writes, cousin
included, and pay the rake for the writing. It cannot see whether a chair is
empty. It cannot remember that this house named a cousin on a previous hand.
Slot-a and the house's reputation occupy the same blind half. The clock makes
silence unprofitable, so a rational house always speaks. Nothing in the bound
makes the speech true. Across a night the only accumulator is the players'
feet, and the feet are off the rail.

The topology does not grow a table. A table that already has bodies can lay
its drawer here. The scar is the reason they would bother: the cashier has
already been a person, and the players have already watched that person fail.
A table that does not exist is not summoned by the two mover-sets. A treasury
desk is not this. A sticker is not this. A club that is already trusted makes
the signatures ceremony. A club whose profit is the freeze will not offer an
exit the player can force. The remainder is small. The protocol does not
recruit it. The protocol waits for it to sit, then refuses the drawer to the
house. That is the whole of the machine's part. The rest of the night is
theirs.

This section is a judgment on the record above. It does not add a topology
and it does not amend the bound.
