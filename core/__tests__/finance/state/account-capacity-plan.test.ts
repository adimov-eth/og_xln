import { describe, expect, test } from 'bun:test';
import { planAccountFunding, planReceiveCapacity } from '../../../account/capacity-plan';
import { createDefaultDelta } from '../../../account/state/delta';
import { UINT256_MAX } from '../../../protocol/boundary/integer-ranges';
import { deriveDelta } from '../../../account/utils';
import type { Delta } from '../../../types/account';
import { entity, makeAccount, putTestAccountDelta } from '../../helpers/cross-j';

const left = entity('11');
const right = entity('22');
const inputFor = (delta: Delta, isLeft = true) => {
  const account = makeAccount(left, right);
  putTestAccountDelta(account, delta);
  return {
    account: account.state,
    ownerEntityId: isLeft ? left : right,
    counterpartyEntityId: isLeft ? right : left,
    tokenId: 1,
  };
};
const receive = (delta: Delta, isLeft = true) => ({
  ...inputFor(delta, isLeft),
  requiredInboundAmount: 700n,
  collateralPercent: 0,
  creditBufferBps: 1000 as const,
  allowOpenAccount: false,
});

describe('receive-only capacity spectrum', () => {
  test('buffers the entire required limit without compounding repeated plans or a committed grant', () => {
    for (const isLeft of [true, false]) {
      const limitKey = isLeft ? 'rightCreditLimit' : 'leftCreditLimit';
      const delta = { ...createDefaultDelta(1), [limitKey]: 100n };
      const input = { ...receive(delta, isLeft), requiredInboundAmount: 150n };
      const plan = planReceiveCapacity(input);
      expect(plan).toMatchObject({
        status: 'credit',
        requiredPeerCreditLimit: 165n,
        creditIncrease: 65n,
        creditBuffer: 15n,
        requestedCreditBuffer: 15n,
      });
      expect(planReceiveCapacity(input)).toEqual(plan);
      expect(delta[limitKey]).toBe(100n);
      expect(planReceiveCapacity({ ...input, creditBufferBps: 0 })).toMatchObject({
        requiredPeerCreditLimit: 150n,
        creditIncrease: 50n,
        creditBuffer: 0n,
      });
      expect(planReceiveCapacity({ ...input, requiredInboundAmount: 101n })).toMatchObject({
        requiredPeerCreditLimit: 112n,
        creditIncrease: 12n,
        creditBuffer: 11n,
      });
      expect(planReceiveCapacity({ ...input, collateralPercent: 100 })).toMatchObject({
        status: 'collateral-unavailable',
        collateralRequired: 50n,
        requiredPeerCreditLimit: null,
        creditIncrease: 0n,
        creditBuffer: 0n,
        setupTxs: [],
      });
      expect(
        planReceiveCapacity({
          ...receive({ ...delta, [limitKey]: 165n }, isLeft),
          requiredInboundAmount: 150n,
        }),
      ).toMatchObject({ status: 'ready', creditIncrease: 0n, creditBuffer: 0n, setupTxs: [] });
    }
  });

  test('preserves the required grant and trims only optional buffer at the uint256 representation edge', () => {
    const maximum = UINT256_MAX;
    for (const isLeft of [true, false]) {
      const delta = createDefaultDelta(1);
      if (isLeft) {
        delta.rightCreditLimit = maximum - 1n;
        delta.rightHold = maximum - 1n;
      } else {
        delta.leftCreditLimit = maximum - 1n;
        delta.leftHold = maximum - 1n;
      }
      const input = { ...receive(delta, isLeft), requiredInboundAmount: 1n };
      expect(planReceiveCapacity(input)).toMatchObject({
        status: 'credit',
        maximumPeerCreditLimit: maximum,
        requiredPeerCreditLimit: maximum,
        creditIncrease: 1n,
        creditBuffer: 0n,
        requestedCreditBuffer: (maximum + 9n) / 10n,
      });
      const withoutBuffer = planReceiveCapacity({ ...input, creditBufferBps: 0 });
      expect(withoutBuffer.status).toBe('credit');
      expect(withoutBuffer.requiredPeerCreditLimit).toBe(maximum);
      expect(withoutBuffer.setupTxs).toEqual([
        {
          type: 'extendCredit',
          data: { counterpartyEntityId: isLeft ? right : left, tokenId: 1, amount: maximum },
        },
      ]);
      expect(planReceiveCapacity({ ...input, requiredInboundAmount: 2n, creditBufferBps: 0 })).toMatchObject({
        status: 'credit-unavailable',
        requiredPeerCreditLimit: maximum + 1n,
        setupTxs: [],
      });
    }
  });

  test('keeps the full 10 percent buffer when the grant crosses the retired protocol ceiling', () => {
    const retiredMaximum = ((1n << 128n) - 1n) * 1000n;
    const totalLimitBuffer = (retiredMaximum + 10n + 9n) / 10n;
    const delta = { ...createDefaultDelta(1), rightCreditLimit: retiredMaximum, rightHold: retiredMaximum };
    expect(planReceiveCapacity({ ...receive(delta), requiredInboundAmount: 10n })).toMatchObject({
      status: 'credit',
      requiredPeerCreditLimit: retiredMaximum + 10n + totalLimitBuffer,
      creditIncrease: 10n + totalLimitBuffer,
      creditBuffer: totalLimitBuffer,
      requestedCreditBuffer: totalLimitBuffer,
    });
  });

  test('buffers the full permanent limit including existing debt and holds for both Account perspectives', () => {
    for (const isLeft of [true, false]) {
      const delta = { ...createDefaultDelta(1), offdelta: isLeft ? 200n : -200n };
      if (isLeft) {
        delta.rightCreditLimit = 500n;
        delta.rightHold = 50n;
      } else {
        delta.leftCreditLimit = 500n;
        delta.leftHold = 50n;
      }
      const plan = planReceiveCapacity(receive(delta, isLeft));
      expect(plan.status).toBe('credit');
      expect(plan.shortfall).toBe(450n);
      expect(plan.creditBuffer).toBe(95n);
      expect(plan.creditIncrease).toBe(545n);
      expect(plan.requiredPeerCreditLimit).toBe(1045n);
      expect(plan.setupTxs).toEqual([
        {
          type: 'extendCredit',
          data: { counterpartyEntityId: isLeft ? right : left, tokenId: 1, amount: 1045n },
        },
      ]);
    }
  });

  test('100% collateral cannot silently restore revoked credit or submit an incomplete mixed plan', () => {
    const delta = { ...createDefaultDelta(1), offdelta: 500n, rightCreditLimit: 100n, rightHold: 50n };
    const allCollateral = planReceiveCapacity({ ...receive(delta), collateralPercent: 100 });
    expect(allCollateral.status).toBe('collateral-unavailable');
    expect(allCollateral.collateralRequired).toBe(700n);
    expect(allCollateral.creditIncrease).toBe(0n);
    expect(allCollateral.creditBuffer).toBe(0n);
    expect(allCollateral.requiredPeerCreditLimit).toBeNull();
    expect(allCollateral.setupTxs).toEqual([]);
    const mixed = planReceiveCapacity({ ...receive(delta), collateralPercent: 50 });
    expect(mixed.collateralRequired).toBe(350n);
    expect(mixed.collateralSupported).toBe(false);
    expect(mixed.collateralUnsupportedReason).toBe('FUTURE_INBOUND_COLLATERAL_UNSUPPORTED');
    expect(mixed.setupTxs).toEqual([]);
  });

  test('retains debt above an existing grant and capacity hidden by allowances and holds', () => {
    const delta = {
      ...createDefaultDelta(1),
      offdelta: 500n,
      rightCreditLimit: 100n,
      rightHold: 50n,
      rightAllowance: 20n,
    };
    const plan = planReceiveCapacity({ ...receive(delta), requiredInboundAmount: 100n });
    expect(plan.currentInboundCapacity).toBe(0n);
    expect(plan.shortfall).toBe(100n);
    expect(plan.creditIncrease - plan.creditBuffer).toBe(570n);
    expect(plan.requiredPeerCreditLimit).toBe(737n);
    expect(deriveDelta({ ...delta, rightCreditLimit: 737n }, true).inCapacity).toBe(167n);
  });

  test('rounds collateral and total-limit buffer up only when new credit is needed', () => {
    const input = { ...receive(createDefaultDelta(1)), requiredInboundAmount: 101n };
    const mixed = planReceiveCapacity({ ...input, collateralPercent: 50 });
    expect(mixed.collateralRequired).toBe(51n);
    expect(mixed.creditIncrease).toBe(55n);
    expect(mixed.creditBuffer).toBe(5n);
    const smallest = planReceiveCapacity({ ...input, requiredInboundAmount: 1n });
    expect(smallest.creditIncrease).toBe(2n);
    expect(smallest.creditBuffer).toBe(1n);
    const noCredit = planReceiveCapacity({ ...input, requiredInboundAmount: 1n, collateralPercent: 50 });
    expect(noCredit.creditIncrease).toBe(0n);
  });

  test('does not change an existing grant or reserve collateral when no capacity is missing', () => {
    const delta = { ...createDefaultDelta(1), rightCreditLimit: 1_000n };
    for (const collateralPercent of [0, 50, 100]) {
      const plan = planReceiveCapacity({ ...receive(delta), collateralPercent });
      expect(plan.status).toBe('ready');
      expect(plan.shortfall).toBe(0n);
      expect(plan.collateralRequired).toBe(0n);
      expect(plan.creditIncrease).toBe(0n);
      expect(plan.requiredPeerCreditLimit).toBeNull();
      expect(plan.setupTxs).toEqual([]);
    }
  });

  test('rejects invalid choices and an absent Account without implicit opening', () => {
    const input = receive(createDefaultDelta(1));
    for (const collateralPercent of [-1, 101, 1.5, NaN]) {
      expect(() => planReceiveCapacity({ ...input, collateralPercent })).toThrow('RECEIVE_CAPACITY_PERCENT_INVALID');
    }
    expect(() => planReceiveCapacity({ ...input, account: null })).toThrow('RECEIVE_CAPACITY_ACCOUNT_MISSING');
    expect(() => planReceiveCapacity({ ...input, requiredInboundAmount: 0n })).toThrow(
      'RECEIVE_CAPACITY_AMOUNT_INVALID',
    );
    expect(() => planReceiveCapacity({ ...input, ownerEntityId: entity('33') })).toThrow(
      'ACCOUNT_CAPACITY_PARTIES_INVALID',
    );
  });
});

describe('own collateral funding before an outbound payment', () => {
  test('includes debt repayment above the peer grant before the payment can use the deposit', () => {
    for (const isLeft of [true, false]) {
      const delta = { ...createDefaultDelta(1), offdelta: isLeft ? -500n : 500n };
      if (isLeft) {
        delta.leftCreditLimit = 100n;
        delta.leftHold = 30n;
        delta.leftAllowance = 20n;
      } else {
        delta.rightCreditLimit = 100n;
        delta.rightHold = 30n;
        delta.rightAllowance = 20n;
      }
      const plan = planAccountFunding({ ...inputFor(delta, isLeft), requiredOutboundAmount: 100n });
      expect(plan.currentOutboundCapacity).toBe(0n);
      expect(plan.requiredDeposit).toBe(550n);
    }
  });

  test('returns the minimum own allocation that meets deriveDelta capacity across debt, holds and perspectives', () => {
    for (const isLeft of [true, false]) {
      for (const offdelta of [-500n, -100n, 0n, 100n, 500n]) {
        for (const collateral of [0n, 200n]) {
          for (const hold of [0n, 400n]) {
            const delta = {
              ...createDefaultDelta(1),
              offdelta,
              collateral,
              leftCreditLimit: 150n,
              rightCreditLimit: 250n,
              leftHold: hold,
              rightHold: hold,
              leftAllowance: 10n,
              rightAllowance: 20n,
            };
            const plan = planAccountFunding({ ...inputFor(delta, isLeft), requiredOutboundAmount: 200n });
            const deposited = (amount: bigint): Delta => ({
              ...delta,
              collateral: collateral + amount,
              ondelta: delta.ondelta + (isLeft ? amount : 0n),
            });
            expect(deriveDelta(deposited(plan.requiredDeposit), isLeft).outCapacity).toBeGreaterThanOrEqual(200n);
            if (plan.requiredDeposit > 0n) {
              expect(deriveDelta(deposited(plan.requiredDeposit - 1n), isLeft).outCapacity).toBeLessThan(200n);
            }
          }
        }
      }
    }
  });

  test('reports sufficient capacity and inactive token funding without granting credit', () => {
    const input = inputFor({ ...createDefaultDelta(1), collateral: 600n, ondelta: 600n });
    expect(planAccountFunding({ ...input, requiredOutboundAmount: 500n }).requiredDeposit).toBe(0n);
    const inactive = planAccountFunding({ ...input, tokenId: 2, requiredOutboundAmount: 500n });
    expect(inactive.tokenActive).toBe(false);
    expect(inactive.requiredDeposit).toBe(500n);
  });
});
