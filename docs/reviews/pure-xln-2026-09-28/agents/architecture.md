**Architecture — second-pass adjudication**

This correction is written by the primary reviewer, not presented as a new statement from the original agent. The complete [original reviewer report](../evidence/first-review/agents/architecture.md) is retained for comparison. Scope remains read-only at `0d3a097b782b65b08358299fa0419e65498edc57`; production source is unchanged.

The R → E → A call cascade and inert Runtime outputs remain supported by source inspection. Replica coordination fields are separate from bilateral financial state; frame sealing hashes ordered outputs. These are useful architectural choices, not a proof of complete purity or recovery correctness.

The original **P1 J-history finding is withdrawn as stated**. `afterCommit` at xln.ts:28249 propagates prune failure, and `applyEntityInput` at 29075 invokes it on head advancement. The new committing probe leaves Entity head at 0 and records the exact prune error in Runtime `rejected`; Runtime advances its own frame. The first idle probe never exercised a commit. A full original-Runtime disposition comparison remains unperformed. Do not apply the originally proposed early-failure patch on this evidence.

The WAL compatibility exclusions are real: scenario.test.ts excludes row `frameHash` and checkpoint-frame `postStateHash`. Absence of a filesystem/WAL host inside a pure module is appropriate; it is an integration evidence limit rather than a defect or P1. No observed core/frontend/scripts import made this module the production path at the reviewed revision.

Recovery without `rows` fails verification in the existing transport-retirement case. That is a bounded recovery-contract limitation, not silent corruption. Before requiring a new argument, identify which authoritative retained outbox records provide the needed evidence; do not invent another durable representation. Example proposed contract clarification: document that replay after transport retirement requires the exact retained output evidence used by the original run.

The fixture signer supports real keys and a fake fallback for unknown addresses. Its existence is test infrastructure, not evidence production uses fake signatures. No proposed architecture change was implemented or proven by crash testing.

Evidence and current priorities: [corrected synthesis](../report.md).
