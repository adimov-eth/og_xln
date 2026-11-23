/**
 * Account management: the same entity txs the SvelteKit "Configure" panel
 * sends (collateral request, add token, dispute prepare/finalize, settlement
 * signature, credit request). Pure helpers over the account document the
 * view-frame already carries; nothing here reads the env.
 */
import type { EntityTx, JBatch, RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import type { SettlementOp } from '@xln/core/types/account';
import { effectiveRebalanceTerms } from '@xln/core/account/config/term-notice';
import type { BilateralRebalanceFeePolicy } from '@xln/core/types/finance/rebalance';
import { newCreditRequestId } from '@xln/frontend/lib/components/Entity/account/entity-action-txs';
import { resolveAccountDisputePhase, type EverydayDisputePhase } from '@xln/frontend/lib/everyday/everyday-recovery';
import { normalizeId } from '@xln/frontend/lib/utils/primitives';

/** One account as the view-frame carries it (native maps instead of persistent collections). */
export type AccountDoc = NonNullable<RuntimeAdapterViewFrame['activeEntity']>['accounts']['items'][number];
type DisputeAccountDoc = Pick<AccountDoc, 'status' | 'activeDispute' | 'disputePrepare'> & {
	state: Pick<AccountDoc['state'], 'leftEntity' | 'rightEntity'>;
};
type DisputeBatch = { disputeStarts: ReadonlyArray<Pick<JBatch['disputeStarts'][number], 'counterentity'>> };

export type FeePolicy = { policyVersion: number; baseFee: bigint; gasFee: bigint; liquidityFeeBps: bigint };

/**
 * The counterparty's committed rebalance fee policy for a token. We are on one
 * side; the fee we pay is set by the other side's snapshot.
 */
export function counterpartyFeePolicy(
	doc: { currentFrame: { timestamp: number }; state: { rebalanceFeePolicies?: ReadonlyMap<number, BilateralRebalanceFeePolicy> } } | null | undefined,
	isLeft: boolean,
	tokenId: number,
): FeePolicy | null {
	const snapshot = doc?.state?.rebalanceFeePolicies?.get(tokenId)?.[isLeft ? 'right' : 'left'];
	if (!snapshot || !doc) return null;
	const policy = effectiveRebalanceTerms(snapshot, doc.currentFrame.timestamp);
	return { policyVersion: policy.policyVersion, baseFee: policy.baseFee, gasFee: policy.gasFee, liquidityFeeBps: policy.liquidityFeeBps };
}

export function collateralFee(policy: FeePolicy, amount: bigint): bigint {
	return policy.baseFee + policy.gasFee + (amount * policy.liquidityFeeBps) / 10_000n;
}

export function buildRequestCollateralTx(counterpartyEntityId: string, tokenId: number, amount: bigint, policy: FeePolicy): EntityTx {
	if (policy.baseFee < 0n || policy.gasFee < 0n || policy.liquidityFeeBps < 0n) throw new Error('The counterparty fee policy contains negative values');
	const feeAmount = collateralFee(policy, amount);
	if (feeAmount >= amount) throw new Error('The fee must be lower than the amount requested');
	return {
		type: 'requestCollateral',
		data: { counterpartyEntityId, tokenId, amount, feeTokenId: tokenId, feeAmount, policyVersion: policy.policyVersion },
	};
}

/** Only an observed DisputeStarted opens the response window; a local placeholder still needs submission. */
export type DisputePhase = EverydayDisputePhase;

export type DisputeView = {
	phase: DisputePhase;
	/** True when we started the on-chain dispute. */
	startedByUs: boolean;
	/** Unix seconds when the challenge window closes; 0 when not on-chain yet. */
	timeout: number;
	observedOnChain: boolean;
	finalizeQueued: boolean;
	reason: string;
};

export function disputeView(doc: DisputeAccountDoc | null | undefined, isLeft: boolean, draftBatch?: DisputeBatch | null): DisputeView {
	if (!doc) return { phase: 'none', startedByUs: false, timeout: 0, observedOnChain: false, finalizeQueued: false, reason: '' };
	const counterpartyId = normalizeId(isLeft ? doc.state.rightEntity : doc.state.leftEntity);
	const { phase, startedByUs, timeout } = resolveAccountDisputePhase(doc, isLeft, counterpartyId, draftBatch);
	return {
		phase,
		startedByUs,
		timeout,
		observedOnChain: phase === 'active',
		finalizeQueued: phase === 'active' && doc.activeDispute?.finalizeQueued === true,
		reason: phase === 'none' || phase === 'closed' ? '' : String(doc.disputePrepare?.reason || ''),
	};
}

export type SettlementPhase = 'none' | 'awaiting_you' | 'awaiting_them' | 'ready' | 'submitted' | 'draft';

export type SettlementView = {
	phase: SettlementPhase;
	label: string;
	workspaceHash: string;
	memo: string;
	ops: SettlementOp[];
	/** We proposed (or last edited) the workspace. */
	proposedByUs: boolean;
	/** We are the side that submits the batch on-chain. */
	weExecute: boolean;
	signedByUs: boolean;
	signedByThem: boolean;
	revision: number;
};

/** Same reading of the workspace as the SvelteKit account preview: sign only when it is our turn. */
export function settlementView(doc: AccountDoc | null | undefined, isLeft: boolean): SettlementView | null {
	const workspace = doc?.state?.settlementWorkspace;
	if (!workspace) return null;
	const proposedByUs = workspace.lastModifiedByLeft === isLeft;
	const signedByUs = Boolean(isLeft ? workspace.leftHanko : workspace.rightHanko);
	const signedByThem = Boolean(isLeft ? workspace.rightHanko : workspace.leftHanko);
	const status = String(workspace.status || '');
	let phase: SettlementPhase = 'none';
	let label = status.replace(/_/g, ' ');
	if (status === 'awaiting_counterparty') {
		if (!proposedByUs && !signedByUs) {
			phase = 'awaiting_you';
			label = 'Awaiting your signature';
		} else {
			phase = 'awaiting_them';
			label = proposedByUs ? 'Awaiting counterparty signature' : 'Awaiting signature';
		}
	} else if (status === 'ready_to_submit') {
		phase = 'ready';
		label = 'Both signed · going on-chain';
	} else if (status === 'submitted') {
		phase = 'submitted';
		label = 'Pending on-chain confirmation';
	} else if (status === 'draft') {
		phase = 'draft';
		label = 'Draft';
	}
	return {
		phase,
		label,
		workspaceHash: String(workspace.workspaceHash || ''),
		memo: String(workspace.memo || ''),
		ops: workspace.ops ?? [],
		proposedByUs,
		weExecute: workspace.executorIsLeft === isLeft,
		signedByUs,
		signedByThem,
		revision: Number(workspace.revision || 0),
	};
}

export function describeSettlementOp(op: SettlementOp, money: (tokenId: number, amount: bigint) => string, proposedByUs: boolean): string {
	const who = proposedByUs ? 'your' : 'their';
	switch (op.type) {
		case 'r2c':
			return `${money(op.tokenId, op.amount)} from ${who} reserve into collateral`;
		case 'c2r':
			return `${money(op.tokenId, op.amount)} of collateral to ${who} reserve`;
		case 'r2r':
			return `${money(op.tokenId, op.amount)} reserve to reserve`;
		case 'forgive':
			return `forgive debt in token ${op.tokenId}`;
		case 'rawDiff':
			return `raw diff · collateral ${money(op.tokenId, op.collateralDiff)}`;
		default:
			return 'settlement operation';
	}
}

export function buildRequestCreditTx(counterpartyEntityId: string, tokenId: number, amount: bigint): EntityTx {
	if (amount <= 0n) throw new Error('Enter a positive amount');
	return { type: 'requestCredit', data: { counterpartyEntityId, tokenId, amount, requestId: newCreditRequestId() } };
}

/**
 * Ask the hub for a credit line inside bilateral Account consensus. A user
 * cannot set the hub's own limit: our signed `credit_request` commits in the
 * account, then the hub answers with its own credit line (the smaller of the
 * request and the protocol cap; it never lowers a larger existing line).
 */
export async function requestCreditFromHub(input: { entityId: string; signerId: string; hubEntityId: string; tokenId: number; amount: bigint }): Promise<void> {
	const tx = buildRequestCreditTx(input.hubEntityId, input.tokenId, input.amount);
	const { sendEntityTxs } = await import('../tx');
	await sendEntityTxs(input.entityId, input.signerId, [tx]);
}
