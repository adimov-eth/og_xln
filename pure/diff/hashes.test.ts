import { describe, expect, test } from "bun:test";
import { encodeAccountStateValue, encodeAccountStateValueOracle, computeCanonicalMerkleRoot } from "../../core/account/commitment/state-root.ts";
import { PersistentAccountStateMap } from "../../core/account/state/persistent-state-map.ts";
import { computeAccountStateRoot } from "../../core/account/commitment/state-root.ts";
import { computeFrameHash } from "../../core/account/consensus/frame/hash.ts";
import { ethers, Interface } from "ethers";
import { Depository__factory } from "../../jurisdictions/typechain-types/factories/Depository.sol/Depository__factory.ts";
import { encodeJBatch, computeBatchHankoHash, createEmptyBatch } from "../../core/jurisdiction/machine/batch/index.ts";
import { hashProofBodyStruct, createDisputeProofHashWithNonce, createSettlementHashWithNonce } from "../../core/protocol/dispute/proof-builder.ts";
import { encodeInt512 } from "../../core/protocol/crypto/abi-money.ts";
import { computeAccountKey } from "../../core/jurisdiction/adapter/events/contract-codec.ts";
import { encodeSignedHanko, encodeHankoEnvelope as ogEncodeHankoEnvelope, packHankoSignatures } from "../../core/hanko/codec.ts";
import { verifyCanonicalHanko } from "../../core/hanko/claims.ts";
import { lazySingleSignerEntityId, recoverShortHankoEntityId } from "../../core/hanko/short.ts";
import { computeCanonicalEntityConsensusStateHash, computeEntityAccountValueHash } from "../../core/entity/consensus/state-root.ts";
import { PersistentEntityAccountMap } from "../../core/entity/state/persistent-account-map.ts";
import { createEntityFrameHashFromStateRoot } from "../../core/entity/consensus/frame.ts";
import { encodeCanonicalValue, flatDigest, mapRoot, bytesToHex, accountFrameHash, accountStateCommitment, EMPTY_J_ROOT, type CommittedAccountState,
  J_EVENT_SIGNATURES, jEventTopic, readJEvents, encodeAccountSettledData, encodeBatch, emptyBatch, encodeBatchHash, encodeProofBodyBytes, proofBodyHash, encodeDisputeProofHash, encodeCooperativeUpdateHash, encodeDisputeHash, encodeAccountKey,
  encodeLazyEntityId, encodeHanko65, encodeHankoEnvelope, packSignatures, verifyAccountHanko, verifyHankoLocal, encodeBoardBytes, entityStateRoot, entityFrameHash, keccak256Hex, hexToBytes, signRaw, wordOf, concat, addressOf, type Batch, type ProofBody } from "../xln.ts";

// seeded PRNG (mulberry32)
const prng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const rng = prng(0xC0FFEE);
const ri = (n: number) => Math.floor(rng() * n);
const pick = <X>(xs: readonly X[]): X => xs[ri(xs.length)] as X;
const randBig = (): bigint => pick([0n, 1n, -1n, 127n, 128n, 255n, 256n, (1n << 255n) - 1n, -(1n << 255n), (1n << 256n) - 1n, BigInt(ri(1e9)) * BigInt(ri(1e9)) * (rng() < 0.5 ? -1n : 1n)]);
const randStr = (): string => pick(["", "a", "A", "0xAbCd", "0x" + "ab".repeat(32), "é", "日本", "x".repeat(60), "k".repeat(200), String(ri(1e6))]);
const randScalar = (): unknown => pick([() => null, () => rng() < 0.5, () => pick([0, -0, 1, -1, 1.5, 1e21, 2 ** 53, ri(1e6)]), randBig, randStr])();
const randValue = (d = 0): unknown => {
  const r = rng();
  if (d > 3 || r < 0.45) return randScalar();
  if (r < 0.6) return Array.from({ length: ri(4) }, () => randValue(d + 1));
  if (r < 0.75) return new Map(Array.from({ length: ri(5) }, () => [pick([randStr, () => ri(100), randBig])(), randValue(d + 1)] as const));
  if (r < 0.82) return new Set(Array.from({ length: ri(4) }, () => randScalar()));
  const o: Record<string, unknown> = {};
  for (let i = ri(6); i > 0; i--) o[pick(["a", "b", "B", "zz", "Z", "_", "10", "9", "é", ""])] = rng() < 0.1 ? undefined : randValue(d + 1);
  return o;
};
const hex = (b: Uint8Array) => bytesToHex(b);
const unwrap = <T,>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.value; };

describe("canonical value encoding (RLP)", () => {
  test("MATCH: encodeCanonicalValue == og encodeAccountStateValue == og oracle on 500 random values", () => {
    for (let i = 0; i < 500; i++) {
      const v = randValue();
      const og = hex(encodeAccountStateValue(v));
      expect(hex(encodeAccountStateValueOracle(v))).toBe(og);
      expect(hex(unwrap(encodeCanonicalValue(v)))).toBe(og);
    }
  });
  test("MATCH: edge scalars", () => {
    for (const v of [null, true, false, 0, -0, 0n, -0n, (1n << 256n) - 1n, -(1n << 255n), "", "\u0000", [], {}, new Map(), new Set(), [[]], { a: undefined }]) {
      expect(hex(unwrap(encodeCanonicalValue(v)))).toBe(hex(encodeAccountStateValue(v)));
    }
  });
  test("MATCH: lone UTF-16 surrogate is refused by both (og UTF8_LONE_SURROGATE, rewrite invalid_utf8)", () => {
    for (const v of ["a\uD800b", { ["\uDC00"]: 1 }, new Map([["\uD800", 1]])]) {
      expect(() => encodeAccountStateValue(v)).toThrow("UTF8_LONE_SURROGATE");
      expect(encodeCanonicalValue(v)).toEqual({ ok: false, error: { _tag: "invalid_utf8" } });
    }
  });
});

describe("flat integrity digest", () => {
  test("MATCH: flatDigest == og computeCanonicalMerkleRoot(ns, entries, 'integrity') on 200 random section lists", () => {
    for (let i = 0; i < 200; i++) {
      const ns = pick(["account.frame", "account.state", "x", ""]);
      const names = [...new Set(Array.from({ length: ri(7) }, () => pick(["identity", "financial", "transactions", "a", "Z", "rebalance", "é"])))];
      const entries = names.map((n) => [n, randValue()] as const);
      expect(unwrap(flatDigest(ns, entries))).toBe(computeCanonicalMerkleRoot(ns, entries, "integrity"));
    }
  });
});

const ogMapRoot = (m: Map<number | string, unknown>): string => PersistentAccountStateMap.fromEntries("locks", m).rootHash();
const flatVal = (): unknown => { let v = randValue(); while (hasColl(v)) v = randValue(); return v; };
const hasColl = (v: unknown): boolean => v instanceof Map || v instanceof Set || (Array.isArray(v) ? v.some(hasColl) : v !== null && typeof v === "object" && Object.values(v).some(hasColl));
describe("account map (radix-16 Patricia) root", () => {
  test("MATCH: mapRoot == og PersistentAccountStateMap.rootHash for 200 random numeric-key maps (0..many keys)", () => {
    for (let i = 0; i < 200; i++) {
      const n = pick([0, 1, 2, 3, 5, 17, 40]);
      const m = new Map<number | string, unknown>();
      for (let k = 0; k < n; k++) m.set(pick([() => ri(20), () => ri(1 << 30), () => Number.MAX_SAFE_INTEGER - ri(3), () => 0])(), flatVal());
      expect(unwrap(mapRoot(m))).toBe(ogMapRoot(m));
    }
  });
  test("MATCH: mapRoot == og for 200 random string-key maps", () => {
    for (let i = 0; i < 200; i++) {
      const n = pick([0, 1, 2, 4, 9, 30]);
      const m = new Map<number | string, unknown>();
      for (let k = 0; k < n; k++) m.set(pick(["lock:", "0x", "a", "ab", "custody:", "debit:"]) + String(ri(50)), flatVal());
      expect(unwrap(mapRoot(m))).toBe(ogMapRoot(m));
    }
  });
});

describe("account map edge cases", () => {
  const og = (m: Map<any, any>) => { try { return PersistentAccountStateMap.fromEntries("locks", m).rootHash(); } catch (e) { return "THROW"; } };
  test("MATCH: prefix collision, nested collection, >10000-byte leaf are refused by both; mixed non-colliding keys hash equal", () => {
    expect(og(new Map<any, any>([[0, 1], ["", 2]]))).toBe("THROW");
    expect(mapRoot(new Map<any, any>([[0, 1], ["", 2]]))).toEqual({ ok: false, error: { _tag: "key_prefix_collision" } });
    expect(og(new Map<any, any>([[1, { a: new Map() }]]))).toBe("THROW");
    expect(mapRoot(new Map<any, any>([[1, { a: new Map() }]]))).toEqual({ ok: false, error: { _tag: "nested_collection" } });
    expect(og(new Map<any, any>([[1, "x".repeat(10001)]]))).toBe("THROW");
    expect(mapRoot(new Map<any, any>([[1, "x".repeat(10001)]]))).toEqual({ ok: false, error: { _tag: "leaf_too_large" } });
    for (const m of [new Map<any, any>([[1, 1], ["a", 2]]), new Map<any, any>([[5, 1], ["abc", 2], [7, 3]]), new Map<any, any>([[0, 1], ["\u0000", 2]])]) expect(unwrap(mapRoot(m))).toBe(og(m));
  });
});

const W = (b: string) => `0x${b.repeat(32)}`;
const TX_TYPES = ["direct_payment", "set_credit_limit", "add_delta", "htlc_lock", "swap_offer", "deposit_collateral", "rebalance_policy", "settle_transition"];
const randTx = (): { type: string; data: any } => {
  const type = pick(TX_TYPES);
  if (type === "settle_transition") return { type, data: { kind: pick(["hanko", "propose", "hanko"]), revision: ri(5), settlementHash: W(pick(["62", "65"])), settlementHanko: "0x" + "ab".repeat(ri(5)), postProof: { nonce: ri(9), proposerIsLeft: rng() < 0.5, proofBodyHash: W("63"), hanko: "0x" + "cd".repeat(ri(4)) } } };
  if (type === "rebalance_policy") return { type, data: { tokenId: ri(4), policyVersion: ri(100), r: randValue() } };
  const data = (() => { const v = randValue(); return v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Map) && !(v instanceof Set) ? v : { v }; })();
  return { type, data };
};
describe("account frame hash", () => {
  test("MATCH: accountFrameHash == og computeFrameHash on 300 random frames (non-j_event_claim txs, incl. settle_transition hanko stripping)", () => {
    for (let i = 0; i < 300; i++) {
      const f = { height: ri(1e6), timestamp: 1_700_000_000_000 + ri(1e9), jHeight: ri(1e5), prevFrameHash: W(pick(["00", "11", "Ab"])), accountStateRoot: W(pick(["33", "aB"])), accountTxs: Array.from({ length: ri(5) }, randTx) };
      expect(unwrap(accountFrameHash(f))).toBe(computeFrameHash({ ...f, stateHash: "" } as any));
    }
  });
  test("MATCH: rebalance_policy with unsafe policyVersion is refused by both", () => {
    const f = { height: 1, timestamp: 1, jHeight: 1, prevFrameHash: W("00"), accountStateRoot: W("00"), accountTxs: [{ type: "rebalance_policy", data: { policyVersion: 2 ** 53 } }] };
    expect(() => computeFrameHash({ ...f, stateHash: "" } as any)).toThrow();
    expect(accountFrameHash(f)).toEqual({ ok: false, error: { _tag: "policy_version" } });
  });
  test("DIVERGES (malformed input): settle_transition kind=hanko without postProof: og throws TypeError, rewrite hashes", () => {
    const f = { height: 1, timestamp: 1, jHeight: 1, prevFrameHash: W("00"), accountStateRoot: W("00"), accountTxs: [{ type: "settle_transition", data: { kind: "hanko", settlementHanko: "0x01" } }] };
    expect(() => computeFrameHash({ ...f, stateHash: "" } as any)).toThrow();
    expect(accountFrameHash(f).ok).toBe(true);
  });
});

const P = (ns: string, m: ReadonlyMap<any, any>) => PersistentAccountStateMap.fromEntries(ns as any, m);
const toOgState = (s: CommittedAccountState, extra: Record<string, unknown> = {}): any => ({
  domain: s.domain, leftEntity: s.leftEntity, rightEntity: s.rightEntity, watchSeed: s.watchSeed, disputeConfig: s.disputeConfig, jNonce: s.jNonce, lastFinalizedJHeight: s.lastFinalizedJHeight,
  leftPendingJClaims: s.leftPendingJClaims, rightPendingJClaims: s.rightPendingJClaims,
  deltas: P("deltas", s.deltas), locks: P("locks", s.locks), pulls: P("pulls", s.pulls), swapOffers: P("swapOffers", s.swapOffers), subcontracts: P("subcontracts", s.subcontracts), lendingIntents: P("lendingIntents", s.lendingIntents),
  requestedRebalance: P("requestedRebalance", s.requestedRebalance), requestedRebalanceFeeState: P("requestedRebalanceFeeState", s.requestedRebalanceFeeState), rebalanceFeePolicies: P("rebalanceFeePolicies", s.rebalanceFeePolicies), ...extra,
});
const strMap = (n: number) => new Map<string, unknown>(Array.from({ length: n }, (_, i) => [`k${i}:${ri(1000)}`, flatVal()]));
const randState = (): CommittedAccountState => {
  const deltas = new Map<number, any>();
  for (let k = ri(6); k > 0; k--) { const tokenId = ri(70000); deltas.set(tokenId, { tokenId, collateral: BigInt(ri(1e9)), ondelta: randBig() % (1n << 200n), offdelta: randBig() % (1n << 200n), leftCreditLimit: BigInt(ri(1e6)), rightCreditLimit: 0n, leftAllowance: 0n, rightAllowance: BigInt(ri(9)), leftHold: 0n, rightHold: BigInt(ri(5)) }); }
  const claims = () => (rng() < 0.7 ? { version: 1 as const, root: EMPTY_J_ROOT, count: 0n } : { version: 1 as const, root: W(pick(["ab", "CD"])), count: BigInt(1 + ri(9)) });
  return {
    domain: { chainId: 1 + ri(40000), depositoryAddress: pick([`0x${"ab".repeat(20)}`, "0x5FbDB2315678afecb367f032d93F642f64180aa3", `0x${"00".repeat(20)}`]) },
    leftEntity: W(pick(["11", "aA"])), rightEntity: W(pick(["22", "Bb"])), watchSeed: W(pick(["44", "eE"])), disputeConfig: { leftResponseSeconds: ri(100), rightResponseSeconds: ri(100) },
    jNonce: ri(10), lastFinalizedJHeight: ri(1000), leftPendingJClaims: claims(), rightPendingJClaims: claims(),
    deltas, locks: strMap(ri(4)), pulls: strMap(ri(2)), swapOffers: strMap(ri(3)), subcontracts: strMap(ri(2)), lendingIntents: strMap(ri(3)),
    requestedRebalance: new Map(Array.from({ length: ri(3) }, () => [ri(100), BigInt(ri(1e6))] as const)), requestedRebalanceFeeState: new Map(), rebalanceFeePolicies: new Map(Array.from({ length: ri(3) }, () => [ri(100), { feePpm: ri(1000) }] as const)),
  };
};
describe("account state commitment", () => {
  test("MATCH: accountStateCommitment == og computeAccountStateRoot on 200 random states without a settlement workspace", () => {
    for (let i = 0; i < 200; i++) {
      const s = randState();
      expect(unwrap(accountStateCommitment(s))).toBe(computeAccountStateRoot(toOgState(s)));
    }
  });
  test("DIVERGES: og binds settlementWorkspace (minus hankos) into the 'commitments' section; rewrite has no such field, so any account with a workspace hashes differently", () => {
    const s = randState();
    const workspace = { version: 1, status: "awaiting_counterparty", diffs: [{ tokenId: 1, leftDiff: -5n, rightDiff: 0n, collateralDiff: 5n, ondeltaDiff: -5n }], nonce: 3, leftHanko: "0xaa", rightHanko: "0xbb" };
    const withWs = computeAccountStateRoot(toOgState(s, { settlementWorkspace: workspace }));
    const without = computeAccountStateRoot(toOgState(s));
    expect(withWs).not.toBe(without);
    expect(unwrap(accountStateCommitment(s))).toBe(without);
    // hanko bytes are excluded on og side
    expect(computeAccountStateRoot(toOgState(s, { settlementWorkspace: { ...workspace, leftHanko: "0xff" } }))).toBe(withWs);
  });
  test("MATCH: mixed-case depository with a bad EIP-55 checksum is refused by both; all-uppercase accepted by both", () => {
    const s = randState();
    const bad = { ...s, domain: { chainId: 1, depositoryAddress: "0x5fbDB2315678afecb367f032d93F642f64180aa3" } };
    expect(() => computeAccountStateRoot(toOgState(bad))).toThrow();
    expect(accountStateCommitment(bad)).toEqual({ ok: false, error: { _tag: "bad_domain" } });
    const upper = { ...s, domain: { chainId: 1, depositoryAddress: "0x5FBDB2315678AFECB367F032D93F642F64180AA3" } };
    expect(unwrap(accountStateCommitment(upper))).toBe(computeAccountStateRoot(toOgState(upper)));
  });
});

// ---------------------------------------------------------------- events
const DEPOSITORY = new Interface(Depository__factory.abi as any);
describe("J event signatures vs Depository ABI (typechain from Types.sol/Depository.sol)", () => {
  test("MATCH: HankoBatchProcessed, ReserveUpdated, DisputeStarted, DisputeFinalized topics equal the contract's", () => {
    for (const n of ["HankoBatchProcessed", "ReserveUpdated", "DisputeStarted", "DisputeFinalized"] as const) {
      const e = DEPOSITORY.getEvent(n)!;
      expect(e.format("sighash")).toBe(J_EVENT_SIGNATURES[n]);
      expect(jEventTopic(n)).toBe(e.topicHash);
    }
  });
  test("DIVERGES: AccountSettled -- contract TokenSettlement.ondelta is Int512 (int256 high, uint256 low); rewrite declares int256, so topic0 differs", () => {
    const e = DEPOSITORY.getEvent("AccountSettled")!;
    expect(e.format("sighash")).toBe("AccountSettled((bytes32,bytes32,(uint256,uint256,uint256,uint256,(int256,uint256))[],uint256)[])");
    expect(J_EVENT_SIGNATURES.AccountSettled).toBe("AccountSettled((bytes32,bytes32,(uint256,uint256,uint256,uint256,int256)[],uint256)[])");
    expect(jEventTopic("AccountSettled")).not.toBe(e.topicHash);
  });
  test("DIVERGES: readJEvents silently drops a real contract AccountSettled log (topic unknown); rewrite's own encoder emits a non-contract layout", () => {
    const settled = [{ left: W("11"), right: W("22"), tokens: [{ tokenId: 1n, leftReserve: 5n, rightReserve: 6n, collateral: 125n, ondelta: -7n }], nonce: 3n }];
    const log = DEPOSITORY.encodeEventLog("AccountSettled", [settled.map((r) => [r.left, r.right, r.tokens.map((t) => [t.tokenId, t.leftReserve, t.rightReserve, t.collateral, [(t.ondelta >> 256n), t.ondelta & ((1n << 256n) - 1n)]]), r.nonce])]);
    expect(readJEvents([{ topics: log.topics, data: log.data }])).toEqual([]);
    expect(encodeAccountSettledData(settled)).not.toBe(log.data);
  });
  test("MATCH: readJEvents decodes contract-encoded HankoBatchProcessed / ReserveUpdated / DisputeStarted / DisputeFinalized logs (randomized, 50 each)", () => {
    for (let i = 0; i < 50; i++) {
      const b = () => W(pick(["11", "aB", "00", "ff"]));
      const u = () => pick([0n, 1n, (1n << 256n) - 1n, BigInt(ri(1e9))]);
      const h = DEPOSITORY.encodeEventLog("HankoBatchProcessed", [b(), b(), u()]);
      const r = DEPOSITORY.encodeEventLog("ReserveUpdated", [b(), u(), u()]);
      const ds = [b(), b(), u(), rng() < 0.5, b(), b(), "0x" + "ab".repeat(ri(40)), "0x" + "cd".repeat(ri(3)), b(), u(), u(), ri(2 ** 32), ri(2 ** 32)] as const;
      const d = DEPOSITORY.encodeEventLog("DisputeStarted", [...ds]);
      const f = DEPOSITORY.encodeEventLog("DisputeFinalized", [b(), b(), u(), b(), b()]);
      const got = readJEvents([h, r, d, f].map((l) => ({ topics: l.topics, data: l.data })));
      expect(got.length).toBe(4);
      const parsed = [h, r, d, f].map((l) => DEPOSITORY.parseLog(l)!);
      const [gh, gr, gd, gf] = got as any[];
      expect([gh.entityId, gh.batchHash, gh.nonce]).toEqual([parsed[0]!.args[0].toLowerCase(), parsed[0]!.args[1].toLowerCase(), parsed[0]!.args[2]]);
      expect([gr.entity, gr.tokenId, gr.newBalance]).toEqual([parsed[1]!.args[0].toLowerCase(), parsed[1]!.args[1], parsed[1]!.args[2]]);
      const a = parsed[2]!.args;
      expect([gd.sender, gd.counterentity, gd.nonce, gd.proposerIsLeft, gd.proofbodyHash, gd.watchSeed, gd.starterInitialArguments, gd.starterCounterArguments, gd.starterCounterProofCommitment, gd.disputeTimeout, gd.disputeStartTimestamp, gd.leftResponseSeconds, gd.rightResponseSeconds])
        .toEqual([a[0].toLowerCase(), a[1].toLowerCase(), a[2], a[3], a[4].toLowerCase(), a[5].toLowerCase(), a[6], a[7], a[8].toLowerCase(), a[9], a[10], a[11], a[12]]);
      expect([gf.finalProofbodyHash, gf.finalizationEvidenceHash]).toEqual([parsed[3]!.args[3].toLowerCase(), parsed[3]!.args[4].toLowerCase()]);
    }
  });
});

// ---------------------------------------------------------------- batch / proof body / hanko payloads
const U256 = (1n << 256n) - 1n;
const rb32 = () => W(pick(["11", "22", "aa", "00", "fe"]));
const ru = () => pick([0n, 1n, U256, BigInt(ri(1e9))]);
const addr = () => pick([`0x${"ab".repeat(20)}`, "0x5FbDB2315678afecb367f032d93F642f64180aa3", `0x${"01".repeat(20)}`]);
const rbytes = () => "0x" + "5a".repeat(ri(70));
const arrOf = <X,>(f: () => X, max = 3): X[] => Array.from({ length: ri(max + 1) }, f);
const randProofBody = (offdeltas = true): ProofBody => {
  const n = ri(4);
  return { watchSeed: rb32(), leftResponseSeconds: BigInt(ri(2 ** 32)), rightResponseSeconds: BigInt(ri(2 ** 32)), offdeltas: offdeltas ? Array.from({ length: n }, () => pick([0n, -1n, 1n, -(1n << 255n), (1n << 255n) - 1n])) : [], tokenIds: offdeltas ? Array.from({ length: n }, () => BigInt(ri(100))) : [],
    transformers: arrOf(() => ({ transformerAddress: addr(), encodedBatch: rbytes(), allowances: arrOf(() => ({ deltaIndex: BigInt(ri(4)), rightAllowance: ru(), leftAllowance: ru() })) }), 2) };
};
const ogProofBody = (b: ProofBody) => ({ ...b, offdeltas: b.offdeltas.map(encodeInt512) });
const randBatch = (withSignedMoney: boolean): Batch => ({
  reserveToReserve: arrOf(() => ({ receivingEntity: rb32(), tokenId: ru(), amount: ru() })),
  reserveToCollateral: arrOf(() => ({ tokenId: ru(), receivingEntity: rb32(), pairs: arrOf(() => ({ entity: rb32(), amount: ru() })) })),
  collateralToReserve: arrOf(() => ({ counterparty: rb32(), tokenId: ru(), amount: ru(), nonce: ru(), sig: rbytes() })),
  settlements: withSignedMoney ? arrOf(() => ({ leftEntity: rb32(), rightEntity: rb32(), diffs: arrOf(() => ({ tokenId: ru(), leftDiff: pick([0n, 5n, -5n]), rightDiff: pick([0n, 3n, -3n]), collateralDiff: pick([0n, 2n]), ondeltaDiff: pick([0n, -1n]) })), forgiveDebtsInTokenIds: arrOf(ru), sig: rbytes(), nonce: ru() })) : [],
  disputeStarts: withSignedMoney ? arrOf(() => ({ counterentity: rb32(), nonce: ru(), proposerIsLeft: rng() < 0.5, proofbodyHash: rb32(), initialProofbody: randProofBody(), watchSeed: rb32(), sig: rbytes(), starterInitialArguments: rbytes(), starterCounterArguments: rbytes(), starterCounterProofCommitment: rb32() }), 1) : [],
  counterDisputes: withSignedMoney ? arrOf(() => ({ counterentity: rb32(), initialNonce: ru(), initialProofbodyHash: rb32(), counterNonce: ru(), proposerIsLeft: rng() < 0.5, counterProofbody: randProofBody(), sig: rbytes() }), 1) : [],
  disputeFinalizations: withSignedMoney ? arrOf(() => ({ counterentity: rb32(), initialNonce: ru(), finalNonce: ru(), proposerIsLeft: rng() < 0.5, initialProofbodyHash: rb32(), finalProofbody: randProofBody(), starterArguments: rbytes(), otherArguments: rbytes(), sig: rbytes(), startedByLeft: rng() < 0.5, cooperative: rng() < 0.5 }), 1) : [],
  externalTokenToReserve: arrOf(() => ({ entity: rb32(), contractAddress: addr(), externalTokenId: ru(), tokenType: BigInt(ri(3)), internalTokenId: ru(), amount: ru() })),
  reserveToExternalToken: arrOf(() => ({ receivingEntity: rb32(), tokenId: ru(), amount: ru() })),
  revealSecrets: arrOf(() => ({ transformer: addr(), secret: rb32() })),
  hashLadderRegistrations: arrOf(() => ({ counterpartyEntity: rb32(), targetRole: rng() < 0.5, fullHash: rb32(), partialRoot: rb32(), witness: { fillRatio: BigInt(ri(65536)), fullSecret: rb32(), reveals: [rb32(), rb32(), rb32(), rb32()] as const } })),
});
const ogBatch = (b: Batch): any => ({ ...b,
  disputeStarts: b.disputeStarts.map((d) => ({ ...d, initialProofbody: ogProofBody(d.initialProofbody) })),
  counterDisputes: b.counterDisputes.map((d) => ({ ...d, counterProofbody: ogProofBody(d.counterProofbody) })),
  disputeFinalizations: b.disputeFinalizations.map((d) => ({ ...d, finalProofbody: ogProofBody(d.finalProofbody) })),
  hashLadderRegistrations: b.hashLadderRegistrations.map((h) => ({ ...h, witness: { ...h.witness, reveals: [...h.witness.reveals] } })) });
const ogEncodeBatchNoLimit = (b: Batch): string => { try { return encodeJBatch(ogBatch(b)); } catch (e) { return "THROW:" + (e as Error).message; } };
describe("Depository Batch ABI", () => {
  test("MATCH: encodeBatch == og encodeJBatch for 200 random batches without settlements/disputes (reserve ops, C2R, external tokens, reveals, hash-ladder)", () => {
    let n = 0;
    for (let i = 0; i < 200; i++) {
      const b = randBatch(false);
      const og = ogEncodeBatchNoLimit(b);
      if (og.startsWith("THROW")) continue;
      n++;
      expect(encodeBatch(b)).toBe(og);
    }
    expect(n).toBeGreaterThan(150);
    expect(encodeBatch(emptyBatch())).toBe(encodeJBatch(createEmptyBatch()));
  });
  test("DIVERGES: any batch with a non-empty settlement diff or dispute proof body with a token encodes differently (SettlementDiff uses SignedAmount, ProofBody.offdeltas uses Int512 on-chain)", () => {
    let diverged = 0, checked = 0;
    for (let i = 0; i < 200; i++) {
      const b = randBatch(true);
      const og = ogEncodeBatchNoLimit(b);
      if (og.startsWith("THROW")) continue;
      checked++;
      const touchesWide = b.settlements.some((s) => s.diffs.length > 0) || [...b.disputeStarts.map((d) => d.initialProofbody), ...b.counterDisputes.map((d) => d.counterProofbody), ...b.disputeFinalizations.map((d) => d.finalProofbody)].some((p) => p.offdeltas.length > 0);
      if (touchesWide) { diverged++; expect(encodeBatch(b)).not.toBe(og); } else expect(encodeBatch(b)).toBe(og);
    }
    expect(diverged).toBeGreaterThan(50);
    expect(checked).toBeGreaterThan(100);
  });
  test("MATCH: encodeBatchHash(domainSeparator=keccak('XLN_DEPOSITORY_HANKO_V1')) == og computeBatchHankoHash (100 random)", () => {
    const dom = keccak256Hex(new TextEncoder().encode("XLN_DEPOSITORY_HANKO_V1"));
    for (let i = 0; i < 100; i++) {
      const encodedBatch = encodeBatch(randBatch(false)), chainId = 1 + ri(1e6), depository = addr(), nonce = ru();
      expect(encodeBatchHash({ domainSeparator: dom, chainId, depository, encodedBatch, nonce: nonce.toString() })).toBe(computeBatchHankoHash(BigInt(chainId), depository, encodedBatch, nonce));
    }
  });
  test("DIVERGES (EXTRA laxness): encodeBatchHash accepts chainId 0 and the zero depository; og requireDepositoryDomain refuses both", () => {
    const dom = keccak256Hex(new TextEncoder().encode("XLN_DEPOSITORY_HANKO_V1"));
    expect(() => computeBatchHankoHash(0n, addr(), "0x", 1n)).toThrow();
    expect(() => computeBatchHankoHash(1n, `0x${"00".repeat(20)}`, "0x", 1n)).toThrow();
    expect(encodeBatchHash({ domainSeparator: dom, chainId: 0, depository: `0x${"00".repeat(20)}`, encodedBatch: "0x", nonce: "1" })).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("ProofBody hash", () => {
  test("DIVERGES: proofBodyHash(int256[] offdeltas) != og hashProofBodyStruct(Int512[] offdeltas) whenever the body has >= 1 token", () => {
    let n = 0;
    for (let i = 0; i < 200; i++) {
      const b = randProofBody();
      const og = hashProofBodyStruct(ogProofBody(b) as any);
      if (b.offdeltas.length > 0) { n++; expect(proofBodyHash(b)).not.toBe(og); } else expect(proofBodyHash(b)).toBe(og);
    }
    expect(n).toBeGreaterThan(100);
  });
  test("MATCH: token-free bodies (the only case where int256[] and Int512[] coincide: empty array) hash identically, incl. transformers", () => {
    for (let i = 0; i < 100; i++) { const b = randProofBody(false); expect(proofBodyHash(b)).toBe(hashProofBodyStruct(ogProofBody(b) as any)); }
  });
});

describe("dispute / cooperative-update hanko digests", () => {
  const domain = { chainId: 31337, depositoryAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3" };
  test("MATCH: encodeDisputeProofHash == og createDisputeProofHashWithNonce (200 random, mixed-case ids, max nonce)", () => {
    for (let i = 0; i < 200; i++) {
      const l = W(pick(["11", "aA", "Ff"])), r = W(pick(["22", "Bb", "00"])), nonce = pick([0, 1, Number.MAX_SAFE_INTEGER, ri(1e6)]), prop = rng() < 0.5, pbh = rb32(), seed = W(pick(["44", "Ee"]));
      const key = encodeAccountKey({ e1: l, e2: r }).lesserThenGreater;
      expect(key.toLowerCase()).toBe(computeAccountKey(l, r).toLowerCase());
      expect(encodeDisputeProofHash({ messageType: 1, chainId: domain.chainId, contractAddress: domain.depositoryAddress, accountKey: key, nonce: String(nonce), proposerIsLeft: prop, proofbodyHash: pbh, watchSeed: seed.toLowerCase() }))
        .toBe(createDisputeProofHashWithNonce({ leftEntity: l, rightEntity: r, watchSeed: seed } as any, pbh, domain, nonce, prop));
    }
  });
  test("DIVERGES (cosmetic): encodeAccountKey preserves input hex case, og computeAccountKey (solidityPacked) returns lowercase", () => {
    const k = encodeAccountKey({ e1: W("AA"), e2: W("bb") }).lesserThenGreater;
    expect(k).toBe(`0x${"AA".repeat(32)}${"bb".repeat(32)}`);
    expect(computeAccountKey(W("AA"), W("bb"))).toBe(k.toLowerCase());
  });
  test("DIVERGES: encodeCooperativeUpdateHash (int256 diffs) != og createSettlementHashWithNonce (SignedAmount diffs) whenever diffs is non-empty", () => {
    for (let i = 0; i < 100; i++) {
      const diffs = arrOf(() => ({ tokenId: ri(100), leftDiff: pick([0n, 5n, -5n, U256, -U256]), rightDiff: pick([0n, 3n, -3n]), collateralDiff: pick([0n, 2n, -2n]), ondeltaDiff: pick([0n, -1n, 1n]) }));
      const forgive = arrOf(() => ri(50)), nonce = ri(1e6), l = W("11"), r = W("22");
      const og = createSettlementHashWithNonce({ leftEntity: l, rightEntity: r } as any, diffs, forgive, domain, nonce);
      const within = diffs.every((d) => [d.leftDiff, d.rightDiff, d.collateralDiff, d.ondeltaDiff].every((x) => x >= -(1n << 255n) && x < 1n << 255n));
      if (!within) { expect(() => encodeCooperativeUpdateHash({ messageType: 0, chainId: domain.chainId, contractAddress: domain.depositoryAddress, accountKey: computeAccountKey(l, r), nonce: String(nonce), diffs: diffs.map((d) => ({ tokenId: String(d.tokenId), leftDiff: String(d.leftDiff), rightDiff: String(d.rightDiff), collateralDiff: String(d.collateralDiff), ondeltaDiff: String(d.ondeltaDiff) })), forgiveDebtsInTokenIds: forgive.map(String) })).toThrow("int256 out of range"); continue; }
      const rw = encodeCooperativeUpdateHash({ messageType: 0, chainId: domain.chainId, contractAddress: domain.depositoryAddress, accountKey: computeAccountKey(l, r), nonce: String(nonce), diffs: diffs.map((d) => ({ tokenId: String(d.tokenId), leftDiff: String(d.leftDiff), rightDiff: String(d.rightDiff), collateralDiff: String(d.collateralDiff), ondeltaDiff: String(d.ondeltaDiff) })), forgiveDebtsInTokenIds: forgive.map(String) });
      if (diffs.length === 0) expect(rw).toBe(og); else expect(rw).not.toBe(og);
    }
  });
  test("MATCH: encodeDisputeHash == keccak(solidityPacked(...)) with Account.sol _encodeDisputeHash layout and _argumentCommitment (100 random)", () => {
    const coder = ethers.AbiCoder.defaultAbiCoder();
    for (let i = 0; i < 100; i++) {
      const c = { nonce: String(ru()), startedByLeft: rng() < 0.5, initialProposerIsLeft: rng() < 0.5, timeout: String(ru()), leftResponseSeconds: ri(2 ** 32), rightResponseSeconds: ri(2 ** 32), proofbodyHash: rb32(), disputeStartTimestamp: String(ru()), starterInitialArguments: rbytes(), starterCounterArguments: rbytes(), starterCounterProofCommitment: rb32() };
      const commit = (a: string) => ethers.keccak256(coder.encode(["bytes", "bool", "uint256"], [a, c.startedByLeft, c.disputeStartTimestamp]));
      const sol = ethers.keccak256(ethers.solidityPacked(["uint256", "bool", "bool", "uint256", "uint32", "uint32", "bytes32", "uint256", "bytes32", "bytes32", "bytes32", "uint256", "bytes32", "bool"],
        [c.nonce, c.startedByLeft, c.initialProposerIsLeft, c.timeout, c.leftResponseSeconds, c.rightResponseSeconds, c.proofbodyHash, c.disputeStartTimestamp, commit(c.starterInitialArguments), commit(c.starterCounterArguments), c.starterCounterProofCommitment, 0, ethers.ZeroHash, false]));
      expect(encodeDisputeHash({ cases: [c] })[0]).toBe(sol);
    }
  });
});

// ---------------------------------------------------------------- hanko
const KEYS = ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"];
const addrOf = (k: string) => new ethers.Wallet(k).address;
const idOf = (a: string) => ethers.zeroPadValue(a, 32).toLowerCase();
const ogVerify = (hanko: string, digest: string, target: string, registered?: string): string => {
  try { return verifyCanonicalHanko({ digest, hanko: hanko as any, expectedTargetEntityId: target, validateBoardAuthority: (id, bh) => registered !== undefined && id === target.toLowerCase() && bh === registered.toLowerCase() }).targetEntityId; }
  catch (e) { return "REJECT"; }
};
const rwVerify = (hanko: string, digest: string, target: string, registered?: string): string => { const r = verifyAccountHanko(hanko, digest, target, registered); return r.ok ? r.value.entityId : "REJECT"; };
const boardHashOf = (threshold: bigint, members: string[], weights: bigint[]) => ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["tuple(uint16,bytes32[],uint16[],uint32,uint32,uint32)"], [[threshold, members, weights, 0, 0, 0]])).toLowerCase();
describe("hanko", () => {
  test("MATCH: encodeLazyEntityId == og lazySingleSignerEntityId (mixed-case, lowercase addresses)", () => {
    for (const k of KEYS) { const a = addrOf(k); for (const v of [a, a.toLowerCase()]) expect(encodeLazyEntityId({ signer: v })).toBe(lazySingleSignerEntityId(v)); }
  });
  test("MATCH: 65-byte hanko entity (encodeHanko65) == og recoverShortHankoEntityId for v in {0,1,27,28}; both reject high-s", () => {
    for (let i = 0; i < 40; i++) {
      const digest = ethers.keccak256(ethers.toUtf8Bytes(String(i)));
      const sig = new ethers.Wallet(pick(KEYS)).signingKey.sign(digest);
      for (const v of [sig.v - 27, sig.v]) {
        const raw = ethers.concat([sig.r, sig.s, Uint8Array.of(v)]);
        expect(encodeHanko65({ hash: digest, hanko: raw, registration: null }).entityId).toBe(recoverShortHankoEntityId(raw, digest));
      }
      const n = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
      const highS = ethers.concat([sig.r, ethers.toBeHex(n - BigInt(sig.s), 32), Uint8Array.of(sig.v === 27 ? 28 : 27)]);
      expect(() => recoverShortHankoEntityId(highS, digest)).toThrow();
      expect(encodeHanko65({ hash: digest, hanko: highS, registration: null }).valid).toBe(false);
    }
  });
  test("MATCH: encodeHankoEnvelope/packSignatures bytes == og encodeHankoEnvelope/packHankoSignatures for canonical inputs", () => {
    for (let i = 0; i < 30; i++) {
      const digest = ethers.keccak256(ethers.toUtf8Bytes("e" + i));
      const keys = KEYS.slice(0, 1 + ri(4));
      const sigs = keys.map((k) => { const s = new ethers.Wallet(k).signingKey.sign(digest); return ethers.getBytes(ethers.concat([s.r, s.s, Uint8Array.of(s.v)])); });
      const packedOg = packHankoSignatures(sigs);
      expect(ethers.hexlify(packSignatures(sigs.map((b) => ({ r: b.subarray(0, 32), s: b.subarray(32, 64), v: b[64]! }))))).toBe(packedOg);
      const claims = [{ entityId: W("cc"), entityIndexes: [0], weights: [1], threshold: 1, boardChangeDelay: 0, controlChangeDelay: ri(5), dividendChangeDelay: 0 }];
      const og = ogEncodeHankoEnvelope({ placeholders: [W("0a")], packedSignatures: packedOg, claims: claims.map((c) => ({ entityId: c.entityId, entityIndexes: c.entityIndexes.map(BigInt), weights: c.weights.map(BigInt), threshold: 1n, boardChangeDelay: 0n, controlChangeDelay: BigInt(c.controlChangeDelay), dividendChangeDelay: 0n })) as any, memberSignatures: [] });
      expect(encodeHankoEnvelope({ placeholders: [W("0a")], packedSignatures: ethers.getBytes(packedOg), claims, memberSignatures: [] })).toBe(og);
    }
  });
  test("DIVERGES (EXTRA laxness): packSignatures accepts v outside {27,28} (treated as bit 0) and high-s; og packHankoSignatures throws", () => {
    const r = new Uint8Array(32).fill(1), s = new Uint8Array(32).fill(0xff);
    expect(() => packHankoSignatures([concat([r, s, Uint8Array.of(5)])])).toThrow();
    expect(packSignatures([{ r, s, v: 5 }]).length).toBe(65);
  });
  test("MATCH: verifyAccountHanko accept/reject + target == og verifyCanonicalHanko on 300 random board hankos (self-hash and registered boards, placeholders, mutations)", () => {
    const digest = ethers.keccak256(ethers.toUtf8Bytes("board-digest"));
    let accepted = 0, rejected = 0;
    for (let i = 0; i < 300; i++) {
      const size = 1 + ri(4);
      const members = KEYS.slice(0, size);
      const weights = members.map(() => BigInt(1 + ri(3)));
      const total = weights.reduce((a, b) => a + b, 0n);
      const threshold = pick([1n, total, 1n + BigInt(ri(Number(total))), total + 1n, 0n]);
      const signs = members.map(() => rng() < 0.6);
      const signerKeys = members.filter((_, j) => signs[j]);
      const placeholderIds = members.filter((_, j) => !signs[j]).map((k) => idOf(addrOf(k)));
      const ids = members.map((k) => idOf(addrOf(k)));
      let pIdx = 0, sIdx = 0;
      let entityIndexes = members.map((_, j) => BigInt(signs[j] ? placeholderIds.length + sIdx++ : pIdx++));
      let ws = [...weights];
      const mut = ri(8);
      if (mut === 1 && entityIndexes.length > 1) entityIndexes = [entityIndexes[0]!, entityIndexes[0]!, ...entityIndexes.slice(2)];
      if (mut === 2) ws = ws.map((w, j) => (j === 0 ? 0n : w));
      if (mut === 3) ws = ws.map((w, j) => (j === 0 ? 70000n : w));
      const board = boardHashOf(threshold <= 0xffffn ? threshold : 1n, ids, weights);
      const registered = mut === 4 ? W("ee") : undefined;
      const entityId = registered !== undefined ? W("ee") : mut === 5 ? W("cd") : board;
      let placeholders = placeholderIds;
      if (mut === 6) placeholders = [...placeholderIds, W("0f")];
      let hanko: string;
      try { hanko = encodeSignedHanko({ digest, privateKeys: signerKeys.map((k) => ethers.getBytes(k)), placeholders: placeholders as any, claims: [{ entityId, entityIndexes, weights: ws, threshold, boardChangeDelay: 0n, controlChangeDelay: 0n, dividendChangeDelay: 0n }] as any }); }
      catch { continue; }
      const target = mut === 7 ? W("99") : entityId;
      const regHash = registered !== undefined ? board : undefined;
      const og = ogVerify(hanko, digest, target, regHash), rw = rwVerify(hanko, digest, target, regHash);
      expect(rw).toBe(og);
      if (og === "REJECT") rejected++; else accepted++;
    }
    expect(accepted).toBeGreaterThan(30);
    expect(rejected).toBeGreaterThan(30);
  });
  test("MATCH: nested claim (entity A member of entity B) and unused-claim rejection agree", () => {
    const digest = ethers.keccak256(ethers.toUtf8Bytes("nested"));
    const [k0, k1] = KEYS as [string, string];
    const a0 = idOf(addrOf(k0)), a1 = idOf(addrOf(k1));
    const inner = boardHashOf(1n, [a0], [1n]);
    const outer = boardHashOf(2n, [a1, inner], [1n, 1n]);
    const good = encodeSignedHanko({ digest, privateKeys: [ethers.getBytes(k0), ethers.getBytes(k1)], placeholders: [], claims: [
      { entityId: inner, entityIndexes: [0n], weights: [1n], threshold: 1n, boardChangeDelay: 0n, controlChangeDelay: 0n, dividendChangeDelay: 0n },
      { entityId: outer, entityIndexes: [1n, 2n], weights: [1n, 1n], threshold: 2n, boardChangeDelay: 0n, controlChangeDelay: 0n, dividendChangeDelay: 0n }] as any });
    expect(rwVerify(good, digest, outer)).toBe(ogVerify(good, digest, outer));
    expect(rwVerify(good, digest, outer)).toBe(outer);
    const unused = encodeSignedHanko({ digest, privateKeys: [ethers.getBytes(k0), ethers.getBytes(k1)], placeholders: [], claims: [
      { entityId: inner, entityIndexes: [0n], weights: [1n], threshold: 1n, boardChangeDelay: 0n, controlChangeDelay: 0n, dividendChangeDelay: 0n },
      { entityId: boardHashOf(1n, [a1], [1n]), entityIndexes: [1n], weights: [1n], threshold: 1n, boardChangeDelay: 0n, controlChangeDelay: 0n, dividendChangeDelay: 0n }] as any });
    expect(ogVerify(unused, digest, boardHashOf(1n, [a1], [1n]))).toBe("REJECT");
    expect(rwVerify(unused, digest, boardHashOf(1n, [a1], [1n]))).toBe("REJECT");
  });
  test("DIVERGES: verifyAccountHanko accepts a numeric/short expected entity id (bytes32Of pads decimal or short hex); og asHankoBytes32 requires 0x+64 hex", () => {
    const digest = ethers.keccak256(ethers.toUtf8Bytes("lazy"));
    const a = addrOf(KEYS[0]!), lazy = lazySingleSignerEntityId(a);
    const hanko = encodeSignedHanko({ digest, privateKeys: [ethers.getBytes(KEYS[0]!)], placeholders: [], claims: [{ entityId: lazy, entityIndexes: [0n], weights: [1n], threshold: 1n, boardChangeDelay: 0n, controlChangeDelay: 0n, dividendChangeDelay: 0n }] as any });
    const decimal = BigInt(lazy).toString();
    expect(ogVerify(hanko, digest, decimal)).toBe("REJECT");
    expect(rwVerify(hanko, digest, decimal)).toBe(lazy);
  });
  test("DIVERGES: verifyHankoLocal (used for board-quorum entity frames, xln.ts:2220) accepts a board whose first member is a claim/placeholder-only and threshold > total power checks are absent; og verifyCanonicalHanko rejects threshold > board power", () => {
    const digest = ethers.keccak256(ethers.toUtf8Bytes("local"));
    const a0 = idOf(addrOf(KEYS[0]!));
    // threshold 1, weight 1, but pad the board with a zero-power? not encodable; instead: first member is a placeholder (non-address id) — og FIRST_MEMBER_EOA_REQUIRED
    const ph = W("ff");
    const board = boardHashOf(1n, [ph, a0], [1n, 1n]);
    const hanko = encodeSignedHanko({ digest, privateKeys: [ethers.getBytes(KEYS[0]!)], placeholders: [ph] as any, claims: [{ entityId: board, entityIndexes: [0n, 1n], weights: [1n, 1n], threshold: 1n, boardChangeDelay: 0n, controlChangeDelay: 0n, dividendChangeDelay: 0n }] as any });
    expect(ogVerify(hanko, digest, board)).toBe("REJECT");
    expect(rwVerify(hanko, digest, board)).toBe("REJECT");
    const local = verifyHankoLocal(hanko, digest, null);
    expect(local.ok && local.value.valid).toBe(true);
  });
});
