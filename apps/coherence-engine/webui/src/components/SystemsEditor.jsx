/**
 * SystemsEditor v2 - Visual builder with tabbed modal
 *
 * System Types:
 * - eraSpawner: Creates era entities at simulation start
 * - eraTransition: Handles era progression
 * - universalCatalyst: Agent actions system
 * - relationshipMaintenance: Relationship decay/reinforcement
 * - graphContagion: Spreads states through network connections
 * - connectionEvolution: Relationship strength changes over time
 * - thresholdTrigger: Detects conditions and sets tags/pressures
 * - clusterFormation: Groups entities into meta-entities
 * - tagDiffusion: Tag spreading between connected entities
 * - planeDiffusion: Value diffusion across spatial plane
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { getElementValidation } from '../utils/schemaUsageMap';

// ============================================================================
// CSS HOVER STYLES (injected once)
// ============================================================================

const HOVER_STYLES_ID = 'systems-editor-hover-styles';

const hoverCSS = `
  .se-tab-btn:not(.se-tab-btn-active):hover {
    background-color: rgba(245, 158, 11, 0.15) !important;
  }
  .se-tab-btn:not(.se-tab-btn-active) {
    background-color: transparent !important;
  }
  .se-add-item-btn:hover {
    border-color: #f59e0b !important;
    color: #f59e0b !important;
  }
  .se-add-item-btn {
    border-color: rgba(59, 130, 246, 0.3) !important;
    color: #60a5fa !important;
  }
  .se-type-option:hover {
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
  orphanBadge: {
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    color: '#9ca3af',
  },
  eraBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#60a5fa',
    fontSize: '10px',
    padding: '3px 8px',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
};

const SYSTEM_TYPES = {
  eraSpawner: { label: 'Era Spawner', icon: '🕰️', color: '#fbbf24', desc: 'Creates era entities at simulation start' },
  eraTransition: { label: 'Era Transition', icon: '⏭️', color: '#fbbf24', desc: 'Handles era progression' },
  universalCatalyst: { label: 'Agent Actions', icon: '🎭', color: '#fbbf24', desc: 'Agent action system' },
  relationshipMaintenance: { label: 'Relationship Maintenance', icon: '🔧', color: '#60a5fa', desc: 'Relationship decay/reinforcement' },
  graphContagion: { label: 'Graph Contagion', icon: '🦠', color: '#f87171', desc: 'Spreads states through connections' },
  connectionEvolution: { label: 'Connection Evolution', icon: '🔗', color: '#60a5fa', desc: 'Relationship changes over time' },
  thresholdTrigger: { label: 'Threshold Trigger', icon: '⚡', color: '#4ade80', desc: 'Condition detection and actions' },
  clusterFormation: { label: 'Cluster Formation', icon: '🎯', color: '#c084fc', desc: 'Groups entities into meta-entities' },
  tagDiffusion: { label: 'Tag Diffusion', icon: '🏷️', color: '#f472b6', desc: 'Tag spreading between entities' },
  planeDiffusion: { label: 'Plane Diffusion', icon: '🌡️', color: '#38bdf8', desc: 'Value diffusion across space' },
};

const CLUSTER_MODES = [
  { value: 'individual', label: 'Individual', desc: 'Apply to each entity separately' },
  { value: 'by_relationship', label: 'By Relationship', desc: 'Group by relationship clusters' },
];

const DIRECTIONS = [
  { value: 'src', label: 'Source' },
  { value: 'dst', label: 'Destination' },
  { value: 'both', label: 'Both' },
];

const CONDITION_TYPES = [
  { value: 'relationship_count', label: 'Relationship Count' },
  { value: 'relationship_exists', label: 'Relationship Exists' },
  { value: 'time_since_update', label: 'Time Since Update' },
  { value: 'has_tag', label: 'Has Tag' },
  { value: 'has_any_tag', label: 'Has Any Tag' },
  { value: 'tag_absent', label: 'Tag Absent' },
];

const ACTION_TYPES = [
  { value: 'set_tag', label: 'Set Tag' },
  { value: 'set_cluster_tag', label: 'Set Cluster Tag' },
  { value: 'remove_tag', label: 'Remove Tag' },
  { value: 'create_relationship', label: 'Create Relationship' },
  { value: 'adjust_prominence', label: 'Adjust Prominence' },
];

const METRIC_TYPES = [
  { value: 'connection_count', label: 'Connection Count' },
  { value: 'shared_relationship', label: 'Shared Relationship' },
  { value: 'tagged_connection_count', label: 'Tagged Connection Count' },
];

const CLUSTERING_CRITERIA_TYPES = [
  { value: 'shared_relationship', label: 'Shared Relationship' },
  { value: 'same_culture', label: 'Same Culture' },
  { value: 'shared_tags', label: 'Shared Tags' },
  { value: 'temporal_proximity', label: 'Temporal Proximity' },
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
  systemGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  systemCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: '12px',
    border: `1px solid ${COLORS.border}`,
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative',
  },
  systemCardHover: {
    borderColor: ACCENT_COLOR,
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
  },
  systemCardDisabled: {
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
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '12px',
    fontWeight: 500,
  },
  typeBadge: {
    fontSize: '10px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: 600,
    textTransform: 'uppercase',
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
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },

  // Modal
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '24px',
  },
  modal: {
    backgroundColor: COLORS.bg,
    borderRadius: '16px',
    border: `1px solid ${COLORS.border}`,
    width: '100%',
    maxWidth: '1000px',
    height: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.5)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.bgDark,
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: COLORS.text,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  closeBtn: {
    padding: '8px',
    fontSize: '20px',
    backgroundColor: 'transparent',
    border: 'none',
    color: COLORS.textDim,
    cursor: 'pointer',
    borderRadius: '6px',
    lineHeight: 1,
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
  infoBoxCode: {
    fontFamily: 'monospace',
    backgroundColor: COLORS.bgDark,
    padding: '2px 6px',
    borderRadius: '4px',
    color: COLORS.purple,
  },

  // Form elements
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  formGroup: {
    marginBottom: '0',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: COLORS.textDim,
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: COLORS.bgDark,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    color: COLORS.text,
    boxSizing: 'border-box',
    outline: 'none',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: COLORS.bgDark,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    color: COLORS.text,
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    backgroundColor: COLORS.bgDark,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    color: COLORS.text,
    fontFamily: 'monospace',
    resize: 'vertical',
    minHeight: '80px',
    boxSizing: 'border-box',
  },

  // Buttons
  button: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    border: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  buttonPrimary: {
    background: ACCENT_GRADIENT,
    color: COLORS.bgDark,
  },
  buttonSecondary: {
    backgroundColor: COLORS.bgCard,
    color: COLORS.textMuted,
    border: `1px solid ${COLORS.border}`,
  },
  buttonDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: COLORS.danger,
    border: `1px solid rgba(239, 68, 68, 0.3)`,
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
    gap: '12px',
    padding: '14px 16px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  itemCardHeaderHover: {
    backgroundColor: COLORS.bgCard,
  },
  itemCardIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    flexShrink: 0,
  },
  itemCardInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemCardTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: COLORS.text,
    marginBottom: '2px',
  },
  itemCardSubtitle: {
    fontSize: '12px',
    color: COLORS.textMuted,
  },
  itemCardActions: {
    display: 'flex',
    gap: '4px',
  },
  iconBtn: {
    padding: '6px',
    fontSize: '14px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: COLORS.textDim,
    cursor: 'pointer',
  },
  iconBtnDanger: {
    color: COLORS.danger,
  },
  itemCardBody: {
    padding: '16px',
    borderTop: `1px solid ${COLORS.borderLight}`,
    backgroundColor: COLORS.bg,
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
    borderRadius: '6px',
    fontSize: '12px',
    color: COLORS.textMuted,
  },
  chipRemove: {
    background: 'none',
    border: 'none',
    color: COLORS.textDim,
    cursor: 'pointer',
    padding: 0,
    fontSize: '14px',
  },

  // Empty state
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    color: COLORS.textMuted,
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: 500,
    color: COLORS.text,
    marginBottom: '8px',
  },
  emptyDesc: {
    fontSize: '14px',
    marginBottom: '24px',
  },

  // Type picker
  typePicker: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  typeOption: {
    padding: '12px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.bgDark,
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'left',
  },
  typeOptionIcon: {
    fontSize: '20px',
    marginBottom: '6px',
  },
  typeOptionLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: COLORS.text,
    marginBottom: '2px',
  },
  typeOptionDesc: {
    fontSize: '11px',
    color: COLORS.textMuted,
  },

  // Pressure changes grid
  pressureGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  pressureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: COLORS.bgDark,
    borderRadius: '6px',
    padding: '8px 12px',
    border: `1px solid ${COLORS.borderLight}`,
  },
  pressureLabel: {
    fontSize: '12px',
    color: COLORS.textMuted,
    minWidth: '80px',
  },
  pressureInput: {
    width: '60px',
    padding: '4px 8px',
    fontSize: '13px',
    backgroundColor: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '4px',
    color: COLORS.text,
    textAlign: 'center',
  },
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function ReferenceDropdown({ value, onChange, options, placeholder, label, style }) {
  return (
    <div style={{ ...styles.formGroup, ...style }}>
      {label && <label style={styles.label}>{label}</label>}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        style={styles.select}
      >
        <option value="">{placeholder || 'Select...'}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label || opt.value}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChipSelect({ value = [], onChange, options, placeholder, label }) {
  const available = options.filter((opt) => !value.includes(opt.value));

  return (
    <div style={styles.formGroup}>
      {label && <label style={styles.label}>{label}</label>}
      <div style={{ ...styles.chipContainer, marginBottom: '8px' }}>
        {value.map((v) => (
          <span key={v} style={styles.chip}>
            {options.find((o) => o.value === v)?.label || v}
            <button style={styles.chipRemove} onClick={() => onChange(value.filter((x) => x !== v))}>×</button>
          </span>
        ))}
      </div>
      {available.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && onChange([...value, e.target.value])}
          style={{ ...styles.select, maxWidth: '200px' }}
        >
          <option value="">{placeholder || '+ Add...'}</option>
          {available.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>
          ))}
        </select>
      )}
    </div>
  );
}

function PressureChangesEditor({ value = {}, onChange, pressures }) {
  const entries = Object.entries(value);

  const addPressure = (pressureId) => {
    if (pressureId && !(pressureId in value)) {
      onChange({ ...value, [pressureId]: 0 });
    }
  };

  const updateDelta = (pressureId, delta) => {
    onChange({ ...value, [pressureId]: parseInt(delta) || 0 });
  };

  const removePressure = (pressureId) => {
    const newValue = { ...value };
    delete newValue[pressureId];
    onChange(newValue);
  };

  const availablePressures = (pressures || []).filter((p) => !(p.id in value));

  return (
    <div style={styles.formGroup}>
      <label style={styles.label}>Pressure Changes</label>
      <div style={styles.pressureGrid}>
        {entries.map(([pressureId, delta]) => (
          <div key={pressureId} style={styles.pressureItem}>
            <span style={styles.pressureLabel}>{pressureId}</span>
            <input
              type="number"
              value={delta}
              onChange={(e) => updateDelta(pressureId, e.target.value)}
              style={styles.pressureInput}
            />
            <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={() => removePressure(pressureId)}>×</button>
          </div>
        ))}
      </div>
      {availablePressures.length > 0 && (
        <select
          value=""
          onChange={(e) => addPressure(e.target.value)}
          style={{ ...styles.select, maxWidth: '200px', marginTop: '8px' }}
        >
          <option value="">+ Add pressure change...</option>
          {availablePressures.map((p) => (
            <option key={p.id} value={p.id}>{p.name || p.id}</option>
          ))}
        </select>
      )}
    </div>
  );
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================

function OverviewTab({ system, onChange, onDelete }) {
  const config = system.config || {};
  const typeConfig = SYSTEM_TYPES[system.systemType] || {};

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Basic Information</div>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>System ID</label>
            <input
              type="text"
              value={config.id || ''}
              onChange={(e) => updateConfig('id', e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Display Name</label>
            <input
              type="text"
              value={config.name || ''}
              onChange={(e) => updateConfig('name', e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Description</label>
            <textarea
              value={config.description || ''}
              onChange={(e) => updateConfig('description', e.target.value)}
              style={{ ...styles.textarea, minHeight: '60px' }}
              placeholder="Describe what this system does..."
            />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={styles.label}>System Type</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ ...styles.typeBadge, backgroundColor: `${typeConfig.color}30`, color: typeConfig.color }}>
              {typeConfig.icon} {typeConfig.label}
            </span>
            <span style={{ fontSize: '13px', color: COLORS.textMuted }}>{typeConfig.desc}</span>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={styles.label}>Enabled</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              onClick={() => onChange({ ...system, enabled: system.enabled === false ? true : false })}
              style={{ ...styles.enableToggle, ...(system.enabled !== false ? styles.enableToggleOn : {}) }}
            >
              <div style={{ ...styles.toggleKnob, ...(system.enabled !== false ? styles.toggleKnobOn : {}) }} />
            </div>
            <span style={{ fontSize: '13px', color: COLORS.textMuted }}>
              {system.enabled !== false ? 'System is active' : 'System is disabled'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: `1px solid ${COLORS.border}` }}>
        <button style={{ ...styles.button, ...styles.buttonDanger }} onClick={onDelete}>
          Delete System
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// COMMON SETTINGS TAB
// ============================================================================

function CommonSettingsTab({ system, onChange, schema, pressures }) {
  const config = system.config || {};

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

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Entity Filter</div>
        <div style={styles.sectionDesc}>
          Define which entities this system operates on.
        </div>

        <div style={styles.formGrid}>
          <ReferenceDropdown
            label="Entity Kind"
            value={config.entityKind}
            onChange={(v) => updateConfig('entityKind', v)}
            options={entityKindOptions}
            placeholder="All kinds"
          />
          {config.entityKind && (
            <ReferenceDropdown
              label="Entity Subtype"
              value={config.entitySubtype}
              onChange={(v) => updateConfig('entitySubtype', v)}
              options={[{ value: '', label: 'Any' }, ...getSubtypeOptions(config.entityKind)]}
            />
          )}
          {config.entityKind && (
            <ReferenceDropdown
              label="Entity Status"
              value={config.entityStatus}
              onChange={(v) => updateConfig('entityStatus', v)}
              options={[{ value: '', label: 'Any' }, ...getStatusOptions(config.entityKind)]}
            />
          )}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Throttling</div>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Throttle Chance (0-1)</label>
            <input
              type="number"
              value={config.throttleChance ?? ''}
              onChange={(e) => updateConfig('throttleChance', parseFloat(e.target.value) || undefined)}
              style={styles.input}
              step="0.1"
              min="0"
              max="1"
              placeholder="0.2"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Cooldown (ticks)</label>
            <input
              type="number"
              value={config.cooldown ?? ''}
              onChange={(e) => updateConfig('cooldown', parseInt(e.target.value) || undefined)}
              style={styles.input}
              min="0"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <PressureChangesEditor
          value={config.pressureChanges || {}}
          onChange={(v) => updateConfig('pressureChanges', Object.keys(v).length > 0 ? v : undefined)}
          pressures={pressures}
        />
      </div>
    </div>
  );
}

// ============================================================================
// GRAPH CONTAGION TAB
// ============================================================================

function GraphContagionTab({ system, onChange, schema }) {
  const config = system.config || {};

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const updateContagion = (field, value) => {
    updateConfig('contagion', { ...config.contagion, [field]: value });
  };

  const updateTransmission = (field, value) => {
    updateConfig('transmission', { ...config.transmission, [field]: value });
  };

  const updateInfectionAction = (field, value) => {
    updateConfig('infectionAction', { ...config.infectionAction, [field]: value });
  };

  // Vectors
  const vectors = config.vectors || [];

  const addVector = () => {
    updateConfig('vectors', [...vectors, { relationshipKind: '', direction: 'both', minStrength: 0.5 }]);
  };

  const updateVector = (index, field, value) => {
    const newVectors = [...vectors];
    newVectors[index] = { ...newVectors[index], [field]: value };
    updateConfig('vectors', newVectors);
  };

  const removeVector = (index) => {
    updateConfig('vectors', vectors.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🦠 Contagion Source</div>
        <div style={styles.sectionDesc}>
          What is being spread through the network.
        </div>
        <div style={styles.formGrid}>
          <ReferenceDropdown
            label="Type"
            value={config.contagion?.type || 'relationship'}
            onChange={(v) => updateContagion('type', v)}
            options={[
              { value: 'relationship', label: 'Relationship' },
              { value: 'tag', label: 'Tag' },
            ]}
          />
          {config.contagion?.type === 'relationship' && (
            <ReferenceDropdown
              label="Relationship Kind"
              value={config.contagion?.relationshipKind}
              onChange={(v) => updateContagion('relationshipKind', v)}
              options={relationshipKindOptions}
            />
          )}
          {config.contagion?.type === 'tag' && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Tag</label>
              <input
                type="text"
                value={config.contagion?.tag || ''}
                onChange={(e) => updateContagion('tag', e.target.value)}
                style={styles.input}
              />
            </div>
          )}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>↔️ Transmission Vectors ({vectors.length})</div>
        <div style={styles.sectionDesc}>
          Relationships through which the contagion spreads.
        </div>

        {vectors.map((vector, index) => (
          <div key={index} style={styles.itemCard}>
            <div style={{ padding: '16px' }}>
              <div style={styles.formGrid}>
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={vector.relationshipKind}
                  onChange={(v) => updateVector(index, 'relationshipKind', v)}
                  options={relationshipKindOptions}
                />
                <ReferenceDropdown
                  label="Direction"
                  value={vector.direction || 'both'}
                  onChange={(v) => updateVector(index, 'direction', v)}
                  options={DIRECTIONS}
                />
                <div style={styles.formGroup}>
                  <label style={styles.label}>Min Strength</label>
                  <input
                    type="number"
                    value={vector.minStrength ?? ''}
                    onChange={(e) => updateVector(index, 'minStrength', parseFloat(e.target.value) || undefined)}
                    style={styles.input}
                    step="0.1"
                    min="0"
                    max="1"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={() => removeVector(index)}>×</button>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          className="se-add-item-btn"
          style={styles.addItemBtn}
          onClick={addVector}
        >
          + Add Vector
        </button>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>📡 Transmission Rates</div>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Base Rate</label>
            <input
              type="number"
              value={config.transmission?.baseRate ?? ''}
              onChange={(e) => updateTransmission('baseRate', parseFloat(e.target.value) || undefined)}
              style={styles.input}
              step="0.05"
              min="0"
              max="1"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Contact Multiplier</label>
            <input
              type="number"
              value={config.transmission?.contactMultiplier ?? ''}
              onChange={(e) => updateTransmission('contactMultiplier', parseFloat(e.target.value) || undefined)}
              style={styles.input}
              step="0.05"
              min="0"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Max Probability</label>
            <input
              type="number"
              value={config.transmission?.maxProbability ?? ''}
              onChange={(e) => updateTransmission('maxProbability', parseFloat(e.target.value) || undefined)}
              style={styles.input}
              step="0.05"
              min="0"
              max="1"
            />
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>⚡ Infection Action</div>
        <div style={styles.sectionDesc}>
          What happens when an entity gets infected.
        </div>
        <div style={styles.formGrid}>
          <ReferenceDropdown
            label="Action Type"
            value={config.infectionAction?.type || 'create_relationship'}
            onChange={(v) => updateInfectionAction('type', v)}
            options={[
              { value: 'create_relationship', label: 'Create Relationship' },
              { value: 'set_tag', label: 'Set Tag' },
            ]}
          />
          {config.infectionAction?.type === 'create_relationship' && (
            <>
              <ReferenceDropdown
                label="Relationship Kind"
                value={config.infectionAction?.relationshipKind}
                onChange={(v) => updateInfectionAction('relationshipKind', v)}
                options={relationshipKindOptions}
              />
              <div style={styles.formGroup}>
                <label style={styles.label}>Strength</label>
                <input
                  type="number"
                  value={config.infectionAction?.strength ?? ''}
                  onChange={(e) => updateInfectionAction('strength', parseFloat(e.target.value) || undefined)}
                  style={styles.input}
                  step="0.1"
                  min="0"
                  max="1"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CONNECTION EVOLUTION TAB
// ============================================================================

function ConnectionEvolutionTab({ system, onChange, schema }) {
  const config = system.config || {};

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const updateMetric = (field, value) => {
    updateConfig('metric', { ...config.metric, [field]: value });
  };

  // Rules
  const rules = config.rules || [];

  const addRule = () => {
    updateConfig('rules', [...rules, {
      condition: { operator: '>=', threshold: 1 },
      probability: 0.1,
      action: { type: 'create_relationship', kind: '' },
    }]);
  };

  const updateRule = (index, rule) => {
    const newRules = [...rules];
    newRules[index] = rule;
    updateConfig('rules', newRules);
  };

  const removeRule = (index) => {
    updateConfig('rules', rules.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>📊 Metric</div>
        <div style={styles.sectionDesc}>
          How entities are measured for rule evaluation.
        </div>
        <div style={styles.formGrid}>
          <ReferenceDropdown
            label="Metric Type"
            value={config.metric?.type || 'connection_count'}
            onChange={(v) => updateMetric('type', v)}
            options={METRIC_TYPES}
          />
          <ReferenceDropdown
            label="Direction"
            value={config.metric?.direction || 'both'}
            onChange={(v) => updateMetric('direction', v)}
            options={DIRECTIONS}
          />
          {config.metric?.type === 'shared_relationship' && (
            <ReferenceDropdown
              label="Shared Relationship Kind"
              value={config.metric?.sharedRelationshipKind}
              onChange={(v) => updateMetric('sharedRelationshipKind', v)}
              options={relationshipKindOptions}
            />
          )}
          {config.metric?.type === 'tagged_connection_count' && (
            <>
              <ReferenceDropdown
                label="Relationship Kind"
                value={config.metric?.relationshipKind}
                onChange={(v) => updateMetric('relationshipKind', v)}
                options={relationshipKindOptions}
              />
              <div style={styles.formGroup}>
                <label style={styles.label}>Target Tag</label>
                <input
                  type="text"
                  value={config.metric?.targetTag || ''}
                  onChange={(e) => updateMetric('targetTag', e.target.value)}
                  style={styles.input}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>📜 Rules ({rules.length})</div>
        <div style={styles.sectionDesc}>
          Conditions and actions based on the metric.
        </div>

        {rules.map((rule, index) => (
          <RuleCard
            key={index}
            rule={rule}
            onChange={(r) => updateRule(index, r)}
            onRemove={() => removeRule(index)}
            schema={schema}
          />
        ))}

        <button
          className="se-add-item-btn"
          style={styles.addItemBtn}
          onClick={addRule}
        >
          + Add Rule
        </button>
      </div>
    </div>
  );
}

function RuleCard({ rule, onChange, onRemove, schema }) {
  const [expanded, setExpanded] = useState(false);

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateCondition = (field, value) => {
    onChange({ ...rule, condition: { ...rule.condition, [field]: value } });
  };

  const updateAction = (field, value) => {
    onChange({ ...rule, action: { ...rule.action, [field]: value } });
  };

  return (
    <div style={styles.itemCard}>
      <div
        style={styles.itemCardHeader}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ ...styles.itemCardIcon, backgroundColor: 'rgba(59, 130, 246, 0.2)' }}>📜</div>
        <div style={styles.itemCardInfo}>
          <div style={styles.itemCardTitle}>
            {rule.condition?.operator || '>='} {rule.condition?.threshold || '?'}
          </div>
          <div style={styles.itemCardSubtitle}>
            {rule.action?.type} • {(rule.probability * 100).toFixed(0)}% chance
          </div>
        </div>
        <div style={styles.itemCardActions}>
          <button style={styles.iconBtn}>{expanded ? '▲' : '▼'}</button>
          <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>
        </div>
      </div>

      {expanded && (
        <div style={styles.itemCardBody}>
          <div style={styles.formGrid}>
            <ReferenceDropdown
              label="Operator"
              value={rule.condition?.operator || '>='}
              onChange={(v) => updateCondition('operator', v)}
              options={[
                { value: '>=', label: '>= (greater or equal)' },
                { value: '>', label: '> (greater)' },
                { value: '<=', label: '<= (less or equal)' },
                { value: '<', label: '< (less)' },
                { value: '==', label: '== (equal)' },
              ]}
            />
            <div style={styles.formGroup}>
              <label style={styles.label}>Threshold</label>
              <input
                type="text"
                value={rule.condition?.threshold ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  updateCondition('threshold', isNaN(Number(v)) ? v : Number(v));
                }}
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Probability</label>
              <input
                type="number"
                value={rule.probability ?? ''}
                onChange={(e) => onChange({ ...rule, probability: parseFloat(e.target.value) || 0 })}
                style={styles.input}
                step="0.05"
                min="0"
                max="1"
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={styles.label}>Action</label>
            <div style={styles.formGrid}>
              <ReferenceDropdown
                label="Type"
                value={rule.action?.type || 'create_relationship'}
                onChange={(v) => updateAction('type', v)}
                options={[
                  { value: 'create_relationship', label: 'Create Relationship' },
                  { value: 'adjust_prominence', label: 'Adjust Prominence' },
                  { value: 'set_tag', label: 'Set Tag' },
                ]}
              />
              {rule.action?.type === 'create_relationship' && (
                <>
                  <ReferenceDropdown
                    label="Relationship Kind"
                    value={rule.action?.kind}
                    onChange={(v) => updateAction('kind', v)}
                    options={relationshipKindOptions}
                  />
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Strength</label>
                    <input
                      type="number"
                      value={rule.action?.strength ?? ''}
                      onChange={(e) => updateAction('strength', parseFloat(e.target.value) || undefined)}
                      style={styles.input}
                      step="0.1"
                      min="0"
                      max="1"
                    />
                  </div>
                </>
              )}
              {rule.action?.type === 'adjust_prominence' && (
                <ReferenceDropdown
                  label="Direction"
                  value={rule.action?.direction || 'up'}
                  onChange={(v) => updateAction('direction', v)}
                  options={[
                    { value: 'up', label: 'Up' },
                    { value: 'down', label: 'Down' },
                  ]}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// THRESHOLD TRIGGER TAB
// ============================================================================

function ThresholdTriggerTab({ system, onChange, schema }) {
  const config = system.config || {};

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const getStatusOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.statuses) return [];
    return ek.statuses.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const updateEntityFilter = (field, value) => {
    updateConfig('entityFilter', { ...config.entityFilter, [field]: value });
  };

  // Conditions
  const conditions = config.conditions || [];

  const addCondition = () => {
    updateConfig('conditions', [...conditions, { type: 'relationship_count', minCount: 1 }]);
  };

  const updateCondition = (index, cond) => {
    const newConditions = [...conditions];
    newConditions[index] = cond;
    updateConfig('conditions', newConditions);
  };

  const removeCondition = (index) => {
    updateConfig('conditions', conditions.filter((_, i) => i !== index));
  };

  // Actions
  const actions = config.actions || [];

  const addAction = () => {
    updateConfig('actions', [...actions, { type: 'set_tag', tag: '' }]);
  };

  const updateAction = (index, action) => {
    const newActions = [...actions];
    newActions[index] = action;
    updateConfig('actions', newActions);
  };

  const removeAction = (index) => {
    updateConfig('actions', actions.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🎯 Entity Filter</div>
        <div style={styles.formGrid}>
          <ReferenceDropdown
            label="Kind"
            value={config.entityFilter?.kind}
            onChange={(v) => updateEntityFilter('kind', v)}
            options={entityKindOptions}
          />
          {config.entityFilter?.kind && (
            <ReferenceDropdown
              label="Status"
              value={config.entityFilter?.status}
              onChange={(v) => updateEntityFilter('status', v)}
              options={[{ value: '', label: 'Any' }, ...getStatusOptions(config.entityFilter.kind)]}
            />
          )}
          <div style={styles.formGroup}>
            <label style={styles.label}>Has Tag</label>
            <input
              type="text"
              value={config.entityFilter?.hasTag || ''}
              onChange={(e) => updateEntityFilter('hasTag', e.target.value || undefined)}
              style={styles.input}
              placeholder="Optional"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Not Has Tag</label>
            <input
              type="text"
              value={config.entityFilter?.notHasTag || ''}
              onChange={(e) => updateEntityFilter('notHasTag', e.target.value || undefined)}
              style={styles.input}
              placeholder="Optional"
            />
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>✓ Conditions ({conditions.length})</div>

        {conditions.map((cond, index) => (
          <ConditionCard
            key={index}
            condition={cond}
            onChange={(c) => updateCondition(index, c)}
            onRemove={() => removeCondition(index)}
            schema={schema}
          />
        ))}

        <button
          className="se-add-item-btn"
          style={styles.addItemBtn}
          onClick={addCondition}
        >
          + Add Condition
        </button>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>⚡ Actions ({actions.length})</div>

        {actions.map((action, index) => (
          <ActionCard
            key={index}
            action={action}
            onChange={(a) => updateAction(index, a)}
            onRemove={() => removeAction(index)}
            schema={schema}
          />
        ))}

        <button
          className="se-add-item-btn"
          style={styles.addItemBtn}
          onClick={addAction}
        >
          + Add Action
        </button>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>🔗 Clustering</div>
        <div style={styles.formGrid}>
          <ReferenceDropdown
            label="Cluster Mode"
            value={config.clusterMode || 'individual'}
            onChange={(v) => updateConfig('clusterMode', v)}
            options={CLUSTER_MODES}
          />
          {config.clusterMode === 'by_relationship' && (
            <>
              <ReferenceDropdown
                label="Cluster Relationship"
                value={config.clusterRelationshipKind}
                onChange={(v) => updateConfig('clusterRelationshipKind', v)}
                options={relationshipKindOptions}
              />
              <div style={styles.formGroup}>
                <label style={styles.label}>Min Cluster Size</label>
                <input
                  type="number"
                  value={config.minClusterSize ?? ''}
                  onChange={(e) => updateConfig('minClusterSize', parseInt(e.target.value) || undefined)}
                  style={styles.input}
                  min="1"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ConditionCard({ condition, onChange, onRemove, schema }) {
  const [expanded, setExpanded] = useState(false);

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const update = (field, value) => {
    onChange({ ...condition, [field]: value });
  };

  const getSummary = () => {
    switch (condition.type) {
      case 'relationship_count':
        return `${condition.relationshipKind || 'any'} count ${condition.minCount !== undefined ? `>= ${condition.minCount}` : ''} ${condition.maxCount !== undefined ? `<= ${condition.maxCount}` : ''}`;
      case 'time_since_update':
        return `${condition.minTicks || '?'} ticks since update`;
      case 'has_tag':
      case 'has_any_tag':
        return `has tag ${condition.tag || condition.tags?.join(', ') || '?'}`;
      case 'tag_absent':
        return `missing tag ${condition.tag || '?'}`;
      default:
        return condition.type;
    }
  };

  return (
    <div style={styles.itemCard}>
      <div style={styles.itemCardHeader} onClick={() => setExpanded(!expanded)}>
        <div style={{ ...styles.itemCardIcon, backgroundColor: 'rgba(34, 197, 94, 0.2)' }}>✓</div>
        <div style={styles.itemCardInfo}>
          <div style={styles.itemCardTitle}>{condition.type}</div>
          <div style={styles.itemCardSubtitle}>{getSummary()}</div>
        </div>
        <div style={styles.itemCardActions}>
          <button style={styles.iconBtn}>{expanded ? '▲' : '▼'}</button>
          <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>
        </div>
      </div>

      {expanded && (
        <div style={styles.itemCardBody}>
          <div style={styles.formGrid}>
            <ReferenceDropdown
              label="Condition Type"
              value={condition.type}
              onChange={(v) => update('type', v)}
              options={CONDITION_TYPES}
            />
            {(condition.type === 'relationship_count' || condition.type === 'relationship_exists') && (
              <>
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={condition.relationshipKind}
                  onChange={(v) => update('relationshipKind', v)}
                  options={relationshipKindOptions}
                />
                <ReferenceDropdown
                  label="Direction"
                  value={condition.relationshipDirection || 'both'}
                  onChange={(v) => update('relationshipDirection', v)}
                  options={DIRECTIONS}
                />
              </>
            )}
            {condition.type === 'relationship_count' && (
              <>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Min Count</label>
                  <input
                    type="number"
                    value={condition.minCount ?? ''}
                    onChange={(e) => update('minCount', parseInt(e.target.value) || undefined)}
                    style={styles.input}
                    min="0"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Max Count</label>
                  <input
                    type="number"
                    value={condition.maxCount ?? ''}
                    onChange={(e) => update('maxCount', parseInt(e.target.value) || undefined)}
                    style={styles.input}
                    min="0"
                  />
                </div>
              </>
            )}
            {condition.type === 'time_since_update' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Min Ticks</label>
                <input
                  type="number"
                  value={condition.minTicks ?? ''}
                  onChange={(e) => update('minTicks', parseInt(e.target.value) || undefined)}
                  style={styles.input}
                  min="0"
                />
              </div>
            )}
            {(condition.type === 'has_tag' || condition.type === 'tag_absent') && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Tag</label>
                <input
                  type="text"
                  value={condition.tag || ''}
                  onChange={(e) => update('tag', e.target.value)}
                  style={styles.input}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionCard({ action, onChange, onRemove, schema }) {
  const [expanded, setExpanded] = useState(false);

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const update = (field, value) => {
    onChange({ ...action, [field]: value });
  };

  const getSummary = () => {
    switch (action.type) {
      case 'set_tag':
      case 'set_cluster_tag':
        return `${action.tag} = ${action.tagValue !== undefined ? String(action.tagValue) : 'true'}`;
      case 'remove_tag':
        return `remove ${action.tag}`;
      case 'create_relationship':
        return `create ${action.relationshipKind}`;
      default:
        return action.type;
    }
  };

  return (
    <div style={styles.itemCard}>
      <div style={styles.itemCardHeader} onClick={() => setExpanded(!expanded)}>
        <div style={{ ...styles.itemCardIcon, backgroundColor: 'rgba(245, 158, 11, 0.2)' }}>⚡</div>
        <div style={styles.itemCardInfo}>
          <div style={styles.itemCardTitle}>{action.type}</div>
          <div style={styles.itemCardSubtitle}>{getSummary()}</div>
        </div>
        <div style={styles.itemCardActions}>
          <button style={styles.iconBtn}>{expanded ? '▲' : '▼'}</button>
          <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>
        </div>
      </div>

      {expanded && (
        <div style={styles.itemCardBody}>
          <div style={styles.formGrid}>
            <ReferenceDropdown
              label="Action Type"
              value={action.type}
              onChange={(v) => update('type', v)}
              options={ACTION_TYPES}
            />
            {(action.type === 'set_tag' || action.type === 'set_cluster_tag' || action.type === 'remove_tag') && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Tag</label>
                <input
                  type="text"
                  value={action.tag || ''}
                  onChange={(e) => update('tag', e.target.value)}
                  style={styles.input}
                />
              </div>
            )}
            {(action.type === 'set_tag' || action.type === 'set_cluster_tag') && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Tag Value</label>
                <input
                  type="text"
                  value={action.tagValue !== undefined ? String(action.tagValue) : ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'true') update('tagValue', true);
                    else if (v === 'false') update('tagValue', false);
                    else if (!isNaN(Number(v)) && v !== '') update('tagValue', Number(v));
                    else update('tagValue', v || undefined);
                  }}
                  style={styles.input}
                  placeholder="true"
                />
              </div>
            )}
            {action.type === 'create_relationship' && (
              <ReferenceDropdown
                label="Relationship Kind"
                value={action.relationshipKind}
                onChange={(v) => update('relationshipKind', v)}
                options={relationshipKindOptions}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CLUSTER FORMATION TAB
// ============================================================================

function ClusterFormationTab({ system, onChange, schema }) {
  const config = system.config || {};

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const updateEntityFilter = (field, value) => {
    updateConfig('entityFilter', { ...config.entityFilter, [field]: value });
  };

  const updateClustering = (field, value) => {
    updateConfig('clustering', { ...config.clustering, [field]: value });
  };

  const updateMetaEntity = (field, value) => {
    updateConfig('metaEntity', { ...config.metaEntity, [field]: value });
  };

  // Criteria
  const criteria = config.clustering?.criteria || [];

  const addCriterion = () => {
    updateClustering('criteria', [...criteria, { type: 'same_culture', weight: 1.0 }]);
  };

  const updateCriterion = (index, crit) => {
    const newCriteria = [...criteria];
    newCriteria[index] = crit;
    updateClustering('criteria', newCriteria);
  };

  const removeCriterion = (index) => {
    updateClustering('criteria', criteria.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🎯 Entity Filter</div>
        <div style={styles.formGrid}>
          <ReferenceDropdown
            label="Kind"
            value={config.entityFilter?.kind}
            onChange={(v) => updateEntityFilter('kind', v)}
            options={entityKindOptions}
          />
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>📊 Clustering Configuration</div>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Min Size</label>
            <input
              type="number"
              value={config.clustering?.minSize ?? ''}
              onChange={(e) => updateClustering('minSize', parseInt(e.target.value) || undefined)}
              style={styles.input}
              min="2"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Max Size</label>
            <input
              type="number"
              value={config.clustering?.maxSize ?? ''}
              onChange={(e) => updateClustering('maxSize', parseInt(e.target.value) || undefined)}
              style={styles.input}
              min="2"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Minimum Score</label>
            <input
              type="number"
              value={config.clustering?.minimumScore ?? ''}
              onChange={(e) => updateClustering('minimumScore', parseFloat(e.target.value) || undefined)}
              style={styles.input}
              step="0.5"
              min="0"
            />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={styles.label}>Clustering Criteria ({criteria.length})</label>
        </div>

        {criteria.map((crit, index) => (
          <div key={index} style={styles.itemCard}>
            <div style={{ padding: '12px 16px' }}>
              <div style={styles.formGrid}>
                <ReferenceDropdown
                  label="Type"
                  value={crit.type}
                  onChange={(v) => updateCriterion(index, { ...crit, type: v })}
                  options={CLUSTERING_CRITERIA_TYPES}
                />
                <div style={styles.formGroup}>
                  <label style={styles.label}>Weight</label>
                  <input
                    type="number"
                    value={crit.weight ?? ''}
                    onChange={(e) => updateCriterion(index, { ...crit, weight: parseFloat(e.target.value) || 0 })}
                    style={styles.input}
                    step="0.5"
                    min="0"
                  />
                </div>
                {crit.type === 'shared_relationship' && (
                  <ReferenceDropdown
                    label="Relationship Kind"
                    value={crit.relationshipKind}
                    onChange={(v) => updateCriterion(index, { ...crit, relationshipKind: v })}
                    options={relationshipKindOptions}
                  />
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={() => removeCriterion(index)}>×</button>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          className="se-add-item-btn"
          style={styles.addItemBtn}
          onClick={addCriterion}
        >
          + Add Criterion
        </button>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>✨ Meta Entity</div>
        <div style={styles.sectionDesc}>
          Configuration for the meta-entity created from clusters.
        </div>
        <div style={styles.formGrid}>
          <ReferenceDropdown
            label="Kind"
            value={config.metaEntity?.kind}
            onChange={(v) => updateMetaEntity('kind', v)}
            options={entityKindOptions}
          />
          <div style={styles.formGroup}>
            <label style={styles.label}>Status</label>
            <input
              type="text"
              value={config.metaEntity?.status || ''}
              onChange={(e) => updateMetaEntity('status', e.target.value)}
              style={styles.input}
            />
          </div>
        </div>
        <div style={{ marginTop: '16px' }}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Description Template</label>
            <textarea
              value={config.metaEntity?.descriptionTemplate || ''}
              onChange={(e) => updateMetaEntity('descriptionTemplate', e.target.value)}
              style={styles.textarea}
              placeholder="Use {names}, {count} placeholders"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAG DIFFUSION TAB
// ============================================================================

function TagDiffusionTab({ system, onChange, schema }) {
  const config = system.config || {};

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const updateConvergence = (field, value) => {
    updateConfig('convergence', { ...config.convergence, [field]: value });
  };

  const updateDivergence = (field, value) => {
    updateConfig('divergence', { ...config.divergence, [field]: value });
  };

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🔗 Connection</div>
        <div style={styles.formGrid}>
          <ReferenceDropdown
            label="Connection Kind"
            value={config.connectionKind}
            onChange={(v) => updateConfig('connectionKind', v)}
            options={relationshipKindOptions}
          />
          <ReferenceDropdown
            label="Direction"
            value={config.connectionDirection || 'both'}
            onChange={(v) => updateConfig('connectionDirection', v)}
            options={DIRECTIONS}
          />
          <div style={styles.formGroup}>
            <label style={styles.label}>Max Tags</label>
            <input
              type="number"
              value={config.maxTags ?? ''}
              onChange={(e) => updateConfig('maxTags', parseInt(e.target.value) || undefined)}
              style={styles.input}
              min="1"
            />
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>🔄 Convergence</div>
        <div style={styles.sectionDesc}>
          Connected entities become more similar.
        </div>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Tags (comma-separated)</label>
            <input
              type="text"
              value={(config.convergence?.tags || []).join(', ')}
              onChange={(e) => updateConvergence('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Min Connections</label>
            <input
              type="number"
              value={config.convergence?.minConnections ?? ''}
              onChange={(e) => updateConvergence('minConnections', parseInt(e.target.value) || undefined)}
              style={styles.input}
              min="0"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Probability</label>
            <input
              type="number"
              value={config.convergence?.probability ?? ''}
              onChange={(e) => updateConvergence('probability', parseFloat(e.target.value) || undefined)}
              style={styles.input}
              step="0.1"
              min="0"
              max="1"
            />
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>↔️ Divergence</div>
        <div style={styles.sectionDesc}>
          Isolated entities become more unique.
        </div>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Tags (comma-separated)</label>
            <input
              type="text"
              value={(config.divergence?.tags || []).join(', ')}
              onChange={(e) => updateDivergence('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Max Connections</label>
            <input
              type="number"
              value={config.divergence?.maxConnections ?? ''}
              onChange={(e) => updateDivergence('maxConnections', parseInt(e.target.value) || undefined)}
              style={styles.input}
              min="0"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Probability</label>
            <input
              type="number"
              value={config.divergence?.probability ?? ''}
              onChange={(e) => updateDivergence('probability', parseFloat(e.target.value) || undefined)}
              style={styles.input}
              step="0.1"
              min="0"
              max="1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PLANE DIFFUSION TAB
// ============================================================================

function PlaneDiffusionTab({ system, onChange }) {
  const config = system.config || {};

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const updateSources = (field, value) => {
    updateConfig('sources', { ...config.sources, [field]: value });
  };

  const updateSinks = (field, value) => {
    updateConfig('sinks', { ...config.sinks, [field]: value });
  };

  const updateDiffusion = (field, value) => {
    updateConfig('diffusion', { ...config.diffusion, [field]: value });
  };

  // Output tags
  const outputTags = config.outputTags || [];

  const addOutputTag = () => {
    updateConfig('outputTags', [...outputTags, { tag: '', minValue: 0 }]);
  };

  const updateOutputTag = (index, tag) => {
    const newTags = [...outputTags];
    newTags[index] = tag;
    updateConfig('outputTags', newTags);
  };

  const removeOutputTag = (index) => {
    updateConfig('outputTags', outputTags.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🔥 Sources</div>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Tag Filter</label>
            <input
              type="text"
              value={config.sources?.tagFilter || ''}
              onChange={(e) => updateSources('tagFilter', e.target.value)}
              style={styles.input}
              placeholder="e.g., volcanic"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Default Strength</label>
            <input
              type="number"
              value={config.sources?.defaultStrength ?? ''}
              onChange={(e) => updateSources('defaultStrength', parseFloat(e.target.value) || undefined)}
              style={styles.input}
              step="0.1"
              min="0"
            />
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>❄️ Sinks</div>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Tag Filter</label>
            <input
              type="text"
              value={config.sinks?.tagFilter || ''}
              onChange={(e) => updateSinks('tagFilter', e.target.value)}
              style={styles.input}
              placeholder="e.g., deep_ice"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Default Strength</label>
            <input
              type="number"
              value={config.sinks?.defaultStrength ?? ''}
              onChange={(e) => updateSinks('defaultStrength', parseFloat(e.target.value) || undefined)}
              style={styles.input}
              step="0.1"
              min="0"
            />
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>🌡️ Diffusion</div>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Rate</label>
            <input
              type="number"
              value={config.diffusion?.rate ?? ''}
              onChange={(e) => updateDiffusion('rate', parseFloat(e.target.value) || undefined)}
              style={styles.input}
              step="0.05"
              min="0"
            />
          </div>
          <ReferenceDropdown
            label="Falloff"
            value={config.diffusion?.falloff || 'inverse_square'}
            onChange={(v) => updateDiffusion('falloff', v)}
            options={[
              { value: 'linear', label: 'Linear' },
              { value: 'inverse_square', label: 'Inverse Square' },
              { value: 'exponential', label: 'Exponential' },
            ]}
          />
          <div style={styles.formGroup}>
            <label style={styles.label}>Max Radius</label>
            <input
              type="number"
              value={config.diffusion?.maxRadius ?? ''}
              onChange={(e) => updateDiffusion('maxRadius', parseInt(e.target.value) || undefined)}
              style={styles.input}
              min="1"
            />
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>🏷️ Output Tags ({outputTags.length})</div>
        <div style={styles.sectionDesc}>
          Tags assigned based on diffusion value thresholds.
        </div>

        {outputTags.map((tag, index) => (
          <div key={index} style={styles.itemCard}>
            <div style={{ padding: '12px 16px' }}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Tag</label>
                  <input
                    type="text"
                    value={tag.tag || ''}
                    onChange={(e) => updateOutputTag(index, { ...tag, tag: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Min Value</label>
                  <input
                    type="number"
                    value={tag.minValue ?? ''}
                    onChange={(e) => updateOutputTag(index, { ...tag, minValue: parseFloat(e.target.value) || undefined })}
                    style={styles.input}
                    step="0.05"
                    min="0"
                    max="1"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Max Value</label>
                  <input
                    type="number"
                    value={tag.maxValue ?? ''}
                    onChange={(e) => updateOutputTag(index, { ...tag, maxValue: parseFloat(e.target.value) || undefined })}
                    style={styles.input}
                    step="0.05"
                    min="0"
                    max="1"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={() => removeOutputTag(index)}>×</button>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          className="se-add-item-btn"
          style={styles.addItemBtn}
          onClick={addOutputTag}
        >
          + Add Output Tag
        </button>

        <div style={{ marginTop: '16px' }}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Value Tag</label>
            <input
              type="text"
              value={config.valueTag || ''}
              onChange={(e) => updateConfig('valueTag', e.target.value)}
              style={styles.input}
              placeholder="e.g., temperature"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FRAMEWORK SYSTEMS TAB (eraSpawner, eraTransition, universalCatalyst, relationshipMaintenance)
// ============================================================================

function FrameworkSystemTab({ system, onChange }) {
  const config = system.config || {};

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  return (
    <div>
      <div style={styles.infoBox}>
        <div style={styles.infoBoxTitle}>Framework System</div>
        <div style={styles.infoBoxText}>
          This is a framework-level system with specific configuration options.
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Configuration</div>

        {system.systemType === 'eraSpawner' && (
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Ticks Per Era</label>
              <input
                type="number"
                value={config.ticksPerEra ?? ''}
                onChange={(e) => updateConfig('ticksPerEra', parseInt(e.target.value) || undefined)}
                style={styles.input}
                min="1"
              />
            </div>
          </div>
        )}

        {system.systemType === 'eraTransition' && (
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Min Era Length</label>
              <input
                type="number"
                value={config.minEraLength ?? ''}
                onChange={(e) => updateConfig('minEraLength', parseInt(e.target.value) || undefined)}
                style={styles.input}
                min="1"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Transition Cooldown</label>
              <input
                type="number"
                value={config.transitionCooldown ?? ''}
                onChange={(e) => updateConfig('transitionCooldown', parseInt(e.target.value) || undefined)}
                style={styles.input}
                min="0"
              />
            </div>
          </div>
        )}

        {system.systemType === 'universalCatalyst' && (
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Action Attempt Rate</label>
              <input
                type="number"
                value={config.actionAttemptRate ?? ''}
                onChange={(e) => updateConfig('actionAttemptRate', parseFloat(e.target.value) || undefined)}
                style={styles.input}
                step="0.1"
                min="0"
                max="1"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Influence Gain</label>
              <input
                type="number"
                value={config.influenceGain ?? ''}
                onChange={(e) => updateConfig('influenceGain', parseFloat(e.target.value) || undefined)}
                style={styles.input}
                step="0.05"
                min="0"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Influence Loss</label>
              <input
                type="number"
                value={config.influenceLoss ?? ''}
                onChange={(e) => updateConfig('influenceLoss', parseFloat(e.target.value) || undefined)}
                style={styles.input}
                step="0.05"
                min="0"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Pressure Multiplier</label>
              <input
                type="number"
                value={config.pressureMultiplier ?? ''}
                onChange={(e) => updateConfig('pressureMultiplier', parseFloat(e.target.value) || undefined)}
                style={styles.input}
                step="0.1"
                min="0"
              />
            </div>
          </div>
        )}

        {system.systemType === 'relationshipMaintenance' && (
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Maintenance Frequency</label>
              <input
                type="number"
                value={config.maintenanceFrequency ?? ''}
                onChange={(e) => updateConfig('maintenanceFrequency', parseInt(e.target.value) || undefined)}
                style={styles.input}
                min="1"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Cull Threshold</label>
              <input
                type="number"
                value={config.cullThreshold ?? ''}
                onChange={(e) => updateConfig('cullThreshold', parseFloat(e.target.value) || undefined)}
                style={styles.input}
                step="0.05"
                min="0"
                max="1"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Grace Period</label>
              <input
                type="number"
                value={config.gracePeriod ?? ''}
                onChange={(e) => updateConfig('gracePeriod', parseInt(e.target.value) || undefined)}
                style={styles.input}
                min="0"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Reinforcement Bonus</label>
              <input
                type="number"
                value={config.reinforcementBonus ?? ''}
                onChange={(e) => updateConfig('reinforcementBonus', parseFloat(e.target.value) || undefined)}
                style={styles.input}
                step="0.01"
                min="0"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SYSTEM MODAL
// ============================================================================

function SystemModal({ system, onChange, onClose, onDelete, schema, pressures }) {
  const [activeTab, setActiveTab] = useState('overview');
  const typeConfig = SYSTEM_TYPES[system.systemType] || {};

  const isFrameworkSystem = ['eraSpawner', 'eraTransition', 'universalCatalyst', 'relationshipMaintenance'].includes(system.systemType);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'common', label: 'Settings', icon: '⚙️' },
  ];

  // Add type-specific tab
  if (!isFrameworkSystem) {
    switch (system.systemType) {
      case 'graphContagion':
        tabs.push({ id: 'type', label: 'Contagion', icon: '🦠' });
        break;
      case 'connectionEvolution':
        tabs.push({ id: 'type', label: 'Evolution', icon: '🔗' });
        break;
      case 'thresholdTrigger':
        tabs.push({ id: 'type', label: 'Trigger', icon: '⚡' });
        break;
      case 'clusterFormation':
        tabs.push({ id: 'type', label: 'Clustering', icon: '🎯' });
        break;
      case 'tagDiffusion':
        tabs.push({ id: 'type', label: 'Diffusion', icon: '🏷️' });
        break;
      case 'planeDiffusion':
        tabs.push({ id: 'type', label: 'Plane', icon: '🌡️' });
        break;
    }
  } else {
    tabs.push({ id: 'type', label: 'Framework', icon: '🔧' });
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab system={system} onChange={onChange} onDelete={onDelete} />;
      case 'common':
        return <CommonSettingsTab system={system} onChange={onChange} schema={schema} pressures={pressures} />;
      case 'type':
        if (isFrameworkSystem) {
          return <FrameworkSystemTab system={system} onChange={onChange} />;
        }
        switch (system.systemType) {
          case 'graphContagion':
            return <GraphContagionTab system={system} onChange={onChange} schema={schema} />;
          case 'connectionEvolution':
            return <ConnectionEvolutionTab system={system} onChange={onChange} schema={schema} />;
          case 'thresholdTrigger':
            return <ThresholdTriggerTab system={system} onChange={onChange} schema={schema} />;
          case 'clusterFormation':
            return <ClusterFormationTab system={system} onChange={onChange} schema={schema} />;
          case 'tagDiffusion':
            return <TagDiffusionTab system={system} onChange={onChange} schema={schema} />;
          case 'planeDiffusion':
            return <PlaneDiffusionTab system={system} onChange={onChange} />;
          default:
            return null;
        }
      default:
        return null;
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>
            <span style={{ fontSize: '20px' }}>{typeConfig.icon}</span>
            <span>{system.config?.name || system.config?.id}</span>
            {system.enabled === false && (
              <span style={{ fontSize: '11px', padding: '3px 8px', backgroundColor: 'rgba(107, 114, 128, 0.3)', color: '#9ca3af', borderRadius: '4px' }}>
                Disabled
              </span>
            )}
          </div>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.modalBody}>
          <div style={styles.tabSidebar}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`se-tab-btn ${activeTab === tab.id ? 'se-tab-btn-active' : ''}`}
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

function SystemListCard({ system, onClick, onToggle, usageMap }) {
  const [hovering, setHovering] = useState(false);
  const config = system.config || {};
  const sysId = config.id;
  const isEnabled = system.enabled !== false;
  const typeConfig = SYSTEM_TYPES[system.systemType] || {};

  // Get validation and usage info
  const validation = useMemo(() =>
    usageMap ? getElementValidation(usageMap, 'system', sysId) : { invalidRefs: [], isOrphan: false },
    [usageMap, sysId]
  );

  const eraUsage = useMemo(() => {
    if (!usageMap?.systems?.[sysId]) return [];
    return usageMap.systems[sysId].eras || [];
  }, [usageMap, sysId]);

  const hasErrors = validation.invalidRefs.length > 0;
  const isOrphan = validation.isOrphan;

  return (
    <div
      style={{
        ...styles.systemCard,
        ...(hovering ? styles.systemCardHover : {}),
        ...(isEnabled ? {} : styles.systemCardDisabled),
        ...(hasErrors ? validationStyles.invalidBorder : {}),
        ...(isOrphan && !hasErrors ? validationStyles.warningBorder : {}),
      }}
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div style={styles.cardHeader}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={styles.cardTitle}>{config.name || config.id}</span>
            {hasErrors && (
              <span style={{ ...validationStyles.validationBadge, ...validationStyles.errorBadge, marginLeft: 0 }}>
                {validation.invalidRefs.length} error{validation.invalidRefs.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={styles.cardId}>{config.id}</div>
        </div>
        <div
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{ ...styles.enableToggle, ...(isEnabled ? styles.enableToggleOn : {}) }}
        >
          <div style={{ ...styles.toggleKnob, ...(isEnabled ? styles.toggleKnobOn : {}) }} />
        </div>
      </div>

      <div style={styles.cardBadges}>
        <span style={{ ...styles.typeBadge, backgroundColor: `${typeConfig.color}30`, color: typeConfig.color }}>
          {typeConfig.icon} {typeConfig.label}
        </span>
      </div>

      {config.description && (
        <div style={styles.cardDesc}>{config.description}</div>
      )}

      {/* Era usage badges */}
      {eraUsage.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {eraUsage.slice(0, 3).map((era) => (
            <span key={era.id} style={validationStyles.eraBadge}>
              <span style={{ opacity: 0.7 }}>🕰️</span> {era.name || era.id}
            </span>
          ))}
          {eraUsage.length > 3 && (
            <span style={{ ...validationStyles.eraBadge, backgroundColor: 'transparent' }}>
              +{eraUsage.length - 3} more
            </span>
          )}
        </div>
      )}
      {isOrphan && (
        <div style={{ marginTop: '8px' }}>
          <span style={{ ...validationStyles.validationBadge, ...validationStyles.orphanBadge, marginLeft: 0 }}>
            Not in any era
          </span>
        </div>
      )}
    </div>
  );
}

export default function SystemsEditor({ systems = [], onChange, schema, pressures = [], usageMap }) {
  useHoverStyles();
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [addHovering, setAddHovering] = useState(false);

  const handleSystemChange = useCallback((updated) => {
    const index = systems.findIndex((s) => s.config?.id === selectedSystem.config?.id);
    if (index >= 0) {
      const newSystems = [...systems];
      newSystems[index] = updated;
      onChange(newSystems);
      setSelectedSystem(updated);
    }
  }, [systems, onChange, selectedSystem]);

  const handleToggle = useCallback((system) => {
    const index = systems.findIndex((s) => s.config?.id === system.config?.id);
    if (index >= 0) {
      const newSystems = [...systems];
      newSystems[index] = { ...system, enabled: system.enabled === false ? true : false };
      onChange(newSystems);
    }
  }, [systems, onChange]);

  const handleDelete = useCallback(() => {
    if (selectedSystem && confirm(`Delete system "${selectedSystem.config?.name || selectedSystem.config?.id}"?`)) {
      onChange(systems.filter((s) => s.config?.id !== selectedSystem.config?.id));
      setSelectedSystem(null);
    }
  }, [systems, onChange, selectedSystem]);

  const handleAddSystem = useCallback((type) => {
    const newSystem = {
      systemType: type,
      config: {
        id: `system_${Date.now()}`,
        name: `New ${SYSTEM_TYPES[type]?.label || type}`,
        description: '',
      },
    };
    onChange([...systems, newSystem]);
    setSelectedSystem(newSystem);
    setShowTypePicker(false);
  }, [systems, onChange]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Systems</h1>
        <p style={styles.subtitle}>Configure simulation systems that run during the simulation phase. Click a system to edit.</p>
      </div>

      <div style={styles.systemGrid}>
        {systems.map((system) => (
          <SystemListCard
            key={system.config?.id}
            system={system}
            onClick={() => setSelectedSystem(system)}
            onToggle={() => handleToggle(system)}
            usageMap={usageMap}
          />
        ))}

        <div
          style={{ ...styles.addCard, ...(addHovering ? styles.addCardHover : {}) }}
          onClick={() => setShowTypePicker(true)}
          onMouseEnter={() => setAddHovering(true)}
          onMouseLeave={() => setAddHovering(false)}
        >
          <span style={{ fontSize: '24px' }}>+</span>
          <span>Add System</span>
        </div>
      </div>

      {showTypePicker && (
        <div style={styles.modalOverlay} onClick={() => setShowTypePicker(false)}>
          <div style={{ ...styles.modal, maxWidth: '600px', height: 'auto', maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Choose System Type</div>
              <button style={styles.closeBtn} onClick={() => setShowTypePicker(false)}>×</button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <div style={styles.typePicker}>
                {Object.entries(SYSTEM_TYPES).map(([type, config]) => (
                  <div
                    key={type}
                    className="se-type-option"
                    style={styles.typeOption}
                    onClick={() => handleAddSystem(type)}
                  >
                    <div style={styles.typeOptionIcon}>{config.icon}</div>
                    <div style={styles.typeOptionLabel}>{config.label}</div>
                    <div style={styles.typeOptionDesc}>{config.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedSystem && (
        <SystemModal
          system={selectedSystem}
          onChange={handleSystemChange}
          onClose={() => setSelectedSystem(null)}
          onDelete={handleDelete}
          schema={schema}
          pressures={pressures}
        />
      )}
    </div>
  );
}
