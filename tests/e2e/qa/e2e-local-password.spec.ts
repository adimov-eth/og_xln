import { expect, test } from '@playwright/test';
import { HDNodeWallet } from 'ethers';
import { gotoApp, createRuntimeIdentity } from '../../utils/e2e-demo-users';

test(
  'an existing Svelte wallet enrolls a password and locks without derivation',
  { tag: '@functional' },
  async ({ page }) => {
    test.setTimeout(55_000);
    await gotoApp(page, { appBaseUrl: 'https://localhost:8080' });
    const identity = await createRuntimeIdentity(page, 'Password audit', HDNodeWallet.createRandom().mnemonic!.phrase);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Create a wallet', exact: true })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await page.getByRole('button', { name: /Password audit.*Unlock/ }).click();
    await expect(page.getByRole('heading', { name: 'Set a local password', exact: true })).toBeVisible();
    await page.getByLabel('Password', { exact: true }).fill('local-password-audit');
    await page.getByLabel('Confirm password', { exact: true }).fill('local-password-audit');
    await page.getByRole('button', { name: 'Save and open', exact: true }).click();
    await page.getByTestId('context-current').first().click();
    await page.getByRole('button', { name: 'Lock wallet', exact: true }).click();
    await page.getByRole('button', { name: /Password audit.*Unlock/ }).click();
    await expect(page.getByRole('heading', { name: 'Unlock wallet', exact: true })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(1);
    await expect(page.getByRole('tab', { name: 'Brain Vault', exact: true })).toHaveCount(0);
    await page.getByLabel('Password', { exact: true }).fill('wrong-local-password');
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Incorrect password');
    await page.getByLabel('Password', { exact: true }).fill('local-password-audit');
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await expect(page.getByTestId('context-current').first()).toHaveAttribute('data-entity-id', identity.entityId);
  },
);

test('a new Svelte wallet sets its password before leaving creation', { tag: '@functional' }, async ({ page }) => {
  test.setTimeout(55_000);
  await gotoApp(page, { appBaseUrl: 'https://localhost:8080' });
  await page.getByRole('tab', { name: 'Mnemonic', exact: true }).click();
  await page.getByLabel('Seed phrase', { exact: true }).fill(HDNodeWallet.createRandom().mnemonic!.phrase);
  await page.getByRole('button', { name: 'Continue with seed', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Set a local password', exact: true })).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('new-wallet-local-password');
  await page.getByLabel('Confirm password', { exact: true }).fill('new-wallet-local-password');
  await page.getByRole('button', { name: 'Save and open', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Set a local password', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Configure account', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Create a wallet', exact: true })).toBeVisible();
  await page.locator('button.wallet').first().click();
  await expect(page.getByRole('heading', { name: 'Unlock wallet', exact: true })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(1);
});
