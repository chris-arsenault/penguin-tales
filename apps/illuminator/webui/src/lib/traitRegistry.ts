/**
 * Trait Registry - IndexedDB storage for visual trait palettes and usage tracking
 *
 * Scoping:
 * - Palettes are project + entityKind scoped (persist across simulation runs)
 * - Used traits are project + simulationRunId + entityKind scoped (run-specific)
 * - Historical queries can span all runs for palette expansion
 */

// ============================================================================
// Types
// ============================================================================

export interface PaletteItem {
  id: string;
  category: string;
  description: string;
  examples: string[];
  timesUsed: number;
  addedAt: number;
  /** Subtypes this category is relevant for (empty = all subtypes) */
  subtypes?: string[];
}

export interface TraitPalette {
  id: string;                   // `${projectId}_${entityKind}`
  projectId: string;
  entityKind: string;
  items: PaletteItem[];
  updatedAt: number;
}

export interface UsedTraitRecord {
  id: string;                   // `${projectId}_${simulationRunId}_${entityKind}_${entityId}`
  projectId: string;
  simulationRunId: string;
  entityKind: string;
  entityId: string;
  entityName: string;
  traits: string[];
  registeredAt: number;
}

export interface TraitGuidance {
  /** 1-2 categories positively assigned for this entity to focus on */
  assignedCategories: PaletteItem[];
  /** Category usage counts for transparency (debugging/UI) */
  categoryUsage: Record<string, number>;
  /** Selection method used */
  selectionMethod: 'weighted-random' | 'llm-selected' | 'fallback';
}

// ============================================================================
// Database Configuration
// ============================================================================

const TRAIT_DB_NAME = 'canonry-traits';
const TRAIT_DB_VERSION = 1;
const PALETTE_STORE = 'palettes';
const USED_TRAITS_STORE = 'usedTraits';

// ============================================================================
// Database Connection
// ============================================================================

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(TRAIT_DB_NAME, TRAIT_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // Palettes store: keyed by projectId_entityKind
      if (!db.objectStoreNames.contains(PALETTE_STORE)) {
        const paletteStore = db.createObjectStore(PALETTE_STORE, { keyPath: 'id' });
        paletteStore.createIndex('projectId', 'projectId', { unique: false });
        paletteStore.createIndex('entityKind', 'entityKind', { unique: false });
      }

      // Used traits store: keyed by projectId_simulationRunId_entityKind_entityId
      if (!db.objectStoreNames.contains(USED_TRAITS_STORE)) {
        const usedStore = db.createObjectStore(USED_TRAITS_STORE, { keyPath: 'id' });
        usedStore.createIndex('projectId', 'projectId', { unique: false });
        usedStore.createIndex('simulationRunId', 'simulationRunId', { unique: false });
        usedStore.createIndex('entityKind', 'entityKind', { unique: false });
        // Compound index for run-scoped queries
        usedStore.createIndex('projectId_simulationRunId_entityKind',
          ['projectId', 'simulationRunId', 'entityKind'], { unique: false });
        // Compound index for historical queries (all runs)
        usedStore.createIndex('projectId_entityKind',
          ['projectId', 'entityKind'], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open trait DB'));
  });

  return dbPromise;
}

// ============================================================================
// Palette Operations
// ============================================================================

function paletteId(projectId: string, entityKind: string): string {
  return `${projectId}_${entityKind}`;
}

export async function getPalette(
  projectId: string,
  entityKind: string
): Promise<TraitPalette | null> {
  const db = await openDb();
  const id = paletteId(projectId, entityKind);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PALETTE_STORE, 'readonly');
    const request = tx.objectStore(PALETTE_STORE).get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function savePalette(palette: TraitPalette): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PALETTE_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    tx.objectStore(PALETTE_STORE).put({
      ...palette,
      updatedAt: Date.now(),
    });
  });
}

export async function updatePaletteItems(
  projectId: string,
  entityKind: string,
  updates: {
    removeIds?: string[];
    merges?: Array<{ keepId: string; mergeFromIds: string[]; newDescription: string }>;
    newItems?: Omit<PaletteItem, 'id' | 'timesUsed' | 'addedAt'>[];
  }
): Promise<TraitPalette> {
  const existing = await getPalette(projectId, entityKind);
  const items = existing?.items || [];
  const now = Date.now();

  // Remove specified items
  let filtered = items.filter(item => !updates.removeIds?.includes(item.id));

  // Apply merges
  for (const merge of updates.merges || []) {
    const keepItem = filtered.find(i => i.id === merge.keepId);
    if (keepItem) {
      keepItem.description = merge.newDescription;
      // Sum up timesUsed from merged items
      const mergedItems = items.filter(i => merge.mergeFromIds.includes(i.id));
      keepItem.timesUsed += mergedItems.reduce((sum, i) => sum + i.timesUsed, 0);
    }
    // Remove the merged-from items
    filtered = filtered.filter(i => !merge.mergeFromIds.includes(i.id));
  }

  // Add new items
  for (const newItem of updates.newItems || []) {
    filtered.push({
      id: `palette_${now}_${Math.random().toString(36).slice(2, 8)}`,
      category: newItem.category,
      description: newItem.description,
      examples: newItem.examples,
      subtypes: newItem.subtypes,
      timesUsed: 0,
      addedAt: now,
    });
  }

  const palette: TraitPalette = {
    id: paletteId(projectId, entityKind),
    projectId,
    entityKind,
    items: filtered,
    updatedAt: now,
  };

  await savePalette(palette);
  return palette;
}

export async function incrementPaletteUsage(
  projectId: string,
  entityKind: string,
  traits: string[]
): Promise<void> {
  const palette = await getPalette(projectId, entityKind);
  if (!palette || palette.items.length === 0) return;

  // Simple heuristic: if any trait text contains words from a category/examples, increment
  const traitLower = traits.map(t => t.toLowerCase()).join(' ');
  let updated = false;

  for (const item of palette.items) {
    const categoryWords = item.category.toLowerCase().split(/\s+/);
    const exampleWords = item.examples.flatMap(e => e.toLowerCase().split(/\s+/));
    const allWords = [...categoryWords, ...exampleWords];

    // If 2+ significant words match, count as usage
    const matches = allWords.filter(w => w.length > 4 && traitLower.includes(w));
    if (matches.length >= 2) {
      item.timesUsed += 1;
      updated = true;
    }
  }

  if (updated) {
    await savePalette(palette);
  }
}

// ============================================================================
// Used Traits Operations
// ============================================================================

function usedTraitId(
  projectId: string,
  simulationRunId: string,
  entityKind: string,
  entityId: string
): string {
  return `${projectId}_${simulationRunId}_${entityKind}_${entityId}`;
}

export async function registerUsedTraits(
  projectId: string,
  simulationRunId: string,
  entityKind: string,
  entityId: string,
  entityName: string,
  traits: string[]
): Promise<void> {
  if (traits.length === 0) return;

  const db = await openDb();
  const id = usedTraitId(projectId, simulationRunId, entityKind, entityId);

  const record: UsedTraitRecord = {
    id,
    projectId,
    simulationRunId,
    entityKind,
    entityId,
    entityName,
    traits,
    registeredAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(USED_TRAITS_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    tx.objectStore(USED_TRAITS_STORE).put(record);
  });
}

/**
 * Get used traits for current run (for "avoid these" guidance)
 */
export async function getUsedTraitsForRun(
  projectId: string,
  simulationRunId: string,
  entityKind: string
): Promise<UsedTraitRecord[]> {
  // Validate keys - all must be non-empty strings
  if (!projectId || !simulationRunId || !entityKind) {
    return [];
  }

  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(USED_TRAITS_STORE, 'readonly');
    const store = tx.objectStore(USED_TRAITS_STORE);
    const index = store.index('projectId_simulationRunId_entityKind');
    const keyRange = IDBKeyRange.only([projectId, simulationRunId, entityKind]);
    const request = index.getAll(keyRange);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all historical traits for this kind (across all runs, for palette expansion)
 */
export async function getHistoricalTraits(
  projectId: string,
  entityKind: string
): Promise<string[]> {
  // Validate keys
  if (!projectId || !entityKind) {
    return [];
  }

  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(USED_TRAITS_STORE, 'readonly');
    const store = tx.objectStore(USED_TRAITS_STORE);
    const index = store.index('projectId_entityKind');
    const keyRange = IDBKeyRange.only([projectId, entityKind]);
    const request = index.getAll(keyRange);

    request.onsuccess = () => {
      const records = request.result as UsedTraitRecord[];
      const allTraits = records.flatMap(r => r.traits);
      resolve(allTraits);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Count used traits for auto-trigger threshold
 */
export async function countUsedTraits(
  projectId: string,
  entityKind: string
): Promise<number> {
  // Validate keys
  if (!projectId || !entityKind) {
    return 0;
  }

  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(USED_TRAITS_STORE, 'readonly');
    const store = tx.objectStore(USED_TRAITS_STORE);
    const index = store.index('projectId_entityKind');
    const keyRange = IDBKeyRange.only([projectId, entityKind]);
    const request = index.count(keyRange);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// Trait Guidance (for description generation)
// ============================================================================

/**
 * Weighted random selection of categories
 * Categories with fewer uses have higher probability of being selected
 */
function selectCategoriesWeighted(
  items: PaletteItem[],
  count: number
): PaletteItem[] {
  if (items.length === 0) return [];
  if (items.length <= count) return [...items];

  // Calculate weights: inverse of usage + 1 (so 0 uses = weight 1, 1 use = weight 0.5, etc.)
  const maxUsage = Math.max(...items.map(i => i.timesUsed), 1);
  const weights = items.map(item => {
    // Higher weight for less used categories
    // Add 1 to avoid division by zero, then invert
    return (maxUsage + 1) / (item.timesUsed + 1);
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const selected: PaletteItem[] = [];
  const availableIndices = items.map((_, i) => i);

  for (let i = 0; i < count && availableIndices.length > 0; i++) {
    // Weighted random selection
    let random = Math.random() * totalWeight;
    let selectedIdx = 0;

    for (let j = 0; j < availableIndices.length; j++) {
      const idx = availableIndices[j];
      random -= weights[idx];
      if (random <= 0) {
        selectedIdx = j;
        break;
      }
    }

    const itemIdx = availableIndices[selectedIdx];
    selected.push(items[itemIdx]);
    availableIndices.splice(selectedIdx, 1);
  }

  return selected;
}

/**
 * Get trait guidance for description generation
 * Uses positive assignment: selects 1-2 categories for this entity to focus on
 * Filters by subtype if provided
 */
export async function getTraitGuidance(
  projectId: string,
  simulationRunId: string,
  entityKind: string,
  subtype?: string
): Promise<TraitGuidance> {
  // Get palette (project-scoped)
  const palette = await getPalette(projectId, entityKind);
  let items = palette?.items || [];

  // Build usage map for transparency (before filtering)
  const categoryUsage: Record<string, number> = {};
  for (const item of items) {
    categoryUsage[item.category] = item.timesUsed;
  }

  // Filter by subtype if provided
  // Categories with no subtypes defined apply to all subtypes
  // Categories with subtypes defined only apply if the entity's subtype matches
  if (subtype && items.length > 0) {
    const subtypeLower = subtype.toLowerCase();
    items = items.filter(item => {
      // No subtypes specified = applies to all
      if (!item.subtypes || item.subtypes.length === 0) {
        return true;
      }
      // Check if entity subtype matches any of the category's subtypes
      return item.subtypes.some(s => s.toLowerCase() === subtypeLower);
    });
  }

  // If no palette exists (or all filtered out), return fallback guidance
  if (items.length === 0) {
    return {
      assignedCategories: [],
      categoryUsage,
      selectionMethod: 'fallback',
    };
  }

  // Select 1-2 categories using weighted random (fewer uses = higher chance)
  const numCategories = items.length >= 2 ? 2 : 1;
  const assigned = selectCategoriesWeighted(items, numCategories);

  return {
    assignedCategories: assigned,
    categoryUsage,
    selectionMethod: 'weighted-random',
  };
}

// ============================================================================
// Cleanup / Export
// ============================================================================

/**
 * Delete all used traits for a specific run (cleanup after run deletion)
 */
export async function deleteUsedTraitsForRun(
  projectId: string,
  simulationRunId: string
): Promise<number> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(USED_TRAITS_STORE, 'readwrite');
    const store = tx.objectStore(USED_TRAITS_STORE);
    const index = store.index('simulationRunId');
    const request = index.openCursor(IDBKeyRange.only(simulationRunId));

    let deletedCount = 0;

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const record = cursor.value as UsedTraitRecord;
        if (record.projectId === projectId) {
          cursor.delete();
          deletedCount++;
        }
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(deletedCount);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Export all palettes for a project (for backup/migration)
 */
export async function exportPalettes(projectId: string): Promise<TraitPalette[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PALETTE_STORE, 'readonly');
    const store = tx.objectStore(PALETTE_STORE);
    const index = store.index('projectId');
    const request = index.getAll(projectId);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Import palettes (for restore/migration)
 */
export async function importPalettes(palettes: TraitPalette[]): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PALETTE_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    const store = tx.objectStore(PALETTE_STORE);
    for (const palette of palettes) {
      store.put(palette);
    }
  });
}
