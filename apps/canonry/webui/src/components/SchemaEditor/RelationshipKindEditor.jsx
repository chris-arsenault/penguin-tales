/**
 * RelationshipKindEditor - Edit relationship kinds
 */

import React, { useState } from 'react';
import { ExpandableCard, FormGroup, FormRow, SectionHeader, EmptyState } from '@penguin-tales/shared-components';
import { ToolUsageBadges as UsageBadges, getRelationshipKindUsageSummary } from '@penguin-tales/shared-components';

export default function RelationshipKindEditor({
  relationshipKinds,
  entityKinds,
  onChange,
  schemaUsage = {},
}) {
  const [expandedRels, setExpandedRels] = useState({});

  const getStableKey = (rel) => rel._key || rel.kind;

  const toggleRel = (stableKey) => {
    setExpandedRels((prev) => ({ ...prev, [stableKey]: !prev[stableKey] }));
  };

  const addRelationship = () => {
    const stableKey = `rel_${Date.now()}`;
    const newRel = {
      kind: stableKey,
      description: 'New Relationship',
      srcKinds: [],
      dstKinds: [],
      cullable: true,
      decayRate: 'medium',
      _key: stableKey,
    };
    onChange([...relationshipKinds, newRel]);
    setExpandedRels((prev) => ({ ...prev, [stableKey]: true }));
  };

  const updateRel = (relKind, updates) => {
    const existing = relationshipKinds.find((r) => r.kind === relKind);
    if (existing?.isFramework) return;
    onChange(relationshipKinds.map((r) => (r.kind === relKind ? { ...r, ...updates } : r)));
  };

  const deleteRel = (relKind) => {
    const existing = relationshipKinds.find((r) => r.kind === relKind);
    if (existing?.isFramework) return;
    if (confirm('Delete this relationship kind?')) {
      onChange(relationshipKinds.filter((r) => r.kind !== relKind));
    }
  };

  const toggleEntityKind = (relKind, field, entityKindId) => {
    const rel = relationshipKinds.find((r) => r.kind === relKind);
    if (!rel || rel.isFramework) return;
    const current = rel[field] || [];
    const updated = current.includes(entityKindId)
      ? current.filter((k) => k !== entityKindId)
      : [...current, entityKindId];
    updateRel(relKind, { [field]: updated });
  };

  const getSummary = (rel) => {
    const srcNames = rel.srcKinds?.length > 0
      ? rel.srcKinds.map((k) => entityKinds.find((ek) => ek.kind === k)?.description || k).slice(0, 2)
      : ['Any'];
    const dstNames = rel.dstKinds?.length > 0
      ? rel.dstKinds.map((k) => entityKinds.find((ek) => ek.kind === k)?.description || k).slice(0, 2)
      : ['Any'];
    return { srcNames, dstNames };
  };

  return (
    <div className="editor-container" style={{ maxWidth: '900px' }}>
      <SectionHeader
        title="Relationship Kinds"
        description="Define how entities can be connected to each other."
        count={relationshipKinds.length}
        actions={
          <button className="btn btn-primary" onClick={addRelationship}>
            + Add Relationship
          </button>
        }
      />

      {relationshipKinds.length === 0 ? (
        <EmptyState
          icon="🔗"
          title="No relationship kinds defined"
          description="Add one to connect entities."
        />
      ) : (
        <div className="list-stack">
          {relationshipKinds.map((rel) => {
            const stableKey = getStableKey(rel);
            const isExpanded = expandedRels[stableKey];
            const { srcNames, dstNames } = getSummary(rel);
            const isFramework = Boolean(rel.isFramework);

            return (
              <ExpandableCard
                key={stableKey}
                expanded={isExpanded}
                onToggle={() => toggleRel(stableKey)}
                title={rel.description}
                subtitle={rel.kind}
                actions={
                  <>
                    <UsageBadges usage={getRelationshipKindUsageSummary(schemaUsage, rel.kind)} compact />
                    {isFramework && <span className="badge badge-info">framework</span>}
                    {rel.cullable === false && <span className="badge badge-info">protected</span>}
                    <div className="text-muted text-small" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {srcNames.map((name, i) => (
                        <span key={i} className="badge">{name}</span>
                      ))}
                      {rel.srcKinds?.length > 2 && <span>+{rel.srcKinds.length - 2}</span>}
                      <span>→</span>
                      {dstNames.map((name, i) => (
                        <span key={i} className="badge">{name}</span>
                      ))}
                      {rel.dstKinds?.length > 2 && <span>+{rel.dstKinds.length - 2}</span>}
                    </div>
                  </>
                }
              >
                {/* Display Name and Kind ID */}
                <FormRow>
                  <FormGroup label="Display Name">
                    <input
                      className="input"
                      value={rel.description}
                      disabled={isFramework}
                      onChange={(e) => updateRel(rel.kind, { description: e.target.value })}
                      placeholder="Relationship display name"
                    />
                  </FormGroup>
                  <FormGroup label="Kind ID">
                    <input
                      className="input"
                      value={rel.kind}
                      disabled={isFramework}
                      onChange={(e) => {
                        const newKind = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                        if (newKind && !relationshipKinds.some((r) => r.kind === newKind && r.kind !== rel.kind)) {
                          updateRel(rel.kind, { kind: newKind });
                        }
                      }}
                      placeholder="relationship_kind_id"
                    />
                  </FormGroup>
                </FormRow>

                {/* Entity Kind Constraints */}
                <div className="nested-section">
                  <div className="section-title">Entity Kind Constraints</div>
                  {entityKinds.length === 0 ? (
                    <div className="text-muted text-small">Define entity kinds first to set constraints.</div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      <div style={{ flex: 1 }}>
                        <div className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Source Kinds</span>
                          {rel.srcKinds?.length === 0 && <span className="text-muted text-small">accepts any</span>}
                        </div>
                        <div className="chip-list">
                          {entityKinds.map((ek) => (
                            <div
                              key={ek.kind}
                              className={`chip chip-clickable ${rel.srcKinds?.includes(ek.kind) ? 'chip-active' : ''}`}
                              onClick={() => toggleEntityKind(rel.kind, 'srcKinds', ek.kind)}
                              style={isFramework ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
                            >
                              {ek.description}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-dim" style={{ fontSize: '24px' }}>→</div>
                      <div style={{ flex: 1 }}>
                        <div className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Destination Kinds</span>
                          {rel.dstKinds?.length === 0 && <span className="text-muted text-small">accepts any</span>}
                        </div>
                        <div className="chip-list">
                          {entityKinds.map((ek) => (
                            <div
                              key={ek.kind}
                              className={`chip chip-clickable ${rel.dstKinds?.includes(ek.kind) ? 'chip-active' : ''}`}
                              onClick={() => toggleEntityKind(rel.kind, 'dstKinds', ek.kind)}
                              style={isFramework ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
                            >
                              {ek.description}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Maintenance Settings */}
                <div className="nested-section">
                  <div className="section-title">Maintenance Settings</div>
                  <FormRow>
                    <FormGroup label="Decay Rate">
                      <select
                        className="input"
                        value={rel.decayRate || 'medium'}
                        disabled={isFramework}
                        onChange={(e) => updateRel(rel.kind, { decayRate: e.target.value })}
                      >
                        <option value="none">None (permanent)</option>
                        <option value="slow">Slow</option>
                        <option value="medium">Medium</option>
                        <option value="fast">Fast</option>
                      </select>
                    </FormGroup>
                    <FormGroup>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={rel.cullable !== false}
                          disabled={isFramework}
                          onChange={(e) => updateRel(rel.kind, { cullable: e.target.checked })}
                        />
                        Cullable (can be removed when weak)
                      </label>
                    </FormGroup>
                  </FormRow>
                </div>

                {/* Delete */}
                <div className="danger-zone">
                  <button className="btn btn-danger" onClick={() => deleteRel(rel.kind)} disabled={isFramework}>
                    Delete Relationship
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
