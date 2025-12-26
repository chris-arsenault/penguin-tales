/**
 * Style Library Storage
 *
 * Stores user-customized style libraries in IndexedDB.
 * If no library exists, defaults from world-schema are used.
 * Once saved, user's library is used (no automatic overwrites).
 */

import { createDefaultStyleLibrary } from '@canonry/world-schema';
import type { StyleLibrary, ArtisticStyle, CompositionStyle } from '@canonry/world-schema';

const DB_NAME = 'illuminator-styles';
const DB_VERSION = 1;
const STORE_NAME = 'styleLibrary';
const LIBRARY_KEY = 'current';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
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
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });

  return dbPromise;
}

/**
 * Load style library from IndexedDB
 * Returns null if no library has been saved yet
 */
export async function loadStyleLibrary(): Promise<StyleLibrary | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(LIBRARY_KEY);
    request.onsuccess = () => {
      const result = request.result;
      if (result?.library) {
        resolve(result.library as StyleLibrary);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error || new Error('Failed to load style library'));
  });
}

/**
 * Save style library to IndexedDB
 */
export async function saveStyleLibrary(library: StyleLibrary): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to save style library'));
      tx.objectStore(STORE_NAME).put({
        id: LIBRARY_KEY,
        library,
        savedAt: Date.now(),
      });
    });
  } catch (err) {
    console.error('[StyleLibraryStorage] Failed to save:', err);
    throw err;
  }
}

/**
 * Reset style library to defaults (deletes from IndexedDB)
 */
export async function resetStyleLibrary(): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to reset style library'));
      tx.objectStore(STORE_NAME).delete(LIBRARY_KEY);
    });
  } catch (err) {
    console.error('[StyleLibraryStorage] Failed to reset:', err);
    throw err;
  }
}

/**
 * Get style library - loads from IndexedDB or returns defaults
 */
export async function getStyleLibrary(): Promise<StyleLibrary> {
  const stored = await loadStyleLibrary();
  if (stored) {
    return stored;
  }
  return createDefaultStyleLibrary();
}

/**
 * Check if a custom style library exists in storage
 */
export async function hasCustomStyleLibrary(): Promise<boolean> {
  const stored = await loadStyleLibrary();
  return stored !== null;
}

// Re-export types for convenience
export type { StyleLibrary, ArtisticStyle, CompositionStyle };
