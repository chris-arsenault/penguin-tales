/**
 * ActionsEditor v2 - Visual builder with tabbed modal
 *
 * Actions define what agents can do during the simulation via the universalCatalyst system.
 *
 * Tabs:
 * - Overview: ID, name, description
 * - Actor: Who can perform (kinds, subtypes, prominence, relationships)
 * - Resolution: How actor resolves (self, via_relationship)
 * - Targeting: How to find targets (kind, filters, requirements)
 * - Outcome: What happens (relationships, pressure changes)
 * - Probability: Success chance, weight, pressure modifiers
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { getElementValidation } from '../utils/schemaUsageMap';

// ============================================================================
// CSS HOVER STYLES (injected once)
// ============================================================================

const HOVER_STYLES_ID = 'actions-editor-hover-styles';

const hoverCSS = `
  .ae-tab-btn:not(.ae-tab-btn-active):hover {
    background-color: rgba(245, 158, 11, 0.15) !important;
  }
  .ae-tab-btn:not(.ae-tab-btn-active) {
    background-color: transparent !important;
  }
  .ae-add-item-btn:hover {
    border-color: #f59e0b !important;
    color: #f59e0b !important;
  }
  .ae-add-item-btn {
    border-color: rgba(59, 130, 246, 0.3) !important;
    color: #60a5fa !important;
  }
  .ae-card-option:hover {
    border-color: #f59e0b !important;
  }
  .ae-resolution-card:hover {
    border-color: #f59e0b !important;
  }
`;

function useHoverStyles() {
  useEffect(() => {
    if (!document.getElementById(HOVER_STYLES_ID)) {
      const style = document.createElement('style');
      style.id = HOVER_STYLES_ID;
      style.textContent = hoverCSS;
      document.head.appendChild(style);
    }
  }, []);
}

// ============================================================================
// THEME & CONSTANTS
// ============================================================================

const ACCENT_COLOR = '#f59e0b';
const ACCENT_GRADIENT = 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)';

const COLORS = {
  bg: '#0a1929',
  bgCard: '#1e3a5f',
  bgDark: '#0c1f2e',
  border: 'rgba(59, 130, 246, 0.3)',
  borderLight: 'rgba(59, 130, 246, 0.15)',
  text: '#ffffff',
  textMuted: '#93c5fd',
  textDim: '#60a5fa',
  accent: ACCENT_COLOR,
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  purple: '#a855f7',
  pink: '#ec4899',
  teal: '#14b8a6',
};

// Validation indicator styles
const validationStyles = {
  invalidBorder: {
    borderColor: COLORS.danger,
    boxShadow: `0 0 0 1px ${COLORS.danger}`,
  },
  warningBorder: {
    borderColor: COLORS.warning,
    boxShadow: `0 0 0 1px ${COLORS.warning}`,
  },
  validationBadge: {
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: '10px',
    marginLeft: '8px',
  },
  errorBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: COLORS.danger,
  },
  compatibilityBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: COLORS.warning,
  },
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'actor', label: 'Actor', icon: '🎭' },
  { id: 'resolution', label: 'Resolution', icon: '🔍' },
  { id: 'targeting', label: 'Targeting', icon: '🎯' },
  { id: 'outcome', label: 'Outcome', icon: '⚡' },
  { id: 'probability', label: 'Probability', icon: '🎲' },
];

const RESOLUTION_TYPES = [
  { value: 'self', label: 'Self', desc: 'Actor acts as themselves' },
  { value: 'via_relationship', label: 'Via Relationship', desc: 'Actor resolves through a relationship' },
];

const DIRECTIONS = [
  { value: 'src', label: 'Source' },
  { value: 'dst', label: 'Destination' },
  { value: 'both', label: 'Both' },
];

const PROMINENCE_LEVELS = [
  { value: 'forgotten', label: 'Forgotten' },
  { value: 'marginal', label: 'Marginal' },
  { value: 'recognized', label: 'Recognized' },
  { value: 'renowned', label: 'Renowned' },
  { value: 'mythic', label: 'Mythic' },
];

const RELATIONSHIP_REFS = [
  { value: 'actor', label: 'Actor' },
  { value: 'resolved_actor', label: 'Resolved Actor' },
  { value: 'target', label: 'Target' },
  { value: 'target2', label: 'Target 2' },
  { value: 'corruption_source', label: 'Corruption Source' },
];

// ============================================================================
// STYLES
// ============================================================================

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
    color: COLORS.text,
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: COLORS.textMuted,
  },
  stats: {
    display: 'flex',
    gap: '24px',
    marginTop: '16px',
    padding: '12px 16px',
    backgroundColor: COLORS.bgDark,
    borderRadius: '8px',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statLabel: {
    fontSize: '11px',
    color: COLORS.textDim,
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 600,
    color: COLORS.text,
  },

  // Grid
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  actionCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: '12px',
    border: `1px solid ${COLORS.border}`,
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative',
  },
  actionCardHover: {
    borderColor: ACCENT_COLOR,
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
  },
  actionCardDisabled: {
    opacity: 0.5,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: COLORS.text,
    marginBottom: '4px',
  },
  cardId: {
    fontSize: '11px',
    color: COLORS.textDim,
    fontFamily: 'monospace',
    backgroundColor: COLORS.bgDark,
    padding: '2px 6px',
    borderRadius: '4px',
  },
  cardDesc: {
    fontSize: '13px',
    color: COLORS.textMuted,
    marginTop: '8px',
    lineHeight: 1.4,
  },
  cardBadges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '12px',
  },
  badge: {
    fontSize: '10px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  badgeActor: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
  },
  badgeTarget: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    color: '#c084fc',
  },
  badgePressure: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#fbbf24',
  },
  enableToggle: {
    width: '36px',
    height: '20px',
    borderRadius: '10px',
    backgroundColor: '#374151',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background-color 0.2s',
    flexShrink: 0,
  },
  enableToggleOn: {
    backgroundColor: COLORS.success,
  },
  toggleKnob: {
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    transition: 'transform 0.2s',
  },
  toggleKnobOn: {
    transform: 'translateX(16px)',
  },
  addCard: {
    backgroundColor: 'transparent',
    borderRadius: '12px',
    border: `2px dashed ${COLORS.border}`,
    padding: '40px 20px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: COLORS.textDim,
    minHeight: '140px',
  },
  addCardHover: {
    borderColor: ACCENT_COLOR,
    color: ACCENT_COLOR,
  },

  // Modal
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: COLORS.bgCard,
    borderRadius: '16px',
    border: `1px solid ${COLORS.border}`,
    width: '90vw',
    maxWidth: '900px',
    height: '80vh',
    maxHeight: '700px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.bgDark,
  },
  modalTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '18px',
    fontWeight: 600,
    color: COLORS.text,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: COLORS.textDim,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'all 0.15s',
  },
  modalBody: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  tabSidebar: {
    width: '200px',
    backgroundColor: COLORS.bgDark,
    borderRight: `1px solid ${COLORS.border}`,
    padding: '16px 12px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    overflowY: 'auto',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    fontSize: '14px',
    fontWeight: 500,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'left',
    width: '100%',
    backgroundColor: 'transparent',
    color: COLORS.textMuted,
  },
  tabBtnActive: {
    background: ACCENT_GRADIENT,
    color: COLORS.bgDark,
  },
  tabIcon: {
    fontSize: '16px',
  },
  tabContent: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    backgroundColor: COLORS.bg,
  },

  // Sections
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.text,
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionDesc: {
    fontSize: '13px',
    color: COLORS.textMuted,
    marginBottom: '16px',
    lineHeight: 1.5,
  },
  infoBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
  },
  infoBoxTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: COLORS.textDim,
    marginBottom: '4px',
  },
  infoBoxText: {
    fontSize: '13px',
    color: COLORS.textMuted,
    lineHeight: 1.5,
  },

  // Form elements
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formGroupWide: {
    gridColumn: '1 / -1',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: COLORS.textDim,
    textTransform: 'uppercase',
  },
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: COLORS.bgDark,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '6px',
    color: COLORS.text,
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  textarea: {
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: COLORS.bgDark,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '6px',
    color: COLORS.text,
    outline: 'none',
    resize: 'vertical',
    minHeight: '80px',
    fontFamily: 'inherit',
  },
  select: {
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: COLORS.bgDark,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '6px',
    color: COLORS.text,
    outline: 'none',
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    accentColor: ACCENT_COLOR,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: COLORS.text,
    cursor: 'pointer',
  },

  // Item cards
  itemCard: {
    backgroundColor: COLORS.bgDark,
    borderRadius: '10px',
    border: `1px solid ${COLORS.borderLight}`,
    marginBottom: '12px',
    overflow: 'hidden',
  },
  itemCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: COLORS.bgCard,
    cursor: 'pointer',
  },
  itemCardTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: COLORS.text,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  itemCardBody: {
    padding: '16px',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    color: COLORS.textDim,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'all 0.15s',
  },
  iconBtnDanger: {
    color: COLORS.danger,
  },

  // Chips
  chipContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    backgroundColor: COLORS.bgCard,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '16px',
    fontSize: '12px',
    color: COLORS.text,
  },
  chipActive: {
    backgroundColor: `${ACCENT_COLOR}30`,
    borderColor: ACCENT_COLOR,
    color: ACCENT_COLOR,
  },
  chipRemove: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    color: COLORS.textDim,
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },

  // Add button
  addItemBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '14px',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    border: `2px dashed ${COLORS.border}`,
    borderRadius: '10px',
    color: COLORS.textDim,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },

  // Delete button
  deleteBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: `1px solid ${COLORS.danger}`,
    borderRadius: '6px',
    color: COLORS.danger,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },

  // Empty state
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
    color: COLORS.textDim,
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 500,
    marginBottom: '8px',
    color: COLORS.text,
  },
  emptyDesc: {
    fontSize: '14px',
    color: COLORS.textMuted,
    maxWidth: '400px',
  },

  // Slider
  slider: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    background: COLORS.bgCard,
    outline: 'none',
    accentColor: ACCENT_COLOR,
  },
  sliderValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: ACCENT_COLOR,
    marginLeft: '8px',
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
};

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

function ReferenceDropdown({ label, value, onChange, options, placeholder = 'Select...' }) {
  return (
    <div style={styles.formGroup}>
      <label style={styles.label}>{label}</label>
      <select
        style={styles.select}
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChipSelector({ label, selected = [], options, onChange, allowMultiple = true }) {
  const toggleChip = (value) => {
    if (allowMultiple) {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        onChange([...selected, value]);
      }
    } else {
      onChange([value]);
    }
  };

  return (
    <div style={styles.formGroup}>
      <label style={styles.label}>{label}</label>
      <div style={styles.chipContainer}>
        {options.map((opt) => (
          <div
            key={opt.value}
            style={{ ...styles.chip, ...(selected.includes(opt.value) ? styles.chipActive : {}), cursor: 'pointer' }}
            onClick={() => toggleChip(opt.value)}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function PressureChangesEditor({ value = {}, onChange, pressures }) {
  const entries = Object.entries(value);
  const usedPressures = new Set(Object.keys(value));
  const availablePressures = pressures.filter((p) => !usedPressures.has(p.id));

  const updatePressure = (pressureId, delta) => {
    const newValue = { ...value, [pressureId]: delta };
    onChange(newValue);
  };

  const removePressure = (pressureId) => {
    const newValue = { ...value };
    delete newValue[pressureId];
    onChange(newValue);
  };

  const addPressure = (pressureId) => {
    if (pressureId) {
      onChange({ ...value, [pressureId]: 0 });
    }
  };

  return (
    <div style={styles.formGroup}>
      <label style={styles.label}>Pressure Changes</label>
      {entries.map(([pressureId, delta]) => (
        <div key={pressureId} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ flex: 1, fontSize: '13px', color: COLORS.text }}>{pressureId}</span>
          <input
            type="number"
            value={delta}
            onChange={(e) => updatePressure(pressureId, parseInt(e.target.value) || 0)}
            style={{ ...styles.input, width: '80px' }}
          />
          <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={() => removePressure(pressureId)}>
            ×
          </button>
        </div>
      ))}
      {availablePressures.length > 0 && (
        <select style={styles.select} value="" onChange={(e) => addPressure(e.target.value)}>
          <option value="">+ Add pressure change...</option>
          {availablePressures.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || p.id}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================

function OverviewTab({ action, onChange, onDelete }) {
  const updateAction = (field, value) => {
    onChange({ ...action, [field]: value });
  };

  const isEnabled = action.enabled !== false;

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>📋 Basic Information</div>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>ID</label>
            <input
              type="text"
              value={action.id || ''}
              onChange={(e) => updateAction('id', e.target.value)}
              style={styles.input}
              placeholder="unique_action_id"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Name</label>
            <input
              type="text"
              value={action.name || ''}
              onChange={(e) => updateAction('name', e.target.value)}
              style={styles.input}
              placeholder="Action Name"
            />
          </div>
          <div style={{ ...styles.formGroup, ...styles.formGroupWide }}>
            <label style={styles.label}>Description</label>
            <textarea
              value={action.description || ''}
              onChange={(e) => updateAction('description', e.target.value)}
              style={styles.textarea}
              placeholder="What does this action do?"
            />
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>⚙️ Status</div>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => updateAction('enabled', e.target.checked)}
            style={styles.checkbox}
          />
          Action Enabled
        </label>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>🗑️ Danger Zone</div>
        <button style={styles.deleteBtn} onClick={onDelete}>
          Delete Action
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// ACTOR TAB
// ============================================================================

function ActorTab({ action, onChange, schema }) {
  const actor = action.actor || {};

  const updateActor = (field, value) => {
    onChange({
      ...action,
      actor: { ...actor, [field]: value },
    });
  };

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.kind,
  }));

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const subtypeOptions = (schema?.subtypes || []).map((st) => ({
    value: st,
    label: st,
  }));

  // Get required relationships
  const requiredRelationships = actor.requiredRelationships || [];
  const addRequiredRel = (kind) => {
    if (kind && !requiredRelationships.includes(kind)) {
      updateActor('requiredRelationships', [...requiredRelationships, kind]);
    }
  };
  const removeRequiredRel = (kind) => {
    updateActor('requiredRelationships', requiredRelationships.filter((r) => r !== kind));
  };

  return (
    <div>
      <div style={styles.infoBox}>
        <div style={styles.infoBoxTitle}>Actor Requirements</div>
        <div style={styles.infoBoxText}>
          Define which entities can perform this action. Actors must match all specified criteria.
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>🎭 Entity Requirements</div>
        <ChipSelector
          label="Actor Kinds"
          selected={actor.kinds || []}
          options={entityKindOptions}
          onChange={(v) => updateActor('kinds', v.length > 0 ? v : undefined)}
        />

        <div style={{ marginTop: '16px' }}>
          <ChipSelector
            label="Subtypes (optional)"
            selected={actor.subtypes || []}
            options={subtypeOptions}
            onChange={(v) => updateActor('subtypes', v.length > 0 ? v : undefined)}
          />
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>⭐ Prominence</div>
        <ReferenceDropdown
          label="Minimum Prominence"
          value={actor.minProminence}
          onChange={(v) => updateActor('minProminence', v)}
          options={PROMINENCE_LEVELS}
          placeholder="Any prominence"
        />
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>🔗 Required Relationships</div>
        <div style={styles.sectionDesc}>
          Actor must have at least one of these relationship types to perform this action.
        </div>
        <div style={styles.chipContainer}>
          {requiredRelationships.map((rel) => (
            <div key={rel} style={styles.chip}>
              {rel}
              <button style={styles.chipRemove} onClick={() => removeRequiredRel(rel)}>
                ×
              </button>
            </div>
          ))}
        </div>
        <select
          style={{ ...styles.select, marginTop: '8px' }}
          value=""
          onChange={(e) => addRequiredRel(e.target.value)}
        >
          <option value="">+ Add required relationship...</option>
          {relationshipKindOptions
            .filter((rk) => !requiredRelationships.includes(rk.value))
            .map((rk) => (
              <option key={rk.value} value={rk.value}>
                {rk.label}
              </option>
            ))}
        </select>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>📊 Required Pressures</div>
        <div style={styles.sectionDesc}>
          Minimum pressure levels required for this action to be available.
        </div>
        <PressureRequirementsEditor
          value={actor.requiredPressures || {}}
          onChange={(v) => updateActor('requiredPressures', Object.keys(v).length > 0 ? v : undefined)}
        />
      </div>
    </div>
  );
}

function PressureRequirementsEditor({ value = {}, onChange }) {
  const entries = Object.entries(value);

  const updatePressure = (pressureId, min) => {
    onChange({ ...value, [pressureId]: min });
  };

  const removePressure = (pressureId) => {
    const newValue = { ...value };
    delete newValue[pressureId];
    onChange(newValue);
  };

  const addPressure = () => {
    const id = `pressure_${Date.now()}`;
    onChange({ ...value, [id]: 0 });
  };

  return (
    <div>
      {entries.map(([pressureId, minValue]) => (
        <div key={pressureId} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            value={pressureId}
            onChange={(e) => {
              const newValue = { ...value };
              delete newValue[pressureId];
              newValue[e.target.value] = minValue;
              onChange(newValue);
            }}
            style={{ ...styles.input, flex: 1 }}
            placeholder="Pressure ID"
          />
          <span style={{ color: COLORS.textMuted, fontSize: '12px' }}>≥</span>
          <input
            type="number"
            value={minValue}
            onChange={(e) => updatePressure(pressureId, parseInt(e.target.value) || 0)}
            style={{ ...styles.input, width: '80px' }}
          />
          <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={() => removePressure(pressureId)}>
            ×
          </button>
        </div>
      ))}
      <button className="ae-add-item-btn" style={styles.addItemBtn} onClick={addPressure}>
        + Add Pressure Requirement
      </button>
    </div>
  );
}

// ============================================================================
// RESOLUTION TAB
// ============================================================================

function ResolutionTab({ action, onChange, schema }) {
  const resolution = action.actorResolution || { type: 'self' };

  const updateResolution = (field, value) => {
    onChange({
      ...action,
      actorResolution: { ...resolution, [field]: value },
    });
  };

  const setResolutionType = (type) => {
    if (type === 'self') {
      onChange({ ...action, actorResolution: { type: 'self' } });
    } else {
      onChange({
        ...action,
        actorResolution: {
          type: 'via_relationship',
          relationshipKind: '',
          targetKind: '',
        },
      });
    }
  };

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.kind,
  }));

  const subtypeOptions = (schema?.subtypes || []).map((st) => ({
    value: st,
    label: st,
  }));

  return (
    <div>
      <div style={styles.infoBox}>
        <div style={styles.infoBoxTitle}>Actor Resolution</div>
        <div style={styles.infoBoxText}>
          How the actor resolves for the action. "Self" means the actor acts directly.
          "Via Relationship" means the actor is resolved through a relationship to another entity.
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>🔍 Resolution Type</div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {RESOLUTION_TYPES.map((rt) => (
            <div
              key={rt.value}
              className="ae-resolution-card"
              style={{
                ...styles.itemCard,
                padding: '16px',
                cursor: 'pointer',
                borderColor: resolution.type === rt.value ? ACCENT_COLOR : COLORS.border,
                backgroundColor: resolution.type === rt.value ? `${ACCENT_COLOR}15` : COLORS.bgDark,
              }}
              onClick={() => setResolutionType(rt.value)}
            >
              <div style={{ fontWeight: 600, color: COLORS.text, marginBottom: '4px' }}>{rt.label}</div>
              <div style={{ fontSize: '12px', color: COLORS.textMuted }}>{rt.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {resolution.type === 'via_relationship' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>🔗 Relationship Configuration</div>
          <div style={styles.formGrid}>
            <ReferenceDropdown
              label="Relationship Kind"
              value={resolution.relationshipKind}
              onChange={(v) => updateResolution('relationshipKind', v)}
              options={relationshipKindOptions}
              placeholder="Select relationship..."
            />
            <ReferenceDropdown
              label="Target Kind"
              value={resolution.targetKind}
              onChange={(v) => updateResolution('targetKind', v)}
              options={entityKindOptions}
              placeholder="Select entity kind..."
            />
            <ReferenceDropdown
              label="Require Subtype"
              value={resolution.requireSubtype}
              onChange={(v) => updateResolution('requireSubtype', v)}
              options={subtypeOptions}
              placeholder="Any subtype"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TARGETING TAB
// ============================================================================

function TargetingTab({ action, onChange, schema }) {
  const targeting = action.targeting || {};

  const updateTargeting = (field, value) => {
    onChange({
      ...action,
      targeting: { ...targeting, [field]: value },
    });
  };

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.kind,
  }));

  const statusOptions = (schema?.statuses || []).map((s) => ({
    value: s,
    label: s,
  }));

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const subtypeOptions = (schema?.subtypes || []).map((st) => ({
    value: st,
    label: st,
  }));

  // Exclude config
  const exclude = targeting.exclude || {};
  const updateExclude = (field, value) => {
    const newExclude = { ...exclude, [field]: value };
    if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
      delete newExclude[field];
    }
    updateTargeting('exclude', Object.keys(newExclude).length > 0 ? newExclude : undefined);
  };

  // Require config
  const require = targeting.require || {};
  const updateRequire = (field, value) => {
    const newRequire = { ...require, [field]: value };
    if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
      delete newRequire[field];
    }
    updateTargeting('require', Object.keys(newRequire).length > 0 ? newRequire : undefined);
  };

  return (
    <div>
      <div style={styles.infoBox}>
        <div style={styles.infoBoxTitle}>Target Selection</div>
        <div style={styles.infoBoxText}>
          Define how valid targets are selected for this action. Targets must match kind, status,
          and other filters.
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>🎯 Basic Selection</div>
        <div style={styles.formGrid}>
          <ReferenceDropdown
            label="Target Kind"
            value={targeting.kind}
            onChange={(v) => updateTargeting('kind', v)}
            options={entityKindOptions}
            placeholder="Select entity kind..."
          />
          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={targeting.selectTwo || false}
                onChange={(e) => updateTargeting('selectTwo', e.target.checked || undefined)}
                style={styles.checkbox}
              />
              Select Two Targets
            </label>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={targeting.excludeSelf || false}
                onChange={(e) => updateTargeting('excludeSelf', e.target.checked || undefined)}
                style={styles.checkbox}
              />
              Exclude Self
            </label>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <ChipSelector
            label="Statuses (optional)"
            selected={targeting.statuses || []}
            options={statusOptions}
            onChange={(v) => updateTargeting('statuses', v.length > 0 ? v : undefined)}
          />
        </div>

        <div style={{ marginTop: '16px' }}>
          <ChipSelector
            label="Subtypes (optional)"
            selected={targeting.subtypes || []}
            options={subtypeOptions}
            onChange={(v) => updateTargeting('subtypes', v.length > 0 ? v : undefined)}
          />
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>🚫 Exclusion Filter</div>
        <div style={styles.sectionDesc}>
          Exclude targets that have certain existing relationships.
        </div>
        <ExistingRelationshipEditor
          value={exclude.existingRelationship}
          onChange={(v) => updateExclude('existingRelationship', v)}
          relationshipKindOptions={relationshipKindOptions}
        />
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>✓ Requirements</div>
        <div style={styles.sectionDesc}>
          Requirements that targets must satisfy.
        </div>

        <div style={styles.itemCard}>
          <div style={styles.itemCardHeader}>
            <div style={styles.itemCardTitle}>Has Relationship</div>
          </div>
          <div style={styles.itemCardBody}>
            <ExistingRelationshipEditor
              value={require.hasRelationship}
              onChange={(v) => updateRequire('hasRelationship', v)}
              relationshipKindOptions={relationshipKindOptions}
              showActorRefs
            />
          </div>
        </div>

        <div style={styles.itemCard}>
          <div style={styles.itemCardHeader}>
            <div style={styles.itemCardTitle}>Adjacent To</div>
          </div>
          <div style={styles.itemCardBody}>
            <AdjacentToEditor
              value={require.adjacentTo}
              onChange={(v) => updateRequire('adjacentTo', v)}
              relationshipKindOptions={relationshipKindOptions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExistingRelationshipEditor({ value, onChange, relationshipKindOptions, showActorRefs = false }) {
  const config = value || {};

  const updateConfig = (field, val) => {
    const newConfig = { ...config, [field]: val };
    if (!val) delete newConfig[field];
    onChange(Object.keys(newConfig).length > 0 ? newConfig : undefined);
  };

  return (
    <div style={styles.formGrid}>
      <ReferenceDropdown
        label="Relationship Kind"
        value={config.kind}
        onChange={(v) => updateConfig('kind', v)}
        options={relationshipKindOptions}
        placeholder="Select relationship..."
      />
      <ReferenceDropdown
        label="Direction"
        value={config.direction}
        onChange={(v) => updateConfig('direction', v)}
        options={DIRECTIONS}
        placeholder="Any direction"
      />
      {showActorRefs && (
        <>
          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={config.fromResolvedActor || false}
                onChange={(e) => updateConfig('fromResolvedActor', e.target.checked || undefined)}
                style={styles.checkbox}
              />
              From Resolved Actor
            </label>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={config.toActor || false}
                onChange={(e) => updateConfig('toActor', e.target.checked || undefined)}
                style={styles.checkbox}
              />
              To Actor
            </label>
          </div>
        </>
      )}
    </div>
  );
}

function AdjacentToEditor({ value, onChange, relationshipKindOptions }) {
  const config = value || {};

  const updateConfig = (field, val) => {
    const newConfig = { ...config, [field]: val };
    if (!val) delete newConfig[field];
    onChange(Object.keys(newConfig).length > 0 ? newConfig : undefined);
  };

  return (
    <div style={styles.formGrid}>
      <ReferenceDropdown
        label="Relationship Kind"
        value={config.relationshipKind}
        onChange={(v) => updateConfig('relationshipKind', v)}
        options={relationshipKindOptions}
        placeholder="e.g., adjacent_to"
      />
      <div style={styles.formGroup}>
        <label style={styles.label}>Actor Controls Via</label>
        <input
          type="text"
          value={config.actorControlsVia || ''}
          onChange={(e) => updateConfig('actorControlsVia', e.target.value || undefined)}
          style={styles.input}
          placeholder="e.g., controls"
        />
      </div>
      <div style={styles.formGroup}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={config.toResolvedActor || false}
            onChange={(e) => updateConfig('toResolvedActor', e.target.checked || undefined)}
            style={styles.checkbox}
          />
          To Resolved Actor
        </label>
      </div>
    </div>
  );
}

// ============================================================================
// OUTCOME TAB
// ============================================================================

function OutcomeTab({ action, onChange, schema, pressures }) {
  const outcome = action.outcome || {};

  const updateOutcome = (field, value) => {
    onChange({
      ...action,
      outcome: { ...outcome, [field]: value },
    });
  };

  const relationships = outcome.relationships || [];
  const strengthenRelationships = outcome.strengthenRelationships || [];

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const addRelationship = () => {
    updateOutcome('relationships', [
      ...relationships,
      { kind: '', src: 'actor', dst: 'target', strength: 0.5 },
    ]);
  };

  const updateRelationship = (index, rel) => {
    const newRels = [...relationships];
    newRels[index] = rel;
    updateOutcome('relationships', newRels);
  };

  const removeRelationship = (index) => {
    updateOutcome('relationships', relationships.filter((_, i) => i !== index));
  };

  const addStrengthen = () => {
    updateOutcome('strengthenRelationships', [
      ...strengthenRelationships,
      { kind: '', amount: 0.1 },
    ]);
  };

  const updateStrengthen = (index, item) => {
    const newItems = [...strengthenRelationships];
    newItems[index] = item;
    updateOutcome('strengthenRelationships', newItems);
  };

  const removeStrengthen = (index) => {
    updateOutcome('strengthenRelationships', strengthenRelationships.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div style={styles.infoBox}>
        <div style={styles.infoBoxTitle}>Action Outcome</div>
        <div style={styles.infoBoxText}>
          Define what happens when this action succeeds. Create relationships, modify pressures,
          or strengthen existing connections.
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>🔗 Create Relationships ({relationships.length})</div>
        {relationships.map((rel, index) => (
          <div key={index} style={styles.itemCard}>
            <div style={styles.itemCardBody}>
              <div style={styles.formGrid}>
                <ReferenceDropdown
                  label="Kind"
                  value={rel.kind}
                  onChange={(v) => updateRelationship(index, { ...rel, kind: v })}
                  options={relationshipKindOptions}
                />
                <ReferenceDropdown
                  label="Source"
                  value={rel.src}
                  onChange={(v) => updateRelationship(index, { ...rel, src: v })}
                  options={RELATIONSHIP_REFS}
                />
                <ReferenceDropdown
                  label="Destination"
                  value={rel.dst}
                  onChange={(v) => updateRelationship(index, { ...rel, dst: v })}
                  options={RELATIONSHIP_REFS}
                />
                <div style={styles.formGroup}>
                  <label style={styles.label}>Strength</label>
                  <input
                    type="number"
                    value={rel.strength ?? ''}
                    onChange={(e) => updateRelationship(index, { ...rel, strength: parseFloat(e.target.value) || 0 })}
                    style={styles.input}
                    step="0.1"
                    min="0"
                    max="1"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={rel.bidirectional || false}
                      onChange={(e) => updateRelationship(index, { ...rel, bidirectional: e.target.checked || undefined })}
                      style={styles.checkbox}
                    />
                    Bidirectional
                  </label>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={() => removeRelationship(index)}>
                    ×
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        <button className="ae-add-item-btn" style={styles.addItemBtn} onClick={addRelationship}>
          + Add Relationship
        </button>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>💪 Strengthen Relationships ({strengthenRelationships.length})</div>
        <div style={styles.sectionDesc}>
          Increase strength of existing relationships.
        </div>
        {strengthenRelationships.map((item, index) => (
          <div key={index} style={styles.itemCard}>
            <div style={styles.itemCardBody}>
              <div style={styles.formGrid}>
                <ReferenceDropdown
                  label="Kind"
                  value={item.kind}
                  onChange={(v) => updateStrengthen(index, { ...item, kind: v })}
                  options={relationshipKindOptions}
                />
                <div style={styles.formGroup}>
                  <label style={styles.label}>Amount</label>
                  <input
                    type="number"
                    value={item.amount ?? ''}
                    onChange={(e) => updateStrengthen(index, { ...item, amount: parseFloat(e.target.value) || 0 })}
                    style={styles.input}
                    step="0.05"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={() => removeStrengthen(index)}>
                    ×
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        <button className="ae-add-item-btn" style={styles.addItemBtn} onClick={addStrengthen}>
          + Add Strengthen Rule
        </button>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>📊 Pressure Changes</div>
        <PressureChangesEditor
          value={outcome.pressureChanges || {}}
          onChange={(v) => updateOutcome('pressureChanges', Object.keys(v).length > 0 ? v : undefined)}
          pressures={pressures}
        />
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>📝 Description Template</div>
        <div style={styles.sectionDesc}>
          Template for generating occurrence descriptions. Use {'{target.name}'}, {'{resolved_actor.name}'}, etc.
        </div>
        <textarea
          value={outcome.descriptionTemplate || ''}
          onChange={(e) => updateOutcome('descriptionTemplate', e.target.value || undefined)}
          style={styles.textarea}
          placeholder="e.g., declared war on {target.name}"
        />
      </div>
    </div>
  );
}

// ============================================================================
// PROBABILITY TAB
// ============================================================================

function ProbabilityTab({ action, onChange, pressures }) {
  const probability = action.probability || {};

  const updateProbability = (field, value) => {
    onChange({
      ...action,
      probability: { ...probability, [field]: value },
    });
  };

  const pressureModifiers = probability.pressureModifiers || [];
  const availablePressures = (pressures || []).filter((p) => !pressureModifiers.includes(p.id));

  const addPressureModifier = (id) => {
    if (id && !pressureModifiers.includes(id)) {
      updateProbability('pressureModifiers', [...pressureModifiers, id]);
    }
  };

  const removePressureModifier = (id) => {
    updateProbability('pressureModifiers', pressureModifiers.filter((p) => p !== id));
  };

  const baseSuccessChance = probability.baseSuccessChance ?? 0.5;
  const baseWeight = probability.baseWeight ?? 1.0;

  return (
    <div>
      <div style={styles.infoBox}>
        <div style={styles.infoBoxTitle}>Probability Configuration</div>
        <div style={styles.infoBoxText}>
          Control how likely this action is to be selected and succeed. Pressure modifiers
          dynamically adjust probability based on world state.
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>🎯 Base Success Chance</div>
        <div style={styles.sectionDesc}>
          Probability that this action succeeds when attempted.
        </div>
        <div style={styles.sliderRow}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={baseSuccessChance}
            onChange={(e) => updateProbability('baseSuccessChance', parseFloat(e.target.value))}
            style={styles.slider}
          />
          <span style={styles.sliderValue}>{(baseSuccessChance * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>⚖️ Base Weight</div>
        <div style={styles.sectionDesc}>
          Relative weight for action selection. Higher weight means more likely to be chosen.
        </div>
        <div style={styles.formGroup}>
          <input
            type="number"
            value={baseWeight}
            onChange={(e) => updateProbability('baseWeight', parseFloat(e.target.value) || 1.0)}
            style={styles.input}
            step="0.1"
            min="0"
          />
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>📊 Pressure Modifiers ({pressureModifiers.length})</div>
        <div style={styles.sectionDesc}>
          Pressures that affect the probability of this action. Higher pressure values increase
          the likelihood of this action being selected.
        </div>
        <div style={styles.chipContainer}>
          {pressureModifiers.map((p) => (
            <div key={p} style={styles.chip}>
              {p}
              <button style={styles.chipRemove} onClick={() => removePressureModifier(p)}>
                ×
              </button>
            </div>
          ))}
        </div>
        <select
          style={{ ...styles.select, marginTop: '8px' }}
          value=""
          onChange={(e) => addPressureModifier(e.target.value)}
        >
          <option value="">+ Add pressure modifier...</option>
          {availablePressures.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || p.id}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ============================================================================
// ACTION MODAL
// ============================================================================

function ActionModal({ action, onChange, onClose, onDelete, schema, pressures }) {
  const [activeTab, setActiveTab] = useState('overview');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab action={action} onChange={onChange} onDelete={onDelete} />;
      case 'actor':
        return <ActorTab action={action} onChange={onChange} schema={schema} />;
      case 'resolution':
        return <ResolutionTab action={action} onChange={onChange} schema={schema} />;
      case 'targeting':
        return <TargetingTab action={action} onChange={onChange} schema={schema} />;
      case 'outcome':
        return <OutcomeTab action={action} onChange={onChange} schema={schema} pressures={pressures} />;
      case 'probability':
        return <ProbabilityTab action={action} onChange={onChange} pressures={pressures} />;
      default:
        return null;
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>
            <span style={{ fontSize: '20px' }}>🎭</span>
            <span>{action.name || action.id}</span>
            {action.enabled === false && (
              <span style={{ fontSize: '11px', padding: '3px 8px', backgroundColor: 'rgba(107, 114, 128, 0.3)', color: '#9ca3af', borderRadius: '4px' }}>
                Disabled
              </span>
            )}
          </div>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.modalBody}>
          <div style={styles.tabSidebar}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`ae-tab-btn ${activeTab === tab.id ? 'ae-tab-btn-active' : ''}`}
                style={{ ...styles.tabBtn, ...(activeTab === tab.id ? styles.tabBtnActive : {}) }}
                onClick={() => setActiveTab(tab.id)}
              >
                <span style={styles.tabIcon}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          <div style={styles.tabContent}>{renderTabContent()}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function ActionListCard({ action, onClick, onToggle, usageMap }) {
  const [hovering, setHovering] = useState(false);
  const isEnabled = action.enabled !== false;
  const pressureMods = action.probability?.pressureModifiers || [];

  // Get validation info
  const validation = useMemo(() =>
    usageMap ? getElementValidation(usageMap, 'action', action.id) : { invalidRefs: [], compatibility: [], isOrphan: false },
    [usageMap, action.id]
  );

  const hasErrors = validation.invalidRefs.length > 0;
  const hasCompatibilityIssues = validation.compatibility?.length > 0;

  const formatActorKinds = () => {
    if (!action.actor?.kinds) return 'any';
    return action.actor.kinds.join(', ');
  };

  const formatTargetKind = () => {
    if (!action.targeting?.kind) return 'none';
    return action.targeting.kind;
  };

  return (
    <div
      style={{
        ...styles.actionCard,
        ...(hovering ? styles.actionCardHover : {}),
        ...(isEnabled ? {} : styles.actionCardDisabled),
        ...(hasErrors ? validationStyles.invalidBorder : {}),
        ...(hasCompatibilityIssues && !hasErrors ? validationStyles.warningBorder : {}),
      }}
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div style={styles.cardHeader}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={styles.cardTitle}>{action.name || action.id}</span>
            {hasErrors && (
              <span style={{ ...validationStyles.validationBadge, ...validationStyles.errorBadge, marginLeft: 0 }}>
                {validation.invalidRefs.length} error{validation.invalidRefs.length !== 1 ? 's' : ''}
              </span>
            )}
            {hasCompatibilityIssues && !hasErrors && (
              <span style={{ ...validationStyles.validationBadge, ...validationStyles.compatibilityBadge, marginLeft: 0 }}>
                {validation.compatibility.length} warning{validation.compatibility.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={styles.cardId}>{action.id}</div>
        </div>
        <div
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{ ...styles.enableToggle, ...(isEnabled ? styles.enableToggleOn : {}) }}
        >
          <div style={{ ...styles.toggleKnob, ...(isEnabled ? styles.toggleKnobOn : {}) }} />
        </div>
      </div>

      <div style={styles.cardBadges}>
        <span style={{ ...styles.badge, ...styles.badgeActor }}>
          {formatActorKinds()}
        </span>
        <span style={{ ...styles.badge, ...styles.badgeTarget }}>
          → {formatTargetKind()}
        </span>
        {pressureMods.length > 0 && (
          <span style={{ ...styles.badge, ...styles.badgePressure }}>
            {pressureMods.length} pressure{pressureMods.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {action.description && (
        <div style={styles.cardDesc}>{action.description}</div>
      )}
    </div>
  );
}

export default function ActionsEditor({ actions = [], onChange, schema, pressures = [], usageMap }) {
  useHoverStyles();
  const [selectedAction, setSelectedAction] = useState(null);
  const [addHovering, setAddHovering] = useState(false);

  const handleActionChange = useCallback((updated) => {
    const index = actions.findIndex((a) => a.id === selectedAction.id);
    if (index >= 0) {
      const newActions = [...actions];
      newActions[index] = updated;
      onChange(newActions);
      setSelectedAction(updated);
    }
  }, [actions, onChange, selectedAction]);

  const handleToggle = useCallback((action) => {
    const index = actions.findIndex((a) => a.id === action.id);
    if (index >= 0) {
      const newActions = [...actions];
      newActions[index] = { ...action, enabled: action.enabled === false ? true : false };
      onChange(newActions);
    }
  }, [actions, onChange]);

  const handleDelete = useCallback(() => {
    if (selectedAction && confirm(`Delete action "${selectedAction.name || selectedAction.id}"?`)) {
      onChange(actions.filter((a) => a.id !== selectedAction.id));
      setSelectedAction(null);
    }
  }, [actions, onChange, selectedAction]);

  const handleAddAction = useCallback(() => {
    const newAction = {
      id: `action_${Date.now()}`,
      name: 'New Action',
      description: '',
      actor: { kinds: ['npc'] },
      actorResolution: { type: 'self' },
      targeting: { kind: 'npc' },
      outcome: {},
      probability: {
        baseSuccessChance: 0.5,
        baseWeight: 1.0,
        pressureModifiers: [],
      },
    };
    onChange([...actions, newAction]);
    setSelectedAction(newAction);
  }, [actions, onChange]);

  // Collect unique pressures across all actions
  const uniquePressures = new Set();
  actions.forEach(action => {
    (action.probability?.pressureModifiers || []).forEach(p => uniquePressures.add(p));
  });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Actions</h1>
        <p style={styles.subtitle}>
          Actions define what agents can do during the simulation via the universal catalyst system. Click an action to edit.
        </p>
        <div style={styles.stats}>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Total Actions</span>
            <span style={styles.statValue}>{actions.length}</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Pressures Referenced</span>
            <span style={styles.statValue}>{uniquePressures.size}</span>
          </div>
        </div>
      </div>

      <div style={styles.actionGrid}>
        {actions.map((action) => (
          <ActionListCard
            key={action.id}
            action={action}
            onClick={() => setSelectedAction(action)}
            onToggle={() => handleToggle(action)}
            usageMap={usageMap}
          />
        ))}

        <div
          style={{ ...styles.addCard, ...(addHovering ? styles.addCardHover : {}) }}
          onClick={handleAddAction}
          onMouseEnter={() => setAddHovering(true)}
          onMouseLeave={() => setAddHovering(false)}
        >
          <span style={{ fontSize: '24px' }}>+</span>
          <span>Add Action</span>
        </div>
      </div>

      {selectedAction && (
        <ActionModal
          action={selectedAction}
          onChange={handleActionChange}
          onClose={() => setSelectedAction(null)}
          onDelete={handleDelete}
          schema={schema}
          pressures={pressures}
        />
      )}
    </div>
  );
}
