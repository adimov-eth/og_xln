/**
 * Entity-side validation for the `proposeAccountsNow` recovery marker.
 *
 * The marker enters through Runtime, but Entity consensus must be able to
 * judge its payload from committed EntityState alone: a validator replaying a
 * proposed frame never sees the proposer's transport. Keeping the check here
 * stops the inner machine from depending on its Runtime orchestrator.
 */
import type { EntityState } from '../../types';
import type { EntityTx } from '../../../types/entity-tx';
import { getEntityLeaderState } from '../leader';
import { compareStableText } from '../../../protocol/serialization';

export type ProposeAccountsNowTx = Extract<EntityTx, { type: 'proposeAccountsNow' }>;

/**
 * One recovery marker is bounded work, not a scan of the whole Account set.
 * The producer emits the canonical ascending prefix; anything longer is a
 * malformed payload and is rejected rather than silently truncated here.
 */
export const MAX_PROPOSE_ACCOUNTS_NOW_COUNTERPARTIES = 1_000;

const MAX_COUNTERPARTY_ID_LENGTH = 256;

/**
 * Security note: the only authority this marker carries is "the active leader
 * asked its own Entity to re-send bytes it already signed". The signer must be
 * the current leader, the list must be canonical so two proposers cannot
 * produce two different valid encodings of the same intent, and the handler
 * reads the response bytes from committed state — never from this payload.
 * An adversarial peer that forges the list can therefore only ask for retained
 * proposals it was already owed; it can neither mint nor alter one.
 */
export const assertProposeAccountsNowMatchesState = (
  state: EntityState,
  tx: ProposeAccountsNowTx,
): void => {
  const proposerSignerId = getEntityLeaderState(state).activeValidatorId;
  if (!proposerSignerId || proposerSignerId.toLowerCase() !== tx.data.proposerSignerId.toLowerCase()) {
    throw new Error('PROPOSE_ACCOUNTS_NOW_PROPOSER_MISMATCH');
  }
  const { version, counterparties } = tx.data;
  if (
    version !== 1 ||
    !Array.isArray(counterparties) ||
    counterparties.length === 0 ||
    counterparties.length > MAX_PROPOSE_ACCOUNTS_NOW_COUNTERPARTIES
  ) {
    throw new Error(
      `PROPOSE_ACCOUNTS_NOW_INVALID_PAYLOAD:${Array.isArray(counterparties) ? counterparties.length : 'not-array'}`,
    );
  }
  let previous = '';
  for (const counterparty of counterparties) {
    if (
      typeof counterparty !== 'string' ||
      counterparty.length === 0 ||
      counterparty.length > MAX_COUNTERPARTY_ID_LENGTH ||
      counterparty !== counterparty.toLowerCase()
    ) {
      throw new Error(`PROPOSE_ACCOUNTS_NOW_COUNTERPARTY_INVALID:${String(counterparty)}`);
    }
    if (previous !== '' && compareStableText(previous, counterparty) >= 0) {
      throw new Error(`PROPOSE_ACCOUNTS_NOW_ORDER_INVALID:${previous}:${counterparty}`);
    }
    previous = counterparty;
  }
};
