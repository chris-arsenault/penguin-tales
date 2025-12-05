/**
 * PressuresEditor - Main component for editing pressure configurations
 */

import React, { useState, useCallback } from 'react';
import { PressureCard } from './cards';

export default function PressuresEditor({ pressures = [], onChange, schema, usageMap }) {
  const [expandedPressure, setExpandedPressure] = useState(null);

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
      <div className="editor-container">
        <div className="header">
          <h1 className="title">Pressures</h1>
          <p className="subtitle">
            Configure environmental and social pressures that drive world evolution
          </p>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">🌡️</div>
          <div style={{ fontSize: '18px', fontWeight: 500, color: '#ffffff', marginBottom: '8px' }}>
            No pressures defined
          </div>
          <div style={{ marginBottom: '24px' }}>
            Pressures are forces that grow and decay based on world state,
            driving the narrative forward.
          </div>
          <button
            className="btn btn-primary"
            style={{ width: 'auto', padding: '14px 28px' }}
            onClick={handleAddPressure}
          >
            + Create First Pressure
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="header">
        <h1 className="title">Pressures</h1>
        <p className="subtitle">
          Configure environmental and social pressures that drive world evolution.
          Each pressure has feedback factors that make it grow or shrink based on world state.
        </p>
      </div>

      <div className="list-stack">
        {pressures.map((pressure, index) => (
          <PressureCard
            key={index}
            pressure={pressure}
            expanded={expandedPressure === index}
            onToggle={() => setExpandedPressure(expandedPressure === index ? null : index)}
            onChange={(updatedPressure) => handlePressureChange(index, updatedPressure)}
            onDelete={() => handleDeletePressure(index)}
            schema={schema}
            usageMap={usageMap}
          />
        ))}

        <button
          className="btn btn-add"
          onClick={handleAddPressure}
        >
          + Add Pressure
        </button>
      </div>
    </div>
  );
}

export { PressuresEditor };
