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
  const schema = project?.worldSchema || { entityKinds: [], relationshipKinds: [] };

  const updateEntityKinds = (entityKinds) => {
    onSave({
      worldSchema: {
        ...schema,
        entityKinds
      }
    });
  };

  const updateRelationshipKinds = (relationshipKinds) => {
    onSave({
      worldSchema: {
        ...schema,
        relationshipKinds
      }
    });
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
          entityKinds={schema.entityKinds}
          onChange={updateEntityKinds}
        />
      </div>

      <div style={styles.section}>
        <RelationshipKindEditor
          relationshipKinds={schema.relationshipKinds}
          entityKinds={schema.entityKinds}
          onChange={updateRelationshipKinds}
        />
      </div>
    </div>
  );
}
