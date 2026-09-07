//! Startup is a transient transport boundary over the existing J writer.

use std::collections::BTreeMap;

use super::{ResidentRuntimeService, ResidentRuntimeServiceError, durable_watcher_cursor_height};

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct WatcherStatus {
    stack: (u64, [u8; 20]),
    target: u64,
    committed: u64,
    authenticated: u64,
    local_scanned: u64,
    finalized: u64,
    pending_finality: bool,
}

fn complete(statuses: &[WatcherStatus]) -> bool {
    let mut stacks = BTreeMap::<_, Vec<_>>::new();
    for status in statuses {
        stacks.entry(status.stack).or_default().push(status);
    }
    stacks.values().all(|replicas| {
        let target = replicas[0].target;
        let all_finalized = replicas.iter().all(|row| row.finalized >= target);
        replicas.iter().all(|row| {
            row.target == target
                && row.local_scanned.max(row.authenticated) >= target
                && !row.pending_finality
                && (!all_finalized || row.committed >= target)
        }) && replicas.iter().any(|row| row.authenticated >= target)
    })
}

impl ResidentRuntimeService {
    pub(super) fn refresh_startup_readiness(&mut self) -> Result<(), ResidentRuntimeServiceError> {
        if self.delivery_ready {
            return Ok(());
        }
        let replica = self.processor.replica()?;
        let mut statuses = Vec::with_capacity(self.j_watchers.len());
        for watcher in &self.j_watchers {
            let (state, live) = replica
                .entity_slot(watcher.config.entity_id.as_bytes(), &watcher.signer_id)
                .ok_or_else(|| {
                    ResidentRuntimeServiceError::JWatcher("ENTITY_SLOT_MISSING".into())
                })?;
            let finalized = state.entity.last_finalized_j_height;
            let (local_scanned, pending_finality) =
                super::startup_metadata::replica_progress(live.replica_metadata(), finalized)
                    .map_err(ResidentRuntimeServiceError::JWatcher)?;
            statuses.push(WatcherStatus {
                stack: (watcher.config.chain_id, watcher.config.depository_address),
                target: watcher.startup_target,
                committed: durable_watcher_cursor_height(
                    replica,
                    watcher.config.chain_id,
                    &watcher.depository_text,
                )?,
                authenticated: watcher.authenticated_through,
                local_scanned,
                finalized,
                pending_finality,
            });
        }
        if !complete(&statuses) {
            return Ok(());
        }
        // A candidate's finality is insufficient until the existing WAL
        // barrier completes. Readiness never writes its own cursor or frame.
        if let Some(report) = self.sync_committed()? {
            self.deferred_publication.add(report)?;
        }
        self.processor.set_delivery_ready(true)?;
        self.ingress.set_delivery_ready(true)?;
        self.delivery_ready = true;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(finalized: u64) -> WatcherStatus {
        WatcherStatus {
            stack: (31337, [1; 20]),
            target: 100,
            committed: 99,
            authenticated: 100,
            local_scanned: finalized,
            finalized,
            pending_finality: false,
        }
    }

    #[test]
    fn startup_j_empty_authenticated_suffix_needs_no_fabricated_frame() {
        assert!(complete(&[row(99)]));
        assert!(complete(&[row(100), row(99)]));
        let mut certified = row(100);
        assert!(!complete(&[certified.clone()]));
        certified.committed = 100;
        assert!(complete(&[certified]));
    }

    #[test]
    fn startup_j_every_owner_and_pending_prefix_must_reach_the_fixed_target() {
        let mut behind = row(99);
        behind.authenticated = 99;
        assert!(!complete(&[row(100), behind.clone()]));
        behind.authenticated = 100;
        behind.pending_finality = true;
        assert!(!complete(&[row(100), behind.clone()]));
        behind.pending_finality = false;
        assert!(complete(&[row(100), behind]));
        let mut advancing_head = row(99);
        advancing_head.authenticated = 101;
        assert!(complete(&[advancing_head]));
    }
}
