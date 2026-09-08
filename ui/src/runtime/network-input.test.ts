import { expect, test } from 'bun:test';
import { networkInput, type NetworkDraft } from './network-input';

const draft: NetworkDraft = {
  name: 'custom-chain', rpc: 'https://rpc.example.test', chainId: '31339', ticker: 'ETH', blockTimeMs: '1000', deploymentBlock: '1',
  contracts: {
    depository: '0x1111111111111111111111111111111111111111',
    entityProvider: '0x2222222222222222222222222222222222222222',
    account: '0x3333333333333333333333333333333333333333',
    deltaTransformer: '0x4444444444444444444444444444444444444444',
  },
};

test('network import rejects ambiguous chain and deployment boundaries before admission', () => {
  for (const value of ['0', '1.5', 'NaN', '9007199254740992']) {
    expect(() => networkInput({ ...draft, chainId: value })).toThrow();
    expect(() => networkInput({ ...draft, deploymentBlock: value })).toThrow();
  }
  expect(() => networkInput({ ...draft, contracts: { ...draft.contracts, depository: '0x0000000000000000000000000000000000000000' } })).toThrow();
});

test('network import never deploys contracts and rejects embedded RPC credentials', () => {
  expect(networkInput(draft).runtimeTxs[0]).toMatchObject({ type: 'importJ', data: { name: 'custom-chain', chainId: 31339, rpcs: ['https://rpc.example.test/'], contracts: draft.contracts } });
  expect(() => networkInput({ ...draft, rpc: 'https://password@rpc.example.test' })).toThrow();
  expect(() => networkInput({ ...draft, rpc: 'file:///tmp/rpc' })).toThrow();
});
