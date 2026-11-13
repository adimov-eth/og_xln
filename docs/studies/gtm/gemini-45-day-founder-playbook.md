# The 45-Day Founder Playbook for XLN

Date: 13 November 2026 · Author: `antigravity-gemini-4-high` · Baseline: `019d45b` (`v0.1.31`, 5,823 commits, `MML = 0`)

---

## 1. Unvarnished Premise (Why This Playbook Exists)

Before touching another line of code, three truths have to be stated plainly:

1. **In 2026, XLN loses on ~90% of crypto workflows—and wins decisively on ~10%.**
   - For retail trading, shared-state CLOBs (`Hyperliquid`) pool `$1M` of maker margin across 100,000 users simultaneously, whereas [`Depository.sol`](../../../jurisdictions/contracts/Depository.sol) (`lines 64–65`) traps `_collaterals[channelKey]` per pair.
   - For casual swaps and bridges, EOA intent fillers (`Relay.link`, `USDT0`, `Permit2` RFQs) execute in seconds with zero channel setup, zero watchtowers, and zero stranded inbound capacity.
   - For 0-collateral lending, an unpaid `Debt` struct in [`Depository.sol`](../../../jurisdictions/contracts/Depository.sol) (`line 613`) against an abandoned `entityId` collects `$0` without real-world legal enforcement.
   - **Where XLN genuinely beats every system on Earth** is the intersection of **repeat bilateral velocity + partial first-loss collateral + bounded credit (`RCPAN`) + unilateral signed exit + commercial privacy**—effectively **permissionless `Copper ClearLoop` / off-exchange prime clearing + gasless `TRON ⇄ EVM` netting** without a `$100k+/yr` tri-party MPC custodian (`Account.sol` + `DeltaTransformer.sol`).
2. **Every real advantage XLN has is a *multiplier on an active commercial book*, never a magnet for strangers.**
   `10x` better bilateral clearing efficiency multiplied by `0` live counterparty flow still equals `0`. Nobody wakes up wanting "a bilateral state channel."
3. **The real bottleneck is founder-market alignment, not missing protocol features.**
   `Hyperliquid` worked because Jeff Yan *already ran* `Chameleon Trading`. `Relay` worked because Peter Watts *already had* `Reservoir` wired inside MetaMask, OpenSea, Coinbase, and Zora. You built the `Engine` half (`519k` lines of TS, `245k` lines of Rust, `6.4k` lines of Solidity), while [`todo.md`](../../../todo.md) (`line 57`: `10 desk conversations, 2 signed intents`) sits at **`0`**. Continuing to expand `rscore/`, `WideMath`, `Lending`, and `1,000 TPS` ([`crisis-review-20261011.md`](../../crisis-review-20261011.md)) has become architectural perfectionism functioning as shelter from finding out whether B2B operators actually care—and whether you even *want* to spend five years operating a low-margin OTC/payout balance sheet.

This 45-day playbook breaks that stalemate cleanly: **2 weeks to put a bounded, real-money mainnet machine online (ending 8 years of pre-launch limbo), 30 days to test 25 live desks and hunt for a commercial principal co-owner, and a ruthless binary decision on Day 45 with zero goalpost-moving.**

---

## 2. Days 1–14: Hard Code Freeze & The `$25k` Mainnet Canary

**Goal:** End testnet theater and internal refactoring immediately. Walk into operator conversations holding a live mainnet clearing machine with real skin in the game and a verified Etherscan/Tronscan unilateral dispute exit.

### 2.1 Day 1 — Immediate Scope Freeze

Freeze 85% of the active backlog outside launch admission:
- **Frozen immediately:** `rscore/` Rust parity, pooled `Bank / Savings / Term Loan` (`lendbook`), `1,000-user TPS` stands, `2^200` `WideMath`, `EntityProvider` corporate boards/shares/dividends, `Arrakis` / `XLNC`, and `H1 / H2 / H3` multi-hub routing theater.
- **Retained launch surface:** Single-star **`Hub 0`** + **1 independent Watchtower**, bilateral `Account` payments, two-token same-J swaps, `Ethereum ⇄ Native TRON` cross-J swaps, partial collateral (`R2C` / `C2R`), bounded `creditLimit`, and unilateral dispute/exit.

### 2.2 Days 2–9 — The Only Three Code & License Fixes Allowed

1. **Eliminate the `UNLICENSED` blocker:**
   Add `SPDX-License-Identifier: MIT` to [`jurisdictions/contracts/`](../../../jurisdictions/contracts/) and client SDK packages; publish deterministic compiler settings and verified source on Etherscan and Tronscan. Leave `FROZEN_CORE` logic untouched.
2. **Eliminate the `32.1 s` import wall & channel-debugger UI:**
   - Serve a dual-signed `Hub 0` checkpoint + latest `AccountFrame` over WebSocket so [`ui/`](../../../ui/) renders in **`<200 ms`** (`Hub-Attested`), moving [`readAuthenticatedReceiptRange`](../../../core/jurisdiction/adapter/receipt/reader.ts) (`lines 392–448`) into a non-blocking background worker (`Chain-Verified`).
   - Hide `Formation.tsx`, `BankLendingPolicy.tsx`, `ManualSwapRoutes.tsx`, `EntitySwitcher.tsx`, and `ReceiveCapacity.tsx` behind an expandable `Inspect Proof` drawer. Show only three numbers on the main screen: **Secured On-Chain Principal**, **Available Credit Line**, and **Net Fees/Gas Saved**, plus **Convert / Pay** and **1-Click Unilateral Exit**.
   - Use [`Depository._processBatch`](../../../jurisdictions/contracts/Depository.sol) (`lines 480–500, 679–709`) as-is so the user's cold `Rabby` / `MetaMask` / `TronLink` wallet funds once into a silent local JS **`Agent Key`** `Entity` (`0` wallet popups on subsequent `<300 ms` fills; hosted encrypted replica option on `Hub 0` while keys remain strictly client-held).
3. **Unify `xln.finance` around one honest page:**
   Replace `"XLN — Payments for AI agents"` ([`+page.svelte`](../../../frontend/src/routes/+page.svelte)) with:
   - What is live right now (`Ethereum USDT/USDC ⇄ Native TRON USDT` + two-token EVM net-settlement);
   - Live `Hub 0` executable capacity and explicit Canary risk caps (`$5,000` max single fill, `$15,000` max per-Account exposure pre-audit);
   - Pinned Etherscan + Tronscan links proving a completed mainnet dispute and unilateral exit.

### 2.3 Days 10–14 — Mainnet Deployment & Public Dispute Proof

1. Deploy one dedicated `Hub 0` `Depository.sol` stack on **Ethereum Mainnet** and **Native TRON Mainnet** (isolating `USDT`/`USDC` issuer-blacklist blast radius to `Hub 0`'s book) plus one always-on Watchtower on separate cloud infrastructure.
2. Fund `Hub 0` with **`$25,000–$50,000` of founder canary capital** (`~$15k–$25k` `TRON USDT` + `$3k` staked `TRX` for renewable Energy + `~$10k–$20k` `Ethereum USDC/USDT`). Small enough that even a worst-case bug in unaudited Solidity cannot ruin you; real enough that every quote is backed by real dollars.
3. Execute a complete real-money cycle from an external wallet—**deposit → `<300 ms` off-chain swaps & credit draw → intentional non-cooperation → on-chain dispute start → Watchtower counter-proof → finalized unilateral withdrawal**—and pin the transaction links on `xln.finance`.

---

## 3. Days 15–45: 25 Operator Demos & Hunting the Missing Co-Owner

**Strict Rule:** During Days 15–45, **zero new features** are written. Engineering touches only live Canary bugs. 100% of founder focus goes to direct, founder-to-founder conversations—never delegated to AI agents, cold forms, or paid retainers that manufacture fake compliance.

### 3.1 Who Sits Across the Table (25 Named Principals)

1. **10 Regional `USDT` PSPs & Remittance Aggregators** (LATAM, SEA, UAE, Turkey, CIS, Nigeria) sweeping `TRC-20 USDT` merchant inflows against `EVM USDC` liquidity providers multiple times per week.
2. **8 Cross-Border Payout / Contractor Payroll / Affiliate Platforms** holding `USDC` treasury on EVM and paying dozens to hundreds of `TRON USDT` recipients weekly.
3. **7 Boutique OTC / RFQ Principals & Independent Market Makers** (including ex-Cumberland, Wintermute, Flowdesk, or B2C2 traders running `$5M–$50M/mo` books below `Fireblocks Off-Exchange` / `Copper ClearLoop` minimums).

### 3.2 The Two Offers Put on the Table (Live Mainnet Screen-Share, Zero Slides)

Open every call by executing a live `$500` cross-chain conversion/payment in `<300 ms` on `xln.finance` and showing the Etherscan unilateral exit transaction. Then test two explicit propositions:

1. **Offer A — The 14-Day Zero-Fee Live Workflow Test (Testing the Product):**
   > *"Take your single most annoying recurring counterparty or `TRON ⇄ ETH` sweep leg. Post `$2k–$5k` of first-loss collateral into `Depository.sol` (your keys, hosted replica, 1-click unilateral exit); `Hub 0` extends `$5k–$10k` of intraday/short-term credit on top. Run real flow through it for 14 days at `0` platform fee. Tell me if `partial collateral + instant credit netting` actually beats `USDT0` + `Permit2` + Telegram."*
2. **Offer B — Recruiting the Commercial Co-Owner (Solving the `Chameleon` / `Reservoir` Gap):**
   You should not spend the next five years solo-operating OTC compliance, KYC, and credit collections. Actively screen those 25 principals for **the one hungry commercial operator who already controls `$10M+/mo` of recurring counterparty flow**, immediately grasps how non-custodial partial-collateral clearing lets them win deals larger custodians/OTCs block, and wants **real co-ownership/equity in the commercial `Hub 0` entity** (not a mercenary retainer) to bring their live book and run the commercial desk while you own the protocol and cryptography.

### 3.3 Evidence Logged After Every Conversation (No Self-Deception)

Record four binary facts per desk:
- Did they fund `$2k–$5k` on mainnet within 7 days of seeing the live demo? (`Yes / No`)
- If `No`, what exact incumbent won? (`USDT0` / `Relay` / `Permit2` / `Fireblocks` / `Telegram spreadsheet` / `Unaudited contract risk`)
- If `Yes`, did average drawn credit / netted balance exceed **`31%` of `Hub 0` inventory locked for them** (beating passive `Aave` yield at `3–5 bps/day`)?
- Did XLN enable a credit limit or trade frequency they **refused** to run on a manual spreadsheet?

---

## 4. Day 45: The Ruthless Binary Verdict

On **Day 45** (`~28 December 2026` if started tomorrow), read the scoreboard with zero rationalizations and execute one of two pre-committed branches:

### Branch A — Pull Is Real (Scale Narrowly & Hard)

**Trigger:** Either **`>= 3` unaffiliated businesses** are actively cycling real weekly volume through `Hub 0`, have completed clean withdrawals, and ask to raise caps at paid pricing (`3–5 bps/day` on drawn credit + `8–12 bps` corridor spread), **OR** **`1` proven principal operator** signs binding co-ownership terms bringing a live recurring book onto `Hub 0`.

**Next 60 days if triggered:**
1. Commission the focused external security audit strictly on the active launch surface (`Depository`, `Account`, `DepositoryBounds`, `HankoVerifier`, and swap/pull paths of `DeltaTransformer`—keep `lendbook` and corporate share governance out).
2. Patch [`reader.ts`](../../../core/jurisdiction/adapter/receipt/reader.ts) to sparse `eth_getLogs`-anchored block verification and turn on **`Arbitrum One`** (`<$0.02`, `<2 s` `USDC`/`USDT0` onboarding, `disputeTimeout >= 48h`).
3. Scale `Hub 0` + partner working float from `$25k–$50k` to `$250k–$1M` with automated `USDT0`/CEX skew rebalancing, and ship zero-Solidity **`Builder Codes`** (`100%` integrator fee pass-through inside `RuntimeFrame`) so payout SaaS platforms and OTC bots bring Customers #4–#50.

### Branch B — The Market Shrugs (Close the Monument Cleanly & Redeploy Your Talent)

**Trigger:** You put a live, `<300 ms` mainnet clearing machine + verified Etherscan unilateral exit in front of 25 real OTC/PSP/payout principals, and **fewer than 3 bother funding even `$2k–$5k`**, telling you `USDT0`, `Relay`, `Permit2`, `Fireblocks`, and daily Telegram netting are already good enough.

**Hard rule if triggered — ZERO goalpost-moving:**
Do **not** retreat into *"they'll care once we add Pooled Lending, Solana, Arbitrum, Rust parity, 1,000 TPS, or AI agents."* If 25 target operators don't want non-custodial bilateral credit/netting when it is live on mainnet in front of them for `0` fees, adding six more months of protocol plumbing will not create demand.

**Immediate two-step pivot on Day 46:**
1. **Leave XLN standing as a finished mainnet work, not an abandoned draft:**
   Keep the `MIT`-licensed repository, the verified mainnet `Depository.sol` contracts, the pinned dispute/exit proofs, and a modest self-sustaining `Hub 0` online permanently. Eight years of engineering stand proved, public, and complete—ready if programmable jurisdictions mature later, without eating another year of your life at `MML = 0`.
2. **Move 100% of founder focus the next Monday to a domain where you don't have to beg B2B brokers to switch back-office plumbing:**
   - **Immediate standalone weapon — Ship [`BrainVault`](../../../brainvault/README.md) as a flagship product:** A `603`-line, hardware-accelerated (`2.5 TiB` Apple Silicon Metal/NEON Argon2id + BLAKE3) seedless cold-custody app and airgapped signing workflow. Requires `$0` liquidity float, `0` market makers, `0` watchtowers, and `0` B2B sales cycles—solving a visceral fear for every high-net-worth self-custody holder directly.
   - **Or build a first-party destination market (`Hyperliquid`'s real lesson):** Only start another financial network if it centers on an **exclusive financial instrument or market** end users stampede to trade directly—never generic settlement plumbing sold for basis points.
