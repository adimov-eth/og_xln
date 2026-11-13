# XLN launched product — synthesis

- **Writer:** grok-4.6 · `2026-11-13`
- **Sources (same day, same tree `019d45b`):**
  - [grok-4.6-launched-product.md](./grok-4.6-launched-product.md)
  - [vision-claude-fable-5-2.md](./vision-claude-fable-5-2.md)
  - [gemini-xln-product-vision-2026-11-13.md](./gemini-xln-product-vision-2026-11-13.md)
  - [codex_launched-product-vision.md](./codex_launched-product-vision.md)
- **Status:** one document. Not owner canon. Not an average. Shared law is stated as law. Forks stay forks, ordered as rungs where a later rung needs the earlier one to exist. Where the four still disagree on day-1, the owner decides; this file names the decision.

Consensus among four models is not evidence. Overlap here is treated as **constraint from the same repo and the same 2026 substitutes**, not as confirmation.

---

## 0. One sentence

**XLN launches as a Clearing Account: one principal, one hub, one bilateral book, signed obligations you can exit without asking — not as an open four-flow network.**

The machine is RJEA. The product is the book. Customers buy a completed money outcome under terms they can inspect. They do not buy a protocol.

---

## 1. Shared law

All four visions, independently, kill the same object and keep the same skeleton.

**Dead on arrival**

- Three independent hubs and two contracted MMs before the first unaffiliated obligation (`launch-pilot.md`, `todo.md:52-54`).
- Pooled savings / term-loan bank as a launch surface (`lend.md` UI, Gemini; Fable beta-only; Grok out; Codex keeps lending as a *relationship* but not as the first click).
- “Payments for AI agents” as the public title (`+page.svelte`). `xln/charge` stays an adapter.
- Platform bps as the wedge (1/3 bp vs Bitfinex 0 / Relay ~1 bp). Launch take-rate is **spread, credit-days, or a flat hub fee** — not a protocol tax on empty pipes.
- Token, points, airdrop as demand.
- 1,000-user TPS, Rust parity, XLNC, companies/IPO as launch gates.
- Attracting outside LP/MM inventory onto a book with no utilization record (Hyperliquid HLP and Relay vaults: chapter three, after the founder was the book).

**Alive on arrival**

- **One operator-principal on day 1.** Hub 0 / the Desk / the anchor / Codex’s associated operator are the same topology: a star, not a mesh.
- **One job**, not a catalog. Breadth is how the 2026-10-11 crisis review happened.
- **Identified capital.** Someone’s USDT is in Depository. Losses have a name.
- **Bounded credit** is the non-dominated cell versus Permit2, Safe+spreadsheet, USDT0, Relay, ClearLoop-for-the-large. Atomic RFQ needs full funding per trade. A spreadsheet does not hold at API frequency. Unsecured remainder is debt, not a guarantee (`owner-profile.md`).
- **Unilateral exit** with the last signed state is the reason to use the machine instead of chat.
- **MML** counts the unaffiliated commercial edge once. Affiliated Entities, retainer-paid volume, and hub hops do not count.
- **Recovery is a user journey**, not a slide: evidence, tower, dispute, residual debt, time and cost reported separately (Codex §9, Fable §4, Grok §4).

That is the product frame. The rest of this file fills it without smuggling the catalog back in.

---

## 2. The object

A **Clearing Account** is one XLN Account between a **Principal** and a **Name**.

| Field | Launch value |
|---|---|
| Topology | One hub, star, no routing between Names, no HTLC path |
| Users | Principal + Names the Principal already transacts with. No self-serve. No open mainnet. |
| Asset | One stablecoin first (USDT unless a signed Name names another) |
| Chain | One EVM chain with Ethereum-style receipts. Which chain is an owner decision (fork A). Native TRON is not day 1 unless fork A is explicitly TRON *and* `todo.md` item 3 is green on that bytecode |
| Admission | Direct payment, credit limits, collateral in/out, cooperative settlement, dispute, exit. Same-J swap only on rung 1. Cross-J, hash-ladder, pulls, lending admission: off |
| Depository | **One deployment per hub** (Fable `fable-p4`). Pooled-with-the-world freeze is not acceptable. Per-pair clone only if a Name requires it |
| Tariff | Credit-days and/or the Principal’s spread. XLN platform fee = 0 for the first period, then a **flat monthly hub fee**, not per-trade bps (Fable §6, Gemini §2). Distributor share only from the Principal’s take after there is take (builder-code *shape*, not Phantom-on-day-1) |
| Completions | Internal Account obligation ≠ external chain delivery. The receipt says which (Codex §3) |

**Economic unit:** days of working capital not prepaid, and/or net settlement of two-way flow so that gross chain tax is paid on the residual. Both are “trade now, settle later, loss bounded and collectable without asking” (Fable §1). One-way residual still needs destination cash. Netting does not mint USDT (Codex §8).

---

## 3. Who is the Principal — sequenced fork, not a blend

This is the only day-1 question that actually forks the four documents. It is not solved by shipping all three.

| Order | Principal | When this is the launch | Source |
|---|---|---|---|
| **P0** | **Owner’s vehicle (the Desk)** | A Name exists in the phone: an unaffiliated firm the owner already sends or awaits USDT with | Grok |
| **P1** | **Paid anchor** (MM / RFQ desk) | No Name in the phone. One firm signs terms naming ≥3 of *its* counterparties, two tokens, chain, integration owner. Owner pays a **flat retainer**, software, tower, and a contract review — not per-trade bounties | Fable |
| **P2** | **Hub 0 as corridor inventory** | Neither P0 nor P1. The signed demand is conversion/payout (TRON energy, Arbitrum USDC → TRC-20), and the owner is willing to warehouse both legs and rebalance | Gemini |

**Rule:** try P0, then P1, then stop. P2 is a payout desk that may *use* XLN as its ledger. It is not “the network.” It competes with USDT0, Relay, Energy rental, and FixedFloat on a job they already do. Gemini’s own day-45 kill applies: live quotes and still fewer than three unaffiliated firms funding even a small live payout → freeze the corridor rather than add features.

Codex’s “associated operator plus independent hubs” is P0/P1 with independence postponed. Do not relabel a single operator as three (Codex §7, Fable D005).

**Owner capacity** behind someone else’s flow (Fable ladder; Gemini float) is credit to that Principal. Optional, capped, named. It is not a second hub.

If P0, P1, and P2 all fail their signature tests, launch does not happen. The repository remains a reference implementation of provable bilateral accounts, with public dispute drills as the demonstration (Fable §11). BrainVault may ship as a one-player tool. That is not this product.

---

## 4. A day

The Name needs money to move before inbound funds have landed, or needs to net many tickets against one Principal instead of paying chain tax on each.

They draw on the Clearing Account up to the signed `creditLimit`, or they swap two admitted tokens inside the Account against the Principal’s posted inventory (rung 1). A signed frame exists. If the recipient is another XLN Entity, completion is the obligation. If the recipient is an external address, completion is the chain tx the Principal actually sent — a different sentence on the receipt (Codex; Gemini payout-on-behalf is **rung 2**).

They replenish inside the agreed window. Credit-days and/or spread accrue to the Principal.

If they do not: last signed state, live tower, dispute and exit are buttons. The first dispute is in the product. Public `DebtCreated` is not marketing.

The next operation is cheaper because the relationship already exists. Repetition must not silently widen credit (Codex §3).

---

## 5. What you see

Codex’s three places, Gemini’s three screens, Grok’s two seats — same product, stripped.

**Home (Clearing).** What can I use now. Two numbers, never one: **Secured principal** (Depository collateral, unilaterally recoverable) and **Available credit** (bounded, unsecured remainder = debt). Netting meter is allowed as a *measured* saving against the alternative rail, not as a slogan.

**Activity.** What happened. One persistent operation id. Status, debit, recipient, completion condition (internal vs external), cost breakdown. Closing the browser resumes the same operation (Codex).

**Safety.** Proof bundle download, tower heartbeat, one-click exit with a **published dispute floor** for this chain: `floor ≈ 100 × dispute gas × stressed gas price` (canon `rejected-ideas.md`; Fable §7). Below the floor the UI says: this Account is unsecured credit to the Principal.

No EntitySwitcher, Formation, BankLending, ManualSwapRoutes, ReceiveCapacity on the primary path. Svelte landing does not sell Lightning-of-all-value. One sentence:

> **A signed account with a named principal. Draw, net, exit without asking.**

**Onboarding.** Two people must be able to sign. 32.1 s receipt-scan import must not block first paint: hub-attested snapshot first, chain-verify in the background, badge honest about which (Gemini §3.2; Fable keeps the reader fix because every Runtime uses it). Session / Agent key for hot frames; cold wallet for funding. ERC-1271 Safe as board is in the contract; hot operational key at API frequency is unverified end-to-end (Fable §12) and is a launch engineering item for P1.

The Name need not run a sovereign Runtime on day 1. The Principal may host the replica. Keys stay with the Name. Hosting is disclosed.

Enthusiasts can expand any operation into route, collateral, unsecured sleeve, proof freshness, deadlines (Codex §4). That expansion is why XLN is not an interchangeable transfer widget. Hiding it hides the only reason to choose this machine (Codex §17).

---

## 6. Capital and price

**The Principal posts inventory and grants limits.** Outside LPs do not. HLP-style warehouse (others share *this* book’s PnL) is rung 3, after a utilization record.

**Credit price (proposed, owner-decision):** on the order of **3 bp per day on drawn unsecured credit** (~11% simple annual), charged by the Principal to the Name (Fable §6). It sits between on-chain base lending and reported unsecured desk rates. Grok’s “credit-days” is the same tariff without a locked number. Invoice off-protocol at launch if the tx kind is unbuilt.

**Spread** on two-token or corridor fills is the Principal’s. XLN takes none of it.

**Return on posted inventory** is `credit yield × (drawn ÷ posted)` plus spread. Idle inventory in a quiet Account earns nothing and cannot collateralize a neighbour (`Depository.sol` bilateral collaterals). Size Accounts from the Name’s real tickets. If average drawn credit stays below ~31% of posted inventory after Accounts are sized to those tickets, the credit thesis is wrong for this pair: they are using a prefunded wallet, and atomic RFQ wins (Fable kill 3).

**Gemini’s skew/rebalance/TRX-energy hedge** is the operating manual **if and only if** the Principal is a corridor MM (P2 / rung 2). It is not day-1 physics for P0. Turnover 3×/day and $10M/month MML are not laws; they are Gemini’s hope. Do not put them in the scorecard as gates.

**Contribution** (Codex §13):

> fees and earned spread/credit − funding, hedge, rebalance, settlement, distribution, support, infra, attributable losses.

Capital tied up reported next to contribution. A cheap sticker price on subsidized float is not a business.

---

## 7. Trust package

A Name’s risk memo will ask. Trading-firm Names (P1) need this as a **launch condition**. A phone-Name that already takes Telegram risk with the Desk (P0) may sit on written disclosure; the second Name does not.

1. **Licence.** State what a firm may deploy. Today: UNLICENSED contracts, AGPL runtime, “Open source” on the landing. Pick one story and write it down (all four). MIT on contracts + SDK is Gemini’s proposal; it is an owner legal decision, not an engineering one.
2. **External review of the launch surface.** Depository, Account, Hanko verifier/codecs, bounds/types, payment path; **swap path of DeltaTransformer if rung 1 is live** (Fable corrected himself: swaps settle through the transformer in dispute). Term loans, pulls, hash ladder out of review until admitted.
3. **Enforced cap** on hub-wide exposure. Prose is not a cap (`launch-pilot.md`; Fable). Collides with “no protocol monetary caps” (`AGENTS.md`) — this product **does** cap the Principal’s book. That is a bank control, not a protocol money supply.
4. **Published dispute floor** and **three public disputes** on the same bytecode as funds (`todo.md` item 4).
5. **Tower + recovery drill** with the Principal’s operator (`todo.md` item 8).
6. **Counsel.** Who may operate a hub that holds balances and extends credit, in the two firms’ jurisdictions. Unresearched in the study. Blocks launch. Hour with a lawyer, not a model.
7. **Disclosure, always:** unaudited bytecode, pooled-per-hub freeze domain, unsecured remainder is debt, tower topology, hosted replica if any.

“Confirmed by three AIs” is not a line in a risk memo (Fable §12).

---

## 8. Rungs

Do not ship four rungs on day 1. Climb.

| Rung | What is live | Capital | Climb when |
|---|---|---|---|
| **0 — Book** | One Principal, one Name, one asset, one chain, pay, credit, dispute, exit | Principal’s USDT | Fund, pay, repay, one cooperative settlement, one withdrawal, one recovery drill. MML ≥ 1 unaffiliated |
| **1 — Net** | Same hub, two tokens, same-J swap, partial collateral, utilization record (capacity, drawn, turns, quote availability, completion) | Same, Accounts sized to real tickets | Fable Pilot I: ≥3 Names in one week *or* P0’s one Name repeating; drawn/posted tests the credit thesis; **Kill 4:** Principal would not have given the same limits on a spreadsheet |
| **2 — Corridor** | Cross-J / external payout-on-behalf / native TRON as a *named* demand from a live Name | Inventory on two legs, rebalance, energy/gas | Native evidence on that J; Gemini day-45 style kill on unaffiliated funded payouts |
| **3 — Warehouse** | Outside capital into *this* book’s PnL (HLP-shaped), builder-code cut to an interface that already has the clerks | Second money, after utilization | Net return on deployed capacity beats parking it in base lending over a published window |

Builder codes (Gemini/Hyperliquid) are a **rung 3 distribution shape**: 100% of the *Principal’s* fee slice to the integrator, XLN takes 0 of that slice. They do not acquire Phantom before fills exist.

Lending as Codex describes it (named bank Entity, saver claim ≠ borrower loan) is **after** rung 3, with its own review. It is not Home.

---

## 9. What stays in `todo.md` for this product

Keep: E2E/release green; same-J swap *scenarios* as evidence for rung 1, not as a public matrix; three public disputes; import/reload (shared receipt reader); operations drills; exception classification; review packets as the external-review packet; R2C.

Defer: native TRON as headline; 1,000-user TPS; 2^200 money domain; Rust financial parity as launch; three hubs / two MMs.

Replace: ten conversations → **one dated paid offer** (P1) or **one named intent from the phone** (P0). A refused paid offer is stronger than ten chats (Fable §3).

`rejected-ideas.md` “don’t cut launch scope” is treated as the GTM bug, as in all four visions.

---

## 10. Success

- Unaffiliated MML on the commercial edge. Retainer and owner-as-party disclosed beside the number.
- The Principal invites the next Name **without being paid to** (Gemini/Fable “Client #2”).
- Repeat at a price that covers contribution (Codex 60-day: small, unaffiliated, paid).
- Full-cycle cost, time to usable funds, capital tied up, vs the best accessible alternative on that workflow — including one-way flow and exit (Codex §8, §16).
- Actual recovery drills: secured recovery vs residual debt vs user cost vs time, separately.

Not signals: faucet, testnet, gross volume, Accounts opened and never drawn, TPS, landing copy, anything the retainer bought directly.

---

## 11. Death

1. No P0 Name and no P1 signed offer (Fable used 2026-12-31 for P1; P0 has no date except the owner’s refusal to call).
2. Canary: the invited Names do not fund and complete a withdrawal.
3. After Accounts are sized to real tickets, drawn/posted shows a prefunded wallet, not credit.
4. The Principal says the same limits would have existed on a spreadsheet.
5. Any accounting or exit fault: stop money, keep evidence, fix the first fault.
6. Counsel says the vehicle is illegal for the first $10k and no vehicle is formed.
7. P2-only path: live corridor, pitches done, almost nobody funds a real payout — freeze. Do not add lending.

On death: stop presenting an imminent public launch. Present a reference implementation plus dispute drills. Do not fall back to the wide matrix.

---

## 12. Forks the owner still owns

These are not synthesized away.

| ID | Question | Options | What is *not* allowed |
|---|---|---|---|
| A | Chain | Ethereum L1 (Grok) · low-fee EVM with measured dispute floor and sequencer-outage vs reaction window (Fable) · add Arbitrum for cheap entry (Gemini) | Native TRON as silent default; Base if still out of `AGENTS.md` without an explicit override |
| B | Audit timing | Disclosure-first for P0 Telegram-risk Name (Grok) · review as P1 launch condition (Fable) · caps until audit then lift (Gemini) | “Three AIs confirmed” as the review |
| C | Openness | Closed book (Grok/Fable/Gemini day 1) vs Codex “public participation, concentrated distribution” | Invite-free unsecured credit from strangers |
| D | First tariff number | 3 bp/day drawn (Fable) · credit-days unspecified (Grok) · 8–15 bp corridor spread, 0 platform (Gemini) · launch-pilot 0 then 1/3 bp (Codex, as hypothesis only) | 1/3 bp as the reason anyone sits down |
| E | Hot signer | Hosted replica + session key · Safe board + ops key · Agent key in browser (Gemini) | 32 s blocking import as the first impression |

---

## 13. What this file refused to average

- Codex’s four capabilities as **simultaneous launch P0**. The UX *language* (outcome, receipt, inspectable terms) is kept. The catalog is not.
- Gemini’s TRON⇄EVM house MM as **the** product. It is P2 / rung 2, with its own kill.
- Fable’s two-token API swap as **mandatory** on day 1. It is rung 1, for a Principal who already quotes two tokens.
- Grok’s “only Egor, only pay, only Ethereum” as the **only** living universe. It is P0. If the phone is empty, P1 is the remaining commercial path. If P1 also empty, there is no launch.

The finished character (Codex §18, all four in different words): calm on the surface; underneath, a book you can read and leave. Ordinary success needs little explanation. The sophistication is the signed state, the bounded loss, and the exit.

Launch is this sentence, with the Principal’s name filled in:

> **A named vehicle extends a bounded USDT (or signed-asset) limit on one chain to unaffiliated firms it already transacts with, recorded on XLN Clearing Accounts, dispute and exit live, charging credit-days and/or spread, hosting what they cannot yet host, disclosing the bytecode and the unsecured remainder.**

If that sentence cannot be true, nothing else in the repository is a launched product.
