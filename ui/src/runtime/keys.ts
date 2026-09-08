import { Mnemonic, getBytes } from 'ethers';
import { deriveRuntimeSignerAddress, deriveRuntimeSignerPrivateKey } from '@xln/core/storage/recovery/bundle/seed-identity';

export function deriveAddress(seed: string, index: number): string { return deriveRuntimeSignerAddress(seed, index); }
export function derivePrivateKey(seed: string, index: number): string { return deriveRuntimeSignerPrivateKey(seed, index); }
export function derivePrivateKeyBytes(seed: string, index: number): Uint8Array { return getBytes(derivePrivateKey(seed, index)); }

export function isValidMnemonic(phrase: string): boolean {
	try {
		Mnemonic.fromPhrase(phrase.trim());
		return true;
	} catch {
		return false;
	}
}

export function runtimeIdForSeed(seed: string): string {
	return deriveAddress(seed, 0);
}
