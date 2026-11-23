import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from './hex-bytes';

const INTEGRITY_CHECKSUM_BYTES = 16;
export const INTEGRITY_DIGEST_ALGORITHM_ID = 'sha256' as const;

type NativeHasherStatic = {
  hash(algorithm: string, data: Uint8Array, encoding: 'hex'): string;
  hash(algorithm: string, data: Uint8Array): Uint8Array;
};

const isNativeHasherStatic = (value: unknown): value is NativeHasherStatic =>
  typeof value === 'function' && typeof Reflect.get(value, 'hash') === 'function';

const nativeHasher = ((): NativeHasherStatic | undefined => {
  const bunRuntime: unknown = Reflect.get(globalThis, 'Bun');
  if (!bunRuntime || typeof bunRuntime !== 'object') return undefined;
  const constructor: unknown = Reflect.get(bunRuntime, 'CryptoHasher');
  return isNativeHasherStatic(constructor) ? constructor : undefined;
})();

const computeIntegrityDigestBytes = (bytes: Uint8Array): Uint8Array =>
  nativeHasher ? new Uint8Array(nativeHasher.hash(INTEGRITY_DIGEST_ALGORITHM_ID, bytes)) : sha256(bytes);

// One native call straight to hex: this digest seals every Merkle node of the
// Entity/Account state roots, millions of times per hub load window.
const computeIntegrityDigestHex = (bytes: Uint8Array): string =>
  nativeHasher
    ? `0x${nativeHasher.hash(INTEGRITY_DIGEST_ALGORITHM_ID, bytes, 'hex')}`
    : bytesToHex(sha256(bytes));

const computeIntegrityChecksumBytes = (bytes: Uint8Array): Uint8Array =>
  computeIntegrityDigestBytes(bytes).slice(0, INTEGRITY_CHECKSUM_BYTES);

export const computeIntegrityChecksum = (bytes: Uint8Array): string =>
  bytesToHex(computeIntegrityChecksumBytes(bytes));

export const computeIntegrityDigest = (bytes: Uint8Array): string =>
  computeIntegrityDigestHex(bytes);
