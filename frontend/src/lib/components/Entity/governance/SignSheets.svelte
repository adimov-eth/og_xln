<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Check, ChevronDown, ChevronUp, Clock3, KeyRound, MessageSquare, X } from 'lucide-svelte';
  import type { EntityTx } from '@xln/core/types/entity-tx';
  import { createHoldPress, type HoldPress, type HoldPressPhase } from '../core/hold-press';
  import { batchCommitted, captureSignBaseline, type SignSheetBaseline, type SignSheetSource, type SignSheetView } from '../core/sign-sheet';
  import {
    isStewardLink,
    readStewardAnswer,
    readStewardPin,
    recordStewardAnswer,
    stewardRefusalText,
    verifyStewardLink,
  } from '../../../governance/steward-request';
  import { stewardSheet } from '../../../governance/steward-sheet';

  /**
   * A steward's signed request, opened from a `#steward/…` link. Verified against the steward the
   * person pinned in Settings; Sign sends the batch as the person's own transaction.
   */
  let {
    entityId,
    source,
    commandsReady,
    submit,
  }: {
    entityId: string;
    source: SignSheetSource;
    commandsReady: boolean;
    submit: (entityTxs: EntityTx[]) => Promise<unknown>;
  } = $props();

  type Phase =
    | { kind: 'open' }
    | { kind: 'sent'; baseline: SignSheetBaseline; txs: readonly EntityTx[]; text: string }
    | { kind: 'done'; text: string }
    | { kind: 'declined' };

  const storage = (): Storage | null => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  };

  let link = $state<string | null>(null);
  let flow = $state<Phase>({ kind: 'open' });
  let sending = $state<'yes' | 'no' | null>(null);
  let failure = $state<string | null>(null);
  let phase = $state<HoldPressPhase>('idle');
  let termsOpen = $state(false);
  let reducedMotion = $state(false);

  const captureLink = () => {
    const hash = window.location.hash;
    if (!isStewardLink(hash)) return;
    link = hash.replace(/^#/, '');
    flow = { kind: 'open' };
    history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}`);
  };
  onMount(() => {
    captureLink();
    window.addEventListener('hashchange', captureLink);
    return () => window.removeEventListener('hashchange', captureLink);
  });

  const pin = $derived(link ? readStewardPin(storage(), entityId) : null);
  const verified = $derived(link ? verifyStewardLink(link, { entityId, pin, now: Date.now() }) : null);
  const built = $derived(verified?.ok && pin ? stewardSheet(verified.request, pin, source, Date.now()) : null);
  const sheet = $derived(built?.sheet ?? null);
  const answered = $derived(sheet ? readStewardAnswer(storage(), entityId, sheet.id) : null);

  $effect(() => {
    if (flow.kind === 'sent' && batchCommitted(flow.txs, flow.baseline, source)) {
      flow = { kind: 'done', text: flow.text };
    }
  });

  $effect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = query.matches;
    const update = () => { reducedMotion = query.matches; };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  });

  const committedText = (view: SignSheetView): string => {
    const [first] = view.facts;
    if (view.facts.length === 1 && first?.verb === 'Pay' && first.amount && first.party) {
      return `Signed and committed: paid ${first.amount} to ${first.party.fingerprint}. It clears when their wallet confirms.`;
    }
    if (view.facts.length === 1 && first?.amount && first.party) {
      return `Signed and committed: ${first.party.fingerprint} can now owe you up to ${first.amount}.`;
    }
    return `Signed and committed: all ${view.facts.length} changes are in your Entity's state.`;
  };

  async function answer(choice: 'yes' | 'no') {
    if (sending || !built) return;
    const { sheet: view, txs } = built;
    failure = null;
    sending = choice;
    try {
      const store = storage();
      if (choice === 'no') {
        if (store) recordStewardAnswer(store, entityId, { nonce: view.id, choice: 'declined', at: Date.now() });
        flow = { kind: 'declined' };
        return;
      }
      const baseline = captureSignBaseline(txs, source);
      await submit([...txs]);
      if (store) recordStewardAnswer(store, entityId, { nonce: view.id, choice: 'signed', at: Date.now() });
      flow = { kind: 'sent', baseline, txs, text: committedText(view) };
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    } finally {
      sending = null;
      phase = 'idle';
    }
  }

  let press: HoldPress | null = null;
  let pressFor: string | null = null;
  $effect(() => {
    const current = sheet?.id ?? null;
    if (pressFor === current) return;
    press?.dispose();
    phase = 'idle';
    pressFor = current;
    press = current ? createHoldPress({ onChange: next => { phase = next; }, onConfirm: () => { void answer('yes'); } }) : null;
  });
  onDestroy(() => press?.dispose());

  function primaryKeydown(event: KeyboardEvent) {
    if (!sheet?.hold.required || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    press?.activate(event.repeat);
  }

  function primaryClick(event: MouseEvent) {
    if (!sheet) return;
    if (!sheet.hold.required) {
      void answer('yes');
      return;
    }
    // A click with no pointer press behind it is keyboard or assistive technology.
    if (event.detail === 0) press?.activate(false);
  }

  const primaryText = (view: SignSheetView): string => {
    if (sending === 'yes') return 'Signing…';
    if (!view.hold.required) return view.primaryLabel;
    if (phase === 'armed') return view.armedLabel;
    if (phase === 'holding' && reducedMotion) return 'Keep holding…';
    return view.primaryLabel;
  };

  const close = () => {
    link = null;
    flow = { kind: 'open' };
  };
</script>

{#if link && verified && !verified.ok}
  <section class="sign-outcome" data-testid="sign-sheet-refused" data-reason={verified.reason} role="alert">
    <X size={16} />
    <span>{stewardRefusalText[verified.reason]}</span>
    <button type="button" class="btn ghost" onclick={close}>Close</button>
  </section>
{:else if link && flow.kind === 'sent'}
  <section class="sign-outcome" data-testid="sign-sheet-outcome" data-state="sent" role="status">
    <Clock3 size={16} />
    <span>Sent to your Entity. Waiting for the change to commit…</span>
  </section>
{:else if link && (flow.kind === 'done' || flow.kind === 'declined')}
  <section class="sign-outcome" data-testid="sign-sheet-outcome" data-state={flow.kind === 'done' ? 'signed' : 'declined'} role="status">
    {#if flow.kind === 'done'}<Check size={16} />{:else}<X size={16} />{/if}
    <span>{flow.kind === 'done' ? flow.text : 'Declined. Nothing was signed. Your steward is not told; tell it if it should know.'}</span>
    <button type="button" class="btn ghost" onclick={close}>Done</button>
  </section>
{:else if link && answered}
  <section class="sign-outcome" data-testid="sign-sheet-answered" role="status">
    <Check size={16} />
    <span>You already {answered.choice === 'signed' ? 'signed' : 'declined'} this request on this device on {new Date(answered.at).toLocaleString()}.</span>
    <button type="button" class="btn ghost" onclick={close}>Close</button>
  </section>
{:else if link && sheet}
  <section class="sign-sheet" data-testid="sign-sheet" data-request-id={sheet.id} aria-label="A request for your signature">
    <header class="from">
      <span class="who">{sheet.requester}</span>
      <span>asks you to sign</span>
    </header>
    <p class="origin">{sheet.origin}</p>

    {#each sheet.facts as fact, index (index)}
      <div class="fact" data-testid="sign-sheet-fact">
        <span class="verb">{fact.verb}</span>
        {#if fact.amount}<span class="amount">{fact.amount}</span>{/if}
        {#if fact.party}
          <div class="party">
            <span class="key">{#if fact.preposition}<span class="to-word">{fact.preposition}</span> {/if}{fact.party.fingerprint}</span>
            <span class="rel">{fact.party.hasAccount ? 'An account you have' : 'Not one of your accounts'}</span>
          </div>
        {/if}
      </div>
    {/each}

    {#if sheet.rows.length > 0 || sheet.consequence}
      <div class="effect">
        {#each sheet.rows as row (row.label)}
          <span class="k">{row.label}</span><span class="was" class:risk={row.tone === 'risk'}>{row.was}</span><span class="to">→</span><span class="now" class:risk={row.tone === 'risk'}>{row.now}</span>
        {/each}
        {#if sheet.consequence}<p class="plain">{sheet.consequence}</p>{/if}
      </div>
    {/if}

    {#each sheet.notices as notice (notice)}
      <p class="line steel"><KeyRound size={16} /><span>{notice}</span></p>
    {/each}

    {#if sheet.note}
      <div class="note">
        <span class="lbl"><MessageSquare size={14} />{sheet.requester}'s note · not part of what you sign</span>
        <p data-testid="sign-sheet-note">{sheet.note}</p>
      </div>
    {/if}

    <button type="button" class="exact" aria-expanded={termsOpen || sheet.hold.reasons.includes('unmodelled')} onclick={() => { termsOpen = !termsOpen; }}>
      {#if termsOpen}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}Exact terms
    </button>
    {#if termsOpen || sheet.hold.reasons.includes('unmodelled')}
      <dl class="terms" data-testid="sign-sheet-terms">
        {#each sheet.terms as [term, value] (term)}<dt>{term}</dt><dd>{value}</dd>{/each}
      </dl>
    {/if}

    {#if failure}<p class="failure" role="alert">Could not send: {failure}</p>{/if}
    {#if !commandsReady}<p class="hint">Your wallet is not ready to sign yet.</p>{/if}
    {#if sheet.blocked}<p class="line steel" data-testid="sign-sheet-blocked"><KeyRound size={16} /><span>{sheet.blocked}</span></p>{/if}

    <div class="acts">
      {#if sending !== 'yes'}
        <button type="button" class="btn" data-testid="sign-sheet-decline" disabled={sending !== null} onclick={() => answer('no')}>Decline</button>
      {/if}
      <button
        type="button"
        class="btn primary"
        class:holding={phase === 'holding'}
        class:still={reducedMotion}
        data-testid="sign-sheet-sign"
        data-hold={sheet.hold.required ? 'required' : 'none'}
        aria-describedby={sheet.hold.hint ? 'sign-sheet-hint' : undefined}
        disabled={!commandsReady || sending !== null || sheet.blocked !== null}
        onclick={primaryClick}
        onkeydown={primaryKeydown}
        onpointerdown={() => { if (sheet?.hold.required) press?.pointerDown(); }}
        onpointerup={() => press?.pointerRelease()}
        onpointerleave={() => press?.pointerRelease()}
        onpointercancel={() => press?.pointerRelease()}
      >
        {#if sheet.hold.required}<span class="fill" aria-hidden="true"></span>{/if}
        <span class="label">{primaryText(sheet)}</span>
      </button>
    </div>
    {#if sheet.hold.hint}<p class="hint" id="sign-sheet-hint">{sheet.hold.hint}</p>{/if}
    <p class="sr-only" role="status">{phase === 'armed' ? `${sheet.armedLabel} within 5 seconds.` : ''}</p>
  </section>
{:else if link}
  <p class="hint">Reading your committed state…</p>
{/if}

<style>
  .sign-sheet, .sign-outcome { max-width: 560px; margin: 0 0 14px; border: 1px solid color-mix(in srgb, var(--theme-card-border, #27272a) 82%, transparent); border-radius: 12px; background: color-mix(in srgb, var(--theme-card-bg, #111113) 96%, transparent); padding: 16px 18px 18px; color: var(--theme-text-primary, #f4f4f5); }
  .sign-outcome { display: grid; grid-template-columns: 18px 1fr auto; gap: 10px; align-items: center; font-size: 14px; line-height: 1.45; }
  .sign-outcome :global(svg) { color: var(--theme-text-secondary, #a1a1aa); }
  .from { display: flex; align-items: baseline; gap: 6px; font-size: 13px; color: var(--theme-text-secondary, #a1a1aa); }
  .from .who { font-weight: 600; color: var(--theme-text-primary, #f4f4f5); }
  .origin { margin: 6px 0 0; font-size: 12.5px; color: var(--theme-text-muted, #71717a); }
  .fact { margin-top: 16px; display: grid; gap: 2px; }
  .verb { font-size: 15px; font-weight: 600; color: var(--theme-text-secondary, #a1a1aa); }
  .amount { font-size: 30px; font-weight: 600; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; color: var(--theme-text-primary, #f4f4f5); }
  .party { display: grid; gap: 2px; }
  .key { font: 500 14px 'SF Mono', ui-monospace, monospace; color: var(--theme-text-primary, #f4f4f5); }
  .to-word { font-family: inherit; color: var(--theme-text-secondary, #a1a1aa); }
  .rel { font-size: 12.5px; color: var(--theme-text-muted, #71717a); }
  .effect { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--theme-card-border, #27272a); display: grid; grid-template-columns: 1fr auto auto auto; column-gap: 8px; row-gap: 8px; align-items: baseline; font-size: 14px; font-variant-numeric: tabular-nums; }
  .effect .k { color: var(--theme-text-secondary, #a1a1aa); }
  .effect .was { color: var(--theme-text-muted, #71717a); text-align: right; }
  .effect .to { color: var(--theme-text-muted, #71717a); font-size: 12px; }
  .effect .now { font-weight: 600; text-align: right; }
  .effect .risk { color: var(--theme-warning, #e8b04b); }
  .plain { grid-column: 1 / -1; margin: 2px 0 0; font-size: 13.5px; line-height: 1.45; }
  .line { display: grid; grid-template-columns: 18px 1fr; gap: 10px; margin: 12px 0 0; font-size: 13.5px; line-height: 1.45; }
  .line.steel :global(svg) { color: var(--theme-text-secondary, #a1a1aa); margin-top: 2px; }
  .note { margin-top: 16px; padding-top: 12px; border-top: 1px dashed var(--theme-card-border, #3f3f46); }
  .note .lbl { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--theme-text-muted, #71717a); }
  .note p { margin: 6px 0 0; font-size: 14px; line-height: 1.45; color: var(--theme-text-secondary, #a1a1aa); white-space: pre-wrap; overflow-wrap: anywhere; }
  .exact { margin-top: 10px; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0; border: 0; background: none; font-size: 13px; font-weight: 500; color: var(--theme-accent, #c5cfde); cursor: pointer; }
  .terms { margin: 0 0 6px; padding: 12px 14px; border-radius: 8px; background: color-mix(in srgb, var(--theme-text-primary, #f4f4f5) 5%, transparent); font: 400 11.5px/1.7 'SF Mono', ui-monospace, monospace; display: grid; grid-template-columns: auto 1fr; column-gap: 14px; }
  .terms dt { color: var(--theme-text-muted, #71717a); }
  .terms dd { margin: 0; overflow-wrap: anywhere; }
  .acts { display: grid; grid-template-columns: 112px 1fr; gap: 10px; margin-top: 10px; }
  .acts:has(> :only-child) { grid-template-columns: 1fr; }
  .acts .btn { min-height: 48px; border-radius: 10px; font-size: 15px; width: 100%; }
  .btn.primary { position: relative; overflow: hidden; touch-action: none; user-select: none; }
  .btn.primary .label { position: relative; }
  .fill { position: absolute; inset: 0 auto 0 0; width: 0; background: color-mix(in srgb, currentColor 16%, transparent); box-shadow: inset -1.5px 0 0 color-mix(in srgb, currentColor 70%, transparent); pointer-events: none; }
  .btn.primary.holding .fill { width: 100%; transition: width 1s linear; }
  .btn.primary.holding.still .fill { width: 0; transition: none; }
  .btn.ghost { min-height: 36px; }
  .hint { margin: 8px 0 0; text-align: center; font-size: 12px; color: var(--theme-text-muted, #71717a); }
  .failure { margin: 10px 0 0; font-size: 13px; color: var(--theme-danger, #f87171); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
