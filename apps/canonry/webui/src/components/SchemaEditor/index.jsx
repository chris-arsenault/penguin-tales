/**
 * SchemaEditor - The single place to edit world schema
 *
 * This is NATIVE to The Canonry (not a micro-frontend).
 * Edits entity kinds, relationship kinds, and culture identity.
 */

import React, { useState } from 'react';
import EntityKindEditor from './EntityKindEditor';
import RelationshipKindEditor from './RelationshipKindEditor';
import CultureEditor from './CultureEditor';

const styles = {
  container: {
    display: 'flex',
    height: '100%',
  },
  sidebar: {
    width: '200px',
    backgroundColor: '#12121a',
    borderRight: '1px solid #1e1e2e',
    padding: '16px',
  },
  sidebarTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: '12px',
  },
  sidebarItem: {
    padding: '8px 12px',
    fontSize: '13px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginBottom: '4px',
  },
  sidebarItemActive: {
    backgroundColor: '#1e1e2e',
    color: '#e94560',
  },
  sidebarItemInactive: {
    backgroundColor: 'transparent',
    color: '#888',
  },
  sidebarCount: {
    float: 'right',
    fontSize: '11px',
    color: '#666',
  },
  main: {
    flex: 1,
    padding: '24px',
    overflow: 'auto',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
    textAlign: 'center',
  },
  placeholderIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  placeholderText: {
    fontSize: '14px',
    maxWidth: '300px',
  },
};

const SECTIONS = [
  { id: 'entityKinds', label: 'Entity Kinds', countKey: 'entityKinds' },
  { id: 'relationshipKinds', label: 'Relationships', countKey: 'relationshipKinds' },
  { id: 'cultures', label: 'Cultures', countKey: 'cultures' },
];

export default function SchemaEditor({
  project,
  onUpdateEntityKinds,
  onUpdateRelationshipKinds,
  onUpdateCultures,
}) {
  const [activeSection, setActiveSection] = useState('entityKinds');

  const counts = {
    entityKinds: project.entityKinds.length,
    relationshipKinds: project.relationshipKinds.length,
    cultures: project.cultures.length,
  };

  const renderEditor = () => {
    switch (activeSection) {
      case 'entityKinds':
        return (
          <EntityKindEditor
            entityKinds={project.entityKinds}
            onChange={onUpdateEntityKinds}
          />
        );

      case 'relationshipKinds':
        return (
          <RelationshipKindEditor
            relationshipKinds={project.relationshipKinds}
            entityKinds={project.entityKinds}
            onChange={onUpdateRelationshipKinds}
          />
        );

      case 'cultures':
        return (
          <CultureEditor
            cultures={project.cultures}
            onChange={onUpdateCultures}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarTitle}>Schema</div>
        {SECTIONS.map((section) => (
          <div
            key={section.id}
            style={{
              ...styles.sidebarItem,
              ...(section.id === activeSection
                ? styles.sidebarItemActive
                : styles.sidebarItemInactive),
            }}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
            <span style={styles.sidebarCount}>{counts[section.countKey]}</span>
          </div>
        ))}
      </div>
      <div style={styles.main}>{renderEditor()}</div>
    </div>
  );
}
