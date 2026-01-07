import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ArchivistHost from './remotes/ArchivistHost.jsx';
import ChroniclerHost from './remotes/ChroniclerHost.jsx';

const DEFAULT_BUNDLE_PATH = 'bundles/default/bundle.json';
const DEFAULT_BUNDLE_MANIFEST_PATH = 'bundles/default/bundle.manifest.json';
const CHRONICLER_HASH_PREFIX = '#/page/';

function deriveViewFromHash(hash) {
  if (!hash || hash === '#/' || hash === '#') return 'chronicler';
  if (hash.startsWith(CHRONICLER_HASH_PREFIX)) return 'chronicler';
  if (hash === '#/chronicler') return 'chronicler';
  if (hash === '#/archivist') return 'archivist';
  return 'chronicler';
}

function resolveBaseUrl() {
  const base = import.meta.env.BASE_URL || './';
  const resolved = new URL(base, window.location.href);
  if (!resolved.pathname.endsWith('/')) {
    resolved.pathname = `${resolved.pathname}/`;
  }
  resolved.search = '';
  resolved.hash = '';
  return resolved.toString();
}

function resolveBundleUrl() {
  const baseUrl = resolveBaseUrl();
  return new URL(DEFAULT_BUNDLE_PATH, baseUrl).toString();
}

function resolveBundleManifestUrl() {
  const baseUrl = resolveBaseUrl();
  return new URL(DEFAULT_BUNDLE_MANIFEST_PATH, baseUrl).toString();
}

function resolveAssetUrl(value, bundleUrl) {
  if (!value || typeof value !== 'string') return value;
  try {
    return new URL(value, bundleUrl).toString();
  } catch {
    return value;
  }
}

function normalizeBundle(raw, bundleUrl) {
  if (!raw || typeof raw !== 'object') return null;

  const baseUrl = new URL('.', bundleUrl).toString();
  const resolveUrl = (value) => resolveAssetUrl(value, baseUrl);

  const imageResults = Array.isArray(raw.imageData?.results)
    ? raw.imageData.results.map((image) => ({
      ...image,
      localPath: resolveUrl(image.localPath),
    }))
    : [];

  const images = raw.images && typeof raw.images === 'object'
    ? Object.fromEntries(
      Object.entries(raw.images).map(([imageId, path]) => [imageId, resolveUrl(path)])
    )
    : null;

  const imageData = raw.imageData
    ? {
      ...raw.imageData,
      results: imageResults,
      totalImages: Number.isFinite(raw.imageData.totalImages)
        ? raw.imageData.totalImages
        : imageResults.length,
    }
    : null;

  return {
    ...raw,
    chronicles: Array.isArray(raw.chronicles) ? raw.chronicles : [],
    staticPages: Array.isArray(raw.staticPages) ? raw.staticPages : [],
    images,
    imageData,
  };
}

async function fetchJson(url, { cache } = {}) {
  const response = await fetch(url, { cache: cache ?? 'default' });
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status})`);
  }
  return response.json();
}

function extractChunkItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export default function App() {
  const [activeView, setActiveView] = useState(() => deriveViewFromHash(window.location.hash));
  const [bundle, setBundle] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [bundleRequestUrl, setBundleRequestUrl] = useState(() => resolveBundleUrl());
  const [chunkPlan, setChunkPlan] = useState(null);
  const loadSequence = useRef(0);
  const chunkLoadStarted = useRef(false);
  const lastChroniclerHashRef = useRef(
    window.location.hash.startsWith(CHRONICLER_HASH_PREFIX) ? window.location.hash : null
  );

  const bundleManifestUrl = useMemo(() => resolveBundleManifestUrl(), []);
  const bundleFallbackUrl = useMemo(() => resolveBundleUrl(), []);

  const loadBundle = useCallback(async () => {
    const sequence = ++loadSequence.current;
    chunkLoadStarted.current = false;
    setChunkPlan(null);
    setStatus('loading');
    setError(null);

    try {
      setBundleRequestUrl(bundleManifestUrl);
      const manifest = await fetchJson(bundleManifestUrl, { cache: 'no-store' });
      if (sequence !== loadSequence.current) return;
      if (!manifest || manifest.format !== 'viewer-bundle-manifest') {
        throw new Error('Bundle manifest missing or invalid.');
      }

      const manifestBaseUrl = new URL('.', bundleManifestUrl).toString();
      const corePath = manifest.core;
      if (typeof corePath !== 'string') {
        throw new Error('Bundle manifest is missing core path.');
      }
      const coreUrl = resolveAssetUrl(corePath, manifestBaseUrl);
      setBundleRequestUrl(coreUrl);
      const data = await fetchJson(coreUrl, { cache: 'no-store' });
      if (sequence !== loadSequence.current) return;

      const normalized = normalizeBundle(data, coreUrl);
      if (!normalized?.worldData) {
        throw new Error('Bundle is missing worldData.');
      }
      if (!Array.isArray(normalized.worldData.narrativeHistory)) {
        normalized.worldData.narrativeHistory = [];
      }
      setBundle(normalized);
      setStatus('ready');

      const chunkFiles = Array.isArray(manifest?.chunks?.narrativeHistory?.files)
        ? manifest.chunks.narrativeHistory.files
        : [];
      if (chunkFiles.length > 0) {
        setChunkPlan({ baseUrl: manifestBaseUrl, files: chunkFiles });
      }
      return;
    } catch (err) {
      console.warn('Viewer: failed to load bundle manifest, falling back to bundle.json.', err);
    }

    try {
      setBundleRequestUrl(bundleFallbackUrl);
      const data = await fetchJson(bundleFallbackUrl, { cache: 'no-store' });
      if (sequence !== loadSequence.current) return;
      const normalized = normalizeBundle(data, bundleFallbackUrl);
      if (!normalized?.worldData) {
        throw new Error('Bundle is missing worldData.');
      }
      setBundle(normalized);
      setStatus('ready');
    } catch (err) {
      if (sequence !== loadSequence.current) return;
      setStatus('error');
      setError(err);
    }
  }, [bundleManifestUrl, bundleFallbackUrl]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      await loadBundle();
      if (cancelled) return;
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [loadBundle]);

  useEffect(() => {
    if (!chunkPlan || chunkLoadStarted.current) return;
    if (!bundle?.worldData) return;
    if (!chunkPlan.files.length) return;

    chunkLoadStarted.current = true;
    const sequence = loadSequence.current;
    let cancelled = false;

    const loadChunks = async () => {
      for (const file of chunkPlan.files) {
        if (cancelled || sequence !== loadSequence.current) return;
        const chunkPath = typeof file?.path === 'string' ? file.path : null;
        if (!chunkPath) continue;
        const chunkUrl = resolveAssetUrl(chunkPath, chunkPlan.baseUrl);
        try {
          const response = await fetch(chunkUrl, { cache: 'force-cache' });
          if (!response.ok) {
            console.warn(`Viewer: narrativeHistory chunk fetch failed (${response.status}).`, chunkUrl);
            continue;
          }
          const payload = await response.json();
          const items = extractChunkItems(payload);
          if (!items.length) continue;
          if (cancelled || sequence !== loadSequence.current) return;

          setBundle((prev) => {
            if (!prev?.worldData) return prev;
            const existing = Array.isArray(prev.worldData.narrativeHistory)
              ? prev.worldData.narrativeHistory
              : [];
            return {
              ...prev,
              worldData: {
                ...prev.worldData,
                narrativeHistory: existing.concat(items),
              },
            };
          });
        } catch (chunkError) {
          console.warn('Viewer: failed to load narrativeHistory chunk.', chunkError);
        }
      }
    };

    const scheduleIdle = window.requestIdleCallback
      ? window.requestIdleCallback.bind(window)
      : (cb) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 250);
    const cancelIdle = window.cancelIdleCallback
      ? window.cancelIdleCallback.bind(window)
      : window.clearTimeout;
    const idleHandle = scheduleIdle(() => {
      loadChunks();
    });

    return () => {
      cancelled = true;
      cancelIdle(idleHandle);
    };
  }, [bundle, chunkPlan]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith(CHRONICLER_HASH_PREFIX)) {
        lastChroniclerHashRef.current = hash;
      }
      const nextView = deriveViewFromHash(hash);
      if (nextView !== activeView) {
        setActiveView(nextView);
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeView]);

  const handleViewChange = useCallback((nextView) => {
    if (nextView === activeView) return;

    if (nextView === 'chronicler') {
      if (window.location.hash.startsWith(CHRONICLER_HASH_PREFIX)) {
        setActiveView(nextView);
        return;
      }
      const targetHash = lastChroniclerHashRef.current || '#/chronicler';
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      } else {
        setActiveView(nextView);
      }
      return;
    }

    if (window.location.hash !== '#/archivist') {
      window.location.hash = '#/archivist';
    } else {
      setActiveView(nextView);
    }
  }, [activeView]);

  const imageLookup = useMemo(() => {
    const map = new Map();
    if (bundle?.images) {
      for (const [imageId, url] of Object.entries(bundle.images)) {
        if (url) map.set(imageId, url);
      }
    }
    if (bundle?.imageData?.results) {
      for (const image of bundle.imageData.results) {
        if (image.imageId && image.localPath) {
          map.set(image.imageId, image.localPath);
        }
      }
    }
    return map;
  }, [bundle]);

  const imageLoader = useCallback(async (imageId) => {
    return imageLookup.get(imageId) || null;
  }, [imageLookup]);

  if (status === 'loading') {
    return (
      <div className="app">
        <div className="state-screen">
          <div className="state-card">
            <div className="state-title">Loading viewer bundle...</div>
            <div className="state-detail">Fetching {bundleRequestUrl}</div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="app">
        <div className="state-screen">
          <div className="state-card">
            <div className="state-title state-error">Bundle unavailable</div>
            <div className="state-detail">
              {error?.message || 'Failed to load the viewer bundle.'}
            </div>
            <div className="state-detail" style={{ marginTop: '12px' }}>
              Expected at: {bundleRequestUrl}
            </div>
            <div className="state-actions">
              <button className="button" onClick={loadBundle} type="button">
                Retry
              </button>
              <button className="button secondary" onClick={() => window.location.reload()} type="button">
                Reload page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!bundle?.worldData) {
    return (
      <div className="app">
        <div className="state-screen">
          <div className="state-card">
            <div className="state-title">Bundle is empty</div>
            <div className="state-detail">No world data found in {bundleRequestUrl}.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-spacer" />
        <div className="brand">
          <span className="brand-title">Penguin Tales</span>
        </div>
        <div className="view-selector">
          <span className="view-selector-label">App</span>
          <div className="view-selector-control">
            <select
              className="view-selector-input"
              value={activeView}
              onChange={(event) => handleViewChange(event.target.value)}
            >
              <option value="chronicler">Chronicler</option>
              <option value="archivist">Archivist</option>
            </select>
            <span className="view-selector-caret" aria-hidden="true">▾</span>
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="panel" style={{ display: activeView === 'archivist' ? 'block' : 'none' }}>
          <ArchivistHost
            worldData={bundle.worldData}
            loreData={bundle.loreData || null}
            imageData={bundle.imageData || null}
          />
        </div>
        <div className="panel" style={{ display: activeView === 'chronicler' ? 'block' : 'none' }}>
          <ChroniclerHost
            projectId={bundle.projectId}
            worldData={bundle.worldData}
            loreData={bundle.loreData || null}
            imageData={bundle.imageData || null}
            imageLoader={imageLoader}
            chronicles={bundle.chronicles}
            staticPages={bundle.staticPages}
          />
        </div>
      </main>
      <footer className="app-footer">
        <span>Copyright © 2025</span>
        <img src="/tsonu-combined.png" alt="tsonu" height="14" />
      </footer>
    </div>
  );
}
