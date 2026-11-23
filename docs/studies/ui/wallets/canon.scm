;; canon.scm — repository rules that bind a NEW wallet frontend.
;; Sources: committed AGENTS.md, todo.md, and documents directly under docs/.
;; Where a rule fights the idea of several separate surfaces built from scratch, :binds says so.

;; ── Scope ────────────────────────────────────────────────────────────────

(constraint 'launch-flows
  :source "AGENTS.md"
  :quote "Required launch flows: Pay, same-J Swap, Cross-swap and Lending on EVM and native TRON"
  :binds "The wallets together must offer Pay, same-J Swap, Cross-swap and Lending on EVM and native TRON. A spec with several surfaces must say which surface carries each flow on each chain; it may not leave one out silently. The rule does not require every surface to carry every flow.")

(constraint 'launch-flows-need-owning-tests
  :source "AGENTS.md"
  :quote "as fast browserless financial scenarios plus all owning browser E2E"
  :binds "Each launch flow needs a fast scenario without a browser and its own browser end-to-end test, so every flow a new wallet offers must have both before it counts as launched.")

(constraint 'out-of-launch-scope
  :source "AGENTS.md"
  :quote "Companies/IPO, XLNC, Base, iOS/Electron/extension and custody are outside this launch unless the owner explicitly changes their scope."
  :binds "A new frontend must not include company shares, XLNC, Base, custody, or an iOS, Electron or browser-extension shell, unless the owner explicitly changes the scope. A surface that depends on custody is outside this launch as written.")

(constraint 'scope-is-deliberately-wide
  :source "docs/rejected-ideas.md"
  :quote "The wide scope is deliberate: it buys generality forever."
  :binds "The maintainer has rejected cutting the launch scope (Pay, same-J Swap, Cross-J, Lending, EVM and native TRON), so a wallet cannot be made simpler by dropping one of those flows or chains.")

(constraint 'lending-reopened
  :source "AGENTS.md"
  :quote "Lending reopens the existing signed bank/facility/term-loan/savings product through canonical production admission and both wallets, preserving exact money, authority, deadlines and recovery."
  :binds "Lending is in scope and must appear in the wallets with exact amounts, who holds authority, deadlines and recovery. No oracle liquidation, insurance or cross-J fungible collateral may be invented for it. docs/owner-profile.md (updated 2026-10-15) says the release defers lending; AGENTS.md of 2026-10-18 states that it prevails over older plans in docs/, so the design follows AGENTS.md and flags the disagreement to the maintainer.")

(constraint 'mainnet-open-participation
  :source "AGENTS.md"
  :quote "Mainnet is open to all participants using their own funds: no invite gates, no arbitrary protocol monetary caps; financial and recovery gates stay mandatory."
  :binds "A wallet adds no invitation gate and no money cap of its own invention. Recovery and financial checks that the protocol requires cannot be skipped or hidden by a surface.")

;; ── Two wallets, parity, tests ────────────────────────────────────────────

(constraint 'two-wallets-equal
  :source "AGENTS.md"
  :quote "Svelte `frontend/` at `/app` and React `ui/` at `/ui/` are equally important, actively maintained wallets. Neither is frozen."
  :binds "The repository names two wallets, Svelte at /app and React at /ui/, both maintained and neither frozen. A new design is therefore a design for both, built in both, not a third wallet; a separate new frontend would need the maintainer to change this rule.")

(constraint 'parity-and-owning-tests
  :source "AGENTS.md"
  :quote "Required financial flows must have functional parity and owning tests in both, using the canonical runtime."
  :binds "Every required financial flow must behave the same in the Svelte and React wallets, on the canonical runtime, with an owning test in each.")

(constraint 'never-redirect-or-delete-a-wallet
  :source "AGENTS.md"
  :quote "Never redirect one wallet to the other or delete either wallet as obsolete."
  :binds "Neither existing wallet may be redirected to the other or deleted as obsolete; a new design replacing one of them would need the maintainer to say so first.")

(constraint 'both-frontends-stay
  :source "docs/rejected-ideas.md"
  :quote "Deleting the Svelte frontend"
  :binds "The maintainer has rejected deleting the Svelte frontend; the Svelte wallet stays and must receive the design as the React one does.")

(constraint 'capacity-bar-and-pro-toggle
  :source "todo.md"
  :quote "One capacity bar and a Pro toggle (on by default) in both wallets."
  :binds "The release queue (todo.md, an open item, not a finished rule) asks for one capacity bar and a Pro toggle that is on by default, in both wallets. A design that hides detail should use that toggle instead of inventing its own. On 2026-11-19 the working tree held an uncommitted edit of this line reading 'Everyday wallet by default (zero capacity bars; Pro toggle off by default)'; it is not canon until the maintainer commits it.")

(constraint 'frontend-is-ui-only
  :source "AGENTS.md"
  :quote "`ui`/`frontend` are UI only; runtime owns logic."
  :binds "Frontend code shows and asks; the runtime owns logic, so figures such as balances, capacity and authority come from the runtime and are not computed in the frontend.")

(constraint 'one-path-no-parallel
  :source "AGENTS.md"
  :quote "No legacy behavior, compatibility aliases, fallback readers/writers, duplicate financial formulas, `v2`/`v3` branches or parallel implementations."
  :binds "The frontend carries no copy of a financial formula, no compatibility alias and no fallback reader or writer. A retired path is replaced atomically and deleted. Tension for the maintainer: building a new wallet beside a working one that does the same job is a parallel implementation, yet never-redirect-or-delete-a-wallet forbids deleting the old one.")

(constraint 'no-stubs-in-flows
  :source "AGENTS.md"
  :quote "Never add a stub, test-mode fake, conditional skip, temporary workaround or hidden compromise."
  :binds "A flow either runs on the real runtime or is not offered; no stub, fake, skip or workaround stands in for it.")

;; ── Testnet and real funds ────────────────────────────────────────────────

(constraint 'testnet-disposable-data
  :source "AGENTS.md"
  :quote "XLN is testnet. Obsolete profiles, frames and persisted data are disposable: reject unsupported formats loudly and regenerate from current canonical code."
  :binds "A new wallet reads only the current format, shows a loud refusal for anything older, and keeps no migration or old-format reader.")

(constraint 'testnet-is-not-real-funds
  :source "AGENTS.md"
  :quote "Testnet evidence is not real-funds activation authority."
  :binds "A passing test run is not permission to enable real funds. The wallet enables nothing for real money because tests passed; real-funds signing or transfers need the owner. Whether the interface shows test and real money apart is a design choice, not forced by this rule.")

(constraint 'no-real-funds-before-dispute-fix
  :source "todo.md"
  :quote "Needs an owner decision on the contract fix; no real funds before it lands."
  :binds "While the dispute-replay contract fix is not landed, the release queue says no real funds; the wallet must not invite real funds on a chain where that contract is deployed. The queue changes, so re-read todo.md before relying on this.")

(constraint 'htlc-constants-are-simnet
  :source "todo.md"
  :quote "Decide per-jurisdiction values before any real-funds HTLC on an EVM mainnet"
  :binds "No real-funds hash-locked (routed) payment on an EVM mainnet until per-jurisdiction expiry values are decided. This says nothing about direct payments or about TRON.")

;; ── Consent, credit, collateral, recovery ─────────────────────────────────

(constraint 'credit-is-chosen
  :source "docs/constraints.md"
  :quote "Credit is a policy choice, not a protocol mandate. The parties select risk and backing manually or through soft-limit policy."
  :binds "The wallet cannot extend credit on its own default; the parties choose risk and backing, manually or through a soft-limit policy they set, and the runtime enforces the agreed bounds.")

(constraint 'credit-secured-unsecured
  :source "docs/owner-profile.md"
  :quote "credit limits cap accepted unsecured risk; only collateral-backed entitlement is secured. Signed debt remains disputable but is not guaranteed repayment."
  :binds "Wallet balances must keep collateral-backed (secured) money apart from unsecured credit exposure, and must not say signed debt is guaranteed to be repaid. The source says to keep this distinction in wallet balances.")

(constraint 'show-unsecured-as-receivable
  :source "docs/wallet-journey-plan.md"
  :quote "Show any unsecured remainder as a receivable, with its real enforcement scope."
  :binds "The journey plan (a plan with pending work, not a finished rule) says money owed without collateral behind it is shown as a receivable with its real enforcement scope; the design must show it as owed and say what can actually be enforced.")

(constraint 'recovery-times-shown-apart
  :source "docs/wallet-journey-plan.md"
  :quote "show response window, finalization eligibility and completed recovery separately."
  :binds "The journey plan (pending work) asks that a dispute view show the response window, finalization eligibility and completed recovery as three separate things.")

(constraint 'recovery-coverage-visible
  :source "todo.md"
  :quote "Account-level recovery coverage UI with tower receipt/failure visibility."
  :binds "The release queue lists, as an item gating public launch, an account-level recovery coverage view with tower receipt and failure visibility: whether recovery is covered and whether the watching service accepted or failed its job.")

(constraint 'dispute-does-not-freeze
  :source "docs/owner-profile.md"
  :quote "starting a dispute must not freeze or earmark additional funds."
  :binds "Starting a dispute must not freeze or earmark funds beyond what the account already locks, so the wallet must not describe or perform a dispute start as locking more.")

(constraint 'token-boundary-explicit
  :source "todo.md"
  :quote "Explicit token support boundary: prove multi-token E2E or label the wallet single-token."
  :binds "The release queue lists, as an item gating public launch, proving several tokens end to end or labelling the wallet single-token; each wallet must do one of the two.")

;; ── Words ────────────────────────────────────────────────────────────────

(constraint 'forbidden-synonyms
  :source "docs/glossary.md"
  :quote "Do not use `channel`, `wave`, `round`, `receipt`, `delivery sequence` or `projection` as new names for canonical Runtime/Entity/Account values."
  :binds "These words must not become new names for canonical Runtime, Entity or Account values in wallet code or in this spec. The rule is about naming those values, not about ordinary words in text a person reads.")

;; ── Rejected ideas ───────────────────────────────────────────────────────

(constraint 'rejected-ideas-need-new-evidence
  :source "AGENTS.md"
  :quote "Never re-propose an idea listed in [`docs/rejected-ideas.md`](docs/rejected-ideas.md) without new evidence."
  :binds "Every surface and decision must be checked against docs/rejected-ideas.md; an idea on it needs new evidence written into its decision before it is proposed.")

(constraint 'no-solvency-proofs
  :source "docs/rejected-ideas.md"
  :quote "Cannot prove a withdrawal guarantee. Users rely on collateral in their own Account; the shared hub reserve is visible only as hope."
  :binds "No surface may offer a proof of reserves or solvency of a hub as assurance of withdrawal.")

(constraint 'no-reserve-dashboards
  :source "docs/rejected-ideas.md"
  :quote "Same premise as proof-of-solvency."
  :binds "Live dashboards of hub reserves or exposure used as a selling point are rejected. Showing a hub operator its own figures to run the hub is not covered by this rule.")

;; ── Style and size ───────────────────────────────────────────────────────

(constraint 'size-targets
  :source "AGENTS.md"
  :quote "Size target: functions <30 lines, files <300 lines."
  :binds "Frontend code follows the size target (functions under 30 lines, files under 300), and the check enforces harder limits; no single-use abstraction and none that hides protocol ownership. This binds code, and the design only needs to be buildable that way.")


;; ── Added by the verifier ────────────────────────────────────────────────

(constraint 'viewer-math-is-deriveDelta
  :source "AGENTS.md"
  :quote "never invent alternate `leftCreditLimit`/`rightCreditLimit` viewer math"
  :binds "Per-side figures of an account (what I may spend, what I may be owed) come from deriveDelta(delta, isLeft); a wallet never works out its own left/right credit view.")

(constraint 'relay-is-canonical-transport
  :source "AGENTS.md"
  :quote "Authenticated relay is the canonical user-to-user financial transport when users have no direct hub endpoint"
  :binds "A person without a direct hub endpoint pays another person through the authenticated relay; the wallet presents it as the normal path, not as a fallback or degraded mode.")

(constraint 'destructive-actions-gated
  :source "AGENTS.md"
  :quote "Keep destructive reset/clearDB/dev actions strongly gated."
  :binds "Any reset, clear or developer action in a wallet needs a strong gate, so it cannot sit beside ordinary actions.")

(constraint 'errors-are-shown
  :source "AGENTS.md"
  :quote "Never swallow an error."
  :binds "A failure from the runtime reaches the person with its cause; a screen does not hide it or turn it into an empty state.")

(constraint 'browser-verification-for-frontend
  :source "AGENTS.md"
  :quote "Browser/F12 verification is required only for frontend or browser-runtime changes."
  :binds "Every frontend change is verified in a browser, including the console, before it counts as done.")

;; Added 2026-11-19 by claude-fable-5-2 while recording the user's settlement of d-kernel-how-many.
(constraint 'first-conversations-are-firms
  :source "todo.md"
  :quote "Owner: 10 conversations with OTC/MM/payout firms → at least 2 written intents."
  :binds "The release queue (an open item, not a finished rule) has the maintainer seeking the first written intents from OTC, market-making and payout firms. It says who is being asked first; it does not say which face is built first.")
