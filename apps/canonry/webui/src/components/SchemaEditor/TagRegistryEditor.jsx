/**
 * TagRegistryEditor - Edit tag registry (tags with metadata)
 *
 * This is the authoritative place to define tags.
 * Tags can be referenced by templates, regions, and profiles.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { ExpandableCard, FormGroup, FormRow, SectionHeader, EmptyState, NumberInput } from '@penguin-tales/shared-components';
import { ToolUsageBadges as UsageBadges } from '@penguin-tales/shared-components';

// Category colors (dynamic - keep as objects)
const CATEGORY_COLORS = {
  status: { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' },
  trait: { bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' },
  affiliation: { bg: 'rgba(168, 85, 247, 0.2)', color: '#a855f7' },
  behavior: { bg: 'rgba(249, 115, 22, 0.2)', color: '#f97316' },
  theme: { bg: 'rgba(236, 72, 153, 0.2)', color: '#ec4899' },
  location: { bg: 'rgba(20, 184, 166, 0.2)', color: '#14b8a6' },
};

// Rarity colors (dynamic - keep as objects)
const RARITY_COLORS = {
  common: { bg: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af' },
  uncommon: { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' },
  rare: { bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' },
  legendary: { bg: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24' },
};

const CATEGORIES = ['status', 'trait', 'affiliation', 'behavior', 'theme', 'location'];
const RARITIES = ['common', 'uncommon', 'rare', 'legendary'];

// Separate component for tag ID input to prevent cursor jumping
function TagIdInput({ value, onChange, allTagIds }) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e) => {
    const newId = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setLocalValue(newId);
  };

  const handleBlur = () => {
    if (localValue && localValue !== value && !allTagIds.includes(localValue)) {
      onChange(localValue);
    } else if (!localValue || allTagIds.includes(localValue)) {
      setLocalValue(value);
    }
  };

  return (
    <input
      className="input"
      style={{ fontFamily: 'monospace' }}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="tag_id"
    />
  );
}

export default function TagRegistryEditor({ tagRegistry = [], entityKinds = [], onChange, tagUsage = {} }) {
  const [expandedTags, setExpandedTags] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [newRelatedTag, setNewRelatedTag] = useState({});
  const [newConflictingTag, setNewConflictingTag] = useState({});
  const [newEntityKind, setNewEntityKind] = useState({});

  // Compute stats
  const stats = useMemo(() => {
    const byCategory = {};
    const byRarity = {};
    CATEGORIES.forEach(c => byCategory[c] = 0);
    RARITIES.forEach(r => byRarity[r] = 0);
    tagRegistry.forEach(tag => {
      byCategory[tag.category] = (byCategory[tag.category] || 0) + 1;
      byRarity[tag.rarity] = (byRarity[tag.rarity] || 0) + 1;
    });
    return { total: tagRegistry.length, byCategory, byRarity };
  }, [tagRegistry]);

  // Filter tags
  const filteredTags = useMemo(() => {
    return tagRegistry.filter(tag => {
      const matchesSearch = !searchQuery ||
        tag.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tag.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || tag.category === categoryFilter;
      const matchesRarity = rarityFilter === 'all' || tag.rarity === rarityFilter;
      return matchesSearch && matchesCategory && matchesRarity;
    });
  }, [tagRegistry, searchQuery, categoryFilter, rarityFilter]);

  const toggleTag = (tagId) => {
    setExpandedTags((prev) => ({ ...prev, [tagId]: !prev[tagId] }));
  };

  const addTag = () => {
    const newTag = {
      tag: `new_tag_${Date.now()}`,
      category: 'trait',
      rarity: 'common',
      description: 'New tag description',
      usageCount: 0,
      templates: [],
      entityKinds: [],
      minUsage: 1,
      maxUsage: 50,
      relatedTags: [],
      conflictingTags: [],
    };
    onChange([newTag, ...tagRegistry]);
    setExpandedTags((prev) => ({ ...prev, [newTag.tag]: true }));
  };

  const updateTag = (tagId, updates) => {
    onChange(tagRegistry.map((t) => (t.tag === tagId ? { ...t, ...updates } : t)));
  };

  const deleteTag = (tagId) => {
    if (confirm('Delete this tag? This cannot be undone.')) {
      onChange(tagRegistry.filter((t) => t.tag !== tagId));
    }
  };

  // Related tags management
  const addRelatedTag = (tagId) => {
    const relatedTag = newRelatedTag[tagId]?.trim();
    if (!relatedTag) return;
    const tag = tagRegistry.find((t) => t.tag === tagId);
    if (!tag) return;
    const existingRelated = tag.relatedTags || [];
    if (!existingRelated.includes(relatedTag)) {
      updateTag(tagId, { relatedTags: [...existingRelated, relatedTag] });
    }
    setNewRelatedTag((prev) => ({ ...prev, [tagId]: '' }));
  };

  const removeRelatedTag = (tagId, relatedTag) => {
    const tag = tagRegistry.find((t) => t.tag === tagId);
    if (!tag) return;
    updateTag(tagId, { relatedTags: (tag.relatedTags || []).filter((r) => r !== relatedTag) });
  };

  // Conflicting tags management
  const addConflictingTag = (tagId) => {
    const conflictingTag = newConflictingTag[tagId]?.trim();
    if (!conflictingTag) return;
    const tag = tagRegistry.find((t) => t.tag === tagId);
    if (!tag) return;
    const existingConflicts = tag.conflictingTags || [];
    if (!existingConflicts.includes(conflictingTag)) {
      updateTag(tagId, { conflictingTags: [...existingConflicts, conflictingTag] });
    }
    setNewConflictingTag((prev) => ({ ...prev, [tagId]: '' }));
  };

  const removeConflictingTag = (tagId, conflictingTag) => {
    const tag = tagRegistry.find((t) => t.tag === tagId);
    if (!tag) return;
    updateTag(tagId, { conflictingTags: (tag.conflictingTags || []).filter((c) => c !== conflictingTag) });
  };

  // Entity kinds management
  const addTagEntityKind = (tagId) => {
    const entityKind = newEntityKind[tagId]?.trim();
    if (!entityKind) return;
    const tag = tagRegistry.find((t) => t.tag === tagId);
    if (!tag) return;
    const existingKinds = tag.entityKinds || [];
    if (!existingKinds.includes(entityKind)) {
      updateTag(tagId, { entityKinds: [...existingKinds, entityKind] });
    }
    setNewEntityKind((prev) => ({ ...prev, [tagId]: '' }));
  };

  const removeTagEntityKind = (tagId, entityKind) => {
    const tag = tagRegistry.find((t) => t.tag === tagId);
    if (!tag) return;
    updateTag(tagId, { entityKinds: (tag.entityKinds || []).filter((k) => k !== entityKind) });
  };

  const allTagNames = useMemo(() => tagRegistry.map(t => t.tag), [tagRegistry]);

  return (
    <div className="editor-container" style={{ maxWidth: '1100px' }}>
      <SectionHeader
        title="Tag Registry"
        description="Define tags that categorize entities. Tags provide governance through usage limits, relationships, and conflicts."
      />

      {/* Stats Bar */}
      <div className="summary-stats-grid" style={{ marginBottom: '16px' }}>
        <div className="summary-stat">
          <span className="summary-stat-value">{stats.total}</span>
          <span className="summary-stat-label">Total</span>
        </div>
        {CATEGORIES.map(cat => (
          <div key={cat} className="summary-stat">
            <span className="summary-stat-value" style={{ color: CATEGORY_COLORS[cat].color }}>
              {stats.byCategory[cat] || 0}
            </span>
            <span className="summary-stat-label">{cat}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <input
          className="input"
          type="text"
          placeholder="Search tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
        <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <select className="input" value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)}>
          <option value="all">All Rarities</option>
          {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="text-muted">{filteredTags.length} of {tagRegistry.length} tags</span>
        <button className="btn btn-primary" onClick={addTag}>+ Add Tag</button>
      </div>

      {tagRegistry.length === 0 ? (
        <EmptyState icon="🏷️" title="No tags defined" description="Add one to get started." />
      ) : filteredTags.length === 0 ? (
        <EmptyState icon="🔍" title="No matches" description="No tags match your filters." />
      ) : (
        <div className="list-stack">
          {filteredTags.map((tag) => {
            const isExpanded = expandedTags[tag.tag];
            const catColor = CATEGORY_COLORS[tag.category] || CATEGORY_COLORS.trait;
            const rarColor = RARITY_COLORS[tag.rarity] || RARITY_COLORS.common;

            return (
              <ExpandableCard
                key={tag.tag}
                expanded={isExpanded}
                onToggle={() => toggleTag(tag.tag)}
                title={<span style={{ fontFamily: 'monospace' }}>{tag.tag}</span>}
                actions={
                  <>
                    <span className="badge" style={{ backgroundColor: catColor.bg, color: catColor.color }}>
                      {tag.category}
                    </span>
                    <span className="badge" style={{ backgroundColor: rarColor.bg, color: rarColor.color }}>
                      {tag.rarity}
                    </span>
                    {tag.isAxis && (
                      <span className="badge" style={{ backgroundColor: 'rgba(34, 211, 238, 0.2)', color: '#22d3ee' }}>
                        ↔ axis
                      </span>
                    )}
                    {tagUsage[tag.tag] && <UsageBadges usage={tagUsage[tag.tag]} compact />}
                    <span className="text-muted text-small">
                      {tag.minUsage || 0}-{tag.maxUsage || '∞'} | {(tag.entityKinds || []).length} kinds
                    </span>
                  </>
                }
              >
                {/* Tag ID and Category/Rarity */}
                <FormRow>
                  <FormGroup label="Tag ID">
                    <TagIdInput
                      value={tag.tag}
                      allTagIds={allTagNames.filter(t => t !== tag.tag)}
                      onChange={(newId) => {
                        const oldId = tag.tag;
                        const updatedRegistry = tagRegistry.map(t => {
                          if (t.tag === oldId) return { ...t, tag: newId };
                          const updated = { ...t };
                          if (t.relatedTags?.includes(oldId)) {
                            updated.relatedTags = t.relatedTags.map(r => r === oldId ? newId : r);
                          }
                          if (t.conflictingTags?.includes(oldId)) {
                            updated.conflictingTags = t.conflictingTags.map(c => c === oldId ? newId : c);
                          }
                          return updated;
                        });
                        setExpandedTags(prev => {
                          const updated = { ...prev };
                          if (updated[oldId]) {
                            updated[newId] = updated[oldId];
                            delete updated[oldId];
                          }
                          return updated;
                        });
                        onChange(updatedRegistry);
                      }}
                    />
                  </FormGroup>
                  <FormGroup label="Category">
                    <select className="input" value={tag.category} onChange={(e) => updateTag(tag.tag, { category: e.target.value })}>
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </FormGroup>
                  <FormGroup label="Rarity">
                    <select className="input" value={tag.rarity} onChange={(e) => updateTag(tag.tag, { rarity: e.target.value })}>
                      {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </FormGroup>
                </FormRow>

                <FormRow>
                  <FormGroup label="Description" wide>
                    <textarea
                      className="input"
                      style={{ minHeight: '60px', resize: 'vertical' }}
                      value={tag.description || ''}
                      onChange={(e) => updateTag(tag.tag, { description: e.target.value })}
                      placeholder="Describe what this tag represents..."
                    />
                  </FormGroup>
                </FormRow>

                {/* Axis Label */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={tag.isAxis || false}
                      onChange={(e) => updateTag(tag.tag, { isAxis: e.target.checked })}
                    />
                    <span style={{ fontWeight: 500 }}>Semantic Plane Axis Label</span>
                    <span className="text-muted text-small">— Tag is used as a low/high endpoint on a semantic plane axis</span>
                  </label>
                </div>

                {/* Usage Limits */}
                <FormRow>
                  <FormGroup label="Min Usage" hint="Minimum entities with this tag">
                    <NumberInput
                      className="input"
                      min={0}
                      value={tag.minUsage || 0}
                      onChange={(v) => updateTag(tag.tag, { minUsage: v ?? 0 })}
                      integer
                    />
                  </FormGroup>
                  <FormGroup label="Max Usage" hint="Maximum entities with this tag">
                    <NumberInput
                      className="input"
                      min={0}
                      value={tag.maxUsage || 50}
                      onChange={(v) => updateTag(tag.tag, { maxUsage: v ?? 50 })}
                      integer
                    />
                  </FormGroup>
                  <FormGroup label="Consolidate Into" hint="Suggest merging into this tag">
                    <select
                      className="input"
                      value={tag.consolidateInto || ''}
                      onChange={(e) => updateTag(tag.tag, { consolidateInto: e.target.value || undefined })}
                    >
                      <option value="">-- None --</option>
                      {allTagNames.filter(t => t !== tag.tag).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </FormGroup>
                </FormRow>

                {/* Entity Kinds */}
                <div className="section">
                  <div className="section-title">Applicable Entity Kinds</div>
                  <div className="chip-list">
                    {(tag.entityKinds || []).map((kind) => (
                      <div key={kind} className="chip">
                        <span>{kind}</span>
                        <button className="chip-remove" onClick={() => removeTagEntityKind(tag.tag, kind)}>×</button>
                      </div>
                    ))}
                  </div>
                  <div className="chip-input-row">
                    <select
                      className="input"
                      style={{ flex: 1, maxWidth: '300px' }}
                      value={newEntityKind[tag.tag] || ''}
                      onChange={(e) => setNewEntityKind((prev) => ({ ...prev, [tag.tag]: e.target.value }))}
                    >
                      <option value="">Select entity kind...</option>
                      {entityKinds.filter(ek => !(tag.entityKinds || []).includes(ek.kind)).map(ek => (
                        <option key={ek.kind} value={ek.kind}>{ek.description || ek.kind}</option>
                      ))}
                    </select>
                    <button className="btn btn-secondary" onClick={() => addTagEntityKind(tag.tag)}>Add</button>
                  </div>
                  <div className="hint">Which entity kinds can have this tag</div>
                </div>

                {/* Related Tags */}
                <div className="section">
                  <div className="section-title">Related Tags</div>
                  <div className="chip-list">
                    {(tag.relatedTags || []).map((relatedTag) => (
                      <div key={relatedTag} className="chip">
                        <span>{relatedTag}</span>
                        <button className="chip-remove" onClick={() => removeRelatedTag(tag.tag, relatedTag)}>×</button>
                      </div>
                    ))}
                  </div>
                  <div className="chip-input-row">
                    <select
                      className="input"
                      style={{ flex: 1, maxWidth: '300px' }}
                      value={newRelatedTag[tag.tag] || ''}
                      onChange={(e) => setNewRelatedTag((prev) => ({ ...prev, [tag.tag]: e.target.value }))}
                    >
                      <option value="">Select related tag...</option>
                      {allTagNames.filter(t => t !== tag.tag && !(tag.relatedTags || []).includes(t)).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <button className="btn btn-secondary" onClick={() => addRelatedTag(tag.tag)}>Add</button>
                  </div>
                  <div className="hint">Tags that commonly appear together</div>
                </div>

                {/* Conflicting Tags */}
                <div className="section">
                  <div className="section-title">Conflicting Tags</div>
                  <div className="chip-list">
                    {(tag.conflictingTags || []).map((conflictingTag) => (
                      <div key={conflictingTag} className="chip" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}>
                        <span>{conflictingTag}</span>
                        <button className="chip-remove" onClick={() => removeConflictingTag(tag.tag, conflictingTag)}>×</button>
                      </div>
                    ))}
                  </div>
                  <div className="chip-input-row">
                    <select
                      className="input"
                      style={{ flex: 1, maxWidth: '300px' }}
                      value={newConflictingTag[tag.tag] || ''}
                      onChange={(e) => setNewConflictingTag((prev) => ({ ...prev, [tag.tag]: e.target.value }))}
                    >
                      <option value="">Select conflicting tag...</option>
                      {allTagNames.filter(t => t !== tag.tag && !(tag.conflictingTags || []).includes(t)).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <button className="btn btn-secondary" onClick={() => addConflictingTag(tag.tag)}>Add</button>
                  </div>
                  <div className="hint">Tags that should never appear together</div>
                </div>

                {/* Delete */}
                <div className="danger-zone">
                  <button className="btn btn-danger" onClick={() => deleteTag(tag.tag)}>Delete Tag</button>
                </div>
              </ExpandableCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
