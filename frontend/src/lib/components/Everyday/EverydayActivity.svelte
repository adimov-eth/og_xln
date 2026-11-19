<script lang="ts">
  import type { RuntimeActivityEvent, RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
  import { runtimeAdapterHeight } from '#lib/stores/runtimeControllerStore.ts';
  import { runtimeQueryClient } from '#lib/stores/runtimeQueryClient.ts';
  import type { Runtime } from '#lib/stores/vault/vaultStore.ts';
  import type { EverydayWalletProjection } from '#lib/everyday/everyday-projection.ts';
  import { classifyRecoveryShieldState } from '#lib/everyday/everyday-recovery.ts';
  import { buildEverydayActivityRows } from './everyday-activity';
  import { resolveRecoveryShieldInput } from './everyday-runtime';

  interface Props { projection: EverydayWalletProjection; runtime: Runtime | null; frame: RuntimeAdapterViewFrame | null; decimals: number; }
  let { projection, runtime, frame, decimals }: Props = $props();

  let rawEvents = $state<RuntimeActivityEvent[]>([]);
  let loading = $state(false);
  let loadError = $state('');

  const shield = $derived(classifyRecoveryShieldState({
    shieldStatus: resolveRecoveryShieldInput(runtime),
    disputes: projection.disputes,
    hasZeroL1Gas: projection.hasZeroL1Gas,
  }));
  const rows = $derived(buildEverydayActivityRows(rawEvents, projection.entityId, frame, decimals));

  $effect(() => {
    const entityId = projection.entityId;
    void $runtimeAdapterHeight;
    if (!entityId) { rawEvents = []; return; }
    let cancelled = false;
    loading = true;
    void runtimeQueryClient.readActivity({ entityId, kind: 'all', types: ['payment', 'htlc'], limit: 100, scanLimit: 400 })
      .then(page => {
        if (cancelled) return;
        rawEvents = page.events;
        loadError = '';
      })
      .catch(err => {
        if (cancelled) return;
        loadError = err instanceof Error ? err.message : 'Activity unavailable right now';
      })
      .finally(() => { if (!cancelled) loading = false; });
    return () => { cancelled = true; };
  });
</script>

<section
  class="ev-card"
  data-testid="everyday-recovery-notice"
  style={shield.category === 'unilateral-exit-needs-gas' ? 'border-color:rgba(251,113,133,0.45);' : shield.category === 'protected' ? 'border-color:rgba(52,211,153,0.35);' : ''}
>
  <strong style="font-size:1rem;">Recovery protection</strong>
  <p class="ev-muted">{shield.summary}</p>
</section>

<section class="ev-card" data-testid="everyday-activity-list">
  <h2 style="margin:0;font-size:1.15rem;">Activity</h2>
  {#if loadError}
    <p class="ev-alert error">{loadError}</p>
  {:else if loading && rows.length === 0}
    <p class="ev-muted">Loading recent activity...</p>
  {:else if rows.length === 0}
    <p class="ev-muted">No payments or transfers yet.</p>
  {:else}
    {#each rows as row (row.id)}
      <div class="ev-row" style="justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
        <div>
          <strong>{row.title}</strong>
          <p class="ev-muted">{row.subtitle}</p>
        </div>
        <span class="ev-num" style="font-weight:600;">{row.amountText}</span>
      </div>
    {/each}
  {/if}
</section>
