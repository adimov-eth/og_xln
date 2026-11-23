<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import { allRuntimes, vaultOperations } from '#lib/stores/vault/vaultStore.ts';
  import { hasPasswordVault, savePasswordVault, unlockPasswordVault } from '#lib/security/passwordVault.ts';
  import { deleteVaultDeviceKey } from '#lib/security/vaultProtection.ts';
  export let runtimeId: string;
  export let seed: string | undefined = undefined;
  /** Omitted: follow the page theme. Given: the host screen has its own scheme toggle, so match it. */
  export let scheme: 'dark' | 'light' | undefined = undefined;
  export let onCancel: (() => void) | undefined = undefined;
  const dispatch = createEventDispatcher<{ unlocked: void; recover: void }>();
  let password = '', confirmation = '', error = '', busy = false;
  let passwordInput: HTMLInputElement;
  let protectedHere = hasPasswordVault(runtimeId);
  $: wallet = $allRuntimes.find(value => value.id.toLowerCase() === runtimeId.toLowerCase());
  $: setup = !protectedHere && Boolean(seed || wallet?.seed);
  async function submit() {
    if (busy) return;
    busy = true; error = '';
    const secret = password;
    password = '';
    try {
      if (setup) {
        if (secret.length < 8) throw new Error('Use at least 8 characters.');
        if (secret !== confirmation) throw new Error('Passwords do not match.');
        const unlockedSeed = seed || wallet?.seed;
        if (!unlockedSeed) throw new Error('Restore your wallet first.');
        await savePasswordVault(runtimeId, unlockedSeed, secret);
        if (wallet?.protectedSecrets) await deleteVaultDeviceKey(runtimeId, wallet.protectedSecrets);
        protectedHere = true;
      } else {
        const seed = await unlockPasswordVault(runtimeId, secret);
        await vaultOperations.unlockRuntime(runtimeId, seed);
      }
      dispatch('unlocked');
    } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
    finally {
      confirmation = ''; busy = false;
      if (error) { await tick(); passwordInput?.focus(); }
    }
  }
</script>

  <main class="unlock" class:scheme-light={scheme === 'light'} class:scheme-dark={scheme === 'dark'}>
    <form on:submit|preventDefault={submit}>
      <p class="name">{wallet?.label || 'Wallet'}</p>
      <h1>{setup ? 'Set a local password' : 'Unlock wallet'}</h1>
      {#if protectedHere || setup}
        <label for="local-wallet-password">Password</label>
        <input id="local-wallet-password" type="password" bind:this={passwordInput} bind:value={password} autocomplete={setup ? 'new-password' : 'current-password'} required minlength={setup ? 8 : undefined} disabled={busy} />
        {#if setup}
          <label for="local-wallet-confirm">Confirm password</label>
          <input id="local-wallet-confirm" type="password" bind:value={confirmation} autocomplete="new-password" required disabled={busy} />
        {/if}
        <button type="submit" disabled={busy || !password}>{busy ? 'Opening…' : setup ? 'Save and open' : 'Unlock'}</button>
      {:else}
        <p>Restore this wallet once to set a password for this device.</p>
      {/if}
      {#if error}<p role="alert">{error}</p>{/if}
      {#if onCancel}<button type="button" class="recover" disabled={busy} on:click={onCancel}>Back</button>{/if}
      {#if !setup}<button type="button" class="recover" disabled={busy} on:click={() => dispatch('recover')}>Restore wallet</button>{/if}
    </form>
  </main>
<style>
  /* Global theme tokens; a forced scheme restates its theme's values, composed tokens included, since those resolve at :root. */
  .unlock {
    box-sizing: border-box; min-height: 100dvh; display: grid; place-items: center; padding: 24px var(--content-pad, 16px);
    color: var(--theme-text-primary, #e6ebf2); background: var(--theme-bg-gradient, var(--theme-background, #07080b));
  }
  .scheme-dark {
    --theme-background: #07080b; --theme-bg-gradient: linear-gradient(180deg, #14181f 0%, #080a0e 46%, #030406 100%);
    --theme-text-primary: #e6ebf2; --theme-text-secondary: #9aa3b2; --theme-text-muted: #80889a;
    --theme-surface: #121418; --theme-input-bg: #07080b; --theme-input-border: #5f656e; --theme-debit: #f43f5e;
    --theme-accent: #c5cfde; --theme-accent-contrast: #050608;
    --theme-primary-metal: linear-gradient(154deg, #f5f7fa 0%, color-mix(in srgb, #c5cfde 55%, #f5f7fa) 52%, #c5cfde 100%);
    color-scheme: dark;
  }
  .scheme-light {
    --theme-background: #f2f4f8; --theme-bg-gradient: linear-gradient(180deg, #fbfcfd 0%, #f2f4f8 46%, #e5e9f0 100%); --theme-text-primary: #0f172a; --theme-text-secondary: #475569;
    --theme-surface: #ffffff; --theme-input-bg: #ffffff; --theme-input-border: #7b8390; --theme-debit: #dc2626;
    --theme-accent: #2b313c; --theme-accent-contrast: #f8fafc; --theme-text-muted: #5f6877;
    /* Tokens built from other tokens resolve at :root, so the light metal is restated here. */
    --theme-primary-metal: linear-gradient(154deg, #11151d 0%, color-mix(in srgb, #2b313c 55%, #11151d) 52%, #2b313c 100%);
    color-scheme: light;
  }
  form { width: min(100%, 360px); display: grid; gap: 16px; }
  h1 { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 12px; }
  p { line-height: 1.5; margin: 0; }
  .name { color: var(--theme-text-secondary, #9aa3b2); }
  label { font-size: 14px; color: var(--theme-text-secondary, #9aa3b2); }
  input {
    box-sizing: border-box; min-height: 48px; padding: 0 14px; font: inherit; color: inherit;
    border: 1px solid var(--theme-input-border, #5f656e); border-radius: var(--ui-radius-base, 12px); background: var(--theme-input-bg, #07080b);
  }
  input:focus { outline: none; border-color: var(--theme-text-secondary, #9aa3b2); box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-text-primary, #e6ebf2) 12%, transparent); }
  button {
    box-sizing: border-box; min-height: 48px; padding: 0 16px; font: inherit; font-weight: 600; cursor: pointer;
    border: 1px solid color-mix(in srgb, var(--theme-accent, #c5cfde) 40%, transparent); border-radius: var(--ui-radius-base, 12px);
    background: var(--theme-primary-metal); color: var(--theme-accent-contrast, #050608);
  }
  button:disabled { cursor: default; background: color-mix(in srgb, var(--theme-text-primary, #e6ebf2) 8%, transparent); border-color: transparent; color: var(--theme-text-muted, #80889a); }
  .recover, .recover:disabled { background: transparent; border-color: transparent; color: var(--theme-text-secondary, #9aa3b2); font-weight: 500; }
  .recover:hover:not(:disabled) { color: var(--theme-text-primary, #e6ebf2); }
  [role=alert] { color: color-mix(in srgb, var(--theme-debit, #ef4444) 70%, var(--theme-text-primary, #e6ebf2)); }
</style>
