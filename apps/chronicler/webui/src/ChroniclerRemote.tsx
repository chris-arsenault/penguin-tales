/**
 * ChroniclerRemote - MFE entry point for Chronicler
 *
 * Wiki-style explorer for world content with long-form narratives,
 * cross-linking, and MediaWiki-inspired navigation.
 *
 * Accepts world data as props from the canonry shell.
 */

import WikiExplorer from './components/WikiExplorer.tsx';
import type { ChronicleRecord } from './lib/chronicleStorage.ts';
import type { StaticPage } from './lib/staticPageStorage.ts';
import type { WorldState, LoreData, ImageMetadata, ImageLoader } from './types/world.ts';

export interface ChroniclerRemoteProps {
  projectId?: string;
  worldData?: WorldState | null;
  loreData?: LoreData | null;
  imageData?: ImageMetadata | null;
  imageLoader?: ImageLoader;
  chronicles?: ChronicleRecord[];
  staticPages?: StaticPage[];
  /** Page ID requested by external navigation (e.g., from Archivist) */
  requestedPageId?: string | null;
  /** Callback to signal that the requested page has been consumed */
  onRequestedPageConsumed?: () => void;
}

export default function ChroniclerRemote({
  projectId,
  worldData = null,
  loreData = null,
  imageData = null,
  imageLoader,
  chronicles,
  staticPages,
  requestedPageId,
  onRequestedPageConsumed,
}: ChroniclerRemoteProps) {
  if (!worldData) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a1929',
          color: '#707080',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📖</div>
          <div style={{ fontSize: '18px', color: '#f0f0f0', marginBottom: '8px' }}>
            No World Data
          </div>
          <div style={{ fontSize: '14px' }}>
            Run a simulation in Lore Weave and enrich it with Illuminator to view the world chronicle.
          </div>
        </div>
      </div>
    );
  }

  return (
    <WikiExplorer
      projectId={projectId}
      worldData={worldData}
      loreData={loreData}
      imageData={imageData}
      imageLoader={imageLoader}
      chronicles={chronicles}
      staticPages={staticPages}
      requestedPageId={requestedPageId}
      onRequestedPageConsumed={onRequestedPageConsumed}
    />
  );
}
