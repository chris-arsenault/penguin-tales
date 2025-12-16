/**
 * VariablesTab - Define intermediate entity selections
 */

import React, { useState } from 'react';
import { VARIABLE_PICK_STRATEGIES } from '../constants';
import { ReferenceDropdown, ChipSelect, PROMINENCE_LEVELS } from '../../shared';
import { SelectionFiltersEditor } from '../filters';

/**
 * Safely display a value that should be a string.
 * If it's an object, log a warning and return a fallback.
 */
function safeDisplay(value, fallback = '?', label = 'value') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') {
    console.warn(`[VariablesTab] Expected string for ${label} but got object:`, value);
    return `[object]`;
  }
  return String(value);
}

// ============================================================================
// VariableCard - Individual variable editor card
// ============================================================================

function VariableCard({ name, config, onChange, onRemove, schema, availableRefs = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);

  // Handle the nested select structure: { select: { from, kind, pickStrategy, ... }, required }
  const selectConfig = config.select || config;
  const isRequired = config.required || false;

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const getSubtypeOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const updateSelect = (field, value) => {
    const newSelect = { ...selectConfig, [field]: value };
    onChange({ ...config, select: newSelect });
  };

  const updateSelectMultiple = (updates) => {
    const newSelect = { ...selectConfig, ...updates };
    onChange({ ...config, select: newSelect });
  };

  const updateRequired = (value) => {
    onChange({ ...config, required: value });
  };

  // Determine mode: 'graph' (select by kind) or 'related' (select related entities)
  // In lore-weave, from can be 'graph' or { relatedTo, relationship, direction }
  const isRelatedMode = selectConfig.from && typeof selectConfig.from === 'object';
  const fromSpec = isRelatedMode ? selectConfig.from : null;

  const setMode = (mode) => {
    if (mode === 'graph') {
      // Clear related entity config, keep kind-based selection
      const { from, ...rest } = selectConfig;
      onChange({ ...config, select: { ...rest, from: 'graph' } });
    } else {
      // Switch to related entity mode
      onChange({
        ...config,
        select: {
          ...selectConfig,
          from: { relatedTo: '$target', relationship: '', direction: 'both' },
        },
      });
    }
  };

  const updateFrom = (field, value) => {
    const newFrom = { ...(fromSpec || { relatedTo: '$target', relationship: '', direction: 'both' }), [field]: value };
    updateSelect('from', newFrom);
  };

  // Display info
  const displayMode = isRelatedMode ? 'Related entities' : (selectConfig.kind || 'Not configured');
  const displayStrategy = safeDisplay(selectConfig.pickStrategy, 'Not set', 'pickStrategy');
  const filterCount = (selectConfig.filters || []).length;

  return (
    <div className="item-card">
      <div
        className={`item-card-header ${hovering ? 'item-card-header-hover' : ''}`}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="item-card-icon item-card-icon-variable">📦</div>
        <div className="item-card-info">
          <div className="item-card-title">
            <span className="variable-ref">{name}</span>
            {isRequired && <span className="badge badge-warning" style={{ marginLeft: '8px', fontSize: '10px' }}>Required</span>}
          </div>
          <div className="item-card-subtitle">
            {displayMode} • {displayStrategy}
            {filterCount > 0 && <span style={{ marginLeft: '4px' }}>• {filterCount} filter{filterCount > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <div className="item-card-actions">
          <button className="btn-icon">{expanded ? '▲' : '▼'}</button>
          <button className="btn-icon btn-icon-danger" onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>
        </div>
      </div>

      {expanded && (
        <div className="item-card-body">
          {/* Required checkbox */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => updateRequired(e.target.checked)}
              />
              <span className="label" style={{ margin: 0 }}>Required</span>
              <span className="text-muted" style={{ fontSize: '11px' }}>
                (Template won't run unless this variable resolves)
              </span>
            </label>
          </div>

          <div className="form-grid">
            <ReferenceDropdown
              label="Select From"
              value={isRelatedMode ? 'related' : 'graph'}
              onChange={(v) => setMode(v)}
              options={[
                { value: 'graph', label: 'Graph (by entity kind)' },
                { value: 'related', label: 'Related Entities' },
              ]}
            />

            {!isRelatedMode && (
              <ReferenceDropdown
                label="Entity Kind"
                value={selectConfig.kind}
                onChange={(v) => updateSelectMultiple({ kind: v, subtypes: undefined })}
                options={entityKindOptions}
                placeholder="Select kind..."
              />
            )}

            {isRelatedMode && (
              <>
                <ReferenceDropdown
                  label="Related To"
                  value={fromSpec?.relatedTo || '$target'}
                  onChange={(v) => updateFrom('relatedTo', v)}
                  options={availableRefs.map((r) => ({ value: r, label: r }))}
                  placeholder="Select entity..."
                />
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={fromSpec?.relationship || ''}
                  onChange={(v) => updateFrom('relationship', v)}
                  options={relationshipKindOptions}
                  placeholder="Select relationship..."
                />
                <ReferenceDropdown
                  label="Direction"
                  value={fromSpec?.direction || 'both'}
                  onChange={(v) => updateFrom('direction', v)}
                  options={[
                    { value: 'both', label: 'Any direction' },
                    { value: 'src', label: 'As source (outgoing)' },
                    { value: 'dst', label: 'As target (incoming)' },
                  ]}
                />
              </>
            )}

            <ReferenceDropdown
              label="Pick Strategy"
              value={selectConfig.pickStrategy || ''}
              onChange={(v) => updateSelect('pickStrategy', v)}
              options={VARIABLE_PICK_STRATEGIES}
              placeholder="Select..."
            />
          </div>

          {/* Entity kind filter - applies in both modes */}
          {isRelatedMode && (
            <div style={{ marginTop: '16px' }}>
              <ReferenceDropdown
                label="Filter by Entity Kind (optional)"
                value={selectConfig.kind || ''}
                onChange={(v) => updateSelectMultiple({ kind: v || undefined, subtypes: undefined })}
                options={entityKindOptions}
                placeholder="Any kind"
              />
            </div>
          )}

          {/* Subtype filter */}
          {selectConfig.kind && (
            <div style={{ marginTop: '16px' }}>
              <ChipSelect
                label="Subtypes (optional)"
                value={selectConfig.subtypes || []}
                onChange={(v) => updateSelect('subtypes', v.length > 0 ? v : undefined)}
                options={getSubtypeOptions(selectConfig.kind)}
                placeholder="Any subtype"
              />
            </div>
          )}

          {/* Status filter */}
          <div style={{ marginTop: '16px' }}>
            <label className="label">Status Filter (optional)</label>
            <input
              type="text"
              value={selectConfig.statusFilter || ''}
              onChange={(e) => updateSelect('statusFilter', e.target.value || undefined)}
              className="input"
              placeholder="e.g., active, historical"
            />
          </div>

          {/* Selection Filters - same as target selection */}
          <div style={{ marginTop: '24px' }}>
            <label className="label">Selection Filters</label>
            <div className="info-box-text" style={{ marginBottom: '12px', fontSize: '12px' }}>
              Optional filters to narrow down which entities can be selected. All filters must pass.
            </div>
            <SelectionFiltersEditor
              filters={selectConfig.filters}
              onChange={(filters) => updateSelect('filters', filters.length > 0 ? filters : undefined)}
              schema={schema}
              availableRefs={availableRefs}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VariablesTab - Main tab component
// ============================================================================

/**
 * @param {Object} props
 * @param {Object} props.generator - The generator being edited
 * @param {Function} props.onChange - Callback when generator changes
 * @param {Object} props.schema - Domain schema
 */
export function VariablesTab({ generator, onChange, schema }) {
  const variables = generator.variables || {};
  const [newVarName, setNewVarName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Build available refs for relationship queries (target + other vars + creation refs)
  const buildAvailableRefs = (excludeVar) => {
    const refs = ['$target'];
    Object.keys(variables).forEach((v) => {
      if (v !== excludeVar) refs.push(v);
    });
    (generator.creation || []).forEach((c) => {
      if (c.entityRef && !refs.includes(c.entityRef)) refs.push(c.entityRef);
    });
    return refs;
  };

  const handleAddVariable = () => {
    if (!newVarName.trim()) return;
    // Ensure the name starts with $
    const name = newVarName.startsWith('$') ? newVarName : `$${newVarName}`;
    // Create with empty required fields - validation will flag them
    onChange({
      ...generator,
      variables: {
        ...variables,
        [name]: { select: { from: 'graph', kind: '', pickStrategy: '' } },
      },
    });
    setNewVarName('');
    setShowAddForm(false);
  };

  const varEntries = Object.entries(variables);

  return (
    <div>
      <div className="section">
        <div className="section-title">Variables</div>

        <div className="info-box">
          <div className="info-box-title">What are variables?</div>
          <div className="info-box-text">
            Variables let you select additional entities from the graph to use in creation and relationships.
            For example, you might select a <code className="inline-code">$faction</code> to make a new NPC a member of,
            or an <code className="inline-code">$ability</code> for them to practice.
            Variables are selected after <code className="inline-code">$target</code> is chosen.
          </div>
        </div>

        {varEntries.length === 0 && !showAddForm ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-title">No variables defined</div>
            <div className="empty-state-desc">
              Add variables to select additional entities for use in creation and relationships.
            </div>
          </div>
        ) : (
          varEntries.map(([name, config]) => (
            <VariableCard
              key={name}
              name={name}
              config={config}
              onChange={(updated) => onChange({ ...generator, variables: { ...variables, [name]: updated } })}
              onRemove={() => {
                const newVars = { ...variables };
                delete newVars[name];
                onChange({ ...generator, variables: newVars });
              }}
              schema={schema}
              availableRefs={buildAvailableRefs(name)}
            />
          ))
        )}

        {showAddForm ? (
          <div className="item-card add-form">
            <div className="add-form-fields">
              <div style={{ flex: 1 }}>
                <label className="label">Variable Name</label>
                <input
                  type="text"
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value.replace(/[^a-zA-Z0-9_$]/g, ''))}
                  className="input"
                  placeholder="$myVariable"
                  autoFocus
                />
              </div>
              <button className="btn btn-primary" onClick={handleAddVariable} disabled={!newVarName.trim()}>
                Add
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowAddForm(false); setNewVarName(''); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn-add"
            onClick={() => setShowAddForm(true)}
          >
            + Add Variable
          </button>
        )}
      </div>
    </div>
  );
}

export default VariablesTab;
