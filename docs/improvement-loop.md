# XLN improvement loop

Owner authorization: 2026-09-18. Objective: move the current requested release
toward usable, financially correct XLN, under the long-term MML ambition.
This is one working procedure, not a new runtime, agent framework or product gate.

Owner steering after the first review: prioritize working pay/swap and clients;
do not spend work blocks refining this document. Borrow the limited analogy of
prediction-error learning: state an expected outcome, then update the hypothesis
from the observed discrepancy ([Schultz et al.](https://pubmed.ncbi.nlm.nih.gov/9054347/)).
Use small candidate changes and preserve those with demonstrated benefit; avoid
repeated low-yield polishing, consistent with the diminishing-returns observation
in [Wiser et al.](https://pubmed.ncbi.nlm.nih.gov/24231808/). These are engineering
heuristics inspired by research, not evidence that an agent reproduces a brain
or that software quality follows a biological law. No additional framework.

## Execute

1. State one user-visible outcome, its observable acceptance result, and first
   failure. Current outcome: native iPhone scan → review → pay → real receipt.
2. Choose work in order: active user deliverable; its financial/correctness
   blocker; another independent acceptance gap if externally blocked; proven
   simplification of the same path. Do not drift into unrelated cleanup.
3. Before adding code, inspect whether deleting a duplicate or using the existing
   canonical path preserves the behavior. Fewer lines are not proof of improvement.
4. Change the smallest cause; rerun the failing production boundary. Inspect
   rendered evidence as well as assertions. A green test cannot overrule a visible
   defect. Correct the defect or record the remaining limitation explicitly.
5. Broaden checks only for a new change, new failure or remaining release gate.
   Record an artifact, not claims of work performed. Keep financial correctness,
   deterministic behavior and recoverability as hard constraints.

## Reflect without displacing execution

Every ten minutes, retain a brief observation in the existing work plan or task:
outcome, new evidence/artifact, first failure, next action. No separate diary.
After two attempts with the same failure and no new evidence, change the
hypothesis or observation method. Do not just restart the same command.

Every thirty elapsed minutes, review the last three observations. Limit this
review, including one bounded Quorum consultation, to five minutes. The question
must identify a real decision and an immutable evidence packet. Ask for the
strongest counterexample and one next useful action; verify the answer locally.
No new evidence/decision means no external call. No recursive reviews of reviews.
No additional subagents or overlapping writers are implied by this procedure.

Keep or change at most one working-method rule. Name what observation would make
the change useful and what would reverse it. Check the next two work blocks for
directional evidence, not statistical proof or an invented productivity uplift.
If the current method works, retain it; novelty is not a requirement.

Known external blockers are rechecked at most once per thirty minutes, or when
the owner/tool supplies a change signal. A known unresolved owner decision does
not become authorization with elapsed time. Poll live jobs using their existing
handle and a sensible bounded interval, not a sequence of five-second peeks.

## Measure outcomes

Track verified acceptance gaps closed and reopened, elapsed time to a usable
artifact, waiting/review overhead and confirmed cost versus unresolved reserves.
Compare like-for-like tasks; do not reward commits, lines, test count or model
agreement. Simplification requires unchanged accepted behavior and less actual
duplication or a measured operational benefit.

If reporting /1000, freeze the named milestone's criteria and weights before
work, link evidence for every earned point, and show unknown criteria separately.
It is evidence coverage, not objective product quality, GDP share or a model's
intelligence. Do not renormalize around blockers. UX judgments remain labeled
subjective and cannot replace payment/recovery/security acceptance.

MML ultimately needs external adoption evidence: returning users and merchants,
funded bilateral lines, defaults/losses and useful unique settled economic value.
Test tokens, self-payments, routed hops and replay throughput do not count as
GDP or market demand. Current work demonstrates local release capabilities only.

## Quorum and spending

Use the existing shared Quorum ledger and authorization; no new budget is created
by a review or an hour boundary. Unknown charges keep their reservation. Current
verified dispatcher: pi → Z.AI Coding Plan / GLM-5.3 low. Claude Code 2.1.259 is
installed and authenticated, but an independently bounded Claude dispatch through
this shared accounting path is not established. Do not call it unmetered or turn
this gap into an unrelated adapter project. Prefer the working guarded route.

Hourly owner report: what shipped or was fixed, exact evidence, what remains
unproven, useful next action, and known/unknown time and external cost.

First method review: `method-review-20260918-01`, one guarded GLM response, no
retry; USD0.25 reserved, cash unknown. Accepted: cap blocker polling and treat
visual evidence independently of green tests. Rejected: automatically abandon
a task on any screenshot disagreement; a small visible defect should be fixed
when within scope. Two-block comparisons are observations, not significance.
