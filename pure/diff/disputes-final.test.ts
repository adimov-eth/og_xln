// Behavioural diff: og disputes and cross-j recovery (core/protocol/dispute/proof-builder.ts, entity/tx/handlers/dispute/*, entity/tx/j-events*.ts) vs pure/xln.ts.
// "MATCH:" tests run og live on the same inputs and assert the same accept / reject, state and bytes.
import { describe, expect, test } from "bun:test";
import {
  accountProofBody, committedView, deltaTransformerFor, proofBodyHash, tokenId,
  type AccountBody, type HtlcLock, type JReplica, type PullRow, type SwapOffer, type TokenId,
} from "../xln.ts";
import { TERMS, TEST_CONTRACTS, genesisAB, unwrap } from "../xln_run.ts";
import { buildAccountProofBody } from "../../core/protocol/dispute/proof-builder.ts";
import { requireAccountDeltaTransformerAddress } from "../../core/account/consensus/helpers.ts";

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
