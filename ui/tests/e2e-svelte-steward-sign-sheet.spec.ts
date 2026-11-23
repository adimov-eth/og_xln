/**
 * Svelte wallet: a pinned steward asks; only the person signs.
 *
 * Same contract as e2e-steward-sign-sheet.spec.ts for the React wallet: pin in Settings,
 * open the steward's signed link, hold to sign a credit change, read "committed" only after
 * committed state shows the new limit, decline the next request, refuse a stranger's.
 */
import { expect, test, type Page } from '@playwright/test';
import { HDNodeWallet, Wallet } from 'ethers';
import type { RuntimeReplica } from '../../core/runtime/types';
import { signStewardRequest, type StewardRequestBody } from '../../frontend/src/lib/governance/steward-request';
import { gotoProWallet } from './wallet-ui';

const APP = process.env['SVELTE_E2E_BASE_URL'] ?? 'http://localhost:8081/app';

const WAIT = { timeout: 30_000 };
type DebugWindow = Window & { __xln?: { liveRuntimeSnapshot?: RuntimeReplica | null } };

/** The first committed Account and the limit this Entity extends to it. */
async function firstAccount(page: Page, entityId: string, signerId: string): Promise<{ counterparty: string; limit: string } | null> {
  return page.evaluate(
    ({ entity, signer }) => {
      const env = (window as DebugWindow).__xln?.liveRuntimeSnapshot;
      const replica = env?.state.eReplicas.get(`${entity}:${signer}`);
      const [counterparty, account] = replica ? [...replica.state.accounts.entries()][0] ?? [] : [];
      if (!counterparty || !account || account.pendingFrame || account.currentFrame.height <= 0) return null;
      const delta = account.state.deltas.get(1);
      if (!delta) return null;
      const isLeft = entity < counterparty.toLowerCase();
      // The limit this side extends is written on the other side's field (set-credit-limit.ts).
      return { counterparty: counterparty.toLowerCase(), limit: String(isLeft ? delta.rightCreditLimit : delta.leftCreditLimit) };
    },
    { entity: entityId.toLowerCase(), signer: signerId.toLowerCase() },
  );
}

const openLink = (page: Page, fragment: string) => page.evaluate(value => { window.location.hash = value; }, fragment);

test(
  'Svelte: a pinned steward asks for a credit change; the person holds to sign, declines the next, and a stranger is refused',
  { tag: '@functional' },
  async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await gotoProWallet(page, APP);
    await page.getByRole('button', { name: 'Open test wallet', exact: true }).click();
    await expect(page.getByTestId('context-current')).toBeVisible({ timeout: 90_000 });
    // The primary signer's Entity, as the vault records it; its signer from the live replica.
    const wallet = await expect
      .poll(() => page.evaluate(() => {
        const vaults = JSON.parse(localStorage.getItem('xln-vaults') || '{}') as { runtimes?: Record<string, { signers?: Array<{ entityId?: string; address?: string }> }> };
        const signer = Object.values(vaults.runtimes ?? {})[0]?.signers?.[0];
        return signer?.entityId && signer.address ? { entityId: signer.entityId.toLowerCase(), signerId: signer.address.toLowerCase() } : null;
      }), { timeout: 60_000 })
      .not.toBeNull()
      .then(() => page.evaluate(() => {
        const vaults = JSON.parse(localStorage.getItem('xln-vaults') || '{}') as { runtimes?: Record<string, { signers?: Array<{ entityId?: string; address?: string }> }> };
        const signer = Object.values(vaults.runtimes ?? {})[0]!.signers![0]!;
        return { entityId: signer.entityId!.toLowerCase(), signerId: signer.address!.toLowerCase() };
      }));
    // Open an Account with the first hub through the Accounts workspace.
    await page.getByRole('button', { name: 'Connect', exact: true }).first().click();
    await expect.poll(() => firstAccount(page, wallet.entityId, wallet.signerId), { timeout: 120_000 }).not.toBeNull();
    const before = (await firstAccount(page, wallet.entityId, wallet.signerId))!;

    const steward = HDNodeWallet.createRandom();
    const stewardEntityId = '0x' + steward.address.slice(2).toLowerCase().padStart(64, '0');
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
    await page.getByTestId('steward-pin-label').fill('Ledger');
    await page.getByTestId('steward-pin-entity').fill(stewardEntityId);
    await page.getByTestId('steward-pin-signer').fill(steward.address);
    await page.getByTestId('steward-pin-save').click();
    await expect(page.getByTestId('steward-unpin')).toBeVisible();

    const now = Date.now();
    const target = BigInt(before.limit) + 7_000_000n;
    const request = (nonce: string, amount: bigint, note: string): StewardRequestBody => ({
      domain: 'xln-steward-request',
      v: 1,
      entityId: wallet.entityId.toLowerCase(),
      stewardEntityId,
      stewardSigner: steward.address.toLowerCase(),
      nonce,
      createdAt: now,
      expiresAt: now + 60 * 60 * 1000,
      facts: [{ kind: 'credit-limit', counterparty: before.counterparty, tokenId: 1, amount: amount.toString() }],
      note,
    });

    const raiseLink = await signStewardRequest(request('d4d4d4d4d4d4d4d4', target, 'Your hub asked for more room this week.'), steward);
    await openLink(page, raiseLink);
    const sheet = page.getByTestId('sign-sheet');
    await expect(sheet).toBeVisible(WAIT);
    await expect(sheet).toContainText('Ledger');
    await expect(sheet.getByTestId('sign-sheet-fact')).toContainText('owe you up to');
    await expect(sheet.getByTestId('sign-sheet-note')).toHaveText('Your hub asked for more room this week.');
    const sign = sheet.getByTestId('sign-sheet-sign');
    await expect(sign).toHaveAttribute('data-hold', 'required');
    const shot = process.env['STEWARD_SHEET_SCREENSHOT'];
    if (shot) await sheet.screenshot({ path: shot });

    await sign.hover();
    await page.mouse.down();
    await page.waitForTimeout(300);
    await page.mouse.up();
    await page.waitForTimeout(1_200);
    await expect(sheet).toBeVisible();
    expect((await firstAccount(page, wallet.entityId, wallet.signerId))?.limit).toBe(before.limit);

    await sign.hover();
    await page.mouse.down();
    await page.waitForTimeout(1_300);
    await page.mouse.up();
    await expect(page.getByTestId('sign-sheet-outcome')).toHaveAttribute('data-state', 'signed', WAIT);
    expect((await firstAccount(page, wallet.entityId, wallet.signerId))?.limit).toBe(target.toString());
    await page.getByTestId('sign-sheet-outcome').getByRole('button', { name: 'Done' }).click();

    await openLink(page, raiseLink);
    await expect(page.getByTestId('sign-sheet-answered')).toBeVisible(WAIT);
    await page.getByTestId('sign-sheet-answered').getByRole('button', { name: 'Close' }).click();

    await openLink(page, await signStewardRequest(request('e5e5e5e5e5e5e5e5', target + 5_000_000n, 'And a little more.'), steward));
    await expect(page.getByTestId('sign-sheet')).toBeVisible(WAIT);
    await page.getByTestId('sign-sheet-decline').click();
    await expect(page.getByTestId('sign-sheet-outcome')).toHaveAttribute('data-state', 'declined', WAIT);
    expect((await firstAccount(page, wallet.entityId, wallet.signerId))?.limit).toBe(target.toString());
    await page.getByTestId('sign-sheet-outcome').getByRole('button', { name: 'Done' }).click();

    const stranger = new Wallet('0x' + '42'.repeat(32));
    const forged = { ...request('f6f6f6f6f6f6f6f6', target * 10n, 'Trust me.'), stewardSigner: stranger.address.toLowerCase() };
    await openLink(page, await signStewardRequest(forged, stranger));
    await expect(page.getByTestId('sign-sheet-refused')).toHaveAttribute('data-reason', 'wrong-signer', WAIT);
    await expect(page.getByTestId('sign-sheet')).toHaveCount(0);
    expect(errors).toEqual([]);
  },
);
