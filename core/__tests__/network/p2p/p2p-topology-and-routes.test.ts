import { expect, test } from 'bun:test';
import type { Profile } from '../../../entity/profile';
import { selectProfileBatch } from '../../../network/p2p/gossip/profile-batch';
import { RuntimeP2P } from '../../../network/p2p/p2p';
import { createEmptyEnv } from '../../../runtime';

const ALICE = `0x${'aa'.repeat(32)}`;
const BOB = `0x${'bb'.repeat(32)}`;
const H1 = `0x${'11'.repeat(32)}`;
const DOMAIN = { chainId: 31_337, depositoryAddress: `0x${'22'.repeat(20)}` };

type CapEntry = { outCapacity: bigint; inCapacity: bigint };

type P2PInternals = {
  announceStateTopology: () => { accountsKey: string; policyKey: string; routingKey: string };
  rememberAnnouncedProfile: (profile: Profile) => void;
  shouldAnnounceProfile: (profile: Profile) => boolean;
  getActiveClient: () => {
    sendGossipRequest: (runtimeId: string, req: Record<string, unknown>) => void;
  };
  waitForActiveDelay: () => Promise<boolean>;
  ensureRoutes: (source: string, target: string, amount: bigint, tokenId: number) => Promise<boolean>;
};

const mkProfile = (
  entityId: string,
  isHub: boolean,
  accounts: Array<{ counterpartyId: string; outCapacity: bigint; inCapacity: bigint; useMap?: boolean }>,
  lastUpdated = 1_000,
): Profile => ({
  entityId,
  entityEncryptionPublicKey: `0x${'33'.repeat(32)}`,
  runtimeId: `0x${entityId.slice(2, 42)}`,
  name: entityId.slice(0, 8),
  avatar: '',
  bio: '',
  website: '',
  lastUpdated,
  runtimeEncPubKey: `0x${'44'.repeat(32)}`,
  publicAccounts: accounts.map(a => a.counterpartyId),
  wsUrl: null,
  relays: [],
  metadata: { routingFeePPM: 100, baseFee: 0n, isHub },
  accounts: accounts.map(a => {
    const cap: CapEntry = { outCapacity: a.outCapacity, inCapacity: a.inCapacity };
    return {
      counterpartyId: a.counterpartyId,
      domain: DOMAIN,
      tokenCapacities: (a.useMap ? new Map([[1, cap]]) : { 1: cap }) as unknown as Record<number, CapEntry>,
    };
  }),
});

test('shouldAnnounceProfile triggers on directional 0n <-> >0n capacity crossings for Record and Map capacities', () => {
  const env = createEmptyEnv('p2p-topology-directional');
  const p2p = new RuntimeP2P({
    env,
    runtimeId: `0x${'99'.repeat(20)}`,
    onEntityInputs: () => {},
    onGossipProfiles: () => {},
    profileHeartbeatMs: 3_600_000,
  }) as unknown as P2PInternals;
  p2p.announceStateTopology = () => ({ accountsKey: 'k', policyKey: 'p', routingKey: 'r' });

  const p0 = mkProfile(BOB, false, [{ counterpartyId: H1, inCapacity: 0n, outCapacity: 0n }], 1_000);
  const pIn = mkProfile(BOB, false, [{ counterpartyId: H1, inCapacity: 1n, outCapacity: 0n }], 1_001);
  const pInScaled = mkProfile(BOB, false, [{ counterpartyId: H1, inCapacity: 500n, outCapacity: 0n }], 1_002);
  const pOut = mkProfile(BOB, false, [{ counterpartyId: H1, inCapacity: 500n, outCapacity: 1n }], 1_003);
  const pOutZero = mkProfile(BOB, false, [{ counterpartyId: H1, inCapacity: 500n, outCapacity: 0n }], 1_004);
  const pMapFlip = mkProfile(BOB, false, [{ counterpartyId: H1, inCapacity: 500n, outCapacity: 1n, useMap: true }], 1_005);

  p2p.rememberAnnouncedProfile(p0);
  expect(p2p.shouldAnnounceProfile(p0)).toBe(false);
  expect(p2p.shouldAnnounceProfile(pIn)).toBe(true);
  p2p.rememberAnnouncedProfile(pIn);
  expect(p2p.shouldAnnounceProfile(pInScaled)).toBe(false);
  expect(p2p.shouldAnnounceProfile(pOut)).toBe(true);
  p2p.rememberAnnouncedProfile(pOut);
  expect(p2p.shouldAnnounceProfile(pOutZero)).toBe(true);
  p2p.rememberAnnouncedProfile(pOutZero);
  expect(p2p.shouldAnnounceProfile(pMapFlip)).toBe(true);
});

test('ensureRoutes refreshes remote source via ids, resolves 4-node self-cycles, and rejects 1-intermediate self-cycles', async () => {
  const cyclePool = [
    mkProfile(ALICE, false, [
      { counterpartyId: H1, outCapacity: 500_000n, inCapacity: 500_000n },
      { counterpartyId: BOB, outCapacity: 0n, inCapacity: 500_000n },
    ]),
    mkProfile(BOB, false, [
      { counterpartyId: H1, outCapacity: 500_000n, inCapacity: 500_000n },
      { counterpartyId: ALICE, outCapacity: 500_000n, inCapacity: 0n },
    ]),
    mkProfile(H1, true, []),
  ];

  const makeClientP2P = (pool: Profile[], initial: Profile[], localIds: string[]) => {
    const env = createEmptyEnv(`p2p-ensure-${Math.random()}`);
    if (initial.length > 0) env.gossip.setProfiles(initial);
    for (const id of localIds) {
      const signerId = `0x${'11'.repeat(20)}`;
      env.state.eReplicas.set(`${id}:${signerId}`, {
        entityId: id,
        signerId,
        isProposer: false,
        state: { accounts: new Map(), config: { mode: 'proposer-based', threshold: 1n, validators: [signerId], shares: { [signerId]: 1n } }, profile: { name: 'local', isHub: false, avatar: '', bio: '', website: '' } },
      } as never);
    }
    const reqs: Array<Record<string, unknown>> = [];
    const p2p = new RuntimeP2P({
      env,
      runtimeId: `0x${'88'.repeat(20)}`,
      onEntityInputs: () => {},
      onGossipProfiles: () => {},
    }) as unknown as P2PInternals;
    p2p.getActiveClient = () => ({
      sendGossipRequest: (_rt: string, req: Record<string, unknown>) => {
        reqs.push(req);
        const routeTo = req.routeTo as Record<string, unknown> | undefined;
        const decoded = routeTo ? { ...req, routeTo: { ...routeTo, amount: BigInt(String(routeTo.amount)) } } : req;
        const selected = selectProfileBatch(pool, decoded as never);
        const merged = new Map(env.gossip.getProfiles().map(p => [p.entityId, p]));
        for (const prof of selected) merged.set(prof.entityId, prof);
        env.gossip.setProfiles(Array.from(merged.values()));
      },
    });
    p2p.waitForActiveDelay = async () => true;
    return { p2p, reqs, env };
  };

  // Remote source with stale 0n capacity triggers ids:[BOB]
  const remote = makeClientP2P(
    cyclePool,
    [
      mkProfile(ALICE, false, [{ counterpartyId: H1, outCapacity: 500_000n, inCapacity: 500_000n }]),
      mkProfile(BOB, false, [{ counterpartyId: H1, outCapacity: 0n, inCapacity: 0n }]),
      mkProfile(H1, true, []),
    ],
    [ALICE],
  );
  await expect(remote.p2p.ensureRoutes(BOB, ALICE, 100n, 1)).resolves.toBe(true);
  expect(remote.reqs[0]?.ids).toEqual([BOB]);

  // Self-target 4-node cycle succeeds without ids
  const selfCycle = makeClientP2P(cyclePool, [], [ALICE]);
  await expect(selfCycle.p2p.ensureRoutes(ALICE, ALICE, 100n, 1)).resolves.toBe(true);
  expect(selfCycle.reqs[0]?.ids).toBeUndefined();

  // 1-intermediate self-loop [ALICE, H1, ALICE] is rejected by path length >= 3
  const twoNodePool = [
    mkProfile(ALICE, false, [{ counterpartyId: H1, outCapacity: 500_000n, inCapacity: 500_000n }]),
    mkProfile(H1, true, [{ counterpartyId: ALICE, outCapacity: 500_000n, inCapacity: 500_000n }]),
  ];
  const shortSelf = makeClientP2P(twoNodePool, twoNodePool, [ALICE]);
  await expect(shortSelf.p2p.ensureRoutes(ALICE, ALICE, 100n, 1)).resolves.toBe(false);

  // Concurrent ensureRoutes calls with different amounts must not share the same profileFetches dedup entry
  const concurrent = makeClientP2P(cyclePool, [], [ALICE]);
  const [smallOk, largeOk] = await Promise.all([
    concurrent.p2p.ensureRoutes(ALICE, ALICE, 100n, 1),
    concurrent.p2p.ensureRoutes(ALICE, ALICE, 1_000_000n, 1),
  ]);
  expect(smallOk).toBe(true);
  expect(largeOk).toBe(false);
});
