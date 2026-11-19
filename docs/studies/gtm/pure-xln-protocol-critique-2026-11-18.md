# Pure XLN Protocol: What Survives First-Principles Scrutiny

- **Date:** `2026-11-18`
- **Written against:** `xln` @ `00c9bc5` (`6,409` lines across `jurisdictions/contracts/*.sol`, `5,823` commits) and companion prototype `@inhuman.tools/desk` @ `1245794`
- **Status:** Unvarnished technical critique of the pure protocol. Not owner canon.
- **Author (added 2026-11-19):** not recorded in the file.
- **Stale base (added 2026-11-19):** `00c9bc5` was 12 commits behind `origin/main` (`bdc53c7b`); see the tree-status note in [`technical-findings-2026-11-18.md`](../../technical-findings-2026-11-18.md), written against the same commit. Contract line numbers below were not re-read on the new base.
- **Related (added 2026-11-19):** reserve enforcement and debt rows in [`chat.md`](./chat.md) D027 · shared-Depository freeze risk in D028 §3 · dispute as a "nuclear switch" in [`p2p-desk-review-grok-4.6.md`](./p2p-desk-review-grok-4.6.md) · filed in [`chat.md`](./chat.md) D032.

---

## 1. The Squeeze From Both Degenerate Ends (`L = 0` and `C = 0`)

XLN's core equation (`RCPAN` in [`docs/core/12_invariant.md`](../../core/12_invariant.md), `−Lₗ ≤ Δ ≤ C + Lᵣ`) unifies collateral (`C`) and credit (`L`) on one canonical coordinate `Δ = ondelta + offdelta`. Mathematically, it is cleaner than every state-channel design that came out of 2017–2021.

Yet `5,823` commits later, unaffiliated volume is zero (`MML = 0`). Looking only at marketing or sales misses the **protocol-level squeeze** acting on the two boundary cases of `RCPAN`:

1. **At the `L = 0` boundary (pure collateral, low-to-medium frequency):**
   On `$0.005`, `250 ms` shared-state EVM chains (`Base`, `Arbitrum`), atomic settlement (`Permit2`, RFQ, or lazy `CREATE2` escrow vaults) requires **zero pre-locked channel inventory, zero watchtower liveness, and zero unaudited singleton risk**. Bilateral channels lose to shared state at `L = 0` unless velocity is high enough (`100+` fills/day between the *same* pair), privacy of the commercial graph is mandatory, or the two legs live on **disjoint state machines** (`EVM ↔ Native TRON`) where no shared atomic transaction exists.
2. **At the `C = 0` boundary (pure credit, low-to-medium frequency):**
   If two OTC desks trust each other for `$50,000` intraday (`C = 0, L = 50,000`), they do not need `6,409` lines of `Depository.sol` + `Account.sol` + two `Runtime` daemons merely to hold a non-repudiable signed balance. A `150`-line EIP-712 bilateral statement (`StolCheckpoint`) signed from `Rabby` or `Ledger` gives the exact same cryptographic proof of what was owed—**because, as §2 proves below, `Depository.sol` cannot actually force a strategic defaulter to pay unsecured `L` on-chain anyway.**

**Consequence:** Pure XLN is **only** irreplaceable in the **interior region** where shared state and simple off-chain receipts both fail:
- **Mixed partial-collateral swing lines (`C > 0` AND `L > 0`):** e.g., `$200k` enforceable first-loss collateral + `$300k` intraday credit swinging back and forth 50 times a day, where `C` can be seized unilaterally without counterparty cooperation.
- **Native cross-jurisdiction (`EVM ↔ TRON`) sub-second clearing** between recurring liquidity peers without minting wrapped bridge IOUs or paying per-fill solver spreads.
- **Commercial-graph privacy** where publishing every gross fill, counterparty address, and size on Etherscan/Tronscan leaks alpha or invites targeting.

---

## 2. The `disputeTimeout` Reserve-Evacuation Theorem (Why `_settleShortfall` Only Catches Crashes, Not Strategic Default)

Inspect [`Depository.sol:1037-1060`](../../../jurisdictions/contracts/Depository.sol) alongside [`Account.sol:1786-1790`](../../../jurisdictions/contracts/Account.sol) and [`docs/owner-profile.md:125-127`](../../owner-profile.md):

1. When cooperation breaks on an under-collateralized account (`Δ > collateral`), the creditor calls `disputeStart` at `t = 0`.
2. By a necessary anti-DoS rule (`owner-profile.md:125-127`), **`disputeStart` does NOT freeze or earmark the debtor's free `_reserves`** in `Depository.sol` (otherwise any counterparty holding an old proof could freeze a Hub's entire bank reserve on demand).
3. `disputeFinalize`—which runs `_settleShortfall` (`Depository.sol:1047`) to sweep `_spendableReserve(debtor, tokenId)` and record `_addDebt`—cannot execute until `timeout = startTimestamp + leftResponseSeconds + rightResponseSeconds` (`Account.sol:1789`, typically hours to days).
4. During that entire `disputeTimeout` window, **a strategic defaulter simply calls `_reserveToExternalToken` (`Depository.sol:713`) and withdraws `100%` of its free `_reserves` to a fresh wallet**, then generates a new `bytes32` Entity keypair (`$0` Sybil cost on an open permissionless chain) and never routes inflows through the indebted `bytes32` ID again.

**What this means in plain English:**
- On sovereign Fedwire, `J/E/A` debt enforcement works because JPMorgan cannot `Ctrl+N` a new legal identity during a 24-hour dispute window to shed `$50M` of debt while keeping its banking charter.
- On an open permissionless chain, `_settleShortfall` + `DebtCreated` (`Depository.sol:1047-1060`) **only ever collects money in two narrow cases**:
  1. **Honest operator crash / key loss:** A Hub's servers die; its unspent `_reserves` sit idle on `Depository.sol` past `disputeTimeout` and automatically pay out claimants.
  2. **Locked collateral in other slow-closing channels** of the same Hub that happens to settle back into `_reserves[hub]` *after* `disputeFinalize`—provided the Hub did not already collude to close or redirect them.
- Against a **conscious, strategic default**, unsecured `L` in XLN has **zero self-executing on-chain collection power**. Its real product value is **cryptographic non-repudiation** (`DisputeFinalized` / `DebtCreated` proving that `debtor` signed `offdelta` at `nonce`) for **off-chain reputation networks or real-world legal contracts**. Over-engineering on-chain FIFO debt queues (`Uint512`, forgiveness arrays, `enforceDebts` chunking) as if on-chain garnish were the primary credit-enforcement mechanism mistakes crash-recovery plumbing for credit enforcement.

---

## 3. Four Places Where XLN's Current Architecture Fights Itself

### 3.1 The Pooling Contradiction: Shared `Depository.sol` Freeze Risk vs. Multi-Account Rebalancing

There is a hard tension in [`Depository.sol`](../../../jurisdictions/contracts/Depository.sol) that cannot be hand-waved away:

- **If everyone shares one singleton `Depository.sol` per chain:** Every deposit (`Depository.sol:697`) and withdrawal (`Depository.sol:727`) touches `address(depository)`. Tether (`USDT`) and Circle (`USDC`) blacklist **contract addresses**, not internal `bytes32 entity` slots. Because deposits are permissionless ("no invite gates"), one adversary depositing sanctioned `USDT` into `Depository.sol` creates a shared freeze tail-risk across every innocent operator's collateral—violating [`10_UFT.md`](../../core/10_UFT.md)'s promise of independent local fate. Plus, on TRON, `Depository.sol` withdrawals are internal contract transfers that CEXs (`Bybit`, `Binance`) refuse to auto-credit.
- **If you isolate collateral into per-pair `CREATE2` vaults:** You eliminate shared `USDT` freeze contagion completely, **but you give up internal `_reserveToReserve` / `C2R` / `R2C` rebalancing across a Hub's multiple accounts and crash-recovery `_settleShortfall` across accounts.**

**Resolution:** One global permissionless `Depository` for `USDT` is unsafe for institutional desks, and pure per-pair vaults sacrifice Hub rebalancing. The coherent middle point—which XLN's code *almost* supports because `(chainId, depositoryAddress)` already defines a `Jurisdiction`—is **per-Hub / per-clearing-club `Depository` deployments** with depositor admission at the intake perimeter, linked to other hubs via cross-J `HashLadder` swaps, paired with native `2-of-3` clearing accounts on TRON where top-level `USDT.transfer` is required by CEXs.

### 3.2 Monolithic `Account` Dispute ("Nuclear Switch") vs. Clause Carve-Out

In [`Account.sol:1784-1820`](../../../jurisdictions/contracts/Account.sol), disputing a single `$500` stuck `HTLC` or `Pull` clause sets `_accounts[acct_key].disputeHash` on the entire `(leftEntity, rightEntity)` `Account`, halting frames and destroying a `$500,000` standing line for `leftResponseSeconds + rightResponseSeconds`.

Real clearinghouses (`ISDA`, prime brokers) never terminate a master agreement over one contested trade. XLN needs a **cooperative `carveOut` transition**: when clause `k` (bounded by collateral `c_k`) stalls because an external secret/hop failed while the two peers themselves are still online and cooperative, frame `N + 1` spins `(clause_k, c_k)` out into an isolated `DisputedClause` record on `J`, reduces `Account.collateral` by `c_k`, and lets the standing `Account` continue at frame `N + 1` without interruption. Full `Account` dispute stays strictly for total peer unresponsiveness.

### 3.3 `2,225` Lines of `EntityProvider` + `Hanko` in the Custody TCB, and the `grace on` / `grace off` Trap

`EntityProvider.sol` (`1,212` LOC) + `HankoVerifier/Codec/Encoding` (`1,013` LOC) make up **`34.7%` of the Solidity TCB** (`2,225 / 6,409` lines), force counterparties away from standard `EOA`/hardware wallets, and create cross-layer consensus hazards (`PROPOSAL_COUNTERPARTY_BOARD_ACTIVATION_MIXED`, [`consensus-invariants.md:119-156`](../../consensus-invariants.md)).

Crucially, [`Account.sol:1760-1783`](../../../jurisdictions/contracts/Account.sol) reveals a genuine cryptographic trap caused by mutating `Entity` signers globally outside the `Account`:
- **`grace off` (why naive `EIP-1271` `Safe.isValidSignature` also fails!):** If `J` checks signatures only against an Entity's *current* live signers, rotating a `Safe`'s owners on-chain instantaneously invalidates every previously signed off-chain `AccountFrame`—free unilateral debt repudiation!
- **`grace on` (XLN's current 7-day retired-board rule):** Prevents instant repudiation, **but lets a fired/compromised ex-board collude with one counterparty within 7 days to sign `nonce = MAX`**, denying the honest Entity any higher-nonce counter-proof!

**The clean fix (`Epoch-Pinned Account Signers`):** Pin `(keyEpoch, leftSigner, rightSigner)` directly on each `Account` in `J`.
- Cooperative rotation updates `leftSigner` and increments `keyEpoch` atomically inside `AccountSettlement`.
- Unilateral rotation opens a bounded window where `oldSigner` can **only** authenticate proofs with `proof.keyEpoch == k`, never `k + 1`, and `keyEpoch = k + 1` starts cleanly from the post-window settled `Δ`.
Both instant repudiation (`grace off`) and retired-quorum `nonce = MAX` lockout (`grace on`) disappear—along with `2,225` lines of corporate board/shareholder Solidity inside the custody kernel.

### 3.4 Designing for 2050 Sovereign Corporations While Blocking 2026 Counterparty #1

`Uint512` / `Int768` (`2^200` money domains), tradable `EntityProvider` corporate shares/dividends, dual TS + Rust engines before mainnet Transaction #1, and mandatory dual `Runtime` daemons are **2050 completeness** paid for in **2026 trust and friction**:

1. **Auditability:** Nobody puts `$250k` of real principal into `6,409` lines of `UNLICENSED`, unaudited Solidity when the irreducible `RCPAN` + epoch-signer + `HTLC`/`HashLadder`/`Swap` + clause-carve-out kernel fits in **`<900` lines** (`Morpho Blue` scale).
2. **Zero-daemon entry cadence:** `AccountFrame` transitions are pure math. Counterparty #2 at 10 trades/day should be able to co-sign `AccountFrame` diffs asynchronously from a browser + `Ledger`/`Rabby` (with long `responseSeconds` or a delegated watchtower), and graduate to running a 24/7 `RuntimeReplica` daemon only when trade velocity exceeds human clicking.
3. **Executable policy belongs in `E`, not `J`:** Keeping `J` tiny and pairing `E`'s pre-signing gate with an inspectable executable policy sheet (like Arrival in `desk`) gives operators full programmability over KYT, FX headroom, and counterparty rules with zero `J` gas and zero consensus-fork risk.
