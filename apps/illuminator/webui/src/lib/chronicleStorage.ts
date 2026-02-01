/**
 * Chronicle Storage Module
 *
 * IndexedDB operations for persisting chronicles.
 * Used by workers to save progress immediately, preventing data loss
 * on page navigation.
 */

import type {
  ChronicleFormat,
  ChronicleRoleAssignment,
  NarrativeLens,
  ChronicleFocusType,
  ChronicleStatus,
  ChronicleImageRefs,
  ChronicleCoverImage,
  CohesionReport,
  ChronicleTemporalContext,
  PerspectiveSynthesisRecord,
} from './chronicleTypes';
import type { ChronicleStep } from './enrichmentTypes';
import type { HistorianNote } from './historianTypes';
import type { NarrativeStyle } from '@canonry/world-schema';

// ============================================================================
// Database Configuration
// ============================================================================

const CHRONICLE_DB_NAME = 'canonry-chronicles';
const CHRONICLE_DB_VERSION = 1;
const CHRONICLE_STORE_NAME = 'chronicles';

// ============================================================================
// Types
// ============================================================================

export interface ChronicleRecord {
  chronicleId: string;
  projectId: string;
  /** Unique ID for the simulation run this chronicle belongs to */
  simulationRunId: string;

  // ========================================================================
  // Chronicle Identity (chronicle-first architecture)
  // ========================================================================

  /** User-visible title for the chronicle */
  title: string;

  /** Narrative format (story vs document) */
  format: ChronicleFormat;

  /** Focus type: what is this chronicle about? */
  focusType: ChronicleFocusType;

  /** Role assignments define the chronicle's cast */
  roleAssignments: ChronicleRoleAssignment[];

  /** Optional narrative lens - contextual frame entity (rule, occurrence, ability) */
  lens?: NarrativeLens;

  /** Narrative style ID */
  narrativeStyleId: string;
  /** Narrative style snapshot (stored with the chronicle seed) */
  narrativeStyle?: NarrativeStyle;

  /** Selected entity IDs (all entities in the chronicle) */
  selectedEntityIds: string[];

  /** Selected event IDs */
  selectedEventIds: string[];

  /** Selected relationship IDs (src:dst:kind format) */
  selectedRelationshipIds: string[];

  /** Temporal context including focal era */
  temporalContext?: ChronicleTemporalContext;

  // ========================================================================
  // Mechanical metadata (used for graph traversal, not identity)
  // ========================================================================

  /** Entry point used for candidate discovery - purely mechanical, not displayed */
  entrypointId?: string;

  // ========================================================================
  // Generation metadata
  // ========================================================================

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

  // Content
  assembledContent?: string;
  assembledAt?: number;

  // Generation prompts (stored for debugging/export - the ACTUAL prompts sent)
  generationSystemPrompt?: string;
  generationUserPrompt?: string;
  /** Temperature used for the most recent generation */
  generationTemperature?: number;
  /** Prior generation versions (chronicle regeneration history) */
  generationHistory?: ChronicleGenerationVersion[];
  /** Version id that should be published on accept */
  activeVersionId?: string;

  // Generation context snapshot (stored for export - what was actually used)
  // This is the FINAL context after perspective synthesis, not the original input
  generationContext?: {
    worldName: string;
    worldDescription: string;
    /** The actual tone sent to LLM (post-perspective: assembled + brief + motifs) */
    tone: string;
    /** The actual facts sent to LLM (post-perspective: faceted facts) */
    canonFacts: string[];
    /** Name bank for invented characters */
    nameBank?: Record<string, string[]>;
    /** Synthesized narrative voice from perspective synthesis */
    narrativeVoice?: Record<string, string>;
    /** Per-entity writing directives from perspective synthesis */
    entityDirectives?: Array<{ entityId: string; entityName: string; directive: string }>;
  };

  // Perspective synthesis (required for all new chronicles)
  perspectiveSynthesis?: PerspectiveSynthesisRecord;

  // Cohesion validation
  cohesionReport?: CohesionReport;
  validatedAt?: number;

  // Version comparison report (user-triggered, text only)
  comparisonReport?: string;
  comparisonReportGeneratedAt?: number;
  combineInstructions?: string;

  // Refinements
  summary?: string;
  summaryGeneratedAt?: number;
  summaryModel?: string;
  summaryTargetVersionId?: string;
  imageRefs?: ChronicleImageRefs;
  imageRefsGeneratedAt?: number;
  imageRefsModel?: string;
  imageRefsTargetVersionId?: string;
  coverImage?: ChronicleCoverImage;
  coverImageGeneratedAt?: number;
  coverImageModel?: string;
  validationStale?: boolean;

  // Revision tracking
  editVersion: number;
  editedAt?: number;

  // Final content
  finalContent?: string;
  acceptedAt?: number;

  /** Whether lore from this chronicle has been backported to cast entity descriptions */
  loreBackported?: boolean;

  /** Historian annotations — scholarly margin notes anchored to chronicle text */
  historianNotes?: HistorianNote[];

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

/**
 * Stored snapshot of a chronicle generation version.
 */
export interface ChronicleGenerationVersion {
  versionId: string;
  generatedAt: number;
  content: string;
  wordCount: number;
  model: string;
  temperature?: number;
  systemPrompt: string;
  userPrompt: string;
  cost?: { estimated: number; actual: number; inputTokens: number; outputTokens: number };
}

// ============================================================================
// Database Connection
// ============================================================================

let chronicleDbPromise: Promise<IDBDatabase> | null = null;

function openChronicleDb(): Promise<IDBDatabase> {
  if (chronicleDbPromise) return chronicleDbPromise;

  chronicleDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(CHRONICLE_DB_NAME, CHRONICLE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(CHRONICLE_STORE_NAME)) {
        const store = db.createObjectStore(CHRONICLE_STORE_NAME, { keyPath: 'chronicleId' });

        // Primary indexes (chronicle-first)
        store.createIndex('simulationRunId', 'simulationRunId', { unique: false });
        store.createIndex('projectId', 'projectId', { unique: false });
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

// ============================================================================
// Chronicle Storage Operations
// ============================================================================

/**
 * Generate a unique chronicle ID
 */
export function generateChronicleId(): string {
  return `chronicle_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Derive a title from role assignments
 */
export function deriveTitleFromRoles(roleAssignments: ChronicleRoleAssignment[]): string {
  const primary = roleAssignments.filter((r) => r.isPrimary);
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
export function deriveFocusType(roleAssignments: ChronicleRoleAssignment[]): ChronicleFocusType {
  const primaryCount = roleAssignments.filter((r) => r.isPrimary).length;
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
  format: ChronicleFormat;
  narrativeStyleId: string;
  narrativeStyle?: NarrativeStyle;
  roleAssignments: ChronicleRoleAssignment[];
  lens?: NarrativeLens;
  selectedEntityIds: string[];
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
  temporalContext?: ChronicleTemporalContext;

  // Mechanical (optional)
  entrypointId?: string;
}

/**
 * Create a shell chronicle record before generation starts.
 * This provides immediate UI feedback while generation is in progress.
 */
export async function createChronicleShell(
  chronicleId: string,
  metadata: ChronicleShellMetadata
): Promise<ChronicleRecord> {
  const db = await openChronicleDb();

  const focusType = deriveFocusType(metadata.roleAssignments);
  const title = metadata.title || deriveTitleFromRoles(metadata.roleAssignments);
  const record: ChronicleRecord = {
    chronicleId,
    projectId: metadata.projectId,
    simulationRunId: metadata.simulationRunId,

    // Chronicle identity
    title,
    format: metadata.format,
    focusType,
    narrativeStyleId: metadata.narrativeStyleId,
    narrativeStyle: metadata.narrativeStyle,
    roleAssignments: metadata.roleAssignments,
    lens: metadata.lens,
    selectedEntityIds: metadata.selectedEntityIds,
    selectedEventIds: metadata.selectedEventIds,
    selectedRelationshipIds: metadata.selectedRelationshipIds,
    temporalContext: metadata.temporalContext,

    // Mechanical
    entrypointId: metadata.entrypointId,

    // Generation state - starts as 'generating'
    status: 'generating',
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
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error || new Error('Failed to create chronicle shell'));
    tx.objectStore(CHRONICLE_STORE_NAME).put(record);
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
  format: ChronicleFormat;

  // Generation prompts (the ACTUAL prompts sent to LLM - canonical source of truth)
  generationSystemPrompt?: string;
  generationUserPrompt?: string;
  generationTemperature?: number;
  narrativeStyleId: string;
  narrativeStyle?: NarrativeStyle;
  roleAssignments: ChronicleRoleAssignment[];
  lens?: NarrativeLens;
  selectedEntityIds: string[];
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
  temporalContext?: ChronicleTemporalContext;

  // Mechanical (optional)
  entrypointId?: string;

  // Generation result
  assembledContent: string;
  selectionSummary: {
    entityCount: number;
    eventCount: number;
    relationshipCount: number;
  };
  perspectiveSynthesis?: PerspectiveSynthesisRecord;
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number };
}

/**
 * Create a chronicle record (single-shot generation, goes directly to assembly_ready)
 */
export async function createChronicle(
  chronicleId: string,
  metadata: ChronicleMetadata
): Promise<ChronicleRecord> {
  const db = await openChronicleDb();

  const focusType = deriveFocusType(metadata.roleAssignments);
  const title = metadata.title || deriveTitleFromRoles(metadata.roleAssignments);
  const assembledAt = Date.now();
  const activeVersionId = `current_${assembledAt}`;
  const record: ChronicleRecord = {
    chronicleId,
    projectId: metadata.projectId,
    simulationRunId: metadata.simulationRunId,

    // Chronicle identity
    title,
    format: metadata.format,
    focusType,
    narrativeStyleId: metadata.narrativeStyleId,
    narrativeStyle: metadata.narrativeStyle,
    roleAssignments: metadata.roleAssignments,
    lens: metadata.lens,
    selectedEntityIds: metadata.selectedEntityIds,
    selectedEventIds: metadata.selectedEventIds,
    selectedRelationshipIds: metadata.selectedRelationshipIds,
    temporalContext: metadata.temporalContext,

    // Mechanical
    entrypointId: metadata.entrypointId,

    // Generation result
    selectionSummary: metadata.selectionSummary,
    perspectiveSynthesis: metadata.perspectiveSynthesis,
    generationSystemPrompt: metadata.generationSystemPrompt,
    generationUserPrompt: metadata.generationUserPrompt,
    generationTemperature: metadata.generationTemperature,
    activeVersionId,
    status: 'assembly_ready',
    assembledContent: metadata.assembledContent,
    assembledAt,
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
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error || new Error('Failed to create chronicle'));
    tx.objectStore(CHRONICLE_STORE_NAME).put(record);
  });
}

/**
 * Update chronicle with assembled content (regeneration)
 */
export async function updateChronicleAssembly(
  chronicleId: string,
  assembledContent: string
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
        return;
      }

      record.assembledContent = assembledContent;
      record.assembledAt = Date.now();
      record.status = 'assembly_ready';
      record.failureStep = undefined;
      record.failureReason = undefined;
      record.failedAt = undefined;
      record.summary = undefined;
      record.summaryGeneratedAt = undefined;
      record.summaryModel = undefined;
      record.summaryTargetVersionId = undefined;
      record.imageRefs = undefined;
      record.imageRefsGeneratedAt = undefined;
      record.imageRefsModel = undefined;
      record.imageRefsTargetVersionId = undefined;
      record.coverImage = undefined;
      record.coverImageGeneratedAt = undefined;
      record.coverImageModel = undefined;
      record.validationStale = false;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update chronicle assembly'));
  });
}

function countWords(text: string | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function buildGenerationVersion(record: ChronicleRecord): ChronicleGenerationVersion | null {
  const content = record.finalContent || record.assembledContent || '';
  if (!content) return null;

  return {
    versionId: `version_${record.assembledAt || record.createdAt}`,
    generatedAt: record.assembledAt || record.createdAt,
    content,
    wordCount: countWords(content),
    model: record.model || 'unknown',
    temperature: record.generationTemperature,
    systemPrompt:
      record.generationSystemPrompt ||
      '(prompt not stored - chronicle generated before prompt storage was implemented)',
    userPrompt:
      record.generationUserPrompt ||
      '(prompt not stored - chronicle generated before prompt storage was implemented)',
  };
}

/**
 * Replace chronicle assembled content via temperature regeneration.
 * Preserves prior version in generationHistory and clears refinements.
 */
export async function regenerateChronicleAssembly(
  chronicleId: string,
  updates: {
    assembledContent: string;
    systemPrompt: string;
    userPrompt: string;
    model: string;
    temperature?: number;
    cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number };
  }
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
        return;
      }
      if (record.status === 'complete' || record.finalContent) {
        reject(new Error(`Chronicle ${chronicleId} is already accepted`));
        return;
      }

      const historyVersion = buildGenerationVersion(record);
      if (historyVersion) {
        record.generationHistory = [...(record.generationHistory || []), historyVersion];
      }

      record.assembledContent = updates.assembledContent;
      record.assembledAt = Date.now();
      record.status = 'assembly_ready';
      record.generationSystemPrompt = updates.systemPrompt;
      record.generationUserPrompt = updates.userPrompt;
      record.generationTemperature = updates.temperature;
      record.activeVersionId = `current_${record.assembledAt}`;

      record.failureStep = undefined;
      record.failureReason = undefined;
      record.failedAt = undefined;
      record.cohesionReport = undefined;
      record.validatedAt = undefined;
      record.summary = undefined;
      record.summaryGeneratedAt = undefined;
      record.summaryModel = undefined;
      record.summaryTargetVersionId = undefined;
      record.imageRefs = undefined;
      record.imageRefsGeneratedAt = undefined;
      record.imageRefsModel = undefined;
      record.imageRefsTargetVersionId = undefined;
      record.coverImage = undefined;
      record.coverImageGeneratedAt = undefined;
      record.coverImageModel = undefined;
      record.validationStale = false;
      record.editVersion = 0;
      record.editedAt = undefined;

      record.totalEstimatedCost += updates.cost.estimated;
      record.totalActualCost += updates.cost.actual;
      record.totalInputTokens += updates.cost.inputTokens;
      record.totalOutputTokens += updates.cost.outputTokens;
      record.model = updates.model;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to regenerate chronicle assembly'));
  });
}

/**
 * Update chronicle with revised content (post-validation edits)
 */
export async function updateChronicleEdit(
  chronicleId: string,
  assembledContent: string,
  cost?: { estimated: number; actual: number; inputTokens: number; outputTokens: number }
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
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
      record.coverImage = undefined;
      record.coverImageGeneratedAt = undefined;
      record.coverImageModel = undefined;
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
    tx.onerror = () => reject(tx.error || new Error('Failed to update chronicle edit'));
  });
}

/**
 * Mark chronicle as failed (worker error)
 */
export async function updateChronicleFailure(
  chronicleId: string,
  step: ChronicleStep,
  reason: string
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
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
    tx.onerror = () => reject(tx.error || new Error('Failed to update chronicle failure'));
  });
}

/**
 * Update chronicle with cohesion report (validation complete)
 */
export async function updateChronicleCohesion(
  chronicleId: string,
  cohesionReport: CohesionReport,
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number }
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
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
    tx.onerror = () => reject(tx.error || new Error('Failed to update chronicle cohesion'));
  });
}

/**
 * Store a version comparison report (text analysis, no new draft).
 */
export async function updateChronicleComparisonReport(
  chronicleId: string,
  report: string,
  combineInstructions?: string
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
        return;
      }

      record.comparisonReport = report;
      record.comparisonReportGeneratedAt = Date.now();
      if (combineInstructions) {
        record.combineInstructions = combineInstructions;
      }
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update comparison report'));
  });
}

/**
 * Update chronicle with summary and title refinement
 */
export async function updateChronicleSummary(
  chronicleId: string,
  summary: string,
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number },
  model: string,
  title?: string,
  targetVersionId?: string
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
        return;
      }

      record.summary = summary;
      if (title) {
        record.title = title;
      }
      record.summaryGeneratedAt = Date.now();
      record.summaryModel = model;
      record.summaryTargetVersionId = targetVersionId;
      record.totalEstimatedCost += cost.estimated;
      record.totalActualCost += cost.actual;
      record.totalInputTokens += cost.inputTokens;
      record.totalOutputTokens += cost.outputTokens;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update chronicle summary'));
  });
}

/**
 * Update chronicle with image refs refinement
 */
export async function updateChronicleImageRefs(
  chronicleId: string,
  imageRefs: ChronicleImageRefs,
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number },
  model: string,
  targetVersionId?: string
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
        return;
      }

      record.imageRefs = imageRefs;
      record.imageRefsGeneratedAt = Date.now();
      record.imageRefsModel = model;
      record.imageRefsTargetVersionId = targetVersionId;
      record.totalEstimatedCost += cost.estimated;
      record.totalActualCost += cost.actual;
      record.totalInputTokens += cost.inputTokens;
      record.totalOutputTokens += cost.outputTokens;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update chronicle image refs'));
  });
}

/**
 * Update a single image ref within a chronicle (e.g., after generating an image for a prompt request)
 */
export async function updateChronicleImageRef(
  chronicleId: string,
  refId: string,
  updates: {
    status?: 'pending' | 'generating' | 'complete' | 'failed';
    generatedImageId?: string;
    error?: string;
    anchorText?: string;
    anchorIndex?: number;
    caption?: string;
    size?: 'small' | 'medium' | 'large' | 'full-width';
    justification?: 'left' | 'right' | null;
    sceneDescription?: string;
  }
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
        return;
      }
      if (!record.imageRefs) {
        reject(new Error(`Chronicle ${chronicleId} has no image refs`));
        return;
      }

      const refIndex = record.imageRefs.refs.findIndex((r) => r.refId === refId);
      if (refIndex === -1) {
        reject(new Error(`Image ref ${refId} not found in chronicle ${chronicleId}`));
        return;
      }

      const ref = record.imageRefs.refs[refIndex];
      const wantsPromptUpdates =
        updates.status !== undefined || updates.generatedImageId !== undefined ||
        updates.error !== undefined || updates.sceneDescription !== undefined;

      if (wantsPromptUpdates && ref.type !== 'prompt_request') {
        reject(new Error(`Image ref ${refId} is not a prompt request`));
        return;
      }

      // Apply base updates
      if (updates.anchorText !== undefined) {
        ref.anchorText = updates.anchorText;
        if (updates.anchorIndex === undefined) {
          ref.anchorIndex = undefined;
        }
      }
      if (updates.anchorIndex !== undefined) ref.anchorIndex = updates.anchorIndex;
      if (updates.caption !== undefined) ref.caption = updates.caption;
      if (updates.size !== undefined) ref.size = updates.size;
      if (updates.justification !== undefined) {
        if (updates.justification) {
          ref.justification = updates.justification;
        } else {
          delete ref.justification;
        }
      }

      // Apply prompt request updates
      if (ref.type === 'prompt_request') {
        if (updates.sceneDescription !== undefined) ref.sceneDescription = updates.sceneDescription;
        if (updates.status !== undefined) ref.status = updates.status;
        if (updates.generatedImageId !== undefined) {
          if (updates.generatedImageId) {
            ref.generatedImageId = updates.generatedImageId;
          } else {
            delete ref.generatedImageId;
          }
        }
        if (updates.error !== undefined) {
          if (updates.error) {
            ref.error = updates.error;
          } else {
            delete ref.error;
          }
        }
      }

      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update chronicle image ref'));
  });
}

/**
 * Update chronicle with cover image scene description
 */
export async function updateChronicleCoverImage(
  chronicleId: string,
  coverImage: ChronicleCoverImage,
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number },
  model: string
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
        return;
      }

      record.coverImage = coverImage;
      record.coverImageGeneratedAt = Date.now();
      record.coverImageModel = model;
      record.totalEstimatedCost += cost.estimated;
      record.totalActualCost += cost.actual;
      record.totalInputTokens += cost.inputTokens;
      record.totalOutputTokens += cost.outputTokens;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update chronicle cover image'));
  });
}

/**
 * Update cover image generation status (after image generation completes)
 */
export async function updateChronicleCoverImageStatus(
  chronicleId: string,
  updates: {
    status: 'pending' | 'generating' | 'complete' | 'failed';
    generatedImageId?: string;
    error?: string;
  }
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
        return;
      }
      if (!record.coverImage) {
        reject(new Error(`Chronicle ${chronicleId} has no cover image`));
        return;
      }

      record.coverImage.status = updates.status;
      if (updates.generatedImageId !== undefined) {
        record.coverImage.generatedImageId = updates.generatedImageId || undefined;
      }
      if (updates.error !== undefined) {
        record.coverImage.error = updates.error || undefined;
      }
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update chronicle cover image status'));
  });
}

/**
 * Update chronicle temporal context (e.g., post-publish corrections)
 */
export async function updateChronicleTemporalContext(
  chronicleId: string,
  temporalContext: ChronicleTemporalContext | undefined | null
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
        return;
      }

      if (temporalContext) {
        record.temporalContext = temporalContext;
      } else {
        delete record.temporalContext;
      }
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update chronicle temporal context'));
  });
}

/**
 * Mark chronicle as complete (user accepted)
 */
export async function acceptChronicle(chronicleId: string, finalContent?: string): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
        return;
      }

      record.finalContent = finalContent ?? record.assembledContent;
      record.acceptedAt = Date.now();
      record.status = 'complete';
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to accept chronicle'));
  });
}

/**
 * Unpublish a completed chronicle, reverting it to assembly_ready.
 */
export async function unpublishChronicle(chronicleId: string): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
        return;
      }

      delete record.finalContent;
      delete record.acceptedAt;
      record.status = 'assembly_ready';
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to unpublish chronicle'));
  });
}

/**
 * Update which generation version should be published when accepting.
 */
export async function updateChronicleActiveVersion(
  chronicleId: string,
  versionId: string
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
        return;
      }

      record.activeVersionId = versionId;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update chronicle active version'));
  });
}

/**
 * Manually set or update combine instructions for a chronicle.
 */
export async function updateChronicleCombineInstructions(
  chronicleId: string,
  combineInstructions: string | undefined
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
        return;
      }

      if (combineInstructions) {
        record.combineInstructions = combineInstructions;
      } else {
        delete record.combineInstructions;
      }
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update combine instructions'));
  });
}

/**
 * Mark a chronicle as having had its lore backported to cast entity descriptions.
 */
export async function updateChronicleLoreBackported(
  chronicleId: string,
  loreBackported: boolean
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
        return;
      }

      record.loreBackported = loreBackported;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update chronicle lore backported'));
  });
}

/**
 * Update historian notes on a chronicle.
 */
export async function updateChronicleHistorianNotes(
  chronicleId: string,
  historianNotes: HistorianNote[]
): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
        return;
      }

      record.historianNotes = historianNotes;
      record.updatedAt = Date.now();

      store.put(record);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update chronicle historian notes'));
  });
}

/**
 * Get a chronicle record
 */
export async function getChronicle(chronicleId: string): Promise<ChronicleRecord | undefined> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readonly');
    const req = tx.objectStore(CHRONICLE_STORE_NAME).get(chronicleId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to get chronicle'));
  });
}

/**
 * Get all chronicles for a specific simulation run
 */
export async function getChroniclesForSimulation(simulationRunId: string): Promise<ChronicleRecord[]> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readonly');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const index = store.index('simulationRunId');
    const req = index.getAll(simulationRunId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to get chronicles for simulation'));
  });
}

/**
 * Delete a chronicle
 */
export async function deleteChronicle(chronicleId: string): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete chronicle'));
    tx.objectStore(CHRONICLE_STORE_NAME).delete(chronicleId);
  });
}

/**
 * Delete all chronicles for a simulation run
 */
export async function deleteChroniclesForSimulation(simulationRunId: string): Promise<number> {
  const chronicles = await getChroniclesForSimulation(simulationRunId);
  if (chronicles.length === 0) return 0;

  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);

    for (const chronicle of chronicles) {
      store.delete(chronicle.chronicleId);
    }

    tx.oncomplete = () => resolve(chronicles.length);
    tx.onerror = () => reject(tx.error || new Error('Failed to delete chronicles for simulation'));
  });
}

// ============================================================================
// Entity Rename Support
// ============================================================================

/**
 * Write a fully-updated chronicle record back to IndexedDB.
 * Used by the entity rename flow to persist chronicle patches.
 */
export async function putChronicle(record: ChronicleRecord): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to put chronicle'));
    tx.objectStore(CHRONICLE_STORE_NAME).put(record);
  });
}

// ============================================================================
// Entity Usage Statistics
// ============================================================================

/**
 * Usage statistics for an entity across chronicles
 */
export interface EntityUsageStats {
  entityId: string;
  usageCount: number;
  chronicleIds: string[];
}

/**
 * Compute entity usage statistics from existing chronicles.
 * Returns a map of entityId -> usage stats.
 */
export async function getEntityUsageStats(
  simulationRunId: string
): Promise<Map<string, EntityUsageStats>> {
  const chronicles = await getChroniclesForSimulation(simulationRunId);
  const stats = new Map<string, EntityUsageStats>();

  for (const chronicle of chronicles) {
    // Only count chronicles that have been generated (not just shells)
    if (chronicle.status === 'generating') continue;

    for (const entityId of chronicle.selectedEntityIds) {
      const existing = stats.get(entityId);
      if (existing) {
        existing.usageCount += 1;
        existing.chronicleIds.push(chronicle.chronicleId);
      } else {
        stats.set(entityId, {
          entityId,
          usageCount: 1,
          chronicleIds: [chronicle.chronicleId],
        });
      }
    }
  }

  return stats;
}

// ============================================================================
// Narrative Style Usage Statistics
// ============================================================================

/**
 * Usage statistics for a narrative style across chronicles
 */
export interface NarrativeStyleUsageStats {
  styleId: string;
  usageCount: number;
  chronicleIds: string[];
}

/**
 * Compute narrative style usage statistics from existing chronicles.
 * Returns a map of styleId -> usage stats.
 */
export async function getNarrativeStyleUsageStats(
  simulationRunId: string
): Promise<Map<string, NarrativeStyleUsageStats>> {
  const chronicles = await getChroniclesForSimulation(simulationRunId);
  const stats = new Map<string, NarrativeStyleUsageStats>();

  for (const chronicle of chronicles) {
    if (!chronicle.narrativeStyleId) continue;

    const existing = stats.get(chronicle.narrativeStyleId);
    if (existing) {
      existing.usageCount += 1;
      existing.chronicleIds.push(chronicle.chronicleId);
    } else {
      stats.set(chronicle.narrativeStyleId, {
        styleId: chronicle.narrativeStyleId,
        usageCount: 1,
        chronicleIds: [chronicle.chronicleId],
      });
    }
  }

  return stats;
}

/**
 * Start validation step (user approved assembly)
 */
export async function startChronicleValidation(chronicleId: string): Promise<void> {
  const db = await openChronicleDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHRONICLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHRONICLE_STORE_NAME);
    const getReq = store.get(chronicleId);

    getReq.onsuccess = () => {
      const record = getReq.result as ChronicleRecord | undefined;
      if (!record) {
        reject(new Error(`Chronicle ${chronicleId} not found`));
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
