# XLN: the launched product

Author: Codex. Written November 13, 2026.

This is my proposed product vision, informed by the XLN repository, our discussion, and research into Hyperliquid and Relay. It describes the experience and operating business I would aim to launch. Present-tense descriptions below are the target experience, not assertions that those capabilities are deployed today. Recommendations are mine unless explicitly identified as existing owner decisions. This document does not change release authority, protocol rules, or the live queue.

## 1. The product I want to exist

**XLN makes money usable where you need it, on terms you can understand and verify.**

A person opens XLN because they want to pay someone, obtain another asset, borrow working capital, or place money with a financial provider. They specify an outcome. XLN explains the cost and terms, finds executable capacity, obtains the necessary authorization, and carries the operation through to a clear result.

The ordinary experience is simple. The underlying financial relationships remain inspectable. A user should be able to say, “I know what I own, what I owe, who owes me, and what happens if they stop cooperating,” without learning the implementation.

My ambition is larger than a convenient transfer screen. XLN becomes a place where people and businesses can establish useful financial relationships without surrendering all visibility and control to the institution serving them. Payments create reasons to arrive. Reliable execution creates reasons to return. Credit and savings can make those relationships more useful once trust and demand exist.

The central hypothesis is that XLN's signed obligations, reusable capacity, routing, and settlement machinery can support a better financial service after all operating costs and risks are counted. If that hypothesis is false, a beautiful wallet does not rescue the product.

## 2. Who it serves first

I would begin with a small crypto-native business that repeatedly pays independent counterparties and already has an operator responsible for those payments. The first distribution partner would be an existing payout, wallet, or commerce application with recurring payment intent and a budget owner who can adopt another execution provider.

The launch unit is one recurring workflow: a defined source asset, destination asset and network, typical amount range, recipient type, and frequency. It must have observable friction today: unreliable quotes, repeated manual conversion, excessive prefunding, or slow access to usable funds.

This is a selected customer hypothesis, not a claim that a customer has committed. Ethereum–TRON USDT is an existing repository candidate; our research does not establish it as the winning commercial corridor. I would choose the first workflow from actual requests and executable alternatives before spending on its liquidity.

The end user buys completion and predictability. The application buys successful customer operations and lower integration/support burden. The liquidity operator buys profitable flow. All three must have a reason to participate.

Public participation remains open under the existing release policy. Commercial concentration means focusing distribution and funded service commitments on one workflow; it does not mean invitation gates or arbitrary protocol monetary caps.

## 3. A day in the launched product

A business needs its independent supplier to receive 1,000 units of a supported stablecoin on a specified network. The amount is illustrative. The payer holds a different supported asset or holds the right asset in a different place.

The supplier provides an authenticated payment request, or the payer supplies a verified destination. The payer sees the recipient, exactly what the recipient should receive, the proposed funding source, the total debit, quote expiry, expected time to usable funds, and material counterparty or settlement conditions.

The payer can inspect alternatives but does not have to assemble a route. Existing balances and permissions are used only within their signed authority. A required funding transaction or additional signature appears as an explicit step. “One action” is a product goal, not permission to conceal multiple irreversible authorizations.

After approval, XLN gives the operation a persistent identity. Closing the browser or losing a connection does not turn uncertainty into another payment. Returning to XLN resumes the same operation and displays its known financial state.

The receipt states what actually happened. An internal Account payment means an accepted XLN obligation under its terms. Delivery to an external address means the specified asset reached the specified chain destination with the stated confirmation policy. These are different completion conditions.

When destination liquidity is unavailable, the user learns that before accepting an unexecutable quote. When an accepted operation is delayed, XLN explains the current position of the funds, the next responsible actor, and the available recovery action. It does not leave the user guessing whether another click will duplicate the transfer.

The next payment is easier because the recipient, preferences, and necessary relationships already exist. Repetition must reduce work and cost; it must never silently increase accepted credit exposure.

## 4. What the interface contains

I would organize the main experience around three places: **Home, Activity, and Finance**, with prominent Send and Receive actions. Exchange remains directly accessible for someone whose desired outcome is simply another asset. The names are product proposals, not changes already made to React.

The first visit begins with the intended operation and an indicative quote before the user commits funds. The user then connects a supported signer or creates an identity through the supported recovery flow, verifies the destination, and accepts only the relationships required for that operation. Funding delays and initial setup costs are explicit. Opening XLN does not enroll someone in lending, accept an unsecured balance, or transfer signing authority to an operator. An external-address recipient need not become an XLN user where the launched service actually supports external delivery.

Home answers “What can I use now?” It distinguishes available balances, pending movements, savings claims, and amounts owed. A portfolio estimate may summarize value, but it cannot imply that different assets, networks, counterparties, and claims form one universally spendable balance.

Activity answers “What happened?” Each operation has a readable purpose, amount, recipient, cost, status, and receipt. Technical detail expands from that record. A user can distinguish a payment from its routing hops without becoming an accountant for the network.

Finance answers “What agreements do I have?” It contains loans, savings, accepted facilities, repayment dates, withdrawal requests, and the providers responsible for them. It is accessible from launch without making a first-time payer navigate a lending marketplace.

At the moment a decision matters, the interface shows the relevant network, asset identity, counterparty, authority, and risk. A shared ticker never establishes fungibility across jurisdictions. Familiar presentation must not erase financial distinctions.

Enthusiasts can expand an operation into its route, signed terms, Account collateral, unsecured portion, proof freshness, dispute deadlines, and recovery requirements. They can inspect and export evidence without using a separate financial product or a second source of accounting truth.

## 5. The four financial capabilities

The existing owner scope includes Pay, same-jurisdiction Swap, Cross-swap, and Lending on EVM and native TRON. I would keep those capabilities while making the user's intended result the organizing principle.

| Capability | User intention | Product obligation |
| --- | --- | --- |
| Pay | “This recipient should receive this amount.” | Identify recipient and asset, quote the full debit, and confirm the correct completion condition. |
| Same-jurisdiction Swap | “I want this asset instead.” | Show executable output, price impact, fees, expiry, and failure behavior. |
| Cross-swap | “I need this asset on that network.” | Identify both assets and jurisdictions, disclose timing and inventory conditions, and explain recovery across both legs. |
| Lending | “I need financing,” or “I accept lending to this provider.” | Present the actual debtor, signed terms, repayment or withdrawal conditions, and secured/unsecured exposure. |

A payment that requires conversion can ultimately compose these capabilities. That is a target user journey requiring end-to-end production proof; the existence of four separate working flows does not prove atomic composition, exact-output delivery, or a single-signature experience. Until a particular combination is supported, XLN presents its real steps and boundaries.

External-wallet funding and withdrawal are part of the complete experience. They must be included when comparing XLN with another service. An already-funded internal transfer is a different workload from getting money into and out of the system.

## 6. Lending as an explicit relationship

I want lending to make an existing financial relationship useful, rather than become a reflexive yield acquisition campaign.

A borrower receives an offer from a named bank Entity. The offer specifies principal, asset and jurisdiction, interest, term, permitted late-interest bounds, and repayment rules. A preapproved facility can authorize draws within its signed terms; opening the application does not create an unsecured credit entitlement. Automatic draws require the existing explicit authority and must remain understandable to the borrower.

A saver lends to a named bank Entity and receives an independent claim against that bank. The bank funds loans through its common pool for the relevant asset and jurisdiction. The product does not suggest that a particular saver is matched to a particular borrower. A borrower default does not erase the bank's liability to its savers.

Fixed-term and on-demand savings have distinct terms. On-demand means a user can request withdrawal; actual payout still requires liquidity and Account capacity. A queued withdrawal remains money owed, not completed cash delivery. Variable-rate coverage, prospective amendments, expiry, and any period without signed interest coverage must be visible. These semantics follow the existing [lending product](../../lend.md).

I would show the provider's identity, the user's own secured and unsecured position, and the conditions under which payment can be delayed or lost. I would not imply deposit insurance, guaranteed yield, automatic oracle liquidation, or fungible collateral across jurisdictions.

The bank earns a lending margin for capital allocation and underwriting. That margin compensates a real responsibility. The protocol cannot manufacture a creditworthy borrower or make an insolvent bank pay an unsecured remainder.

## 7. How the first operation gets executed

The first user must obtain value without recruiting a counterparty or designing a liquidity network.

I recommend that an XLN-associated operator be willing to provide initial execution capacity using its own explicitly allocated capital, alongside independently operated hubs and market makers. This is a proposed operating responsibility, not authorization to deploy money or hold user signing keys.

The associated operator publishes the routes and sizes it can actually service, quotes real inventory, funds its settlement obligations, and maintains the necessary recovery operations. Its pricing and losses are accounted for separately from protocol revenue. It cannot be presented as several independent providers through multiple processes or Entities.

The repository currently calls for multiple independent hubs and market makers. A single operator can demonstrate a commercial workflow but cannot establish that independence requirement. My vision does not relabel such a demonstration as release-ready resilience.

Capital comes from identifiable sources: operator equity, market-maker inventory, and separately authorized bank funding or credit arrangements. Each has an owner, cost, exposure, and withdrawal constraint. User balances are not silently repurposed to finance a launch.

The product earns additional liquidity providers by showing flow they can profitably serve. Open operator participation gives others the ability to compete; it does not guarantee their participation or their economics.

## 8. What the machinery must earn

The machinery inside XLN is valuable if it changes an economic outcome.

Repeated obligations may reuse bilateral capacity. Routing and rebalancing may reduce idle fragmentation. Signed state and explicit settlement rights may reduce some reconciliation and counterparty ambiguity. Credit may make capital available when a named creditor accepts the exposure.

These are hypotheses to measure against the same workload and acceptable risk. One-way net outflow still needs destination assets. Credit transfers risk to someone; netting does not create cash. Routing does not make collateral in one Account freely available everywhere.

For the customer, the advantage should appear as better total price, more reliable execution, less capital committed to the workflow, or fewer operating interventions. For an operator, it should appear as viable contribution after funding, hedging, rebalancing, infrastructure, support, and losses.

My preferred public demonstration would use a genuine recurring commercial workflow, compare the best accessible alternative, show peak and average capital tied up, and complete an exit. A second demonstration would show a controlled provider outage and the actual user outcome. I would publish where the advantage disappears, including one-way flow and expensive exit conditions.

An animation of money moving through a graph is useful education. It is not evidence of superior economics.

## 9. Trust, recovery, and control

XLN should make control concrete. Users authorize their own financial actions and can inspect the rights they have accepted. An execution provider does not need their owner keys. A valid signature, a provider endorsement, and an operational health indicator have different meanings.

The experience makes four questions answerable: who can move the funds, what secures the claim, what remains unsecured, and what the user must do if cooperation ends.

For disputes, relevant conditions include current signed evidence, response windows, functioning monitoring, gas funding, chain availability, and economically sensible enforcement. Small claims may cost too much to recover through dispute. The product must state that limitation without suggesting that shared hub reserves guarantee individual withdrawal.

Current [dispute-protection UI](../../../ui/src/components/DisputeProtection.tsx) explicitly distinguishes appointment acceptance from a successful on-chain response and warns about stale proofs and disabled response workers. The launched experience must preserve that honesty while automating routine maintenance wherever proven safe. A green “protected” badge cannot substitute for current evidence.

Recovery is a normal product journey. Users can locate their signed evidence, restore the relevant state, understand an ongoing dispute, and follow the applicable exit path. Browser closure, provider failure, lost local data, chain outage, and insolvency are different events with different consequences.

Private bilateral state and encrypted transport do not establish anonymity. The product explains what counterparties, operators, and public settlement chains can observe.

The canonical React wallet provides this experience. The design does not assume a new custody service, native app, browser extension, or that a new cryptographic recovery primitive alone solves onboarding. The initial supported signer and recovery workflow must be demonstrated as a whole.

## 10. The service behind the interface

The launched product includes an operating organization. Someone owns liquidity replenishment, quote availability, settlement failures, customer communication, and recovery incidents. That owner is identifiable for each service relationship.

An operator workspace should expose actionable work: accepted operations awaiting completion, inventory constraints, expiring quotes, own funding needs, bank withdrawal queues, overdue loans, and recovery duties. Its data comes from canonical state and evidence; the workspace does not become another financial ledger.

A distributor receives a quote/authorize/status/receipt integration with documented supported routes and failure states. Retries preserve operation identity. Application fulfillment remains idempotent. “Submitted” never means that the merchant has been paid.

For a payment unresolved at a deadline, the user sees the known state and a support path tied to the same operation. Refunds or unwinds are reported only when actually completed under the applicable mechanism. XLN cannot promise to reverse an external transfer that is already final.

I would make execution quality and incident handling part of the commercial offer. Support is a delivery cost to measure, not an invisible founder subsidy.

## 11. How people discover and adopt it

I would use one embedded distribution relationship to concentrate the first repeated workflow, while maintaining a first-party XLN application where users can inspect, manage, and exit their relationships. The application demonstrates the whole product and gives users continuity beyond one distributor.

The integration appears where the user already intends to act: a payment request, payout screen, or checkout. It presents an executable result and transparent conditions. The distributor has a concrete incentive: more successfully completed operations, less support work, or a justified share of actual revenue.

The first-party landing page would lead with a sentence such as:

> **Send the asset they need. See the full cost before you confirm.**

It would immediately show supported assets and networks, current service availability, and an honest execution example. Deeper material would explain the banking relationships and settlement system. No invented instant-everywhere claim, unsupported cheapest-price claim, or suggestion of universal asset support.

I would earn enthusiast distribution through inspectable operation and recovery evidence, public technical explanations, and tools to verify claims. These users can explain why the system matters and expose where it fails. They deserve access to the machinery rather than promotional mystique.

I would avoid a speculative token launch or volume-based points campaign as a prerequisite for demand. If incentives are used, they purchase a defined benefit such as reliable liquidity at requested sizes or a productive integration. Affiliated circulation and manufactured volume cannot demonstrate adoption.

## 12. What I take from Hyperliquid and Relay

Hyperliquid organized a place to trade, including supply. Its early sequence included a small alpha, referrals, USDC trading rewards, and community liquidity through HLP. Later rewards did not create the entire product from nothing. My inference is that complete first-user utility and responsibility for execution mattered more than an abstract commitment to decentralization at every launch layer. [Hyperliquid Q2 2023](https://hyperliquid.medium.com/hyperliquid-q2-update-7c39c726c45b)

Relay began with a concrete cross-chain minting need around Zora, within an existing developer-infrastructure business. Its operator described running the UI, gateway API, and main filler, including the inventory and risk work behind execution. My inference is that proximity to existing intent and willingness to do operational work were central advantages. [Relay's origin](https://relay.link/blog/introducing-relay-v2), [filler operator's account](https://deor.app/posts/a-year-of-operating-a-filler)

I would copy those commitments, not their visible aesthetics or reward schedules. XLN must make the desired action work for an arriving user and own the missing coordination.

There is a strategic tension. A venue can accumulate concentrated activity; an execution provider can be compared and replaced. Phantom's documented provider selection illustrates this pressure on Relay. XLN must continue earning its distribution through performance and build direct user value through useful financial relationships. We cannot assume an integration becomes captive flow. [Phantom provider selection](https://help.phantom.com/articles/51384804802195)

These histories support design judgments. They do not establish XLN's winning corridor, acquisition cost, profitability, or future retention.

## 13. Pricing and the business

The user's price is the total cost of the chosen outcome. Platform fees, provider fees, spread, chain costs, and any financing charges are visible before authorization to the extent they are fixed or bounded. Unbounded execution cost cannot be hidden inside a supposedly fixed quote.

The existing [launch pilot](../../launch-pilot.md) records owner-approved commercial terms of zero platform fees for the first 30 days, followed by 1 basis point per completed payment and 3 basis points per completed swap, plus disclosed costs. I would use that as the initial commercial hypothesis while distinguishing approved business terms from deployed accounting and profitability evidence. The waiver's applicable start event and a composed payment/swap's fee treatment must be explicit in the published offer before charging.

Revenue can come from execution fees, the economics of a separately identified operator, lending margins at the responsible bank, and contracted services where a buyer values them. These cannot all be booked as protocol revenue or counted twice.

The core calculation is:

> Contribution = fees and earned execution/financing margin − funding, hedging, rebalancing, settlement, distribution, support, infrastructure, and attributable losses.

Expected-loss assumptions and realized losses are reported separately. Capital tied up is reported alongside contribution. A low-fee service that requires permanently subsidized capital is not a sustainable business merely because its software is efficient.

I would share revenue with distributors only from an explicit commercial arrangement and a viable cost model. No fee percentage is defended as sacred if the complete service cannot support it. Conversely, an introductory subsidy is labeled as acquisition spending rather than evidence of structural cheapness.

## 14. How the network becomes worth joining

The desired loop begins with useful operations. Repeated activity makes flow more predictable. Predictable flow can attract better-priced capacity. Better execution improves the product for customers and distributors. More counterparties may then find useful financial relationships on the same system.

Every arrow is conditional. An unbalanced corridor can demand more capital as it grows. Additional hubs can add complexity without improving usable routes. A distributor can capture most of the savings. Greater credit exposure can make attractive short-term growth dangerous.

The durable advantage I would pursue is a combination of efficient execution, useful existing relationships, verifiable rights, and a record of successful recovery. Code availability alone does not establish that advantage. Neither do locked balances or the inconvenience of leaving.

Expansion follows observed adjacent demand: another requested asset, another genuinely needed destination, another independently useful operator, or financing for recurring counterparties. The first lending customers should be understandable borrowers with explicit facilities; payment volume alone is not an underwriting model.

Agent payments can use the same production capabilities where merchants explicitly accept XLN. I would retain the existing experimental adapter as an integration surface, without claiming that it already pays arbitrary external payment endpoints or enforces a general delegated spending budget. Those limits are documented in [agent payments](../../agent-payments.md).

## 15. What launch means

Commercial launch means a real unaffiliated customer can discover the service, understand the terms, obtain an executable offer, authorize it, receive the promised result, get help when something goes wrong, and exercise the applicable exit. A demonstration missing the last two is incomplete.

The existing financial and recovery release gates remain authoritative. Pay, both swap forms, and lending must have their required production-path evidence on the supported jurisdictions. Native TRON requires native evidence; two EVM environments do not substitute. Marketing cannot turn a testnet pass into real-funds authority.

The service also needs named capital providers, actual executable capacity, accountable operators, a complete fee policy, and the operational and legal arrangements appropriate to what those operators do. I am not asserting that those arrangements exist today.

My proposed commercial evaluation lasts 60 days after launch: five unaffiliated businesses use the selected workflow in the first 30 days, and at least three repeat at the applicable paid price by day 60. This is a deliberately small evaluation target, not a forecast or a replacement for safety gates. Repetition, total cost, capital use, and support burden decide whether it deserves expansion.

## 16. How I would judge the product

The primary outcome is recurring useful financial activity between unaffiliated parties. MML follows the repository's definition: count the commercial obligation once, not every hub hop or affiliated transfer. Traffic, submitted commands, internal round trips, and faucet activity remain separate.

I would keep a compact product scorecard:

| Question | Measure |
| --- | --- |
| Does the product answer actual demand? | Executable quotes divided by genuine requests, including unavailable quotes. |
| Does it deliver? | Accepted operations completed under their stated terms; unresolved cases and losses shown separately. |
| Is it better for this workflow? | Full-cycle cost, time to usable funds, manual work, and capital committed against the best accessible alternative. |
| Do customers choose it again? | Repeat unaffiliated users and retained workflows after subsidies expire. |
| Can the service sustain itself? | Contribution and peak/average deployed capital by route and operator. |
| Can users recover? | Actual drills and incidents with secured recovery, residual debt, user cost, and time reported separately. |

Performance claims must identify funding and finality assumptions and distinguish internal completion from external delivery. Technical throughput remains an engineering constraint; it is not the product's demand metric.

Before each commercial experiment, the owner should agree a time window and comparative threshold. If customers will not repeat at a viable price, or the strongest available substitute wins once capital and risk are included, we change the commercial hypothesis. More protocol breadth cannot be used to postpone that conclusion indefinitely.

## 17. The strongest case against this vision

This could become an expensive execution provider attached to a wallet nobody needs. Customers may prefer existing wallets and intermediaries. Distributors may route away any time a competitor quotes better. The apparent capital advantage may vanish once realistic one-way flows, reserves, hedging, and exit economics are included. Lending may add credit losses before distribution is strong enough to support underwriting.

There is also a deeper objection: hiding the machinery may hide the only reason to choose XLN. If existing products already provide the same user result, “simpler” does not create differentiation.

That is why the vision needs one demonstrably superior workflow and one legible explanation of the financial capability behind it. If the real advantage is a new kind of banking relationship, the product must let people experience that advantage directly. We should not flatten it into an interchangeable transfer widget merely to resemble Relay.

I am choosing embedded execution as the first distribution hypothesis because it can meet existing intent. I would change that choice if evidence showed that a distinctive first-party financial activity attracts and retains users better. Hyperliquid makes that alternative credible; it does not supply XLN with that activity automatically.

## 18. The finished product's character

XLN should feel calm. People can see what will happen before committing, recognize what happened afterward, and find what to do when events diverge from the plan. Ordinary successful use should require little explanation.

Under that simplicity, curious users find a financial system worth understanding: explicit obligations, controllable exposure, reusable capacity, and inspectable settlement rights. The sophistication earns its place through better results.

The product I want to launch lets a customer say: **“I used XLN because it worked better for my money. I stayed because the relationships became useful, the terms stayed clear, and I could verify my way out.”**
