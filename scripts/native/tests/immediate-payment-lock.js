async function runQuoteSession() {
  const { currentWallet, publish } = await import('/src/native/host.tsx');
  const { getEmbeddedEnv } = await import('/src/runtime/adapter.ts');
  const run = command => window.xlnNative.run(command);
  const entropy = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('');
  const wait = async (predicate, stage) => {
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      try { if (predicate()) return; }
      catch (error) { if (!String(error).includes('Wallet is still synchronizing.')) throw error; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('IMMEDIATE_LOCK_TIMEOUT:' + stage);
  };
  const balance = () => currentWallet().totals.find(token => token.tokenId === 1)?.net;
  await run({ type: 'boot', entropy });
  await wait(() => currentWallet().accounts.length > 0, 'account');
  await run({ type: 'faucet', testCredit: true });
  await wait(() => balance() === 100000000n, 'funding');
  const before = await run({ type: 'evidence' });
  const target = currentWallet().accounts.find(account => account.isHub && !account.disputed).counterpartyId;
  const ticket = await run({ type: 'quotePayment', token: 1, amount: '1', recipient: target, decimalSeparator: '.' });
  const env = getEmbeddedEnv();
  // Optional live fault harness: pause the actual hub process, never substitute
  // financial replies or runtime behavior. The harness always resumes its PID.
  const peerPause = window.xlnNativePeerPauseUrl
    ? await fetch(window.xlnNativePeerPauseUrl, { method: 'POST' }).then(response => {
      if (!response.ok) throw new Error('PEER_PAUSE_FAILED:' + response.status);
      return response.json();
    }) : null;
  const submittedAt = Date.now();
  await run({ type: 'confirm', id: ticket.id });
  const atLock = {
    processing: Boolean(env.infrastructure.processingPromise),
    queuedInputs: env.runtimeMempool.entityInputs.length,
    pendingOutputs: (env.pendingOutputs?.length ?? 0) + (env.pendingNetworkOutputs?.length ?? 0),
    consensusPending: [...env.state.eReplicas.values()].some(replica =>
      replica.mempool.length > 0 || replica.proposal || replica.lockedFrame ||
      [...replica.state.accounts.values()].some(account => account.pendingFrame || account.mempool.length > 0)),
  };
  const pendingAtLock = atLock.processing || atLock.queuedInputs > 0 || atLock.pendingOutputs > 0 || atLock.consensusPending;
  if (!pendingAtLock) throw new Error('IMMEDIATE_LOCK_DID_NOT_EXERCISE_PENDING_WORK');
  // No balance/receipt wait: exercise closing while the bilateral payment is in flight.
  await run({ type: 'lock' });
  const lockedAfterMs = Date.now() - submittedAt;
  if (peerPause && lockedAfterMs < peerPause.pauseMs - 100)
    throw new Error('LOCK_RETURNED_BEFORE_PEER_REPLY:' + lockedAfterMs);
  if (env.runtimeSeed !== undefined || getEmbeddedEnv() !== null) throw new Error('LOCK_RETAINED_SIGNING_SESSION');
  publish({ kind: 'progress', message: 'IMMEDIATE_LOCK_COMPLETED' });
  await run({ type: 'boot', entropy });
  await wait(() => balance() === 99000000n, 'recovered-payment');
  await wait(() => currentWallet().accounts.every(account => !account.doc.pendingFrame && !account.doc.mempoolCount), 'drained-account');
  const after = await run({ type: 'evidence' });
  if (after.entityId !== before.entityId) throw new Error('LOCK_RECOVERY_CHANGED_IDENTITY');
  const receipts = after.payments.filter(receipt => receipt.height > before.height);
  const initiated = receipts.filter(receipt => receipt.event === 'HtlcInitiated');
  const finalized = receipts.filter(receipt => receipt.event === 'HtlcFinalized');
  if (initiated.length !== 1 || finalized.length !== 1 || initiated[0].hashlock !== finalized[0].hashlock)
    throw new Error('RECOVERED_PAYMENT_RECEIPTS_MISMATCH:' + JSON.stringify(receipts));
  await run({ type: 'lock' });
  return JSON.stringify({ passed: 3, lockedImmediately: true, pendingAtLock, atLock, peerPause, lockedAfterMs, recoveredBalance: '99000000',
    sameIdentity: true, exactSinglePaymentReceipt: true, receipts, accounts: after.accounts });
}
