/**
 * PressureCard - Expandable card for editing a pressure
 */

import React, { useState, useCallback, useMemo } from 'react';
import { FactorCard } from './FactorCard';
import { FactorEditorModal } from '../modals/FactorEditorModal';
import { getElementValidation, useLocalInputState, NumberInput } from '../../shared';

export function PressureCard({ pressure, expanded, onToggle, onChange, onDelete, schema, usageMap }) {
  const [hovering, setHovering] = useState(false);
  const [editingFactor, setEditingFactor] = useState(null);
  const [addingFactorType, setAddingFactorType] = useState(null);

  const handleFieldChange = useCallback((field, value) => {
    onChange({
      ...pressure,
      [field]: value,
    });
  }, [pressure, onChange]);

  const [localId, setLocalId, handleIdBlur] = useLocalInputState(
    pressure.id,
    (value) => handleFieldChange('id', value)
  );
  const [localName, setLocalName, handleNameBlur] = useLocalInputState(
    pressure.name,
    (value) => handleFieldChange('name', value)
  );

  // Get validation and usage info
  const validation = useMemo(() =>
    usageMap ? getElementValidation(usageMap, 'pressure', pressure.id) : { invalidRefs: [], isOrphan: false },
    [usageMap, pressure.id]
  );

  const usage = useMemo(() => {
    if (!usageMap?.pressures?.[pressure.id]) return null;
    return usageMap.pressures[pressure.id];
  }, [usageMap, pressure.id]);

  const hasErrors = validation.invalidRefs.length > 0;
  const isOrphan = validation.isOrphan;
  const usedByCount = usage ? (usage.generators?.length || 0) + (usage.systems?.length || 0) + (usage.actions?.length || 0) : 0;

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

  // Compute feedback loop balance status
  const feedbackStatus = useMemo(() => {
    const hasPositive = positiveFeedback.length > 0;
    const hasNegative = negativeFeedback.length > 0;
    const hasDecay = (pressure.decay || 0) > 0;

    if (!hasPositive && !hasNegative && !hasDecay) {
      return { icon: '⚪', color: '#9ca3af', label: 'Static', description: 'No feedback - pressure stays constant' };
    }
    if (!hasPositive && !hasNegative && hasDecay) {
      return { icon: '📉', color: '#ef4444', label: 'Decay Only', description: 'Will decrease over time' };
    }
    if (hasPositive && !hasNegative) {
      return { icon: '📈', color: '#f59e0b', label: 'Runaway', description: 'May grow unbounded - consider adding negative feedback' };
    }
    if (!hasPositive && hasNegative) {
      return { icon: '📉', color: '#3b82f6', label: 'Diminishing', description: 'Will trend toward zero' };
    }
    // Both present - balanced
    return { icon: '⚖️', color: '#22c55e', label: 'Balanced', description: 'Has both growth and decay factors' };
  }, [positiveFeedback.length, negativeFeedback.length, pressure.decay]);

  return (
    <div className="expandable-card">
      <div
        className="expandable-card-header"
        onClick={onToggle}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="expandable-card-title">
          <span className="expandable-card-name">{pressure.name}</span>
          <span className="expandable-card-id">{pressure.id}</span>
          {hasErrors && (
            <span className="card-error-badge">
              {validation.invalidRefs.length} error{validation.invalidRefs.length !== 1 ? 's' : ''}
            </span>
          )}
          {usedByCount > 0 && (
            <span className="card-usage-badge">
              Used by {usedByCount}
            </span>
          )}
          {isOrphan && !hasErrors && (
            <span className="card-orphan-badge">
              Not used
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div className="expandable-card-stats">
            <div className="stat">
              <span className="stat-label">Initial</span>
              <span className="stat-value">{pressure.initialValue}</span>
              <div className="stat-bar">
                <div
                  className="stat-bar-fill"
                  style={{ width: `${pressure.initialValue}%`, backgroundColor: '#3b82f6' }}
                />
              </div>
            </div>
            <div className="stat">
              <span className="stat-label">Decay</span>
              <span className="stat-value">{pressure.decay}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Factors</span>
              <span className="stat-value">
                <span style={{ color: '#86efac' }}>+{positiveFeedback.length}</span>
                {' / '}
                <span style={{ color: '#fca5a5' }}>−{negativeFeedback.length}</span>
              </span>
            </div>
            <div className="stat" title={feedbackStatus.description}>
              <span className="stat-label">Balance</span>
              <span className="stat-value" style={{ color: feedbackStatus.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>{feedbackStatus.icon}</span>
                <span style={{ fontSize: '11px' }}>{feedbackStatus.label}</span>
              </span>
            </div>
          </div>
          <span className={`expand-icon ${expanded ? 'expand-icon-open' : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {expanded && (
        <div className="expandable-card-content">
          {/* Basic Info */}
          <div className="section">
            <div className="section-header">
              <div className="section-title">
                <span className="section-icon">⚙️</span>
                Basic Configuration
              </div>
            </div>
            <div className="input-grid">
              <div className="input-group">
                <label className="label">ID</label>
                <input
                  type="text"
                  value={localId}
                  onChange={(e) => setLocalId(e.target.value)}
                  onBlur={handleIdBlur}
                  className="input"
                />
              </div>
              <div className="input-group">
                <label className="label">Name</label>
                <input
                  type="text"
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  onBlur={handleNameBlur}
                  className="input"
                />
              </div>
              <div className="input-group">
                <label className="label">Initial Value (0-100)</label>
                <NumberInput
                  value={pressure.initialValue}
                  onChange={(v) => handleFieldChange('initialValue', v ?? 0)}
                  min={0}
                  max={100}
                />
              </div>
              <div className="input-group">
                <label className="label">Decay (per tick)</label>
                <NumberInput
                  value={pressure.decay}
                  onChange={(v) => handleFieldChange('decay', v ?? 0)}
                  min={0}
                />
              </div>
              <div className="input-group">
                <label className="label">Base Growth</label>
                <NumberInput
                  value={pressure.growth?.baseGrowth || 0}
                  onChange={(v) => handleGrowthChange('baseGrowth', v ?? 0)}
                />
              </div>
              <div className="input-group">
                <label className="label">Max Growth (optional)</label>
                <NumberInput
                  value={pressure.growth?.maxGrowth}
                  onChange={(v) => handleGrowthChange('maxGrowth', v)}
                  allowEmpty
                  placeholder="No limit"
                />
              </div>
            </div>
          </div>

          {/* Positive Feedback */}
          <div className="section">
            <div className="section-header">
              <div className="section-title">
                <span className="section-icon">📈</span>
                Positive Feedback
                <span className="section-count">{positiveFeedback.length}</span>
              </div>
            </div>
            <div className="nested-card-list">
              {positiveFeedback.length === 0 ? (
                <div className="nested-card-empty">
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
                className="btn-add-inline"
                onClick={() => handleAddFactor('positive')}
              >
                + Add Positive Factor
              </button>
            </div>
          </div>

          {/* Negative Feedback */}
          <div className="section">
            <div className="section-header">
              <div className="section-title">
                <span className="section-icon">📉</span>
                Negative Feedback
                <span className="section-count">{negativeFeedback.length}</span>
              </div>
            </div>
            <div className="nested-card-list">
              {negativeFeedback.length === 0 ? (
                <div className="nested-card-empty">
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
                className="btn-add-inline"
                onClick={() => handleAddFactor('negative')}
              >
                + Add Negative Factor
              </button>
            </div>
          </div>

          {/* Delete pressure button */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <button
              className="btn btn-danger"
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
