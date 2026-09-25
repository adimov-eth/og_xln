import { describe, expect, test } from "bun:test";
import { getEntityLeaderOrder, getEntityLeaderState } from "../../core/entity/consensus/leader/index.ts";
import { calculateQuorumPower, isSingleSignerBoard } from "../../core/entity/consensus/replica-validation.ts";
import { validateConsensusConfig } from "../../core/entity/consensus/config-validation.ts";
import { buildEntityFrameAuthority, computeEntityFrameAuthorityRoot } from "../../core/entity/consensus/state-root.ts";
import {
  address, allowedProposer, applyEntityInput, applyRuntime, convertOutput, createEntity, createRuntime, spawn, signature,
  type Address, type EntityReplica, type EntityTx,
} from "../xln.ts";
import { ALICE, BOB, CAROL, TERMS, TOKEN, signEntityFrame, unwrap, unwrapErr, verifiers } from "../xln_run.ts";

const A = unwrap(address(`0x${"01".repeat(20)}`)); // lexicographically lower
const B = unwrap(address(`0x${"02".repeat(20)}`)); // lexicographically higher
const JUR = TERMS.domain;
const ogConfig = (validators: readonly string[], shares: Record<string, bigint>, threshold: bigint) =>
  ({ mode: "proposer-based" as const, threshold, validators: [...validators], shares });
const teaching = (members: readonly (readonly [Address, bigint])[], threshold: bigint) =>
  unwrap(createEntity({ id: ALICE, jurisdiction: JUR, threshold, members: new Map(members.map(([a, s]) => [a, { shares: s }])) }));
const ctx = (signerId: Address, extra: Partial<{ from: typeof BOB }> = {}) => ({ ...verifiers, self: ALICE, signerId, ...extra });
const open: EntityTx = { type: "openAccount", target: BOB, terms: TERMS };
const propose = (r: EntityReplica, signer: Address, txs: readonly EntityTx[] = [open]) => applyEntityInput(r, { kind: "txs", timestamp: 1n, txs }, ctx(signer));
const precommit = (r: EntityReplica, signer: Address) => {
  if (r._tag !== "proposed") throw new Error("not proposed");
  return applyEntityInput(r, { kind: "precommit", signature: signEntityFrame(r.frame, signer) }, ctx(signer));
};

describe("entity-runtime: proposer selection", () => {
  test("DIVERGES: og proposer = validators[0] (positional CEO); rewrite proposer = least address", () => {
    const og = getEntityLeaderState({ entityId: ALICE, height: 0, prevFrameHash: "", config: ogConfig([B, A], { [B]: 1n, [A]: 1n }, 2n) } as never);
    expect(og.activeValidatorId).toBe(B);
    const rw = teaching([[B, 1n], [A, 1n]], 2n);
    expect(allowedProposer(rw.state.quorum)).toBe(A);
    // og refuses nothing here; rewrite refuses B (og's leader) as a proposer
    expect(unwrapErr(propose(rw, B))._tag).toBe("not_proposer");
  });
  test("DIVERGES: og failover order sorts successors by shares desc; rewrite has no leader order/view at all", () => {
    const C = `0x${"03".repeat(20)}`;
    expect(getEntityLeaderOrder(ogConfig([B, A, C], { [B]: 1n, [A]: 1n, [C]: 5n }, 2n))).toEqual([B, C, A]);
  });
  test("DIVERGES: runtime convertOutput routes to receiver's least-address signer; og resolveEntityProposerId -> validators[0]/active leader", () => {
    const receiver = unwrap(createEntity({ id: BOB, jurisdiction: JUR, threshold: 2n, members: new Map([[B, { shares: 1n }], [A, { shares: 1n }]]) }));
    const rt = spawn(createRuntime(), receiver);
    const routed = unwrap(convertOutput(rt, { to: BOB, tx: { type: "openAccount", target: ALICE, terms: TERMS } }, ALICE, 1n));
    expect(routed.signerId).toBe(A);
    expect(getEntityLeaderState({ entityId: BOB, height: 0, prevFrameHash: "", config: ogConfig([B, A], { [B]: 1n, [A]: 1n }, 2n) } as never).activeValidatorId).toBe(B);
  });
});

describe("entity-runtime: authority root", () => {
  test("MATCH: single-validator frame authorityRoot == og computeEntityFrameAuthorityRoot", () => {
    const p = unwrap(propose(teaching([[A, 1n]], 1n), A));
    if (p.replica._tag !== "proposed") throw new Error("phase");
    const og = computeEntityFrameAuthorityRoot(buildEntityFrameAuthority({ config: ogConfig([A], { [A]: 1n }, 1n) } as never));
    expect(p.replica.frame.authorityRoot).toBe(og);
  });
  test("MATCH: two validators given in sorted order produce og's root", () => {
    const p = unwrap(propose(teaching([[A, 1n], [B, 1n]], 2n), A));
    if (p.replica._tag !== "proposed") throw new Error("phase");
    expect(p.replica.frame.authorityRoot).toBe(computeEntityFrameAuthorityRoot(buildEntityFrameAuthority({ config: ogConfig([A, B], { [A]: 1n, [B]: 1n }, 2n) } as never)));
  });
  test("DIVERGES: og commits positional validator order [B,A] (leader B); rewrite always commits sorted [A,B] (leader A) -> authorityRoot mismatch", () => {
    const p = unwrap(propose(teaching([[B, 1n], [A, 1n]], 2n), A));
    if (p.replica._tag !== "proposed") throw new Error("phase");
    const og = computeEntityFrameAuthorityRoot(buildEntityFrameAuthority({ config: ogConfig([B, A], { [B]: 1n, [A]: 1n }, 2n) } as never));
    expect(p.replica.frame.authorityRoot).not.toBe(og);
  });
});

describe("entity-runtime: quorum and threshold", () => {
  test("MATCH: threshold is >= over summed shares (og calculateQuorumPower >= threshold)", () => {
    const cfg = ogConfig([A, B], { [A]: 1n, [B]: 1n }, 2n);
    expect(calculateQuorumPower(cfg, [A]) >= cfg.threshold).toBe(false);
    expect(calculateQuorumPower(cfg, [A, B]) >= cfg.threshold).toBe(true);
    const p = unwrap(propose(teaching([[A, 1n], [B, 1n]], 2n), A));
    const one = unwrap(precommit(p.replica, A));
    expect(one.replica._tag).toBe("proposed");
    const two = unwrap(precommit(one.replica, B));
    expect(two.replica._tag).toBe("open");
    expect(two.replica.state.accounts.has(BOB)).toBe(true);
  });
  test("MATCH: shares weighting - one heavy signer alone reaches threshold", () => {
    const p = unwrap(propose(teaching([[A, 1n], [B, 3n]], 3n), A));
    expect(unwrap(precommit(p.replica, B)).replica._tag).toBe("open");
  });
  test("DIVERGES: og single-signer board commits in the proposing input; rewrite waits in 'proposed' for an explicit precommit", () => {
    expect(isSingleSignerBoard(ogConfig([A], { [A]: 1n }, 1n))).toBe(true);
    const p = unwrap(propose(teaching([[A, 1n]], 1n), A));
    expect(p.replica._tag).toBe("proposed");
    expect(p.outputs.length).toBe(0);
  });
  test("DIVERGES: og caps threshold/shares at uint16 (0xffff); rewrite admits larger", () => {
    expect(() => validateConsensusConfig(ogConfig([A], { [A]: 70_000n }, 70_000n))).toThrow(/uint16/);
    expect(teaching([[A, 70_000n]], 70_000n)._tag).toBe("open");
  });
  test("DIVERGES: og rejects a second different precommit from the same signer (PRECOMMIT_SIGNER_EQUIVOCATION); rewrite overwrites it", () => {
    const anySig = { verify: verifiers.verify, verifyMember: () => true };
    const p = unwrap(propose(teaching([[A, 1n], [B, 1n]], 2n), A));
    const first = unwrap(applyEntityInput(p.replica, { kind: "precommit", signature: unwrap(signature("aa")) }, { ...anySig, self: ALICE, signerId: A }));
    const second = applyEntityInput(first.replica, { kind: "precommit", signature: unwrap(signature("bb")) }, { ...anySig, self: ALICE, signerId: A });
    const r2 = unwrap(second).replica;
    if (r2._tag !== "proposed") throw new Error("phase");
    expect(r2.signatures.get(A)).toBe(unwrap(signature("bb")));
  });
  test("DIVERGES: late precommit for an already-committed frame: og commits as no-op; rewrite refuses 'not_proposed'", () => {
    const p = unwrap(propose(teaching([[A, 1n]], 1n), A));
    if (p.replica._tag !== "proposed") throw new Error("phase");
    const sig = signEntityFrame(p.replica.frame, A);
    const done = unwrap(applyEntityInput(p.replica, { kind: "precommit", signature: sig }, ctx(A)));
    expect(done.replica._tag).toBe("open");
    expect(unwrapErr(applyEntityInput(done.replica, { kind: "precommit", signature: sig }, ctx(A)))._tag).toBe("not_proposed");
  });
  test("DIVERGES: txs arriving while a frame is proposed: og queues in mempool; rewrite refuses 'already_proposed'", () => {
    const p = unwrap(propose(teaching([[A, 1n], [B, 1n]], 2n), A));
    expect(unwrapErr(propose(p.replica, A, [{ type: "openAccount", target: CAROL, terms: TERMS }]))._tag).toBe("already_proposed");
  });
});

describe("entity-runtime: frame clock", () => {
  test("DIVERGES: og rejects ENTITY_FRAME_TIMESTAMP_REGRESSION; rewrite Head has no timestamp and accepts a frame older than its parent", () => {
    const first = unwrap(applyEntityInput(teaching([[A, 1n]], 1n), { kind: "txs", timestamp: 100n, txs: [open] }, ctx(A)));
    const committed = unwrap(precommit(first.replica, A));
    expect(committed.replica._tag).toBe("open");
    const older = applyEntityInput(committed.replica, { kind: "txs", timestamp: 50n, txs: [{ type: "openAccount", target: CAROL, terms: TERMS }] }, ctx(A));
    expect(unwrap(older).replica._tag).toBe("proposed");
  });
});

describe("entity-runtime: entity tx fold", () => {
  test("DIVERGES: one refused tx refuses the whole input (strictFold); og evicts/skips only that tx", () => {
    const r = teaching([[A, 1n]], 1n);
    const bad: EntityTx = { type: "addDelta", target: CAROL, tokenId: TOKEN };
    expect(unwrapErr(propose(r, A, [open, bad]))._tag).toBe("no_such_account");
  });
  test("DIVERGES: duplicate openAccount with identical terms: og throws OPEN_ACCOUNT_ALREADY_EXISTS; rewrite no-op", () => {
    const p = unwrap(propose(teaching([[A, 1n]], 1n), A, [open, open]));
    expect(p.replica._tag).toBe("proposed");
  });
  test("EXTRA: local openAccount emits an openAccount output to the peer; og handleOpenAccountEntityTx returns outputs: []", () => {
    const p = unwrap(propose(teaching([[A, 1n]], 1n), A));
    const c = unwrap(precommit(p.replica, A));
    expect(c.outputs).toEqual([{ to: BOB, tx: { type: "openAccount", target: ALICE, terms: TERMS } }]);
  });
  test("MATCH: runtime outbox preserves positional (input, then per-input) order, never sorted", () => {
    const e1 = teaching([[A, 1n]], 1n);
    const p = unwrap(propose(e1, A, [{ type: "openAccount", target: CAROL, terms: TERMS }, open]));
    const rt = spawn(createRuntime(), p.replica);
    if (p.replica._tag !== "proposed") throw new Error("phase");
    const out = applyRuntime(rt, [{ kind: "create", entityId: ALICE, signerId: A, input: { kind: "precommit", signature: signEntityFrame(p.replica.frame, A) } }], verifiers);
    expect(out.rejected).toEqual([]);
    expect(out.outbox.map((o) => o.to)).toEqual([CAROL, BOB]);
  });
});
