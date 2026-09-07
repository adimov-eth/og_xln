//! Startup reads the canonical live replica envelope; it owns no J state.

use serde_json::{Map, Value};

const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

pub(super) fn replica_progress(metadata: &Value, finalized: u64) -> Result<(u64, bool), String> {
    let metadata = object(metadata, "replica")?;
    let certified = certified_through(metadata)?;
    let Some(history) = metadata.get("jHistory") else {
        return Ok((finalized, certified > finalized));
    };
    let history = object(history, "jHistory")?;
    let scanned = height(
        history.get("scannedThroughHeight"),
        "jHistory.scannedThroughHeight",
    )?;
    let semantic_due = pending_event(history, finalized, scanned)?;
    // A quorum-certified prefix is already authorized work, including its
    // empty suffix. Bare authenticated headers alone do not force an offline
    // Entity to sign a new frame before the Runtime can finish startup.
    Ok((scanned, certified > finalized || semantic_due))
}

fn object<'a>(value: &'a Value, field: &str) -> Result<&'a Map<String, Value>, String> {
    value
        .as_object()
        .ok_or_else(|| format!("J_STARTUP_METADATA_OBJECT:{field}"))
}

fn height(value: Option<&Value>, field: &str) -> Result<u64, String> {
    value
        .and_then(Value::as_u64)
        .filter(|value| *value <= MAX_SAFE_INTEGER)
        .ok_or_else(|| format!("J_STARTUP_METADATA_HEIGHT:{field}"))
}

fn certified_through(metadata: &Map<String, Value>) -> Result<u64, String> {
    let Some(round) = metadata.get("jPrefixRound") else {
        return Ok(0);
    };
    let round = object(round, "jPrefixRound")?;
    let Some(certificate) = round.get("certificate") else {
        return Ok(0);
    };
    let certificate = object(certificate, "jPrefixRound.certificate")?;
    let selected = certificate
        .get("selected")
        .ok_or_else(|| "J_STARTUP_METADATA_OBJECT:jPrefixRound.certificate.selected".to_string())?;
    height(
        object(selected, "jPrefixRound.certificate.selected")?.get("scannedThroughHeight"),
        "jPrefixRound.certificate.selected.scannedThroughHeight",
    )
}

fn pending_event(
    history: &Map<String, Value>,
    finalized: u64,
    scanned: u64,
) -> Result<bool, String> {
    let map = history
        .get("eventBlocks")
        .ok_or_else(|| "J_STARTUP_METADATA_MAP:jHistory.eventBlocks".to_string())?;
    let rows = map
        .get("value")
        .and_then(Value::as_array)
        .filter(|_| map.get("__xlnType").and_then(Value::as_str) == Some("Map"))
        .ok_or_else(|| "J_STARTUP_METADATA_MAP:jHistory.eventBlocks".to_string())?;
    rows.iter().try_fold(false, |pending, row| {
        let pair = row
            .as_array()
            .filter(|pair| pair.len() == 2)
            .ok_or_else(|| "J_STARTUP_METADATA_ROW:jHistory.eventBlocks".to_string())?;
        // Replica validation already proves map-key equality and uniqueness.
        // TS readiness reads the event block's jHeight, not the map key.
        let event_height = height(
            object(&pair[1], "jHistory.eventBlocks.value")?.get("jHeight"),
            "jHistory.eventBlocks.jHeight",
        )?;
        Ok(pending || (event_height > finalized && event_height <= scanned))
    })
}

#[cfg(test)]
mod tests {
    use serde_json::{Value, json};

    use super::replica_progress;

    fn history(scanned: u64, events: &[u64]) -> Value {
        json!({"jHistory": {
            "scannedThroughHeight": scanned,
            "eventBlocks": {"__xlnType": "Map", "value": events.iter()
                .map(|height| json!([height, {"jHeight": height}])).collect::<Vec<_>>()},
        }})
    }

    #[test]
    fn startup_j_metadata_absent_history_uses_entity_finality() {
        assert_eq!(replica_progress(&json!({}), 7), Ok((7, false)));
        assert_eq!(
            replica_progress(&json!({"jPrefixRound": {}}), 7),
            Ok((7, false))
        );
    }

    #[test]
    fn startup_j_metadata_certified_prefix_requires_finality_even_without_events() {
        let mut metadata = history(12, &[]);
        metadata["jPrefixRound"] = json!({"certificate": {
            "selected": {"scannedThroughHeight": 12},
        }});
        assert_eq!(replica_progress(&metadata, 10), Ok((12, true)));
        assert_eq!(replica_progress(&metadata, 12), Ok((12, false)));
        metadata
            .as_object_mut()
            .expect("metadata")
            .remove("jHistory");
        assert_eq!(replica_progress(&metadata, 10), Ok((10, true)));
    }

    #[test]
    fn startup_j_metadata_semantic_event_requires_finality_only_inside_scanned_suffix() {
        assert_eq!(
            replica_progress(&history(12, &[10, 11, 13]), 10),
            Ok((12, true))
        );
        assert_eq!(
            replica_progress(&history(12, &[10, 13]), 10),
            Ok((12, false))
        );
    }

    #[test]
    fn startup_j_metadata_empty_authenticated_suffix_does_not_require_entity_frame() {
        assert_eq!(replica_progress(&history(12, &[]), 10), Ok((12, false)));
        assert_eq!(replica_progress(&history(10, &[10]), 10), Ok((10, false)));
    }

    #[test]
    fn startup_j_metadata_present_malformed_heights_fail_instead_of_becoming_zero() {
        for invalid in [
            Value::Null,
            json!("12"),
            json!(-1),
            json!(1.5),
            json!(9_007_199_254_740_992_u64),
        ] {
            let mut metadata = history(12, &[11]);
            metadata["jHistory"]["scannedThroughHeight"] = invalid.clone();
            assert!(replica_progress(&metadata, 10).is_err());
            let mut metadata = history(12, &[11]);
            metadata["jHistory"]["eventBlocks"]["value"][0][1]["jHeight"] = invalid.clone();
            assert!(replica_progress(&metadata, 10).is_err());
            let mut metadata = history(12, &[]);
            metadata["jPrefixRound"] = json!({"certificate": {
                "selected": {"scannedThroughHeight": invalid},
            }});
            assert!(replica_progress(&metadata, 10).is_err());
        }
        for metadata in [
            json!({"jHistory": null}),
            json!({"jPrefixRound": null}),
            json!({"jPrefixRound": {"certificate": null}}),
            json!({"jPrefixRound": {"certificate": {"selected": {}}}}),
        ] {
            assert!(replica_progress(&metadata, 10).is_err());
        }
    }
}
