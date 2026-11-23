import { expect, test } from 'bun:test';
import { asTokenId } from '../../../core/protocol/units';
import { writeWalletPosture } from '../../../frontend/src/lib/everyday/wallet-posture';
import {
  getOpenAccountRebalancePolicyData,
  readSavedCollateralPolicy,
  seedDefaultCollateralPolicy,
  writeSavedCollateralPolicy,
} from '../../../frontend/src/lib/utils/onboarding/onboardingPreferences';

const COLLATERAL_POLICY_KEY = 'xln-collateral-policy';

const withMockLocalStorage = (initial: Record<string, string>, fn: () => void): void => {
  const store = new Map(Object.entries(initial));
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });
  try {
    fn();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
};

test('everyday posture ignores persisted Pro xln-collateral-policy (autopilot, manual, and corrupt)', () => {
  const proAutopilot = JSON.stringify({
    mode: 'autopilot',
    softLimitUsd: 500,
    hardLimitUsd: 10_000,
    maxFeeUsd: 15,
    timestamp: 123456,
  });
  withMockLocalStorage({ [COLLATERAL_POLICY_KEY]: proAutopilot }, () => {
    expect(readSavedCollateralPolicy('everyday')).toEqual({
      mode: 'autopilot',
      softLimitUsd: 1,
      hardLimitUsd: 250,
      maxFeeUsd: 2,
      timestamp: 0,
    });
    expect(readSavedCollateralPolicy()).toEqual({
      mode: 'autopilot',
      softLimitUsd: 1,
      hardLimitUsd: 250,
      maxFeeUsd: 2,
      timestamp: 0,
    });
    expect(getOpenAccountRebalancePolicyData(asTokenId(1), 'everyday')).toEqual({
      r2cRequestSoftLimit: 1_000_000n,
      hardLimit: 250_000_000n,
      maxAcceptableFee: 2_000_000n,
    });
    expect(getOpenAccountRebalancePolicyData(asTokenId(1))).toEqual({
      r2cRequestSoftLimit: 1_000_000n,
      hardLimit: 250_000_000n,
      maxAcceptableFee: 2_000_000n,
    });
  });

  const proManual = JSON.stringify({
    mode: 'manual',
    softLimitUsd: 500,
    hardLimitUsd: 10_000,
    maxFeeUsd: 15,
    timestamp: 123456,
  });
  withMockLocalStorage({ [COLLATERAL_POLICY_KEY]: proManual }, () => {
    expect(readSavedCollateralPolicy('everyday').mode).toBe('autopilot');
    expect(getOpenAccountRebalancePolicyData(asTokenId(1), 'everyday')).toEqual({
      r2cRequestSoftLimit: 1_000_000n,
      hardLimit: 250_000_000n,
      maxAcceptableFee: 2_000_000n,
    });
    expect(getOpenAccountRebalancePolicyData(asTokenId(1), 'pro')).toBeNull();
  });

  withMockLocalStorage({ [COLLATERAL_POLICY_KEY]: '{bad-json' }, () => {
    expect(readSavedCollateralPolicy('everyday')).toEqual({
      mode: 'autopilot',
      softLimitUsd: 1,
      hardLimitUsd: 250,
      maxFeeUsd: 2,
      timestamp: 0,
    });
    expect(() => readSavedCollateralPolicy('pro')).toThrow('COLLATERAL_POLICY_INVALID');
  });
});

test('everyday writes never overwrite Pro xln-collateral-policy while Pro writes persist', () => {
  const proManual = JSON.stringify({
    mode: 'manual',
    softLimitUsd: 300,
    hardLimitUsd: 6000,
    maxFeeUsd: 9,
    timestamp: 123456,
  });
  withMockLocalStorage({ [COLLATERAL_POLICY_KEY]: proManual }, () => {
    writeSavedCollateralPolicy({ mode: 'autopilot', softLimitUsd: 1, hardLimitUsd: 250, maxFeeUsd: 2 });
    writeSavedCollateralPolicy({ mode: 'autopilot', softLimitUsd: 1, hardLimitUsd: 250, maxFeeUsd: 2 }, 'everyday');
    expect(localStorage.getItem(COLLATERAL_POLICY_KEY)).toBe(proManual);
    expect(readSavedCollateralPolicy('pro')).toEqual({
      mode: 'manual',
      softLimitUsd: 300,
      hardLimitUsd: 6000,
      maxFeeUsd: 9,
      timestamp: 123456,
    });

    writeWalletPosture('pro');
    writeSavedCollateralPolicy({ mode: 'autopilot', softLimitUsd: 200, hardLimitUsd: 4000, maxFeeUsd: 8 }, 'pro');
    expect(readSavedCollateralPolicy('pro')).toMatchObject({
      mode: 'autopilot',
      softLimitUsd: 200,
      hardLimitUsd: 4000,
      maxFeeUsd: 8,
    });
    expect(readSavedCollateralPolicy('everyday')).toEqual({
      mode: 'autopilot',
      softLimitUsd: 1,
      hardLimitUsd: 250,
      maxFeeUsd: 2,
      timestamp: 0,
    });
  });

  withMockLocalStorage({ [COLLATERAL_POLICY_KEY]: proManual }, () => {
    expect(seedDefaultCollateralPolicy('everyday')).toBeNull();
    expect(localStorage.getItem(COLLATERAL_POLICY_KEY)).toBe(proManual);

    const seeded = seedDefaultCollateralPolicy('pro');
    expect(seeded).toMatchObject({
      mode: 'autopilot',
      softLimitUsd: 500,
      hardLimitUsd: 10_000,
      maxFeeUsd: 15,
    });
    expect(readSavedCollateralPolicy('pro')).toMatchObject({
      mode: 'autopilot',
      softLimitUsd: 500,
      hardLimitUsd: 10_000,
      maxFeeUsd: 15,
    });
  });
});
