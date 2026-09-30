// R-CLOCK finding 3: "the receiver's own clock". A Runtime's clock, which is the `now` of every local deadline guard,
// and `convertOutput` puts the sender's clock on the wire input. The Runtime therefore never takes a clock from an input
// that arrived from a peer (`from` set): the frame's clock is its own, raised only by the Host's `timestamp` on the
// frame or by a local input's stamp (og: max(previous, ingress seed)). The Host is not trusted to strip the stamp.
import { describe, expect, test } from "bun:test";
import { ALICE, BOB, NOW, unwrap } from "../xln_run.ts";
import { applyRuntime, type RoutedEntityInput, type RuntimeInput } from "../xln.ts";
import { DAY, context, credit, inputOf, network, replicaIn } from "./hub-network.ts";
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
/** Alice's world after one Runtime frame with these inputs (and the Host's own clock, when it gives one). */
const frame = (entityInputs: readonly RoutedEntityInput[], timestamp?: bigint) => {
  const input: RuntimeInput = { runtimeTxs: [], entityInputs, ...(timestamp === undefined ? {} : { timestamp }) };
  const world = network();
  const out = unwrap(applyRuntime(runtimeOf(world, ALICE), input, context() as never));
  return { clock: out.runtime.timestamp, entityClock: replicaIn({ ...world, runtimes: new Map([["alice", out.runtime]]) }, ALICE).state.timestamp };
};
const before = (): bigint => runtimeOf(network(), ALICE).timestamp;

describe("the Runtime takes no clock from an input that arrived from a peer", () => {
  test("on the wire the input carries the sender's clock and names its sender", () => {
    const wire = hostileArrival();
    expect(stampOf(wire)).toBe(T + DAY);
    expect(wire.from).toBe(BOB);
  });

  test("a frame of peer inputs alone is not run without the Host's clock: it would run at a stale one", () => {
    const out = applyRuntime(runtimeOf(network(), ALICE), { runtimeTxs: [], entityInputs: [hostileArrival()] }, context() as never);
    expect(out.ok).toBe(false);
    expect(out.ok ? "" : (out.error as { code?: string }).code).toBe("RUNTIME_PEER_INPUT_WITHOUT_HOST_CLOCK");
  });

  test("mixed with a local input, a peer input still leaves the clock at what the local input seeded", () => {
    const local = inputOf(ALICE, [credit(BOB, 5n)], T);
    expect(frame([local, hostileArrival()], T).clock).toBe(T);
  });

  test("the Host's own clock on the frame is what advances it, whatever the input carries", () => {
    const after = frame([hostileArrival()], T);
    expect(after.clock).toBe(T);
    expect(after.entityClock).toBe(T);
  });

  test("a local input (no sender) still seeds the clock with its stamp", () => {
    const local = inputOf(ALICE, [credit(BOB, 5n)], T);
    expect(local.from).toBeUndefined();
    expect(frame([local]).clock).toBe(T);
  });
  test("a Host clock behind the Runtime's own never runs it backwards", () => {
    const behind = before() - 1000n;
    expect(frame([hostileArrival()], behind).clock).toBe(before());
  });

  test("with a Host clock on the frame a local input's stamp seeds nothing: the input's own clock wins (og)", () => {
    const local = inputOf(ALICE, [credit(BOB, 5n)], T + DAY);
    expect(frame([local], T).clock).toBe(T);
  });
});
