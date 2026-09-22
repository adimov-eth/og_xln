async function runQuoteSession() {
  const { currentWallet } = await import('/src/native/host.tsx');
  const run = command => window.xlnNative.run(command);
  const name = 'native-create-' + crypto.randomUUID();
  const password = 'local-test-only-' + crypto.randomUUID();
  const credentials = { type: 'brainvault', name, password, factor: 1 };
  const create = { ...credentials, intent: 'create', confirmation: password, backupConsent: true };
  const rejected = async (command, message) => {
    try { await run(command); }
    catch (error) { if (String(error).includes(message)) return; throw error; }
    throw new Error('EXPECTED_REJECTION:' + message);
  };
  const before = await indexedDB.databases();
  await rejected({ ...create, confirmation: 'different' }, 'Passwords do not match.');
  await rejected(credentials, 'No verified backup could be restored.');
  if (JSON.stringify(await indexedDB.databases()) !== JSON.stringify(before))
    throw new Error('REJECTED_OPEN_CREATED_STORAGE');
  await run(create);
  const wait = async () => {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      try { if (currentWallet().accounts.length) return; }
      catch (error) { if (!String(error).includes('still synchronizing')) throw error; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('CREATED_WALLET_NOT_READY');
  };
  await wait();
  const entityId = currentWallet().entityId;
  const backup = await run({ type: 'verifyBackup' });
  if (!backup.height || !backup.checkpoint || !backup.bytes) throw new Error('VERIFIED_BACKUP_MISSING');
  await rejected(create, 'This BrainVault already exists.');
  await run(credentials);
  await wait();
  if (currentWallet().entityId !== entityId) throw new Error('REOPEN_CHANGED_IDENTITY');
  await run({ type: 'lock' });
  return JSON.stringify({ passed: 5, passwordMismatchRejected: true, missingRecoveryRejected: true, created: true,
    duplicateCreationRejected: true, reopenedSameIdentity: true, entityId, backup });
}
