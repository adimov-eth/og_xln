//! Native mirror of the `proposeAccountsNow` recovery marker.
//!
//! Parity target: `core/entity/consensus/account/propose-accounts-now-validation.ts`
//! and `core/entity/tx/handlers/account/propose-accounts-now.ts`.
//!
//! Security note (mirrors the TypeScript comment): the only authority this
//! marker carries is "the active leader asked its own Entity to re-send bytes
//! it already signed". The signer must be the current leader, the list must be
//! canonical so two proposers cannot produce two different valid encodings of
//! the same intent, and the executing side reads the response bytes from
//! committed Account state — never from this payload. An adversarial peer that
//! forges the list can therefore only ask for retained proposals it was already
//! owed; it can neither mint nor alter one.

use std::cmp::Ordering;

use thiserror::Error;
use xln_rscore_protocol::CanonicalValue;

/// One recovery marker is bounded work, not a scan of the whole Account set.
/// The producer emits the canonical ascending prefix; anything longer is a
/// malformed payload and is rejected rather than silently truncated here.
pub const MAX_PROPOSE_ACCOUNTS_NOW_COUNTERPARTIES: usize = 1_000;

const MAX_COUNTERPARTY_ID_LENGTH: usize = 256;

/// Exact TypeScript error strings. `Display` is the code TS throws, so a
/// cross-engine test can compare them character for character.
#[derive(Clone, Debug, Error, PartialEq, Eq)]
pub enum ProposeAccountsNowError {
    #[error("PROPOSE_ACCOUNTS_NOW_PROPOSER_MISMATCH")]
    ProposerMismatch,
    #[error("PROPOSE_ACCOUNTS_NOW_INVALID_PAYLOAD:{0}")]
    InvalidPayload(String),
    /// Shapes the TypeScript boundary decoder (`validateEntityTx`) rejects
    /// before consensus ever sees them. Kept as its own code so it can never
    /// be mistaken for the exact TS semantic rejection above.
    #[error("PROPOSE_ACCOUNTS_NOW_PAYLOAD_SHAPE:{0}")]
    PayloadShape(String),
    #[error("PROPOSE_ACCOUNTS_NOW_COUNTERPARTY_INVALID:{0}")]
    CounterpartyInvalid(String),
    #[error("PROPOSE_ACCOUNTS_NOW_ORDER_INVALID:{previous}:{next}")]
    OrderInvalid { previous: String, next: String },
}

/// The decoded marker payload: `{ version, proposerSignerId, counterparties }`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProposeAccountsNow {
    pub version: u8,
    pub proposer_signer_id: String,
    pub counterparties: Vec<String>,
}

/// TS `compareStableText` is `<`/`>` on JavaScript strings, i.e. UTF-16 code
/// unit order. Byte order would disagree above the BMP.
fn compare_stable_text(left: &str, right: &str) -> Ordering {
    left.encode_utf16().cmp(right.encode_utf16())
}

/// JavaScript `String(value)` for the shapes a boundary-validated payload can
/// still carry. Non-scalars only appear when a caller bypassed the boundary
/// decoder, so the object rendering matches JS rather than Rust's `Debug`.
fn js_string(value: &CanonicalValue) -> String {
    match value {
        CanonicalValue::String(value) => value.clone(),
        CanonicalValue::Number(value) => value.as_str().to_string(),
        CanonicalValue::Bool(value) => value.to_string(),
        CanonicalValue::Null => "null".to_string(),
        _ => "[object Object]".to_string(),
    }
}

fn field<'a>(fields: &'a [(String, CanonicalValue)], name: &str) -> Option<&'a CanonicalValue> {
    fields
        .iter()
        .find_map(|(key, value)| (key == name).then_some(value))
}

/// Decode and validate everything the payload can judge on its own: version,
/// list bounds, per-entry canonical form and strict ascending order. The
/// proposer/leader check needs committed state and lives in
/// [`assert_propose_accounts_now_matches_state`].
pub fn decode_propose_accounts_now(
    value: &CanonicalValue,
) -> Result<ProposeAccountsNow, ProposeAccountsNowError> {
    let CanonicalValue::Object(fields) = value else {
        return Err(ProposeAccountsNowError::PayloadShape("not-object".into()));
    };
    if fields.len() != 3 {
        return Err(ProposeAccountsNowError::PayloadShape(format!(
            "fields:{}",
            fields.len()
        )));
    }
    let Some(CanonicalValue::String(proposer_signer_id)) = field(fields, "proposerSignerId") else {
        return Err(ProposeAccountsNowError::PayloadShape("proposer".into()));
    };
    // TS reports the counterparty count for every version/bounds rejection and
    // only says `not-array` when the field is not an array at all.
    let counterparties = match field(fields, "counterparties") {
        Some(CanonicalValue::Array(counterparties)) => counterparties,
        _ => {
            return Err(ProposeAccountsNowError::InvalidPayload("not-array".into()));
        }
    };
    let version_is_one = matches!(
        field(fields, "version"),
        Some(CanonicalValue::Number(value)) if value.as_str() == "1"
    );
    if !version_is_one
        || counterparties.is_empty()
        || counterparties.len() > MAX_PROPOSE_ACCOUNTS_NOW_COUNTERPARTIES
    {
        return Err(ProposeAccountsNowError::InvalidPayload(
            counterparties.len().to_string(),
        ));
    }
    let mut previous = String::new();
    let mut decoded = Vec::with_capacity(counterparties.len());
    for counterparty in counterparties {
        let CanonicalValue::String(counterparty) = counterparty else {
            return Err(ProposeAccountsNowError::CounterpartyInvalid(js_string(
                counterparty,
            )));
        };
        if counterparty.is_empty()
            || counterparty.encode_utf16().count() > MAX_COUNTERPARTY_ID_LENGTH
            || *counterparty != counterparty.to_lowercase()
        {
            return Err(ProposeAccountsNowError::CounterpartyInvalid(
                counterparty.clone(),
            ));
        }
        if !previous.is_empty() && compare_stable_text(&previous, counterparty) != Ordering::Less {
            return Err(ProposeAccountsNowError::OrderInvalid {
                previous,
                next: counterparty.clone(),
            });
        }
        previous = counterparty.clone();
        decoded.push(counterparty.clone());
    }
    Ok(ProposeAccountsNow {
        version: 1,
        proposer_signer_id: proposer_signer_id.clone(),
        counterparties: decoded,
    })
}

/// The marker is authored by the committed active leader and nobody else. A
/// validator replaying a proposed frame judges it from committed authority
/// alone, so this never reads the proposer's transport.
pub fn assert_propose_accounts_now_matches_state(
    active_validator_id: Option<&str>,
    tx: &ProposeAccountsNow,
) -> Result<(), ProposeAccountsNowError> {
    let leader = active_validator_id
        .map(str::trim)
        .filter(|leader| !leader.is_empty())
        .ok_or(ProposeAccountsNowError::ProposerMismatch)?;
    if leader.to_lowercase() != tx.proposer_signer_id.to_lowercase() {
        return Err(ProposeAccountsNowError::ProposerMismatch);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn number(value: u32) -> CanonicalValue {
        CanonicalValue::Number(xln_rscore_protocol::CanonicalNumber::from_u32(value))
    }

    fn text(value: &str) -> CanonicalValue {
        CanonicalValue::String(value.into())
    }

    fn payload(version: CanonicalValue, counterparties: Vec<CanonicalValue>) -> CanonicalValue {
        CanonicalValue::Object(vec![
            (
                "counterparties".to_string(),
                CanonicalValue::Array(counterparties),
            ),
            (
                "proposerSignerId".to_string(),
                text(&format!("0x{}", "44".repeat(20))),
            ),
            ("version".to_string(), version),
        ])
    }

    fn account(byte: &str) -> CanonicalValue {
        text(&format!("0x{}", byte.repeat(32)))
    }

    #[test]
    fn canonical_marker_decodes() {
        let decoded =
            decode_propose_accounts_now(&payload(number(1), vec![account("aa"), account("bb")]))
                .expect("canonical marker");
        assert_eq!(decoded.version, 1);
        assert_eq!(decoded.counterparties.len(), 2);
        assert_eq!(decoded.proposer_signer_id, format!("0x{}", "44".repeat(20)));
    }

    #[test]
    fn rejection_codes_match_typescript() {
        assert_eq!(
            decode_propose_accounts_now(&payload(number(2), vec![account("aa")]))
                .expect_err("version")
                .to_string(),
            "PROPOSE_ACCOUNTS_NOW_INVALID_PAYLOAD:1",
        );
        assert_eq!(
            decode_propose_accounts_now(&payload(number(1), Vec::new()))
                .expect_err("empty")
                .to_string(),
            "PROPOSE_ACCOUNTS_NOW_INVALID_PAYLOAD:0",
        );
        let over_cap = (0..=MAX_PROPOSE_ACCOUNTS_NOW_COUNTERPARTIES)
            .map(|index| text(&format!("0x{index:064x}")))
            .collect::<Vec<_>>();
        assert_eq!(
            decode_propose_accounts_now(&payload(number(1), over_cap))
                .expect_err("cap")
                .to_string(),
            "PROPOSE_ACCOUNTS_NOW_INVALID_PAYLOAD:1001",
        );
        assert_eq!(
            decode_propose_accounts_now(&payload(number(1), vec![text("")]))
                .expect_err("empty id")
                .to_string(),
            "PROPOSE_ACCOUNTS_NOW_COUNTERPARTY_INVALID:",
        );
        assert_eq!(
            decode_propose_accounts_now(&payload(number(1), vec![text("0xAA")]))
                .expect_err("uppercase")
                .to_string(),
            "PROPOSE_ACCOUNTS_NOW_COUNTERPARTY_INVALID:0xAA",
        );
        assert_eq!(
            decode_propose_accounts_now(&payload(
                number(1),
                vec![text(&format!("0x{}", "a".repeat(256)))]
            ))
            .expect_err("too long")
            .to_string()
            .len(),
            "PROPOSE_ACCOUNTS_NOW_COUNTERPARTY_INVALID:".len() + 258,
        );
        assert_eq!(
            decode_propose_accounts_now(&payload(number(1), vec![number(5)]))
                .expect_err("not a string")
                .to_string(),
            "PROPOSE_ACCOUNTS_NOW_COUNTERPARTY_INVALID:5",
        );
        assert_eq!(
            decode_propose_accounts_now(&payload(number(1), vec![account("bb"), account("aa")]))
                .expect_err("descending")
                .to_string(),
            format!(
                "PROPOSE_ACCOUNTS_NOW_ORDER_INVALID:0x{}:0x{}",
                "bb".repeat(32),
                "aa".repeat(32)
            ),
        );
        assert_eq!(
            decode_propose_accounts_now(&payload(number(1), vec![account("aa"), account("aa")]))
                .expect_err("duplicate")
                .to_string(),
            format!(
                "PROPOSE_ACCOUNTS_NOW_ORDER_INVALID:0x{}:0x{}",
                "aa".repeat(32),
                "aa".repeat(32)
            ),
        );
    }

    #[test]
    fn only_the_committed_leader_may_author_the_marker() {
        let tx = decode_propose_accounts_now(&payload(number(1), vec![account("aa")]))
            .expect("canonical marker");
        let leader = format!("0x{}", "44".repeat(20));
        assert!(assert_propose_accounts_now_matches_state(Some(&leader), &tx).is_ok());
        assert!(
            assert_propose_accounts_now_matches_state(Some(&leader.to_uppercase()), &tx).is_ok(),
            "signer identity is case-insensitive, exactly as TypeScript compares it",
        );
        for imposter in [None, Some(""), Some("0xdeadbeef")] {
            assert_eq!(
                assert_propose_accounts_now_matches_state(imposter, &tx)
                    .expect_err("imposter")
                    .to_string(),
                "PROPOSE_ACCOUNTS_NOW_PROPOSER_MISMATCH",
            );
        }
    }
}
