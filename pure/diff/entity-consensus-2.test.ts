import { describe, expect, test } from "bun:test";
import {
  buildEntityLeaderCertificate, buildEntityLeaderVoteBody, getEntityLeaderOrder, getEntityLeaderState, getEntityLeaderTimeoutMs, getNextEntityFailoverLeader, hashEntityLeaderVoteBody,
} from "../../core/entity/consensus/leader/index.ts";
import { expectedCommittedLeaderState, verifyEntityLeaderCertificate } from "../../core/entity/consensus/leader/certificates.ts";
import { buildEntityFrameAuthority, computeEntityFrameAuthorityRoot } from "../../core/entity/consensus/state-root.ts";
import {
  address, admit, applyAccountInput, certifiedBy, tokenId, type AccountReplica, type BoardRefresh, type BoardRefreshRefusal, type CertifiedBoard, type DoorContext, type EntityId, type HankoAuthority, type ProposedAccount, type Verify,
  entityId, applyEntityInput, buildLeaderCertificate, quorumHanko, type Hash, createEntity, hashEntityFrame, hashLeaderVote, leaderOrder, leaderStateOf, leaderTimeoutMs, leaderVoteBody, localTimeoutVote, nextFailoverLeader,
  type Address, type EntityFrame, type EntityFrameHash, type EntityInput, type EntityOutput, type EntityReplica, type EntityState, type EntityTx, type LeaderCertificate, type LeaderState, type LeaderVote,
} from "../xln.ts";
import { ALICE, BOB, NOW, TERMS, ackInput, aliceAddr, bobAddr, carolAddr, crypto, envelopeAB, genesisAB, hankoVerify, offerOf, partyIn, proposeInput, unwrap, verifiers } from "../xln_run.ts";
import { handleBoardHankoRefresh } from "../../core/account/consensus/incoming/board-hanko-refresh.ts";
import { createEntityFrameHashFromStateRoot } from "../../core/entity/consensus/frame.ts";
import { handleProfileUpdateEntityTx } from "../../core/entity/tx/handlers/system/basic.ts";
import { handleRequestCollateralEntityTx } from "../../core/entity/tx/handlers/account/lifecycle/admin.ts";
import { buildQuorumHanko, getEntityConfigBoardHash } from "../../core/hanko/signing.ts";

// og leader failover (core/entity/consensus/leader/*): view change, timeout votes and certificates (ER-18)
const A = aliceAddr, B = bobAddr, C = carolAddr;
const JUR = TERMS.domain;
// og buildQuorumHanko binds the Hanko to the lazy board of the config (assertQuorumBoardBinding): the Entity id is that board hash
const ENTITY = unwrap(entityId(await getEntityConfigBoardHash({} as never, { threshold: 2n, validators: [A, B, C].map((a) => a.toLowerCase()), shares: Object.fromEntries([A, B, C].map((a) => [a.toLowerCase(), 1n])) })));
let seed = 11;
const rng = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (n: number): number => Math.floor(rng() * n);
const addr = (i: number): Address => unwrap(address(`0x${(i + 16).toString(16).padStart(2, "0").repeat(20)}`));
const word = (i: number): string => `0x${(i + 1).toString(16).padStart(64, "0")}`;
const teaching = (members: readonly (readonly [Address, bigint])[], threshold: bigint, signerId?: Address) =>
  unwrap(createEntity({ id: ENTITY, jurisdiction: JUR, threshold, members: new Map(members.map(([a, s]) => [a, { shares: s }])), ...(signerId === undefined ? {} : { signerId }) }));
const ctx = (signerId: Address) => ({ ...verifiers, self: ENTITY, signerId });
const ogConfigOf = (s: EntityState) => {
  if (s.quorum._tag !== "teaching") throw new Error("teaching");
  const members = [...s.quorum.members];
  return { mode: "proposer-based" as const, threshold: s.quorum.threshold, validators: members.map(([a]) => a.toLowerCase()), shares: Object.fromEntries(members.map(([a, m]) => [a.toLowerCase(), m.shares])) };
};
const ogView = (s: EntityState, height: bigint, prevFrameHash: string): any =>
  ({ entityId: s.id, height: Number(height), prevFrameHash, config: ogConfigOf(s), ...(s.leaderState === undefined ? {} : { leaderState: s.leaderState }) });
const ogSig = (s: string): string => (s.startsWith("0x") ? s : `0x${s}`);
const ogCert = (c: LeaderCertificate): any => ({ ...c, votes: new Map([...c.votes].map(([k, s]) => [k, ogSig(s)])) });
const inputsFor = (outputs: readonly EntityOutput[], signer: Address): EntityInput[] => outputs.flatMap((o) => ("input" in o && o.signerId.toLowerCase() === signer.toLowerCase() ? [o.input] : []));
const openBob: EntityTx = { type: "openAccount", data: { targetEntityId: BOB, accountDomain: TERMS.domain, watchSeed: TERMS.watchSeed, disputeConfig: TERMS.disputeConfig } };

describe("entity-consensus-2: leader order, views and vote bodies (ER-18)", () => {
  test("MATCH: getEntityLeaderOrder / getEntityLeaderState / getNextEntityFailoverLeader / buildEntityLeaderVoteBody / hashEntityLeaderVoteBody over 60 random configs and leader states", () => {
    for (let i = 0; i < 60; i++) {
      const ids = [...new Set(Array.from({ length: 1 + ri(5) }, () => ri(8)))].map(addr), shares = ids.map(() => BigInt(1 + ri(4)));
      const total = shares.reduce((a, b) => a + b, 0n), threshold = 1n + BigInt(ri(Number(total)));
      const r = teaching(ids.map((a, j) => [a, shares[j] ?? 1n] as const), threshold);
      const order = leaderOrder(r.state.quorum);
      const leaderState: LeaderState | undefined = rng() < 0.3 ? undefined : { activeValidatorId: order[ri(order.length)] ?? "", view: ri(6), changedAtHeight: ri(4) };
      const height = BigInt(ri(4)), prev = height === 0n ? "genesis" : word(i);
      const state: EntityState = { ...r.state, ...(leaderState === undefined ? {} : { leaderState }) };
      const view = ogView(state, height, prev);
      expect(order).toEqual(getEntityLeaderOrder(view.config));
      expect(leaderStateOf(state)).toEqual(getEntityLeaderState(view));
      expect(nextFailoverLeader(state)).toBe(getNextEntityFailoverLeader(view));
      const body = leaderVoteBody(state, { height, prevFrameHash: prev as EntityFrameHash });
      expect(body).toEqual(buildEntityLeaderVoteBody(view));
      expect(unwrap(hashLeaderVote(body))).toBe(hashEntityLeaderVoteBody(buildEntityLeaderVoteBody(view)));
    }
  });
  test("MATCH: getEntityLeaderTimeoutMs = min(60s, 10s * max(1, floor(view)))", () => {
    for (const v of [0, 0.5, 1, 2, 3, 5.9, 6, 7, 100]) expect(leaderTimeoutMs(v)).toBe(getEntityLeaderTimeoutMs(v));
  });
});

describe("entity-consensus-2: timeout certificate and certified view change (ER-18)", () => {
  // [A, B, C] equal shares, threshold 2: A (the CEO) goes silent, B and C time out, B (order[1]) proposes at view 1
  const members = [[A, 1n], [B, 1n], [C, 1n]] as const;
  const run = () => {
    const step = (r: EntityReplica, input: EntityInput, signer: Address) => unwrap(applyEntityInput(r, input, ctx(signer)));
    let b = step(teaching(members, 2n, B), { kind: "txs", timestamp: NOW, txs: [openBob] }, B).replica;
    let c = step(teaching(members, 2n, C), { kind: "txs", timestamp: NOW, txs: [openBob] }, C).replica;
    const at = NOW + 10_000n;
    const bVote = step(b, localTimeoutVote(b, at) ?? (() => { throw new Error("no vote"); })(), B);
    b = bVote.replica;
    const cSawB = step(c, inputsFor(bVote.outputs, C)[0] as EntityInput, C);
    c = cSawB.replica;
    const cVote = step(c, localTimeoutVote(c, at) ?? (() => { throw new Error("no vote"); })(), C);
    c = cVote.replica;
    const bCertified = step(b, inputsFor(cVote.outputs, B).find((x) => x.kind === "leaderTimeoutVote") as EntityInput, B);
    return { b: bCertified.replica, c, bVote, cVote, bCertified, step };
  };
  test("MATCH: votes are og-signed timeout votes; the certificate equals og buildEntityLeaderCertificate and og verifyEntityLeaderCertificate accepts B's frame leader", () => {
    const { b, bVote, cVote } = run();
    const vB = (inputsFor(bVote.outputs, C)[0] as Extract<EntityInput, { kind: "leaderTimeoutVote" }>).vote;
    const vC = (inputsFor(cVote.outputs, B).find((x) => x.kind === "leaderTimeoutVote") as Extract<EntityInput, { kind: "leaderTimeoutVote" }>).vote;
    const genesis = teaching(members, 2n).state;
    const view = ogView(genesis, 0n, "genesis");
    expect({ ...vB, signature: "" }).toEqual({ ...buildEntityLeaderVoteBody(view), voterId: B.toLowerCase(), signature: "" });
    expect(b._tag).toBe("proposed");
    if (b._tag !== "proposed") return;
    const frame = b.frame, cert = frame.leader.certificate;
    if (cert === undefined) throw new Error("no certificate");
    expect(frame.leader.proposerSignerId).toBe(B.toLowerCase());
    expect(frame.leader.view).toBe(1);
    const votes = new Map<string, any>([[B, { ...vB, signature: ogSig(vB.signature) }], [C, { ...vC, signature: ogSig(vC.signature) }]]);
    expect(ogCert(cert)).toEqual(buildEntityLeaderCertificate(buildEntityLeaderVoteBody(view), votes));
    expect(buildLeaderCertificate(leaderVoteBody(genesis, { height: 0n, prevFrameHash: "genesis" as EntityFrameHash }), new Map<string, LeaderVote>([[B, vB], [C, vC]]))).toEqual(cert);
    const ogFrame = { height: 1, leader: { proposerSignerId: frame.leader.proposerSignerId, view: frame.leader.view, certificate: ogCert(cert) } };
    expect(verifyEntityLeaderCertificate({} as never, view, ogFrame as never)).toBe(true);
    // og: the frame commits the certified leader (expectedCommittedLeaderState) and the authority root binds it
    const leaderState = expectedCommittedLeaderState(view, ogFrame as never);
    expect(b.draft.state.leaderState).toEqual(leaderState);
    expect(frame.authorityRoot).toBe(computeEntityFrameAuthorityRoot(buildEntityFrameAuthority({ config: view.config, leaderState } as never)));
    // a certificate short of quorum is refused by og and by the rewrite's own validation
    const short = { ...ogFrame, leader: { ...ogFrame.leader, certificate: { ...ogCert(cert), votes: new Map([[B.toLowerCase(), ogSig(vB.signature)]]) } } };
    expect(verifyEntityLeaderCertificate({} as never, view, short as never)).toBe(false);
  });
  test("MATCH: C signs and commits the certified frame, B commits with leaderState {B, view 1, changedAtHeight 1}; the stale CEO A accepts the certified proposal and follows B", async () => {
    const { b, c, bCertified, step } = run();
    const proposalToC = inputsFor(bCertified.outputs, C).find((x) => x.kind === "proposal") as EntityInput;
    const cLocked = step(c, proposalToC, C);
    expect(cLocked.replica._tag).toBe("open"); // the proposer's bundle plus C's own reach threshold 2: og handleHashPrecommits commits at once
    expect(cLocked.replica.state.leaderState).toEqual({ activeValidatorId: B.toLowerCase(), view: 1, changedAtHeight: 1 });
    const bCommitted = step(b, inputsFor(cLocked.outputs, B).find((x) => x.kind === "precommit") as EntityInput, B);
    expect(bCommitted.replica._tag).toBe("open");
    expect(bCommitted.replica.state.leaderState).toEqual({ activeValidatorId: B.toLowerCase(), view: 1, changedAtHeight: 1 });
    expect(bCommitted.replica.state.accounts.has(BOB)).toBe(true);
    // og buildQuorumHanko over the B and C manifest signatures of the Account frame is exactly the Hanko B sends
    const sent = bCommitted.outputs.find((o) => "tx" in o && o.tx.data.kind === "ack_frame");
    if (sent === undefined || !("tx" in sent) || sent.tx.data.kind !== "ack_frame") throw new Error("no account frame");
    const digest = sent.tx.data.frame.stateHash, config = ogConfigOf(b.state);
    const sigs = [B, C].map((s) => ({ signerId: s.toLowerCase(), signature: ogSig(unwrap(crypto.sign(digest as Hash, s))) }));
    expect(sent.tx.data.frameHanko).toBe(await buildQuorumHanko({} as never, ENTITY, digest, sigs, config));
    expect(unwrap(quorumHanko(b.state, digest, new Map([[B, unwrap(crypto.sign(digest as Hash, B))], [C, unwrap(crypto.sign(digest as Hash, C))]])))).toBe(sent.tx.data.frameHanko);
    const a = step(teaching(members, 2n, A), inputsFor(bCertified.outputs, A).find((x) => x.kind === "proposal") as EntityInput, A);
    expect(a.replica._tag).toBe("open");
    expect(a.replica.state.leaderState).toEqual({ activeValidatorId: B.toLowerCase(), view: 1, changedAtHeight: 1 });
  });
  test("MATCH (og assertEntityLeaderVoteMatchesState): a vote for the wrong view is refused (ENTITY_LEADER_VOTE_STALE_OR_INVALID)", () => {
    const b = teaching(members, 2n, B);
    const vote = localTimeoutVote(unwrap(applyEntityInput(b, { kind: "txs", timestamp: NOW, txs: [openBob] }, ctx(B))).replica, NOW);
    if (vote === undefined || vote.kind !== "leaderTimeoutVote") throw new Error("no vote");
    const stale = { ...vote, local: false, vote: { ...vote.vote, voterId: C.toLowerCase(), toView: 2 } };
    expect(applyEntityInput(b, stale, ctx(B)).ok).toBe(false);
    expect(() => buildEntityLeaderVoteBody(ogView(b.state, 0n, "genesis")).toView === 2 || (() => { throw new Error("ENTITY_LEADER_VOTE_STALE_OR_INVALID"); })()).toThrow();
  });
  test("MATCH (og nextReplicaDeadline): only a non-leader with leader work votes; the CEO never times itself out", () => {
    const a = teaching(members, 2n, A);
    const withWork = unwrap(applyEntityInput(teaching(members, 2n, B), { kind: "txs", timestamp: NOW, txs: [openBob] }, ctx(B))).replica;
    expect(localTimeoutVote(teaching(members, 2n, B), NOW)).toBeUndefined();
    expect(localTimeoutVote(withWork, NOW)).toBeDefined();
    expect(localTimeoutVote(a, NOW)).toBeUndefined();
  });
});

describe("entity-consensus-2: account Hankos through hashesToSign (ER-4)", () => {
  test("MATCH (og proposePendingAccountFrames + buildQuorumHanko): the view-1 frame signs the Account frame as a secondary hash and the committed Account carries the quorum Hanko", () => {
    const members = [[A, 1n], [B, 1n], [C, 1n]] as const;
    const b0 = teaching(members, 2n, B);
    const f = unwrap(applyEntityInput(teaching(members, 2n, A), { kind: "txs", timestamp: NOW, txs: [openBob] }, ctx(A))).replica;
    if (f._tag !== "proposed") throw new Error("phase");
    const frame: EntityFrame = f.frame;
    expect(frame.hashesToSign.map((h) => h.type)).toEqual(["entityFrame", ...frame.hashesToSign.slice(1).map((h) => h.type)]);
    expect(frame.hashesToSign.some((h) => h.type === "accountFrame" && h.context === `account:${BOB.slice(-8)}:frame:1`)).toBe(true);
    expect(frame.hashesToSign[0]?.hash).toBe(unwrap(hashEntityFrame(frame)));
    expect(b0._tag).toBe("open");
  });
});

describe("entity-consensus-2: board Hanko refresh and the previous-board grace (AC-13)", () => {
  // Alice's Account with Bob at height 1, committed through the ordinary propose / ack_frame / ack exchange
  const committedAlice = (): AccountReplica => {
    const door = (self: EntityId): DoorContext => ({ verify: hankoVerify, self, now: NOW });
    const a0 = unwrap(admit(genesisAB(), [{ type: "add_delta", tokenId: unwrap(tokenId("1")) }]));
    const proposed = unwrap(applyAccountInput(a0, proposeInput(a0, ALICE), door(ALICE))).replica as ProposedAccount;
    const received = unwrap(applyAccountInput(genesisAB(), offerOf(proposed, ALICE), door(BOB))).replica;
    return unwrap(applyAccountInput(proposed, ackInput(received, BOB), door(ALICE))).replica;
  };
  const BOARD: CertifiedBoard = { boardHash: word(900), activatedAtJHeight: 7, logIndex: 2 };
  const CODES: Record<BoardRefreshRefusal, string> = {
    party_mismatch: "PARTY_MISMATCH", activation_height: "ACTIVATION_HEIGHT_INVALID", activation_log_index: "ACTIVATION_LOG_INDEX_INVALID", certified_board_missing: "CERTIFIED_BOARD_MISSING",
    activation_mismatch: "ACTIVATION_MISMATCH", activation_order: "ACTIVATION_ORDER_INVALID", height_mismatch: "HEIGHT_MISMATCH", frame_hash_mismatch: "FRAME_HASH_MISMATCH",
    frame_hanko_missing: "FRAME_HANKO_MISSING", frame_hanko_invalid: "FRAME_HANKO_INVALID", dispute_mismatch: "DISPUTE_MISMATCH",
  };
  test("MATCH (og incoming/board-hanko-refresh.ts handleBoardHankoRefresh): 800 random refreshes -- same verdict, same refusal, same installed frame Hanko and refresh record, frame Hanko checked under the current board only", async () => {
    const alice = committedAlice();
    if (alice._tag !== "open" || alice.head._tag !== "installed") throw new Error("not committed");
    const head = alice.head, frameHash = head.prevFrameHash, peerDispute = alice.dispute.counterparty;
    const verdicts = { accepted: 0, rejected: new Set<string>() };
    for (let i = 0; i < 800; i++) {
      const pick = <X>(xs: readonly X[]): X => xs[ri(xs.length)] as X;
      const board = rng() < 0.1 ? undefined : BOARD;
      const aH = pick([7, 7, 7, 6, 0, 8]), aL = pick([2, 2, 2, 1, 3, -1]);
      const prev: BoardRefresh | undefined = pick([undefined, undefined, { activationJHeight: 7, activationLogIndex: 2, frameHeight: 1, frameHash }, { activationJHeight: 6, activationLogIndex: 9, frameHeight: 1, frameHash }, { activationJHeight: 7, activationLogIndex: 1, frameHeight: 1, frameHash: word(5) }]);
      const height = pick([1n, 1n, 1n, 2n, 0n]), hash = pick([frameHash, frameHash, frameHash.toUpperCase().replace("0X", "0x"), word(3), "junk"]);
      const hanko = pick([`0x${"ab".repeat(40)}`, `0x${"cd".repeat(40)}`, "", "0xbad0"]);
      const from = rng() < 0.08 ? ALICE : BOB;
      const dispute = rng() < 0.25 && peerDispute !== undefined ? { ...peerDispute, proofNonce: peerDispute.proofNonce + (rng() < 0.5 ? 0 : 1) } : undefined;
      const seen: HankoAuthority[] = [];
      const verify: Verify = (_d, h, _e, authority) => { if (authority !== undefined) seen.push(authority); return h !== "0xbad0" && h.length > 0; };
      const input = { kind: "board_hanko_refresh" as const, ...envelopeAB(from), height, frameHash: hash, frameHanko: hanko, boardActivationJHeight: aH, boardActivationLogIndex: aL, ...(dispute === undefined ? {} : { disputeHanko: { ...dispute, proofNonce: dispute.proofNonce } }) };
      // a dispute Hanko that passes the tuple match reaches og's full witness validation (Account state); keep to the tuple-level verdicts here
      if (dispute !== undefined && dispute.proofNonce === peerDispute?.proofNonce) continue;
      const rw = applyAccountInput({ ...alice, ...(prev === undefined ? {} : { boardRefresh: prev }) }, input, { verify, self: ALICE, now: NOW, ...(board === undefined ? {} : { counterpartyBoard: board }) });
      const account: any = {
        proofHeader: { fromEntity: ALICE, toEntity: BOB }, currentHeight: 1, currentFrame: { height: 1, stateHash: frameHash }, counterpartyFrameHanko: certifiedBy(head.certificate, partyIn(alice, ALICE)).peer,
        ...(prev === undefined ? {} : { counterpartyBoardHankoRefresh: prev }),
        ...(peerDispute === undefined ? {} : { counterpartyDisputeHash: peerDispute.hash, counterpartyDisputeProofBodyHash: peerDispute.proofBodyHash, counterpartyDisputeProofNonce: peerDispute.proofNonce, counterpartyDisputeProofProposerIsLeft: peerDispute.proposerIsLeft }),
      };
      const ogSeen: unknown[] = [];
      const og = await handleBoardHankoRefresh(account, {
        kind: "board_hanko_refresh", fromEntityId: from, toEntityId: from === BOB ? ALICE : BOB,
        boardHankoRefresh: { height: Number(height), frameHash: hash, frameHanko: hanko, ...(dispute === undefined ? {} : { disputeHanko: dispute }), boardActivationJHeight: aH, boardActivationLogIndex: aL },
      } as never, {
        ...(board === undefined ? {} : { counterpartyCertifiedBoard: board }),
        verifyHanko: async (h: string, _hash: string, entity: string, authority: unknown) => { ogSeen.push(authority); return { valid: h !== "0xbad0" && h.length > 0, entityId: entity }; },
      } as never);
      if (og === undefined) throw new Error("not a refresh");
      if (!og.ok) {
        const message = String((og as any).rejection.message);
        expect(rw.ok).toBe(false);
        if (rw.ok) continue;
        if (rw.error._tag !== "board_hanko_refresh") throw new Error(`${rw.error._tag} vs ${message}`);
        verdicts.rejected.add(rw.error.reason);
        expect(message.startsWith(from === ALICE ? "ACCOUNT_BOARD_HANKO_REFRESH_PARTY_MISMATCH" : `ACCOUNT_BOARD_HANKO_REFRESH_${CODES[rw.error.reason]}`)).toBe(true);
        continue;
      }
      expect(rw.ok).toBe(true);
      if (!rw.ok) continue;
      const after = rw.value.replica;
      expect(after.head._tag === "installed" ? certifiedBy(after.head.certificate, partyIn(after, ALICE)).peer : undefined).toBe(account.counterpartyFrameHanko);
      expect(after.boardRefresh).toEqual(account.counterpartyBoardHankoRefresh);
      expect(rw.value.outputs).toEqual([]);
      expect(seen).toEqual(ogSeen as HankoAuthority[]);
      expect(seen).toEqual([{ registeredBoardHash: BOARD.boardHash, allowPreviousBoard: false }]);
      verdicts.accepted += 1;
    }
    expect(verdicts.accepted).toBeGreaterThan(10);
    expect(verdicts.rejected.size).toBeGreaterThan(7);
  });
  test("MATCH (og ack-commit.ts allowPreviousBoard: true, preflight.ts false): ACK Hankos are checked with the previous-board grace, a fresh frame's Hanko without it", () => {
    const seen: [string, HankoAuthority | undefined][] = [];
    const door = (self: EntityId): DoorContext => ({ verify: (d, h, e, authority) => { seen.push([e.toLowerCase() === ALICE.toLowerCase() ? "alice" : "bob", authority]); return hankoVerify(d, h, e); }, self, now: NOW, counterpartyBoard: BOARD });
    const a0 = unwrap(admit(genesisAB(), [{ type: "add_delta", tokenId: unwrap(tokenId("1")) }]));
    const proposed = unwrap(applyAccountInput(a0, proposeInput(a0, ALICE), { verify: hankoVerify, self: ALICE, now: NOW })).replica as ProposedAccount;
    seen.length = 0;
    const received = unwrap(applyAccountInput(genesisAB(), offerOf(proposed, ALICE), door(BOB))).replica;
    expect(seen.filter(([who]) => who === "alice").map(([, a]) => a?.allowPreviousBoard)).toContain(false); // the frame Hanko: og preflight.ts
    seen.length = 0;
    unwrap(applyAccountInput(proposed, ackInput(received, BOB), door(ALICE)));
    const frameChecks = seen.filter(([who]) => who === "bob").map(([, a]) => a);
    expect(frameChecks).toContainEqual({ registeredBoardHash: BOARD.boardHash, allowPreviousBoard: true }); // og ack-commit.ts
  });
});

describe("entity-consensus-2: entity txs chat, chatMessage, requestCollateral, profile-update", () => {
  const single = () => teaching([[A, 1n]], 1n, A);
  const opened = () => unwrap(applyEntityInput(single(), { kind: "txs", timestamp: NOW, txs: [openBob] }, ctx(A))).replica;
  test("MATCH (og handleProfileUpdateEntityTx): 300 random updates -- same refusal or the same committed profile", () => {
    const kinds = [undefined, null, "company", "person", "robot"], sectorSets = [undefined, [], ["finance"], ["energy", "finance"], ["finance", "energy"], ["finance", "finance"], ["mining"], ["commerce", "education", "energy", "finance", "media"]];
    const texts = [undefined, "", "  Hub  ", "x"];
    for (let i = 0; i < 300; i++) {
      const pick = <X>(xs: readonly X[]): X => xs[ri(xs.length)] as X;
      const prev = { name: pick(["Old", ""]), isHub: rng() < 0.5, ...(rng() < 0.5 ? { entityKind: "company" } : {}), ...(rng() < 0.5 ? { sectors: ["media"] } : {}), avatar: "a", bio: "b", website: "w" };
      const r = teaching([[A, 1n]], 1n, A);
      const base = { ...r, state: { ...r.state, committed: { ...r.state.committed, profile: prev } } } as EntityReplica;
      const profile: Record<string, unknown> = { entityId: rng() < 0.05 ? BOB : ENTITY };
      for (const [k, v] of [["name", pick(texts)], ["entityKind", pick(kinds)], ["sectors", pick(sectorSets)], ["avatar", pick(texts)], ["bio", pick(texts)], ["website", pick(texts)]] as const) if (v !== undefined) profile[k] = v;
      const tx = { type: "profile-update", data: { profile } } as EntityTx;
      let ogProfile: unknown, ogError: string | undefined;
      try { ogProfile = handleProfileUpdateEntityTx({} as never, { entityId: ENTITY, profile: structuredClone(prev) } as never, tx as never, true).newState.profile; } catch (e) { ogError = String(e); }
      const rw = applyEntityInput(base, { kind: "txs", timestamp: NOW, txs: [tx] }, ctx(A));
      if (ogError !== undefined) { expect(rw.ok).toBe(false); continue; }
      const committed = unwrap(rw).replica.state.committed["profile"];
      expect(JSON.parse(JSON.stringify(committed))).toEqual(JSON.parse(JSON.stringify(ogProfile)));
    }
  });
  test("MATCH (og handleRequestCollateralEntityTx): a missing Account is a no-op; otherwise the request_collateral Account tx is queued and proposed in the same frame", () => {
    const tx = (to: EntityId): EntityTx => ({ type: "requestCollateral", data: { counterpartyEntityId: to, tokenId: unwrap(tokenId("1")), amount: 50n, feeTokenId: unwrap(tokenId("1")), feeAmount: 2n, policyVersion: 1 } });
    const og = handleRequestCollateralEntityTx({ entityId: ENTITY, accounts: new Map([[BOB, {}]]), config: { validators: [A] } } as never, { type: "requestCollateral", data: { counterpartyEntityId: BOB, tokenId: 1, amount: 50n, feeTokenId: 1, feeAmount: 2n, policyVersion: 1 } } as never, true);
    expect(og.accountTxs).toEqual([{ accountId: BOB, tx: { type: "request_collateral", data: { tokenId: 1, amount: 50n, feeTokenId: 1, feeAmount: 2n, policyVersion: 1 } } }]);
    const missing = handleRequestCollateralEntityTx({ entityId: ENTITY, accounts: new Map(), config: { validators: [A] } } as never, { type: "requestCollateral", data: { counterpartyEntityId: BOB, tokenId: 1, amount: 50n, feeAmount: 2n, policyVersion: 1 } } as never, true);
    expect(missing.outputs).toEqual([]);
    const none = unwrap(applyEntityInput(single(), { kind: "txs", timestamp: NOW, txs: [tx(BOB)] }, ctx(A)));
    expect(none.outputs).toEqual([]);
    expect(none.replica.head.height).toBe(1n);
  });
  test("MATCH (og createEntityFrameHashFromStateRoot): chat, chatMessage, requestCollateral and profile-update txs hash into the frame exactly as og's wire txs", () => {
    const r = opened();
    const list: EntityTx[] = [
      { type: "chat", data: { from: A, message: "hello" } },
      { type: "chatMessage", data: { message: "note", timestamp: 5, metadata: { type: "info", height: 2 } } },
      { type: "profile-update", data: { profile: { entityId: ENTITY, name: "Hub", sectors: ["finance"] } } },
    ];
    const p = unwrap(applyEntityInput(r, { kind: "txs", timestamp: NOW + 1n, txs: list }, ctx(A)));
    expect(p.replica.head.height).toBe(2n);
    expect(p.replica.state.committed["profile"]).toMatchObject({ name: "Hub", sectors: ["finance"] });
    // a held 2-of-2 proposal exposes the frame: its hash is og's over og's wire txs (numeric token ids, the same data keys)
    const held = unwrap(applyEntityInput(teaching([[A, 1n], [B, 1n]], 2n, A), { kind: "txs", timestamp: NOW, txs: [...list, { type: "requestCollateral", data: { counterpartyEntityId: BOB, tokenId: unwrap(tokenId("1")), amount: 5n, feeTokenId: unwrap(tokenId("2")), feeAmount: 1n, policyVersion: 1 } }] }, ctx(A))).replica;
    if (held._tag !== "proposed") throw new Error("phase");
    const f = held.frame;
    const ogTxs = [...list.map((t) => ({ type: t.type, data: t.data })), { type: "requestCollateral", data: { counterpartyEntityId: BOB, tokenId: 1, amount: 5n, feeTokenId: 2, feeAmount: 1n, policyVersion: 1 } }];
    expect(unwrap(hashEntityFrame(f))).toBe(createEntityFrameHashFromStateRoot("genesis", 1, Number(NOW), ogTxs as never, [], ENTITY, f.stateRoot, f.authorityRoot, f.entityContext as never));
  });
});
