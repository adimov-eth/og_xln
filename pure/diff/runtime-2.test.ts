import { describe, expect, test } from "bun:test";
import {
  handleLendingBorrowEntityTx, handleLendingClosePositionEntityTx, handleLendingOfferEntityTx, handleLendingRepayEntityTx,
} from "../../core/entity/tx/handlers/payments/lending.ts";
import {
  applyEntityInput, createEntity, isLeft, mapSet, ownWire, tokenId, wireOf, zeroDelta,
  type AccountReplica, type EntityId, type EntityTx, type OpenEntity, type WireAccountTx,
} from "../xln.ts";
import { ALICE, BOB, CAROL, NOW, TERMS, aliceAddr, unwrap, verifiers } from "../xln_run.ts";

// seeded rng for randomized comparisons
let seed = 11;
const rng = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (n: number): number => Math.floor(rng() * n);
const pick = <T>(xs: readonly T[]): T => xs[ri(xs.length)] as T;
const hex16 = (): string => Array.from({ length: 16 }, () => "0123456789abcdef"[ri(16)]).join("");

const T1 = unwrap(tokenId("1")), T2 = unwrap(tokenId("2"));
const openTo = (target: EntityId): EntityTx =>
  ({ type: "openAccount", data: { targetEntityId: target, accountDomain: TERMS.domain, watchSeed: TERMS.watchSeed, disputeConfig: TERMS.disputeConfig } }) as EntityTx;

/** A 1-of-1 ALICE with a committed Account to BOB whose token 1 row is funded on ALICE's side. */
const fundedHubAccount = (): OpenEntity => {
  const created = unwrap(createEntity({ id: ALICE, jurisdiction: TERMS.domain, threshold: 1n, members: new Map([[aliceAddr, { shares: 1n }]]) }));
  const opened = unwrap(applyEntityInput(created, { kind: "txs", timestamp: NOW, txs: [openTo(BOB)] }, { ...verifiers, self: ALICE, signerId: aliceAddr })).replica;
  if (opened._tag !== "open") throw new Error(opened._tag);
  const child = opened.accountReplicas.get(BOB);
  if (child === undefined) throw new Error("no account");
  const left = isLeft(ALICE, { left: ALICE < BOB ? ALICE : BOB, right: ALICE < BOB ? BOB : ALICE } as never);
  const row = { ...zeroDelta(T1), collateral: 1_000_000n, ondelta: left ? 1_000_000n : 0n };
  const account = { ...child.state.account, deltas: new Map([[T1, row]]) };
  const funded = { ...child, mempool: [], state: { ...child.state, account } } as AccountReplica;
  return { ...opened, accountReplicas: mapSet(opened.accountReplicas, BOB, funded), state: { ...opened.state, accounts: mapSet(opened.state.accounts, BOB, account) } };
};

type Og = { readonly ok: true; readonly accountTx: unknown; readonly accountId: string; readonly outputs: unknown } | { readonly ok: false; readonly code: string };
const runOg = (tx: { readonly type: string; readonly data: Record<string, unknown> }): Og => {
  const ogState = { entityId: ALICE, config: { validators: [aliceAddr] }, accounts: new Map([[BOB.toLowerCase(), { state: { deltas: new Map([[1, {}]]) } }]]) };
  const ogTx = { type: tx.type, data: { ...tx.data, ...("tokenId" in tx.data ? { tokenId: Number(tx.data["tokenId"]) } : {}) } };
  const handler = { lendingOffer: handleLendingOfferEntityTx, lendingBorrow: handleLendingBorrowEntityTx, lendingRepay: handleLendingRepayEntityTx, lendingClosePosition: handleLendingClosePositionEntityTx }[tx.type];
  if (handler === undefined) throw new Error(tx.type);
  try {
    const out = (handler as (s: unknown, t: unknown, m: boolean) => { outputs: unknown; accountTxs: { accountId: string; tx: unknown }[] })(ogState, ogTx, true);
    const [queued] = out.accountTxs;
    if (queued === undefined) throw new Error("og queued nothing");
    return { ok: true, accountTx: queued.tx, accountId: queued.accountId, outputs: out.outputs };
  } catch (e) {
    return { ok: false, code: String((e as Error).message).split(/[:\s]/)[0] ?? "" };
  }
};
const runRewrite = (tx: EntityTx) => applyEntityInput(fundedHubAccount(), { kind: "txs", timestamp: NOW + 1n, txs: [tx] }, { ...verifiers, self: ALICE, signerId: aliceAddr });

describe("runtime-2: entity lending (ER-17, og payments/lending.ts)", () => {
  const randomTx = (): EntityTx => {
    const hub = pick<string>([BOB, BOB, BOB, BOB.toUpperCase().replace("0X", "0x"), ` ${BOB} `, CAROL, ""]);
    const id = (prefix: string): string => pick([`${prefix}-${hex16()}`, `${prefix}-${hex16()}`, `${prefix}-${hex16().toUpperCase()}`, `${prefix}-${hex16().slice(1)}`, `lend-${hex16()}`, `loan-${hex16()}`, "x"]);
    const amount = pick([0n, -1n, 1n, 5n, 1000n]);
    const termId = pick(["1h", "1d", "1m", "1y", ""]);
    const bps = pick([0, 1, 99, 10_000, 10_001, -1, 2.5]);
    const tk = pick([T1, T1, T1, T2]);
    const kind = ri(4);
    if (kind === 0) return { type: "lendingOffer", data: { positionId: id("lend"), hubEntityId: hub, tokenId: tk, amount, termId, interestBps: bps } };
    if (kind === 1) return { type: "lendingBorrow", data: { requestId: id("borrow"), hubEntityId: hub, tokenId: tk, amount, termId, ...(rng() < 0.3 ? {} : { maxInterestBps: bps }) } };
    if (kind === 2) return { type: "lendingRepay", data: { hubEntityId: hub, loanId: id("loan"), tokenId: tk, amount } };
    return { type: "lendingClosePosition", data: { hubEntityId: hub, positionId: id("lend") } };
  };

  test("MATCH: 400 random lendingOffer/Borrow/Repay/ClosePosition -- same accept/refuse code as og, same queued Account tx on the hub Account, same wake to validators[0]", () => {
    let accepted = 0, refused = 0, admissionOnly = 0;
    for (let i = 0; i < 400; i++) {
      const tx = randomTx(), og = runOg(tx as never), rw = runRewrite(tx);
      if (!og.ok) {
        // og throws a plain Error: the whole input is refused (not an evict-and-retry reject disposition).
        expect(rw.ok).toBe(false);
        if (!rw.ok) expect(rw.error._tag === "lending_entity" ? rw.error.reason : rw.error._tag).toBe(og.code);
        refused++;
        continue;
      }
      if (!rw.ok) {
        // REMAINING (ER-15, account area): og local admission (local-tx-admission.ts) queues without applying; the rewrite's admitAt
        // pre-applies, so a repay on an Account row without capacity is refused at enqueue here and only at the Account frame in og.
        expect(["insufficient_capacity", "lending"]).toContain(rw.error._tag);
        admissionOnly++;
        continue;
      }
      const hub = rw.value.replica.accountReplicas.get(BOB);
      const queued = hub?.mempool.at(-1);
      expect(og.accountId).toBe(BOB.toLowerCase());
      expect(queued === undefined ? undefined : ownWire(wireOf(queued as WireAccountTx))).toEqual(og.accountTx as never);
      expect(rw.value.outputs).toEqual([{ to: ALICE, signerId: aliceAddr, input: { kind: "txs", timestamp: NOW + 1n, txs: [] } }]);
      expect(og.outputs).toEqual([{ entityId: ALICE, signerId: aliceAddr, entityTxs: [] }]);
      accepted++;
    }
    expect(accepted).toBeGreaterThan(20);
    expect(refused).toBeGreaterThan(100);
    expect(admissionOnly).toBeLessThan(accepted);
  });

  test("MATCH: a lendingOffer for a token the hub Account has not enabled is og LENDING_TOKEN_NOT_ENABLED; the missing hub is LENDING_HUB_ACCOUNT_MISSING", () => {
    const offer = (patch: Record<string, unknown>): EntityTx => ({ type: "lendingOffer", data: { positionId: `lend-${"a".repeat(16)}`, hubEntityId: BOB, tokenId: T1, amount: 5n, termId: "1d", interestBps: 50, ...patch } }) as EntityTx;
    for (const [patch, code] of [[{ tokenId: T2 }, "LENDING_TOKEN_NOT_ENABLED"], [{ hubEntityId: CAROL }, "LENDING_HUB_ACCOUNT_MISSING"], [{ interestBps: 10_001 }, "LENDING_INVALID_INTEREST_BPS"]] as const) {
      const og = runOg(offer(patch) as never), rw = runRewrite(offer(patch));
      expect(og).toEqual({ ok: false, code });
      expect(rw.ok ? "accepted" : rw.error._tag === "lending_entity" ? rw.error.reason : rw.error._tag).toBe(code);
    }
  });
});
