import { describe, expect, test } from 'bun:test';

import { planReceiveCapacity, readAccountCapacity } from '../../../account/capacity-plan';
import type { AccountState, Delta } from '../../../types/account';
import { makeAccount } from '../../helpers/cross-j';
import { PersistentAccountStateMap } from '../../../account/state/persistent-state-map';

const left = `0x${'11'.repeat(32)}`;
const right = `0x${'22'.repeat(32)}`;

const delta = (overrides: Partial<Delta> = {}): Delta => ({
  tokenId: 1,
  collateral: 0n,
  ondelta: 0n,
  offdelta: 0n,
  leftCreditLimit: 0n,
  rightCreditLimit: 0n,
  leftAllowance: 0n,
  rightAllowance: 0n,
  leftHold: 0n,
  rightHold: 0n,
  ...overrides,
});

const account = (tokenDelta?: Delta): AccountState => {
  const replica = makeAccount(left, right);
  replica.state.deltas = PersistentAccountStateMap.fromEntries(
    'deltas',
    tokenDelta ? [[tokenDelta.tokenId, tokenDelta]] : [],
  );
  return replica.state;
};

describe('swap inbound capacity planner', () => {
  test('exposes canonical capacity without leaking deriveDelta into UI', () => {
    expect(
      readAccountCapacity({
        account: account(
          delta({
            rightCreditLimit: 500n,
            offdelta: 200n,
            rightHold: 50n,
          }),
        ),
        ownerEntityId: left,
        counterpartyEntityId: right,
        tokenId: 1,
      }),
    ).toEqual({
      accountExists: true,
      tokenActive: true,
      inCapacity: 250n,
      outCapacity: 200n,
      peerCreditLimit: 500n,
    });
  });

  test('opens a missing account with exactly the required credit and no floor', () => {
    const plan = planReceiveCapacity({
      account: null,
      ownerEntityId: left,
      counterpartyEntityId: right,
      tokenId: 1,
      requiredInboundAmount: 12_345n,
      collateralPercent: 0,
      creditBufferBps: 0,
      allowOpenAccount: true,
      newAccountDisputeConfig: { leftResponseSeconds: 10, rightResponseSeconds: 20 },
    });

    expect(plan.requiredPeerCreditLimit).toBe(12_345n);
    expect(plan.creditIncrease).toBe(12_345n);
    expect(plan.setupTxs).toEqual([
      {
        type: 'openAccount',
        data: {
          targetEntityId: right,
          disputeConfig: { leftResponseSeconds: 10, rightResponseSeconds: 20 },
          tokenId: 1,
          creditAmount: 12_345n,
        },
      },
    ]);
  });

  test('uses canonical deriveDelta fields for an exact existing-account increase', () => {
    const plan = planReceiveCapacity({
      account: account(
        delta({
          rightCreditLimit: 500n,
          offdelta: 200n,
          rightHold: 50n,
        }),
      ),
      ownerEntityId: left,
      counterpartyEntityId: right,
      tokenId: 1,
      requiredInboundAmount: 700n,
      collateralPercent: 0,
      creditBufferBps: 0,
      allowOpenAccount: false,
    });

    expect(plan.currentInboundCapacity).toBe(250n);
    expect(plan.currentPeerCreditLimit).toBe(500n);
    expect(plan.requiredPeerCreditLimit).toBe(950n);
    expect(plan.creditIncrease).toBe(450n);
    expect(plan.setupTxs).toEqual([
      {
        type: 'extendCredit',
        data: { counterpartyEntityId: right, tokenId: 1, amount: 950n },
      },
    ]);
  });

  test('emits no transaction when canonical inbound capacity is sufficient', () => {
    const plan = planReceiveCapacity({
      account: account(delta({ rightCreditLimit: 1_000n })),
      ownerEntityId: left,
      counterpartyEntityId: right,
      tokenId: 1,
      requiredInboundAmount: 600n,
      collateralPercent: 0,
      creditBufferBps: 0,
      allowOpenAccount: false,
    });

    expect(plan.currentInboundCapacity).toBe(1_000n);
    expect(plan.requiredPeerCreditLimit).toBeNull();
    expect(plan.setupTxs).toEqual([]);
  });

  test('uses the mirrored credit field for the right entity perspective', () => {
    const plan = planReceiveCapacity({
      account: account(
        delta({
          leftCreditLimit: 500n,
          offdelta: -200n,
          leftHold: 50n,
        }),
      ),
      ownerEntityId: right,
      counterpartyEntityId: left,
      tokenId: 1,
      requiredInboundAmount: 700n,
      collateralPercent: 0,
      creditBufferBps: 0,
      allowOpenAccount: false,
    });

    expect(plan.currentInboundCapacity).toBe(250n);
    expect(plan.currentPeerCreditLimit).toBe(500n);
    expect(plan.requiredPeerCreditLimit).toBe(950n);
    expect(plan.setupTxs).toEqual([
      {
        type: 'extendCredit',
        data: { counterpartyEntityId: left, tokenId: 1, amount: 950n },
      },
    ]);
  });

  test('adds new inbound capacity above an already fully held credit window', () => {
    const plan = planReceiveCapacity({
      account: account(
        delta({
          rightCreditLimit: 24_900_000n,
          rightHold: 24_900_000n,
        }),
      ),
      ownerEntityId: left,
      counterpartyEntityId: right,
      tokenId: 1,
      requiredInboundAmount: 10_000_000n,
      collateralPercent: 0,
      creditBufferBps: 0,
      allowOpenAccount: false,
    });

    expect(plan.currentInboundCapacity).toBe(0n);
    expect(plan.requiredPeerCreditLimit).toBe(34_900_000n);
    expect(plan.creditIncrease).toBe(10_000_000n);
  });
});
