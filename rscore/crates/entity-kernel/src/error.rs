use thiserror::Error;

#[derive(Clone, Debug, Error, PartialEq, Eq)]
pub enum EntityKernelError {
    #[error("ENTITY_BOARD_HANDOVER_INVALID:{detail}")]
    BoardHandoverInvalid { detail: String },
    #[error("ENTITY_KERNEL_CROSS_J_UNSUPPORTED:{account_id}")]
    CrossJurisdictionUnsupported { account_id: String },
    #[error("ENTITY_J_EVENT_INGRESS_TX_UNSUPPORTED:{kind}")]
    UnsupportedJEventIngress { kind: &'static str },
    #[error("ENTITY_J_EVENT_INVALID:{detail}")]
    JEventInvalid { detail: String },
    #[error("ENTITY_LOCAL_TX_INVALID:{kind}:{detail}")]
    InvalidLocalEntityTx { kind: &'static str, detail: String },
    /// A user/peer-authored tx that is invalid against committed state. Never a
    /// runtime fault: logged and dropped in production, fail-fast elsewhere
    /// (`reject_fail_fast`). Handlers return it before any mutation.
    #[error("ENTITY_TX_REJECTED:{kind}:{detail}")]
    RejectedEntityTx { kind: &'static str, detail: String },
    #[error("ENTITY_KERNEL_OUTPUT_MISMATCH:{detail}")]
    AccountOutputMismatch { detail: String },
    #[error("ENTITY_KERNEL_ACCOUNT_MISSING:{account_id}")]
    AccountMissing { account_id: String },
    #[error("ENTITY_KERNEL_PREPARED_HTLC_MISSING:{account_id}:{lock_id}")]
    PreparedHtlcMissing { account_id: String, lock_id: String },
    #[error("ENTITY_KERNEL_PREPARED_HTLC_MISMATCH:{detail}")]
    PreparedHtlcMismatch { detail: String },
    #[error("ENTITY_KERNEL_HTLC_INVARIANT:{detail}")]
    HtlcInvariant { detail: String },
    #[error("ENTITY_KERNEL_ORDERBOOK_INVARIANT:{detail}")]
    OrderbookInvariant { detail: String },
    #[error("ENTITY_KERNEL_LENDING_INVARIANT:{detail}")]
    LendingInvariant { detail: String },
    #[error("ENTITY_KERNEL_SWAP_REJECTED:{code}")]
    SwapRejected { code: &'static str },
    #[error("ENTITY_KERNEL_TIF_UNSUPPORTED:{value}")]
    UnsupportedTimeInForce { value: u8 },
    #[error("ENTITY_KERNEL_COMMITMENT_UNSAFE_NUMBER:{field}:{value}")]
    CommitmentUnsafeNumber { field: &'static str, value: u64 },
    #[error("ENTITY_KERNEL_COMMITMENT_ENCODING:{detail}")]
    CommitmentEncoding { detail: String },
    #[error("ENTITY_KERNEL_SNAPSHOT_INVALID:{detail}")]
    SnapshotInvalid { detail: String },
    #[error("ENTITY_KERNEL_HUB_REBALANCE_CONFIG_INVALID:{detail}")]
    HubRebalanceConfigInvalid { detail: String },
    #[error("CRONTAB_HUB_REBALANCE_HANDLER_MISSING")]
    HubRebalanceHandlerMissing,
}

/// Owner canon 2026-09-05, mirrored in TS `rejectFailFast`: rejected
/// remote input halts by default (tests/dev) and is only logged+dropped in
/// production. `XLN_REJECT_FAIL_FAST=0|false|off` forces log-and-drop, `=1`
/// forces fail-fast; otherwise `NODE_ENV=production` means log-and-drop.
pub fn reject_fail_fast() -> bool {
    static POLICY: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *POLICY.get_or_init(|| {
        if let Ok(raw) = std::env::var("XLN_REJECT_FAIL_FAST")
            && !raw.trim().is_empty()
        {
            return !matches!(
                raw.trim().to_ascii_lowercase().as_str(),
                "0" | "false" | "off" | "no"
            );
        }
        std::env::var("NODE_ENV")
            .map(|value| value != "production")
            .unwrap_or(true)
    })
}

impl EntityKernelError {
    pub(crate) fn rejected(kind: &'static str, detail: impl Into<String>) -> Self {
        Self::RejectedEntityTx {
            kind,
            detail: detail.into(),
        }
    }

    pub(crate) fn local(kind: &'static str, detail: impl Into<String>) -> Self {
        Self::InvalidLocalEntityTx {
            kind,
            detail: detail.into(),
        }
    }

    pub(crate) fn output(detail: impl Into<String>) -> Self {
        Self::AccountOutputMismatch {
            detail: detail.into(),
        }
    }

    pub(crate) fn orderbook(detail: impl Into<String>) -> Self {
        Self::OrderbookInvariant {
            detail: detail.into(),
        }
    }

    pub(crate) fn htlc(detail: impl Into<String>) -> Self {
        Self::HtlcInvariant {
            detail: detail.into(),
        }
    }

    pub(crate) fn lending(detail: impl Into<String>) -> Self {
        Self::LendingInvariant {
            detail: detail.into(),
        }
    }
}
