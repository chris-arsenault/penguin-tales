/**
 * EraCard - Expandable card for editing an era
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  BasicInfoSection,
  TransitionsGrid,
} from './sections';

/**
 * @param {Object} props
 * @param {Object} props.era - The era object
 * @param {boolean} props.expanded - Whether the card is expanded
 * @param {Function} props.onToggle - Called to toggle expansion
 * @param {Function} props.onChange - Called when era changes
 * @param {Function} props.onDelete - Called to delete the era
 * @param {Array} props.pressures - Available pressures
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.allEras - All eras for nextEra selection
 */
export function EraCard({
  era,
  expanded,
  onToggle,
  onChange,
  onDelete,
  pressures,
  schema,
  allEras,
}) {
  const [hovering, setHovering] = useState(false);

  // Field change handler
  const handleFieldChange = useCallback((field, value) => {
    onChange({ ...era, [field]: value });
  }, [era, onChange]);

  // Entry condition handlers
  const handleAddEntryCondition = useCallback(() => {
    onChange({
      ...era,
      entryConditions: [...(era.entryConditions || []), { type: 'pressure', pressureId: '', operator: 'above', threshold: 50 }],
    });
  }, [era, onChange]);

  const handleUpdateEntryCondition = useCallback((index, updated) => {
    const newConditions = [...(era.entryConditions || [])];
    newConditions[index] = updated;
    onChange({ ...era, entryConditions: newConditions });
  }, [era, onChange]);

  const handleRemoveEntryCondition = useCallback((index) => {
    onChange({
      ...era,
      entryConditions: (era.entryConditions || []).filter((_, i) => i !== index),
    });
  }, [era, onChange]);

  // Exit condition handlers
  const handleAddExitCondition = useCallback(() => {
    onChange({
      ...era,
      exitConditions: [...(era.exitConditions || []), { type: 'time', minTicks: 50 }],
    });
  }, [era, onChange]);

  const handleUpdateExitCondition = useCallback((index, updated) => {
    const newConditions = [...(era.exitConditions || [])];
    newConditions[index] = updated;
    onChange({ ...era, exitConditions: newConditions });
  }, [era, onChange]);

  const handleRemoveExitCondition = useCallback((index) => {
    onChange({
      ...era,
      exitConditions: (era.exitConditions || []).filter((_, i) => i !== index),
    });
  }, [era, onChange]);

  // Entry effect handlers
  const handleAddEntryEffect = useCallback((pressureId) => {
    onChange({
      ...era,
      entryEffects: {
        ...(era.entryEffects || {}),
        pressureChanges: { ...(era.entryEffects?.pressureChanges || {}), [pressureId]: 10 },
      },
    });
  }, [era, onChange]);

  const handleUpdateEntryEffect = useCallback((pressureId, value) => {
    onChange({
      ...era,
      entryEffects: {
        ...(era.entryEffects || {}),
        pressureChanges: { ...(era.entryEffects?.pressureChanges || {}), [pressureId]: value },
      },
    });
  }, [era, onChange]);

  const handleRemoveEntryEffect = useCallback((pressureId) => {
    const newChanges = { ...(era.entryEffects?.pressureChanges || {}) };
    delete newChanges[pressureId];
    onChange({
      ...era,
      entryEffects: { ...(era.entryEffects || {}), pressureChanges: newChanges },
    });
  }, [era, onChange]);

  // Exit effect handlers
  const handleAddExitEffect = useCallback((pressureId) => {
    onChange({
      ...era,
      exitEffects: {
        ...(era.exitEffects || {}),
        pressureChanges: { ...(era.exitEffects?.pressureChanges || {}), [pressureId]: 10 },
      },
    });
  }, [era, onChange]);

  const handleUpdateExitEffect = useCallback((pressureId, value) => {
    onChange({
      ...era,
      exitEffects: {
        ...(era.exitEffects || {}),
        pressureChanges: { ...(era.exitEffects?.pressureChanges || {}), [pressureId]: value },
      },
    });
  }, [era, onChange]);

  const handleRemoveExitEffect = useCallback((pressureId) => {
    const newChanges = { ...(era.exitEffects?.pressureChanges || {}) };
    delete newChanges[pressureId];
    onChange({
      ...era,
      exitEffects: { ...(era.exitEffects || {}), pressureChanges: newChanges },
    });
  }, [era, onChange]);

  const availablePressuresForEntry = useMemo(() => {
    const currentIds = new Set(Object.keys(era.entryEffects?.pressureChanges || {}));
    return (pressures || []).filter(p => !currentIds.has(p.id)).map(p => ({ id: p.id, name: p.name || p.id }));
  }, [pressures, era.entryEffects]);

  const availablePressuresForExit = useMemo(() => {
    const currentIds = new Set(Object.keys(era.exitEffects?.pressureChanges || {}));
    return (pressures || []).filter(p => !currentIds.has(p.id)).map(p => ({ id: p.id, name: p.name || p.id }));
  }, [pressures, era.exitEffects]);

  // Counts
  const entryConditions = era.entryConditions || [];
  const exitConditions = era.exitConditions || [];
  const entryPressureChanges = Object.entries(era.entryEffects?.pressureChanges || {});
  const exitPressureChanges = Object.entries(era.exitEffects?.pressureChanges || {});

  return (
    <div className="expandable-card">
      {/* Header */}
      <div
        className="expandable-card-header"
        onClick={onToggle}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="expandable-card-left">
          <div className="expandable-card-title">
            <span className="expandable-card-name">{era.name}</span>
            <span className="expandable-card-id">{era.id}</span>
          </div>
          <div className="expandable-card-desc">{era.description}</div>
        </div>
        <div className="expandable-card-stats">
          <div className="stat">
            <span className="stat-label">Entry</span>
            <span className="stat-value">{entryConditions.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Exit</span>
            <span className="stat-value">{exitConditions.length}</span>
          </div>
          <span className={`expand-icon ${expanded ? 'open' : ''}`}>▼</span>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="expandable-card-content">
          <BasicInfoSection era={era} onFieldChange={handleFieldChange} />

          {/* Two-column transitions grid: Entry (left) | Exit (right) */}
          <TransitionsGrid
            entryConditions={entryConditions}
            exitConditions={exitConditions}
            entryPressureChanges={entryPressureChanges}
            exitPressureChanges={exitPressureChanges}
            onUpdateEntryCondition={handleUpdateEntryCondition}
            onRemoveEntryCondition={handleRemoveEntryCondition}
            onAddEntryCondition={handleAddEntryCondition}
            onUpdateExitCondition={handleUpdateExitCondition}
            onRemoveExitCondition={handleRemoveExitCondition}
            onAddExitCondition={handleAddExitCondition}
            onUpdateEntryEffect={handleUpdateEntryEffect}
            onRemoveEntryEffect={handleRemoveEntryEffect}
            onAddEntryEffect={handleAddEntryEffect}
            onUpdateExitEffect={handleUpdateExitEffect}
            onRemoveExitEffect={handleRemoveExitEffect}
            onAddExitEffect={handleAddExitEffect}
            availablePressuresForEntry={availablePressuresForEntry}
            availablePressuresForExit={availablePressuresForExit}
            pressures={pressures}
            schema={schema}
          />

          {/* Delete button */}
          <div className="card-footer">
            <button className="btn btn-danger" onClick={onDelete}>
              Delete Era
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
