<script lang="ts">
  import { KeyRound } from 'lucide-svelte';
  import { readStewardPin, writeStewardPin, type StewardPin } from '../../../governance/steward-request';

  let { entityId }: { entityId: string } = $props();

  const storage = (): Storage | null => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  };

  let pin = $state<StewardPin | null>(null);
  let stewardEntityId = $state('');
  let stewardSigner = $state('');
  let label = $state('');
  let error = $state('');

  $effect(() => {
    pin = entityId ? readStewardPin(storage(), entityId) : null;
  });

  function save(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    const store = storage();
    if (!store) {
      error = 'This browser does not allow saving a steward on this device.';
      return;
    }
    try {
      writeStewardPin(store, entityId, { stewardEntityId, stewardSigner, label, pinnedAt: Date.now() });
      pin = readStewardPin(store, entityId);
      stewardEntityId = '';
      stewardSigner = '';
      label = '';
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : String(cause);
      error = code === 'STEWARD_PIN_SIGNER_INVALID' ? 'The signer must be a 0x address (40 hex digits).' : 'The steward must be a 0x Entity id (64 hex digits).';
    }
  }

  function unpin() {
    const store = storage();
    if (store) writeStewardPin(store, entityId, null);
    pin = null;
  }
</script>

<section class="panel" data-testid="steward-pin">
  <div class="panel-title"><KeyRound size={15} /><span>Steward</span></div>
  {#if pin}
    <p class="copy">Requests signed by {pin.label || 'this steward'} open as a sheet you sign or decline. Nothing is signed for you.</p>
    <dl class="facts">
      <div><dt>Entity</dt><dd title={pin.stewardEntityId}>{pin.stewardEntityId}</dd></div>
      <div><dt>Signer</dt><dd title={pin.stewardSigner}>{pin.stewardSigner}</dd></div>
    </dl>
    <button type="button" class="btn" data-testid="steward-unpin" onclick={unpin}>Unpin</button>
  {:else}
    <p class="copy">Pin an agent Entity to read its signed requests. Without a pin, every request link is refused.</p>
    <form class="pin-form" onsubmit={save}>
      <label>Label<input maxlength="40" bind:value={label} data-testid="steward-pin-label" /></label>
      <label>Steward Entity id<input required class="mono" bind:value={stewardEntityId} data-testid="steward-pin-entity" /></label>
      <label>Steward signer address<input required class="mono" bind:value={stewardSigner} data-testid="steward-pin-signer" /></label>
      {#if error}<p role="alert" class="error">{error}</p>{/if}
      <button type="submit" class="btn" data-testid="steward-pin-save">Pin steward</button>
    </form>
  {/if}
</section>

<style>
  .copy { margin: 0 0 10px; font-size: 13px; line-height: 1.45; color: var(--theme-text-secondary, #a1a1aa); }
  .facts { display: grid; gap: 6px; margin: 0 0 10px; }
  .facts dt { font-size: 12px; color: var(--theme-text-muted, #71717a); }
  .facts dd { margin: 0; font: 12px 'SF Mono', ui-monospace, monospace; overflow-wrap: anywhere; }
  .pin-form { display: grid; gap: 8px; }
  .pin-form label { display: grid; gap: 4px; font-size: 12px; color: var(--theme-text-secondary, #a1a1aa); }
  .pin-form input { min-height: 40px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--theme-card-border, #27272a); background: transparent; color: var(--theme-text-primary, #f4f4f5); }
  .mono { font-family: 'SF Mono', ui-monospace, monospace; }
  .error { margin: 0; font-size: 13px; color: var(--theme-danger, #f87171); }
  .btn { min-height: 40px; justify-self: start; }
</style>
