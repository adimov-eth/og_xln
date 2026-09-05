/**
 * The guided tour. It never acts and never navigates: a ring marks the control
 * to press next, wherever the user is, and a step releases only when the
 * runtime shows the effect of what the user did. Plain language in the body;
 * the mechanism under "Under the hood".
 */
import type { WalletView } from '../runtime/views';
import { getTokenMeta } from '../runtime/format';
import { usdOf } from '../runtime/financial/prices';
import { TOUR_FAUCET_USD, TOUR_INVOICE_USD, TOUR_MOVE_USD, TOUR_PAY_USD, demoHub, tourCollateralPolicy, tourInvoicePaid } from './actions';

export type TourContext = {
	wallet: WalletView;
	pathname: string;
	/** Numbers recorded when the step started, so "grew by" conditions are exact. */
	baseline: Map<string, number>;
	/** Small DOM probes the guidance needs: is a control present, active, filled. */
	dom: {
		has: (testId: string) => boolean;
		active: (testId: string) => boolean;
		value: (testId: string) => string;
		enabled: (testId: string) => boolean;
		text: (testId: string) => string;
	};
};

export type QuizOption = { label: string; correct?: boolean; why: string };

export type TourStep = {
	id: string;
	chapter: string;
	title: string;
	/** Plain language. No protocol words. */
	body: string;
	/** The same step for people who want the mechanism. Collapsed by default. */
	more?: string;
	/** Control to highlight from wherever the user is; the chain leads them there. */
	target?: (ctx: TourContext) => string | undefined;
	/** One line that changes with the target: "now type 25". */
	hint?: (ctx: TourContext) => string | undefined;
	/** read: Next turns the page once the user stands at the target. do: the runtime releases it. quiz: the right answer. */
	mode: 'read' | 'do' | 'quiz';
	options?: QuizOption[];
	enter?: (ctx: TourContext) => void;
	done?: (ctx: TourContext) => boolean;
	/** Progress for multi-part goals, shown as "2 / 3". */
	progress?: (ctx: TourContext) => { done: number; total: number };
	/** The counterparty reacting to what the user did, once (the shop pays the bill). */
	trigger?: (ctx: TourContext) => boolean;
	react?: (wallet: WalletView) => Promise<void>;
	skipWhen?: (ctx: TourContext) => boolean;
};

const USDC = 1;
const WETH = 2;

const hub = (ctx: TourContext) => demoHub(ctx.wallet);
const hubPath = (ctx: TourContext): string => `/accounts/${hub(ctx)?.counterpartyId ?? ''}`;
const hubUsdc = (ctx: TourContext) => hub(ctx)?.tokens.find(token => token.tokenId === USDC) ?? null;
const hubWeth = (ctx: TourContext) => hub(ctx)?.tokens.find(token => token.tokenId === WETH) ?? null;
const collateralUsd = (ctx: TourContext): number => usdOf(USDC, hubUsdc(ctx)?.derived.collateral ?? 0n);
const wethUnits = (ctx: TourContext): number => Number(hubWeth(ctx)?.signed ?? 0n) / 10 ** getTokenMeta(WETH).decimals;
/** The part of what the hub owes us that no collateral covers, in dollars: what a hub can be asked to collateralize (it never posts more, `core/entity/scheduler/rebalance.ts`). */
const hubUnsecuredUsd = (ctx: TourContext): number => {
	const token = hubUsdc(ctx);
	if (!token || token.signed <= 0n) return 0;
	const unsecured = token.derived.outPeerCredit < token.signed ? token.derived.outPeerCredit : token.signed;
	return usdOf(USDC, unsecured);
};
/** Whole dollars to ask the hub for: everything it owes us uncovered. */
const collateralAsk = (ctx: TourContext): number => Math.floor(ctx.baseline.get('collateral:ask') ?? hubUnsecuredUsd(ctx));
/** How much more USDC the hub may owe us right now: the line we granted minus what it already owes. */
const usdcCapacityIn = (ctx: TourContext): number => usdOf(USDC, hubUsdc(ctx)?.derived.inCapacity ?? 0n);
const money = (value: number): string => `$${value.toLocaleString('en-US')}`;
const at = (ctx: TourContext, path: string): boolean => (path === '/' ? ctx.pathname === '/' : ctx.pathname.startsWith(path));

/** Controls that only lead somewhere; standing on one of them is not "being there" yet. */
export const WAYPOINTS = new Set(['nav-home', 'nav-manage', 'back', 'account-row', 'home-sovereignty', 'manage-assets', 'receipt-done']);

/** The way home from anywhere: the Home tab where it shows, the back control inside a flow. */
const toHome = (ctx: TourContext): string => (ctx.dom.has('nav-home') ? 'nav-home' : 'back');
/** Reach a Home control: press it if on Home, otherwise go home first. */
const viaHome = (ctx: TourContext, control: string): string => (at(ctx, '/') ? control : toHome(ctx));
/** Reach a control on the hub account page: the first account row on Home leads there. */
const viaHub = (ctx: TourContext, control: string): string => (at(ctx, hubPath(ctx)) ? control : viaHome(ctx, 'account-row'));
const homeHint = (ctx: TourContext, then: string): string | undefined => (at(ctx, '/') ? then : 'Go back to Home first.');
/** Reach Manage → Assets from anywhere. */
const toAssets = (ctx: TourContext): string => (at(ctx, '/manage') ? 'manage-assets' : ctx.dom.has('nav-manage') ? 'nav-manage' : 'back');
const assetsHint = (ctx: TourContext): string => (at(ctx, '/manage') ? 'Open Assets.' : 'Open Manage.');

/**
 * The consent panel that appears when a receipt exceeds the line we granted:
 * the slider until the confirm button is live, then the button. While the hub
 * countersigns, the (disabled) button stays the anchor.
 */
const consentTarget = (ctx: TourContext): string | undefined => {
	if (!ctx.dom.has('receive-spectrum-confirm')) return undefined;
	const waiting = ctx.dom.text('receive-spectrum-confirm').startsWith('Waiting');
	return ctx.dom.enabled('receive-spectrum-confirm') || waiting ? 'receive-spectrum-confirm' : 'receive-spectrum-slider';
};
const consentHint = (ctx: TourContext): string | undefined => {
	const target = consentTarget(ctx);
	if (target === 'receive-spectrum-slider') return 'Slide all the way to "0% collateral": on this test network you lend the hub your trust.';
	if (target === 'receive-spectrum-confirm') return ctx.dom.text('receive-spectrum-confirm').startsWith('Waiting') ? 'The hub is countersigning your new limit…' : 'Press "Extend credit limit".';
	return undefined;
};

/** Test ETH on the signer address, read from the on-chain wallet card; remembered once seen so leaving the screen does not forget it. */
const hasGas = (ctx: TourContext): boolean => {
	if (ctx.baseline.get('gas') === 1) return true;
	const match = /([\d,]+\.\d+) ETH/.exec(ctx.dom.text('external-wallet'));
	if (match && Number.parseFloat(match[1]!.replace(/,/g, '')) > 0) {
		ctx.baseline.set('gas', 1);
		return true;
	}
	return false;
};

/** Count how many times a number changed since the step started; each swap fill moves the ETH position. */
const countChanges = (ctx: TourContext, key: string, value: number): number => {
	const last = ctx.baseline.get(`${key}:last`);
	let count = ctx.baseline.get(`${key}:count`) ?? 0;
	if (last !== undefined && Math.abs(last - value) > 1e-9) {
		count += 1;
		ctx.baseline.set(`${key}:count`, count);
	}
	ctx.baseline.set(`${key}:last`, value);
	return count;
};

export const TRADES_TO_MAKE = 3;

export const TOUR_STEPS: TourStep[] = [
	{
		id: 'welcome',
		chapter: 'Start',
		title: 'Meet your wallet',
		body: "You're Alice. On this network you meet hubs, services that pass payments along, and other members. Everything you do here is real: a live network of hubs and a real test chain. The money is test money. The tour only points; you press every button yourself.",
		more: 'Your own xln runtime runs in this tab and talks to the network\'s hubs over encrypted sockets and to the chain over RPC, exactly the way it would on mainnet. The tour drives nothing; it watches your runtime for the effect of what you did.',
		target: ctx => viaHome(ctx, 'home-total'),
		mode: 'read',
	},
	{
		id: 'bars',
		chapter: 'Start',
		title: 'One glance, the whole picture',
		body: 'Every bar is drawn to the same scale, so a dollar is the same width everywhere. Green is money that is yours no matter what anyone does. Violet is money someone owes you and has only promised to pay. Right now your hub owes you $10,000 on a promise.',
		more: 'Every account obeys one line: −L_left ≤ Δ ≤ C + L_right. Δ is who owes whom, C is collateral on-chain, L are the two credit lines. Green covers the on-chain wallet, the Depository reserve and collateral; violet is the part of Δ beyond C, the promise.',
		target: ctx => viaHome(ctx, 'home-risk'),
		mode: 'read',
	},
	{
		id: 'quiz-colors',
		chapter: 'Start',
		title: 'Quick check',
		body: 'Your hub vanishes tonight, servers off, phone dead. Which part of your money is gone?',
		mode: 'quiz',
		options: [
			{ label: 'The violet part', correct: true, why: 'Right. Violet is a promise from your hub. Everything green is yours by contract or on-chain, whatever the hub does.' },
			{ label: 'The green part', why: 'No. Green is the part the blockchain guarantees. It does not depend on the hub existing.' },
			{ label: 'All of it', why: 'No. Only the violet part depends on the hub. The green part is enforceable without it.' },
		],
	},
	{
		id: 'keys',
		chapter: 'Keys',
		title: 'Your keys, your money',
		body: 'Tap the shield in the corner of Home. It shows where your key lives. In a real wallet the key is made from a name and a passphrase on your device and is never stored anywhere. For this tour it is a throwaway test key.',
		more: 'BrainVault derives the seed with a memory-hard function from name + passphrase. The entity id is the hash of its board, which here is your single signer. Nothing is uploaded.',
		target: ctx => viaHome(ctx, 'home-sovereignty'),
		hint: ctx => homeHint(ctx, 'Tap the shield.'),
		mode: 'do',
		done: ctx => at(ctx, '/sovereignty'),
	},
	{
		id: 'ledger',
		chapter: 'Keys',
		title: 'Both of you sign every change',
		body: 'Your account with your hub is a shared ledger. Every update is signed by you and by the hub, so neither side can rewrite it alone. "Co-signed 1 of 1" means the latest page is final. "Can dispute without asking" means you already hold the hub\'s signature to take that page to the blockchain by yourself.',
		more: "Each frame carries both parties' hankos. The counterparty's dispute-proof hanko on the newest state lets you start an on-chain dispute unilaterally.",
		target: ctx => (at(ctx, '/sovereignty') ? 'sovereignty-ledger' : viaHome(ctx, 'home-sovereignty')),
		mode: 'read',
	},
	{
		id: 'credit',
		chapter: 'Credit',
		title: 'Decide how much the hub may owe you',
		body: `Nobody can push money at you without your consent. A hub can pay you without the blockchain only up to a line you set: how much of its promise you accept. Go to Manage → Assets. The amount is ${TOUR_FAUCET_USD}; slide to "0% collateral" and extend the limit.`,
		more: 'set_credit_limit raises your peer credit limit L for the hub, the inbound capacity you allow it. The hub countersigns the frame; nothing touches the chain. The slider trades that credit against collateral the hub would have to lock for you.',
		target: ctx => (at(ctx, '/assets') ? (consentTarget(ctx) ?? 'faucet-amount') : toAssets(ctx)),
		hint: ctx => (at(ctx, '/assets') ? (consentHint(ctx) ?? `Set the amount to ${TOUR_FAUCET_USD}.`) : assetsHint(ctx)),
		mode: 'do',
		done: ctx => usdcCapacityIn(ctx) >= TOUR_FAUCET_USD,
		skipWhen: ctx => usdcCapacityIn(ctx) >= TOUR_FAUCET_USD,
	},
	{
		id: 'faucet',
		chapter: 'Credit',
		title: `Get paid ${money(TOUR_FAUCET_USD)} instantly`,
		body: 'Within the line you just granted, the hub can pay you without touching the blockchain. Press "Receive USDC from your hub". It lands in about a second.',
		more: 'The hub sends a direct payment over the bilateral account: a new frame is proposed, acknowledged and committed by both runtimes. No chain transaction is involved.',
		target: ctx => (at(ctx, '/assets') ? 'faucet-offchain' : toAssets(ctx)),
		hint: ctx => (at(ctx, '/assets') ? `The amount is already ${TOUR_FAUCET_USD}. Press the first button.` : assetsHint(ctx)),
		mode: 'do',
		enter: ctx => ctx.baseline.set('receivable', ctx.wallet.usd.receivable),
		done: ctx => ctx.wallet.usd.receivable >= (ctx.baseline.get('receivable') ?? 0) + TOUR_FAUCET_USD * 0.9,
	},
	{
		id: 'faucet-read',
		chapter: 'Credit',
		title: 'More violet, more promise',
		body: `The hub now owes you ${money(TOUR_FAUCET_USD)} more. It came instantly and for free, but it is still a promise. Soon you will turn promises into something the blockchain enforces. Go back to Home to see it.`,
		target: ctx => viaHome(ctx, 'home-risk'),
		mode: 'read',
	},
	{
		id: 'pay',
		chapter: 'Pay',
		title: `Pay the shop ${money(TOUR_PAY_USD)}`,
		body: `You have no account with the recipient, so your hub passes the payment along. Either both legs happen or neither does; the hub cannot keep your money on the way. Press Pay, pick the shop, enter ${TOUR_PAY_USD}, confirm.`,
		more: 'A two-hop payment with a hash lock on each hop; one secret releases both. Route and fee come from the payment planner, and the whole thing settles in bilateral state with no block to wait for.',
		target: ctx => {
			if (!at(ctx, '/pay')) return viaHome(ctx, 'home-pay');
			if (!ctx.dom.value('pay-to').trim()) return 'pay-to';
			if (!ctx.dom.value('pay-amount').trim()) return 'pay-amount';
			return 'pay-submit';
		},
		hint: ctx => {
			if (!at(ctx, '/pay')) return homeHint(ctx, 'Press Pay.');
			if (!ctx.dom.value('pay-to').trim()) return 'Tap the "To" field and pick another hub, any but your own.';
			if (!ctx.dom.value('pay-amount').trim()) return `Type ${TOUR_PAY_USD}.`;
			return 'Confirm the payment.';
		},
		mode: 'do',
		enter: ctx => ctx.baseline.set('receivable', ctx.wallet.usd.receivable),
		done: ctx => ctx.wallet.usd.receivable <= (ctx.baseline.get('receivable') ?? 0) - TOUR_PAY_USD * 0.9,
	},
	{
		id: 'receipt',
		chapter: 'Pay',
		title: 'A receipt that holds up',
		body: 'Your receipt is not a screenshot. It is the signed page of the ledger that moved the money, with its fingerprint. Both sides signed it, and either of you could take it to the blockchain. Read it, then close it.',
		more: 'The receipt binds the committed frame height and hash read from your own runtime\'s frame journal; the recipient is bound locally from the payment intent you submitted.',
		target: ctx => (ctx.dom.has('receipt-title') ? 'receipt-title' : viaHome(ctx, 'home-frame')),
		mode: 'read',
	},
	{
		id: 'receive',
		chapter: 'Receive',
		title: `Bill the shop ${money(TOUR_INVOICE_USD)}`,
		body: `Press Receive and type ${TOUR_INVOICE_USD}. That builds a payment link and a QR code with your address and the amount. If the bill exceeds the line you granted, the wallet asks you to extend it first. In this tour the shop pays the moment the bill can be paid; in life you would show the QR or send the link.`,
		more: 'The invoice is a canonical xln link (entity, token, amount, note). The payer\'s runtime quotes a route through your hub and pays it with the same planner you used a minute ago.',
		target: ctx => {
			if (!at(ctx, '/receive')) return viaHome(ctx, 'home-receive');
			if (Number(ctx.dom.value('receive-amount')) < TOUR_INVOICE_USD) return 'receive-amount';
			return consentTarget(ctx) ?? 'receive-amount';
		},
		hint: ctx => {
			if (!at(ctx, '/receive')) return homeHint(ctx, 'Press Receive.');
			if (Number(ctx.dom.value('receive-amount')) < TOUR_INVOICE_USD) return `Type ${TOUR_INVOICE_USD}.`;
			return consentHint(ctx) ?? 'The shop is paying…';
		},
		mode: 'do',
		enter: ctx => ctx.baseline.set('receivable', ctx.wallet.usd.receivable),
		trigger: ctx => at(ctx, '/receive') && Number(ctx.dom.value('receive-amount')) >= TOUR_INVOICE_USD && usdcCapacityIn(ctx) >= TOUR_INVOICE_USD,
		react: tourInvoicePaid,
		done: ctx => ctx.wallet.usd.receivable >= (ctx.baseline.get('receivable') ?? 0) + TOUR_INVOICE_USD * 0.9,
	},
	{
		id: 'onchain',
		chapter: 'Collateral',
		title: 'Put money on the blockchain',
		body: `So far nothing touched the chain. To turn promises into guarantees you need money the chain can see: a reserve in the shared vault, and a little gas to pay for transactions. Go to Manage → Assets and press "Gas (ETH) to my on-chain wallet", then "USDC straight into my reserve".`,
		more: 'The network faucet sends test ETH to your signer address and asks the Depository to credit your entity reserve. Your runtime watches the chain over RPC and picks the reserve up from the event, exactly as it would on mainnet.',
		target: ctx => (at(ctx, '/assets') ? (hasGas(ctx) ? 'faucet-reserve' : 'faucet-gas') : toAssets(ctx)),
		hint: ctx => (at(ctx, '/assets') ? (hasGas(ctx) ? 'Now the reserve: press "USDC straight into my reserve".' : 'Gas first: press "Gas (ETH) to my on-chain wallet".') : assetsHint(ctx)),
		mode: 'do',
		enter: ctx => {
			ctx.baseline.set('reserve', ctx.wallet.usd.reserve);
			ctx.baseline.delete('gas');
		},
		progress: ctx => ({ done: (hasGas(ctx) ? 1 : 0) + (ctx.wallet.usd.reserve >= (ctx.baseline.get('reserve') ?? 0) + TOUR_MOVE_USD * 0.9 ? 1 : 0), total: 2 }),
		done: ctx => hasGas(ctx) && ctx.wallet.usd.reserve >= (ctx.baseline.get('reserve') ?? 0) + TOUR_MOVE_USD * 0.9,
	},
	{
		id: 'move',
		chapter: 'Collateral',
		title: `Lock ${money(TOUR_MOVE_USD)} as collateral`,
		body: `Part of your money sits in a shared vault on the blockchain, your reserve. Move ${money(TOUR_MOVE_USD)} of it into your account with your hub. It becomes collateral: the blockchain itself now guarantees that part of your balance.`,
		more: 'A reserve → collateral operation inside a signed Depository batch. The chain answers with a ReserveToCollateral event that both runtimes apply to the account. The chain is the network\'s test chain, reached over RPC like mainnet.',
		target: ctx => {
			if (!at(ctx, '/move')) return viaHome(ctx, 'home-move');
			if (!ctx.dom.active('move-from-reserve')) return 'move-from-reserve';
			if (!ctx.dom.active('move-to-account')) return 'move-to-account';
			if (!ctx.dom.value('move-amount').trim()) return 'move-amount';
			return 'move-now';
		},
		hint: ctx => {
			if (!at(ctx, '/move')) return homeHint(ctx, 'Press Move, next to Balances.');
			if (!ctx.dom.active('move-from-reserve')) return 'From: Reserve.';
			if (!ctx.dom.active('move-to-account')) return 'To: Account.';
			if (!ctx.dom.value('move-amount').trim()) return `Type ${TOUR_MOVE_USD}.`;
			return 'Sign & send.';
		},
		mode: 'do',
		enter: ctx => ctx.baseline.set('collateral', collateralUsd(ctx)),
		done: ctx => collateralUsd(ctx) >= (ctx.baseline.get('collateral') ?? 0) + TOUR_MOVE_USD * 0.9,
	},
	{
		id: 'move-read',
		chapter: 'Collateral',
		title: 'A promise became a guarantee',
		body: `"Secured" is the part of what you are owed that collateral covers. ${money(TOUR_MOVE_USD)} of violet turned green: if your hub disappeared tomorrow, that ${money(TOUR_MOVE_USD)} is yours by contract. Back on Home you can see it.`,
		target: ctx => viaHome(ctx, 'home-risk'),
		mode: 'read',
	},
	{
		id: 'rebalance',
		chapter: 'Collateral',
		title: 'Make the hub put up collateral',
		body: 'The hub can also lock its own money as collateral for what it owes you, for a small fee it published up front. Open your account with your hub, then Manage → Collateral, and ask for the whole uncovered amount. The hub posts it on-chain within a moment.',
		more: 'requestCollateral quotes the fee from the hub\'s committed policy (base + gas + liquidity basis points). The hub\'s scheduler answers with a reserve → collateral batch paid from its own Depository reserve, capped at what it owes you uncovered.',
		target: ctx => {
			if (!at(ctx, hubPath(ctx))) return viaHub(ctx, '');
			if (!ctx.dom.has('collateral-request')) return 'account-manage';
			if (!ctx.dom.value('collateral-amount').trim()) return 'collateral-amount';
			return 'collateral-request';
		},
		hint: ctx => {
			if (!at(ctx, hubPath(ctx))) return homeHint(ctx, 'Open your hub account.');
			if (!ctx.dom.has('collateral-request')) return 'Open Manage; the Collateral tab is first.';
			if (!ctx.dom.value('collateral-amount').trim()) return `Type ${collateralAsk(ctx)}.`;
			return 'Request collateral.';
		},
		mode: 'do',
		enter: ctx => {
			ctx.baseline.set('collateral', collateralUsd(ctx));
			ctx.baseline.set('collateral:ask', Math.floor(hubUnsecuredUsd(ctx)));
		},
		done: ctx => collateralUsd(ctx) >= (ctx.baseline.get('collateral') ?? 0) + collateralAsk(ctx) * 0.5,
		skipWhen: ctx => tourCollateralPolicy(ctx.wallet) === null || hubUnsecuredUsd(ctx) < 1,
	},
	{
		id: 'trade',
		chapter: 'Trade',
		title: `Make ${TRADES_TO_MAKE} trades`,
		body: 'Your hub runs a marketplace for its members and its market makers keep offers on both sides. Tap a price in the book to fill your ticket, then place the order. The first time you receive a coin the wallet asks how much of it the hub may owe you. Buy some ETH, sell some back, buy again: three fills.',
		more: 'Same-hub swaps: your order hits the hub\'s book and matches the merchant\'s resting offer. Both accounts commit the fill in one frame each; the hub takes the spread it published.',
		target: ctx => {
			if (!at(ctx, '/swap')) return viaHome(ctx, 'home-swap');
			if (!ctx.dom.value('swap-give').trim()) return 'orderbook';
			return consentTarget(ctx) ?? 'swap-submit';
		},
		hint: ctx => {
			if (!at(ctx, '/swap')) return homeHint(ctx, 'Press Swap.');
			if (!ctx.dom.value('swap-give').trim()) return 'Tap a price. Red rows sell you ETH, green rows buy it from you.';
			return consentHint(ctx) ?? 'Place the order.';
		},
		mode: 'do',
		enter: ctx => {
			ctx.baseline.set('weth:last', wethUnits(ctx));
			ctx.baseline.set('weth:count', 0);
		},
		progress: ctx => ({ done: Math.min(TRADES_TO_MAKE, countChanges(ctx, 'weth', wethUnits(ctx))), total: TRADES_TO_MAKE }),
		done: ctx => countChanges(ctx, 'weth', wethUnits(ctx)) >= TRADES_TO_MAKE,
	},
	{
		id: 'quiz-hub-dark',
		chapter: 'Dispute',
		title: 'Your hub stops answering',
		body: 'Your payments hang. The hub does not sign anything. It still owes you a lot of violet. What do you do?',
		mode: 'quiz',
		options: [
			{ label: 'Dispute: take the last signed page to the blockchain', correct: true, why: 'Yes. You never needed the hub\'s permission. The chain enforces the newest page both of you signed.' },
			{ label: 'Email support and wait', why: 'You can, but you do not have to. xln gives you a button that works without anyone\'s help.' },
			{ label: 'Nothing can be done', why: 'Wrong, and this is the whole point of xln. Your money is protected by signatures you already hold.' },
		],
	},
	{
		id: 'dispute',
		chapter: 'Dispute',
		title: 'Do it: dispute your hub',
		body: 'Open your account with your hub, then Manage → Dispute → "Dispute this account", and confirm. It freezes the account, pulls your open orders and gets your latest signed page ready for the blockchain. This is a test network, so go ahead.',
		more: 'prepareDispute freezes the account, withdraws your orders from the hub\'s book and drafts a disputeStart with the newest co-signed proof into your on-chain batch.',
		target: ctx => {
			if (!at(ctx, hubPath(ctx))) return viaHub(ctx, '');
			if (ctx.dom.has('dispute-prepare-confirm')) return 'dispute-prepare-confirm';
			if (ctx.dom.has('dispute-prepare')) return 'dispute-prepare';
			if (ctx.dom.has('manage-tab-dispute')) return 'manage-tab-dispute';
			return 'account-manage';
		},
		hint: ctx => {
			if (!at(ctx, hubPath(ctx))) return homeHint(ctx, 'Open your hub account.');
			if (ctx.dom.has('dispute-prepare-confirm')) return 'Confirm.';
			if (ctx.dom.has('dispute-prepare')) return 'Press "Dispute this account".';
			if (ctx.dom.has('manage-tab-dispute')) return 'Open the Dispute tab.';
			return 'Open Manage.';
		},
		mode: 'do',
		done: ctx => (hub(ctx)?.dispute ?? 'none') !== 'none',
	},
	{
		id: 'dispute-batch',
		chapter: 'Dispute',
		title: 'Send it to the blockchain',
		body: 'Your dispute is packed and waiting for your signature on Home. Sign and send. From here the blockchain runs the clock: the hub gets a window to show a newer signed page, and whoever holds the newest one wins.',
		more: 'j_broadcast signs the batch and submits it to the Depository, which emits DisputeStarted. Response windows come from the signed account config: one hour for a hub, a day for a person.',
		target: ctx => viaHome(ctx, 'batch-broadcast'),
		hint: ctx => homeHint(ctx, 'Sign & send the batch.'),
		mode: 'do',
		done: ctx => ['sent', 'active'].includes(hub(ctx)?.dispute ?? 'none'),
	},
	{
		id: 'watchtower',
		chapter: 'Dispute',
		title: 'What if you are the one offline?',
		body: 'The other side can dispute too, with an old page that favours them, hoping you are asleep. You get a window to answer with the newer page. A tower is a service you pick that keeps an encrypted copy of your latest pages and, as a last resort, answers for you while you are away. It cannot read your balances. You can also run your own.',
		more: 'Two tower services: blind encrypted backup (the tower sees only a lookup key, sizes and hashes) and last-resort dispute protection with remedies that decrypt only after the response window opens. Response windows are part of the signed account config; a watch seed derived from the account identity lets the tower recognise DisputeStarted events without learning anything else.',
		target: ctx => viaHub(ctx, 'account-dispute-state'),
		mode: 'read',
	},
	{
		id: 'dispute-read',
		chapter: 'Dispute',
		title: 'What you would see next',
		body: 'The account now shows the dispute the chain recorded. The hub gets a window to answer with a newer signed page; when it closes, a Finalize button pays out exactly what the newest page says. Nothing here needs the hub\'s cooperation.',
		more: 'The Depository emits DisputeStarted; your runtime watches the chain over RPC and applies it to the account as activeDispute. The response window comes from the signed account config. Finalize settles collateral per the last co-signed delta.',
		target: ctx => viaHub(ctx, 'account-dispute-state'),
		mode: 'read',
	},
	{
		id: 'evidence',
		chapter: 'Sovereignty',
		title: 'Take your proof with you',
		body: 'Open the shield and press "Save evidence bundle". This file holds the signed pages for every account. Keep it somewhere that is not this device. With it, any xln wallet can defend your money, even if this one is gone.',
		more: 'Frame hashes, both frame signatures and both dispute-proof signatures with their nonces, per account. Enough to open a dispute from another runtime.',
		target: ctx => (at(ctx, '/sovereignty') ? 'evidence-export' : viaHome(ctx, 'home-sovereignty')),
		mode: 'read',
	},
	{
		id: 'finish',
		chapter: 'Done',
		title: "That's xln",
		body: 'You got paid on credit, paid a shop, billed it back, turned promises into guarantees from both sides, traded three times and used the dispute that protects all of it. Replay any chapter from Settings, reset the playground, or create a real wallet. Cross-network trades, shared boards and lending are the advanced tour.',
		target: ctx => viaHome(ctx, 'home-total'),
		mode: 'read',
	},
];
