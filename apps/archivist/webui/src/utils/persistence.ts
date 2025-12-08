import type { WorldState, LoreData, ImageMetadata } from '../types/world.ts';

const DB_NAME = 'archivist';
const STORE_NAME = 'snapshots';
const SNAPSHOT_KEY = 'latest';
const LOCAL_STORAGE_KEY = 'archivist:snapshot';

export interface ArchivistSnapshot {
  worldData: WorldState;
  loreData: LoreData | null;
  imageData: ImageMetadata | null;
  savedAt: number;
}

const hasIndexedDb = typeof indexedDB !== 'undefined';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

async function idbSet(key: string, value: ArchivistSnapshot): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDB write failed'));
    tx.objectStore(STORE_NAME).put(value, key);
  });
}

async function idbGet(key: string): Promise<ArchivistSnapshot | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve((req.result as ArchivistSnapshot) ?? null);
    req.onerror = () => reject(req.error ?? new Error('IDB read failed'));
  });
}

function lsSet(snapshot: ArchivistSnapshot): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Swallow errors; localStorage is best-effort
  }
}

function lsGet(): ArchivistSnapshot | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ArchivistSnapshot;
  } catch {
    return null;
  }
}

export async function saveSnapshot(snapshot: ArchivistSnapshot): Promise<void> {
  // Try IndexedDB first, fall back to localStorage
  try {
    await idbSet(SNAPSHOT_KEY, snapshot);
  } catch {
    lsSet(snapshot);
  }
}

export async function loadSnapshot(): Promise<ArchivistSnapshot | null> {
  try {
    const snap = await idbGet(SNAPSHOT_KEY);
    if (snap) return snap;
  } catch {
    // Ignore and fall back
  }
  return lsGet();
}
