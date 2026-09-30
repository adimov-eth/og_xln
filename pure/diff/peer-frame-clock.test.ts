// R-CLOCK: a Runtime takes no clock from a peer's input, so a frame of peer inputs alone runs at the Runtime's last clock
// unless the Host gives it one. That stale clock refuses a due cancel silently (the payer's Account stays `proposed`
// and the lock stays at the hub) and reads `lock_window` and `secret_window` too leniently (found by the #57 reviewer).
// The Runtime therefore refuses a frame that carries a peer input and no Host `timestamp`, loudly and before anything runs.
import { describe, expect, test } from "bun:test";
import { ALICE, BOB, CAROL, NOW, unwrap } from "../xln_run.ts";
import { applyRuntime, type RoutedEntityInput } from "../xln.ts";
import { accountOf, context, fromCarolToBob, inputOf, network, payment } from "./hub-network.ts";
import { allAt, arrivesAt, runtimeOf, settle, step, tick, type World } from "./two-runtimes.ts";

const T = NOW + 2000n;
const HOUR = 3_600_000n;
const CODE = "RUNTIME_PEER_INPUT_WITHOUT_HOST_CLOCK";
const toBob = (routed: readonly RoutedEntityInput[]): readonly RoutedEntityInput[] => routed.filter((r) => r.entityId === BOB);
/** The hub's Runtime takes these inputs as one frame, with the Host's clock or without. */
const atHub = (w: World, inputs: readonly RoutedEntityInput[], hostClock?: bigint) =>
  applyRuntime(
    runtimeOf(w, BOB),
    { runtimeTxs: [], entityInputs: inputs, ...(hostClock === undefined ? {} : { timestamp: hostClock }) },
    context() as never,
  );
const codeOf = (r: ReturnType<typeof atHub>): string => (r.ok ? "" : String((r.error as { code?: string }).code));

describe("a frame that carries a peer input needs the Host's clock", () => {
  /** Alice's payment is locked at the hub, Carol never answers; an hour later only Alice's Runtime is ticked. */
  const stuck = () => {
    const paying = step(context, network(), inputOf(ALICE, [payment()], T));
    if (!paying.ok) throw new Error(`Alice's payment was refused: ${JSON.stringify(paying.error)}`);
    const honest = allAt([ALICE, BOB, CAROL], T);
    const inFlight = settle(context, paying.world, paying.routed.map((r) => arrivesAt(honest, r)), honest, fromCarolToBob);
    const ticked = tick(context, inFlight.world, "alice", T + HOUR);
    if (!ticked.ok) throw new Error(`Alice's tick was refused: ${JSON.stringify(ticked.error)}`);
    return { world: ticked.world, cancel: toBob(ticked.routed), late: allAt([ALICE, BOB, CAROL], T + HOUR), held: inFlight.held };
  };

  test("Alice's cancel reaches a hub whose Host gives no clock: the frame is refused, not run at a stale clock", () => {
    const s = stuck();
    expect(s.cancel.length).toBeGreaterThan(0);
    expect(codeOf(atHub(s.world, s.cancel))).toBe(CODE);
  });

  test("the refusal leaves everything where it was, and the same frame with the Host's clock lands the cancel", () => {
    const s = stuck();
    expect(accountOf(s.world, ALICE, BOB)._tag).toBe("proposed");
    const retried = settle(context, s.world, s.cancel.map((r) => arrivesAt(s.late, r)), s.late, fromCarolToBob);
    expect(retried.refused).toEqual([]);
    expect(accountOf(retried.world, BOB, ALICE).state.locks.size).toBe(0);
    expect(accountOf(retried.world, ALICE, BOB)._tag).not.toBe("proposed");
  });

  test("a Host clock on the frame is enough, whatever the Runtime's last clock was", () => {
    const s = stuck();
    expect(atHub(s.world, s.cancel, T + HOUR).ok).toBe(true);
  });

  test("a frame without a peer input needs none: a local input carries its own stamp", () => {
    const local = inputOf(BOB, [], T);
    expect(atHub(network(), [local]).ok).toBe(true);
  });
});

describe("a stale Runtime clock cannot make the lock window lenient", () => {
  /** Alice's payment locks for 120 s from her clock; the frame carrying it reaches a hub whose Runtime last ran earlier. */
  const lockFrame = () => {
    const paying = step(context, network(), inputOf(ALICE, [payment()], T));
    if (!paying.ok) throw new Error(`Alice's payment was refused: ${JSON.stringify(paying.error)}`);
    return { world: paying.world, frame: toBob(paying.routed) };
  };
  const locksAtHub = (w: World): number => accountOf(w, BOB, ALICE).state.locks.size;

  test("control: with the Host's clock at the payment's time the hub takes the lock", () => {
    const s = lockFrame();
    const out = unwrap(atHub(s.world, s.frame, T));
    expect(locksAtHub({ ...s.world, runtimes: new Map([...s.world.runtimes, ["hub", out.runtime]]) })).toBe(1);
  });

  test("with the Host's clock 100 s on, under 30 s of the lock is left: the hub does not take it", () => {
    const s = lockFrame();
    const out = unwrap(atHub(s.world, s.frame, T + 100_000n));
    expect(locksAtHub({ ...s.world, runtimes: new Map([...s.world.runtimes, ["hub", out.runtime]]) })).toBe(0);
  });

  test("with no Host clock the hub is not asked to judge the lock at a stale one: the frame is refused", () => {
    const s = lockFrame();
    expect(codeOf(atHub(s.world, s.frame))).toBe(CODE);
  });
});
