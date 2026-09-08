//! Live certified board rotation must be visible to Account verification.
//!
//! Divergence this closes: the Rust Runtime used to answer Account board
//! lookups from a registry copy frozen at restore. A `BoardActivated` committed
//! mid-run left that copy on the old board, so the peer's refreshed frame Hanko
//! was rejected with `ACCOUNT_BOARD_HANKO_REFRESH_CERTIFIED_BOARD_MISSING`
//! while TypeScript accepted it — a silent state split, because a reject is not
//! a halt. The authority now reads the committed Entity state, so this test
//! resolves the rotated board in the same process, without any restore.

use std::collections::{BTreeMap, BTreeSet};

use num_bigint::BigInt;
use serde_json::Value;
use xln_rscore_batch::{AccountInputBoardAuthority, CertifiedBoardAuthorityResolver};
use xln_rscore_engine::{
    BoardActivatedEvent, EntityId, EntityRegisteredEvent, FoundationBootstrappedEvent,
    JEventMetadata, JurisdictionEvent,
};
use xln_rscore_entity_kernel::{
    ConsensusMode, EntityConsensusConfig, EntityFrameAuthority, EntityLeaderState,
    EntityStateSlice, FinalizedJEventBatch, apply_finalized_j_event_batches,
    certified_board_stack_key,
};
use xln_rscore_protocol::{CanonicalNumber, CanonicalValue};
use xln_rscore_runtime::RuntimeEntityState;

const FIXTURE: &str = include_str!("../../../fixtures/certified-board-rotation/rotation-v1.json");

fn canonical(value: &Value) -> CanonicalValue {
    match value {
        Value::Null => CanonicalValue::Null,
        Value::Bool(value) => CanonicalValue::Bool(*value),
        Value::String(value) => CanonicalValue::String(value.clone()),
        Value::Number(value) => CanonicalValue::Number(
            CanonicalNumber::try_from_u64(value.as_u64().expect("fixture unsigned integer"))
                .expect("fixture safe integer"),
        ),
        Value::Array(values) => CanonicalValue::Array(values.iter().map(canonical).collect()),
        Value::Object(fields) => CanonicalValue::Object(
            fields
                .iter()
                .map(|(key, value)| (key.clone(), canonical(value)))
                .collect(),
        ),
    }
}

fn word(value: &str) -> [u8; 32] {
    let bytes = hex::decode(value.strip_prefix("0x").expect("0x prefix")).expect("hex word");
    bytes.try_into().expect("bytes32")
}

fn text(value: &Value) -> &str {
    value.as_str().expect("fixture text")
}

fn metadata(event: &Value) -> JEventMetadata {
    JEventMetadata {
        block_number: Some(event["blockNumber"].as_u64().expect("blockNumber")),
        block_hash: Some(word(text(&event["blockHash"]))),
        transaction_hash: Some(word(text(&event["transactionHash"]))),
        log_index: Some(event["logIndex"].as_u64().expect("logIndex")),
        event_index: None,
    }
}

/// Rebuild the exact J event the TypeScript oracle replayed.
fn j_event(event: &Value) -> JurisdictionEvent {
    let data = &event["data"];
    match text(&event["type"]) {
        "FoundationBootstrapped" => {
            JurisdictionEvent::FoundationBootstrapped(FoundationBootstrappedEvent {
                metadata: metadata(event),
                recipient: hex::decode(text(&data["recipient"]).strip_prefix("0x").expect("0x"))
                    .expect("recipient hex")
                    .try_into()
                    .expect("address"),
                board_hash: word(text(&data["boardHash"])),
                control_token_id: text(&data["controlTokenId"])
                    .parse::<BigInt>()
                    .expect("control token"),
                dividend_token_id: text(&data["dividendTokenId"])
                    .parse::<BigInt>()
                    .expect("dividend token"),
            })
        }
        "EntityRegistered" => JurisdictionEvent::EntityRegistered(EntityRegisteredEvent {
            metadata: metadata(event),
            entity_id: EntityId::parse(text(&data["entityId"])).expect("entity id"),
            entity_number: text(&data["entityNumber"])
                .parse::<BigInt>()
                .expect("entity number"),
            board_hash: word(text(&data["boardHash"])),
        }),
        "BoardActivated" => JurisdictionEvent::BoardActivated(BoardActivatedEvent {
            metadata: metadata(event),
            entity_id: EntityId::parse(text(&data["entityId"])).expect("entity id"),
            previous_board_hash: word(text(&data["previousBoardHash"])),
            new_board_hash: word(text(&data["newBoardHash"])),
            previous_board_valid_until: BigInt::from(
                data["previousBoardValidUntil"]
                    .as_u64()
                    .expect("previousBoardValidUntil"),
            ),
        }),
        other => panic!("unsupported fixture J event: {other}"),
    }
}

fn authority(fixture: &Value, owner: &str) -> EntityFrameAuthority {
    let validator = owner.to_string();
    EntityFrameAuthority {
        config: EntityConsensusConfig {
            mode: ConsensusMode::ProposerBased,
            threshold: 1,
            validators: vec![validator.clone()],
            shares: BTreeMap::from([(validator.clone(), 1)]),
            jurisdiction: Some(canonical(&fixture["jurisdiction"])),
        },
        leader_state: EntityLeaderState {
            active_validator_id: validator,
            view: 0,
            changed_at_height: 0,
        },
    }
}

#[test]
fn board_rotation_committed_by_an_earlier_frame_is_resolved_without_restore() {
    let fixture: Value = serde_json::from_str(FIXTURE).expect("shared rotation fixture");
    let owner = text(&fixture["ownerEntityId"]).to_string();
    let peer = word(text(&fixture["peerEntityId"]));
    let authority = authority(&fixture, &owner);
    assert_eq!(
        certified_board_stack_key(
            authority
                .config
                .jurisdiction
                .as_ref()
                .expect("jurisdiction")
        )
        .expect("stack key"),
        word(text(&fixture["stackKey"])),
        "stack key derivation must match TypeScript",
    );

    let mut state = RuntimeEntityState {
        accounts_root: [0; 32],
        entity: EntityStateSlice::empty(owner, 2_000),
    };
    let events = fixture["events"].as_array().expect("fixture events");
    let steps = fixture["steps"].as_array().expect("fixture steps");
    assert_eq!(events.len(), steps.len());

    let mut before_rotation: Option<RuntimeEntityState> = None;
    for (event, step) in events.iter().zip(steps) {
        if text(&step["event"]) == "BoardActivated" {
            before_rotation = Some(RuntimeEntityState {
                accounts_root: state.accounts_root,
                entity: state.entity.clone(),
            });
        }
        let raw = &event["event"];
        let j_height = raw["blockNumber"].as_u64().expect("blockNumber");
        let batch = FinalizedJEventBatch {
            j_height,
            j_block_hash: word(text(&raw["blockHash"])),
            events: vec![j_event(raw)],
            dispute_finalization_evidence: Vec::new(),
            reserve_updates: Vec::new(),
            account_claims: Vec::new(),
        };
        // One committed frame carrying exactly this J event.
        apply_finalized_j_event_batches(
            &mut state.entity,
            j_height,
            &[batch],
            "certified-board-rotation-fixture",
            Some(&authority),
            &BTreeSet::new(),
            &BTreeMap::new(),
        )
        .expect("production J event ingress");

        let committed = state
            .entity
            .certified_board_state
            .as_ref()
            .expect("committed board tree");
        assert_eq!(
            format!("0x{}", hex::encode(committed.board_registry_root)),
            text(&step["boardRegistryRoot"]),
            "{}: committed boardRegistryRoot",
            text(&step["event"]),
        );

        // The exact resolver `AccountInputRow::resolve_certified_boards` uses.
        let resolved = state
            .certified_board_authority()
            .resolve_certified_board(&peer)
            .expect("board resolution");
        match &step["resolvedPeerBoard"] {
            Value::Null => assert_eq!(
                resolved,
                AccountInputBoardAuthority::Lazy,
                "{}: peer is not registered yet",
                text(&step["event"]),
            ),
            expected => {
                let AccountInputBoardAuthority::Certified(actual) = resolved else {
                    panic!("{}: expected a certified board", text(&step["event"]));
                };
                assert_eq!(actual.entity_id, word(text(&expected["entityId"])));
                assert_eq!(
                    actual.registered_board_hash,
                    word(text(&expected["boardHash"])),
                    "{}: registered board hash",
                    text(&step["event"]),
                );
                assert_eq!(
                    actual.previous_board_hash,
                    word(text(&expected["previousBoardHash"])),
                );
                assert_eq!(
                    actual.previous_board_valid_until,
                    expected["previousBoardValidUntil"]
                        .as_u64()
                        .expect("previousBoardValidUntil"),
                );
                assert_eq!(
                    actual.activated_at_j_height,
                    expected["activatedAtJHeight"]
                        .as_u64()
                        .expect("activatedAtJHeight"),
                );
                assert_eq!(
                    actual.activation_log_index,
                    expected["logIndex"].as_u64().expect("logIndex"),
                );
                assert_eq!(
                    committed
                        .resolve(&peer)
                        .expect("committed record")
                        .board_epoch,
                    expected["boardEpoch"].as_u64().expect("boardEpoch"),
                    "{}: board epoch",
                    text(&step["event"]),
                );
            }
        }
    }

    // The rotation is the regression: no restore happened in this process, and
    // the Account path already answers with the new board.
    let last = steps.last().expect("rotation step");
    assert_eq!(text(&last["event"]), "BoardActivated");
    let rotated = text(&last["resolvedPeerBoard"]["boardHash"]).to_string();
    assert_eq!(
        state
            .certified_board_authority()
            .current_board_hash(&peer)
            .map(|hash| format!("0x{}", hex::encode(hash))),
        Some(rotated.clone()),
    );

    // Adversarial counterexample. Any authority snapshot taken before the
    // rotation still answers the retired board; that is precisely what the
    // restore-time registry copy did for the whole life of the process, and
    // why the peer's refreshed Hanko was rejected while TypeScript accepted it.
    // The only way to stay exact is to read the committed state, as above.
    let stale = before_rotation.expect("state before the rotation");
    let stale_board = stale
        .certified_board_authority()
        .current_board_hash(&peer)
        .map(|hash| format!("0x{}", hex::encode(hash)))
        .expect("registered board");
    assert_ne!(stale_board, rotated);
    assert_eq!(
        stale_board,
        text(&steps[1]["resolvedPeerBoard"]["boardHash"]),
    );
}
