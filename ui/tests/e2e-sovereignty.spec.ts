import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { RuntimeAdapterViewFrame } from '../../core/api/public/runtime-module';
import type { RuntimeAdapter } from '../../core/api/runtime-adapter/types';
import { deriveRuntimeRecoveryLookupKey } from '../../core/storage/recovery/bundle/crypto';
import { enterStack, fundFromHub } from './stack';

/** The stand runs its own watchtower; a deployed stack names its own. */
const TOWER_URL = process.env['UI_E2E_TOWER_URL'] || 'http://127.0.0.1:9100';

/** The tower's own answer, asked from outside the browser: it must hold a bundle under our blind lookup key. */
async function towerHolds(lookupKey: string): Promise<{ available: boolean; height: number; storedBytes: number }> {
  const response = await fetch(`${TOWER_URL}/api/recovery/discover`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lookupKey }),
  });
  const payload = (await response.json()) as {
    ok?: boolean;
    available?: boolean;
    latestReceipt?: { height?: number; storedBytes?: number };
  };
  if (!response.ok || payload.ok !== true) throw new Error(`TOWER_DISCOVER_FAILED:${response.status}`);
  return {
    available: payload.available === true,
    height: Number(payload.latestReceipt?.height ?? 0),
    storedBytes: Number(payload.latestReceipt?.storedBytes ?? 0),
  };
}

type DebugWindow = Window & { __xln?: { adapter: () => RuntimeAdapter | null } };
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const hashPattern = /^0x[0-9a-f]{64}$/i;
const hankoPattern = /^0x(?:[0-9a-f]{2})+$/i;

function readHex(record: Record<string, unknown>, field: string, pattern = hashPattern): string {
  const value = record[field];
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`Invalid evidence ${field}`);
  return value;
}

function readHeight(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error(`Invalid evidence ${field}`);
  return value;
}

function parseAccount(value: unknown) {
  if (!isRecord(value) || !isRecord(value.disputeProof)) throw new Error('Invalid evidence Account or dispute proof');
  const proof = value.disputeProof;
  return {
    counterpartyId: readHex(value, 'counterpartyId'),
    leftEntity: readHex(value, 'leftEntity'),
    rightEntity: readHex(value, 'rightEntity'),
    height: readHeight(value, 'height'),
    frameHash: readHex(value, 'frameHash'),
    accountStateRoot: readHex(value, 'accountStateRoot'),
    prevFrameHash: readHex(value, 'prevFrameHash'),
    jHeight: readHeight(value, 'jHeight'),
    ourFrameHanko: readHex(value, 'ourFrameHanko', hankoPattern),
    theirFrameHanko: readHex(value, 'theirFrameHanko', hankoPattern),
    disputeProof: {
      ourHanko: readHex(proof, 'ourHanko', hankoPattern),
      ourNonce: readHeight(proof, 'ourNonce'),
      ourBodyHash: readHex(proof, 'ourBodyHash'),
      theirHanko: readHex(proof, 'theirHanko', hankoPattern),
      theirNonce: readHeight(proof, 'theirNonce'),
      theirBodyHash: readHex(proof, 'theirBodyHash'),
    },
  };
}

function parseEvidence(text: string) {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || value.format !== 'xln-wallet-evidence/1' || !Array.isArray(value.accounts))
    throw new Error('Invalid wallet evidence format or Accounts');
  const accounts = value.accounts.map(parseAccount);
  if (accounts.length === 0 || new Set(accounts.map(account => account.counterpartyId)).size !== accounts.length)
    throw new Error('Evidence Accounts are empty or duplicated');
  return {
    entityId: readHex(value, 'entityId'),
    runtimeHeight: readHeight(value, 'runtimeHeight'),
    entityHeight: readHeight(value, 'entityHeight'),
    accounts,
  };
}

/** Compare the downloaded proof with the wallet's committed read surface, without creating or signing any evidence. */
const readSignedSnapshot = (page: Page, entityId: string, atHeight?: number) =>
  page.evaluate(
    async query => {
      const debug = (window as DebugWindow).__xln;
      if (!debug) throw new Error('Wallet diagnostics unavailable');
      const adapter = debug.adapter();
      if (!adapter) throw new Error('Sovereignty adapter unavailable');
      const frame = await adapter.read<RuntimeAdapterViewFrame>('view-frame', query);
      const entity = frame.activeEntity;
      if (!entity || frame.activeEntityId !== query.entityId) throw new Error('Sovereignty snapshot owner mismatch');
      if (entity.accounts.nextCursor !== null) throw new Error('Fresh evidence fixture exceeds one Account page');
      return {
        entityId: frame.activeEntityId,
        runtimeHeight: frame.height,
        entityHeight: entity.core.height,
        drained: entity.accounts.items.every(account => !account.pendingFrame && account.mempoolCount === 0),
        accounts: entity.accounts.items.map(account => ({
          counterpartyId:
            account.state.leftEntity === query.entityId ? account.state.rightEntity : account.state.leftEntity,
          leftEntity: account.state.leftEntity,
          rightEntity: account.state.rightEntity,
          height: account.currentHeight,
          frameHash: account.currentFrame.stateHash,
          accountStateRoot: account.currentFrame.accountStateRoot,
          prevFrameHash: account.currentFrame.prevFrameHash,
          jHeight: account.currentFrame.jHeight,
          ourFrameHanko: account.currentFrameHanko,
          theirFrameHanko: account.counterpartyFrameHanko,
          disputeProof: {
            ourHanko: account.currentDisputeProofHanko,
            ourNonce: account.currentDisputeProofNonce,
            ourBodyHash: account.currentDisputeProofBodyHash,
            theirHanko: account.counterpartyDisputeProofHanko,
            theirNonce: account.counterpartyDisputeProofNonce,
            theirBodyHash: account.counterpartyDisputeProofBodyHash,
          },
        })),
      };
    },
    { entityId, ...(atHeight === undefined ? {} : { atHeight }) },
  );

test(
  'exports the actual funded Account signatures, then opens Desk and Pay through the palette',
  { tag: '@functional' },
  async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const wallet = await enterStack(page);
    const fundingResponse = page.waitForResponse(
      response => new URL(response.url()).pathname === '/api/faucet/offchain' && response.request().method() === 'POST',
    );
    await Promise.all([
      fundFromHub(page, '100'),
      fundingResponse.then(async response => expect(response.ok(), await response.text()).toBe(true)),
    ]);
    await expect(page.getByTestId('token-net-USDC')).toHaveText('100.00');
    await expect(page.getByTestId('home-risk')).toContainText('$100.00');
    await expect
      .poll(async () => (await readSignedSnapshot(page, wallet.entityId)).drained, { timeout: 15_000 })
      .toBe(true);
    const before = await readSignedSnapshot(page, wallet.entityId);
    expect(before.accounts.length).toBeGreaterThan(0);

    await page.getByTestId('home-sovereignty').click();
    await expect(page.getByTestId('sovereignty-hero')).toBeVisible();
    await expect(page.getByTestId('sovereignty-risk')).toContainText('$100.00');
    await expect(page.getByTestId('sovereignty-ledger')).toContainText('Accounts co-signed');
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('evidence-export').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^xln-evidence-.*\.json$/);
    expect(await download.failure()).toBeNull();
    const path = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(path);
    const bundle = parseEvidence(await readFile(path, 'utf8'));
    expect(bundle.entityId).toBe(wallet.entityId);
    const committed = await readSignedSnapshot(page, wallet.entityId, bundle.runtimeHeight);
    expect(committed.runtimeHeight).toBe(bundle.runtimeHeight);
    expect(committed.entityHeight).toBe(bundle.entityHeight);
    expect(bundle.accounts).toHaveLength(committed.accounts.length);
    for (const account of bundle.accounts) {
      expect([account.leftEntity, account.rightEntity]).toContain(wallet.entityId);
      const exact = committed.accounts.find(candidate => candidate.counterpartyId === account.counterpartyId);
      expect(exact, 'the exported signatures and roots belong to this committed Account').toEqual(account);
      const funded = before.accounts.find(candidate => candidate.counterpartyId === account.counterpartyId);
      expect(funded, 'the export contains the latest funded Account, not older signed evidence').toEqual(account);
    }
    await testInfo.attach('signed-evidence-download', { path, contentType: 'application/json' });
    await page.screenshot({ path: testInfo.outputPath('sovereignty-funded.png'), fullPage: true });
    console.log(
      `EVIDENCE_EXACT entity=${bundle.entityId} runtimeHeight=${bundle.runtimeHeight} accounts=${bundle.accounts.length} frameAndDisputeHankos=${bundle.accounts.length * 4}`,
    );

    // The watchtower the tour promises: nobody is watching until the person names a tower,
    // and "protecting you" is the tower's own answer, not a saved preference.
    const lookupKey = deriveRuntimeRecoveryLookupKey(wallet.runtimeId, wallet.phrase);
    expect(await towerHolds(lookupKey), 'a fresh wallet is not backed up anywhere').toMatchObject({ available: false });
    await expect(page.getByTestId('sovereignty-watchtower')).toHaveAttribute('data-covered', 'no');
    await expect(page.getByTestId('watchtower-state')).toHaveText('not backed up');
    await expect(page.getByTestId('watchtower-coverage-lastresort')).toContainText(
      'No appointments verified in this session',
    );
    await page.getByTestId('watchtower-url').fill(TOWER_URL);
    await page.getByTestId('watchtower-add').click();
    await expect(page.getByTestId('sovereignty-watchtower')).toHaveAttribute('data-covered', 'yes', {
      timeout: 30_000,
    });
    await expect(page.getByTestId('watchtower-row')).toHaveCount(1);
    await expect(page.getByTestId('watchtower-row')).toContainText('holding your frame #');
    const stored = await towerHolds(lookupKey);
    expect(stored.available, 'the tower now holds this wallet under its blind lookup key').toBe(true);
    expect(stored.height).toBeGreaterThanOrEqual(before.runtimeHeight);
    expect(stored.storedBytes).toBeGreaterThan(0);
    await expect(page.getByTestId('watchtower-coverage-backup')).toContainText(
      `#${stored.height.toLocaleString('en-US')}`,
    );
    await expect(page.getByTestId('watchtower-coverage-accounts')).toContainText(String(before.accounts.length));
    console.log(`WATCHTOWER_BACKUP tower=${TOWER_URL} height=${stored.height} storedBytes=${stored.storedBytes}`);
    const appointmentResponse = page.waitForResponse(
      response =>
        response.request().method() === 'PUT' &&
        response.url().includes('watchtower-proxy') &&
        response.request().postDataJSON()?.towerMode === 'delayed_last_resort',
    );
    await page.getByTestId('protection-appoint').click();
    const accepted = await appointmentResponse;
    expect(accepted.ok()).toBe(true);
    const { receipt } = await accepted.json();
    expect(receipt.towerMode).toBe('delayed_last_resort');
    expect(receipt.appointmentSequence).toBeGreaterThan(0);
    expect(receipt.expiresAt).toBeGreaterThan(Date.now());
    await expect(page.getByTestId('protection-state')).toContainText('account appointment receipts received');
    await page.getByTestId('watchtower-coverage-lastresort').locator('summary').first().click();
    await expect(page.getByTestId('watchtower-coverage-lastresort')).toContainText('Proof hash');
    await testInfo.attach('tower-protection-receipt', {
      body: JSON.stringify(receipt),
      contentType: 'application/json',
    });

    await page.getByTestId('watchtower-remove').click();
    await expect(page.getByTestId('watchtower-row')).toHaveCount(0);
    await expect(page.getByTestId('watchtower-state')).toHaveText('not backed up');
    await expect(page.getByTestId('watchtower-mode-local')).toHaveClass(/active/);

    await page.getByRole('link', { name: 'Settings' }).first().click();
    await page.getByTestId('density-desk').click();
    await page.getByRole('link', { name: 'Home' }).first().click();
    await expect(page.getByTestId('desk')).toBeVisible();
    await expect(page.getByTestId('desk-table').locator('tbody tr')).not.toHaveCount(0);
    await expect(page.getByTestId('desk-net')).toContainText('$100.00');
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
    await expect(page.getByTestId('palette')).toBeVisible();
    await page.getByTestId('palette-input').fill('pay');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/pay/);
    await page.getByRole('link', { name: 'Settings' }).first().click();
    await page.getByTestId('density-comfort').click();
    expect(pageErrors).toEqual([]);
  },
);
