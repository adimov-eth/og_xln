import { DEV_CHAIN_IDS } from '../chain-ids';
import type { JAdapterConfig } from '../types';

export const resolveRpcFinalityDepth = (
  config: JAdapterConfig,
  scenarioMode: boolean,
): number => {
  if (scenarioMode || DEV_CHAIN_IDS.has(config.chainId)) return 0;
  if (config.confirmationDepth !== undefined && Number.isFinite(config.confirmationDepth)) {
    const depth = Math.max(0, Math.floor(config.confirmationDepth));
    if (config.mode === 'tron' && depth !== 0) {
      throw new Error('TRON_CONFIRMATION_DEPTH_FORBIDDEN: use the SolidityNode solidified head');
    }
    return depth;
  }
  if (config.mode === 'tron') return 0;
  return config.chainId === 1 ? 12 : 2;
};
