// Differential tests: og Entity-side HTLC onion routing and cross-j Entity handlers vs pure/xln.ts.
// Every test is "MATCH:" and runs og live on the same (seeded random) input.
import { describe, expect, test } from "bun:test";
import { x25519 } from "@noble/curves/ed25519";
import * as ogMr from "../../core/protocol/htlc/multi-recipient.ts";
import * as ogOnion from "../../core/protocol/htlc/codec/onion.ts";
import * as ogEnvelope from "../../core/protocol/htlc/codec/envelope.ts";
import * as ogUtils from "../../core/protocol/htlc/utils.ts";
import * as ogQuote from "../../core/pathfinding/htlc-quote.ts";
import * as ogFees from "../../core/pathfinding/fees.ts";
import { resolvePaymentDeadlineWindow } from "../../core/protocol/payments/delivery.ts";
import {
  createOnionEnvelopes, decodeOnionLayer, decryptOpaqueHtlc, directionalFeePpm, encodeOnionLayer, encryptOpaqueHtlc, htlcEnvelopeContextHash, hopRevealHeight, hopTimelock,
  paymentDeadlineWindow, quoteHtlcRoute, requiredInbound, routingIndex, stableJson, type HtlcEnvelope, type OnionLayer, type RoutingProfile,
} from "../xln.ts";

export const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
type Rand = () => number;
const pick = <T,>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
const int = (r: Rand, n: number): number => Math.floor(r() * n);
const hex = (r: Rand, bytes: number): string => "0x" + Array.from({ length: bytes }, () => int(r, 256).toString(16).padStart(2, "0")).join("");
const bytes = (r: Rand, n: number): Uint8Array => Uint8Array.from({ length: n }, () => int(r, 256));
const ogTry = <T,>(f: () => T): { ok: true; value: T } | { ok: false } => { try { return { ok: true, value: f() }; } catch { return { ok: false }; } };
const ogTryAsync = async <T,>(f: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> => { try { return { ok: true, value: await f() }; } catch { return { ok: false }; } };
const same = (og: { ok: boolean; value?: unknown }, rw: { ok: boolean; value?: unknown }, label: string): void => {
  expect(`${label}:${rw.ok}`).toBe(`${label}:${og.ok}`);
  if (og.ok && rw.ok) expect(stableJson(rw.value)).toBe(stableJson(og.value));
};
const keyPair = (r: Rand) => { const priv = x25519.utils.randomPrivateKey(); priv.set(bytes(r, 32)); return { priv: "0x" + Buffer.from(priv).toString("hex"), pub: "0x" + Buffer.from(x25519.getPublicKey(priv)).toString("hex") }; };

describe("entity-cross-j: HTLC onion crypto (og protocol/htlc/multi-recipient.ts)", () => {
  test("MATCH: encryptOpaqueHtlcBytes is byte-identical for the same ephemeral key; decryptOpaqueHtlcBytes agrees on 300 random (and tampered) inputs", () => {
    const r = rng(7);
    for (let i = 0; i < 300; i++) {
      const recipient = keyPair(r), eph = keyPair(r).priv, ctx = r() < 0.05 ? "0x12" : hex(r, 32);
      const plain = bytes(r, int(r, 200));
      const recipientKey = r() < 0.05 ? "0x" + "00".repeat(32) : r() < 0.05 ? recipient.pub.toUpperCase() : recipient.pub;
      const og = ogTry(() => ogMr.encryptOpaqueHtlcBytes(plain, recipientKey, ctx, eph));
      const rw = encryptOpaqueHtlc(plain, recipientKey, ctx, eph);
      same(og, rw, `enc${i}`);
      if (!og.ok || !rw.ok) continue;
      let env: HtlcEnvelope = rw.value;
      if (r() < 0.3) { const b = Buffer.from(env.ciphertext, "base64"); b[int(r, b.length)] ^= 1 << int(r, 8); env = { ...env, ciphertext: b.toString("base64") }; }
      const pub = r() < 0.1 ? keyPair(r).pub : recipient.pub, dctx = r() < 0.1 ? hex(r, 32) : ctx;
      same(ogTry(() => ogMr.decryptOpaqueHtlcBytes(env, pub, recipient.priv, dctx)), decryptOpaqueHtlc(env, pub, recipient.priv, dctx), `dec${i}`);
    }
  });
});

const randomLayer = (r: Rand): OnionLayer => {
  if (r() < 0.5) {
    const note = r() < 0.5 ? undefined : pick(r, ["", "hi", "invoice #1", "ünïcödé", "x".repeat(300)]);
    const at = r() < 0.5 ? undefined : pick(r, [1, 1_700_000_000_000, Number.MAX_SAFE_INTEGER, 0, -1, 1.5]);
    return { finalRecipient: true, secret: r() < 0.05 ? "0x1234" : hex(r, 32), ...(note === undefined ? {} : { description: note }), ...(at === undefined ? {} : { startedAtMs: at }) };
  }
  const env = ogMr.encryptOpaqueHtlcBytes(bytes(r, int(r, 50)), keyPair(r).pub, hex(r, 32), keyPair(r).priv);
  return { nextHop: pick(r, [hex(r, 32), "", "hub"]), innerEnvelope: env, forwardAmount: pick(r, ["1", "0", "-5", "abc", (2n ** 256n).toString(), (2n ** 256n - 1n).toString(), String(int(r, 1e9))]) };
};
describe("entity-cross-j: onion layer codec (og codec/onion.ts)", () => {
  test("MATCH: encodeOnionLayer bytes and decodeOnionLayer on 600 random layers, truncations and bit flips", () => {
    const r = rng(11);
    for (let i = 0; i < 600; i++) {
      const layer = randomLayer(r);
      const og = ogTry(() => ogOnion.encodeOnionLayer(layer as never)), rw = encodeOnionLayer(layer);
      expect(`${i}:${rw.ok}`).toBe(`${i}:${og.ok}`);
      if (!og.ok || !rw.ok) continue;
      expect(Buffer.from(rw.value).toString("hex")).toBe(Buffer.from(og.value).toString("hex"));
      let enc = rw.value.slice();
      const mode = int(r, 4);
      if (mode === 1) enc = enc.slice(0, int(r, enc.length));
      if (mode === 2 && enc.length > 0) enc[int(r, enc.length)] ^= 1 << int(r, 8);
      if (mode === 3) enc = Uint8Array.from([...enc, 0]);
      same(ogTry(() => ogOnion.decodeOnionLayer(enc)), decodeOnionLayer(enc), `dec${i}`);
    }
  });
});

describe("entity-cross-j: route economics (og pathfinding/htlc-quote.ts, fees.ts, protocol/htlc/utils.ts, payments/delivery.ts)", () => {
  test("MATCH: directional fee, required inbound, hop timelock/reveal and the payment deadline window on 500 random inputs", () => {
    const r = rng(3);
    for (let i = 0; i < 500; i++) {
      const base = pick(r, [0, 1, 7, 100, 999_999, 2_000_000, -3]), out = BigInt(int(r, 1e6)) - 10n, inn = BigInt(int(r, 1e6));
      expect(directionalFeePpm(base, out, inn)).toBe(ogFees.calculateDirectionalFeePPM(base, out, inn));
      const desired = BigInt(int(r, 1e9)) - 2n, ppm = pick(r, [0, 1, 50, 5000, 999_999]), fee = BigInt(pick(r, [0, 0, 1, 1000]));
      same(ogTry(() => ogUtils.calculateRequiredInboundForDesiredForward(desired, ppm, fee)), requiredInbound(desired, ppm, fee), `inb${i}`);
      const tl = BigInt(int(r, 1e12)), hop = int(r, 5);
      expect(hopTimelock(tl, hop)).toBe(ogUtils.calculateHopTimelock(tl, hop));
      expect(hopRevealHeight(100 + i, hop, 5)).toBe(ogUtils.calculateHopRevealHeight(100 + i, hop, 5));
      const mode = pick(r, ["instant", "async"] as const), jh = pick(r, [0, 5, int(r, 1e6), -1, 1.5]), ts = pick(r, [0, 1_700_000_000_000, -1]), hops = int(r, 30) + 1;
      same(ogTry(() => resolvePaymentDeadlineWindow({ mode, runtimeJHeight: jh as never, timestamp: ts as never, totalHops: hops })), paymentDeadlineWindow(mode, jh, ts, hops), `win${i}`);
    }
  });
  const domainOf = (r: Rand) => ({ chainId: pick(r, [1, 31337]), depositoryAddress: hex(r, 20) });
  const profilesFor = (r: Rand, route: readonly string[], keys: ReadonlyMap<string, string>, tokenId: number): RoutingProfile[] => {
    const profiles = route.filter((id, i) => route.indexOf(id) === i).map((id): RoutingProfile => ({ entityId: id, accounts: [], entityEncryptionPublicKey: keys.get(id) ?? "", metadata: { ...(r() < 0.7 ? { routingFeePPM: pick(r, [0, 1, 100, 5000, 1e6]) } : {}), ...(r() < 0.5 ? { baseFee: BigInt(pick(r, [0, 1, 10])) } : {}) } }));
    const byId = new Map(profiles.map((p) => [p.entityId, p]));
    for (let i = 0; i + 1 < route.length; i++) {
      if (r() < 0.03) continue;
      const owner = r() < 0.5 ? route[i]! : route[i + 1]!, peer = owner === route[i] ? route[i + 1]! : route[i]!;
      const caps = new Map(r() < 0.03 ? [] : [[tokenId, { inCapacity: BigInt(int(r, 1e9)), outCapacity: BigInt(int(r, 1e9)) }] as const]);
      const p = byId.get(owner)!;
      byId.set(owner, { ...p, accounts: [...p.accounts, { counterpartyId: peer, domain: domainOf(r), tokenCapacities: caps }] });
    }
    return [...byId.values(), ...(r() < 0.03 ? [byId.get(route[1]!)!] : [])];
  };
  const ogProfiles = (ps: readonly RoutingProfile[]) => ps.map((p) => ({ ...p, accounts: p.accounts.map((a) => ({ ...a, tokenCapacities: new Map(a.tokenCapacities) })), metadata: { ...p.metadata } }));
  test("MATCH: quoteHtlcPaymentRouteWithIndex on 300 random routes and gossip profiles (missing lanes, mirrored lanes, duplicate profiles)", () => {
    const r = rng(5);
    for (let i = 0; i < 300; i++) {
      const route = Array.from({ length: 2 + int(r, 5) }, () => hex(r, 32)), tokenId = pick(r, [1, 2, 3]);
      const ps = profilesFor(r, route, new Map(), tokenId), amount = BigInt(int(r, 1e9)) + 1n;
      const og = ogTry(() => ogQuote.quoteHtlcPaymentRouteWithIndex(ogQuote.buildRoutingProfileIndex(ogProfiles(ps) as never), route, tokenId, amount));
      const rw = quoteHtlcRoute(routingIndex(ps), route, tokenId, amount);
      same(og.ok ? { ok: true, value: { s: og.value.senderLockAmount, f: [...og.value.hopForwardAmounts] } } : og, rw.ok ? { ok: true, value: { s: rw.value.senderLockAmount, f: [...rw.value.hopForwardAmounts] } } : rw, `q${i}`);
    }
  });
  test("MATCH: computeHtlcEnvelopeContextHash and createOnionEnvelopes produce identical onions for 80 random routes (same ephemeral keys)", async () => {
    const r = rng(9);
    let accepted = 0;
    for (let i = 0; i < 80; i++) {
      const pairs = Array.from({ length: 2 + int(r, 4) }, () => ({ id: hex(r, 32), key: keyPair(r) }));
      const route = pairs.map((p) => p.id);
      if (r() < 0.1) route.push(route[0]!);
      const keys = new Map(pairs.map((p) => [p.id, r() < 0.02 ? "" : p.key.pub]));
      const domains = route.slice(1).map(() => domainOf(r));
      const forwards = new Map(route.slice(1, -1).map((id) => [id, BigInt(int(r, 1e6)) + 1n]));
      const binding = { hashlock: hex(r, 32), tokenId: pick(r, [1, 2]), senderLockAmount: BigInt(int(r, 1e7)) + 1n, timelock: BigInt(1_700_000_000_000 + int(r, 1e6)), revealBeforeHeight: 200 + int(r, 100) };
      const note = pick(r, [undefined, "", "pay"]), started = pick(r, [undefined, 1_700_000_000_000]), secret = hex(r, 32);
      const ephem = Array.from({ length: route.length }, () => keyPair(r).priv);
      const og = await ogTryAsync(() => ogEnvelope.createOnionEnvelopes(route, secret, keys, domains, forwards, note, started, binding, (k) => ephem[k]!));
      const rw = createOnionEnvelopes(route, secret, keys, domains, forwards, note, started, binding, (k) => ephem[k]!);
      same(og, rw, `onion${i}`);
      if (rw.ok) accepted++;
      const ctx = { fromEntityId: route[0]!, toEntityId: route[1]!, domain: domains[0]!, hashlock: binding.hashlock, tokenId: binding.tokenId, amount: binding.senderLockAmount, timelock: binding.timelock, revealBeforeHeight: binding.revealBeforeHeight };
      same(ogTry(() => ogEnvelope.computeHtlcEnvelopeContextHash(ctx)), htlcEnvelopeContextHash(ctx), `ctx${i}`);
      if (!rw.ok) continue;
      // Peel the whole onion with the rewrite and compare every layer with og's decoding.
      let env = rw.value;
      for (let hop = 1; hop < route.length; hop++) {
        const inbound = hop === 1 ? binding.senderLockAmount : forwards.get(route[hop - 1]!)!;
        const c = htlcEnvelopeContextHash({ ...ctx, fromEntityId: route[hop - 1]!, toEntityId: route[hop]!, domain: domains[hop - 1]!, amount: inbound, timelock: binding.timelock - BigInt(hop - 1) * 10_000n, revealBeforeHeight: binding.revealBeforeHeight - (hop - 1) * 3 });
        const pair = pairs.find((p) => p.id === route[hop])!;
        const plain = decryptOpaqueHtlc(env, pair.key.pub, pair.key.priv, (c as { value: string }).value);
        expect(plain.ok).toBe(true);
        const layer = decodeOnionLayer((plain as { value: Uint8Array }).value);
        expect(stableJson(layer)).toBe(stableJson({ ok: true, value: ogOnion.decodeOnionLayer((plain as { value: Uint8Array }).value) }));
        if (layer.ok && "innerEnvelope" in layer.value) env = layer.value.innerEnvelope; else break;
      }
    }
    expect(accepted).toBeGreaterThan(50);
  });
});

// ---- Entity htlcPayment (og entity/paybook/payment-admission.ts, tx/handlers/htlc/payment.ts) ----
import * as ogAdmission from "../../core/entity/paybook/payment-admission.ts";
import { withDeterministicHtlcTestSecret } from "../../core/protocol/htlc/test-secret-capability.ts";
import { handleHtlcPayment } from "../../core/entity/tx/handlers/htlc/payment.ts";
import { createBookIntentProgram, applyBookIntentProgram } from "../../core/entity/books/book-intents.ts";
import { validateHtlcPreparedInfraContext } from "../../core/entity/paybook/prepared-context-validation.ts";
import { entityCollectionCommitment as ogCollection } from "../../core/entity/state/persistent-collection-map.ts";
import { ALICE, BOB, CAROL, NOW, TERMS, aliceAddr, bobAddr, carolAddr, unwrap, verifiers } from "../xln_run.ts";
import {
  applyRuntime, assertOriginated, convertOutput, createEntity, createRuntime, entityCollectionCommitment, holds, htlcPaymentTxHash, isLeft, materializeOriginated, preparedOriginOf, replicaId, replicaKey, spawn, tokenId,
  validatePreparedHtlcPayment, wireTx, type AccountReplica, type Address, type Binary, type EntityId, type EntityReplica, type EntityTx, type HtlcFrameInfra, type PreparedOriginated, type RoutedEntityInput, type Runtime,
} from "../xln.ts";

const JUR = TERMS.domain;
const ENTITY_KEYS = new Map([ALICE, BOB, CAROL].map((id, i) => { const priv = new Uint8Array(32).fill(i + 7); return [id, { priv: "0x" + Buffer.from(priv).toString("hex"), pub: "0x" + Buffer.from(x25519.getPublicKey(priv)).toString("hex") }] as const; }));
const SIGNERS = new Map<EntityId, Address>([[ALICE, aliceAddr], [BOB, bobAddr], [CAROL, carolAddr]]);
const entityOf = (id: EntityId) => unwrap(createEntity({ id, jurisdiction: JUR, threshold: 1n, members: new Map([[SIGNERS.get(id)!, { shares: 1n }]]), committed: { entityEncryptionPublicKey: ENTITY_KEYS.get(id)!.pub } }));
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
/** Alice -- Bob -- Carol: Bob opens both Accounts and extends Alice 1000 of credit; Carol extends Bob 1000. */
const network = (): Runtime => {
  let rt = spawn(spawn(spawn(createRuntime(), entityOf(ALICE)), entityOf(BOB)), entityOf(CAROL));
  rt = quiet(rt, [inputOf(BOB, [open(ALICE, 1000n), open(CAROL)], NOW)]);
  return quiet(rt, [inputOf(CAROL, [{ type: "extendCredit", data: { counterpartyEntityId: BOB, tokenId: unwrap(tokenId("1")), amount: 1000n } }], NOW + 100n)]);
};
const replicaOf = (rt: Runtime, id: EntityId): EntityReplica => rt.entities.get(replicaKey(id, SIGNERS.get(id)!))!;
/** og AccountReplica view the admission code reads: status, domain, sides, deltas with holds. */
const ogAccount = (c: AccountReplica, status?: string) => {
  const id = replicaId(c);
  return {
    status: status ?? (c._tag === "preparing" ? "dispute_preparing" : c._tag === "disputed" ? "disputed" : "active"),
    state: { domain: c.state.terms.domain, leftEntity: id.left, rightEntity: id.right, deltas: new Map([...c.state.account.deltas].map(([tk, d]) => [Number(tk), { ...d, tokenId: Number(tk), leftAllowance: 0n, rightAllowance: 0n, leftHold: holds(c.state, tk, true), rightHold: holds(c.state, tk, false) }])) },
  };
};
const ogStateOf = (r: EntityReplica, timestamp: number, paybook = new Map<string, unknown>()) => ({
  entityId: r.state.id, timestamp, lastFinalizedJHeight: 0, entityEncryptionPublicKey: String(r.state.committed["entityEncryptionPublicKey"]),
  paybook: { entries: paybook, feesEarned: 0n }, accounts: new Map([...r.accountReplicas].map(([peer, c]) => [peer, ogAccount(c)])),
});
const profile = (id: EntityId, accounts: readonly { counterpartyId: string; domain: unknown; tokenCapacities: Map<number, { inCapacity: bigint; outCapacity: bigint }> }[], meta: object = {}): Binary =>
  ({ entityId: id, entityEncryptionPublicKey: ENTITY_KEYS.get(id)!.pub, name: id.slice(-4), metadata: { isHub: false, routingFeePPM: 100, baseFee: 0n, ...meta }, accounts }) as unknown as Binary;
const caps = (inC: bigint, outC: bigint) => new Map([[1, { inCapacity: inC, outCapacity: outC }]]);

describe("entity-cross-j: Entity htlcPayment origination (og payment-admission.ts + handlers/htlc/payment.ts)", () => {
  const rt = network(), alice = replicaOf(rt, ALICE), ts = Number(NOW + 1000n);
  const view = { id: ALICE, timestamp: ts, jHeight: 0, encryptionKey: ENTITY_KEYS.get(ALICE)!.pub, paybook: { entries: new Map(), feesEarned: 0n }, replicas: alice.accountReplicas };
  const baseProfiles = (): Binary[] => [
    profile(ALICE, []), profile(BOB, [{ counterpartyId: ALICE, domain: JUR, tokenCapacities: caps(1000n, 0n) }, { counterpartyId: CAROL, domain: JUR, tokenCapacities: caps(0n, 1000n) }], { routingFeePPM: 5000, baseFee: 1n }), profile(CAROL, []),
  ];
  const payment = (over: object = {}): EntityTx => ({ type: "htlcPayment", data: { targetEntityId: CAROL, tokenId: 1, amount: 100n, maxSenderDebit: 200n, route: [ALICE, BOB, CAROL], deliveryMode: "instant", ...over } } as EntityTx);

  test("MATCH: hashRawHtlcPaymentTx, materializeOriginatedHtlcPayments, assertOriginatedHtlcPayments and validatePreparedHtlcPayment on 250 random payments, profiles and paybooks", async () => {
    const r = rng(21);
    let accepted = 0;
    for (let i = 0; i < 250; i++) {
      const profiles = baseProfiles() as any[];
      const mut = int(r, 14);
      if (mut === 1) profiles[1] = { ...profiles[1], metadata: { ...profiles[1].metadata, routingFeePPM: pick(r, [0, 1, 999_999]), baseFee: BigInt(int(r, 50)) } };
      if (mut === 2) profiles[1] = { ...profiles[1], accounts: profiles[1].accounts.slice(0, 1) };
      if (mut === 3) profiles[1] = { ...profiles[1], accounts: [{ ...profiles[1].accounts[0], domain: { ...JUR, chainId: 999 } }, profiles[1].accounts[1]] };
      if (mut === 4) profiles[0] = { ...profiles[0], entityEncryptionPublicKey: ENTITY_KEYS.get(BOB)!.pub };
      if (mut === 5) profiles.pop();
      if (mut === 6) profiles.push(profiles[2]);
      if (mut === 7) profiles[2] = { ...profiles[2], accounts: [{ counterpartyId: BOB, domain: { ...JUR, depositoryAddress: "0x" + JUR.depositoryAddress.slice(2).toUpperCase() }, tokenCapacities: caps(5n, 5n) }] };
      if (mut === 8) profiles[1] = { ...profiles[1], accounts: profiles[1].accounts.map((a: any) => ({ ...a, tokenCapacities: new Map() })) };
      const over: Record<string, unknown> = {};
      const m2 = int(r, 16);
      if (m2 === 1) over.amount = BigInt(int(r, 3000));
      if (m2 === 2) over.maxSenderDebit = BigInt(int(r, 150));
      if (m2 === 3) over.route = [ALICE, CAROL];
      if (m2 === 4) over.route = [ALICE, "0x" + BOB.slice(2).toUpperCase(), CAROL];
      if (m2 === 5) over.route = [];
      if (m2 === 6) over.description = pick(r, ["pay", " pad", "x".repeat(300), ""]);
      if (m2 === 7) over.deliveryMode = pick(r, ["async", "direct"]);
      if (m2 === 8) over.startedAtMs = pick(r, [ts, ts + 1, 1.5]);
      if (m2 === 9) over.tokenId = pick(r, [2, -1, 70000]);
      if (m2 === 10) over.route = [ALICE, BOB, ALICE];
      if (m2 === 11) over.extra = 1;
      if (m2 === 12) over.amount = 0n;
      const secret = hex(r, 32);
      let tx = payment(over) as any;
      const registered = ogTry(() => withDeterministicHtlcTestSecret(tx, secret));
      if (registered.ok) tx = registered.value;
      if (r() < 0.05) tx = { ...tx, data: { ...tx.data, hashlock: hex(r, 32) } };
      const ogHash = ogTry(() => ogAdmission.hashRawHtlcPaymentTx(tx));
      same(ogHash, htlcPaymentTxHash(tx), `hash${i}`);
      const paybook = r() < 0.05 && registered.ok ? new Map([[tx.data.hashlock, { hashlock: tx.data.hashlock, createdTimestamp: 1 }]]) : new Map();
      const og = await ogTryAsync(() => ogAdmission.materializeOriginatedHtlcPayments({ state: ogStateOf(alice, ts, paybook) as never, proposalTxs: [tx], profiles: profiles as never, height: 1, resolveRoute: async () => { throw new Error("no route"); } }));
      const rw = materializeOriginated({ ...view, paybook: { entries: paybook as never, feesEarned: 0n } }, profiles, [tx], { profiles, secretFor: (h) => (ogHash.ok && h === ogHash.value && registered.ok ? secret : undefined) });
      same(og, rw.refused.size === 0 ? { ok: true, value: rw.originated } : { ok: false }, `mat${i}`);
      if (!og.ok || rw.refused.size > 0) continue;
      accepted++;
      const infra: HtlcFrameInfra = { gossipProfiles: profiles, peerAssertions: [], originated: rw.originated };
      // tamper one committed field of the prepared origin; og and the rewrite must agree on every variant
      const t = int(r, 8), o = rw.originated[0]!;
      const tampered: PreparedOriginated = t === 1 ? { ...o, senderLockAmount: o.senderLockAmount + 1n, totalFee: o.totalFee + 1n } : t === 2 ? { ...o, timelock: o.timelock - 1n } : t === 3 ? { ...o, revealBeforeHeight: o.revealBeforeHeight + 3 }
        : t === 4 ? { ...o, description: "other" } : t === 5 ? { ...o, hashlock: hex(r, 32) } : t === 6 ? { ...o, txHash: hex(r, 32) } : o;
      const frameCtx = { version: 1, entries: [], originated: [tampered] };
      same(ogTry(() => { validateHtlcPreparedInfraContext(frameCtx); return 1; }), preparedOriginOf(tampered as never) === null ? { ok: false } : { ok: true, value: 1 }, `shape${i}`);
      same(ogTry(() => ogAdmission.assertOriginatedHtlcPayments({ state: ogStateOf(alice, ts) as never, proposalTxs: [tx], profiles: profiles as never, height: 1, originated: [tampered] as never })),
        assertOriginated(view, { ...infra, originated: [tampered] }, [tx]), `assert${i}`);
      const status = pick(r, [undefined, undefined, "disputed"]);
      const ogS = { ...ogStateOf(alice, ts), accounts: new Map([[BOB, ogAccount(alice.accountReplicas.get(BOB)!, status)]]) };
      const rwReplicas = status === "disputed" ? new Map([[BOB, { ...alice.accountReplicas.get(BOB)!, _tag: "disputed" } as AccountReplica]]) : alice.accountReplicas;
      same(ogTry(() => ogAdmission.validatePreparedHtlcPayment(ogS as never, tx, { htlc: { version: 1, entries: [], originated: [tampered] } } as never)), validatePreparedHtlcPayment({ ...view, replicas: rwReplicas }, tx, { ...infra, originated: [tampered] }), `valid${i}`);
    }
    expect(accepted).toBeGreaterThan(60);
  });

  test("MATCH: Alice's frame commits og's prepared origin, her paybook entry and root equal og handleHtlcPayment's, and the first-hop htlc_lock is og's wire tx", async () => {
    const profiles = baseProfiles(), secret = "0x" + "42".repeat(32);
    const tx = withDeterministicHtlcTestSecret({ type: "htlcPayment", data: { targetEntityId: CAROL, tokenId: 1, amount: 100n, maxSenderDebit: 200n, route: [ALICE, BOB, CAROL], deliveryMode: "instant", description: "invoice 7" } } as never, secret) as unknown as EntityTx;
    const txHash = ogAdmission.hashRawHtlcPaymentTx(tx as never);
    const ctx = { ...verifiers, htlcInfra: (id: EntityId) => (id === ALICE ? { profiles, secretFor: (h: string) => (h === txHash ? secret : undefined), online: () => true } : undefined) };
    const step = unwrap(applyRuntime(rt, { runtimeTxs: [], entityInputs: [inputOf(ALICE, [tx], BigInt(ts))] }, ctx as never));
    expect(step.rejected.length).toBe(0);
    const after = replicaOf(step.runtime, ALICE);
    const og = await ogAdmission.materializeOriginatedHtlcPayments({ state: ogStateOf(alice, ts) as never, proposalTxs: [tx as never], profiles: profiles as never, height: 1, resolveRoute: async () => [] });
    // og handleHtlcPayment on the same prepared context: paybook entry and first-hop lock
    const program = createBookIntentProgram(), ogState = ogStateOf(alice, ts) as any;
    const handled = await handleHtlcPayment(ogState, tx as never, { quietRuntimeLogs: true } as never, [], true, { htlc: { version: 1, entries: [], originated: og } } as never, program.openSlot());
    applyBookIntentProgram(handled.newState, program);
    expect(stableJson([...(after.state.paybook?.entries ?? new Map())])).toBe(stableJson([...handled.newState.paybook.entries]));
    expect(stableJson(unwrap(entityCollectionCommitment(after.state.paybook!.entries as never, "paybookHashlock")))).toBe(stableJson(ogCollection(handled.newState.paybook.entries, false, "paybookHashlock")));
    const lock = step.outbox.find((o) => "tx" in o && o.tx.data.kind === "ack_frame");
    if (lock === undefined || !("tx" in lock) || lock.tx.data.kind !== "ack_frame") throw new Error("no first-hop frame");
    const child = after.accountReplicas.get(BOB)!;
    expect(stableJson(unwrap(wireTx(lock.tx.data.frame.txs[0] as never, replicaId(child), isLeft(ALICE, replicaId(child)))))).toBe(stableJson(handled.accountTxs[0]!.tx));
    // the committed Entity frame carries exactly og's prepared origin; replaying the same input reproduces the same outbox
    const committed = [...step.runtime.entities.values()].length;
    expect(committed).toBe(3);
    const replayed = unwrap(applyRuntime(rt, { runtimeTxs: [], entityInputs: [inputOf(ALICE, [tx], BigInt(ts))] }, ctx as never));
    expect(stableJson(replayed.outbox)).toBe(stableJson(step.outbox));
  });
});
