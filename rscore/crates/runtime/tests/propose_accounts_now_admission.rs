//! Runtime admission for the `proposeAccountsNow` recovery marker.
//!
//! Parity targets: `core/runtime/mempool/propose-accounts-now.ts`
//! (`assertProposeAccountsNowTxAuthorized`) and
//! `core/entity/consensus/account/propose-accounts-now-validation.ts`.

use serde_json::{Value, json};
use xln_rscore_runtime::RuntimeEntityInput;

const OWNER: &str = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FIRST: &str = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SECOND: &str = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SIGNER: &str = "0x4444444444444444444444444444444444444444";

fn marker(counterparties: Value) -> Value {
    json!({
        "type": "proposeAccountsNow",
        "data": { "version": 1, "proposerSignerId": SIGNER, "counterparties": counterparties },
    })
}

fn local_input(tx: Value) -> Value {
    json!({ "entityId": OWNER, "signerId": "owner", "entityTxs": [tx] })
}

#[test]
fn a_locally_authored_marker_is_admitted_as_a_protocol_transaction() {
    let input = local_input(marker(json!([FIRST, SECOND])));
    let decoded = RuntimeEntityInput::decode(input.clone()).expect("local marker admission");
    assert_eq!(decoded.canonical(), &input);
    assert!(decoded.has_entity_txs());
    assert_eq!(
        decoded.account_input_count(),
        0,
        "the marker is not an Account input; it only asks the flush to re-send",
    );
}

#[test]
fn a_peer_routed_marker_is_rejected_at_the_runtime_boundary() {
    let mut routed = local_input(marker(json!([FIRST])));
    routed["from"] = json!("0x1111111111111111111111111111111111111111");
    routed["runtimeId"] = json!("0x2222222222222222222222222222222222222222");
    routed["sourceRuntimeFrame"] = json!({ "height": 1, "timestamp": 100 });
    assert_eq!(
        RuntimeEntityInput::decode(routed)
            .expect_err("an external marker must never drive another Entity's flush")
            .to_string(),
        "RUNTIME_ENTITY_INPUT_TRANSPORT_INVALID:PROPOSE_ACCOUNTS_NOW_EXTERNAL_INGRESS_REJECTED",
    );
}

#[test]
fn malformed_marker_payloads_reject_with_the_typescript_codes() {
    let cases = [
        (
            marker(json!([])),
            "RUNTIME_ENTITY_TX_PAYLOAD_INVALID:PROPOSE_ACCOUNTS_NOW_INVALID_PAYLOAD:0",
        ),
        (
            marker(json!([SECOND, FIRST])),
            &format!(
                "RUNTIME_ENTITY_TX_PAYLOAD_INVALID:PROPOSE_ACCOUNTS_NOW_ORDER_INVALID:{SECOND}:{FIRST}"
            ),
        ),
        (
            marker(json!(["0xAA"])),
            "RUNTIME_ENTITY_TX_PAYLOAD_INVALID:PROPOSE_ACCOUNTS_NOW_COUNTERPARTY_INVALID:0xAA",
        ),
        (
            json!({
                "type": "proposeAccountsNow",
                "data": { "version": 2, "proposerSignerId": SIGNER, "counterparties": [FIRST] },
            }),
            "RUNTIME_ENTITY_TX_PAYLOAD_INVALID:PROPOSE_ACCOUNTS_NOW_INVALID_PAYLOAD:1",
        ),
    ];
    for (tx, expected) in cases {
        assert_eq!(
            RuntimeEntityInput::decode(local_input(tx))
                .expect_err("malformed marker")
                .to_string(),
            expected,
        );
    }
}
