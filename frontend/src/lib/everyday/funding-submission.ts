import type { JBatch } from '@xln/core/api/public/runtime-module';
import { batchFundsPair } from './everyday-policy';

// Ephemeral admission guard only. The canonical draft/sent batch remains the post-crash authority.
const submissions = new Set<string>();
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};
export const fundingSubmissionKey = (owner: string, account: string, token: number) =>
  `${owner.toLowerCase()}:${account.toLowerCase()}:${token}`;
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
  const normalizedOwner = owner.toLowerCase();
  for (const key of submissions) if (key.startsWith(`${normalizedOwner}:`)) submissions.delete(key);
  notify();
}
/** Transfer duplicate protection to the published batch as soon as admission is visible. */
export function observeFundingBatches(owner: string, batches: readonly (JBatch | null | undefined)[]): void {
  const normalizedOwner = owner.toLowerCase();
  let changed = false;
  for (const key of submissions) {
    const [submissionOwner, account, token] = key.split(':');
    if (
      submissionOwner === normalizedOwner &&
      account &&
      batches.some(batch => batchFundsAccount(batch, normalizedOwner, account, Number(token)))
    ) {
      submissions.delete(key);
      changed = true;
    }
  }
  if (changed) notify();
}
export const hasFundingSubmission = (key: string): boolean => submissions.has(key);
export const subscribeFundingSubmissions = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const batchFundsAccount = batchFundsPair;
