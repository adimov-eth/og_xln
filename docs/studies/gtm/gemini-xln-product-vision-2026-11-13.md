# xln launched product vision: non-custodial clearing & instant corridor

Date: 13 November 2026 · Author: `antigravity-gemini-4-high` · Baseline: `019d45b` (`v0.1.31`, 5,823 commits)

---

## 0. One-sentence product definition

**XLN (`xln.finance` + `@xln/sdk`) launches as a non-custodial commercial clearing account and instant `TRON USDT ⇄ Arbitrum / Ethereum USDC & USDT` liquidity corridor—operated on Day 1 by a single house-funded node (`Hub 0`), unlocked by one-signature `Agent Keys`, and distributed through 100%-pass-through `Builder Codes`.**

Not a federated six-party pilot waiting for external hubs. Not a retail savings bank. Not an isolated sub-cent AI micropayment toy. One coherent financial product that solves an expensive, daily commercial problem today—and carries the exact `J / E / A` (`Jurisdiction / Entity / Account`) substrate required to grow into an open global clearing network tomorrow.

---

## 1. Why this product exists in late 2026 (and where it refuses to compete)

### 1.1 The 2026 market boundary

Between 2018 and 2026, crypto solved two problems completely without bilateral state channels:

1. **Pooled speculation and single-chain execution (`Hyperliquid`, `Base`, `Solana`):** Shared-state L1s and rollups pool maker margin across every user simultaneously at `200 ms` and `<$0.01`. Competing here with bilateral channels is mathematically backward.
2. **Casual one-off EVM cross-chain swaps (`Relay.link`, `USDT0`, `Permit2` RFQs):** Intent relayers front occasional `$5–$5,000` swaps across cheap EVM L2s directly from an EOA in `1–2 seconds` with zero channel onboarding.

Both models, however, **break on repeat commercial stablecoin operations bridging `Native TRON` and `EVM` (`Arbitrum` / `Ethereum`)**—the largest real-economy stablecoin rail on Earth (`$80B+` `TRC-20 USDT` used daily for global payroll, supplier settlements, emerging-market PSP collections, affiliate payouts, and OTC brokerage):

| Structural failure of 2026 incumbents | What happens today (`USDT0`, `Relay`, `FixedFloat`, CEX, raw `TRC-20`) | How XLN Clearing (`Hub 0` + `Depository.sol`) changes the physics |
| --- | --- | --- |
| **Gross per-transaction chain tax** | Every `TRC-20 USDT` transfer burns `65k–130k` TRON Energy (`$1.50–$3.50`) plus EVM/bridge fees; 100 weekly payouts/sweeps pay chain tolls 100 times. | **Off-chain bilateral netting:** Execute 100 payments or `TRON ⇄ EVM` conversions at `<300 ms` and `$0.00` chain gas; settle only the net residual once, or dispatch external payouts through `Hub 0`'s staked TRON Energy pool. |
| **Public commercial graph & taint contagion** | Settling every client, contractor, or PSP sweep directly on Tronscan/Etherscan exposes full revenue, supplier graphs, and trade sizes to competitors while propagating `USDT` blacklist taint across wallets. | **Private bilateral state:** Intermediate payments, fee splits, and conversions stay strictly between the two `Account` signers; public chains see only net funding and exit batches. |
| **Custodial freeze vs. 100% capital lockup** | Instant swap services (`FixedFloat`, `ChangeNOW`, offshore OTC, CEXs) take 100% custody, charge `50–150 bps`, and freeze funds opaquely. Self-custodial bridges (`USDT0`) take minutes, only move `USDT → USDT`, and require 100% gross pre-funding per leg. | **Self-custodial `Secured Collateral` + bounded `creditLimit` (`RCPAN`):** Principal sits in verifiable `Depository.sol` collateral with unilateral L1/TRON exit rights (`~921k` EVM gas), while verified repeat partners can draw intraday revolving `creditLimit` backed by signed on-chain debt enforcement. |
| **Zero distributor economics on stablecoin rails** | Sending a customer to `USDT0` or `Binance` pays the referring SaaS, wallet, or OTC bot `0 bps`. | **Native `Builder Codes`:** Any payout SaaS, wallet, Telegram broker, or API gateway embeds `@xln/sdk`, attaches `builderFeeBps`, and keeps **100%** of its fee credited off-chain in real time at `$0` gas. |

### 1.2 Resolving the state-channel capital paradox

In [`Depository.sol`](../jurisdictions/contracts/Depository.sol) (`lines 64–65`), `_collaterals[channelKey][tokenId]` is strictly bilateral: collateral locked by a hub inside `Account(Hub, Alice)` cannot simultaneously secure `Account(Hub, Bob)` without an on-chain rebalance.

This law dictates XLN's product design:

- **Where bilateral channels lose:** One-off, 100%-hub-collateralized retail swaps where a stranger locks hub capital and leaves idle capacity stranded.
- **Where bilateral channels win:**
  1. **User-initiated outbound clearing & conversion:** Alice deposits `$5,000 USDC` on Arbitrum into `Account(Alice, Hub 0)` and streams 40 conversions into `TRON USDT` payouts (`Hub 0` either delivers `TRC-20 USDT` externally or credits recipients—requiring **zero idle pre-locked `Hub 0` collateral inside Alice's channel**).
  2. **Two-way oscillating corridors:** PSPs, brokers, and market makers whose balances swing both ways intraday, cancelling 60–90% of gross chain settlement before touching L1/TRON.
  3. **Bounded `creditLimit` (`RCPAN`):** Counterparties who accept `Hub 0`'s short-duration settlement credit (or vice versa) clear instantaneously without locking `2x` duplicate collateral per user.

---

## 2. Explicit breaks with current XLN canon (what dies before Day 1)

Both `Hyperliquid` and `Relay.link` proved the same launch law: **centralize operations into `Operator 0 = Principal 0` on Day 1, ship the narrowest high-velocity transaction loop behind a 1-signature UX, pay distributors 100% of their fee edge, and decentralize operator roles only *after* real volume exists.**

To launch a living product instead of an eternal specification, this vision explicitly overrides six current rules across [`AGENTS.md`](../AGENTS.md), [`launch-pilot.md`](launch-pilot.md), [`launch-design.md`](launch-design.md), and [`rejected-ideas.md`](rejected-ideas.md):

| Current XLN canon | Launched product decision | Why this cut is mandatory |
| --- | --- | --- |
| **`H1 / H2 / H3` + `MM1 / MM2` launch topology** (`launch-pilot.md:15`, `launch-design.md:35`) | **Collapse into ONE canonical commercial node: `Hub 0` (`XLN Prime`) + one independent Watchtower.** | Splitting initial house capital across 3 hubs and 2 MMs fragments `_collaterals` five ways, multiplies DevOps failure surfaces, and creates fake theater. `Hub 0` holds one undivided pool per chain; external hubs join in Stage 2/3. |
| **Pooled `Bank / Savings / Term Loan` at launch** (`AGENTS.md:17`, `lend.md`, `ui/src/components/BankLendingPolicy.tsx`) | **Hard-disable pooled retail deposits and term loans at admission and delete from `ui/`.** Keep only native bilateral `Account` `creditLimit`. | Relay shut down `Relay Vaults` because passive retail LP pools get run over on cross-chain inventory risk. Pooled uncollateralized lending before proving clearing volume invites catastrophic tail loss. |
| **`Ethereum + TRON` only** (`launch-pilot.md:26`, `AGENTS.md:23` excluding Base/L2s) | **Launch with 3 active jurisdictions: `Arbitrum One` + `Ethereum Mainnet` + `Native TRON`.** | `Depository.sol` deploys unchanged on `Arbitrum One` (`0` Solidity edits; `Account.sol:744` already uses `block.timestamp`, configured with `disputeTimeout >= 48h` to clear Arbitrum's 24h `SequencerInbox` delay). Expecting new users to burn `$5` L1 gas to test a `$200` deposit kills onboarding; `Arbitrum USDC / USDT0` gives `<$0.02`, `<2s` Hyperliquid-grade entry while `Ethereum` serves `$25k+` treasuries. |
| **`1 bp` payment / `3 bp` swap XLN platform tax** (`launch-pilot.md:65`) | **`0 bps` platform fee.** `Hub 0` earns strictly market-making spread (`8–15 bps`); integrators earn `100%` of their custom `Builder Code` fee. | Taxing empty pipes repels liquidity partners and referral desks. Distributors promote rails where *they* capture the fee margin. |
| **Split identity: Svelte `Payments for AI agents` (`+page.svelte`) vs. OTC pilot** | **One unified `XLN Clearing` brand on `xln.finance`.** CLI / HTTP-402 (`cli/agent-payment.ts`) becomes the headless SDK to the *exact same* `Hub 0` Clearing Account. | A treasury operator visiting `xln.finance` today sees an AI-agent toy and leaves; an AI developer finds zero merchants and leaves. One clearing engine serves humans via `ui/` and bots/SaaS via `@xln/sdk`. |
| **`UNLICENSED` Solidity + root `AGPL-3.0` commercial restriction + uncapped Day-1 exposure** | **Re-license `jurisdictions/contracts/*.sol` and `@xln/sdk` to `MIT`**, verify reproducible builds on Etherscan/Arbiscan/Tronscan, keep `Depository.sol` permissionless, and enforce **explicit `Hub 0` commercial quote caps (`$50–$10,000`/fill, `$25,000`/account)** until external audit completes. | No serious fintech, wallet, or PSP integrates an `AGPL` SDK or deposits into `6,647` lines of `UNLICENSED`, unaudited Solidity without transparent house exposure bounds. |

**Also frozen outside the launch critical path:** `rscore/` Rust parity gates, `XLNC`, `Arrakis` / Spice corporate share governance (`EntityProvider.sol` board/dividend UI), and native mobile wrappers.

---

## 3. The launched product experience (`xln.finance` & `@xln/sdk`)

### 3.1 Zero-popup `Agent Key` onboarding (zero `FROZEN_CORE` Solidity edits)

The single greatest UX breakthrough of `Hyperliquid` was separating the **cold funding wallet** (`Rabby` / `MetaMask` / `Ledger`) from the **hot execution session key** (`Agent Wallet`).

XLN's deployed [`Depository.sol`](../jurisdictions/contracts/Depository.sol) **already supports this exact separation without changing a single byte of Solidity**:

1. **Instant local Entity creation (`<200 ms`):** When a user opens `xln.finance` (or runs `npx @xln/sdk init`), the client creates or unlocks a local XLN `Entity` (`entityId`) backed by WebCrypto/Passkey storage in browser IndexedDB (with optional 1-click upgrade to [`BrainVault`](../brainvault/README.md) memory-hard passphrase derivation for high-value desks).
2. **Single-transaction atomic Deposit + Channel Open:**
   - In [`Depository.sol`](../jurisdictions/contracts/Depository.sol) (`lines 493–499` and `679–709`), `_externalTokenToReserve` pulls ERC-20/TRC-20 tokens from `msg.sender` (the user's `Rabby`, `MetaMask`, or `TronLink` wallet) and credits `params.entity = entityId`, **immediately before** `_reserveToCollateral` funds `Account(entityId, Hub 0)` inside the same `processBatch` call (`lines 356–381`).
   - The local `Runtime` pre-signs `hankoData` silently in JavaScript (`0` wallet signature popups); the user approves and confirms **one** deposit transaction in `Rabby` (`~$0.02` on Arbitrum) or `TronLink`.
3. **Zero-popup `<300 ms` execution forever:** Every subsequent payment, cross-chain conversion (`TRON USDT ⇄ Arbitrum USDC / Ethereum USDT`), credit draw, or `Builder Code` fee split is signed silently by the local `Entity` key. Zero MetaMask/TronLink popups, zero native gas tokens (`ETH` or `TRX`) required during operation.
4. **Gasless TRON withdrawals:** Because `Depository.processBatch` is `external` and authenticates authority purely via `entityId`'s `hankoData` (`line 371`), a user holding `0 TRX` signs a cooperative `collateralToReserve + reserveToExternalToken` batch locally, and **`Hub 0` broadcasts it on TRON using `Hub 0`'s staked TRX Energy pool**. Users never buy `TRX` just to move `USDT`.

### 3.2 Killing the `32.1 s` wallet-import wall

[`core/jurisdiction/adapter/receipt/reader.ts`](../core/jurisdiction/adapter/receipt/reader.ts) (`lines 392–448`) currently blocks cold wallet import for ~`32.1 seconds` scanning raw RPC block receipts. In the launched product:

- `Hub 0` serves the latest dual-signed `AccountFrame` + signed checkpoint snapshot over WebSocket in **`<150 ms`**, rendering balances and executable quotes immediately under an explicit `Hub-Attested` badge.
- A background Web Worker runs `readAuthenticatedReceiptRange` asynchronously after first paint, upgrading the status indicator to `Chain-Verified` without ever blocking user entry.

### 3.3 The 3-screen `xln.finance` interface

All internal state-channel scaffolding currently exposed in `ui/src/components/` (`EntitySwitcher.tsx`, `Formation.tsx`, `ManualSwapRoutes.tsx`, `BankLendingPolicy.tsx`, `ReceiveCapacity.tsx`, `BatchFeeWarning.tsx`) is removed from the primary user flow. `xln.finance` ships with **three screens**:

```text
+-----------------------------------------------------------------------------+
| XLN CLEARING                         [Chain-Verified]  [Safety & Exit (1)]  |
+-----------------------------------------------------------------------------+
| CLEARING TAB                                         Saved: $418 TRON/L1 gas|
|                                                                             |
|  Secured Principal (100% On-Chain Backed)      Intraday Credit Line (Hub 0) |
|  $14,820.50                                    $5,000.00 available          |
|   - 8,400.00 USDC (Arbitrum)                   Unsecured cap; settles T+0   |
|   - 6,420.50 USDT (TRON)                                                    |
+-----------------------------------------------------------------------------+
| [ Convert & Swap ]   [ Pay / Batch Payout ]   [ API & Builder Codes ]       |
|                                                                             |
|  Pay From:  [ 2,500.00 ] [ USDC · Arbitrum v ]                              |
|  Deliver:   [ 2,497.50 ] [ USDT · TRON     v ]  (Firm quote: 10 bps · 4.2s) |
|  Recipient: [ Self (Clearing Tab)  OR  External TRON T... / 0x... address ] |
|                                                                             |
|  Fee breakdown: $2.50 corridor spread · $0.00 TRON Energy · ~240 ms commit  |
|  [ Execute Instant Clearing ]                                               |
+-----------------------------------------------------------------------------+
```

1. **Clearing Tab (Home):**
   - Strictly separates **Secured Principal** (100% backed by on-chain `Depository.sol` collateral, unilaterally recoverable if `Hub 0` disappears) from **Available Credit Line** (optional bounded `creditLimit` extended by `Hub 0` or a bilateral partner, adhering strictly to [`owner-profile.md`](owner-profile.md) `line 62`).
   - Displays a live **Netting Efficiency Meter**: *"112 operations cleared off-chain this week · 2 chain settlements · $312 saved in TRON Energy & L1 gas."*
2. **Instant Convert & Pay (Two Native Modes):**
   - **Mode A — Corridor Conversion (`<300 ms`):** Convert `USDC · Arbitrum`, `USDT · Arbitrum/Ethereum`, and `USDT · TRON` back and forth inside the Clearing Tab via `DeltaTransformer` hash-ladder swaps against `Hub 0`. Firm 5-second executable quotes; zero slippage; zero chain gas.
   - **Mode B — Instant Pay & `Payout-on-Behalf` (Single or CSV/API Batch):**
     - If the recipient is an XLN Entity: settles off-chain in `<200 ms` for `$0.00` with 100% Etherscan/Tronscan privacy.
     - If the recipient is a raw external `T...` TRON address or `0x...` EVM address: the sender debits their XLN Clearing Tab off-chain (`USDC_ARB` or `USDT_TRON`), and **`Hub 0` dispatches native `TRC-20 USDT` from `Hub 0`'s hot payout wallet using staked TRX Energy**, returning the signed TRON txid receipt in `<3 seconds`. A company holding `Arbitrum USDC` can pay 200 contractors in `TRON USDT` via one CSV upload or API call without ever touching `TRX`, TronLink, or a CEX.
3. **Sovereign Safety & 1-Click Exit Drawer:**
   - Live heartbeat of the independent **Secondary Watchtower** ([`last-resort-appointment.ts`](../core/watchtower/last-resort-appointment.ts)).
   - 1-click **Download Signed Proof Bundle** (`AccountProof` JSON) and 1-click **Unilateral On-Chain Exit** showing exact worst-case gas (`~921,213` EVM gas) so custody safety is verifiable, never "trust us."

### 3.4 Headless `@xln/sdk` for SaaS platforms, bots, and AI gateways

Every action in `ui/` is a thin wrapper over `@xln/sdk` talking to the same `Runtime` RPC:

```ts
import { createClearingClient } from '@xln/sdk';

const xln = await createClearingClient({ keyStore: envKeyStore(), hub: 'wss://prime.xln.finance' });

// Convert Arbitrum USDC -> TRON USDT and pay external contractor in <3s, earning 20 bps Builder Fee
const receipt = await xln.convertAndPayout({
  fromAsset: 'arbitrum:USDC',
  toAsset: 'tron:USDT',
  amountOut: '1500.00',
  destination: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
  builder: { entityId: MY_PLATFORM_ENTITY_ID, feeBps: 20 },
});
```

This turns the existing [`cli/agent-payment.ts`](../cli/agent-payment.ts) durable-intent flow (`prepare` → WAL intent → `send` → receipt) into an embeddable B2B treasury and agent-clearing SDK.

---

## 4. Capital physics, `Hub 0` liquidity engine, and unit economics

### 4.1 `Hub 0` Day-1 balance sheet (`$150k` baseline / `$50k` lean floor)

`Hub 0` does **not** speculate on volatile tokens at launch. Its entire Day-1 inventory stays in USD stablecoins plus staked `TRX` (hedged via short `TRX-PERP` on Hyperliquid so `Hub 0` has zero `TRX` price exposure while generating free daily TRON Energy):

| Pool / Leg | Lean Launch (`$60k`) | Target Launch (`$165k`) | Role in `Hub 0` engine |
| --- | --- | --- | --- |
| **`TRON USDT`** (`Depository` + hot payout buffer) | `$25,000` | `$70,000` | Instant `EVM → TRON` corridor fills & external `TRC-20` `Payout-on-Behalf` |
| **Staked `TRX` + Hyperliquid short `TRX-PERP` hedge** | `$5,000` (`$4k` staked + `$1k` margin) | `$15,000` (`$12k` staked + `$3k` margin) | Generates renewable daily TRON Energy so `Hub 0`'s `TRC-20` payouts & rebalances burn **`$0` marginal TRX** |
| **`Arbitrum USDC` & `USDT0`** | `$20,000` | `$50,000` | Instant `<$0.02` EVM onboarding, `TRON → EVM` payouts, and fast wholesale bridge leg |
| **`Ethereum Mainnet USDT` & `USDC`** | `$10,000` | `$30,000` | Larger treasury settlements & `USDT0` / CEX rebalance rail |
| **Max single instant quote / Max pre-audit per-account cap** | `$2,500` / `$10,000` | `$10,000` / `$25,000` | Ensures zero single counterparty or bug can exhaust house liquidity |

### 4.2 Dynamic skew pricing & automated wholesale rebalancing

`Hub 0` runs a deterministic inventory-skew quoter with zero human intervention:

1. **Neutral zone (`35%–65%` inventory balance):** Quotes **`8 bps`** (`0.08%`) on `TRON USDT ⇄ Arbitrum/ETH USDC & USDT`, plus `$0.50` flat only when dispatching an external raw `TRC-20` `Payout-on-Behalf` (still `60–80%` cheaper than raw TRON Energy + bridge fees!). Off-chain XLN-to-XLN conversions pay **`$0.00` fixed fee**.
2. **Organic skew healing (`<35%` on scarce side):** If heavy `EVM → TRON` payout demand drains `Hub 0`'s `TRON USDT` pool to `30%`, `EVM → TRON` quotes widen to **`16–20 bps`**, while reverse `TRON → EVM` quotes tighten automatically to **`0–1 bp`**. PSPs sweeping `TRON USDT` into `EVM USDC` get near-zero-cost conversion and refill `Hub 0`'s `TRON USDT` organically for free.
3. **Automated wholesale rebalancer (`<25%` threshold):** When inventory hits `25%`, `Hub 0`'s background daemon automatically rebalances a `$15k–$30k` clip via `USDT0` (`1–3 bps`) or an institutional CEX subaccount (`Binance`/`OKX` `0–1 bp` `USDC/USDT` + `$1` TRC-20/Arbitrum withdrawal) within 3–5 minutes—costing **`~2.5–3.5 bps` wholesale** against **`8–18 bps` earned retail/B2B spread**.

### 4.3 Throughput and revenue physics

Because working capital scales with `ticket_size × rebalance_time` rather than daily volume:

| Stage | `Hub 0` Working Float | Daily Turnover (Net + Rebalanced) | Daily `MML` Volume | Monthly `MML` Volume | Net `Hub 0` Spread Margin (after `~2 bps` avg rebalance cost) |
| --- | --- | --- | --- | --- | --- |
| **Canary (Month 1)** | `$60,000` | `3x / day` | `$180,000` | `$5.4M` | `~7 bps` net = **`~$3,780 / mo`** (covers infra + watchtower Day 1) |
| **Seed Scale (Month 3)** | `$165,000` | `6x / day` (with 40% opposing-flow internal netting) | `$990,000` | `$29.7M` | `~8.5 bps` net = **`~$25,200 / mo`** |
| **Corridor Scale (Month 6)** | `$500,000` | `8x / day` (with 55% internal netting) | `$4,000,000` | `$120.0M` | `~9 bps` net = **`~$108,000 / mo`** (`$1.3M / yr` run-rate on `$500k` float) |

---

## 5. Distribution engine: native `Builder Codes` + `Bilateral Prime`

### 5.1 Zero-Solidity `Builder Codes` (turning integrators into XLN's sales force)

Instead of hiring BD reps to cold-pitch end users one by one, XLN adopts `Hyperliquid`'s highest-leverage growth mechanism—**`Builder Codes`**—implemented purely inside the `Entity` / `Runtime` transition layer (**zero edits to `Depository.sol` or `Account.sol`**):

1. Any integrator (a payroll SaaS, Telegram OTC/remittance bot, LatAm/SEA PSP dashboard, wallet, or MCP/AI API router) creates a standard XLN `Entity` (`builderEntityId`).
2. When an end user authorizes that app/bot, the user signs an off-chain `ApproveBuilderFee(builderEntityId, maxFeeBps)` envelope (capped at `100 bps`).
3. On every swap or payout routed through `Hub 0`, Stage 2/3 of `Hub 0`'s `RuntimeFrame` atomically deducts `builderFeeBps` from the user's quote and dispatches an instant off-chain `AccountTx` credit into `Account(Hub 0, builderEntityId)` at **`$0.00` gas**—even if the fee is `$0.004`!
4. The builder withdraws accumulated `USDC` or `USDT` whenever they choose. **XLN takes `0%` of the builder's fee.**

### 5.2 The three Day-1 customer & distributor segments

1. **Global Contractor Payroll, Creator & Affiliate Payout Platforms (`Builder Code` SaaS):**
   - *Pain today:* Hold treasury in `USDC` (`Arbitrum` / `Ethereum` / `Coinbase`), pay 100–2,000 contractors or affiliates weekly in `TRON USDT` (`$100–$3,000` each). Currently juggle manual CEX conversions, `TRX` Energy top-ups, and `$2+` per payout.
   - *With XLN:* Fund `Arbitrum USDC` once; fire one `@xln/sdk` batch call; contractors receive `TRON USDT` in `<3s` (or `$0` instant into XLN), while the payroll SaaS earns `15–30 bps` via its `Builder Code`.
2. **Regional Emerging-Market PSPs & Remittance Aggregators (LATAM, SEA, Turkey, CIS, Nigeria):**
   - *Pain today:* Collect `TRON USDT` across dozens of daily merchant settlements; need `Arbitrum / Ethereum USDC` to settle wholesale FX liquidity providers; lose `30–100 bps` to custodial swap desks (`FixedFloat` / Telegram OTC) and leak every client wallet on Tronscan.
   - *With XLN:* Sweep `TRON USDT` into `Account(PSP, Hub 0)`, convert continuously at `0–8 bps` off-chain in `<300 ms` with private counterparty state, and once verified, use bounded 4-hour intraday `creditLimit` (`$5k–$25k`) to pre-settle outbound payouts before slow local rails clear.
3. **Telegram OTC Bots, Boutique Swap Desks & Metered AI/API Gateways:**
   - *Pain today:* Telegram swap/remittance bots either custody user funds (regulatory & hack target) or forward orders to centralized exchanges for thin affiliate scraps; AI/MCP gateways (`cli/agent-payment.ts` niche) cannot charge `$0.002` per tool call on L1/TRON rails or `Relay` (`$0.005` floor).
   - *With XLN:* Non-custodial user session keys + `0`-gas bilateral micro-clearing + `100%` `Builder Code` revenue.

### 5.3 Three-stage network evolution (`Hub 0` → `Bilateral Prime` → `Open Mesh`)

Because `Hub 0` has **zero special smart-contract privileges** in `Depository.sol`—it is simply the first well-capitalized `Entity`—the launched product scales organically toward XLN's long-term `MML` mission without changing architecture:

- **Stage 1 — `Hub 0` Principal Corridor (Days 1–60):** 100% of users connect to `Hub 0`. Tickets capped at `$10,000`; `Builder Codes` onboard the first 5–10 distribution partners; external Solidity audit runs in parallel against frozen mainnet contracts.
- **Stage 2 — `Bilateral Prime` & Competing Quoters (Days 60–180):** Post-audit, larger OTC desks and PSPs (`$25k–$250k` tickets) spin up their own `Runtime` via a 1-command Docker/binary bundle—opening direct `Account(Desk, Client)` bilateral credit/collateral lines with their own repeat clients while plugging into `Hub 0` for overflow liquidity.
- **Stage 3 — Open Multi-Hub Clearing Mesh (Month 6+, `>$50M` cumulative `MML`):** Independent hubs (`H1 / H2 / H3`) compete on fee/spread and corridor specialization (`Solana`, `Base`, `Tempo`, local stablecoins), turning `Hub 0`'s initial corridor into a neutral global commercial clearing mesh.

---

## 6. Pre-launch engineering cut-list & 90-day falsification contract

### 6.1 Exact repository delta to ship v1.0 (target: <= 21 days of engineering)

| Action | Repository target | Concrete change |
| --- | --- | --- |
| **1. Freeze & re-license custody boundary** | [`LICENSE`](../LICENSE), [`jurisdictions/contracts/`](../jurisdictions/contracts/) | Dual/split license: `MIT` headers on all `jurisdictions/contracts/*.sol` and `@xln/sdk`; publish deterministic compiler settings & verified source on Etherscan, Arbiscan, and Tronscan. Keep `FROZEN_CORE` untouched. |
| **2. Add `Arbitrum One` + Mainnet configs** | [`jurisdictions/jurisdictions.json`](../jurisdictions/jurisdictions.json) | Register canonical `Ethereum Mainnet` (`USDT`, `USDC`), `Arbitrum One` (`USDC`, `USDT0`, `disputeTimeout >= 48h`), and `TRON Mainnet` (`USDT`). |
| **3. Fast snapshot boot + async verifier** | [`core/jurisdiction/adapter/receipt/reader.ts`](../core/jurisdiction/adapter/receipt/reader.ts), `ui/` | Boot `ui/` in `<150 ms` from signed `Hub 0` checkpoint + `AccountFrame`; move `readAuthenticatedReceiptRange` into a non-blocking background Web Worker. |
| **4. Strip `ui/` down to the 3 Clearing screens** | [`ui/src/components/`](../ui/src/components/), [`frontend/`](../frontend/) | Disable `BankLendingPolicy`, `Lending*`, `EntitySwitcher`, `Formation`, `ManualSwapRoutes`, `ReceiveCapacity` in production admission & UI. Replace Svelte AI-agent landing copy (`+page.svelte`) with live `Hub 0` executable corridor quotes (`TRON USDT ⇄ Arbitrum/ETH USDC`) and `@xln/sdk` `Builder Code` docs. |
| **5. Ship `Hub 0` Quoter, `Payout-on-Behalf` & `Builder Codes`** | `core/swapbook/cross-j/`, `core/api/payments/`, `@xln/sdk` | Add skew-aware `Hub 0` stablecoin quoter, `ApproveBuilderFee` frame split (`0` Solidity changes), external `TRC-20` `Payout-on-Behalf` receipt dispatcher backed by staked `TRX` Energy, and automated `USDT0`/CEX threshold rebalancer. |
| **6. Stand up independent Watchtower** | [`core/watchtower/last-resort-appointment.ts`](../core/watchtower/last-resort-appointment.ts) | Deploy an always-on Watchtower on a separate cloud/provider from `Hub 0`, automatically registered on every `Hub 0` customer `Account`. |

### 6.2 Non-negotiable 90-day falsification gates

No refactoring campaigns, Rust rewrites, or new features (`Lending`, `Companies`, `XLNC`) may open until these live mainnet gates clear with **unaffiliated `MML` dollars**:

- **Day 14 (Live Canary Gate):** `Hub 0` live on `Arbitrum One`, `Ethereum`, and `Native TRON` with `>=$60k` house float; cold user completes `Rabby` `Arbitrum USDC` atomic deposit → `<300 ms` off-chain conversion → `<3s` gasless `TRON USDT` external payout and 1-click unilateral exit rehearsal on mainnet.
- **Day 30 (First Unaffiliated Traction Gate):** `>= 5` unaffiliated active businesses/desks/bots, `>= 200` completed real-money corridor operations, `>= $250,000` cumulative `MML` volume, `< 2%` quote rejection rate inside published size bands.
  - *Hard kill trigger at Day 45:* If `Hub 0` is live with `<300 ms` 1-click quotes and `0 bps` platform fee, we pitch 30 payout/PSP/OTC teams directly with live demos, and **fewer than 3 fund even `$500` on Arbitrum to route real TRON payouts**, then the `TRON ⇄ EVM` non-custodial clearing thesis is falsified—freeze corridor expansion immediately rather than adding features.
- **Day 60 (Distributor Loop Gate):** `>= 3` live `Builder Code` integrators originating `>= 30%` of weekly `MML` volume; `>= $2.5M` cumulative `MML`; external Solidity security audit completed and published so per-account caps can lift from `$25k` to `$250k+`.
- **Day 90 (Default-Alive Corridor Gate):** `>= 20` weekly active commercial Entities, `>= 50%` Week-4 cohort retention, `>= $10M / month` `MML` run-rate, and positive net `Hub 0` spread contribution after all rebalancing and infrastructure costs—unlocking Stage 2 (`Bilateral Prime` external market makers).
