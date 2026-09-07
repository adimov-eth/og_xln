use std::collections::BTreeMap;

use serde_json::{Value, json};

use super::abi::{address_word, safe_uint};
use super::receipt::fixed_hex;
use super::{JWatcherError, JsonRpc};

/// Match rpc-watcher-inputs.ts: the Depository registry defines the complete
/// ERC20 log filter for this range. Never substitute a checkpoint catalog or
/// an empty filter after a failed read: that would permanently skip receipts.
pub(crate) fn read_erc20_token_registry(
    rpc: &impl JsonRpc,
    depository: &[u8; 20],
) -> Result<BTreeMap<[u8; 20], u64>, JWatcherError> {
    let length_call = ethabi::short_signature("getTokensLength", &[]);
    let row_call = ethabi::short_signature("_tokens", &[ethabi::ParamType::Uint(256)]);
    let target = format!("0x{}", hex::encode(depository));
    let length = decode_token_count(&rpc.call(
        "eth_call",
        json!([{"to": target, "data": format!("0x{}", hex::encode(length_call))}, "latest"]),
    )?)?;
    let mut registry = BTreeMap::new();
    // Token zero is the native-currency sentinel. ERC721/ERC1155 rows and the
    // zero address cannot emit the ERC20 transfers this filter selects.
    for token_id in 1..length {
        let row = rpc.call(
            "eth_call",
            json!([{"to": target, "data": format!("0x{}{:064x}", hex::encode(row_call), token_id)}, "latest"]),
        )?;
        if let Some(address) = decode_erc20_token(&row)? {
            registry.insert(address, token_id);
        }
    }
    Ok(registry)
}

pub(super) fn decode_token_count(value: &Value) -> Result<u64, JWatcherError> {
    let encoded = value
        .as_str()
        .ok_or(JWatcherError::Hex("tokenRegistryLength"))?;
    safe_uint(
        &fixed_hex::<32>(encoded, "tokenRegistryLength")?,
        "tokenRegistryLength",
    )
}

pub(super) fn decode_erc20_token(value: &Value) -> Result<Option<[u8; 20]>, JWatcherError> {
    let encoded = value
        .as_str()
        .ok_or(JWatcherError::Hex("tokenRegistryRow"))?;
    let row = fixed_hex::<96>(encoded, "tokenRegistryRow")?;
    let address_word_bytes: [u8; 32] = row[..32]
        .try_into()
        .map_err(|_| JWatcherError::EventAbi("tokenRegistryAddress"))?;
    let address = address_word(&address_word_bytes, "tokenRegistryAddress")?;
    if row[64..95] != [0; 31] {
        return Err(JWatcherError::EventAbi("tokenRegistryType"));
    }
    Ok((row[95] == 0 && address != [0; 20]).then_some(address))
}
