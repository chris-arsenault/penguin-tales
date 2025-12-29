/**
 * Enrichment Result Storage
 *
 * Persists completed enrichment results to IndexedDB so they survive reloads.
 */

import type { EnrichmentResult, EnrichmentType } from './enrichmentTypes';

// ============================================================================
// Types
// ============================================================================

export interface EnrichmentRecord {
  id: string;
  projectId: string;
  simulationRunId: string;
  entityId: string;
  entityName?: string;
  entityKind?: string;
  type: EnrichmentType;
  result: EnrichmentResult;
  savedAt: number;
  imageType?: 'entity' | 'chronicle';
  chronicleId?: string;
  imageRefId?: string;
}

// ============================================================================
// Database Configuration
// ============================================================================

const ENRICHMENT_DB_NAME = 'canonry-enrichment';
const ENRICHMENT_DB_VERSION = 1;
const ENRICHMENT_STORE_NAME = 'results';

// ============================================================================
// Database Connection
// ============================================================================

let enrichmentDbPromise: Promise<IDBDatabase> | null = null;

function openEnrichmentDb(): Promise<IDBDatabase> {
  if (enrichmentDbPromise) return enrichmentDbPromise;

  enrichmentDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(ENRICHMENT_DB_NAME, ENRICHMENT_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(ENRICHMENT_STORE_NAME)) {
        const store = db.createObjectStore(ENRICHMENT_STORE_NAME, { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('simulationRunId', 'simulationRunId', { unique: false });
        store.createIndex('entityId', 'entityId', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('savedAt', 'savedAt', { unique: false });
        store.createIndex('projectSimulation', ['projectId', 'simulationRunId'], { unique: false });
        store.createIndex('projectSimulationEntity', ['projectId', 'simulationRunId', 'entityId'], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open enrichment DB'));
  });

  return enrichmentDbPromise;
}

function buildRecordId(
  projectId: string,
  simulationRunId: string,
  entityId: string,
  type: EnrichmentType
): string {
  return `${projectId}_${simulationRunId}_${entityId}_${type}`;
}

// ============================================================================
// Record Operations
// ============================================================================

export async function saveEnrichmentResult(
  record: Omit<EnrichmentRecord, 'id' | 'savedAt'> & { id?: string; savedAt?: number }
): Promise<void> {
  const db = await openEnrichmentDb();
  const id = record.id || buildRecordId(record.projectId, record.simulationRunId, record.entityId, record.type);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ENRICHMENT_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save enrichment result'));

    const savedAt = record.savedAt ?? Date.now();
    const payload: EnrichmentRecord = {
      ...record,
      id,
      savedAt,
    } as EnrichmentRecord;

    tx.objectStore(ENRICHMENT_STORE_NAME).put(payload);
  });
}

export async function getEnrichmentResults(
  projectId: string,
  simulationRunId: string
): Promise<EnrichmentRecord[]> {
  const db = await openEnrichmentDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ENRICHMENT_STORE_NAME, 'readonly');
    const store = tx.objectStore(ENRICHMENT_STORE_NAME);

    if (store.indexNames.contains('projectSimulation')) {
      const index = store.index('projectSimulation');
      const request = index.getAll([projectId, simulationRunId]);
      request.onsuccess = () => resolve(request.result as EnrichmentRecord[]);
      request.onerror = () => reject(request.error || new Error('Failed to load enrichment results'));
      return;
    }

    const request = store.getAll();
    request.onsuccess = () => {
      const records = request.result as EnrichmentRecord[];
      resolve(
        records.filter(
          (record) => record.projectId === projectId && record.simulationRunId === simulationRunId
        )
      );
    };
    request.onerror = () => reject(request.error || new Error('Failed to load enrichment results'));
  });
}
