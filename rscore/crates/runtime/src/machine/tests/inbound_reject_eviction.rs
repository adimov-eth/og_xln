//! Parity regression for the REJECT POLICY on authenticated peer Account
//! inputs.
//!
//! TS throws `MalformedEntityFrameInputError` out of the accountInput handler
//! (`core/entity/tx/handlers/account/input-phases.ts`), rebinds the failing
//! parent Entity tx onto the error
//! (`core/entity/consensus/frame/application.ts`), and
//! `buildEntityProposalEvictingRejected`
//! (`core/entity/consensus/proposal/start.ts`) removes exactly that tx from the
//! proposal AND the mempool before rebuilding the frame. The certified frame
//! therefore never contains a rejected `accountInput` tx.
//!
//! Rust used to keep the tx: the resident round only reported the reject as
//! data, so `frame.txs` still carried it and the Entity frame hash / Entity
//! root diverged from TS for the same input set.

use super::*;

fn healthy_command() -> RuntimeEntityInput {
    RuntimeEntityInput::decode(serde_json::json!({
        "entityId": hex32(owner_bytes()),
        "signerId": entity_signer_id(),
        "entityTxs": [{
            "type": "chat",
            "data": {"from": entity_signer_id(), "message": "healthy neighbour tx"}
        }]
    }))
    .expect("healthy Entity command")
}

/// An ACK for a height/frame hash the seeded Account never proposed. The
/// Account records `AckRejected` and mutates nothing: a sender-caused reject,
/// not an engine fault.
fn rejected_peer_account_input() -> RuntimeEntityInput {
    RuntimeEntityInput::decode(account_ack_entity_input()).expect("authenticated peer ACK")
}

/// A second, wire-distinct rejecting ACK. Exact duplicates collapse in
/// `append_entity_pending_work`, so the frame hash must differ for the round to
/// carry two independent parent `accountInput` transactions.
fn other_rejected_peer_account_input() -> RuntimeEntityInput {
    let mut canonical = account_ack_entity_input();
    canonical["entityTxs"][0]["data"]["ack"]["frameHash"] =
        serde_json::Value::String(format!("0x{}", "66".repeat(32)));
    RuntimeEntityInput::decode(canonical).expect("second authenticated peer ACK")
}

fn run(inputs: Vec<RuntimeEntityInput>) -> crate::machine::types::RuntimeApplyResult {
    apply_runtime_live(
        replica(RuntimeLimits::hlt()).expect("runtime replica"),
        RuntimeLiveInput {
            runtime_txs: Vec::new(),
            entity_inputs: inputs,
            timestamp: 200,
            finalized_j_height: 0,
        },
        &mut CanonicalEntityInfraMaterializer::new(),
    )
    .expect("a rejected peer Account input is evicted, never a halt")
}

fn certified_txs(
    applied: &crate::machine::types::RuntimeApplyResult,
) -> Vec<xln_rscore_entity_kernel::EntityTxKind> {
    applied.replica.e_replicas[&entity_key()]
        .entity_consensus
        .certified_frame_head
        .as_ref()
        .expect("certified Entity frame")
        .frame
        .txs
        .iter()
        .map(|tx| tx.kind)
        .collect()
}

/// The end state, not the log line: a round that rejects one authenticated peer
/// Account input must certify a frame whose tx list excludes that parent
/// `accountInput` tx, keep every other tx, and land on exactly the Entity root
/// the same input set produces when the rejected tx was never offered.
#[test]
fn rejected_inbound_account_input_is_evicted_from_the_certified_frame() {
    let baseline = run(vec![healthy_command()]);
    let result = run(vec![rejected_peer_account_input(), healthy_command()]);
    let key = entity_key();

    assert_eq!(
        certified_txs(&baseline),
        vec![xln_rscore_entity_kernel::EntityTxKind::EntityCommand],
        "baseline frame is the healthy tx alone",
    );
    assert_eq!(
        certified_txs(&result),
        certified_txs(&baseline),
        "the rejected accountInput must not reach frame.txs",
    );

    assert_eq!(result.outputs.entities.len(), 1);
    assert_eq!(
        result.outputs.entities[0].entity_frame_hash,
        baseline.outputs.entities[0].entity_frame_hash,
        "same certified Entity frame as the never-offered input set",
    );
    assert_eq!(
        result.outputs.entities[0].entity_state_root,
        baseline.outputs.entities[0].entity_state_root,
        "same Entity root as the never-offered input set",
    );
    assert_eq!(
        result.outputs.entities[0].entity_frame_events,
        baseline.outputs.entities[0].entity_frame_events,
    );
    assert_eq!(
        result.replica.state.e_replicas[&key].entity,
        baseline.replica.state.e_replicas[&key].entity,
    );
    assert_eq!(
        result.replica.state.e_replicas[&key].accounts_root,
        baseline.replica.state.e_replicas[&key].accounts_root,
        "a rejected inbound AccountInput leaves the Account overlays unpublished",
    );
    assert!(
        result.replica.e_replicas[&key].entity_mempool.is_empty(),
        "TS drops the evicted tx from the mempool as well",
    );
}

/// The rejected input alone: nothing is left to certify, so the attempt returns
/// no Entity frame and keeps its WAL context available, exactly like the
/// rejected outer-command path.
#[test]
fn a_lone_rejected_inbound_account_input_certifies_no_entity_frame() {
    let before = replica(RuntimeLimits::hlt()).expect("runtime replica");
    let key = entity_key();
    let before_entity = before.state.e_replicas[&key].entity.clone();
    let before_root = before.state.e_replicas[&key].accounts_root;
    let mut result = apply_runtime_live(
        before,
        RuntimeLiveInput {
            runtime_txs: Vec::new(),
            entity_inputs: vec![rejected_peer_account_input()],
            timestamp: 200,
            finalized_j_height: 0,
        },
        &mut CanonicalEntityInfraMaterializer::new(),
    )
    .expect("a lone rejected inbound AccountInput is evicted, never a halt");
    assert!(result.outputs.entities.is_empty());
    assert!(result.account_commits.is_empty());
    assert_eq!(result.replica.state.e_replicas[&key].entity, before_entity);
    assert_eq!(
        result.replica.state.e_replicas[&key].accounts_root,
        before_root
    );
    assert!(result.replica.e_replicas[&key].entity_mempool.is_empty());
    let applied = result
        .applied_frame
        .take()
        .expect("Runtime input remains journalled");
    assert_eq!(applied.entity_frame_count, 0);
    assert_eq!(applied.frame.entity_contexts[&key].len(), 1);
}

/// Two rejects in one round. TS evicts one tx per attempt and rebuilds the
/// frame (`buildEntityProposalEvictingRejected` loops), so Rust evicts the
/// first reject and lets the rebuilt round surface the next one. The loop
/// converges on exactly the frame the healthy tx produces alone.
#[test]
fn every_rejected_inbound_account_input_is_evicted_across_rebuilt_rounds() {
    let baseline = run(vec![healthy_command()]);
    let result = run(vec![
        rejected_peer_account_input(),
        healthy_command(),
        other_rejected_peer_account_input(),
    ]);
    let key = entity_key();

    assert_eq!(
        certified_txs(&result),
        certified_txs(&baseline),
        "both rejected accountInput txs are evicted, the healthy tx survives",
    );
    assert_eq!(
        result.outputs.entities[0].entity_frame_hash,
        baseline.outputs.entities[0].entity_frame_hash,
    );
    assert_eq!(
        result.outputs.entities[0].entity_state_root,
        baseline.outputs.entities[0].entity_state_root,
    );
    assert_eq!(
        result.replica.state.e_replicas[&key].accounts_root,
        baseline.replica.state.e_replicas[&key].accounts_root,
    );
    assert!(result.replica.e_replicas[&key].entity_mempool.is_empty());
}
