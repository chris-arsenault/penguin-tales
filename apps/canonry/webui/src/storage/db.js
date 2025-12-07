/**
 * IndexedDB storage layer for Canonry projects.
 */

const DB_NAME = 'canonry';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

let dbInstance = null;

/**
 * Open (or reuse) the IndexedDB database.
 */
export async function openDatabase() {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

/**
 * Save a project to the database.
 */
export async function saveProject(project) {
  const db = await openDatabase();
  const timestamp = new Date().toISOString();

  const projectToSave = {
    ...project,
    updatedAt: timestamp,
    createdAt: project.createdAt || timestamp,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(projectToSave);

    request.onsuccess = () => resolve(projectToSave);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load a project by ID.
 */
export async function loadProject(id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a project by ID.
 */
export async function deleteProject(id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * List all projects (metadata only, sorted by recency).
 */
export async function listProjects() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const projects = request.result.map((p) => ({
        id: p.id,
        name: p.name,
        updatedAt: p.updatedAt,
        entityCount: p.seedEntities?.length || 0,
        cultureCount: p.cultures?.length || 0,
      }));

      // Sort by most recently updated
      projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      resolve(projects);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Create a new empty project with default structure.
 */
export function createEmptyProject(name = 'New World') {
  return {
    id: `project_${Date.now()}`,
    name,
    version: '1.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Schema (Enumerist)
    entityKinds: [],
    relationshipKinds: [],
    // Cultures (Enumerist + Name Forge + Cosmographer)
    cultures: [],
    // Tag Registry (Enumerist)
    tagRegistry: [],
    // Temporal structure (Cosmographer)
    eras: [],
    // Seed data (Cosmographer)
    seedEntities: [],
    seedRelationships: [],
    // Simulation (Simulation Workshop) - optional, undefined until configured
    simulation: undefined,
  };
}
