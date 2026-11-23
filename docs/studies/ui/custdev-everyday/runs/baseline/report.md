# Custdev-Everyday Report (baseline · spec=baseline)

Generated: 2026-11-19T01:22:20.419Z

## Overall Metrics
- Episodes passed: **70/110** (state: 79/110, comprehension: 81/110)
- Total phantoms: **197** (14 cross-model patterns)
- Transport errors: 0
- Phantom categories: unknown_action=5, validation=20, eval=77, parse=63, runtime=31, timeout=1

## Per-Model Completion & Phantoms
| Model | Lineage | Pass | State | Comp | Avg Turns | Phantoms | unknown_action | validation | eval | parse | runtime | timeout | TransportErr |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-fable-5.2 | anthropic-claude-fable-5.2 | 9/10 | 9/10 | 9/10 | 9.3 | 8 | 1 | 2 | 3 | 0 | 2 | 0 | 0 |
| claude-haiku | anthropic-claude-haiku | 2/10 | 3/10 | 4/10 | 5.6 | 9 | 0 | 1 | 6 | 0 | 2 | 0 | 0 |
| claude-sonnet | anthropic-claude-sonnet | 6/10 | 7/10 | 7/10 | 7.2 | 22 | 1 | 0 | 11 | 6 | 4 | 0 | 0 |
| google/gemini-2.5-flash | google-gemini-2.5-flash | 6/10 | 6/10 | 7/10 | 6 | 22 | 1 | 2 | 16 | 1 | 2 | 0 | 0 |
| google/gemini-2.5-pro | google-gemini-2.5-pro | 9/10 | 9/10 | 9/10 | 6.8 | 15 | 0 | 3 | 8 | 0 | 4 | 0 | 0 |
| google/gemini-3.1-flash-lite-preview | google-gemini-3.1-flash-lite | 7/10 | 8/10 | 8/10 | 6.6 | 15 | 0 | 3 | 5 | 4 | 3 | 0 | 0 |
| grok-4.7-build-fast | xai-grok-4.7-build-fast | 6/10 | 7/10 | 8/10 | 6.3 | 9 | 0 | 0 | 6 | 0 | 2 | 1 | 0 |
| grok-4.7 | xai-grok-4.7 | 6/10 | 7/10 | 8/10 | 7.4 | 15 | 0 | 1 | 11 | 0 | 3 | 0 | 0 |
| meta-llama/llama-4-scout | meta-llama-4 | 3/10 | 5/10 | 5/10 | 9.2 | 63 | 2 | 5 | 5 | 49 | 2 | 0 | 0 |
| openai/gpt-6.2-astra | openai-gpt-6.2 | 8/10 | 9/10 | 8/10 | 4.7 | 4 | 0 | 1 | 1 | 0 | 2 | 0 | 0 |
| qwen/qwen3.7-flash | qwen-3.7 | 8/10 | 9/10 | 8/10 | 8.3 | 15 | 0 | 2 | 5 | 3 | 5 | 0 | 0 |

## Per-Episode Completion
| Scenario | Pass | State | Comp | Phantoms | Breakdown |
|---|---:|---:|---:|---:|---|
| E1a_pay_across_buckets | 11/11 | 11/11 | 11/11 | 15 | eval:9, parse:5, runtime:1 |
| E1b_pay_fee_above_cap | 7/11 | 11/11 | 7/11 | 17 | eval:4, parse:7, runtime:6 |
| E1c_pay_l1_reject_reload | 5/11 | 5/11 | 11/11 | 19 | parse:5, runtime:14 |
| E2_friends_split_and_settle | 5/11 | 5/11 | 5/11 | 27 | validation:10, eval:6, parse:10, timeout:1 |
| E3a_newcomer_arriving_and_request | 0/11 | 0/11 | 3/11 | 12 | unknown_action:4, validation:3, eval:1, parse:4 |
| E3b_offline_hub_keeps_arriving | 7/11 | 11/11 | 7/11 | 11 | parse:10, runtime:1 |
| E4_savings_optin_consent | 9/11 | 9/11 | 10/11 | 27 | unknown_action:1, validation:1, eval:8, parse:8, runtime:9 |
| E5a_external_checkout_approve | 9/11 | 9/11 | 9/11 | 32 | eval:29, parse:3 |
| E5b_external_bait_reject | 9/11 | 9/11 | 10/11 | 29 | validation:6, eval:18, parse:5 |
| E6_offline_recovery_zero_gas | 8/11 | 9/11 | 8/11 | 8 | eval:2, parse:6 |

## Top Phantom Patterns (Sorted by Frequency)
| Count | Cross-Model | Lineages | Category | Action / Expr | Sample Error |
|---:|---|---:|---|---|---|
| 32 | YES | 3 | parse | `text-reply` | Expected a structured tool call (discover, act, or done), got plain text. |
| 23 | YES | 8 | eval | `(screen 'external-request)` | Unknown screen 'external-request'. Available screens: home, people, earn, activity, extern |
| 22 | YES | 11 | runtime | `pay` | Insufficient Cash ($54.95) for $65.05. |
| 11 | no | 1 | parse | `(sc` | Parser: expected parenthesis but eof found |
| 10 | YES | 8 | validation | `split-bill` | split-bill requires { person: string, total_usd: positive number }. |
| 9 | YES | 9 | runtime | `add-savings` | Savings require explicit consent (accept_risk: true): Savings are lent to earn interest an |
| 6 | YES | 2 | validation | `reject-request` | Requires { request_id: string }. |
| 4 | YES | 4 | eval | `(screen 'requests)` | Unknown screen 'requests'. Available screens: home, people, earn, activity, external-reque |
| 4 | YES | 3 | eval | `(screen 'pending-requests)` | Unknown screen 'pending-requests'. Available screens: home, people, earn, activity, extern |
| 3 | YES | 3 | eval | `(screen 'savings)` | Unknown screen 'savings'. Available screens: home, people, earn, activity, external-reques |
| 3 | YES | 2 | parse | `(screen 'activity')` | Parse Error: expecting datum after ''' at 1:17 |
| 3 | no | 1 | parse | `(screen` | Parser: expected parenthesis but eof found |
| 3 | no | 1 | eval | `(screen)` | screen: arguments rejected — 1 problem(s):   args — Too small: expected array to have >=1  |
| 2 | YES | 2 | validation | `settle-up` | settle-up requires { person: string }. |
| 2 | YES | 2 | eval | `(help 'split-bill)` | help: arguments rejected — 1 problem(s):   args — Too big: expected array to have <=0 item |
| 2 | YES | 2 | unknown_action | `request-payment` | Unknown action 'request-payment'. Available actions: pay, cash-out, split-bill, settle-up, |
| 2 | YES | 2 | eval | `(screen 'pending)` | Unknown screen 'pending'. Available screens: home, people, earn, activity, external-reques |
| 2 | no | 1 | eval | `(help 'pay)` | help: arguments rejected — 1 problem(s):   args — Too big: expected array to have <=0 item |
| 2 | no | 1 | eval | `(screen "external-request")` | Unknown screen 'external-request'. Available screens: home, people, earn, activity, extern |
| 2 | no | 1 | parse | `(screen 'external-request')` | Parse Error: expecting datum after ''' at 1:25 |
| 1 | no | 1 | eval | `(cost 'pay' '(("to" "CornerCoffee") ("amount_usd" 65)))` | Unbound variable `cost' — did you mean `cos`? |
| 1 | no | 1 | parse | `(help 'pay')` | Parse Error: expecting datum after ''' at 1:10 |
| 1 | no | 1 | eval | `(actions 'pay)` | actions: arguments rejected — 1 problem(s):   args — Too big: expected array to have <=0 i |
| 1 | no | 1 | eval | `(pay 'CornerCoffee 65.00)` | Unbound variable `pay' |
| 1 | no | 1 | eval | `(quote-payment "CornerCoffee" 65.00)` | Unbound variable `quote-payment' |
| 1 | no | 1 | eval | `(quotes)` | Unbound variable `quotes' — did you mean `quote`? |
| 1 | no | 1 | eval | `(help "pay")` | help: arguments rejected — 1 problem(s):   args — Too big: expected array to have <=0 item |
| 1 | no | 1 | parse | `(quote pay to: "CornerCoffee` | Invalid Syntax at line 1: Unterminated expression (quote pay to: "CornerCoffee |
| 1 | no | 1 | parse | `(quote (pay to: "CornerCoffee` | Invalid Syntax at line 1: Unterminated expression (quote (pay to: "CornerCoffee |
| 1 | no | 1 | parse | `(quote (pa` | Parser: expected parenthesis but eof found |

## Sample Post-Mortems
### E1a_pay_across_buckets — claude-sonnet (passed=true, phantoms=2)
The core problem: **nothing in the surface suggested `quote-pay` existed or was needed**.

## Concrete issues

1. **`(help)` output was truncated** — it cut off mid-list (`"(ac`), hiding what other functions existed. I couldn't see the full inventory of available operations.

2. **`(actions)` returned action names, but not their preview/query counterparts** — it listed `"pay"` but not `quote-pay`. This made it look like `pay` was the only relevant primitive.

3. **No pointer from actions to quotes** — when I called `(actions)`, there was no hint that "most actions have a `quote-*` variant you should call first."

4. **My initial guess `(cost 'pay' ...)` felt reasonable but failed silently** — the error message "did you mean `cos`?" was technically correct but offered no path forward. A better error: "No `cost` function. Try `(quote-pay ...)` to preview payment costs."

5. **`(help 'pay')` parse error was a dead-end** — I tried to get help on the `pay` action specifically, but the syntax was wrong and the error didn't tell me how to get help on a specific action (if that's even possible).

## What would have helped

- `(actions)` returning `["pay", "quote-pay", "cash-out", "quote-cash-out", ...]` — or at minimum, a note like `"Use (quote-<action> ...) to preview before acting."`
- `(help)` output not truncating — I needed to see the full list.
- Error message on `cost` suggesting `quote-pay` by name.

The working path was completely invisible until I stumbled onto `(help)` → saw the fragment `"(quote-pay"` → guessed the rest. That shouldn't require a stumble.

### E1a_pay_across_buckets — google/gemini-2.5-flash (passed=true, phantoms=3)
Here's concrete feedback on the wallet interface:

1.  **Missing Cue for Cost Preview:** There was no explicit action like `preview-pay`, `check-cost`, or `estimate-fee` listed in the initial `discover` output (`["pay","cash-out",...]`). The user had to guess that `quote-pay` existed, which is not intuitive for a "check cost" task.
2.  **Inconsistent Naming for Cost Preview:** The function to check the cost is named `quote-pay`. This is not immediately obvious for the task "check what it will cost." More intuitive names would be `preview-pay`, `estimate-pay`, or `check-pay-cost`.
3.  **Lack of `help` or `actions` Functionality:** The `help` and `actions` functions failed when trying to inspect `pay` (`ERROR (eval): help: arguments rejected`). This prevented the user from discovering `quote-pay` or understanding how to use `pay` (e.g., if `pay` itself had a dry-run option).
4.  **Ambiguity between `discover` and `act`:** The user attempted `(pay 'CornerCoffee 65.00)` within `discover`, leading to `Unbound variable 'pay'`. This indicates a lack of clear distinction or guidance on which functions are for `discover` (information retrieval) versus `act` (performing actions). If `pay` could be called in `discover` for a dry run, it would have been a valid approach.
5.  **Fee Disclosure Timing:** The fee (`fee-usd: 0.05`) was only disclosed *after* the payment was sent, not before. The task explicitly required checking the cost *before* paying.

### E1a_pay_across_buckets — google/gemini-2.5-pro (passed=true, phantoms=1)
Based on the user's journey, here is concrete feedback on the interface's design:

*   **Naming:** The function name `quote-payment` (the user's first guess) is a more natural and common phrasing than `quote-pay`. The inconsistency between the verb-noun structure of `quote-payment` and the verb-verb structure of `quote-pay` led to the initial error. Using more standard phrasing like `get-payment-quote` or `quote-payment` would be more predictable.

*   **Missing Cues:** The initial error message, `Unbound variable 'quote-payment'`, is technically correct but unhelpful. It confirms the command doesn't exist but offers no guidance. A better error message would provide a "Did you mean...?" suggestion, especially when a similar command like `quote-pay` exists. This would have immediately corrected the user's path without requiring them to resort to the `(help)` command.

### E1a_pay_across_buckets — google/gemini-3.1-flash-lite-preview (passed=true, phantoms=1)
The interface was difficult to navigate due to inconsistent naming conventions and a lack of discoverability regarding how to preview transactions.

**Specific Feedback:**

*   **Inconsistent Naming (The "Quotes" vs. "Quote" issue):** The error message in Turn 2 suggests the system expects `quote` (singular), but the user naturally guessed `quotes` (plural). If the function is `quote-pay`, the system should either alias `quotes` to `quote` or provide a clearer error message that explicitly points to the correct function name rather than just a vague "did you mean."
*   **Missing "Preview" Cue:** The `(actions)` list returned in Turn 1 (`["pay", "cash-out", ... ]`) did not include any indication that a "quote" or "preview" function existed. Users shouldn't have to run `(help)` to discover that `(quote-pay ...)` is a valid action. This should be surfaced in the primary `(actions)` list or the `(screen 'home)` context.
*   **Ambiguous Action Discovery:** The `(actions)` list returned in Turn 1 felt incomplete. It listed `pay` but omitted the necessary prerequisite step of `quote-pay`. If `quote-pay` is a required step for a successful payment, it should be exposed as a top-level action or clearly linked to the `pay` action.
*   **Lack of Contextual Guidance:** When the user is on the `home` screen, there is no hint that they can perform a quote check. The interface should provide a "Check Fee" or "Preview Payment" button/command when a payment intent is detected.

### E1a_pay_across_buckets — grok-4.7 (passed=true, phantoms=1)
The preview lived outside the action list, and the obvious way to ask about `pay` was rejected with a size error.

`(actions)` lists `pay` and nothing about cost. `quote-pay` only shows up inside a nullary `(help)` dump, next to `(screens)` and `(quote-cash-out 50)`. The name does not match the task language ("cost", "fee", "preview") or the action name `pay`, so the working form is invisible until you already call `(help)` with zero arguments.

`(help "pay")` is the natural next call and it fails. The message is `args — Too big: expected array to have <=0 items`. That reads like a bug in the argument array, not "help takes no arguments; forms are listed by `(help)`." There is no per-action help, and `(actions)` returns bare names with no argument shape, so `to` / `amount_usd` versus the positional `(quote-pay "CornerCoffee" 65)` is a second guess.

`pay` itself has no preview flag, quote id, or fee field. Nothing on the send path points at `quote-pay`. Fee, cap, and `inline-preview` appear only after that form is already known. The hyphenated result keys (`fee-usd`) also diverge from the snake_case act args (`amount_usd`).

### E1a_pay_across_buckets — meta-llama/llama-4-scout (passed=true, phantoms=6)
Based on the interactions, here are some concrete feedback on naming, missing cues, or misleading labels that made it hard to find the working approach:

1. **Unclear syntax**: The `discover` function seems to expect a specific syntax, but it's not clearly documented. The error messages, such as `Invalid Syntax at line 1: Unterminated expression`, don't provide enough information about what's wrong.
2. **Misleading error messages**: Error messages like `Parser: expected parenthesis but eof found` are not very informative. It would be better to provide more context about what's expected, e.g., "Missing closing parenthesis" or "Invalid syntax: expected (quote-pay \" recipient\" amount)".
3. **Lack of examples or documentation**: There are no clear examples or documentation on how to use the `discover` and `act` functions. This made it difficult to figure out the correct syntax.
4. **Unintuitive command structure**: The correct command structure `(quote-pay "CornerCoffee" 65)` is not immediately obvious. It would be helpful to have a clear explanation of the available commands and their syntax.
5. **No auto-completion or suggestions**: The `discover` function doesn't seem to provide auto-completion or suggestions for available commands. This would have helped to avoid typos and syntax errors.
6. **Unclear intent syntax**: The intent syntax, e.g., `intent="Check CornerCoffee $65.00 payment"`, is not clearly explained. It's not obvious that the intent string should be in a specific format.

To improve the usability of the system, I would suggest:

* Provide clear documentation and examples for the `discover` and `act` functions.
* Offer auto-completion or suggestions for available commands.
* Improve error messages to provide more context and guidance on how to correct the syntax.
* Use a more intuitive command structure and syntax.

By addressing these issues, users will be able to more easily find the correct approach and complete tasks successfully.

### E1a_pay_across_buckets — qwen/qwen3.7-flash (passed=true, phantoms=1)
**Naming:** `discover` and `act` are overloaded and abstract. `discover` implies browsing/searching, not price-checking or status verification. `act` lacks transactional scope; users expect explicit verbs like `quote`, `confirm`, or `send`. This forced me to guess whether to route pricing queries through discovery or execution.

**Missing Cues:** No explicit confirmation gate exists between viewing the quote and executing the payment. After the first successful

### E1b_pay_fee_above_cap — claude-haiku (passed=true, phantoms=1)
The core problem: **`act()` with a payment doesn't warn you, it executes**. You have to know to call `discover()` with a quote first.

Concrete issues:

1. **`act(action="pay")` feels like a dry-run.** The name doesn't signal "this will charge you if the fee clears." You tried it because that's what `act` sounds like it does—it acts. The runtime error was your only warning.

2. **`discover()` signature is obscure.** You called it with `intent=` and `args=` keys, but the working version shows it takes a raw expression: `discover("(quote-pay \"CornerCoffee\" 25)")`. The discovery mechanism is there, but the interface doesn't advertise that you *must* quote before you pay. The parameter shape should make that unavoidable—either the function signature should enforce it, or the docs at the call site should scream it.

3. **No feedback loop between functions.** `act()` could have returned a structure like `{blocked: true, reason: "fee", suggestedAction: "call discover with quote-pay first"}` instead of throwing. The error is correct, but it's correction-shaped, not guidance-shaped.

4. **`maxAcceptableFee` buried in the error.** You didn't know that threshold existed until it blocked you. It should appear in `discover()` output or in a separate `limits()` call, not only in rejection messages.

**The fix in order of impact:**
- Make `discover()` signature obvious: take a quoted expression as the first positional arg, not buried in `args`. Or rename it to `quote()` and `inspect()`.
- `act(action="pay", ...)` should require an explicit `feeApproval` or `quotedAmount` parameter that forces you to have called `discover()` first.
- Include `maxAcceptableFee` in the initial balance/status output, not hidden.

### E1b_pay_fee_above_cap — claude-sonnet (passed=true, phantoms=1)
The core problem: I had no way to know `quote-pay` existed.

**What misled me:**

1. **"act" promises a dry-run mode that doesn't exist.** The error message says "payment blocked" and "Cash untouched," which sounds like `act` *already tried* and was stopped by a guard rail. That framing made me think I'd gotten the safety-limit feedback I needed—no reason to look for a separate quote tool.

2. **No discovery path to `quote-pay`.** I ran `discover("(cash)")` to orient, but nothing in that response hinted at quote operations. If the cash object had included a `"you can quote-pay before acting"` note, or if there were a `(available-actions)` expr that listed both `pay` and `quote-pay`, I would have found it immediately.

3. **The error came from `act`, not from a missing step.** When a tool *fails* with "fee too high," that reads as "you did the right thing, the system stopped you." The working path requires treating the error as "you skipped a step"—but nothing in the interface labeled the error that way.

**What would fix it:**

- `discover("(cash)")` could return `"actions": ["pay", "quote-pay", "cash-out"]` so the full vocabulary is visible up front.
- The `act` docstring could say "Use quote-pay first to preview fees" or link to quote operations.
- The fee-exceeded error could say "Run (quote-pay ...) to inspect this fee before deciding" instead of implying the payment was attempted and blocked.

The misleading part wasn't any single label—it was that the error *felt complete* when it was actually telling me I'd used the wrong tool.

### E1b_pay_fee_above_cap — google/gemini-2.5-flash (passed=true, phantoms=3)
Here's concrete feedback on what made it hard to find the working approach:

1.  **Misleading Error for `(pay ...)` in `discover`:**
    *   **Problem:** When attempting `discover(expr="(pay \"CornerCoffee\" 25.00)")`, the error "Unbound variable `pay`" is misleading. `pay` *is* a known action. The user was trying to *simulate* or *inspect* the `pay` action, which is a reasonable expectation for `discover`.
    *   **Suggestion:** The system should clarify that `discover`'s `expr` is for *quoting* or *inspecting* specific functions/data, not for executing actions directly or simulating them with the action's name. A better error would be: "Cannot execute action `pay` in `discover` context. To simulate or quote an action, use a dedicated quoting function like `quote-pay`."

2.  **Missing `quote-pay` in `discover`'s initial output:**
    *   **Problem:** In Turn 1, `discover(intent="Check available actions to pay CornerCoffee.")` returned `["pay","cash-out",...]`. The crucial `quote-pay` action was not listed.
    *   **Suggestion:** If `quote-pay` is the intended way to preview transactions, it should be discoverable alongside `pay` when querying for payment-related actions. This would provide a clear path for users to check fees and limits *before* attempting a transaction.

3.  **Unhelpful `help` function:**
    *   **Problem:** `discover(expr="(help 'pay)")` failed with "Too big: expected array to have <=0 items". This indicates the `help` function itself is not intuitive or correctly implemented for inspecting actions.
    *   **Suggestion:** A `help` function should be robust and provide useful information about actions, including their arguments, side effects, and any associated quoting/simulation functions. The error message was unhelpful and blocked the user from getting necessary information.

4.  **Lack of a clear "simulate" or "preview" mechanism:**
    *   **Problem:** The user explicitly tried to "Simulate paying CornerCoffee" in Turn 2. The system didn't offer an obvious way to do this until the "what would have worked" solution was revealed.
    *   **Suggestion:** The interface should explicitly expose a "preview" or "quote" mechanism for actions that have significant side effects (like payments with fees). This could be a button in a UI, or a clearly named function like `quote-pay` that is discoverable.

### E1b_pay_fee_above_cap — google/gemini-2.5-pro (passed=true, phantoms=1)
Based on my experience, here's what made the task difficult:

*   **Misleading Name:** The `pay` action has a `dry_run` argument. In software, `dry_run` usually means "simulate the action and report what would happen without actually doing it." I expected it to return the fee details. Instead, it threw a runtime error, which is unexpected for a simulation.

*   **Missing Cue:** The correct way to check a fee is with a completely different action called `quote-pay`. This action wasn't listed in the main `(actions)` list, so I had no way to know it existed. It feels like a hidden or secondary feature.

*   **Unclear Naming:** The term `maxAcceptableFee` appeared in the error message, but I couldn't find a way to discover this "safety limit" beforehand. I checked the home screen and my cash balance, but this setting wasn't visible.

### E1b_pay_fee_above_cap — google/gemini-3.1-flash-lite-preview (passed=true, phantoms=1)
Here is the feedback on the wallet interface based on my experience:

*   **Missing Fee Preview:** The `pay` action lacks a "dry run" or "quote" capability. I had to trigger a full transaction attempt just to discover the fee, which is inefficient and potentially risky. There should be a `quote-pay` or `estimate-fee` action available before committing to a transaction.
*   **Opaque Error Messages:** The error message "Fee $3.50 exceeds maxAcceptableFee $2.00" is helpful, but it doesn't explain *why* the fee is so high or offer a way to adjust settings (e.g., "increase max fee" or "choose slower speed").
*   **Ambiguous Action Naming:** The `pay` action is too broad. It conflates "initiate payment" with "execute payment." Splitting these into `prepare-payment` (which returns the fee quote) and `confirm-payment` (which executes) would prevent accidental overspending and allow for better error handling.
*   **Lack of Contextual Limits:** The `home` screen shows my balance but fails to surface my current "safety limits" or "fee preferences." I shouldn't have to hit an error to learn what my own constraints are.

