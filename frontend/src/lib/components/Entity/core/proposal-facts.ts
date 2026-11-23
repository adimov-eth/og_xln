import type { Proposal } from '@xln/core/entity/types';
import type { EntityTx } from '@xln/core/types/entity-tx';

/**
 * What a governance proposal would do, read from the exact batch it stores, never from the
 * proposer's words. Shared by both wallets: the sign sheet renders these facts, and the
 * proposer's free text is kept apart as untrusted.
 */
export type ProposalFact =
  /** `viaEntityId` is the first hop the payment leaves through: the Account it debits. */
  | { kind: 'pay'; counterpartyEntityId: string; viaEntityId: string; tokenId: number; amount: bigint; description: string | null }
  /** A locked payment: the recipient gets `amount`; the payer is debited at most `maxSenderDebit`, fees included. */
  | { kind: 'pay-locked'; counterpartyEntityId: string; tokenId: number; amount: bigint; maxSenderDebit: bigint }
  | { kind: 'credit-limit'; counterpartyEntityId: string; tokenId: number; amount: bigint }
  | { kind: 'open-account'; counterpartyEntityId: string; tokenId: number | null; creditAmount: bigint | null }
  | { kind: 'other'; txType: string };

export type PendingProposal = Readonly<{
  id: string;
  proposer: string;
  created: number;
  facts: readonly ProposalFact[];
  /** The proposer's own text: a collective message. Untrusted; render as plain text, labelled. */
  message: string | null;
  yesShares: bigint;
  threshold: bigint;
}>;

type ProposalCore = Readonly<{
  proposals?: ReadonlyMap<string, Proposal> | null;
  config?: Readonly<{ validators?: readonly string[]; shares?: Readonly<Record<string, bigint>>; threshold?: bigint }> | null;
}>;

const lower = (value: unknown): string => String(value ?? '').trim().toLowerCase();

const voteChoice = (vote: Proposal['votes'] extends Map<string, infer V> ? V : never): string =>
  typeof vote === 'string' ? vote : vote.choice;

/** One transaction as a fact. Anything not modelled here is shown by type, never guessed. */
export const proposalTxFact = (tx: EntityTx): ProposalFact => {
  switch (tx.type) {
    case 'directPayment':
      return {
        kind: 'pay',
        counterpartyEntityId: lower(tx.data.targetEntityId),
        viaEntityId: lower(tx.data.route[1] ?? tx.data.targetEntityId),
        tokenId: tx.data.tokenId,
        amount: tx.data.amount,
        description: typeof tx.data.description === 'string' && tx.data.description.trim() ? tx.data.description : null,
      };
    case 'htlcPayment':
      return {
        kind: 'pay-locked',
        counterpartyEntityId: lower(tx.data.targetEntityId),
        tokenId: tx.data.tokenId,
        amount: tx.data.amount,
        maxSenderDebit: tx.data.maxSenderDebit,
      };
    case 'extendCredit':
      return {
        kind: 'credit-limit',
        counterpartyEntityId: lower(tx.data.counterpartyEntityId),
        tokenId: tx.data.tokenId,
        amount: tx.data.amount,
      };
    case 'openAccount':
      return {
        kind: 'open-account',
        counterpartyEntityId: lower(tx.data.targetEntityId),
        tokenId: typeof tx.data.tokenId === 'number' ? tx.data.tokenId : null,
        creditAmount: typeof tx.data.creditAmount === 'bigint' ? tx.data.creditAmount : null,
      };
    default:
      return { kind: 'other', txType: tx.type };
  }
};

/**
 * Proposals the signer still has to answer: authored by another board member, not yet voted on
 * by this signer, while this signer is on the board. The vote handler rejects a vote from a stale
 * board epoch, so a proposal that outlived a board rotation simply fails to sign; it is never
 * executed under the new board.
 */
export const pendingProposalsForSigner = (core: ProposalCore | null | undefined, signerId: string): PendingProposal[] => {
  const me = lower(signerId);
  const validators = (core?.config?.validators ?? []).map(lower);
  if (!me || !validators.includes(me) || !core?.proposals) return [];
  const shares = core.config?.shares ?? {};
  const shareOf = (signer: string): bigint => {
    for (const [key, value] of Object.entries(shares)) if (lower(key) === signer) return BigInt(value);
    return 0n;
  };
  const pending: PendingProposal[] = [];
  for (const proposal of core.proposals.values()) {
    if (lower(proposal.proposer) === me) continue;
    const votedSigners = [...proposal.votes.keys()].map(lower);
    if (votedSigners.includes(me)) continue;
    let yesShares = 0n;
    for (const [voter, vote] of proposal.votes) if (voteChoice(vote) === 'yes') yesShares += shareOf(lower(voter));
    pending.push({
      id: proposal.id,
      proposer: lower(proposal.proposer),
      created: proposal.created,
      facts: proposal.action.type === 'entity_transaction' ? proposal.action.data.txs.map(proposalTxFact) : [],
      message: proposal.action.type === 'collective_message' ? proposal.action.data.message : null,
      yesShares,
      threshold: BigInt(core.config?.threshold ?? 0n),
    });
  }
  return pending.sort((left, right) => left.created - right.created);
};

/** The signer's answer. Declining is a recorded "no", not a closed sheet. */
export const buildProposalVoteTx = (proposalId: string, voter: string, choice: 'yes' | 'no'): EntityTx => ({
  type: 'vote',
  data: { proposalId, voter: lower(voter), choice },
});
