// The Host holds the chain height it has observed and reads its receiver-side deadline scan (the lock horizon among
// them) against it, like the Entity path does through accountDoor. Without one, the door fell back to the Account's own
// finalized J height, which stays at its genesis (0) unless a claim moves it: at a production chain height (500,000
// blocks and up) every honest lock would look like a week past the horizon and be refused.
import { describe, expect, test } from "bun:test";
import { ALICE, BOB, NOW, TEST_DT, TOKEN, ackInput, disputeFor, genesisAB, hankoVerify, offerOf, signAccountFrame, unwrap } from "../xln_run.ts";
import {
  MAX_LOCK_HORIZON_BLOCKS, admit, applyAccountInput, applyHost, genesisHost, hashHtlcSecret, planAccountProposal,
  type AccountReplica, type EntityId, type FrameClock, type Host, type HostTx, type WireAccountTx,
} from "../xln.ts";

const HASHLOCK = hashHtlcSecret(`0x${"5a".repeat(32)}`)!;
const door = (self: EntityId) => ({ verify: hankoVerify, self, now: NOW, deltaTransformer: TEST_DT });
/** The propose input for the plan the replica makes: a frame signed by `self`, with the Account's delta transformer. */
const proposeInput = (r: AccountReplica, self: EntityId, clock: FrameClock): Input => {
  const plan = unwrap(planAccountProposal(r, self, clock, hankoVerify, undefined, TEST_DT));
  if (plan._tag !== "frame") throw new Error(`nothing to propose: ${plan._tag}`);
  const dispute = disputeFor(plan.preview.dispute, self);
  return { kind: "propose", frameHanko: signAccountFrame(plan.preview.frame, self), ...(dispute === undefined ? {} : { disputeHanko: dispute }), ...clock };
};
type Input = Parameters<typeof applyAccountInput>[1];
const step = (r: AccountReplica, input: Input, self: EntityId) => unwrap(applyAccountInput(r, input, door(self)));
/** `proposer` proposes one frame holding `txs`; the peer acknowledges it and the proposer commits: both replicas. */
const round = (
  proposer: AccountReplica, peer: AccountReplica, by: EntityId, other: EntityId, txs: readonly WireAccountTx[], clock: FrameClock,
) => {
  const opened = unwrap(admit(proposer, txs, by));
  const proposed = step(opened, proposeInput(opened, by, clock), by).replica;
  if (proposed._tag !== "proposed") throw new Error(`not proposed: ${proposed._tag}`);
  const received = step(peer, offerOf(proposed, by), other).replica;
  const acked = step(received, ackInput(received, other), other);
  const ack = acked.outputs.find((o) => o.kind === "ack") as Input;
  return { proposer: step(proposed, ack, by).replica, peer: acked.replica };
};
const CLOCK_AT = (jHeight: bigint): FrameClock => ({ timestamp: NOW, jHeight });
const credit = (limit: bigint): WireAccountTx => ({ type: "set_credit_limit", tokenId: TOKEN, limit });
/** Both sides extend credit, so Alice can lock towards Bob: Alice's and Bob's replicas. */
const funded = () => {
  const first = round(genesisAB(), genesisAB(), BOB, ALICE, [credit(1000n)], CLOCK_AT(0n));
  const second = round(first.peer, first.proposer, ALICE, BOB, [credit(1000n)], CLOCK_AT(0n));
  return { alice: second.proposer, bob: second.peer };
};
const lock = (revealBeforeHeight: bigint): WireAccountTx => ({
  type: "htlc_lock", lockId: HASHLOCK, hashlock: HASHLOCK, timelock: NOW + 120_000n, revealBeforeHeight, amount: 5n, tokenId: TOKEN,
});
/** Bob's Host, having observed the chain at `observed` (in the given order), receives Alice's frame carrying the lock. */
const delivered = (observed: readonly number[], frameHeight: bigint, revealBeforeHeight: bigint) => {
  const { alice, bob } = funded();
  const opened = unwrap(admit(alice, [lock(revealBeforeHeight)], ALICE));
  const proposed = step(opened, proposeInput(opened, ALICE, CLOCK_AT(frameHeight)), ALICE).replica;
  if (proposed._tag !== "proposed") throw new Error(`not proposed: ${proposed._tag}`);
  const ctx = { timestamp: NOW, jHeight: 0n };
  const seen = observed.reduce((host: Host, blockNumber): Host => {
    const tx: HostTx = { layer: "j", tx: { type: "j_event", blockNumber, event: { type: "ReserveUpdated", entity: BOB, tokenId: 1n, newBalance: 1n } } };
    return unwrap(applyHost(host, tx, ctx, hankoVerify)).state;
  }, { ...unwrap(genesisHost(BOB, bob)), deltaTransformer: TEST_DT });
  return applyHost(seen, { layer: "frame", input: offerOf(proposed, ALICE) }, { ...ctx, from: ALICE }, hankoVerify);
};
const verdict = (r: ReturnType<typeof delivered>): string =>
  r.ok ? r.value.state.account._tag : r.error._tag === "frame_deadline" ? r.error.reason : r.error._tag;

describe("the Host reads its deadline scan against the chain height it holds", () => {
  test.each([0, 1000, 500_000, 20_000_000])("at chain height %d an honest lock, revealed by 50 blocks on, is received", (height) => {
    const observed = height === 0 ? [] : [height];
    expect(verdict(delivered(observed, BigInt(height), BigInt(height) + 50n))).toBe("received");
  });

  test("the horizon still holds at that height: a proposer claiming a far J height to reach past it is refused", () => {
    const claimed = 2_000_000n;
    expect(claimed).toBeGreaterThan(500_000n + BigInt(MAX_LOCK_HORIZON_BLOCKS));
    expect(verdict(delivered([500_000], claimed, claimed + 50n))).toBe("lock_horizon");
  });

  test("the height never runs backwards: an older block observed later leaves the Host where it was", () => {
    expect(verdict(delivered([500_000, 10], 500_000n, 500_050n))).toBe("received");
  });
});
