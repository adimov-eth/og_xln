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
import { createEntity, foldTx, hashHtlcSecret, pullLadderHash, initCrontab, scheduleHook, withCrontab, crontabOf, localProof, ogProofBody, type AccountReplica, type EntityState } from "../xln.ts";
import { PersistentAccountStateMap } from "../../core/account/state/persistent-state-map.ts";
import { PersistentEntityAccountMap } from "../../core/entity/state/persistent-account-map.ts";
import { initJBatch as ogInitJBatch } from "../../core/jurisdiction/machine/batch/index.ts";
import { ALICE, BOB, aliceAddr, anvilKey, signDigestHex, verifiers } from "../xln_run.ts";
import { readEntityFrameEvents } from "../../core/entity/frame-events.ts";
import { EntityAccountCandidateMap } from "../../core/entity/state/persistent-account-map.ts";
import { normalizeJurisdictionEvent, compareCanonicalJurisdictionEvents } from "../../core/jurisdiction/machine/events/event-normalization.ts";
import { canonicalJurisdictionEventsHash, getJEventJurisdictionRef } from "../../core/jurisdiction/machine/event-observation.ts";
import { EMPTY_J_HISTORY_ROOT as OG_EMPTY_ROOT, foldJHistoryRoot as ogFoldRoot, canonicalJEventRangeHash, buildJEventRangeDigest } from "../../core/jurisdiction/machine/history-consensus/index.ts";
import { applyJEvent as ogApplyJEvent } from "../../core/entity/tx/j-events.ts";
import { handleUnsafeAccountFrame as ogHandleUnsafeAccountFrame } from "../../core/entity/tx/handlers/account/dispute-input.ts";
import { handleJAbortSentBatch as ogJAbort } from "../../core/entity/tx/handlers/j-batch/j-abort-sent-batch.ts";
import { handleJClearBatch as ogJClear } from "../../core/entity/tx/handlers/j-batch/j-clear-batch.ts";
import { handleCrossJurisdictionSalvageEntityTx as ogSalvage } from "../../core/entity/tx/handlers/cross-j/salvage.ts";
import { handleResolveHtlcLockEntityTx as ogResolveHtlcLock } from "../../core/entity/tx/handlers/htlc/direct.ts";
import { HTLC_ENFORCEMENT_RESERVE_MS as OG_RESERVE_MS } from "../../core/account/consensus/dispute/deadline-policy.ts";
import { createDisputeProofHashWithNonce } from "../../core/protocol/dispute/proof-builder.ts";
import { getEntityAccountForWrite } from "../../core/entity/state/persistent-account-map.ts";
import { accountDisputeHash, accountId as rwAccountId, genesisReplica, unsafeAccountFrame } from "../xln.ts";
import { CAROL, keyOf, signLazyAccountHanko } from "../xln_run.ts";

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

// ---- og entity/tx/j-events.ts applyJEvent: SecretRevealed (applyKnownHtlcSecret) and HashLadderRevealRegistered on ALICE's Entity ----
const JEP = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512", OG_JX = { name: "j", chainId: TERMS.domain.chainId, depositoryAddress: TERMS.domain.depositoryAddress, entityProviderAddress: JEP };
const JREFX = getJEventJurisdictionRef(OG_JX), ALICE_SIGNERX = aliceAddr.toLowerCase();
const word = (r: Rand): string => "0x" + Array.from({ length: 64 }, () => "0123456789abcdef"[xint(r, 16)]).join("");
/** ALICE's proposer-signed range with one block per event list, above the certified head (og's own canonicalisation and hashing). */
const aliceRange = (r: Rand, og: any, eventLists: readonly (readonly { type: string; data: Record<string, unknown> }[])[]): Record<string, unknown> => {
  const baseHeight = Number(og.lastFinalizedJHeight ?? 0), scannedThroughHeight = baseHeight + Math.max(1, eventLists.length);
  const blocks = eventLists.map((raw, i) => {
    const blockNumber = baseHeight + 1 + i, blockHash = word(r);
    const events = raw.map((e, logIndex) => normalizeJurisdictionEvent({ ...e, blockNumber, blockHash, transactionHash: word(r), logIndex })!).sort(compareCanonicalJurisdictionEvents);
    return { blockNumber, blockHash, eventsHash: canonicalJurisdictionEventsHash(events), events };
  });
  const tipBlockHash = word(r), eventHistoryRoot = ogFoldRoot(og.jHistoryFinality?.eventHistoryRoot ?? OG_EMPTY_ROOT, blocks.map((b) => ({ jurisdictionRef: JREFX, jHeight: b.blockNumber, jBlockHash: b.blockHash, eventsHash: b.eventsHash })));
  const rangeHash = canonicalJEventRangeHash(JREFX, blocks);
  const digest = buildJEventRangeDigest({ entityId: ALICE, jurisdictionRef: JREFX, signerId: ALICE_SIGNERX, baseHeight, scannedThroughHeight, tipBlockHash, eventHistoryRoot, rangeHash });
  return { from: ALICE_SIGNERX, jurisdictionRef: JREFX, baseHeight, scannedThroughHeight, observedAt: scannedThroughHeight, tipBlockHash, blocks, eventHistoryRoot, rangeHash, signature: signDigestHex(digest, anvilKey(2)) };
};
/** Every string equal (case-insensitively) to a key of `m` becomes its value, deeply. */
const swapIds = (v: any, m: Readonly<Record<string, string>>): any => typeof v === "string" ? (m[v.toLowerCase()] ?? v) : Array.isArray(v) ? v.map((x) => swapIds(x, m)) : v instanceof Map ? new Map([...v].map(([k, x]) => [k, swapIds(x, m)]))
  : v !== null && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swapIds(x, m)])) : v;
type JCase = { rw: EntityState; replicas: ReadonlyMap<EntityId, AccountReplica>; og: any; events: { type: string; data: Record<string, unknown> }[]; raw: CrossRoute[]; routes: CrossRoute[]; secrets: string[]; locks: ReadonlyMap<string, HtlcLock> };
/** ALICE (in a random cross-j role) with random routes, a BOB Account holding inbound / outbound locks (live or disputed with a Target recovery), a paybook, and random SecretRevealed / HashLadderRevealRegistered events. */
const jCase = (r: Rand, n: number): JCase => {
  const role = xpick(r, [U1, H1, H2, U2]), ids: Record<string, string> = { [role.toLowerCase()]: ALICE, [XPEER[role]!.toLowerCase()]: BOB };
  const raw = Array.from({ length: 1 + xint(r, 3) }, (_, k) => recoveryRoute(r, n * 10 + k)).map((c) => (xint(r, 3) === 0 ? { ...c, sourceRegistryRecord: { fillRatio: xpick(r, [100, 200]), revealedAt: 1_700_000_000 + xint(r, 3) } } : c))
    .map((c) => (xint(r, 3) === 0 ? { ...c, targetRegistryRecord: { fillRatio: xpick(r, [100, 200]), revealedAt: 1_700_000_000 + xint(r, 3) } } : c));
  const routes: CrossRoute[] = raw.map((c) => swapIds(c, ids));
  let rw = unwrap(createEntity({ id: ALICE, jurisdiction: TERMS.domain, threshold: 1n, members: new Map([[aliceAddr, { shares: 1n }]]), jurisdictionConfig: { name: "j", entityProviderAddress: JEP } })).state;
  const base = genesisAB(), left = base.state.account.id.left, aliceLeft = left.toLowerCase() === ALICE.toLowerCase();
  const secrets = Array.from({ length: 3 }, () => word(r)), hashOf = (x: string) => hashHtlcSecret(x)!;
  const locks = new Map<string, HtlcLock>();
  for (const [i, sec] of secrets.entries()) {
    if (xint(r, 3) === 0) continue;
    const inbound = xint(r, 4) > 0, lockId = xint(r, 2) === 0 ? hashOf(sec) : `lock${n}_${i}`;
    locks.set(lockId, { lockId, hashlock: hashOf(sec), timelock: 1_800_000_000_000n, revealBeforeHeight: 99n, amount: 5n, tokenId: tk(1), senderIsLeft: inbound ? !aliceLeft : aliceLeft, createdHeight: 1n, createdTimestamp: 1n });
  }
  const disputed = xint(r, 3) === 0;
  const pullIds = routes.flatMap((c) => [c.targetPull?.pullId, c.sourcePull?.pullId]).filter((x): x is string => x !== undefined).filter(() => xint(r, 2) === 0);
  const recovery = { requiredPullIds: pullIds, resultsByPullId: pullIds.length > 0 && xint(r, 3) === 0 ? { [pullIds[0]!]: "7" } : {} };
  const active = { startedByLeft: true, initialProofbodyHash: Z32, initialNonce: 1, initialProposerIsLeft: true, disputeTimeout: 2_000_000_000, disputeStartTimestamp: 1_999_999_880, jNonce: 1, starterInitialArguments: "0x", starterCounterArguments: "0x",
    starterCounterProofCommitment: Z32, observedOnChain: true as const, observedBlockNumber: 1, finalizeQueued: false, crossJurisdictionRecovery: recovery };
  const replica: AccountReplica = disputed ? ({ ...base, _tag: "disputed", mempool: [], state: { ...base.state, locks }, active } as unknown as AccountReplica) : ({ ...base, state: { ...base.state, locks } } as AccountReplica);
  const entries = new Map<string, PaybookEntry>();
  for (const [i, sec] of secrets.entries()) {
    const k = xint(r, 6), h = hashOf(sec);
    if (k === 0) continue;
    const relay = { routeId: `C${n}`, fillRatio: 100, sourceAmount: 1n, targetAmount: 2n, targetEntityId: W("0c"), targetCounterpartyEntityId: W("0d"), targetLockId: `tl${i}`, ...(xint(r, 5) > 0 ? { targetSignerId: "0x" + "ee".repeat(20) } : {}) };
    entries.set(h, { hashlock: h, createdTimestamp: 1, ...(k === 1 ? { secret: sec } : {}), ...(k === 2 || k === 5 ? { inboundEntity: xint(r, 3) === 0 ? W("0e") : BOB, pendingFee: xpick(r, [0n, 3n]) } : {}), ...(k === 3 ? { crossJurisdictionRelay: relay as never } : {}), ...(k === 4 ? { originated: true as const, outboundEntity: BOB } : {}) });
  }
  const paybook: Paybook = { entries, feesEarned: BigInt(xint(r, 50)) };
  rw = { ...rw, crossJurisdictionSwaps: new Map(routes.map((c) => [c.orderId, c] as const)) as never, paybook };
  // og shells over the same data
  const ogLocks = new Map([...locks].map(([k, l]) => [k, { ...l, tokenId: 1 }]));
  const ogAccount: any = { status: disputed ? "disputed" : "active", state: { jNonce: 0, leftEntity: left, rightEntity: base.state.account.id.right, locks: ogLocks, disputeConfig: { ...TERMS.disputeConfig } }, ...(disputed ? { activeDispute: structuredClone(active) } : {}) };
  const accounts = new Map([[BOB as string, ogAccount]]);
  const shell = Object.assign(Object.create(EntityAccountCandidateMap.prototype), { get: (id: string) => accounts.get(id), getForWrite: (id: string) => accounts.get(id), has: (id: string) => accounts.has(id), keys: () => accounts.keys(), entries: () => accounts.entries(), values: () => accounts.values(), [Symbol.iterator]: () => accounts.entries() });
  const swaps = ensureEntityCollectionCandidate(undefined, ogCrossIndex.cloneCrossJurisdictionRoute as never) as Map<string, unknown>;
  for (const c of routes) swaps.set(c.orderId, ogCrossIndex.cloneCrossJurisdictionRoute(structuredClone(c) as never));
  const og: any = { entityId: ALICE, timestamp: T0, height: 0, lastFinalizedJHeight: 0, config: { mode: "proposer-based", threshold: 1n, validators: [ALICE_SIGNERX], shares: { [ALICE_SIGNERX]: 1n }, jurisdiction: OG_JX },
    reserves: new Map(), outDebtsByToken: new Map(), inDebtsByToken: new Map(), accounts: shell, crossJurisdictionSwaps: swaps, paybook: { entries: new Map([...entries].map(([k, v]) => [k, structuredClone(v)])), feesEarned: paybook.feesEarned } };
  // events: secrets (known, with and without locks / paybook routes, or unknown) and registry reveals of the routes' own pulls
  const events: { type: string; data: Record<string, unknown> }[] = [];
  for (let k = 0; k < 1 + xint(r, 4); k++) {
    if (r() < 0.45) { const sec = xint(r, 5) === 0 ? word(r) : xpick(r, secrets); events.push({ type: "SecretRevealed", data: { hashlock: hashOf(sec), revealer: word(r), secret: sec } }); continue; }
    const i = xint(r, routes.length), route = routes[i]!, pre = raw[i]!, targetRole = r() < 0.5, pull = (targetRole ? route.targetPull : route.sourcePull)!, leg = targetRole ? route.target : route.source;
    const ratio = xpick(r, [100, 200, 65_535, 1 + xint(r, 65_534)]), seed = unwrapOk(crossPrivateSeed(RUNTIME_SEED, pre)), reveal = unwrapOk(crossPullReveal(ratio, seed)), dec = unwrapOk(decodeHashLadderBinary(reveal.binary)) as { fillRatio: number; fullSecret?: string; reveals?: readonly string[] };
    const matching = xint(r, 5) > 0;
    events.push({ type: "HashLadderRevealRegistered", data: { entity: matching ? leg.counterpartyEntityId.toLowerCase() : xpick(r, [ALICE, BOB, W("09")]), counterpartyEntity: matching ? leg.entityId.toLowerCase() : xpick(r, [ALICE, BOB]),
      ladderHash: xint(r, 8) === 0 ? word(r) : pullLadderHash(pull), fillRatio: dec.fillRatio, fullSecret: dec.fullSecret ?? Z32, reveals: [...(dec.reveals ?? [Z32, Z32, Z32, Z32])], targetRole,
      revealedAt: xpick(r, [1_700_000_000, 1_700_000_001, 1_700_000_005, 1_699_999_999]) } });
  }
  return { rw, replicas: new Map([[BOB, replica]]), og, events, raw, routes, secrets, locks };
};
const bookSlot = { getPaybookEntry: (s: any, h: string) => s.paybook.entries.get(h), getPaybookEntryForWrite: (s: any, h: string) => s.paybook.entries.get(h), addPaybookFees: (s: any, amount: bigint) => { s.paybook.feesEarned += amount; } };
const routeRegistryView = (routes: Iterable<[string, any]>) => [...routes].map(([k, v]) => [k, v.status, v.sourceRegistryFillRatio ?? null, v.targetRegistryFillRatio ?? null, v.sourceRegistryRecord ?? null, v.targetRegistryRecord ?? null]);
const paybookView = (p: any) => ({ fees: String(p.feesEarned), entries: [...p.entries].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]: [string, any]) => [k, v.secret ?? null, v.pendingFee === undefined ? null : String(v.pendingFee)]) });

describe("disputes-final: finalized J events on the Entity (og entity/tx/j-events.ts applyFinalizedJEvent SecretRevealed / HashLadderRevealRegistered)", () => {
  test("MATCH: 150 random signed ranges of SecretRevealed and HashLadderRevealRegistered on ALICE (routes in every cross-j role, inbound / outbound locks, paybook routes with fees and cross-j relays, a disputed Account's Target recovery): same verdict, messages, paybook, routes' registry latches and records, recovery results, htlc_resolves and cross-j outputs as og", async () => {
    const r = xrng(0x5ec7), kinds = new Map<string, number>();
    for (let i = 0; i < 150; i++) {
      const c = jCase(r, i), data = aliceRange(r, c.og, c.events.map((e) => [e]));
      const resultsBefore = Object.keys(c.og.accounts.get(BOB).activeDispute?.crossJurisdictionRecovery?.resultsByPullId ?? {}).length;
      let og: Out<any>;
      try { og = { ok: true, value: await ogApplyJEvent(c.og, data as any, { quietRuntimeLogs: true } as any, {} as any, [], true, bookSlot as any) }; } catch (e) { og = { ok: false, message: String((e as Error).message) }; }
      const bobBefore = c.replicas.get(BOB)!.mempool?.length ?? 0;
      // the j_event alone (og applyJEvent), before the Entity frame's Account proposals
      const f0 = foldTx(c.rw, c.replicas, { type: "j_event", data: data as never }, { verify: verifiers.verify, timestamp: BigInt(T0) }), f = f0.ok ? { ok: true as const, value: { draft: f0.value } } : f0;
      expect([i, f.ok ? "ok" : (f.error as any).reason]).toEqual([i, og.ok ? "ok" : og.message]);
      bump(kinds, og.ok ? "ok" : og.message.split(":")[0]!);
      if (!og.ok || !f.ok) continue;
      const d = f.value.draft, next = og.value.newState;
      expect([i, (d.events ?? []).map((e) => e.message)]).toEqual([i, readEntityFrameEvents(next).map((e: any) => e.message)]);
      expect([i, paybookView(d.state.paybook ?? { entries: new Map(), feesEarned: 0n })]).toEqual([i, paybookView(next.paybook)]);
      expect([i, routeRegistryView((d.state.crossJurisdictionSwaps ?? new Map()) as Map<string, any>)]).toEqual([i, routeRegistryView(next.crossJurisdictionSwaps)]);
      const rwActive: any = (d.accountReplicas.get(BOB) as any).active, ogActive = next.accounts.get(BOB).activeDispute;
      expect([i, rwActive?.crossJurisdictionRecovery ?? null]).toEqual([i, ogActive?.crossJurisdictionRecovery ?? null]);
      // og returns the htlc_resolves; applyLocalAccountEffects admits them only into a live Account
      const ogResolves = og.value.accountTxs.filter((t: any) => t.tx.type === "htlc_resolve" && t.accountId === BOB && next.accounts.get(BOB).status === "active").map((t: any) => [t.tx.data.lockId, t.tx.data.secret]);
      const rwResolves = (d.accountReplicas.get(BOB)!.mempool ?? []).slice(bobBefore).filter((t: any) => t.type === "htlc_resolve").map((t: any) => [t.lockId, t.secret]);
      expect([i, rwResolves]).toEqual([i, ogResolves]);
      const rwOut = d.outputs.flatMap((o: any) => o.input.txs.filter((t: any) => t.type === "runtimeOutput").map((t: any) => ({ entityId: o.to, signerId: String(o.signerId), txs: t.data.entityTxs })));
      expect([i, stableJson(rwOut)]).toEqual([i, stableJson(og.value.outputs.map((o: any) => ({ entityId: o.entityId, signerId: o.signerId, txs: o.entityTxs })))]);
      for (const m of readEntityFrameEvents(next).map((e: any) => String(e.message))) bump(kinds, m.slice(0, 18));
      if (ogResolves.length > 0) bump(kinds, "resolves");
      if (rwOut.some((o) => o.txs.some((t: any) => t.type === "resolveHtlcLock"))) bump(kinds, "relay");
      if (Object.keys(ogActive?.crossJurisdictionRecovery?.resultsByPullId ?? {}).length > resultsBefore) bump(kinds, "recovery");
    }
    expectKinds(kinds, ["ok", "resolves", "relay", "recovery", "🔓 HTLC reveal", "🌉 Cross-j reveal", "CROSS_J_REGISTRY", "CROSS_J_ENTITY_OUTPUT_ROUTE_MISSING"]);
  }, 120_000);
});

// ---- og applyJEvent: DisputeStarted / CounterDisputeRegistered / DisputeFinalized on ALICE's Entity with a real BOB Account ----
const PA = (name: string) => PersistentAccountStateMap.empty(name as never);
const ogBobAccount = (tag: "open" | "disputed", active: Record<string, unknown> | undefined): any => ({
  state: { leftEntity: ALICE.toLowerCase(), rightEntity: BOB.toLowerCase(), domain: { ...TERMS.domain }, watchSeed: TERMS.watchSeed, disputeConfig: { ...TERMS.disputeConfig }, jNonce: 0,
    deltas: PA("deltas"), locks: PA("locks"), swapOffers: PA("swapOffers"), pulls: PA("pulls"), requestedRebalance: PA("requestedRebalance"), requestedRebalanceFeeState: PA("requestedRebalanceFeeState"), rebalanceFeePolicies: PA("rebalanceFeePolicies") },
  status: tag === "open" ? "active" : "disputed", mempool: [], currentHeight: 0, proofHeader: { fromEntity: ALICE.toLowerCase(), toEntity: BOB, nextProofNonce: 1 }, pendingWithdrawals: PA("pendingWithdrawals"),
  shadow: { rebalance: { policy: PA("rebalanceShadowPolicy"), submittedAtByToken: PA("rebalanceShadowSubmitted") } }, ...(active === undefined ? {} : { activeDispute: { ...active } }),
});
const JREPLICAS = new Map([["j", { chainId: TERMS.domain.chainId, contracts: { depository: TERMS.domain.depositoryAddress, entityProvider: TEST_CONTRACTS.entityProvider, account: TEST_CONTRACTS.account, deltaTransformer: DT } }]]);
const sortedHooks = (m: ReadonlyMap<string, unknown> | undefined): unknown[] => [...(m ?? new Map())].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
const secretArgs = (secrets: readonly string[]): string => { const enc = ethers.AbiCoder.defaultAbiCoder(); return enc.encode(["bytes[]"], [[enc.encode(["tuple(uint16[] fillRatios, bytes32[] secrets)"], [{ fillRatios: [], secrets }])]]); };

describe("disputes-final: DisputeStarted / CounterDisputeRegistered / DisputeFinalized on the Entity (og entity/tx/j-events.ts)", () => {
  test("MATCH: 200 random signed dispute events on ALICE (starter / counterparty / third party, open / observed / queued BOB Account, frozen body and clock defects, starter secrets over paybook routes, counter-proof nonce rules, J batch retirement, crontab) -- same verdict, messages, J batch, activeDispute, jNonce, hooks, paybook and outputs as og", async () => {
    const r = xrng(0xd15b), kinds = new Map<string, number>();
    const good: string = (unwrap(localProof(unwrap(committedView(genesisAB().state)), { ok: true, value: DT })) as any).bodyHash;
    const goodBody = ogProofBody((unwrap(localProof(unwrap(committedView(genesisAB().state)), { ok: true, value: DT })) as any).body);
    const L = TERMS.disputeConfig.leftResponseSeconds, R = TERMS.disputeConfig.rightResponseSeconds, nowSec = Math.floor(T0 / 1000);
    for (let i = 0; i < 200; i++) {
      const kind = xpick(r, ["DisputeStarted", "DisputeStarted", "CounterDisputeRegistered", "DisputeFinalized", "DisputeFinalized"] as const);
      const bobTag = xpick(r, ["none", "open", "observed", "observed", "queued"] as const);
      const secrets = Array.from({ length: xint(r, 3) }, () => word(r));
      const active = bobTag === "observed" ? { startedByLeft: r() < 0.5, initialProofbodyHash: good, initialNonce: xpick(r, [1, 2]), initialProposerIsLeft: r() < 0.5, disputeTimeout: nowSec + L + R - 10, disputeStartTimestamp: nowSec - 10, jNonce: 1,
        starterInitialArguments: "0x", starterCounterArguments: "0x", starterCounterProofCommitment: Z32, observedOnChain: true, observedBlockNumber: 1, finalizeQueued: false, ...(r() < 0.3 ? { selectedCounterNonce: 3, selectedCounterProofbodyHash: good, selectedCounterProposerIsLeft: r() < 0.5 } : {}) }
        : bobTag === "queued" ? { startedByLeft: true, initialProofbodyHash: good, initialNonce: 1, initialProposerIsLeft: true, disputeTimeout: 0, jNonce: 1, starterInitialArguments: "0x", starterCounterArguments: "0x", starterCounterProofCommitment: Z32, observedOnChain: false, finalizeQueued: false } : undefined;
      const hashIn = xint(r, 10) === 0 ? word(r) : good, peerRow = (h: string) => ({ counterentity: xpick(r, [BOB.toLowerCase(), W("0c")]), proofbodyHash: h, initialProofbodyHash: h, counterNonce: xpick(r, [2, 3, 4]), proposerIsLeft: r() < 0.5, counterProofbody: goodBody });
      const batch = { ...ogInitJBatch().batch, disputeStarts: Array.from({ length: xint(r, 3) }, () => peerRow(xpick(r, [good, Z32]))), counterDisputes: Array.from({ length: xint(r, 3) }, () => peerRow(xpick(r, [good, Z32]))),
        disputeFinalizations: Array.from({ length: xint(r, 2) }, () => peerRow(good)) };
      const jBatch = xint(r, 5) === 0 ? undefined : { ...ogInitJBatch(), batch, entityNonce: xpick(r, [0, 2, 5]), ...(xint(r, 4) === 0 ? { sentBatch: { batch: { ...ogInitJBatch().batch, disputeStarts: [peerRow(good)], counterDisputes: [peerRow(good)] }, entityNonce: 6, batchHash: Z32 } } : {}) };
      const crontab = xint(r, 3) === 0 ? undefined : xint(r, 2) === 0 ? initCrontab() : scheduleHook(initCrontab(), { id: `dispute-deadline:${BOB.toLowerCase()}`, triggerAt: 9, type: "dispute_deadline", data: { accountId: BOB } });
      const entries = new Map<string, PaybookEntry>(secrets.filter(() => r() < 0.7).map((sec) => { const h = hashHtlcSecret(sec)!; return [h, { hashlock: h, createdTimestamp: 1, inboundEntity: xpick(r, [BOB, W("0c")]), pendingFee: 2n }] as const; }));
      let rw = unwrap(createEntity({ id: ALICE, jurisdiction: TERMS.domain, threshold: 1n, members: new Map([[aliceAddr, { shares: 1n }]]), jurisdictionConfig: { name: "j", entityProviderAddress: JEP }, committed: (jBatch === undefined ? {} : { jBatchState: structuredClone(jBatch) }) as never })).state;
      if (crontab !== undefined) rw = withCrontab(rw, crontab);
      rw = { ...rw, paybook: { entries, feesEarned: 0n } };
      const base = genesisAB();
      const rwBob = bobTag === "none" ? undefined : bobTag === "open" ? (base as AccountReplica) : ({ ...base, _tag: "disputed", mempool: [], ...(bobTag === "queued" ? { queued: active } : { active }) } as unknown as AccountReplica);
      const ogAccounts = new EntityAccountCandidateMap(PersistentEntityAccountMap.fromEntries(rwBob === undefined ? [] : [[BOB, ogBobAccount(bobTag === "open" ? "open" : "disputed", active)]], ALICE, () => Z32 as never));
      const og: any = { entityId: ALICE, timestamp: T0, height: 0, lastFinalizedJHeight: 0, config: { mode: "proposer-based", threshold: 1n, validators: [ALICE_SIGNERX], shares: { [ALICE_SIGNERX]: 1n }, jurisdiction: OG_JX },
        reserves: new Map(), outDebtsByToken: new Map(), inDebtsByToken: new Map(), accounts: ogAccounts, paybook: { entries: new Map([...entries].map(([k, v]) => [k, { ...v }])), feesEarned: 0n },
        ...(crontab === undefined ? {} : { crontabState: { tasks: new Map([...crontab.tasks].map(([k, v]) => [k, { ...v }])), hooks: new Map(crontab.hooks) } }), ...(jBatch === undefined ? {} : { jBatchState: structuredClone(jBatch) }) };
      const sender = xpick(r, [ALICE, BOB, BOB, W("0c")]), counterentity = sender === ALICE ? BOB : xpick(r, [ALICE, ALICE, BOB]);
      // og's normalizer rejects disputeTimeout != start + L + R, so the clock defect is an Account-terms mismatch
      const clockSkew = xint(r, 8) === 0 ? 1 : 0;
      const batchNonce = xpick(r, [undefined, 3, 7]), bn = batchNonce === undefined ? {} : { batchNonce };
      const data: Record<string, unknown> = kind === "DisputeStarted" ? {
        sender, counterentity, nonce: String(xpick(r, [1, 2])), proposerIsLeft: r() < 0.5, proofbodyHash: hashIn, watchSeed: TERMS.watchSeed, starterInitialArguments: secrets.length > 0 && r() < 0.8 ? secretArgs(secrets) : "0x",
        starterCounterArguments: "0x", starterCounterProofCommitment: Z32, initialProofbody: goodBody, disputeTimeout: nowSec - 5 + L + R + clockSkew, disputeStartTimestamp: nowSec - 5, leftResponseSeconds: L, rightResponseSeconds: R + clockSkew, ...bn,
      } : kind === "CounterDisputeRegistered" ? { sender, counterentity, nonce: xpick(r, [1, 2, 3, 4]), proposerIsLeft: r() < 0.5, proofbodyHash: hashIn, counterProofbody: goodBody }
        : { sender, counterentity, initialNonce: String(xpick(r, [1, 2])), initialProofbodyHash: xpick(r, [good, Z32]), finalProofbodyHash: hashIn, finalizationEvidenceHash: word(r), finalProofbody: goodBody, ...bn };
      const range = aliceRange(r, og, [[{ type: kind, data }]]);
      let ogOut: Out<any>;
      try { ogOut = { ok: true, value: await ogApplyJEvent(og, range as any, { quietRuntimeLogs: true, state: { jReplicas: JREPLICAS } } as any, {} as any, [], true, bookSlot as any) }; } catch (e) { ogOut = { ok: false, message: String((e as Error).message) }; }
      const f = foldTx(rw, rwBob === undefined ? new Map() : new Map([[BOB, rwBob]]), { type: "j_event", data: range as never }, { verify: verifiers.verify, timestamp: BigInt(T0), jReplicas: JREPLICAS as never });
      expect([i, kind, f.ok ? "ok" : (f.error as any).reason]).toEqual([i, kind, ogOut.ok ? "ok" : ogOut.message]);
      bump(kinds, `${kind}:${ogOut.ok ? "ok" : ogOut.message.split(":")[0]}`);
      if (!ogOut.ok || !f.ok) continue;
      const d = f.value, next = ogOut.value.newState, msgs = readEntityFrameEvents(next).map((e: any) => e.message);
      expect([i, (d.events ?? []).map((e) => e.message)]).toEqual([i, msgs]);
      expect([i, d.state.committed["jBatchState"] ?? null]).toEqual([i, next.jBatchState ?? null]);
      const child: any = d.accountReplicas.get(BOB), ogBob = next.accounts.get(BOB);
      expect([i, child?.active ?? child?.queued ?? null]).toEqual([i, ogBob?.activeDispute ?? null]);
      expect([i, child?.state.jNonce ?? null]).toEqual([i, ogBob?.state.jNonce ?? null]);
      expect([i, sortedHooks(crontab === undefined ? undefined : unwrap(crontabOf(d.state)).hooks)]).toEqual([i, sortedHooks(next.crontabState?.hooks)]);
      expect([i, paybookView(d.state.paybook ?? { entries: new Map(), feesEarned: 0n })]).toEqual([i, paybookView(next.paybook)]);
      const rwOut = d.outputs.map((o: any) => [o.to, o.input.txs.map((t: any) => t.type === "runtimeOutput" ? t.data.entityTxs.map((x: any) => x.type).join("+") : t.type).join(",")]);
      expect([i, rwOut]).toEqual([i, ogOut.value.outputs.map((o: any) => [o.entityId, o.entityTxs.map((t: any) => t.type).join(o.entityId === ALICE ? "," : "+")])]);
      for (const m of msgs) bump(kinds, String(m).slice(0, 14));
    }
    expectKinds(kinds, ["DisputeStarted:ok", "DisputeFinalized:ok", "CounterDisputeRegistered:ok", "DisputeStarted:J_EVENT_DISPUTE_FINAL_PROOFBODY_HASH_MISMATCH", "DisputeFinalized:J_EVENT_DISPUTE_FINAL_PROOFBODY_HASH_MISMATCH",
      "DisputeStarted:ACCOUNT_DISPUTE_CLOCK_MISMATCH", "CounterDisputeRegistered:COUNTER_DISPUTE_ACTIVE_ACCOUNT_MISSING", "CounterDisputeRegistered:COUNTER_DISPUTE_NONCE_STALE",
      "⚔️ DISPUTE STA", "⚔️ DISPUTE vs", "✅ DISPUTE FINA", "🛡️ Counter-pr", "🔓 HTLC reveal", "🧹 Removed", "↻ Synced J bat"]);
  }, 120_000);
});

// ---- og entity/tx/handlers/account/dispute-input.ts handleUnsafeAccountFrame: an Account input answered with disposition 'dispute' ----
describe("disputes-final: unsafe Account frames on the Entity (og entity/tx/handlers/account/dispute-input.ts handleUnsafeAccountFrame)", () => {
  test("MATCH: 200 random unsafe frames on ALICE's BOB Account (just-created Account, secret-window evidence over committed / frame-opened locks, paybook routes with inbound hops and conflicts, counterparty dispute Hankos, J batch in flight or full) -- same verdict, messages, paybook, J batch, Account status, kept frame evidence, outputs and upstream htlc_resolves as og", async () => {
    const r = xrng(0x05af), kinds = new Map<string, number>();
    const T1 = unwrap(tokenId("1")), aliceLeft = genesisAB().state.account.id.left === ALICE;
    const carolBase = unwrap(genesisReplica(unwrap(rwAccountId(ALICE, CAROL)), TERMS)) as AccountReplica;
    const payView = (p: any) => stableJson([...(p?.entries ?? new Map())].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]: [string, any]) => [k, { ...v, ...(v.inboundEntity ? { inboundEntity: String(v.inboundEntity).toLowerCase() } : {}), ...(v.outboundEntity ? { outboundEntity: String(v.outboundEntity).toLowerCase() } : {}) }]).concat([["fees", String(p?.feesEarned ?? 0n)]]));
    const slot = { ...bookSlot, putPaybookEntry: (s: any, h: string, e: any) => { s.paybook.entries.set(h, e); } };
    for (let i = 0; i < 200; i++) {
      const created = xint(r, 12) === 0, windowCause = xint(r, 4) !== 0;
      const secrets = Array.from({ length: 3 }, () => word(r)), hashes = secrets.map((x) => hashHtlcSecret(x)!);
      const nLocks = windowCause ? 1 + xint(r, 2) : xint(r, 2) * (1 + xint(r, 2));
      const lockSides = hashes.slice(0, nLocks).map(() => r() < 0.6 ? aliceLeft : !aliceLeft);
      const rwLocks = new Map(hashes.slice(0, nLocks).map((h, k) => [h, { lockId: h, hashlock: h, timelock: 5_000n, revealBeforeHeight: 9n, amount: 7n, tokenId: T1, senderIsLeft: lockSides[k]!, createdHeight: 1n, createdTimestamp: 1n }] as const));
      const ogLocks = hashes.slice(0, nLocks).map((h, k) => [h, { lockId: h, hashlock: h, timelock: 5_000n, revealBeforeHeight: 9, amount: 7n, tokenId: 1, senderIsLeft: lockSides[k]!, createdHeight: 1, createdTimestamp: 1 }] as const);
      // the violating resolve: a committed lock, or one the frame itself opens (og: HTLC_DISPUTE_EVIDENCE_LOCK_MISSING)
      const fresh = windowCause && xint(r, 6) === 0, target = fresh ? 2 : xint(r, nLocks);
      const txs: any[] = [];
      if (fresh) txs.push({ type: "htlc_lock", lockId: hashes[2], hashlock: hashes[2], timelock: 5_000n, revealBeforeHeight: 9n, amount: 7n, tokenId: T1 });
      if (windowCause && r() < 0.3) txs.push({ type: "htlc_resolve", lockId: hashes[target], outcome: "secret", secret: word(r) });
      if (windowCause) txs.push({ type: "htlc_resolve", lockId: hashes[target], outcome: "secret", secret: secrets[target] });
      const cause: any = windowCause ? { _tag: "frame_deadline", reason: "secret_window", lockId: hashes[target] } : { _tag: "state_root_mismatch" };
      const frame: any = { height: 2n, timestamp: BigInt(T0), jHeight: 1n, txs, prevFrameHash: Z32, stateHash: word(r), accountStateRoot: Z32 };
      const error: any = { _tag: "dispute_required", cause, frame, frameHanko: "0xab" };
      // the paybook route of the violating lock
      const h = hashes[target]!, pk = xint(r, 7), entries = new Map<string, PaybookEntry>();
      if (pk === 1 || pk === 2) entries.set(h, { hashlock: h, createdTimestamp: 1, inboundEntity: xpick(r, [CAROL, CAROL, BOB]), ...(r() < 0.5 ? { pendingFee: 2n } : {}) } as PaybookEntry);
      if (pk === 3) entries.set(h, { hashlock: h, createdTimestamp: 1, secret: xpick(r, [secrets[target], word(r)]) } as PaybookEntry);
      if (pk === 4) entries.set(h, { hashlock: h, createdTimestamp: 1, tokenId: xpick(r, [1, 2]), amount: xpick(r, [7n, 8n]) } as PaybookEntry);
      if (pk === 5) entries.set(h, { hashlock: h, createdTimestamp: 1, outboundEntity: xpick(r, [BOB, CAROL]), inboundEntity: CAROL } as PaybookEntry);
      const jb = xpick(r, [undefined, "draft", "draft", "sent", "full"] as const);
      const jBatch = jb === undefined ? undefined : { ...ogInitJBatch(), batch: { ...ogInitJBatch().batch, disputeStarts: jb === "full" ? Array.from({ length: 8 }, (_, n) => ({ counterentity: W(String(10 + n)) })) : [] },
        ...(jb === "sent" ? { sentBatch: { batch: ogInitJBatch().batch, entityNonce: 4, batchHash: Z32 } } : {}) };
      let rw = unwrap(createEntity({ id: ALICE, jurisdiction: TERMS.domain, threshold: 1n, members: new Map([[aliceAddr, { shares: 1n }]]), jurisdictionConfig: { name: "j", entityProviderAddress: JEP }, committed: (jBatch === undefined ? {} : { jBatchState: structuredClone(jBatch) }) as never })).state;
      if (entries.size > 0 || r() < 0.5) rw = { ...rw, paybook: { entries, feesEarned: 0n } };
      // BOB's counterparty dispute Hanko over the committed proof body (a lock-free Account), so a start can queue
      const bobState = { ...genesisAB().state, locks: rwLocks } as never as AccountReplica["state"];
      const nonce = xpick(r, [1, 2]), pl = r() < 0.5, witnessed = nLocks === 0 && r() < 0.7;
      const view = unwrap(committedView(bobState)), good: string = witnessed ? (unwrap(localProof(view, { ok: true, value: DT })) as any).bodyHash : Z32, hash = witnessed ? unwrap(accountDisputeHash(view, good, nonce, pl)) : Z32;
      const witness = witnessed ? { hanko: signLazyAccountHanko(hash, keyOf(BOB), BOB), hash, proofBodyHash: good, proofNonce: nonce, proposerIsLeft: pl } : undefined;
      const rwBob = { ...genesisAB(), state: bobState, dispute: { nextProofNonce: 1, ...(witness ? { counterparty: witness } : {}) } } as AccountReplica;
      const at = { state: rw, accountReplicas: new Map([[BOB, rwBob], [CAROL, carolBase]]) }, held = created ? { state: rw, accountReplicas: new Map([[CAROL, carolBase]]) } : at;
      const out = unsafeAccountFrame(held as never, at as never, BOB, error, created, { verify: verifiers.verify, timestamp: BigInt(T0), jReplicas: JREPLICAS as never } as never);
      expect(out).toBeDefined();
      // og
      const ogBob = ogBobAccount("open", undefined);
      ogBob.state.locks = PersistentAccountStateMap.fromEntries("locks" as never, ogLocks as never);
      if (witness) {
        expect(createDisputeProofHashWithNonce(ogBob.state, good, TERMS.domain, nonce, pl)).toBe(hash);
        Object.assign(ogBob, { counterpartyDisputeProofHanko: witness.hanko, counterpartyDisputeHash: hash, counterpartyDisputeProofBodyHash: good, counterpartyDisputeProofNonce: nonce, counterpartyDisputeProofProposerIsLeft: pl });
      }
      const og: any = { entityId: ALICE, timestamp: T0, height: 0, lastFinalizedJHeight: 0, config: { mode: "proposer-based", threshold: 1n, validators: [ALICE_SIGNERX], shares: { [ALICE_SIGNERX]: 1n }, jurisdiction: OG_JX },
        reserves: new Map(), accounts: new EntityAccountCandidateMap(PersistentEntityAccountMap.fromEntries(created ? [] : [[BOB, ogBob]], ALICE, () => Z32 as never)),
        paybook: { entries: new Map([...entries].map(([k, v]) => [k, { ...v }])), feesEarned: 0n }, ...(jBatch === undefined ? {} : { jBatchState: structuredClone(jBatch) }) };
      const account = created ? ogBob : getEntityAccountForWrite(og.accounts, BOB)!;
      const firstSecret = windowCause ? txs.find((t) => t.type === "htlc_resolve" && hashHtlcSecret(t.secret) === h)?.secret : undefined;
      const reason = windowCause ? `HTLC_SECRET_ENFORCEMENT_WINDOW_TOO_SHORT: lock=${h} reserve=${OG_RESERVE_MS}ms localTimestamp=${T0}` : "ACCOUNT_FRAME_DISPUTE_REQUIRED:state_root_mismatch";
      const effects: any = { outputs: [], accountTxs: [], swapOffersCreated: [], swapCancelRequests: [], swapOffersCancelled: [], candidateEffects: [], hashesToSign: [] };
      let ogOut: Out<any>;
      try {
        ogOut = { ok: true, value: await ogHandleUnsafeAccountFrame({ env: { quietRuntimeLogs: true, state: { jReplicas: JREPLICAS } } as never, state: og, input: {} as never, account, counterpartyId: BOB, createdAccount: created,
          dispute: { reason, evidenceSecrets: firstSecret === undefined ? [] : [{ hashlock: h, secret: firstSecret }], signedFrame: { frame: { height: 2 } as never, frameHanko: "0xab" } }, effects, bookIntentSlot: slot as never }) };
      } catch (e) { ogOut = { ok: false, message: String((e as Error).message) }; }
      const f = out!;
      expect([i, f.ok ? "ok" : (f.error as any).reason]).toEqual([i, ogOut.ok ? "ok" : ogOut.message]);
      bump(kinds, ogOut.ok ? "ok" : ogOut.message.split(":")[0]!);
      if (!ogOut.ok || !f.ok) continue;
      const d = f.value, next = ogOut.value.newState, msgs = readEntityFrameEvents(next).map((e: any) => e.message);
      expect([i, (d.events ?? []).map((e) => e.message)]).toEqual([i, msgs]);
      expect([i, d.state.committed["jBatchState"]]).toEqual([i, next.jBatchState]);
      expect([i, payView(d.state.paybook ?? { entries: new Map(), feesEarned: 0n })]).toEqual([i, payView(next.paybook)]);
      const ogAfter = next.accounts.get(BOB), after: any = d.accountReplicas.get(BOB);
      expect([i, after?._tag === "open" ? "active" : after?._tag === "preparing" ? "dispute_preparing" : after?._tag]).toEqual([i, ogAfter?.status]);
      if (!created) expect([i, after?.evidence !== undefined]).toEqual([i, account.shadow?.rejectedFrameEvidence !== undefined]);
      expect([i, d.outputs.map((o: any) => [o.to, o.input?.txs?.map((t: any) => t.type).join(",")])]).toEqual([i, ogOut.value.outputs.map((o: any) => [o.entityId, o.entityTxs.map((t: any) => t.type).join(",")])]);
      const rwResolves = (d.accountReplicas.get(CAROL)?.mempool ?? []).filter((t: any) => t.type === "htlc_resolve").map((t: any) => [t.lockId, t.secret]);
      expect([i, rwResolves]).toEqual([i, effects.accountTxs.filter((t: any) => String(t.accountId).toLowerCase() === CAROL.toLowerCase()).map((t: any) => [t.tx.data.lockId, t.tx.data.secret])]);
      for (const m of msgs) bump(kinds, String(m).slice(0, 60));
      if (rwResolves.length > 0) bump(kinds, "resolve");
      if (next.jBatchState?.autoBroadcastDraft) bump(kinds, "latched");
    }
    expectKinds(kinds, ["ok", "resolve", "latched", "HTLC_DISPUTE_EVIDENCE_LOCK_MISSING", "PAYBOOK_SECRET_CONFLICT", "PAYBOOK_ENTITY_CONFLICT", "⚠️ Rejected uncommitted account genesis", "⚠️ Unsafe account frame rejected; dispute start", "⚠️ Unsafe account frame rejected; dispute prep", "⚔️ Dispute started"]);
  }, 120_000);
});

// ---- og j-abort-sent-batch.ts / j-clear-batch.ts releaseFinalizeLatches: settle-jsubmit SJ-19 ----
describe("disputes-final: finalize latches on j_abort_sent_batch / j_clear_batch (og entity/tx/handlers/j-batch)", () => {
  test("MATCH: 200 random aborts and clears over a disputed BOB Account whose disputeFinalize is queued (finalizations for BOB in any case / another peer, draft / sent / recovery batches, requeue / drop) -- same finalizeQueued latch, messages and J batch as og", async () => {
    const r = xrng(0x5319), kinds = new Map<string, number>();
    const nowSec = Math.floor(T0 / 1000);
    for (let i = 0; i < 200; i++) {
      const latched = r() < 0.8, active = { startedByLeft: true, initialProofbodyHash: Z32, initialNonce: 1, initialProposerIsLeft: true, disputeTimeout: nowSec - 10, disputeStartTimestamp: nowSec - 100, jNonce: 1,
        starterInitialArguments: "0x", starterCounterArguments: "0x", starterCounterProofCommitment: Z32, observedOnChain: true, observedBlockNumber: 1, finalizeQueued: latched };
      const fin = () => ({ counterentity: xpick(r, [BOB.toLowerCase(), BOB.toUpperCase().replace("0X", "0x"), W("0c")]), initialNonce: 1, finalNonce: 1, initialProofbodyHash: Z32, finalProofbodyHash: Z32, finalProofbody: undefined, sig: "0x", leftArguments: "0x", rightArguments: "0x", cooperative: false, finalizationEvidenceHash: Z32 });
      const rows = (n: number) => ({ ...ogInitJBatch().batch, disputeFinalizations: Array.from({ length: n }, fin) });
      const shape = xpick(r, ["none", "draft", "sent", "sent", "recovery"] as const);
      const jBatch = shape === "none" ? undefined : { ...ogInitJBatch(), entityNonce: 3, batch: rows(shape === "draft" ? 1 + xint(r, 2) : xint(r, 2)),
        ...(shape === "sent" || shape === "recovery" ? { sentBatch: { batch: rows(xint(r, 3)), entityNonce: 3, batchHash: Z32, encodedBatch: "0x", firstSubmittedAt: 1, lastSubmittedAt: 1, submitAttempts: 1 }, status: "sent" } : {}),
        ...(shape === "recovery" ? { recoveryBatches: [rows(1 + xint(r, 2))] } : {}) };
      const tx: EntityTx = xint(r, 2) === 0 ? { type: "j_clear_batch", data: { ...(r() < 0.5 ? { reason: "manual" } : {}) } } as EntityTx
        : { type: "j_abort_sent_batch", data: { ...(r() < 0.7 ? { requeueToCurrent: r() < 0.5 } : {}), ...(r() < 0.5 ? { reason: "stuck" } : {}) } } as EntityTx;
      const rw = unwrap(createEntity({ id: ALICE, jurisdiction: TERMS.domain, threshold: 1n, members: new Map([[aliceAddr, { shares: 1n }]]), jurisdictionConfig: { name: "j", entityProviderAddress: JEP }, committed: (jBatch === undefined ? {} : { jBatchState: structuredClone(jBatch) }) as never })).state;
      const rwBob = { ...genesisAB(), _tag: "disputed", mempool: [], active } as unknown as AccountReplica;
      const f = foldTx(rw, new Map([[BOB, rwBob]]), tx, { verify: verifiers.verify, timestamp: BigInt(T0), jReplicas: JREPLICAS as never });
      const og: any = { entityId: ALICE, timestamp: T0, height: 0, config: { mode: "proposer-based", threshold: 1n, validators: [ALICE_SIGNERX], shares: { [ALICE_SIGNERX]: 1n }, jurisdiction: OG_JX },
        accounts: new EntityAccountCandidateMap(PersistentEntityAccountMap.fromEntries([[BOB, ogBobAccount("disputed", active)]], ALICE, () => Z32 as never)), ...(jBatch === undefined ? {} : { jBatchState: structuredClone(jBatch) }) };
      const env = { quietRuntimeLogs: true, state: { jReplicas: JREPLICAS } } as never;
      let ogOut: Out<any>;
      try { ogOut = { ok: true, value: tx.type === "j_clear_batch" ? await ogJClear(og, tx as never, env, true) : await ogJAbort(og, tx as never, env, true) }; } catch (e) { ogOut = { ok: false, message: String((e as Error).message) }; }
      expect([i, f.ok ? "ok" : (f.error as any).reason]).toEqual([i, ogOut.ok ? "ok" : ogOut.message]);
      if (!f.ok || !ogOut.ok) continue;
      const next = ogOut.value.newState, after: any = f.value.accountReplicas.get(BOB);
      expect([i, (f.value.events ?? []).map((e) => e.message)]).toEqual([i, readEntityFrameEvents(next).map((e: any) => e.message)]);
      expect([i, f.value.state.committed["jBatchState"]]).toEqual([i, next.jBatchState]);
      const ogLatch = next.accounts.get(BOB).activeDispute.finalizeQueued;
      expect([i, after.active.finalizeQueued]).toEqual([i, ogLatch]);
      bump(kinds, `${tx.type}:${latched && !ogLatch ? "released" : ogLatch ? "kept" : "unlatched"}`);
    }
    expectKinds(kinds, ["j_clear_batch:released", "j_clear_batch:kept", "j_abort_sent_batch:released", "j_abort_sent_batch:kept"]);
  }, 60_000);
});

// ---- og cross-j/salvage.ts and htlc/direct.ts resolveHtlcLock on ALICE's Entity (jCase fixtures) ----
describe("disputes-final: crossJurisdictionSalvage / resolveHtlcLock on the Entity (og entity/tx/handlers/cross-j/salvage.ts, htlc/direct.ts)", () => {
  const payView = (p: any) => stableJson([...(p?.entries ?? new Map())].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]: [string, any]) => [k, { ...v, ...(v.inboundEntity ? { inboundEntity: String(v.inboundEntity).toLowerCase() } : {}), ...(v.outboundEntity ? { outboundEntity: String(v.outboundEntity).toLowerCase() } : {}) }]).concat([["fees", String(p?.feesEarned ?? 0n)]]));
  const withJb = (r: Rand, c: JCase): void => {
    if (xint(r, 3) === 0) return;
    const jb = { ...ogInitJBatch(), batch: { ...ogInitJBatch().batch, revealSecrets: otherRows(r, xpick(r, [0, 0, 1, 49])) }, ...(xint(r, 3) === 0 ? { sentBatch: { batch: { ...ogInitJBatch().batch, revealSecrets: otherRows(r, 1) }, entityNonce: 3, batchHash: Z32 } } : {}) };
    c.rw = { ...c.rw, committed: { ...c.rw.committed, jBatchState: structuredClone(jb) as never } };
    c.og.jBatchState = structuredClone(jb);
  };
  test("MATCH: 250 random reveal ports (owned / foreign / unknown routes, terminal routes, valid / foreign / empty binaries, claimed ratio mismatches, target dispute clock present or not, draft / full / sent J batch) -- same verdict, messages, stashed reveals, J batch and j_broadcast as og", async () => {
    const r = xrng(0x5a17), kinds = new Map<string, number>();
    for (let i = 0; i < 250; i++) {
      const c = jCase(r, i);
      withJb(r, c);
      const k = xint(r, c.routes.length + 1), route = c.routes[k], pre = c.raw[k];
      const ratio = xpick(r, [100, 200, 65_535, 1 + xint(r, 65_534)]);
      const binary = route === undefined || pre === undefined || xint(r, 3) === 0 ? xpick(r, ["0x", unwrapOk(crossPullReveal(ratio, word(r))).binary, unwrapOk(crossPullReveal(ratio, word(r))).binary, ""]) : unwrapOk(crossPullReveal(ratio, unwrapOk(crossPrivateSeed(RUNTIME_SEED, pre)))).binary;
      const claimed = xint(r, 6) === 0 ? xpick(r, [0, ratio + 1, -3]) : ratio;
      const tx = { type: "crossJurisdictionSalvage", data: { routeId: route?.orderId ?? "C-missing", binary, fillRatio: claimed } } as EntityTx;
      const f = foldTx(c.rw, c.replicas, tx, { verify: verifiers.verify, timestamp: BigInt(T0), jReplicas: JREPLICAS as never }, "runtime");
      let ogOut: Out<any>;
      try { ogOut = { ok: true, value: await ogSalvage({ quietRuntimeLogs: true } as never, c.og, tx as never, [], true) }; } catch (e) { ogOut = { ok: false, message: String((e as Error).message) }; }
      expect([i, f.ok ? "ok" : (f.error as any).reason]).toEqual([i, ogOut.ok ? "ok" : ogOut.message]);
      bump(kinds, ogOut.ok ? "ok" : ogOut.message.split(":")[0]!);
      if (!f.ok || !ogOut.ok) continue;
      const d = f.value, next = ogOut.value.newState, msgs = readEntityFrameEvents(next).map((e: any) => e.message);
      expect([i, (d.events ?? []).map((e) => e.message)]).toEqual([i, msgs]);
      expect([i, routeView((d.state.crossJurisdictionSwaps ?? new Map()) as Map<string, any>)]).toEqual([i, routeView(next.crossJurisdictionSwaps)]);
      expect([i, d.state.committed["jBatchState"] ?? null]).toEqual([i, next.jBatchState ?? null]);
      expect([i, d.outputs.map((o: any) => [o.to, o.input?.txs?.map((t: any) => t.type).join(",")])]).toEqual([i, ogOut.value.outputs.map((o: any) => [o.entityId, o.entityTxs.map((t: any) => t.type).join(",")])]);
      for (const m of msgs) bump(kinds, String(m).replace(/C[0-9]+/g, "C#").slice(0, 44));
    }
    expectKinds(kinds, ["ok", "🌉 Cross-j reveal port ignored for C#: inval", "⏳ Cross-j reveal port C#: waiting for the ta", "🌉 Cross-j reveal port C# skipped: route not", "🌉 Cross-j reveal port C#: registering ratio", "❌ Cross-j reveal port C# fill mismatch", "❌ Cross-j reveal port C# invalid pull binary", "⏳ Cross-j reveal port C#: queued behind the", "J_HASH_LADDER_REGISTRATION_CONFLICT"]);
  }, 120_000);
  test("MATCH: 200 random resolveHtlcLock txs (known / unknown Account in any case, malformed / unknown lock ids, wrong or malformed secrets, paybook conflicts, live or disputed Account) -- same verdict, message, paybook, wake and queued htlc_resolve as og", async () => {
    const r = xrng(0x4e50), kinds = new Map<string, number>();
    const slot = { ...bookSlot, putPaybookEntry: (s: any, h: string, e: any) => { s.paybook.entries.set(h, e); } };
    for (let i = 0; i < 200; i++) {
      const c = jCase(r, i), lockIds = [...c.locks.keys()];
      const lockId = xpick(r, [...lockIds, ...lockIds, word(r), "lock-bad"]), lock = c.locks.get(lockId);
      const matching = lock === undefined ? undefined : c.secrets.find((x) => hashHtlcSecret(x) === lock.hashlock);
      const secret = matching !== undefined && xint(r, 5) > 0 ? matching : xpick(r, [word(r), "0x12", ...c.secrets]);
      const tx = { type: "resolveHtlcLock", data: { counterpartyEntityId: xpick(r, [BOB, BOB, BOB.toUpperCase().replace("0X", "0x"), W("0e")]), lockId, secret } } as EntityTx;
      const f = foldTx(c.rw, c.replicas, tx, { verify: verifiers.verify, timestamp: BigInt(T0), jReplicas: JREPLICAS as never });
      let ogOut: Out<any>;
      try { ogOut = { ok: true, value: ogResolveHtlcLock(c.og, tx as never, true, slot as never) }; } catch (e) { ogOut = { ok: false, message: String((e as Error).message) }; }
      expect([i, f.ok ? "ok" : (f.error as any).reason]).toEqual([i, ogOut.ok ? "ok" : ogOut.message]);
      bump(kinds, ogOut.ok ? "ok" : ogOut.message.split(":")[0]!);
      if (!f.ok || !ogOut.ok) continue;
      const d = f.value, next = ogOut.value.newState;
      expect([i, (d.events ?? []).map((e) => e.message)]).toEqual([i, readEntityFrameEvents(next).map((e: any) => e.message)]);
      expect([i, payView(d.state.paybook)]).toEqual([i, payView(next.paybook)]);
      expect([i, d.outputs.map((o: any) => [o.to, o.input?.txs?.length ?? -1])]).toEqual([i, ogOut.value.outputs.map((o: any) => [o.entityId, o.entityTxs.length])]);
      const bob = d.accountReplicas.get(BOB)!;
      if (bob._tag !== "disputed") {
        const queued = bob.mempool.filter((t: any) => t.type === "htlc_resolve").map((t: any) => [BOB, t.lockId, t.secret]);
        expect([i, queued]).toEqual([i, ogOut.value.accountTxs.map((t: any) => [t.accountId, t.tx.data.lockId, t.tx.data.secret])]);
        bump(kinds, "queued");
      }
    }
    expectKinds(kinds, ["ok", "queued", "HTLC_RESOLVE_ACCOUNT_MISSING", "HTLC_RESOLVE_LOCK_ID_INVALID", "HTLC_RESOLVE_SECRET_INVALID", "HTLC_RESOLVE_LOCK_MISSING", "HTLC_RESOLVE_HASHLOCK_MISMATCH", "PAYBOOK_"]);
  }, 120_000);
});
