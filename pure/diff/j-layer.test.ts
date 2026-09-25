import { describe, expect, test } from "bun:test";
import { Interface } from "ethers";
import { Depository__factory } from "../../jurisdictions/typechain-types/factories/Depository.sol/Depository__factory.ts";
import { EntityProvider__factory } from "../../jurisdictions/typechain-types/factories/EntityProvider__factory.ts";
import { DEPOSITORY_J_EVENTS, ENTITY_PROVIDER_J_EVENTS } from "../../core/jurisdiction/machine/event-catalog.ts";
import { extractCanonicalDepositoryEventArgs } from "../../core/jurisdiction/adapter/events/depository-event-codec.ts";
import { rawEventToJEvents } from "../../core/jurisdiction/adapter/events/j-event-payloads.ts";
import { decodeDisputeFinalizationEvidenceCalldata, decodeDisputeProofBodyEvidenceCalldata, resolveDisputeFinalizationEvidence, resolveDisputeProofBodyEvidence } from "../../core/jurisdiction/adapter/rpc-public.ts";
import { createEmptyBatch, decodeJBatch, encodeJBatch } from "../../core/jurisdiction/machine/batch/index.ts";
import { encodeInt512, encodeUint512 } from "../../core/protocol/crypto/abi-money.ts";
import { hashProofBodyStruct } from "../../core/protocol/dispute/proof-builder.ts";
import {
  J_EVENT_SIGNATURES, jEventTopic, readJEvents, decodeBatch, disputeProofEvidence, finalizationEvidence, withDisputeCalldata, encodeBatch, emptyBatch, proofBodyHash, PROCESS_BATCH_SELECTOR, WATCHTOWER_COUNTER_DISPUTE_SELECTOR,
  type Batch, type ProofBody, type JEvent,
} from "../xln.ts";

const prng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rng = prng(0x5eed_1a);
const ri = (n: number) => Math.floor(rng() * n);
const pick = <X,>(xs: readonly X[]): X => xs[ri(xs.length)] as X;
const W = (b: string) => `0x${b.repeat(32 / (b.length / 2))}`;
const U256 = (1n << 256n) - 1n, SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const b32 = () => W(pick(["11", "22", "aB", "00", "fe"]));
const addr = () => pick([`0x${"ab".repeat(20)}`, "0x5FbDB2315678afecb367f032d93F642f64180aa3", `0x${"01".repeat(20)}`]);
const DEPOSITORY = new Interface(Depository__factory.abi as any);
const PROVIDER = new Interface(EntityProvider__factory.abi as any);
const COORDS = { blockNumber: 7, blockHash: W("0b"), transactionHash: W("0c"), logIndex: 3 };

/** og ingress for one raw log: carrier parse, canonical args, then rawEventToJEvents (normalizers); null when og refuses. */
const ogIngress = (iface: Interface, log: { topics: readonly string[]; data: string }, entityId: string, extraArgs: Record<string, unknown> = {}): any[] | null => {
  try {
    const parsed = iface.parseLog({ topics: [...log.topics], data: log.data })!;
    return rawEventToJEvents({ name: parsed.name, args: { ...extractCanonicalDepositoryEventArgs(parsed), ...extraArgs }, ...COORDS } as any, entityId);
  } catch { return null; }
};
const rwIngress = (log: { topics: readonly string[]; data: string }): readonly JEvent[] | null => { try { return readJEvents([{ topics: log.topics, data: log.data, ...COORDS }]); } catch { return null; } };
/** The rewrite's decoded fields in og's normalized JurisdictionEvent data form. */
const S = (n: bigint) => n.toString(), N = (n: bigint) => Number(n);
const asOg = (e: JEvent): { type: string; data: Record<string, unknown> } => {
  switch (e.type) {
    case "HankoBatchProcessed": return { type: e.type, data: { entityId: e.entityId, batchHash: e.batchHash, nonce: N(e.nonce) } };
    case "ReserveUpdated": return { type: e.type, data: { entity: e.entity, tokenId: N(e.tokenId), newBalance: S(e.newBalance) } };
    case "SecretRevealed": return { type: e.type, data: { hashlock: e.hashlock, revealer: e.revealer, secret: e.secret } };
    case "CounterDisputeRegistered": return { type: e.type, data: { sender: e.sender, counterentity: e.counterentity, nonce: N(e.nonce), proposerIsLeft: e.proposerIsLeft, proofbodyHash: e.proofbodyHash } };
    case "HashLadderRevealRegistered": return { type: e.type, data: { entity: e.entity, counterpartyEntity: e.counterpartyEntity, ladderHash: e.ladderHash, fillRatio: e.fillRatio, fullSecret: e.fullSecret, reveals: [...e.reveals], targetRole: e.targetRole, revealedAt: N(e.revealedAt) } };
    case "DebtCreated": return { type: e.type, data: { debtor: e.debtor, creditor: e.creditor, tokenId: N(e.tokenId), amount: S(e.amount), debtIndex: N(e.debtIndex) } };
    case "DebtEnforced": return { type: e.type, data: { debtor: e.debtor, creditor: e.creditor, tokenId: N(e.tokenId), amountPaid: S(e.amountPaid), remainingAmount: S(e.remainingAmount), newDebtIndex: N(e.newDebtIndex) } };
    case "DebtForgiven": return { type: e.type, data: { debtor: e.debtor, creditor: e.creditor, tokenId: N(e.tokenId), amountForgiven: S(e.amountForgiven), debtIndex: N(e.debtIndex) } };
    case "FoundationBootstrapped": return { type: e.type, data: { recipient: e.recipient, boardHash: e.boardHash, controlTokenId: S(e.controlTokenId), dividendTokenId: S(e.dividendTokenId) } };
    case "EntityRegistered": return { type: e.type, data: { entityId: e.entityId, entityNumber: S(e.entityNumber), boardHash: e.boardHash } };
    case "BoardActivated": return { type: e.type, data: { entityId: e.entityId, previousBoardHash: e.previousBoardHash, newBoardHash: e.newBoardHash, previousBoardValidUntil: S(e.previousBoardValidUntil) } };
    case "EntityProviderActionExecuted": return { type: e.type, data: { entityId: e.entityId, actionNonce: S(e.actionNonce), actionHash: e.actionHash, actionKind: e.actionKind } };
    case "EntityProviderActionCancelled": return { type: e.type, data: { entityId: e.entityId, actionNonce: S(e.actionNonce), cancelledActionHash: e.cancelledActionHash, cancelHash: e.cancelHash, cancelledActionKind: e.cancelledActionKind } };
    default: throw new Error(`asOg: ${e.type}`);
  }
};
const stripMeta = (e: any) => { const { blockNumber: _a, blockHash: _b, transactionHash: _c, logIndex: _d, eventIndex: _e, ...rest } = e; return rest; };

describe("J event ingress (og core/jurisdiction/adapter/events/*, machine/event-normalizers.ts)", () => {
  test("MATCH: every consensus Depository and EntityProvider event has the contract's signature and topic0 (event-catalog.ts)", () => {
    const expected = [...DEPOSITORY_J_EVENTS.consensus.map((n) => [n, DEPOSITORY] as const), ...ENTITY_PROVIDER_J_EVENTS.consensus.map((n) => [n, PROVIDER] as const)];
    expect(Object.keys(J_EVENT_SIGNATURES).sort()).toEqual(expected.map(([n]) => n).sort());
    for (const [n, iface] of expected) {
      const e = iface.getEvent(n)!;
      expect(J_EVENT_SIGNATURES[n as keyof typeof J_EVENT_SIGNATURES]).toBe(e.format("sighash"));
      expect(jEventTopic(n as keyof typeof J_EVENT_SIGNATURES)).toBe(e.topicHash);
    }
  });

  test("MATCH: random logs of the eleven non-dispute consensus events decode to og's normalized data, and og-invalid payloads are refused by both (100 rounds)", () => {
    const uintish = () => pick([0n, 1n, 2n, 7n, SAFE, SAFE + 1n, U256, BigInt(ri(1e9))]);
    const small = () => pick([0n, 1n, 5n, BigInt(ri(1e6)), SAFE, SAFE + 1n]);
    const u512 = () => pick([0n, 1n, U256, U256 + 1n, (1n << 511n) + 5n, BigInt(ri(1e9))]);
    let agreeOk = 0, agreeRefuse = 0;
    for (let i = 0; i < 100; i++) {
      const logs: [Interface, { topics: readonly string[]; data: string }][] = [
        [DEPOSITORY, DEPOSITORY.encodeEventLog("HankoBatchProcessed", [b32(), b32(), small()])],
        [DEPOSITORY, DEPOSITORY.encodeEventLog("ReserveUpdated", [b32(), small(), uintish()])],
        [DEPOSITORY, DEPOSITORY.encodeEventLog("SecretRevealed", [b32(), b32(), b32()])],
        [DEPOSITORY, DEPOSITORY.encodeEventLog("CounterDisputeRegistered", [b32(), b32(), small(), rng() < 0.5, b32()])],
        [DEPOSITORY, DEPOSITORY.encodeEventLog("HashLadderRevealRegistered", [b32(), b32(), b32(), pick([0, 1, 65535, ri(65536)]), b32(), [b32(), b32(), b32(), b32()], rng() < 0.5, small()])],
        [DEPOSITORY, DEPOSITORY.encodeEventLog("DebtCreated", [b32(), b32(), small(), encodeUint512(u512()), small()])],
        [DEPOSITORY, DEPOSITORY.encodeEventLog("DebtEnforced", [b32(), b32(), small(), uintish(), encodeUint512(u512()), small()])],
        [DEPOSITORY, DEPOSITORY.encodeEventLog("DebtForgiven", [b32(), b32(), small(), encodeUint512(u512()), small()])],
        [PROVIDER, PROVIDER.encodeEventLog("FoundationBootstrapped", [addr(), b32(), uintish(), uintish()])],
        [PROVIDER, PROVIDER.encodeEventLog("EntityRegistered", [b32(), uintish(), b32()])],
        [PROVIDER, PROVIDER.encodeEventLog("BoardActivated", [b32(), b32(), b32(), pick([0n, 1n, uintish()])])],
        [PROVIDER, PROVIDER.encodeEventLog("EntityProviderActionExecuted", [b32(), pick([0n, 1n, uintish()]), b32(), pick([0, 1])])],
        [PROVIDER, PROVIDER.encodeEventLog("EntityProviderActionCancelled", [b32(), pick([0n, 1n, uintish()]), b32(), pick([0, 1]), b32()])],
      ];
      for (const [iface, log] of logs) {
        // og requires the calldata ProofBody on a counter-dispute; its log fields are compared here, the body in the calldata suite.
        const counter = iface.parseLog(log)?.name === "CounterDisputeRegistered", body = ogProof(proofBody());
        const og = ogIngress(iface, log, W("11"), counter ? { counterProofbody: body } : {}), rw = rwIngress(log);
        if (og !== null && counter) delete og[0].data.counterProofbody;
        expect({ event: iface.parseLog(log)?.name, refused: rw === null }).toEqual({ event: iface.parseLog(log)?.name, refused: og === null });
        if (og === null || rw === null) { agreeRefuse++; continue; }
        expect(og.length).toBe(1);
        expect(rw.length).toBe(1);
        expect(asOg(rw[0]!)).toEqual(stripMeta(og[0]));
        expect(rw[0]!.meta).toEqual(COORDS);
        agreeOk++;
      }
    }
    expect(agreeOk).toBeGreaterThan(500);
    expect(agreeRefuse).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------- calldata (og rpc-public.ts)
const proofBody = (): ProofBody => ({
  watchSeed: b32(), leftResponseSeconds: BigInt(ri(100)), rightResponseSeconds: BigInt(ri(100)), offdeltas: Array.from({ length: ri(3) }, () => pick([0n, 5n, -7n, (1n << 300n), -(1n << 400n)])),
  tokenIds: Array.from({ length: ri(3) }, () => BigInt(1 + ri(9))),
  transformers: Array.from({ length: ri(2) }, () => ({ transformerAddress: addr().toLowerCase(), encodedBatch: pick(["0x", "0xab", "0x" + "cd".repeat(40)]), allowances: Array.from({ length: ri(2) }, () => ({ deltaIndex: BigInt(ri(4)), rightAllowance: BigInt(ri(1e6)), leftAllowance: BigInt(ri(1e6)) })) })),
});
/** og ProofBodyStruct (ABI-shaped) from the rewrite's ProofBody. */
const ogProof = (b: ProofBody) => ({ ...b, leftResponseSeconds: Number(b.leftResponseSeconds), rightResponseSeconds: Number(b.rightResponseSeconds), offdeltas: b.offdeltas.map(encodeInt512) });
/** The rewrite's ProofBody from og's decoded struct. */
const rwProof = (b: any): ProofBody => ({ watchSeed: b.watchSeed.toLowerCase(), leftResponseSeconds: BigInt(b.leftResponseSeconds), rightResponseSeconds: BigInt(b.rightResponseSeconds), offdeltas: b.offdeltas.map((o: any) => (BigInt(o.high) << 256n) + BigInt(o.low)), tokenIds: b.tokenIds.map(BigInt),
  transformers: b.transformers.map((t: any) => ({ transformerAddress: t.transformerAddress.toLowerCase(), encodedBatch: t.encodedBatch, allowances: t.allowances.map((a: any) => ({ deltaIndex: BigInt(a.deltaIndex), rightAllowance: BigInt(a.rightAllowance), leftAllowance: BigInt(a.leftAllowance) })) })) });
const lowerProof = (b: ProofBody): ProofBody => ({ ...b, watchSeed: b.watchSeed.toLowerCase(), transformers: b.transformers.map((t) => ({ ...t, transformerAddress: t.transformerAddress.toLowerCase() })) });
const randomBatch = (): Batch => {
  const b = emptyBatch() as any;
  const nonceish = () => pick([1n, 2n, BigInt(ri(1e6)), SAFE, SAFE + 1n]);
  b.reserveToReserve = Array.from({ length: ri(2) }, () => ({ receivingEntity: b32(), tokenId: nonceish(), amount: BigInt(ri(1e9)) }));
  b.disputeStarts = Array.from({ length: ri(3) }, () => { const p = proofBody(); return { counterentity: b32(), nonce: nonceish(), proposerIsLeft: rng() < 0.5, proofbodyHash: rng() < 0.8 ? proofBodyHash(p) : b32(), initialProofbody: p, watchSeed: b32(), sig: "0x" + "12".repeat(ri(3)), starterInitialArguments: "0x", starterCounterArguments: "0xab", starterCounterProofCommitment: b32() }; });
  b.counterDisputes = Array.from({ length: ri(2) }, () => ({ counterentity: b32(), initialNonce: nonceish(), initialProofbodyHash: b32(), counterNonce: nonceish(), proposerIsLeft: rng() < 0.5, counterProofbody: proofBody(), sig: "0x01" }));
  b.disputeFinalizations = Array.from({ length: ri(2) }, () => ({ counterentity: b32(), initialNonce: nonceish(), finalNonce: nonceish(), proposerIsLeft: rng() < 0.5, initialProofbodyHash: b32(), finalProofbody: proofBody(), starterArguments: pick(["0x", "0xaa"]), otherArguments: pick(["0x", "0xbb01"]), sig: pick(["0x", "0x" + "cc".repeat(65)]), startedByLeft: rng() < 0.5, cooperative: rng() < 0.3 }));
  b.settlements = Array.from({ length: ri(2) }, () => ({ leftEntity: b32(), rightEntity: b32(), diffs: [{ tokenId: 1n, leftDiff: -5n, rightDiff: 0n, collateralDiff: 5n, ondeltaDiff: 5n }], forgiveDebtsInTokenIds: [2n], sig: "0x", nonce: nonceish() }));
  return b as Batch;
};
const ogBatchOf = (b: Batch): any => {
  const n = Number;
  return { ...createEmptyBatch(),
    reserveToReserve: b.reserveToReserve.map((r) => ({ ...r, tokenId: n(r.tokenId) })),
    settlements: b.settlements.map((s) => ({ ...s, nonce: n(s.nonce), forgiveDebtsInTokenIds: s.forgiveDebtsInTokenIds.map(n), diffs: s.diffs.map((d) => ({ ...d, tokenId: n(d.tokenId) })) })),
    disputeStarts: b.disputeStarts.map((s) => ({ ...s, nonce: n(s.nonce), initialProofbody: ogProof(s.initialProofbody) })),
    counterDisputes: b.counterDisputes.map((c) => ({ ...c, initialNonce: n(c.initialNonce), counterNonce: n(c.counterNonce), counterProofbody: ogProof(c.counterProofbody) })),
    disputeFinalizations: b.disputeFinalizations.map((f) => ({ ...f, initialNonce: n(f.initialNonce), finalNonce: n(f.finalNonce), finalProofbody: ogProof(f.finalProofbody) })),
  };
};
const processBatchCalldata = (b: Batch) => DEPOSITORY.encodeFunctionData("processBatch", [encodeBatch(b), "0x", 1n]);

describe("dispute calldata evidence (og rpc-public.ts decodeDisputeProofBodyEvidenceCalldata / decodeJBatch)", () => {
  test("MATCH: processBatch and watchtowerCounterDispute selectors equal the Depository ABI's", () => {
    expect(PROCESS_BATCH_SELECTOR).toBe(DEPOSITORY.getFunction("processBatch")!.selector);
    expect(WATCHTOWER_COUNTER_DISPUTE_SELECTOR).toBe(DEPOSITORY.getFunction("watchtowerCounterDispute")!.selector);
  });

  test("MATCH: decodeBatch == og decodeJBatch on random batches, including og's safe-integer refusals (80 rounds)", () => {
    let accepted = 0, refused = 0;
    for (let i = 0; i < 80; i++) {
      const b = randomBatch(), encoded = encodeBatch(b);
      const og = (() => { try { return decodeJBatch(encoded); } catch { return null; } })();
      const rw = (() => { try { return decodeBatch(encoded); } catch { return null; } })();
      expect(rw === null).toBe(og === null);
      if (og === null || rw === null) { refused++; continue; }
      accepted++;
      expect(rw.disputeStarts.map((s) => ({ ...s, initialProofbody: lowerProof(s.initialProofbody) }))).toEqual(og.disputeStarts.map((s: any) => ({ ...s, counterentity: s.counterentity, nonce: BigInt(s.nonce), initialProofbody: rwProof(s.initialProofbody) })));
      expect(rw.counterDisputes.map((c) => c.counterProofbody).map(lowerProof)).toEqual(og.counterDisputes.map((c: any) => rwProof(c.counterProofbody)));
      expect(rw.disputeFinalizations.map((f) => [f.initialNonce, f.finalNonce, f.sig, f.startedByLeft, f.cooperative])).toEqual(og.disputeFinalizations.map((f: any) => [BigInt(f.initialNonce), BigInt(f.finalNonce), f.sig, f.startedByLeft, f.cooperative]));
      expect(rw.settlements.map((s) => s.diffs)).toEqual(og.settlements.map((s: any) => s.diffs.map((d: any) => ({ ...d, tokenId: BigInt(d.tokenId) }))));
      expect(encodeBatch(rw)).toBe(encoded);
    }
    expect(accepted).toBeGreaterThan(5);
    expect(refused).toBeGreaterThan(5);
  });

  test("MATCH: dispute ProofBody evidence and finalization evidence from processBatch / watchtower calldata equal og's, and each dispute log resolves to og's ProofBody (60 rounds)", () => {
    let resolved = 0;
    for (let i = 0; i < 60; i++) {
      const b = randomBatch();
      const ogOk = (() => { try { encodeJBatch(ogBatchOf(b)); decodeJBatch(encodeBatch(b)); return true; } catch { return false; } })();
      if (!ogOk) continue;
      const calldata = processBatchCalldata(b);
      expect(encodeJBatch(ogBatchOf(b))).toBe(encodeBatch(b));
      const og = decodeDisputeProofBodyEvidenceCalldata(calldata), rw = disputeProofEvidence(calldata);
      expect(rw.map((c) => ({ ...c, proofbody: lowerProof(c.proofbody) }))).toEqual(og.map((c: any) => ({ ...c, nonce: BigInt(c.nonce), ...(c.initialNonce === undefined ? {} : { initialNonce: BigInt(c.initialNonce) }), proofbody: rwProof(c.proofbody) })));
      const ogFin = decodeDisputeFinalizationEvidenceCalldata(calldata), rwFin = finalizationEvidence(calldata);
      expect(rwFin).toEqual(ogFin.map((f: any) => ({ ...f, initialNonce: BigInt(f.initialNonce), finalNonce: BigInt(f.finalNonce) })));
      // Each start's DisputeStarted log resolves to the same body (og resolveDisputeProofBodyEvidence), with a proposer flip refused by both.
      for (const s of b.disputeStarts) {
        for (const flip of [false, true]) {
          const args = { counterentity: s.counterentity, nonce: s.nonce, proofbodyHash: s.proofbodyHash, proposerIsLeft: flip ? !s.proposerIsLeft : s.proposerIsLeft };
          const ogBody = (() => { try { return rwProof(resolveDisputeProofBodyEvidence(og, "DisputeStarted", args)); } catch { return null; } })();
          const ev: JEvent = { type: "DisputeStarted", sender: W("99"), counterentity: s.counterentity.toLowerCase(), nonce: s.nonce, proposerIsLeft: args.proposerIsLeft, proofbodyHash: s.proofbodyHash.toLowerCase(), watchSeed: s.watchSeed, starterInitialArguments: "0x", starterCounterArguments: "0x", starterCounterProofCommitment: W("00"), disputeTimeout: 3n, disputeStartTimestamp: 1n, leftResponseSeconds: 1n, rightResponseSeconds: 1n };
          const rwBody = (() => { try { const e = withDisputeCalldata(ev, calldata); return e.type === "DisputeStarted" && e.initialProofbody !== undefined ? lowerProof(e.initialProofbody) : null; } catch { return null; } })();
          expect(rwBody).toEqual(ogBody);
          if (rwBody !== null) resolved++;
        }
      }
      // Finalizations: og resolveDisputeFinalizationEvidence by the logged evidence hash; the rewrite attaches the same evidence and final body.
      for (const f of b.disputeFinalizations) {
        const finalProofbodyHash = hashProofBodyStruct(ogProof(f.finalProofbody) as any);
        const candidate = ogFin.find((c: any) => c.counterentity === f.counterentity.toLowerCase() && BigInt(c.initialNonce) === f.initialNonce)!;
        const evidenceHash = (() => { const { finalizationEvidenceHash } = require("../xln.ts"); return finalizationEvidenceHash(rwFin.find((c) => c.counterentity === candidate.counterentity && c.initialNonce === f.initialNonce)!); })();
        const args = { sender: W("99"), counterentity: f.counterentity, initialNonce: f.initialNonce, finalProofbodyHash, finalizationEvidenceHash: evidenceHash };
        const ogEvidence = resolveDisputeFinalizationEvidence(ogFin, W("0c"), args);
        const ev: JEvent = { type: "DisputeFinalized", sender: W("99"), counterentity: f.counterentity.toLowerCase(), nonce: f.initialNonce, finalProofbodyHash, finalizationEvidenceHash: evidenceHash, meta: { transactionHash: W("0c") } };
        const got = withDisputeCalldata(ev, calldata);
        if (got.type !== "DisputeFinalized") throw new Error("type");
        expect(got.evidence).toEqual({ ...ogEvidence, initialNonce: BigInt(ogEvidence.initialNonce), finalNonce: BigInt(ogEvidence.finalNonce) } as any);
        expect(lowerProof(got.finalProofbody!)).toEqual(rwProof(resolveDisputeProofBodyEvidence(og, "DisputeFinalized", args)));
        expect(got.initialProofbodyHash).toBe(ogEvidence.initialProofbodyHash);
        resolved++;
      }
    }
    expect(resolved).toBeGreaterThan(20);
  });

  test("MATCH: a watchtowerCounterDispute call yields the CounterDisputeRegistered + DisputeFinalized pair like og", () => {
    for (let i = 0; i < 10; i++) {
      const f = { counterentity: b32(), initialNonce: BigInt(1 + ri(9)), finalNonce: BigInt(1 + ri(9)), proposerIsLeft: rng() < 0.5, initialProofbodyHash: b32(), finalProofbody: proofBody(), starterArguments: "0x", otherArguments: "0x01", sig: "0x02", startedByLeft: rng() < 0.5, cooperative: false };
      const calldata = DEPOSITORY.encodeFunctionData("watchtowerCounterDispute", [W("33"), { ...f, finalProofbody: ogProof(f.finalProofbody) }, 5n, 6n, "0x"]);
      const og = decodeDisputeProofBodyEvidenceCalldata(calldata), rw = disputeProofEvidence(calldata);
      expect(rw.map((c) => ({ ...c, proofbody: lowerProof(c.proofbody) }))).toEqual(og.map((c: any) => ({ ...c, nonce: BigInt(c.nonce), initialNonce: BigInt(c.initialNonce), proofbody: rwProof(c.proofbody) })));
      expect(finalizationEvidence(calldata)).toEqual(decodeDisputeFinalizationEvidenceCalldata(calldata).map((x: any) => ({ ...x, initialNonce: BigInt(x.initialNonce), finalNonce: BigInt(x.finalNonce) })));
    }
    // Unknown or unsupported calldata: both refuse.
    for (const bad of ["0xdeadbeef", DEPOSITORY.encodeFunctionData("processBatch", ["0x", "0x", 1n])]) {
      expect(() => decodeDisputeProofBodyEvidenceCalldata(bad)).toThrow();
      expect(() => disputeProofEvidence(bad)).toThrow();
    }
  });
});
