import { describe, expect, test } from 'bun:test';
import { handleHtlcLock } from '../../../account/tx/handlers/htlc/lock';
import { handleHtlcResolve } from '../../../account/tx/handlers/htlc/resolve';
import { handleDirectPayment } from '../../../account/tx/handlers/balance/direct-payment';
import {
  accountTransitionView,
  beginAccountTransition,
  discardAccountTransition,
} from '../../../account/state/candidate-overlay';
import { createDefaultDelta } from '../../../account/state/delta';
import { hashHtlcSecret } from '../../../protocol/htlc/utils';
import { INT256_MAX, INT256_MIN, INT512_MAX, INT512_MIN, UINT256_MAX } from '../../../protocol/boundary/integer-ranges';
import { entity, makeAccount, putTestAccountDelta } from '../../helpers/cross-j';

const left = entity('11');
const right = entity('22');
const funded = () => {
  const account = makeAccount(left, right);
  putTestAccountDelta(account, {
    ...createDefaultDelta(1),
    leftCreditLimit: UINT256_MAX,
    rightCreditLimit: UINT256_MAX,
  });
  return account;
};
const secret = entity('44');
const hashlock = hashHtlcSecret(secret);
const clock = { committedTimestamp: 1_000, enforcementTimestamp: 1_000, enforcementJHeight: 0 };
const lockTx = (amount: bigint) => ({
  type: 'htlc_lock' as const,
  data: { lockId: hashlock, hashlock, timelock: 60_000n, revealBeforeHeight: 10, amount, tokenId: 1 },
});

describe('conditional payment amounts use their exact signed ABI domain', () => {
  test('direct_payment rejects signed offdelta overflow before changing the candidate or emitting effects', () => {
    for (const senderIsLeft of [true, false]) {
      const account = funded();
      const offdelta = senderIsLeft ? INT512_MIN : INT512_MAX;
      const before = {
        ...createDefaultDelta(1),
        offdelta,
        ondelta: senderIsLeft ? INT512_MAX : INT512_MIN,
        leftCreditLimit: UINT256_MAX,
        rightCreditLimit: UINT256_MAX,
      };
      putTestAccountDelta(account, before);
      const transition = beginAccountTransition(account);
      const draft = accountTransitionView(transition);
      const result = handleDirectPayment(
        draft,
        {
          type: 'direct_payment',
          data: { tokenId: 1, amount: 1n, route: [senderIsLeft ? right : left], deliveryMode: 'direct' },
        },
        senderIsLeft,
      );
      expect(result.ok).toBe(false);
      expect(draft.state.deltas.get(1)).toEqual(before);
      expect(result.events).toEqual([]);
      expect(result.candidateEffects ?? []).toEqual([]);
      discardAccountTransition(transition);
    }
  });

  test('direct_payment accepts a uint256 movement whose existing exposure cancels into signed range', () => {
    for (const senderIsLeft of [true, false]) {
      const account = funded();
      const offdelta = senderIsLeft ? INT256_MAX : INT256_MIN;
      putTestAccountDelta(account, {
        ...createDefaultDelta(1),
        offdelta,
        leftCreditLimit: UINT256_MAX,
        rightCreditLimit: UINT256_MAX,
      });
      const transition = beginAccountTransition(account);
      const draft = accountTransitionView(transition);
      const result = handleDirectPayment(
        draft,
        {
          type: 'direct_payment',
          data: { tokenId: 1, amount: UINT256_MAX, route: [senderIsLeft ? right : left], deliveryMode: 'direct' },
        },
        senderIsLeft,
      );
      expect(result.ok).toBe(true);
      expect(draft.state.deltas.get(1)?.offdelta).toBe(senderIsLeft ? INT256_MIN : INT256_MAX);
      discardAccountTransition(transition);
    }
  });

  test('htlc_lock and htlc_resolve transfer the full uint256 magnitude in both directions', async () => {
    const amount = UINT256_MAX;
    for (const senderIsLeft of [true, false]) {
      const transition = beginAccountTransition(funded());
      const draft = accountTransitionView(transition);
      expect((await handleHtlcLock(draft, lockTx(amount), senderIsLeft, clock)).ok).toBe(true);
      const result = await handleHtlcResolve(
        draft.state,
        {
          type: 'htlc_resolve',
          data: { lockId: hashlock, outcome: 'secret', secret },
        },
        !senderIsLeft,
        1,
        1_000,
      );
      expect(result.ok).toBe(true);
      expect(draft.state.deltas.get(1)?.offdelta).toBe(senderIsLeft ? -amount : amount);
      expect(draft.state.locks.size).toBe(0);
      expect(draft.state.deltas.get(1)?.leftHold).toBe(0n);
      expect(draft.state.deltas.get(1)?.rightHold).toBe(0n);
      discardAccountTransition(transition);
    }
  });

  test('htlc_lock rejects an independently overflowing claim before reserving its hold', async () => {
    for (const senderIsLeft of [true, false]) {
      const account = funded();
      putTestAccountDelta(account, {
        ...createDefaultDelta(1),
        offdelta: senderIsLeft ? INT512_MIN : INT512_MAX,
        ondelta: senderIsLeft ? INT512_MAX : INT512_MIN,
        leftCreditLimit: UINT256_MAX,
        rightCreditLimit: UINT256_MAX,
      });
      const transition = beginAccountTransition(account);
      const draft = accountTransitionView(transition);
      const beforeDelta = draft.state.deltas.get(1);
      const result = await handleHtlcLock(draft, lockTx(1n), senderIsLeft, clock);
      expect(result.ok).toBe(false);
      expect(draft.state.deltas.get(1)).toEqual(beforeDelta);
      expect(draft.state.locks.size).toBe(0);
      discardAccountTransition(transition);
    }
  });

  test('htlc_lock reserves signed headroom from direct_payment and htlc_resolve consumes its own reservation once', async () => {
    for (const senderIsLeft of [true, false]) {
      const account = funded();
      putTestAccountDelta(account, {
        ...createDefaultDelta(1),
        offdelta: senderIsLeft ? INT512_MIN + 1n : INT512_MAX - 1n,
        ondelta: senderIsLeft ? INT512_MAX : INT512_MIN,
        leftCreditLimit: UINT256_MAX,
        rightCreditLimit: UINT256_MAX,
      });
      const transition = beginAccountTransition(account);
      const draft = accountTransitionView(transition);
      expect((await handleHtlcLock(draft, lockTx(1n), senderIsLeft, clock)).ok).toBe(true);
      const beforeDelta = draft.state.deltas.get(1);
      const beforeLock = draft.state.locks.get(hashlock);
      const payment = handleDirectPayment(
        draft,
        {
          type: 'direct_payment',
          data: { tokenId: 1, amount: 1n, route: [senderIsLeft ? right : left], deliveryMode: 'direct' },
        },
        senderIsLeft,
      );
      expect(payment.ok).toBe(false);
      expect(draft.state.deltas.get(1)).toEqual(beforeDelta);
      expect(draft.state.locks.get(hashlock)).toEqual(beforeLock);
      expect(payment.events).toEqual([]);
      expect(payment.candidateEffects ?? []).toEqual([]);
      const result = await handleHtlcResolve(
        draft.state,
        {
          type: 'htlc_resolve',
          data: { lockId: hashlock, outcome: 'secret', secret },
        },
        !senderIsLeft,
        1,
        1_000,
      );
      expect(result.ok).toBe(true);
      expect(draft.state.deltas.get(1)?.offdelta).toBe(senderIsLeft ? INT512_MIN : INT512_MAX);
      expect(draft.state.deltas.get(1)?.leftHold).toBe(0n);
      expect(draft.state.deltas.get(1)?.rightHold).toBe(0n);
      expect(draft.state.locks.size).toBe(0);
      discardAccountTransition(transition);
    }
  });

  test('htlc_lock rejects a magnitude outside the actual uint256 asset representation', async () => {
    for (const senderIsLeft of [true, false]) {
      const transition = beginAccountTransition(funded());
      const draft = accountTransitionView(transition);
      const maximum = UINT256_MAX;
      expect((await handleHtlcLock(draft, lockTx(maximum + 1n), senderIsLeft, clock)).ok).toBe(false);
      expect(draft.state.locks.size).toBe(0);
      expect(draft.state.deltas.get(1)?.leftHold).toBe(0n);
      expect(draft.state.deltas.get(1)?.rightHold).toBe(0n);
      discardAccountTransition(transition);
    }
  });

  test('htlc_lock never nets independently revealed opposite-direction claims', async () => {
    for (const senderIsLeft of [true, false]) {
      const account = funded();
      putTestAccountDelta(account, {
        ...createDefaultDelta(1),
        offdelta: senderIsLeft ? INT512_MIN : INT512_MAX,
        ondelta: senderIsLeft ? INT512_MAX : INT512_MIN,
        leftCreditLimit: UINT256_MAX,
        rightCreditLimit: UINT256_MAX,
      });
      const transition = beginAccountTransition(account);
      const draft = accountTransitionView(transition);
      expect((await handleHtlcLock(draft, lockTx(1n), !senderIsLeft, clock)).ok).toBe(true);
      const beforeDelta = draft.state.deltas.get(1);
      const otherHash = hashHtlcSecret(entity('55'));
      const result = await handleHtlcLock(
        draft,
        {
          ...lockTx(1n),
          data: { ...lockTx(1n).data, lockId: otherHash, hashlock: otherHash },
        },
        senderIsLeft,
        clock,
      );
      expect(result.ok).toBe(false);
      expect(draft.state.deltas.get(1)).toEqual(beforeDelta);
      expect(draft.state.locks.size).toBe(1);
      discardAccountTransition(transition);
    }
  });

  test('htlc_lock does not reinterpret unrelated settlement holds as future HTLC movements', async () => {
    const account = funded();
    putTestAccountDelta(account, {
      ...createDefaultDelta(1),
      offdelta: INT256_MIN,
      leftHold: 1n,
      leftCreditLimit: UINT256_MAX,
      rightCreditLimit: UINT256_MAX,
    });
    const transition = beginAccountTransition(account);
    const draft = accountTransitionView(transition);
    expect((await handleHtlcLock(draft, lockTx(1n), false, clock)).ok).toBe(true);
    expect(draft.state.deltas.get(1)?.leftHold).toBe(1n);
    expect(draft.state.deltas.get(1)?.rightHold).toBe(1n);
    discardAccountTransition(transition);
  });

  test('htlc_resolve timeout releases the exact reservation for a later direct_payment', async () => {
    const account = funded();
    putTestAccountDelta(account, {
      ...createDefaultDelta(1),
      offdelta: INT256_MAX - 1n,
      rightCreditLimit: UINT256_MAX,
    });
    const transition = beginAccountTransition(account);
    const draft = accountTransitionView(transition);
    expect((await handleHtlcLock(draft, lockTx(1n), false, clock)).ok).toBe(true);
    expect(
      (
        await handleHtlcResolve(
          draft.state,
          {
            type: 'htlc_resolve',
            data: { lockId: hashlock, outcome: 'error', reason: 'timeout' },
          },
          false,
          10,
          60_000,
        )
      ).ok,
    ).toBe(true);
    expect(
      handleDirectPayment(
        draft,
        {
          type: 'direct_payment',
          data: { tokenId: 1, amount: 1n, route: [left], deliveryMode: 'direct' },
        },
        false,
      ).ok,
    ).toBe(true);
    expect(draft.state.deltas.get(1)?.offdelta).toBe(INT256_MAX);
    expect(draft.state.locks.size).toBe(0);
    discardAccountTransition(transition);
  });
});
