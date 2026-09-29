// Where the rewrite departs from og on purpose. A departure may only replace an og Runtime halt: og refuses the whole
// frame and commits nothing, so no value og commits changes. Each departure names the halt by og's own text, and says
// what the rewrite does instead, checked on the frame the rewrite committed.
import { unsignableWorkspace } from "../xln.ts";
import type { EntityId, Runtime } from "../xln.ts";

export type HaltDeparture = {
  readonly name: string;
  /** og's halt text (the cause the lane reads off processRuntime) is this departure's halt. */
  readonly halts: (ogHalt: string) => boolean;
  /** What the rewrite must have done instead, on the frame it committed; null when it did, else what is wrong. */
  readonly instead: (after: Runtime) => string | null;
};

type Account = NonNullable<ReturnType<Runtime["entities"]["get"]>>["accountReplicas"] extends ReadonlyMap<EntityId, infer A>
  ? A
  : never;
const accounts = (r: Runtime): readonly Account[] =>
  [...r.entities.values()].flatMap((e) => [...e.accountReplicas.values()]);
const queuedTxs = (a: Account): readonly { readonly type: string; readonly kind?: string; readonly revision?: number }[] =>
  [...a.mempool, ...(a._tag === "proposed" ? a.candidate.frame.txs : [])] as never;

/**
 * og halts signing a settlement approval whose workspace its own projection refuses (review/og-issues-halts-2026-09-28.md,
 * issue 1): settled rows out of the collateral or ondelta range, or past the Account's row cap. A peer reaches it with
 * one settle_update that takes more collateral than the Account holds, which the receiver auto-approves. The rewrite
 * expires the approval instead, so no Entity is left holding one for a workspace nobody can sign.
 */
const unsignableApproval: HaltDeparture = {
  name: "unsignable settlement approval expires",
  halts: (ogHalt) =>
    /SETTLEMENT_PROJECTED_(COLLATERAL|ONDELTA)_RANGE:token=\d+/.test(ogHalt) ||
    ogHalt.includes("ACCOUNT_DELTA_ROW_LIMIT_EXCEEDED:insert:"),
  instead: (after) => {
    const unsignable = (a: Account | undefined): boolean =>
      a?.state.settlement !== undefined && unsignableWorkspace(a.state, a.state.settlement) !== null;
    const held = [...after.entities.values()].some((e) => {
      const approvals = e.state.deferredApprovals;
      const peers = approvals._tag === "kept" ? [...approvals.entries.keys()] : [];
      return peers.some((peer) => unsignable(e.accountReplicas.get(peer as EntityId)));
    });
    return held ? "an Entity still holds an approval og could not sign" : null;
  },
};

/**
 * og halts proposing a settlement transition whose workspace is gone (review/og-issues-halts-2026-09-28.md, issue 3):
 * it settled on chain, or was cleared, while the transition waited in the mempool. The rewrite drops the transition, so
 * no Account on a workspace-less state still queues or proposes one that needs a workspace.
 */
const staleTransition: HaltDeparture = {
  name: "stale settlement transition dropped",
  halts: (ogHalt) => /SETTLEMENT_TRANSITION_PROPOSAL_FAILED:[a-z]+:SETTLEMENT_WORKSPACE_(PREVIOUS_)?MISSING(\\n|"|$)/.test(ogHalt),
  instead: (after) => {
    const needsWorkspace = (tx: { type: string; kind?: string; revision?: number }): boolean =>
      tx.type === "settle_transition" && !(tx.kind === "upsert" && tx.revision === 1);
    const stale = accounts(after).filter((a) => a.state.settlement === undefined && queuedTxs(a).some(needsWorkspace));
    return stale.length === 0 ? null : "an Account without a workspace still carries a settlement transition";
  },
};

export const HALT_DEPARTURES: readonly HaltDeparture[] = [unsignableApproval, staleTransition];
export const haltDeparture = (ogHalt: string): HaltDeparture | undefined => HALT_DEPARTURES.find((d) => d.halts(ogHalt));

/**
 * og halts the rewrite still halts on too: og liveness bugs reported upstream, with no departure yet. A walk may end on
 * one of these; any other og halt a drawn move reaches is a draw whose guard is weaker than og's, and fails the walk.
 */
export type KnownHalt = { readonly name: string; readonly issue: string; readonly halts: (ogHalt: string) => boolean };
export const KNOWN_OG_HALTS: readonly KnownHalt[] = [
  {
    name: "a payment staged beside a deferred settlement approval outdates its hanko",
    issue: "review/og-issues-halts-2026-09-28.md, issue 2",
    halts: (ogHalt) => /SETTLEMENT_TRANSITION_PROPOSAL_FAILED:hanko:POST_SETTLEMENT_PROOF_BODY_HASH_MISMATCH:0x/.test(ogHalt),
  },
  {
    // og resolveCommitExecution (entity/consensus/commit/catch-up.ts:219-224) binds the replica's held execution to
    // the committed frame (leader/certificates.ts:364-370) and throws on a different one (candidate-views.ts:13-27):
    // the proposer a view change superseded still holds its own frame's execution when the new leader's commit at
    // that height arrives. diff/leader-timeout.test.ts reaches it on the 2-of-3 board (world.ts B) after one leader
    // timeout, which is how every view change on that board ends while the old leader has proposed.
    name: "a proposer superseded by a view change halts on the new leader's commit",
    issue: "not yet filed; the leader-timeout PR's report carries the draft",
    halts: (ogHalt) => /ENTITY_VALIDATOR_EXECUTION_FRAME_MISMATCH:execution=\d+:0x[0-9a-f]{64}:frame=\d+:0x/.test(ogHalt),
  },
  {
    // og assertProposerJRangesMatchLocalHistory (entity/consensus/j-prefix/prefix-round.ts:32-39, from
    // proposal/start.ts:334) checks every j_event against the committed leader (prefix-round.ts:13;
    // j-event-range-validation/index.ts:127-129): after a leader timeout the new leader proposes a j_event its
    // predecessor signed and forwarded, and og halts. Boards thread, seed 0x30de2 with its vote draws (06a0213).
    name: "a rotated leader proposes its predecessor's j_event",
    issue: "not yet filed; the leader-timeout PR's report carries the draft",
    halts: (ogHalt) => ogHalt.includes("ENTITY_PROPOSER_J_RANGE_INVALID:J_RANGE_NOT_ACTIVE_PROPOSER"),
  },
];
export const knownHalt = (ogHalt: string): KnownHalt | undefined => KNOWN_OG_HALTS.find((k) => k.halts(ogHalt));
