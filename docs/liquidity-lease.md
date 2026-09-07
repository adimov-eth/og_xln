# Liquidity Lease and Capacity Preparation

Status: research; owner clarification 2026-09-06 — **per specific request with a timeout**.
The financial implementation of guaranteed request execution is not yet complete.
UI and directions: [receive-capacity.md](receive-capacity.md).
Regulatory constraints: [fints.md](fints.md), [rjea-architecture.md](core/rjea-architecture.md).

## Decision in One Paragraph

Inbound Spectrum prepares the missing capacity of a specific Account/token.
For sending, the owner chose a simple transition into a filled Move from Pay:
own reserve/on-chain wallet→own collateral, then Pay confirmation.
Outbound credit Spectrum is excluded from the current feature.
For receiving: collateral belonging to the hub and allocated to this Account, or
a permanent credit grant from the user to the hub. The hub reserves capital for the specific
accepted request until its execution or timeout. The user sees the price, the deadline,
the risk, and the result before signing. Arbitrary term-based lease is excluded from v1.

## What Is Taken From Lightning

| Mechanism                                                                                 | Verified meaning                                                                                                                     | Application in xln                                                       |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [Loop](https://docs.lightning.engineering/lightning-network-tools/loop)                  | Out frees inbound by exchanging LN balance for on-chain; In replenishes outbound                                                     | Moving your own money separately from leasing someone else's             |
| [Loop CLI](https://docs.lightning.engineering/lightning-network-tools/loop/the-loop-cli) | Separate fees/limits; prepay protects the already-spent resource from non-completion by the client                                  | Limited prepayment for preparation, a clear maximum of non-refundable costs |
| [Pool](https://lightning.engineering/posts/2021-12-16-pool-prod-update/)                 | Leasing channel liquidity for a term; script-enforced lease limits the seller's early withdrawal                                     | A commitment for a J-term, not a flag in the UI                          |
| [CLN Liquidity Ads](https://docs.corelightning.org/reference/funderupdate)               | Lease for 4032 blocks in the described mechanism, base/proportional/funding fees, reserve tank and limits                            | Hub reserve, concentration limit, explicit price                         |
| [LSPS1](https://github.com/lightning/blips/blob/master/blip-0051.md)                     | Order, funding deadline, confirmations, term, refund; the purchase is not declared atomic                                            | Full execution and refund state machine                                  |
| [LSPS2](https://github.com/lightning/blips/blob/master/blip-0052.md)                     | JIT preparation on arrival; fee from the first payment; minimum lifetime/max delay; griefing via offline/withheld preimage is described | On-demand preparation, limiting the capital-lock tail                    |
| [Phoenix](https://acinq.co/blog/phoenix-splicing-update)                                 | Modifying an existing channel and understandable management cost                                                                     | One Account, shared UX, without separate products on every page          |
| [Autoloop](https://docs.lightning.engineering/lightning-network-tools/loop/autoloop)     | Thresholds, budget, fee limits, backoff                                                                                              | Self-balancing with limited churn                                        |

Loop is not a term lease of capital. Lease does not promise the availability of all
routes or permanent free capacity after it has been spent.
Support for Pool's script-enforced lease was additionally verified in
[channel_acceptor.go](https://github.com/lightninglabs/pool/blob/master/channel_acceptor.go);
older Pool pages about its absence are outdated. Market availability and current
service tariffs were not verified. The page with current Phoenix fees returned 403.
Someone else's pseudocode arithmetic cannot be carried over without our own test vectors.

## What Exactly Is Leased

Accepted for v1: **capital allocated for a request until execution or timeout**, with proven
usable capacity for the chosen operation. After receiving the money, part of the collateral may
already be supporting the resulting obligation. This is not free hub capital again.

A guarantee of "always keep X inbound free" would require constant replenishment,
new turnover limits, and a different price. We do not include it silently in the regular lease.
A timeout ends an unexecuted request, but does not erase existing debt or the parties' rights.
Withdrawal is permitted only for the genuinely free portion and via canonical settlement.

For SEND, depositing the hub's money into the USER allocation does not by itself create debt:
[Depository.sol:780](../jurisdictions/contracts/Depository.sol#L780) debits the sponsor's reserve
and allocates collateral to the recipient. The latter can spend it.
Repayment does not follow automatically from the sponsor's identity;
[Account.sol:1227](../jurisdictions/contracts/Account.sol#L1227) requires an agreed-upon
transition. Therefore the current SEND uses its own replenishment via Move.
It cannot be implemented as a free rent-to-user R→C; a separate loan protocol
is not part of this feature.

## Quote

Proposed terms of a single signed quote:

- domain/jurisdiction/contract, hub, recipient, Account, token, direction, nonce;
- useful volume, the source of the principal and its allocation, exact gross/net;
- separate service fee, funding/return cost, risk/reservation fee, fee token;
- the last J-moment for acceptance, funding deadline, operation deadline, exact request binding;
- required finality, release/dispute conditions, refund and the client's maximum payment.

The signature binds all economic fields. The user accepts a specific price;
the hub does not recalculate an accepted quote after a rise in gas or load.
An expired quote or a change of material terms requires new consent.
An unused quote does not reserve capital forever. Final reservation
happens on committed acceptance, after a repeated check of available resources.

Fungible ERC-20/TVM token amounts cannot be added across jurisdictions.
When paying in a different currency, an agreed conversion quote and its term are fixed;
the UI does not bring a price from an external API into the deterministic transition.

## Three Times

1. **Quote expiry:** up to which confirmed J-moment the price can be accepted.
2. **Funding deadline:** when the promised capacity must become available, or the refund fires.
3. **Operation deadline:** up to which J-moment the specific request can be executed;
   readiness occurs only after confirmed funding. This is not a separate lease term.

Separately shown is the **dispute tail** — the possible delay in releasing capital.
The recommended v1 uses finalized J-blocks in a specific jurisdiction.
Duration is shown to the human as a time estimate, not as an exact conversion of blocks
to seconds. If a J timestamp is chosen, that is a different, explicitly fixed clock mode,
not an automatic fallback to local clocks. Cross-j preserves the clock of each leg.

There is no ready-made lease clock in xln: existing local timestamps/Account heights
do not substitute for confirmed J-time. Reorg/recovery must go through the current
canonical watcher and finality rules; a UI timer does not trigger a financial transition.

## Execution State Machine

```text
quote → accepted/reserved → funding → ready → request_executed → releasing → released
                              └ failure/deadline → refund_due → refunded
```

This is a proposal of financial phases, not an instruction to create a second durable workflow store.
The terms accepted, funded, and ready are not interchangeable:

- Drag changes only the preview. No tx and no hidden credit increase.
- Accept binds the signatures, the reserve, and the permissible payment; an exact duplicate is idempotent.
- After WAL commit, Runtime executes the existing J batch/output.
- Ready is derived only from a committed Account delta after a confirmed J event.
- Further on, a fresh planner re-checks capacity, quote, and holds for the payment itself.

If the operation changed during funding, do not send the stale swap automatically.
Auto-continuation is permitted only within pre-signed amount/slippage/fee limits.
The UI may unlock the form without automatic sending — these are different consents.

Funding deadline does not make an instant reversal of an already-included R→C possible.
If confirmation arrives late, one canonical outcome is needed: late funding is reconciled
against the obligation, a permissible release/compensation is produced, rather than simultaneously
a full refund and free collateral. Two parties cannot receive the same principal.

## Price and 5% Margin

Proposal: transparent cost + target **gross margin of 5%**, not a promise
of guaranteed actual profitability for every deal.

```text
C = funding/return gas + capital-time cost + operating cost + priced risk
price = ceil(C / 0.95)
```

`C × 1.05` means a 5% markup and approximately 4.76% gross margin.
Risk/reservation is included in C once; do not take the same cost again
under the name security deposit. Price and rounding are fixed in base units.

Capital-time accounts for the useful term **and the expected release tail**, including
dispute delay. The gas buffer and the rules for returning the unused portion are visible in the quote.
The cost model belongs to the quoting hub; the deterministic Account verifies
the signed terms, rather than reproducing the hub's commercial forecasts.

Example arithmetic, not a tariff: at C=9.50 USDT, price=10 USDT, profit=0.50,
margin=5%. Without measured gas, cost of capital, and losses, the economics cannot be promised.

## Griefing: Pay for the Resource, Do Not Prohibit Protection

**A non-refundable reservation/risk fee** covers the completed preparation
and the agreed commitment to hold capital. Its maximum is known in advance.
Client cancellation after acceptance does not have to cancel costs already incurred.
Before quote acceptance there are no costs. A hub's error must not turn into its income.

**A refundable bond** makes sense only in the case of an objective violation with proof
and enforceable withholding. The mere fact of a dispute does not prove abuse: an honest
user must have the ability to defend against a bad hub.
For v1, an understandable risk fee + issuance limits is preferable. A separate slashable
bond should be added only after a precise adversarial scenario, not as a universal penalty.

Prepayment alone is not enough to defend against a well-funded attacker. Needed:

- limits on capital and on the number of pending leases per Account/peer; splitting across new identities
  must not bypass the hub's overall limit;
- a separate safety reserve for gas/dispute and concentration limits;
- a limited free time window for quote/reservation work and the cost of real funding;
- a prohibition on issuing one available reserve into several accepted promises;
- stopping new offers when the risk budget is exhausted, without violating old ones.

The stress budget estimates the tail of permissible lockups, not just the average frequency
of dispute. The maximum J-delay and the contract dispute path are included in the price/limits.
Without sufficient capital, the option becomes unavailable; the slider does not drift into credit on its own.

## Hub Self-Balancing

Available for new obligations: confirmed reserve minus accepted but not yet
funded obligations and the safety reserve. Already-deposited collateral cannot
be subtracted from the reserve a second time; its risks and future return are accounted for separately.

This is a derived view of the canonical state, not a new balance. In particular, a submitted
refund tx does not yet increase the available money. All acceptances go through one
financial owner, so that two Account jobs do not spend the same resource.

Under high load, the hub raises the price of **new** quotes and limits the size.
Under low load, it lowers the price down to a stable floor. Updating an accepted fee is prohibited.
Control uses hysteresis, cooldown, and a minimum economically sensible batch:
do not chase R→C→R while oscillating around a single threshold. J effects can only be combined
within the existing order of the financial pipeline, not sorted by price or client.

Automatic release is disabled for capital that is promised to an active lease or
needed for an obligation that has already arisen. After maturity, it becomes a candidate for
canonical release, rather than disappearing from collateral on a timer.
Renewal is a new quote and consent, unless the user has given a limited
auto-renewal policy with maximum amount/fee/duration.

## Low Coupling and Durable Owner

The UI receives a clean preview, statuses, and actions. The shared capacity planner owns
the `deriveDelta` projection, the risk boundaries, and the required Account actions.
Hub quote policy is responsible for the commercial price and availability; the J adapter — for
the existing batch/receipt events. None of them reads the DOM or a UI timer.

A new lease is a real protocol, not additional fields in the Manage form.
Before code, the owner of the obligation must be unambiguously defined in the canonical
Account/Entity state and membership in the root. Term/price/remaining hold are needed after
a crash if they cannot be derived from other committed state. A sidecar
lease DB or a separate "truth" about reserved money is prohibited.

Minimal recovery counter-example: two accepted orders, a crash after payment of the first,
before its J effect; after replay it must not be possible to sell its reserve to the second, charge the fee again,
or withdraw promised collateral. WAL, roots, and ordered outputs are verified.
An attempted early C→R must be rejected by the owner of the financial invariant, not just a
friendly scheduler. If the needed lease protection cannot be enforced in a dispute by the current
contract, a separate contract change is required with an owner bytecode/hash review;
the UI and the quote signature alone do not give on-chain enforcement.

## What Already Exists and What Does Not

Exists: credit limits, R→C/C→R, J batching/finality, Account signatures,
rebalance policy, prepaid collateral request, swap inbound planner.

No proven path exists for: future lease reservation, a mandatory hold term,
automatic refund on funding deadline, fee from a future inbound payment,
protection of the lease from a hostile unilateral/dispute exit. The existing requestCollateral
is limited to already-arisen unsecured exposure, and free Hub collateral is withdrawn by the scheduler.
These limitations cannot be fixed by renaming a button.

## Vectors Before Production

- LEFT/RIGHT of the inbound Account, old debt, holds, fee in a different token, small units.
- Two orders on one reserve, repeated quote/signature, a change of Account/J/token, expiry boundary.
- Partial funding, stale policy, insufficient gas/reserve, crash/replay, and a late J event.
- Unavailable client, withheld cooperation, timeout with debt, and a legitimate dispute.
- The hub attempts an early withdrawal/double refund; outage/reorg does not silently remove collateral.
- +10% to the entire required credit limit; 100% collateral does not issue hidden credit.
- Cross-j funding first, fresh swap admission after; the previous atomicity is preserved.
- Economic stress: all eligible clients simultaneously hold capital up to
  the maximum recovery tail; new issuances are limited, old promises are honored.

The next production step after agreeing on lease terms: one Account, one token,
request→J funding→readiness→payment or timeout→release/refund, then adversarial replay.
The shared inbound UI in receive/swap/cross/lending connects to the working primitive.
Pay uses its own replenishment via the existing Move, without a new credit option.
