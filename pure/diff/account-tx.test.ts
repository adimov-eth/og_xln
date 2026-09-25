// Differential tests: og account-tx handlers (core/account/tx/**) vs pure rewrite (pure/xln.ts applyAccountBody).
// Each "DIVERGES:" test PASSES when the observed difference is present. "MATCH:" tests assert equivalence.
import { describe, expect, test } from "bun:test";
import { deriveDelta } from "../../core/account/utils.ts";
import { handleSetCreditLimit } from "../../core/account/tx/handlers/balance/set-credit-limit.ts";
import { handleDirectPayment } from "../../core/account/tx/handlers/balance/direct-payment.ts";
import { handleHtlcLock } from "../../core/account/tx/handlers/htlc/lock.ts";
import { handleHtlcResolve } from "../../core/account/tx/handlers/htlc/resolve.ts";
import { handleSwapCancelRequest } from "../../core/account/tx/handlers/swap/lifecycle/cancel.ts";
import { handleSwapResolve } from "../../core/account/tx/handlers/swap/resolve/index.ts";
import { validateSwapOfferAdmission } from "../../core/account/tx/handlers/swap/offer/admission.ts";
import { handleSettleTransition } from "../../core/account/tx/handlers/settlement/transition.ts";
import { hashHtlcSecret } from "../../core/protocol/htlc/utils.ts";
import { createDefaultDelta } from "../../core/account/state/delta.ts";
import {
  accountId,
  accountTerms,
  applyAccountBody,
  entityId,
  genesisAccount,
  genesisAccountBody,
  getDelta,
  hexToBytes,
  holds,
  keccak256Hex,
  keccakUtf8,
  outCapacity,
  setCreditLimit,
  zeroDelta,
  MAX_FILL,
  type AccountBody,
  type FoldCtx,
} from "../xln.ts";

// ---------- helpers ----------
type R<T, E> = { ok: true; value: T } | { ok: false; error: E };
const unwrap = <T, E>(r: R<T, E>): T => {
  if (!r.ok) throw new Error(`unwrap: ${JSON.stringify(r.error, (_k, v) => (typeof v === "bigint" ? `${v}n` : v))}`);
  return r.value;
};
const word = (byte: string): string => `0x${byte.repeat(32)}`;
const A = word("11"); // left (lexicographically smaller)
const B = word("22");

/** Patricia-map shim: og drafts expose put/del on top of Map semantics. */
class PMap<K, V> extends Map<K, V> {
  put(k: K, v: V): this { this.set(k, v); return this; }
  del(k: K): void { this.delete(k); }
}
const ogDelta = (tokenId: number, patch: Record<string, bigint> = {}) => ({ ...createDefaultDelta(tokenId), ...patch });
const ogState = (deltas: Array<ReturnType<typeof ogDelta>> = []) => ({
  leftEntity: A,
  rightEntity: B,
  deltas: new PMap<number, any>(deltas.map((d) => [d.tokenId, d])),
  locks: new PMap<string, any>(),
  swapOffers: new PMap<string, any>(),
  requestedRebalance: new PMap<number, bigint>(),
  requestedRebalanceFeeState: new PMap<number, any>(),
});
const ogAccount = (state: ReturnType<typeof ogState>) => ({ proofHeader: { fromEntity: A, toEntity: B }, state, currentHeight: 1 }) as any;

const open = (hub: "left" | "right" | null = null, credit = 20n): { body: AccountBody; ctx: FoldCtx } => {
  const terms = unwrap(accountTerms({
    domain: { chainId: 1, depositoryAddress: `0x${"ab".repeat(20)}` },
    watchSeed: word("44"),
    disputeConfig: { leftResponseSeconds: 1, rightResponseSeconds: 1 },
  }) as any) as any;
  const ctx: FoldCtx = { byLeft: true, nowMs: 1n, jHeight: 0n, accountHeight: 1n };
  let body = genesisAccountBody(genesisAccount(unwrap(accountId(unwrap(entityId(A) as any), unwrap(entityId(B) as any)) as any)), terms, hub);
  for (const tokenId of ["0", "1"] as const) {
    body = unwrap(applyAccountBody(body, { type: "set_credit_limit", tokenId, limit: credit }, ctx) as any as R<any, any>).state;
    body = unwrap(applyAccountBody(body, { type: "set_credit_limit", tokenId, limit: credit }, { ...ctx, byLeft: false }) as any as R<any, any>).state;
  }
  return { body, ctx };
};
const apply = (b: AccountBody, tx: any, ctx: FoldCtx) => applyAccountBody(b, tx, ctx) as any as R<{ state: AccountBody; effects: any[] }, any>;

// ---------- balance ----------
describe("account-tx: balance", () => {
  test("MATCH: outCapacity == deriveDelta.outCapacity over a grid (incl. holds, negative/positive delta)", () => {
    const vals = [0n, 1n, 7n, 50n, 100n];
    for (const c of vals) for (const L of vals) for (const Rr of vals) for (const t of [-120n, -30n, 0n, 30n, 120n]) for (const h of [0n, 5n]) {
      const og = { ...createDefaultDelta(0), collateral: c, leftCreditLimit: L, rightCreditLimit: Rr, offdelta: t, leftHold: h, rightHold: h };
      const pure = { ...zeroDelta("0" as any), collateral: c, leftCreditLimit: L, rightCreditLimit: Rr, offdelta: t };
      expect(outCapacity(pure, true, h)).toBe(deriveDelta(og, true).outCapacity);
      expect(outCapacity(pure, false, h)).toBe(deriveDelta(og, false).outCapacity);
    }
  });

  test("MATCH: set_credit_limit — proposer writes the counterparty field; bounds 0..2^256-1", () => {
    for (const byLeft of [true, false]) {
      const s = ogState();
      const r = handleSetCreditLimit(s as any, { type: "set_credit_limit", data: { tokenId: 1, amount: 9n } }, byLeft);
      expect(r.ok).toBe(true);
      const p = unwrap(setCreditLimit(zeroDelta("1" as any), 9n, byLeft) as any) as any;
      expect(p.leftCreditLimit).toBe(s.deltas.get(1).leftCreditLimit);
      expect(p.rightCreditLimit).toBe(s.deltas.get(1).rightCreditLimit);
    }
    const max = (1n << 256n) - 1n;
    expect(handleSetCreditLimit(ogState() as any, { type: "set_credit_limit", data: { tokenId: 1, amount: max + 1n } }, true).ok).toBe(false);
    expect(setCreditLimit(zeroDelta("1" as any), max + 1n, true).ok).toBe(false);
    expect(handleSetCreditLimit(ogState() as any, { type: "set_credit_limit", data: { tokenId: 1, amount: -1n } }, true).ok).toBe(false);
    expect(setCreditLimit(zeroDelta("1" as any), -1n, true).ok).toBe(false);
  });

  const ogPay = (state: ReturnType<typeof ogState>, amount: bigint, byLeft = true) =>
    handleDirectPayment(ogAccount(state), {
      type: "direct_payment",
      data: { tokenId: 1, amount, route: [byLeft ? B : A], fromEntityId: byLeft ? A : B, toEntityId: byLeft ? B : A, deliveryMode: "direct" },
    } as any, byLeft);

  test("MATCH: over-capacity payment refused by both; exact-capacity accepted by both; sign = left pays negative", () => {
    const og1 = ogState([ogDelta(1, { leftCreditLimit: 20n, rightCreditLimit: 20n })]);
    expect(ogPay(og1, 21n).ok).toBe(false);
    const { body, ctx } = open();
    expect(apply(body, { type: "payment", tokenId: "1", amount: 21n }, ctx).ok).toBe(false);
    const og2 = ogState([ogDelta(1, { leftCreditLimit: 20n, rightCreditLimit: 20n })]);
    expect(ogPay(og2, 20n).ok).toBe(true);
    const paid = unwrap(apply(body, { type: "payment", tokenId: "1", amount: 20n }, ctx));
    expect(getDelta(paid.state.account, "1" as any).offdelta).toBe(og2.deltas.get(1).offdelta);
    expect(og2.deltas.get(1).offdelta).toBe(-20n);
    // right pays: positive
    const og3 = ogState([ogDelta(1, { leftCreditLimit: 20n, rightCreditLimit: 20n })]);
    expect(ogPay(og3, 5n, false).ok).toBe(true);
    const paidR = unwrap(apply(body, { type: "payment", tokenId: "1", amount: 5n }, { ...ctx, byLeft: false }));
    expect(getDelta(paidR.state.account, "1" as any).offdelta).toBe(og3.deltas.get(1).offdelta);
  });

  test("MATCH: live HTLC hold reduces payment capacity identically", () => {
    // og: a lock of 5 by left puts leftHold=5 → 15 left
    const og = ogState([ogDelta(1, { leftCreditLimit: 20n, rightCreditLimit: 20n, leftHold: 5n })]);
    expect(ogPay(og, 16n).ok).toBe(false);
    expect(ogPay(ogState([ogDelta(1, { leftCreditLimit: 20n, rightCreditLimit: 20n, leftHold: 5n })]), 15n).ok).toBe(true);
    const { body, ctx } = open();
    const locked = unwrap(apply(body, { type: "htlc_lock", lockId: "L", hashlock: keccakUtf8("s"), timelock: 10n ** 15n, revealBeforeHeight: 5n, amount: 5n, tokenId: "1" }, ctx)).state;
    expect(holds(locked, "1" as any, true)).toBe(5n);
    expect(apply(locked, { type: "payment", tokenId: "1", amount: 16n }, ctx).ok).toBe(false);
    expect(apply(locked, { type: "payment", tokenId: "1", amount: 15n }, ctx).ok).toBe(true);
  });

  test("DIVERGES: payment above 2^128-1 — og accepts up to 2^256-1, rewrite refuses payment_too_large", () => {
    const amount = 1n << 128n;
    const big = 1n << 200n;
    const og = ogState([ogDelta(1, { leftCreditLimit: big })]);
    expect(ogPay(og, amount).ok).toBe(true);
    let { body, ctx } = open();
    body = unwrap(apply(body, { type: "set_credit_limit", tokenId: "1", limit: big }, { ...ctx, byLeft: false })).state; // right grants left
    expect(outCapacity(getDelta(body.account, "1" as any), true, 0n) >= amount).toBe(true);
    const r = apply(body, { type: "payment", tokenId: "1", amount }, ctx);
    expect(r.ok).toBe(false);
    expect((r as any).error._tag).toBe("payment_too_large");
  });
});

// ---------- HTLC ----------
const HEX_SECRET = word("5a");
const ogLockTx = (patch: Record<string, unknown> = {}) => ({
  type: "htlc_lock",
  data: { lockId: hashHtlcSecret(HEX_SECRET), hashlock: hashHtlcSecret(HEX_SECRET), timelock: 10n ** 15n, revealBeforeHeight: 5, amount: 5n, tokenId: 1, ...patch },
}) as any;
const ogClock = (ts = 1, jh = 0) => ({ committedTimestamp: ts, enforcementTimestamp: ts, enforcementJHeight: jh });
const lockedOg = async () => {
  const s = ogState([ogDelta(1, { leftCreditLimit: 20n, rightCreditLimit: 20n })]);
  const r = await handleHtlcLock(ogAccount(s), ogLockTx(), true, ogClock());
  expect(r.ok).toBe(true);
  return s;
};

describe("account-tx: htlc", () => {
  test("DIVERGES: hashlock function — og keccak256(bytes32 secret), rewrite keccak256(utf8 of the hex string)", () => {
    const og = hashHtlcSecret(HEX_SECRET);
    expect(og).toBe(keccak256Hex(hexToBytes(HEX_SECRET)).toLowerCase());
    expect(keccakUtf8(HEX_SECRET)).not.toBe(og);
    // An og-shaped lock (hashlock = og hash) can never be resolved by the rewrite with the real secret.
    const { body, ctx } = open();
    const locked = unwrap(apply(body, { type: "htlc_lock", lockId: og, hashlock: og, timelock: 10n ** 15n, revealBeforeHeight: 5n, amount: 5n, tokenId: "1" }, ctx)).state;
    const r = apply(locked, { type: "htlc_resolve", lockId: og, secret: HEX_SECRET }, ctx);
    expect(r.ok).toBe(false);
    expect((r as any).error._tag).toBe("preimage");
  });

  test("DIVERGES: secret reveal after revealBeforeHeight — og refuses (Lock expired), rewrite pays the beneficiary", async () => {
    const s = await lockedOg();
    const r = await handleHtlcResolve(s as any, { type: "htlc_resolve", data: { lockId: hashHtlcSecret(HEX_SECRET), outcome: "secret", secret: HEX_SECRET } } as any, false, 6, 1);
    expect(r.ok).toBe(false);
    expect(String((r as any).rejection?.message ?? (r as any).events ?? "")).toContain("expired");
    const { body, ctx } = open();
    const locked = unwrap(apply(body, { type: "htlc_lock", lockId: "L", hashlock: keccakUtf8("p"), timelock: 10n ** 15n, revealBeforeHeight: 5n, amount: 5n, tokenId: "1" }, ctx)).state;
    const late = apply(locked, { type: "htlc_resolve", lockId: "L", secret: "p" }, { ...ctx, byLeft: false, jHeight: 6n, nowMs: 10n ** 16n });
    expect(late.ok).toBe(true);
    expect(getDelta((late as any).value.state.account, "1" as any).offdelta).toBe(-5n);
  });

  test("DIVERGES: htlc_lock with an already-expired timelock / passed revealBeforeHeight — og refuses, rewrite accepts", async () => {
    const s1 = ogState([ogDelta(1, { leftCreditLimit: 20n })]);
    expect((await handleHtlcLock(ogAccount(s1), ogLockTx({ timelock: 0n }), true, ogClock(1, 0))).ok).toBe(false);
    const s2 = ogState([ogDelta(1, { leftCreditLimit: 20n })]);
    expect((await handleHtlcLock(ogAccount(s2), ogLockTx({ revealBeforeHeight: 3 }), true, ogClock(1, 3))).ok).toBe(false);
    const { body, ctx } = open();
    expect(apply(body, { type: "htlc_lock", lockId: "L", hashlock: keccakUtf8("p"), timelock: 0n, revealBeforeHeight: 5n, amount: 5n, tokenId: "1" }, { ...ctx, nowMs: 1n }).ok).toBe(true);
    expect(apply(body, { type: "htlc_lock", lockId: "L", hashlock: keccakUtf8("p"), timelock: 10n ** 15n, revealBeforeHeight: 3n, amount: 5n, tokenId: "1" }, { ...ctx, jHeight: 3n }).ok).toBe(true);
  });

  test("DIVERGES: lockId must equal hashlock in og; rewrite accepts any lockId", async () => {
    const s = ogState([ogDelta(1, { leftCreditLimit: 20n })]);
    expect((await handleHtlcLock(ogAccount(s), ogLockTx({ lockId: "L" }), true, ogClock())).ok).toBe(false);
    const { body, ctx } = open();
    expect(apply(body, { type: "htlc_lock", lockId: "L", hashlock: hashHtlcSecret(HEX_SECRET), timelock: 10n ** 15n, revealBeforeHeight: 5n, amount: 5n, tokenId: "1" }, ctx).ok).toBe(true);
  });

  test("DIVERGES: 33rd live lock — og refuses (MAX_ACCOUNT_HTLC_LOCKS=32), rewrite has no cap", async () => {
    const s = ogState([ogDelta(1, { leftCreditLimit: 1000n })]);
    for (let i = 0; i < 32; i++) s.locks.put(`x${i}`, { tokenId: 2, amount: 1n, senderIsLeft: true });
    expect((await handleHtlcLock(ogAccount(s), ogLockTx({ amount: 1n }), true, ogClock())).ok).toBe(false);
    let { body, ctx } = open("left", 1000n);
    for (let i = 0; i < 33; i++) {
      body = unwrap(apply(body, { type: "htlc_lock", lockId: `L${i}`, hashlock: keccakUtf8(`p${i}`), timelock: 10n ** 15n, revealBeforeHeight: 5n, amount: 1n, tokenId: "1" }, ctx)).state;
    }
    expect(body.locks.size).toBe(33);
  });

  test("DIVERGES: beneficiary may cancel an active HTLC before expiry in og (outcome=error); rewrite has no such path", async () => {
    const s = await lockedOg();
    const r = await handleHtlcResolve(s as any, { type: "htlc_resolve", data: { lockId: hashHtlcSecret(HEX_SECRET), outcome: "error", reason: "no_route" } } as any, false, 0, 1);
    expect(r.ok).toBe(true);
    expect(s.locks.size).toBe(0);
    expect(s.deltas.get(1).leftHold).toBe(0n);
    const { body, ctx } = open();
    const locked = unwrap(apply(body, { type: "htlc_lock", lockId: "L", hashlock: keccakUtf8("p"), timelock: 10n ** 15n, revealBeforeHeight: 5n, amount: 5n, tokenId: "1" }, ctx)).state;
    const t = apply(locked, { type: "htlc_timeout", lockId: "L" }, { ...ctx, byLeft: false, jHeight: 0n });
    expect(t.ok).toBe(false);
    expect((t as any).error._tag).toBe("before_deadline");
  });

  test("DIVERGES: timestamp timelock expiry — og lets payer cancel once timestamp >= timelock; rewrite ignores timelock entirely", async () => {
    const s = await lockedOg();
    const r = await handleHtlcResolve(s as any, { type: "htlc_resolve", data: { lockId: hashHtlcSecret(HEX_SECRET), outcome: "error", reason: "timeout" } } as any, true, 0, 10 ** 15);
    expect(r.ok).toBe(true);
    const { body, ctx } = open();
    const locked = unwrap(apply(body, { type: "htlc_lock", lockId: "L", hashlock: keccakUtf8("p"), timelock: 100n, revealBeforeHeight: 5n, amount: 5n, tokenId: "1" }, ctx)).state;
    const t = apply(locked, { type: "htlc_timeout", lockId: "L" }, { ...ctx, nowMs: 10n ** 15n, jHeight: 0n });
    expect(t.ok).toBe(false);
  });

  test("MATCH: jHeight == revealBeforeHeight is not yet expired for timeout in either (og 'not expired', rewrite hole refusal)", async () => {
    const s = await lockedOg();
    const r = await handleHtlcResolve(s as any, { type: "htlc_resolve", data: { lockId: hashHtlcSecret(HEX_SECRET), outcome: "error", reason: "timeout" } } as any, true, 5, 1);
    expect(r.ok).toBe(false);
    const { body, ctx } = open();
    const locked = unwrap(apply(body, { type: "htlc_lock", lockId: "L", hashlock: keccakUtf8("p"), timelock: 10n ** 15n, revealBeforeHeight: 5n, amount: 5n, tokenId: "1" }, ctx)).state;
    expect(apply(locked, { type: "htlc_timeout", lockId: "L" }, { ...ctx, jHeight: 5n }).ok).toBe(false);
    expect(apply(locked, { type: "htlc_timeout", lockId: "L" }, { ...ctx, jHeight: 6n }).ok).toBe(true);
  });

  test("MATCH: secret resolve moves offdelta by sender sign and releases the hold", async () => {
    const s = await lockedOg();
    const r = await handleHtlcResolve(s as any, { type: "htlc_resolve", data: { lockId: hashHtlcSecret(HEX_SECRET), outcome: "secret", secret: HEX_SECRET } } as any, false, 0, 1);
    expect(r.ok).toBe(true);
    const { body, ctx } = open();
    const locked = unwrap(apply(body, { type: "htlc_lock", lockId: "L", hashlock: keccakUtf8("p"), timelock: 10n ** 15n, revealBeforeHeight: 5n, amount: 5n, tokenId: "1" }, ctx)).state;
    const done = unwrap(apply(locked, { type: "htlc_resolve", lockId: "L", secret: "p" }, ctx)).state;
    expect(getDelta(done.account, "1" as any).offdelta).toBe(s.deltas.get(1).offdelta);
    expect(holds(done, "1" as any, true)).toBe(s.deltas.get(1).leftHold);
  });
});

// ---------- swaps ----------
const ogOffer = (patch: Record<string, unknown> = {}) => ({
  offerId: "S", giveTokenId: 1, giveTokenDecimals: 18, giveAmount: 2n, wantTokenId: 2, wantTokenDecimals: 18, wantAmount: 3n,
  maxFee: 0n, minNetReceive: 1n, priceTicks: 15_000n, makerIsLeft: true, createdHeight: 0, quantizedGive: 2n, quantizedWant: 3n, ...patch,
});
const ogSwapState = () => {
  const s = ogState([ogDelta(1, { leftCreditLimit: 100n, rightCreditLimit: 100n, leftHold: 2n }), ogDelta(2, { leftCreditLimit: 100n, rightCreditLimit: 100n })]);
  s.swapOffers.put("S", ogOffer());
  return s;
};

describe("account-tx: swap", () => {
  test("DIVERGES: swap_cancel — og only emits a cancel *request* (offer + hold kept), rewrite deletes the offer and frees the hold at once", async () => {
    const s = ogSwapState();
    const r = await handleSwapCancelRequest(ogAccount(s), { type: "swap_cancel_request", data: { offerId: "S" } } as any, true, 0);
    expect(r.ok).toBe(true);
    expect(s.swapOffers.has("S")).toBe(true);
    expect(s.deltas.get(1).leftHold).toBe(2n);
    const { body, ctx } = open("right");
    const offered = unwrap(apply(body, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 2n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, ctx)).state;
    const cancelled = unwrap(apply(offered, { type: "swap_cancel", offerId: "S" }, ctx)).state;
    expect(cancelled.offers.has("S")).toBe(false);
    expect(holds(cancelled, "0" as any, true)).toBe(0n);
  });

  test("DIVERGES: fill below maker limit price — rewrite floors both legs by ratio (gives 1 for 1 on a 2:3 offer); og rejects that execution", async () => {
    // rewrite: maker(left) offers 2 of token0 for 3 of token1; hub(right) fills at ratio 32768 (~1/2)
    const { body, ctx } = open("right");
    const offered = unwrap(apply(body, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 2n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, ctx)).state;
    const filled = unwrap(apply(offered, { type: "swap_resolve", offerId: "S", fillRatio: 32768, cancelRemainder: true }, { ...ctx, byLeft: false })).state;
    const gave = -getDelta(filled.account, "0" as any).offdelta; // left paid give
    const got = getDelta(filled.account, "1" as any).offdelta * -1n * -1n; // right paid want (positive = right pays)
    expect(gave).toBe(1n);
    expect(got).toBe(1n);
    expect(got * 2n < gave * 3n).toBe(true); // below maker price 3/2
    // og: same economic execution (give 1, want 1) on the same offer is refused.
    const s = ogSwapState();
    const r = await handleSwapResolve(ogAccount(s), { type: "swap_resolve", data: { offerId: "S", fillRatio: 32768, cancelRemainder: true, executionGiveAmount: 1n, executionWantAmount: 1n } } as any, false, 0);
    expect(r.ok).toBe(false);
    expect(JSON.stringify((r as any).rejection ?? r, (_k, v) => (typeof v === "bigint" ? String(v) : v))).toContain("maker limit");
  });

  test("DIVERGES: og requires explicit execution amounts for any non-zero fillRatio; rewrite derives fills from the ratio alone", async () => {
    const s = ogSwapState();
    const r = await handleSwapResolve(ogAccount(s), { type: "swap_resolve", data: { offerId: "S", fillRatio: MAX_FILL, cancelRemainder: true } } as any, false, 0);
    expect(r.ok).toBe(false);
    const { body, ctx } = open("right");
    const offered = unwrap(apply(body, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 2n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, ctx)).state;
    expect(apply(offered, { type: "swap_resolve", offerId: "S", fillRatio: MAX_FILL, cancelRemainder: true }, { ...ctx, byLeft: false }).ok).toBe(true);
  });

  test("DIVERGES: fillRatio=0 with cancelRemainder=false — og closes the offer (effectiveCancelRemainder), rewrite keeps it open", async () => {
    const s = ogSwapState();
    const r = await handleSwapResolve(ogAccount(s), { type: "swap_resolve", data: { offerId: "S", fillRatio: 0, cancelRemainder: false } } as any, false, 0);
    expect(r.ok).toBe(true);
    expect(s.swapOffers.has("S")).toBe(false);
    expect(s.deltas.get(1).leftHold).toBe(0n);
    const { body, ctx } = open("right");
    const offered = unwrap(apply(body, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 2n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, ctx)).state;
    const after = unwrap(apply(offered, { type: "swap_resolve", offerId: "S", fillRatio: 0, cancelRemainder: false }, { ...ctx, byLeft: false })).state;
    expect(after.offers.has("S")).toBe(true);
  });

  test("DIVERGES: resolver authority — og: any non-maker counterparty; rewrite: only the designated hub (hub=null account can never resolve)", async () => {
    const s = ogSwapState();
    expect((await handleSwapResolve(ogAccount(s), { type: "swap_resolve", data: { offerId: "S", fillRatio: 0, cancelRemainder: true } } as any, false, 0)).ok).toBe(true);
    const s2 = ogSwapState();
    expect((await handleSwapResolve(ogAccount(s2), { type: "swap_resolve", data: { offerId: "S", fillRatio: 0, cancelRemainder: true } } as any, true, 0)).ok).toBe(false); // maker itself
    const { body, ctx } = open(null);
    const offered = unwrap(apply(body, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 2n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, ctx)).state;
    const r = apply(offered, { type: "swap_resolve", offerId: "S", fillRatio: 0, cancelRemainder: true }, { ...ctx, byLeft: false });
    expect(r.ok).toBe(false);
    expect((r as any).error._tag).toBe("not_hub");
    // and a hub that is itself the maker may resolve its own offer in the rewrite
    const hubMaker = open("left");
    const own = unwrap(apply(hubMaker.body, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 2n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, hubMaker.ctx)).state;
    expect(apply(own, { type: "swap_resolve", offerId: "S", fillRatio: 0, cancelRemainder: true }, hubMaker.ctx).ok).toBe(true);
  });

  test("DIVERGES: same-token swap offer — og refuses 'Cannot swap same token', rewrite accepts", () => {
    const s = ogState();
    const tx = { type: "swap_offer", data: { offerId: "S", giveTokenId: 1, giveTokenDecimals: 18, giveAmount: 10n ** 18n, wantTokenId: 1, wantTokenDecimals: 18, wantAmount: 10n ** 18n, maxFee: 0n, minNetReceive: 10n ** 18n } } as any;
    const r = validateSwapOfferAdmission(s as any, tx, true);
    expect(r.ok).toBe(false);
    expect((r as any).message).toContain("same token");
    const { body, ctx } = open();
    expect(apply(body, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 2n, wantTokenId: "0", wantAmount: 2n, minFillRatio: 0, expiresAtHeight: 100n }, ctx).ok).toBe(true);
  });

  test("DIVERGES: offerId containing ':' — og refuses, rewrite accepts", () => {
    const tx = { type: "swap_offer", data: { offerId: "a:b", giveTokenId: 1, giveTokenDecimals: 18, giveAmount: 10n ** 18n, wantTokenId: 2, wantTokenDecimals: 18, wantAmount: 10n ** 18n, maxFee: 0n, minNetReceive: 10n ** 18n } } as any;
    expect(validateSwapOfferAdmission(ogState() as any, tx, true).ok).toBe(false);
    const { body, ctx } = open();
    expect(apply(body, { type: "swap_offer", offerId: "a:b", giveTokenId: "0", giveAmount: 2n, wantTokenId: "1", wantAmount: 2n, minFillRatio: 0, expiresAtHeight: 100n }, ctx).ok).toBe(true);
  });

  test("MATCH: swap_offer capacity check includes existing holds on the give token", () => {
    const { body, ctx } = open("right"); // left can pay 20 on token0
    const locked = unwrap(apply(body, { type: "htlc_lock", lockId: "L", hashlock: keccakUtf8("p"), timelock: 10n ** 15n, revealBeforeHeight: 5n, amount: 15n, tokenId: "0" }, ctx)).state;
    expect(apply(locked, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 6n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, ctx).ok).toBe(false);
    expect(apply(locked, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 5n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, ctx).ok).toBe(true);
    // og commit.ts:208 uses deriveDelta(delta, makerIsLeft).outCapacity, which subtracts leftHold
    expect(deriveDelta(ogDelta(0, { leftCreditLimit: 20n, rightCreditLimit: 20n, leftHold: 15n }), true).outCapacity).toBe(5n);
  });
});

// ---------- settlement / j-events ----------
describe("account-tx: settlement + j_event_claim", () => {
  test("DIVERGES: settle_transition(hanko) with no workspace — og rejects, rewrite accepts and commits settlementHash", async () => {
    const tx = {
      type: "settle_transition",
      data: { kind: "hanko", revision: 1, workspaceHash: word("61"), settlementNonce: 2, settlementHash: word("62"), settlementHanko: "0x01", postProof: { nonce: 3, proposerIsLeft: true, proofBodyHash: word("63"), disputeHash: word("64"), hanko: "0x02" } },
    } as any;
    const r = await handleSettleTransition(ogAccount(ogState()), tx, true, 1, {} as any);
    expect(r.ok).toBe(false);
    expect(JSON.stringify((r as any).rejection)).toContain("SETTLEMENT_WORKSPACE_MISSING");
    const { body, ctx } = open();
    const applied = apply(body, { type: "settle_transition", ...tx.data }, ctx);
    expect(applied.ok).toBe(true);
    expect((applied as any).value.state.settlement.settlementHash).toBe(word("62"));
  });

  const claim = (jHeight: bigint, collateral: bigint, nonce = 1n) => ({
    type: "j_event_claim" as const,
    jHeight,
    jBlockHash: word(jHeight === 10n ? "0a" : "05"),
    observedAt: 1n,
    events: [{ left: A, right: B, nonce, tokens: [{ tokenId: 1n, leftReserve: 0n, rightReserve: 0n, collateral, ondelta: 0n }] }],
  });

  test("DIVERGES: stale j_event_claim (jHeight <= lastFinalized) re-finalizes and rolls back collateral + finalizedJHeight in rewrite (og: status 'stale', no-op)", () => {
    let { body, ctx } = open();
    body = unwrap(apply(body, claim(10n, 100n, 2n), ctx)).state;
    body = unwrap(apply(body, claim(10n, 100n, 2n), { ...ctx, byLeft: false })).state;
    expect(body.finalizedJHeight).toBe(10n);
    expect(getDelta(body.account, "1" as any).collateral).toBe(100n);
    body = unwrap(apply(body, claim(5n, 7n, 1n), ctx)).state;
    body = unwrap(apply(body, claim(5n, 7n, 1n), { ...ctx, byLeft: false })).state;
    // og j-claim-transition.ts:214 returns 'stale' and never calls applyFinalizedAccountJEventsOnView;
    // og finality.ts:172 would also throw ACCOUNT_SETTLED_NONCE_REGRESSION (nonce 2 → 1).
    expect(body.finalizedJHeight).toBe(5n);
    expect(getDelta(body.account, "1" as any).collateral).toBe(7n);
  });

  test("DIVERGES: peer claim at an older pending height never finalizes in rewrite (single leftJ/rightJ slot); og accumulator finalizes by membership", () => {
    let { body, ctx } = open();
    body = unwrap(apply(body, claim(5n, 7n), ctx)).state; // left claims h5
    body = unwrap(apply(body, claim(10n, 100n), ctx)).state; // left claims h10 (overwrites leftJ)
    body = unwrap(apply(body, claim(5n, 7n), { ...ctx, byLeft: false })).state; // right claims h5
    // og: peerResult for h5 is 'member' in leftPendingJClaims → 'finalized' (j-claim-transition.ts:229-255)
    expect(body.finalizedJHeight).toBe(0n);
    expect(getDelta(body.account, "1" as any).collateral).toBe(0n);
  });

  test("DIVERGES: AccountSettled row for a different account pair — og throws ACCOUNT_SETTLED_PAIR_MISMATCH, rewrite silently skips and still finalizes", () => {
    let { body, ctx } = open();
    const foreign = { ...claim(10n, 100n), events: [{ left: word("33"), right: word("44"), nonce: 1n, tokens: [{ tokenId: 1n, leftReserve: 0n, rightReserve: 0n, collateral: 9n, ondelta: 0n }] }] };
    body = unwrap(apply(body, foreign, ctx)).state;
    body = unwrap(apply(body, foreign, { ...ctx, byLeft: false })).state;
    expect(body.finalizedJHeight).toBe(10n);
    expect(getDelta(body.account, "1" as any).collateral).toBe(0n);
  });
});
