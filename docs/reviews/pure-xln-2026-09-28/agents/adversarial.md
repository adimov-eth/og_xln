**Adversarial — second-pass adjudication**

This correction is written by the primary reviewer, not presented as a new statement from the original agent. The complete [original reviewer report](../evidence/first-review/agents/adversarial.md) is retained for comparison. Scope remains read-only at `0d3a097b782b65b08358299fa0419e65498edc57`; production source is unchanged.

`decodedEntries` at xln.ts:32502 accepts non-array wallet lists as empty, and normalization can omit those fields. **Old event-normalizers-wallet.ts does the same.** No malformed on-chain receipt or complete hostile watcher delivery was demonstrated. This is a shared malformed-input policy question, not a rewrite regression or an unconditional P2. Rejecting non-arrays only in pure would change malformed-input parity.

Example proposed change, conditional on a shared policy decision: return a decoding refusal for a non-array supplied list and verify the same disposition through the canonical event boundary in both implementations. Do not change the old implementation merely to manufacture parity.

The `ZERO_WORD` substitutions at 27007–27008 are real. They concern failed encoding of rebalance-policy/submittedAt roots. No legal admitted transaction, complete corrupt-recovery trace or equivalent old-runtime case producing that failure was shown. Retain this as a conditional fail-soft concern. Returning a Result from the leaf builder is a possible correction only after establishing the invariant and failure disposition.

`liveLadder` can ignore a failed claim merge, but reachable conflicting admitted claims were not demonstrated. Hanko decoding has canonical re-encoding/nonempty-claim checks after `NO_HANKO`; the reviewed path did not demonstrate forgery. J-range and Hanko code visibly contain ordering, hash, quorum and authority checks. These are bounded observations of checks, not security certification or proof every hostile case is rejected.

Evidence and current priorities: [corrected synthesis](../report.md).
