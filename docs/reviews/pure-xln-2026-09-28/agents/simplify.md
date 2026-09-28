**Simplify — second-pass adjudication**

This correction is written by the primary reviewer, not presented as a new statement from the original agent. The complete [original reviewer report](../evidence/first-review/agents/simplify.md) is retained for comparison. Scope remains read-only at `0d3a097b782b65b08358299fa0419e65498edc57`; production source is unchanged.

`RefreshMigration` at 9783 permits `reason: "issued"` without both issued fields. The inspected issued producer supplies both. A union view could encode that producer's rule, but the old persisted type also declares these fields optional; stored history was not validated. Example candidate shape: issued requires height/hash; unissued forbids them with `?: never`. This is conditional on existing valid combinations, not permission to cast historical records or silently migrate them. Two constructors may add code rather than simplify it.

The hash-to-canon fallback sites (`frameIdOf`, `jPrefixKey`, `laneKey`) exist. `mergeEntityInputs` already returns Result, so error plumbing is possible. But no complete malformed-input vector establishes an externally visible divergence from old code. Mapping failures can change merge keys, first rejection and error types. Treat the original “two identities” phrase as a description of fallback mechanisms, not proof of two certified identities or an exploit. Example next step: a named malformed frame/attestation probe through the merge boundary before proposing a Result-threading patch.

`frameTxMessages` returns `[]` when its applyAccountBody fold fails. `acceptReceived` calls it after installing the candidate. No otherwise valid admitted candidate triggering this failure was reproduced; therefore a dropped-output defect is **unproven**. Returning Result would require different transaction plumbing and possibly failure precedence; prove the legal failure case first.

The reasons to retain several structures survive: Lane slots carry distinct phases, Account replica variants have different obligations, disputed facts may overlap, SubmitJournal fields participate in journalFingerprint, and HostChange.changed is consumed as progress information rather than simple object identity. No blanket flattening/deletion is justified by their appearance.

These are targeted modeling and failure-contract questions. The original report's “three grounded changes” should read “three grounded observations with conditional proposals”; implementation compatibility has not been established.

Evidence and current priorities: [corrected synthesis](../report.md).
