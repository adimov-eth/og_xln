// The disputes area (watchtower and disputes) of the model walk: prepareDispute, disputeStart and disputeFinalize,
// drawn from og's committed view of each Account's dispute lifecycle.
//
// og's guards (review/disputes-guards.md in project files, mined with ast-grep over
// core/entity/tx/handlers/dispute) split into refusals, which only add a frame message and are drawn on purpose, and
// halts, which a draw never offers:
//   - evidence halts (DISPUTE_START_EVIDENCE_INVALID, DISPUTE_FROZEN_ACCOUNT_STATE_MISMATCH) need the ProofBody both
//     sides signed to be the one each holds, so a dispute opens only on a quiet Account;
//   - a J batch holds one disputeFinalize (finalize.ts J_BATCH_LIMIT_EXCEEDED), so a finalize is drawn only into an
//     Entity's draft that holds none;
//   - Pull and cross-j route guards never apply: the single-Runtime world has no Pulls and no routes.
// og's watchtower (core/watchtower, core/api/server/rpc/watchtower-proxy.ts) is a server, not an Entity tx: nothing
// to draw.
import type { EntityTx } from "../../xln.ts";
import { HUB, SPOKES, type World } from "../world.ts";
import { arises, drawn, type Move, type Moves, type Step, type WorldMoves } from "./areas.ts";
import { one as oneTx, PARTIES, quiet, tx } from "./world-view.ts";

// ---- the domain: one Account's dispute lifecycle as og has committed it ----

/** og's AccountReplica, as far as the dispute lifecycle reads it (core/types/account.ts). */
type OgDisputeAccount = {
  readonly status?: string;
  readonly counterpartyDisputeProofHanko?: string;
  readonly disputePrepare?: { readonly readyAfter: number; readonly pendingOrderbookRemovalIds?: readonly string[] };
  readonly activeDispute?: {
    readonly startedByLeft: boolean;
    readonly disputeTimeout: number;
    readonly observedOnChain?: boolean;
    readonly finalizeQueued?: boolean;
  };
  readonly state?: { readonly leftEntity?: string };
};
type OgDisputeBatch = { readonly disputeStarts?: readonly unknown[]; readonly disputeFinalizations?: readonly unknown[] };

/**
 * Where one side of an Account stands:
 *   trading   - active, no dispute;
 *   preparing - frozen by prepareDispute, its disputeStart waiting for the cooldown or not yet drafted;
 *   started   - a disputeStart is queued or on chain (`observed` once DisputeStarted reached this side);
 *   closed    - finalized on chain: disputed, with no active dispute left.
 */
type Stage =
  | { readonly _tag: "trading" }
  | { readonly _tag: "preparing"; readonly readyAfter: number }
  | {
      readonly _tag: "started";
      readonly observed: boolean;
      readonly starter: boolean;
      readonly timeoutMs: number;
      readonly finalizeQueued: boolean;
    }
  | { readonly _tag: "closed" };

/** One side of an Account: Entity `x` looking at its Account with `y`. */
type Side = { readonly x: number; readonly y: number; readonly stage: Stage };

const accountOf = (w: World, x: number, y: number): OgDisputeAccount | undefined =>
  w.ogAccount(x, y) as OgDisputeAccount | undefined;

const stageOf = (w: World, x: number, account: OgDisputeAccount): Stage => {
  const dispute = account.activeDispute;
  if (dispute !== undefined) {
    return {
      _tag: "started",
      observed: dispute.observedOnChain === true,
      starter: (account.state?.leftEntity === w.ids[x]) === dispute.startedByLeft,
      timeoutMs: Number(dispute.disputeTimeout) * 1000,
      finalizeQueued: dispute.finalizeQueued === true,
    };
  }
  switch (account.status ?? "active") {
    case "dispute_preparing":
      return { _tag: "preparing", readyAfter: Number(account.disputePrepare?.readyAfter ?? 0) };
    case "disputed":
      return { _tag: "closed" };
    default:
      return { _tag: "trading" };
  }
};

const sides = (w: World): readonly Side[] =>
  PARTIES.flatMap((x) =>
    PARTIES.flatMap((y) => {
      const account = y === x ? undefined : accountOf(w, x, y);
      return account === undefined ? [] : [{ x, y, stage: stageOf(w, x, account) }];
    }),
  );

const sideOf = (w: World, x: number, y: number): Side | undefined => sides(w).find((s) => s.x === x && s.y === y);

const now = (w: World): number => Number(w.lane.runtime().timestamp);

const draftOf = (w: World, x: number): OgDisputeBatch | undefined =>
  (w.batchOf(x) as { batch?: OgDisputeBatch } | undefined)?.batch;

const trading = (w: World, x: number, y: number): boolean =>
  sideOf(w, x, y)?.stage._tag === "trading" && sideOf(w, y, x)?.stage._tag === "trading";

/**
 * The hub stays reachable: a hub Account is disputed only while two other spokes still trade with the hub, so the
 * walk's payments and HTLCs keep a route. Spoke-to-spoke Accounts are the throwaway ones.
 */
const disposable = (w: World, x: number, y: number): boolean => {
  const spoke = x === HUB ? y : y === HUB ? x : undefined;
  return spoke === undefined || SPOKES.filter((s) => s !== spoke && trading(w, s, HUB)).length >= 2;
};

// ---- the variants each kind draws ----

/** A weighted choice among the variants a kind has now; `undefined` when none applies. */
type Variant = { readonly weight: number; readonly sides: readonly Side[]; readonly tx: (w: World, s: Side) => EntityTx };

const one = (w: World, s: Side, t: EntityTx): Step => oneTx(w, s.x, [t]);

const choose = (w: World, variants: readonly Variant[]): Step => {
  const live = variants.filter((v) => v.sides.length > 0);
  const total = live.reduce((sum, v) => sum + v.weight, 0);
  const r = w.rand() * total;
  const at = live.findIndex((_, i) => live.slice(0, i + 1).reduce((sum, v) => sum + v.weight, 0) > r);
  const variant = live[at < 0 ? live.length - 1 : at]!;
  const side = variant.sides[w.ri(variant.sides.length)]!;
  return one(w, side, variant.tx(w, side));
};

const anyLive = (variants: readonly Variant[]): boolean => variants.some((v) => v.sides.length > 0);

/** og's cooldowns: none (the start is drafted in the same tx) or a few frames of the lane's 100 ms clock. */
const COOLDOWNS_MS = [0, 0, 300, 1_500] as const;

const prepare = (w: World, s: Side): EntityTx =>
  tx("prepareDispute", {
    counterpartyEntityId: w.ids[s.y],
    description: `walk ${w.ri(100)}`,
    minCooldownMs: COOLDOWNS_MS[w.ri(COOLDOWNS_MS.length)],
  });

/**
 * prepareDispute: open a dispute on a quiet, disposable Account both sides trade on; or repeat it on one already
 * past trading, where og re-drafts a ready start or refuses with a message.
 */
const prepareVariants = (w: World): readonly Variant[] => [
  {
    weight: 3,
    sides: sides(w).filter((s) => trading(w, s.x, s.y) && quiet(w, s.x, s.y) && disposable(w, s.x, s.y)),
    tx: prepare,
  },
  { weight: 1, sides: sides(w).filter((s) => s.stage._tag !== "trading"), tx: prepare },
];

const start = (w: World, s: Side): EntityTx =>
  tx("disputeStart", { counterpartyEntityId: w.ids[s.y], description: `walk ${w.ri(100)}` });

const startQueued = (w: World, s: Side): boolean =>
  (draftOf(w, s.x)?.disputeStarts?.length ?? 0) > 0 || w.batchOf(s.x)?.sentBatch !== undefined;

/**
 * disputeStart: draft the start of a prepared dispute whose cooldown has run out; or ask for one og refuses (still
 * cooling, not prepared, already disputed), each a frame message.
 */
const startVariants = (w: World): readonly Variant[] => [
  {
    weight: 4,
    sides: sides(w).filter((s) => s.stage._tag === "preparing" && s.stage.readyAfter <= now(w) && !startQueued(w, s)),
    tx: start,
  },
  {
    weight: 1,
    sides: sides(w).filter((s) =>
      s.stage._tag === "preparing" ? s.stage.readyAfter > now(w) : s.stage._tag !== "started"),
    tx: start,
  },
];

const finalize = (w: World, s: Side): EntityTx =>
  tx("disputeFinalize", { counterpartyEntityId: w.ids[s.y], description: `walk ${w.ri(100)}` });

/** og's J batch holds one disputeFinalize: a second one in the draft halts the Runtime. */
const finalizeFree = (w: World, s: Side): boolean => (draftOf(w, s.x)?.disputeFinalizations?.length ?? 0) === 0;

const observedOpen = (s: Side): s is Side & { stage: Extract<Stage, { _tag: "started" }> } =>
  s.stage._tag === "started" && s.stage.observed && !s.stage.finalizeQueued;

/**
 * disputeFinalize: the non-starter accepts the starter's state at once, or either side finalizes after the
 * challenge window (both queue the finalize); the starter asking early, or before DisputeStarted is observed, is
 * refused with a message.
 */
const finalizeVariants = (w: World): readonly Variant[] => [
  {
    weight: 3,
    sides: sides(w).filter((s) => observedOpen(s) && finalizeFree(w, s)
      && (!s.stage.starter || now(w) >= s.stage.timeoutMs)),
    tx: finalize,
  },
  {
    weight: 1,
    sides: sides(w).filter((s) =>
      s.stage._tag === "started" && (!s.stage.observed || (s.stage.starter && now(w) < s.stage.timeoutMs))),
    tx: finalize,
  },
];

const drawnFrom = (variants: (w: World) => readonly Variant[]): Move =>
  drawn(
    (w) => anyLive(variants(w)),
    (w) => choose(w, variants(w)),
  );

export const DISPUTES: Moves<"disputes"> = {
  prepareDispute: drawnFrom(prepareVariants),
  disputeStart: drawnFrom(startVariants),
  disputeFinalize: drawnFrom(finalizeVariants),
  crossJurisdictionForceSiblingDispute: arises("cross-j dispute salvage (two Runtimes)"),
  crossJurisdictionSalvage: arises("cross-j dispute salvage (two Runtimes)"),
};

// ---- the world move this area needs: the challenge window runs out ----

/** The earliest challenge-window end still ahead of the committed clock, over the disputes on chain. */
const nextTimeout = (w: World): number | undefined => {
  const ahead = sides(w).flatMap((s) =>
    s.stage._tag === "started" && s.stage.observed && s.stage.timeoutMs > now(w) ? [s.stage.timeoutMs] : []);
  return ahead.length === 0 ? undefined : Math.min(...ahead);
};

/**
 * `clock`: time passes to the next challenge-window end, as og's advanceScenarioPastDisputeTimeout does. At the
 * lane's 100 ms per frame the world's 60 s windows would take 600 frames; the dispute_deadline hook then finalizes.
 */
export const DISPUTES_WORLD: WorldMoves = {
  clock: {
    enabled: (w) => nextTimeout(w) !== undefined,
    draw: (w) => {
      w.lane.jumpClock(nextTimeout(w)!);
      return { runtimeTxs: [], users: [] };
    },
  },
};
