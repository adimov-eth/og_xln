**Defect review — second-pass adjudication**

This correction is written by the primary reviewer, not presented as a new statement from the original agent. The complete [original reviewer report](../evidence/first-review/agents/defect-review.md) is retained for comparison. Scope remains read-only at `0d3a097b782b65b08358299fa0419e65498edc57`; production source is unchanged.

The local observation at xln.ts:10772 survives: a held `ReceivedAccount` accepts a frame whose body changed from credit limit 7 to 999 while preserving the original signed hash. The new assertion proves it returns the **same replica object and no outputs**. It does not apply changed economic data.

The original P2 priority is lowered to a standalone Account-API edge case. A normal `applyEntityInput` accepts and acknowledges the first frame in the same transaction, leaving the child `open` at head 1. The changed retry is then rejected with `frame_hash_mismatch`. `signReceived` and `answerFrame` explain the containment. Priming can also use transient received states; no externally visible bypass through it was established.

A possible standalone Account-API correction is to call `acceptFrame(input.frame, replicaId(r), other(ctx.party.left))` before returning the cached replica. This sketch was not applied. The added Hanko-equality guard in the original review has no complete held-phase compatibility vector, so it is not an endorsed ready-to-apply fix. Compare unchanged/body-changed/hash-changed/certificate-changed cases and exact error precedence before changing the contract.

The old committed retry handler is a different phase, so it supports the importance of evidence identity but does not prove what a corresponding old held phase must do. The possible missing ACK claim is likewise unproved. Candidate ownership and selected per-transaction eviction handling were positive sampled observations, not an exhaustive safety review.

Evidence and current priorities: [corrected synthesis](../report.md).
