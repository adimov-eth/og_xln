import { describe, expect, test } from "bun:test";
// Runtime transport, scheduling and events, each run against live og (core/runtime, core/entity, core/account).
import { applyRuntimeTx as ogApplyRuntimeTx } from "../../core/runtime/tx/tx-handlers.ts";
import { computeCanonicalEntityConsensusStateHash } from "../../core/entity/consensus/state-root.ts";
import { encodeBoard, hashBoard } from "../../core/entity/factory.ts";
import { createDefaultDelta } from "../../core/account/state/delta.ts";
import { handleJEventClaim } from "../../core/account/tx/handlers/j-events/claim.ts";
import { prepareAccountJClaimTx } from "../../core/account/j-claims/j-claim-transition.ts";
import { createAccountJClaimSession } from "../../core/account/j-claims/j-claim-session.ts";
import { createEmptyAccountJClaimAccumulator } from "../../core/account/j-claims/j-claim-accumulator.ts";
import { applyAccountTxMutation } from "../../core/account/tx/mutation.ts";
import { beginAccountTransition, accountTransitionView, commitAccountTransition, discardAccountTransition } from "../../core/account/state/candidate-overlay.ts";
import { PersistentAccountStateMap } from "../../core/account/state/persistent-state-map.ts";
import {
  accountId, accountRuntimeEvents, accountTerms, applyAccountBody, applyRuntime, applyRuntimeTx, committed, convertOutput, createEntity, createRuntime, lazyBoardEntityId, spawn, entityId as rwEntityId, entityRootOf, genesisAccount, genesisAccountBody, replicaKey,
  type AccountBody, type Address, type EntityId, type EntityTx, type FoldCtx, type RoutedEntityInput, type ImportConfig, type JReplica, type Runtime, type RuntimeTx,
} from "../xln.ts";
import { ALICE, BOB, CAROL, NOW, TERMS, aliceAddr, bobAddr, unwrap, verifiers } from "../xln_run.ts";

let seed = 71;
const rng = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (n: number): number => Math.floor(rng() * n);
const pick = <T>(xs: readonly T[]): T => xs[ri(xs.length)] as T;
const rwCode = (r: { readonly ok: boolean; readonly error?: unknown }): string | null => {
  if (r.ok) return null;
  const e = r.error as { _tag: string; code?: string };
  return String(e.code ?? e._tag).split(":")[0] ?? "";
};
const ogCode = (e: unknown): string => String((e as Error).message).split(":")[0] ?? "";
/** A tree deep copy (Bun's structuredClone mis-decodes repeated references). */
const treeClone = <T>(v: T): T => {
  if (v === null || typeof v !== "object") return v;
  if (v instanceof Uint8Array) return new Uint8Array(v) as T;
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [treeClone(k), treeClone(x)])) as T;
  if (v instanceof Set) return new Set([...v].map(treeClone)) as T;
  if (Array.isArray(v)) return v.map(treeClone) as T;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, treeClone(x)])) as T;
};
type OgEnv = { state: { jReplicas: Map<string, unknown>; eReplicas: Map<string, unknown>; timestamp: number; height: number }; infrastructure: Record<string, unknown>; activeJurisdiction?: string };
const ogEnv = (): OgEnv => ({ state: { jReplicas: new Map(), eReplicas: new Map(), timestamp: 1_700_000_000_000, height: 0 }, infrastructure: {} });
const runOg = async (env: OgEnv, tx: unknown): Promise<string | null> => {
  try { await ogApplyRuntimeTx(env as never, treeClone(tx) as never, { isReplay: true }); return null; } catch (e) { return ogCode(e); }
};

// ---- R2-6b / RG-1: the importReplica genesis replica (og buildGenesisReplica) ----
const SEED = "0x" + "5e".repeat(64);
describe("runtime-final: importReplica genesis (og tx-handlers.ts buildGenesisReplica)", () => {
  test("MATCH (randomized): profile name, swap pairs, crontab and position -- the genesis Entity root equals og computeCanonicalEntityConsensusStateHash", async () => {
    let imported = 0;
    for (let run = 0; run < 24; run++) {
      const env = ogEnv();
      const name = pick(["Local", "Tron", "rpc2", "Base"]), chainId = pick([31337, 31338, 8453]);
      const replica = { name, blockNumber: 0n, stateRoot: null, mempool: [], blockDelayMs: 300, lastBlockTimestamp: 0, position: { x: 0, y: 50, z: 0 }, rpcs: ["http://rpc.example/"], chainId,
        entityProviderDeploymentBlock: pick([1, 9]), contracts: { depository: "0x5fbdb2315678afecb367f032d93f642f64180aa3", entityProvider: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512", account: "0x" + "12".repeat(20), deltaTransformer: "0x" + "34".repeat(20) } };
      env.state.jReplicas.set(name, treeClone(replica));
      let rt: Runtime = { ...createRuntime([treeClone(replica) as unknown as JReplica]), timestamp: 1_700_000_000_000n };
      const config = { mode: "proposer-based", threshold: 1n, validators: [aliceAddr, bobAddr], shares: { [aliceAddr]: 1n, [bobAddr]: 1n }, jurisdiction: { name } } as unknown as ImportConfig;
      const entityId = hashBoard(encodeBoard(config as never)).toLowerCase();
      const profileName = pick<string | undefined>([undefined, "", "  ", " Hub One ", "alice"]);
      const position = pick<unknown>([undefined, { x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3, jurisdiction: "Other" }]);
      const tx = { type: "importReplica", entityId, signerId: aliceAddr, data: { config, isProposer: true, entitySeed: SEED, ...(profileName === undefined ? {} : { profileName }), ...(position === undefined ? {} : { position }) } } as unknown as RuntimeTx;
      const og = await runOg(env, tx);
      const rw = applyRuntimeTx(rt, tx, { replay: true });
      expect(rwCode(rw)).toBe(og);
      if (!rw.ok) continue;
      rt = rw.value;
      imported++;
      const ogReplica = env.state.eReplicas.get(`${entityId}:${aliceAddr.toLowerCase()}`) as { state: unknown; position?: unknown } | undefined;
      const mine = rt.entities.get(replicaKey(entityId as EntityId, aliceAddr));
      if (ogReplica === undefined || mine === undefined) throw new Error("replica missing");
      expect(unwrap(entityRootOf(mine.state, mine.accountReplicas))).toBe(computeCanonicalEntityConsensusStateHash(ogReplica.state as never));
      expect(rt.replicaLocal.get(replicaKey(entityId as EntityId, aliceAddr))?.position ?? null).toEqual((ogReplica.position ?? null) as never);
      // The sibling validator joins the same genesis Entity.
      const bobPosition = pick<unknown>([undefined, { x: 4, y: 5, z: 6 }]);
      const bobTx = { type: "importReplica", entityId, signerId: bobAddr, data: { config, isProposer: false, entitySeed: SEED, ...(bobPosition === undefined ? {} : { position: bobPosition }) } } as unknown as RuntimeTx;
      expect(rwCode(applyRuntimeTx(rt, bobTx, { replay: true }))).toBe(await runOg(env, bobTx));
      rt = unwrap(applyRuntimeTx(rt, bobTx, { replay: true }));
      const ogBob = env.state.eReplicas.get(`${entityId}:${bobAddr.toLowerCase()}`) as { state: unknown; position?: unknown };
      const bob = rt.entities.get(replicaKey(entityId as EntityId, bobAddr));
      if (bob === undefined) throw new Error("replica missing");
      expect(unwrap(entityRootOf(bob.state, bob.accountReplicas))).toBe(computeCanonicalEntityConsensusStateHash(ogBob.state as never));
      expect(rt.replicaLocal.get(replicaKey(entityId as EntityId, bobAddr))?.position ?? null).toEqual((ogBob.position ?? null) as never);
    }
    expect(imported).toBeGreaterThan(20);
  });
});

// ---- Account runtime events (og EntityCandidateEffect runtimeEvent from the Account machine) ----
const word = (byte: string): string => `0x${byte.repeat(32)}`;
const A = word("11"), B = word("22"), DEP = `0x${"ab".repeat(20)}`;
class PMap<K, V> extends Map<K, V> { put(k: K, v: V): this { this.set(k, v); return this; } del(k: K): void { this.delete(k); } }
const openBody = (credit = 10n ** 9n): { body: AccountBody; ctx: FoldCtx } => {
  const terms = unwrap(accountTerms({ domain: { chainId: 1, depositoryAddress: DEP }, watchSeed: word("44"), disputeConfig: { leftResponseSeconds: 1, rightResponseSeconds: 1 } } as never) as never) as never;
  const ctx: FoldCtx = { byLeft: true, nowMs: 1n, jHeight: 0n, accountHeight: 1n };
  let body = genesisAccountBody(genesisAccount(unwrap(accountId(unwrap(rwEntityId(A) as never), unwrap(rwEntityId(B) as never)) as never)), terms);
  for (const tokenId of ["1", "2"] as const) for (const byLeft of [true, false]) body = unwrap(applyAccountBody(body, { type: "set_credit_limit", tokenId, limit: credit } as never, { ...ctx, byLeft }) as never as { ok: true; value: { state: AccountBody } }).state;
  return { body, ctx };
};
const PA = (ns: string, m: ReadonlyMap<unknown, unknown> = new Map()) => PersistentAccountStateMap.fromEntries(ns as never, m as never);
/** og side: a persistent og Account replica seeded from the rewrite's committed view, run through og's transition overlay (as account-tx.test.ts ogHarness). */
const ogAccountHarness = (body: AccountBody) => {
  const v = (unwrap(committed(body) as never) as { view: Record<string, unknown> }).view;
  const state: Record<string, unknown> = { domain: v["domain"], leftEntity: v["leftEntity"], rightEntity: v["rightEntity"], watchSeed: v["watchSeed"], disputeConfig: v["disputeConfig"], jNonce: v["jNonce"], lastFinalizedJHeight: v["lastFinalizedJHeight"],
    leftPendingJClaims: v["leftPendingJClaims"], rightPendingJClaims: v["rightPendingJClaims"],
    ...Object.fromEntries(["deltas", "locks", "pulls", "swapOffers", "subcontracts", "lendingIntents", "requestedRebalance", "requestedRebalanceFeeState", "rebalanceFeePolicies"].map((n) => [n, PA(n, v[n] as ReadonlyMap<unknown, unknown>)])) };
  let replica: unknown = { state, status: "active", currentHeight: 0, proofHeader: { fromEntity: A, toEntity: B, nextProofNonce: 1 }, currentFrame: { stateHash: "" }, pendingWithdrawals: PA("pendingWithdrawals"),
    shadow: { rebalance: { policy: PA("rebalanceShadowPolicy"), submittedAtByToken: PA("rebalanceShadowSubmitted") } }, mempool: [] };
  return async (handler: (draft: never) => Promise<{ ok: boolean }> | { ok: boolean }): Promise<boolean> => {
    const overlay = beginAccountTransition(replica as never);
    let r: { ok: boolean };
    try { r = await handler(accountTransitionView(overlay) as never); } catch { r = { ok: false }; }
    if (!r.ok) { discardAccountTransition(overlay); return false; }
    replica = commitAccountTransition(overlay, "diff" as never).account;
    return true;
  };
};
const eventsOf = (effects: readonly { kind: string; eventName?: string; data?: unknown }[]): unknown[] => effects.filter((e) => e.kind === "runtimeEvent").map((e) => ({ eventName: e.eventName, data: e.data }));

describe("runtime-final: Account runtime events (og account/tx/mutation.ts, j-events/claim.ts)", () => {
  test("MATCH (randomized): request_collateral emits og's request_collateral_committed event from the local side", async () => {
    let emitted = 0;
    for (let run = 0; run < 12; run++) {
      const { body: start } = openBody();
      const og = ogAccountHarness(start);
      let body = start;
      for (let i = 0; i < 8; i++) {
        const byLeft = rng() < 0.5, tokenId = pick(["1", "2"]), amount = BigInt(ri(60)), fee = BigInt(ri(5)), ts = 10 + i;
        const tx = { type: "request_collateral", tokenId, amount, feeAmount: fee, policyVersion: 1, ...(rng() < 0.4 ? { feeTokenId: "2" } : {}) };
        const ogTx = { type: "request_collateral", data: { tokenId: Number(tokenId), amount, feeAmount: fee, policyVersion: 1, ...("feeTokenId" in tx ? { feeTokenId: 2 } : {}) } };
        const effects: { kind: string; eventName?: string; data?: unknown }[] = [];
        const ogOk = await og((acc) => applyAccountTxMutation(acc, ogTx as never, byLeft, ts, 1, false, undefined, undefined, undefined, effects as never) as never);
        const rw = applyAccountBody(body, tx as never, { byLeft, nowMs: BigInt(ts), jHeight: 1n, accountHeight: 1n }) as unknown as { ok: boolean; value: { state: AccountBody; effects: never[] } };
        expect(rw.ok).toBe(ogOk);
        if (!rw.ok) continue;
        body = rw.value.state;
        const mine = rw.value.effects.flatMap((e) => accountRuntimeEvents(A, B, e));
        expect(mine).toEqual(eventsOf(effects) as never);
        emitted += mine.length;
      }
    }
    expect(emitted).toBeGreaterThan(5);
  });

  test("MATCH (randomized): a bilaterally finalized j_event_claim emits og's account_settled_finalized_bilateral event; pending, stale and refused claims emit none", () => {
    const jurisdictions = { jReplicas: new Map([["j", { chainId: 1, contracts: { depository: DEP, entityProvider: `0x${"c1".repeat(20)}`, account: `0x${"c2".repeat(20)}`, deltaTransformer: `0x${"c3".repeat(20)}` } }]]) } as never;
    let finalized = 0;
    for (let run = 0; run < 20; run++) {
      const state: Record<string, unknown> = { leftEntity: A, rightEntity: B, deltas: new PMap<number, unknown>([[1, { ...createDefaultDelta(1), leftCreditLimit: 10n ** 9n, rightCreditLimit: 10n ** 9n }], [2, { ...createDefaultDelta(2), leftCreditLimit: 10n ** 9n, rightCreditLimit: 10n ** 9n }]]),
        locks: new PMap(), swapOffers: new PMap(), requestedRebalance: new PMap(), requestedRebalanceFeeState: new PMap(), domain: { chainId: 1, depositoryAddress: DEP }, jNonce: 0, lastFinalizedJHeight: 0,
        leftPendingJClaims: createEmptyAccountJClaimAccumulator(), rightPendingJClaims: createEmptyAccountJClaimAccumulator() };
      const account = { proofHeader: { fromEntity: A, toEntity: B }, state, currentHeight: 1, shadow: { rebalance: { submittedAtByToken: new PMap() } } };
      const store = new Map<string, unknown>();
      let { body } = openBody();
      // Each claim is usually observed by both sides (finalizing it), sometimes by one side only or with different evidence.
      type Plan = { h: number; byLeft: boolean; rows: { tokenId: number; collateral: bigint; ondelta: bigint; nonce: number }[] };
      const plan: Plan[] = [];
      for (let i = 0; i < 4; i++) {
        const h = 1 + ri(6), byLeft = rng() < 0.5, nonce = 1 + ri(3);
        const rows = Array.from({ length: 1 + ri(2) }, (_, k) => ({ tokenId: pick([1, 2, 3]), collateral: BigInt(h * 10 + k), ondelta: BigInt(ri(5)), nonce }));
        plan.push({ h, byLeft, rows });
        if (rng() < 0.8) plan.push({ h, byLeft: !byLeft, rows: rng() < 0.85 ? rows : rows.map((r) => ({ ...r, collateral: r.collateral + 1n })) });
      }
      for (const { h, byLeft, rows } of plan) {
        const blk = word(h.toString(16).padStart(2, "0"));
        const ogTx = { type: "j_event_claim", data: { jHeight: h, jBlockHash: blk, events: rows.map((r) => ({ type: "AccountSettled", data: { leftEntity: A, rightEntity: B, tokenId: r.tokenId, leftReserve: "0", rightReserve: "0", collateral: r.collateral.toString(), ondelta: r.ondelta.toString(), nonce: r.nonce } })) } };
        const rwTx = { type: "j_event_claim", jHeight: BigInt(h), jBlockHash: blk, observedAt: 1n, events: rows.map((r) => ({ left: A, right: B, nonce: BigInt(r.nonce), tokens: [{ tokenId: BigInt(r.tokenId), leftReserve: 0n, rightReserve: 0n, collateral: r.collateral, ondelta: r.ondelta }] })) };
        const effects: { kind: string; eventName?: string; data?: unknown }[] = [];
        const before = { ...state, deltas: new PMap([...(state["deltas"] as Map<number, object>)].map(([k, v]) => [k, { ...v }])) };
        let ogOk = false;
        try {
          const session = createAccountJClaimSession({ get: (x: string) => store.get(x) } as never);
          const prepared = prepareAccountJClaimTx(state as never, ogTx as never, { chainId: 1, depositoryAddress: DEP } as never, session);
          ogOk = handleJEventClaim(account as never, prepared as never, byLeft, 1, A, effects as never, jurisdictions, session).ok;
          if (ogOk) for (const { hash, node } of session.changes()?.newNodes ?? []) store.set(hash, node);
        } catch { ogOk = false; }
        if (!ogOk) { Object.assign(state, before); effects.length = 0; }
        const rw = applyAccountBody(body, rwTx as never, { byLeft, nowMs: 1n, jHeight: 0n, accountHeight: 1n }) as unknown as { ok: boolean; value: { state: AccountBody; effects: never[] } };
        expect(rw.ok).toBe(ogOk);
        if (!rw.ok) continue;
        body = rw.value.state;
        const mine = rw.value.effects.flatMap((e) => accountRuntimeEvents(A, B, e));
        expect(mine).toEqual(eventsOf(effects) as never);
        finalized += mine.length;
      }
    }
    expect(finalized).toBeGreaterThan(5);
  });
});

// ---- the Runtime event channel (og publishEntityCandidateEffects -> env.emit) ----
describe("runtime-final: RuntimeStep.events (og observability/env-events.ts publishEntityCandidateEffects)", () => {
  test("og semantics: runtime events publish only at commit, once on every committing validator replica (og installCommittedState), in commit order", () => {
    // A 2-of-2 Entity: the proposer's frame publishes nothing until the quorum commits it; then the proposer and the validator each publish its events.
    const members = new Map<Address, { shares: bigint }>([[aliceAddr, { shares: 1n }], [bobAddr, { shares: 1n }]]);
    const id = unwrap(lazyBoardEntityId({ mode: "proposer-based", threshold: 2n, validators: [aliceAddr, bobAddr], shares: { [aliceAddr]: 1n, [bobAddr]: 1n } } as never)) as EntityId;
    const replicaFor = (signerId: Address) => unwrap(createEntity({ id, jurisdiction: TERMS.domain, threshold: 2n, members, signerId, committed: { entityEncryptionPublicKey: `0x${"01".repeat(32)}` } }));
    let rt = spawn(spawn(createRuntime(), replicaFor(aliceAddr)), replicaFor(bobAddr));
    const open = (to: EntityId): EntityTx => ({ type: "openAccount", data: { targetEntityId: to, accountDomain: TERMS.domain, watchSeed: TERMS.watchSeed, disputeConfig: TERMS.disputeConfig } } as EntityTx);
    const queue: RoutedEntityInput[] = [{ entityId: id, signerId: aliceAddr, input: { kind: "txs", timestamp: NOW, txs: [open(BOB), open(CAROL)] } }];
    const seen: { signer: string; commits: boolean; events: string[] }[] = [];
    for (let n = 0; queue.length > 0 && n < 20; n++) {
      const input = queue.shift() as RoutedEntityInput;
      const before = rt.entities.get(replicaKey(id, input.signerId))?.head.height ?? 0n;
      const step = unwrap(applyRuntime(rt, { runtimeTxs: [], entityInputs: [input] }, verifiers));
      expect(step.rejected).toEqual([]);
      rt = step.runtime;
      const after = rt.entities.get(replicaKey(id, input.signerId))?.head.height ?? 0n;
      seen.push({ signer: input.signerId.toLowerCase(), commits: after > before, events: step.events.map((e) => `${e.eventName}:${String(e.data["counterpartyId"])}`) });
      for (const o of step.outbox) if ("input" in o && o.to === id) queue.push(unwrap(convertOutput(rt, o, id, NOW)));
    }
    const expected = [`AccountOpening:${BOB.toLowerCase()}`, `AccountOpening:${CAROL.toLowerCase()}`];
    expect(seen.filter((s) => !s.commits).every((s) => s.events.length === 0)).toBe(true);
    expect(seen.filter((s) => s.commits).map((s) => [s.signer, s.events]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))).toEqual([[aliceAddr.toLowerCase(), expected], [bobAddr.toLowerCase(), expected]].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  });
});
