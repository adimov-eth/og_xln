import { getJurisdictionIdentityRef } from '../../../jurisdiction/machine/jurisdiction-runtime';
import { requireBoundaryRecord } from '../../../protocol/boundary-validation';
import { selectPredeployedJurisdiction } from './predeployed-jurisdiction';

const bindingForKey = (payload: unknown, rpcUrl: string, key: string) => {
  const selected = selectPredeployedJurisdiction(payload, rpcUrl, key);
  if (!selected) throw new Error('PREDEPLOYED_JURISDICTION_CONFIG_MISSING');
  const jurisdictionRef = getJurisdictionIdentityRef(selected);
  if (!jurisdictionRef) throw new Error('PREDEPLOYED_JURISDICTION_IDENTITY_MISSING');
  return { jurisdictionRef, rpcUrl };
};

export const buildPredeployedRestoreRpcBindings = (
  payload: unknown,
  primaryRpc: string,
  preferredKey: string,
  configuredRpcs: Readonly<Record<number, string | undefined>>,
): Array<{ jurisdictionRef: string; rpcUrl: string }> => {
  const bindings = [bindingForKey(payload, primaryRpc, preferredKey)];
  const catalog = requireBoundaryRecord(payload, 'PREDEPLOYED_JURISDICTION_CONFIG_INVALID');
  const entries = Object.entries(requireBoundaryRecord(catalog['jurisdictions'], 'PREDEPLOYED_JURISDICTIONS_INVALID'));
  // Operator RPC slots replace transport only. The deployed chain+Depository
  // identifies the restored replica; matching by display name would rebind
  // an unrelated stack and omit Custody's second committed jurisdiction.
  for (const [slot, rawRpc] of Object.entries(configuredRpcs)) {
    const rpcUrl = rawRpc?.trim();
    if (!rpcUrl) continue;
    if (!/^[2-8]$/.test(slot)) throw new Error(`PREDEPLOYED_RESTORE_RPC_SLOT_INVALID:${slot}`);
    const matches = entries.filter(([, entry]) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
      const rpc = Reflect.get(entry, 'rpc');
      return typeof rpc === 'string' && /^\/(?:api\/)?rpc([2-8])(?:\?.*)?$/.exec(rpc.trim())?.[1] === slot;
    });
    if (matches.length > 1) throw new Error(`PREDEPLOYED_RESTORE_RPC_SLOT_AMBIGUOUS:${slot}`);
    const match = matches[0];
    if (!match) throw new Error(`PREDEPLOYED_RESTORE_RPC_SLOT_MISSING:${slot}`);
    bindings.push(bindingForKey(payload, rpcUrl, match[0]));
  }
  return bindings;
};
