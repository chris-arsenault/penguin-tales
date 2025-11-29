/**
 * CultureEditor - Edit culture identity (id, name, description, color)
 *
 * This edits the BASE culture identity only.
 * - Axis biases and home regions are edited in Cosmographer
 * - Naming data is edited in Name Forge
 */

import React, { useState } from 'react';

const styles = {
  container: {
    maxWidth: '900px',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '8px',
  },
  subtitle: {
    color: '#888',
    fontSize: '14px',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  addButton: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#e94560',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  cultureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cultureCard: {
    backgroundColor: '#16213e',
    borderRadius: '8px',
    border: '1px solid #0f3460',
    overflow: 'hidden',
  },
  cultureHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    cursor: 'pointer',
  },
  cultureHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  expandIcon: {
    fontSize: '12px',
    color: '#888',
    transition: 'transform 0.2s',
    width: '16px',
  },
  colorDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid #0f3460',
  },
  cultureName: {
    fontWeight: 500,
  },
  cultureId: {
    color: '#666',
    fontSize: '11px',
  },
  cultureSummary: {
    fontSize: '11px',
    color: '#666',
  },
  cultureBody: {
    padding: '16px',
    borderTop: '1px solid #0f3460',
  },
  formRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    alignItems: 'flex-start',
  },
  formGroup: {
    flex: 1,
  },
  label: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '6px',
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '14px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    boxSizing: 'border-box',
  },
  colorSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  colorPickerDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    cursor: 'pointer',
    border: '3px solid #0f3460',
  },
  colorPicker: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  colorOption: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    cursor: 'pointer',
    border: '2px solid transparent',
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
  },
  deleteButton: {
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    color: '#e94560',
    border: '1px solid #e94560',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  emptyState: {
    color: '#666',
    fontSize: '14px',
    textAlign: 'center',
    padding: '40px',
  },
  badge: {
    padding: '2px 6px',
    backgroundColor: '#0f3460',
    borderRadius: '3px',
    fontSize: '10px',
    color: '#888',
  },
  infoBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: '6px',
    padding: '12px',
    fontSize: '12px',
    color: '#888',
    marginTop: '16px',
  },
};

const PRESET_COLORS = [
  '#e94560', '#ff6b6b', '#ffa502', '#ffdd59',
  '#7bed9f', '#2ed573', '#1e90ff', '#5352ed',
  '#a55eea', '#ff6b81', '#70a1ff', '#eccc68',
  '#ff7f50', '#20bf6b', '#0fb9b1', '#778ca3',
];

export default function CultureEditor({ cultures, onChange }) {
  const [expandedCultures, setExpandedCultures] = useState({});

  // Use stable key for expand/collapse tracking (falls back to id for existing cultures)
  const getStableKey = (culture) => culture._key || culture.id;

  const toggleCulture = (stableKey) => {
    setExpandedCultures((prev) => ({ ...prev, [stableKey]: !prev[stableKey] }));
  };

  const addCulture = () => {
    const stableKey = `culture_${Date.now()}`;
    const newCulture = {
      id: stableKey,
      name: 'New Culture',
      description: '',
      color: PRESET_COLORS[cultures.length % PRESET_COLORS.length],
      _key: stableKey, // Stable key for React, never changes
    };
    onChange([...cultures, newCulture]);
    setExpandedCultures((prev) => ({ ...prev, [stableKey]: true }));
  };

  const updateCulture = (cultureId, updates) => {
    onChange(
      cultures.map((c) => (c.id === cultureId ? { ...c, ...updates } : c))
    );
  };

  const deleteCulture = (cultureId) => {
    if (confirm('Delete this culture?')) {
      onChange(cultures.filter((c) => c.id !== cultureId));
    }
  };

  const getCultureSummary = (culture) => {
    const parts = [];
    if (culture.naming?.domains?.length) {
      parts.push(`${culture.naming.domains.length} domains`);
    }
    if (culture.axisBiases && Object.keys(culture.axisBiases).length) {
      parts.push('axis biases');
    }
    return parts.length > 0 ? parts.join(', ') : 'not configured';
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Cultures</div>
        <div style={styles.subtitle}>
          Define cultural groups with their own naming conventions and placement biases.
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
          {cultures.map((culture) => {
            const stableKey = getStableKey(culture);
            const isExpanded = expandedCultures[stableKey];

            return (
              <div key={stableKey} style={styles.cultureCard}>
                <div
                  style={styles.cultureHeader}
                  onClick={() => toggleCulture(stableKey)}
                >
                  <div style={styles.cultureHeaderLeft}>
                    <span
                      style={{
                        ...styles.expandIcon,
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}
                    >
                      ▶
                    </span>
                    <div
                      style={{ ...styles.colorDot, backgroundColor: culture.color }}
                    />
                    <span style={styles.cultureName}>{culture.name}</span>
                    <span style={styles.cultureId}>({culture.id})</span>
                  </div>
                  <div style={styles.cultureSummary}>
                    {getCultureSummary(culture)}
                  </div>
                </div>

                {isExpanded && (
                  <div style={styles.cultureBody}>
                    {/* Name and Description */}
                    <div style={styles.formRow}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Name</label>
                        <input
                          style={styles.input}
                          value={culture.name}
                          onChange={(e) =>
                            updateCulture(culture.id, { name: e.target.value })
                          }
                          placeholder="Culture name"
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>ID</label>
                        <input
                          style={styles.input}
                          value={culture.id}
                          onChange={(e) => {
                            const newId = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
                            if (newId && !cultures.some((c) => c.id === newId && c.id !== culture.id)) {
                              // Just update the ID - expanded state uses stable _key, not id
                              updateCulture(culture.id, { id: newId });
                            }
                          }}
                          placeholder="culture-id"
                        />
                      </div>
                    </div>

                    <div style={styles.formRow}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Description</label>
                        <input
                          style={styles.input}
                          value={culture.description || ''}
                          onChange={(e) =>
                            updateCulture(culture.id, { description: e.target.value })
                          }
                          placeholder="Optional description"
                        />
                      </div>
                    </div>

                    {/* Color Selection */}
                    <div style={styles.colorSection}>
                      <div
                        style={{
                          ...styles.colorPickerDot,
                          backgroundColor: culture.color,
                        }}
                      />
                      <div style={styles.colorPicker}>
                        {PRESET_COLORS.map((color) => (
                          <div
                            key={color}
                            style={{
                              ...styles.colorOption,
                              backgroundColor: color,
                              borderColor:
                                culture.color === color ? '#fff' : 'transparent',
                            }}
                            onClick={() => updateCulture(culture.id, { color })}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Info about other editors */}
                    <div style={styles.infoBox}>
                      <strong>Additional configuration:</strong>
                      <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                        <li>
                          <strong>Names tab</strong> — Configure naming domains, grammars,
                          and profiles
                        </li>
                        <li>
                          <strong>Cosmography tab</strong> — Configure axis biases and home
                          regions
                        </li>
                      </ul>
                    </div>

                    {/* Actions */}
                    <div style={styles.actionsRow}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {culture.naming && (
                          <span style={styles.badge}>has naming</span>
                        )}
                        {culture.axisBiases && (
                          <span style={styles.badge}>has biases</span>
                        )}
                      </div>
                      <button
                        style={styles.deleteButton}
                        onClick={() => deleteCulture(culture.id)}
                      >
                        Delete Culture
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
