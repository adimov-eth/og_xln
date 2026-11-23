<script lang="ts">
  import { tick, createEventDispatcher } from 'svelte';

  // Props
  export let open = false;
  export let minWidth = 200;
  export let maxWidth = 420;
  export let disabled = false;
  export let ariaLabel: string | null = null;
  export let triggerTestId: string | null = null;
  export let triggerRuntimeId: string | null = null;
  export let triggerEntityId: string | null = null;
  export let triggerSignerId: string | null = null;
  export let triggerJurisdiction: string | null = null;
  export let triggerText: string | null = null;

  const dispatch = createEventDispatcher();

  let triggerEl: HTMLButtonElement;
  let menuEl: HTMLDivElement;

  // Position state
  let top = 0;
  let left = 0;
  let width = minWidth;

  $: if (triggerEl && menuEl) triggerEl.popoverTargetElement = menuEl;

  // Parent-driven open/close reaches the popover here; user-driven changes arrive via handleToggle.
  $: if (menuEl) {
    const shown = menuEl.matches(':popover-open');
    if (open && !shown) {
      menuEl.showPopover();
      tick().then(updatePosition);
    } else if (!open && shown) {
      menuEl.hidePopover();
    }
  }

  function updatePosition() {
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const viewportWidth = typeof window !== 'undefined' ? Math.max(0, window.innerWidth - 16) : maxWidth;
    const configuredCap = maxWidth > 0 ? Math.max(minWidth, maxWidth) : viewportWidth;
    const cap = Math.max(minWidth, Math.min(configuredCap, viewportWidth));
    width = Math.min(Math.max(rect.width, minWidth), cap);
    top = rect.bottom + 4;
    left = rect.left;

    // Clamp to viewport after menu renders
    tick().then(() => {
      if (!menuEl) return;
      const menuRect = menuEl.getBoundingClientRect();
      let nextLeft = left;
      let nextTop = top;

      if (nextLeft + menuRect.width > window.innerWidth - 8) {
        nextLeft = window.innerWidth - menuRect.width - 8;
      }
      if (nextTop + menuRect.height > window.innerHeight - 8) {
        nextTop = rect.top - menuRect.height - 4;
      }

      left = Math.max(8, nextLeft);
      top = Math.max(8, nextTop);
    });
  }

  function handleToggle(e: ToggleEvent) {
    const next = e.newState === 'open';
    if (next === open) return;
    open = next;
    dispatch('toggle', { open });
    if (!next) dispatch('close');
  }
</script>

<div class="dropdown-wrapper">
  <!-- Trigger button -->
  <button
    bind:this={triggerEl}
    class="dropdown-trigger"
    type="button"
    aria-expanded={open}
    aria-haspopup="true"
    aria-label={ariaLabel || undefined}
    data-testid={triggerTestId || undefined}
    data-runtime-id={triggerRuntimeId || undefined}
    data-entity-id={triggerEntityId || undefined}
    data-signer-id={triggerSignerId || undefined}
    data-jurisdiction={triggerJurisdiction || undefined}
    disabled={disabled}
    aria-disabled={disabled}
  >
    <slot name="trigger" />
    {#if triggerText}
      <span class="trigger-text-sentinel" aria-hidden="true">{triggerText}</span>
    {/if}
  </button>

  <div
    bind:this={menuEl}
    popover="auto"
    class="dropdown-menu"
    style="
      top: {top}px; left: {left}px;
      width: {width}px;
      max-width: calc(100vw - 16px);
    "
    role="menu"
    on:toggle={handleToggle}
  >
    {#if open}
      <slot name="menu" />
    {/if}
  </div>
</div>

<style>
  .dropdown-wrapper {
    display: inline-block;
    width: 100%;
    min-width: 0;
    position: relative;
  }

  .dropdown-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: var(--dropdown-bg, var(--glass-bg, rgba(17, 25, 40, 0.75)));
    border: 1px solid var(--dropdown-border, var(--glass-border, rgba(255, 255, 255, 0.125)));
    border-radius: var(--dropdown-radius, 8px);
    color: var(--dropdown-text, var(--text-primary, rgba(255, 255, 255, 0.95)));
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    backdrop-filter: blur(var(--blur-sm, 16px));
  }

  .dropdown-trigger:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .dropdown-trigger:hover {
    background: var(--dropdown-bg-hover, var(--glass-bg-hover, rgba(17, 25, 40, 0.85)));
    border-color: var(--dropdown-border-hover, rgba(255, 255, 255, 0.2));
  }

  .dropdown-trigger :global(.trigger-content),
  .dropdown-trigger :global(.trigger-text) {
    min-width: 0;
  }

  .trigger-text-sentinel {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .dropdown-menu {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 0;
    color: inherit;
    z-index: 9999;
    background: var(--dropdown-menu-bg, rgba(12, 18, 28, 0.95));
    border: 1px solid var(--dropdown-border, var(--glass-border, rgba(255, 255, 255, 0.125)));
    border-radius: var(--dropdown-radius, 8px);
    box-shadow: var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.4));
    max-height: 60vh;
    box-sizing: border-box;
    overflow-x: hidden;
    overflow-y: auto;
    animation: dropdown-fade 0.05s ease-out;
    backdrop-filter: blur(var(--blur-sm, 16px));
  }

  @keyframes dropdown-fade {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Scrollbar */
  .dropdown-menu::-webkit-scrollbar {
    width: 6px;
  }
  .dropdown-menu::-webkit-scrollbar-track {
    background: transparent;
  }
  .dropdown-menu::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 3px;
  }
  .dropdown-menu::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
</style>
