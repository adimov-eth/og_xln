import { expect, test, type Page } from '@playwright/test';
import { HDNodeWallet } from 'ethers';
import type { RuntimeAdapterViewFrame, XLNModule } from '../../core/api/public/runtime-module';
import type { RuntimeAdapterFrameSummary } from '../../core/api/runtime-adapter/resolve';
import type { RuntimeAdapter } from '../../core/api/runtime-adapter/types';
import { generateLazyEntityId } from '../../core/entity/factory';
import { isLeftEntity } from '../../core/protocol/identity/entity-id';
import { safeStringify } from '../../core/protocol/serialization';
import { deriveAddress } from '../src/runtime/keys';
import { enterStack } from './stack';

type DebugWindow = Window & {
  __xln?: {
    adapter: () => RuntimeAdapter | null;
    xln: () => Promise<XLNModule>;
    store: { getState: () => { activeEntityId: string | null } };
  };
};

/** Choose the side before import; no financial state or running wallet is changed to arrange the case. */
async function walletForSide(page: Page, isLeft: boolean) {
  const response = await page.request.get('/api/hubs');
  expect(response.ok(), await response.text()).toBe(true);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !('hubs' in payload) || !Array.isArray(payload.hubs))
    throw new Error('Move fixture hub catalogue unavailable');
  const hub: unknown = payload.hubs.find(row => row && typeof row.entityId === 'string' && row.online !== false);
  if (!hub || typeof hub !== 'object' || !('entityId' in hub) || typeof hub.entityId !== 'string')
    throw new Error('Move fixture has no online hub');
  const hubId = hub.entityId.toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(hubId)) throw new Error('Move fixture hub identity is invalid');
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const phrase = HDNodeWallet.createRandom().mnemonic?.phrase;
    if (!phrase) throw new Error('Move fixture mnemonic unavailable');
    const entityId = generateLazyEntityId([deriveAddress(phrase, 0)], 1n).toLowerCase();
    if (entityId !== hubId && isLeftEntity(entityId, hubId) === isLeft) return { phrase, entityId, hubId };
  }
  throw new Error(`Move fixture could not choose ${isLeft ? 'LEFT' : 'RIGHT'} of ${hubId}`);
}

/** Read the same committed frame as Home; funding and movement use only real UI actions. */
const readMoveState = (page: Page, hubId: string) =>
  page.evaluate(async counterpartyId => {
    const debug = (window as DebugWindow).__xln;
    if (!debug) throw new Error('Wallet diagnostics unavailable');
    const adapter = debug.adapter();
    const entityId = debug.store.getState().activeEntityId;
    if (!adapter || !entityId) throw new Error('Wallet owner unavailable');
    const frame = await adapter.read<RuntimeAdapterViewFrame>('view-frame', { entityId, accountId: counterpartyId });
    const active = frame.activeEntity;
    if (!active || frame.activeEntityId !== entityId) throw new Error('Move snapshot owner unavailable');
    const account = active.accounts.items.find(item =>
      item.state.leftEntity === counterpartyId || item.state.rightEntity === counterpartyId,
    );
    if (!account) throw new Error('Move Account unavailable');
    const delta = account.state.deltas.get(1);
    if (!delta) throw new Error('Move USDC delta unavailable');
    const xln = await debug.xln();
    const isLeft = xln.isLeftEntity(entityId, counterpartyId);
    const derived = xln.deriveDelta(delta, isLeft);
    const ownValue = derived.outCollateral + derived.outPeerCredit - derived.inOwnCredit;
    const reserve = active.core.reserves.get(1) ?? 0n;
    const batch = active.core.jBatchState;
    const committed = await adapter.read<RuntimeAdapterFrameSummary>(`frame/${frame.height}`);
    return {
      isLeft,
      runtimeHeight: frame.height,
      runtimeRoot: committed.postStateHash,
      accountHeight: account.currentHeight,
      accountRoot: account.currentFrame.accountStateRoot,
      reserve: reserve.toString(),
      collateral: delta.collateral.toString(),
      offdelta: delta.offdelta.toString(),
      ownValue: ownValue.toString(),
      combinedOwned: (reserve + ownValue).toString(),
      pending: Boolean(account.pendingFrame),
      mempool: account.mempoolCount,
      batch: {
        // JBatch operation arrays must all be empty, including unrelated draft operations.
        draftOperations: batch ? Object.values(batch.batch).filter(Array.isArray).reduce((sum, rows) => sum + rows.length, 0) : 0,
        sent: Boolean(batch?.sentBatch),
      },
    };
  }, hubId);

for (const isLeft of [true, false]) {
test(`Move ${isLeft ? 'LEFT' : 'RIGHT'} refuses an unfunded reserve, then conserves 100 USDC through real on-chain collateral`, { tag: '@functional' }, async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') console.log(`BROWSER_ERROR: ${message.text().slice(0, 500)}`);
  });
  const selected = await walletForSide(page, isLeft);
  const wallet = await enterStack(page, selected.phrase);
  expect(wallet.entityId).toBe(selected.entityId);
  await page.getByTestId('account-row').first().click();
  const hubId = new URL(page.url()).pathname.split('/accounts/')[1];
  if (!hubId || !/^0x[0-9a-f]{64}$/.test(hubId)) throw new Error('Expected the fresh wallet hub Account');
  expect(hubId).toBe(selected.hubId);
  await page.getByTestId('back').click();
  await expect.poll(async () => {
    const state = await readMoveState(page, hubId);
    return { pending: state.pending, mempool: state.mempool };
  }, { timeout: 15_000 }).toEqual({ pending: false, mempool: 0 });
  const unfunded = await readMoveState(page, hubId);
  expect(unfunded.isLeft).toBe(isLeft);
  expect(unfunded.reserve).toBe('0');
  expect(unfunded.ownValue).toBe('0');
  expect(unfunded.batch).toEqual({ draftOperations: 0, sent: false });
  console.log(`MOVE_OWNER isLeft=${unfunded.isLeft} hub=${hubId}`);
  await page.getByTestId('home-move').click();
  await page.getByTestId('move-from-reserve').click();
  await page.getByTestId('move-to-account').click();
  await page.getByTestId('move-amount').fill('100');
  await expect(page.getByTestId('move-now')).toBeDisabled();
  await expect(page.getByTestId('move-draft')).toBeDisabled();
  await expect(page.getByText('Amount exceeds what is available here', { exact: true })).toBeVisible();
  const refused = await readMoveState(page, hubId);
  expect(refused.accountRoot).toBe(unfunded.accountRoot);
  expect(refused.accountHeight).toBe(unfunded.accountHeight);
  expect(refused.reserve).toBe(unfunded.reserve);
  expect(refused.collateral).toBe(unfunded.collateral);
  expect(refused.ownValue).toBe(unfunded.ownValue);
  expect(refused.batch).toEqual(unfunded.batch);

  await page.getByTestId('nav-manage').locator('visible=true').first().click();
  await page.getByTestId('manage-assets').click();
  await page.getByTestId('faucet-amount').fill('0.1');
  const gasResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/faucet/gas' && response.request().method() === 'POST');
  await page.getByTestId('faucet-gas').click();
  const gas = await gasResponse;
  expect(gas.ok(), await gas.text()).toBe(true);
  await expect(page.getByTestId('faucet-gas')).toBeEnabled({ timeout: 15_000 });
  await page.getByTestId('faucet-amount').fill('100');
  const reserveResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/faucet/reserve' && response.request().method() === 'POST');
  await page.getByTestId('faucet-reserve').click();
  const reserve = await reserveResponse;
  expect(reserve.ok(), await reserve.text()).toBe(true);
  await expect.poll(async () => (await readMoveState(page, hubId)).reserve, { timeout: 15_000 }).toBe('100000000');
  await page.getByTestId('nav-home').locator('visible=true').first().click();
  await expect(page.getByTestId('token-net-USDC')).toHaveText('100.00');
  const before = await readMoveState(page, hubId);
  expect(before.ownValue).toBe('0');
  expect(before.batch).toEqual({ draftOperations: 0, sent: false });
  await page.getByTestId('home-move').click();
  await page.getByTestId('move-from-reserve').click();
  await page.getByTestId('move-to-account').click();
  await page.getByTestId('move-amount').fill('100');
  await expect(page.getByTestId('move-now')).toBeEnabled();
  await page.getByTestId('move-now').click();
  await expect(page.getByTestId('home-total')).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => {
    const state = await readMoveState(page, hubId);
    return {
      reserve: state.reserve,
      collateral: state.collateral,
      ownValue: state.ownValue,
      pending: state.pending,
      mempool: state.mempool,
      batch: state.batch,
    };
  }, { timeout: 15_000 }).toEqual({
    reserve: (BigInt(before.reserve) - 100_000_000n).toString(),
    collateral: (BigInt(before.collateral) + 100_000_000n).toString(),
    ownValue: (BigInt(before.ownValue) + 100_000_000n).toString(),
    pending: false,
    mempool: 0,
    batch: { draftOperations: 0, sent: false },
  });
  const after = await readMoveState(page, hubId);
  expect(after.combinedOwned).toBe(before.combinedOwned);
  expect(after.offdelta).toBe(before.offdelta);
  expect(after.runtimeHeight).toBeGreaterThan(before.runtimeHeight);
  expect(after.runtimeRoot).not.toBe(before.runtimeRoot);
  expect(after.accountHeight).toBeGreaterThan(before.accountHeight);
  expect(after.accountRoot).not.toBe(before.accountRoot);
  console.log(`MOVE_CONFIRMED ${safeStringify({ before, after })}`);
  await expect(page.getByTestId('pending-batch')).toHaveCount(0);
  await expect(page.getByTestId('token-net-USDC')).toHaveText('100.00');

  await page.getByTestId('account-row').first().click();
  await expect(page.locator('.kv').filter({ hasText: 'Collateral' }).first().locator('.v')).toHaveText('100.00');
  expect(pageErrors, 'no uncaught browser errors during the flow').toEqual([]);
});
}
