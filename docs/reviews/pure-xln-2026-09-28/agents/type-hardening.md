**Evidence-driven type hardening — second-pass adjudication**

This correction is written by the primary reviewer, not presented as a new statement from the original agent. The complete [original reviewer report](../evidence/first-review/agents/type-hardening.md) is retained for comparison. Scope remains read-only at `0d3a097b782b65b08358299fa0419e65498edc57`; production source is unchanged.

`importMap<V>` at xln.ts:13039 checks only Map-ness. The compiler accepts a string-valued proposal map via `withOgSections`; runtime imports it as `StoredProposal`. The second probe reaches a later yes-vote path and throws a TypeError while spreading missing votes. This is a confirmed API type-contract defect.

“Persisted authority” and “high priority” were too strong without identifying exposure. The observed `withOgSections` caller is pure/diff/og-state.ts; normal in-module Runtime genesis constructs empty maps. No untrusted persisted-record route was demonstrated. Example correction: either decode complete keys/records/votes at a genuinely untrusted importer, or require trusted typed sections for an internal adapter. Preserve valid representation and insertion order.

The old report's TypeScript **6.0.2** attribution has no retained version transcript and is withdrawn as relied-on evidence. Primary fixtures and the second audit compile under verified **5.9.3**, strict, exactOptionalPropertyTypes and noUncheckedIndexedAccess. The original basic alias demo and the newer stale-cache demo prove different things: readonly permits a mutable alias; identity memoization additionally assumes that alias never mutates. No canonical constructor leak was established. Do not prescribe deep copies everywhere.

Empty-string `Hash` casts at 2188 and 33892 grant authority prematurely, but claim validation downstream was found. An explicit transitional sentinel type could be more honest if that sentinel is required for parity; no invalid certified claim was shown.

Phase modeling has verified value: a proposed Account needs a candidate and a handler cannot return a destination excluded by its table. Three new negative compiler checks test specific guarantees. The grammar dispatcher still accepts broad replica unions; structural TS types do not forbid every extra property. No illegal transition through the canonical path was found.

DisputedAccount optional facts may overlap legally; CrossRoute fields describe a persisted schema. Stronger unions need actual legal-history evidence. Example: do not replace independent disputed `start`/`active`/`queued` fields with an exclusive union merely because it looks cleaner.

Evidence and current priorities: [corrected synthesis](../report.md).
