;; Author: grok-4.7 (p1-consumer)
;; Kernel ends at home, activity, safety, and one sheet. Pay, household tabs,
;; checkout, instant convert, and savings are programs. They propose. The sheet signs.
;; Screen 1 is locked money only. A promise gets its own screen, and only when non-zero.
;; Known ceiling: if send-capacity can still spend that promise, Home is the smaller number
;; and the sheet's unbacked delta is the correction. One-bar + Pro-on wins on parity cost.

(signing-sheet 'kernel-sheet
  :covers   ['send-routed 'send-direct 'open-account 'request-cover 'extend-peer-tab
              'instant-swap 'deposit-savings 'close-savings
              'unilateral-exit 'finalize-dispute 'export-backup]
  :shows    ['program-origin 'counterparty 'delta-secured 'delta-unbacked-risk
              'delta-credit-limit 'delta-owed 'fee-exact 'expiry-deadline]
  :fee-before #t
  :survival (guess "If they disappear, the locked amount can still be claimed from the last page you both signed. A promise with nothing locked ends with them.")
  :warns    [(guess "A promise is not cash. If they disappear, only the locked amount can be enforced.")
             (guess "If a limit goes up, you are the one at risk. The app that opened this sheet cannot grant you money.")
             (guess "The fee is shown before you confirm, and it comes out of the amount.")]
  :why      (from-code "ui/src/components/RuntimeCommandGate.tsx" "The live gate checks sync readiness and is not a consent boundary. One sheet covers every consumer verb, names the program that asked, and shows locked, promised, owed, limit, fee, and deadline before a signature.")
  :sources  ["ui/src/components/RuntimeCommandGate.tsx" "docs/studies/ui/surfaces/AS-IS.md" "docs/studies/ui/surfaces/BRIEF.md"])

(surface 'consumer-wallet
  :who    (guess "A person or a household: pay a friend, split a bill, check out, convert, set money aside. Not a hub desk and not a trading book.")
  :entry  'home
  :modes  ['always]
  :terms  {:secured  (term-copy
                       :label (guess "Available")
                       :note (guess "Locked. Still yours if they disappear.")
                       :note-when 'non-zero)
           :unbacked (term-copy
                       :label (guess "Owed to you")
                       :note (guess "Nothing is locked. Not part of Available.")
                       :note-when 'non-zero)
           :dispute  (term-copy
                       :label (guess "Needs you")
                       :note (guess "You can file the last page you both signed without them.")
                       :note-when 'always)}
  :defaults [(default-rule 'no-silent-credit
               :value "0 USDC"
               :risk-bearer 'user
               :consent (guess "Opening this does not let anyone owe you. Set a limit only for someone you would lend cash.")
               :why (as-is "ui/src/components/LendingRiskConsent.tsx" "The saver authorizes a maximum exposure; opening an Account never does.")
               :sources ["ui/src/components/LendingRiskConsent.tsx" "docs/studies/ui/surfaces/AS-IS.md"])
             (default-rule 'promise-not-cash
               :value "excluded from Available"
               :risk-bearer 'user
               :consent (guess "This is owed to you with nothing locked. It is not added to Available, and it may never be paid.")
               :why (as-is "ui/src/components/home/BalanceDetails.tsx" "Repayment depends on the other party.")
               :sources ["ui/src/components/home/BalanceDetails.tsx" "docs/studies/ui/surfaces/AS-IS.md"])]
  :screens [(screen 'home
              :purpose (guess "The money that is locked for you. Promises are not added to this number.")
              :headline 'secured-receivable
              :figures ['secured-receivable]
              :bars ['secured-receivable]
              :actions []
              :max-words 45
              :why (guess "Headline is the locked receivable, labeled Available. Send-capacity is not the headline: the live home folds uncovered money into the big number. If a payment can still spend that room, the sheet shows the unbacked delta because Home will not.")
              :sources ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/components/home/BalanceDetails.tsx"])
            (screen 'activity
              :purpose (guess "What you sent, what you got, and what got locked, newest first.")
              :headline 'secured-receivable
              :figures ['secured-receivable]
              :actions []
              :max-words 45
              :why (from-code "ui/src/screens/Activity.tsx" "The movement log stays in the kernel. Frame height and hash do not, and neither do the holding buckets.")
              :sources ["ui/src/screens/Activity.tsx"])
            (screen 'promise
              :purpose (guess "Owed to you, with nothing locked. Not part of the number on the first screen.")
              :headline 'unbacked-exposure
              :figures ['unbacked-exposure]
              :actions ['cover]
              :when (lambda (s) (> (:risk s) 0))
              :max-words 45
              :why (as-is "ui/src/components/home/CreditDetails.tsx" "Not a balance")
              :sources ["ui/src/components/home/CreditDetails.tsx" "ui/src/screens/AccountDetail.tsx"])
            (screen 'safety
              :purpose (guess "A saved copy of this wallet, and the path to settle from the last page you both signed.")
              :headline 'dispute-phase
              :figures ['dispute-phase 'secured-receivable]
              :actions ['exit 'backup]
              :max-words 45
              :why (guess "Exit and the saved copy stay in the kernel. A program must not own them. The button is here before a dispute starts, not only after.")
              :sources ["ui/src/screens/Sovereignty.tsx" "docs/studies/ui/surfaces/AS-IS-SCREENS.md"])
            (screen 'settle
              :purpose (guess "They are not cooperating. File the last page you both signed, or finish when their time is up.")
              :headline 'dispute-phase
              :figures ['dispute-phase 'secured-receivable]
              :actions ['exit 'finish]
              :when (lambda (s) (:disputed s))
              :max-words 45
              :why (as-is "ui/src/screens/AccountDetail.tsx" "Take the last page you both signed to the chain. You never need the other side's permission.")
              :sources ["ui/src/screens/AccountDetail.tsx"])]
  :flows [(flow 'cover
            :verb 'request-cover
            :before (guess "Ask them to lock it")
            :pending (guess "Asking...")
            :done (guess "Asked. You saw the fee first.")
            :failed (guess "Still unlocked.")
            :why (from-code "ui/src/screens/AccountDetail.tsx" "Cover is not a home row. It is the one action on the promise screen, and the fee is on the sheet before confirm.")
            :sources ["ui/src/screens/AccountDetail.tsx" "docs/studies/ui/surfaces/AS-IS.md"])
          (flow 'exit
            :verb 'unilateral-exit
            :before (guess "Settle without them")
            :pending (guess "Filing the last signed page...")
            :done (guess "Filed.")
            :failed (guess "Not filed. Nothing changed.")
            :why (as-is "ui/src/screens/AccountDetail.tsx" "Take the last page you both signed to the chain. You never need the other side's permission.")
            :sources ["ui/src/screens/AccountDetail.tsx"])
          (flow 'finish
            :verb 'finalize-dispute
            :before (guess "Finish")
            :pending (guess "Finishing...")
            :done (guess "Settled.")
            :failed (guess "Not settled yet.")
            :why (guess "Finish stays on the dispute screen. Pressing it early changes nothing.")
            :sources ["ui/src/screens/Sovereignty.tsx"])
          (flow 'backup
            :verb 'export-backup
            :before (guess "Save a copy")
            :pending (guess "Saving a copy...")
            :done (guess "Copy saved.")
            :failed (guess "Copy not saved.")
            :why (guess "The copy is a kernel action. No program requests it.")
            :sources ["ui/src/screens/Sovereignty.tsx"])]
  :doors ['place-limit-order 'cancel-order 'cross-j-swap
           'move-r2c 'move-r2r 'move-r2e 'rebalance-policy
           'set-hub-credit 'set-bank-rates
           'borrow-facility 'repay-loan
           'propose-multisig 'vote-multisig 'reset-testnet]
  :why (canon "AGENTS.md" "Both wallets stay. This is the shared everyday kernel: locked number, log, safety, sheet. Pay, same-J convert, and saver deposit are programs on that kernel. Reserve moves, the resting book, cross-network swap, hub rates, loans, and board votes are doors. They are not deleted from the product. They are not on this surface. The Pro toggle is the cheaper way to keep them one tap away. This surface refuses that tap.")
  :sources ["AGENTS.md" "todo.md" "docs/studies/ui/surfaces/BRIEF.md" "docs/studies/ui/surfaces/AS-IS.md"])

(xln-app 'pay-link
  :kind 'embedded
  :render 'fixed
  :audience (guess "Someone paying a person they know, or handing that person a link that asks to be paid.")
  :reads ['send-capacity 'secured-receivable 'unbacked-exposure]
  :requests ['send-routed 'send-direct 'open-account]
  :claim-shown (guess "Pay someone, or send a link that asks them to pay you.")
  :why (from-code "ui/src/screens/Pay.tsx" "Compose and the link stay a program. Route picking and mode picking do not. A new account opens at the zero credit default, then the sheet.")
  :sources ["ui/src/screens/Pay.tsx" "docs/studies/ui/surfaces/BRIEF.md"])

(xln-app 'friend-tab
  :kind 'embedded
  :render 'generative
  :audience (guess "A household or a few friends splitting a cost.")
  :reads ['unbacked-exposure 'owed-payable 'peer-credit-granted 'secured-receivable]
  :requests ['extend-peer-tab 'send-direct 'send-routed 'request-cover]
  :claim-shown (guess "Split a bill. A promise stays a promise until someone locks it or pays it.")
  :why (guess "The split names a changing set of people and shares, so a fixed form loses. The program may build that once. Each limit, payment, or lock request still crosses the kernel sheet. The program cannot file an exit, finish a dispute, or export a copy.")
  :sources ["docs/studies/ui/surfaces/BRIEF.md" "docs/studies/ui/surfaces/AS-IS.md"])

(xln-app 'merchant-checkout
  :kind 'external
  :render 'fixed
  :audience (guess "A person paying a merchant from that merchant's page.")
  :reads ['send-capacity 'secured-receivable]
  :requests ['send-routed 'send-direct 'open-account]
  :claim-shown (guess "Pay this merchant. You will see who is paid and the fee before it goes.")
  :why (guess "The merchant page is not the wallet. It may propose a payment and an account opened at zero credit. It may not set a limit, move reserve, or file an exit.")
  :sources ["docs/studies/ui/surfaces/BRIEF.md" "ui/src/screens/Pay.tsx"])

(xln-app 'instant-convert
  :kind 'embedded
  :render 'fixed
  :audience (guess "A person changing one token for another at the price shown.")
  :reads ['send-capacity 'orderbook-frame]
  :requests ['instant-swap]
  :claim-shown (guess "Swap now at the price on this screen, then confirm on the wallet sheet.")
  :why (from-code "ui/src/screens/Swap.tsx" "Instant conversion stays a two-step program. The resting book and cross-network legs stay behind the wallet doors.")
  :sources ["ui/src/screens/Swap.tsx" "docs/studies/ui/surfaces/AS-IS-SCREENS.md"])

(xln-app 'simple-savings
  :kind 'embedded
  :render 'fixed
  :audience (guess "A person setting money aside with one hub.")
  :reads ['secured-receivable 'own-credit-granted 'peer-credit-granted]
  :requests ['deposit-savings 'close-savings]
  :claim-shown (guess "Set money aside only after you set the most you can lose.")
  :why (from-code "ui/src/screens/Lending.tsx" "Saver deposit and close stay. Borrow, repay, and published hub rates do not. The risk limit is a sheet delta, not a sentence on screen 1.")
  :sources ["ui/src/screens/Lending.tsx" "ui/src/components/LendingRiskConsent.tsx" "AGENTS.md"])

(story 'open-empty
  :surface 'consumer-wallet
  :given 'empty
  :steps ['home 'safety 'backup]
  :outcome (guess "Available is zero. No credit limit exists. A copy can be saved. No promise screen, because nothing is owed.")
  :why (guess "Empty is the first run. The live product paints 10,000 of room here. This walk paints zero, and safety is already reachable.")
  :sources ["docs/studies/ui/surfaces/AS-IS.md" "todo.md"])

(story 'uncovered-promise
  :surface 'consumer-wallet
  :given 'uncovered
  :steps ['home 'promise 'cover]
  :outcome (guess "Home still shows only what is locked, here zero. The 100 sits on the promise screen. They asked for a lock and saw the fee first. If the other side does nothing, Available stays zero and the promise stays owed.")
  :why (guess "The live home shows 100 as the balance and as payment capacity while collateral is zero. This walk refuses that addition. A stall must not promote the promise into Available.")
  :sources ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/components/home/BalanceDetails.tsx"])

(story 'partly-locked
  :surface 'consumer-wallet
  :given 'partlyCovered
  :steps ['home 'promise]
  :outcome (guess "Home shows the locked part only. The unlocked remainder stays on the promise screen, labeled owed, not cash.")
  :why (guess "A partial lock is where a single bar smears two facts into one number. The facts stay on two screens.")
  :sources ["docs/studies/ui/surfaces/AS-IS.md"])

(story 'dispute-exit
  :surface 'consumer-wallet
  :given 'disputed
  :steps ['home 'promise 'settle 'exit]
  :outcome (guess "Available is still only the locked part. The promise is still not cash. The last signed page is filed on-chain without the other side online.")
  :why (guess "Dispute must not be an operator desk. The same home number holds, the promise does not graduate, and exit is on a screen that is visible in this state.")
  :sources ["ui/src/screens/AccountDetail.tsx" "docs/studies/ui/surfaces/AS-IS-SCREENS.md"])

(story 'pay-a-friend
  :surface 'pay-link
  :given 'partlyCovered
  :steps ['compose 'sheet]
  :outcome (guess "They composed a payment or a request link. The sheet named the program, the person, the fee, and how much of the move was locked versus only a promise. A new account, if any, did not grant a limit.")
  :why (guess "Pay is episodic. The kernel does not grow a route picker to hold it.")
  :sources ["ui/src/screens/Pay.tsx" "docs/studies/ui/surfaces/BRIEF.md"])

(story 'split-dinner
  :surface 'friend-tab
  :given 'uncovered
  :steps ['split 'owe-line 'sheet]
  :outcome (guess "The tab listed who owes whom. Any limit they extended, any payment they sent, and any lock they asked for was signed on the kernel sheet, with the unbacked delta in words.")
  :why (guess "The split is computed and dropped. What persists is the signed limit or payment, not a new wallet tab of buckets.")
  :sources ["docs/studies/ui/surfaces/BRIEF.md"])

(story 'pay-checkout
  :surface 'merchant-checkout
  :given 'partlyCovered
  :steps ['invoice 'sheet]
  :outcome (guess "The merchant named an amount. The sheet named who is paid, the fee, and whether the money was locked, before the user confirmed.")
  :why (guess "Checkout is someone else's page. It proposes a payment. The wallet is the only signer.")
  :sources ["docs/studies/ui/surfaces/BRIEF.md" "ui/src/screens/Pay.tsx"])

(story 'convert-now
  :surface 'instant-convert
  :given 'partlyCovered
  :steps ['pair 'sheet]
  :outcome (guess "One price, then the sheet. No resting order and no second network.")
  :why (guess "Same-J convert is a quote. The book is a different job and stays doored.")
  :sources ["ui/src/screens/Swap.tsx"])

(story 'save-aside
  :surface 'simple-savings
  :given 'partlyCovered
  :steps ['amount 'risk-limit 'sheet]
  :outcome (guess "They named an amount, set the most they can lose, saw that limit as a credit delta on the sheet, and only then deposited. Screen 1 never asked.")
  :why (guess "Savings is the consumer place where unsecured exposure is a conscious act. Opening the wallet is not that act. Hub rate policy is not this program.")
  :sources ["ui/src/screens/Lending.tsx" "ui/src/components/LendingRiskConsent.tsx"])

(fork 'home-number-vs-one-bar
  :status 'open
  :decider 'maintainer
  :question "Does everyday Home show one send-capacity bar with Pro on by default, or a locked-only number whose other jobs are programs behind one sheet?"
  :affects ['consumer-wallet 'kernel-sheet 'pay-link 'friend-tab 'merchant-checkout 'instant-convert 'simple-savings]
  :options {:one-bar "One send-capacity bar and a Pro toggle on by default, in both wallets. Smallest parity cost. Keeps cross-network swap and hub lending one tap away. Leaves uncovered money looking like cash unless the bar's meaning changes, and still has no shared sheet."
            :locked-kernel "Home shows the locked receivable only. Promises get a screen when non-zero. Pay, tabs, checkout, convert, and savings are programs. One sheet shows program, person, locked delta, promise delta, limit delta, owed, fee, and deadline. Operator verbs are doors."}
  :current 'locked-kernel
  :why (canon "todo.md" "The one-bar baseline wins on cost and on keeping launch flows one toggle away: no program host, one Home in React and Svelte, Pro on by default. It does not win on the silent 10,000 limit or the missing sheet. Those two can be fixed without this split, and should be, even if the toggle stays. The split is worth it only for the episodic tools and for refusing to add a promise into Available. It is a loss if send-capacity still spends the promise Home hid, and a loss if cross-network swap and hub lending must ship on the same everyday screens. Doors are not a second surface. Someone still has to build that surface or keep the toggle.")
  :sources ["todo.md" "AGENTS.md" "docs/studies/ui/surfaces/AS-IS.md" "docs/studies/ui/surfaces/BRIEF.md"])
