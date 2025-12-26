/**
 * Story Storage - Read-only access to canonry-stories IndexedDB
 *
 * Chronicles are stored in the 'canonry-stories' database by Illuminator.
 * Chronicler reads completed stories directly from here.
 */

// Must match Illuminator's chronicleStorage.ts
const STORY_DB_NAME = 'canonry-stories';
const STORY_DB_VERSION = 6;
const STORY_STORE_NAME = 'stories';

/**
 * Story record structure (subset of fields needed for display)
 */
export interface StoryRecord {
  storyId: string;
  entityId: string;
  entityName: string;
  entityKind: string;
  entityCulture?: string;
  projectId: string;
  simulationRunId: string;

  status: string;

  // Content
  assembledContent?: string;
  finalContent?: string;
  summary?: string;

  // Image refs for inline images
  imageRefs?: {
    refs: Array<{
      refId: string;
      sectionId: string;
      anchorText: string;
      size: 'small' | 'medium' | 'large' | 'full-width';
      caption?: string;
      type: 'entity_ref' | 'prompt_request';
      entityId?: string;
      sceneDescription?: string;
      status?: 'pending' | 'generating' | 'complete' | 'failed';
      generatedImageId?: string;
    }>;
    generatedAt: number;
    model: string;
  };

  // Timestamps
  acceptedAt?: number;
  createdAt: number;
  updatedAt: number;

  // Model info
  model: string;
}

let storyDbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open the stories database (read-only access)
 */
function openStoryDb(): Promise<IDBDatabase> {
  if (storyDbPromise) return storyDbPromise;

  storyDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(STORY_DB_NAME, STORY_DB_VERSION);

    request.onupgradeneeded = () => {
      // If we're creating/upgrading, the DB doesn't exist or is older
      // Just create the structure - Illuminator will populate it
      const db = request.result;
      if (!db.objectStoreNames.contains(STORY_STORE_NAME)) {
        const store = db.createObjectStore(STORY_STORE_NAME, { keyPath: 'storyId' });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('entityId', 'entityId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('simulationRunId', 'simulationRunId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open story DB'));
  });

  return storyDbPromise;
}

/**
 * Get all completed stories for a simulation run
 */
export async function getCompletedStoriesForSimulation(simulationRunId: string): Promise<StoryRecord[]> {
  if (!simulationRunId) return [];

  try {
    const db = await openStoryDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORY_STORE_NAME, 'readonly');
      const store = tx.objectStore(STORY_STORE_NAME);
      const index = store.index('simulationRunId');
      const request = index.getAll(IDBKeyRange.only(simulationRunId));

      request.onsuccess = () => {
        const allStories = request.result as StoryRecord[];
        // Filter to only completed stories
        const completed = allStories.filter(s => s.status === 'complete' && s.acceptedAt);
        // Sort by acceptedAt descending
        completed.sort((a, b) => (b.acceptedAt || 0) - (a.acceptedAt || 0));
        resolve(completed);
      };

      request.onerror = () => reject(request.error || new Error('Failed to get stories'));
    });
  } catch (err) {
    console.error('[storyStorage] Failed to load stories:', err);
    return [];
  }
}

/**
 * Get a single story by ID
 */
export async function getStory(storyId: string): Promise<StoryRecord | null> {
  if (!storyId) return null;

  try {
    const db = await openStoryDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORY_STORE_NAME, 'readonly');
      const request = tx.objectStore(STORY_STORE_NAME).get(storyId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Failed to get story'));
    });
  } catch (err) {
    console.error('[storyStorage] Failed to load story:', err);
    return null;
  }
}

/**
 * Get the content to display for a story
 * Prefers finalContent (accepted), falls back to assembledContent
 */
export function getStoryContent(story: StoryRecord): string {
  return story.finalContent || story.assembledContent || '';
}
