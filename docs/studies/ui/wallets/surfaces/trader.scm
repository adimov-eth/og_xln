;; surfaces/trader.scm — the wallet surface for a professional trader.
;; Designed from scratch, from the person's job and the protocol. Nothing here is settled.
;; Order of the file: 1. the person  2. the decisions  3. the surface that follows  4. what it needs from the shared base.
;; Revised after talk/trader--*.scm; the replies are in talk/trader--replies.scm.

;; ─────────────────────────────────────────────────────────────────────────────
;; 1. The person
;; ─────────────────────────────────────────────────────────────────────────────

(person 'trader
  :is (guess "Someone who trades for a living with money they alone sign for, and who holds accounts with several hubs at once because each hub is a separate market with its own prices.")
  :came-for (guess "To trade at the price they see without waiting on a chain, and to know at every moment how much each hub could cost them if it failed. Speed and price bring them; knowing their exposure per counterparty keeps them.")
  :cannot [(guess "They cannot confirm every order in a fast market; a question per order is a missed price.")
           (guess "They cannot work from one balance that mixes their own money with credit someone granted them; they size positions from it and would size them wrong.")
           (guess "They must never have the wallet choose which counterparty they trade with, because that choice decides who owes them money afterwards.")
           (guess "They cannot wait a day to move money from one hub to another in the middle of a session.")
           (guess "They cannot read protocol internals while watching a price; anything they must act on has to be one number with one meaning.")
           (protocol "core/account/tx/handlers/swap/lifecycle/cancel.ts" "They cannot cancel a resting order on their own: they can only ask the hub, and the amount stays held until the hub acts.")]
  :jobs [(job 'trader-job-exposure :wants (guess "Know how much I could lose if one of the places I trade went dark today, and cap it."))
         (job 'trader-job-trade :wants (guess "Buy or sell at my price, where I choose, without a pop-up for every order."))
         (job 'trader-job-pull :wants (guess "Tell one place to drop all my orders the moment the market turns, and know which ones are really gone."))
         (job 'trader-job-record :wants (guess "See at the end of the day what filled, at what price, and what I paid in fees."))
         (job 'trader-job-move :wants (guess "Get money to the place where the price is, in minutes, not tomorrow."))
         (job 'trader-job-fund :wants (guess "Put money from my own address into a place I trade, and take the day's result back out to my address."))
         (job 'trader-job-cross :wants (guess "Buy on one chain and sell on another as one trade, without being left holding one side."))
         (job 'trader-job-leave :wants (guess "Get my money back from a place that stopped answering me."))
         (job 'trader-job-bot :wants (guess "Let my own program trade inside limits I set, while I watch it."))
         (job 'trader-job-borrow :wants (guess "Borrow for a few days to trade bigger than my own money allows."))])

;; ─────────────────────────────────────────────────────────────────────────────
;; 2. The decisions
;; ─────────────────────────────────────────────────────────────────────────────

;; Who exactly this person is.
(decision 'd-trader-who
  :question "Who exactly is this surface for: a trader on their own book, a trader in a seat on a desk's entity, or a person supervising a trading program?"
  :options {:own-book "One person trading money they alone sign for, through an entity with one signer."
            :desk-seat "One of several traders acting for a desk's entity, under limits the desk sets, where some actions need other board members."
            :bot-supervisor "A person whose trading is done by a program; they watch it, set its limits and step in."}
  :forces {:desk-seat ['d-trader-ask-before-sign]
           :bot-supervisor ['d-trader-what-it-is]}
  :decider 'user
  :leaning 'own-book
  :because (guess "Against the desk seat: a board proposal takes effect at once only when the proposer's voting weight alone reaches the threshold, otherwise it waits for votes (core/entity/tx/handlers/system/basic.ts), so a seat whose orders wait for votes cannot trade at the speed this person came for, and desk governance belongs to the institution surface. Against the bot supervisor: the program is an app that works through the shared base (wallet-over-apps), and the person supervising it still needs exactly what own-book needs from this surface, namely exposure per hub, limits that bind the program as they bind the person, and leaving. So the supervisor is own-book plus an app, not a different surface; if the program does all the trading, the first screen and the ticket are wrong for them and this decision should move.")
  :changes-if "Of the first ten professional traders who ask for access, more than half trade a desk's money under someone else's limits, or more than half place no orders by hand and only watch a program."
  :status 'settled
  :settled-by "user: 2026-11-19")

;; What the product is for this person.
(decision 'd-trader-what-it-is
  :question "Is this surface the trading terminal itself, or the wallet under the trading, with only a plain order ticket of its own?"
  :options {:full-terminal "Book, depth, order ticket, open orders, fills and exposure all live in this surface."
            :risk-plus-ticket "This surface holds the money, exposure per counterparty, limits, one plain order ticket with each hub's best prices, open orders and fills; depth, charts and strategies are apps working through the shared base."
            :risk-only "This surface holds money, exposure, limits and leaving; every order is placed from an app."}
  :forces {:risk-plus-ticket ['d-trader-hub-choice 'd-trader-order-life 'd-trader-ticket-size 'd-trader-order-start]
           :full-terminal ['d-trader-visible-orders]
           :risk-only ['d-trader-ask-before-sign]}
  :depends ['d-trader-who]
  :decider 'user
  :leaning 'risk-plus-ticket
  :because (as-said 'wallet-over-apps "The wallet operates over trading applications, and Desk is one such application and out of scope; yet same-J Swap is a required launch flow, so the surface carries one plain ticket rather than leaving the trader with no way to trade without an app.")
  :changes-if "Traders given the plain ticket refuse to place an order without seeing depth, or the user says the trader surface is the trading app itself."
  :status 'settled
  :settled-by "user: 2026-11-19")

;; What the first screen answers.
(decision 'd-trader-first-screen
  :question "What does the first screen answer?"
  :options {:exposure "How much could I lose at each counterparty if it stopped answering now?"
            :market "What is the price of the pair I trade, at each of my counterparties?"
            :open-orders "What do I have working right now?"}
  :forces {:exposure ['d-trader-loss-figure 'd-trader-coverage-shown]}
  :depends ['d-trader-what-it-is]
  :decider 'user
  :leaning 'exposure
  :because (canon 'hub-failure-spreads "Limits cap what one account can lose, but a hub failure hits every unsecured amount with it at once; the price is visible in many places, while what this trader stands to lose at each hub is visible only here. This shows the trader's own account figures, not a hub's reserves, so the rejected reserve dashboard does not apply.")
  :changes-if "Watching five traders through a session, each opens the price or the open orders first and looks at exposure less than once a day."
  :status 'settled
  :settled-by "user: 2026-11-19")

;; Which number answers the first screen's question.
(decision 'd-trader-loss-figure
  :question "Which number per hub answers 'how much could I lose there right now'?"
  :options {:unsecured-only "What the hub owes me with nothing locked behind it, one number per hub and token; my locked share, which comes back by leaving, is shown beside it but is not counted as loss."
            :unsecured-and-leaving-cost "Two numbers per hub: what it owes me with nothing locked, and what the chain would charge me to leave alone."
            :everything-there "Everything I have at that hub, locked share included, because leaving takes a day and the money is out of reach meanwhile."}
  :depends ['d-trader-first-screen 'd-kernel-secured]
  :decider 'person-evidence
  :leaning 'unsecured-only
  :because (guess "Leaving alone entitles me to my locked share under the chain's rules, and only what the hub owed beyond it depends on the hub having money (law exit-alone). So the amount I could lose is one figure, what it owes me with nothing locked, and it answers the question without the trader adding anything up. The cost of leaving is real, but I expect it to be small next to a trader's locked share; nobody has measured it on the launch chains. The kernel keeps 'secured' meaning the locked share, with the cost as a separate figure.")
  :changes-if "On the launch chains the cost of leaving alone is a noticeable share of traders' locked shares, or traders shown one number ask what happens to the rest and act as if the locked share were lost.")

;; Where the trader sees whether leaving would still work after losing the device.
(decision 'd-trader-coverage-shown
  :question "Where does the trader see whether they could still leave a hub if this device were lost?"
  :options {:beside-each-hub "On the first screen, beside each hub's figure: covered, not covered, or the watching service last failed."
            :kernel-screen-only "Only on the shared coverage screen, reached from the first screen."}
  :depends ['d-trader-first-screen 'd-kernel-evidence]
  :decider 'user
  :leaning 'beside-each-hub
  :because (canon 'recovery-coverage-visible "The release queue gates public launch on an account-level coverage view with the watching service's acceptance or failure. On native TRON the service does not submit, so the same figure on the first screen means less there; the trader needs to see that where they read the figure, not one screen away.")
  :changes-if "Coverage turns out to be the same for every account a trader has on a chain, so one line per chain says it all; or the watching service is made to submit on TRON.")

;; What they see about who holds their money.
(decision 'd-trader-who-holds
  :question "How is the trader shown who holds their money?"
  :options {:per-counterparty "One row per hub, each split into the secured share, what the hub owes beyond it, and what is held in open orders and payments."
            :net-per-token "One total per token across all hubs, with the split by hub one step away."
            :both-net-first "A total per token on top, each total broken into its hubs underneath, secured and unsecured kept apart in both."}
  :depends ['d-trader-who]
  :decider 'person-evidence
  :leaning 'per-counterparty
  :because (canon 'accounts-are-bilateral "Every balance is a relationship with one named counterparty and there is no network-wide balance; a total per token hides who owes it, and the secured share and unsecured debt must stay apart in any view.")
  :changes-if "Traders shown both views size their orders from the per-token total and only open the per-hub split when something is already wrong.")

;; How the line the trader grants each hub gets set.
(decision 'd-trader-hub-limits
  :question "How does the trader come to set how far each hub may owe them with nothing locked behind it?"
  :options {:raise-when-needed "No setup before trading. Every hub starts at zero, the ticket shows how much each hub can pay me now, and when an order needs more than that the trader is asked whether to let that hub owe them more, with the new worst case stated."
            :setup-before-first-order "One setup per hub before the first order there, starting from zero, in which the trader states the most the hub may owe them."
            :per-order "No standing line; every order states how far the hub may owe me after it fills."}
  :forces {:raise-when-needed ['d-trader-top-up]
           :setup-before-first-order ['d-trader-top-up]}
  :depends ['d-trader-who-holds]
  :decider 'user
  :leaning 'raise-when-needed
  :because (protocol "core/account/tx/handlers/swap/resolve/settlement.ts" "A fill is refused when the hub's sending room in the token I receive is smaller than what I would receive, and that room beyond the hub's locked share is the line I granted it. Zero is the protocol's start and puts nothing at risk, so it may stand until the trader has a reason to move it; the moment they have a reason is when an order needs more room, and that is when they can judge the figure. Raising a line always asks under the shared floor, so the question comes either way; the choice is only whether it comes before any trading or with the order that needs it.")
  :changes-if "Traders asked at the order regret the raise afterwards more often than traders who set lines in advance, or they abandon orders at the question instead of answering it.")

;; Automatic collateral requests, split out of the line decision.
(decision 'd-trader-top-up
  :question "What happens to the automatic request for more collateral that every new account starts with?"
  :options {:state-at-first-raise "It stays as the opening installs it. While the line is zero it cannot fire; the first time the trader raises a hub's line, the same question states the trigger, the most fee per request, that the fee is paid when asking and comes back only if the hub returns it, and that one request at a time can be open. The trader keeps or changes it there."
            :off-at-opening "It is switched off when the account opens, and the trader turns it on per hub if they want it."
            :setup-per-hub "It is set in a separate step per hub, before or after the first trade, apart from the line."}
  :depends ['d-trader-hub-limits 'd-kernel-seeded]
  :decider 'user
  :leaning 'state-at-first-raise
  :because (canon 'collateral-fee-prepaid "Each automatic request costs a fee paid at the moment of asking and refunded only if the hub sends it back, and with only one request per token open a slow hub can let unsecured debt grow past the trigger with no second request. So it is a prepaid request, not a cap on loss, and it only matters once the trader lets the hub owe them something; the question that raises the line is the one place where its cost and its limit can be read together.")
  :changes-if "Traders keep the seeded trigger and fee cap unchanged at nearly every hub, so stating it adds nothing; or the maintainer lets the opening carry the setting so it can be chosen there.")

;; What an order does if the trader does not say.
(decision 'd-trader-order-life
  :question "How long does an order live when the trader does not say?"
  :options {:no-default "The ticket has two separate actions, rest at my price and take what is there now; nothing is chosen for the trader."
            :rest-until-cancelled "An order rests on the hub's book until it fills or is cancelled."
            :take-or-drop "An order takes what it can at once and the rest is dropped."
            :remember-last "The last choice for this pair is used again."}
  :depends ['d-trader-what-it-is]
  :decider 'person-evidence
  :leaning 'no-default
  :because (protocol "core/types/account.ts" "A swap order carries a time in force of good-until-cancelled, immediate-or-cancel or fill-or-kill and no expiry time; a resting order keeps its amount held at the hub and can only be cancelled by asking, so resting is a different risk from taking and is better chosen by which action is pressed than set silently.")
  :changes-if "Traders using two actions press the wrong one more than once a week, or ask for a single action with a remembered choice.")

;; What the ticket shows as what can be traded.
(decision 'd-trader-ticket-size
  :question "What does the ticket show as how much the trader can sell at a hub?"
  :options {:own-and-credit-apart "Two figures, never added: what I can send there from my own money, and what more I could send only by owing the hub. An order that would make me owe the hub asks."
            :room-as-is "The protocol's single sending room, which includes credit the hub granted me, with a note that part of it may be borrowed."
            :own-only "Only what I can send from my own money; an order that would draw on credit is refused from this ticket."}
  :depends ['d-trader-what-it-is 'd-trader-who-holds 'd-trader-refuses]
  :decider 'user
  :leaning 'own-and-credit-apart
  :because (canon 'credit-not-money "Credit granted to me is not my money. The protocol's sending room adds my locked share, what the hub owes me and unused credit granted to me, so showing it as what I can trade is the blended number this surface refuses. Refusing credit outright removes a choice the protocol gives the trader; keeping the two apart and asking before an order makes me owe keeps the choice and the trader's own sizing honest.")
  :changes-if "Traders never have credit granted to them by a hub, so the second figure is always zero and can go; or traders shown the two figures still add them and size from the sum.")

;; Where an order starts.
(decision 'd-trader-order-start
  :question "Where does the trader start an order?"
  :options {:pair-first-anywhere "One action from any screen opens the ticket for a pair, where every hub is compared side by side."
            :from-hub-row "Each hub's row on the first screen opens the ticket for that hub only."
            :ticket-beside-exposure "The ticket and the exposure per hub are always in view together."}
  :depends ['d-trader-what-it-is 'd-trader-first-screen 'd-trader-hub-choice]
  :decider 'person-evidence
  :leaning 'pair-first-anywhere
  :because (guess "The trader comes to trade a pair and picks the hub by price and room, so the ticket starts from the pair and compares hubs. Starting from a hub row hides the other hubs' prices; keeping both in view at once makes the first screen carry the ticket. One action from anywhere keeps exposure first without putting the trade behind it.")
  :changes-if "Watching traders, most orders start from a hub they were already looking at on the first screen, or traders lose the exposure view when the ticket opens and ask for both together.")

;; When the person is asked before something is signed, and when they are not.
(decision 'd-trader-ask-before-sign
  :question "When is the trader asked before something is signed for them, and when is it signed at once?"
  :options {:every-time "Every signature waits for a yes."
            :outside-limits "Orders and cancellations inside the limits set for that hub are signed at once; the trader is asked before letting a hub owe them more, moving money off a hub or out of the protocol, starting to leave, approving a settlement that lowers their money, placing an order that would make them owe the hub, or placing an order outside the limits."
            :armed-session "After one yes at the start of a session, everything is signed until the trader disarms it."}
  :forces {:outside-limits ['d-trader-what-limits]}
  :depends ['d-trader-hub-limits 'd-trader-who 'd-kernel-consent]
  :decider 'user
  :leaning 'outside-limits
  :because (canon 'settle-needs-me "A settlement that lowers my money on the chain is never signed for me automatically; the protocol already draws a line between what may be signed without asking and what may not, and the trader's limits per hub extend that same line to orders, inside the shared floor.")
  :changes-if "A trader loses money to an order signed inside their limits that they say they would have stopped had they been asked, or traders arm a session and never disarm it.")

;; What 'inside the limits' means for an order.
(decision 'd-trader-what-limits
  :question "What must an order stay inside to be signed without a question?"
  :options {:room-and-distance "Room under the line the trader granted that hub, and a distance from the hub's best price."
            :plus-size-caps "As above, plus a most per order and a most resting at one hub at any time, both set by the trader per hub. The resting cap bounds what a hub can still fill after the trader asked it to drop the orders."
            :resting-always-asks "Orders that take what is there now sign at once inside room and distance; any order that would rest asks, because it cannot be taken back."}
  :forces {:room-and-distance ['d-trader-price-distance]
           :plus-size-caps ['d-trader-price-distance]
           :resting-always-asks ['d-trader-price-distance]}
  :depends ['d-trader-ask-before-sign]
  :decider 'user
  :leaning 'plus-size-caps
  :because (canon 'swap-cancel-ask-only "A resting order cannot be cancelled without the hub, and the line a trader grants caps how far the hub may owe them, not how far the price moves after the order is signed; a mistyped size passes room and distance alike. The most a hub can fill against a trader after the market turns is what the trader has resting there, so a cap on that, with a cap per order, is the limit that bounds the loss. Asking before every resting order bounds it too, but it asks for most of a market maker's orders. The cost of the leaning: until the caps are set every order asks, which on a trader's first session at a hub is the question per order this person cannot work with, so the caps are offered with the first question and set once.")
  :changes-if "Traders hit the resting cap in normal sessions and raise it without reading, traders abandon their first session at a hub before setting the caps, or hubs are seen filling orders long after a request to drop them, which would make resting-always-asks the safer line.")

;; The distance from the best price, split out of a silent default.
(decision 'd-trader-price-distance
  :question "How far from the hub's best price may an order be before the trader is asked?"
  :options {:fixed-two-percent "Two percent on every pair, which the trader may change."
            :set-per-pair "No number chosen for the trader: until they set a distance for a pair, every order on that pair asks."
            :per-pair-suggested "A distance per pair suggested from how far that pair's price usually moves, which the trader confirms."}
  :depends ['d-trader-what-limits]
  :decider 'person-evidence
  :leaning 'set-per-pair
  :because (guess "Pairs move by very different amounts: two percent is far on a pair that moves in hundredths of a percent and close on a thin one, so any single number is wrong for most pairs a professional trades. A suggestion from recent movement would be a figure the wallet works out about the market, which the runtime does not state today. Asking until the trader sets it costs some questions on the first orders of each pair and chooses nothing for them.")
  :changes-if "Traders set the same distance on nearly every pair, or abandon the first orders on a new pair rather than answer the question.")

;; What happens when a counterparty stops answering.
(decision 'd-trader-silent-hub
  :question "What does the surface do when a hub stops answering?"
  :options {:tell-only "Mark the hub and every figure from it as stale, with its age; the trader decides everything."
            :stop-and-ask "Mark it stale, stop sending new orders to it, show what is held and owed there, and offer leaving with one question."
            :auto-leave "After a silence the trader set in advance, begin leaving the hub without asking."}
  :forces {:stop-and-ask ['d-trader-silence-threshold 'd-trader-silence-stop-where]}
  :depends ['d-trader-hub-limits 'd-kernel-silence]
  :decider 'user
  :leaning 'stop-and-ask
  :because (canon 'swap-cancel-ask-only "An open order cannot be cancelled without the hub, so against a silent hub cancelling is useless; only beginning to leave withdraws my open orders there, and leaving costs a challenge window (about twenty-five hours as the code stands today) and ends the relationship, which is too much to start on a short outage without asking. Stopping new orders costs a missed trade at one hub; sending them into a silent hub holds money that cannot be got back without leaving.")
  :changes-if "Hub silences that stopped orders are mostly shorter than a minute and traders say the stop cost them trades they wanted, or traders leave in every silence anyway.")

;; How long a silence is before orders stop, split out of a silent default.
(decision 'd-trader-silence-threshold
  :question "How long may a hub go without acknowledging what the trader sent before new orders to it stop?"
  :options {:ten-seconds "Ten seconds at every hub, which the trader may change per hub."
            :set-per-hub "The trader sets it per hub when they first trade there; until then orders stop after the first unanswered request."
            :one-minute "One minute at every hub, which the trader may change per hub."}
  :depends ['d-trader-silent-hub]
  :decider 'person-evidence
  :leaning 'ten-seconds
  :because (guess "The two errors cost differently. A stop that fires too early blocks new orders to a working hub until it answers, a missed trade. One that fires too late lets orders go to a dead hub, where they are held and can only be got back by leaving. A hub that acknowledges in well under a second when healthy and has said nothing for ten is more likely gone than slow; but this is a guess about hub latency that nobody has measured.")
  :changes-if "Measured acknowledgement times of healthy hubs under load regularly pass ten seconds, or traders see more than one false stop a week.")

;; Who enforces the stop.
(decision 'd-trader-silence-stop-where
  :question "Who stops orders to a silent hub, so that the trader's program is stopped too?"
  :options {:standing-rule-in-kernel "The stop is one of the trader's standing rules, set by them, held with their other limits and applied by the shared question to every order, from this surface or from a program."
            :face-only "This surface stops its own ticket; a program working through the shared base is not stopped."
            :kernel-stops-for-all "The shared base stops anything new to a silent counterparty in every face, as one rule."}
  :depends ['d-trader-silent-hub 'd-kernel-silence 'd-kernel-app-door 'd-kernel-silence-rule]
  :decider 'user
  :leaning 'standing-rule-in-kernel
  :because (canon 'frontend-is-ui-only "The runtime owns logic, so a stop that only the screen enforces is logic in the frontend and lets the trader's own program keep sending. The kernel leans toward stating silence as a fact and leaving the response to each face, because a private payment should not stop after seconds; a standing rule keeps the threshold the trader's while the enforcing is done once, below every face and every program.")
  :changes-if "The kernel's standing rules cannot hold a rule that depends on a counterparty's silence, or the user rules that stopping new risk on silence is the kernel's duty for every face.")

;; What this surface refuses to do.
(decision 'd-trader-refuses
  :question "What does this surface refuse to do?"
  :options {:canon-minimum "Only what the repository forbids: no hub solvency proofs, no reserve dashboards as assurance, no caps of its own."
            :canon-plus-blending "Also: never show as tradable one figure that adds credit granted to me to my own money; never begin leaving a hub without the trader's yes; never place an order without a fee cap."
            :canon-plus-blending-plus-borrowing "All of the above, and also no borrowing or lending from this surface."}
  :depends ['d-trader-who-holds 'd-trader-hub-limits]
  :decider 'user
  :leaning 'canon-plus-blending
  :because (canon 'credit-not-money "A credit line is how much someone agrees to be owed without security, not money; a trader sizing from a balance that includes it sizes on someone else's risk, so the surface refuses the blended number rather than explaining it.")
  :changes-if "Traders ask for a single figure of what they can trade and use it correctly after seeing it split into own money and credit, or the maintainer rules borrowing a required part of this surface.")

;; Specific to this person: who picks the hub.
(decision 'd-trader-hub-choice
  :question "When the same pair trades at several hubs, who chooses where an order goes?"
  :options {:trader-picks "The ticket shows each hub's best price, the room left under my limits there and how much it can pay me now; the trader picks one."
            :best-price "The surface sends the order to the hub with the best price inside the trader's limits."
            :split "The surface splits the order across hubs to get the best average price."}
  :depends ['d-trader-who-holds]
  :decider 'user
  :leaning 'trader-picks
  :because (canon 'accounts-are-bilateral "Every balance is a relationship with one named counterparty, so the hub an order goes to decides who owes the trader money after it fills; choosing it silently is a choice about risk made for the person.")
  :changes-if "Traders pick the best-priced hub in nearly every order and ask for it to be done for them as a rule they switch on."
  :status 'settled
  :settled-by "user: 2026-11-19")

;; Specific to this person: how money moves between hubs.
(decision 'd-trader-move-money
  :question "Which path does a move between hubs take unless the trader says otherwise?"
  :options {:fast-first-where-allowed "Where paying oneself through the hubs is allowed for this money, that path is offered first and the path through the chain is one step away; where it is not allowed, only the chain path is offered, with the reason and the wait stated before the trader starts."
            :side-by-side "Both paths side by side wherever both are allowed, each with its time, fee and what it needs from the hubs; where only one is allowed, that one with the reason."
            :chain-only-at-launch "Only the chain path at launch on every chain; paying oneself through the hubs is added once the maintainer has decided the deadlines for real money."}
  :depends ['d-trader-hub-choice 'd-trader-real-money 'd-kernel-held-pay-not-allowed]
  :decider 'maintainer
  :leaning 'fast-first-where-allowed
  :because (protocol "core/pathfinding/pathfinding.ts" "A routed payment may return to the payer only through two or more different hubs, so a move from hub A to hub B as a payment to oneself works when A and B are connected; it is the only path that takes minutes. Real-money routed payments on an EVM mainnet wait for the maintainer's deadline values (htlc-constants-are-simnet), so on those chains the job as the person states it cannot be met at launch, and the surface says so instead of offering a path that is refused.")
  :changes-if "The maintainer decides the deadline values for every launch chain, or traders shown both paths take the chain path more than once in five moves.")

;; Real money before the dispute contract fix.
(decision 'd-trader-real-money
  :question "What does this surface do with real money while the release queue says no real funds?"
  :options {:refuse-where-not-allowed "Every flow that moves money asks the shared base, per chain, whether real money is allowed there yet and refuses real money where it is not; until the dispute contract fix lands, that means test money only, said plainly."
            :real-with-warning "Real money is accepted, with a statement that leaving may not work as described until the fix lands."}
  :decider 'maintainer
  :depends ['d-kernel-unfixed-contract]
  :leaning 'refuse-where-not-allowed
  :because (canon 'no-real-funds-before-dispute-fix "The release queue says no real funds before the dispute-replay contract fix lands. Leaving is the trader's only remedy against a silent hub, and on a chain with the old contract it can be replayed against them, so a surface that tells the trader leaving returns their locked share must not hold their real money there.")
  :changes-if "The maintainer lands the contract fix, or names chains where the old contract is not deployed."
  :status 'settled
  :settled-by "maintainer: already decided in committed todo.md, 'no real funds before it lands', and AGENTS.md, 'real-funds signing or transfers still require the owner'; recorded 2026-11-19 by opus at 0.96")

;; Which flows this surface carries on which chain.
(decision 'd-trader-chains
  :question "On which chains does this surface carry swaps, cross-chain swaps, moves and leaving?"
  :options {:each-where-it-works "Each flow on EVM and on native TRON, offered on a chain only where the shared base says it works there, with a plain line saying what is missing on that chain: no watching service on TRON, no real-money payments through hubs on EVM yet."
            :evm-first "Every flow on EVM only at launch; TRON follows."}
  :depends ['d-trader-cross-chain 'd-trader-move-money 'd-trader-real-money]
  :decider 'maintainer
  :leaning 'each-where-it-works
  :because (canon 'launch-flows "The launch flows are owed on EVM and native TRON, and the spec must say which surface carries each on each chain without leaving one out silently. Each flow this surface carries also needs its own fast scenario and browser test in both wallets, so every chain a flow is offered on is a cost the maintainer must accept.")
  :changes-if "The maintainer assigns flows to chains differently, or a flow on TRON turns out to need a step a trader cannot do at speed.")

;; Specific to this person: getting money in and out.
(decision 'd-trader-fund-path
  :question "Where does the trader put money into a hub from their own address, and take it back out?"
  :options {:here-per-hub "In this surface, per hub: money comes from the trader's address into their money on the chain and straight into one hub's locked share, and back the same way."
            :shared-flow "One flow in the shared base that every face uses, as leaving is."
            :outside "Outside the wallet: the trader funds their entity's money on the chain elsewhere and only locks it into hubs here."}
  :depends ['d-trader-what-it-is 'd-kernel-money-in-out]
  :decider 'user
  :leaning 'here-per-hub
  :because (protocol "core/entity/tx/handlers/j-batch/r2c.ts" "Moving my money from the chain into an account's collateral makes it my secured share there once the chain confirms it, so for a trader funding is a choice of which hub holds it, made with the exposure per hub in view. Taking it back out of a hub needs the hub's signature on a settlement, then a send to an ordinary address leaves the protocol, which always asks.")
  :changes-if "The other faces' funding turns out to be the same steps with the same questions, so one shared flow serves all of them, or traders fund their entities from elsewhere and never use it."
  :status 'settled
  :settled-by "user: 2026-11-19, answered yes to 'as leaned'; claude-fable-5-2 had recommended shared-flow, see talk/claude.scm")

;; Specific to this person: the record of the day.
(decision 'd-trader-record
  :question "What does the trader get as the record of their trading?"
  :options {:fills-and-fees "Each fill with pair, size, price, fee and hub, and the change per token; no profit figure."
            :with-result "The same, plus a realised result per pair worked out by the runtime."
            :export-only "A file of fills to take into the trader's own tools; nothing on screen."}
  :depends ['d-trader-what-it-is]
  :decider 'maintainer
  :leaning 'fills-and-fees
  :because (canon 'frontend-is-ui-only "The runtime owns logic; a profit figure computed in the frontend would be a second financial formula, so a result per pair exists only if the runtime provides it.")
  :changes-if "The maintainer adds a realised result to the runtime, or traders say a record without a result is useless to them and they export every day."
  :status 'settled
  :settled-by "user: 2026-11-19, provisional: the maintainer's decision, not yet answered by him")

;; Specific to this person: who sees their resting orders.
(decision 'd-trader-visible-orders
  :question "Is the trader told that a resting order is published with their identity?"
  :options {:tell-at-placement "The rest action says that this order will appear in the hub's public book with my entity on it."
            :say-nothing "Nothing is said; the trader is assumed to know."
            :ask-maintainer-to-hide "Raise it with the maintainer to stop publishing owners, and say nothing until then."}
  :depends ['d-trader-order-life]
  :decider 'maintainer
  :leaning 'tell-at-placement
  :because (protocol "core/network/relay/market/snapshot.ts" "The market snapshot a hub publishes every second lists, for each price level, the entity ids of the owners of the orders resting there; a trader's resting orders are visible with their identity to anyone reading the hub's book.")
  :changes-if "The maintainer removes owners from the published book, or traders say knowing it changes nothing about how they place orders.")

;; Specific to this person: cross-chain trades.
(decision 'd-trader-cross-chain
  :question "Does this surface carry trades across two chains, or leave them to another surface or an app?"
  :options {:carry-here "The trader surface carries cross-chain swaps, with each leg's lock and deadline shown."
            :leave-elsewhere "Cross-chain swaps are carried by an app or another surface; this one only shows what is locked."}
  :forces {:carry-here ['d-trader-cross-watch 'd-trader-leaving-view]}
  :depends ['d-trader-what-it-is]
  :decider 'maintainer
  :leaning 'carry-here
  :because (canon 'launch-flows "Cross-swap is a required launch flow on EVM and native TRON and some surface must carry it; buying on one chain and selling on another is this person's work more than anyone else's. Which chains it is offered on is d-trader-chains.")
  :changes-if "The maintainer assigns cross-swap to another surface, or the cross-chain transactions turn out to need steps a trader cannot do at speed."
  :status 'settled
  :settled-by "user: 2026-11-19, provisional: the maintainer's decision, not yet answered by him")

;; Who carries the trader's side of a cross-chain trade across before its deadline.
(decision 'd-trader-cross-watch
  :question "When the hub has taken its side of a cross-chain trade, who carries the proof across so the trader gets theirs before the deadline?"
  :options {:own-wallet-must-run "The trader's own wallet carries it; while a leg is open the trader is shown its deadline in the shared list of deadlines and told the wallet must be running before it."
            :watching-service-carries "A watching service carries the proof for the trader, as it answers a counterparty that starts leaving."
            :no-cross-until-carried "No cross-chain trades until something other than the trader's open wallet can carry the proof."}
  :depends ['d-trader-cross-chain 'd-kernel-evidence]
  :decider 'maintainer
  :leaning 'own-wallet-must-run
  :because (guess "The comments in core/entity/tx/handlers/cross-j/salvage.ts say the hub cannot take the source side on the chain without publishing a proof, that the trader's entity re-registers that proof on the target chain under its own key, and that the source-chain registration is the only recovery trigger. I have not traced the handler bodies; I read this as: nothing carries the proof for an entity that is not running, so the deadline is the trader's to meet. Building a service to carry it is new work for the maintainer; refusing cross-chain trades until then leaves a launch flow unserved.")
  :changes-if "Traders miss a target deadline with the wallet closed, or the maintainer lets the watching service carry the proof.")

;; How the trader sees leaving when cross-chain legs are open.
(decision 'd-trader-leaving-view
  :question "Where does the trader see that an open cross-chain leg holds up leaving a hub?"
  :options {:kernel-screen-only "Only on the shared leaving screen; the shared base's leaving sums include open cross-chain legs and their deadlines for every face."
            :trader-adds-legs "The shared leaving screen states the window; a trader screen beside it lists the open cross-chain legs and open orders on that account and their deadlines, which can push the end later."}
  :depends ['d-trader-silent-hub 'd-trader-cross-chain 'd-kernel-silence]
  :decider 'user
  :leaning 'kernel-screen-only
  :because (canon 'exit-early-if-answered "Whoever starts a dispute waits the whole window, and when a cross-chain swap leg is open on the account both sides also wait for every swap deadline, so the window shown alone can be earlier than the real end. The private surface also signs cross-chain swaps, so legs are not the trader's alone; by the kernel's own test, a date two faces could state differently is the kernel's, and the shared leaving sums should include the legs.")
  :changes-if "The kernel declines to include cross-chain legs in its leaving sums, or the private surface stops carrying cross-chain trades so that only the trader's accounts can have them."
  :status 'settled
  :settled-by "user: 2026-11-19")

;; ─────────────────────────────────────────────────────────────────────────────
;; 3. The surface that follows
;; ─────────────────────────────────────────────────────────────────────────────

(surface 'trader-wallet :for 'trader :first 'trader-home
  :because ['d-trader-who 'd-trader-what-it-is 'd-trader-first-screen])

(screen 'trader-home :in 'trader-wallet
  :answers "How much could I lose at each counterparty if it stopped answering right now?"
  :shows ['owed-to-me-unsecured 'credit-i-grant 'collateral-mine 'account-status]
  :offers ['trader-trade-flow 'trader-pull-flow 'trader-limits-flow 'trader-move-flow 'trader-fund-flow 'trader-leave-flow 'k-leave-flow]
  :because ['d-trader-first-screen 'd-trader-loss-figure 'd-trader-coverage-shown 'd-trader-who-holds 'd-trader-silent-hub 'd-trader-order-start])

(screen 'trader-ticket :in 'trader-wallet
  :answers "At which counterparty can I trade this pair now, at what price and what size?"
  :shows ['collateral-mine 'owed-to-me-unsecured 'credit-left-to-me 'held-outgoing 'can-receive 'credit-left-to-them 'swap-fee-rate]
  :offers ['trader-trade-flow 'trader-caps-flow]
  :because ['d-trader-what-it-is 'd-trader-ticket-size 'd-trader-what-limits 'd-trader-hub-choice 'd-trader-hub-limits 'd-trader-order-life 'd-trader-visible-orders 'd-trader-order-start])

(screen 'trader-orders :in 'trader-wallet
  :answers "Which of my orders could still fill, and how much is each one holding?"
  :shows ['order-give 'order-want 'order-price 'order-max-fee 'order-min-receive 'held-outgoing]
  :offers ['trader-pull-flow 'trader-trade-flow]
  :because ['d-trader-what-it-is 'd-trader-order-life 'd-trader-what-limits])

(screen 'trader-fills :in 'trader-wallet
  :answers "What filled today, at what price, and what did I pay in fees?"
  :shows ['swap-fee-rate]
  :offers ['trader-record-flow]
  :because ['d-trader-record])

(screen 'trader-counterparty :in 'trader-wallet
  :answers "How far do I let this counterparty owe me, and what does it charge me?"
  :shows ['credit-i-grant 'owed-to-me-unsecured 'credit-left-to-them 'credit-granted-to-me 'owed-by-me-unsecured 'credit-left-to-me 'can-receive 'held-outgoing 'top-up-pending 'auto-top-up-at 'auto-top-up-max-fee 'top-up-rate 'top-up-base-fee 'top-up-chain-fee 'fee-notice 'swap-fee-rate 'route-fee-rate]
  :offers ['trader-limits-flow 'trader-caps-flow 'trader-fund-flow]
  :because ['d-trader-hub-limits 'd-trader-top-up 'd-trader-what-limits 'd-trader-refuses 'd-trader-who-holds])

(screen 'trader-leaving :in 'trader-wallet
  :answers "This counterparty stopped answering: what do I have there, and do I leave it?"
  :shows ['account-status 'owed-to-me-unsecured 'collateral-mine 'held-outgoing 'order-give 'cross-leg-amount 'cross-leg-deadline]
  :offers ['trader-leave-flow 'k-leave-flow 'trader-pull-flow]
  :because ['d-trader-silent-hub 'd-trader-silence-threshold 'd-trader-loss-figure])

(screen 'trader-cross-screen :in 'trader-wallet
  :answers "What is locked on each chain for this trade, and until when?"
  :shows ['cross-leg-amount 'cross-leg-deadline]
  :offers ['trader-cross-flow]
  :because ['d-trader-cross-chain 'd-trader-cross-watch])

;; Flows, one or more per job served.

(flow 'trader-limits-flow :in 'trader-wallet :job 'trader-job-exposure
  :signs ['signed-command 'grant-credit 'set-auto-top-up 'ask-top-up]
  :uses ['k-holdings 'k-effect 'k-question 'k-standing-rules 'k-causes]
  :ends (canon 'credit-cut-keeps-debt "The trader knows, for each hub, how far it may come to owe them from now on and how much it owes them already, kept apart, because lowering a line stops new debt but does not erase debt already owed. If automatic collateral requests are on, they know each one is a request paid for up front that the hub may not fill, and that while one is open no second is made.")
  :because ['d-trader-hub-limits 'd-trader-top-up 'd-trader-what-limits 'd-trader-ask-before-sign])

(flow 'trader-trade-flow :in 'trader-wallet :job 'trader-job-trade
  :signs ['signed-command 'swap-place 'grant-credit]
  :uses ['k-market-read 'k-holdings 'k-effect 'k-question 'k-standing-rules 'k-silence 'k-real-or-test 'k-causes]
  :ends (guess "The trader knows whether the order rests or was taken, what is held for it, how far the hub may still owe them after it fills, and that a resting order can only be asked to go. Inside their limits nothing was asked; an order that needed the hub to owe them more, or would have made them owe the hub, was asked about first.")
  :because ['d-trader-what-it-is 'd-trader-ticket-size 'd-trader-hub-choice 'd-trader-hub-limits 'd-trader-order-life 'd-trader-ask-before-sign 'd-trader-what-limits 'd-trader-price-distance 'd-trader-silence-stop-where 'd-trader-visible-orders 'd-trader-refuses 'd-trader-real-money 'd-trader-chains])

(flow 'trader-caps-flow :in 'trader-wallet :job 'trader-job-trade
  :signs []
  :uses ['k-standing-rules 'k-market-read 'k-question]
  :ends (guess "The trader knows, for a hub, the most per order and the most resting there, and for a pair, how far from the best price an order may be, inside which their orders are signed without a question; and that until these are set, every order there asks. They are offered the first time an order at a hub or on a pair asks, and set once.")
  :because ['d-trader-what-limits 'd-trader-price-distance 'd-trader-ask-before-sign])

(flow 'trader-pull-flow :in 'trader-wallet :job 'trader-job-pull
  :signs ['signed-command 'swap-cancel]
  :uses ['k-batch 'k-silence 'k-question 'k-causes]
  :ends (protocol "core/account/tx/handlers/swap/lifecycle/cancel.ts" "The trader knows that the hub was asked to drop each order, that each one is still held and can still fill until the hub answers, how long each request has waited, and which orders the hub has since dropped or filled. Against a hub that does not answer, they know that only leaving withdraws the orders, and it is offered from the same place.")
  :because ['d-trader-order-life 'd-trader-what-limits 'd-trader-ask-before-sign 'd-trader-silent-hub])

(flow 'trader-record-flow :in 'trader-wallet :job 'trader-job-record
  :signs []
  :uses ['k-record]
  :ends (guess "The trader has every fill of the day with its hub, price, size and fee, and the change per token, and can take it into their own tools.")
  :because ['d-trader-record])

(flow 'trader-move-flow :in 'trader-wallet :job 'trader-job-move
  :signs ['signed-command 'pay-routed]
  :uses ['k-holdings 'k-effect 'k-question 'k-real-or-test 'k-attention 'k-causes]
  :ends (protocol "core/account/tx/handlers/htlc/resolve.ts" "The trader knows the money arrived at the second hub, how much of it is backed by that hub's locked share and how much that hub now owes them with nothing locked, and what the move cost; or that it came back to the first hub with the reason. Before sending they saw how much the second hub can pay them now, and that once sent the move cannot be called back before its deadline, which is minutes in instant mode and about a day otherwise.")
  :because ['d-trader-move-money 'd-trader-hub-limits 'd-trader-ask-before-sign 'd-trader-real-money 'd-trader-chains])

(flow 'trader-move-chain-flow :in 'trader-wallet :job 'trader-job-move
  :signs ['signed-command 'settle-propose 'settle-submit 'fund-account 'chain-submit]
  :uses ['k-holdings 'k-chain-money 'k-effect 'k-question 'k-real-or-test 'k-attention 'k-causes]
  :ends (guess "The trader knows the money is locked at the second hub as their secured share, or knows where it is now: still at the first hub because it did not sign, or in their money on the chain between the two, waiting on a chain submission. They knew before starting that this path waits for the chain twice and why the fast path was not offered.")
  :because ['d-trader-move-money 'd-trader-ask-before-sign 'd-trader-real-money 'd-trader-chains 'd-kernel-money-in-out])

(flow 'trader-fund-flow :in 'trader-wallet :job 'trader-job-fund
  :signs ['signed-command 'deposit-in 'fund-account 'settle-propose 'settle-submit 'withdraw-out 'chain-submit]
  :uses ['k-chain-money 'k-holdings 'k-effect 'k-question 'k-real-or-test 'k-attention 'k-causes]
  :ends (guess "Going in, the trader knows which hub now holds the money as their secured share and when the chain confirmed it. Going out, they know the hub signed to release it, that it left the protocol for their address, and what the chain charged; if the hub did not sign, they know the money is still there and that leaving is the only other way out.")
  :because ['d-trader-fund-path 'd-trader-ask-before-sign 'd-trader-real-money 'd-trader-chains 'd-kernel-money-in-out])

(flow 'trader-cross-flow :in 'trader-wallet :job 'trader-job-cross
  :signs ['signed-command 'swap-across-start 'swap-across-authorize 'swap-across-close 'swap-across-recover]
  :uses ['k-effect 'k-question 'k-holdings 'k-attention 'k-real-or-test 'k-causes]
  :ends (protocol "core/entity/tx/handlers/cross-j/salvage.ts" "The trader knows both legs settled at the filled amount, or knows which leg is still locked and until when. If the hub has taken its side, they know their wallet must carry the hub's published proof to the other chain under their own key before the deadline, and whether it has done so.")
  :because ['d-trader-cross-chain 'd-trader-cross-watch 'd-trader-ask-before-sign 'd-trader-real-money 'd-trader-chains])

(flow 'trader-leave-flow :in 'trader-wallet :job 'trader-job-leave
  :signs []
  :uses ['k-leaving-sums 'k-evidence 'k-silence 'k-real-or-test]
  :ends (canon 'exit-alone "This is the trader face's way into leaving; the shared leaving flow signs it. The trader knows their secured share is coming back under the chain's rules and when the window ends, that any open cross-chain leg can push that later, and that anything the hub owed beyond the locked share is paid only from the hub's money on the chain, now or later, or never.")
  :because ['d-trader-silent-hub 'd-trader-leaving-view 'd-trader-ask-before-sign 'd-trader-refuses 'd-trader-real-money 'd-kernel-silence 'd-kernel-leave-once])

;; Defaults: every choice made on the trader's behalf.

(default 'trader-default-credit-to-hub :in 'trader-wallet
  :value "0 at every hub; the trader is asked to raise it when an order needs more than the hub can pay them now"
  :risk-on 'nobody
  :because ['d-trader-hub-limits])

(default 'trader-default-auto-top-up :in 'trader-wallet
  :value "as the opening installs it; it cannot fire while the line is 0, and the first raise of a line states it and lets the trader keep or change it"
  :risk-on 'holder
  :because ['d-trader-top-up])

(default 'trader-default-sign-inside-limits :in 'trader-wallet
  :value "orders and cancellations inside a hub's room, the pair's price distance, the most per order and the most resting at that hub are signed without a question"
  :risk-on 'holder
  :because ['d-trader-ask-before-sign 'd-trader-what-limits])

(default 'trader-default-size-caps :in 'trader-wallet
  :value "none set: until the trader sets a most per order and a most resting for a hub, every order there asks"
  :risk-on 'nobody
  :because ['d-trader-what-limits])

(default 'trader-default-price-distance :in 'trader-wallet
  :value "none set: until the trader sets a distance for a pair, every order on that pair asks"
  :risk-on 'nobody
  :because ['d-trader-price-distance])

(default 'trader-default-order-fee-cap :in 'trader-wallet
  :value "the hub's currently announced swap fee, no more"
  :risk-on 'holder
  :because ['d-trader-refuses])

(default 'trader-default-min-receive :in 'trader-wallet
  :value "exactly what the limit price gives for the amount, less the fee cap"
  :risk-on 'nobody
  :because ['d-trader-order-life])

(default 'trader-default-move-cap :in 'trader-wallet
  :value "the amount plus the fees quoted at the moment of sending, nothing more"
  :risk-on 'holder
  :because ['d-trader-move-money])

(default 'trader-default-move-instant :in 'trader-wallet
  :value "a move between hubs is sent in instant mode, so it arrives or comes back within minutes"
  :risk-on 'nobody
  :because ['d-trader-move-money])

(default 'trader-default-silent-after :in 'trader-wallet
  :value "a hub is marked not answering after 10 seconds without acknowledging a signed request, and a standing rule stops new orders to it, from this surface and from the trader's programs, until it answers"
  :risk-on 'holder
  :because ['d-trader-silence-threshold 'd-trader-silence-stop-where 'd-trader-silent-hub 'd-kernel-silence-rule])

(default 'trader-default-real-money :in 'trader-wallet
  :value "real money is refused on every chain where the shared base says it is not yet allowed"
  :risk-on 'nobody
  :because ['d-trader-real-money])

;; Gaps: jobs deliberately left out.

(gap 'trader-gap-bot :job 'trader-job-bot
  :why (as-said 'wallet-over-apps "A program that trades is an application working through the shared base, not part of this surface; this surface only states the need that such an app can place and cancel within limits the trader set and nothing more."))

(gap 'trader-gap-borrow :job 'trader-job-borrow
  :why (canon 'credit-not-money "Borrowed money carries a term, a rate and lateness, and mixing it into trading inventory is the blended balance this surface refuses; Lending is still a required launch flow, so another surface or an app must carry it."))

;; ─────────────────────────────────────────────────────────────────────────────
;; 4. What this surface needs from the shared base
;; ─────────────────────────────────────────────────────────────────────────────

(need 'trader-needs-per-hub-split :of 'trader-wallet
  :wants (guess "For every hub and token, as separate figures from the runtime: the secured share, what the hub owes me beyond it, what I owe it, what is held in orders and payments, what I can send from my own money, what more I could send only by owing the hub, and what the hub can pay me now; a total per token across hubs only if the runtime states it.")
  :because ['d-trader-who-holds 'd-trader-first-screen 'd-trader-loss-figure 'd-trader-ticket-size])

(need 'trader-needs-book :of 'trader-wallet
  :wants (guess "The best prices and the depth each of my hubs publishes for a pair, with how old each one is.")
  :because ['d-trader-hub-choice 'd-trader-what-it-is 'd-trader-price-distance])

(need 'trader-needs-sign-inside-limits :of 'trader-wallet
  :wants (guess "Sign orders and cancellations at once when they fall inside the limits the person set for that hub (room, price distance, most per order, most resting) and the hub has not been silent longer than the person allows; stop for a yes on anything else, with the reason it stopped. The same rules apply to orders a program of mine proposes.")
  :because ['d-trader-ask-before-sign 'd-trader-what-limits 'd-trader-hub-limits 'd-trader-silence-stop-where])

(need 'trader-needs-silence :of 'trader-wallet
  :wants (guess "Know within seconds when a hub stops acknowledging what I sent, and how old every figure from that hub is.")
  :because ['d-trader-silent-hub 'd-trader-silence-threshold])

(need 'trader-needs-pull-all :of 'trader-wallet
  :wants (guess "Ask one hub to drop every open order of mine in one signed step, and see for each order whether it is still live, dropped or filled, and how long the request has waited.")
  :because ['d-trader-silent-hub 'd-trader-order-life])

(need 'trader-needs-fills :of 'trader-wallet
  :wants (guess "A record of every fill with pair, size, price, fee, hub and time, stated by the runtime, that can be taken out as a file.")
  :because ['d-trader-record])

(need 'trader-needs-own-evidence :of 'trader-wallet
  :wants (canon 'keep-evidence "The last state both sides signed for every account, kept where leaving still works if this device is lost, and per account whether that is so.")
  :because ['d-trader-silent-hub 'd-trader-coverage-shown])

(need 'trader-needs-publication :of 'trader-wallet
  :wants (guess "Know before placing a resting order what the hub will publish about it and with whose identity.")
  :because ['d-trader-visible-orders])

(need 'trader-needs-app-limits :of 'trader-wallet
  :wants (guess "Let an app I run place and cancel orders inside limits I set for it, and nothing else, and show me what it did.")
  :because ['d-trader-what-it-is 'd-trader-ask-before-sign])
