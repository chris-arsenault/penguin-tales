/**
 * LoreWeaveHost - Loads and hosts the Lore Weave remote module
 */

import React, { Suspense, lazy } from 'react';
import RemotePlaceholder from './RemotePlaceholder';
import { colors, typography } from '../theme';

// Lazy load the remote module
const LoreWeaveRemote = lazy(() =>
  import('loreWeave/LoreWeaveRemote').catch(() => ({
    default: () => (
      <RemotePlaceholder
        name="Lore Weave"
        port={5004}
        instructions="cd apps/lore-weave/webui && npm install && npm run dev"
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

export default function LoreWeaveHost({
  schema,
  eras,
  pressures,
  generators,
  seedEntities,
  seedRelationships,
  namingData,
  semanticData,
  cultureVisuals,
  activeSection,
  onSectionChange,
  onViewInArchivist,
}) {
  return (
    <div style={styles.container}>
      <Suspense fallback={<div style={styles.loading}>Loading Lore Weave...</div>}>
        <LoreWeaveRemote
          schema={schema}
          eras={eras}
          pressures={pressures}
          generators={generators}
          seedEntities={seedEntities}
          seedRelationships={seedRelationships}
          namingData={namingData}
          semanticData={semanticData}
          cultureVisuals={cultureVisuals}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          onViewInArchivist={onViewInArchivist}
        />
      </Suspense>
    </div>
  );
}
