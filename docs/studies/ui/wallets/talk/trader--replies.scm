;; talk/trader--replies.scm — replies by the author of surfaces/trader.scm to every objection in talk/trader--*.scm.

;; ── canon lens ───────────────────────────────────────────────────────────

(reply 'r-trader-canon-1 :by "opus-trader" :to 'o-trader-canon-1 :stance 'accept
  :because (canon 'no-real-funds-before-dispute-fix "Right: the surface promised leaving as the remedy while the queue says no real funds before the contract fix. Added d-trader-real-money (maintainer), leaning to refuse real money wherever the shared base says it is not yet allowed, a default that does so, and every money flow now uses k-real-or-test. The other option, real money with a warning, stays open, and the maintainer chooses."))

(reply 'r-trader-canon-2 :by "opus-trader" :to 'o-trader-canon-2 :stance 'amend
  :because (canon 'htlc-constants-are-simnet "Accepted for the flow: it now uses k-real-or-test, the move through hubs and the move through the chain are separate flows, and d-trader-move-money says that where the fast path is not allowed the surface offers only the chain path and says why before the trader starts. Rejected for the job: a job is what the person wants, and the trader does want minutes; rewording it to what the launch can give would hide the gap rather than show it. The chain-only-at-launch option keeps the critic's reading open for the maintainer."))

(reply 'r-trader-canon-3 :by "opus-trader" :to 'o-trader-canon-3 :stance 'accept
  :because (canon 'recovery-coverage-visible "Right: a figure on TRON means less than the same figure on EVM if the device is lost, and the first screen said nothing. Added d-trader-coverage-shown, leaning to show coverage beside each hub's figure; the other option leaves it to the shared coverage screen. Coverage is not a figure in the ground, so the first screen carries it through the decision and k-evidence, not through :shows."))

(reply 'r-trader-canon-4 :by "opus-trader" :to 'o-trader-canon-4 :stance 'amend
  :because (canon 'frontend-is-ui-only "Right that a stop enforced by the screen is logic in the frontend and leaves the trader's program free to send. Wrong that the stop needs the kernel to stop everything: the threshold is the trader's, and the kernel's silence decision keeps responses per face. The stop becomes one of the trader's standing rules, enforced by the shared question for the face and programs alike. Added d-trader-silence-stop-where with the critic's kernel-stops-for-all and the face-only reading as options; the user decides, since it is a question of what the kernel owns."))

(reply 'r-trader-canon-5 :by "opus-trader" :to 'o-trader-canon-5 :stance 'accept
  :because (canon 'launch-flows "Right: the file never said which chain. Added d-trader-chains (maintainer), leaning to offer each flow on each chain only where the shared base says it works, with a plain line on what is missing there, and naming the cost in tests per chain. The other option, every flow on EVM first with TRON after, stays open."))

;; ── person lens ──────────────────────────────────────────────────────────

(reply 'r-trader-person-1 :by "opus-trader" :to 'o-trader-person-1 :stance 'accept
  :because (protocol "core/account/utils.ts" "Right: the sending room includes unused credit granted to me, so the ticket showed the very number the surface refuses. Added d-trader-ticket-size, leaning to two figures never added, what I can send from my own money and what more only by owing the hub, with an order that would make me owe asking first. The ticket now shows the parts, not the room. The price comes from the hubs' published books through k-market-read; the ground has no figure for it, so it cannot be named in :shows."))

(reply 'r-trader-person-2 :by "opus-trader" :to 'o-trader-person-2 :stance 'amend
  :because (canon 'exit-alone "Right that eight figures made the trader do the sum. The answer is one figure per hub, what the hub owes me with nothing locked, because the locked share comes back by leaving; the first screen now shows that, the line that caps it, the locked share beside it and the account's state, and the rest moved to the counterparty screen. Added d-trader-loss-figure with the critic's 'everything there' reading as an option. Rejected: 'looks here less than once a day' is my own changes-if, a condition that would move me, not an observation anyone made."))

(reply 'r-trader-person-3 :by "opus-trader" :to 'o-trader-person-3 :stance 'amend
  :because (canon 'swap-cancel-ask-only "Right that the job promised what the protocol cannot give. The job now says tell the place to drop the orders and know which are really gone, and the flow ends with each order shown as still live until the hub answers, with how long each request has waited. The protocol sets no time for the hub's answer, so the surface cannot say how long an order can still fill; it can only show the wait. What to do meanwhile is leaving, offered from the same place, and capping what can rest at a hub before the market turns, which is now in d-trader-what-limits."))

(reply 'r-trader-person-4 :by "opus-trader" :to 'o-trader-person-4 :stance 'accept
  :because (guess "Right on both counts. Two percent was a number with no basis, and room plus distance does not stop a mistyped size. Added d-trader-price-distance, leaning to no number chosen until the trader sets one per pair, with two percent kept as an option; and d-trader-what-limits, leaning to a most per order and a most resting per hub on top of room and distance. Until those are set, every order asks."))

(reply 'r-trader-person-5 :by "opus-trader" :to 'o-trader-person-5 :stance 'amend
  :because (protocol "core/account/tx/handlers/swap/resolve/settlement.ts" "Right that a setup before the first trade asks a question the trader has no basis to answer yet. The trader now starts at zero with no setup, the ticket shows how much each hub can pay them now, and the question to let a hub owe them more comes with the order that needs it. Rejected: the question cannot be removed. Zero lets the trader receive only what the hub has locked, the fill check enforces it, and raising the line always asks under the shared floor. d-trader-hub-limits keeps the setup and per-order options. One cost I own: until the size caps and price distance are set, orders at a new hub ask too, so the first session there is not question-free; those are offered with the first question and set once (d-trader-what-limits names this cost)."))

(reply 'r-trader-person-6 :by "opus-trader" :to 'o-trader-person-6 :stance 'accept
  :because (protocol "core/entity/tx/handlers/j-batch/r2c.ts" "Right: there was no way to start or to take the day out. Added the job to put money into a hub from one's own address and take the result back out, d-trader-fund-path leaning to do it here per hub because funding a hub makes the money a secured share there, and trader-fund-flow, which signs bringing money in, locking it into a hub, a settlement to release it and the send out, the last of which always asks."))

;; ── protocol lens ────────────────────────────────────────────────────────

(reply 'r-trader-protocol-1 :by "opus-trader" :to 'o-trader-protocol-1 :stance 'amend
  :because (canon 'swap-cancel-ask-only "Right that the line to a hub does not bound what a resting order can lose once the price moves, and that pulling cannot be promised against a slow hub. The bound that does work is how much the trader has resting at that hub, so d-trader-what-limits leans to a most per order and a most resting per hub, and the pull flow now ends saying asked, not gone. The critic's stronger position, that a resting order must always ask, is the resting-always-asks option there, for the user; I do not take it, because it asks for most of a market maker's orders."))

(reply 'r-trader-protocol-2 :by "opus-trader" :to 'o-trader-protocol-2 :stance 'accept
  :because (protocol "core/account/tx/handlers/swap/resolve/settlement.ts" "Right: the fill check compares what I would receive with the hub's sending room in that token, which from my side is what I can receive, and the ticket did not show it. The ticket and the counterparty screen now show it, the move flow shows it for the second hub, and how old it is comes through k-silence and k-market-read."))

(reply 'r-trader-protocol-3 :by "opus-trader" :to 'o-trader-protocol-3 :stance 'amend
  :because (canon 'exit-early-if-answered "Right that the one date understated the end when a cross-chain leg is open, and that the unsecured part has no date. This screen no longer states a date at all: it is now the trader's screen for a silent hub, showing what they have there, open orders and cross-chain legs included, and offering to leave. The dates live on the shared leaving screen, where the unsecured part is stated as what may never come. d-trader-leaving-view leans to the shared leaving sums including open cross-chain legs, because the private surface carries cross-chain trades too, with a trader-only screen as the other option for the user. The window is stated as the code stands today."))

(reply 'r-trader-protocol-4 :by "opus-trader" :to 'o-trader-protocol-4 :stance 'accept
  :because (canon 'credit-cut-keeps-debt "Right: a lower line stops new debt but does not erase debt owed, and an automatic collateral request is prepaid, may not be filled, and blocks a second one while open. The flow now ends with the line and the debt already owed kept apart and the request described as a prepaid request, the counterparty screen shows the open request, and the automatic request has its own decision, d-trader-top-up."))

(reply 'r-trader-protocol-5 :by "opus-trader" :to 'o-trader-protocol-5 :stance 'accept
  :because (protocol "core/account/tx/handlers/htlc/resolve.ts" "Right on each point. The move flow now shows, before sending, how much the second hub can pay the trader, says the move cannot be called back before its deadline, and ends saying how much of what arrived is backed by the hub's locked share and how much the hub now owes with nothing locked. Moves default to instant mode so minutes holds. One correction to my own file: paying oneself through hubs is not unconfirmed; core/pathfinding/pathfinding.ts allows it through two or more different hubs."))

(reply 'r-trader-protocol-6 :by "opus-trader" :to 'o-trader-protocol-6 :stance 'amend
  :because (guess "From the comments in core/entity/tx/handlers/cross-j/salvage.ts: right that the trader's side is recovered only by their own entity re-registering the hub's published proof before the target deadline, and that the flow hid this. The flow now ends saying so, uses the shared list of deadlines, and d-trader-cross-watch (maintainer) asks who carries the proof, with a watching service and no cross-chain trades until then as options. Not taken: if the hub never takes its side, I read that it cannot without publishing the proof, so the trader is not left holding one side in that case; I have not traced what then releases the trader's source lock, and that is a guess."))

;; ── structure lens ───────────────────────────────────────────────────────

(reply 'r-trader-structure-1 :by "opus-trader" :to 'o-trader-structure-1 :stance 'accept
  :because (protocol "core/account/utils.ts" "Right, the same finding as the person lens: the screen showed what the decision refused, and no decision chose it. d-trader-ticket-size now holds the choice, with the protocol's room as one option and own money and credit apart as the leaning, and the room is gone from the first screen and the ticket."))

(reply 'r-trader-structure-2 :by "opus-trader" :to 'o-trader-structure-2 :stance 'amend
  :because (guess "Right that nothing offered the trade and the way to the ticket was never decided. The first screen and the orders screen now offer the trade flow, and d-trader-order-start holds where an order starts, leaning to one action from any screen opening a ticket for a pair. Rejected on the decider: what the first screen answers says what this product is, which is the user's call; watching traders is evidence the user weighs, and a product that leads with exposure may do so because traders look at it too little."))

(reply 'r-trader-structure-3 :by "opus-trader" :to 'o-trader-structure-3 :stance 'accept
  :because (guess "Right: the leaning was argued only against the desk seat, and the person was described with desk money the leaning excludes. The person is now someone trading money they alone sign for, and d-trader-who argues against the bot supervisor too: the program is an app, and the person supervising it needs what own-book needs from this surface. Its changes-if now names the case where traders only watch a program."))

(reply 'r-trader-structure-4 :by "opus-trader" :to 'o-trader-structure-4 :stance 'amend
  :because (canon 'credit-starts-zero "Right that three choices were bundled and that only one option survived the file's own text. d-trader-hub-limits now holds only the line, with three options a sensible person could take, and the automatic collateral request has its own decision, d-trader-top-up. Rejected: zero credit does not put risk on the trader. It puts no money at risk for anyone; the cost is fills the hub cannot pay, which the ticket now shows before the order. So the default keeps risk on nobody."))

(reply 'r-trader-structure-5 :by "opus-trader" :to 'o-trader-structure-5 :stance 'accept
  :because (guess "Right: both numbers decided when orders stop or are asked about, with no decision behind them. Added d-trader-silence-threshold for the ten seconds, keeping ten seconds as the leaning with the reason that a late stop costs more than an early one, and d-trader-price-distance for the distance, where the leaning is now to choose no number. d-trader-silent-hub's changes-if now speaks of silences under a minute. The stop is automatic and the question is about leaving; the decision text now says both."))

(reply 'r-trader-structure-6 :by "opus-trader" :to 'o-trader-structure-6 :stance 'accept
  :because (canon 'htlc-constants-are-simnet "Right: the old options described launches, not designs. d-trader-move-money now asks which path a move takes first where both are allowed, and says what the trader is told where only the chain path is. The launch reading survives as chain-only-at-launch for the maintainer. The move through hubs and the move through the chain are now two flows with two endings, since one returns the money on failure and the other can leave it between hubs."))
