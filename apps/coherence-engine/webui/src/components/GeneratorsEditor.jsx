/**
 * GeneratorsEditor - UI for viewing and editing growth template (generator) configurations
 *
 * Generators (growth templates) define how entities are created during world generation.
 * Each generator has:
 * - Basic info (id, name)
 * - Applicability rules (when the template can run)
 * - Selection rules (how to pick a target entity)
 * - Creation rules (what entities to create)
 * - Relationships (what relationships to form)
 * - State updates (pressure changes, etc.)
 * - Contract (expected behavior documentation)
 */

import React, { useState, useCallback } from 'react';

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
    color: '#f0f0f0',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#808090',
  },
  generatorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  generatorCard: {
    backgroundColor: '#252535',
    borderRadius: '8px',
    border: '1px solid #3d3d4d',
    overflow: 'hidden',
  },
  generatorHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  generatorHeaderHover: {
    backgroundColor: '#2a2a3a',
  },
  generatorTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  generatorName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#f0f0f0',
  },
  generatorId: {
    fontSize: '12px',
    color: '#707080',
    backgroundColor: '#1a1a28',
    padding: '2px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
  },
  badges: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  badge: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: 500,
  },
  badgeEntity: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
  },
  badgeRelationship: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    color: '#c084fc',
  },
  badgePressure: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#fbbf24',
  },
  expandIcon: {
    fontSize: '18px',
    color: '#707080',
    transition: 'transform 0.2s',
  },
  expandIconOpen: {
    transform: 'rotate(180deg)',
  },
  generatorContent: {
    padding: '0 20px 20px',
    borderTop: '1px solid #3d3d4d',
  },
  section: {
    marginTop: '20px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#b0b0c0',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionIcon: {
    fontSize: '14px',
  },
  codeBlock: {
    backgroundColor: '#1a1a28',
    borderRadius: '6px',
    padding: '12px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#c0c0d0',
    overflow: 'auto',
    maxHeight: '300px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  infoCard: {
    backgroundColor: '#1e1e2e',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid #3d3d4d',
  },
  infoLabel: {
    fontSize: '11px',
    color: '#707080',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  infoValue: {
    fontSize: '14px',
    color: '#e0e0f0',
    fontWeight: 500,
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '4px',
  },
  tag: {
    fontSize: '12px',
    backgroundColor: '#2a2a3a',
    color: '#b0b0c0',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  creationItem: {
    backgroundColor: '#1e1e2e',
    borderRadius: '6px',
    padding: '12px',
    marginBottom: '8px',
    border: '1px solid #3d3d4d',
  },
  creationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  creationRef: {
    fontFamily: 'monospace',
    color: '#60a5fa',
    fontSize: '13px',
  },
  creationKind: {
    fontSize: '12px',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  relationshipItem: {
    backgroundColor: '#1e1e2e',
    borderRadius: '6px',
    padding: '10px 12px',
    marginBottom: '6px',
    border: '1px solid #3d3d4d',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
  },
  relationshipKind: {
    color: '#c084fc',
    fontWeight: 500,
  },
  relationshipArrow: {
    color: '#606070',
  },
  relationshipEntity: {
    fontFamily: 'monospace',
    color: '#60a5fa',
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
    border: '2px dashed #3d3d4d',
    borderRadius: '8px',
    color: '#707080',
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
    color: '#707080',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  inputGroup: {
    marginBottom: '16px',
  },
  inputRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    gap: '16px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: '#909090',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    backgroundColor: '#1e1e2e',
    border: '1px solid #3d3d4d',
    borderRadius: '6px',
    color: '#f0f0f0',
    boxSizing: 'border-box',
  },
};

// Extract summary info from a generator
function getGeneratorSummary(generator) {
  const summary = {
    creates: [],
    relationships: [],
    pressureEffects: [],
  };

  // What it creates
  if (generator.creation) {
    for (const item of generator.creation) {
      const label = item.subtype ? `${item.kind}:${item.subtype}` : item.kind;
      if (!summary.creates.includes(label)) {
        summary.creates.push(label);
      }
    }
  }

  // What relationships it forms
  if (generator.relationships) {
    for (const rel of generator.relationships) {
      if (!summary.relationships.includes(rel.kind)) {
        summary.relationships.push(rel.kind);
      }
    }
  }

  // What pressures it affects
  if (generator.stateUpdates) {
    for (const update of generator.stateUpdates) {
      if (update.type === 'modify_pressure') {
        const sign = update.delta >= 0 ? '+' : '';
        summary.pressureEffects.push(`${update.pressureId} ${sign}${update.delta}`);
      }
    }
  }

  return summary;
}

function GeneratorCard({ generator, expanded, onToggle, onChange }) {
  const [hovering, setHovering] = useState(false);
  const summary = getGeneratorSummary(generator);

  const handleFieldChange = useCallback((field, value) => {
    onChange({
      ...generator,
      [field]: value,
    });
  }, [generator, onChange]);

  return (
    <div style={styles.generatorCard}>
      <div
        style={{
          ...styles.generatorHeader,
          ...(hovering ? styles.generatorHeaderHover : {}),
        }}
        onClick={onToggle}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div>
          <div style={styles.generatorTitle}>
            <span style={styles.generatorName}>{generator.name || generator.id}</span>
            <span style={styles.generatorId}>{generator.id}</span>
          </div>
          <div style={{ ...styles.badges, marginTop: '8px' }}>
            {summary.creates.map(kind => (
              <span key={kind} style={{ ...styles.badge, ...styles.badgeEntity }}>
                + {kind}
              </span>
            ))}
            {summary.relationships.slice(0, 3).map(rel => (
              <span key={rel} style={{ ...styles.badge, ...styles.badgeRelationship }}>
                {rel}
              </span>
            ))}
            {summary.pressureEffects.map(effect => (
              <span key={effect} style={{ ...styles.badge, ...styles.badgePressure }}>
                {effect}
              </span>
            ))}
          </div>
        </div>
        <span style={{
          ...styles.expandIcon,
          ...(expanded ? styles.expandIconOpen : {}),
        }}>
          ▼
        </span>
      </div>

      {expanded && (
        <div style={styles.generatorContent}>
          {/* Basic Info */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>📝</span>
              Basic Information
            </div>
            <div style={styles.inputRow}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>ID</label>
                <input
                  type="text"
                  value={generator.id}
                  onChange={(e) => handleFieldChange('id', e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Name</label>
                <input
                  type="text"
                  value={generator.name || ''}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Selection Info */}
          {generator.selection && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>🎯</span>
                Target Selection
              </div>
              <div style={styles.infoGrid}>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Strategy</div>
                  <div style={styles.infoValue}>{generator.selection.strategy}</div>
                </div>
                {generator.selection.kind && (
                  <div style={styles.infoCard}>
                    <div style={styles.infoLabel}>Target Kind</div>
                    <div style={styles.infoValue}>{generator.selection.kind}</div>
                  </div>
                )}
                {generator.selection.subtypes && (
                  <div style={styles.infoCard}>
                    <div style={styles.infoLabel}>Subtypes</div>
                    <div style={styles.tagList}>
                      {generator.selection.subtypes.map(st => (
                        <span key={st} style={styles.tag}>{st}</span>
                      ))}
                    </div>
                  </div>
                )}
                {generator.selection.pickStrategy && (
                  <div style={styles.infoCard}>
                    <div style={styles.infoLabel}>Pick Strategy</div>
                    <div style={styles.infoValue}>{generator.selection.pickStrategy}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Creation Rules */}
          {generator.creation && generator.creation.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>✨</span>
                Entity Creation ({generator.creation.length})
              </div>
              {generator.creation.map((item, index) => (
                <div key={index} style={styles.creationItem}>
                  <div style={styles.creationHeader}>
                    <span style={styles.creationRef}>{item.entityRef}</span>
                    <span style={styles.creationKind}>
                      {item.subtype ? `${item.kind}:${item.subtype}` : item.kind}
                    </span>
                  </div>
                  <div style={styles.infoGrid}>
                    {item.status && (
                      <div style={styles.infoCard}>
                        <div style={styles.infoLabel}>Status</div>
                        <div style={styles.infoValue}>{item.status}</div>
                      </div>
                    )}
                    {item.prominence && (
                      <div style={styles.infoCard}>
                        <div style={styles.infoLabel}>Prominence</div>
                        <div style={styles.infoValue}>{item.prominence}</div>
                      </div>
                    )}
                    {item.culture && (
                      <div style={styles.infoCard}>
                        <div style={styles.infoLabel}>Culture</div>
                        <div style={styles.infoValue}>
                          {typeof item.culture === 'object'
                            ? `inherit from ${item.culture.inherit}`
                            : item.culture}
                        </div>
                      </div>
                    )}
                  </div>
                  {item.tags && Object.keys(item.tags).length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={styles.infoLabel}>Tags</div>
                      <div style={styles.tagList}>
                        {Object.entries(item.tags).filter(([_, v]) => v).map(([tag]) => (
                          <span key={tag} style={styles.tag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Relationships */}
          {generator.relationships && generator.relationships.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>🔗</span>
                Relationships ({generator.relationships.length})
              </div>
              {generator.relationships.map((rel, index) => (
                <div key={index} style={styles.relationshipItem}>
                  <span style={styles.relationshipEntity}>{rel.src}</span>
                  <span style={styles.relationshipArrow}>→</span>
                  <span style={styles.relationshipKind}>{rel.kind}</span>
                  <span style={styles.relationshipArrow}>→</span>
                  <span style={styles.relationshipEntity}>{rel.dst}</span>
                  {rel.strength && (
                    <span style={{ color: '#707080', marginLeft: 'auto' }}>
                      strength: {rel.strength}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* State Updates */}
          {generator.stateUpdates && generator.stateUpdates.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>⚡</span>
                State Updates ({generator.stateUpdates.length})
              </div>
              <div style={styles.infoGrid}>
                {generator.stateUpdates.map((update, index) => (
                  <div key={index} style={styles.infoCard}>
                    <div style={styles.infoLabel}>{update.type}</div>
                    <div style={styles.infoValue}>
                      {update.pressureId}: {update.delta >= 0 ? '+' : ''}{update.delta}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Applicability Rules (JSON view) */}
          {generator.applicability && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>✓</span>
                Applicability Rules
              </div>
              <div style={styles.codeBlock}>
                {JSON.stringify(generator.applicability, null, 2)}
              </div>
            </div>
          )}

          {/* Contract (JSON view) */}
          {generator.contract && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>📋</span>
                Contract
              </div>
              <div style={styles.codeBlock}>
                {JSON.stringify(generator.contract, null, 2)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GeneratorsEditor({ generators = [], onChange }) {
  const [expandedGenerator, setExpandedGenerator] = useState(null);
  const [addHovering, setAddHovering] = useState(false);

  const handleGeneratorChange = useCallback((index, updatedGenerator) => {
    const newGenerators = [...generators];
    newGenerators[index] = updatedGenerator;
    onChange(newGenerators);
  }, [generators, onChange]);

  const handleAddGenerator = useCallback(() => {
    const newGenerator = {
      id: `generator_${Date.now()}`,
      name: 'New Generator',
      applicability: [],
      selection: {
        strategy: 'by_kind',
        kind: 'location',
        pickStrategy: 'random',
      },
      creation: [],
      relationships: [],
      stateUpdates: [],
    };
    onChange([...generators, newGenerator]);
    setExpandedGenerator(generators.length);
  }, [generators, onChange]);

  if (generators.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Generators</h1>
          <p style={styles.subtitle}>
            Configure entity generators (growth templates) that populate the world
          </p>
        </div>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>⚙️</div>
          <div>No generators defined yet</div>
          <button
            style={{
              ...styles.addButton,
              marginTop: '16px',
              width: 'auto',
              padding: '12px 24px',
              ...(addHovering ? styles.addButtonHover : {}),
            }}
            onClick={handleAddGenerator}
            onMouseEnter={() => setAddHovering(true)}
            onMouseLeave={() => setAddHovering(false)}
          >
            + Add First Generator
          </button>
        </div>
      </div>
    );
  }

  // Group generators by what they create
  const grouped = generators.reduce((acc, gen) => {
    const firstCreate = gen.creation?.[0];
    const kind = firstCreate?.kind || 'other';
    if (!acc[kind]) acc[kind] = [];
    acc[kind].push(gen);
    return acc;
  }, {});

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Generators</h1>
        <p style={styles.subtitle}>
          Configure entity generators (growth templates) that populate the world.
          Each generator creates entities based on selection rules and applicability conditions.
        </p>
      </div>

      <div style={styles.generatorList}>
        {generators.map((generator, index) => (
          <GeneratorCard
            key={generator.id}
            generator={generator}
            expanded={expandedGenerator === index}
            onToggle={() => setExpandedGenerator(expandedGenerator === index ? null : index)}
            onChange={(updated) => handleGeneratorChange(index, updated)}
          />
        ))}

        <button
          style={{
            ...styles.addButton,
            ...(addHovering ? styles.addButtonHover : {}),
          }}
          onClick={handleAddGenerator}
          onMouseEnter={() => setAddHovering(true)}
          onMouseLeave={() => setAddHovering(false)}
        >
          + Add Generator
        </button>
      </div>
    </div>
  );
}
