/**
 * Historian Storage
 *
 * IndexedDB operations for historian review runs.
 * Acts as a shared mailbox between the worker (LLM calls)
 * and the main thread (review UI).
 */

import type { HistorianRun, HistorianRunStatus, HistorianNote } from './historianTypes';

// ============================================================================
// Database Configuration
// ============================================================================

const DB_NAME = 'canonry-historian';
const DB_VERSION = 1;
const STORE_NAME = 'runs';

// ============================================================================
// Database Connection
// ============================================================================

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'runId' });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open historian DB'));
  });

  return dbPromise;
}

// ============================================================================
// ID Generation
// ============================================================================

export function generateHistorianRunId(): string {
  return `histrun_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Create a new historian review run.
 */
export async function createHistorianRun(run: HistorianRun): Promise<HistorianRun> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve(run);
    tx.onerror = () => reject(tx.error || new Error('Failed to create historian run'));
    tx.objectStore(STORE_NAME).put(run);
  });
}

/**
 * Get a historian run by ID.
 */
export async function getHistorianRun(runId: string): Promise<HistorianRun | undefined> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(runId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to get historian run'));
  });
}

/**
 * Update a historian run (partial update via read-modify-write).
 */
export async function updateHistorianRun(
  runId: string,
  updates: Partial<Pick<HistorianRun,
    | 'status'
    | 'error'
    | 'notes'
    | 'noteDecisions'
    | 'inputTokens'
    | 'outputTokens'
    | 'actualCost'
  >>
): Promise<HistorianRun> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(runId);

    getReq.onsuccess = () => {
      const run = getReq.result as HistorianRun | undefined;
      if (!run) {
        reject(new Error(`Historian run ${runId} not found`));
        return;
      }

      if (updates.status !== undefined) run.status = updates.status;
      if (updates.error !== undefined) run.error = updates.error;
      if (updates.notes !== undefined) run.notes = updates.notes;
      if (updates.noteDecisions !== undefined) run.noteDecisions = updates.noteDecisions;
      if (updates.inputTokens !== undefined) run.inputTokens = updates.inputTokens;
      if (updates.outputTokens !== undefined) run.outputTokens = updates.outputTokens;
      if (updates.actualCost !== undefined) run.actualCost = updates.actualCost;
      run.updatedAt = Date.now();

      store.put(run);
    };

    tx.oncomplete = () => {
      const readTx = db.transaction(STORE_NAME, 'readonly');
      const readReq = readTx.objectStore(STORE_NAME).get(runId);
      readReq.onsuccess = () => resolve(readReq.result);
      readReq.onerror = () => reject(readReq.error || new Error('Failed to read updated historian run'));
    };
    tx.onerror = () => reject(tx.error || new Error('Failed to update historian run'));
  });
}

/**
 * Delete a historian run.
 */
export async function deleteHistorianRun(runId: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete historian run'));
    tx.objectStore(STORE_NAME).delete(runId);
  });
}
