<script lang="ts">
  import type { AssetLedgerRow, AssetLedgerTotals } from '../asset-ledger';

  export let rows: AssetLedgerRow[] = [];
  export let totals: AssetLedgerTotals = { externalUsd: 0, reserveUsd: 0, accountUsd: 0 };
  export let grandTotal = 0;
  export let loading = false;
  export let formatAmount: (amount: bigint, decimals: number) => string;
  export let formatApproxUsd: (amount: number) => string;
</script>

<div class="token-table-header asset-ledger-header">
  <span class="col-token">Asset</span>
  <span class="col-balance">External</span>
  <span class="col-balance">Reserve</span>
  <span class="col-balance">Accounts</span>
</div>
<div class="token-table asset-ledger-table" class:is-refreshing={loading}>
  {#each rows as row}
    <div
      class="token-table-row asset-ledger-row"
      class:has-balance={row.externalBalance > 0n || row.reserveBalance > 0n}
      data-testid={`asset-row-${row.symbol}`}
    >
      <div class="col-token">
        <span
          class="token-icon-small"
          class:usdc={row.symbol === 'USDC'}
          class:weth={row.symbol === 'WETH' || row.symbol === 'ETH'}
          class:usdt={row.symbol === 'USDT'}
        >
          {row.symbol.slice(0, 1)}
        </span>
        <div class="asset-name-block">
          <span class="token-name">{row.symbol}</span>
        </div>
      </div>
      <div class="col-balance asset-balance-block">
        <span
          class="balance-text"
          class:zero={row.externalBalance === 0n}
          data-testid={`external-balance-${row.symbol}`}
          data-raw-amount={row.externalBalance.toString()}
        >
          {formatAmount(row.externalBalance, row.decimals)}
        </span>
        {#if row.externalError}
          <span
            class="value-text subtle asset-read-error"
            data-testid={`external-token-error-${row.symbol}`}
            title={row.externalError}
          >
            Read error
          </span>
        {:else}
          <span class="value-text subtle">{formatApproxUsd(row.externalUsd)}</span>
        {/if}
      </div>
      <div class="col-balance asset-balance-block">
        <span
          class="balance-text"
          class:zero={row.reserveBalance === 0n}
          data-testid={`reserve-balance-${row.symbol}`}
          data-raw-amount={row.reserveBalance.toString()}
        >
          {row.tokenId && row.tokenId > 0 ? formatAmount(row.reserveBalance, row.decimals) : '—'}
        </span>
        <span class="value-text subtle">{row.tokenId && row.tokenId > 0 ? formatApproxUsd(row.reserveUsd) : '—'}</span>
      </div>
      <div class="col-balance asset-balance-block">
        <span
          class="balance-text"
          class:zero={row.accountBalance === 0n}
          data-testid={`account-spendable-${row.symbol}`}
          data-raw-amount={row.accountBalance.toString()}
        >
          {row.tokenId && row.tokenId > 0 ? formatAmount(row.accountBalance, row.decimals) : '—'}
        </span>
        <span class="value-text subtle">{row.tokenId && row.tokenId > 0 ? formatApproxUsd(row.accountUsd) : '—'}</span>
      </div>
    </div>
  {/each}
  <div class="token-table-row asset-ledger-row asset-ledger-total" data-testid="asset-ledger-total">
    <div class="col-token asset-ledger-total-label">
      <div class="asset-name-block">
        <span class="token-name">Total balance</span>
        <span class="asset-kind">Total {formatApproxUsd(grandTotal)}</span>
      </div>
    </div>
    <div class="col-balance asset-balance-block">
      <span class="balance-text">{formatApproxUsd(totals.externalUsd)}</span>
      <span class="value-text subtle">External</span>
    </div>
    <div class="col-balance asset-balance-block">
      <span class="balance-text">{formatApproxUsd(totals.reserveUsd)}</span>
      <span class="value-text subtle">Reserve</span>
    </div>
    <div class="col-balance asset-balance-block">
      <span class="balance-text">{formatApproxUsd(totals.accountUsd)}</span>
      <span class="value-text subtle">Accounts</span>
    </div>
  </div>
</div>

<style>
  .asset-read-error {
    color: #fca5a5;
  }

  .token-table-header {
    display: grid;
    grid-template-columns: 100px 1fr 90px 200px;
    gap: 8px;
    padding: 8px 12px;
    background: var(--theme-surface, #121418);
    border-radius: 6px 6px 0 0;
    border-bottom: 1px solid var(--theme-border, #262a31);
    font-size: 11px;
    font-weight: 600;
    color: var(--theme-text-muted, #57534e);
    text-transform: none;
    letter-spacing: 0.01em;
  }

  .token-table {
    display: flex;
    flex-direction: column;
    background: var(--theme-surface, #121418);
    border-radius: 0 0 6px 6px;
  }

  .token-table-row {
    display: grid;
    grid-template-columns: 100px 1fr 90px 200px;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--theme-border, #262a31);
    align-items: center;
    transition: background 0.1s;
  }

  .token-table-row:last-child {
    border-bottom: none;
    border-radius: 0 0 6px 6px;
  }

  .token-table-row:hover {
    background: var(--theme-surface-hover, #1b1e24);
  }

  .token-table-row.has-balance {
    background: linear-gradient(90deg, rgba(22, 163, 74, 0.1) 0%, transparent 100%);
  }

  .token-table-row.has-balance:hover {
    background: linear-gradient(90deg, rgba(22, 163, 74, 0.15) 0%, var(--theme-surface-hover, #1b1e24) 100%);
  }

  .col-token {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .col-balance {
    text-align: right;
  }

  .asset-ledger-header,
  .asset-ledger-row {
    grid-template-columns: minmax(90px, 140px) repeat(3, minmax(0, 1fr));
  }

  .asset-ledger-table {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .asset-ledger-total {
    background: color-mix(in srgb, var(--theme-accent, #c5cfde) 5%, transparent);
  }

  .asset-ledger-total .token-name {
    color: var(--theme-text-primary, #f5f5f4);
  }

  .asset-name-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .asset-kind {
    font-size: 10px;
    color: var(--theme-text-muted, #57534e);
    text-transform: none;
    letter-spacing: 0.01em;
  }

  .asset-balance-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
  }

  .subtle {
    color: var(--theme-text-muted, #78716c);
  }

  .token-icon-small {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-weight: 600;
    font-size: 11px;
    background: var(--theme-surface-hover, #262a31);
    color: var(--theme-text-primary, #e6ebf2);
    flex-shrink: 0;
  }

  .token-icon-small.usdc {
    background: linear-gradient(135deg, #2775ca, #1e5aa8);
  }

  .token-icon-small.weth {
    background: linear-gradient(135deg, #627eea, #4c62c7);
  }

  .token-icon-small.usdt {
    background: linear-gradient(135deg, #26a17b, #1e8a69);
  }

  .token-name {
    font-weight: 600;
    font-size: 13px;
    color: var(--theme-text-primary, #fafaf9);
  }

  .balance-text {
    font-size: 13px;
    color: var(--theme-text-primary, #e7e5e4);
  }

  .balance-text.zero {
    color: var(--theme-text-muted, #57534e);
  }

  .value-text {
    font-size: 11px;
    color: var(--theme-text-muted, #78716c);
  }

  @media (max-width: 900px) {
    .asset-ledger-header,
    .asset-ledger-row {
      min-width: 0;
    }
  }

  @media (max-width: 760px) {
    .asset-ledger-table,
    .asset-ledger-row {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    .token-table-header.asset-ledger-header {
      display: none;
    }

    .asset-ledger-table {
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow: visible;
      background: transparent;
      align-self: stretch;
    }

    .asset-ledger-row {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      padding: 12px;
      border: 1px solid color-mix(in srgb, var(--theme-border, #27272a) 72%, transparent);
      border-radius: 14px;
      background: color-mix(in srgb, var(--theme-card-bg, var(--theme-surface, #18181b)) 98%, transparent);
      overflow: hidden;
    }

    .asset-ledger-row:last-child {
      border-radius: 14px;
    }

    .asset-ledger-row .col-token {
      grid-column: 1 / -1;
      padding-bottom: 2px;
    }

    .asset-ledger-row .asset-balance-block {
      align-items: flex-start;
      text-align: left;
      min-width: 0;
      width: 100%;
      padding: 8px 10px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--theme-input-bg, #09090b) 62%, transparent);
      box-sizing: border-box;
    }

    .asset-ledger-row .asset-balance-block::before {
      display: block;
      margin-bottom: 4px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--theme-text-muted, #71717a);
    }

    .asset-ledger-row .asset-balance-block:nth-child(2)::before {
      content: 'External';
    }

    .asset-ledger-row .asset-balance-block:nth-child(3)::before {
      content: 'Reserve';
    }

    .asset-ledger-row .asset-balance-block:nth-child(4)::before {
      content: 'Accounts';
    }

    .asset-ledger-row .balance-text {
      font-size: 15px;
      line-height: 1.15;
    }

    .asset-ledger-row .value-text {
      font-size: 10px;
      line-height: 1.2;
    }
  }

  @media (max-width: 520px) {
    .asset-ledger-header,
    .asset-ledger-row {
      grid-template-columns: minmax(70px, 1fr) repeat(3, minmax(60px, 1fr));
      font-size: 11px;
    }
  }

  @media (max-width: 460px) {
    .asset-ledger-row {
      grid-template-columns: 1fr;
    }

    .asset-ledger-row .asset-balance-block {
      width: 100%;
    }
  }
</style>
