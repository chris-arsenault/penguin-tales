/**
 * RuleEditor - Edit generation and simulation rules
 *
 * Supports both visual editing and JSON code mode.
 */

import React, { useState, useMemo } from 'react';
import { colors, typography, spacing, radius, components } from '../theme.js';
import ConditionEditor from './ConditionEditor.jsx';
import EntityTemplateEditor from './EntityTemplateEditor.jsx';
import RelationshipTemplateEditor from './RelationshipTemplateEditor.jsx';
import SelectionEditor from './SelectionEditor.jsx';

// Available dynamics modules for simulation rules
const DYNAMICS_MODULES = {
  contagion_spread: {
    name: 'Contagion Spread',
    description: 'Epidemic-style tag propagation through relationships',
    params: {
      contagionTag: { type: 'string', default: 'infected', description: 'Tag to spread' },
      transmissionRate: { type: 'number', default: 0.15, description: 'Base transmission chance' },
      recoveryRate: { type: 'number', default: 0.05, description: 'Chance to remove tag' },
      resistanceTag: { type: 'string', default: '', description: 'Tag that provides resistance' },
      resistanceBonus: { type: 'number', default: 0.3, description: 'Resistance reduction' },
    },
  },
  prominence_evolution: {
    name: 'Prominence Evolution',
    description: 'Rise and fall of entity prominence based on connectivity',
    params: {
      connectionThresholdBase: { type: 'number', default: 5, description: 'Connections needed for promotion' },
      promotionChance: { type: 'number', default: 0.25, description: 'Chance to promote' },
      demotionThreshold: { type: 'number', default: 2.0, description: 'Connection ratio for demotion' },
      demotionChance: { type: 'number', default: 0.5, description: 'Chance to demote' },
    },
  },
  relationship_decay: {
    name: 'Relationship Decay',
    description: 'Weaken relationships over time',
    params: {
      decayRate: { type: 'number', default: 0.02, description: 'Decay per tick' },
      decayFloor: { type: 'number', default: 0.1, description: 'Minimum distance before archiving' },
      gracePeriodTicks: { type: 'number', default: 10, description: 'Ticks before decay starts' },
    },
  },
};

const styles = {
  container: {
    maxWidth: '1000px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xxl,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: typography.sizeXxl,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.sizeMd,
    color: colors.textSecondary,
    lineHeight: '1.6',
  },
  headerActions: {
    display: 'flex',
    gap: spacing.sm,
  },
  addButton: {
    ...components.buttonPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modeToggle: {
    display: 'flex',
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    padding: '2px',
  },
  modeButton: {
    padding: `${spacing.xs} ${spacing.md}`,
    fontSize: typography.sizeSm,
    fontFamily: typography.fontFamily,
    border: 'none',
    borderRadius: radius.sm,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  modeButtonActive: {
    backgroundColor: colors.buttonPrimary,
    color: 'white',
  },
  modeButtonInactive: {
    backgroundColor: 'transparent',
    color: colors.textSecondary,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  },
  card: {
    ...components.card,
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottom: `1px solid ${colors.border}`,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardTitle: {
    fontSize: typography.sizeLg,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  cardId: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  cardMeta: {
    display: 'flex',
    gap: spacing.lg,
    fontSize: typography.sizeXs,
    color: colors.textSecondary,
  },
  cardActions: {
    display: 'flex',
    gap: spacing.sm,
    alignItems: 'center',
  },
  iconButton: {
    padding: spacing.xs,
    backgroundColor: 'transparent',
    border: 'none',
    color: colors.textMuted,
    cursor: 'pointer',
    fontSize: typography.sizeMd,
    borderRadius: radius.sm,
  },
  deleteButton: {
    color: colors.danger,
  },
  expandIcon: {
    fontSize: typography.sizeLg,
    color: colors.textMuted,
    transition: 'transform 0.2s',
  },
  cardBody: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizeMd,
    fontWeight: typography.weightSemibold,
    color: colors.textSecondary,
  },
  addSmallButton: {
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.sizeXs,
    backgroundColor: colors.bgTertiary,
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    cursor: 'pointer',
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizeXs,
    fontWeight: typography.weightMedium,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    display: 'block',
  },
  input: {
    ...components.input,
  },
  textarea: {
    ...components.input,
    minHeight: '60px',
    resize: 'vertical',
    fontFamily: typography.fontFamily,
  },
  codeEditor: {
    fontFamily: 'monospace',
    fontSize: typography.sizeSm,
    backgroundColor: colors.bgTertiary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: '300px',
    resize: 'vertical',
    color: colors.textPrimary,
    width: '100%',
    boxSizing: 'border-box',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing.md,
  },
  empty: {
    padding: spacing.xxxl,
    textAlign: 'center',
    color: colors.textMuted,
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    border: `2px dashed ${colors.border}`,
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: spacing.md,
  },
  badge: {
    display: 'inline-block',
    padding: `2px ${spacing.sm}`,
    fontSize: typography.sizeXs,
    backgroundColor: colors.bgTertiary,
    borderRadius: '10px',
    color: colors.textSecondary,
  },
  itemList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  itemCard: {
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    border: `1px solid ${colors.border}`,
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  codeError: {
    color: colors.danger,
    fontSize: typography.sizeSm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(255, 107, 122, 0.1)',
    borderRadius: radius.sm,
  },
  dynamicsSection: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
  },
  dynamicsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dynamicsLabel: {
    fontSize: typography.sizeXs,
    fontWeight: typography.weightSemibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  moduleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  moduleItem: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  moduleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  moduleName: {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    color: colors.textPrimary,
  },
  moduleDesc: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  moduleParams: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing.xs,
  },
  paramField: {
    display: 'flex',
    flexDirection: 'column',
  },
  paramLabel: {
    fontSize: '10px',
    color: colors.textMuted,
    marginBottom: '1px',
  },
  paramInput: {
    ...components.input,
    padding: '4px 8px',
    fontSize: typography.sizeXs,
  },
  moduleDeleteButton: {
    padding: '2px 6px',
    fontSize: typography.sizeXs,
    backgroundColor: 'transparent',
    color: colors.danger,
    border: 'none',
    cursor: 'pointer',
    borderRadius: radius.sm,
  },
  addModuleButton: {
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.sizeXs,
    backgroundColor: colors.bgTertiary,
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    cursor: 'pointer',
    marginTop: spacing.sm,
  },
  moduleSelect: {
    ...components.select,
    padding: '4px 8px',
    fontSize: typography.sizeXs,
  },
  hint: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
};

function generateId(name, prefix) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${prefix}_${slug || Date.now()}`;
}

function createNewRule(ruleType) {
  const id = `${ruleType}_rule_${Date.now()}`;
  const base = {
    id,
    name: `New ${ruleType === 'generation' ? 'Generation' : 'Simulation'} Rule`,
    description: '',
    conditions: [],
    connect: [],
    weight: 1,
    metadata: {
      produces: { entityKinds: [], relationships: [] },
      requires: { entityKinds: [], relationships: [] },
      tags: [],
    },
  };

  if (ruleType === 'generation') {
    return {
      ...base,
      create: [],
    };
  } else {
    return {
      ...base,
      select: [],
      modify: [],
      disconnect: [],
    };
  }
}

export default function RuleEditor({ rules, ruleType, schema, pressures, onChange }) {
  const [mode, setMode] = useState('visual'); // 'visual' or 'code'
  const [expandedId, setExpandedId] = useState(null);
  const [codeValue, setCodeValue] = useState('');
  const [codeError, setCodeError] = useState(null);

  const isGeneration = ruleType === 'generation';
  const title = isGeneration ? 'Generation Rules' : 'Simulation Rules';
  const description = isGeneration
    ? 'Generation rules fire during the growth phase to create new entities and relationships.'
    : 'Simulation rules fire during the simulation phase to select and modify existing entities.';

  // Sync code value when switching to code mode
  const handleModeChange = (newMode) => {
    if (newMode === 'code') {
      setCodeValue(JSON.stringify(rules, null, 2));
      setCodeError(null);
    }
    setMode(newMode);
  };

  // Handle code changes
  const handleCodeChange = (value) => {
    setCodeValue(value);
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        setCodeError('Rules must be an array');
        return;
      }
      setCodeError(null);
      onChange(parsed);
    } catch (e) {
      setCodeError(e.message);
    }
  };

  const handleAdd = () => {
    const newRule = createNewRule(ruleType);
    onChange([...rules, newRule]);
    setExpandedId(newRule.id);
  };

  const handleDelete = (id) => {
    onChange(rules.filter((r) => r.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleUpdate = (id, updates) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Extract entity kinds and relationship kinds from schema
  const entityKinds = useMemo(() => schema.entityKinds || [], [schema.entityKinds]);
  const relationshipKinds = useMemo(() => schema.relationshipKinds || [], [schema.relationshipKinds]);
  const cultures = useMemo(() => schema.cultures || [], [schema.cultures]);

  const renderVisualEditor = () => (
    <>
      {rules.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>{isGeneration ? '🌱' : '🔄'}</div>
          <div>No {isGeneration ? 'generation' : 'simulation'} rules defined yet.</div>
          <div style={{ marginTop: spacing.sm, fontSize: typography.sizeSm }}>
            {isGeneration
              ? 'Add rules to create entities during the growth phase.'
              : 'Add rules to modify and connect entities during simulation.'}
          </div>
        </div>
      ) : (
        <div style={styles.list}>
          {rules.map((rule) => (
            <div key={rule.id} style={styles.card}>
              <div
                style={styles.cardHeader}
                onClick={() => toggleExpand(rule.id)}
              >
                <div style={styles.cardHeaderLeft}>
                  <div style={styles.cardTitle}>{rule.name}</div>
                  <div style={styles.cardId}>{rule.id}</div>
                  <div style={styles.cardMeta}>
                    <span>{rule.conditions?.length || 0} conditions</span>
                    {isGeneration && <span>{rule.create?.length || 0} creates</span>}
                    {!isGeneration && <span>{rule.select?.length || 0} selections</span>}
                    <span>{rule.connect?.length || 0} connections</span>
                    <span style={styles.badge}>weight: {rule.weight || 1}</span>
                  </div>
                </div>
                <div style={styles.cardActions}>
                  <button
                    style={{ ...styles.iconButton, ...styles.deleteButton }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(rule.id);
                    }}
                    title="Delete rule"
                  >
                    🗑
                  </button>
                  <span
                    style={{
                      ...styles.expandIcon,
                      transform: expandedId === rule.id ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  >
                    ▼
                  </span>
                </div>
              </div>

              {expandedId === rule.id && (
                <div style={styles.cardBody}>
                  {/* Basic Info */}
                  <div style={styles.section}>
                    <div style={styles.row}>
                      <div style={styles.field}>
                        <label style={styles.label}>Name</label>
                        <input
                          type="text"
                          style={styles.input}
                          value={rule.name}
                          onChange={(e) => handleUpdate(rule.id, { name: e.target.value })}
                        />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Weight</label>
                        <input
                          type="number"
                          style={styles.input}
                          value={rule.weight || 1}
                          onChange={(e) =>
                            handleUpdate(rule.id, { weight: parseFloat(e.target.value) || 1 })
                          }
                          min={0}
                          step={0.1}
                        />
                      </div>
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Description</label>
                      <textarea
                        style={styles.textarea}
                        value={rule.description || ''}
                        onChange={(e) => handleUpdate(rule.id, { description: e.target.value })}
                        placeholder="Describe what this rule does..."
                      />
                    </div>
                  </div>

                  {/* Conditions */}
                  <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                      <span style={styles.sectionTitle}>Conditions</span>
                      <button
                        style={styles.addSmallButton}
                        onClick={() =>
                          handleUpdate(rule.id, {
                            conditions: [
                              ...rule.conditions,
                              { type: 'random_chance', params: { chance: 0.5 } },
                            ],
                          })
                        }
                      >
                        + Add Condition
                      </button>
                    </div>
                    <ConditionEditor
                      conditions={rule.conditions}
                      pressures={pressures}
                      entityKinds={entityKinds}
                      relationshipKinds={relationshipKinds}
                      onChange={(conditions) => handleUpdate(rule.id, { conditions })}
                    />
                  </div>

                  {/* Selections (simulation rules only) */}
                  {!isGeneration && (
                    <div style={styles.section}>
                      <div style={styles.sectionHeader}>
                        <span style={styles.sectionTitle}>Select</span>
                        <button
                          style={styles.addSmallButton}
                          onClick={() =>
                            handleUpdate(rule.id, {
                              select: [
                                ...(rule.select || []),
                                {
                                  ref: 'selected',
                                  query: { kind: entityKinds[0]?.id || 'npc' },
                                  count: 1,
                                  strategy: 'random',
                                },
                              ],
                            })
                          }
                        >
                          + Add Selection
                        </button>
                      </div>
                      <SelectionEditor
                        selections={rule.select || []}
                        entityKinds={entityKinds}
                        relationshipKinds={relationshipKinds}
                        cultures={cultures}
                        onChange={(select) => handleUpdate(rule.id, { select })}
                      />
                    </div>
                  )}

                  {/* Create (generation rules or optional for simulation) */}
                  {(isGeneration || rule.create?.length > 0) && (
                    <div style={styles.section}>
                      <div style={styles.sectionHeader}>
                        <span style={styles.sectionTitle}>Create Entities</span>
                        <button
                          style={styles.addSmallButton}
                          onClick={() =>
                            handleUpdate(rule.id, {
                              create: [
                                ...(rule.create || []),
                                {
                                  ref: 'newEntity',
                                  kind: entityKinds[0]?.id || 'npc',
                                  subtype: entityKinds[0]?.subtypes?.[0]?.id || '',
                                  count: 1,
                                  placement: { culture: 'random', coordinateStrategy: 'culture_aware' },
                                  status: 'active',
                                  prominence: 'marginal',
                                  tags: [],
                                  descriptionTemplate: '',
                                },
                              ],
                            })
                          }
                        >
                          + Add Entity
                        </button>
                      </div>
                      <EntityTemplateEditor
                        templates={rule.create || []}
                        entityKinds={entityKinds}
                        cultures={cultures}
                        onChange={(create) => handleUpdate(rule.id, { create })}
                      />
                    </div>
                  )}

                  {/* Connect */}
                  <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                      <span style={styles.sectionTitle}>Connect</span>
                      <button
                        style={styles.addSmallButton}
                        onClick={() =>
                          handleUpdate(rule.id, {
                            connect: [
                              ...(rule.connect || []),
                              {
                                kind: relationshipKinds[0]?.id || 'ally_of',
                                from: '',
                                to: '',
                              },
                            ],
                          })
                        }
                      >
                        + Add Relationship
                      </button>
                    </div>
                    <RelationshipTemplateEditor
                      templates={rule.connect}
                      relationshipKinds={relationshipKinds}
                      entityRefs={getEntityRefs(rule, isGeneration)}
                      onChange={(connect) => handleUpdate(rule.id, { connect })}
                    />
                  </div>

                  {/* Dynamics Modules (simulation rules only) */}
                  {!isGeneration && (
                    <div style={styles.dynamicsSection}>
                      <div style={styles.dynamicsHeader}>
                        <span style={styles.dynamicsLabel}>Dynamics Modules</span>
                      </div>
                      <div style={styles.hint}>
                        Dynamics modules apply global effects when this rule fires.
                      </div>
                      <div style={styles.moduleList}>
                        {(rule.dynamicsModules || []).map((mod, modIndex) => (
                          <DynamicsModuleEditor
                            key={modIndex}
                            module={mod}
                            onUpdate={(updates) => {
                              const newModules = [...(rule.dynamicsModules || [])];
                              newModules[modIndex] = { ...newModules[modIndex], ...updates };
                              handleUpdate(rule.id, { dynamicsModules: newModules });
                            }}
                            onDelete={() => {
                              const newModules = (rule.dynamicsModules || []).filter((_, i) => i !== modIndex);
                              handleUpdate(rule.id, { dynamicsModules: newModules });
                            }}
                          />
                        ))}
                      </div>
                      <AddDynamicsModuleButton
                        onAdd={(moduleId) => {
                          const moduleDef = DYNAMICS_MODULES[moduleId];
                          const defaultParams = {};
                          Object.entries(moduleDef.params).forEach(([key, def]) => {
                            defaultParams[key] = def.default;
                          });
                          const newModules = [...(rule.dynamicsModules || []), { moduleId, params: defaultParams }];
                          handleUpdate(rule.id, { dynamicsModules: newModules });
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderCodeEditor = () => (
    <div>
      <textarea
        style={styles.codeEditor}
        value={codeValue}
        onChange={(e) => handleCodeChange(e.target.value)}
        spellCheck={false}
      />
      {codeError && <div style={styles.codeError}>JSON Error: {codeError}</div>}
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <h2 style={styles.title}>{title}</h2>
          <p style={styles.description}>{description}</p>
        </div>
        <div style={styles.headerActions}>
          <div style={styles.modeToggle}>
            <button
              style={{
                ...styles.modeButton,
                ...(mode === 'visual' ? styles.modeButtonActive : styles.modeButtonInactive),
              }}
              onClick={() => handleModeChange('visual')}
            >
              Visual
            </button>
            <button
              style={{
                ...styles.modeButton,
                ...(mode === 'code' ? styles.modeButtonActive : styles.modeButtonInactive),
              }}
              onClick={() => handleModeChange('code')}
            >
              JSON
            </button>
          </div>
          {mode === 'visual' && (
            <button style={styles.addButton} onClick={handleAdd}>
              + Add Rule
            </button>
          )}
        </div>
      </div>

      {mode === 'visual' ? renderVisualEditor() : renderCodeEditor()}
    </div>
  );
}

// Helper to get available entity refs for relationship templates
function getEntityRefs(rule, isGeneration) {
  const refs = [];

  // From create templates
  if (rule.create) {
    rule.create.forEach((t) => {
      if (t.ref) refs.push(t.ref);
    });
  }

  // From select specs (simulation rules)
  if (rule.select) {
    rule.select.forEach((s) => {
      if (s.ref) refs.push(s.ref);
    });
  }

  return refs;
}

// Component to render a single dynamics module
function DynamicsModuleEditor({ module, onUpdate, onDelete }) {
  const moduleDef = DYNAMICS_MODULES[module.moduleId];
  if (!moduleDef) {
    return (
      <div style={styles.moduleItem}>
        <div style={styles.moduleHeader}>
          <span style={styles.moduleName}>Unknown: {module.moduleId}</span>
          <button style={styles.moduleDeleteButton} onClick={onDelete}>✕</button>
        </div>
      </div>
    );
  }

  const handleParamChange = (paramName, value) => {
    onUpdate({
      params: { ...module.params, [paramName]: value },
    });
  };

  return (
    <div style={styles.moduleItem}>
      <div style={styles.moduleHeader}>
        <span style={styles.moduleName}>{moduleDef.name}</span>
        <button style={styles.moduleDeleteButton} onClick={onDelete}>✕</button>
      </div>
      <div style={styles.moduleDesc}>{moduleDef.description}</div>
      <div style={styles.moduleParams}>
        {Object.entries(moduleDef.params).map(([paramName, paramDef]) => (
          <div key={paramName} style={styles.paramField}>
            <label style={styles.paramLabel} title={paramDef.description}>
              {paramName}
            </label>
            {paramDef.type === 'number' && (
              <input
                type="number"
                style={styles.paramInput}
                value={module.params?.[paramName] ?? paramDef.default}
                onChange={(e) => handleParamChange(paramName, parseFloat(e.target.value) || 0)}
                step="0.1"
              />
            )}
            {paramDef.type === 'string' && (
              <input
                type="text"
                style={styles.paramInput}
                value={module.params?.[paramName] ?? paramDef.default}
                onChange={(e) => handleParamChange(paramName, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Component to add a new dynamics module
function AddDynamicsModuleButton({ onAdd }) {
  const [showSelect, setShowSelect] = useState(false);

  if (!showSelect) {
    return (
      <button style={styles.addModuleButton} onClick={() => setShowSelect(true)}>
        + Add Dynamics Module
      </button>
    );
  }

  return (
    <div style={{ marginTop: spacing.sm, display: 'flex', alignItems: 'center' }}>
      <select
        style={styles.moduleSelect}
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) {
            onAdd(e.target.value);
            setShowSelect(false);
          }
        }}
      >
        <option value="">Select module...</option>
        {Object.entries(DYNAMICS_MODULES).map(([id, def]) => (
          <option key={id} value={id}>{def.name}</option>
        ))}
      </select>
      <button
        style={styles.moduleDeleteButton}
        onClick={() => setShowSelect(false)}
      >
        Cancel
      </button>
    </div>
  );
}
