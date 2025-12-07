/**
 * EraCard - Expandable card for editing an era
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  BasicInfoSection,
  GeneratorsSection,
  SystemsSection,
  TransitionsGrid,
} from './sections';

/**
 * @param {Object} props
 * @param {Object} props.era - The era object
 * @param {boolean} props.expanded - Whether the card is expanded
 * @param {Function} props.onToggle - Called to toggle expansion
 * @param {Function} props.onChange - Called when era changes
 * @param {Function} props.onDelete - Called to delete the era
 * @param {Array} props.generators - Available generators
 * @param {Array} props.systems - Available systems
 * @param {Array} props.pressures - Available pressures
 * @param {Object} props.schema - Domain schema
 * @param {Object} props.usageMap - Usage tracking map
 * @param {Array} props.allEras - All eras for nextEra selection
 */
export function EraCard({
  era,
  expanded,
  onToggle,
  onChange,
  onDelete,
  generators,
  systems,
  pressures,
  schema,
  usageMap,
  allEras,
}) {
  const [hovering, setHovering] = useState(false);
  const [weightsExpanded, setWeightsExpanded] = useState(false);

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

  // Field change handler
  const handleFieldChange = useCallback((field, value) => {
    onChange({ ...era, [field]: value });
  }, [era, onChange]);

  // Template weight handlers
  const handleWeightChange = useCallback((key, value) => {
    onChange({
      ...era,
      templateWeights: { ...era.templateWeights, [key]: value },
    });
  }, [era, onChange]);

  const handleRemoveWeight = useCallback((key) => {
    const newWeights = { ...era.templateWeights };
    delete newWeights[key];
    onChange({ ...era, templateWeights: newWeights });
  }, [era, onChange]);

  const handleAddWeight = useCallback((genId) => {
    onChange({
      ...era,
      templateWeights: { ...era.templateWeights, [genId]: 2 },
    });
  }, [era, onChange]);

  // System modifier handlers
  const handleModifierChange = useCallback((key, value) => {
    onChange({
      ...era,
      systemModifiers: { ...era.systemModifiers, [key]: value },
    });
  }, [era, onChange]);

  const handleRemoveModifier = useCallback((key) => {
    const newModifiers = { ...era.systemModifiers };
    delete newModifiers[key];
    onChange({ ...era, systemModifiers: newModifiers });
  }, [era, onChange]);

  const handleAddModifier = useCallback((sysId) => {
    onChange({
      ...era,
      systemModifiers: { ...era.systemModifiers, [sysId]: 2 },
    });
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

  // Name lookup helpers
  const getGeneratorName = (id) => {
    const gen = generators.find(g => g.id === id);
    return gen?.name || id.replace(/_/g, ' ');
  };

  const getSystemName = (id) => {
    const sys = systems.find(s => s.config?.id === id);
    return sys?.config?.name || id.replace(/_/g, ' ');
  };

  // Sorted entries for stable display
  const templateWeights = Object.entries(era.templateWeights || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const systemModifiers = Object.entries(era.systemModifiers || {}).sort((a, b) => a[0].localeCompare(b[0]));

  // Available items to add
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

  const availablePressuresForEntry = useMemo(() => {
    const currentIds = new Set(Object.keys(era.entryEffects?.pressureChanges || {}));
    return (pressures || []).filter(p => !currentIds.has(p.id)).map(p => ({ id: p.id, name: p.name || p.id }));
  }, [pressures, era.entryEffects]);

  const availablePressuresForExit = useMemo(() => {
    const currentIds = new Set(Object.keys(era.exitEffects?.pressureChanges || {}));
    return (pressures || []).filter(p => !currentIds.has(p.id)).map(p => ({ id: p.id, name: p.name || p.id }));
  }, [pressures, era.exitEffects]);

  // Counts
  const activeGenerators = templateWeights.filter(([, v]) => v > 0).length;
  const activeSystems = systemModifiers.filter(([, v]) => v > 0).length;
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
            {validation.totalInvalid > 0 && (
              <span className="badge-error">
                {validation.totalInvalid} invalid ref{validation.totalInvalid !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="expandable-card-desc">{era.description}</div>
        </div>
        <div className="expandable-card-stats">
          <div className="stat">
            <span className="stat-label">Generators</span>
            <span className="stat-value">
              {activeGenerators}<span className="stat-total">/{templateWeights.length}</span>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Systems</span>
            <span className="stat-value">
              {activeSystems}<span className="stat-total">/{systemModifiers.length}</span>
            </span>
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

          {/* Weights Accordion - Generators & Systems */}
          <div className="weights-accordion">
            <div
              className={`weights-accordion-header ${weightsExpanded ? 'expanded' : ''}`}
              onClick={() => setWeightsExpanded(!weightsExpanded)}
            >
              <span className="weights-accordion-icon">{weightsExpanded ? '▼' : '▶'}</span>
              <span className="weights-accordion-title">Generator & System Weights</span>
              <span className="weights-accordion-summary">
                {activeGenerators} generator{activeGenerators !== 1 ? 's' : ''}, {activeSystems} system{activeSystems !== 1 ? 's' : ''}
              </span>
            </div>
            {weightsExpanded && (
              <div className="weights-accordion-content">
                <GeneratorsSection
                  templateWeights={templateWeights}
                  activeCount={activeGenerators}
                  getGeneratorName={getGeneratorName}
                  onWeightChange={handleWeightChange}
                  onRemove={handleRemoveWeight}
                  availableGenerators={availableGenerators}
                  onAdd={handleAddWeight}
                />

                <SystemsSection
                  systemModifiers={systemModifiers}
                  activeCount={activeSystems}
                  getSystemName={getSystemName}
                  onModifierChange={handleModifierChange}
                  onRemove={handleRemoveModifier}
                  availableSystems={availableSystems}
                  onAdd={handleAddModifier}
                />
              </div>
            )}
          </div>

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
