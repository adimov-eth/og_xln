import { expect, test } from 'bun:test';
import { accountInputAck, accountInputProposal } from '../../../account/consensus/flush';
import { requireAccountDeltaTransformerAddress } from '../../../account/consensus/helpers';
import { createAccountConsensusContext } from '../../../entity/account/account-consensus-context';
import { getEntityAccountForWrite } from '../../../entity/state/persistent-account-map';
import { resolveInboundAccount } from '../../../entity/tx/handlers/account/inbound-account';
import { handleLendingOfferEntityTx } from '../../../entity/tx/handlers/payments/lending';
import { runAccountAuthorityEntityStage } from '../../../rscore/authority/entity-stage';
import { TsAccountWorkerAuthority } from '../../../rscore/ts-worker';
import { createEmptyEnv } from '../../../runtime';
import { createJReplica } from '../../../scenarios/harness/boot';
import { addr, entity, makeJurisdiction, makeState } from '../../helpers/cross-j';

test('lending_fund worker failure and discard retain both errors in the logged message', async () => {
  const env = createEmptyEnv('lending-ui-worker-boundary');
  const owner = entity('11');
  const hub = entity('22');
  const signerId = addr('33');
  const jurisdiction = makeJurisdiction('lending-ui-boundary', 31337, '44', '55');
  const j = createJReplica(env, jurisdiction.name, jurisdiction.depositoryAddress);
  j.chainId = jurisdiction.chainId;
  j.contracts = { ...j.contracts, depository: jurisdiction.depositoryAddress,
    entityProvider: jurisdiction.entityProviderAddress, account: addr('66'), deltaTransformer: addr('77') };
  const state = makeState(owner, signerId, jurisdiction, hub);
  const account = getEntityAccountForWrite(state.accounts, hub);
  if (!account) throw new Error('LENDING_WORKER_ACCOUNT_MISSING');
  const rootBefore = state.accounts.rootHash();
  const context = createAccountConsensusContext(env);
  const authority = new TsAccountWorkerAuthority(env, 1);
  let caught: unknown;
  try {
    await runAccountAuthorityEntityStage(env, {
      ownerEntityId: owner, ownerSignerId: signerId, provider: authority.provider,
      occurrence: { kind: 'runtime-input', inputIndex: 0 }, deferProposal: false,
    }, async () => {
      const stage = env.accountAuthorityEntityStage;
      if (!stage) throw new Error('LENDING_WORKER_STAGE_MISSING');
      await stage.beginEntityAccountFrame({ ownerEntityId: owner,
        expectedAccountsRoot: rootBefore, entityState: state,
        entityContext: { version: 1, entityId: owner, proposerSignerId: signerId,
          proposerReplicaId: `${owner}:${signerId}`, parentFrameHash: state.prevFrameHash,
          height: 1, gossipProfiles: [], peerAssertions: [], htlc: { version: 1, entries: [], originated: [] } },
        entityTxs: [], accounts: state.accounts,
        accountForWrite: id => getEntityAccountForWrite(state.accounts, id),
        createInboundAccount: input => {
          const resolution = resolveInboundAccount(state, input, Boolean(accountInputAck(input)), Boolean(accountInputProposal(input)));
          return { account: resolution.account,
            deltaTransformer: requireAccountDeltaTransformerAddress(context, resolution.account.state) };
        },
        entityTimestamp: state.timestamp, finalizedJHeight: 0,
      });
      await stage.executeEntityBooks({ entityState: state, slots: [] });
      const offer = handleLendingOfferEntityTx(state, { type: 'lendingOffer', data: {
        positionId: 'lend-0123456789abcdef', hubEntityId: hub, tokenId: 1,
        amount: 200_000_000n, termId: '1d', interestBps: 100,
      } }, true);
      const txs = offer.accountTxs?.map(row => row.tx);
      if (!txs) throw new Error('LENDING_WORKER_ADMISSION_MISSING');
      await stage.executeAccountInput({ collectorFrameId: owner, account,
        input: { kind: 'enqueue', txs }, entityTimestamp: state.timestamp, finalizedJHeight: 0 });
      await stage.prepareEntityAccountOutbound({ entityState: state, entityHeight: 1,
        accounts: state.accounts, accountForWrite: id => getEntityAccountForWrite(state.accounts, id),
        proposalAccountIds: [hub], timestamp: state.timestamp, jHeight: 0 });
    });
  } catch (error) { caught = error; }
  finally { await authority.close(); }
  expect(caught).toBeInstanceOf(AggregateError);
  if (!(caught instanceof AggregateError)) throw new Error('LENDING_WORKER_AGGREGATE_REQUIRED');
  expect(caught.errors).toHaveLength(2);
  expect(caught.message).toContain('ACCOUNT_AUTHORITY_ENTITY_STAGE_APPLY_DISCARD_FAILED');
  expect(caught.message).toContain('ACCOUNT_TX_KIND_OUT_OF_PROFILE:lending_fund');
  expect(caught.message).toContain('"apply"');
  expect(caught.message).toContain('"discard"');
  expect(account.mempool).toHaveLength(0);
  expect(account.pendingFrame).toBeUndefined();
  expect(state.accounts.rootHash()).toBe(rootBefore);
  expect(env.accountAuthorityEntityStage).toBeUndefined();
});
