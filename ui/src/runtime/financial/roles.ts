import type { Profile, RuntimeAdapterEntitySummary } from '@xln/core/api/public/runtime-module';
import type { AccountDisputeConfig, AccountRoleEvidence } from '@xln/core/account/config/dispute-config';
import { defaultAccountDisputeConfigForRoleEvidence } from '@xln/core/account/config/dispute-config';

import { getEmbeddedEnv } from '../adapter';

const normalizeId = (value: unknown): string => String(value || '').trim().toLowerCase();

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

export function gossipProfile(entityId: string): Profile | null {
	const env = getEmbeddedEnv();
	const profile = env?.gossip?.getProfile?.(normalizeId(entityId));
	return profile ?? null;
}

export function hubIsHub(hubEntityId: string, summaries: readonly RuntimeAdapterEntitySummary[]): boolean {
	const gossip = gossipProfile(hubEntityId);
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

/**
 * The counterparty's advertised role, when we do not host it. A verified gossip
 * profile is the authority; a summary the runtime built from one carries the
 * same bit and is the only source available in remote mode. `null` means the
 * network has told us nothing, which is not the same as "not a hub".
 */
function advertisedRole(entityId: string, summaries: readonly RuntimeAdapterEntitySummary[]): boolean | null {
	const profile = gossipProfile(entityId);
	if (profile) return profile.metadata?.isHub === true;
	const summary = summaries.find(entry => normalizeId(entry.entityId) === entityId);
	return typeof summary?.isHub === 'boolean' ? summary.isHub : null;
}

/**
 * Role evidence for an arbitrary account pair, hub or not. Our own side is a
 * replica we host, so its role is committed; the counterparty's comes from a
 * committed replica when we host it too, otherwise from its verified gossip
 * profile. There is deliberately no second path: the response clocks this derives
 * are signed into the Account at creation and can never be renegotiated, so a
 * role we cannot establish must refuse the command rather than guess a window.
 */
export function accountRoleEvidence(input: {
	entityId: string;
	counterpartyId: string;
	summaries: readonly RuntimeAdapterEntitySummary[];
}): {
	roles: Map<string, boolean>;
	entityRoleEvidence: AccountRoleEvidence;
	counterpartyRoleEvidence: AccountRoleEvidence;
} {
	const entityId = normalizeId(input.entityId);
	const counterpartyId = normalizeId(input.counterpartyId);
	const roles = committedRoles(input.summaries);
	const entityIsHub = roles.get(entityId);
	if (!entityId || typeof entityIsHub !== 'boolean') throw new Error(`ACCOUNT_OWN_ROLE_UNAVAILABLE:${entityId}`);
	const committedCounterparty = roles.get(counterpartyId);
	const counterpartyIsHub = typeof committedCounterparty === 'boolean' ? committedCounterparty : advertisedRole(counterpartyId, input.summaries);
	if (!counterpartyId || counterpartyIsHub === null) {
		throw new Error(`ACCOUNT_PARTY_ROLE_UNAVAILABLE:${entityId}:${counterpartyId}`);
	}
	return {
		roles,
		entityRoleEvidence: { entityId, isHub: entityIsHub, source: 'committed-profile' },
		counterpartyRoleEvidence: {
			entityId: counterpartyId,
			isHub: counterpartyIsHub,
			source: typeof committedCounterparty === 'boolean' ? 'committed-profile' : 'verified-gossip-profile',
		},
	};
}

/**
 * The bilateral response window an `openAccount` must carry. A hub answers in
 * an hour and a user in a day, so the pair is asymmetric whenever the roles
 * are: applying the user default to both sides hands a hub 24× the window the
 * protocol grants it.
 */
export function accountDisputeConfig(input: {
	entityId: string;
	counterpartyId: string;
	summaries: readonly RuntimeAdapterEntitySummary[];
}): AccountDisputeConfig {
	const evidence = accountRoleEvidence(input);
	return defaultAccountDisputeConfigForRoleEvidence(
		evidence.entityRoleEvidence,
		evidence.counterpartyRoleEvidence,
		evidence.roles,
	);
}
