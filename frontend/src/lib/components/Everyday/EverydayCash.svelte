<script lang="ts">
  import QRCode from 'qrcode';
  import type { RuntimeAdapterViewFrame, RuntimeReplica, XLNModule } from '@xln/core/api/public/runtime-module';
  import { asTokenId } from '@xln/core/protocol/units';
  import { submitEntityInputs } from '#lib/stores/xlnStore.ts';
  import { runtimeQueryClient } from '#lib/stores/runtimeQueryClient.ts';
  import { getOpenAccountRebalancePolicyData } from '#lib/utils/onboarding/onboardingPreferences.ts';
  import { buildWalletPayHref } from '#lib/utils/xlnInvoice.ts';
  import { EVERYDAY_COPY, splitMoneyDisplay } from '#lib/everyday/wallet-posture.ts';
  import type { EverydayWalletProjection } from '#lib/everyday/everyday-projection.ts';
  import { formatEverydayArrivingNote, inspectHubRebalanceStatus } from '#lib/everyday/everyday-policy.ts';
  import {
    explainEverydayCashOutBlock,
    explainEverydaySendBlock,
    planEverydayCashOut,
    planEverydaySend,
    type EverydayExternalRow,
    type EverydaySendRoute,
  } from '#lib/everyday/everyday-autopilot.ts';
  import { executeEverydaySendPlan } from './everyday-funding';
  import { findDirectBilateralRoute, formatUsd, parseUsdAmount, quoteEverydayRoute, resolveContactTarget, resolveEverydayDeliveryMode, type EverydayExternalSnapshot } from './everyday-runtime';

  interface Props {
    projection: EverydayWalletProjection; frame: RuntimeAdapterViewFrame | null;
    externalRows: readonly EverydayExternalRow[]; nativeBalance: bigint; decimals: number; symbol: string;
    liveEnv: RuntimeReplica | null; xln: XLNModule | null; isLive: boolean; commandReady: boolean; onRefresh: () => Promise<EverydayExternalSnapshot>;
  }
  let { projection, frame, externalRows, nativeBalance, decimals, symbol, liveEnv, xln, isLive, commandReady, onRefresh }: Props = $props();

  let panel = $state<'none' | 'pay' | 'request' | 'cashout'>('none');
  let payTo = $state(''); let payAmount = $state(''); let payNote = $state('');
  let quotedRoute = $state<EverydaySendRoute | null>(null); let quoteError = $state(''); let quoting = $state(false);
  let reqAmount = $state(''); let reqNote = $state(''); let qrUrl = $state(''); let copied = $state(false);
  let outAddress = $state(''); let outAmount = $state('');
  let busy = $state(false); let statusMsg = $state(''); let errorMsg = $state('');
  let showTruth = $state(false);
  let deltaNotice = $state<{ positive: boolean; text: string } | null>(null);
  let sheenTick = $state(0);
  let lastCashKey = ''; let lastCashValue = 0n;

  const terms = EVERYDAY_COPY.terms;
  const flows = EVERYDAY_COPY.flows;
  const knownContacts = $derived((frame?.entities ?? []).filter(e => e.entityId.toLowerCase() !== projection.entityId));
  const resolvedPayTo = $derived(resolveContactTarget(payTo, knownContacts));
  const requestLink = $derived(projection.entityId ? buildWalletPayHref({ targetEntityId: projection.entityId, tokenId: projection.primaryTokenId, amount: reqAmount.trim(), description: reqNote.trim() }) : '');
  const cashParts = $derived(splitMoneyDisplay(formatUsd(projection.primary.cash, decimals)));
  const activeHubId = $derived(projection.primaryHubId ?? projection.hubAccounts[0] ?? null);
  const activeHubLabel = $derived.by(() => {
    if (!activeHubId) return null;
    const match = (frame?.entities ?? []).find(e => e.entityId.toLowerCase() === activeHubId);
    return match?.label?.trim() || `${activeHubId.slice(0, 10)}…`;
  });
  const balanceTruthLine = $derived(
    activeHubLabel
      ? projection.disputes.some(d => d.counterpartyId === activeHubId)
        ? `Connected via ${activeHubLabel}. Protection is active on this hub.`
        : `Connected via ${activeHubLabel}.`
      : 'No hub connected yet.',
  );

  $effect(() => {
    const key = projection.entityId;
    const cash = projection.primary.cash;
    if (key !== lastCashKey) {
      lastCashKey = key;
      lastCashValue = cash;
      deltaNotice = null;
      return;
    }
    const diff = cash - lastCashValue;
    if (diff === 0n) return;
    lastCashValue = cash;
    if (diff > 0n) sheenTick += 1;
    deltaNotice = {
      positive: diff > 0n,
      text: diff > 0n ? `+${formatUsd(diff, decimals)} settled` : `−${formatUsd(-diff, decimals)} sent`,
    };
  });

  const arrivingNote = $derived.by(() => {
    const hubId = projection.primaryHubId;
    const hubDoc = hubId ? frame?.activeEntity?.accounts.items.find(a => a.state.leftEntity.toLowerCase() === hubId || a.state.rightEntity.toLowerCase() === hubId) : undefined;
    const policy = getOpenAccountRebalancePolicyData(asTokenId(projection.primaryTokenId), 'everyday');
    if (!hubDoc || !policy || !xln) return terms.arriving.note;
    const status = inspectHubRebalanceStatus({ doc: hubDoc, isLeft: hubDoc.state.leftEntity.toLowerCase() === projection.entityId, tokenId: projection.primaryTokenId, policy, deriveDeltaFn: xln.deriveDelta });
    return formatEverydayArrivingNote(status, terms.arriving.note, amount => formatUsd(amount, decimals));
  });

  const payPlan = $derived.by(() => {
    if (panel !== 'pay' || !xln || !frame || !quotedRoute || !resolvedPayTo.target) return null;
    return planEverydaySend({
      frame, entityId: projection.entityId, signerId: projection.signerId ?? '', targetEntityId: resolvedPayTo.target,
      tokenId: projection.primaryTokenId, deliveryMode: resolveEverydayDeliveryMode(quotedRoute), description: payNote.trim(),
      route: quotedRoute, externalRows, nativeBalance, deriveDeltaFn: xln.deriveDelta,
    });
  });
  const canPay = $derived(Boolean(commandReady && isLive && !busy && !quoting && quotedRoute && payPlan && (payPlan.kind === 'ready' || payPlan.kind === 'fund-and-pay')));
  const payWarning = $derived(resolvedPayTo.ambiguous ? 'More than one contact has this name.' : quoteError || (payPlan && payPlan.kind !== 'ready' && payPlan.kind !== 'fund-and-pay' ? explainEverydaySendBlock(payPlan) : ''));

  const cashOutPlan = $derived.by(() => {
    if (panel !== 'cashout' || !xln || !frame || !outAddress.trim() || !outAmount.trim()) return null;
    let amt = 0n;
    try { amt = parseUsdAmount(outAmount, decimals); } catch { return null; }
    if (amt <= 0n) return null;
    return planEverydayCashOut({ frame, entityId: projection.entityId, recipientEoa: outAddress.trim(), tokenId: projection.primaryTokenId, amount: amt, hubAccountId: projection.primaryHubId, nativeBalance, deriveDeltaFn: xln.deriveDelta });
  });
  const canCashOut = $derived(Boolean(commandReady && isLive && !busy && cashOutPlan && (cashOutPlan.kind === 'from-reserve' || cashOutPlan.kind === 'from-hub-collateral')));
  const cashOutWarning = $derived(cashOutPlan && cashOutPlan.kind !== 'from-reserve' && cashOutPlan.kind !== 'from-hub-collateral' ? explainEverydayCashOutBlock(cashOutPlan, amt => formatUsd(amt, decimals)) : '');

  function openPanel(next: 'pay' | 'request' | 'cashout'): void {
    panel = panel === next ? 'none' : next;
    statusMsg = ''; errorMsg = '';
    if (panel === 'pay' || panel === 'cashout') void onRefresh();
    if (panel === 'cashout' && !outAddress && projection.signerId) outAddress = projection.signerId;
  }

  const hasCash = $derived(projection.primary.cash > 0n);
  const payAmountRaw = $derived.by(() => {
    try { const v = payAmount.trim() ? parseUsdAmount(payAmount, decimals) : 0n; return v > 0n ? v : 0n; } catch { return 0n; }
  });
  const directRoute = $derived(panel === 'pay' && xln && resolvedPayTo.target && payAmountRaw > 0n
    ? findDirectBilateralRoute({ frame, entityId: projection.entityId, targetEntityId: resolvedPayTo.target, tokenId: projection.primaryTokenId, amount: payAmountRaw, deriveDeltaFn: xln.deriveDelta })
    : null);

  $effect(() => {
    quotedRoute = null; quoteError = '';
    const target = resolvedPayTo.target;
    if (panel !== 'pay' || !target || target === projection.entityId || payAmountRaw <= 0n) { quoting = false; return; }
    if (directRoute) { quotedRoute = directRoute; quoting = false; return; }
    let cancelled = false; quoting = true;
    void quoteEverydayRoute({ entityId: projection.entityId, targetEntityId: target, tokenId: projection.primaryTokenId, amount: payAmountRaw, primaryHubId: projection.primaryHubId, cash: hasCash ? 1n : 0n, liveEnv, xln })
      .then(route => { if (!cancelled) { quotedRoute = route; quoteError = ''; } })
      .catch(err => { if (!cancelled) { quotedRoute = null; quoteError = err instanceof Error ? err.message : String(err); } })
      .finally(() => { if (!cancelled) quoting = false; });
    return () => { cancelled = true; };
  });

  $effect(() => {
    if (panel !== 'request' || !requestLink) { qrUrl = ''; return; }
    let cancelled = false;
    void QRCode.toDataURL(requestLink, { width: 220, margin: 1, color: { dark: '#f5f5f7', light: '#1c1c20' } })
      .then(url => { if (!cancelled) qrUrl = url; }).catch(() => { if (!cancelled) qrUrl = ''; });
    return () => { cancelled = true; };
  });

  async function submitPay(event: Event): Promise<void> {
    event.preventDefault();
    if (busy || !isLive || !commandReady || !projection.signerId || !xln || !resolvedPayTo.target) return;
    busy = true; errorMsg = ''; statusMsg = flows.pay.pending;
    try {
      const target = resolvedPayTo.target;
      const amount = parseUsdAmount(payAmount, decimals);
      const route = quotedRoute ?? findDirectBilateralRoute({ frame, entityId: projection.entityId, targetEntityId: target, tokenId: projection.primaryTokenId, amount, deriveDeltaFn: xln.deriveDelta }) ?? await quoteEverydayRoute({ entityId: projection.entityId, targetEntityId: target, tokenId: projection.primaryTokenId, amount, primaryHubId: projection.primaryHubId, cash: projection.primary.cash, liveEnv, xln });
      const deliveryMode = resolveEverydayDeliveryMode(route);
      let curExt = externalRows; let curNative = nativeBalance;
      let initialPlan = planEverydaySend({ frame, entityId: projection.entityId, signerId: projection.signerId, targetEntityId: target, tokenId: projection.primaryTokenId, deliveryMode, description: payNote.trim(), route, externalRows: curExt, nativeBalance: curNative, deriveDeltaFn: xln.deriveDelta });
      if (initialPlan.kind === 'needs-gas') {
        const fresh = await onRefresh();
        curExt = fresh.externalRows; curNative = fresh.nativeBalance;
        initialPlan = planEverydaySend({ frame, entityId: projection.entityId, signerId: projection.signerId, targetEntityId: target, tokenId: projection.primaryTokenId, deliveryMode, description: payNote.trim(), route, externalRows: curExt, nativeBalance: curNative, deriveDeltaFn: xln.deriveDelta });
      }
      await executeEverydaySendPlan({
        plan: initialPlan, entityId: projection.entityId, signerId: projection.signerId, tokenId: projection.primaryTokenId, liveEnv, xln,
        onStage: msg => { statusMsg = msg; },
        refreshPlan: async () => planEverydaySend({ frame: await runtimeQueryClient.readViewFrame({ entityId: projection.entityId }), entityId: projection.entityId, signerId: projection.signerId ?? '', targetEntityId: target, tokenId: projection.primaryTokenId, deliveryMode, description: payNote.trim(), route, externalRows: curExt, nativeBalance: curNative, deriveDeltaFn: xln.deriveDelta }),
      });
      statusMsg = flows.pay.done; payAmount = ''; payNote = ''; void onRefresh();
    } catch (err) { errorMsg = err instanceof Error ? err.message : flows.pay.failed; statusMsg = ''; }
    finally { busy = false; }
  }

  async function submitCashOut(event: Event): Promise<void> {
    event.preventDefault();
    if (busy || !isLive || !commandReady || !projection.signerId || !xln) return;
    busy = true; errorMsg = ''; statusMsg = flows.cashOut.pending;
    try {
      const amount = parseUsdAmount(outAmount, decimals);
      let plan = planEverydayCashOut({ frame, entityId: projection.entityId, recipientEoa: outAddress.trim(), tokenId: projection.primaryTokenId, amount, hubAccountId: projection.primaryHubId, nativeBalance, deriveDeltaFn: xln.deriveDelta });
      if (plan.kind === 'needs-gas') {
        const fresh = await onRefresh();
        plan = planEverydayCashOut({ frame, entityId: projection.entityId, recipientEoa: outAddress.trim(), tokenId: projection.primaryTokenId, amount, hubAccountId: projection.primaryHubId, nativeBalance: fresh.nativeBalance, deriveDeltaFn: xln.deriveDelta });
      }
      if (plan.kind !== 'from-reserve' && plan.kind !== 'from-hub-collateral') throw new Error(explainEverydayCashOutBlock(plan, amt => formatUsd(amt, decimals)));
      await submitEntityInputs([{ entityId: projection.entityId, signerId: projection.signerId, entityTxs: plan.entityTxs }]);
      statusMsg = flows.cashOut.done; outAmount = ''; void onRefresh();
    } catch (err) { errorMsg = err instanceof Error ? err.message : flows.cashOut.failed; statusMsg = ''; }
    finally { busy = false; }
  }

  async function copyRequestLink(): Promise<void> {
    if (!requestLink) return;
    try { await navigator.clipboard.writeText(requestLink); copied = true; window.setTimeout(() => copied = false, 1500); }
    catch { errorMsg = 'Could not copy link right now.'; }
  }
</script>

{#key sheenTick}
  <section class="ev-hero-region" class:is-sheen={sheenTick > 0} aria-label="Cash balance">
    <p class="ev-label">{terms.cash.label}</p>
    <button type="button" class="ev-balance-trigger" aria-expanded={showTruth} onclick={() => showTruth = !showTruth}>
      <h1 class="ev-hero" class:is-syncing={!commandReady} data-testid="everyday-cash">
        <span>{cashParts.major}</span>{#if cashParts.minor}<span class="ev-cents">{cashParts.minor}</span>{/if}{#if cashParts.suffix}<span class="ev-suffix">{cashParts.suffix}</span>{/if}
      </h1>
    </button>
    {#if !commandReady}
      <p class="ev-muted" role="status">Syncing latest balance. Sending resumes in a moment.</p>
    {:else if deltaNotice}
      <p class="ev-delta" class:is-out={!deltaNotice.positive} data-testid="everyday-cash-delta" role="status">{deltaNotice.text}</p>
    {:else}
      <p class="ev-muted">{terms.cash.note}</p>
    {/if}
    {#if showTruth}
      <p class="ev-truth" data-testid="everyday-balance-truth">{balanceTruthLine}</p>
    {/if}
    {#if projection.primary.arriving > 0n}
      <div class="ev-pill" data-testid="everyday-arriving">+{formatUsd(projection.primary.arriving, decimals)} {terms.arriving.label.toLowerCase()}</div>
      <p class="ev-muted">{arrivingNote}</p>
    {/if}
    <div class="ev-actions">
      <button type="button" class="ev-btn" class:primary={panel === 'none' || panel === 'pay'} data-testid="everyday-pay-btn" onclick={() => openPanel('pay')}>{flows.pay.before}</button>
      <button type="button" class="ev-btn" class:primary={panel === 'request'} data-testid="everyday-request-btn" onclick={() => openPanel('request')}>{flows.requestLink.before}</button>
      <button type="button" class="ev-btn" class:primary={panel === 'cashout'} data-testid="everyday-cashout-btn" onclick={() => openPanel('cashout')}>{flows.cashOut.before}</button>
    </div>
  </section>
{/key}

{#if panel === 'pay'}
  <form class="ev-card" onsubmit={e => void submitPay(e)}>
    <label class="ev-field"><span>To</span>
      <input class="ev-input" list="ev-contacts" placeholder="0x... recipient" data-testid="everyday-pay-to" bind:value={payTo} disabled={busy} />
      <datalist id="ev-contacts">{#each knownContacts as contact}<option value={contact.entityId}>{contact.label || contact.entityId}</option>{/each}</datalist>
    </label>
    <label class="ev-field"><span>Amount ({symbol})</span><input class="ev-input" inputmode="decimal" placeholder="0.00" data-testid="everyday-pay-amount" bind:value={payAmount} disabled={busy} /></label>
    <label class="ev-field"><span>Note (optional)</span><input class="ev-input" placeholder="Dinner, groceries..." data-testid="everyday-pay-note" bind:value={payNote} disabled={busy} /></label>
    <p class="ev-muted ev-num" data-testid="everyday-pay-fee">{quoting ? 'Checking fee...' : quotedRoute ? (quotedRoute.totalFee === 0n ? 'Fee: Free' : `Fee: ${formatUsd(quotedRoute.totalFee, decimals)}`) : 'Enter recipient and amount to preview fee'}</p>
    {#if payWarning}<p class="ev-alert error">{payWarning}</p>{/if}
    <button type="submit" class="ev-btn primary" data-testid="everyday-pay-submit" disabled={!canPay}>{busy ? statusMsg || flows.pay.pending : flows.pay.before}</button>
  </form>
{:else if panel === 'request'}
  <section class="ev-card">
    <label class="ev-field"><span>Amount ({symbol})</span><input class="ev-input" inputmode="decimal" placeholder="25.00" data-testid="everyday-request-amount" bind:value={reqAmount} /></label>
    <label class="ev-field"><span>Note (optional)</span><input class="ev-input" placeholder="For coffee" data-testid="everyday-request-note" bind:value={reqNote} /></label>
    {#if qrUrl}<img src={qrUrl} alt="Payment request QR" width="180" height="180" style="border-radius:12px;align-self:center;" />{/if}
    <input class="ev-input" readonly value={requestLink} data-testid="everyday-request-link" />
    <button type="button" class="ev-btn" data-testid="everyday-request-copy" onclick={() => void copyRequestLink()}>{copied ? 'Copied link' : 'Copy request link'}</button>
  </section>
{:else if panel === 'cashout'}
  <form class="ev-card" onsubmit={e => void submitCashOut(e)}>
    <label class="ev-field"><span>External address</span><input class="ev-input" placeholder="0x..." data-testid="everyday-cashout-address" bind:value={outAddress} disabled={busy} /></label>
    <label class="ev-field"><span>Amount ({symbol})</span><input class="ev-input" inputmode="decimal" placeholder="0.00" data-testid="everyday-cashout-amount" bind:value={outAmount} disabled={busy} /></label>
    {#if cashOutWarning}<p class="ev-alert error">{cashOutWarning}</p>{/if}
    <button type="submit" class="ev-btn primary" data-testid="everyday-cashout-submit" disabled={!canCashOut}>{busy ? flows.cashOut.pending : flows.cashOut.before}</button>
  </form>
{/if}

{#if errorMsg}<p class="ev-alert error" role="alert">{errorMsg}</p>{/if}
{#if statusMsg && !errorMsg}<p class="ev-alert ok" role="status">{statusMsg}</p>{/if}
