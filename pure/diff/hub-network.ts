// The hub network the two-Runtime clock tests share: Alice pays Carol through the hub Bob; Alice lives on one Runtime
// (and clock), Bob and Carol on another.
import { x25519 } from "@noble/curves/ed25519";
import { withDeterministicHtlcTestSecret } from "../../core/protocol/htlc/test-secret-capability.ts";
import * as ogAdmission from "../../core/entity/paybook/payment-admission.ts";
import { ALICE, BOB, CAROL, NOW, TERMS, UNREGISTERED_J, aliceAddr, bobAddr, carolAddr, unwrap, verifiers, withTestJurisdiction } from "../xln_run.ts";
import {
  createEntity, createRuntime, replicaKey, spawn, tokenId,
  type Address, type Binary, type EntityId, type EntityReplica, type EntityTx, type RoutedEntityInput,
} from "../xln.ts";
import { allAt, runtimeOf, settle, type World } from "./two-runtimes.ts";

const JUR = TERMS.domain;
export const SECRET = "0x" + "42".repeat(32);
export const DAY = 86_400_000n;
const KEYS = new Map([ALICE, BOB, CAROL].map((id, i) => {
  const priv = new Uint8Array(32).fill(i + 7);
  return [id, { priv: "0x" + Buffer.from(priv).toString("hex"), pub: "0x" + Buffer.from(x25519.getPublicKey(priv)).toString("hex") }] as const;
}));
const SIGNERS = new Map<EntityId, Address>([[ALICE, aliceAddr], [BOB, bobAddr], [CAROL, carolAddr]]);
export const entityOf = (id: EntityId) => unwrap(createEntity({
  id, jurisdiction: JUR, threshold: 1n, members: new Map([[SIGNERS.get(id)!, { shares: 1n }]]),
  committed: { entityEncryptionPublicKey: KEYS.get(id)!.pub }, jurisdictionConfig: UNREGISTERED_J,
}));
export const profile = (id: EntityId, accounts: readonly object[], meta: object = {}): Binary =>
  ({ entityId: id, entityEncryptionPublicKey: KEYS.get(id)!.pub, name: id.slice(-4), metadata: { isHub: false, routingFeePPM: 100, baseFee: 0n, ...meta }, accounts }) as unknown as Binary;
const caps = (inC: bigint, outC: bigint) => new Map([[1, { inCapacity: inC, outCapacity: outC }]]);
export const profiles = (): Binary[] => [
  profile(ALICE, []),
  profile(BOB, [{ counterpartyId: ALICE, domain: JUR, tokenCapacities: caps(1000n, 0n) }, { counterpartyId: CAROL, domain: JUR, tokenCapacities: caps(0n, 1000n) }], { routingFeePPM: 5000, baseFee: 1n }),
  profile(CAROL, []),
];
export const payment = (): EntityTx => withDeterministicHtlcTestSecret({
  type: "htlcPayment",
  data: { targetEntityId: CAROL, tokenId: 1, amount: 100n, maxSenderDebit: 200n, route: [ALICE, BOB, CAROL], deliveryMode: "instant" },
}, SECRET) as unknown as EntityTx;
export const context = () => {
  const hashlock = ogAdmission.hashRawHtlcPaymentTx(payment() as never);
  return {
    ...verifiers,
    htlcInfra: (id: EntityId) => ({
      profiles: profiles(), online: () => true, encryptionPrivateKey: KEYS.get(id)!.priv,
      ...(id === ALICE ? { secretFor: (h: string) => (h === hashlock ? SECRET : undefined) } : {}),
    }),
  };
};
export const inputOf = (id: EntityId, txs: EntityTx[], timestamp: bigint): RoutedEntityInput =>
  ({ entityId: id, signerId: SIGNERS.get(id)!, input: { kind: "txs", timestamp, txs } });
export const open = (to: EntityId, creditAmount?: bigint): EntityTx => ({
  type: "openAccount",
  data: { targetEntityId: to, accountDomain: { ...TERMS.domain }, watchSeed: TERMS.watchSeed, disputeConfig: { ...TERMS.disputeConfig }, ...(creditAmount === undefined ? {} : { creditAmount, tokenId: unwrap(tokenId("1")) }) },
} as EntityTx);
export const credit = (to: EntityId, amount: bigint): EntityTx =>
  ({ type: "extendCredit", data: { counterpartyEntityId: to, tokenId: unwrap(tokenId("1")), amount } });
export const replicaIn = (w: World, id: EntityId): EntityReplica => runtimeOf(w, id).entities.get(replicaKey(id, SIGNERS.get(id)!))!;
export type AccountView = {
  readonly _tag: string;
  readonly head: { readonly height: bigint; readonly timestamp: bigint };
  readonly state: { readonly locks: ReadonlyMap<string, unknown>; readonly account: { readonly id: { readonly left: string } } };
};
export const accountOf = (w: World, id: EntityId, peer: EntityId): AccountView =>
  replicaIn(w, id).accountReplicas.get(peer) as unknown as AccountView;
/** Alice on her own Runtime and clock; the hub Bob and Carol on another, honest, one. */
export const spawned = (): World => ({
  runtimes: new Map([
    ["alice", spawn(withTestJurisdiction(createRuntime()), entityOf(ALICE))],
    ["hub", spawn(spawn(withTestJurisdiction(createRuntime()), entityOf(BOB)), entityOf(CAROL))],
  ]),
  home: new Map([[ALICE, "alice"], [BOB, "hub"], [CAROL, "hub"]]),
});
export const SETUP = allAt([ALICE, BOB, CAROL], NOW);
export const network = (): World => {
  const opened = settle(context, spawned(), [inputOf(BOB, [open(ALICE, 1000n), open(CAROL)], NOW)], SETUP).world;
  return settle(context, opened, [inputOf(CAROL, [credit(BOB, 1000n)], NOW + 100n)], SETUP).world;
};
export const fromCarolToBob = (i: RoutedEntityInput): boolean => i.entityId === BOB && i.from === CAROL;
