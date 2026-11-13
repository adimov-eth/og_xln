# XLN launched product: verified synthesis

- **Author:** `claude-fable-5-2`, Claude Code, 2026-11-13T14:42:41+07:00
- **Written against:** `019d45b` (`v0.1.31`)
- **Inputs:** my [vision](./vision-claude-fable-5-2.md), [Codex](./codex_launched-product-vision.md), [Gemini](./gemini-xln-product-vision-2026-11-13.md), [Grok](./grok-4.6-launched-product.md), [`chat.md`](./chat.md) D001–D006.
- **Not read before writing:** [`synthesis.md`](./synthesis.md) (Gemini) and [`codex-product-synthesis-2026-11-13.md`](./codex-product-synthesis-2026-11-13.md). They appeared while I was checking claims.
- **Status:** one model's recommendation. Not owner canon. It replaces my vision as my current position; the vision stays as written.

## 1. The product in one paragraph

*Rewritten 2026-11-13T15:08:09+07:00 after the owner's four answers in §4. Sections 3 and 5 predate them; where they differ, this section, §6 and §8 govern.*

The owner already pays out USDT for one unaffiliated firm and is repaid later, up to an informal limit `L0`. The firm wants more than `L0`. The owner will not front more because of repayment risk. The product: the whole relationship is recorded in one Account. `L0` stays free and unsecured, as today. The firm posts margin `M` in the Depository, which it can withdraw without the owner while it is not drawn against. In return the owner raises the limit to `L0 + k·M`. The margin is first loss under the whole balance. The firm buys capacity it cannot get today; the owner buys more flow with a measured increase in unsecured exposure of `(k − 1)·M`.

## 2. Claim verification

Verdicts: **repo** = confirmed by reading the file; **secondary** = confirmed by a search digest, not a primary source; **wrong**; **partly**; **unsupported** = the evidence found points against it but is weak; **calc** = my arithmetic on a stated input; **unchecked**.

### 2.1 Gemini

| Claim | Verdict | Evidence |
| --- | --- | --- |
| Collateral is keyed per Account and token | repo | `Depository.sol:65` |
| Deposit and Account funding fit in one `processBatch` | repo | deposits at `:495-499`, funding at `:585`; `Account.processR2C` requires no existing Account |
| That entry is one wallet transaction | partly | tokens are pulled from `msg.sender` (`:697`) and the contract has no permit path, so USDT needs an approve first: two transactions |
| A fresh key can sign without registering an Entity | repo | lazy 1-of-1 Entity, `HankoVerifier.sol:64`, `:129`, `:352` |
| The hub can broadcast a user's signed withdrawal | repo | `processBatch` authenticates by Hanko only (`:370-376`); the recipient is the address encoded in the signed `receivingEntity` (`_reserveToExternalToken`) |
| The hub has no special contract privilege | partly | `admin` gates only `mintToReserve` and `adminRegisterExternalToken`, both restricted to local dev chain ids (`:111-119`). Token listing is a privilege: only `EntityProvider` may call `registerExternalToken`, under a Foundation Hanko (`:262-272`) |
| `Account.sol:744` uses `block.timestamp` | repo | read |
| Unilateral exit costs about 921k gas | repo | 921,213, one asset and 32 payments, `crisis-review-20261011.md:68` |
| 6,647 lines of Solidity | wrong | 6,409 by `wc -l` |
| The Solidity is UNLICENSED | partly | 10 of 16 files; `DeltaTransformer.sol`, `HashLadder.sol` and three mocks are MIT; `IEntityProvider.sol` is AGPL |
| 5,823 commits | unchecked | this clone is shallow |
| `@xln/sdk`, builder fees, passkey storage, payout-on-behalf exist or are small | wrong | no `@xln/sdk` in any `package.json`; no `builderFee` or passkey string in `core`, `ui/src`, `cli`; "payout" appears only in lending code. All are new builds |
| Arbitrum One is absent from `jurisdictions.json`; mainnets are not configured | repo | only local chains, TRON Nile and Sepolia, the last two `pending` |
| Arbitrum force-inclusion delay is 24 hours | secondary | Arbitrum docs say about 24 hours; a proposal to shorten it exists; on-chain value not read |
| A TRC-20 USDT transfer costs USD 1.50–3.50 | secondary | 65k–130k energy; about USD 2–4.50 at October 2026 prices, so the range is slightly low |
| Staked TRX makes hub payouts cost USD 0 at the margin; USD 0.50 flat fee | unsupported | one calculator puts 5,000 TRX of stake per daily transfer. `[calc]` At about USD 0.33 per TRX, the USD 4k and 12k stakes give roughly 2 and 7 transfers a day. Rental is quoted at USD 0.75–1.20 per transfer on vendor pages, above the proposed fee |
| USDT0 rebalance costs 1–3 bps | secondary | Legacy Mesh fee 3 bps; payout is from pools and can be short |
| Relay shut down its vaults because passive pools lose money | partly | discontinuation reported by one news item, stated as preceding a new version; the cause is Gemini's |
| Builder fee cap of 100 bps follows Hyperliquid | secondary | 10 bps perps, 100 bps spot |
| USD 80B+ USDT on TRON | secondary | USD 87–94B reported during 2026 |
| Revenue table | partly | the multiplication is right; month-one volume of USD 5.4M is assumed, and the same document's day-30 gate asks for USD 250k |
| Line references `launch-pilot.md:15`, `:26`, `:65`, `AGENTS.md:17`, `owner-profile.md:62` | repo | read |
| `AGENTS.md:23` excludes Base and L2s | partly | Base is listed as out of scope at `AGENTS.md:26`; no general L2 exclusion found |

### 2.2 Grok

| Claim | Verdict | Evidence |
| --- | --- | --- |
| Depository is one pooled address | repo | D001 §3, `Depository.sol:696-728` |
| Runtime AGPL, contracts UNLICENSED | partly | as above; the core custody files are UNLICENSED |
| Two Entities and one Account can pay a third party | partly | the payment leaves the Account: the Desk transfers on-chain from its own wallet and books the debit. No code ties the two |
| The owner already transacts USDT with an unaffiliated firm | unchecked | `owner-profile.md` and `launch-design.md` do not say |

### 2.3 Codex (the vision; its later synthesis file is unread)

| Claim | Verdict | Evidence |
| --- | --- | --- |
| Zero platform fee for 30 days, then 1 bp and 3 bp | repo | `launch-pilot.md:64-65` |
| Repository still requires independent hubs and MMs | partly | `todo.md:52-54` does; `launch-design.md:45` records the owner deciding otherwise on 2026-09-06 |
| `ui/src/components/DisputeProtection.tsx` exists | repo | file present; its wording not re-read |
| Phantom shows execution providers are replaceable | secondary | route choice is delegated to an aggregator that compares providers |
| Hyperliquid and Relay history links | unchecked | not fetched this pass |

### 2.4 Mine and the shared base

| Claim | Verdict | Evidence |
| --- | --- | --- |
| Inventory is per token per Account and does not pool | partly | true inside the Depository (`:65`); inventory held in a hub wallet for external payouts does pool, as Gemini §1.2 says |
| 31% breakeven | calc | 3.39 / 10.95; the 3.39% Aave rate is a secondary figure dated 2026-10-23 |
| `launch-pilot.md:58-63` permits paid MM commitments | repo | read |
| `set_credit_limit` and `direct_payment` are Account transaction kinds | repo | `core/types/account.ts:780`, `:693` |
| Collateral returns to reserve inside a batch, then leaves to an address | repo | `Depository.sol:509-510`, `_reserveToExternalToken`; the co-signature rule inside `Account.processC2R` was not re-read |
| Dispute finalization exists and was measured | repo | `Depository.sol:581-583`, `crisis-review-20261011.md:68` |
| "DeltaTransformer admission disabled" (perspective §4.2) | wrong | conceded in D006 |
| 9,179 Solidity lines | wrong | conceded in D005 |
| Builder codes were 2–4% of Hyperliquid volume | unchecked | search digest from an earlier turn |
| "Three of four visions relicense the contracts" (my last chat message) | wrong | Gemini and I relicense; Grok discloses and grants a private licence |

## 3. Who is exposed to whom

The four designs point credit in different directions. This decides whether the product tests XLN or only tests a lender.

| Design | Exposure | Secured by | What a dispute recovers |
| --- | --- | --- | --- |
| Grok | Desk to Name, for the drawn limit | nothing required | the Name's collateral if any; the rest is a debt row paid only from the Name's future reserves |
| Mine | counterparty to anchor, for assets bought | anchor's collateral in that Account | up to that collateral |
| Gemini | user to hub, per payout ticket | nothing; the debit is signed before external delivery | the user's remaining collateral, not the undelivered ticket |
| Codex | not specified | | |

Choice: the Name's collateral is required, and the limit sits on top of it. Then both parties have something a dispute returns. The Name gets its unspent collateral back without the Desk. The Desk recovers drawn amounts up to that collateral. Only the limit is unsecured, and it is labelled as such (`owner-profile.md:62`). A sleeve with no collateral is a loan with a signed log and tests nothing in XLN.

## 4. Gate zero

**Retracted 2026-11-13T17:16:07+07:00.** The answers recorded below in this section and in §1, §6 and §8 ("the owner is the Desk", "the owner goes first", "held back by the owner's limit", "repayment risk", "Ethereum", "`L0` stays outside") were given in session and later withdrawn by the same person: there is no firm yet. Read them as a worked hypothetical. Gate zero is answered **no**. The code findings (exit time, no accrual on a limit, capacity formula, entry and exit paths) do not depend on those answers and stand.

One question to the owner, before any build: **do you today move USDT with an unaffiliated firm that would post margin and take a named limit?**

- **Yes:** the owner is the Desk. No sale, no retainer.
- **No:** make the paid anchor offer from my vision §3, deadline 2026-12-31.
- **Neither by that date:** do not launch. Present XLN as a reference implementation.

**Answered 2026-11-13T14:49:12+07:00 by the owner: yes.** The owner is the Desk; the anchor offer and its 2026-12-31 deadline do not apply. This is the owner's statement about the firm. The firm has not been asked, and who carries the exposure between them today is not yet recorded.

**Answered 2026-11-13T14:50:39+07:00 by the owner: the owner goes first.** The firm already has free, informal, unsecured credit. Consequences for this document:

- The §3 choice (required collateral under the whole limit) is a worse deal for this firm than what it has. It is withdrawn for the existing flow.
- Recording the existing flow in an Account needs no chain action from the firm: the Desk sets the limit, the firm's draws are signed in the Account, and the Desk credits repayments it receives by ordinary transfer. That is a co-signed ledger. A dispute recovers nothing, so it tests the runtime, signing, hosting and recovery, and does not test the Depository. Run it at no charge and call it a pilot, not a launch.
- The product is the increment: capacity above what the owner will front on trust, backed by margin the firm posts in the Depository and can withdraw. For that capacity the firm's alternative today is to send first, so withdrawable margin is an upgrade. Credit-days in §6 apply only to the unsecured part of the increment.
- If the firm never reaches the owner's informal limit, there is no increment to sell to this firm and it is a pilot partner only.

**Answered 2026-11-13T15:05:38+07:00 by the owner: the firm is held back by the owner's limit.** An increment exists. Its form depends on two facts not yet recorded:

| Why the owner caps | Why the firm does not send first | What the Account can offer |
| --- | --- | --- |
| risk of non-repayment | has no spare capital at that moment | partial margin as first loss; the owner fronts a multiple of it; credit-days on the unsecured part |
| risk of non-repayment | has capital, will not hand it over | full margin, no credit; the gain is flow |
| the owner's own cash | has capital | full standing margin with settlement to the owner's reserve after each draw, so the owner's cash is out only for one settlement |
| the owner's own cash | has no spare capital | nothing; it needs a third party's capital, which is a later rung |

Margin in the Depository is not cash in the owner's wallet. The owner still pays the recipient from its own funds and is reimbursed at settlement. Margin helps a capital-constrained firm only as first loss under a larger limit, which means the owner lends more.

## 5. The path

Tags: `[exists]` traces to a "repo" or "partly" row above; `[build]`; `[decision]`; `[unchecked]`.

| Step | State |
| --- | --- |
| Name creates a key; no Entity registration | `[exists]` |
| Name approves the token, then deposits and funds the Account in one batch | `[exists]` in contract; `[decision]` mainnet deployment and token registration |
| Desk sets the credit limit | `[exists]` (`set_credit_limit`) |
| Name pays the Desk inside the Account | `[exists]` (`direct_payment`) |
| Desk pays the Name's recipient on-chain | `[build]` or manual; receipt must carry the chain transaction, and the wallet must show internal debit and external delivery as separate states (Codex §3) |
| Credit-day charge | `[unchecked]` whether a plain credit limit accrues; invoice off-ledger at launch |
| Cooperative withdrawal, broadcast by either side | `[exists]` |
| Unilateral exit by dispute | `[exists]`; publish the measured cost on the chosen chain |
| Watchtower | `[exists]` code; `[decision]` who runs a second one |
| Hosted replica for the Name, keys with the Name | `[decision]` (Grok §6) |
| Wallet import in under 32.1 s | `[build]`, `todo.md:28` |
| Two-token swap inside the Account | deferred to rung 2; keeps the transformer swap path out of the first review |

Chain is a decision with two constraints. On Ethereum the ticket size must clear the dispute floor of about 100 times the dispute cost (`rejected-ideas.md:8-9`). On Arbitrum the dispute window must exceed the force-inclusion delay, and the token is USDT0. Native TRON is out of the first rung: the payout economics in §2.1 do not hold at the proposed stake.

## 6. Price and capital

- **`L0`: free.** Charging for credit the firm already gets free is a price increase and a reason to leave.
- **`k = 1`: free.** The firm posts `M` and may draw `L0 + M`. The owner's unsecured exposure does not rise. The owner's gain is flow, and a first-loss cushion of `M` under exposure that was fully unsecured before.
- **`k > 1`: credit-days.** Charged on the amount drawn above `L0 + M` only. 3 bps a day (10.95% a year) is my placeholder; the owner knows what short payout money costs in this market and should set it.
- **The firm reveals its own case by what it chooses.** A firm with capital it will not hand over takes `k = 1`. A firm short of capital asks for `k > 1`. No further question to the firm is needed before the offer.
- **Worst case for the owner at default:** `L0 + (k − 1)·M`, plus dispute gas, plus the dispute window during which the margin is not yet recovered.
- **Worst case for the firm:** loss of `M` to a contract fault. The contracts are unaudited and one pooled address. This is the firm's main risk and belongs at the top of the disclosure.
- The owner still pays each recipient from its own cash and is reimbursed at settlement. Margin does not fund payouts.
- No platform fee, no outside capital, no token.

## 7. Trust package

1. Written disclosure to the first Name: unaudited, core files UNLICENSED, one pooled contract address, the limit is unsecured debt, the Desk runs the tower (Grok §7).
2. A licence grant sufficient to run a replica.
3. A measured exit on the chosen chain, published with its gas cost.
4. A recovery drill before real funds: crash the hosted replica, restore, exit.
5. Counsel's opinion on the Desk as lender before the first USD 10k (Grok §10).
6. External review of the custody files and the transformer payment path before a second Name or the USD 100k rung.

## 8. Rungs

| Rung | What runs | Gate to enter |
| --- | --- | --- |
| 0. Rehearsal | this Account on the testnet of the chain where the flow already runs: post margin, set limit, draw, pay out, repay, settle, dispute, exit, recover | none |
| 1. Ledger pilot | the existing `L0` flow recorded in the Account; the firm signs, takes no chain action, pays nothing | rung 0 passes; the firm agrees to sign |
| 2. Launch, `k = 1` | the firm posts real margin; limit `L0 + M` | written disclosure accepted; counsel's view on the owner as documented lender; mainnet deployment on that chain; a measured exit |
| 3. `k > 1` | credit-days on the unsecured increment | one real cooperative withdrawal of margin by the firm and one exit drill on mainnet |
| 4. Second firm | same Desk, same terms | external review of the custody files and the payment path, or total margin above USD 100k, whichever comes first |
| 5. Outside capital into the Desk's book | pooled claim | a record from rungs 3–4; term-loan review |

**Chain, answered 2026-11-13T15:21:45+07:00 by the owner: Ethereum.** Consequences:

- Rung 0 runs on Sepolia. XLN contracts are already deployed there (`jurisdictions.json`, status `pending`). The rehearsal is `todo.md` queue item 4 with this Account's numbers: its second dispute case, "counterparty owes beyond collateral → exact payout plus debt row", is this product's default case, and its "secured/unsecured exits" are the firm's and the owner's exits.
- Queue items 1, 4, 5 and 8 are the launch path for this product. Items 2 (swap, cross-swap, lending), 3 (native TRON), 6 (1,000-user TPS) and 7 (soak) are not needed for one Account with one firm.
- `[calc]` Dispute floor. A measured exit is 921,213 gas, so one dispute costs about 0.00092 ETH per gwei of gas price, and the canon floor of 100 times that is about 0.092 ETH per gwei. At 1 gwei the margin must be worth more than 0.092 ETH; at 30 gwei, more than 2.8 ETH. I could not obtain a current gas or ETH price; set `M` against a stressed gas price, not today's.
- The token is Ethereum USDT. It has no permit, so the firm's first deposit is two transactions. Tether can freeze the Depository address as a whole; that goes in the disclosure.
- No L2 and no TRON are involved, so the collisions with `launch-pilot.md:26` in §9 and the TRON pricing in §2.1 do not arise for this product.

**Read 2026-11-13T15:35:40+07:00, no run (the Mac Studio is down and `AGENTS.md` puts all builds and tests there):**

- A unilateral exit by either side waits for both response windows added together: `timeout = start + leftResponseSeconds + rightResponseSeconds` (`Account.sol:1786-1789`). Defaults are 1 hour for a hub and 24 hours for a user (`core/account/config/dispute-config.ts`), so 25 hours for the owner to recover margin and 25 hours for the firm to exit against a silent owner. The windows are signed at Account creation.
- A plain credit limit is a number. Nothing accrues on it (`core/account/tx/handlers/balance/set-credit-limit.ts`). Lowering it applies prospectively and keeps drawn exposure. The §5 row "credit-day charge" is therefore: invoice off-ledger, or use the term-loan path, which is queue item 2.
- The default case was proven once on Sepolia on 2026-10-11 at `a486e799` with a 10-second window: 850 collateral, 250 unsecured claim, 200 collected from reserve, 50 left as a debt row (`docs/evidence/sepolia-20261011/unsecured-exit.json`).
- `https://sepolia.xln.finance` returns 502 from its API.

**Correction 2026-11-13T15:43:59+07:00, from `core/account/utils.ts:28-55`.** A party's capacity is its share of collateral plus the credit granted to it, and collateral is consumed before credit. So wherever §1, §6 and this section say the limit is `L0 + k·M`, read: the Desk grants a credit limit of `L0 + (k − 1)·M`, and the firm's capacity is `L0 + k·M`. Granting `L0 + M` at `k = 1` would give capacity `L0 + 2M` and raise the Desk's unsecured exposure by `M`. With `d` outstanding, the Desk's unsecured exposure is `max(0, d − M)` against `d` today. The margin is not a cushion held in reserve: the first `M` drawn is paid from it. A dispute also closes the Account permanently, so an uncooperative exit is a full exit.

**Decided 2026-11-13T16:10:20+07:00 by the owner: the existing credit `L0` stays outside the Account.** At rung 2 the Desk grants no credit in the Account. The firm posts `M` and draws against it; `L0` continues informally. Rung 1 (ledger pilot of `L0`) is dropped. The launch therefore exercises deposit, signed draws, cooperative withdrawal and dispute, and exercises no credit. Credit enters the Account only at rung 3. The offer to the firm is [`first-firm-terms-draft-claude-fable-5-2.md`](./first-firm-terms-draft-claude-fable-5-2.md).

Rung 2 is the launch. It puts real money in the Depository with no added credit risk to the owner, so a fault there costs the firm's margin and nothing else. Size `M` at rung 2 to what the firm can afford to lose to a bug, and say so.

## 9. What is cut, and where canon disagrees

- Three hubs and two market makers: one hub. `todo.md:52-54` conflicts with `launch-design.md:45`; the owner should delete one.
- Pooled lending, cross-swap, native TRON, agent-payment landing, 1/3 bp fee: out of the first rungs. This contradicts `AGENTS.md` release scope and `rejected-ideas.md` (no scope cut).
- A hub-wide cap contradicts "no caps".
- One EVM chain, possibly an L2, contradicts `launch-pilot.md:26`, which names Ethereum and TRON as the real-funds rails.

Gemini, Grok and I agree on one hub, no pooled lending, no platform fee and a replaced landing page. Codex's vision keeps all four; I have not read its later synthesis.

## 10. Measures and kill conditions

Measures (Codex §16, reduced): draws completed under stated terms; average drawn credit over capital kept available; repeat draws after the first month at the paid price; one exit and one recovery drill with time and cost.

Stop if:
- the Name refuses the disclosure and no priced review is agreed;
- the only draws are affiliated;
- the firm declines to post any margin after reading the disclosure;
- the firm posts margin and does not draw above `L0` within 30 days;
- at `k > 1`, drawn credit above `L0 + M` stays below 31% of the cash the owner holds ready for it for 60 days;
- the Name says a spreadsheet and a signed PDF would have served;
- any accounting or exit fault occurs.

## 11. Weakest points

- Nobody in the study has asked a desk or a Name anything. Every demand claim here is inference.
- With one Account, the recipient is paid outside XLN. The product may reduce to a margin escrow with a ledger.
- A Name that already trusts the Desk over Telegram may not value withdrawable margin.
- External figures are search digests. The TRON stake and rental numbers come from vendor pages.

## Sources

- [Relay Vaults discontinued (Phemex)](https://phemex.com/news/article/relay-protocol-to-discontinue-vaults-service-ahead-of-new-version-launch-99419)
- [Arbitrum sequencer and force inclusion](https://docs.arbitrum.io/how-arbitrum-works/sequencer); [proposal to shorten the delay](https://forum.arbitrum.foundation/t/proposal-decrease-censorship-delay-from-24-hours-to-4-hours/13047)
- [TRC-20 fees 2026 (eco.com)](https://eco.com/support/en/articles/15197974-usdt-trc-20-fees-2026-per-transfer-cost-on-every-exchange); [TRON energy for USDT transfers (Dwellir)](https://www.dwellir.com/blog/tron-energy-usdt-transfers); [energy calculator (Chaingateway)](https://chaingateway.io/tools/tron-energy-calculator/); [rental explainer](https://tron-gas-fees-explained.pages.dev/)
- [USDT vs USDT0 (Datawallet)](https://www.datawallet.com/crypto/usdt-vs-usdt0); [USDT0 research (Four Pillars)](https://research.4pillars.io/en/research/tether-usdt-expanding-its-stablecoin-empire-starting-with-usdt0)
- [Hyperliquid builder codes](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/builder-codes)
- [Bridge tokens in Phantom](https://help.phantom.com/hc/en-us/articles/51384804802195); [Phantom and LI.FI](https://li.fi/knowledge-hub/phantom-integrates-li-fi-to-enable-in-wallet-cross-chain-swaps-to-solana)
- [USDT on TRON exceeds USD 90B (The Block)](https://theblock.co/post/407792/usdt-on-tron-exceeds-90-billion-as-tron-leads-usdt-transfer-volume-with-4-2-trillion-ytd)
