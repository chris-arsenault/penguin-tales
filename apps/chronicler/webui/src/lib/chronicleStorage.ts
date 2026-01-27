/**
 * Chronicle Storage - Read-only access to canonry-chronicles IndexedDB
 *
 * Chronicles are stored in the 'canonry-chronicles' database by Illuminator.
 * Chronicler reads completed chronicles directly from here.
 */

// Must match Illuminator's chronicleStorage.ts
const CHRONICLE_DB_NAME = 'canonry-chronicles';
const CHRONICLE_DB_VERSION = 1;
const CHRONICLE_STORE_NAME = 'chronicles';

/**
 * Role assignment (matching illuminator's ChronicleRoleAssignment)
 */
export interface ChronicleRoleAssignment {
  role: string;
  entityId: string;
  entityName: string;
  entityKind: string;
  isPrimary: boolean;
}

/**
 * Chronicle record structure (subset of fields needed for display)
 */
export interface ChronicleRecord {
  chronicleId: string;
  projectId: string;
  simulationRunId: string;

  status: string;

  // Chronicle identity (seed data)
  title: string;
  format: 'story' | 'document';
  focusType: 'single' | 'ensemble' | 'relationship' | 'event';
  narrativeStyleId: string;
  entrypointId?: string;
  roleAssignments: ChronicleRoleAssignment[];
  selectedEntityIds: string[];
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
  temporalContext?: {
    focalEra?: { id: string; name: string; summary?: string };
    chronicleTickRange?: [number, number];
    temporalScope?: string;
    isMultiEra?: boolean;
    touchedEraIds?: string[];
    temporalDescription?: string;
    [key: string]: unknown;
  };

  // Content
  assembledContent?: string;
  finalContent?: string;
  summary?: string;

  // Image refs for inline images
  imageRefs?: {
    refs: Array<{
      refId: string;
      anchorText: string;
      anchorIndex?: number;
      size: 'small' | 'medium' | 'large' | 'full-width';
      justification?: 'left' | 'right';
      caption?: string;
      type: 'entity_ref' | 'prompt_request';
      entityId?: string;
      sceneDescription?: string;
      status?: 'pending' | 'generating' | 'complete' | 'failed';
      generatedImageId?: string;
    }>;
    generatedAt: number;
    model: string;
  };

  // Timestamps
  acceptedAt?: number;
  createdAt: number;
  updatedAt: number;

  // Model info
  model: string;
}

let chronicleDbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open the chronicles database (read-only access)
 */
function openChronicleDb(): Promise<IDBDatabase> {
  if (chronicleDbPromise) return chronicleDbPromise;

  chronicleDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(CHRONICLE_DB_NAME, CHRONICLE_DB_VERSION);

    request.onupgradeneeded = () => {
      // If we're creating/upgrading, the DB doesn't exist or is older
      // Just create the structure - Illuminator will populate it
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

/**
 * Get all completed chronicles for a simulation run
 */
export async function getCompletedChroniclesForSimulation(simulationRunId: string): Promise<ChronicleRecord[]> {
  if (!simulationRunId) return [];

  try {
    const db = await openChronicleDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHRONICLE_STORE_NAME, 'readonly');
      const store = tx.objectStore(CHRONICLE_STORE_NAME);
      const index = store.index('simulationRunId');
      const request = index.getAll(IDBKeyRange.only(simulationRunId));

      request.onsuccess = () => {
        const allChronicles = request.result as ChronicleRecord[];
        // Filter to only completed chronicles
        const completed = allChronicles.filter((c) => c.status === 'complete' && c.acceptedAt);
        // Sort by acceptedAt descending
        completed.sort((a, b) => (b.acceptedAt || 0) - (a.acceptedAt || 0));
        resolve(completed);
      };

      request.onerror = () => reject(request.error || new Error('Failed to get chronicles'));
    });
  } catch (err) {
    console.error('[chronicleStorage] Failed to load chronicles:', err);
    return [];
  }
}

/**
 * Get a single chronicle by ID
 */
export async function getChronicle(chronicleId: string): Promise<ChronicleRecord | null> {
  if (!chronicleId) return null;

  try {
    const db = await openChronicleDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHRONICLE_STORE_NAME, 'readonly');
      const request = tx.objectStore(CHRONICLE_STORE_NAME).get(chronicleId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Failed to get chronicle'));
    });
  } catch (err) {
    console.error('[chronicleStorage] Failed to load chronicle:', err);
    return null;
  }
}

/**
 * Get the content to display for a chronicle
 * Prefers finalContent (accepted), falls back to assembledContent
 */
export function getChronicleContent(chronicle: ChronicleRecord): string {
  return chronicle.finalContent || chronicle.assembledContent || '';
}
