use super::*;

fn reconstruct_with_board(
    local_position: Option<usize>,
    uppercase: bool,
) -> Result<crate::RuntimeEntityReplica, RuntimeMachineError> {
    let mut runtime = replica(RuntimeLimits::hlt())?;
    let (key, mut resident) = runtime.e_replicas.pop_first().expect("resident replica");
    let state = runtime.state.e_replicas.get(&key).expect("committed state");
    let peer_key = fixture(derive_signer_key(SEED, "other-validator"));
    let peer = address_of_private_key(&peer_key).expect("real peer key");
    let peer_id = format!(
        "0x{}",
        peer.iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    );
    let mut validators = vec![peer_id];
    if let Some(position) = local_position {
        validators.insert(position, resident.signer_id.clone());
    }
    if uppercase {
        validators = validators.into_iter().map(|id| id.to_uppercase()).collect();
    }
    let authority = &mut resident.entity_consensus.state.authority;
    authority.config.shares = validators.iter().map(|id| (id.clone(), 1)).collect();
    authority.config.threshold = validators.len() as u16;
    authority.leader_state.active_validator_id = validators[0].clone();
    authority.config.validators = validators;
    crate::RuntimeEntityReplica::new(
        state,
        resident.entity_id,
        resident.signer_id,
        resident.accounts,
        resident.entity_consensus,
        resident.entity_signer,
        resident.protocol_fingerprint,
        runtime.state.height,
    )
}

#[test]
fn replica_creation_uses_ordered_board_for_proposer_role() {
    for position in [0, 1] {
        for uppercase in [false, true] {
            let resident = reconstruct_with_board(Some(position), uppercase).expect("board member");
            assert_eq!(resident.replica_metadata()["isProposer"], position == 0);
            assert_eq!(resident.replica_metadata()["signerId"], resident.signer_id);
            assert!(resident.entity_consensus.certified_frame_head.is_none());
        }
    }
}

#[test]
fn replica_creation_rejects_local_key_outside_board() {
    let error = match reconstruct_with_board(None, false) {
        Ok(_) => panic!("non-member must not become a replica"),
        Err(error) => error,
    };
    assert!(matches!(error, RuntimeMachineError::ReplicaMetadata(detail)
        if detail == "SIGNER_OUTSIDE_AUTHORITY"));
}
