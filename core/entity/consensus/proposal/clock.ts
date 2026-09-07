import type { EntityRuntimeContext } from '../../runtime-context';
import type { EntityState } from '../../types';

/**
 * Frame clock of a local proposal.
 *
 * A validator accepts a remote frame up to `TIMING.TIMESTAMP_DRIFT_MS` ahead
 * of its own Runtime clock (proposal pre-authentication), so the committed
 * Entity timestamp can exceed this Runtime's clock. The Entity frame clock is
 * monotone (`ENTITY_FRAME_TIMESTAMP_REGRESSION`), so when that validator leads
 * the next frame it must propose at the committed clock, never behind it.
 * Single-signer Entities only ever commit their own clock, so this is the
 * identity for them.
 */
export const resolveEntityProposalTimestamp = (
  env: Pick<EntityRuntimeContext, 'state'>,
  committed: Pick<EntityState, 'timestamp'>,
): number => Math.max(env.state.timestamp, committed.timestamp);
