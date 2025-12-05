/**
 * EntityKindEditor - Edit entity kinds (id, name, subtypes, statuses)
 *
 * This is the authoritative place to define entity kinds.
 * Semantic planes are edited in Cosmographer.
 */

import React, { useState, useMemo } from 'react';
import { ExpandableCard, FormGroup, FormRow, SectionHeader, EmptyState, AddItemButton } from '@penguin-tales/shared-components';
import { ToolUsageBadges as UsageBadges, getEntityKindUsageSummary } from '@penguin-tales/shared-components';

/**
 * Compute naming profile usage for each entity kind
 */
function computeNamingProfileUsage(namingData) {
  const usage = {};

  Object.entries(namingData || {}).forEach(([cultureId, cultureConfig]) => {
    const profiles = cultureConfig?.profiles || [];

    profiles.forEach((profile) => {
      const groups = profile.strategyGroups || [];

      groups.forEach((group) => {
        const cond = group.conditions || {};
        const entityKinds = cond.entityKinds || [];

        if (entityKinds.length === 0) {
          if (!usage['*']) usage['*'] = { profiles: [] };
          usage['*'].profiles.push({
            cultureId,
            profileId: profile.id,
            groupName: group.name || 'Default',
          });
        } else {
          entityKinds.forEach((kind) => {
            if (!usage[kind]) usage[kind] = { profiles: [] };
            usage[kind].profiles.push({
              cultureId,
              profileId: profile.id,
              groupName: group.name,
            });
          });
        }
      });
    });
  });

  return usage;
}

function generateId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export default function EntityKindEditor({ entityKinds, onChange, schemaUsage = {}, namingData = {} }) {
  const [expandedKinds, setExpandedKinds] = useState({});
  const [newSubtype, setNewSubtype] = useState({});
  const [newStatus, setNewStatus] = useState({});

  const namingProfileUsage = useMemo(
    () => computeNamingProfileUsage(namingData),
    [namingData]
  );

  const getNamingProfileCount = (kind) => {
    const specific = namingProfileUsage[kind]?.profiles?.length || 0;
    const wildcard = namingProfileUsage['*']?.profiles?.length || 0;
    return specific + wildcard;
  };

  const getStableKey = (ek) => ek._key || ek.kind;

  const toggleKind = (stableKey) => {
    setExpandedKinds((prev) => ({ ...prev, [stableKey]: !prev[stableKey] }));
  };

  const addEntityKind = () => {
    const stableKey = `kind_${Date.now()}`;
    const newKind = {
      kind: stableKey,
      description: 'New Entity Kind',
      subtypes: [],
      statuses: [{ id: 'active', name: 'Active', isTerminal: false }],
      defaultStatus: 'active',
      _key: stableKey,
    };
    onChange([...entityKinds, newKind]);
    setExpandedKinds((prev) => ({ ...prev, [stableKey]: true }));
  };

  const updateKind = (kindKey, updates) => {
    onChange(entityKinds.map((k) => (k.kind === kindKey ? { ...k, ...updates } : k)));
  };

  const deleteKind = (kindKey) => {
    if (confirm('Delete this entity kind? This cannot be undone.')) {
      onChange(entityKinds.filter((k) => k.kind !== kindKey));
    }
  };

  const addSubtype = (kindKey) => {
    const name = newSubtype[kindKey]?.trim();
    if (!name) return;
    const ek = entityKinds.find((k) => k.kind === kindKey);
    if (!ek) return;
    const subtype = { id: generateId(name), name };
    updateKind(kindKey, { subtypes: [...ek.subtypes, subtype] });
    setNewSubtype((prev) => ({ ...prev, [kindKey]: '' }));
  };

  const removeSubtype = (kindKey, subtypeId) => {
    const ek = entityKinds.find((k) => k.kind === kindKey);
    if (!ek) return;
    updateKind(kindKey, { subtypes: ek.subtypes.filter((s) => s.id !== subtypeId) });
  };

  const addStatus = (kindKey) => {
    const name = newStatus[kindKey]?.trim();
    if (!name) return;
    const ek = entityKinds.find((k) => k.kind === kindKey);
    if (!ek) return;
    const status = { id: generateId(name), name, isTerminal: false };
    updateKind(kindKey, { statuses: [...ek.statuses, status] });
    setNewStatus((prev) => ({ ...prev, [kindKey]: '' }));
  };

  const removeStatus = (kindKey, statusId) => {
    const ek = entityKinds.find((k) => k.kind === kindKey);
    if (!ek) return;
    updateKind(kindKey, { statuses: ek.statuses.filter((s) => s.id !== statusId) });
  };

  const toggleStatusTerminal = (kindKey, statusId) => {
    const ek = entityKinds.find((k) => k.kind === kindKey);
    if (!ek) return;
    updateKind(kindKey, {
      statuses: ek.statuses.map((s) =>
        s.id === statusId ? { ...s, isTerminal: !s.isTerminal } : s
      ),
    });
  };

  return (
    <div className="editor-container" style={{ maxWidth: '900px' }}>
      <SectionHeader
        title="Entity Kinds"
        description="Define the types of entities that exist in your world."
        count={entityKinds.length}
        actions={
          <button className="btn btn-primary" onClick={addEntityKind}>
            + Add Entity Kind
          </button>
        }
      />

      {entityKinds.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No entity kinds defined"
          description="Add one to get started."
        />
      ) : (
        <div className="list-stack">
          {entityKinds.map((ek) => {
            const stableKey = getStableKey(ek);
            const isExpanded = expandedKinds[stableKey];
            const profileCount = getNamingProfileCount(ek.kind);

            return (
              <ExpandableCard
                key={stableKey}
                expanded={isExpanded}
                onToggle={() => toggleKind(stableKey)}
                title={ek.description}
                subtitle={ek.kind}
                actions={
                  <>
                    <UsageBadges usage={getEntityKindUsageSummary(schemaUsage, ek.kind)} compact />
                    {profileCount > 0 && (
                      <span
                        className="badge badge-warning"
                        title={`Used in ${profileCount} naming profile group${profileCount !== 1 ? 's' : ''}`}
                      >
                        ✎ {profileCount}
                      </span>
                    )}
                    <span className="text-muted text-small">
                      {ek.subtypes.length} subtypes, {ek.statuses.length} statuses
                    </span>
                  </>
                }
              >
                {/* Display Name and Kind ID */}
                <FormRow>
                  <FormGroup label="Display Name">
                    <input
                      className="input"
                      value={ek.description}
                      onChange={(e) => updateKind(ek.kind, { description: e.target.value })}
                      placeholder="Entity kind display name"
                    />
                  </FormGroup>
                  <FormGroup label="Kind ID">
                    <input
                      className="input"
                      value={ek.kind}
                      onChange={(e) => {
                        const newKind = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                        if (newKind && !entityKinds.some((k) => k.kind === newKind && k.kind !== ek.kind)) {
                          updateKind(ek.kind, { kind: newKind });
                        }
                      }}
                      placeholder="entity_kind_id"
                    />
                  </FormGroup>
                </FormRow>

                {/* Subtypes */}
                <div className="section">
                  <div className="section-title">Subtypes</div>
                  <div className="chip-list">
                    {ek.subtypes.map((subtype) => (
                      <div key={subtype.id} className="chip">
                        <span>{subtype.name}</span>
                        <button
                          className="chip-remove"
                          onClick={() => removeSubtype(ek.kind, subtype.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="chip-input-row">
                    <input
                      className="input input-sm"
                      value={newSubtype[ek.kind] || ''}
                      onChange={(e) => setNewSubtype((prev) => ({ ...prev, [ek.kind]: e.target.value }))}
                      placeholder="New subtype name"
                      onKeyDown={(e) => e.key === 'Enter' && addSubtype(ek.kind)}
                    />
                    <button className="btn btn-secondary" onClick={() => addSubtype(ek.kind)}>
                      Add
                    </button>
                  </div>
                </div>

                {/* Statuses */}
                <div className="section">
                  <div className="section-title">Statuses</div>
                  <div className="chip-list">
                    {ek.statuses.map((status) => (
                      <div key={status.id} className="chip">
                        <input
                          type="checkbox"
                          checked={status.isTerminal}
                          onChange={() => toggleStatusTerminal(ek.kind, status.id)}
                          title="Terminal status"
                        />
                        <span style={{
                          textDecoration: status.isTerminal ? 'line-through' : 'none',
                          opacity: status.isTerminal ? 0.7 : 1,
                        }}>
                          {status.name}
                        </span>
                        <button
                          className="chip-remove"
                          onClick={() => removeStatus(ek.kind, status.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="chip-input-row">
                    <input
                      className="input input-sm"
                      value={newStatus[ek.kind] || ''}
                      onChange={(e) => setNewStatus((prev) => ({ ...prev, [ek.kind]: e.target.value }))}
                      placeholder="New status name"
                      onKeyDown={(e) => e.key === 'Enter' && addStatus(ek.kind)}
                    />
                    <button className="btn btn-secondary" onClick={() => addStatus(ek.kind)}>
                      Add
                    </button>
                  </div>
                  <div className="hint">Check the box to mark as terminal (entity "ends" in this status)</div>
                </div>

                {/* Default Status */}
                <FormRow>
                  <FormGroup label="Default Status">
                    <select
                      className="input"
                      value={ek.defaultStatus || ''}
                      onChange={(e) => updateKind(ek.kind, { defaultStatus: e.target.value })}
                    >
                      <option value="">-- Select --</option>
                      {ek.statuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </FormGroup>
                </FormRow>

                {/* Delete */}
                <div className="danger-zone">
                  <button className="btn btn-danger" onClick={() => deleteKind(ek.kind)}>
                    Delete Entity Kind
                  </button>
                </div>
              </ExpandableCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
