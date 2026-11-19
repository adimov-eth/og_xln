# Custdev-Everyday Report (refined · spec=refined)

Generated: 2026-11-19T02:17:03.999Z

## Overall Metrics
- Episodes passed: **77/110** (state: 85/110, comprehension: 84/110)
- Total phantoms: **106** (4 cross-model patterns)
- Transport errors: 8
- Phantom categories: unknown_action=4, validation=1, eval=19, parse=60, runtime=22, timeout=0

## Per-Model Completion & Phantoms
| Model | Lineage | Pass | State | Comp | Avg Turns | Phantoms | unknown_action | validation | eval | parse | runtime | timeout | TransportErr |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| anthropic/claude-fable-5.2 | anthropic-claude-fable-5.2 | 10/10 | 10/10 | 10/10 | 8.3 | 4 | 0 | 0 | 2 | 1 | 1 | 0 | 0 |
| claude-haiku | anthropic-claude-haiku | 3/10 | 4/10 | 5/10 | 4.6 | 4 | 0 | 0 | 2 | 0 | 2 | 0 | 0 |
| claude-sonnet | anthropic-claude-sonnet | 6/10 | 7/10 | 8/10 | 5.1 | 13 | 2 | 0 | 4 | 4 | 3 | 0 | 0 |
| google/gemini-2.5-flash | google-gemini-2.5-flash | 8/10 | 9/10 | 9/10 | 4.5 | 6 | 0 | 0 | 3 | 1 | 2 | 0 | 0 |
| google/gemini-2.5-pro | google-gemini-2.5-pro | 10/10 | 10/10 | 10/10 | 4.8 | 5 | 0 | 0 | 2 | 0 | 3 | 0 | 0 |
| google/gemini-3.1-flash-lite-preview | google-gemini-3.1-flash-lite | 9/10 | 9/10 | 9/10 | 4.8 | 5 | 1 | 1 | 1 | 0 | 2 | 0 | 0 |
| grok-4.7-build-fast | xai-grok-4.7-build-fast | 8/10 | 9/10 | 9/10 | 5.7 | 2 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |
| grok-4.7 | xai-grok-4.7 | 1/10 | 3/10 | 1/10 | 0.9 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 8 |
| meta-llama/llama-4-scout | meta-llama-4 | 4/10 | 5/10 | 5/10 | 8.7 | 57 | 1 | 0 | 2 | 51 | 3 | 0 | 0 |
| openai/gpt-6.2-astra | openai-gpt-6.2 | 8/10 | 9/10 | 8/10 | 4.1 | 2 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |
| qwen/qwen3.7-flash | qwen-3.7 | 10/10 | 10/10 | 10/10 | 7.1 | 7 | 0 | 0 | 2 | 3 | 2 | 0 | 0 |

## Per-Episode Completion
| Scenario | Pass | State | Comp | Phantoms | Breakdown |
|---|---:|---:|---:|---:|---|
| E1a_pay_across_buckets | 11/11 | 11/11 | 11/11 | 3 | eval:3 |
| E1b_pay_fee_above_cap | 7/11 | 11/11 | 7/11 | 13 | unknown_action:1, eval:1, parse:7, runtime:4 |
| E1c_pay_l1_reject_reload | 5/11 | 5/11 | 9/11 | 24 | eval:1, parse:6, runtime:17 |
| E2_friends_split_and_settle | 7/11 | 7/11 | 7/11 | 7 | unknown_action:1, validation:1, parse:5 |
| E3a_newcomer_arriving_and_request | 8/11 | 8/11 | 8/11 | 4 | unknown_action:1, eval:1, parse:2 |
| E3b_offline_hub_keeps_arriving | 7/11 | 11/11 | 7/11 | 8 | eval:1, parse:6, runtime:1 |
| E4_savings_optin_consent | 8/11 | 8/11 | 8/11 | 16 | unknown_action:1, eval:6, parse:9 |
| E5a_external_checkout_approve | 8/11 | 8/11 | 8/11 | 13 | eval:1, parse:12 |
| E5b_external_bait_reject | 9/11 | 9/11 | 10/11 | 5 | eval:3, parse:2 |
| E6_offline_recovery_zero_gas | 7/11 | 7/11 | 9/11 | 13 | eval:2, parse:11 |

## Top Phantom Patterns (Sorted by Frequency)
| Count | Cross-Model | Lineages | Category | Action / Expr | Sample Error |
|---:|---|---:|---|---|---|
| 35 | YES | 4 | parse | `text-reply` | Expected a structured tool call (discover, act, or done), got plain text. |
| 22 | YES | 11 | runtime | `pay` | Fee $3.50 exceeds maxAcceptableFee $2.00 — payment blocked; Cash untouched. |
| 9 | no | 1 | parse | `(s` | Parser: expected parenthesis but eof found |
| 5 | no | 1 | parse | `(screen` | Parser: expected parenthesis but eof found |
| 3 | YES | 3 | eval | `(screen 'savings)` | Unknown screen 'savings'. Use (screen 'earn) or (savings). Available screens: home, people |
| 3 | no | 1 | parse | `(sc` | Parser: expected parenthesis but eof found |
| 2 | YES | 2 | unknown_action | `request` | Unknown action 'request'. Available actions: pay, cash-out, split-bill, settle-up, add-sav |
| 1 | no | 1 | eval | `(quote-pay to "CornerCoffee" amount_usd 65)` | Unbound variable `to' |
| 1 | no | 1 | eval | `(cost-of 'pay {"to":"CornerCoffee","amount_usd":65})` | Unbound variable `cost-of' |
| 1 | no | 1 | eval | `(quote-payment "CornerCoffee" 65.00)` | Unbound variable `quote-payment' |
| 1 | no | 1 | eval | `(quote-pay 'CornerCoffee 25.00)` | quote-pay: arguments rejected — 1 problem(s):   arg 1 — expected AString, got symbol: "Cor |
| 1 | no | 1 | unknown_action | `quote-pay` | Unknown action 'quote-pay'. Available actions: pay, cash-out, split-bill, settle-up, add-s |
| 1 | no | 1 | parse | `(quote-pay to: "CornerCoffee` | Invalid Syntax at line 1: Unterminated expression (quote-pay to: "CornerCoffee |
| 1 | no | 1 | parse | `(quote-pay` | Parser: expected parenthesis but eof found |
| 1 | no | 1 | parse | `(quote-pay to` | Parser: expected parenthesis but eof found |
| 1 | no | 1 | eval | `(move-to-cash 50)` | Unbound variable `move-to-cash' |
| 1 | no | 1 | validation | `split-bill` | split-bill requires { person: string, total_usd: positive number }. |
| 1 | no | 1 | eval | `(pending-payments)` | Unbound variable `pending-payments' |
| 1 | no | 1 | eval | `(quote-pay 'CornerCoffee 10)` | quote-pay: arguments rejected — 1 problem(s):   arg 1 — expected AString, got symbol: "Cor |
| 1 | no | 1 | parse | `(screen 'savings')` | Parse Error: expecting datum after ''' at 1:16 |
| 1 | no | 1 | unknown_action | `move-to-savings` | Unknown action 'move-to-savings'. Available actions: pay, cash-out, split-bill, settle-up, |
| 1 | no | 1 | eval | `(screen 'help)` | Unknown screen 'help'. Available screens: home, people, earn, activity |
| 1 | no | 1 | eval | `(savings-terms)` | Unbound variable `savings-terms' |
| 1 | no | 1 | eval | `(list (screen 'savings) (cash) (actions))` | Unknown screen 'savings'. Use (screen 'earn) or (savings). Available screens: home, people |
| 1 | no | 1 | parse | `(screen 'requests')` | Parse Error: expecting datum after ''' at 1:17 |
| 1 | no | 1 | eval | `(screen requests)` | Unbound variable `requests' |
| 1 | no | 1 | parse | `(scre` | Parser: expected parenthesis but eof found |
| 1 | no | 1 | eval | `(screen 'request)` | No 'request' screen. Inspect external links with (pending-requests) and use act('approve-r |
| 1 | no | 1 | parse | `(screen 'request')` | Parse Error: expecting datum after ''' at 1:16 |
| 1 | no | 1 | eval | `(requests)` | Unbound variable `requests' |

## Sample Post-Mortems
### E1a_pay_across_buckets — claude-haiku (passed=true, phantoms=1)
Looking at your path to the working approach:

**The core problem: `quote-pay` signature is backwards from what the error teaches.**

In Turn 3, you followed the discovery note exactly—it says `(quote-pay to amount_usd)` with `to` and `amount_usd` as named parameters. The error `Unbound variable 'to'` doesn't say "wrong order" or "positional not named." It says the variable itself doesn't exist. That's the kind of error that points to a syntax mistake, not a parameter-order mistake. So you had to guess the next thing to try rather than read the error.

Then Turn 4 worked with `(quote-pay "CornerCoffee" 65)`, which is positional. But the discovery output never said "this function takes positional arguments." It showed a signature with named params, then failed in a way that only makes sense if you ignore that signature and try positional args instead.

**Specific naming issues:**

1. **`args` in the action definition is a schema, not an example.** The discovery says `"args":"{ to: string, amount_usd: number }"`. That looks like it's telling you the shape of what to pass. It's not. It's a type annotation. By the time you read it, you're already pattern-matching against function signatures you've used before, and function signatures that show parameter names usually mean you use those names.

2. **`quote` field is decorative.** It says `"quote":"(quote-pay to amount_usd)"`. This looks like it's giving you the template to fill in. It's not—it's just showing you the function exists. The actual call signature is different. The field shouldn't be there, or it should show the real signature.

3. **The note `"Check (quote-pay ...) first to verify fee cap"` assumes you already know how to call it.** It's instructional, not descriptive. It tells you what to do, not how.

**What would have helped:**

- Show the actual working call: `"quote":"(quote-pay recipient-name amount-usd)"` or just drop the decorative field.
- Make the error specific: `Unbound variable 'to'` could be `"Parameters must be positional. Expected: (quote-pay recipient amount-usd)"`.
- Or commit to named params and make the action signature match the actual call.

The working path exists in the system. The labels just don't point to it.

### E1a_pay_across_buckets — claude-sonnet (passed=true, phantoms=1)
The core problem: **nothing told me `quote-pay` existed until I asked what tools were available.**

## Concrete issues

1. **`cost-of` was a reasonable guess** given the domain (financial transactions), but it failed with "Unbound variable." The error didn't suggest alternatives or point to `quote-pay`.

2. **The `pay` action's note field saved me:** `"Check (quote-pay ...) first to verify fee cap and settled Cash."` This was the *only* discoverable pointer to the quote function. Without calling `(actions)` first, I would have had no path forward.

3. **Naming asymmetry:** Why `quote-pay` instead of `pay-quote`? The verb-noun pattern matches `pay`, but the noun-verb order breaks parallelism. I looked for `cost-of` and `preview-pay` before finding `quote-pay`.

4. **Missing upfront context:** When I entered the conversation, I had no surface area to discover capabilities except trial-and-error `discover()` calls. A startup hint like "Available: `(actions)`, `(balance)`, `(history)`" would have cut Turn 1 and Turn 2.

## What would fix it

- **Error messages that teach:** `Unbound variable 'cost-of'` → `Unbound variable 'cost-of'. Try (actions) to list available operations, or (quote-pay ...) to preview payment costs.`
- **Consistent naming:** Either `pay` / `pay-quote` or `quote-pay` / `act-pay`, not mixed.
- **Discoverable entry point:** Give me `(help)` or `(actions)` automatically on first turn, or list it in the initial system context.

The interface worked once I found `(actions)`, but the first two turns were wasted because the system had no affordance for "what can I even call here?"

### E1a_pay_across_buckets — google/gemini-2.5-pro (passed=true, phantoms=1)
Based on the interaction, here is the feedback on the interface:

*   **Naming:** The function `quote-payment` was a very logical guess for getting a quote on a payment. The actual function name, `quote-pay`, is less intuitive. Using the more descriptive `quote-payment` would have likely avoided the initial error.

*   **Missing Cues:** There was no initial cue that `quote-pay` was the correct function name. The user had to fail first and then use `(help)` to discover the correct syntax, which slowed down the task.

### E1b_pay_fee_above_cap — claude-haiku (passed=true, phantoms=1)
The interface failed at the action naming layer. Here's what went wrong:

**1. `pay` action name hides a critical decision point.**
You invoked `pay` as if it were a simple transfer. But `pay` doesn't quote the fee—it enforces the limit and fails closed. The working path required `quote-pay`, which is a separate action that surfaces the fee *before* commitment. 

The naming makes these feel like variants of the same thing ("pay with or without quoting"). They're not. One is *inspection*, one is *execution*. The interface should signal this split in the name—not `pay` vs `quote-pay`, but something like `inspect-payment` and `execute-payment`, or `pay-preview` and `pay-commit`. Right now a user has to already know that quoting exists.

**2. The fee limit ($2.00) is invisible until it blocks you.**
The error message told you the limit *after* failure. There was no affordance to see it beforehand. The home screen shows Cash but not "max acceptable fee for payments." A user trying to pay small amounts (like $25) has no way to know if the fee structure will reject them without attempting the payment and hitting the block. This is backwards—show the constraint before the action.

**3. `act(action="pay")` doesn't communicate that it's the dangerous endpoint.**
The API symmetry between discover/act/done makes them feel equivalent in consequence. But `act` with `pay` is a commitment that fails hard; `discover` with `quote-pay` is safe inspection. The names don't encode this risk difference. Something like `act-commit` vs `discover-quote` would at least hint that one is reversible and one isn't.

**What you needed to see:**
- On the home screen, the fee policy (or at least "tap to see current fee estimate")
- Two distinct action names that don't suggest they're interchangeable
- A natural path that starts with inspection, not commitment

The working approach existed. The interface just made it invisible until you failed into it.

### E1b_pay_fee_above_cap — claude-sonnet (passed=true, phantoms=1)
The core problem: **I had no way to know `act("pay")` would fail until it failed.**

## Concrete issues

**1. Missing pre-flight signal**
- `discover("(cash)")` showed balance, transit cap, arriving status
- It did NOT show my current fee tolerance (`maxAcceptableFee $2.00`)
- I couldn't see the collision coming because half the constraint was invisible

**Fix:** `discover("(cash)")` should surface the active fee limit, e.g.:
```
"safety-limit": "$2.00 max fee"
```

**2. `act` vs `discover` boundary unclear**
- I thought `act("pay")` was the "real" payment action
- I didn't know `discover("(quote-pay ...)")` existed or that it would show fee vs limit
- The name `discover` reads like "read-only inspection," not "try a payment and see what would happen"

**Fix:** Either
  - Rename `quote-pay` to something that signals simulation: `(preview-pay ...)` or `(fee-check ...)`
  - OR make `discover("(cash)")` output mention: `"Use (quote-pay recipient amount) to preview fees"`

**3. The error message was perfect, but too late**
- `"Fee $3.50 exceeds maxAcceptableFee $2.00 — payment blocked"` is clear
- But I only learned the limit *existed* by hitting it
- No way to plan around a constraint I couldn't see

## What I expected vs what existed

| I thought | Reality |
|-----------|---------|
| `discover("(cash)")` = full wallet state | Missing fee limit |
| `act("pay")` = the way to pay | Blocked by invisible rule |
| `discover` = passive reads | Actually includes quote-pay, a dry-run |

## If I'd seen this on Turn 1:

```json
{
  "cash-usd": 120,
  "safety-limit-usd": 2.00,
  "hint": "Use (quote-pay recipient amount) to preview fees"
}
```

I would have run `discover("(quote-pay \"CornerCoffee\" 25)")` on Turn 2, seen the $3.50 fee, and reported immediately—no failed `act()`.

---

**TL;DR:** Show the fee limit in the initial balance check, and make `quote-pay` discoverable (either by name or by hint).

### E1b_pay_fee_above_cap — google/gemini-2.5-flash (passed=false, phantoms=2)
Here's feedback on what made it hard to find the working approach:

1.  **Missing Direct Cue for "Safety Limit":** The task explicitly mentioned "safety limit," but the `quote-pay` output uses "max-fee-usd" and "within-fee-cap." While related, "safety limit" isn't directly reflected in the output, requiring an inference from the user.
2.  **Implicit "Cash Intact" Check:** The task required reporting if the cash was intact. The `quote-pay` output provides `fee-usd` and `amount-usd`, but it doesn't explicitly state the *remaining* cash balance or confirm that the cash would be "intact" (i.e., not spent). A field like `cash-after-transaction-usd` or `cash-balance-unchanged` would have made this check more direct.
3.  **"can-complete" is Ambiguous for Reporting:** The `can-complete: false` flag is a good indicator that the transaction won't go through. However, the task required *reporting* what happened, not just knowing it couldn't complete. There wasn't a clear, direct tool or instruction to translate `can-complete: false` into the required `done()` summary about the fee exceeding the cap.
4.  **`note` in `actions` is Easily Overlooked:** The `note` in Turn 1: `"Check (quote-pay ...) first to verify fee cap and settled Cash."` is a good hint, but being embedded as a string within a JSON object makes it less prominent than a dedicated prompt or a separate field. It's easy to miss or not immediately connect to the "safety limit" and "cash intact" parts of the task.

### E1b_pay_fee_above_cap — google/gemini-2.5-pro (passed=true, phantoms=1)
Based on my experience, here is what made it hard to find the more efficient `quote-pay` approach:

1.  **Misleading Action Naming:** The primary action is `pay`. In common language, "pay" implies a final, committed action. There's no obvious, gentler version like `preview-payment` or `check-fee`. The system forces a distinction between `discover` (read-only) and `act` (state-changing), but the available `discover` functions didn't seem to cover payment previews.

2.  **Missing Cues for `quote-pay`:** The function `quote-pay` is not discoverable from the home screen's help text or from the names of other functions. It sounds like a developer-specific or internal name. A more user-friendly name like `get_payment_quote` or `preview_payment_details` would have been easier to guess and use.

3.  **Ambiguous "Safety Limit" Information:** On the home screen, I saw a "$250 transit cap". The error message, however, mentioned a `maxAcceptableFee` of $2.00. These are two different limits. The interface didn't expose the relevant fee limit, leading me to believe I had all the necessary information to attempt the `pay` action directly.

### E1b_pay_fee_above_cap — grok-4.7-build-fast (passed=false, phantoms=0)
The fee stop was labeled. The cash check was not, so it never became part of the same action.

`(quote-pay "CornerCoffee" 25)` already returns `within-fee-cap: false` and `can-complete: false`. That pair reads as a finished decision: do not send. The response has no balance, no before/after, and no line that the quote is not a ledger read. `$120.00` never appears, so "nothing was sent" is a gloss on `can-complete`, not something the tool showed.

`(cash)` is listed in `(help)` as a sibling of `(quote-pay …)`, next to `(screens)` and `(quote-cash-out 50)`. It is not named as the witness for a blocked pay. The only pay example in that dump is `(quote-pay "CornerCoffee" 65)`, a different amount, with no following `(cash)`.

`done` then takes a prose summary and returns it. It does not ask for the cash figure the quote never contained, so closing on "Nothing was sent" is a valid call. The intact-balance step stays optional and unnamed.

### E1b_pay_fee_above_cap — grok-4.7 (passed=false, phantoms=0)
The refusal looks complete, so the cash check never becomes part of the job.

`quote-pay` returns `within-fee-cap: false` and `can-complete: false`. Those names describe a future send, not the ledger. An agent that stops there has done what the fields say. Nothing in that payload is the cash balance, a debit, or "unchanged."

`inline-preview` (`CornerCoffee · $25.00 + $3.50 fee`) is a charge line with no status word. It reads as a prepared debit. The block lives in other fields.

`(cash)` is a sibling in help, next to `(screens)` and a sample `(quote-pay "CornerCoffee" 65)`. The sample amount is not $25, and help does not say that a blocked quote is not proof the balance stayed $120.00. `done` accepts a summary that never read `(cash)`.

The safety cap is well named. The post-condition is not. Put the balance on the blocked quote (`cash-usd`, `debited: false`) or say in the refusal reason that only `(cash)` witnesses the money.

### E1b_pay_fee_above_cap — meta-llama/llama-4-scout (passed=true, phantoms=8)
Based on the interactions, here are some concrete feedback on naming, missing cues, and misleading labels:

1. **Unclear action names**: The actions `discover`, `act`, and `text` have unclear names. What do they do? What are their purposes? Consider renaming them to something more descriptive, such as `check_balance`, `perform_action`, and `send_message`.
2. **Missing cues for action syntax**: The system does not provide clear cues on how to use the actions. For example, when trying to check the payment quote, the system does not indicate that the correct syntax is `discover("(quote-pay \"CornerCoffee\" 25)")`. Provide clear documentation or hints on the expected syntax for each action.
3. **Misleading error messages**: Error messages like `ERROR (parse): Expected a structured tool call (discover, act, or done), got plain text` are not helpful. Consider providing more informative error messages, such as `Invalid syntax: please use a structured tool call like discover, act, or done`.
4. **Unknown action 'quote-pay'**: When trying to check the payment quote, the system returns an `unknown_action` error. It would be helpful to indicate that the correct action is `pay` and that `quote-pay` is not a valid action.
5. **Inconsistent syntax**: The syntax for actions is not consistent. For example, `discover(intent="Check balance and actions", args={"intent":"Check balance and actions","expr":"(cash)"})` uses a different syntax than `discover("(quote-pay \"CornerCoffee\" 25)")`. Consider standardizing the syntax for actions.
6. **Lack of feedback on successful actions**: When a payment is blocked due to a fee exceeding the maxAcceptableFee, the system returns a runtime error. However, it would be helpful to provide feedback on successful actions, such as "Payment sent successfully" or "Payment quote retrieved successfully".

By addressing these issues, the system can provide a more intuitive and user-friendly experience, making it easier for users to understand and use the available actions.

### E1b_pay_fee_above_cap — openai/gpt-6.2-astra (passed=false, phantoms=0)
The fee block was clear; the missing cue was the Cash balance. The preview said “CornerCoffee · $25.00 + $3.50 fee,” but it didn’t say whether Cash changed. I stopped at the block without checking `(cash)`.

Show the outcome inline: “Not sent — the $3.50 fee exceeds your $2.00 limit. No fee charged. Cash unchanged: $120.00.”

### E1c_pay_l1_reject_reload — anthropic/claude-fable-5.2 (passed=true, phantoms=2)
The working path was the one I took, so finding it wasn't hard. The friction was in interpreting what happened:

- **Quote contradicted the result.** `quote-pay` returned `can-complete: true` and `within-fee-cap: true`, then `pay` failed immediately. The quote apparently doesn't check whatever the "L1 sweep" needs, so it gives false confidence. It should either cover routing or say "route not verified."

- **Jargon in the error.** "Auto-route L1 sweep rejected" uses three terms (auto-route, L1, sweep) that appear nowhere in `(help)`, `(actions)`, the home screen, or the quote. I couldn't tell what was rejected, why, or whether a retry was sensible. A plain message would help: "Payment not sent. Nothing left your Cash. [Reason]. [Retry / what to do]."

- **No next step in the error.** It didn't say whether the failure was transient or permanent, or whether retrying was safe. I ended up stopping without retrying and reported CornerCoffee as unpaid, leaving the outcome ambiguous.

- **"Your Cash was not touched" was unverifiable in-band.** The claim was true, but the error carried no balance snapshot, so a separate reload and `(cash)` were needed to confirm it.

- **Empty activity log.** `(activity)` showed `entries: []` after the failure. A failed attempt should appear as "Failed · $50.00 to CornerCoffee · not charged", since otherwise there's no record that anything happened.

- **`reload-wallet` is vaguely named and oddly placed.** It's listed as an action alongside `pay`, which suggests it changes state, and the name doesn't say whether it's a harmless refresh or something that re-syncs or restores. "refresh-balance" would be clearer, or a note saying "safe, read-only."

- **Unrelated status noise.** `(cash)` and `(activity)` return `transit-policy`, `tower-enrolled`, `hub-online`, `backup-exported` and `dispute-active` with no explanation. "Protected · automatic backup & recovery service ready" sits next to `backup-exported: false`, which reads as contradictory right when I'm checking if the money is safe.

- **Misleading example in help.** `(quote-pay "CornerCoffee" 65)` uses an amount that doesn't match any task and hints, without saying so, that some amounts behave differently.

- **Parse error on plain text.** Turn 6 was rejected for not being a structured call. That slip was mine, but the error could name the expected shape of a final `done`.

