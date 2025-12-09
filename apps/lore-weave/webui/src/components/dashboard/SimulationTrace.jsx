/**
 * SimulationTrace - Compact trace summary with button to open full view
 */

import React, { useMemo } from 'react';

/**
 * Calculate summary stats from pressure updates
 */
function calculateStats(pressureUpdates, epochStats) {
  if (!pressureUpdates?.length) {
    return { ticks: 0, pressures: 0, epochs: 0, entityKinds: 0 };
  }

  const pressureIds = pressureUpdates[0]?.pressures?.map(p => p.id) || [];
  const epochs = new Set(pressureUpdates.map(u => u.epoch));
  const entityKinds = new Set();

  for (const stat of epochStats || []) {
    for (const kind of Object.keys(stat.entitiesByKind || {})) {
      entityKinds.add(kind);
    }
  }

  // Calculate pressure ranges
  const pressureRanges = {};
  for (const id of pressureIds) {
    let min = Infinity, max = -Infinity;
    for (const update of pressureUpdates) {
      const p = update.pressures.find(p => p.id === id);
      if (p) {
        if (p.newValue < min) min = p.newValue;
        if (p.newValue > max) max = p.newValue;
      }
    }
    const name = pressureUpdates[0]?.pressures.find(p => p.id === id)?.name || id;
    pressureRanges[id] = { name, min, max };
  }

  return {
    ticks: pressureUpdates.length,
    pressures: pressureIds.length,
    epochs: epochs.size,
    entityKinds: entityKinds.size,
    pressureRanges,
  };
}

export default function SimulationTrace({
  pressureUpdates = [],
  epochStats = [],
  onOpenTrace,
}) {
  const stats = useMemo(
    () => calculateStats(pressureUpdates, epochStats),
    [pressureUpdates, epochStats]
  );

  // Don't render if no data
  if (stats.ticks === 0) {
    return null;
  }

  return (
    <div className="lw-panel lw-trace-summary">
      <div className="lw-trace-summary-header">
        <div className="lw-trace-summary-title">
          <span className="lw-trace-summary-icon">📊</span>
          Simulation Trace
        </div>
        <button
          className="lw-btn lw-btn-primary lw-btn-sm"
          onClick={onOpenTrace}
        >
          Open Trace View
        </button>
      </div>

      <div className="lw-trace-summary-stats">
        <div className="lw-trace-summary-stat">
          <span className="lw-trace-summary-stat-value">{stats.ticks}</span>
          <span className="lw-trace-summary-stat-label">ticks</span>
        </div>
        <div className="lw-trace-summary-stat">
          <span className="lw-trace-summary-stat-value">{stats.epochs}</span>
          <span className="lw-trace-summary-stat-label">epochs</span>
        </div>
        <div className="lw-trace-summary-stat">
          <span className="lw-trace-summary-stat-value">{stats.pressures}</span>
          <span className="lw-trace-summary-stat-label">pressures</span>
        </div>
        <div className="lw-trace-summary-stat">
          <span className="lw-trace-summary-stat-value">{stats.entityKinds}</span>
          <span className="lw-trace-summary-stat-label">entity kinds</span>
        </div>
      </div>

      {/* Pressure ranges preview */}
      {Object.keys(stats.pressureRanges || {}).length > 0 && (
        <div className="lw-trace-summary-pressures">
          {Object.entries(stats.pressureRanges).slice(0, 4).map(([id, range]) => (
            <div key={id} className="lw-trace-summary-pressure">
              <span className="lw-trace-summary-pressure-name">{range.name}</span>
              <span className="lw-trace-summary-pressure-range">
                {range.min.toFixed(0)} → {range.max.toFixed(0)}
              </span>
            </div>
          ))}
          {Object.keys(stats.pressureRanges).length > 4 && (
            <div className="lw-trace-summary-pressure-more">
              +{Object.keys(stats.pressureRanges).length - 4} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}
