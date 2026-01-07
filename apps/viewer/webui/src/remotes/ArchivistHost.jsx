import React, { Suspense, lazy } from 'react';
import RemotePlaceholder from './RemotePlaceholder.jsx';

const ArchivistRemote = lazy(() =>
  import('archivist/ArchivistRemote').catch(() => ({
    default: () => (
      <RemotePlaceholder
        name="Archivist"
        instructions="cd apps/archivist/webui && npm install && npm run dev"
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
    color: '#93c5fd',
    fontSize: '14px',
  },
};

export default function ArchivistHost({ worldData, loreData, imageData }) {
  return (
    <div style={styles.container}>
      <Suspense fallback={<div style={styles.loading}>Loading Archivist...</div>}>
        <ArchivistRemote
          worldData={worldData}
          loreData={loreData}
          imageData={imageData}
        />
      </Suspense>
    </div>
  );
}
