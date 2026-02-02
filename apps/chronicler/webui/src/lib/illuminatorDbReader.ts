/**
 * Shared read-only connection to the Illuminator Dexie database.
 *
 * Opens the `illuminator` IndexedDB without specifying a version,
 * which uses the current version without triggering schema upgrades.
 * Dexie owns the schema — this module only reads.
 */

const DB_NAME = 'illuminator';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openIlluminatorDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Failed to open illuminator DB'));
    };
  });

  return dbPromise;
}
