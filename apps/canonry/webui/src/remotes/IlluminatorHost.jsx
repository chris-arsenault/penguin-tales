/**
 * IlluminatorHost - Loads and hosts the Illuminator remote module
 *
 * Enriches world data from lore-weave simulation results with
 * LLM-generated descriptions and images.
 */

import React, { Suspense, lazy } from 'react';
import RemotePlaceholder from './RemotePlaceholder';
import { colors, typography } from '../theme';

// Lazy load the remote module
const IlluminatorRemote = lazy(() =>
  import('illuminator/IlluminatorRemote').catch(() => ({
    default: () => (
      <RemotePlaceholder
        name="Illuminator"
        port={5006}
        instructions="cd apps/illuminator/webui && npm install && npm run dev"
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

export default function IlluminatorHost({
  projectId,
  schema,
  worldData,
  onWorldDataChange,
  domainContext,
  onDomainContextChange,
  activeSection,
  onSectionChange,
  activeSlotIndex,
}) {
  return (
    <div style={styles.container}>
      <Suspense fallback={<div style={styles.loading}>Loading Illuminator...</div>}>
        <IlluminatorRemote
          projectId={projectId}
          schema={schema}
          worldData={worldData}
          onEnrichmentComplete={onWorldDataChange}
          domainContext={domainContext}
          onDomainContextChange={onDomainContextChange}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          activeSlotIndex={activeSlotIndex}
        />
      </Suspense>
    </div>
  );
}
