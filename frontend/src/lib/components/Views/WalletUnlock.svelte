<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { allRuntimes } from '#lib/stores/vault/vaultStore.ts';
  import RuntimeCreation from './RuntimeCreation.svelte';
  import WalletPasswordForm from './WalletPasswordForm.svelte';
  export let runtimeId: string;
  let selectedId = '';
  let mode: 'welcome' | 'create' | 'unlock' | 'recover' = 'welcome';
  const dispatch = createEventDispatcher<{ unlocked: void }>();
</script>

{#if mode === 'welcome'}
  <main class="wallet-entry">
    <section>
      <h1>Welcome back</h1>
      <h2>Saved wallets</h2>
      {#each $allRuntimes as wallet (wallet.id)}
        <button class="wallet" on:click={() => { selectedId = wallet.id; mode = 'unlock'; }}>
          <span>{wallet.label || 'Wallet'}</span><small>{wallet.id.slice(-8)}</small><span>Unlock →</span>
        </button>
      {/each}
      <button class="create" on:click={() => { mode = 'create'; }}>Create a wallet</button>
    </section>
  </main>
{:else}
  <button class="back" on:click={() => { mode = 'welcome'; }}>← Back</button>
  {#if mode === 'create'}
    <RuntimeCreation embedded={true} on:walletReady={() => dispatch('unlocked')} />
  {:else if mode === 'recover'}
    <RuntimeCreation embedded={true} unlockRuntimeId={selectedId || runtimeId} on:walletReady={() => dispatch('unlocked')} />
  {:else}
    {#key selectedId}
      <WalletPasswordForm runtimeId={selectedId} on:unlocked={() => dispatch('unlocked')} on:recover={() => { mode = 'recover'; }} />
    {/key}
  {/if}
{/if}

<style>
  .wallet-entry {
    box-sizing: border-box; min-height: 100dvh; display: grid; place-items: center; padding: 24px var(--content-pad, 16px);
    background: var(--theme-bg-gradient, var(--theme-background, #07080b)); color: var(--theme-text-primary, #e6ebf2);
  }
  section { width: min(100%, 440px); }
  h1 { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 24px; }
  h2 { font-size: 13px; font-weight: 600; color: var(--theme-text-secondary, #9aa3b2); margin: 0 0 4px; }
  button {
    box-sizing: border-box; min-height: 48px; padding: 0 16px; font: inherit; font-weight: 600; cursor: pointer;
    border: 1px solid var(--theme-input-border, #5f656e); border-radius: var(--ui-radius-base, 12px);
    background: var(--theme-surface, #121418); color: var(--theme-text-primary, #e6ebf2);
    transition: background-color 120ms ease-out;
  }
  button:hover { background: color-mix(in srgb, var(--theme-text-primary, #e6ebf2) 6%, var(--theme-surface, #121418)); }
  /* Unlocking a saved wallet is why someone is here; creating another is secondary. */
  .create { width: 100%; margin-top: 24px; background: transparent; border-color: transparent; color: var(--theme-text-secondary, #9aa3b2); }
  .create:hover { color: var(--theme-text-primary, #e6ebf2); background: transparent; }
  .wallet { width: 100%; min-height: 56px; display: flex; align-items: center; gap: 12px; margin-top: 8px; text-align: left; }
  .wallet span:first-child { flex: 1; }
  small { color: var(--theme-text-muted, #80889a); font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px; font-weight: 400; }
  .wallet span:last-child { color: var(--theme-text-secondary, #9aa3b2); font-weight: 500; }
  .back { position: absolute; top: 16px; left: 16px; z-index: 1; }
</style>
