import { getXLN } from './xln-loader';
import { connectEmbedded, getEmbeddedEnv, requireAdapter } from './adapter';
import { deriveAddress, derivePrivateKeyBytes } from './keys';
import { readJson } from './http';
import { getTokenMeta } from './format';
import { DEFAULT_ACCOUNT_DISPUTE_CONFIG, waitFor } from './tx';
import type { EntityTx, RuntimeReplica } from '@xln/core/api/public/runtime-module';
import { HDNodeWallet } from 'ethers';
import { useApp, type VaultKind } from './store';

/**
 * The stack this page is served from. Identical resolution to the SvelteKit
 * wallet (`vault-bootstrap.ts` + `vaultStore.restore`): `/api/jurisdictions`
 * names the chains and their contracts, `/api/hubs` names the hubs, `/relay`
 * is the socket. Locally that is the `bun run dev` orchestrator, in production
 * xln.finance; a static host without an API leaves only the offline sandbox.
 */
export type StackJurisdiction = {
	key: string;
	name: string;
	chainId: number;
	rpcUrl: string;
	blockTimeMs: number;
	entityProviderDeploymentBlock: number;
	contracts: { account: string; depository: string; entityProvider: string; deltaTransformer: string };
};
export type StackHub = { entityId: string; name: string; online: boolean };
/** `jurisdiction` is the primary (the entity's home chain); `jurisdictions` lists every active chain, primary first. */
export type Stack = { apiBase: string; relayUrl: string; jurisdiction: StackJurisdiction; jurisdictions: StackJurisdiction[]; hubs: StackHub[] };

const USDC = 1;
const HUB_CREDIT_LINE_USD = 10_000n;

/** Blocks the watcher's scan may trail the chain head and still count as caught up. */
const CHAIN_SCAN_TOLERANCE_BLOCKS = 5;

/**
 * Wait until the J watcher has scanned history up to the chain head. A fresh wallet replays every
 * block since the deployment in 256-block ranges; the entity's certified height only advances inside
 * an entity frame, so the frames the boot sends next (profile, account) carry the whole gap at once.
 * Payments derive their deadlines from that certified height: sent before the catch-up they are
 * rejected as "revealBeforeHeight already passed" (core finding #20).
 */
async function waitForChainScan(xln: Awaited<ReturnType<typeof getXLN>>, env: RuntimeReplica, entityId: string, signerId: string, timeoutMs: number): Promise<void> {
	const jadapter = xln.getEntityJAdapter(env, entityId, signerId);
	if (!jadapter) return;
	const readHead = async (): Promise<number> => Number(await (jadapter.getCurrentBlockNumber?.() ?? jadapter.provider.getBlockNumber()));
	const scanned = (): number => {
		const replica = findReplicaState(env, entityId) as { jHistory?: { scannedThroughHeight?: number }; state?: { lastFinalizedJHeight?: number } } | undefined;
		return Math.max(Number(replica?.jHistory?.scannedThroughHeight ?? 0), Number(replica?.state?.lastFinalizedJHeight ?? 0));
	};
	let head = await readHead();
	let headReadAt = Date.now();
	const startedAt = Date.now();
	try {
		await waitFor(
			async () => {
				if (Date.now() - headReadAt > 2_000) {
					head = await readHead();
					headReadAt = Date.now();
				}
				return scanned() + CHAIN_SCAN_TOLERANCE_BLOCKS >= head;
			},
			'chain scan',
			timeoutMs,
			250,
		);
	} finally {
		console.info('[hosted] chain scan', { scanned: scanned(), head, elapsedMs: Date.now() - startedAt });
	}
}

export function findReplicaState(env: RuntimeReplica, entityId: string) {
	for (const [key, replica] of env.state.eReplicas?.entries?.() ?? []) {
		const keyEntityId = String(key).split(':')[0] ?? '';
		if (keyEntityId.toLowerCase() === entityId.toLowerCase()) return replica;
	}
	return undefined;
}

export function accountReady(env: RuntimeReplica, entityId: string, counterpartyId: string): boolean {
	return Boolean(findReplicaState(env, entityId)?.state?.accounts?.get?.(counterpartyId));
}

export async function sendEntity(entityId: string, signerId: string, entityTxs: EntityTx[]): Promise<void> {
	await requireAdapter().send({ runtimeTxs: [], entityInputs: [{ entityId, signerId, entityTxs }] });
}

/** "Learn xln": a throwaway phrase on the live network. The user can keep it afterwards. */
export async function bootLearnVault(stack: Stack, onStep?: (step: string) => void): Promise<void> {
	const phrase = HDNodeWallet.createRandom().mnemonic?.phrase;
	if (!phrase) throw new Error('MNEMONIC_GENERATION_FAILED');
	await bootHostedVault(phrase, { vaultId: `tour-${Date.now().toString(36)}`, vaultName: 'Tour wallet', kind: 'mnemonic', selfLabel: 'Alice', stack, ...(onStep ? { onStep } : {}) });
}
declare const __XLN_STACK_ORIGIN__: string;
/** Same origin as the API (proxied in dev), except a TLS stack the dev server cannot WebSocket-proxy. */
const socketOrigin = (apiBase: string): string =>
	typeof __XLN_STACK_ORIGIN__ === 'string' && __XLN_STACK_ORIGIN__.startsWith('https:') ? __XLN_STACK_ORIGIN__ : apiBase;

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

/** `/rpc` on the API host, or an absolute RPC URL as published. */
export const resolveRpcUrl = (rpc: string, apiBase: string): string => (rpc.startsWith('/') ? new URL(rpc, apiBase).toString() : rpc);

export const relayUrlFor = (apiBase: string): string => {
	const url = new URL(apiBase);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	url.pathname = '/relay';
	url.search = '';
	return url.toString();
};

function pickJurisdictions(payload: Record<string, unknown>, apiBase: string): StackJurisdiction[] {
	const entries = Object.entries(asRecord(payload['jurisdictions']));
	const usable = entries.flatMap(([key, raw]) => {
		const config = asRecord(raw);
		const contracts = asRecord(config['contracts']);
		const rpc = String(config['rpc'] || (Array.isArray(config['rpcs']) ? config['rpcs'][0] : '') || '');
		const status = String(config['status'] || 'active').toLowerCase();
		const deploymentBlock = Number(config['entityProviderDeploymentBlock']);
		if (status !== 'active' || !contracts['depository'] || !contracts['entityProvider'] || !rpc) return [];
		if (!Number.isSafeInteger(deploymentBlock) || deploymentBlock < 1) return [];
		return [
			{
				key,
				primary: config['primary'] === true,
				jurisdiction: {
					key,
					name: String(config['name'] || key),
					chainId: Math.floor(Number(config['chainId'] || 31337)),
					rpcUrl: resolveRpcUrl(rpc, apiBase),
					blockTimeMs: Math.floor(Number(config['blockTimeMs'] || 10_000)),
					entityProviderDeploymentBlock: deploymentBlock,
					contracts: {
						account: String(contracts['account'] || ''),
						depository: String(contracts['depository']),
						entityProvider: String(contracts['entityProvider']),
						deltaTransformer: String(contracts['deltaTransformer'] || ''),
					},
				} satisfies StackJurisdiction,
			},
		];
	});
	const primary = usable.find(entry => entry.primary) ?? usable[0];
	return primary ? [primary.jurisdiction, ...usable.filter(entry => entry !== primary).map(entry => entry.jurisdiction)] : [];
}

async function fetchApi(apiBase: string, path: string): Promise<Record<string, unknown>> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 8_000);
	try {
		const response = await fetch(new URL(`${path}?ts=${Date.now()}`, apiBase), { cache: 'no-store', signal: controller.signal });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return await readJson(response);
	} finally {
		clearTimeout(timer);
	}
}

/** Null when this origin serves no xln API: the wallet then offers only the offline sandbox. */
export async function detectStack(apiBase: string = window.location.origin): Promise<Stack | null> {
	let jurisdictions: StackJurisdiction[];
	try {
		jurisdictions = pickJurisdictions(await fetchApi(apiBase, '/api/jurisdictions'), apiBase);
	} catch {
		return null;
	}
	const jurisdiction = jurisdictions[0];
	if (!jurisdiction) return null;
	let hubs: StackHub[] = [];
	try {
		const payload = await fetchApi(apiBase, '/api/hubs');
		hubs = (Array.isArray(payload['hubs']) ? payload['hubs'] : [])
			.map(raw => asRecord(raw))
			.filter(hub => typeof hub['entityId'] === 'string')
			.map(hub => ({ entityId: String(hub['entityId']).toLowerCase(), name: String(hub['name'] || 'Hub'), online: hub['online'] !== false }))
			.sort((left, right) => Number(right.online) - Number(left.online));
	} catch {
		hubs = [];
	}
	return { apiBase, relayUrl: relayUrlFor(socketOrigin(apiBase)), jurisdiction, jurisdictions, hubs };
}

export type HostedVaultOptions = {
	vaultId: string;
	vaultName: string;
	kind: VaultKind;
	selfLabel: string;
	stack: Stack;
	onStep?: (step: string) => void;
};

/**
 * Boot a personal runtime against the stack: import its jurisdiction over RPC,
 * create the entity, join the relay, publish a profile and open an account with
 * the first hub. Idempotent on a restored runtime. The hub answers over the
 * network, so the account may still be pending when Home opens.
 */
export async function bootHostedVault(seed: string, options: HostedVaultOptions): Promise<void> {
	const { stack } = options;
	const step = (text: string): void => options.onStep?.(text);
	useApp.getState().setBooting(true);
	try {
		step('Starting your runtime');
		const xln = await getXLN();
		await connectEmbedded(seed);
		const env = getEmbeddedEnv();
		if (!env) throw new Error('EMBEDDED_ENV_MISSING');
		const adapter = requireAdapter();
		const signerId = deriveAddress(seed, 0);
		xln.registerSignerKey(env, signerId, derivePrivateKeyBytes(seed, 0));
		const entityId = String(xln.generateLazyEntityId([signerId], 1n)).toLowerCase();
		const j = stack.jurisdiction;

		// Every chain the stack runs: the entity lives on the primary, swaps may cross into the others.
		for (const chain of stack.jurisdictions) {
			step(`Joining ${chain.name}`);
			const ready = (): boolean => Boolean(env.state.jReplicas?.get?.(chain.name)?.contracts?.depository);
			if (ready()) continue;
			await adapter.send({
				runtimeTxs: [
					{
						type: 'importJ',
						data: {
							name: chain.name,
							chainId: chain.chainId,
							ticker: 'USDC',
							rpcs: [chain.rpcUrl],
							entityProviderDeploymentBlock: chain.entityProviderDeploymentBlock,
							blockTimeMs: chain.blockTimeMs,
							contracts: chain.contracts,
						},
					},
				],
				entityInputs: [],
			});
			await waitFor(ready, `importJ ${chain.name}`, 45_000);
		}

		step('Creating your entity');
		if (!findReplicaState(env, entityId)) {
			await adapter.send({
				runtimeTxs: [
					xln.importEntity({
						entityId,
						signerId,
						entitySeed: seed,
						data: {
							isProposer: true,
							profileName: options.selfLabel,
							config: {
								mode: 'proposer-based',
								threshold: 1n,
								validators: [signerId],
								shares: { [signerId]: 1n },
								jurisdiction: {
									address: `jreplica://${j.name}`,
									name: j.name,
									chainId: j.chainId,
									blockTimeMs: j.blockTimeMs,
									entityProviderAddress: j.contracts.entityProvider,
									depositoryAddress: j.contracts.depository,
								},
							},
						},
					}),
				],
				entityInputs: [],
			});
			await waitFor(() => Boolean(findReplicaState(env, entityId)), 'importReplica self', 45_000);
		}
		step('Syncing with the chain');
		try {
			await waitForChainScan(xln, env, entityId, signerId, 60_000);
		} catch {
			useApp.getState().toast('Still syncing with the chain; payments may be refused until it catches up.');
		}


		step('Connecting to the network');
		if (!xln.getP2P(env)) {
			xln.startP2P(env, { signerId: String(env.runtimeId), relayUrls: [stack.relayUrl], gossipPollMs: 2_000 });
		}
		// An output to a peer whose key is unknown halts the runtime (findings #16); never send one blind.
		const connected = (): boolean => Boolean(xln.getP2P(env)?.isConnected?.());
		let online = true;
		try {
			await waitFor(connected, 'relay connection', 20_000);
		} catch {
			online = false;
			useApp.getState().toast('The network relay is not reachable; your account with the hub opens when it is.', 'danger');
		}

		step('Publishing your profile');
		if (String(findReplicaState(env, entityId)?.state?.profile?.name || '') !== options.selfLabel) {
			await sendEntity(entityId, signerId, [
				{ type: 'profile-update', data: { profile: { entityId, name: options.selfLabel, bio: '', website: '' } } },
			]);
		}

		const hub = stack.hubs.find(entry => entry.online) ?? stack.hubs[0];
		if (hub && online && !accountReady(env, entityId, hub.entityId)) {
			step(`Opening an account with ${hub.name}`);
			await xln.ensureGossipProfiles(env, [hub.entityId]);
			await sendEntity(entityId, signerId, [
				{
					type: 'openAccount',
					// Our credit line to the hub: what it may owe us, so it can pay us (faucet, incoming payments) without
					// touching the chain. Same default as the SvelteKit onboarding's soft limit.
					data: { targetEntityId: hub.entityId, creditAmount: HUB_CREDIT_LINE_USD * 10n ** BigInt(getTokenMeta(USDC).decimals), tokenId: USDC, disputeConfig: DEFAULT_ACCOUNT_DISPUTE_CONFIG },
				},
			]);
			try {
				await waitFor(() => accountReady(env, entityId, hub.entityId), `account with ${hub.name}`, 60_000);
			} catch {
				useApp.getState().toast(`${hub.name} has not answered yet; the account opens when it does.`);
			}
		}

		step('Ready');
		const app = useApp.getState();
		app.setActiveEntityId(entityId);
		app.setActiveVault(options.vaultId);
		if (!app.vaults.some(v => v.id === options.vaultId)) {
			app.addVault({ id: options.vaultId, name: options.vaultName, kind: options.kind, createdAt: Date.now() });
		}
		app.unlockSeed(options.vaultId, seed);
	} finally {
		useApp.getState().setBooting(false);
	}
}
