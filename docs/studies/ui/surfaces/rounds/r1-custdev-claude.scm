;; r1-custdev-claude.scm — critiques from custdev round 1 (docs/studies/ui/custdev-r1/report.md).
;; 24 valid episodes, 5 model lineages, no persona. A failure here shows a cold reader can be misled; it says nothing about people.

;; Amended 2026-11-19. The first version said the label inverts. That run showed the label bare.
;; The shipped Home prints "Repayment depends on the other party." under it; with that line the inversion was 3 of 27, one lineage.
;; The objection now is to the spec, which holds the label and drops the note.
(critique 'r1-without-collateral-inverts
  :author  "claude-fable-5-2"
  :target  'personal/home
  :stance  'amend
  :why     (sweep "docs/studies/ui/custdev-r1/runs-v3-notes/summary.json" "Bare, 'Without collateral: 100.00' was read as freely withdrawable in 11 of 23 answers across 4 of 5 lineages. With the shipped note under it, 3 of 27, all one lineage, all with a Balance line above. The term needs its note; the label alone is not what the wallet shows.")
  :sources ["docs/studies/ui/custdev-r1/report.md" "docs/studies/ui/surfaces/AS-IS.md" "ui/src/components/home/BalanceDetails.tsx"])

(critique 'r1-secured-first-hides-fee
  :author  "claude-fable-5-2"
  :target  'f6-home-headline
  :stance  'amend
  :why     (sweep "docs/studies/ui/custdev-r1/runs/summary.json" "Question 1 was right in 6 of 9 secured-first and 6 of 14 total-first episodes, but the cover fee was noticed in 2 of 9 against 9 of 14: without a total the drop from 100.00 to 99.89 is not visible. Cells are small and unbalanced.")
  :sources ["docs/studies/ui/custdev-r1/report.md" "docs/studies/ui/custdev-r1/expect.md"])

(critique 'r1-cover-done-not-understood
  :author  "claude-fable-5-2"
  :target  'personal/cover
  :stance  'object
  :why     (sweep "docs/studies/ui/custdev-r1/runs/summary.json" "After covering, 9 of 21 answers still said the money is lost if the company disappears, including 6 of 6 from one lineage; the flow states no fee before the action.")
  :sources ["docs/studies/ui/custdev-r1/report.md"])
