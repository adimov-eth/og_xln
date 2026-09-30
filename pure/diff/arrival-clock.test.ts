// R-CLOCK finding 3: "the receiver's own clock". A Runtime's clock, which is the `now` of every local deadline guard,
// rises to the highest stamp a delivered input carries (og: max(previous, ingress seed)), and `convertOutput` puts the
// sender's clock on the wire input. The Host therefore stamps every input that arrived from the network with its own
// clock (`stampArrival`) before the Runtime sees it; a peer's stamp never moves the receiver's clock.
import { describe, expect, test } from "bun:test";
import { ALICE, BOB, CAROL, NOW, unwrap } from "../xln_run.ts";
import { applyRuntime, stampArrival, type RoutedEntityInput } from "../xln.ts";
import { DAY, context, credit, inputOf, network } from "./hub-network.ts";
import { runtimeOf, step } from "./two-runtimes.ts";

const T = NOW + 2000n;
/** What a hostile hub's frame carries on the wire to Alice: the hub's own clock, a day ahead. */
const hostileArrival = (): RoutedEntityInput => {
  const sent = step(context, network(), inputOf(BOB, [credit(ALICE, 5000n)], T + DAY));
  if (!sent.ok) throw new Error(`the hub's frame was refused: ${JSON.stringify(sent.error)}`);
  const toAlice = sent.routed.find((r) => r.entityId === ALICE);
  if (toAlice === undefined) throw new Error("the hub sent nothing to Alice");
  return toAlice;
};
const stampOf = (i: RoutedEntityInput): bigint => (i.input.kind === "txs" ? i.input.timestamp : -1n);
/** Alice's Runtime clock after the input arrives. */
const clockAfter = (arrived: RoutedEntityInput): bigint =>
  unwrap(applyRuntime(runtimeOf(network(), ALICE), { runtimeTxs: [], entityInputs: [arrived] }, context() as never)).runtime.timestamp;

describe("an input from the network is stamped with the receiver's clock", () => {
  test("on the wire it carries the sender's clock, and delivered as it is, it moves the receiver's clock", () => {
    const wire = hostileArrival();
    expect(stampOf(wire)).toBe(T + DAY);
    expect(clockAfter(wire)).toBe(T + DAY);
  });

  test("stamped on arrival, it carries the receiver's clock and leaves it where it was", () => {
    const arrived = stampArrival(hostileArrival(), T);
    expect(stampOf(arrived)).toBe(T);
    expect(clockAfter(arrived)).toBe(T);
  });

  test("only the stamp changes: the receiver, the sender and the payload stay", () => {
    const wire = hostileArrival();
    const arrived = stampArrival(wire, T);
    expect(arrived.entityId).toBe(wire.entityId);
    expect(arrived.from).toBe(wire.from);
    expect(arrived.signerId).toBe(wire.signerId);
    expect(arrived.input.kind === "txs" && wire.input.kind === "txs" ? arrived.input.txs : null)
      .toEqual(wire.input.kind === "txs" ? wire.input.txs : undefined);
  });

  test("an input that seeds no clock passes through", () => {
    const precommit: RoutedEntityInput = {
      entityId: CAROL, signerId: hostileArrival().signerId,
      input: { kind: "precommit", height: 1n, frameHash: `0x${"00".repeat(32)}`, signatures: new Map() } as never,
    };
    expect(stampArrival(precommit, T)).toEqual(precommit);
  });
});
