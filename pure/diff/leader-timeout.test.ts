import { afterAll, describe, expect, test } from "bun:test";
// Runtime-loop differential for og's leader timeout on the 2-of-3 board B (world.ts), driven by the boards walk's own
// leaderTimeout world move (draws/leader-timeout.ts), scripted so it reaches the view change on every run:
//   1. the move on a board that never committed: the members' commands commit as usual and set their
//      lastConsensusProgressAt (og commit/finalization.ts:332);
//   2. the move again: the clock passes og's leader timeout (leader/index.ts:88-89), each non-leader holding a command
//      is due (runtime/mempool/scheduled-wake.ts:118-125) and votes (scheduled-wake.ts:229-247), while the leader
//      proposes the forwarded commands;
//   3. the two votes certify the view change at every member (leader/timeout-input.ts:140). The old leader, still
//      holding its proposal and mempool, goes on to admission and forwards that mempool to the new leader
//      (input/admission.ts:114, :197-198): the held-replica branch of og's D10 forward;
//   4. the new leader's commit reaches the old leader, which still holds its own frame's execution: og halts
//      (commit/catch-up.ts:219-224, candidate-views.ts:13-27), a known og halt (departures.ts), and the rewrite refuses
//      the frame with og's text.
// The lane compares og processRuntime with the rewrite's commitRuntimeFrame on every frame.
process.env["WALK_BOARD"] = "1";
import { entityLog } from "../../core/entity/consensus/entity-log.ts";
import { SIGNERS } from "./lane.ts";
import { openWorld, type World } from "./world.ts";
import { LEADER_TIMEOUT } from "./draws/leader-timeout.ts";
import { knownHalt } from "./departures.ts";

const SEED = 0x7e4f0;
/** Frames allowed for the board to settle, and for the view change to run to og's halt. */
const DRAIN = 12;

/** og's view-change and forward log lines, in order, captured from its Entity logger. */
type Seen = { readonly message: string; readonly fields: Record<string, unknown> };
const seen: Seen[] = [];
const ogDebug = entityLog.debug;
const ogWarn = entityLog.warn;
const WATCHED = new Set(["mempool.forwarded_to_proposer", "leader.view_change_certified"]);
// monkeypatch og's logger (og is never edited): record the line, then log as og would
entityLog.debug = (message, fields) => {
  if (WATCHED.has(message)) seen.push({ message, fields: (fields ?? {}) as Record<string, unknown> });
  ogDebug(message, fields);
};
entityLog.warn = (message, fields) => {
  if (WATCHED.has(message)) seen.push({ message, fields: (fields ?? {}) as Record<string, unknown> });
  ogWarn(message, fields);
};
afterAll(() => {
  entityLog.debug = ogDebug;
  entityLog.warn = ogWarn;
});

/** og shortId: the last four hex digits of a signer. */
const short = (signer: number): string => SIGNERS[signer]!.toLowerCase().slice(-4);

describe("leader timeout: og's view change on the 2-of-3 board", () => {
  test("MATCH: the superseded leader forwards its mempool to the new leader, then both sides halt on og's commit", async () => {
    const w = await openWorld(SEED, "leader-timeout");
    /** Idle frames, each compared, until `done` holds (at most `left`). */
    const until = async (done: (w: World) => boolean, left: number): Promise<readonly string[]> => {
      if (left === 0 || done(w)) return [];
      const diffs = await w.lane.tick([], []);
      return diffs.length > 0 ? diffs : until(done, left - 1);
    };
    const settled = (x: World): boolean => LEADER_TIMEOUT.enabled(x);
    const halted = (x: World): boolean => x.coverage.halts > 0;
    const move = async (): Promise<readonly string[]> => {
      const step = await LEADER_TIMEOUT.draw(w);
      return w.lane.tick(step.runtimeTxs, step.users);
    };
    try {
      expect(w.evidence).toEqual([]);
      const [imports, opens] = w.importAll();
      expect(await w.lane.tick(imports, [])).toEqual([]);
      expect(await w.lane.tick([], opens)).toEqual([]);
      expect(await until(settled, DRAIN)).toEqual([]);
      expect(settled(w)).toBe(true);
      // 1. the first move only commits: the members had no consensus progress to time out from
      expect(await move()).toEqual([]);
      expect(await until(settled, DRAIN)).toEqual([]);
      expect(settled(w)).toBe(true);
      expect(seen.filter((s) => s.message === "leader.view_change_certified")).toEqual([]);
      seen.splice(0);
      // 2-4. the second move times the leader out
      expect(await move()).toEqual([]);
      expect(await until(halted, DRAIN)).toEqual([]);
      const certified = seen.findIndex((s) => s.message === "leader.view_change_certified");
      expect(certified).toBeGreaterThanOrEqual(0);
      expect(seen[certified]!.fields).toMatchObject({ from: short(0), to: short(1), view: 1 });
      // og forwards to the new leader only after the certificate: the old leader's held mempool among them
      const toNew = seen.slice(certified).filter((s) => s.message === "mempool.forwarded_to_proposer"
        && s.fields["proposer"] === short(1));
      console.log(`og after the view change ${JSON.stringify(seen.slice(certified))}`);
      expect(toNew.length).toBeGreaterThan(0);
      expect(w.coverage.haltTexts.length).toBe(1);
      expect(knownHalt(w.coverage.haltTexts[0]!)?.name).toBe("a proposer superseded by a view change halts on the new leader's commit");
    } finally {
      await w.close();
    }
  }, 600_000);
});
