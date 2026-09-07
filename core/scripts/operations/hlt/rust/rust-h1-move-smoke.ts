/** Real native settlement plus independent on-chain money conservation. */
import { JsonRpcProvider } from 'ethers';
import { join } from 'node:path';
import { Depository__factory } from '../../../../../jurisdictions/typechain-types/factories/Depository.sol/Depository__factory';
import { computeAccountKey } from '../../../../jurisdiction/adapter/events/contract-codec';
import { resetMeshJurisdictionsCache, resolveMeshJurisdictionConfig } from '../../../../orchestrator/mesh/mesh-jurisdictions';
import { safeStringify } from '../../../../protocol/serialization';
import { runRustH1AccountSettlementSmoke } from './rust-h1-account-settlement-smoke';

type Money = Readonly<{ hubReserve: bigint; peerReserve: bigint; collateral: bigint }>;
type Move = 'r2r' | 'r2c' | 'c2r';

export const assertNativeMoveMoney = (before: Money, after: Money, operation: Move, amount: bigint): void => {
  const expected: Money = {
    hubReserve: before.hubReserve + (operation === 'c2r' ? amount : -amount),
    peerReserve: before.peerReserve + (operation === 'r2r' ? amount : 0n),
    collateral: before.collateral + (operation === 'r2c' ? amount : operation === 'c2r' ? -amount : 0n),
  };
  if (safeStringify(after) !== safeStringify(expected)) {
    throw new Error(`HLT_NATIVE_MOVE_MONEY_MISMATCH:${operation}:${safeStringify({ before, expected, after })}`);
  }
};

export const runRustH1MoveSmoke = async (
  options: Omit<Parameters<typeof runRustH1AccountSettlementSmoke>[0], 'operation' | 'amount'> & { rpcUrl: string; workDir: string },
) => {
  process.env['XLN_JURISDICTIONS_PATH'] = join(options.workDir, 'prod-main', 'jurisdictions.json');
  resetMeshJurisdictionsCache();
  const jurisdiction = resolveMeshJurisdictionConfig(options.rpcUrl);
  const provider = new JsonRpcProvider(options.rpcUrl, undefined, { cacheTimeout: -1 });
  const depository = Depository__factory.connect(jurisdiction.contracts.depository, provider);
  const hub = options.rust.ready.entityId;
  const peer = options.counterpartyLane.identity.entityId;
  const key = computeAccountKey(hub, peer);
  const readMoney = async (): Promise<Money> => {
    const blockTag = await provider.getBlockNumber();
    const [hubReserve, peerReserve, collateral] = await Promise.all([
      depository._reserves(hub, options.tokenId, { blockTag }),
      depository._reserves(peer, options.tokenId, { blockTag }),
      depository._collaterals(key, options.tokenId, { blockTag }),
    ]);
    return { hubReserve, peerReserve, collateral: collateral.collateral };
  };
  const results = [];
  try {
    if (await provider.getCode(jurisdiction.contracts.depository) === '0x') {
      throw new Error(`HLT_NATIVE_MOVE_DEPOSITORY_MISSING:${jurisdiction.contracts.depository}`);
    }
    for (const operation of ['r2r', 'r2c', 'c2r'] as const) {
      const amount = operation === 'r2r' ? 1n : 10_000n;
      const before = await readMoney();
      const lifecycle = await runRustH1AccountSettlementSmoke({ ...options, operation, amount });
      const after = await readMoney();
      assertNativeMoveMoney(before, after, operation, amount);
      results.push({ operation, amount, before, after, lifecycle });
      console.log(`HLT_NATIVE_MOVE_OK ${safeStringify(results.at(-1))}`);
    }
    return { evidence: 'functional-smoke' as const, results };
  } finally {
    provider.destroy();
  }
};
