;; pro.scm — Desk Trader + Hub / Liquidity Operator surface & commercial XLN Programs (DSL v3).

(surface 'pro
  :posture 'operator-desk
  :who     (canon "todo.md" "OTC desks, market makers, payout firms, and hub operators managing multi-lane liquidity and books.")
  :entry   'desk
  :modes   ['always 'pro-only]
  :terms {
    :secured     (term-copy
                   :label     (as-is "ui/src/components/home/BalanceDetails.tsx" "Backed by collateral")
                   :note      (as-is "ui/src/components/home/BalanceDetails.tsx" "Covered by funds locked on-chain.")
                   :note-when 'non-zero)
    :unbacked    (term-copy
                   :label     (as-is "ui/src/components/home/BalanceDetails.tsx" "Without collateral")
                   :note      (as-is "ui/src/components/home/BalanceDetails.tsx" "Repayment depends on the other party.")
                   :note-when 'non-zero)
    :owed        (from-code "ui/src/runtime/views.ts" "Payable liability")
    :cover       (as-is "ui/src/screens/AccountDetail.tsx" "Cover it")
    :peer-credit (from-code "core/types/account.ts" "Peer credit limit")
    :hub         (as-is "ui/src/components/home/Balances.tsx" "Payment hub")
    :exit        (guess "Submit dispute proof")
  }
  :defaults [
    (default-rule 'negotiated-credit-line
      :value       "Explicit per-counterparty limit"
      :risk-bearer 'user
      :consent     (from-code "ui/src/screens/Manage.tsx" "Operator sets explicit credit ceiling and rebalance policy per bilateral Account.")
      :why         (from-code "ui/src/screens/Manage.tsx" "Desks and hubs price bilateral credit and r2c fees per counterparty.")
      :sources     ["ui/src/screens/Manage.tsx" "todo.md"])
  ]
  :screens [
    (screen 'desk
      :purpose   (guess "Dense lane matrix showing bilateral capacities, signed frames, and net exposure.")
      :headline  'net-position
      :figures   ['net-position 'secured-receivable 'unbacked-exposure 'owed-payable 'account-lanes]
      :bars      ['secured-receivable 'unbacked-exposure 'onchain-cash 'reserve-cash]
      :actions   ['pro-pay 'pro-direct 'pro-open-account 'pro-cover]
      :max-words 60
      :why       (guess "Planned operator cockpit for multi-counterparty desks (retired monolithic Desk.tsx).")
      :sources   ["todo.md"])
    (screen 'book
      :purpose   (as-is "ui/src/screens/Swap.tsx" "Book")
      :headline  'orderbook-frame
      :figures   ['orderbook-frame 'send-capacity 'receive-capacity]
      :actions   ['pro-limit-order 'pro-cancel-order 'pro-instant-swap]
      :mode      'pro-only
      :max-words 60
      :sources   ["ui/src/screens/Swap.tsx"])
    (screen 'cross-swap
      :purpose   (as-is "ui/src/screens/Swap.tsx" "Cross-network orders")
      :headline  'orderbook-frame
      :figures   ['orderbook-frame 'send-capacity 'receive-capacity]
      :actions   ['pro-cross-swap]
      :mode      'pro-only
      :max-words 60
      :sources   ["ui/src/screens/Swap.tsx" "AGENTS.md"])
    (screen 'move
      :purpose   (as-is "ui/src/screens/Move.tsx" "Move")
      :headline  'reserve-cash
      :figures   ['onchain-cash 'reserve-cash 'secured-receivable]
      :actions   ['pro-r2c 'pro-r2r 'pro-r2e]
      :mode      'pro-only
      :max-words 60
      :sources   ["ui/src/screens/Move.tsx"])
    (screen 'credit-lanes
      :purpose   (as-is "ui/src/screens/Manage.tsx" "Manage")
      :headline  'peer-credit-granted
      :figures   ['peer-credit-granted 'own-credit-granted 'account-lanes]
      :actions   ['pro-set-credit 'pro-rebalance 'pro-cover]
      :mode      'pro-only
      :max-words 60
      :sources   ["ui/src/screens/Manage.tsx" "ui/src/screens/AccountDetail.tsx"])
    (screen 'lending
      :purpose   (as-is "ui/src/screens/Lending.tsx" "Lending")
      :headline  'reserve-cash
      :figures   ['reserve-cash 'secured-receivable 'unbacked-exposure]
      :actions   ['pro-set-rates 'pro-borrow 'pro-repay 'pro-lend 'pro-close-lend]
      :mode      'pro-only
      :max-words 60
      :sources   ["ui/src/screens/Lending.tsx"])
    (screen 'watchtower
      :purpose   (as-is "ui/src/screens/Sovereignty.tsx" "Security and recovery")
      :headline  'dispute-phase
      :figures   ['dispute-phase 'secured-receivable 'account-lanes]
      :actions   ['pro-dispute 'pro-finalize-dispute 'pro-backup 'pro-reset]
      :max-words 60
      :sources   ["ui/src/screens/Sovereignty.tsx" "todo.md"])
    (screen 'multisig
      :purpose   (as-is "ui/src/screens/Ownership.tsx" "Board")
      :headline  'entity-board
      :figures   ['entity-board]
      :actions   ['pro-propose-board 'pro-vote-board]
      :mode      'pro-only
      :max-words 60
      :sources   ["ui/src/screens/Ownership.tsx" "fork:f7-dual-wallet-parity"])
    (screen 'assets
      :purpose   (as-is "ui/src/screens/Assets.tsx" "On-chain wallet")
      :headline  'onchain-cash
      :figures   ['onchain-cash 'reserve-cash 'net-position]
      :actions   []
      :mode      'pro-only
      :max-words 60
      :sources   ["ui/src/screens/Assets.tsx"])
  ]
  :flows [
    (flow 'pro-pay              :verb 'send-routed       :before (guess "Send routed payment")          :pending (guess "Routing HTLC payment...")       :done (guess "Routed payment finalized.")                :failed (guess "Route rejected or expired."))
    (flow 'pro-direct           :verb 'send-direct       :before (guess "Send bilateral payment")       :pending (guess "Submitting direct payment...")  :done (guess "Direct frame committed.")                  :failed (guess "Rejected by counterparty."))
    (flow 'pro-open-account     :verb 'open-account      :before (guess "Open bilateral Account")       :pending (guess "Opening bilateral Account...")  :done (guess "Account active.")                          :failed (guess "Open rejected."))
    (flow 'pro-cover            :verb 'request-cover     :before (as-is "ui/src/screens/AccountDetail.tsx" "Cover it") :pending (guess "Requesting r2c allocation...") :done (guess "Collateral locked on-chain for Account.") :failed (guess "Policy mismatch or insufficient reserve."))
    (flow 'pro-instant-swap     :verb 'instant-swap      :before (guess "Take book quote")              :pending (guess "Taking book quote...")          :done (guess "Swap settled.")                            :failed (guess "Insufficient capacity or expired quote."))
    (flow 'pro-limit-order      :verb 'place-limit-order :before (guess "Post resting limit order")     :pending (guess "Posting resting swap offer...") :done (guess "Order live on book.")                      :failed (guess "Order rejected."))
    (flow 'pro-cancel-order     :verb 'cancel-order      :before (guess "Cancel resting order")         :pending (guess "Cancelling swap offer...")      :done (guess "Resting order removed.")                   :failed (guess "Order already filled or closed."))
    (flow 'pro-cross-swap       :verb 'cross-j-swap      :before (guess "Execute cross-network order")  :pending (guess "Locking cross-J legs...")       :done (guess "Cross-jurisdiction swap settled.")         :failed (guess "Cross-J leg timed out; salvage/refund safe."))
    (flow 'pro-r2c              :verb 'move-r2c          :before (guess "Allocate reserve to Account")  :pending (guess "Batching r2c J-tx...")          :done (as-is "ui/src/screens/Move.tsx" "Added to the on-chain batch") :failed (guess "Batch aborted."))
    (flow 'pro-r2r              :verb 'move-r2r          :before (guess "Transfer contract reserve")    :pending (guess "Batching r2r J-tx...")          :done (as-is "ui/src/screens/Move.tsx" "Added to the on-chain batch") :failed (guess "Batch aborted."))
    (flow 'pro-r2e              :verb 'move-r2e          :before (guess "Withdraw reserve to wallet")   :pending (guess "Batching r2e withdrawal...")    :done (as-is "ui/src/screens/Move.tsx" "Added to the on-chain batch") :failed (guess "Batch aborted."))
    (flow 'pro-set-credit       :verb 'set-hub-credit    :before (guess "Update bilateral credit limit") :pending (guess "Updating credit limit...")     :done (guess "Credit limit committed.")                  :failed (guess "Rejected."))
    (flow 'pro-rebalance        :verb 'rebalance-policy  :before (guess "Save rebalance policy")        :pending (guess "Saving rebalance policy...")    :done (guess "Rebalance policy active.")                 :failed (guess "Rejected."))
    (flow 'pro-set-rates        :verb 'set-bank-rates    :before (guess "Publish bank rate policy")     :pending (guess "Publishing bank rate terms...") :done (guess "Bank lending terms updated.")              :failed (guess "Rejected."))
    (flow 'pro-borrow           :verb 'borrow-facility   :before (guess "Draw from facility")           :pending (guess "Requesting loan drawdown...")   :done (guess "Loan disbursed.")                          :failed (guess "Facility or receive capacity insufficient."))
    (flow 'pro-repay            :verb 'repay-loan        :before (guess "Repay active loan")            :pending (guess "Repaying active loan...")       :done (guess "Loan repaid.")                             :failed (guess "Insufficient send capacity."))
    (flow 'pro-lend             :verb 'deposit-savings   :before (guess "Fund lending offer")           :pending (guess "Funding lending position...")   :done (guess "Position funded.")                         :failed (guess "Offer rejected."))
    (flow 'pro-close-lend       :verb 'close-savings     :before (guess "Close lending position")       :pending (guess "Closing lending position...")   :done (guess "Position closed.")                         :failed (guess "Close timed out."))
    (flow 'pro-dispute          :verb 'unilateral-exit   :before (guess "Submit dispute frame on-chain") :pending (guess "Dispute active...")            :done (guess "Dispute registered on-chain.")             :failed (guess "Submission failed."))
    (flow 'pro-finalize-dispute :verb 'finalize-dispute  :before (guess "Finalize dispute settlement")  :pending (guess "Finalizing...")                 :done (guess "Dispute finalized to reserves.")           :failed (guess "Challenge window still open."))
    (flow 'pro-propose-board    :verb 'propose-multisig  :before (guess "Propose board update")         :pending (guess "Staging Hanko proposal...")     :done (guess "Proposal awaiting co-signers.")            :failed (guess "Invalid threshold."))
    (flow 'pro-vote-board       :verb 'vote-multisig     :before (guess "Sign or reject proposal")      :pending (guess "Submitting Hanko vote...")      :done (guess "Vote recorded.")                           :failed (guess "Proposal expired."))
    (flow 'pro-backup           :verb 'export-backup     :before (guess "Export recovery bundle")       :pending (guess "Exporting state...")            :done (as-is "ui/src/screens/Sovereignty.tsx" "Encrypted backup saved") :failed (guess "Export failed."))
    (flow 'pro-reset            :verb 'reset-testnet     :before (canon "todo.md" "Reset retired testnet state") :pending (guess "Resetting...")         :done (guess "Reset complete; keys kept.")               :failed (guess "Stop active runtime first."))
  ]
  :doors   []
  :why     (canon "todo.md" "Preserve complete operator, market-maker, cross-J, and hub lending controls with zero capability loss.")
  :sources ["todo.md" "ui/src/screens/Swap.tsx" "ui/src/screens/Manage.tsx"])

;; ── Commercial XLN Program Seed ───────────────────────────────────────────────────────────────────
(xln-app 'otc-deal-room
  :kind        'external
  :render      'fixed
  :audience    (canon "todo.md" "OTC desks, market makers, and payout firms settling negotiated bilateral deals.")
  :reads       ['send-capacity 'receive-capacity 'secured-receivable]
  :requests    ['cross-j-swap 'instant-swap 'request-cover]
  :claim-shown (guess "Settle negotiated 50,000 USDC -> TRX cross-chain deal and lock collateral.")
  :why         (guess "Shared deal-signing page keeps complex RFQ legs out of the base wallet while signing via kernel-consent.")
  :sources     ["ui/src/screens/Swap.tsx" "todo.md"])

;; ── Pro User Stories ───────────────────────────────────────────────────────────────────────────────
(story 'quote-and-fund-lane
  :surface 'pro
  :given   'partlyCovered
  :steps   ['desk 'move 'pro-r2c 'book 'pro-limit-order]
  :outcome (from-code "ui/src/screens/Swap.tsx" "Operator allocates XLN contract reserve to Account collateral and posts a resting book quote.")
  :why     (canon "todo.md" "Core market-maker workflow across Move and Swap.")
  :sources ["ui/src/screens/Move.tsx" "ui/src/screens/Swap.tsx" "todo.md"])

(story 'operator-dispute-enforcement
  :surface 'pro
  :given   'disputed
  :steps   ['desk 'watchtower 'pro-dispute 'pro-finalize-dispute]
  :outcome (from-code "ui/src/screens/Sovereignty.tsx" "Operator enforces unilateral settlement on a stalled bilateral lane.")
  :why     (canon "todo.md" "Matches Sepolia dispute and watchtower blocker #4.")
  :sources ["ui/src/screens/Sovereignty.tsx" "todo.md"])
