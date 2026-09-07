use super::*;
use xln_rscore_engine::{AccountStateSeed, Delta, TokenId, prepare_settlement_execution};

const VECTOR: &str = include_str!(
    "../../../../../fixtures/entity-resident-group-e/settlement-execute-ready-v1.json"
);

fn ready_runtime() -> (RuntimeReplica, RuntimeEntityKey, String) {
    let vector: serde_json::Value =
        serde_json::from_str(VECTOR).expect("TS signed settlement vector");
    let setup = &vector;
    let seed = setup["seed"].as_str().expect("seed");
    let owner_text = setup["leftEntityId"].as_str().expect("owner");
    let peer_text = setup["rightEntityId"].as_str().expect("peer");
    let signer_id = setup["leftSignerId"].as_str().expect("signer");
    let owner = EntityId::parse(owner_text).expect("owner id");
    let peer = EntityId::parse(peer_text).expect("peer id");
    let label = ["first", "second"]
        .into_iter()
        .find(|label| {
            let identity =
                SigningIdentity::lazy_from_seed(seed, label, 1, 1, BoardDelays::default())
                    .expect("signer");
            identity.entity_id() == owner.as_bytes()
        })
        .expect("exact signing key");
    let initial_account = &setup["domain"];
    let workspace = setup["workspace"].clone();
    let capacity = num_bigint::BigInt::from(10_u8).pow(30);
    let delta = Delta::new(
        TokenId::new(1).expect("token"),
        0.into(),
        0.into(),
        0.into(),
        capacity.clone(),
        capacity,
        0.into(),
        0.into(),
        0.into(),
        0.into(),
    )
    .expect("delta");
    let account_state = AccountState::restore_full(AccountStateSeed {
        identity: AccountIdentity::new(
            AccountDomain::new(
                initial_account["chainId"].as_u64().expect("chain"),
                DepositoryAddress::parse(
                    initial_account["depositoryAddress"]
                        .as_str()
                        .expect("depository"),
                )
                .expect("address"),
            )
            .expect("domain"),
            owner.clone(),
            peer.clone(),
            WatchSeed::parse(setup["watchSeed"].as_str().expect("watch seed")).expect("watch"),
        )
        .expect("account identity"),
        dispute_config: AccountDisputeConfig::new(10, 10).expect("dispute config"),
        deltas: vec![delta],
        locks: Vec::new(),
        j_nonce: 0,
        last_finalized_j_height: 0,
        carried: Default::default(),
        rebalance_fee_policies: Vec::new(),
        swap_offers: Vec::new(),
        lending_intents: Vec::new(),
        pulls: Vec::new(),
        settlement_workspace: Some(
            crate::canonical_value_from_tagged_json(&workspace).expect("workspace"),
        ),
    })
    .expect("exact Account state restore");
    let mut account = AccountReplica::new(owner.clone(), account_state).expect("Account replica");
    account.set_delta_transformer([0x99; 20]);
    prepare_settlement_execution(&account).expect("real signed execution proof is valid");
    let account_id = AccountId::from_bytes(*peer.as_bytes());
    let signing_key = derive_signer_key(seed, label).expect("key");
    let accounts = ResidentConsensusEngine::restore(
        EngineGeneration::from_bytes([0x22; 8]),
        1,
        0,
        signing_key,
        signer_id.into(),
        Arc::new(SwapMarketPolicy::default()),
        vec![AccountSeed {
            account_id,
            replica: account,
            consensus: None,
        }],
    )
    .expect("resident Accounts");
    let mut state = EntityStateSlice::empty(owner_text, 10_000);
    state.known_accounts.insert(peer_text.into());
    let authority = EntityFrameAuthority {
        config: EntityConsensusConfig {
            mode: ConsensusMode::ProposerBased,
            threshold: 1,
            validators: vec![signer_id.into()],
            shares: BTreeMap::from([(signer_id.into(), 1)]),
            jurisdiction: None,
        },
        leader_state: EntityLeaderState {
            active_validator_id: signer_id.into(),
            view: 0,
            changed_at_height: 0,
        },
    };
    let consensus = ResidentEntityConsensusReplica {
        state: EntityConsensusState {
            sections: Vec::new(),
            authority,
        },
        certified_frame_head: None,
    };
    let signer = EntitySingleSigner::from_key(
        signing_key,
        signer_id,
        owner_text,
        1,
        1,
        BoardDelays::default(),
    )
    .expect("Entity signer");
    let key = RuntimeEntityKey::new(*owner.as_bytes(), signer_id).expect("key");
    let runtime = RuntimeReplica::new(
        RuntimeState {
            height: 0,
            timestamp: 10_000,
            finalized_j_height: 0,
            e_replicas: BTreeMap::from([(
                key.clone(),
                RuntimeEntityState {
                    accounts_root: accounts.accounts_root(),
                    entity: state,
                },
            )]),
        },
        crate::processor::RuntimeDurableEnvelope::fixture(),
        *owner.as_bytes(),
        signer_id.into(),
        accounts,
        consensus,
        signer,
        [0; 32],
        seed.into(),
        RuntimeLimits::hlt(),
    )
    .expect("Runtime");
    (runtime, key, peer_text.into())
}

#[test]
fn initially_ready_settle_execute_same_and_separate_outer_match_ts_admission() {
    for separate in [false, true] {
        let (runtime, key, peer) = ready_runtime();
        let tx = serde_json::json!({"type":"settle_execute","data":{"counterpartyEntityId":peer,"disableC2RShortcut":true}});
        let input = |txs| {
            RuntimeEntityInput::decode(serde_json::json!({"entityId":hex32(key.entity_id),"signerId":key.signer_id,"entityTxs":txs})).expect("execute command")
        };
        let inputs = if separate {
            vec![input(vec![tx.clone()]), input(vec![tx])]
        } else {
            vec![input(vec![tx.clone(), tx])]
        };
        let mut result = apply_runtime_live(
            runtime,
            RuntimeLiveInput {
                runtime_txs: Vec::new(),
                entity_inputs: inputs,
                timestamp: 10_000,
                finalized_j_height: 0,
            },
            &mut CanonicalEntityInfraMaterializer::new(),
        )
        .expect("execute duplicate commands");
        assert_eq!(result.outputs.entities.len(), 1);
        let output = &result.outputs.entities[0];
        let queued = output.entity_frame_events.iter().filter(|event| matches!(event,xln_rscore_entity_kernel::EntityFrameEvent::Status{message} if message.starts_with("✅ Settlement submission queued"))).count();
        assert_eq!(queued, 2, "TS outer-command admission: separate={separate}");
        let state = &result.replica.state.e_replicas[&key].entity;
        assert_eq!(
            state
                .j_batch_state
                .as_ref()
                .expect("J batch")
                .batch
                .settlements
                .len(),
            1
        );
        assert_eq!(
            state
                .entity_command_nonces
                .as_ref()
                .expect("nonce state")
                .by_signer[&key.signer_id]
                .nonce,
            (if separate { 2 } else { 1 }).into()
        );
        let account_inputs = output
            .local_entity_outputs
            .iter()
            .flat_map(|output| &output.entity_txs)
            .filter_map(|tx| match tx {
                xln_rscore_entity_kernel::LocalEntityOutputTx::AccountInput(input) => Some(input),
                _ => None,
            })
            .collect::<Vec<_>>();
        assert_eq!(account_inputs.len(), 1);
        let xln_rscore_batch::AccountInputKind::AckFrame { frame, .. } = &account_inputs[0].kind
        else {
            panic!("one canonical Account proposal")
        };
        assert_eq!(frame.frame.txs.len(), 1);
        assert!(
            matches!(&frame.frame.txs[0],xln_rscore_engine::AccountTx::SettleTransition {data:CanonicalValue::Object(fields)} if fields.contains(&("kind".into(),CanonicalValue::String("submit".into()))))
        );
        let account_id = AccountId::from_bytes(*EntityId::parse(&peer).expect("peer").as_bytes());
        let status = result
            .replica
            .e_replicas
            .get_mut(&key)
            .expect("live Entity")
            .accounts
            .account_status(account_id, Vec::new())
            .expect("read status")
            .expect("Account");
        assert_eq!(status.mempool_len, 0);
        assert!(status.pending_frame_height.is_some());
    }
}
