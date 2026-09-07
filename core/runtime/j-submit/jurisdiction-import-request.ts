import { ethers } from 'ethers';
import type { JurisdictionImportRequest, JurisdictionImportResult } from '../types';

const ZERO_ADDRESS = ethers.ZeroAddress.toLowerCase();

export const normalizeJurisdictionImportAddress = (value: unknown, label: string): string => {
  let normalized: string;
  try {
    normalized = ethers.getAddress(String(value ?? '')).toLowerCase();
  } catch {
    throw new Error(`IMPORT_J_${label}_ADDRESS_INVALID:${String(value ?? '')}`);
  }
  if (normalized === ZERO_ADDRESS) throw new Error(`IMPORT_J_${label}_ADDRESS_ZERO`);
  return normalized;
};

export const normalizeJurisdictionImportContracts = (
  contracts: JurisdictionImportRequest['contracts'],
  required: boolean,
): JurisdictionImportResult['contracts'] | undefined => {
  if (!contracts) {
    if (required) throw new Error('IMPORT_J_RPC_CONTRACTS_REQUIRED');
    return undefined;
  }
  const missing = [
    !contracts.depository ? 'depository' : null,
    !contracts.entityProvider ? 'entityProvider' : null,
    !contracts.account ? 'account' : null,
    !contracts.deltaTransformer ? 'deltaTransformer' : null,
  ].filter((value): value is string => value !== null);
  if (missing.length > 0) {
    throw new Error(`IMPORT_J_CONTRACTS_INCOMPLETE:${missing.join(',')}`);
  }
  return {
    depository: normalizeJurisdictionImportAddress(contracts.depository, 'DEPOSITORY'),
    entityProvider: normalizeJurisdictionImportAddress(contracts.entityProvider, 'ENTITY_PROVIDER'),
    account: normalizeJurisdictionImportAddress(contracts.account, 'ACCOUNT'),
    deltaTransformer: normalizeJurisdictionImportAddress(contracts.deltaTransformer, 'DELTA_TRANSFORMER'),
  };
};

export const normalizeJurisdictionImportRequest = (
  raw: JurisdictionImportRequest,
): JurisdictionImportRequest => {
  const name = String(raw.name ?? '').trim();
  const ticker = String(raw.ticker ?? '').trim().toUpperCase();
  const chainId = Number(raw.chainId);
  if (!name || name.length > 128) throw new Error('IMPORT_J_NAME_INVALID');
  if (!ticker || ticker.length > 16) throw new Error('IMPORT_J_TICKER_INVALID');
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error(`IMPORT_J_CHAIN_ID_INVALID:${String(raw.chainId)}`);
  }
  if (!Array.isArray(raw.rpcs)) throw new Error('IMPORT_J_RPCS_INVALID');
  const rpcs = raw.rpcs.map((value, index) => {
    const rpc = String(value ?? '').trim();
    if (!rpc) throw new Error(`IMPORT_J_RPC_INVALID:${index}`);
    let url: URL;
    try {
      url = new URL(rpc);
    } catch {
      throw new Error(`IMPORT_J_RPC_INVALID:${index}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`IMPORT_J_RPC_PROTOCOL_INVALID:${index}:${url.protocol}`);
    }
    return url.toString();
  });
  if (new Set(rpcs).size !== rpcs.length) throw new Error('IMPORT_J_RPC_DUPLICATED');
  if (rpcs.length > 8) throw new Error(`IMPORT_J_RPC_LIMIT_EXCEEDED:${rpcs.length}`);
  const isBrowserVM = rpcs.length === 0;
  const contracts = normalizeJurisdictionImportContracts(raw.contracts, !isBrowserVM);
  const entityProviderDeploymentBlock = Number(raw.entityProviderDeploymentBlock);
  if (!isBrowserVM && raw.entityProviderDeploymentBlock === undefined) {
    throw new Error('IMPORT_J_ENTITY_PROVIDER_DEPLOYMENT_BLOCK_REQUIRED');
  }
  if (
    raw.entityProviderDeploymentBlock !== undefined &&
    (!Number.isSafeInteger(entityProviderDeploymentBlock) || entityProviderDeploymentBlock < 1)
  ) {
    throw new Error(
      `IMPORT_J_ENTITY_PROVIDER_DEPLOYMENT_BLOCK_INVALID:${String(raw.entityProviderDeploymentBlock)}`,
    );
  }
  if (isBrowserVM && raw.entityProviderDeploymentBlock !== undefined) {
    throw new Error('IMPORT_J_BROWSERVM_DEPLOYMENT_BLOCK_UNEXPECTED');
  }
  if ((raw.tokens?.length ?? 0) > 0) throw new Error('IMPORT_J_CUSTOM_TOKENS_UNSUPPORTED');
  if (
    raw.blockTimeMs !== undefined &&
    (!Number.isSafeInteger(raw.blockTimeMs) || raw.blockTimeMs <= 0)
  ) throw new Error(`IMPORT_J_BLOCK_TIME_INVALID:${String(raw.blockTimeMs)}`);
  if (raw.startAtCurrentBlock !== undefined && typeof raw.startAtCurrentBlock !== 'boolean') {
    throw new Error('IMPORT_J_START_AT_CURRENT_BLOCK_INVALID');
  }
  if (raw.rpcPolicy !== undefined) {
    if (raw.rpcPolicy === 'failover') {
      throw new Error('IMPORT_J_RPC_POLICY_UNSUPPORTED:failover');
    }
    if (
      typeof raw.rpcPolicy === 'object' &&
      raw.rpcPolicy !== null &&
      raw.rpcPolicy.mode === 'quorum' &&
      Number.isSafeInteger(raw.rpcPolicy.min) &&
      raw.rpcPolicy.min > 0 &&
      raw.rpcPolicy.min <= rpcs.length
    ) {
      throw new Error('IMPORT_J_RPC_POLICY_UNSUPPORTED:quorum');
    }
    if (raw.rpcPolicy !== 'single' && (
      !raw.rpcPolicy ||
      raw.rpcPolicy.mode !== 'quorum' ||
      !Number.isSafeInteger(raw.rpcPolicy.min) ||
      raw.rpcPolicy.min <= 0 ||
      raw.rpcPolicy.min > rpcs.length
    )) {
      throw new Error('IMPORT_J_RPC_POLICY_INVALID');
    }
    if (raw.rpcPolicy === 'single' && rpcs.length !== 1) {
      throw new Error(`IMPORT_J_RPC_POLICY_SINGLE_REQUIRES_ONE_RPC:${rpcs.length}`);
    }
  }
  if (rpcs.length > 1) throw new Error(`IMPORT_J_MULTIPLE_RPCS_UNSUPPORTED:${rpcs.length}`);
  return {
    name,
    chainId,
    ticker,
    rpcs,
    ...(!isBrowserVM ? { entityProviderDeploymentBlock } : {}),
    ...(raw.blockTimeMs !== undefined ? { blockTimeMs: raw.blockTimeMs } : {}),
    ...(raw.startAtCurrentBlock !== undefined
      ? { startAtCurrentBlock: raw.startAtCurrentBlock }
      : {}),
    ...(raw.rpcPolicy !== undefined ? { rpcPolicy: structuredClone(raw.rpcPolicy) } : {}),
    ...(contracts ? { contracts } : {}),
  };
};

