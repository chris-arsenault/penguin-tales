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
    height: '100%',
    minHeight: 0
  },
  header: {
    flexShrink: 0,
    marginBottom: '12px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '4px'
  },
  subtitle: {
    color: '#888',
    fontSize: '14px'
  },
  toolbar: {
    flexShrink: 0,
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '12px'
  },
  select: {
    padding: '8px 12px',
    fontSize: '14px',
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    minWidth: '200px'
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
  canvasContainer: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column'
  },
  sidebar: {
    width: '260px',
    flexShrink: 0,
    backgroundColor: '#16213e',
    borderRadius: '8px',
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  sidebarSection: {},
  sidebarTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#888',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  axisInfo: {
    fontSize: '12px',
    color: '#aaa',
    marginBottom: '6px',
    display: 'flex',
    gap: '8px'
  },
  axisLabel: {
    color: '#e94560',
    fontWeight: 600,
    width: '16px'
  },
  axisRange: {
    color: '#666',
    fontSize: '11px'
  },
  regionItem: {
    padding: '8px 10px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    marginBottom: '6px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer'
  },
  regionItemSelected: {
    backgroundColor: '#0f3460'
  },
  regionColor: {
    width: '12px',
    height: '12px',
    borderRadius: '3px',
    flexShrink: 0
  },
  regionLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  deleteButton: {
    padding: '2px 6px',
    fontSize: '10px',
    backgroundColor: 'transparent',
    color: '#e94560',
    border: '1px solid #e94560',
    borderRadius: '3px',
    cursor: 'pointer',
    flexShrink: 0
  },
  entityItem: {
    padding: '8px 10px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    marginBottom: '4px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer'
  },
  entityItemSelected: {
    backgroundColor: '#0f3460'
  },
  entityDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0
  },
  entityName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  entityCoords: {
    fontSize: '10px',
    color: '#666',
    flexShrink: 0
  },
  emptyState: {
    color: '#666',
    fontSize: '13px',
    textAlign: 'center',
    padding: '40px'
  },
  emptyText: {
    color: '#666',
    fontSize: '12px'
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
    width: '360px'
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '16px'
  },
  formGroup: {
    marginBottom: '12px'
  },
  label: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '4px',
    display: 'block'
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '14px',
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    boxSizing: 'border-box'
  },
  inputRow: {
    display: 'flex',
    gap: '12px'
  },
  inputHalf: {
    flex: 1
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '16px'
  },
  button: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#0f3460',
    color: '#aaa',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};

export default function SemanticPlaneEditor({ project, onSave }) {
  const [selectedKindId, setSelectedKindId] = useState(null);
  const [showNewRegionModal, setShowNewRegionModal] = useState(false);
  const [newRegion, setNewRegion] = useState({ label: '', x: 50, y: 50, radius: 15 });
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [selectedRegionId, setSelectedRegionId] = useState(null);

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
        ? { ...e, coordinates: { x: Math.round(coords.x), y: Math.round(coords.y), z: e.coordinates?.z || 50 } }
        : e
    );
    onSave({ seedEntities: updated });
  };

  const handleMoveRegion = (regionId, coords) => {
    if (!selectedKind) return;

    const updatedRegions = (semanticPlane.regions || []).map(r =>
      r.id === regionId
        ? {
            ...r,
            bounds: {
              ...r.bounds,
              center: { x: Math.round(coords.x), y: Math.round(coords.y) }
            }
          }
        : r
    );

    const updatedPlane = {
      ...semanticPlane,
      regions: updatedRegions
    };

    updateEntityKind(selectedKind.id, { semanticPlane: updatedPlane });
  };

  const getCultureColor = (cultureId) => {
    return cultures.find(c => c.id === cultureId)?.color || '#888';
  };

  if (entityKinds.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.title}>Semantic Planes</div>
          <div style={styles.subtitle}>
            View and edit the coordinate space for each entity kind.
          </div>
        </div>
        <div style={styles.emptyState}>
          Define entity kinds in the Schema tab first to view their semantic planes.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Semantic Planes</div>
        <div style={styles.subtitle}>
          Drag entities to reposition. Scroll to zoom, drag background to pan.
        </div>
      </div>

      <div style={styles.toolbar}>
        <select
          style={styles.select}
          value={selectedKind?.id || ''}
          onChange={(e) => {
            setSelectedKindId(e.target.value);
            setSelectedEntityId(null);
            setSelectedRegionId(null);
          }}
        >
          {entityKinds.map(k => (
            <option key={k.id} value={k.id}>
              {k.name} ({seedEntities.filter(e => e.kind === k.id).length} entities)
            </option>
          ))}
        </select>
        <button style={styles.addButton} onClick={() => setShowNewRegionModal(true)}>
          + Add Region
        </button>
      </div>

      <div style={styles.mainArea}>
        <div style={styles.canvasContainer}>
          <PlaneCanvas
            plane={semanticPlane}
            regions={semanticPlane.regions || []}
            entities={planeEntities}
            cultures={cultures}
            selectedEntityId={selectedEntityId}
            selectedRegionId={selectedRegionId}
            onSelectEntity={setSelectedEntityId}
            onSelectRegion={setSelectedRegionId}
            onMoveEntity={handleMoveEntity}
            onMoveRegion={handleMoveRegion}
          />
        </div>

        <div style={styles.sidebar}>
          <div style={styles.sidebarSection}>
            <div style={styles.sidebarTitle}>Axes</div>
            {['x', 'y', 'z'].map(axis => {
              const config = semanticPlane.axes?.[axis];
              if (!config) return null;
              return (
                <div key={axis} style={styles.axisInfo}>
                  <span style={styles.axisLabel}>{axis.toUpperCase()}</span>
                  <span>{config.name}</span>
                  <span style={styles.axisRange}>
                    ({config.lowLabel} → {config.highLabel})
                  </span>
                </div>
              );
            })}
          </div>

          <div style={styles.sidebarSection}>
            <div style={styles.sidebarTitle}>
              Regions ({semanticPlane.regions?.length || 0})
            </div>
            {(semanticPlane.regions || []).length === 0 ? (
              <div style={styles.emptyText}>No regions defined</div>
            ) : (
              semanticPlane.regions.map(region => (
                <div
                  key={region.id}
                  style={{
                    ...styles.regionItem,
                    ...(selectedRegionId === region.id ? styles.regionItemSelected : {})
                  }}
                  onClick={() => {
                    setSelectedRegionId(region.id);
                    setSelectedEntityId(null);
                  }}
                >
                  <div style={{ ...styles.regionColor, backgroundColor: region.color }} />
                  <span style={styles.regionLabel}>{region.label}</span>
                  <span style={styles.entityCoords}>
                    ({Math.round(region.bounds?.center?.x || 0)}, {Math.round(region.bounds?.center?.y || 0)})
                  </span>
                  <button
                    style={styles.deleteButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRegion(region.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={styles.sidebarSection}>
            <div style={styles.sidebarTitle}>
              Entities ({planeEntities.length})
            </div>
            {planeEntities.length === 0 ? (
              <div style={styles.emptyText}>
                No {selectedKind?.name || 'entities'} yet
              </div>
            ) : (
              <>
                {planeEntities.slice(0, 15).map(entity => (
                  <div
                    key={entity.id}
                    style={{
                      ...styles.entityItem,
                      ...(selectedEntityId === entity.id ? styles.entityItemSelected : {})
                    }}
                    onClick={() => setSelectedEntityId(entity.id)}
                  >
                    <div style={{
                      ...styles.entityDot,
                      backgroundColor: getCultureColor(entity.culture)
                    }} />
                    <span style={styles.entityName}>{entity.name}</span>
                    <span style={styles.entityCoords}>
                      ({Math.round(entity.coordinates?.x || 0)}, {Math.round(entity.coordinates?.y || 0)})
                    </span>
                  </div>
                ))}
                {planeEntities.length > 15 && (
                  <div style={{ ...styles.emptyText, marginTop: '4px' }}>
                    +{planeEntities.length - 15} more
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* New Region Modal */}
      {showNewRegionModal && (
        <div style={styles.modal} onClick={() => setShowNewRegionModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>Add Region to {selectedKind?.name}</div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Label</label>
              <input
                style={styles.input}
                placeholder="Region name"
                value={newRegion.label}
                onChange={e => setNewRegion({ ...newRegion, label: e.target.value })}
                autoFocus
              />
            </div>

            <div style={styles.inputRow}>
              <div style={styles.inputHalf}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Center X (0-100)</label>
                  <input
                    style={styles.input}
                    type="number"
                    min="0"
                    max="100"
                    value={newRegion.x}
                    onChange={e => setNewRegion({ ...newRegion, x: e.target.value })}
                  />
                </div>
              </div>
              <div style={styles.inputHalf}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Center Y (0-100)</label>
                  <input
                    style={styles.input}
                    type="number"
                    min="0"
                    max="100"
                    value={newRegion.y}
                    onChange={e => setNewRegion({ ...newRegion, y: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Radius</label>
              <input
                style={styles.input}
                type="number"
                min="1"
                max="50"
                value={newRegion.radius}
                onChange={e => setNewRegion({ ...newRegion, radius: e.target.value })}
              />
            </div>

            <div style={styles.modalActions}>
              <button style={styles.button} onClick={() => setShowNewRegionModal(false)}>
                Cancel
              </button>
              <button style={styles.addButton} onClick={addRegion}>
                Add Region
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
