<!--
  TokenSelect.svelte - Reusable token selector

  Clean design with token icons and consistent formatting.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getKnownTokenIds, getTokenInfo } from '@xln/core/account/utils';

  export let value: number = 1;
  export let disabled: boolean = false;
  export let label: string = '';
  export let compact: boolean = false;

  const dispatch = createEventDispatcher();

  const tokens = getKnownTokenIds().map(id => {
    const meta = getTokenInfo(id);
    return { id, ...meta, icon: meta.symbol === 'USDC' || meta.symbol === 'USDT' ? '$' : meta.symbol[0] };
  });

  let showDropdown = false;

  $: selectedToken = tokens.find(t => t.id === value);
  $: tokenLabel = label || 'Token';

  function selectToken(id: number) {
    value = id;
    showDropdown = false;
    dispatch('change', { value: id });
  }

  function toggleDropdown() {
    if (!disabled) showDropdown = !showDropdown;
  }

  function handleBlur() {
    setTimeout(() => showDropdown = false, 150);
  }
</script>

<div class="token-select" class:disabled class:compact>
  {#if label}
    <span class="select-label">{label}</span>
  {/if}

  <button
    class="select-trigger"
    type="button"
    aria-label={tokenLabel}
    aria-haspopup="listbox"
    aria-expanded={showDropdown}
    on:click={toggleDropdown}
    on:blur={handleBlur}
    {disabled}
  >
    {#if selectedToken}
    <span class="token-icon" style="background: {selectedToken.color}">
      {selectedToken.icon}
    </span>
    <span class="token-symbol">{selectedToken.symbol}</span>
    {:else}<span role="alert">Unknown token #{value}</span>{/if}
    <svg class="chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </button>

  {#if showDropdown}
    <div class="dropdown" role="listbox" aria-label={tokenLabel}>
      {#each tokens as token}
        <button
          class="dropdown-item"
          class:selected={token.id === value}
          aria-selected={token.id === value}
          role="option"
          on:mousedown|preventDefault={() => selectToken(token.id)}
        >
          <span class="token-icon" style="background: {token.color}">
            {token.icon}
          </span>
          <div class="token-info">
            <span class="token-symbol">{token.symbol}</span>
            {#if !compact}
              <span class="token-name">{token.name}</span>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .token-select {
    position: relative;
  }

  .token-select.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .select-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text-muted, #80889a);
    margin-bottom: 6px;
    text-transform: none;
    letter-spacing: 0.01em;
  }

  .select-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    background: var(--theme-input-bg, #121418);
    border: 1px solid var(--theme-input-border, #5a6270);
    border-radius: 8px;
    color: var(--theme-text-primary, #e6ebf2);
    font-size: 14px;
    cursor: pointer;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
  }

  .compact .select-trigger {
    padding: 8px 10px;
    min-width: 80px;
  }

  .select-trigger:hover:not(:disabled) {
    border-color: var(--theme-input-focus, var(--theme-text-secondary, #9aa3b2));
  }

  .select-trigger:focus {
    outline: none;
    border-color: var(--theme-accent, #c5cfde);
  }

  .token-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
  }

  .compact .token-icon {
    width: 20px;
    height: 20px;
    font-size: 10px;
  }

  .token-symbol {
    font-weight: 500;
    flex: 1;
    text-align: left;
  }

  .chevron {
    color: var(--theme-text-muted, #80889a);
    flex-shrink: 0;
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 180px;
    width: max-content;
    max-width: min(260px, calc(100vw - 24px));
    margin-top: 4px;
    background: var(--theme-surface, #121418);
    border: 1px solid var(--theme-border, #262a31);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 100;
    overflow: hidden;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    background: none;
    border: none;
    color: var(--theme-text-primary, #e6ebf2);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
  }

  .dropdown-item:hover {
    background: var(--theme-surface-hover, #1b1e24);
  }

  .dropdown-item.selected {
    background: color-mix(in srgb, var(--theme-text-primary, #e6ebf2) 10%, transparent);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.18);
  }

  .token-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .token-name {
    font-size: 11px;
    color: var(--theme-text-muted, #80889a);
    white-space: normal;
    overflow-wrap: anywhere;
  }
</style>
