/**
 * IndexedDB Storage Layer for NameForge
 *
 * Provides persistent storage for projects in the browser.
 */

const DB_NAME = 'nameforge';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

let dbInstance = null;

/**
 * Open or create the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export async function openDatabase() {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create projects store with id as key
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

/**
 * Save a project to IndexedDB
 * @param {import('./types').NameForgeProject} project
 * @returns {Promise<void>}
 */
export async function saveProject(project) {
  const db = await openDatabase();

  // Update timestamp
  project.updatedAt = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(project);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to save project'));
  });
}

/**
 * Load a project by ID
 * @param {string} id
 * @returns {Promise<import('./types').NameForgeProject|null>}
 */
export async function loadProject(id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('Failed to load project'));
  });
}

/**
 * Delete a project by ID
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteProject(id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete project'));
  });
}

/**
 * List all projects (metadata only for performance)
 * @returns {Promise<Array<{id: string, name: string, updatedAt: string}>>}
 */
export async function listProjects() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const projects = request.result || [];
      // Return only metadata for listing
      const metadata = projects.map(p => ({
        id: p.id,
        name: p.name,
        updatedAt: p.updatedAt,
        cultureCount: Object.keys(p.cultures || {}).length
      }));
      // Sort by most recently updated
      metadata.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      resolve(metadata);
    };
    request.onerror = () => reject(new Error('Failed to list projects'));
  });
}

/**
 * Check if a project exists by ID
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function projectExists(id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count(IDBKeyRange.only(id));

    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = () => reject(new Error('Failed to check project existence'));
  });
}

/**
 * Check if IndexedDB is available
 * @returns {boolean}
 */
export function isIndexedDBAvailable() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Clear all projects (use with caution)
 * @returns {Promise<void>}
 */
export async function clearAllProjects() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to clear projects'));
  });
}
