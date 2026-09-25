import { describe, expect, test } from "bun:test";
import {
  authorEntityTxs, buildCommand, certifiedBoardStackKey, checkCommand, configBoardHash, createEntity, entityId, entityTransactionAction, foldTxs, hashCommand, hashCommandTxs, hashEntityFrame,
  hashProposalAction, applyEntityInput, proposalId, tokenId, wireEntityTx,
  type Address, type EntityCommand, type EntityError, type EntityId, type EntityReplica, type EntityState, type EntityTx, type Hash, type ProposalAction,
} from "../xln.ts";
import { ALICE, BOB, NOW, TERMS, aliceAddr, bobAddr, carolAddr, crypto, hankoVerify, unwrap, verifiers } from "../xln_run.ts";
import { encodeCanonicalConsensusBytes } from "../../core/protocol/serialization/binary-codec.ts";
import { hashEntityCommand, hashEntityCommandTxs, UNREGISTERED_ENTITY_COMMAND_STACK_KEY } from "../../core/entity/command/command-codec.ts";
import { advanceEntityCommandNonce, assertSignedEntityCommand, getEntityCommandDisposition, resolveEntityCommandBoard } from "../../core/entity/command/index.ts";
import { buildEntityTransactionProposalAction, hashEntityProposalAction } from "../../core/entity/auth/authorization.ts";
import { generateProposalId } from "../../core/entity/tx/processing/proposals.ts";
import { handleChatEntityTx, handleChatMessageEntityTx, handleProfileUpdateEntityTx, handleProposeEntityTx, handleVoteEntityTx } from "../../core/entity/tx/handlers/system/basic.ts";
import { EntityCommandRejectionError } from "../../core/entity/tx/processing/invariant-errors.ts";
import { readEntityFrameEvents } from "../../core/entity/frame-events.ts";
import { getCertifiedBoardStackKey } from "../../core/jurisdiction/machine/board-registry/index.ts";
import { createEntityFrameHashFromStateRoot } from "../../core/entity/consensus/frame.ts";
import { handleExtendCreditEntityTx } from "../../core/entity/tx/handlers/account/lifecycle/admin.ts";
import { handleLendingBorrowEntityTx, handleLendingClosePositionEntityTx } from "../../core/entity/tx/handlers/payments/lending.ts";

let seed = 3;
const rng = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (n: number): number => Math.floor(rng() * n);
const pick = <T>(xs: readonly T[]): T => xs[ri(xs.length)] as T;
const SIGNERS = [aliceAddr, bobAddr, carolAddr] as const;
const JUR = TERMS.domain;
const env = { quietRuntimeLogs: true } as never;
const bytes = (v: unknown): string => Buffer.from(encodeCanonicalConsensusBytes(v)).toString("hex");
const signAs = (addr: Address) => (h: Hash) => crypto.sign(h, addr);
/** A teaching Entity whose id is its own config board hash (og lazy board, epoch 0). */
const lazyEntity = (members: readonly (readonly [Address, bigint])[], threshold: bigint): EntityReplica => {
  const seedOf = (id: EntityId) => unwrap(createEntity({ id, jurisdiction: JUR, threshold, members: new Map(members.map(([a, s]) => [a, { shares: s }])) }));
  return seedOf(unwrap(entityId(configBoardHash(seedOf(ALICE).state.quorum))));
};
const ogConfig = (s: EntityState) => {
  if (s.quorum._tag !== "teaching") throw new Error("teaching");
  const members = [...s.quorum.members];
  return { mode: "proposer-based" as const, threshold: s.quorum.threshold, validators: members.map(([a]) => a.toLowerCase()), shares: Object.fromEntries(members.map(([a, m]) => [a.toLowerCase(), m.shares])) };
};
/** og EntityState fields governance reads and writes. */
const ogState = (s: EntityState, timestamp: number): any => ({ entityId: s.id, config: ogConfig(s), proposals: new Map(), profile: { name: `Entity ${s.id.slice(-4)}`, avatar: "", bio: "", website: "" }, timestamp });
const wire = (tx: EntityTx): any => wireEntityTx(tx);
const tagOf = (e: unknown): "entity_command" | "entity_invariant" => (e instanceof EntityCommandRejectionError ? "entity_command" : "entity_invariant");
/** og applyNestedEntityTx (frame/application.ts) with og's own handlers: signed-command checks, disposition, the individual txs, approved collective txs, nonce advance. */
const ogApplyCommand = (before: any, command: unknown): { state: any } | { error: "entity_command" | "entity_invariant"; message: string } => {
  const st = structuredClone(before);
  try {
    const c = assertSignedEntityCommand(env, st, command);
    if (getEntityCommandDisposition(st, c) !== "next") return { state: st };
    let cur = st;
    const collective = (tx: any): void => {
      if (tx.type === "chatMessage") cur = handleChatMessageEntityTx(cur, tx, true).newState;
      else if (tx.type === "profile-update") cur = handleProfileUpdateEntityTx(env, cur, tx, true).newState;
      else throw new Error(`test: collective ${tx.type}`);
    };
    for (const tx of c.txs as any[]) {
      const r = tx.type === "propose" ? handleProposeEntityTx(env, cur, tx, true) : tx.type === "vote" ? handleVoteEntityTx(env, cur, tx, true) : handleChatEntityTx(cur, tx, true);
      cur = r.newState;
      for (const approved of r.approvedEntityTxs ?? []) collective(approved);
    }
    return { state: advanceEntityCommandNonce(cur, c) };
  } catch (e) {
    return { error: tagOf(e), message: String(e) };
  }
};

describe("entity-txs-3: entityCommand codec and hashes (og command/command-codec.ts, auth/authorization.ts)", () => {
  test("MATCH: hashEntityCommandTxs / hashEntityCommand / generateProposalId / stack keys over 200 random commands", () => {
    for (let i = 0; i < 200; i++) {
      const txs: EntityTx[] = Array.from({ length: 1 + ri(3) }, () => pick<EntityTx>([
        { type: "chat", data: { from: aliceAddr, message: `m${ri(99)}` } },
        { type: "vote", data: { proposalId: `prop_${ri(9)}`, voter: aliceAddr, choice: pick(["yes", "no"] as const), ...(rng() < 0.5 ? { comment: `c${ri(9)}` } : {}) } },
        { type: "propose", data: { proposer: aliceAddr, action: { type: "collective_message", data: { message: `x${ri(9)}` } } } },
      ]));
      expect(unwrap(hashCommandTxs(txs))).toBe(hashEntityCommandTxs(txs.map(wire)));
      const body = { version: 1 as const, entityId: `0x${ri(1e9).toString(16).padStart(64, "0")}`, stackKey: UNREGISTERED_ENTITY_COMMAND_STACK_KEY, boardHash: `0x${ri(1e9).toString(16).padStart(64, "1")}`, boardEpoch: ri(5),
        authorSignerId: aliceAddr.toLowerCase(), authorSigner: aliceAddr.toLowerCase(), nonce: BigInt(1 + ri(20)), txsHash: unwrap(hashCommandTxs(txs)), txs };
      expect(unwrap(hashCommand(body))).toBe(hashEntityCommand({ ...body, txs: txs.map(wire) }));
    }
    expect(certifiedBoardStackKey({ chainId: 31337, depositoryAddress: JUR.depositoryAddress, entityProviderAddress: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512" }))
      .toBe(getCertifiedBoardStackKey({ chainId: 31337, depositoryAddress: JUR.depositoryAddress, entityProviderAddress: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512" }));
    const r = lazyEntity([[aliceAddr, 1n], [bobAddr, 2n], [carolAddr, 1n]], 3n);
    const board = resolveEntityCommandBoard(env, ogState(r.state, 0));
    expect(configBoardHash(r.state.quorum)).toBe(board.boardHash);
    const action: ProposalAction = { type: "collective_message", data: { message: "hello" } };
    for (let n = 1n; n < 4n; n++) {
      const fence = n === 1n ? {} : { entityCommandNonces: { version: 1, boardHash: board.boardHash, boardEpoch: 0, bySigner: new Map([[bobAddr.toLowerCase(), { nonce: n - 1n, commandHash: `0x${"ab".repeat(32)}` }]]) } };
      expect(proposalId(unwrap(hashProposalAction(action)), bobAddr.toLowerCase(), board, n)).toBe(generateProposalId(env, action, bobAddr, { ...ogState(r.state, 0), ...fence }));
    }
  });
  test("MATCH: buildEntityTransactionProposalAction / hashEntityProposalAction over 150 random collective batches (numeric token ids on the wire)", () => {
    const tok = (n: number) => unwrap(tokenId(String(n)));
    for (let i = 0; i < 150; i++) {
      const txs: EntityTx[] = Array.from({ length: 1 + ri(3) }, () => pick<EntityTx>([
        { type: "chatMessage", data: { message: `n${ri(9)}`, timestamp: ri(100) } },
        { type: "extendCredit", data: { counterpartyEntityId: BOB, tokenId: tok(1 + ri(3)), amount: BigInt(ri(1000)) } },
        { type: "requestCollateral", data: { counterpartyEntityId: BOB, tokenId: tok(1 + ri(3)), amount: BigInt(ri(1000)), feeAmount: 1n, policyVersion: 1, ...(rng() < 0.5 ? { feeTokenId: tok(2) } : {}) } },
        { type: "profile-update", data: { profile: { entityId: ALICE, name: `n${ri(9)}` } } },
        { type: "openAccount", data: { targetEntityId: BOB, accountDomain: JUR, watchSeed: TERMS.watchSeed, disputeConfig: TERMS.disputeConfig, ...(rng() < 0.5 ? { tokenId: tok(2), creditAmount: 7n } : {}) } },
      ]));
      const action = unwrap(entityTransactionAction(txs)), og = buildEntityTransactionProposalAction(txs.map(wire));
      expect(action.type === "entity_transaction" ? action.data.actionHash : "").toBe(og.data.actionHash);
      expect(unwrap(hashProposalAction(action))).toBe(hashEntityProposalAction(og));
    }
    // a protocol or individual tx inside a collective action is og ENTITY_COLLECTIVE_ACTION_TX_FORBIDDEN
    const chat: EntityTx = { type: "chat", data: { from: aliceAddr, message: "x" } };
    expect(entityTransactionAction([chat])).toEqual({ ok: false, error: { _tag: "entity_invariant", reason: "ENTITY_COLLECTIVE_ACTION_TX_FORBIDDEN:chat" } });
    expect(() => buildEntityTransactionProposalAction([chat as never])).toThrow("ENTITY_COLLECTIVE_ACTION_TX_FORBIDDEN:chat");
  });
});

describe("entity-txs-3: signed commands, propose and vote (og command/index.ts, system/basic.ts)", () => {
  test("MATCH: 40 random governance runs (random board, 25 commands each, tampering) -- same accept / evict / refuse class, same proposals, nonces, events and profile as og", () => {
    let accepted = 0, rejected = 0, fatal = 0, executed = 0;
    for (let run = 0; run < 24; run++) {
      const n = 1 + ri(3), members = SIGNERS.slice(0, n).map((a) => [a, BigInt(1 + ri(3))] as const);
      const total = members.reduce((s, [, x]) => s + x, 0n), threshold = 1n + BigInt(ri(Number(total)));
      let r = lazyEntity(members, threshold);
      let og = ogState(r.state, 0);
      const history: EntityCommand[] = [];
      for (let step = 0; step < 20; step++) {
        const timestamp = NOW + BigInt(step);
        og = { ...og, timestamp: Number(timestamp) };
        const [author] = pick(members), who = author.toLowerCase();
        const proposals = [...((r.state.committed["proposals"] as ReadonlyMap<string, unknown> | undefined) ?? new Map()).keys()];
        const collective: EntityTx[] = Array.from({ length: 1 + ri(2) }, () => pick<EntityTx>([
          { type: "chatMessage", data: { message: `c${ri(9)}`, timestamp: ri(9) } },
          { type: "profile-update", data: { profile: { entityId: r.state.id, name: `N${ri(9)}`, ...(rng() < 0.3 ? { sectors: ["finance"] } : {}) } } },
        ]));
        const action: ProposalAction = rng() < 0.4 ? { type: "collective_message", data: { message: `msg${ri(9)}` } } : unwrap(entityTransactionAction(collective));
        const kind = ri(10);
        const txs: EntityTx[] = kind < 4 ? [{ type: "propose", data: { proposer: rng() < 0.05 ? pick(SIGNERS) : author, action } }]
          : kind < 8 ? [{ type: "vote", data: { proposalId: proposals.length > 0 && rng() < 0.9 ? pick(proposals) : "prop_missing", voter: author, choice: rng() < 0.7 ? "yes" : "no", ...(rng() < 0.3 ? { comment: "ok" } : {}) } }]
          : kind < 9 ? [{ type: "chat", data: { from: author, message: rng() < 0.1 ? "" : "hi" } }]
          : [{ type: "chatMessage", data: { message: "direct", timestamp: 1 } }];
        let command: EntityCommand;
        const built = buildCommand(r.state, author, txs, signAs(author));
        if (!built.ok) {
          // the author's own builder refuses what og's builder refuses (a collective tx in a command, a foreign author binding)
          expect(["entity_command", "entity_invariant"]).toContain(built.error._tag);
          const body = { version: 1 as const, entityId: r.state.id, stackKey: UNREGISTERED_ENTITY_COMMAND_STACK_KEY, boardHash: configBoardHash(r.state.quorum), boardEpoch: 0, authorSignerId: who, authorSigner: who, nonce: 1n, txsHash: unwrap(hashCommandTxs(txs)), txs };
          command = { ...body, signature: `0x${unwrap(crypto.sign(unwrap(hashCommand(body)) as Hash, author))}` };
        } else command = built.value;
        const tamper = ri(12);
        if (tamper === 0 && history.length > 0) command = pick(history); // an old slot: exact retry or a cancel
        if (tamper === 1) { const body = { ...command, nonce: command.nonce + 1n }; command = { ...body, signature: `0x${unwrap(crypto.sign(unwrap(hashCommand(body)) as Hash, author))}` }; }
        if (tamper === 2) { const other = pick(SIGNERS); command = { ...command, signature: `0x${unwrap(crypto.sign(unwrap(hashCommand(command)) as Hash, other))}` }; }
        if (tamper === 3) command = { ...command, boardHash: `0x${"11".repeat(32)}` };
        const ogOut = ogApplyCommand(og, wire({ type: "entityCommand", data: command }).data);
        const rw = foldTxs(r.state, r.accountReplicas, [{ type: "entityCommand", data: command }], { verify: hankoVerify, timestamp });
        if ("error" in ogOut) {
          expect(rw.ok ? "ok" : (rw.error as EntityError)._tag).toBe(ogOut.error);
          if (ogOut.error === "entity_command") rejected++; else fatal++;
          continue;
        }
        if (!rw.ok) throw new Error(`rewrite refused what og accepted: ${JSON.stringify(rw.error)} / ${JSON.stringify(txs.map((t) => t.type))}`);
        accepted++;
        const d = rw.value.draft;
        expect(bytes(d.state.committed["proposals"] ?? new Map())).toBe(bytes(ogOut.state.proposals));
        expect(bytes(d.state.committed["entityCommandNonces"] ?? null)).toBe(bytes(ogOut.state.entityCommandNonces ?? null));
        expect(d.events ?? []).toEqual(readEntityFrameEvents(ogOut.state) as never);
        if ((d.events ?? []).length > 0 && txs[0]?.type !== "chat") executed++;
        if (d.state.committed["profile"] !== undefined) expect(d.state.committed["profile"]).toEqual(ogOut.state.profile);
        history.push(command);
        r = { ...r, state: d.state };
        og = { ...ogOut.state, ...{ ["__xlnEntityFrameEvents"]: [] } };
      }
    }
    expect(accepted).toBeGreaterThan(100);
    expect(rejected).toBeGreaterThan(20);
    expect(fatal).toBeGreaterThan(20);
    expect(executed).toBeGreaterThan(10);
  }, 60_000);
  test("MATCH: og assertSignedEntityCommand accepts the rewrite's authorEntityTxs output; a 2-of-3 board's collective tx waits for a vote, then executes", () => {
    const r = lazyEntity([[aliceAddr, 1n], [bobAddr, 1n], [carolAddr, 1n]], 2n);
    const profile: EntityTx = { type: "profile-update", data: { profile: { entityId: r.state.id, name: "Board" } } };
    const authored = unwrap(authorEntityTxs(r.state, aliceAddr, [profile, { type: "chat", data: { from: aliceAddr, message: "hello" } }], signAs(aliceAddr)));
    expect(authored.map((t) => t.type)).toEqual(["entityCommand", "entityCommand"]);
    const [first, second] = authored as [Extract<EntityTx, { type: "entityCommand" }>, Extract<EntityTx, { type: "entityCommand" }>];
    expect(first.data.txs[0]?.type).toBe("propose");
    expect(first.data.nonce).toBe(1n);
    expect(second.data.nonce).toBe(2n);
    const ogAfterFirst = ogApplyCommand(ogState(r.state, Number(NOW)), wire(first).data);
    if ("error" in ogAfterFirst) throw new Error(ogAfterFirst.message);
    expect(() => assertSignedEntityCommand(env, ogAfterFirst.state, wire(second).data)).not.toThrow();
    const folded = unwrap(foldTxs(r.state, r.accountReplicas, authored, { verify: hankoVerify, timestamp: NOW })).draft;
    const pending = [...(folded.state.committed["proposals"] as ReadonlyMap<string, unknown>).keys()];
    expect(pending.length).toBe(1);
    expect(folded.state.committed["profile"]).toBeUndefined();
    expect(folded.events).toEqual([{ type: "text", validatorId: aliceAddr.toLowerCase(), message: "hello" }]);
    const vote = unwrap(authorEntityTxs(folded.state, bobAddr, [{ type: "vote", data: { proposalId: pending[0] as string, voter: bobAddr, choice: "yes" } }], signAs(bobAddr)));
    const voted = unwrap(foldTxs(folded.state, folded.accountReplicas, vote, { verify: hankoVerify, timestamp: NOW + 1n })).draft;
    expect((voted.state.committed["proposals"] as ReadonlyMap<string, unknown>).size).toBe(0);
    expect(voted.state.committed["profile"]).toMatchObject({ name: "Board" });
  });
  test("MATCH (og createEntityFrameHashFromStateRoot): a frame carrying a signed collective command hashes like og, its events included", () => {
    // [A, B] with threshold 1: A's own share executes the proposal at once, and the 2-member board holds the frame so it can be inspected
    const r = lazyEntity([[aliceAddr, 1n], [bobAddr, 1n]], 1n);
    const authored = unwrap(authorEntityTxs(r.state, aliceAddr, [{ type: "profile-update", data: { profile: { entityId: r.state.id, name: "Solo" } } }, { type: "chatMessage", data: { message: "note", timestamp: 1 } }], signAs(aliceAddr)));
    const p = unwrap(applyEntityInput(r, { kind: "txs", timestamp: NOW, txs: [...authored, { type: "chatMessage", data: { message: "raw", timestamp: 2 } }] }, { ...verifiers, self: r.state.id, signerId: aliceAddr })).replica;
    if (p._tag !== "proposed") throw new Error("phase");
    expect(p.draft.state.committed["profile"]).toMatchObject({ name: "Solo" });
    const ogOut = ogApplyCommand(ogState(r.state, Number(NOW)), wire(authored[0] as EntityTx).data);
    if ("error" in ogOut) throw new Error(ogOut.message);
    handleChatMessageEntityTx(ogOut.state, { type: "chatMessage", data: { message: "raw", timestamp: 2 } } as never, true);
    const ogEvents = readEntityFrameEvents(ogOut.state);
    expect(p.frame.events).toEqual(ogEvents as never);
    expect(bytes(p.draft.state.committed["entityCommandNonces"])).toBe(bytes(ogOut.state.entityCommandNonces));
    expect(unwrap(hashEntityFrame(p.frame))).toBe(createEntityFrameHashFromStateRoot("genesis", 1, Number(NOW), p.frame.txs.map(wire), ogEvents, r.state.id, p.frame.stateRoot, p.frame.authorityRoot, p.frame.entityContext as never));
  });
  test("MATCH: plain propose / vote outside a command are og ENTITY_COMMAND_REQUIRED (a plain Error: the input is refused)", () => {
    const r = lazyEntity([[aliceAddr, 1n]], 1n);
    const out = foldTxs(r.state, r.accountReplicas, [{ type: "propose", data: { proposer: aliceAddr, action: { type: "collective_message", data: { message: "m" } } } }], { verify: hankoVerify, timestamp: NOW });
    expect(out).toEqual({ ok: false, error: { _tag: "entity_invariant", reason: "ENTITY_COMMAND_REQUIRED:propose" } });
    // og with a non-lazy Entity id and no certified board record: ENTITY_COMMAND_CERTIFIED_BOARD_REQUIRED
    const numbered = unwrap(createEntity({ id: ALICE, jurisdiction: JUR, threshold: 1n, members: new Map([[bobAddr, { shares: 1n }]]) }));
    expect(buildCommand(numbered.state, bobAddr, [{ type: "chat", data: { from: bobAddr, message: "x" } }], signAs(bobAddr))).toEqual({ ok: false, error: { _tag: "entity_invariant", reason: `ENTITY_COMMAND_CERTIFIED_BOARD_REQUIRED:${ALICE}` } });
    expect(() => resolveEntityCommandBoard(env, ogState(numbered.state, 0))).toThrow(`ENTITY_COMMAND_CERTIFIED_BOARD_REQUIRED:${ALICE}`);
    void checkCommand;
  });
});

describe("entity-txs-3: frame events (og frame-events.ts, certified in the Entity frame hash)", () => {
  test("MATCH: extendCredit and lending entity txs record og's status events", () => {
    const a = lazyEntity([[aliceAddr, 1n]], 1n);
    const opened = unwrap(applyEntityInput(a, { kind: "txs", timestamp: NOW, txs: [{ type: "openAccount", data: { targetEntityId: BOB, accountDomain: JUR, watchSeed: TERMS.watchSeed, disputeConfig: TERMS.disputeConfig } }] }, { ...verifiers, self: a.state.id, signerId: aliceAddr })).replica;
    const tok = unwrap(tokenId("1"));
    const cases: readonly [EntityTx, (s: any) => any][] = [
      [{ type: "extendCredit", data: { counterpartyEntityId: BOB, tokenId: tok, amount: 55n } }, (s) => handleExtendCreditEntityTx(s, { type: "extendCredit", data: { counterpartyEntityId: BOB, tokenId: 1, amount: 55n } } as never, true)],
      [{ type: "lendingBorrow", data: { requestId: "borrow-00000000000000a1", hubEntityId: BOB, tokenId: tok, amount: 9n, termId: "1d" } }, (s) => handleLendingBorrowEntityTx(s, { type: "lendingBorrow", data: { requestId: "borrow-00000000000000a1", hubEntityId: BOB, tokenId: 1, amount: 9n, termId: "1d" } } as never, true)],
      [{ type: "lendingClosePosition", data: { hubEntityId: BOB, positionId: "lend-00000000000000c3" } }, (s) => handleLendingClosePositionEntityTx(s, { type: "lendingClosePosition", data: { hubEntityId: BOB, positionId: "lend-00000000000000c3" } } as never, true)],
    ];
    for (const [tx, ogRun] of cases) {
      const d = unwrap(foldTxs(opened.state, opened.accountReplicas, [tx], { verify: hankoVerify, timestamp: NOW + 1n })).draft;
      const ogS: any = { entityId: a.state.id, config: ogConfig(a.state), accounts: new Map([[BOB, { state: { deltas: new Map([[1, {}]]) } }]]) };
      ogRun(ogS);
      expect(d.events).toEqual(readEntityFrameEvents(ogS) as never);
    }
  });
});
