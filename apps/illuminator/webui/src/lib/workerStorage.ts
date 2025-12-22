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
const IMAGE_DB_VERSION = 1;
const IMAGE_STORE_NAME = 'images';

// ============================================================================
// Database Connection
// ============================================================================

let imageDbPromise: Promise<IDBDatabase> | null = null;

function openImageDb(): Promise<IDBDatabase> {
  if (imageDbPromise) return imageDbPromise;

  imageDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        const store = db.createObjectStore(IMAGE_STORE_NAME, { keyPath: 'imageId' });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('entityId', 'entityId', { unique: false });
        store.createIndex('generatedAt', 'generatedAt', { unique: false });
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
  /** The original prompt sent to the image model */
  prompt?: string;
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
