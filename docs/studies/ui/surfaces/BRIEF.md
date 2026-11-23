# Design Room Brief: Human Everyday Wallet (Venmo + Splitwise), Autopilot & XLN Programs (`2026-11-19`)

## 1. Primary Product North Star (Regular People First)

For a regular person, XLN must feel **as effortless, calm, and reliable as Venmo + Splitwise** — **not** an inspection panel for bilateral accounting:

1. **One `Cash` balance (`Venmo`), separate `Friends & tabs` (`Splitwise`), opt-in `Savings`:**
   - Regular people never stare at 4 storage buckets (`Backed by collateral`, `Without collateral`, `Blockchain wallet`, `Contract reserve`), `[---===|---]` capacity bars, or manual `[Cover it]` buttons.
   - Everyone naturally understands **"Cash: \$200"** vs **"Alex owes you \$40"** in Splitwise without a single word of crypto or finance legalese.
2. **Reliability Through Invisible `(autopilot ...)`, Not Warning Lectures:**
   - Opening the app grants **\$0** silent hub credit.
   - Incoming hub transit float is **automatically settled into protected on-chain Cash** in the background under a tiny built-in fee cap (`auto-settle-incoming`).
   - Bucket routing (`e2r`/`r2c`/`r2e`) and stalled-provider recovery (`prepareDispute`/`disputeFinalize` + encrypted backup) run **automatically under the hood** (`auto-route-funds`, `auto-recovery-shield`), surfacing calm status only if needed.
3. **Zero MetaMask Popup Theater on First-Party Actions:**
   - Tapping `Pay` or `Split a bill` inside the wallet uses `:delivery 'inline-quiet` (showing recipient and fee inline on the button, zero second confirmation modal).
   - Interrupt confirmation sheets (`:delivery 'interrupt-sheet`) appear **only** when crossing an external app/link boundary or explicitly taking on operator/credit risk.
4. **Operator / OTC / Steward Tools Stay Out of Everyday Sight:**
   - Dense multi-account lane tables (`Desk`), orderbooks, manual reserve pipes (`Move`), hub rate cards, and Hanko boards live in the **`Pro` operator surface** (`pro.scm`) and **XLN Programs** (`programs.scm`), **off by default** for regular users.

---

## 2. Mechanical Compiler Laws (`dsl.ts` + `check.ts`, DSL v3)

- `:posture 'human-everyday` (`everyday.scm`) is mechanically checked by `check.ts`:
  - **Bans `:bars`** on every everyday screen.
  - **Bans plumbing/protocol jargon** (`collateral`, `unbacked`, `counterparty`, `credit limit`, `credit ceiling`, `reserve`, `depository`, `htlc`, `hanko`, `co-signed`, `frame`, `lane`, `watchtower`) in all user-facing copy.
  - **Bans manual plumbing buttons** (`request-cover`, `rebalance-policy`, `move-r2c`, `set-hub-credit`, etc.), requiring them to be absorbed by `(autopilot ...)` or doored to `pro`.
- Historical Round-0/Round-1 bucketed baselines (`personal.scm`, `perspectives/p1..p5.scm`) remain preserved under `:posture 'legacy-bucket-baseline` so earlier empirical sweeps (`custdev-r1`, `probes/report-signing.md`) remain reproducible.
