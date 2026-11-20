import { isUnknownRecord, parseJsonUnknown } from '../boundary/index';
import { broadcastHardResetRequest } from './activeTabLock';
import {
  clearBrowserRuntimeData,
  RESET_CONFIRMATION,
  RESET_WARNING,
  RETIRED_TESTNET_REBOOTSTRAP_KEY,
  runRetiredTestnetReset,
} from './resetBrowserData';
import { sleep } from '../primitives';
let activeResetPromise: Promise<void> | null = null;

const RESET_TAB_SETTLE_MS = 300;


export type ResetEverythingRequest = { reason: string };

async function stopCurrentRuntimeActivity(): Promise<void> {
  const { shutdownRuntimeResumeListener, vaultOperations } = await import('../../stores/vault/vaultStore');
  await vaultOperations.suspendAllRuntimeActivity();
  shutdownRuntimeResumeListener();
}

function requestOtherTabsShutdown(): void {
  broadcastHardResetRequest();
}

export function markRetiredTestnetRebootstrapRuntimes(): void {
  if (typeof localStorage === 'undefined') return;
  if (typeof localStorage.getItem !== 'function' || typeof localStorage.setItem !== 'function') return;
  const rawVaults = localStorage.getItem('xln-vaults');
  if (!rawVaults) return;
  try {
    const parsed = parseJsonUnknown(rawVaults, 'VAULTS_SNAPSHOT_JSON_INVALID');
    if (!isUnknownRecord(parsed) || !isUnknownRecord(parsed['runtimes'])) return;
    const ids = Object.keys(parsed['runtimes'])
      .map(id => id.trim().toLowerCase())
      .filter(Boolean);
    if (ids.length > 0) {
      localStorage.setItem(RETIRED_TESTNET_REBOOTSTRAP_KEY, JSON.stringify({ ids, markedAt: Date.now() }));
    }
  } catch {
    // Corrupted vault storage continues fail-closed without bootstrapping over it.
  }
}

export async function resetEverything(request: ResetEverythingRequest): Promise<void> {
  if (!request.reason.trim()) throw new Error('RESET_REASON_REQUIRED');
  if (activeResetPromise) return activeResetPromise;
  const confirmation = window.prompt(RESET_WARNING);
  if (confirmation !== RESET_CONFIRMATION) return;

  const resetPromise = (async () => {
    await stopCurrentRuntimeActivity();
    requestOtherTabsShutdown();
    await sleep(RESET_TAB_SETTLE_MS);
    await clearBrowserRuntimeData(confirmation);
    window.location.replace('/app');
  })();
  activeResetPromise = resetPromise;

  try {
    await resetPromise;
  } finally {
    if (activeResetPromise === resetPromise) activeResetPromise = null;
  }
}

let retiredTestnetReset: Promise<void> | null = null;

/**
 * A redeployed or re-schemed testnet cannot read the old stores. Only a
 * deployment that declares itself an ephemeral testnet reaches this path;
 * real-funds deployments keep the fail-closed recovery screen.
 */
export function resetRetiredTestnetState(
  redirectPath = '/app',
  deps?: { stopRuntime?: () => Promise<void>; broadcastReset?: () => void },
): Promise<void> {
  retiredTestnetReset ??= runRetiredTestnetReset({
    redirectPath,
    stopRuntime: deps?.stopRuntime ?? stopCurrentRuntimeActivity,
    broadcastReset: deps?.broadcastReset ?? requestOtherTabsShutdown,
    afterClear: markRetiredTestnetRebootstrapRuntimes,
  }).finally(() => {
    retiredTestnetReset = null;
  });
  return retiredTestnetReset;
}
