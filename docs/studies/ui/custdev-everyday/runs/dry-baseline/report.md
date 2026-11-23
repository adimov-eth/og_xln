# Custdev-Everyday Report (dry-baseline · spec=baseline)

Generated: 2026-11-19T02:36:42.861Z

## Overall Metrics
- Episodes passed: **9/10** (state: 9/10, comprehension: 10/10)
- Total phantoms: **2** (0 cross-model patterns)
- Transport errors: 0
- Phantom categories: unknown_action=1, validation=0, eval=0, parse=0, runtime=1, timeout=0

## Per-Model Completion & Phantoms
| Model | Lineage | Pass | State | Comp | Avg Turns | Phantoms | unknown_action | validation | eval | parse | runtime | timeout | TransportErr |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| scripted-smoke | scripted-deterministic | 9/10 | 9/10 | 10/10 | 3.3 | 2 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |

## Per-Episode Completion
| Scenario | Pass | State | Comp | Phantoms | Breakdown |
|---|---:|---:|---:|---:|---|
| E1a_pay_across_buckets | 1/1 | 1/1 | 1/1 | 0 | none |
| E1b_pay_fee_above_cap | 1/1 | 1/1 | 1/1 | 0 | none |
| E1c_pay_l1_reject_reload | 1/1 | 1/1 | 1/1 | 1 | runtime:1 |
| E2_friends_split_and_settle | 1/1 | 1/1 | 1/1 | 0 | none |
| E3a_newcomer_arriving_and_request | 0/1 | 0/1 | 1/1 | 1 | unknown_action:1 |
| E3b_offline_hub_keeps_arriving | 1/1 | 1/1 | 1/1 | 0 | none |
| E4_savings_optin_consent | 1/1 | 1/1 | 1/1 | 0 | none |
| E5a_external_checkout_approve | 1/1 | 1/1 | 1/1 | 0 | none |
| E5b_external_bait_reject | 1/1 | 1/1 | 1/1 | 0 | none |
| E6_offline_recovery_zero_gas | 1/1 | 1/1 | 1/1 | 0 | none |

## Top Phantom Patterns (Sorted by Frequency)
| Count | Cross-Model | Lineages | Category | Action / Expr | Sample Error |
|---:|---|---:|---|---|---|
| 1 | no | 1 | runtime | `pay` | Auto-route L1 sweep rejected — your Cash was not touched. |
| 1 | no | 1 | unknown_action | `request-link` | Unknown action 'request-link'. Available actions: pay, cash-out, split-bill, settle-up, ad |

## Sample Post-Mortems
### E1c_pay_l1_reject_reload — scripted-smoke (passed=true, phantoms=1)
1. Yes, exported encrypted backup.
2. 0 ETH network gas.
3. Cannot start a fresh user-initiated withdrawal with 0 gas; watchtower still guards stale claims.

### E3a_newcomer_arriving_and_request — scripted-smoke (passed=false, phantoms=1)
1. Yes, exported encrypted backup.
2. 0 ETH network gas.
3. Cannot start a fresh user-initiated withdrawal with 0 gas; watchtower still guards stale claims.

