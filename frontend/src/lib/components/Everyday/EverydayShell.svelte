<script lang="ts">
  import { onMount } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { deriveDelta } from '@xln/core/account/utils';
  import type { RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
  import { Settings } from 'lucide-svelte';
  import ContextSwitcher from '../Entity/workspace/shell/ContextSwitcher.svelte';
  import type { EntityWorkspaceEmbeddedRuntimeContext } from '../Entity/core/embedded-runtime-context';
  import type { EntityWorkspaceRuntimeFrameContext } from '../Entity/core/runtime-frame-context';
  import { activeRuntime, vaultOperations } from '#lib/stores/vault/vaultStore.ts';
  import { runtimeControllerHandle } from '#lib/stores/runtimeControllerStore.ts';
  import { xlnFunctions, xlnInstance } from '#lib/stores/xlnStore.ts';
  import { maybeAutoJoinEverydayHub } from '#lib/stores/everyday/everyday-hub-join.ts';
  import type { Tab } from '#lib/types/ui.ts';
  import { readHubJoinPreference } from '#lib/utils/onboarding/onboardingPreferences.ts';
  import { parseXlnInvoice, type ParsedXlnInvoice } from '#lib/utils/xlnInvoice.ts';
  import { projectEverydayWallet } from '#lib/everyday/everyday-projection.ts';
  import { loadEverydayExternalSnapshot, type EverydayExternalSnapshot, type EverydayTab } from './everyday-runtime';
  import EverydayCash from './EverydayCash.svelte';
  import EverydayFriends from './EverydayFriends.svelte';
  import EverydaySavings from './EverydaySavings.svelte';
  import EverydayActivity from './EverydayActivity.svelte';
  import EverydaySettings from './EverydaySettings.svelte';
  import ExternalRequestSheet from './ExternalRequestSheet.svelte';

  interface Props {
    tab: Tab;
    allowHeaderAddRuntime?: boolean | undefined;
    headerRuntimeAddLabel?: string | undefined;
    runtimeFrameContext: EntityWorkspaceRuntimeFrameContext;
    embeddedRuntimeContext: EntityWorkspaceEmbeddedRuntimeContext;
    runtimeProjectionFrame: RuntimeAdapterViewFrame | null;
    onEntitySelect?: ((detail: { jurisdiction: string; signerId: string; entityId: string }) => void) | undefined;
    onAddRuntime?: (() => void) | undefined;
    onAddJurisdiction?: (() => void) | undefined;
    onAddEntity?: (() => void) | undefined;
  }

  let {
    tab, allowHeaderAddRuntime = false, headerRuntimeAddLabel = '+ Add Runtime',
    runtimeFrameContext, embeddedRuntimeContext, runtimeProjectionFrame,
    onEntitySelect, onAddRuntime, onAddJurisdiction, onAddEntity,
  }: Props = $props();

  let activeTab = $state<EverydayTab>('cash');
  let extSnapshot = $state<EverydayExternalSnapshot>({ externalRows: [], balanceRows: [], nativeBalance: 0n, decimals: 6, symbol: 'USDC', tokenAddress: '' });
  let externalInvoice = $state<ParsedXlnInvoice | null>(null);
  let snapshotTimerKey = '';
  let ensuredTowerRuntimeId = '';

  const entityId = $derived(String(tab.entityId || runtimeProjectionFrame?.activeEntityId || '').trim().toLowerCase());
  const signerId = $derived(String(tab.signerId || runtimeProjectionFrame?.activeEntity?.summary.signerId || '').trim().toLowerCase());
  const jurisdiction = $derived(String(tab.jurisdiction || runtimeProjectionFrame?.activeEntity?.summary.jurisdiction?.name || '').trim());
  const controllerRuntimeId = $derived(String($runtimeControllerHandle.runtimeId || '').trim().toLowerCase());
  const runtimeId = $derived(
    controllerRuntimeId && controllerRuntimeId !== 'embedded'
      ? controllerRuntimeId
      : String($activeRuntime?.id || '').trim().toLowerCase(),
  );
  const liveEnv = $derived(embeddedRuntimeContext.liveEnvResolver?.() ?? embeddedRuntimeContext.liveEnv);
  const commandReady = $derived($runtimeControllerHandle.commandReady && runtimeFrameContext.isLive);

  const projection = $derived.by(() => {
    const derive = $xlnFunctions.isReady ? $xlnFunctions.deriveDelta : deriveDelta;
    return projectEverydayWallet({ frame: runtimeProjectionFrame, entityId, externalRows: extSnapshot.balanceRows, nativeBalance: extSnapshot.nativeBalance, deriveDeltaFn: derive });
  });

  async function refreshExternal(force = false): Promise<EverydayExternalSnapshot> {
    if (!entityId || !signerId || !jurisdiction) return extSnapshot;
    const next = await loadEverydayExternalSnapshot({ runtimeId, entityId, signerId, jurisdiction, frame: runtimeProjectionFrame, liveEnv, xln: $xlnInstance, force });
    if (next) extSnapshot = next;
    return extSnapshot;
  }

  function syncPayHash(): void {
    if (typeof window === 'undefined') return;
    if (!window.location.hash.toLowerCase().startsWith('#pay/')) return;
    try { externalInvoice = parseXlnInvoice(window.location.href); } catch { externalInvoice = null; }
  }

  function clearPayHash(): void {
    externalInvoice = null;
    if (typeof window === 'undefined') return;
    if (!window.location.hash.toLowerCase().startsWith('#pay/')) return;
    const next = `${window.location.pathname}${window.location.search}`;
    try { replaceState(next, window.history.state ?? {}); } catch { window.history.replaceState(window.history.state, '', next); }
  }

  $effect(() => {
    const nextKey = `${runtimeId}|${entityId}|${signerId}|${jurisdiction}`;
    if (nextKey !== snapshotTimerKey && entityId && signerId && jurisdiction) {
      snapshotTimerKey = nextKey;
      void refreshExternal(false);
    }
  });

  $effect(() => {
    if (runtimeId && runtimeId !== ensuredTowerRuntimeId && String($activeRuntime?.id || '').trim().toLowerCase() === runtimeId) {
      ensuredTowerRuntimeId = runtimeId;
      vaultOperations.ensureEverydayTowerDefaults(runtimeId);
    }
  });

  $effect(() => {
    if (!commandReady || !entityId || !signerId || !jurisdiction || !runtimeProjectionFrame?.activeEntity) return;
    if (projection.hubAccounts.length > 0 || readHubJoinPreference() === 'manual') return;
    void maybeAutoJoinEverydayHub({
      runtimeId, entityId, signerId, jurisdiction, frame: runtimeProjectionFrame,
      hubAccountsCount: projection.hubAccounts.length, liveEnv, xln: $xlnInstance, commandReady,
    });
  });

  onMount(() => {
    syncPayHash();
    const onHash = () => syncPayHash();
    window.addEventListener('hashchange', onHash);
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshExternal(true); }, 2_500);
    return () => { window.removeEventListener('hashchange', onHash); window.clearInterval(interval); };
  });
</script>

<div class="everyday-shell" data-testid="everyday-shell">
  <header class="ev-topbar">
    <ContextSwitcher
      {tab}
      allowAddRuntime={allowHeaderAddRuntime}
      allowAddJurisdiction={true}
      allowAddEntity={true}
      addRuntimeLabel={headerRuntimeAddLabel}
      on:entitySelect={e => onEntitySelect?.(e.detail)}
      on:addRuntime={() => onAddRuntime?.()}
      on:addJurisdiction={() => onAddJurisdiction?.()}
      on:addEntity={() => onAddEntity?.()}
    />
    <button type="button" class="ev-icon-btn" class:active={activeTab === 'settings'} data-testid="nav-settings" aria-label="Settings" onclick={() => activeTab = activeTab === 'settings' ? 'cash' : 'settings'}>
      <Settings size={20} />
    </button>
  </header>

  <nav class="ev-nav" aria-label="Wallet sections">
    <button type="button" class="ev-nav-btn" class:active={activeTab === 'cash'} data-testid="nav-cash" onclick={() => activeTab = 'cash'}>Cash</button>
    <button type="button" class="ev-nav-btn" class:active={activeTab === 'friends'} data-testid="nav-friends" onclick={() => activeTab = 'friends'}>Friends</button>
    <button type="button" class="ev-nav-btn" class:active={activeTab === 'savings'} data-testid="nav-savings" onclick={() => activeTab = 'savings'}>Savings</button>
    <button type="button" class="ev-nav-btn" class:active={activeTab === 'activity'} data-testid="nav-activity" onclick={() => activeTab = 'activity'}>Activity</button>
  </nav>

  <main class="ev-main">
    {#if activeTab === 'cash'}
      <EverydayCash {projection} frame={runtimeProjectionFrame} externalRows={extSnapshot.externalRows} nativeBalance={extSnapshot.nativeBalance} decimals={extSnapshot.decimals} symbol={extSnapshot.symbol} {liveEnv} xln={$xlnInstance} isLive={runtimeFrameContext.isLive} {commandReady} {runtimeId} onRefresh={() => refreshExternal(true)} />
    {:else if activeTab === 'friends'}
      <EverydayFriends {projection} frame={runtimeProjectionFrame} externalRows={extSnapshot.externalRows} nativeBalance={extSnapshot.nativeBalance} decimals={extSnapshot.decimals} {liveEnv} xln={$xlnInstance} isLive={runtimeFrameContext.isLive} {commandReady} onRefresh={() => void refreshExternal(true)} />
    {:else if activeTab === 'savings'}
      <EverydaySavings {projection} frame={runtimeProjectionFrame} externalRows={extSnapshot.externalRows} nativeBalance={extSnapshot.nativeBalance} decimals={extSnapshot.decimals} symbol={extSnapshot.symbol} {liveEnv} xln={$xlnInstance} isLive={runtimeFrameContext.isLive} {commandReady} onRefresh={() => void refreshExternal(true)} />
    {:else if activeTab === 'activity'}
      <EverydayActivity {projection} runtime={$activeRuntime} frame={runtimeProjectionFrame} decimals={extSnapshot.decimals} />
    {:else}
      <EverydaySettings {projection} runtime={$activeRuntime} />
    {/if}
  </main>

  {#if externalInvoice}
    {#key externalInvoice.raw}
      <ExternalRequestSheet invoice={externalInvoice} {projection} frame={runtimeProjectionFrame} externalRows={extSnapshot.externalRows} nativeBalance={extSnapshot.nativeBalance} decimals={extSnapshot.decimals} {liveEnv} xln={$xlnInstance} isLive={runtimeFrameContext.isLive} {commandReady} onRefresh={() => void refreshExternal(true)} onClose={clearPayHash} />
    {/key}
  {/if}
</div>

<style>
  .everyday-shell {
    --ev-radius: 8px;
    --ink-settled: #f5f5f7;
    --ink-arriving: #e8b04b;
    --ink-owed: #e8b04b;
    --ink-dispute: #f26d6d;
    --ink-delta-in: #4ade80;
    --ink-action: #f5f5f7;
    --ink-action-fg: #0b0e14;
    background: #121212;
    color: #e6e9f0;
    min-height: 100vh;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 680px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
    position: relative;
  }
  .ev-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; position: relative; z-index: 1; }
  .ev-topbar > :global(.context-switcher) { min-width: 0; flex: 1 1 auto; }
  .ev-icon-btn { flex-shrink: 0; min-width: 48px; min-height: 48px; border-radius: var(--ev-radius); border: 1px solid rgba(255,255,255,0.12); background: transparent; color: #e6e9f0; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: background 180ms ease-out; }
  .ev-icon-btn.active, .ev-icon-btn:hover { background: rgba(255,255,255,0.10); }
  .ev-nav { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; position: relative; z-index: 1; }
  .ev-nav-btn { min-height: 48px; border-radius: var(--ev-radius); border: 1px solid transparent; background: transparent; color: #959eae; font: inherit; font-weight: 600; cursor: pointer; transition: background 180ms ease-out, color 180ms ease-out; }
  .ev-nav-btn.active { background: rgba(255,255,255,0.09); color: #f5f5f7; border-color: rgba(255,255,255,0.14); }
  .ev-main { display: flex; flex-direction: column; gap: 20px; position: relative; z-index: 1; }
  .everyday-shell :global(.ev-hero-region) { padding: 8px 0 4px; display: flex; flex-direction: column; gap: 12px; }
  .everyday-shell :global(.ev-label) { font-size: 0.8125rem; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; color: #959eae; margin: 0; }
  .everyday-shell :global(.ev-balance-trigger) { appearance: none; border: 0; background: transparent; padding: 0; margin: 0; text-align: left; cursor: pointer; width: fit-content; min-height: 48px; display: inline-flex; align-items: baseline; border-radius: var(--ev-radius); }
  .everyday-shell :global(.ev-balance-trigger:focus-visible) { outline: 2px solid #f5f5f7; outline-offset: 4px; }
  .everyday-shell :global(.ev-card) { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); border-radius: var(--ev-radius); padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .everyday-shell :global(.ev-hero) { font-size: clamp(2.6rem, 7.5vw, 3.8rem); font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -0.035em; margin: 0; line-height: 1.05; color: var(--ink-settled); transition: opacity 200ms ease-out; }
  .everyday-shell :global(.ev-hero.is-syncing) { opacity: 0.62; }
  .everyday-shell :global(.ev-hero.is-savings) { color: var(--ink-owed); }
  .everyday-shell :global(.ev-cents) { font-size: 0.56em; font-weight: 600; vertical-align: 0.34em; opacity: 0.72; letter-spacing: -0.01em; }
  .everyday-shell :global(.ev-suffix) { font-size: 0.42em; font-weight: 600; margin-left: 0.22em; opacity: 0.72; letter-spacing: 0; }
  .everyday-shell :global(.ev-delta) { margin: 0; font-size: 0.9rem; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ink-delta-in); }
  .everyday-shell :global(.ev-delta.is-out) { color: #959eae; }
  .everyday-shell :global(.ev-truth) { margin: 0; padding: 10px 14px; border-left: 2px solid rgba(255,255,255,0.22); font-size: 0.875rem; line-height: 1.5; color: #e6e9f0; max-width: 54ch; }
  .everyday-shell :global(.ev-muted) { color: #959eae; font-size: 0.9rem; line-height: 1.5; margin: 0; max-width: 54ch; }
  .everyday-shell :global(.ev-btn) { min-height: 48px; padding: 0 16px; border-radius: var(--ev-radius); border: 1px solid rgba(255,255,255,0.16); background: transparent; color: #f5f5f7; font: inherit; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: background 180ms ease-out, opacity 180ms ease-out; }
  .everyday-shell :global(.ev-btn:hover:not(:disabled)) { background: rgba(255,255,255,0.08); }
  .everyday-shell :global(.ev-btn.primary) { background: var(--ink-action); border-color: var(--ink-action); color: var(--ink-action-fg); }
  .everyday-shell :global(.ev-btn.primary:hover:not(:disabled)) { opacity: 0.9; background: var(--ink-action); }
  .everyday-shell :global(.ev-btn.danger) { background: rgba(242,109,109,0.14); border-color: rgba(242,109,109,0.4); color: #fecdd3; }
  .everyday-shell :global(.ev-btn:disabled) { opacity: 0.48; cursor: not-allowed; }
  .everyday-shell :global(.ev-input) { min-height: 48px; padding: 10px 14px; border-radius: var(--ev-radius); border: 1px solid rgba(255,255,255,0.16); background: #181c24; color: #f5f5f7; font: inherit; width: 100%; box-sizing: border-box; }
  .everyday-shell :global(.ev-row) { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .everyday-shell :global(.ev-field) { display: flex; flex-direction: column; gap: 6px; font-size: 0.875rem; color: #d0d0da; }
  .everyday-shell :global(.ev-pill) { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: var(--ev-radius); font-size: 0.9rem; font-weight: 600; font-variant-numeric: tabular-nums; background: transparent; border: 1px dashed var(--ink-arriving); color: var(--ink-arriving); width: fit-content; }
  .everyday-shell :global(.ev-alert) { padding: 12px 14px; border-radius: var(--ev-radius); font-size: 0.9rem; line-height: 1.45; margin: 0; }
  .everyday-shell :global(.ev-alert.error) { background: rgba(242,109,109,0.14); border: 1px solid rgba(242,109,109,0.38); color: #fecdd3; }
  .everyday-shell :global(.ev-alert.ok) { background: rgba(74,222,128,0.12); border: 1px solid rgba(74,222,128,0.32); color: #bbf7d0; }
  .everyday-shell :global(.ev-num) { font-variant-numeric: tabular-nums; }
  @media (prefers-reduced-motion: reduce) {
    .everyday-shell :global(.ev-hero), .ev-icon-btn, .ev-nav-btn, .everyday-shell :global(.ev-btn) { transition: none; }
  }
</style>
