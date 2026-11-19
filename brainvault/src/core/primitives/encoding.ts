/**
 * Strict hexadecimal encoding at BrainVault module boundaries.
 *
 * Worker messages cannot transfer implementation-specific Buffer objects as a
 * protocol assumption. Lowercase hex is the small, deterministic wire format;
 * odd length or non-hex input must fail instead of being partially parsed.
 */

import { hexToBytes as nobleHexToBytes } from '@noble/hashes/utils.js';

export { bytesToHex } from '@noble/hashes/utils.js';

export function hexToBytes(hex: string): Uint8Array {
  try {
    return nobleHexToBytes(hex);
  } catch {
    throw new Error('BRAINVAULT_HEX_INVALID');
  }
}

/** Copy a backend-owned secret before erasing the backend allocation. */
export function copyAndWipe(bytes: Uint8Array): Uint8Array {
  try {
    return new Uint8Array(bytes);
  } finally {
    bytes.fill(0);
  }
}
