import { expect, test } from 'bun:test';
import { deriveSignerAddressSync } from '../../../account/crypto';
import { RuntimeP2P } from '../../../network/p2p/p2p';
import { decodeRuntimeEntityInputsEnvelope } from '../../../network/p2p/auth/entity-input-envelope';
import { startStandaloneRelayServer } from '../../../network/relay/standalone-server';
import { createEmptyEnv } from '../../../runtime';

const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 400 && !predicate(); attempt += 1) await Bun.sleep(5);
  expect(predicate()).toBe(true);
};

test('an authenticated relay cannot authorize delivery to a recipient without a direct session', async () => {
  const seed = 'p2p-recipient-readiness';
  const env = createEmptyEnv(seed, 1);
  const sourceRuntimeId = deriveSignerAddressSync(seed, '1').toLowerCase();
  const targetRuntimeId = deriveSignerAddressSync('p2p-recipient-missing', '1').toLowerCase();
  const received: unknown[] = [];
  const profilesReceived: unknown[] = [];
  const relay = startStandaloneRelayServer({
    host: '127.0.0.1', port: 0, serverId: targetRuntimeId,
    onEntityInput: (_from, message) => { received.push(message); },
  });
  const gossipRequests = (): number => relay.store.debugEvents.filter(event =>
    event.event === 'gossip_request' && event.from === sourceRuntimeId).length;
  const p2p = new RuntimeP2P({
    env, runtimeId: sourceRuntimeId,
    relayUrls: [`ws://127.0.0.1:${relay.server.port}`],
    onEntityInputs: (_from, envelope) => { received.push(envelope); },
    onGossipProfiles: (_from, profiles) => { profilesReceived.push(...profiles); },
  });
  try {
    p2p.setReady(true);
    p2p.connect();
    await waitFor(() => p2p.isConnected() && gossipRequests() > 0);
    const envelope = decodeRuntimeEntityInputsEnvelope({
      sourceRuntimeId, sourceRuntimeHeight: 57, sourceRuntimeTimestamp: 123,
      entityInputs: [{
        entityId: `0x${'31'.repeat(32)}`, runtimeId: targetRuntimeId,
        signerId: targetRuntimeId, entityTxs: [],
      }],
    });
    expect(p2p.canDeliver(targetRuntimeId)).toBe(false);
    expect(p2p.enqueueEntityInputsDelivery(targetRuntimeId, envelope)).toMatchObject({
      outcome: 'deferred', code: 'P2P_DIRECT_RECIPIENT_NOT_READY',
      retryable: true, fatal: false, terminal: false,
    });
    const previousRequests = gossipRequests();
    p2p.requestGossip(targetRuntimeId);
    await waitFor(() => gossipRequests() > previousRequests);
    expect(received).toEqual([]);
    expect(relay.store.debugEvents.some(event => event.msgType === 'entity_inputs')).toBe(false);
    expect(env.infrastructure?.operatorStatus).not.toBe('HALTED_REQUIRES_OPERATOR');
  } finally {
    await p2p.closeAndWait();
    relay.close();
  }
});
