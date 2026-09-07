#[path = "../common/mod.rs"]
mod common;

use common::{entity, entity_text, replica, token};
use xln_rscore_engine::{
    AccountTx, AccountVerdict, Delta, LendingIntentKind, LendingTermId, SequentialAccountEngine,
    Side,
};

#[test]
fn lending_fund_requires_unreserved_owned_assets_in_both_directions() {
    // Same concrete amounts as TypeScript lending-funding.test.ts. Never fund
    // a pool by spending permission to borrow, including when owned funds are held.
    let vectors: [(i64, i64, i64, i64, bool); 7] = [
        (0, 100, 0, 100, false),
        (100, 0, 0, 100, true),
        (40, 100, 0, 41, false),
        (40, 100, 0, 40, true),
        (100, 100, 60, 41, false),
        (100, 100, 60, 40, true),
        (-20, 100, 0, 1, false),
    ];
    for side in [Side::Left, Side::Right] {
        let left = side == Side::Left;
        for (owned, credit, hold, amount, accepted) in vectors {
            let old_offdelta = if left { owned } else { -owned };
            let delta = Delta::new(
                token(1),
                0.into(),
                0.into(),
                old_offdelta.into(),
                (if left { credit } else { 100 }).into(),
                (if left { 100 } else { credit }).into(),
                0.into(),
                0.into(),
                (if left { hold } else { 0 }).into(),
                (if left { 0 } else { hold }).into(),
            )
            .expect("valid delta");
            let base = replica(entity(0x10), entity(0x10), entity(0x20), vec![delta]);
            let before = base
                .state()
                .payment_profile_account_state_root()
                .expect("root");
            let tx = AccountTx::LendingFund {
                position_id: "lend-1111111111111111".into(),
                hub_entity_id: entity_text(if left { 0x20 } else { 0x10 }),
                lender_entity_id: entity_text(if left { 0x10 } else { 0x20 }),
                token_id: token(1),
                amount: amount.into(),
                term_id: LendingTermId::OneDay,
                interest_bps: 100,
            };
            let transition = SequentialAccountEngine::apply(&base, side, &tx).expect("transition");
            assert_eq!(
                transition.verdict() == &AccountVerdict::Applied,
                accepted,
                "side={side:?} owned={owned} credit={credit} hold={hold} amount={amount}"
            );
            assert_eq!(
                base.state()
                    .payment_profile_account_state_root()
                    .expect("root"),
                before
            );
            if accepted {
                let candidate = transition.candidate().expect("candidate");
                assert_eq!(
                    candidate.state().delta(token(1)).expect("delta").offdelta(),
                    &(old_offdelta + if left { -amount } else { amount }).into()
                );
                assert_eq!(
                    candidate
                        .state()
                        .lending_intent("fund:lend-1111111111111111"),
                    Some(LendingIntentKind::Fund)
                );
            } else {
                assert!(transition.candidate().is_none());
                assert_eq!(base.state().lending_intent_count(), 0);
            }
        }
    }
}
