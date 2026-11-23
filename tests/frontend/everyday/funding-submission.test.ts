import { expect, test } from 'bun:test';
import { batchAddReserveToCollateral, initJBatch } from '../../../core/jurisdiction/machine/batch';
import {
	claimFundingSubmission,
	fundingSubmissionKey,
	releaseFundingSubmission,
	observeFundingBatches,
	batchFundsAccount,
} from '../../../frontend/src/lib/everyday/funding-submission';

test('a pending top-up cannot be submitted again after navigation to another component', () => {
	const key = fundingSubmissionKey('owner', 'counterparty', 1);
	claimFundingSubmission(key);
	expect(() => claimFundingSubmission(key)).toThrow('already has a top-up');
	// Failed acquisition must not release another caller's pending submission.
	expect(() => claimFundingSubmission(key)).toThrow('already has a top-up');
	releaseFundingSubmission(key);
	expect(() => claimFundingSubmission(key)).not.toThrow();
	releaseFundingSubmission(key);
});

test('published batch takes over the guard even after the funding screen unmounts', () => {
	const owner = 'owner';
	const account = 'counterparty';
	const key = fundingSubmissionKey(owner, account, 1);
	const state = initJBatch();
	claimFundingSubmission(key);
	observeFundingBatches(owner, [state.batch]);
	expect(() => claimFundingSubmission(key)).toThrow('already has a top-up');
	batchAddReserveToCollateral(state, owner, account, 1, 25n);
	observeFundingBatches(owner, [state.batch]);
	expect(batchFundsAccount(state.batch, owner, account, 1)).toBe(true);
	// After the real batch has finalized, another payment may need fresh funding.
	expect(() => claimFundingSubmission(key)).not.toThrow();
	releaseFundingSubmission(key);
});

test('funding submission locks normalize mixed-case entity IDs', () => {
	const upperKey = fundingSubmissionKey('0xAaBb', '0xCcDd', 1);
	const lowerKey = fundingSubmissionKey('0xaabb', '0xccdd', 1);
	expect(upperKey).toBe(lowerKey);
	claimFundingSubmission(upperKey);
	expect(() => claimFundingSubmission(lowerKey)).toThrow('already has a top-up');
	const state = initJBatch();
	batchAddReserveToCollateral(state, '0xaabb', '0xccdd', 1, 10n);
	observeFundingBatches('0xAaBb', [state.batch]);
	expect(() => claimFundingSubmission(lowerKey)).not.toThrow();
	releaseFundingSubmission(lowerKey);
});
