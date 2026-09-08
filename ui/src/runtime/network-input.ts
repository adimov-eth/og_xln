import { getAddress } from 'ethers';
import type { RuntimeInput } from '@xln/core/api/public/runtime-module';

export const CONTRACT_FIELDS = ['depository', 'entityProvider', 'account', 'deltaTransformer'] as const;
export type NetworkDraft = {
  name: string;
  rpc: string;
  chainId: string;
  ticker: string;
  blockTimeMs: string;
  deploymentBlock: string;
  contracts: Record<(typeof CONTRACT_FIELDS)[number], string>;
};

const positiveInteger = (value: string, label: string): number => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
};

export function networkInput(draft: NetworkDraft): RuntimeInput {
  const name = draft.name.trim();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) throw new Error('Use a network name with lowercase letters, numbers and hyphens');
  const rpc = new URL(draft.rpc.trim());
  if (!['http:', 'https:'].includes(rpc.protocol) || rpc.username || rpc.password) throw new Error('Use an HTTP(S) RPC URL without embedded credentials');
  const ticker = draft.ticker.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,12}$/.test(ticker)) throw new Error('Enter the network currency ticker');
  const contracts = { ...draft.contracts };
  for (const key of CONTRACT_FIELDS) {
    contracts[key] = getAddress(contracts[key].trim());
    if (/^0x0{40}$/i.test(contracts[key])) throw new Error(`${key} cannot be the zero address`);
  }
  return {
    runtimeTxs: [{ type: 'importJ', data: {
      name, ticker, rpcs: [rpc.href], contracts,
      chainId: positiveInteger(draft.chainId, 'Chain id'),
      blockTimeMs: positiveInteger(draft.blockTimeMs, 'Block time'),
      entityProviderDeploymentBlock: positiveInteger(draft.deploymentBlock, 'Deployment block'),
    } }],
    entityInputs: [],
  };
}
