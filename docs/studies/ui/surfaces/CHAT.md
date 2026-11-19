# Design Room Dialogue (`CHAT.md`)

Append-only cross-examination log (opened **only in Round 2** after all cold `perspectives/*.scm` files pass `check.ts --perspective`).

## Rules
1. **No pure prose turns:** Every entry must link a checked `.scm` file (`perspectives/*.scm` or `rounds/r2-*.scm`) or an executed probe output under `probes/` / `custdev-r1/`.
2. **Keep entries `<= 15` lines:** Address exact symbol IDs (`'kernel-consent`, `'otc-deal-room`, `'f0-toggle-vs-surfaces`) and state concrete failure cases or fork deltas.
3. **Never edit earlier entries:** Re-read the tail of `CHAT.md` immediately before appending the next sequential `D<NNN>` ID.

---

### D001 — Round 1 Complete: Four Validated Perspectives (`2026-11-19`)
- Verified via `check.ts --perspective`: [`perspectives/p1-consumer.scm`](./perspectives/p1-consumer.scm) (`grok-4.7`, `264` lines), [`perspectives/p2-sovereign.scm`](./perspectives/p2-sovereign.scm) (`claude-fable-5-2`, `261` lines), [`perspectives/p3-commercial.scm`](./perspectives/p3-commercial.scm) (`grok-4.7`, `482` lines), [`perspectives/p4-steward-redteam.scm`](./perspectives/p4-steward-redteam.scm) (`gemini`, `456` lines).
- Consensus across all 4: zero silent `10,000 USDC` credit on `openAccount` (`hosted.ts:280`), explicit wallet-drawn signing consent before `sendEntityTxs`, and unilateral exit (`'unilateral-exit` / `'finalize-dispute`) permanently owned by the Kernel.
- Central open fork (`'home-number-vs-one-bar` / `'f-p2-shell` / `'p3-desk-vs-toggle` / `'f-p4-toggle-vs-kernel-firewall`): `todo.md`'s 1-bar + on-by-default Pro toggle inside existing shells vs. shrinking React+Svelte to a minimal Kernel + XLN Programs.

### D002 — Round 2 Empirical Sweep (`63` Blind Runs, Frontier + Fast): Signing-Sheet Synthesis (`2026-11-19`)
- Evidence: [`probes/report-signing.md`](./probes/report-signing.md) and [`rounds/r2-signing-critique.scm`](./rounds/r2-signing-critique.scm) (`grok-4.7`, `claude-flagship`, `gemini-pro`, `grok-4.6`, `grok-4.7-build-fast`, `claude-haiku`, `gemini-flash-lite`; zero OpenRouter).
- `'kernel-intent-firewall` (`p4`) eliminated: static warnings caused `5/7` false rejections (including `grok-4.7` & `gemini-pro`) on legitimate `25.00 USDC` checkout (`C5`).
- `'kernel-sheet` (`p1`) Q4 spend bug: static `"locked amount can still be claimed"` misled `grok-4.7` & `claude-flagship` on `C6` into thinking spent `25.05 USDC` coffee money stays claimable.
- `'sheet-spend` (`p2`) verb-dispatch leak fixed: `'instant-swap` (`-1,000` locked -> `+1,005` unbacked, `deltaCreditLimit = 0`) fooled `2/3` skimmers (`C3`) under verb routing, vs `7/7 REJECT` (`C4`) under `deriveDelta` risk-class routing + `7/7 APPROVE` on `C7`.

### D003 — Round 3 Convergence + Grok `/design` Audit & Contract Correction (`2026-11-19`)
- Converged spec verified (`9/9` tests): [`personal.scm`](./personal.scm), [`programs.scm`](./programs.scm), [`forks.scm`](./forks.scm) (`'f8-signing-sheet-dispatch` closed by `sweep`; `'f9-monolith-vs-kernel-programs` open), and [`surfaces.generated.ts`](./surfaces.generated.ts).
- Grok 4.7 `/design` (`4700000d-0000-4000-8000-00000000000d`) produced [`design-synthesis.md`](./design-synthesis.md) (`666` lines) + [`design-review.md`](./design-review.md): mapped shared `@xln/frontend` (`frontend/src/lib/signing/`), closed `EntityTx` projector table, `htlcPayment` `maxSenderDebit - amount` headroom, and all React+Svelte submit choke points (`submitActiveRuntimeInput`, `submitActiveCrossJurisdictionIntent`, `UserModePanel.svelte` onboarding mount).
- Independent `Depository.sol` audit corrected 1 false review claim on `'sheet-secure` (`requestCollateral`): once the hub's `R->C` batch confirms, `Depository.sol:1018,1025` (`_increaseReserve`) **does** pay locked collateral to the creditor on unilateral exit; the real gap vs `r2c` is temporal (`request-collateral.ts:8-15` debits fee immediately before the hub locks).


### D004 — Root-Cause Correction: DSL v3 `human-everyday` + `autopilot` (`everyday.scm`) (`2026-11-19`)
- Audits: [`perspectives/p5-openai-astra.scm`](./perspectives/p5-openai-astra.scm) and [`rounds/r3-astra-audit.scm`](./rounds/r3-astra-audit.scm) (`gpt-6.2-astra` via Nous OAuth, `13` code-cited critiques on TOCTOU recheck, peer-authored `c2r`, 2-hub cross-J, decisive Hanko `vote`, and `j_broadcast`).
- Maintainer product correction: Rounds 1–3 drifted back into channel-inspector POV (`:bars`, storage buckets, `Cover it`, MetaMask popup sheets) because `base.scm`, `dsl.ts`, `check.ts` Law 9, and `BRIEF.md`/`todo.md:82` made invisible background automation illegal and forced every `EntityTx` into user-facing UI.
- Upgraded to DSL v3 ([`dsl.ts`](./dsl.ts), [`check.ts`](./check.ts), [`everyday.scm`](./everyday.scm), [`forks.scm`](./forks.scm) `'f10-everyday-autopilot-vs-bucket-bars`, `10/10` tests): `:posture 'human-everyday` mechanically bans `:bars`, plumbing jargon, and manual plumbing buttons.
- `'everyday` models Venmo + Splitwise + hidden reliability: `'everyday-cash` (`Cash`), `'friends-tabs` (`Friends & tabs`), `'savings-balance` (`Savings`), `:delivery 'inline-quiet` (`'everyday-inline-action`), and 3 `(autopilot ...)` policies (`'auto-settle-incoming`, `'auto-route-funds`, `'auto-recovery-shield`).
