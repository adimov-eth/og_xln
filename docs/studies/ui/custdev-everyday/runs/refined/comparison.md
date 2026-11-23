# Custdev-Everyday Comparison (baseline vs refined)

Generated: 2026-11-19T02:35:42.866Z

## Overall Deltas
| Metric | Baseline | Refined | Delta |
|---|---:|---:|---:|
| Episodes Passed | 70/110 (63.6%) | 77/110 (70%) | +7 (+6.4pp) |
| State Passed | 79/110 | 85/110 | +6 |
| Comprehension Passed | 81/110 | 84/110 | +3 |
| Total Phantoms | 197 | 106 | -91 |
| Cross-Model Patterns | 14 | 4 | -10 |
| Transport Errors | 0 | 8 | +8 |

## Matched Non-Error Cohort
Matched non-error pairs (`transportError == null` in both runs): **102** (excluded transport-error pairs: **8**; unmatched pairs: 0 baseline-only, 0 refined-only).

| Metric | Baseline | Refined | Delta |
|---|---:|---:|---:|
| Episodes Passed | 65/102 (63.7%) | 77/102 (75.5%) | +12 (+11.8pp) |
| State Passed | 74/102 | 84/102 | +10 |
| Comprehension Passed | 74/102 | 84/102 | +10 |
| Phantoms | 183 | 105 | -78 |

### Transport-Error Isolation (Excluded from Matched Cohort)
| Model | Base Err | Ref Err | Matched Pairs | Matched Pass | Matched Phantoms | Excluded Phantoms (B -> R) |
|---|---:|---:|---:|---:|---:|---:|
| grok-4.7 | 0 | 8 | 2 | 1/2 -> 1/2 | 1 -> 0 (-1) | 14 -> 1 |

## Phantom Categories
| Category | Baseline | Refined | Delta |
|---|---:|---:|---:|
| unknown_action | 5 | 4 | -1 |
| validation | 20 | 1 | -19 |
| eval | 77 | 19 | -58 |
| parse | 63 | 60 | -3 |
| runtime | 31 | 22 | -9 |
| timeout | 1 | 0 | -1 |

## Per-Scenario Deltas
| Scenario | Baseline Pass | Refined Pass | Base Phantoms | Refined Phantoms | Delta |
|---|---:|---:|---:|---:|---:|
| E1a_pay_across_buckets | 11/11 | 11/11 | 15 | 3 | -12 |
| E1b_pay_fee_above_cap | 7/11 | 7/11 | 17 | 13 | -4 |
| E1c_pay_l1_reject_reload | 5/11 | 5/11 | 19 | 24 | +5 |
| E2_friends_split_and_settle | 5/11 | 7/11 | 27 | 7 | -20 |
| E3a_newcomer_arriving_and_request | 0/11 | 8/11 | 12 | 4 | -8 |
| E3b_offline_hub_keeps_arriving | 7/11 | 7/11 | 11 | 8 | -3 |
| E4_savings_optin_consent | 9/11 | 8/11 | 27 | 16 | -11 |
| E5a_external_checkout_approve | 9/11 | 8/11 | 32 | 13 | -19 |
| E5b_external_bait_reject | 9/11 | 9/11 | 29 | 5 | -24 |
| E6_offline_recovery_zero_gas | 8/11 | 7/11 | 8 | 13 | +5 |

## Per-Model Deltas
| Model | Lineage | Base Pass | Refined Pass | Base Avg Turns | Refined Avg Turns | Base Phantoms | Refined Phantoms | Delta | Cohort / Errors |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| anthropic/claude-fable-5.2 | anthropic-claude-fable-5.2 | 9/10 | 10/10 | 9.3 | 8.3 | 8 | 4 | -4 | ok |
| claude-haiku | anthropic-claude-haiku | 2/10 | 3/10 | 5.6 | 4.6 | 9 | 4 | -5 | ok |
| claude-sonnet | anthropic-claude-sonnet | 6/10 | 6/10 | 7.2 | 5.1 | 22 | 13 | -9 | ok |
| google/gemini-2.5-flash | google-gemini-2.5-flash | 6/10 | 8/10 | 6 | 4.5 | 22 | 6 | -16 | ok |
| google/gemini-2.5-pro | google-gemini-2.5-pro | 9/10 | 10/10 | 6.8 | 4.8 | 15 | 5 | -10 | ok |
| google/gemini-3.1-flash-lite-preview | google-gemini-3.1-flash-lite | 7/10 | 9/10 | 6.6 | 4.8 | 15 | 5 | -10 | ok |
| grok-4.7-build-fast | xai-grok-4.7-build-fast | 6/10 | 8/10 | 6.3 | 5.7 | 9 | 2 | -7 | ok |
| grok-4.7 | xai-grok-4.7 | 6/10 | 1/10 | 7.4 | 0.9 | 15 | 1 | excluded (matched 2: -1) | err B=0/R=8, matched=2 |
| meta-llama/llama-4-scout | meta-llama-4 | 3/10 | 4/10 | 9.2 | 8.7 | 63 | 57 | -6 | ok |
| openai/gpt-6.2-astra | openai-gpt-6.2 | 8/10 | 8/10 | 4.7 | 4.1 | 4 | 2 | -2 | ok |
| qwen/qwen3.7-flash | qwen-3.7 | 8/10 | 10/10 | 8.3 | 7.1 | 15 | 7 | -8 | ok |

## Eliminated Cross-Model Phantoms
| Category | Action / Expr | Baseline Count | Lineages | Refined Count |
|---|---|---:|---:|---:|
| eval | `(screen 'external-request)` | 23 | 8 | 0 |
| runtime | `add-savings` | 9 | 9 | 0 |
| validation | `reject-request` | 6 | 2 | 0 |
| eval | `(screen 'pending-requests)` | 4 | 3 | 0 |
| parse | `(screen 'activity')` | 3 | 2 | 0 |
| validation | `settle-up` | 2 | 2 | 0 |
| eval | `(help 'split-bill)` | 2 | 2 | 0 |
| unknown_action | `request-payment` | 2 | 2 | 0 |
| eval | `(screen 'pending)` | 2 | 2 | 0 |

## Reduced Cross-Model Phantoms
| Category | Action / Expr | Baseline | Refined | Delta | Lineages (Base -> Ref) |
|---|---|---:|---:|---:|---:|
| validation | `split-bill` | 10 | 1 | -9 | 8 -> 1 |
| eval | `(screen 'requests)` | 4 | 1 | -3 | 4 -> 1 |

## Residual & New Phantoms
| Category | Action / Expr | Baseline | Refined | Delta |
|---|---|---:|---:|---:|
| parse | `text-reply` | 32 | 35 | +3 |
| runtime | `pay` | 22 | 22 | 0 |
| parse | `(s` | 0 | 9 | +9 |
| parse | `(screen` | 3 | 5 | +2 |
| parse | `(sc` | 11 | 3 | -8 |
| eval | `(screen 'savings)` | 3 | 3 | 0 |
| unknown_action | `request` | 1 | 2 | +1 |
| validation | `split-bill` | 10 | 1 | -9 |
| eval | `(screen 'requests)` | 4 | 1 | -3 |
| eval | `(screen)` | 3 | 1 | -2 |
| eval | `(quote-payment "CornerCoffee" 65.00)` | 1 | 1 | 0 |
| eval | `(requests)` | 1 | 1 | 0 |
| eval | `(screen 'request)` | 1 | 1 | 0 |
| parse | `(screen 'home')` | 1 | 1 | 0 |
| parse | `(screen 'savings')` | 1 | 1 | 0 |
| eval | `(backup)` | 0 | 1 | +1 |
| eval | `(cost-of 'pay {"to":"CornerCoffee","amount_usd":65})` | 0 | 1 | +1 |
| eval | `(list (screen 'savings) (cash) (actions))` | 0 | 1 | +1 |
| eval | `(move-to-cash 50)` | 0 | 1 | +1 |
| eval | `(pending-payments)` | 0 | 1 | +1 |
