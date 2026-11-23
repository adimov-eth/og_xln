;; apps.scm — programs that work through the kernel and belong to no surface.
;; An app reads what the person lets it read and proposes actions under its own grant; every signature
;; goes through the kernel's question (d-kernel-app-door), and until the runtime enforces grants every
;; proposal is asked (d-kernel-app-launch). Decisions here start with d-apps-. Nothing here is settled.

;; ─────────────────────────────────────────────────────────────────────────────
;; Decisions
;; ─────────────────────────────────────────────────────────────────────────────

(decision 'd-apps-which-jobs
  :question "Which jobs across the four surfaces are better served by an app than by a surface?"
  :options {:surfaces-carry-all "Every job of the four people is carried by a surface. The only app is Desk, which is out of scope."
            :other-clock-or-outsider "A job goes to an app when it runs on a different clock than the person (a trading program, a hub console), serves someone who is not one of the four people (an auditor), or would pull one surface into running the whole machine (market depth and charts, borrowing that two surfaces refused)."
            :all-but-money-and-safety "Everything except holding, paying, being paid, leaving and keeping copies is an app."}
  :forces {:other-clock-or-outsider ['d-apps-borrowing]}
  :depends ['d-kernel-how-many 'd-kernel-app-door]
  :decider 'user
  :leaning 'other-clock-or-outsider
  :because (as-said 'wallet-over-apps "The wallet operates over apps, and Desk is one of them. The surfaces already pushed some jobs out: the trader declared its trading program a gap and left depth and charts to apps, and the institution chose to hand the auditor a record instead of a seat. Carrying those inside a surface would bring back one interface that does everything. Moving everything else out would leave each surface too thin to finish its own jobs, and every app that carries a launch flow still has to be built in both wallets with its own tests.")
  :changes-if "An app that carries a launch flow cannot get parity and owning tests in both wallets in time, so it has to return to a surface; or people of one kind keep switching to an app in the middle of a job their own surface was meant to finish.")

(decision 'd-apps-borrowing
  :question "Borrowing is part of the Lending launch flow, but the private and trader surfaces declared it a gap, the institution refuses it and the operator carries only the lender's side. Who carries it?"
  :options {:borrowing-app "One borrowing app, opened from the private or trader face, on EVM and native TRON. Every request goes through the kernel's question, where borrowing always asks."
            :trader-surface "The trader surface carries borrowing, reversing its gap."
            :private-surface "The private surface carries borrowing, reversing its gap."
            :savings-is-enough "The maintainer rules that savings, plus a hub setting its lending terms, satisfy the Lending launch flow at launch."}
  :forces {:borrowing-app ['d-apps-borrowed-where]}
  :depends ['d-apps-which-jobs]
  :decider 'maintainer
  :leaning 'borrowing-app
  :because (canon 'lending-reopened "Lending reopens the existing bank, facility, term-loan and savings product through both wallets, with exact money, authority, deadlines and recovery; a term loan is borrowing, and launch-flows forbids leaving a flow out silently. Both surfaces that could carry it refused for a reason that holds: a loan makes the person owe the hub, a risk the private person did not come for, and mixing borrowed money into a trader's own money is the blended balance the trader surface refuses. An app keeps the act of borrowing out of their main work, so a person who never opens it never borrows, while every request still meets the kernel's floor. Where the resulting debt shows is a separate choice, d-apps-borrowed-where.")
  :changes-if "The maintainer says a launch flow must live inside a surface, or that savings alone satisfies Lending at launch; or private people ask for small loans more often than for savings.")

(decision 'd-apps-borrowed-where
  :question "When a person borrows through the borrowing app, where does the debt show in their own face?"
  :options {:blended "In the face's figures for the account, among what I owe with nothing locked."
            :separate-line "In the face, as a line of its own (borrowed, from whom, due when, and what leaving would make due at once), never added into what I hold or owe on the account."
            :app-only "Only in the borrowing app; the face shows nothing of it except through the kernel's leaving sums."}
  :depends ['d-apps-borrowing 'd-kernel-words]
  :decider 'user
  :leaning 'separate-line
  :because (protocol "core/protocol/dispute/lending-covenant.ts" "A loan is a signed agreement held beside the account's balance, not part of it, and leaving makes principal plus earned interest due at once, with the amount fixed when the leaving starts. So 'blended' is not only the mix the trader refuses; it is also numerically wrong, because the account's owed figures do not contain the loan. 'App only' hides from the face a claim that its own leaving question must state. A separate line keeps the debt visible without mixing it into money the person holds.")
  :changes-if "The user rules that the private and trader faces must never show a debt, in which case borrowing cannot be opened from them; or people shown the separate line read it as money they have.")

;; ─────────────────────────────────────────────────────────────────────────────
;; Apps
;; ─────────────────────────────────────────────────────────────────────────────

(app 'app-desk :for ['operator]
  :through ['k-runtime-link 'k-app-door 'k-question 'k-holdings]
  :does (as-said 'wallet-over-apps "Desk, an operator's console that works through the kernel like any other app. Out of scope: this spec designs nothing inside it.")
  :because ['d-apps-which-jobs 'd-kernel-app-door])

(app 'app-market-depth :for ['trader]
  :through ['k-market-read 'k-holdings 'k-app-door 'k-question]
  :does (guess "Shows depth and price history for a pair across the trader's hubs, and lets the trader propose an order from there. The order goes through the same question and per-hub limits as the trader surface's own ticket.")
  :because ['d-apps-which-jobs 'd-kernel-app-door])

(app 'app-trading-program :for ['trader]
  :through ['k-app-door 'k-standing-rules 'k-market-read 'k-record 'k-silence 'k-batch 'k-attention]
  :does (guess "Runs the trader's own program under a grant the trader set for it: which hubs, which pairs, how much in total, until when. Until the runtime enforces that grant, every order it proposes is asked; afterwards, orders inside the grant are signed at once. The trader sees every signature it caused. Stopping it prevents new proposals and asks each hub to cancel its open orders in one batch; until each hub acts, those orders stay held and can still fill, and the trader is shown what remains. Withdrawing orders without a hub's help means starting to leave that hub, which is asked separately.")
  :because ['d-apps-which-jobs 'd-kernel-app-door 'd-kernel-app-launch 'd-kernel-consent])

(app 'app-borrowing :for ['private 'trader]
  :through ['k-effect 'k-question 'k-holdings 'k-app-door 'k-attention 'k-leaving-sums 'k-evidence 'k-silence]
  :does (guess "Asks a hub for a loan, stating the most interest and lateness accepted, shows the loan's terms and deadlines, and repays it, on EVM and native TRON alike. Before the request it states what leaving that hub would then make due at once, and whether a kept copy can act for that account; on native TRON none can, and the request says so under d-kernel-not-covered. The debt shows in the person's face as d-apps-borrowed-where settles, and each due date appears in the kernel's list of deadlines as one that costs money when missed.")
  :because ['d-apps-borrowing 'd-apps-borrowed-where 'd-kernel-consent 'd-kernel-not-covered])

(app 'app-audit-check :for ['institution]
  :through ['k-record]
  :does (guess "The auditor's program. It reads only the record the organisation exported for a period, in the kernel's record format, and checks it against the signed history. It has no connection to the organisation's runtime and signs nothing.")
  :because ['d-apps-which-jobs])
