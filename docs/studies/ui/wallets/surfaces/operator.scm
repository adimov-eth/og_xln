;; surfaces/operator.scm — the wallet surface for a hub operator.
;; Order: the person, then the decisions, then the surface that follows, then what it needs
;; from the shared base. Ids start with operator- (decisions with d-operator-).

;; ─────────────────────────────────────────────────────────────────────────────
;; 1. The person
;; ─────────────────────────────────────────────────────────────────────────────

(person 'operator
  :is (guess "Someone who runs a hub: one entity per chain, on a server they control, with many customers holding accounts with it and paying through it. Automation on the server does the routine work; the person looks in a few times a day and is woken when something goes wrong.")
  :came-for (guess "To learn whether the hub is safe and earning, and to act on the few things the automation could not settle by itself: money on the chain running short, a customer who stopped answering, a customer leaving through the chain, a price change, a credit decision, a customer asking what happened.")
  :cannot [(guess "They cannot approve each forwarded payment, each swap fill or each credit request one by one. A hub with many customers makes thousands of these a day.")
           (guess "They cannot read every account. Anything that needs them must be brought to them; they will not find it by scrolling.")
           (protocol "core/account/config/dispute-config.ts" "They cannot be counted on to be awake when a customer leaves through the chain. The hub's own signed response time is one hour by default, against twenty-four hours for anyone else; law exit-timing says today's code adds both to a window of about twenty-five hours, and that this may change.")
           (canon 'no-solvency-proofs "They must never be asked to publish their money on the chain or their exposure as a promise to customers.")
           (protocol "core/entity/tx/handlers/account/lifecycle/admin.ts" "A change of the hub's terms is sent to every account it has at once, and any value left out falls back to its code default, so they must never be asked to sign one without first seeing its full reach.")]
  :jobs [(job 'operator-check :wants (guess "Tell me whether anything needs me right now, or whether I can close this."))
         (job 'operator-money :wants (guess "Show me where my money is on each chain and how much of it I could lose."))
         (job 'operator-refill :wants (guess "Make sure I can lock the money customers already paid me to lock for them."))
         (job 'operator-prices :wants (guess "Change what I charge, and know who it reaches and from when."))
         (job 'operator-credit :wants (guess "Decide how much each customer may owe me, and see every limit I did not set myself."))
         (job 'operator-lend :wants (guess "Decide who may borrow from me, how much and until when, and see who owes me what by which date."))
         (job 'operator-silent :wants (guess "Deal with a customer who stopped answering while my money is tied up with them."))
         (job 'operator-leaving :wants (guess "Know when a customer leaves without me, and that my side was answered in time."))
         (job 'operator-earnings :wants (guess "Take what the hub earned out to where I keep my money."))
         (job 'operator-one-customer :wants (guess "A customer wrote to me: find them and see what happened to their payment or request."))
         (job 'operator-pause :wants (guess "Stop the hub taking on anything new until I understand what is going on."))
         (job 'operator-setup :wants (guess "Start a new hub, or open it on another chain."))])

;; ─────────────────────────────────────────────────────────────────────────────
;; 2. The decisions
;; ─────────────────────────────────────────────────────────────────────────────

(decision 'd-operator-who
  :question "Who exactly is the hub operator this surface is for?"
  :options {:own-team "The protocol's own team, running the launch hubs."
            :independent "An independent business running its own hub with its own money."
            :signing-team "An organisation where several people must agree before the hub acts."}
  :forces {:signing-team ['d-operator-sign-ask]}
  :decider 'user
  :leaning 'independent
  :because (guess "docs/launch-design.md records that at launch the protocol's team operates the hubs H1 to H3 itself, and independent operators come later. Designing only for the team would give an internal console that its first outside operator cannot use; designing for an independent operator still serves the team. An organisation with several signers is what the institution surface is for, and running it here would duplicate it.")
  :changes-if "The user says the operator surface is internal to the protocol team for launch, or the first independent operators turn out to be organisations that require several signers for every term change."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-operator-where-runs
  :question "Does the hub run inside this surface, or does the surface reach a hub running elsewhere?"
  :options {:remote "The hub runs on a server with its automation; this surface reads it and sends it the operator's instructions."
            :inside "The hub runs inside the operator's wallet and works only while the wallet is open."}
  :forces {:remote ['d-operator-who-signs 'd-operator-hub-down]}
  :depends ['d-operator-who]
  :decider 'maintainer
  :leaning 'remote
  :because (protocol "core/orchestrator/hub-node.ts" "Today a hub is started as a server process, and its automation (filling paid requests, closing finished disputes, answering a customer who leaves) runs on a timer inside that runtime. A hub that sleeps when a browser tab closes misses those deadlines, and the launch scope excludes desktop and extension shells that could keep it awake.")
  :changes-if "The maintainer decides launch hubs are operated from a wallet that stays open, or the runtime offers no authenticated way for a wallet to reach a server hub as its operator.")

(decision 'd-operator-who-signs
  :question "Whose key signs what the operator instructs the hub to do?"
  :options {:hub-key-wallet-asks "The hub signs everything with its own key on the server. The wallet asks the operator before it sends an instruction of the asked kinds over its admin connection; the hub itself checks nothing per kind, so anyone holding an admin token or the server can have it sign anything."
            :hub-key-hub-checks "As above, but the hub refuses the asked kinds unless the instruction carries the operator's yes. Needs runtime work: no per-kind check exists."
            :operator-key-on-board "The hub entity's board holds the server's key and the operator's key, and the kinds the operator is asked about need the operator's own key. Today a board's threshold is the same for every action, so this needs per-kind thresholds in the runtime."}
  :depends ['d-operator-where-runs 'd-kernel-app-door 'd-kernel-floor-holds-where]
  :decider 'maintainer
  :leaning 'hub-key-wallet-asks
  :because (protocol "core/api/runtime-adapter/security/auth.ts" "A connection to a runtime is authenticated with a token at one of two levels, inspect or admin, valid at most a day, and the hub process derives its own admin token from its seed (core/orchestrator/hub-node.ts). An admin token is full authority, and nothing separates kinds of action. So with the hub on a server, the question before a signature protects the operator from their own mistakes and nothing more. Requiring the operator's key for some kinds would stop the hub whenever the operator is away, unless the board could require it for those kinds only, which it cannot today. I lean to what runs and to saying plainly what it does not protect.")
  :changes-if "The maintainer builds the scoped grants docs/agent-payments.md lists as remaining work, or per-kind thresholds on a board, so that the operator's key can be required for the asked kinds without stopping routine work.")

(decision 'd-operator-scope
  :question "Does one surface show one hub on one chain, or the operator's hubs on every chain together?"
  :options {:one-hub "One hub entity on one chain at a time; to see another, switch."
            :all-chains "Every hub entity the operator runs, each chain shown on its own and never added together."}
  :depends ['d-operator-who]
  :decider 'user
  :leaning 'all-chains
  :because (guess "An operator at launch runs sibling entities on the Ethereum and TRON chains; a problem on either needs them, so switching hides half of what needs attention. Money on different chains is not interchangeable, so totals stay per chain and per token and are never summed across chains. The chains also differ in protection: the watching service does not submit on native TRON (core/watchtower/submission-support.ts), so customer exits on the TRON hub are shown as not covered when the hub is down.")
  :changes-if "Watching operators shows that each chain is run by a different person, or that a combined view leads someone to read money on one chain as available on the other."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-operator-first-screen
  :question "What does the first screen answer?"
  :options {:needs-me "What needs me now that the hub could not handle on its own?"
            :money "Where is my money, and how much of it could I lose?"
            :earnings "What did the hub earn?"}
  :depends ['d-operator-who 'd-operator-where-runs]
  :decider 'person-evidence
  :leaning 'needs-me
  :because (guess "Routine work is automatic, so the operator opens this either because they were woken or to confirm nothing is wrong. The things that cost money have deadlines: a paid request waiting on money that is not there, a customer leaving, a silent customer holding payments, a copy the watching service failed to take. A first screen of totals makes them hunt for those.")
  :changes-if "Operators shown both first screens go to the money view first in most sessions, or a week of real operation produces almost nothing the automation could not handle.")

(decision 'd-operator-hub-down
  :question "Who tells the operator that the hub itself has stopped, stalled or lost the chain?"
  :options {:stale-shown "The surface shows how old the hub's last report is and never says nothing needs you from an old one; the watching service wakes the operator when a customer starts leaving; any other alarm about the server is the operator's own monitoring."
            :outside-watcher "A watcher outside the hub process checks that the hub keeps producing frames and reaching the chain, and wakes the operator when it does not."}
  :depends ['d-operator-where-runs 'd-kernel-evidence]
  :decider 'maintainer
  :leaning 'stale-shown
  :because (guess "Every deadline the hub keeps runs on a timer inside the hub's own runtime (core/entity/scheduler/dispute-deadline-hook.ts), and the list of what needs the operator is built by that runtime, so a stopped hub reports an empty list. Two kinds of deadline differ. A customer leaving gives about a day, long enough for a person; the watching service is meant to see it on the chain without the hub. A payment the hub passed on runs on minutes: if the recipient's side is paid while the hub is down past the payer's deadline, I expect the hub loses that amount, and no person woken in time can save it; only a hub that restarts by itself can. So a person-facing alarm for a stuck process adds little, and restarting it belongs to the server. I lean to what exists, and to saying plainly how old the report is. Not verified: the payment loss path and what dispute-watch covers for a hub.")
  :changes-if "A hub outage in testing lasts hours without its server tooling noticing, or the maintainer says watching the hub process belongs in the runtime rather than in each operator's server tooling.")

(decision 'd-operator-defaults
  :question "Which choices that put the operator's money at risk are made before the operator chooses?"
  :options {:keep-shown "Keep the values the runtime installs today, and show each one, who set it and what it risks, until the operator changes it."
            :ask-before-customers "The hub takes no new customer until the operator has answered each risky value once; until then it serves only existing accounts. Needs the runtime to let a hub refuse new accounts, which it cannot today."
            :keep-silent "Keep the values and show them only on request."}
  :forces {:ask-before-customers ['d-operator-auto-credit 'd-operator-pause]}
  :depends ['d-operator-where-runs 'd-kernel-seeded]
  :decider 'maintainer
  :leaning 'ask-before-customers
  :because (protocol "core/entity/tx/handlers/account/lifecycle/admin.ts" "Declaring a hub fills in a forwarding fee of one millionth, no flat fee, no swap fee, a collateral fee of one hundredth of a percent, thirty days of notice, a ten-minute refund time, automatic closing of finished exit cases and largest-first filling of paid requests; the hub process also publishes default lending terms once at start (core/orchestrator/hub-node.ts). With the automatic credit answer and the one-hour response time, these are the hub's whole risk policy, and nobody chose them. Showing them is necessary and is done under every option, on operator-rules and as attention items, but showing is not choosing. Asking before the first customer needs the hub to hold off new accounts until answered, the same switch d-operator-pause needs. Until the maintainer builds it, the surface can only show.")
  :changes-if "The maintainer says hubs with real money are set up only from reviewed configuration, so no operator ever runs on code defaults, or says a hub refusing new accounts breaks a launch flow.")

(decision 'd-operator-auto-credit
  :question "Should the hub grant credit by itself to every customer who asks?"
  :options {:keep-code-cap "Keep it: any customer who asks gets a line up to the cap set in code, about 1,000 dollars' worth per token, and a line cut below that is raised again on the next request."
            :operator-cap "The operator sets the cap per token and chain, zero included, and the hub answers within it. Needs a new hub setting in the runtime."
            :no-auto-answer "The hub does not answer requests by itself; the operator grants lines by hand to the customers they choose. Needs a switch in the runtime."}
  :depends ['d-operator-defaults 'd-kernel-floor-rules 'd-kernel-hub-credit]
  :decider 'maintainer
  :leaning 'operator-cap
  :because (protocol "core/entity/tx/handlers/account/credit-request.ts" "Any hub answers every customer's credit request by itself, raising the line to the requested amount or the code cap, whichever is lower, and never lowering a larger line. The cap is a function of the token in code; no transaction sets it or turns it off. So a cut the operator makes by hand holds only until the customer asks again. An operator-set cap matches the kernel's leaning that a capped standing rule set by a fresh yes may raise credit, and keeps a hub with thousands of customers workable. No automatic answer is safe but turns every credit line into handwork.")
  :changes-if "The maintainer says the cap is a testnet onboarding device that will not exist on real money, or that credit requests are meant to be answered by an approval service the operator configures.")

(decision 'd-operator-sign-ask
  :question "When is the operator asked before the hub signs, and when not?"
  :options {:leaving-or-all "Ask before anything that sends the hub's money off its accounts, changes terms for every customer, raises one customer's credit by hand, approves a borrower, or starts a customer's exit; never for routine work. While the operator does not answer, routine work goes on and the asked action waits."
            :above-amount "Ask before anything above an amount the operator sets, whatever its kind."
            :never "Nothing is asked; every action follows the policy the operator set."}
  :depends ['d-operator-where-runs 'd-operator-who-signs 'd-operator-defaults 'd-kernel-consent]
  :decider 'user
  :leaning 'leaving-or-all
  :because (guess "Routine work (forwarding, filling swap orders, filling paid requests within money on hand, closing a finished exit case) has to be signed without a person or the hub stops. What is worth a question is what the operator cannot undo alone: money leaving to the outside, terms that reach every account (forwarding and swap fee rises apply at once, with no notice), credit that cannot be cut back once used, a loan outside the officer's rule, and an exit that ends a customer relationship. This matches the kernel's floor. None of the asked kinds has a deadline the hub must meet; the hub's side of a customer's exit is closed by the runtime, not asked.")
  :changes-if "Operators either approve every such question without reading it, or ask to be asked about routine work above some amount after a loss."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-operator-who-holds
  :question "What does the operator see about who holds their money?"
  :options {:by-place "Per chain and token: on the chain, my secured share locked in accounts, owed to me with nothing locked, and owed by me with nothing locked; the largest customers named under each."
            :by-customer "A list of customer accounts, each with its figures."
            :one-total "One total of everything the hub has."}
  :depends ['d-operator-scope 'd-kernel-totals]
  :decider 'user
  :leaning 'by-place
  :because (canon 'collateral-secured "Only the hub's share of locked collateral is safe if a customer disappears, and what customers owe beyond it can be lost. A single total adds safe and unsafe money together. A list of accounts is unreadable with thousands of customers; it belongs one level down, reached from a named largest exposure or a lookup.")
  :changes-if "Operators shown the place view still cannot say, within a minute, how much they could lose if their three largest debtors disappeared."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-operator-find-customer
  :question "Can the operator open any one customer, or only customers the surface brings up?"
  :options {:lookup "Find any customer by the name or id they give, and open what the hub has with them."
            :brought-only "Only customers named on the attention list or as largest exposures can be opened."}
  :depends ['d-operator-who-holds]
  :decider 'person-evidence
  :leaning 'lookup
  :because (guess "Customers write in about a payment that did not arrive or a paid request that is stuck. Without lookup the operator has no way to that customer except scrolling thousands of accounts, which the person cannot do. Lookup does not bring back a list of everyone; it opens one customer by what they gave.")
  :changes-if "Operators in a real week get almost no questions from customers, or every question concerns a customer already on the attention list.")

(decision 'd-operator-silent
  :question "What happens when a customer stops answering?"
  :options {:show-and-wait "Show the silent customer, since when, what is tied up with them and what leaving would return; the operator decides whether to leave."
            :auto-leave "The hub starts leaving by itself once a customer has been silent past a set time with more than a set amount owed."
            :ignore "Nothing is shown until the customer returns or leaves."}
  :depends ['d-operator-who-holds 'd-operator-sign-ask 'd-kernel-silence]
  :decider 'person-evidence
  :leaning 'show-and-wait
  :because (canon 'exit-alone "The hub can always leave without the customer, but leaving costs chain fees, waits the whole window and collects only the secured share for sure; the rest is taken from the customer's money on the chain if there is any. Payments forwarded to them stay held until their deadline. The kernel never starts leaving by itself, so auto-leave would need the kernel to change. Leaving, once chosen, goes through the kernel's one leaving flow.")
  :changes-if "Operators leave most silent customers once shown them, or money tied up with silent customers grows faster than operators act on it.")

(decision 'd-operator-disputes
  :question "Who answers and closes when a customer leaves the hub through the chain?"
  :options {:automatic "The hub's runtime answers and later closes the case by itself; this surface reports what it did, and asks the operator only to close a case the hub failed to close."
            :confirm "The runtime prepares the answer and the closing, and the operator confirms each."}
  :depends ['d-operator-where-runs]
  :decider 'maintainer
  :leaning 'automatic
  :because (protocol "core/entity/tx/handlers/dispute/finalize-proof.ts" "When the hub closes a customer's case, it puts on the chain the newest state the customer signed, if the hub kept it and did not start the case itself; otherwise the case closes on the state the customer started from, and any difference is the hub's loss. On a plain account the hub sends no answer during the window: core/entity/scheduler/dispute-deadline-hook.ts waits for the window to end and then closes, and core/entity/tx/j-events.ts sends an answer inside the window only when a cross-chain swap leg is open. The operator has no other copy and no transaction to answer by hand, so a confirm step adds delay and no better state. Not verified: whether a customer who closes first at the end of the window shuts out the hub's newer state.")
  :changes-if "The maintainer shows the hub's newer state can be lost to a customer who closes first, which makes answering inside the window runtime work and the operator's view of it urgent, or the hub's own one-hour time becomes the real deadline.")

(decision 'd-operator-reserve-short
  :question "What happens when the hub lacks the money on the chain to fill requests customers already paid for?"
  :options {:refund-at-timeout "The runtime refunds a waiting request's fee by itself once the hub's announced refund time passes. Needs runtime work."
            :refund-by-hand "The operator refunds waiting requests, many under one signature. Needs an entity transaction the hub can sign, which does not exist."
            :stop-taking "The hub accepts no new paid requests while its money on the chain is below what it already owes. Needs runtime work."
            :show-and-wait "Show each waiting request, its age and the money it waits on; the operator adds money. No refund. Runs today."}
  :depends ['d-operator-defaults]
  :decider 'maintainer
  :leaning 'refund-at-timeout
  :because (protocol "core/entity/scheduler/rebalance.ts" "The hub's automation skips a paid request when it has no money of that token on the chain, and the customer's fee, taken when they asked, stays with the hub. The hub announces a ten-minute refund time, but nothing refunds on it, and the refund transaction exists only at the account level (core/account/tx/handlers/rebalance/refund.ts) with no entity transaction that lets a hub propose it. So today only show-and-wait runs, and the surface offers only that. The customer carries the loss, so a refund that does not depend on the operator being awake is the one I would ask the maintainer to build.")
  :changes-if "The maintainer says a paid request must wait rather than be refunded because the fee also buys a place in the queue, or adds a hub refund transaction but no automatic one.")

(decision 'd-operator-withdraw-while-owed
  :question "May the operator take money out while paid requests are waiting on it?"
  :options {:warn-and-allow "Show what the withdrawal leaves on the chain against what paid requests wait on, and that filling and closing pause until the chain confirms; then let it go."
            :hold-until-covered "Refuse a withdrawal that would leave less on the chain than paid requests wait on."}
  :depends ['d-operator-reserve-short 'd-operator-sign-ask]
  :decider 'maintainer
  :leaning 'warn-and-allow
  :because (canon 'mainnet-open-participation "A wallet adds no money cap of its own invention, and a refusal here would be one: the money is the operator's. What the wallet owes is the effect before signing. While a chain batch is in flight the hub fills no paid requests and the closing hook waits (core/entity/scheduler/rebalance.ts), and a withdrawal fails if debts recorded against the hub come first.")
  :changes-if "Operators shown the warning withdraw anyway and leave paid requests waiting past the announced refund time.")

(decision 'd-operator-pause
  :question "Can the operator stop the hub taking on new risk at once, without leaving anyone?"
  :options {:stop-new-risk "One action stops new accounts, new credit (the automatic answer included) and new paid requests; forwarding, swap fills and exits go on. Needs runtime work."
            :stop-everything-new "As above, and the hub also forwards no new payments and fills no new swaps. Needs runtime work."
            :no-switch "No stop; the operator changes terms or leaves customers one at a time."}
  :depends ['d-operator-sign-ask]
  :decider 'maintainer
  :leaning 'stop-new-risk
  :because (guess "I found no switch in core/ that makes a hub refuse new accounts, credit or forwards. The nearest tools today are raising the forwarding fee, which applies at once to everyone, and cutting credit lines by hand, which the automatic credit answer undoes on the next request. Forwarding within existing lines adds no new line, while new accounts and new credit do, so stopping those is the smallest stop that halts growth in what the hub could lose. Stopping forwarding too fails every customer's payments for a problem that may be elsewhere.")
  :changes-if "Operators in a real incident stop forwarding as well as credit, or the maintainer says a hub that refuses new accounts breaks a launch flow."
  :status 'settled
  :settled-by "user: 2026-11-19, provisional: the maintainer's decision, not yet answered by him")

(decision 'd-operator-refuses
  :question "What does this surface refuse to do?"
  :options {:only-forbidden "Refuse only what the protocol or repository rules forbid."
            :narrow-job "Also refuse the operator's personal payments, trading and hub setup; those belong to other surfaces or the server."}
  :forces {:narrow-job ['d-operator-launch-flows]}
  :depends ['d-operator-who]
  :decider 'user
  :leaning 'narrow-job
  :because (as-said 'several-surfaces "A private wallet is not the same app as a hub operator's. If the operator surface also pays and trades, it becomes the one interface for everyone again. It still refuses everything forbidden: publishing its money as a promise, cancelling a customer's payment before its deadline, and putting a reset beside ordinary actions.")
  :changes-if "The user says one person should run a hub and spend from it in one place, or operators keep switching to another surface mid-task to finish a hub job."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-operator-launch-flows
  :question "Which part of the launch flows does the operator surface carry, and how are borrowers approved?"
  :options {:approve-here "The hub's side of swap, cross-chain swap and lending on Ethereum and on TRON: the operator sets markets, fees and lending terms per chain, sees what automation did, and approves each borrower by hand with an amount and an end date."
            :officer-as-is "The same, with borrowers approved by the credit officer service beside the hub, whose scoring and limits are fixed in code and which refuses every chain that is not a test chain."
            :officer-operator-limits "The same, with the credit officer's limits set by the operator as a standing rule shown with who set it; approvals outside the rule come to the operator by hand. Needs runtime work, and the officer must accept real chains."
            :none "None; markets and lending are set on the server and not shown."}
  :depends ['d-operator-refuses 'd-kernel-floor-rules]
  :decider 'maintainer
  :leaning 'officer-operator-limits
  :because (protocol "core/orchestrator/credit-officer/policy.ts" "A credit officer exists: a service beside the hub that scores a borrower's age, volume, repayments and current exposure, applies a per-borrower and daily cap, and signs lendingApprove through the hub's admin connection (core/orchestrator/credit-officer/officer.ts). Its limits are constants in code, it refuses any chain that is not a test chain, and it runs only when switched on by an environment setting. So the operator's money is lent on rules the operator did not set, and on real money every approval falls back to a hand signature. Setting the officer's limits as the operator's own standing rule is what the kernel's some-kinds-by-rule leaning allows, and keeps by-hand approval for what falls outside it. Swap fills and cross-chain pairing are automatic, so the operator's part there is terms and outcomes. A hub is one entity per chain, so all of this is set per chain, on both launch chains (launch-flows). Each flow offered here needs a browserless scenario and a browser test in both wallets before it counts.")
  :changes-if "The maintainer says the officer is a testnet device that will not run on real money, which leaves approve-here, or borrowing requests per hub stay few enough that operators answer them by hand within a day."
  :status 'settled
  :settled-by "user: 2026-11-19, provisional: the maintainer's decision, not yet answered by him")

;; ─────────────────────────────────────────────────────────────────────────────
;; 3. The surface that follows
;; ─────────────────────────────────────────────────────────────────────────────

(surface 'operator-wallet :for 'operator :first 'operator-needs-me
  :because ['d-operator-who 'd-operator-where-runs 'd-operator-first-screen 'd-operator-refuses])

(screen 'operator-needs-me :in 'operator-wallet
  :answers "What needs me now that the hub could not handle on its own?"
  :shows ['account-status 'top-up-pending 'top-up-fee-paid 'exit-ends-at 'held-outgoing 'pending-expires-at]
  :offers ['operator-check-flow 'operator-refill-flow 'operator-silent-flow 'operator-leaving-flow 'operator-lookup-flow]
  :because ['d-operator-first-screen 'd-operator-hub-down 'd-operator-reserve-short 'd-operator-silent 'd-operator-disputes 'd-operator-defaults 'd-operator-find-customer])

(screen 'operator-where-money :in 'operator-wallet
  :answers "Where is my money on each chain, and how much of it could I lose?"
  :shows ['collateral-mine 'owed-to-me-unsecured 'owed-by-me-unsecured 'credit-i-grant 'held-outgoing 'held-incoming]
  :offers ['operator-money-flow 'operator-earnings-flow 'operator-refill-flow]
  :because ['d-operator-who-holds 'd-operator-scope])

(screen 'operator-customer :in 'operator-wallet
  :answers "What do I have with this one customer, and are they still answering?"
  :shows ['collateral-mine 'collateral-theirs 'owed-to-me-unsecured 'owed-by-me-unsecured 'credit-i-grant 'credit-granted-to-me 'pending-amount 'pending-expires-at 'account-status 'top-up-pending 'top-up-fee-paid]
  :offers ['operator-lookup-flow 'operator-credit-flow 'operator-silent-flow 'k-leave-flow]
  :because ['d-operator-who-holds 'd-operator-silent 'd-operator-find-customer])

(screen 'operator-terms :in 'operator-wallet
  :answers "What do I charge, and when does each change reach my customers?"
  :shows ['route-fee-rate 'route-base-fee 'swap-fee-rate 'top-up-base-fee 'top-up-rate 'top-up-chain-fee 'fee-notice 'loan-rate]
  :offers ['operator-prices-flow]
  :because ['d-operator-defaults 'd-operator-sign-ask 'd-operator-launch-flows])

(screen 'operator-rules :in 'operator-wallet
  :answers "What does the hub decide on its own, and who chose each rule?"
  :shows ['credit-i-grant 'route-fee-rate 'swap-fee-rate 'top-up-rate 'fee-notice 'exit-window-left 'exit-window-right]
  :offers ['operator-prices-flow 'operator-credit-flow]
  :because ['d-operator-defaults 'd-operator-auto-credit 'd-operator-disputes 'd-operator-sign-ask])

(screen 'operator-owed-to-me :in 'operator-wallet
  :answers "How much do customers owe me with nothing locked, and who set each limit?"
  :shows ['credit-i-grant 'credit-they-use 'owed-to-me-unsecured 'collateral-mine]
  :offers ['operator-credit-flow]
  :because ['d-operator-auto-credit 'd-operator-who-holds])

(screen 'operator-loans :in 'operator-wallet
  :answers "Who borrowed from me, how much, when is it due, and who approved it?"
  :shows ['loan-principal 'loan-rate 'loan-interest-so-far 'loan-term 'loan-late-window 'owed-to-me-unsecured 'collateral-mine]
  :offers ['operator-lending-flow 'operator-silent-flow 'k-leave-flow]
  :because ['d-operator-launch-flows 'd-operator-who-holds])

(screen 'operator-exits :in 'operator-wallet
  :answers "Which customers are leaving without me, and did the hub answer each in time?"
  :shows ['account-status 'exit-window-left 'exit-window-right 'exit-started-by-left 'exit-ends-at 'k-fig-newest-signed 'collateral-mine 'owed-to-me-unsecured]
  :offers ['operator-leaving-flow 'operator-silent-flow]
  :because ['d-operator-disputes 'd-operator-silent 'd-operator-hub-down])

(flow 'operator-check-flow :in 'operator-wallet :job 'operator-check
  :signs []
  :uses ['k-runtime-link 'k-attention 'k-wake-on-leaving 'k-evidence 'k-causes]
  :ends (guess "They know either that nothing needs them, or which few items do, why the hub could not settle each, and by when each costs money; and they know how old the hub's last report is, so an empty list from a hub that stopped never reads as all clear.")
  :because ['d-operator-first-screen 'd-operator-where-runs 'd-operator-hub-down])

(flow 'operator-money-flow :in 'operator-wallet :job 'operator-money
  :signs []
  :uses ['k-runtime-link 'k-holdings 'k-chain-money 'k-real-or-test]
  :ends (guess "They know, per chain and token, how much is theirs on the chain, how much is their secured share in accounts, how much customers owe them with nothing locked, how much they owe customers the same way, and which customers carry the most.")
  :because ['d-operator-who-holds 'd-operator-scope])

(flow 'operator-refill-flow :in 'operator-wallet :job 'operator-refill
  :signs ['deposit-in 'settle-propose 'chain-submit 'chain-resubmit 'chain-abandon]
  :uses ['k-chain-money 'k-attention 'k-effect 'k-question 'k-causes]
  :ends (guess "Every paid request is filled, or waiting on a stated amount of money that is on its way, or past the announced refund time and shown as a fee the customer is owed back with no way yet to return it; none waits without the operator knowing.")
  :because ['d-operator-reserve-short 'd-operator-sign-ask 'd-kernel-money-in-out])

(flow 'operator-prices-flow :in 'operator-wallet :job 'operator-prices
  :signs ['hub-terms 'lend-terms 'market-open]
  :uses ['k-effect 'k-question 'k-standing-rules 'k-record]
  :ends (guess "They know, on which chain, every value that changed (including any they did not touch, since a value left out returns to its code default), how many accounts it reaches, that forwarding and swap fee rises apply at once, and the date a collateral fee rise starts applying.")
  :because ['d-operator-defaults 'd-operator-sign-ask 'd-operator-launch-flows])

(flow 'operator-credit-flow :in 'operator-wallet :job 'operator-credit
  :signs ['grant-credit]
  :uses ['k-standing-rules 'k-effect 'k-question 'k-holdings 'k-record]
  :ends (guess "They know each customer's limit and whether they or the hub's automatic answer set it; that lowering a limit stops new debt but leaves what is already owed; and that, while the automatic answer stands, a limit cut below the code cap rises again when the customer next asks.")
  :because ['d-operator-auto-credit 'd-operator-sign-ask])

(flow 'operator-lending-flow :in 'operator-wallet :job 'operator-lend
  :signs ['lend-approve]
  :uses ['k-effect 'k-question 'k-holdings 'k-attention 'k-record 'k-standing-rules]
  :ends (guess "They know who may borrow, up to how much and until when, and whether they or the credit officer approved each; what each borrower owes, when it falls due and how long late interest runs; and that if a borrower does not repay, the way to collect is to leave that account, which returns the secured share for sure and the rest only from the borrower's money on the chain.")
  :because ['d-operator-launch-flows 'd-operator-sign-ask])

(flow 'operator-silent-flow :in 'operator-wallet :job 'operator-silent
  :signs []
  :uses ['k-silence 'k-leaving-sums 'k-holdings 'k-causes]
  :ends (guess "Before choosing, they know since when the customer has not answered, what is held with them, and what leaving would return for sure, what may never come and what the chain would charge; then they either wait, or go on to leave through the shared leaving flow.")
  :because ['d-operator-silent 'd-operator-sign-ask])

(flow 'operator-leaving-flow :in 'operator-wallet :job 'operator-leaving
  :signs ['exit-finish 'chain-submit]
  :uses ['k-attention 'k-wake-on-leaving 'k-evidence 'k-question 'k-causes]
  :ends (guess "They know, from the hub's side, how long the hub had to answer, whether the hub holds a newer state than the one the customer started from and whether it got onto the chain, when the case could be closed, and once closed what came back and what stays owed. Only if the hub failed to close a finished case are they asked to close it.")
  :because ['d-operator-disputes 'd-operator-hub-down 'd-kernel-leave-once])

(flow 'operator-earnings-flow :in 'operator-wallet :job 'operator-earnings
  :signs ['settle-propose 'withdraw-out 'send-from-reserve 'chain-submit]
  :uses ['k-record 'k-chain-money 'k-effect 'k-question 'k-causes]
  :ends (guess "They know how much left the hub and where it went, what stays on the chain against what paid requests wait on, and that filling and closing were paused until the chain confirmed; if a debt recorded against the hub came first, they know the withdrawal failed and why.")
  :because ['d-operator-sign-ask 'd-operator-who-holds 'd-operator-reserve-short 'd-operator-withdraw-while-owed 'd-kernel-money-in-out])

(flow 'operator-lookup-flow :in 'operator-wallet :job 'operator-one-customer
  :signs []
  :uses ['k-holdings 'k-silence 'k-record 'k-causes]
  :ends (guess "They found the customer by what the customer gave them, and know what happened to the payment or paid request in question: finished, still held and until when, failed and why, or waiting on the hub's money.")
  :because ['d-operator-find-customer 'd-operator-who-holds])

(gap 'operator-no-pause :job 'operator-pause
  :why (guess "No runtime switch makes a hub refuse new accounts, credit or paid requests, and a stop that only looks like one is a stub. Left unserved until the maintainer settles d-operator-pause and the runtime has the switch."))

(gap 'operator-no-setup :job 'operator-setup
  :why (guess "Starting a hub loads chain connections, tokens and first money on the server, and today that happens when the hub process starts. Doing it from this surface needs a remote setup path the runtime does not offer, and the operator does it rarely. Left out under d-operator-refuses until the maintainer says independent operators start hubs without server access."))

;; Choices made on the operator's behalf

(default 'operator-default-auto-credit :in 'operator-wallet
  :value "Any customer who asks gets a credit line up to 1,000 dollars' worth per token; a larger line is never lowered, a line cut below that is raised again on the next request, and the operator cannot change this today"
  :risk-on 'holder
  :because ['d-operator-auto-credit 'd-operator-defaults 'd-kernel-hub-credit])

(default 'operator-default-route-fee :in 'operator-wallet
  :value "Forwarding fee of one millionth of the amount, no flat fee"
  :risk-on 'holder
  :because ['d-operator-defaults])

(default 'operator-default-swap-fee :in 'operator-wallet
  :value "No fee on swaps that take a resting order"
  :risk-on 'holder
  :because ['d-operator-defaults 'd-operator-launch-flows])

(default 'operator-default-collateral-fee :in 'operator-wallet
  :value "One hundredth of a percent of the amount locked, plus the token's default flat charge and no chain charge, neither of which the hub's terms can change"
  :risk-on 'holder
  :because ['d-operator-defaults])

(default 'operator-default-notice :in 'operator-wallet
  :value "Thirty days before a rise in the collateral fee, its flat part or its chain charge applies to existing customers; forwarding and swap fee rises apply at once"
  :risk-on 'counterparty
  :because ['d-operator-defaults])

(default 'operator-default-terms-omitted :in 'operator-wallet
  :value "A change of terms that leaves a value out returns it to its code default for every account; only the notice period keeps its last value"
  :risk-on 'holder
  :because ['d-operator-defaults 'd-operator-sign-ask])

(default 'operator-default-lending-terms :in 'operator-wallet
  :value "A hub that never set lending terms publishes default savings and loan terms for every token once, when it starts"
  :risk-on 'holder
  :because ['d-operator-defaults 'd-operator-launch-flows])

(default 'operator-default-fill-order :in 'operator-wallet
  :value "Paid requests are filled largest first while money on the chain lasts"
  :risk-on 'counterparty
  :because ['d-operator-reserve-short 'd-operator-defaults])

(default 'operator-default-refund :in 'operator-wallet
  :value "A ten-minute refund time is announced to customers; nothing refunds on it, and no transaction lets the hub refund by hand"
  :risk-on 'counterparty
  :because ['d-operator-reserve-short])

(default 'operator-default-close-cases :in 'operator-wallet
  :value "Finished exit cases are closed on the chain by the hub without asking, on the newest state the customer signed if the hub kept it, otherwise on the state the customer started from"
  :risk-on 'holder
  :because ['d-operator-disputes])

(default 'operator-default-response-time :in 'operator-wallet
  :value "The hub's own response time in a customer's exit is one hour"
  :risk-on 'holder
  :because ['d-operator-disputes 'd-operator-defaults])

(default 'operator-default-own-top-up :in 'operator-wallet
  :value "As on every account, an automatic request for more locked money is stored on the hub's side, but the hub never acts on it; what customers owe the hub with nothing locked is backed only when the operator acts"
  :risk-on 'holder
  :because ['d-operator-defaults])

(default 'operator-default-unasked :in 'operator-wallet
  :value "Forwarding, swap fills, paid requests within money on hand, borrower approvals by the credit officer where it runs, and closing a finished exit case are signed without asking"
  :risk-on 'holder
  :because ['d-operator-sign-ask 'd-operator-where-runs 'd-kernel-floor-holds-where])

;; ─────────────────────────────────────────────────────────────────────────────
;; 4. What this surface needs from the shared base
;; ─────────────────────────────────────────────────────────────────────────────

(need 'operator-needs-remote-hub :of 'operator-wallet
  :wants (guess "Read a hub that runs on a server and send it the operator's instructions, with proof that the sender is the operator, while the hub's signing key stays with the hub.")
  :because ['d-operator-where-runs 'd-operator-who-signs])

(need 'operator-needs-totals :of 'operator-wallet
  :wants (guess "Totals of the per-account figures across every account of one hub, per chain and token, computed by the runtime, with the largest accounts behind each total named.")
  :because ['d-operator-who-holds 'd-operator-scope])

(need 'operator-needs-chain-money :of 'operator-wallet
  :wants (guess "The hub's own money on each chain, per token, how much of it is already promised to paid requests and queued chain actions, and whether a chain batch is in flight, since while it is the hub fills no paid requests and closes no cases.")
  :because ['d-operator-who-holds 'd-operator-reserve-short 'd-operator-withdraw-while-owed])

(need 'operator-needs-attention :of 'operator-wallet
  :wants (guess "A list of what the automation could not do, each with its cause from the runtime and the time by which it costs money: paid requests skipped for lack of money or past their refund time, chain actions stuck or failed, customers leaving, silent customers, accounts whose copy with the watching service failed or is not covered, and risky values still at code defaults; with the time of the hub's last report.")
  :because ['d-operator-first-screen 'd-operator-reserve-short 'd-operator-hub-down 'd-operator-defaults])

(need 'operator-needs-last-answer :of 'operator-wallet
  :wants (guess "When each customer last answered the hub, and what is tied up with them since.")
  :because ['d-operator-silent])

(need 'operator-needs-reach :of 'operator-wallet
  :wants (guess "Before signing a change of terms or a credit change: the full set of terms before and after, so no value returns to its default unseen; how many accounts it reaches; which charges rise; and which rises apply at once and which after notice.")
  :because ['d-operator-sign-ask 'd-operator-defaults])

(need 'operator-needs-ask :of 'operator-wallet
  :wants (guess "One question before each signature of the kinds the operator chose to be asked about, and none for the rest, with a record of what was signed without asking.")
  :because ['d-operator-sign-ask])

(need 'operator-needs-earned :of 'operator-wallet
  :wants (guess "What the hub earned over a chosen period, split by forwarding, swaps, locking money for customers and lending, per chain and token.")
  :because ['d-operator-who-holds 'd-operator-first-screen])

(need 'operator-needs-who-set :of 'operator-wallet
  :wants (guess "For each credit limit, each change of terms and each borrower approval: whether the operator set it, the hub's automation did, or code did, and when.")
  :because ['d-operator-auto-credit 'd-operator-defaults 'd-operator-launch-flows])

(need 'operator-needs-wake :of 'operator-wallet
  :wants (guess "Reach the operator outside the surface when something needs them before a deadline, such as a customer leaving or money running out, from something outside the hub process, so that it still works when the hub itself has stopped.")
  :because ['d-operator-first-screen 'd-operator-disputes 'd-operator-hub-down 'd-kernel-reach-channel])

(need 'operator-needs-cover :of 'operator-wallet
  :wants (guess "Whether each account's recovery is covered by a watching service, and whether that service accepted or failed its last job.")
  :because ['d-operator-disputes 'd-operator-hub-down])

(need 'operator-needs-my-side :of 'operator-wallet
  :wants (guess "Every two-sided figure of a leaving case stated from the hub's side: the hub's own time to answer, the customer's, who started it, and whether the hub's answer was sent and in time.")
  :because ['d-operator-disputes])

(need 'operator-needs-recoverable :of 'operator-wallet
  :wants (guess "For one customer, their own money on the chain now, per token, since what they owe beyond the locked share is collected at once only from that.")
  :because ['d-operator-silent])

(need 'operator-needs-find :of 'operator-wallet
  :wants (guess "Find one customer among thousands by the name or id they give, with their payments and paid requests still in flight.")
  :because ['d-operator-find-customer])

(need 'operator-needs-pause :of 'operator-wallet
  :wants (guess "One action that stops the hub taking new accounts, new credit and new paid requests, and undoes the stop, without touching existing accounts.")
  :because ['d-operator-pause 'd-operator-defaults])
