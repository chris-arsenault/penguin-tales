/**
 * CultureEditor - Create and manage cultures with axis biases and home regions.
 */

import React, { useState } from 'react';

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
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  cultureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  cultureCard: {
    backgroundColor: '#16213e',
    borderRadius: '8px',
    padding: '20px',
    border: '2px solid transparent'
  },
  cultureCardActive: {
    borderColor: '#e94560'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },
  colorDot: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    marginRight: '12px',
    cursor: 'pointer',
    border: '2px solid #0f3460'
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center'
  },
  input: {
    padding: '8px 12px',
    fontSize: '14px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    width: '200px'
  },
  inputWide: {
    width: '100%',
    marginTop: '8px'
  },
  deleteButton: {
    padding: '4px 10px',
    fontSize: '11px',
    backgroundColor: 'transparent',
    color: '#e94560',
    border: '1px solid #e94560',
    borderRadius: '3px',
    cursor: 'pointer'
  },
  section: {
    marginTop: '16px'
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#aaa',
    marginBottom: '12px'
  },
  axisRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px'
  },
  axisLabel: {
    width: '120px',
    fontSize: '13px'
  },
  slider: {
    flex: 1,
    height: '6px',
    WebkitAppearance: 'none',
    background: 'linear-gradient(to right, #0f3460, #e94560)',
    borderRadius: '3px',
    outline: 'none'
  },
  axisValue: {
    width: '40px',
    textAlign: 'right',
    fontSize: '12px',
    color: '#888'
  },
  emptyState: {
    color: '#666',
    fontSize: '14px',
    textAlign: 'center',
    padding: '40px'
  },
  colorPicker: {
    position: 'absolute',
    zIndex: 100,
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    width: '200px'
  },
  colorOption: {
    width: '28px',
    height: '28px',
    borderRadius: '4px',
    cursor: 'pointer',
    border: '2px solid transparent'
  }
};

const PRESET_COLORS = [
  '#e94560', '#ff6b6b', '#ffa502', '#ffdd59',
  '#7bed9f', '#2ed573', '#1e90ff', '#5352ed',
  '#a55eea', '#ff6b81', '#70a1ff', '#eccc68',
  '#ff7f50', '#20bf6b', '#0fb9b1', '#778ca3'
];

const DEFAULT_AXES = [
  { name: 'Order', lowLabel: 'Chaotic', highLabel: 'Lawful' },
  { name: 'Influence', lowLabel: 'Subtle', highLabel: 'Dominant' },
  { name: 'Elevation', lowLabel: 'Depths', highLabel: 'Heights' }
];

function generateId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function CultureEditor({ project, onSave }) {
  const [colorPickerFor, setColorPickerFor] = useState(null);
  const cultures = project?.cultures || [];

  const updateCultures = (newCultures) => {
    onSave({ cultures: newCultures });
  };

  const addCulture = () => {
    const newCulture = {
      id: `culture_${Date.now()}`,
      name: 'New Culture',
      description: '',
      color: PRESET_COLORS[cultures.length % PRESET_COLORS.length],
      axisBiases: {
        Order: 50,
        Influence: 50,
        Elevation: 50
      },
      homeRegions: {}
    };
    updateCultures([...cultures, newCulture]);
  };

  const updateCulture = (cultureId, updates) => {
    updateCultures(cultures.map(c =>
      c.id === cultureId ? { ...c, ...updates } : c
    ));
  };

  const deleteCulture = (cultureId) => {
    updateCultures(cultures.filter(c => c.id !== cultureId));
  };

  const setAxisBias = (cultureId, axisName, value) => {
    const culture = cultures.find(c => c.id === cultureId);
    if (!culture) return;

    updateCulture(cultureId, {
      axisBiases: {
        ...culture.axisBiases,
        [axisName]: parseInt(value, 10)
      }
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Cultures</div>
        <div style={styles.subtitle}>
          Define cultures with semantic axis biases that influence entity placement.
        </div>
      </div>

      <div style={styles.toolbar}>
        <span style={{ color: '#888', fontSize: '13px' }}>
          {cultures.length} culture{cultures.length !== 1 ? 's' : ''}
        </span>
        <button style={styles.addButton} onClick={addCulture}>
          + Add Culture
        </button>
      </div>

      {cultures.length === 0 ? (
        <div style={styles.emptyState}>
          No cultures defined yet. Add one to give your world cultural diversity.
        </div>
      ) : (
        <div style={styles.cultureList}>
          {cultures.map((culture) => (
            <div key={culture.id} style={styles.cultureCard}>
              <div style={styles.cardHeader}>
                <div style={styles.nameRow}>
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{ ...styles.colorDot, backgroundColor: culture.color }}
                      onClick={() => setColorPickerFor(
                        colorPickerFor === culture.id ? null : culture.id
                      )}
                    />
                    {colorPickerFor === culture.id && (
                      <div style={styles.colorPicker}>
                        {PRESET_COLORS.map((color) => (
                          <div
                            key={color}
                            style={{
                              ...styles.colorOption,
                              backgroundColor: color,
                              borderColor: culture.color === color ? '#fff' : 'transparent'
                            }}
                            onClick={() => {
                              updateCulture(culture.id, { color });
                              setColorPickerFor(null);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <input
                      style={styles.input}
                      value={culture.name}
                      onChange={(e) => updateCulture(culture.id, {
                        name: e.target.value,
                        id: generateId(e.target.value) || culture.id
                      })}
                      placeholder="Culture name"
                    />
                    <input
                      style={{ ...styles.input, ...styles.inputWide }}
                      value={culture.description || ''}
                      onChange={(e) => updateCulture(culture.id, { description: e.target.value })}
                      placeholder="Description (optional)"
                    />
                  </div>
                </div>
                <button
                  style={styles.deleteButton}
                  onClick={() => deleteCulture(culture.id)}
                >
                  Delete
                </button>
              </div>

              <div style={styles.section}>
                <div style={styles.sectionTitle}>Axis Biases</div>
                {DEFAULT_AXES.map((axis) => (
                  <div key={axis.name} style={styles.axisRow}>
                    <div style={styles.axisLabel}>
                      {axis.name}
                    </div>
                    <span style={{ fontSize: '11px', color: '#666', width: '60px' }}>
                      {axis.lowLabel}
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={culture.axisBiases?.[axis.name] ?? 50}
                      onChange={(e) => setAxisBias(culture.id, axis.name, e.target.value)}
                      style={styles.slider}
                    />
                    <span style={{ fontSize: '11px', color: '#666', width: '60px', textAlign: 'right' }}>
                      {axis.highLabel}
                    </span>
                    <div style={styles.axisValue}>
                      {culture.axisBiases?.[axis.name] ?? 50}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
