# XLN: prove a paying relationship before financing a network

- Model: `gpt-6-astra`; exact model field verified in this chat's local `turn_context` metadata. Harness: Codex desktop; reasoning effort: high.
- Signed: `gpt-6-astra`, 2026-11-13T10:45:07+07:00.
- Lens: all five; primary emphasis on capital requirements and buyer substitution.
- Repository observed: `019d45beb5954e77fe806d643845f6a4dca4fa82`, dirty shared main. Source references describe that working tree, not a certified release.
- Cold-entry boundary: read the brief, template and source map before writing this file. No quarantined memo, sibling perspective, claims or chat was read before saving sections 1–5. Those sections will remain unchanged after entry.
- Method: targeted source inspection and primary vendor documentation retrieved November 13, 2026. No new financial run, customer interview, audit or production deployment. Vendor claims establish an available alternative to investigate, not independently measured performance.

## 1. Diagnosis of Current XLN Scope & Positioning

There is useful machinery but no demonstrated commercial product boundary. The three current offers have different buyers:

| Observed source | Offer or obligation | Commercial implication |
| --- | --- | --- |
| `frontend/src/routes/+page.svelte:6`, `:18` | Payments for AI agents; experimental MPP | API merchant distribution and developer integration |
| `docs/launch-pilot.md:9`, `:15` | USDT desks between Tron and Ethereum; three independent hubs and MM liquidity | Treasury capital allocation plus a multilateral operating agreement |
| `todo.md:10`, `:19`, `:52` | Pay, two swap flows, lending, native TRON; two MMs and three hub owners | Simultaneous payment, market-making and bank formation |
| `todo.md:57` | Ten conversations targeting two written intents | Demand remains a task, rather than demonstrated input to that scope |

The last row does not independently prove there are zero signed intents. Zero audits, zero intents and MML=0 are the brief's declared baseline; I found no independent customer evidence in the inspected source map. Treat them as reported, not a fresh business census.

I counted **6,409 physical lines across 16 top-level contract files**, including mocks and support libraries. Five named contracts contribute 4,992 lines. The brief's other 6,362 figure is not the same current count. Neither count measures vulnerabilities or the complete transitive audit surface. `Depository.sol:74` stores debt; `Account.sol:1065` separates signed settlement arithmetic from custody effects; `DeltaTransformer.sol:263` computes a signed loan claim. These implement obligations, not a source of principal or an external collection guarantee.

`core/api/payments/mpp-server.ts:7` verifies merchant-side committed receipts, with repeatable access and application-owned fulfilment idempotency at `:76`. `cli/agent-payment.ts:14` requires runtime credentials and owner-key provisioning; `:17` requires command-lane serialization. An HTTP adapter therefore does not imply familiar card-like onboarding. `docs/agent-payments.md` explicitly confines its reported proof to same-operator test credit and does not establish runtime crash coverage or MML.

The source map also reveals real operational breadth: `core/paybook/payment-admission.ts:66` validates payment bounds; `core/lendbook/policy.ts:47` validates a named borrower facility; `core/swapbook/cross-j/quantity.ts` rounds executable quantities to signed capacity; `core/storage/wal/index.ts` exposes canonical checkpoints; `core/network/relay/store.ts` tracks delivery and routing state. `rscore/crates/engine/Cargo.toml` maintains a second implementation dependency surface. None is evidence that a customer needs all those products together.

The queue reports 32.1 s import and 20.1 s reload (`todo.md:28`); I did not remeasure them. It also reports a failed drain boundary at `:30`. Historical green suites do not certify current bytes. `docs/owner-profile.md` and `docs/crisis-review-20261011.md:13` contain superseded scope choices; their existence explains decision drift but is not permission to execute a different release.

The pricing document correctly distinguishes the proposed 3 bp swap platform fee from all-in cost (`docs/pricing-competitive.md:89`). Public spot fee tables do not establish superiority over negotiated OTC quotes, cheap settlement or existing credit relationships.

## 2. Highest-Conviction Wedge (or Non-Existence Verdict)

**No external wedge is established. The strongest testable candidate is a single recurring bilateral settlement relationship between an independent payout operator and its existing liquidity counterparty, on one asset and jurisdiction they already use.** The buyer is the operator's treasury owner with a budget and authority to replace that relationship's settlement process. This is not an invented customer: no named firm or lost deal is evidenced yet, and finding one is the first test.

The unit is a paid operational service for that pair: retain independently verifiable signed obligations, reuse collateral across repeated opposite-direction flows, and exercise unilateral exit under the agreed rules. Counterparties supply principal themselves. XLN must not quietly become lender, guarantor or liquidity warehouse to make the demo attractive.

Why switch? Only if the pair can show that its current fastest acceptable workflow ties up materially more usable capital or imposes costly repeated reconciliation, and both parties value the extra enforceability enough to operate it. A relationship already comfortably serviced by a database, existing loan agreement and daily transfer is a bad prospect. An isolated cross-chain treasury transfer is also a bad prospect: it principally needs a good executable quote, not a new relationship network.

I would test a **$500/month per-pair service price**, explicitly a falsifiable price hypothesis, not approved protocol pricing. Existing 1/3 bp fees stay inside total cost wherever applicable. At 1 bp, $5 million monthly notional produces just $500 gross before support, security and operators; at 3 bp the same gross requires about $1.67 million. Charging turnover can punish the very reuse the product is supposed to encourage. A subscription is worth testing, not assuming.

## 3. Self-Attack Across the Five Angles

### Capital & float physics

For a stylized fully backed pair, let signed cumulative net flow be `S(t)`; a lower bound on reusable directional funding over the observation window is `max S(t) - min S(t)`, before settlement scheduling, buffers and asset constraints. This is an economic diagnostic, not XLN's admission formula. With one-way flow, it approaches gross flow; netting does not manufacture destination cash. Credit can reduce prefunding only because a named creditor accepts loss exposure.

Compare monthly savings as `released average usable capital × annual funding rate / 12 + avoided operating and settlement cost - added fees, support, hedging and risk cost`. Do not add float revenue to funding savings when they are the same benefit. Illustratively, releasing $100,000 at 12% costs/saves $1,000 per month; at 5%, about $417. Both are assumptions, not market quotes. A $500 subscription is already implausible in the latter case before operational cost.

Who loses? An incumbent holding profitable customer prefunding may prefer the old setup. A challenger may want less collateral but lack anyone willing to extend credit. The proposal is most likely to fail here: the pair's true bottleneck may be scarce capital or trusted distribution, neither supplied by better signed accounting.

### 2026 substitute baseline

- [USDT0 Legacy Mesh](https://docs.usdt0.to/overview/the-legacy-mesh) documents a 0.03% transfer fee. That is not a universal USDT0 fee or a complete route quote. It nevertheless undermines an unqualified 3 bp platform-fee advantage for cross-chain treasury.
- [Relay Vaults](https://docs.relay.link/references/protocol/vaults/overview) explicitly separate solver settlement from rebalancing liquidity and use capital supplied by depositors. Solver-credit demand cannot be inferred merely from the existence of cross-chain inventory. Obtain the prospect's actual Relay/LI.FI route quotes and eligibility before claiming an underserved corridor.
- [Permit2 signature transfer](https://developers.uniswap.org/docs/protocols/permit2/concepts/signature-transfer) provides signed transfer authorization and witness binding; it is not by itself a complete atomic RFQ market. Compare against a complete RFQ settlement workflow, not a bare approval transaction. For occasional same-J swaps, no repeated bilateral relationship may be necessary.
- [Safe threshold accounts](https://docs.safe.global/advanced/smart-account-concepts) provide shared authorization. A 2-of-3 Safe with an arbitrator is a credible operational baseline, but it is not unilateral latest-state exit. Ask whether the buyer values that distinction enough to carry towers and evidence.
- [Fireblocks Off Exchange](https://www.fireblocks.com/platforms/off-exchange) markets collateral vaults for exchange trading. Availability to a particular small pair and price require quotes. Copper ClearLoop should also be evaluated where the pair already qualifies; neither brand's reach is evidence of suitability everywhere.
- [Wildcat borrower documentation](https://docs.wildcat.finance/using-wildcat/day-to-day-usage/borrowers) describes undercollateralized markets and optional loan agreements; [Morpho](https://docs.morpho.org/learn/) documents overcollateralized lending. They address different risks. [Arf](https://arf.one/arf-liquidity/) offers receivable-backed settlement finance. A bank interface alone does not compete with principal, underwriting and distribution; Huma/Arf eligibility belongs in the buyer interview.
- [Tempo sessions in mppx](https://github.com/wevm/mppx/blob/main/src/tempo/session/README.md) implement TIP-1034 repeated HTTP payment channels. The inference is that amortized per-request payment cost is not an XLN-exclusive agent wedge. A prepaid Postgres ledger is an even simpler baseline when the buyer accepts merchant credit risk.

I did not verify the brief's universal sub-600-ms/sub-cent characterization of Base, Arbitrum, Solana and Hyperliquid. Inclusion, finality and usable cash are different measurements. The experiment must time the actual available substitute end to end; it cannot use Ethereum L1 as the only baseline.

### Trust & failure surface

`ui/src/components/DisputeProtection.tsx:39` says appointments cover current proofs and must be updated; `:46` distinguishes acceptance from an on-chain response; `:62` warns when response is disabled. This is a continuing operating obligation. `EntityProvider.sol:508` maintains historical board grace; `HankoVerifier.sol:62` discusses mutable member validation. Integration with an existing signer policy requires a real drill, not an assertion that signature support makes MPC/hardware integration trivial.

Measure secured recovery after offline stale-state attack, gas funding failure, lost runtime and delayed inclusion; show any unsecured remainder separately. A signed debt row does not ensure external repayment. Contract UNLICENSED headers also require explicit commercial licensing clarification; this is a diligence question, not a legal conclusion.

### Buyer & distributor incentive

The treasury owner must name a lost payment, rejected credit line or repeated operating cost. A developer liking the protocol is not that buyer. The counterparty must accept deployment and exit obligations without a subsidized yield promise. Incumbent distributors may lose float; challenger distributors may lack trust. Charge for a measured benefit and require a real budget holder. No partner outreach is authorized or performed by this study.

### Falsification & scope cut

A single successful relationship would support a narrow service, not a three-hub market, universal banking or GDP attribution. Failure to find a pair with adequate savings and reciprocal flow kills this wedge even if engineering is excellent. The test must include the best simpler alternative; comparing only with the buyer's neglected legacy process invites false positives.

## 4. Heresy / Non-Obvious Reframing

XLN may be a **specialized implementation inside someone else's existing financial relationship**, not a destination network. Let operators retain customer acquisition, credit decisions and principal. The differentiated thing to sell, if any, is reliable operation and recovery of this specific relationship. This is distinct from selling generic corporate payment authorization, which the rejected-ideas list excludes.

Another possibility is commercially negative: the minimum trust and support burden of running signed bilateral accounts may exceed available willingness to pay outside incumbent networks. In that case becoming a funded principal would be a new capital-intensive business, not proof that the software wedge worked. Do not relabel that failure as a protocol win.

BrainVault's 603-line portable meaning is a separate recovery trade, not a shortcut to distribution for treasury settlement. Its README accurately warns that expensive guessing cannot rescue weak passwords. The 10,000 × 256 MiB work description is aggregate per-shard work, not a requirement to hold 2.5 TiB simultaneously; the README reports about 88 GiB live arenas on its measured accelerated host. Do not carry the brief's shorthand into a security or hardware-sales claim.

## 5. Concrete 2–6 Week Falsification Experiment

**Hard decision: December 11, 2026, 18:00 Asia/Bangkok (four weeks).** Thresholds below are subjective precommitted screening criteria, not discovered market laws. The clock starts now, not after mainnet approval.

1. **Day 1:** Owner selects ten reachable treasury budget holders and asks for a named counterparty, one blocked recurring workflow, current settlement method, seven days of timestamped flows and current fees/funding terms. Prepare a pair-level anonymized comparison using existing tools; do not build an analytics product. Request permission and data rather than infer customer activity. Outreach is an owner action, not performed here.
2. **By November 20:** Obtain usable exports from at least two independent firms describing the same commercial relationship, plus both parties' named operational owners. If none, stop this wedge; further engine breadth cannot resolve the demand failure.
3. **By November 27:** Compare at least 100 historical genuine obligations across seven consecutive days using the current workflow, the best feasible simpler alternative, and XLN's actual capital/fee requirements. Include peak and average tied capital, usable-funds delay, operator minutes and exit cost. Do not call historical simulation MML. Require at least $1,500 monthly net benefit before the proposed $500 fee and no worsening of the buyer's stated risk tolerance. Obtain bilateral agreement to the calculation.
4. **By December 11:** Both counterparties independently operate a testnet relationship for five business days, with separate keys and administration; complete a payment, restart, reconciliation, stale-state challenge and exit rehearsal on current code. Require 100/100 unique obligations reconciled exactly, no unexplained residual balance, and the secured/unsecured split matching signed terms. Require one paid $500 evaluation from the budget owner and a written conditional continuation from both parties, naming capital provider, signers, tower operator and deployment prerequisites. Payment for evaluation is service revenue, not on-protocol MML.
5. **Binary result:** Pass only if all commercial, comparative and operational conditions hold by the deadline. Missing audit or mainnet approval cannot be used to extend a demand experiment indefinitely. A testnet pass earns the next controlled release decision; it does not authorize real funds. If customers require immediate mainnet use and will not buy an evaluation, record failure under this test. No unpaid letters, affiliated round trips, subsidized APY or submitted TPS substitute for payment and independent operation.

**Proposed experiment scope, not edits to release authority:** keep the canonical TS pay/account path, WAL/outbox/recovery, necessary EVM Depository/Account/Hanko exit, and the existing React views required by the pair. Preserve signed claims and their recovery. Freeze new Rust parity/performance work, 1,000-user TPS work, native TRON expansion, cross-J market recruitment, pooled savings/loan expansion, broad agent marketing and unrelated BrainVault optimization during this test. Do not delete code or alter production admission under a strategy memo.

This deliberately challenges the rejected broad-scope-cut premise because current source evidence identifies three different sales motions while primary substitutes already serve the simple versions of each. It is not a claim that generality has no engineering value. The falsifying evidence for my cut would be an actual buyer willing to fund the full combined scope and demonstrate that the narrow pair cannot deliver its needed workflow.

## 6. Post-Entry Cross-Examination Links

- [D002 in the append-only chat](../chat.md#d002--gpt-6-astra--2026-11-13t1053000700): eight collisions and falsifying tests after reading both sibling perspectives, the claims ledger, D001 and all three quarantined memos.
- D002 explicitly corrects the current availability of Relay Vaults and adds the shared-custody freeze boundary. Sections 1–5 above remain unchanged as the cold-entry record.

- D003 in [chat.md](../chat.md): append-only clarification of concurrent D002 numbering, signing timestamp, and the newly arrived Grok claims.
