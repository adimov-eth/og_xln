// R-CLOCK finding 2: no frame is refused for its date, and a proposer never mints a frame behind its Account's committed
// watermark, so one co-signed far-future stamp would fix the stamp of every later frame on that Account, and the fold
// would refuse every new lock (`now >= timelock`) for good. A proposer therefore carries the watermark only up to a
// named lead past its own clock; a stamp beyond that is clamped for every lock decision, and a stamp within it heals
// when real time catches up. Probe: the hub Bob (hostile) gets a frame co-signed with a stamp `ahead` past the honest
// time, then everyone's clock is honest and Alice pays Carol through Bob; the lock must land on Bob's Account.
import { describe, expect, test } from "bun:test";
import { ALICE, BOB, CAROL, NOW } from "../xln_run.ts";
import { MAX_FRAME_LEAD_MS, replicaKey, type EntityId } from "../xln.ts";
import { accountOf, context, credit, fromCarolToBob, inputOf, network, payment, replicaIn } from "./hub-network.ts";
import { allAt, arrivesAt, runtimeOf, settle, step, withRuntime, type World } from "./two-runtimes.ts";

const SECOND = 1000n;
const HOUR = 3_600_000n;
const DAY = 86_400_000n;

/** The Entity's own clock, Runtime and replica alike, set back to `t`: whatever the Entity did stays, its clock is honest. */
const backTo = (w: World, id: EntityId, t: bigint): World => {
  const rt = runtimeOf(w, id);
  const replica = replicaIn(w, id);
  const key = replicaKey(id, replica.signerId);
  return withRuntime(w, id, {
    ...rt, timestamp: t, entities: new Map([...rt.entities, [key, { ...replica, state: { ...replica.state, timestamp: t } }]]),
  });
};

/** The result of Alice's payment on the Account she shares with a hub whose stamp was `ahead` past the honest time. */
const afterPoison = (ahead: bigint) => {
  const T = NOW + 2000n;
  const honest = allAt([ALICE, BOB, CAROL], T);
  const poisoning = step(context, network(), inputOf(BOB, [credit(ALICE, 5000n)], T + ahead));
  if (!poisoning.ok) throw new Error(`the poisoning frame was refused: ${JSON.stringify(poisoning.error)}`);
  const cosigned = settle(context, poisoning.world, poisoning.routed.map((r) => arrivesAt(honest, r)), honest);
  // the hostile hub tells the truth from here on: only its co-signed stamp is left behind
  const truthful = backTo(cosigned.world, BOB, T);
  const later = T + 1000n;
  const paying = step(context, truthful, inputOf(ALICE, [payment()], later));
  if (!paying.ok) throw new Error(`Alice's payment was refused: ${JSON.stringify(paying.error)}`);
  const clocks = allAt([ALICE, BOB, CAROL], later);
  const inFlight = settle(context, paying.world, paying.routed.map((r) => arrivesAt(clocks, r)), clocks, fromCarolToBob);
  return {
    refused: [...cosigned.refused, ...inFlight.refused],
    locks: accountOf(inFlight.world, BOB, ALICE).state.locks.size,
    watermark: accountOf(inFlight.world, BOB, ALICE).head.timestamp,
    honestTime: later,
  };
};

describe("a co-signed future stamp does not disable HTLC locks on an Account", () => {
  const cases: readonly (readonly [string, bigint])[] = [
    ["nothing (control)", 0n],
    ["a second", SECOND],
    ["an hour", HOUR],
    ["a day", DAY],
    ["30 days", 30n * DAY],
    ["a year", 365n * DAY],
  ];
  test.each(cases)("stamp %s ahead: the payment's lock lands on the Account", (_, ahead) => {
    const r = afterPoison(ahead);
    expect(r.refused).toEqual([]);
    expect(r.locks).toBe(1);
  });

  test("the stamp a proposer mints stays within the named lead of its own clock, however far ahead the watermark is", () => {
    const r = afterPoison(365n * DAY);
    expect(r.watermark).toBeLessThanOrEqual(r.honestTime + MAX_FRAME_LEAD_MS);
  });

  test("a watermark within the lead is still carried: the Account never runs behind a stamp it co-signed", () => {
    const ahead = 20n * SECOND;
    expect(ahead).toBeLessThan(MAX_FRAME_LEAD_MS);
    const r = afterPoison(ahead);
    expect(r.watermark).toBeGreaterThanOrEqual(NOW + 2000n + ahead);
  });
});
