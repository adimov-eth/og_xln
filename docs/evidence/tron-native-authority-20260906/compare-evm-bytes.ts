import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { createEmptyEnv } from '/Users/zigota/xln/core/runtime.ts';
import { deriveSignerKeySync, registerSignerKey } from '/Users/zigota/xln/core/account/crypto.ts';
import { installCanonicalRegistrationEvidence } from '/Users/zigota/xln/core/__tests__/helpers/registration-evidence.ts';
import { encodeCanonicalConsensusBytes } from '/Users/zigota/xln/core/protocol/serialization/binary-codec.ts';
import * as current from '/Users/zigota/xln/core/jurisdiction/machine/registration-evidence/index.ts';
import { buildCanonicalJReplicaSnapshot } from '/Users/zigota/xln/core/storage/wal/snapshot.ts';
import * as previous from './before-registration.ts';
import { buildCanonicalJReplicaSnapshot as previousSnapshot } from './before-snapshot.ts';

const root='/tmp/xln-tron-native-evm-byte-comparison-20260906';
const seed='native-policy-evm-byte-comparison-public-test-vector';
const env=createEmptyEnv(seed);
env.scenarioMode=true;
env.quietRuntimeLogs=true;
registerSignerKey(env,env.runtimeId!,deriveSignerKeySync(seed,'1'));
const jurisdiction={name:'evm-unchanged',address:'http://127.0.0.1:8545',chainId:31337,
  depositoryAddress:`0x${'d1'.repeat(20)}`,entityProviderAddress:`0x${'e1'.repeat(20)}`};
const replica={name:jurisdiction.name,blockNumber:7n,stateRoot:null,mempool:[],blockDelayMs:300,
  lastBlockTimestamp:0,position:{x:0,y:50,z:0},chainId:jurisdiction.chainId,
  rpcs:[jurisdiction.address],contracts:{depository:jurisdiction.depositoryAddress,
    entityProvider:jurisdiction.entityProviderAddress},watcherConfirmationDepth:2};
env.state.jReplicas.set(jurisdiction.name,replica);
const results=[];
for(const source of ['FoundationBootstrapped','EntityRegistered'] as const){
  const evidence=await installCanonicalRegistrationEvidence(env,jurisdiction,
    `0x${'00'.repeat(31)}02`,`0x${'19'.repeat(32)}`,{source});
  const log={address:evidence.emitter,topics:evidence.topics,data:evidence.data,
    blockNumber:evidence.activationHeight,blockHash:evidence.blockHash,
    transactionHash:evidence.transactionHash,transactionIndex:evidence.transactionIndex,
    logIndex:evidence.logIndex,index:evidence.logIndex,
    receiptProof:{transactionIndex:evidence.transactionIndex,receiptsRoot:evidence.receiptsRoot,
      encodedReceipt:evidence.encodedReceipt,proofNodes:evidence.receiptProofNodes,
      receiptLogIndex:evidence.receiptLogIndex}};
  const old=previous.buildCertifiedRegistrationEvidence(env,replica,source,log,{
    observedThroughHeight:evidence.observedThroughHeight,observedTipBlockHash:evidence.observedTipBlockHash,
    observedHeadHeight:evidence.observedHeadHeight,confirmationDepth:evidence.confirmationDepth});
  const bytes=encodeCanonicalConsensusBytes(evidence);
  assert.deepEqual(bytes,encodeCanonicalConsensusBytes(old));
  await previous.assertCertifiedRegistrationEvidence(env,evidence);
  await current.assertCertifiedRegistrationEvidence(env,old);
  for(const fn of ['buildRegistrationEvidenceDigest','computeRegistrationEvidenceHash',
    'computeRegistrationEvidenceClaimHash'] as const) assert.equal(current[fn](evidence),previous[fn](old));
  results.push({source,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
    evidenceHash:current.computeRegistrationEvidenceHash(evidence),
    claimHash:current.computeRegistrationEvidenceClaimHash(evidence),exact:true});
}
const snapshot=encodeCanonicalConsensusBytes(buildCanonicalJReplicaSnapshot(replica));
assert.deepEqual(snapshot,encodeCanonicalConsensusBytes(previousSnapshot(replica)));
const result={kind:'IMMUTABLE_HEAD_CURRENT_EVM_BYTE_COMPARISON',
  reference:await Bun.file(`${root}/reference.json`).json(),vectors:results,
  jSnapshot:{bytes:snapshot.length,sha256:createHash('sha256').update(snapshot).digest('hex'),exact:true}};
await Bun.write(`${root}/result.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
