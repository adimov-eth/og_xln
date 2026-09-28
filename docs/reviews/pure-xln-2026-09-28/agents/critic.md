**Critic — second-pass adjudication**

This correction is written by the primary reviewer, not presented as a new statement from the original agent. The complete [original reviewer report](../evidence/first-review/agents/critic.md) is retained for comparison. Scope remains read-only at `0d3a097b782b65b08358299fa0419e65498edc57`; production source is unchanged.

Sampled differential evidence is substantial. Existing tests compare old canonical encoders, randomized roots, 80 sampled Account sequences and 400 retained-outbox cases. The old core/jurisdictions sources are unchanged from the declared baseline 566c850 at the reviewed SHA. Seeds are reproducible through SEEDX.

The original strongest objection treated a locally discarded prune error as sufficient evidence for a P1 Runtime finding. That priority is withdrawn. A later post-commit guard was missed. The new Runtime probe records the failure, preserves Entity head 0 and advances the Runtime frame with a rejection. This was a review error, not a discovered protocol exploit. A held retry also needs to be distinguished from Entity handling, which acknowledges immediately and rejects altered retries.

The claim “full compatibility” is too broad without specifying whether it means financial transitions, exact errors/effects, durable bytes or complete host integration. The original review overreached by treating production WAL/live J/Rust/TPS requirements as necessary to assess every pure-module compatibility claim. These are separate acceptance scopes.

114 test passes are not 114 parity proofs. The hashes.test.ts:614 `DIVERGES` test checks old-root sensitivity, without calling the rewrite in that test; its title is stale evidence for the current full Entity-root path. Some tests compare projections or normalized errors; account-consensus.test.ts:545 masks a differing hash. The optional-leaf randomized test skips settlement-workspace cases, while other tests cover related fields. Example correction: name the actual compared subset and exclusion in the test description.

“Illegal states impossible” should be read as specific static guarantees after validation, not a global statement. Negative compiler probes now confirm three such guarantees. The measured source is 47,878 lines; the old report's “43k” was wrong. Missing evidence is uncertainty, not evidence of a defect.

Evidence and current priorities: [corrected synthesis](../report.md).
