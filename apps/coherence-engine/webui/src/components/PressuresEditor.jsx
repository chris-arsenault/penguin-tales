/**
 * PressuresEditor - UI for editing pressure configurations
 *
 * Pressures are environmental/social forces that drive world evolution.
 * Each pressure has:
 * - Basic config (id, name, initialValue, decay)
 * - Growth config with positive and negative feedback factors
 */

import React, { useState, useCallback } from 'react';

// Arctic Blue base theme with amber accent
const ACCENT_COLOR = '#f59e0b';
const ACCENT_GRADIENT = 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)';

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#93c5fd',
  },
  pressureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  pressureCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    overflow: 'hidden',
  },
  pressureHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  pressureHeaderHover: {
    backgroundColor: '#2d4a6f',
  },
  pressureTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  pressureName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
  },
  pressureId: {
    fontSize: '12px',
    color: '#60a5fa',
    backgroundColor: '#0c1f2e',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  pressureStats: {
    display: 'flex',
    gap: '16px',
    fontSize: '13px',
    color: '#93c5fd',
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  statLabel: {
    color: '#60a5fa',
  },
  statValue: {
    color: '#ffffff',
    fontWeight: 500,
  },
  expandIcon: {
    fontSize: '18px',
    color: '#60a5fa',
    transition: 'transform 0.2s',
  },
  expandIconOpen: {
    transform: 'rotate(180deg)',
  },
  pressureContent: {
    padding: '0 20px 20px',
    borderTop: '1px solid rgba(59, 130, 246, 0.3)',
  },
  section: {
    marginTop: '20px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#93c5fd',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionIcon: {
    fontSize: '14px',
  },
  inputGroup: {
    marginBottom: '16px',
  },
  inputRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '16px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: '#93c5fd',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    backgroundColor: '#0a1929',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    color: '#ffffff',
    boxSizing: 'border-box',
  },
  factorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  factorCard: {
    backgroundColor: '#0a1929',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  factorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  factorType: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#ffffff',
    backgroundColor: '#2d4a6f',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  factorDetails: {
    fontSize: '12px',
    color: '#93c5fd',
    lineHeight: 1.6,
  },
  factorRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  factorTag: {
    backgroundColor: '#2d4a6f',
    padding: '2px 6px',
    borderRadius: '3px',
    color: '#93c5fd',
  },
  deleteButton: {
    padding: '4px 8px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    border: '1px solid #ef4444',
    borderRadius: '4px',
    color: '#ef4444',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    border: '2px dashed rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    color: '#60a5fa',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  addButtonHover: {
    borderColor: ACCENT_COLOR,
    color: ACCENT_COLOR,
  },
  addFactorButton: {
    padding: '8px 12px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    border: '1px dashed rgba(59, 130, 246, 0.3)',
    borderRadius: '4px',
    color: '#60a5fa',
    cursor: 'pointer',
    marginTop: '8px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    color: '#60a5fa',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  emptyFactors: {
    padding: '12px',
    textAlign: 'center',
    color: '#60a5fa',
    fontSize: '13px',
    fontStyle: 'italic',
  },
};

// Factor type labels
const FACTOR_TYPE_LABELS = {
  entity_count: 'Entity Count',
  relationship_count: 'Relationship Count',
  tag_count: 'Tag Count',
  ratio: 'Ratio',
  status_ratio: 'Status Ratio',
  cross_culture_ratio: 'Cross-Culture Ratio',
};

function FactorCard({ factor, onDelete }) {
  const renderFactorDetails = () => {
    switch (factor.type) {
      case 'entity_count':
        return (
          <div style={styles.factorDetails}>
            <div>Kind: <span style={styles.factorTag}>{factor.kind}</span></div>
            {factor.subtype && <div>Subtype: <span style={styles.factorTag}>{factor.subtype}</span></div>}
            {factor.status && <div>Status: <span style={styles.factorTag}>{factor.status}</span></div>}
            <div>Coefficient: {factor.coefficient}{factor.cap ? `, Cap: ${factor.cap}` : ''}</div>
          </div>
        );
      case 'relationship_count':
        return (
          <div style={styles.factorDetails}>
            <div style={styles.factorRow}>
              Kinds: {factor.relationshipKinds?.map(k => (
                <span key={k} style={styles.factorTag}>{k}</span>
              ))}
            </div>
            <div>Coefficient: {factor.coefficient}{factor.cap ? `, Cap: ${factor.cap}` : ''}</div>
          </div>
        );
      case 'tag_count':
        return (
          <div style={styles.factorDetails}>
            <div style={styles.factorRow}>
              Tags: {factor.tags?.map(t => (
                <span key={t} style={styles.factorTag}>{t}</span>
              ))}
            </div>
            <div>Coefficient: {factor.coefficient}</div>
          </div>
        );
      case 'ratio':
        return (
          <div style={styles.factorDetails}>
            <div>Numerator: {factor.numerator?.type} ({factor.numerator?.kind || factor.numerator?.relationshipKinds?.join(', ')})</div>
            <div>Denominator: {factor.denominator?.type} ({factor.denominator?.kind || factor.denominator?.relationshipKinds?.join(', ')})</div>
            <div>Coefficient: {factor.coefficient}, Fallback: {factor.fallbackValue ?? 0}{factor.cap ? `, Cap: ${factor.cap}` : ''}</div>
          </div>
        );
      case 'status_ratio':
        return (
          <div style={styles.factorDetails}>
            <div>Kind: <span style={styles.factorTag}>{factor.kind}</span></div>
            {factor.subtype && <div>Subtype: <span style={styles.factorTag}>{factor.subtype}</span></div>}
            <div>Alive Status: <span style={styles.factorTag}>{factor.aliveStatus}</span></div>
            <div>Coefficient: {factor.coefficient}</div>
          </div>
        );
      case 'cross_culture_ratio':
        return (
          <div style={styles.factorDetails}>
            <div style={styles.factorRow}>
              Relationship Kinds: {factor.relationshipKinds?.map(k => (
                <span key={k} style={styles.factorTag}>{k}</span>
              ))}
            </div>
            <div>Coefficient: {factor.coefficient}</div>
          </div>
        );
      default:
        return <div style={styles.factorDetails}>Unknown factor type</div>;
    }
  };

  return (
    <div style={styles.factorCard}>
      <div style={styles.factorHeader}>
        <span style={styles.factorType}>{FACTOR_TYPE_LABELS[factor.type] || factor.type}</span>
        <button style={styles.deleteButton} onClick={onDelete}>Remove</button>
      </div>
      {renderFactorDetails()}
    </div>
  );
}

function PressureCard({ pressure, expanded, onToggle, onChange }) {
  const [hovering, setHovering] = useState(false);

  const handleFieldChange = useCallback((field, value) => {
    onChange({
      ...pressure,
      [field]: value,
    });
  }, [pressure, onChange]);

  const handleGrowthChange = useCallback((field, value) => {
    onChange({
      ...pressure,
      growth: {
        ...pressure.growth,
        [field]: value,
      },
    });
  }, [pressure, onChange]);

  const handleRemovePositiveFactor = useCallback((index) => {
    const newFactors = [...(pressure.growth?.positiveFeedback || [])];
    newFactors.splice(index, 1);
    handleGrowthChange('positiveFeedback', newFactors);
  }, [pressure, handleGrowthChange]);

  const handleRemoveNegativeFactor = useCallback((index) => {
    const newFactors = [...(pressure.growth?.negativeFeedback || [])];
    newFactors.splice(index, 1);
    handleGrowthChange('negativeFeedback', newFactors);
  }, [pressure, handleGrowthChange]);

  const positiveFeedback = pressure.growth?.positiveFeedback || [];
  const negativeFeedback = pressure.growth?.negativeFeedback || [];

  return (
    <div style={styles.pressureCard}>
      <div
        style={{
          ...styles.pressureHeader,
          ...(hovering ? styles.pressureHeaderHover : {}),
        }}
        onClick={onToggle}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div style={styles.pressureTitle}>
          <span style={styles.pressureName}>{pressure.name}</span>
          <span style={styles.pressureId}>{pressure.id}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={styles.pressureStats}>
            <div style={styles.stat}>
              <span style={styles.statLabel}>Initial:</span>
              <span style={styles.statValue}>{pressure.initialValue}</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statLabel}>Decay:</span>
              <span style={styles.statValue}>{pressure.decay}</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statLabel}>Factors:</span>
              <span style={styles.statValue}>{positiveFeedback.length + negativeFeedback.length}</span>
            </div>
          </div>
          <span style={{
            ...styles.expandIcon,
            ...(expanded ? styles.expandIconOpen : {}),
          }}>
            ▼
          </span>
        </div>
      </div>

      {expanded && (
        <div style={styles.pressureContent}>
          {/* Basic Info */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>📝</span>
              Basic Configuration
            </div>
            <div style={styles.inputRow}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>ID</label>
                <input
                  type="text"
                  value={pressure.id}
                  onChange={(e) => handleFieldChange('id', e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Name</label>
                <input
                  type="text"
                  value={pressure.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Initial Value (0-100)</label>
                <input
                  type="number"
                  value={pressure.initialValue}
                  onChange={(e) => handleFieldChange('initialValue', parseFloat(e.target.value) || 0)}
                  style={styles.input}
                  min="0"
                  max="100"
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Decay (per tick)</label>
                <input
                  type="number"
                  value={pressure.decay}
                  onChange={(e) => handleFieldChange('decay', parseFloat(e.target.value) || 0)}
                  style={styles.input}
                  min="0"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          {/* Growth Config */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>📈</span>
              Growth Configuration
            </div>
            <div style={styles.inputRow}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Base Growth</label>
                <input
                  type="number"
                  value={pressure.growth?.baseGrowth || 0}
                  onChange={(e) => handleGrowthChange('baseGrowth', parseFloat(e.target.value) || 0)}
                  style={styles.input}
                  step="0.1"
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Max Growth</label>
                <input
                  type="number"
                  value={pressure.growth?.maxGrowth || ''}
                  onChange={(e) => handleGrowthChange('maxGrowth', e.target.value ? parseFloat(e.target.value) : undefined)}
                  style={styles.input}
                  step="0.1"
                  placeholder="No limit"
                />
              </div>
            </div>
          </div>

          {/* Positive Feedback */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>➕</span>
              Positive Feedback ({positiveFeedback.length})
            </div>
            <div style={styles.factorList}>
              {positiveFeedback.length === 0 ? (
                <div style={styles.emptyFactors}>No positive feedback factors</div>
              ) : (
                positiveFeedback.map((factor, index) => (
                  <FactorCard
                    key={index}
                    factor={factor}
                    onDelete={() => handleRemovePositiveFactor(index)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Negative Feedback */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>➖</span>
              Negative Feedback ({negativeFeedback.length})
            </div>
            <div style={styles.factorList}>
              {negativeFeedback.length === 0 ? (
                <div style={styles.emptyFactors}>No negative feedback factors</div>
              ) : (
                negativeFeedback.map((factor, index) => (
                  <FactorCard
                    key={index}
                    factor={factor}
                    onDelete={() => handleRemoveNegativeFactor(index)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PressuresEditor({ pressures = [], onChange }) {
  const [expandedPressure, setExpandedPressure] = useState(null);
  const [addHovering, setAddHovering] = useState(false);

  const handlePressureChange = useCallback((index, updatedPressure) => {
    const newPressures = [...pressures];
    newPressures[index] = updatedPressure;
    onChange(newPressures);
  }, [pressures, onChange]);

  const handleAddPressure = useCallback(() => {
    const newPressure = {
      id: `pressure_${Date.now()}`,
      name: 'New Pressure',
      initialValue: 50,
      decay: 5,
      growth: {
        positiveFeedback: [],
        negativeFeedback: [],
      },
    };
    onChange([...pressures, newPressure]);
    setExpandedPressure(pressures.length);
  }, [pressures, onChange]);

  if (pressures.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Pressures</h1>
          <p style={styles.subtitle}>
            Configure environmental and social pressures that drive world evolution
          </p>
        </div>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🌡️</div>
          <div>No pressures defined yet</div>
          <button
            style={{
              ...styles.addButton,
              marginTop: '16px',
              width: 'auto',
              padding: '12px 24px',
              ...(addHovering ? styles.addButtonHover : {}),
            }}
            onClick={handleAddPressure}
            onMouseEnter={() => setAddHovering(true)}
            onMouseLeave={() => setAddHovering(false)}
          >
            + Add First Pressure
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Pressures</h1>
        <p style={styles.subtitle}>
          Configure environmental and social pressures that drive world evolution.
          Each pressure has feedback factors that make it grow or shrink based on world state.
        </p>
      </div>

      <div style={styles.pressureList}>
        {pressures.map((pressure, index) => (
          <PressureCard
            key={pressure.id}
            pressure={pressure}
            expanded={expandedPressure === index}
            onToggle={() => setExpandedPressure(expandedPressure === index ? null : index)}
            onChange={(updatedPressure) => handlePressureChange(index, updatedPressure)}
          />
        ))}

        <button
          style={{
            ...styles.addButton,
            ...(addHovering ? styles.addButtonHover : {}),
          }}
          onClick={handleAddPressure}
          onMouseEnter={() => setAddHovering(true)}
          onMouseLeave={() => setAddHovering(false)}
        >
          + Add Pressure
        </button>
      </div>
    </div>
  );
}
