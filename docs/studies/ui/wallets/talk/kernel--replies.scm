;; talk/kernel--replies.scm — the kernel and apps author answers every objection aimed at kernel.scm and apps.scm.

;; ── canon lens ───────────────────────────────────────────────────────────

(reply 'r-kernel-canon-1 :by "opus-kernel" :to 'o-kernel-canon-1 :stance 'amend
  :because (canon 'frontend-is-ui-only "Half right. Under the leaning no program is ever handed the runtime connection, so 'nothing below the kernel stops a program that was given the connection' attacks an option the decision did not take. But checking a program's limits is logic, and logic belongs to the runtime, not to a wallet's kernel; a limit kept only by the wallet is a request, as the objection says. So d-kernel-app-door now leans to grants the runtime enforces, and a new maintainer decision, d-kernel-app-launch, holds what happens before they exist. Its leaning is that until then every action a program proposes is asked, so nothing is described to the person as a limit the system does not hold."))

(reply 'r-kernel-canon-2 :by "opus-kernel" :to 'o-kernel-canon-2 :stance 'accept
  :because (canon 'no-real-funds-before-dispute-fix "Correct, and the kernel was silent on it. Leaving is every face's last remedy, so whether its sums hold on a given chain is a kernel fact. Added d-kernel-unfixed-contract for the maintainer, leaning that the kernel reads per chain whether the owner has allowed real money there, treats the missing contract fix as a reason it has not, and never shows sums as certain for real money on such a chain. k-real-or-test and k-leaving-sums now carry it."))

(reply 'r-kernel-canon-3 :by "opus-kernel" :to 'o-kernel-canon-3 :stance 'accept
  :because (canon 'recovery-coverage-visible "An empty screen that passes the check is the hidden compromise the rules forbid. k-coverage now shows the number of the newest state the counterparty has signed for me, which a kept copy must carry to be of use, and the money that sits in each account. k-programs shows what each program's orders and payments hold right now and offers a way to stop a program. The coverage state itself (current, behind, failed, not possible here) has no field in the ground yet; k-evidence says the runtime must state it, not a face."))

(reply 'r-kernel-canon-4 :by "opus-kernel" :to 'o-kernel-canon-4 :stance 'accept
  :because (canon 'mainnet-open-participation "Right: as written the question could be settled by silence. Added d-kernel-not-covered for the maintainer with three options: only shown, asked once when money is put into such an account, or real money refused there. I lean to the middle one. Refusing is a gate the release queue does not list; only showing lets the warning be read once and ignored; a question at the moment money is committed is where the person can still act on it."))

(reply 'r-kernel-canon-5 :by "opus-kernel" :to 'o-kernel-canon-5 :stance 'accept
  :because (canon 'lending-reopened "The app took the borrowing side of a launch flow and left out recovery, which the rule names. app-borrowing now works through k-leaving-sums, k-evidence and k-silence, and its text says it runs on EVM and native TRON alike, and that on TRON the account carrying the loan is not covered, under whatever d-kernel-not-covered settles."))

;; ── person lens ──────────────────────────────────────────────────────────

(reply 'r-kernel-person-1 :by "opus-kernel" :to 'o-kernel-person-1 :stance 'amend
  :because (canon 'keep-evidence "A warning nobody can act on is noise, agreed. But the kernel cannot make the watching service work on TRON, and offering a fake fix would be worse than the warning. Added d-kernel-uncovered-remedy for the maintainer: show only, the person keeps a second copy of their own, or the kernel offers to bring money out of that account by agreement. I lean to the person's own second copy, because the law says parties or their delegates keep their evidence. k-coverage now shows the money at stake and offers k-keep-copy-flow."))

(reply 'r-kernel-person-2 :by "opus-kernel" :to 'o-kernel-person-2 :stance 'accept
  :because (guess "Correct. Under the old leaning, 'let this program act' meant 'let it spend everything my limits allow', which nobody can judge from a program's name. d-kernel-app-door now leans to a grant per program, with its own counterparties, actions, total and end date, set by a fresh yes and never wider than the face's own limits. The question the person answers is then about this program's grant, in money and time."))

(reply 'r-kernel-person-3 :by "opus-kernel" :to 'o-kernel-person-3 :stance 'amend
  :because (protocol "core/watchtower/dispute-watch.ts" "The gap is real for a few items and overstated for the rest. A payment that does not finish returns to the payer by itself (law pay-fails-returns), a worse fee waits thirty days (law fee-rise-notice), and the runtime claims payments due to me while it runs; missing those costs nothing. What costs money when missed is a leaving started against me, a loan falling due and a collateral request skipped for lack of money. Added d-kernel-reach for the maintainer, leaning that the wake already built for a leaving is also used for those few deadlines; k-attention now marks which items cost money when missed."))

(reply 'r-kernel-person-4 :by "opus-kernel" :to 'o-kernel-person-4 :stance 'amend
  :because (canon 'entity-is "The inference is wrong: an entity is a person or organisation with authority rules, state and relationships, and nothing in it names a face. Under one program a face is how the entity is shown and asked, so moving to another face need not touch an account. The objection is right that the file named no way to move, which is a choice made by silence. Added d-kernel-change-face for the user, leaning that the same entity moves to another face with a fresh yes (a vote for a board) and the new face's rules apply from the next signature. Becoming a board is a change of signers in the protocol, not a change of face."))

(reply 'r-kernel-person-5 :by "opus-kernel" :to 'o-kernel-person-5 :stance 'amend
  :because (canon 'collateral-fee-prepaid "Right that a list of numbers nobody can weigh is not a choice. Wrong that nothing at opening can be weighed: one setting spends the person's money later without asking again, the automatic collateral request, whose fee is paid at the moment it fires; and listing makes the account public. Response times and the trigger cost nothing until something else happens, and leaving sums already state their effect. Added d-kernel-opening-question, decided by watching people, leaning to one question about only what acts alone (the most the wallet may pay per request, and whether the account is listed), with everything else shown on the account and changeable later."))

(reply 'r-kernel-person-6 :by "opus-kernel" :to 'o-kernel-person-6 :stance 'amend
  :because (canon 'collateral-secured "The misreading is real, and so is the cost of the alternative: if 'secured' means one thing for a private person and another for a trader, the fixed word stops being fixed. Added a third option to d-kernel-secured and moved the leaning to it: secured keeps the protocol's meaning, and wherever collecting it alone would cost more than it returns, the kernel attaches that fact to the word itself, in every face, so the word never stands without it. The critic's option, counting such a share as unsecured, stays on the decision for the maintainer to choose."))

;; ── protocol lens ────────────────────────────────────────────────────────

(reply 'r-kernel-protocol-1 :by "opus-kernel" :to 'o-kernel-protocol-1 :stance 'accept
  :because (protocol "core/watchtower/last-resort-appointment.ts" "Correct. An appointment is bound to one proof nonce and goes stale with the next state both sides sign, and the service may act only in the last fifth of the window and only by answering. 'Covered' and 'accepted' alone promise more than that. k-evidence now states per account whether the copy held carries the newest state, how far behind it is if not, and that the service only answers in the last part of the window and never starts anything. k-coverage shows the newest state's number, and the default says an account is shown as behind until the newest copy is accepted."))

(reply 'r-kernel-protocol-2 :by "opus-kernel" :to 'o-kernel-protocol-2 :stance 'accept
  :because (protocol "core/entity/tx/handlers/dispute/finalize.ts" "Correct. Leaving takes what I owe beyond the collateral from my money on the chain and records the rest against what arrives later. k-leaving now shows what I owe with nothing locked and any loan, and its question asks what leaving will take from me as well as what it returns. k-leaving-sums states both directions."))

(reply 'r-kernel-protocol-3 :by "opus-kernel" :to 'o-kernel-protocol-3 :stance 'accept
  :because (canon 'keep-evidence "Correct. 'For sure' was printed by something that does not check the condition it depends on. k-leaving-sums now states the certain part only together with whether the newest signed state is held on this device or by a copy that can act, and says 'not certain' where it is not."))

(reply 'r-kernel-protocol-4 :by "opus-kernel" :to 'o-kernel-protocol-4 :stance 'accept
  :because (protocol "core/protocol/dispute/lending-covenant.ts" "Correct: a loan is a separate signed agreement beside the balance, not part of it, and leaving makes principal plus earned interest due at once. The app's promise pointed at a figure that does not contain the debt. k-holdings now states loans as their own lines, never added into the account's figures, with what leaving would make due; k-leaving-sums includes that amount; and where the debt shows in a face is a new decision, d-apps-borrowed-where."))

(reply 'r-kernel-protocol-5 :by "opus-kernel" :to 'o-kernel-protocol-5 :stance 'accept
  :because (canon 'swap-cancel-ask-only "Correct: the stop I described is not one the protocol has. app-trading-program now says stopping prevents new proposals and asks each hub to cancel the program's open orders in one batch, and the person is told what remains held and could still fill until each hub acts. Withdrawing orders without a hub's help means starting to leave, which is a separate question. Added k-stop-program-flow to carry this."))

(reply 'r-kernel-protocol-6 :by "opus-kernel" :to 'o-kernel-protocol-6 :stance 'accept
  :because (canon 'exit-early-if-answered "Correct. A single end time is wrong in both directions: the counterparty can end it early, and an open cross-chain leg or a newer state on the chain makes everyone wait the full window and every swap deadline. k-leaving now shows the cross-chain deadlines beside the window, and k-leaving-sums gives the earliest and latest the money can come and what moves it, and says the window rule may still change."))

;; ── structure lens ───────────────────────────────────────────────────────

(reply 'r-kernel-structure-1 :by "opus-kernel" :to 'o-kernel-structure-1 :stance 'amend
  :because (protocol "core/protocol/dispute/lending-covenant.ts" "The unstated choice is real: where the debt shows was never decided. But 'only the build is moved' is wrong. The surfaces refused to make borrowing part of what the person does there; with the app, a person who never opens it never borrows. What remains is the consequence, and a loan is a claim that leaving makes due at once, so hiding it from the face would misstate what the person has. Added d-apps-borrowed-where for the user: blended into what I owe, a separate line never added into anything, or shown only in the app. I lean to the separate line, which keeps the trader's refusal of a blended balance."))

(reply 'r-kernel-structure-2 :by "opus-kernel" :to 'o-kernel-structure-2 :stance 'accept
  :because (as-said 'several-surfaces "The loop is there: 'a face costs little under one program' was used to choose four, while the program decision is built on four. d-kernel-how-many now argues from the owner's words and the people alone, gives two-by-authority its strongest form, and has a changes-if that can be tested on paper before any face is built."))

(reply 'r-kernel-structure-3 :by "opus-kernel" :to 'o-kernel-structure-3 :stance 'accept
  :because (guess "Correct on both points. The floor now says 'granting or widening a program's grant', not 'letting a program act', so a proposal inside a grant is not a floor kind. And a program no longer inherits the face's whole limits: d-kernel-app-door leans to a grant per program, which is the middle choice the objection names."))

(reply 'r-kernel-structure-4 :by "opus-kernel" :to 'o-kernel-structure-4 :stance 'accept
  :because (guess "Correct. The default had chosen for d-kernel-floor-rules before it was decided, and its list differed from d-kernel-consent. The floor list is now the same in both places and includes approving a borrower, and the default names the two kinds a standing rule might cover as open under d-kernel-floor-rules instead of settling them."))

(reply 'r-kernel-structure-5 :by "opus-kernel" :to 'o-kernel-structure-5 :stance 'accept
  :because (guess "Correct: the screen was built around kinds of signature, the option the decision refused. k-question-screen now shows what changes for the signer with this counterparty (secured share, owed to me, what I owe, what I can send, credit lines, whether the account is ending, whether it is listed publicly, from when a fee rise applies). How many accounts an action reaches has no figure in the ground; k-effect states it and the screen carries it once a figure exists."))

(reply 'r-kernel-structure-6 :by "opus-kernel" :to 'o-kernel-structure-6 :stance 'accept
  :because (canon 'recovery-coverage-visible "Correct, and the same point as the canon objection to this screen. k-coverage now shows the newest state's number and the money in each account, and offers the person's own copy; k-programs shows what each program holds and offers a grant and a stop. A person who lost a device should meet 'not covered' on the coverage screen and in the question before money goes in, not first inside a leaving flow that cannot continue."))
