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

  // Fence new P2P/J ingress before draining work that was already accepted.
  // The loop remains alive for the drain, but cannot resurrect a watcher after
  // stopJurisdictionWatchersAndWait has returned.
  if (env.infrastructure) env.infrastructure.persistenceQuiescing = true;

  try {
    await xln.stopJurisdictionWatchersAndWait(env);
  } catch (error) {
    failures.push(`watchers:${error instanceof Error ? error.message : String(error)}`);
  }

  // Scheduled hooks remain durable and resume with the runtime; they are not
  // shutdown work and must not make repeated quiesce calls time out.
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
