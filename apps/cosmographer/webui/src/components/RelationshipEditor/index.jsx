/**
 * RelationshipEditor - Create and manage relationships between seed entities.
 */

import React, { useState } from 'react';

const styles = {
  container: {
    maxWidth: '1000px'
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
  toolbar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px'
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
    padding: '8px 12px',
    fontSize: '13px',
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    minWidth: '150px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: '#16213e',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '12px',
    color: '#888',
    borderBottom: '1px solid #0f3460',
    fontWeight: 500
  },
  td: {
    padding: '12px 16px',
    borderBottom: '1px solid #0f3460',
    fontSize: '13px'
  },
  kindBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    backgroundColor: '#0f3460',
    borderRadius: '4px',
    fontSize: '11px'
  },
  entityLink: {
    color: '#e94560',
    cursor: 'pointer'
  },
  deleteButton: {
    padding: '4px 8px',
    fontSize: '11px',
    backgroundColor: 'transparent',
    color: '#e94560',
    border: '1px solid #e94560',
    borderRadius: '3px',
    cursor: 'pointer'
  },
  emptyState: {
    color: '#666',
    fontSize: '14px',
    textAlign: 'center',
    padding: '40px',
    backgroundColor: '#16213e',
    borderRadius: '8px'
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    padding: '24px',
    borderRadius: '8px',
    width: '500px'
  },
  modalTitle: {
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
  select: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee'
  },
  input: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '20px'
  },
  button: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#0f3460',
    color: '#aaa',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  arrow: {
    color: '#666',
    fontSize: '16px'
  }
};

export default function RelationshipEditor({ project, onSave }) {
  const [showModal, setShowModal] = useState(false);
  const [filterKind, setFilterKind] = useState('');
  const [newRel, setNewRel] = useState({ kind: '', srcId: '', dstId: '', strength: 1 });

  const relationships = project?.seedRelationships || [];
  const entities = project?.seedEntities || [];
  // Schema v2: relationshipKinds at project root
  const relationshipKinds = project?.relationshipKinds || [];

  const filteredRels = filterKind
    ? relationships.filter(r => r.kind === filterKind)
    : relationships;

  const updateRelationships = (newRels) => {
    onSave({ seedRelationships: newRels });
  };

  const addRelationship = () => {
    if (!newRel.kind || !newRel.srcId || !newRel.dstId) {
      alert('Please fill all required fields');
      return;
    }

    if (newRel.srcId === newRel.dstId) {
      alert('Source and destination must be different');
      return;
    }

    const rel = {
      id: `rel_${Date.now()}`,
      kind: newRel.kind,
      srcId: newRel.srcId,
      dstId: newRel.dstId,
      strength: parseFloat(newRel.strength) || 1
    };

    updateRelationships([...relationships, rel]);
    setShowModal(false);
    setNewRel({ kind: '', srcId: '', dstId: '', strength: 1 });
  };

  const deleteRelationship = (relId) => {
    if (!confirm('Delete this relationship?')) return;
    updateRelationships(relationships.filter(r => r.id !== relId));
  };

  const getEntityName = (entityId) => {
    const entity = entities.find(e => e.id === entityId);
    return entity?.name || entityId;
  };

  const getRelKindName = (kindId) => {
    const kind = relationshipKinds.find(k => k.id === kindId);
    return kind?.name || kindId;
  };

  // Filter entities by allowed source/dest kinds for the selected relationship
  const selectedRelKind = relationshipKinds.find(k => k.id === newRel.kind);
  const allowedSrcEntities = selectedRelKind?.srcKinds?.length
    ? entities.filter(e => selectedRelKind.srcKinds.includes(e.kind))
    : entities;
  const allowedDstEntities = selectedRelKind?.dstKinds?.length
    ? entities.filter(e => selectedRelKind.dstKinds.includes(e.kind))
    : entities;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Relationships</div>
        <div style={styles.subtitle}>
          Define connections between seed entities.
        </div>
      </div>

      <div style={styles.toolbar}>
        <select
          style={styles.filterSelect}
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value)}
        >
          <option value="">All kinds ({relationships.length})</option>
          {relationshipKinds.map(k => (
            <option key={k.id} value={k.id}>
              {k.name} ({relationships.filter(r => r.kind === k.id).length})
            </option>
          ))}
        </select>
        <button
          style={styles.addButton}
          onClick={() => setShowModal(true)}
          disabled={entities.length < 2 || relationshipKinds.length === 0}
        >
          + Add Relationship
        </button>
        {entities.length < 2 && (
          <span style={{ color: '#888', fontSize: '12px' }}>
            Need at least 2 entities
          </span>
        )}
        {relationshipKinds.length === 0 && (
          <span style={{ color: '#888', fontSize: '12px' }}>
            Define relationship kinds in Schema first
          </span>
        )}
      </div>

      {filteredRels.length === 0 ? (
        <div style={styles.emptyState}>
          {relationships.length === 0
            ? 'No relationships yet. Create one to connect entities.'
            : 'No relationships match the filter.'}
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Kind</th>
              <th style={styles.th}>Source</th>
              <th style={styles.th}></th>
              <th style={styles.th}>Destination</th>
              <th style={styles.th}>Strength</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {filteredRels.map(rel => (
              <tr key={rel.id}>
                <td style={styles.td}>
                  <span style={styles.kindBadge}>{getRelKindName(rel.kind)}</span>
                </td>
                <td style={styles.td}>
                  <span style={styles.entityLink}>{getEntityName(rel.srcId)}</span>
                </td>
                <td style={{ ...styles.td, width: '30px', textAlign: 'center' }}>
                  <span style={styles.arrow}>→</span>
                </td>
                <td style={styles.td}>
                  <span style={styles.entityLink}>{getEntityName(rel.dstId)}</span>
                </td>
                <td style={styles.td}>{rel.strength}</td>
                <td style={{ ...styles.td, width: '80px' }}>
                  <button
                    style={styles.deleteButton}
                    onClick={() => deleteRelationship(rel.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add Relationship Modal */}
      {showModal && (
        <div style={styles.modal} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>Add Relationship</div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Relationship Kind</label>
              <select
                style={styles.select}
                value={newRel.kind}
                onChange={(e) => setNewRel({ ...newRel, kind: e.target.value, srcId: '', dstId: '' })}
              >
                <option value="">Select kind...</option>
                {relationshipKinds.map(k => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Source Entity</label>
              <select
                style={styles.select}
                value={newRel.srcId}
                onChange={(e) => setNewRel({ ...newRel, srcId: e.target.value })}
                disabled={!newRel.kind}
              >
                <option value="">Select source...</option>
                {allowedSrcEntities.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.kind})</option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Destination Entity</label>
              <select
                style={styles.select}
                value={newRel.dstId}
                onChange={(e) => setNewRel({ ...newRel, dstId: e.target.value })}
                disabled={!newRel.kind}
              >
                <option value="">Select destination...</option>
                {allowedDstEntities
                  .filter(e => e.id !== newRel.srcId)
                  .map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.kind})</option>
                  ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Strength (0-1)</label>
              <input
                style={styles.input}
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={newRel.strength}
                onChange={(e) => setNewRel({ ...newRel, strength: e.target.value })}
              />
            </div>

            <div style={styles.modalActions}>
              <button style={styles.button} onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button style={styles.addButton} onClick={addRelationship}>
                Add Relationship
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
