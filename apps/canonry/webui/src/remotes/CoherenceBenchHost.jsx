/**
 * CoherenceBenchHost - Loads and hosts the Coherence Bench remote module
 *
 * Coherence Bench provides simulation configuration and execution.
 */

import React, { Suspense, lazy } from 'react';
import RemotePlaceholder from './RemotePlaceholder';
import { colors, typography } from '../theme';

// Lazy load the remote module
const CoherenceBenchRemote = lazy(() =>
  import('coherenceBench/CoherenceBenchRemote').catch(() => ({
    default: () => (
      <RemotePlaceholder
        name="Coherence Bench"
        port={5003}
        instructions="cd apps/coherence-bench/webui && npm run dev"
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
    color: colors.textMuted,
    fontSize: typography.sizeLg,
    fontFamily: typography.fontFamily,
  },
};

export default function CoherenceBenchHost({
  project,
  activeSection,
  onSectionChange,
  onUpdateSimulation,
  onUpdateEras,
}) {
  return (
    <div style={styles.container}>
      <Suspense fallback={<div style={styles.loading}>Loading Coherence Bench...</div>}>
        <CoherenceBenchRemote
          project={project}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          onUpdateSimulation={onUpdateSimulation}
          onUpdateEras={onUpdateEras}
        />
      </Suspense>
    </div>
  );
}
