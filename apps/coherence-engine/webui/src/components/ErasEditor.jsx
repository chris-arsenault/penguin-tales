/**
 * ErasEditor - Full-featured editor for era configurations
 *
 * Eras define historical periods that structure world generation.
 * Each era has:
 * - Basic config (id, name, description)
 * - Template weights (which generators are active and how strongly)
 * - System modifiers (how systems behave during this era)
 *
 * This editor provides:
 * - Visual era cards with stats overview
 * - Add/edit/remove generators and systems per era
 * - Creative strength selector (0-4 scale with visual dots)
 * - Reference lookups for generators and systems from config
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// Validation indicator styles
const validationStyles = {
  warningBadge: {
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: '10px',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#f59e0b',
    marginLeft: '8px',
  },
  errorBadge: {
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: '10px',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    marginLeft: '8px',
  },
  orphanItem: {
    opacity: 0.6,
    borderStyle: 'dashed',
  },
  invalidRefText: {
    color: '#ef4444',
    fontStyle: 'italic',
  },
};

// Arctic Blue base theme with amber accent
const ACCENT_COLOR = '#f59e0b';
const ACCENT_GRADIENT = 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)';

// Strength level configuration
const STRENGTH_LEVELS = [
  { value: 0, label: 'Off', color: '#475569', description: 'Disabled during this era' },
  { value: 1, label: 'Low', color: '#3b82f6', description: 'Minimal presence' },
  { value: 2, label: 'Medium', color: '#22c55e', description: 'Moderate activity' },
  { value: 3, label: 'High', color: '#f59e0b', description: 'Strong presence' },
  { value: 4, label: 'Max', color: '#ef4444', description: 'Dominant force' },
];

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
  eraList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  eraCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    overflow: 'visible',
    position: 'relative',
  },
  eraHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  eraHeaderHover: {
    backgroundColor: '#2d4a6f',
  },
  eraHeaderLeft: {
    flex: 1,
  },
  eraTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '4px',
  },
  eraName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
  },
  eraId: {
    fontSize: '12px',
    color: '#60a5fa',
    backgroundColor: '#0c1f2e',
    padding: '2px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
  },
  eraDescription: {
    fontSize: '13px',
    color: '#93c5fd',
  },
  eraStats: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
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
  expandIcon: {
    fontSize: '14px',
    color: '#60a5fa',
    transition: 'transform 0.2s',
    marginLeft: '16px',
  },
  expandIconOpen: {
    transform: 'rotate(180deg)',
  },
  eraContent: {
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
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
    outline: 'none',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: '#0a1929',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    color: '#ffffff',
    resize: 'vertical',
    minHeight: '60px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    outline: 'none',
  },
  // Weight/modifier items
  itemsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    backgroundColor: '#0c1f2e',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.15)',
  },
  itemName: {
    flex: 1,
    fontSize: '13px',
    color: '#ffffff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemNameMuted: {
    color: '#60a5fa',
  },
  // Strength indicator
  strengthContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  strengthDots: {
    display: 'flex',
    gap: '4px',
  },
  strengthDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    cursor: 'pointer',
    transition: 'all 0.15s',
    border: '2px solid transparent',
  },
  strengthInput: {
    width: '52px',
    padding: '4px 6px',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: '#1e3a5f',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    color: '#ffffff',
    textAlign: 'center',
    outline: 'none',
  },
  removeButton: {
    padding: '4px',
    fontSize: '14px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#60a5fa',
    cursor: 'pointer',
    borderRadius: '4px',
    opacity: 0.6,
    transition: 'all 0.15s',
    lineHeight: 1,
  },
  removeButtonHover: {
    opacity: 1,
    color: '#ef4444',
  },
  // Add item section
  addItemContainer: {
    marginTop: '10px',
    display: 'flex',
    gap: '8px',
    alignItems: 'stretch',
  },
  addItemDropdown: {
    flex: 1,
    position: 'relative',
  },
  addItemButton: {
    padding: '0 16px',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '8px',
    color: ACCENT_COLOR,
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  addItemButtonHover: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: ACCENT_COLOR,
  },
  // Dropdown
  dropdownTrigger: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    backgroundColor: '#0a1929',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    color: '#60a5fa',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxSizing: 'border-box',
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
    maxHeight: '250px',
    overflowY: 'auto',
    zIndex: 1000,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  },
  dropdownSearch: {
    padding: '8px',
    borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
  },
  dropdownSearchInput: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '13px',
    backgroundColor: '#1e3a5f',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    color: '#ffffff',
    boxSizing: 'border-box',
    outline: 'none',
  },
  dropdownItem: {
    padding: '10px 12px',
    cursor: 'pointer',
    transition: 'background-color 0.1s',
    fontSize: '13px',
    color: '#ffffff',
  },
  dropdownItemHover: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  dropdownItemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  dropdownEmpty: {
    padding: '12px',
    textAlign: 'center',
    color: '#60a5fa',
    fontSize: '13px',
  },
  // Buttons
  addEraButton: {
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
  addButtonHover: {
    borderColor: ACCENT_COLOR,
    color: ACCENT_COLOR,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
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
  buttonDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)',
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
  emptyItems: {
    padding: '16px',
    textAlign: 'center',
    color: '#60a5fa',
    fontSize: '13px',
    fontStyle: 'italic',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: '8px',
  },
};

// ============================================================================
// STRENGTH SELECTOR COMPONENT
// ============================================================================

function StrengthSelector({ value, onChange }) {
  const [hoveredLevel, setHoveredLevel] = useState(null);

  // Get the level index based on value (for dot display)
  const getLevelIndex = (val) => {
    if (val <= 0) return 0;
    if (val <= 1) return 1;
    if (val <= 2) return 2;
    if (val <= 3) return 3;
    return 4;
  };

  const levelIndex = getLevelIndex(value);
  const currentLevel = STRENGTH_LEVELS[levelIndex];
  const hoverLevel = hoveredLevel !== null ? STRENGTH_LEVELS[hoveredLevel] : null;

  // Calculate partial fill for current dot based on decimal
  const getPartialFill = (idx) => {
    if (idx < levelIndex) return 1; // Full
    if (idx > levelIndex) return 0; // Empty
    // Current level - calculate partial based on where value falls in range
    const levelStart = idx === 0 ? 0 : idx;
    const levelEnd = idx + 1;
    const progress = (value - levelStart) / (levelEnd - levelStart);
    return Math.max(0, Math.min(1, progress));
  };

  return (
    <div style={styles.strengthContainer}>
      <div style={styles.strengthDots}>
        {STRENGTH_LEVELS.map((level, idx) => {
          const isHovered = hoveredLevel !== null && idx <= hoveredLevel;
          const fill = getPartialFill(idx);
          const baseColor = isHovered ? hoverLevel.color : currentLevel.color;
          const emptyColor = '#1e3a5f';

          return (
            <div
              key={idx}
              onClick={() => onChange(level.value)}
              onMouseEnter={() => setHoveredLevel(idx)}
              onMouseLeave={() => setHoveredLevel(null)}
              style={{
                ...styles.strengthDot,
                backgroundColor: emptyColor,
                position: 'relative',
                overflow: 'hidden',
                transform: (hoveredLevel !== null && idx === hoveredLevel) ? 'scale(1.2)' : 'scale(1)',
              }}
              title={`Set to ${level.value} (${level.label})`}
            >
              {/* Partial fill overlay */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${fill * 100}%`,
                  backgroundColor: baseColor,
                  borderRadius: '50%',
                  transition: 'height 0.15s',
                }}
              />
            </div>
          );
        })}
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const newVal = parseFloat(e.target.value);
          if (!isNaN(newVal)) {
            onChange(Math.max(0, Math.min(10, newVal)));
          }
        }}
        style={styles.strengthInput}
        step="0.1"
        min="0"
        max="10"
      />
    </div>
  );
}

// ============================================================================
// ADD ITEM DROPDOWN COMPONENT
// ============================================================================

function AddItemDropdown({ availableItems, onAdd, placeholder, emptyMessage }) {
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

  const filteredItems = useMemo(() => {
    if (!search) return availableItems;
    const lower = search.toLowerCase();
    return availableItems.filter(item =>
      item.id.toLowerCase().includes(lower) ||
      item.name?.toLowerCase().includes(lower)
    );
  }, [availableItems, search]);

  const handleSelect = (item) => {
    onAdd(item.id);
    setIsOpen(false);
    setSearch('');
  };

  if (availableItems.length === 0) {
    return (
      <div style={{ ...styles.dropdownTrigger, opacity: 0.5, cursor: 'not-allowed' }}>
        <span>{emptyMessage || 'All items added'}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={styles.addItemDropdown}>
      <div
        style={styles.dropdownTrigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{placeholder || 'Select to add...'}</span>
        <span style={{ fontSize: '10px' }}>▼</span>
      </div>
      {isOpen && (
        <div style={styles.dropdownMenu}>
          <div style={styles.dropdownSearch}>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={styles.dropdownSearchInput}
              autoFocus
            />
          </div>
          {filteredItems.length === 0 ? (
            <div style={styles.dropdownEmpty}>No matches found</div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(-1)}
                style={{
                  ...styles.dropdownItem,
                  ...(hoveredIndex === idx ? styles.dropdownItemHover : {}),
                }}
              >
                {item.name || item.id}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// WEIGHT/MODIFIER ITEM COMPONENT
// ============================================================================

function WeightItem({ id, name, value, onChange, onRemove }) {
  const [removeHover, setRemoveHover] = useState(false);

  return (
    <div style={styles.itemRow}>
      <span style={{ ...styles.itemName, ...(value === 0 ? styles.itemNameMuted : {}) }}>
        {name || id.replace(/_/g, ' ')}
      </span>
      <StrengthSelector
        value={value}
        onChange={onChange}
      />
      <button
        style={{
          ...styles.removeButton,
          ...(removeHover ? styles.removeButtonHover : {}),
        }}
        onClick={onRemove}
        onMouseEnter={() => setRemoveHover(true)}
        onMouseLeave={() => setRemoveHover(false)}
        title="Remove from era"
      >
        ×
      </button>
    </div>
  );
}

// ============================================================================
// TRANSITION CONDITION TYPE LABELS
// ============================================================================

const CONDITION_TYPES = [
  { value: 'time', label: 'Time', description: 'Transition after minimum ticks' },
  { value: 'pressure', label: 'Pressure', description: 'Based on pressure level' },
  { value: 'entity_count', label: 'Entity Count', description: 'Based on entity population' },
];

const OPERATORS = [
  { value: 'above', label: 'Above' },
  { value: 'below', label: 'Below' },
];

// ============================================================================
// TRANSITION CONDITION EDITOR COMPONENT
// ============================================================================

function TransitionConditionEditor({ condition, index, onChange, onRemove, pressures, schema }) {
  const [removeHover, setRemoveHover] = useState(false);

  const handleFieldChange = (field, value) => {
    onChange({ ...condition, [field]: value });
  };

  // Get entity kinds from schema
  const entityKinds = useMemo(() => {
    return schema?.entityKinds?.map(ek => ({ id: ek.id, name: ek.name || ek.id })) || [];
  }, [schema]);

  // Get subtypes for selected entity kind
  const subtypes = useMemo(() => {
    if (!condition.entityKind || !schema?.entityKinds) return [];
    const kind = schema.entityKinds.find(ek => ek.id === condition.entityKind);
    return kind?.subtypes?.map(st => ({ id: st.id, name: st.name || st.id })) || [];
  }, [condition.entityKind, schema]);

  return (
    <div style={{
      ...styles.itemRow,
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <select
          value={condition.type}
          onChange={(e) => handleFieldChange('type', e.target.value)}
          style={{
            ...styles.input,
            width: '140px',
            padding: '8px 10px',
          }}
        >
          {CONDITION_TYPES.map(ct => (
            <option key={ct.value} value={ct.value}>{ct.label}</option>
          ))}
        </select>

        <span style={{ color: '#60a5fa', fontSize: '12px', flex: 1 }}>
          {CONDITION_TYPES.find(ct => ct.value === condition.type)?.description}
        </span>

        <button
          style={{
            ...styles.removeButton,
            ...(removeHover ? styles.removeButtonHover : {}),
          }}
          onClick={onRemove}
          onMouseEnter={() => setRemoveHover(true)}
          onMouseLeave={() => setRemoveHover(false)}
          title="Remove condition"
        >
          ×
        </button>
      </div>

      {/* Time-based condition */}
      {condition.type === 'time' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ ...styles.label, marginBottom: 0, minWidth: '80px' }}>Min Ticks</label>
          <input
            type="number"
            value={condition.minTicks ?? 50}
            onChange={(e) => handleFieldChange('minTicks', parseInt(e.target.value) || 0)}
            style={{ ...styles.input, width: '100px' }}
            min="0"
          />
          <span style={{ color: '#93c5fd', fontSize: '12px' }}>
            Era must run at least this many ticks before transition
          </span>
        </div>
      )}

      {/* Pressure-based condition */}
      {condition.type === 'pressure' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <select
            value={condition.pressureId || ''}
            onChange={(e) => handleFieldChange('pressureId', e.target.value)}
            style={{ ...styles.input, width: '160px', padding: '8px 10px' }}
          >
            <option value="">Select pressure...</option>
            {pressures.map(p => (
              <option key={p.id} value={p.id}>{p.name || p.id}</option>
            ))}
          </select>
          <select
            value={condition.operator || 'above'}
            onChange={(e) => handleFieldChange('operator', e.target.value)}
            style={{ ...styles.input, width: '100px', padding: '8px 10px' }}
          >
            {OPERATORS.map(op => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          <input
            type="number"
            value={condition.threshold ?? 50}
            onChange={(e) => handleFieldChange('threshold', parseInt(e.target.value) || 0)}
            style={{ ...styles.input, width: '80px' }}
            min="0"
            max="100"
          />
        </div>
      )}

      {/* Entity count condition */}
      {condition.type === 'entity_count' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <select
            value={condition.entityKind || ''}
            onChange={(e) => handleFieldChange('entityKind', e.target.value)}
            style={{ ...styles.input, width: '140px', padding: '8px 10px' }}
          >
            <option value="">Entity kind...</option>
            {entityKinds.map(ek => (
              <option key={ek.id} value={ek.id}>{ek.name}</option>
            ))}
          </select>
          {subtypes.length > 0 && (
            <select
              value={condition.subtype || ''}
              onChange={(e) => handleFieldChange('subtype', e.target.value || undefined)}
              style={{ ...styles.input, width: '140px', padding: '8px 10px' }}
            >
              <option value="">Any subtype</option>
              {subtypes.map(st => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          )}
          <select
            value={condition.operator || 'above'}
            onChange={(e) => handleFieldChange('operator', e.target.value)}
            style={{ ...styles.input, width: '100px', padding: '8px 10px' }}
          >
            {OPERATORS.map(op => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          <input
            type="number"
            value={condition.threshold ?? 10}
            onChange={(e) => handleFieldChange('threshold', parseInt(e.target.value) || 0)}
            style={{ ...styles.input, width: '80px' }}
            min="0"
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TRANSITION EFFECTS EDITOR COMPONENT
// ============================================================================

function TransitionEffectItem({ pressureId, value, onChange, onRemove, pressures }) {
  const [removeHover, setRemoveHover] = useState(false);
  const pressure = pressures.find(p => p.id === pressureId);

  return (
    <div style={styles.itemRow}>
      <span style={styles.itemName}>
        {pressure?.name || pressureId}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        style={{
          ...styles.strengthInput,
          width: '80px',
          color: value >= 0 ? '#22c55e' : '#ef4444',
        }}
      />
      <span style={{ color: '#60a5fa', fontSize: '12px', minWidth: '80px' }}>
        {value >= 0 ? '+' : ''}{value} pressure
      </span>
      <button
        style={{
          ...styles.removeButton,
          ...(removeHover ? styles.removeButtonHover : {}),
        }}
        onClick={onRemove}
        onMouseEnter={() => setRemoveHover(true)}
        onMouseLeave={() => setRemoveHover(false)}
        title="Remove effect"
      >
        ×
      </button>
    </div>
  );
}

// ============================================================================
// ERA CARD COMPONENT
// ============================================================================

function EraCard({ era, expanded, onToggle, onChange, onDelete, generators, systems, pressures, schema, usageMap }) {
  const [hovering, setHovering] = useState(false);
  const [addGenHover, setAddGenHover] = useState(false);
  const [addSysHover, setAddSysHover] = useState(false);
  const [addCondHover, setAddCondHover] = useState(false);
  const [addEffectHover, setAddEffectHover] = useState(false);

  // Compute validation status for this era
  const validation = useMemo(() => {
    const generatorIds = new Set(generators.map(g => g.id));
    const systemIds = new Set(systems.map(s => s.config?.id));

    const invalidGenerators = Object.keys(era.templateWeights || {}).filter(id => !generatorIds.has(id));
    const invalidSystems = Object.keys(era.systemModifiers || {}).filter(id => !systemIds.has(id));

    return {
      invalidGenerators,
      invalidSystems,
      totalInvalid: invalidGenerators.length + invalidSystems.length,
    };
  }, [era, generators, systems]);

  const handleFieldChange = useCallback((field, value) => {
    onChange({
      ...era,
      [field]: value,
    });
  }, [era, onChange]);

  const handleWeightChange = useCallback((key, value) => {
    onChange({
      ...era,
      templateWeights: {
        ...era.templateWeights,
        [key]: value,
      },
    });
  }, [era, onChange]);

  const handleModifierChange = useCallback((key, value) => {
    onChange({
      ...era,
      systemModifiers: {
        ...era.systemModifiers,
        [key]: value,
      },
    });
  }, [era, onChange]);

  const handleRemoveWeight = useCallback((key) => {
    const newWeights = { ...era.templateWeights };
    delete newWeights[key];
    onChange({
      ...era,
      templateWeights: newWeights,
    });
  }, [era, onChange]);

  const handleRemoveModifier = useCallback((key) => {
    const newModifiers = { ...era.systemModifiers };
    delete newModifiers[key];
    onChange({
      ...era,
      systemModifiers: newModifiers,
    });
  }, [era, onChange]);

  const handleAddWeight = useCallback((genId) => {
    onChange({
      ...era,
      templateWeights: {
        ...era.templateWeights,
        [genId]: 2, // Default to "Medium"
      },
    });
  }, [era, onChange]);

  const handleAddModifier = useCallback((sysId) => {
    onChange({
      ...era,
      systemModifiers: {
        ...era.systemModifiers,
        [sysId]: 2, // Default to "Medium"
      },
    });
  }, [era, onChange]);

  // Transition condition handlers
  const handleAddCondition = useCallback(() => {
    const newCondition = { type: 'time', minTicks: 50 };
    onChange({
      ...era,
      transitionConditions: [...(era.transitionConditions || []), newCondition],
    });
  }, [era, onChange]);

  const handleUpdateCondition = useCallback((index, updatedCondition) => {
    const newConditions = [...(era.transitionConditions || [])];
    newConditions[index] = updatedCondition;
    onChange({
      ...era,
      transitionConditions: newConditions,
    });
  }, [era, onChange]);

  const handleRemoveCondition = useCallback((index) => {
    const newConditions = (era.transitionConditions || []).filter((_, i) => i !== index);
    onChange({
      ...era,
      transitionConditions: newConditions,
    });
  }, [era, onChange]);

  // Transition effect handlers
  const handleAddEffect = useCallback((pressureId) => {
    onChange({
      ...era,
      transitionEffects: {
        ...era.transitionEffects,
        pressureChanges: {
          ...(era.transitionEffects?.pressureChanges || {}),
          [pressureId]: 10,
        },
      },
    });
  }, [era, onChange]);

  const handleUpdateEffect = useCallback((pressureId, value) => {
    onChange({
      ...era,
      transitionEffects: {
        ...era.transitionEffects,
        pressureChanges: {
          ...(era.transitionEffects?.pressureChanges || {}),
          [pressureId]: value,
        },
      },
    });
  }, [era, onChange]);

  const handleRemoveEffect = useCallback((pressureId) => {
    const newChanges = { ...(era.transitionEffects?.pressureChanges || {}) };
    delete newChanges[pressureId];
    onChange({
      ...era,
      transitionEffects: {
        ...era.transitionEffects,
        pressureChanges: newChanges,
      },
    });
  }, [era, onChange]);

  // Get generator/system names for display
  const getGeneratorName = (id) => {
    const gen = generators.find(g => g.id === id);
    return gen?.name || id.replace(/_/g, ' ');
  };

  const getSystemName = (id) => {
    const sys = systems.find(s => s.config?.id === id);
    return sys?.config?.name || id.replace(/_/g, ' ');
  };

  // Sort entries alphabetically for stable display
  const templateWeights = Object.entries(era.templateWeights || {})
    .sort((a, b) => a[0].localeCompare(b[0]));
  const systemModifiers = Object.entries(era.systemModifiers || {})
    .sort((a, b) => a[0].localeCompare(b[0]));

  // Available items to add (not already in era)
  const availableGenerators = useMemo(() => {
    const currentIds = new Set(Object.keys(era.templateWeights || {}));
    return generators
      .filter(g => !currentIds.has(g.id) && g.enabled !== false)
      .map(g => ({ id: g.id, name: g.name || g.id }));
  }, [generators, era.templateWeights]);

  const availableSystems = useMemo(() => {
    const currentIds = new Set(Object.keys(era.systemModifiers || {}));
    return systems
      .filter(s => s.config?.id && !currentIds.has(s.config.id))
      .map(s => ({ id: s.config.id, name: s.config.name || s.config.id }));
  }, [systems, era.systemModifiers]);

  // Available pressures for effects (not already added)
  const availablePressuresForEffects = useMemo(() => {
    const currentIds = new Set(Object.keys(era.transitionEffects?.pressureChanges || {}));
    return (pressures || [])
      .filter(p => !currentIds.has(p.id))
      .map(p => ({ id: p.id, name: p.name || p.id }));
  }, [pressures, era.transitionEffects]);

  // Transition data
  const transitionConditions = era.transitionConditions || [];
  const pressureChanges = Object.entries(era.transitionEffects?.pressureChanges || {});

  // Count active items (strength > 0)
  const activeGenerators = templateWeights.filter(([, v]) => v > 0).length;
  const activeSystems = systemModifiers.filter(([, v]) => v > 0).length;

  return (
    <div style={styles.eraCard}>
      <div
        style={{
          ...styles.eraHeader,
          ...(hovering ? styles.eraHeaderHover : {}),
        }}
        onClick={onToggle}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div style={styles.eraHeaderLeft}>
          <div style={styles.eraTitle}>
            <span style={styles.eraName}>{era.name}</span>
            <span style={styles.eraId}>{era.id}</span>
            {validation.totalInvalid > 0 && (
              <span style={validationStyles.errorBadge}>
                {validation.totalInvalid} invalid ref{validation.totalInvalid !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={styles.eraDescription}>{era.description}</div>
        </div>
        <div style={styles.eraStats}>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Generators</span>
            <span style={styles.statValue}>
              {activeGenerators}<span style={{ color: '#60a5fa', fontWeight: 400 }}>/{templateWeights.length}</span>
            </span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Systems</span>
            <span style={styles.statValue}>
              {activeSystems}<span style={{ color: '#60a5fa', fontWeight: 400 }}>/{systemModifiers.length}</span>
            </span>
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
        <div style={styles.eraContent}>
          {/* Basic Info */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>📝</span>
                Basic Information
              </div>
            </div>
            <div style={styles.inputGrid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>ID</label>
                <input
                  type="text"
                  value={era.id}
                  onChange={(e) => handleFieldChange('id', e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Name</label>
                <input
                  type="text"
                  value={era.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>
            <div style={{ ...styles.inputGroup, marginTop: '16px' }}>
              <label style={styles.label}>Description</label>
              <textarea
                value={era.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                style={styles.textarea}
              />
            </div>
          </div>

          {/* Template Weights (Generators) */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>⚡</span>
                Generators
                <span style={styles.sectionCount}>{activeGenerators} active / {templateWeights.length} total</span>
              </div>
            </div>
            <div style={styles.itemsGrid}>
              {templateWeights.length === 0 ? (
                <div style={styles.emptyItems}>
                  No generators assigned. Add generators to control entity creation during this era.
                </div>
              ) : (
                templateWeights.map(([key, value]) => (
                  <WeightItem
                    key={key}
                    id={key}
                    name={getGeneratorName(key)}
                    value={value}
                    onChange={(newValue) => handleWeightChange(key, newValue)}
                    onRemove={() => handleRemoveWeight(key)}
                  />
                ))
              )}
            </div>
            <div style={styles.addItemContainer}>
              <AddItemDropdown
                availableItems={availableGenerators}
                onAdd={handleAddWeight}
                placeholder="Add generator..."
                emptyMessage="All generators added"
              />
            </div>
          </div>

          {/* System Modifiers */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>⚙️</span>
                Systems
                <span style={styles.sectionCount}>{activeSystems} active / {systemModifiers.length} total</span>
              </div>
            </div>
            <div style={styles.itemsGrid}>
              {systemModifiers.length === 0 ? (
                <div style={styles.emptyItems}>
                  No systems assigned. Add systems to control simulation behavior during this era.
                </div>
              ) : (
                systemModifiers.map(([key, value]) => (
                  <WeightItem
                    key={key}
                    id={key}
                    name={getSystemName(key)}
                    value={value}
                    onChange={(newValue) => handleModifierChange(key, newValue)}
                    onRemove={() => handleRemoveModifier(key)}
                  />
                ))
              )}
            </div>
            <div style={styles.addItemContainer}>
              <AddItemDropdown
                availableItems={availableSystems}
                onAdd={handleAddModifier}
                placeholder="Add system..."
                emptyMessage="All systems added"
              />
            </div>
          </div>

          {/* Transition Conditions */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>🔄</span>
                Transition Conditions
                <span style={styles.sectionCount}>{transitionConditions.length} condition{transitionConditions.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#93c5fd', marginBottom: '12px' }}>
              All conditions must be met for this era to end and transition to the next era.
            </div>
            <div style={styles.itemsGrid}>
              {transitionConditions.length === 0 ? (
                <div style={styles.emptyItems}>
                  No transition conditions defined. The era will use default timing (2x minimum era length).
                </div>
              ) : (
                transitionConditions.map((condition, index) => (
                  <TransitionConditionEditor
                    key={index}
                    condition={condition}
                    index={index}
                    onChange={(updated) => handleUpdateCondition(index, updated)}
                    onRemove={() => handleRemoveCondition(index)}
                    pressures={pressures || []}
                    schema={schema}
                  />
                ))
              )}
            </div>
            <button
              style={{
                ...styles.addItemButton,
                marginTop: '10px',
                padding: '10px 16px',
                ...(addCondHover ? styles.addItemButtonHover : {}),
              }}
              onClick={handleAddCondition}
              onMouseEnter={() => setAddCondHover(true)}
              onMouseLeave={() => setAddCondHover(false)}
            >
              + Add Condition
            </button>
          </div>

          {/* Transition Effects */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>✨</span>
                Transition Effects
                <span style={styles.sectionCount}>{pressureChanges.length} effect{pressureChanges.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#93c5fd', marginBottom: '12px' }}>
              Pressure changes applied when this era ends and transitions to the next era.
            </div>
            <div style={styles.itemsGrid}>
              {pressureChanges.length === 0 ? (
                <div style={styles.emptyItems}>
                  No transition effects defined. Add pressure changes to influence the next era.
                </div>
              ) : (
                pressureChanges.map(([pressureId, value]) => (
                  <TransitionEffectItem
                    key={pressureId}
                    pressureId={pressureId}
                    value={value}
                    onChange={(newValue) => handleUpdateEffect(pressureId, newValue)}
                    onRemove={() => handleRemoveEffect(pressureId)}
                    pressures={pressures || []}
                  />
                ))
              )}
            </div>
            <div style={styles.addItemContainer}>
              <AddItemDropdown
                availableItems={availablePressuresForEffects}
                onAdd={handleAddEffect}
                placeholder="Add pressure effect..."
                emptyMessage="All pressures added"
              />
            </div>
          </div>

          {/* Delete era button */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <button
              style={{ ...styles.button, ...styles.buttonDanger }}
              onClick={onDelete}
            >
              Delete Era
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ErasEditor({ eras = [], onChange, generators = [], systems = [], pressures = [], schema, usageMap }) {
  const [expandedEra, setExpandedEra] = useState(null);
  const [addHovering, setAddHovering] = useState(false);

  const handleEraChange = useCallback((index, updatedEra) => {
    const newEras = [...eras];
    newEras[index] = updatedEra;
    onChange(newEras);
  }, [eras, onChange]);

  const handleDeleteEra = useCallback((index) => {
    if (confirm(`Delete era "${eras[index].name}"?`)) {
      const newEras = eras.filter((_, i) => i !== index);
      onChange(newEras);
      if (expandedEra === index) {
        setExpandedEra(null);
      }
    }
  }, [eras, onChange, expandedEra]);

  const handleAddEra = useCallback(() => {
    const newEra = {
      id: `era_${Date.now()}`,
      name: 'New Era',
      description: 'A new period in world history',
      templateWeights: {},
      systemModifiers: {},
    };
    onChange([...eras, newEra]);
    setExpandedEra(eras.length);
  }, [eras, onChange]);

  if (eras.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Eras</h1>
          <p style={styles.subtitle}>
            Define historical eras that structure world generation
          </p>
        </div>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🕰️</div>
          <div style={{ fontSize: '18px', fontWeight: 500, color: '#ffffff', marginBottom: '8px' }}>
            No eras defined
          </div>
          <div style={{ marginBottom: '24px' }}>
            Eras control which generators and systems are active during different
            phases of world history.
          </div>
          <button
            style={{
              ...styles.addEraButton,
              width: 'auto',
              padding: '14px 28px',
              ...(addHovering ? styles.addButtonHover : {}),
            }}
            onClick={handleAddEra}
            onMouseEnter={() => setAddHovering(true)}
            onMouseLeave={() => setAddHovering(false)}
          >
            + Create First Era
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Eras</h1>
        <p style={styles.subtitle}>
          Define historical eras that structure world generation. Each era controls
          which generators and systems are active and at what strength.
        </p>
      </div>

      <div style={styles.eraList}>
        {eras.map((era, index) => (
          <EraCard
            key={era.id}
            era={era}
            expanded={expandedEra === index}
            onToggle={() => setExpandedEra(expandedEra === index ? null : index)}
            onChange={(updatedEra) => handleEraChange(index, updatedEra)}
            onDelete={() => handleDeleteEra(index)}
            generators={generators}
            systems={systems}
            pressures={pressures}
            schema={schema}
            usageMap={usageMap}
          />
        ))}

        <button
          style={{
            ...styles.addEraButton,
            ...(addHovering ? styles.addButtonHover : {}),
          }}
          onClick={handleAddEra}
          onMouseEnter={() => setAddHovering(true)}
          onMouseLeave={() => setAddHovering(false)}
        >
          + Add Era
        </button>
      </div>
    </div>
  );
}
