# Custdev-Everyday Baseline Report (tag=baseline · spec=baseline)

- **Generated from baseline run:** `2026-11-19T00:51:40.028Z`
- **Frozen spec snapshot:** `docs/studies/ui/custdev-everyday/baseline-surface-snapshot.json` (`capturedAt: 2026-11-18T23:38:00Z`)
- **Verified source artifacts:** `runs/baseline/summary.json`, `runs/baseline/phantoms.json`, `runs/baseline/postmortems.md`, and `110` episode traces in `runs/baseline/episodes/*.json`

---

## 1. Overall Metrics & Per-Model Completion

- **Episodes passed:** **70/110** (state passed: **79/110**, comprehension passed: **81/110**)
- **Total phantoms:** **197** across **14** cross-model patterns (`>= 2` distinct model lineages)
- **Transport errors:** **0/110** (0 Hermes, 0 Claude CLI, 0 Grok CLI transport failures)
- **Phase 7 post-mortems recorded:** **88/110** episodes (`runs/baseline/postmortems.md`)
- **Phantom categories:** `unknown_action=5`, `validation=20`, `eval=77`, `parse=63`, `runtime=31`, `timeout=1`

| Model | Lineage | Pass | State | Comp | Avg Turns | Phantoms | unknown_action | validation | eval | parse | runtime | timeout | TransportErr |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `anthropic/claude-fable-5.2` | `anthropic-claude-fable-5.2` | 9/10 | 9/10 | 9/10 | 9.3 | 8 | 1 | 2 | 3 | 0 | 2 | 0 | 0 |
| `claude-haiku` | `anthropic-claude-haiku` | 2/10 | 3/10 | 4/10 | 5.6 | 9 | 0 | 1 | 6 | 0 | 2 | 0 | 0 |
| `claude-sonnet` | `anthropic-claude-sonnet` | 6/10 | 7/10 | 7/10 | 7.2 | 22 | 1 | 0 | 11 | 6 | 4 | 0 | 0 |
| `google/gemini-2.5-flash` | `google-gemini-2.5-flash` | 6/10 | 6/10 | 7/10 | 6 | 22 | 1 | 2 | 16 | 1 | 2 | 0 | 0 |
| `google/gemini-2.5-pro` | `google-gemini-2.5-pro` | 9/10 | 9/10 | 9/10 | 6.8 | 15 | 0 | 3 | 8 | 0 | 4 | 0 | 0 |
| `google/gemini-3.1-flash-lite-preview` | `google-gemini-3.1-flash-lite` | 7/10 | 8/10 | 8/10 | 6.6 | 15 | 0 | 3 | 5 | 4 | 3 | 0 | 0 |
| `grok-4.7-build-fast` | `xai-grok-4.7-build-fast` | 6/10 | 7/10 | 8/10 | 6.3 | 9 | 0 | 0 | 6 | 0 | 2 | 1 | 0 |
| `grok-4.7` | `xai-grok-4.7` | 6/10 | 7/10 | 8/10 | 7.4 | 15 | 0 | 1 | 11 | 0 | 3 | 0 | 0 |
| `meta-llama/llama-4-scout` | `meta-llama-4` | 3/10 | 5/10 | 5/10 | 9.2 | 63 | 2 | 5 | 5 | 49 | 2 | 0 | 0 |
| `openai/gpt-6.2-astra` | `openai-gpt-6.2` | 8/10 | 9/10 | 8/10 | 4.7 | 4 | 0 | 1 | 1 | 0 | 2 | 0 | 0 |
| `qwen/qwen3.7-flash` | `qwen-3.7` | 8/10 | 9/10 | 8/10 | 8.3 | 15 | 0 | 2 | 5 | 3 | 5 | 0 | 0 |

---

## 2. Per-Episode Completion

| Scenario | Pass | State | Comp | Phantoms | Breakdown |
|---|---:|---:|---:|---:|---|
| `E1a_pay_across_buckets` | 11/11 | 11/11 | 11/11 | 15 | `eval:9, parse:5, runtime:1` |
| `E1b_pay_fee_above_cap` | 7/11 | 11/11 | 7/11 | 17 | `eval:4, parse:7, runtime:6` |
| `E1c_pay_l1_reject_reload` | 5/11 | 5/11 | 11/11 | 19 | `parse:5, runtime:14` |
| `E2_friends_split_and_settle` | 5/11 | 5/11 | 5/11 | 27 | `validation:10, eval:6, parse:10, timeout:1` |
| `E3a_newcomer_arriving_and_request` | 0/11 | 0/11 | 3/11 | 12 | `unknown_action:4, validation:3, eval:1, parse:4` |
| `E3b_offline_hub_keeps_arriving` | 7/11 | 11/11 | 7/11 | 11 | `parse:10, runtime:1` |
| `E4_savings_optin_consent` | 9/11 | 9/11 | 10/11 | 27 | `unknown_action:1, validation:1, eval:8, parse:8, runtime:9` |
| `E5a_external_checkout_approve` | 9/11 | 9/11 | 9/11 | 32 | `eval:29, parse:3` |
| `E5b_external_bait_reject` | 9/11 | 9/11 | 10/11 | 29 | `validation:6, eval:18, parse:5` |
| `E6_offline_recovery_zero_gas` | 8/11 | 9/11 | 8/11 | 8 | `eval:2, parse:6` |

- **Perfect completion:** `E1a_pay_across_buckets` (`11/11`).
- **Hard failure:** `E3a_newcomer_arriving_and_request` (`0/11` passed, `0/11` statePassed) because `request-link` is absent from the baseline `everyday.scm` surface.
- **High-friction partial passes:** `E1c_pay_l1_reject_reload` (`5/11`), `E2_friends_split_and_settle` (`5/11`), `E1b_pay_fee_above_cap` (`7/11`), `E3b_offline_hub_keeps_arriving` (`7/11`), and `E6_offline_recovery_zero_gas` (`8/11`).

---

## 3. Phantom Counts by Error Type & Top Cross-Model Patterns

| Category | Count | Share of 197 | Primary Drivers |
|---|---:|---:|---|
| `eval` | 77 | 39.1% | Unimplemented `(screen 'external-request)` / `'requests` / `'pending-requests` / `'savings` calls (`47` screen-call `eval` phantoms; `49` including `(help screen)` / `(help 'screen)`), `(help ...)` arity/unbound errors (`14x`), unbound Scheme guesses (`quote-payment`, `cost`, `action`, `requests`) |
| `parse` | 63 | 32.0% | `text-reply` (`32x`: `meta-llama-4` `28x`, `qwen-3.7` `3x`, `google-gemini-2.5-flash` `1x`), `21` truncated/unterminated Scheme s-exprs from `meta-llama/llama-4-scout` (`49/63` total `parse` phantoms including Llama's `28` `text-reply`), trailing-quote forms (`10x` across `2` lineages, led by `(screen 'activity')` `3x`) |
| `runtime` | 31 | 15.7% | `pay` (`22x` across all `11` lineages: `14x` inherent `E1c` L1-sweep rejections across `11` lineages + `8x` pre-quote-preventable across `6` lineages: `6x` `E1b` fee-cap + `2x` insufficient cash in `E1a`/`E3b`), calling `add-savings` without `accept_risk: true` (`9x` across `9` lineages) |
| `validation` | 20 | 10.2% | Guessing arg shapes for `split-bill` (`10x` across `8` lineages), `reject-request` (`6x` across `2` lineages), `settle-up` (`2x` across `2` lineages), `pay` (`1x`), `add-savings` (`1x`) |
| `unknown_action` | 5 | 2.5% | `E3a` missing `request-link` (`request-payment` `2x`, `request` `1x`, `create-request` `1x`) and `E4` `accept-risk` (`1x`) |
| `timeout` | 1 | 0.5% | `E2_friends_split_and_settle` — `grok-4.7-build-fast` (`TIMEOUT after 90000ms`) |

### All 14 Cross-Model Patterns (`>= 2` Lineages in `runs/baseline/phantoms.json`)

| Count | Lineages | Category | Action / Expr | Sample Error |
|---:|---:|---|---|---|
| 32 | 3 | `parse` | `text-reply` | `Expected a structured tool call (discover, act, or done), got plain text.` |
| 23 | 8 | `eval` | `(screen 'external-request)` | `Unknown screen 'external-request'. Available screens: home, people, earn, activity, external-request, settings` |
| 22 | 11 | `runtime` | `pay` | `Insufficient Cash ($54.95) for $65.05.` |
| 10 | 8 | `validation` | `split-bill` | `split-bill requires { person: string, total_usd: positive number }.` |
| 9 | 9 | `runtime` | `add-savings` | `Savings require explicit consent (accept_risk: true): Savings are lent to earn interest and are not protected like Cash.` |
| 6 | 2 | `validation` | `reject-request` | `Requires { request_id: string }.` |
| 4 | 4 | `eval` | `(screen 'requests)` | `Unknown screen 'requests'. Available screens: home, people, earn, activity, external-request, settings` |
| 4 | 3 | `eval` | `(screen 'pending-requests)` | `Unknown screen 'pending-requests'. Available screens: home, people, earn, activity, external-request, settings` |
| 3 | 3 | `eval` | `(screen 'savings)` | `Unknown screen 'savings'. Available screens: home, people, earn, activity, external-request, settings` |
| 3 | 2 | `parse` | `(screen 'activity')` | `Parse Error: expecting datum after ''' at 1:17` |
| 2 | 2 | `validation` | `settle-up` | `settle-up requires { person: string }.` |
| 2 | 2 | `eval` | `(help 'split-bill)` | `help: arguments rejected — 1 problem(s): args — Too big: expected array to have <=0 items` |
| 2 | 2 | `unknown_action` | `request-payment` | `Unknown action 'request-payment'. Available actions: pay, cash-out, split-bill, settle-up, ...` |
| 2 | 2 | `eval` | `(screen 'pending)` | `Unknown screen 'pending'. Available screens: home, people, earn, activity, external-request, settings` |

---

## 4. Top Cross-Model Phantoms & Phase 7 Post-Mortem Insights

1. **Broken `(screen ...)` navigation & advertised ghost screen (`55` `(screen ...)` phantoms = `47` `eval` + `8` trailing-quote `parse`; `57` with `+2` help-on-screen `eval`s; `60` with `+3` truncated `parse::(screen`):**
   - **`47` `eval` screen-call phantoms:** `23x` across `8` lineages on `(screen 'external-request)`, `4x` `(screen 'requests)`, `4x` `(screen 'pending-requests)`, `3x` `(screen 'savings)` (`3` lineages), `3x` `(screen)` (`1` lineage), `2x` `(screen 'pending)`, `2x` `(screen "external-request")`, and `6x` singletons (`(screen 'request)`, `(screen external-request)`, `(screen 'current)`, `(screen home)`, `(screen "settle-up")`, `(list (screen 'savings) (actions))`).
   - **`8` trailing-quote `parse` phantoms:** `3x` `(screen 'activity')` (`2` lineages), `2x` `(screen 'external-request')` (`1` lineage), and `3x` singletons (`(screen 'savings')`, `(screen 'pending-request')`, `(screen 'home')`). (Plus `2x` `eval` `(help screen)` / `(help 'screen)` and `3x` truncated `parse::(screen`.)
   - **Root cause:** `engine/discovery.ts` (`renderScreen`) throws `Available screens: home, people, earn, activity, external-request, settings`, advertising `'external-request'` as a valid screen when `everyday.scm` only declares `home`, `people`, `earn`, and `activity`. Meanwhile `(pending-requests)` is the real discovery primitive.
   - **Post-mortem evidence (`E5a` `claude-haiku`, `postmortems.md:2070`):** *"You had `external-request` in the available screens list, but it doesn't exist as a callable screen. The system lists it but won't accept it. That's a lie in the UI contract."*
   - **Secondary naming split:** `3x` `(screen 'savings)` across `3` lineages (plus `1x` parse and `1x` compound) hit `Unknown screen 'savings'` because the tab id is `earn` while the term/figure/function is `Savings` / `(savings)`.

2. **`E3a_newcomer_arriving_and_request` 0/11 hard surface gap (`request-link` & `arriving-cash`):**
   - **Root cause:** `baseline-surface-snapshot.json` (`everyday.scm`) declares `home` with purpose *"See your Cash, pay anyone, or request money in one tap."* yet omits any `request-link` flow from `home.actions` and `flows`, and omits a dedicated `arriving-cash` figure separating incoming transit float from `everyday-cash`.
   - **Model failures (`0/11` pass):** Models guessed `request-payment` (`2x`, `2` lineages), `request` (`1x`), `create-request` (`1x`), `split-bill` (`2x`, `2` lineages: `google/gemini-2.5-pro` & `google/gemini-3.1-flash-lite-preview`), `pay` (`1x`), and `google/gemini-2.5-pro` tried `(quote-pay "Maya" -25)` which misleadingly returned `'can-complete': true` before `act("pay", { amount_usd: -25 })` failed validation.
   - **Post-mortem evidence (`E3a` `claude-sonnet`, `postmortems.md:1276, 1282`):** *"The interface lied to me about what actions existed... the actual action was `request-link`, which was never shown in the actions list."* And `google/gemini-2.5-pro` (`postmortems.md:1348`): *"The `(quote-pay "Maya" -25)` command even returned a successful-looking quote, which strongly suggested this was the correct path."*

3. **Savings consent & 3-way naming mismatch (`E4`, `9/11` runtime phantoms):**
   - `9/11` lineages hit `runtime::add-savings` (`Savings require explicit consent (accept_risk: true)`) on their first `add-savings` call because `(savings)` and `(screen 'earn)` in baseline mode showed only `"Earning interest separately from your Cash."` without surfacing the risk disclosure or `accept_risk: true` requirement upfront.
   - **Post-mortem evidence (`E4` `openai/gpt-6.2-astra`, `postmortems.md:2017-2018`):** *"Savings was named three ways. The task said 'Savings,' the screen was `earn`, and the direct lookup was `(savings)`... 'Accept terms' suggested `accept_terms: true`, but `add-savings` required `accept_risk: true`."*

4. **Action parameter opacity & missing `(help '<verb>)` / `(actions)` schemas (`E2` `5/11`, `E1a`/`E1b`/`E1c` `22x` `runtime::pay`):**
   - Across `runtime::pay` (`22x` across all `11/11` lineages), `14x` across `11/11` lineages were inherent `E1c` L1-sweep rejections (`Auto-route L1 sweep rejected — your Cash was not touched.`), while `8x` across `6` lineages (`6x` `E1b` fee-cap + `2x` insufficient cash in `E1a`/`E3b`) occurred when models called `pay` without first checking `(quote-pay ...)` because `(actions)` returned bare verb names (`["pay", "cash-out", ...]`) without argument shapes or quote pointers, and `(help)` only accepted 0 arguments (`15x` `(help ...)` phantoms total: `13x` 0-arg arity + `1x` `(help pay)` unbound `eval` + `1x` `(help 'pay')` `parse`, e.g. `(help 'split-bill)` `2x` across `2` lineages, `(help 'pay)` `2x`).
   - In `E2_friends_split_and_settle` (`5/11` pass), `8` lineages hit `8x` `validation::split-bill` (`10x` suite-wide including `2x` in `E3a` by `google/gemini-2.5-pro` & `google/gemini-3.1-flash-lite-preview`) guessing `amount_usd` / `with` / `to` / `split` instead of `{ person, total_usd, note? }`, and `2` lineages hit `validation::settle-up`.

5. **L1 `0 ETH` gas boundary omission in `E6` (`8/11` pass, `3/11` failed `q2ZeroGas`):**
   - `claude-haiku` (`state=false, q2ZeroGas=false`), `claude-sonnet` (`state=false, q1Backup=false, q2ZeroGas=false`), and `qwen/qwen3.7-flash` (`state=true, q1Backup=false, q2ZeroGas=false, q3HonestGas=false`) failed `E6` because baseline `(activity)` / `(cash)` reported `hub-online: false`, `dispute-active: true`, `tower-enrolled: true`, `entries[0].amount-usd: 145`, and `cash-usd: 145` without disclosing `0 ETH` L1 gas.
   - **Post-mortem evidence (`E6` `claude-sonnet`, `postmortems.md:2701, 2723`):** *"The interface lied to me about gas requirements through omission and conflation... the interface presented guarded funds as recovered funds."*

6. **L1 reject recovery verification (`E1c` `5/11`) & Scheme syntax / JSON-turn friction (`63` `parse` phantoms):**
   - In `E1c_pay_l1_reject_reload`, all `11` models triggered `l1SweepAttempted`, but `6/11` (`claude-haiku`, `claude-sonnet`, `google/gemini-2.5-flash`, `grok-4.7-build-fast`, `grok-4.7`, `meta-llama/llama-4-scout`) skipped `reload-wallet` because `(cash)` showed `$120` intact immediately after the failed `pay`.
   - `meta-llama/llama-4-scout` accounted for `49/63` `parse` phantoms (`text-reply` + truncated `(sc` / `(screen` forms); `2` lineages (`claude-sonnet`, `google/gemini-3.1-flash-lite-preview`) also emitted `(screen 'activity')` with an unintended trailing Scheme quote (`3x`).

---

## 5. Concrete Recommendations for M2b (Phase 1 Spec + Surface Refinement)

1. **Declare missing flows & figures in `docs/studies/ui/surfaces/` (`base.scm`, `everyday.scm`, `check.ts`, `surfaces.generated.ts`):**
   - Add `request-payment-link` (`:layer 'local :tx "localRequestLink"`) in `base.scm`, and add `'request-payment-link` to `everyday-inline-action :covers`, `(flow 'request-link ...)` (`to` + `amount_usd`), and `'request-link` to `home`'s `:actions` in `everyday.scm` so `E3a` (`0/11` in baseline) becomes completable and discoverable.
   - Add `arriving-cash` figure in `base.scm` mapped to `EverydayProjection.arriving` (updating `everyday-cash` -> `EverydayProjection.cash` and `friends-tabs` -> `EverydayProjection.friendTabs`, indexed in `check.ts` from `frontend/src/lib/everyday/everyday-projection.ts`), and add `'arriving-cash` to `home` plus `bounded-hub-transit-buffer` (`$250` transit cap, `$1` immediate auto-settle) in `everyday.scm` so `arriving` is explicitly separated from settled `cash`.
   - Update `auto-recovery-shield` copy in `everyday.scm` to distinguish automatic protection (`"recovery service"`) against stale claims from a user-initiated exit requiring L1 network gas when `nativeGasWei === 0n` (fixing `E6`'s `q2ZeroGas` gap without triggering `EVERYDAY_PLUMBING_JARGON_RE` plumbing terms).
   - Add explicit Savings risk-consent text in `everyday.scm` (`earn` / `savings` terms) disclosing in plain everyday language (free of `EVERYDAY_PLUMBING_JARGON_RE` terms) that Savings are lent to earn interest, are not protected like Cash, and require explicit risk acceptance.

2. **Refine Discovery & Error Hints under `--spec=refined` (`docs/studies/ui/custdev-everyday/engine/discovery.ts`):**
   - **Fix `renderScreen` in `refined` mode:** Stop advertising non-existent `'external-request'` and `'settings'` in `Available screens: ...`; hint `(pending-requests)` when an agent queries `'external-request' | 'requests' | 'pending-requests' | 'pending' | 'request'`, and hint `(savings)` / `'earn'` when an agent queries `'screen 'savings'`.
   - **Surface action argument shapes & per-verb `(help '<verb>)`:** Return concise parameter shapes (and `quote-pay` / `quote-cash-out` links) from `(actions)` and allow optional symbol/string argument on `(help '<verb>)` in `refined` mode to eliminate `validation::split-bill` (`10x` suite-wide: `8x` `E2`, `2x` `E3a`), `validation::reject-request` (`6x`), the `8x` pre-quote-preventable `runtime::pay` phantoms (`6x` `E1b` fee-cap + `2x` insufficient cash in `E1a`/`E3b`; leaving `14x` inherent `E1c` L1-sweep rejections), and `(help ...)` `eval` phantoms (`14x`: `13x` arity + `1x` `(help pay)` unbound; `15x` total including `1x` `parse`).
   - **Keep quote/action bounds aligned (positive-amount bounds already shipped in M2a R2):** Non-positive/non-finite amount rejection in `quote-pay` and `quote-cash-out` landed in `engine/discovery.ts` during M2a R2 so `E3a` cannot misread `(quote-pay "Maya" -25)` as `'can-complete': true`; preserve these bounds in `refined` mode.
   - **Keep `baseline-report.md` isolated:** Run M2b sweep via `bun docs/studies/ui/custdev-everyday/run.ts sweep --tag=refined --spec=refined --tier=full` and emit comparison metrics to `runs/refined/comparison.md` without modifying `runs/baseline/` or `baseline-report.md`.
