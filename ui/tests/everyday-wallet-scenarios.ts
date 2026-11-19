import { expect, type Browser, type Page } from '@playwright/test';
import { HDNodeWallet } from 'ethers';
import { setBankPolicy } from './lending/bank-policy';
import {
  assertEverydayPostureClean,
  assertTouchTargetsAccessible,
  assertZeroDialogs,
  attachEverydayWatchers,
  fundViaHomeFaucetAndSettle,
  openEverydayWallet,
  parseUsdText,
  readEverydayCashValue,
  readEverydayIdentity,
  readEverydaySnapshot,
  reopenEverydayWallet,
  triggerFaucetApi,
  waitForEverydayShell,
  type WalletKind,
} from './everyday-wallet-assertions';

async function openSecondWallet(browser: Browser, wallet: WalletKind) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  const watchers = attachEverydayWatchers(page);
  const identity = await openEverydayWallet(page, wallet);
  return { context, page, watchers, identity };
}

export async function runEverydayCaseE1(page: Page, wallet: WalletKind): Promise<void> {
  const watchers = attachEverydayWatchers(page);
  const identity = await openEverydayWallet(page, wallet);
  expect(identity.runtimeId).toMatch(/^0x[0-9a-f]{40}$/i);
  expect(identity.entityId).toMatch(/^0x[0-9a-f]{64}$/i);

  await assertEverydayPostureClean(page);
  await assertTouchTargetsAccessible(
    page,
    [
      ['nav-cash', 'nav-friends', 'nav-savings', 'nav-activity', 'nav-settings'],
      ['everyday-pay-btn', 'everyday-request-btn', 'everyday-cashout-btn'],
    ],
    ['nav-settings'],
  );

  const navGroup = ['nav-cash', 'nav-friends', 'nav-savings', 'nav-activity', 'nav-settings'] as const;
  const tabTargetGroups: Record<string, readonly (readonly string[])[]> = {
    'nav-friends': [navGroup, ['everyday-split-target', 'everyday-split-amount', 'everyday-split-btn']],
    'nav-savings': [navGroup, ['everyday-savings-amount', 'everyday-savings-add']],
    'nav-activity': [navGroup],
    'nav-settings': [navGroup, ['toggle-pro-mode', 'settings-clear-test-data']],
    'nav-cash': [navGroup, ['everyday-pay-btn', 'everyday-request-btn', 'everyday-cashout-btn']],
  };

  for (const tab of ['nav-friends', 'nav-savings', 'nav-activity', 'nav-settings', 'nav-cash'] as const) {
    await page.getByTestId(tab).locator('visible=true').first().click();
    await assertEverydayPostureClean(page);
    const icons = tab === 'nav-settings' ? ['nav-settings', 'toggle-pro-mode'] : ['nav-settings'];
    await assertTouchTargetsAccessible(page, tabTargetGroups[tab]!, icons);
    if (tab === 'nav-savings') {
      const consentLabel = page.locator('label:has([data-testid="everyday-savings-consent"]):visible').first();
      if ((await consentLabel.count()) > 0) {
        const box = await consentLabel.boundingBox();
        expect(box?.height ?? 0, 'everyday-savings-consent label height').toBeGreaterThanOrEqual(48);
      }
    }
  }
  expect(watchers.errors).toEqual([]);
  expect(watchers.httpErrors).toEqual([]);
}

export async function runEverydayCaseE2(page: Page, wallet: WalletKind): Promise<void> {
  const watchers = attachEverydayWatchers(page);
  await openEverydayWallet(page, wallet);

  const initialSnap = await readEverydaySnapshot(page, wallet);
  expect(initialSnap.hubAccounts).toHaveLength(1);
  expect(initialSnap.hubAccounts[0]!.peerCreditLimit).toBe('250000000');
  expect(initialSnap.hubAccounts[0]!.ownCreditLimit).toBe('0');
  expect(await readEverydayCashValue(page)).toBe(0);
  await expect(page.getByTestId('everyday-test-btn')).toBeVisible();

  await page.getByTestId('everyday-test-btn').click();
  await expect(page.getByTestId('home-faucet')).toBeVisible();
  await page.getByTestId('home-faucet').click();
  await page.getByTestId('nav-cash').locator('visible=true').first().click();
  const arriving = page.getByTestId('everyday-arriving');
  await expect(arriving).toBeVisible({ timeout: 20_000 });
  await expect(arriving).toContainText(/arriving/i);
  expect(await readEverydayCashValue(page)).toBe(0);

  // Unhappy: paying while funds are only arriving must not inflate or debit Cash.
  await page.getByTestId('everyday-pay-btn').click();
  await page.getByTestId('everyday-pay-to').fill(`0x${'22'.repeat(32)}`);
  await page.getByTestId('everyday-pay-amount').fill('10');
  const submit = page.getByTestId('everyday-pay-submit');
  if (await submit.isEnabled()) {
    await submit.click();
  }
  await assertZeroDialogs(page);
  expect(await readEverydayCashValue(page)).toBe(0);
  const preSettleSnap = await readEverydaySnapshot(page, wallet);
  expect(preSettleSnap.hubAccounts[0]!.inOwnCredit).toBe('0');

  await expect(arriving).toHaveCount(0, { timeout: 45_000 });
  const settledCash = await readEverydayCashValue(page);
  expect(settledCash).toBeGreaterThan(98);
  expect(settledCash).toBeLessThanOrEqual(100);

  const settledSnap = await readEverydaySnapshot(page, wallet);
  expect(BigInt(settledSnap.hubAccounts[0]!.outCollateral)).toBeGreaterThan(98_000_000n);
  expect(settledSnap.hubAccounts[0]!.outPeerCredit).toBe('0');

  await reopenEverydayWallet(page, wallet);
  await expect.poll(async () => readEverydayCashValue(page), { timeout: 25_000 }).toBe(settledCash);
  expect(watchers.errors).toEqual([]);
  expect(watchers.httpErrors).toEqual([]);
}

export async function runEverydayCaseE3(page: Page, browser: Browser, wallet: WalletKind): Promise<void> {
  const watchers = attachEverydayWatchers(page);
  const alice = await openEverydayWallet(page, wallet);
  const bob = await openSecondWallet(browser, wallet);
  try {
    await triggerFaucetApi(page, 'reserve', alice, '100');
    await expect.poll(async () => readEverydayCashValue(page), { timeout: 45_000 }).toBeGreaterThanOrEqual(99);

    await page.getByTestId('everyday-pay-btn').click();
    await page.getByTestId('everyday-pay-to').fill(bob.identity.entityId);
    await page.getByTestId('everyday-pay-amount').fill('50');
    await page.getByTestId('everyday-pay-note').fill('Dinner');

    // Unhappy: 0 ETH L1 gas blocks internal r2c bucket composition without touching Cash.
    const submit = page.getByTestId('everyday-pay-submit');
    await expect(page.getByTestId('everyday-pay-fee')).toContainText(/Fee:/i, { timeout: 15_000 });
    await expect(submit).toBeDisabled();
    await assertZeroDialogs(page);
    expect(await readEverydayCashValue(page)).toBeGreaterThanOrEqual(99);
    expect(await readEverydayCashValue(bob.page)).toBe(0);

    await triggerFaucetApi(page, 'erc20', alice, '100');
    await triggerFaucetApi(page, 'gas', alice);
    await expect.poll(async () => readEverydayCashValue(page), { timeout: 45_000 }).toBeGreaterThanOrEqual(199);

    await page.getByTestId('everyday-pay-amount').fill('150');
    await expect(page.getByTestId('everyday-pay-fee')).toContainText(/Fee:/i, { timeout: 15_000 });
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    await assertZeroDialogs(page);
    await submit.click();
    await assertZeroDialogs(page);

    await expect(bob.page.getByTestId('everyday-arriving')).toHaveCount(0, { timeout: 45_000 });
    await expect.poll(async () => readEverydayCashValue(bob.page), { timeout: 45_000 }).toBeGreaterThan(148);
    const bobSettled = await readEverydayCashValue(bob.page);
    expect(bobSettled).toBeLessThanOrEqual(150);

    await expect.poll(async () => readEverydayCashValue(page), { timeout: 45_000 }).toBeLessThan(51);
    const aliceAfter = await readEverydayCashValue(page);

    await reopenEverydayWallet(page, wallet);
    await reopenEverydayWallet(bob.page, wallet);
    await expect.poll(async () => readEverydayCashValue(page), { timeout: 25_000 }).toBe(aliceAfter);
    await expect.poll(async () => readEverydayCashValue(bob.page), { timeout: 25_000 }).toBe(bobSettled);
    expect([...watchers.errors, ...bob.watchers.errors]).toEqual([]);
    expect([...watchers.httpErrors, ...bob.watchers.httpErrors]).toEqual([]);
  } finally {
    await bob.context.close();
  }
}

export async function runEverydayCaseE4(page: Page, wallet: WalletKind): Promise<void> {
  const watchers = attachEverydayWatchers(page);
  await openEverydayWallet(page, wallet);
  const baseline = await fundViaHomeFaucetAndSettle(page, wallet);
  const beforeSnap = await readEverydaySnapshot(page, wallet);

  await page.getByTestId('everyday-pay-btn').click();
  const toInput = page.getByTestId('everyday-pay-to');
  const amountInput = page.getByTestId('everyday-pay-amount');
  const feeLine = page.getByTestId('everyday-pay-fee');
  const submit = page.getByTestId('everyday-pay-submit');

  const invalidCases: Array<[string, string]> = [
    [`0x${'22'.repeat(32)}`, '0'],
    [`0x${'22'.repeat(32)}`, '-5'],
    [`0x${'22'.repeat(32)}`, 'abc'],
    [`0x${'22'.repeat(32)}`, '500'],
    ['not-an-entity', '10'],
  ];
  for (const [target, amount] of invalidCases) {
    await toInput.fill(target);
    await amountInput.fill(amount);
    if (amount === '500') {
      await expect(feeLine).not.toHaveText(/Checking fee/i, { timeout: 10_000 });
    }
    await expect(submit).toBeDisabled();
    await assertZeroDialogs(page);
    expect(await readEverydayCashValue(page)).toBe(baseline);
  }

  const afterSnap = await readEverydaySnapshot(page, wallet);
  expect(afterSnap.hubAccounts[0]!.outCollateral).toBe(beforeSnap.hubAccounts[0]!.outCollateral);
  expect(watchers.errors).toEqual([]);
  expect(watchers.httpErrors).toEqual([]);
}

export async function runEverydayCaseE5(page: Page, browser: Browser, wallet: WalletKind): Promise<void> {
  const watchers = attachEverydayWatchers(page);
  const alice = await openEverydayWallet(page, wallet);
  const bob = await openSecondWallet(browser, wallet);
  try {
    await page.getByTestId('nav-friends').locator('visible=true').first().click();
    const list = page.getByTestId('everyday-friends-list');
    await expect(list).toBeVisible();
    if (alice.primaryHubId) {
      await expect(list).not.toContainText(alice.primaryHubId.slice(0, 12));
    }

    // Unhappy: empty/negative split is blocked without creating a tab.
    await page.getByTestId('everyday-split-amount').fill('0');
    if (await page.getByTestId('everyday-split-btn').isEnabled()) {
      await page.getByTestId('everyday-split-btn').click();
    }
    expect((await readEverydaySnapshot(page, wallet)).friendAccounts).toHaveLength(0);

    await page.getByTestId('everyday-split-target').fill(bob.identity.entityId);
    await page.getByTestId('everyday-split-amount').fill('40');
    await page.getByTestId('everyday-split-btn').click();

    await expect
      .poll(async () => (await readEverydaySnapshot(page, wallet)).friendAccounts.length, { timeout: 20_000 })
      .toBe(1);
    await expect(list).toContainText('40');
    await expect(page.getByText(/credit limit/i).locator('visible=true')).toHaveCount(0);

    // Bob uses the shared tab to owe Alice $40, then funds Cash and settles up in 1 tap.
    await expect
      .poll(async () => (await readEverydaySnapshot(bob.page, wallet)).friendAccounts.length, { timeout: 20_000 })
      .toBe(1);
    await bob.page.getByTestId('everyday-pay-btn').click();
    await bob.page.getByTestId('everyday-pay-to').fill(alice.entityId);
    await bob.page.getByTestId('everyday-pay-amount').fill('40');
    await expect(bob.page.getByTestId('everyday-pay-submit')).toBeEnabled({ timeout: 15_000 });
    await bob.page.getByTestId('everyday-pay-submit').click();
    await expect
      .poll(
        async () => (await readEverydaySnapshot(bob.page, wallet)).friendAccounts[0]?.inOwnCredit ?? '0',
        { timeout: 20_000 },
      )
      .toBe('40000000');

    await fundViaHomeFaucetAndSettle(bob.page, wallet);
    const bobBeforeSettle = await readEverydaySnapshot(bob.page, wallet);
    await bob.page.getByTestId('nav-friends').locator('visible=true').first().click();
    await assertZeroDialogs(bob.page);
    await expect(bob.page.getByTestId('everyday-settle-btn').first()).toBeEnabled({ timeout: 15_000 });
    await bob.page.getByTestId('everyday-settle-btn').first().click();
    await assertZeroDialogs(bob.page);

    await expect
      .poll(
        async () => {
          const snap = await readEverydaySnapshot(bob.page, wallet);
          const friend = snap.friendAccounts[0];
          return friend ? `${friend.inOwnCredit}:${friend.outPeerCredit}` : 'missing';
        },
        { timeout: 25_000 },
      )
      .toBe('0:0');

    const bobAfterSettle = await readEverydaySnapshot(bob.page, wallet);
    expect(
      BigInt(bobBeforeSettle.hubAccounts[0]!.outCollateral) - BigInt(bobAfterSettle.hubAccounts[0]!.outCollateral),
    ).toBeGreaterThanOrEqual(40_000_000n);

    await page.getByTestId('nav-cash').locator('visible=true').first().click();
    await expect.poll(async () => readEverydayCashValue(page), { timeout: 25_000 }).toBeGreaterThanOrEqual(39);

    await reopenEverydayWallet(bob.page, wallet);
    await reopenEverydayWallet(page, wallet);
    const reloadedBob = await readEverydaySnapshot(bob.page, wallet);
    expect(reloadedBob.friendAccounts[0]?.inOwnCredit).toBe('0');
    await expect.poll(async () => readEverydayCashValue(page), { timeout: 25_000 }).toBeGreaterThanOrEqual(39);
    expect([...watchers.errors, ...bob.watchers.errors]).toEqual([]);
    expect([...watchers.httpErrors, ...bob.watchers.httpErrors]).toEqual([]);
  } finally {
    await bob.context.close();
  }
}

export async function runEverydayCaseE6(page: Page, wallet: WalletKind): Promise<void> {
  const watchers = attachEverydayWatchers(page);
  const alice = await openEverydayWallet(page, wallet);
  if (!alice.primaryHubId) throw new Error('EVERYDAY_SAVINGS_HUB_MISSING');
  await fundViaHomeFaucetAndSettle(page, wallet);
  await setBankPolicy(
    page,
    { ownerId: alice.entityId, hubId: alice.primaryHubId, tokenId: 1 },
    { termId: '1d', savingsInterestBps: 100, loanInterestBps: 200 },
  );

  await page.getByTestId('nav-savings').locator('visible=true').first().click();
  const savingsBal = page.getByTestId('everyday-savings-balance');
  expect(parseUsdText(await savingsBal.innerText())).toBe(0);

  // Unhappy: unconsented or oversized Savings deposit is blocked.
  await page.getByTestId('everyday-savings-amount').fill('25');
  await expect(page.getByTestId('everyday-savings-add')).toBeDisabled();

  const consent = page.getByTestId('everyday-savings-consent');
  await consent.check();
  await page.getByTestId('everyday-savings-amount').fill('500');
  if (await page.getByTestId('everyday-savings-add').isEnabled()) {
    await page.getByTestId('everyday-savings-add').click();
  }
  expect(parseUsdText(await savingsBal.innerText())).toBe(0);

  await page.getByTestId('everyday-savings-amount').fill('25');
  await expect(page.getByTestId('everyday-savings-add')).toBeEnabled({ timeout: 15_000 });
  await assertZeroDialogs(page);
  await page.getByTestId('everyday-savings-add').click();

  await expect.poll(async () => parseUsdText(await savingsBal.innerText()), { timeout: 25_000 }).toBe(25);
  await page.getByTestId('nav-cash').locator('visible=true').first().click();
  await expect.poll(async () => readEverydayCashValue(page), { timeout: 25_000 }).toBeGreaterThan(70);
  expect(await readEverydayCashValue(page)).toBeLessThan(76);

  await reopenEverydayWallet(page, wallet);
  await page.getByTestId('nav-savings').locator('visible=true').first().click();
  expect(parseUsdText(await savingsBal.innerText())).toBe(25);

  await page.getByTestId('everyday-savings-move').click();
  await expect.poll(async () => parseUsdText(await savingsBal.innerText()), { timeout: 25_000 }).toBe(0);
  await page.getByTestId('nav-cash').locator('visible=true').first().click();
  await expect.poll(async () => readEverydayCashValue(page), { timeout: 25_000 }).toBeGreaterThan(98);
  expect(watchers.errors).toEqual([]);
  expect(watchers.httpErrors).toEqual([]);
}

export async function runEverydayCaseE7(page: Page, browser: Browser, wallet: WalletKind): Promise<void> {
  const watchers = attachEverydayWatchers(page);
  const alice = await openEverydayWallet(page, wallet);
  const bob = await openSecondWallet(browser, wallet);
  try {
    await fundViaHomeFaucetAndSettle(page, wallet);
    await bob.page.getByTestId('everyday-request-btn').click();
    await bob.page.getByTestId('everyday-request-amount').fill('7');
    await bob.page.getByTestId('everyday-request-note').fill('Coffee');

    const linkField = bob.page.getByTestId('everyday-request-link');
    await expect(linkField).toBeVisible();
    const rawLink = (await linkField.inputValue().catch(() => null)) || (await linkField.innerText());
    const parsed = new URL(rawLink.trim());
    const localUrl = new URL(page.url());
    await page.goto(`${localUrl.origin}${localUrl.pathname}${parsed.hash}`);

    const sheet = page.getByTestId('external-request-sheet');
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expect(sheet).toContainText('7');
    await expect(sheet).toContainText('Coffee');
    await page.getByTestId('external-request-confirm').click();
    await expect(sheet).toHaveCount(0, { timeout: 20_000 });

    await expect(bob.page.getByTestId('everyday-arriving')).toHaveCount(0, { timeout: 45_000 });
    await expect.poll(async () => readEverydayCashValue(bob.page), { timeout: 45_000 }).toBeGreaterThan(6.5);

    // Unhappy: disguised hub-credit escalation must surface Pro escalation, never silent Everyday signing.
    const baitInvoice = `${alice.primaryHubId ?? alice.entityId}?token=1&amount=500&txType=extendCredit`;
    await page.goto(`${localUrl.origin}${localUrl.pathname}#pay/${encodeURIComponent(baitInvoice)}`);
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('external-request-escalate')).toBeVisible();
    await expect(page.getByTestId('external-request-open-pro')).toBeVisible();
    const confirmBtn = page.getByTestId('external-request-confirm');
    if ((await confirmBtn.count()) > 0) {
      await expect(confirmBtn).toBeDisabled();
    }
    expect([...watchers.errors, ...bob.watchers.errors]).toEqual([]);
    expect([...watchers.httpErrors, ...bob.watchers.httpErrors]).toEqual([]);
  } finally {
    await bob.context.close();
  }
}

export async function runEverydayCaseE8(page: Page, browser: Browser, wallet: WalletKind): Promise<void> {
  const watchers = attachEverydayWatchers(page);
  await openEverydayWallet(page, wallet);
  const bob = await openSecondWallet(browser, wallet);
  try {
    await fundViaHomeFaucetAndSettle(page, wallet);
    await page.getByTestId('everyday-pay-btn').click();
    await page.getByTestId('everyday-pay-to').fill(bob.identity.entityId);
    await page.getByTestId('everyday-pay-amount').fill('10');
    await expect(page.getByTestId('everyday-pay-submit')).toBeEnabled({ timeout: 15_000 });
    await page.getByTestId('everyday-pay-submit').click();
    await expect.poll(async () => readEverydayCashValue(page), { timeout: 25_000 }).toBeLessThan(91);

    await page.getByTestId('nav-activity').locator('visible=true').first().click();
    const activityList = page.getByTestId('everyday-activity-list');
    await expect(activityList).toBeVisible();
    await expect(activityList).toContainText(/Sent/i);
    await expect(activityList).toContainText('10');
    for (const rawTerm of ['requestCollateral', 'r2c', 'set_credit_limit', 'Confirmed frame #']) {
      await expect(activityList).not.toContainText(rawTerm);
    }

    const recoveryNotice = page.getByTestId('everyday-recovery-notice');
    await expect(recoveryNotice).toBeVisible();
    await expect(recoveryNotice).toContainText(/requires network gas/i, { timeout: 20_000 });
    expect([...watchers.errors, ...bob.watchers.errors]).toEqual([]);
    expect([...watchers.httpErrors, ...bob.watchers.httpErrors]).toEqual([]);
  } finally {
    await bob.context.close();
  }
}

export async function runEverydayCaseE9(page: Page, wallet: WalletKind): Promise<void> {
  const watchers = attachEverydayWatchers(page);
  const alice = await openEverydayWallet(page, wallet);
  const baseline = await fundViaHomeFaucetAndSettle(page, wallet);

  await page.getByTestId('everyday-cashout-btn').click();
  const addressInput = page.getByTestId('everyday-cashout-address');
  const amountInput = page.getByTestId('everyday-cashout-amount');
  const submit = page.getByTestId('everyday-cashout-submit');

  // Unhappy: invalid address, 0 ETH gas, and > settled Cash.
  await addressInput.fill('not-an-address');
  await amountInput.fill('20');
  await expect(submit).toBeDisabled();
  await assertZeroDialogs(page);
  expect(await readEverydayCashValue(page)).toBe(baseline);

  const destinationEoa = HDNodeWallet.createRandom().address;
  await addressInput.fill(destinationEoa);
  await amountInput.fill('20');
  await expect(submit).toBeDisabled();
  await assertZeroDialogs(page);
  expect(await readEverydayCashValue(page)).toBe(baseline);

  await amountInput.fill('500');
  await expect(submit).toBeDisabled();
  await assertZeroDialogs(page);
  expect(await readEverydayCashValue(page)).toBe(baseline);

  // Happy: grant L1 gas and cash out $20 to external EOA.
  await triggerFaucetApi(page, 'gas', alice);
  await amountInput.fill('20');
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await assertZeroDialogs(page);
  await submit.click();
  await assertZeroDialogs(page);

  await expect.poll(async () => readEverydayCashValue(page), { timeout: 45_000 }).toBeLessThan(81);
  const afterCashOut = await readEverydayCashValue(page);
  expect(afterCashOut).toBeGreaterThan(77);

  await reopenEverydayWallet(page, wallet);
  await expect.poll(async () => readEverydayCashValue(page), { timeout: 25_000 }).toBe(afterCashOut);
  expect(watchers.errors).toEqual([]);
  expect(watchers.httpErrors).toEqual([]);
}

export async function runEverydayCaseE10(page: Page, wallet: WalletKind): Promise<void> {
  const watchers = attachEverydayWatchers(page);
  const dialogMessages: string[] = [];
  page.on('dialog', async dialog => {
    dialogMessages.push(dialog.message());
    await dialog.dismiss();
  });

  await openEverydayWallet(page, wallet);
  await fundViaHomeFaucetAndSettle(page, wallet);
  const beforeIdentity = await readEverydayIdentity(page, wallet);

  await page.getByTestId('nav-settings').locator('visible=true').first().click();
  const proToggle = page.getByTestId('toggle-pro-mode');
  await expect(proToggle).not.toBeChecked();
  await expect(page.getByTestId('everyday-backup-status')).toBeVisible();

  await expect(proToggle).toBeVisible();
  await proToggle.click();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('xln-wallet-posture'))).toBe('pro');
  if (wallet === 'react') {
    await expect(page.getByTestId('nav-home').locator('visible=true').first()).toBeVisible({ timeout: 15_000 });
  } else {
    await expect(page.getByRole('button', { name: 'Accounts', exact: true })).toBeVisible({ timeout: 15_000 });
  }

  await page.reload();
  if (wallet === 'react') {
    const continueBtn = page.getByRole('button', { name: 'Continue', exact: true });
    const navHome = page.getByTestId('nav-home').locator('visible=true');
    await continueBtn.or(navHome).first().waitFor({ state: 'visible', timeout: 30_000 });
    if (await continueBtn.isVisible().catch(() => false)) await continueBtn.click();
    await expect(navHome.first()).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('nav-settings').locator('visible=true').first().click();
  } else {
    await expect(page.getByRole('button', { name: 'Accounts', exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
  }

  const proModeToggle = page.getByTestId('toggle-pro-mode');
  await expect(proModeToggle).toBeVisible();
  await expect(proModeToggle).toBeChecked();
  await proModeToggle.click();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('xln-wallet-posture'))).toBe('everyday');
  await waitForEverydayShell(page);
  await expect(page.getByTestId('nav-home')).toHaveCount(0);

  await page.getByTestId('nav-settings').locator('visible=true').first().click();
  await page.getByTestId('settings-clear-test-data').click();
  await expect
    .poll(
      async () => {
        if (wallet === 'react') {
          const continueBtn = page.getByRole('button', { name: 'Continue', exact: true });
          if (await continueBtn.isVisible().catch(() => false)) await continueBtn.click();
        }
        return (await page.getByTestId('everyday-cash').locator('visible=true').count()) > 0;
      },
      { timeout: 60_000 },
    )
    .toBe(true);

  await waitForEverydayShell(page);
  expect(await readEverydayCashValue(page)).toBe(0);
  const afterIdentity = await readEverydayIdentity(page, wallet);
  expect(afterIdentity.entityId).toBe(beforeIdentity.entityId);
  expect(afterIdentity.runtimeId).toBe(beforeIdentity.runtimeId);
  expect(dialogMessages).toEqual([]);
  expect(watchers.errors).toEqual([]);
  expect(watchers.httpErrors).toEqual([]);
}
