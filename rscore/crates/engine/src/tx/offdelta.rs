use num_bigint::BigInt;

use crate::{AccountReplica, Delta, Side, TokenId, ValidationRejection};

pub(crate) enum HtlcChange<'a> {
    Add { sender: Side, amount: &'a BigInt },
    Remove { lock_id: &'a str },
}

fn rejection(value: &BigInt) -> ValidationRejection {
    ValidationRejection::AccountTx {
        message: format!("Offdelta outside int512: {value}"),
    }
}

fn add_outcome(low: &mut BigInt, high: &mut BigInt, sender: Side, amount: &BigInt) {
    match sender {
        Side::Left => *low -= amount,
        Side::Right => *high += amount,
    }
}

/// Only the bounded live HTLC collection changes conditional offdelta.
/// Opposite hashlocks cannot net: either secret may resolve independently.
/// Reserve/settlement holds are excluded because they do not move offdelta.
pub(crate) fn validate_htlc_reachable(
    account: &AccountReplica,
    delta: &Delta,
    change: Option<HtlcChange<'_>>,
) -> Result<(), ValidationRejection> {
    validate_reachable(account, delta.token_id(), delta.offdelta(), change)
}

pub(crate) fn validate_transfer(
    account: &AccountReplica,
    delta: &Delta,
    sender: Side,
    amount: &BigInt,
    change: Option<HtlcChange<'_>>,
) -> Result<(), ValidationRejection> {
    validate_reachable(
        account,
        delta.token_id(),
        &delta.transfer_offdelta(sender, amount),
        change,
    )
}

fn validate_reachable(
    account: &AccountReplica,
    token_id: TokenId,
    offdelta: &BigInt,
    change: Option<HtlcChange<'_>>,
) -> Result<(), ValidationRejection> {
    let mut low = offdelta.clone();
    let mut high = low.clone();
    for lock in account.state().htlc_locks() {
        let removed =
            matches!(&change, Some(HtlcChange::Remove { lock_id }) if *lock_id == lock.lock_id());
        if lock.token_id() == token_id && !removed {
            add_outcome(&mut low, &mut high, lock.sender(), lock.amount());
        }
    }
    if let Some(HtlcChange::Add { sender, amount }) = change {
        add_outcome(&mut low, &mut high, sender, amount);
    }
    let boundary = BigInt::from(1) << 511_usize;
    if low < -&boundary {
        return Err(rejection(&low));
    }
    if high >= boundary {
        return Err(rejection(&high));
    }
    Ok(())
}
