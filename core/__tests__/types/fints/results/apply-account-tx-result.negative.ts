import type { ApplyAccountTxResult } from '../../../../account/tx/apply-types';

export const illegalSuccessWithError: ApplyAccountTxResult = {
  ok: true,
  outcome: 'applied',
  events: [],
  // @ts-expect-error
  error: 'ACCOUNT_TX_VALIDATION',
};
