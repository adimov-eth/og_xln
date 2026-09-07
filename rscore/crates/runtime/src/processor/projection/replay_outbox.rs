//! Recovery may retire remote outputs, but cannot manufacture prior evidence.

use std::collections::BTreeMap;

use serde_json::{Value, json};

use crate::storage::native::RecoveredWalFrame;
use crate::transport::msgpack::{encode_framed, encode_transport};

#[derive(Debug, Default)]
pub(crate) struct RetainedReplayOutbox {
    rows: Vec<Value>,
}

impl RetainedReplayOutbox {
    pub(crate) fn into_values(self) -> Vec<Value> {
        self.rows
    }
}

fn invalid(reason: &str) -> String {
    format!("RECOVERY_OUTBOX_{reason}")
}

fn bytes(value: &Value) -> Result<Vec<u8>, String> {
    encode_transport(value).map_err(|error| invalid(&format!("ENCODE:{error}")))
}

fn text<'a>(value: &'a Value, field: &str) -> Result<&'a str, String> {
    value[field]
        .as_str()
        .ok_or_else(|| invalid(&format!("FIELD_INVALID:{field}")))
}

fn number(value: &Value, field: &str) -> Result<u64, String> {
    value[field]
        .as_u64()
        .filter(|value| *value <= 9_007_199_254_740_991)
        .ok_or_else(|| invalid(&format!("FIELD_INVALID:{field}")))
}

fn canonical_runtime_id(value: &str) -> bool {
    value.len() == 42
        && value.starts_with("0x")
        && value[2..]
            .bytes()
            .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'))
}

fn decode(row: &[u8], height: u64) -> Result<Value, String> {
    let value =
        crate::decode_storage_payload(row).map_err(|error| invalid(&format!("DECODE:{error}")))?;
    let source_height = number(&value["sourceRuntimeFrame"], "height")?;
    number(&value["sourceRuntimeFrame"], "timestamp")?;
    if source_height > height || !canonical_runtime_id(text(&value, "runtimeId")?) {
        return Err(invalid("SOURCE_FRAME_INVALID"));
    }
    let canonical = encode_framed(&value).map_err(|error| invalid(&format!("ENCODE:{error}")))?;
    if canonical != row {
        return Err(invalid("ROW_NONCANONICAL"));
    }
    Ok(value)
}

pub(crate) fn recorded_outbox_needs_prior(
    height: u64,
    recorded: &[Vec<u8>],
) -> Result<bool, String> {
    let mut needs_prior = false;
    for row in recorded {
        let value = decode(row, height)?;
        needs_prior |= number(&value["sourceRuntimeFrame"], "height")? < height;
    }
    Ok(needs_prior)
}

fn normalized(value: &Value) -> String {
    value.as_str().unwrap_or("").trim().to_lowercase()
}

fn map_keys(value: &Value) -> Result<Vec<String>, String> {
    if value.is_null() {
        return Ok(Vec::new());
    }
    if value["__xlnType"] != "Map" {
        return Err(invalid("IDENTITY_MAP_INVALID"));
    }
    let mut keys = value["value"]
        .as_array()
        .ok_or_else(|| invalid("IDENTITY_MAP_INVALID"))?
        .iter()
        .map(|row| {
            row[0]
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| invalid("IDENTITY_MAP_KEY_INVALID"))
        })
        .collect::<Result<Vec<_>, _>>()?;
    keys.sort_by(|left, right| left.encode_utf16().cmp(right.encode_utf16()));
    Ok(keys)
}

fn leader_identity(vote: &Value) -> Result<Value, String> {
    if vote.is_null() {
        return Ok(Value::Null);
    }
    let mut prepared = vote["preparedFrame"].clone();
    if let Some(frame) = prepared.as_object_mut() {
        frame.remove("hankos");
        if let Some(leader) = frame.get_mut("leader").and_then(Value::as_object_mut) {
            leader.remove("relayCertificate");
        }
    }
    Ok(json!([
        text(vote, "voterId")?.to_lowercase(),
        normalized(&vote["entityId"]),
        vote["targetHeight"],
        vote["previousFrameHash"],
        vote["fromView"],
        vote["toView"],
        normalized(&vote["previousLeaderId"]),
        normalized(&vote["nextLeaderId"]),
        prepared,
    ]))
}

fn has_account_proposals(value: &Value) -> bool {
    value["entityTxs"].as_array().is_some_and(|txs| {
        !txs.is_empty()
            && txs.iter().all(|tx| {
                tx["type"] == "accountInput"
                    && tx["data"]["kind"] == "ack_frame"
                    && tx["data"]["proposal"].is_object()
            })
    })
}

/// Structural equivalent of TS buildRouteOutputKey. Canonical tx/vote bodies
/// replace their hashes here: this preserves identity without a second digest
/// implementation. AP identity deliberately excludes ACK/signature/source-frame
/// evidence; that complete evidence is checked separately before retention.
fn route_identity(value: &Value) -> Result<Vec<u8>, String> {
    let empty = Vec::new();
    let txs = value.get("entityTxs").map_or(Ok(&empty), |txs| {
        txs.as_array().ok_or_else(|| invalid("ENTITY_TXS_INVALID"))
    })?;
    let entity = text(value, "entityId")?.to_lowercase();
    let signer = normalized(&value["signerId"]);
    if has_account_proposals(value) {
        let proposals = txs
            .iter()
            .map(|tx| {
                let data = &tx["data"];
                let frame = &data["proposal"]["frame"];
                Ok(json!([
                    text(data, "fromEntityId")?.to_lowercase(),
                    text(data, "toEntityId")?.to_lowercase(),
                    number(frame, "height")?,
                    text(frame, "stateHash")?.to_lowercase()
                ]))
            })
            .collect::<Result<Vec<_>, String>>()?;
        let from = normalized(&value["from"]);
        return bytes(&json!([
            "ap",
            entity,
            signer,
            if canonical_runtime_id(&from) {
                from
            } else {
                String::new()
            },
            proposals
        ]));
    }
    let frame = &value["proposedFrame"];
    let precommit = &value["hashPrecommitFrame"];
    let tx_bodies = txs
        .iter()
        .map(|tx| json!([tx["type"], tx["data"]]))
        .collect::<Vec<_>>();
    bytes(&json!([
        "ro",
        [
            value["sourceRuntimeFrame"]["height"],
            value["sourceRuntimeFrame"]["timestamp"]
        ],
        entity,
        signer,
        value["from"].as_str().unwrap_or(""),
        if frame.is_null() {
            Value::Null
        } else {
            json!([frame["height"], frame["hash"]])
        },
        if precommit.is_null() {
            Value::Null
        } else {
            json!([
                precommit["height"],
                precommit["frameHash"],
                map_keys(&value["hashPrecommits"])?
            ])
        },
        leader_identity(&value["leaderTimeoutVote"])?,
        map_keys(&value["jPrefixAttestations"])?,
        tx_bodies
    ]))
}

fn financial_evidence(value: &Value) -> Result<Vec<u8>, String> {
    let mut evidence = value.clone();
    evidence["runtimeId"] = Value::String(String::new());
    bytes(&evidence)
}

/// Previous is the actual immediately preceding native WAL frame. A recorded
/// old row can only select a strictly ordered subset of that evidence. Only
/// runtimeId may change: signer, ACK/proposal, payload and origin stay exact.
/// Current-origin rows are never used to manufacture newly generated outputs.
pub(crate) fn select_retained_replay_outbox(
    height: u64,
    previous: &RecoveredWalFrame,
    recorded: &[Vec<u8>],
) -> Result<RetainedReplayOutbox, String> {
    if previous.height.checked_add(1) != Some(height) {
        return Err(invalid("PRIOR_HEIGHT_INVALID"));
    }
    let mut prior = BTreeMap::new();
    for (index, row) in previous.outputs.iter().enumerate() {
        let value = decode(row, previous.height)?;
        let evidence = financial_evidence(&value)?;
        if prior
            .insert(route_identity(&value)?, (index, value, evidence))
            .is_some()
        {
            return Err(invalid("PRIOR_IDENTITY_AMBIGUOUS"));
        }
    }
    let mut rows = Vec::new();
    let mut prior_index = None;
    for row in recorded {
        let value = decode(row, height)?;
        if number(&value["sourceRuntimeFrame"], "height")? == height {
            continue;
        }
        let (index, verified, evidence) = prior
            .get(&route_identity(&value)?)
            .ok_or_else(|| invalid("RETAINED_OUTPUT_UNPROVEN"))?;
        if financial_evidence(&value)? != *evidence {
            return Err(invalid("RETAINED_OUTPUT_UNPROVEN"));
        }
        if prior_index.is_some_and(|prior| *index <= prior) {
            return Err(invalid("RETAINED_ORDER_INVALID"));
        }
        prior_index = Some(*index);
        let mut retained = verified.clone();
        retained["runtimeId"] = value["runtimeId"].clone();
        rows.push(retained);
    }
    Ok(RetainedReplayOutbox { rows })
}

fn map_rows(value: &Value) -> Result<&[Value], String> {
    if value.is_null() {
        return Ok(&[]);
    }
    if value["__xlnType"] != "Map" {
        return Err(invalid("MERGE_MAP_INVALID"));
    }
    value["value"]
        .as_array()
        .map(Vec::as_slice)
        .ok_or_else(|| invalid("MERGE_MAP_INVALID"))
}

fn split_lanes(mut value: Value) -> Result<Vec<Value>, String> {
    let object = value
        .as_object_mut()
        .ok_or_else(|| invalid("OUTPUT_OBJECT_INVALID"))?;
    let txs = object.remove("entityTxs").unwrap_or_else(|| json!([]));
    let proposed = object.remove("proposedFrame");
    let precommits = object.remove("hashPrecommits").unwrap_or(Value::Null);
    let precommit_frame = object.remove("hashPrecommitFrame");
    let attestations = object.remove("jPrefixAttestations").unwrap_or(Value::Null);
    let vote = object.remove("leaderTimeoutVote");
    let mut lanes = Vec::new();
    let mut append = |field: &str, payload: Value| {
        let mut lane = value.clone();
        lane[field] = payload;
        lanes.push(lane);
    };
    if let Some(proposed) = proposed {
        append("proposedFrame", proposed);
    }
    if !map_rows(&precommits)?.is_empty() {
        let frame = precommit_frame.ok_or_else(|| invalid("PRECOMMIT_FRAME_REFERENCE_MISSING"))?;
        let mut lane = value.clone();
        lane["hashPrecommitFrame"] = frame;
        lane["hashPrecommits"] = precommits;
        lanes.push(lane);
    } else if precommit_frame.is_some() {
        return Err(invalid("PRECOMMIT_FRAME_REFERENCE_WITHOUT_SIGNATURES"));
    }
    if let Some(vote) = vote {
        let mut lane = value.clone();
        lane["leaderTimeoutVote"] = vote;
        lanes.push(lane);
    }
    for row in map_rows(&attestations)? {
        let mut lane = value.clone();
        lane["jPrefixAttestations"] = json!({"__xlnType":"Map","value":[row]});
        lanes.push(lane);
    }
    if !txs
        .as_array()
        .ok_or_else(|| invalid("ENTITY_TXS_INVALID"))?
        .is_empty()
        || lanes.is_empty()
    {
        value["entityTxs"] = txs;
        lanes.push(value);
    }
    Ok(lanes)
}

fn proposal_rank(value: &Value) -> usize {
    value["entityTxs"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|tx| {
            let proposal = &tx["data"]["proposal"];
            usize::from(
                proposal["frameHanko"]
                    .as_str()
                    .is_some_and(|hanko| !hanko.is_empty()),
            ) + usize::from(proposal["disputeHanko"].is_object())
        })
        .sum()
}

fn merge_precommits(existing: &Value, incoming: &Value) -> Result<Value, String> {
    let mut merged = BTreeMap::new();
    for value in [existing, incoming] {
        let mut normalized_keys = std::collections::BTreeSet::new();
        for row in map_rows(value)? {
            let signer = normalized(&row[0]);
            if !normalized_keys.insert(signer.clone()) {
                return Err(invalid("PRECOMMIT_DUPLICATE_SIGNER"));
            }
            if let Some(previous) = merged.insert(signer, row[1].clone())
                && bytes(&previous)? != bytes(&row[1])?
            {
                return Err(invalid("PRECOMMIT_EQUIVOCATION"));
            }
        }
    }
    Ok(json!({"__xlnType":"Map","value":merged.into_iter().collect::<Vec<_>>() }))
}

fn merge_ordinary(existing: &mut Value, incoming: Value) -> Result<(), String> {
    if (!existing["leaderTimeoutVote"].is_null() || !incoming["leaderTimeoutVote"].is_null())
        && bytes(&existing["leaderTimeoutVote"])? != bytes(&incoming["leaderTimeoutVote"])?
    {
        return Err(invalid("LEADER_VOTE_EQUIVOCATION"));
    }
    if let Some(txs) = incoming["entityTxs"]
        .as_array()
        .filter(|txs| !txs.is_empty())
    {
        let mut merged = existing["entityTxs"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        merged.extend(txs.iter().cloned());
        existing["entityTxs"] = Value::Array(merged);
    }
    if !map_rows(&incoming["hashPrecommits"])?.is_empty() {
        if incoming["hashPrecommitFrame"].is_null() {
            return Err(invalid("PRECOMMIT_FRAME_REFERENCE_MISSING"));
        }
        if !existing["hashPrecommitFrame"].is_null()
            && bytes(&existing["hashPrecommitFrame"])? != bytes(&incoming["hashPrecommitFrame"])?
        {
            return Err(invalid("PRECOMMIT_FRAME_CONFLICT"));
        }
        existing["hashPrecommitFrame"] = incoming["hashPrecommitFrame"].clone();
        existing["hashPrecommits"] =
            merge_precommits(&existing["hashPrecommits"], &incoming["hashPrecommits"])?;
    }
    let is_commit = |frame: &Value| {
        frame["hankos"]
            .as_array()
            .is_some_and(|hankos| hankos.len() == 1)
    };
    if !incoming["proposedFrame"].is_null()
        && (existing["proposedFrame"].is_null()
            || (is_commit(&incoming["proposedFrame"]) && !is_commit(&existing["proposedFrame"])))
    {
        existing["proposedFrame"] = incoming["proposedFrame"].clone();
    }
    Ok(())
}

/// TS buildPendingNetworkOutputs: split delivery lanes, fold into the first
/// accepted position, and select complete proposal evidence without mixing
/// signatures from different envelopes. The caller prunes settled proposals
/// and resolves current transport routes before this transport-only fold.
pub(crate) fn merge_replay_outbox(outputs: Vec<Value>) -> Result<Vec<Value>, String> {
    let mut indexes = BTreeMap::new();
    let mut merged: Vec<Value> = Vec::new();
    for output in outputs {
        for incoming in split_lanes(output)? {
            let identity = route_identity(&incoming)?;
            let is_proposal = has_account_proposals(&incoming);
            let key = (text(&incoming, "runtimeId")?.to_owned(), identity);
            if let Some(index) = indexes.get(&key).copied() {
                let existing = &mut merged[index];
                if is_proposal {
                    let rank = proposal_rank(&incoming).cmp(&proposal_rank(existing));
                    let frame = |value: &Value| -> Result<(u64, u64), String> {
                        Ok((
                            number(&value["sourceRuntimeFrame"], "height")?,
                            number(&value["sourceRuntimeFrame"], "timestamp")?,
                        ))
                    };
                    let replace = rank.is_gt()
                        || (rank.is_eq()
                            && (frame(&incoming)? > frame(existing)?
                                || bytes(&incoming)? < bytes(existing)?));
                    if replace {
                        *existing = incoming;
                    }
                } else {
                    merge_ordinary(existing, incoming)?;
                }
            } else {
                indexes.insert(key, merged.len());
                merged.push(incoming);
            }
        }
    }
    if merged.len() > 10_000 {
        return Err(invalid("CAPACITY_EXCEEDED"));
    }
    Ok(merged)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn output(height: u64, proposal: u64) -> Value {
        json!({"runtimeId":format!("0x{}", "11".repeat(20)),
            "entityId":format!("0x{}", "22".repeat(32)), "signerId":"signer",
            "from":format!("0x{}", "33".repeat(20)),
            "sourceRuntimeFrame":{"height":height,"timestamp":height * 100},
            "entityTxs":[{"type":"accountInput","data":{"kind":"ack_frame",
                "fromEntityId":format!("0x{}", "44".repeat(32)),
                "toEntityId":format!("0x{}", "22".repeat(32)),
                "ack":{"height":proposal-1,"frameHash":"ack-hash","frameHanko":"ack-proof"},
                "proposal":{"frame":{"height":proposal,"stateHash":"proposal-hash",
                    "accountTxs":[{"type":"request_collateral","data":{"amount":"7"}}]},
                    "frameHanko":"proposal-proof"}}}]})
    }

    fn encoded(values: &[Value]) -> Vec<Vec<u8>> {
        values
            .iter()
            .map(|value| encode_framed(value).unwrap())
            .collect()
    }

    fn previous(values: &[Value]) -> RecoveredWalFrame {
        RecoveredWalFrame {
            height: 71,
            frame_bytes: Vec::new(),
            outputs: encoded(values),
            entity_contexts: Default::default(),
        }
    }

    #[test]
    fn cross_j_r6_h72_retains_only_prior_evidence_with_transport_rebinding() {
        let first = output(70, 5);
        let last = output(71, 6);
        let prior = previous(&[first.clone(), last.clone()]);
        let mut rebound = last.clone();
        rebound["runtimeId"] = json!(format!("0x{}", "aa".repeat(20)));
        let current = output(72, 7);
        let selected =
            select_retained_replay_outbox(72, &prior, &encoded(&[current, rebound.clone()]))
                .unwrap()
                .into_values();
        assert_eq!(selected, vec![rebound]);
        assert!(
            select_retained_replay_outbox(72, &prior, &[])
                .unwrap()
                .into_values()
                .is_empty()
        );
        assert_eq!(
            select_retained_replay_outbox(72, &prior, &encoded(&[first, last]))
                .unwrap()
                .into_values()
                .len(),
            2
        );
    }

    #[test]
    fn cross_j_r6_h72_rejects_forged_or_reordered_retained_evidence() {
        let first = output(70, 5);
        let last = output(71, 6);
        let prior = previous(&[first.clone(), last.clone()]);
        for pointer in [
            "/sourceRuntimeFrame/height",
            "/sourceRuntimeFrame/timestamp",
            "/entityTxs/0/data/proposal/frameHanko",
            "/entityTxs/0/data/ack/frameHanko",
            "/entityTxs/0/data/proposal/frame/accountTxs/0/data/amount",
            "/signerId",
        ] {
            let mut forged = last.clone();
            *forged.pointer_mut(pointer).unwrap() = if pointer.ends_with("height") {
                json!(69)
            } else if pointer.ends_with("timestamp") {
                json!(1)
            } else {
                json!("forged")
            };
            assert!(
                select_retained_replay_outbox(72, &prior, &encoded(&[forged])).is_err(),
                "{pointer}"
            );
        }
        for rows in [
            vec![last.clone(), first.clone()],
            vec![first.clone(), first.clone()],
            vec![output(71, 99)],
        ] {
            assert!(select_retained_replay_outbox(72, &prior, &encoded(&rows)).is_err());
        }
        let mut ambiguous = last.clone();
        ambiguous["entityTxs"][0]["data"]["proposal"]["frameHanko"] = json!("other-proof");
        assert!(
            select_retained_replay_outbox(72, &previous(&[last, ambiguous]), &[])
                .unwrap_err()
                .contains("PRIOR_IDENTITY_AMBIGUOUS")
        );
        assert!(
            select_retained_replay_outbox(73, &prior, &[])
                .unwrap_err()
                .contains("PRIOR_HEIGHT_INVALID")
        );
    }

    #[test]
    fn cross_j_r6_h72_current_rows_never_prove_retention_and_require_valid_origin() {
        let prior = previous(&[]);
        let current = output(72, 6);
        assert!(!recorded_outbox_needs_prior(1, &[]).unwrap());
        assert!(
            !recorded_outbox_needs_prior(72, &encoded(std::slice::from_ref(&current))).unwrap()
        );
        assert!(recorded_outbox_needs_prior(72, &encoded(&[output(71, 6)])).unwrap());
        let origin_zero = output(0, 6);
        assert_eq!(
            select_retained_replay_outbox(
                72,
                &previous(std::slice::from_ref(&origin_zero)),
                &encoded(std::slice::from_ref(&origin_zero))
            )
            .unwrap()
            .into_values(),
            vec![origin_zero]
        );
        assert!(
            select_retained_replay_outbox(72, &prior, &encoded(std::slice::from_ref(&current)))
                .unwrap()
                .into_values()
                .is_empty()
        );
        for (pointer, value) in [
            ("/sourceRuntimeFrame/height", json!(73)),
            ("/runtimeId", json!("")),
            ("/runtimeId", json!(format!("0x{}", "AA".repeat(20)))),
        ] {
            let mut invalid = current.clone();
            *invalid.pointer_mut(pointer).unwrap() = value;
            assert!(
                recorded_outbox_needs_prior(72, &encoded(&[output(71, 6), invalid.clone()]))
                    .is_err()
            );
            assert!(select_retained_replay_outbox(72, &prior, &encoded(&[invalid])).is_err());
        }
        assert!(select_retained_replay_outbox(72, &prior, &encoded(&[output(71, 6)])).is_err());
    }

    #[test]
    fn cross_j_r6_h72_pending_merge_selects_whole_proof_in_the_first_slot() {
        let retained = output(71, 6);
        let middle = output(72, 7);
        let mut stronger = retained.clone();
        stronger["entityTxs"][0]["data"]["proposal"]["disputeHanko"] =
            json!({"hash":"proof","hanko":"signature"});
        stronger["sourceRuntimeFrame"] = json!({"height":70,"timestamp":7000});
        assert_eq!(
            merge_replay_outbox(vec![retained.clone(), middle.clone(), stronger.clone()]).unwrap(),
            vec![stronger.clone(), middle.clone()]
        );
        let mut newer = retained.clone();
        newer["sourceRuntimeFrame"] = json!({"height":72,"timestamp":7200});
        assert_eq!(
            merge_replay_outbox(vec![retained.clone(), middle, newer.clone()]).unwrap()[0],
            newer
        );
        let mut tie = retained.clone();
        tie["entityTxs"][0]["data"]["proposal"]["frameHanko"] = json!("alternate-proof");
        let expected = if bytes(&retained).unwrap() <= bytes(&tie).unwrap() {
            retained.clone()
        } else {
            tie.clone()
        };
        assert_eq!(
            merge_replay_outbox(vec![retained.clone(), tie]).unwrap(),
            vec![expected]
        );
        assert_eq!(
            merge_replay_outbox(vec![stronger.clone(), retained.clone()]).unwrap(),
            vec![stronger]
        );
        let mut other_route = retained.clone();
        other_route["runtimeId"] = json!(format!("0x{}", "bb".repeat(20)));
        assert_eq!(
            merge_replay_outbox(vec![retained, other_route])
                .unwrap()
                .len(),
            2
        );
    }

    #[test]
    fn cross_j_r6_h72_pending_merge_splits_lanes_and_rejects_precommit_equivocation() {
        let mut combined = output(72, 6);
        combined["proposedFrame"] = json!({"height":9,"hash":"entity-hash"});
        combined["hashPrecommitFrame"] = json!({"height":9,"frameHash":"entity-hash"});
        combined["hashPrecommits"] = json!({"__xlnType":"Map","value":[["Signer",["signature"]]]});
        let split = merge_replay_outbox(vec![combined]).unwrap();
        assert_eq!(split.len(), 3);
        assert!(split[0].get("proposedFrame").is_some());
        assert!(split[1].get("hashPrecommits").is_some());
        assert!(split[2].get("entityTxs").is_some());
        let merged = merge_replay_outbox(vec![split[1].clone(), split[1].clone()]).unwrap();
        assert_eq!(merged.len(), 1);
        assert_eq!(
            merged[0]["hashPrecommits"]["value"],
            json!([["signer", ["signature"]]])
        );
        let mut forged = split[1].clone();
        forged["hashPrecommits"]["value"][0][1] = json!(["forged"]);
        assert!(
            merge_replay_outbox(vec![split[1].clone(), forged])
                .unwrap_err()
                .contains("PRECOMMIT_EQUIVOCATION")
        );
        let mut commit = split[0].clone();
        commit["proposedFrame"]["hankos"] = json!(["quorum"]);
        assert_eq!(
            merge_replay_outbox(vec![split[0].clone(), commit.clone()]).unwrap(),
            vec![commit]
        );
        let mut ack = output(72, 6);
        ack["entityTxs"][0]["data"]["kind"] = json!("ack");
        ack["entityTxs"][0]["data"]
            .as_object_mut()
            .unwrap()
            .remove("proposal");
        let merged = merge_replay_outbox(vec![ack.clone(), ack.clone()]).unwrap();
        assert_eq!(
            merged[0]["entityTxs"],
            json!([ack["entityTxs"][0], ack["entityTxs"][0]])
        );
    }
}
