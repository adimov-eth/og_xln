import type { RuntimeRecoveryDiscoveryResult } from '@xln/core/storage/recovery/discovery/types';

/** Keep canonical discovery dispositions: an unreachable source cannot prove
 * that a password is wrong or a backup absent. Preserve diagnostics on failure. */
export function recoveryDiscoveryError(result: Pick<RuntimeRecoveryDiscoveryResult, 'failures' | 'errors'>): Error {
  const { failures, errors } = result;
  const empty = failures.length > 0 && failures.every(failure => failure.category === 'ExpectedEmpty');
  const contradicted = failures.some(failure => failure.category === 'Contradiction');
  const transient = failures.some(failure => failure.category === 'TransientRace');
  const message = empty ? 'No verified backup could be restored.'
    : transient && !contradicted ? 'The recovery service is unavailable. Try again shortly.'
    : 'The backup could not be verified. No recovery data was applied.';
  return new Error([message, ...errors].join(' '));
}
