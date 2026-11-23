# Custdev-Everyday Report (dry-refined · spec=refined)

Generated: 2026-11-19T02:36:44.327Z

## Overall Metrics
- Episodes passed: **10/10** (state: 10/10, comprehension: 10/10)
- Total phantoms: **1** (0 cross-model patterns)
- Transport errors: 0
- Phantom categories: unknown_action=0, validation=0, eval=0, parse=0, runtime=1, timeout=0

## Per-Model Completion & Phantoms
| Model | Lineage | Pass | State | Comp | Avg Turns | Phantoms | unknown_action | validation | eval | parse | runtime | timeout | TransportErr |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| scripted-smoke | scripted-deterministic | 10/10 | 10/10 | 10/10 | 3.3 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |

## Per-Episode Completion
| Scenario | Pass | State | Comp | Phantoms | Breakdown |
|---|---:|---:|---:|---:|---|
| E1a_pay_across_buckets | 1/1 | 1/1 | 1/1 | 0 | none |
| E1b_pay_fee_above_cap | 1/1 | 1/1 | 1/1 | 0 | none |
| E1c_pay_l1_reject_reload | 1/1 | 1/1 | 1/1 | 1 | runtime:1 |
| E2_friends_split_and_settle | 1/1 | 1/1 | 1/1 | 0 | none |
| E3a_newcomer_arriving_and_request | 1/1 | 1/1 | 1/1 | 0 | none |
| E3b_offline_hub_keeps_arriving | 1/1 | 1/1 | 1/1 | 0 | none |
| E4_savings_optin_consent | 1/1 | 1/1 | 1/1 | 0 | none |
| E5a_external_checkout_approve | 1/1 | 1/1 | 1/1 | 0 | none |
| E5b_external_bait_reject | 1/1 | 1/1 | 1/1 | 0 | none |
| E6_offline_recovery_zero_gas | 1/1 | 1/1 | 1/1 | 0 | none |

## Top Phantom Patterns (Sorted by Frequency)
| Count | Cross-Model | Lineages | Category | Action / Expr | Sample Error |
|---:|---|---:|---|---|---|
| 1 | no | 1 | runtime | `pay` | Auto-route L1 sweep rejected — your Cash was not touched. |

## Sample Post-Mortems
### E1c_pay_l1_reject_reload — scripted-smoke (passed=true, phantoms=1)
1. Yes, exported encrypted backup.
2. 0 ETH network gas.
3. Cannot start a fresh user-initiated withdrawal with 0 gas; watchtower still guards stale claims.

