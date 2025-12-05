/**
 * CreationTab - Visual entity creation cards
 */

import React, { useState, useMemo, useCallback } from 'react';
import TagSelector from '@lore-weave/shared-components/TagSelector';
import { ReferenceDropdown, LevelSelector, PROMINENCE_LEVELS } from '../../shared';

// ============================================================================
// findMatchingNamingProfile - Helper for naming profile matching
// ============================================================================

/**
 * Find which naming profile matches a creation entry's conditions
 */
function findMatchingNamingProfile(namingData, cultureId, entityKind, subtype, prominence, tags = {}) {
  if (!cultureId || !namingData) return null;

  const cultureConfig = namingData[cultureId];
  if (!cultureConfig?.profiles) return null;

  for (const profile of cultureConfig.profiles) {
    for (const group of (profile.strategyGroups || [])) {
      const cond = group.conditions || {};

      // Check entity kind
      if (cond.entityKinds?.length > 0 && !cond.entityKinds.includes(entityKind)) {
        continue;
      }

      // Check subtype
      if (cond.subtypes?.length > 0) {
        if (!subtype || !cond.subtypes.includes(subtype)) continue;
      }

      // Check prominence
      if (cond.prominence?.length > 0 && !cond.prominence.includes(prominence)) {
        continue;
      }

      // Check tags
      if (cond.tags?.length > 0) {
        const entityTags = Object.keys(tags || {});
        if (cond.tagMatchAll) {
          if (!cond.tags.every(t => entityTags.includes(t))) continue;
        } else {
          if (!cond.tags.some(t => entityTags.includes(t))) continue;
        }
      }

      // Found a match!
      return {
        profileId: profile.id,
        groupName: group.name,
      };
    }
  }

  // No conditional group matched - check for default (no conditions)
  for (const profile of cultureConfig.profiles) {
    for (const group of (profile.strategyGroups || [])) {
      if (!group.conditions || Object.keys(group.conditions).every(k => {
        const val = group.conditions[k];
        return !val || (Array.isArray(val) && val.length === 0);
      })) {
        return {
          profileId: profile.id,
          groupName: group.name || 'Default',
          isDefault: true,
        };
      }
    }
  }

  return null;
}

// ============================================================================
// CreationCard - Individual entity creation card
// ============================================================================

function CreationCard({ item, onChange, onRemove, schema, availableRefs, namingData = {}, cultureIds = [], generator, tagRegistry = [], onAddToRegistry }) {
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);

  /**
   * Get the entity kind that a variable reference selects.
   * CRITICAL: Semantic planes are per-entity-kind. near_entity placement
   * MUST reference an entity of the SAME KIND as the entity being created.
   */
  const getRefKind = useCallback((ref) => {
    if (!ref) return null;
    if (ref === '$target') {
      return generator?.selection?.kind || null;
    }
    const varConfig = generator?.variables?.[ref];
    if (varConfig?.select?.kind) {
      return varConfig.select.kind;
    }
    // Check if it's a creation ref from earlier in the list
    const creationItem = generator?.creation?.find(c => c.entityRef === ref);
    if (creationItem?.kind) {
      return creationItem.kind;
    }
    return null;
  }, [generator]);

  // Get refs that are the SAME KIND as this entity (for near_entity placement)
  // Excludes self-reference since an entity can't be placed near itself
  const sameKindRefs = useMemo(() => {
    if (!item.kind) return [];
    return availableRefs.filter(ref => {
      // Exclude self-reference
      if (ref === item.entityRef) return false;
      const refKind = getRefKind(ref);
      return refKind === item.kind;
    });
  }, [availableRefs, item.kind, item.entityRef, getRefKind]);

  // Determine which culture this creation would use
  const getCultureId = () => {
    if (!item.culture) return null;
    if (typeof item.culture === 'string') return item.culture;
    if (item.culture.fixed) return item.culture.fixed;
    // For inherit, we can't determine the exact culture at config time
    // Show all cultures as potential matches
    return null;
  };

  const cultureId = getCultureId();
  const subtype = typeof item.subtype === 'string' ? item.subtype : null;

  // Compute naming profile matches
  const profileMatches = useMemo(() => {
    const targetCultures = cultureId ? [cultureId] : cultureIds;
    const matches = [];

    for (const cid of targetCultures) {
      const match = findMatchingNamingProfile(
        namingData,
        cid,
        item.kind,
        subtype,
        item.prominence,
        item.tags
      );
      if (match) {
        matches.push({ cultureId: cid, ...match });
      }
    }

    return matches;
  }, [namingData, cultureId, cultureIds, item.kind, subtype, item.prominence, item.tags]);

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const getSubtypeOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const getStatusOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.statuses) return [];
    return ek.statuses.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const updateField = (field, value) => {
    onChange({ ...item, [field]: value });
  };

  const subtypeDisplay = typeof item.subtype === 'object' ? 'inherit' : item.subtype;

  return (
    <div className="item-card">
      <div
        className={`item-card-header ${hovering ? 'item-card-header-hover' : ''}`}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="item-card-icon item-card-icon-creation">✨</div>
        <div className="item-card-info">
          <div className="item-card-title">
            <span className="entity-ref">{item.entityRef}</span>
          </div>
          <div className="item-card-subtitle">
            {item.kind}{subtypeDisplay ? `:${subtypeDisplay}` : ''} • {item.prominence || 'no prominence'}
          </div>
          {/* Naming profile indicator */}
          {cultureIds.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              {profileMatches.length > 0 ? (
                <span className="badge badge-success">
                  <span>✓</span>
                  <span>
                    {profileMatches.length === 1
                      ? profileMatches[0].profileId
                      : `${profileMatches.length} profiles`}
                  </span>
                </span>
              ) : (
                <span className="badge badge-error">
                  <span>!</span>
                  <span>No naming profile</span>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="item-card-actions">
          <button className="btn-icon">{expanded ? '▲' : '▼'}</button>
          <button className="btn-icon btn-icon-danger" onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>
        </div>
      </div>

      {expanded && (
        <div className="item-card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="label">Entity Reference</label>
              <input
                type="text"
                value={item.entityRef || ''}
                onChange={(e) => updateField('entityRef', e.target.value)}
                className="input"
                placeholder="$hero"
              />
            </div>
            <ReferenceDropdown
              label="Kind"
              value={item.kind}
              onChange={(v) => {
                updateField('kind', v);
                if (typeof item.subtype !== 'object') updateField('subtype', undefined);
                updateField('status', undefined);
              }}
              options={entityKindOptions}
            />
            {item.kind && typeof item.subtype !== 'object' && (
              <ReferenceDropdown
                label="Subtype"
                value={item.subtype}
                onChange={(v) => updateField('subtype', v)}
                options={[{ value: '', label: 'Any' }, ...getSubtypeOptions(item.kind)]}
              />
            )}
            {item.kind && (
              <ReferenceDropdown
                label="Status"
                value={item.status}
                onChange={(v) => updateField('status', v)}
                options={[{ value: '', label: 'None' }, ...getStatusOptions(item.kind)]}
              />
            )}
          </div>

          <div className="form-group mt-lg">
            <label className="label">Prominence</label>
            <LevelSelector
              value={item.prominence}
              onChange={(v) => updateField('prominence', v)}
              levels={PROMINENCE_LEVELS}
            />
          </div>

          <div style={{ marginTop: '16px' }}>
            <label className="label">Culture</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <ReferenceDropdown
                value={item.culture?.inherit ? 'inherit' : item.culture?.fixed ? 'fixed' : 'none'}
                onChange={(v) => {
                  if (v === 'inherit') updateField('culture', { inherit: '$target' });
                  else if (v === 'fixed') updateField('culture', { fixed: '' });
                  else updateField('culture', undefined);
                }}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'inherit', label: 'Inherit from entity' },
                  { value: 'fixed', label: 'Fixed culture ID' },
                ]}
                style={{ flex: 1 }}
              />
              {item.culture?.inherit && (
                <ReferenceDropdown
                  value={item.culture.inherit}
                  onChange={(v) => updateField('culture', { inherit: v })}
                  options={availableRefs.map((r) => ({ value: r, label: r }))}
                  placeholder="Select entity..."
                  style={{ flex: 1 }}
                />
              )}
              {item.culture?.fixed !== undefined && (
                <input
                  type="text"
                  value={item.culture.fixed}
                  onChange={(e) => updateField('culture', { fixed: e.target.value })}
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="culture_id"
                />
              )}
            </div>
          </div>

          {/* PLACEMENT EDITOR */}
          <div style={{ marginTop: '16px' }}>
            <label className="label">Placement</label>
            <div className="info-box info-box-placement">
              <strong>Semantic Planes:</strong> Each entity kind has its own coordinate space.
              "Near entity" placement requires a reference of the <em>same kind</em> ({item.kind || 'select kind first'}).
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <ReferenceDropdown
                value={item.placement?.type || 'none'}
                onChange={(v) => {
                  if (v === 'none') updateField('placement', undefined);
                  else if (v === 'near_entity') updateField('placement', { type: 'near_entity', entity: '' });
                  else if (v === 'in_culture_region') updateField('placement', { type: 'in_culture_region', culture: '$target' });
                  else if (v === 'random_in_bounds') updateField('placement', { type: 'random_in_bounds' });
                }}
                options={[
                  { value: 'none', label: 'Default (random)' },
                  { value: 'near_entity', label: 'Near same-kind entity' },
                  { value: 'in_culture_region', label: 'In culture region' },
                  { value: 'random_in_bounds', label: 'Random in bounds' },
                ]}
                style={{ flex: 1 }}
              />
              {item.placement?.type === 'near_entity' && (
                <ReferenceDropdown
                  value={item.placement.entity}
                  onChange={(v) => updateField('placement', { ...item.placement, entity: v })}
                  options={sameKindRefs.length > 0
                    ? sameKindRefs.map((r) => ({ value: r, label: `${r} (${item.kind})` }))
                    : [{ value: '', label: `No ${item.kind} refs available` }]
                  }
                  placeholder={sameKindRefs.length > 0 ? 'Select same-kind entity...' : `Define a ${item.kind} variable first`}
                  style={{ flex: 1 }}
                />
              )}
              {item.placement?.type === 'in_culture_region' && (
                <ReferenceDropdown
                  value={item.placement.culture}
                  onChange={(v) => updateField('placement', { ...item.placement, culture: v })}
                  options={availableRefs.map((r) => ({ value: r, label: r }))}
                  placeholder="Select culture source..."
                  style={{ flex: 1 }}
                />
              )}
            </div>
            {item.placement?.type === 'near_entity' && sameKindRefs.length === 0 && (
              <div className="alert alert-error">
                No same-kind ({item.kind}) variables or targets available. Define a variable that selects {item.kind} entities,
                or use "In culture region" placement instead.
              </div>
            )}
          </div>

          {/* TAGS EDITOR */}
          <div style={{ marginTop: '16px' }}>
            <label className="label">Tags</label>
            <div className="form-help-text">
              Assign tags to this entity for filtering, naming profiles, and system targeting.
            </div>
            <TagSelector
              value={Object.keys(item.tags || {}).filter(k => item.tags[k])}
              onChange={(tagArray) => {
                // Convert array of tags to Record<string, boolean>
                const tagsObj = {};
                tagArray.forEach(t => { tagsObj[t] = true; });
                updateField('tags', tagsObj);
              }}
              tagRegistry={tagRegistry}
              onAddToRegistry={onAddToRegistry}
              placeholder="Select tags..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CreationTab - Main tab component
// ============================================================================

/**
 * @param {Object} props
 * @param {Object} props.generator - The generator being edited
 * @param {Function} props.onChange - Callback when generator changes
 * @param {Object} props.schema - Domain schema
 * @param {Object} props.namingData - Naming configuration data
 * @param {Array} props.tagRegistry - Available tags
 * @param {Function} props.onAddToRegistry - Callback to add new tag to registry
 */
export function CreationTab({ generator, onChange, schema, namingData = {}, tagRegistry = [], onAddToRegistry }) {
  const creation = generator.creation || [];

  const availableRefs = useMemo(() => {
    const refs = ['$target'];
    Object.keys(generator.variables || {}).forEach((v) => refs.push(v));
    creation.forEach((c) => { if (c.entityRef && !refs.includes(c.entityRef)) refs.push(c.entityRef); });
    return refs;
  }, [generator.variables, creation]);

  // Get all available culture IDs from naming data
  const cultureIds = useMemo(() => Object.keys(namingData), [namingData]);

  const handleAdd = () => {
    const nextNum = creation.length + 1;
    onChange({
      ...generator,
      creation: [...creation, { entityRef: `$entity${nextNum}`, kind: 'npc', prominence: 'marginal' }],
    });
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Entity Creation</div>
        <div className="section-desc">
          Define entities that this generator creates. Each entity gets a reference (like <code className="inline-code">$hero</code>)
          that can be used in relationships.
        </div>

        {creation.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✨</div>
            <div className="empty-state-title">No entities created</div>
            <div className="empty-state-desc">
              This generator only modifies existing entities. Add creation rules to spawn new entities.
            </div>
          </div>
        ) : (
          creation.map((item, index) => (
            <CreationCard
              key={index}
              item={item}
              onChange={(updated) => {
                const newCreation = [...creation];
                newCreation[index] = updated;
                onChange({ ...generator, creation: newCreation });
              }}
              onRemove={() => onChange({ ...generator, creation: creation.filter((_, i) => i !== index) })}
              schema={schema}
              availableRefs={availableRefs}
              namingData={namingData}
              cultureIds={cultureIds}
              generator={generator}
              tagRegistry={tagRegistry}
              onAddToRegistry={onAddToRegistry}
            />
          ))
        )}

        <button
          className="btn-add"
          onClick={handleAdd}
        >
          + Add Entity Creation
        </button>
      </div>
    </div>
  );
}

export default CreationTab;
