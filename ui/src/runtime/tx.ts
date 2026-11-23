import { sendRuntimeInput } from './commands';
import type { EntityTx, RuntimeInput } from '@xln/core/api/public/runtime-module';
import type { RuntimeAdapterSendResult } from '@xln/core/api/runtime-adapter/types';
import { getEmbeddedEnv } from './adapter';

export function buildEntityInput(entityId: string, signerId: string, entityTxs: EntityTx[]): RuntimeInput {
	return {
		runtimeTxs: [],
		entityInputs: [{ entityId, signerId, entityTxs }],
	};
}

export async function sendEntityTxs(
	entityId: string,
	signerId: string,
	entityTxs: EntityTx[],
): Promise<RuntimeAdapterSendResult> {
	return sendRuntimeInput(buildEntityInput(entityId, signerId, entityTxs));
}

/** Why the embedded Runtime stopped, in the user's words; null while it runs. */
export function haltedRuntimeMessage(): string | null {
	const state = getEmbeddedEnv()?.infrastructure;
	if (!state?.halted) return null;
	const cause = state.fatalDebugPayload?.message ?? 'HALTED_REQUIRES_OPERATOR';
	return /DUPLICATE_RUNTIME_CONNECTION|DIRECT_DUPLICATE_RUNTIME_SESSION/.test(cause)
		? 'This wallet is already open elsewhere. Close the other wallet before reopening here.'
		: `Wallet stopped. Reopen it before continuing. (${cause})`;
}

export async function waitFor(
	predicate: () => boolean | Promise<boolean>,
	label: string,
	timeoutMs = 30_000,
	pollMs = 60,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const halted = haltedRuntimeMessage();
		if (halted) throw new Error(halted);
		if (await predicate()) return;
		if (Date.now() > deadline) throw new Error(`TIMEOUT: ${label}`);
		await new Promise(resolve => setTimeout(resolve, pollMs));
	}
}
