**Overbuild — second-pass adjudication**

This correction is written by the primary reviewer, not presented as a new statement from the original agent. The complete [original reviewer report](../evidence/first-review/agents/overbuild.md) is retained for comparison. Scope remains read-only at `0d3a097b782b65b08358299fa0419e65498edc57`; production source is unchanged.

The named deletion candidates have no observed repository TS consumers. They remain **candidates**, not an applied or verified deletion patch. Private package metadata does not prove external source imports absent. The 75–95-line saving is withdrawn as a measured result; it overlaps the ponytail list.

- Five kind-name arrays at 195–205; aliases `Eq`, `NextAccountPhase`, `AccountCases`, `NextEntityPhase`, `Stamped`.
- Adapters `encodeFrameHash`/`AmountTx`, `readJEventVector`, `previewOpen`, `previewAccountFrame`.
- Hanko helper island `encodeHankoBytes`, `encodeBoardHanko`, `boardVotingPower`, with private `verdictOf`/`signatureFor` only if the entire unused island is removed.
- Helpers `timelyRatio`, `effectiveRatio`, `deltaMove`, `uncollateralizedCredit`; keep the live ratio/collateral operations.

Adapter contracts are not identical to their underlying functions: JSON-shaped J-event output differs from typed BigInts; throwing differs from Result; phase-narrowed preview and frame projection differ from the general preview result. Example: deleting unused `readJEventVector` is a surface reduction, while replacing a real caller with `readJEvents` requires changing that caller's expected contract.

Canonical serializers distinguish non-JSON values; plain JSON.stringify is not a replacement for commitment encoding. Result/grammar and the private mapAccumResult accumulator are worth preserving. An unmeasured owned-map optimization is not a deletion saving. A compiler pass after a cut cannot prove no dynamic/external consumers; it only checks the compiled repository.

Evidence and current priorities: [corrected synthesis](../report.md).
