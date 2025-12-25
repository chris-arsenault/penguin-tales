/**
 * Worker-Accessible Storage Module
 *
 * IndexedDB operations that can be called from both main thread and workers.
 * By having workers persist directly, we minimize the window for data loss
 * when users navigate away mid-operation.
 */

// ============================================================================
// Database Configuration
// ============================================================================

const IMAGE_DB_NAME = 'canonry-images';
const IMAGE_DB_VERSION = 2;  // Bumped for additional indexes (must match imageStore.js)
const IMAGE_STORE_NAME = 'images';

// ============================================================================
// Database Connection
// ============================================================================

let imageDbPromise: Promise<IDBDatabase> | null = null;

function openImageDb(): Promise<IDBDatabase> {
  if (imageDbPromise) return imageDbPromise;

  imageDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

      if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        // Fresh install - create store with all indexes
        const store = db.createObjectStore(IMAGE_STORE_NAME, { keyPath: 'imageId' });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('entityId', 'entityId', { unique: false });
        store.createIndex('generatedAt', 'generatedAt', { unique: false });
        store.createIndex('entityKind', 'entityKind', { unique: false });
        store.createIndex('entityCulture', 'entityCulture', { unique: false });
        store.createIndex('model', 'model', { unique: false });
      } else if (oldVersion < 2) {
        // Upgrade from v1 - add new indexes for global library search
        const tx = (event.target as IDBOpenDBRequest).transaction!;
        const store = tx.objectStore(IMAGE_STORE_NAME);
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
    request.onerror = () => reject(request.error || new Error('Failed to open image DB'));
  });

  return imageDbPromise;
}

// ============================================================================
// Image Storage (compatible with canonry imageStore)
// ============================================================================

export interface ImageMetadata {
  entityId: string;
  projectId: string;
  entityName?: string;
  entityKind?: string;
  entityCulture?: string;
  /** The original prompt built from template (before Claude refinement) */
  originalPrompt?: string;
  /** The final prompt sent to image model (after Claude refinement, or same as original if no refinement) */
  finalPrompt?: string;
  generatedAt: number;
  model: string;
  /** The revised prompt returned by the model (DALL-E) */
  revisedPrompt?: string;
  estimatedCost?: number;
  actualCost?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ImageRecord extends ImageMetadata {
  imageId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  savedAt: number;
}

export function generateImageId(entityId: string): string {
  return `img_${entityId}_${Date.now()}`;
}

export async function saveImage(
  imageId: string,
  blob: Blob,
  metadata: ImageMetadata
): Promise<string> {
  const db = await openImageDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve(imageId);
    tx.onerror = () => reject(tx.error || new Error('Failed to save image'));

    const record: ImageRecord = {
      imageId,
      blob,
      mimeType: blob.type || 'image/png',
      size: blob.size,
      ...metadata,
      savedAt: Date.now(),
    };

    tx.objectStore(IMAGE_STORE_NAME).put(record);
  });
}

export async function deleteImage(imageId: string): Promise<void> {
  const db = await openImageDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete image'));
    tx.objectStore(IMAGE_STORE_NAME).delete(imageId);
  });
}
