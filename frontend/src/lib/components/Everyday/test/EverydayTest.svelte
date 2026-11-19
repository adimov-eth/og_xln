<script lang="ts">
  import { VALUELESS_CHAIN_IDS } from '@xln/core/jurisdiction/adapter/chain-ids';
  import type { RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
  import { requireUnknownRecord } from '#lib/utils/boundary/index.ts';
  import { resetRetiredTestnetState } from '#lib/utils/control/resetEverything.ts';
  import { EVERYDAY_COPY } from '#lib/everyday/wallet-posture.ts';
  import type { EverydayWalletProjection } from '#lib/everyday/everyday-projection.ts';
  import { requestEverydayTestCash, resolveEverydayApiBase } from '../everyday-runtime';

  interface Props {
    projection: EverydayWalletProjection;
    frame: RuntimeAdapterViewFrame | null;
    symbol: string;
    jurisdiction: string;
    runtimeId: string;
    commandReady: boolean;
    onRefresh: () => void;
    onBack: () => void;
  }
  let { projection, frame, symbol, jurisdiction, runtimeId, commandReady, onRefresh, onBack }: Props = $props();

  let busy = $state<'cash' | 'gas' | 'erc20' | 'reset' | null>(null);
  let confirmReset = $state(false);
  let statusMsg = $state('');
  let errorMsg = $state('');

  const chainId = $derived(frame?.activeEntity?.core.config.jurisdiction?.chainId);
  const isDemoChain = $derived(chainId !== undefined && VALUELESS_CHAIN_IDS.has(Number(chainId)));

  async function postFaucet(path: string, payload: Record<string, unknown>): Promise<void> {
    const res = await fetch(`${resolveEverydayApiBase()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const body = requireUnknownRecord(await res.json(), 'FAUCET_RESPONSE_INVALID');
    if (!res.ok || body['success'] === false) {
      throw new Error(String(body['error'] ?? `Test faucet failed (${res.status})`));
    }
  }

  async function runAction(kind: 'cash' | 'gas' | 'erc20' | 'reset', task: () => Promise<string>): Promise<void> {
    if (busy || !isDemoChain) return;
    busy = kind; errorMsg = ''; statusMsg = '';
    try { statusMsg = await task(); }
    catch (err) { errorMsg = err instanceof Error ? err.message : 'Test action failed.'; }
    finally { busy = null; }
  }

  const addCash = () => runAction('cash', async () => {
    await requestEverydayTestCash({ entityId: projection.entityId, runtimeId, primaryHubId: projection.primaryHubId, tokenId: projection.primaryTokenId, symbol });
    onRefresh();
    return 'Sent $100.00 test cash. Settling into Cash.';
  });

  const addGas = () => runAction('gas', async () => {
    if (!projection.signerId || !jurisdiction) throw new Error('Wallet address is not ready yet.');
    await postFaucet('/api/faucet/gas', { userAddress: projection.signerId, jurisdiction });
    onRefresh();
    return 'Added test gas to your address.';
  });

  const addTokens = () => runAction('erc20', async () => {
    if (!projection.signerId || !jurisdiction) throw new Error('Wallet address is not ready yet.');
    await postFaucet('/api/faucet/erc20', { userAddress: projection.signerId, tokenSymbol: symbol, amount: '100', jurisdiction });
    onRefresh();
    return `Added 100 test ${symbol} to your external address.`;
  });

  const resetDemo = () => runAction('reset', async () => {
    await resetRetiredTestnetState('/app');
    return EVERYDAY_COPY.flows.resetDemo.done;
  });
</script>

{#if !isDemoChain}
  <section class="ev-hero-region" aria-label="Test tools unavailable">
    <p class="ev-label">Test tools</p>
    <p class="ev-muted">Test actions are only available on test networks.</p>
    <button type="button" class="ev-btn" onclick={onBack}>Back to Cash</button>
  </section>
{:else}
  <section class="ev-hero-region" aria-label="Test tools">
    <p class="ev-label">Test tools</p>
    <p class="ev-muted">Faucets and reset actions for test networks.</p>
  </section>

  <section class="ev-card">
    <div class="ev-row" style="justify-content:space-between;">
      <div>
        <strong>Add $100 test cash</strong>
        <p class="ev-muted ev-num">$100.00 sent · about $99.89 after ~$0.11 settle fee</p>
      </div>
      <button type="button" class="ev-btn primary" data-testid="home-faucet" disabled={busy !== null || !commandReady || !projection.primaryHubId} onclick={() => void addCash()}>
        {busy === 'cash' ? 'Adding...' : 'Add $100'}
      </button>
    </div>

    <div class="ev-row" style="justify-content:space-between;">
      <div>
        <strong>Add test gas</strong>
        <p class="ev-muted">Funds native gas for on-chain actions.</p>
      </div>
      <button type="button" class="ev-btn" data-testid="everyday-test-gas" disabled={busy !== null} onclick={() => void addGas()}>
        {busy === 'gas' ? 'Adding...' : 'Add gas'}
      </button>
    </div>

    <div class="ev-row" style="justify-content:space-between;">
      <div>
        <strong>Add 100 test {symbol}</strong>
        <p class="ev-muted">Mints test tokens to your external address.</p>
      </div>
      <button type="button" class="ev-btn" data-testid="everyday-test-erc20" disabled={busy !== null} onclick={() => void addTokens()}>
        {busy === 'erc20' ? 'Adding...' : `Add ${symbol}`}
      </button>
    </div>

    <div class="ev-row" style="justify-content:space-between;">
      <div>
        <strong>{EVERYDAY_COPY.flows.resetDemo.before}</strong>
        <p class="ev-muted">Clears local test wallet data on this device.</p>
      </div>
      <button type="button" class="ev-btn" data-testid="everyday-test-reset" disabled={busy !== null} onclick={() => {
        if (!confirmReset) { confirmReset = true; return; }
        confirmReset = false;
        void resetDemo();
      }}>
        {busy === 'reset' ? EVERYDAY_COPY.flows.resetDemo.pending : confirmReset ? 'Confirm reset' : 'Reset'}
      </button>
    </div>
  </section>

  {#if errorMsg}<p class="ev-alert error" role="alert">{errorMsg}</p>{/if}
  {#if statusMsg && !errorMsg}<p class="ev-delta" role="status">{statusMsg}</p>{/if}

  <div class="ev-row">
    <button type="button" class="ev-btn" onclick={onBack}>Back to Cash</button>
  </div>
{/if}
