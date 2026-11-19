import { bytesToHex } from '../../../support/bytes/hex-bytes';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

/** Derive one stable Entity secret outside the deterministic reducer. */
export const deriveEntityEncryptionPrivateKey = (
  custodySeed: Uint8Array,
  entityId: string,
): string => {
  const normalizedEntityId = entityId.trim().toLowerCase();
  if (custodySeed.length < 32) throw new Error('ENTITY_ENCRYPTION_CUSTODY_SEED_REQUIRED');
  if (!/^0x[0-9a-f]{64}$/.test(normalizedEntityId)) {
    throw new Error('ENTITY_ENCRYPTION_ENTITY_ID_INVALID');
  }
  return bytesToHex(hkdf(
    sha256,
    custodySeed,
    new TextEncoder().encode(normalizedEntityId),
    new TextEncoder().encode('xln:entity-encryption:v1'),
    32,
  ));
};
