import { useSyncExternalStore } from 'react';
import type { JBatch } from '@xln/core/api/public/runtime-module';

// Ephemeral admission guard only. The canonical draft/sent batch remains the post-crash authority.
const submissions = new Set<string>();
const listeners = new Set<() => void>();
const notify = () => {
	for (const listener of listeners) listener();
};
export const fundingSubmissionKey = (owner: string, account: string, token: number) => `${owner}:${account}:${token}`;
export function claimFundingSubmission(key: string): void {
	if (submissions.has(key)) throw new Error('This account already has a top-up awaiting confirmation.');
	submissions.add(key);
	notify();
}
export function releaseFundingSubmission(key: string): void {
	submissions.delete(key);
	notify();
}
export function releaseFundingDrafts(owner: string): void {
	for (const key of submissions) if (key.startsWith(`${owner}:`)) submissions.delete(key);
	notify();
}
/** Transfer duplicate protection to the published batch as soon as admission is visible. */
export function observeFundingBatches(owner: string, batches: readonly (JBatch | null | undefined)[]): void {
	let changed = false;
	for (const key of submissions) {
		const [submissionOwner, account, token] = key.split(':');
		if (
			submissionOwner === owner &&
			account &&
			batches.some(batch => batchFundsAccount(batch, owner, account, Number(token)))
		) {
			submissions.delete(key);
			changed = true;
		}
	}
	if (changed) notify();
}
export function useFundingSubmission(key: string): boolean {
	return useSyncExternalStore(
		listener => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		() => submissions.has(key),
	);
}
export function batchFundsAccount(
	batch: JBatch | null | undefined,
	owner: string,
	account: string,
	token: number,
): boolean {
	return Boolean(
		batch?.reserveToCollateral.some(
			op =>
				op.tokenId === token &&
				op.receivingEntity.toLowerCase() === owner &&
				op.pairs.some(pair => pair.entity.toLowerCase() === account && pair.amount > 0n),
		),
	);
}
