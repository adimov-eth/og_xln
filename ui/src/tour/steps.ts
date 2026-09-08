import type { WalletView } from '../runtime/views';

export type TourContext = {
  wallet: WalletView;
  pathname: string;
  baseline: Map<string, number>;
  dom: { has(id: string): boolean; value(id: string): string; text(id: string): string };
};
export type TourStep = {
  id: string;
  title: string;
  instruction(ctx: TourContext): string;
  target(ctx: TourContext): string;
  done?(ctx: TourContext): boolean;
  enter?(ctx: TourContext): void;
};
const home = (ctx: TourContext, target: string) => (ctx.pathname === '/' ? target : 'nav-home');
const weth = (ctx: TourContext) => ctx.wallet.totals.find(token => token.tokenId === 2)?.net ?? 0n;
const creditTarget = (ctx: TourContext) =>
  ctx.dom.has('receive-spectrum-confirm') ? 'receive-spectrum-confirm' : 'swap-submit';

/** Each step watches the result of a real action. No acknowledgement pages or automatic financial actions. */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'faucet',
    title: 'Get 100 test USDC',
    instruction: ctx =>
      ctx.pathname === '/'
        ? 'Press the highlighted button. Your balance updates here.'
        : 'Open Home to get your test money.',
    target: ctx => home(ctx, 'home-faucet'),
    // Starting the guide after funding must never request another payment.
    done: ctx => ctx.wallet.usd.sendCapacity > 0,
  },
  {
    id: 'pay',
    title: 'Send your first payment',
    target: ctx =>
      ctx.pathname !== '/pay'
        ? home(ctx, 'home-pay')
        : !ctx.dom.value('pay-to').trim()
          ? 'pay-to'
          : !ctx.dom.value('pay-amount').trim()
            ? 'pay-amount'
            : 'pay-submit',
    instruction: ctx =>
      ctx.pathname !== '/pay'
        ? 'Press Pay.'
        : !ctx.dom.value('pay-to').trim()
          ? 'Choose a recipient from the suggestions, for example H2.'
          : !ctx.dom.value('pay-amount').trim()
            ? 'Enter 25 USDC.'
            : 'Review the amount and fee, then confirm the payment.',
    done: ctx => ctx.dom.text('receipt-kicker') === 'Paid',
  },
  {
    id: 'trade',
    title: 'Try a swap',
    target: ctx =>
      ctx.dom.has('receipt-done')
        ? 'receipt-done'
        : ctx.pathname !== '/swap'
          ? home(ctx, 'home-swap')
          : !ctx.dom.value('swap-give').trim()
            ? 'orderbook'
            : creditTarget(ctx),
    instruction: ctx =>
      ctx.dom.has('receipt-done')
        ? 'Payment confirmed. Close the receipt to continue.'
        : ctx.pathname !== '/swap'
          ? 'Press Swap.'
          : !ctx.dom.value('swap-give').trim()
            ? 'Choose a sell price in the order book to buy WETH.'
            : ctx.dom.has('receive-spectrum-confirm')
              ? 'Review how you receive WETH. Accept test credit, then confirm its limit.'
              : 'Review both amounts and place the order. This step completes when WETH arrives.',
    enter: ctx => ctx.baseline.set('weth', Number(weth(ctx))),
    done: ctx => Number(weth(ctx)) > (ctx.baseline.get('weth') ?? Number(weth(ctx))),
  },
  {
    id: 'history',
    title: 'Find your payment and swap',
    instruction: () => 'Open Activity. Select a record to see its amount, status and hashes.',
    target: () => 'nav-activity',
    done: ctx => ctx.pathname === '/activity',
  },
  {
    id: 'finish',
    title: 'You’re ready',
    instruction: () =>
      'Your transactions are in Activity. Receive shares your payment address; Manage holds account and protection controls.',
    target: () => '',
  },
];
