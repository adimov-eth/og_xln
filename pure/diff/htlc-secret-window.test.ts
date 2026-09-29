import { describe, expect, test } from "bun:test";
// Runtime-loop differential for an HTLC secret that arrives inside the enforcement reserve (D11): og
// getIncomingAccountDeadlineViolation (core/account/consensus/dispute/deadline-policy.ts:113-124) answers 'dispute'
// and handleUnsafeAccountFrame (core/entity/tx/handlers/account/dispute-input.ts:64) persists the secret, records
// shadow.rejectedFrameEvidence and prepares the dispute. Two og behaviours of the production (cutover) path decide what
// the frame commits:
//   1. the secret is persisted through the Book intent slot, applied only after the tx loop
//      (application.ts:1636-1646), so the dispute start drafted in the same tx carries no secret ("0x" arguments);
//   2. prepareEntityAccountOutbound (rscore/authority/entity-stage.ts:417) replaces the Account with the Account
//      worker's copy (ts-worker/provider.ts:196 replacePostAccount), which never held rejectedFrameEvidence.
//
// A scripted run (fixed inputs, no walk): C pays A through the hub H; A reveals, H learns the secret and proposes
// htlc_resolve to C. Before C receives that frame the clock jumps (og advanceScenarioPastDisputeTimeout, as the
// disputes walk's clock move does) to within HTLC_ENFORCEMENT_RESERVE_MS of the C-H lock's timelock. The lane compares
// og processRuntime with the rewrite's commitRuntimeFrame on every frame.
import { HTLC_ENFORCEMENT_RESERVE_MS } from "../../core/account/consensus/dispute/deadline-policy.ts";
import { HUB, openWorld, type World } from "./world.ts";

const SEED = 0x5ec2e7;
const [A, C] = [0, 2] as const;
/** Idle frames allowed for a step's Account work to settle. */
const DRAIN = 12;

type OgLock = { readonly timelock: bigint; readonly revealBeforeHeight: number };
type OgTx = { readonly type: string; readonly data?: { readonly outcome?: string; readonly lockId?: string } };
type OgAccountView = {
  readonly mempool?: readonly unknown[];
  readonly pendingFrame?: unknown;
  readonly shadow?: { readonly rejectedFrameEvidence?: unknown };
  readonly activeDispute?: { readonly starterInitialArguments: string };
  readonly state?: { readonly locks?: ReadonlyMap<string, OgLock> };
};
type OgQueued = {
  readonly entityId: string;
  readonly entityTxs?: readonly { readonly type: string; readonly data?: unknown }[];
};

const accountOf = (w: World, x: number, y: number): OgAccountView | undefined => w.ogAccount(x, y) as never;
const idle = (w: World, x: number, y: number): boolean =>
  [accountOf(w, x, y), accountOf(w, y, x)].every((a) => a?.pendingFrame == null && (a?.mempool ?? []).length === 0);
const lockOf = (w: World): OgLock | undefined => [...(accountOf(w, C, HUB)?.state?.locks?.values() ?? [])][0];
/** H's Account frame carrying the secret resolve, queued for C in og's mempool (it lands next frame). */
const resolveQueued = (w: World): boolean =>
  (w.lane.env.runtimeMempool?.entityInputs as readonly OgQueued[] | undefined ?? []).some((input) =>
    input.entityId === w.ids[C]
    && (input.entityTxs ?? []).some((tx) => {
      const frame = (tx.data as { proposal?: { frame?: { accountTxs?: readonly OgTx[] } } } | undefined)?.proposal?.frame;
      return tx.type === "accountInput"
        && (frame?.accountTxs ?? []).some((a) => a.type === "htlc_resolve" && a.data?.outcome === "secret");
    }));

describe("HTLC secret inside the enforcement reserve (og deadline-policy.ts, dispute-input.ts, cutover outbound)", () => {
  test("MATCH: a secret arriving after a clock jump disputes the Account exactly as og's cutover commits it", async () => {
    const w = await openWorld(SEED, "htlc-secret-window");
    const step = (users: Parameters<World["lane"]["tick"]>[1]): Promise<readonly string[]> => w.lane.tick([], users);
    /** Idle frames, each compared, until `done` holds (at most `left`). */
    const until = async (done: () => boolean, left: number): Promise<readonly string[]> => {
      if (left === 0 || done()) return [];
      const diffs = await step([]);
      return diffs.length > 0 ? diffs : until(done, left - 1);
    };
    try {
      expect(w.evidence).toEqual([]);
      const [imports, opens] = w.importAll();
      expect(await w.lane.tick(imports, [])).toEqual([]);
      expect(await step(opens)).toEqual([]);
      expect(await until(() => idle(w, A, HUB) && idle(w, C, HUB), DRAIN)).toEqual([]);
      // both directions of both Accounts carry credit, so C can route to A through H
      const credit = [[A, HUB], [HUB, A], [C, HUB], [HUB, C]] as const;
      expect(await step(credit.map(([x, y]) => w.user(x, [w.extend(x, y, 50_000n)])))).toEqual([]);
      expect(await until(() => w.routable(C, A) && idle(w, A, HUB) && idle(w, C, HUB), DRAIN)).toEqual([]);
      expect(w.routable(C, A)).toBe(true);
      expect(await step([w.user(C, [w.htlc(C, A, 100n)])])).toEqual([]);
      expect(await until(() => resolveQueued(w), DRAIN)).toEqual([]);
      expect(resolveQueued(w)).toBe(true);
      const lock = lockOf(w);
      expect(lock).toBeDefined();
      // C's next frame runs at the jumped clock + 100 ms: inside the reserve, before the timelock
      const jumped = Number(lock!.timelock) - HTLC_ENFORCEMENT_RESERVE_MS / 2;
      w.lane.jumpClock(jumped);
      expect(await step([])).toEqual([]);
      // og took the dispute path: the start is queued, its arguments carry no secret, and no evidence was committed
      const disputed = accountOf(w, C, HUB);
      expect(disputed?.activeDispute?.starterInitialArguments).toBe("0x");
      expect(disputed?.shadow?.rejectedFrameEvidence).toBeUndefined();
      expect(await until(() => false, 3)).toEqual([]);
    } finally {
      await w.close();
    }
  }, 600_000);
});
