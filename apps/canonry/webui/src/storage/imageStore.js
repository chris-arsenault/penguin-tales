/**
 * Image Store
 *
 * Separate IndexedDB storage for generated images.
 * Images are stored as blobs, referenced by imageId in entity enrichment data.
 *
 * Structure:
 * - Database: canonry-images
 * - Object Store: images (keyed by imageId)
 * - Each record contains: imageId, entityId, projectId, blob, metadata
 */

const DB_NAME = 'canonry-images';
const DB_VERSION = 2;  // Bumped for additional indexes
const STORE_NAME = 'images';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Fresh install - create store with all indexes
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'imageId' });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('entityId', 'entityId', { unique: false });
        store.createIndex('generatedAt', 'generatedAt', { unique: false });
        store.createIndex('entityKind', 'entityKind', { unique: false });
        store.createIndex('entityCulture', 'entityCulture', { unique: false });
        store.createIndex('model', 'model', { unique: false });
      } else if (oldVersion < 2) {
        // Upgrade from v1 - add new indexes for global library search
        const tx = event.target.transaction;
        const store = tx.objectStore(STORE_NAME);
        if (!store.indexNames.contains('entityKind')) {
          store.createIndex('entityKind', 'entityKind', { unique: false });
        }
        if (!store.indexNames.contains('entityCulture')) {
          store.createIndex('entityCulture', 'entityCulture', { unique: false });
        }
        if (!store.indexNames.contains('model')) {
          store.createIndex('model', 'model', { unique: false });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
  return dbPromise;
}

/**
 * Generate a unique image ID
 */
export function generateImageId(entityId) {
  return `img_${entityId}_${Date.now()}`;
}

/**
 * Save an image blob with metadata
 */
export async function saveImage(imageId, blob, metadata) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve(imageId);
    tx.onerror = () => reject(tx.error || new Error('Failed to save image'));

    const record = {
      imageId,
      blob,
      mimeType: blob.type || 'image/png',
      size: blob.size,
      ...metadata,
      savedAt: Date.now(),
    };

    tx.objectStore(STORE_NAME).put(record);
  });
}

/**
 * Load an image by ID and create an object URL
 * Returns { url, metadata } or null if not found
 */
export async function loadImage(imageId) {
  if (!imageId) return null;

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(imageId);
    request.onsuccess = () => {
      const record = request.result;
      if (!record || !record.blob) {
        resolve(null);
        return;
      }

      const url = URL.createObjectURL(record.blob);
      resolve({
        url,
        imageId: record.imageId,
        entityId: record.entityId,
        projectId: record.projectId,
        mimeType: record.mimeType,
        size: record.size,
        generatedAt: record.generatedAt,
        model: record.model,
        originalPrompt: record.originalPrompt,
        finalPrompt: record.finalPrompt,
        revisedPrompt: record.revisedPrompt,
        entityName: record.entityName,
        entityKind: record.entityKind,
        entityCulture: record.entityCulture,
      });
    };
    request.onerror = () => reject(request.error || new Error('Failed to load image'));
  });
}

/**
 * Get image metadata without creating object URL
 */
export async function getImageMetadata(imageId) {
  if (!imageId) return null;

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(imageId);
    request.onsuccess = () => {
      const record = request.result;
      if (!record) {
        resolve(null);
        return;
      }
      // Return metadata without blob
      const { blob, ...metadata } = record;
      resolve(metadata);
    };
    request.onerror = () => reject(request.error || new Error('Failed to get image metadata'));
  });
}

/**
 * Get raw image blob
 */
export async function getImageBlob(imageId) {
  if (!imageId) return null;

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(imageId);
    request.onsuccess = () => {
      const record = request.result;
      resolve(record?.blob || null);
    };
    request.onerror = () => reject(request.error || new Error('Failed to get image blob'));
  });
}

/**
 * Delete a single image
 */
export async function deleteImage(imageId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete image'));
    tx.objectStore(STORE_NAME).delete(imageId);
  });
}

/**
 * Delete multiple images
 */
export async function deleteImages(imageIds) {
  if (!imageIds?.length) return;

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete images'));

    const store = tx.objectStore(STORE_NAME);
    for (const imageId of imageIds) {
      store.delete(imageId);
    }
  });
}

/**
 * Delete all images for a project
 */
export async function deleteImagesByProject(projectId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete project images'));

    const store = tx.objectStore(STORE_NAME);
    const index = store.index('projectId');
    const request = index.openCursor(IDBKeyRange.only(projectId));

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  });
}

/**
 * Get all images (metadata only, no blobs)
 */
export async function getAllImages() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => {
      // Return metadata without blobs to avoid memory issues
      const images = (request.result || []).map(({ blob, ...metadata }) => ({
        ...metadata,
        hasBlob: Boolean(blob),
      }));
      // Sort by generatedAt descending (newest first)
      images.sort((a, b) => (b.generatedAt || 0) - (a.generatedAt || 0));
      resolve(images);
    };
    request.onerror = () => reject(request.error || new Error('Failed to get all images'));
  });
}

/**
 * Get images for a specific project
 */
export async function getImagesByProject(projectId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('projectId');
    const request = index.getAll(IDBKeyRange.only(projectId));

    request.onsuccess = () => {
      const images = (request.result || []).map(({ blob, ...metadata }) => ({
        ...metadata,
        hasBlob: Boolean(blob),
      }));
      images.sort((a, b) => (b.generatedAt || 0) - (a.generatedAt || 0));
      resolve(images);
    };
    request.onerror = () => reject(request.error || new Error('Failed to get project images'));
  });
}

/**
 * Search images with filters (global library search)
 * All filters are optional - returns all images if no filters provided
 *
 * @param {Object} filters
 * @param {string} [filters.projectId] - Filter by project
 * @param {string} [filters.entityKind] - Filter by entity kind (e.g., 'person', 'place')
 * @param {string} [filters.entityCulture] - Filter by culture
 * @param {string} [filters.model] - Filter by generation model
 * @param {string} [filters.searchText] - Search in entityName, prompts
 * @param {number} [filters.limit] - Max results to return
 * @returns {Promise<Array>} Array of image metadata (no blobs)
 */
export async function searchImages(filters = {}) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    // Use the most selective index if available
    let request;
    if (filters.entityKind && store.indexNames.contains('entityKind')) {
      request = store.index('entityKind').getAll(IDBKeyRange.only(filters.entityKind));
    } else if (filters.entityCulture && store.indexNames.contains('entityCulture')) {
      request = store.index('entityCulture').getAll(IDBKeyRange.only(filters.entityCulture));
    } else if (filters.projectId) {
      request = store.index('projectId').getAll(IDBKeyRange.only(filters.projectId));
    } else if (filters.model && store.indexNames.contains('model')) {
      request = store.index('model').getAll(IDBKeyRange.only(filters.model));
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      let images = (request.result || []).map(({ blob, ...metadata }) => ({
        ...metadata,
        hasBlob: Boolean(blob),
      }));

      // Apply remaining filters in memory
      if (filters.projectId && !request.source?.name?.includes('projectId')) {
        images = images.filter((img) => img.projectId === filters.projectId);
      }
      if (filters.entityKind && request.source?.name !== 'entityKind') {
        images = images.filter((img) => img.entityKind === filters.entityKind);
      }
      if (filters.entityCulture && request.source?.name !== 'entityCulture') {
        images = images.filter((img) => img.entityCulture === filters.entityCulture);
      }
      if (filters.model && request.source?.name !== 'model') {
        images = images.filter((img) => img.model === filters.model);
      }

      // Text search in name and prompts
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        images = images.filter((img) =>
          (img.entityName?.toLowerCase().includes(search)) ||
          (img.originalPrompt?.toLowerCase().includes(search)) ||
          (img.finalPrompt?.toLowerCase().includes(search)) ||
          (img.revisedPrompt?.toLowerCase().includes(search))
        );
      }

      // Sort by generatedAt descending (newest first)
      images.sort((a, b) => (b.generatedAt || 0) - (a.generatedAt || 0));

      // Apply limit
      if (filters.limit && filters.limit > 0) {
        images = images.slice(0, filters.limit);
      }

      resolve(images);
    };
    request.onerror = () => reject(request.error || new Error('Failed to search images'));
  });
}

/**
 * Get unique values for a metadata field (for building filter dropdowns)
 * @param {string} field - Field name: 'entityKind', 'entityCulture', 'model', 'projectId'
 * @returns {Promise<Array<string>>} Unique values sorted alphabetically
 */
export async function getImageFilterOptions(field) {
  const validFields = ['entityKind', 'entityCulture', 'model', 'projectId'];
  if (!validFields.includes(field)) {
    throw new Error(`Invalid field: ${field}. Must be one of: ${validFields.join(', ')}`);
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    // Use index if available for efficiency
    if (store.indexNames.contains(field)) {
      const values = new Set();
      const index = store.index(field);
      const request = index.openKeyCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          if (cursor.key) values.add(cursor.key);
          cursor.continue();
        } else {
          resolve([...values].filter(Boolean).sort());
        }
      };
      request.onerror = () => reject(request.error);
    } else {
      // Fallback: scan all records
      const request = store.getAll();
      request.onsuccess = () => {
        const values = new Set();
        for (const record of request.result || []) {
          if (record[field]) values.add(record[field]);
        }
        resolve([...values].sort());
      };
      request.onerror = () => reject(request.error);
    }
  });
}

/**
 * Get storage statistics
 */
export async function getStorageStats() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => {
      const images = request.result || [];

      let totalSize = 0;
      const byProject = {};

      for (const img of images) {
        const size = img.size || 0;
        totalSize += size;

        const pid = img.projectId || 'unknown';
        if (!byProject[pid]) {
          byProject[pid] = { count: 0, size: 0 };
        }
        byProject[pid].count++;
        byProject[pid].size += size;
      }

      resolve({
        totalCount: images.length,
        totalSize,
        byProject,
      });
    };
    request.onerror = () => reject(request.error || new Error('Failed to get storage stats'));
  });
}

/**
 * Check if an image exists
 */
export async function imageExists(imageId) {
  if (!imageId) return false;

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).count(IDBKeyRange.only(imageId));
    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = () => reject(request.error || new Error('Failed to check image'));
  });
}

/**
 * Clear all images (use with caution)
 */
export async function clearAllImages() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to clear images'));
    tx.objectStore(STORE_NAME).clear();
  });
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
