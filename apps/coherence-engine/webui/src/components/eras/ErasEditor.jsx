/**
 * ErasEditor - Full-featured editor for era configurations
 *
 * Eras define historical periods that structure world generation.
 * Each era has:
 * - Basic config (id, name, description)
 * - Template weights (which generators are active and how strongly)
 * - System modifiers (how systems behave during this era)
 * - Entry/Exit conditions and effects for era transitions
 */

import React, { useState, useCallback } from 'react';
import { EraCard } from './EraCard';

/**
 * @param {Object} props
 * @param {Array} props.eras - Array of era objects
 * @param {Function} props.onChange - Called when eras change
 * @param {Array} props.generators - Available generators
 * @param {Array} props.systems - Available systems
 * @param {Array} props.pressures - Available pressures
 * @param {Object} props.schema - Domain schema
 * @param {Object} props.usageMap - Usage tracking map
 */
export default function ErasEditor({
  eras = [],
  onChange,
  generators = [],
  systems = [],
  pressures = [],
  schema,
  usageMap,
}) {
  const [expandedEra, setExpandedEra] = useState(null);

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
      entryConditions: [],
      entryEffects: {},
      exitConditions: [{ type: 'time', minTicks: 50 }],
      exitEffects: {},
    };
    onChange([...eras, newEra]);
    setExpandedEra(eras.length);
  }, [eras, onChange]);

  if (eras.length === 0) {
    return (
      <div className="editor-container">
        <div className="header">
          <h1 className="title">Eras</h1>
          <p className="subtitle">
            Define historical eras that structure world generation
          </p>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">🕰️</div>
          <div className="empty-state-title">
            No eras defined
          </div>
          <div className="empty-state-desc">
            Eras control which generators and systems are active during different
            phases of world history.
          </div>
          <button
            className="btn btn-primary"
            style={{ width: 'auto', padding: '14px 28px' }}
            onClick={handleAddEra}
          >
            + Create First Era
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="header">
        <h1 className="title">Eras</h1>
        <p className="subtitle">
          Define historical eras that structure world generation. Each era controls
          which generators and systems are active and at what strength.
        </p>
      </div>

      <div className="list-stack">
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
            allEras={eras}
          />
        ))}

        <button
          className="btn btn-add"
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
