# Overbuild review: `pure/xln.ts`

Read-only review of SHA `0d3a097b782b65b08358299fa0419e65498edc57` (47,878 lines). Scope: deletion and simplification only. I used the ast-grep structural outline and declaration match, then searched exact symbols across TypeScript consumers. `pure` is a private package; the known wildcard imports use fixed property names, and no candidate below is read through one. These are proposed cuts, not applied changes.

## Cut list

- L195-205: delete: `AccountTxNames`, `LendingTxNames`, `EntityTxNames`, `AccountInputKinds`, and `EntityInputKinds` duplicate the tagged-union inventory and have zero TypeScript consumers. Derive the final transaction-kind audit from the actual union/dispatcher and update the two findings documents that cite the arrays.
- L20, L9886-9887, L12306, L41984: delete: `Eq`, `NextAccountPhase`, `AccountCases`, `NextEntityPhase`, and `Stamped` are exported type aliases with no in-file or TypeScript consumer. Nothing replaces them; keep the live `Grammar`, `Cases`, and `Next` types.
- L941-950, L1549-1552, L10137-10145: delete: `encodeFrameHash`, `readJEventVector`, `previewOpen`, and `previewAccountFrame` have no consumers and only adapt existing `accountFrameHash`, `readJEvents`, and `previewAccountProposal`. Delete the wrappers and use those canonical functions if a caller later needs the behavior.
- L3390-3396, L3398-3430: delete: `encodeHankoBytes`, `encodeBoardHanko`, and `boardVotingPower` have no consumers; their private `verdictOf` and `signatureFor` helpers exist only for this unused API island. Keep the live Hanko verification/encoding functions.
- L3704-3709, L3724: delete: `timelyRatio`, `effectiveRatio`, `deltaMove`, and `uncollateralizedCredit` have no callers. The active ratio and collateral paths already call their own concrete operations; remove these speculative convenience exports.

`net: approximately -75 to -95 source lines possible` (review estimate, not a measured diff). The order above favors isolated cuts; the Hanko island needs a compile check after deletion to confirm no indirect dynamic use.

## Strengths that should survive the cuts

- The canonical text/hash code deliberately distinguishes undefined, Map, Set, array, and object. `JSON.stringify` is not a valid replacement for that commitment logic.
- The `Result` and grammar types carry explicit refusal and phase boundaries. I found no reason to replace them with exceptions or a shared reducer.
- The transient `mapAccumResult` accumulator and immutable collection helpers have documented complexity and a style-gate exception. Native `.delete()` would violate the current mutation rule, so I did not count it as a cut.

## Before / after examples

```ts
// Before: unused fixture-shaped adapter.
export const readJEventVector = (inputs: { readonly logs: readonly ChainLog[] }): unknown => {
  const bigintsAsText = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);
  return JSON.parse(JSON.stringify(readJEvents(inputs.logs), bigintsAsText));
};
// After: remove it; callers of J-event decoding already use readJEvents(logs).
```

```ts
// Before: exported names separately restate the AccountTx union.
export const AccountTxNames = ["add_delta", /* ... */ "lending_close_payout"] as const;
// After: remove the parallel list; inspect AccountTx and its dispatcher in the final audit.
```

## Limits

No source changes or tests were run. This is a static whole-file review, so line savings are estimates. I excluded correctness, security, and speed claims from the cut list. The proposed deletions preserve runtime behavior only if this private module has no undocumented consumers outside the repository; the repo search found none.
