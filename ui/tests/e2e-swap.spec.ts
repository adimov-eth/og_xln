import { expect, test, type Page } from '@playwright/test';
import { formatUnits, parseUnits } from 'ethers';
import type { RuntimeAdapterViewFrame, XLNModule } from '../../core/api/public/runtime-module';
import type { RuntimeAdapter } from '../../core/api/runtime-adapter/types';
import { enterStack, fundFromHub } from './stack';

type DebugWindow = Window & {
  __xln?: {
    adapter: () => RuntimeAdapter | null;
    xln: () => Promise<XLNModule>;
    store: { getState: () => { activeEntityId: string | null } };
  };
};

/** Read the same committed Account as the wallet; all financial actions still use real UI controls. */
const readAccount = (page: Page, hubId: string) =>
  page.evaluate(async counterpartyId => {
    const debug = (window as DebugWindow).__xln;
    if (!debug) throw new Error('Wallet diagnostics unavailable');
    const adapter = debug.adapter();
    const entityId = debug.store.getState().activeEntityId;
    if (!adapter || !entityId) throw new Error('Wallet Account owner unavailable');
    const account = await adapter.read<NonNullable<RuntimeAdapterViewFrame['activeEntity']>['accounts']['items'][number]>(`entity/${entityId}/account/${counterpartyId}`);
    const xln = await debug.xln();
    const isLeft = xln.isLeftEntity(entityId, counterpartyId);
    const usdcDelta = account.state.deltas.get(1);
    if (!usdcDelta) throw new Error('Swap USDC delta unavailable');
    const signed = (tokenId: number) => {
      const delta = account.state.deltas.get(tokenId);
      if (!delta) return '0';
      const derived = xln.deriveDelta(delta, isLeft);
      return (derived.outCollateral + derived.outPeerCredit - derived.inOwnCredit).toString();
    };
    const incoming = xln.readAccountCapacity({
      account: account.state,
      ownerEntityId: entityId,
      counterpartyEntityId: counterpartyId,
      tokenId: 2,
    });
    return {
      height: account.currentHeight,
      root: account.currentFrame.accountStateRoot,
      pending: Boolean(account.pendingFrame),
      mempool: account.mempoolCount,
      offers: account.state.swapOffers.size,
      usdc: signed(1),
      weth: signed(2),
      wethCredit: incoming.peerCreditLimit.toString(),
      wethCapacity: incoming.inCapacity.toString(),
      usdcSpendable: xln.deriveDelta(usdcDelta, isLeft).outCapacity.toString(),
    };
  }, hubId);

test(
  'same-network swap prepares incoming WETH explicitly before a real bilateral fill',
  { tag: '@functional' },
  async ({ page }) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    const authErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() !== 'error' && message.type() !== 'warning') return;
      console.log(`BROWSER_${message.type()}: ${message.text().slice(0, 500)}`);
      if (/MAC.*(?:INVALID|FAIL|MISMATCH)|(?:INVALID|FAIL|MISMATCH).*MAC|WS_MESSAGE_AUTH/i.test(message.text()))
        authErrors.push(message.text());
    });
    await enterStack(page);
    const fundingResponse = page.waitForResponse(
      response => new URL(response.url()).pathname === '/api/faucet/offchain' && response.request().method() === 'POST',
    );
    await Promise.all([
      fundFromHub(page, '100'),
      fundingResponse.then(async funding => expect(funding.ok(), await funding.text()).toBe(true)),
    ]);
    await page.getByTestId('account-row').first().click();
    const hubId = new URL(page.url()).pathname.split('/accounts/')[1];
    if (!hubId || !/^0x[0-9a-f]{64}$/.test(hubId)) throw new Error('Expected the fresh wallet hub Account');
    await expect.poll(async () => (await readAccount(page, hubId)).usdc, { timeout: 15_000 }).toBe('100000000');
    const before = await readAccount(page, hubId);
    expect(before.weth).toBe('0');
    expect(before.wethCredit).toBe('0');
    expect(before.wethCapacity).toBe('0');
    await page.getByTestId('back').click();
    await page.getByTestId('home-swap').click();
    const book = page.getByTestId('orderbook').locator('visible=true').first();
    await expect(book).toHaveAttribute('data-status', 'live', { timeout: 15_000 });
    const bestAsk = book.locator('.bk-row.ask').last();
    await expect(bestAsk).toBeVisible();
    await bestAsk.click();
    const feeRow = page.locator('.kv').filter({ hasText: 'Hub fee' });
    await expect(feeRow).toContainText('bps');
    const feeMatch = (await feeRow.innerText()).match(/(\d+) bps/);
    if (!feeMatch?.[1]) throw new Error('Published swap fee unavailable');
    const ticket = {
      give: parseUnits(await page.getByTestId('swap-give').inputValue(), 6).toString(),
      want: parseUnits(await page.getByTestId('swap-want').inputValue(), 18).toString(),
      feeBps: Number(feeMatch[1]),
    };
    const quote = await page.evaluate(async amounts => {
      const debug = (window as DebugWindow).__xln;
      if (!debug) throw new Error('Wallet diagnostics unavailable');
      const xln = await debug.xln();
      const prepared = xln.prepareSwapOrder(1, 2, BigInt(amounts.give), BigInt(amounts.want));
      const authorization = xln.deriveSwapNetAuthorization(prepared.effectiveWant, amounts.feeBps);
      return {
        give: prepared.effectiveGive.toString(),
        want: prepared.effectiveWant.toString(),
        minNet: authorization.minNetReceive.toString(),
      };
    }, ticket);
    expect(BigInt(quote.give)).toBeGreaterThan(0n);
    expect(BigInt(quote.give)).toBeLessThanOrEqual(BigInt(before.usdc));
    expect(BigInt(quote.want)).toBeGreaterThan(0n);
    const spectrum = page.getByTestId('receive-spectrum');
    const submit = page.getByTestId('swap-submit');
    await expect(spectrum).toBeVisible();
    await expect(spectrum).toContainText('WETH');
    await expect(page.getByTestId('receive-spectrum-slider')).toHaveValue('0');
    const chooseCredit = spectrum.getByRole('button', { name: 'Accept it as credit instead', exact: true });
    await expect(chooseCredit).toBeEnabled();
    await expect(submit).toBeDisabled();
    await chooseCredit.click();
    await expect(page.getByTestId('receive-spectrum-slider')).toHaveValue('100');
    await expect(spectrum.getByRole('checkbox')).toBeChecked();
    await expect(submit).toBeDisabled();
    const chosenAccount = await readAccount(page, hubId);
    expect(chosenAccount.wethCredit).toBe(before.wethCredit);
    expect(chosenAccount.usdc).toBe(before.usdc);
    expect(chosenAccount.weth).toBe(before.weth);
    expect(chosenAccount.offers).toBe(0);
    await expect(page.getByTestId('receive-spectrum-confirm')).toHaveText('Extend credit limit');
    await page.getByTestId('receive-spectrum-confirm').click();
    await expect(spectrum).toHaveCount(0, { timeout: 15_000 });
    await expect(submit).toBeEnabled();
    const preparedAccount = await readAccount(page, hubId);
    const creditWithBuffer = BigInt(quote.want) + (BigInt(quote.want) + 9n) / 10n;
    expect(preparedAccount.wethCredit).toBe(creditWithBuffer.toString());
    expect(BigInt(preparedAccount.wethCapacity)).toBeGreaterThanOrEqual(BigInt(quote.want));
    expect(preparedAccount.usdc).toBe(before.usdc);
    expect(preparedAccount.weth).toBe(before.weth);
    expect(preparedAccount.offers).toBe(0);
    await expect
      .poll(
        async () => {
          const account = await readAccount(page, hubId);
          return { pending: account.pending, mempool: account.mempool };
        },
        { timeout: 15_000 },
      )
      .toEqual({ pending: false, mempool: 0 });
    const giveInput = page.getByTestId('swap-give');
    const validGive = await giveInput.inputValue();
    const overCapacity = formatUnits(BigInt(preparedAccount.usdcSpendable) + 1_000_000n, 6);
    for (const invalidGive of ['0', 'invalid', overCapacity]) {
      await giveInput.fill(invalidGive);
      await expect(submit).toBeDisabled();
      if (invalidGive === overCapacity)
        await expect(page.getByText('Exceeds what you can send', { exact: true })).toBeVisible();
      const rejected = await readAccount(page, hubId);
      expect(rejected.usdc).toBe(preparedAccount.usdc);
      expect(rejected.weth).toBe(preparedAccount.weth);
      expect(rejected.wethCredit).toBe(preparedAccount.wethCredit);
      expect(rejected.offers).toBe(0);
      expect(rejected.pending).toBe(false);
      expect(rejected.mempool).toBe(0);
    }
    await giveInput.fill(validGive);
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect
      .poll(async () => BigInt((await readAccount(page, hubId)).weth), { timeout: 15_000 })
      .toBeGreaterThan(0n);
    await expect
      .poll(
        async () => {
          const account = await readAccount(page, hubId);
          return { pending: account.pending, mempool: account.mempool, offers: account.offers };
        },
        { timeout: 15_000 },
      )
      .toEqual({ pending: false, mempool: 0, offers: 0 });
    const after = await readAccount(page, hubId);
    expect(after.height).toBeGreaterThan(preparedAccount.height);
    expect(after.root).not.toBe(preparedAccount.root);
    const debit = BigInt(before.usdc) - BigInt(after.usdc);
    const received = BigInt(after.weth) - BigInt(before.weth);
    expect(debit).toBeGreaterThan(0n);
    expect(debit).toBeLessThanOrEqual(BigInt(quote.give));
    expect(received).toBeGreaterThanOrEqual(BigInt(quote.minNet));
    expect(after.wethCredit).toBe(preparedAccount.wethCredit);
    console.log(
      `SWAP_COMMITTED accountHeight=${after.height} usdcDebit=${debit} wethReceived=${received} permanentWethCredit=${after.wethCredit} root=${after.root}`,
    );
    await page.getByTestId('nav-activity').first().click();
    await page.getByRole('button', { name: 'Swaps', exact: true }).click();
    const history = page.getByTestId('swap-history-order');
    await expect(history).toHaveCount(1);
    await history.locator('summary').click();
    await expect(history).not.toContainText('Not recorded');
    await expect(history.locator('[data-field="gave"]')).toHaveAttribute('data-amount', debit.toString());
    const gross = BigInt(await history.locator('[data-field="received"]').getAttribute('data-amount') ?? '-1');
    const fee = BigInt(await history.locator('[data-field="fee"]').getAttribute('data-amount') ?? '0');
    expect(gross - fee).toBe(received);
    expect(pageErrors).toEqual([]);
    expect(authErrors).toEqual([]);
  },
);
