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
const IMAGE_DB_VERSION = 4;  // Bumped for chronicleId index (must match imageStore.js)
const IMAGE_STORE_NAME = 'images';
const LOG_PREFIX = '[WorkerStorage]';

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
        // Chronicle image indexes (v4)
        store.createIndex('chronicleId', 'chronicleId', { unique: false });
        store.createIndex('imageType', 'imageType', { unique: false });
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

      if (oldVersion < 4) {
        // Upgrade to v4 - add chronicle image indexes
        const tx = (event.target as IDBOpenDBRequest).transaction!;
        const store = tx.objectStore(IMAGE_STORE_NAME);
        if (!store.indexNames.contains('chronicleId')) {
          store.createIndex('chronicleId', 'chronicleId', { unique: false });
        }
        if (!store.indexNames.contains('imageType')) {
          store.createIndex('imageType', 'imageType', { unique: false });
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

/** Type of image: entity (default) or chronicle (scene/illustration) */
export type ImageType = 'entity' | 'chronicle';

/** Image aspect ratio classification */
export type ImageAspect = 'portrait' | 'landscape' | 'square';

export interface ImageMetadata {
  entityId: string;
  projectId: string;
  entityName?: string;
  entityKind?: string;
  entityCulture?: string;
  /** The original prompt built from template (before Claude refinement) */
  originalPrompt?: string;
  /** The full prompt sent to Claude for formatting (template + globalImageRules + original prompt) */
  formattingPrompt?: string;
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

  // Image dimensions (added for aspect-aware display)
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
  /** Aspect ratio classification: portrait (<0.9), square (0.9-1.1), landscape (>1.1) */
  aspect?: ImageAspect;

  // Chronicle image fields (optional, present when imageType === 'chronicle')
  /** Type of image: 'entity' (default) or 'chronicle' */
  imageType?: ImageType;
  /** For chronicle images: the chronicle this belongs to */
  chronicleId?: string;
  /** For chronicle images: the image ref ID from ChronicleImageRefs */
  imageRefId?: string;
  /** For chronicle images: the scene description from the LLM */
  sceneDescription?: string;
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

/**
 * Classify aspect ratio from width/height
 */
export function classifyAspect(width: number, height: number): ImageAspect {
  const ratio = width / height;
  if (ratio < 0.9) return 'portrait';
  if (ratio > 1.1) return 'landscape';
  return 'square';
}

/**
 * Extract dimensions from an image blob using createImageBitmap (works in workers)
 */
export async function extractImageDimensions(blob: Blob): Promise<{ width: number; height: number; aspect: ImageAspect }> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  bitmap.close(); // Release resources
  return { width, height, aspect: classifyAspect(width, height) };
}

export async function saveImage(
  imageId: string,
  blob: Blob,
  metadata: ImageMetadata
): Promise<string> {
  const db = await openImageDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
    tx.oncomplete = () => {
      console.log(`${LOG_PREFIX} Image save complete`, {
        imageId,
        entityId: metadata.entityId,
        projectId: metadata.projectId,
        size: blob.size,
      });
      resolve(imageId);
    };
    tx.onerror = () => {
      console.error(`${LOG_PREFIX} Image save failed`, {
        imageId,
        error: tx.error || new Error('Failed to save image'),
      });
      reject(tx.error || new Error('Failed to save image'));
    };

    const record: ImageRecord = {
      imageId,
      blob,
      mimeType: blob.type || 'image/png',
      size: blob.size,
      ...metadata,
      savedAt: Date.now(),
    };

    console.log(`${LOG_PREFIX} Image save start`, {
      imageId,
      entityId: metadata.entityId,
      projectId: metadata.projectId,
      size: blob.size,
    });
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

/**
 * Lightweight image metadata for listing (no blob data)
 */
export interface ImageListItem {
  imageId: string;
  entityId: string;
  projectId: string;
  entityName?: string;
  entityKind?: string;
  generatedAt: number;
}

/**
 * Search options for paginated image queries
 */
export interface ImageSearchOptions {
  projectId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Search images with pagination - returns metadata only (no blobs)
 * This is efficient for large image libraries.
 */
export async function searchImages(options: ImageSearchOptions = {}): Promise<{
  items: ImageListItem[];
  total: number;
  hasMore: boolean;
}> {
  const { projectId, search, limit = 20, offset = 0 } = options;
  const db = await openImageDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, 'readonly');
    const store = tx.objectStore(IMAGE_STORE_NAME);

    // Use index if filtering by projectId, otherwise scan all
    const source = projectId
      ? store.index('projectId').openCursor(IDBKeyRange.only(projectId))
      : store.openCursor();

    const searchLower = search?.toLowerCase() || '';
    const items: ImageListItem[] = [];
    let total = 0;
    let skipped = 0;

    source.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (cursor) {
        const record = cursor.value as ImageRecord;

        // Apply search filter (on entityName only - lightweight)
        const matches = !searchLower ||
          (record.entityName && record.entityName.toLowerCase().includes(searchLower));

        if (matches) {
          total++;

          // Apply pagination
          if (skipped < offset) {
            skipped++;
          } else if (items.length < limit) {
            // Only extract metadata, not blob
            items.push({
              imageId: record.imageId,
              entityId: record.entityId,
              projectId: record.projectId,
              entityName: record.entityName,
              entityKind: record.entityKind,
              generatedAt: record.generatedAt,
            });
          }
        }

        cursor.continue();
      } else {
        // Done iterating
        resolve({
          items,
          total,
          hasMore: offset + items.length < total,
        });
      }
    };

    source.onerror = () => reject(source.error || new Error('Failed to search images'));
  });
}

/**
 * Load a single image's dataUrl by ID (on-demand loading)
 */
export async function getImageDataUrl(imageId: string): Promise<string | null> {
  const db = await openImageDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, 'readonly');
    const request = tx.objectStore(IMAGE_STORE_NAME).get(imageId);

    request.onsuccess = async () => {
      const record = request.result as ImageRecord | undefined;
      if (!record?.blob) {
        resolve(null);
        return;
      }

      try {
        const dataUrl = await blobToDataUrl(record.blob);
        resolve(dataUrl);
      } catch (err) {
        console.warn(`Failed to convert image ${imageId} to dataUrl:`, err);
        resolve(null);
      }
    };

    request.onerror = () => reject(request.error || new Error('Failed to get image'));
  });
}

/**
 * Convert blob to data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

// ============================================================================
// Bulk Export for Prompt Analysis
// ============================================================================

/**
 * Exported prompt data for analysis (excludes image blob)
 */
export interface ImagePromptExport {
  imageId: string;
  entityId: string;
  entityName?: string;
  entityKind?: string;
  entityCulture?: string;
  generatedAt: number;
  model: string;
  /** The original prompt built from template (before Claude refinement) */
  originalPrompt?: string;
  /** The full prompt sent to Claude for formatting (template + globalImageRules + original prompt) */
  formattingPrompt?: string;
  /** The final prompt sent to image model (after Claude refinement) */
  finalPrompt?: string;
  /** The revised prompt returned by the image model (DALL-E's interpretation) */
  revisedPrompt?: string;
  imageType?: ImageType;
  chronicleId?: string;
  sceneDescription?: string;
}

/**
 * Export all image prompt data for analysis.
 * Useful for diagnosing prompt refinement issues.
 * Excludes image blobs to keep export size manageable.
 */
export async function exportImagePrompts(): Promise<ImagePromptExport[]> {
  const db = await openImageDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, 'readonly');
    const store = tx.objectStore(IMAGE_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result as ImageRecord[];
      const exports: ImagePromptExport[] = records.map((record) => ({
        imageId: record.imageId,
        entityId: record.entityId,
        entityName: record.entityName,
        entityKind: record.entityKind,
        entityCulture: record.entityCulture,
        generatedAt: record.generatedAt,
        model: record.model,
        originalPrompt: record.originalPrompt,
        formattingPrompt: record.formattingPrompt,
        finalPrompt: record.finalPrompt,
        revisedPrompt: record.revisedPrompt,
        imageType: record.imageType,
        chronicleId: record.chronicleId,
        sceneDescription: record.sceneDescription,
      }));
      // Sort by generatedAt descending (newest first)
      exports.sort((a, b) => b.generatedAt - a.generatedAt);
      resolve(exports);
    };

    request.onerror = () => reject(request.error || new Error('Failed to export prompts'));
  });
}

/**
 * Export image prompts and download as JSON file.
 * Call from browser console: (await import('./lib/workerStorage.ts')).downloadImagePromptExport()
 */
export async function downloadImagePromptExport(): Promise<void> {
  const exports = await exportImagePrompts();
  const json = JSON.stringify(exports, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `image-prompts-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`Exported ${exports.length} image prompt records`);
}
