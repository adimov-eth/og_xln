// R-CLOCK: a frame's timestamp carries no authority. No frame is refused for its age or its future date, and every
// time-based decision reads the deciding party's own clock plus a named reserve (review/r-clock-report-2026-09-29.md).
// The two Entities here run on clocks that differ by more than the 30 s network allowance og refuses a frame for.
import { describe, expect, test } from "bun:test";
import { x25519 } from "@noble/curves/ed25519";
import { ALICE, BOB, NOW, TERMS, UNREGISTERED_J, aliceAddr, bobAddr, genesisAB, unwrap, verifiers, withTestJurisdiction } from "../xln_run.ts";
import { hashHtlcSecret } from "../../core/protocol/htlc/utils.ts";
import {
  HTLC_ENFORCEMENT_RESERVE_MS, MAX_LOCK_HORIZON_BLOCKS, MAX_LOCK_HORIZON_MS, createEntity,
  createRuntime, incomingDeadline, replicaKey, spawn, tokenId,
  type AccountFrame, type Address, type EntityId, type EntityReplica, type EntityTx, type RoutedEntityInput, type Runtime,
  type WireAccountTx,
} from "../xln.ts";
import { FUTURE_FRAME } from "./departures.ts";
import { allAt, arrivesAt, runtimeOf, settle, step, type Clocks, type World } from "./two-runtimes.ts";

const JUR = TERMS.domain;
const ENTITY_KEYS = new Map([ALICE, BOB].map((id, i) => {
  const priv = new Uint8Array(32).fill(i + 7);
  return [id, { priv: "0x" + Buffer.from(priv).toString("hex"), pub: "0x" + Buffer.from(x25519.getPublicKey(priv)).toString("hex") }] as const;
}));
const SIGNERS = new Map<EntityId, Address>([[ALICE, aliceAddr], [BOB, bobAddr]]);
const entityOf = (id: EntityId) => unwrap(createEntity({
  id, jurisdiction: JUR, threshold: 1n, members: new Map([[SIGNERS.get(id)!, { shares: 1n }]]),
  committed: { entityEncryptionPublicKey: ENTITY_KEYS.get(id)!.pub }, jurisdictionConfig: UNREGISTERED_J,
}));
const context = () => ({ ...verifiers, htlcInfra: (id: EntityId) => ({ profiles: [], online: () => true, encryptionPrivateKey: ENTITY_KEYS.get(id)!.priv }) });
const inputOf = (id: EntityId, txs: EntityTx[], timestamp: bigint): RoutedEntityInput =>
  ({ entityId: id, signerId: SIGNERS.get(id)!, input: { kind: "txs", timestamp, txs } });
const open = (to: EntityId): EntityTx => ({
  type: "openAccount",
  data: { targetEntityId: to, accountDomain: { ...TERMS.domain }, watchSeed: TERMS.watchSeed, disputeConfig: { ...TERMS.disputeConfig } },
} as EntityTx);
const credit = (to: EntityId, amount: bigint): EntityTx =>
  ({ type: "extendCredit", data: { counterpartyEntityId: to, tokenId: unwrap(tokenId("1")), amount } });
const replicaOf = (rt: Runtime, id: EntityId): EntityReplica => rt.entities.get(replicaKey(id, SIGNERS.get(id)!))!;

const at = (t: bigint): Clocks => allAt([ALICE, BOB], t);
const network = (): World =>
  settle(
    context,
    {
      runtimes: new Map([["a", spawn(withTestJurisdiction(createRuntime()), entityOf(ALICE))], ["b", spawn(withTestJurisdiction(createRuntime()), entityOf(BOB))]]),
      home: new Map([[ALICE, "a"], [BOB, "b"]]),
    },
    [inputOf(BOB, [open(ALICE)], NOW)], at(NOW),
  ).world;
const replicaIn = (w: World, id: EntityId): EntityReplica => replicaOf(runtimeOf(w, id), id);
const headHeight = (w: World, id: EntityId, peer: EntityId): bigint =>
  (replicaIn(w, id).accountReplicas.get(peer) as unknown as { head: { height: bigint } }).head.height;
const accountTag = (w: World, id: EntityId, peer: EntityId): string => replicaIn(w, id).accountReplicas.get(peer)!._tag;

/** Alice's clock runs `aheadMs` in front of Bob's; Alice extends Bob credit and the frame goes to Bob. */
const aliceAhead = (aheadMs: bigint) => {
  const start = network();
  const clocks: Clocks = new Map([[ALICE, NOW + 1000n + aheadMs], [BOB, NOW + 1000n]]);
  const proposed = step(context, start, inputOf(ALICE, [credit(BOB, 5n)], clocks.get(ALICE)!));
  if (!proposed.ok) throw new Error("Alice's own proposal was refused");
  return { before: headHeight(start, ALICE, BOB), after: settle(context, proposed.world, proposed.routed.map((r) => arrivesAt(clocks, r)), clocks) };
};

describe("clock authority: a frame is not refused for its date", () => {
  test("the reserve every deadline check keeps is a named 30 s", () => {
    expect(HTLC_ENFORCEMENT_RESERVE_MS).toBe(30_000n);
  });

  test("a peer 31 s ahead: Bob accepts the frame and the Account advances on both sides", () => {
    const { before, after } = aliceAhead(31_000n);
    expect(after.refused).toEqual([]);
    expect(headHeight(after.world, BOB, ALICE)).toBe(before + 1n);
    expect(headHeight(after.world, ALICE, BOB)).toBe(before + 1n);
    expect(accountTag(after.world, ALICE, BOB)).toBe("open");
  });

  test("a peer an hour ahead: still accepted", () => {
    const { before, after } = aliceAhead(3_600_000n);
    expect(after.refused).toEqual([]);
    expect(headHeight(after.world, BOB, ALICE)).toBe(before + 1n);
  });

  test("a peer inside the allowance is accepted (control)", () => {
    const { before, after } = aliceAhead(29_000n);
    expect(after.refused).toEqual([]);
    expect(headHeight(after.world, BOB, ALICE)).toBe(before + 1n);
  });
});

/** The receiver's own clock decides a lock's horizon, whatever the frame that carries it says. */
describe("clock authority: the lock horizon is checked on the receiver's clock", () => {
  const NOW_MS = 1_000_000_000_000n;
  const FIN = 100n;
  const SECRET_HASH = hashHtlcSecret("0x" + "5a".repeat(32));
  const T1 = unwrap(tokenId("1"));
  /** A frame from the right party that carries one new lock, stamped `frameTs`. */
  const verdict = (lock: { timelock: bigint; revealBeforeHeight: bigint }, frameTs: bigint) => {
    const tx: WireAccountTx = { type: "htlc_lock", lockId: "L", hashlock: SECRET_HASH, amount: 1n, tokenId: T1, ...lock };
    const frame: AccountFrame = {
      timestamp: frameTs, jHeight: FIN, height: 2n, txs: [tx],
      prevFrameHash: "0x" + "00".repeat(32), accountStateRoot: "0x" + "00".repeat(32), stateHash: "0x" + "00".repeat(32),
    };
    const r = incomingDeadline(genesisAB().state, frame, true, { now: NOW_MS, finalizedJHeight: FIN });
    return r.ok ? "accepted" : r.error.error.reason;
  };
  const inside = { timelock: NOW_MS + BigInt(MAX_LOCK_HORIZON_MS), revealBeforeHeight: FIN + BigInt(MAX_LOCK_HORIZON_BLOCKS) };
  const DAY = 86_400_000n;

  test("a lock exactly at the horizon is accepted", () => {
    expect(verdict(inside, NOW_MS)).toBe("accepted");
  });

  test("one ms past the time horizon is refused, with a frame stamp that makes it look near", () => {
    const far = { ...inside, timelock: inside.timelock + 1n };
    expect(verdict(far, NOW_MS - 30n * DAY)).toBe("lock_horizon");
    expect(verdict(far, NOW_MS)).toBe("lock_horizon");
  });

  test("one block past the height horizon is refused", () => {
    expect(verdict({ ...inside, revealBeforeHeight: inside.revealBeforeHeight + 1n }, NOW_MS - 30n * DAY)).toBe("lock_horizon");
  });

  test("a frame stamped ahead cannot make a far lock look near: the horizon is the receiver's, not the frame's", () => {
    const stampedAhead = NOW_MS + 30n * DAY;
    const nearTheStamp = { timelock: stampedAhead + 3_600_000n, revealBeforeHeight: FIN + 50n };
    expect(verdict(nearTheStamp, stampedAhead)).toBe("lock_horizon");
  });

  test("a lock inside the reserve stays a lock_window refusal, whatever the frame says", () => {
    const soon = { timelock: NOW_MS + HTLC_ENFORCEMENT_RESERVE_MS, revealBeforeHeight: FIN + 50n };
    expect(verdict(soon, NOW_MS - 30n * DAY)).toBe("lock_window");
    expect(verdict(soon, NOW_MS + 30n * DAY)).toBe("lock_window");
  });
});

/** The one place the rewrite accepts what og refuses for a date (departures.ts). */
describe("clock authority: the departure from og's future-frame refusal", () => {
  test("og refuses a frame more than 30 s ahead of its receiver; the departure names exactly that", () => {
    expect([0n, 29_999n, 30_000n].map((skew) => FUTURE_FRAME.ogRefuses(skew))).toEqual([false, false, false]);
    expect([30_001n, 90_000n, 3_600_000n].map((skew) => FUTURE_FRAME.ogRefuses(skew))).toEqual([true, true, true]);
  });
});
