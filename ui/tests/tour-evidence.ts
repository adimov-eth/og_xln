/**
 * Money evidence for the wallet tour.
 *
 * Every reader here goes through the wallet's own committed read surface
 * (`window.__xln` diagnostics → `adapter.read('view-frame'…)`) or through the
 * real chain over RPC. Nothing in this file submits a financial command; it
 * only observes what the person's own actions produced.
 *
 * The shape is the one `ui/tests/e2e-move.spec.ts` established: reserve,
 * collateral, offdelta, the derived own value and `reserve + ownValue`, plus
 * the committed heights and roots that prove the numbers came from a signed
 * frame rather than from screen text.
 */
import { expect, type Page } from '@playwright/test';
import { JsonRpcProvider } from 'ethers';
import type { RuntimeAdapterViewFrame, RuntimeReplica, XLNModule } from '../../core/api/public/runtime-module';
import type { RuntimeAdapterFrameSummary } from '../../core/api/runtime-adapter/resolve';
import type { RuntimeAdapter } from '../../core/api/runtime-adapter/types';
import { computeAccountKey } from '../../core/jurisdiction/adapter/events/contract-codec';
import { decodeInt512 } from '../../core/protocol/crypto/abi-money';
import { Depository__factory } from '../../jurisdictions/typechain-types/factories/Depository.sol/Depository__factory';

export const USDC = 1;
export const WETH = 2;
export const USDT = 3;
export const TOUR_TOKENS = [USDC, WETH, USDT] as const;

export type DebugWindow = Window & {
	__xln?: {
		adapter: () => RuntimeAdapter | null;
		env: () => RuntimeReplica | null;
		xln: () => Promise<XLNModule>;
		store: { getState: () => { activeEntityId: string | null } };
	};
};

type RawToken = {
	tokenId: number;
	reserve: string;
	collateral: string;
	ondelta: string;
	offdelta: string;
	inCollateral: string;
	outCollateral: string;
	inOwnCredit: string;
	outPeerCredit: string;
	peerCreditLimit: string;
	ownCreditLimit: string;
	inCapacity: string;
	outCapacity: string;
};

type RawSnapshot = {
	entityId: string;
	isLeft: boolean;
	depository: string;
	runtimeHeight: number;
	runtimeRoot: string;
	entityHeight: number;
	accountHeight: number;
	accountRoot: string;
	status: string;
	/** The bilateral response clocks signed into this Account when it was opened. */
	disputeConfig: { leftResponseSeconds: number; rightResponseSeconds: number };
	pending: boolean;
	mempool: number;
	locks: number;
	offers: number;
	paybookOpen: number;
	dispute: {
		observedOnChain: boolean;
		disputeTimeout: number;
		initialNonce: number;
		initialProofbodyHash: string;
		startedByLeft: boolean;
		observedBlockNumber: number | null;
	} | null;
	batch: { draftOperations: number; disputeStarts: number; disputeFinalizations: number; sent: boolean };
	tokens: RawToken[];
};

export type TourToken = {
	tokenId: number;
	reserve: bigint;
	collateral: bigint;
	ondelta: bigint;
	offdelta: bigint;
	inCollateral: bigint;
	outCollateral: bigint;
	inOwnCredit: bigint;
	outPeerCredit: bigint;
	peerCreditLimit: bigint;
	ownCreditLimit: bigint;
	inCapacity: bigint;
	outCapacity: bigint;
	/** What the counterparty owes us plus the collateral that is ours. */
	ownValue: bigint;
	/** The conserved quantity: on-chain reserve plus everything this account owes us. */
	value: bigint;
};

export type TourSnapshot = Omit<RawSnapshot, 'tokens'> & { tokens: Map<number, TourToken> };

/**
 * One committed frame supplies the reserve, the Account deltas and the live
 * queues, so no two numbers in a snapshot can come from different heights.
 */
const readRaw = (page: Page, hubId: string, tokenIds: readonly number[]) =>
	page.evaluate(
		async ({ counterpartyId, tokens }) => {
			const debug = (window as DebugWindow).__xln;
			if (!debug) throw new Error('Tour diagnostics unavailable');
			const adapter = debug.adapter();
			const entityId = debug.store.getState().activeEntityId;
			if (!adapter || !entityId) throw new Error('Tour wallet owner unavailable');
			const frame = await adapter.read<RuntimeAdapterViewFrame>('view-frame', { entityId, accountId: counterpartyId });
			const active = frame.activeEntity;
			if (!active || frame.activeEntityId !== entityId) throw new Error('Tour snapshot owner unavailable');
			const account = active.accounts.items.find(
				item => item.state.leftEntity === counterpartyId || item.state.rightEntity === counterpartyId,
			);
			if (!account) throw new Error('Tour hub Account unavailable');
			const jurisdiction = active.core.config.jurisdiction;
			if (!jurisdiction) throw new Error('Tour jurisdiction unavailable');
			const xln = await debug.xln();
			const isLeft = xln.isLeftEntity(entityId, counterpartyId);
			const committed = await adapter.read<RuntimeAdapterFrameSummary>(`frame/${frame.height}`);
			const batch = active.core.jBatchState;
			const dispute = account.activeDispute ?? null;
			return {
				entityId,
				isLeft,
				depository: jurisdiction.depositoryAddress,
				runtimeHeight: frame.height,
				runtimeRoot: committed.postStateHash,
				entityHeight: active.core.height,
				accountHeight: account.currentHeight,
				accountRoot: account.currentFrame.accountStateRoot,
				status: account.status,
				disputeConfig: {
					leftResponseSeconds: Number(account.state.disputeConfig.leftResponseSeconds),
					rightResponseSeconds: Number(account.state.disputeConfig.rightResponseSeconds),
				},
				pending: Boolean(account.pendingFrame),
				mempool: account.mempoolCount,
				locks: account.state.locks.size,
				offers: account.state.swapOffers.size,
				paybookOpen: active.core.paybookOpen ?? 0,
				dispute: dispute
					? {
						observedOnChain: dispute.observedOnChain === true,
						disputeTimeout: dispute.disputeTimeout,
						initialNonce: dispute.initialNonce,
						initialProofbodyHash: dispute.initialProofbodyHash,
						startedByLeft: dispute.startedByLeft,
						observedBlockNumber: dispute.observedBlockNumber ?? null,
					}
					: null,
				batch: {
					// Every JBatch operation array counts, including unrelated drafts.
					draftOperations: batch
						? Object.values(batch.batch).filter(Array.isArray).reduce((sum, rows) => sum + rows.length, 0)
						: 0,
					disputeStarts: batch?.batch.disputeStarts.length ?? 0,
					disputeFinalizations: batch?.batch.disputeFinalizations.length ?? 0,
					sent: Boolean(batch?.sentBatch),
				},
				tokens: tokens.map(tokenId => {
					const delta = account.state.deltas.get(tokenId);
					const derived = delta ? xln.deriveDelta(delta, isLeft) : null;
					return {
						tokenId,
						reserve: String(active.core.reserves.get(tokenId) ?? 0n),
						collateral: String(delta?.collateral ?? 0n),
						ondelta: String(delta?.ondelta ?? 0n),
						offdelta: String(delta?.offdelta ?? 0n),
						inCollateral: String(derived?.inCollateral ?? 0n),
						outCollateral: String(derived?.outCollateral ?? 0n),
						inOwnCredit: String(derived?.inOwnCredit ?? 0n),
						outPeerCredit: String(derived?.outPeerCredit ?? 0n),
						peerCreditLimit: String(derived?.peerCreditLimit ?? 0n),
						ownCreditLimit: String(derived?.ownCreditLimit ?? 0n),
						inCapacity: String(derived?.inCapacity ?? 0n),
						outCapacity: String(derived?.outCapacity ?? 0n),
					};
				}),
			} satisfies RawSnapshot;
		},
		{ counterpartyId: hubId, tokens: [...tokenIds] },
	);

function hydrate(raw: RawSnapshot): TourSnapshot {
	const tokens = new Map<number, TourToken>();
	for (const row of raw.tokens) {
		const outCollateral = BigInt(row.outCollateral);
		const outPeerCredit = BigInt(row.outPeerCredit);
		const inOwnCredit = BigInt(row.inOwnCredit);
		const reserve = BigInt(row.reserve);
		const ownValue = outCollateral + outPeerCredit - inOwnCredit;
		tokens.set(row.tokenId, {
			tokenId: row.tokenId,
			reserve,
			collateral: BigInt(row.collateral),
			ondelta: BigInt(row.ondelta),
			offdelta: BigInt(row.offdelta),
			inCollateral: BigInt(row.inCollateral),
			outCollateral,
			inOwnCredit,
			outPeerCredit,
			peerCreditLimit: BigInt(row.peerCreditLimit),
			ownCreditLimit: BigInt(row.ownCreditLimit),
			inCapacity: BigInt(row.inCapacity),
			outCapacity: BigInt(row.outCapacity),
			ownValue,
			value: reserve + ownValue,
		});
	}
	return { ...raw, tokens };
}

/**
 * The protocol's role-aware defaults, from core/account/config/dispute-config.ts.
 * A hub must answer a dispute within an hour; a person gets a day. These are the
 * test's expectations, not a copy of anything the wallet computes.
 */
export const HUB_RESPONSE_SECONDS = 60 * 60;
export const USER_RESPONSE_SECONDS = 24 * 60 * 60;

/** The signed window split by who holds which side of this Account. */
export function tourDisputeWindow(snapshot: TourSnapshot): { own: number; peer: number; total: number } {
	const { leftResponseSeconds, rightResponseSeconds } = snapshot.disputeConfig;
	return {
		own: snapshot.isLeft ? leftResponseSeconds : rightResponseSeconds,
		peer: snapshot.isLeft ? rightResponseSeconds : leftResponseSeconds,
		total: leftResponseSeconds + rightResponseSeconds,
	};
}

export function tourToken(snapshot: TourSnapshot, tokenId: number): TourToken {
	const found = snapshot.tokens.get(tokenId);
	if (!found) throw new Error(`Tour token snapshot unavailable: ${tokenId}`);
	return found;
}

export async function readTourState(page: Page, hubId: string): Promise<TourSnapshot> {
	return hydrate(await readRaw(page, hubId, TOUR_TOKENS));
}

/**
 * A snapshot taken while a frame is in flight would compare two different
 * ledgers; wait for the Account to drain before reading money.
 */
export async function settledTourState(page: Page, hubId: string, label: string, timeout = 20_000): Promise<TourSnapshot> {
	await expect
		.poll(
			async () => {
				const state = await readTourState(page, hubId);
				return { pending: state.pending, mempool: state.mempool };
			},
			{ timeout, intervals: [100, 250, 500] },
		)
		.toEqual({ pending: false, mempool: 0 });
	const settled = await readTourState(page, hubId);
	if (settled.pending || settled.mempool !== 0) throw new Error(`Tour Account never drained at ${label}`);
	return settled;
}

/** Every signed swap fill committed on this Account between two Account heights. */
export const readTourSwapFills = (page: Page, hubId: string, fromHeight: number, toHeight: number) =>
	page.evaluate(
		async ({ counterpartyId, from, to }) => {
			const debug = (window as DebugWindow).__xln;
			const env = debug?.env();
			const entityId = debug?.store.getState().activeEntityId;
			if (!debug || !env || !entityId) throw new Error('Tour signed swap frames unavailable');
			const xln = await debug.xln();
			const frames = await xln.readPersistedAccountFrameHistory(env, entityId, counterpartyId, to, {
				maxAccountHeight: to,
			});
			return frames
				.filter(frame => frame.height > from)
				.flatMap(frame =>
					frame.accountTxs.flatMap(tx => {
						if (tx.type !== 'swap_resolve') return [];
						if (tx.data.executionGiveAmount === undefined || tx.data.executionWantAmount === undefined)
							throw new Error('Tour signed swap execution amounts missing');
						return [
							{
								height: frame.height,
								root: frame.accountStateRoot,
								restingGiveTokenId: tx.data.restingGiveTokenId ?? 0,
								restingWantTokenId: tx.data.restingWantTokenId ?? 0,
								give: String(tx.data.executionGiveAmount),
								want: String(tx.data.executionWantAmount),
								fee: String(tx.data.feeAmount ?? 0n),
								feeTokenId: tx.data.feeTokenId ?? 0,
							},
						];
					}),
				);
		},
		{ counterpartyId: hubId, from: fromHeight, to: toHeight },
	);

export type ChainMoney = {
	reserve: bigint;
	peerReserve: bigint;
	collateral: bigint;
	ondelta: bigint;
	nonce: bigint;
	disputeHash: string;
	disputeTimeout: number;
};

/** The Depository's own numbers, read straight from the chain over RPC. */
export async function readChainMoney(
	provider: JsonRpcProvider,
	depository: string,
	owner: string,
	hub: string,
	tokenId: number,
	blockTag?: number,
): Promise<ChainMoney> {
	const contract = Depository__factory.connect(depository, provider);
	const key = computeAccountKey(owner, hub);
	const at = blockTag === undefined ? {} : { blockTag };
	const [reserve, peerReserve, collateral, account] = await Promise.all([
		contract._reserves(owner, tokenId, at),
		contract._reserves(hub, tokenId, at),
		contract._collaterals(key, tokenId, at),
		contract._accounts(key, at),
	]);
	return {
		reserve,
		peerReserve,
		collateral: collateral.collateral,
		ondelta: decodeInt512(collateral.ondelta),
		nonce: account.nonce,
		disputeHash: account.disputeHash,
		disputeTimeout: Number(account.disputeTimeout),
	};
}

export function depositoryOf(provider: JsonRpcProvider, address: string) {
	return Depository__factory.connect(address, provider);
}

/**
 * The chain the wallet itself is configured against. The dispute payout and the
 * reserve faucet are only believable when read from that same node, so the
 * endpoint is derived from the app's jurisdiction and must be a local sandbox.
 */
export async function openTourChain(page: Page): Promise<{ provider: JsonRpcProvider; chainId: number }> {
	const response = await page.request.get('/api/jurisdictions');
	expect(response.ok(), await response.text()).toBe(true);
	const payload: unknown = await response.json();
	if (!payload || typeof payload !== 'object' || !('jurisdictions' in payload) || !payload.jurisdictions)
		throw new Error('Tour jurisdiction catalogue unavailable');
	const rows = Object.values(payload.jurisdictions as Record<string, unknown>);
	const primary = rows.find(
		row => row && typeof row === 'object' && 'primary' in row && (row as { primary?: unknown }).primary === true,
	) as { chainId?: unknown; explorer?: unknown } | undefined;
	if (!primary || typeof primary.chainId !== 'number') throw new Error('Tour primary jurisdiction unavailable');
	const configured = process.env['XLN_UI_TOUR_CHAIN_RPC'] ?? (typeof primary.explorer === 'string' ? primary.explorer : '');
	if (!configured) throw new Error('Tour chain endpoint unavailable');
	const url = new URL(configured);
	if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname))
		throw new Error(`Tour refuses to drive a non-sandbox chain: ${url.hostname}`);
	const provider = new JsonRpcProvider(configured, primary.chainId, { staticNetwork: true, cacheTimeout: -1 });
	const network = await provider.getNetwork();
	if (Number(network.chainId) !== primary.chainId) {
		provider.destroy();
		throw new Error(`Tour chain endpoint answers for chain ${network.chainId}, not ${primary.chainId}`);
	}
	return { provider, chainId: primary.chainId };
}
