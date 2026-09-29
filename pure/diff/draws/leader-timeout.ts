// The leader-timeout world move on a multi-signer board: the board's members hold commands the leader has not
// committed, and the Runtime clock passes og's leader timeout, so og's scheduled wake has each of them vote the leader
// out and the board changes view.
//
// og's flow, at 566c850:
//   runtime/mempool/scheduled-wake.ts:118-125  a replica that is not the active leader and holds leader work
//     (leader/index.ts:203 hasEntityLeaderWork: a mempool, a proposal, a locked frame, ...) is due at
//     lastConsensusProgressAt + getEntityLeaderTimeoutMs(toView);
//   leader/index.ts:88-89  getEntityLeaderTimeoutMs: 10 s per view, at most 60 s;
//   scheduled-wake.ts:229-247  once due, the Runtime tick queues that replica's own unsigned leaderTimeoutVote;
//   leader/timeout-input.ts:25-58  the replica signs it and sends it to every other member;
//   leader/timeout-input.ts:140  handleLeaderTimeoutVote: a quorum of votes installs the leader certificate, and the
//     input goes on to admission (input/consensus.ts:293-322), whose forwardValidatorMempool (input/admission.ts:114,
//     :197-198) sends a non-leader's retained mempool to the new leader.
// A non-leader's lastConsensusProgressAt is its last commit (commit/finalization.ts:332), so a command admitted after
// the clock passes the timeout is due at the next frame's wake.
//
// Two non-leaders each author a command in one frame, so their two votes (a 2-of-3 quorum) follow in the next frame,
// while the leader proposes the forwarded commands. The old leader then holds a proposal and a mempool when the
// certificate lands, and forwards that mempool to the new leader (the held-replica vote branch of og's D10 forward,
// admission.ts:197-198). On a board that never committed, the members have no progress to time out from (admission
// sets it, admission.ts:69-70), so the first move only commits. A view change ends in og's halt when the new leader's
// commit reaches the old one (departures.ts KNOWN_OG_HALTS); diff/leader-timeout.test.ts runs the whole sequence.
import {
  buildEntityLeaderVoteBody,
  getEntityLeaderTimeoutMs,
  isEntityActiveLeader,
} from "../../../core/entity/consensus/leader/index.ts";
import type { EntityReplica } from "../../../core/entity/types.ts";
import { SIGNERS } from "../lane.ts";
import type { World } from "../world.ts";
import type { Step, WorldMove } from "./areas.ts";
import { tx } from "./world-view.ts";

/** og's replicas of Entity x, one per board member hosted here. */
const replicasOf = (w: World, x: number): readonly EntityReplica[] =>
  [...w.lane.env.state.eReplicas.values()].filter((r) => r.entityId === w.ids[x]);
/**
 * Every member's replica holds one committed height and no consensus work (og hasEntityLeaderWork's fields): the
 * board is between frames, so the move starts a round of its own.
 */
const settled = (w: World, x: number): boolean => {
  const replicas = replicasOf(w, x);
  const heights = new Set(replicas.map((r) => r.state.height));
  return replicas.length === w.signersOf(x).length
    && heights.size === 1
    && replicas.every((r) =>
      r.mempool.length === 0
      && r.proposal === undefined
      && r.lockedFrame === undefined
      && r.pendingLeaderCertificate === undefined);
};
const idle = (w: World): readonly number[] => w.boards.filter((x) => settled(w, x));
/** The members og does not hold as the active leader (leader/index.ts isEntityActiveLeader), as SIGNERS indexes. */
const followers = (w: World, x: number): readonly number[] => {
  const replicas = replicasOf(w, x);
  return w.signersOf(x).filter((s, at) => replicas[at] !== undefined && !isEntityActiveLeader(replicas[at]!));
};
/** og getEntityLeaderTimeoutMs for the view after the board's current one (leader/index.ts:88). */
const timeoutOf = (w: World, x: number): number =>
  getEntityLeaderTimeoutMs(buildEntityLeaderVoteBody(replicasOf(w, x)[0]!.state).toView);

export const LEADER_TIMEOUT: WorldMove = {
  enabled: (w) => idle(w).length > 0,
  draw: (w): Step => {
    const boards = idle(w);
    const x = boards[w.ri(boards.length)]!;
    // both clocks pass the timeout since the members' last progress, which is at most the current clock
    w.lane.jumpClock(Number(w.lane.runtime().timestamp) + timeoutOf(w, x));
    // a chat is an individual command (og auth/authorization.ts:79-85), so a member's own chat never opens a board
    // proposal and the move repeats without og's one-open-proposal limit (tx/processing/proposals.ts:57)
    const users = followers(w, x).map((s) =>
      w.user(x, [tx("chat", { from: SIGNERS[s]!.toLowerCase(), message: `stalled ${w.ri(1000)}` })], s));
    return { runtimeTxs: [], users };
  },
};
