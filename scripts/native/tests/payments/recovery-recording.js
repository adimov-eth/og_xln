async function runQuoteSession() {
  const { currentWallet, publish } = await import('/src/native/host.tsx');
  const { getEmbeddedEnv, requireAdapter } = await import('/src/runtime/adapter.ts');
  const { getXLN } = await import('/src/runtime/xln-loader.ts');
  const { recoverySigners, backupToTowers } = await import('/src/runtime/recovery.ts');
  const { hasLocalWalletData } = await import('/src/runtime/local-wallet-data.ts');
  const { nativeBackupAddress } = await import('/src/native/backup.ts');
  const { discoverTowerRestore, restoreFreshRuntime } = await import('/src/runtime/restore.ts');
  const { withRuntimeCommittedRead } = await import(window.xlnNativeWriterLockModule);
  const run = command => window.xlnNative.run(command);
  const entropy = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('');
  const wait = async (predicate, stage) => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try { if (await predicate()) return; }
      catch (error) { if (!String(error).includes('Wallet is still synchronizing.')) throw error; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`RECORDING_PAYMENT_TIMEOUT:${stage}`);
  };
  await run({ type: 'boot', entropy });
  await wait(() => currentWallet().accounts.length > 0, 'account');
  await run({ type: 'faucet', testCredit: true });
  const balance = () => currentWallet().totals.find(token => token.tokenId === 1)?.net;
  await wait(() => balance() === 100000000n, 'funding');
  const before = await run({ type: 'evidence' });
  const target = currentWallet().accounts.find(account => account.isHub && !account.disputed).counterpartyId;
  const quote = await run({ type: 'quotePayment', token: 1, amount: '1', recipient: target, decimalSeparator: '.' });
  await run({ type: 'confirm', id: quote.id });
  await wait(() => balance() === 99000000n, 'paid');
  await wait(() => currentWallet().accounts.every(account => !account.doc.pendingFrame && !account.doc.mempoolCount), 'settled');
  const evidence = await run({ type: 'evidence' });
  const payment = evidence.payments.filter(event => event.height > before.height && event.event === 'HtlcFinalized');
  if (payment.length !== 1) throw new Error('RECORDING_EXPECTED_ONE_FINALIZED_PAYMENT');
  const env = getEmbeddedEnv();
  const xln = await getXLN();
  const recording = await withRuntimeCommittedRead(env, () => xln.buildPersistedRuntimeRecording(env, {
    signers: recoverySigners(env, env.runtimeSeed),
  }));
  const tail = recording.bundles.find(bundle => bundle.kind === 'journal_tail');
  publish({ kind: 'progress', message: `RECORDING_RANGE ${JSON.stringify({ base: recording.baseHeight,
    target: recording.targetHeight, paymentHeight: payment[0].height, frames: tail?.frames.length ?? 0 })}` });
  if (!tail || recording.baseHeight >= payment[0].height || recording.targetHeight < payment[0].height)
    throw new Error('RECORDING_DOES_NOT_COVER_PAYMENT');
  // Detached, verified replay only. Never replace the live wallet database or
  // persist derived receipts as a substitute for canonical checkpoint + WAL.
  const restored = await xln.restoreEnvFromRecoveryBundles(
    recording.bundles.filter(bundle => bundle.kind !== 'journal_tail'),
    { runtimeSeed: env.runtimeSeed, runtimeId: env.runtimeId, readOnly: true },
  );
  const finalized = [];
  let verifiedFrames = 0;
  try {
    await xln.replayRecoveryFrameJournals(restored, tail.frames, {
      verify: true,
      onVerifiedFrame(frame, events) {
        verifiedFrames += 1;
        for (const event of events) {
          if (event.message === 'HtlcFinalized' &&
              (event.entityId ?? event.data?.entityId) === evidence.entityId)
            finalized.push({ height: frame.height, hashlock: event.data?.hashlock });
        }
      },
    });
    if (finalized.length !== 1 || finalized[0].hashlock !== payment[0].hashlock)
      throw new Error(`RECORDING_PAYMENT_EVENT_MISMATCH:${JSON.stringify(finalized)}`);
    if (restored.state.height !== recording.targetHeight || verifiedFrames !== tail.frames.length)
      throw new Error('RECORDING_TARGET_NOT_VERIFIED');
  } finally {
    const cleanup = await Promise.allSettled([xln.closeRuntimeDb(restored), xln.closeInfraDb(restored)]);
    const errors = cleanup.filter(result => result.status === 'rejected').map(result => result.reason);
    if (errors.length) throw new AggregateError(errors, 'RECORDING_DETACHED_CLEANUP_FAILED');
  }
  const [backup] = await backupToTowers(xln, env, env.runtimeSeed, [nativeBackupAddress()]);
  if (!backup.receipt || backup.error) throw new Error(backup.error || 'RECORDING_TOWER_RECEIPT_MISSING');
  const seed = env.runtimeSeed;
  const runtimeId = env.runtimeId;
  await run({ type: 'lock' });
  // This probe starts in its own non-persistent WKWebsiteDataStore. Delete
  // only this generated test wallet's databases; retain the signed archive
  // in memory, never copy a source DB or print the test signing secret.
  const eraseProbeWallet = async () => {
  const names = (await indexedDB.databases()).map(db => db.name).filter(name => name?.includes(runtimeId));
  if (!names.length) throw new Error('RECORDING_SOURCE_DATABASES_NOT_FOUND');
  for (const name of names) await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('RECORDING_SOURCE_DELETE_BLOCKED'));
  });
  if ((await indexedDB.databases()).some(db => db.name?.includes(runtimeId)))
    throw new Error('RECORDING_SOURCE_DATABASE_REMAINS');
  };
  await eraseProbeWallet();
  try {
    await xln.importRuntimeRecoveryRecording(recording, seed, {
      onPublicationBoundary: boundary => { if (boundary === 'before-publish') throw new Error('PROBE_IMPORT_INTERRUPTED'); },
    });
    throw new Error('PROBE_IMPORT_INTERRUPTION_NOT_REACHED');
  } catch (error) { if (!String(error).includes('PROBE_IMPORT_INTERRUPTED')) throw error; }
  if (await hasLocalWalletData(runtimeId)) throw new Error('EMPTY_IMPORT_CONTAINERS_MISCLASSIFIED');
  const candidate = await discoverTowerRestore(seed, nativeBackupAddress());
  if (candidate.runtimeHeight < recording.targetHeight) throw new Error('RECORDING_TOWER_TIP_BEHIND');
  const imported = await restoreFreshRuntime(xln, seed, candidate);
  await xln.closeRuntimeDb(imported);
  await xln.closeInfraDb(imported);
  if (!await hasLocalWalletData(runtimeId)) throw new Error('EXISTING_WALLET_MISCLASSIFIED');
  try {
    await discoverTowerRestore(seed, nativeBackupAddress());
    throw new Error('EXISTING_WALLET_RESTORE_ALLOWED');
  } catch (error) { if (!String(error).includes('This device already has data for this wallet.')) throw error; }
  const reopened = await xln.loadEnvFromDB(runtimeId, seed);
  if (!reopened || reopened.state.height !== candidate.runtimeHeight) throw new Error('RECORDING_IMPORT_REOPEN_MISSING');
  try {
    for (const frame of tail.frames) {
      const stored = await xln.readPersistedFrameJournal(reopened, frame.height);
      for (const key of ['replicaMetaDigest', 'postStateHash', 'runtimeOutputsDigest', 'runtimeOutputCount']) {
        if (!stored || stored[key] !== frame[key])
          throw new Error('RECORDING_IMPORTED_COMMITMENT_MISMATCH:' + frame.height + ':' + key);
      }
    }
    const activity = await xln.readPersistedRuntimeActivityPage(reopened, {
      entityId: evidence.entityId, types: ['htlc'], limit: 200, scanLimit: 1000,
    });
    const restoredPayments = activity.events.filter(event => event.rawType === 'HtlcFinalized' &&
      event.hash === payment[0].hashlock);
    if (restoredPayments.length !== 1) throw new Error('RECORDING_IMPORTED_HISTORY_MISMATCH:' + restoredPayments.length);
    publish({ kind: 'progress', message: 'RECORDING_PERSISTED_HISTORY ' + JSON.stringify({
      restoredPayments: restoredPayments.length, height: reopened.state.height, availability: activity.availability }) });
  } finally {
    await xln.closeRuntimeDb(reopened);
    await xln.closeInfraDb(reopened);
  }
  // Rejoin through the normal native boot, using only the imported durable wallet.
  await run({ type: 'boot', entropy });
  await wait(() => balance() === 99000000n, 'recovered-live-balance');
  const recoveredBefore = await run({ type: 'evidence' });
  if (recoveredBefore.history.availability !== 'partial' || recoveredBefore.history.unavailableThroughHeight !== recording.baseHeight)
    throw new Error('RECOVERED_EVIDENCE_HISTORY_BOUNDARY_MISMATCH');
  if (recoveredBefore.entityId !== evidence.entityId) throw new Error('RECOVERED_LIVE_IDENTITY_CHANGED');
  const newPayment = await run({ type: 'quotePayment', token: 1, amount: '1', recipient: target, decimalSeparator: '.' });
  await run({ type: 'confirm', id: newPayment.id });
  await wait(() => balance() === 98000000n, 'post-recovery-payment');
  await wait(() => currentWallet().accounts.every(account => !account.doc.pendingFrame && !account.doc.mempoolCount), 'post-recovery-settled');
  const paidAgain = await run({ type: 'evidence' });
  const newFinalized = paidAgain.payments.filter(event => event.height > recoveredBefore.height && event.event === 'HtlcFinalized');
  if (newFinalized.length !== 1 || newFinalized[0].hashlock === payment[0].hashlock)
    throw new Error('POST_RECOVERY_PAYMENT_RECEIPT_MISMATCH');
  const tokenBalance = id => currentWallet().totals.find(token => token.tokenId === id)?.net ?? 0n;
  let ticket;
  await wait(async () => {
    try { ticket = await run({ type: 'quoteSwap', token: 1, amount: '25', decimalSeparator: '.' }); return true; }
    catch (error) { if (/Waiting for|Market is unavailable|order book is not available/.test(String(error))) return false; throw error; }
  }, 'recovered-market');
  if (ticket.needsCapacity) ticket = await run({ type: 'quoteSwap', token: 1, amount: '25', decimalSeparator: '.', prepare: true, testCredit: true });
  if (!ticket.id || ticket.needsCapacity) throw new Error('POST_RECOVERY_SWAP_CAPACITY_MISSING');
  const submitted = await run({ type: 'confirm', id: ticket.id });
  await wait(() => tokenBalance(2) > 0n, 'post-recovery-swap');
  const swapPage = await requireAdapter().read('entity/' + evidence.entityId + '/account/' + submitted.accountId + '/swap-history', { limit: 25 });
  const order = swapPage.items.find(item => item.offerId === submitted.offerId);
  if (!order?.closed || order.resolves.length !== 1) throw new Error('POST_RECOVERY_SWAP_RECEIPT_MISSING');
  const fill = order.resolves[0];
  if (fill.executionGiveAmount <= 0n || fill.executionWantAmount <= 0n || fill.feeAmount === null || fill.feeTokenId !== 2)
    throw new Error('POST_RECOVERY_SWAP_EXECUTION_INVALID');
  const finalUSDC = 98000000n - fill.executionGiveAmount;
  const finalWETH = fill.executionWantAmount - fill.feeAmount;
  if (tokenBalance(1) !== finalUSDC || tokenBalance(2) !== finalWETH) throw new Error('POST_RECOVERY_SWAP_BALANCE_MISMATCH');
  await run({ type: 'lock' });
  await run({ type: 'boot', entropy });
  await wait(() => tokenBalance(1) === finalUSDC && tokenBalance(2) === finalWETH, 'post-recovery-reopened-balances');
  const reopenedEvidence = await run({ type: 'evidence' });
  for (const hashlock of [payment[0].hashlock, newFinalized[0].hashlock]) {
    if (reopenedEvidence.payments.filter(event => event.event === 'HtlcFinalized' && event.hashlock === hashlock).length !== 1)
      throw new Error('POST_RECOVERY_PAYMENT_HISTORY_DUPLICATED_OR_LOST');
  }
  const reopenedSwaps = await requireAdapter().read('entity/' + evidence.entityId + '/account/' + submitted.accountId + '/swap-history', { limit: 25 });
  const reopenedOrder = reopenedSwaps.items.find(item => item.offerId === submitted.offerId);
  if (!reopenedOrder?.closed || reopenedOrder.resolves.length !== 1 ||
      reopenedOrder.resolves[0].executionGiveAmount !== fill.executionGiveAmount ||
      reopenedOrder.resolves[0].executionWantAmount !== fill.executionWantAmount ||
      reopenedOrder.resolves[0].feeAmount !== fill.feeAmount) throw new Error('POST_RECOVERY_SWAP_HISTORY_MISMATCH');
  const [swapBackup] = await backupToTowers(xln, getEmbeddedEnv(), seed, [nativeBackupAddress()]);
  if (!swapBackup.receipt || swapBackup.error) throw new Error(swapBackup.error || 'POST_SWAP_TOWER_BACKUP_MISSING');
  await run({ type: 'lock' });
  await eraseProbeWallet();
  const swapCandidate = await discoverTowerRestore(seed, nativeBackupAddress());
  if (swapCandidate.runtimeHeight < swapBackup.receipt.height) throw new Error('POST_SWAP_TOWER_TIP_BEHIND');
  const swapImported = await restoreFreshRuntime(xln, seed, swapCandidate);
  await xln.closeRuntimeDb(swapImported);
  await xln.closeInfraDb(swapImported);
  await run({ type: 'boot', entropy });
  await wait(() => tokenBalance(1) === finalUSDC && tokenBalance(2) === finalWETH, 'post-swap-fresh-balances');
  const freshEvidence = await run({ type: 'evidence' });
  for (const hashlock of [payment[0].hashlock, newFinalized[0].hashlock]) {
    if (freshEvidence.payments.filter(event => event.event === 'HtlcFinalized' && event.hashlock === hashlock).length !== 1)
      throw new Error('POST_SWAP_FRESH_PAYMENT_HISTORY_MISMATCH');
  }
  const freshSwaps = await requireAdapter().read('entity/' + evidence.entityId + '/account/' + submitted.accountId + '/swap-history', { limit: 25 });
  const freshOrder = freshSwaps.items.find(item => item.offerId === submitted.offerId);
  if (!freshOrder?.closed || freshOrder.resolves.length !== 1 ||
      freshOrder.resolves[0].executionGiveAmount !== fill.executionGiveAmount ||
      freshOrder.resolves[0].executionWantAmount !== fill.executionWantAmount ||
      freshOrder.resolves[0].feeAmount !== fill.feeAmount) throw new Error('POST_SWAP_FRESH_EXECUTION_HISTORY_MISMATCH');
  await run({ type: 'lock' });
  const postRecovery = { newPayment: true, swap: true, reopen: true, swapArchiveFreshRestore: true, interruptedImportRetry: true, existingWalletProtected: true, paymentReceipts: 2, swapExecutions: 1,
    usdc: finalUSDC.toString(), weth: finalWETH.toString(), gave: fill.executionGiveAmount.toString(),
    received: fill.executionWantAmount.toString(), fee: fill.feeAmount.toString(), offerId: submitted.offerId };
  return JSON.stringify({ verifiedFrames, baseHeight: recording.baseHeight, targetHeight: recording.targetHeight,
    finalized, postRecovery, senderBalance: '99000000', atomicImportAndReopen: true, towerTransfer: true, restoredHeight: candidate.runtimeHeight,
    scope: 'Real local payment; tower restore, new native payment and swap, exact balances and receipts after reopening' });
}
