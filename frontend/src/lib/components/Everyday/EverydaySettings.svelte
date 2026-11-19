<script lang="ts">
  import { vaultOperations, type Runtime } from '#lib/stores/vault/vaultStore.ts';
  import { setWalletPosture } from '#lib/stores/everyday/walletPostureStore.ts';
  import { resetRetiredTestnetState } from '#lib/utils/control/resetEverything.ts';
  import { SURFACES } from '../../../../../docs/studies/ui/surfaces/surfaces.generated';
  import type { EverydayWalletProjection } from '#lib/everyday/everyday-projection.ts';
  import { classifyRecoveryShieldState } from '#lib/everyday/everyday-recovery.ts';
  import { resolveRecoveryShieldInput } from './everyday-runtime';

  interface Props { projection: EverydayWalletProjection; runtime: Runtime | null; }
  let { projection, runtime }: Props = $props();

  let exporting = $state(false);
  let resetting = $state(false);
  let proChecked = $state(false);
  let statusMsg = $state('');
  let errorMsg = $state('');

  const resetCopy = SURFACES.everyday.flows['reset-demo'];
  const shield = $derived(classifyRecoveryShieldState({
    shieldStatus: resolveRecoveryShieldInput(runtime),
    disputes: projection.disputes,
    hasZeroL1Gas: projection.hasZeroL1Gas,
  }));

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
    resetting = true; errorMsg = ''; statusMsg = resetCopy.pending.text;
    try { await resetRetiredTestnetState('/app'); statusMsg = resetCopy.done.text; }
    catch (err) { errorMsg = err instanceof Error ? err.message : resetCopy.failed.text; statusMsg = ''; resetting = false; }
  }
</script>

<section class="ev-card" data-testid="everyday-backup-status">
  <h2 style="margin:0;font-size:1.15rem;">Backup &amp; safety</h2>
  <p class="ev-muted">{shield.summary}</p>
  <button type="button" class="ev-btn" disabled={exporting} onclick={() => void saveBackup()}>
    {exporting ? 'Saving encrypted backup...' : 'Save encrypted backup'}
  </button>
</section>

<section class="ev-card">
  <label class="ev-row" style="justify-content:space-between;min-height:48px;cursor:pointer;">
    <span style="flex:1;">
      <strong style="display:block;font-size:1.1rem;">Trading &amp; operator tools (Pro)</strong>
      <span class="ev-muted">Show orderbooks, cross-chain swaps, credit lanes, and node controls.</span>
    </span>
    <input
      type="checkbox"
      data-testid="toggle-pro-mode"
      checked={proChecked}
      style="width:48px;height:48px;accent-color:#10b981;cursor:pointer;"
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
    {resetting ? resetCopy.pending.text : resetCopy.before.text}
  </button>
</section>

{#if errorMsg}<p class="ev-alert error" role="alert">{errorMsg}</p>{/if}
{#if statusMsg && !errorMsg}<p class="ev-alert ok" role="status">{statusMsg}</p>{/if}
