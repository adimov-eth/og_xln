//! Canonical built-in token metadata shared by financial admission and projection.

pub fn canonical_token_metadata(token_id: u32) -> Option<(u32, &'static str)> {
    match token_id {
        1 => Some((6, "USDC")),
        2 => Some((18, "WETH")),
        3 => Some((6, "USDT")),
        4 => Some((6, "TRX")),
        5 => Some((18, "SUN")),
        _ => None,
    }
}

pub fn canonical_token_decimals(token_id: u32) -> Option<u32> {
    canonical_token_metadata(token_id).map(|(decimals, _)| decimals)
}
