/**
 * CosmographerRemote - Module Federation entry point for Cosmographer
 *
 * This component is loaded by The Canonry shell and receives:
 * - schema: Read-only world schema (entityKinds, relationshipKinds, cultures)
 * - semanticData: Semantic plane data keyed by entity kind ID
 * - cultureVisuals: Culture visual data (axisBiases, homeRegions) keyed by culture ID
 * - seedEntities: Array of seed entities
 * - seedRelationships: Array of seed relationships
 * - onSemanticDataChange: Callback when semantic plane changes
 * - onCultureVisualsChange: Callback when culture visuals change
 * - onSeedEntitiesChange: Callback when seed entities change
 * - onSeedRelationshipsChange: Callback when seed relationships change
 *
 * It focuses on visual placement and entity/relationship editing
 * without the schema management overhead (handled by Canonry).
 */

import React, { useState, useMemo, useCallback } from 'react';
import SemanticPlaneEditor from './components/SemanticPlane/index.jsx';
import CultureEditor from './components/CultureEditor/index.jsx';
import EntityEditor from './components/EntityEditor/index.jsx';
import RelationshipEditor from './components/RelationshipEditor/index.jsx';

const TABS = [
  { id: 'planes', label: 'Semantic Planes' },
  { id: 'cultures', label: 'Culture Biases' },
  { id: 'entities', label: 'Entities' },
  { id: 'relationships', label: 'Relationships' },
];

// Cosmographer accent gradient
const ACCENT_GRADIENT = 'linear-gradient(135deg, #66ddb3 0%, #8eecc8 100%)';
const HOVER_BG = 'rgba(102, 221, 179, 0.15)';
const ACCENT_COLOR = '#66ddb3';

const styles = {
  container: {
    display: 'flex',
    height: '100%',
    backgroundColor: '#1e1e2e',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  sidebar: {
    width: '200px',
    backgroundColor: '#1a1a28',
    borderRight: '1px solid #3d3d4d',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  nav: {
    padding: '12px',
  },
  navButton: {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    marginBottom: '4px',
    fontSize: '13px',
    fontWeight: 500,
    textAlign: 'left',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  navButtonInactive: {
    backgroundColor: 'transparent',
    color: '#b0b0c0',
  },
  navButtonActive: {
    background: ACCENT_GRADIENT,
    color: '#1a1a28',
    fontWeight: 600,
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
  },
  noSchema: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#707080',
    textAlign: 'center',
    padding: '40px',
  },
  noSchemaTitle: {
    fontSize: '18px',
    fontWeight: 500,
    marginBottom: '8px',
    color: '#f0f0f0',
  },
};

/**
 * Convert Canonry schema + data to internal project format
 */
function buildInternalProject(
  schema,
  semanticData,
  cultureVisuals,
  namingData,
  seedEntities,
  seedRelationships
) {
  // Build entity kinds with embedded semantic planes
  const entityKinds = (schema?.entityKinds || []).map((ek) => ({
    ...ek,
    semanticPlane: semanticData?.[ek.id] || ek.semanticPlane || {
      axes: {
        x: { name: 'X Axis', lowLabel: 'Low', highLabel: 'High' },
        y: { name: 'Y Axis', lowLabel: 'Low', highLabel: 'High' },
      },
      regions: [],
    },
  }));

  // Build cultures with embedded visuals and naming data
  const cultures = (schema?.cultures || []).map((c) => ({
    ...c,
    axisBiases: cultureVisuals?.[c.id]?.axisBiases || {},
    homeRegions: cultureVisuals?.[c.id]?.homeRegions || {},
    // Include naming data for name generation
    domains: namingData?.[c.id]?.domains || [],
    lexemeLists: namingData?.[c.id]?.lexemeLists || {},
    grammars: namingData?.[c.id]?.grammars || [],
    profiles: namingData?.[c.id]?.profiles || [],
  }));

  return {
    entityKinds,
    relationshipKinds: schema?.relationshipKinds || [],
    cultures,
    seedEntities: seedEntities || [],
    seedRelationships: seedRelationships || [],
  };
}

export default function CosmographerRemote({
  schema,
  semanticData,
  cultureVisuals,
  namingData,
  seedEntities,
  seedRelationships,
  onSemanticDataChange,
  onCultureVisualsChange,
  onSeedEntitiesChange,
  onSeedRelationshipsChange,
  activeSection,
  onSectionChange,
}) {
  // Use passed-in section or default to 'planes'
  const activeTab = activeSection || 'planes';
  const setActiveTab = onSectionChange || (() => {});

  // Build internal project representation
  const project = useMemo(
    () =>
      buildInternalProject(
        schema,
        semanticData,
        cultureVisuals,
        namingData,
        seedEntities,
        seedRelationships
      ),
    [schema, semanticData, cultureVisuals, namingData, seedEntities, seedRelationships]
  );

  // Handle save - route updates to appropriate callbacks
  const handleSave = useCallback(
    (updates) => {
      // Handle entity kind updates (semantic plane changes)
      if (updates.entityKinds) {
        updates.entityKinds.forEach((ek) => {
          const original = schema?.entityKinds?.find((o) => o.id === ek.id);
          // Only update if semantic plane changed
          if (
            ek.semanticPlane &&
            JSON.stringify(ek.semanticPlane) !==
              JSON.stringify(original?.semanticPlane || semanticData?.[ek.id])
          ) {
            onSemanticDataChange?.(ek.id, ek.semanticPlane);
          }
        });
      }

      // Handle seed entity changes
      if (updates.seedEntities && onSeedEntitiesChange) {
        onSeedEntitiesChange(updates.seedEntities);
      }

      // Handle seed relationship changes
      if (updates.seedRelationships && onSeedRelationshipsChange) {
        onSeedRelationshipsChange(updates.seedRelationships);
      }

      // Handle culture visual changes (axisBiases, homeRegions)
      if (updates.cultures && onCultureVisualsChange) {
        updates.cultures.forEach((culture) => {
          const original = schema?.cultures?.find((c) => c.id === culture.id);
          const originalVisuals = cultureVisuals?.[culture.id] || {};
          const newVisuals = {
            axisBiases: culture.axisBiases || {},
            homeRegions: culture.homeRegions || {},
          };
          // Only update if visuals changed
          if (JSON.stringify(newVisuals) !== JSON.stringify(originalVisuals)) {
            onCultureVisualsChange(culture.id, newVisuals);
          }
        });
      }
    },
    [
      schema,
      semanticData,
      cultureVisuals,
      onSemanticDataChange,
      onCultureVisualsChange,
      onSeedEntitiesChange,
      onSeedRelationshipsChange,
    ]
  );

  const hasSchema =
    schema?.entityKinds?.length > 0 || schema?.cultures?.length > 0;

  if (!hasSchema) {
    return (
      <div style={styles.container}>
        <div style={styles.noSchema}>
          <div style={styles.noSchemaTitle}>No Schema Defined</div>
          <div>
            Define entity kinds and cultures in the <strong>Enumerist</strong> tab
            first, then return here to place entities and manage relationships.
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'planes':
        return <SemanticPlaneEditor project={project} onSave={handleSave} />;
      case 'cultures':
        return <CultureEditor project={project} onSave={handleSave} />;
      case 'entities':
        return <EntityEditor project={project} onSave={handleSave} />;
      case 'relationships':
        return <RelationshipEditor project={project} onSave={handleSave} />;
      default:
        return null;
    }
  };

  return (
    <div style={styles.container}>
      {/* Left sidebar with nav */}
      <div style={styles.sidebar}>
        <nav style={styles.nav}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.navButton,
                ...(activeTab === tab.id
                  ? styles.navButtonActive
                  : styles.navButtonInactive),
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content area */}
      <div style={styles.main}>
        <div style={styles.content}>{renderContent()}</div>
      </div>
    </div>
  );
}
