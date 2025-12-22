/**
 * ArchivistRemote - MFE entry point for Archivist
 *
 * Accepts world data as props from the canonry shell.
 * Persistence is handled by canonry's worldStore (per-project IndexedDB).
 */

import WorldExplorer from './components/WorldExplorer.tsx';
import type { WorldState, LoreData, ImageMetadata } from './types/world.ts';
import { validateWorldData } from './utils/schemaValidation.ts';

export interface ArchivistRemoteProps {
  worldData?: WorldState | null;
  loreData?: LoreData | null;
  imageData?: ImageMetadata | null;
}

export default function ArchivistRemote({
  worldData = null,
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

  const schemaIssues = validateWorldData(worldData);
  if (schemaIssues.length > 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0f',
          color: '#707080',
          padding: '24px',
        }}
      >
        <div style={{ textAlign: 'left', maxWidth: '640px' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>❌</div>
          <div style={{ fontSize: '18px', color: '#f0f0f0', marginBottom: '12px' }}>
            World data is missing required schema fields
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: 1.6 }}>
            {schemaIssues.map((issue, index) => (
              <li key={`${issue}-${index}`}>{issue}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <WorldExplorer
      worldData={worldData}
      loreData={loreData}
      imageData={imageData}
    />
  );
}
