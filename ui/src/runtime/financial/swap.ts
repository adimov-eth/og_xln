import type {
	AccountReplica,
	AccountState,
	CrossJurisdictionSwapRoute,
	Profile,
	RuntimeAdapterEntitySummary,
	RuntimeAdapterViewFrame,
} from '@xln/core/api/public/runtime-module';
import { getJurisdictionStackId } from '@xln/core/api/public/runtime-module';
import type { AccountRoleEvidence } from '@xln/core/account/config/dispute-config';
import { defaultAccountDisputeConfigForRoleEvidence } from '@xln/core/account/config/dispute-config';
import type { SwapCommandPlan, SwapCommandPlanInput } from '@xln/core/runtime/swap-cmd/swap-command-plan';

import { getEmbeddedEnv, requireAdapter } from '../adapter';
import { getXLN } from '../xln-loader';
import { sendEntityTxs } from '../tx';

const normalizeId = (value: unknown): string => String(value || '').trim().toLowerCase();

export type SwapParty = {
	entityId: string;
	signerId: string;
	hubEntityId: string;
	/** Jurisdiction stack id of the entity's configured jurisdiction. */
	jurisdiction: string;
	account: AccountState | null;
};

/**
 * Committed hub roles: only signer-backed replicas (our own entities) are
 * committed authority. Remote gossip summaries carry no signer and cannot
 * masquerade as committed roles. Mirrors buildSwapPanelRuntimeView.
 */
export function committedRoles(summaries: readonly RuntimeAdapterEntitySummary[]): Map<string, boolean> {
	const roles = new Map<string, boolean>();
	for (const summary of summaries) {
		const entityId = normalizeId(summary.entityId);
		if (entityId && summary.signerId && typeof summary.isHub === 'boolean') roles.set(entityId, summary.isHub);
	}
	return roles;
}

export function jurisdictionRef(frame: RuntimeAdapterViewFrame | null): string {
	const config = frame?.activeEntity?.core?.config?.jurisdiction;
	return config ? getJurisdictionStackId(config) : '';
}

function hubGossipProfile(hubEntityId: string): Profile | null {
	const env = getEmbeddedEnv();
	const profile = env?.gossip?.getProfile?.(hubEntityId);
	return profile ?? null;
}

function hubIsHub(hubEntityId: string, summaries: readonly RuntimeAdapterEntitySummary[]): boolean {
	const gossip = hubGossipProfile(hubEntityId);
	if (gossip?.metadata?.isHub === true) return true;
	return summaries.some(summary => normalizeId(summary.entityId) === hubEntityId && summary.isHub === true);
}

/** Same rule as resolveSameJSwapPartyRoles: the party role must be committed, the hub must be a hub. */
export function partyRoles(input: {
	entityId: string;
	hubEntityId: string;
	roles: ReadonlyMap<string, boolean>;
	summaries: readonly RuntimeAdapterEntitySummary[];
	label: 'SOURCE' | 'TARGET';
}): { entityRoleEvidence: AccountRoleEvidence; hubRoleEvidence: AccountRoleEvidence } {
	const entityId = normalizeId(input.entityId);
	const hubEntityId = normalizeId(input.hubEntityId);
	const entityIsHub = input.roles.get(entityId);
	if (!entityId || !hubEntityId || typeof entityIsHub !== 'boolean' || !hubIsHub(hubEntityId, input.summaries)) {
		throw new Error(`SWAP_${input.label}_PARTY_ROLE_UNAVAILABLE:${entityId}:${hubEntityId}`);
	}
	return {
		entityRoleEvidence: { entityId, isHub: entityIsHub, source: 'committed-profile' },
		hubRoleEvidence: {
			entityId: hubEntityId,
			isHub: true,
			source: input.roles.get(hubEntityId) === true ? 'committed-profile' : 'verified-gossip-profile',
		},
	};
}

/** The hub's published taker fee. No fee policy means no order: the runtime would reject an unauthorized net. */
export function hubTakerFeeBps(hubEntityId: string): number {
	const feeBps = hubGossipProfile(normalizeId(hubEntityId))?.metadata?.swapTakerFeeBps;
	if (!Number.isSafeInteger(feeBps)) throw new Error('SWAP_FEE_POLICY_UNAVAILABLE');
	return Number(feeBps);
}

export async function readAccountState(entityId: string, counterpartyId: string): Promise<AccountState | null> {
	try {
		const doc = await requireAdapter().read<AccountReplica>(
			`entity/${encodeURIComponent(normalizeId(entityId))}/account/${encodeURIComponent(normalizeId(counterpartyId))}`,
		);
		return (doc?.state as AccountState | undefined) ?? null;
	} catch (error) {
		if (error instanceof Error && /E_NOT_FOUND|account not found/i.test(error.message)) return null;
		throw error;
	}
}

/** Opening an incoming account is explicit and grants no credit. */
export async function openSwapReceiveAccount(party: { entityId: string; signerId: string; hubEntityId: string }, tokenId: number, summaries: readonly RuntimeAdapterEntitySummary[]): Promise<void> {
	const roles = committedRoles(summaries);
	const evidence = partyRoles({ ...party, roles, summaries, label: 'TARGET' });
	const disputeConfig = defaultAccountDisputeConfigForRoleEvidence(evidence.entityRoleEvidence, evidence.hubRoleEvidence, roles);
	await sendEntityTxs(party.entityId, party.signerId, [{ type: 'openAccount', data: { targetEntityId: party.hubEntityId, tokenId, creditAmount: 0n, disputeConfig } }]);
}

export type SwapPlanRequest = {
	mode: 'same' | 'cross';
	frame: RuntimeAdapterViewFrame;
	source: SwapParty;
	target?: SwapParty;
	giveTokenId: number;
	giveTokenDecimals: number;
	wantTokenId: number;
	wantTokenDecimals: number;
	giveAmount: bigint;
	priceTicks: bigint;
	expectedWantAmount: bigint;
	routeValue: string;
};

/**
 * One canonical planner for both modes, the runtime's planSwapCommand. The plan
 * carries the exact RuntimeInput (same network) or the cross-network intent plus
 * an optional target setup input. Mirrors the SvelteKit SwapPanel submission.
 */
/**
 * The hub's signer for a swap command. A hub hosted in this runtime shows its signer in the entity summary;
 * a remote hub does not (gossip carries no signer), so fall back to the runtime's proposer resolution, which
 * knows the hub runtime's signer from its verified profile route, the same way the SvelteKit swap panel does.
 */
function hubSignerIdFor(xln: Awaited<ReturnType<typeof getXLN>>, hubEntityId: string, summary: RuntimeAdapterEntitySummary | undefined): string {
	const fromSummary = normalizeId(summary?.signerId || '');
	if (fromSummary) return fromSummary;
	const env = getEmbeddedEnv();
	if (!env) return '';
	try {
		return normalizeId(xln.resolveEntityProposerId(env, normalizeId(hubEntityId), 'swap-plan') || '');
	} catch {
		return '';
	}
}

export async function planSwap(request: SwapPlanRequest): Promise<SwapCommandPlan> {
	const xln = await getXLN();
	const summaries = request.frame.entities;
	const roles = committedRoles(summaries);
	const logicalTimestamp = Number(request.frame.activeEntity?.core?.timestamp ?? 0);
	const logicalHeight = Number(request.frame.activeEntity?.core?.height ?? 0);
	if (logicalTimestamp <= 0 || logicalHeight <= 0) throw new Error('Swap runtime clock is unavailable');

	const sourceRoles = partyRoles({
		entityId: request.source.entityId,
		hubEntityId: request.source.hubEntityId,
		roles,
		summaries,
		label: 'SOURCE',
	});
	const sourceHub = summaries.find(summary => normalizeId(summary.entityId) === normalizeId(request.source.hubEntityId));
	const sourceHubSignerId = hubSignerIdFor(xln, request.source.hubEntityId, sourceHub);
	if (!sourceHubSignerId) throw new Error(`SWAP_HUB_SIGNER_UNAVAILABLE:${request.source.hubEntityId}`);

	const net =
		request.mode === 'same'
			? xln.deriveSwapNetAuthorization(request.expectedWantAmount, hubTakerFeeBps(request.source.hubEntityId))
			: { maxFee: 0n, minNetReceive: request.expectedWantAmount };

	const source: SwapCommandPlanInput['source'] = {
		entityId: request.source.entityId,
		signerId: request.source.signerId,
		hubEntityId: request.source.hubEntityId,
		hubSignerId: sourceHubSignerId,
		jurisdiction: request.source.jurisdiction,
		...sourceRoles,
		committedRoles: roles,
		account: request.source.account,
	};

	let target: SwapCommandPlanInput['target'] | undefined;
	if (request.mode === 'cross') {
		if (!request.target) throw new Error('Select the account on the other network.');
		const targetHub = summaries.find(summary => normalizeId(summary.entityId) === normalizeId(request.target?.hubEntityId));
		const targetHubSignerId = hubSignerIdFor(xln, request.target.hubEntityId, targetHub);
		if (!targetHubSignerId) throw new Error(`SWAP_HUB_SIGNER_UNAVAILABLE:${request.target.hubEntityId}`);
		target = {
			entityId: request.target.entityId,
			signerId: request.target.signerId,
			hubEntityId: request.target.hubEntityId,
			hubSignerId: targetHubSignerId,
			jurisdiction: request.target.jurisdiction,
			...partyRoles({
				entityId: request.target.entityId,
				hubEntityId: request.target.hubEntityId,
				roles,
				summaries,
				label: 'TARGET',
			}),
			committedRoles: roles,
			account: request.target.account,
		};
	}

	const plan = xln.planSwapCommand({
		mode: request.mode,
		logicalTimestamp,
		logicalHeight,
		routeValue: request.routeValue,
		giveTokenId: request.giveTokenId,
		giveTokenDecimals: request.giveTokenDecimals,
		wantTokenId: request.wantTokenId,
		wantTokenDecimals: request.wantTokenDecimals,
		giveAmount: request.giveAmount,
		priceTicks: request.priceTicks,
		...net,
		source,
		...(target ? { target, allowOpenTargetAccount: target.account === null } : {}),
		expiresInMs: 24 * 60 * 60 * 1_000,
	});
	if (plan.mode !== request.mode) throw new Error(`SWAP_COMMAND_PLAN_MODE_MISMATCH:${plan.mode}`);
	return plan;
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Opening the target Account is a bilateral proposal; the readiness check is side-effect free, so retrying is safe. */
async function submitCrossIntent(route: CrossJurisdictionSwapRoute, waitForTargetReady: boolean): Promise<void> {
	const adapter = requireAdapter();
	const deadline = Date.now() + 20_000;
	for (;;) {
		try {
			await adapter.submitCrossJurisdictionIntent(route);
			return;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!waitForTargetReady || !message.startsWith('CROSS_J_TARGET_INBOUND_NOT_READY:')) throw error;
			if (Date.now() >= deadline) throw new Error(`CROSS_J_TARGET_READINESS_TIMEOUT:${message}`, { cause: error });
			await sleep(100);
		}
	}
}

export async function submitSwapPlan(plan: SwapCommandPlan): Promise<void> {
	const adapter = requireAdapter();
	if (plan.mode === 'same') {
		if (plan.runtimeInput.entityInputs.some(input => (input.entityTxs ?? []).some(tx => tx.type !== 'placeSwapOffer'))) throw new Error('Prepare incoming capacity before placing the order.');
		await adapter.send(plan.runtimeInput);
		return;
	}
	if (plan.targetSetupInput) throw new Error('Prepare the target account capacity before swapping.');
	await submitCrossIntent(plan.crossJurisdictionIntent, false);
}
