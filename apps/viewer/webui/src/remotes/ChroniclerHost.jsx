import React, { Suspense, lazy } from 'react';
import RemotePlaceholder from './RemotePlaceholder.jsx';

const ChroniclerRemote = lazy(() =>
  import('chronicler/ChroniclerRemote').catch(() => ({
    default: () => (
      <RemotePlaceholder
        name="Chronicler"
        instructions="cd apps/chronicler/webui && npm install && npm run dev"
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

export default function ChroniclerHost({
  projectId,
  worldData,
  loreData,
  imageData,
  imageLoader,
  chronicles,
  staticPages,
}) {
  return (
    <div style={styles.container}>
      <Suspense fallback={<div style={styles.loading}>Loading Chronicler...</div>}>
        <ChroniclerRemote
          projectId={projectId}
          worldData={worldData}
          loreData={loreData}
          imageData={imageData}
          imageLoader={imageLoader}
          chronicles={chronicles}
          staticPages={staticPages}
        />
      </Suspense>
    </div>
  );
}
