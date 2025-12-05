/**
 * VariablesTab - Define intermediate entity selections
 */

import React, { useState } from 'react';
import { PICK_STRATEGIES } from '../constants';
import { ReferenceDropdown, ChipSelect } from '../../shared';

// ============================================================================
// VariableCard - Individual variable editor card
// ============================================================================

function VariableCard({ name, config, onChange, onRemove, schema }) {
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);

  // Handle the nested select structure: { select: { from, strategy, kind, pickStrategy } }
  const selectConfig = config.select || config;

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
    onChange({ select: newSelect });
  };

  const updateSelectMultiple = (updates) => {
    const newSelect = { ...selectConfig, ...updates };
    onChange({ select: newSelect });
  };

  const displayKind = selectConfig.relationshipKind || selectConfig.kind || 'Not configured';
  const displayStrategy = selectConfig.pickStrategy || 'random';

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
          </div>
          <div className="item-card-subtitle">
            {displayKind} • {displayStrategy}
          </div>
        </div>
        <div className="item-card-actions">
          <button className="btn-icon">{expanded ? '▲' : '▼'}</button>
          <button className="btn-icon btn-icon-danger" onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>
        </div>
      </div>

      {expanded && (
        <div className="item-card-body">
          <div className="form-grid">
            <ReferenceDropdown
              label="Select From"
              value={selectConfig.from || 'graph'}
              onChange={(v) => updateSelect('from', v)}
              options={[
                { value: 'graph', label: 'Graph (existing entities)' },
              ]}
            />
            <ReferenceDropdown
              label="Strategy"
              value={selectConfig.strategy || 'by_kind'}
              onChange={(v) => updateSelect('strategy', v)}
              options={[
                { value: 'by_kind', label: 'By Entity Kind' },
                { value: 'by_relationship', label: 'By Relationship' },
              ]}
            />
            {selectConfig.strategy !== 'by_relationship' && (
              <ReferenceDropdown
                label="Entity Kind"
                value={selectConfig.kind}
                onChange={(v) => updateSelectMultiple({ kind: v, subtypes: undefined })}
                options={entityKindOptions}
                placeholder="Select kind..."
              />
            )}
            {selectConfig.strategy === 'by_relationship' && (
              <>
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={selectConfig.relationshipKind}
                  onChange={(v) => updateSelect('relationshipKind', v)}
                  options={relationshipKindOptions}
                  placeholder="Select relationship..."
                />
                <ReferenceDropdown
                  label="Direction"
                  value={selectConfig.direction || 'any'}
                  onChange={(v) => updateSelect('direction', v)}
                  options={[
                    { value: 'any', label: 'Any direction' },
                    { value: 'outgoing', label: 'Outgoing (source)' },
                    { value: 'incoming', label: 'Incoming (target)' },
                  ]}
                />
              </>
            )}
            <ReferenceDropdown
              label="Pick Strategy"
              value={selectConfig.pickStrategy || 'random'}
              onChange={(v) => updateSelect('pickStrategy', v)}
              options={PICK_STRATEGIES}
            />
          </div>
          {selectConfig.strategy !== 'by_relationship' && selectConfig.kind && (
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

  const handleAddVariable = () => {
    if (!newVarName.trim()) return;
    // Ensure the name starts with $
    const name = newVarName.startsWith('$') ? newVarName : `$${newVarName}`;
    onChange({
      ...generator,
      variables: {
        ...variables,
        [name]: { select: { from: 'graph', strategy: 'by_kind', kind: 'npc', pickStrategy: 'random' } },
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
