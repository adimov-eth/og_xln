import type { AccountTx } from '../../../../types/account';
import type { EntityState } from '../../../types';
import { getAccountOutCapacity, projectedHubCreditLimit } from '../../../../extensions/lending';
import type { LendingFollowupContext } from './committed-lending-followup';
import type { AccountTxTarget } from './orderbook/queue';
import { createStructuredLogger, shortId } from '../../../../support/logger';

const lendingLog = createStructuredLogger('entity.lending');

const normalizeEntityRef = (value: unknown): string =>
  String(value || '').toLowerCase();

export function applyLendingCloseRequest(
  context: LendingFollowupContext,
  tx: Extract<AccountTx, { type: 'lending_close_request' }>,
): void {
  const {
    account,
    lending,
    hubEntityId,
    counterpartyId,
    proposer,
    now,
    accountTxs,
  } = context;
  if (
    proposer !== normalizeEntityRef(tx.data.lenderEntityId) ||
    proposer !== counterpartyId
  ) {
    throw new Error(`LENDING_CLOSE_PROPOSER_MISMATCH:${tx.data.positionId}`);
  }
  const pool = lending.pools.get(tx.data.positionId);
  if (!pool || pool.status !== 'open' || pool.lenderEntityId !== proposer) {
    throw new Error(`LENDING_CLOSE_POSITION_NOT_OPEN:${tx.data.positionId}`);
  }
  if (pool.borrowedAmount !== 0n) {
    throw new Error(`LENDING_CLOSE_ACTIVE_LOANS:${pool.positionId}`);
  }
  if (pool.availableAmount === 0n) {
    pool.status = 'closed';
    pool.updatedAt = now;
    return;
  }
  const payoutCapacity = getAccountOutCapacity(account.state, hubEntityId, pool.tokenId);
  if (payoutCapacity < pool.availableAmount) {
    throw new Error(
      `LENDING_CLOSE_PAYOUT_CAPACITY: available=${payoutCapacity} ` +
      `required=${pool.availableAmount}`,
    );
  }
  pool.status = 'closing';
  pool.updatedAt = now;
  accountTxs.push({
    accountId: proposer,
    tx: {
      type: 'lending_close_payout',
      data: {
        positionId: pool.positionId,
        hubEntityId,
        lenderEntityId: proposer,
        tokenId: pool.tokenId,
        amount: pool.availableAmount,
      },
    },
  });
}

export function applyLendingClosePayout(
  context: LendingFollowupContext,
  tx: Extract<AccountTx, { type: 'lending_close_payout' }>,
): void {
  const { lending, hubEntityId, proposer, now } = context;
  if (proposer !== hubEntityId) {
    throw new Error(`LENDING_PAYOUT_PROPOSER_MISMATCH:${tx.data.positionId}`);
  }
  const pool = lending.pools.get(tx.data.positionId);
  if (!pool || pool.status !== 'closing') {
    throw new Error(`LENDING_PAYOUT_POSITION_NOT_CLOSING:${tx.data.positionId}`);
  }
  if (
    pool.lenderEntityId !== normalizeEntityRef(tx.data.lenderEntityId) ||
    pool.tokenId !== tx.data.tokenId ||
    pool.availableAmount !== tx.data.amount
  ) {
    throw new Error(`LENDING_PAYOUT_MISMATCH:${tx.data.positionId}`);
  }
  pool.availableAmount = 0n;
  pool.status = 'closed';
  pool.updatedAt = now;
}

/**
 * Overdue loan settlement — the banking half of the loan lifecycle.
 *
 * A pool's cash never leaves the hub: `lending_fund` moves it lender -> hub and
 * `lending_borrow_request` only grants the borrower a credit line against it.
 * So when the term passes unpaid the hub settles it the way a bank does with a
 * defaulted customer loan:
 *
 *  - the lender's principal returns to the pool, because the hub still holds
 *    that cash and owes the depositor, not the borrower;
 *  - the drawn exposure stays a hub receivable against the borrower — signed
 *    bilateral debt that a lower credit limit can never erase (deriveDelta
 *    keeps `outPeerCredit`), so the hub absorbs the credit loss;
 *  - the credit line is called in through the same `lending_credit` revoke the
 *    repay path uses, so a defaulted borrower cannot draw again;
 *  - `repaymentAmount - repaidAmount` stays recorded against the borrower on a
 *    terminal `defaulted` loan. Interest is not earned on a default.
 *
 * Every failure here is caused by one loan and is dropped with evidence: a
 * single bad loan never halts the Runtime (docs/reject-policy.md).
 */
export const settleOverdueLendingLoan = (
  state: EntityState,
  loanId: string,
  accountTxs: AccountTxTarget[],
): void => {
  const lending = state.lending;
  const loan = lending?.loans.get(loanId);
  if (!lending || !loan || loan.status !== 'active' || loan.dueAt > state.timestamp) return;
  const pool = lending.pools.get(loan.positionId);
  const account = state.accounts.get(loan.borrowerEntityId);
  if (!pool || !account || pool.borrowedAmount < loan.principalAmount) {
    lendingLog.warn('lending_overdue.unsettled', {
      loanId,
      borrower: shortId(loan.borrowerEntityId),
      reason: !pool ? 'pool-missing' : !account ? 'account-missing' : 'pool-borrowed-underflow',
    });
    return;
  }
  const now = state.timestamp;
  loan.status = 'defaulted';
  loan.updatedAt = now;
  pool.borrowedAmount -= loan.principalAmount;
  pool.availableAmount += loan.principalAmount;
  pool.updatedAt = now;
  const hubEntityId = String(state.entityId).toLowerCase();
  const currentLimit = projectedHubCreditLimit(
    account,
    hubEntityId,
    loan.borrowerEntityId,
    accountTxs,
    loan.tokenId,
  );
  accountTxs.push({
    accountId: loan.borrowerEntityId,
    tx: {
      type: 'lending_credit',
      data: {
        action: 'revoke',
        loanId,
        hubEntityId,
        borrowerEntityId: loan.borrowerEntityId,
        tokenId: loan.tokenId,
        creditLimit:
          currentLimit > loan.principalAmount ? currentLimit - loan.principalAmount : 0n,
      },
    },
  });
  lendingLog.warn('lending_overdue.defaulted', {
    loanId,
    borrower: shortId(loan.borrowerEntityId),
    outstanding: (loan.repaymentAmount - loan.repaidAmount).toString(),
    releasedPrincipal: loan.principalAmount.toString(),
  });
};
