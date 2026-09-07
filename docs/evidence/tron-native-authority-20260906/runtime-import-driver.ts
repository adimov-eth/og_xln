export async function runtimeImport() {
  const root = '/tmp/xln-tron-native-20260905';
  const runtimeRoot = process.env['XLN_NATIVE_IMPORT_ROOT'];
  if (!runtimeRoot) throw new Error('NATIVE_IMPORT_ROOT_MISSING');
  const reportRoot=process.env['XLN_NATIVE_EVIDENCE_DIR']??runtimeRoot;
  const restoreOnly=process.argv.includes('--resume-native-import');
  const graph = await Bun.file(`${root}/deployed-graph.json`).json();
  const economic = await Bun.file(`${root}/economic.json`).json();
  const target = economic.withdrawal.withdrawn;
  if(target.blockNumber!==59||target.txHash!=='0xa4b0e02a998da111e34f71750f76c9bf8f723eb7b7604fc6dd548561d2d9f63b')throw new Error('NATIVE_IMPORT_GOVERNANCE_PAYOUT_BINDING');
  const seed = (await Bun.file(`${runtimeRoot}/runtime.seed`).text()).trim();
  const { main, enqueueRuntimeInput, processRuntime, startJurisdictionWatchers, closeRuntimeDb, closeInfraDb } = await import('/Users/zigota/xln/core/runtime.ts');
  const { getLiveJAdapter } = await import('/Users/zigota/xln/core/runtime/j-submit/live-jadapters.ts');
  const { safeStringify } = await import('/Users/zigota/xln/core/protocol/serialization/index.ts');
  const env = await main(seed);
  let adapter;
  try {
    if(!restoreOnly)enqueueRuntimeInput(env, { runtimeTxs: [{ type:'importJ', data:{
      name:'Native TVM', chainId:graph.chainId, ticker:'TRX', rpcs:[graph.chain.defaultRpc],
      blockTimeMs:3000, entityProviderDeploymentBlock:graph.entityProviderDeploymentBlock,
      contracts:Object.fromEntries(['account','depository','entityProvider','deltaTransformer'].map(key=>[key,graph.contracts[key]])),
    }}], entityInputs:[] });
    const deadline = Date.now()+30000;
    while (Date.now()<deadline) {
      await processRuntime(env);
      adapter = getLiveJAdapter(env,'Native TVM');
      if(adapter) break;
      await Bun.sleep(50);
    }
    if(!adapter) throw new Error('NATIVE_RUNTIME_IMPORT_TIMEOUT');
    if(adapter.mode!=='tron')throw new Error(`NATIVE_RUNTIME_WRONG_ADAPTER:${adapter.mode}`);
    startJurisdictionWatchers(env);
    if(!adapter.isWatching())throw new Error('NATIVE_RUNTIME_WATCHER_NOT_STARTED');
    while (Date.now()<deadline) {
      await adapter.pollNow();
      await processRuntime(env);
      const authority=[...(env.infrastructure?.certifiedRegistrationEvidence?.values()??[])];
      if(authority.some(item=>item.source==='FoundationBootstrapped'&&item.observedThroughHeight>=target.blockNumber)&&
        authority.some(item=>item.source==='EntityRegistered'&&item.activationHeight===49))break;
      await Bun.sleep(100);
    }
    const jurisdiction = env.state.jReplicas.get('Native TVM');
    if(!jurisdiction)throw new Error('NATIVE_RUNTIME_JURISDICTION_MISSING');
    if(jurisdiction.watcherReceiptCommitment!=='tron-rpc-attested')throw new Error('NATIVE_RUNTIME_AUTHORITY_POLICY_MISSING');
    const authorityEvidence=[...(env.infrastructure?.certifiedRegistrationEvidence?.values()??[])];
    const foundation=authorityEvidence.find(evidence=>evidence.source==='FoundationBootstrapped');
    if(!foundation||foundation.receiptKind!=='tron-rpc-attested')throw new Error('NATIVE_RUNTIME_FOUNDATION_AUTHORITY_MISSING');
    if(foundation.observedThroughHeight<target.blockNumber)throw new Error('NATIVE_RUNTIME_AUTHORITY_RANGE_INCOMPLETE');
    if(foundation.chainId!==graph.chainId||Object.hasOwn(foundation,'receiptsRoot'))throw new Error('NATIVE_RUNTIME_FALSE_AUTHORITY_PROOF');
    const {assertCertifiedRegistrationEvidenceStore}=await import('/Users/zigota/xln/core/jurisdiction/machine/registration-evidence/index.ts');
    await assertCertifiedRegistrationEvidenceStore(env);
    const {computeRegistrationEvidenceHash}=await import('/Users/zigota/xln/core/jurisdiction/machine/registration-evidence/index.ts');
    let restoredEvidenceHashes;
    if(restoreOnly){
      const previous=await Bun.file(`${runtimeRoot}/committed-authority.json`).json();
      const expected=previous.evidence.map(computeRegistrationEvidenceHash);
      restoredEvidenceHashes=authorityEvidence.map(computeRegistrationEvidenceHash);
      if(JSON.stringify(expected)!==JSON.stringify(restoredEvidenceHashes))throw new Error('NATIVE_RESTORED_AUTHORITY_CHANGED');
    }
    const record={kind:'NATIVE_RUNTIME_IMPORT_WATCHER',mode:adapter.mode,chainId:adapter.chainId,
      runtimeHeight:env.state.height,jurisdictionHeight:jurisdiction.blockNumber,receiptHeight:target.blockNumber,
      receiptHash:target.txHash,runtimeId:env.runtimeId,dbRoot:runtimeRoot,
      authorityEvidence,watcherReceiptCommitment:jurisdiction.watcherReceiptCommitment,
      restoreOnly,...(restoredEvidenceHashes?{restoredEvidenceHashes}:{}),
      note:restoreOnly?'Same production WAL restored; native watcher started through canonical host lifecycle, signed authority unchanged. No Entity financial transition or cross-J claim.':'Production Runtime import/observer only; no Entity financial transition or cross-J claim'};
    await Bun.write(`${reportRoot}/runtime-import.json`,safeStringify(record));
    console.log(safeStringify(record));
  } finally {
    if(adapter)await adapter.close();
    await closeRuntimeDb(env);
    await closeInfraDb(env);
  }
}
