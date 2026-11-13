# Synthesis: XLN Launched Product Vision Across Four Models

Date: 13 November 2026 · Baseline: `019d45b` (`v0.1.31`, 5,823 commits) · Synthesizer: `antigravity-gemini-4-high`

Sources synthesized:
- **Codex (`gpt-6-astra`):** [`codex_launched-product-vision.md`](./codex_launched-product-vision.md)
- **Grok (`grok-4.6`):** [`grok-4.6-launched-product.md`](./grok-4.6-launched-product.md)
- **Claude (`claude-fable-5-2`):** [`vision-claude-fable-5-2.md`](./vision-claude-fable-5-2.md)
- **Gemini (`antigravity-gemini-4-high`):** [`gemini-xln-product-vision-2026-11-13.md`](./gemini-xln-product-vision-2026-11-13.md)
- Cross-examination record: [`brief.md`](./brief.md), [`claims.md`](./claims.md), [`chat.md`](./chat.md)

---

## 0. Executive Verdict

When four independent models inspected the live XLN repository against November 2026 substitutes (`Hyperliquid`, `Relay.link`, `USDT0`, `Permit2` RFQs, `Fireblocks Off-Exchange`) and wrote concrete launch visions:

1. **Three of four (`Grok`, `Claude`, `Gemini`) independently rejected `AGENTS.md` `RELEASE SCOPE` as unlaunchable.** Shipping `Pay + Same-J Swap + Cross-J Swap + Pooled Bank Lending` across `EVM + Native TRON` with `3 independent hubs + 2 external MMs`, `1,000-user TPS`, an `"AI-agent payments"` landing page, and a `1/3 bp` platform tax guarantees `MML = 0`. Only `Codex` preserved the 4-flow scope and `1/3 bp` fee, and its own §17 warned that doing so risks building *"an expensive execution provider attached to a wallet nobody needs."*
2. **All four converged on the single non-substitutable primitive in XLN:** Stateless fast transfers and one-off cross-chain swaps are already commoditized (`Relay` at `1 bp`, `USDT0` at `1–3 bps`, `Permit2` RFQs at `$0.50`, L2s at `<$0.01`) and get routed around whenever a competitor quotes `0.5 bps` tighter (`Codex §12`). The **only** capability in XLN with no mid-market 2026 substitute is **provable bilateral net-settlement combining partial on-chain collateral + bounded unsecured `creditLimit` (`RCPAN`) + unilateral signed exit** (`Claude §2`, `Grok §3`, `Gemini §1`, `Codex §14`).
3. **Each individual vision had one load-bearing breakthrough and one fatal blind spot.** Fusing the surviving pieces yields a single coherent launched product (§3) and isolates the one real owner fork that decides Day-1 execution (§4).

---

## 1. Side-by-Side Comparison of the Four Visions

| Dimension | Codex (`codex_launched-product-vision.md`) | Grok-4.6 (`grok-4.6-launched-product.md`) | Claude Fable 5-2 (`vision-claude-fable-5-2.md`) | Gemini 4 High (`gemini-xln-product-vision-2026-11-13.md`) |
| --- | --- | --- | --- | --- |
| **Launched object** | General 4-capability financial app (`Home, Activity, Finance`) + embedded payout API | 2-seat private **USDT credit book** (`The Desk` + `The Name`) on 1 Account | **Net-settlement account** (`star` hub run by 1 external RFQ/MM anchor with >=3 existing clients) | **Non-custodial clearing tab & instant corridor** (`TRON USDT ⇄ Arbitrum/ETH USDC & USDT`) on `Hub 0` |
| **Who runs `Hub 0` & supplies capital** | XLN-associated operator alongside independent hubs/MMs (`§7`) | Egor's legal vehicle (`The Desk`) posts 100% principal & eats default (`§2, §5`) | External trading firm (**the Anchor**), paid a flat monthly retainer + optional owner capacity (`§3, §6`) | XLN operates **`Hub 0`** directly with `$60k–$165k` house stablecoin + hedged-`TRX` float (`§2, §4`) |
| **Day-1 chains & assets** | `Ethereum` + `Native TRON` (all configured launch assets) | `Ethereum` only · `USDT` only (`1` token, `0` swaps) | `1` low-fee EVM chain · `2` tokens (`Native TRON` deferred until requested) | `Arbitrum One` (`<$0.02` entry) + `Ethereum` + `Native TRON` (`USDT`, `USDC`, `USDT0`) |
| **Customer #1 acquisition** | 1 embedded payout/commerce app integration (`§2, §11`) | Direct phone call to 1 firm Egor already transacts with (`§2`) | Paid retainer + free audit + free tower offer signed by 1 Anchor by `2026-12-31` (`§3`) | Direct outreach to payout/PSP desks + `100%`-pass-through **`Builder Codes`** for SaaS/OTC bots (`§5`) |
| **Pricing & tariff** | `0` for 30d, then `1 bp` pay / `3 bp` swap + lending margin (`§13`) | **`Credit-days`** (daily charge on drawn unsecured `USDT`; `0` notional bps, `§3`) | **`3 bps/day`** (`10.95% APR`) on drawn credit kept by Anchor; XLN charges `$0` for 6 mo, then flat SaaS (`§6`) | **`0 bps` platform fee**; `Hub 0` earns `8–15 bps` skew spread; integrators keep `100%` of `Builder Code` bps (`§4–5`) |
| **Custody & signing UX** | Canonical React wallet; explicit multi-step auth (`§3, §9`) | Hosted replica run by `The Desk`; `The Name` holds own keys; 2 seats only (`§6`) | **Dedicated `Depository.sol` per hub** (isolates `USDT` freeze); `ERC-1271` Safe board (`§4–5`) | Atomic `Rabby`/`TronLink` deposit → silent JS **`Agent Key`** via existing `_processBatch` (`0` popups) + gasless TRON exit (`§3.1`) |
| **Pooled `Bank / Lending` at launch?** | **Kept** (`§5–6`) | **Killed** (`§3, §9`) | **Killed until Beta `$2M–$5M` rung** (`§5–6`) | **Killed** (`§2`, citing `Relay Vaults` shutdown) |
| **Sharpest unique catch** | Phantom multi-solver routing makes stateless swap pipes replaceable (`§12`); persistent op-ID (`§3`) | *"The name comes from a phone, not a segment"*; `credit-days` over `1 bp` tolls; hosted replica sanity (`§2–6`) | `>31%` credit-utilization hurdle vs. `Aave`; `reader.ts` `2x` block-header explosion on fast L2s; per-hub `Depository` (`§5–6`) | Zero-Solidity `Agent Keys`, gasless TRON exits & `Builder Codes` already work on unmodified `Depository.sol` (`§3.1, §5.1`) |
| **Primary failure mode** | Preserves the exact scope paralysis keeping `MML = 0` | `0`-collateral, `1`-token unsecured loan has **zero on-chain collection power** on default (`DebtCreated` != cash) | Outsourcing `Operator 0` on a retainer repeats `dYdX` mercenary MM stalls & hits MPC frame-signing friction (`§12`) | Building self-serve corridor + `Builder Codes` *before* securing Name #1; `Arbitrum` breaks unpatched `reader.ts` |

---

## 2. Cross-Examination: How the Four Visions Correct Each Other

Holding the four documents against one another eliminates four traps:

1. **Why Grok corrects Gemini and Codex on Day-1 sequence ("Phone before Portal"):**
   Neither `Hyperliquid` (`Chameleon Trading`) nor `Relay` (`Reservoir` inside MetaMask/OpenSea/Zora) launched into an abstract market segment. Grok (`§2, §6`) is right: before building self-serve widgets or multi-partner `Builder Codes`, Customer #1–#3 must be named firms onboarded directly—and **hosting their `Runtime` replica on `Hub 0` infrastructure while their signing key stays strictly client-side** eliminates DevOps friction on Day 1 without sacrificing self-custody.
2. **Why Claude and Gemini correct Grok on collateral & two-leg clearing ("No Naked IOUs"):**
   Grok (`§3`) strips out collateral and swaps so `The Desk` lends pure unsecured Ethereum `USDT`. If `The Name` draws `$50k` and walks away against an empty reserve, [`Depository.sol`](../../../jurisdictions/contracts/Depository.sol) merely records an on-chain `Debt[]` struct—it cannot garnish an offshore bank account. As Claude (`§9 line 144`) notes, funding multi-week unsecured lines to borrowers nobody else underwrites is pure adverse selection. `RCPAN` only gains cryptographic teeth when **partial first-loss collateral + two-way asset/corridor clearing** sit inside the same `Account`, bounding tail loss and enforcing net settlement automatically.
3. **Why Hyperliquid/Relay history (and Gemini/Grok) corrects Claude on `Operator 0` ("Never Outsource Hub 0 on a Retainer"):**
   Claude (`§3`) proposes paying an external RFQ/MM desk a monthly retainer to operate the first hub and bring three of its own counterparties by `2026-12-31`. Established desks keep principal in `Fireblocks`/MPC custody that cannot sign high-frequency `Hanko` frames out of the box (`Claude §12 line 170`), guard client relationships jealously, and stop caring the day retainers expire. **XLN (via an owner-funded commercial vehicle) must operate `Hub 0` itself on Day 1**, exactly as Jeff Yan ran `Chameleon`/`HLP` and Uneven Labs ran Relay's single relayer.
4. **Why Claude + Codex correct Gemini on retention and L2 receipt reading:**
   - *Retention (`Codex §12` + `Claude §6`):* Pure swap/payout routing (`8–15 bps`) is vulnerable to wallet aggregators switching providers for `0.5 bps`. Pairing corridor execution with **revolving intraday/short-term `creditLimit` priced at `3–5 bps/day` (`credit-days`)** turns replaceable flow into a sticky bilateral banking tab.
   - *L2 RPC scaling (`Claude §5 line 70`):* [`reader.ts`](../../../core/jurisdiction/adapter/receipt/reader.ts) (`lines 392–448`) fetches block headers *twice* for every block in `[fromBlock, toBlock]`. On `Arbitrum One` (`250 ms` blocks = `345,600` blocks/day, `48x` Ethereum L1), running `reader.ts` unchanged will choke `Hub 0`'s RPC budget even if hidden behind a fast UI snapshot. `reader.ts` must switch to sparse `eth_getLogs`-anchored block verification + checkpoints *before* enabling a `250 ms` L2.

---

## 3. The Unified Launched Product Specification

Synthesizing only the components that survived all four stress-tests produces **one canonical v1.0 launch architecture**:

### 3.1 What Ships on Day 1 (`XLN Clearing Desk` / `Hub 0`)

- **Topology:** **One commercial star hub (`Hub 0`)** operated by XLN's commercial vehicle + **one independent Watchtower** on separate infrastructure (`Grok §8`, `Claude §5`, `Gemini §2`). No `H1/H2/H3` theater; no multi-hop HTLC routing at launch.
- **Blast-radius isolation:** `Hub 0` deploys its **own dedicated [`Depository.sol`](../../../jurisdictions/contracts/Depository.sol) instance** (`Claude §5`), isolating `USDT`/`USDC` issuer-blacklist contagion to `Hub 0`'s book while preserving reserve-to-collateral netting across all of `Hub 0`'s Accounts.
- **Core financial product (`Net-Settlement & Working-Capital Tab`):**
  1. Counterparty posts **partial collateral** (`20%–50%` margin, or `100%` for unvetted self-serve users) into `Account(Counterparty, Hub 0)`.
  2. For vetted recurring counterparties (payout platforms, PSPs, OTC brokers), `Hub 0` grants a **bounded `creditLimit`** (`$2,500–$25,000` intraday / `1–5` day working-capital sleeve).
  3. Counterparty executes instant (`<300 ms`), private off-chain **payments, two-token conversions, and external `Payout-on-Behalf` deliveries**, settling only the **net residual** on-chain at end-of-day or end-of-week.
- **Zero-Solidity UX (`FROZEN_CORE` preserved 100%):**
  - **Atomic 1-tx funding + silent `Agent Key` signing (`Gemini §3.1`):** Using existing [`Depository._processBatch`](../../../jurisdictions/contracts/Depository.sol#L480-L500), the counterparty's cold wallet (`Rabby`, `MetaMask`, `Safe`, or `TronLink`) deposits ERC-20/TRC-20 straight into a dedicated hot `Agent Key` `Entity` (`0` per-trade popups, bypassing the enterprise MPC frame-signing bottleneck). `Hub 0` may host the counterparty's encrypted replica while keys stay strictly client-owned (`Grok §6`).
  - **`<150 ms` snapshot load + sparse receipt verification (`Gemini §3.2` + `Claude §5`):** Boot from `Hub 0`'s dual-signed `AccountFrame` checkpoint immediately (`Hub-Attested`), while background verification checks only `eth_getLogs`-matched blocks (`Chain-Verified`).
  - **Idempotent intents & honest risk UI (`Codex §3, §9` + `Claude §7.4`):** Persistent operation IDs prevent duplicate sends on reconnect. The 3-screen `ui/` (`Clearing Tab`, `Convert & Pay`, `Safety & Exit`) strictly separates **Secured Principal** (above the published `100x` dispute-gas floor) from **Unsecured Credit Exposure**, with a live 1-click **Unilateral Exit** button.

### 3.2 Revenue & Incentive Model (Three Clean Layers, `0 bps` Protocol Tax)

1. **Protocol platform fee:** **`0 bps`** (replaces `launch-pilot.md`'s `1 bp / 3 bp` toll).
2. **Credit sleeve (`Grok` + `Claude`):** **`3–5 bps / day`** (`10.95%–18.25% APR` simple) charged on drawn unsecured `creditLimit` (`credit-days`), with Account limits sized to historical ticket volume so average utilization clears **`>31%`** (beating passive `Aave` yield; `Claude §6`).
3. **Corridor & distribution sleeve (`Gemini`):**
   - `Hub 0` earns **`8–15 bps` skew-aware conversion spread** on cross-asset / `TRON ⇄ EVM` fills (hedging `TRX` Energy via staked `TRX` + short `TRX-PERP` so external `TRC-20` `Payout-on-Behalf` costs `$0` marginal `TRX`, and auto-rebalancing net drift <25% via `USDT0`/CEX at `~2.5–3.5 bps`).
   - **Phase-2 `Builder Codes` (`ApproveBuilderFee`, `0` Solidity changes):** Once Customers #1–#3 validate the loop, payout SaaS platforms, Telegram OTC bots, and API gateways attach `builderFeeBps` (`5–100 bps`) and receive **100%** of their fee credited off-chain into `Account(Hub 0, Builder)` in the same `RuntimeFrame`.

---

## 4. The Single Owner Fork (Deciding the Day-1 Rail & First 3 Customers)

No further architecture research is needed. Launch execution branches on **one factual question only the owner can answer**:

```text
Do we have (or can we sign within 30 days) 1–3 named commercial counterparties
who already move recurring USDT/USDC volume?
 │
 ├── YES, and their recurring flow is single-chain EVM (e.g. WETH/USDT or USDC/USDT RFQ)
 │     └─► SHIP PATH A (14 days): Hub 0 on 1 low-fee EVM chain (or Ethereum) only.
 │         Defer Native TRON until Customer #2/#3 requires it (Grok + Claude fast path).
 │
 ├── YES, and their recurring pain is TRON USDT payouts ⇄ EVM USDC/USDT treasury
 │     └─► SHIP PATH B (21 days): Hub 0 on Ethereum/Arbitrum + Native TRON with
 │         $60k–$165k house float + staked TRX Energy pool (Gemini corridor path),
 │         onboarding those 1–3 named desks first with hosted replicas + Agent Keys.
 │
 └── NO warm counterparty in reach (starting 100% cold)
       └─► Run a hard 30-day Commercial Discovery Sprint BEFORE writing new features:
           Pitch 25 payout SaaS / regional PSP / boutique OTC operators a live Canary
           ($25k Hub 0 cap, 0 bps fee, 100% Builder Code rev-share, OR Claude's Anchor
           terms). If <3 sign a funded trial by Day 30, FREEZE commercial expansion.
```

---

## 5. Unified Repository Cut-List (`todo.md` & Pre-Launch Delta)

| Surface / `todo.md` item | Synthesized Launch Action | Consensus |
| --- | --- | --- |
| **Pooled `Bank / Savings / Term Loans`** (`lendbook`, `ui/src/components/BankLendingPolicy.tsx`) | **Hard-disable admission & remove from `ui/`** until Stage 3 (`>$2M` proven utilization record + dedicated loan-transformer audit). | `3 / 4` (`Grok`, `Claude`, `Gemini`) |
| **`H1/H2/H3` + `2 external MMs`** (`todo.md:52`, `launch-pilot.md:15`) | **Collapse to `Hub 0` + `1` independent Watchtower.** External hubs/MMs enter only after `Hub 0` publishes a 60-day utilization & PnL record. | `3 / 4` (`Grok`, `Claude`, `Gemini`) |
| **`1,000-user TPS`, `2^200` WideMath, `rscore/` Rust parity, `Arrakis`/`XLNC`** (`todo.md` #6, #9, #12) | **Freeze immediately.** Zero commercial blocker for `<100` active Accounts. | `3 / 4` explicit |
| **Landing page `"Payments for AI agents"`** (`frontend/src/routes/+page.svelte`) | **Replace** with single-sentence clearing/corridor offer + live executable quote/dispute proof. Keep `cli/agent-payment.ts` inside `@xln/sdk`. | `4 / 4` unanimous |
| **Contract & SDK licensing** (`LICENSE`, `jurisdictions/contracts/*.sol`) | **Re-license `jurisdictions/contracts/*.sol` and `@xln/sdk` to `MIT`**; verify deterministic source builds on explorers. | `3 / 4` explicit (`Grok`, `Claude`, `Gemini`) |
| **Focused external security review** (`todo.md` #11) | **Scope strictly to launch surface:** `Depository`, `Account`, `DepositoryBounds`, `HankoVerifier`, and active swap/pull paths of `DeltaTransformer` (exclude `lendbook` & corporate share governance). Enforce hard `$10k–$25k` per-Account `Hub 0` cap pre-audit. | `4 / 4` aligned on bounded risk |
| **Receipt reader & import latency** (`core/jurisdiction/adapter/receipt/reader.ts`, `todo.md` #5) | **`<150 ms` signed `Hub 0` snapshot boot** + rewrite `reader.ts` to verify receipts at `eth_getLogs`-matched blocks/checkpoints instead of `2x` full-range header scans (`32.1 s` → `<1 s`). | `4 / 4` unanimous |
| **Public dispute & recovery proof** (`todo.md` #4, #7, #8) | **Keep as mandatory launch gate:** 3 public testnet disputes + 1-hour soak + live secondary Watchtower counter-dispute drill on exact mainnet bytecode. | `4 / 4` unanimous |

---

## 6. Hard 90-Day Falsification Contract

To prevent XLN from ever retreating into infinite internal refactoring, launch is governed by five binary kill/advance criteria:

1. **Day 30 — Named Counterparty Gate (`Grok §13` + `Claude §3` + `Gemini §6.2`):**
   At least **3 unaffiliated businesses/desks** have funded a live mainnet `Account` with `Hub 0`, executed real commercial conversions/draws, and completed **at least 1 clean withdrawal** (`>= $250k` cumulative `MML`). *If fewer than 3 fund even `$500–$5,000` after 25–30 direct live demos, stop corridor expansion immediately.*
2. **Day 60 — Capital Utilization & "Spreadsheet Test" Gate (`Claude §11`):**
   Across active credit/clearing Accounts sized to counterparty tickets, **average drawn credit / net clearing utilization exceeds `31%` of `Hub 0` posted per-Account inventory** (beating passive `Aave` yield before spread), AND counterparties confirm they could **not** have achieved the same instant finality/credit limit via a manual spreadsheet + `Permit2`/`USDT0`.
3. **Day 60 — Unsubsidized Organic Pull (`Claude §10` / `Gemini` Client-#4 Signal):**
   At least **1 distribution partner (`Builder Code` SaaS/bot) or existing counterparty** brings an incremental unaffiliated user onto `Hub 0` **without a retainer or subsidy**.
4. **Day 90 — Default-Alive Unit Economics (`Codex §13` + `Gemini §4.3`):**
   `>= $5M–$10M / month` annualized `MML` run-rate with **positive net `Hub 0` contribution** (`credit-day fees + corridor spread − wholesale rebalancing − chain gas − watchtower/infra − realized defaults > 0`).
5. **Zero-Tolerance Safety Gate (`4 / 4` unanimous):**
   Any accounting invariant break, stuck unilateral exit, or Watchtower failure immediately halts new `Hub 0` admission while preserving all signed exit paths until root-caused and regression-pinned.
