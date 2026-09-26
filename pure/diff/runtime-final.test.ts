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
  accountId, accountRuntimeEvents, accountTxMessages, accountTerms, applyAccountBody, applyRuntime, applyRuntimeTx, committed, convertOutput, createEntity, createRuntime, lazyBoardEntityId, spawn, entityId as rwEntityId, entityRootOf, genesisAccount, genesisAccountBody, replicaKey,
  type AccountBody, type Address, type EntityId, type EntityTx, type FoldCtx, type RoutedEntityInput, type ImportConfig, type JReplica, type Runtime, type RuntimeTx,
} from "../xln.ts";
import { ALICE, BOB, CAROL, NOW, TERMS, aliceAddr, bobAddr, unwrap, verifiers, genesisAB, proposeInput, offerOf, ackInput, hankoVerify } from "../xln_run.ts";
import { admit, applyAccountInput, type AccountReplica, type AccountInput, type OpenAccount, type WireAccountTx } from "../xln.ts";
import { runPostFrameAutoRebalanceCheck } from "../../core/account/consensus/helpers.ts";
import { runtimeWake, entityEncryptionPublicKey, crontabOf, initCrontab, scheduleHook, withCrontab, ZERO_WORD, type Crontab, type EntityReplica, type ScheduledHook } from "../xln.ts";
import { createDueScheduledWakeInputs, assertScheduledWakeTxAuthorized } from "../../core/runtime/mempool/scheduled-wake.ts";
import { EntityAccountCandidateMap, PersistentEntityAccountMap } from "../../core/entity/state/persistent-account-map.ts";
import { initJBatch as ogInitJBatch } from "../../core/jurisdiction/machine/batch/index.ts";
import { assertFrameJPrefix as ogAssertFrameJPrefix, buildCertifiedJPrefixTx as ogBuildCertifiedJPrefixTx, buildLocalJPrefixAttestation as ogBuildLocalJPrefixAttestation, hashJPrefixAttestation as ogHashJPrefixAttestation,
  mergeJPrefixAttestations as ogMergeJPrefixAttestations, verifyOutOfRoundJPrefixAttestation as ogVerifyOutOfRound, buildJPrefixCertificate as ogBuildJPrefixCertificate } from "../../core/jurisdiction/machine/history/j-prefix-consensus.ts";
import { getJEventRangeValidationError as ogRangeValidationError, pruneFinalizedValidatorJHistory as ogPruneJHistory } from "../../core/jurisdiction/machine/local-history/index.ts";
import { createEntityFrameHashFromStateRoot as ogEntityFrameHash } from "../../core/entity/consensus/frame.ts";
import { normalizeJurisdictionEvent, compareCanonicalJurisdictionEvents } from "../../core/jurisdiction/machine/events/event-normalization.ts";
import { canonicalJurisdictionEventsHash, getJEventJurisdictionRef } from "../../core/jurisdiction/machine/event-observation.ts";
import { verifyAccountSignature as ogVerifyAccountSignature, registerSignerKey } from "../../core/account/crypto.ts";
import { FailureDispositionError } from "../../core/protocol/errors/failure-taxonomy.ts";
import { entityRequiresJPrefixCertificate, buildLocalJPrefixAttestation, buildCertifiedJPrefixTx, mergeJPrefixAttestations, verifyOutOfRoundJPrefixAttestation, assertFrameJPrefix, jPrefixAttestationHash, jPrefixVerify, jEventRangeLocalHistoryError,
  type JPrefixAttestation, type JPrefixCrypto, type JPrefixFailure, type JPrefixRound, type JPrefixView, type ValidatorJHistory, type ValidatorJBlock, type EntityState,
  hashEntityFrame, wireEntityTx, type EntityFrame, type EntityOutput } from "../xln.ts";
import { anvilKey, signDigestHex, carolAddr } from "../xln_run.ts";

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
    const seen = new Set<string>();
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
        let ogOk = false, ogMessages: readonly string[] = [];
        try {
          const session = createAccountJClaimSession({ get: (x: string) => store.get(x) } as never);
          const prepared = prepareAccountJClaimTx(state as never, ogTx as never, { chainId: 1, depositoryAddress: DEP } as never, session);
          const res = handleJEventClaim(account as never, prepared as never, byLeft, 1, A, effects as never, jurisdictions, session) as { ok: boolean; events?: string[] };
          ogOk = res.ok; ogMessages = res.events ?? [];
          if (ogOk) for (const { hash, node } of session.changes()?.newNodes ?? []) store.set(hash, node);
        } catch { ogOk = false; }
        if (!ogOk) { Object.assign(state, before); effects.length = 0; }
        const rw = applyAccountBody(body, rwTx as never, { byLeft, nowMs: 1n, jHeight: 0n, accountHeight: 1n }) as unknown as { ok: boolean; value: { state: AccountBody; effects: never[] } };
        expect(rw.ok).toBe(ogOk);
        if (!rw.ok) continue;
        const prior = body;
        body = rw.value.state;
        const mine = rw.value.effects.flatMap((e) => accountRuntimeEvents(A, B, e));
        expect(mine).toEqual(eventsOf(effects) as never);
        // og claim.ts handler messages: retained / idempotent / stale / finalized bilaterally
        expect(accountTxMessages(prior, rwTx as never, { byLeft, nowMs: 1n, jHeight: 0n, accountHeight: 1n }, body, A)).toEqual(ogMessages as never);
        seen.add(ogMessages.join());
        finalized += mine.length;
      }
    }
    expect(finalized).toBeGreaterThan(5);
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});

// ---- the Runtime event channel (og publishEntityCandidateEffects -> env.emit) ----
describe("runtime-final: RuntimeStep.events (og observability/env-events.ts publishEntityCandidateEffects)", () => {
  test("og semantics: runtime events publish only at commit, once on every committing validator replica (og installCommittedState), in commit order", () => {
    // A 2-of-2 Entity: the proposer's frame publishes nothing until the quorum commits it; then the proposer and the validator each publish its events.
    const members = new Map<Address, { shares: bigint }>([[aliceAddr, { shares: 1n }], [bobAddr, { shares: 1n }]]);
    const id = unwrap(lazyBoardEntityId({ mode: "proposer-based", threshold: 2n, validators: [aliceAddr, bobAddr], shares: { [aliceAddr]: 1n, [bobAddr]: 1n } } as never)) as EntityId;
    const SEED = `0x${"5a".repeat(64)}`;
    const replicaFor = (signerId: Address) => unwrap(createEntity({ id, jurisdiction: TERMS.domain, threshold: 2n, members, signerId, committed: { entityEncryptionPublicKey: entityEncryptionPublicKey(SEED, id) } }));
    // og: every proposal and replay checks the validator's Entity key pair (the Runtime derives it from the retained seed)
    let rt: Runtime = { ...spawn(spawn(createRuntime(), replicaFor(aliceAddr)), replicaFor(bobAddr)), encryptionSeeds: new Map([[id, SEED]]) };
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

// ---- og account/consensus: Account frame messages and runPostFrameAutoRebalanceCheck ----
describe("runtime-final: Account frame messages and the post-commit auto-rebalance (og account/consensus)", () => {
  const said = (outputs: readonly { readonly kind: string }[]): string[] => outputs.flatMap((o) => (o.kind === "message" ? [(o as { message: string }).message] : []));
  const door = (self: EntityId, autoRebalance: boolean) => ({ verify: hankoVerify, self, now: NOW, autoRebalance });
  test("MATCH (randomized): a full round says og's lines (`🚀`, handler lines + `🤝`, `✅`) and the ACK commit queues exactly og runPostFrameAutoRebalanceCheck's request_collateral", () => {
    let queued = 0, quiet = 0;
    for (let run = 0; run < 80; run++) {
      const g = genesisAB(), selfIsLeft = g.state.account.id.left === ALICE, tk = "1" as never;
      // usually Alice draws on Bob's credit (the side og rebalances), sometimes the other way
      const lean = (selfIsLeft ? 1n : -1n) * (rng() < 0.8 ? 1n : -1n), delta = { tokenId: tk, collateral: BigInt(ri(3) * 500), ondelta: BigInt(ri(3) * 100) * lean, offdelta: BigInt(ri(6) * 600) * lean, leftCreditLimit: 10_000n, rightCreditLimit: 10_000n };
      const fee = rng() < 0.85 ? { policyVersion: 1 + ri(3), baseFee: BigInt(ri(40)), liquidityFeeBps: BigInt(pick([0, 10, 100, 5000])), gasFee: BigInt(ri(20)), updatedAt: 1 } : undefined;
      const policy = { r2cRequestSoftLimit: BigInt(pick([0, 100, 700, 2000])), hardLimit: BigInt(pick([100, 700, 5000])), maxAcceptableFee: BigInt(pick([0, 30, 500, 10_000])) };
      const hub = rng() < 0.15;
      const body = { ...g.state, account: { ...g.state.account, deltas: new Map([[tk, delta]]) }, feePolicies: fee === undefined ? new Map() : new Map([[tk, selfIsLeft ? { right: fee } : { left: fee }]]) } as AccountBody;
      const alice = { ...g, state: body, rebalancePolicy: new Map([[1, policy]]) } as OpenAccount, bob = { ...g, state: body } as OpenAccount;
      const TX = { type: "set_credit_limit", tokenId: "2", limit: BigInt(1 + ri(9)) } as WireAccountTx;
      const queuedAlice = unwrap(admit(alice, [TX]) as never) as AccountReplica;
      const proposed = unwrap(applyAccountInput(queuedAlice, proposeInput(queuedAlice, ALICE) as AccountInput, door(ALICE, !hub)) as never) as { replica: AccountReplica; outputs: { kind: string }[] };
      if (proposed.replica._tag !== "proposed") throw new Error(proposed.replica._tag);
      expect(said(proposed.outputs)).toEqual(["🚀 Proposed frame 1 with 1 transactions"]);
      const received = unwrap(applyAccountInput(bob, offerOf(proposed.replica, ALICE) as AccountInput, door(BOB, true)) as never) as { replica: AccountReplica; outputs: { kind: string }[] };
      expect(said(received.outputs)).toEqual([]);
      const acked = unwrap(applyAccountInput(received.replica, ackInput(received.replica, BOB) as AccountInput, door(BOB, true)) as never) as { replica: AccountReplica; outputs: { kind: string }[] };
      // og: the receiver's replayed handler lines (proposer's side), then `🤝`; Bob has no rebalance policy, so nothing queues on his side
      expect(said(acked.outputs)).toEqual([...accountTxMessages(body, TX, { byLeft: selfIsLeft, nowMs: 0n, jHeight: 0n, accountHeight: 1n }, body, BOB), `🤝 Accepted frame 1 from Entity ${ALICE.slice(-4)}`]);
      const ack = acked.outputs.find((o) => o.kind === "ack") as AccountInput;
      const committedStep = unwrap(applyAccountInput(proposed.replica, ack, door(ALICE, !hub)) as never) as { replica: AccountReplica; outputs: { kind: string }[] };
      const after = committedStep.replica;
      if (after._tag !== "open") throw new Error(after._tag);
      // og side: the committed Account as og's post-ACK check sees it (pendingFrame cleared, nothing queued yet)
      const b = after.state, PAm = (ns: string, rows: readonly (readonly [unknown, unknown])[]) => PersistentAccountStateMap.fromEntries(ns as never, new Map(rows) as never);
      const ogAcc = {
        state: { leftEntity: b.account.id.left, rightEntity: b.account.id.right, deltas: PAm("deltas", [...b.account.deltas].map(([t, d]) => [Number(t), { ...d, tokenId: Number(t), leftAllowance: 0n, rightAllowance: 0n, leftHold: 0n, rightHold: 0n }])),
          requestedRebalance: PAm("requestedRebalance", [...b.requested].map(([t, v]) => [Number(t), v])), rebalanceFeePolicies: PAm("rebalanceFeePolicies", [...b.feePolicies].map(([t, v]) => [Number(t), v])) },
        shadow: { rebalance: { policy: PAm("rebalanceShadowPolicy", [[1, policy]]), submittedAtByToken: PAm("rebalanceShadowSubmitted", []) } }, pendingWithdrawals: PAm("pendingWithdrawals", []),
        proofHeader: { fromEntity: ALICE, toEntity: BOB, nextProofNonce: 1 }, currentHeight: 1, status: "active", mempool: [],
      };
      const og = runPostFrameAutoRebalanceCheck(ogAcc as never, ALICE, BOB, 1, hub, []) as unknown as { type: string; data: Record<string, unknown> }[];
      expect(after.mempool.map((t) => ({ type: t.type, data: { ...(t as Record<string, unknown>), type: undefined, tokenId: Number((t as { tokenId: string }).tokenId), feeTokenId: Number((t as { feeTokenId: string }).feeTokenId) } })))
        .toEqual(og.map((t) => ({ type: t.type, data: { ...t.data, type: undefined } })) as never);
      // og ack-commit.ts: `✅ Frame N confirmed and committed`, then `🔄 Auto-rebalance queued n tx(s) after ACK commit`
      expect(said(committedStep.outputs)).toEqual(["✅ Frame 1 confirmed and committed", ...(og.length > 0 ? [`🔄 Auto-rebalance queued ${og.length} tx(s) after ACK commit`] : [])]);
      if (og.length > 0) queued++; else quiet++;
    }
    expect(queued).toBeGreaterThan(5);
    expect(quiet).toBeGreaterThan(5);
  });
});

// ---- og runtime/mempool/wake.ts generateHookPings: the Runtime tick (scheduled-wake.ts createDueScheduledWakeInputs) ----
describe("runtime-final: the Runtime tick's due wakes and leader timeout votes (og runtime/mempool/scheduled-wake.ts)", () => {
  type Rep = { readonly entity: EntityId; readonly leader: boolean; readonly hooks: readonly ScheduledHook[]; readonly lastRun: number; readonly hub: boolean; readonly timestamp: number; readonly progress: number | undefined; readonly work: boolean; readonly queuedWake: boolean };
  const JUR = TERMS.domain;
  const crontabFor = (r: Rep): Crontab => r.hooks.reduce(scheduleHook, { ...initCrontab(), tasks: new Map([["hubRebalance", { method: "hubRebalance", intervalMs: 1000, lastRun: r.lastRun, enabled: true, params: {} }]]) });
  const CHAT = { type: "chat", data: { message: "hi" } } as unknown as EntityTx;
  const wakeTx = (signer: string) => ({ type: "scheduledWake", data: { version: 1, proposerSignerId: signer, dueAt: 1, jobs: [{ kind: "hook", id: "x", dueAt: 1 }] } }) as unknown as EntityTx;
  const rwReplica = (r: Rep): EntityReplica => {
    const jBatch = ogInitJBatch();
    const e = unwrap(createEntity({ id: r.entity, jurisdiction: JUR, threshold: 1n, members: new Map([[aliceAddr as never, { shares: 1n }], [bobAddr as never, { shares: 1n }]]), signerId: r.leader ? aliceAddr : bobAddr, timestamp: BigInt(r.timestamp),
      committed: { jBatchState: jBatch, ...(r.hub ? { hubRebalanceConfig: { disputeAutoFinalizeMode: "auto" } } : {}) } as never }));
    return { ...e, state: withCrontab(e.state, crontabFor(r)), mempool: [...(r.work ? [CHAT] : []), ...(r.queuedWake ? [wakeTx(r.leader ? aliceAddr : bobAddr)] : [])] } as EntityReplica;
  };
  const ogReplica = (r: Rep): any => {
    const c = crontabFor(r), signer = r.leader ? aliceAddr : bobAddr;
    return { entityId: r.entity, signerId: signer, mempool: [...(r.work ? [CHAT] : []), ...(r.queuedWake ? [wakeTx(signer)] : [])], ...(r.progress === undefined ? {} : { lastConsensusProgressAt: r.progress }),
      state: { entityId: r.entity, height: 0, timestamp: r.timestamp, prevFrameHash: "", lastFinalizedJHeight: 0, config: { mode: "proposer-based", threshold: 1n, validators: [aliceAddr.toLowerCase(), bobAddr.toLowerCase()], shares: { [aliceAddr.toLowerCase()]: 1n, [bobAddr.toLowerCase()]: 1n } },
        accounts: new EntityAccountCandidateMap(PersistentEntityAccountMap.fromEntries([], r.entity, () => ZERO_WORD as never)), paybook: { entries: new Map(), feesEarned: 0n }, crontabState: { tasks: c.tasks, hooks: new Map(c.hooks) }, jBatchState: ogInitJBatch(),
        ...(r.hub ? { hubRebalanceConfig: { disputeAutoFinalizeMode: "auto" } } : {}) } };
  };
  const shape = (entityId: string, signer: string, wake: unknown, vote: Record<string, unknown> | undefined) => ({ entity: entityId.toLowerCase(), signer: signer.toLowerCase(), wake,
    vote: vote === undefined ? undefined : { entityId: String(vote["entityId"]).toLowerCase(), targetHeight: Number(vote["targetHeight"]), previousFrameHash: vote["previousFrameHash"], fromView: vote["fromView"], toView: vote["toView"],
      previousLeaderId: String(vote["previousLeaderId"]).toLowerCase(), nextLeaderId: String(vote["nextLeaderId"]).toLowerCase(), voterId: String(vote["voterId"]).toLowerCase(), signature: vote["signature"] } });

  test("MATCH (randomized): 300 random Runtimes (leaders with due hooks and the hubRebalance task, validators with leader work and last progress, queued wakes and votes) -- og createDueScheduledWakeInputs, in og's (dueAt, entityId, signerId) order", () => {
    let wakes = 0, votes = 0, skipped = 0;
    for (let run = 0; run < 300; run++) {
      const reps: Rep[] = [ALICE, BOB, CAROL].flatMap((entity) => (rng() < 0.3 ? [] : [true, false].filter(() => rng() < 0.6).map((leader): Rep => ({
        entity, leader, hooks: Array.from({ length: ri(3) }, (_, j) => ({ id: `hub-kick:${j}`, triggerAt: 900 + ri(20_000), type: "hub_rebalance_kick", data: { reason: "r", counterpartyId: BOB } }) as ScheduledHook),
        lastRun: pick([0, 5_000, 30_000]), hub: rng() < 0.3, timestamp: ri(8_000), progress: rng() < 0.5 ? undefined : ri(12_000), work: rng() < 0.7, queuedWake: rng() < 0.1,
      }))));
      const now = ri(26_000);
      const queuedVotes = reps.filter(() => rng() < 0.1).map((r) => ({ entityId: r.entity, signerId: r.leader ? aliceAddr : bobAddr }));
      const rt: Runtime = { ...reps.map(rwReplica).reduce(spawn, createRuntime()), replicaLocal: new Map(reps.flatMap((r) => (r.progress === undefined ? [] : [[replicaKey(r.entity, r.leader ? aliceAddr : bobAddr), { lastConsensusProgressAt: r.progress }] as const]))) };
      const queued = { runtimeTxs: [], entityInputs: queuedVotes.map((q) => ({ ...q, input: { kind: "leaderTimeoutVote" } })) } as never;
      const mine = runtimeWake(rt, now, queued).input.entityInputs.map((i) => shape(i.entityId, i.signerId, i.input.kind === "txs" ? (i.input.txs[0] as { data: unknown }).data : undefined, i.input.kind === "leaderTimeoutVote" ? { ...(i.input as { vote: Record<string, unknown> }).vote } : undefined));
      const env: any = { state: { eReplicas: new Map(reps.map((r) => [`${r.entity}:${r.leader ? aliceAddr : bobAddr}`, ogReplica(r)])) }, runtimeMempool: { entityInputs: queuedVotes.map((q) => ({ ...q, leaderTimeoutVote: {} })) } };
      const og = (createDueScheduledWakeInputs(env, now) as any[]).map((i) => shape(i.entityId, i.signerId, i.entityTxs?.[0]?.data, i.leaderTimeoutVote));
      expect(mine).toEqual(og as never);
      wakes += og.filter((i) => i.wake !== undefined).length; votes += og.filter((i) => i.vote !== undefined).length; skipped += queuedVotes.length;
    }
    expect([wakes > 80, votes > 80, skipped > 10]).toEqual([true, true, true]);
  });

  test("MATCH: a scheduledWake enters only as the tick's own marked tx -- og assertScheduledWakeTxAuthorized (SCHEDULED_WAKE_EXTERNAL_INGRESS_REJECTED); the tick's wake runs the due hook", () => {
    const rep: Rep = { entity: ALICE, leader: true, hooks: [{ id: "hub-kick:0", triggerAt: 1_000, type: "hub_rebalance_kick", data: { reason: "r", counterpartyId: BOB } } as ScheduledHook], lastRun: 0, hub: false, timestamp: 0, progress: undefined, work: false, queuedWake: false };
    // a single-member ALICE (its id is the board's), so the wake's frame commits
    const solo = unwrap(createEntity({ id: ALICE, jurisdiction: JUR, threshold: 1n, members: new Map([[aliceAddr as never, { shares: 1n }]]) }));
    const rt = spawn(createRuntime(), { ...solo, state: withCrontab(solo.state, crontabFor(rep)) } as EntityReplica);
    const tick = runtimeWake(rt, 2_000);
    expect(tick.input.entityInputs.length).toBe(1);
    const forged = applyRuntime(rt, { ...tick.input, entityInputs: tick.input.entityInputs.map((i) => ({ ...i, input: i.input.kind === "txs" ? { ...i.input, txs: i.input.txs.map((tx) => ({ ...tx })) } : i.input })) }, verifiers);
    const ogTx = { type: "scheduledWake", data: { version: 1, proposerSignerId: aliceAddr, dueAt: 1_000, jobs: [] } };
    let ogReason = "";
    try { assertScheduledWakeTxAuthorized(ogTx as never, false); } catch (e) { ogReason = ogCode(e); }
    expect([(forged as { error?: { _tag?: string } }).error?._tag, rwCode(forged as never)]).toEqual(["runtime_frame", ogReason]);
    const ogMarked = (createDueScheduledWakeInputs({ state: { eReplicas: new Map([["k", ogReplica(rep)]]) }, runtimeMempool: { entityInputs: [] } } as never, 2_000) as any[])[0].entityTxs[0];
    expect(() => assertScheduledWakeTxAuthorized(ogMarked, false)).not.toThrow();
    expect(() => assertScheduledWakeTxAuthorized(ogTx as never, true)).not.toThrow();
    expect(applyRuntime(rt, tick.input, { ...verifiers, replay: true }).ok).toBe(true);
    const step = unwrap(applyRuntime(rt, tick.input, { ...verifiers, local: tick.local }));
    expect(step.rejected).toEqual([]);
    expect([...unwrap(crontabOf((step.runtime.entities.get(replicaKey(ALICE, aliceAddr)) as EntityReplica).state)).hooks.keys()]).not.toContain("hub-kick:0");
  });
});

// ---- og jurisdiction/machine/history/j-prefix-consensus.ts: the per-frame J prefix (attestations, rounds, certificates, the frame rule) ----
describe("runtime-final: the per-frame J prefix (og jurisdiction/machine/history/j-prefix-consensus.ts, local-history getJEventRangeValidationError)", () => {
  const EP = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
  const OG_J = { name: "j", chainId: TERMS.domain.chainId, depositoryAddress: TERMS.domain.depositoryAddress, entityProviderAddress: EP };
  const JREF = getJEventJurisdictionRef(OG_J);
  const V = [aliceAddr, bobAddr, carolAddr].map((a) => a.toLowerCase());
  const KEYS = new Map([[V[0], anvilKey(2)], [V[1], anvilKey(1)], [V[2], anvilKey(0)]]);
  const crypto: JPrefixCrypto = { verify: jPrefixVerify, sign: (signer, digest) => ({ ok: true, value: signDigestHex(digest, KEYS.get(signer) as string) }) as never };
  const ogEnv: any = { quietRuntimeLogs: true, runtimeSeed: `0x${"11".repeat(32)}` };
  // og signs with the validators' registered keys: the same keys the rewrite signs with, so signatures match byte for byte (RFC 6979)
  for (const [v, k] of KEYS) registerSignerKey(ogEnv, v as string, Buffer.from((k as string).slice(2), "hex"));
  const word = (): string => `0x${Array.from({ length: 64 }, () => "0123456789abcdef"[ri(16)]).join("")}`;
  const SEED_J = `0x${"6b".repeat(64)}`;
  type Outcome = { ok: true; value: unknown } | { ok: false; disposition: string; message: string };
  const ogDo = (f: () => unknown): Outcome => {
    try { return { ok: true, value: f() }; } catch (e) {
      const m = String((e as Error).message);
      return { ok: false, disposition: e instanceof FailureDispositionError ? e.disposition : /^J_HISTORY_(?:FINALITY|FINALIZED)_/.test(m) ? "halt" : "reject", message: m };
    }
  };
  const rwDo = (r: { ok: boolean; value?: unknown; error?: JPrefixFailure }): Outcome => (r.ok ? { ok: true, value: r.value } : { ok: false, disposition: (r.error as JPrefixFailure).disposition, message: (r.error as JPrefixFailure).message });
  const shape = (o: Outcome): unknown => (o.ok ? "ok" : { disposition: o.disposition, message: o.message });
  const unsigned = (a: any): any => (a === null || a === undefined ? a : JSON.parse(JSON.stringify(a)));
  type Fx = { view: JPrefixView; og: any; histories: Map<string, ValidatorJHistory>; L: number; H: number; parent: string; id: EntityId; created: EntityReplica };
  /** A random Entity (shares, threshold, certified anchor or registration base, height) and each validator's own J history over one shared chain, with gaps, lag and forks. */
  const fixture = (lazy = false): Fx => {
    const shares = V.map(() => BigInt(1 + ri(3))), total = shares.reduce((a, b) => a + b, 0n), threshold = BigInt(1 + ri(Number(total)));
    const L = 2 + ri(4), finality = rng() < 0.7, H = lazy ? 0 : ri(3), prev = word(), registered = rng() < 0.3;
    // a lazy Entity (id = its board hash) is its own certified authority, so it proposes from genesis
    const ID = lazy ? unwrap(lazyBoardEntityId({ mode: "proposer-based", threshold, validators: [aliceAddr, bobAddr, carolAddr], shares: { [aliceAddr]: shares[0], [bobAddr]: shares[1], [carolAddr]: shares[2] } } as never)) as EntityId : ALICE;
    const chainHash = new Map<number, string>(); for (let h = 0; h <= L + 8; h++) chainHash.set(h, word());
    const eventHeights = new Set(Array.from({ length: ri(4) }, () => L + 1 + ri(8)));
    const balance = new Map([...eventHeights].map((h) => [h, String(ri(900))]));
    const anchor = finality ? { jurisdictionRef: JREF, baseHeight: L - 1, finalizedThroughHeight: L, tipBlockHash: chainHash.get(L), eventHistoryRoot: word(), proposerSignerId: V[0], proposerSignature: "0x", entityHeight: H } : undefined;
    const jc = { name: "j", entityProviderAddress: EP, ...(finality ? {} : { entityProviderDeploymentBlock: L + 1 }), ...(registered ? { registrationBlock: 1 } : {}) };
    const members = new Map([aliceAddr, bobAddr, carolAddr].map((a, i) => [a, { shares: shares[i] as bigint }] as const));
    const created = unwrap(createEntity({ id: ID, jurisdiction: TERMS.domain, threshold, members: members as never, jurisdictionConfig: jc as never,
      committed: { lastFinalizedJHeight: L, ...(anchor ? { jHistoryFinality: anchor } : {}), ...(lazy ? { entityEncryptionPublicKey: entityEncryptionPublicKey(SEED_J, ID) } : {}) } as never }));
    const view: JPrefixView = { state: { ...created.state, height: BigInt(H) } as EntityState, head: { height: BigInt(H), prevFrameHash: prev as never } };
    const og = { entityId: ID, height: H, prevFrameHash: prev, lastFinalizedJHeight: L, ...(anchor ? { jHistoryFinality: anchor } : {}),
      config: { mode: "proposer-based", threshold, validators: [...V], shares: Object.fromEntries(V.map((v, i) => [v, shares[i]])), jurisdiction: { ...OG_J, ...(finality ? {} : { entityProviderDeploymentBlock: L + 1 }), ...(registered ? { registrationBlock: 1 } : {}) } } };
    const histories = new Map<string, ValidatorJHistory>();
    for (const v of V) {
      if (rng() < 0.08) continue;
      const scanned = L + ri(9), forkAt = rng() < 0.15 ? L + 1 + ri(8) : Infinity, forked = new Map<number, string>();
      const hashAt = (h: number): string => { if (h < forkAt) return chainHash.get(h) as string; if (!forked.has(h)) forked.set(h, word()); return forked.get(h) as string; };
      const blockHashes = new Map<number, string>(), eventBlocks = new Map<number, ValidatorJBlock>();
      for (let h = L; h <= scanned; h++) if (h === scanned || (h === L && finality) || rng() < 0.9) blockHashes.set(h, hashAt(h));
      for (const h of eventHeights) {
        if (h > scanned || rng() < 0.1) continue;
        const events = [normalizeJurisdictionEvent({ type: "ReserveUpdated", data: { entity: ID, tokenId: 1, newBalance: balance.get(h) }, blockNumber: h, blockHash: hashAt(h), transactionHash: `0x${String(h).padStart(64, "0")}`, logIndex: 0 } as never)!].sort(compareCanonicalJurisdictionEvents);
        eventBlocks.set(h, { jurisdictionRef: JREF, jHeight: h, jBlockHash: hashAt(h), eventsHash: canonicalJurisdictionEventsHash(events as never), events });
        blockHashes.set(h, hashAt(h));
      }
      let contiguous = L;
      while (contiguous < scanned && blockHashes.has(contiguous + 1)) contiguous++;
      histories.set(v, { jurisdictionRef: JREF, scannedThroughHeight: scanned, contiguousThroughHeight: contiguous, tipBlockHash: hashAt(scanned), eventBlocks, blockHashes });
    }
    return { view, og, histories, L, H, parent: H === 0 ? "genesis" : prev, id: ID, created };
  };
  const ogReplica = (fx: Fx, signer: string, round?: unknown): any => ({ signerId: signer, state: fx.og, jHistory: fx.histories.get(signer), ...(round ? { jPrefixRound: round } : {}) });
  /** Every validator's rewrite-built, really signed attestation (null or refused ones left out). */
  const attestationsOf = (fx: Fx): Map<string, JPrefixAttestation> => new Map(V.flatMap((v) => { const a = buildLocalJPrefixAttestation(fx.view, v, fx.histories.get(v), crypto); return a.ok && a.value !== null ? [[v, a.value] as const] : []; }));
  const tamper = (a: JPrefixAttestation): [string, JPrefixAttestation] => {
    const k = ri(6);
    if (k === 0) return [a.validatorId, { ...a, signature: `${a.signature.slice(0, -4)}${a.signature.slice(-4) === "0000" ? "1111" : "0000"}` }];
    if (k === 1) return [a.validatorId, { ...a, targetEntityHeight: a.targetEntityHeight + 1 }];
    if (k === 2) return [a.validatorId, { ...a, headers: a.headers.map((h, i) => (i === a.headers.length - 1 ? { ...h, jBlockHash: word() } : h)) }];
    if (k === 3) return [V[(V.indexOf(a.validatorId) + 1) % 3] as string, a];
    if (k === 4) return [a.validatorId, { ...a, baseHeight: a.baseHeight + 1 }];
    return [a.validatorId, { ...a, parentFrameHash: word() }];
  };

  test("MATCH (randomized): 400 local attestations -- og buildLocalJPrefixAttestation (budgeted claim, headers, base claims, sparse gaps, lag, refusals) and hashJPrefixAttestation", () => {
    const seen = new Map<string, number>();
    for (let run = 0; run < 400; run++) {
      const fx = fixture(), v = pick(V), clean = fx.histories.get(v), defect = clean === undefined ? 9 : ri(12);
      // defects: a history behind the certified base, a reorg at the certified anchor, a missing base header before the first anchor
      const h: ValidatorJHistory | undefined = clean === undefined || defect > 2 ? clean
        : defect === 0 ? { ...clean, scannedThroughHeight: fx.L - 1, contiguousThroughHeight: fx.L - 1, tipBlockHash: word(), blockHashes: new Map([[fx.L - 1, word()]]), eventBlocks: new Map() }
          : defect === 1 ? { ...clean, blockHashes: new Map([...clean.blockHashes].map(([k, x]) => [k, k === fx.L ? word() : x] as const)), ...(clean.scannedThroughHeight === fx.L ? { tipBlockHash: "" } : {}) }
            : { ...clean, blockHashes: new Map([...clean.blockHashes].filter(([k]) => k !== fx.L || k === clean.scannedThroughHeight)) };
      if (h !== undefined && h.tipBlockHash === "") continue;
      const mine = rwDo(buildLocalJPrefixAttestation(fx.view, v, h, crypto) as never), og = ogDo(() => ogBuildLocalJPrefixAttestation(ogEnv, ogReplica(fx, v) as never, h as never));
      expect(shape(mine)).toEqual(shape(og) as never);
      if (mine.ok && og.ok) {
        expect(unsigned(mine.value)).toEqual(unsigned(og.value));
        if (og.value !== null) expect(unwrap(jPrefixAttestationHash(mine.value as never) as never)).toBe(ogHashJPrefixAttestation(unsigned(og.value)));
      }
      const k = !mine.ok ? `err:${mine.message.split(":")[0]}` : mine.value === null ? "null" : (mine.value as JPrefixAttestation).scannedThroughHeight > fx.L ? "range" : "base";
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    for (const k of ["range", "base", "null"]) expect(seen.get(k) ?? 0).toBeGreaterThan(10);
    expect([...seen.keys()].filter((k) => k.startsWith("err:")).length).toBeGreaterThan(0);
  }, 120_000);

  test("MATCH (randomized): 300 rounds -- og mergeJPrefixAttestations (verification, equivocation, the highest weighted common prefix and its certificate) over honest and tampered votes", () => {
    let certified = 0, refused = 0;
    for (let run = 0; run < 300; run++) {
      const fx = fixture(), honest = attestationsOf(fx);
      const incoming = new Map([...honest].map(([k, a]) => (rng() < 0.12 ? tamper(a) : [k, a] as [string, JPrefixAttestation])));
      const mine = rwDo(mergeJPrefixAttestations(fx.view, undefined, incoming, crypto) as never), og = ogDo(() => ogMergeJPrefixAttestations(ogEnv, fx.og, undefined, incoming as never));
      expect(shape(mine)).toEqual(shape(og) as never);
      if (!mine.ok || !og.ok) { refused++; continue; }
      const m = mine.value as JPrefixRound, o = og.value as any;
      expect([...m.attestations.keys()]).toEqual([...o.attestations.keys()]);
      expect(JSON.parse(JSON.stringify(m.certificate?.selected ?? null))).toEqual(JSON.parse(JSON.stringify(o.certificate?.selected ?? null)));
      expect([m.targetEntityHeight, m.parentFrameHash, m.jurisdictionRef, m.baseHeight]).toEqual([o.targetEntityHeight, o.parentFrameHash, o.jurisdictionRef, o.baseHeight]);
      if (m.certificate !== undefined) certified++;
      // a second, different vote from the same validator is equivocation; the same vote again is a no-op
      const [first] = honest.values();
      if (first !== undefined && m.attestations.has(first.validatorId)) {
        const again = new Map([[first.validatorId, first]]);
        expect(shape(rwDo(mergeJPrefixAttestations(fx.view, m, again, crypto) as never))).toEqual(shape(ogDo(() => ogMergeJPrefixAttestations(ogEnv, fx.og, o, again as never))) as never);
      }
    }
    expect([certified > 60, refused > 20]).toEqual([true, true]);
  }, 300_000);

  test("MATCH (randomized): 200 out-of-round votes -- og verifyOutOfRoundJPrefixAttestation (stale and future targets, authority, envelope, signature)", () => {
    const seen = new Set<string>();
    for (let run = 0; run < 200; run++) {
      const fx = fixture(), v = pick(V), shift = pick([-1, 1, 2]);
      if (fx.H + shift < 0) continue;
      const other: JPrefixView = { state: { ...fx.view.state, height: BigInt(fx.H + shift) }, head: { height: BigInt(fx.H + shift), prevFrameHash: word() as never } };
      const built = buildLocalJPrefixAttestation(other, v, fx.histories.get(v), crypto);
      if (!built.ok || built.value === null) continue;
      const raw = rng() < 0.2 ? tamper(built.value)[1] : built.value;
      const mine = rwDo(verifyOutOfRoundJPrefixAttestation(fx.view, raw, [fx.view.state.quorum], crypto) as never), og = ogDo(() => ogVerifyOutOfRound(ogEnv, fx.og, raw as never, [fx.og.config]));
      expect(shape(mine)).toEqual(shape(og) as never);
      seen.add(mine.ok ? "ok" : mine.message.split(":")[0] as string);
    }
    expect(seen.size).toBeGreaterThan(2);
  }, 120_000);

  test("MATCH (randomized): 300 frames -- og assertFrameJPrefix (certificate required, round, stronger local certificate, required local event, frozen base roll, range equals the certified prefix, proposer signature) and og getJEventRangeValidationError", () => {
    const seen = new Map<string, number>();
    for (let run = 0; run < 300; run++) {
      const fx = fixture(), votes = attestationsOf(fx);
      const rw = mergeJPrefixAttestations(fx.view, undefined, votes, crypto);
      const ogRound = ogDo(() => ogMergeJPrefixAttestations(ogEnv, fx.og, undefined, votes as never));
      if (!rw.ok || !ogRound.ok) continue;
      const proposer = V[0] as string, certificate = rw.value.certificate;
      let txs: EntityTx[] = [];
      if (certificate !== undefined && certificate.selected.scannedThroughHeight > fx.L) {
        const tx = buildCertifiedJPrefixTx(fx.view, fx.histories.get(proposer), certificate, proposer, crypto);
        const ogTx = ogDo(() => ogBuildCertifiedJPrefixTx(ogEnv, ogReplica(fx, proposer) as never, certificate as never, proposer));
        expect(shape(rwDo(tx as never))).toEqual(shape(ogTx) as never);
        if (tx.ok && ogTx.ok) expect(unsigned(tx.value.data)).toEqual(unsigned((ogTx.value as any).data));
        if (tx.ok) txs = [tx.value];
      }
      const variant = ri(8);
      if (variant === 1) txs = [];
      if (variant === 2) txs = [...txs, { type: "chat", data: { message: "x" } } as unknown as EntityTx];
      if (variant === 3 && txs[0] !== undefined) txs = [{ ...txs[0], data: { ...(txs[0] as { data: Record<string, unknown> }).data, from: V[1] } } as EntityTx];
      const frame = { height: variant === 4 ? fx.H + 2 : fx.H + 1, parentFrameHash: fx.parent, proposerSignerId: variant === 5 ? V[1] as string : proposer, txs, jPrefixCertificate: variant === 6 ? undefined : certificate };
      const ogFrame = { height: frame.height, parentFrameHash: frame.parentFrameHash, leader: { proposerSignerId: frame.proposerSignerId, view: 0 }, txs, ...(frame.jPrefixCertificate ? { jPrefixCertificate: frame.jPrefixCertificate } : {}) };
      const judge = pick(V), useRound = rng() < 0.7;
      const mine = rwDo(assertFrameJPrefix(fx.view, judge, useRound ? rw.value : undefined, fx.histories.get(judge), frame, crypto) as never);
      const og = ogDo(() => ogAssertFrameJPrefix(ogEnv, ogReplica(fx, judge, useRound ? ogRound.value : undefined), ogFrame as never));
      expect(shape(mine)).toEqual(shape(og) as never);
      const k = mine.ok ? "ok" : `${mine.disposition}:${mine.message.split(":")[0]}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
      // og getReplicaJRangeValidationError: each proposed range against the judge's own history
      for (const tx of txs) {
        if (tx.type !== "j_event") continue;
        const r = jEventRangeLocalHistoryError(fx.view.state, fx.histories.get(judge), tx.data as never), o = ogDo(() => ogRangeValidationError(fx.og, fx.histories.get(judge) as never, tx.data as never, proposer, (s: string, d: string, sig: string) => ogVerifyAccountSignature(ogEnv, s, d, sig)));
        expect(r.ok ? r.value : `halt:${(r.error as JPrefixFailure).message}`).toEqual((o.ok ? o.value : `halt:${o.message}`) as never);
      }
    }
    for (const k of ["ok", "reject:J_PREFIX_CERTIFICATE_MISSING", "reject:J_PREFIX_FRAME_ROUND_MISMATCH"]) expect(seen.get(k) ?? 0).toBeGreaterThan(0);
    expect(seen.size).toBeGreaterThan(5);
  }, 300_000);
  test("MATCH (randomized): 40 validator Runtimes run the J prefix through Entity consensus -- the committed frame's certificate, certified j_event and frame hash equal og's, every commit prunes the local history like og", () => {
    const allowed = new Set(["J_PREFIX_INVALID", "J_PREFIX_LOCAL_HISTORY_BEHIND", "J_PREFIX_STRONGER_LOCAL_CERTIFICATE", "J_PREFIX_REQUIRED_LOCAL_EVENT", "PROPOSAL_J_RANGE_MISMATCH", "PROPOSAL_J_PREFIX_HISTORY_WAIT", "COMMIT_J_PREFIX_HISTORY_WAIT", "COMMIT_J_RANGE_MISMATCH", "J_PREFIX_FUTURE_HEIGHT", "J_PREFIX_ROUND_FROZEN", "J_PREFIX_ATTESTATION_REJECTED"]);
    const plain = (v: unknown): unknown => (v === undefined ? v : JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof Map ? [...x] : typeof x === "bigint" ? x.toString() : x))));
    let committedRuns = 0, ranged = 0, uncertified = 0;
    const seenCodes = new Map<string, number>();
    for (let run = 0; run < 40; run++) {
      const fx = fixture(true), id = fx.id;
      const signers = [aliceAddr, bobAddr, carolAddr] as Address[];
      let rt: Runtime = { ...signers.reduce((acc, s) => spawn(acc, { ...fx.created, signerId: s } as EntityReplica), createRuntime()), encryptionSeeds: new Map([[id, SEED_J]]),
        replicaLocal: new Map(signers.flatMap((s) => { const h = fx.histories.get(s.toLowerCase()); return h === undefined ? [] : [[replicaKey(id, s), { jHistory: h }] as const]; })) } as Runtime;
      const queue: RoutedEntityInput[] = [{ entityId: id, signerId: aliceAddr, input: { kind: "txs", timestamp: NOW, txs: [{ type: "chat", data: { from: aliceAddr.toLowerCase(), message: "j" } } as EntityTx] } }];
      const frames = new Map<string, EntityFrame>();
      for (let n = 0; queue.length > 0 && n < 80; n++) {
        const input = queue.shift() as RoutedEntityInput;
        const step = unwrap(applyRuntime(rt, { runtimeTxs: [], entityInputs: [input] }, verifiers));
        for (const e of step.rejected) {
          const code = e._tag === "j_prefix" ? (e as { code: string }).code : e._tag;
          seenCodes.set(code, (seenCodes.get(code) ?? 0) + 1);
          if (e._tag === "j_prefix") expect([run, code, (e as { message: string }).message, allowed.has(code)]).toEqual([run, code, (e as { message: string }).message, true]);
        }
        rt = step.runtime;
        for (const o of step.outbox as readonly EntityOutput[]) {
          if (!("input" in o) || o.to !== id) continue;
          if (o.input.kind === "proposal") frames.set(unwrap(hashEntityFrame(o.input.frame)), o.input.frame);
          queue.push(unwrap(convertOutput(rt, o, id, NOW)));
        }
      }
      const heads = signers.map((s) => rt.entities.get(replicaKey(id, s)) as EntityReplica);
      const committedHeads = heads.filter((r) => r.head.height >= 1n);
      if (committedHeads.length === 0) continue;
      committedRuns++;
      for (const r of committedHeads) {
        // this replica's committed chain, newest first (every committed frame was broadcast as a commit notification)
        const chain: EntityFrame[] = [];
        for (let hash = r.head.prevFrameHash as string; hash !== "genesis";) { const f = frames.get(hash); if (f === undefined) throw new Error(`run ${run}: frame ${hash} missing`); chain.push(f); hash = f.prevFrameHash; }
        expect(chain.length).toBe(Number(r.head.height));
        for (const frame of chain) {
          const cert = frame.jPrefixCertificate, range = frame.txs.find((tx) => tx.type === "j_event");
          // og createEntityFrameHashFromStateRoot: the certificate is in the frame hash
          expect(unwrap(hashEntityFrame(frame))).toBe(ogEntityFrameHash(frame.prevFrameHash, Number(frame.height), Number(frame.timestamp), frame.txs.map(wireEntityTx) as never, frame.events as never, id, frame.stateRoot, frame.authorityRoot, frame.entityContext as never, cert as never));
          if (frame.height !== 1n) continue;
          // og assertFrameJPrefix: without a certificate (an unregistered Entity whose validators see no pending J event) no range is certified
          if (cert === undefined) { uncertified++; expect(range).toBeUndefined(); expect(entityRequiresJPrefixCertificate(fx.view.state)).toBe(false); continue; }
          // og's frame 1 and ours: the certificate is og buildJPrefixCertificate over its heads, the range og buildCertifiedJPrefixTx
          expect(plain(cert)).toEqual(plain(ogBuildJPrefixCertificate({ ...fx.og, height: 0 } as never, cert.attestations as never)));
          if (cert.selected.scannedThroughHeight > fx.L) {
            ranged++;
            expect(plain(range)).toEqual(plain(ogBuildCertifiedJPrefixTx(ogEnv, { ...ogReplica(fx, V[0] as string), state: { ...fx.og, height: 0 } }, cert as never, V[0] as string)));
          } else expect(range).toBeUndefined();
        }
        // the committed finality is the highest certified prefix; og finalizeCommitNotification prunes the local history to it at every commit
        const finalized = Number(r.state.committed["lastFinalizedJHeight"] || 0), before = fx.histories.get(r.signerId.toLowerCase());
        expect(finalized).toBe(Math.max(fx.L, ...chain.map((f) => f.jPrefixCertificate?.selected.scannedThroughHeight ?? 0)));
        if (before !== undefined) expect(plain(rt.replicaLocal.get(replicaKey(id, r.signerId))?.jHistory)).toEqual(plain(ogPruneJHistory(before as never, finalized)));
      }
    }
    expect(committedRuns).toBeGreaterThan(10);
    expect(ranged).toBeGreaterThan(3);
    expect(uncertified).toBeLessThan(committedRuns);
    expect([...seenCodes.keys()].filter((k) => allowed.has(k) && k !== "precommit_not_active").length).toBeGreaterThan(3);
  }, 300_000);
});

// ---- og runtime/tx/tx-handlers.ts rewindJHistoryRuntimeTx: a precommit cannot be revoked ----
describe("runtime-final: rewindJHistory against a locked frame (og tx-handlers.ts J_HISTORY_SIGNED_LOCK_REORG)", () => {
  test("MATCH (randomized): 200 rewinds -- og refuses exactly a height inside the range this validator's locked frame signed", async () => {
    const E = ALICE.toLowerCase(), A = aliceAddr.toLowerCase(), EP = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
    const REF = `stack:${TERMS.domain.chainId}:${TERMS.domain.depositoryAddress.toLowerCase()}`;
    const hex32 = (): string => `0x${Array.from({ length: 64 }, () => "0123456789abcdef"[ri(16)]).join("")}`;
    const base0 = unwrap(createEntity({ id: ALICE, jurisdiction: TERMS.domain, threshold: 1n, members: new Map([[aliceAddr, { shares: 1n }]]), signerId: aliceAddr,
      jurisdictionConfig: { name: "Local", entityProviderAddress: EP, entityProviderDeploymentBlock: 0 }, committed: { lastFinalizedJHeight: 0 } }));
    const key = replicaKey(ALICE, aliceAddr), seen = new Map<string, number>();
    for (let run = 0; run < 200; run++) {
      const base = ri(4), scanned = base + 1 + ri(6), top = scanned + 2, locked = rng() < 0.8, tip = hex32();
      const history = { jurisdictionRef: REF, scannedThroughHeight: top, contiguousThroughHeight: top, tipBlockHash: tip, eventBlocks: new Map(), blockHashes: new Map([[top, tip]]) };
      const range = { type: "j_event", data: { baseHeight: base, scannedThroughHeight: scanned } };
      const env = ogEnv();
      env.state.eReplicas.set(`${E}:${A}`, { entityId: E, signerId: A, jHistory: treeClone(history),
        state: { entityId: E, config: { jurisdiction: { name: "Local", chainId: TERMS.domain.chainId, depositoryAddress: TERMS.domain.depositoryAddress, entityProviderAddress: EP, entityProviderDeploymentBlock: 0 } }, lastFinalizedJHeight: 0 },
        ...(locked ? { lockedFrame: { height: 1, hash: hex32(), txs: [treeClone(range)] } } : {}) });
      const replica = (locked ? { ...base0, _tag: "locked", frame: { height: 1n, prevFrameHash: "genesis", txs: [range] }, signatures: new Map(), draft: {} } : base0) as EntityReplica;
      const rt: Runtime = { ...createRuntime(), entities: new Map([[key, replica]]), replicaLocal: new Map([[key, { jHistory: history as never }]]) };
      const tx = { type: "rewindJHistory", data: { entityId: E, signerId: A, jurisdictionRef: REF, conflictingHeight: 1 + ri(top + 1), conflictingBlockHash: hex32() } };
      const og = await runOg(env, tx), rw = rwCode(applyRuntimeTx(rt, tx as unknown as RuntimeTx, { replay: true }));
      expect([run, rw]).toEqual([run, og]);
      seen.set(String(og), (seen.get(String(og)) ?? 0) + 1);
    }
    expect(seen.get("J_HISTORY_SIGNED_LOCK_REORG") ?? 0).toBeGreaterThan(30);
    expect(seen.get("null") ?? 0).toBeGreaterThan(30);
  });
});
