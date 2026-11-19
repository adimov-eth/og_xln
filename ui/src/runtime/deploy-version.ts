import { broadcastHardResetRequest } from '@xln/frontend/lib/utils/control/activeTabLock';
import { runRetiredTestnetReset } from '@xln/frontend/lib/utils/control/resetBrowserData';
import {
  isDisposableLocalTestnet,
  resolveDeployVersionAction,
} from '@xln/frontend/lib/utils/deployVersionPolicy';

export const DEPLOY_VERSION_KEY = 'xln-deploy-version';

export type DeployVersionCheckResult =
  | { status: 'ok'; ephemeralTestnet: boolean }
  | { status: 'offline'; ephemeralTestnet: boolean }
  | { status: 'resetting'; ephemeralTestnet: boolean }
  | {
      status: 'require-recovery';
      ephemeralTestnet: boolean;
      storedVersion: string;
      currentVersion: string;
    };

let retiredResetPromise: Promise<void> | null = null;
const resetListeners = new Set<() => void>();
const notifyReset = (): void => {
  for (const listener of resetListeners) listener();
};

export function isResettingRetiredTestnet(): boolean {
  return retiredResetPromise !== null;
}

export function subscribeRetiredTestnetReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => {
    resetListeners.delete(listener);
  };
}

export function resolveReactRedirectPath(baseUrl?: string, pathname?: string): string {
  const rawBase = String(baseUrl ?? import.meta.env?.BASE_URL ?? '').trim();
  if (rawBase && rawBase !== '/') {
    const withLeading = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
    return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
  }
  const currentPath =
    pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  if (currentPath === '/ui' || currentPath.startsWith('/ui/')) return '/ui/';
  return '/';
}

export function resetReactRetiredTestnetState(
  redirectPath = resolveReactRedirectPath(),
): Promise<void> {
  if (!retiredResetPromise) {
    retiredResetPromise = runRetiredTestnetReset({
      redirectPath,
      stopRuntime: async () => {
        const { lockEmbeddedRuntime } = await import('./adapter');
        await lockEmbeddedRuntime();
      },
      broadcastReset: broadcastHardResetRequest,
    }).finally(() => {
      retiredResetPromise = null;
      notifyReset();
    });
    notifyReset();
  }
  return retiredResetPromise;
}

export type DeployVersionCheckDeps = {
  fetchFn?: (input: string, init?: RequestInit) => Promise<Response>;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  hostname?: string;
  isDev?: boolean;
  onReset?: () => Promise<void>;
};

export async function checkReactDeployVersion(
  deps: DeployVersionCheckDeps = {},
): Promise<DeployVersionCheckResult> {
  const isDev = deps.isDev ?? Boolean(import.meta.env?.DEV);
  const hostname =
    deps.hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '');
  const localDisposable = isDisposableLocalTestnet(isDev, hostname);
  const fetchImpl = deps.fetchFn ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(`/api/jurisdictions?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'cache-control': 'no-cache, no-store, must-revalidate',
        pragma: 'no-cache',
      },
    });
  } catch {
    return { status: 'offline', ephemeralTestnet: localDisposable };
  }
  if (!response.ok) return { status: 'offline', ephemeralTestnet: localDisposable };

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: 'offline', ephemeralTestnet: localDisposable };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { status: 'offline', ephemeralTestnet: localDisposable };
  }

  const root = payload as Record<string, unknown>;
  const version = String(
    root['deployVersion'] || root['networkVersion'] || root['version'] || '',
  ).trim();
  if (!version) return { status: 'offline', ephemeralTestnet: localDisposable };

  const ephemeralTestnet = root['ephemeralTestnet'] === true || localDisposable;
  const storage =
    deps.storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  const storedVersion = String(storage?.getItem(DEPLOY_VERSION_KEY) ?? '').trim();
  const action = resolveDeployVersionAction(storedVersion, version, ephemeralTestnet);

  if (action === 'persist-current') {
    storage?.setItem(DEPLOY_VERSION_KEY, version);
    return { status: 'ok', ephemeralTestnet };
  }
  if (action === 'continue') return { status: 'ok', ephemeralTestnet };
  if (action === 'reset-ephemeral-testnet') {
    await (deps.onReset ? deps.onReset() : resetReactRetiredTestnetState());
    return { status: 'resetting', ephemeralTestnet };
  }
  return {
    status: 'require-recovery',
    ephemeralTestnet,
    storedVersion,
    currentVersion: version,
  };
}
