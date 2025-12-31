/**
 * Static Page Storage Module (Read-only for Chronicler)
 *
 * Reads static pages from IndexedDB. Pages are created/edited
 * in Illuminator, but displayed here in Chronicler.
 */

// ============================================================================
// Database Configuration (same as Illuminator)
// ============================================================================

const STATIC_PAGE_DB_NAME = 'canonry-static-pages';
const STATIC_PAGE_DB_VERSION = 1;
const STATIC_PAGE_STORE_NAME = 'static-pages';

// ============================================================================
// Types (same as Illuminator)
// ============================================================================

export type StaticPageStatus = 'draft' | 'published';

export interface StaticPage {
  pageId: string;
  projectId: string;

  // Content
  title: string;
  slug: string;
  content: string;
  summary?: string;

  // Metadata
  status: StaticPageStatus;
  createdAt: number;
  updatedAt: number;

  // Computed
  linkedEntityIds: string[];
  wordCount: number;
}

// ============================================================================
// Database Connection
// ============================================================================

let staticPageDbPromise: Promise<IDBDatabase> | null = null;

function openStaticPageDb(): Promise<IDBDatabase> {
  if (staticPageDbPromise) return staticPageDbPromise;

  staticPageDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(STATIC_PAGE_DB_NAME, STATIC_PAGE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STATIC_PAGE_STORE_NAME)) {
        const store = db.createObjectStore(STATIC_PAGE_STORE_NAME, { keyPath: 'pageId' });

        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('slug', 'slug', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open static page DB'));
  });

  return staticPageDbPromise;
}

// ============================================================================
// Read-only Storage Operations
// ============================================================================

/**
 * Get a single static page by ID
 */
export async function getStaticPage(pageId: string): Promise<StaticPage | undefined> {
  const db = await openStaticPageDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATIC_PAGE_STORE_NAME, 'readonly');
    const req = tx.objectStore(STATIC_PAGE_STORE_NAME).get(pageId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to get static page'));
  });
}

/**
 * Get published static pages for a project (main read function for Chronicler)
 */
export async function getPublishedStaticPagesForProject(projectId: string): Promise<StaticPage[]> {
  const db = await openStaticPageDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATIC_PAGE_STORE_NAME, 'readonly');
    const store = tx.objectStore(STATIC_PAGE_STORE_NAME);
    const index = store.index('projectId');
    const req = index.getAll(projectId);
    req.onsuccess = () => {
      const pages = (req.result as StaticPage[])
        .filter((page) => page.status === 'published')
        .sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(pages);
    };
    req.onerror = () => reject(req.error || new Error('Failed to get static pages for project'));
  });
}

