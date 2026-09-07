import { strict as assert } from 'node:assert';
import { Level } from '/Users/zigota/xln/node_modules/level/index.js';
import { readStorageHead, readStorageFrameRecord } from '/Users/zigota/xln/core/storage/read/read.ts';
import { computeRegistrationEvidenceHash, computeRegistrationEvidenceClaimHash } from '/Users/zigota/xln/core/jurisdiction/machine/registration-evidence/index.ts';
import { safeStringify } from '/Users/zigota/xln/core/protocol/serialization/index.ts';
const root='/tmp/xln-tron-native-authority-r5-20260906';
const db=new Level(`${root}/wal-read-copy`,{keyEncoding:'binary',valueEncoding:'buffer'});
try {
  const head=await readStorageHead(db);
  const frame=await readStorageFrameRecord(db,4);
  assert(frame);
  const txs=frame.runtimeInput.runtimeTxs??[];
  assert.equal(txs.length,2);
  assert(txs.every(tx=>tx.type==='recordAuthenticatedJAuthority'));
  const evidence=txs.map(tx=>tx.data);
  assert.deepEqual(evidence.map(e=>e.source),['FoundationBootstrapped','EntityRegistered']);
  const original=(await Bun.file('/tmp/xln-tron-native-authority-r3-20260906/committed-authority.json').json()).evidence;
  assert(evidence.every(e=>e.receiptKind==='tron-rpc-attested'&&e.observedThroughHeight===68));
  assert.deepEqual(evidence.map(computeRegistrationEvidenceClaimHash),original.map(computeRegistrationEvidenceClaimHash));
  assert(evidence.every((e,i)=>computeRegistrationEvidenceHash(e)!==computeRegistrationEvidenceHash(original[i])));
  const log=await Bun.file(`${root}/run.log`).text();
  const failures=log.split('\n').filter(line=>/j_watch_error|j_watch_fatal|watcher\.fatal|watcher\.already_halted|\[ERROR\]/.test(line));
  assert.deepEqual(failures,[]);
  const result={kind:'NATIVE_RESTORED_WATCHER_ACCEPTED_POLL',head,frameHeight:frame.height,
    frameHash:frame.frameHash,postStateHash:frame.postStateHash,runtimeTxKinds:txs.map(tx=>tx.type),
    entityInputCount:frame.runtimeInput.entityInputs?.length??0,evidence,watcherErrorCount:failures.length,
    pollCompletion:'await adapter.pollNow resolved before processRuntime; both fresh observations accepted in WAL h4',
    sameClaims:true,freshObservationEvidence:true,originalEvidencePreserved:true};
  await Bun.write(`${root}/accepted-poll.json`,safeStringify(result));
  console.log(safeStringify({kind:result.kind,frameHeight:4,runtimeTxKinds:result.runtimeTxKinds,
    observedThroughHeight:evidence.map(e=>e.observedThroughHeight),watcherErrorCount:0,sameClaims:true}));
} finally {await db.close();}
