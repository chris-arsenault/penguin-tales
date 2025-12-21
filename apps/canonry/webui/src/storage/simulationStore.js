const DB_NAME = 'canonry-state';
const DB_VERSION = 1;
const STORE_NAME = 'simulationRuns';
const LOCAL_PREFIX = 'canonry:simulationRun:';

let dbPromise = null;

function canUseStorage() {
  return typeof localStorage !== 'undefined';
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
  return dbPromise;
}

async function idbSet(projectId, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IDB write failed'));
    tx.objectStore(STORE_NAME).put({ projectId, run, savedAt: Date.now() });
  });
}

async function idbGet(projectId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(projectId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('IDB read failed'));
  });
}

async function idbDelete(projectId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IDB delete failed'));
    tx.objectStore(STORE_NAME).delete(projectId);
  });
}

function lsKey(projectId) {
  return `${LOCAL_PREFIX}${projectId}`;
}

function lsSet(projectId, run) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(lsKey(projectId), JSON.stringify({ run, savedAt: Date.now() }));
  } catch {
    // Best-effort only.
  }
}

function lsGet(projectId) {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(lsKey(projectId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function lsDelete(projectId) {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(lsKey(projectId));
  } catch {
    // Best-effort only.
  }
}

export async function saveSimulationRun(projectId, run) {
  if (!projectId || !run) return;
  try {
    await idbSet(projectId, run);
  } catch {
    lsSet(projectId, run);
  }
}

export async function loadSimulationRun(projectId) {
  if (!projectId) return null;
  try {
    const record = await idbGet(projectId);
    if (record?.run) return record.run;
  } catch {
    // Ignore and fall back.
  }
  const fallback = lsGet(projectId);
  return fallback?.run || null;
}

export async function clearSimulationRun(projectId) {
  if (!projectId) return;
  try {
    await idbDelete(projectId);
  } catch {
    // Ignore and fall back.
  }
  lsDelete(projectId);
}
