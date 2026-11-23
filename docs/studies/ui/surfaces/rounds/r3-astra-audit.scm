;; Audit of design-synthesis.md at production tree 8f8a4a6a. These are
;; proposed corrections, not changes to the converged sheets or fork status.

(critique 'r3-astra-actual-checkout
  :author "openai/gpt-6.2-astra" :target 'merchant-checkout :stance 'agree
  :why (sweep "docs/studies/ui/surfaces/probes/runs-signing/summary-nous-oauth-frontier.json" "Fable rejected C7's unmentioned open-account while correctly reading zero unbacked, the fee and payment finality. The runner displayed p1's static permissions. Show the one concrete payment; refuse actual setup bundled into checkout. Current checkout need not ask to open an account.")
  :sources ["docs/studies/ui/surfaces/probes/run-signing-sweep.ts#L71" "docs/studies/ui/surfaces/perspectives/p1-consumer.scm#L158" "docs/studies/ui/surfaces/programs.scm#L13"])

(critique 'r3-astra-bind-accept
  :author "openai/gpt-6.2-astra" :target 'f8-signing-sheet-dispatch :stance 'amend
  :why (from-code "core/api/payments/command.ts#L33" "The payment names the ultimate recipient, route, principal and debit bound. A lane and a risk class identify none of those uniquely. Bind review to the ordered command and current authority, state, quote and deadlines at acceptance. If terms change, show them again before send or journaling.")
  :sources ["docs/studies/ui/surfaces/design-synthesis.md#L445" "docs/studies/ui/surfaces/perspectives/p5-openai-astra.scm#L13" "ui/src/runtime/hosted.ts#L265"])

(critique 'r3-astra-credit-direction
  :author "openai/gpt-6.2-astra" :target 'sheet-exposure :stance 'amend
  :why (from-code "core/account/utils.ts#L29" "Use peerCreditLimit for the absolute ceiling I grant, outPeerCredit for what is already owed to me unsecured, and inOwnCredit for what I owe. Lowering the ceiling cannot erase a drawn debt. An increase in my own borrowing needs different copy from letting them owe me.")
  :sources ["core/account/tx/handlers/balance/set-credit-limit.ts#L31" "core/account/capacity-plan.ts#L115" "docs/studies/ui/surfaces/perspectives/p5-openai-astra.scm#L11"])

(critique 'r3-astra-settlement-workspace
  :author "openai/gpt-6.2-astra" :target 'sheet-treasury-admin :stance 'amend
  :why (from-code "core/entity/tx/handlers/payments/settle.ts#L109" "Compile the pinned workspace from its author's side, then project changed rows from the signer's side. A raw diff can take a share with no change to the collateral pool; forgiveness can waive debt without a Delta debit. Review reserve legs too. A local continuation and its broadcast flag are separate from the signed workspace. Approval may be deferred, not paid.")
  :sources ["core/protocol/settlement/operations.ts#L225" "core/account/settlement/settlement-projection.ts#L26" "ui/src/runtime/financial/move.ts#L211" "core/entity/tx/handlers/payments/settle.ts#L377"])

(critique 'r3-astra-distinct-swap-accounts
  :author "openai/gpt-6.2-astra" :target 'cross-j-rfq :stance 'amend
  :why (from-code "core/account/swap/swap-command-route.ts#L101" "The source user pays the source hub; the target hub pays the target user. Never credit a want row on the source Account. Review both domains, signers, amounts, price and leg deadlines. Target credit setup is submitted first and may survive failed route admission; bind it before setup and recheck the route on retry.")
  :sources ["core/account/tx/handlers/settlement/pull.ts#L143" "core/extensions/cross-j/deadlines.ts#L14" "ui/src/runtime/financial/swap.ts#L196" "frontend/src/lib/stores/xlnStore.ts#L1733"])

(critique 'r3-astra-decisive-vote
  :author "openai/gpt-6.2-astra" :target 'pro/pro-vote-board :stance 'amend
  :why (from-code "core/entity/tx/handlers/system/basic.ts#L179" "The deciding quantity is total yes shares after this vote on this board and epoch, not this signer's weight. A proposer can already meet threshold; a later yes can release the stored ordered financial actions. Resolve the pinned action before review and distinguish approval to execute from settlement.")
  :sources ["core/entity/command/index.ts#L425" "core/entity/tx/handlers/system/basic.ts#L104" "ui/src/components/settings/Consensus.tsx#L191"])

(critique 'r3-astra-batch-consent
  :author "openai/gpt-6.2-astra" :target 'pro :stance 'amend
  :why (from-code "core/entity/tx/handlers/j-batch/j-broadcast.ts#L150" "Broadcast signs the selected encoded batch in a chain, depository and nonce domain, not just the new Move row. Review those ordered operations at broadcast and keep replacement fee authority tied to the attempt, transaction and absolute gas-price ceiling. ERC-20 approval separately authorizes a spender and amount.")
  :sources ["ui/src/runtime/financial/batch-fees.ts#L13" "ui/src/runtime/financial/move.ts#L276" "frontend/src/lib/components/Entity/workspace/shell/EntityPanelTabs.svelte#L1088"])

(critique 'r3-astra-authorized-outcome
  :author "openai/gpt-6.2-astra" :target 'sheet-spend :stance 'amend
  :why (from-code "core/account/tx/handlers/htlc/resolve.ts#L78" "Signing the payment is not signing a completed transfer: a secret resolution pays and an error resolution releases the hold. Show the recipient amount and maximum first-hop debit, with headroom as a ceiling. Keep the finality of a paid receipt distinct from a pending conditional lock.")
  :sources ["core/api/payments/command.ts#L54" "docs/studies/ui/surfaces/personal.scm#L14" "docs/studies/ui/surfaces/design-synthesis.md#L264"])

(critique 'r3-astra-exposure-bounds
  :author "openai/gpt-6.2-astra" :target 'sheet-exposure :stance 'amend
  :why (from-code "core/account/swap/swap-net-authorization.ts#L124" "maxFee is a ceiling, not the only authorized execution. A smaller fill fee leaves more want with the maker; that extra receivable can be unsecured. The max-fee example alone cannot establish that the offer never raises exposure. Show hold now and the authorized fill bounds separately.")
  :sources ["core/account/tx/handlers/swap/resolve/settlement.ts#L48" "docs/studies/ui/surfaces/design-synthesis.md#L208"])

(critique 'r3-astra-training-versus-covenant
  :author "openai/gpt-6.2-astra" :target 'simple-savings :stance 'amend
  :why (from-code "core/account/validation/lending-risk.ts#L14" "Funding moves principal and records an enforceable claim; the admission projection reserves holds and the debtor's promised coupon without treating the opposite unearned coupon as security. Raw cash deltas alone cannot price savings. Even a close request with no current payout can fix early-versus-mature coupon terms.")
  :sources ["core/account/tx/handlers/balance/lending.ts#L189" "core/account/tx/handlers/balance/lending.ts#L241"])

(critique 'r3-astra-cover-recovery
  :author "openai/gpt-6.2-astra" :target 'sheet-secure :stance 'amend
  :why (from-code "core/account/tx/handlers/rebalance/request-collateral.ts#L86" "A pending duplicate does not charge again. For a fresh request distinguish the fee token and net amount requested from collateral confirmed later. After challenge, the claim is the viewer's backed share, not every coin the depositor posted; available debtor reserve may pay shortfall, and any unpaid remainder stays debt.")
  :sources ["core/account/tx/handlers/j-events/finality.ts#L64" "jurisdictions/contracts/Depository.sol#L1004" "docs/studies/ui/surfaces/design-synthesis.md#L520"])

(critique 'r3-astra-steward-authority
  :author "openai/gpt-6.2-astra" :target 'mppx-spend-steward :stance 'object
  :why (from-code "core/api/payments/agent-intent.ts#L65" "A class plus intent digest identifies data, not who approved it. Defer B2 without trusted approval of the exact prepared recipient, route, amount and sender bound in their runtime, signer, height and sequence context. Expire fresh-use authority; preserve retries of the same command ID and sequence, never authority for another payment.")
  :sources ["cli/agent-payment.ts#L54" "core/api/payments/agent.ts#L57" "docs/studies/ui/surfaces/design-synthesis.md#L492"])

(critique 'r3-astra-parity-evidence
  :author "openai/gpt-6.2-astra" :target 'f7-dual-wallet-parity :stance 'amend
  :why (canon "AGENTS.md" "At 8f8a4a6a both wallets require owning tests using one runtime path. Shared projection vectors and send spies are necessary, not substitutes for executing both presenters and checking declined and stale review across local, remote and cross-J routes. Defer the general host; do not fork a reduced wallet or silently submit without a presenter.")
  :sources ["docs/studies/ui/surfaces/design-synthesis.md#L618" "ui/src/runtime/commands.ts#L40" "frontend/src/lib/stores/xlnStore.ts#L1634"])
