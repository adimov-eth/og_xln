use std::sync::Arc;

use num_bigint::BigInt;
use xln_rscore_engine::{
    AccountExecutionContext, AccountReplica, AccountTx, AccountVerdict, DeliveryMode, Delta,
    SequentialAccountEngine, Side, SwapMarketPolicy, SwapToken, build_dispute_proof,
};

use crate::common::{entity, entity_text, replica, token};
use crate::htlc_support;

fn collateral_account(amount: &BigInt) -> AccountReplica {
    let row = Delta::new(
        token(1),
        amount.clone(),
        amount.clone(),
        0.into(),
        0.into(),
        0.into(),
        0.into(),
        0.into(),
        0.into(),
        0.into(),
    )
    .expect("representable collateral row");
    replica(entity(0x11), entity(0x11), entity(0x22), vec![row])
}

#[test]
fn direct_payment_full_uint256_commits_and_builds_dispute_proof() {
    let amount = (BigInt::from(1_u8) << 256_usize) - 1_u8;
    let base = collateral_account(&amount);
    let transition = SequentialAccountEngine::apply(
        &base,
        Side::Left,
        &AccountTx::DirectPayment {
            token_id: token(1),
            amount: amount.clone(),
            route: vec![entity_text(0x22)],
            description: None,
            from_entity_id: entity_text(0x11),
            to_entity_id: entity_text(0x22),
            delivery_mode: DeliveryMode::Direct,
            trusted_gateway_entity_id: None,
        },
    )
    .expect("direct payment transition");
    assert_eq!(transition.verdict(), &AccountVerdict::Applied);
    let candidate = transition.candidate().expect("payment candidate");
    assert_eq!(
        candidate.state().delta(token(1)).expect("delta").offdelta(),
        &-amount
    );
    build_dispute_proof(candidate, &[0x33; 20], 1).expect("settleable payment proof");
}

#[test]
fn htlc_lock_full_uint256_commits_and_builds_dispute_proof() {
    let amount = (BigInt::from(1_u8) << 256_usize) - 1_u8;
    let base = collateral_account(&amount);
    let transition = SequentialAccountEngine::apply_with_context(
        &base,
        Side::Left,
        &htlc_support::lock_tx(htlc_support::HASHLOCK, amount.clone()),
        &htlc_support::execution_context(1_000, 10),
    )
    .expect("HTLC lock transition");
    assert_eq!(transition.verdict(), &AccountVerdict::Applied);
    let candidate = transition.candidate().expect("lock candidate");
    assert_eq!(
        candidate
            .state()
            .delta(token(1))
            .expect("delta")
            .hold(Side::Left),
        &amount
    );
    build_dispute_proof(candidate, &[0x33; 20], 1).expect("settleable lock proof");
}

#[test]
fn set_credit_limit_full_uint256_commits() {
    let amount = (BigInt::from(1_u8) << 256_usize) - 1_u8;
    let base = collateral_account(&0.into());
    let transition = SequentialAccountEngine::apply(
        &base,
        Side::Left,
        &AccountTx::SetCreditLimit {
            token_id: token(1),
            amount: amount.clone(),
        },
    )
    .expect("credit grant transition");
    assert_eq!(transition.verdict(), &AccountVerdict::Applied);
    let candidate = transition.candidate().expect("credit candidate");
    assert_eq!(
        candidate
            .state()
            .delta(token(1))
            .expect("delta")
            .right_credit_limit(),
        &amount
    );
    build_dispute_proof(candidate, &[0x33; 20], 1).expect("unchanged exposure proof");
}

#[test]
fn swap_offer_and_resolve_full_uint256_preserve_both_token_deltas() {
    let amount = (BigInt::from(1_u8) << 256_usize) - 1_u8;
    let rows = vec![
        Delta::new(
            token(1),
            amount.clone(),
            amount.clone(),
            0.into(),
            0.into(),
            0.into(),
            0.into(),
            0.into(),
            0.into(),
            0.into(),
        )
        .expect("maker collateral"),
        Delta::new(
            token(2),
            amount.clone(),
            0.into(),
            0.into(),
            0.into(),
            0.into(),
            0.into(),
            0.into(),
            0.into(),
            0.into(),
        )
        .expect("taker collateral"),
    ];
    let base = replica(entity(0x11), entity(0x11), entity(0x22), rows);
    let context = AccountExecutionContext::with_market(
        1_000,
        1_000,
        10,
        1,
        10,
        Arc::new(SwapMarketPolicy::new(
            vec![
                SwapToken {
                    token_id: 1,
                    decimals: 6,
                    liquid: false,
                },
                SwapToken {
                    token_id: 2,
                    decimals: 6,
                    liquid: true,
                },
            ],
            vec![],
        )),
    );
    let offered = SequentialAccountEngine::apply_with_context(
        &base,
        Side::Left,
        &AccountTx::SwapOffer {
            offer_id: "wide-swap".into(),
            give_token_id: 1,
            give_token_decimals: 6,
            give_amount: amount.clone(),
            want_token_id: 2,
            want_token_decimals: 6,
            want_amount: amount.clone(),
            max_fee: 0.into(),
            min_net_receive: amount.clone(),
            time_in_force: None,
            price_ticks: None,
            cross_jurisdiction: None,
        },
        &context,
    )
    .expect("swap offer transition");
    assert_eq!(offered.verdict(), &AccountVerdict::Applied);
    let resting = offered.candidate().expect("resting swap");
    build_dispute_proof(resting, &[0x33; 20], 1).expect("settleable resting swap proof");
    let resolved = SequentialAccountEngine::apply_with_context(
        resting,
        Side::Right,
        &AccountTx::SwapResolve {
            offer_id: "wide-swap".into(),
            fill_ratio: 65_535,
            fill_numerator: None,
            fill_denominator: None,
            cancel_remainder: false,
            comment: None,
            fee_token_id: None,
            fee_amount: None,
            execution_give_amount: Some(amount.clone()),
            execution_want_amount: Some(amount.clone()),
            resting_give_token_id: None,
            resting_want_token_id: None,
            resting_price_ticks: None,
            resting_give_amount: None,
            resting_want_amount: None,
            resting_quantized_give: None,
            resting_quantized_want: None,
        },
        &context,
    )
    .expect("swap resolve transition");
    assert_eq!(resolved.verdict(), &AccountVerdict::Applied);
    let candidate = resolved.candidate().expect("resolved swap");
    assert_eq!(
        candidate
            .state()
            .delta(token(1))
            .expect("give delta")
            .offdelta(),
        &-&amount
    );
    assert_eq!(
        candidate
            .state()
            .delta(token(2))
            .expect("want delta")
            .offdelta(),
        &amount
    );
    assert_eq!(candidate.state().swap_offer_count(), 0);
    build_dispute_proof(candidate, &[0x33; 20], 2).expect("settleable completed swap proof");
}
