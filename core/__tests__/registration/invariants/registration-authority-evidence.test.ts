import { describe, expect, test } from 'bun:test';
import { ethers } from 'ethers';
import { EntityProvider__factory } from '../../../../jurisdictions/typechain-types';

import {
  deriveSignerAddressSync,
  deriveSignerKeySync,
  registerSignerKey,
  signAccountFrame,
} from '../../../account/crypto';
import { encodeBoard, hashBoard } from '../../../entity/factory';
import {
  assertCertifiedRegistrationEvidence,
  assertCertifiedRegistrationEvidenceStore,
  buildRegistrationEvidenceDigest,
  buildCertifiedRegistrationEvidence,
  markLocalJAuthorityRuntimeTx,
  computeRegistrationEvidenceHash,
  computeRegistrationEvidenceClaimHash,
} from '../../../jurisdiction/machine/registration-evidence';
import { applyRuntimeTx } from '../../../runtime/tx/tx-handlers';
import { createEmptyEnv, importEntity } from '../../../runtime';
import { buildCertifiedEntityHeadPlan } from '../../../storage/replica/entity-head';
import type { EntityReplica, JurisdictionConfig } from '../../../entity/types';
import type { RuntimeReplica } from '../../../runtime/types';
import type { JReplica } from '../../../types/jurisdiction-runtime';
import {
  buildDurableRuntimeMachineSnapshot,
  restoreDurableRuntimeSnapshot,
} from '../../../storage/wal/snapshot';
import { addr, makeState } from '../../helpers/cross-j';
import { installCanonicalRegistrationEvidence } from '../../helpers/registration-evidence';
import { computeRuntimePostStateComponentDigests } from '../../../storage/hashes';
import { validateRuntimeTx } from '../../../runtime/decode/runtime-tx';

const jurisdiction: JurisdictionConfig = {
  name: 'registration-authority',
  address: 'http://127.0.0.1:8545',
  chainId: 31_337,
  depositoryAddress: addr('d1'),
  entityProviderAddress: addr('e1'),
  registrationBlock: 5,
};
const entityId = `0x${'00'.repeat(31)}02`;

const installStack = (env: RuntimeReplica, depth = 2): void => {
  const replica: JReplica = {
    name: jurisdiction.name,
    blockNumber: 7n,
    stateRoot: null,
    mempool: [],
    blockDelayMs: 300,
    lastBlockTimestamp: 0,
    position: { x: 0, y: 50, z: 0 },
    chainId: jurisdiction.chainId,
    contracts: {
      depository: jurisdiction.depositoryAddress,
      entityProvider: jurisdiction.entityProviderAddress,
    },
    watcherConfirmationDepth: depth,
  };
  env.state.jReplicas.set(jurisdiction.name, replica);
};

const makeRegisteredRuntime = (seed: string): {
  env: RuntimeReplica;
  replica: EntityReplica;
  boardHash: string;
} => {
  const env = createEmptyEnv(seed);
  env.scenarioMode = true;
  env.quietRuntimeLogs = true;
  registerSignerKey(env, env.runtimeId!, deriveSignerKeySync(seed, '1'));
  installStack(env);
  const signerId = deriveSignerAddressSync(seed, '2').toLowerCase();
  registerSignerKey(env, signerId, deriveSignerKeySync(seed, '2'));
  const state = makeState(entityId, signerId, jurisdiction);
  state.height = 0;
  state.timestamp = 0;
  const boardHash = hashBoard(encodeBoard(state.config, env)).toLowerCase();
  const replica: EntityReplica = {
    entityId,
    signerId,
    state,
    mempool: [],
    isProposer: true,
  };
  env.state.eReplicas.set(`${entityId}:${signerId}`, replica);
  return { env, replica, boardHash };
};

const resign = <T extends { witnessSignature: string }>(env: RuntimeReplica, evidence: T): T => {
  evidence.witnessSignature = signAccountFrame(
    env,
    env.runtimeId!,
    buildRegistrationEvidenceDigest(evidence as never),
  ).toLowerCase();
  return evidence;
};

const makeNumberedImport = (seed: string) => {
  const { env, replica, boardHash } = makeRegisteredRuntime(seed);
  env.state.eReplicas.clear();
  const tx = importEntity({
    entityId,
    signerId: replica.signerId,
    entitySeed: seed,
    data: { config: replica.state.config, isProposer: true },
  });
  return { env, tx, boardHash, replicaKey: `${entityId}:${replica.signerId}` };
};

const nativeFoundation = () => {
    const { env, boardHash } = makeRegisteredRuntime('native-foundation-rpc-attestation');
    const replica = env.state.jReplicas.get(jurisdiction.name)!;
    replica.watcherReceiptCommitment = 'tron-rpc-attested';
    replica.watcherConfirmationDepth = 0;
    replica.rpcs = ['http://127.0.0.1:18545/'];
    const iface = EntityProvider__factory.createInterface();
    const encoded = iface.encodeEventLog(iface.getEvent('FoundationBootstrapped'), [
      env.runtimeId!, boardHash, 2n, 3n,
    ]);
    const blockHash = `0x${'25'.repeat(32)}`;
    const log = {
      address: jurisdiction.entityProviderAddress,
      topics: encoded.topics, data: encoded.data, blockNumber: 25, blockHash,
      transactionHash: `0x${'45'.repeat(32)}`, transactionIndex: 0, index: 3,
      nativeRpcAttestation: {
        chainId: jurisdiction.chainId,
        rpcEndpointHash: ethers.keccak256(ethers.toUtf8Bytes(replica.rpcs![0]!)),
        finality: 'tron-solidified' as const, transactionIndex: 0, receiptLogIndex: 3,
      },
    };
    const evidence = buildCertifiedRegistrationEvidence(env, replica, 'FoundationBootstrapped', log, {
      observedThroughHeight: 25, observedTipBlockHash: blockHash, observedHeadHeight: 26, confirmationDepth: 0,
    });
    if (evidence.receiptKind !== 'tron-rpc-attested') throw new Error('NATIVE_EVIDENCE_KIND_MISSING');
    return { env, evidence };
};

describe('validator-local registered H0 authority evidence', () => {
  test('native RPC-attested FoundationBootstrapped does not require an invented receipt MPT', async () => {
    const { env, evidence } = nativeFoundation();
    await expect(assertCertifiedRegistrationEvidence(env, evidence)).resolves.toBeUndefined();
    expect(evidence).toMatchObject({ receiptKind: 'tron-rpc-attested', finality: 'tron-solidified' });
    expect(Object.hasOwn(evidence, 'receiptsRoot')).toBe(false);
  });

  test('native RPC policy survives committed snapshot recovery and rejects EVM proof downgrade', async () => {
    const { env, evidence } = nativeFoundation();
    const tx = { type: 'recordAuthenticatedJAuthority' as const, data: evidence };
    expect(validateRuntimeTx(tx, 'NATIVE_AUTHORITY')).toEqual(tx);
    await applyRuntimeTx(env, markLocalJAuthorityRuntimeTx(tx));
    const snapshot = buildDurableRuntimeMachineSnapshot(env);
    const restored = createEmptyEnv('native-foundation-rpc-attestation');
    restoreDurableRuntimeSnapshot(restored, snapshot);
    const local = restored.state.jReplicas.get(jurisdiction.name)!;
    expect(local.watcherReceiptCommitment).toBe('tron-rpc-attested');
    await expect(assertCertifiedRegistrationEvidenceStore(restored)).resolves.toBeUndefined();
    const before = computeRuntimePostStateComponentDigests(snapshot).find(row => row.key === 'jReplicas');
    delete local.watcherReceiptCommitment;
    const changed = computeRuntimePostStateComponentDigests(buildDurableRuntimeMachineSnapshot(restored))
      .find(row => row.key === 'jReplicas');
    expect(changed).not.toEqual(before);
    await expect(assertCertifiedRegistrationEvidenceStore(restored))
      .rejects.toThrow('J_AUTHORITY_RECEIPT_COMMITMENT_MISMATCH');
  });

  test('native RPC attestation rejects wrong source, chain, board, unsafe finality and witness', async () => {
    const { env, evidence } = nativeFoundation();
    const wrongSource = resign(env, { ...evidence, rpcEndpointHash: `0x${'88'.repeat(32)}` });
    await expect(assertCertifiedRegistrationEvidence(env, wrongSource)).rejects.toThrow('J_AUTHORITY_NATIVE_RPC_NOT_CONFIGURED');
    const wrongChain = resign(env, { ...evidence, chainId: evidence.chainId + 1 });
    await expect(assertCertifiedRegistrationEvidence(env, wrongChain)).rejects.toThrow('J_AUTHORITY_NATIVE_CHAIN_MISMATCH');
    const wrongBoard = resign(env, { ...evidence, boardHash: `0x${'99'.repeat(32)}` });
    await expect(assertCertifiedRegistrationEvidence(env, wrongBoard)).rejects.toThrow('J_AUTHORITY_EVENT_BODY_MISMATCH');
    const unsafe = resign(env, { ...evidence, observedThroughHeight: 24 });
    await expect(assertCertifiedRegistrationEvidence(env, unsafe)).rejects.toThrow('J_AUTHORITY_FINALITY_INSUFFICIENT');
    await expect(assertCertifiedRegistrationEvidence(env, { ...evidence, witnessSignature: `0x${'00'.repeat(65)}` }))
      .rejects.toThrow('J_AUTHORITY_WITNESS_SIGNATURE_INVALID');
    expect(() => validateRuntimeTx({ type: 'recordAuthenticatedJAuthority', data: { ...evidence, receiptsRoot: `0x${'11'.repeat(32)}` } }, 'NATIVE_AUTHORITY'))
      .toThrow('NATIVE_AUTHORITY');
  });

  test('native same-event observations from two configured RPCs are idempotent but an unconfigured RPC rejects', async () => {
    const { env, evidence } = nativeFoundation();
    const secondRpc = 'https://native-reader.example/';
    env.state.jReplicas.get(jurisdiction.name)!.rpcs!.push(secondRpc);
    const second = resign(env, { ...evidence, rpcEndpointHash: ethers.keccak256(ethers.toUtf8Bytes(secondRpc)) });
    expect(computeRegistrationEvidenceClaimHash(second)).toBe(computeRegistrationEvidenceClaimHash(evidence));
    expect(computeRegistrationEvidenceHash(second)).not.toBe(computeRegistrationEvidenceHash(evidence));
    await applyRuntimeTx(env, markLocalJAuthorityRuntimeTx({ type: 'recordAuthenticatedJAuthority', data: evidence }));
    await applyRuntimeTx(env, markLocalJAuthorityRuntimeTx({ type: 'recordAuthenticatedJAuthority', data: second }));
    const stored = [...env.infrastructure!.certifiedRegistrationEvidence!.values()];
    expect(stored).toHaveLength(1);
    expect(computeRegistrationEvidenceHash(stored[0]!)).toBe(computeRegistrationEvidenceHash(evidence));
    const unknown = resign(env, { ...evidence, rpcEndpointHash: `0x${'78'.repeat(32)}` });
    expect(computeRegistrationEvidenceClaimHash(unknown)).toBe(computeRegistrationEvidenceClaimHash(evidence));
    await expect(applyRuntimeTx(env, markLocalJAuthorityRuntimeTx({ type: 'recordAuthenticatedJAuthority', data: unknown })))
      .rejects.toThrow('J_AUTHORITY_NATIVE_RPC_NOT_CONFIGURED');
  });

  test('importReplica rejects numbered H0 without local authenticated receipt evidence', async () => {
    const { env, tx } = makeNumberedImport('registration-authority-missing');
    await expect(applyRuntimeTx(env, tx))
      .rejects.toThrow('NUMBERED_REPLICA_REGISTRATION_EVIDENCE_MISSING');
    expect(env.state.eReplicas.size).toBe(0);
  });

  test('importReplica admits receipt-MPT-bound H0 and rejects a different board before mutation', async () => {
    const { env, tx, boardHash, replicaKey } = makeNumberedImport('registration-authority-valid');
    const before = computeRuntimePostStateComponentDigests(buildDurableRuntimeMachineSnapshot(env));
    const evidence = await installCanonicalRegistrationEvidence(
      env,
      jurisdiction,
      entityId,
      boardHash,
    );
    const afterEvidence = computeRuntimePostStateComponentDigests(buildDurableRuntimeMachineSnapshot(env));
    expect(afterEvidence.find(row => row.key === 'infrastructure'))
      .not.toEqual(before.find(row => row.key === 'infrastructure'));
    const wrongBoard = structuredClone(tx);
    wrongBoard.data.config.shares[tx.signerId] = 2n;
    await expect(applyRuntimeTx(env, wrongBoard))
      .rejects.toThrow('NUMBERED_REPLICA_REGISTRATION_BOARD_MISMATCH');
    expect(env.state.eReplicas.size).toBe(0);
    await applyRuntimeTx(env, tx);
    const plan = buildCertifiedEntityHeadPlan(env);
    expect(env.state.eReplicas.get(replicaKey)?.state.height).toBe(0);
    expect(plan.headByReplicaKey.has(replicaKey)).toBe(true);
    expect(plan.headByReplicaKey.get(replicaKey)).toBeUndefined();
    const stored = [...env.infrastructure!.certifiedRegistrationEvidence!.values()];
    expect(stored.map(computeRegistrationEvidenceHash)).toEqual([computeRegistrationEvidenceHash(evidence)]);
    await expect(assertCertifiedRegistrationEvidenceStore(env)).resolves.toBeUndefined();
  });

  test('rejects external authority/history RuntimeTx ingress', async () => {
    const { env, boardHash } = makeRegisteredRuntime('registration-authority-ingress');
    const evidence = await installCanonicalRegistrationEvidence(
      env,
      jurisdiction,
      entityId,
      boardHash,
    );
    await expect(applyRuntimeTx(env, {
      type: 'recordAuthenticatedJAuthority',
      data: structuredClone(evidence),
    })).rejects.toThrow('J_AUTHORITY_RUNTIME_TX_EXTERNAL_INGRESS_REJECTED');
    await expect(applyRuntimeTx(env, {
      type: 'observeJRange',
      data: {
        entityId,
        signerId: env.state.eReplicas.values().next().value!.signerId,
        jurisdictionRef: `0x${'11'.repeat(32)}`,
        scannedThroughHeight: 5,
        tipBlockHash: `0x${'22'.repeat(32)}`,
        blocks: [],
      },
    })).rejects.toThrow('J_AUTHORITY_RUNTIME_TX_EXTERNAL_INGRESS_REJECTED');
  });

  test('rejects witness, proof, finality-policy, and safe-scan tampering', async () => {
    const { env, boardHash } = makeRegisteredRuntime('registration-authority-tamper');
    const evidence = await installCanonicalRegistrationEvidence(
      env,
      jurisdiction,
      entityId,
      boardHash,
    );

    const badWitness = structuredClone(evidence);
    badWitness.witnessSignature = `0x${'00'.repeat(65)}`;
    await expect(assertCertifiedRegistrationEvidence(env, badWitness))
      .rejects.toThrow('J_AUTHORITY_WITNESS_SIGNATURE_INVALID');

    const badProof = structuredClone(evidence);
    badProof.encodedReceipt = `${badProof.encodedReceipt.slice(0, -2)}00`;
    resign(env, badProof);
    await expect(assertCertifiedRegistrationEvidence(env, badProof))
      .rejects.toThrow('J_RECEIPT_PROOF_VALUE_MISMATCH');

    const badPolicy = structuredClone(evidence);
    badPolicy.confirmationDepth = 0;
    resign(env, badPolicy);
    await expect(assertCertifiedRegistrationEvidence(env, badPolicy))
      .rejects.toThrow('J_AUTHORITY_FINALITY_POLICY_MISMATCH');

    const unsafeScan = structuredClone(evidence);
    unsafeScan.observedThroughHeight = unsafeScan.observedHeadHeight;
    resign(env, unsafeScan);
    await expect(assertCertifiedRegistrationEvidence(env, unsafeScan))
      .rejects.toThrow('J_AUTHORITY_FINALITY_INSUFFICIENT');
  });

  test('restored receipt-MPT evidence is re-verified before numbered H0 import', async () => {
    const { env, tx, boardHash, replicaKey } = makeNumberedImport('registration-authority-restore');
    const evidence = await installCanonicalRegistrationEvidence(
      env,
      jurisdiction,
      entityId,
      boardHash,
    );
    const snapshot = buildDurableRuntimeMachineSnapshot(env);
    const restored = createEmptyEnv('registration-authority-restore');
    restored.scenarioMode = true;
    restoreDurableRuntimeSnapshot(restored, snapshot);
    await expect(assertCertifiedRegistrationEvidenceStore(restored)).resolves.toBeUndefined();
    const stored = restored.infrastructure!.certifiedRegistrationEvidence!.values().next().value!;
    expect(computeRegistrationEvidenceHash(stored)).toBe(computeRegistrationEvidenceHash(evidence));
    await applyRuntimeTx(restored, tx);
    expect(restored.state.eReplicas.get(replicaKey)?.state.height).toBe(0);
    expect(buildCertifiedEntityHeadPlan(restored).headByReplicaKey.get(replicaKey)).toBeUndefined();
    expect(() => { stored.boardHash = `0x${'44'.repeat(32)}`; }).toThrow();
  });
});
