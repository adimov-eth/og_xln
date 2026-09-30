// R-CLOCK attack: the payer proposes a frame stamped well past a lock's deadline. A proposer never mints a frame behind
// its Account's committed watermark (og admission.ts), so every frame after it carries that stamp; if "expired by the
// co-signed clock" then blocks the payee's secret resolve, the payer takes the lock back early (found by the first
// #44 reviewer). Alice pays Carol through the hub Bob. Carol's reveal is in transit when Alice, whose clock and
// stamps are hostile, proposes a frame a day ahead that Bob co-signs; Bob, whose clock is honest and who then holds the
// secret, must still be paid.
import { describe, expect, test } from "bun:test";
import { x25519 } from "@noble/curves/ed25519";
import { withDeterministicHtlcTestSecret } from "../../core/protocol/htlc/test-secret-capability.ts";
import * as ogAdmission from "../../core/entity/paybook/payment-admission.ts";
import { ALICE, BOB, CAROL, NOW, TERMS, UNREGISTERED_J, aliceAddr, bobAddr, carolAddr, genesisAB, unwrap, verifiers, withTestJurisdiction } from "../xln_run.ts";
import { hashHtlcSecret } from "../../core/protocol/htlc/utils.ts";
import {
  MAX_LOCK_HORIZON_BLOCKS, createEntity, createRuntime, incomingDeadline, replicaKey, spawn, tokenId,
  type AccountBody, type AccountFrame, type Address, type Binary, type EntityId, type EntityReplica, type EntityTx,
  type HtlcLock, type RoutedEntityInput, type WireAccountTx,
} from "../xln.ts";
import { allAt, runtimeOf, settle, step, type Clocks, type World } from "./two-runtimes.ts";

const JUR = TERMS.domain;
const SECRET = "0x" + "42".repeat(32);
const DAY = 86_400_000n;
const KEYS = new Map([ALICE, BOB, CAROL].map((id, i) => {
  const priv = new Uint8Array(32).fill(i + 7);
  return [id, { priv: "0x" + Buffer.from(priv).toString("hex"), pub: "0x" + Buffer.from(x25519.getPublicKey(priv)).toString("hex") }] as const;
}));
const SIGNERS = new Map<EntityId, Address>([[ALICE, aliceAddr], [BOB, bobAddr], [CAROL, carolAddr]]);
const entityOf = (id: EntityId) => unwrap(createEntity({
  id, jurisdiction: JUR, threshold: 1n, members: new Map([[SIGNERS.get(id)!, { shares: 1n }]]),
  committed: { entityEncryptionPublicKey: KEYS.get(id)!.pub }, jurisdictionConfig: UNREGISTERED_J,
}));
const profile = (id: EntityId, accounts: readonly object[], meta: object = {}): Binary =>
  ({ entityId: id, entityEncryptionPublicKey: KEYS.get(id)!.pub, name: id.slice(-4), metadata: { isHub: false, routingFeePPM: 100, baseFee: 0n, ...meta }, accounts }) as unknown as Binary;
const caps = (inC: bigint, outC: bigint) => new Map([[1, { inCapacity: inC, outCapacity: outC }]]);
const profiles = (): Binary[] => [
  profile(ALICE, []),
  profile(BOB, [{ counterpartyId: ALICE, domain: JUR, tokenCapacities: caps(1000n, 0n) }, { counterpartyId: CAROL, domain: JUR, tokenCapacities: caps(0n, 1000n) }], { routingFeePPM: 5000, baseFee: 1n }),
  profile(CAROL, []),
];
const payment = (): EntityTx => withDeterministicHtlcTestSecret({
  type: "htlcPayment",
  data: { targetEntityId: CAROL, tokenId: 1, amount: 100n, maxSenderDebit: 200n, route: [ALICE, BOB, CAROL], deliveryMode: "instant" },
}, SECRET) as unknown as EntityTx;
const context = () => {
  const hashlock = ogAdmission.hashRawHtlcPaymentTx(payment() as never);
  return {
    ...verifiers,
    htlcInfra: (id: EntityId) => ({
      profiles: profiles(), online: () => true, encryptionPrivateKey: KEYS.get(id)!.priv,
      ...(id === ALICE ? { secretFor: (h: string) => (h === hashlock ? SECRET : undefined) } : {}),
    }),
  };
};
const inputOf = (id: EntityId, txs: EntityTx[], timestamp: bigint): RoutedEntityInput =>
  ({ entityId: id, signerId: SIGNERS.get(id)!, input: { kind: "txs", timestamp, txs } });
const open = (to: EntityId, creditAmount?: bigint): EntityTx => ({
  type: "openAccount",
  data: { targetEntityId: to, accountDomain: { ...TERMS.domain }, watchSeed: TERMS.watchSeed, disputeConfig: { ...TERMS.disputeConfig }, ...(creditAmount === undefined ? {} : { creditAmount, tokenId: unwrap(tokenId("1")) }) },
} as EntityTx);
const credit = (to: EntityId, amount: bigint): EntityTx =>
  ({ type: "extendCredit", data: { counterpartyEntityId: to, tokenId: unwrap(tokenId("1")), amount } });
const replicaIn = (w: World, id: EntityId): EntityReplica => runtimeOf(w, id).entities.get(replicaKey(id, SIGNERS.get(id)!))!;
type AccountView = {
  readonly _tag: string;
  readonly head: { readonly height: bigint; readonly timestamp: bigint };
  readonly state: { readonly locks: ReadonlyMap<string, unknown>; readonly account: { readonly deltas: ReadonlyMap<unknown, { readonly offdelta: bigint }> } };
};
const accountOf = (w: World, id: EntityId, peer: EntityId): AccountView =>
  replicaIn(w, id).accountReplicas.get(peer) as unknown as AccountView;
const offdelta = (w: World, id: EntityId, peer: EntityId): bigint =>
  [...accountOf(w, id, peer).state.account.deltas.values()][0]!.offdelta;

/** Alice on her own Runtime and clock; the hub Bob and Carol on another, honest, one. */
const spawned = (): World => ({
  runtimes: new Map([
    ["alice", spawn(withTestJurisdiction(createRuntime()), entityOf(ALICE))],
    ["hub", spawn(spawn(withTestJurisdiction(createRuntime()), entityOf(BOB)), entityOf(CAROL))],
  ]),
  home: new Map([[ALICE, "alice"], [BOB, "hub"], [CAROL, "hub"]]),
});
const SETUP = allAt([ALICE, BOB, CAROL], NOW);
const network = (): World => {
  const opened = settle(context, spawned(), [inputOf(BOB, [open(ALICE, 1000n), open(CAROL)], NOW)], SETUP).world;
  return settle(context, opened, [inputOf(CAROL, [credit(BOB, 1000n)], NOW + 100n)], SETUP).world;
};
const fromCarolToBob = (i: RoutedEntityInput): boolean => i.entityId === BOB && i.from === CAROL;

describe("clock attack: a future-stamped frame must not let the payer take a lock back from a payee who holds the secret", () => {
  /**
   * Alice pays Carol through Bob. Carol's answer to Bob's lock (her ack, with the secret) stays in transit. Alice then
   * proposes a frame stamped `aheadMs` past the lock's deadline; Bob, on an honest clock a few seconds after the
   * payment, co-signs it. Then Carol's answer reaches Bob, who now holds the secret and resolves the lock with Alice.
   */
  const attack = (aheadMs: bigint) => {
    const T = NOW + 2000n;
    const start = network();
    const paying = step(context, start, inputOf(ALICE, [payment()], T));
    if (!paying.ok) throw new Error(`Alice's payment was refused: ${JSON.stringify(paying.error)}`);
    const honest: Clocks = new Map([[ALICE, T], [BOB, T], [CAROL, T]]);
    const inFlight = settle(context, paying.world, paying.routed.map((r) => ({ ...r })), honest, fromCarolToBob);
    const locked = accountOf(inFlight.world, BOB, ALICE).state.locks.size;
    // Alice's clock is hostile: a frame stamped far ahead of the lock's deadline, for an unrelated credit line
    const hostile = new Map<EntityId, bigint>([[ALICE, T + aheadMs], [BOB, T + 1000n], [CAROL, T + 1000n]]);
    const poisoned = step(context, inFlight.world, inputOf(ALICE, [credit(BOB, 5n)], T + aheadMs));
    if (!poisoned.ok) throw new Error(`Alice's own frame was refused: ${JSON.stringify(poisoned.error)}`);
    const cosigned = settle(context, poisoned.world, poisoned.routed, hostile, fromCarolToBob);
    const watermark = accountOf(cosigned.world, BOB, ALICE).head.timestamp;
    // Carol's answer reaches Bob at Bob's honest clock; nothing else moves
    const delivered = settle(context, cosigned.world, inFlight.held.map((h) => ({ ...h })), hostile, () => false);
    const settled = settle(context, delivered.world, [], hostile);
    return { locked, watermark, world: settled.world, refused: [...poisoned.routed.length === 0 ? ["no frame"] : [], ...cosigned.refused, ...delivered.refused] };
  };

  test("control: a frame a second ahead, the held answer arrives late, Bob is paid", () => {
    const r = attack(1000n);
    expect(r.locked).toBe(1);
    expect(r.refused).toEqual([]);
    expect(accountOf(r.world, BOB, ALICE).state.locks.size).toBe(0);
    expect(offdelta(r.world, BOB, ALICE)).not.toBe(0n);
  });

  test("a payer's frame stamped a day ahead: the watermark moves past the deadline and Bob is still paid", () => {
    const r = attack(DAY);
    expect(r.locked).toBe(1);
    expect(r.refused).toEqual([]);
    expect(r.watermark).toBeGreaterThan(NOW + 2000n + DAY / 2n);
    expect(accountOf(r.world, BOB, ALICE).state.locks.size).toBe(0);
    expect(offdelta(r.world, BOB, ALICE)).not.toBe(0n);
  });
});

/** What the same rule says about one frame, without a network: the payee's secret meets a frame stamp it did not choose. */
describe("clock attack: a secret resolve is late only by J height, whatever the frame's stamp says", () => {
  const NOW_MS = 1_000_000_000_000n;
  const FIN = 100n;
  const SECRET_HASH = hashHtlcSecret(SECRET)!;
  const T1 = unwrap(tokenId("1"));
  const lock: HtlcLock = {
    lockId: SECRET_HASH, hashlock: SECRET_HASH, timelock: NOW_MS + 600_000n, revealBeforeHeight: FIN + 50n, amount: 1n,
    tokenId: T1, senderIsLeft: true, createdHeight: 1n, createdTimestamp: NOW_MS,
  };
  const held = (): AccountBody => ({ ...genesisAB().state, locks: new Map([[lock.lockId, lock]]) });
  /** The payee (the right side) reveals in a frame with the given stamp and J height; our clock is honest. */
  const reveal = (frameTs: bigint, frameJ: bigint, local: { now: bigint; finalizedJHeight: bigint }) => {
    const tx: WireAccountTx = { type: "htlc_resolve", lockId: lock.lockId, outcome: "secret", secret: SECRET };
    const frame: AccountFrame = {
      timestamp: frameTs, jHeight: frameJ, height: 2n, txs: [tx],
      prevFrameHash: "0x" + "00".repeat(32), accountStateRoot: "0x" + "00".repeat(32), stateHash: "0x" + "00".repeat(32),
    };
    const r = incomingDeadline(held(), frame, false, local);
    return r.ok ? "accepted" : r.error.error.reason;
  };
  const honest = { now: NOW_MS, finalizedJHeight: FIN };

  test("a frame stamped a day past the deadline does not expire the secret", () => {
    expect(reveal(NOW_MS + DAY, FIN, honest)).toBe("accepted");
  });

  test("the payee's own clock still guards the payer: past deadline and reserve the reveal is refused as evidence", () => {
    expect(reveal(NOW_MS, FIN, { now: lock.timelock, finalizedJHeight: FIN })).toBe("secret_window");
  });

  test("the J height still ends a secret: a frame past revealBeforeHeight refuses it", () => {
    expect(reveal(NOW_MS, lock.revealBeforeHeight + 1n, honest)).toBe("secret_frame_expired");
    expect(reveal(NOW_MS, lock.revealBeforeHeight, honest)).toBe("accepted");
  });

  test("a J height claimed far ahead only ends the reveal of the party that claims it", () => {
    expect(MAX_LOCK_HORIZON_BLOCKS).toBeGreaterThan(0);
    expect(reveal(NOW_MS, FIN + BigInt(MAX_LOCK_HORIZON_BLOCKS) * 100n, honest)).toBe("secret_frame_expired");
  });
});
