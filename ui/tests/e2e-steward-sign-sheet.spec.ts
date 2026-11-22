/**
 * A steward asks; only the person signs.
 *
 * The steward is an agent with its own key, outside the wallet. The person pins it in Settings.
 * The steward signs a request for a credit change; the person opens the link, reads the facts the
 * wallet built from it, and holds Sign. The wallet sends the batch as the person's own
 * transaction, and the sheet says "committed" only once committed state shows the new limit.
 * A second request is declined and changes nothing. A request signed by another key is refused,
 * and an answered request does not reopen.
 */
import { expect, test, type Page } from '@playwright/test';
import { HDNodeWallet, Wallet } from 'ethers';
import type { RuntimeAdapterViewFrame, XLNModule } from '../../core/api/public/runtime-module';
import type { RuntimeAdapter } from '../../core/api/runtime-adapter/types';
import { signStewardRequest, type StewardRequestBody } from '../../frontend/src/lib/governance/steward-request';
import { enterStack } from './stack';

const WAIT = { timeout: 30_000 };
type DebugWindow = Window & { __xln?: { adapter(): RuntimeAdapter | null; xln(): Promise<XLNModule> } };

/** The wallet's first Account and the limit it extends to that counterparty, from committed state. */
async function firstAccount(page: Page, entityId: string): Promise<{ counterparty: string; limit: string } | null> {
  return page.evaluate(async owner => {
    const debug = (window as DebugWindow).__xln;
    const adapter = debug?.adapter();
    if (!debug || !adapter) throw new Error('Wallet adapter unavailable');
    const view = await adapter.read<RuntimeAdapterViewFrame>('view-frame', { entityId: owner });
    const account = view.activeEntity?.accounts.items[0];
    const delta = account?.state.deltas.get(1);
    if (!account || !delta || account.pendingFrame) return null;
    const isLeft = account.state.leftEntity.toLowerCase() === owner;
    const counterparty = (isLeft ? account.state.rightEntity : account.state.leftEntity).toLowerCase();
    return { counterparty, limit: String((await debug.xln()).deriveDelta(delta, isLeft).peerCreditLimit) };
  }, entityId.toLowerCase());
}

const openLink = async (page: Page, fragment: string): Promise<void> => {
  await page.evaluate(value => {
    window.location.hash = value;
  }, fragment);
};

test(
  'a pinned steward asks for a credit change; the person holds to sign, declines the next, and a stranger is refused',
  { tag: '@functional' },
  async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const wallet = await enterStack(page);
    const before = await firstAccount(page, wallet.entityId);
    if (!before) throw new Error('STEWARD_E2E_ACCOUNT_MISSING');

    // The steward is an agent: its own key and its own Entity, never inside this wallet.
    const steward = HDNodeWallet.createRandom();
    const stewardEntityId = '0x' + steward.address.slice(2).toLowerCase().padStart(64, '0');
    await page.getByTestId('nav-settings').locator('visible=true').first().click();
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

    // The steward's request opens as a sheet built from its facts; its words stay a labelled note.
    const raiseLink = await signStewardRequest(request('a1a1a1a1a1a1a1a1', target, 'Your hub asked for more room this week.'), steward);
    await openLink(page, raiseLink);
    const sheet = page.getByTestId('sign-sheet');
    await expect(sheet).toBeVisible(WAIT);
    await expect(sheet).toContainText('Ledger');
    await expect(sheet.getByTestId('sign-sheet-fact')).toContainText('owe you up to');
    await expect(sheet.getByTestId('sign-sheet-note')).toHaveText('Your hub asked for more room this week.');
    const sign = sheet.getByTestId('sign-sheet-sign');
    await expect(sign).toHaveAttribute('data-hold', 'required');
    await expect(sign).toContainText('Hold to raise to');
    const shot = process.env['STEWARD_SHEET_SCREENSHOT'];
    if (shot) await sheet.screenshot({ path: shot });

    // A press shorter than the hold signs nothing.
    await sign.hover();
    await page.mouse.down();
    await page.waitForTimeout(300);
    await page.mouse.up();
    await page.waitForTimeout(1_200);
    await expect(sheet).toBeVisible();
    expect((await firstAccount(page, wallet.entityId))?.limit).toBe(before.limit);

    // A full hold signs; "committed" appears only once committed state shows the new limit.
    await sign.hover();
    await page.mouse.down();
    await page.waitForTimeout(1_300);
    await page.mouse.up();
    await expect(page.getByTestId('sign-sheet-outcome')).toHaveAttribute('data-state', 'signed', WAIT);
    expect((await firstAccount(page, wallet.entityId))?.limit).toBe(target.toString());
    await page.getByTestId('sign-sheet-outcome').getByRole('button', { name: 'Done' }).click();

    // The same link does not reopen as a sheet.
    await openLink(page, raiseLink);
    await expect(page.getByTestId('sign-sheet-answered')).toBeVisible(WAIT);
    await page.getByTestId('sign-sheet-answered').getByRole('button', { name: 'Close' }).click();

    // A second request is declined: nothing moves.
    await openLink(page, await signStewardRequest(request('b2b2b2b2b2b2b2b2', target + 5_000_000n, 'And a little more.'), steward));
    await expect(page.getByTestId('sign-sheet')).toBeVisible(WAIT);
    await page.getByTestId('sign-sheet-decline').click();
    await expect(page.getByTestId('sign-sheet-outcome')).toHaveAttribute('data-state', 'declined', WAIT);
    expect((await firstAccount(page, wallet.entityId))?.limit).toBe(target.toString());
    await page.getByTestId('sign-sheet-outcome').getByRole('button', { name: 'Done' }).click();

    // A request signed by any other key is refused before it is read.
    const stranger = new Wallet('0x' + '42'.repeat(32));
    const forged = { ...request('c3c3c3c3c3c3c3c3', target * 10n, 'Trust me.'), stewardSigner: stranger.address.toLowerCase() };
    await openLink(page, await signStewardRequest(forged, stranger));
    await expect(page.getByTestId('sign-sheet-refused')).toHaveAttribute('data-reason', 'wrong-signer', WAIT);
    await expect(page.getByTestId('sign-sheet')).toHaveCount(0);
    expect((await firstAccount(page, wallet.entityId))?.limit).toBe(target.toString());
    expect(errors).toEqual([]);
  },
);
