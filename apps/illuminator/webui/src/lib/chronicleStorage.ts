/**
 * Chronicle Storage Module
 *
 * IndexedDB operations for persisting entity stories.
 * Used by workers to save progress immediately, preventing data loss
 * on page navigation.
 */

import type { ChroniclePlan, CohesionReport, ChronicleStatus, ChronicleImageRefs, ChronicleRoleAssignment } from './chronicleTypes';
import type { ChronicleStep } from './enrichmentTypes';

// ============================================================================
// Database Configuration
// ============================================================================

const STORY_DB_NAME = 'canonry-stories';
const STORY_DB_VERSION = 6;  // Chronicle-first architecture: focus replaces entity-centric model
const STORY_STORE_NAME = 'stories';

// ============================================================================
// Types
// ============================================================================

export interface StoryRecord {
  storyId: string;
  projectId: string;
  /** Unique ID for the simulation run this story belongs to */
  simulationRunId: string;

  // ==========================================================================
  // Chronicle Identity (chronicle-first architecture)
  // ==========================================================================

  /** User-visible title for the chronicle */
  title?: string;

  /** Focus type: what is this chronicle about? */
  focusType: 'single' | 'ensemble' | 'relationship' | 'event';

  /** Role assignments define the chronicle's cast - THIS IS THE PRIMARY IDENTITY */
  roleAssignments: ChronicleRoleAssignment[];

  /** Narrative style ID */
  narrativeStyleId: string;

  /** Selected entity IDs (all entities in the chronicle) */
  selectedEntityIds: string[];

  /** Selected event IDs */
  selectedEventIds: string[];

  /** Selected relationship IDs (src:dst:kind format) */
  selectedRelationshipIds: string[];

  // ==========================================================================
  // Mechanical metadata (used for graph traversal, not identity)
  // ==========================================================================

  /** Entry point used for candidate discovery - purely mechanical, not displayed */
  entrypointId?: string;

  // ==========================================================================
  // Legacy fields (deprecated, kept for migration)
  // ==========================================================================

  /** @deprecated Use roleAssignments instead. Kept for backwards compat. */
  entityId?: string;
  /** @deprecated Use title or derive from roleAssignments */
  entityName?: string;
  /** @deprecated Derive from roleAssignments */
  entityKind?: string;
  /** @deprecated Derive from roleAssignments */
  entityCulture?: string;
  /** @deprecated Always true for new records */
  wizardCompleted?: boolean;

  // ==========================================================================
  // Generation metadata
  // ==========================================================================

  /** Summary of what was selected for the prompt */
  selectionSummary?: {
    entityCount: number;
    eventCount: number;
    relationshipCount: number;
  };

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

  // Refinements
  summary?: string;
  summaryGeneratedAt?: number;
  summaryModel?: string;
  imageRefs?: ChronicleImageRefs;
  imageRefsGeneratedAt?: number;
  imageRefsModel?: string;
  proseBlendGeneratedAt?: number;
  proseBlendModel?: string;
  validationStale?: boolean;

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

      // Primary indexes (chronicle-first)
      store.createIndex('simulationRunId', 'simulationRunId', { unique: false });
      store.createIndex('projectId', 'projectId', { unique: false });
      store.createIndex('status', 'status', { unique: false });
      store.createIndex('createdAt', 'createdAt', { unique: false });
      store.createIndex('updatedAt', 'updatedAt', { unique: false });
      store.createIndex('focusType', 'focusType', { unique: false });
      store.createIndex('narrativeStyleId', 'narrativeStyleId', { unique: false });

      // Mechanical index (for graph-based queries)
      store.createIndex('entrypointId', 'entrypointId', { unique: false });

      // Legacy index (deprecated, kept for migration)
      store.createIndex('entityId', 'entityId', { unique: false });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open story DB'));
  });

  return storyDbPromise;
}

// ============================================================================
// Story Storage Operations
// ============================================================================

/**
 * Generate a unique story ID (no longer tied to entity)
 */
export function generateStoryId(): string {
  return `chronicle_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Derive a title from role assignments
 */
export function deriveTitleFromRoles(roleAssignments: ChronicleRoleAssignment[]): string {
  const primary = roleAssignments.filter(r => r.isPrimary);
  if (primary.length === 0) {
    const first = roleAssignments[0];
    return first ? `Chronicle of ${first.entityName}` : 'Untitled Chronicle';
  }
  if (primary.length === 1) {
    return `Chronicle of ${primary[0].entityName}`;
  }
  if (primary.length === 2) {
    return `${primary[0].entityName} and ${primary[1].entityName}`;
  }
  return `${primary[0].entityName} and ${primary.length - 1} others`;
}

/**
 * Determine focus type from role assignments
 */
export function deriveFocusType(roleAssignments: ChronicleRoleAssignment[]): 'single' | 'ensemble' | 'relationship' | 'event' {
  const primaryCount = roleAssignments.filter(r => r.isPrimary).length;
  if (primaryCount <= 1) return 'single';
  return 'ensemble';
}

/**
 * Shell record metadata (for creating before generation starts)
 */
export interface ChronicleShellMetadata {
  projectId: string;
  simulationRunId: string;
  model: string;

  // Chronicle identity
  title?: string;
  narrativeStyleId: string;
  roleAssignments: ChronicleRoleAssignment[];
  selectedEntityIds: string[];
  selectedEventIds: string[];
  selectedRelationshipIds: string[];

  // Mechanical (optional)
  entrypointId?: string;
}

/**
 * Create a shell chronicle record before generation starts.
 * This provides immediate UI feedback while generation is in progress.
 */
export async function createChronicleShell(
  storyId: string,
  metadata: ChronicleShellMetadata
): Promise<StoryRecord> {
  const db = await openStoryDb();

  const focusType = deriveFocusType(metadata.roleAssignments);
  const title = metadata.title || deriveTitleFromRoles(metadata.roleAssignments);

  const record: StoryRecord = {
    storyId,
    projectId: metadata.projectId,
    simulationRunId: metadata.simulationRunId,

    // Chronicle identity
    title,
    focusType,
    narrativeStyleId: metadata.narrativeStyleId,
    roleAssignments: metadata.roleAssignments,
    selectedEntityIds: metadata.selectedEntityIds,
    selectedEventIds: metadata.selectedEventIds,
    selectedRelationshipIds: metadata.selectedRelationshipIds,

    // Mechanical
    entrypointId: metadata.entrypointId,

    // Legacy fields for backwards compat
    entityId: metadata.entrypointId,
    entityName: title,
    wizardCompleted: true,

    // Generation state - starts as 'generating'
    status: 'generating',
    sectionsCompleted: 0,
    sectionsTotal: 0,
    editVersion: 0,
    validationStale: false,
    totalEstimatedCost: 0,
    totalActualCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    model: metadata.model,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORY_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error || new Error('Failed to create chronicle shell'));
    tx.objectStore(STORY_STORE_NAME).put(record);
  });
}

/**
 * Chronicle creation metadata
 */
export interface ChronicleMetadata {
  projectId: string;
  simulationRunId: string;
  model: string;

  // Chronicle identity
  title?: string;
  narrativeStyleId: string;
  roleAssignments: ChronicleRoleAssignment[];
  selectedEntityIds: string[];
  selectedEventIds: string[];
  selectedRelationshipIds: string[];

  // Mechanical (optional)
  entrypointId?: string;

  // Generation result
  assembledContent: string;
  selectionSummary: {
    entityCount: number;
    eventCount: number;
    relationshipCount: number;
  };
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number };
}

/**
 * Create a chronicle record (single-shot generation, goes directly to assembly_ready)
 */
export async function createStory(
  storyId: string,
  metadata: ChronicleMetadata
): Promise<StoryRecord> {
  const db = await openStoryDb();

  const focusType = deriveFocusType(metadata.roleAssignments);
  const title = metadata.title || deriveTitleFromRoles(metadata.roleAssignments);

  const record: StoryRecord = {
    storyId,
    projectId: metadata.projectId,
    simulationRunId: metadata.simulationRunId,

    // Chronicle identity
    title,
    focusType,
    narrativeStyleId: metadata.narrativeStyleId,
    roleAssignments: metadata.roleAssignments,
    selectedEntityIds: metadata.selectedEntityIds,
    selectedEventIds: metadata.selectedEventIds,
    selectedRelationshipIds: metadata.selectedRelationshipIds,

    // Mechanical
    entrypointId: metadata.entrypointId,

    // Legacy fields for backwards compat
    entityId: metadata.entrypointId,
    entityName: title,
    wizardCompleted: true,

    // Generation result
    selectionSummary: metadata.selectionSummary,
    status: 'assembly_ready',  // Single-shot generation goes directly to assembled
    sectionsCompleted: 0,
    sectionsTotal: 0,
    assembledContent: metadata.assembledContent,
    assembledAt: Date.now(),
    editVersion: 0,
    validationStale: false,
    totalEstimatedCost: metadata.cost.estimated,
    totalActualCost: metadata.cost.actual,
    totalInputTokens: metadata.cost.inputTokens,
    totalOutputTokens: metadata.cost.outputTokens,
    model: metadata.model,
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
 * Update story with assembled content (regeneration or prose blend)
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
      record.summary = undefined;
      record.summaryGeneratedAt = undefined;
      record.summaryModel = undefined;
      record.imageRefs = undefined;
      record.imageRefsGeneratedAt = undefined;
      record.imageRefsModel = undefined;
      record.proseBlendGeneratedAt = undefined;
      record.proseBlendModel = undefined;
      record.validationStale = false;
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
      record.summary = undefined;
      record.summaryGeneratedAt = undefined;
      record.summaryModel = undefined;
      record.imageRefs = undefined;
      record.imageRefsGeneratedAt = undefined;
      record.imageRefsModel = undefined;
      record.proseBlendGeneratedAt = undefined;
      record.proseBlendModel = undefined;
      record.validationStale = false;
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
      record.validationStale = false;
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
 * Update story with summary refinement
 */
export async function updateStorySummary(
  storyId: string,
  summary: string,
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number },
  model: string
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

      record.summary = summary;
      record.summaryGeneratedAt = Date.now();
      record.summaryModel = model;
      record.totalEstimatedCost += cost.estimated;
      record.totalActualCost += cost.actual;
      record.totalInputTokens += cost.inputTokens;
      record.totalOutputTokens += cost.outputTokens;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update story summary'));
  });
}

/**
 * Update story with image refs refinement
 */
export async function updateStoryImageRefs(
  storyId: string,
  imageRefs: ChronicleImageRefs,
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number },
  model: string
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

      record.imageRefs = imageRefs;
      record.imageRefsGeneratedAt = Date.now();
      record.imageRefsModel = model;
      record.totalEstimatedCost += cost.estimated;
      record.totalActualCost += cost.actual;
      record.totalInputTokens += cost.inputTokens;
      record.totalOutputTokens += cost.outputTokens;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update story image refs'));
  });
}

/**
 * Update a single image ref within a story (e.g., after generating an image for a prompt request)
 */
export async function updateStoryImageRef(
  storyId: string,
  refId: string,
  updates: {
    status?: 'pending' | 'generating' | 'complete' | 'failed';
    generatedImageId?: string;
    error?: string;
  }
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
      if (!record.imageRefs) {
        reject(new Error(`Story ${storyId} has no image refs`));
        return;
      }

      const refIndex = record.imageRefs.refs.findIndex(r => r.refId === refId);
      if (refIndex === -1) {
        reject(new Error(`Image ref ${refId} not found in story ${storyId}`));
        return;
      }

      const ref = record.imageRefs.refs[refIndex];
      if (ref.type !== 'prompt_request') {
        reject(new Error(`Image ref ${refId} is not a prompt request`));
        return;
      }

      // Apply updates
      if (updates.status !== undefined) ref.status = updates.status;
      if (updates.generatedImageId !== undefined) ref.generatedImageId = updates.generatedImageId;
      if (updates.error !== undefined) ref.error = updates.error;

      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update story image ref'));
  });
}

/**
 * Update story with prose blend refinement
 */
export async function updateStoryProseBlend(
  storyId: string,
  blendedContent: string,
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number },
  model: string
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

      record.assembledContent = blendedContent;
      record.assembledAt = Date.now();
      record.proseBlendGeneratedAt = Date.now();
      record.proseBlendModel = model;
      record.validationStale = Boolean(record.cohesionReport);
      record.summary = undefined;
      record.summaryGeneratedAt = undefined;
      record.summaryModel = undefined;
      record.imageRefs = undefined;
      record.imageRefsGeneratedAt = undefined;
      record.imageRefsModel = undefined;
      record.totalEstimatedCost += cost.estimated;
      record.totalActualCost += cost.actual;
      record.totalInputTokens += cost.inputTokens;
      record.totalOutputTokens += cost.outputTokens;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update story prose blend'));
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
