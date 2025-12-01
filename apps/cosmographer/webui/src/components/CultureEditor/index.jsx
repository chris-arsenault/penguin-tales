/**
 * CultureEditor - Create and manage cultures with collapsible per-entity-kind axis biases.
 *
 * Schema v2: Each culture has axisBiases keyed by entityKindId, where each
 * contains x, y, z values corresponding to that kind's semantic plane axes.
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
    gap: '8px'
  },
  cultureCard: {
    backgroundColor: '#16213e',
    borderRadius: '8px',
    border: '1px solid #0f3460',
    overflow: 'hidden'
  },
  cultureHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    cursor: 'pointer'
  },
  cultureHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  expandIcon: {
    fontSize: '12px',
    color: '#888',
    transition: 'transform 0.2s',
    width: '16px'
  },
  colorDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid #0f3460'
  },
  cultureName: {
    fontWeight: 500
  },
  cultureId: {
    color: '#666',
    fontSize: '11px'
  },
  cultureSummary: {
    fontSize: '11px',
    color: '#666'
  },
  cultureBody: {
    padding: '16px',
    borderTop: '1px solid #0f3460'
  },
  formRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    alignItems: 'flex-start'
  },
  formGroup: {
    flex: 1
  },
  label: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '6px',
    display: 'block'
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '14px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    boxSizing: 'border-box'
  },
  colorSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px'
  },
  colorPickerDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    cursor: 'pointer',
    border: '3px solid #0f3460'
  },
  colorPicker: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
  },
  colorOption: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    cursor: 'pointer',
    border: '2px solid transparent'
  },
  accordion: {
    backgroundColor: '#1a1a2e',
    borderRadius: '6px',
    overflow: 'hidden',
    marginBottom: '8px'
  },
  accordionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    color: '#ccc'
  },
  accordionHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  accordionIcon: {
    fontSize: '10px',
    color: '#666',
    transition: 'transform 0.2s'
  },
  accordionBody: {
    padding: '12px',
    borderTop: '1px solid #0f3460'
  },
  axisRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  axisLabel: {
    width: '20px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#e94560'
  },
  axisName: {
    width: '90px',
    fontSize: '11px',
    color: '#888',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  lowLabel: {
    fontSize: '10px',
    color: '#666',
    width: '55px',
    textAlign: 'right'
  },
  highLabel: {
    fontSize: '10px',
    color: '#666',
    width: '55px'
  },
  slider: {
    flex: 1,
    height: '4px',
    WebkitAppearance: 'none',
    background: 'linear-gradient(to right, #0f3460, #e94560)',
    borderRadius: '2px',
    outline: 'none'
  },
  axisValue: {
    width: '28px',
    textAlign: 'right',
    fontSize: '11px',
    color: '#888'
  },
  deleteButton: {
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    color: '#e94560',
    border: '1px solid #e94560',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  emptyState: {
    color: '#666',
    fontSize: '14px',
    textAlign: 'center',
    padding: '40px'
  },
  noKindsWarning: {
    color: '#f0a500',
    fontSize: '12px',
    padding: '12px',
    backgroundColor: 'rgba(240, 165, 0, 0.1)',
    borderRadius: '4px'
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '16px'
  }
};

export default function CultureEditor({ project, onSave }) {
  const [expandedCultures, setExpandedCultures] = useState({});
  const [expandedKinds, setExpandedKinds] = useState({});

  const cultures = project?.cultures || [];
  const entityKinds = project?.entityKinds || [];

  const toggleCulture = (cultureId) => {
    setExpandedCultures(prev => ({ ...prev, [cultureId]: !prev[cultureId] }));
  };

  const toggleKind = (cultureId, kindId) => {
    const key = `${cultureId}-${kindId}`;
    setExpandedKinds(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isKindExpanded = (cultureId, kindId) => {
    return expandedKinds[`${cultureId}-${kindId}`];
  };

  const updateCultures = (newCultures) => {
    onSave({ cultures: newCultures });
  };

  const updateCulture = (cultureId, updates) => {
    updateCultures(cultures.map(c =>
      c.id === cultureId ? { ...c, ...updates } : c
    ));
  };

  const setAxisBias = (cultureId, kindId, axis, value) => {
    const culture = cultures.find(c => c.id === cultureId);
    if (!culture) return;

    const kindBiases = culture.axisBiases?.[kindId] || { x: 50, y: 50, z: 50 };

    updateCulture(cultureId, {
      axisBiases: {
        ...culture.axisBiases,
        [kindId]: {
          ...kindBiases,
          [axis]: parseInt(value, 10)
        }
      }
    });
  };

  const getBiasSummary = (culture) => {
    const biasCount = Object.keys(culture.axisBiases || {}).length;
    return `${biasCount} kind${biasCount !== 1 ? 's' : ''} configured`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Culture Biases</div>
        <div style={styles.subtitle}>
          Configure axis biases for each culture on each entity kind's semantic plane.
        </div>
      </div>

      <div style={styles.toolbar}>
        <span style={{ color: '#888', fontSize: '13px' }}>
          {cultures.length} culture{cultures.length !== 1 ? 's' : ''}
        </span>
      </div>

      {cultures.length === 0 ? (
        <div style={styles.emptyState}>
          No cultures defined yet. Add cultures in the Enumerist tab first.
        </div>
      ) : (
        <div style={styles.cultureList}>
          {cultures.map((culture) => {
            const isExpanded = expandedCultures[culture.id];

            return (
              <div key={culture.id} style={styles.cultureCard}>
                <div
                  style={styles.cultureHeader}
                  onClick={() => toggleCulture(culture.id)}
                >
                  <div style={styles.cultureHeaderLeft}>
                    <span style={{
                      ...styles.expandIcon,
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                    }}>
                      ▶
                    </span>
                    <div style={{ ...styles.colorDot, backgroundColor: culture.color }} />
                    <span style={styles.cultureName}>{culture.name}</span>
                    <span style={styles.cultureId}>({culture.id})</span>
                  </div>
                  <div style={styles.cultureSummary}>
                    {getBiasSummary(culture)}
                  </div>
                </div>

                {isExpanded && (
                  <div style={styles.cultureBody}>
                    {/* Axis Biases by Entity Kind */}
                    {entityKinds.length === 0 ? (
                      <div style={styles.noKindsWarning}>
                        Define entity kinds in the Enumerist tab first to configure axis biases.
                      </div>
                    ) : (
                      entityKinds.map((kind) => {
                        const axes = kind.semanticPlane?.axes || {};
                        const biases = culture.axisBiases?.[kind.kind] || { x: 50, y: 50, z: 50 };
                        const kindExpanded = isKindExpanded(culture.id, kind.kind);

                        return (
                          <div key={kind.kind} style={styles.accordion}>
                            <div
                              style={styles.accordionHeader}
                              onClick={() => toggleKind(culture.id, kind.kind)}
                            >
                              <div style={styles.accordionHeaderLeft}>
                                <span style={{
                                  ...styles.accordionIcon,
                                  transform: kindExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                }}>▶</span>
                                <span>{kind.description || kind.kind}</span>
                              </div>
                              <span style={{ fontSize: '11px', color: '#666' }}>
                                X:{biases.x} Y:{biases.y} Z:{biases.z}
                              </span>
                            </div>
                            {kindExpanded && (
                              <div style={styles.accordionBody}>
                                {['x', 'y', 'z'].map((axis) => {
                                  const axisConfig = axes[axis] || { name: `${axis.toUpperCase()} Axis`, lowLabel: 'Low', highLabel: 'High' };
                                  return (
                                    <div key={axis} style={styles.axisRow}>
                                      <span style={styles.axisLabel}>{axis.toUpperCase()}</span>
                                      <span style={styles.axisName} title={axisConfig.name}>
                                        {axisConfig.name}
                                      </span>
                                      <span style={styles.lowLabel}>{axisConfig.lowLabel}</span>
                                      <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={biases[axis] ?? 50}
                                        onChange={(e) => setAxisBias(culture.id, kind.kind, axis, e.target.value)}
                                        style={styles.slider}
                                      />
                                      <span style={styles.highLabel}>{axisConfig.highLabel}</span>
                                      <div style={styles.axisValue}>{biases[axis] ?? 50}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
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
