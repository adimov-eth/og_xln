import { HDNodeWallet, Mnemonic, getAddress, getIndexedAccountPath } from 'ethers';

/**
 * Seed-derived Runtime identity.
 *
 * A recovery bundle is addressed by the Runtime id (HD account 0 of the vault
 * seed) and every last-resort appointment is signed by a seed-derived signer
 * key. Both wallets must derive those exact values or a restored vault silently
 * becomes a different identity, so the derivation lives here once instead of
 * being restated per wallet.
 */

/** Lowercase checksum-validated EOA, or empty string when the value is not an address. */
export const normalizeRuntimeId = (value: string | null | undefined): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return getAddress(raw).toLowerCase();
  } catch {
    return '';
  }
};

export const deriveRuntimeSignerAddress = (seed: string, index: number): string => {
  const mnemonic = Mnemonic.fromPhrase(seed);
  return HDNodeWallet.fromMnemonic(mnemonic, getIndexedAccountPath(index)).address.toLowerCase();
};

export const deriveRuntimeSignerPrivateKey = (seed: string, index: number): string => {
  const mnemonic = Mnemonic.fromPhrase(seed);
  return HDNodeWallet.fromMnemonic(mnemonic, getIndexedAccountPath(index)).privateKey;
};
