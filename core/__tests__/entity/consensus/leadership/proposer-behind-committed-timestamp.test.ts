import { describe, expect, test } from 'bun:test';

import { signAccountFrame } from '../../../../account/crypto';
import { buildSignedEntityCommand } from '../../../../entity/command';
import { signedEntityCommandTx } from '../../../../entity/command/command-codec';
import { applyEntityInput } from '../../../../entity/consensus';
import {
  buildEntityLeaderVoteBody,
  hashEntityLeaderVoteBody,
} from '../../../../entity/consensus/leader';
import { resolveEntityProposalTimestamp } from '../../../../entity/consensus/proposal/clock';
import type { EntityInput, EntityLeaderTimeoutVote } from '../../../../entity/types';
import { createEntityProposalFixture } from '../../../helpers/entity-proposal-fixture';

const { createValidator, entityId } = createEntityProposalFixture(
  'proposer-behind-committed-timestamp',
  2n,
  ['1', '2'],
);

const requireOutput = (
  outputs: EntityInput[],
  pick: (output: EntityInput) => boolean,
  code: string,
): EntityInput => {
  const output = outputs.find(pick);
  if (!output) throw new Error(code);
  return output;
};

describe('proposer behind the committed Entity clock', () => {
  test('proposer-behind-committed-timestamp-still-proposes', async () => {
    const a = createValidator('1');
    const b = createValidator('2');
    // A's Runtime clock runs 20 s ahead of B's: inside the 30 s receiver drift.
    a.env.state.timestamp = 21_000;
    b.env.state.timestamp = 1_000;

    const proposed = await applyEntityInput(a.env, a.replica, {
      entityId,
      signerId: a.signerId,
      entityTxs: [{ type: 'chat', data: { from: a.signerId, message: 'A leads at +20s' } }],
    });
    const proposal = requireOutput(
      proposed.outputs,
      output => output.signerId === b.signerId && Boolean(output.proposedFrame),
      'TEST_PROPOSAL_MISSING',
    );
    expect(proposal.proposedFrame?.timestamp).toBe(21_000);

    const prepared = await applyEntityInput(b.env, b.replica, proposal);
    const precommit = requireOutput(
      prepared.outputs,
      output => output.signerId === a.signerId && (output.hashPrecommits?.size ?? 0) > 0,
      'TEST_PRECOMMIT_MISSING',
    );
    const committedA = await applyEntityInput(a.env, proposed.workingReplica, precommit);
    expect(committedA.outcome.kind).toBe('committed');
    const commit = requireOutput(
      committedA.outputs,
      output => output.signerId === b.signerId && Boolean(output.proposedFrame?.hankos?.length),
      'TEST_COMMIT_MISSING',
    );

    // B commits A's frame: the committed Entity clock is now ahead of B's Runtime.
    b.env.state.timestamp = 6_000;
    const committedB = await applyEntityInput(b.env, prepared.workingReplica, commit);
    expect(committedB.workingReplica.state.height).toBe(1);
    expect(committedB.workingReplica.state.timestamp).toBe(21_000);
    expect(resolveEntityProposalTimestamp(b.env, committedB.workingReplica.state)).toBe(21_000);

    const follower = committedB.workingReplica;
    follower.mempool = [signedEntityCommandTx(buildSignedEntityCommand(b.env, follower.state, b.signerId, [
      { type: 'chat', data: { from: b.signerId, message: 'B leads behind the committed clock' } },
    ]))];
    const voteBody = buildEntityLeaderVoteBody(follower.state);
    expect(voteBody).toMatchObject({ targetHeight: 2, nextLeaderId: b.signerId, toView: 1 });
    const signedVote = (validator: typeof a): EntityLeaderTimeoutVote => {
      const vote: EntityLeaderTimeoutVote = { ...voteBody, voterId: validator.signerId, signature: '' };
      vote.signature = signAccountFrame(validator.env, validator.signerId, hashEntityLeaderVoteBody(vote));
      return vote;
    };

    // A 2-of-2 timeout quorum hands the lead to B, whose clock is still 6 s.
    let failover = committedB;
    for (const vote of [signedVote(a), signedVote(b)]) {
      failover = await applyEntityInput(b.env, failover.workingReplica, {
        entityId,
        signerId: b.signerId,
        leaderTimeoutVote: vote,
      });
    }
    expect(failover.workingReplica.pendingLeaderCertificate).toMatchObject({
      targetHeight: 2,
      nextLeaderId: b.signerId,
      toView: 1,
    });
    const next = failover.workingReplica.proposal;
    if (!next) throw new Error('TEST_FAILOVER_PROPOSAL_MISSING');
    expect(next.height).toBe(2);
    expect(next.leader).toMatchObject({ proposerSignerId: b.signerId, view: 1 });
    // Monotone Entity clock: the frame carries the committed 21 s, not B's 6 s.
    expect(next.timestamp).toBe(21_000);
    expect(next.timestamp).toBeGreaterThanOrEqual(committedB.workingReplica.state.timestamp);
    expect(failover.workingReplica.state.height).toBe(1);
  });
});
