**Ponytail audit — xln.ts only — second-pass adjudication**

This correction is written by the primary reviewer, not presented as a new statement from the original agent. The complete [original reviewer report](../evidence/first-review/agents/ponytail-audit.md) is retained for comparison. Scope remains read-only at `0d3a097b782b65b08358299fa0419e65498edc57`; production source is unchanged.

The named static cut candidates survive repository TS consumer checks, with an exported-API caveat. This does not prove external or dynamic consumers absent. The claimed aggregate of **31** one-reference exports was not independently reproduced from an enumerated rule/list and is withdrawn as a measured result. The 38–47-line saving was an estimate, not a diff.

- The five arrays at 195–205 (`AccountTxNames`, `LendingTxNames`, `EntityTxNames`, `AccountInputKinds`, `EntityInputKinds`) have no observed TS consumers. Preserve final transaction-kind completeness by inspecting actual unions/dispatchers; update documentation references.
- `Eq`, `NextAccountPhase`, `AccountCases`, `NextEntityPhase` have no observed TS consumers. Deletion would remove exported types, not preserve their API.
- `encodeFrameHash`/`AmountTx` and `readJEventVector` are unused adapter candidates. Their substitutes have different inputs/results: throwing/Result behavior and JSON-stringified BigInts differ. Remove unused adapters; do not claim drop-in equivalence.
- Runtime local-map passes repeatedly copy. Owned builders might preserve order if all dependent reads use the working map. No 8–15-line or performance saving is established; mutation/style exemptions and exact behavior need validation.

**Withdraw the generic native mapDelete recommendation.** Current filtering uses `!==`; native Map.delete uses SameValueZero. The new probe gives existing size 2 versus native size 1 when deleting NaN. This disproves generic equivalence without proving a legal protocol NaN key exists. A conditional non-NaN key contract would be required. Native mapSet retains ordinary native Map replacement order, but has no measured saving here.

Example safe direction: remove a named declaration after consumer/API checks, then compile and run its focused compatibility check. Keep serializers, Result/grammar and the privately owned accumulator.

Evidence and current priorities: [corrected synthesis](../report.md).
