# XLN: simple financial relationships, verifiable underneath

Author: Codex · November 13, 2026

This is my current product position, informed by four product visions, their cross-examination, the repository, and the Hyperliquid/Relay research in this discussion. It replaces my previous vision as my strategic recommendation; the original remains an unchanged historical view. Other authors' documents remain their own positions. The synthesis improves the reasoning, but it adds no new customer evidence.

Descriptions of the launched experience are design targets, not claims about deployed capabilities. Proposed commercial tests and numerical thresholds are judgment calls. This document authorizes no deployment, capital allocation, protocol change, or modification of release gates.

## 1. What I believe, and what we have not found

**XLN should make recurring financial relationships easy to use and possible to verify: pay, exchange, use agreed financing, settle, and leave on explicit terms.**

The customer sees an understandable financial account. Inside it, XLN coordinates signed obligations, collateral, credit, routing, and settlement. The complexity earns its place through a better customer outcome.

**We have not yet found the first product people will choose to enter this system for.** A simple interface cannot answer that question by itself. It can hide an impressive mechanism behind an ordinary service that gives the customer no reason to switch.

What interests me most is making a relationship with a financial intermediary explicit: what it owes, what secures that obligation, what risk the customer accepts, and how the relationship can end. Payments, exchange, and financing become useful actions within that relationship. This is a substantial product hypothesis, not an established customer preference.

The difficult counterargument is that customers may prefer a familiar institution, accessible support, and an ordinary recovery procedure. A cryptographically precise claim against an unfamiliar operator can be less attractive than an ordinary claim against a trusted company. XLN must offer enough practical benefit to overcome that trust gap. Inspectability alone does not establish safety, recoverability, or demand.

An existing operator and its recurring counterparties are one plausible entry point. A first-party exchange or payment service, backed by accountable execution, is another. An owner-funded credit relationship is a third. None has been established as the winning market. Ethereum–TRON remains a corridor candidate, and repeated same-jurisdiction exchange remains a workflow candidate.

Credit is optional. It is neither a prerequisite for discovering value nor something automatically offered to everyone. XLN must improve the workflow even when the improvement is operational rather than a new lending decision.

I would protect the ambition of an XLN product that people deliberately visit and return to. Direct use can give us a relationship with customers, a way to earn trust, and a place to demonstrate capabilities they did not previously have. Its first visitor still needs an immediate reason to be there.

My strongest conviction is **simple to use, verifiable underneath**. My confidence is much lower about the first buyer, activity, and distribution channel. The rest of this document must be read with that distinction intact.

## 2. What survives the different perspectives

The inputs propose different businesses and different stages. Their useful contributions do not require accepting their entire conclusions.

| Perspective | Contribution adopted | Assumption not adopted |
| --- | --- | --- |
| [Gemini](./gemini-xln-product-vision-2026-11-13.md) | An understandable execution product; a complete funding-to-delivery journey; an economic reason for distributors to integrate. | The chosen corridor, quoted latency, inventory turns, fee margins, and engineering deadlines are already established. |
| [Grok](./grok-4.6-launched-product.md) | A named customer and a named balance sheet; explicit default responsibility; no imaginary ecosystem supplying missing capital. | An owner-funded unsecured loan is the necessary first product, or demand for that loan proves demand for XLN. |
| [Claude](./vision-claude-fable-5-2.md) | Test access to existing counterparties through an operator; account for per-Account inventory; demonstrate settlement and recovery with real operators. | The required operator is available; a universal credit-utilization cutoff decides viability; or unchanged underwriting means the product has no value. |
| [My earlier vision](./codex_launched-product-vision.md) | One coherent customer experience; honest completion states; recovery as part of the product; complete economics. | A broad promise of better financial execution sufficiently explains why anyone switches to XLN. |

The resulting commitments are **accountable execution, simple customer experience, and demonstrated value from the relationship machinery**. They constrain a good product. They do not yet identify one.

This is my synthesis, not a four-model consensus. The documents share sources and have influenced one another. Repeated assertions are not independent customer evidence. The existing [Gemini synthesis](./synthesis.md) is another proposal; its agreement counts do not establish implementation readiness or authorize changes.

## 3. Separate the destination, the entry point, and the experiment

Three decisions were repeatedly collapsed in the earlier discussion.

**The destination:** people and businesses can establish useful financial relationships through XLN, use multiple providers, and understand their rights without operating a financial network themselves.

**The entry point:** unresolved. An operator's existing workflow could provide access to demand; a distinctive first-party activity could create direct adoption. The choice depends on the actual advantage and who can deliver it, rather than on which narrative is easier to write.

**The experiment:** expose a specific proposed advantage to real users and observe whether they choose it. In an operator-led test, that could be one recurring counterparty relationship. In a first-party test, it could be one complete activity offered directly. Both must include the real costs, execution dependencies, and recovery conditions before drawing a commercial conclusion.

A successful experiment does not certify a public network. A broad destination does not require broad customer acquisition on the first day. A small experiment also cannot be used to silently remove the existing public-release requirements.

This separation lets us keep ambition while making the next commercial claim small enough to test.

## 4. The user promise

The product should let a customer say:

> I can see what I have, what I owe, what I can do now, and what it will cost. I can use the relationship repeatedly without rebuilding the process each time. If something goes wrong, I can find the evidence and the next action.

The first screen starts with the intended outcome: a recipient and amount, a desired asset, or an action under an existing financial agreement. It does not start with a topology diagram, an Entity-formation tutorial, or a list of protocol primitives.

A quote shows the actual recipient or counterparty, exact asset and network, input or maximum debit, output or minimum receive, total cost, expiry, and completion condition. Credit use is identified before authorization. If funding is required, that step and its cost remain visible.

A user can accept an executable offer without learning how XLN routes it. An unsupported operation is unavailable rather than disguised as an executable preview. An indicative quote remains labeled indicative.

The promise of simplicity stops at the boundary of financial consent. Cost, credit exposure, payout conditions, withdrawal restrictions, and material control rights cannot disappear into an advanced panel.

## 5. One complete operation

Consider an independent business exchanging one supported asset for another through a provider using XLN. It wants the acquired asset available for a payment or settlement. This illustrates the intended experience; it does not select that business, provider relationship, token pair, or trade size as the first market.

1. The customer chooses the desired result. XLN identifies the relevant relationship, holdings, and any expressly authorized facility.
2. The operator returns a quote backed by actual inventory and Account capacity. The customer sees the all-in price and any additional funding or authorization steps.
3. The customer accepts the terms. The operation receives a durable identity. A timeout or reconnect resumes that operation rather than creating another debit.
4. The financial state advances through the canonical production path. The interface distinguishes accepted, pending, committed, externally delivered, and unresolved outcomes according to the actual operation.
5. The customer receives a readable receipt and access to the underlying evidence. They can use the resulting balance under its terms, settle cooperatively, or follow the applicable exit process.

For a payout, step 4 must include the missing third-party delivery. Updating a bilateral Account does not, by itself, pay an external recipient. If the operator sends tokens from an external wallet, that inventory, transaction, fee, finality policy, and reconciliation belong in the service definition.

Internal conversion plus external payment must not be called one atomic operation unless the implemented mechanism and recovery evidence support that claim. Until then, the interface presents the real stages and risks.

## 6. The visible product

I would retain a compact first-party React application organized around **Home, Activity, and Agreements**, with Send, Receive, and Exchange as direct actions.

The application is a serious candidate for the main product, not merely an administration portal for an embedded service. Its success depends on one activity people voluntarily return for. A complete menu is not a substitute for that activity, and integration with another application does not automatically have priority over finding it.

Home separates usable funds from pending movements, savings claims, and debt. Asset identity remains jurisdiction-specific. A portfolio estimate can summarize value; it cannot imply every claim is immediately spendable or interchangeable.

Activity shows each economic operation once, with its purpose, price, state, and receipt. Users can expand routing or settlement details without confusing intermediate hops with additional purchases or payments.

Agreements shows the provider, accepted credit limits, collateral and unsecured portions, loan or savings terms, due dates, and exit conditions. Borrow and Save appear when the corresponding service is actually offered and authorized. They are not compulsory onboarding steps.

An embedded integration uses the same quote, authorization, status, and receipt semantics. It does not maintain a competing calculation of balances or financial completion. The first-party app gives customers continuity if they stop using the distributor's interface.

For enthusiasts, each relationship opens into signed terms, proofs, relevant Account collateral, dispute windows, coverage freshness, and an export/recovery path. They can investigate the machinery that produces the simple result.

## 7. Who does the work and carries the risk

An existing trading, payout, or settlement business could operate the first service. In that arrangement, its financial Entity and commercial book remain under its authority, and it supplies the principal for the commitments it makes. This is an operating model to validate, not an available partner we can assume into existence.

The attraction is real: such an operator may bring customers, inventory competence, and knowledge of risk. The temptation is also real: the recommendation can outsource every difficult commercial obligation to an imaginary partner. Until a specific operator wants the arrangement, it is no more concrete than an imagined ecosystem of liquidity providers.

XLN can provide managed infrastructure and integration support. Hosting a Runtime does not grant discretionary financial authority. Customer keys, supported signing policies, current evidence availability, recovery access, and the consequences of host failure must be demonstrated together. Merely saying “the keys stay with the user” does not resolve every dependency.

I would require recovery arrangements that do not depend solely on the counterparty being disputed: accessible user evidence, a tested restoration path, and appropriately independent monitoring. A separate cloud account alone does not establish independent ownership or authority.

A flat retainer may purchase inventory availability or integration work. It is an explicit acquisition or supply expense. It does not establish willingness to pay for XLN, and any associated usage is reported with that subsidy.

Owner-funded capacity is an optional, separately priced investment in this service. It must have a named borrower or exposure, funding terms, and loss allocation. It is not a default assumption concealed in an architecture diagram.

An owner-run service could provide greater control and direct learning. It also makes the owner responsible for execution, inventory, distribution, and any credit losses. Those responsibilities must be explicit and funded. The study does not establish that this route is inferior to a partnership, or that either is ready to operate. Failure to recruit an anchor would reject that attempted route; it would not automatically authorize lending or refute the first-party product.

## 8. Capital and economics without imaginary liquidity

Track four distinct sources of money: customer collateral, operator execution inventory, explicitly granted credit, and savings or other outside funding. Record who owns each, where it is committed, and what can cause its loss or delay. Do not count the same money as reserve, Account collateral, and a new source of liquidity.

Account capacity is specific to the relationship and asset. Inventory securing one customer does not automatically secure another. Opposing flows may reuse capacity, while one-way flow consumes destination inventory and requires replenishment. End-of-day net balance alone does not describe intraday peak funding need.

For a directional external-delivery service, a first approximation is net outflow rate multiplied by replenishment time, plus burst and failure buffers and other committed capital. This is a sizing hypothesis to test on actual flows, not a protocol balance formula. Replenishment can slow or become unavailable precisely when demand is stressed.

External token payouts consume the destination chain's resources even if upstream obligations net internally. TRON staking or delegated Energy can change how those resources are paid for; it does not establish zero economic cost. [TRON resource model](https://developers.tron.network/docs/resource-model)

Evaluate the complete operator business:

> Contribution = execution fees + earned spread + earned financing income − funding, hedging, rebalancing, settlement, distribution, support, infrastructure, and attributable losses.

Report realized results separately from expected-loss and stress assumptions. A short period without default does not prove a low loss rate. Report peak and average capital committed alongside contribution.

The customer comparison includes funding, execution, withdrawal, time to usable funds, manual work, and accepted risk. Compare with the best workflow actually accessible to that customer. A low platform fee is not equivalent to a low total price.

## 9. Credit and savings belong in explicit agreements

Credit can improve a recurring relationship when an identified creditor wants to finance it. The offer must state who lends, what may be drawn, pricing, repayment and expiry conditions, and the unsecured exposure. Signed debt evidence is useful; it cannot produce cash from an insolvent debtor without recoverable assets or other enforceable recourse.

Credit is not required to prove every kind of XLN value. Keeping the same limit while reducing reconciliation work, settlement delay, or recovery ambiguity can justify adoption. The experiment should measure those benefits rather than demand a changed underwriting decision.

I do not accept that unsecured credit is necessarily XLN's only valuable feature. That conclusion risks selecting the most unusual part of the technology and declaring it the product. A borrower can want the owner's money without wanting XLN; a trader can want a subsidized price without valuing the underlying relationship. We need to identify what makes the offer attractive and whether XLN can sustain or materially improve it. Customers need not care about the protocol by name.

When offered, savings remain an independent liability of the bank Entity. Bank funding is pooled according to the existing asset/jurisdiction policy; savers are not silently assigned to particular borrowers. Borrower default does not erase the bank's debt to its savers. On-demand withdrawal requests may queue when payout capacity is unavailable. Signed rate coverage and its expiry remain visible. [Existing lending semantics](../../lend.md)

I would not finance unproven launch economics by acquiring passive retail savings. That is a commercial recommendation, not a proposal to delete Lendbook or disable valid signed obligations. Expanding the customer base for savings requires its own evidence of underwriting, liquidity management, disclosure, and customer demand.

## 10. Pricing and distribution

Sell a completed result and a useful continuing relationship. Let the customer see one comprehensible total price, with its components available before acceptance.

Keep three economic recipients distinct: the operator earning execution or financing income, XLN charging for its product or services, and a distributor earning agreed compensation. Revenue sharing must leave a viable business after costs. Calling a fee a spread or giving an integrator its full markup does not make the total transaction free.

The repository's [launch pilot](../../launch-pilot.md) records an introductory platform-fee waiver followed by 1 bp per payment and 3 bp per swap, plus disclosed costs. That is the current commercial baseline, not evidence of sustainable margins. A different tariff, waiver scope, or composed-operation fee rule needs an explicit business decision. This synthesis does not silently replace it with zero fees or a new daily credit rate.

An operator-led entry would distribute through an existing trading interface, payout process, or payment request. Its test is whether customers voluntarily prefer the XLN-backed process on clear terms. A direct entry would bring customers to XLN for a specific activity and test whether they return. Neither channel is selected by this document.

Once a service demonstrates repeated use, additional distributors can expand its reach. Builder attribution and compensation can help, but no specific fee-splitting mechanism is assumed implemented merely because the state machine can issue payments. Authority, atomicity, failure handling, accounting, and withdrawal capacity still need proof.

The first-party product should also be usable directly. Otherwise XLN risks becoming a hidden supplier whose distributor retains the customer and can replace it without friction. Direct access earns its place through useful agreements and reliable service, not forced lock-in.

## 11. What the precedents actually justify

Hyperliquid's early sequence combined a concrete trading product, initial users, referrals, monetary incentives, and community liquidity. Relay began with a concrete cross-chain minting need and an operator doing the execution work. These histories support taking responsibility for the complete first-user result. They do not prove a universal rule that every founder must operate the first hub, charge zero platform fees, or introduce builder codes before demand. [Hyperliquid Q2 2023](https://hyperliquid.medium.com/hyperliquid-q2-update-7c39c726c45b), [Relay origin](https://relay.link/blog/introducing-relay-v2), [Relay filler operations](https://deor.app/posts/a-year-of-operating-a-filler)

Relay-style integration also leaves execution providers exposed to comparison. Phantom documents choosing among providers by quoted price. That supports treating distribution access as something continuously earned, not captive demand. [Phantom provider selection](https://help.phantom.com/articles/51384804802195)

The practical lesson is to make one desired activity work and organize its missing supply. The choice between an owner-run business and a partner-operated business depends on who already possesses customers, inventory competence, underwriting, and operating capacity. A successful precedent cannot supply those assets by analogy.

## 12. Claims this synthesis refuses to carry forward

These are substantive corrections, not stylistic preferences:

| Claim from the discussion | Correction required before using it |
| --- | --- |
| A hot local Entity key is already a bounded Agent Key. | Prove delegated authority, allowed actions, expiry/revocation, and loss bounds. Funding a separately keyed Entity does not establish those properties. The existing payment adapter explicitly does not provide a general delegated budget. |
| A hub-signed snapshot permits financial execution before independent receipt verification. | Fast display and financial admission have different trust requirements. Do not weaken authenticated state admission to meet a rendering target. |
| Verify only blocks returned by `eth_getLogs` to solve synchronization cost. | A receipt-verification design must also establish the required completeness and canonicality; selected returned logs alone do not prove that relevant events were not omitted. Any optimization needs its own invariant analysis and evidence. |
| A signed unsecured claim is unilaterally collectible money. | Distinguish secured payout, residual debt, and any external collection process. |
| A dedicated Depository eliminates issuer-freeze risk. | It can reduce a shared address's exposure domain; it does not make that address or its users immune to issuer action. It also changes deployment, liquidity, and recovery boundaries. |
| Less than 31% credit utilization kills the product. | Evaluate the complete cost, revenue, risk, and customer benefit. That ratio comes from a particular partial calculation, not a general viability law. |
| The same credit limit on a spreadsheet means no XLN value. | Test operational and recovery improvements as well as credit terms. |
| Three models favor a scope cut, therefore the cut is validated. | A vote among related analyses neither establishes demand nor changes release authority. |

Relevant implementation boundaries include [Depository authorization](../../../jurisdictions/contracts/Depository.sol), [payment-adapter authority limits](../../agent-payments.md), and [authenticated receipt reading](../../../core/jurisdiction/adapter/receipt/reader.ts). No new implementation or benchmark is asserted here.

## 13. The question the next experiment must answer

**What can someone do with XLN so much better that they choose to return?**

It could be exchange, dependable access to liquidity, or a financial relationship that is currently too costly to maintain. The architecture and these documents do not select the answer. The next experiment should test a concrete proposed activity rather than treat operator recruitment as the answer in advance.

Before starting, state the user, the desired outcome, the available alternative, the proposed advantage, who supplies execution and capital, and what observation would change our mind. Set a bounded observation period appropriate to the workflow and a cost budget. A universal six-week sales process or a fixed count of conversations would give this unresolved choice artificial precision.

For an operator-led candidate, obtain an actual workflow and access to the people using it. Compare representative operations, including intraday capital, both asset legs, external delivery, support, and recovery. A partner's enthusiasm without access to customers or willingness to operate the service is weak evidence.

For a first-party candidate, offer one complete activity with explicit terms and observe whether users initiate it, complete it, and return. Record how they found it and what they would otherwise have used. Initial usability can be tested before real-funds activation; testnet behavior cannot establish paid financial demand.

For either route, identify why the offer wins. If the attraction is cheap credit or a subsidized quote, account for the funding and losses needed to maintain it. Subsidies can legitimately purchase initial use; their expense must remain visible, and their withdrawal or sustainable funding must be part of the economic test. Calling the activity organic does not resolve this.

If XLN pays an operator retainer, that purchases supply or integration work. It is not a customer purchase of XLN. A paid evaluation is service revenue, not MML. A signed commitment with priced conditions is useful evidence, but still differs from repeated use of the launched service.

Stop or change the tested offer when its comparative benefit disappears, users reject its actual trust and operating conditions, or its continued use requires economics we cannot support. Record the failure at the level tested: activity, segment, channel, terms, or execution. Failure to recruit a partner is not a universal falsification of XLN, just as one successful subsidized loan is not validation of the network.

After authorized commercial activation, evaluate repeat use at the actual price, full operator contribution, capital behavior, and recovery. A short clean run cannot establish sustainable credit-loss rates. The conclusion should become more specific as evidence arrives, not merely more confident as documents accumulate.

## 14. Launch authority and actual scope choices

The current [AGENTS.md](../../../AGENTS.md) release scope and [mainnet acceptance gate](../../mainnet-acceptance-gate.md) require Pay, same-J Swap, Cross-swap, and Lending on EVM and native TRON, with open participation and mandatory financial/recovery evidence. This document does not waive them. A narrow testnet or commercial evaluation does not certify the full release.

Older [launch-design](../../launch-design.md) passages describe owner-operated hubs and monetary ladders; the current queue and gates contain different requirements. The October release authority cannot be displaced by citing a September plan. Any remaining topology ambiguity must be resolved explicitly before deployment, rather than settled by a research document's interpretation.

My recommendation is to spend the next commercial effort on establishing a concrete reason to use XLN, while preserving required correctness work. There is not yet a selected relationship around which to reorganize the company. If the owner wants to activate a narrower real-funds product before the existing full gate, that is a distinct release decision requiring an explicit scope amendment and a suitable evidence boundary.

Open protocol participation and operator risk limits are separate. An operator can refuse a quote or decline credit it cannot responsibly supply. That does not establish an arbitrary global protocol cap or justify restricting all participants to invited accounts.

Before activation, settle the actual operator and capital commitments, asset/jurisdiction pair, supported signer workflow, fee agreement, legal/commercial permissions, and the evidence required by the counterparties. The study supplies none of those commitments. Contract review and licensing cannot be declared resolved by changing terminology or counting AI reviews.

## 15. What success would look like

The first successful product gives people a reason to return because a financial activity works better for them. It has accountable execution, understandable terms, reconciled outcomes, and a demonstrated exit. Useful continuing relationships may develop from that activity; requiring customers to appreciate the relationship architecture before receiving value would invert the product's purpose.

Report MML according to the existing definition: genuine obligations between unaffiliated Entities, counted once on the commercial edge. Separate it from gross routed traffic, transfers between affiliates, test assets, subsidy, and service revenue. An owner-funded operator's identity and relationships must be classified correctly; the origin of its capital alone does not decide whether a customer obligation is unaffiliated.

The scorecard is compact: quote availability across all requests; completion under accepted terms; total customer cost and time to usable funds; peak and average committed capital; operator contribution; paid repeat use; and recovery outcomes including residual debt.

The strongest positive signal is another customer wanting the same service, on viable terms, without a new protocol feature or a payment for generating activity. Growth then follows adjacent demand for assets, jurisdictions, providers, or financing. Additional operators and outside capital must be able to evaluate an actual service record.

## 16. The disagreement that remains

The anchor strategy can become slow enterprise integration, leave the partner owning the customer, and never create a destination worth visiting. Its willingness to experiment may evaporate when retainers end. A broadly useful first-party product could discover demand faster and capture more of the value.

The owner-run corridor alternative offers greater control and direct market learning. It also requires distribution, execution competence, funded inventory, and risk operations that cannot be inferred from having built the protocol.

The credit-book alternative can create immediate utility for a borrower. It may primarily test the owner's lending judgment, while leaving XLN's incremental value unproven.

My earlier broad application vision preserves the destination but under-specifies the first reason to switch. It becomes credible through a superior activity, not through the completeness of its menu.

I previously chose the existing-operator entry too confidently. It is a reasonable way to seek a real workflow, but a reasonable research sequence is not a discovered strategy. No named partner or customer evidence in this study establishes its superiority. I would test it against a concrete first-party activity rather than make it a prerequisite for pursuing one.

I remain interested in XLN because its machinery could change what a financial provider can offer and what a customer can verify. I remain uncertain whether that advantage is large enough to overcome unfamiliarity, operating burden, and trusted alternatives. Simple presentation helps users access an advantage; it cannot create one that the service does not have.

**My position is simple to use, verifiable underneath, with a serious ambition for XLN's own product. The first activity, buyer, and distribution channel remain unproven. The next advance is evidence of a reason to return.**
