import { createStructuredLogger } from '../../../support/logger';
import type { RoutedEntityInput, RuntimeInput, RuntimeReplica } from '../../types';
import { RuntimeEntityInputApplyError } from '../../mempool/entity-inputs';
import { ENV_REPLAY_MODE_KEY, readRuntimeMetadata } from '../../loop/loop-environment.ts';
import { safeStringify } from '../../../protocol/serialization';
import { haltRuntimeFailure } from '../../../protocol/errors/failure-taxonomy';
import { rejectFailFast } from '../../../support/process/runtime-process';

const discardLog = createStructuredLogger('runtime.input_discard');

/**
 * One rejected ingress item recorded by the RJEA transition for the Runtime
 * loop. The transition decides the typed reject without reading process env;
 * the loop applies the policy exactly once per frame attempt.
 *
 * - `remote`: an authenticated peer EntityInput was rejected as a whole.
 * - `peer-evidence`: a counterparty Account frame was rejected inside the
 *   Account transition and its exact parent Entity tx was evicted.
 * - `local`: the Runtime's own command/tx was rejected. Never a halt.
 */
export type RejectedEntityIngressEvidence = Readonly<{
  /**
   * `deferral` is this Runtime's own bounded-work cap, not a rejected sender:
   * the remaining queue simply waits for the next wake, so the policy must not
   * surface it. Every other origin names a transaction that was rejected.
   */
  origin: 'remote' | 'peer-evidence' | 'local' | 'deferral';
  entityId: string;
  signerId: string;
  sourceRuntimeId: string | undefined;
  rejectionCode: string;
  txType?: string;
}>;

const rejectedIngressHalt = (evidence: RejectedEntityIngressEvidence, count: number): Error =>
  haltRuntimeFailure(
    'REMOTE_INPUT_REJECTED',
    `REMOTE_INPUT_REJECTED: entity=${evidence.entityId} signer=${evidence.signerId} ` +
      `source=${evidence.sourceRuntimeId ?? 'local'} origin=${evidence.origin} ` +
      `cause=${evidence.rejectionCode}${count > 1 ? ` rejected=${count}` : ''}`,
  );

/**
 * The one reject-policy read of a Runtime frame attempt (docs/reject-policy.md).
 *
 * `surface` (fail-fast: tests, dev, CI) hands the typed rejection back to the
 * caller of the Runtime loop so a hostile peer or a Runtime bug cannot hide in
 * a log line. `drop` (production, `XLN_REJECT_FAIL_FAST=0`) keeps serving.
 * Nothing inside the R → E → A cascade may call this: the transition only
 * records the typed rejection, the loop decides what the frame does with it.
 */
const rejectedIngressPolicy = (): 'surface' | 'drop' =>
  rejectFailFast() ? 'surface' : 'drop';

/**
 * The Runtime loop's reject-policy point for rejections decided inside an
 * applied frame. Every item was already logged and dropped per tx by the
 * transition; fail-fast (tests/dev) turns the first sender-caused one into a
 * halt so a hostile or buggy peer surfaces, production keeps serving.
 * A local rejection never halts here: the exact tx was evicted, the rest of
 * the signer's queue was certified, and the bounded per-frame eviction cap
 * reports itself through this same list without being a defect.
 */
export const applyRejectedIngressPolicy = (
  rejections: readonly RejectedEntityIngressEvidence[],
): void => {
  const senderCaused = rejections.filter(candidate => candidate.origin !== 'deferral');
  const [first] = senderCaused;
  if (!first || rejectedIngressPolicy() === 'drop') return;
  throw rejectedIngressHalt(first, senderCaused.length);
};

const sameRejectedOrigin = (
  input: RoutedEntityInput,
  error: RuntimeEntityInputApplyError,
  sourceRuntimeId: string | undefined,
): boolean =>
  input.entityId.toLowerCase() === error.entityId.toLowerCase() &&
  String(input.signerId || '').trim().toLowerCase() === error.signerId.trim().toLowerCase() &&
  String(input.from || '').trim().toLowerCase() === (sourceRuntimeId ?? '').toLowerCase();

/**
 * Remove only the origin that produced a malformed EntityInput before the
 * frame mutated anything (ingress validation).
 *
 * Runtime may reduce a remote envelope beside a locally generated scheduler
 * wake for the same Entity replica. Transport provenance remains attached to
 * the original Runtime inputs, so rollback can remove only the hostile origin
 * and retain the local wake. Every unrelated RuntimeTx, JInput,
 * ReliableReceipt, and EntityInput is returned to the single Runtime mempool.
 *
 * We intentionally keep no rejected-input state or payload archive. Untrusted
 * bytes are neither consensus data nor history; retaining them would let an
 * attacker grow durable Runtime state without ever producing a valid frame.
 *
 * Replay never discards: a rejected input has no WAL row, so meeting one in
 * replay is a contradiction that must surface, not a policy decision.
 *
 * Classification and the audit line are env-free and identical in every mode.
 * Only the last step reads the loop's reject policy: `drop` (production) hands
 * back the surviving lanes so the frame retries without the rejected origin;
 * `surface` (fail-fast default) returns null, which keeps the exact attempted
 * input queued for the operator and lets the typed rejection reach the caller
 * of the Runtime loop unchanged. Scenarios and direct `processRuntime` callers
 * take this same path — neither owns a private halt branch.
 */
export const discardRejectedEntityInput = (
  env: RuntimeReplica,
  input: RuntimeInput,
  error: unknown,
): RuntimeInput | null => {
  if (readRuntimeMetadata(env, ENV_REPLAY_MODE_KEY) === true) return null;
  if (!(error instanceof RuntimeEntityInputApplyError) || !error.isDiscardableIngress) {
    return null;
  }
  const sourceRuntimeId = error.sourceRuntimeId;
  const rejected = input.entityInputs.filter(candidate =>
    sameRejectedOrigin(candidate, error, sourceRuntimeId));
  if (rejected.length === 0) return null;
  const remaining: RuntimeInput = {
    runtimeTxs: input.runtimeTxs,
    entityInputs: input.entityInputs.filter(candidate =>
      !sameRejectedOrigin(candidate, error, sourceRuntimeId)),
    ...(input.jInputs !== undefined ? { jInputs: input.jInputs } : {}),
    ...(input.timestamp !== undefined ? { timestamp: input.timestamp } : {}),
    ...(input.queuedAt !== undefined ? { queuedAt: input.queuedAt } : {}),
  };

  const cause = error.cause instanceof Error ? error.cause.message : String(error.cause);
  const payload = {
    action: 'discarded',
    entityId: error.entityId,
    signerId: error.signerId,
    sourceRuntimeId: error.sourceRuntimeId ?? null,
    sourceRuntimeHeight: error.sourceRuntimeHeight ?? null,
    discardedInputs: rejected.length,
    txTypes: rejected.flatMap(candidate => candidate.entityTxs?.map(tx => tx.type) ?? []),
    cause,
    rejectedInputsDump: safeStringify(rejected),
  };
  // Rejected ingress has no WAL row: this evidence must survive quiet mode.
  // It is the audit trail of hostile/buggy peers (docs/reject-policy.md).
  discardLog.error('entity_input.discarded', payload);
  if (rejectedIngressPolicy() === 'surface') return null;
  return remaining;
};

export class RuntimeInputDiscardedError extends Error {
  constructor(cause: Error) {
    super(`RUNTIME_ENTITY_INPUT_DISCARDED:${cause.message}`, { cause });
    this.name = 'RuntimeInputDiscardedError';
  }
}
