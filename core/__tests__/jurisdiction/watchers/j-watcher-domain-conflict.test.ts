import { expect, test } from 'bun:test';

import { normalizeJurisdictionImportRequest } from '../../../runtime/j-submit/jurisdiction-import-request';
import {
  applyCompleteImportJurisdiction,
  buildJurisdictionImportRequestHash,
} from '../../../runtime/j-submit/jurisdiction-import';
import { createEmptyEnv } from '../../../runtime';
import { createJReplica } from '../../../scenarios/harness/boot';

test('jurisdiction import rejects a duplicate watcher domain before publication', () => {
  const env = createEmptyEnv('duplicate-watcher-domain');
  const contracts = {
    depository: `0x${'11'.repeat(20)}`,
    entityProvider: `0x${'22'.repeat(20)}`,
    account: `0x${'33'.repeat(20)}`,
    deltaTransformer: `0x${'44'.repeat(20)}`,
  };
  const primary = createJReplica(env, 'primary', contracts.depository);
  Object.assign(primary, {
    chainId: 31_337,
    depositoryAddress: contracts.depository,
    entityProviderAddress: contracts.entityProvider,
    entityProviderDeploymentBlock: 1,
    contracts,
    rpcs: ['http://127.0.0.1:8545/'],
  });

  const request = normalizeJurisdictionImportRequest({
    name: 'duplicate',
    chainId: 31_337,
    ticker: 'ETH',
    rpcs: ['http://127.0.0.1:9545'],
    entityProviderDeploymentBlock: 1,
    contracts,
  });
  const requestHash = buildJurisdictionImportRequestHash(request);
  env.infrastructure ??= {};
  env.infrastructure.pendingJurisdictionImports = new Map([[
    requestHash,
    { importId: requestHash, requestHash, request },
  ]]);

  expect(() => applyCompleteImportJurisdiction(env, {
    type: 'completeImportJ',
    data: {
      importId: requestHash,
      requestHash,
      name: request.name,
      chainId: request.chainId,
      ticker: request.ticker,
      rpcs: request.rpcs,
      blockNumber: '0',
      stateRoot: null,
      watcherConfirmationDepth: 0,
      entityProviderDeploymentBlock: 1,
      tokenRegistry: [],
      contracts,
    },
  })).toThrow('IMPORT_J_WATCHER_IDENTITY_CONFLICT:duplicate:primary');
  expect(env.state.jReplicas.has('duplicate')).toBe(false);
});
