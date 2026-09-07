import { expect, test, type Browser, type Page } from '../../global-setup.mts';
import { Interface } from 'ethers';

import { ensureE2EBaseline, APP_BASE_URL } from '../../utils/e2e-baseline';
import { createRuntimeIdentity, gotoApp, selectDemoMnemonic } from '../../utils/e2e-demo-users';
import { connectHub } from '../../utils/e2e-connect';
import { getRenderedExternalBalance, getRenderedReserveBalance } from '../../utils/runtime/e2e-account-ui';
import { startDisputeFromManageUi } from '../../utils/e2e-account-workspace';
import { capturePageScreenshot } from '../../utils/e2e-screenshots';
import { enqueueEntityTxs, enqueueRuntimeInput } from '../../utils/runtime/e2e-runtime-input';
import { safeStringify } from '../../../core/protocol/serialization';
import { RemoteRuntimeAdapter } from '../../../core/api/runtime-adapter/remote';
import type { StorageEntityCoreDoc, StorageAccountDoc } from '../../../core/storage/types';
import { deriveDelta, getTokenInfo } from '../../../core/account/utils';

const TOKEN_ID_USDC = 1;
const TOKEN_DECIMALS = getTokenInfo(TOKEN_ID_USDC).decimals;
const TOKEN_SCALE = 10n ** BigInt(TOKEN_DECIMALS);
const USD_150 = (150n * TOKEN_SCALE).toString();
const ERC20_BALANCE_OF = new Interface(['function balanceOf(address) view returns (uint256)']);
const DEPOSITORY_BATCH_EVENTS = new Interface([
  'event HankoBatchProcessed(bytes32 indexed entityId, bytes32 indexed batchHash, uint256 nonce)',
]);
const DEPOSITORY_RESERVES = new Interface([
  'function _reserves(bytes32 entity, uint256 tokenId) view returns (uint256)',
]);
const LONG_E2E = process.env.E2E_LONG === '1';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function relayToApiBase(relayUrl: string | null): string | null {
  if (!relayUrl) return null;
  try {
    const relay = new URL(relayUrl);
    const protocol = relay.protocol === 'wss:' ? 'https:' : relay.protocol === 'ws:' ? 'http:' : relay.protocol;
    return `${protocol}//${relay.host}`;
  } catch {
    return null;
  }
}

async function getActiveApiBase(page: Page): Promise<string> {
  if (process.env.E2E_API_BASE_URL) return process.env.E2E_API_BASE_URL;
  const relayUrl = await page.evaluate(() => {
    const relay = (window as any).__xln?.runtimeConnectivity?.relayUrls?.[0];
    return typeof relay === 'string' ? relay : null;
  });
  return relayToApiBase(relayUrl) ?? APP_BASE_URL;
}

type RuntimeRef = {
  entityId: string;
  signerId: string;
  runtimeId: string;
};

type DebtSnapshot = {
  debtId: string;
  direction: 'out' | 'in';
  status: string;
  createdAmount: bigint;
  paidAmount: bigint;
  remainingAmount: bigint;
};

async function newRuntimePage(browser: Browser, label: 'alice' | 'bob'): Promise<{ page: Page; runtime: RuntimeRef }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await gotoApp(page, { appBaseUrl: APP_BASE_URL });
  const runtime = await createRuntimeIdentity(page, label, selectDemoMnemonic(label));
  return { page, runtime };
}

async function readFirstHubId(page: Page): Promise<string> {
  const health = await ensureE2EBaseline(page, { requireMarketMaker: false });
  const hubId = health.hubMesh?.hubIds?.[0];
  expect(typeof hubId === 'string' && hubId.length > 0, 'hub id must exist').toBe(true);
  return hubId!;
}

async function getApiToken(page: Page, symbol: string): Promise<{ address: string; tokenId: number }> {
  const response = await page.request.get(`${APP_BASE_URL}/api/tokens`);
  expect(response.ok(), 'token catalog request must succeed').toBe(true);
  const body = await response.json().catch(() => ({})) as {
    tokens?: Array<{ symbol?: string; address?: string; tokenId?: number }>;
  };
  const match = Array.isArray(body.tokens)
    ? body.tokens.find((entry) => String(entry.symbol || '').toUpperCase() === symbol.toUpperCase())
    : null;
  expect(match?.address, `token ${symbol} must exist`).toBeTruthy();
  expect(typeof match?.tokenId === 'number', `token ${symbol} must have tokenId`).toBe(true);
  return { address: String(match!.address), tokenId: Number(match!.tokenId) };
}

async function rpcCall<T>(page: Page, method: string, params: unknown[]): Promise<T> {
  const apiBase = await getActiveApiBase(page);
  const response = await page.request.post(`${apiBase}/rpc`, {
    data: { jsonrpc: '2.0', id: 1, method, params },
  });
  expect(response.ok(), `${method} RPC must succeed`).toBe(true);
  const body = await response.json().catch(() => ({})) as { error?: unknown; result?: T };
  expect(body.error, `${method} RPC must not return error: ${safeStringify(body.error || null)}`).toBeUndefined();
  return body.result as T;
}

async function getRpcExternalBalanceRaw(page: Page, symbol: string, holder: string): Promise<bigint> {
  const token = await getApiToken(page, symbol);
  const raw = await rpcCall<string>(page, 'eth_call', [
    {
      to: token.address,
      data: ERC20_BALANCE_OF.encodeFunctionData('balanceOf', [holder]),
    },
    'latest',
  ]);
  return BigInt(raw || '0x0');
}

async function getDepositoryAddress(page: Page): Promise<string> {
  const apiBase = await getActiveApiBase(page);
  const response = await page.request.get(`${apiBase}/api/jurisdictions?ts=${Date.now()}`);
  expect(response.ok(), 'jurisdictions request must succeed').toBe(true);
  const body = await response.json().catch(() => ({} as Record<string, unknown>));
  const root = (body?.jurisdictions && typeof body.jurisdictions === 'object')
    ? body.jurisdictions as Record<string, unknown>
    : body;
  const jurisdictions = Object.values(root || {}) as Array<Record<string, unknown>>;
  const depository = jurisdictions
    .map((entry) => String((entry?.contracts as Record<string, unknown> | undefined)?.depository || entry?.depository || '').trim())
    .find((value) => /^0x[a-fA-F0-9]{40}$/.test(value));
  expect(depository, 'depository address must exist').toBeTruthy();
  return depository!;
}

async function readOnchainReserveBalanceRaw(page: Page, entityId: string, symbol: string): Promise<bigint> {
  const token = await getApiToken(page, symbol);
  const depository = await getDepositoryAddress(page);
  const raw = await rpcCall<string>(page, 'eth_call', [
    {
      to: depository,
      data: DEPOSITORY_RESERVES.encodeFunctionData('_reserves', [entityId, token.tokenId]),
    },
    'latest',
  ]);
  const [reserve] = DEPOSITORY_RESERVES.decodeFunctionResult('_reserves', raw);
  return BigInt(reserve);
}

async function openAccountsWorkspace(page: Page): Promise<void> {
  const backButton = page.getByTestId('account-panel-back').first();
  if (await backButton.isVisible().catch(() => false)) {
    await backButton.click();
  }
  const accountsTab = page.getByTestId('tab-accounts').first();
  if (await accountsTab.isVisible().catch(() => false)) {
    await accountsTab.click();
    return;
  }
  const navAccounts = page.getByRole('button', { name: /^Accounts$/i }).first();
  if (await navAccounts.isVisible().catch(() => false)) {
    await navAccounts.click();
    return;
  }
  const accountWorkspaceNav = page.locator('nav[aria-label="Account workspace"]').first();
  await expect(accountWorkspaceNav).toBeVisible({ timeout: 20_000 });
}

async function openEntityHistory(page: Page): Promise<void> {
  // Dispute preparation freezes the only Account and removes its workspace tabs.
  // Entity batch history remains reachable through Assets throughout finality.
  await openAssetsTab(page);
  const history = page.getByTestId('asset-tab-history');
  await expect(history).toBeVisible({ timeout: 20_000 });
  await history.click();
  await expect(history).toHaveClass(/active/);
}

async function openAssetsTab(page: Page): Promise<void> {
  const tab = page.getByTestId('tab-assets').first();
  await expect(tab).toBeVisible({ timeout: 20_000 });
  await tab.click();
  await expect(page.getByTestId('asset-ledger-refresh').first()).toBeVisible({ timeout: 20_000 });
}

async function ensureSelfEntitySelected(page: Page, entityId: string): Promise<void> {
  const headerEntity = page.locator('.wallet-meta-value').first();
  const current = String((await headerEntity.textContent().catch(() => '')) || '').trim().toLowerCase();
  if (current === entityId.toLowerCase()) return;

  const trigger = page.locator('.context-switcher .dropdown-trigger, .context-switcher .pill-trigger').first();
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.click();

  const runtimeMain = page.locator('.context-switcher .runtime-main').first();
  await expect(runtimeMain).toBeVisible({ timeout: 10_000 });
  await runtimeMain.click();

  await expect
    .poll(async () => String((await headerEntity.textContent().catch(() => '')) || '').trim().toLowerCase(), {
      timeout: 15_000,
      intervals: [200, 400, 800],
      message: 'self entity must be active before move flow',
    })
    .toBe(entityId.toLowerCase());
}

async function readAccountProgress(
  page: Page,
  entityId: string,
  signerId: string,
  counterpartyId: string,
): Promise<{
  exists: boolean;
  pendingFrame: boolean;
  currentHeight: number;
  entityHeight?: number;
  mempoolTxs?: string[];
  pendingFrameTxs?: string[];
  pendingInputKind?: string;
  proposals?: Array<{ status: string; txs: string[] }>;
  lastMessages?: string[];
}> {
  return page.evaluate(({ entityId, signerId, counterpartyId }) => {
    const env = (window as any).isolatedEnv;
    if (!env?.state?.eReplicas) return { exists: false, pendingFrame: false, currentHeight: 0 };
    const key = Array.from(env.state.eReplicas.keys()).find((k: string) => {
      const [eid, sid] = String(k).split(':');
      return String(eid || '').toLowerCase() === String(entityId).toLowerCase()
        && String(sid || '').toLowerCase() === String(signerId).toLowerCase();
    });
    const rep = key ? env.state.eReplicas.get(key) : null;
    const account = rep?.state?.accounts?.get?.(counterpartyId);
    return {
      exists: !!account,
      pendingFrame: !!account?.pendingFrame,
      currentHeight: Number(account?.currentHeight || 0),
      entityHeight: Number(rep?.state?.height || 0),
      mempoolTxs: Array.isArray(account?.mempool)
        ? account.mempool.map((tx: any) => String(tx?.type || 'unknown'))
        : [],
      pendingFrameTxs: Array.isArray(account?.pendingFrame?.accountTxs)
        ? account.pendingFrame.accountTxs.map((tx: any) => String(tx?.type || 'unknown'))
        : [],
      pendingInputKind: String(account?.pendingAccountInput?.kind || ''),
      proposals: rep?.state?.proposals instanceof Map
        ? Array.from(rep.state.proposals.values()).map((proposal: any) => ({
            status: String(proposal?.status || ''),
            txs: Array.isArray(proposal?.action?.data?.txs)
              ? proposal.action.data.txs.map((tx: any) => String(tx?.type || 'unknown'))
              : [],
          }))
        : [],
      lastMessages: Array.isArray(rep?.state?.messages)
        ? rep.state.messages.slice(-5).map((message: unknown) => String(message))
        : [],
    };
  }, { entityId, signerId, counterpartyId });
}

// Explicit counts/booleans only: never log transactions or transport payloads.
async function readAccountOpenDiagnostic(page: Page, entityId: string, signerId: string, counterpartyId: string) {
  return page.evaluate(({ entityId, signerId, counterpartyId }) => {
    const env = (window as any).isolatedEnv;
    const connectivity = (window as any).__xln?.runtimeConnectivity;
    const key = Array.from(env?.state?.eReplicas?.keys?.() ?? []).find((key) =>
      String(key).toLowerCase() === `${entityId}:${signerId}`.toLowerCase());
    const replica = key ? env.state.eReplicas.get(key) : null;
    const account = replica?.state?.accounts?.get?.(counterpartyId);
    const profiles = env?.gossip?.getProfiles?.() ?? [];
    const profile = profiles.find((item: any) => String(item.entityId).toLowerCase() === counterpartyId.toLowerCase());
    return {
      exists: Boolean(account), entityHeight: Number(replica?.state?.height ?? 0),
      accountHeight: Number(account?.currentHeight ?? 0), pendingFrame: Boolean(account?.pendingFrame),
      pendingAck: account?.pendingAccountInput?.kind === 'ack_frame', mempoolCount: account?.mempool?.length ?? 0,
      pendingFrameTxCount: account?.pendingFrame?.accountTxs?.length ?? 0,
      targetProfileExists: Boolean(profile), targetRuntimeRouteExists: Boolean(profile?.runtimeId),
      targetAdvertisesSelf: (profile?.accounts ?? []).some((item: any) =>
        String(item.counterpartyId).toLowerCase() === entityId.toLowerCase()),
      targetAdvertisedAccountCount: profile?.accounts?.length ?? 0, profileCount: profiles.length,
      connected: connectivity?.connected ?? null, connecting: connectivity?.connecting ?? null,
      discoveryAvailable: typeof connectivity?.ensureProfiles === 'function',
      outboundTargetCount: connectivity?.queue?.targetCount ?? null,
      outboundMessageCount: connectivity?.queue?.totalMessages ?? null,
      oldestOutboundAgeMs: connectivity?.queue?.oldestEntryAge ?? null,
    };
  }, { entityId, signerId, counterpartyId });
}

async function ensurePrivateAccountOpenWithClock(
  page: Page,
  entityId: string,
  signerId: string,
  counterpartyId: string,
  responseSeconds: number,
  peer: { page: Page; runtime: RuntimeRef },
): Promise<void> {
  const already = await readAccountProgress(page, entityId, signerId, counterpartyId);
  if (already.exists && !already.pendingFrame && already.currentHeight > 0) return;

  await enqueueEntityTxs(page, entityId, signerId, [{
    type: 'openAccount',
    data: {
      targetEntityId: counterpartyId,
      disputeConfig: {
        leftResponseSeconds: responseSeconds,
        rightResponseSeconds: responseSeconds,
      },
      tokenId: TOKEN_ID_USDC,
      creditAmount: 0n,
    },
  }]);

  const waitStarted = Date.now();
  let capturedPending = false;
  await expect
    .poll(async () => {
      const state = await readAccountProgress(page, entityId, signerId, counterpartyId);
      const ready = state.exists && !state.pendingFrame && state.currentHeight > 0;
      if (!ready && !capturedPending && Date.now() - waitStarted >= 10_000) {
        capturedPending = true;
        const [local, remote] = await Promise.all([
          readAccountOpenDiagnostic(page, entityId, signerId, counterpartyId),
          readAccountOpenDiagnostic(peer.page, peer.runtime.entityId, peer.runtime.signerId, entityId),
        ]);
        console.log(`[debt-e2e] account-open-pending ${safeStringify({ local, remote })}`);
      }
      return ready;
    }, { timeout: 60_000, intervals: [500, 1000, 2000] })
    .toBe(true);
}

async function readJBatchSnapshot(
  page: Page,
  entityId: string,
  signerId: string,
): Promise<{
  pendingDisputeStarts: number;
  pendingDisputeFinalizations: number;
  sentDisputeStarts: number;
  sentDisputeFinalizations: number;
  sentExists: boolean;
  lastFinalizedJHeight: number;
  entityNonce: number;
  mempoolTxTypes: string[];
  hasProposal: boolean;
  hasLockedFrame: boolean;
  recentMessages: string[];
}> {
  return page.evaluate(({ entityId, signerId }) => {
    const env = (window as any).isolatedEnv;
    if (!env?.state?.eReplicas) {
      return {
        pendingDisputeStarts: 0,
        pendingDisputeFinalizations: 0,
        sentDisputeStarts: 0,
        sentDisputeFinalizations: 0,
        sentExists: false,
        lastFinalizedJHeight: 0,
        entityNonce: 0,
        mempoolTxTypes: [],
        hasProposal: false,
        hasLockedFrame: false,
        recentMessages: [],
      };
    }
    const key = Array.from(env.state.eReplicas.keys()).find((k: string) => {
      const [eid, sid] = String(k).split(':');
      return String(eid || '').toLowerCase() === String(entityId).toLowerCase()
        && String(sid || '').toLowerCase() === String(signerId).toLowerCase();
    });
    const rep = key ? env.state.eReplicas.get(key) : null;
    const pending = rep?.state?.jBatchState?.batch;
    const sent = rep?.state?.jBatchState?.sentBatch?.batch;
    const messages = Array.isArray(rep?.state?.messages) ? rep.state.messages.slice(-6) : [];
    const mempool = Array.isArray(rep?.mempool) ? rep.mempool : [];
    return {
      pendingExternalToReserve: Number(pending?.externalTokenToReserve?.length || 0),
      pendingReserveToCollateral: Number(pending?.reserveToCollateral?.length || 0),
      pendingCollateralToReserve: Number(pending?.collateralToReserve?.length || 0),
      pendingReserveToReserve: Number(pending?.reserveToReserve?.length || 0),
      pendingReserveToExternal: Number(pending?.reserveToExternalToken?.length || 0),
      pendingDisputeStarts: Number(pending?.disputeStarts?.length || 0),
      pendingDisputeFinalizations: Number(pending?.disputeFinalizations?.length || 0),
      sentExternalToReserve: Number(sent?.externalTokenToReserve?.length || 0),
      sentReserveToCollateral: Number(sent?.reserveToCollateral?.length || 0),
      sentCollateralToReserve: Number(sent?.collateralToReserve?.length || 0),
      sentReserveToReserve: Number(sent?.reserveToReserve?.length || 0),
      sentReserveToExternal: Number(sent?.reserveToExternalToken?.length || 0),
      sentDisputeStarts: Number(sent?.disputeStarts?.length || 0),
      sentDisputeFinalizations: Number(sent?.disputeFinalizations?.length || 0),
      sentExists: !!rep?.state?.jBatchState?.sentBatch,
      lastFinalizedJHeight: Number(rep?.state?.lastFinalizedJHeight || 0),
      entityNonce: Number(rep?.state?.jBatchState?.entityNonce || 0),
      mempoolTxTypes: mempool.map((tx: { type?: unknown }) => String(tx?.type || '')),
      hasProposal: !!rep?.proposal,
      hasLockedFrame: !!rep?.lockedFrame,
      recentMessages: messages.map((message: unknown) => String(message || '')),
    };
  }, { entityId, signerId });
}

async function readAllBatchSnapshots(page: Page): Promise<Array<{
  key: string;
  pendingCount: number;
  sentCount: number;
  lastFinalizedJHeight: number;
}>> {
  return page.evaluate(() => {
    const env = (window as any).isolatedEnv;
    if (!env?.state?.eReplicas) return [];
    const rows: Array<{ key: string; pendingCount: number; sentCount: number; lastFinalizedJHeight: number }> = [];
    for (const [key, replica] of env.state.eReplicas.entries()) {
      const batch = replica?.state?.jBatchState?.batch;
      const sent = replica?.state?.jBatchState?.sentBatch?.batch;
      const pendingCount =
        Number(batch?.externalTokenToReserve?.length || 0) +
        Number(batch?.reserveToCollateral?.length || 0) +
        Number(batch?.collateralToReserve?.length || 0) +
        Number(batch?.reserveToReserve?.length || 0) +
        Number(batch?.reserveToExternalToken?.length || 0) +
        Number(batch?.disputeStarts?.length || 0) +
        Number(batch?.disputeFinalizations?.length || 0);
      const sentCount =
        Number(sent?.externalTokenToReserve?.length || 0) +
        Number(sent?.reserveToCollateral?.length || 0) +
        Number(sent?.collateralToReserve?.length || 0) +
        Number(sent?.reserveToReserve?.length || 0) +
        Number(sent?.reserveToExternalToken?.length || 0) +
        Number(sent?.disputeStarts?.length || 0) +
        Number(sent?.disputeFinalizations?.length || 0);
      rows.push({
        key: String(key),
        pendingCount,
        sentCount,
        lastFinalizedJHeight: Number(replica?.state?.lastFinalizedJHeight || 0),
      });
    }
    return rows;
  });
}

async function readMoveUiDebug(page: Page): Promise<{
  amount: string;
  confirmDisabled: boolean | null;
  status: string;
  sourceReserveRaw: string;
  sourceExternalRaw: string;
  sourceAccountRaw: string;
  headerEntityId: string;
  href: string;
  readyState: string;
  hasIsolatedEnv: boolean;
  replicaCount: number;
}> {
  return page.evaluate(() => {
    const amountInput = document.querySelector('[data-testid="move-amount"]') as HTMLInputElement | null;
    const confirm = document.querySelector('[data-testid="move-confirm"]') as HTMLButtonElement | null;
    const status = Array.from(document.querySelectorAll('[data-testid="move-status"]'))
      .map((node) => String(node.textContent || '').trim())
      .filter(Boolean)
      .join(' | ');
    const sourceReserve = document.querySelector('[data-testid="move-source-balance-reserve"]');
    const sourceExternal = document.querySelector('[data-testid="move-source-balance-external"]');
    const sourceAccount = document.querySelector('[data-testid="move-source-balance-account"]');
    const headerEntity = document.querySelector('.wallet-meta-value');
    const env = (window as typeof window & {
      isolatedEnv?: {
        state?: {
          eReplicas?: Map<string, unknown>;
        };
      };
    }).isolatedEnv;
    return {
      amount: String(amountInput?.value || '').trim(),
      confirmDisabled: confirm ? !!confirm.disabled : null,
      status,
      sourceReserveRaw: String(sourceReserve?.getAttribute('data-raw-amount') || ''),
      sourceExternalRaw: String(sourceExternal?.getAttribute('data-raw-amount') || ''),
      sourceAccountRaw: String(sourceAccount?.getAttribute('data-raw-amount') || ''),
      headerEntityId: String(headerEntity?.textContent || '').trim(),
      href: String(window.location.href || ''),
      readyState: String(document.readyState || ''),
      hasIsolatedEnv: !!env,
      replicaCount: env?.state?.eReplicas instanceof Map ? env.state.eReplicas.size : 0,
    };
  });
}

async function extendCreditDirect(
  page: Page,
  entityId: string,
  signerId: string,
  counterpartyId: string,
  tokenId: number,
  amount: bigint,
): Promise<void> {
  const before = await readAccountProgress(page, entityId, signerId, counterpartyId);
  await enqueueEntityTxs(page, entityId, signerId, [{
    type: 'extendCredit',
    data: {
      counterpartyEntityId: counterpartyId,
      tokenId,
      amount,
    },
  }]);
  await expect
    .poll(async () => (await readAccountProgress(page, entityId, signerId, counterpartyId)).currentHeight, {
      timeout: 45_000,
      intervals: [500, 1000, 1500],
    })
    .toBeGreaterThan(before.currentHeight);
}

async function sendDirectPayment(
  senderPage: Page,
  senderEntityId: string,
  senderSignerId: string,
  recipientPage: Page,
  recipientEntityId: string,
  recipientSignerId: string,
  recipientId: string,
  amount: string,
): Promise<void> {
  const senderBefore = await readAccountProgress(senderPage, senderEntityId, senderSignerId, recipientId);
  const recipientBefore = await readAccountProgress(recipientPage, recipientEntityId, recipientSignerId, senderEntityId);

  await enqueueEntityTxs(senderPage, senderEntityId, senderSignerId, [{
    type: 'directPayment',
    data: {
      targetEntityId: recipientId,
      tokenId: TOKEN_ID_USDC,
      amount: BigInt(amount) * TOKEN_SCALE,
      route: [senderEntityId, recipientId],
      deliveryMode: 'direct',
      description: 'debt-e2e-direct-bilateral',
    },
  }]);
  try {
    await expect
      .poll(async () => (await readAccountProgress(senderPage, senderEntityId, senderSignerId, recipientId)).currentHeight, {
        timeout: 45_000,
        intervals: [500, 1000, 1500],
      })
      .toBeGreaterThan(senderBefore.currentHeight);
  } catch (error) {
    const [sender, recipient] = await Promise.all([
      readAccountProgress(senderPage, senderEntityId, senderSignerId, recipientId),
      readAccountProgress(recipientPage, recipientEntityId, recipientSignerId, senderEntityId),
    ]);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n` +
      `Direct payment state: ${safeStringify({ sender, recipient })}`,
    );
  }
  await expect
    .poll(async () => (await readAccountProgress(recipientPage, recipientEntityId, recipientSignerId, senderEntityId)).currentHeight, {
      timeout: 45_000,
      intervals: [500, 1000, 1500],
    })
    .toBeGreaterThan(recipientBefore.currentHeight);
}

async function broadcastDraftBatch(
  page: Page,
  entityId: string,
  signerId: string,
  expectedPendingKinds: Array<
    | 'externalToReserve'
    | 'reserveToCollateral'
    | 'collateralToReserve'
    | 'reserveToReserve'
    | 'reserveToExternal'
    | 'disputeStarts'
    | 'disputeFinalizations'
  > = [],
  debugStepLabel = '',
): Promise<{ consoleMessages: string[]; afterClickSnapshot: Awaited<ReturnType<typeof readJBatchSnapshot>> }> {
  const readExpectedPendingCount = (snapshot: Awaited<ReturnType<typeof readJBatchSnapshot>>): number => {
    if (expectedPendingKinds.length === 0) {
      return (
        snapshot.pendingExternalToReserve +
        snapshot.pendingReserveToCollateral +
        snapshot.pendingCollateralToReserve +
        snapshot.pendingReserveToReserve +
        snapshot.pendingReserveToExternal +
        snapshot.pendingDisputeStarts +
        snapshot.pendingDisputeFinalizations
      );
    }
    return expectedPendingKinds.reduce((total, kind) => {
      switch (kind) {
        case 'externalToReserve':
          return total + snapshot.pendingExternalToReserve;
        case 'reserveToCollateral':
          return total + snapshot.pendingReserveToCollateral;
        case 'collateralToReserve':
          return total + snapshot.pendingCollateralToReserve;
        case 'reserveToReserve':
          return total + snapshot.pendingReserveToReserve;
        case 'reserveToExternal':
          return total + snapshot.pendingReserveToExternal;
        case 'disputeStarts':
          return total + snapshot.pendingDisputeStarts;
        case 'disputeFinalizations':
          return total + snapshot.pendingDisputeFinalizations;
      }
    }, 0);
  };
  try {
    await expect
      .poll(async () => {
        const snapshot = await readJBatchSnapshot(page, entityId, signerId);
        return readExpectedPendingCount(snapshot);
      }, {
        timeout: 30_000,
        intervals: [250, 500, 1000],
      })
      .toBeGreaterThan(0);
    if (debugStepLabel) console.log(`[debt-e2e] ${debugStepLabel}-draft-observed`);
  } catch {
    const snapshot = await readJBatchSnapshot(page, entityId, signerId).catch(() => null);
    const toastMessage = await page.locator('.toast.error .message').last().textContent().catch(() => '');
    const moveStatus = (await page.getByTestId('move-status').allTextContents().catch(() => []))
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
      .join(' | ');
    const moveUi = await readMoveUiDebug(page).catch(() => ({
      amount: '',
      confirmDisabled: null,
      status: '',
      sourceReserveRaw: '',
      sourceExternalRaw: '',
      sourceAccountRaw: '',
      headerEntityId: '',
      href: '',
      readyState: '',
      hasIsolatedEnv: false,
      replicaCount: 0,
    }));
    const allBatches = await readAllBatchSnapshots(page).catch(() => []);
    const foreignPending = allBatches.filter((entry) => entry.pendingCount > 0 && !entry.key.toLowerCase().startsWith(`${entityId.toLowerCase()}:`));
    const activeRoot = await page.evaluate(() => ({
      assetsVisible: !!document.querySelector('[data-testid="move-workspace-assets"]'),
      accountsVisible: !!document.querySelector('nav[aria-label="Account workspace"]'),
      activeAssetTab: document.querySelector('[data-testid="asset-tab-move"].active, [data-testid="asset-tab-history"].active')?.textContent?.trim() || '',
      activeAccountTab: document.querySelector('.account-workspace-tab.active')?.textContent?.trim() || '',
    })).catch(() => ({
      assetsVisible: false,
      accountsVisible: false,
      activeAssetTab: '',
      activeAccountTab: '',
    }));
    throw new Error(
      `batch draft did not appear within 30s:` +
      ` expectedKinds=${expectedPendingKinds.join(',') || 'any'}` +
      ` toast=${String(toastMessage || '').trim()}` +
      ` snapshot=${safeStringify(snapshot)}` +
      ` moveStatus=${moveStatus}` +
      ` moveUi=${safeStringify(moveUi)}` +
      ` activeRoot=${safeStringify(activeRoot)}` +
      ` foreignPending=${safeStringify(foreignPending)}` +
      ` allBatches=${safeStringify(allBatches)}`,
    );
  }

  await openAssetsTab(page);
  const moveTab = page.getByTestId('asset-tab-move').first();
  if (await moveTab.isVisible().catch(() => false)) {
    await moveTab.click();
  }

  const broadcast = page.getByTestId('settle-sign-broadcast').first();
  await expect(broadcast).toBeVisible({ timeout: 30_000 });
  await expect(broadcast).toBeEnabled({ timeout: 120_000 });
  let dialogMessage = '';
  const consoleMessages: string[] = [];
  const onDialog = async (dialog: any) => {
    dialogMessage = dialog?.message?.() || '';
    await dialog.accept();
  };
  const onConsole = (message: any) => {
    const text = typeof message?.text === 'function' ? message.text() : '';
    if (text) consoleMessages.push(String(text));
  };
  page.on('dialog', onDialog);
  page.on('console', onConsole);
  try {
    await broadcast.click();
    if (debugStepLabel) console.log(`[debt-e2e] ${debugStepLabel}-broadcast-clicked`);
  } finally {
    page.off('dialog', onDialog);
    page.off('console', onConsole);
  }
  await page.waitForTimeout(500);
  const afterClickSnapshot = await readJBatchSnapshot(page, entityId, signerId);
  const toastLocator = page.locator('.toast.error .message').last();
  const toastVisible = await toastLocator.isVisible({ timeout: 200 }).catch(() => false);
  const toastMessage = toastVisible
    ? await toastLocator.textContent().catch(() => '')
    : '';
  if (dialogMessage || String(toastMessage || '').trim()) {
    throw new Error(
      `settle-sign-broadcast failed: ${dialogMessage || String(toastMessage || '').trim()}` +
      ` snapshot=${safeStringify(afterClickSnapshot)}` +
      ` console=${safeStringify(consoleMessages)}`,
    );
  }
  if (debugStepLabel) console.log(`[debt-e2e] ${debugStepLabel}-broadcasted`);
  return { consoleMessages, afterClickSnapshot };
}

async function readConfirmedDisputeBatch(
  page: Page, depository: string, entityId: string, nonce: number, fromBlock: string,
): Promise<boolean> {
  type BatchLog = { address: string; topics: string[]; data: string; transactionHash: string; blockHash: string; removed?: boolean };
  const logs = await rpcCall<BatchLog[]>(page, 'eth_getLogs', [{ address: depository, fromBlock, toBlock: 'latest',
    topics: DEPOSITORY_BATCH_EVENTS.encodeFilterTopics('HankoBatchProcessed', [entityId]) }]);
  const matching = logs.filter(log => DEPOSITORY_BATCH_EVENTS.parseLog(log)?.args.nonce === BigInt(nonce));
  expect(matching.length, 'one receipt for the exact Entity batch nonce').toBeLessThanOrEqual(1);
  const log = matching[0];
  if (!log) return false;
  expect(log.removed).not.toBe(true);
  expect(log.address.toLowerCase()).toBe(depository.toLowerCase());
  const receipt = await rpcCall<{ status: string; transactionHash: string; blockHash: string }>(page,
    'eth_getTransactionReceipt', [log.transactionHash]);
  expect(receipt.status).toBe('0x1');
  expect(receipt.transactionHash.toLowerCase()).toBe(log.transactionHash.toLowerCase());
  expect(receipt.blockHash.toLowerCase()).toBe(log.blockHash.toLowerCase());
  return true;
}

async function queueAndBroadcastDisputeStart(
  page: Page,
  entityId: string,
  signerId: string,
  counterpartyId: string,
): Promise<void> {
  const before = await readJBatchSnapshot(page, entityId, signerId);
  const fromBlock = await rpcCall<string>(page, 'eth_blockNumber', []);
  const depository = await getDepositoryAddress(page);
  await startDisputeFromManageUi(page, counterpartyId, async () =>
    (await readJBatchSnapshot(page, entityId, signerId)).pendingDisputeStarts > before.pendingDisputeStarts,
  );
  await expect
    .poll(async () => (await readJBatchSnapshot(page, entityId, signerId)).pendingDisputeStarts, {
      timeout: 45_000,
      intervals: [500, 1000, 1500],
    })
    .toBeGreaterThan(before.pendingDisputeStarts);
  const broadcastDebug = await broadcastDraftBatch(page, entityId, signerId, ['disputeStarts']);
  try {
    await expect
      .poll(async () => {
        const confirmed = await readConfirmedDisputeBatch(page, depository, entityId, before.entityNonce + 1, fromBlock);
        return confirmed;
      }, {
        timeout: 60_000,
        intervals: [500, 1000, 1500],
      })
      .toBe(true);
  } catch {
    const snapshot = await readJBatchSnapshot(page, entityId, signerId);
    throw new Error(
      `dispute-start broadcast not observed.` +
      ` before=${safeStringify(before)}` +
      ` afterClick=${safeStringify(broadcastDebug.afterClickSnapshot)}` +
      ` final=${safeStringify(snapshot)}` +
      ` console=${safeStringify(broadcastDebug.consoleMessages)}`,
    );
  }
}

async function readAccountState(
  page: Page,
  entityId: string,
  signerId: string,
  counterpartyId: string,
): Promise<{ activeDispute: boolean; disputeTimeout: number; status: string }> {
  return page.evaluate(({ entityId, signerId, counterpartyId }) => {
    const env = (window as any).isolatedEnv;
    if (!env?.state?.eReplicas) return { activeDispute: false, disputeTimeout: 0, status: '' };
    const key = Array.from(env.state.eReplicas.keys()).find((k: string) => {
      const [eid, sid] = String(k).split(':');
      return String(eid || '').toLowerCase() === String(entityId).toLowerCase()
        && String(sid || '').toLowerCase() === String(signerId).toLowerCase();
    });
    const rep = key ? env.state.eReplicas.get(key) : null;
    const account = rep?.state?.accounts?.get?.(counterpartyId);
    return {
      activeDispute: !!account?.activeDispute,
      disputeTimeout: Number(account?.activeDispute?.disputeTimeout || 0),
      status: String(account?.status || ''),
    };
  }, { entityId, signerId, counterpartyId });
}

async function postRpc(page: Page, method: string, params: unknown[]): Promise<{ result?: unknown; error?: unknown }> {
  const apiBase = await getActiveApiBase(page);
  const response = await page.request.post(`${apiBase}/rpc`, {
    data: { jsonrpc: '2.0', id: 1, method, params },
  });
  const text = await response.text();
  let body: { result?: unknown; error?: unknown } = {};
  try {
    body = text ? JSON.parse(text) as { result?: unknown; error?: unknown } : {};
  } catch {
    body = { error: text.slice(0, 500) };
  }
  if (!response.ok()) throw new Error(`${method} RPC HTTP ${response.status()}: ${text.slice(0, 500)}`);
  if (body.error) throw new Error(`${method} RPC error: ${safeStringify(body.error)}`);
  return body;
}

async function mineOneBlock(page: Page): Promise<void> {
  await postRpc(page, 'evm_mine', []);
}

async function readCurrentChainTimestamp(page: Page): Promise<number> {
  const body = await postRpc(page, 'eth_getBlockByNumber', ['latest', false]);
  const timestamp = (body.result as { timestamp?: unknown } | undefined)?.timestamp;
  if (typeof timestamp !== 'string') {
    throw new Error(`unexpected latest block timestamp: ${safeStringify(body)}`);
  }
  return Number.parseInt(timestamp, 16);
}

async function waitForUnixSeconds(page: Page, targetTimestamp: number): Promise<void> {
  const current = await readCurrentChainTimestamp(page);
  if (current < targetTimestamp) {
    await postRpc(page, 'evm_setNextBlockTimestamp', [targetTimestamp]);
    await mineOneBlock(page);
  }
  const advanced = await readCurrentChainTimestamp(page);
  if (advanced < targetTimestamp) {
    throw new Error(`failed to advance chain time: target=${targetTimestamp} actual=${advanced}`);
  }
}

async function readDebtSnapshotsForCounterparty(
  page: Page,
  entityId: string,
  signerId: string,
  counterpartyId: string,
  tokenId = TOKEN_ID_USDC,
): Promise<DebtSnapshot[]> {
  const rows = await page.evaluate(({ entityId, signerId, counterpartyId, tokenId }) => {
    const env = (window as any).isolatedEnv;
    if (!env?.state?.eReplicas) return [];
    const key = Array.from(env.state.eReplicas.keys()).find((k: string) => {
      const [eid, sid] = String(k).split(':');
      return String(eid || '').toLowerCase() === String(entityId).toLowerCase()
        && String(sid || '').toLowerCase() === String(signerId).toLowerCase();
    });
    const rep = key ? env.state.eReplicas.get(key) : null;
    const ledgers = [
      ['out', rep?.state?.outDebtsByToken],
      ['in', rep?.state?.inDebtsByToken],
    ] as const;
    const rows: Array<{
      debtId: string;
      direction: 'out' | 'in';
      status: string;
      createdAmount: string;
      paidAmount: string;
      remainingAmount: string;
    }> = [];
    for (const [direction, ledger] of ledgers) {
      const bucket = ledger?.get?.(tokenId);
      if (!bucket) continue;
      for (const entry of bucket.values()) {
        if (String(entry?.counterparty || '').toLowerCase() !== String(counterpartyId || '').toLowerCase()) continue;
        rows.push({
          debtId: String(entry?.debtId || ''),
          direction,
          status: String(entry?.status || ''),
          createdAmount: String(entry?.createdAmount || 0n),
          paidAmount: String(entry?.paidAmount || 0n),
          remainingAmount: String(entry?.remainingAmount || 0n),
        });
      }
    }
    return rows;
  }, { entityId, signerId, counterpartyId, tokenId });
  return rows.map((row) => ({
    ...row,
    createdAmount: BigInt(row.createdAmount),
    paidAmount: BigInt(row.paidAmount),
    remainingAmount: BigInt(row.remainingAmount),
  }));
}

async function readAccountDeltaSnapshot(
  page: Page,
  entityId: string,
  signerId: string,
  counterpartyId: string,
  tokenId = TOKEN_ID_USDC,
): Promise<{ ondelta: string; offdelta: string; total: string } | null> {
  const raw = await page.evaluate(({ entityId, signerId, counterpartyId, tokenId }) => {
    const env = (window as any).isolatedEnv;
    if (!env?.state?.eReplicas) return null;
    const key = Array.from(env.state.eReplicas.keys()).find((k: string) => {
      const [eid, sid] = String(k).split(':');
      return String(eid || '').toLowerCase() === String(entityId).toLowerCase()
        && String(sid || '').toLowerCase() === String(signerId).toLowerCase();
    });
    const rep = key ? env.state.eReplicas.get(key) : null;
    const account = rep?.state?.accounts?.get?.(counterpartyId);
    const delta = account?.state?.deltas?.get?.(tokenId);
    if (!delta) return null;
    return {
      ondelta: String(delta.ondelta || 0n),
      offdelta: String(delta.offdelta || 0n),
      collateral: String(delta.collateral || 0n),
      leftCreditLimit: String(delta.leftCreditLimit || 0n),
      rightCreditLimit: String(delta.rightCreditLimit || 0n),
      leftAllowance: String(delta.leftAllowance || 0n),
      rightAllowance: String(delta.rightAllowance || 0n),
      leftHold: String(delta.leftHold || 0n),
      rightHold: String(delta.rightHold || 0n),
    };
  }, { entityId, signerId, counterpartyId, tokenId });

  if (!raw) return null;
  const derived = deriveDelta({
    tokenId,
    ondelta: BigInt(raw.ondelta),
    offdelta: BigInt(raw.offdelta),
    collateral: BigInt(raw.collateral),
    leftCreditLimit: BigInt(raw.leftCreditLimit),
    rightCreditLimit: BigInt(raw.rightCreditLimit),
    leftAllowance: BigInt(raw.leftAllowance),
    rightAllowance: BigInt(raw.rightAllowance),
    leftHold: BigInt(raw.leftHold),
    rightHold: BigInt(raw.rightHold),
  }, String(entityId).toLowerCase() < String(counterpartyId).toLowerCase());

  return {
    ondelta: raw.ondelta,
    offdelta: raw.offdelta,
    total: derived.delta.toString(),
  };
}

async function waitForMirroredDebtSnapshots(
  leftPage: Page,
  leftEntityId: string,
  leftSignerId: string,
  rightPage: Page,
  rightEntityId: string,
  rightSignerId: string,
  expectedRemaining: string,
): Promise<{ left: DebtSnapshot; right: DebtSnapshot }> {
  let latest: { left: DebtSnapshot | null; right: DebtSnapshot | null } = { left: null, right: null };
  const readUiDebtRow = async (page: Page): Promise<DebtSnapshot | null> =>
    page.evaluate((tokenDecimals) => {
      const panel = document.querySelector('[data-testid="debt-panel"]') as HTMLDetailsElement | null;
      if (!panel) return null;
      panel.open = true;
      panel.querySelectorAll('details').forEach((details) => {
        (details as HTMLDetailsElement).open = true;
      });
      const row = document.querySelector('[data-testid="debt-row-out-1"], [data-testid="debt-row-in-1"]') as HTMLElement | null;
      if (!row) return null;
      const testId = String(row.dataset.testid || '');
      const text = String(row.textContent || '').replace(/\s+/g, ' ').trim();
      const created = /Opened\s+([0-9.,]+)/i.exec(text)?.[1] || '0';
      const paid = /Paid\s+([0-9.,]+)/i.exec(text)?.[1] || '0';
      const left = /Left\s+([0-9.,]+)/i.exec(text)?.[1] || '0';
      const normalize = (value: string): bigint => {
        const digits = value.replace(/,/g, '');
        const [wholePartRaw, fractionalPartRaw = ''] = digits.split('.');
        const wholePart = wholePartRaw.trim() || '0';
        const fractionalPart = fractionalPartRaw.trim().replace(/\D/g, '')
          .slice(0, tokenDecimals)
          .padEnd(tokenDecimals, '0');
        return BigInt(wholePart) * 10n ** BigInt(tokenDecimals) + BigInt(fractionalPart || '0');
      };
      return {
        debtId: testId,
        direction: testId.includes('-out-') ? 'out' : 'in',
        status: text.includes('Open') ? 'open' : 'unknown',
        createdAmount: normalize(created),
        paidAmount: normalize(paid),
        remainingAmount: normalize(left),
      };
    }, TOKEN_DECIMALS);
  const pickOpenDebt = (rows: DebtSnapshot[]): DebtSnapshot | null =>
    rows.find((row) =>
      row.status === 'open'
      && row.remainingAmount.toString() === expectedRemaining
      && row.paidAmount === 0n,
    ) ?? null;

  await expect
    .poll(async () => {
      const [
        leftRuntimeRows,
        rightRuntimeRows,
        leftAccount,
        rightAccount,
      ] = await Promise.all([
        readDebtSnapshotsForCounterparty(leftPage, leftEntityId, leftSignerId, rightEntityId),
        readDebtSnapshotsForCounterparty(rightPage, rightEntityId, rightSignerId, leftEntityId),
        readAccountState(leftPage, leftEntityId, leftSignerId, rightEntityId),
        readAccountState(rightPage, rightEntityId, rightSignerId, leftEntityId),
      ]);

      latest = {
        left: pickOpenDebt(leftRuntimeRows),
        right: pickOpenDebt(rightRuntimeRows),
      };

      return (
        !leftAccount.activeDispute &&
        !rightAccount.activeDispute &&
        !!latest.left &&
        !!latest.right &&
        latest.left.direction !== latest.right.direction
      );
    }, {
      timeout: 60_000,
      intervals: [500, 1000, 1500],
      message: 'mirrored canonical debt state must exist on both runtimes',
    })
    .toBe(true);
  console.log('[debt-e2e] debt-runtime-mirror-ready');

  await Promise.all([
    openOutstandingDebtToken(leftPage),
    openOutstandingDebtToken(rightPage),
  ]);
  console.log('[debt-e2e] debt-ui-panels-ready');

  await expect
    .poll(async () => {
      const [leftRow, rightRow, leftSummary, rightSummary] = await Promise.all([
        readUiDebtRow(leftPage),
        readUiDebtRow(rightPage),
        leftPage.getByTestId('debt-panel').first().textContent().catch(() => ''),
        rightPage.getByTestId('debt-panel').first().textContent().catch(() => ''),
      ]);
      const debtorSummary = leftRow?.direction === 'out' ? leftSummary : rightSummary;
      return Boolean(
        leftRow &&
        rightRow &&
        leftRow.status === 'open' &&
        rightRow.status === 'open' &&
        leftRow.remainingAmount.toString() === expectedRemaining &&
        rightRow.remainingAmount.toString() === expectedRemaining &&
        leftRow.paidAmount === 0n &&
        rightRow.paidAmount === 0n &&
        leftRow.direction !== rightRow.direction &&
        String(leftSummary || '').includes('$150') &&
        String(rightSummary || '').includes('$150') &&
        String(debtorSummary || '').includes('Drain FIFO') &&
        String(debtorSummary || '').includes('100 slots max'),
      );
    }, {
      timeout: 30_000,
      intervals: [500, 1000, 1500],
      message: 'mirrored debt row must be visible in UI on both pages',
    })
    .toBe(true);
  console.log('[debt-e2e] debt-ui-mirror-ready');

  if (!latest.left || !latest.right) {
    throw new Error('mirrored debt snapshots missing');
  }
  return { left: latest.left, right: latest.right };
}

async function faucetReserve(page: Page, entityId: string, symbol = 'USDC'): Promise<void> {
  await openAssetsTab(page);
  const response = await page.request.post(`${APP_BASE_URL}/api/faucet/reserve`, {
    data: {
      userEntityId: entityId,
      tokenId: TOKEN_ID_USDC,
      tokenSymbol: symbol,
      amount: '100',
    },
  });
  expect(response.ok(), 'reserve faucet api must succeed').toBe(true);
  const body = await response.json() as { success?: boolean; error?: string };
  expect(body.success, body.error || 'reserve faucet api failed').toBe(true);
}

async function enforceDebtDirect(page: Page, entityId: string, tokenId: number): Promise<void> {
  const input = await page.evaluate(async ({ entityId, tokenId }) => {
    const view = window as typeof window & {
      isolatedEnv?: unknown;
      __xln_env?: unknown;
      XLN?: {
        buildDebtEnforcementRuntimeInput?: (env: unknown, params: { entityId: string; tokenId: number }) => unknown;
      };
      __xln_instance?: {
        buildDebtEnforcementRuntimeInput?: (env: unknown, params: { entityId: string; tokenId: number }) => unknown;
      };
      __xln?: {
        instance?: {
          buildDebtEnforcementRuntimeInput?: (env: unknown, params: { entityId: string; tokenId: number }) => unknown;
        };
      };
    };
    const env = view.isolatedEnv ?? view.__xln_env;
    const XLN = view.XLN
      ?? view.__xln_instance
      ?? view.__xln?.instance;
    if (!env || !XLN?.buildDebtEnforcementRuntimeInput) {
      throw new Error('DEBT_ENFORCEMENT_BUILDER_MISSING');
    }
    return XLN.buildDebtEnforcementRuntimeInput(env, { entityId, tokenId });
  }, { entityId, tokenId });
  await enqueueRuntimeInput(page, input as Parameters<typeof enqueueRuntimeInput>[1]);
}



async function openOutstandingDebtToken(page: Page, symbol = 'USDC'): Promise<void> {
  await openAssetsTab(page);
  const debtPanel = page.getByTestId('debt-panel').first();
  await expect(debtPanel).toBeVisible({ timeout: 20_000 }).catch(async (error) => {
    const diagnostics = await page.evaluate(() => {
      const env = (window as any).isolatedEnv;
      const summarizeLedger = (ledger: any) => {
        if (!ledger?.entries) return [];
        return Array.from(ledger.entries()).map(([tokenId, bucket]: [unknown, any]) => ({
          tokenId: Number(tokenId),
          size: Number(bucket?.size || 0),
          rows: bucket?.values
            ? Array.from(bucket.values()).map((entry: any) => ({
                direction: String(entry?.direction || ''),
                status: String(entry?.status || ''),
                remainingAmount: String(entry?.remainingAmount || '0'),
                counterparty: String(entry?.counterparty || ''),
              }))
            : [],
        }));
      };
      const replicas = env?.state?.eReplicas?.entries
        ? Array.from(env.state.eReplicas.entries()).map(([key, replica]: [unknown, any]) => ({
            key: String(key || ''),
            entityId: String(replica?.state?.entityId || ''),
            out: summarizeLedger(replica?.state?.outDebtsByToken),
            in: summarizeLedger(replica?.state?.inDebtsByToken),
          }))
        : [];
      return {
        hasDebtPanel: Boolean(document.querySelector('[data-testid="debt-panel"]')),
        activeEntityText: String(document.querySelector('main')?.textContent || '').replace(/\s+/g, ' ').slice(0, 500),
        replicas,
      };
    });
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nDebt UI diagnostics: ${safeStringify(diagnostics)}`);
  });
  if (!(await debtPanel.evaluate((node) => node.hasAttribute('open')))) {
    await debtPanel.locator('summary').first().click();
  }
  const tokenGroup = page.locator('.debt-token-group').filter({ hasText: symbol }).first();
  await expect(tokenGroup).toBeVisible({ timeout: 20_000 });
  if (!(await tokenGroup.evaluate((node) => node.hasAttribute('open')))) {
    await tokenGroup.locator('.debt-token-summary').first().click();
  }
}

type HubCore = StorageEntityCoreDoc & { signerId: string };

async function connectSovereignHubReader(page: Page, hubId: string): Promise<RemoteRuntimeAdapter> {
  const health = await ensureE2EBaseline(page, { requireMarketMaker: false });
  const hub = health.hubs?.find((entry) => entry.entityId?.toLowerCase() === hubId.toLowerCase());
  expect(hub?.runtimeId, 'selected sovereign Hub must expose its runtime identity').toBeTruthy();
  const response = await page.request.get(`${APP_BASE_URL}/api/runtime-import?access=admin&allowPartial=1`);
  expect(response.ok(), 'existing runtime import capability must be available').toBe(true);
  const payload = await response.json();
  const entry = payload.manifest.entries.find((item: { label: string }) => item.label === hub!.name);
  expect(entry, 'runtime import must include the selected Hub').toBeTruthy();
  const adapter = new RemoteRuntimeAdapter();
  await adapter.connect({ mode: 'remote', wsUrl: entry.wsUrl, authKey: entry.token, runtimeId: hub!.runtimeId });
  const core = await adapter.read<HubCore>(`/entity/${hubId}`);
  expect(core.entityId.toLowerCase()).toBe(hubId.toLowerCase());
  return adapter;
}

async function readHubDebts(adapter: RemoteRuntimeAdapter, hubId: string, counterpartyId: string): Promise<DebtSnapshot[]> {
  const core = await adapter.read<HubCore>(`/entity/${hubId}`);
  const rows: DebtSnapshot[] = [];
  for (const [direction, ledger] of [['out', core.outDebtsByToken], ['in', core.inDebtsByToken]] as const) {
    for (const entry of ledger?.get(TOKEN_ID_USDC)?.values() ?? []) {
      if (entry.counterparty.toLowerCase() !== counterpartyId.toLowerCase()) continue;
      rows.push({ debtId: entry.debtId, direction, status: entry.status,
        createdAmount: entry.createdAmount, paidAmount: entry.paidAmount, remainingAmount: entry.remainingAmount });
    }
  }
  return rows;
}

test.describe('debt ledger', () => {
  test('browser dispute with sovereign Hub creates exactly one mirrored debt on both owners', { tag: '@resilience' }, async ({ browser }, testInfo) => {
    test.setTimeout(LONG_E2E ? 360_000 : 240_000);
    const step = (label: string) => console.log(`[debt-e2e] ${label}`);

    step('bootstrap');
    const setupContext = await browser.newContext();
    const setupPage = await setupContext.newPage();
    await gotoApp(setupPage, { appBaseUrl: APP_BASE_URL });
    const hubId = await readFirstHubId(setupPage);
    await setupContext.close();

    const aliceRuntime = await newRuntimePage(browser, 'alice');
    const alicePage = aliceRuntime.page;
    const alice = aliceRuntime.runtime;
    const hub = await connectSovereignHubReader(alicePage, hubId);
    try {
      step('open-browser-hub-account');
      await connectHub(alicePage, hubId, { disputeConfig: { leftResponseSeconds: 5, rightResponseSeconds: 5 } });
      const hubCore = await hub.read<HubCore>(`/entity/${hubId}`);
      const hubAccountPath = `/entity/${hubId}/account/${alice.entityId}`;
      const hubBefore = await hub.read<StorageAccountDoc>(hubAccountPath);
      step('hub-grants-credit');
      await hub.send({ runtimeTxs: [], entityInputs: [{ entityId: hubId, signerId: hubCore.signerId,
        entityTxs: [{ type: 'extendCredit', data: { counterpartyEntityId: alice.entityId,
          tokenId: TOKEN_ID_USDC, amount: 1000n * TOKEN_SCALE } }] }] }, {
        commandId: `debt-e2e-credit-${crypto.randomUUID()}`, commandSequence: hub.nextCommandSequence!,
      });
      await expect.poll(async () => (await hub.read<StorageAccountDoc>(hubAccountPath)).currentHeight)
        .toBeGreaterThan(hubBefore.currentHeight);
      const aliceBefore = await readAccountProgress(alicePage, alice.entityId, alice.signerId, hubId);
      step('alice-pays-hub-on-credit');
      await enqueueEntityTxs(alicePage, alice.entityId, alice.signerId, [{ type: 'directPayment', data: {
        targetEntityId: hubId, tokenId: TOKEN_ID_USDC, amount: BigInt(USD_150),
        route: [alice.entityId, hubId], deliveryMode: 'direct', description: 'debt-e2e-browser-to-sovereign-hub',
      } }]);
      await expect.poll(async () => (await readAccountProgress(alicePage, alice.entityId, alice.signerId, hubId)).currentHeight)
        .toBeGreaterThan(aliceBefore.currentHeight);
      const expectedDelta = alice.entityId.toLowerCase() < hubId.toLowerCase() ? `-${USD_150}` : USD_150;
      await expect.poll(async () => (await readAccountDeltaSnapshot(alicePage, alice.entityId, alice.signerId, hubId))?.total)
        .toBe(expectedDelta);
      await expect.poll(async () => {
        const account = await hub.read<StorageAccountDoc>(hubAccountPath);
        const delta = account.state.deltas.get(TOKEN_ID_USDC)!;
        return deriveDelta(delta, hubId.toLowerCase() < alice.entityId.toLowerCase()).delta.toString();
      }).toBe(expectedDelta);

      step('dispute-start');
      await queueAndBroadcastDisputeStart(alicePage, alice.entityId, alice.signerId, hubId);
      await expect
        .poll(async () => (await readAccountState(alicePage, alice.entityId, alice.signerId, hubId)).activeDispute, {
          timeout: 45_000,
          intervals: [500, 1000, 1500],
        })
        .toBe(true);

      let disputeState = await readAccountState(alicePage, alice.entityId, alice.signerId, hubId);
      await expect
        .poll(async () => {
          disputeState = await readAccountState(alicePage, alice.entityId, alice.signerId, hubId);
          return disputeState.activeDispute && disputeState.disputeTimeout > 0 ? 'ready' : 'pending';
        }, {
          timeout: 45_000,
          intervals: [500, 1000, 1500],
        })
        .toBe('ready');
      await openEntityHistory(alicePage);
      await capturePageScreenshot(alicePage, testInfo, 'dispute-active-history-desktop.png', {
        fullPage: true,
        ux: {
          title: 'desktop active dispute history',
          group: 'Disputes',
          description: 'Entity history while its Hub account dispute is active and waiting for finality.',
          platform: 'desktop',
          tags: ['dispute', 'history'],
        },
      });

      await waitForUnixSeconds(alicePage, disputeState.disputeTimeout);

      step('dispute-finalize-auto');
      await expect
        .poll(async () => {
          const state = await readAccountState(alicePage, alice.entityId, alice.signerId, hubId);
          return !state.activeDispute && state.status === 'disputed';
        }, {
          timeout: 120_000,
          intervals: [500, 1000, 2000],
        })
        .toBe(true);
      await openEntityHistory(alicePage);
      await capturePageScreenshot(alicePage, testInfo, 'dispute-finalized-history-desktop.png', {
        fullPage: true,
        ux: {
          title: 'desktop finalized dispute history',
          group: 'Disputes',
          description: 'History after the dispute finalizes and debt evidence is mirrored.',
          platform: 'desktop',
          tags: ['dispute', 'history', 'debt'],
        },
      });

      step('verify-both-committed-debt-owners');
      const readBoth = async () => Promise.all([
        readDebtSnapshotsForCounterparty(alicePage, alice.entityId, alice.signerId, hubId),
        readHubDebts(hub, hubId, alice.entityId),
      ]);
      await expect.poll(async () => {
        const [aliceRows, hubRows] = await readBoth();
        return [aliceRows.length, hubRows.length];
      }, { timeout: 45_000 }).toEqual([1, 1]);
      const mirrored = await readBoth();
      for (const [index, rows] of mirrored.entries()) {
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ direction: index === 0 ? 'out' : 'in',
          createdAmount: BigInt(USD_150), remainingAmount: BigInt(USD_150), paidAmount: 0n });
      }
      expect(mirrored[0][0]!.debtId).toBe(mirrored[1][0]!.debtId);
      const hubFinal = await hub.read<StorageAccountDoc>(hubAccountPath);
      expect(hubFinal.activeDispute).toBeUndefined();
      expect(hubFinal.status).toBe('disputed');
      await openOutstandingDebtToken(alicePage);
      const summary = String(await alicePage.getByTestId('debt-panel').first().textContent());
      expect(summary).toMatch(/150(?:\.0+)?\s*USDC/i);
      expect(summary).toContain('we owe');
      // A further real chain block and repeated committed reads must preserve the single debt.
      await mineOneBlock(alicePage);
      await expect.poll(readBoth).toEqual(mirrored);
    } finally {
      hub.disconnect();
      await alicePage.context().close();
    }
  });
});
