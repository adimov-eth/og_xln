# XLN launched product: one vision

- Author: `claude-fable-5-2` (Claude Code, Claude Agent SDK), working tree at `019d45b`
- Timestamp: 2026-11-13T12:30:13+07:00
- Status: one model's position for the `gtm` study. Not canon, not release authority, not a commitment by anyone. It treats `RELEASE SCOPE` as a hypothesis, as `AGENTS.md:225` permits for this kind of analysis.
- Labels: `[exists]` in this checkout; `[local]` exists with local evidence only, public-chain evidence pending; `[build]` not implemented; `[decision]` needs the owner; `[web]` secondary sources read on 2026-11-13; `[calc]` my arithmetic; `[hyp]` hypothesis; `[est]` my estimate.
- Supersedes my earlier recommendations in this study: the hubless desk pair (`perspectives/claude-fable-5-2.md` §2b), "owner lends lines himself", "a firm with flow becomes the principal", and "owner-run canary". Section 9 says what happened to each.

## 1. Launch day in one paragraph

One trading firm (the **anchor**: a market maker or RFQ desk with repeat counterparties) runs one XLN hub on one low-fee EVM chain. Each of its counterparties opens one bilateral Account with it. In that Account the counterparty posts partial collateral, the anchor posts inventory of the token it sells and grants a bounded credit limit, and the two trade two tokens against each other and settle the net on-chain when they choose. Either side can leave without the other's cooperation using its last signed state. Total exposure across the hub is capped at USD 10,000 on day one; that rung tests the mechanics, and the credit thesis is tested at the next one (section 11). XLN's owner supplies everything that is not order flow: the software, the tower, the external review, a retainer to the anchor, and optional extra capacity.

The product's name, if it needs one: **net-settlement account**. The one job: *trade now, settle net later, with the loss on either side bounded and collectable without asking*.

## 2. Why this and not the alternatives

Five tests, taken from what worked for Hyperliquid and Relay and from XLN's own constraints (D005 §3–§4):

| Candidate | Paying flow exists elsewhere | First user is the owner or already served | Two-way, fast capital turns | Uses credit + partial collateral | Clears the dispute floor |
|---|---|---|---|---|---|
| Hubless desk pair | yes | no | yes, with two tokens | yes | yes on a low-fee chain |
| Owner lends term lines | yes | no | no (weeks) | yes | yes |
| **Anchor-run hub (this document)** | yes | **no** | yes | yes | yes on a low-fee chain |
| Owner-run Tron⇄Ethereum corridor | yes | no | no (one-way, needs rebalancing) | no | depends |
| Agent payments (`xln/charge`) | small `[web]` | yes | no (one-way) | weakly | no on L1 |
| Operator with retail customers (casino, broker) | yes | no | yes | partly | no (small balances) |

No candidate passes all five. I choose the one whose failed test is cheapest to buy. The anchor hub fails only "first user already served", and that can be bought with one signed relationship, because the anchor brings its own counterparties and its own inventory, as Zora brought its collectors to Relay `[web]`. The corridor and agent payments each fail on the structure of the flow itself, which money does not fix.

This choice also uses the only property I found no 2026 substitute for: partial collateral plus bounded unsecured credit in one signed state with unilateral exit (`fable-p2`). Atomic RFQ needs full funding at the moment of each trade and gives no credit. A Safe plus a spreadsheet does not work at API frequency. ClearLoop-class services do this for firms large enough to be their customers `[web]`.

## 3. Launch precondition (dated)

**By 2026-12-31: one anchor has signed terms** naming at least three of its existing counterparties it will invite, the two tokens, the chain, and its integration owner.

What the owner offers to get that signature `[decision]`:

- a flat monthly retainer for operating the hub and keeping quotes available at agreed sizes. `launch-pilot.md:58-63` permits paid commitments; I would keep this one flat and not per trade, so that no trade exists because it was paid for (section 10);
- the external contract review in section 7, paid by the owner;
- software, tower operation and integration support at no charge for the first six months;
- optional capacity from the owner's ladder money placed in the anchor's hub (section 6).

If a paid offer on these terms gets no signature by the date, this product does not launch. A refused paid offer is stronger evidence than conversations, which is why I use it instead of the ten-conversation gate I conceded in D005 §0.

## 4. One counterparty's path

| Step | What happens | State |
|---|---|---|
| Identity | The firm's Entity is controlled by its existing signer. `HankoVerifier.sol:31-68` admits ERC-1271 contract members, so a Safe can sit on the board. | `[exists]` in the contract; end-to-end with a Safe is unverified `[hyp]` |
| Open | Open one Account with the anchor. Automatic opening grants zero credit (`crisis-review-20261011.md:294-295`). | `[exists]` |
| Terms | Each side sets the credit limit it accepts (`set_credit_limit`). The dispute window is signed at opening. | `[exists]` |
| Fund | Deposit a token to reserve, move reserve to collateral in the Account. | `[exists]`; public proof covers faucet, reserve, pay, credit, reload (`todo.md:20-21`) |
| Anchor inventory | The anchor moves the token it sells into this Account as collateral. Capacity is per token and per Account (`core/account/utils.ts:137`, `deriveDelta`): what the counterparty buys is secured only by collateral of that token sitting here. Without it the counterparty is lending to the anchor. Inventory in one Account is not available to another. | `[exists]` as an ordinary collateral move; a priced, time-bounded commitment to keep it there is the lease of `liquidity-lease.md:213-222`, `[build]` |
| Trade | The anchor quotes; a fill is a two-token swap inside the Account (`swap_offer`, `swap_resolve`), or a `direct_payment` for a one-token obligation. No chain transaction. | `[local]`; same-J swap evidence on one immutable candidate is `todo.md` item 2 |
| Use credit | The counterparty's balance may go negative up to the limit the anchor signed. The anchor's loss is bounded by that limit. | `[exists]` |
| Pay for credit | A daily charge on drawn credit (section 6). | `[build]`; invoiced off-protocol at launch `[decision]` |
| Net-settle | Cooperative on-chain settlement of the net, or a top-up. | `[exists]` |
| Exit, anchor gone | Start a dispute with the last signed state, wait the signed window, finalize. Collateral pays the secured part; any unsecured remainder becomes a debt row. | `[local]`; three public Sepolia disputes on current bytecode are `todo.md` item 4 |
| Offline protection | A tower counter-disputes a stale state while the firm is offline (`Depository.sol:423`, `core/watchtower/`). | `[local]` |
| Recover | Local encrypted backup, then tower vault, then explicit on-chain exit (`recovery-watchtower-protocol.md`). | `[exists]`; coverage UI and operator alerts missing |
| Cap | Per-Account and hub-wide exposure ceiling, enforced at admission and across restart. | `[build]`; `ops/capped-testnet-policy.json` has `riskCapUsd: null` |
| Operate | The anchor drives the hub from its own systems through `cli/` and the RuntimeAdapter. | partly `[exists]`; quote hook and runbook `[build]` |

The first strong experience has to be a clean withdrawal. A rehearsed exit on the public testnet with the identical bytecode precedes any real funds.

## 5. Topology and custody

- **One hub**, operated by the anchor, with its own keys and host. A star: the anchor in the middle, counterparties at the points. No routing between counterparties at launch, so no HTLC path is exercised.
- **One tower** operated by the owner, plus the anchor's own. A tower cannot spend; it can only publish a newer signed state.
- **One chain.** A low-fee EVM chain with Ethereum-style receipts. The receipt reader's `ethereum-trie` profile is the supported path (`core/jurisdiction/adapter/receipt/reader.ts:386-448`). Which chain is `[decision]`: `AGENTS.md:27` excludes Base from this launch, while `launch-design.md:9-13` puts Base and Arbitrum in the same architecture. Two constraints on that choice, both unmeasured here: the reader fetches a header for every block in a range, twice, so a chain with short block times multiplies the import cost that `todo.md` item 5 already reports at 32.1 s; and exit depends on transaction inclusion on that chain (`launch-design.md:151-154`), so the hub's reaction window (one hour up to USD 100,000 under `launch-design.md:202-208`) must be checked against that chain's worst sequencer outage before it is signed.
- **A Depository deployment dedicated to this hub.** This is my answer to my own `fable-p4`: one address holding every participant's stablecoins is one issuer blacklist away from freezing all of them. A per-hub deployment limits that to the anchor's own book, whose counterparties already accept the anchor. It keeps netting across the anchor's Accounts, which per-pair clones (D004 §4) would give up. Per-pair deployment stays available if a counterparty requires it `[hyp]`.
- **Launch profile** `[build]`: Account admission limited to direct payment, same-J swap, credit limits, collateral moves and settlement. Lending, pulls, cross-J and hash-ladder admission are off. `AGENTS.md:44` already keeps opaque custom transformers unavailable.

## 6. Price, return and who funds each rung

**The price of credit.** Proposed: **3 basis points per day on drawn unsecured credit**, charged by the anchor to the counterparty `[decision]`. That is 10.95% a year simple `[calc]`. It sits between the stablecoin base lending rate (3.39% on Aave Ethereum USDT, 2026-10-23 `[web]`) and what a named market maker reportedly pays unsecured (about 12%, one unverified post `[web]`). It gives a capacity supplier something to compute.

**Return on capital locked** `[calc]`. The anchor's capital in an Account is the inventory it posted there, drawn or not. Credit income as a yearly return on that capital is `10.95% × (average drawn credit ÷ inventory posted)`. It equals the Aave base rate when average drawn credit is 31% of posted inventory; at half it is about 5.5%; at 10% it is about 1.1%. Spread income comes on top and is the anchor's own number. Two consequences:

- Inventory does not pool across counterparties, so idle inventory in a quiet Account earns nothing while a busy Account runs short. A market maker will raise this first. The remedies are moving collateral back to reserve and out again (an on-chain batch each time) or posting inventory per request, which is the unbuilt lease.
- The credit fee alone does not pay for the capital unless Accounts are sized close to what is actually drawn. Sizing each Account from the counterparty's real ticket history matters more than the rate.

**The price of the trade** is the anchor's spread. XLN takes none of it.

**What XLN charges.** Nothing for six months, then a flat monthly fee per hub `[decision]`. This replaces the 1 bp and 3 bp platform fees of `launch-pilot.md:65-67` for this product. A per-trade toll equal to an incumbent's whole price (Relay lists 1 bp for stable swaps, per the Codex memo) is not a wedge, and a supplier cannot compute a return from it.

**Who funds what.** The ladder is the owner's own (`launch-design.md:106-123`); I change only whose flow it sits behind.

| Rung | Hub-wide exposure cap | Capital comes from | Owner pays for | Criterion to climb |
|---|---|---|---|---|
| Public testnet | test assets | — | everything | fund, trade, net-settle, exit and recover rehearsed by the anchor and one counterparty |
| Canary | USD 10,000 | anchor inventory, counterparty collateral | retainer, review, tower | 30 days, zero unexplained loss, at least one real cooperative settlement and one real withdrawal. Mechanics only: about USD 3,000 per Account is below any desk's ticket and nobody needs credit for it. |
| Pilot I | USD 100,000 | same, plus optional owner capacity | retainer, tower | each Account's limits cover at least one normal ticket of that counterparty; at least three counterparties active in the same week; average drawn credit at least half of posted inventory |
| Pilot II | USD 500,000 | a second, paid market maker | second retainer | published utilization record (below) covering 60 days |
| Beta | USD 2–5 million | pooled savings opened to outside depositors | review of the term-loan path | net return on deployed capacity above the Aave base rate over the prior 90 days |

Two notes on the upper rungs. The second market maker at Pilot II joins the same Depository as a counterparty of the anchor and so shares its issuer-freeze domain; a separate Depository would be a separate jurisdiction and would need cross-J, which is deferred. The beta rung reopens lending admission, so the transformer's term-loan path, excluded from the launch review, needs its own review before that rung.

**The utilization record** is the product's second output and the only thing I found that outside capital has ever underwritten (D005 §4). Per day: capacity deployed, credit drawn, turns, fee revenue, rebalance cost, quote availability over all requests, completion over accepted quotes (definitions in `launch-design.md:82-104`). It should be produced from committed evidence from the first day of the canary.

Owner capacity placed in the anchor's hub is credit exposure to the anchor. It is optional, capped by the rung, and is the owner's risk decision.

## 7. Trust package

Each item below is something a counterparty's risk review will ask for. None is optional for this buyer `[hyp]`.

1. **Licence.** Four of the five core contracts are `SPDX-License-Identifier: UNLICENSED`; the runtime is `AGPL-3.0` (`package.json:283`); the landing says "Open source". Pick a licence a trading firm can deploy and state it `[decision]`.
2. **External review of the launch surface.** Depository, Account, the Hanko verifier and codecs, `DepositoryBounds`, `Types`, and the payment and swap paths of `DeltaTransformer`. Swaps settle through the transformer in a dispute (`DeltaTransformer.sol:221-241,366`), so a two-token product cannot exclude it; I was wrong to write "transformer admission disabled" in my perspective. Term loans, pulls and the hash ladder are outside the launch profile and outside the review. Whether single-signer Entities let the review skip most of `EntityProvider.sol` is unverified `[hyp]`. `todo.md:61-63` makes external sign-off optional; for this buyer I would make it a launch condition `[decision]`.
3. **Enforced cap.** Section 5. An unenforced ceiling in prose is not protection (`launch-pilot.md:157-161`).
4. **Dispute floor, stated for the chosen chain.** Canon: a balance is protected when it is roughly 100 times the dispute cost (`rejected-ideas.md:8-9`). So `floor ≈ 100 × (start + finalize gas) × gas price × native-token price`. Measured sizes are 921,213 gas for a one-asset, 32-payment proof and up to 3.9M for 80 claims (`crisis-review-20261011.md:68,504`). Publish the floor from a measured exit on the chosen chain at a stressed gas price, and show it in the wallet. Below it, the Account is unsecured credit to the anchor, and should say so.
5. **Published exit.** The three public disputes of `todo.md` item 4, with transaction links, on the same bytecode as mainnet.
6. **Tower and recovery drill** with the anchor's own operator, including restore from backup and a last-resort dispute (`todo.md` item 8).
7. **Counsel.** Who may legally operate a hub that holds counterparties' balances and extends credit, and in which jurisdictions, is unresearched in this study. It blocks launch, and it is the anchor's exposure more than the owner's.

## 8. What changes in the live queue

Every line here is `[decision]`. `rejected-ideas.md:13` rejects cutting launch scope; I am arguing for the cut, not assuming it.

| `todo.md` item | In this product |
|---|---|
| 1 Keep E2E and release gate green | keep |
| 2 Same-J swap scenarios | keep; cross-swap and lending parts deferred |
| 3 Native TRON | deferred until a signed anchor needs it |
| 4 Three public Sepolia disputes | keep; it is the demo |
| 5 Import and reload latency | keep. D004 §3 is right: the cost is in the shared receipt reader that every Runtime uses, not in the browser. My D001 §2 freeze was wrong. |
| 6 1,000-user TPS | deferred; a star with tens of Accounts does not need it |
| 7 One-hour soak, mainnet gate | keep |
| 8 Operations drilled | keep |
| 9 2^200 money domain | deferred |
| 10 Exception classification | keep |
| 11 Review packets | keep; becomes the external review packet |
| 12 Rust parity | deferred |
| 13 R2C guard | keep |
| Three independent hubs, two MMs (`todo.md:52-54`) | replaced by one anchor; this line already contradicts `launch-design.md:45` (D005 §1) |
| Ten conversations, two intents (`todo.md:57`) | replaced by the dated precondition in section 3 |

Other canon this collides with: no protocol-level caps (`AGENTS.md:24-25`, `mainnet-acceptance-gate.md:24`) against the ladder's caps; three hubs (`launch-design.md:45-48`, `mainnet-acceptance-gate.md:27`) against one; no reserve visibility (`rejected-ideas.md:7,18`) against the beta rung, where every pooled vault that attracted deposits showed its book `[web]`.

The landing changes to one sentence about this job and drops "Payments for AI agents" as the title. `xln/charge` stays in the repository as an integration example.

## 9. What happened to my earlier recommendations

- **Hubless desk pair.** It becomes the first Account of the anchor's hub. A lone pair has no utilization record to show a second supplier and no pooled claim to open later.
- **Owner lends term lines.** Dropped. Capital that sits for weeks behind borrowers nobody else will fund is the adverse-selection case, and I had no answer to it.
- **A firm with flow as principal.** Kept; this document is that recommendation made specific.
- **Owner-run canary.** The owner still funds the ladder, but behind someone else's flow. An owner-run hub with no counterparties has zero turns.

## 10. What counts as success, and what does not

- **MML.** Obligations between the anchor and its counterparties are between unaffiliated Entities and count once each. The owner's retainer must be disclosed next to any such number. Activity in which the owner or an affiliate is a party does not count.
- **The product signal** is the anchor inviting a fourth counterparty without being paid to and without a protocol change (Gemini's "Client #2" test, which I adopted in D001 §9).
- **Not signals:** testnet rehearsals, gross volume, Accounts opened and never drawn, and anything the retainer pays for directly.

## 11. What kills it

1. No anchor signs the paid offer by 2026-12-31 (section 3).
2. By the end of the canary, fewer than three of the anchor's counterparties have funded an Account and completed a withdrawal.
3. After 60 days at Pilot I, with each Account sized to that counterparty's normal ticket, average drawn credit is below 31% of posted inventory. Then the capital earns less than lending it out, counterparties are using the Account as a prefunded wallet, atomic RFQ does that better, and the credit thesis is wrong for this segment.
4. At the end of Pilot I the anchor says it would have extended the same limits to the same counterparties on a spreadsheet. Then XLN changed no credit decision.

Conditions 3 and 4 cannot be read at the canary. A USD 10,000 hub tests whether the machinery works and whether anyone will fund it at all.
5. Any accounting or exit fault: stop money movement, keep the evidence, fix the first fault (`launch-pilot.md:99-103`).

If 1 fires, I would stop presenting XLN as an imminent launch and present it as a reference implementation of provable bilateral accounts, with the public dispute drills as its demonstration. I would not fall back to the wide launch.

## 12. Where this is weakest

- **The anchor may not need it.** A market maker with flow already extends credit to counterparties it trusts and refuses the rest. The product only matters for the ones it refuses or caps, and I have no evidence how many those are. Kill condition 4 tests this.
- **It is still one business-to-business sale.** Neither precedent I studied sold anything to anyone; their founders were already inside the market. The retainer is my substitute for that position, and a relationship that exists because it is paid for may end when the payment does.
- **Trading-firm signers.** Firms hold funds in MPC custody or hardware. Per-frame signing at API frequency needs a hot operational key with limits; the ERC-1271 path covers the board, not the frame signer. Unverified end to end.
- **Privacy is partial.** Funding, settlements, disputes and debt rows are on-chain and keyed by Entity. Only intraday gross flow is private.
- **Assurance.** One external review of a contract surface this size is thin, and "confirmed by three AIs" will carry no weight in a counterparty's risk memo.
- **This document is one model's reasoning from a repository and secondary web sources.** Nobody in this study has spoken to a desk. Every figure about other firms is self-reported or secondhand.
