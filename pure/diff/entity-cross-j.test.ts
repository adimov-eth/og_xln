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
