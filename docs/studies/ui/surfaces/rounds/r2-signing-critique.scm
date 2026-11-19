;; r2-signing-critique.scm — empirical Round-2 signing-sheet critiques (63 blind subscription runs, 3 frontier lineages).
;; Targets converged root nodes in personal.scm & forks.scm while citing perspectives/p1..p4 and probes/report-signing.md.

(critique 'r2-kill-p4-unconditional-warnings
  :author  "gemini-round2-sweep"
  :target  'f8-signing-sheet-dispatch
  :stance  'agree
  :why     (sweep "docs/studies/ui/surfaces/probes/runs-signing/summary-frontier.json" "Printing all 4 risk warnings unconditionally (p4 kernel-intent-firewall, C5) caused 5 of 7 evaluators — including grok-4.7 and gemini-pro — to REJECT a legitimate 25.00 USDC coffee checkout because the collateral-to-promise warning contradicts 0.00 USDC unbacked delta.")
  :sources ["docs/studies/ui/surfaces/probes/report-signing.md" "docs/studies/ui/surfaces/perspectives/p4-steward-redteam.scm"])

(critique 'r2-fix-p1-spend-survival-finality
  :author  "gemini-round2-sweep"
  :target  'sheet-spend
  :stance  'agree
  :why     (sweep "docs/studies/ui/surfaces/probes/runs-signing/summary-claude-flagship.json" "Using one static claimable-collateral survival sentence on an outbound 25.05 USDC payment (p1 kernel-sheet, C6) misled both grok-4.7 and claude-flagship on Q4 into stating spent coffee money can still be claimed back; sheet-spend's finality sentence resolved 3/3 Frontier Q4 answers on C7.")
  :sources ["docs/studies/ui/surfaces/probes/report-signing.md" "docs/studies/ui/surfaces/perspectives/p1-consumer.scm"])

(critique 'r2-fix-p2-verb-dispatch-swap-leak
  :author  "gemini-round2-sweep"
  :target  'sheet-exposure
  :stance  'amend
  :why     (sweep "docs/studies/ui/surfaces/probes/runs-signing/summary-cli.json" "Routing instant-swap by verb to quiet sheet-spend (C3) fooled 2 of 3 fast/skimmer evaluators (claude-haiku, gemini-flash-lite -> APPROVE, 0 risk) when trading -1,000 USDC collateral for +1,005 USDT unbacked debt inside an already-open credit limit; escalating to sheet-exposure whenever deriveDelta yields deltaUnbackedRisk > 0 (C4) achieved 7 of 7 REJECT.")
  :sources ["docs/studies/ui/surfaces/probes/report-signing.md" "docs/studies/ui/surfaces/perspectives/p2-sovereign.scm"])

(critique 'r2-adopt-p3-per-lane-and-hanko-proposal
  :author  "gemini-round2-sweep"
  :target  'sheet-treasury-admin
  :stance  'agree
  :why     (sweep "docs/studies/ui/surfaces/probes/runs-signing/summary-frontier.json" "p3 desk-sign achieved 7 of 7 REJECT on both hidden-fee-drain (245.00 USDC maxSenderDebit ceiling, C8) and stalled-hub-trap (365-day lockup, C9), and uniquely contributes per-lane batch rows plus Hanko sub-threshold proposal clarity ('only queues a proposal; no money has moved').")
  :sources ["docs/studies/ui/surfaces/perspectives/p3-commercial.scm" "docs/studies/ui/surfaces/probes/report-signing.md"])
