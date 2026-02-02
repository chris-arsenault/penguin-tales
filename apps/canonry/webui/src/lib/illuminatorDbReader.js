/**
 * Shared read/write connection to the Illuminator Dexie database.
 *
 * Opens the `illuminator` IndexedDB without specifying a version,
 * which uses the current version without triggering schema upgrades.
 * Dexie owns the schema — this module reads and writes via raw IDB.
 *
 * Handles `onversionchange` so Dexie can upgrade the schema without
 * being blocked by this connection.
 */

const DB_NAME = 'illuminator';

let dbPromise = null;

export function openIlluminatorDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);

    request.onsuccess = () => {
      const db = request.result;

      // Close this connection when another tab/MFE needs to upgrade the schema.
      // The next call to openIlluminatorDb() will reconnect at the new version.
      db.onversionchange = () => {
        console.log('[IlluminatorDbReader] Version change detected, closing connection');
        db.close();
        dbPromise = null;
      };

      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Failed to open illuminator DB'));
    };
  });

  return dbPromise;
}
