/**
 * Canonical keccak256 over UTF-8 text.
 *
 * Consensus identities hash canonical text on the hot path. Routing that
 * through ethers costs two extra conversions per call (BytesLike normalization
 * in, hex formatting out) for a digest that is byte-identical to hashing the
 * UTF-8 bytes directly. Keep one implementation so the digest cannot drift
 * between call sites.
 */
import { countOp, countOpWithSite } from '../../support/performance/op-counters';
import { hexToBytes, bytesToHex } from '../../support/bytes/hex-bytes';
import { keccak256Bytes } from './fast/fast-keccak';

const textEncoder = new TextEncoder();
/**
 * UTF-8 bytes of `text`, byte-identical to `ethers.toUtf8Bytes` (which walks
 * the string in JS): rejects lone surrogates instead of substituting U+FFFD,
 * otherwise the native encoder.
 */
export const utf8Bytes = (text: string): Uint8Array => {
  if (!text.isWellFormed()) throw new Error('UTF8_LONE_SURROGATE');
  return textEncoder.encode(text);
};

/** Lowercase `0x`-prefixed keccak256 of the UTF-8 encoding of `text`. */
export const keccakTextHash = (text: string): string => {
  const bytes = utf8Bytes(text);
  countOpWithSite('keccak.text', bytes.length, 1);
  return bytesToHex(keccak256Bytes(bytes));
};

/** Lowercase `0x`-prefixed keccak256 of raw bytes. */
export const keccakBytesHash = (bytes: Uint8Array): string => {
  countOpWithSite('keccak.bytes', bytes.length, 1);
  return bytesToHex(keccak256Bytes(bytes));
};

/** Lowercase keccak256 of hex-encoded bytes; identical to `ethers.keccak256(hex)` without its BytesLike walk. */
export const keccakHexHash = (hex: string): string => {
  const bytes = hexToBytes(hex);
  countOp('keccak.hex', bytes.length);
  return bytesToHex(keccak256Bytes(bytes));
};
