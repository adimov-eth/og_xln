import { getRuntimeControllerConfig } from '#lib/stores/runtimeControllerStore.ts';
import { resolveConfiguredApiBase } from '#lib/stores/xlnStore.ts';
import { runtimeHttpOriginFromWsUrl } from '#lib/utils/runtime/wsUrl.ts';

export const resolveEverydayApiBase = (): string => {
  const config = getRuntimeControllerConfig();
  if (config?.mode === 'remote' && config.wsUrl) return runtimeHttpOriginFromWsUrl(config.wsUrl);
  return typeof window !== 'undefined' ? resolveConfiguredApiBase(window.location.origin) : 'https://xln.finance';
};
