<script lang="ts">
  import { onMount } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { deriveDelta } from '@xln/core/account/utils';
  import { VALUELESS_CHAIN_IDS } from '@xln/core/jurisdiction/adapter/chain-ids';
  import type { RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
  import { Settings } from 'lucide-svelte';
  import ContextSwitcher from '../Entity/workspace/shell/ContextSwitcher.svelte';
  import type { EntityWorkspaceEmbeddedRuntimeContext } from '../Entity/core/embedded-runtime-context';
  import type { EntityWorkspaceRuntimeFrameContext } from '../Entity/core/runtime-frame-context';
  import { activeRuntime, vaultOperations } from '#lib/stores/vault/vaultStore.ts';
  import { runtimeControllerHandle } from '#lib/stores/runtimeControllerStore.ts';
  import { runtimeHaltMessage, xlnFunctions, xlnInstance } from '#lib/stores/xlnStore.ts';
  import { maybeAutoJoinEverydayHub } from '#lib/stores/everyday/everyday-hub-join.ts';
  import type { Tab } from '#lib/types/ui.ts';
  import { readHubJoinPreference } from '#lib/utils/onboarding/onboardingPreferences.ts';
  import { parseXlnInvoice, type ParsedXlnInvoice } from '#lib/utils/xlnInvoice.ts';
  import { projectEverydayWallet } from '#lib/everyday/everyday-projection.ts';
  import { attachEverydayGlare } from '#lib/everyday/wallet-posture.ts';
  import { loadEverydayExternalSnapshot, type EverydayExternalSnapshot, type EverydayTab } from './everyday-runtime';
  import EverydayCash from './EverydayCash.svelte';
  import EverydayFriends from './EverydayFriends.svelte';
  import EverydaySavings from './EverydaySavings.svelte';
  import EverydayActivity from './EverydayActivity.svelte';
  import EverydaySettings from './EverydaySettings.svelte';
  import ExternalRequestSheet from './ExternalRequestSheet.svelte';
  import EverydayTest from './test/EverydayTest.svelte';

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

  let activeTab = $state<EverydayTab | 'test'>('cash');
  let evTheme = $state<'dark' | 'light'>('dark');
  let backdropEl: HTMLDivElement | null = null;
  let extSnapshot = $state<EverydayExternalSnapshot>({ externalRows: [], balanceRows: [], nativeBalance: 0n, decimals: 6, symbol: 'USDC', tokenAddress: '' });
  let externalInvoice = $state<ParsedXlnInvoice | null>(null);
  let snapshotTimerKey = '';
  let ensuredTowerRuntimeId = '';

  const chainId = $derived(runtimeProjectionFrame?.activeEntity?.core.config.jurisdiction?.chainId);
  const isDemoChain = $derived(chainId !== undefined && VALUELESS_CHAIN_IDS.has(Number(chainId)));

  function setEvTheme(next: 'dark' | 'light'): void {
    evTheme = next;
    try { localStorage.setItem('xln-ui-theme', next); } catch { /* ignore */ }
  }

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
  const evState = $derived(
    projection.disputes.length > 0
      ? 'disputed'
      : !commandReady
        ? 'syncing'
        : projection.primary.arriving > 0n
          ? 'arriving'
          : 'settled',
  );

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
    try {
      const stored = localStorage.getItem('xln-ui-theme');
      if (stored === 'light' || stored === 'dark') evTheme = stored;
    } catch { /* ignore */ }
    const detachGlare = attachEverydayGlare(backdropEl);
    syncPayHash();
    const onHash = () => syncPayHash();
    window.addEventListener('hashchange', onHash);
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshExternal(true); }, 2_500);
    return () => { detachGlare(); window.removeEventListener('hashchange', onHash); window.clearInterval(interval); };
  });
</script>

<div class="everyday-backdrop" bind:this={backdropEl} data-ev-theme={evTheme} data-ev-state={evState}>
<div class="everyday-shell" data-testid="everyday-shell">
  <header class="ev-topbar">
    <ContextSwitcher
      {tab}
      brandTrigger={true}
      allowAddRuntime={allowHeaderAddRuntime}
      allowAddJurisdiction={true}
      allowAddEntity={true}
      addRuntimeLabel={headerRuntimeAddLabel}
      on:entitySelect={e => onEntitySelect?.(e.detail)}
      on:addRuntime={() => onAddRuntime?.()}
      on:addJurisdiction={() => onAddJurisdiction?.()}
      on:addEntity={() => onAddEntity?.()}
    />
    <div class="ev-topbar-actions">
      {#if isDemoChain}
        <button type="button" class="ev-test-trigger" class:active={activeTab === 'test'} data-testid="everyday-test-btn" aria-pressed={activeTab === 'test'} onclick={() => activeTab = activeTab === 'test' ? 'cash' : 'test'}>
          Test
        </button>
      {/if}
      <button type="button" class="ev-icon-btn" class:active={activeTab === 'settings'} data-testid="nav-settings" aria-label="Settings" onclick={() => activeTab = activeTab === 'settings' ? 'cash' : 'settings'}>
        <Settings size={20} />
      </button>
    </div>
  </header>

  <nav class="ev-nav" aria-label="Wallet sections">
    <button type="button" class="ev-nav-btn" class:active={activeTab === 'cash'} data-testid="nav-cash" onclick={() => activeTab = 'cash'}>Cash</button>
    <button type="button" class="ev-nav-btn" class:active={activeTab === 'friends'} data-testid="nav-friends" onclick={() => activeTab = 'friends'}>Friends</button>
    <button type="button" class="ev-nav-btn" class:active={activeTab === 'savings'} data-testid="nav-savings" onclick={() => activeTab = 'savings'}>Savings</button>
    <button type="button" class="ev-nav-btn" class:active={activeTab === 'activity'} data-testid="nav-activity" onclick={() => activeTab = 'activity'}>Activity</button>
  </nav>

  <main class="ev-main">
    {#if activeTab === 'cash'}
      <EverydayCash {projection} frame={runtimeProjectionFrame} externalRows={extSnapshot.externalRows} nativeBalance={extSnapshot.nativeBalance} decimals={extSnapshot.decimals} symbol={extSnapshot.symbol} {liveEnv} xln={$xlnInstance} isLive={runtimeFrameContext.isLive} {commandReady} haltMessage={$runtimeHaltMessage} onRefresh={() => refreshExternal(true)} />
    {:else if activeTab === 'friends'}
      <EverydayFriends {projection} frame={runtimeProjectionFrame} externalRows={extSnapshot.externalRows} nativeBalance={extSnapshot.nativeBalance} decimals={extSnapshot.decimals} {liveEnv} xln={$xlnInstance} isLive={runtimeFrameContext.isLive} {commandReady} onRefresh={() => void refreshExternal(true)} />
    {:else if activeTab === 'savings'}
      <EverydaySavings {projection} frame={runtimeProjectionFrame} externalRows={extSnapshot.externalRows} nativeBalance={extSnapshot.nativeBalance} decimals={extSnapshot.decimals} symbol={extSnapshot.symbol} {liveEnv} xln={$xlnInstance} isLive={runtimeFrameContext.isLive} {commandReady} onRefresh={() => void refreshExternal(true)} />
    {:else if activeTab === 'activity'}
      <EverydayActivity {projection} runtime={$activeRuntime} frame={runtimeProjectionFrame} decimals={extSnapshot.decimals} />
    {:else if activeTab === 'test'}
      <EverydayTest {projection} frame={runtimeProjectionFrame} symbol={extSnapshot.symbol} {jurisdiction} {runtimeId} {commandReady} onRefresh={() => void refreshExternal(true)} onBack={() => activeTab = 'cash'} />
    {:else}
      <EverydaySettings {projection} runtime={$activeRuntime} theme={evTheme} onThemeChange={setEvTheme} />
    {/if}
  </main>

  {#if externalInvoice}
    {#key externalInvoice.raw}
      <ExternalRequestSheet invoice={externalInvoice} {projection} frame={runtimeProjectionFrame} externalRows={extSnapshot.externalRows} nativeBalance={extSnapshot.nativeBalance} decimals={extSnapshot.decimals} {liveEnv} xln={$xlnInstance} isLive={runtimeFrameContext.isLive} {commandReady} onRefresh={() => void refreshExternal(true)} onClose={clearPayHash} />
    {/key}
  {/if}
</div>
</div>

<style>
  :global(:root) {
    --in-oklab: ;
  }
  @supports (background: linear-gradient(in oklab, white, black)) {
    :global(:root) {
      --in-oklab: in oklab;
    }
  }
  .everyday-backdrop {
    --ev-radius: 8px;
    --ev-ground-top: #14181f;
    --ev-ground-mid: #080a0e;
    --ev-ground-bottom: #030406;
    --ev-silver-crown: rgba(244, 248, 255, 0.17);
    --ev-silver-mid: rgba(200, 210, 226, 0.072);
    --ev-silver-tail: rgba(126, 138, 156, 0.018);
    --ev-silver-band-peak: rgba(236, 242, 250, 0.06);
    --ev-silver-band-soft: rgba(196, 208, 224, 0.02);
    --ev-silver-bevel: rgba(244, 248, 252, 0.045);
    --ev-silver-bevel-mid: rgba(203, 213, 225, 0.014);
    --ev-silver-rim: rgba(235, 240, 248, 0.085);
    --ev-num-top: #ffffff;
    --ev-num-mid: #e6ecf4;
    --ev-num-bot: #9aa6b8;
    --ev-btn-primary-top: #ffffff;
    --ev-btn-primary-mid: #e7ecf4;
    --ev-btn-primary-bot: #c5cfde;
    --ev-btn-primary-fg: #050608;
    --ev-btn-secondary-top: rgba(255, 255, 255, 0.08);
    --ev-btn-secondary-bot: rgba(255, 255, 255, 0.02);
    --ev-btn-inset: rgba(255, 255, 255, 0.1);
    --ev-sheen: rgba(248, 250, 252, 0.18);
    --ev-wash-arriving: rgba(140, 200, 255, 0.085);
    --ev-wash-dispute: rgba(242, 109, 109, 0.11);
    --ev-surface: rgba(226, 232, 240, 0.05);
    --ev-surface-active: rgba(226, 232, 240, 0.1);
    --ev-line: rgba(226, 232, 240, 0.1);
    --ev-line-2: rgba(226, 232, 240, 0.16);
    --ev-ink: #e8ecf2;
    --ev-muted: #949eae;
    --ink-settled: #f5f7fa;
    --ink-arriving: #8cc8ff;
    --ink-owed: #a8b8cf;
    --ink-dispute: #f26d6d;
    --ink-delta-in: #4ade80;
    --ink-action: #f5f7fa;
    --ink-action-fg: #050608;
    /* Materials (mirrors ui/src/styles/tokens.css): soft-touch grip, grain, polished edges lit by the ground glare. */
    --ev-grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    --ev-velvet: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='v'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23v)'/%3E%3C/svg%3E");
    --ev-grain-opacity: 0.22;
    --ev-soft-face: #09090a;
    --ev-soft-rim: rgba(255, 255, 255, 0.05);
    --ev-soft-sheen: rgba(255, 255, 255, 0.022);
    --ev-soft-drop: rgba(0, 0, 0, 0.7);
    --ev-glint: rgba(245, 247, 250, 0.85);
    --ev-glint-base: rgba(197, 207, 222, 0.12);
    --ev-ring-hi: #f5f7fa;
    --ev-ring-mid: #8a9099;
    --ev-ring-lo: #2b2e33;
    --ev-ring-opacity: 0.38;
    --ev-press: rgba(0, 0, 0, 0.9);
    --ev-soft-pressed: #040405;
    --ev-input-edge: #5f656e;
    --ev-primary-streak: rgba(255, 255, 255, 0.62);
    /* Brushed metal: long irregular streaks (anisotropic noise), never a regular line pattern. */
    --ev-brush: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='64'%3E%3Cfilter id='b'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.006 0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.1 0 0 0 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url%28%23b%29'/%3E%3C/svg%3E");
    --ev-light-x: 54%;
    --ev-light-y: -12%;
    --ev-bevel-angle: 128deg;
    --ev-glare-pos: 46%;
    position: relative;
    isolation: isolate;
    width: 100%;
    min-height: 100vh;
    background-color: var(--ev-ground-bottom);
    background-image:
      linear-gradient(var(--ev-bevel-angle) var(--in-oklab), transparent calc(var(--ev-glare-pos) - 18%), var(--ev-silver-band-soft) calc(var(--ev-glare-pos) - 7%), var(--ev-silver-band-peak) var(--ev-glare-pos), var(--ev-silver-band-soft) calc(var(--ev-glare-pos) + 7%), transparent calc(var(--ev-glare-pos) + 18%)),
      radial-gradient(ellipse 86% 52% at var(--ev-light-x) var(--ev-light-y) var(--in-oklab), var(--ev-silver-crown) 0%, var(--ev-silver-mid) 36%, var(--ev-silver-tail) 64%, transparent 82%),
      linear-gradient(var(--ev-bevel-angle) var(--in-oklab), var(--ev-silver-bevel) 0%, var(--ev-silver-bevel-mid) 24%, transparent 54%, var(--ev-silver-rim) 100%),
      linear-gradient(to bottom var(--in-oklab), var(--ev-ground-top) 0%, var(--ev-ground-mid) 46%, var(--ev-ground-bottom) 100%);
    background-attachment: fixed;
    color: var(--ev-ink);
  }
  .everyday-backdrop[data-ev-theme='light'] {
    --ev-ground-top: #fbfcfd;
    --ev-ground-mid: #f2f4f8;
    --ev-ground-bottom: #e5e9f0;
    --ev-silver-crown: rgba(255, 255, 255, 0.88);
    --ev-silver-mid: rgba(232, 237, 244, 0.24);
    --ev-silver-tail: rgba(203, 213, 225, 0.08);
    --ev-silver-band-peak: rgba(255, 255, 255, 0.45);
    --ev-silver-band-soft: rgba(240, 244, 250, 0.14);
    --ev-silver-bevel: rgba(255, 255, 255, 0.36);
    --ev-silver-bevel-mid: rgba(226, 232, 240, 0.12);
    --ev-silver-rim: rgba(148, 163, 184, 0.14);
    --ev-num-top: #090b0f;
    --ev-num-mid: #1a212e;
    --ev-num-bot: #3c4759;
    --ev-btn-primary-top: #242a36;
    --ev-btn-primary-mid: #11151d;
    --ev-btn-primary-bot: #050608;
    --ev-btn-primary-fg: #f8fafc;
    --ev-btn-secondary-top: rgba(255, 255, 255, 0.88);
    --ev-btn-secondary-bot: rgba(241, 245, 249, 0.62);
    --ev-btn-inset: rgba(255, 255, 255, 0.88);
    --ev-sheen: rgba(255, 255, 255, 0.78);
    --ev-wash-arriving: rgba(3, 105, 161, 0.07);
    --ev-wash-dispute: rgba(223, 27, 65, 0.08);
    --ev-surface: rgba(255, 255, 255, 0.74);
    --ev-surface-active: rgba(15, 23, 42, 0.06);
    --ev-line: rgba(15, 23, 42, 0.09);
    --ev-line-2: rgba(15, 23, 42, 0.15);
    --ev-ink: #161a22;
    --ev-muted: #59636e;
    --ink-settled: #0f1216;
    --ink-arriving: #0369a1;
    --ink-owed: #3b4b63;
    --ink-dispute: #df1b41;
    --ink-delta-in: #15803d;
    --ink-action: #0f1216;
    --ink-action-fg: #f8fafc;
    --ev-grain-opacity: 0.1;
    --ev-soft-face: #e9ecf1;
    --ev-soft-rim: rgba(255, 255, 255, 0.95);
    --ev-soft-sheen: rgba(255, 255, 255, 0.45);
    --ev-soft-drop: rgba(15, 23, 42, 0.1);
    --ev-glint: rgba(60, 71, 89, 0.5);
    --ev-glint-base: rgba(15, 23, 42, 0.08);
    /* Light rings stay pale: a dark arc on porcelain reads as a smudge, not a polished edge. */
    --ev-ring-hi: #ffffff;
    --ev-ring-mid: #c9cfd8;
    --ev-ring-lo: #9aa3b0;
    --ev-ring-opacity: 0.7;
    /* Pressed keys sink: the inset needs more weight on a pale face to read. */
    --ev-press: rgba(15, 23, 42, 0.22);
    --ev-soft-pressed: #dce0e7;
    --ev-input-edge: #7b8390;
    --ev-primary-streak: rgba(255, 255, 255, 0.14);
    --ev-brush: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='64'%3E%3Cfilter id='b'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.006 0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.055 0 0 0 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url%28%23b%29'/%3E%3C/svg%3E");
  }
  .everyday-backdrop::after {
    content: '';
    position: fixed;
    inset: 0 0 auto 0;
    height: 220px;
    pointer-events: none;
    z-index: 0;
    opacity: 0;
    transition: opacity 420ms ease-out;
  }
  .everyday-backdrop[data-ev-state='arriving']::after {
    opacity: 1;
    background: radial-gradient(ellipse 80% 75% at 50% -20% var(--in-oklab), var(--ev-wash-arriving), transparent 72%);
  }
  .everyday-backdrop[data-ev-state='disputed']::after {
    opacity: 1;
    border-top: 2px solid var(--ink-dispute);
    background: linear-gradient(to bottom var(--in-oklab), var(--ev-wash-dispute), transparent 65%);
  }
  .everyday-shell {
    position: relative;
    z-index: 1;
    padding: 16px var(--content-pad) 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: var(--content-max);
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }
  .ev-topbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .ev-topbar > :global(.context-switcher) { min-width: 0; flex: 0 1 auto; }
  .ev-topbar :global(.context-switcher .dropdown-trigger) { width: auto; min-width: 0; background: transparent !important; border-color: transparent !important; box-shadow: none !important; padding: 2px 8px 2px 2px !important; color: var(--ink-settled) !important; }
  .ev-topbar :global(.context-switcher .dropdown-trigger:hover) { background: var(--ev-surface-active) !important; }
  /* Everyday owns its inks: the chevron follows the Everyday theme, not the app theme. */
  .ev-topbar :global(.pill-arrow) { color: var(--ev-muted) !important; }
  .ev-topbar :global(.pill-trigger.brand-trigger) { display: inline-flex; align-items: center; gap: 10px; padding: 2px; background: transparent; border: 0; }
  .ev-topbar :global(.ev-brand-mark) { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; background: linear-gradient(calc(var(--ev-bevel-angle) + 26deg) var(--in-oklab), var(--ev-btn-primary-top) 0%, var(--ev-btn-primary-mid) 52%, var(--ev-btn-primary-bot) 100%); color: var(--ev-btn-primary-fg); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 1px 3px rgba(0, 0, 0, 0.35); flex: none; }
  .ev-topbar :global(.ev-brand-wordmark) { color: var(--ink-settled); font-size: 1.0625rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
  .ev-topbar-actions { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .ev-test-trigger { flex-shrink: 0; min-width: 48px; min-height: 48px; padding: 0 14px; border-radius: var(--ev-radius); border: 1px solid var(--ev-line-2); background: linear-gradient(to bottom var(--in-oklab), var(--ev-btn-secondary-top), var(--ev-btn-secondary-bot)); box-shadow: inset 0 1px 0 var(--ev-btn-inset); color: var(--ev-muted); font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: background 180ms ease-out, color 180ms ease-out; }
  .ev-test-trigger:hover { background: var(--ev-surface-active); color: var(--ink-settled); }
  .ev-test-trigger.active { background: linear-gradient(calc(var(--ev-bevel-angle) + 26deg) var(--in-oklab), var(--ev-btn-primary-top) 0%, var(--ev-btn-primary-mid) 52%, var(--ev-btn-primary-bot) 100%); border-color: var(--ev-btn-primary-top); color: var(--ev-btn-primary-fg); }
  .ev-icon-btn { flex-shrink: 0; min-width: 48px; min-height: 48px; border-radius: var(--ev-radius); border: 1px solid var(--ev-line-2); background: linear-gradient(to bottom var(--in-oklab), var(--ev-btn-secondary-top), var(--ev-btn-secondary-bot)); box-shadow: inset 0 1px 0 var(--ev-btn-inset); color: var(--ev-ink); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: background 180ms ease-out; }
  .ev-icon-btn.active, .ev-icon-btn:hover { background: var(--ev-surface-active); }
  .ev-nav { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .ev-nav-btn { min-height: 48px; border-radius: var(--ev-radius); border: 1px solid transparent; background: transparent; color: var(--ev-muted); font: inherit; font-weight: 600; cursor: pointer; transition: background 180ms ease-out, color 180ms ease-out; }
  /* Selected means sunk, the same as a pressed key: never a lighter tile. */
  .ev-nav-btn.active { background: var(--ev-soft-pressed); color: var(--ink-settled); border-color: transparent; box-shadow: inset 0 1px 3px var(--ev-press), inset 0 0 0 1px var(--ev-soft-drop); }
  .ev-main { display: flex; flex-direction: column; gap: 20px; }
  .everyday-shell :global(.ev-hero-region) { position: relative; padding: 8px 0 4px; display: flex; flex-direction: column; gap: 12px; }
  .everyday-shell :global(.ev-hero-region.is-sheen::after) { content: ''; position: absolute; inset: -8px -12px; pointer-events: none; border-radius: var(--ev-radius); background: linear-gradient(112deg var(--in-oklab), transparent 22%, var(--ev-sheen) 48%, transparent 74%); animation: ev-settle-sheen 520ms ease-out forwards; }
  @keyframes ev-settle-sheen { 0% { opacity: 0; transform: translateX(-28%); } 35% { opacity: 1; } 100% { opacity: 0; transform: translateX(36%); } }
  .everyday-shell :global(.ev-label) { font-size: 0.8125rem; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; color: var(--ev-muted); margin: 0; }
  .everyday-shell :global(.ev-balance-trigger) { appearance: none; border: 0; background: transparent; padding: 0; margin: 0; text-align: left; cursor: pointer; width: fit-content; min-height: 48px; display: inline-flex; align-items: baseline; border-radius: var(--ev-radius); }
  .everyday-shell :global(.ev-balance-trigger:focus-visible) { outline: 2px solid var(--ink-settled); outline-offset: 4px; }
  .everyday-shell :global(.ev-card) { background: var(--ev-surface); border: 1px solid var(--ev-line-2); box-shadow: inset 0 1px 0 var(--ev-silver-rim); border-radius: var(--ev-radius); padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .everyday-shell :global(.ev-hero) { font-size: var(--money-hero); font-weight: var(--money-hero-weight); font-variant-numeric: tabular-nums; letter-spacing: -0.035em; margin: 0; line-height: 1.04; background: linear-gradient(calc(var(--ev-bevel-angle) + 38deg) var(--in-oklab), var(--ev-num-top) 0%, var(--ev-num-mid) 54%, var(--ev-num-bot) 100%); -webkit-background-clip: text; background-clip: text; color: transparent; transition: opacity 200ms ease-out; }
  .everyday-shell :global(.ev-hero.is-syncing) { opacity: 0.62; }
  .everyday-shell :global(.ev-hero.is-savings) { background: none; -webkit-background-clip: border-box; background-clip: border-box; color: var(--ink-owed); }
  .everyday-shell :global(.ev-cents) { font-size: 0.52em; font-weight: 600; vertical-align: 0.24em; margin-left: 0.02em; opacity: 0.72; letter-spacing: -0.01em; }
  .everyday-shell :global(.ev-suffix) { font-size: 0.42em; font-weight: 600; opacity: 0.68; letter-spacing: 0; }
  .everyday-shell :global(.ev-delta) { margin: 0; font-size: var(--money-sm); font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ink-delta-in); }
  .everyday-shell :global(.ev-delta.is-out) { color: var(--ev-muted); }
  .everyday-shell :global(.ev-truth) { margin: 0; padding: 10px 14px; border-left: 2px solid var(--ev-line-2); font-size: 0.875rem; line-height: 1.5; color: var(--ev-ink); max-width: 54ch; }
  .everyday-shell :global(.ev-muted) { color: var(--ev-muted); font-size: 0.9rem; line-height: 1.5; margin: 0; max-width: 54ch; }
  .everyday-shell :global(.ev-btn) { min-height: 48px; padding: 0 16px; border-radius: var(--ev-radius); border: 1px solid var(--ev-line-2); background: linear-gradient(to bottom var(--in-oklab), var(--ev-btn-secondary-top), var(--ev-btn-secondary-bot)); box-shadow: inset 0 1px 0 var(--ev-btn-inset); color: var(--ink-settled); font: inherit; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: background 180ms ease-out, opacity 180ms ease-out; }
  .everyday-shell :global(.ev-btn:hover:not(:disabled)) { background: var(--ev-surface-active); }
  .everyday-shell :global(.ev-btn.primary) { background: linear-gradient(calc(var(--ev-bevel-angle) + 26deg) var(--in-oklab), var(--ev-btn-primary-top) 0%, var(--ev-btn-primary-mid) 52%, var(--ev-btn-primary-bot) 100%); border-color: var(--ev-btn-primary-top); color: var(--ev-btn-primary-fg); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78), 0 1px 3px rgba(0, 0, 0, 0.36); }
  .everyday-shell :global(.ev-btn.primary:hover:not(:disabled)) { opacity: 0.92; }
  .everyday-shell :global(.ev-btn.danger) { background: color-mix(in oklab, var(--ink-dispute) 14%, transparent); border-color: color-mix(in srgb, var(--ink-dispute) 40%, transparent); color: color-mix(in oklab, var(--ink-dispute) 70%, var(--ev-ink)); }
  /* Danger keeps its identity in every state: hover deepens the tint, press sinks, disabled fades. */
  .everyday-shell :global(.ev-btn.danger:hover:not(:disabled)) { color: color-mix(in oklab, var(--ink-dispute) 58%, var(--ev-ink)); background: color-mix(in oklab, var(--ink-dispute) 22%, transparent); border-color: color-mix(in srgb, var(--ink-dispute) 60%, transparent); }
  .everyday-shell :global(.ev-btn.danger:active:not(:disabled)) { color: color-mix(in oklab, var(--ink-dispute) 58%, var(--ev-ink)); background: color-mix(in oklab, var(--ink-dispute) 16%, transparent); border-color: color-mix(in srgb, var(--ink-dispute) 60%, transparent); box-shadow: inset 0 1px 3px var(--ev-soft-drop); }
  .everyday-shell :global(.ev-btn.danger:disabled) { opacity: 0.6; }
  /* An irreversible action keeps its width while it arms and runs, so the row never reflows under the finger. */
  .everyday-shell :global(.ev-btn.ev-reset-action), .everyday-shell :global(.ev-test-row > .ev-btn.ev-reset-action) { min-width: 10.5em; }
  /* Read by assistive technology, invisible on screen. */
  .everyday-shell :global(.ev-sr-only) { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  .everyday-shell :global(.ev-btn:disabled) { opacity: 0.48; cursor: not-allowed; }
  .everyday-shell :global(.ev-actions) { display: flex; flex-wrap: wrap; gap: 8px; }
  .everyday-shell :global(.ev-actions > .ev-btn) { flex: 1 1 128px; }
  .everyday-shell :global(.ev-test-row) { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid var(--ev-line); }
  .everyday-shell :global(.ev-test-row:first-child) { border-top: 0; padding-top: 2px; }
  .everyday-shell :global(.ev-test-row:last-child) { padding-bottom: 2px; }
  .everyday-shell :global(.ev-test-row > .ev-btn) { flex: 0 0 auto; min-width: 128px; }
  /* A 48px hit area around a 28px track: the input is the touch target, the track and thumb are drawn inside it. */
  .everyday-shell :global(.ev-switch-input) { appearance: none; -webkit-appearance: none; flex: none; position: relative; width: 52px; height: 48px; margin: 0; border: 0; background: none; cursor: pointer; }
  .everyday-shell :global(.ev-switch-input::before) { content: ''; position: absolute; left: 2px; top: 10px; width: 48px; height: 28px; box-sizing: border-box; border-radius: 999px; border: 1px solid var(--ev-line-2); background: var(--ev-surface); transition: background 180ms ease-out, border-color 180ms ease-out; }
  .everyday-shell :global(.ev-switch-input::after) { content: ''; position: absolute; top: 14px; left: 6px; width: 20px; height: 20px; border-radius: 50%; background: var(--ev-muted); transition: transform 180ms ease-out, background 180ms ease-out; }
  .everyday-shell :global(.ev-switch-input:checked::before) { background: var(--ink-action); border-color: var(--ink-action); }
  .everyday-shell :global(.ev-switch-input:checked::after) { transform: translateX(20px); background: var(--ink-action-fg); }
  .everyday-shell :global(.ev-input) { min-height: 48px; padding: 10px 14px; border-radius: var(--ev-radius); border: 1px solid var(--ev-input-edge); background: transparent; box-shadow: inset 0 1px 2px var(--ev-soft-drop); color: var(--ink-settled); font: inherit; width: 100%; box-sizing: border-box; }
  .everyday-shell :global(.ev-row) { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .everyday-shell :global(.ev-field) { display: flex; flex-direction: column; gap: 6px; font-size: 0.875rem; color: var(--ev-ink); }
  .everyday-shell :global(.ev-pill) { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: var(--ev-radius); font-size: 0.9rem; font-weight: 600; font-variant-numeric: tabular-nums; background: transparent; border: 1px dashed var(--ink-arriving); color: var(--ink-arriving); width: fit-content; }
  .everyday-shell :global(.ev-alert) { padding: 12px 14px; border-radius: var(--ev-radius); font-size: 0.9rem; line-height: 1.45; margin: 0; }
  .everyday-shell :global(.ev-alert.error) { background: rgba(242,109,109,0.14); border: 1px solid rgba(242,109,109,0.38); color: var(--ink-dispute); }
  .everyday-shell :global(.ev-alert.ok) { background: rgba(74,222,128,0.12); border: 1px solid rgba(74,222,128,0.32); color: var(--ink-delta-in); }
  .everyday-shell :global(.ev-num) { font-variant-numeric: tabular-nums; }
  .everyday-shell :global(.ev-preview-stage) { position: relative; isolation: isolate; overflow: hidden; padding: 18px 18px 16px; border-radius: var(--ev-radius); border: 1px solid var(--ev-line-2); box-shadow: inset 0 1px 0 var(--ev-silver-rim); background-color: var(--ev-ground-bottom); background-image: linear-gradient(var(--ev-bevel-angle) var(--in-oklab), transparent calc(var(--ev-glare-pos) - 18%), var(--ev-silver-band-soft) calc(var(--ev-glare-pos) - 7%), var(--ev-silver-band-peak) var(--ev-glare-pos), var(--ev-silver-band-soft) calc(var(--ev-glare-pos) + 7%), transparent calc(var(--ev-glare-pos) + 18%)), radial-gradient(ellipse 86% 52% at var(--ev-light-x) var(--ev-light-y) var(--in-oklab), var(--ev-silver-crown) 0%, var(--ev-silver-mid) 36%, var(--ev-silver-tail) 64%, transparent 82%), linear-gradient(var(--ev-bevel-angle) var(--in-oklab), var(--ev-silver-bevel) 0%, var(--ev-silver-bevel-mid) 24%, transparent 54%, var(--ev-silver-rim) 100%), linear-gradient(to bottom var(--in-oklab), var(--ev-ground-top) 0%, var(--ev-ground-mid) 46%, var(--ev-ground-bottom) 100%); display: flex; flex-direction: column; gap: 12px; }
  .everyday-shell :global(.ev-preview-stage[data-ev-state='arriving']) { background-image: radial-gradient(ellipse 80% 70% at 50% -18% var(--in-oklab), var(--ev-wash-arriving), transparent 72%), linear-gradient(var(--ev-bevel-angle) var(--in-oklab), transparent calc(var(--ev-glare-pos) - 18%), var(--ev-silver-band-soft) calc(var(--ev-glare-pos) - 7%), var(--ev-silver-band-peak) var(--ev-glare-pos), var(--ev-silver-band-soft) calc(var(--ev-glare-pos) + 7%), transparent calc(var(--ev-glare-pos) + 18%)), radial-gradient(ellipse 86% 52% at var(--ev-light-x) var(--ev-light-y) var(--in-oklab), var(--ev-silver-crown) 0%, var(--ev-silver-mid) 36%, var(--ev-silver-tail) 64%, transparent 82%), linear-gradient(to bottom var(--in-oklab), var(--ev-ground-top) 0%, var(--ev-ground-mid) 46%, var(--ev-ground-bottom) 100%); }
  .everyday-shell :global(.ev-preview-pill) { min-height: 40px; padding: 0 12px; border-radius: var(--ev-radius); border: 1px solid var(--ev-line-2); background: transparent; color: var(--ev-muted); font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
  .everyday-shell :global(.ev-preview-pill[aria-pressed='true']) { background: linear-gradient(calc(var(--ev-bevel-angle) + 26deg) var(--in-oklab), var(--ev-btn-primary-top) 0%, var(--ev-btn-primary-mid) 52%, var(--ev-btn-primary-bot) 100%); border-color: var(--ev-btn-primary-top); color: var(--ev-btn-primary-fg); }
  @media (prefers-reduced-motion: reduce) {
    .everyday-backdrop::after, .everyday-shell :global(.ev-hero), .ev-icon-btn, .ev-nav-btn, .ev-test-trigger, .everyday-shell :global(.ev-btn) { transition: none; }
    .everyday-shell :global(.ev-hero-region.is-sheen::after) { animation: none; display: none; }
  }
  @media (forced-colors: active) {
    .everyday-backdrop::after, .everyday-shell :global(.ev-hero-region.is-sheen::after) { display: none; }
    .everyday-backdrop, .everyday-shell :global(.ev-preview-stage) { background-image: none; }
    .everyday-shell :global(.ev-hero) { background: none; -webkit-background-clip: border-box; background-clip: border-box; color: CanvasText; }
    .everyday-backdrop[data-ev-state='disputed'] { border-top: 2px solid CanvasText; }
  }

  /* ---------- Materials (mirrors ui/src/styles/everyday.css) ----------
   * The ground light is the only light; edges, rings and the primary streak catch it at --ev-glare-pos / --ev-bevel-angle. */
  .everyday-backdrop::before { content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none; background-image: var(--ev-grain); background-size: 180px; mix-blend-mode: overlay; opacity: var(--ev-grain-opacity); }
  .everyday-shell :global(.ev-btn:not(.primary):not(.danger):not(.quiet)), .everyday-shell :global(.ev-preview-pill), .everyday-shell :global(.ev-card), .ev-test-trigger, .ev-icon-btn { position: relative; isolation: isolate; background: radial-gradient(120% 90% at 50% 0% var(--in-oklab), var(--ev-soft-sheen), transparent 70%), var(--ev-soft-face); border-color: transparent; box-shadow: inset 0 1px 1.5px var(--ev-soft-rim), 0 1px 2px var(--ev-soft-drop); }
  .everyday-shell :global(.ev-btn:not(.primary):not(.danger):not(.quiet))::after, .everyday-shell :global(.ev-preview-pill)::after, .everyday-shell :global(.ev-card)::after, .ev-test-trigger::after, .ev-icon-btn::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: -1; background-image: var(--ev-velvet); background-size: 120px; mix-blend-mode: soft-light; opacity: 0.35; }
  .everyday-shell :global(.ev-btn:not(.primary):not(.danger):not(.quiet))::before, .everyday-shell :global(.ev-preview-pill)::before, .ev-test-trigger::before, .ev-icon-btn::before { content: ''; position: absolute; inset: 0; z-index: 1; border-radius: inherit; padding: 1px; pointer-events: none; background: conic-gradient(from calc(var(--ev-bevel-angle) + 82deg), var(--ev-ring-lo), var(--ev-ring-hi) 7%, var(--ev-ring-mid) 16%, var(--ev-ring-lo) 38%, var(--ev-ring-mid) 58%, var(--ev-ring-hi) 70%, var(--ev-ring-mid) 78%, var(--ev-ring-lo)); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; opacity: var(--ev-ring-opacity); transition: opacity 140ms ease-out; }
  .everyday-shell :global(.ev-btn:not(.primary):not(.danger):not(.quiet):hover:not(:disabled))::before, .everyday-shell :global(.ev-preview-pill:hover)::before, .ev-test-trigger:hover::before, .ev-icon-btn:hover::before { opacity: 0.65; }
  .everyday-shell :global(.ev-btn:not(.primary):not(.danger):not(.quiet):active:not(:disabled)), .everyday-shell :global(.ev-btn:not(.primary):not(.danger):not(.quiet)[aria-pressed='true']), .everyday-shell :global(.ev-preview-pill[aria-pressed='true']), .ev-test-trigger.active, .ev-icon-btn.active { background: var(--ev-soft-pressed); color: var(--ink-settled); box-shadow: inset 0 1px 3px var(--ev-press), inset 0 0 0 1px var(--ev-soft-drop); }
  .everyday-shell :global(.ev-btn:not(.primary):not(.danger):not(.quiet)[aria-pressed='true'])::before, .everyday-shell :global(.ev-preview-pill[aria-pressed='true'])::before, .ev-test-trigger.active::before, .ev-icon-btn.active::before { opacity: 1; }
  /* Amount fields carry the money step below the hero (mirrors React .input.boxed.num). */
  .everyday-shell :global(.ev-input[inputmode='decimal']) { min-height: 60px; font-size: var(--money-lg); font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .everyday-shell :global(.ev-input:focus) { outline: none; border-color: var(--ink-settled); box-shadow: inset 0 1px 2px var(--ev-soft-drop), 0 0 0 3px color-mix(in oklab, var(--ink-settled) 22%, transparent); }
  .everyday-shell :global(.ev-btn:focus-visible), .everyday-shell :global(.ev-preview-pill:focus-visible), .ev-test-trigger:focus-visible, .ev-icon-btn:focus-visible { outline: 2px solid var(--ink-settled); outline-offset: 2px; }
  .everyday-shell :global(.ev-notice) { display: grid; grid-template-columns: 18px 1fr; gap: 10px; align-items: start; max-width: 54ch; margin: 0; font-size: 0.85rem; line-height: 1.5; color: var(--ev-muted); }
  .everyday-shell :global(.ev-notice)::before { content: ''; width: 18px; height: 18px; margin-top: 1px; background: var(--ev-muted); opacity: 0.8; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'/%3E%3C/svg%3E") center / contain no-repeat; }
  .everyday-shell :global(.ev-notice[data-category='unilateral-exit-needs-gas']), .everyday-shell :global(.ev-notice[data-category='tower-issue']) { color: var(--ev-ink); }
  .everyday-shell :global(.ev-notice[data-category='unilateral-exit-needs-gas'])::before, .everyday-shell :global(.ev-notice[data-category='tower-issue'])::before { background: var(--ink-owed); opacity: 1; }
  .ev-test-trigger:hover, .ev-icon-btn:hover { background: radial-gradient(120% 90% at 50% 0% var(--in-oklab), var(--ev-soft-sheen), transparent 70%), var(--ev-soft-face); color: var(--ink-settled); }
  .everyday-shell :global(.ev-card)::before { content: ''; position: absolute; left: 12px; right: 12px; top: 0; height: 1px; pointer-events: none; background: linear-gradient(90deg, transparent, var(--ev-glint-base) 14%, var(--ev-glint) var(--ev-glare-pos), var(--ev-glint-base) 86%, transparent); opacity: 0.7; }
  .everyday-shell :global(.ev-card ~ .ev-card)::before { background: linear-gradient(90deg, transparent, var(--ev-glint-base) 14%, var(--ev-glint-base) 86%, transparent); }
  .ev-topbar { padding-bottom: 14px; background: linear-gradient(90deg, transparent, var(--ev-glint-base) 14%, var(--ev-glint) var(--ev-glare-pos), var(--ev-glint-base) 86%, transparent) bottom / 100% 1px no-repeat; }
  .everyday-shell :global(.ev-btn.primary:disabled) { background: color-mix(in oklab, var(--ev-ink) 8%, transparent); border-color: transparent; color: var(--ev-muted); box-shadow: none; opacity: 1; }
  .everyday-shell :global(.ev-btn.primary:not(:disabled)) { background: linear-gradient(calc(var(--ev-bevel-angle) - 16deg), transparent calc(var(--ev-glare-pos) - 14%), var(--ev-primary-streak) var(--ev-glare-pos), transparent calc(var(--ev-glare-pos) + 12%)), var(--ev-brush), linear-gradient(calc(var(--ev-bevel-angle) + 26deg) var(--in-oklab), var(--ev-btn-primary-top) 0%, var(--ev-btn-primary-mid) 52%, var(--ev-btn-primary-bot) 100%); }
  @media (forced-colors: active) {
    .everyday-backdrop::before, .everyday-shell :global(.ev-btn)::before, .everyday-shell :global(.ev-btn)::after, .everyday-shell :global(.ev-preview-pill)::before, .everyday-shell :global(.ev-preview-pill)::after, .everyday-shell :global(.ev-card)::before, .everyday-shell :global(.ev-card)::after, .ev-test-trigger::before, .ev-test-trigger::after, .ev-icon-btn::before, .ev-icon-btn::after { display: none; }
  }
</style>
