/**
 * Dynamics Generation Storage
 *
 * IndexedDB operations for dynamics generation runs.
 * Acts as a shared mailbox between the worker (LLM calls)
 * and the main thread (search execution, user feedback).
 */

import type { DynamicsRun, DynamicsRunStatus } from './dynamicsGenerationTypes';

// ============================================================================
// Database Configuration
// ============================================================================

const DB_NAME = 'canonry-dynamics-generation';
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
    request.onerror = () => reject(request.error || new Error('Failed to open dynamics generation DB'));
  });

  return dbPromise;
}

// ============================================================================
// ID Generation
// ============================================================================

export function generateRunId(): string {
  return `dynrun_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Create a new dynamics generation run.
 */
export async function createDynamicsRun(
  runId: string,
  projectId: string,
  simulationRunId: string
): Promise<DynamicsRun> {
  const db = await openDb();
  const now = Date.now();

  const run: DynamicsRun = {
    runId,
    projectId,
    simulationRunId,
    status: 'pending',
    messages: [],
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalActualCost: 0,
    createdAt: now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve(run);
    tx.onerror = () => reject(tx.error || new Error('Failed to create dynamics run'));
    tx.objectStore(STORE_NAME).put(run);
  });
}

/**
 * Get a dynamics run by ID.
 */
export async function getDynamicsRun(runId: string): Promise<DynamicsRun | undefined> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(runId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to get dynamics run'));
  });
}

/**
 * Update a dynamics run (partial update via read-modify-write).
 */
export async function updateDynamicsRun(
  runId: string,
  updates: Partial<Pick<DynamicsRun,
    | 'status'
    | 'messages'
    | 'pendingSearches'
    | 'searchResults'
    | 'proposedDynamics'
    | 'userFeedback'
    | 'error'
    | 'totalInputTokens'
    | 'totalOutputTokens'
    | 'totalActualCost'
  >>
): Promise<DynamicsRun> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(runId);

    getReq.onsuccess = () => {
      const run = getReq.result as DynamicsRun | undefined;
      if (!run) {
        reject(new Error(`Dynamics run ${runId} not found`));
        return;
      }

      // Apply updates
      if (updates.status !== undefined) run.status = updates.status;
      if (updates.messages !== undefined) run.messages = updates.messages;
      if (updates.pendingSearches !== undefined) run.pendingSearches = updates.pendingSearches;
      if (updates.searchResults !== undefined) run.searchResults = updates.searchResults;
      if (updates.proposedDynamics !== undefined) run.proposedDynamics = updates.proposedDynamics;
      if (updates.userFeedback !== undefined) run.userFeedback = updates.userFeedback;
      if (updates.error !== undefined) run.error = updates.error;
      if (updates.totalInputTokens !== undefined) run.totalInputTokens = updates.totalInputTokens;
      if (updates.totalOutputTokens !== undefined) run.totalOutputTokens = updates.totalOutputTokens;
      if (updates.totalActualCost !== undefined) run.totalActualCost = updates.totalActualCost;
      run.updatedAt = Date.now();

      store.put(run);
    };

    tx.oncomplete = () => {
      // Re-read to return the updated record
      const readTx = db.transaction(STORE_NAME, 'readonly');
      const readReq = readTx.objectStore(STORE_NAME).get(runId);
      readReq.onsuccess = () => resolve(readReq.result);
      readReq.onerror = () => reject(readReq.error || new Error('Failed to read updated run'));
    };
    tx.onerror = () => reject(tx.error || new Error('Failed to update dynamics run'));
  });
}

/**
 * Delete a dynamics run.
 */
export async function deleteDynamicsRun(runId: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete dynamics run'));
    tx.objectStore(STORE_NAME).delete(runId);
  });
}
