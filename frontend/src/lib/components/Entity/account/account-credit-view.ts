export type CreditFormMode = 'extend' | 'request';

type SignedCreditLimits = { ownCreditLimit: bigint; peerCreditLimit: bigint };

/**
 * The signed limit a credit form is about to replace.
 *
 * `peerCreditLimit` caps what the counterparty may owe us: it is the credit we extend, and the
 * proposer of `set_credit_limit` writes the other side's field (set-credit-limit.ts).
 * `ownCreditLimit` caps what we may owe them: it is the credit they extend to us.
 */
export const signedCreditLimitFor = (mode: CreditFormMode, signed: SignedCreditLimits): bigint =>
  mode === 'extend' ? signed.peerCreditLimit : signed.ownCreditLimit;
