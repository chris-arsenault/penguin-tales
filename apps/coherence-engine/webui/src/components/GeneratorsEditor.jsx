/**
 * GeneratorsEditor v2 - Visual builder with tabbed modal
 *
 * Tabs:
 * - Overview: Name, ID, enabled state, summary
 * - Applicability: Visual nested rule builder
 * - Target: Configure the primary target selection ($target)
 * - Variables: Define intermediate entity selections
 * - Creation: Visual entity creation cards
 * - Relationships: Relationship editor
 * - Effects: Pressure modifications and archives
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { getElementValidation, getUsageSummary } from '../utils/schemaUsageMap';
import TagSelector from '@lore-weave/shared-components/TagSelector';

// ============================================================================
// CSS HOVER STYLES (injected once)
// ============================================================================

const HOVER_STYLES_ID = 'generators-editor-hover-styles';

const hoverCSS = `
  .ge-tab-btn:not(.ge-tab-btn-active):hover {
    background-color: rgba(245, 158, 11, 0.15) !important;
  }
  .ge-tab-btn:not(.ge-tab-btn-active) {
    background-color: transparent !important;
  }
  .ge-add-item-btn:hover {
    border-color: #f59e0b !important;
    color: #f59e0b !important;
  }
  .ge-add-item-btn {
    border-color: rgba(59, 130, 246, 0.3) !important;
    color: #60a5fa !important;
  }
  .ge-card-option:hover {
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
  warningBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: COLORS.warning,
  },
  orphanBadge: {
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    color: '#9ca3af',
  },
  usageBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    color: COLORS.success,
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '4px',
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

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'applicability', label: 'When', icon: '✓' },
  { id: 'target', label: 'Target', icon: '🎯' },
  { id: 'variables', label: 'Variables', icon: '📦' },
  { id: 'creation', label: 'Create', icon: '✨' },
  { id: 'relationships', label: 'Connect', icon: '🔗' },
  { id: 'effects', label: 'Effects', icon: '⚡' },
];

const APPLICABILITY_TYPES = {
  entity_count_min: { label: 'Min Entities', icon: '📊', color: '#3b82f6', desc: 'Requires minimum entity count' },
  entity_count_max: { label: 'Max Entities', icon: '📉', color: '#8b5cf6', desc: 'Stops at maximum entity count' },
  pressure_threshold: { label: 'Pressure Range', icon: '🌡️', color: '#f59e0b', desc: 'Runs when pressure is in range' },
  era_match: { label: 'Era Match', icon: '🕰️', color: '#10b981', desc: 'Only runs in specific eras' },
  or: { label: 'Any Of (OR)', icon: '⚡', color: '#ec4899', desc: 'Passes if any sub-rule passes' },
  and: { label: 'All Of (AND)', icon: '🔗', color: '#14b8a6', desc: 'Passes if all sub-rules pass' },
};

const PROMINENCE_LEVELS = [
  { value: 'forgotten', label: 'Forgotten', color: '#6b7280' },
  { value: 'marginal', label: 'Marginal', color: '#60a5fa' },
  { value: 'recognized', label: 'Recognized', color: '#34d399' },
  { value: 'renowned', label: 'Renowned', color: '#fbbf24' },
  { value: 'mythic', label: 'Mythic', color: '#a855f7' },
];

const PICK_STRATEGIES = [
  { value: 'random', label: 'Random', desc: 'Pick randomly from matches' },
  { value: 'first', label: 'First', desc: 'Pick the first match' },
  { value: 'all', label: 'All', desc: 'Use all matches' },
  { value: 'weighted', label: 'Weighted', desc: 'Weight by prominence' },
];

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  // Main list view
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
  generatorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  generatorCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: '12px',
    border: `1px solid ${COLORS.border}`,
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative',
  },
  generatorCardHover: {
    borderColor: ACCENT_COLOR,
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
  },
  generatorCardDisabled: {
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
  cardStats: {
    display: 'flex',
    gap: '12px',
    marginTop: '12px',
  },
  cardStat: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    color: COLORS.textMuted,
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

  // Category section styles
  categorySection: {
    marginBottom: '24px',
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: COLORS.bgCard,
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    cursor: 'pointer',
    marginBottom: '12px',
    transition: 'all 0.15s',
  },
  categoryHeaderHover: {
    borderColor: ACCENT_COLOR,
  },
  categoryIcon: {
    fontSize: '18px',
  },
  categoryTitle: {
    flex: 1,
    fontSize: '15px',
    fontWeight: 600,
    color: COLORS.text,
  },
  categoryCount: {
    fontSize: '12px',
    color: COLORS.textMuted,
    backgroundColor: COLORS.bgDark,
    padding: '2px 8px',
    borderRadius: '10px',
  },
  categoryToggleAll: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: COLORS.textMuted,
    padding: '4px 10px',
    borderRadius: '4px',
    border: `1px solid ${COLORS.border}`,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  categoryToggleAllActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: COLORS.success,
    color: COLORS.success,
  },
  categoryExpand: {
    fontSize: '12px',
    color: COLORS.textMuted,
    transition: 'transform 0.2s',
  },
  categoryExpandOpen: {
    transform: 'rotate(90deg)',
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
    width: '180px',
    backgroundColor: COLORS.bgDark,
    borderRight: `1px solid ${COLORS.border}`,
    padding: '16px 12px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
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

  // Tab content sections
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

  // Info box
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
    transition: 'border-color 0.15s',
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
    outline: 'none',
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
    minHeight: '100px',
    boxSizing: 'border-box',
    outline: 'none',
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

  // Cards within tabs
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
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemCardActions: {
    display: 'flex',
    gap: '4px',
    flexShrink: 0,
  },
  iconBtn: {
    padding: '6px',
    fontSize: '14px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: COLORS.textDim,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  iconBtnDanger: {
    color: COLORS.danger,
  },
  itemCardBody: {
    padding: '16px',
    borderTop: `1px solid ${COLORS.borderLight}`,
    backgroundColor: COLORS.bg,
  },

  // Add item button
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
  addItemBtnHover: {
    borderColor: ACCENT_COLOR,
    color: ACCENT_COLOR,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
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
    lineHeight: 1,
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

  // Relationship visual
  relVisual: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    fontSize: '13px',
  },
  relRef: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: COLORS.textDim,
    backgroundColor: COLORS.bgCard,
    padding: '4px 8px',
    borderRadius: '4px',
  },
  relKind: {
    color: COLORS.purple,
    fontWeight: 500,
  },
  relArrow: {
    color: COLORS.textDim,
  },

  // Rule builder
  ruleContainer: {
    backgroundColor: COLORS.bgDark,
    borderRadius: '10px',
    border: `1px solid ${COLORS.borderLight}`,
    padding: '16px',
    marginBottom: '12px',
  },
  ruleHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  ruleType: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  ruleIcon: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
  },
  ruleLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.text,
  },
  nestedRules: {
    marginLeft: '24px',
    paddingLeft: '16px',
    borderLeft: `2px solid ${COLORS.border}`,
    marginTop: '12px',
  },

  // Prominence selector
  prominenceSelector: {
    display: 'flex',
    gap: '8px',
  },
  prominenceOption: {
    flex: 1,
    padding: '10px 8px',
    textAlign: 'center',
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.bgDark,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  prominenceOptionSelected: {
    borderColor: ACCENT_COLOR,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  prominenceLabel: {
    fontSize: '11px',
    fontWeight: 600,
  },

  // Type picker
  typePicker: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    marginTop: '12px',
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
            <button
              type="button"
              style={styles.chipRemove}
              onClick={() => onChange(value.filter((x) => x !== v))}
            >
              ×
            </button>
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
            <option key={opt.value} value={opt.value}>
              {opt.label || opt.value}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function ProminenceSelector({ value, onChange }) {
  return (
    <div style={styles.formGroup}>
      <label style={styles.label}>Prominence</label>
      <div style={styles.prominenceSelector}>
        {PROMINENCE_LEVELS.map((level) => (
          <div
            key={level.value}
            onClick={() => onChange(level.value)}
            style={{
              ...styles.prominenceOption,
              ...(value === level.value ? styles.prominenceOptionSelected : {}),
            }}
          >
            <div
              style={{
                ...styles.prominenceLabel,
                color: value === level.value ? level.color : COLORS.textMuted,
              }}
            >
              {level.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================

function OverviewTab({ generator, onChange, onDelete }) {
  const updateField = (field, value) => {
    onChange({ ...generator, [field]: value });
  };

  const summary = useMemo(() => {
    return {
      rules: generator.applicability?.length || 0,
      variables: Object.keys(generator.variables || {}).length,
      creates: generator.creation?.length || 0,
      relationships: generator.relationships?.length || 0,
      effects: generator.stateUpdates?.length || 0,
    };
  }, [generator]);

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Basic Information</div>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Generator ID</label>
            <input
              type="text"
              value={generator.id}
              onChange={(e) => updateField('id', e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Display Name</label>
            <input
              type="text"
              value={generator.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              style={styles.input}
              placeholder="Optional friendly name"
            />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={styles.label}>Enabled</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              onClick={() => updateField('enabled', generator.enabled === false ? true : false)}
              style={{
                ...styles.enableToggle,
                ...(generator.enabled !== false ? styles.enableToggleOn : {}),
              }}
            >
              <div
                style={{
                  ...styles.toggleKnob,
                  ...(generator.enabled !== false ? styles.toggleKnobOn : {}),
                }}
              />
            </div>
            <span style={{ fontSize: '13px', color: COLORS.textMuted }}>
              {generator.enabled !== false ? 'Generator is active' : 'Generator is disabled'}
            </span>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {[
            { label: 'Rules', value: summary.rules, icon: '✓' },
            { label: 'Variables', value: summary.variables, icon: '📦' },
            { label: 'Creates', value: summary.creates, icon: '✨' },
            { label: 'Connects', value: summary.relationships, icon: '🔗' },
            { label: 'Effects', value: summary.effects, icon: '⚡' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                backgroundColor: COLORS.bgDark,
                borderRadius: '10px',
                padding: '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{stat.icon}</div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: COLORS.text }}>{stat.value}</div>
              <div style={{ fontSize: '12px', color: COLORS.textMuted }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: `1px solid ${COLORS.border}` }}>
        <button style={{ ...styles.button, ...styles.buttonDanger }} onClick={onDelete}>
          Delete Generator
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// APPLICABILITY TAB
// ============================================================================

function ApplicabilityRuleCard({ rule, onChange, onRemove, schema, pressures, eras, depth = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = APPLICABILITY_TYPES[rule.type] || {};

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const pressureOptions = (pressures || []).map((p) => ({
    value: p.id,
    label: p.name || p.id,
  }));

  const eraOptions = (eras || []).map((e) => ({
    value: e.id,
    label: e.name || e.id,
  }));

  const updateField = (field, value) => {
    onChange({ ...rule, [field]: value });
  };

  const getSummary = () => {
    switch (rule.type) {
      case 'entity_count_min':
        return `${rule.kind || '?'}${rule.subtype ? ':' + rule.subtype : ''} >= ${rule.min ?? '?'}`;
      case 'entity_count_max':
        return `${rule.kind || '?'}${rule.subtype ? ':' + rule.subtype : ''} <= ${rule.max ?? '?'}`;
      case 'pressure_threshold':
        return `${rule.pressureId || '?'} in [${rule.min ?? 0}, ${rule.max ?? 100}]`;
      case 'era_match':
        return rule.eras?.length ? rule.eras.join(', ') : 'No eras selected';
      case 'or':
      case 'and':
        return `${rule.rules?.length || 0} sub-rules`;
      default:
        return rule.type;
    }
  };

  const isNested = rule.type === 'or' || rule.type === 'and';

  return (
    <div style={styles.ruleContainer}>
      <div style={styles.ruleHeader}>
        <div style={styles.ruleType}>
          <div style={{ ...styles.ruleIcon, backgroundColor: `${typeConfig.color || '#3b82f6'}20` }}>
            {typeConfig.icon || '📋'}
          </div>
          <div>
            <div style={styles.ruleLabel}>{typeConfig.label || rule.type}</div>
            <div style={{ fontSize: '12px', color: COLORS.textMuted }}>{getSummary()}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button style={styles.iconBtn} onClick={() => setExpanded(!expanded)}>
            {expanded ? '▲' : '▼'}
          </button>
          <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={onRemove}>
            ×
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '12px' }}>
          <div style={styles.formGrid}>
            {(rule.type === 'entity_count_min' || rule.type === 'entity_count_max') && (
              <>
                <ReferenceDropdown
                  label="Entity Kind"
                  value={rule.kind}
                  onChange={(v) => updateField('kind', v)}
                  options={entityKindOptions}
                />
                <div style={styles.formGroup}>
                  <label style={styles.label}>Subtype (optional)</label>
                  <input
                    type="text"
                    value={rule.subtype || ''}
                    onChange={(e) => updateField('subtype', e.target.value || undefined)}
                    style={styles.input}
                    placeholder="Any"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>{rule.type === 'entity_count_min' ? 'Minimum' : 'Maximum'}</label>
                  <input
                    type="number"
                    value={rule.type === 'entity_count_min' ? (rule.min ?? '') : (rule.max ?? '')}
                    onChange={(e) => updateField(rule.type === 'entity_count_min' ? 'min' : 'max', parseInt(e.target.value) || 0)}
                    style={styles.input}
                    min="0"
                  />
                </div>
              </>
            )}

            {rule.type === 'pressure_threshold' && (
              <>
                <ReferenceDropdown
                  label="Pressure"
                  value={rule.pressureId}
                  onChange={(v) => updateField('pressureId', v)}
                  options={pressureOptions}
                />
                <div style={styles.formGroup}>
                  <label style={styles.label}>Min Value</label>
                  <input
                    type="number"
                    value={rule.min ?? ''}
                    onChange={(e) => updateField('min', parseInt(e.target.value) || undefined)}
                    style={styles.input}
                    min="0"
                    max="100"
                    placeholder="0"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Max Value</label>
                  <input
                    type="number"
                    value={rule.max ?? ''}
                    onChange={(e) => updateField('max', parseInt(e.target.value) || undefined)}
                    style={styles.input}
                    min="0"
                    max="100"
                    placeholder="100"
                  />
                </div>
              </>
            )}

            {rule.type === 'era_match' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <ChipSelect
                  label="Eras"
                  value={rule.eras || []}
                  onChange={(v) => updateField('eras', v)}
                  options={eraOptions}
                  placeholder="+ Add era"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {isNested && (
        <div style={styles.nestedRules}>
          {(rule.rules || []).map((subRule, idx) => (
            <ApplicabilityRuleCard
              key={idx}
              rule={subRule}
              onChange={(updated) => {
                const newRules = [...(rule.rules || [])];
                newRules[idx] = updated;
                updateField('rules', newRules);
              }}
              onRemove={() => updateField('rules', (rule.rules || []).filter((_, i) => i !== idx))}
              schema={schema}
              pressures={pressures}
              eras={eras}
              depth={depth + 1}
            />
          ))}
          <AddRuleButton
            onAdd={(type) => {
              const newRule = createNewRule(type, pressures);
              updateField('rules', [...(rule.rules || []), newRule]);
            }}
            depth={depth + 1}
          />
        </div>
      )}
    </div>
  );
}

function createNewRule(type, pressures) {
  const newRule = { type };
  if (type === 'entity_count_min') {
    newRule.kind = 'npc';
    newRule.min = 1;
  } else if (type === 'entity_count_max') {
    newRule.kind = 'npc';
    newRule.max = 10;
  } else if (type === 'pressure_threshold') {
    newRule.pressureId = pressures?.[0]?.id || '';
    newRule.min = 0;
    newRule.max = 100;
  } else if (type === 'era_match') {
    newRule.eras = [];
  } else if (type === 'or' || type === 'and') {
    newRule.rules = [];
  }
  return newRule;
}

function AddRuleButton({ onAdd, depth = 0 }) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="ge-add-item-btn"
        style={styles.addItemBtn}
        onClick={() => setShowPicker(!showPicker)}
      >
        + Add Rule
      </button>

      {showPicker && (
        <div style={styles.typePicker}>
          {Object.entries(APPLICABILITY_TYPES)
            .filter(([type]) => depth < 2 || (type !== 'or' && type !== 'and'))
            .map(([type, config]) => (
              <div
                key={type}
                className="ge-card-option"
                style={styles.typeOption}
                onClick={() => { onAdd(type); setShowPicker(false); }}
              >
                <div style={styles.typeOptionIcon}>{config.icon}</div>
                <div style={styles.typeOptionLabel}>{config.label}</div>
                <div style={styles.typeOptionDesc}>{config.desc}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function ApplicabilityTab({ generator, onChange, schema, pressures, eras }) {
  const rules = generator.applicability || [];

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Applicability Rules</div>
        <div style={styles.sectionDesc}>
          Define when this generator is eligible to run. If no rules are defined, the generator will
          always be eligible. Multiple top-level rules are combined with AND logic.
        </div>

        {rules.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>✓</div>
            <div style={styles.emptyTitle}>No applicability rules</div>
            <div style={styles.emptyDesc}>
              This generator will always be eligible to run. Add rules to control when it activates.
            </div>
          </div>
        ) : (
          rules.map((rule, index) => (
            <ApplicabilityRuleCard
              key={index}
              rule={rule}
              onChange={(updated) => {
                const newRules = [...rules];
                newRules[index] = updated;
                onChange({ ...generator, applicability: newRules });
              }}
              onRemove={() => onChange({ ...generator, applicability: rules.filter((_, i) => i !== index) })}
              schema={schema}
              pressures={pressures}
              eras={eras}
            />
          ))
        )}

        <AddRuleButton onAdd={(type) => {
          const newRule = createNewRule(type, pressures);
          onChange({ ...generator, applicability: [...rules, newRule] });
        }} />
      </div>
    </div>
  );
}

// ============================================================================
// TARGET TAB
// ============================================================================

function TargetTab({ generator, onChange, schema }) {
  const selection = generator.selection || {};

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const getSubtypeOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const updateSelection = (field, value) => {
    onChange({ ...generator, selection: { ...selection, [field]: value } });
  };

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Target Selection</div>

        <div style={styles.infoBox}>
          <div style={styles.infoBoxTitle}>What is $target?</div>
          <div style={styles.infoBoxText}>
            The <span style={styles.infoBoxCode}>$target</span> is the primary entity this generator operates on.
            It's selected from the world graph based on the rules you define here. Once selected, you can reference
            it in creation rules (e.g., inherit culture from $target) and relationships (e.g., connect new entity to $target).
          </div>
        </div>

        <div style={styles.formGrid}>
          <ReferenceDropdown
            label="Selection Strategy"
            value={selection.strategy || 'by_kind'}
            onChange={(v) => updateSelection('strategy', v)}
            options={[
              { value: 'by_kind', label: 'By Entity Kind' },
              { value: 'by_relationship', label: 'By Relationship' },
            ]}
          />
          <ReferenceDropdown
            label="Pick Strategy"
            value={selection.pickStrategy || 'random'}
            onChange={(v) => updateSelection('pickStrategy', v)}
            options={PICK_STRATEGIES}
          />
        </div>

        <div style={{ marginTop: '16px' }}>
          <div style={styles.formGrid}>
            <ReferenceDropdown
              label="Entity Kind"
              value={selection.kind}
              onChange={(v) => {
                updateSelection('kind', v);
                updateSelection('subtypes', undefined);
              }}
              options={entityKindOptions}
              placeholder="Select entity kind..."
            />
            {selection.kind && (
              <ChipSelect
                label="Subtypes (optional)"
                value={selection.subtypes || []}
                onChange={(v) => updateSelection('subtypes', v.length > 0 ? v : undefined)}
                options={getSubtypeOptions(selection.kind)}
                placeholder="Any subtype"
              />
            )}
          </div>
        </div>

        {/* Filters - shown as JSON for now since they're complex */}
        <div style={{ marginTop: '24px' }}>
          <label style={styles.label}>Advanced Filters (JSON)</label>
          <div style={{ ...styles.infoBoxText, marginBottom: '8px', fontSize: '12px' }}>
            Optional graph path filters to further narrow down target selection.
          </div>
          <textarea
            value={selection.filters ? JSON.stringify(selection.filters, null, 2) : ''}
            onChange={(e) => {
              try {
                const parsed = e.target.value ? JSON.parse(e.target.value) : undefined;
                updateSelection('filters', parsed);
              } catch {}
            }}
            style={styles.textarea}
            placeholder="[]"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// VARIABLES TAB
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

  const getSubtypeOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const updateSelect = (field, value) => {
    const newSelect = { ...selectConfig, [field]: value };
    onChange({ select: newSelect });
  };

  const displayKind = selectConfig.kind || 'Not configured';
  const displayStrategy = selectConfig.pickStrategy || 'random';

  return (
    <div style={styles.itemCard}>
      <div
        style={{ ...styles.itemCardHeader, ...(hovering ? styles.itemCardHeaderHover : {}) }}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div style={{ ...styles.itemCardIcon, backgroundColor: 'rgba(168, 85, 247, 0.2)' }}>📦</div>
        <div style={styles.itemCardInfo}>
          <div style={styles.itemCardTitle}>
            <span style={{ fontFamily: 'monospace', color: COLORS.purple }}>{name}</span>
          </div>
          <div style={styles.itemCardSubtitle}>
            {displayKind} • {displayStrategy}
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
            <ReferenceDropdown
              label="Entity Kind"
              value={selectConfig.kind}
              onChange={(v) => {
                updateSelect('kind', v);
                updateSelect('subtypes', undefined);
              }}
              options={entityKindOptions}
              placeholder="Select kind..."
            />
            <ReferenceDropdown
              label="Pick Strategy"
              value={selectConfig.pickStrategy || 'random'}
              onChange={(v) => updateSelect('pickStrategy', v)}
              options={PICK_STRATEGIES}
            />
          </div>
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
        </div>
      )}
    </div>
  );
}

function VariablesTab({ generator, onChange, schema }) {
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
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Variables</div>

        <div style={styles.infoBox}>
          <div style={styles.infoBoxTitle}>What are variables?</div>
          <div style={styles.infoBoxText}>
            Variables let you select additional entities from the graph to use in creation and relationships.
            For example, you might select a <span style={styles.infoBoxCode}>$faction</span> to make a new NPC a member of,
            or an <span style={styles.infoBoxCode}>$ability</span> for them to practice.
            Variables are selected after <span style={styles.infoBoxCode}>$target</span> is chosen.
          </div>
        </div>

        {varEntries.length === 0 && !showAddForm ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📦</div>
            <div style={styles.emptyTitle}>No variables defined</div>
            <div style={styles.emptyDesc}>
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
          <div style={{ ...styles.itemCard, backgroundColor: COLORS.bgDark, padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Variable Name</label>
                <input
                  type="text"
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value.replace(/[^a-zA-Z0-9_$]/g, ''))}
                  style={styles.input}
                  placeholder="$myVariable"
                  autoFocus
                />
              </div>
              <button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={handleAddVariable} disabled={!newVarName.trim()}>
                Add
              </button>
              <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={() => { setShowAddForm(false); setNewVarName(''); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="ge-add-item-btn"
            style={styles.addItemBtn}
            onClick={() => setShowAddForm(true)}
          >
            + Add Variable
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CREATION TAB
// ============================================================================

function CreationCard({ item, index, onChange, onRemove, schema, availableRefs, namingData = {}, cultureIds = [], generator, tagRegistry = [], onAddToRegistry }) {
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
    <div style={styles.itemCard}>
      <div
        style={{ ...styles.itemCardHeader, ...(hovering ? styles.itemCardHeaderHover : {}) }}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div style={{ ...styles.itemCardIcon, backgroundColor: 'rgba(59, 130, 246, 0.2)' }}>✨</div>
        <div style={styles.itemCardInfo}>
          <div style={styles.itemCardTitle}>
            <span style={{ fontFamily: 'monospace', color: COLORS.textDim }}>{item.entityRef}</span>
          </div>
          <div style={styles.itemCardSubtitle}>
            {item.kind}{subtypeDisplay ? `:${subtypeDisplay}` : ''} • {item.prominence || 'no prominence'}
          </div>
          {/* Naming profile indicator */}
          {cultureIds.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              {profileMatches.length > 0 ? (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  color: '#22c55e',
                }}>
                  <span>✓</span>
                  <span>
                    {profileMatches.length === 1
                      ? profileMatches[0].profileId
                      : `${profileMatches.length} profiles`}
                  </span>
                </span>
              ) : (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#ef4444',
                }}>
                  <span>!</span>
                  <span>No naming profile</span>
                </span>
              )}
            </div>
          )}
        </div>
        <div style={styles.itemCardActions}>
          <button style={styles.iconBtn}>{expanded ? '▲' : '▼'}</button>
          <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>
        </div>
      </div>

      {expanded && (
        <div style={styles.itemCardBody}>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Entity Reference</label>
              <input
                type="text"
                value={item.entityRef || ''}
                onChange={(e) => updateField('entityRef', e.target.value)}
                style={styles.input}
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

          <div style={{ marginTop: '16px' }}>
            <ProminenceSelector value={item.prominence} onChange={(v) => updateField('prominence', v)} />
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={styles.label}>Culture</label>
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
                  style={{ ...styles.input, flex: 1 }}
                  placeholder="culture_id"
                />
              )}
            </div>
          </div>

          {/* PLACEMENT EDITOR */}
          <div style={{ marginTop: '16px' }}>
            <label style={styles.label}>Placement</label>
            <div style={{
              fontSize: '11px',
              color: COLORS.textMuted,
              marginBottom: '8px',
              padding: '6px 8px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '4px',
              borderLeft: `3px solid ${COLORS.textDim}`,
            }}>
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
              <div style={{
                marginTop: '8px',
                padding: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#ef4444',
              }}>
                ⚠️ No same-kind ({item.kind}) variables or targets available. Define a variable that selects {item.kind} entities,
                or use "In culture region" placement instead.
              </div>
            )}
          </div>

          {/* TAGS EDITOR */}
          <div style={{ marginTop: '16px' }}>
            <label style={styles.label}>Tags</label>
            <div style={{
              fontSize: '11px',
              color: COLORS.textMuted,
              marginBottom: '8px',
            }}>
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

function CreationTab({ generator, onChange, schema, namingData = {}, tagRegistry = [], onAddToRegistry }) {
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
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Entity Creation</div>
        <div style={styles.sectionDesc}>
          Define entities that this generator creates. Each entity gets a reference (like <span style={styles.infoBoxCode}>$hero</span>)
          that can be used in relationships.
        </div>

        {creation.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>✨</div>
            <div style={styles.emptyTitle}>No entities created</div>
            <div style={styles.emptyDesc}>
              This generator only modifies existing entities. Add creation rules to spawn new entities.
            </div>
          </div>
        ) : (
          creation.map((item, index) => (
            <CreationCard
              key={index}
              item={item}
              index={index}
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
          className="ge-add-item-btn"
          style={styles.addItemBtn}
          onClick={handleAdd}
        >
          + Add Entity Creation
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// RELATIONSHIPS TAB
// ============================================================================

function RelationshipCard({ rel, onChange, onRemove, schema, availableRefs }) {
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateField = (field, value) => {
    onChange({ ...rel, [field]: value });
  };

  return (
    <div style={styles.itemCard}>
      <div
        style={{ ...styles.itemCardHeader, ...(hovering ? styles.itemCardHeaderHover : {}) }}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div style={styles.relVisual}>
          <span style={styles.relRef}>{rel.src || '?'}</span>
          <span style={styles.relArrow}>→</span>
          <span style={styles.relKind}>{rel.kind || '?'}</span>
          <span style={styles.relArrow}>→</span>
          <span style={styles.relRef}>{rel.dst || '?'}</span>
          {rel.bidirectional && <span style={{ fontSize: '11px', color: COLORS.teal, marginLeft: '8px' }}>↔</span>}
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
              label="Relationship Kind"
              value={rel.kind}
              onChange={(v) => updateField('kind', v)}
              options={relationshipKindOptions}
            />
            <ReferenceDropdown
              label="Source"
              value={rel.src}
              onChange={(v) => updateField('src', v)}
              options={availableRefs.map((r) => ({ value: r, label: r }))}
            />
            <ReferenceDropdown
              label="Destination"
              value={rel.dst}
              onChange={(v) => updateField('dst', v)}
              options={availableRefs.map((r) => ({ value: r, label: r }))}
            />
            <div style={styles.formGroup}>
              <label style={styles.label}>Strength</label>
              <input
                type="number"
                value={rel.strength ?? ''}
                onChange={(e) => updateField('strength', parseFloat(e.target.value) || undefined)}
                style={styles.input}
                step="0.1"
                min="0"
                max="1"
                placeholder="0.8"
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={styles.label}>Bidirectional</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                onClick={() => updateField('bidirectional', !rel.bidirectional)}
                style={{ ...styles.enableToggle, ...(rel.bidirectional ? styles.enableToggleOn : {}) }}
              >
                <div style={{ ...styles.toggleKnob, ...(rel.bidirectional ? styles.toggleKnobOn : {}) }} />
              </div>
              <span style={{ fontSize: '13px', color: COLORS.textMuted }}>
                {rel.bidirectional ? 'Creates relationships in both directions' : 'One-way relationship'}
              </span>
            </div>
          </div>

          {/* Condition - show as JSON */}
          {rel.condition && (
            <div style={{ marginTop: '16px' }}>
              <label style={styles.label}>Condition (JSON)</label>
              <textarea
                value={JSON.stringify(rel.condition, null, 2)}
                onChange={(e) => { try { updateField('condition', JSON.parse(e.target.value)); } catch {} }}
                style={{ ...styles.textarea, minHeight: '60px' }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RelationshipsTab({ generator, onChange, schema }) {
  const relationships = generator.relationships || [];

  const availableRefs = useMemo(() => {
    const refs = ['$target'];
    Object.keys(generator.variables || {}).forEach((v) => refs.push(v));
    (generator.creation || []).forEach((c) => { if (c.entityRef) refs.push(c.entityRef); });
    return refs;
  }, [generator.variables, generator.creation]);

  const handleAdd = () => {
    onChange({
      ...generator,
      relationships: [...relationships, {
        kind: schema?.relationshipKinds?.[0]?.kind || 'ally_of',
        src: availableRefs[1] || '$entity1',
        dst: '$target',
        strength: 0.8,
      }],
    });
  };

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Relationships</div>
        <div style={styles.sectionDesc}>
          Define relationships created between entities. Use entity references like <span style={styles.infoBoxCode}>$target</span>,
          created entities like <span style={styles.infoBoxCode}>$hero</span>, or variables like <span style={styles.infoBoxCode}>$faction</span>.
        </div>

        {relationships.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🔗</div>
            <div style={styles.emptyTitle}>No relationships</div>
            <div style={styles.emptyDesc}>
              This generator doesn't create any relationships. Add relationships to connect entities.
            </div>
          </div>
        ) : (
          relationships.map((rel, index) => (
            <RelationshipCard
              key={index}
              rel={rel}
              onChange={(updated) => {
                const newRels = [...relationships];
                newRels[index] = updated;
                onChange({ ...generator, relationships: newRels });
              }}
              onRemove={() => onChange({ ...generator, relationships: relationships.filter((_, i) => i !== index) })}
              schema={schema}
              availableRefs={availableRefs}
            />
          ))
        )}

        <button
          className="ge-add-item-btn"
          style={styles.addItemBtn}
          onClick={handleAdd}
        >
          + Add Relationship
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// EFFECTS TAB
// ============================================================================

function EffectsTab({ generator, onChange, pressures, schema }) {
  const stateUpdates = generator.stateUpdates || [];

  const pressureOptions = (pressures || []).map((p) => ({ value: p.id, label: p.name || p.id }));
  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({ value: rk.kind, label: rk.description || rk.kind }));

  const handleAddPressure = () => {
    onChange({
      ...generator,
      stateUpdates: [...stateUpdates, { type: 'modify_pressure', pressureId: pressures?.[0]?.id || '', delta: 0 }],
    });
  };

  const handleAddArchive = () => {
    onChange({
      ...generator,
      stateUpdates: [...stateUpdates, { type: 'archive_relationship', entity: '$target', relationshipKind: '' }],
    });
  };

  const handleUpdate = (index, updated) => {
    const newUpdates = [...stateUpdates];
    newUpdates[index] = updated;
    onChange({ ...generator, stateUpdates: newUpdates });
  };

  const handleRemove = (index) => {
    onChange({ ...generator, stateUpdates: stateUpdates.filter((_, i) => i !== index) });
  };

  const pressureUpdates = stateUpdates.filter((u) => u.type === 'modify_pressure');
  const archiveUpdates = stateUpdates.filter((u) => u.type === 'archive_relationship');

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}><span>🌡️</span> Pressure Modifications</div>
        <div style={styles.sectionDesc}>
          Change pressure values when this generator runs. Positive values increase pressure, negative values decrease it.
        </div>

        {pressureUpdates.map((update) => {
          const globalIdx = stateUpdates.indexOf(update);
          return (
            <div key={globalIdx} style={styles.itemCard}>
              <div style={{ padding: '16px' }}>
                <div style={styles.formGrid}>
                  <ReferenceDropdown
                    label="Pressure"
                    value={update.pressureId}
                    onChange={(v) => handleUpdate(globalIdx, { ...update, pressureId: v })}
                    options={pressureOptions}
                  />
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Delta</label>
                    <input
                      type="number"
                      value={update.delta ?? ''}
                      onChange={(e) => handleUpdate(globalIdx, { ...update, delta: parseInt(e.target.value) || 0 })}
                      style={styles.input}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={() => handleRemove(globalIdx)}>×</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <button
          className="ge-add-item-btn"
          style={styles.addItemBtn}
          onClick={handleAddPressure}
        >
          + Add Pressure Modification
        </button>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}><span>📦</span> Archive Relationships</div>
        <div style={styles.sectionDesc}>Archive (end) existing relationships when this generator runs.</div>

        {archiveUpdates.map((update) => {
          const globalIdx = stateUpdates.indexOf(update);
          return (
            <div key={globalIdx} style={styles.itemCard}>
              <div style={{ padding: '16px' }}>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Entity</label>
                    <input
                      type="text"
                      value={update.entity || ''}
                      onChange={(e) => handleUpdate(globalIdx, { ...update, entity: e.target.value })}
                      style={styles.input}
                      placeholder="$target"
                    />
                  </div>
                  <ReferenceDropdown
                    label="Relationship Kind"
                    value={update.relationshipKind}
                    onChange={(v) => handleUpdate(globalIdx, { ...update, relationshipKind: v })}
                    options={relationshipKindOptions}
                  />
                  <div style={styles.formGroup}>
                    <label style={styles.label}>With Entity</label>
                    <input
                      type="text"
                      value={update.with || ''}
                      onChange={(e) => handleUpdate(globalIdx, { ...update, with: e.target.value || undefined })}
                      style={styles.input}
                      placeholder="Optional"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} onClick={() => handleRemove(globalIdx)}>×</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <button
          className="ge-add-item-btn"
          style={styles.addItemBtn}
          onClick={handleAddArchive}
        >
          + Add Archive Rule
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// GENERATOR MODAL
// ============================================================================

// Helper to compute validation issues per generator tab
function computeTabValidation(generator, usageMap) {
  const validation = usageMap ? getElementValidation(usageMap, 'generator', generator.id) : { invalidRefs: [], isOrphan: false };

  // Group errors by tab
  const tabErrors = {
    overview: 0,
    applicability: 0,
    target: 0,
    variables: 0,
    creation: 0,
    relationships: 0,
    effects: 0,
  };

  validation.invalidRefs.forEach(ref => {
    if (ref.field.includes('applicability')) tabErrors.applicability++;
    else if (ref.field.includes('selection') || ref.field.includes('target')) tabErrors.target++;
    else if (ref.field.includes('creation')) tabErrors.creation++;
    else if (ref.field.includes('relationships')) tabErrors.relationships++;
    else if (ref.field.includes('stateUpdates') || ref.field.includes('pressure')) tabErrors.effects++;
  });

  return { tabErrors, isOrphan: validation.isOrphan, totalErrors: validation.invalidRefs.length };
}

// Validation badge component for tabs
function TabValidationBadge({ count }) {
  if (!count) return null;
  return (
    <span style={{ ...validationStyles.validationBadge, ...validationStyles.errorBadge }}>
      {count}
    </span>
  );
}

function GeneratorModal({ generator, onChange, onClose, onDelete, schema, pressures, eras, usageMap, namingData, tagRegistry = [] }) {
  const [activeTab, setActiveTab] = useState('overview');

  // Compute validation for this generator
  const tabValidation = useMemo(() =>
    computeTabValidation(generator, usageMap),
    [generator, usageMap]
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab generator={generator} onChange={onChange} onDelete={onDelete} />;
      case 'applicability':
        return <ApplicabilityTab generator={generator} onChange={onChange} schema={schema} pressures={pressures} eras={eras} />;
      case 'target':
        return <TargetTab generator={generator} onChange={onChange} schema={schema} />;
      case 'variables':
        return <VariablesTab generator={generator} onChange={onChange} schema={schema} />;
      case 'creation':
        return <CreationTab generator={generator} onChange={onChange} schema={schema} namingData={namingData} tagRegistry={tagRegistry} />;
      case 'relationships':
        return <RelationshipsTab generator={generator} onChange={onChange} schema={schema} />;
      case 'effects':
        return <EffectsTab generator={generator} onChange={onChange} pressures={pressures} schema={schema} />;
      default:
        return null;
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>
            <span style={{ fontSize: '20px' }}>⚙️</span>
            <span>{generator.name || generator.id}</span>
            {generator.enabled === false && (
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
                className={`ge-tab-btn ${activeTab === tab.id ? 'ge-tab-btn-active' : ''}`}
                style={{ ...styles.tabBtn, ...(activeTab === tab.id ? styles.tabBtnActive : {}) }}
                onClick={() => setActiveTab(tab.id)}
              >
                <span style={styles.tabIcon}>{tab.icon}</span>
                <span>{tab.label}</span>
                <TabValidationBadge count={tabValidation.tabErrors[tab.id]} />
              </button>
            ))}
            {tabValidation.isOrphan && (
              <div style={{ padding: '12px', marginTop: '12px', borderTop: `1px solid ${COLORS.border}` }}>
                <span style={{ ...validationStyles.validationBadge, ...validationStyles.orphanBadge, marginLeft: 0 }}>
                  Not in any era
                </span>
              </div>
            )}
          </div>
          <div style={styles.tabContent}>{renderTabContent()}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CATEGORY SECTION COMPONENT
// ============================================================================

function CategorySection({
  id,
  icon,
  label,
  items,
  expanded,
  onToggleExpand,
  allEnabled,
  onToggleAll,
  renderItem,
}) {
  const [hovering, setHovering] = useState(false);

  return (
    <div style={styles.categorySection}>
      <div
        style={{
          ...styles.categoryHeader,
          ...(hovering ? styles.categoryHeaderHover : {}),
        }}
        onClick={onToggleExpand}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <span
          style={{
            ...styles.categoryExpand,
            ...(expanded ? styles.categoryExpandOpen : {}),
          }}
        >
          ▶
        </span>
        <span style={styles.categoryIcon}>{icon}</span>
        <span style={styles.categoryTitle}>{label}</span>
        <span style={styles.categoryCount}>{items.length}</span>
        <button
          style={{
            ...styles.categoryToggleAll,
            ...(allEnabled ? styles.categoryToggleAllActive : {}),
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleAll();
          }}
        >
          {allEnabled ? '✓ All On' : 'All Off'}
        </button>
      </div>
      {expanded && (
        <div style={styles.generatorGrid}>
          {items.map(renderItem)}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function GeneratorListCard({ generator, onClick, onToggle, usageMap }) {
  const [hovering, setHovering] = useState(false);
  const isEnabled = generator.enabled !== false;

  const summary = useMemo(() => {
    const creates = generator.creation?.map((c) => c.kind).filter((v, i, a) => a.indexOf(v) === i) || [];
    const rels = generator.relationships?.length || 0;
    const effects = generator.stateUpdates?.length || 0;
    return { creates, rels, effects };
  }, [generator]);

  // Get validation and usage info
  const validation = useMemo(() =>
    usageMap ? getElementValidation(usageMap, 'generator', generator.id) : { invalidRefs: [], isOrphan: false },
    [usageMap, generator.id]
  );

  const eraUsage = useMemo(() => {
    if (!usageMap?.generators?.[generator.id]) return [];
    return usageMap.generators[generator.id].eras || [];
  }, [usageMap, generator.id]);

  const hasErrors = validation.invalidRefs.length > 0;
  const isOrphan = validation.isOrphan;

  return (
    <div
      style={{
        ...styles.generatorCard,
        ...(hovering ? styles.generatorCardHover : {}),
        ...(isEnabled ? {} : styles.generatorCardDisabled),
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
            <span style={styles.cardTitle}>{generator.name || generator.id}</span>
            {hasErrors && (
              <span style={{ ...validationStyles.validationBadge, ...validationStyles.errorBadge, marginLeft: 0 }}>
                {validation.invalidRefs.length} error{validation.invalidRefs.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={styles.cardId}>{generator.id}</div>
        </div>
        <div
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{ ...styles.enableToggle, ...(isEnabled ? styles.enableToggleOn : {}) }}
        >
          <div style={{ ...styles.toggleKnob, ...(isEnabled ? styles.toggleKnobOn : {}) }} />
        </div>
      </div>

      <div style={styles.cardStats}>
        <div style={styles.cardStat}><span>✨</span> {generator.creation?.length || 0} creates</div>
        <div style={styles.cardStat}><span>🔗</span> {summary.rels} rels</div>
        <div style={styles.cardStat}><span>⚡</span> {summary.effects} effects</div>
      </div>

      <div style={styles.cardBadges}>
        {summary.creates.slice(0, 3).map((kind) => (
          <span key={kind} style={{ ...styles.badge, backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>+ {kind}</span>
        ))}
      </div>

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

// Default icons for entity kinds (used when schema doesn't provide one)
const DEFAULT_KIND_ICONS = {
  npc: '👤',
  location: '📍',
  faction: '🏛️',
  abilities: '✨',
  rules: '📜',
  era: '🕰️',
  occurrence: '⚡',
};

export default function GeneratorsEditor({ generators = [], onChange, schema, pressures = [], eras = [], usageMap, namingData = {} }) {
  useHoverStyles();
  const [selectedGenerator, setSelectedGenerator] = useState(null);
  const [addHovering, setAddHovering] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});

  // Build entity kind info map for icons and labels
  const entityKindInfo = useMemo(() => {
    const info = {};
    (schema?.entityKinds || []).forEach((ek) => {
      info[ek.kind] = {
        label: ek.description || ek.name || ek.kind,
        icon: ek.icon || DEFAULT_KIND_ICONS[ek.kind] || '📦',
      };
    });
    return info;
  }, [schema]);

  // Group generators by the primary entity kind they create
  const groupedGenerators = useMemo(() => {
    const groups = {};

    generators.forEach((generator) => {
      // Get primary creation kind (first entity created, or target kind if no creation)
      const createdKinds = (generator.creation || []).map(c => c.kind).filter(Boolean);
      const primaryKind = createdKinds[0] || generator.selection?.kind || 'uncategorized';

      if (!groups[primaryKind]) {
        groups[primaryKind] = [];
      }
      groups[primaryKind].push(generator);
    });

    return groups;
  }, [generators]);

  // Get ordered list of categories
  const categories = useMemo(() => {
    // Order by schema entity kinds first, then any uncategorized
    const schemaKinds = (schema?.entityKinds || []).map(ek => ek.kind);
    const usedKinds = Object.keys(groupedGenerators);

    // Sort: schema kinds in order, then others alphabetically
    return usedKinds.sort((a, b) => {
      const aIdx = schemaKinds.indexOf(a);
      const bIdx = schemaKinds.indexOf(b);
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [groupedGenerators, schema]);

  // Initialize expanded state for new categories
  useEffect(() => {
    setExpandedCategories(prev => {
      const updated = { ...prev };
      categories.forEach(cat => {
        if (updated[cat] === undefined) {
          updated[cat] = true; // Start expanded
        }
      });
      return updated;
    });
  }, [categories]);

  const handleGeneratorChange = useCallback((updated) => {
    const index = generators.findIndex((g) => g.id === selectedGenerator.id);
    if (index >= 0) {
      const newGenerators = [...generators];
      newGenerators[index] = updated;
      onChange(newGenerators);
      setSelectedGenerator(updated);
    }
  }, [generators, onChange, selectedGenerator]);

  const handleToggle = useCallback((generator) => {
    const index = generators.findIndex((g) => g.id === generator.id);
    if (index >= 0) {
      const newGenerators = [...generators];
      newGenerators[index] = { ...generator, enabled: generator.enabled === false ? true : false };
      onChange(newGenerators);
    }
  }, [generators, onChange]);

  const handleDelete = useCallback(() => {
    if (selectedGenerator && confirm(`Delete generator "${selectedGenerator.name || selectedGenerator.id}"?`)) {
      onChange(generators.filter((g) => g.id !== selectedGenerator.id));
      setSelectedGenerator(null);
    }
  }, [generators, onChange, selectedGenerator]);

  const handleAdd = useCallback(() => {
    const newGenerator = {
      id: `generator_${Date.now()}`,
      name: 'New Generator',
      applicability: [],
      selection: { strategy: 'by_kind', kind: 'location', pickStrategy: 'random' },
      creation: [],
      relationships: [],
      stateUpdates: [],
      variables: {},
    };
    onChange([...generators, newGenerator]);
    setSelectedGenerator(newGenerator);
  }, [generators, onChange]);

  const toggleCategoryExpand = useCallback((kind) => {
    setExpandedCategories(prev => ({
      ...prev,
      [kind]: !prev[kind],
    }));
  }, []);

  const toggleAllInCategory = useCallback((kind) => {
    const categoryItems = groupedGenerators[kind] || [];
    const allEnabled = categoryItems.every(g => g.enabled !== false);
    const newEnabled = !allEnabled;

    // Get IDs of generators in this category
    const categoryIds = new Set(categoryItems.map(g => g.id));

    const newGenerators = generators.map(g => {
      if (categoryIds.has(g.id)) {
        return { ...g, enabled: newEnabled };
      }
      return g;
    });
    onChange(newGenerators);
  }, [generators, groupedGenerators, onChange]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Generators</h1>
        <p style={styles.subtitle}>Configure entity generators that populate your world. Click a generator to edit.</p>
      </div>

      {/* Category sections */}
      {categories.map((kind) => {
        const kindInfo = entityKindInfo[kind] || {
          label: kind.charAt(0).toUpperCase() + kind.slice(1),
          icon: DEFAULT_KIND_ICONS[kind] || '📦',
        };
        const categoryItems = groupedGenerators[kind] || [];
        const allEnabled = categoryItems.every(g => g.enabled !== false);

        return (
          <CategorySection
            key={kind}
            id={kind}
            icon={kindInfo.icon}
            label={`${kindInfo.label} Generators`}
            items={categoryItems}
            expanded={expandedCategories[kind] !== false}
            onToggleExpand={() => toggleCategoryExpand(kind)}
            allEnabled={allEnabled}
            onToggleAll={() => toggleAllInCategory(kind)}
            renderItem={(generator) => (
              <GeneratorListCard
                key={generator.id}
                generator={generator}
                onClick={() => setSelectedGenerator(generator)}
                onToggle={() => handleToggle(generator)}
                usageMap={usageMap}
              />
            )}
          />
        );
      })}

      {/* Add Generator button */}
      <div style={{ marginTop: '16px' }}>
        <div
          style={{ ...styles.addCard, ...(addHovering ? styles.addCardHover : {}), maxWidth: '320px' }}
          onClick={handleAdd}
          onMouseEnter={() => setAddHovering(true)}
          onMouseLeave={() => setAddHovering(false)}
        >
          <span style={{ fontSize: '24px' }}>+</span>
          <span>Add Generator</span>
        </div>
      </div>

      {selectedGenerator && (
        <GeneratorModal
          generator={selectedGenerator}
          onChange={handleGeneratorChange}
          onClose={() => setSelectedGenerator(null)}
          onDelete={handleDelete}
          schema={schema}
          pressures={pressures}
          eras={eras}
          usageMap={usageMap}
          namingData={namingData}
          tagRegistry={schema.tagRegistry || []}
        />
      )}
    </div>
  );
}
