<script lang="ts">
  import { vaultOperations, type Runtime } from '#lib/stores/vault/vaultStore.ts';
  import { setWalletPosture } from '#lib/stores/everyday/walletPostureStore.ts';
  import { resetRetiredTestnetState } from '#lib/utils/control/resetEverything.ts';
  import {
    EVERYDAY_COPY,
    EVERYDAY_DESIGN_PREVIEW_STATES,
    needsEverydayMotionPermission,
    requestEverydayMotionPermission,
    splitMoneyDisplay,
    type EverydayDesignPreviewId,
  } from '#lib/everyday/wallet-posture.ts';
  import type { EverydayWalletProjection } from '#lib/everyday/everyday-projection.ts';
  import { classifyRecoveryShieldState } from '#lib/everyday/everyday-recovery.ts';
  import { resolveRecoveryShieldInput } from './everyday-runtime';

  interface Props {
    projection: EverydayWalletProjection;
    runtime: Runtime | null;
    theme?: 'dark' | 'light';
    onThemeChange?: (next: 'dark' | 'light') => void;
  }
  let { projection, runtime, theme = 'dark', onThemeChange }: Props = $props();

  let exporting = $state(false);
  let resetting = $state(false);
  let proChecked = $state(false);
  let statusMsg = $state('');
  let errorMsg = $state('');
  let previewId = $state<EverydayDesignPreviewId>('settled');
  let previewTruthOpen = $state(false);
  let showMotionPrompt = $state(needsEverydayMotionPermission());

  async function enableTiltGlare(): Promise<void> {
    if (await requestEverydayMotionPermission()) {
      showMotionPrompt = false;
    }
  }

  const resetCopy = EVERYDAY_COPY.flows.resetDemo;
  const shield = $derived(classifyRecoveryShieldState({
    shieldStatus: resolveRecoveryShieldInput(runtime),
    disputes: projection.disputes,
    hasZeroL1Gas: projection.hasZeroL1Gas,
  }));
  const previewState = $derived(
    EVERYDAY_DESIGN_PREVIEW_STATES.find(entry => entry.id === previewId)
    ?? EVERYDAY_DESIGN_PREVIEW_STATES[1]!,
  );
  const previewParts = $derived(splitMoneyDisplay(previewState.amount));

  async function saveBackup(): Promise<void> {
    if (exporting) return;
    exporting = true; errorMsg = ''; statusMsg = '';
    try {
      const { filename, json } = await vaultOperations.exportRecoveryBundle(runtime?.id);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      statusMsg = 'Encrypted backup saved';
    } catch (err) { errorMsg = err instanceof Error ? err.message : 'Could not save backup right now.'; }
    finally { exporting = false; }
  }

  async function clearTestData(): Promise<void> {
    if (resetting) return;
    resetting = true; errorMsg = ''; statusMsg = resetCopy.pending;
    try { await resetRetiredTestnetState('/app'); statusMsg = resetCopy.done; }
    catch (err) { errorMsg = err instanceof Error ? err.message : resetCopy.failed; statusMsg = ''; resetting = false; }
  }
</script>

<section class="ev-card" data-testid="everyday-backup-status">
  <h2 style="margin:0;font-size:1.15rem;">Backup &amp; safety</h2>
  <p class="ev-muted">{shield.summary}</p>
  <button type="button" class="ev-btn" disabled={exporting} onclick={() => void saveBackup()}>
    {exporting ? 'Saving encrypted backup...' : 'Save encrypted backup'}
  </button>
</section>

<section class="ev-card" data-testid="everyday-design-preview">
  <div class="ev-row" style="justify-content:space-between;">
    <p class="ev-label">Appearance &amp; design</p>
    <div class="ev-row">
      <button type="button" class="ev-preview-pill" data-testid="everyday-theme-dark" aria-pressed={theme === 'dark'} onclick={() => onThemeChange?.('dark')}>Dark</button>
      <button type="button" class="ev-preview-pill" data-testid="everyday-theme-light" aria-pressed={theme === 'light'} onclick={() => onThemeChange?.('light')}>Light</button>
      {#if showMotionPrompt}
        <button type="button" class="ev-preview-pill" data-testid="everyday-enable-tilt" onclick={() => void enableTiltGlare()}>Tilt glare</button>
      {/if}
    </div>
  </div>
  <div class="ev-preview-stage" data-ev-state={previewState.id === 'arriving' ? 'arriving' : previewState.syncing ? 'syncing' : 'settled'}>
    <div class="ev-row" role="group" aria-label="Preview wallet state">
      {#each EVERYDAY_DESIGN_PREVIEW_STATES as entry (entry.id)}
        <button
          type="button"
          class="ev-preview-pill"
          aria-pressed={entry.id === previewState.id}
          data-testid={`everyday-preview-${entry.id}`}
          onclick={() => previewId = entry.id}
        >
          {entry.tabLabel}
        </button>
      {/each}
    </div>
    <p class="ev-label">{previewState.heading}</p>
    <button type="button" class="ev-balance-trigger" aria-expanded={previewTruthOpen} onclick={() => previewTruthOpen = !previewTruthOpen}>
      <div class="ev-hero" class:is-syncing={previewState.syncing} class:is-savings={previewState.savings}>
        <span>{previewParts.major}</span>{#if previewParts.minor}<span class="ev-cents">{previewParts.minor}</span>{/if}{#if previewParts.suffix}<span class="ev-suffix">{previewParts.suffix}</span>{/if}
      </div>
    </button>
    {#if previewState.sublineKind === 'delta-in'}
      <p class="ev-delta">{previewState.subline}</p>
    {:else}
      <p class="ev-muted">{previewState.subline}</p>
    {/if}
    {#if previewTruthOpen}<p class="ev-truth">{previewState.truth}</p>{/if}
    {#if previewState.arrivingAmount}<div class="ev-pill">{previewState.arrivingAmount}</div>{/if}
    {#if previewState.showActions}
      <div class="ev-actions" aria-hidden="true">
        <span class="ev-btn primary">Pay</span>
        <span class="ev-btn">Request</span>
        <span class="ev-btn">Cash out</span>
      </div>
    {/if}
  </div>
</section>

<section class="ev-card">
  <label class="ev-row" style="justify-content:space-between;min-height:48px;cursor:pointer;">
    <span style="flex:1;">
      <strong style="display:block;font-size:1.1rem;">Trading &amp; operator tools (Pro)</strong>
      <span class="ev-muted">Show orderbooks, cross-chain swaps, credit lanes, and node controls.</span>
    </span>
    <input
      type="checkbox"
      class="ev-switch-input"
      data-testid="toggle-pro-mode"
      checked={proChecked}
      onchange={e => {
        proChecked = (e.currentTarget as HTMLInputElement).checked;
        setWalletPosture(proChecked ? 'pro' : 'everyday');
      }}
    />
  </label>
</section>

<section class="ev-card">
  <h2 style="margin:0;font-size:1.15rem;">Test network</h2>
  <p class="ev-muted">Clear local test state while keeping your wallet login.</p>
  <button type="button" class="ev-btn danger" data-testid="settings-clear-test-data" disabled={resetting} onclick={() => void clearTestData()}>
    {resetting ? resetCopy.pending : resetCopy.before}
  </button>
</section>

{#if errorMsg}<p class="ev-alert error" role="alert">{errorMsg}</p>{/if}
{#if statusMsg && !errorMsg}<p class="ev-alert ok" role="status">{statusMsg}</p>{/if}
