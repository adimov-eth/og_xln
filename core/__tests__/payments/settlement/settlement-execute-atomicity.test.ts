import { expect, test } from 'bun:test';

import { withReadySettlement } from '../../../../rscore/fixtures/entity-resident-group-e/group-e';
import { executeFrame } from '../../../../rscore/fixtures/entity-resident-group-e/runtime-vector';
import { advanceEntityCommandNonce, buildSignedEntityCommand } from '../../../entity/command';
import { signedEntityCommandTx } from '../../../entity/command/command-codec';
import { buildCollectiveEntityProposalTx } from '../../../entity/auth/authorization';
import { computeCanonicalEntityConsensusStateHash } from '../../../entity/consensus/state-root';

test('initially ready settle_execute is idempotent within one and across two signed outer commands', async () => {
  await withReadySettlement(async (sameLeft, sameRight) => {
    await withReadySettlement(async (separateLeft, separateRight) => {
      for (const [separate, left, right] of [
        [false, sameLeft, sameRight],
        [true, separateLeft, separateRight],
      ] as const) {
        const replica = () => [...left.env.state.eReplicas.values()].find(row => row.entityId === left.entityId)!;
        const before = replica().state;
        const beforeNonce = before.entityCommandNonces?.bySigner.get(left.signerId)?.nonce ?? 0n;
        const root = computeCanonicalEntityConsensusStateHash(before);
        const account = before.accounts.get(right.entityId)!;
        expect(account.state.settlementWorkspace?.status).toBe('ready_to_submit');
        expect(account.pendingFrame).toBeUndefined();
        expect(account.mempool).toHaveLength(0);
        const tx = {
          type: 'settle_execute' as const,
          data: { counterpartyEntityId: right.entityId, disableC2RShortcut: true },
        };
        const first = buildSignedEntityCommand(left.env, before, left.signerId, [
          buildCollectiveEntityProposalTx(left.signerId, separate ? [tx] : [tx, tx]),
        ]);
        const commands = [signedEntityCommandTx(first)];
        if (separate) {
          const cursor = advanceEntityCommandNonce(before, first);
          commands.push(
            signedEntityCommandTx(
              buildSignedEntityCommand(left.env, cursor, left.signerId, [
                buildCollectiveEntityProposalTx(left.signerId, [tx]),
              ]),
            ),
          );
        }
        const result = await executeFrame(left.env, [
          { entityId: left.entityId, signerId: left.signerId, entityTxs: commands },
        ]);
        expect(result.projection.canonicalEntityInputs).toHaveLength(1);
        expect(result.projection.canonicalEntityInputs[0]!.entityTxs).toHaveLength(separate ? 2 : 1);
        expect(result.outputs).toHaveLength(1);
        expect(replica().state.entityCommandNonces?.bySigner.get(left.signerId)?.nonce).toBe(
          beforeNonce + (separate ? 2n : 1n),
        );
        expect(result.projection.entityFrames).toHaveLength(1);
        expect(result.projection.entityFrames[0]!.txs).toHaveLength(separate ? 2 : 1);
        expect(replica().state.jBatchState?.batch.settlements).toHaveLength(1);
        expect(
          replica()
            .state.accounts.get(right.entityId)
            ?.pendingFrame?.accountTxs.filter(tx => tx.type === 'settle_transition' && tx.data.kind === 'submit'),
        ).toHaveLength(1);
        expect(replica().state.accounts.get(right.entityId)?.mempool).toHaveLength(0);
        const queuedEvents = result.projection.entityFrames[0]!.events.filter(
          event => event.type === 'status' && event.message.startsWith('✅ Settlement submission queued'),
        );
        expect(queuedEvents).toHaveLength(2);
        expect(computeCanonicalEntityConsensusStateHash(replica().state)).not.toBe(root);
      }
    });
  });
});
