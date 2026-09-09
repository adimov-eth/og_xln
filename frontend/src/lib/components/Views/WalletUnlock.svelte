<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import RuntimeCreation from './RuntimeCreation.svelte';
  import WalletPasswordForm from './WalletPasswordForm.svelte';
  export let runtimeId: string;
  let recovering = false;
  const dispatch = createEventDispatcher<{ unlocked: void }>();
</script>

{#if recovering}
  <RuntimeCreation embedded={true} unlockRuntimeId={runtimeId} on:walletReady={() => dispatch('unlocked')} />
{:else}
  <WalletPasswordForm {runtimeId} on:unlocked={() => dispatch('unlocked')} on:recover={() => { recovering = true; }} />
{/if}
