async function runQuoteSession() {
  const { currentWallet, publish } = await import('/src/native/host.tsx');
  const { parseAmount } = await import('/src/runtime/format.ts');
  const run = command => window.xlnNative.run(command);
  const entropy = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('');
  const wait = async (predicate, stage) => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try { if (predicate()) return; }
      catch (error) { if (String(error) !== 'Error: Wallet is still synchronizing.') throw error; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`QR_PAYMENT_TIMEOUT:${stage}`);
  };
  const rejected = async (command, expected) => {
    try { await run(command); }
    catch (error) { if (!String(error).includes(expected)) throw error; return; }
    throw new Error(`EXPECTED_REJECTION:${expected}`);
  };
  await run({ type: 'boot', entropy });
  await wait(() => currentWallet().accounts.length > 0, 'wallet-ready');
  await run({ type: 'faucet', testCredit: true });
  const balance = () => currentWallet().totals.find(row => row.tokenId === 1)?.net;
  await wait(() => balance() === 100000000n, 'funded');
  const draft = await run({ type: 'readPaymentRequest', paymentRequest: window.xlnNativeTestInvoice, token: 1, decimalSeparator: ',' });
  if (draft.amount !== '1,000001' || !draft.description.includes('uid:')) throw new Error('QR_INVOICE_DETAILS_LOST');
  const command = { type: 'quotePayment', paymentRequest: draft.raw, recipient: draft.recipient,
    token: draft.token, amount: draft.amount, decimalSeparator: ',' };
  await rejected({ ...command, amount: '2' }, 'Payment details changed.');
  await rejected({ ...command, recipient: currentWallet().accounts[0].counterpartyId }, 'Payment details changed.');
  const quote = await run(command);
  if (quote.note !== draft.description) throw new Error('QR_REVIEW_ATTRIBUTION_LOST');
  const maxDebit = parseAmount(quote.give.split(' ')[0], 6);
  const received = parseAmount(quote.receive.split(' ')[0], 6);
  if (received !== 1000001n || maxDebit < received) throw new Error('QR_QUOTE_AMOUNT_MISMATCH');
  publish({ kind: 'progress', message: `QR_QUOTE debit=${maxDebit} receive=${received} fee=${quote.fee}` });
  await run({ type: 'confirm', id: quote.id });
  await rejected({ type: 'confirm', id: quote.id }, 'Quote expired.');
  await wait(() => {
    const value = balance();
    return value !== undefined && value >= 100000000n - maxDebit && value <= 100000000n - received;
  }, 'sender-debit');
  const senderBalance = balance().toString();
  await run({ type: 'lock' });
  return JSON.stringify({ scope: 'Real local native WebKit host → canonical payment → custody',
    amount: '1000001', maxDebit: maxDebit.toString(), senderBalance, recipient: draft.recipient,
    description: draft.description, changedAmountRejected: true, changedRecipientRejected: true,
    duplicateConfirmationRejected: true });
}
