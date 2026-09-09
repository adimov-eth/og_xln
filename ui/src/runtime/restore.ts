import type { RuntimeRecoveryCandidate } from '@xln/core/storage/recovery/discovery/types';
import type { XLNModule, RuntimeReplica } from '@xln/core/api/public/runtime-module';
import { deriveAddress, derivePrivateKeyBytes, runtimeIdForSeed } from './keys';
import { defaultTowerUrl, normalizeTowerUrl } from './recovery';
import { getXLN } from './xln-loader';

export type { RuntimeRecoveryCandidate };

export async function discoverTowerRestore(seed: string, address: string): Promise<RuntimeRecoveryCandidate> {
	await requireFreshDevice(runtimeIdForSeed(seed).toLowerCase());
	const url = normalizeTowerUrl(address || defaultTowerUrl());
	if (!url) throw new Error('Enter the address of the tower holding your backup.');
	const xln = await getXLN();
	const result = await xln.discoverRuntimeRecoveryCandidates(seed, {
		towers: [{ url }], crypto: xln, pageUrl: window.location.href,
	});
	const candidate = result.candidates[0];
	if (!candidate) throw new Error(`No verified backup could be restored. ${result.errors.join('; ')}`);
	return candidate;
}

/** A recovery import replaces storage. Even an incomplete local database blocks it. */
async function requireFreshDevice(runtimeId: string): Promise<void> {
	const databases = await indexedDB.databases();
	if (databases.some(database => database.name?.toLowerCase().includes(runtimeId))) {
		throw new Error('This device already has data for this wallet. Unlock it normally; restore on a clean browser profile or device.');
	}
}

export async function restoreFreshRuntime(xln: XLNModule, seed: string, candidate: RuntimeRecoveryCandidate): Promise<RuntimeReplica> {
	const runtimeId = runtimeIdForSeed(seed).toLowerCase();
	if (candidate.runtimeId.toLowerCase() !== runtimeId) throw new Error('Recovery belongs to a different wallet.');
	await requireFreshDevice(runtimeId);
	for (const signer of candidate.metadataBundle.signers) {
		const index = signer.derivationIndex ?? signer.index;
		const address = deriveAddress(seed, index);
		if (address !== signer.address.toLowerCase()) throw new Error('Recovery signer does not match the phrase.');
		xln.registerSignerKey(seed, address, derivePrivateKeyBytes(seed, index));
	}
	const env = await xln.restoreEnvFromRecoveryBundles(candidate.bundles, { runtimeSeed: seed, runtimeId });
	try {
		await xln.persistRestoredEnvToDB(env);
	} catch (error) {
		const cleanup = await Promise.allSettled([xln.closeRuntimeDb(env), xln.closeInfraDb(env)]);
		const failures = cleanup.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
		if (failures.length) throw new AggregateError([error, ...failures], 'Recovery failed; storage cleanup also failed.');
		throw error;
	}
	xln.resumeRuntimeAfterPersistenceQuiesce(env);
	return env;
}
