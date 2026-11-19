<script lang="ts">
  import { defaultAccountDisputeConfigForParties } from '@xln/core/account/config/dispute-config';
  import type { RuntimeAdapterViewFrame, RuntimeReplica, XLNModule } from '@xln/core/api/public/runtime-module';
  import { submitEntityInputs } from '#lib/stores/xlnStore.ts';
  import { runtimeQueryClient } from '#lib/stores/runtimeQueryClient.ts';
  import { setWalletPosture } from '#lib/stores/everyday/walletPostureStore.ts';
  import { invoiceNote, type ParsedXlnInvoice } from '#lib/utils/xlnInvoice.ts';
  import { EVERYDAY_COPY } from '#lib/everyday/wallet-posture.ts';
  import { classifyExternalRequest, type EverydayWalletProjection } from '#lib/everyday/everyday-projection.ts';
  import { acceptedInvoiceJurisdictions, readTxTypeParam, resolveHubTarget } from '#lib/everyday/external-request.ts';
  import { planEverydaySend, planFriendSplitTxs, type EverydayExternalRow, type EverydaySendRoute } from '#lib/everyday/everyday-autopilot.ts';
  import { executeEverydaySendPlan, submitEverydaySavingsDeposit } from './everyday-funding';
  import { findDirectBilateralRoute, formatUsd, parseUsdAmount, quoteEverydayRoute, resolveEverydayApiBase, resolveEverydayDeliveryMode } from './everyday-runtime';

  interface Props {
    invoice: ParsedXlnInvoice; projection: EverydayWalletProjection; frame: RuntimeAdapterViewFrame | null;
    externalRows: readonly EverydayExternalRow[]; nativeBalance: bigint; decimals: number;
    liveEnv: RuntimeReplica | null; xln: XLNModule | null; isLive: boolean; commandReady: boolean; onRefresh: () => void; onClose: () => void;
  }
  let { invoice, projection, frame, externalRows, nativeBalance, decimals, liveEnv, xln, isLive, commandReady, onRefresh, onClose }: Props = $props();

  let amountInput = $state('');
  let consentChecked = $state(false);
  let quotedRoute = $state<EverydaySendRoute | null>(null);
  let quoteError = $state('');
  let quoting = $state(false);
  let busy = $state(false);
  let errorMsg = $state('');
  let lastInvoiceRaw = '';

  const sheetCopy = EVERYDAY_COPY.externalRequestSheet;
  const targetId = $derived(invoice.targetEntityId.toLowerCase());
  const targetEntity = $derived(frame?.entities.find(e => e.entityId.toLowerCase() === targetId));
  const isHubTarget = $derived(resolveHubTarget(projection.hubAccounts.includes(targetId), targetEntity));
  const peerLabel = $derived(targetEntity?.label || `${targetId.slice(0, 8)}…`);
  const invoiceDescription = $derived(invoiceNote(invoice).description);
  const effectiveAmount = $derived(invoice.amount || amountInput.trim());
  const txType = $derived(readTxTypeParam(invoice.raw));
  const classification = $derived(classifyExternalRequest({ invoice, txType, counterpartyLabel: peerLabel, amountLabel: effectiveAmount ? `$${effectiveAmount}` : undefined, isHubTarget }));
  const parsedAmount = $derived.by(() => {
    if (!effectiveAmount) return 0n;
    try { const val = parseUsdAmount(effectiveAmount, decimals); return val > 0n ? val : 0n; }
    catch { return 0n; }
  });

  $effect(() => {
    if (invoice.raw !== lastInvoiceRaw) {
      lastInvoiceRaw = invoice.raw;
      amountInput = ''; consentChecked = false; quotedRoute = null; quoteError = ''; quoting = false; errorMsg = ''; busy = false;
    }
  });

  $effect(() => {
    quotedRoute = null; quoteError = '';
    if (classification.kind !== 'cash-spend' || parsedAmount <= 0n || !projection.entityId) { quoting = false; return; }
    const tokenId = invoice.tokenId ?? projection.primaryTokenId;
    const tokenCash = projection.byToken.get(tokenId)?.cash ?? 0n;
    const direct = xln ? findDirectBilateralRoute({ frame, entityId: projection.entityId, targetEntityId: targetId, tokenId, amount: parsedAmount, deriveDeltaFn: xln.deriveDelta }) : null;
    if (direct) { quotedRoute = direct; quoting = false; return; }
    let cancelled = false; quoting = true;
    void quoteEverydayRoute({ entityId: projection.entityId, targetEntityId: targetId, tokenId, amount: parsedAmount, primaryHubId: projection.primaryHubId, cash: tokenCash > 0n ? 1n : 0n, liveEnv, xln })
      .then(route => { if (!cancelled) { quotedRoute = route; quoteError = ''; } })
      .catch(err => { if (!cancelled) { quotedRoute = null; quoteError = err instanceof Error ? err.message : 'Could not quote payment route.'; } })
      .finally(() => { if (!cancelled) quoting = false; });
    return () => { cancelled = true; };
  });

  async function confirmRequest(): Promise<void> {
    if (busy || !isLive || !commandReady || !projection.signerId || !xln || parsedAmount <= 0n) return;
    if (classification.kind === 'savings-deposit' && !consentChecked) return;
    busy = true; errorMsg = '';
    try {
      if (invoice.jurisdictionId) {
        const local = frame?.activeEntity?.core?.config?.jurisdiction ?? (projection.jurisdiction ? { name: projection.jurisdiction } : null);
        // The wallet's own name or stack id needs no catalog; fetch it only to resolve an alias.
        if (!acceptedInvoiceJurisdictions(local, null).includes(invoice.jurisdictionId)) {
          let catalog: unknown = null;
          try {
            const res = await fetch(`${resolveEverydayApiBase()}/api/jurisdictions`, { cache: 'no-store', signal: AbortSignal.timeout(5_000) });
            if (res.ok) catalog = await res.json();
          } catch { /* Without the catalog, only the wallet's own name and stack id are accepted. */ }
          if (!acceptedInvoiceJurisdictions(local, catalog).includes(invoice.jurisdictionId)) {
            throw new Error('Invoice jurisdiction does not match the active jurisdiction');
          }
        }
      }
      const tokenId = invoice.tokenId ?? projection.primaryTokenId;
      if (classification.kind === 'savings-deposit') {
        // Deposit only with the hub that sent the request, never a different one.
        if (!projection.hubAccounts.includes(targetId)) throw new Error('This request is from a hub you have no account with.');
        await submitEverydaySavingsDeposit({
          frame, entityId: projection.entityId, signerId: projection.signerId, hubId: targetId,
          tokenId, amountText: effectiveAmount, principal: parsedAmount, decimals,
          externalRows, nativeBalance, liveEnv, xln,
        });
        onRefresh(); onClose();
        return;
      }
      if (classification.kind === 'open-friend-tab') {
        const doc = frame?.activeEntity?.accounts.items.find(a =>
          (a.state.leftEntity.toLowerCase() === projection.entityId && a.state.rightEntity.toLowerCase() === targetId) ||
          (a.state.rightEntity.toLowerCase() === projection.entityId && a.state.leftEntity.toLowerCase() === targetId));
        const hasSummary = Boolean(frame?.entities.some(e => e.entityId.toLowerCase() === targetId));
        const txs = planFriendSplitTxs({
          entityId: projection.entityId, counterpartyEntityId: targetId, tokenId, splitAmount: parsedAmount,
          existingAccount: doc ? { leftEntity: doc.state.leftEntity, rightEntity: doc.state.rightEntity, deltas: doc.state.deltas } : null,
          deriveDeltaFn: xln.deriveDelta, summaries: frame?.entities,
          ...(!hasSummary ? { disputeConfig: defaultAccountDisputeConfigForParties(projection.entityId, false, targetId, false) } : {}),
        });
        await submitEntityInputs([{ entityId: projection.entityId, signerId: projection.signerId, entityTxs: txs }]);
        onRefresh(); onClose();
        return;
      }
      const tokenCash = projection.byToken.get(tokenId)?.cash ?? 0n;
      const route = quotedRoute ?? findDirectBilateralRoute({ frame, entityId: projection.entityId, targetEntityId: targetId, tokenId, amount: parsedAmount, deriveDeltaFn: xln.deriveDelta }) ?? await quoteEverydayRoute({ entityId: projection.entityId, targetEntityId: targetId, tokenId, amount: parsedAmount, primaryHubId: projection.primaryHubId, cash: tokenCash, liveEnv, xln });
      const deliveryMode = resolveEverydayDeliveryMode(route);
      const buildPlan = (cur: RuntimeAdapterViewFrame | null) => planEverydaySend({ frame: cur, entityId: projection.entityId, signerId: projection.signerId ?? '', targetEntityId: targetId, tokenId, deliveryMode, description: invoiceDescription, route, externalRows, nativeBalance, deriveDeltaFn: xln.deriveDelta });
      await executeEverydaySendPlan({
        plan: buildPlan(frame), entityId: projection.entityId, signerId: projection.signerId, tokenId, liveEnv, xln,
        refreshPlan: async () => buildPlan(await runtimeQueryClient.readViewFrame({ entityId: projection.entityId })),
      });
      onRefresh(); onClose();
    } catch (err) { errorMsg = err instanceof Error ? err.message : 'Request failed.'; }
    finally { busy = false; }
  }
</script>

<div class="ev-sheet-backdrop" role="dialog" aria-modal="true" data-testid="external-request-sheet">
  <div class="ev-card ev-sheet">
    <p class="ev-muted">External link request</p>
    <h2 style="margin:0;font-size:1.35rem;">{classification.title}</h2>
    <p>{classification.summary}</p>
    {#if !invoice.amount && classification.kind !== 'escalate-pro'}
      <label class="ev-field"><span>Amount</span><input class="ev-input" data-testid="external-request-amount" inputmode="decimal" placeholder="10.00" bind:value={amountInput} disabled={busy} /></label>
    {/if}
    {#if quotedRoute}<p class="ev-muted ev-num">{quotedRoute.totalFee === 0n ? 'Fee: Free' : `Fee: ${formatUsd(quotedRoute.totalFee, decimals)}`}</p>{/if}
    {#if quoteError}<p class="ev-alert error">{quoteError}</p>{/if}
    <p class="ev-muted">{sheetCopy.survival}</p>
    {#if classification.riskNote}<p class="ev-alert error">{classification.riskNote}</p>{/if}
    {#if classification.kind === 'savings-deposit'}
      <label class="ev-row" style="min-height:48px;cursor:pointer;">
        <input type="checkbox" data-testid="external-savings-consent" bind:checked={consentChecked} style="width:24px;height:24px;accent-color:#10b981;" />
        <span>I understand Savings is not protected like Cash.</span>
      </label>
    {/if}
    {#if errorMsg}<p class="ev-alert error" role="alert">{errorMsg}</p>{/if}
    <div class="ev-row" style="justify-content:flex-end;">
      <button type="button" class="ev-btn" onclick={onClose} disabled={busy}>Cancel</button>
      {#if classification.kind === 'escalate-pro'}
        <span class="ev-muted" data-testid="external-request-escalate">Requires Pro tools</span>
        <button type="button" class="ev-btn primary" data-testid="external-request-open-pro" onclick={() => { setWalletPosture('pro'); onClose(); }}>Open Pro mode</button>
      {:else}
        <button type="button" class="ev-btn primary" data-testid="external-request-confirm" disabled={busy || !isLive || !commandReady || parsedAmount <= 0n || (classification.kind === 'cash-spend' && (!quotedRoute || quoting)) || (classification.kind === 'savings-deposit' && !consentChecked)} onclick={() => void confirmRequest()}>
          {busy ? 'Confirming...' : 'Confirm'}
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .ev-sheet-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.65); display: flex; align-items: flex-end; justify-content: center; padding: 16px; z-index: 60; }
  .ev-sheet { width: 100%; max-width: 520px; background: #1c1c20; }
</style>
