use std::{collections::BTreeMap, sync::Arc};

use num_bigint::BigInt;
use serde_json::Value;
use sha2::Sha256;
use sha3::{Digest, Keccak256};
use x25519_dalek::{PublicKey, StaticSecret};
use xln_rscore_batch::{AccountId, AccountSeed, EngineGeneration, ResidentConsensusEngine};
use xln_rscore_engine::{
    AccountDisputeConfig, AccountDomain, AccountEnvelope, AccountIdentity, AccountReplica,
    AccountState, BoardDelays, Delta, DepositoryAddress, EntityId, TokenId, WatchSeed,
    derive_signer_key,
};
use xln_rscore_entity_kernel::{
    ConsensusMode, EntityCanonicalCollection, EntityConsensusConfig, EntityConsensusSection,
    EntityConsensusState, EntityFrameAuthority, EntityFrameEvent, EntityLeaderState,
    EntitySingleSigner, EntityStateSlice, ResidentEntityConsensusReplica,
    compute_entity_consensus_root, compute_entity_effects_parity_digest,
    compute_entity_events_parity_digest,
};
use xln_rscore_protocol::{CanonicalNumber, CanonicalValue, PersistentRadixMap};

use crate::processor::{EntityRoute, EntityRouteTable, encode_local_entity_outputs};
use crate::{
    CanonicalEntityInfraMaterializer, CanonicalRuntimeEntityHash, RuntimeApplyResult,
    RuntimeEntityInput, RuntimeEntityKey, RuntimeEntityState, RuntimeLimits, RuntimeLiveInput,
    RuntimeMachineError, RuntimeReplica, RuntimeState, apply_runtime_live,
    canonical_swap_market_policy, canonical_value_from_tagged_json,
    compute_canonical_runtime_state_hash, encode_storage_payload,
};

const FIXTURE: &str = include_str!("../../../../../fixtures/cross-j-opening/lifecycle-v1.json");

fn text<'a>(value: &'a Value, field: &str) -> &'a str {
    value[field]
        .as_str()
        .unwrap_or_else(|| panic!("fixture {field}"))
}

fn hex<const N: usize>(value: &str) -> [u8; N] {
    let decoded = ::hex::decode(value.strip_prefix("0x").expect("0x hex")).expect("valid hex");
    decoded
        .try_into()
        .unwrap_or_else(|_| panic!("expected {N} bytes"))
}

fn entity_id(value: &str) -> EntityId {
    EntityId::parse(value).expect("fixture Entity id")
}

fn watch_seed(left: &str, right: &str) -> WatchSeed {
    let preimage = format!(
        "xln:account-watch-seed:v1|cross-j-test-helper||{}|{}",
        left.to_ascii_lowercase(),
        right.to_ascii_lowercase(),
    );
    let digest: [u8; 32] = Keccak256::digest(preimage.as_bytes()).into();
    WatchSeed::parse(&format!("0x{}", ::hex::encode(digest))).expect("fixture watch seed")
}

fn collection(rows: &Value) -> EntityCanonicalCollection {
    let mut collection = EntityCanonicalCollection::empty();
    for row in rows.as_array().expect("collection rows") {
        let pair = row.as_array().expect("collection pair");
        collection
            .insert(
                pair[0].as_str().expect("collection key").to_string(),
                canonical_value_from_tagged_json(&pair[1]).expect("canonical collection value"),
            )
            .expect("fixture collection insert");
    }
    collection
}

fn label_for_entity(setup: &Value, entity: &Value) -> &'static str {
    let route = &setup["route"];
    match text(entity, "entityId") {
        id if id == text(&route["source"], "counterpartyEntityId") => "source-hub",
        id if id == text(&route["target"], "entityId") => "target-hub",
        id if id == text(&route["source"], "entityId") => "source-user",
        id if id == text(&route["target"], "counterpartyEntityId") => "target-user",
        id => panic!("unknown fixture Entity {id}"),
    }
}

fn single_entity_runtime(
    seed: &str,
    runtime_timestamp: u64,
    setup: &Value,
    entity: &Value,
) -> Result<RuntimeReplica, RuntimeMachineError> {
    let entity_id_text = text(entity, "entityId");
    let signer_id = text(entity, "signerId").to_string();
    let label = label_for_entity(setup, entity);
    let signing_key = derive_signer_key(seed, label).expect("fixture signing key");
    let owner = entity_id(entity_id_text);
    let owner_bytes = *owner.as_bytes();
    let account = &entity["accounts"][0];
    let peer_text = text(account, "counterpartyEntityId");
    let peer = entity_id(peer_text);
    let (left_text, right_text) = if entity_id_text < peer_text {
        (entity_id_text, peer_text)
    } else {
        (peer_text, entity_id_text)
    };
    let derived_watch_seed = watch_seed(left_text, right_text);
    assert_eq!(
        derived_watch_seed.as_hex(),
        text(account, "watchSeed"),
        "initial Account watch seed",
    );
    let account_state = AccountState::new(
        AccountIdentity::new(
            AccountDomain::new(
                account["chainId"].as_u64().expect("chain id"),
                DepositoryAddress::parse(text(account, "depositoryAddress")).expect("depository"),
            )
            .expect("Account domain"),
            entity_id(left_text),
            entity_id(right_text),
            derived_watch_seed,
        )
        .expect("Account identity"),
        AccountDisputeConfig::new(10, 10).expect("dispute config"),
        vec![
            Delta::new(
                TokenId::new(1).expect("token id"),
                0.into(),
                0.into(),
                0.into(),
                BigInt::from(10_u8).pow(30),
                BigInt::from(10_u8).pow(30),
                0.into(),
                0.into(),
                0.into(),
                0.into(),
            )
            .expect("initial delta"),
        ],
    )
    .expect("Account state");
    assert_eq!(
        format!(
            "0x{}",
            ::hex::encode(
                account_state
                    .payment_profile_account_state_root()
                    .expect("initial Account root")
            )
        ),
        text(account, "root"),
        "initial Account root",
    );
    let account_id = AccountId::from_bytes(*peer.as_bytes());
    let empty_root = CanonicalValue::String(format!("0x{}", "00".repeat(32)));
    let mut account_replica =
        AccountReplica::new(owner.clone(), account_state).expect("Account replica");
    account_replica.set_delta_transformer(hex(text(account, "deltaTransformerAddress")));
    account_replica.set_envelope(
        AccountEnvelope::new(
            vec![
                ("status".into(), CanonicalValue::String("active".into())),
                (
                    "currentHeight".into(),
                    CanonicalValue::Number(CanonicalNumber::from_u32(0)),
                ),
                (
                    "proofHeader".into(),
                    CanonicalValue::Object(vec![
                        (
                            "fromEntity".into(),
                            CanonicalValue::String(entity_id_text.into()),
                        ),
                        ("toEntity".into(), CanonicalValue::String(peer_text.into())),
                        (
                            "nextProofNonce".into(),
                            CanonicalValue::Number(CanonicalNumber::from_u32(1)),
                        ),
                    ]),
                ),
                (
                    "currentFrameHash".into(),
                    CanonicalValue::String(String::new()),
                ),
                ("pendingWithdrawals".into(), empty_root.clone()),
                (
                    "shadow".into(),
                    CanonicalValue::Object(vec![(
                        "rebalance".into(),
                        CanonicalValue::Object(vec![
                            ("policyRoot".into(), empty_root.clone()),
                            ("submittedAtByTokenRoot".into(), empty_root),
                        ]),
                    )]),
                ),
            ],
            Vec::new(),
        )
        .expect("Account envelope"),
    );
    let account_leaf = account_replica
        .entity_account_leaf()
        .expect("initial Entity Account leaf");
    assert_eq!(
        prefixed(&account_leaf),
        text(account, "entityLeaf"),
        "initial Entity Account leaf",
    );
    let serial_root = PersistentRadixMap::empty()
        .updated(account_id.as_bytes().to_vec(), (), account_leaf)
        .expect("serial Account map")
        .root_hash();
    assert_eq!(
        prefixed(&serial_root),
        text(entity, "accountsRoot"),
        "initial serial Entity Account forest root",
    );
    let accounts = ResidentConsensusEngine::restore(
        EngineGeneration::from_bytes([0x22; 8]),
        1,
        0,
        signing_key,
        signer_id.clone(),
        Arc::new(canonical_swap_market_policy()),
        vec![AccountSeed {
            account_id,
            replica: account_replica,
            consensus: None,
        }],
    )
    .map_err(|error| {
        RuntimeMachineError::Entity(xln_rscore_entity_kernel::ResidentEntityError::Account(
            error,
        ))
    })?;
    assert_eq!(
        prefixed(&accounts.accounts_root()),
        text(entity, "accountsRoot"),
        "initial Entity Account forest root",
    );
    let mut state = EntityStateSlice::empty(
        entity_id_text,
        entity["timestamp"].as_u64().expect("timestamp"),
    );
    state.profile.name.clear();
    state.profile.is_hub = entity["isHub"].as_bool().expect("isHub");
    state.swap_trading_pairs = Some(Vec::new());
    state.entity_encryption_public_key = hex(text(entity, "entityEncryptionPublicKey"));
    state.known_accounts.insert(peer_text.to_string());
    state.cross_jurisdiction_swaps = Some(collection(&entity["crossJurisdictionSwaps"]));
    if !entity["crossJurisdictionAuthorizations"]
        .as_array()
        .expect("authorization rows")
        .is_empty()
    {
        state.cross_jurisdiction_authorizations =
            Some(collection(&entity["crossJurisdictionAuthorizations"]));
    }
    let expected_public = PublicKey::from(&StaticSecret::from(
        derive_signer_key(entity_id_text, "entity-encryption").expect("entity encryption key"),
    ));
    assert_eq!(
        state.entity_encryption_public_key,
        expected_public.to_bytes()
    );

    let authority = EntityFrameAuthority {
        config: EntityConsensusConfig {
            mode: ConsensusMode::ProposerBased,
            threshold: 1,
            validators: vec![signer_id.clone()],
            shares: BTreeMap::from([(signer_id.clone(), 1)]),
            jurisdiction: Some(
                canonical_value_from_tagged_json(&entity["jurisdiction"]).expect("jurisdiction"),
            ),
        },
        leader_state: EntityLeaderState {
            active_validator_id: signer_id.clone(),
            view: 0,
            changed_at_height: 0,
        },
    };
    let sections: Vec<EntityConsensusSection> = entity["sectionDigests"]
        .as_array()
        .expect("initial Entity sections")
        .iter()
        .map(|row| EntityConsensusSection {
            field: text(row, "field").to_string(),
            digest: text(row, "digest").to_string(),
        })
        .collect();
    assert_eq!(
        compute_entity_consensus_root(&sections).expect("initial Entity root"),
        text(entity, "entityRoot"),
        "initial Entity state root",
    );
    let consensus = ResidentEntityConsensusReplica {
        state: EntityConsensusState {
            sections,
            authority,
        },
        certified_frame_head: None,
    };
    let signer = EntitySingleSigner::from_key(
        signing_key,
        &signer_id,
        entity_id_text,
        1,
        1,
        BoardDelays::default(),
    )
    .expect("Entity signer");
    let accounts_root = accounts.accounts_root();
    RuntimeReplica::new(
        RuntimeState {
            height: 0,
            timestamp: runtime_timestamp,
            finalized_j_height: 0,
            e_replicas: BTreeMap::from([(
                RuntimeEntityKey::new(owner_bytes, &signer_id)?,
                RuntimeEntityState {
                    accounts_root,
                    entity: state,
                },
            )]),
        },
        crate::processor::RuntimeDurableEnvelope::fixture(),
        owner_bytes,
        signer_id,
        accounts,
        consensus,
        signer,
        [0; 32],
        seed.to_string(),
        RuntimeLimits::hlt(),
    )
}

fn merge_second(
    runtime: &mut RuntimeReplica,
    mut second: RuntimeReplica,
) -> Result<(), RuntimeMachineError> {
    let key = second
        .state
        .e_replicas
        .keys()
        .next()
        .expect("second slot")
        .clone();
    let (state, replica) = second
        .take_entity_slot(&key.entity_id, &key.signer_id)
        .expect("second Entity slot");
    runtime.install_entity_slot(key, state, replica)
}

fn runtime_from_initial(
    fixture: &Value,
    runtime_name: &str,
) -> Result<RuntimeReplica, RuntimeMachineError> {
    let setup = &fixture["setup"];
    let seed = text(setup, "seed");
    let timestamp = setup["timestamp"].as_u64().expect("fixture timestamp");
    let entities = setup["initial"][runtime_name]["entities"]
        .as_array()
        .expect("initial entities");
    let mut runtime = single_entity_runtime(seed, timestamp, setup, &entities[0])?;
    merge_second(
        &mut runtime,
        single_entity_runtime(seed, timestamp, setup, &entities[1])?,
    )?;
    let entity_hashes = entities
        .iter()
        .map(|entity| CanonicalRuntimeEntityHash {
            entity_id: text(entity, "entityId").to_string(),
            hash: text(entity, "entityRoot").to_string(),
            cell_count: 1,
        })
        .collect::<Vec<_>>();
    assert_eq!(
        compute_canonical_runtime_state_hash(0, timestamp, &entity_hashes)
            .expect("initial Runtime state hash"),
        text(&setup["initial"][runtime_name], "canonicalRuntimeStateHash"),
        "initial Runtime state hash",
    );
    Ok(runtime)
}

fn colocated_runtime_from_initial(fixture: &Value) -> Result<RuntimeReplica, RuntimeMachineError> {
    let setup = &fixture["setup"];
    let mut runtime = runtime_from_initial(fixture, "hub")?;
    for entity in setup["initial"]["user"]["entities"].as_array().unwrap() {
        merge_second(
            &mut runtime,
            single_entity_runtime(
                text(setup, "seed"),
                setup["timestamp"].as_u64().unwrap(),
                setup,
                entity,
            )?,
        )?;
    }
    Ok(runtime)
}

fn decoded_inputs(frame: &Value) -> Result<Vec<RuntimeEntityInput>, RuntimeMachineError> {
    frame["canonicalEntityInputs"]
        .as_array()
        .expect("canonical Entity inputs")
        .iter()
        .cloned()
        .map(RuntimeEntityInput::decode)
        .collect()
}

fn apply_fixture_frame(
    runtime: RuntimeReplica,
    frame: &Value,
) -> Result<RuntimeApplyResult, RuntimeMachineError> {
    let mut materializer = CanonicalEntityInfraMaterializer::new();
    apply_runtime_live(
        runtime,
        RuntimeLiveInput {
            runtime_txs: Vec::new(),
            entity_inputs: decoded_inputs(frame)?,
            timestamp: 10_000,
            finalized_j_height: 0,
        },
        &mut materializer,
    )
}

fn prefixed(bytes: &[u8]) -> String {
    format!("0x{}", ::hex::encode(bytes))
}

fn event_value(event: &EntityFrameEvent) -> Value {
    match event {
        EntityFrameEvent::Status { message } => serde_json::json!({
            "type": "status",
            "message": message,
        }),
        EntityFrameEvent::Text {
            validator_id,
            message,
        } => serde_json::json!({
            "type": "text",
            "validatorId": validator_id,
            "message": message,
        }),
    }
}

fn assert_entity_frames(result: &RuntimeApplyResult, expected: &Value) {
    let expected_frames = expected["entityFrames"].as_array().expect("Entity frames");
    assert_eq!(
        result.outputs.entities.len(),
        expected_frames.len(),
        "actual Entity frames: {:?}",
        result
            .outputs
            .entities
            .iter()
            .map(|frame| (
                prefixed(&frame.entity_id),
                frame.entity_frame_height,
                &frame.entity_frame_hash,
            ))
            .collect::<Vec<_>>(),
    );
    for (index, (actual, expected)) in result
        .outputs
        .entities
        .iter()
        .zip(expected_frames)
        .enumerate()
    {
        assert_eq!(
            prefixed(&actual.entity_id),
            text(expected, "entityId"),
            "Entity frame {index} id"
        );
        assert_eq!(
            actual.signer_id,
            text(expected, "signerId"),
            "Entity frame {index} signer"
        );
        assert_eq!(
            actual.entity_frame_height,
            expected["height"].as_u64().expect("height"),
            "Entity frame {index} height",
        );
        assert_eq!(
            actual.entity_frame_timestamp, 10_000,
            "Entity frame {index} timestamp"
        );
        assert_eq!(
            prefixed(&actual.accounts_root),
            text(expected, "accountsRoot"),
            "Entity frame {index} Account forest root",
        );
        assert_eq!(
            actual.entity_state_root,
            text(expected, "stateRoot"),
            "Entity frame {index} state root"
        );
        assert_eq!(
            actual.entity_authority_root,
            text(expected, "authorityRoot"),
            "Entity frame {index} authority root",
        );
    }
    assert_eq!(
        result
            .outputs
            .entities
            .iter()
            .map(|frame| {
                frame
                    .entity_frame_events
                    .iter()
                    .map(event_value)
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>(),
        expected_frames
            .iter()
            .map(|frame| frame["events"].as_array().expect("frame events").clone())
            .collect::<Vec<_>>(),
        "ordered per-Entity-frame events",
    );
    assert_eq!(
        result
            .outputs
            .entities
            .iter()
            .map(|frame| frame.entity_frame_hash.as_str())
            .collect::<Vec<_>>(),
        expected_frames
            .iter()
            .map(|frame| text(frame, "hash"))
            .collect::<Vec<_>>(),
        "ordered Entity frame hashes",
    );
}

fn assert_event_and_effect_digests(result: &RuntimeApplyResult, expected: &Value) {
    let events = result
        .outputs
        .entities
        .iter()
        .flat_map(|entity| entity.entity_frame_events.iter().cloned())
        .collect::<Vec<_>>();
    let effects = result
        .outputs
        .entities
        .iter()
        .flat_map(|entity| entity.entity_events.iter().cloned())
        .collect::<Vec<_>>();
    assert_eq!(
        events.len(),
        expected["events"]["eventCount"]
            .as_u64()
            .expect("event count") as usize
    );
    assert_eq!(
        prefixed(&compute_entity_events_parity_digest(&events).expect("event digest")),
        text(&expected["events"], "orderedEventDigest"),
    );
    assert_eq!(
        effects.len(),
        expected["effects"]["effectCount"]
            .as_u64()
            .expect("effect count") as usize
    );
    assert_eq!(
        prefixed(&compute_entity_effects_parity_digest(&effects).expect("effect digest")),
        text(&expected["effects"], "orderedEffectDigest"),
    );
}

fn route_table(fixture: &Value) -> EntityRouteTable {
    let setup = &fixture["setup"];
    let hub_runtime_id = text(setup, "hubRuntimeId");
    let user_runtime_id = text(setup, "userRuntimeId");
    let routes = [("hub", hub_runtime_id), ("user", user_runtime_id)]
        .into_iter()
        .flat_map(|(runtime, runtime_id)| {
            setup["initial"][runtime]["entities"]
                .as_array()
                .expect("initial Runtime entities")
                .iter()
                .map(move |entity| EntityRoute {
                    target_entity_id: text(entity, "entityId").to_string(),
                    target_runtime_id: runtime_id.to_string(),
                    target_signer_id: text(entity, "signerId").to_string(),
                    websocket_url: None,
                })
        });
    EntityRouteTable::new(routes).expect("fixture Entity routes")
}

fn encoded_outputs(result: &RuntimeApplyResult, routes: &EntityRouteTable) -> Vec<Value> {
    let mut outputs = Vec::new();
    for entity in &result.outputs.entities {
        let source_entity_id = prefixed(&entity.entity_id);
        let local = encode_local_entity_outputs(
            entity.local_entity_outputs.clone(),
            &source_entity_id,
            &entity.signer_id,
        )
        .expect("encode local Entity outputs");
        let mut bound = routes
            .bind_and_encode(
                local,
                result.replica.state.height,
                result.replica.state.timestamp,
                &source_entity_id,
                &entity.signer_id,
            )
            .expect("bind production Entity routes");
        if let Some(pair) = entity.atomic_cross_jurisdiction_pair.as_ref() {
            for output in &mut bound.resident_rows {
                output
                    .as_object_mut()
                    .expect("bound Entity output object")
                    .insert(
                        "atomicCrossJurisdictionPair".into(),
                        serde_json::json!({
                            "phase": pair.phase,
                            "pairKey": pair.pair_key,
                        }),
                    );
            }
        }
        outputs.extend(bound.resident_rows);
    }
    outputs
}

fn account_output_projection(outputs: &[Value]) -> Vec<Value> {
    let mut projected = Vec::new();
    for output in outputs {
        let account_input = output["entityTxs"]
            .as_array()
            .expect("Entity output txs")
            .iter()
            .find(|tx| tx["type"] == "accountInput")
            .map(|tx| tx["data"].clone());
        if let Some(account_input) = account_input {
            projected.push(serde_json::json!({
                "entityId": output["entityId"],
                "signerId": output["signerId"],
                "accountInput": account_input,
            }));
        }
    }
    projected
}

fn ordered_output_digest(outputs: &[Value]) -> String {
    let rows = outputs
        .iter()
        .map(|output| {
            let canonical =
                canonical_value_from_tagged_json(output).expect("canonical Runtime output");
            encode_storage_payload(&canonical).expect("encoded Runtime output")
        })
        .collect::<Vec<_>>();
    let mut digest = Sha256::new();
    digest.update(b"xln.runtime.outbox.v1");
    digest.update(
        u32::try_from(rows.len())
            .expect("output count")
            .to_be_bytes(),
    );
    for row in rows {
        digest.update(
            u32::try_from(row.len())
                .expect("output bytes")
                .to_be_bytes(),
        );
        digest.update(row);
    }
    prefixed(&digest.finalize())
}

fn assert_account_outputs(
    result: &RuntimeApplyResult,
    routes: &EntityRouteTable,
    expected: &Value,
) {
    let outputs = encoded_outputs(result, routes);
    let expected_outputs = expected["outbox"]["outputs"]
        .as_array()
        .expect("outbox outputs")
        .iter()
        .map(|output| {
            serde_json::json!({
                "entityId": output["entityId"],
                "signerId": output["signerId"],
                "accountInput": output["accountInput"],
            })
        })
        .collect::<Vec<_>>();
    let projected = account_output_projection(&outputs);
    assert_eq!(
        projected.len(),
        expected_outputs.len(),
        "Account output count"
    );
    for (index, (actual, expected)) in projected.iter().zip(&expected_outputs).enumerate() {
        assert_eq!(
            actual["entityId"], expected["entityId"],
            "Account output {index} destination Entity"
        );
        assert_eq!(
            actual["signerId"], expected["signerId"],
            "Account output {index} destination signer"
        );
        assert_eq!(
            actual["accountInput"], expected["accountInput"],
            "Account output {index} payload"
        );
    }
    let expected_wal_outputs = expected["outbox"]["walOutputs"]
        .as_array()
        .expect("WAL outputs");
    assert_eq!(
        outputs.len(),
        expected_wal_outputs.len(),
        "WAL output count"
    );
    for (index, (actual, expected)) in outputs.iter().zip(expected_wal_outputs).enumerate() {
        let actual_fields = actual.as_object().expect("actual WAL output object");
        let expected_fields = expected.as_object().expect("expected WAL output object");
        assert_eq!(
            actual_fields.keys().collect::<Vec<_>>(),
            expected_fields.keys().collect::<Vec<_>>(),
            "WAL output {index} fields"
        );
        for field in [
            "entityId",
            "signerId",
            "runtimeId",
            "sourceRuntimeFrame",
            "atomicCrossJurisdictionPair",
            "entityTxs",
        ] {
            assert_eq!(
                actual.get(field),
                expected.get(field),
                "WAL output {index} field {field}"
            );
        }
    }
    assert_eq!(
        outputs.len(),
        expected["outbox"]["count"].as_u64().expect("outbox count") as usize
    );
    assert_eq!(
        ordered_output_digest(&outputs),
        text(&expected["outbox"], "digest")
    );
}

fn assert_final_roots(result: &mut RuntimeApplyResult, expected: &Value) {
    let mut entity_hashes = Vec::new();
    for expected_root in expected["entityRoots"].as_array().expect("Entity roots") {
        let entity_id_bytes = hex::<32>(text(expected_root, "entityId"));
        let signer_id = text(expected_root, "signerId");
        let (state, live) = result
            .replica
            .entity_slot(&entity_id_bytes, signer_id)
            .expect("final Entity slot");
        let head = live
            .entity_consensus
            .certified_frame_head
            .as_ref()
            .expect("certified Entity head");
        assert_eq!(
            state.entity.height,
            expected_root["height"].as_u64().expect("Entity height")
        );
        assert_eq!(head.frame.state_root, text(expected_root, "root"));
        entity_hashes.push(CanonicalRuntimeEntityHash {
            entity_id: text(expected_root, "entityId").to_string(),
            hash: head.frame.state_root.clone(),
            cell_count: 1,
        });
    }
    assert_eq!(
        compute_canonical_runtime_state_hash(
            result.replica.state.height,
            result.replica.state.timestamp,
            &entity_hashes,
        )
        .expect("Runtime state hash"),
        text(expected, "canonicalRuntimeStateHash"),
    );
    for account in expected["accounts"].as_array().expect("Account states") {
        let entity_id_bytes = hex::<32>(text(account, "entityId"));
        let signer_id = expected["entityRoots"]
            .as_array()
            .expect("Entity roots")
            .iter()
            .find(|root| text(root, "entityId") == text(account, "entityId"))
            .map(|root| text(root, "signerId"))
            .expect("Account owner signer");
        let (_, live) = result
            .replica
            .entity_slot_mut(&entity_id_bytes, signer_id)
            .expect("Account owner slot");
        let status = live
            .accounts
            .account_status(
                AccountId::from_bytes(hex(text(account, "counterpartyEntityId"))),
                Vec::new(),
            )
            .expect("Account status")
            .expect("Account status row");
        assert_eq!(
            status.current_height,
            account["currentHeight"].as_u64().expect("current height")
        );
        assert_eq!(
            status.pending_frame_height,
            account["pendingHeight"].as_u64()
        );
        assert_eq!(
            status.mempool_len,
            account["mempoolTxTypes"].as_array().expect("mempool").len()
        );
    }
}

fn assert_fixture_frame(
    result: &mut RuntimeApplyResult,
    routes: &EntityRouteTable,
    expected: &Value,
) {
    assert_eq!(
        result.replica.state.height,
        expected["runtimeHeight"].as_u64().expect("Runtime height")
    );
    assert_entity_frames(result, expected);
    assert_event_and_effect_digests(result, expected);
    assert_account_outputs(result, routes, expected);
    assert_final_roots(result, expected);
}

#[test]
fn cross_j_r4_h45_empty_wake_materializes_committed_intent() -> Result<(), RuntimeMachineError> {
    let fixture: Value = serde_json::from_str(FIXTURE).expect("cross-J lifecycle fixture");
    let expected = &fixture["frames"][0];
    let mut wake_frame = expected.clone();
    wake_frame["canonicalEntityInputs"][0]["entityTxs"] = serde_json::json!([]);
    let runtime = runtime_from_initial(&fixture, "hub")?;
    let input = &expected["canonicalEntityInputs"][0];
    let (state, live) = runtime
        .entity_slot(&hex::<32>(text(input, "entityId")), text(input, "signerId"))
        .unwrap();
    let materialized = xln_rscore_entity_kernel::build_proposer_materializations(
        &state.entity,
        text(&fixture["setup"], "seed"),
        10_000,
        &live.signer_id,
        &live.entity_consensus.state.authority,
        &BTreeMap::new(),
        &Default::default(),
        false,
    )
    .unwrap();
    assert_eq!(
        crate::tagged_json_from_canonical_value(materialized[0].frame_data().unwrap()).unwrap(),
        input["entityTxs"][0]["data"],
        "automatic materialization must equal the canonical TypeScript command",
    );
    let mut result = apply_fixture_frame(runtime, &wake_frame)?;
    assert_fixture_frame(&mut result, &route_table(&fixture), expected);
    assert_eq!(
        result.applied_frame.as_ref().unwrap().entity_inputs,
        wake_frame["canonicalEntityInputs"]
            .as_array()
            .unwrap()
            .clone(),
        "derived materialization must not replace the accepted empty Runtime input",
    );
    Ok(())
}

#[test]
fn cross_j_r4_h45_fresh_chat_and_materialization_share_command_nonce()
-> Result<(), RuntimeMachineError> {
    let fixture: Value = serde_json::from_str(FIXTURE).expect("cross-J lifecycle fixture");
    let opening = &fixture["frames"][0];
    let input = &opening["canonicalEntityInputs"][0];
    let chat = serde_json::json!({
        "type": "chat",
        "data": {
            "from": input["signerId"],
            "message": "fresh individual input before automatic materialization",
        },
    });
    let mut explicit_frame = opening.clone();
    explicit_frame["canonicalEntityInputs"][0]["entityTxs"] =
        serde_json::json!([chat, input["entityTxs"][0],]);
    let mut automatic_frame = opening.clone();
    automatic_frame["canonicalEntityInputs"][0]["entityTxs"] = serde_json::json!([chat]);

    // The exact materialization comes from the shared TS lifecycle fixture.
    // Its explicit admission runs through the same production signer as any
    // fresh individual batch; automatic admission must preserve that command.
    let reference = apply_fixture_frame(runtime_from_initial(&fixture, "hub")?, &explicit_frame)?;
    let automatic = apply_fixture_frame(runtime_from_initial(&fixture, "hub")?, &automatic_frame)?;
    let owner = hex::<32>(text(input, "entityId"));
    let signer = text(input, "signerId");
    let (reference_state, _) = reference
        .replica
        .entity_slot(&owner, signer)
        .expect("reference source hub");
    let (automatic_state, _) = automatic
        .replica
        .entity_slot(&owner, signer)
        .expect("automatic source hub");
    let reference_nonces = reference_state
        .entity
        .entity_command_nonces
        .as_ref()
        .expect("reference signed command nonce");
    let automatic_nonces = automatic_state
        .entity
        .entity_command_nonces
        .as_ref()
        .expect("automatic signed command nonce");
    let expected_nonce = text(
        &opening["entityFrames"][0]["txs"][0]["data"]["nonce"],
        "value",
    )
    .parse::<BigInt>()
    .expect("fixture command nonce");
    assert_eq!(reference_nonces.by_signer[signer].nonce, expected_nonce);
    assert_eq!(
        automatic_nonces.by_signer[signer].nonce, expected_nonce,
        "fresh chat and derived materialization form one individual command run",
    );
    assert_eq!(
        automatic_nonces, reference_nonces,
        "the same ordered command body produces the same signed command hash",
    );
    let evidence = |result: &RuntimeApplyResult| {
        result
            .outputs
            .entities
            .iter()
            .map(|frame| {
                (
                    frame.entity_id,
                    frame.signer_id.clone(),
                    frame.entity_frame_height,
                    frame.entity_frame_timestamp,
                    frame.entity_frame_hash.clone(),
                    frame.accounts_root,
                    frame.entity_state_root.clone(),
                    frame.entity_authority_root.clone(),
                    frame.entity_frame_events.clone(),
                    frame.entity_events.clone(),
                )
            })
            .collect::<Vec<_>>()
    };
    assert_eq!(
        reference.outputs.entities.len(),
        opening["entityFrames"].as_array().unwrap().len(),
        "the complete five-frame lifecycle remains exercised",
    );
    assert_eq!(
        evidence(&automatic),
        evidence(&reference),
        "all ordered Entity/Account roots, frame hashes, events and effects",
    );
    let routes = route_table(&fixture);
    assert_eq!(
        encoded_outputs(&automatic, &routes),
        encoded_outputs(&reference, &routes),
        "exact ordered production outbox",
    );
    assert_eq!(
        automatic.applied_frame.as_ref().unwrap().entity_inputs,
        automatic_frame["canonicalEntityInputs"]
            .as_array()
            .unwrap()
            .clone(),
        "automatic materialization must retain the original accepted chat input",
    );
    Ok(())
}

#[test]
fn cross_j_r4_h45_two_inputs_materialize_in_first_individual_command()
-> Result<(), RuntimeMachineError> {
    let fixture: Value = serde_json::from_str(FIXTURE).expect("cross-J lifecycle fixture");
    let opening = &fixture["frames"][0];
    let input = &opening["canonicalEntityInputs"][0];
    let chat = |message| {
        serde_json::json!({
            "type": "chat",
            "data": { "from": input["signerId"], "message": message },
        })
    };
    let first_chat = chat("first admission materializes the committed intent");
    let second_chat = chat("second admission observes the pending materialization");
    let mut first_input = input.clone();
    first_input["entityTxs"] = serde_json::json!([first_chat]);
    let mut second_input = input.clone();
    second_input["entityTxs"] = serde_json::json!([second_chat]);
    let mut automatic_frame = opening.clone();
    automatic_frame["canonicalEntityInputs"] = serde_json::json!([first_input, second_input]);
    let mut explicit_frame = automatic_frame.clone();
    explicit_frame["canonicalEntityInputs"][0]["entityTxs"] =
        serde_json::json!([first_chat, input["entityTxs"][0]]);

    // TS admits each input before the deferred owner proposal. The first
    // admission signs [A, materialize]; the second sees its pending setup key
    // and signs only [B]. Use the fixture's exact materialization bytes through
    // production admission as the reference for that signed command boundary.
    let reference = apply_fixture_frame(runtime_from_initial(&fixture, "hub")?, &explicit_frame)?;
    let automatic = apply_fixture_frame(runtime_from_initial(&fixture, "hub")?, &automatic_frame)?;
    let owner = hex::<32>(text(input, "entityId"));
    let signer = text(input, "signerId");
    let (reference_state, _) = reference.replica.entity_slot(&owner, signer).unwrap();
    let (automatic_state, _) = automatic.replica.entity_slot(&owner, signer).unwrap();
    let reference_nonces = reference_state
        .entity
        .entity_command_nonces
        .as_ref()
        .unwrap();
    let automatic_nonces = automatic_state
        .entity
        .entity_command_nonces
        .as_ref()
        .unwrap();
    assert_eq!(reference_nonces.by_signer[signer].nonce, BigInt::from(2));
    assert_eq!(automatic_nonces.by_signer[signer].nonce, BigInt::from(2));
    assert_eq!(
        automatic_nonces, reference_nonces,
        "the second signed command contains only B, not the first input's materialization",
    );
    let evidence = |result: &RuntimeApplyResult| {
        result
            .outputs
            .entities
            .iter()
            .map(|frame| {
                (
                    frame.entity_id,
                    frame.signer_id.clone(),
                    frame.entity_frame_height,
                    frame.entity_frame_timestamp,
                    frame.entity_frame_hash.clone(),
                    frame.accounts_root,
                    frame.entity_state_root.clone(),
                    frame.entity_authority_root.clone(),
                    frame.entity_frame_events.clone(),
                    frame.entity_events.clone(),
                )
            })
            .collect::<Vec<_>>()
    };
    assert_eq!(
        reference.outputs.entities.len(),
        opening["entityFrames"].as_array().unwrap().len(),
        "the complete five-frame opening lifecycle remains exercised",
    );
    assert_eq!(
        evidence(&automatic),
        evidence(&reference),
        "ordered Entity/Account roots, certified frame hashes, events and effects",
    );
    let routes = route_table(&fixture);
    assert_eq!(
        encoded_outputs(&automatic, &routes),
        encoded_outputs(&reference, &routes),
        "exact ordered production outbox",
    );
    assert_eq!(
        automatic.applied_frame.as_ref().unwrap().entity_inputs,
        automatic_frame["canonicalEntityInputs"]
            .as_array()
            .unwrap()
            .clone(),
        "both original inputs retain their Runtime positions",
    );
    Ok(())
}

#[test]
fn cross_j_r4_h45_source_cascade_drains_before_next_owner() -> Result<(), RuntimeMachineError> {
    let fixture: Value = serde_json::from_str(FIXTURE).expect("cross-J lifecycle fixture");
    let opening = &fixture["frames"][0];
    let route = &fixture["setup"]["route"];
    let target = text(&route["target"], "entityId");
    let target_signer = text(route, "targetHubSignerId");
    let message = "second owner runs after the complete source cascade";
    let mut combined_frame = opening.clone();
    combined_frame["canonicalEntityInputs"] = serde_json::json!([
        opening["canonicalEntityInputs"][0],
        {
            "entityId": target,
            "signerId": target_signer,
            "entityTxs": [{
                "type": "chat",
                "data": { "from": target_signer, "message": message },
            }],
        },
    ]);
    let mut result = apply_fixture_frame(runtime_from_initial(&fixture, "hub")?, &combined_frame)?;
    let opening_frame_count = opening["entityFrames"].as_array().unwrap().len();
    assert_eq!(
        result.outputs.entities.len(),
        opening_frame_count + 1,
        "the five opening frames and the second owner's chat must all execute",
    );
    assert_eq!(
        result.applied_frame.as_ref().unwrap().entity_inputs,
        combined_frame["canonicalEntityInputs"]
            .as_array()
            .unwrap()
            .clone(),
        "both external inputs retain their accepted Runtime positions",
    );

    // TS drains the source owner's immediate cascade before flushing the
    // next owner. Compare that chronological prefix to the complete immutable
    // lifecycle oracle; sorting the output rows would hide the changed roots.
    let tail = result.outputs.entities.split_off(opening_frame_count);
    assert_entity_frames(&result, opening);
    assert_event_and_effect_digests(&result, opening);
    assert_account_outputs(&result, &route_table(&fixture), opening);

    let chat_frame = &tail[0];
    assert_eq!(prefixed(&chat_frame.entity_id), target);
    assert_eq!(chat_frame.signer_id, target_signer);
    let prior_target = opening["entityRoots"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| text(row, "entityId") == target)
        .expect("target's completed opening state");
    assert_eq!(
        chat_frame.entity_frame_height,
        prior_target["height"].as_u64().unwrap() + 1,
        "the sixth frame follows the target's opening frames",
    );
    assert_eq!(
        chat_frame.entity_frame_events,
        vec![EntityFrameEvent::Text {
            validator_id: target_signer.to_string(),
            message: message.to_string(),
        }],
        "the second owner's chat remains the final frame",
    );
    Ok(())
}

#[test]
fn cross_j_r4_h45_late_intent_materializes_during_prepared_owner_flush()
-> Result<(), RuntimeMachineError> {
    let fixture: Value = serde_json::from_str(FIXTURE).expect("cross-J lifecycle fixture");
    let setup = &fixture["setup"];
    let route = &setup["route"];
    let source_user = text(&route["source"], "entityId");
    let source_hub = text(&route["source"], "counterpartyEntityId");
    let source_hub_signer = text(route, "sourceHubSignerId");
    let runtime = colocated_runtime_from_initial(&fixture)?;
    let order_id = "late-intent-before-prepared-owner-flush";
    let mut late_route = route.clone();
    late_route["orderId"] = Value::from(order_id);
    late_route.as_object_mut().unwrap().remove("routeHash");
    let mut input = fixture["frames"][0].clone();
    input["canonicalEntityInputs"] = serde_json::json!([
        {
            "entityId": source_user,
            "signerId": route["sourceSignerId"],
            "entityTxs": [{
                "type": "prepareCrossJurisdictionSwap",
                "data": { "route": late_route },
            }],
        },
        { "entityId": source_hub, "signerId": source_hub_signer, "entityTxs": [] },
    ]);

    // All four initial Entity roots are unchanged fixture state. Admission
    // queues the hub's existing intent; the user's real certified cascade
    // creates another intent before that hub's deferred proposal flush.
    let result = apply_fixture_frame(runtime, &input)?;
    let (hub_state, _) = result
        .replica
        .entity_slot(&hex::<32>(source_hub), source_hub_signer)
        .expect("source hub after deferred flush");
    let swaps = hub_state.entity.cross_jurisdiction_swaps.as_ref().unwrap();
    for order_id in [order_id, text(route, "orderId")] {
        let committed = crate::tagged_json_from_canonical_value(
            swaps.get(order_id).expect("committed source-hub intent"),
        )
        .expect("canonical committed route");
        assert!(
            committed.get("sourcePull").is_some() && committed.get("targetPull").is_some(),
            "deferred owner flush must materialize {order_id}, including the intent created by the preceding cascade",
        );
    }
    assert_eq!(
        hub_state
            .entity
            .entity_command_nonces
            .as_ref()
            .unwrap()
            .by_signer[source_hub_signer]
            .nonce,
        BigInt::from(2),
        "initial admission and deferred flush create two signed materialization commands",
    );
    assert_eq!(
        result.applied_frame.as_ref().unwrap().entity_inputs,
        input["canonicalEntityInputs"].as_array().unwrap().clone(),
        "the user prepare and hub empty wake remain the accepted Runtime inputs",
    );
    Ok(())
}

#[test]
fn cross_j_r4_h45_trusted_prepare_materializes_existing_intent() -> Result<(), RuntimeMachineError>
{
    let fixture: Value = serde_json::from_str(FIXTURE).expect("cross-J lifecycle fixture");
    let route = &fixture["setup"]["route"];
    let source_hub = text(&route["source"], "counterpartyEntityId");
    let source_hub_signer = text(route, "sourceHubSignerId");
    let new_order_id = "new-intent-triggers-trusted-materialization";
    let mut new_route = route.clone();
    new_route["orderId"] = Value::from(new_order_id);
    new_route.as_object_mut().unwrap().remove("routeHash");
    let mut input = fixture["frames"][0].clone();
    input["canonicalEntityInputs"] = serde_json::json!([{
        "entityId": route["source"]["entityId"],
        "signerId": route["sourceSignerId"],
        "entityTxs": [{
            "type": "prepareCrossJurisdictionSwap",
            "data": { "route": new_route },
        }],
    }]);

    // No external hub wake exists. The authenticated user-to-hub prepare
    // still passes through TS admission, which appends a signed materialize
    // command for the hub's already committed intent to this trusted input.
    let result = apply_fixture_frame(colocated_runtime_from_initial(&fixture)?, &input)?;
    let (hub_state, _) = result
        .replica
        .entity_slot(&hex::<32>(source_hub), source_hub_signer)
        .expect("source hub after trusted prepare");
    let swaps = hub_state.entity.cross_jurisdiction_swaps.as_ref().unwrap();
    assert!(
        swaps.get(new_order_id).is_some(),
        "the trusted prepare was applied"
    );
    let existing = crate::tagged_json_from_canonical_value(
        swaps.get(text(route, "orderId")).expect("existing intent"),
    )
    .expect("canonical existing route");
    assert!(
        existing.get("sourcePull").is_some() && existing.get("targetPull").is_some(),
        "trusted prepare admission must materialize the already committed intent without an external hub wake",
    );
    assert_eq!(
        hub_state
            .entity
            .entity_command_nonces
            .as_ref()
            .unwrap()
            .by_signer[source_hub_signer]
            .nonce,
        BigInt::from(1),
        "the automatic materialization is a signed command within the trusted group",
    );
    assert_eq!(
        result.applied_frame.as_ref().unwrap().entity_inputs,
        input["canonicalEntityInputs"].as_array().unwrap().clone(),
        "only the original user prepare is accepted as external Runtime input",
    );
    Ok(())
}

#[test]
fn cross_j_r6_h44_atomic_ack_pair_defers_next_opening_until_both_legs_commit()
-> Result<(), RuntimeMachineError> {
    let fixture: Value = serde_json::from_str(FIXTURE).expect("cross-J lifecycle fixture");
    let route = &fixture["setup"]["route"];
    let mut second_route = route.clone();
    second_route["orderId"] = Value::from("zzz-h44-second-opening");
    second_route.as_object_mut().unwrap().remove("routeHash");
    let mut prepare = fixture["frames"][0].clone();
    prepare["canonicalEntityInputs"] = serde_json::json!([
        {
            "entityId": route["source"]["entityId"],
            "signerId": route["sourceSignerId"],
            "entityTxs": [{
                "type": "prepareCrossJurisdictionSwap",
                "data": { "route": second_route },
            }],
        },
        {
            "entityId": route["source"]["counterpartyEntityId"],
            "signerId": route["sourceHubSignerId"],
            "entityTxs": [],
        },
    ]);
    let opening = apply_fixture_frame(colocated_runtime_from_initial(&fixture)?, &prepare)?;
    let expected_openings = fixture["frames"][0]["outbox"]["outputs"]
        .as_array()
        .unwrap()
        .iter()
        .map(|output| {
            serde_json::json!({
                "entityId": output["entityId"],
                "signerId": output["signerId"],
                "accountInput": output["accountInput"],
            })
        })
        .collect::<Vec<_>>();
    assert_eq!(
        account_output_projection(&encoded_outputs(&opening, &route_table(&fixture))),
        expected_openings,
        "the first pending cohort is the exact fixture proposal accepted by its signed ACK pair",
    );

    // The fixture's real signed ACK pair is target first, source second.
    // Both selector calls must see the pre-pair sibling pending openings;
    // publishing the first ACK early incorrectly proposes in the second leg.
    let ack_frame = &fixture["frames"][2];
    let result = apply_fixture_frame(opening.replica, ack_frame)?;
    assert_eq!(
        result.applied_frame.as_ref().unwrap().entity_inputs,
        ack_frame["canonicalEntityInputs"]
            .as_array()
            .unwrap()
            .clone(),
        "the accepted Runtime frame retains exactly the two tagged ACK inputs",
    );
    for (index, input) in ack_frame["canonicalEntityInputs"]
        .as_array()
        .unwrap()
        .iter()
        .enumerate()
    {
        let output = &result.outputs.entities[index];
        assert_eq!(prefixed(&output.entity_id), text(input, "entityId"));
        assert!(
            output.local_entity_outputs.is_empty(),
            "ACK leg {index} must commit before either next opening proposal is emitted",
        );
    }
    assert_eq!(
        result.outputs.entities.len(),
        4,
        "two ACK Entity frames precede two empty AccountWork frames",
    );
    for output in &result.outputs.entities[2..] {
        let (_, live) = result
            .replica
            .entity_slot(&output.entity_id, &output.signer_id)
            .expect("AccountWork Entity");
        assert!(
            live.entity_consensus
                .certified_frame_head
                .as_ref()
                .unwrap()
                .frame
                .txs
                .is_empty(),
            "AccountWork has no EntityTx",
        );
        assert_eq!(
            output.local_entity_outputs.len(),
            1,
            "next opening proposal"
        );
    }
    assert_eq!(
        account_output_projection(&encoded_outputs(&result, &route_table(&fixture))).len(),
        2,
        "both hub Accounts propose the queued second opening after the atomic pair",
    );
    Ok(())
}

#[test]
fn cross_j_r6_h44_first_cross_book_keeps_same_j_dimensions_unchanged()
-> Result<(), RuntimeMachineError> {
    let fixture: Value = serde_json::from_str(FIXTURE).expect("cross-J lifecycle fixture");
    let route = &fixture["setup"]["route"];
    let source_hub = hex::<32>(text(&route["source"], "counterpartyEntityId"));
    let source_signer = text(route, "sourceHubSignerId");
    let runtime = runtime_from_initial(&fixture, "hub")?;
    let (initial, _) = runtime.entity_slot(&source_hub, source_signer).unwrap();
    let initial_dimensions = initial
        .entity
        .orderbook
        .as_ref()
        .map(|book| book.pair_dimensions.clone())
        .unwrap_or_default();
    let mut opening_frame = fixture["frames"][0].clone();
    opening_frame["canonicalEntityInputs"][0]["entityTxs"]
        .as_array_mut()
        .unwrap()
        .insert(
            0,
            serde_json::json!({
                "type": "initOrderbookExt",
                "data": {
                    "name": "cross-j fixture book",
                    "spreadDistribution": {
                        "makerBps": 0,
                        "takerBps": 0,
                        "hubBps": 10000,
                        "makerReferrerBps": 0,
                        "takerReferrerBps": 0,
                    },
                    "referenceTokenId": 1,
                    "usdQuoteAuthorityEntityId": route["source"]["entityId"],
                    "minTradeSize": { "__xlnType": "BigInt", "value": "0" },
                    "supportedPairs": [],
                },
            }),
        );
    let opening = apply_fixture_frame(runtime, &opening_frame)?;
    let committed = apply_fixture_frame(opening.replica, &fixture["frames"][2])?;
    let (source, _) = committed
        .replica
        .entity_slot(&source_hub, source_signer)
        .unwrap();
    let book = source.entity.orderbook.as_ref().expect("source orderbook");
    assert!(book.books.keys().any(|pair| pair.starts_with("cross:")));
    assert_eq!(
        book.pair_dimensions, initial_dimensions,
        "TS commits decimal layouts only for same-j books; a new cross-j book must preserve that map",
    );
    let snapshot = book.snapshot().expect("canonical orderbook snapshot");
    let restored = xln_rscore_entity_kernel::OrderbookState::restore(snapshot.clone())
        .expect("restore cross-j book without a same-j decimal layout");
    assert_eq!(
        &restored, book,
        "restore preserves every canonical book field"
    );
    let mut extra_dimensions = snapshot.clone();
    let cross_pair = book
        .books
        .keys()
        .find(|pair| pair.starts_with("cross:"))
        .unwrap();
    extra_dimensions.pair_dimensions.insert(
        cross_pair.clone(),
        xln_rscore_entity_kernel::PairDimensions {
            base_token_decimals: 6,
            quote_token_decimals: 6,
        },
    );
    assert!(
        xln_rscore_entity_kernel::OrderbookState::restore(extra_dimensions)
            .unwrap_err()
            .to_string()
            .contains("ORDERBOOK_PAIR_DIMENSIONS_INVALID"),
        "a prior invalid Rust snapshot is rejected, never silently rewritten",
    );
    let mut missing_route = snapshot;
    missing_route
        .offers
        .values_mut()
        .find(|offer| offer.cross_jurisdiction.is_some())
        .expect("matching cross-j offer")
        .cross_jurisdiction = None;
    assert!(
        xln_rscore_entity_kernel::OrderbookState::restore(missing_route).is_err(),
        "a cross-j book still requires its matching canonical offer route",
    );
    Ok(())
}

#[test]
fn production_runtime_executes_shared_cross_j_opening_lifecycle() -> Result<(), RuntimeMachineError>
{
    let fixture: Value = serde_json::from_str(FIXTURE).expect("cross-J lifecycle fixture");
    let frames = fixture["frames"].as_array().expect("fixture frames");
    let routes = route_table(&fixture);
    let hub = runtime_from_initial(&fixture, "hub")?;
    let user = runtime_from_initial(&fixture, "user")?;

    let mut opening = apply_fixture_frame(hub, &frames[0])?;
    assert_fixture_frame(&mut opening, &routes, &frames[0]);
    let mut proposals = apply_fixture_frame(user, &frames[1])?;
    assert_fixture_frame(&mut proposals, &routes, &frames[1]);
    let mut acknowledgements = apply_fixture_frame(opening.replica, &frames[2])?;
    assert_fixture_frame(&mut acknowledgements, &routes, &frames[2]);
    Ok(())
}

#[test]
fn cross_j_r6_h65_empty_ack_and_remote_output_share_one_entity_frame()
-> Result<(), RuntimeMachineError> {
    let fixture: Value = serde_json::from_str(FIXTURE).expect("cross-J lifecycle fixture");
    let frames = fixture["frames"].as_array().unwrap();
    let route = &fixture["setup"]["route"];
    let mut ack = frames[2]["canonicalEntityInputs"][1].clone();
    ack.as_object_mut()
        .unwrap()
        .remove("atomicCrossJurisdictionPair");
    let empty = serde_json::json!({
        "entityId": ack["entityId"],
        "signerId": ack["signerId"],
        "entityTxs": [],
    });
    let mut prepared_route = route.clone();
    prepared_route["orderId"] = Value::from("h65-remote-prepare");
    prepared_route.as_object_mut().unwrap().remove("routeHash");
    let mut remote = ack.clone();
    remote["entityTxs"] = serde_json::json!([{
        "type": "runtimeOutput",
        "data": {
            "protocol": "cross-j",
            "sourceEntityId": route["source"]["entityId"],
            "sourceSignerId": route["sourceSignerId"],
            "targetEntityId": ack["entityId"],
            "entityTxs": [{
                "type": "prepareCrossJurisdictionSwap",
                "data": { "route": prepared_route },
            }],
        },
    }]);
    let mut input = frames[2].clone();
    input["canonicalEntityInputs"] = serde_json::json!([empty, ack, remote]);
    let opening = apply_fixture_frame(runtime_from_initial(&fixture, "hub")?, &frames[0])?;
    let result = apply_fixture_frame(opening.replica, &input)?;
    assert_eq!(
        result.applied_frame.as_ref().unwrap().entity_inputs,
        input["canonicalEntityInputs"].as_array().unwrap().clone(),
        "all three original Runtime inputs remain accepted in order",
    );
    assert_eq!(
        result.outputs.entities.len(),
        1,
        "remote runtimeOutput admits alongside the earlier ACK before the shared owner flush",
    );
    let output = &result.outputs.entities[0];
    let (state, live) = result
        .replica
        .entity_slot(&output.entity_id, &output.signer_id)
        .unwrap();
    let head = live.entity_consensus.certified_frame_head.as_ref().unwrap();
    assert_eq!(
        head.frame
            .txs
            .iter()
            .map(|tx| tx.kind.as_str())
            .collect::<Vec<_>>(),
        vec!["accountInput", "runtimeOutput"],
        "the empty input contributes no EntityTx; ACK and remote output share the certified frame",
    );
    assert!(
        state
            .entity
            .cross_jurisdiction_swaps
            .as_ref()
            .unwrap()
            .get("h65-remote-prepare")
            .is_some(),
        "the authenticated remote prepare commits its new raw intent",
    );
    Ok(())
}

#[test]
fn external_runtime_output_preserves_signed_ack_frame_boundary() -> Result<(), RuntimeMachineError>
{
    let fixture: Value = serde_json::from_str(FIXTURE).expect("cross-J lifecycle fixture");
    let frames = fixture["frames"].as_array().expect("fixture frames");
    let mut ack = frames[2]["canonicalEntityInputs"][0].clone();
    ack.as_object_mut()
        .expect("ACK envelope")
        .remove("atomicCrossJurisdictionPair");
    // This Runtime forwards an independently signed ACK alongside its own
    // committed output; both retain that output author's recorded Runtime.
    ack["from"] = frames[1]["canonicalEntityInputs"][0]["from"].clone();
    let wrapper = &frames[0]["entityFrames"][2]["txs"][0];
    let mut output = ack.clone();
    output["entityTxs"] = serde_json::json!([wrapper]);
    let mut next_output = output.clone();
    next_output["sourceRuntimeFrame"]["height"] = Value::from(2);
    let mut distinct_output = output.clone();
    distinct_output["entityTxs"][0]["data"]["entityTxs"] = serde_json::json!([
        wrapper["data"]["entityTxs"][0],
        wrapper["data"]["entityTxs"][0],
    ]);
    for (inputs, expected_inputs) in [
        (
            vec![ack.clone(), output.clone()],
            vec![ack.clone(), output.clone()],
        ),
        (
            vec![output.clone(), ack.clone()],
            vec![output.clone(), ack.clone()],
        ),
        (
            vec![ack.clone(), output.clone(), output.clone()],
            vec![ack.clone(), output.clone()],
        ),
        (
            vec![output.clone(), ack.clone(), output.clone()],
            vec![output.clone(), ack.clone()],
        ),
        (
            vec![output.clone(), next_output.clone()],
            vec![output.clone(), next_output],
        ),
        (
            vec![output.clone(), distinct_output.clone()],
            vec![output.clone(), distinct_output],
        ),
    ] {
        let hub = runtime_from_initial(&fixture, "hub")?;
        let opening = apply_fixture_frame(hub, &frames[0])?;
        let mut frame = frames[2].clone();
        frame["canonicalEntityInputs"] = Value::Array(inputs.clone());
        let result = apply_fixture_frame(opening.replica, &frame)?;
        let applied = result
            .applied_frame
            .as_ref()
            .expect("committed Runtime frame");
        assert_eq!(
            applied.entity_inputs, expected_inputs,
            "exact authenticated WAL envelopes"
        );
        let mut replay_frame = applied.frame.clone();
        for row in &result.outputs.entities {
            let canonical = row.entity_context.clone();
            let context =
                crate::tagged_json_from_canonical_value(&canonical).expect("stored context");
            replay_frame
                .entity_contexts
                .entry(RuntimeEntityKey::new(row.entity_id, &row.signer_id)?)
                .or_default()
                .push_back(crate::RuntimeEntityFrameContext {
                    execution: crate::entity_context_json::decode_entity_frame_context(&context)
                        .expect("WAL context decoder"),
                    canonical,
                });
        }
        let restored = apply_fixture_frame(runtime_from_initial(&fixture, "hub")?, &frames[0])?;
        let replay = crate::apply_runtime(
            restored.replica,
            crate::RuntimeInput {
                runtime_txs: applied.runtime_txs.clone(),
                entity_inputs: applied
                    .entity_inputs
                    .iter()
                    .cloned()
                    .map(RuntimeEntityInput::decode)
                    .collect::<Result<Vec<_>, _>>()?,
                frame: replay_frame,
            },
        )?;
        assert_eq!(replay.replica.state.height, result.replica.state.height);
        assert_eq!(
            replay
                .outputs
                .entities
                .iter()
                .map(|row| &row.entity_frame_hash)
                .collect::<Vec<_>>(),
            result
                .outputs
                .entities
                .iter()
                .map(|row| &row.entity_frame_hash)
                .collect::<Vec<_>>(),
            "same accepted Runtime frame replays every certified Entity hash"
        );
        // External Runtime inputs preserve their authenticated boundaries in
        // the WAL. Their same-owner Entity transactions are admitted in order
        // before one proposal flush. REGISTER setup stays queued when the
        // same flush contains an ACK; this preserves the commit-phase boundary.
        assert_eq!(result.outputs.entities.len(), 1, "one same-owner flush");
        let output = &result.outputs.entities[0];
        let (_, live) = result
            .replica
            .entity_slot(&output.entity_id, &output.signer_id)
            .expect("flushed Entity");
        let head = live.entity_consensus.certified_frame_head.as_ref().unwrap();
        let expected = expected_inputs
            .iter()
            .map(|input| RuntimeEntityInput::decode(input.clone()))
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .flat_map(|input| input.into_parts().1)
            .map(|pending| match pending {
                super::super::types::EntityPendingWork::Account { projected, .. }
                | super::super::types::EntityPendingWork::ProposerMaterialized {
                    projected, ..
                } => projected,
                _ => panic!("fixture contains only ACK and remote runtimeOutput"),
            })
            .collect::<Vec<_>>();
        let contains_ack = expected.iter().any(|tx| tx.kind.as_str() == "accountInput");
        let (selected, deferred): (Vec<_>, Vec<_>) = expected
            .into_iter()
            .partition(|tx| !contains_ack || tx.kind.as_str() == "accountInput");
        assert_eq!(
            head.frame.txs, selected,
            "the certified frame retains the exact selected canonical transaction bodies and order",
        );
        assert_eq!(
            live.entity_mempool
                .iter()
                .map(|pending| match pending {
                    super::super::types::EntityPendingWork::ProposerMaterialized {
                        projected,
                        ..
                    } => projected.clone(),
                    _ => panic!("only REGISTER wrappers may remain deferred"),
                })
                .collect::<Vec<_>>(),
            deferred,
            "every deferred REGISTER wrapper retains its complete canonical body and original order",
        );
    }
    Ok(())
}

#[test]
fn external_runtime_output_rejects_unbound_or_mixed_envelopes() {
    let fixture: Value = serde_json::from_str(FIXTURE).expect("cross-J lifecycle fixture");
    let ack = &fixture["frames"][2]["canonicalEntityInputs"][0];
    let wrapper = &fixture["frames"][0]["entityFrames"][2]["txs"][0];
    let mut output = ack.clone();
    output
        .as_object_mut()
        .expect("envelope")
        .remove("atomicCrossJurisdictionPair");
    output["from"] = fixture["frames"][1]["canonicalEntityInputs"][0]["from"].clone();
    output["entityTxs"] = serde_json::json!([wrapper]);
    let decoded = RuntimeEntityInput::decode(output.clone()).expect("routed protocol output");
    assert!(decoded.runtime_output().is_some());
    assert_eq!(decoded.canonical(), &output);
    for field in ["from", "runtimeId", "sourceRuntimeFrame"] {
        let mut unbound = output.clone();
        unbound.as_object_mut().expect("envelope").remove(field);
        assert!(
            RuntimeEntityInput::decode(unbound).is_err(),
            "missing {field}"
        );
    }
    let mut local = output.clone();
    for field in ["from", "runtimeId", "sourceRuntimeFrame"] {
        local.as_object_mut().expect("envelope").remove(field);
    }
    assert!(
        RuntimeEntityInput::decode(local).is_err(),
        "user cannot author protocol outputs"
    );
    for txs in [
        serde_json::json!([ack["entityTxs"][0], wrapper]),
        serde_json::json!([wrapper, ack["entityTxs"][0]]),
        serde_json::json!([wrapper, wrapper]),
        wrapper["data"]["entityTxs"].clone(),
    ] {
        let mut mixed = output.clone();
        mixed["entityTxs"] = txs;
        assert!(
            RuntimeEntityInput::decode(mixed).is_err(),
            "sole authenticated wrapper required"
        );
    }
}

#[test]
fn duplicate_runtime_output_rejects_j_prefix_equivocation() -> Result<(), RuntimeMachineError> {
    let fixture: Value = serde_json::from_str(FIXTURE).expect("cross-J lifecycle fixture");
    let runtime = runtime_from_initial(&fixture, "hub")?;
    let mut output = fixture["frames"][2]["canonicalEntityInputs"][0].clone();
    output
        .as_object_mut()
        .expect("envelope")
        .remove("atomicCrossJurisdictionPair");
    output["entityTxs"] = serde_json::json!([fixture["frames"][0]["entityFrames"][2]["txs"][0]]);
    let (state, live) = runtime
        .entity_slot(
            &hex::<32>(text(&output, "entityId")),
            text(&output, "signerId"),
        )
        .expect("recorded recipient");
    let mut finalized = state.entity.clone();
    finalized.j_history_finality = Some(
        canonical_value_from_tagged_json(&serde_json::json!({
            "jurisdictionRef": fixture["setup"]["route"]["target"]["jurisdiction"],
            "finalizedThroughHeight": 0,
            "tipBlockHash": format!("0x{}", "00".repeat(32)),
            "eventHistoryRoot": prefixed(&xln_rscore_entity_kernel::EMPTY_J_HISTORY_ROOT),
        }))
        .expect("complete certified J base"),
    );
    let attest = |target_height| {
        let signed = xln_rscore_entity_kernel::build_required_j_prefix_certificate(
            &live.entity_signer,
            &live.entity_consensus.state.authority,
            &finalized,
            target_height,
            "genesis",
            None,
        )
        .expect("real Entity signature")
        .expect("required prefix");
        let mut wire = output.clone();
        wire["jPrefixAttestations"] = crate::tagged_json_from_canonical_value(&signed)
            .expect("certificate wire")["attestations"]
            .clone();
        RuntimeEntityInput::decode(wire).expect("complete signed attestation input")
    };
    let first = attest(1);
    let conflicting = attest(2);
    let absent = RuntimeEntityInput::decode(output)?;
    for pair in [
        vec![first.clone(), conflicting],
        vec![absent.clone(), first.clone()],
        vec![first.clone(), absent],
    ] {
        assert!(
            matches!(super::super::apply::merge_runtime_output_inputs(pair),
            Err(RuntimeMachineError::EntityInputTransportInvalid(detail))
                if detail == "ENTITY_INPUT_J_PREFIX_EQUIVOCATION")
        );
    }
    let merged =
        super::super::apply::merge_runtime_output_inputs(vec![first.clone(), first.clone()])?;
    assert_eq!(merged.len(), 1);
    assert_eq!(
        merged[0].canonical(),
        first.canonical(),
        "retain first signed evidence exactly"
    );
    Ok(())
}
