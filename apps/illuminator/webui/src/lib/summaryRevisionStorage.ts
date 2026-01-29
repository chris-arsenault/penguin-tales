/**
 * Summary Revision Storage
 *
 * IndexedDB operations for summary revision runs.
 * Acts as a shared mailbox between the worker (LLM calls)
 * and the main thread (review UI).
 */

import type { SummaryRevisionRun, SummaryRevisionRunStatus, SummaryRevisionBatch } from './summaryRevisionTypes';

// ============================================================================
// Database Configuration
// ============================================================================

const DB_NAME = 'canonry-summary-revision';
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
    request.onerror = () => reject(request.error || new Error('Failed to open summary revision DB'));
  });

  return dbPromise;
}

// ============================================================================
// ID Generation
// ============================================================================

export function generateRevisionRunId(): string {
  return `revrun_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Create a new summary revision run.
 */
export async function createRevisionRun(
  runId: string,
  projectId: string,
  simulationRunId: string,
  batches: SummaryRevisionBatch[],
  context: {
    worldDynamicsContext: string;
    staticPagesContext: string;
    schemaContext: string;
    revisionGuidance: string;
  }
): Promise<SummaryRevisionRun> {
  const db = await openDb();
  const now = Date.now();

  const run: SummaryRevisionRun = {
    runId,
    projectId,
    simulationRunId,
    status: 'pending',
    batches,
    currentBatchIndex: 0,
    patchDecisions: {},
    worldDynamicsContext: context.worldDynamicsContext,
    staticPagesContext: context.staticPagesContext,
    schemaContext: context.schemaContext,
    revisionGuidance: context.revisionGuidance,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalActualCost: 0,
    createdAt: now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve(run);
    tx.onerror = () => reject(tx.error || new Error('Failed to create revision run'));
    tx.objectStore(STORE_NAME).put(run);
  });
}

/**
 * Get a revision run by ID.
 */
export async function getRevisionRun(runId: string): Promise<SummaryRevisionRun | undefined> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(runId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to get revision run'));
  });
}

/**
 * Update a revision run (partial update via read-modify-write).
 */
export async function updateRevisionRun(
  runId: string,
  updates: Partial<Pick<SummaryRevisionRun,
    | 'status'
    | 'batches'
    | 'currentBatchIndex'
    | 'patchDecisions'
    | 'error'
    | 'totalInputTokens'
    | 'totalOutputTokens'
    | 'totalActualCost'
  >>
): Promise<SummaryRevisionRun> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(runId);

    getReq.onsuccess = () => {
      const run = getReq.result as SummaryRevisionRun | undefined;
      if (!run) {
        reject(new Error(`Revision run ${runId} not found`));
        return;
      }

      if (updates.status !== undefined) run.status = updates.status;
      if (updates.batches !== undefined) run.batches = updates.batches;
      if (updates.currentBatchIndex !== undefined) run.currentBatchIndex = updates.currentBatchIndex;
      if (updates.patchDecisions !== undefined) run.patchDecisions = updates.patchDecisions;
      if (updates.totalInputTokens !== undefined) run.totalInputTokens = updates.totalInputTokens;
      if (updates.totalOutputTokens !== undefined) run.totalOutputTokens = updates.totalOutputTokens;
      if (updates.totalActualCost !== undefined) run.totalActualCost = updates.totalActualCost;
      run.updatedAt = Date.now();

      store.put(run);
    };

    tx.oncomplete = () => {
      const readTx = db.transaction(STORE_NAME, 'readonly');
      const readReq = readTx.objectStore(STORE_NAME).get(runId);
      readReq.onsuccess = () => resolve(readReq.result);
      readReq.onerror = () => reject(readReq.error || new Error('Failed to read updated run'));
    };
    tx.onerror = () => reject(tx.error || new Error('Failed to update revision run'));
  });
}

/**
 * Delete a revision run.
 */
export async function deleteRevisionRun(runId: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete revision run'));
    tx.objectStore(STORE_NAME).delete(runId);
  });
}
