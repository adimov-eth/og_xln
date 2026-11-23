import type { RuntimeReplica } from '@xln/core/api/public/runtime-module';
import { useEffect } from 'react';
import { getEmbeddedEnv } from './adapter';
import { appointProtection } from './protection';
import {
  backupToTowers,
  ensureReactDefaultTowerProtection,
  readRecovery,
  writeRecoveryShieldStatus,
} from './recovery';
import { useApp } from './store';
import { peekXLN } from './xln-loader';

const signedProofDigest = (env: RuntimeReplica): string => {
  const tokens: string[] = [];
  for (const replica of env.state.eReplicas.values()) {
    for (const [peer, account] of replica.state.accounts.entries()) {
      const nonce = account.counterpartyDisputeProofNonce ?? 0;
      if (nonce > 0) tokens.push(`${replica.entityId}:${peer}:${nonce}`);
    }
  }
  return tokens.sort().join(',');
};

/** Backup lifetime follows the unlocked wallet, not the screen the user happens to view. */
export function useRecoverySync(): void {
  const vaultId = useApp(state => state.activeVaultId);
  const seed = useApp(state => vaultId ? state.sessionSeeds[vaultId] : undefined);
  useEffect(() => {
    if (!vaultId || !seed) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let savedKey = '';
    let lastError = '';
    const sync = async (): Promise<void> => {
      try {
        ensureReactDefaultTowerProtection(vaultId);
        const config = readRecovery(vaultId);
        const height = useApp.getState().height;
        const xln = peekXLN();
        const env = getEmbeddedEnv();
        if (config.mode !== 'tower') {
          writeRecoveryShieldStatus(vaultId, {
            mode: 'local',
            towers: [],
            lastBackupHeight: height,
            lastBackupAt: null,
            backupError: null,
            protectionReceiptsCount: 0,
            automaticResponseEnabled: false,
            protectionError: null,
            unsupportedChains: [],
          });
          return;
        }
        const key = `${height}:${config.towers.join(',')}:${env ? signedProofDigest(env) : ''}`;
        if (xln && env && height > 0 && key !== savedKey) {
          const results = await backupToTowers(xln, env, seed, config.towers);
          const backupErrors = results.filter(row => row.error).map(row => `${row.url}: ${row.error}`);
          const sweepKnown = results.filter(row => typeof row.sweepEnabled === 'boolean');
          const backupSweepEnabled = sweepKnown.length === 0 ? true : sweepKnown.every(row => row.sweepEnabled === true);
          if (backupErrors.length > 0) {
            const backupMessage = backupErrors.join(' · ');
            writeRecoveryShieldStatus(vaultId, {
              mode: 'tower',
              towers: config.towers,
              lastBackupHeight: height,
              lastBackupAt: null,
              backupError: backupMessage,
              protectionReceiptsCount: 0,
              automaticResponseEnabled: false,
              protectionError: null,
              unsupportedChains: [],
            });
            throw new Error(backupMessage);
          }
          const protection = await appointProtection(xln, env, seed, config.towers, { allowEmpty: true });
          const protectionMessage = protection.errors.length > 0 ? protection.errors.join(' · ') : null;
          const automaticResponseEnabled =
            protection.receipts.length > 0
              ? protection.receipts.every(receipt => receipt.automaticResponseEnabled)
              : backupSweepEnabled;
          writeRecoveryShieldStatus(vaultId, {
            mode: 'tower',
            towers: config.towers,
            lastBackupHeight: height,
            lastBackupAt: Date.now(),
            backupError: null,
            protectionReceiptsCount: protection.receipts.length,
            automaticResponseEnabled,
            protectionError: protectionMessage,
            unsupportedChains: protection.unsupportedChains,
          });
          if (protectionMessage) throw new Error(protectionMessage);
          savedKey = key;
          lastError = '';
        }
      } catch (failure) {
        const message = failure instanceof Error ? failure.message : String(failure);
        if (!stopped && message !== lastError) useApp.getState().toast(`Backup failed: ${message}`, 'danger', 'automatic-backup');
        lastError = message;
      } finally {
        if (!stopped) timer = setTimeout(() => void sync(), lastError ? 60_000 : 5_000);
      }
    };
    timer = setTimeout(() => void sync(), 2_000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [vaultId, seed]);
}
