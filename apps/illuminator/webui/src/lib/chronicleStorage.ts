/**
 * Chronicle Storage Module
 *
 * IndexedDB operations for persisting entity stories.
 * Used by workers to save progress immediately, preventing data loss
 * on page navigation.
 */

import type { ChroniclePlan, CohesionReport, ChronicleStatus } from './chronicleTypes';
import type { ChronicleStep } from './enrichmentTypes';

// ============================================================================
// Database Configuration
// ============================================================================

const STORY_DB_NAME = 'canonry-stories';
const STORY_DB_VERSION = 4;
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
  failureStep?: ChronicleStep;
  failureReason?: string;
  failedAt?: number;

  // Step 1: Plan
  plan?: ChroniclePlan;
  planGeneratedAt?: number;

  // Step 2: Section content (stored in plan.sections[].generatedContent but also tracked here)
  sectionsCompleted: number;
  sectionsTotal: number;

  // Step 3: Assembled content
  assembledContent?: string;
  assembledAt?: number;

  // Step 4: Cohesion validation
  cohesionReport?: CohesionReport;
  validatedAt?: number;

  // Revision tracking
  editVersion: number;
  editedAt?: number;

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

    request.onupgradeneeded = () => {
      const db = request.result;

      if (db.objectStoreNames.contains(STORY_STORE_NAME)) {
        db.deleteObjectStore(STORY_STORE_NAME);
      }

      const store = db.createObjectStore(STORY_STORE_NAME, { keyPath: 'storyId' });
      store.createIndex('projectId', 'projectId', { unique: false });
      store.createIndex('entityId', 'entityId', { unique: false });
      store.createIndex('status', 'status', { unique: false });
      store.createIndex('createdAt', 'createdAt', { unique: false });
      store.createIndex('simulationRunId', 'simulationRunId', { unique: false });
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
    sectionsCompleted: 0,
    sectionsTotal: 0,
    editVersion: 0,
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
  plan: ChroniclePlan,
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
      record.failureStep = undefined;
      record.failureReason = undefined;
      record.failedAt = undefined;
      record.sectionsTotal = plan.sections.length;
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
 * Update story with section content (Step 2 progress)
 */
export async function updateStorySection(
  storyId: string,
  sectionIndex: number,
  sectionContent: string,
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

      if (sectionIndex < 0 || sectionIndex >= record.plan.sections.length) {
        reject(new Error(`Invalid section index ${sectionIndex}`));
        return;
      }

      record.plan.sections[sectionIndex].generatedContent = sectionContent;
      record.sectionsCompleted = sectionIndex + 1;
      record.status = 'expanding';
      record.failureStep = undefined;
      record.failureReason = undefined;
      record.failedAt = undefined;
      record.totalEstimatedCost += cost.estimated;
      record.totalActualCost += cost.actual;
      record.totalInputTokens += cost.inputTokens;
      record.totalOutputTokens += cost.outputTokens;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update story section'));
  });
}

/**
 * Update story with assembled content (Step 3 complete)
 */
export async function updateStoryAssembly(
  storyId: string,
  assembledContent: string
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
      record.assembledAt = Date.now();
      record.status = 'assembly_ready';  // Pause for user review before validation
      record.failureStep = undefined;
      record.failureReason = undefined;
      record.failedAt = undefined;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update story assembly'));
  });
}

/**
 * Update story with revised content (post-validation edits)
 */
export async function updateStoryEdit(
  storyId: string,
  assembledContent: string,
  cost?: { estimated: number; actual: number; inputTokens: number; outputTokens: number }
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
      record.assembledAt = Date.now();
      record.editedAt = Date.now();
      record.editVersion = (record.editVersion || 0) + 1;
      record.cohesionReport = undefined;
      record.validatedAt = undefined;
      record.status = 'editing';
      record.failureStep = undefined;
      record.failureReason = undefined;
      record.failedAt = undefined;
      if (cost) {
        record.totalEstimatedCost += cost.estimated;
        record.totalActualCost += cost.actual;
        record.totalInputTokens += cost.inputTokens;
        record.totalOutputTokens += cost.outputTokens;
      }
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update story edit'));
  });
}

/**
 * Mark story as failed (worker error)
 */
export async function updateStoryFailure(
  storyId: string,
  step: ChronicleStep,
  reason: string
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

      record.status = 'failed';
      record.failureStep = step;
      record.failureReason = reason;
      record.failedAt = Date.now();
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update story failure'));
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
      record.failureStep = undefined;
      record.failureReason = undefined;
      record.failedAt = undefined;
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
export async function acceptStory(storyId: string, finalContent?: string): Promise<void> {
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

      record.finalContent = finalContent ?? record.assembledContent;
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
    const index = store.index('simulationRunId');
    const req = index.getAll(simulationRunId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to get stories for simulation'));
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
 * Mark all sections as complete (Step 2 done, awaiting user review)
 */
export async function markSectionsComplete(storyId: string): Promise<void> {
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

      record.status = 'sections_ready';
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to mark sections complete'));
  });
}

/**
 * Start assembly step (user approved sections)
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
