import type { RuntimeReplica, XLNModule } from '@xln/core/api/public/runtime-module';
import { runtimeQuiesceWorkSummary } from '../stores/vault/vault-lifecycle-helpers';
import { RUNTIME_P2P_SHUTDOWN_TIMEOUT_MS } from '../stores/vault/vault-recovery';

export async function closeRuntimeSession(env: RuntimeReplica, xln: XLNModule): Promise<void> {
  await suspendRuntimeActivity(env, xln);

  if (typeof xln.closeRuntimeDb === 'function') {
    await xln.closeRuntimeDb(env);
  }
  if (typeof xln.closeInfraDb === 'function') {
    await xln.closeInfraDb(env);
  }
}

export async function suspendRuntimeActivity(env: RuntimeReplica, xln: XLNModule): Promise<void> {
  const failures: string[] = [];

  // Stop new chain observations, but keep peer replies admissible while accepted
  // financial work drains. Fencing P2P here rejects the ACK for a payment that
  // was submitted immediately before lock and strands its bilateral proposal.
  const previousWatcherPause = env.infrastructure?.jurisdictionWatchersPaused;
  if (env.infrastructure) env.infrastructure.jurisdictionWatchersPaused = true;

  try {
    await xln.stopJurisdictionWatchersAndWait(env);
  } catch (error) {
    failures.push(`watchers:${error instanceof Error ? error.message : String(error)}`);
  }

  // The runtime and transport must both remain active for this drain.
  try {
    const drained = await xln.waitForRuntimeWorkDrained(env, 30_000);
    if (!drained) {
      failures.push(`runtime_work:drain_timeout:${JSON.stringify(runtimeQuiesceWorkSummary(env))}`);
    }
  } catch (error) {
    failures.push(
      `runtime_work:${error instanceof Error ? error.message : String(error)}` +
        `:${JSON.stringify(runtimeQuiesceWorkSummary(env))}`,
    );
  }

  if (env.infrastructure) {
    env.infrastructure.persistenceQuiescing = true;
    if (previousWatcherPause === undefined) delete env.infrastructure.jurisdictionWatchersPaused;
    else env.infrastructure.jurisdictionWatchersPaused = previousWatcherPause;
    env.infrastructure.persistencePaused = true;
  }

  const idle = await xln.stopRuntimeLoopAndWait(env, 30_000);
  if (!idle) failures.push('runtime_loop:drain_timeout');

  // Keep transport alive until every accepted output has drained. Reliable
  // consensus lanes can emit their final delivery/receipt while the runtime
  // becomes idle; stopping P2P earlier strands that durable output locally.
  try {
    await xln.stopP2PAndWait(env, RUNTIME_P2P_SHUTDOWN_TIMEOUT_MS);
  } catch (error) {
    failures.push(`p2p:${error instanceof Error ? error.message : String(error)}`);
  }

  if (failures.length > 0) {
    throw new Error(`RUNTIME_QUIESCE_FAILED:${failures.join('|')}`);
  }
}
