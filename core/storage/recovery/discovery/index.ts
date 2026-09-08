import { deriveRuntimeRecoveryLookupKey } from '../bundle/crypto';
import {
  buildRuntimeRecoveryCandidate,
  extractEncryptedRecoveryBundles,
  requireRuntimeIdForSeed,
  sortRecoveryCandidatesByTip,
} from './candidates';
import { classifyRuntimeRecoveryDiscoveryFailure, recoveryFailureErrorText } from './failures';
import { fetchTowerRecoveryBundles, towerHasRecoveryBundle } from './tower-http';
import type {
  RecoveryTowerConfig,
  RuntimeRecoveryCandidate,
  RuntimeRecoveryCandidateSource,
  RuntimeRecoveryCryptoPort,
  RuntimeRecoveryDiscoveryFailure,
  RuntimeRecoveryDiscoveryResult,
  RuntimeRecoveryPeerSource,
} from './types';

export { parseRuntimeRecoveryCandidateFile } from './candidates';
export { classifyRuntimeRecoveryDiscoveryFailure } from './failures';
export { buildTowerRequestUrl, fetchTowerServerInfo } from './tower-http';
export * from './types';

export type RuntimeRecoveryDiscoveryOptions = {
  /** Already resolved towers. Default-tower policy belongs to the wallet shell. */
  towers: readonly RecoveryTowerConfig[];
  peers?: readonly RuntimeRecoveryPeerSource[] | undefined;
  crypto?: RuntimeRecoveryCryptoPort | undefined;
  /** Browsing context asking, when one exists; enables the local-tower proxy. */
  pageUrl?: string | undefined;
};

type FailureRecorder = (
  source: Exclude<RuntimeRecoveryCandidateSource, 'file'>,
  sourceLabel: string,
  message: string,
) => void;

const collectTowerCandidates = async (
  towers: readonly RecoveryTowerConfig[],
  request: { seed: string; runtimeId: string; lookupKey: string; options: RuntimeRecoveryDiscoveryOptions },
  recordFailure: FailureRecorder,
): Promise<RuntimeRecoveryCandidate[]> => {
  const candidates: RuntimeRecoveryCandidate[] = [];
  for (const tower of towers) {
    try {
      if (!(await towerHasRecoveryBundle(tower, request.lookupKey, request.options.pageUrl))) {
        recordFailure('tower', tower.url, 'TOWER_BUNDLE_NOT_FOUND');
        continue;
      }
      const restore = await fetchTowerRecoveryBundles(tower, request.lookupKey, request.options.pageUrl);
      if (!restore.ok) {
        recordFailure('tower', tower.url, restore.message);
        continue;
      }
      const encryptedBundles = extractEncryptedRecoveryBundles(restore.payload);
      if (!restore.payload.ok || encryptedBundles.length === 0) {
        recordFailure('tower', tower.url, String(restore.payload.error || 'unknown'));
        continue;
      }
      candidates.push(
        await buildRuntimeRecoveryCandidate({
          source: 'tower',
          sourceLabel: tower.url,
          towerUrl: tower.url,
          receipt: restore.payload.receipt,
          seed: request.seed,
          expectedRuntimeId: request.runtimeId,
          encryptedBundles,
          crypto: request.options.crypto,
        }),
      );
    } catch (error) {
      recordFailure('tower', tower.url, error instanceof Error ? error.message : String(error));
    }
  }
  return candidates;
};

const collectPeerCandidates = async (
  peers: readonly RuntimeRecoveryPeerSource[],
  request: { seed: string; runtimeId: string; lookupKey: string; options: RuntimeRecoveryDiscoveryOptions },
  recordFailure: FailureRecorder,
): Promise<RuntimeRecoveryCandidate[]> => {
  const candidates: RuntimeRecoveryCandidate[] = [];
  for (const peer of peers) {
    const sourceLabel = String(peer.label || peer.id || 'Peer').trim() || 'Peer';
    try {
      const payload = await peer.fetchBundles({ runtimeId: request.runtimeId, lookupKey: request.lookupKey });
      const encryptedBundles = extractEncryptedRecoveryBundles(payload);
      if (encryptedBundles.length === 0) {
        recordFailure('peer', sourceLabel, 'PEER_RECOVERY_BUNDLE_EMPTY');
        continue;
      }
      candidates.push(
        await buildRuntimeRecoveryCandidate({
          source: 'peer',
          sourceLabel,
          peerId: peer.id,
          seed: request.seed,
          expectedRuntimeId: request.runtimeId,
          encryptedBundles,
          crypto: request.options.crypto,
        }),
      );
    } catch (error) {
      recordFailure('peer', sourceLabel, error instanceof Error ? error.message : String(error));
    }
  }
  return candidates;
};

/**
 * Ask every configured tower and peer what they hold for this seed, open it,
 * and return the candidates newest-first. Nothing is applied here: choosing and
 * installing a candidate stays with the wallet, which owns the live Runtime.
 */
export async function discoverRuntimeRecoveryCandidates(
  seed: string,
  options: RuntimeRecoveryDiscoveryOptions,
): Promise<RuntimeRecoveryDiscoveryResult> {
  const runtimeId = requireRuntimeIdForSeed(seed);
  const deriveLookupKey = options.crypto?.deriveRuntimeRecoveryLookupKey ?? deriveRuntimeRecoveryLookupKey;
  const lookupKey = deriveLookupKey(runtimeId, seed);
  const errors: string[] = [];
  const failures: RuntimeRecoveryDiscoveryFailure[] = [];
  const recordFailure: FailureRecorder = (source, sourceLabel, message) => {
    const failure = classifyRuntimeRecoveryDiscoveryFailure({ source, sourceLabel, message });
    failures.push(failure);
    if (failure.category !== 'ExpectedEmpty') errors.push(recoveryFailureErrorText(failure));
  };

  const peers = options.peers || [];
  const request = { seed, runtimeId, lookupKey, options };
  const candidates = [
    ...(await collectTowerCandidates(options.towers, request, recordFailure)),
    ...(await collectPeerCandidates(peers, request, recordFailure)),
  ];

  candidates.sort(sortRecoveryCandidatesByTip);
  return {
    runtimeId,
    lookupKey,
    candidates,
    errors,
    failures,
    checkedTowers: options.towers.length,
    checkedPeers: peers.length,
  };
}
