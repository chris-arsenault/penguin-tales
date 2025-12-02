/**
 * DebugSettingsModal - Configure debug output categories
 *
 * This modal allows users to toggle debug output categories on/off
 * without code changes. Debug messages are filtered by category
 * during simulation.
 */

import React from 'react';

// Debug category metadata - matches types.ts DEBUG_CATEGORY_INFO
const DEBUG_CATEGORIES = [
  { id: 'placement', label: 'Placement', description: 'Entity placement and coordinate resolution' },
  { id: 'coordinates', label: 'Coordinates', description: 'Coordinate context, regions, culture mapping' },
  { id: 'templates', label: 'Templates', description: 'Template expansion and variable resolution' },
  { id: 'systems', label: 'Systems', description: 'System execution and effects' },
  { id: 'relationships', label: 'Relationships', description: 'Relationship creation and mutations' },
  { id: 'selection', label: 'Selection', description: 'Target and template selection' },
  { id: 'eras', label: 'Eras', description: 'Era transitions and epoch events' },
  { id: 'entities', label: 'Entities', description: 'Entity creation and state changes' },
  { id: 'pressures', label: 'Pressures', description: 'Pressure changes and thresholds' },
  { id: 'naming', label: 'Naming', description: 'Name generation' },
];

const styles = {
  overlay: {
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
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#ffffff',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#93c5fd',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0 4px',
  },
  masterToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#0a1929',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  masterLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#ffffff',
    flex: 1,
  },
  toggle: {
    position: 'relative',
    width: '44px',
    height: '24px',
    backgroundColor: '#0a1929',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  toggleActive: {
    backgroundColor: '#6d28d9',
    borderColor: '#8b5cf6',
  },
  toggleKnob: {
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '18px',
    height: '18px',
    backgroundColor: '#ffffff',
    borderRadius: '50%',
    transition: 'transform 0.2s',
  },
  toggleKnobActive: {
    transform: 'translateX(20px)',
  },
  categoryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  categoryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    backgroundColor: '#0a1929',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  categoryItemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '2px solid #6d28d9',
    backgroundColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: '#6d28d9',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#ffffff',
    marginBottom: '2px',
  },
  categoryDesc: {
    fontSize: '11px',
    color: '#93c5fd',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(59, 130, 246, 0.3)',
  },
  selectAllButton: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: 'transparent',
    color: '#93c5fd',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  clearButton: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: 'transparent',
    color: '#93c5fd',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};

export default function DebugSettingsModal({ isOpen, onClose, debugConfig, onDebugConfigChange }) {
  if (!isOpen) return null;

  const handleMasterToggle = () => {
    onDebugConfigChange({
      ...debugConfig,
      enabled: !debugConfig.enabled,
    });
  };

  const handleCategoryToggle = (categoryId) => {
    if (!debugConfig.enabled) return;

    const currentCategories = debugConfig.enabledCategories || [];
    const newCategories = currentCategories.includes(categoryId)
      ? currentCategories.filter(c => c !== categoryId)
      : [...currentCategories, categoryId];

    onDebugConfigChange({
      ...debugConfig,
      enabledCategories: newCategories,
    });
  };

  const handleSelectAll = () => {
    onDebugConfigChange({
      ...debugConfig,
      enabled: true,
      enabledCategories: DEBUG_CATEGORIES.map(c => c.id),
    });
  };

  const handleClearAll = () => {
    onDebugConfigChange({
      ...debugConfig,
      enabledCategories: [],
    });
  };

  const isCategoryEnabled = (categoryId) => {
    // If no categories are explicitly enabled, all are shown (when master is on)
    if (debugConfig.enabledCategories.length === 0) return true;
    return debugConfig.enabledCategories.includes(categoryId);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Debug Settings</h2>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Master toggle */}
        <div style={styles.masterToggle}>
          <span style={styles.masterLabel}>Enable Debug Output</span>
          <div
            style={{
              ...styles.toggle,
              ...(debugConfig.enabled ? styles.toggleActive : {}),
            }}
            onClick={handleMasterToggle}
          >
            <div
              style={{
                ...styles.toggleKnob,
                ...(debugConfig.enabled ? styles.toggleKnobActive : {}),
              }}
            />
          </div>
        </div>

        {/* Category list */}
        <div style={styles.categoryList}>
          {DEBUG_CATEGORIES.map((category) => (
            <div
              key={category.id}
              style={{
                ...styles.categoryItem,
                ...(!debugConfig.enabled ? styles.categoryItemDisabled : {}),
              }}
              onClick={() => handleCategoryToggle(category.id)}
            >
              <div
                style={{
                  ...styles.checkbox,
                  ...(debugConfig.enabled && isCategoryEnabled(category.id) ? styles.checkboxChecked : {}),
                }}
              >
                {debugConfig.enabled && isCategoryEnabled(category.id) && (
                  <span style={styles.checkmark}>✓</span>
                )}
              </div>
              <div style={styles.categoryInfo}>
                <div style={styles.categoryLabel}>{category.label}</div>
                <div style={styles.categoryDesc}>{category.description}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer with select/clear buttons */}
        <div style={styles.footer}>
          <button style={styles.clearButton} onClick={handleClearAll}>
            Clear All
          </button>
          <button style={styles.selectAllButton} onClick={handleSelectAll}>
            Select All
          </button>
        </div>
      </div>
    </div>
  );
}
