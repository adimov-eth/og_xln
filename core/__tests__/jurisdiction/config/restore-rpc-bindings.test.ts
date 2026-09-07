import { expect, test } from 'bun:test';
import { buildPredeployedRestoreRpcBindings } from '../../../api/server/catalog/restore-rpc-bindings';
import { getJurisdictionIdentityRef } from '../../../jurisdiction/machine/jurisdiction-runtime';

const stack = (chainId: number, rpc: string, primary = false) => ({
  chainId, rpc, primary, entityProviderDeploymentBlock: 1,
  contracts: {
    account: `0x${'11'.repeat(20)}`, depository: `0x${'22'.repeat(20)}`,
    entityProvider: `0x${'33'.repeat(20)}`, deltaTransformer: `0x${'44'.repeat(20)}`,
  },
});
const source = stack(31337, '/rpc', true);
const target = stack(31338, '/rpc2');
const payload = { jurisdictions: { arrakis: source, tron: target } };
const primaryRpc = 'http://127.0.0.1:20000';
const secondaryRpc = 'http://127.0.0.1:20001';

test('cross-j R7 custody restores both explicitly configured RPC stacks', () => {
  // Custody WAL h7 records the old gateway /rpc2. The runtime must receive
  // the explicit transport replacement for this exact chain+Depository too.
  expect(buildPredeployedRestoreRpcBindings(payload, primaryRpc, 'arrakis', { 2: secondaryRpc })).toEqual([
    { jurisdictionRef: getJurisdictionIdentityRef(source), rpcUrl: primaryRpc },
    { jurisdictionRef: getJurisdictionIdentityRef(target), rpcUrl: secondaryRpc },
  ]);
});

test('an unconfigured secondary keeps its persisted RPC and distinct chain identity', () => {
  expect(buildPredeployedRestoreRpcBindings(payload, primaryRpc, 'arrakis', {})).toEqual([
    { jurisdictionRef: getJurisdictionIdentityRef(source), rpcUrl: primaryRpc },
  ]);
  expect(getJurisdictionIdentityRef(source)).not.toBe(getJurisdictionIdentityRef(target));
});

test('an ambiguous or missing operator RPC slot fails instead of rebinding another stack', () => {
  expect(() => buildPredeployedRestoreRpcBindings({ jurisdictions: {
    ...payload.jurisdictions, other: stack(31339, '/rpc2'),
  } }, primaryRpc, 'arrakis', { 2: secondaryRpc })).toThrow('PREDEPLOYED_RESTORE_RPC_SLOT_AMBIGUOUS:2');
  expect(() => buildPredeployedRestoreRpcBindings(payload, primaryRpc, 'arrakis', { 3: secondaryRpc }))
    .toThrow('PREDEPLOYED_RESTORE_RPC_SLOT_MISSING:3');
});
