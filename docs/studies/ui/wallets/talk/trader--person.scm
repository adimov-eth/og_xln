;; talk/trader--person.scm — objections to surfaces/trader.scm from the seat of the trader.

(objection 'o-trader-person-1 :by "sonnet-person" :to 'trader-ticket :lens "person"
  :claim (protocol "core/account/utils.ts" "The ticket shows what can be sent now, which the protocol defines as my collateral share plus what they owe me plus unused credit granted to me, and says part of it may be borrowed. That is the blended number this surface says the trader cannot size from and refuses to show. The trader sizes an order from the one figure on the ticket and so sizes it on the hub's risk, and the ticket also carries no price although its question asks for one."))

(objection 'o-trader-person-2 :by "sonnet-person" :to 'trader-home :lens "person"
  :claim (canon 'credit-not-money "The first screen asks how much the trader could lose at each hub and answers with eight separate figures per hub, mixing money that is safe (own collateral share) with money that is at risk (owed beyond collateral) and amounts owed by the trader. The trader is left to add up the loss, while the person is described as unable to read internals and needing one number with one meaning. In a stale-hub emergency they do the sum under pressure, and on an ordinary day the surface's own test says they open price or orders first and look here less than once a day."))

(objection 'o-trader-person-3 :by "sonnet-person" :to 'trader-pull-flow :lens "person"
  :claim (canon 'swap-cancel-ask-only "The job is to pull all orders the moment the market turns, but the protocol only lets the trader ask the hub to cancel, and the order stays held and can still fill at the old price until the hub acts. The flow ends with 'cancellation was asked', which is not what the person wanted when the market turned. The job as written promises something the surface cannot give, and the trader is not told on the screen how long an asked-to-cancel order can still be filled or what to do in the meantime."))

(objection 'o-trader-person-4 :by "sonnet-person" :to 'trader-default-price-distance :lens "person"
  :claim (guess "Two percent from the best price is not a safe distance for most pairs a professional trades; on a pair that normally moves in basis points it lets a mistyped price or size be signed with no question. Together with 'inside limits' meaning only credit room and this distance, with no cap on order size or on the day's total, the worst day is a fat-fingered order that is signed at once, rests in the public book, and cannot be cancelled without the hub."))

(objection 'o-trader-person-5 :by "sonnet-person" :to 'd-trader-hub-limits :lens "person"
  :claim (protocol "core/account/utils.ts" "Before the first order the trader is made to answer how far each hub may owe them with nothing locked behind it. That is credit they would grant, their own risk, and a first-day trader has no basis for a figure about a hub they have not yet used. The prefilled value is the protocol's zero, so a trader who just confirms it can only receive what the hub has locked, and orders the hub cannot fill are refused. The trader is asked a question they cannot answer in order to start trading at all."))

(objection 'o-trader-person-6 :by "sonnet-person" :to 'trader :lens "person"
  :claim (guess "No job covers the first and last action of a trading day: putting money into a hub from the trader's own address and taking profit out to it. The only money flow is hub to hub, and the deposit and withdrawal transactions appear nowhere in the surface. A trader who has just opened the wallet has no way to start, and one who wants to leave a day's result somewhere safe has no way to do that except leaving a hub."))
