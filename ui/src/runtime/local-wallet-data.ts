/** Count records without reading keys or values, changing storage, or treating an
 * empty IndexedDB container from an interrupted import as an existing wallet.
 * The canonical importer still checks all destination stores under its lock. */
async function databaseHasRecords(name: string): Promise<boolean> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name);
    let blocked = false;
    request.onblocked = () => { blocked = true; reject(new Error('Local wallet storage is busy. Close other wallet tabs and retry.')); };
    request.onupgradeneeded = () => { request.transaction?.abort(); };
    request.onerror = () => reject(request.error ?? new Error('Local wallet storage could not be inspected.'));
    request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
  });
  try {
    const stores = Array.from(db.objectStoreNames);
    if (!stores.length) return false;
    return await new Promise<boolean>((resolve, reject) => {
      const transaction = db.transaction(stores, 'readonly');
      let occupied = false;
      transaction.oncomplete = () => resolve(occupied);
      transaction.onabort = () => reject(transaction.error ?? new Error('Local wallet storage inspection was interrupted.'));
      for (const name of stores) {
        const count = transaction.objectStore(name).count();
        count.onsuccess = () => { occupied ||= count.result > 0; };
      }
    });
  } finally { db.close(); }
}

export async function hasLocalWalletData(runtimeId: string): Promise<boolean> {
  for (const database of await indexedDB.databases()) {
    if (database.name?.toLowerCase().includes(runtimeId.toLowerCase()) && await databaseHasRecords(database.name)) return true;
  }
  return false;
}
