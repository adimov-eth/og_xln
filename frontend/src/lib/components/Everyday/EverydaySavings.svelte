<script lang="ts">
  import { onMount } from 'svelte';
  import type { EntityTx, RuntimeAdapterViewFrame, RuntimeReplica, XLNModule } from '@xln/core/api/public/runtime-module';
  import { submitEntityInputs } from '#lib/stores/xlnStore.ts';
  import { EVERYDAY_COPY } from '#lib/everyday/wallet-posture.ts';
  import type { EverydayWalletProjection } from '#lib/everyday/everyday-projection.ts';
  import type { EverydayExternalRow } from '#lib/everyday/everyday-autopilot.ts';
  import { pickActiveSavingsOffer, type LendingState } from '../../../../../ui/src/runtime/financial/lending';
  import { readEverydayLendingSnapshot, submitEverydaySavingsDeposit } from './everyday-funding';
  import { formatUsd, parseUsdAmount } from './everyday-runtime';

  interface Props {
    projection: EverydayWalletProjection; frame: RuntimeAdapterViewFrame | null;
    externalRows: readonly EverydayExternalRow[]; nativeBalance: bigint; decimals: number; symbol: string;
    liveEnv: RuntimeReplica | null; xln: XLNModule | null; isLive: boolean; commandReady: boolean; onRefresh: () => void;
  }
  let { projection, frame, externalRows, nativeBalance, decimals, symbol, liveEnv, xln, isLive, commandReady, onRefresh }: Props = $props();

  let amount = $state(''); let consentChecked = $state(false);
  let lendingState = $state<LendingState | null>(null);
  let lendingError = $state('');
  let busy = $state(false); let statusMsg = $state(''); let errorMsg = $state('');

  const termsCopy = EVERYDAY_COPY.terms.savings;
  const flows = EVERYDAY_COPY.flows;
  const hubId = $derived(projection.primaryHubId);
  const hubDoc = $derived(hubId ? frame?.activeEntity?.accounts.items.find(a => a.state.leftEntity.toLowerCase() === hubId || a.state.rightEntity.toLowerCase() === hubId) : undefined);
  const activeOffer = $derived(
    hubDoc && lendingState
      ? pickActiveSavingsOffer(lendingState.terms, hubDoc.state.domain, projection.primaryTokenId)
      : { kind: 'none' as const },
  );
  const bankTerms = $derived(activeOffer.kind === 'active' ? activeOffer.terms : undefined);
  const openPools = $derived((lendingState?.savings ?? []).filter(p => p.lenderEntityId.toLowerCase() === projection.entityId && (p.status === 'open' || p.status === 'queued')));
  const parsedPrincipal = $derived.by(() => {
    if (!amount.trim()) return 0n;
    try { const val = parseUsdAmount(amount, decimals); return val > 0n ? val : 0n; }
    catch { return 0n; }
  });
  const canAdd = $derived(Boolean(!busy && isLive && commandReady && consentChecked && bankTerms && parsedPrincipal > 0n && parsedPrincipal <= projection.primary.cash));

  async function loadSavings(): Promise<void> {
    if (!hubId || !projection.entityId) { lendingState = null; lendingError = ''; return; }
    try {
      lendingState = await readEverydayLendingSnapshot(hubId, projection.entityId, projection.primaryTokenId);
      lendingError = '';
    } catch { lendingError = "Savings isn't offered right now. Your Cash is safe."; }
  }

  $effect(() => { if (hubId && projection.entityId) void loadSavings(); });
  onMount(() => {
    const id = window.setInterval(() => { if (!busy && document.visibilityState === 'visible') void loadSavings(); }, 3_000);
    return () => window.clearInterval(id);
  });

  async function addToSavings(event: Event): Promise<void> {
    event.preventDefault();
    if (!canAdd || !projection.signerId || !hubId || !xln) return;
    busy = true; errorMsg = ''; statusMsg = flows.saveIn.pending;
    try {
      await submitEverydaySavingsDeposit({
        frame, entityId: projection.entityId, signerId: projection.signerId, hubId, tokenId: projection.primaryTokenId,
        amountText: amount.trim(), principal: parsedPrincipal, decimals, lendingState, externalRows, nativeBalance,
        liveEnv, xln, onStage: msg => { statusMsg = msg; },
      });
      statusMsg = flows.saveIn.done; amount = ''; consentChecked = false; await loadSavings(); onRefresh();
    } catch (err) { errorMsg = err instanceof Error ? err.message : flows.saveIn.failed; statusMsg = ''; }
    finally { busy = false; }
  }

  async function moveToCash(positionId: string, positionHubId: string): Promise<void> {
    const targetHubId = (positionHubId || hubId || '').toLowerCase();
    if (busy || !isLive || !commandReady || !projection.signerId || !targetHubId) return;
    busy = true; errorMsg = ''; statusMsg = flows.saveOut.pending;
    try {
      const tx: EntityTx = { type: 'lendingClosePosition', data: { hubEntityId: targetHubId, positionId } };
      await submitEntityInputs([{ entityId: projection.entityId, signerId: projection.signerId, entityTxs: [tx] }]);
      statusMsg = flows.saveOut.done; await loadSavings(); onRefresh();
    } catch (err) { errorMsg = err instanceof Error ? err.message : flows.saveOut.failed; statusMsg = ''; }
    finally { busy = false; }
  }
</script>

<section class="ev-card">
  <p class="ev-muted">{termsCopy.label}</p>
  <h2 class="ev-hero" data-testid="everyday-savings-balance">{formatUsd(projection.primary.savings, decimals)}</h2>
  <p class="ev-muted">{termsCopy.note}</p>
  {#if bankTerms}
    <p class="ev-muted ev-num">Current rate: {(bankTerms.savingsInterestBps / 100).toFixed(2)}% APY</p>
  {:else if lendingError || lendingState !== null}
    <p class="ev-muted">{lendingError || "Savings isn't offered right now. Your Cash is safe."}</p>
  {/if}
</section>

<form class="ev-card" onsubmit={e => void addToSavings(e)}>
  <label class="ev-field"><span>Amount ({symbol})</span><input class="ev-input" inputmode="decimal" placeholder="50.00" data-testid="everyday-savings-amount" bind:value={amount} disabled={busy} /></label>
  <label class="ev-row" style="min-height:48px;cursor:pointer;align-items:center;">
    <input type="checkbox" data-testid="everyday-savings-consent" bind:checked={consentChecked} style="width:24px;height:24px;accent-color:#10b981;" />
    <span style="flex:1;font-size:0.92rem;color:#d0d0da;">I understand Savings is lent out to earn interest and is not protected like Cash.</span>
  </label>
  <button type="submit" class="ev-btn primary" data-testid="everyday-savings-add" disabled={!canAdd}>
    {busy ? flows.saveIn.pending : flows.saveIn.before}
  </button>
</form>

{#if openPools.length > 0}
  <section class="ev-card">
    {#each openPools as pool (pool.positionId)}
      <div class="ev-row" style="justify-content:space-between;">
        <div>
          <strong class="ev-num">{formatUsd(pool.closeAmount, decimals)}</strong>
          <p class="ev-muted">{pool.status === 'queued' ? 'Waiting to move back to Cash' : 'Earning interest'}</p>
        </div>
        <button type="button" class="ev-btn" data-testid="everyday-savings-move" disabled={busy || !isLive || !commandReady || pool.status !== 'open'} onclick={() => void moveToCash(pool.positionId, pool.hubEntityId)}>
          {flows.saveOut.before}
        </button>
      </div>
    {/each}
  </section>
{/if}

{#if errorMsg}<p class="ev-alert error" role="alert">{errorMsg}</p>{/if}
{#if statusMsg && !errorMsg}<p class="ev-alert ok" role="status">{statusMsg}</p>{/if}
