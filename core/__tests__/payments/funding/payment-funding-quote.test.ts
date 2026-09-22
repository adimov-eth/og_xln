import { describe, expect, test } from 'bun:test';
import { createGossipLayer } from '../../../network/p2p/gossip';
import type { Profile } from '../../../entity/profile';

const OWNER = `0x${'1'.repeat(64)}`;
const HUB = `0x${'2'.repeat(64)}`;
const TARGET = `0x${'3'.repeat(64)}`;
const OTHER = `0x${'4'.repeat(64)}`;
const profile = (entityId: string, counterparty: string | null, capacity: bigint): Profile => ({
  entityId,
  entityEncryptionPublicKey: entityId,
  runtimeId: entityId.slice(0, 42),
  name: entityId,
  avatar: '',
  bio: '',
  website: '',
  lastUpdated: 1,
  runtimeEncPubKey: entityId,
  publicAccounts: counterparty ? [counterparty] : [],
  wsUrl: null,
  relays: [],
  metadata: { routingFeePPM: 1, baseFee: 0n, isHub: false },
  accounts: counterparty
    ? [
        {
          counterpartyId: counterparty,
          domain: { chainId: 31337, depositoryAddress: `0x${'1'.repeat(40)}` },
          tokenCapacities: { 1: { outCapacity: capacity, inCapacity: 0n } },
        },
      ]
    : [],
});

const graph = (downstream: bigint, sourceFeePPM = 1) => {
  const gossip = createGossipLayer();
  const source = profile(OWNER, HUB, 0n);
  source.metadata.routingFeePPM = sourceFeePPM;
  gossip.setProfiles([source, profile(HUB, TARGET, downstream), profile(TARGET, null, 0n)]);
  return gossip.getNetworkGraph();
};

describe('read-only first Account funding quote', () => {
  test('zero-capacity Account gets exact principal plus fees without changing ordinary route admission', async () => {
    const routes = graph(1_000_000_000n);
    expect(await routes.findPaths(OWNER, TARGET, 25_000_000n, 1)).toEqual([]);
    const [quote] = await routes.findPaths(OWNER, TARGET, 25_000_000n, 1, HUB);
    expect(quote?.path).toEqual([OWNER, HUB, TARGET]);
    expect(quote?.totalAmount).toBe(25_000_025n);
    expect(quote?.totalFee).toBe(25n);
    expect(await routes.findPaths(OWNER, TARGET, 25_000_000n, 1)).toEqual([]);
  });

  test('the sender pays no fee to itself and the last Account needs only recipient principal', async () => {
    const [quote] = await graph(25_000_000n, 100_000).findPaths(OWNER, TARGET, 25_000_000n, 1, HUB);
    expect(quote?.path).toEqual([OWNER, HUB, TARGET]);
    expect(quote?.totalAmount).toBe(25_000_025n);
    expect(quote?.hops[1]?.fee).toBe(25n);
    expect(await graph(24_999_999n, 100_000).findPaths(OWNER, TARGET, 25_000_000n, 1, HUB)).toEqual([]);
  });

  test('selected first hop cannot bypass downstream principal capacity', async () => {
    expect(await graph(24_999_999n).findPaths(OWNER, TARGET, 25_000_000n, 1, HUB)).toEqual([]);
    expect((await graph(25_000_000n).findPaths(OWNER, TARGET, 25_000_000n, 1, HUB)).length).toBe(1);
    expect((await graph(25_000_025n).findPaths(OWNER, TARGET, 25_000_000n, 1, HUB)).length).toBe(1);
    expect(await graph(1_000_000_000n).findPaths(OWNER, TARGET, 25_000_000n, 1, OTHER)).toEqual([]);
  });
});
