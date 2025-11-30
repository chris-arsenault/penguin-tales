/**
 * ErasEditor - UI for editing era configurations
 *
 * Allows editing:
 * - Era metadata (id, name, description)
 * - Template weights (which templates are active and how strongly)
 * - System modifiers (how systems behave during this era)
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
  eraList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  eraCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    overflow: 'hidden',
  },
  eraHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  eraHeaderHover: {
    backgroundColor: '#2d4a6f',
  },
  eraTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  eraName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
  },
  eraId: {
    fontSize: '12px',
    color: '#60a5fa',
    backgroundColor: '#0c1f2e',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  eraDescription: {
    fontSize: '13px',
    color: '#93c5fd',
    marginTop: '4px',
  },
  expandIcon: {
    fontSize: '18px',
    color: '#60a5fa',
    transition: 'transform 0.2s',
  },
  expandIconOpen: {
    transform: 'rotate(180deg)',
  },
  eraContent: {
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
  weightsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '8px',
  },
  weightRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: '#0a1929',
    borderRadius: '6px',
    gap: '12px',
  },
  weightLabel: {
    fontSize: '13px',
    color: '#93c5fd',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  weightValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  weightInput: {
    width: '60px',
    padding: '4px 8px',
    fontSize: '13px',
    backgroundColor: '#2d4a6f',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '4px',
    color: '#ffffff',
    textAlign: 'right',
  },
  weightBar: {
    width: '60px',
    height: '6px',
    backgroundColor: '#0c1f2e',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  weightBarFill: {
    height: '100%',
    background: ACCENT_GRADIENT,
    borderRadius: '3px',
    transition: 'width 0.2s',
  },
  inputGroup: {
    marginBottom: '16px',
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
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    backgroundColor: '#0a1929',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    color: '#ffffff',
    resize: 'vertical',
    minHeight: '60px',
    fontFamily: 'inherit',
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
};

// Weight bar max value for visualization
const MAX_WEIGHT = 4.0;

function WeightEditor({ label, value, onChange }) {
  const barWidth = Math.min((value / MAX_WEIGHT) * 100, 100);

  return (
    <div style={styles.weightRow}>
      <span style={styles.weightLabel} title={label}>
        {label.replace(/_/g, ' ')}
      </span>
      <div style={styles.weightValue}>
        <div style={styles.weightBar}>
          <div
            style={{
              ...styles.weightBarFill,
              width: `${barWidth}%`,
              opacity: value === 0 ? 0.3 : 1,
            }}
          />
        </div>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={styles.weightInput}
          step="0.1"
          min="0"
          max="10"
        />
      </div>
    </div>
  );
}

function EraCard({ era, expanded, onToggle, onChange }) {
  const [hovering, setHovering] = useState(false);

  const handleWeightChange = useCallback((key, value) => {
    onChange({
      ...era,
      templateWeights: {
        ...era.templateWeights,
        [key]: value,
      },
    });
  }, [era, onChange]);

  const handleModifierChange = useCallback((key, value) => {
    onChange({
      ...era,
      systemModifiers: {
        ...era.systemModifiers,
        [key]: value,
      },
    });
  }, [era, onChange]);

  const handleFieldChange = useCallback((field, value) => {
    onChange({
      ...era,
      [field]: value,
    });
  }, [era, onChange]);

  const templateWeights = Object.entries(era.templateWeights || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const systemModifiers = Object.entries(era.systemModifiers || {}).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div style={styles.eraCard}>
      <div
        style={{
          ...styles.eraHeader,
          ...(hovering ? styles.eraHeaderHover : {}),
        }}
        onClick={onToggle}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div>
          <div style={styles.eraTitle}>
            <span style={styles.eraName}>{era.name}</span>
            <span style={styles.eraId}>{era.id}</span>
          </div>
          <div style={styles.eraDescription}>{era.description}</div>
        </div>
        <span style={{
          ...styles.expandIcon,
          ...(expanded ? styles.expandIconOpen : {}),
        }}>
          ▼
        </span>
      </div>

      {expanded && (
        <div style={styles.eraContent}>
          {/* Basic Info */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>📝</span>
              Basic Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>ID</label>
                <input
                  type="text"
                  value={era.id}
                  onChange={(e) => handleFieldChange('id', e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Name</label>
                <input
                  type="text"
                  value={era.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                value={era.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                style={styles.textarea}
              />
            </div>
          </div>

          {/* Template Weights */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>⚖️</span>
              Template Weights ({templateWeights.length})
            </div>
            <div style={styles.weightsGrid}>
              {templateWeights.map(([key, value]) => (
                <WeightEditor
                  key={key}
                  label={key}
                  value={value}
                  onChange={(newValue) => handleWeightChange(key, newValue)}
                />
              ))}
            </div>
          </div>

          {/* System Modifiers */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>⚙️</span>
              System Modifiers ({systemModifiers.length})
            </div>
            <div style={styles.weightsGrid}>
              {systemModifiers.map(([key, value]) => (
                <WeightEditor
                  key={key}
                  label={key}
                  value={value}
                  onChange={(newValue) => handleModifierChange(key, newValue)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ErasEditor({ eras = [], onChange }) {
  const [expandedEra, setExpandedEra] = useState(null);
  const [addHovering, setAddHovering] = useState(false);

  const handleEraChange = useCallback((index, updatedEra) => {
    const newEras = [...eras];
    newEras[index] = updatedEra;
    onChange(newEras);
  }, [eras, onChange]);

  const handleAddEra = useCallback(() => {
    const newEra = {
      id: `era_${Date.now()}`,
      name: 'New Era',
      description: 'A new era in world history',
      templateWeights: {},
      systemModifiers: {},
    };
    onChange([...eras, newEra]);
    setExpandedEra(eras.length);
  }, [eras, onChange]);

  if (eras.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Eras</h1>
          <p style={styles.subtitle}>
            Define historical eras that structure world generation
          </p>
        </div>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🕰️</div>
          <div>No eras defined yet</div>
          <button
            style={{
              ...styles.addButton,
              marginTop: '16px',
              width: 'auto',
              padding: '12px 24px',
              ...(addHovering ? styles.addButtonHover : {}),
            }}
            onClick={handleAddEra}
            onMouseEnter={() => setAddHovering(true)}
            onMouseLeave={() => setAddHovering(false)}
          >
            + Add First Era
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Eras</h1>
        <p style={styles.subtitle}>
          Define historical eras that structure world generation. Each era has template weights
          (controlling entity creation rates) and system modifiers (affecting simulation behavior).
        </p>
      </div>

      <div style={styles.eraList}>
        {eras.map((era, index) => (
          <EraCard
            key={era.id}
            era={era}
            expanded={expandedEra === index}
            onToggle={() => setExpandedEra(expandedEra === index ? null : index)}
            onChange={(updatedEra) => handleEraChange(index, updatedEra)}
          />
        ))}

        <button
          style={{
            ...styles.addButton,
            ...(addHovering ? styles.addButtonHover : {}),
          }}
          onClick={handleAddEra}
          onMouseEnter={() => setAddHovering(true)}
          onMouseLeave={() => setAddHovering(false)}
        >
          + Add Era
        </button>
      </div>
    </div>
  );
}
