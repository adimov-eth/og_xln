/**
 * E2E payment coverage for the wallet UI, the counterpart of the SvelteKit
 * tests/e2e-payment.spec.ts.
 *
 * Flow:
 * 1. Enter a fresh wallet on the live stack and receive money from its hub.
 * 2. Read the rendered USDC position, open Pay, pick the merchant, pay 25 USDC.
 * 3. The receipt sheet appears only from the committed HtlcFinalized frame log.
 * 4. The rendered position drops by exactly the payment; Activity lists it.
 * 5. Reload: the persisted runtime restores the same rendered position.
 *
 * Actions use real UI controls; recovery also reads committed evidence through the wallet adapter.
 */
import { expect, test, type Page } from '@playwright/test';
import type { RuntimeAdapterViewFrame, XLNModule } from '../../core/api/public/runtime-module';
import type { RuntimeAdapter, RuntimeAdapterActivityPage } from '../../core/api/runtime-adapter/types';
import { safeStringify } from '../../core/protocol/serialization';
import { enterStack, fundFromHub, readWalletCheckpoint, reopenStack } from './stack';
import { readCommittedPayment } from './payment-evidence';

const PAYMENT_AMOUNT = '25';
const CONSENSUS_TIMEOUT = 15_000;

const parseMoney = (text: string): number => Number(text.replace(/[^0-9.\-−]/g, '').replace('−', '-'));

async function readUsdcNet(page: Page): Promise<number> {
  return parseMoney(await page.getByTestId('token-net-USDC').innerText());
}

/** Read the committed primary Account, independently of rounded screen text. */
async function readUsdcAccount(page: Page, entityId: string) {
  return page.evaluate(async owner => {
    const debug = (window as Window & {
      __xln?: { adapter: () => RuntimeAdapter | null; xln: () => Promise<XLNModule> };
    }).__xln;
    const adapter = debug?.adapter();
    if (!debug || !adapter) throw new Error('Payment diagnostics unavailable');
    const frame = await adapter.read<RuntimeAdapterViewFrame>('view-frame', { entityId: owner });
    const account = frame.activeEntity?.accounts.items[0];
    if (!account || frame.activeEntityId !== owner) throw new Error('Payment Account unavailable');
    const delta = account.state.deltas.get(1);
    if (!delta) throw new Error('Payment USDC lane unavailable');
    const xln = await debug.xln();
    const derived = xln.deriveDelta(delta, owner === account.state.leftEntity);
    return {
      owned: (derived.outCollateral + derived.outPeerCredit - derived.inOwnCredit).toString(),
      root: account.currentFrame.accountStateRoot,
      height: account.currentHeight,
      pending: Boolean(account.pendingFrame),
      mempool: account.mempoolCount,
    };
  }, entityId);
}

async function readPaymentStarts(page: Page, entityId: string) {
  return page.evaluate(async owner => {
    const adapter = (window as Window & { __xln?: { adapter: () => RuntimeAdapter | null } }).__xln?.adapter();
    if (!adapter) throw new Error('Payment Activity unavailable');
    const activity = await adapter.read<RuntimeAdapterActivityPage>('activity', {
      entityId: owner, types: ['payment', 'htlc'], limit: 100, scanLimit: 500,
    });
    if (activity.nextBeforeHeight !== null) throw new Error('Payment fixture exceeds Activity page');
    // Activity deliberately suppresses raw htlcPayment inputs: certified
    // lifecycle logs are its canonical payment evidence.
    return activity.events.filter(event => event.source === 'runtime_log' && event.rawType === 'HtlcInitiated' && event.direction === 'out');
  }, entityId);
}

test.describe('wallet UI payment', () => {
  test(
    'pays the merchant through the hub and shows the committed receipt',
    { tag: '@functional' },
    async ({ page }) => {
      test.setTimeout(50_000);
      const pageErrors: string[] = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') process.stdout.write(`[browser] ${message.text()}\n`);
      });
      page.on('response', response => {
        if (response.status() >= 400) process.stdout.write(`[http ${response.status()}] ${response.url()}\n`);
      });

      const wallet = await enterStack(page);
      await fundFromHub(page, '100');
      await expect.poll(async () => {
        const account = await readUsdcAccount(page, wallet.entityId);
        return { owned: account.owned, pending: account.pending, mempool: account.mempool };
      }, { timeout: CONSENSUS_TIMEOUT }).toEqual({ owned: '100000000', pending: false, mempool: 0 });
      await expect.poll(() => readUsdcNet(page), { timeout: CONSENSUS_TIMEOUT }).toBe(100);
      await page.screenshot({ path: 'tests/test-results/ui-home.png', fullPage: true });
      const netBefore = await readUsdcNet(page);
      const before = await readUsdcAccount(page, wallet.entityId);

      await page.getByTestId('home-pay').click();
      await page.getByTestId('pay-to').fill('H2');
      const submit = page.getByTestId('pay-submit');
      for (const amount of ['', '0', '-1', 'invalid', '101']) {
        await page.getByTestId('pay-amount').fill(amount);
        await expect(submit, `invalid or unfunded payment ${amount}`).toBeDisabled();
      }
      await page.getByTestId('pay-amount').fill(PAYMENT_AMOUNT);
      await page.getByTestId('pay-to').fill('unknown-recipient');
      await expect(submit).toBeDisabled();
      expect(await readUsdcAccount(page, wallet.entityId)).toEqual(before);
      await expect(page.getByTestId('payment-receipt')).toHaveCount(0);
      await page.getByTestId('pay-to').fill('H2');
      await expect(submit).toBeEnabled({ timeout: CONSENSUS_TIMEOUT });
      // Clearing a valid recipient must revoke its previously usable quote.
      await page.getByTestId('pay-to').fill('unknown-recipient');
      await expect(submit).toBeDisabled();
      await expect(page.getByTestId('pay-quote')).toHaveCount(0);
      expect(await readUsdcAccount(page, wallet.entityId)).toEqual(before);
      await page.getByTestId('pay-to').fill('H2');
      await expect(submit).toBeEnabled({ timeout: CONSENSUS_TIMEOUT });
      await expect(submit).toHaveText(new RegExp(`Pay ${PAYMENT_AMOUNT}\\.00 USDC`));
      await page.screenshot({ path: 'tests/test-results/ui-pay.png', fullPage: true });
      const quote = page.getByTestId('pay-quote');
      const senderText = await quote.getAttribute('data-sender-amount');
      const recipientText = await quote.getAttribute('data-recipient-amount');
      const feeText = await quote.getAttribute('data-fee-amount');
      if (!senderText || !recipientText || !feeText) throw new Error('Exact displayed payment quote unavailable');
      const senderAmount = BigInt(senderText);
      expect(BigInt(recipientText)).toBe(25_000_000n);
      expect(senderAmount).toBe(25_000_000n + BigInt(feeText));
      const fromHeight = (await readWalletCheckpoint(page)).frame.height;
      expect(await readPaymentStarts(page, wallet.entityId)).toHaveLength(0);
      // A rapid second click must not create a second payment.
      await submit.dblclick();

      const receipt = page.getByTestId('payment-receipt');
      await expect(receipt).toBeVisible({ timeout: CONSENSUS_TIMEOUT });
      await expect(receipt.getByTestId('receipt-kicker')).toHaveText('Paid');
      await expect(receipt.getByTestId('receipt-amount')).toContainText(`${PAYMENT_AMOUNT}.00`);
      await expect(receipt.getByTestId('receipt-title')).toContainText('H2');
      const committed = await readCommittedPayment(page, wallet.entityId, fromHeight);
      expect(committed.amount).toBe(recipientText);
      expect(BigInt(committed.senderAmount)).toBe(BigInt(committed.amount) + BigInt(committed.fee));
      // The submitted command authorizes maxSenderDebit; the signed initiation
      // records the exact debit recomputed at admission, which may be smaller.
      expect(BigInt(committed.senderAmount)).toBeLessThanOrEqual(senderAmount);
      const expectedOwned = (100_000_000n - BigInt(committed.senderAmount)).toString();
      await page.screenshot({ path: 'tests/test-results/ui-receipt.png', fullPage: true });
      await receipt.getByTestId('receipt-done').click();
      await expect(receipt).toHaveCount(0);

      await expect
        .poll(async () => readUsdcNet(page), { timeout: CONSENSUS_TIMEOUT })
        .toBeCloseTo(netBefore - Number(PAYMENT_AMOUNT), 2);
      const netAfter = await readUsdcNet(page);
      await expect.poll(async () => {
        const account = await readUsdcAccount(page, wallet.entityId);
        return { owned: account.owned, pending: account.pending, mempool: account.mempool };
      }).toEqual({ owned: expectedOwned, pending: false, mempool: 0 });
      await expect.poll(async () => (await readPaymentStarts(page, wallet.entityId)).length).toBe(1);
      const checkpoint = await readWalletCheckpoint(page);
      expect(checkpoint.accounts.every(account => !account.pending && account.mempool === 0)).toBe(true);

      // In-app navigation: a full page load would drop the embedded runtime.
      await page.getByRole('link', { name: 'Activity' }).first().click();
      await expect(page).toHaveURL(/\/activity$/);
      await expect(page.getByTestId('activity-row').filter({ hasText: 'H2' }).first()).toBeVisible({
        timeout: CONSENSUS_TIMEOUT,
      });
      await page.screenshot({ path: 'tests/test-results/ui-activity.png', fullPage: true });

      await page.reload({ waitUntil: 'domcontentloaded' });
      await reopenStack(page, wallet);
      const recovered = await readWalletCheckpoint(page, checkpoint.frame.height);
      expect(recovered.latestHeight).toBeGreaterThanOrEqual(checkpoint.latestHeight);
      expect(recovered.frame).toEqual(checkpoint.frame);
      expect(recovered.accounts).toEqual(checkpoint.accounts);
      const current = await readWalletCheckpoint(page);
      expect(
        current.accounts.map(account => ({
          leftEntity: account.leftEntity,
          rightEntity: account.rightEntity,
          balances: account.balances,
        })),
      ).toEqual(
        checkpoint.accounts.map(account => ({
          leftEntity: account.leftEntity,
          rightEntity: account.rightEntity,
          balances: account.balances,
        })),
      );
      await expect.poll(async () => readUsdcNet(page), { timeout: CONSENSUS_TIMEOUT }).toBeCloseTo(netAfter, 2);
      expect((await readUsdcAccount(page, wallet.entityId)).owned).toBe(expectedOwned);
      const payments = await readPaymentStarts(page, wallet.entityId);
      expect(payments).toHaveLength(1);
      expect(payments[0]?.amount).toBe('25000000');
      expect(payments[0]?.hash).toBe(committed.hashlock);
      await test.info().attach('single-payment-exact-debit', {
        body: safeStringify({ senderCeiling: senderText, recipientAmount: recipientText, feeCeiling: feeText, committed, expectedOwned, payments }),
        contentType: 'application/json',
      });
      await expect(page.getByTestId('payment-receipt')).toHaveCount(0);

      expect(pageErrors, 'no uncaught browser errors during the flow').toEqual([]);
    },
  );
});
