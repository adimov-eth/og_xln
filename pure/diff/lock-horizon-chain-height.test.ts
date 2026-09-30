// The receiver's lock horizon (R-CLOCK, incomingDeadline) is measured from the receiver's own J height. On a real chain
// that is the Entity's finalized height (og securityContext.finalizedJHeight = entityClock.finalizedJHeight); the Account's
// own finalizedJHeight only moves when both sides claim a J event for it and is still 0 on a fresh Account. Measured from
// that, a lock ending at chain height + a few blocks lies "beyond the horizon" as soon as the chain passes
// MAX_LOCK_HORIZON_BLOCKS, and every lock is refused. Alice pays Carol through Bob on a chain at block 500000.
import { describe, expect, test } from "bun:test";
import { x25519 } from "@noble/curves/ed25519";
import { withDeterministicHtlcTestSecret } from "../../core/protocol/htlc/test-secret-capability.ts";
import * as ogAdmission from "../../core/entity/paybook/payment-admission.ts";
import { ALICE, BOB, CAROL, NOW, TERMS, UNREGISTERED_J, aliceAddr, bobAddr, carolAddr, unwrap, verifiers, withTestJurisdiction } from "../xln_run.ts";
import {
  MAX_LOCK_HORIZON_BLOCKS, createEntity, createRuntime, replicaKey, spawn, tokenId,
  type Address, type Binary, type EntityId, type EntityReplica, type EntityTx, type RoutedEntityInput,
} from "../xln.ts";
import { allAt, arrivesAt, runtimeOf, settle, step, type Clocks, type World } from "./two-runtimes.ts";

const JUR = TERMS.domain;
const SECRET = "0x" + "42".repeat(32);
const KEYS = new Map([ALICE, BOB, CAROL].map((id, i) => {
  const priv = new Uint8Array(32).fill(i + 7);
  return [id, { priv: "0x" + Buffer.from(priv).toString("hex"), pub: "0x" + Buffer.from(x25519.getPublicKey(priv)).toString("hex") }] as const;
}));
const SIGNERS = new Map<EntityId, Address>([[ALICE, aliceAddr], [BOB, bobAddr], [CAROL, carolAddr]]);
/** The Entities sit at chain height `H`; no Account has seen a J event, so each Account's own finalized height is 0. */
const entityOf = (H: number) => (id: EntityId) => {
  const e: any = unwrap(createEntity({
    id, jurisdiction: JUR, threshold: 1n, members: new Map([[SIGNERS.get(id)!, { shares: 1n }]]),
    committed: { entityEncryptionPublicKey: KEYS.get(id)!.pub }, jurisdictionConfig: UNREGISTERED_J,
  }));
  return { ...e, state: { ...e.state, jFinality: { ...e.state.jFinality, height: H } } };
};
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
  readonly state: { readonly locks: ReadonlyMap<string, unknown>; readonly account: { readonly deltas: ReadonlyMap<unknown, { readonly offdelta: bigint }> } };
};
const accountOf = (w: World, id: EntityId, peer: EntityId): AccountView =>
  replicaIn(w, id).accountReplicas.get(peer) as unknown as AccountView;
/** Alice on her own Runtime and clock; the hub Bob and Carol on another one. */
const spawned = (H: number): World => ({
  runtimes: new Map([
    ["alice", spawn(withTestJurisdiction(createRuntime()), entityOf(H)(ALICE))],
    ["hub", spawn(spawn(withTestJurisdiction(createRuntime()), entityOf(H)(BOB)), entityOf(H)(CAROL))],
  ]),
  home: new Map([[ALICE, "alice"], [BOB, "hub"], [CAROL, "hub"]]),
});
const SETUP = allAt([ALICE, BOB, CAROL], NOW);
const network = (H: number): World => {
  const opened = settle(context, spawned(H), [inputOf(BOB, [open(ALICE, 1000n), open(CAROL)], NOW)], SETUP).world;
  return settle(context, opened, [inputOf(CAROL, [credit(BOB, 1000n)], NOW + 100n)], SETUP).world;
};
/** Alice pays Carol through the hub Bob on a chain at height `H`; every delivery is stamped with its receiver's clock. */
const pay = (H: number) => {
  const T = NOW + 2000n;
  const paying = step(context, network(H), inputOf(ALICE, [payment()], T));
  if (!paying.ok) throw new Error(`Alice's payment was refused: ${JSON.stringify(paying.error)}`);
  const clocks: Clocks = new Map([[ALICE, T], [BOB, T], [CAROL, T]]);
  const settled = settle(context, paying.world, paying.routed.map((r) => arrivesAt(clocks, r)), clocks);
  return { refused: settled.refused, world: settled.world };
};
const offdelta = (w: World, id: EntityId, peer: EntityId): bigint =>
  [...accountOf(w, id, peer).state.account.deltas.values()][0]!.offdelta;

describe("lock horizon on a real chain height: the receiver measures it from its Entity's finalized J height", () => {
  // The Account's own finalizedJHeight moves only when both sides claim a J event for it, so it is 0 on a fresh Account.
  // Measured from that, a lock ending at chain height + a few blocks lies beyond the horizon once the chain passes
  // MAX_LOCK_HORIZON_BLOCKS and every honest lock is refused (found by the #57 reviewer). A payment must complete at
  // every chain height: the two ends of the reveal (the hub's lock and its resolve) both cross the receiver's scan.
  const HEIGHTS = [0, 1_000, MAX_LOCK_HORIZON_BLOCKS - 100, MAX_LOCK_HORIZON_BLOCKS + 100, 500_000, 20_000_000];

  for (const H of HEIGHTS) {
    test(`chain at block ${H}: Alice's payment through the hub completes, no lock is left and both Accounts moved`, () => {
      const r = pay(H);
      expect(r.refused).toEqual([]);
      expect(accountOf(r.world, BOB, ALICE).state.locks.size).toBe(0);
      expect(accountOf(r.world, BOB, CAROL).state.locks.size).toBe(0);
      expect(offdelta(r.world, BOB, ALICE)).not.toBe(0n);
      expect(offdelta(r.world, BOB, CAROL)).not.toBe(0n);
    });
  }
});
