;; surfaces/private.scm — the wallet surface for a private person.
;; Order: the person, the decisions, the surface that follows, what this surface needs from the shared base.
;; Revised after the objections in talk/private--*.scm; the replies are in talk/private--replies.scm.

;; ── 1. The person ────────────────────────────────────────────────────────

(person 'private
  :is (guess "Someone who already keeps some digital dollars at an ordinary address on a chain, gets paid in them now and then, and spends them on rent, shops and friends. They act alone; nobody signs with them or for them.")
  :came-for (guess "To pay and be paid at once and for almost nothing, without handing all of their money to an exchange whose books they cannot see.")
  :cannot [(guess "They cannot judge whether a company holding their money is healthy, and must never be asked to.")
           (guess "They cannot keep a copy of every agreed state of their accounts, or know which copy matters; they must never be asked to manage one.")
           (guess "They cannot be awake and online when a deadline passes at night; nothing may depend on them answering within the hour.")
           (guess "They must never be asked to pick a number without being told, in money, what it can cost them at worst.")
           (guess "They cannot read chain events, signatures or account internals, and must never be shown them as the only explanation of what happened.")
           (guess "They cannot tell a company that is restarting from a company that is gone; a question must not depend on telling the two apart.")]
  :jobs [(job 'private-get-paid :wants (guess "Let someone pay me, and know when the money is really mine."))
         (job 'private-pay :wants (guess "Pay a person or a shop, and know it arrived."))
         (job 'private-move-in-out :wants (guess "Bring money in from my own address, and send it back out there."))
         (job 'private-less-at-risk :wants (guess "Have less of my money depend on one company keeping its word."))
         (job 'private-change-currency :wants (guess "Change one kind of money into another, or move it to the other chain I use."))
         (job 'private-save :wants (guess "Put money aside and earn a little on it."))
         (job 'private-leave :wants (guess "Get my money back when the company holding it stops answering."))
         (job 'private-new-phone :wants (guess "Still have my money after I lose or break my phone."))
         (job 'private-borrow :wants (guess "Borrow a little until I am paid."))
         (job 'private-what-happened :wants (guess "See what I paid and what I was paid, and show someone that a payment was made."))])

;; ── 2. The decisions ─────────────────────────────────────────────────────

;; Who, and what the surface carries

(decision 'd-private-who
  :question "Who exactly is the private person this surface is built for?"
  :options {:holder "Someone who already holds digital dollars at their own address and wants to pay and be paid with them."
            :newcomer "Someone who has never held any and first meets this when someone else pays them."
            :sender-home "Someone who mainly sends money to family in another country."}
  :forces {:holder ['d-private-chains]}
  :decider 'user
  :leaning 'holder
  :because (guess "Money gets in only by bringing tokens from an ordinary address or by being paid by someone already inside, and at launch everyone uses their own funds, so the first private people are likely those who already hold tokens at an address.")
  :changes-if "Among the first fifty real private users, most arrive by being paid by someone already inside and have never had an address of their own; then the newcomer comes first."
  :status 'settled
  :settled-by "user: 2026-11-19, provisional for launch")

(decision 'd-private-refuses
  :question "What does this surface leave out, so that a private person never meets it?"
  :options {:absent-here "Running a company, board and share actions, raw settlements, discarding queued chain actions, orders that wait, borrowing, and claims about a company's reserves do not exist on this surface; a person who needs them opens another surface or an app."
            :present-with-warning "They exist on this surface with a warning beside them."}
  :forces {:absent-here ['d-private-pro-toggle]}
  :depends ['d-private-who 'd-kernel-how-many]
  :decider 'user
  :leaning 'absent-here
  :because (as-said 'several-surfaces "A private person's wallet is not the same app as a trader's, a hub operator's or an institution's; what a private person never needs to finish one of their own jobs is not on their surface. Whether the release queue's Pro switch may still reveal detail here is a separate question for the maintainer, in d-private-pro-toggle.")
  :changes-if "People of this group are seen needing one of the absent actions to finish one of their own jobs, or the user settles d-kernel-how-many on one surface for everyone."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-private-pro-toggle
  :question "On this surface, what may the release queue's Pro switch reveal?"
  :options {:detail-not-actions "The switch reveals more figures and causes about the person's own accounts; it never adds an action this surface leaves out."
            :waived-here "This surface has no Pro switch; the queue item is met by the other surfaces."
            :everything "The switch reveals the left-out actions too, so one surface serves everyone."}
  :depends ['d-kernel-how-many 'd-private-refuses]
  :decider 'maintainer
  :leaning 'detail-not-actions
  :because (canon 'capacity-bar-and-pro-toggle "The release queue asks for one capacity bar and a Pro toggle on by default in both wallets, and a design that hides detail should use that toggle instead of inventing its own. This surface hides detail, so the toggle is the right place for it; it leaves out actions, which the toggle was never said to carry. Revealing actions too would bring back the one interface for everyone that the user's own words rule out.")
  :changes-if "The maintainer says the queue item means one surface with everything behind the switch, or people with the switch on still cannot find a figure they need to answer a company's claim."
  :status 'settled
  :settled-by "user: 2026-11-19, provisional: the maintainer's decision, not yet answered by him")

;; Being paid and what counts as theirs

(decision 'd-private-receive-room
  :question "Before the person has been paid anything, how is room made for a payment to reach them, and who carries the risk?"
  :options {:allows-at-joining "When the person joins a company, they are asked once how much it may owe them with nothing locked behind it, stated as the most they could lose with it."
            :allows-when-asking-to-be-paid "When the person asks someone to pay a stated amount, they are asked to let the company owe them that much."
            :allows-at-first-payment "At the first payment that needs it, the person is asked for that amount."
            :company-locks-first "The person pays the company a fee to lock its own money for them before anything arrives; the fee comes from money the person has already brought into that account."}
  :forces {:allows-at-joining ['d-private-seeded-settings]}
  :depends ['d-private-who]
  :decider 'maintainer
  :leaning 'allows-at-joining
  :because (canon 'credit-is-chosen "The parties choose the risk, so the surface cannot allow it for them; the only question is when. At the first payment the person is usually not looking, so the payment fails before they are asked. Asking when they request a stated amount works only for payments that come with a request. Paying the company to lock money first is open only to a holder who has already brought money into that account, because the fee is taken from their room to send. Joining is the one moment the person is always present, and works for a holder and a newcomer alike.")
  :changes-if "Most payments to private people turn out to come against a request with a stated amount; or the fee for a company to lock a few hundred dollars is below a dollar and holders are seen bringing money in before they are paid.")

(decision 'd-private-spend-borrowed
  :question "Can a payment on this surface spend room the company has lent the person?"
  :options {:never-here "No. A payment stops at what is the person's own; room the company lent is never spent here."
            :ask-each-time "Yes, but the question says that this payment leaves the person owing the company, and how much."
            :as-the-runtime-allows "Yes, without saying so; the room to send includes what the company lent."}
  :depends ['d-kernel-consent 'd-private-lending]
  :decider 'user
  :leaning 'never-here
  :because (protocol "core/account/tx/handlers/balance/set-credit-limit.ts" "The company sets the line it lends the person by proposing it, and the line is applied with no step where the person accepts. The room to send counts that line, so the company can raise what the person can spend without asking them, and money spent from it becomes a debt that leaving takes from the person's own money on the chain. This person did not come to borrow, and borrowing is not carried on this surface.")
  :changes-if "People of this group are seen running out of their own money at the till and asking to spend on the company's line, or the maintainer rules that borrowing must be carried on this surface.")

(decision 'd-private-first-screen
  :question "What does the first screen answer?"
  :options {:one-number "How much can I spend right now, as one number."
            :certain-and-promised "How much is mine for sure, and how much rests on someone's word, as two numbers per currency."
            :by-company "Which companies hold my money, as a list."}
  :forces {:certain-and-promised ['d-private-holder-named 'd-private-home-grouping]}
  :depends ['d-private-who 'd-private-receive-room 'd-kernel-secured]
  :decider 'user
  :leaning 'certain-and-promised
  :because (canon 'credit-secured-unsecured "Money backed by locked collateral and money that is only owed must be kept apart in wallet balances; once the person has allowed a company to owe them, one number would hide exactly the part they chose to risk. What 'for sure' means is decided first, under d-kernel-secured, so the headline uses the shared meaning.")
  :changes-if "Shown both first screens with the same money, at least four of six people can say correctly what they would lose if their company vanished only with the one-number screen.")

(decision 'd-private-holder-named
  :question "Where does the person see which company holds their money?"
  :options {:never "One balance per currency; the companies behind it are not named."
            :only-the-promised-part "On the first screen, the part that rests on someone's word is split by company; the part that is theirs for sure is one number. Every amount is named on the company's own screen."
            :every-amount "Every amount on the first screen says which company it is with."}
  :depends ['d-private-first-screen]
  :decider 'user
  :leaning 'only-the-promised-part
  :because (canon 'accounts-are-bilateral "Every balance is a relationship with one named company, so the name is the true label; but naming every amount on the first screen turns two numbers into a table of currency by chain by company. The name changes what can be lost only beside the part that rests on that company's word, so that is where it goes first. no-solvency-proofs forbids adding anything about the company's reserves beside it.")
  :changes-if "People with money for sure at two companies, shown one number for it, are surprised when leaving one company returns less than that number.")

(decision 'd-private-first-holder
  :question "Who chooses the first company that holds the person's money?"
  :options {:suggested-and-named "The surface suggests one company, names it, says what it charges and how fast it must answer, and the person confirms."
            :choose-from-list "The person picks from every company that offers accounts."
            :follow-the-payer "The first company is the one the person who first pays them already uses."}
  :depends ['d-private-holder-named]
  :decider 'user
  :leaning 'suggested-and-named
  :because (canon 'no-solvency-proofs "The only honest facts about a company are its fees, its notice period and its response time, not its health, so a long list gives the person nothing to choose by; one named suggestion they confirm at least makes the choice visible instead of silent.")
  :changes-if "People given the list choose by a reason they can state in their own words, and that reason is not the order of the list.")

(decision 'd-private-home-grouping
  :question "How is the first screen grouped when money sits in several currencies, chains and companies?"
  :options {:per-currency "Grouped by currency, split by chain only where the person holds that currency on more than one; two numbers for each group."
            :per-company "Grouped by company, two numbers for each."
            :per-chain "Grouped by chain, then by currency within it."}
  :depends ['d-private-first-screen 'd-private-holder-named 'd-private-chains 'd-kernel-totals]
  :decider 'person-evidence
  :leaning 'per-currency
  :because (guess "The person thinks in dollars, not in companies or chains; the shared base states totals per currency and chain and never across chains, so grouping by currency is the smallest grouping that is still true. A company only matters for the promised part, which is split by company within each currency.")
  :changes-if "People with two companies ask first which company their money is with, before how much they have.")

(decision 'd-private-what-is-certain
  :question "When leaving a company would cost more on the chain than the locked share returns, what does this surface say?"
  :options {:cost-on-company-screen "The locked share is counted as for sure, as the shared base says; the company's screen always shows what leaving would cost and return."
            :flag-on-home-when-below "As above, and the first screen also says which locked shares are smaller than what leaving would cost."
            :count-as-promised "The surface counts a locked share smaller than the cost of leaving as resting on the company's word."}
  :depends ['d-kernel-secured 'd-private-first-screen]
  :decider 'maintainer
  :leaning 'cost-on-company-screen
  :because (canon 'collateral-secured "Only the person's share of the locked collateral is secured, and the shared base keeps that one meaning in every face. Counting it as promised would make the first number move with the chain's price on a day nothing happened to the person's money, and would make the same account read differently here than on any other surface. The cost of leaving is a separate number and belongs where leaving is decided.")
  :changes-if "The chain cost of leaving alone on the launch chains exceeds the locked share of most private accounts, so that 'for sure' is false for most people reading it.")

(decision 'd-private-coverage-shown
  :question "Where does the person learn that 'for sure' is not backed, because no copy is kept or the last copy failed?"
  :options {:home-when-not-covered "The first screen says an amount is not backed whenever its company's copy failed or its chain has no watching service; the protection screen gives the full state."
            :beside-every-sure-amount "Every 'for sure' amount carries its coverage state, good or bad."
            :protection-screen-only "Only the protection screen shows coverage."}
  :depends ['d-private-first-screen 'd-private-evidence]
  :decider 'person-evidence
  :leaning 'home-when-not-covered
  :because (canon 'keep-evidence "The locked share is certain only while someone holds the latest state both sides signed and answers in time. When that fails, the first screen's 'for sure' is false at that moment, so the failure has to reach the place the claim is made; when it holds, saying so beside every amount is noise.")
  :changes-if "People told only on failure believe they are covered on a chain where the warning never goes away, such as native TRON.")

(decision 'd-private-chains
  :question "Where does the person see which chain their money is on?"
  :options {:one-per-currency "Dollars are dollars; the chain is never shown."
            :named-as-place "Every amount says its chain, the way it says its company."
            :named-where-it-decides "The chain is named when paying, being paid, bringing money in, sending it out and changing it, and beside an amount only when the person holds that currency on more than one chain."}
  :forces {:named-where-it-decides ['d-private-exchange 'd-private-tron]}
  :depends ['d-private-who]
  :decider 'user
  :leaning 'named-where-it-decides
  :because (guess "Each account lives under one chain's rules, so dollars on one chain cannot pay someone on another without a swap. Hiding the chain makes a payment fail for a reason the person was never shown; naming it beside every amount costs a label on each number for a failure that can only happen when money moves.")
  :changes-if "People pay from the wrong chain, or are surprised which chain a payment arrived on, even though the chain was named at that moment."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-private-tron
  :question "Does this surface take real money on native TRON, where no watching service can answer for the person?"
  :options {:offer-said-not-covered "Yes. Joining a company on TRON says the account is not covered, and the person's time to answer there is longer."
            :test-only-here "Not on this surface; TRON is carried for real money by other surfaces until the watching service works there."
            :offer-silently "Yes, as on any other chain."}
  :depends ['d-private-chains 'd-kernel-evidence]
  :decider 'maintainer
  :leaning 'offer-said-not-covered
  :because (protocol "core/watchtower/submission-support.ts" "The watching service refuses to submit on native TRON, so there a private person who loses the phone or sleeps through a deadline has nobody to answer for them. TRON is a launch chain and the wide scope is deliberate, so leaving it out of the surface most people use would drop it where it matters most; saying 'not covered' and lengthening the time to answer is what is left.")
  :changes-if "The watching service is made to submit on TRON, or the maintainer rules that an uncovered account must not be offered to a private person.")

;; Asking before signing

(decision 'd-private-consent
  :question "Within the shared rule for asking before a signature, which kinds does this surface ask about?"
  :options {:all-but-adds "Every kind in the shared list asks except what only adds to the person's side: spending a fee, lowering what is theirs for sure, letting someone owe them more, making them owe, ending a relationship, publishing something about them."
            :floor-only "Only what the shared floor requires asks; fees and listing are signed inside amounts the person has already seen."
            :all-but-small-fees "As all-but-adds, but a fee below a small amount, stated once, is signed without asking."}
  :forces {:all-but-adds ['d-private-listed 'd-private-seeded-settings]}
  :depends ['d-kernel-consent 'd-private-who]
  :decider 'user
  :leaning 'all-but-adds
  :because (guess "The shared base sorts signatures by what they change and lets each face choose above a floor. This person cannot judge a company and must be told the worst in money before choosing, so everything that can cost them asks; only what adds to their side is signed at once. The protocol draws the same line for settlements, but extending it to every action is this surface's choice, not the protocol's.")
  :changes-if "Watching people use the questions for a week shows they approve more than nine in ten without reading the amount; then the line moves toward small fees signed at once."
  :status 'settled
  :settled-by "user: 2026-11-19")

(decision 'd-private-seeded-settings
  :question "What happens to the automatic request for the company to lock money, which opening an account switches on?"
  :options {:off-until-it-could-fire "Switched off in the signature right after opening; offered, with its trigger and the most it may pay in fees, at the moment the person lets the company owe them more than the trigger."
            :keep-and-say "Kept as seeded and said once, in money, when the person joins."
            :keep-silently "Kept as seeded and not mentioned."}
  :depends ['d-kernel-seeded 'd-private-consent 'd-private-receive-room]
  :decider 'maintainer
  :leaning 'off-until-it-could-fire
  :because (canon 'balance-bound "A company can never owe the person more than the amount the person allowed, so the seeded request cannot fire while that amount is below its trigger. Turning it off costs nothing until then, and the moment it could fire is the moment the person raises the amount and is present to be asked. Keeping it would spend a fee without a question, which d-private-consent forbids.")
  :changes-if "The maintainer lets the opening itself carry the setting, which removes the second signature; or people offered the automatic request at that moment almost all refuse it and then leave large amounts unsecured.")

(decision 'd-private-listed
  :question "Is the person's account with a company listed publicly, as opening an account does by default?"
  :options {:listed-and-said "Listed, and said in the opening question as something made public about the person."
            :unlisted-handle-carries-way "Not listed; what the person hands a payer carries the way to reach them."
            :ask-at-joining "The person is asked at joining whether to be listed."}
  :depends ['d-private-consent]
  :decider 'maintainer
  :leaning 'listed-and-said
  :because (guess "Listing publishes something about the person, so under d-private-consent it is asked or at least said. Whether a payment can reach someone who is not listed, using only what they handed the payer, is not established here; until it is, not listing could break being paid, the person's first job.")
  :changes-if "A routed payment is shown to reach an unlisted private person using only what they handed the payer; then unlisted becomes the leaning."
  :status 'settled
  :settled-by "user: 2026-11-19, provisional: the maintainer's decision, not yet answered by him")

(decision 'd-private-response-time
  :question "How long does the person have to answer if their company starts leaving against them?"
  :options {:day "24 hours, as the protocol sets for anyone who is not a company."
            :three-days "72 hours everywhere."
            :follows-coverage "24 hours where a watching service can answer for the person; 72 hours where none can, such as native TRON."}
  :depends ['d-private-evidence 'd-private-tron]
  :decider 'maintainer
  :leaning 'follows-coverage
  :because (canon 'exit-timing "The time to leave is both sides' answer times added together, so a longer answer time also makes the person's own leaving slower. Where a service answers for them, a day is enough; where nobody does, the person must answer themselves, and they cannot be relied on to look within a day.")
  :changes-if "Companies refuse to open accounts with a longer answer time, or people without a service are seen answering well inside a day.")

(decision 'd-private-coverage-lost
  :question "An account opened with a day to answer because a service answers for the person. What happens when that cover goes?"
  :options {:ask-to-move "The person is told the account now has a day to answer and nobody answering for them, and is asked once whether to move the money to another company joined with three days, bringing it out of this account with the company's signature."
            :three-days-from-start "Every account opens with three days whatever its cover, so losing cover never shortens anything; every exit is slower."
            :change-in-place "Ask the maintainer for a transaction, signed by both sides, that lengthens the person's own answer time on a live account."
            :say-only "The account is shown as not covered, with its day to answer, and nothing more."}
  :depends ['d-private-response-time 'd-private-coverage-shown 'd-kernel-reach]
  :decider 'maintainer
  :leaning 'three-days-from-start
  :because (protocol "core/account/config/dispute-config.ts" "Each side's answer time is part of the account's state from the opening; the only places that set it are opening an account and accepting one, and no account transaction changes it afterwards. An entity has one account per counterparty and opening a second is refused (core/entity/tx/handlers/account/lifecycle/open-account.ts), and I found nothing that removes an account, so a day chosen with a company is that relationship's answer time for good. Cover can go after opening: the person can withdraw the permission to answer, the service can fail to take the newest copy, or a newer state can make the held copy stale. A day to answer with nobody answering is what d-private-response-time chose to avoid, and the only way out is to leave the company or move the money to another one, which needs this company's signature and so fails on exactly the day it is needed. So I lean to three days from the start, which reverses the leaning of d-private-response-time: every exit with a company takes about seventy-three hours instead of twenty-five. Change-in-place would let the leaning return to follows-coverage, and is the maintainer's to build. On the other question the decision left open, what a company does about a three-day time: an account proposed to a company is checked only against the company's own floor for its own time (core/entity/tx/handlers/account/inbound-account.ts), so nothing in the runtime lets a company refuse a longer time for the person today.")
  :changes-if "The maintainer adds a way to lengthen the time on a live account (then follows-coverage with change-in-place); or cover is seen to go away on almost no accounts, so the slower exit for everyone costs more than it saves; or companies add a policy refusing long answer times.")

;; Paying

(decision 'd-private-pay-kind
  :question "Which kind of payment does this surface sign, on a chain where held payments may not yet carry real money?"
  :options {:held-and-wait "The held kind to anyone; the unconditional kind only to a company the person has an account with. On an EVM mainnet, real money is neither paid to nor received from anyone else until held-payment deadlines there are decided, and the person is told why."
            :unconditional-through-company-meanwhile "Until then, on an EVM mainnet, pay others unconditionally through the person's own company, telling them the company could keep it."
            :no-real-money-on-evm "Until then, this surface takes no real money on an EVM mainnet at all."}
  :depends ['d-private-consent 'd-private-chains 'd-kernel-held-pay-not-allowed]
  :decider 'maintainer
  :leaning 'held-and-wait
  :because (canon 'htlc-constants-are-simnet "No real-money held payment on an EVM mainnet until the deadlines are decided per chain. Paying unconditionally through a go-between asks the person to trust that company to pass the money on, which they cannot judge. So until the deadlines are decided, this surface pays real money on an EVM mainnet only to the company it holds an account with, and says that paying anyone else waits.")
  :changes-if "The maintainer decides the EVM deadlines before launch, which makes the question disappear; or private people are seen needing to pay others on an EVM mainnet before that.")

(decision 'd-private-pay-speed
  :question "How long may a payment wait for the person being paid to claim it?"
  :options {:instant "About two minutes; the payer's money comes back quickly if it fails, but a sleeping phone misses it."
            :slow "About a day; a sleeping phone can claim it when it wakes, but a failed payment holds the payer's money that long."
            :by-recipient "Instant when what the recipient handed over says they are online; the slow kind otherwise."}
  :depends ['d-private-pay-kind]
  :decider 'person-evidence
  :leaning 'by-recipient
  :because (protocol "core/entity/tx/handlers/htlc/payment.ts" "A held payment moves only if the recipient proves receipt before the deadline, about two minutes in instant mode and about a day in the slow mode, and the payer cannot take it back before then. A shop is online; a friend's phone usually is not. Either fixed choice fails one of them.")
  :changes-if "Private people's phones turn out to claim within two minutes almost every time, or payers find a day's hold on a failed payment worse than a failed payment.")

(decision 'd-private-which-company
  :question "With more than one company, which one does a payment leave from and arrive at?"
  :options {:chosen-and-shown "The surface picks the company with room to send, and on arrival the one where most of it would be secured, and shows which before signing."
            :main-company "The person names one main company; everything goes through it unless it lacks room."
            :ask-each-time "The person picks the company for every payment."}
  :depends ['d-private-holder-named 'd-private-receive-room]
  :decider 'person-evidence
  :leaning 'chosen-and-shown
  :because (guess "The person cannot judge companies, so asking them every time is a question without a basis; a main company is easy to understand but strands money at the others. Choosing by room and security and showing the choice keeps it visible without asking.")
  :changes-if "People are seen overriding the chosen company more than one time in five, for a reason they can state.")

;; Changing money, saving

(decision 'd-private-exchange
  :question "Does this surface change money from one kind to another, and in what shape?"
  :options {:elsewhere "No; another surface carries swaps."
            :now-same-chain "Yes, at a price shown now, with whatever does not fill at once cancelled, on one chain only."
            :now-and-across-chains "Yes, at a price shown now, with whatever does not fill at once cancelled, also between chains, where the filled part settles on each side before a deadline."
            :resting-orders "Yes, including orders that wait at a price for later."}
  :forces {:now-same-chain ['d-private-exchange-margin]
           :now-and-across-chains ['d-private-exchange-margin]}
  :depends ['d-private-chains]
  :decider 'maintainer
  :leaning 'now-and-across-chains
  :because (protocol "core/types/account.ts" "A swap order can be signed to fill at once and cancel what is left, or to fill completely or not at all, and the same terms are carried into an order between chains; so nothing unfilled stays held at the company, as it does for a resting order that only the company can cancel.")
  :changes-if "The maintainer assigns cross-chain swap to another surface for launch, or the cross-chain path cannot return the person's side without their action when a company fails mid-swap."
  :status 'settled
  :settled-by "user: 2026-11-19, provisional: the maintainer's decision, not yet answered by him")

(decision 'd-private-exchange-margin
  :question "How much worse than the shown price may an exchange fill before it is refused?"
  :options {:stated-margin "A small fixed margin, stated in money in the question before signing."
            :person-sets "The person sets the margin each time."
            :exact-or-nothing "No margin: the shown amount or nothing."}
  :depends ['d-private-exchange 'd-private-consent]
  :decider 'person-evidence
  :leaning 'stated-margin
  :because (guess "Prices move between showing and filling, so an exact price fails often; asking for a margin each time asks for a number this person has no way to pick. A fixed margin stated in money is a worst case they can read.")
  :changes-if "Exchanges with no margin fill nine times in ten at the sizes private people trade, or people say the stated worst case surprised them after the fill.")

(decision 'd-private-lending
  :question "Which part of lending does this surface carry?"
  :options {:none-here "None; another surface carries lending."
            :savings-only "Putting money aside with a company for interest; no borrowing."
            :savings-and-borrowing "Both putting money aside and borrowing from a company."}
  :depends ['d-private-first-screen]
  :decider 'maintainer
  :leaning 'savings-only
  :because (guess "Savings may be funded only from money the person already owns, and the principal moves to the company's side under a recorded agreement, so savings turn money that is theirs for sure into the company's promise, which the first screen already shows in its promised part; a loan instead makes the person owe the company, a different risk this person did not come for. Borrowing is proposed for a separate app under d-apps-borrowing.")
  :changes-if "The maintainer requires both lending directions on every surface that carries any lending, or people in this group ask for small loans more often than for savings.")

;; Silence, leaving, protection

(decision 'd-private-silent-holder
  :question "What happens when the company holding the person's money stops answering?"
  :options {:tell-only "Say the company is not answering and since when; do nothing more."
            :ask-after-set-silence "After a set silence, ask once whether to leave, saying what comes back for sure, what may not, how long it takes and what it costs."
            :ask-when-at-stake "Say it always; ask whether to leave only when waiting can cost the person something: money owed with nothing locked, or a payment whose deadline runs out during the silence."}
  :forces {:ask-when-at-stake ['d-private-evidence]}
  :depends ['d-private-holder-named 'd-private-consent 'd-kernel-silence]
  :decider 'user
  :leaning 'ask-when-at-stake
  :because (canon 'exit-alone "Leaving returns the locked share and pays what the company owed beyond it only from what the company has on the chain. A person whose money is all locked loses nothing by waiting, so a question would only invite leaving a company that may be restarting, which they cannot tell from one that is gone. Where something is owed with nothing locked or a deadline runs out, waiting can cost them, and the question has a reason in money.")
  :changes-if "Companies that go quiet almost always come back within the leaving window, so even questions asked only when something is at stake produce exits people regret.")

(decision 'd-private-evidence
  :question "Who keeps, and who uses, what the person needs to leave a company alone after losing their phone?"
  :options {:phone-only "Only the phone keeps it; losing the phone before leaving means depending on the company."
            :service-wakes "A coded copy goes to one watching service after every change, and the service wakes the person if someone starts leaving against them."
            :service-answers-for-me "As above, and the person also gives the service a narrow permission to answer a leaving started against them with the latest state, near the end of the window, if they have not."
            :several-services "Copies go to several independent services the person picks."}
  :forces {:service-answers-for-me ['d-private-restore-key 'd-private-coverage-shown 'd-private-copy-consent]}
  :depends ['d-kernel-evidence]
  :decider 'maintainer
  :leaning 'service-answers-for-me
  :because (protocol "core/watchtower/last-resort-appointment.ts" "The watching service can be appointed to answer a dispute the owner cannot answer, with no power to spend: it holds the latest proof the counterparty signed and an authorization bound to that one account and window. Waking alone sends a push to the phone that was lost, so it cannot protect the person this decision is about, and they cannot be relied on to answer within hours. On native TRON the service cannot submit, and there nobody answers.")
  :changes-if "The watching service is found to fail to accept or return copies in more than one in a hundred attempts, or the maintainer rules that no service runs at launch.")

(decision 'd-private-copy-consent
  :question "Is the person asked before a copy goes to the watching service and before it may answer for them?"
  :options {:copy-on-answer-asked "The coded copy is on and named at joining; the permission to answer for the person is asked at joining, as part of the opening question."
            :both-asked "Both the copy and the permission are asked at joining."
            :both-on-and-named "Both are on and named once at joining, without a question."}
  :depends ['d-private-evidence 'd-private-consent 'd-kernel-consent]
  :decider 'user
  :leaning 'copy-on-answer-asked
  :because (guess "A coded copy hands nobody any power, and switching it off silently loses the protection, so it is on and said. The permission to answer lets a third party act on the person's account, which the shared floor says needs a yes; it costs one more line in a question the person already answers at joining. The objection that a copy goes out without asking is not met by this leaning; both-asked is that position.")
  :changes-if "People who are asked about the copy at joining refuse it more than one time in ten, which would mean they object to a copy leaving the phone at all.")

(decision 'd-private-restore-key
  :question "What must the person keep so that a new phone is the same owner?"
  :options {:words-at-first-money "A list of words, shown and checked when money first arrives, not at install."
            :words-at-install "The same list, shown and checked before anything else."
            :second-device "A second device the person already owns holds it, with no words to write down."}
  :depends ['d-private-evidence 'd-kernel-keys]
  :decider 'user
  :leaning 'words-at-first-money
  :because (guess "The identity, the copies kept by the service and its permission to answer are all derived from one secret phrase (core/storage/recovery/bundle/seed-identity.ts), so the copy is useless without it. A service that keeps the phrase would be custody, which is outside this launch. Asking before there is money to lose asks for care the person has no reason yet to give.")
  :changes-if "People shown the words at first money skip them as often as people shown them at install, or a second device is shown to restore an owner without the words.")

(decision 'd-private-history
  :question "What does the person keep of payments after the moment has passed?"
  :options {:own-record "A list of what they paid and were paid, with the company, the note and the outcome, taken from their own signed history, and exportable."
            :record-and-proof "As above, and each completed payment can be handed to someone as proof that the recipient took it."
            :status-only "Only money still on its way; nothing after."}
  :depends ['d-private-consent]
  :decider 'person-evidence
  :leaning 'own-record
  :because (guess "Without a record the person cannot settle an argument with a shop or show a landlord that rent was sent. A proof a third party can check is better, but it only works if the third party made the request being paid; until people are seen needing that, the person's own record is the smaller step.")
  :changes-if "People are seen needing to prove a payment to someone who will not accept their own record, such as a landlord or a shop, more than rarely.")

;; ── 3. The surface that follows ──────────────────────────────────────────

(surface 'private-wallet :for 'private :first 'private-home
  :because ['d-private-who 'd-private-first-screen 'd-private-refuses])

(screen 'private-home :in 'private-wallet
  :answers "How much of my money is mine for sure, and how much rests on someone's word?"
  :shows ['collateral-mine 'owed-to-me-unsecured 'loan-principal 'owed-by-me-unsecured]
  :offers ['private-join-flow 'private-get-paid-flow 'private-pay-flow 'private-move-in-out-flow 'k-move-in-out-flow 'private-change-flow 'private-save-flow 'private-history-flow]
  :because ['d-private-first-screen 'd-private-holder-named 'd-private-home-grouping 'd-private-what-is-certain 'd-private-coverage-shown 'd-private-chains 'd-private-lending 'd-private-spend-borrowed])

(screen 'private-holder :in 'private-wallet
  :answers "What does this company hold of mine, and what could I lose with it?"
  :shows ['collateral-mine 'owed-to-me-unsecured 'credit-i-grant 'credit-left-to-them 'owed-by-me-unsecured 'credit-granted-to-me 'top-up-pending 'account-status 'exit-window-left 'exit-window-right 'route-fee-rate 'top-up-base-fee 'top-up-rate 'fee-notice 'auto-top-up-at]
  :offers ['private-less-at-risk-flow 'private-leave-flow 'k-leave-flow]
  :because ['d-private-holder-named 'd-private-what-is-certain 'd-private-seeded-settings 'd-private-listed 'd-private-response-time 'd-private-spend-borrowed 'd-private-silent-holder])

(screen 'private-on-its-way :in 'private-wallet
  :answers "Is any money still on its way to or from me, and until when?"
  :shows ['pending-amount 'pending-expires-at 'held-outgoing 'held-incoming 'top-up-pending]
  :offers []
  :because ['d-private-consent 'd-private-pay-speed 'd-private-silent-holder])

(screen 'private-question :in 'private-wallet
  :answers "Do I agree, knowing what this costs and what I could lose?"
  :shows ['pay-most-debited 'credit-i-grant 'top-up-fee-paid 'auto-top-up-max-fee 'order-min-receive 'order-max-fee]
  :offers []
  :because ['d-private-consent 'd-private-receive-room 'd-private-seeded-settings 'd-private-exchange-margin])

(screen 'private-leaving :in 'private-wallet
  :answers "When do I get my money back, and how much of it is certain?"
  :shows ['account-status 'exit-ready-at 'exit-ends-at 'collateral-mine 'owed-to-me-unsecured 'loan-principal]
  :offers ['private-leave-flow 'k-leave-flow]
  :because ['d-private-silent-holder 'd-kernel-silence 'd-kernel-leave-once])

(screen 'private-savings :in 'private-wallet
  :answers "How much have I put aside, what has it earned, and how do I get it back?"
  :shows ['loan-principal 'loan-rate 'loan-interest-so-far 'loan-term]
  :offers ['private-save-flow 'private-leave-flow]
  :because ['d-private-lending 'd-private-silent-holder])

(screen 'private-protection :in 'private-wallet
  :answers "If I lose this phone today, which of my companies could I still get my money back from?"
  :shows []
  :offers ['private-new-phone-flow 'k-restore-flow]
  :because ['d-private-evidence 'd-private-coverage-shown 'd-private-restore-key 'd-private-tron 'd-private-coverage-lost 'd-kernel-keys])

(screen 'private-history :in 'private-wallet
  :answers "What did I pay and receive, and can I show it to someone?"
  :shows []
  :offers ['private-history-flow]
  :because ['d-private-history])

(flow 'private-join-flow :in 'private-wallet
  :signs ['open-account 'set-auto-top-up 'grant-credit]
  :uses ['k-counterparty-terms 'k-effect 'k-question 'k-standing-rules 'k-real-or-test 'k-evidence 'k-answer-for-me]
  :ends (guess "The person knows which company now holds their account, how much it may owe them and that this is the most they could lose with it, whether the account is listed, how long they have to answer, whether it is covered, and that nothing is owed yet.")
  :because ['d-private-first-holder 'd-private-receive-room 'd-private-seeded-settings 'd-private-listed 'd-private-response-time 'd-private-copy-consent 'd-private-tron])

(flow 'private-get-paid-flow :in 'private-wallet :job 'private-get-paid
  :signs ['claim-payment 'grant-credit]
  :uses ['k-pay-handle 'k-holdings 'k-question 'k-causes]
  :ends (guess "The person knows the money arrived, whether it is theirs for sure or rests on the company's word, and how much that company may now owe them in total; or, if it did not arrive, why.")
  :because ['d-private-receive-room 'd-private-consent 'd-private-pay-kind 'd-private-pay-speed 'd-private-listed])

(flow 'private-pay-flow :in 'private-wallet :job 'private-pay
  :signs ['pay-routed 'pay-direct]
  :uses ['k-effect 'k-question 'k-real-or-test 'k-pay-handle 'k-pay-note 'k-causes]
  :ends (guess "The person knows the payment arrived and what it cost in total, or that it failed, why, and that the held amount came back.")
  :because ['d-private-consent 'd-private-chains 'd-private-pay-kind 'd-private-pay-speed 'd-private-which-company 'd-private-spend-borrowed])

(flow 'private-move-in-out-flow :in 'private-wallet :job 'private-move-in-out
  :signs []
  :uses ['k-chain-money 'k-effect 'k-real-or-test 'k-causes]
  :ends (guess "The person chose which chain and which of their companies, and the shared flow for bringing money in and out did the chain steps. They know the money is at their own address or inside, on which chain, and what the chain charged; or, if the company would not sign to let it out, that leaving the company is the only way left and what that returns.")
  :because ['d-private-chains 'd-private-consent 'd-kernel-money-in-out])

(flow 'private-less-at-risk-flow :in 'private-wallet :job 'private-less-at-risk
  :signs ['ask-top-up 'grant-credit 'set-auto-top-up]
  :uses ['k-holdings 'k-effect 'k-question 'k-standing-rules 'k-counterparty-terms]
  :ends (guess "The person knows how much now rests on the company's word, what they paid to lower it, and whether the company has yet locked what was asked.")
  :because ['d-private-receive-room 'd-private-seeded-settings 'd-private-holder-named])

(flow 'private-change-flow :in 'private-wallet :job 'private-change-currency
  :signs ['swap-place 'swap-cancel 'swap-across-start 'swap-across-authorize 'swap-across-close 'swap-across-recover]
  :uses ['k-effect 'k-question 'k-holdings 'k-silence 'k-causes]
  :ends (guess "The person knows what they gave, what they got, at what price and fee, and either that the exchange is complete on both sides or which part is still settling, until when, and how they get their side back alone if a company fails.")
  :because ['d-private-exchange 'd-private-exchange-margin 'd-private-chains 'd-private-consent])

(flow 'private-save-flow :in 'private-wallet :job 'private-save
  :signs ['lend 'lend-withdraw]
  :uses ['k-holdings 'k-effect 'k-question 'k-leaving-sums]
  :ends (guess "The person knows how much they put aside, with which company, at what rate, and when they can have it back; that only they can ask to close it and the company then pays it out; that the company may change the rate on savings they can take back at any time, for the future only; that it now rests on that company's word; and that leaving the company returns it with what it has earned as money the company owes.")
  :because ['d-private-lending 'd-private-consent])

(flow 'private-leave-flow :in 'private-wallet :job 'private-leave
  :signs []
  :uses ['k-silence 'k-leaving-sums 'k-evidence 'k-causes]
  :ends (guess "This is the private face's way into leaving; the shared leaving flow signs it. The person knows how much came back for sure, what is still owed and may never come, and that the account is closed; they did not have to come back at a set time to finish it.")
  :because ['d-private-silent-holder 'd-private-consent 'd-private-evidence 'd-kernel-silence 'd-kernel-leave-once])

(flow 'private-new-phone-flow :in 'private-wallet :job 'private-new-phone
  :signs []
  :uses ['k-identity 'k-evidence 'k-real-or-test 'k-causes]
  :ends (guess "With the words they kept, the person has the same money on the new phone, or knows which company could not be restored, why, and what leaving it would return.")
  :because ['d-private-evidence 'd-private-restore-key 'd-private-tron 'd-kernel-keys])

(flow 'private-history-flow :in 'private-wallet :job 'private-what-happened
  :signs []
  :uses ['k-record 'k-pay-note 'k-causes]
  :ends (guess "The person can find a past payment, see who it went to, through which company, with what note and whether it arrived, and take the list out as a file.")
  :because ['d-private-history])

;; Defaults

(default 'private-default-allowed-owing :in 'private-wallet
  :value "0 until the person names an amount when joining a company, stated as the most they could lose with it"
  :risk-on 'nobody
  :because ['d-private-receive-room])

(default 'private-default-first-company :in 'private-wallet
  :value "one suggested company, named with its fees and response time, confirmed by the person"
  :risk-on 'holder
  :because ['d-private-first-holder])

(default 'private-default-auto-top-up :in 'private-wallet
  :value "switched off in the signature right after opening; offered with its trigger and fee cap when the person lets the company owe them more than the trigger"
  :risk-on 'holder
  :because ['d-private-seeded-settings 'd-private-consent])

(default 'private-default-response-time :in 'private-wallet
  :value "72 hours for the person on every account, because a day chosen while a watching service answers cannot be lengthened later if that cover goes (d-private-coverage-lost); 1 hour for the company"
  :risk-on 'holder
  :because ['d-private-response-time 'd-private-evidence 'd-private-coverage-lost])

(default 'private-default-listed :in 'private-wallet
  :value "listed, as opening an account does, and said in the opening question as something made public"
  :risk-on 'holder
  :because ['d-private-listed 'd-private-consent])

(default 'private-default-pay-kind :in 'private-wallet
  :value "a held payment; on an EVM mainnet, real money goes only to the person's own company until held-payment deadlines there are decided"
  :risk-on 'nobody
  :because ['d-private-pay-kind])

(default 'private-default-spend-own :in 'private-wallet
  :value "a payment stops at what is the person's own; room the company lent is not spent"
  :risk-on 'nobody
  :because ['d-private-spend-borrowed])

(default 'private-default-which-company :in 'private-wallet
  :value "with more than one company, a payment leaves from the one with room for it and arrives where the most of it would be secured; the person sees which before signing"
  :risk-on 'holder
  :because ['d-private-which-company])

(default 'private-default-claim-incoming :in 'private-wallet
  :value "money sent to the person is claimed without asking; what lands beyond the company's locked money rests on its word, within the amount the person allowed"
  :risk-on 'holder
  :because ['d-private-consent 'd-private-receive-room])

(default 'private-default-adding-settlements :in 'private-wallet
  :value "a settlement that only adds to the person's side is signed without asking"
  :risk-on 'nobody
  :because ['d-private-consent])

(default 'private-default-pay-limit :in 'private-wallet
  :value "the quoted total with fees is the most a payment may take; a higher total asks again"
  :risk-on 'holder
  :because ['d-private-consent])

(default 'private-default-pay-speed :in 'private-wallet
  :value "instant when what the recipient handed over says they are online; otherwise the slow kind, which can hold the payer's money for about a day if it fails"
  :risk-on 'holder
  :because ['d-private-pay-speed])

(default 'private-default-silence :in 'private-wallet
  :value "the person is told a company is not answering; asked about leaving only when waiting can cost them, after a silence to be fixed by observation"
  :risk-on 'holder
  :because ['d-private-silent-holder])

(default 'private-default-finish-leaving :in 'private-wallet
  :value "the question that starts leaving states the chain cost of finishing and its most; finishing is then signed without asking the first time the app runs after the window ends, and asks again only if the chain now charges more than that most"
  :risk-on 'holder
  :because ['d-private-silent-holder 'd-private-consent])

(default 'private-default-exchange-shape :in 'private-wallet
  :value "fill at once at the shown price or not at all; the least accepted is the shown amount less a fixed margin stated in money"
  :risk-on 'holder
  :because ['d-private-exchange 'd-private-exchange-margin])

(default 'private-default-copy-kept :in 'private-wallet
  :value "the coded copy is on wherever a watching service works and named when joining; its permission to answer for the person is asked in the same question; 'not covered' on native TRON"
  :risk-on 'holder
  :because ['d-private-evidence 'd-private-copy-consent 'd-private-tron])

(default 'private-default-chain-fee :in 'private-wallet
  :value "the chain's current price, shown before the person signs"
  :risk-on 'holder
  :because ['d-private-consent 'd-private-chains])

(gap 'private-no-borrowing :job 'private-borrow
  :why (guess "A loan makes the person owe the company, and if either side leaves while they owe beyond the locked money, the rest is taken from their money on the chain (core/entity/tx/handlers/dispute/finalize.ts); this surface carries savings only under d-private-lending and refuses spending the company's line under d-private-spend-borrowed. Borrowing for this person is proposed as the separate app in apps.scm under d-apps-borrowing; if the maintainer rejects that app, the Lending launch flow has no borrower here and that must be said, not left silent."))

;; ── 4. What this surface needs from the shared base ──────────────────────

(need 'private-needs-certain-and-promised :of 'private-wallet
  :wants (guess "For each company and in total per currency and chain, how much is the person's for sure, how much rests on that company's word, and how much of that is savings, stated by the runtime and never added up by the surface.")
  :because ['d-private-first-screen 'd-private-holder-named 'd-private-home-grouping 'd-private-lending])

(need 'private-needs-chain-money :of 'private-wallet
  :wants (guess "The money the person keeps on each chain outside any company, stated beside the rest, with the debts that stand ahead of it.")
  :because ['d-private-first-screen 'd-private-chains])

(need 'private-needs-one-question :of 'private-wallet
  :wants (guess "One plain question before any signature that can cost the person, stating the most it can take and the worst it can lose, with a record that it was asked and answered; and silent signing of what only adds to their side.")
  :because ['d-private-consent 'd-private-receive-room])

(need 'private-needs-quote :of 'private-wallet
  :wants (guess "The full cost of a payment, an exchange, a request to lock money or a chain action, before it is signed, in the money being spent.")
  :because ['d-private-consent 'd-private-exchange 'd-private-exchange-margin])

(need 'private-needs-pay-handle :of 'private-wallet
  :wants (guess "Something the person can hand to a payer that lets the payment reach them, whether or not either side has a direct line to a company.")
  :because ['d-private-receive-room 'd-private-listed])

(need 'private-needs-company-facts :of 'private-wallet
  :wants (guess "What can honestly be said about a company before joining it: what it charges, how much notice it gives before charging more, and how long it has to answer; nothing about its reserves.")
  :because ['d-private-first-holder])

(need 'private-needs-silence :of 'private-wallet
  :wants (guess "To know that a company has stopped answering, since when, and which deadlines on the person's money run out meanwhile.")
  :because ['d-private-silent-holder])

(need 'private-needs-leaving-sums :of 'private-wallet
  :wants (guess "For every company, at any time and not only when leaving: what leaving alone would return for sure, what may not come back, when, and what it costs on the chain.")
  :because ['d-private-silent-holder 'd-private-what-is-certain])

(need 'private-needs-wake :of 'private-wallet
  :wants (guess "To wake the person when someone starts leaving an account against them, while their time to answer runs.")
  :because ['d-private-evidence 'd-private-silent-holder])

(need 'private-needs-copy-kept :of 'private-wallet
  :wants (guess "To keep the latest agreed state of every account off the phone, restore it on a new one, and say per company and chain whether it is covered and whether the last copy was accepted or failed.")
  :because ['d-private-evidence 'd-private-coverage-shown])

(need 'private-needs-real-or-test :of 'private-wallet
  :wants (guess "To say whether the money on a chain is real or test money, which protections work there, and to refuse real money where it is not yet allowed.")
  :because ['d-private-refuses 'd-private-tron 'd-private-pay-kind])

(need 'private-needs-causes :of 'private-wallet
  :wants (guess "Every failure from the runtime, with its cause, in words the surface can pass on.")
  :because ['d-private-consent])

(need 'private-needs-own-spendable :of 'private-wallet
  :wants (guess "For each company, how much the person can send without owing it anything, stated by the runtime, so a payment can stop there.")
  :because ['d-private-spend-borrowed])

(need 'private-needs-answered-for-me :of 'private-wallet
  :wants (guess "To give the watching service, per company, the narrow permission to answer a leaving started against the person, renewed after every change, and to say where that is not possible.")
  :because ['d-private-evidence 'd-private-response-time])

(need 'private-needs-restore-identity :of 'private-wallet
  :wants (guess "To show and check the words that make a new phone the same owner, and to restore every company's latest state from them.")
  :because ['d-private-restore-key])

(need 'private-needs-record :of 'private-wallet
  :wants (guess "The person's own list of payments sent and received, with company, note and outcome, that can be taken out as a file.")
  :because ['d-private-history])

(need 'private-needs-recipient-online :of 'private-wallet
  :wants (guess "What a recipient hands a payer says whether their side is online to claim within minutes.")
  :because ['d-private-pay-speed])
