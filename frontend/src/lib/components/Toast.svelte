<!--
  Toast.svelte - Beautiful non-blocking toast notifications
-->
<script lang="ts">
  import { toasts, type Toast } from '#lib/stores/ui/toastStore.ts';
  import { explainWalletError } from '#lib/utils/ui/walletError.ts';
  import { fly, fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';

  let toastList: Toast[] = [];
  toasts.subscribe(t => toastList = t);
</script>

<div class="toast-container">
  {#each toastList as toast (toast.id)}
    <div
      class="toast {toast.type}"
      in:fly={{ y: 50, duration: 200 }}
      out:fade={{ duration: 150 }}
      animate:flip={{ duration: 200 }}
    >
      <span class="icon">
        {#if toast.type === 'success'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        {:else if toast.type === 'error'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M15 9l-6 6M9 9l6 6"/>
          </svg>
        {:else if toast.type === 'warning'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4"/>
            <path d="M12 8h.01"/>
          </svg>
        {/if}
      </span>
      <span class="message" role={toast.type === 'error' ? 'alert' : 'status'}>{toast.type === 'error' ? explainWalletError(toast.message) : toast.message}</span>
      <button class="close" aria-label="Dismiss notification" on:click={() => toasts.remove(toast.id)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 400px;
    pointer-events: none;
  }

  /* Toasts float, so they are frosted glass over the ground. Status lives in the icon, never a stripe. */
  .toast {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--theme-surface, #121418) 82%, transparent);
    backdrop-filter: blur(22px) saturate(0.6);
    -webkit-backdrop-filter: blur(22px) saturate(0.6);
    border: 1px solid var(--theme-border, #262a31);
    box-shadow: 0 10px 30px color-mix(in srgb, #000 30%, transparent);
    font-size: 14px;
    color: var(--theme-text-primary, #e6ebf2);
    pointer-events: none;
  }

  .toast.success .icon { color: var(--theme-credit, #4ade80); }
  .toast.error .icon { color: var(--theme-debit, #f43f5e); }
  .toast.warning .icon { color: var(--theme-warning, #f59e0b); }
  .toast.info .icon { color: var(--theme-text-secondary, #9aa3b2); }

  .icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
  }

  .icon svg {
    width: 100%;
    height: 100%;
  }

  .message {
    flex: 1;
    line-height: 1.4;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .close {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--theme-text-secondary, #9aa3b2);
    cursor: pointer;
    transition: opacity 0.15s;
    pointer-events: auto;
  }

  .close:hover {
    opacity: 1;
  }

  .close svg {
    width: 100%;
    height: 100%;
  }
</style>
