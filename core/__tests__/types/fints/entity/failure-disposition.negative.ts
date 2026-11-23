import type { FailureDisposition } from '../../../../protocol/errors/failure-taxonomy';

// @ts-expect-error
export const illegalFailureDisposition: FailureDisposition = 'ignored';
