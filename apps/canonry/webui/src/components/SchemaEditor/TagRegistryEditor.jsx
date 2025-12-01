/**
 * TagRegistryEditor - Edit tag registry (tags with metadata)
 *
 * This is the authoritative place to define tags.
 * Tags can be referenced by templates, regions, and profiles.
 */

import React, { useState, useMemo } from 'react';
import { colors, typography, spacing, radius, components } from '../../theme';
import UsageBadges from '../UsageBadges';

const styles = {
  container: {
    maxWidth: '1100px',
  },
  header: {
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.sizeTitle,
    fontWeight: typography.weightSemibold,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizeLg,
    fontFamily: typography.fontFamily,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  searchInput: {
    flex: 1,
    maxWidth: '300px',
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.sizeLg,
    fontFamily: typography.fontFamily,
    backgroundColor: colors.bgTertiary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    color: colors.textPrimary,
  },
  filterGroup: {
    display: 'flex',
    gap: spacing.sm,
    alignItems: 'center',
  },
  filterSelect: {
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.sizeMd,
    fontFamily: typography.fontFamily,
    backgroundColor: colors.bgTertiary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    color: colors.textPrimary,
  },
  count: {
    color: colors.textMuted,
    fontSize: typography.sizeMd,
    fontFamily: typography.fontFamily,
  },
  addButton: {
    ...components.buttonPrimary,
  },
  tagList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  tagCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
  },
  tagHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${spacing.md} ${spacing.lg}`,
    cursor: 'pointer',
  },
  tagHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
  },
  expandIcon: {
    fontSize: typography.sizeSm,
    color: colors.textMuted,
    transition: 'transform 0.2s',
    width: '16px',
  },
  tagName: {
    fontWeight: typography.weightMedium,
    fontFamily: 'monospace',
    color: colors.textPrimary,
  },
  categoryBadge: {
    padding: `2px ${spacing.sm}`,
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    borderRadius: radius.sm,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  rarityBadge: {
    padding: `2px ${spacing.sm}`,
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    borderRadius: radius.sm,
  },
  tagSummary: {
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    color: colors.textMuted,
    display: 'flex',
    gap: spacing.md,
  },
  tagBody: {
    padding: spacing.lg,
    borderTop: `1px solid ${colors.border}`,
    backgroundColor: colors.bgTertiary,
  },
  formRow: {
    display: 'flex',
    gap: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  formGroup: {
    flex: 1,
  },
  formGroupSmall: {
    flex: '0 0 150px',
  },
  label: {
    ...components.label,
  },
  input: {
    ...components.input,
  },
  textarea: {
    ...components.input,
    minHeight: '60px',
    resize: 'vertical',
  },
  select: {
    ...components.input,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizeMd,
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  itemList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.xs} ${spacing.sm}`,
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.sm,
    fontSize: typography.sizeSm,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
  },
  itemRemove: {
    background: 'none',
    border: 'none',
    color: colors.danger,
    cursor: 'pointer',
    padding: '0 2px',
    fontSize: typography.sizeLg,
  },
  addItemRow: {
    display: 'flex',
    gap: spacing.sm,
  },
  addItemInput: {
    flex: 1,
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.sizeSm,
    fontFamily: typography.fontFamily,
    backgroundColor: colors.bgSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    color: colors.textPrimary,
  },
  addItemButton: {
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.sizeSm,
    fontFamily: typography.fontFamily,
    backgroundColor: colors.buttonSecondary,
    color: colors.textSecondary,
    border: 'none',
    borderRadius: radius.sm,
    cursor: 'pointer',
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
  },
  deleteButton: {
    ...components.buttonDanger,
  },
  emptyState: {
    color: colors.textMuted,
    fontSize: typography.sizeLg,
    fontFamily: typography.fontFamily,
    textAlign: 'center',
    padding: spacing.xxxl,
  },
  hint: {
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  statsBar: {
    display: 'flex',
    gap: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    border: `1px solid ${colors.border}`,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.sizeXl,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
};

// Category colors
const CATEGORY_COLORS = {
  status: { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' },
  trait: { bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' },
  affiliation: { bg: 'rgba(168, 85, 247, 0.2)', color: '#a855f7' },
  behavior: { bg: 'rgba(249, 115, 22, 0.2)', color: '#f97316' },
  theme: { bg: 'rgba(236, 72, 153, 0.2)', color: '#ec4899' },
  location: { bg: 'rgba(20, 184, 166, 0.2)', color: '#14b8a6' },
};

// Rarity colors
const RARITY_COLORS = {
  common: { bg: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af' },
  uncommon: { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' },
  rare: { bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' },
  legendary: { bg: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24' },
};

const CATEGORIES = ['status', 'trait', 'affiliation', 'behavior', 'theme', 'location'];
const RARITIES = ['common', 'uncommon', 'rare', 'legendary'];

// Generate ID from name (lowercase, underscores)
function generateId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
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
    onChange([...tagRegistry, newTag]);
    setExpandedTags((prev) => ({ ...prev, [newTag.tag]: true }));
  };

  const updateTag = (tagId, updates) => {
    onChange(
      tagRegistry.map((t) => (t.tag === tagId ? { ...t, ...updates } : t))
    );
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
    updateTag(tagId, {
      relatedTags: (tag.relatedTags || []).filter((r) => r !== relatedTag),
    });
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
    updateTag(tagId, {
      conflictingTags: (tag.conflictingTags || []).filter((c) => c !== conflictingTag),
    });
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
    updateTag(tagId, {
      entityKinds: (tag.entityKinds || []).filter((k) => k !== entityKind),
    });
  };

  // Get all existing tag names for autocomplete suggestions
  const allTagNames = useMemo(() => tagRegistry.map(t => t.tag), [tagRegistry]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Tag Registry</div>
        <div style={styles.subtitle}>
          Define tags that categorize entities. Tags provide governance through usage limits,
          relationships, and conflicts.
        </div>
      </div>

      {/* Stats Bar */}
      <div style={styles.statsBar}>
        <div style={styles.stat}>
          <span style={styles.statValue}>{stats.total}</span>
          <span style={styles.statLabel}>Total Tags</span>
        </div>
        {CATEGORIES.map(cat => (
          <div key={cat} style={styles.stat}>
            <span style={{ ...styles.statValue, color: CATEGORY_COLORS[cat].color }}>
              {stats.byCategory[cat] || 0}
            </span>
            <span style={styles.statLabel}>{cat}</span>
          </div>
        ))}
      </div>

      <div style={styles.toolbar}>
        <input
          style={styles.searchInput}
          type="text"
          placeholder="Search tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div style={styles.filterGroup}>
          <select
            style={styles.filterSelect}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            style={styles.filterSelect}
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value)}
          >
            <option value="all">All Rarities</option>
            {RARITIES.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <span style={styles.count}>
          {filteredTags.length} of {tagRegistry.length} tag{tagRegistry.length !== 1 ? 's' : ''}
        </span>
        <button style={styles.addButton} onClick={addTag}>
          + Add Tag
        </button>
      </div>

      {tagRegistry.length === 0 ? (
        <div style={styles.emptyState}>
          No tags defined yet. Add one to get started.
        </div>
      ) : filteredTags.length === 0 ? (
        <div style={styles.emptyState}>
          No tags match your filters.
        </div>
      ) : (
        <div style={styles.tagList}>
          {filteredTags.map((tag) => {
            const isExpanded = expandedTags[tag.tag];
            const catColor = CATEGORY_COLORS[tag.category] || CATEGORY_COLORS.trait;
            const rarColor = RARITY_COLORS[tag.rarity] || RARITY_COLORS.common;

            return (
              <div key={tag.tag} style={styles.tagCard}>
                <div
                  style={styles.tagHeader}
                  onClick={() => toggleTag(tag.tag)}
                >
                  <div style={styles.tagHeaderLeft}>
                    <span
                      style={{
                        ...styles.expandIcon,
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}
                    >
                      ▶
                    </span>
                    <span style={styles.tagName}>{tag.tag}</span>
                    <span style={{
                      ...styles.categoryBadge,
                      backgroundColor: catColor.bg,
                      color: catColor.color,
                    }}>
                      {tag.category}
                    </span>
                    <span style={{
                      ...styles.rarityBadge,
                      backgroundColor: rarColor.bg,
                      color: rarColor.color,
                    }}>
                      {tag.rarity}
                    </span>
                    {tagUsage[tag.tag] && (
                      <UsageBadges usage={tagUsage[tag.tag]} compact />
                    )}
                  </div>
                  <div style={styles.tagSummary}>
                    <span>Usage: {tag.minUsage || 0}-{tag.maxUsage || '∞'}</span>
                    <span>{(tag.entityKinds || []).length} kinds</span>
                    <span>{(tag.relatedTags || []).length} related</span>
                    <span>{(tag.conflictingTags || []).length} conflicts</span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={styles.tagBody}>
                    {/* Tag ID and Description */}
                    <div style={styles.formRow}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Tag ID</label>
                        <input
                          style={{ ...styles.input, fontFamily: 'monospace' }}
                          value={tag.tag}
                          onChange={(e) => {
                            const newId = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                            if (newId && !tagRegistry.some((t) => t.tag === newId && t.tag !== tag.tag)) {
                              // Update tag ID and also update references in other tags
                              const oldId = tag.tag;
                              const updatedRegistry = tagRegistry.map(t => {
                                if (t.tag === oldId) {
                                  return { ...t, tag: newId };
                                }
                                // Update references in related/conflicting tags
                                const updated = { ...t };
                                if (t.relatedTags?.includes(oldId)) {
                                  updated.relatedTags = t.relatedTags.map(r => r === oldId ? newId : r);
                                }
                                if (t.conflictingTags?.includes(oldId)) {
                                  updated.conflictingTags = t.conflictingTags.map(c => c === oldId ? newId : c);
                                }
                                return updated;
                              });
                              onChange(updatedRegistry);
                            }
                          }}
                          placeholder="tag_id"
                        />
                      </div>
                      <div style={styles.formGroupSmall}>
                        <label style={styles.label}>Category</label>
                        <select
                          style={styles.select}
                          value={tag.category}
                          onChange={(e) => updateTag(tag.tag, { category: e.target.value })}
                        >
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div style={styles.formGroupSmall}>
                        <label style={styles.label}>Rarity</label>
                        <select
                          style={styles.select}
                          value={tag.rarity}
                          onChange={(e) => updateTag(tag.tag, { rarity: e.target.value })}
                        >
                          {RARITIES.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={styles.formRow}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Description</label>
                        <textarea
                          style={styles.textarea}
                          value={tag.description || ''}
                          onChange={(e) => updateTag(tag.tag, { description: e.target.value })}
                          placeholder="Describe what this tag represents..."
                        />
                      </div>
                    </div>

                    {/* Usage Limits */}
                    <div style={styles.formRow}>
                      <div style={styles.formGroupSmall}>
                        <label style={styles.label}>Min Usage</label>
                        <input
                          style={styles.input}
                          type="number"
                          min="0"
                          value={tag.minUsage || 0}
                          onChange={(e) => updateTag(tag.tag, { minUsage: parseInt(e.target.value) || 0 })}
                        />
                        <div style={styles.hint}>Minimum entities with this tag</div>
                      </div>
                      <div style={styles.formGroupSmall}>
                        <label style={styles.label}>Max Usage</label>
                        <input
                          style={styles.input}
                          type="number"
                          min="0"
                          value={tag.maxUsage || 50}
                          onChange={(e) => updateTag(tag.tag, { maxUsage: parseInt(e.target.value) || 50 })}
                        />
                        <div style={styles.hint}>Maximum entities with this tag</div>
                      </div>
                      <div style={styles.formGroupSmall}>
                        <label style={styles.label}>Consolidate Into</label>
                        <select
                          style={styles.select}
                          value={tag.consolidateInto || ''}
                          onChange={(e) => updateTag(tag.tag, { consolidateInto: e.target.value || undefined })}
                        >
                          <option value="">-- None --</option>
                          {allTagNames.filter(t => t !== tag.tag).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <div style={styles.hint}>Suggest merging into this tag</div>
                      </div>
                    </div>

                    {/* Entity Kinds */}
                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>Applicable Entity Kinds</div>
                      <div style={styles.itemList}>
                        {(tag.entityKinds || []).map((kind) => (
                          <div key={kind} style={styles.item}>
                            <span>{kind}</span>
                            <button
                              style={styles.itemRemove}
                              onClick={() => removeTagEntityKind(tag.tag, kind)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <div style={styles.addItemRow}>
                        <select
                          style={styles.addItemInput}
                          value={newEntityKind[tag.tag] || ''}
                          onChange={(e) =>
                            setNewEntityKind((prev) => ({
                              ...prev,
                              [tag.tag]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select entity kind...</option>
                          {entityKinds
                            .filter(ek => !(tag.entityKinds || []).includes(ek.kind))
                            .map(ek => (
                              <option key={ek.kind} value={ek.kind}>{ek.description || ek.kind}</option>
                            ))}
                        </select>
                        <button
                          style={styles.addItemButton}
                          onClick={() => addTagEntityKind(tag.tag)}
                        >
                          Add
                        </button>
                      </div>
                      <div style={styles.hint}>
                        Which entity kinds can have this tag
                      </div>
                    </div>

                    {/* Related Tags */}
                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>Related Tags</div>
                      <div style={styles.itemList}>
                        {(tag.relatedTags || []).map((relatedTag) => (
                          <div key={relatedTag} style={styles.item}>
                            <span>{relatedTag}</span>
                            <button
                              style={styles.itemRemove}
                              onClick={() => removeRelatedTag(tag.tag, relatedTag)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <div style={styles.addItemRow}>
                        <select
                          style={styles.addItemInput}
                          value={newRelatedTag[tag.tag] || ''}
                          onChange={(e) =>
                            setNewRelatedTag((prev) => ({
                              ...prev,
                              [tag.tag]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select related tag...</option>
                          {allTagNames
                            .filter(t => t !== tag.tag && !(tag.relatedTags || []).includes(t))
                            .map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        <button
                          style={styles.addItemButton}
                          onClick={() => addRelatedTag(tag.tag)}
                        >
                          Add
                        </button>
                      </div>
                      <div style={styles.hint}>
                        Tags that commonly appear together
                      </div>
                    </div>

                    {/* Conflicting Tags */}
                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>Conflicting Tags</div>
                      <div style={styles.itemList}>
                        {(tag.conflictingTags || []).map((conflictingTag) => (
                          <div key={conflictingTag} style={{
                            ...styles.item,
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                          }}>
                            <span>{conflictingTag}</span>
                            <button
                              style={styles.itemRemove}
                              onClick={() => removeConflictingTag(tag.tag, conflictingTag)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <div style={styles.addItemRow}>
                        <select
                          style={styles.addItemInput}
                          value={newConflictingTag[tag.tag] || ''}
                          onChange={(e) =>
                            setNewConflictingTag((prev) => ({
                              ...prev,
                              [tag.tag]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select conflicting tag...</option>
                          {allTagNames
                            .filter(t => t !== tag.tag && !(tag.conflictingTags || []).includes(t))
                            .map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        <button
                          style={styles.addItemButton}
                          onClick={() => addConflictingTag(tag.tag)}
                        >
                          Add
                        </button>
                      </div>
                      <div style={styles.hint}>
                        Tags that should never appear together on the same entity
                      </div>
                    </div>

                    {/* Delete */}
                    <div style={styles.actionsRow}>
                      <button
                        style={styles.deleteButton}
                        onClick={() => deleteTag(tag.tag)}
                      >
                        Delete Tag
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
