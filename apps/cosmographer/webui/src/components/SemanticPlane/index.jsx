/**
 * SemanticPlane - Editor for semantic planes with regions and entity visualization.
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
  addButton: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#e94560',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
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
  }
};

const DEFAULT_PLANE = {
  name: 'New Plane',
  axes: {
    x: { name: 'X Axis', lowLabel: 'Low', highLabel: 'High' },
    y: { name: 'Y Axis', lowLabel: 'Low', highLabel: 'High' }
  },
  bounds: {
    x: { min: 0, max: 100 },
    y: { min: 0, max: 100 }
  },
  regions: []
};

export default function SemanticPlaneEditor({ project, onSave }) {
  const [selectedPlaneId, setSelectedPlaneId] = useState(null);
  const [showNewPlaneModal, setShowNewPlaneModal] = useState(false);
  const [showNewRegionModal, setShowNewRegionModal] = useState(false);
  const [newPlaneName, setNewPlaneName] = useState('');
  const [newPlaneKind, setNewPlaneKind] = useState('');
  const [newRegion, setNewRegion] = useState({ label: '', x: 50, y: 50, radius: 15 });
  const [selectedEntityId, setSelectedEntityId] = useState(null);

  const planes = project?.semanticPlanes || [];
  const cultures = project?.cultures || [];
  const entityKinds = project?.worldSchema?.entityKinds || [];
  const seedEntities = project?.seedEntities || [];

  const selectedPlane = planes.find(p => p.id === selectedPlaneId) || planes[0];
  const planeEntities = seedEntities.filter(e => e.kind === selectedPlane?.entityKind);

  const updatePlanes = (newPlanes) => {
    onSave({ semanticPlanes: newPlanes });
  };

  const addPlane = () => {
    if (!newPlaneName.trim()) return;

    const newPlane = {
      ...DEFAULT_PLANE,
      id: `plane_${Date.now()}`,
      name: newPlaneName.trim(),
      entityKind: newPlaneKind || entityKinds[0]?.id || 'default',
      regions: []
    };

    updatePlanes([...planes, newPlane]);
    setSelectedPlaneId(newPlane.id);
    setShowNewPlaneModal(false);
    setNewPlaneName('');
    setNewPlaneKind('');
  };

  const addRegion = () => {
    if (!selectedPlane || !newRegion.label.trim()) return;

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
      ...selectedPlane,
      regions: [...(selectedPlane.regions || []), region]
    };

    updatePlanes(planes.map(p => p.id === selectedPlane.id ? updatedPlane : p));
    setShowNewRegionModal(false);
    setNewRegion({ label: '', x: 50, y: 50, radius: 15 });
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
          Configure coordinate spaces for each entity kind with named axes and regions.
        </div>
      </div>

      <div style={styles.toolbar}>
        <select
          style={styles.select}
          value={selectedPlane?.id || ''}
          onChange={(e) => setSelectedPlaneId(e.target.value)}
        >
          {planes.length === 0 && <option value="">No planes</option>}
          {planes.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.entityKind})
            </option>
          ))}
        </select>
        <button style={styles.addButton} onClick={() => setShowNewPlaneModal(true)}>
          + New Plane
        </button>
        {selectedPlane && (
          <button style={styles.button} onClick={() => setShowNewRegionModal(true)}>
            + Add Region
          </button>
        )}
      </div>

      {!selectedPlane ? (
        <div style={styles.emptyState}>
          No semantic planes defined. Create one to visualize your world's coordinate space.
        </div>
      ) : (
        <div style={styles.mainArea}>
          <div style={styles.canvasArea}>
            <PlaneCanvas
              plane={selectedPlane}
              regions={selectedPlane.regions || []}
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
              <div style={styles.sidebarTitle}>Regions ({selectedPlane.regions?.length || 0})</div>
              {(selectedPlane.regions || []).length === 0 ? (
                <div style={{ color: '#666', fontSize: '12px' }}>No regions yet</div>
              ) : (
                selectedPlane.regions.map(region => (
                  <div key={region.id} style={styles.regionItem}>
                    <div style={{ ...styles.regionColor, backgroundColor: region.color }} />
                    <span>{region.label}</span>
                  </div>
                ))
              )}
            </div>

            <div style={styles.sidebarSection}>
              <div style={styles.sidebarTitle}>Entities ({planeEntities.length})</div>
              {planeEntities.length === 0 ? (
                <div style={{ color: '#666', fontSize: '12px' }}>
                  No entities of kind "{selectedPlane.entityKind}"
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
            </div>
          </div>
        </div>
      )}

      {/* New Plane Modal */}
      {showNewPlaneModal && (
        <div style={styles.modal} onClick={() => setShowNewPlaneModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>Create Semantic Plane</div>
            <input
              style={styles.input}
              placeholder="Plane name"
              value={newPlaneName}
              onChange={e => setNewPlaneName(e.target.value)}
              autoFocus
            />
            <div style={styles.inputLabel}>Entity Kind</div>
            <select
              style={{ ...styles.input, marginBottom: '0' }}
              value={newPlaneKind}
              onChange={e => setNewPlaneKind(e.target.value)}
            >
              <option value="">Select kind...</option>
              {entityKinds.map(k => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
            <div style={styles.modalActions}>
              <button style={styles.button} onClick={() => setShowNewPlaneModal(false)}>Cancel</button>
              <button style={styles.addButton} onClick={addPlane}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* New Region Modal */}
      {showNewRegionModal && (
        <div style={styles.modal} onClick={() => setShowNewRegionModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>Add Region</div>
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
