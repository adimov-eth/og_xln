use std::time::Duration;

use serde_json::Value;

use super::RuntimeTransportError;
use super::crypto::{
    EncryptionIdentity, SessionKeys, derive_session_keys, ephemeral_identity, ephemeral_public_hex,
    hello_digest, parse_public_hex, sign, static_public_hex,
};
use super::entity_inputs_frame::{
    ReadinessFrameContext, SessionCounters, SessionFrameContext, decode_delivery_ready,
    send_delivery_ready,
};
#[cfg(test)]
use super::routing::OutboundEnvelope;
use super::wire::{
    Socket, object, read_value, required_text, send_value, set_timeouts, unix_ms,
    verify_acknowledgement,
};

#[cfg(test)]
use super::entity_inputs_frame::send_entity_inputs;
#[cfg(test)]
use super::wire::{set_nonblocking, try_read_value};

#[cfg(test)]
use super::crypto::{decrypt_session, verify_frame_mac};
#[cfg(test)]
use super::inbound::envelope::{exact_fields, safe_u64, text, typed_array};
#[cfg(test)]
use super::msgpack::decode_transport;
#[cfg(test)]
use super::routing::{normalize_entity_id, normalize_runtime_id};

pub(crate) struct DirectSession {
    pub(super) target_runtime_id: String,
    pub(super) source_runtime_id: String,
    pub(super) audience: String,
    pub(super) challenge: String,
    pub(super) encryption_public_hex: String,
    pub(super) peer_encryption_public_hex: String,
    pub(super) peer_session_public: [u8; 32],
    pub(super) keys: SessionKeys,
    pub(super) socket: Socket,
    pub(super) outbound: SessionCounters,
    pub(super) inbound: SessionCounters,
    pub(super) peer_ready: bool,
    pub(super) local_ready: bool,
    pub(super) max_message_bytes: usize,
}

pub(crate) struct SessionConfig<'a> {
    pub url: &'a str,
    pub target_runtime_id: &'a str,
    pub source_runtime_id: &'a str,
    pub source_seed: &'a str,
    pub source_signer_id: &'a str,
    pub identity: &'a EncryptionIdentity,
    pub io_timeout: Duration,
    pub max_message_bytes: usize,
}

impl DirectSession {
    pub(crate) fn connect(config: SessionConfig<'_>) -> Result<Self, RuntimeTransportError> {
        let (mut socket, _) = tungstenite::connect(config.url)
            .map_err(|error| RuntimeTransportError::WebSocket(error.to_string()))?;
        set_timeouts(&mut socket, config.io_timeout)?;
        let challenge_message = read_value(&mut socket)?;
        let challenge = required_text(&challenge_message, "challenge")?;
        if required_text(&challenge_message, "type")? != "hello_challenge" {
            return Err(RuntimeTransportError::Handshake("challenge-type".into()));
        }
        let audience = required_text(&challenge_message, "audience")?;
        let expected_audience = format!("xln-runtime:{}", config.target_runtime_id);
        if audience != expected_audience {
            return Err(RuntimeTransportError::Handshake(format!(
                "audience:expected={expected_audience}:actual={audience}",
            )));
        }

        let ephemeral = ephemeral_identity()?;
        let static_public = static_public_hex(config.identity);
        let ephemeral_public = ephemeral_public_hex(&ephemeral);
        let timestamp = unix_ms()?;
        let signature = sign(
            config.source_seed,
            config.source_signer_id,
            &hello_digest(
                config.source_runtime_id,
                &static_public,
                timestamp,
                &challenge,
                &audience,
                &ephemeral_public,
            ),
        )?;
        let hello = object([
            ("type", Value::String("hello".into())),
            ("from", Value::String(config.source_runtime_id.into())),
            ("fromEncryptionPubKey", Value::String(static_public.clone())),
            ("timestamp", Value::from(timestamp)),
            ("audience", Value::String(audience.clone())),
            ("sessionPubKey", Value::String(ephemeral_public)),
            (
                "auth",
                object([
                    ("nonce", Value::String(challenge.clone())),
                    ("signature", Value::String(signature)),
                    ("timestamp", Value::from(timestamp)),
                ]),
            ),
        ]);
        send_value(&mut socket, &hello, config.max_message_bytes)?;

        let acknowledgement = read_value(&mut socket)?;
        let hello_ack_auth_timestamp = verify_acknowledgement(
            &acknowledgement,
            config.target_runtime_id,
            config.source_runtime_id,
            &audience,
            &challenge,
        )?;
        let server_session_public =
            parse_public_hex(&required_text(&acknowledgement, "sessionPubKey")?)?;
        let peer_encryption_public_hex =
            required_text(&acknowledgement, "fromEncryptionPubKey")?.to_ascii_lowercase();
        parse_public_hex(&peer_encryption_public_hex)?;
        let keys = derive_session_keys(&ephemeral, &server_session_public, &challenge, &audience)?;
        let mut session = Self {
            target_runtime_id: config.target_runtime_id.into(),
            source_runtime_id: config.source_runtime_id.into(),
            audience,
            challenge,
            encryption_public_hex: static_public,
            peer_encryption_public_hex,
            peer_session_public: server_session_public,
            keys,
            socket,
            outbound: SessionCounters::default(),
            inbound: SessionCounters {
                message_counter: 0,
                auth_timestamp: hello_ack_auth_timestamp,
                encryption_sequence: 0,
            },
            peer_ready: false,
            local_ready: false,
            max_message_bytes: config.max_message_bytes,
        };
        // Both sides announce immediately after hello, independently of peer
        // readiness. Waiting for the peer to be true would deadlock startup.
        session.publish_readiness()?;
        let initial_ready = read_value(&mut session.socket)?;
        session.accept_readiness(initial_ready)?;
        Ok(session)
    }

    #[cfg(test)]
    pub(crate) fn send_envelope(
        &mut self,
        envelope: &OutboundEnvelope,
    ) -> Result<bool, RuntimeTransportError> {
        self.poll_readiness()?;
        if !self.peer_ready {
            return Ok(false);
        }
        send_entity_inputs(
            &mut self.socket,
            envelope,
            &mut SessionFrameContext {
                key: &self.keys.c2s,
                from: &self.source_runtime_id,
                to: &self.target_runtime_id,
                encryption_public_hex: &self.encryption_public_hex,
                audience: &self.audience,
                challenge: &self.challenge,
                counters: &mut self.outbound,
            },
            self.max_message_bytes,
        )?;
        Ok(true)
    }

    #[cfg(test)]
    pub(crate) fn set_delivery_ready(&mut self, ready: bool) -> Result<(), RuntimeTransportError> {
        if self.local_ready != ready {
            self.local_ready = ready;
            self.publish_readiness()?;
        }
        Ok(())
    }

    fn publish_readiness(&mut self) -> Result<(), RuntimeTransportError> {
        send_delivery_ready(
            &mut self.socket,
            self.local_ready,
            &mut SessionFrameContext {
                key: &self.keys.c2s,
                from: &self.source_runtime_id,
                to: &self.target_runtime_id,
                encryption_public_hex: &self.encryption_public_hex,
                audience: &self.audience,
                challenge: &self.challenge,
                counters: &mut self.outbound,
            },
            self.max_message_bytes,
        )
    }

    fn accept_readiness(&mut self, value: Value) -> Result<(), RuntimeTransportError> {
        self.peer_ready = decode_delivery_ready(
            value,
            &mut ReadinessFrameContext {
                key: &self.keys.s2c,
                from: &self.target_runtime_id,
                to: &self.source_runtime_id,
                encryption_public_hex: &self.peer_encryption_public_hex,
                audience: &self.audience,
                challenge: &self.challenge,
                auth_timestamp: &mut self.inbound.auth_timestamp,
            },
        )?;
        Ok(())
    }

    #[cfg(test)]
    fn poll_readiness(&mut self) -> Result<(), RuntimeTransportError> {
        set_nonblocking(&mut self.socket, true)?;
        let result = self.read_available_readiness();
        set_nonblocking(&mut self.socket, false)?;
        result
    }

    #[cfg(test)]
    fn read_available_readiness(&mut self) -> Result<(), RuntimeTransportError> {
        while let Some(value) = try_read_value(&mut self.socket)? {
            self.accept_readiness(value)?;
        }
        Ok(())
    }

    /// Read one canonical `entity_inputs` message on this same session.
    /// Tests use this to prove the peer reply never opens a second TCP dial.
    #[cfg(test)]
    pub(crate) fn recv_envelope(&mut self) -> Result<Value, RuntimeTransportError> {
        let value = loop {
            let value = read_value(&mut self.socket)?;
            if value.get("type").and_then(Value::as_str) != Some("delivery_ready") {
                break value;
            }
            self.accept_readiness(value)?;
        };
        decode_entity_inputs(
            value,
            &mut SessionFrameContext {
                key: &self.keys.s2c,
                from: &self.target_runtime_id,
                to: &self.source_runtime_id,
                encryption_public_hex: &self.peer_encryption_public_hex,
                audience: &self.audience,
                challenge: &self.challenge,
                counters: &mut self.inbound,
            },
        )
    }

    #[cfg(test)]
    pub(crate) fn close(mut self) {
        let _ = self.socket.close(None);
    }
}

#[cfg(test)]
const ENTITY_INPUT_FIELDS: &[&str] = &[
    "v",
    "type",
    "id",
    "from",
    "fromEncryptionPubKey",
    "to",
    "encSeq",
    "timestamp",
    "payload",
    "encrypted",
    "txs",
    "auth",
];

#[cfg(test)]
fn decode_entity_inputs(
    value: Value,
    frame: &mut SessionFrameContext<'_>,
) -> Result<Value, RuntimeTransportError> {
    let object = value
        .as_object()
        .ok_or_else(|| RuntimeTransportError::Inbound("frame-object".into()))?;
    verify_entity_inputs_header(object, frame)?;
    let (encryption_sequence, auth_timestamp, mac) = verify_entity_inputs_auth(object, frame)?;
    let mut unsigned = object.clone();
    unsigned.remove("v");
    unsigned.remove("auth");
    verify_frame_mac(
        frame.key,
        &Value::Object(unsigned),
        frame.audience,
        frame.challenge,
        auth_timestamp,
        &mac,
    )?;
    decrypt_entity_inputs_payload(object, frame, encryption_sequence, auth_timestamp)
}

#[cfg(test)]
fn decrypt_entity_inputs_payload(
    object: &serde_json::Map<String, Value>,
    frame: &mut SessionFrameContext<'_>,
    encryption_sequence: u64,
    auth_timestamp: u64,
) -> Result<Value, RuntimeTransportError> {
    let ciphertext = typed_array(
        object
            .get("payload")
            .ok_or_else(|| RuntimeTransportError::Inbound("frame-payload".into()))?,
    )?;
    let plaintext = decrypt_session(&ciphertext, frame.key, encryption_sequence)?;
    frame.counters.auth_timestamp = auth_timestamp;
    frame.counters.encryption_sequence = encryption_sequence;
    decode_transport(&plaintext)
}

#[cfg(test)]
fn verify_entity_inputs_header(
    object: &serde_json::Map<String, Value>,
    frame: &SessionFrameContext<'_>,
) -> Result<(), RuntimeTransportError> {
    exact_fields(object, ENTITY_INPUT_FIELDS, &["entityId"], "frame")?;
    if object.get("v").and_then(Value::as_u64) != Some(1)
        || object.get("type").and_then(Value::as_str) != Some("entity_inputs")
        || object.get("encrypted").and_then(Value::as_bool) != Some(true)
    {
        return Err(RuntimeTransportError::Inbound("frame-header".into()));
    }
    let from = normalize_runtime_id(text(object, "from")?)?;
    let to = normalize_runtime_id(text(object, "to")?)?;
    if from != frame.from || to != frame.to {
        return Err(RuntimeTransportError::Inbound("frame-route".into()));
    }
    if text(object, "fromEncryptionPubKey")?.to_ascii_lowercase() != frame.encryption_public_hex {
        return Err(RuntimeTransportError::Inbound("frame-static-key".into()));
    }
    if let Some(entity_id) = object.get("entityId") {
        normalize_entity_id(
            entity_id
                .as_str()
                .ok_or_else(|| RuntimeTransportError::Inbound("frame-entity-id".into()))?,
        )?;
    }
    Ok(())
}

#[cfg(test)]
fn verify_entity_inputs_auth(
    object: &serde_json::Map<String, Value>,
    frame: &SessionFrameContext<'_>,
) -> Result<(u64, u64, String), RuntimeTransportError> {
    let encryption_sequence = safe_u64(object, "encSeq")?;
    let expected = frame
        .counters
        .encryption_sequence
        .checked_add(1)
        .ok_or_else(|| RuntimeTransportError::Inbound("enc-seq-overflow".into()))?;
    if encryption_sequence != expected {
        return Err(RuntimeTransportError::Inbound("enc-seq-order".into()));
    }
    let auth = object
        .get("auth")
        .and_then(Value::as_object)
        .ok_or_else(|| RuntimeTransportError::Inbound("frame-auth".into()))?;
    exact_fields(auth, &["nonce", "timestamp", "mac"], &[], "frame-auth")?;
    let auth_timestamp = safe_u64(auth, "timestamp")?;
    if auth.get("nonce").and_then(Value::as_str) != Some(frame.challenge)
        || auth_timestamp <= frame.counters.auth_timestamp
    {
        return Err(RuntimeTransportError::Inbound("frame-auth-order".into()));
    }
    Ok((
        encryption_sequence,
        auth_timestamp,
        text(auth, "mac")?.into(),
    ))
}
