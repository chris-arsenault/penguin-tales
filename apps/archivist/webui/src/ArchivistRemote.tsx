/**
 * ArchivistRemote - MFE entry point for Archivist
 *
 * Accepts world data as props instead of fetching from JSON files.
 * Hosted by canonry shell and receives simulation results from lore-weave.
 *
 * Persistence: The latest payload is saved to IndexedDB (with localStorage
 * fallback) so a browser refresh keeps the most recent world visible.
 */

import { useEffect, useState } from 'react';
import WorldExplorer from './components/WorldExplorer.tsx';
import type { WorldState, LoreData, ImageMetadata } from './types/world.ts';
import { loadSnapshot, saveSnapshot, type ArchivistSnapshot } from './utils/persistence.ts';

export interface ArchivistRemoteProps {
  worldData?: WorldState | null;
  loreData?: LoreData | null;
  imageData?: ImageMetadata | null;
}

export default function ArchivistRemote({
  worldData,
  loreData = null,
  imageData = null,
}: ArchivistRemoteProps) {
  const [persisted, setPersisted] = useState<ArchivistSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  // Load last-saved snapshot on mount
  useEffect(() => {
    let cancelled = false;
    loadSnapshot()
      .then((snapshot) => {
        if (!cancelled) setPersisted(snapshot);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the newest payload when provided
  useEffect(() => {
    if (!worldData) return;
    const snapshot: ArchivistSnapshot = {
      worldData,
      loreData,
      imageData,
      savedAt: Date.now(),
    };
    setPersisted(snapshot);
    saveSnapshot(snapshot).catch(() => {
      // Best-effort persistence; ignore failures so UI still renders
    });
  }, [worldData, loreData, imageData]);

  const effectiveWorldData = worldData || persisted?.worldData || null;
  const effectiveLoreData = loreData || persisted?.loreData || null;
  const effectiveImageData = imageData || persisted?.imageData || null;

  if (!effectiveWorldData) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0f',
          color: '#707080',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📜</div>
          <div style={{ fontSize: '18px', color: '#f0f0f0', marginBottom: '8px' }}>
            {loading ? 'Loading snapshot…' : 'No World Data'}
          </div>
          <div style={{ fontSize: '14px' }}>
            {loading
              ? 'Restoring your last view…'
              : 'Run a simulation in Lore Weave and click "View in Archivist" to explore your world.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <WorldExplorer
      worldData={effectiveWorldData}
      loreData={effectiveLoreData}
      imageData={effectiveImageData}
    />
  );
}
