import { expect, test } from 'bun:test';
import {
  closeInfraDb, closeRuntimeDb, createEmptyEnv, enqueueRuntimeInput,
  loadEnvFromDB, processRuntime, readPersistedFrameJournal,
} from '../../../../runtime';
import { deriveSignerAddressSync, deriveSignerKeySync, registerSignerKey } from '../../../../account/crypto';
import { generateLazyEntityId } from '../../../../entity/factory';
import { createTestEntityImportRuntimeTx } from '../../../../qa/entity-creation-fixture';
import { createTestJReplica } from '../../../helpers/j-replica';
import { createDirectRuntimeWsRoute } from '../../../../network/p2p/direct-runtime-bun';
import { RuntimeP2P } from '../../../../network/p2p/p2p';
import { createRuntimeRoutingApi } from '../../../../runtime/loop/loop-routing';
import { notifyRuntimeStateChanged } from '../../../../runtime/frame/notifications';
import type { RuntimeReplica } from '../../../../runtime/types';

const jurisdiction = {
  name: 'deferred-outbox-replay', address: 'browservm://deferred-outbox-replay', chainId: 31337,
  depositoryAddress: '0x000000000000000000000000000000000000dEaD',
  entityProviderAddress: '0x000000000000000000000000000000000000bEEF',
};

const createOwner = async (seed: string) => {
  const env = createEmptyEnv(seed);
  const signerId = deriveSignerAddressSync(seed, '1').toLowerCase();
  const entityId = generateLazyEntityId([signerId], 1n).toLowerCase();
  registerSignerKey(env, signerId, deriveSignerKeySync(seed, '1'));
  env.runtimeId = signerId;
  env.dbNamespace = signerId;
  env.quietRuntimeLogs = true;
  env.state.timestamp = 1_000;
  env.runtimeConfig = { ...env.runtimeConfig, storage: {
    ...env.runtimeConfig?.storage, snapshotPeriodFrames: 2, materializePeriodFrames: 10_000,
  } };
  env.activeJurisdiction = jurisdiction.name;
  env.state.jReplicas.set(jurisdiction.name, createTestJReplica({
    name: jurisdiction.name, chainId: jurisdiction.chainId,
    contracts: {
      depository: jurisdiction.depositoryAddress, entityProvider: jurisdiction.entityProviderAddress,
      account: '0x000000000000000000000000000000000000ac01',
      deltaTransformer: '0x000000000000000000000000000000000000de17',
    },
  }));
  enqueueRuntimeInput(env, {
    runtimeTxs: [createTestEntityImportRuntimeTx(env, { entityId, signerId, data: {
      isProposer: true,
      config: { mode: 'proposer-based', threshold: 1n, validators: [signerId], shares: { [signerId]: 1n }, jurisdiction },
    } })], entityInputs: [],
  });
  await processRuntime(env);
  await processRuntime(env, [{ entityId, signerId, entityTxs: [
    { type: 'chatMessage', data: { message: 'certify profile', timestamp: 1_000 } },
  ] }]);
  return { env, entityId, signerId };
};

test('real WAL replays a deferred Account proposal across an unrelated committed frame', async () => {
  const seed = `deferred-outbox-replay-${process.pid}-${Date.now()}`;
  const owner = await createOwner(seed);
  const peer = await createOwner(`${seed}-peer`);
  const opened: RuntimeReplica[] = [owner.env, peer.env];
  try {
    const profile = peer.env.gossip.getProfile(peer.entityId);
    if (!profile) throw new Error('TEST_CERTIFIED_PEER_PROFILE_MISSING');
    owner.env.gossip.announce(profile);
    const api = createRuntimeRoutingApi({ notifyEnvChange: notifyRuntimeStateChanged });
    const discovery = new RuntimeP2P({
      env: owner.env, runtimeId: owner.signerId, relayUrls: [],
      onEntityInputs: (from, envelope) => { api.handleInboundP2PEntityInputs(owner.env, from, envelope); },
      onGossipProfiles: () => notifyRuntimeStateChanged(owner.env),
    });
    await discovery.admitSharedProfiles([profile]);
    discovery.close();
    const route = createDirectRuntimeWsRoute({
      runtimeId: owner.signerId, runtimeSeed: seed,
      onEntityInputs: (from, envelope) => { api.handleInboundP2PEntityInputs(owner.env, from, envelope); },
      onDeliveryFailure: failure => { throw new Error(failure.error); },
    });
    owner.env.infrastructure!.directEntityInputsDispatch = route.sendEntityInputsDelivery;
    enqueueRuntimeInput(owner.env, { runtimeTxs: [], entityInputs: [{
      entityId: owner.entityId, signerId: owner.signerId, entityTxs: [{ type: 'openAccount', data: {
        targetEntityId: peer.entityId, creditAmount: 1000n, tokenId: 1,
        disputeConfig: { leftResponseSeconds: 10, rightResponseSeconds: 10 },
      } }],
    }] });
    await processRuntime(owner.env);
    const pending = structuredClone(owner.env.pendingNetworkOutputs);
    expect(pending?.length).toBeGreaterThan(0);
    const checkpointHeight = owner.env.state.height;
    enqueueRuntimeInput(owner.env, { runtimeTxs: [], entityInputs: [{
      entityId: owner.entityId, signerId: owner.signerId,
      entityTxs: [{ type: 'chatMessage', data: { message: 'unrelated committed work', timestamp: 1001 } }],
    }] });
    await processRuntime(owner.env);
    expect(owner.env.state.height).toBeGreaterThan(checkpointHeight);
    const frame = await readPersistedFrameJournal(owner.env, owner.env.state.height);
    expect(frame?.runtimeOutputs).toEqual(pending);
    expect(frame?.materializedState).toBe(false);
    await closeRuntimeDb(owner.env);
    await closeInfraDb(owner.env);
    opened.shift();
    const restored = await loadEnvFromDB(owner.signerId, seed);
    if (!restored) throw new Error('TEST_DEFERRED_WAL_RESTORE_MISSING');
    opened.push(restored);
    expect(restored.pendingNetworkOutputs).toEqual(pending);
    expect(restored.state.height).toBe(frame!.height);
  } finally {
    for (const env of opened) {
      await closeRuntimeDb(env);
      await closeInfraDb(env);
    }
  }
}, 15_000);
