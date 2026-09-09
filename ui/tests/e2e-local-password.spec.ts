import { expect, test } from '@playwright/test';
import { enterStack, LOCAL_PASSWORD } from './stack';

test(
  'Lock stops the runtime; only the local password opens the same wallet',
  { tag: '@functional' },
  async ({ page }) => {
    test.setTimeout(55_000);
    const wallet = await enterStack(page);
    const runtime = await page.evaluateHandle(() => {
      const debug = (
        window as typeof window & {
          __xln?: { env: () => { runtimeSeed?: string; infrastructure?: { persistencePaused?: boolean } } | null };
        }
      ).__xln;
      if (!debug?.env()) throw new Error('Runtime diagnostics unavailable');
      return debug.env()!;
    });
    await page.getByTestId('nav-settings').first().click();
    await page.getByRole('button', { name: 'Lock', exact: true }).click();
    await expect
      .poll(() =>
        runtime.evaluate(env => ({
          paused: env.infrastructure?.persistencePaused,
          seedRemoved: env.runtimeSeed === undefined,
        })),
      )
      .toEqual({ paused: true, seedRemoved: true });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.locator('input[type="password"]')).toHaveCount(1);
    await page.getByLabel('Password', { exact: true }).fill('incorrect-local-password');
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Incorrect password');
    await expect(page.getByTestId('home-total')).toHaveCount(0);
    await page.getByLabel('Password', { exact: true }).fill(LOCAL_PASSWORD);
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await page.getByTestId('nav-home').first().click();
    await expect(page.getByTestId('home-entity-id')).toHaveText(wallet.entityId);
    await expect(page.getByTestId('home-total')).toBeVisible();
    await runtime.dispose();
  },
);
