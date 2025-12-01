/**
 * PressuresEditor - Full-featured editor for pressure configurations
 *
 * Pressures are environmental/social forces that drive world evolution.
 * Each pressure has:
 * - Basic config (id, name, initialValue, decay)
 * - Growth config with positive and negative feedback factors
 *
 * This editor provides:
 * - Visual pressure cards with stats overview
 * - Full editing of all pressure properties
 * - Add/edit/remove feedback factors
 * - Reference lookups for entity kinds, relationship kinds, tags
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// Arctic Blue base theme with amber accent
const ACCENT_COLOR = '#f59e0b';
const ACCENT_GRADIENT = 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)';

// Factor type configuration with visual styling
const FACTOR_TYPES = {
  entity_count: {
    label: 'Entity Count',
    description: 'Count entities matching criteria',
    icon: '👥',
    color: '#3b82f6',
    fields: ['kind', 'subtype', 'status', 'coefficient', 'cap'],
  },
  relationship_count: {
    label: 'Relationship Count',
    description: 'Count relationships of specified types',
    icon: '🔗',
    color: '#8b5cf6',
    fields: ['relationshipKinds', 'coefficient', 'cap'],
  },
  tag_count: {
    label: 'Tag Count',
    description: 'Count entities with specific tags',
    icon: '🏷️',
    color: '#10b981',
    fields: ['tags', 'coefficient'],
  },
  ratio: {
    label: 'Ratio',
    description: 'Ratio between two counts',
    icon: '📊',
    color: '#f59e0b',
    fields: ['numerator', 'denominator', 'coefficient', 'fallbackValue', 'cap'],
  },
  status_ratio: {
    label: 'Status Ratio',
    description: 'Ratio of entities with specific status',
    icon: '💫',
    color: '#ec4899',
    fields: ['kind', 'subtype', 'aliveStatus', 'coefficient'],
  },
  cross_culture_ratio: {
    label: 'Cross-Culture Ratio',
    description: 'Ratio of cross-cultural relationships',
    icon: '🌍',
    color: '#14b8a6',
    fields: ['relationshipKinds', 'coefficient'],
  },
};

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
    color: '#ffffff',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#93c5fd',
  },
  pressureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  pressureCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    overflow: 'hidden',
  },
  pressureHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  pressureHeaderHover: {
    backgroundColor: '#2d4a6f',
  },
  pressureTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  pressureName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
  },
  pressureId: {
    fontSize: '12px',
    color: '#60a5fa',
    backgroundColor: '#0c1f2e',
    padding: '2px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
  },
  pressureStats: {
    display: 'flex',
    gap: '16px',
    fontSize: '13px',
    color: '#93c5fd',
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statLabel: {
    color: '#60a5fa',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statValue: {
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '14px',
  },
  statBar: {
    width: '60px',
    height: '4px',
    backgroundColor: '#0c1f2e',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s',
  },
  expandIcon: {
    fontSize: '14px',
    color: '#60a5fa',
    transition: 'transform 0.2s',
    marginLeft: '16px',
  },
  expandIconOpen: {
    transform: 'rotate(180deg)',
  },
  pressureContent: {
    padding: '0 20px 20px',
    borderTop: '1px solid rgba(59, 130, 246, 0.2)',
  },
  section: {
    marginTop: '20px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#93c5fd',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionIcon: {
    fontSize: '16px',
  },
  sectionCount: {
    fontSize: '11px',
    backgroundColor: '#0c1f2e',
    color: '#60a5fa',
    padding: '2px 8px',
    borderRadius: '10px',
    marginLeft: '8px',
  },
  inputGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
  },
  inputGroup: {
    marginBottom: '0',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: '#60a5fa',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: '#0a1929',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    color: '#ffffff',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    outline: 'none',
  },
  inputFocus: {
    borderColor: ACCENT_COLOR,
    boxShadow: `0 0 0 3px rgba(245, 158, 11, 0.1)`,
  },
  factorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  factorCard: {
    backgroundColor: '#0c1f2e',
    borderRadius: '10px',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    overflow: 'hidden',
    transition: 'border-color 0.15s',
  },
  factorCardHover: {
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  factorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    cursor: 'pointer',
  },
  factorIcon: {
    fontSize: '20px',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    flexShrink: 0,
  },
  factorInfo: {
    flex: 1,
    minWidth: 0,
  },
  factorType: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#ffffff',
  },
  factorSummary: {
    fontSize: '12px',
    color: '#93c5fd',
    marginTop: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  factorCoefficient: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#ffffff',
    backgroundColor: '#1e3a5f',
    padding: '4px 10px',
    borderRadius: '6px',
    flexShrink: 0,
  },
  factorActions: {
    display: 'flex',
    gap: '4px',
    flexShrink: 0,
  },
  iconButton: {
    padding: '6px',
    fontSize: '14px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#60a5fa',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    color: '#ef4444',
  },
  addFactorButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    border: '2px dashed rgba(59, 130, 246, 0.3)',
    borderRadius: '10px',
    color: '#60a5fa',
    cursor: 'pointer',
    transition: 'all 0.15s',
    marginTop: '8px',
  },
  addButtonHover: {
    borderColor: ACCENT_COLOR,
    color: ACCENT_COLOR,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  addPressureButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '16px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    border: '2px dashed rgba(59, 130, 246, 0.3)',
    borderRadius: '12px',
    color: '#60a5fa',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    color: '#60a5fa',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  emptyFactors: {
    padding: '16px',
    textAlign: 'center',
    color: '#60a5fa',
    fontSize: '13px',
    fontStyle: 'italic',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: '8px',
  },
  // Modal styles
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
    backgroundColor: '#1e3a5f',
    borderRadius: '16px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    width: '90vw',
    maxWidth: '600px',
    maxHeight: '85vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  modalClose: {
    padding: '6px',
    fontSize: '20px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#60a5fa',
    cursor: 'pointer',
    borderRadius: '6px',
    lineHeight: 1,
  },
  modalContent: {
    padding: '20px',
    overflowY: 'auto',
    flex: 1,
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid rgba(59, 130, 246, 0.2)',
    backgroundColor: '#0c1f2e',
  },
  button: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    border: 'none',
  },
  buttonPrimary: {
    background: ACCENT_GRADIENT,
    color: '#0a1929',
  },
  buttonSecondary: {
    backgroundColor: '#0a1929',
    color: '#93c5fd',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  buttonDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  // Type selector - compact pill style
  typeSelector: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '16px',
  },
  typePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '20px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    backgroundColor: '#0a1929',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontSize: '13px',
    color: '#93c5fd',
  },
  typePillSelected: {
    borderColor: ACCENT_COLOR,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: '#fbbf24',
  },
  typePillIcon: {
    fontSize: '14px',
  },
  typeDescription: {
    fontSize: '12px',
    color: '#60a5fa',
    marginTop: '8px',
    padding: '10px 12px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: '6px',
    borderLeft: `3px solid ${ACCENT_COLOR}`,
  },
  // Dropdown styles
  dropdown: {
    position: 'relative',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    backgroundColor: '#0c1f2e',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    borderRadius: '8px',
    maxHeight: '200px',
    overflowY: 'auto',
    zIndex: 100,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  },
  dropdownItem: {
    padding: '10px 12px',
    cursor: 'pointer',
    transition: 'background-color 0.1s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  dropdownItemHover: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  dropdownItemLabel: {
    fontSize: '13px',
    color: '#ffffff',
  },
  dropdownItemMeta: {
    fontSize: '11px',
    color: '#60a5fa',
    marginLeft: 'auto',
  },
  // Multi-select chips
  chipContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    padding: '8px',
    backgroundColor: '#0a1929',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    minHeight: '42px',
    alignItems: 'center',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: '#1e3a5f',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#93c5fd',
  },
  chipRemove: {
    background: 'none',
    border: 'none',
    color: '#60a5fa',
    cursor: 'pointer',
    padding: '0 2px',
    fontSize: '14px',
    lineHeight: 1,
  },
  chipInput: {
    flex: 1,
    minWidth: '80px',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: '13px',
    color: '#ffffff',
    padding: '4px',
  },
  // Nested factor editor (for ratio type)
  nestedSection: {
    backgroundColor: '#1e3a5f',
    borderRadius: '8px',
    padding: '12px',
    marginTop: '12px',
  },
  nestedTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#60a5fa',
    marginBottom: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
};

// ============================================================================
// REFERENCE DROPDOWN COMPONENT
// ============================================================================

function ReferenceDropdown({ value, onChange, options, placeholder, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter(opt =>
      opt.value.toLowerCase().includes(lower) ||
      opt.label?.toLowerCase().includes(lower)
    );
  }, [options, search]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div style={styles.inputGroup}>
      {label && <label style={styles.label}>{label}</label>}
      <div ref={containerRef} style={styles.dropdown}>
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            ...styles.input,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: selectedOption ? '#ffffff' : '#60a5fa' }}>
            {selectedOption?.label || selectedOption?.value || placeholder || 'Select...'}
          </span>
          <span style={{ color: '#60a5fa', fontSize: '10px' }}>▼</span>
        </div>
        {isOpen && (
          <div style={styles.dropdownMenu}>
            <div style={{ padding: '8px', borderBottom: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  ...styles.input,
                  padding: '8px 10px',
                  fontSize: '13px',
                }}
                autoFocus
              />
            </div>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: '#60a5fa', fontSize: '13px' }}>
                No options found
              </div>
            ) : (
              filteredOptions.map((opt, idx) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(-1)}
                  style={{
                    ...styles.dropdownItem,
                    ...(hoveredIndex === idx ? styles.dropdownItemHover : {}),
                    ...(value === opt.value ? styles.dropdownItemSelected : {}),
                  }}
                >
                  <span style={styles.dropdownItemLabel}>{opt.label || opt.value}</span>
                  {opt.meta && <span style={styles.dropdownItemMeta}>{opt.meta}</span>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MULTI-SELECT CHIPS COMPONENT
// ============================================================================

function MultiSelectChips({ value = [], onChange, options, placeholder, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const availableOptions = useMemo(() => {
    return options.filter(opt => !value.includes(opt.value));
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!search) return availableOptions;
    const lower = search.toLowerCase();
    return availableOptions.filter(opt =>
      opt.value.toLowerCase().includes(lower) ||
      opt.label?.toLowerCase().includes(lower)
    );
  }, [availableOptions, search]);

  const handleSelect = (optValue) => {
    onChange([...value, optValue]);
    setSearch('');
    inputRef.current?.focus();
  };

  const handleRemove = (optValue) => {
    onChange(value.filter(v => v !== optValue));
  };

  const getLabel = (val) => {
    const opt = options.find(o => o.value === val);
    return opt?.label || val;
  };

  return (
    <div style={styles.inputGroup}>
      {label && <label style={styles.label}>{label}</label>}
      <div ref={containerRef} style={styles.dropdown}>
        <div
          style={styles.chipContainer}
          onClick={() => {
            setIsOpen(true);
            inputRef.current?.focus();
          }}
        >
          {value.map(v => (
            <span key={v} style={styles.chip}>
              {getLabel(v)}
              <button
                type="button"
                style={styles.chipRemove}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(v);
                }}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            placeholder={value.length === 0 ? placeholder : ''}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            style={styles.chipInput}
          />
        </div>
        {isOpen && filteredOptions.length > 0 && (
          <div style={styles.dropdownMenu}>
            {filteredOptions.map((opt, idx) => (
              <div
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(-1)}
                style={{
                  ...styles.dropdownItem,
                  ...(hoveredIndex === idx ? styles.dropdownItemHover : {}),
                }}
              >
                <span style={styles.dropdownItemLabel}>{opt.label || opt.value}</span>
                {opt.meta && <span style={styles.dropdownItemMeta}>{opt.meta}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// FACTOR EDITOR MODAL
// ============================================================================

function FactorEditorModal({
  isOpen,
  onClose,
  factor,
  onChange,
  feedbackType,
  schema,
}) {
  const [localFactor, setLocalFactor] = useState(factor || { type: 'entity_count' });
  const [selectedType, setSelectedType] = useState(factor?.type || 'entity_count');

  // Build options from schema
  const entityKindOptions = useMemo(() => {
    return (schema?.entityKinds || []).map(ek => ({
      value: ek.kind,
      label: ek.description || ek.kind,
    }));
  }, [schema]);

  const getSubtypeOptions = useCallback((kind) => {
    const ek = (schema?.entityKinds || []).find(e => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map(st => ({
      value: st.id,
      label: st.name || st.id,
    }));
  }, [schema]);

  const getStatusOptions = useCallback((kind) => {
    const ek = (schema?.entityKinds || []).find(e => e.kind === kind);
    if (!ek?.statuses) return [];
    return ek.statuses.map(st => ({
      value: st.id,
      label: st.name || st.id,
      meta: st.isTerminal ? 'terminal' : '',
    }));
  }, [schema]);

  const relationshipKindOptions = useMemo(() => {
    return (schema?.relationshipKinds || []).map(rk => ({
      value: rk.kind,
      label: rk.description || rk.kind,
    }));
  }, [schema]);

  const tagOptions = useMemo(() => {
    return (schema?.tagRegistry || []).map(t => ({
      value: t.tag,
      label: t.tag,
      meta: t.category,
    }));
  }, [schema]);

  useEffect(() => {
    if (factor) {
      setLocalFactor(factor);
      setSelectedType(factor.type);
    } else {
      setLocalFactor({ type: 'entity_count', coefficient: 1 });
      setSelectedType('entity_count');
    }
  }, [factor, isOpen]);

  const handleTypeChange = (type) => {
    setSelectedType(type);
    // Reset factor to defaults for new type
    const defaults = { type, coefficient: 1 };
    if (type === 'ratio') {
      defaults.numerator = { type: 'entity_count' };
      defaults.denominator = { type: 'entity_count' };
      defaults.fallbackValue = 0;
    }
    setLocalFactor(defaults);
  };

  const updateField = (field, value) => {
    setLocalFactor(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onChange(localFactor);
    onClose();
  };

  if (!isOpen) return null;

  const typeConfig = FACTOR_TYPES[selectedType];

  // Render numerator/denominator editor for ratio type
  const renderCountEditor = (countObj, onCountChange, label) => {
    const countType = countObj?.type || 'entity_count';
    return (
      <div style={styles.nestedSection}>
        <div style={styles.nestedTitle}>{label}</div>
        <div style={styles.inputGrid}>
          <ReferenceDropdown
            label="Count Type"
            value={countType}
            onChange={(v) => onCountChange({ ...countObj, type: v })}
            options={[
              { value: 'entity_count', label: 'Entity Count' },
              { value: 'relationship_count', label: 'Relationship Count' },
              { value: 'total_entities', label: 'Total Entities' },
            ]}
          />
          {countType === 'entity_count' && (
            <>
              <ReferenceDropdown
                label="Entity Kind"
                value={countObj?.kind || ''}
                onChange={(v) => onCountChange({ ...countObj, kind: v, subtype: undefined })}
                options={entityKindOptions}
                placeholder="Select kind..."
              />
              {countObj?.kind && (
                <ReferenceDropdown
                  label="Subtype (optional)"
                  value={countObj?.subtype || ''}
                  onChange={(v) => onCountChange({ ...countObj, subtype: v || undefined })}
                  options={[{ value: '', label: 'Any subtype' }, ...getSubtypeOptions(countObj.kind)]}
                />
              )}
            </>
          )}
          {countType === 'relationship_count' && (
            <MultiSelectChips
              label="Relationship Kinds"
              value={countObj?.relationshipKinds || []}
              onChange={(v) => onCountChange({ ...countObj, relationshipKinds: v })}
              options={relationshipKindOptions}
              placeholder="Select relationships..."
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>
            <span>{typeConfig?.icon}</span>
            {factor ? 'Edit Factor' : 'Add Factor'}
            <span style={{
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '12px',
              backgroundColor: feedbackType === 'positive' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: feedbackType === 'positive' ? '#86efac' : '#fca5a5',
            }}>
              {feedbackType === 'positive' ? '+ Positive' : '− Negative'}
            </span>
          </div>
          <button style={styles.modalClose} onClick={onClose}>×</button>
        </div>

        <div style={styles.modalContent}>
          {/* Type selector - compact pills */}
          <div style={{ marginBottom: '20px' }}>
            <label style={styles.label}>Factor Type</label>
            <div style={styles.typeSelector}>
              {Object.entries(FACTOR_TYPES).map(([type, config]) => (
                <div
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  style={{
                    ...styles.typePill,
                    ...(selectedType === type ? styles.typePillSelected : {}),
                  }}
                >
                  <span style={styles.typePillIcon}>{config.icon}</span>
                  <span>{config.label}</span>
                </div>
              ))}
            </div>
            {typeConfig && (
              <div style={styles.typeDescription}>
                {typeConfig.description}
              </div>
            )}
          </div>

          {/* Type-specific fields */}
          <div style={styles.inputGrid}>
            {/* Entity Count fields */}
            {selectedType === 'entity_count' && (
              <>
                <ReferenceDropdown
                  label="Entity Kind"
                  value={localFactor.kind || ''}
                  onChange={(v) => updateField('kind', v)}
                  options={entityKindOptions}
                  placeholder="Select kind..."
                />
                {localFactor.kind && (
                  <ReferenceDropdown
                    label="Subtype (optional)"
                    value={localFactor.subtype || ''}
                    onChange={(v) => updateField('subtype', v || undefined)}
                    options={[{ value: '', label: 'Any subtype' }, ...getSubtypeOptions(localFactor.kind)]}
                  />
                )}
                {localFactor.kind && (
                  <ReferenceDropdown
                    label="Status (optional)"
                    value={localFactor.status || ''}
                    onChange={(v) => updateField('status', v || undefined)}
                    options={[{ value: '', label: 'Any status' }, ...getStatusOptions(localFactor.kind)]}
                  />
                )}
              </>
            )}

            {/* Relationship Count fields */}
            {selectedType === 'relationship_count' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <MultiSelectChips
                  label="Relationship Kinds"
                  value={localFactor.relationshipKinds || []}
                  onChange={(v) => updateField('relationshipKinds', v)}
                  options={relationshipKindOptions}
                  placeholder="Select relationship types..."
                />
              </div>
            )}

            {/* Tag Count fields */}
            {selectedType === 'tag_count' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <MultiSelectChips
                  label="Tags"
                  value={localFactor.tags || []}
                  onChange={(v) => updateField('tags', v)}
                  options={tagOptions}
                  placeholder="Select tags..."
                />
              </div>
            )}

            {/* Status Ratio fields */}
            {selectedType === 'status_ratio' && (
              <>
                <ReferenceDropdown
                  label="Entity Kind"
                  value={localFactor.kind || ''}
                  onChange={(v) => {
                    updateField('kind', v);
                    updateField('subtype', undefined);
                    updateField('aliveStatus', undefined);
                  }}
                  options={entityKindOptions}
                  placeholder="Select kind..."
                />
                {localFactor.kind && (
                  <ReferenceDropdown
                    label="Subtype (optional)"
                    value={localFactor.subtype || ''}
                    onChange={(v) => updateField('subtype', v || undefined)}
                    options={[{ value: '', label: 'Any subtype' }, ...getSubtypeOptions(localFactor.kind)]}
                  />
                )}
                {localFactor.kind && (
                  <ReferenceDropdown
                    label="Alive Status"
                    value={localFactor.aliveStatus || ''}
                    onChange={(v) => updateField('aliveStatus', v)}
                    options={getStatusOptions(localFactor.kind)}
                    placeholder="Select status..."
                  />
                )}
              </>
            )}

            {/* Cross-Culture Ratio fields */}
            {selectedType === 'cross_culture_ratio' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <MultiSelectChips
                  label="Relationship Kinds"
                  value={localFactor.relationshipKinds || []}
                  onChange={(v) => updateField('relationshipKinds', v)}
                  options={relationshipKindOptions}
                  placeholder="Select relationship types..."
                />
              </div>
            )}

            {/* Common numeric fields */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Coefficient</label>
              <input
                type="number"
                value={localFactor.coefficient ?? 1}
                onChange={(e) => updateField('coefficient', parseFloat(e.target.value) || 0)}
                style={styles.input}
                step="0.1"
              />
            </div>

            {(selectedType === 'entity_count' || selectedType === 'relationship_count' || selectedType === 'ratio') && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Cap (optional)</label>
                <input
                  type="number"
                  value={localFactor.cap ?? ''}
                  onChange={(e) => updateField('cap', e.target.value ? parseFloat(e.target.value) : undefined)}
                  style={styles.input}
                  placeholder="No cap"
                />
              </div>
            )}

            {selectedType === 'ratio' && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Fallback Value</label>
                <input
                  type="number"
                  value={localFactor.fallbackValue ?? 0}
                  onChange={(e) => updateField('fallbackValue', parseFloat(e.target.value) || 0)}
                  style={styles.input}
                  step="0.1"
                />
              </div>
            )}
          </div>

          {/* Ratio type: numerator and denominator */}
          {selectedType === 'ratio' && (
            <>
              {renderCountEditor(
                localFactor.numerator,
                (v) => updateField('numerator', v),
                'Numerator'
              )}
              {renderCountEditor(
                localFactor.denominator,
                (v) => updateField('denominator', v),
                'Denominator'
              )}
            </>
          )}
        </div>

        <div style={styles.modalFooter}>
          <button
            style={{ ...styles.button, ...styles.buttonSecondary }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            style={{ ...styles.button, ...styles.buttonPrimary }}
            onClick={handleSave}
          >
            {factor ? 'Save Changes' : 'Add Factor'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FACTOR CARD COMPONENT
// ============================================================================

function FactorCard({ factor, feedbackType, onEdit, onDelete, schema }) {
  const [hovering, setHovering] = useState(false);
  const typeConfig = FACTOR_TYPES[factor.type] || {};

  // Generate summary based on factor type
  const getSummary = () => {
    switch (factor.type) {
      case 'entity_count':
        return `${factor.kind}${factor.subtype ? `:${factor.subtype}` : ''}${factor.status ? ` (${factor.status})` : ''}`;
      case 'relationship_count':
        return factor.relationshipKinds?.join(', ') || 'No relationships selected';
      case 'tag_count':
        return factor.tags?.join(', ') || 'No tags selected';
      case 'ratio':
        const num = factor.numerator?.kind || factor.numerator?.relationshipKinds?.join(',') || '?';
        const den = factor.denominator?.kind || factor.denominator?.relationshipKinds?.join(',') || factor.denominator?.type || '?';
        return `${num} / ${den}`;
      case 'status_ratio':
        return `${factor.kind}${factor.subtype ? `:${factor.subtype}` : ''} (${factor.aliveStatus})`;
      case 'cross_culture_ratio':
        return factor.relationshipKinds?.join(', ') || 'No relationships selected';
      default:
        return 'Unknown factor';
    }
  };

  return (
    <div
      style={{
        ...styles.factorCard,
        ...(hovering ? styles.factorCardHover : {}),
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div style={styles.factorHeader} onClick={onEdit}>
        <div
          style={{
            ...styles.factorIcon,
            backgroundColor: `${typeConfig.color}20`,
          }}
        >
          {typeConfig.icon}
        </div>
        <div style={styles.factorInfo}>
          <div style={styles.factorType}>{typeConfig.label}</div>
          <div style={styles.factorSummary}>{getSummary()}</div>
        </div>
        <div
          style={{
            ...styles.factorCoefficient,
            color: feedbackType === 'positive' ? '#86efac' : '#fca5a5',
          }}
        >
          {feedbackType === 'positive' ? '+' : '−'}{Math.abs(factor.coefficient)}
          {factor.cap ? ` (cap: ${factor.cap})` : ''}
        </div>
        <div style={styles.factorActions}>
          <button
            style={styles.iconButton}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Edit"
          >
            ✏️
          </button>
          <button
            style={{ ...styles.iconButton, ...styles.deleteButton }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Remove"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PRESSURE CARD COMPONENT
// ============================================================================

function PressureCard({ pressure, expanded, onToggle, onChange, onDelete, schema }) {
  const [hovering, setHovering] = useState(false);
  const [editingFactor, setEditingFactor] = useState(null);
  const [addingFactorType, setAddingFactorType] = useState(null);
  const [addButtonHover, setAddButtonHover] = useState({ positive: false, negative: false });

  const handleFieldChange = useCallback((field, value) => {
    onChange({
      ...pressure,
      [field]: value,
    });
  }, [pressure, onChange]);

  const handleGrowthChange = useCallback((field, value) => {
    onChange({
      ...pressure,
      growth: {
        ...pressure.growth,
        [field]: value,
      },
    });
  }, [pressure, onChange]);

  const handleAddFactor = useCallback((feedbackType) => {
    setAddingFactorType(feedbackType);
  }, []);

  const handleSaveFactor = useCallback((factor, feedbackType, index) => {
    const feedbackKey = feedbackType === 'positive' ? 'positiveFeedback' : 'negativeFeedback';
    const currentFactors = [...(pressure.growth?.[feedbackKey] || [])];

    if (index !== undefined && index >= 0) {
      currentFactors[index] = factor;
    } else {
      currentFactors.push(factor);
    }

    handleGrowthChange(feedbackKey, currentFactors);
    setEditingFactor(null);
    setAddingFactorType(null);
  }, [pressure, handleGrowthChange]);

  const handleRemoveFactor = useCallback((feedbackType, index) => {
    const feedbackKey = feedbackType === 'positive' ? 'positiveFeedback' : 'negativeFeedback';
    const newFactors = [...(pressure.growth?.[feedbackKey] || [])];
    newFactors.splice(index, 1);
    handleGrowthChange(feedbackKey, newFactors);
  }, [pressure, handleGrowthChange]);

  const positiveFeedback = pressure.growth?.positiveFeedback || [];
  const negativeFeedback = pressure.growth?.negativeFeedback || [];
  const totalFactors = positiveFeedback.length + negativeFeedback.length;

  return (
    <div style={styles.pressureCard}>
      <div
        style={{
          ...styles.pressureHeader,
          ...(hovering ? styles.pressureHeaderHover : {}),
        }}
        onClick={onToggle}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div style={styles.pressureTitle}>
          <span style={styles.pressureName}>{pressure.name}</span>
          <span style={styles.pressureId}>{pressure.id}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={styles.pressureStats}>
            <div style={styles.stat}>
              <span style={styles.statLabel}>Initial</span>
              <span style={styles.statValue}>{pressure.initialValue}</span>
              <div style={styles.statBar}>
                <div
                  style={{
                    ...styles.statBarFill,
                    width: `${pressure.initialValue}%`,
                    backgroundColor: '#3b82f6',
                  }}
                />
              </div>
            </div>
            <div style={styles.stat}>
              <span style={styles.statLabel}>Decay</span>
              <span style={styles.statValue}>{pressure.decay}</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statLabel}>Factors</span>
              <span style={styles.statValue}>
                <span style={{ color: '#86efac' }}>+{positiveFeedback.length}</span>
                {' / '}
                <span style={{ color: '#fca5a5' }}>−{negativeFeedback.length}</span>
              </span>
            </div>
          </div>
          <span style={{
            ...styles.expandIcon,
            ...(expanded ? styles.expandIconOpen : {}),
          }}>
            ▼
          </span>
        </div>
      </div>

      {expanded && (
        <div style={styles.pressureContent}>
          {/* Basic Info */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>⚙️</span>
                Basic Configuration
              </div>
            </div>
            <div style={styles.inputGrid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>ID</label>
                <input
                  type="text"
                  value={pressure.id}
                  onChange={(e) => handleFieldChange('id', e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Name</label>
                <input
                  type="text"
                  value={pressure.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Initial Value (0-100)</label>
                <input
                  type="number"
                  value={pressure.initialValue}
                  onChange={(e) => handleFieldChange('initialValue', parseFloat(e.target.value) || 0)}
                  style={styles.input}
                  min="0"
                  max="100"
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Decay (per tick)</label>
                <input
                  type="number"
                  value={pressure.decay}
                  onChange={(e) => handleFieldChange('decay', parseFloat(e.target.value) || 0)}
                  style={styles.input}
                  min="0"
                  step="0.5"
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Base Growth</label>
                <input
                  type="number"
                  value={pressure.growth?.baseGrowth || 0}
                  onChange={(e) => handleGrowthChange('baseGrowth', parseFloat(e.target.value) || 0)}
                  style={styles.input}
                  step="0.1"
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Max Growth (optional)</label>
                <input
                  type="number"
                  value={pressure.growth?.maxGrowth ?? ''}
                  onChange={(e) => handleGrowthChange('maxGrowth', e.target.value ? parseFloat(e.target.value) : undefined)}
                  style={styles.input}
                  step="0.1"
                  placeholder="No limit"
                />
              </div>
            </div>
          </div>

          {/* Positive Feedback */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>📈</span>
                Positive Feedback
                <span style={styles.sectionCount}>{positiveFeedback.length}</span>
              </div>
            </div>
            <div style={styles.factorList}>
              {positiveFeedback.length === 0 ? (
                <div style={styles.emptyFactors}>
                  No positive feedback factors. Add factors that increase this pressure.
                </div>
              ) : (
                positiveFeedback.map((factor, index) => (
                  <FactorCard
                    key={index}
                    factor={factor}
                    feedbackType="positive"
                    schema={schema}
                    onEdit={() => setEditingFactor({ factor, feedbackType: 'positive', index })}
                    onDelete={() => handleRemoveFactor('positive', index)}
                  />
                ))
              )}
              <button
                style={{
                  ...styles.addFactorButton,
                  ...(addButtonHover.positive ? styles.addButtonHover : {}),
                }}
                onClick={() => handleAddFactor('positive')}
                onMouseEnter={() => setAddButtonHover(prev => ({ ...prev, positive: true }))}
                onMouseLeave={() => setAddButtonHover(prev => ({ ...prev, positive: false }))}
              >
                + Add Positive Factor
              </button>
            </div>
          </div>

          {/* Negative Feedback */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>📉</span>
                Negative Feedback
                <span style={styles.sectionCount}>{negativeFeedback.length}</span>
              </div>
            </div>
            <div style={styles.factorList}>
              {negativeFeedback.length === 0 ? (
                <div style={styles.emptyFactors}>
                  No negative feedback factors. Add factors that decrease this pressure.
                </div>
              ) : (
                negativeFeedback.map((factor, index) => (
                  <FactorCard
                    key={index}
                    factor={factor}
                    feedbackType="negative"
                    schema={schema}
                    onEdit={() => setEditingFactor({ factor, feedbackType: 'negative', index })}
                    onDelete={() => handleRemoveFactor('negative', index)}
                  />
                ))
              )}
              <button
                style={{
                  ...styles.addFactorButton,
                  ...(addButtonHover.negative ? styles.addButtonHover : {}),
                }}
                onClick={() => handleAddFactor('negative')}
                onMouseEnter={() => setAddButtonHover(prev => ({ ...prev, negative: true }))}
                onMouseLeave={() => setAddButtonHover(prev => ({ ...prev, negative: false }))}
              >
                + Add Negative Factor
              </button>
            </div>
          </div>

          {/* Delete pressure button */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <button
              style={{ ...styles.button, ...styles.buttonDanger }}
              onClick={onDelete}
            >
              Delete Pressure
            </button>
          </div>
        </div>
      )}

      {/* Edit factor modal */}
      {editingFactor && (
        <FactorEditorModal
          isOpen={true}
          onClose={() => setEditingFactor(null)}
          factor={editingFactor.factor}
          feedbackType={editingFactor.feedbackType}
          schema={schema}
          onChange={(factor) => handleSaveFactor(factor, editingFactor.feedbackType, editingFactor.index)}
        />
      )}

      {/* Add factor modal */}
      {addingFactorType && (
        <FactorEditorModal
          isOpen={true}
          onClose={() => setAddingFactorType(null)}
          factor={null}
          feedbackType={addingFactorType}
          schema={schema}
          onChange={(factor) => handleSaveFactor(factor, addingFactorType)}
        />
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PressuresEditor({ pressures = [], onChange, schema }) {
  const [expandedPressure, setExpandedPressure] = useState(null);
  const [addHovering, setAddHovering] = useState(false);

  const handlePressureChange = useCallback((index, updatedPressure) => {
    const newPressures = [...pressures];
    newPressures[index] = updatedPressure;
    onChange(newPressures);
  }, [pressures, onChange]);

  const handleDeletePressure = useCallback((index) => {
    if (confirm(`Delete "${pressures[index].name}"?`)) {
      const newPressures = pressures.filter((_, i) => i !== index);
      onChange(newPressures);
      if (expandedPressure === index) {
        setExpandedPressure(null);
      }
    }
  }, [pressures, onChange, expandedPressure]);

  const handleAddPressure = useCallback(() => {
    const newPressure = {
      id: `pressure_${Date.now()}`,
      name: 'New Pressure',
      initialValue: 50,
      decay: 5,
      growth: {
        positiveFeedback: [],
        negativeFeedback: [],
      },
    };
    onChange([...pressures, newPressure]);
    setExpandedPressure(pressures.length);
  }, [pressures, onChange]);

  if (pressures.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Pressures</h1>
          <p style={styles.subtitle}>
            Configure environmental and social pressures that drive world evolution
          </p>
        </div>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🌡️</div>
          <div style={{ fontSize: '18px', fontWeight: 500, color: '#ffffff', marginBottom: '8px' }}>
            No pressures defined
          </div>
          <div style={{ marginBottom: '24px' }}>
            Pressures are forces that grow and decay based on world state,
            driving the narrative forward.
          </div>
          <button
            style={{
              ...styles.addPressureButton,
              width: 'auto',
              padding: '14px 28px',
              ...(addHovering ? styles.addButtonHover : {}),
            }}
            onClick={handleAddPressure}
            onMouseEnter={() => setAddHovering(true)}
            onMouseLeave={() => setAddHovering(false)}
          >
            + Create First Pressure
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Pressures</h1>
        <p style={styles.subtitle}>
          Configure environmental and social pressures that drive world evolution.
          Each pressure has feedback factors that make it grow or shrink based on world state.
        </p>
      </div>

      <div style={styles.pressureList}>
        {pressures.map((pressure, index) => (
          <PressureCard
            key={pressure.id}
            pressure={pressure}
            expanded={expandedPressure === index}
            onToggle={() => setExpandedPressure(expandedPressure === index ? null : index)}
            onChange={(updatedPressure) => handlePressureChange(index, updatedPressure)}
            onDelete={() => handleDeletePressure(index)}
            schema={schema}
          />
        ))}

        <button
          style={{
            ...styles.addPressureButton,
            ...(addHovering ? styles.addButtonHover : {}),
          }}
          onClick={handleAddPressure}
          onMouseEnter={() => setAddHovering(true)}
          onMouseLeave={() => setAddHovering(false)}
        >
          + Add Pressure
        </button>
      </div>
    </div>
  );
}
