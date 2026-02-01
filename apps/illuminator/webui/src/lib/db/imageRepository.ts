/**
 * Image Repository — Dexie-based replacement for workerStorage image operations.
 *
 * All image CRUD, search, and export functions backed by the unified
 * IlluminatorDatabase instead of raw IndexedDB.
 */

import { db } from './illuminatorDb';
import type {
  ImageType,
  ImageAspect,
  ImageMetadata,
  ImageRecord,
  ImageListItem,
  ImageSearchOptions,
  ImagePromptExport,
} from '../imageTypes';

// Re-export all types so consumers can migrate imports to this module
export type {
  ImageType,
  ImageAspect,
  ImageMetadata,
  ImageRecord,
  ImageListItem,
  ImageSearchOptions,
  ImagePromptExport,
};

const LOG_PREFIX = '[ImageRepository]';

// ============================================================================
// Pure Functions
// ============================================================================

export function generateImageId(entityId: string): string {
  return `img_${entityId}_${Date.now()}`;
}

/**
 * Classify aspect ratio from width/height.
 */
export function classifyAspect(width: number, height: number): ImageAspect {
  const ratio = width / height;
  if (ratio < 0.9) return 'portrait';
  if (ratio > 1.1) return 'landscape';
  return 'square';
}

/**
 * Extract dimensions from an image blob using createImageBitmap (works in workers).
 */
export async function extractImageDimensions(blob: Blob): Promise<{ width: number; height: number; aspect: ImageAspect }> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  bitmap.close();
  return { width, height, aspect: classifyAspect(width, height) };
}

// ============================================================================
// CRUD
// ============================================================================

export async function saveImage(
  imageId: string,
  blob: Blob,
  metadata: ImageMetadata
): Promise<string> {
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

  await db.images.put(record);

  console.log(`${LOG_PREFIX} Image save complete`, {
    imageId,
    entityId: metadata.entityId,
    projectId: metadata.projectId,
    size: blob.size,
  });

  return imageId;
}

export async function deleteImage(imageId: string): Promise<void> {
  await db.images.delete(imageId);
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Search images with pagination — returns metadata only (no blobs).
 */
export async function searchImages(options: ImageSearchOptions = {}): Promise<{
  items: ImageListItem[];
  total: number;
  hasMore: boolean;
}> {
  const { projectId, search, limit = 20, offset = 0 } = options;
  const searchLower = search?.toLowerCase() || '';

  // Fetch candidates — use index when filtering by projectId
  const allRecords = projectId
    ? await db.images.where('projectId').equals(projectId).toArray()
    : await db.images.toArray();

  // Apply search filter (on entityName — lightweight)
  const filtered = searchLower
    ? allRecords.filter((r) => r.entityName && r.entityName.toLowerCase().includes(searchLower))
    : allRecords;

  const total = filtered.length;

  // Paginate and project to lightweight list items (no blob)
  const items: ImageListItem[] = filtered
    .slice(offset, offset + limit)
    .map((r) => ({
      imageId: r.imageId,
      entityId: r.entityId,
      projectId: r.projectId,
      entityName: r.entityName,
      entityKind: r.entityKind,
      generatedAt: r.generatedAt,
    }));

  return {
    items,
    total,
    hasMore: offset + items.length < total,
  };
}

/**
 * Load a single image's dataUrl by ID (on-demand loading).
 */
export async function getImageDataUrl(imageId: string): Promise<string | null> {
  const record = await db.images.get(imageId);
  if (!record?.blob) return null;

  try {
    return await blobToDataUrl(record.blob);
  } catch (err) {
    console.warn(`Failed to convert image ${imageId} to dataUrl:`, err);
    return null;
  }
}

/**
 * Convert blob to data URL.
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
 * Export all image prompt data for analysis.
 * Excludes image blobs to keep export size manageable.
 */
export async function exportImagePrompts(): Promise<ImagePromptExport[]> {
  const records = await db.images.toArray();

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
  return exports;
}

/**
 * Export image prompts and download as JSON file.
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
