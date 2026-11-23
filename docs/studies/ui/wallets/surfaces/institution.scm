;; surfaces/institution.scm — the wallet surface for an institution.
;; An organisation with several people who must agree, obligations to others, and someone who audits it.
;; Order: the person, then the decisions, then the surface that follows, then what it needs from the shared base.
;; Designed from scratch: nothing here is taken from an existing wallet.
;; Revised after the objections in talk/institution--*.scm; the replies are in talk/institution--replies.scm.

;; ─────────────────────────────────────────────────────────────────────────────
;; 1. The person
;; ─────────────────────────────────────────────────────────────────────────────

(person 'institution
  :is (guess "The person who runs the money of a small organisation (a company of ten to two hundred people, a fund, a cooperative, a payments business). They prepare payments, share the right to approve them with two to four colleagues, and answer to an outside auditor once a year and to their own directors every month.")
  :came-for (guess "To pay and get paid by the organisation's suppliers, customers and partners, and to know at any moment what the organisation holds, owes and is owed, and with whom, knowing who had to agree before anything left.")
  :cannot [(protocol "core/entity/auth/authorization.ts" "Move money alone, unless the board was set up so that they can. Every action that moves money or changes risk is a collective action: it has to be put to the board and reach the agreed weight of yes votes before it runs. Only notes, requests and votes are individual.")
           (guess "Be online whenever a counterparty does something. Colleagues sleep, travel and take holidays; a weekend is two days in which nobody may answer.")
           (guess "Be asked to approve something shown only as a list of protocol actions. They agree to money going to someone, not to an envelope of transactions.")
           (guess "Be asked to reason about which side of an account they are on, or to read a number that is not their own balance as if it were.")
           (guess "Keep the history themselves by hand. If nothing keeps a record of who agreed to what, the auditor gets nothing.")
           (guess "Be surprised by money spent on the organisation's behalf by an automatic rule nobody on the board voted for.")
           (guess "Explain to customers how payments are delivered. A customer who cannot pay them on a Saturday blames the organisation, not the network.")]
  :jobs [(job 'institution-pay :wants (guess "Pay the suppliers and people we owe this week, once the others have agreed."))
         (job 'institution-approve :wants (guess "See what my colleagues want to pay, check it, and say yes or no."))
         (job 'institution-get-paid :wants (guess "Know that a customer's payment arrived, which invoice it was for, and that it is ours for good."))
         (job 'institution-position :wants (guess "Know who owes us, whom we owe, and how much of it we could lose if one of them failed."))
         (job 'institution-credit :wants (guess "Decide how much a customer or partner may owe us before they have to pay up."))
         (job 'institution-savings :wants (guess "Put cash we will not need this month somewhere it earns, and get it back when we need it."))
         (job 'institution-leave :wants (guess "Get our money back from someone who has stopped answering."))
         (job 'institution-audit :wants (guess "Give the auditor a record of everything we agreed and paid, who agreed to it, and when."))
         (job 'institution-signers :wants (guess "Take away the signing rights of someone who left, and give them to whoever replaced them."))
         (job 'institution-open :wants (guess "Start working with a new supplier, customer or bank, on terms the board agreed."))
         (job 'institution-fund :wants (guess "Bring the organisation's money in from its own address, and take it back out when we need it elsewhere."))])

;; ─────────────────────────────────────────────────────────────────────────────
;; 2. The decisions
;; ─────────────────────────────────────────────────────────────────────────────

(decision 'd-institution-angle
  :question "Is this surface the idea the owner rejected: selling provable payment authorisation to corporate treasuries?"
  :options {:surface-not-angle "No. It is one of the wallets the user named, for organisations that use xln. It is never presented or sold as proof of payment authorisation to treasuries, and its record is for the organisation's own auditor."
            :drop-surface "Yes. The rejection covers it; no institution surface is built, and an organisation with a board uses whatever surface serves an entity with several signers."
            :reopen "It is close enough that the maintainer must reopen the rejected idea, with the user's naming of an institution surface as the new evidence."}
  :decider 'maintainer
  :leaning 'surface-not-angle
  :because (canon 'rejected-ideas-need-new-evidence "The rejected line in docs/rejected-ideas.md is about the angle used to sell xln, not about whether organisations may use it. The new evidence the rule asks for is written here: on 2026-11-18 the user named an institution among the surfaces (said several-surfaces). A board that votes before money moves is how the protocol works for any entity with several signers, not something this surface adds. Whether that is enough is for the maintainer to say, not this file.")
  :changes-if "The maintainer reads the vote-before-money and the auditor's record as the rejected angle in another form, or the user withdraws the institution from the surfaces.")

(decision 'd-institution-who
  :question "Who exactly is the person this surface is for?"
  :options {:finance-lead "The finance lead of a small organisation, who prepares payments and is also one of the people who approve them."
            :approver-only "A director who never prepares anything and only approves what others prepared."
            :preparer-without-rights "A bookkeeper who prepares payments but has no right to approve any."
            :auditor "The outside auditor who reads what the organisation did."}
  :forces {:preparer-without-rights ['d-institution-board-path]
           :auditor ['d-institution-auditor]}
  :depends ['d-institution-angle]
  :decider 'user
  :leaning 'finance-lead
  :because (guess "The finance lead is the one who opens it every working day; directors open it when asked to approve and the auditor once a year. The protocol only lets a member of the board put a request to the board (core/entity/tx/handlers/system/basic.ts refuses an unknown proposer), so a bookkeeper without rights cannot prepare anything inside the protocol at all.")
  :changes-if "Watching three small organisations shows that the person who opens the wallet daily is a bookkeeper with no approval rights, or the user says the institution surface is meant for a fund or a hub's parent company rather than an ordinary organisation.")

(decision 'd-institution-board-path
  :question "Does this surface accept an organisation in which one person can move money alone?"
  :options {:refuse "No. At setup it refuses a board where any single person's weight reaches the agreed share alone; such an organisation uses the private surface."
            :allow-and-say "Yes, but it says plainly on every screen who can act alone, and the record marks each thing that ran without a second person."
            :allow "Yes, without comment; it is the organisation's business."}
  :depends ['d-institution-who 'd-kernel-first-face]
  :decider 'user
  :leaning 'allow-and-say
  :because (guess "A request runs at once when its proposer's weight alone reaches the threshold, with no other vote (core/entity/tx/handlers/system/basic.ts). An organisation with one owner, or two founders who can each act alone, is the most common small organisation, and it still needs the runs, the position per counterparty and the record; the private surface has none of them. Refusing it would push it to add a director only to satisfy the screen. What it must not get is the promise that nothing left without agreement, so the surface says who can act alone instead of refusing.")
  :changes-if "Organisations where one person can act alone are seen to read the surface as a promise that someone else checked each payment; then refuse, or show solo payments apart from voted ones.")

(decision 'd-institution-board-size
  :question "For a small board, which comes first: still agreeing with one person missing, or a threshold the runtime does not flag as unsafe?"
  :options {:margin-first "A threshold the board can reach with any one person missing. For three equal seats that is two of three, which the runtime flags as a low quorum."
            :safety-first "A threshold above two thirds of the total weight. For three equal seats every person must sign, so one absence stops the money."
            :four-seats "Propose four seats, three of which must agree, so both hold. An organisation with three approvers gives the fourth seat to a director or to a key kept offline as a spare."}
  :depends ['d-institution-board-path]
  :decider 'maintainer
  :leaning 'four-seats
  :because (protocol "core/entity/consensus/leader/index.ts" "The same threshold that approves requests also certifies every frame of the entity, and the runtime flags any threshold at or below two thirds of the total weight as low quorum safety. It is a logged warning when the entity starts, not a refusal (core/entity/consensus/input/admission.ts). With equal weights a board of two cannot have a margin at all without letting one person act alone, a board of three must choose, and a board of four can have three of four, which keeps a margin and clears the flag. Whether the flag matters for a board of known colleagues is a safety judgement about the protocol, so it is the maintainer's.")
  :changes-if "The maintainer says the flag guards against something that cannot happen among a board's own members, so two of three is fine; or organisations shown the four-seat setup refuse to hold a fourth key.")

(decision 'd-institution-first-screen
  :question "What does the first screen answer?"
  :options {:waiting "What is waiting for my yes or no?"
            :position "What do we hold, owe and are owed, and with whom?"
            :attention "What is waiting for one of us to decide: requests waiting for votes, members blocked by their own waiting request, and things a vote can still change before a deadline (a counterparty leaving against us, a fee rise we could leave before, a counterparty that stopped answering)."}
  :depends ['d-institution-who]
  :decider 'person-evidence
  :leaning 'attention
  :because (protocol "core/entity/tx/processing/proposals.ts" "Each board member can have only one request waiting at a time, so an unvoted request blocks its author's next one; what unblocks the finance lead's day is a vote. Deadlines nobody can act on stay off this screen: a payment already on its way cannot be recalled before its deadline (law payer-cannot-recall), so it is shown with the run, not here. The position matters, but it changes slowly and is read on purpose, not on arrival.")
  :changes-if "Three finance leads, given the attention screen first, each go straight to the totals before acting on anything listed; or approvers who only vote find the list of deadlines in the way of the one request they came for, which would make waiting win for them.")

(decision 'd-institution-batching
  :question "Is a payment put to the board one at a time, or as a run of many payments approved together?"
  :options {:one-at-a-time "Each payment is its own request and its own vote."
            :run "Payments are gathered into a run (this week's suppliers, this month's salaries) and the board votes once on the whole run."
            :run-with-limit "Runs, but no run is larger than a size the board set, so a single vote never covers more than it agreed to look at, and one bad payment never holds more than that."}
  :forces {:run ['d-institution-fee-margin]
           :run-with-limit ['d-institution-fee-margin]}
  :depends ['d-institution-board-path]
  :decider 'person-evidence
  :leaning 'run-with-limit
  :because (protocol "core/entity/consensus/frame/application.ts" "A request may carry a list of actions, and a member may have only one request waiting, so one payment per request makes the finance lead wait for each vote. But the voted actions run in order inside the frame that carries the deciding vote, and if any one of them is refused the signed command carrying it is evicted whole, so the deciding vote does not land, no payment in the run leaves, and the request keeps waiting until enough members vote no. A run is all or nothing at the moment of the last vote; only what happens to each payment after it leaves (law pay-fails-returns) is per payment. A limit keeps one stale payment from holding forty others.")
  :changes-if "Watching co-signers shows that runs are short anyway and a limit never binds; then run. Or runs are refused at the last vote so often that one payment per request is cheaper; then one-at-a-time.")

(decision 'd-institution-fee-margin
  :question "How much may a payment's cost rise between preparing a run and its last vote?"
  :options {:exact-quote "Not at all. The most each payment may cost is the quote at preparing; if fees rose, the whole run waits until it is voted down and prepared again."
            :voted-margin "A margin the board voted once, the same for every run. Voters see the most each payment may cost, quote plus margin, not the quote alone."
            :per-run-margin "The preparer chooses a margin for each run, and voters see it."}
  :depends ['d-institution-batching]
  :decider 'person-evidence
  :leaning 'voted-margin
  :because (protocol "core/paybook/payment-admission.ts" "Before a payment through hubs leaves, its cost is checked against the most the payer allowed, and a payment above it is refused. Inside a run that refusal stops every payment (core/entity/consensus/frame/application.ts). With no margin, any rise in fees during a weekend of voting sends the same run back to the same colleagues, and colleagues who see the same run twice learn to approve without reading. A margin set by the board once is a cost it chose; one chosen per run by the preparer is a cost one person chose for everyone.")
  :changes-if "Quotes measured across real runs almost never move between preparing and the last vote; then exact-quote. Or boards want to see a different margin for salaries than for suppliers; then per-run-margin.")

(decision 'd-institution-vote-shows
  :question "What does a board member see before saying yes or no?"
  :options {:actions "The exact list of actions in the request."
            :money-effect "Who gets what, through which counterparty, the most it can cost, and how what we hold, owe and are owed changes with each counterparty."
            :both "The money effect first, and the exact actions one step away, so a careful member can check that they match."}
  :depends ['d-institution-batching]
  :decider 'person-evidence
  :leaning 'both
  :because (guess "A vote is cast on a request whose exact actions are fixed by a hash, and when the yes votes reach the threshold those exact actions run (core/entity/tx/handlers/system/basic.ts). What the member agrees to is that list, so it must be reachable, but nobody reads a list of actions to decide whether a supplier should be paid.")
  :changes-if "Board members shown only the money effect cannot tell when it differs from what was asked (for example a changed recipient), or members shown both never open the actions.")

(decision 'd-institution-unasked
  :question "What is signed or spent for the organisation without any board member being asked?"
  :options {:as-the-protocol-does "Whatever the protocol does on its own: automatic collateral requests that pay a fee, settlements that only add to our side, claiming incoming payments, finishing a leaving process whose window has passed."
            :voted-rules-receiving-free "Anything that spends, pays a fee or adds risk runs only under a rule the board voted, with its limit. Receiving payments and signing settlements that only add to our side stay automatic, and the surface says so, because the most they can add to what is owed to us is the credit line the board already voted."
            :voted-rules-strict "Only automatic behaviour the board voted on, including receiving: a payment drawn on credit we granted waits for a vote before we claim it."
            :nothing "Nothing at all happens without a vote, including claiming any incoming payment."}
  :depends ['d-institution-board-path]
  :decider 'maintainer
  :leaning 'voted-rules-receiving-free
  :because (guess "What reaches an entity from its accounts arrives as protocol work, not as a collective action (core/entity/auth/authorization.ts), so it is never put to a vote; it still takes effect only once enough of the board's machines certify the frame (law entity-signers). A claimed payment drawn on credit we granted raises what that counterparty owes us with nothing locked, but no higher than the line the board voted (law balance-bound), so its risk was voted when the line was. A fee paid by an automatic collateral request is different: a new account starts with that rule on and nobody is asked (law auto-top-up-default). I have not confirmed that the claim of a payment through hubs can be held for a vote at all, which is why voted-rules-strict and nothing are for the maintainer.")
  :changes-if "The maintainer says incoming claims can be held for a vote cheaply and boards want that; or organisations find their exposure to one customer grew by receiving and say they would have refused it.")

(decision 'd-institution-setup
  :question "Where do the settings an account opens with come from, and when does the board agree to them?"
  :options {:protocol-defaults "Keep what opening an account installs: no credit either way, automatic collateral requests on, the account listed publicly, the standard response time."
            :setup-sheet "The board votes once on a set of opening settings, the runtime keeps them as the organisation's own, and every later opening uses them. This is new runtime work."
            :prefilled-opening "Each opening is one request that carries every setting (response time, listing, credit, collateral requests for every token), prefilled from the last opening the board voted. Voters see only what differs from last time."
            :ask-every-time "Each opening asks every setting from nothing."}
  :depends ['d-institution-unasked 'd-kernel-seeded]
  :decider 'maintainer
  :leaning 'prefilled-opening
  :because (protocol "core/entity/tx/handlers/account/lifecycle/open-account.ts" "Opening takes both response times, listing, a credit line, and a collateral request setting for the chosen token in the same step; the other standard tokens get the chain's defaults. A board's request runs its actions in order in one frame, and a change of collateral setting needs only that the account already exists in the entity's state, which the opening has just put there (core/entity/tx/handlers/account/lifecycle/admin.ts), so an opening and the setting changes for the other tokens can be one vote, with no moment in which unvoted settings are live. Prefilling from the last voted opening reads settings the runtime already holds, so nothing is kept beside the runtime (canon one-path-no-parallel). A sheet kept by the wallet between votes would be such a parallel store.")
  :changes-if "The maintainer says an entity's opening settings belong in the runtime (then setup-sheet), or that the collateral setting for other tokens cannot follow the opening inside one request; or boards shown prefilled openings vote them without reading what changed.")

(decision 'd-institution-who-holds
  :question "What does the organisation see about who holds its money?"
  :options {:per-counterparty "Only a line per counterparty: what is secured there, what they owe us beyond it, what we owe them."
            :two-totals "Two totals first, money that is secured and money we could lose, then the line per counterparty behind each."
            :one-total "One total, with the breakdown on request."}
  :depends ['d-institution-first-screen 'd-kernel-could-lose]
  :decider 'person-evidence
  :leaning 'two-totals
  :because (guess "Secured money and unsecured credit exposure must be kept apart in wallet balances (canon credit-secured-unsecured). There is no balance held by the network as a whole (law accounts-are-bilateral), so one total hides the only thing a finance lead must report to directors: how much rides on whom. Secured holds only while the board can answer inside the response time with the last state both sides signed (law keep-evidence), so every secured line says whether anything answers for the organisation while its people are away, and today that is not covered. No figure about a hub's own reserves is shown (canon no-reserve-dashboards).")
  :changes-if "An auditor or director shown the two totals asks for one balance figure for the books and cannot get it without adding the two by hand; then a third, labelled total is added beside them, not instead of them.")

(decision 'd-institution-savings-exposure
  :question "Where does spare cash placed with a hub count: as secured, as money we could lose, or apart?"
  :options {:count-as-could-lose "Savings count with that hub in money we could lose, beside what leaving would return for them."
            :apart "Savings are a third total, apart from secured and could-lose."
            :within-secured "Savings are offered only up to what would come back for certain on leaving, so they never add to what we could lose."}
  :depends ['d-institution-who-holds 'd-kernel-could-lose]
  :decider 'maintainer
  :leaning 'count-as-could-lose
  :because (guess "Leaving an account brings savings due at once (core/protocol/dispute/lending-covenant.ts): the claim becomes the principal plus interest earned so far, fixed when the dispute starts. Savings have no late window; the rules refuse one. Funding moves the principal to the hub's side (core/account/tx/handlers/balance/lending.ts), so I expect that claim to be certain only up to what is locked for us and the rest to be owed with nothing locked; I have not traced it through the contract. Counting it apart would let the board place cash and read a smaller could-lose figure than it carries. A cap of our own making is the kind of money limit the wallet may not invent (canon mainnet-open-participation).")
  :changes-if "The maintainer shows that savings are paid in a dispute from the hub's locked share ahead of everything else, so they are secured; then they count as secured.")

(decision 'd-institution-reach
  :question "How does the organisation keep receiving payments and answering counterparties when its people's machines are off, given that the keys that agree to spending are the same keys that must sign everything it receives?"
  :options {:office-hours "Accept that the organisation receives and answers only while enough members' machines are on, and sign a long response time. Payments sent to us while too few machines are on fail and go back to the payer, and nothing answers a counterparty that puts an old state on the chain until the board is back."
            :board-appoints-service "As office-hours for receiving, and ask the maintainer to let a board appoint the watching service by its own agreement, so disputes are answered while people are away."
            :always-on-board "Enough members' keys run on always-on machines that sign whatever is valid, so the organisation is always reachable; the people behind those keys then no longer approve spending by hand."
            :separate-keys "Ask the maintainer to separate the keys that keep the organisation answering from the keys that agree to spending."}
  :depends ['d-institution-board-path]
  :decider 'maintainer
  :leaning 'board-appoints-service
  :because (protocol "core/watchtower/last-resort-appointment.ts" "The authorisation a watching service receives is built with one key's signature (buildSingleSignerHanko), and I found no path in core that builds it for a board that must act together; so as I read it no watching service answers for this organisation today. Receiving needs no vote but needs the frame certified by members holding the threshold (law entity-signers), so payments to us fail while laptops are closed. Office-hours is honest but leaves a weekend in which an old state put on the chain is answered by nobody. A board appointing the service closes that without changing who agrees to spending; always-on keys would remove the agreement, and separate keys is the larger protocol change.")
  :changes-if "The maintainer shows that a board can already appoint the watching service, or that incoming payments are acknowledged without a quorum of the board's machines; then office-hours with the service is enough.")

(decision 'd-institution-response-time
  :question "How long does the organisation give itself to answer a counterparty on a new account?"
  :options {:standard-day "The standard twenty-four hours. Our own exits with a hub take about twenty-five hours, and a dispute started against us on a Friday evening may end before anyone is back."
            :weekend "Three days. A board that does not meet at weekends can still answer, and every exit on that account, our own included, takes about seventy-three hours with a hub."
            :by-what-is-at-stake "A day where little is secured with that counterparty, three days where much is."}
  :depends ['d-institution-reach]
  :decider 'person-evidence
  :leaning 'weekend
  :because (protocol "core/account/config/dispute-config.ts" "Each side's response time is fixed when the account opens: a day for a person, an hour for a hub, at most a year for both together. The window of any dispute is the two added together (law exit-timing), so a longer time for us also lengthens our own exits, and that cost falls on us as much as on the counterparty. While no watching service can answer for a board (d-institution-reach), our own response time is the only thing that lets a board that is away for a weekend answer an old state put on the chain.")
  :changes-if "Boards observed answer within a day even at weekends, or hubs refuse accounts whose response time is longer than a day; then standard-day.")

(decision 'd-institution-time-after-appointment
  :question "If a board can later appoint the watching service, what happens to the three-day response time?"
  :options {:new-accounts-day "New accounts open with a day once a service can answer for the board; existing accounts keep three days, since the time is fixed at opening, and the surface says which accounts have which."
            :keep-three-days "Every account keeps three days, appointed or not."
            :shorten-in-place "Ask the maintainer for a transaction, signed by both sides, that shortens the organisation's own time on a live account."}
  :depends ['d-institution-response-time 'd-institution-reach]
  :decider 'person-evidence
  :leaning 'new-accounts-day
  :because (protocol "core/account/config/dispute-config.ts" "Each side's response time is part of the account from its opening, and nothing changes it later, so a new choice reaches only new accounts unless accounts are moved. The three days exist because nothing answers for a board at a weekend; once a service can, three days only makes every exit the organisation starts about two days slower. Moving an account to a new one with the same counterparty is not possible, since an entity has one account per counterparty and opening a second is refused (core/entity/tx/handlers/account/lifecycle/open-account.ts); shortening in place is protocol work, for a gain that comes only when the organisation itself leaves, which is rare.")
  :changes-if "Organisations are seen leaving counterparties often enough that two extra days per exit costs more than moving; or the service's appointment for a board fails often enough that three days is still needed.")

(decision 'd-institution-secured-uncovered
  :question "While nothing answers for the organisation when its people are away, what does this surface call its locked share?"
  :options {:secured-not-covered "Secured, the shared word, with 'not covered' beside every secured line and total, since on this surface it is true of every account until a board can appoint the watching service."
            :count-as-could-lose "Counted with what could be lost until something answers for the organisation."
            :secured-alone "Secured, with cover shown only on the coverage screen."}
  :depends ['d-institution-who-holds 'd-institution-reach 'd-kernel-words 'd-kernel-secured]
  :decider 'maintainer
  :leaning 'secured-not-covered
  :because (canon 'keep-evidence "The locked share is the organisation's entitlement under the chain's rules, and the kernel keeps 'secured' meaning that in every face (d-kernel-secured), so calling it could-lose here would make the same account read worse on this face than on any other. But it holds only if the organisation answers an old state in time with the newest one both sides signed, and while no service answers for a board, that depends on a member being at a machine within the response time. So on this surface 'secured' never appears without 'not covered' until d-institution-reach is settled. Shown only on a separate screen, the word reads as safe to a director who never opens that screen.")
  :changes-if "The maintainer lets a board appoint the watching service, which removes the label; or directors shown 'secured, not covered' still report the money as safe.")

(decision 'd-institution-silent
  :question "What happens when a counterparty stops answering?"
  :options {:tell-and-wait "Show it, with how long it has been silent and what is at risk there; the board decides when to act and fills in the request itself."
            :ready-to-leave "Show it and fill in the request to leave that counterparty at once, so a member only has to put it and the others only have to vote. The surface never puts it by itself, since that would spend a member's only waiting request without asking them."
            :leave-by-rule "Leave automatically after a silence and an amount at risk the board set in advance."}
  :forces {:ready-to-leave ['d-institution-urgent-slot]}
  :depends ['d-institution-unasked 'd-institution-reach 'd-institution-response-time 'd-kernel-leave-once]
  :decider 'user
  :leaning 'ready-to-leave
  :because (guess "Leaving usually takes one vote, but not always. The voted step prepares the leaving, and if the evidence is stable at that moment it drafts the start at once (core/entity/tx/handlers/dispute/index.ts). If not, the account waits in a preparing state, and the start is drafted later, without a vote, when a deadline hook fires for that account (core/entity/scheduler/dispute-deadline-hook.ts) or when its open swap orders are confirmed removed (core/entity/tx/handlers/cross-j/book-removal-ack.ts). I have not confirmed that every prepared leaving gets such a hook, so a second vote may be needed, and the kernel's leaving flow must say which. Once started, the runtime's scheduler finishes it after the window without anyone asking (core/entity/scheduler/due-hooks.ts). Each hour spent gathering the vote is added to a wait that is already the sum of both response times (law exit-timing): twenty-five hours with the standard times, about seventy-three with the weekend time. A filled-in request kept on a member's device until they put it is a draft held by the wallet: it states no figure the runtime does not state and starts nothing, but it is wallet-held state, and if one-path-no-parallel is read to forbid even drafts, tell-and-wait is what remains. Leaving by rule is refused by the shared base (k-default-no-leaving-alone).")
  :changes-if "Organisations report that silences of a few hours are routine with their counterparties and a ready request trains the board to ignore them; then tell-and-wait with a longer threshold of silence.")

(decision 'd-institution-urgent-slot
  :question "When something urgent must go to the board and members already have requests waiting, who puts it?"
  :options {:first-free-member "Whoever has no request waiting; if every member has one, the board first votes one of them down."
            :kept-free-member "One member agrees never to put routine requests such as runs, so that member can always put an urgent one at once."
            :author-withdraws "Ask the maintainer to let a member withdraw their own waiting request."}
  :depends ['d-institution-batching]
  :decider 'person-evidence
  :leaning 'kept-free-member
  :because (protocol "core/entity/tx/processing/proposals.ts" "Each member may have one request waiting and the organisation up to a hundred. A waiting request leaves only when it runs or enough members vote no, and its author cannot vote no on it, because their yes is counted when they put it (core/entity/tx/handlers/system/basic.ts). Only the case where every member has a request waiting is stuck. If the finance lead puts the runs, a second member who keeps their slot free can put an urgent request without voting anything down; the cost is that this member must be reachable.")
  :changes-if "The maintainer lets an author withdraw a waiting request, which removes the problem; or boards observed always have a free member anyway, so first-free-member is enough.")

(decision 'd-institution-delivery
  :question "Which payment deadline do our own payments through hubs use?"
  :options {:short "The short deadline: a payment that cannot arrive comes back within minutes."
            :day-long "The day-long deadline: a payment waits up to a day for a recipient who is away, holding our money meanwhile."
            :by-recipient "Short for recipients who are always on, such as hubs and shops; day-long for recipients that are boards like us."}
  :depends ['d-institution-reach 'd-kernel-held-pay-not-allowed]
  :decider 'maintainer
  :leaning 'by-recipient
  :because (canon 'htlc-constants-are-simnet "No real-funds payment through hubs on an EVM mainnet until the deadline values are decided per chain, so whichever mode this surface prefers, the numbers behind it are the maintainer's, and until then such payments with real money are not offered there. Between the modes: the short one returns a failed payment quickly, which suits a run; but another organisation whose machines are off cannot claim within minutes, so paying a board in the short mode fails for the same reason payments to us do.")
  :changes-if "The decided per-chain deadlines make the short one long enough for an organisation to claim, or the surface cannot tell which recipients are boards; then short.")

(decision 'd-institution-refuses
  :question "Which things that the protocol can do does this surface refuse to offer?"
  :options {:money-desk "It offers paying, receiving, opening accounts, credit lines to counterparties, savings and leaving. It refuses swap orders, swaps across chains, borrowing, running a hub, and anything about ownership shares."
            :with-swaps "As money-desk, but it also offers changing one currency into another at a hub, behind a vote."
            :everything "It offers every action the protocol has, each behind a vote."}
  :depends ['d-institution-who 'd-institution-board-path]
  :decider 'maintainer
  :leaning 'money-desk
  :because (canon 'launch-flows "The wallets together must carry Pay, same-chain Swap, cross-chain Swap and Lending on EVM and native TRON, but not every surface must carry every flow. Here, paying, receiving, credit, savings and leaving are offered on both launch chains, with the limits each chain has (no real-funds payments through hubs on an EVM mainnet yet; no watching service on TRON). Same-chain swap is carried by the trader surface and by the private surface's currency change, cross-chain swap by the trader surface, and borrowing by the borrowing app; Lending's savings side is carried here. A resting swap order needs someone watching prices, which a board that meets by vote cannot do; a loan is a debt whose terms the board would have to approve; shares are out of this launch (canon out-of-launch-scope).")
  :changes-if "Organisations observed pay suppliers in a currency they do not hold often enough that a conversion at the moment of paying is part of paying; then with-swaps, limited to a swap that fills at once.")

(decision 'd-institution-record
  :question "Who keeps the record of what the organisation agreed, who agreed, and what it changed?"
  :options {:runtime-history "Rely on the history the runtime keeps now, which is bounded."
            :kept-for-the-institution "The runtime itself keeps the organisation's own signed frames, with every request and vote in them, for as long as the organisation chooses; the shared base only reads and exports them."
            :protocol-keeps "The protocol keeps finished requests and their votes in the organisation's state."
            :outside-the-wallet "The organisation keeps its own copy of the signed history outside the wallet, with its own tools."}
  :decider 'maintainer
  :leaning 'kept-for-the-institution
  :because (protocol "core/entity/tx/processing/proposals.ts" "Finished and rejected requests are removed from the organisation's state; the only record is the signed frame in the runtime's history, which is bounded, and a change of board deletes requests still waiting. Each party must retain its own evidence (law keep-evidence), so the record is the organisation's to keep. Keeping it in the runtime and not in a store beside it is what one-path-no-parallel allows. Until the runtime keeps it, the record screen and the audit flow are not offered at all (no-stubs-in-flows), not offered with a partial record.")
  :changes-if "The maintainer shows that the runtime history an organisation can retain is already complete and unbounded for its own frames, or says that keeping it belongs outside the wallet entirely.")

(decision 'd-institution-auditor
  :question "How does the auditor see what the organisation did?"
  :options {:handed-record "The organisation hands the auditor a record for a period, which the auditor can check against the signed history without any access to the wallet."
            :read-only-seat "The auditor has a view of the wallet that can read everything and sign nothing."
            :board-seat "The auditor is a board member with a small weight."}
  :depends ['d-institution-record]
  :decider 'user
  :leaning 'handed-record
  :because (guess "Every board member must hold a weight above zero and every member may propose and vote (core/entity/auth/authorization.ts), so a board seat for the auditor would give them a voice in what they audit. A read-only seat is a second kind of person on this surface; a handed record keeps one person per surface and gives the auditor exactly the period they audit.")
  :changes-if "An auditor says a record handed over by the audited party is worth nothing to them unless they can see the live wallet, or the user wants the auditor to have a surface of their own.")

(decision 'd-institution-signer-change
  :question "What happens when someone with signing rights leaves the organisation or loses their key?"
  :options {:company-path "Replace the board through the shareholders' path, which brings share machinery into this launch."
            :margin-and-move "Set up the board so that it still agrees with one person missing; replacing people is not offered, and an organisation that must replace someone leaves every counterparty and starts again as a new organisation."
            :board-replaces-itself "The remaining members vote a new board, which takes effect after a waiting period; the runtime has to learn to submit it, and the maintainer has to rule that it is not company machinery."}
  :depends ['d-institution-board-size]
  :decider 'maintainer
  :leaning 'board-replaces-itself
  :because (protocol "jurisdictions/contracts/EntityProvider.sol" "The chain lets a board propose its own successor with one authorisation from the current board; it takes effect after the entity's control delay, one day by default, unless shareholders override it. The runtime, as far as I read it, submits only the shareholders' form (core/jurisdiction/adapter/rpc/write/rpc-submit-entity-provider.ts). This lane removes a departed member who still holds a key, as long as the others reach the threshold without them; a margin only covers absence, not a former colleague who can still vote. Starting again as a new organisation is no remedy: it needs every counterparty's help or a full exit window per account, anything beyond the secured share may never come (law unsecured-no-seizure), and if more members are gone than the margin allows, the old organisation cannot even begin to leave, since leaving is a collective action (core/entity/auth/authorization.ts). A change of board also deletes every request still waiting (core/entity/tx/processing/proposals.ts).")
  :changes-if "The maintainer rules the board lane to be company machinery outside this launch; then margin-and-move, with the move to a new organisation designed as a flow and said at setup. Or the board lane turns out to need the shareholders' path after all.")

;; ─────────────────────────────────────────────────────────────────────────────
;; 3. The surface that follows
;; ─────────────────────────────────────────────────────────────────────────────

(surface 'institution-wallet :for 'institution :first 'institution-today
  :because ['d-institution-angle 'd-institution-who 'd-institution-first-screen 'd-institution-board-path])

(screen 'institution-today :in 'institution-wallet
  :answers "What is waiting for one of us to decide today?"
  :shows ['account-status 'exit-ends-at 'exit-started-by-left 'fee-notice]
  :offers ['institution-approve-flow 'institution-leave-flow 'k-leave-flow 'institution-settle-flow]
  :because ['d-institution-first-screen 'd-institution-batching 'd-institution-silent 'd-institution-urgent-slot])

(screen 'institution-run :in 'institution-wallet
  :answers "What would this run pay, to whom, and at most at what cost?"
  :shows ['pay-most-debited 'can-send]
  :offers ['institution-pay-flow 'institution-approve-flow]
  :because ['d-institution-batching 'd-institution-vote-shows 'd-institution-fee-margin 'd-institution-delivery])

(screen 'institution-holders :in 'institution-wallet
  :answers "How much of our money could we lose, and with whom?"
  :shows ['collateral-mine 'owed-to-me-unsecured 'owed-by-me-unsecured 'credit-i-grant 'credit-granted-to-me 'loan-principal 'loan-interest-so-far]
  :offers ['institution-position-flow 'institution-credit-flow 'institution-leave-flow 'institution-open-flow 'institution-fund-flow 'k-move-in-out-flow]
  :because ['d-institution-who-holds 'd-institution-first-screen 'd-institution-savings-exposure 'd-institution-reach 'd-kernel-could-lose 'd-institution-secured-uncovered])

(screen 'institution-counterparty :in 'institution-wallet
  :answers "What do we hold, owe and are owed with this one counterparty?"
  :shows ['account-status 'collateral-mine 'collateral-theirs 'owed-to-me-unsecured 'owed-by-me-unsecured 'credit-i-grant 'credit-left-to-them 'held-outgoing 'held-incoming 'top-up-pending 'fee-notice 'top-up-rate 'exit-window-left 'exit-window-right 'loan-principal]
  :offers ['institution-credit-flow 'institution-leave-flow 'k-leave-flow 'institution-pay-flow 'institution-settle-flow]
  :because ['d-institution-who-holds 'd-institution-silent 'd-institution-setup 'd-institution-response-time])

(screen 'institution-incoming :in 'institution-wallet
  :answers "Which payments reached us, from whom, for what, and which are ours for good?"
  :shows ['pending-amount 'held-incoming 'can-receive]
  :offers ['institution-get-paid-flow]
  :because ['d-institution-unasked 'd-institution-who-holds 'd-institution-reach])

(screen 'institution-spare-cash :in 'institution-wallet
  :answers "How much of our spare cash would come back if whoever holds it stopped paying?"
  :shows ['loan-principal 'loan-rate 'loan-interest-so-far 'loan-term 'collateral-mine 'collateral-theirs]
  :offers ['institution-savings-flow 'institution-leave-flow]
  :because ['d-institution-refuses 'd-institution-savings-exposure])

(screen 'institution-opening :in 'institution-wallet
  :answers "On what terms would we start working with this counterparty?"
  :shows ['exit-window-left 'exit-window-right 'credit-i-grant 'auto-top-up-at 'auto-top-up-max-fee 'top-up-rate]
  :offers ['institution-open-flow]
  :because ['d-institution-setup 'd-institution-response-time])

(screen 'institution-record :in 'institution-wallet
  :answers "What did we agree, who agreed to it, when, and what did it change?"
  :shows []
  :offers ['institution-audit-flow]
  :because ['d-institution-record 'd-institution-auditor])

(flow 'institution-pay-flow :in 'institution-wallet :job 'institution-pay
  :signs ['signed-command 'board-propose 'pay-routed 'pay-direct]
  :uses ['k-effect 'k-batch 'k-board 'k-question 'k-pay-note 'k-real-or-test 'k-causes]
  :ends (guess "The finance lead knows the run is waiting for the others, who has been asked, the most it can cost in total, and that nothing has left yet. At the last vote either every payment in the run leaves or none does: if one can no longer leave within its most, the vote is refused with the cause and the run keeps waiting until it is voted down. Once the run has left, they know payment by payment which arrived and which came back with their reason (law pay-fails-returns).")
  :because ['d-institution-batching 'd-institution-vote-shows 'd-institution-board-path 'd-institution-fee-margin 'd-institution-delivery])

(flow 'institution-approve-flow :in 'institution-wallet :job 'institution-approve
  :signs ['signed-command 'board-vote]
  :uses ['k-board 'k-effect 'k-question 'k-causes]
  :ends (guess "The board member knows what their yes or no changed: still waiting and for whom, carried out, refused at the last vote and why, or dropped because enough members said no. They know that once a payment has left, nobody can recall it before its deadline (law payer-cannot-recall).")
  :because ['d-institution-vote-shows 'd-institution-batching])

(flow 'institution-get-paid-flow :in 'institution-wallet :job 'institution-get-paid
  :signs []
  :uses ['k-holdings 'k-pay-note 'k-attention 'k-causes]
  :ends (guess "The finance lead knows which payments arrived, the note each carried to match it to an invoice, and which are still only promised and not yet ours. Claiming them needed no vote, and none of them raised what a customer owes us beyond the line the board voted. They can see the hours in which too few of the board's machines were on, when payments sent to us went back to the payer.")
  :because ['d-institution-unasked 'd-institution-who-holds 'd-institution-reach])

(flow 'institution-position-flow :in 'institution-wallet :job 'institution-position
  :signs []
  :uses ['k-holdings 'k-leaving-sums 'k-evidence]
  :ends (guess "The finance lead can tell a director, per counterparty, what is secured, what is owed to us with nothing behind it (savings included), what we owe, and that what is owed beyond the secured part may be lost if that counterparty fails (canon show-unsecured-as-receivable). They can also say that secured means secured only if the board answers in time, and that no service answers for us while we are away.")
  :because ['d-institution-who-holds 'd-institution-savings-exposure 'd-institution-reach])

(flow 'institution-credit-flow :in 'institution-wallet :job 'institution-credit
  :signs ['signed-command 'board-propose 'grant-credit]
  :uses ['k-effect 'k-board 'k-question 'k-standing-rules]
  :ends (guess "The board knows the new most that counterparty may owe us without anything locked, that it applies once enough of them agreed, and that lowering it later does not erase what is already owed (law credit-cut-keeps-debt).")
  :because ['d-institution-refuses 'd-institution-board-path 'd-institution-setup])

(flow 'institution-open-flow :in 'institution-wallet :job 'institution-open
  :signs ['signed-command 'board-propose 'open-account 'set-auto-top-up]
  :uses ['k-effect 'k-board 'k-question 'k-counterparty-terms 'k-standing-rules]
  :ends (guess "The board knows which counterparty the organisation now has an account with, that nothing is owed either way, and every setting the opening put in place, in money and hours, with what differs from the last opening they voted. No setting was live before the vote.")
  :because ['d-institution-setup 'd-institution-unasked 'd-institution-response-time])

(flow 'institution-settle-flow :in 'institution-wallet
  :signs ['signed-command 'board-propose 'settle-approve 'settle-reject]
  :uses ['k-effect 'k-board 'k-question]
  :ends (guess "The board knows that a counterparty's proposal to move money between our account and the chain, which takes from our side, was agreed or turned down by vote, and what it changed. Proposals that only add to our side were signed without them, and they can see those too.")
  :because ['d-institution-unasked])

(flow 'institution-savings-flow :in 'institution-wallet :job 'institution-savings
  :signs ['signed-command 'board-propose 'lend 'lend-withdraw]
  :uses ['k-effect 'k-board 'k-question 'k-holdings 'k-leaving-sums]
  :ends (guess "The board knows how much is placed, with which hub, at what rate and for how long, and that taking it back is a request the hub completes with a payout, not something the organisation does alone. They know what they can do if the hub does not pay out: leave that account, which brings the savings and interest earned so far due at once, and how much of that would come back for certain and how much could be lost.")
  :because ['d-institution-refuses 'd-institution-board-path 'd-institution-savings-exposure])

(flow 'institution-leave-flow :in 'institution-wallet :job 'institution-leave
  :signs ['signed-command 'board-propose 'board-vote]
  :uses ['k-silence 'k-leaving-sums 'k-board 'k-question 'k-attention 'k-evidence]
  :ends (guess "This flow is the board's step: putting the request to leave and voting on it; the shared leaving flow signs the leaving itself. The board knows that one vote started the organisation leaving that counterparty, that putting it on the chain and finishing after the window happen without another vote, when the waiting ends (both response times added), what it will get back for certain and what remains only a claim on whatever the counterparty later holds (law exit-alone), shown as three separate things (canon recovery-times-shown-apart).")
  :because ['d-institution-silent 'd-institution-reach 'd-institution-board-path 'd-institution-urgent-slot 'd-institution-response-time 'd-kernel-leave-once])

(flow 'institution-fund-flow :in 'institution-wallet :job 'institution-fund
  :signs ['signed-command 'board-propose 'board-vote]
  :uses ['k-chain-money 'k-effect 'k-board 'k-question 'k-real-or-test 'k-causes]
  :ends (guess "This flow is the board's step; the shared flow for bringing money in and out makes the chain steps. The board knows that one vote carried bringing money in or taking it out, which chain steps followed, what each cost and how long each waited, and where the money is now; money sent out to an address left the protocol.")
  :because ['d-kernel-money-in-out 'd-institution-board-path])

(flow 'institution-audit-flow :in 'institution-wallet :job 'institution-audit
  :signs []
  :uses ['k-record]
  :ends (guess "Once the record is kept, the finance lead has handed the auditor a record for the period: every request, who voted which way, what ran, and the effect on each counterparty, which the auditor can check against the signed history without access to the wallet. Until it is kept, this flow is not offered.")
  :because ['d-institution-record 'd-institution-auditor])

(gap 'institution-signers-gap :job 'institution-signers
  :why (guess "Replacing a member needs either the board lane the chain already has, which the runtime does not yet submit, or the shareholders' path, which is outside this launch (see d-institution-signer-change). Until the maintainer decides, the surface proposes a board that still agrees with one person missing and says at setup that replacing people is not yet offered."))

(default 'institution-default-credit :in 'institution-wallet
  :value "No credit granted to any counterparty when an account opens; a credit line exists only after a vote."
  :risk-on 'nobody
  :because ['d-institution-setup 'd-institution-board-path])

(default 'institution-default-auto-top-up :in 'institution-wallet
  :value "In the same request that opens the account, automatic collateral requests are given a fee limit of zero on every token, so none can cost a fee, until the board votes a trigger and a fee limit for them. Whether a trigger of zero means never ask is not confirmed."
  :risk-on 'holder
  :because ['d-institution-unasked 'd-institution-setup])

(default 'institution-default-unlisted :in 'institution-wallet
  :value "New accounts are not listed publicly, so the organisation's counterparties are not advertised."
  :risk-on 'holder
  :because ['d-institution-setup])

(default 'institution-default-delivery :in 'institution-wallet
  :value "Payments to hubs and shops use the shorter deadline the maintainer sets for that chain, payments to other organisations the day-long one; on an EVM mainnet no payment through hubs with real money is offered until those deadlines are decided."
  :risk-on 'holder
  :because ['d-institution-delivery 'd-institution-setup])

(default 'institution-default-route :in 'institution-wallet
  :value "Each payment goes by the cheapest route quoted when the run is prepared, and the hubs it passes through are named to every voter."
  :risk-on 'holder
  :because ['d-institution-vote-shows 'd-institution-setup])

(default 'institution-default-claim-incoming :in 'institution-wallet
  :value "Payments to us are claimed as soon as enough of our machines are on, with no vote; they can raise what a counterparty owes us only up to the credit line the board voted."
  :risk-on 'holder
  :because ['d-institution-unasked 'd-institution-reach])

(default 'institution-default-add-only-settlements :in 'institution-wallet
  :value "A settlement a counterparty proposes that only adds to our side is signed with no vote; any settlement that takes from us waits for the board."
  :risk-on 'nobody
  :because ['d-institution-unasked])

(default 'institution-default-fee-cap :in 'institution-wallet
  :value "The most each payment may cost is the quote when the run is prepared plus a margin the board voted once; voters see that most, and one payment above it holds the whole run until it is voted down and prepared again."
  :risk-on 'holder
  :because ['d-institution-fee-margin 'd-institution-vote-shows 'd-institution-batching])

(default 'institution-default-response-time :in 'institution-wallet
  :value "Three days on every new account, so a board away for a weekend can still answer; our own exits on that account then take about seventy-three hours with a hub. Every account is shown as not covered by a watching service until a board can appoint one."
  :risk-on 'holder
  :because ['d-institution-response-time 'd-institution-reach 'd-institution-setup 'd-institution-time-after-appointment])

(default 'institution-default-board-margin :in 'institution-wallet
  :value "At setup the surface proposes four seats, three of which must agree; for a board of three it says which it gives up, the margin or the safe threshold, and it says plainly who, if anyone, can act alone."
  :risk-on 'holder
  :because ['d-institution-board-size 'd-institution-signer-change 'd-institution-board-path])

(default 'institution-default-silent-after :in 'institution-wallet
  :value "A counterparty counts as silent after four working hours without answering something we signed; the request to leave it is then filled in, and nobody is asked to put it until a member chooses to."
  :risk-on 'holder
  :because ['d-institution-silent 'd-institution-urgent-slot])

;; ─────────────────────────────────────────────────────────────────────────────
;; 4. What this surface needs from the shared base
;; ─────────────────────────────────────────────────────────────────────────────

(need 'institution-needs-board-state :of 'institution-wallet
  :wants (guess "Know which requests are waiting, who prepared each, who has said yes or no, how much more agreement each needs, and which members are blocked by their own waiting request, so an urgent request can go to a member who is free.")
  :because ['d-institution-board-path 'd-institution-first-screen 'd-institution-batching 'd-institution-urgent-slot])

(need 'institution-needs-money-effect :of 'institution-wallet
  :wants (guess "For any set of actions not yet run, know from the runtime what it would change with each counterparty: what we would hold, owe and be owed, and the most it can cost. The surface must not work this out itself (canon frontend-is-ui-only).")
  :because ['d-institution-vote-shows])

(need 'institution-needs-run :of 'institution-wallet
  :wants (guess "Put many payments to many recipients before the board as one request; know before the last vote whether every one of them can still leave within its most; and learn afterwards, payment by payment, which arrived and which came back and why.")
  :because ['d-institution-batching 'd-institution-fee-margin])

(need 'institution-needs-deadlines :of 'institution-wallet
  :wants (guess "One list, across every counterparty, of what a vote can still change before a deadline: a counterparty leaving against us, fee rises under notice, waiting requests, counterparties gone silent.")
  :because ['d-institution-first-screen 'd-institution-reach])

(need 'institution-needs-silence :of 'institution-wallet
  :wants (guess "Know that a counterparty has stopped answering, since when, and how much is at risk with it, before anyone has to ask.")
  :because ['d-institution-silent])

(need 'institution-needs-standing-rules :of 'institution-wallet
  :wants (guess "See every rule that can sign or spend for the organisation without a vote, with its limit, and change any of them only by a vote.")
  :because ['d-institution-unasked 'd-institution-setup])

(need 'institution-needs-coverage :of 'institution-wallet
  :wants (guess "Know, per counterparty, whether anything answers for the organisation while its people are away, and say not covered wherever nothing does.")
  :because ['d-institution-reach 'd-institution-who-holds])

(need 'institution-needs-record :of 'institution-wallet
  :wants (guess "Read, from the runtime's own keeping, a complete record of every request, vote and action the organisation's board signed, for as long as the organisation chooses, and produce it for a chosen period in a form someone outside can check against the signed history.")
  :because ['d-institution-record 'd-institution-auditor])

(need 'institution-needs-wake :of 'institution-wallet
  :wants (guess "Reach each board member's own device when a counterparty starts leaving against the organisation, so members away from their machines can still gather the vote or the answer in time.")
  :because ['d-institution-reach 'd-kernel-reach-channel])

(need 'institution-needs-payment-note :of 'institution-wallet
  :wants (guess "Carry a short note with each payment, ours and the ones we receive, so a payment can be matched to an invoice.")
  :because ['d-institution-unasked 'd-institution-who-holds])
