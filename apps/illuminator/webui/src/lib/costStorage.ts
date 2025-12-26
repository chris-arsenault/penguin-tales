/**
 * Cost Storage Module
 *
 * Independent IndexedDB store for tracking all LLM costs.
 * Costs are never deleted when entities/stories are regenerated.
 * Supports slicing by project, simulation, entity, type, model.
 */

// ============================================================================
// Types
// ============================================================================

export type CostType =
  | 'description'
  | 'image'
  | 'imagePrompt'      // Claude call to format image prompt
  | 'storyPlan'
  | 'storyScene'
  | 'storyAssembly'    // No LLM cost, but tracked for completeness
  | 'storyValidation'
  | 'storyRevision';

export interface CostRecord {
  id: string;
  timestamp: number;

  // Context for slicing
  projectId: string;
  simulationRunId?: string;
  entityId?: string;
  entityName?: string;
  entityKind?: string;
  storyId?: string;

  // What was generated
  type: CostType;
  model: string;

  // Costs
  estimatedCost: number;
  actualCost: number;
  inputTokens: number;
  outputTokens: number;
}

export interface CostSummary {
  totalEstimated: number;
  totalActual: number;
  count: number;
  byType: Record<CostType, { estimated: number; actual: number; count: number }>;
  byModel: Record<string, { estimated: number; actual: number; count: number }>;
}

// ============================================================================
// Database Configuration
// ============================================================================

const COST_DB_NAME = 'canonry-costs';
const COST_DB_VERSION = 1;
const COST_STORE_NAME = 'costs';

// ============================================================================
// Database Connection
// ============================================================================

let costDbPromise: Promise<IDBDatabase> | null = null;

function openCostDb(): Promise<IDBDatabase> {
  if (costDbPromise) return costDbPromise;

  costDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(COST_DB_NAME, COST_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(COST_STORE_NAME)) {
        const store = db.createObjectStore(COST_STORE_NAME, { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('simulationRunId', 'simulationRunId', { unique: false });
        store.createIndex('entityId', 'entityId', { unique: false });
        store.createIndex('storyId', 'storyId', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('model', 'model', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        // Compound index for project + simulation
        store.createIndex('projectSimulation', ['projectId', 'simulationRunId'], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open cost DB'));
  });

  return costDbPromise;
}

// ============================================================================
// Cost Record Operations
// ============================================================================

/**
 * Generate a unique cost record ID
 */
export function generateCostId(): string {
  return `cost_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Save a cost record
 */
export async function saveCostRecord(record: CostRecord): Promise<void> {
  const db = await openCostDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(COST_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save cost record'));
    tx.objectStore(COST_STORE_NAME).put(record);
  });
}

/**
 * Get all cost records for a project
 */
export async function getCostsForProject(projectId: string): Promise<CostRecord[]> {
  const db = await openCostDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(COST_STORE_NAME, 'readonly');
    const index = tx.objectStore(COST_STORE_NAME).index('projectId');
    const req = index.getAll(projectId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to get costs for project'));
  });
}

/**
 * Get all cost records for a simulation run
 */
export async function getCostsForSimulation(simulationRunId: string): Promise<CostRecord[]> {
  const db = await openCostDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(COST_STORE_NAME, 'readonly');
    const store = tx.objectStore(COST_STORE_NAME);

    if (store.indexNames.contains('simulationRunId')) {
      const index = store.index('simulationRunId');
      const req = index.getAll(simulationRunId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Failed to get costs for simulation'));
    } else {
      // Fallback scan
      const req = store.getAll();
      req.onsuccess = () => {
        const filtered = (req.result as CostRecord[]).filter(
          (r) => r.simulationRunId === simulationRunId
        );
        resolve(filtered);
      };
      req.onerror = () => reject(req.error || new Error('Failed to get costs for simulation'));
    }
  });
}

/**
 * Get all cost records (for all-time totals)
 */
export async function getAllCosts(): Promise<CostRecord[]> {
  const db = await openCostDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(COST_STORE_NAME, 'readonly');
    const req = tx.objectStore(COST_STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to get all costs'));
  });
}

/**
 * Get cost records within a time range
 */
export async function getCostsInRange(startTime: number, endTime: number): Promise<CostRecord[]> {
  const db = await openCostDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(COST_STORE_NAME, 'readonly');
    const index = tx.objectStore(COST_STORE_NAME).index('timestamp');
    const range = IDBKeyRange.bound(startTime, endTime);
    const req = index.getAll(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to get costs in range'));
  });
}

/**
 * Summarize cost records
 */
export function summarizeCosts(records: CostRecord[]): CostSummary {
  const summary: CostSummary = {
    totalEstimated: 0,
    totalActual: 0,
    count: records.length,
    byType: {} as Record<CostType, { estimated: number; actual: number; count: number }>,
    byModel: {},
  };

  for (const record of records) {
    summary.totalEstimated += record.estimatedCost;
    summary.totalActual += record.actualCost;

    // By type
    if (!summary.byType[record.type]) {
      summary.byType[record.type] = { estimated: 0, actual: 0, count: 0 };
    }
    summary.byType[record.type].estimated += record.estimatedCost;
    summary.byType[record.type].actual += record.actualCost;
    summary.byType[record.type].count++;

    // By model
    if (!summary.byModel[record.model]) {
      summary.byModel[record.model] = { estimated: 0, actual: 0, count: 0 };
    }
    summary.byModel[record.model].estimated += record.estimatedCost;
    summary.byModel[record.model].actual += record.actualCost;
    summary.byModel[record.model].count++;
  }

  return summary;
}

/**
 * Clear all cost records (use with caution)
 */
export async function clearAllCosts(): Promise<void> {
  const db = await openCostDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(COST_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to clear costs'));
    tx.objectStore(COST_STORE_NAME).clear();
  });
}

/**
 * Get cost count (for quick checks without loading all records)
 */
export async function getCostCount(): Promise<number> {
  const db = await openCostDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(COST_STORE_NAME, 'readonly');
    const req = tx.objectStore(COST_STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to get cost count'));
  });
}
