# Final read-only QA of corrected review

Checked current `report.md` and corrected architecture, critic, adversarial, type-hardening and defect-review files against `boundaries.log`, `contracts.log`, their source fixtures and cited `pure/xln.ts`. No test rerun or source/doc edits.

## Required correction

- `report.md`, F1 paragraph: “Neither ‘error silently discarded’ nor ‘invalid Entity commit succeeds’ describes this path” is broader than the source. `replicaJHistory` at 39023 really does silently replace a failed *early/context* prune with old history. The committing probe proves the **later** `afterCommit` prune preserves the error in `rejected` and prevents the Entity head from advancing. Suggested: “The early fallback does discard the error locally, but the committing path rechecks and records it; no invalid Entity commit succeeded.” Keep fatal-versus-reject unresolved pending old complete-Runtime comparison.

## Otherwise supported within stated bounds

- F1 committing control/head and invalid-history `advanced:true`, head 0, exact `j_prefix` rejection match `boundaries.log`. Corrected agent files withdraw P1 and preserve old Runtime disposition as unknown.
- F2 imported string then later vote `TypeError` matches `boundaries.log`; repository call search finds `withOgSections` only under `pure/diff/og-state.ts`, and genesis constructs empty maps. Current text properly avoids a persisted-ingress claim.
- F3 isolated Account same-object/no-output observation and Entity first frame open/head1 then altered retry `frame_hash_mismatch` match the log. Current text separates phase semantics and old committed retry.
- F4/F5/F6 and `NaN` map deletion observations match `contracts.log` and source. Memoization’s production alias escape and iterator-contract policy remain appropriately open.
- Wallet malformed-list parity, `ZERO_WORD` fallbacks, recovery rows, explicit WAL exclusions and selected test limits are described conditionally. No remaining production exploit is claimed from these alone.

The corrected documents do not convert missing Rust/TPS/host gates into pure-module defects. Evidence links to first reports and recheck artifacts resolve in the current tree.
