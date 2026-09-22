async function runQuoteSession() {
// Runs in real WebKit with the production native host and NativeSockets.swift.
// The harness uses isolated ephemeral storage and newly generated local test keys.
const { currentWallet, publish } = await import('/src/native/host.tsx');
const run = command => window.xlnNative.run(command);
const entropy = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('');
const wait = async (predicate, stage = 'wallet-ready') => {
  const deadline = Date.now() + 15000;
  while (true) {
    try { if (predicate()) return; }
    catch (error) { if (String(error) !== 'Error: Wallet is still synchronizing.') throw error; }
    if (Date.now() > deadline) {
      const { useApp } = await import('/src/runtime/store.ts');
      const { adapterStatus, height, commandReady, booting, toasts } = useApp.getState();
      const { getAdapter, getEmbeddedEnv } = await import('/src/runtime/adapter.ts');
      const infrastructure = getEmbeddedEnv()?.infrastructure;
      const readinessReason = getAdapter()?.commandReadyReason;
      const lifecyclePhase = infrastructure?.lifecyclePhase;
      const fatal = infrastructure?.fatalDebugPayload;
      throw new Error('PROJECTION_TIMEOUT:' + JSON.stringify({stage, adapterStatus, height, commandReady, readinessReason, lifecyclePhase, fatal, booting, toasts}));
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};
const rejected = async (command, expected) => {
  try { await run(command); }
  catch (error) {
    if (!String(error).includes(expected)) throw error;
    return;
  }
  throw new Error(`EXPECTED_REJECTION:${command.type}:${expected}`);
};
const balance = () => currentWallet().totals.find(t => t.tokenId === 1)?.net;
const boot = async () => {
  await run({type: 'boot', entropy});
  await wait(() => currentWallet().accounts.length > 0);
};
await boot();
await run({type: 'faucet', testCredit: true});
await wait(() => balance() === 100000000n, 'balance-100');
const target = currentWallet().accounts.find(a => a.isHub && !a.disputed).counterpartyId;
const quote = () => run({type: 'quotePayment', token: 1, amount: '1', recipient: target, decimalSeparator: '.'});
const results = [];
for (const transition of ['lock', 'boot', 'brainvault']) {
  const old = await quote();
  if (transition === 'lock') await run({type: 'lock'});
  if (transition === 'boot') await rejected({type: 'boot', entropy: ''}, 'INVALID_WALLET_ENTROPY');
  if (transition === 'brainvault') await rejected({type: 'brainvault', name: null, password: '', factor: 1}, 'Enter');
  await boot();
  if (Date.now() >= old.expiresAt) throw new Error('TEST_INVALID_QUOTE_ALREADY_EXPIRED');
  await rejected({type: 'confirm', id: old.id}, 'Quote expired.');
  await wait(() => balance() === 100000000n, 'balance-100');
  results.push({transition, staleQuoteRejected: true, unexpired: true, balance: balance().toString()});
  publish({kind: 'progress', message: 'QUOTE_SESSION_CHECK ' + JSON.stringify(results.at(-1))});
}
const fresh = await quote();
const response = await run({type: 'confirm', id: fresh.id});
if (response.message !== 'Payment submitted. Waiting for the confirmed receipt.') throw new Error('FRESH_QUOTE_NOT_SUBMITTED');
await rejected({type: 'confirm', id: fresh.id}, 'Quote expired.');
await wait(() => balance() === 99000000n);
results.push({freshQuoteConfirmed: true, duplicateRejected: true, balance: balance().toString()});
await run({type: 'lock'});
return JSON.stringify({passed: results.length, results});
}
