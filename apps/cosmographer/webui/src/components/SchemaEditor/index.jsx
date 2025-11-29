/**
 * SchemaEditor - Main schema editing view combining entity and relationship editors.
 */

import React from 'react';
import EntityKindEditor from './EntityKindEditor.jsx';
import RelationshipKindEditor from './RelationshipKindEditor.jsx';

const styles = {
  container: {
    maxWidth: '900px'
  },
  header: {
    marginBottom: '24px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '8px'
  },
  subtitle: {
    color: '#888',
    fontSize: '14px'
  },
  section: {
    marginBottom: '32px'
  }
};

export default function SchemaEditor({ project, onSave }) {
  // Schema v2: entityKinds and relationshipKinds at project root
  const entityKinds = project?.entityKinds || [];
  const relationshipKinds = project?.relationshipKinds || [];

  const updateEntityKinds = (newEntityKinds) => {
    onSave({ entityKinds: newEntityKinds });
  };

  const updateRelationshipKinds = (newRelationshipKinds) => {
    onSave({ relationshipKinds: newRelationshipKinds });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>World Schema</div>
        <div style={styles.subtitle}>
          Define the types of entities and relationships in your world.
        </div>
      </div>

      <div style={styles.section}>
        <EntityKindEditor
          entityKinds={entityKinds}
          onChange={updateEntityKinds}
        />
      </div>

      <div style={styles.section}>
        <RelationshipKindEditor
          relationshipKinds={relationshipKinds}
          entityKinds={entityKinds}
          onChange={updateRelationshipKinds}
        />
      </div>
    </div>
  );
}
