# Study Brief: XLN Product Boundary & Go-To-Market (November 2026)

> **Cold-Entry Protocol for Reviewers / Models ([`AGENTS.md`](../../../AGENTS.md#L223-L238))**:
> 1. Read this `brief.md`, inspect the live repository files in §2, and check primary 2026 external market documentation as needed.
> 2. **Anti-priming rule:** Do **not** read [`claims.md`](./claims.md), [`chat.md`](./chat.md), sibling files in [`perspectives/`](./perspectives/), or the quarantined prior LLM memos listed in §5 **until after** you have written and saved your own signed position in `perspectives/<your-model-id>.md` following [`perspectives/template.md`](./perspectives/template.md).
> 3. Treat `RELEASE SCOPE` in [`AGENTS.md`](../../../AGENTS.md), [`todo.md`](../../../todo.md), and existing `docs/` plans as **falsifiable hypotheses**, not axioms.

---

## 1. Context & Core Question

XLN (`xlnfinance/xln`, commit `019d45b`, `v0.1.31`, 5,823 commits) implements a deterministic off-chain financial state machine modeled around **Jurisdictions (`J`), Entities (`E`), and bilateral Accounts (`A`)**. A bilateral `Account` (`RCPAN`) combines earmarked on-chain collateral, bounded unsecured counterparty credit limits (`creditLimit`), and programmable bilateral conditions (`DeltaTransformer`), settling net or disputed outcomes on programmable jurisdictions (currently Ethereum/EVM Solidity contracts, with native TRON integration in progress).

Despite substantial working infrastructure across consensus, bilateral payments, swaps, lending primitives, an HTTP 402 `mppx` adapter (`xln/charge`), and a standalone memory-hard seed-derivation package (`brainvault/`), XLN remains pre-mainnet with:

- **`0` completed external third-party smart-contract audits**,
- **`0` signed commercial counterparty intents** ([`todo.md`](../../../todo.md) line 57), and
- **`MML = 0`** (zero live unaffiliated commercial obligations).

**Central question of this study:**
> *In the actual November 2026 crypto and financial-infrastructure market, what—if anything—is XLN's sharpest viable product boundary and go-to-market wedge, what breaks under realistic adversarial scrutiny, and what concrete experiment falsifies it within 2–6 weeks?*

---

## 2. Authoritative Repository Source Map

Inspect primary code and state directly rather than relying on summaries:

1. **Jurisdiction Smart Contracts (`jurisdictions/contracts/` — `6,409` physical lines total)**
   - Custody, reserve-to-collateral (`R2C`), settlement, and debt rows: [`Depository.sol`](../../../jurisdictions/contracts/Depository.sol) (`1,079` lines)
   - Bilateral account disputes, Hanko signature verification, and exit math: [`Account.sol`](../../../jurisdictions/contracts/Account.sol) (`1,860` lines), [`DeltaTransformer.sol`](../../../jurisdictions/contracts/DeltaTransformer.sol) (`455` lines), [`HankoVerifier.sol`](../../../jurisdictions/contracts/HankoVerifier.sol) (`386` lines)
   - Entity registration, board governance, and control rules: [`EntityProvider.sol`](../../../jurisdictions/contracts/EntityProvider.sol) (`1,212` lines)

2. **Runtime, Financial Books & Engines**
   - Canonical TypeScript RJEA engine (`paybook`, `swapbook`, `lendbook`, WAL, relay, watchtower): [`core/`](../../../core/) and [`docs/core/rjea-architecture.md`](../../core/rjea-architecture.md)
   - Secondary Rust engine: [`rscore/`](../../../rscore/)
   - Headless payment CLI & experimental `mppx` (`xln/charge`) HTTP 402 integration: [`cli/agent-payment.ts`](../../../cli/agent-payment.ts), [`core/api/payments/`](../../../core/api/payments/), [`docs/agent-payments.md`](../../agent-payments.md)

3. **Wallets, Public Landing Copy & Standalone Cryptography**
   - Canonical React wallet: [`ui/`](../../../ui/)
   - Live `xln.finance` landing page title/copy: [`frontend/src/routes/+page.svelte`](../../../frontend/src/routes/+page.svelte)
   - Standalone `2.5 TiB` memory-hard Argon2id + BLAKE3 wallet derivation (`603` portable lines, Apple Silicon Metal/NEON): [`brainvault/README.md`](../../../brainvault/README.md)

4. **Current Internal Scope, Release Gates & Self-Critique**
   - Live release queue & blockers (`32.1 s` wallet import latency, Sepolia dispute drills, native TRON, 1,000-user TPS, pooled bank lending): [`todo.md`](../../../todo.md)
   - Current owner/pilot/pricing hypotheses (falsifiable—do not treat as fixed truth): [`AGENTS.md`](../../../AGENTS.md), [`docs/owner-profile.md`](../../owner-profile.md), [`docs/launch-pilot.md`](../../launch-pilot.md), [`docs/competitors.md`](../../competitors.md), [`docs/lend.md`](../../lend.md), [`docs/pricing-competitive.md`](../../pricing-competitive.md), [`docs/rejected-ideas.md`](../../rejected-ideas.md), [`docs/crisis-review-20261011.md`](../../crisis-review-20261011.md)

---

## 3. Five Mandatory Orthogonal Angles

Whether assigned a primary lens or evaluating the whole problem, test your conclusions explicitly against all five orthogonal planes:

1. **Capital & Float Physics:** Who supplies initial liquidity, market-making inventory, or credit principal? What is their real lockup, hedging, and rebalancing cost? Who currently profits from holding custodial float, and why would they surrender or bypass it?
2. **2026 Substitute Baseline:** Compare against the strongest incumbent workflow available in 10 minutes today—`Base`/`Arbitrum`/`Solana`/`Hyperliquid` (`<600 ms`, `<$0.01`), `Permit2` EIP-712 atomic RFQs (`Bebop`, `1inch OTC`, `CowSwap`, `AirSwap`), `2-of-3 Safe{Wallet}` multisigs, `USDT0` (`1–3 bps`), `Relay` / `LI.FI`, `Fireblocks Off-Exchange` / `Copper ClearLoop`, `Wildcat` / `Morpho`, `Arf` / `Huma`, `Tempo` `TIP-1034` unidirectional vouchers, and internal Postgres prepaid ledgers—never against 2018 Ethereum L1 or legacy SWIFT.
3. **Trust & Failure Surface:** How does a rational counterparty evaluate `6,362` lines of unaudited `UNLICENSED` Solidity, online watchtower liveness, `32.1 s` wallet import latency, MPC/hardware-wallet signing constraints, and tail-loss allocation during stress?
4. **Buyer & Distributor Incentive:** Who is the exact decision-maker (incumbent vs. challenger vs. developer vs. trader), what specific deal or revenue are they losing today, who stakes personal reputation internally, and what fee structure (`bps` vs. SaaS vs. spread vs. principal margin) sustains both sides?
5. **Falsification & Scope Cut:** What is the smallest Day-1 unit (`1 pair`, `1 operator`, or `1-player tool`), which items in [`todo.md`](../../../todo.md) must be frozen immediately, and what hard 2–6 week signal proves the wedge is dead?

---

## 4. Questions Every `perspectives/<model-id>.md` Must Answer

1. **Diagnosis of Current XLN Scope & Positioning:** Where do `xln.finance` (`+page.svelte`), [`launch-pilot.md`](../../launch-pilot.md), and [`todo.md`](../../../todo.md) contradict each other or fail against 2026 substitutes?
2. **Sharpest Viable Wedge (or Non-Existence Proof):** Name the single highest-conviction customer, use case, and product unit—or argue directly that standalone bilateral state-channel software has no viable external buyer without XLN becoming a funded principal or pivoting product category.
3. **Stress-Test Across the Five Angles:** Attack **your own** recommended wedge across Capital/Float Physics, 2026 Substitutes, Trust/Failure Surface, and Buyer Incentives. State explicitly where your own proposal is most likely to fail.
4. **Heresy / Non-Obvious Reframing:** What framing of XLN (or `brainvault/`, `Depository.sol`, `swapbook`, `lendbook`, `xln/charge`) looks wrong to existing `docs/` canon yet deserves serious consideration?
5. **Concrete 2–6 Week Falsification Experiment & Scope Cut:** Exact Day-1 actions, exact repository surfaces kept vs. frozen, and the binary pass/fail metric at the kill deadline.

---

## 5. Quarantined Prior Memos (Read ONLY in Step 4 Cross-Examination)

Do **not** read these files before saving your cold-entry `perspectives/<model-id>.md`. Read and challenge them afterward in [`chat.md`](./chat.md) and [`claims.md`](./claims.md):

- [`docs/xln-market-research-2026-11-12.md`](../../xln-market-research-2026-11-12.md) (Codex settlement & solver-credit case audit)
- [`docs/crypto-liquidity-research-2026-11-13.md`](../../crypto-liquidity-research-2026-11-13.md) (Codex liquidity & incentive forensics across Robinhood, Hyperliquid, Relay, Polymarket, stablecoin credit)
- [`docs/xln-honest-gtm-2026-11-13.md`](../../xln-honest-gtm-2026-11-13.md) (Antigravity/Gemini adversarial synthesis & challenger-operator critique)
