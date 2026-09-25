// Differential tests: og cross-jurisdiction extension (core/extensions/cross-j/**, core/protocol/htlc/hash-ladder.ts)
// vs the pure rewrite's cross-j kernel (pure/xln.ts). "MATCH:" tests assert equivalence against live og.
import { describe, expect, test } from "bun:test";
import * as ogLadder from "../../core/protocol/htlc/hash-ladder.ts";
import * as ogCross from "../../core/extensions/cross-j/index.ts";
import * as ogMarket from "../../core/extensions/cross-j/market.ts";
import { exactFillRatioToUint16 } from "../../core/orderbook/swap-execution.ts";
import {
  buildHashLadderProof,
  revealHashLadder,
  decodeHashLadderBinary,
  verifyHashLadderBinary,
  crossRouteHash,
  canonicalCrossRoute,
  crossMarket,
  crossBookOwner,
  crossPullId,
  crossPrivateSeed,
  crossSignedAmount,
  cloneCrossRoute,
  crossPullBinding,
  crossFillAmounts,
  crossFillProgress,
  applyCrossFill,
  buildCrossCloseProof,
  prepareCrossRoute,
  crossPullReveal,
  transitionCrossStatus,
  crossTransitionAllowed,
  compareCrossStatus,
  CROSS_STATUSES,
  stableJson,
  type CrossRoute,
} from "../xln.ts";

// Deterministic PRNG (mulberry32) so failures reproduce.
export const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
type Rand = () => number;
const pick = <T,>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
const hex = (r: Rand, bytes: number): string => "0x" + Array.from({ length: bytes }, () => Math.floor(r() * 256).toString(16).padStart(2, "0")).join("");
const big = (r: Rand, max: bigint): bigint => (BigInt(Math.floor(r() * 2 ** 52)) * BigInt(Math.floor(r() * 2 ** 20) + 1)) % max;

/** Outcome of an og call: thrown => reject. */
export const ogTry = <T,>(f: () => T): { ok: true; value: T } | { ok: false } => {
  try { return { ok: true, value: f() }; } catch { return { ok: false }; }
};
const same = (a: unknown, b: unknown) => expect(stableJson(a)).toBe(stableJson(b));
const agree = <T,>(og: { ok: true; value: T } | { ok: false }, rw: { ok: true; value: unknown } | { ok: false; error: unknown }) => {
  expect(rw.ok).toBe(og.ok);
  if (og.ok && rw.ok) same(rw.value, og.value);
};

export const STACKS = ["stack:1:0x" + "11".repeat(20), "stack:31337:0x" + "aB".repeat(20), "stack:8453:0x" + "cd".repeat(20)] as const;
export const ENTS = ["0x" + "01".repeat(32), "0x" + "02".repeat(32), "0x" + "03".repeat(32), "0x" + "fe".repeat(32)] as const;

export const randomRoute = (r: Rand): CrossRoute => {
  const sj = pick(r, STACKS), tj = r() < 0.2 ? sj : pick(r, STACKS);
  const [maker, hub] = [pick(r, ENTS), pick(r, ENTS)];
  const route: CrossRoute = {
    orderId: `order-${Math.floor(r() * 1e6)}`,
    makerEntityId: maker,
    hubEntityId: hub,
    source: { jurisdiction: r() < 0.03 ? "bogus" : sj, entityId: maker, counterpartyEntityId: hub, tokenId: pick(r, [1, 2, 3, 4]), amount: big(r, 10n ** 24n) + 1n },
    target: { jurisdiction: tj, entityId: hub, counterpartyEntityId: maker, tokenId: pick(r, [1, 2, 3, 4]), amount: big(r, 10n ** 24n) + 1n },
    sourceDisputeConfig: { leftResponseSeconds: pick(r, [0, 60, 3600, 86_400]), rightResponseSeconds: pick(r, [0, 60, 3600]) },
    targetDisputeConfig: { leftResponseSeconds: pick(r, [60, 7200]), rightResponseSeconds: pick(r, [60, 7200, 2 ** 33]) },
    status: pick(r, ["intent", "resting", "target_prepared"] as const),
    createdAt: 1_700_000_000_000 + Math.floor(r() * 1e6),
    updatedAt: 1_700_000_000_000 + Math.floor(r() * 1e6),
    ...(r() < 0.5 ? { expiresAt: 1_700_000_100_000 + Math.floor(r() * 1e7) } : {}),
    ...(r() < 0.3 ? { memo: `memo ${Math.floor(r() * 99)}` } : {}),
    ...(r() < 0.3 ? { priceTicks: big(r, 10n ** 12n) } : {}),
    ...(r() < 0.3 ? { clearingPolicy: pick(r, ["manual", "full_fill", "cancel_and_clear"] as const) } : {}),
    ...(r() < 0.3 ? { riskMode: pick(r, ["fully_collateralized", "credit_line"] as const) } : {}),
    ...(r() < 0.2 ? { sourceSignerId: "0x" + "aa".repeat(20), bookHubSignerId: "signer-" + Math.floor(r() * 9) } : {}),
  };
  return route;
};

describe("cross-j: hash ladder (core/protocol/htlc/hash-ladder.ts)", () => {
  test("MATCH: build/reveal/decode/verify agree with og across random seeds and ratios", () => {
    const r = rng(7);
    for (let i = 0; i < 40; i++) {
      const seed = hex(r, 32);
      const og = ogLadder.buildHashLadderProof(seed), rw = buildHashLadderProof(seed);
      same(rw, og);
      for (const ratio of [0, 1, 15, 16, 255, 4096, 65_534, 65_535, Math.floor(r() * 65_536)]) {
        const ogr = ogLadder.revealHashLadder(og, ratio), rwr = revealHashLadder(rw, ratio);
        same(rwr, ogr);
        agree(ogTry(() => ogLadder.decodeHashLadderBinary(ogr.binary)), decodeHashLadderBinary(rwr.binary));
        agree(ogTry(() => ogLadder.verifyHashLadderBinary(og, ogr.binary)), verifyHashLadderBinary(rw, rwr.binary));
        // Tamper one byte: both must reject (or both accept if tamper was a no-op).
        const bad = ogr.binary.slice(0, -2) + (ogr.binary.endsWith("00") ? "01" : "00");
        agree(ogTry(() => ogLadder.verifyHashLadderBinary(og, bad)), verifyHashLadderBinary(rw, bad));
      }
    }
  });
  test("MATCH: malformed binaries are rejected identically", () => {
    for (const b of [undefined, "", "0x", "0x00", "0x" + "00".repeat(33), "0x" + "00".repeat(34), "0xzz", "0x" + "11".repeat(130), "0x" + "ff".repeat(2) + "00".repeat(128)]) {
      agree(ogTry(() => ogLadder.decodeHashLadderBinary(b)), decodeHashLadderBinary(b));
    }
  });
});

describe("cross-j: route kernel (core/extensions/cross-j/index.ts, market.ts)", () => {
  test("MATCH: routeHash, canonical route, clone, market, book owner, pull ids, seeds agree with og", () => {
    const r = rng(11);
    for (let i = 0; i < 150; i++) {
      const route = randomRoute(r);
      const ogRoute = route as never;
      agree(ogTry(() => ogCross.deriveCrossJurisdictionRouteHash(ogRoute)), crossRouteHash(route));
      agree(ogTry(() => ogCross.withCanonicalCrossJurisdictionRouteHash(ogRoute)), canonicalCrossRoute(route));
      agree(ogTry(() => ogCross.cloneCrossJurisdictionRoute(ogRoute)), cloneCrossRoute(route));
      agree(ogTry(() => ogMarket.deriveCanonicalCrossJurisdictionMarket(ogRoute)), crossMarket(route));
      agree(ogTry(() => ogMarket.deriveCanonicalCrossJurisdictionBookOwner(ogRoute)), crossBookOwner(route));
      for (const leg of ["source", "target"] as const) {
        agree(ogTry(() => ogCross.deriveCrossJurisdictionPullId(ogRoute, leg)), crossPullId(route, leg));
        agree(ogTry(() => ogCross.buildCrossJurisdictionPullBinding(ogRoute, leg)), crossPullBinding(route, leg));
      }
      const seed = r() < 0.1 ? undefined : hex(r, 32);
      agree(ogTry(() => ogCross.deriveCrossJurisdictionPrivateSeed(seed, ogRoute)), crossPrivateSeed(seed, route));
      expect(crossSignedAmount(route.source.entityId, route.source.counterpartyEntityId, 5n)).toBe(ogCross.signedCrossJurisdictionAmountForBeneficiary(route.source.entityId, route.source.counterpartyEntityId, 5n));
    }
  });

  test("MATCH: prepared route, close proof, pull reveal agree with og", () => {
    const r = rng(23);
    for (let i = 0; i < 80; i++) {
      const route = randomRoute(r), seed = r() < 0.05 ? undefined : hex(r, 32);
      const now = r() < 0.05 ? 0 : 1_700_000_050_000 + Math.floor(r() * 1e5);
      const og = ogTry(() => ogCross.buildPreparedCrossJurisdictionRoute(route as never, { runtimeSeed: seed, now }));
      const rw = prepareCrossRoute(route, { runtimeSeed: seed, now });
      agree(og, rw);
      if (!og.ok || !rw.ok) continue;
      const binary = hex(r, Math.floor(r() * 40));
      agree(ogTry(() => ogCross.buildCrossJurisdictionCloseProof(og.value, binary)), buildCrossCloseProof(rw.value, binary));
      const ratio = Math.floor(r() * 65_536);
      if (seed !== undefined) {
        const s = ogCross.deriveCrossJurisdictionPrivateSeed(seed, og.value);
        agree(ogTry(() => ogCross.buildCrossJurisdictionPullReveal(og.value, ratio, s)), crossPullReveal(ratio, s));
      }
    }
  });

  test("MATCH: fill progress validation / apply / committed amounts agree with og", () => {
    const r = rng(31);
    let accepted = 0;
    for (let i = 0; i < 400; i++) {
      const base = randomRoute(r);
      const consistent = r() < 0.6;
      const d = 1000n, n1 = BigInt(Math.floor(r() * 600)), n2 = n1 + BigInt(Math.floor(r() * 500) - 50);
      const scale = (t: bigint, n: bigint) => (n >= d ? t : (t * n) / d);
      const route: CrossRoute = consistent
        ? { ...base, status: "partially_filled", fillSeq: 2, fillNumerator: n1, fillDenominator: d, cumulativeFillRatio: exactFillRatioToUint16({ numerator: n1, denominator: d }),
            filledSourceAmount: scale(base.source.amount, n1), ...(r() < 0.8 ? { filledTargetAmount: scale(base.target.amount, n1) } : {}) }
        : {
        ...base,
        status: pick(r, ["resting", "partially_filled", "clearing", "settled"] as const),
        ...(r() < 0.5 ? { cumulativeFillRatio: Math.floor(r() * 65_536), fillSeq: Math.floor(r() * 4) } : {}),
        ...(r() < 0.3 ? { fillNumerator: big(r, 1000n), fillDenominator: pick(r, [0n, 1n, 1000n, 7n]) } : {}),
        ...(r() < 0.3 ? { filledSourceAmount: big(r, base.source.amount + 1n), filledTargetAmount: big(r, base.target.amount + 1n) } : {}),
      };
      agree(ogTry(() => ogCross.getCrossJurisdictionCommittedFillAmounts(route as never)), crossFillAmounts(route));
      const input = consistent && n2 > 0n && n2 <= d
        ? { fillSeq: r() < 0.9 ? 3 : 2, cumulativeFillRatio: exactFillRatioToUint16({ numerator: n2, denominator: d }) + (r() < 0.1 ? 1 : 0), fillNumerator: n2, fillDenominator: d,
            ...(r() < 0.5 ? { cumulativeSourceAmount: scale(base.source.amount, n2) + (r() < 0.1 ? 1n : 0n), incrementalTargetAmount: scale(base.target.amount, n2) - scale(base.target.amount, n1) } : {}) }
        : {
        fillSeq: r() < 0.9 ? (route.fillSeq ?? 0) + 1 : Math.floor(r() * 3),
        cumulativeFillRatio: Math.floor(r() * 65_536),
        ...(r() < 0.5 ? { fillNumerator: big(r, 100n), fillDenominator: pick(r, [1n, 100n, 3n]) } : {}),
        ...(r() < 0.5 ? { incrementalSourceAmount: big(r, base.source.amount), incrementalTargetAmount: big(r, base.target.amount) } : {}),
        ...(r() < 0.5 ? { cumulativeSourceAmount: big(r, base.source.amount + 1n), cumulativeTargetAmount: big(r, base.target.amount + 1n) } : {}),
      };
      // og returns {ok:false} for soft rejects and throws for hard ones; both are rejects.
      const ogv = ogTry(() => { const v = ogCross.validateCrossJurisdictionFillProgress(route as never, input as never); if (!v.ok) throw new Error(v.error); return v.value; });
      agree(ogv, crossFillProgress(route, input));
      if (ogv.ok) accepted++;
      agree(ogTry(() => ogCross.applyCrossJurisdictionFillProgress(route as never, input as never, 99, "X")), applyCrossFill(route, input, 99));
    }
    expect(accepted).toBeGreaterThan(10);
  });

  test("MATCH: status transitions agree with og", () => {
    for (const a of [undefined, ...CROSS_STATUSES]) for (const b of CROSS_STATUSES) {
      expect(crossTransitionAllowed(a, b)).toBe(ogCross.isCrossJurisdictionRouteTransitionAllowed(a, b));
      expect(compareCrossStatus(a, b)).toBe(ogCross.compareCrossJurisdictionRouteStatus(a, b));
      if (a === undefined) continue;
      const route = { ...randomRoute(rng(1)), status: a };
      agree(ogTry(() => ogCross.transitionCrossJurisdictionRouteStatus(route as never, b, 5)), transitionCrossStatus(route, b, 5));
    }
  });
});
