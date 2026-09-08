use num_bigint::BigInt;
use xln_rscore_engine::{AccountTx, LendingAction, TokenId};

use crate::EntityKernelError;
use crate::local_financial::LocalAccountFinancialView;
use crate::types::TargetedAccountTx;

use super::followups::{projected_credit, projected_credit_from};
use super::{LendingLoanStatus, LendingPoolStatus, LendingState};

#[expect(
    clippy::too_many_arguments,
    reason = "the pure lending transition keeps financial authority and output sinks explicit"
)]
pub(super) fn apply_repay(
    lending: &mut LendingState,
    tx: &AccountTx,
    proposer: &str,
    counterparty: &str,
    hub: &str,
    now: u64,
    view: &LocalAccountFinancialView,
    queued: &mut Vec<TargetedAccountTx>,
) -> Result<(), EntityKernelError> {
    let AccountTx::LendingRepay {
        loan_id,
        borrower_entity_id,
        token_id,
        amount,
        ..
    } = tx
    else {
        unreachable!()
    };
    if proposer != borrower_entity_id || proposer != counterparty {
        return Err(EntityKernelError::lending("REPAY_PROPOSER_MISMATCH"));
    }
    let mut loan = lending
        .loan(loan_id)
        .cloned()
        .filter(|loan| loan.status == LendingLoanStatus::Active)
        .ok_or_else(|| EntityKernelError::lending("REPAY_LOAN_NOT_ACTIVE"))?;
    let remaining = &loan.repayment_amount - &loan.repaid_amount;
    if loan.borrower_entity_id != proposer
        || loan.token_id != token_id.get()
        || amount != &remaining
    {
        return Err(EntityKernelError::lending("REPAYMENT_MISMATCH"));
    }
    loan.status = LendingLoanStatus::Closing;
    loan.updated_at = now;
    lending.put_loan(loan.clone())?;
    let current = projected_credit(view, counterparty, *token_id, queued);
    let credit_limit = if current > loan.principal_amount {
        current - &loan.principal_amount
    } else {
        BigInt::from(0)
    };
    queued.push((
        proposer.to_string(),
        AccountTx::LendingCredit {
            action: LendingAction::Revoke,
            loan_id: loan.loan_id,
            hub_entity_id: hub.to_string(),
            borrower_entity_id: proposer.to_string(),
            token_id: *token_id,
            credit_limit,
        },
    ));
    Ok(())
}

#[expect(
    clippy::too_many_arguments,
    reason = "the pure lending transition keeps financial authority and output sinks explicit"
)]
pub(super) fn apply_close_request(
    lending: &mut LendingState,
    tx: &AccountTx,
    proposer: &str,
    counterparty: &str,
    hub: &str,
    now: u64,
    view: &LocalAccountFinancialView,
    queued: &mut Vec<TargetedAccountTx>,
) -> Result<(), EntityKernelError> {
    let AccountTx::LendingCloseRequest {
        position_id,
        lender_entity_id,
        ..
    } = tx
    else {
        unreachable!()
    };
    if proposer != lender_entity_id || proposer != counterparty {
        return Err(EntityKernelError::lending("CLOSE_PROPOSER_MISMATCH"));
    }
    let mut pool = lending
        .pool(position_id)
        .cloned()
        .filter(|pool| pool.status == LendingPoolStatus::Open && pool.lender_entity_id == proposer)
        .ok_or_else(|| EntityKernelError::lending("CLOSE_POSITION_NOT_OPEN"))?;
    if pool.borrowed_amount != BigInt::from(0) {
        return Err(EntityKernelError::lending("CLOSE_ACTIVE_LOANS"));
    }
    if pool.available_amount == BigInt::from(0) {
        pool.status = LendingPoolStatus::Closed;
        pool.updated_at = now;
        return lending.put_pool(pool);
    }
    let token = TokenId::new(u32::from(pool.token_id))
        .map_err(|_| EntityKernelError::lending("TOKEN_ID"))?;
    let capacity = view
        .owner_out_capacity
        .get(&token)
        .cloned()
        .unwrap_or_else(|| BigInt::from(0));
    if capacity < pool.available_amount {
        return Err(EntityKernelError::lending("CLOSE_PAYOUT_CAPACITY"));
    }
    pool.status = LendingPoolStatus::Closing;
    pool.updated_at = now;
    lending.put_pool(pool.clone())?;
    queued.push((
        proposer.to_string(),
        AccountTx::LendingClosePayout {
            position_id: pool.position_id,
            hub_entity_id: hub.to_string(),
            lender_entity_id: proposer.to_string(),
            token_id: token,
            amount: pool.available_amount,
        },
    ));
    Ok(())
}

pub(super) fn apply_close_payout(
    lending: &mut LendingState,
    tx: &AccountTx,
    proposer: &str,
    hub: &str,
    now: u64,
) -> Result<(), EntityKernelError> {
    let AccountTx::LendingClosePayout {
        position_id,
        lender_entity_id,
        token_id,
        amount,
        ..
    } = tx
    else {
        unreachable!()
    };
    if proposer != hub {
        return Err(EntityKernelError::lending("PAYOUT_PROPOSER_MISMATCH"));
    }
    let mut pool = lending
        .pool(position_id)
        .cloned()
        .filter(|pool| pool.status == LendingPoolStatus::Closing)
        .ok_or_else(|| EntityKernelError::lending("PAYOUT_POSITION_NOT_CLOSING"))?;
    if pool.lender_entity_id.as_str() != lender_entity_id
        || pool.token_id != token_id.get()
        || &pool.available_amount != amount
    {
        return Err(EntityKernelError::lending("PAYOUT_MISMATCH"));
    }
    pool.available_amount = BigInt::from(0);
    pool.status = LendingPoolStatus::Closed;
    pool.updated_at = now;
    lending.put_pool(pool)
}

/// Overdue loan settlement — the banking half of the loan lifecycle, and the
/// exact mirror of TS `settleOverdueLendingLoan`.
///
/// A pool's cash never leaves the hub: `LendingFund` moves it lender -> hub and
/// `LendingBorrowRequest` only grants the borrower a credit line against it. So
/// when the term passes unpaid the hub settles it the way a bank does:
///
///  - the lender's principal returns to the pool, because the hub still holds
///    that cash and owes the depositor, not the borrower;
///  - the drawn exposure stays a hub receivable against the borrower — signed
///    bilateral debt a lower credit limit can never erase — so the hub absorbs
///    the credit loss;
///  - the credit line is called in through the same `LendingCredit` revoke the
///    repay path uses, so a defaulted borrower cannot draw again;
///  - `repayment_amount - repaid_amount` stays recorded against the borrower on
///    a terminal `Defaulted` loan. Interest is not earned on a default.
///
/// A loan that no longer qualifies is skipped, never raised: one loan can never
/// halt the Runtime (docs/reject-policy.md).
pub(super) fn settle_overdue(
    lending: &mut LendingState,
    loan_id: &str,
    committed_credit_limit: BigInt,
    hub: &str,
    now: u64,
    queued: &mut Vec<TargetedAccountTx>,
) -> Result<(), EntityKernelError> {
    let Some(mut loan) = lending
        .loan(loan_id)
        .cloned()
        .filter(|loan| loan.status == LendingLoanStatus::Active && loan.due_at <= now)
    else {
        return Ok(());
    };
    let Some(mut pool) = lending
        .pool(&loan.position_id)
        .cloned()
        .filter(|pool| pool.borrowed_amount >= loan.principal_amount)
    else {
        return Ok(());
    };
    let token = TokenId::new(u32::from(loan.token_id))
        .map_err(|_| EntityKernelError::lending("TOKEN_ID"))?;
    loan.status = LendingLoanStatus::Defaulted;
    loan.updated_at = now;
    pool.borrowed_amount -= &loan.principal_amount;
    pool.available_amount += &loan.principal_amount;
    pool.updated_at = now;
    let current = projected_credit_from(
        committed_credit_limit,
        &loan.borrower_entity_id,
        token,
        queued,
    );
    let credit_limit = if current > loan.principal_amount {
        current - &loan.principal_amount
    } else {
        BigInt::from(0)
    };
    queued.push((
        loan.borrower_entity_id.clone(),
        AccountTx::LendingCredit {
            action: LendingAction::Revoke,
            loan_id: loan.loan_id.clone(),
            hub_entity_id: hub.to_string(),
            borrower_entity_id: loan.borrower_entity_id.clone(),
            token_id: token,
            credit_limit,
        },
    ));
    lending.put_loan(loan)?;
    lending.put_pool(pool)
}
