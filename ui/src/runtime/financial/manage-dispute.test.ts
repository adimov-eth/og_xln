import { expect, test } from 'bun:test';
import { disputeView } from './manage';

const LEFT = `0x${'11'.repeat(32)}`;
const RIGHT = `0x${'22'.repeat(32)}`;
const OTHER = `0x${'33'.repeat(32)}`;
type DisputeDoc = NonNullable<Parameters<typeof disputeView>[0]>;
const account = (status: DisputeDoc['status']): DisputeDoc => ({
  status,
  state: { leftEntity: LEFT, rightEntity: RIGHT },
});
const placeholder: NonNullable<DisputeDoc['activeDispute']> = {
  startedByLeft: true,
  initialProofbodyHash: `0x${'44'.repeat(32)}`,
  initialNonce: 1,
  initialProposerIsLeft: true,
  disputeTimeout: 0,
  jNonce: 0,
  starterCounterProofCommitment: `0x${'00'.repeat(32)}`,
  observedOnChain: false,
  finalizeQueued: false,
};

test('finalized dispute stays closed when finality clears activeDispute but retains disputed status', () => {
  const finalized = account('disputed');
  const view = disputeView(finalized, true);
  expect(view.phase).toBe('closed');
  expect(view.timeout).toBe(0);
  expect(view.finalizeQueued).toBe(false);
  expect(finalized.status).toBe('disputed');
  expect(disputeView(finalized, false).phase).toBe('closed');
  expect(disputeView(finalized, true, { disputeStarts: [{ counterentity: OTHER }] }).phase).toBe('closed');
});

test('dispute lifecycle distinguishes preparation, its own batch, pending observation and the real response window', () => {
  expect(disputeView(account('active'), true).phase).toBe('none');
  const preparing = {
    ...account('dispute_preparing'),
    disputePrepare: { startedAt: 1_000, readyAfter: 2_000, reason: 'user requested dispute' },
  };
  expect(disputeView(preparing, true).phase).toBe('preparing');
  expect(disputeView(preparing, true).reason).toBe('user requested dispute');
  const pending = { ...account('disputed'), activeDispute: placeholder };
  expect(disputeView(pending, true).phase).toBe('sent');
  expect(disputeView(pending, true).observedOnChain).toBe(false);
  expect(disputeView(pending, true, { disputeStarts: [{ counterentity: OTHER }] }).phase).toBe('sent');
  expect(disputeView(pending, true, { disputeStarts: [{ counterentity: RIGHT }] }).phase).toBe('queued');
  expect(disputeView(pending, false, { disputeStarts: [{ counterentity: LEFT }] }).phase).toBe('queued');
  const observed = {
    ...pending,
    activeDispute: { ...placeholder, observedOnChain: true, disputeTimeout: 120, finalizeQueued: true },
  };
  expect(disputeView(observed, true)).toEqual({
    phase: 'active', startedByUs: true, timeout: 120, observedOnChain: true, finalizeQueued: true, reason: '',
  });
  expect(disputeView(observed, false).startedByUs).toBe(false);
});
