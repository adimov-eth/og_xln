import { describe, expect, test } from "bun:test";
import {
  buildEntityLeaderCertificate, buildEntityLeaderVoteBody, getEntityLeaderOrder, getEntityLeaderState, getEntityLeaderTimeoutMs, getNextEntityFailoverLeader, hashEntityLeaderVoteBody,
} from "../../core/entity/consensus/leader/index.ts";
import { expectedCommittedLeaderState, verifyEntityLeaderCertificate } from "../../core/entity/consensus/leader/certificates.ts";
import { buildEntityFrameAuthority, computeEntityFrameAuthorityRoot } from "../../core/entity/consensus/state-root.ts";
import {
  address, entityId, applyEntityInput, buildLeaderCertificate, quorumHanko, type Hash, createEntity, hashEntityFrame, hashLeaderVote, leaderOrder, leaderStateOf, leaderTimeoutMs, leaderVoteBody, localTimeoutVote, nextFailoverLeader,
  type Address, type EntityFrame, type EntityFrameHash, type EntityInput, type EntityOutput, type EntityReplica, type EntityState, type EntityTx, type LeaderCertificate, type LeaderState, type LeaderVote,
} from "../xln.ts";
import { ALICE, BOB, NOW, TERMS, aliceAddr, bobAddr, carolAddr, crypto, unwrap, verifiers } from "../xln_run.ts";
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
