import { describe, expect, test } from "bun:test";
import {
  applyBoardRegistryEvent, boardProof, emptyBoardRegistry, EMPTY_CERTIFIED_BOARD_ROOT, hashBoardNode, lookupBoardRecord, reachableBoardNodes, verifyBoardProof, advanceBoardFinality, boardStackKey,
  type BoardNodes, type CertifiedBoardNode, type CertifiedBoardRegistryState, type JEvent,
} from "../xln.ts";
import {
  advanceCertifiedBoardFinality, applyCertifiedBoardRegistryEvent, collectReachableCertifiedBoardNodes, createCertifiedBoardProof, getCertifiedBoardStackKey, lookupCertifiedBoardRecord, verifyCertifiedBoardProof,
} from "../../core/jurisdiction/machine/board-registry/index.ts";

let seed = 11;
const rng = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (n: number): number => Math.floor(rng() * n);
const pick = <T>(xs: readonly T[]): T => xs[ri(xs.length)] as T;
const word = (n: bigint | number): string => `0x${BigInt(n).toString(16).padStart(64, "0")}`;
const rword = (): string => `0x${Array.from({ length: 64 }, () => "0123456789abcdef"[ri(16)]).join("")}`;
const msg = (f: () => unknown): { ok: true; value: any } | { ok: false; code: string } => { try { return { ok: true, value: f() }; } catch (e) { return { ok: false, code: (e as Error).message }; } };
const JUR = { name: "j", chainId: 31337, depositoryAddress: "0x5fbdb2315678afecb367f032d93f642f64180aa3", entityProviderAddress: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512" };

type OgEvent = { type: string; blockNumber: number; blockHash: string; transactionHash: string; logIndex: number; data: Record<string, string> };
const toRewrite = (e: OgEvent): JEvent => {
  const meta = { blockNumber: e.blockNumber, blockHash: e.blockHash, transactionHash: e.transactionHash, logIndex: e.logIndex };
  if (e.type === "FoundationBootstrapped") return { type: e.type, recipient: e.data["recipient"] ?? "", boardHash: e.data["boardHash"] ?? "", controlTokenId: 1n, dividendTokenId: 2n, meta };
  if (e.type === "EntityRegistered") return { type: e.type, entityId: e.data["entityId"] ?? "", entityNumber: BigInt(e.data["entityNumber"] ?? "0"), boardHash: e.data["boardHash"] ?? "", meta };
  if (e.type === "BoardActivated") return { type: e.type, entityId: e.data["entityId"] ?? "", previousBoardHash: e.data["previousBoardHash"] ?? "", newBoardHash: e.data["newBoardHash"] ?? "", previousBoardValidUntil: BigInt(e.data["previousBoardValidUntil"] ?? "0"), meta };
  return { type: "ReserveUpdated", entity: word(2), tokenId: 1n, newBalance: 5n, meta };
};

describe("certified-board registry (og jurisdiction/machine/board-registry)", () => {
  test("MATCH: stack key validation equals og getCertifiedBoardStackKey", () => {
    const cases = [JUR, { ...JUR, chainId: 0 }, { ...JUR, depositoryAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3" }, { ...JUR, depositoryAddress: "0x5fbdb2315678afecb367f032d93f642f64180aa" },
      { ...JUR, entityProviderAddress: "E7f1725E7734CE288F8367e1Bb143E90bb3F0512" }, { ...JUR, entityProviderAddress: "0xE7f1725E7734ce288F8367e1Bb143E90bb3F0512" }, { ...JUR, chainId: 1.5 }];
    for (const j of cases) {
      const og = msg(() => getCertifiedBoardStackKey(j)), mine = boardStackKey(j);
      expect(mine.ok ? { ok: true, value: mine.value } : { ok: false, code: mine.error.code }).toEqual(og);
    }
  });

  test("MATCH: 150 random event sequences give og's registry state, nodes, errors, lookups and proofs", () => {
    for (let run = 0; run < 150; run += 1) {
      const ids = [2n, 3n, 4n, 5n, 1000n].map(word), boards = new Map<string, string>();
      let ogState: any, ogNodes = new Map<string, any>(), state: CertifiedBoardRegistryState | undefined, nodes: BoardNodes = new Map();
      let height = 5 + ri(3);
      const deployment = rng() < 0.5 ? height : undefined, jur = { ...JUR, ...(deployment === undefined ? {} : { entityProviderDeploymentBlock: deployment }) };
      const events: OgEvent[] = [];
      for (let i = 0; i < 14; i += 1) {
        const r = rng(), log = ri(3), blockNumber = rng() < 0.08 ? 0 : height, bh = rng() < 0.03 ? "0x12" : rword();
        const base = { blockNumber, blockHash: bh, transactionHash: rword(), logIndex: rng() < 0.03 ? -1 : log };
        if (i === 0 || r < 0.08) events.push({ ...base, type: "FoundationBootstrapped", data: { recipient: "0x" + "11".repeat(20), boardHash: rword(), controlTokenId: "1", dividendTokenId: "2" } });
        else if (r < 0.45) {
          const id = pick(ids), board = rng() < 0.05 ? "0xzz" : rword();
          events.push({ ...base, type: "EntityRegistered", data: { entityId: id, entityNumber: rng() < 0.06 ? "7" : BigInt(id).toString(), boardHash: board } });
        } else if (r < 0.92) {
          const id = pick(ids), prev = boards.get(id) ?? rword(), next = rword();
          events.push({ ...base, type: "BoardActivated", data: { entityId: id, previousBoardHash: rng() < 0.1 ? rword() : prev, newBoardHash: next, previousBoardValidUntil: String(rng() < 0.06 ? 0 : 1_700_000_000 + ri(1000)) } });
        } else events.push({ ...base, type: "ReserveUpdated", data: {} });
        if (rng() < 0.2) events.push({ ...(events[events.length - 1] as OgEvent) });
        if (rng() < 0.7) height += 1 + ri(2);
        else if (rng() < 0.1) height = Math.max(1, height - 2);
        for (const e of events.splice(0)) {
          const og = msg(() => applyCertifiedBoardRegistryEvent(ogState, ogNodes, jur as any, e as any));
          const mine = applyBoardRegistryEvent(state, nodes, jur, toRewrite(e));
          expect(mine.ok ? "ok" : mine.error.code).toBe(og.ok ? "ok" : og.code);
          if (!og.ok || !mine.ok) continue;
          expect(mine.value.state).toEqual(og.value.state);
          expect(new Set(mine.value.newNodes.keys())).toEqual(new Set(og.value.newNodes.keys()));
          ogState = og.value.state; state = mine.value.state;
          for (const [h, n] of og.value.newNodes) ogNodes.set(h, n);
          nodes = new Map([...nodes, ...mine.value.newNodes]);
          for (const [h, n] of mine.value.newNodes) expect(hashBoardNode(n)).toEqual({ ok: true, value: h });
          if (e.type === "BoardActivated" && e.data["entityId"] !== undefined) boards.set(e.data["entityId"], e.data["newBoardHash"] ?? "");
          if (e.type === "EntityRegistered" && e.data["entityId"] !== undefined) boards.set(e.data["entityId"], e.data["boardHash"] ?? "");
        }
      }
      if (state === undefined) continue;
      for (const id of [...ids, word(1), word(99)]) {
        const og = lookupCertifiedBoardRecord(ogNodes, ogState.boardRegistryRoot, ogState.stackKey, id), mine = lookupBoardRecord(nodes, state.boardRegistryRoot, state.stackKey, id);
        expect(mine).toEqual({ ok: true, value: og });
        const ogProof = createCertifiedBoardProof(ogNodes, ogState, id), proof = boardProof(nodes, state, id);
        expect(proof).toEqual({ ok: true, value: ogProof as any });
        expect(verifyBoardProof(state.boardRegistryRoot, ogProof as any)).toEqual({ ok: true, value: verifyCertifiedBoardProof(ogState.boardRegistryRoot, ogProof) });
      }
      const reach = reachableBoardNodes(nodes, [state.boardRegistryRoot]);
      expect(reach.ok && new Set(reach.value.keys())).toEqual(new Set(collectReachableCertifiedBoardNodes(ogNodes, [ogState.boardRegistryRoot]).keys()));
    }
  });

  test("MATCH: tampered proofs, finality advance and empty registries refuse like og", () => {
    const empty = emptyBoardRegistry(JUR);
    expect(empty.ok && empty.value.boardRegistryRoot).toBe(EMPTY_CERTIFIED_BOARD_ROOT);
    let ogState: any, state: CertifiedBoardRegistryState | undefined, nodes: BoardNodes = new Map();
    const ogNodes = new Map<string, any>();
    const seq: OgEvent[] = [
      { type: "FoundationBootstrapped", blockNumber: 3, blockHash: word(31), transactionHash: word(32), logIndex: 0, data: { recipient: "0x" + "11".repeat(20), boardHash: word(900), controlTokenId: "1", dividendTokenId: "2" } },
      ...[2n, 3n, 4n].map((n, i): OgEvent => ({ type: "EntityRegistered", blockNumber: 4, blockHash: word(41), transactionHash: word(42 + i), logIndex: i, data: { entityId: word(n), entityNumber: n.toString(), boardHash: word(800n + n) } })),
    ];
    for (const e of seq) {
      const og = applyCertifiedBoardRegistryEvent(ogState, ogNodes, JUR as any, e as any); ogState = og.state; for (const [h, n] of og.newNodes) ogNodes.set(h, n);
      const mine = applyBoardRegistryEvent(state, nodes, JUR, toRewrite(e)); if (!mine.ok) throw new Error(mine.error.code); state = mine.value.state; nodes = new Map([...nodes, ...mine.value.newNodes]);
    }
    if (state === undefined) throw new Error("state");
    const proof = createCertifiedBoardProof(ogNodes, ogState, word(3));
    const tampered = [
      { ...proof, version: 2 }, { ...proof, nodes: [] }, { ...proof, nodes: [...proof.nodes, proof.nodes[0]] }, { ...proof, nodes: proof.nodes.slice(1) }, { ...proof, entityId: "0x12" },
      { ...proof, nodes: proof.nodes.map((n: any) => (n.type === "branch" ? { ...n, bit: 300 } : n)) }, { ...proof, nodes: proof.nodes.map((n: any) => (n.type === "leaf" ? { ...n, record: { ...n.record, boardEpoch: 9 } } : n)) },
    ];
    for (const p of tampered) {
      const og = msg(() => verifyCertifiedBoardProof(ogState.boardRegistryRoot, p as any)), mine = verifyBoardProof(state.boardRegistryRoot, p as any);
      expect(mine.ok ? { ok: true, value: mine.value } : { ok: false, code: mine.error.code }).toEqual(og);
    }
    for (const [h, bh, root] of [[7, word(1), word(2)], [2, word(1), word(2)], [7, "0x1", word(2)], [8, word(3), "bad"]] as const) {
      const og = msg(() => advanceCertifiedBoardFinality(ogState, JUR as any, h, bh, root)), mine = advanceBoardFinality(state, JUR, h, bh, root);
      expect(mine.ok ? { ok: true, value: mine.value } : { ok: false, code: mine.error.code }).toEqual(og);
      if (og.ok && mine.ok) { ogState = og.value; state = mine.value; }
    }
    const corrupt: Map<string, CertifiedBoardNode> = new Map([...nodes].map(([h, n]) => [h, n.type === "leaf" ? { ...n, record: { ...n.record, logIndex: n.record.logIndex + 1 } } : n]));
    const ogCorrupt = new Map([...ogNodes].map(([h, n]) => [h, n.type === "leaf" ? { ...n, record: { ...n.record, logIndex: n.record.logIndex + 1 } } : n]));
    const og = msg(() => lookupCertifiedBoardRecord(ogCorrupt, ogState.boardRegistryRoot, ogState.stackKey, word(2))), mine = lookupBoardRecord(corrupt, state.boardRegistryRoot, state.stackKey, word(2));
    expect(mine.ok ? { ok: true, value: mine.value } : { ok: false, code: mine.error.code }).toEqual(og);
  });
});
