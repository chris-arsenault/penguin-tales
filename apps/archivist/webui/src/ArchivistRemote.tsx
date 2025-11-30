/**
 * ArchivistRemote - MFE entry point for Archivist
 *
 * Accepts world data as props instead of fetching from JSON files.
 * Hosted by canonry shell and receives simulation results from lore-weave.
 */

import WorldExplorer from './components/WorldExplorer.tsx';
import type { WorldState, LoreData, ImageMetadata } from './types/world.ts';

export interface ArchivistRemoteProps {
  worldData: WorldState;
  loreData?: LoreData | null;
  imageData?: ImageMetadata | null;
}

export default function ArchivistRemote({
  worldData,
  loreData = null,
  imageData = null,
}: ArchivistRemoteProps) {
  if (!worldData) {
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
            No World Data
          </div>
          <div style={{ fontSize: '14px' }}>
            Run a simulation in Lore Weave and click "View in Archivist" to explore your world.
          </div>
        </div>
      </div>
    );
  }

  return <WorldExplorer worldData={worldData} loreData={loreData} imageData={imageData} />;
}
