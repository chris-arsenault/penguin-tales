/**
 * Chronicle Storage - Read-only access to canonry-chronicles IndexedDB
 */

const CHRONICLE_DB_NAME = 'canonry-chronicles';
const CHRONICLE_DB_VERSION = 1;
const CHRONICLE_STORE_NAME = 'chronicles';

let chronicleDbPromise = null;

function openChronicleDb() {
  if (chronicleDbPromise) return chronicleDbPromise;

  chronicleDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(CHRONICLE_DB_NAME, CHRONICLE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHRONICLE_STORE_NAME)) {
        const store = db.createObjectStore(CHRONICLE_STORE_NAME, { keyPath: 'chronicleId' });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('simulationRunId', 'simulationRunId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('focusType', 'focusType', { unique: false });
        store.createIndex('narrativeStyleId', 'narrativeStyleId', { unique: false });
        store.createIndex('entrypointId', 'entrypointId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open chronicle DB'));
  });

  return chronicleDbPromise;
}

function filterCompleted(records = []) {
  return records
    .filter((record) => record.status === 'complete' && record.acceptedAt)
    .sort((a, b) => (b.acceptedAt || 0) - (a.acceptedAt || 0));
}

export async function getCompletedChroniclesForSimulation(simulationRunId) {
  if (!simulationRunId) return [];

  try {
    const db = await openChronicleDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHRONICLE_STORE_NAME, 'readonly');
      const store = tx.objectStore(CHRONICLE_STORE_NAME);
      const index = store.index('simulationRunId');
      const request = index.getAll(IDBKeyRange.only(simulationRunId));

      request.onsuccess = () => resolve(filterCompleted(request.result || []));
      request.onerror = () => reject(request.error || new Error('Failed to get chronicles'));
    });
  } catch (err) {
    console.error('[chronicleStorage] Failed to load chronicles:', err);
    return [];
  }
}

export async function getCompletedChroniclesForProject(projectId) {
  if (!projectId) return [];

  try {
    const db = await openChronicleDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHRONICLE_STORE_NAME, 'readonly');
      const store = tx.objectStore(CHRONICLE_STORE_NAME);
      const index = store.index('projectId');
      const request = index.getAll(IDBKeyRange.only(projectId));

      request.onsuccess = () => resolve(filterCompleted(request.result || []));
      request.onerror = () => reject(request.error || new Error('Failed to get chronicles'));
    });
  } catch (err) {
    console.error('[chronicleStorage] Failed to load chronicles:', err);
    return [];
  }
}
