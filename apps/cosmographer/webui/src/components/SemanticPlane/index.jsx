/**
 * SemanticPlaneEditor - View and edit semantic planes embedded in entity kinds.
 *
 * Schema v2: Each entityKind has a semanticPlane with axes and regions.
 * This editor lets you select a kind, view/place entities, and manage regions.
 */

import React, { useState } from 'react';
import PlaneCanvas from './PlaneCanvas.jsx';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
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
    gap: '12px',
    alignItems: 'center',
    marginBottom: '16px'
  },
  select: {
    padding: '8px 12px',
    fontSize: '14px',
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    minWidth: '180px'
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
  addButton: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#e94560',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  mainArea: {
    display: 'flex',
    gap: '16px',
    flex: 1,
    minHeight: 0
  },
  canvasArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  sidebar: {
    width: '280px',
    backgroundColor: '#16213e',
    borderRadius: '8px',
    padding: '16px',
    overflowY: 'auto'
  },
  sidebarSection: {
    marginBottom: '20px'
  },
  sidebarTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#888',
    marginBottom: '8px'
  },
  regionItem: {
    padding: '8px 10px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    marginBottom: '6px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  regionColor: {
    width: '12px',
    height: '12px',
    borderRadius: '2px'
  },
  emptyState: {
    color: '#666',
    fontSize: '13px',
    textAlign: 'center',
    padding: '20px'
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
    width: '400px'
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '16px'
  },
  input: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    marginBottom: '12px'
  },
  inputRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px'
  },
  inputGroup: {
    flex: 1
  },
  inputLabel: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '4px'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '16px'
  },
  deleteButton: {
    padding: '4px 8px',
    fontSize: '10px',
    backgroundColor: 'transparent',
    color: '#e94560',
    border: '1px solid #e94560',
    borderRadius: '3px',
    cursor: 'pointer',
    marginLeft: 'auto'
  }
};

export default function SemanticPlaneEditor({ project, onSave }) {
  const [selectedKindId, setSelectedKindId] = useState(null);
  const [showNewRegionModal, setShowNewRegionModal] = useState(false);
  const [newRegion, setNewRegion] = useState({ label: '', x: 50, y: 50, radius: 15 });
  const [selectedEntityId, setSelectedEntityId] = useState(null);

  // Schema v2: entityKinds at project root
  const entityKinds = project?.entityKinds || [];
  const cultures = project?.cultures || [];
  const seedEntities = project?.seedEntities || [];

  // Select first kind by default
  const selectedKind = entityKinds.find(k => k.id === selectedKindId) || entityKinds[0];
  const semanticPlane = selectedKind?.semanticPlane || {
    axes: {
      x: { name: 'X Axis', lowLabel: 'Low', highLabel: 'High' },
      y: { name: 'Y Axis', lowLabel: 'Low', highLabel: 'High' }
    },
    regions: []
  };
  const planeEntities = seedEntities.filter(e => e.kind === selectedKind?.id);

  const updateEntityKind = (kindId, updates) => {
    const newKinds = entityKinds.map(k =>
      k.id === kindId ? { ...k, ...updates } : k
    );
    onSave({ entityKinds: newKinds });
  };

  const addRegion = () => {
    if (!selectedKind || !newRegion.label.trim()) return;

    const region = {
      id: `region_${Date.now()}`,
      label: newRegion.label.trim(),
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
      bounds: {
        shape: 'circle',
        center: { x: parseFloat(newRegion.x), y: parseFloat(newRegion.y) },
        radius: parseFloat(newRegion.radius)
      }
    };

    const updatedPlane = {
      ...semanticPlane,
      regions: [...(semanticPlane.regions || []), region]
    };

    updateEntityKind(selectedKind.id, { semanticPlane: updatedPlane });
    setShowNewRegionModal(false);
    setNewRegion({ label: '', x: 50, y: 50, radius: 15 });
  };

  const deleteRegion = (regionId) => {
    if (!selectedKind) return;

    const updatedPlane = {
      ...semanticPlane,
      regions: (semanticPlane.regions || []).filter(r => r.id !== regionId)
    };

    updateEntityKind(selectedKind.id, { semanticPlane: updatedPlane });
  };

  const handleMoveEntity = (entityId, coords) => {
    const entities = project?.seedEntities || [];
    const updated = entities.map(e =>
      e.id === entityId
        ? { ...e, coordinates: { x: coords.x, y: coords.y, z: e.coordinates?.z || 50 } }
        : e
    );
    onSave({ seedEntities: updated });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Semantic Planes</div>
        <div style={styles.subtitle}>
          View and edit the coordinate space for each entity kind. Drag entities to reposition them.
        </div>
      </div>

      <div style={styles.toolbar}>
        <select
          style={styles.select}
          value={selectedKind?.id || ''}
          onChange={(e) => setSelectedKindId(e.target.value)}
        >
          {entityKinds.length === 0 && <option value="">No entity kinds</option>}
          {entityKinds.map(k => (
            <option key={k.id} value={k.id}>
              {k.name} ({planeEntities.filter(e => e.kind === k.id).length} entities)
            </option>
          ))}
        </select>
        {selectedKind && (
          <button style={styles.addButton} onClick={() => setShowNewRegionModal(true)}>
            + Add Region
          </button>
        )}
      </div>

      {entityKinds.length === 0 ? (
        <div style={styles.emptyState}>
          Define entity kinds in the Schema tab first to view their semantic planes.
        </div>
      ) : !selectedKind ? (
        <div style={styles.emptyState}>
          Select an entity kind to view its semantic plane.
        </div>
      ) : (
        <div style={styles.mainArea}>
          <div style={styles.canvasArea}>
            <PlaneCanvas
              plane={semanticPlane}
              regions={semanticPlane.regions || []}
              entities={planeEntities}
              cultures={cultures}
              selectedEntityId={selectedEntityId}
              onSelectEntity={setSelectedEntityId}
              onMoveEntity={handleMoveEntity}
              width={700}
              height={500}
            />
          </div>

          <div style={styles.sidebar}>
            <div style={styles.sidebarSection}>
              <div style={styles.sidebarTitle}>
                Axes
              </div>
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                <strong>X:</strong> {semanticPlane.axes?.x?.name || 'X Axis'}
                <span style={{ color: '#666' }}> ({semanticPlane.axes?.x?.lowLabel} → {semanticPlane.axes?.x?.highLabel})</span>
              </div>
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                <strong>Y:</strong> {semanticPlane.axes?.y?.name || 'Y Axis'}
                <span style={{ color: '#666' }}> ({semanticPlane.axes?.y?.lowLabel} → {semanticPlane.axes?.y?.highLabel})</span>
              </div>
              <div style={{ fontSize: '12px', color: '#aaa' }}>
                <strong>Z:</strong> {semanticPlane.axes?.z?.name || 'Z Axis'}
                <span style={{ color: '#666' }}> ({semanticPlane.axes?.z?.lowLabel} → {semanticPlane.axes?.z?.highLabel})</span>
              </div>
            </div>

            <div style={styles.sidebarSection}>
              <div style={styles.sidebarTitle}>Regions ({semanticPlane.regions?.length || 0})</div>
              {(semanticPlane.regions || []).length === 0 ? (
                <div style={{ color: '#666', fontSize: '12px' }}>No regions yet</div>
              ) : (
                semanticPlane.regions.map(region => (
                  <div key={region.id} style={styles.regionItem}>
                    <div style={{ ...styles.regionColor, backgroundColor: region.color }} />
                    <span>{region.label}</span>
                    <button
                      style={styles.deleteButton}
                      onClick={() => deleteRegion(region.id)}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={styles.sidebarSection}>
              <div style={styles.sidebarTitle}>Entities ({planeEntities.length})</div>
              {planeEntities.length === 0 ? (
                <div style={{ color: '#666', fontSize: '12px' }}>
                  No entities of kind "{selectedKind.name}"
                </div>
              ) : (
                planeEntities.slice(0, 10).map(entity => (
                  <div
                    key={entity.id}
                    style={{
                      ...styles.regionItem,
                      backgroundColor: selectedEntityId === entity.id ? '#0f3460' : '#1a1a2e',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedEntityId(entity.id)}
                  >
                    <div style={{
                      ...styles.regionColor,
                      borderRadius: '50%',
                      backgroundColor: cultures.find(c => c.id === entity.culture)?.color || '#888'
                    }} />
                    <span>{entity.name || entity.id}</span>
                  </div>
                ))
              )}
              {planeEntities.length > 10 && (
                <div style={{ color: '#666', fontSize: '11px', marginTop: '4px' }}>
                  ...and {planeEntities.length - 10} more
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Region Modal */}
      {showNewRegionModal && (
        <div style={styles.modal} onClick={() => setShowNewRegionModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>Add Region to {selectedKind?.name}</div>
            <input
              style={styles.input}
              placeholder="Region label"
              value={newRegion.label}
              onChange={e => setNewRegion({ ...newRegion, label: e.target.value })}
              autoFocus
            />
            <div style={styles.inputRow}>
              <div style={styles.inputGroup}>
                <div style={styles.inputLabel}>Center X</div>
                <input
                  style={styles.input}
                  type="number"
                  value={newRegion.x}
                  onChange={e => setNewRegion({ ...newRegion, x: e.target.value })}
                />
              </div>
              <div style={styles.inputGroup}>
                <div style={styles.inputLabel}>Center Y</div>
                <input
                  style={styles.input}
                  type="number"
                  value={newRegion.y}
                  onChange={e => setNewRegion({ ...newRegion, y: e.target.value })}
                />
              </div>
              <div style={styles.inputGroup}>
                <div style={styles.inputLabel}>Radius</div>
                <input
                  style={styles.input}
                  type="number"
                  value={newRegion.radius}
                  onChange={e => setNewRegion({ ...newRegion, radius: e.target.value })}
                />
              </div>
            </div>
            <div style={styles.modalActions}>
              <button style={styles.button} onClick={() => setShowNewRegionModal(false)}>Cancel</button>
              <button style={styles.addButton} onClick={addRegion}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
