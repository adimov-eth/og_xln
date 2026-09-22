async function runQuoteSession() {
  const { currentWallet } = await import('/src/native/host.tsx');
  const { requireAdapter } = await import('/src/runtime/adapter.ts');
  const run = command => window.xlnNative.run(command);
  const entropy = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('');
  const wait = async (predicate, stage) => {
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      try { if (await predicate()) return; }
      catch (error) { if (!String(error).includes('Wallet is still synchronizing.')) throw error; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('SWAP_PROOF_TIMEOUT:' + stage);
  };
  const balance = id => currentWallet().totals.find(token => token.tokenId === id)?.net ?? 0n;
  await run({ type: 'boot', entropy });
  await wait(() => currentWallet().accounts.length > 0, 'account');
  await run({ type: 'faucet', testCredit: true });
  await wait(() => balance(1) === 100000000n, 'funding');
  const quote = amount => run({ type: 'quoteSwap', token: 1, amount, decimalSeparator: '.' });
  // Wait for the real relay policy; unknown limits must never become zero.
  await wait(async () => {
    try { await quote('1'); }
    catch (error) {
      if (String(error).includes('Amount is below the market minimum.')) return true;
      if (/Waiting for|Market is unavailable/.test(String(error))) return false;
      throw error;
    }
    throw new Error('BELOW_MINIMUM_QUOTE_ACCEPTED');
  }, 'published-minimum');
  try { await quote('10'); throw new Error('ROUNDED_BELOW_MINIMUM_QUOTE_ACCEPTED'); }
  catch (error) { if (!String(error).includes('Amount is below the market minimum.')) throw error; }
  if (balance(1) !== 100000000n || balance(2) !== 0n) throw new Error('REJECTED_QUOTE_CHANGED_BALANCE');
  let ticket = await quote('25');
  if (ticket.needsCapacity) ticket = await run({ type: 'quoteSwap', token: 1, amount: '25', decimalSeparator: '.', prepare: true, testCredit: true });
  if (!ticket.id || ticket.needsCapacity) throw new Error('SWAP_CAPACITY_NOT_READY');
  const submitted = await run({ type: 'confirm', id: ticket.id });
  await wait(() => balance(2) > 0n, 'fill');
  const wallet = currentWallet();
  const page = await requireAdapter().read(`entity/${wallet.entityId}/account/${submitted.accountId}/swap-history`, { limit: 25 });
  const order = page.items.find(item => item.offerId === submitted.offerId);
  if (!order?.closed || order.resolves.length !== 1) throw new Error('EXPECTED_ONE_CLOSED_EXECUTION');
  const fill = order.resolves[0];
  if (fill.executionGiveAmount <= 0n || fill.executionWantAmount <= 0n || fill.feeAmount === null || fill.feeTokenId !== 2) throw new Error('EXECUTION_EVIDENCE_MISSING');
  const expectedUSDC = 100000000n - fill.executionGiveAmount;
  const expectedWETH = fill.executionWantAmount - fill.feeAmount;
  if (balance(1) !== expectedUSDC || balance(2) !== expectedWETH) throw new Error('EXECUTION_BALANCE_MISMATCH');
  await run({ type: 'lock' });
  await run({ type: 'boot', entropy });
  await wait(() => balance(1) === expectedUSDC && balance(2) === expectedWETH, 'reopened-balances');
  await run({ type: 'lock' });
  return JSON.stringify({ passed: 4, belowMinimumRejected: true, roundedMinimumRejected: true,
    filled: true, reopenedExactBalances: true, offerId: submitted.offerId,
    usdc: expectedUSDC.toString(), weth: expectedWETH.toString(),
    gave: fill.executionGiveAmount.toString(), received: fill.executionWantAmount.toString(), fee: fill.feeAmount.toString() });
}
