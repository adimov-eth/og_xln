use super::*;
use xln_rscore_entity_kernel::{ScheduledHookKind, ScheduledHookMap};

// The first restored R7 live wake failed on this committed order's expiry.
const R7_EXPIRY: &str = "cross-j-expiry:mmx-b57761-6d6ba0-1-1-5232fa982d280b1e015b715ea727378bc2c0cdee161a3a571f78338f8c637f1b-sell-1";

#[test]
fn cross_j_r7_expiry_executes_collective_sweep_in_the_same_frame_w1_w4() {
    let hub = entity(&identity("hub"));
    let mut oracle = None;
    for workers in [1, 4] {
        let mut accounts = ResidentConsensusEngine::restore(
            EngineGeneration::from_bytes([0x75; 8]),
            workers,
            0,
            derive_signer_key(SEED, "hub").unwrap(),
            "hub".into(),
            support::market(),
            Vec::new(),
        )
        .unwrap();
        let base_root = accounts.accounts_root();
        let hook = |id: &str, trigger_at, reason: &str| ScheduledHook {
            id: id.into(),
            trigger_at,
            kind: ScheduledHookKind::CrossJOrderbookSweep {
                reason: reason.into(),
            },
        };
        let crontab = CrontabState {
            tasks: BTreeMap::new(),
            hooks: ScheduledHookMap::restore(BTreeMap::from([
                (R7_EXPIRY.into(), hook(R7_EXPIRY, TIMESTAMP - 1, R7_EXPIRY)),
                ("empty-reason".into(), hook("empty-reason", TIMESTAMP, "")),
                ("future".into(), hook("future", TIMESTAMP + 1, "future")),
            ]))
            .unwrap(),
        };
        let jobs = collect_due_scheduled_wake_jobs(&crontab, TIMESTAMP, false).unwrap();
        let mut state = EntityStateSlice::empty(hub.to_string(), TIMESTAMP);
        state.crontab = Some(crontab);
        let result = apply_resident_entity_round(
            &mut accounts,
            state,
            ResidentEntityRequest {
                inbound: EntityInboundRequest {
                    owner_entity_id: *hub.as_bytes(),
                    owning_entity_is_hub: false,
                    expected_accounts_root: base_root,
                    clock: ReceiverClock {
                        entity_timestamp: TIMESTAMP,
                        finalized_j_height: 0,
                    },
                    rows: Vec::new(),
                    post_accounts: false,
                },
                local_certified_board_authority: xln_rscore_batch::AccountInputBoardAuthority::Lazy,
                entity_height: 91,
                outbound_timestamp: TIMESTAMP,
                outbound_j_height: 0,
                checkpoint_due: false,
                post_accounts: false,
                runtime_seed: None,
                scheduled_wake: Some(ScheduledWake {
                    version: 1,
                    proposer_signer_id: "hub".into(),
                    due_at: TIMESTAMP - 1,
                    // The diagnostic prefix cannot suppress another due hook.
                    jobs: jobs.into_iter().take(1).collect(),
                }),
                expected_proposer_signer_id: "hub".into(),
                finalized_j_events: None,
                entity_authority: Some(single_signer_authority("hub")),
                local_account_genesis_policy: None,
                cross_j_opening_sibling_views: Vec::new(),
                operations: Vec::new(),
            },
            &DeterministicContext::hlt_default(),
        )
        .unwrap_or_else(|error| panic!("R7 expiry W{workers}: {error}"));
        assert_eq!(accounts.accounts_root(), base_root);
        assert!(
            result.routed_entity_outputs.is_empty(),
            "no extra self Runtime frame"
        );
        assert!(result.j_outputs.is_empty());
        let hooks = &result.state.crontab.as_ref().unwrap().hooks;
        assert_eq!(hooks.len(), 1);
        assert!(hooks.contains_key("future"));
        let sweeps = result
            .entity_frame_events
            .iter()
            .filter_map(|event| match event {
                EntityFrameEvent::Status { message }
                    if message.starts_with("🌉 Cross-j orderbook sweep") =>
                {
                    Some(message.clone())
                }
                _ => None,
            })
            .collect::<Vec<_>>();
        assert_eq!(sweeps, vec![
            format!("🌉 Cross-j orderbook sweep: {R7_EXPIRY} expired=0 closedOffers=0 waiting=0"),
            "🌉 Cross-j orderbook sweep: cross-j-orderbook-sweep expired=0 closedOffers=0 waiting=0".into(),
        ]);
        let evidence = (
            result.commitments,
            result.entity_frame_events,
            result.outputs,
        );
        if let Some(expected) = &oracle {
            assert_eq!(&evidence, expected, "worker-count semantic parity");
        } else {
            oracle = Some(evidence);
        }
    }
}
