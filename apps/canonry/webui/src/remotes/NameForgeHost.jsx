/**
 * NameForgeHost - Loads and hosts the Name Forge remote module
 */

import React, { Suspense, lazy, useState, useEffect } from 'react';
import RemotePlaceholder from './RemotePlaceholder';

// Lazy load the remote module
// This will be replaced with actual federation import once name-forge exposes the remote
const NameForgeRemote = lazy(() =>
  import('nameForge/NameForgeRemote').catch(() => ({
    default: () => (
      <RemotePlaceholder
        name="Name Forge"
        port={5001}
        instructions="cd apps/name-forge/webui && npm run dev"
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

export default function NameForgeHost({ schema, namingData, onNamingDataChange }) {
  return (
    <div style={styles.container}>
      <Suspense fallback={<div style={styles.loading}>Loading Name Forge...</div>}>
        <NameForgeRemote
          schema={schema}
          namingData={namingData}
          onNamingDataChange={onNamingDataChange}
        />
      </Suspense>
    </div>
  );
}
