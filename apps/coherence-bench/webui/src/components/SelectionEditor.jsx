/**
 * SelectionEditor - Edit selection specs for simulation rules
 */

import React, { useState } from 'react';
import { colors, typography, spacing, radius, components } from '../theme.js';

// Available scoring modules with their parameters
const SCORING_MODULES = {
  hub_penalty: {
    name: 'Hub Penalty',
    description: 'Penalize entities with many relationships',
    params: {
      hubThreshold: { type: 'number', default: 5, description: 'Relationship count threshold' },
      penaltyBase: { type: 'number', default: 0.5, description: 'Penalty multiplier (0-1)' },
      relationshipKinds: { type: 'array', default: [], description: 'Specific relationship kinds to count' },
    },
  },
  culture_affinity: {
    name: 'Culture Affinity',
    description: 'Score based on cultural alignment',
    params: {
      sameCultureBoost: { type: 'number', default: 2.0, description: 'Boost for same culture' },
      differentCulturePenalty: { type: 'number', default: 0.5, description: 'Penalty for different culture' },
      mode: { type: 'select', options: ['prefer', 'avoid'], default: 'prefer', description: 'Prefer or avoid same culture' },
    },
  },
  proximity_decay: {
    name: 'Proximity Decay',
    description: 'Score based on semantic distance',
    params: {
      closeDistance: { type: 'number', default: 20, description: 'Distance considered close' },
      closeBoost: { type: 'number', default: 2.0, description: 'Boost for close entities' },
      farPenalty: { type: 'number', default: 0.5, description: 'Penalty for far entities' },
    },
  },
  tag_filter_score: {
    name: 'Tag Filter',
    description: 'Score based on entity tags',
    params: {
      preferTags: { type: 'array', default: [], description: 'Tags to prefer' },
      preferBoost: { type: 'number', default: 1.5, description: 'Boost per preferred tag' },
      forbiddenTags: { type: 'array', default: [], description: 'Tags that exclude entity' },
    },
  },
  faction_modifier: {
    name: 'Faction Modifier',
    description: 'Score based on faction relationships',
    params: {
      scenario: { type: 'select', options: ['cooperation', 'conflict'], default: 'cooperation', description: 'Cooperation or conflict scenario' },
      enemyFactionBoost: { type: 'number', default: 3.0, description: 'Boost for enemies (conflict)' },
      alliedFactionBoost: { type: 'number', default: 1.5, description: 'Boost for allies (cooperation)' },
    },
  },
  status_gate: {
    name: 'Status Gate',
    description: 'Filter by entity status',
    params: {
      allowedStatuses: { type: 'array', default: ['active'], description: 'Statuses that pass' },
      preferredStatuses: { type: 'array', default: [], description: 'Statuses that get boosted' },
      preferredBoost: { type: 'number', default: 1.5, description: 'Boost for preferred status' },
    },
  },
};

const styles = {
  empty: {
    padding: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: typography.sizeSm,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    border: `1px dashed ${colors.border}`,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  },
  item: {
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    border: `1px solid ${colors.border}`,
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  itemTitle: {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  deleteButton: {
    padding: '2px 6px',
    fontSize: typography.sizeXs,
    backgroundColor: 'transparent',
    color: colors.danger,
    border: 'none',
    cursor: 'pointer',
    borderRadius: radius.sm,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  row2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginBottom: '2px',
    textTransform: 'uppercase',
  },
  select: {
    ...components.select,
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.sizeSm,
  },
  input: {
    ...components.input,
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.sizeSm,
  },
  querySection: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    fontWeight: typography.weightSemibold,
  },
  scoringSection: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  hint: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginTop: '2px',
  },
  moduleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  moduleItem: {
    backgroundColor: colors.bgPrimary,
    borderRadius: radius.sm,
    padding: spacing.sm,
    border: `1px solid ${colors.border}`,
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
    padding: '2px 6px',
    fontSize: typography.sizeXs,
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
    padding: '2px 6px',
    fontSize: typography.sizeXs,
    marginRight: spacing.xs,
  },
};

export default function SelectionEditor({
  selections,
  entityKinds,
  relationshipKinds,
  cultures,
  onChange,
}) {
  const handleDelete = (index) => {
    onChange(selections.filter((_, i) => i !== index));
  };

  const handleUpdate = (index, updates) => {
    onChange(selections.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  };

  const handleQueryUpdate = (index, queryUpdates) => {
    const selection = selections[index];
    handleUpdate(index, {
      query: { ...selection.query, ...queryUpdates },
    });
  };

  const getSubtypes = (kindId) => {
    const kind = entityKinds.find((ek) => ek.id === kindId);
    return kind?.subtypes || [];
  };

  const getStatuses = (kindId) => {
    const kind = entityKinds.find((ek) => ek.id === kindId);
    return kind?.statuses || [];
  };

  if (!selections || selections.length === 0) {
    return <div style={styles.empty}>No selections - use create to add new entities</div>;
  }

  return (
    <div style={styles.list}>
      {selections.map((selection, index) => (
        <div key={index} style={styles.item}>
          <div style={styles.itemHeader}>
            <span style={styles.itemTitle}>{selection.ref || `selected_${index}`}</span>
            <button style={styles.deleteButton} onClick={() => handleDelete(index)}>
              ✕ Remove
            </button>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Ref Name</label>
              <input
                type="text"
                style={styles.input}
                value={selection.ref || ''}
                onChange={(e) => handleUpdate(index, { ref: e.target.value })}
                placeholder="e.g., target"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Count</label>
              <input
                type="number"
                style={styles.input}
                value={typeof selection.count === 'number' ? selection.count : 1}
                onChange={(e) => handleUpdate(index, { count: parseInt(e.target.value) || 1 })}
                min={1}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Strategy</label>
              <select
                style={styles.select}
                value={selection.strategy || 'random'}
                onChange={(e) => handleUpdate(index, { strategy: e.target.value })}
              >
                <option value="random">Random</option>
                <option value="scored">Scored</option>
              </select>
            </div>
          </div>

          <div style={styles.querySection}>
            <div style={styles.sectionLabel}>Query</div>
            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Kind</label>
                <select
                  style={styles.select}
                  value={selection.query?.kind || ''}
                  onChange={(e) => handleQueryUpdate(index, { kind: e.target.value })}
                >
                  <option value="">Any kind</option>
                  {entityKinds.map((ek) => (
                    <option key={ek.id} value={ek.id}>
                      {ek.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Subtype</label>
                <select
                  style={styles.select}
                  value={selection.query?.subtype || ''}
                  onChange={(e) =>
                    handleQueryUpdate(index, { subtype: e.target.value || undefined })
                  }
                >
                  <option value="">Any subtype</option>
                  {getSubtypes(selection.query?.kind).map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Status</label>
                <select
                  style={styles.select}
                  value={selection.query?.status || ''}
                  onChange={(e) =>
                    handleQueryUpdate(index, { status: e.target.value || undefined })
                  }
                >
                  <option value="">Any status</option>
                  {getStatuses(selection.query?.kind).map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={styles.row2}>
              <div style={styles.field}>
                <label style={styles.label}>Culture</label>
                <select
                  style={styles.select}
                  value={selection.query?.culture || ''}
                  onChange={(e) =>
                    handleQueryUpdate(index, { culture: e.target.value || undefined })
                  }
                >
                  <option value="">Any culture</option>
                  {cultures.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Has Tag</label>
                <input
                  type="text"
                  style={styles.input}
                  value={selection.query?.hasTag || ''}
                  onChange={(e) =>
                    handleQueryUpdate(index, { hasTag: e.target.value || undefined })
                  }
                  placeholder="Optional tag filter"
                />
              </div>
            </div>
          </div>

          {selection.strategy === 'scored' && (
            <div style={styles.scoringSection}>
              <div style={styles.sectionLabel}>Scoring Modules</div>
              <div style={styles.hint}>
                Modules are applied in order to calculate entity scores.
              </div>
              <div style={styles.moduleList}>
                {(selection.scoringModules || []).map((mod, modIndex) => (
                  <ScoringModuleEditor
                    key={modIndex}
                    module={mod}
                    onUpdate={(updates) => {
                      const newModules = [...(selection.scoringModules || [])];
                      newModules[modIndex] = { ...newModules[modIndex], ...updates };
                      handleUpdate(index, { scoringModules: newModules });
                    }}
                    onDelete={() => {
                      const newModules = (selection.scoringModules || []).filter((_, i) => i !== modIndex);
                      handleUpdate(index, { scoringModules: newModules });
                    }}
                  />
                ))}
              </div>
              <AddModuleButton
                onAdd={(moduleId) => {
                  const moduleDef = SCORING_MODULES[moduleId];
                  const defaultParams = {};
                  Object.entries(moduleDef.params).forEach(([key, def]) => {
                    defaultParams[key] = def.default;
                  });
                  const newModules = [...(selection.scoringModules || []), { moduleId, params: defaultParams }];
                  handleUpdate(index, { scoringModules: newModules });
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Component to render a single scoring module
function ScoringModuleEditor({ module, onUpdate, onDelete }) {
  const moduleDef = SCORING_MODULES[module.moduleId];
  if (!moduleDef) {
    return (
      <div style={styles.moduleItem}>
        <div style={styles.moduleHeader}>
          <span style={styles.moduleName}>Unknown: {module.moduleId}</span>
          <button style={styles.deleteButton} onClick={onDelete}>✕</button>
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
        <button style={styles.deleteButton} onClick={onDelete}>✕</button>
      </div>
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
            {paramDef.type === 'select' && (
              <select
                style={styles.moduleSelect}
                value={module.params?.[paramName] ?? paramDef.default}
                onChange={(e) => handleParamChange(paramName, e.target.value)}
              >
                {paramDef.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}
            {paramDef.type === 'array' && (
              <input
                type="text"
                style={styles.paramInput}
                value={(module.params?.[paramName] || []).join(', ')}
                onChange={(e) => handleParamChange(
                  paramName,
                  e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                )}
                placeholder="comma-separated"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Component to add a new module
function AddModuleButton({ onAdd }) {
  const [showSelect, setShowSelect] = useState(false);

  if (!showSelect) {
    return (
      <button style={styles.addModuleButton} onClick={() => setShowSelect(true)}>
        + Add Scoring Module
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
        {Object.entries(SCORING_MODULES).map(([id, def]) => (
          <option key={id} value={id}>{def.name}</option>
        ))}
      </select>
      <button
        style={styles.deleteButton}
        onClick={() => setShowSelect(false)}
      >
        Cancel
      </button>
    </div>
  );
}
