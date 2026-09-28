**Defect-first review — GPT-6-Sol Medium**

Review target: the current whole file at `0d3a097b782b65b08358299fa0419e65498edc57`. No base diff was requested. This report is assembled by the primary reviewer from the review agent's returned findings; the agent made no file changes.

**[P2] Reject altered retries of a held Account frame — pure/xln.ts:10772**

`proposalOnReceived` accepts a retry when its claimed `stateHash` matches the held frame. The preceding receipt check verifies the Hanko against that claim, but does not recompute the hash or compare the Hanko with the cached one. A peer can alter the frame body while retaining the old hash and signature, and the retry is silently accepted. The canonical replay path at `core/account/consensus/incoming/replay.ts:145` rejects changed duplicate bytes and Hankos. This finding is present at the reviewed SHA; it is not attributed to an unspecified recent diff.

Proposed guard, inside the existing retry branch:

```ts
const valid = acceptFrame(input.frame, replicaId(r), other(ctx.party.left));
if (!valid.ok) return valid;
if (!sameHex(input.frameHanko, r.candidate.frameHanko))
  return err({ _tag: "ack_conflict", field: "frameHanko" });
```

Retain the existing hash comparison and cached evidence after these checks. Verify the exact returned rejection at the caller before implementing this sketch.

The existing differential test covers a duplicate committed frame, but not a retry while a frame is held. The sampled Account and Entity paths showed explicit candidate handling and per-transaction eviction. The agent did not run tests and found no other substantiated defect in its sampled paths.

Primary verification: a real-key fixture changed a held frame's credit limit from 7 to 999 without updating its hash/signature. Recomputed hash differed; `applyAccountInput` returned success. The cached candidate remained unchanged. This proves erroneous acceptance, not altered financial commitment. See the main report and `../evidence/repros.log`.
