/**
 * Canonical Wasm Argon2 shard implementation.
 *
 * Browser and native workers import this function instead of copying
 * options. Password bytes are exact input after NFKD: trimming, case folding,
 * replacement characters, library defaults, or an Argon version upgrade would
 * all create a different wallet. resolveKdfParams owns the CLI's explicitly
 * domain-separated custom mode; canonical callers use the frozen defaults.
 *
 * AUDITOR NOTE: t=1 and p=1 describe one shard, not the whole recovery. The
 * outer protocol repeats that 256 MiB unit for every shard. Keeping each shard
 * independent lets a low-memory device run them sequentially while a node runs
 * them concurrently without changing a byte of output or total Argon work.
 */

import { argon2id } from 'hash-wasm';
import { assertBrainVaultPassphrase, BRAINVAULT_V1 } from './spec.ts';
import { copyAndWipe } from './encoding.ts';

export interface BrainvaultKdfParams {
  algId?: string;
  shardMemoryKb?: number;
}

export function resolveKdfParams(params: BrainvaultKdfParams = {}) {
  const resolved = {
    algId: params.algId === undefined ? BRAINVAULT_V1.ALG_ID : params.algId,
    shardMemoryKb: params.shardMemoryKb === undefined ? BRAINVAULT_V1.SHARD_MEMORY_KB : params.shardMemoryKb,
  };
  if (typeof resolved.algId !== 'string' || resolved.algId.length === 0) {
    throw new Error('BRAINVAULT_ALG_ID_INVALID');
  }
  if (!Number.isSafeInteger(resolved.shardMemoryKb) || resolved.shardMemoryKb < 1 || resolved.shardMemoryKb > 0xffff_ffff) {
    throw new Error('BRAINVAULT_KDF_PARAMETER_INVALID:shardMemoryKb');
  }
  return resolved;
}

export async function deriveShard(
  passphrase: string,
  shardSalt: Uint8Array,
): Promise<Uint8Array> {
  return deriveShardWithParams(passphrase, shardSalt);
}

export async function deriveShardWithParams(
  passphrase: string,
  shardSalt: Uint8Array,
  params: BrainvaultKdfParams = {},
): Promise<Uint8Array> {
  assertBrainVaultPassphrase(passphrase);
  const kdf = resolveKdfParams(params);
  // TextEncoder defines malformed UTF-16 replacement identically for browser,
  // Bun Wasm and the native bridge; passing a JS string directly would delegate
  // that boundary behavior to whichever Argon wrapper happened to be installed.
  const password = new TextEncoder().encode(passphrase.normalize('NFKD'));
  try {
    const result = await argon2id({
      password,
      salt: shardSalt,
      parallelism: BRAINVAULT_V1.ARGON_PARALLELISM,
      iterations: BRAINVAULT_V1.ARGON_TIME_COST,
      memorySize: kdf.shardMemoryKb,
      hashLength: BRAINVAULT_V1.SHARD_OUTPUT_BYTES,
      outputType: 'binary',
    });
    return copyAndWipe(result);
  } finally {
    password.fill(0);
  }
}
