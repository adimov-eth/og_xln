// Behavioural diff: og disputes and cross-j recovery (core/protocol/dispute/proof-builder.ts, entity/tx/handlers/dispute/*, entity/tx/j-events*.ts) vs pure/xln.ts.
// "MATCH:" tests run og live on the same inputs and assert the same accept / reject, state and bytes.
import { describe, expect, test } from "bun:test";
import {
  accountProofBody, committedView, deltaTransformerFor, disputeArguments, knownDisputeSecrets, proofBodyHash, starterSecrets, tokenId,
  type AccountBody, type HtlcLock, type JReplica, type Paybook, type PaybookEntry, type PullRow, type SwapOffer, type TokenId, type WireAccountTx,
} from "../xln.ts";
import { TERMS, TEST_CONTRACTS, genesisAB, unwrap } from "../xln_run.ts";
import { buildAccountProofBody } from "../../core/protocol/dispute/proof-builder.ts";
import { requireAccountDeltaTransformerAddress } from "../../core/account/consensus/helpers.ts";
import { buildDisputeArgumentsFromState } from "../../core/protocol/dispute/arguments.ts";
import { collectKnownDisputeSecretsForState } from "../../core/entity/dispute-arguments.ts";
import { decodeDisputeStarterInitialSecrets } from "../../core/entity/tx/j-events-htlc/index.ts";
import { ethers } from "ethers";
import {
  applyCrossFill, countDeferredReveals, crossPrivateSeed, crossPullReveal, decodeHashLadderBinary, flushDeferredReveals, initJBatch, prepareCrossRoute, queueLadderReveal, stableJson,
  type CjAccount, type CjHost, type CjJBatch, type CrossRoute, type EntityError, type EntityId, type Result,
} from "../xln.ts";
import * as ogCrossIndex from "../../core/extensions/cross-j/index.ts";
import { ensureEntityCollectionCandidate } from "../../core/entity/state/persistent-collection-map.ts";
import { countDeferredHashLadderReveals, flushDeferredHashLadderReveals, queueHashLadderRevealRegistration } from "../../core/entity/tx/j-events-htlc/index.ts";

let seed = 29;
const rng = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (n: number): number => Math.floor(rng() * n);
const pick = <T>(xs: readonly T[]): T => xs[ri(xs.length)] as T;
const big = (bits: number): bigint => { let v = 0n; for (let i = 0; i < bits; i += 16) v = (v << 16n) | BigInt(ri(0x10000)); return v & ((1n << BigInt(bits)) - 1n); };
const hex32 = (): string => `0x${Array.from({ length: 64 }, () => "0123456789abcdef"[ri(16)]).join("")}`;
const ogThrows = <T>(f: () => T): { ok: true; value: T } | { ok: false; reason: string } => { try { return { ok: true, value: f() }; } catch (e) { return { ok: false, reason: String((e as Error).message) }; } };
const DT = TEST_CONTRACTS.deltaTransformer;
const tk = (n: number): TokenId => unwrap(tokenId(String(n)));

/** A random Account body: token rows, locks, same- and cross-j swap offers and pulls (some naming a missing token or an invalid timelock). */
const randomBody = (): AccountBody => {
  const base = genesisAB().state, tokens = [1, 2, 3, 4, 5, 6].filter(() => rng() < 0.6);
  const deltas = new Map(tokens.map((t) => [tk(t), { tokenId: tk(t), collateral: big(60), ondelta: big(90) - big(90), offdelta: big(90) - big(90), leftCreditLimit: 0n, rightCreditLimit: 0n }] as const));
  const token = (): number => (rng() < 0.03 || tokens.length === 0 ? 7 : pick(tokens));
  const amount = (): bigint => (rng() < 0.04 ? (1n << 255n) + big(200) : 1n + big(pick([8, 64, 128])));
  const scale = pick([0, 1, 4, 20, 40, 70]);
  const id = (p: string): string => `${p}${pick(["", "0x", "Z", "a"])}${ri(10_000)}`;
  const locks = new Map<string, HtlcLock>(Array.from({ length: ri(scale + 1) }, () => {
    const lockId = id("lock"), timelock = rng() < 0.03 ? pick([0n, 1n, 1000n, 1001n]) : 1_700_000_000_000n + big(30);
    return [lockId, { lockId, hashlock: hex32(), timelock, revealBeforeHeight: 10n, amount: amount(), tokenId: tk(token()), senderIsLeft: rng() < 0.5, createdHeight: 1n, createdTimestamp: 1n }] as const;
  }));
  const offers = new Map<string, SwapOffer>(Array.from({ length: ri(scale + 1) }, () => {
    const offerId = id("offer"), cross = rng() < 0.1;
    return [offerId, { offerId, giveTokenId: tk(token()), giveTokenDecimals: 18, giveAmount: amount(), wantTokenId: tk(token()), wantTokenDecimals: 6, wantAmount: amount(), maxFee: 0n, minNetReceive: 0n, priceTicks: 1n,
      makerIsLeft: rng() < 0.5, createdHeight: 1, quantizedGive: 1n, quantizedWant: 1n, ...(cross ? { crossJurisdiction: {} as never } : {}) }] as const;
  }));
  const pulls = new Map<string, PullRow>(Array.from({ length: ri(Math.ceil(scale / 2) + 1) }, () => {
    const pullId = id("pull"), leg = pick(["source", "target"] as const);
    return [pullId, { pullId, tokenId: token(), amount: rng() < 0.5 ? amount() : -amount(), claimedRatio: pick([0, 1, 65535, 70000, -3, 12.7, ri(65536)]), claimedAmount: 0n, fullHash: hex32(), partialRoot: hex32(),
      crossJurisdiction: { orderId: "o", routeHash: hex32(), leg }, createdHeight: 1, createdTimestamp: 1 }] as const;
  }));
  return { ...base, account: { ...base.account, deltas }, locks, offers, pulls };
};
/** The og AccountReplica fields buildAccountProofBody reads. */
const ogReplicaOf = (b: AccountBody): any => ({
  state: {
    watchSeed: b.terms.watchSeed, disputeConfig: b.terms.disputeConfig,
    deltas: new Map([...b.account.deltas].map(([t, d]) => [Number(t), { ...d, tokenId: Number(t) }])),
    locks: new Map([...b.locks].map(([k, l]) => [k, { ...l, tokenId: Number(l.tokenId) }])),
    swapOffers: new Map([...b.offers].map(([k, o]) => [k, { ...o, giveTokenId: Number(o.giveTokenId), wantTokenId: Number(o.wantTokenId) }])),
    pulls: new Map(b.pulls ?? []),
  },
});

describe("disputes-final: Account ProofBody transformers (og protocol/dispute/proof-builder.ts buildAccountProofBody)", () => {
  test("MATCH: 600 random Accounts with locks, swaps and pulls -- the same ProofBody hash, transformer clauses and allowances, or og's refusal code", () => {
    const seen = new Map<string, number>();
    for (let i = 0; i < 600; i++) {
      const body = randomBody();
      const og = ogThrows(() => buildAccountProofBody(ogReplicaOf(body), DT));
      const rw = accountProofBody(unwrap(committedView(body)), { ok: true, value: DT });
      const key = og.ok ? `ok:${og.value.proofBodyStruct.transformers.length > 1 ? "chunked" : og.value.proofBodyStruct.transformers.length}` : og.reason.split(":")[0]!;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      if (!og.ok) { expect([i, rw.ok ? "accepted" : rw.error._tag === "transformer" ? rw.error.code : rw.error._tag]).toEqual([i, og.reason]); continue; }
      expect([i, rw.ok]).toEqual([i, true]);
      if (!rw.ok) continue;
      expect(proofBodyHash(rw.value)).toBe(og.value.proofBodyHash);
      expect(rw.value.transformers.map((c) => ({ ...c, allowances: c.allowances.map((a) => ({ ...a })) }))).toEqual(og.value.proofBodyStruct.transformers.map((c: any) => ({
        transformerAddress: String(c.transformerAddress), encodedBatch: String(c.encodedBatch), allowances: c.allowances.map((a: any) => ({ deltaIndex: BigInt(a.deltaIndex), rightAllowance: BigInt(a.rightAllowance), leftAllowance: BigInt(a.leftAllowance) })),
      })));
    }
    for (const k of ["ok:0", "ok:1", "ok:chunked", "HTLC_LOCK_INVALID_TIMELOCK", "PROOF_BODY_LOCK_TOKEN_MISSING", "PROOF_BODY_SWAP_TOKEN_MISSING", "PROOF_BODY_PULL_TOKEN_MISSING"]) expect([k, (seen.get(k) ?? 0) > 0]).toEqual([k, true]);
  });

  test("MATCH: more than 32 clauses is og's J_DISPUTE_PROOFBODY_TRANSFORMER_LIMIT; a body with clauses and no resolvable stack is og's ACCOUNT_PROOF_JURISDICTION_NOT_FOUND", () => {
    const base = genesisAB().state, t1 = tk(1);
    const many: AccountBody = { ...base, account: { ...base.account, deltas: new Map([[t1, { tokenId: t1, collateral: 0n, ondelta: 0n, offdelta: 0n, leftCreditLimit: 0n, rightCreditLimit: 0n }]]) },
      locks: new Map(Array.from({ length: 33 * 31 }, (_, i) => [`l${String(i).padStart(5, "0")}`, { lockId: `l${i}`, hashlock: hex32(), timelock: 1_800_000_000_000n, revealBeforeHeight: 1n, amount: 1n, tokenId: t1, senderIsLeft: true, createdHeight: 1n, createdTimestamp: 1n }] as const)) };
    const og = ogThrows(() => buildAccountProofBody(ogReplicaOf(many), DT)), rw = accountProofBody(unwrap(committedView(many)), { ok: true, value: DT });
    expect(og.ok).toBe(false);
    expect(rw.ok ? "accepted" : rw.error._tag === "transformer" ? rw.error.code : rw.error._tag).toBe((og as { reason: string }).reason);
    const one: AccountBody = { ...many, locks: new Map([...many.locks].slice(0, 1)) };
    const ogMissing = ogThrows(() => requireAccountDeltaTransformerAddress({ jReplicas: new Map() }, { domain: TERMS.domain }));
    const rwMissing = accountProofBody(unwrap(committedView(one)));
    expect(rwMissing.ok ? "accepted" : rwMissing.error._tag === "transformer" ? rwMissing.error.code : "").toBe((ogMissing as { reason: string }).reason);
  });

  test("MATCH: requireAccountDeltaTransformerAddress on 500 random jReplica sets -- the same DeltaTransformer or og's NOT_FOUND / AMBIGUOUS / DURABLE_STACK code", () => {
    const addr = (): string | undefined => pick([undefined, "", `0x${"00".repeat(20)}`, `0x${"ab".repeat(20)}`, `0x${"Cd".repeat(20)}`, "0xnot", `0x${"12".repeat(20)}`]);
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const replicas = new Map<string, JReplica>(Array.from({ length: ri(4) }, (_, k) => [`j${k}`, {
        name: `j${k}`, blockNumber: 0n, stateRoot: null, mempool: [], blockDelayMs: 0, lastBlockTimestamp: 0, position: { x: 0, y: 0, z: 0 },
        chainId: pick([TERMS.domain.chainId, TERMS.domain.chainId, 1, undefined as never]),
        contracts: { depository: pick([TERMS.domain.depositoryAddress, TERMS.domain.depositoryAddress.toUpperCase().replace("0X", "0x"), `0x${"99".repeat(20)}`]), entityProvider: rng() < 0.8 ? TEST_CONTRACTS.entityProvider : addr(), account: rng() < 0.8 ? TEST_CONTRACTS.account : addr(), deltaTransformer: rng() < 0.7 ? pick([DT, `0x${"AB".repeat(20)}`]) : addr() },
      }] as const));
      const og = ogThrows(() => requireAccountDeltaTransformerAddress({ jReplicas: replicas as never }, { domain: TERMS.domain }));
      const rw = deltaTransformerFor(replicas, TERMS.domain);
      seen.add(og.ok ? "ok" : og.reason.split(":")[0]!);
      expect([i, rw.ok ? rw.value : rw.error]).toEqual([i, og.ok ? og.value : og.reason]);
    }
    for (const k of ["ok", "ACCOUNT_PROOF_JURISDICTION_NOT_FOUND", "ACCOUNT_PROOF_JURISDICTION_AMBIGUOUS", "JURISDICTION_DURABLE_STACK_DELTA_TRANSFORMER_MISSING"]) expect([k, seen.has(k)]).toEqual([k, true]);
  });
});

describe("disputes-final: dispute arguments (og protocol/dispute/arguments.ts, entity/dispute-arguments.ts, j-events-htlc decodeDisputeStarterInitialSecrets)", () => {
  const secretOf = (): { secret: string; hashlock: string } => { const secret = hex32(); return { secret, hashlock: ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [secret])).toLowerCase() }; };
  test("MATCH: 500 random frozen Accounts with swap_resolve evidence and paybook secrets -- the same known secrets and left/right arguments as og", () => {
    let withArgs = 0, withSecrets = 0;
    for (let i = 0; i < 500; i++) {
      const base = randomBody(), tokens = [...base.account.deltas.keys()], small = (): bigint => 1n + big(64);
      if (tokens.length === 0) continue;
      const known = Array.from({ length: ri(4) }, secretOf), peer = pick(["0xpeer", "0xother"]);
      // keep the proof valid: every item names a present token, a valid timelock and a small amount
      const locks = new Map([...base.locks].map(([k, l]) => [k, { ...l, tokenId: pick(tokens), timelock: 1_700_000_000_000n, amount: small(), ...(rng() < 0.4 && known.length > 0 ? { hashlock: pick(known).hashlock } : {}) }] as const));
      const offers = new Map([...base.offers].map(([k, o]) => [k, { ...o, giveTokenId: pick(tokens), wantTokenId: pick(tokens), giveAmount: small(), wantAmount: small() }] as const));
      const pulls = new Map([...(base.pulls ?? [])].map(([k, q]) => [k, { ...q, tokenId: Number(pick(tokens)), amount: rng() < 0.5 ? small() : -small() }] as const));
      const body: AccountBody = { ...base, locks, offers, pulls };
      const og = ogThrows(() => buildAccountProofBody(ogReplicaOf(body), DT));
      if (!og.ok) continue;
      const entries = new Map<string, PaybookEntry>([...known, secretOf()].map((k) => [k.hashlock, { hashlock: rng() < 0.9 ? k.hashlock : hex32(), secret: rng() < 0.9 ? k.secret : hex32(), createdTimestamp: 1,
        ...(rng() < 0.5 ? { inboundEntity: pick(["0xpeer", "0xother", "0xPEER"]) } : { outboundEntity: pick(["0xpeer", "0xother"]) }) }] as const));
      const paybook: Paybook = { entries, feesEarned: 0n };
      const offerIds = [...body.offers.keys()], side = pick(["left", "right", "none"] as const);
      const evidence: WireAccountTx[] = Array.from({ length: ri(6) }, () => ({ type: "swap_resolve", offerId: rng() < 0.8 && offerIds.length > 0 ? pick(offerIds) : "zz", fillRatio: pick([0, 1, 777, 65535, 65536, 1.5, -1, ri(65536)]), cancelRemainder: false }) as WireAccountTx);
      const ogAccount = { ...ogReplicaOf(body), mempool: evidence.map((tx) => ({ type: tx.type, data: { ...tx, type: undefined } })) };
      const ogSecrets = collectKnownDisputeSecretsForState(ogAccount, { paybook: { entries } } as never, peer);
      const view = unwrap(committedView(body)), rwSecrets = knownDisputeSecrets(view, paybook, peer);
      expect([i, rwSecrets]).toEqual([i, ogSecrets]);
      const ogArgs = buildDisputeArgumentsFromState(ogAccount, { secretsSide: side }, ogSecrets);
      const rw = unwrap(disputeArguments(view, evidence, side, rwSecrets));
      expect([i, rw.left, rw.right]).toEqual([i, ogArgs.leftArguments, ogArgs.rightArguments]);
      if (rw.left !== "0x" || rw.right !== "0x") withArgs += 1;
      if (ogSecrets.length > 0) withSecrets += 1;
      const starter = rw.left !== "0x" ? rw.left : rw.right;
      const mutated = starter === "0x" ? starter : pick([starter, starter.slice(0, starter.length - 2 * ri(80) - 2), `${starter.slice(0, 2 + 2 * ri((starter.length - 2) / 2))}ff${starter.slice(4 + 2 * ri(1))}`.slice(0, starter.length), `${starter}00`, starter.toUpperCase().replace("0X", "0x")]);
      expect([i, starterSecrets(mutated)]).toEqual([i, decodeDisputeStarterInitialSecrets(mutated)]);
    }
    expect(withArgs).toBeGreaterThan(30);
    expect(withSecrets).toBeGreaterThan(10);
  }, 60_000);
  test("MATCH: decodeDisputeStarterInitialSecrets on 800 random / corrupted argument blobs", () => {
    const enc = ethers.AbiCoder.defaultAbiCoder();
    for (let i = 0; i < 800; i++) {
      const clause = enc.encode(["tuple(uint16[] fillRatios, bytes32[] secrets)"], [{ fillRatios: Array.from({ length: ri(3) }, () => ri(65536)), secrets: Array.from({ length: ri(4) }, hex32) }]);
      let blob = enc.encode(["bytes[]"], [[pick([clause, "0x", clause]), ...(rng() < 0.3 ? [clause] : [])]]);
      const bytes = ethers.getBytes(blob);
      for (let k = ri(3); k > 0; k--) { const at = ri(bytes.length); bytes[at] = pick([0, 0xff, ri(256)]); }
      blob = rng() < 0.3 ? ethers.hexlify(bytes) : blob;
      if (rng() < 0.1) blob = blob.slice(0, 2 + 2 * ri((blob.length - 2) / 2));
      if (rng() < 0.05) blob = pick(["", "0x", "zz", "0x0", undefined as never]);
      expect([i, starterSecrets(blob)]).toEqual([i, decodeDisputeStarterInitialSecrets(blob)]);
    }
  });
});

// ---- cross-j recovery: the hash-ladder reveal queue (og entity/tx/j-events-htlc/index.ts) ----
const xrng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
type Rand = () => number;
const xint = (r: Rand, n: number): number => Math.floor(r() * n);
const xpick = <T,>(r: Rand, xs: readonly T[]): T => xs[xint(r, xs.length)] as T;
type Out<T> = { ok: true; value: T } | { ok: false; message: string };
const ogRun = <T,>(f: () => T): Out<T> => { try { return { ok: true, value: f() }; } catch (e) { return { ok: false, message: String((e as Error).message) }; } };
const rwRun = <T,>(r: Result<T, EntityError>): Out<T> => (r.ok ? { ok: true, value: r.value } : { ok: false, message: r.error._tag === "entity_invariant" ? r.error.reason : r.error._tag });
const same = (label: string, og: Out<unknown>, rw: Out<unknown>): void => { expect(`${label}:${stableJson(rw)}`).toBe(`${label}:${stableJson(og)}`); };
const bump = (kinds: Map<string, number>, k: string) => kinds.set(k, (kinds.get(k) ?? 0) + 1);
const expectKinds = (kinds: Map<string, number>, want: readonly string[]) => { for (const k of want) expect([k, [...kinds.keys()].some((x) => x.startsWith(k)), [...kinds].join(",")]).toEqual([k, true, [...kinds].join(",")]); };
const W = (b: string) => ("0x" + b.repeat(32)) as EntityId;
const U1 = W("01"), H1 = W("02"), H2 = W("03"), U2 = W("04");
const XSIG: Readonly<Record<string, string>> = { [U1]: "0x" + "a1".repeat(20), [H1]: "0x" + "a2".repeat(20), [H2]: "0x" + "a3".repeat(20), [U2]: "0x" + "a4".repeat(20) };
const XPEER: Readonly<Record<string, EntityId>> = { [U1]: H1, [H1]: U1, [H2]: U2, [U2]: H2 };
const T0 = 1_700_000_050_000, CLOCK60 = { leftResponseSeconds: 60, rightResponseSeconds: 60 }, RUNTIME_SEED = "0x" + "5e".repeat(32);
const Z32 = "0x" + "00".repeat(32);
const baseRoute = (r: Rand, n: number): CrossRoute => ({
  orderId: `C${n}`, makerEntityId: U1, hubEntityId: H1,
  source: { jurisdiction: `stack:1:0x${"11".repeat(20)}`, entityId: U1, counterpartyEntityId: H1, tokenId: 1, amount: BigInt(1 + xint(r, 1e9)) },
  target: { jurisdiction: `stack:31337:0x${"ab".repeat(20)}`, entityId: H2, counterpartyEntityId: U2, tokenId: 2, amount: BigInt(1 + xint(r, 1e12)) },
  sourceDisputeConfig: CLOCK60, targetDisputeConfig: CLOCK60, status: "intent", createdAt: T0 - 1000, updatedAt: T0 - 1000, expiresAt: T0 + 60_000,
  sourceSignerId: XSIG[U1], sourceHubSignerId: XSIG[H1], targetHubSignerId: XSIG[H2], targetSignerId: XSIG[U2],
});
const decodedAt = (r: Rand, ratio: number) => {
  if (ratio <= 0 || ratio > 65_535 || !Number.isInteger(ratio)) return { fillRatio: ratio };
  const reveal = crossPullReveal(ratio, "0x" + xint(r, 1e9).toString(16).padStart(64, "0"));
  return reveal.ok ? unwrapOk(decodeHashLadderBinary(reveal.value.binary)) : { fillRatio: ratio };
};
const unwrapOk = <T,>(x: { ok: true; value: T } | { ok: false }): T => { if (!x.ok) throw new Error("unexpected"); return x.value; };
const pendingOf = (r: Rand) => { const d = decodedAt(r, xpick(r, [1 + xint(r, 65_534), 65_535, 100, 200])) as { fillRatio: number; fullSecret?: string; reveals?: readonly string[] }; return { fillRatio: d.fillRatio, fullSecret: d.fullSecret ?? Z32, reveals: (d.reveals ?? [Z32, Z32, Z32, Z32]) as never }; };
/** A prepared route with random status, committed fill, confirmed registry ratios and stashed reveals. */
const recoveryRoute = (r: Rand, n: number): CrossRoute => {
  let c = unwrapOk(prepareCrossRoute(baseRoute(r, n), { runtimeSeed: RUNTIME_SEED, now: T0 - 500 }));
  if (xint(r, 3) === 0) { const num = BigInt(1 + xint(r, 999)), next = applyCrossFill(c, { cumulativeFillRatio: Number((num * 65_535n) / 1000n), fillNumerator: num, fillDenominator: 1000n }, T0 - 100); if (next.ok) c = next.value; }
  return {
    ...c, status: xpick(r, ["resting", "partially_filled", "clear_requested", "settled", "cancelled"] as const),
    ...(xint(r, 5) === 0 ? { sourceRegistryFillRatio: xpick(r, [100, 200, 65_535]) } : {}), ...(xint(r, 5) === 0 ? { targetRegistryFillRatio: xpick(r, [100, 200, 65_535]) } : {}),
    ...(xint(r, 4) === 0 ? { pendingSourceRegistryReveal: pendingOf(r) } : {}), ...(xint(r, 4) === 0 ? { pendingTargetRegistryReveal: pendingOf(r) } : {}),
  };
};
const otherRows = (r: Rand, n: number): readonly unknown[] => Array.from({ length: n }, () => ({ transformer: "0x" + "cc".repeat(20), secret: "0x" + xint(r, 1e9).toString(16).padStart(64, "0") }));
const ladderRow = (r: Rand, routes: readonly CrossRoute[], self: string) => {
  const route = xpick(r, routes), targetRole = r() < 0.5, pull = targetRole ? route.targetPull! : route.sourcePull!, leg = targetRole ? route.target : route.source;
  const cp = leg.entityId.toLowerCase() === self ? leg.counterpartyEntityId : leg.entityId;
  return { counterpartyEntity: cp.toLowerCase(), targetRole, fullHash: pull.fullHash, partialRoot: pull.partialRoot, witness: pendingOf(r) };
};
const jbOf = (r: Rand, routes: readonly CrossRoute[], self: string): CjJBatch | undefined => {
  if (xint(r, 6) === 0) return undefined;
  const base = initJBatch() as unknown as { batch: Record<string, unknown[]> } & CjJBatch;
  const fill = (): Record<string, unknown[]> => ({ ...base.batch, revealSecrets: [...otherRows(r, xpick(r, [0, 0, 0, 5, 49, 31]))] as never, hashLadderRegistrations: Array.from({ length: xpick(r, [0, 0, 1, 2, 32]) }, () => ladderRow(r, routes, self)) as never });
  const batch = fill();
  return { ...base, batch: batch as never, ...(xint(r, 3) === 0 ? { sentBatch: { batch: fill() as never, entityNonce: 3 } } : {}), ...(xint(r, 6) === 0 ? { recoveryBatches: [fill() as never] } : {}), status: "accumulating" } as unknown as CjJBatch;
};
const hostOf = (r: Rand, n: number, self: EntityId): { host: CjHost; routes: CrossRoute[] } => {
  const routes = Array.from({ length: 1 + xint(r, 4) }, (_, k) => recoveryRoute(r, n * 10 + k));
  const swaps = new Map([...routes].sort((a, b) => (a.orderId < b.orderId ? -1 : 1)).map((x) => [x.orderId, x] as const));
  const nowSec = Math.floor(T0 / 1000);
  const accountOf = (peer: string): CjAccount => {
    const k = xint(r, 4), left = self < peer ? self : peer, right = self < peer ? peer : self;
    return { left, right, leftResponseSeconds: xpick(r, [60, 10]), rightResponseSeconds: xpick(r, [60, 10]), leftPullIds: [], rightPullIds: [],
      ...(k === 0 ? {} : k === 1 ? { active: { observedOnChain: false } } : { active: { observedOnChain: true, disputeStartTimestamp: nowSec - xpick(r, [0, 10, 30, 59, 60, 61, 200, -5]) } }) };
  };
  const peers = [...new Set([XPEER[self]!, ...(xint(r, 3) === 0 ? [xpick(r, [U1, H1, H2, U2].filter((x) => x !== self))] : [])])];
  const accounts = new Map(peers.filter(() => xint(r, 10) > 0).map((p) => [p.toLowerCase(), accountOf(p)] as const));
  const jb = jbOf(r, routes, self.toLowerCase());
  return { host: { id: self, timestamp: T0, validators: [XSIG[self]!], swaps, ...(jb === undefined ? {} : { jb }), accounts }, routes };
};
const ogStateOf = (h: CjHost): any => {
  const swaps = ensureEntityCollectionCandidate(undefined, ogCrossIndex.cloneCrossJurisdictionRoute as never) as Map<string, unknown>;
  for (const [k, v] of h.swaps ?? []) swaps.set(k, ogCrossIndex.cloneCrossJurisdictionRoute(structuredClone(v) as never));
  return {
    entityId: h.id, timestamp: h.timestamp, config: { validators: [...h.validators] }, crossJurisdictionSwaps: swaps, ...(h.jb === undefined ? {} : { jBatchState: structuredClone(h.jb) }),
    accounts: new Map([...h.accounts].map(([k, a]) => [k, { ...(a.active === undefined ? {} : { activeDispute: { ...a.active } }), state: { leftEntity: a.left, rightEntity: a.right, disputeConfig: { leftResponseSeconds: a.leftResponseSeconds, rightResponseSeconds: a.rightResponseSeconds } } }])),
  };
};
/** The reveal-relevant route fields and the jBatchState, both sides. */
const routeView = (routes: Iterable<[string, any]>) => [...routes].map(([k, v]) => [k, v.pendingSourceRegistryReveal ?? null, v.pendingTargetRegistryReveal ?? null, v.updatedAt]);
const ogView = (s: any, value: unknown) => ({ value, routes: routeView(s.crossJurisdictionSwaps), jb: s.jBatchState ?? null });
const rwView = (h: CjHost, value: unknown) => ({ value, routes: routeView((h.swaps ?? new Map()) as Map<string, any>), jb: h.jb ?? null });

console.warn = () => {};
describe("disputes-final: the hash-ladder reveal queue (og j-events-htlc queueHashLadderRevealRegistration / flushDeferredHashLadderReveals / countDeferredHashLadderReveals)", () => {
  test("MATCH: queueHashLadderRevealRegistration on 250 random Entities (source and target roles, confirmed / queued / sent / recovery ratios, source windows, full batches): same result, routes, jBatchState and halts as og", () => {
    const r = xrng(0x1add), kinds = new Map<string, number>();
    for (let i = 0; i < 250; i++) {
      const self = xpick(r, [H1, H1, U2, U2, U1, H2]), { host, routes } = hostOf(r, i, self), route = xpick(r, routes), targetRole = r() < 0.5;
      const pull = (targetRole ? route.targetPull : route.sourcePull)!, leg = targetRole ? route.target : route.source;
      const cp = xint(r, 12) === 0 ? xpick(r, ["0x12", U1, H2]) : leg.entityId.toLowerCase() === self ? leg.counterpartyEntityId : leg.entityId;
      const existing = xint(r, 4) === 0 ? host.jb?.batch["hashLadderRegistrations"]?.[0] as { witness?: { fillRatio: number } } | undefined : undefined;
      const ratio = existing?.witness?.fillRatio ?? xpick(r, [100, 200, 65_535, 1 + xint(r, 65_534), 0, 70_000, 1.5]);
      const decoded = decodedAt(r, ratio) as never;
      const og = ogRun(() => { const s = ogStateOf(host); const v = queueHashLadderRevealRegistration(s, cp, pull as never, decoded, targetRole); return ogView(s, v); });
      const rw = rwRun(queueLadderReveal(host, cp, pull, decoded, targetRole));
      same(`queue ${i}`, og, rw.ok ? { ok: true, value: rwView(rw.value.host, rw.value.result) } : rw);
      bump(kinds, og.ok ? String((og.value as { value: string }).value) : og.message.split(":")[0]!);
    }
    expectKinds(kinds, ["queued", "already-queued", "deferred-batch-pending", "source-window-expired", "J_HASH_LADDER_FILL_RATIO_INVALID", "J_HASH_LADDER_COUNTERPARTY_INVALID", "J_HASH_LADDER_REGISTRATION_CONFLICT", "J_HASH_LADDER_SOURCE_ACTIVE_DISPUTE_MISSING"]);
  }, 120_000);

  test("MATCH: flushDeferredHashLadderReveals and countDeferredHashLadderReveals on 250 random Entities (scoped and unscoped, sent batch, stashed source / target witnesses): same count, flushed, routes, jBatchState and halts as og", () => {
    const r = xrng(0xf1a5), kinds = new Map<string, number>();
    for (let i = 0; i < 250; i++) {
      const self = xpick(r, [H1, U2, H1, U2, U1, H2]), { host } = hostOf(r, i, self);
      expect([i, countDeferredReveals(host)]).toEqual([i, countDeferredHashLadderReveals(ogStateOf(host))]);
      const scope = xint(r, 3) === 0 ? xpick(r, [XPEER[self]!, XPEER[self]!.toUpperCase().replace("0X", "0x"), U1]) : undefined;
      const og = ogRun(() => { const s = ogStateOf(host); const v = flushDeferredHashLadderReveals(s, scope); return ogView(s, v); });
      const rw = rwRun(flushDeferredReveals(host, scope));
      same(`flush ${i}`, og, rw.ok ? { ok: true, value: rwView(rw.value.host, rw.value.flushed) } : rw);
      bump(kinds, og.ok ? `flushed:${Math.min(1, (og.value as { value: number }).value)}` : og.message.split(":")[0]!);
    }
    expectKinds(kinds, ["flushed:0", "flushed:1", "J_HASH_LADDER"]);
  }, 120_000);
});
