import { connectCrossRuntimes } from './cross-hub';
/** Verify persisted cross-j economic state after the production processes restart. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { safeStringify } from '../../../../protocol/serialization';
import { decodeCrossLoadReport } from './cross-boundary';
import { decodeCrossRecoveryReport } from './cross-recovery-boundary';
import { decodeLoadFrame } from '../boundary/worker-boundary';
import { waitForSettledCrossRoute } from './worker-cross-state';
import { persistReport, type WorkerArgs } from '../worker-runtime';

const SOURCE_CHAIN_ID = 31_337;
const TARGET_CHAIN_ID = 31_338;

export const runCrossProductionRecovery = async (args: WorkerArgs): Promise<void> => {
  if (args.swaps !== 1) throw new Error('PRODUCTION_SWAP_LOAD_CROSS_RECOVERY_ONLY_N1');
  if (args.serverPidBeforeRestart === undefined || args.serverPidAfterRestart === undefined) {
    throw new Error('PRODUCTION_SWAP_LOAD_CROSS_RECOVERY_RESTART_PIDS_REQUIRED');
  }
  const previous = decodeCrossLoadReport(
    JSON.parse(readFileSync(join(args.workDir, 'production-cross-swap-load-report.json'), 'utf8')) as unknown,
  );
  const { hub, load } = await connectCrossRuntimes(args);
  try {
    const sourceHub = hub.identity(SOURCE_CHAIN_ID);
    const targetHub = hub.identity(TARGET_CHAIN_ID);
    await waitForSettledCrossRoute(
      hub,
      sourceHub.entityId,
      targetHub.entityId,
      previous.loadOrderId,
      BigInt(previous.sourceAmount),
      BigInt(previous.targetAmount),
    );
    const report = decodeCrossRecoveryReport({
      schema: 'xln-production-cross-swap-recovery-v1',
      completionAuthority: 'committed_route_descendant_heads_and_process_replacement',
      serverPidBeforeRestart: args.serverPidBeforeRestart,
      serverPidAfterRestart: args.serverPidAfterRestart,
      loadOrderId: previous.loadOrderId,
      sourceAmount: previous.sourceAmount,
      targetAmount: previous.targetAmount,
      routeStatus: 'settled',
      hubBeforeRestart: previous.hubDurableAfter,
      hubAfterRecovery: await hub.frame(),
      loadBeforeRestart: previous.loadDurableAfter,
      loadAfterRecovery: decodeLoadFrame(await load.adapter.read<unknown>('frame/latest')),
    });
    persistReport(join(args.workDir, 'production-cross-swap-recovery-report.json'), report, decodeCrossRecoveryReport);
    console.log(safeStringify(report));
  } finally {
    await hub.close();
    load.adapter.disconnect();
  }
};
