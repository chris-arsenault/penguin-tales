/**
 * SystemsEditor - Main component for editing simulation systems
 */

import React, { useState, useCallback, useMemo } from 'react';
import { SYSTEM_TYPES, SYSTEM_CATEGORIES, getSystemCategory } from './constants';
import { CategorySection } from '../shared';
import { SystemListCard } from './cards/SystemListCard';
import { SystemModal } from './SystemModal';

export default function SystemsEditor({ systems = [], onChange, schema, pressures = [], usageMap }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showTypePicker, setShowTypePicker] = useState(false);

  // Derive selectedSystem from index
  const selectedSystem = selectedIndex !== null ? systems[selectedIndex] : null;
  const [expandedCategories, setExpandedCategories] = useState(() => {
    // Start with all categories expanded
    return Object.keys(SYSTEM_CATEGORIES).reduce((acc, cat) => {
      acc[cat] = true;
      return acc;
    }, {});
  });

  // Group systems by category (framework systems grouped together)
  const groupedSystems = useMemo(() => {
    const groups = {};
    systems.forEach((system) => {
      const category = getSystemCategory(system.systemType || 'unknown');
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(system);
    });
    return groups;
  }, [systems]);

  // Get ordered list of categories that have systems
  const categories = useMemo(() => {
    const usedCategories = Object.keys(groupedSystems);
    // Sort by defined order in SYSTEM_CATEGORIES
    return usedCategories.sort((a, b) => {
      const orderA = SYSTEM_CATEGORIES[a]?.order ?? 999;
      const orderB = SYSTEM_CATEGORIES[b]?.order ?? 999;
      return orderA - orderB;
    });
  }, [groupedSystems]);

  const handleSystemChange = useCallback((updated) => {
    if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < systems.length) {
      const newSystems = [...systems];
      newSystems[selectedIndex] = updated;
      onChange(newSystems);
    }
  }, [systems, onChange, selectedIndex]);

  const handleToggle = useCallback((system) => {
    const index = systems.findIndex((s) => s.config?.id === system.config?.id);
    if (index >= 0) {
      const newSystems = [...systems];
      newSystems[index] = { ...system, enabled: system.enabled === false ? true : false };
      onChange(newSystems);
    }
  }, [systems, onChange]);

  const handleDelete = useCallback(() => {
    if (selectedIndex !== null && selectedSystem && confirm(`Delete system "${selectedSystem.config?.name || selectedSystem.config?.id}"?`)) {
      const newSystems = systems.filter((_, i) => i !== selectedIndex);
      onChange(newSystems);
      setSelectedIndex(null);
    }
  }, [systems, onChange, selectedIndex, selectedSystem]);

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
    setSelectedIndex(systems.length); // Index of newly added system
    setShowTypePicker(false);
  }, [systems, onChange]);

  const toggleCategoryExpand = useCallback((type) => {
    setExpandedCategories(prev => ({
      ...prev,
      [type]: !prev[type],
    }));
  }, []);

  const toggleAllInCategory = useCallback((category) => {
    const categoryItems = groupedSystems[category] || [];
    const allEnabled = categoryItems.every(s => s.enabled !== false);
    const newEnabled = !allEnabled;

    // Get IDs of systems in this category
    const categoryIds = new Set(categoryItems.map(s => s.config?.id));

    const newSystems = systems.map(s => {
      if (categoryIds.has(s.config?.id)) {
        return { ...s, enabled: newEnabled };
      }
      return s;
    });
    onChange(newSystems);
  }, [systems, groupedSystems, onChange]);

  return (
    <div className="editor-container">
      <div className="header">
        <h1 className="title">Systems</h1>
        <p className="subtitle">Configure simulation systems that run during the simulation phase. Click a system to edit.</p>
      </div>

      {/* Category sections */}
      {categories.map((category) => {
        const categoryConfig = SYSTEM_CATEGORIES[category] || { icon: '⚙️', label: category };
        const categoryItems = groupedSystems[category] || [];
        const allEnabled = categoryItems.every(s => s.enabled !== false);

        return (
          <CategorySection
            key={category}
            id={category}
            icon={categoryConfig.icon}
            label={categoryConfig.label}
            items={categoryItems}
            expanded={expandedCategories[category] !== false}
            onToggleExpand={() => toggleCategoryExpand(category)}
            allEnabled={allEnabled}
            onToggleAll={() => toggleAllInCategory(category)}
            gridClassName="list-grid"
            renderItem={(system) => {
              const flatIndex = systems.findIndex((s) => s.config?.id === system.config?.id);
              return (
                <SystemListCard
                  key={flatIndex}
                  system={system}
                  onClick={() => setSelectedIndex(flatIndex)}
                  onToggle={() => handleToggle(system)}
                  usageMap={usageMap}
                />
              );
            }}
          />
        );
      })}

      {/* Add System button */}
      <div style={{ marginTop: '16px' }}>
        <div
          className="add-card"
          style={{ maxWidth: '320px' }}
          onClick={() => setShowTypePicker(true)}
        >
          <span style={{ fontSize: '24px' }}>+</span>
          <span>Add System</span>
        </div>
      </div>

      {showTypePicker && (
        <div className="modal-overlay" onClick={() => setShowTypePicker(false)}>
          <div className="modal" style={{ maxWidth: '600px', height: 'auto', maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Choose System Type</div>
              <button className="close-btn" onClick={() => setShowTypePicker(false)}>×</button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <div className="type-picker">
                {Object.entries(SYSTEM_TYPES).map(([type, config]) => (
                  <div
                    key={type}
                    className="se-type-option type-option"
                    onClick={() => handleAddSystem(type)}
                  >
                    <div className="type-option-icon">{config.icon}</div>
                    <div className="type-option-label">{config.label}</div>
                    <div className="type-option-desc">{config.desc}</div>
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
          onClose={() => setSelectedIndex(null)}
          onDelete={handleDelete}
          schema={schema}
          pressures={pressures}
        />
      )}
    </div>
  );
}

export { SystemsEditor };
