// Differential tests: og Entity -> Entity command lane, cross-j Entity txs, gossip pathfinding vs pure/xln.ts.
// Every test is "MATCH:" and runs og live on the same (seeded random) input.
import { describe, expect, test } from "bun:test";
import { x25519 } from "@noble/curves/ed25519";
import { buildNetworkGraph as ogBuildGraph } from "../../core/pathfinding/graph.ts";
import { PathFinder } from "../../core/pathfinding/pathfinding.ts";
import * as ogAdmission from "../../core/entity/paybook/payment-admission.ts";
import { withDeterministicHtlcTestSecret } from "../../core/protocol/htlc/test-secret-capability.ts";
import { ALICE, BOB, CAROL, NOW, TERMS, aliceAddr, bobAddr, carolAddr, unwrap, verifiers } from "../xln_run.ts";
import {
  applyRuntime, convertOutput, createEntity, createRuntime, findPaths, isLeft, materializeOriginated, replicaId, replicaKey, spawn, stableJson, tokenId,
  type Address, type Binary, type EntityId, type EntityReplica, type EntityTx, type RoutedEntityInput, type Runtime,
} from "../xln.ts";

const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
type Rand = () => number;
const pick = <T,>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
const int = (r: Rand, n: number): number => Math.floor(r() * n);
const hex = (r: Rand, bytes: number): string => "0x" + Array.from({ length: bytes }, () => int(r, 256).toString(16).padStart(2, "0")).join("");
const ogTry = <T,>(f: () => T): { ok: true; value: T } | { ok: false } => { try { return { ok: true, value: f() }; } catch { return { ok: false }; } };
const ogTryAsync = async <T,>(f: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> => { try { return { ok: true, value: await f() }; } catch { return { ok: false }; } };
const same = (og: { ok: boolean; value?: unknown }, rw: { ok: boolean; value?: unknown }, label: string): void => {
  expect(`${label}:${rw.ok}`).toBe(`${label}:${og.ok}`);
  if (og.ok && rw.ok) expect(stableJson(rw.value)).toBe(stableJson(og.value));
};

// ---- og pathfinding/{graph,pathfinding}.ts ----
const randomProfiles = (r: Rand, ids: readonly string[], tokenId: number): Binary[] => {
  const out = ids.map((id) => {
    const accounts = ids.filter((peer) => peer !== id && r() < 0.35).map((peer) => {
      const rows: [number | string, unknown][] = [];
      if (r() < 0.9) rows.push([r() < 0.1 ? String(tokenId) : tokenId, { inCapacity: BigInt(pick(r, [0, 0, 50, 1_000, int(r, 1e6)])), outCapacity: BigInt(pick(r, [0, 50, 1_000, int(r, 1e6)])) }]);
      if (r() < 0.3) rows.push([tokenId + 1, { inCapacity: 10n, outCapacity: 10n }]);
      const tokenCapacities = r() < 0.2 ? Object.fromEntries(rows.map(([k, v]) => [String(k), v])) : new Map(rows);
      return { counterpartyId: r() < 0.03 ? hex(r, 32) : peer, domain: TERMS.domain, tokenCapacities };
    });
    const isHub = r() < 0.4;
    const metadata: Record<string, unknown> = { isHub, baseFee: BigInt(pick(r, [0, 0, 1, 7, -2])) };
    if (r() < 0.9) metadata.routingFeePPM = pick(r, [0, 1, 100, 5000, 999_999, -5, Number.NaN]);
    return { entityId: id, name: r() < 0.1 ? "  " : id.slice(-4), entityEncryptionPublicKey: "", metadata, accounts };
  });
  return (r() < 0.1 ? [...out, { ...out[0]!, metadata: { ...out[0]!.metadata, routingFeePPM: 7 } }] : out) as unknown as Binary[];
};

describe("entity-lane: gossip pathfinding (og pathfinding/graph.ts, pathfinding.ts, network/p2p/gossip findPaths)", () => {
  test("MATCH: buildNetworkGraph + PathFinder.findRoutes on 400 random gossip graphs (hub metadata, mirrored rows, funding first hop, capacities, fees)", () => {
    const r = rng(41);
    let found = 0;
    for (let i = 0; i < 400; i++) {
      const ids = Array.from({ length: 2 + int(r, 6) }, () => hex(r, 32)), tk = pick(r, [1, 2]);
      const profiles = randomProfiles(r, ids, tk), amount = BigInt(pick(r, [1, 10, 100, 1000, int(r, 1e6)]));
      const source = ids[0]!, target = r() < 0.05 ? source : r() < 0.05 ? hex(r, 32) : ids[ids.length - 1]!;
      const funding = r() < 0.2 ? pick(r, ids) : undefined;
      const map = new Map<string, unknown>();
      for (const p of profiles as unknown as { entityId: string }[]) map.set(p.entityId, p);
      const og = ogTry(() => new PathFinder(ogBuildGraph(map as never, tk, funding ? { sourceEntityId: source, accountId: funding } : undefined)).findRoutes(source, target, amount, tk, 100, funding));
      const rw = findPaths(profiles, source, target, amount, tk, funding);
      same(og, rw, `routes${i}`);
      if (og.ok && og.value.length > 0) found++;
    }
    expect(found).toBeGreaterThan(40);
  });
});

// ---- htlcPayment with an empty route (og infra-context.ts resolveRoute) ----
const ENTITY_KEYS = new Map([ALICE, BOB, CAROL].map((id, i) => { const priv = new Uint8Array(32).fill(i + 7); return [id, { priv: "0x" + Buffer.from(priv).toString("hex"), pub: "0x" + Buffer.from(x25519.getPublicKey(priv)).toString("hex") }] as const; }));
const SIGNERS = new Map<EntityId, Address>([[ALICE, aliceAddr], [BOB, bobAddr], [CAROL, carolAddr]]);
const entityOf = (id: EntityId) => unwrap(createEntity({ id, jurisdiction: TERMS.domain, threshold: 1n, members: new Map([[SIGNERS.get(id)!, { shares: 1n }]]), committed: { entityEncryptionPublicKey: ENTITY_KEYS.get(id)!.pub } }));
const inputOf = (id: EntityId, txs: EntityTx[], timestamp: bigint): RoutedEntityInput => ({ entityId: id, signerId: SIGNERS.get(id)!, input: { kind: "txs", timestamp, txs } });
const quiet = (start: Runtime, first: RoutedEntityInput[], ctx: object = verifiers): Runtime => {
  let rt = start, clock = NOW;
  const queue = [...first];
  for (let n = 0; queue.length > 0; n++) {
    if (n > 200) throw new Error("no quiescence");
    const input = queue.shift() as RoutedEntityInput;
    const out = unwrap(applyRuntime(rt, { runtimeTxs: [], entityInputs: [input] }, ctx as typeof verifiers));
    if (out.rejected.length > 0) throw new Error(JSON.stringify(out.rejected, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
    rt = out.runtime; clock += 1n;
    for (const o of out.outbox) {
      if ("input" in o && o.input.kind === "txs" && o.input.txs.length === 0 && o.to === input.entityId) continue;
      queue.push(unwrap(convertOutput(rt, o, input.entityId, clock)));
    }
  }
  return rt;
};
const open = (to: EntityId, creditAmount?: bigint): EntityTx => ({ type: "openAccount", data: { targetEntityId: to, accountDomain: TERMS.domain, watchSeed: TERMS.watchSeed, disputeConfig: TERMS.disputeConfig, ...(creditAmount === undefined ? {} : { creditAmount, tokenId: unwrap(tokenId("1")) }) } } as EntityTx);
const network = (): Runtime => {
  let rt = spawn(spawn(spawn(createRuntime(), entityOf(ALICE)), entityOf(BOB)), entityOf(CAROL));
  rt = quiet(rt, [inputOf(BOB, [open(ALICE, 1000n), open(CAROL)], NOW)]);
  return quiet(rt, [inputOf(CAROL, [{ type: "extendCredit", data: { counterpartyEntityId: BOB, tokenId: unwrap(tokenId("1")), amount: 1000n } }], NOW + 100n)]);
};
const replicaOf = (rt: Runtime, id: EntityId): EntityReplica => rt.entities.get(replicaKey(id, SIGNERS.get(id)!))!;
const profile = (id: EntityId, accounts: readonly { counterpartyId: string; domain: unknown; tokenCapacities: Map<number, { inCapacity: bigint; outCapacity: bigint }> }[], meta: object = {}): Binary =>
  ({ entityId: id, entityEncryptionPublicKey: ENTITY_KEYS.get(id)!.pub, name: id.slice(-4), metadata: { isHub: false, routingFeePPM: 100, baseFee: 0n, ...meta }, accounts }) as unknown as Binary;
const caps = (inC: bigint, outC: bigint) => new Map([[1, { inCapacity: inC, outCapacity: outC }]]);
const baseProfiles = (): Binary[] => [
  profile(ALICE, []), profile(BOB, [{ counterpartyId: ALICE, domain: TERMS.domain, tokenCapacities: caps(1000n, 0n) }, { counterpartyId: CAROL, domain: TERMS.domain, tokenCapacities: caps(0n, 1000n) }], { routingFeePPM: 5000, baseFee: 1n, isHub: true }), profile(CAROL, []),
];
const ogStateOf = (r: EntityReplica, timestamp: number) => ({
  entityId: r.state.id, timestamp, lastFinalizedJHeight: 0, entityEncryptionPublicKey: String(r.state.committed["entityEncryptionPublicKey"]), paybook: { entries: new Map(), feesEarned: 0n },
  accounts: new Map([...r.accountReplicas].map(([peer, c]) => { const id = replicaId(c); return [peer, { status: "active", state: { domain: c.state.terms.domain, leftEntity: id.left, rightEntity: id.right, deltas: new Map() } }]; })),
});
/** og gossip getNetworkGraph().findPaths over the same profile map, as infra-context.ts resolveRoute calls it. */
const ogResolve = (profiles: readonly Binary[], source: string) => async (tx: { data: { targetEntityId: string; amount: bigint; tokenId: number } }): Promise<readonly string[]> => {
  const m = new Map<string, unknown>();
  for (const p of profiles as unknown as { entityId: string }[]) m.set(p.entityId, p);
  const routes = new PathFinder(ogBuildGraph(m as never, tx.data.tokenId)).findRoutes(source, tx.data.targetEntityId, tx.data.amount, tx.data.tokenId, 100);
  const path = routes[0]?.path;
  if (!path) throw new Error(`HTLC_PAYMENT_ROUTE_NOT_FOUND:${source}:${tx.data.targetEntityId}`);
  return path;
};

describe("entity-lane: htlcPayment route discovery (og infra-context.ts resolveRoute)", () => {
  const rt = network(), alice = replicaOf(rt, ALICE), ts = Number(NOW + 1000n);
  const view = { id: ALICE, timestamp: ts, jHeight: 0, encryptionKey: ENTITY_KEYS.get(ALICE)!.pub, paybook: { entries: new Map(), feesEarned: 0n }, replicas: alice.accountReplicas };
  test("MATCH: materializeOriginatedHtlcPayments with an empty route resolves og's route on 150 random profile sets and payments", async () => {
    const r = rng(43);
    let accepted = 0;
    for (let i = 0; i < 150; i++) {
      const profiles = baseProfiles() as any[];
      const mut = int(r, 10);
      if (mut === 1) profiles[1] = { ...profiles[1], metadata: { ...profiles[1].metadata, routingFeePPM: pick(r, [0, 1, 999_999]), baseFee: BigInt(int(r, 50)) } };
      if (mut === 2) profiles[1] = { ...profiles[1], accounts: profiles[1].accounts.slice(0, 1) };
      if (mut === 3) profiles[1] = { ...profiles[1], name: " " };
      if (mut === 4) profiles.pop();
      if (mut === 5) profiles[1] = { ...profiles[1], accounts: [profiles[1].accounts[0], { ...profiles[1].accounts[1], tokenCapacities: caps(0n, BigInt(int(r, 200))) }] };
      if (mut === 6) profiles[0] = { ...profiles[0], accounts: [{ counterpartyId: CAROL, domain: TERMS.domain, tokenCapacities: caps(0n, 5000n) }] };
      const over: Record<string, unknown> = { route: [] };
      const m2 = int(r, 10);
      if (m2 === 1) over.amount = BigInt(int(r, 3000)) + 1n;
      if (m2 === 2) over.targetEntityId = "0x" + CAROL.slice(2).toUpperCase();
      if (m2 === 3) over.tokenId = 2;
      if (m2 === 4) over.targetEntityId = ALICE;
      const secret = hex(r, 32);
      let tx = { type: "htlcPayment", data: { targetEntityId: CAROL, tokenId: 1, amount: 100n, maxSenderDebit: 5000n, deliveryMode: "instant", ...over } } as any;
      const registered = ogTry(() => withDeterministicHtlcTestSecret(tx, secret));
      if (registered.ok) tx = registered.value;
      const ogHash = ogTry(() => ogAdmission.hashRawHtlcPaymentTx(tx));
      const og = await ogTryAsync(() => ogAdmission.materializeOriginatedHtlcPayments({ state: ogStateOf(alice, ts) as never, proposalTxs: [tx], profiles: profiles as never, height: 1, resolveRoute: ogResolve(profiles, ALICE) as never }));
      const rw = materializeOriginated(view, profiles, [tx], { profiles, secretFor: (h) => (ogHash.ok && h === ogHash.value && registered.ok ? secret : undefined) });
      same(og, rw.refused.size === 0 ? { ok: true, value: rw.originated } : { ok: false }, `mat${i}`);
      if (og.ok) accepted++;
    }
    expect(accepted).toBeGreaterThan(40);
  });

  test("MATCH: Alice pays Carol with no route; the frame routes Alice -> Bob -> Carol like og and settles, Bob earning og's quoted fee", () => {
    const secret = "0x" + "42".repeat(32), profiles = baseProfiles();
    const tx = withDeterministicHtlcTestSecret({ type: "htlcPayment", data: { targetEntityId: CAROL, tokenId: 1, amount: 100n, maxSenderDebit: 200n, route: [], deliveryMode: "instant" } } as never, secret) as unknown as EntityTx;
    const txHash = ogAdmission.hashRawHtlcPaymentTx(tx as never);
    const ctx = { ...verifiers, htlcInfra: (id: EntityId) => ({ profiles, online: () => true, encryptionPrivateKey: ENTITY_KEYS.get(id)!.priv, ...(id === ALICE ? { secretFor: (h: string) => (h === txHash ? secret : undefined) } : {}) }) };
    const done = quiet(network(), [inputOf(ALICE, [tx], NOW + 1000n)], ctx);
    for (const id of [ALICE, BOB, CAROL]) expect([...(replicaOf(done, id).state.paybook?.entries ?? new Map()).keys()]).toEqual([]);
    const m = new Map<string, unknown>((profiles as unknown as { entityId: string }[]).map((p) => [p.entityId, p]));
    const route = new PathFinder(ogBuildGraph(m as never, 1)).findRoutes(ALICE, CAROL, 100n, 1)[0]!;
    expect(route.path).toEqual([ALICE, BOB, CAROL]);
    expect(replicaOf(done, BOB).state.paybook?.feesEarned).toBe(route.totalFee);
    const d = replicaOf(done, BOB).accountReplicas.get(CAROL)!.state.account.deltas.get(unwrap(tokenId("1")))!;
    expect(d.offdelta + d.ondelta).toBe(isLeft(BOB, replicaId(replicaOf(done, BOB).accountReplicas.get(CAROL)!)) ? -100n : 100n);
  });
});
