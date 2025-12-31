/**
 * Static Page Storage Module
 *
 * IndexedDB operations for persisting user-authored static pages.
 * These are markdown pages that can link to graph entities but aren't
 * derived from simulation data (e.g., culture overviews, lore articles).
 */

// ============================================================================
// Database Configuration
// ============================================================================

const STATIC_PAGE_DB_NAME = 'canonry-static-pages';
const STATIC_PAGE_DB_VERSION = 1;
const STATIC_PAGE_STORE_NAME = 'static-pages';

// ============================================================================
// Types
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

  // Computed (extracted from content on save)
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
// Utility Functions
// ============================================================================

/**
 * Generate a unique page ID
 */
export function generatePageId(): string {
  return `static_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Generate URL-friendly slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

/**
 * Extract [[Entity Name]] links from markdown content
 */
export function extractEntityLinks(content: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const entityName = match[1].trim();
    if (entityName && !matches.includes(entityName)) {
      matches.push(entityName);
    }
  }

  return matches;
}

/**
 * Count words in content (excluding markdown syntax)
 */
export function countWords(content: string): number {
  // Remove markdown syntax
  const plainText = content
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
    .replace(/\[\[([^\]]+)\]\]/g, '$1') // [[Entity]] -> Entity
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // Remove images
    .replace(/[#*_~`>]/g, '') // Remove formatting chars
    .replace(/\n+/g, ' ') // Normalize whitespace
    .trim();

  if (!plainText) return 0;
  return plainText.split(/\s+/).length;
}

// ============================================================================
// Storage Operations
// ============================================================================

export interface CreateStaticPageInput {
  projectId: string;
  title: string;
  content?: string;
  summary?: string;
  status?: StaticPageStatus;
}

/**
 * Create a new static page
 */
export async function createStaticPage(input: CreateStaticPageInput): Promise<StaticPage> {
  const db = await openStaticPageDb();
  const now = Date.now();
  const content = input.content ?? '';

  const page: StaticPage = {
    pageId: generatePageId(),
    projectId: input.projectId,
    title: input.title,
    slug: generateSlug(input.title),
    content,
    summary: input.summary,
    status: input.status ?? 'draft',
    createdAt: now,
    updatedAt: now,
    linkedEntityIds: extractEntityLinks(content),
    wordCount: countWords(content),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATIC_PAGE_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve(page);
    tx.onerror = () => reject(tx.error || new Error('Failed to create static page'));
    tx.objectStore(STATIC_PAGE_STORE_NAME).put(page);
  });
}

export interface UpdateStaticPageInput {
  title?: string;
  content?: string;
  summary?: string;
  status?: StaticPageStatus;
}

/**
 * Update an existing static page
 */
export async function updateStaticPage(
  pageId: string,
  updates: UpdateStaticPageInput
): Promise<StaticPage> {
  const db = await openStaticPageDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATIC_PAGE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(STATIC_PAGE_STORE_NAME);
    const getReq = store.get(pageId);

    getReq.onsuccess = () => {
      const page = getReq.result as StaticPage | undefined;
      if (!page) {
        reject(new Error(`Static page ${pageId} not found`));
        return;
      }

      if (updates.title !== undefined) {
        page.title = updates.title;
        page.slug = generateSlug(updates.title);
      }
      if (updates.content !== undefined) {
        page.content = updates.content;
        page.linkedEntityIds = extractEntityLinks(updates.content);
        page.wordCount = countWords(updates.content);
      }
      if (updates.summary !== undefined) {
        page.summary = updates.summary;
      }
      if (updates.status !== undefined) {
        page.status = updates.status;
      }
      page.updatedAt = Date.now();

      store.put(page);

      tx.oncomplete = () => resolve(page);
    };

    tx.onerror = () => reject(tx.error || new Error('Failed to update static page'));
  });
}

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
 * Get all static pages for a project
 */
export async function getStaticPagesForProject(projectId: string): Promise<StaticPage[]> {
  const db = await openStaticPageDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATIC_PAGE_STORE_NAME, 'readonly');
    const store = tx.objectStore(STATIC_PAGE_STORE_NAME);
    const index = store.index('projectId');
    const req = index.getAll(projectId);
    req.onsuccess = () => {
      const pages = req.result as StaticPage[];
      // Sort by updatedAt descending (most recent first)
      pages.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(pages);
    };
    req.onerror = () => reject(req.error || new Error('Failed to get static pages for project'));
  });
}

/**
 * Get published static pages for a project (for Chronicler)
 */
export async function getPublishedStaticPagesForProject(projectId: string): Promise<StaticPage[]> {
  const pages = await getStaticPagesForProject(projectId);
  return pages.filter((page) => page.status === 'published');
}

/**
 * Delete a static page
 */
export async function deleteStaticPage(pageId: string): Promise<void> {
  const db = await openStaticPageDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATIC_PAGE_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete static page'));
    tx.objectStore(STATIC_PAGE_STORE_NAME).delete(pageId);
  });
}

/**
 * Delete all static pages for a project
 */
export async function deleteStaticPagesForProject(projectId: string): Promise<number> {
  const pages = await getStaticPagesForProject(projectId);
  if (pages.length === 0) return 0;

  const db = await openStaticPageDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATIC_PAGE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(STATIC_PAGE_STORE_NAME);

    for (const page of pages) {
      store.delete(page.pageId);
    }

    tx.oncomplete = () => resolve(pages.length);
    tx.onerror = () => reject(tx.error || new Error('Failed to delete static pages for project'));
  });
}

