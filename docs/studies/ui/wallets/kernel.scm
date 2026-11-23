;; kernel.scm — what is common under every surface, and the decisions about it.
;; Order: 1. the decisions  2. two figures the kernel needs that the ground does not yet declare
;;        3. the capabilities that meet every need the four surfaces declared
;;        4. the few screens, flows and defaults that must be identical for everyone.
;; Ids: decisions start with d-kernel-, everything else with k-. Nothing here is settled.

;; ─────────────────────────────────────────────────────────────────────────────
;; 1. The decisions
;; ─────────────────────────────────────────────────────────────────────────────

(decision 'd-kernel-how-many
  :question "Is four the right number of surfaces?"
  :options {:four "Four: a private person, a trader, a hub operator, an institution."
            :three-trader-folded "Three: the trader's work becomes the private surface with different signing rules plus trading apps."
            :two-by-authority "Two: one for an entity with a single signer and one for an entity with a board. Running a hub and trading become apps on the single-signer surface. This matches the only differences that reach the protocol: one signer against a board, and a runtime on this device against one on a server."
            :one-with-pro-switch "One surface for everyone, with the detail behind the Pro switch the release queue asks for."}
  :forces {:three-trader-folded ['d-apps-which-jobs]
           :two-by-authority ['d-apps-which-jobs]}
  :decider 'user
  :leaning 'four
  :because (as-said 'several-surfaces "The owner said a private person's wallet is not the same app as a trader's, a hub operator's or an institution's. That names people, not signing arrangements, so two-by-authority answers a different question: under it a hub operator's first screen is a private person's first screen with an app on top, and the operator's first question (who owes the hub what, across thousands of accounts) is not the private person's (who holds my money). The private person and the trader differ in what they are asked before signing, what they see first and what is set for them by default; whether that is enough for a separate face is the one honest doubt, and it is what three-trader-folded tests. One surface with a Pro switch is the single interface for everyone that the owner's words rule out.")
  :changes-if "Shown the private face's screens and the trader face's screens on paper, five traders mark nothing on the private face they would not use and nothing missing from it except the first screen and the signing rules; then fold to three. Or the user names a different set of people."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-kernel-programs
  :question "Are the surfaces four separate programs, or one program with four faces?"
  :options {:one-program-four-faces "One program holds the keys, the connection to the runtime, the questions before signing and everything else in this file. Each entity is open in exactly one face at a time, and a face shows nothing of the others."
            :four-programs-one-library "Four programs shipped apart, each carrying the same kernel as a library and each holding its own keys."
            :four-programs-one-service "Four programs that each talk to one kernel running on its own, on the device or on a server."}
  :forces {:one-program-four-faces ['d-kernel-change-face]
           :four-programs-one-library ['d-kernel-two-wallets]
           :four-programs-one-service ['d-kernel-app-door]}
  :depends ['d-kernel-how-many]
  :decider 'user
  :leaning 'one-program-four-faces
  :because (canon 'two-wallets-equal "The repository keeps two wallets and requires every one to be maintained. Four programs inside that rule means eight builds of every launch flow, each with its own tests. Four programs also means four places where an entity's keys and its last signed states can live, and four copies that can drift apart; one program keeps one copy per entity. The cost of one program is that it can slide back into one interface for everyone, so the rule 'one entity, one face at a time, nothing of the others' is part of this option, not an extra.")
  :changes-if "The user wants the surfaces installed or branded separately, or people given one face are seen opening another face by mistake and acting there."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-kernel-change-face
  :question "Can an entity move from one face to another, and what happens to its accounts when it does?"
  :options {:same-entity-new-face "The face is how an entity is shown and asked, not part of the entity. Moving to another face keeps every account and all money where it is, takes a fresh yes (a vote where there is a board), and applies the new face's standing rules from the next signature, after stating what will now be signed without asking that was asked before."
            :new-entity "A new face means a new entity: the person opens new accounts in the new face and leaves the old ones."
            :several-faces-at-once "An entity may be open in more than one face at the same time."}
  :depends ['d-kernel-programs]
  :decider 'user
  :leaning 'same-entity-new-face
  :because (canon 'entity-is "An entity is a person or organisation with authority rules, state and financial relationships; nothing in it names a face, so tying a face to the entity would make people leave every counterparty, and lock money twice during the change, only because their work grew. Several faces at once brings back one interface over everything by another door. Becoming a board is not a change of face; it is a change of the entity's signers, which the protocol carries and the institution face shows.")
  :changes-if "People who move between faces are seen to act under the old face's habits against the new face's rules (for example expecting an order to be signed at once) and lose money, or the user decides faces are separate products."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-kernel-boundary
  :question "What belongs in the kernel, and what is the test for telling?"
  :options {:same-answer-for-everyone "The kernel holds what has one true answer whoever is asking: what the runtime states about money, what a signature would change, whether a counterparty has answered, what leaving alone would return, whether a copy of the last signed state is kept. A surface holds what depends on the person: what is shown first, when to ask, what to do about a silence. Test: if two surfaces answering it differently could mislead someone or lose them money, it is the kernel's."
            :anything-shared "Anything two or more surfaces need goes into the kernel."
            :transport-only "The kernel is only the connection to the runtime and the keys; each surface asks, watches and leaves in its own way."}
  :forces {:same-answer-for-everyone ['d-kernel-consent 'd-kernel-silence 'd-kernel-words 'd-kernel-evidence 'd-kernel-unfixed-contract]}
  :decider 'user
  :leaning 'same-answer-for-everyone
  :because (canon 'frontend-is-ui-only "The runtime owns logic and the wallets only show and ask. A fact such as 'this counterparty has not answered since nine' or 'leaving returns this much' is logic; if each surface worked it out, the same account would read differently in two faces, which is also the duplicate formula one-path-no-parallel forbids. 'Anything shared' would pull policy into the kernel: every surface wants a silence threshold, but trader wants seconds and private wants hours, so a shared threshold is wrong for both. 'Transport only' leaves leaving alone to be designed four times, and the four leaving flows already differ.")
  :changes-if "Two surfaces turn out to need different definitions of the same fact, not different responses to it; then the test is wrong and the fact is not one fact."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-kernel-two-wallets
  :question "How does this design live with the rule that the repository keeps two wallets, Svelte and React, both maintained and neither to be redirected or deleted?"
  :options {:kernel-below-both "The kernel's facts and checks are runtime work that both wallets read. The kernel's screens and flows in this file, and each face, are built in both wallets, with the parity and owning tests the rule requires. The old screens of each wallet are replaced face by face, never left beside the new ones."
            :one-wallet-per-face "Some faces are built only in Svelte and others only in React."
            :third-wallet "The design becomes a third wallet beside the two."}
  :depends ['d-kernel-programs 'd-kernel-boundary]
  :decider 'maintainer
  :leaning 'kernel-below-both
  :because (canon 'parity-and-owning-tests "Every required financial flow must work the same in both wallets with an owning test in each, so a face that carries a launch flow cannot live in one wallet only. A third wallet is the parallel implementation one-path-no-parallel forbids, and never-redirect-or-delete-a-wallet stops either old wallet being retired to make room. What is left is to build the new design inside both, keep as much of it as possible in the runtime so it is written once, and replace old screens rather than add beside them. Whether 'replace inside a wallet' is allowed while that wallet keeps working is for the maintainer.")
  :changes-if "The maintainer changes the two-wallet rule, or rules that replacing a wallet's screens one face at a time breaks parity during the change.")

(decision 'd-kernel-totals
  :question "Who adds money figures across accounts, tokens or counterparties: the runtime, the kernel, or nobody?"
  :options {:runtime-states-totals "The runtime states every total a surface shows (secured, owed with nothing locked, held, borrowed), per token and per chain, never across chains; no surface and no kernel code adds."
            :kernel-adds-once "The kernel adds the runtime's per-account figures once for all faces, outside the runtime."
            :no-totals "No totals anywhere; every figure is per account."}
  :depends ['d-kernel-boundary 'd-kernel-two-wallets]
  :decider 'maintainer
  :leaning 'runtime-states-totals
  :because (canon 'one-path-no-parallel "No duplicate financial formulas. Three surfaces want totals across accounts and the fourth wants a per-token total if the runtime states it; operator says totals must never cross chains. If the kernel adds outside the runtime and both wallets carry the kernel, the same sum is written twice. 'No totals' fails the operator, who cannot read thousands of accounts one by one.")
  :changes-if "The maintainer says the runtime will not carry views that exist only for wallets, or that a sum of runtime figures is presentation and not a financial formula.")

(decision 'd-kernel-consent
  :question "How is a signature asked for, and does the question depend on what the signature changes for the signer?"
  :options {:by-effect-with-floor "The runtime sorts every signature by what it changes for the signer: only adds to my side; spends a fee; lowers what is mine for sure; raises what someone may owe me; makes me owe; ends a relationship; reaches many accounts; publishes something about me. Each face sets which of these ask and which sign at once, within a floor that always needs a yes (for a board, a vote): starting to leave, sending money out of the protocol, borrowing, changing terms that reach many accounts, granting or widening a program's grant, raising a credit line, and approving a borrower. d-kernel-floor-rules decides whether a standing rule can give that yes in advance for the last two. Nothing that only adds is ever asked."
            :one-rule-for-all "The kernel asks the same set of questions in every face."
            :each-face-alone "Each face decides by transaction type when to ask; the kernel only signs."}
  :forces {:by-effect-with-floor ['d-kernel-app-door 'd-kernel-seeded 'd-kernel-floor-rules]}
  :depends ['d-kernel-boundary]
  :decider 'user
  :leaning 'by-effect-with-floor
  :because (canon 'settle-needs-me "The protocol already decides by effect, not by type: the same settlement approval is signed automatically when it only adds to my side and never when it lowers my money. The four faces need different lines (private asks when something can cost them, trader signs orders inside limits at once, operator asks only about a few kinds, institution votes on everything that moves money), so one rule for all is wrong for three of them. Every one of the four leanings asks a person before leaving and before sending money out. A proposal a program makes inside a grant already given is not a floor kind; granting or widening the grant is. Raising credit is the exception the faces disagree on: the operator surface lets the hub raise a customer's line by itself within a cap, and d-kernel-floor-rules holds that collision instead of hiding it.")
  :changes-if "A face shows a real need to sign one of the floor kinds without a fresh yes, for example a trader moving money between hubs dozens of times a day; or people approve the floor questions without reading them more than nine times in ten."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-kernel-floor-rules
  :question "Can a standing rule, agreed once, give in advance the yes that the floor asks for each time?"
  :options {:no-exception "No. Every floor kind asks each time. The operator's hub stops answering credit requests by itself, and lending approvals wait for a person."
            :some-kinds-by-rule "Two floor kinds may be covered by a standing rule that was itself set by a fresh yes or a vote, with a cap, and shown with who set it: raising a credit line within a cap, and approving a borrower within a limit. Starting to leave, sending money out of the protocol, borrowing, changing terms that reach many accounts and granting a program anything are never covered by a rule."
            :any-kind-by-rule "Any floor kind may be covered by a standing rule set by a fresh yes."}
  :depends ['d-kernel-consent]
  :decider 'user
  :leaning 'some-kinds-by-rule
  :because (guess "The operator surface leans toward letting the hub answer credit requests by itself within a cap the operator sets, and toward lending approvals coming from a policy, because a hub with many customers cannot answer each one by hand. That is a credit raise without a fresh yes, which the floor forbids if it has no exceptions. The two sides differ in kind. A credit raise within a cap that a person chose has a known worst case. Leaving ends a relationship, and money sent out of the protocol does not come back, so no rule set in advance can know whether the moment is right. Covering any kind by rule would let a single early yes empty the floor.")
  :changes-if "Hubs answering credit requests by rule are seen to lose money that their operators say they would have refused by hand; or a face shows a real need for a rule that starts leaving, for example a hub with thousands of silent customers."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-kernel-silence
  :question "What does the kernel do when a counterparty stops answering?"
  :options {:fact-and-sums "The kernel states one fact for everyone: the oldest thing I signed that the counterparty has not answered, since when, what is held with them, which deadlines run out meanwhile, and what leaving alone would return and take. The threshold and the response are each face's. The kernel never starts leaving by itself, and leaving, once chosen, is one kernel flow for every face."
            :fact-and-stop "As above, and the kernel also stops sending anything new that adds to what that counterparty may owe, in every face, until it answers."
            :kernel-threshold "The kernel fixes one silence threshold and one response for every face."
            :leave-by-itself "After a set silence the kernel starts leaving on its own."}
  :forces {:fact-and-sums ['d-kernel-secured 'd-kernel-reach]}
  :depends ['d-kernel-boundary 'd-kernel-consent]
  :decider 'user
  :leaning 'fact-and-sums
  :because (protocol "core/types/account.ts" "An account keeps the exact signed proposal waiting for the counterparty's acknowledgement, so 'not answered since' is a fact the runtime has, the same for everyone. The responses cannot be shared: trader marks a hub silent after ten seconds and stops orders to it, private asks once after a longer silence, operator shows and waits, institution prepares a request to leave for a vote. One threshold is wrong for all of them. 'Stop new' looks safe but would block a private payment that only waits a few minutes, which is a face's choice. None of the four leans toward leaving by itself, so that refusal belongs to the kernel.")
  :changes-if "Watching real outages shows that a silence of under a minute already costs people money in every face, which would make stopping new risk a kernel duty; or a face is found to need leaving to start without a yes."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-kernel-reach
  :question "Who reaches the person outside the program when a deadline that costs money if missed comes close?"
  :options {:leaving-only "Only the watching service's wake when someone starts leaving against me, as built today; everything else waits in the list until the person opens the program."
            :costly-deadlines "The same wake also reaches the person for the few deadlines whose miss costs money: a leaving started against me where no copy can answer, a loan falling due, a collateral request skipped for lack of money. New work."
            :nothing-outside "Nothing reaches the person outside the program; deadlines the runtime can meet by itself are met while it runs, and the rest wait."}
  :depends ['d-kernel-silence 'd-kernel-evidence]
  :decider 'maintainer
  :leaning 'costly-deadlines
  :because (protocol "core/watchtower/dispute-watch.ts" "A wake for a registered device already exists for a leaving, so using it for a few more deadlines is narrower work than a second way to reach people. Most items in the list cost nothing if missed: a payment that does not finish returns to the payer by itself (law pay-fails-returns) and a worse fee waits thirty days (law fee-rise-notice). The ones that cost are few and can be named, and a person who opens the program once a week meets them too late. Leaving-only leaves a borrower and a person on TRON with nothing that calls them.")
  :changes-if "The maintainer rules out any reach beyond the leaving wake at launch, or people who are woken are seen not to open the program in time anyway.")

(decision 'd-kernel-words
  :question "Which words do all surfaces share?"
  :options {:fixed-words-for-risk "A short list of words is fixed for every face, because using another word for them misleads: 'secured' for my share of what is locked; 'owed to me with nothing locked' and 'I owe with nothing locked'; 'held' for money waiting on a payment or order; 'borrowed' for a loan; 'leaving' for going to the chain without the counterparty. Credit is never called money or balance, and the raw shared number is never shown as a balance. Everything else, such as calling a hub a company or a customer, is the face's."
            :fixed-meanings-own-words "Only meanings are fixed; each face names them in its person's words."
            :one-vocabulary "Every face uses the same words for everything."}
  :forces {:fixed-words-for-risk ['d-kernel-secured]}
  :depends ['d-kernel-boundary]
  :decider 'person-evidence
  :leaning 'fixed-words-for-risk
  :because (canon 'credit-secured-unsecured "Wallet balances must keep collateral-backed money apart from unsecured exposure and must never say signed debt will surely be repaid. The four surfaces already disagree on the words: private says 'mine for sure' and 'rests on someone's word', the others say 'secured' and 'could lose'. A person who uses two faces, a trader who is also a private person, should not meet the same risk under two names. The words for who the counterparty is are a different case: a private person says company, an operator says customer, and forcing one word there helps nobody.")
  :changes-if "People who see 'secured' and 'owed to me with nothing locked' cannot say which part they would lose if the counterparty vanished, while people shown the private surface's own words can.")

(decision 'd-kernel-secured
  :question "When collecting the locked share alone would cost more on the chain than it returns, is that share still called secured?"
  :options {:locked-share "Secured always means my share of the locked collateral, whatever its size. The cost of leaving is a separate figure that a face may put beside it."
            :locked-share-with-cost-attached "Secured keeps the protocol's meaning, but wherever collecting it alone would cost more than it returns, the kernel attaches that fact to the word itself, in every face, so the word is never shown without it."
            :above-leaving-cost "Secured means my locked share only when it is larger than what leaving costs; below that it is counted with what rests on the counterparty's word, in every face."}
  :depends ['d-kernel-words 'd-kernel-silence]
  :decider 'maintainer
  :leaning 'locked-share-with-cost-attached
  :because (canon 'collateral-secured "The protocol's rule is that the claimant's share of actual collateral is what is secured, so bending the word for one face makes it mean two things across the faces, and the same account reads safer to a trader than to a private person. But a separate figure a face may place anywhere lets the word 'secured' be read alone as 'safe', and on small accounts, which are most of a private person's, that reading is false. Attaching the cost to the word keeps one meaning and stops the word standing alone.")
  :changes-if "People shown a small secured share with the cost attached still say they would get it back, while people shown it counted as unsecured do not; or the chain cost of leaving on the launch chains exceeds the locked share of most private accounts, so that the attached fact would be on nearly every account.")

(decision 'd-kernel-unfixed-contract
  :question "Until the dispute contract fix the release queue names has landed on a chain, what does the kernel say about leaving and real money there?"
  :options {:no-real-money-there "The kernel reads, per chain, whether the owner has allowed real money there, treats the missing contract fix as a reason it has not, refuses real money on that chain, and never shows leaving sums as certain for real money there."
            :real-money-sums-uncertain "Real money is allowed, and on such a chain every leaving sum is shown as not certain until the fix lands."
            :assume-fixed "The design assumes the fix lands before launch and says nothing about it."}
  :depends ['d-kernel-boundary]
  :decider 'maintainer
  :leaning 'no-real-money-there
  :because (canon 'no-real-funds-before-dispute-fix "The release queue says no real funds before the fix lands. Leaving is every face's last remedy, and its sums are what each face shows as certain, so if the contract under them can be replayed against the person, the certainty is false in all four faces at once. The kernel does not decide when real money is allowed; the owner does (testnet-is-not-real-funds). It only reads that decision per chain and refuses to contradict it. Assuming the fix is the silent choice this spec exists to prevent.")
  :changes-if "The maintainer lands the fix on every launch chain, or rules that the queue item no longer binds."
  :status 'settled
  :settled-by "maintainer: already decided in committed todo.md, 'no real funds before it lands'; recorded 2026-11-19 by opus at 0.94")

(decision 'd-kernel-app-door
  :question "What may a program outside the kernel ask for?"
  :options {:read-or-everything "A program connects either read-only or with full authority, as the runtime connection allows today."
            :propose-under-my-rules "A program may read what the person lets it read, and propose actions. Every proposal goes through the same question as the face it works through: inside that face's standing rules it is signed at once, outside them the person is asked, and the floor always asks."
            :scoped-grants "Each program gets its own grant, set by a fresh yes: which counterparties, which actions, how much in total, until when, never wider than the face's own limits. Inside the grant a proposal is signed at once; outside it the person is asked. The runtime enforces the grant. A program never holds keys, never changes a standing rule, never sees the copies kept for leaving, and every signature it caused is listed under its name."}
  :forces {:scoped-grants ['d-apps-which-jobs 'd-kernel-app-launch]
           :propose-under-my-rules ['d-kernel-app-launch]}
  :depends ['d-kernel-consent]
  :decider 'maintainer
  :leaning 'scoped-grants
  :because (protocol "core/api/runtime-adapter/security/auth.ts" "A connection to a runtime today is authenticated at one of two levels, read-only or full, so handing a program the connection gives it everything, including leaving and moving money out. Running a program's proposals under the face's own rules keeps it away from the connection, but then 'let this program act' means 'let it spend all my limits allow', which nobody can judge from its name, and the trader's own need asks for limits set for the app, not for the trader's hand. A grant per program answers in money and time. The check is logic, and the runtime owns logic, so the grant belongs below the wallet; the repository lists such delegated scopes as work not yet done, which d-kernel-app-launch holds.")
  :changes-if "The maintainer refuses to build runtime-enforced grants at all, or programs are seen to need permissions a grant cannot express, such as acting on counterparties that do not exist yet.")

(decision 'd-kernel-app-launch
  :question "Before the runtime enforces program grants, what may a program do?"
  :options {:propose-and-ask "A program may read and propose; every action it proposes is asked, as if the person had proposed it by hand. Nothing a program proposes is signed at once until the runtime enforces its grant."
            :wallet-checked-and-said "Programs sign at once inside their grant from launch, checked by the wallet with the program kept apart from the keys, and the person is told on the grant itself that the limit is kept by the wallet, not by the protocol."
            :no-programs-at-launch "No program connects at launch; programs arrive with runtime-enforced grants."}
  :depends ['d-kernel-app-door]
  :decider 'maintainer
  :leaning 'propose-and-ask
  :because (canon 'no-stubs-in-flows "A limit described to the person as protecting them, and kept only by the wallet, is the hidden compromise the rule forbids; saying so on the grant makes it visible but still ships a limit the runtime owns no part of. Refusing all programs throws away reading and proposing, which are safe. Asking for every proposal makes a trading program slow but honest, and the trader surface already declared its trading program a gap, so no launch job depends on it.")
  :changes-if "The maintainer builds runtime-enforced grants before launch, or traders shown a program that asks for every order say they would not use it at all and a launch job turns out to need it.")

(decision 'd-kernel-evidence
  :question "Who keeps what a person needs to leave a counterparty alone after losing their device, and what is the person told about it?"
  :options {:device-and-one-service "The newest state signed by both sides goes, coded, to one watching service after every change. Per account and per chain the kernel says whether the copy held carries the newest state or is behind, whether the service last accepted or failed, and that the service only answers in the last part of the window and never starts anything. Where it cannot act it says 'not covered', never nothing."
            :device-only "Only the device keeps it."
            :several-services "Copies go to several services the person chooses."}
  :forces {:device-and-one-service ['d-kernel-not-covered 'd-kernel-uncovered-remedy]}
  :depends ['d-kernel-boundary]
  :decider 'maintainer
  :leaning 'device-and-one-service
  :because (protocol "core/watchtower/last-resort-appointment.ts" "An appointment is bound to one proof nonce, so every new state both sides sign makes the copy held stale until the device uploads a new one; the service may only act in the last fifth of the window, and only by answering. It is authorised with a single signer's signature, and I have not confirmed whether a board's entity can appoint it at all. It also refuses native TRON (core/watchtower/submission-support.ts). Each side must keep its own evidence (law keep-evidence), so device-only fails every private person who loses a phone. The honest kernel keeps one service where it works, says whether the copy is current, and says plainly where it cannot act.")
  :changes-if "The maintainer rules that no watching service runs at launch, or the service is made to submit on TRON and to accept a board's appointment, which would remove the 'not covered' cases.")

(decision 'd-kernel-not-covered
  :question "Where no kept copy can act for the person, is 'not covered' only shown, asked about, or a reason to refuse real money?"
  :options {:shown-only "It is shown on the account and on the coverage screen, with the money at stake, and nothing else changes."
            :asked-when-money-goes-in "It is shown, and putting money into such an account (opening it with credit, adding collateral, borrowing there) asks once, stating how much would sit there with no copy that can act."
            :refused "Real money is refused on accounts where no copy can act."}
  :depends ['d-kernel-evidence 'd-kernel-consent]
  :decider 'maintainer
  :leaning 'asked-when-money-goes-in
  :because (canon 'mainnet-open-participation "Financial and recovery gates stay mandatory and a surface may not skip or hide them, and no wallet may add gates of its own. Refusing real money where no copy can act would be a gate the release queue does not name, and native TRON is a required launch chain. Showing only lets the warning be read once and ignored. A question at the moment money is committed is not a gate; it puts the fact where the person can still act on it.")
  :changes-if "The maintainer rules that a working watching service is a mandatory recovery gate (then refused), or people approve this question without reading it more than nine times in ten (then the question is noise and shown-only is no worse).")

(decision 'd-kernel-uncovered-remedy
  :question "What can a person do about an account no kept copy can act for?"
  :options {:show-only "Show it and the money at stake; nothing else is offered."
            :own-second-copy "The person keeps a second copy of their own, on a second device they hold or as a file they keep, and the kernel says how far behind it is; restoring from it lets them answer or leave alone themselves."
            :bring-money-out "Offer to bring money out of that account to the chain by agreement with the counterparty, so less sits where no copy can act."}
  :depends ['d-kernel-evidence]
  :decider 'maintainer
  :leaning 'own-second-copy
  :because (canon 'keep-evidence "Parties or their delegates must keep their own usable evidence, so a second copy the person holds is the party keeping it, and it works on every chain, including TRON. It goes stale like the service's copy, so the kernel must say how far behind it is. Bringing money out needs the counterparty's signature and does not help the day it has stopped answering; a face may still offer it. Show-only leaves the person with bad news and nothing to do.")
  :changes-if "Restoring from a second copy cannot be tested end to end on TRON before launch, or the copy goes stale so fast on active accounts that it is useless; then bring-money-out is the only honest offer.")

(decision 'd-kernel-seeded
  :question "Opening an account installs settings no one chose (automatic collateral requests, public listing, response time). Does the kernel own those values, or only the duty to state them?"
  :options {:face-sets-kernel-states "The kernel opens with what the protocol requires, sets in the same opening what the opening allows (listing, response times), and in the next signature applies the face's own collateral request setting. The values are each face's; the kernel states them in money and hours."
            :one-set-for-all "The kernel fixes one set of opening settings for every face."
            :protocol-seed-untouched "Nothing is changed at opening; a face may change settings later as ordinary actions."}
  :forces {:face-sets-kernel-states ['d-kernel-opening-question]}
  :depends ['d-kernel-consent]
  :decider 'maintainer
  :leaning 'face-sets-kernel-states
  :because (canon 'auto-top-up-default "Both sides start an account with the same automatic collateral policy, so it cannot be left out of the opening itself; listing and response times are part of the opening and can be set there. The faces want different values: private and operator keep the automatic request on, institution wants it off until a vote, institution wants a weekend to answer where private keeps a day, and institution does not want to be listed. One set would be wrong for someone. Leaving the seed untouched means an institution runs for a while on a rule nobody voted on. While no credit is granted, the automatic request cannot fire (law balance-bound), so the second signature is safe if it follows the opening before any credit.")
  :changes-if "The maintainer lets an opening carry the collateral request setting, which removes the second signature, or shows the automatic request can fire before any credit is granted.")

(decision 'd-kernel-opening-question
  :question "When an account is opened, which of the settings it puts in place is the person asked about?"
  :options {:all-stated-one-yes "Every setting is stated in money and hours, and one yes covers them all."
            :only-what-acts-alone "One question, about only what will act later without asking: the most the wallet may pay by itself per collateral request, and whether the account is listed publicly. Response times and the trigger are shown on the account and can be changed at any time."
            :nothing-asked "Nothing is asked at opening; every setting is shown on the account afterwards and can be changed."}
  :depends ['d-kernel-seeded]
  :decider 'person-evidence
  :leaning 'only-what-acts-alone
  :because (canon 'auto-top-up-default "Both sides start with the automatic collateral request on, and its fee is taken from the person at the moment it fires (law collateral-fee-prepaid), so it is the one seeded setting that spends their money later with no further yes. Listing makes something public about them. Response times and the trigger cost nothing until something else happens, and their effect already appears in the leaving sums. On the first day a person cannot weigh a list of numbers, so asking about all of them buys a reflex yes; asking about none hides the one that spends money.")
  :changes-if "People asked the one question still cannot say afterwards what it allows, or people are later surprised more by a response time than by a fee.")

;; Added when closing the first pass, for gaps a critic found between the files.

(decision 'd-kernel-unbuilt
  :question "May a launch flow rest on a kernel capability that is runtime work not yet done?"
  :options {:not-offered-until-built "A capability whose sentence rests on (protocol …) exists at the cited path. One that rests on (guess …), or only on a rule, is runtime work not yet done or not yet verified. A flow that uses such a capability is not offered until the capability exists, and no face imitates it meanwhile."
            :offered-with-what-exists "A flow is offered with the parts that exist and says which parts are missing."
            :launch-waits "Launch waits until every capability a launch flow uses exists."}
  :depends ['d-kernel-boundary]
  :decider 'maintainer
  :leaning 'not-offered-until-built
  :because (canon 'no-stubs-in-flows "A flow offered with a missing part is the hidden compromise the rule forbids, and a face that works out a missing figure itself puts logic in the frontend. The cost of the leaning should be said plainly: k-effect and k-question rest on guesses and nearly every flow that signs uses them, so for those two the leaning and launch-waits come to the same thing. The leaning differs from launch-waits only for capabilities a few flows use, such as k-record, k-find or k-hub-pause: there the flow waits and the rest of the face does not. The checker counts a need as met when any capability names it, so it cannot tell a reader which needs rest on work not yet done; the basis of each capability's sentence is the only place that says so. Each capability whose sentence rests on a guess names this decision. Those resting on a rule (k-leaving-sums, k-pay-handle, k-counterparty-terms, k-real-or-test, k-causes) state what the runtime must say and have not been checked against it either.")
  :changes-if "The maintainer lists which guessed capabilities will exist before launch, which turns this into a schedule; or a required launch flow is found to rest on a guessed capability that cannot exist in time, which forces one of the other options for that flow."
  :status 'settled
  :settled-by "user: 2026-11-19, provisional: the maintainer's decision, not yet answered by him")

(decision 'd-kernel-keys
  :question "Who creates, backs up and restores the keys that make a device act as the owner, in every face?"
  :options {:one-phrase-in-kernel "The kernel creates one secret phrase per person. The device's identity, the signing key of each entity they sign for and the watching service's appointments all come from it. The coded state kept with the watching service is restored on a new device from the phrase, and a second device is added by entering the same phrase. Each face decides only when the person is asked to write the phrase down. Losing the phrase loses every entity that has no other signer."
            :second-device-as-signer "As above, but a second device the person holds becomes a second signer of the entity, so losing one device does not lose the entity."
            :service-keeps-phrase "A service keeps the phrase, or a share of it, and gives it back after the person proves who they are."
            :each-face-own "Each face designs its own keys and its own restore."}
  :forces {:one-phrase-in-kernel ['d-private-restore-key]}
  :depends ['d-kernel-boundary 'd-kernel-programs]
  :decider 'maintainer
  :leaning 'one-phrase-in-kernel
  :because (protocol "core/storage/recovery/bundle/seed-identity.ts" "The device's identity and every key that signs a watching service appointment are derived from one phrase, and the file says both wallets must derive exactly these values or a restored device becomes a different identity. So keys are a fact with one answer, and by the kernel's own test they are the kernel's. The coded state the service keeps is addressed by that identity and restored from it (core/storage/recovery/bundle/restore.ts). A service that keeps the phrase is custody, which is outside this launch (canon out-of-launch-scope). A second device as a second signer turns the entity into one with a board, which only the institution face shows, and which brings the low-agreement warning d-institution-board-size describes. A hub needs its seed on its server (core/orchestrator/hub-node.ts) and each board member holds their own phrase, so for those faces the kernel's part is the same: one phrase per person, kept by that person. Not checked: whether two devices can run the same entity at the same time without signing states that conflict; until that is known, adding a second device by the phrase may have to mean moving to it, not sharing.")
  :changes-if "More than one person in ten shown the phrase loses it or keeps it where others can read it; or the owner brings custody into scope; or the runtime gains a way to add a second device's key to an entity without making it a board.")

(decision 'd-kernel-leave-once
  :question "Leaving is specified once in the kernel and again in three faces. Which copy signs the leaving?"
  :options {:kernel-signs-face-enters "The kernel's leaving flow alone signs the leaving and states its sums. A face's own leave flow is its way in: when it offers leaving and what it says first. For an entity with a board, putting the request and voting on it is the face's step, and the kernel's flow sends nothing to the chain until that vote lands."
            :each-face-signs "Each face keeps its own leave flow that signs the leaving; the kernel fixes only the sums and the question they use."
            :kernel-flow-only "Faces have no leave flow of their own; the kernel's flow serves every face's job of leaving."}
  :depends ['d-kernel-silence 'd-kernel-boundary]
  :decider 'user
  :leaning 'kernel-signs-face-enters
  :because (guess "d-kernel-silence says leaving, once chosen, is one kernel flow for every face, and the boundary test agrees: two faces that sign leaving differently could state different sums for the same account. Each-face-signs is what the files held before: four copies of the same four signatures with no decision allowing them. Kernel-flow-only cannot be written in this spec, because a person's job is served by a flow of their own face and the kernel's flow names no person. Closing a leaving that the counterparty started, which the operator face asks for only when the hub failed to close it (operator-leaving-flow), is not leaving and stays the operator's. The board step is the one real difference between faces: only an entity with a board votes before leaving, and which member puts the request (d-institution-urgent-slot) is the institution's choice. One limit of the forms, not a decision: a surface can offer a kernel flow from its screens, but no form lets it lead to a kernel screen, so k-leaving, k-question-screen, k-coverage and k-programs stay unreached by any surface until the vocabulary allows it.")
  :changes-if "A face is found to need a different sequence of leaving steps, not only a different way in, for example a hub that must leave thousands of accounts at once; or the user rules that each face's leaving is its own product."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-kernel-could-lose
  :question "What is the figure 'could lose' with a counterparty, and may a face add savings into it?"
  :options {:leaving-remainder "Could lose is what leaving alone would leave owed and unpaid beyond the secured share, as k-leaving-sums states it. Leaving makes savings and loans due at once, so they are inside it because the runtime puts them there. The runtime states it per counterparty, and its totals per token and chain. No face adds, and savings also stay a line of their own."
            :owed-unlocked-only "Could lose is only what is owed to me with nothing locked in the account's figures. Savings are a separate line, and no total contains them."
            :face-adds "A face adds savings into its own could-lose figure."
            :one-total-across "One could-lose total across every counterparty and token, and one secured total beside it, as the institution face's two totals can be read."}
  :depends ['d-kernel-totals 'd-kernel-words 'd-kernel-secured]
  :decider 'maintainer
  :leaning 'leaving-remainder
  :because (protocol "core/protocol/dispute/lending-covenant.ts" "Leaving brings principal and interest earned so far due at once, with the amount frozen when the leaving starts, and the agreement is held apart from the account's own figures. So the account's 'owed to me with nothing locked' leaves savings out, and an institution that reads only that figure carries more than it sees. The institution face counts savings in could-lose, and k-holdings said no face adds; both hold if the runtime states the figure leaving would leave unpaid, savings included, and faces only show it. Totals of it are per token and chain, as d-kernel-totals says, so the institution's two totals are allowed if they are this figure and the secured figure per token and chain. One total across tokens would need a price for each token, which is a figure the runtime does not state and the wallet may not invent. Whether savings beyond the locked share are really unsecured in a dispute has not been traced through the contract, as d-institution-savings-exposure says.")
  :changes-if "The maintainer shows savings are paid in a dispute ahead of everything else from the locked share, so they belong with secured; or says the runtime will not state a leaving remainder per counterparty, which leaves owed-unlocked-only.")

(decision 'd-kernel-hub-credit
  :question "A hub raises every customer's credit line by itself, up to a cap in code that nobody can change. Until that changes, what does the floor say?"
  :options {:real-money-waits "On test money, the floor's own text and the operator face both say plainly that a hub's credit lines are raised by code without a yes, and who set the cap. No hub takes real money until the runtime lets the operator set the cap, zero included, as a standing rule given by a fresh yes."
            :stated-exception "The floor names the exception for hubs and says it on test and real money alike, until the runtime change lands."
            :redefine-floor "The floor does not count a hub answering credit requests, since it is the hub's automation and not a signature the operator makes."}
  :depends ['d-kernel-floor-rules 'd-kernel-unfixed-contract]
  :decider 'maintainer
  :leaning 'real-money-waits
  :because (protocol "core/entity/tx/handlers/account/credit-request.ts" "A hub answers a customer's credit request by itself, raising its line to the lower of the request and a cap looked up per token in code, and never lowering a larger line; no transaction sets or removes the cap. The repository says the parties choose credit, by hand or by a soft-limit policy (canon credit-is-chosen); a cap nobody can change is neither. So on the operator face the floor is false today, and the spec must say so instead of letting k-default-floor read as true for every face. Real money is refused everywhere until the dispute contract fix lands (d-kernel-unfixed-contract), so making the cap the operator's before real money costs little time. Redefining the floor would leave the operator's largest unsecured risk as the one thing no question covers.")
  :changes-if "The maintainer says the code cap is a testnet onboarding device removed before real money, which makes the exception end by construction; or builds the operator's cap before the contract fix lands.")

(decision 'd-kernel-floor-holds-where
  :question "In which faces does the floor stop a signature, and in which does it only ask?"
  :options {:stated-per-runtime "Where the runtime runs inside the program, the question sits in front of the key and the floor stops a signature. Where a face reaches a runtime on a server over an admin connection, anything holding that connection can make it sign without the question, so the face says, beside the floor, that it only protects against the person's own mistakes. A program on the server that uses the admin connection is listed as holding the entity's full authority, not as a program under a grant."
            :runtime-enforces-floor "The runtime itself refuses the floor kinds without a recorded yes, whoever holds the connection. Needs runtime work."
            :no-remote-faces "No face reaches a runtime over an admin connection until the runtime enforces the floor."}
  :depends ['d-kernel-consent 'd-kernel-app-door]
  :decider 'maintainer
  :leaning 'stated-per-runtime
  :because (protocol "core/api/runtime-adapter/security/auth.ts" "A connection to a runtime is authenticated as read-only or full, and full authority separates no kind of action from another. So the floor, as the kernel describes it, holds on a device and not on a hub's server. The credit officer is such a program today: it sends the hub's loan approvals as entity transactions from beside the hub (core/orchestrator/credit-officer/officer.ts), which k-app-door's rule that a program never holds keys does not describe. Refusing remote faces would leave the operator with no face, since the hub runs on a server (d-operator-where-runs). Runtime enforcement is the right end and is the same work as the per-kind checks d-operator-who-signs names; until it exists, saying where the floor holds is what is honest.")
  :changes-if "The maintainer builds per-kind checks or scoped grants in the runtime, which makes runtime-enforces-floor available; or operators are seen to treat the question on the hub as protection against a stolen token.")

(decision 'd-kernel-silence-rule
  :question "May a standing rule depend on a counterparty's silence, so that it stops new risk from every face and every program at once?"
  :options {:silence-rule-kind "The list of standing rules gains one kind: stop anything new that adds to what a named counterparty may owe me, or holds my money with it, once it has not answered for longer than the person set. The person sets the time per counterparty in their face; the rule is applied below every face and program. New runtime work."
            :face-applies-own "Each face applies its own stop to its own screens; a program working through the kernel is not stopped."
            :kernel-stops-for-all "The kernel stops new risk to a silent counterparty in every face, with one threshold."}
  :depends ['d-kernel-silence 'd-kernel-app-door]
  :decider 'user
  :leaning 'silence-rule-kind
  :because (canon 'frontend-is-ui-only "The runtime owns logic, so a stop that only a screen applies is logic in the frontend, and it does not stop the person's own program, which is the case the trader face is worried about. One threshold for every face is what d-kernel-silence rejects: a private payment should not stop after seconds. A rule kind keeps the threshold the person's and the enforcing in one place. Before this decision k-standing-rules listed no such rule and k-silence states only the fact, so the trader's need to stop orders to a silent hub was met by nothing.")
  :changes-if "The runtime cannot apply a rule keyed on another entity's silence before signing without making signatures depend on the clock in a way its rules forbid; or the user rules that stopping on silence is the kernel's duty in every face.")

(decision 'd-kernel-held-pay-not-allowed
  :question "On a chain where held payments may not yet carry real money, which payments does the kernel sign?"
  :options {:direct-only "Only a payment straight to the counterparty of one of my accounts. A payment that would pass through a hub is refused with the reason, in every face; moving money by the chain stays offered."
            :through-hub-unconditional "Payments through a hub are signed without a hold, and the person is told the hub could keep the money."
            :no-payments "No payment of any kind with real money on such a chain."}
  :depends ['d-kernel-unfixed-contract 'd-kernel-boundary]
  :decider 'maintainer
  :leaning 'direct-only
  :because (canon 'htlc-constants-are-simnet "Per-chain values must be decided before any real-money held payment on an EVM mainnet. This is a different rule from no-real-funds-before-dispute-fix, which refuses real money on a chain altogether and which d-kernel-unfixed-contract already holds; the trader face's refusal answers that rule, not this one. The three faces that pay already answer this rule the same way: the private face pays real money only to its own company, the trader face offers only the chain path between hubs, and the institution face offers no real money through hubs. What was missing is that it is one fact with one answer for everyone, so by the boundary test it is the kernel's. A payment through a hub with no hold asks the person to trust the hub to pass it on, which no face lets them judge.")
  :changes-if "The maintainer decides the held-payment values for every launch chain before launch, which removes the question; or people are seen needing to pay others through hubs on an EVM mainnet before that.")

(decision 'd-kernel-money-in-out
  :question "Is bringing money in from outside, and taking all of it back out, one kernel flow or each face's own?"
  :options {:kernel-flow-face-picks-account "One kernel flow brings tokens from an ordinary address into the entity's money on the chain and, if chosen, into one account's locked share, and the reverse, down to taking everything out to an address. Before anything moves it states each chain step, what it costs and how long it waits. Each face decides which account is filled and where the flow is reached from."
            :each-face-own "Each face has its own way in and out, as the trader face leans to."
            :outside-only "Money reaches the entity's chain money from outside the wallet; the wallet only moves it between the chain and accounts."}
  :depends ['d-kernel-boundary 'd-kernel-consent]
  :decider 'user
  :leaning 'kernel-flow-face-picks-account
  :because (guess "As the ground declares them, bringing tokens in from an ordinary address, moving chain money into an account and sending chain money out to an address are three separate chain steps, each queued for the next chain submission (core/entity/tx/handlers/j-batch/e2r.ts, r2c.ts, r2e.ts). The steps and their costs are the same in every face, and sending money out of the protocol is in the floor for everyone. What differs is which account is filled: a trader picks a hub with exposure in view, a private person's company was chosen when joining. The first deposit is the first thing every new person does, and no face said what the person is told about chain cost and delay before money is in an account. Taking everything out means closing each account with the counterparty's signature, or leaving it, which the kernel's leaving flow holds. The trader face leans the other way (d-trader-fund-path). Until one of them moves, four surface flows still sign their own chain steps: trader-fund-flow, trader-move-chain-flow, operator-refill-flow and operator-earnings-flow. Under the leaning each becomes a way into this flow; that is left to the surfaces' authors, because their own decisions (d-trader-fund-path, d-operator-reserve-short, d-operator-withdraw-while-owed) were argued separately and this pass did not reopen them.")
  :changes-if "A face is found to need a different sequence of chain steps, not only a different account; or people fund their entities from elsewhere and never use it."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-kernel-first-face
  :question "How does a person end up in one face the first time they open the program?"
  :options {:from-entity-then-asked "Where the entity already says it, the face follows from it: more than one signer opens the institution face, the hub role opens the operator face. A new person, or an entity with one signer, is asked one plain question about why they came, which picks the private or the trader face."
            :always-asked "Everyone is asked which kind of wallet they want, whatever their entity is."
            :separate-entrances "Each face has its own entrance, and a person arrives at one by the link they were given."}
  :depends ['d-kernel-programs 'd-kernel-change-face]
  :decider 'user
  :leaning 'from-entity-then-asked
  :because (canon 'entity-is "An entity has authority rules, so whether it has more than one signer is a fact a face can read, and the hub role is a fact too (law hub-is). Asking a person whose entity has a board whether they are a private person invites an answer the entity contradicts. Between private and trader nothing in the entity differs, so only the person can say, and one question costs less than finding a separate entrance. Separate entrances fit four programs better than one, which d-kernel-programs leans against.")
  :changes-if "People asked the one question pick the trader face and then only pay, or the reverse, more than one time in five; or the user wants the faces reached as separate products."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-kernel-face-mismatch
  :question "What does a face do when it finds the entity no longer fits it, such as a second signer added under the private face?"
  :options {:stop-and-offer "The face signs nothing the floor covers and offers the face that fits, through the change d-kernel-change-face describes. Until the person moves, what only adds still signs, and the old face's limits are not applied to the new signers."
            :stricter-of-two "The face keeps working, and every kind either face would ask about is asked, until the change is agreed."
            :carry-on "The face carries on as chosen; the entity's shape is the person's business."}
  :depends ['d-kernel-change-face 'd-kernel-first-face]
  :decider 'user
  :leaning 'stop-and-offer
  :because (protocol "core/entity/tx/handlers/system/basic.ts" "With more than one signer, a request runs at once only if its proposer's weight alone reaches the threshold; otherwise it waits for votes. The private and trader faces show no waiting requests and no votes, so under them a payment waiting for a vote would look sent. Asking more under the old face still hides the votes. Carrying on is one interface for everyone by another door. The institution face's own case, one member able to act alone, is held by d-institution-board-path, which allows it and says so.")
  :changes-if "People whose entity gains a second signer are seen to lose money while the face is stopped and they have not moved; or the user decides a board may be run from the private face."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-kernel-reach-channel
  :question "Through what does a wake reach someone who has lost their phone, or a board or operator away from their machines?"
  :options {:every-device-of-the-entity "Everyone who answers for the entity registers their own devices for it with the watching service: a private person's second device, each board member's phone, the operator's phone for each hub. A person may also register a device of someone they trust. All of them are woken."
            :registered-device-only "One registered device per entity, the one the wallet runs on."
            :outside-channel "A channel outside the protocol, such as email or text messages, that the service uses to reach a person. New work, and it ties an entity to a person's contact details in one more place."}
  :depends ['d-kernel-reach 'd-kernel-keys]
  :decider 'maintainer
  :leaning 'every-device-of-the-entity
  :because (protocol "core/watchtower/push/store.ts" "The service keeps device registrations keyed by chain, entity and device token, several per entity up to a cap per runtime, and wakes every registration for the entity a leaving is started against (core/watchtower/push/dispute-wake.ts). A registration is checked only for being signed by the key of the runtime that sent it (core/watchtower/push/registration.ts), not for that runtime being a signer of the entity, so a board member, an operator or a trusted person can each register their own device. The wake is therefore not tied to one phone today; what is missing is a face that offers it. An outside channel would put contact details beside entity ids with the service, which the push module avoids by keeping only device tokens.")
  :changes-if "People who lose their phone turn out to have no second device either, which leaves an outside channel as the only reach; or the maintainer limits registrations to the entity's own signers.")

;; ─────────────────────────────────────────────────────────────────────────────
;; 2. Figures the kernel needs that the ground does not declare yet.
;;    They belong in protocol.scm; they are here because this author may not edit it.
;; ─────────────────────────────────────────────────────────────────────────────

(figure 'k-fig-newest-signed :core "AccountReplica.counterpartyDisputeProofNonce"
  :means (protocol "core/types/account.ts" "The number of the newest state of this account that the counterparty has signed for me to take to the chain. A copy kept for leaving is of use only if it carries this number; an older one can be answered with a newer state."))

(figure 'k-fig-listed :core "AccountReplica.publicPinned"
  :means (protocol "core/types/account.ts" "Whether this account is advertised in my entity's public routing profile, so others can see this counterparty is one of mine. Only the side that opened the account advertises it."))

;; ─────────────────────────────────────────────────────────────────────────────
;; 3. Capabilities: what the kernel gives every surface and app
;; ─────────────────────────────────────────────────────────────────────────────

(capability 'k-runtime-link
  :gives (protocol "core/api/runtime-adapter/types.ts" "One kind of connection to an entity's runtime, in one of two modes: the runtime runs inside the program, or it is reached over an authenticated connection to a server. A hub's operator reaches the hub on its server this way.")
  :meets ['operator-needs-remote-hub]
  :because ['d-kernel-programs 'd-kernel-boundary])

(capability 'k-holdings
  :gives (guess "For every counterparty, token and chain, as figures the runtime states: my secured share, what is owed to me with nothing locked, what I owe with nothing locked, what is held, and savings and loans as lines of their own, never added into the account's figures, each with what leaving would make due at once. Wherever collecting the secured share alone would cost more than it returns, that fact is attached to it. Totals per token and per chain are stated by the runtime, with the largest accounts behind each named. What could be lost with a counterparty is the runtime's figure of what leaving would leave unpaid, savings included (d-kernel-could-lose). No total crosses chains, and no face adds anything. What exists today: per account and token, the parts deriveDelta states (core/account/utils.ts). Everything else here, totals included, is runtime work not yet done.")
  :meets ['private-needs-certain-and-promised 'trader-needs-per-hub-split 'operator-needs-totals]
  :because ['d-kernel-totals 'd-kernel-words 'd-kernel-secured 'd-kernel-could-lose 'd-kernel-unbuilt])

(capability 'k-own-spendable
  :gives (guess "Per counterparty and token, how much I can send without coming to owe the counterparty anything, stated by the runtime, so a payment can stop there. deriveDelta states the room to send as one sum that includes credit granted to me, and states that credit's unused part apart (core/account/utils.ts); the file asks that new meanings be added as helpers wrapping deriveDelta, so this is a small piece of runtime work, not a subtraction done in a face.")
  :meets ['private-needs-own-spendable]
  :because ['d-kernel-boundary 'd-kernel-words 'd-kernel-unbuilt])

(capability 'k-chain-money
  :gives (guess "The entity's own money on each chain outside any account, per token, with the debts recorded against it that come first, and how much of it is already promised to queued chain actions and to paid collateral requests.")
  :meets ['private-needs-chain-money 'operator-needs-chain-money]
  :because ['d-kernel-boundary 'd-kernel-totals 'd-kernel-unbuilt])

(capability 'k-effect
  :gives (guess "Before anything is signed, for any set of actions: what it changes with each counterparty (what I would hold, owe and be owed), the most it can take, the worst it can lose, the fees in the money being spent, whether it ends a relationship, how many accounts it reaches and from when a rise applies, and what it makes public and under whose name. The runtime works it out; the face only shows it. I found no single runtime statement of this today; until one is found it is runtime work not yet done, and nearly every flow that signs depends on it.")
  :meets ['private-needs-quote 'institution-needs-money-effect 'operator-needs-reach 'trader-needs-publication]
  :because ['d-kernel-consent 'd-kernel-boundary 'd-kernel-unbuilt])

(capability 'k-question
  :gives (guess "One question before a signature, keyed on what it changes for the signer and stating the most it can take and the worst it can lose. Each face chooses which kinds ask, above the floor that always asks: starting to leave, sending money out of the protocol, borrowing, changing terms that reach many accounts, granting or widening a program's grant, raising a credit line and approving a borrower. What only adds to my side is signed without asking. Every question and its answer are recorded. Where the runtime runs inside the program the question stands in front of the key; where it is reached over an admin connection, the question protects only against the person's own mistakes, and the face says so (d-kernel-floor-holds-where).")
  :meets ['private-needs-one-question 'operator-needs-ask 'trader-needs-sign-inside-limits]
  :signs ['signed-command]
  :because ['d-kernel-consent 'd-kernel-not-covered 'd-kernel-floor-holds-where 'd-kernel-unbuilt])

(capability 'k-standing-rules
  :gives (guess "One list of everything that may be signed or spent without asking: a face's limits per counterparty, automatic collateral requests and their fee caps, a hub's automatic answers, each program's grant, and rules that stop anything new to a counterparty silent for longer than the person set (d-kernel-silence-rule). Each rule shows its limit, who set it (the person, the board, the hub's automation, code, or the protocol's seed) and when. A hub's automatic credit answer is listed as set by code, with its cap, until the operator can set it (d-kernel-hub-credit). A rule changes only by the entity's own authority, a vote where there is a board, and never by a program. The automatic collateral settings exist in the runtime today; the list itself, the silence rule and program grants are runtime work not yet done.")
  :meets ['trader-needs-sign-inside-limits 'institution-needs-standing-rules 'operator-needs-who-set 'operator-needs-ask]
  :signs ['set-auto-top-up 'grant-credit]
  :because ['d-kernel-consent 'd-kernel-floor-rules 'd-kernel-seeded 'd-kernel-app-door 'd-kernel-silence-rule 'd-kernel-hub-credit 'd-kernel-unbuilt])

(capability 'k-batch
  :gives (guess "Many actions under one signature, such as asking one hub to cancel every open order or paying a whole run of suppliers, with each action's own answer reported as it comes back.")
  :meets ['trader-needs-pull-all 'institution-needs-run]
  :signs ['signed-command 'swap-cancel 'pay-routed 'pay-direct]
  :because ['d-kernel-consent 'd-kernel-boundary 'd-kernel-unbuilt])

(capability 'k-board
  :gives (protocol "core/entity/tx/processing/proposals.ts" "For an entity with a board: which requests wait, who put each one, who has voted which way, how much more agreement each needs, and which members cannot put a new request because one of theirs is still waiting.")
  :meets ['institution-needs-board-state]
  :signs ['board-propose 'board-vote]
  :because ['d-kernel-consent 'd-kernel-boundary])

(capability 'k-silence
  :gives (protocol "core/types/account.ts" "For each counterparty: the frame I proposed that it has not acknowledged and the time written in that frame, what is held with it meanwhile, and which deadlines on my money run out before it answers. The same fact in every face; what to do about it is the face's.")
  :meets ['private-needs-silence 'trader-needs-silence 'operator-needs-last-answer 'institution-needs-silence]
  :because ['d-kernel-silence])

(capability 'k-leaving-sums
  :gives (canon 'exit-alone "For each counterparty, at any time and not only when leaving: what leaving alone would return, what I owe beyond the collateral that leaving would take from my money on the chain and from what arrives later, any loan that leaving would make due at once, what would remain owed to me and come only if the counterparty later has money on the chain, the earliest and latest each part could arrive and what moves it, and what the chain would charge. The returned part is called certain only while the newest state both sides signed is held on this device or by a copy that can act, and only on a chain where the owner allows real money; otherwise it says not certain and why. The window rule may still change, and the figure says so. What would remain owed and unpaid, savings and loans included, is the figure faces call could lose (d-kernel-could-lose).")
  :meets ['private-needs-leaving-sums]
  :because ['d-kernel-silence 'd-kernel-secured 'd-kernel-evidence 'd-kernel-unfixed-contract 'd-kernel-could-lose])

(capability 'k-attention
  :gives (guess "One list across every counterparty and chain of everything with a deadline or that automation could not finish: payments in flight, leaving windows, fee rises under notice, loans falling due, requests waiting for votes, paid collateral requests skipped for lack of money, stuck chain submissions. Each item comes with its cause from the runtime, what it costs if missed, and whether missing it costs anything at all. Reaching the person outside the program for the few that cost money follows d-kernel-reach and is new work.")
  :meets ['operator-needs-attention 'institution-needs-deadlines 'operator-needs-wake]
  :because ['d-kernel-boundary 'd-kernel-silence 'd-kernel-reach 'd-kernel-unbuilt])

(capability 'k-wake-on-leaving
  :gives (protocol "core/watchtower/dispute-watch.ts" "The watching service sees a counterparty start leaving against an entity and wakes every device registered for that entity on that chain, while the time to answer runs. Several devices may be registered for one entity, and any runtime may register its own device for it (core/watchtower/push/store.ts, core/watchtower/push/registration.ts), so a second device, each board member's phone or the operator's phone can each be woken; which of them a face offers follows d-kernel-reach-channel.")
  :meets ['private-needs-wake 'operator-needs-wake 'institution-needs-wake]
  :because ['d-kernel-evidence 'd-kernel-reach 'd-kernel-reach-channel])

(capability 'k-evidence
  :gives (guess "The newest state signed by both sides of every account, kept on the device and as a coded copy with one watching service, restorable on a new device (k-identity), and, where the person chooses, as a second copy of their own. Per account and per chain, the runtime states whether each copy carries the newest state or how far behind it is, and whether the service last accepted or failed. It says that the service only answers in the last part of the window and never starts a leaving. It says 'not covered' on native TRON and wherever a board's entity cannot appoint the service. What exists today: the coded copy, the appointment (core/watchtower/last-resort-appointment.ts) and restoring from the phrase. The runtime's statement of each copy's state per account is runtime work not yet done.")
  :meets ['private-needs-copy-kept 'trader-needs-own-evidence 'operator-needs-cover 'institution-needs-coverage]
  :because ['d-kernel-evidence 'd-kernel-uncovered-remedy 'd-kernel-unbuilt])

(capability 'k-answer-for-me
  :gives (protocol "core/watchtower/last-resort-appointment.ts" "One appointment per account that lets the watching service answer a leaving started against it. The service gets no power to spend: it receives the newest state the counterparty signed and an authorisation bound to the service, the account pair, that state's number and the last-resort part of the window, and what it may send is an answer to the leaving. It is rebuilt from the current account state, so it goes stale with every newly signed state until the device sends a fresh one. It is signed by one key derived from the person's phrase, so an entity with a board cannot give it as the code stands, and the service refuses native TRON outright (core/watchtower/submission-support.ts); in both cases the account is stated as not covered.")
  :meets ['private-needs-answered-for-me]
  :because ['d-kernel-evidence 'd-kernel-keys])

(capability 'k-identity
  :gives (protocol "core/storage/recovery/bundle/seed-identity.ts" "One phrase from which the device's identity and every key that signs a watching service appointment are derived, identically in both wallets. The coded state kept with the watching service is addressed by that identity, so entering the phrase on a new device finds it and restores the same owner with every account's newest kept state (core/storage/recovery/bundle/restore.ts). When the phrase is shown and checked is each face's choice.")
  :meets ['private-needs-restore-identity]
  :because ['d-kernel-keys])

(capability 'k-record
  :gives (guess "The entity's own record, derived from its signed history: payments with their notes, fills with price, size and fee, settlements, loans, and changes to limits, terms and program grants with who made them. It can be taken out as a file for a chosen period. Requests and votes, earnings by kind over a period, and a record kept longer than the runtime keeps its history are not there today and would be added. What exists today is the signed history inside the runtime's bound; the record drawn from it, and its export, are runtime work not yet done.")
  :meets ['trader-needs-fills 'institution-needs-record 'operator-needs-earned 'operator-needs-who-set 'private-needs-record]
  :because ['d-kernel-boundary 'd-kernel-totals 'd-kernel-unbuilt])

(capability 'k-market-read
  :gives (protocol "core/network/relay/market/snapshot.ts" "The best prices and depth each hub publishes for a pair, with how old each is, and what a hub publishes about a resting order, including the owner's identity.")
  :meets ['trader-needs-book 'trader-needs-publication]
  :because ['d-kernel-boundary])

(capability 'k-pay-handle
  :gives (canon 'relay-is-canonical-transport "Something a person can hand to a payer that lets a payment reach them, whether or not either side has a direct line to a hub, carried over the authenticated relay as the normal path.")
  :meets ['private-needs-pay-handle]
  :because ['d-kernel-boundary])

(capability 'k-pay-note
  :gives (guess "A short note carried with each payment, sent or received, so it can be matched to an invoice. A direct payment already carries a description to the receiving side (core/types/account.ts). I did not find one on the account-level step of a payment through hubs, so notes on those are new work.")
  :meets ['institution-needs-payment-note]
  :because ['d-kernel-boundary 'd-kernel-unbuilt])

(capability 'k-counterparty-terms
  :gives (canon 'no-solvency-proofs "What can honestly be said about a counterparty before opening an account with it: what it charges, how much notice it gives before charging more, and how long it has to answer. Nothing about its reserves or its health.")
  :meets ['private-needs-company-facts]
  :because ['d-kernel-boundary 'd-kernel-words])

(capability 'k-real-or-test
  :gives (canon 'testnet-is-not-real-funds "For each chain: whether the money on it is real or test money, whether the owner allows real money there yet, why not if not (including a dispute contract without the fix the release queue names), and which protections work there (the watching service, payments through hubs). Real money is refused where the owner has not allowed it; the kernel reads that decision and never makes it. Separately, per chain: whether held payments may carry real money there yet; where they may not, only payments straight to an account's counterparty are signed with real money, in every face (d-kernel-held-pay-not-allowed).")
  :meets ['private-needs-real-or-test]
  :because ['d-kernel-boundary 'd-kernel-evidence 'd-kernel-unfixed-contract 'd-kernel-held-pay-not-allowed])

(capability 'k-causes
  :gives (canon 'errors-are-shown "Every failure from the runtime, with its cause, in words a face can pass on unchanged. No face hides one or turns it into an empty screen.")
  :meets ['private-needs-causes]
  :because ['d-kernel-boundary])

(capability 'k-app-door
  :gives (guess "A program may read what the person lets it read and propose actions. Each program has its own grant, set by a fresh yes: which counterparties, which actions, how much in total and until when, never wider than the face's limits. Until the runtime enforces grants, every proposal is asked (d-kernel-app-launch). Every signature a program caused is listed under its name, and stopping a program stops new proposals and asks the hubs to cancel its open orders. It never holds keys, never changes a rule and never sees the copies kept for leaving.")
  :meets ['trader-needs-app-limits]
  :because ['d-kernel-app-door 'd-kernel-app-launch 'd-kernel-consent 'd-kernel-unbuilt])

(capability 'k-handle-online
  :gives (guess "What a recipient hands a payer also says whether the recipient's side expects to be online to claim a payment within minutes, so the payer's wallet can choose the short or the long deadline. I found nothing in the handle that says this today; it is runtime work not yet done, and a recipient who says so wrongly makes their own payments fail and return.")
  :meets ['private-needs-recipient-online]
  :because ['d-kernel-boundary 'd-kernel-unbuilt])

(capability 'k-sided
  :gives (guess "Every figure of a leaving case stated from the asking entity's side: my time to answer and the counterparty's, which side started it, when it can be finished, and whether my newer state reached the chain in time. The per-side figures exist in the account's state (core/types/account.ts: each side's response time, which side started); turning them to the asking side is done once, as viewer-math-is-deriveDelta asks for the account's figures, and whether my answer reached the chain in time is not stated by the runtime today.")
  :meets ['operator-needs-my-side]
  :because ['d-kernel-boundary 'd-kernel-silence 'd-kernel-unbuilt])

(capability 'k-their-chain-money
  :gives (guess "For one counterparty, its own money on the chain per token as the chain shows it, offered only inside a statement of what leaving would collect at once beyond the locked share, since that is the only money the chain collects from at once (law exit-alone). It is never shown as a figure about a hub's health (canon no-reserve-dashboards). Reading it is runtime work not yet done.")
  :meets ['operator-needs-recoverable]
  :because ['d-kernel-boundary 'd-kernel-could-lose 'd-kernel-unbuilt])

(capability 'k-find
  :gives (guess "Find one counterparty among all of an entity's accounts by the id or the name it gives, and open what the entity has with it, including payments and paid requests still in flight. Accounts are kept by the counterparty's id, so finding by id is a lookup; finding by a name is runtime work not yet done.")
  :meets ['operator-needs-find]
  :because ['d-kernel-boundary 'd-kernel-unbuilt])

(capability 'k-hub-pause
  :gives (guess "Not built. One action that makes a hub refuse new accounts, new credit (its automatic answer included) and new paid requests, and one that ends the stop, without touching existing accounts. No such switch exists in the runtime (d-operator-pause); until it does, nothing is offered in its place.")
  :meets ['operator-needs-pause]
  :because ['d-operator-pause 'd-kernel-unbuilt])

;; ─────────────────────────────────────────────────────────────────────────────
;; 4. What must be identical for everyone
;; ─────────────────────────────────────────────────────────────────────────────

(screen 'k-leaving :in 'kernel
  :answers "What will leaving return, what may never come, what will it take from me, and when?"
  :shows ['account-status 'exit-ready-at 'exit-ends-at 'exit-started-by-left 'exit-window-left 'exit-window-right 'cross-leg-deadline
          'collateral-mine 'owed-to-me-unsecured 'owed-by-me-unsecured 'loan-principal 'loan-interest-so-far 'k-fig-newest-signed]
  :offers ['k-leave-flow]
  :because ['d-kernel-silence 'd-kernel-secured 'd-kernel-evidence 'd-kernel-unfixed-contract])

(screen 'k-question-screen :in 'kernel
  :answers "What will this signature change for me, and do I agree?"
  :shows ['collateral-mine 'owed-to-me-unsecured 'owed-by-me-unsecured 'can-send 'credit-i-grant 'credit-granted-to-me
          'account-status 'k-fig-listed 'fee-notice 'pay-most-debited 'top-up-fee-paid 'order-max-fee 'order-min-receive]
  :offers []
  :because ['d-kernel-consent 'd-kernel-not-covered 'd-kernel-opening-question])

(screen 'k-coverage :in 'kernel
  :answers "If I lose this device today, which counterparties could I still leave alone?"
  :shows ['k-fig-newest-signed 'collateral-mine 'owed-to-me-unsecured 'exit-window-left 'exit-window-right]
  :offers ['k-keep-copy-flow]
  :because ['d-kernel-evidence 'd-kernel-not-covered 'd-kernel-uncovered-remedy])

(screen 'k-programs :in 'kernel
  :answers "Which programs may propose actions for me, and what is each one holding right now?"
  :shows ['held-outgoing 'order-give 'order-max-fee 'pending-amount]
  :offers ['k-grant-program-flow 'k-stop-program-flow]
  :because ['d-kernel-app-door 'd-kernel-app-launch])

(flow 'k-leave-flow :in 'kernel
  :signs ['exit-prepare 'exit-start 'exit-finish 'chain-submit]
  :uses ['k-leaving-sums 'k-question 'k-evidence 'k-silence 'k-board]
  :ends (canon 'recovery-times-shown-apart "The person knows, as three separate things, how long the counterparty has to respond, from when the leaving can be finished, and what came back once it is finished: the secured share, what was taken from their own money for what they owed, what remains owed to them and may never come, and what the chain charged. Where the entity has a board, nothing reached the chain before the vote carrying the leaving landed, and if the evidence was not yet stable at that vote, they know the leaving is prepared and waiting, and whether it needs another vote.")
  :because ['d-kernel-silence 'd-kernel-boundary 'd-kernel-leave-once])

(flow 'k-move-in-out-flow :in 'kernel
  :signs ['deposit-in 'fund-account 'settle-propose 'settle-approve 'settle-submit 'withdraw-out 'chain-submit]
  :uses ['k-chain-money 'k-effect 'k-question 'k-real-or-test 'k-board 'k-causes]
  :ends (guess "Before anything moved, the person knew each chain step it would take, what each costs and how long each waits, and that money sent out to an address leaves the protocol. Afterwards they know where the money is now: at their address, in their money on the chain, or locked in the account the face chose; or, taking everything out, which accounts closed with the counterparty's signature and which can only be left alone through the leaving flow.")
  :because ['d-kernel-money-in-out 'd-kernel-consent])

(flow 'k-choose-face-flow :in 'kernel
  :signs []
  :uses ['k-runtime-link 'k-identity 'k-board]
  :ends (guess "The person is in the face that fits their entity, or, with one signer, the face they picked by saying why they came; and if the entity has since changed shape, they know which face now fits, what it will sign without asking that the old face asked, and that nothing the floor covers is signed until they move.")
  :because ['d-kernel-first-face 'd-kernel-face-mismatch 'd-kernel-change-face])

(flow 'k-restore-flow :in 'kernel
  :signs []
  :uses ['k-identity 'k-evidence 'k-answer-for-me 'k-real-or-test 'k-causes]
  :ends (guess "With the phrase entered on a new device, the person is the same owner, with every account's newest kept state; for each account they know whether the restored state is the newest both sides signed or behind, and which accounts could not be restored, why, and what leaving would return. Any face may offer this flow; its own job flow, such as the private face's new-phone flow, decides when.")
  :because ['d-kernel-keys 'd-kernel-evidence])

(flow 'k-open-flow :in 'kernel
  :signs ['open-account 'set-auto-top-up]
  :uses ['k-effect 'k-question 'k-counterparty-terms]
  :ends (guess "The person knows which counterparty they now have an account with, that nothing is owed either way, the most the wallet may now pay by itself per collateral request, whether the account is listed, and where to find and change the other settings the opening put in place.")
  :because ['d-kernel-seeded 'd-kernel-consent 'd-kernel-opening-question])

(flow 'k-keep-copy-flow :in 'kernel
  :signs []
  :uses ['k-evidence]
  :ends (guess "The person knows which accounts their own second copy covers, how far behind it is today, and that it must be refreshed after new activity to stay of use.")
  :because ['d-kernel-uncovered-remedy 'd-kernel-evidence])

(flow 'k-grant-program-flow :in 'kernel
  :signs []
  :uses ['k-app-door 'k-question 'k-standing-rules]
  :ends (guess "The person knows what this program may propose, with which counterparties, up to how much in total and until when, and whether its proposals inside that grant will be signed at once or still asked each time.")
  :because ['d-kernel-app-door 'd-kernel-app-launch 'd-kernel-consent])

(flow 'k-stop-program-flow :in 'kernel
  :signs ['swap-cancel 'signed-command]
  :uses ['k-app-door 'k-batch 'k-attention]
  :ends (canon 'swap-cancel-ask-only "The person knows the program can propose nothing more, which of its open orders each hub has cancelled, and what is still held and could still fill until the remaining hubs act.")
  :because ['d-kernel-app-door])

(default 'k-default-adds-only :in 'kernel
  :value "A signature that only adds to the signer's side and grants nobody anything is signed without asking, in every face"
  :risk-on 'nobody
  :because ['d-kernel-consent])

(default 'k-default-floor :in 'kernel
  :value "Starting to leave, sending money out of the protocol, borrowing, changing terms that reach many accounts, granting or widening a program's grant, raising a credit line and approving a borrower each need a fresh yes, or a vote where there is a board; whether a capped standing rule may give that yes for the last two is open under d-kernel-floor-rules. Two places where this is not true today, and is said: a hub raises credit lines by code with no yes (d-kernel-hub-credit), and on a runtime reached over an admin connection the floor only asks (d-kernel-floor-holds-where)"
  :risk-on 'holder
  :because ['d-kernel-consent 'd-kernel-floor-rules 'd-kernel-hub-credit 'd-kernel-floor-holds-where])

(default 'k-default-hub-credit-said :in 'kernel
  :value "Until the runtime lets an operator set it, a hub raises any customer's credit line up to a cap in code with no yes; the floor's text and the operator face say so, and no hub takes real money while it is so"
  :risk-on 'holder
  :because ['d-kernel-hub-credit])

(default 'k-default-one-phrase :in 'kernel
  :value "One secret phrase per person, created on first use; every entity they sign for and every watching service appointment comes from it, and a new device is the same owner only with it"
  :risk-on 'holder
  :because ['d-kernel-keys])

(default 'k-default-face-from-entity :in 'kernel
  :value "An entity with more than one signer opens the institution face and one with the hub role the operator face; a person with one signer is asked once why they came"
  :risk-on 'nobody
  :because ['d-kernel-first-face 'd-kernel-face-mismatch])

(default 'k-default-direct-only :in 'kernel
  :value "On a chain where held payments may not carry real money, only payments straight to an account's counterparty are signed with real money"
  :risk-on 'nobody
  :because ['d-kernel-held-pay-not-allowed])

(default 'k-default-no-leaving-alone :in 'kernel
  :value "The kernel never starts leaving a counterparty by itself, however long it has been silent"
  :risk-on 'holder
  :because ['d-kernel-silence])

(default 'k-default-no-programs :in 'kernel
  :value "No program may read or propose anything until the person grants it, one program at a time"
  :risk-on 'nobody
  :because ['d-kernel-app-door])

(default 'k-default-program-proposals-ask :in 'kernel
  :value "Until the runtime enforces a program's grant, every action a program proposes is asked as if the person had proposed it"
  :risk-on 'nobody
  :because ['d-kernel-app-launch])

(default 'k-default-copy-kept :in 'kernel
  :value "On wherever the watching service works: a coded copy of the newest state both sides signed goes to it after every change, and the account is shown as behind until that copy is accepted; elsewhere the account is shown as not covered"
  :risk-on 'holder
  :because ['d-kernel-evidence])

(default 'k-default-uncovered-asks :in 'kernel
  :value "Putting money into an account no kept copy can act for asks once, stating how much would sit there uncovered"
  :risk-on 'holder
  :because ['d-kernel-not-covered])

(default 'k-default-real-money-by-chain :in 'kernel
  :value "Real money is refused on any chain where the owner has not allowed it, including where the dispute contract lacks the named fix"
  :risk-on 'nobody
  :because ['d-kernel-unfixed-contract])

;; Added 2026-11-19 by claude-fable-5-2. With four faces settled, nothing said which is built first.
(decision 'd-kernel-build-order
  :question "With four faces settled, which is built first?"
  :options {:private-first "The private person's face first: it is the one most people would open, and the hardest to get right."
            :firms-first "The trader's and the operator's faces first: they serve the firms the maintainer is already talking to."
            :kernel-with-thinnest-face "The kernel first, with the single thinnest face that proves it end to end, whichever person that is."}
  :depends ['d-kernel-how-many 'd-kernel-programs]
  :decider 'user
  :leaning 'kernel-with-thinnest-face
  :because (canon 'first-conversations-are-firms "The only people the release queue names as being asked first are firms, which argues for the trader's or operator's face. The private person is the least grounded of the four: who they are is itself an open decision. Under the settled boundary every face stands on the kernel, so the kernel is needed first in any order, and one thin face on it tests the boundary before three more are built on it.")
  :changes-if "The maintainer names a first user who is waiting, or the first written intents come from one kind of firm; then that person's face is first."
  :status 'settled
  :settled-by "user: 2026-11-19")
