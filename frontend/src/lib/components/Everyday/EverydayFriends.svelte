<script lang="ts">
  import { defaultAccountDisputeConfigForParties } from '@xln/core/account/config/dispute-config';
  import type { RuntimeAdapterViewFrame, RuntimeReplica, XLNModule } from '@xln/core/api/public/runtime-module';
  import { submitEntityInputs } from '#lib/stores/xlnStore.ts';
  import { runtimeQueryClient } from '#lib/stores/runtimeQueryClient.ts';
  import { SURFACES } from '../../../../../docs/studies/ui/surfaces/surfaces.generated';
  import type { EverydayWalletProjection, FriendTabRow } from '#lib/everyday/everyday-projection.ts';
  import { planEverydaySend, planFriendSplitTxs, type EverydayExternalRow } from '#lib/everyday/everyday-autopilot.ts';
  import { executeEverydaySendPlan } from './everyday-funding';
  import { formatSignedUsd, formatUsd, parseUsdAmount, quoteSettleTabRoute, resolveContactTarget } from './everyday-runtime';

  interface Props {
    projection: EverydayWalletProjection; frame: RuntimeAdapterViewFrame | null;
    externalRows: readonly EverydayExternalRow[]; nativeBalance: bigint; decimals: number;
    liveEnv: RuntimeReplica | null; xln: XLNModule | null; isLive: boolean; commandReady: boolean; onRefresh: () => void;
  }
  let { projection, frame, externalRows, nativeBalance, decimals, liveEnv, xln, isLive, commandReady, onRefresh }: Props = $props();

  let splitTarget = $state(''); let splitAmount = $state('');
  let busy = $state(false); let statusMsg = $state(''); let errorMsg = $state('');

  const terms = SURFACES.everyday.terms;
  const flows = SURFACES.everyday.flows;
  const peers = $derived((frame?.entities ?? []).filter(e => !e.isHub && e.entityId.toLowerCase() !== projection.entityId));
  const resolvedSplit = $derived(resolveContactTarget(splitTarget, peers));
  const parsedSplitAmount = $derived.by(() => {
    if (!splitAmount.trim()) return 0n;
    try { const val = parseUsdAmount(splitAmount, decimals); return val > 0n ? val : 0n; }
    catch { return 0n; }
  });

  async function submitSplit(event: Event): Promise<void> {
    event.preventDefault();
    if (busy || !isLive || !commandReady || !projection.signerId || !xln || !resolvedSplit.target || parsedSplitAmount <= 0n) return;
    busy = true; errorMsg = ''; statusMsg = flows['split-tab'].pending.text;
    try {
      const target = resolvedSplit.target;
      const isHubTarget = projection.hubAccounts.includes(target) || Boolean(frame?.entities.find(e => e.entityId.toLowerCase() === target)?.isHub);
      if (isHubTarget) throw new Error('Pick a person rather than a payment hub for a shared tab.');
      const doc = frame?.activeEntity?.accounts.items.find(a =>
        (a.state.leftEntity.toLowerCase() === projection.entityId && a.state.rightEntity.toLowerCase() === target) ||
        (a.state.rightEntity.toLowerCase() === projection.entityId && a.state.leftEntity.toLowerCase() === target));
      const hasPeerSummary = Boolean(frame?.entities.some(e => e.entityId.toLowerCase() === target));
      const txs = planFriendSplitTxs({
        entityId: projection.entityId, counterpartyEntityId: target, tokenId: projection.primaryTokenId, splitAmount: parsedSplitAmount,
        existingAccount: doc ? { leftEntity: doc.state.leftEntity, rightEntity: doc.state.rightEntity, deltas: doc.state.deltas } : null,
        deriveDeltaFn: xln.deriveDelta, summaries: frame?.entities,
        ...(!hasPeerSummary ? { disputeConfig: defaultAccountDisputeConfigForParties(projection.entityId, false, target, false) } : {}),
      });
      await submitEntityInputs([{ entityId: projection.entityId, signerId: projection.signerId, entityTxs: txs }]);
      statusMsg = flows['split-tab'].done.text; splitAmount = ''; onRefresh();
    } catch (err) { errorMsg = err instanceof Error ? err.message : flows['split-tab'].failed.text; statusMsg = ''; }
    finally { busy = false; }
  }

  async function settleTab(row: FriendTabRow): Promise<void> {
    if (busy || !isLive || !commandReady || !projection.signerId || !xln || row.signedAmount >= 0n || row.disputed) return;
    busy = true; errorMsg = ''; statusMsg = flows['settle-tab'].pending.text;
    try {
      const amount = -row.signedAmount;
      const { route, deliveryMode, targetEntityId } = await quoteSettleTabRoute({
        frame, entityId: projection.entityId, targetEntityId: row.counterpartyId, tokenId: row.tokenId, amount,
        primaryHubId: projection.primaryHubId, deriveDeltaFn: xln.deriveDelta, liveEnv, xln,
      });
      const buildPlan = (cur: RuntimeAdapterViewFrame | null) => planEverydaySend({ frame: cur, entityId: projection.entityId, signerId: projection.signerId ?? '', targetEntityId, tokenId: row.tokenId, deliveryMode, description: 'Settled tab', route, externalRows, nativeBalance, deriveDeltaFn: xln.deriveDelta });
      await executeEverydaySendPlan({
        plan: buildPlan(frame), entityId: projection.entityId, signerId: projection.signerId, tokenId: row.tokenId, liveEnv, xln,
        onStage: msg => { statusMsg = msg; },
        refreshPlan: async () => buildPlan(await runtimeQueryClient.readViewFrame({ entityId: projection.entityId })),
      });
      statusMsg = flows['settle-tab'].done.text; onRefresh();
    } catch (err) { errorMsg = err instanceof Error ? err.message : flows['settle-tab'].failed.text; statusMsg = ''; }
    finally { busy = false; }
  }
</script>

<section class="ev-card">
  <h2 style="margin:0;font-size:1.25rem;">{terms.people.text}</h2>
  <p class="ev-muted">{terms.people.note}</p>
  <div class="ev-row ev-num" style="justify-content:space-between;">
    <span>Friends owe you: <strong>{formatUsd(projection.primary.friendsOweYou, decimals)}</strong></span>
    <span>{terms.owed.text}: <strong>{formatUsd(projection.primary.youOweFriends, decimals)}</strong></span>
  </div>
</section>

<form class="ev-card" onsubmit={e => void submitSplit(e)}>
  <label class="ev-field"><span>Friend</span>
    <input class="ev-input" list="ev-friends" placeholder="0x... friend address" data-testid="everyday-split-target" bind:value={splitTarget} disabled={busy} />
    <datalist id="ev-friends">{#each peers as peer}<option value={peer.entityId}>{peer.label || peer.entityId}</option>{/each}</datalist>
  </label>
  <label class="ev-field"><span>Split amount</span><input class="ev-input" inputmode="decimal" placeholder="15.00" data-testid="everyday-split-amount" bind:value={splitAmount} disabled={busy} /></label>
  {#if resolvedSplit.ambiguous}<p class="ev-alert error">More than one contact has this name.</p>{/if}
  <button type="submit" class="ev-btn primary" data-testid="everyday-split-btn" disabled={busy || !isLive || !commandReady || !resolvedSplit.target || parsedSplitAmount <= 0n}>{busy ? flows['split-tab'].pending.text : flows['split-tab'].before.text}</button>
</form>

<section class="ev-card" data-testid="everyday-friends-list">
  {#if projection.primary.friendTabs.length === 0}
    <p class="ev-muted">No shared tabs yet. Split a bill above to start one with someone you know.</p>
  {:else}
    {#each projection.primary.friendTabs as row (`${row.counterpartyId}:${row.tokenId}`)}
      <div class="ev-row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
        <div>
          <strong>{row.label}</strong>
          <p class="ev-muted ev-num">
            {row.disputed
              ? 'In recovery — tab paused'
              : row.signedAmount > 0n
                ? `Owes you ${formatUsd(row.signedAmount, decimals)}`
                : row.signedAmount < 0n
                  ? `You owe ${formatUsd(-row.signedAmount, decimals)}`
                  : row.peerCreditLimit > 0n
                    ? `Tab open · up to ${formatUsd(row.peerCreditLimit, decimals)}`
                    : 'All settled up'}
          </p>
        </div>
        {#if row.signedAmount < 0n}
          <button type="button" class="ev-btn primary" data-testid="everyday-settle-btn" disabled={busy || !isLive || !commandReady || row.disputed} onclick={() => void settleTab(row)}>
            {flows['settle-tab'].before.text} ({formatSignedUsd(row.signedAmount, decimals)})
          </button>
        {/if}
      </div>
    {/each}
  {/if}
</section>

{#if errorMsg}<p class="ev-alert error" role="alert">{errorMsg}</p>{/if}
{#if statusMsg && !errorMsg}<p class="ev-alert ok" role="status">{statusMsg}</p>{/if}
