// Final sweep: the last recorded divergences, each proved against live og (core/ at 566c850).
// "MATCH:" tests assert equivalence; findings in pure/findings/final-sweep.md.
import { describe, expect, test } from "bun:test";
import { ethers } from "ethers";
import { applyAccountTxMutation } from "../../core/account/tx/mutation.ts";
import { handleSettleTransition } from "../../core/account/tx/handlers/settlement/transition.ts";
import { beginAccountTransition, accountTransitionView, commitAccountTransition, discardAccountTransition } from "../../core/account/state/candidate-overlay.ts";
import { PersistentAccountStateMap } from "../../core/account/state/persistent-state-map.ts";
import { resolveObserverCertifiedAccountCounterpartyProposer as ogCertifiedProposer } from "../../core/entity/account/account-counterparty-route.ts";
import { decodeBuffer as ogDecodeBuffer } from "../../core/storage/codec/codec.ts";
import { applyRuntime, convertOutput, createRuntime, lazyBoardEntityId, runtimeOutputRows, type EntityOutput, type EntityTx, type Runtime, type RoutedEntityInput, type RuntimeTx } from "../xln.ts";
import { TERMS, aliceAddr, bobAddr, verifiers } from "../xln_run.ts";
import {
  accountId,
  accountTerms,
  accountTxFailure,
  applyAccountBody,
  committed,
  entityId,
  genesisAccount,
  genesisAccountBody,
  stableJson,
  type AccountBody,
  type FoldCtx,
} from "../xln.ts";

const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
type Rand = () => number;
const pick = <T,>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
const hex = (r: Rand, bytes: number): string => "0x" + Array.from({ length: bytes }, () => Math.floor(r() * 256).toString(16).padStart(2, "0")).join("");
const W = (byte: string): string => `0x${byte.repeat(32)}`;
const LEFT = W("11"), RIGHT = W("22"), DEP = `0x${"ab".repeat(20)}`;
const unwrapR = <T,>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => { if (!r.ok) throw new Error(`unwrap: ${stableJson(r.error)}`); return r.value; };
const openAccount = (credit: bigint): AccountBody => {
  const terms = unwrapR(accountTerms({ domain: { chainId: 1, depositoryAddress: DEP }, watchSeed: W("44"), disputeConfig: { leftResponseSeconds: 1, rightResponseSeconds: 1 } }) as never);
  let body = genesisAccountBody(genesisAccount(unwrapR(accountId(unwrapR(entityId(LEFT) as never), unwrapR(entityId(RIGHT) as never)) as never)), terms as never);
  for (const tokenId of ["1", "2", "3"]) for (const byLeft of [true, false])
    body = unwrapR(applyAccountBody(body, { type: "set_credit_limit", tokenId, limit: credit } as never, { byLeft, nowMs: 1n, jHeight: 0n, accountHeight: 1n }) as never as { ok: true; value: { state: AccountBody } }).state;
  return body;
};
const PA = (ns: string, m: ReadonlyMap<unknown, unknown> = new Map()) => PersistentAccountStateMap.fromEntries(ns as never, m as never);
type OgRun = { ok: boolean; root?: string; error?: string; thrown?: boolean };
/** og side: a persistent og replica seeded from the rewrite's committed view, driven through the real transition overlay; a thrown handler error is reported as such. */
const ogHarness = (body: AccountBody) => {
  const v: any = unwrapR(committed(body) as never as { ok: true; value: { view: unknown } }).view;
  const state: any = { domain: v.domain, leftEntity: v.leftEntity, rightEntity: v.rightEntity, watchSeed: v.watchSeed, disputeConfig: v.disputeConfig, jNonce: v.jNonce, lastFinalizedJHeight: v.lastFinalizedJHeight,
    leftPendingJClaims: v.leftPendingJClaims, rightPendingJClaims: v.rightPendingJClaims,
    ...Object.fromEntries(["deltas", "locks", "pulls", "swapOffers", "subcontracts", "lendingIntents", "requestedRebalance", "requestedRebalanceFeeState", "rebalanceFeePolicies"].map((n) => [n, PA(n, v[n])])) };
  let replica: any = { state, status: "active", currentHeight: 0, proofHeader: { fromEntity: LEFT, toEntity: RIGHT, nextProofNonce: 1 }, currentFrame: { stateHash: "" }, pendingWithdrawals: PA("pendingWithdrawals"),
    shadow: { rebalance: { policy: PA("rebalanceShadowPolicy"), submittedAtByToken: PA("rebalanceShadowSubmitted", body.submittedAt ?? new Map()) } }, mempool: [] };
  const run = async (handler: (draft: any) => Promise<any> | any): Promise<OgRun> => {
    const overlay = beginAccountTransition(replica);
    let r: any;
    try { r = await handler(accountTransitionView(overlay)); } catch (e) { discardAccountTransition(overlay); return { ok: false, error: e instanceof Error ? e.message : String(e), thrown: true }; }
    if (!r.ok) { discardAccountTransition(overlay); return { ok: false, error: r.rejection?.message, thrown: false }; }
    const c = commitAccountTransition(overlay, "diff");
    replica = c.account;
    return { ok: true, root: c.accountStateRoot };
  };
  return { run, replica: () => replica };
};
const toOg = (tx: any): any => {
  const { type, ...data } = tx;
  for (const k of ["tokenId", "giveTokenId", "wantTokenId", "feeTokenId", "requestTokenId"]) if (typeof data[k] === "string") data[k] = Number(data[k]);
  if (type === "htlc_lock") data.revealBeforeHeight = Number(data.revealBeforeHeight);
  if (type === "set_credit_limit") { data.amount = data.limit; delete data.limit; }
  return { type: type === "payment" ? "direct_payment" : type, data };
};

// ---------- disputes-final: og per-tx replay failure text (`Frame application failed: <og message>`) ----------
describe("final-sweep: og per-tx failure text for every Account tx handler", () => {
  const LEND = (p: string, r: Rand) => `${p}-${hex(r, 8).slice(2)}`;
  /** A random tx, deliberately malformed on some field more often than not. */
  const gen = (r: Rand, body: AccountBody, byLeft: boolean, ts: number, jh: number, known: { secrets: string[]; offers: string[]; lend: string[] }): any => {
    const me = byLeft ? LEFT : RIGHT, peer = byLeft ? RIGHT : LEFT, tk = pick(r, ["1", "2", "3", "4", "70000"]);
    const amt = (): bigint => pick(r, [0n, 1n, 5n, 50n, 10n ** 15n, 10n ** 30n, (1n << 256n)]);
    switch (Math.floor(r() * 16)) {
      case 0: return { type: "add_delta", tokenId: pick(r, ["1", "5", "70000"]) };
      case 1: return { type: "set_credit_limit", tokenId: tk, limit: pick(r, [-1n, 5n, 10n ** 21n, (1n << 256n)]) };
      case 2: {
        const mode = pick(r, ["direct", "direct", "trusted", "bogus"]), route = pick(r, [[peer], [peer, W("33")], [], [me], [W("33")]]);
        return { type: "payment", tokenId: pick(r, ["1", "2", "4"]), amount: amt(), route, fromEntityId: r() < 0.9 ? me : peer, toEntityId: peer, deliveryMode: mode, ...(mode !== "direct" || r() < 0.1 ? (r() < 0.8 ? { trustedGatewayEntityId: pick(r, [peer, me]) } : {}) : {}), ...(r() < 0.3 ? { description: "memo" } : {}) };
      }
      case 3: {
        const secret = hex(r, 32), h = ethers.keccak256(secret);
        if (r() < 0.7) known.secrets.push(secret);
        return { type: "htlc_lock", lockId: r() < 0.9 ? h : W("aa"), hashlock: h, timelock: pick(r, [BigInt(ts), BigInt(ts) + 10n ** 6n]), revealBeforeHeight: pick(r, [BigInt(jh), BigInt(jh) + 50n]), amount: pick(r, [0n, 3n, 5n, 10n ** 30n]), tokenId: pick(r, ["1", "2", "4"]),
          ...(r() < 0.1 ? { envelope: { version: "xln:htlc-opaque:aes-gcm", ciphertext: "!!" } } : {}) };
      }
      case 4: {
        const secret = known.secrets.length > 0 && r() < 0.8 ? pick(r, known.secrets) : hex(r, 32), h = ethers.keccak256(secret);
        return r() < 0.5 ? { type: "htlc_resolve", lockId: h, outcome: "secret", secret: pick(r, [secret, secret, hex(r, 32), "0x12"]) } : { type: "htlc_resolve", lockId: h, outcome: "error", ...(r() < 0.5 ? { reason: pick(r, ["no_route", "timeout"]) } : {}) };
      }
      case 5: {
        const bad = r() < 0.55 ? Math.floor(r() * 12) : -1, at = <T,>(k: number, good: T, wrong: T): T => (bad === k ? wrong : good);
        const id = at(0, `off${ts}${Math.floor(r() * 1e6)}`, pick(r, ["bad:id", ...known.offers.slice(0, 1)]));
        if (!id.includes(":")) known.offers.push(id);
        const give = pick(r, ["1", "2"]), want = at(1, give === "1" ? pick(r, ["2", "3"]) : "3", give), g = at(2, pick(r, [10n ** 15n, 3n * 10n ** 15n, 10n ** 19n]), pick(r, [10n ** 11n, 0n, 10n ** 80n])), w = at(3, pick(r, [2n * 10n ** 15n, 10n ** 15n, 7n * 10n ** 14n]), pick(r, [1n, 0n, 10n ** 80n]));
        return { type: "swap_offer", offerId: id, giveTokenId: give, giveTokenDecimals: at(4, 18, 300), giveAmount: g, wantTokenId: want, wantTokenDecimals: at(5, 18, pick(r, [6, -1])), wantAmount: w,
          maxFee: at(6, 0n, pick(r, [w, -1n])), minNetReceive: at(7, w, pick(r, [0n, w + 1n])), ...(bad === 8 ? { priceTicks: pick(r, [0n, 1n, 20_000n, 99_999n]) } : {}), ...(bad === 9 ? { timeInForce: pick(r, [1, 5]) } : {}) };
      }
      case 6: return { type: "swap_cancel_request", offerId: known.offers.length > 0 && r() < 0.8 ? pick(r, known.offers) : "nope" };
      case 7: {
        const live = [...body.offers.keys()], offerId = live.length > 0 && r() < 0.9 ? pick(r, live) : "nope", o = body.offers.get(offerId), qG = o?.quantizedGive ?? 10n ** 15n, qW = o?.quantizedWant ?? 10n ** 15n;
        const bad = r() < 0.6 ? Math.floor(r() * 10) : -1, at = <T,>(k: number, good: T, wrong: T): T => (bad === k ? wrong : good);
        const fill = at(0, pick(r, [0, 65535, 32768, 1000]), pick(r, [70000, -1])), fG = fill >= 65535 ? qG : (qG * BigInt(Math.max(0, fill))) / 65535n, fW = at(1, fW0(qG, qW, fG), pick(r, [0n, qW * 2n, (fW0(qG, qW, fG) || 2n) - 1n]));
        return { type: "swap_resolve", offerId, fillRatio: fill, cancelRemainder: r() < 0.5, ...(fill !== 0 || bad === 2 ? (bad === 3 ? { executionGiveAmount: fG } : { executionGiveAmount: at(4, fG, fG + 1n), executionWantAmount: fW }) : {}),
          ...(bad === 5 ? { feeAmount: pick(r, [-1n, 1n, fW, 10n ** 14n]), ...(r() < 0.5 ? { feeTokenId: pick(r, ["1", "2", "3"]) } : {}) } : {}), ...(bad === 6 ? { fillNumerator: pick(r, [1n, 5n]), ...(r() < 0.8 ? { fillDenominator: pick(r, [0n, 2n, 3n]) } : {}) } : {}),
          ...(bad === 7 ? { restingGiveAmount: 1n } : {}), ...(bad === 8 ? { restingPriceTicks: 1n } : {}) };
      }
      case 8: {
        const bad = r() < 0.5 ? Math.floor(r() * 7) : -1, at = <T,>(k: number, good: T, wrong: T): T => (bad === k ? wrong : good);
        return { type: "request_collateral", tokenId: at(0, pick(r, ["1", "2"]), "5"), amount: at(1, pick(r, [3n, 1000n, 10n ** 6n]), 0n), ...(r() < 0.4 || bad === 2 ? { feeTokenId: at(2, "2", "6") } : {}), feeAmount: at(3, pick(r, [2n, 5n]), pick(r, [-1n, 0n, 10n ** 25n])), policyVersion: at(4, 1, 0) };
      }
      case 9: {
        const fees = [...body.requestFees.entries()][0];
        return { type: "rebalance_refund", requestId: pick(r, [fees?.[1].requestId ?? "x", fees?.[1].requestId ?? "x", "", "other"]), requestTokenId: fees?.[0] ?? "1", amount: pick(r, [0n, 1n, 2n, 10n ** 6n]), reason: pick(r, ["manual", "manual", "timeout"]) };
      }
      case 10: return { type: "rebalance_policy", tokenId: pick(r, ["0", "1", "2", "5"]), policyVersion: pick(r, [0, 1, 2]), baseFee: pick(r, [-1n, 1n, 2n]), liquidityFeeBps: pick(r, [1n, 20_000n]), gasFee: 1n };
      case 11: {
        const id = pick(r, [LEND("lend", r), LEND("lend", r), "lend-x", LEND("loan", r), ...known.lend.slice(0, 1)]);
        known.lend.push(id);
        return { type: "lending_fund", positionId: id, hubEntityId: pick(r, [peer, peer, me]), lenderEntityId: pick(r, [me, me, peer, "0xnope"]), tokenId: "1", amount: pick(r, [0n, 1n, 10n ** 30n]), termId: pick(r, ["1d", "1d", "2y"]), interestBps: pick(r, [5, 5, 20_000]) };
      }
      case 12: {
        const id = pick(r, [LEND("loan", r), LEND("loan", r), "loan-", ...known.lend.slice(0, 1)]);
        return pick(r, [
          { type: "lending_repay", loanId: id, hubEntityId: peer, borrowerEntityId: pick(r, [me, me, peer]), tokenId: "1", amount: pick(r, [0n, 2n, 10n ** 30n]) },
          { type: "lending_credit", action: pick(r, ["grant", "revoke"]), loanId: id, hubEntityId: pick(r, [me, me, peer]), borrowerEntityId: pick(r, [peer, peer, me]), tokenId: pick(r, ["1", "70000"]), creditLimit: pick(r, [-1n, 4n, (1n << 256n)]) },
          { type: "lending_borrow_request", requestId: pick(r, [LEND("borrow", r), "borrow-1"]), hubEntityId: peer, borrowerEntityId: me, tokenId: "1", amount: pick(r, [0n, 3n]), termId: pick(r, ["1h", "9h"]), maxInterestBps: pick(r, [1, -5]) },
        ]);
      }
      case 13: {
        const id = pick(r, [LEND("lend", r), "lend-zz", ...known.lend.slice(0, 1)]);
        return r() < 0.5 ? { type: "lending_close_request", positionId: id, hubEntityId: peer, lenderEntityId: pick(r, [me, peer]) }
          : { type: "lending_close_payout", positionId: id, hubEntityId: pick(r, [me, peer]), lenderEntityId: peer, tokenId: "1", amount: pick(r, [0n, 1n, 10n ** 30n]) };
      }
      case 14: {
        const cur = body.settlement, revision = pick(r, [0, 1, 2, (cur?.revision ?? 0) + 1]);
        const op = (): any => pick(r, [{ type: "r2c", tokenId: 1, amount: pick(r, [0n, 5n, 10n ** 30n]) }, { type: "c2r", tokenId: pick(r, [1, 9, 70000]), amount: 2n }, { type: "forgive", tokenId: 2 },
          { type: "rawDiff", tokenId: 1, leftDiff: 1n, rightDiff: 0n, collateralDiff: 0n, ondeltaDiff: 0n }, { type: "swap", tokenId: 1, amount: 1n }, { type: "r2r", tokenId: 3, amount: pick(r, [1n, 10n ** 25n]) }]);
        return { type: "settle_transition", kind: "upsert", revision, ops: Array.from({ length: Math.floor(r() * 3) }, op), executorIsLeft: r() < 0.5,
          ...(revision > 1 ? { previousWorkspaceHash: pick(r, [cur?.workspaceHash ?? W("77"), W("77"), "0x12"]) } : r() < 0.1 ? { previousWorkspaceHash: W("77") } : {}) };
      }
      default: {
        const cur = body.settlement;
        return { type: "settle_transition", kind: pick(r, ["clear", "submit"]), revision: pick(r, [cur?.revision ?? 1, 0, 9]), workspaceHash: pick(r, [cur?.workspaceHash ?? W("78"), W("78"), "0x1"]) };
      }
    }
  };
  const fW0 = (qG: bigint, qW: bigint, fG: bigint): bigint => (qG === 0n ? 0n : (fG * qW + qG - 1n) / qG);

  test("MATCH: 80 random lockstep sequences over every same-j handler: og's rejection text (or thrown Error) equals accountTxFailure at every refusal", async () => {
    const r = rng(9091);
    const seen = new Set<string>();
    let refusals = 0, thrown = 0;
    const texts = new Set<string>();
    for (let n = 0; n < 80; n++) {
      const start = openAccount(10n ** 20n);
      const og = ogHarness(start);
      let body = start;
      const known = { secrets: [] as string[], offers: [] as string[], lend: [] as string[] };
      for (let i = 0; i < 40; i++) {
        const byLeft = r() < 0.5, ts = 10 + i, jh = 1 + Math.floor(i / 4);
        const tx = gen(r, body, byLeft, ts, jh, known);
        const o = await og.run((acc) => applyAccountTxMutation(acc, toOg(tx), byLeft, ts, jh, false, undefined, undefined, undefined, []));
        const ctx: FoldCtx = { byLeft, nowMs: BigInt(ts), jHeight: BigInt(jh), accountHeight: 1n };
        const rw = applyAccountBody(body, tx, ctx) as any;
        if (rw.ok !== o.ok) throw new Error(`accept mismatch og=${o.ok}(${o.error}) rw=${rw.ok ? "ok" : stableJson(rw.error)} tx=${stableJson(tx)}`);
        if (rw.ok) { body = rw.value.state; expect(unwrapR(committed(body) as never as { ok: true; value: { root: string } }).root).toBe(o.root!); continue; }
        const f = accountTxFailure(body, tx, ctx, rw.error, LEFT, { nextProofNonce: 1 });
        if (stableJson({ thrown: f.thrown, message: f.message }) !== stableJson({ thrown: o.thrown, message: o.error })) throw new Error(`text mismatch og=${o.thrown ? "threw" : "rejected"}(${o.error}) rw=${stableJson(f)} tx=${stableJson(tx)}`);
        refusals++; if (f.thrown) thrown++; texts.add(f.message.replace(/[0-9a-fx]{6,}|-?\d+/g, "#"));
        seen.add(tx.type);
      }
    }
    if (process.env["SWEEP_TEXTS"]) console.log([...texts].sort().join("\n"));
    expect(texts.size).toBeGreaterThan(100);
    expect(refusals).toBeGreaterThan(600);
    expect(thrown).toBeGreaterThan(20);
    for (const type of ["add_delta", "set_credit_limit", "payment", "htlc_lock", "htlc_resolve", "swap_offer", "swap_cancel_request", "swap_resolve", "request_collateral", "rebalance_refund", "rebalance_policy",
      "lending_fund", "lending_repay", "lending_credit", "lending_borrow_request", "lending_close_request", "lending_close_payout", "settle_transition"]) expect([type, seen.has(type)]).toEqual([type, true]);
  });

  /** One og/rewrite lockstep: each step applies to both; a refusal must carry og's exact text and thrown-ness. */
  const textLockstep = (start: AccountBody) => {
    const og = ogHarness(start);
    let body = start;
    const step = async (tx: any, byLeft: boolean, ts = 20, jh = 2, ogCtx?: any, settlement?: FoldCtx["settlement"]): Promise<{ ok: boolean; message?: string; thrown?: boolean }> => {
      const o = await og.run((acc) => (tx.type === "settle_transition" && ogCtx !== undefined ? handleSettleTransition(acc, toOg(tx), byLeft, ts, ogCtx) : applyAccountTxMutation(acc, toOg(tx), byLeft, ts, jh, false, undefined, undefined, undefined, [])));
      const ctx: FoldCtx = { byLeft, nowMs: BigInt(ts), jHeight: BigInt(jh), accountHeight: 1n, ...(settlement === undefined ? {} : { settlement }) };
      const rw = applyAccountBody(body, tx, ctx) as any;
      if (rw.ok !== o.ok) throw new Error(`accept mismatch og=${o.ok}(${o.error}) rw=${rw.ok ? "ok" : stableJson(rw.error)} tx=${stableJson(tx)}`);
      if (rw.ok) { body = rw.value.state; return { ok: true }; }
      const f = accountTxFailure(body, tx, ctx, rw.error, LEFT, { nextProofNonce: 1 });
      expect({ thrown: f.thrown, message: f.message }).toEqual({ thrown: o.thrown!, message: o.error! });
      return { ok: false, message: f.message, thrown: f.thrown };
    };
    return { step, body: () => body };
  };

  test("MATCH: targeted failures (128-row cap caught vs thrown, expired and malformed HTLC secrets, lending replay, maker limit price) carry og's text", async () => {
    const L = textLockstep(openAccount(10n ** 20n));
    for (let t = 4; t <= 128; t++) expect((await L.step({ type: "add_delta", tokenId: String(t) }, true)).ok).toBe(true);
    expect(await L.step({ type: "add_delta", tokenId: "129" }, true)).toEqual({ ok: false, message: "ACCOUNT_DELTA_ROW_LIMIT_EXCEEDED:insert:129:128", thrown: false });
    expect(await L.step({ type: "set_credit_limit", tokenId: "129", limit: 1n }, false)).toMatchObject({ thrown: false });
    const secret = W("5a"), h = ethers.keccak256(secret);
    expect((await L.step({ type: "htlc_lock", lockId: h, hashlock: h, timelock: 10n ** 6n, revealBeforeHeight: 50n, amount: 5n, tokenId: "129" }, true)).thrown).toBe(true);
    expect((await L.step({ type: "payment", tokenId: "129", amount: 1n, route: [RIGHT], fromEntityId: LEFT, toEntityId: RIGHT, deliveryMode: "direct" }, true)).thrown).toBe(true);
    expect((await L.step({ type: "htlc_lock", lockId: h, hashlock: h, timelock: 100n, revealBeforeHeight: 50n, amount: 5n, tokenId: "1" }, true, 20, 2)).ok).toBe(true);
    expect((await L.step({ type: "htlc_resolve", lockId: h, outcome: "secret", secret: "0x12" }, false, 30, 2)).message).toBe("Invalid secret: HTLC secret must be 32-byte hex (got 4 chars)");
    expect((await L.step({ type: "htlc_resolve", lockId: h, outcome: "secret", secret }, false, 100, 2)).message).toBe("Lock expired: timestamp=100/100 jHeight=2/50");
    expect((await L.step({ type: "htlc_resolve", lockId: h, outcome: "error", reason: "timeout" }, false, 30, 2)).message).toBe("Lock not expired yet");
    const pos = "lend-00000000000000aa", fund = { type: "lending_close_request", positionId: pos, hubEntityId: RIGHT, lenderEntityId: LEFT };
    expect((await L.step(fund, true)).ok).toBe(true);
    expect(await L.step(fund, true)).toEqual({ ok: false, message: `LENDING_INTENT_REPLAY:close:${pos}`, thrown: true });
    const offer = { type: "swap_offer", offerId: "mk1", giveTokenId: "1", giveTokenDecimals: 18, giveAmount: 10n ** 15n, wantTokenId: "2", wantTokenDecimals: 18, wantAmount: 2n * 10n ** 15n, maxFee: 0n, minNetReceive: 1n };
    expect((await L.step(offer, true)).ok).toBe(true);
    const o = L.body().offers.get("mk1")!;
    const below = await L.step({ type: "swap_resolve", offerId: "mk1", fillRatio: 65535, cancelRemainder: true, executionGiveAmount: o.quantizedGive, executionWantAmount: o.quantizedWant - 1n }, false);
    expect(below.message).toStartWith("Execution violates maker limit price: offer=mk1 makerIsLeft=true");
  });

  test("MATCH: settlement hanko failures carry og's texts (context, nonce against the account and workspace basis, hash, post-proof nonce, body and dispute hash)", async () => {
    const jurisdictions = { jReplicas: new Map([["j", { chainId: 1, contracts: { depository: DEP, entityProvider: `0x${"c1".repeat(20)}`, account: `0x${"c2".repeat(20)}`, deltaTransformer: `0x${"c3".repeat(20)}` } }]]) } as any;
    const ogCtx: any = { jReplicas: jurisdictions.jReplicas, resolveSettlementBoardAuthority: async () => undefined, verifyHanko: async (_h: string, _m: string, entityId: string) => ({ valid: true, entityId }) };
    const settlement = { verify: () => true, proofNonceFloor: 1 };
    const L = textLockstep(openAccount(10n ** 20n));
    expect((await L.step({ type: "settle_transition", kind: "upsert", revision: 1, ops: [{ type: "r2c", tokenId: 1, amount: 5n }], executorIsLeft: true }, true, 1, 0, ogCtx, settlement)).ok).toBe(true);
    const hash = L.body().settlement!.workspaceHash;
    const hanko = (patch: any = {}, post: any = {}) => ({ type: "settle_transition", kind: "hanko", revision: 1, workspaceHash: hash, settlementNonce: 1, settlementHash: W("00"), settlementHanko: "0xbb",
      postProof: { nonce: 2, proposerIsLeft: false, proofBodyHash: W("00"), disputeHash: W("00"), hanko: "0x01", ...post }, ...patch });
    const seen: string[] = [];
    const learn = async (tx: any): Promise<any> => {
      for (let i = 0; i < 6; i++) {
        const r = await L.step(tx, false, 5, 0, ogCtx, settlement);
        if (r.ok) return tx;
        seen.push(r.message!.split(":")[0]!);
        const m = /^(SETTLEMENT_HANKO_HASH_MISMATCH|POST_SETTLEMENT_PROOF_BODY_HASH_MISMATCH|POST_SETTLEMENT_DISPUTE_HASH_MISMATCH):0x[0-9a-fA-F]+:(0x[0-9a-fA-F]+)$/.exec(r.message!);
        if (m === null) return tx;
        if (m[1] === "SETTLEMENT_HANKO_HASH_MISMATCH") tx.settlementHash = m[2]; else if (m[1] === "POST_SETTLEMENT_PROOF_BODY_HASH_MISMATCH") tx.postProof.proofBodyHash = m[2]; else tx.postProof.disputeHash = m[2];
      }
      return tx;
    };
    await L.step(hanko({ settlementNonce: 7 }), false, 5, 0, ogCtx, settlement);
    await L.step(hanko({ settlementNonce: 0 }), false, 5, 0, ogCtx, settlement);
    await L.step(hanko({ settlementHash: "0x12" }), false, 5, 0, ogCtx, settlement);
    await L.step(hanko({}, { nonce: 5 }), false, 5, 0, ogCtx, settlement);
    await L.step(hanko({ workspaceHash: W("99") }), false, 5, 0, ogCtx, settlement);
    await learn(hanko());
    expect(seen).toEqual(["SETTLEMENT_HANKO_HASH_MISMATCH", "POST_SETTLEMENT_PROOF_BODY_HASH_MISMATCH", "POST_SETTLEMENT_DISPUTE_HASH_MISMATCH"]);
    // signed: the workspace basis pins nonceAtSign; every other tx is frozen
    expect((await L.step(hanko({ settlementNonce: 3 }), true, 5, 0, ogCtx, settlement)).message).toBe("SETTLEMENT_HANKO_NONCE_MISMATCH:1:3");
    expect((await L.step({ type: "add_delta", tokenId: "9" }, true)).message).toBe("SETTLEMENT_SIGNED_ACCOUNT_FROZEN:add_delta");
    expect((await L.step({ type: "payment", tokenId: "1", amount: 1n, route: [RIGHT], fromEntityId: LEFT, toEntityId: RIGHT, deliveryMode: "direct" }, true)).message).toBe("SETTLEMENT_SIGNED_ACCOUNT_FROZEN:direct_payment");
  });
});

// ---------- runtime-final RF-18: the signer an Account message's outbox row binds (og delivery/entity-output-signer.ts) ----------

describe("final-sweep: RF-18 outbox signer (og resolveEntityOutputSignerId)", () => {
  test("MATCH: an Account message to an Entity with no local replica binds og's certified counterparty proposer (the frame Hanko's first member); without a Hanko og falls to the gossip route, and with neither refuses SIGNER_RESOLUTION_FAILED", () => {
    const J = "local", cfg = (a: string) => ({ mode: "proposer-based" as const, threshold: 1n, validators: [a], shares: { [a]: 1n }, jurisdiction: { name: J, chainId: TERMS.domain.chainId, depositoryAddress: TERMS.domain.depositoryAddress, entityProviderAddress: "0x" + "e1".repeat(20) } });
    const A = unwrapR(lazyBoardEntityId(cfg(aliceAddr)) as never) as string, B = unwrapR(lazyBoardEntityId(cfg(bobAddr)) as never) as string;
    const imp = (id: string, signer: string): RuntimeTx => ({ type: "importReplica", entityId: id, signerId: signer, data: { config: cfg(signer), isProposer: true, entitySeed: "0x" + "5e".repeat(64) } }) as never;
    let now = 1_700_000_000_000n;
    let rt: Runtime = unwrapR(applyRuntime(createRuntime([J]), { runtimeTxs: [imp(A, aliceAddr), imp(B, bobAddr)], entityInputs: [], timestamp: now }, verifiers) as never as { ok: true; value: { runtime: Runtime } }).runtime;
    const sent: EntityOutput[] = [];
    let inputs: RoutedEntityInput[] = [{ entityId: A as never, signerId: aliceAddr, input: { kind: "txs", timestamp: now, txs: [{ type: "openAccount", data: { targetEntityId: B, accountDomain: TERMS.domain, watchSeed: TERMS.watchSeed, disputeConfig: TERMS.disputeConfig } } as EntityTx] } }];
    for (let round = 0; inputs.length > 0 && round < 20; round++) {
      now += 1n;
      const step = unwrapR(applyRuntime(rt, { runtimeTxs: [], entityInputs: inputs.map((i) => (i.input.kind === "txs" ? { ...i, input: { ...i.input, timestamp: now } } : i)) }, verifiers) as never) as { runtime: Runtime; outbox: readonly EntityOutput[] };
      rt = step.runtime;
      sent.push(...step.outbox);
      inputs = step.outbox.map((o) => unwrapR(convertOutput(rt, o, ("tx" in o ? (o.tx.data as { fromEntityId: string }).fromEntityId : o.to) as never, now) as never));
    }
    const alice = [...rt.entities.values()].find((r) => r.state.id === A)!, account = alice.accountReplicas.get(B as never)!;
    expect(account.head._tag).toBe("installed");
    const head = account.head as Extract<typeof account.head, { _tag: "installed" }>, localIsLeft = A.toLowerCase() < B.toLowerCase();
    const peerHanko = localIsLeft ? head.certificate.right : head.certificate.left;
    const toB = sent.find((o) => "tx" in o && o.to === B)!;
    // BOB leaves this Runtime: only ALICE's certified Account evidence can name BOB's proposer
    const remote: Runtime = { ...rt, entities: new Map([...rt.entities].filter(([, r]) => r.state.id !== B)) };
    const ogAccount = (hanko: string | undefined) => ({ counterpartyFrameHanko: hanko, state: { leftEntity: localIsLeft ? A : B, rightEntity: localIsLeft ? B : A }, currentFrame: { stateHash: head.prevFrameHash } });
    const ogSigner = ogCertifiedProposer({} as never, {} as never, ogAccount(peerHanko) as never, B);
    expect(ogSigner).toBe(bobAddr.toLowerCase());
    const signerOf = (r: Runtime, routes?: { verifiedProfileSigner: (e: string) => string | undefined }): unknown => {
      const rows = runtimeOutputRows(r, [toB], routes);
      return rows.ok ? (ogDecodeBuffer(Buffer.from(rows.value[0]!)) as { signerId?: string }).signerId : (rows.error as { code: string }).code.split(":")[0];
    };
    expect(signerOf(remote)).toBe(ogSigner);
    // no frame Hanko: og returns no certified route, then the verified gossip profile, else SIGNER_RESOLUTION_FAILED
    expect(ogCertifiedProposer({} as never, {} as never, ogAccount(undefined) as never, B)).toBeNull();
    const bare = { ...alice, accountReplicas: new Map([...alice.accountReplicas].map(([k, a]) => [k, k === B ? { ...a, head: { ...head, certificate: { ...head.certificate, left: localIsLeft ? head.certificate.left : "", right: localIsLeft ? "" : head.certificate.right } } } : a])) };
    const uncertified: Runtime = { ...remote, entities: new Map([...remote.entities].map(([k, r]) => [k, r.state.id === A ? bare : r])) } as Runtime;
    expect(signerOf(uncertified)).toBe("SIGNER_RESOLUTION_FAILED");
    expect(signerOf(uncertified, { verifiedProfileSigner: (e) => (e === B.toLowerCase() ? "0x" + "cd".repeat(20) : undefined) })).toBe("0x" + "cd".repeat(20));
  });
});
