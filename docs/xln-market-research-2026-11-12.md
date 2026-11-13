# XLN market cases and unmet demand

Research snapshot: 12 November 2026. Saved at the owner's request on 13 November 2026.

XLN's technical claims are assumed to hold for this market comparison. Its credit limits do not guarantee repayment: only the allocated collateral-backed entitlement is secured. A financing comparison must name the lender and count capital, operating costs and risk across all participants.

The research found five documented settlement relationships, but no demonstrated all-in economic winner for XLN. A separate search for underserved companies produced two first-person pain reports from 2026, two historical requests and one weak lending-market candidate. It did not establish five currently unserved buyers. Public complaints and product documentation do not replace customer transaction records, financing offers or willingness to pay.

## Existing settlement relationships

### Zerocap and Deribit through Fireblocks Off Exchange

Zerocap's published customer story describes exchange exposure limiting its trading business and operational pressure from multiple infrastructure stacks. The operating model already keeps collateral in a Fireblocks Collateral Vault Account outside the exchange. Deribit's custody policy says the client controls this environment while Deribit holds a signing keyshare for settlement. [Customer story](https://www.fireblocks.com/customers/zerocap), [custody policy updated 14 October 2026](https://support.deribit.com/hc/en-us/articles/25944547383453-Custody-Policy).

The strongest alternatives are the existing Fireblocks integration and Copper ClearLoop. Deribit's July 2026 comparison lists daily off-chain subledger settlement for Copper and daily on-chain settlement above a threshold for Fireblocks. Avoid claiming that either off-exchange collateral or avoiding a chain transaction for every trade is unique to XLN. [Deribit comparison](https://support.deribit.com/hc/en-us/articles/26533163120413-Custody-Options).

XLN could standardize signed financial relationships with additional independent counterparties if those parties accept its evidence and collateral arrangements. It does not provide Deribit's derivatives execution or margin engine. Adding another stack can increase the switching cost for a firm already consolidating infrastructure.

Missing inputs: contracted fees, average and peak collateral, haircuts, settlement traces, remaining manual work and venue acceptance of XLN evidence. Existing collateral is encumbered and cannot be counted as freely reusable capital.

### Felix Pago and Bitso for US to Mexico remittances

Circle documents USD paid by debit or ACH, conversion to USDC, transfer on Stellar, conversion by Bitso to MXN and bank payout through SPEI. It attributes a fee decrease from $4.98 to $2.99 and reduced peso prefunding to this stack. These are provider-published customer results. [Circle case](https://www.circle.com/case-studies/felix), [Stellar case](https://stellar.org/case-studies/felix-bitso).

Stripe also describes Felix using Bridge for liquidity and conversion. The documented Bitso route is not evidence that Felix uses only that route today. [Stripe case collection, page 3](https://assets.stripeassets.com/fzn2n1nzq965/47sG24RRYFpAYvNQ3jp0pk/2859605ee68865b61675b6a9ecbc9bd5/Nine_ways_companies_are_using_stablecoins_and_crypto_to_grow.pdf).

The strongest baseline is the optimized stablecoin stack plus a credit facility for remaining funding needs. Arf is a separate comparator: it underwrites payment companies, advances USDC to payout partners and receives repayment in one to five days. No Felix-Arf relationship was established. [Arf mechanism](https://www.circle.com/case-studies/arf).

XLN could service remaining bilateral credit between repeat operators and payout partners. It cannot create MXN liquidity, card acquiring or SPEI access. A one-way US-to-Mexico flow does not establish large netting opportunities.

Missing inputs: prefunding after the USDC implementation, all participants' balances, financing terms, FX spreads, acquiring and payout costs, reverse flows and willingness to accept bilateral obligations. Compare XLN with the current stack rather than the retired SWIFT baseline.

### OpenRouter and DeepInfra

DeepInfra is listed as an OpenRouter provider. Current provider onboarding requires monthly invoicing. Standard and Business customers buy credits in advance, while Enterprise can use postpaid invoicing. DeepInfra's individual contract is not public. [Provider listing](https://openrouter.ai/provider/deepinfra), [provider requirements](https://openrouter.ai/providers/apply), [customer plans](https://openrouter.ai/business).

This weakens the original API-broker hypothesis. The aggregator may receive customer money before paying providers; the actual float requires private records. Its ledger already avoids a separate external payment per inference request. The platform fee pays for a broader service and cannot be treated entirely as removable payment cost. [Pricing](https://openrouter.ai/pricing).

XLN could give a customer or provider signed financial evidence and an independently enforceable collateral-backed entitlement. More frequent provider payment may benefit that provider while worsening the aggregator's funding cycle. Existing prepaid ledgers, monthly invoices and enterprise terms are strong alternatives.

Missing inputs: actual payment dates, prepaid balances, provider financing costs, credit losses, early-payment discounts and the party willing to pay for different terms. No positive all-party switching economics were established.

### Rosso Di Sera B&B and Sardex suppliers

This is a historical case published on 7 June 2016. Claudia Marceddu describes expanding her B&B in Alghero by two rooms using Sardex credits with 18 named suppliers, including Itabita, Ceramica Club Erre, Proenergy and Ichnos. The continued existence of these exact trading relationships in 2026 was not established. [Network interview](https://circuitofelix.net/claudia-marceddu/), [dated archive](https://circuitovenetex.net/category/sardegna/page/32/).

The strongest alternative is Sardex itself: commercial credit, centralized accounting and brokers who help members find buyers and suppliers. Current product material describes interest-free credit, no per-transaction fee and annual membership charges. [Products](https://www.sardexpay.net/prodotti-servizi/).

XLN could reduce dependence on the accounting operator and support independently enforceable allocated collateral. It does not produce room bookings, find builders or underwrite members. Requiring new collateral changes the economics of the original credit network.

SRD is not a redeemable euro balance. The nominal 1 SRD = 1 EUR convention values goods; the rules exclude conversion of the credit balance into ordinary currency. An EUR exit would require new backing and agreements, not merely a ledger migration. [Currency rules](https://www.sardexpay.net/knowledge-base-web/la-valuta-del-circuito-il-credito-sardex/).

Missing inputs: project invoices, member balances and limits, membership charges, defaults, broker workload, credit spending times and demand for independent enforcement. This is a close financial-model analogue, not a proven replacement opportunity.

### We Love You and Walmart through C2FO

The case dated 24 May 2023 describes a sauce supplier funding advance ingredient purchases while cash remained in outstanding invoices. It selected approved invoices and offered discounts for early payment. Current individual terms are unknown. [Customer case](https://c2fo.com/resources/customer-success/we-love-you/).

Walmart's FAQ confirms supplier-selected invoices and discounts, with no C2FO platform fee charged to the supplier. The discount remains an economic cost. [Walmart FAQ](https://corporate.walmart.com/content/dam/corporate/sams-club/documents/sams-club-suppliers/walmart-early-payment-program-faq.pdf).

The existing program supplies the central benefit: actual early cash from the buyer. XLN could service agreed financing, but a signed obligation does not fund ingredient purchases. Invoice approval, delivery disputes, the funder's capital and its price remain separate inputs.

Missing inputs: invoice amounts, days accelerated, actual discounts, alternative funding offers and the portion of cost attributable to financial administration. The existing program is more complete for the documented need; relative cost cannot be calculated from public information.

## Candidates with financing or access pain

| Candidate | Evidence status | What the evidence establishes |
| --- | --- | --- |
| Nexroute / Remora Technologies | First-person report in June 2026; business identity confirmed in October | Startup infrastructure costs and proposed reward retention conflict with operating liquidity. |
| Sector Finance | First-person report in May 2026; historical revenue disclosure | The team considers the path from reward retention to independent bonding economically too long. |
| Laertes Capital LLC | Direct request in 2022; proposal inactive | Small crypto credit is poorly served by bank fixed costs and existing collateral arrangements. |
| OTEX | Credit request in 2022 and resolver-access concern in 2023 | Inventory and staking capital constrain execution opportunities. Present conditions are unknown. |
| Elk Crypto | Indexed lending-market snapshot; direct live values not verified | A public borrowing offer exists. Low utilization alone does not establish financing rejection or unmet demand. |

### Nexroute and Sector Finance

Nexroute's representative described heavy infrastructure costs and thin or negative early margins. Sector's representative estimated that accumulating a full bond from proposed retained rewards could take about 16 years. That is the team's estimate, not an independently reproduced calculation. A November 9 redraft was still a proposal: do not report proposed fees as realized company expenses. [Nexroute comment](https://forum.cow.fi/t/cip-draft-simplifying-the-operations-of-the-cow-dao-bonding-pool/3455/8), [Sector comment](https://forum.cow.fi/t/cip-draft-simplifying-the-operations-of-the-cow-dao-bonding-pool/3455/2), [redraft](https://forum.cow.fi/t/cip-draft-simplifying-the-operations-of-the-cow-dao-bonding-pool/3455/9).

Nexroute's terms identify Remora Technologies Corp. Sector reported $33,000 quarterly revenue in February 2025; current revenue is unknown. [Nexroute terms](https://www.nexroute.io/terms/), [Sector update](https://medium.com/@Sector_Fi/strategic-update-delivering-results-2085ff3f1824).

A funded bilateral facility could cover operating expenses or permitted bonding capital with explicit limits, draws, repayments and agreed backing. The hypotheses require a willing lender and positive operating economics before financing. Credit does not repair a structurally unprofitable solver. XLN cannot waive CoW admission, bond or slashing rules, or pledge the same encumbered bond to another creditor. Compare fees on solver rewards with financing APR using their different bases.

Priority data: current P&L, desired facility size and duration, accessible collateral, current bonding tier, existing funding offers, and a lender willing to price default and slashing exposure.

### Laertes Capital and OTEX

In 2022 Laertes Capital's founder said banking paperwork and due diligence were disproportionate for $10,000-$30,000 credit and discussed a larger DAO line. OTEX supported a line for inventory and larger orders. Both appear in the same inactive discussion; neither establishes current demand. [Original requests](https://forum.cow.fi/t/cip-draft-laertes-capital-market-making-line-of-credit/1215).

OTEX separately questioned investment in 1inch Fusion when execution privileges depended on a top-five staking rank. That 2023 thread also records a process to expand access. XLN does not override another protocol's admission policy. [OTEX access discussion](https://gov.1inch.network/t/increase-numeber-of-whilisted-resolvers/431).

These cases support the mechanism of small professional credit, not a current sales pipeline. Verify business continuity and financing needs before treating either as a lead.

### Elk Crypto

An indexed Wildcat profile showed USDC and USDT borrowing markets with limits far above funded balances. The direct page returned a client-rendered shell, so the snapshot is not a verified current block observation. Unused capacity may reflect configuration, pricing, credit risk or low demand; it is not evidence that banks refused financing. [Borrower profile](https://app.wildcat.finance/lender/profile/0x03d1820340bf20ed322a954461bd002ef4f9bfaf), [independent pool monitor](https://defillama.com/yields/pool/9226d5b8-76fd-4d35-8ad8-9a8adff14b5e).

XLN might reduce cash borrowing if repeat trading counterparties voluntarily accept bilateral credit and allocated collateral. Wildcat already supports individual private-credit terms. The outstanding question is whether a financial mechanism prevents a deal, or lenders simply do not want the borrower's risk.

## Crypto infrastructure findings at the snapshot date

- Relay's current publication described Relay Chain as live, with incremental rollout intended to improve solver capital efficiency. Relay Vaults were winding down, with new deposits disabled and withdrawal UI available until 31 December 2026. Do not reuse old Vaults marketing as a current product description. [Relay Chain](https://www.relay.link/blog/relay-raises-series-b), [Vault status](https://docs.relay.link/references/protocol/vaults/overview).
- Open Intents Framework includes contracts and solver tooling. Its repository describes order purchasing / underwriting for faster capital rotation. The existence of code does not establish deployment-wide use. [OIF](https://github.com/openintentsframework/oif-contracts).
- Liquorice already combines solver execution with inventory lending. A capital-layer proposal must compare against this mechanism, not an imaginary world where every solver uses only its own cash. [Liquorice flow](https://liquorice.gitbook.io/liquorice-docs/intro/general-flow).
- Hyperliquid's current unified account and portfolio margin include all HIP-3 DEXs. Ripple Prime announced cross-venue institutional access. Old claims that there is no unified margin are stale; specific access limits do not establish a named firm's rejection. [Portfolio margin](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/portfolio-margin), [Ripple Prime](https://ripple.com/ripple-press/ripple-announces-support-for-hyperliquid-expanding-institutional-access-to-onchain-liquidity/).

## Commercial implication

The strongest observed research direction is small professional solver financing. Borrower demand for money is not yet demand for XLN. A decisive next result would be a willing creditor explaining which XLN property enables a transaction it would otherwise decline or makes the relationship materially cheaper to service.

For a real transaction trace, compare capital and costs across every participant under explicit credit, collateral, custody and default assumptions. Separate financing from payment transport and distribution from execution. Count an unaffiliated commercial obligation once, not its hops, retries or internal rebalances.

The existing-customer cases mostly describe successful incumbent implementations, so they reveal switching barriers rather than prove absence of unmet demand. The underserved-candidate search did not confirm a five-company current market. Private terms, current cash flows and willingness to pay remain the key gaps.
