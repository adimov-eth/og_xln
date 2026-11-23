;; Author: grok-4.7 (p3-commercial)
;; Commercial operators. Retail balance clones are the trap this surface refuses.
;; Figures and verbs come from base.scm. This file does not redefine them.

(signing-sheet 'desk-sign
  :covers [
    'open-account
    'send-routed
    'send-direct
    'request-cover
    'extend-peer-tab
    'set-hub-credit
    'move-r2c
    'move-r2r
    'move-r2e
    'rebalance-policy
    'unilateral-exit
    'finalize-dispute
    'propose-multisig
    'vote-multisig
    'export-backup
    'reset-testnet
    'instant-swap
    'place-limit-order
    'cancel-order
    'cross-j-swap
    'set-bank-rates
    'borrow-facility
    'repay-loan]
  :shows [
    'program-origin
    'counterparty
    'delta-secured
    'delta-unbacked-risk
    'delta-credit-limit
    'delta-owed
    'fee-exact
    'expiry-deadline]
  :fee-before #t
  :survival (guess "Collateral already locked in the XLN contract can be enforced from the last page you both signed, without the other side. An open IOU, and a credit ceiling nobody has drawn, do not survive them. Coins in your chain wallet, and reserve not yet assigned to a lane, stay yours.")
  :warns [
    (guess "If a credit ceiling changes here, they can owe you more with nothing locked. That ceiling is not cash you can send.")
    (guess "The program that asked is named above the amounts. Read that name before you sign.")
    (guess "Each lane is its own line, with its own fee. A single total does not replace those lines.")
    (guess "If the board is short of its count, this only queues a proposal. No money has moved.")]
  :why (guess "One sheet guards every mutating verb the desk and the four programs can ask for. Fee is on the sheet before the button. Each line keeps its own locked delta, open-IOU delta, credit-ceiling delta, amount owed, counterparty, deadline, and program name. A batch is many lines and one confirmation, not one blended capacity figure. A Hanko short of threshold becomes a proposal and the sheet says nothing has moved. Local reset and backup come through the same sheet so a pay form cannot clear testnet data on the side.")
  :sources [
    "AGENTS.md"
    "todo.md"
    "docs/studies/ui/surfaces/AS-IS.md"
    "docs/studies/ui/surfaces/AS-IS-SCREENS.md"
    "docs/studies/ui/surfaces/BRIEF.md"])

(surface 'pro
  :who (guess "OTC desks, market makers, payout corridors, freight and supplier meshes, and hub operators.")
  :entry 'desk
  :modes ['pro-only]
  :terms {
    :lanes (term-copy
      :label (guess "Lanes")
      :note (guess "One row per counterparty. Not a blended balance.")
      :note-when 'always)
    :secured (term-copy
      :label (guess "Locked")
      :note (guess "Collateral in the XLN contract. Enforceable without them.")
      :note-when 'non-zero)
    :unbacked (term-copy
      :label (guess "Open IOU")
      :note (guess "They owe you this. Nothing is locked behind it.")
      :note-when 'non-zero)
    :owed (term-copy
      :label (guess "You owe")
      :note (guess "What you owe on this lane.")
      :note-when 'non-zero)
    :send-room (term-copy
      :label (guess "Can send")
      :note (guess "Room on the lane right now. Not a balance, and not a credit ceiling.")
      :note-when 'always)
    :receive-room (term-copy
      :label (guess "Can receive")
      :note (guess "Room for inbound payments. A ceiling you have not signed is not this number.")
      :note-when 'always)
    :peer-credit (term-copy
      :label (guess "You extend")
      :note (guess "The most they may owe you with nothing locked. Starts at 0.")
      :note-when 'always)
    :own-credit (term-copy
      :label (guess "They extend")
      :note (guess "The most you may owe them. It does not make you richer.")
      :note-when 'always)
    :reserve (term-copy
      :label (guess "Reserve")
      :note (guess "In the contract, not assigned to a lane yet.")
      :note-when 'always)
    :onchain (term-copy
      :label (guess "Chain wallet")
      :note (guess "At your address, outside the XLN contract.")
      :note-when 'always)
    :board (term-copy
      :label (guess "Board")
      :note (guess "Signers, and the count required before money moves.")
      :note-when 'always)
    :dispute (term-copy
      :label (guess "Dispute")
      :note (guess "You can submit the last page you both signed without them.")
      :note-when 'always)}
  :defaults [
    (default-rule 'hub-credit
      :value "0 USDC"
      :risk-bearer 'user
      :consent (guess "Name the counterparty and the exact ceiling. Opening a lane grants no credit.")
      :why (guess "Live Home shows 10,000 USDC extended on the first hub. The lending consent card says opening an account never authorizes unsecured risk. A desk that trades against send room will treat a silent ceiling as inventory. Commercial Pro starts at 0 until this sheet is signed.")
      :sources [
        "docs/studies/ui/surfaces/AS-IS.md"
        "ui/src/components/LendingRiskConsent.tsx"])
    (default-rule 'rebalance-off
      :value "off"
      :risk-bearer 'none
      :consent (guess "Reserve stays put until you sign a policy with a floor and a fee bound.")
      :why (guess "An automatic top-up would move reserve without a line on this sheet. The policy flow is the only way reserve starts moving on its own.")
      :sources ["ui/src/screens/AccountDetail.tsx" "ui/src/screens/Manage.tsx"])]
  :screens [
    (screen 'desk
      :purpose (guess "Select lanes here. Locked collateral and open IOU stay on separate bars. Send room is a column. Pay signs one line per lane.")
      :headline 'account-lanes
      :figures [
        'account-lanes
        'secured-receivable
        'unbacked-exposure
        'owed-payable
        'send-capacity
        'receive-capacity
        'peer-credit-granted
        'own-credit-granted]
      :bars ['secured-receivable 'unbacked-exposure]
      :actions ['open 'pay 'pay-direct]
      :mode 'pro-only
      :max-words 32
      :why (guess "The operator grid becomes the entry. Send room stays a column beside the two bars.")
      :sources ["docs/studies/ui/surfaces/AS-IS.md" "todo.md"])
    (screen 'credit-lanes
      :purpose (guess "Set the ceiling you extend, ask them to lock collateral, and sign a reserve policy.")
      :headline 'peer-credit-granted
      :figures [
        'peer-credit-granted
        'own-credit-granted
        'unbacked-exposure
        'secured-receivable
        'reserve-cash]
      :bars ['secured-receivable 'unbacked-exposure]
      :actions ['cover 'extend 'hub-limit 'set-policy]
      :mode 'pro-only
      :when (lambda (s) (> (:hubs s) 0))
      :max-words 24
      :why (from-code "ui/src/screens/AccountDetail.tsx" "Cover, ceilings, and rebalance sit off the pay row so a payout click cannot also extend credit.")
      :sources ["ui/src/screens/AccountDetail.tsx" "ui/src/screens/Manage.tsx"])
    (screen 'move
      :purpose (guess "Move reserve into a lane, to another entity, or out to your chain wallet.")
      :headline 'reserve-cash
      :figures ['reserve-cash 'onchain-cash 'secured-receivable]
      :actions ['to-account 'to-entity 'to-wallet]
      :mode 'pro-only
      :max-words 24
      :why (from-code "ui/src/screens/Move.tsx" "Reserve into a lane, reserve to another entity, and reserve out to the chain wallet stay three signatures.")
      :sources ["ui/src/screens/Move.tsx"])
    (screen 'multisig
      :purpose (guess "Board signers, and the count a proposal must reach before money moves.")
      :headline 'entity-board
      :figures ['entity-board]
      :actions ['propose 'vote]
      :mode 'pro-only
      :max-words 24
      :why (canon "AGENTS.md" "Hanko signers and threshold stay in this launch. Share issuance and taking control of another entity stay out.")
      :sources ["ui/src/screens/Ownership.tsx" "AGENTS.md"])
    (screen 'watchtower
      :purpose (guess "Submit the last page you both signed if the other side stalls.")
      :headline 'dispute-phase
      :figures ['dispute-phase 'secured-receivable 'unbacked-exposure]
      :actions ['exit 'backup 'reset]
      :mode 'pro-only
      :max-words 24
      :why (from-code "ui/src/screens/Sovereignty.tsx" "Unilateral exit stays a kernel button on a screen that is still there while a lane is disputed. Programs cannot own it.")
      :sources ["ui/src/screens/Sovereignty.tsx" "todo.md"])
    (screen 'finish
      :purpose (guess "Close a dispute after the response window has ended.")
      :headline 'dispute-phase
      :figures ['dispute-phase 'secured-receivable]
      :actions ['finalize]
      :mode 'pro-only
      :when (lambda (s) (:disputed s))
      :max-words 16
      :why (guess "Finalize stays off the desk until the lane is actually disputed.")
      :sources ["ui/src/screens/Sovereignty.tsx"])]
  :flows [
    (flow 'open
      :verb 'open-account
      :before (guess "Open lane")
      :pending (guess "Opening...")
      :done (guess "Lane open. Ceiling is 0.")
      :failed (guess "No lane opened."))
    (flow 'pay
      :verb 'send-routed
      :before (guess "Pay via hub")
      :pending (guess "Submitting...")
      :done (guess "Submitted.")
      :failed (guess "Not sent. Amounts unchanged."))
    (flow 'pay-direct
      :verb 'send-direct
      :before (guess "Pay this lane")
      :pending (guess "Submitting...")
      :done (guess "Submitted.")
      :failed (guess "Not sent. Amounts unchanged."))
    (flow 'cover
      :verb 'request-cover
      :before (guess "Ask them to lock")
      :pending (guess "Requesting...")
      :done (guess "Request sent.")
      :failed (guess "No request sent."))
    (flow 'extend
      :verb 'extend-peer-tab
      :before (guess "Set their ceiling")
      :pending (guess "Signing...")
      :done (guess "Ceiling signed.")
      :failed (guess "Ceiling unchanged."))
    (flow 'hub-limit
      :verb 'set-hub-credit
      :before (guess "Set hub ceiling")
      :pending (guess "Signing...")
      :done (guess "Hub ceiling signed.")
      :failed (guess "Hub ceiling unchanged."))
    (flow 'set-policy
      :verb 'rebalance-policy
      :before (guess "Sign reserve policy")
      :pending (guess "Signing...")
      :done (guess "Policy signed.")
      :failed (guess "Policy unchanged."))
    (flow 'to-account
      :verb 'move-r2c
      :before (guess "Into a lane")
      :pending (guess "Moving...")
      :done (guess "Moved into the lane.")
      :failed (guess "Nothing moved."))
    (flow 'to-entity
      :verb 'move-r2r
      :before (guess "To another entity")
      :pending (guess "Moving...")
      :done (guess "Moved to the entity.")
      :failed (guess "Nothing moved."))
    (flow 'to-wallet
      :verb 'move-r2e
      :before (guess "Out to chain wallet")
      :pending (guess "Moving...")
      :done (guess "Sent to the chain wallet.")
      :failed (guess "Nothing moved."))
    (flow 'propose
      :verb 'propose-multisig
      :before (guess "Send to board")
      :pending (guess "Sending...")
      :done (guess "Waiting on the other signers.")
      :failed (guess "No proposal sent."))
    (flow 'vote
      :verb 'vote-multisig
      :before (guess "Vote")
      :pending (guess "Casting...")
      :done (guess "Vote recorded.")
      :failed (guess "Vote not recorded."))
    (flow 'exit
      :verb 'unilateral-exit
      :before (guess "Submit last page")
      :pending (guess "Submitting...")
      :done (guess "Submitted to the chain.")
      :failed (guess "Not submitted. Safe to retry."))
    (flow 'finalize
      :verb 'finalize-dispute
      :before (guess "Close dispute")
      :pending (guess "Closing...")
      :done (guess "Dispute closed.")
      :failed (guess "Not closed."))
    (flow 'backup
      :verb 'export-backup
      :before (guess "Export backup")
      :pending (guess "Exporting...")
      :done (guess "Backup written.")
      :failed (guess "No backup written."))
    (flow 'reset
      :verb 'reset-testnet
      :before (guess "Reset testnet data")
      :pending (guess "Resetting...")
      :done (guess "Testnet data cleared. Keys kept.")
      :failed (guess "Not reset."))]
  :doors [
    'instant-swap
    'place-limit-order
    'cancel-order
    'cross-j-swap
    'set-bank-rates
    'deposit-savings
    'borrow-facility
    'repay-loan
    'close-savings]
  :why (guess "The kernel keeps keys, the lane table, this sheet, the three reserve pipes, the board count, and unilateral exit. Deal rooms, netting, cross-chain quotes, and the hub rate card propose intents and stop at the sheet. todo.md's one capacity bar plus an on-by-default Pro toggle is the cheaper shell for React and Svelte: one Home, send room in a sentence. That sentence is what a desk will trade against, and today it already mixes available credit into payment capacity while the first hub shows 10,000 extended. This surface keeps send room as a column, splits locked collateral from the open IOU on the bars, and defaults the ceiling you extend to 0. The toggle remains the right call if an unbriefed desk only needed density.")
  :sources [
    "todo.md"
    "AGENTS.md"
    "docs/studies/ui/surfaces/BRIEF.md"
    "docs/studies/ui/surfaces/AS-IS.md"
    "docs/studies/ui/surfaces/AS-IS-SCREENS.md"])

(xln-app 'otc-room
  :kind 'external
  :render 'fixed
  :audience (guess "Two desks signing one bilateral deal, including a room hosted by the other side.")
  :reads [
    'send-capacity
    'secured-receivable
    'unbacked-exposure
    'peer-credit-granted
    'own-credit-granted]
  :requests ['send-direct 'request-cover 'extend-peer-tab]
  :claim-shown (guess "One bilateral deal. The wallet lists locked collateral, the open IOU, any credit ceiling, the counterparty, and the exact fee before you sign.")
  :why (guess "A deal room is a session, often hosted by the other desk. It does not earn a permanent tab. The room's own sentence is not the signature. The sheet names the program and shows whether this signature pays, asks them to lock, or raises a ceiling.")
  :sources ["docs/studies/ui/surfaces/BRIEF.md" "ui/src/screens/Pay.tsx" "docs/studies/ui/surfaces/AS-IS.md"])

(xln-app 'b2b-netting
  :kind 'embedded
  :render 'fixed
  :audience (guess "A treasurer netting open items across a freight or supplier mesh, then paying only the residual.")
  :reads [
    'account-lanes
    'owed-payable
    'unbacked-exposure
    'net-position
    'send-capacity]
  :requests ['send-routed 'send-direct]
  :claim-shown (guess "Nets open items across your lanes and asks you to sign only the residual payment. Each lane stays on its own line.")
  :why (guess "Netting reads the lane table and then asks for payments. It does not grant credit. A residual IOU still has to be raised on the credit screen, where the ceiling warning is the whole point. Keeping netting off the kernel stops the desk from growing a second ledger.")
  :sources ["docs/studies/ui/surfaces/BRIEF.md"])

(xln-app 'cross-j-rfq
  :kind 'embedded
  :render 'fixed
  :audience (guess "A market maker asking two chains for a quote, then signing the exact legs.")
  :reads [
    'orderbook-frame
    'send-capacity
    'receive-capacity
    'reserve-cash
    'onchain-cash]
  :requests ['cross-j-swap 'place-limit-order 'cancel-order 'instant-swap]
  :claim-shown (guess "Asks two chains for a quote. Nothing moves until you sign the exact legs and the exact fee.")
  :why (from-code "ui/src/screens/Swap.tsx" "The book, resting orders, and cross-chain legs are a program. The kernel does not host that screen. Fixed render keeps every leg exact. A generated quote form could rewrite a leg between the sentence and the signature.")
  :sources ["ui/src/screens/Swap.tsx" "docs/studies/ui/surfaces/AS-IS-SCREENS.md" "docs/studies/ui/surfaces/BRIEF.md"])

(xln-app 'hub-facility
  :kind 'embedded
  :render 'fixed
  :audience (guess "A hub operator publishing bank terms, and a treasurer drawing or repaying that facility.")
  :reads [
    'reserve-cash
    'account-lanes
    'peer-credit-granted
    'own-credit-granted]
  :requests ['set-bank-rates 'borrow-facility 'repay-loan]
  :claim-shown (guess "Publishes this hub's rates, or draws and repays a facility. A rate card is not a payment. A draw shows the debt you take.")
  :why (canon "AGENTS.md" "Lending here is the existing signed bank, facility, and term loan. The publisher and the borrower are different seats. The sheet is what stops a rate change from looking like a draw. Saver deposits stay off this program.")
  :sources ["ui/src/screens/Lending.tsx" "AGENTS.md" "docs/studies/ui/surfaces/BRIEF.md"])

(story 'first-lane
  :surface 'pro
  :given 'empty
  :steps ['desk 'open]
  :outcome (guess "One lane is open. The ceiling you extend is still 0. No first-hub grant of 10,000 has been signed.")
  :why (guess "An empty desk still has to open a counterparty. The done line and the default agree: open is not a credit grant.")
  :sources ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/components/LendingRiskConsent.tsx"])

(story 'pay-uncovered
  :surface 'pro
  :given 'uncovered
  :steps ['desk 'pay]
  :outcome (guess "A routed payment while the only position is an open IOU of 100. The sheet shows the open-IOU delta, any ceiling delta, the hub, and the exact fee before submit. If the hub stalls, amounts stay as they were.")
  :why (guess "This is the corridor case that a single capacity sentence hides: send room can exist because someone extended credit, or because an IOU is being spent. The two bars are already on the desk. The sheet repeats the delta.")
  :sources ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/screens/Pay.tsx"])

(story 'cover-iou
  :surface 'pro
  :given 'uncovered
  :steps ['desk 'credit-lanes 'cover]
  :outcome (guess "The sheet shows their fee and the collateral you would get before the request goes out. The request does not itself lock funds. If they never lock, the open IOU remains, and the last page can still go to the chain from the watchtower.")
  :why (guess "Live cover already states the fee before the request and then waits on the hub. The commercial gap is the missing sentence about what locked collateral is good for, which the sheet's survival line carries.")
  :sources ["docs/studies/ui/surfaces/AS-IS.md" "ui/src/screens/AccountDetail.tsx"])

(story 'pay-while-split
  :surface 'pro
  :given 'partlyCovered
  :steps ['desk 'pay-direct]
  :outcome (guess "A same-lane payment while 45 is locked and 55 is still an open IOU. The sheet shows how much of the send stays inside locked collateral and how much would deepen the open IOU.")
  :why (guess "Partly covered is the state where a blended balance is most expensive. Direct pay is the fast path. It is not an excuse to drop the two deltas.")
  :sources ["docs/studies/ui/surfaces/AS-IS.md"])

(story 'sign-policy
  :surface 'pro
  :given 'partlyCovered
  :steps ['credit-lanes 'set-policy]
  :outcome (guess "A reserve policy is signed, with a floor and a fee bound. Until that signature, reserve does not move on its own.")
  :why (guess "Rebalance is a commercial control, not a Home row. It lives beside the ceiling because both can move risk without looking like a payment.")
  :sources ["ui/src/screens/Manage.tsx" "ui/src/screens/AccountDetail.tsx"])

(story 'reserve-pipes
  :surface 'pro
  :given 'partlyCovered
  :steps ['move 'to-account]
  :outcome (guess "Reserve assignment is a separate signature from the lane payment. In this snapshot reserve is 0, so the move fails closed and the bars stay 45 locked and 55 open.")
  :why (guess "The three pipes have to be reachable while a lane is partly covered, and a zero reserve has to fail without touching the lane.")
  :sources ["ui/src/screens/Move.tsx" "docs/studies/ui/surfaces/AS-IS.md"])

(story 'board-batch
  :surface 'pro
  :given 'partlyCovered
  :steps ['multisig 'propose]
  :outcome (guess "A batch the signer cannot authorize alone is a proposal. The other signers still have to vote. No lane amount changes on this step.")
  :why (guess "Threshold is how a desk signs fast without pretending one operator is the whole board. The proposal flow is the slow path. The sheet is what keeps it from looking like a completed payment.")
  :sources ["ui/src/screens/Ownership.tsx" "AGENTS.md"])

(story 'stall-exit
  :surface 'pro
  :given 'disputed
  :steps ['watchtower 'exit]
  :outcome (guess "The last co-signed page is submitted to the chain. The other side is not required. Locked collateral is what that page can still enforce. The open IOU is not.")
  :why (guess "A stalled hub or a stalled OTC counterparty is the commercial failure mode. Exit has to be on a screen that is visible in the disputed state, one action away, and outside every program.")
  :sources ["ui/src/screens/Sovereignty.tsx" "ui/src/screens/AccountDetail.tsx"])

(story 'close-dispute
  :surface 'pro
  :given 'disputed
  :steps ['finish 'finalize]
  :outcome (guess "The response window has ended and the dispute is closed on the chain. This screen is absent until the lane is disputed.")
  :why (guess "Finalize is a second kernel step, not a program. Hiding it until the disputed state keeps a quiet desk from offering a button that cannot apply.")
  :sources ["ui/src/screens/Sovereignty.tsx"])

(story 'otc-deal
  :surface 'otc-room
  :given 'uncovered
  :steps ['review 'sign]
  :outcome (guess "The room can ask for a direct payment, a collateral request, or a higher ceiling. It cannot mark the deal done. If the ceiling line is present, the sheet warns that nothing is locked behind it. If they stall after a lock request, the IOU stays open.")
  :why (guess "External and fixed: the other desk may host the room. Our wallet only signs, and only after the same sheet the desk uses.")
  :sources ["docs/studies/ui/surfaces/BRIEF.md" "docs/studies/ui/surfaces/AS-IS.md"])

(story 'net-residual
  :surface 'b2b-netting
  :given 'partlyCovered
  :steps ['net 'sign]
  :outcome (guess "Open items across the mesh collapse to a residual payment. Each lane remains a line on the sheet. The program does not raise a ceiling. A residual that cannot be paid is still an open IOU on the desk.")
  :why (guess "Netting is the freight and supplier case. The money step is still a routed or direct payment under the sheet.")
  :sources ["docs/studies/ui/surfaces/BRIEF.md"])

(story 'rfq-legs
  :surface 'cross-j-rfq
  :given 'partlyCovered
  :steps ['quote 'sign]
  :outcome (guess "The maker sees the two legs, the fee, and the reserve or chain-wallet figure the legs will use. Cancelling a resting order is a separate signed line. Nothing fills because the program said a quote existed.")
  :why (guess "Cross-chain and resting orders are where a generated form would be most able to move a number. Fixed legs, then the sheet.")
  :sources ["ui/src/screens/Swap.tsx" "docs/studies/ui/surfaces/BRIEF.md"])

(story 'facility-rates
  :surface 'hub-facility
  :given 'uncovered
  :steps ['rates 'draw]
  :outcome (guess "Publishing rates does not move a lane. A draw shows the debt being taken and the fee before the signature. A repay is its own line. A saver deposit is not offered here.")
  :why (guess "The hub operator and the borrowing treasurer share a program and not a seat. The sheet's program name plus the debt delta is what keeps a rate card from being signed as a draw.")
  :sources ["ui/src/screens/Lending.tsx" "AGENTS.md"])

(fork 'p3-desk-vs-toggle
  :status 'open
  :decider 'person
  :question "Does an OTC desk need this separate Pro surface and a 0 credit default, or is one shell with Pro on by default and a single capacity bar enough?"
  :affects ['pro 'desk-sign 'otc-room 'b2b-netting 'cross-j-rfq 'hub-facility]
  :options {
    :separate-pro "Own surface. Lane table. Locked collateral and open IOU on separate bars. Ceiling you extend defaults to 0 until the sheet is signed. Deal room, netting, cross-chain quote, and hub facility are programs."
    :toggle "One shell. Pro on by default. One capacity bar. Denser rows in that same shell. Cheaper to keep React and Svelte in parity."}
  :current 'separate-pro
  :why (guess "The silent 10,000 ceiling and the capacity sentence that includes credit are enough to propose the split. They are not enough to close it. An unbriefed desk has not run the cockpit. If that desk only needed density, the toggle wins.")
  :sources ["todo.md" "docs/studies/ui/surfaces/BRIEF.md" "docs/studies/ui/surfaces/AS-IS.md" "AGENTS.md"])
