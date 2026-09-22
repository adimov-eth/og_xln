import { getEmbeddedEnv } from '../runtime/adapter';
import { useApp } from '../runtime/store';
import { getXLN } from '../runtime/xln-loader';
import { resolveApiBase } from '../runtime/http';
import { backupToTowers, saveRecovery } from '../runtime/recovery';
import { nativeRecoveryUrl } from './recovery-address';
import { recoveryDiscoveryError } from '../runtime/recovery-failure';

function backupContext() {
  const { activeVaultId, sessionSeeds } = useApp.getState();
  const env = getEmbeddedEnv();
  if (!activeVaultId || !sessionSeeds[activeVaultId] || !env) throw new Error('Unlock your wallet first.');
  return { vaultId: activeVaultId, seed: sessionSeeds[activeVaultId], env };
}

export function nativeBackupAddress(): string {
  return nativeRecoveryUrl(resolveApiBase(), import.meta.env['VITE_XLN_WATCHTOWER_URL']);
}

/** Use the canonical encrypted bundle and owner signature. Only a decrypted,
 * verified discovery candidate can produce a success summary; keys and bundle
 * plaintext never cross into the native presentation bridge or its logs. */
export async function nativeBackup(upload: boolean, consent: unknown) {
  const url = nativeBackupAddress();
  if (upload && consent !== true) throw new Error('Allow sending an encrypted copy first.');
  const { vaultId, seed, env } = backupContext();
  const xln = await getXLN();
  let uploadedHeight = 0;
  if (upload) {
    const [result] = await backupToTowers(xln, env, seed, [url]);
    if (!result || result.error || !result.receipt) throw new Error(result?.error ?? 'The recovery service did not confirm storage.');
    uploadedHeight = result.receipt.height;
  }
  const found = await xln.discoverRuntimeRecoveryCandidates(seed, {
    towers: [{ url }], crypto: xln, pageUrl: window.location.href,
  });
  const candidate = found.candidates.find(item => item.runtimeId === env.runtimeId && item.runtimeHeight >= uploadedHeight);
  if (!candidate) throw recoveryDiscoveryError(found);
  saveRecovery(vaultId, { mode: 'local', towers: [url] });
  return { address: url, height: candidate.runtimeHeight, checkpoint: candidate.checkpointHash,
    bytes: new TextEncoder().encode(JSON.stringify(candidate.encryptedBundles)).byteLength };
}
