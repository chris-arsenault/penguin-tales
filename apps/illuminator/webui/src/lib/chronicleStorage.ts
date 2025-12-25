/**
 * Chronicle Storage Module
 *
 * IndexedDB operations for persisting entity stories.
 * Used by workers to save progress immediately, preventing data loss
 * on page navigation.
 */

import type { StoryPlan, CohesionReport, ChronicleStatus } from './chronicleTypes';

// ============================================================================
// Database Configuration
// ============================================================================

const STORY_DB_NAME = 'canonry-stories';
const STORY_DB_VERSION = 3;  // Bumped again to force re-upgrade for simulationRunId index
const STORY_STORE_NAME = 'stories';

// ============================================================================
// Types
// ============================================================================

export interface StoryRecord {
  storyId: string;
  entityId: string;
  entityName: string;
  entityKind: string;
  entityCulture?: string;
  projectId: string;
  /** Unique ID for the simulation run this story belongs to */
  simulationRunId: string;

  // Generation state
  status: ChronicleStatus;

  // Step 1: Plan
  plan?: StoryPlan;
  planGeneratedAt?: number;

  // Step 2: Scene content (stored in plan.scenes[].generatedContent but also tracked here)
  scenesCompleted: number;
  scenesTotal: number;

  // Step 3: Assembled content
  assembledContent?: string;
  wikiLinks?: { entityId: string; name: string; count: number }[];
  assembledAt?: number;

  // Step 4: Cohesion validation
  cohesionReport?: CohesionReport;
  validatedAt?: number;

  // Final content
  finalContent?: string;
  acceptedAt?: number;

  // Cost tracking (aggregated across all LLM calls)
  totalEstimatedCost: number;
  totalActualCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;

  // Metadata
  model: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Database Connection
// ============================================================================

let storyDbPromise: Promise<IDBDatabase> | null = null;

function openStoryDb(): Promise<IDBDatabase> {
  if (storyDbPromise) return storyDbPromise;

  storyDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(STORY_DB_NAME, STORY_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(STORY_STORE_NAME)) {
        // Fresh install - create store with all indexes
        const store = db.createObjectStore(STORY_STORE_NAME, { keyPath: 'storyId' });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('entityId', 'entityId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('simulationRunId', 'simulationRunId', { unique: false });
      } else if (oldVersion < 3) {
        // Upgrade from v1 or v2 - ensure simulationRunId index exists
        const tx = (event.target as IDBOpenDBRequest).transaction!;
        const store = tx.objectStore(STORY_STORE_NAME);
        if (!store.indexNames.contains('simulationRunId')) {
          store.createIndex('simulationRunId', 'simulationRunId', { unique: false });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open story DB'));
  });

  return storyDbPromise;
}

// ============================================================================
// Story Storage Operations
// ============================================================================

export function generateStoryId(entityId: string): string {
  return `story_${entityId}_${Date.now()}`;
}

/**
 * Create a new story record (Step 0)
 */
export async function createStory(
  storyId: string,
  metadata: {
    entityId: string;
    entityName: string;
    entityKind: string;
    entityCulture?: string;
    projectId: string;
    simulationRunId: string;
    model: string;
  }
): Promise<StoryRecord> {
  const db = await openStoryDb();

  const record: StoryRecord = {
    storyId,
    ...metadata,
    status: 'planning',
    scenesCompleted: 0,
    scenesTotal: 0,
    totalEstimatedCost: 0,
    totalActualCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error || new Error('Failed to create story'));
    tx.objectStore(STORY_STORE_NAME).put(record);
  });
}

/**
 * Update story with plan (Step 1 complete)
 */
export async function updateStoryPlan(
  storyId: string,
  plan: StoryPlan,
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number }
): Promise<void> {
  const db = await openStoryDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORY_STORE_NAME);
    const getReq = store.get(storyId);

    getReq.onsuccess = () => {
      const record = getReq.result as StoryRecord | undefined;
      if (!record) {
        reject(new Error(`Story ${storyId} not found`));
        return;
      }

      record.plan = plan;
      record.planGeneratedAt = Date.now();
      record.status = 'plan_ready';
      record.scenesTotal = plan.scenes.length;
      record.totalEstimatedCost += cost.estimated;
      record.totalActualCost += cost.actual;
      record.totalInputTokens += cost.inputTokens;
      record.totalOutputTokens += cost.outputTokens;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update story plan'));
  });
}

/**
 * Update story with scene content (Step 2 progress)
 */
export async function updateStoryScene(
  storyId: string,
  sceneIndex: number,
  sceneContent: string,
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number }
): Promise<void> {
  const db = await openStoryDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORY_STORE_NAME);
    const getReq = store.get(storyId);

    getReq.onsuccess = () => {
      const record = getReq.result as StoryRecord | undefined;
      if (!record || !record.plan) {
        reject(new Error(`Story ${storyId} not found or has no plan`));
        return;
      }

      if (sceneIndex < 0 || sceneIndex >= record.plan.scenes.length) {
        reject(new Error(`Invalid scene index ${sceneIndex}`));
        return;
      }

      record.plan.scenes[sceneIndex].generatedContent = sceneContent;
      record.scenesCompleted = sceneIndex + 1;
      record.status = 'expanding';
      record.totalEstimatedCost += cost.estimated;
      record.totalActualCost += cost.actual;
      record.totalInputTokens += cost.inputTokens;
      record.totalOutputTokens += cost.outputTokens;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update story scene'));
  });
}

/**
 * Update story with assembled content (Step 3 complete)
 */
export async function updateStoryAssembly(
  storyId: string,
  assembledContent: string,
  wikiLinks: { entityId: string; name: string; count: number }[]
): Promise<void> {
  const db = await openStoryDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORY_STORE_NAME);
    const getReq = store.get(storyId);

    getReq.onsuccess = () => {
      const record = getReq.result as StoryRecord | undefined;
      if (!record) {
        reject(new Error(`Story ${storyId} not found`));
        return;
      }

      record.assembledContent = assembledContent;
      record.wikiLinks = wikiLinks;
      record.assembledAt = Date.now();
      record.status = 'assembly_ready';  // Pause for user review before validation
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update story assembly'));
  });
}

/**
 * Update story with cohesion report (Step 4 complete)
 */
export async function updateStoryCohesion(
  storyId: string,
  cohesionReport: CohesionReport,
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number }
): Promise<void> {
  const db = await openStoryDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORY_STORE_NAME);
    const getReq = store.get(storyId);

    getReq.onsuccess = () => {
      const record = getReq.result as StoryRecord | undefined;
      if (!record) {
        reject(new Error(`Story ${storyId} not found`));
        return;
      }

      record.cohesionReport = cohesionReport;
      record.validatedAt = Date.now();
      record.status = 'validation_ready';
      record.totalEstimatedCost += cost.estimated;
      record.totalActualCost += cost.actual;
      record.totalInputTokens += cost.inputTokens;
      record.totalOutputTokens += cost.outputTokens;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update story cohesion'));
  });
}

/**
 * Mark story as complete (user accepted)
 */
export async function acceptStory(storyId: string): Promise<void> {
  const db = await openStoryDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORY_STORE_NAME);
    const getReq = store.get(storyId);

    getReq.onsuccess = () => {
      const record = getReq.result as StoryRecord | undefined;
      if (!record) {
        reject(new Error(`Story ${storyId} not found`));
        return;
      }

      record.finalContent = record.assembledContent;
      record.acceptedAt = Date.now();
      record.status = 'complete';
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to accept story'));
  });
}

/**
 * Get a story record
 */
export async function getStory(storyId: string): Promise<StoryRecord | undefined> {
  const db = await openStoryDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readonly');
    const req = tx.objectStore(STORY_STORE_NAME).get(storyId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to get story'));
  });
}

/**
 * Get all stories for an entity
 */
export async function getStoriesForEntity(entityId: string): Promise<StoryRecord[]> {
  const db = await openStoryDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readonly');
    const index = tx.objectStore(STORY_STORE_NAME).index('entityId');
    const req = index.getAll(entityId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to get stories for entity'));
  });
}

/**
 * Get all stories for a specific simulation run
 */
export async function getStoriesForSimulation(simulationRunId: string): Promise<StoryRecord[]> {
  const db = await openStoryDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readonly');
    const store = tx.objectStore(STORY_STORE_NAME);

    // Check if index exists (may not exist if DB wasn't upgraded properly)
    if (store.indexNames.contains('simulationRunId')) {
      const index = store.index('simulationRunId');
      const req = index.getAll(simulationRunId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Failed to get stories for simulation'));
    } else {
      // Fallback: scan all records and filter
      console.warn('[chronicleStorage] simulationRunId index not found, using fallback scan');
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result as StoryRecord[];
        const filtered = all.filter((s) => s.simulationRunId === simulationRunId);
        resolve(filtered);
      };
      req.onerror = () => reject(req.error || new Error('Failed to get stories for simulation'));
    }
  });
}

/**
 * Get all stories for a project (all simulation runs)
 * @deprecated Use getStoriesForSimulation with specific simulationRunId instead
 */
export async function getStoriesForProject(projectId: string): Promise<StoryRecord[]> {
  const db = await openStoryDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readonly');
    const index = tx.objectStore(STORY_STORE_NAME).index('projectId');
    const req = index.getAll(projectId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to get stories for project'));
  });
}

/**
 * Delete a story
 */
export async function deleteStory(storyId: string): Promise<void> {
  const db = await openStoryDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete story'));
    tx.objectStore(STORY_STORE_NAME).delete(storyId);
  });
}

/**
 * Delete all stories for a simulation run
 */
export async function deleteStoriesForSimulation(simulationRunId: string): Promise<number> {
  const stories = await getStoriesForSimulation(simulationRunId);
  if (stories.length === 0) return 0;

  const db = await openStoryDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORY_STORE_NAME);

    for (const story of stories) {
      store.delete(story.storyId);
    }

    tx.oncomplete = () => resolve(stories.length);
    tx.onerror = () => reject(tx.error || new Error('Failed to delete stories for simulation'));
  });
}

/**
 * Get latest story for an entity (if any)
 */
export async function getLatestStoryForEntity(entityId: string): Promise<StoryRecord | undefined> {
  const stories = await getStoriesForEntity(entityId);
  if (stories.length === 0) return undefined;

  // Return the most recent by updatedAt
  return stories.sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

/**
 * Mark all scenes as complete (Step 2 done, awaiting user review)
 */
export async function markScenesComplete(storyId: string): Promise<void> {
  const db = await openStoryDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORY_STORE_NAME);
    const getReq = store.get(storyId);

    getReq.onsuccess = () => {
      const record = getReq.result as StoryRecord | undefined;
      if (!record) {
        reject(new Error(`Story ${storyId} not found`));
        return;
      }

      record.status = 'scenes_ready';
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to mark scenes complete'));
  });
}

/**
 * Start assembly step (user approved scenes)
 */
export async function startAssemblyStep(storyId: string): Promise<void> {
  const db = await openStoryDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORY_STORE_NAME);
    const getReq = store.get(storyId);

    getReq.onsuccess = () => {
      const record = getReq.result as StoryRecord | undefined;
      if (!record) {
        reject(new Error(`Story ${storyId} not found`));
        return;
      }

      record.status = 'assembling';
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to start assembly'));
  });
}

/**
 * Start validation step (user approved assembly)
 */
export async function startValidationStep(storyId: string): Promise<void> {
  const db = await openStoryDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORY_STORE_NAME);
    const getReq = store.get(storyId);

    getReq.onsuccess = () => {
      const record = getReq.result as StoryRecord | undefined;
      if (!record) {
        reject(new Error(`Story ${storyId} not found`));
        return;
      }

      record.status = 'validating';
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to start validation'));
  });
}
