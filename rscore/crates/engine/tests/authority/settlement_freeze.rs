//! Parity target: `getSignedSettlementWorkspaceTxError` applied by
//! core/account/tx/mutation.ts:176-182 before any AccountTx is routed. The
//! TypeScript vector lives in
//! core/__tests__/payments/settlement/settlement-transition.test.ts
//! ("a finalized disputed Account permanently rejects financial Account txs").

use num_bigint::BigInt;
use xln_rscore_engine::{
    AccountExecutionContext, AccountReplica, AccountState, AccountStateSeed, AccountTx,
    AccountVerdict, DeliveryMode, SequentialAccountEngine, Side,
};
use xln_rscore_protocol::{CanonicalNumber, CanonicalValue};

use crate::common::{delta, entity, entity_text, replica, token};

const FROZEN: &str = "SETTLEMENT_SIGNED_ACCOUNT_FROZEN";

fn context() -> AccountExecutionContext {
    AccountExecutionContext::new(2_000, 2_000, 10, 0, 10)
}

fn payment() -> AccountTx {
    AccountTx::DirectPayment {
        token_id: token(1),
        amount: 1.into(),
        route: vec![entity_text(0x22)],
        description: None,
        from_entity_id: entity_text(0x11),
        to_entity_id: entity_text(0x22),
        delivery_mode: DeliveryMode::Direct,
        trusted_gateway_entity_id: None,
    }
}

fn settle(fields: Vec<(&str, CanonicalValue)>) -> AccountTx {
    AccountTx::SettleTransition {
        data: CanonicalValue::Object(
            fields
                .into_iter()
                .map(|(key, value)| (key.to_owned(), value))
                .collect(),
        ),
    }
}

fn number(value: u16) -> CanonicalValue {
    CanonicalValue::Number(CanonicalNumber::from_u16(value))
}

fn upsert(revision: u16) -> AccountTx {
    settle(vec![
        ("kind", CanonicalValue::String("upsert".into())),
        ("revision", number(revision)),
        (
            "ops",
            CanonicalValue::Array(vec![CanonicalValue::Object(vec![
                ("type".into(), CanonicalValue::String("r2r".into())),
                ("tokenId".into(), number(1)),
                ("amount".into(), CanonicalValue::BigInt(10.into())),
            ])]),
        ),
        ("executorIsLeft", CanonicalValue::Bool(true)),
    ])
}

fn base() -> AccountReplica {
    replica(
        entity(0x11),
        entity(0x11),
        entity(0x22),
        vec![delta(token(1), 1_000, 0, 0, 500, 500)],
    )
}

/// The committed replica after one unsigned upsert: workspace present, holds
/// planned, nothing signed.
fn with_unsigned_workspace() -> AccountReplica {
    SequentialAccountEngine::apply_with_context(&base(), Side::Left, &upsert(1), &context())
        .expect("upsert")
        .committed()
        .expect("unsigned workspace candidate")
}

/// The same committed workspace with one signature marker attached, restored
/// through the public checkpoint seed exactly as a Rust hub would hold it.
fn with_signed_workspace(marker: (&str, CanonicalValue)) -> AccountReplica {
    let unsigned = with_unsigned_workspace();
    let CanonicalValue::Object(mut fields) = unsigned
        .state()
        .settlement_workspace()
        .expect("workspace")
        .clone()
    else {
        panic!("workspace is an object");
    };
    fields.push((marker.0.to_owned(), marker.1));
    let state = AccountState::restore_full(AccountStateSeed {
        identity: unsigned.state().identity().clone(),
        dispute_config: unsigned.state().dispute_config(),
        deltas: vec![unsigned.state().delta(token(1)).expect("delta").clone()],
        locks: Vec::new(),
        j_nonce: 0,
        last_finalized_j_height: 0,
        carried: Default::default(),
        rebalance_fee_policies: Vec::new(),
        swap_offers: Vec::new(),
        lending_intents: Vec::new(),
        pulls: Vec::new(),
        settlement_workspace: Some(CanonicalValue::Object(fields)),
    })
    .expect("signed state");
    AccountReplica::new(entity(0x11), state).expect("signed replica")
}

fn workspace_hash(account: &AccountReplica) -> String {
    let CanonicalValue::Object(fields) = account.state().settlement_workspace().expect("workspace")
    else {
        panic!("workspace is an object");
    };
    fields
        .iter()
        .find_map(|(key, value)| match value {
            CanonicalValue::String(hash) if key == "workspaceHash" => Some(hash.clone()),
            _ => None,
        })
        .expect("workspaceHash")
}

#[test]
fn settlement_freeze_rejects_financial_tx_over_signed_workspace() {
    // Presence alone freezes nothing: the payment still lands over an
    // unsigned workspace.
    let unsigned = with_unsigned_workspace();
    let open =
        SequentialAccountEngine::apply_with_context(&unsigned, Side::Left, &payment(), &context())
            .expect("unsigned workspace payment");
    assert_eq!(open.verdict(), &AccountVerdict::Applied);

    for marker in [
        ("leftHanko", CanonicalValue::String("0x01".into())),
        ("rightHanko", CanonicalValue::String("0x02".into())),
        (
            "settlementHash",
            CanonicalValue::String(format!("0x{}", "55".repeat(32))),
        ),
        (
            "postSettlementDisputeProof",
            CanonicalValue::Object(Vec::new()),
        ),
    ] {
        let label = marker.0;
        let signed = with_signed_workspace(marker);
        let before = signed.state().deltas_root();
        let hash = workspace_hash(&signed);
        let frozen = [
            (payment(), "direct_payment"),
            (
                AccountTx::SetCreditLimit {
                    token_id: token(1),
                    amount: BigInt::from(5),
                },
                "set_credit_limit",
            ),
            (upsert(2), "settle_transition"),
            (
                settle(vec![
                    ("kind", CanonicalValue::String("clear".into())),
                    ("revision", number(1)),
                    ("workspaceHash", CanonicalValue::String(hash.clone())),
                ]),
                "settle_transition",
            ),
        ];
        for (tx, tx_type) in frozen {
            let result =
                SequentialAccountEngine::apply_with_context(&signed, Side::Left, &tx, &context())
                    .expect("typed freeze rejection");
            let AccountVerdict::Rejected(rejection) = result.verdict() else {
                panic!("{label}: {tx_type} applied over a signed workspace");
            };
            assert_eq!(rejection.code(), FROZEN, "{label}: {tx_type}");
            assert_eq!(rejection.message(), format!("{FROZEN}:{tx_type}"));
            assert!(result.candidate().is_none());
            assert!(result.events().is_empty());
            assert!(result.outputs().is_empty());
        }
        assert_eq!(signed.state().deltas_root(), before);
    }

    // TypeScript truthiness: an empty settlementHash is no signature.
    let blank = with_signed_workspace(("settlementHash", CanonicalValue::String(String::new())));
    let result =
        SequentialAccountEngine::apply_with_context(&blank, Side::Left, &payment(), &context())
            .expect("blank marker payment");
    assert_eq!(result.verdict(), &AccountVerdict::Applied);
}

/// The kinds that finish a signed settlement pass the freeze and reach their
/// own handler, which then judges them on their merits.
#[test]
fn settlement_freeze_exempts_hanko_and_submit_completion() {
    let signed = with_signed_workspace(("leftHanko", CanonicalValue::String("0x01".into())));
    let hash = workspace_hash(&signed);
    for kind in ["hanko", "submit"] {
        let tx = settle(vec![
            ("kind", CanonicalValue::String(kind.into())),
            ("revision", number(1)),
            ("workspaceHash", CanonicalValue::String(hash.clone())),
        ]);
        let result =
            SequentialAccountEngine::apply_with_context(&signed, Side::Left, &tx, &context())
                .expect("exempt kind reaches its handler");
        let AccountVerdict::Rejected(rejection) = result.verdict() else {
            panic!("{kind} without its evidence applied");
        };
        assert_eq!(rejection.code(), "ACCOUNT_TX_VALIDATION", "{kind}");
        assert_ne!(rejection.code(), FROZEN, "{kind}");
    }
}
