//! One live Entity collection plus the exact fsynced Runtime commitment.
use serde_json::{Value, json};
use xln_rscore_process::runtime_http::CrossJurisdictionStateResponse;
use xln_rscore_runtime::{
    ResidentRuntimeService, decode_storage_payload, tagged_json_from_canonical_value,
};

pub(super) fn read(
    service: &mut ResidentRuntimeService,
    entity_id: [u8; 32],
) -> Result<CrossJurisdictionStateResponse, String> {
    service
        .sync_committed()
        .map_err(|error| format!("RRS_CROSS_STATE_SYNC:{error}"))?;
    let (key, height, routes, jurisdiction) = {
        let replica = service
            .processor()
            .replica()
            .map_err(|error| format!("RRS_CROSS_STATE_REPLICA:{error}"))?;
        let mut owners = replica
            .state
            .e_replicas
            .iter()
            .filter(|(key, _)| key.entity_id == entity_id);
        let Some((key, state)) = owners.next() else {
            return Ok(CrossJurisdictionStateResponse::Missing);
        };
        if owners.next().is_some() {
            return Err("RRS_CROSS_STATE_OWNER_AMBIGUOUS".into());
        }
        let routes = state
            .entity
            .cross_jurisdiction_swaps
            .iter()
            .flat_map(|collection| collection.keyed_values())
            .map(|(_, value)| tagged_json_from_canonical_value(value))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("RRS_CROSS_STATE_ROUTES:{error}"))?;
        let jurisdiction = replica
            .e_replicas
            .get(key)
            .ok_or("RRS_CROSS_STATE_LIVE_OWNER_MISSING")?
            .entity_consensus
            .state
            .authority
            .config
            .jurisdiction
            .as_ref()
            .map(tagged_json_from_canonical_value)
            .transpose()
            .map_err(|error| format!("RRS_CROSS_STATE_JURISDICTION:{error}"))?;
        (key.clone(), replica.state.height, routes, jurisdiction)
    };
    if height == 0 {
        return Ok(CrossJurisdictionStateResponse::NotCommitted);
    }
    let durable = service
        .read_durable_frame(height)
        .map_err(|error| format!("RRS_CROSS_STATE_WAL:{error}"))?;
    let frame = decode_storage_payload(&durable.frame_bytes)
        .map_err(|error| format!("RRS_CROSS_STATE_WAL_DECODE:{error}"))?;
    let canonical_hash = frame
        .get("canonicalStateHash")
        .filter(|value| !value.is_null())
        .or_else(|| frame.get("postStateHash"))
        .and_then(Value::as_str)
        .ok_or("RRS_CROSS_STATE_WAL_ROOT_MISSING")?;
    if frame["height"].as_u64() != Some(height) {
        return Err("RRS_CROSS_STATE_WAL_HEIGHT_MISMATCH".into());
    }
    Ok(CrossJurisdictionStateResponse::State(
        json!({"entityId":super::digest_hex(&key.entity_id),"signerId":key.signer_id,"jurisdiction":jurisdiction,"frame":{"height":height,"canonicalStateHash":canonical_hash},"routes":routes}),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use xln_rscore_entity_kernel::EntityProfile;
    use xln_rscore_process::native_genesis::{
        NativeGenesisConfig, NativeGenesisEntity, create_native_genesis_runtime_processor,
    };
    use xln_rscore_runtime::processor::EntityRouteTable;
    use xln_rscore_runtime::transport::{DirectRuntimeIngress, DirectRuntimeIngressConfig};
    use xln_rscore_runtime::{CanonicalEntityInfraMaterializer, RuntimeEntityInput};

    #[test]
    fn cross_query_joins_live_entity_with_exact_fsynced_frame_without_creating_state() {
        let seed = "native-cross-query";
        let directory =
            std::env::temp_dir().join(format!("xln-native-cross-query-{}", std::process::id()));
        let genesis = NativeGenesisConfig {
            timestamp: 1,
            machine: json!({"runtimeId":format!("0x{}",hex::encode(xln_rscore_engine::derive_signer_address(seed,"runtime").unwrap())),"activeJurisdiction":"test","runtimeConfig":{"minFrameDelayMs":0},"infrastructure":{},"jReplicas":[]}),
            entities: vec![NativeGenesisEntity {
                signer_label: "entity".into(),
                entity_authority_jurisdiction: None,
                entity_profile: EntityProfile::default_for_entity("query"),
                entity_encryption_public_key: [1; 32],
                htlc_routing_fee_ppm: 0,
                htlc_routing_base_fee: 0.into(),
            }],
        };
        let ready = create_native_genesis_runtime_processor(
            &directory,
            genesis,
            seed,
            "runtime",
            "entity",
            1,
            EntityRouteTable::new([]).unwrap(),
        )
        .unwrap();
        let key = ready
            .processor
            .replica()
            .unwrap()
            .state
            .e_replicas
            .keys()
            .next()
            .unwrap()
            .clone();
        let ingress = DirectRuntimeIngress::bind(DirectRuntimeIngressConfig::production(
            "127.0.0.1:0".parse().unwrap(),
            seed,
            "runtime",
        ))
        .unwrap();
        let mut service = ResidentRuntimeService::new(
            ready.processor,
            ingress,
            Box::new(CanonicalEntityInfraMaterializer::new()),
        )
        .unwrap();
        assert!(matches!(
            read(&mut service, [0xff; 32]).unwrap(),
            CrossJurisdictionStateResponse::Missing
        ));
        assert!(matches!(
            read(&mut service, key.entity_id).unwrap(),
            CrossJurisdictionStateResponse::NotCommitted
        ));
        let mut roots = Vec::new();
        for height in 1..=2 {
            let input = RuntimeEntityInput::decode(json!({"entityId":super::super::digest_hex(&key.entity_id),"signerId":key.signer_id,"entityTxs":[{"type":"chat","data":{"from":key.signer_id,"message":format!("committed-{height}")}}]})).unwrap();
            service
                .process_local_entity_inputs_at(vec![input], height + 1)
                .unwrap()
                .expect("real Entity frame");
            let CrossJurisdictionStateResponse::State(state) =
                read(&mut service, key.entity_id).unwrap()
            else {
                panic!("committed query state")
            };
            let durable = service.read_durable_frame(height).unwrap();
            let frame = decode_storage_payload(&durable.frame_bytes).unwrap();
            assert_eq!(state["frame"]["height"], height);
            assert_eq!(
                state["frame"]["canonicalStateHash"],
                frame["canonicalStateHash"]
                    .as_str()
                    .map(Value::from)
                    .unwrap_or_else(|| frame["postStateHash"].clone())
            );
            assert_ne!(state["frame"]["canonicalStateHash"], frame["frameHash"]);
            assert_eq!(state["routes"], json!([]));
            assert_eq!(state["signerId"], key.signer_id);
            let CrossJurisdictionStateResponse::State(repeated) =
                read(&mut service, key.entity_id).unwrap()
            else {
                panic!("repeated committed query")
            };
            assert_eq!(repeated, state);
            assert_eq!(service.processor().replica().unwrap().state.height, height);
            roots.push(state["frame"]["canonicalStateHash"].clone());
        }
        assert_ne!(roots[0], roots[1]);
        service.shutdown().unwrap();
        drop(service);
        std::fs::remove_dir_all(directory).unwrap();
    }
}
