import { enqueueRuntimeInput, processRuntime, registerRuntimeFrameCommitCallback } from '../../../runtime';
import { runtimeFrameContainsSubmittedInput } from '../../../runtime/mempool/input-completion';
import type { RuntimeInput, RuntimeReplica } from '../../../runtime/types';
import { requireJurisdictionBlockTimeMs } from '../../mesh/mesh-jurisdictions';
import type { JurisdictionConfig } from './hub-node-types';

export const importJurisdiction = async (
  env: RuntimeReplica,
  jurisdiction: JurisdictionConfig,
): Promise<void> => {
  const submitted: RuntimeInput = {
    runtimeTxs: [{
      type: 'importJ',
      data: {
        name: jurisdiction.name,
        chainId: jurisdiction.chainId,
        ticker: 'XLN',
        rpcs: [jurisdiction.rpc],
        entityProviderDeploymentBlock:
          jurisdiction.entityProviderDeploymentBlock,
        blockTimeMs: requireJurisdictionBlockTimeMs(jurisdiction),
        ...(jurisdiction.contracts
          ? { contracts: jurisdiction.contracts }
          : {}),
      },
    }],
    entityInputs: [],
  };
  await commitJurisdictionImport(env, submitted, jurisdiction.name);
};

const commitJurisdictionImport = async (
  env: RuntimeReplica, submitted: RuntimeInput, name: string,
): Promise<void> => {
  let committed = false;
  const off = registerRuntimeFrameCommitCallback(env, frame => {
    committed ||= runtimeFrameContainsSubmittedInput(frame.runtimeInput, submitted);
  });
  try {
    enqueueRuntimeInput(env, submitted);
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      // Recovery can retain work for offline peers. Startup owns this import,
      // not global quiescence. An existing J alone is insufficient: the exact
      // request must commit first, including its chain/contract conflict checks.
      await processRuntime(env);
      if (committed && env.state.jReplicas.has(name)) return;
      await new Promise<void>(resolve => setTimeout(resolve, 10));
    }
    throw new Error(`HUB_JURISDICTION_IMPORT_COMMIT_MISSING:${name}`);
  } finally { off(); }
};
