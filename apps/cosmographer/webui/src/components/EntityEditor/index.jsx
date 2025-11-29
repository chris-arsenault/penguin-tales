/**
 * EntityEditor - Create and manage seed entities.
 */

import React, { useState } from 'react';

const styles = {
  container: {
    display: 'flex',
    gap: '24px',
    height: '100%'
  },
  listPanel: {
    width: '320px',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    marginBottom: '16px'
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
  toolbar: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px'
  },
  addButton: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#e94560',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  filterSelect: {
    padding: '6px 10px',
    fontSize: '13px',
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    flex: 1
  },
  entityList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  entityItem: {
    padding: '12px',
    backgroundColor: '#16213e',
    borderRadius: '6px',
    cursor: 'pointer',
    border: '2px solid transparent',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  entityItemSelected: {
    borderColor: '#e94560'
  },
  entityColor: {
    width: '10px',
    height: '10px',
    borderRadius: '50%'
  },
  entityInfo: {
    flex: 1
  },
  entityName: {
    fontSize: '14px',
    fontWeight: 500
  },
  entityMeta: {
    fontSize: '11px',
    color: '#888'
  },
  formPanel: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: '8px',
    padding: '20px',
    overflowY: 'auto'
  },
  formTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '20px'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '6px',
    display: 'block'
  },
  input: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee'
  },
  select: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee'
  },
  textarea: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    minHeight: '80px',
    resize: 'vertical'
  },
  row: {
    display: 'flex',
    gap: '12px'
  },
  coordGroup: {
    flex: 1
  },
  deleteButton: {
    padding: '10px 20px',
    fontSize: '13px',
    backgroundColor: 'transparent',
    color: '#e94560',
    border: '1px solid #e94560',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '24px'
  },
  emptyState: {
    color: '#666',
    fontSize: '14px',
    textAlign: 'center',
    padding: '40px'
  },
  emptyForm: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666'
  }
};

export default function EntityEditor({ project, onSave }) {
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [filterKind, setFilterKind] = useState('');

  const entities = project?.seedEntities || [];
  const entityKinds = project?.worldSchema?.entityKinds || [];
  const cultures = project?.cultures || [];

  const filteredEntities = filterKind
    ? entities.filter(e => e.kind === filterKind)
    : entities;

  const selectedEntity = entities.find(e => e.id === selectedEntityId);
  const selectedKindDef = entityKinds.find(k => k.id === selectedEntity?.kind);

  const updateEntities = (newEntities) => {
    onSave({ seedEntities: newEntities });
  };

  const addEntity = () => {
    const defaultKind = entityKinds[0];
    if (!defaultKind) {
      alert('Define entity kinds in Schema first');
      return;
    }

    const newEntity = {
      id: `entity_${Date.now()}`,
      kind: defaultKind.id,
      subtype: defaultKind.subtypes[0]?.id || '',
      name: 'New Entity',
      description: '',
      status: defaultKind.statuses[0]?.id || 'active',
      prominence: 'recognized',
      culture: cultures[0]?.id || '',
      tags: [],
      coordinates: { x: 50, y: 50, z: 50 }
    };

    updateEntities([...entities, newEntity]);
    setSelectedEntityId(newEntity.id);
  };

  const updateEntity = (updates) => {
    if (!selectedEntity) return;

    // If kind changed, reset subtype and status
    if (updates.kind && updates.kind !== selectedEntity.kind) {
      const newKind = entityKinds.find(k => k.id === updates.kind);
      updates.subtype = newKind?.subtypes[0]?.id || '';
      updates.status = newKind?.statuses[0]?.id || 'active';
    }

    updateEntities(entities.map(e =>
      e.id === selectedEntityId ? { ...e, ...updates } : e
    ));
  };

  const deleteEntity = () => {
    if (!selectedEntity) return;
    if (!confirm(`Delete "${selectedEntity.name}"?`)) return;

    updateEntities(entities.filter(e => e.id !== selectedEntityId));
    setSelectedEntityId(null);
  };

  const getCultureColor = (cultureId) => {
    return cultures.find(c => c.id === cultureId)?.color || '#888';
  };

  return (
    <div style={styles.container}>
      <div style={styles.listPanel}>
        <div style={styles.header}>
          <div style={styles.title}>Entities</div>
          <div style={styles.subtitle}>
            Create seed entities to populate your world.
          </div>
        </div>

        <div style={styles.toolbar}>
          <select
            style={styles.filterSelect}
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
          >
            <option value="">All kinds ({entities.length})</option>
            {entityKinds.map(k => (
              <option key={k.id} value={k.id}>
                {k.name} ({entities.filter(e => e.kind === k.id).length})
              </option>
            ))}
          </select>
          <button style={styles.addButton} onClick={addEntity}>
            + Add
          </button>
        </div>

        <div style={styles.entityList}>
          {filteredEntities.length === 0 ? (
            <div style={styles.emptyState}>
              {entities.length === 0
                ? 'No entities yet. Create one to get started.'
                : 'No entities match the filter.'}
            </div>
          ) : (
            filteredEntities.map(entity => (
              <div
                key={entity.id}
                style={{
                  ...styles.entityItem,
                  ...(selectedEntityId === entity.id ? styles.entityItemSelected : {})
                }}
                onClick={() => setSelectedEntityId(entity.id)}
              >
                <div style={{ ...styles.entityColor, backgroundColor: getCultureColor(entity.culture) }} />
                <div style={styles.entityInfo}>
                  <div style={styles.entityName}>{entity.name}</div>
                  <div style={styles.entityMeta}>
                    {entity.kind} / {entity.subtype || 'no subtype'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={styles.formPanel}>
        {!selectedEntity ? (
          <div style={styles.emptyForm}>
            Select an entity to edit, or create a new one.
          </div>
        ) : (
          <>
            <div style={styles.formTitle}>Edit Entity</div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Name</label>
              <input
                style={styles.input}
                value={selectedEntity.name}
                onChange={(e) => updateEntity({ name: e.target.value })}
              />
            </div>

            <div style={styles.row}>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Kind</label>
                <select
                  style={styles.select}
                  value={selectedEntity.kind}
                  onChange={(e) => updateEntity({ kind: e.target.value })}
                >
                  {entityKinds.map(k => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Subtype</label>
                <select
                  style={styles.select}
                  value={selectedEntity.subtype || ''}
                  onChange={(e) => updateEntity({ subtype: e.target.value })}
                >
                  <option value="">None</option>
                  {selectedKindDef?.subtypes?.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.row}>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Status</label>
                <select
                  style={styles.select}
                  value={selectedEntity.status}
                  onChange={(e) => updateEntity({ status: e.target.value })}
                >
                  {selectedKindDef?.statuses?.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Culture</label>
                <select
                  style={styles.select}
                  value={selectedEntity.culture || ''}
                  onChange={(e) => updateEntity({ culture: e.target.value })}
                >
                  <option value="">None</option>
                  {cultures.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Prominence</label>
              <select
                style={styles.select}
                value={selectedEntity.prominence || 'recognized'}
                onChange={(e) => updateEntity({ prominence: e.target.value })}
              >
                <option value="forgotten">Forgotten</option>
                <option value="marginal">Marginal</option>
                <option value="recognized">Recognized</option>
                <option value="renowned">Renowned</option>
                <option value="mythic">Mythic</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                style={styles.textarea}
                value={selectedEntity.description || ''}
                onChange={(e) => updateEntity({ description: e.target.value })}
                placeholder="Optional description..."
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Coordinates</label>
              <div style={styles.row}>
                <div style={styles.coordGroup}>
                  <input
                    style={styles.input}
                    type="number"
                    placeholder="X"
                    value={selectedEntity.coordinates?.x ?? 50}
                    onChange={(e) => updateEntity({
                      coordinates: { ...selectedEntity.coordinates, x: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </div>
                <div style={styles.coordGroup}>
                  <input
                    style={styles.input}
                    type="number"
                    placeholder="Y"
                    value={selectedEntity.coordinates?.y ?? 50}
                    onChange={(e) => updateEntity({
                      coordinates: { ...selectedEntity.coordinates, y: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </div>
                <div style={styles.coordGroup}>
                  <input
                    style={styles.input}
                    type="number"
                    placeholder="Z"
                    value={selectedEntity.coordinates?.z ?? 50}
                    onChange={(e) => updateEntity({
                      coordinates: { ...selectedEntity.coordinates, z: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </div>
              </div>
            </div>

            <button style={styles.deleteButton} onClick={deleteEntity}>
              Delete Entity
            </button>
          </>
        )}
      </div>
    </div>
  );
}
