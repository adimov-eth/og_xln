import { useSyncExternalStore } from 'react';
import { hasFundingSubmission, subscribeFundingSubmissions } from '@xln/frontend/lib/everyday/funding-submission';

export function useFundingSubmission(key: string): boolean {
	return useSyncExternalStore(subscribeFundingSubmissions, () => hasFundingSubmission(key));
}
