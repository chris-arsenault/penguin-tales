/**
 * CosmographerHost - Loads and hosts the Cosmographer remote module
 */

import React, { Suspense, lazy } from 'react';
import RemotePlaceholder from './RemotePlaceholder';

// Lazy load the remote module
// This will be replaced with actual federation import once cosmographer exposes the remote
const CosmographerRemote = lazy(() =>
  import('cosmographer/CosmographerRemote').catch(() => ({
    default: () => (
      <RemotePlaceholder
        name="Cosmographer"
        port={5002}
        instructions="cd apps/cosmographer/webui && npm run dev"
      />
    ),
  }))
);

const styles = {
  container: {
    height: '100%',
    overflow: 'auto',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#888',
    fontSize: '14px',
  },
};

export default function CosmographerHost({
  schema,
  semanticData,
  cultureVisuals,
  seedEntities,
  seedRelationships,
  onSemanticDataChange,
  onCultureVisualsChange,
  onSeedEntitiesChange,
  onSeedRelationshipsChange,
}) {
  return (
    <div style={styles.container}>
      <Suspense fallback={<div style={styles.loading}>Loading Cosmographer...</div>}>
        <CosmographerRemote
          schema={schema}
          semanticData={semanticData}
          cultureVisuals={cultureVisuals}
          seedEntities={seedEntities}
          seedRelationships={seedRelationships}
          onSemanticDataChange={onSemanticDataChange}
          onCultureVisualsChange={onCultureVisualsChange}
          onSeedEntitiesChange={onSeedEntitiesChange}
          onSeedRelationshipsChange={onSeedRelationshipsChange}
        />
      </Suspense>
    </div>
  );
}
