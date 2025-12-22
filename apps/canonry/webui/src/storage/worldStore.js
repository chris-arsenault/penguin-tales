/**
 * Unified World Store
 *
 * Shared IndexedDB persistence for world data across Lore Weave, Illuminator, and Archivist.
 *
 * Stores per-project:
 * - activeSlotIndex: Currently active slot (0=scratch, 1-4=saved)
 * - slots: Object mapping slot index to slot data
 *   - Each slot contains: title, simulationResults, simulationState, worldData, createdAt
 * - worldContext: Illuminator's world context (name, description, canon facts, tone)
 * - enrichmentConfig: Illuminator's saved settings (shared across slots)
 *
 * Slot behavior:
 * - Slot 0 (scratch): Where new simulations write, working area
 * - Slots 1-4: Save slots, data moved from scratch via saveToSlot()
 */

const DB_NAME = 'canonry-world';
const DB_VERSION = 2;
const STORE_NAME = 'projects';
const LOCAL_PREFIX = 'canonry:world:';

const MAX_SAVE_SLOTS = 4; // Slots 1-4

let dbPromise = null;

function canUseStorage() {
  return typeof localStorage !== 'undefined';
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
  return dbPromise;
}

async function idbSet(projectId, data) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IDB write failed'));
    tx.objectStore(STORE_NAME).put({ projectId, ...data, savedAt: Date.now() });
  });
}

async function idbGet(projectId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(projectId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('IDB read failed'));
  });
}

async function idbDelete(projectId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IDB delete failed'));
    tx.objectStore(STORE_NAME).delete(projectId);
  });
}

function lsKey(projectId) {
  return `${LOCAL_PREFIX}${projectId}`;
}

function lsSet(projectId, data) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(lsKey(projectId), JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    // Best-effort only.
  }
}

function lsGet(projectId) {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(lsKey(projectId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function lsDelete(projectId) {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(lsKey(projectId));
  } catch {
    // Best-effort only.
  }
}

function assertSlotStore(record) {
  if (!record) return null;
  if (!record.slots || typeof record.slots !== 'object') {
    throw new Error('Unsupported world store format: expected slot-based storage.');
  }
  if (record.activeSlotIndex === undefined) {
    throw new Error('Unsupported world store format: missing activeSlotIndex.');
  }
  return record;
}

// =============================================================================
// Public API - Core Store Operations
// =============================================================================

/**
 * Load all persisted data for a project
 */
export async function loadWorldStore(projectId) {
  if (!projectId) return null;
  let record = null;
  try {
    record = await idbGet(projectId);
  } catch {
    // Fall back to localStorage
    record = lsGet(projectId);
  }
  if (!record) record = lsGet(projectId);
  return assertSlotStore(record);
}

/**
 * Save all data for a project (merges with existing)
 */
export async function saveWorldStore(projectId, data) {
  if (!projectId) return;
  let existing = null;
  try {
    existing = await idbGet(projectId);
  } catch {
    existing = null;
  }

  const merged = { ...(assertSlotStore(existing) || { slots: {}, activeSlotIndex: 0 }), ...data };
  delete merged.projectId;

  try {
    await idbSet(projectId, merged);
  } catch {
    const localExisting = assertSlotStore(lsGet(projectId)) || { slots: {}, activeSlotIndex: 0 };
    lsSet(projectId, { ...localExisting, ...data });
  }
}

/**
 * Clear all persisted data for a project
 */
export async function clearWorldStore(projectId) {
  if (!projectId) return;
  try {
    await idbDelete(projectId);
  } catch {
    // Ignore
  }
  lsDelete(projectId);
}

// =============================================================================
// Slot Operations
// =============================================================================

/**
 * Get the active slot index for a project
 */
export async function getActiveSlotIndex(projectId) {
  const store = await loadWorldStore(projectId);
  return store?.activeSlotIndex ?? 0;
}

/**
 * Set the active slot index for a project
 */
export async function setActiveSlotIndex(projectId, slotIndex) {
  await saveWorldStore(projectId, { activeSlotIndex: slotIndex });
}

/**
 * Get all slots for a project
 */
export async function getSlots(projectId) {
  const store = await loadWorldStore(projectId);
  return store?.slots ?? {};
}

/**
 * Get data for a specific slot
 */
export async function getSlot(projectId, slotIndex) {
  const store = await loadWorldStore(projectId);
  return store?.slots?.[slotIndex] ?? null;
}

/**
 * Get data for the currently active slot
 */
export async function getActiveSlot(projectId) {
  const store = await loadWorldStore(projectId);
  const activeIndex = store?.activeSlotIndex ?? 0;
  return store?.slots?.[activeIndex] ?? null;
}

/**
 * Save data to a specific slot
 */
export async function saveSlot(projectId, slotIndex, slotData) {
  const store = await loadWorldStore(projectId) || { slots: {}, activeSlotIndex: 0 };
  const slots = { ...store.slots, [slotIndex]: slotData };
  await saveWorldStore(projectId, { slots });
}

/**
 * Save data to the currently active slot (merges with existing slot data)
 */
export async function saveToActiveSlot(projectId, slotData) {
  const store = await loadWorldStore(projectId) || { slots: {}, activeSlotIndex: 0 };
  const activeIndex = store.activeSlotIndex ?? 0;
  const existingSlot = store.slots?.[activeIndex] ?? {};
  const updatedSlot = { ...existingSlot, ...slotData };
  const slots = { ...store.slots, [activeIndex]: updatedSlot };
  await saveWorldStore(projectId, { slots });
}

/**
 * Move data from scratch (slot 0) to a save slot (1-4)
 * Clears scratch and switches active to the target slot
 */
export async function saveToSlot(projectId, targetSlotIndex) {
  if (targetSlotIndex < 1 || targetSlotIndex > MAX_SAVE_SLOTS) {
    throw new Error(`Invalid save slot: ${targetSlotIndex}. Must be 1-${MAX_SAVE_SLOTS}`);
  }

  const store = await loadWorldStore(projectId) || { slots: {}, activeSlotIndex: 0 };
  const scratchData = store.slots?.[0];

  if (!scratchData || !scratchData.simulationResults) {
    throw new Error('No data in scratch slot to save');
  }

  // Generate title if not present
  const title = scratchData.title && scratchData.title !== 'Scratch'
    ? scratchData.title
    : generateSlotTitle(targetSlotIndex);

  // Move data to target slot
  const slots = {
    ...store.slots,
    [targetSlotIndex]: { ...scratchData, title, savedAt: Date.now() },
    0: null, // Clear scratch
  };

  // Clean up null slot
  delete slots[0];

  await saveWorldStore(projectId, {
    slots,
    activeSlotIndex: targetSlotIndex
  });

  return targetSlotIndex;
}

/**
 * Load a saved slot by switching active index
 */
export async function loadSlot(projectId, slotIndex) {
  const store = await loadWorldStore(projectId);
  if (!store?.slots?.[slotIndex]) {
    throw new Error(`Slot ${slotIndex} is empty`);
  }
  await saveWorldStore(projectId, { activeSlotIndex: slotIndex });
  return slotIndex;
}

/**
 * Clear a specific slot
 */
export async function clearSlot(projectId, slotIndex) {
  const store = await loadWorldStore(projectId) || { slots: {}, activeSlotIndex: 0 };
  const slots = { ...store.slots };
  delete slots[slotIndex];

  // Determine new active slot index
  let newActiveSlotIndex = store.activeSlotIndex;
  if (store.activeSlotIndex === slotIndex) {
    // If clearing the active slot:
    // - If it's slot 0 (scratch), stay on 0 (scratch is conceptually always available)
    // - Otherwise, switch to scratch (0) or first available slot
    if (slotIndex === 0) {
      newActiveSlotIndex = 0;
    } else {
      // Find first available slot (prefer scratch if it exists, otherwise first saved slot)
      const availableSlots = Object.keys(slots).map(Number).sort((a, b) => a - b);
      newActiveSlotIndex = availableSlots.length > 0 ? availableSlots[0] : 0;
    }
  }

  await saveWorldStore(projectId, { slots, activeSlotIndex: newActiveSlotIndex });
}

/**
 * Update the title of a slot
 */
export async function updateSlotTitle(projectId, slotIndex, title) {
  const store = await loadWorldStore(projectId) || { slots: {}, activeSlotIndex: 0 };
  const slot = store.slots?.[slotIndex];
  if (!slot) {
    throw new Error(`Slot ${slotIndex} does not exist`);
  }
  const slots = { ...store.slots, [slotIndex]: { ...slot, title } };
  await saveWorldStore(projectId, { slots });
}

/**
 * Get the next available save slot (1-4), or null if all full
 */
export async function getNextAvailableSlot(projectId) {
  const store = await loadWorldStore(projectId);
  const slots = store?.slots ?? {};
  for (let i = 1; i <= MAX_SAVE_SLOTS; i++) {
    if (!slots[i]) return i;
  }
  return null;
}

/**
 * Generate a default title for a slot
 */
export function generateSlotTitle(slotIndex, timestamp = Date.now()) {
  const date = new Date(timestamp);
  const formatted = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `Run ${slotIndex} - ${formatted}`;
}

// =============================================================================
// Convenience methods - operate on active slot
// =============================================================================

/**
 * Save simulation run data to the active slot
 */
export async function saveSimulationData(projectId, { simulationResults, simulationState }) {
  // Always write new simulations to scratch (slot 0)
  const store = await loadWorldStore(projectId) || { slots: {}, activeSlotIndex: 0 };
  const existingSlot = store.slots?.[0] ?? {};
  const updatedSlot = {
    ...existingSlot,
    simulationResults,
    simulationState,
    title: existingSlot.title || 'Scratch',
    createdAt: existingSlot.createdAt || Date.now(),
  };
  const slots = { ...store.slots, 0: updatedSlot };
  await saveWorldStore(projectId, { slots, activeSlotIndex: 0 });
}

/**
 * Load simulation run data from the active slot
 */
export async function loadSimulationData(projectId) {
  const slot = await getActiveSlot(projectId);
  return {
    simulationResults: slot?.simulationResults || null,
    simulationState: slot?.simulationState || null,
  };
}

/**
 * Save world data to the active slot
 */
export async function saveWorldData(projectId, worldData) {
  await saveToActiveSlot(projectId, { worldData });
}

/**
 * Load world data from the active slot
 */
export async function loadWorldData(projectId) {
  const slot = await getActiveSlot(projectId);
  return slot?.worldData || null;
}

/**
 * Save Illuminator world context (shared across slots)
 */
export async function saveWorldContext(projectId, worldContext) {
  await saveWorldStore(projectId, { worldContext });
}

/**
 * Load Illuminator world context
 */
export async function loadWorldContext(projectId) {
  const store = await loadWorldStore(projectId);
  return store?.worldContext || null;
}

/**
 * Save Illuminator enrichment config (shared across slots)
 */
export async function saveEnrichmentConfig(projectId, enrichmentConfig) {
  await saveWorldStore(projectId, { enrichmentConfig });
}

/**
 * Load Illuminator enrichment config
 */
export async function loadEnrichmentConfig(projectId) {
  const store = await loadWorldStore(projectId);
  return store?.enrichmentConfig || null;
}

/**
 * Save Illuminator prompt templates (shared across slots)
 */
export async function savePromptTemplates(projectId, promptTemplates) {
  await saveWorldStore(projectId, { promptTemplates });
}

/**
 * Load Illuminator prompt templates
 */
export async function loadPromptTemplates(projectId) {
  const store = await loadWorldStore(projectId);
  return store?.promptTemplates || null;
}

