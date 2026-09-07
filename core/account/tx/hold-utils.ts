import type { Delta } from '../../types/account';
import { UINT256_MAX } from '../../protocol/boundary/integer-ranges';

export type HoldSide = 'left' | 'right';

export function getHold(delta: Delta, side: HoldSide): bigint {
  return side === 'left' ? delta.leftHold : delta.rightHold;
}

function ensureHoldAdd(side: HoldSide, amount: bigint): string | undefined {
  if (amount < 0n) return `HOLD_ADD_NEGATIVE:${side} amount=${amount.toString()}`;
  return undefined;
}

export function addHold(delta: Delta, side: HoldSide, amount: bigint): string | undefined {
  const error = ensureHoldAdd(side, amount);
  if (error) return error;
  const currentHold = getHold(delta, side);
  const nextHold = currentHold + amount;
  // Distinct signed obligations share one uint256 hold. Available credit plus
  // collateral may exceed that representation even when this amount fits.
  if (nextHold > UINT256_MAX) {
    return `HOLD_ADD_OVERFLOW:${side} hold=${currentHold} amount=${amount}`;
  }
  if (side === 'left') delta.leftHold = nextHold;
  else delta.rightHold = nextHold;
  return undefined;
}

function ensureHoldRelease(
  delta: Delta,
  side: HoldSide,
  amount: bigint,
  formatUnderflow: (currentHold: bigint, releaseAmount: bigint) => string,
): string | undefined {
  if (amount < 0n) return `HOLD_RELEASE_NEGATIVE:${side} amount=${amount.toString()}`;
  const currentHold = getHold(delta, side);
  if (currentHold < amount) return formatUnderflow(currentHold, amount);
  return undefined;
}

export function releaseHold(
  delta: Delta,
  side: HoldSide,
  amount: bigint,
  formatUnderflow: (currentHold: bigint, releaseAmount: bigint) => string,
): string | undefined {
  const error = ensureHoldRelease(delta, side, amount, formatUnderflow);
  if (error) return error;
  const nextHold = getHold(delta, side) - amount;
  if (side === 'left') delta.leftHold = nextHold;
  else delta.rightHold = nextHold;
  return undefined;
}
