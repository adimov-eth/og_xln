import { afterEach, describe, expect, test } from 'bun:test';

import {
  signAccountFrame,
} from '../../../../account/crypto';
import { applyEntityInput } from '../../../../entity/consensus';
import {
  buildEntityLeaderVoteBody,
  hashEntityLeaderVoteBody,
} from '../../../../entity/consensus/leader';
import { getAccountJClaimNodeStore } from '../../../../entity/account/account-j-claim-node-store';
import {
  handleInboundP2PEntityInputs,
  processRuntime,
  readPersistedFrameJournal,
  createEmptyEnv,
} from '../../../../runtime';
import { signRuntimeEntityInputsEnvelope } from '../../../../runtime/admit/entity-input-envelope-auth.ts';
import {
  buildAuthenticatedInvalidProposal,
  buildMalformedBoardHandoverProposal,
  cleanupPersistedProposalFixtures,
  deliverEncryptedProposal,
  durableProposalFixture,
  installPersistedProposalValidator,
  proposalRuntimeFixture,
  restartPersistedProposalValidator,
} from '../../../helpers/entity-proposal-runtime-fixture';

afterEach(async () => {
  // The reject policy is read once per frame by the Runtime loop; a test that
  // pins the production branch must not leak it into the fail-fast default.
  delete process.env['XLN_REJECT_FAIL_FAST'];
  await cleanupPersistedProposalFixtures();
});

describe('Entity proposal Runtime isolation', () => {
  test('honest proposal reaches precommit and quorum on the exact frame', async () => {
    const { frame, proposer, proposerReplica } = await proposalRuntimeFixture.buildHonestProposal();
    const validator = proposalRuntimeFixture.createValidator('2');
    const precommitted = await applyEntityInput(validator.env, validator.replica, {
      entityId: proposalRuntimeFixture.entityId,
      signerId: validator.signerId,
      proposedFrame: frame,
    });
    expect(precommitted.outcome).toEqual({ kind: 'committed' });
    expect(precommitted.newState.height).toBe(1);
    expect(precommitted.newState.prevFrameHash).toBe(frame.hash);
    const commitNotice = precommitted.outputs.find(output =>
      output.signerId === proposer.signerId &&
      output.proposedFrame?.hash === frame.hash &&
      output.proposedFrame.hankos?.length);
    if (!commitNotice) throw new Error('TEST_PROPOSER_COMMIT_NOTICE_MISSING');

    const quorum = await applyEntityInput(
      proposer.env,
      proposerReplica,
      commitNotice,
    );
    expect(quorum.outcome).toEqual({ kind: 'committed' });
    expect(quorum.newState.height).toBe(1);
    expect(quorum.newState.prevFrameHash).toBe(frame.hash);
    expect(quorum.workingReplica.proposal).toBeUndefined();
    expect(quorum.workingReplica.candidate).toBeUndefined();
  });

  test('encrypted wire rejection leaves no frame, candidate, CAS, or restart residue', async () => {
    const { env, signerId } = await installPersistedProposalValidator();
    expect(env.state.height).toBe(1);
    const frame = await buildAuthenticatedInvalidProposal(env, signerId);
    const { inboundResults, deliveryFailures, remoteRuntimeId, remoteEnv } = await deliverEncryptedProposal(env, frame);
    // The canonical encrypted-envelope decoder authenticates nested commands
    // before Runtime admission; this invalid signature must never be queued.
    expect(inboundResults).toEqual([]);
    expect(deliveryFailures).toEqual([
      'ENTITY_FRAME_TX_FAILED: type=entityCommand error=ENTITY_COMMAND_SIGNATURE_INVALID',
    ]);

    const claimsBefore = getAccountJClaimNodeStore(env).size;
    await processRuntime(env, []);
    const replica = env.state.eReplicas.get(`${durableProposalFixture.entityId}:${signerId}`)!;
    expect(env.state.height).toBe(1);
    expect(env.infrastructure?.halted).toBe(false);
    expect(replica.state.height).toBe(0);
    expect(replica.proposal).toBeUndefined();
    expect(replica.candidate).toBeUndefined();
    expect(getAccountJClaimNodeStore(env).size).toBe(claimsBefore);
    expect(env.infrastructure?.pendingAccountJClaimNodes?.size ?? 0).toBe(0);
    expect(await readPersistedFrameJournal(env, 2)).toBeNull();

    const voterId = durableProposalFixture.validators[0]!;
    const voteBody = buildEntityLeaderVoteBody(replica.state);
    const vote = {
      ...voteBody,
      voterId,
      signature: signAccountFrame(env, voterId, hashEntityLeaderVoteBody(voteBody)),
    };
    expect(handleInboundP2PEntityInputs(env, remoteRuntimeId, signRuntimeEntityInputsEnvelope(remoteEnv, env.runtimeId!, {
      sourceRuntimeId: remoteRuntimeId,
      sourceRuntimeHeight: 2,
      sourceRuntimeTimestamp: 2_000,
      entityInputs: [{
        entityId: durableProposalFixture.entityId,
        signerId,
        runtimeId: env.runtimeId!,
        leaderTimeoutVote: vote,
      }],
    })).kind).toBe('queued');
    await processRuntime(env, []);
    expect(env.state.height).toBe(2);
    const durableFrame = await readPersistedFrameJournal(env, 2);
    expect(durableFrame?.runtimeInput.entityInputs).toHaveLength(1);
    expect(durableFrame?.runtimeInput.entityInputs[0]?.proposedFrame).toBeUndefined();

    const restored = await restartPersistedProposalValidator(env);
    const restoredReplica = restored.state.eReplicas.get(
      `${durableProposalFixture.entityId}:${signerId}`,
    )!;
    expect(restored.state.height).toBe(2);
    expect(restoredReplica.state.height).toBe(0);
    expect(restoredReplica.proposal).toBeUndefined();
    expect(restoredReplica.candidate).toBeUndefined();
    expect(restoredReplica.leaderVotes?.has(voterId)).toBe(true);
    expect(getAccountJClaimNodeStore(restored).size).toBe(claimsBefore);
  }, 30_000);

  test('remote duplicate board handover is a typed reject: dropped without halting Runtime under the production policy, surfaced to the caller under fail-fast, never mutating the validator', async () => {
    const { env, signerId } = await installPersistedProposalValidator();
    const frame = await buildMalformedBoardHandoverProposal(env, signerId);
    const remoteEnv = createEmptyEnv('duplicate-board-handover-remote');
    const remoteRuntimeId = remoteEnv.runtimeId!;
    const queueHostileFrame = (): void => {
      const inbound = handleInboundP2PEntityInputs(
        env,
        remoteRuntimeId,
        signRuntimeEntityInputsEnvelope(remoteEnv, env.runtimeId!, {
          sourceRuntimeId: remoteRuntimeId,
          sourceRuntimeHeight: 1,
          sourceRuntimeTimestamp: 1_000,
          entityInputs: [{
            entityId: durableProposalFixture.entityId,
            signerId,
            runtimeId: env.runtimeId!,
            proposedFrame: frame,
          }],
        }),
      );
      expect(inbound.kind).toBe('queued');
    };
    const expectValidatorUntouched = async (): Promise<void> => {
      const replica = env.state.eReplicas.get(`${durableProposalFixture.entityId}:${signerId}`)!;
      // Owner canon: a peer can never take a Runtime down. Whatever the policy
      // decides about the caller, the Hub is never marked halted and no
      // hostile byte reaches the validator's committed lineage.
      expect(env.infrastructure?.halted).toBe(false);
      expect(env.state.height).toBe(1);
      expect(replica.state.height).toBe(0);
      expect(replica.proposal).toBeUndefined();
      expect(replica.candidate).toBeUndefined();
      expect(await readPersistedFrameJournal(env, 2)).toBeNull();
    };

    // Production policy: the rejection is logged and dropped, the Runtime keeps
    // serving and the frame settles normally.
    process.env['XLN_REJECT_FAIL_FAST'] = '0';
    queueHostileFrame();
    await processRuntime(env, []);
    await expectValidatorUntouched();

    // Fail-fast (tests/dev/CI default): the same typed rejection is handed to
    // the caller of the Runtime loop, after the frame settled — so a hostile
    // peer surfaces here instead of in a production log line, and it still
    // costs the Runtime nothing.
    delete process.env['XLN_REJECT_FAIL_FAST'];
    queueHostileFrame();
    await expect(processRuntime(env, [])).rejects.toThrow('REMOTE_INPUT_REJECTED');
    await expectValidatorUntouched();
  }, 30_000);

  test('remote raw board handover cannot enter mempool or stall honest frames', async () => {
    const { env, signerId } = await installPersistedProposalValidator();
    const replicaKey = `${durableProposalFixture.entityId}:${signerId}`;
    const before = env.state.eReplicas.get(replicaKey)!;
    const remoteEnv = createEmptyEnv('raw-board-handover-remote');
    const remoteRuntimeId = remoteEnv.runtimeId!;
    const config = before.state.config;
    expect(() => handleInboundP2PEntityInputs(
      env,
      remoteRuntimeId,
      signRuntimeEntityInputsEnvelope(remoteEnv, env.runtimeId!, {
        sourceRuntimeId: remoteRuntimeId,
        sourceRuntimeHeight: 1,
        sourceRuntimeTimestamp: 1_000,
        entityInputs: [{
          entityId: durableProposalFixture.entityId,
          signerId,
          runtimeId: env.runtimeId!,
          entityTxs: [{
            type: 'boardHandover',
            data: {
              board: {
                mode: config.mode,
                threshold: config.threshold,
                validators: [...config.validators],
                shares: { ...config.shares },
              },
            },
          }],
        }],
      }),
    )).toThrow('INBOUND_ENTITY_UNSIGNED_USER_COMMAND');
    const after = env.state.eReplicas.get(replicaKey)!;
    expect(env.infrastructure?.halted).toBe(false);
    expect(env.state.height).toBe(1);
    expect(after.state.height).toBe(before.state.height);
    expect(after.mempool).toEqual([]);
    expect(await readPersistedFrameJournal(env, 2)).toBeNull();
  }, 30_000);
});
