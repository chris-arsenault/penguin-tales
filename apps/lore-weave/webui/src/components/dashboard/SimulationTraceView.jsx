/**
 * SimulationTraceView - Full-screen trace visualization with detail panel
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  ReferenceArea,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';

// Color palettes
const PRESSURE_COLORS = [
  '#f59e0b', '#ef4444', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

const ENTITY_COLORS = [
  '#60a5fa', '#34d399', '#fbbf24', '#a78bfa',
  '#fb7185', '#2dd4bf', '#fb923c', '#c084fc',
];

const ERA_COLORS = [
  'rgba(59, 130, 246, 0.15)',
  'rgba(168, 85, 247, 0.15)',
  'rgba(236, 72, 153, 0.15)',
  'rgba(34, 197, 94, 0.15)',
  'rgba(249, 115, 22, 0.15)',
];

const EVENT_COLORS = {
  template: '#22c55e',
  system: '#8b5cf6',
  action: '#f59e0b',
};

const EVENT_SYMBOLS = {
  template: '▲',
  system: '◆',
  action: '●',
};

/**
 * Transform template applications for scatter overlay on pressure chart
 * Returns scatter points with stacked Y positions for multiple templates at same tick
 */
function transformTemplateScatterData(templateApplications, pressureData) {
  if (!templateApplications?.length) {
    return { scatterData: [], templatesByTick: new Map(), templateById: new Map() };
  }

  // Group templates by tick
  const templatesByTick = new Map();
  const templateById = new Map();
  for (const app of templateApplications) {
    if (!templatesByTick.has(app.tick)) {
      templatesByTick.set(app.tick, []);
    }
    templatesByTick.get(app.tick).push(app);
    // Create unique ID for each template application
    const uniqueId = `${app.tick}-${app.templateId}-${templatesByTick.get(app.tick).length - 1}`;
    templateById.set(uniqueId, app);
  }

  // Calculate Y range from pressure data for positioning
  let minY = 0;
  let maxY = 100;
  if (pressureData?.length > 0) {
    const firstRow = pressureData[0];
    const pressureKeys = Object.keys(firstRow).filter(k => !k.endsWith('_name') && k !== 'tick' && k !== 'era' && k !== 'epoch');
    let foundMin = false;
    for (const row of pressureData) {
      for (const key of pressureKeys) {
        const val = row[key];
        if (typeof val === 'number') {
          if (val > maxY) maxY = val;
          if (!foundMin || val < minY) {
            minY = val;
            foundMin = true;
          }
        }
      }
    }
  }

  // Build scatter data with stacked Y positions
  // Position icons at the bottom of the visible range, stacking upward
  const range = maxY - minY || 100;
  const iconSpacing = range * 0.03; // 3% of visible range per icon
  const baseY = minY + range * 0.08; // Start 8% up from bottom of visible range

  const scatterData = [];
  for (const [tick, apps] of templatesByTick) {
    apps.forEach((app, stackIndex) => {
      const uniqueId = `${tick}-${app.templateId}-${stackIndex}`;
      scatterData.push({
        tick,
        y: baseY + (stackIndex * iconSpacing),
        templateId: app.templateId,
        uniqueId,
        entitiesCreated: app.entitiesCreated.length,
        epoch: app.epoch,
        stackIndex,
        totalAtTick: apps.length,
      });
    });
  }

  return { scatterData, templatesByTick, templateById };
}

/**
 * Transform pressure updates for charting
 */
function transformPressureData(pressureUpdates) {
  if (!pressureUpdates?.length) {
    return { data: [], pressureIds: [], breakdownsByTick: new Map() };
  }

  const pressureIds = pressureUpdates[0]?.pressures?.map(p => p.id) || [];
  const breakdownsByTick = new Map();

  const data = pressureUpdates.map(update => {
    const point = { tick: update.tick, epoch: update.epoch };
    const tickBreakdowns = new Map();

    // Group discrete modifications by pressure ID
    const discreteByPressure = new Map();
    for (const mod of update.discreteModifications || []) {
      if (!discreteByPressure.has(mod.pressureId)) {
        discreteByPressure.set(mod.pressureId, []);
      }
      discreteByPressure.get(mod.pressureId).push(mod);
    }

    for (const p of update.pressures) {
      point[p.id] = p.newValue;
      point[`${p.id}_name`] = p.name;

      if (p.breakdown) {
        // Get discrete modifications for this pressure
        const discreteMods = discreteByPressure.get(p.id) || [];
        const discreteTotal = discreteMods.reduce((sum, m) => sum + m.delta, 0);

        tickBreakdowns.set(p.id, {
          id: p.id,
          name: p.name,
          value: p.newValue,
          previousValue: p.previousValue,
          delta: p.newValue - p.previousValue,
          breakdown: p.breakdown,
          // Add discrete modifications for this pressure
          discreteModifications: discreteMods,
          discreteTotal,
        });
      }
    }

    if (tickBreakdowns.size > 0) {
      breakdownsByTick.set(update.tick, tickBreakdowns);
    }

    return point;
  });

  return { data, pressureIds, breakdownsByTick };
}

/**
 * Transform for population chart
 */
function transformPopulationData(pressureUpdates, epochStats) {
  if (!pressureUpdates?.length || !epochStats?.length) {
    return { data: [], entityKinds: [] };
  }

  const epochData = new Map();
  const allKinds = new Set();

  for (const stat of epochStats) {
    epochData.set(stat.epoch, stat.entitiesByKind || {});
    for (const kind of Object.keys(stat.entitiesByKind || {})) {
      allKinds.add(kind);
    }
  }

  const entityKinds = Array.from(allKinds).sort();

  const data = pressureUpdates.map(update => {
    const counts = epochData.get(update.epoch) || {};
    const point = { tick: update.tick, epoch: update.epoch };
    for (const kind of entityKinds) {
      point[kind] = counts[kind] || 0;
    }
    return point;
  });

  return { data, entityKinds };
}

/**
 * Extract era boundaries
 */
function extractEraBoundaries(pressureUpdates, epochStats) {
  const boundaries = [];
  let currentEpoch = -1;
  let currentEra = null;
  let startTick = 0;

  for (const update of pressureUpdates || []) {
    if (update.epoch !== currentEpoch) {
      if (currentEra !== null) {
        boundaries.push({ era: currentEra, epoch: currentEpoch, startTick, endTick: update.tick });
      }
      currentEpoch = update.epoch;
      const epochStat = epochStats?.find(e => e.epoch === currentEpoch);
      currentEra = epochStat?.era || `Epoch ${currentEpoch}`;
      startTick = update.tick;
    }
  }

  if (currentEra !== null && pressureUpdates?.length > 0) {
    boundaries.push({
      era: currentEra,
      epoch: currentEpoch,
      startTick,
      endTick: pressureUpdates[pressureUpdates.length - 1].tick,
    });
  }

  return boundaries;
}

/**
 * Detail panel showing pressure breakdown
 */
function DetailPanel({ selectedTick, lockedTick, breakdownsByTick, pressureIds, pressureData, onUnlock }) {
  const displayTick = lockedTick !== null ? lockedTick : selectedTick;
  const isLocked = lockedTick !== null;

  if (displayTick === null) {
    return (
      <div className="lw-trace-view-detail">
        <div className="lw-trace-view-detail-empty">
          <div className="lw-trace-view-detail-empty-icon">📊</div>
          <div>Hover over the chart to see pressure attribution details</div>
          <div className="lw-trace-view-detail-hint">Click to lock selection</div>
        </div>
      </div>
    );
  }

  const tickBreakdowns = breakdownsByTick?.get(displayTick);
  if (!tickBreakdowns) {
    return (
      <div className="lw-trace-view-detail">
        <div className="lw-trace-view-detail-header">
          <span>Tick {displayTick}</span>
          {isLocked && (
            <button className="lw-trace-view-detail-unlock" onClick={onUnlock}>
              Unlock
            </button>
          )}
        </div>
        <div className="lw-trace-view-detail-empty">No breakdown data available</div>
      </div>
    );
  }

  return (
    <div className="lw-trace-view-detail">
      <div className="lw-trace-view-detail-header">
        <span>Tick {displayTick}</span>
        {isLocked ? (
          <button className="lw-trace-view-detail-unlock" onClick={onUnlock}>
            Unlock
          </button>
        ) : (
          <span className="lw-trace-view-detail-hint-inline">Click to lock</span>
        )}
      </div>

      <div className="lw-trace-view-detail-content">
        {pressureIds.map((id, i) => {
          const info = tickBreakdowns.get(id);
          if (!info) return null;

          const { name, value, previousValue, breakdown, discreteModifications, discreteTotal } = info;
          const delta = value - previousValue;
          const hasDiscrete = discreteModifications && discreteModifications.length > 0;

          return (
            <div
              key={id}
              className="lw-trace-view-detail-pressure"
              style={{ borderLeftColor: PRESSURE_COLORS[i % PRESSURE_COLORS.length] }}
            >
              <div className="lw-trace-view-detail-pressure-header">
                <span className="lw-trace-view-detail-pressure-name">{name}</span>
                <span className="lw-trace-view-detail-pressure-value">
                  {value.toFixed(1)}
                  <span className={`lw-trace-view-detail-delta ${delta >= 0 ? 'positive' : 'negative'}`}>
                    ({delta >= 0 ? '+' : ''}{delta.toFixed(2)})
                  </span>
                </span>
              </div>

              {/* Discrete modifications (templates/systems/actions) */}
              {hasDiscrete && (
                <div className="lw-trace-view-detail-discrete">
                  <div className="lw-trace-view-detail-section-header">Discrete Changes</div>
                  {discreteModifications.map((mod, j) => {
                    const sourceType = mod.source?.type || 'unknown';
                    const sourceId = mod.source?.templateId || mod.source?.systemId || mod.source?.actionId || mod.source?.eraId || 'unknown';
                    return (
                      <div key={j} className="lw-trace-view-detail-row">
                        <span className="lw-trace-view-detail-label">
                          <span
                            className="lw-trace-view-discrete-badge"
                            style={{ color: EVENT_COLORS[sourceType] || '#888' }}
                          >
                            {EVENT_SYMBOLS[sourceType] || '●'}
                          </span>
                          {sourceId}
                        </span>
                        <span className={mod.delta >= 0 ? 'positive' : 'negative'}>
                          {mod.delta >= 0 ? '+' : ''}{mod.delta.toFixed(3)}
                        </span>
                      </div>
                    );
                  })}
                  {discreteModifications.length > 1 && (
                    <div className="lw-trace-view-detail-row lw-trace-view-detail-subtotal">
                      <span className="lw-trace-view-detail-label">Discrete subtotal</span>
                      <span className={discreteTotal >= 0 ? 'positive' : 'negative'}>
                        {discreteTotal >= 0 ? '+' : ''}{discreteTotal.toFixed(3)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {breakdown && (
                <div className="lw-trace-view-detail-breakdown">
                  <div className="lw-trace-view-detail-section-header">Feedback</div>

                  {/* Base growth */}
                  {breakdown.baseGrowth !== 0 && (
                    <div className="lw-trace-view-detail-row">
                      <span className="lw-trace-view-detail-label">Base growth</span>
                      <span className={breakdown.baseGrowth >= 0 ? 'positive' : 'negative'}>
                        {breakdown.baseGrowth >= 0 ? '+' : ''}{breakdown.baseGrowth.toFixed(3)}
                      </span>
                    </div>
                  )}

                  {/* Positive feedback */}
                  {breakdown.positiveFeedback?.filter(fb => fb.contribution !== 0).map((fb, j) => (
                    <div key={`pos-${j}`} className="lw-trace-view-detail-row">
                      <span className="lw-trace-view-detail-label">
                        <span className="lw-trace-view-feedback-badge positive">+</span>
                        {fb.label}
                      </span>
                      <span className="positive">+{fb.contribution.toFixed(3)}</span>
                    </div>
                  ))}

                  {/* Negative feedback */}
                  {breakdown.negativeFeedback?.filter(fb => fb.contribution !== 0).map((fb, j) => (
                    <div key={`neg-${j}`} className="lw-trace-view-detail-row">
                      <span className="lw-trace-view-detail-label">
                        <span className="lw-trace-view-feedback-badge negative">−</span>
                        {fb.label}
                      </span>
                      <span className="negative">{fb.contribution.toFixed(3)}</span>
                    </div>
                  ))}

                  {/* Decay */}
                  {breakdown.decay !== 0 && (
                    <div className="lw-trace-view-detail-row">
                      <span className="lw-trace-view-detail-label">Decay</span>
                      <span className="negative">{breakdown.decay.toFixed(3)}</span>
                    </div>
                  )}

                  {/* Distribution */}
                  {breakdown.distributionFeedback !== 0 && (
                    <div className="lw-trace-view-detail-row">
                      <span className="lw-trace-view-detail-label">Distribution</span>
                      <span className={breakdown.distributionFeedback >= 0 ? 'positive' : 'negative'}>
                        {breakdown.distributionFeedback >= 0 ? '+' : ''}{breakdown.distributionFeedback.toFixed(3)}
                      </span>
                    </div>
                  )}

                  {/* Era modifier if not 1 */}
                  {breakdown.eraModifier && breakdown.eraModifier !== 1 && (
                    <div className="lw-trace-view-detail-row lw-trace-view-detail-row-muted">
                      <span className="lw-trace-view-detail-label">Era modifier</span>
                      <span>×{breakdown.eraModifier.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Growth scaling if not 1 */}
                  {breakdown.growthScaling && breakdown.growthScaling !== 1 && (
                    <div className="lw-trace-view-detail-row lw-trace-view-detail-row-muted">
                      <span className="lw-trace-view-detail-label">Growth scaling</span>
                      <span>×{breakdown.growthScaling.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Feedback subtotal */}
                  <div className="lw-trace-view-detail-row lw-trace-view-detail-subtotal">
                    <span className="lw-trace-view-detail-label">Feedback Δ</span>
                    <span className={breakdown.smoothedDelta >= 0 ? 'positive' : 'negative'}>
                      {breakdown.smoothedDelta >= 0 ? '+' : ''}{breakdown.smoothedDelta.toFixed(3)}
                    </span>
                  </div>
                </div>
              )}

              {/* Total delta */}
              <div className="lw-trace-view-detail-row lw-trace-view-detail-total">
                <span className="lw-trace-view-detail-label">Total Δ</span>
                <span className={delta >= 0 ? 'positive' : 'negative'}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(3)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Single template detail panel - shows one template application
 */
function SingleTemplateDetailPanel({ template, isLocked, onClear }) {
  if (!template) {
    return (
      <div className="lw-trace-view-detail">
        <div className="lw-trace-view-detail-empty">
          <div className="lw-trace-view-detail-empty-icon">▲</div>
          <div>Hover over a template icon to see details</div>
          <div className="lw-trace-view-detail-hint">Click to lock selection</div>
        </div>
      </div>
    );
  }

  const app = template;
  return (
    <div className="lw-trace-view-detail">
      <div className="lw-trace-view-detail-header">
        <span>
          <span style={{ color: '#22c55e', marginRight: 6 }}>▲</span>
          Tick {app.tick} • Epoch {app.epoch}
        </span>
        {isLocked && (
          <button className="lw-trace-view-detail-unlock" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      <div className="lw-trace-view-detail-content">
        <div className="lw-trace-view-template-app">
          <div className="lw-trace-view-template-header">
            <span className="lw-trace-view-template-id">{app.templateId}</span>
            <span className="lw-trace-view-template-target">
              → {app.targetEntityName} ({app.targetEntityKind})
            </span>
          </div>

          {app.description && (
            <div className="lw-trace-view-template-desc">{app.description}</div>
          )}

          {/* Entities Created */}
          {app.entitiesCreated?.length > 0 && (
            <div className="lw-trace-view-template-section">
              <div className="lw-trace-view-detail-section-header">
                Entities Created ({app.entitiesCreated.length})
              </div>
              {app.entitiesCreated.map((entity, j) => (
                <div key={j} className="lw-trace-view-entity-card">
                  {/* Identity */}
                  <div className="lw-trace-view-entity-identity">
                    <span className="lw-trace-view-entity-name">{entity.name}</span>
                    <span className="lw-trace-view-entity-kind">
                      {entity.kind}/{entity.subtype}
                    </span>
                  </div>

                  {/* Attributes row */}
                  <div className="lw-trace-view-entity-attrs">
                    <div className="lw-trace-view-entity-attr">
                      <span className="lw-trace-view-entity-attr-label">Culture</span>
                      <span className="lw-trace-view-entity-attr-value">{entity.culture}</span>
                    </div>
                    <div className="lw-trace-view-entity-attr">
                      <span className="lw-trace-view-entity-attr-label">Prominence</span>
                      <span className="lw-trace-view-entity-attr-value">{entity.prominence}</span>
                    </div>
                  </div>

                  {/* Placement section */}
                  <div className="lw-trace-view-entity-placement">
                    <div className="lw-trace-view-entity-section-label">Placement</div>
                    <div className="lw-trace-view-entity-placement-grid">
                      {/* Anchor type requested */}
                      <div className="lw-trace-view-entity-placement-row">
                        <span className="lw-trace-view-entity-placement-label">Anchor</span>
                        <span className="lw-trace-view-entity-placement-value">
                          <span className={`lw-trace-view-anchor-badge ${entity.placement?.anchorType || 'unknown'}`}>
                            {entity.placement?.anchorType || entity.placementStrategy}
                          </span>
                        </span>
                      </div>

                      {/* How it was actually resolved */}
                      <div className="lw-trace-view-entity-placement-row">
                        <span className="lw-trace-view-entity-placement-label">Resolved Via</span>
                        <span className="lw-trace-view-entity-placement-value">
                          <span className={`lw-trace-view-resolved-badge ${entity.placement?.resolvedVia || 'unknown'}`}>
                            {entity.placement?.resolvedVia || entity.placementStrategy}
                          </span>
                          {entity.placement?.resolvedVia === 'random' && (
                            <span className="lw-trace-view-fallback-badge">fallback</span>
                          )}
                        </span>
                      </div>

                      {/* Anchor entity (for entity anchors) */}
                      {entity.placement?.anchorEntity && (
                        <div className="lw-trace-view-entity-placement-row">
                          <span className="lw-trace-view-entity-placement-label">Near Entity</span>
                          <span className="lw-trace-view-entity-placement-value">
                            <span className="lw-trace-view-anchor-entity">
                              {entity.placement.anchorEntity.name}
                            </span>
                            <span className="lw-trace-view-anchor-entity-kind">
                              ({entity.placement.anchorEntity.kind})
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Culture used for placement */}
                      {entity.placement?.anchorCulture && (
                        <div className="lw-trace-view-entity-placement-row">
                          <span className="lw-trace-view-entity-placement-label">Culture</span>
                          <span className="lw-trace-view-entity-placement-value">
                            {entity.placement.anchorCulture}
                          </span>
                        </div>
                      )}

                      {/* Seed regions available */}
                      {entity.placement?.seedRegionsAvailable?.length > 0 && (
                        <div className="lw-trace-view-entity-placement-row">
                          <span className="lw-trace-view-entity-placement-label">Seed Regions</span>
                          <span className="lw-trace-view-entity-placement-value">
                            {entity.placement.seedRegionsAvailable.length} available
                          </span>
                        </div>
                      )}

                      {/* Emergent region created */}
                      {entity.placement?.emergentRegionCreated && (
                        <div className="lw-trace-view-entity-placement-row">
                          <span className="lw-trace-view-entity-placement-label">Emergent Region</span>
                          <span className="lw-trace-view-entity-placement-value">
                            <span className="lw-trace-view-emergent-badge">
                              + {entity.placement.emergentRegionCreated.label}
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Coordinates */}
                      {entity.coordinates && (
                        <div className="lw-trace-view-entity-placement-row">
                          <span className="lw-trace-view-entity-placement-label">Coordinates</span>
                          <span className="lw-trace-view-entity-placement-value mono">
                            ({entity.coordinates.x.toFixed(1)}, {entity.coordinates.y.toFixed(1)}, {entity.coordinates.z.toFixed(1)})
                          </span>
                        </div>
                      )}

                      {/* Final region */}
                      {entity.regionId && (
                        <div className="lw-trace-view-entity-placement-row">
                          <span className="lw-trace-view-entity-placement-label">Region</span>
                          <span className="lw-trace-view-entity-placement-value">
                            <span className="lw-trace-view-region-badge">{entity.regionId}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags section */}
                  {Object.keys(entity.tags || {}).length > 0 && (
                    <div className="lw-trace-view-entity-tags-section">
                      <div className="lw-trace-view-entity-section-label">Tags</div>
                      <div className="lw-trace-view-entity-tags">
                        {Object.entries(entity.tags).map(([tag, val]) => (
                          <span key={tag} className="lw-trace-view-tag">
                            {tag}{val !== true ? `:${val}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Derived tags from placement */}
                  {entity.derivedTags && Object.keys(entity.derivedTags).length > 0 && (
                    <div className="lw-trace-view-entity-derived-section">
                      <div className="lw-trace-view-entity-section-label">Derived from Placement</div>
                      <div className="lw-trace-view-entity-tags">
                        {Object.entries(entity.derivedTags).map(([tag, val]) => (
                          <span key={tag} className="lw-trace-view-tag derived">
                            {tag}{val !== true ? `:${val}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Relationships Created */}
          {app.relationshipsCreated?.length > 0 && (
            <div className="lw-trace-view-template-section">
              <div className="lw-trace-view-detail-section-header">
                Relationships ({app.relationshipsCreated.length})
              </div>
              {app.relationshipsCreated.slice(0, 5).map((rel, j) => (
                <div key={j} className="lw-trace-view-detail-row">
                  <span className="lw-trace-view-rel-kind">{rel.kind}</span>
                  <span className="lw-trace-view-rel-ids">
                    {rel.srcId?.slice(0, 8)}... → {rel.dstId?.slice(0, 8)}...
                  </span>
                </div>
              ))}
              {app.relationshipsCreated.length > 5 && (
                <div className="lw-trace-view-detail-row lw-trace-view-detail-row-muted">
                  +{app.relationshipsCreated.length - 5} more
                </div>
              )}
            </div>
          )}

          {/* Pressure Changes */}
          {Object.keys(app.pressureChanges || {}).length > 0 && (
            <div className="lw-trace-view-template-section">
              <div className="lw-trace-view-detail-section-header">Pressure Changes</div>
              {Object.entries(app.pressureChanges).map(([pressureId, delta]) => (
                <div key={pressureId} className="lw-trace-view-detail-row">
                  <span className="lw-trace-view-detail-label">{pressureId}</span>
                  <span className={delta >= 0 ? 'positive' : 'negative'}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Simple tooltip for chart hover
 */
function SimpleTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="lw-trace-view-tooltip">
      <div className="lw-trace-view-tooltip-header">Tick {label}</div>
      {payload.filter(p => !p.dataKey?.startsWith('event_')).map((entry, i) => (
        <div key={i} className="lw-trace-view-tooltip-row">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span>{entry.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

export default function SimulationTraceView({
  pressureUpdates = [],
  epochStats = [],
  templateApplications = [],
  onClose,
}) {
  const [selectedTick, setSelectedTick] = useState(null);
  const [lockedTick, setLockedTick] = useState(null);
  const [hiddenPressures, setHiddenPressures] = useState(new Set());
  const [hiddenEntities, setHiddenEntities] = useState(new Set());
  const [activeChart, setActiveChart] = useState('pressure');
  // Template selection state (separate from tick selection)
  const [hoveredTemplateId, setHoveredTemplateId] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  // Transform data
  const { data: pressureData, pressureIds, breakdownsByTick } = useMemo(
    () => transformPressureData(pressureUpdates),
    [pressureUpdates]
  );

  const { data: populationData, entityKinds } = useMemo(
    () => transformPopulationData(pressureUpdates, epochStats),
    [pressureUpdates, epochStats]
  );

  // Transform template data for scatter overlay (depends on pressureData for Y scaling)
  const { scatterData: templateScatterData, templatesByTick, templateById } = useMemo(
    () => transformTemplateScatterData(templateApplications, pressureData),
    [templateApplications, pressureData]
  );

  const eraBoundaries = useMemo(
    () => extractEraBoundaries(pressureUpdates, epochStats),
    [pressureUpdates, epochStats]
  );

  const maxPressureValue = useMemo(() => {
    let max = 0;
    for (const point of pressureData) {
      for (const id of pressureIds) {
        if (point[id] > max) max = point[id];
      }
    }
    return max || 100;
  }, [pressureData, pressureIds]);

  // Handle mouse move on chart to update detail panel (only if not locked)
  const handleChartMouseMove = useCallback((state) => {
    if (lockedTick !== null) return; // Don't update if locked
    if (state?.activeLabel !== undefined) {
      setSelectedTick(state.activeLabel);
    }
  }, [lockedTick]);

  // Handle click to lock/unlock tick selection
  const handleChartClick = useCallback((state) => {
    if (state?.activeLabel !== undefined) {
      if (lockedTick === state.activeLabel) {
        // Clicking same tick unlocks
        setLockedTick(null);
      } else {
        // Lock to clicked tick
        setLockedTick(state.activeLabel);
        setSelectedTick(state.activeLabel);
      }
    }
  }, [lockedTick]);

  // Unlock handler for detail panel button
  const handleUnlock = useCallback(() => {
    setLockedTick(null);
  }, []);

  const handleChartMouseLeave = useCallback(() => {
    // Keep the last selected tick visible
  }, []);

  const togglePressure = useCallback((id) => {
    setHiddenPressures(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleEntity = useCallback((kind) => {
    setHiddenEntities(prev => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  // Handler for template scatter point click
  const handleTemplateClick = useCallback((data) => {
    if (data?.uniqueId) {
      if (selectedTemplateId === data.uniqueId) {
        // Clicking same template deselects
        setSelectedTemplateId(null);
      } else {
        setSelectedTemplateId(data.uniqueId);
      }
    }
  }, [selectedTemplateId]);

  // Handler for template scatter point hover
  const handleTemplateHover = useCallback((data) => {
    if (!selectedTemplateId) {
      setHoveredTemplateId(data?.uniqueId || null);
    }
  }, [selectedTemplateId]);

  // Clear template hover when leaving scatter area
  const handleTemplateLeave = useCallback(() => {
    if (!selectedTemplateId) {
      setHoveredTemplateId(null);
    }
  }, [selectedTemplateId]);

  // Get currently displayed template for detail panel
  const displayedTemplateId = selectedTemplateId || hoveredTemplateId;
  const displayedTemplate = displayedTemplateId ? templateById.get(displayedTemplateId) : null;

  // Clear selected template
  const handleClearTemplate = useCallback(() => {
    setSelectedTemplateId(null);
    setHoveredTemplateId(null);
  }, []);

  const visiblePressures = pressureIds.filter(id => !hiddenPressures.has(id));
  const visibleEntities = entityKinds.filter(kind => !hiddenEntities.has(kind));

  return (
    <div className="lw-trace-view-overlay">
      <div className="lw-trace-view">
        {/* Header */}
        <div className="lw-trace-view-header">
          <div className="lw-trace-view-title">
            Simulation Trace
            <span className="lw-trace-view-subtitle">
              {pressureData.length} ticks • {pressureIds.length} pressures • {entityKinds.length} entity kinds
            </span>
          </div>
          <button className="lw-trace-view-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Main content */}
        <div className="lw-trace-view-content">
          {/* Left: Charts */}
          <div className="lw-trace-view-charts">
            {/* Chart tabs */}
            <div className="lw-trace-view-tabs">
              <button
                className={`lw-trace-view-tab ${activeChart === 'pressure' ? 'active' : ''}`}
                onClick={() => setActiveChart('pressure')}
              >
                Pressures
              </button>
              <button
                className={`lw-trace-view-tab ${activeChart === 'population' ? 'active' : ''}`}
                onClick={() => setActiveChart('population')}
              >
                Population
              </button>
            </div>

            {/* Series toggles */}
            <div className="lw-trace-view-toggles">
              {activeChart === 'pressure' ? (
                pressureIds.map((id, i) => {
                  const name = pressureData[0]?.[`${id}_name`] || id;
                  const isHidden = hiddenPressures.has(id);
                  return (
                    <button
                      key={id}
                      className={`lw-trace-view-toggle ${isHidden ? 'hidden' : ''}`}
                      style={{
                        borderColor: PRESSURE_COLORS[i % PRESSURE_COLORS.length],
                        backgroundColor: isHidden ? 'transparent' : PRESSURE_COLORS[i % PRESSURE_COLORS.length] + '20',
                      }}
                      onClick={() => togglePressure(id)}
                    >
                      {name}
                    </button>
                  );
                })
              ) : (
                entityKinds.map((kind, i) => {
                  const isHidden = hiddenEntities.has(kind);
                  return (
                    <button
                      key={kind}
                      className={`lw-trace-view-toggle ${isHidden ? 'hidden' : ''}`}
                      style={{
                        borderColor: ENTITY_COLORS[i % ENTITY_COLORS.length],
                        backgroundColor: isHidden ? 'transparent' : ENTITY_COLORS[i % ENTITY_COLORS.length] + '20',
                      }}
                      onClick={() => toggleEntity(kind)}
                    >
                      {kind}
                    </button>
                  );
                })
              )}
            </div>

            {/* Chart area */}
            <div className={`lw-trace-view-chart-area ${lockedTick !== null ? 'locked' : ''}`}>
              {activeChart === 'pressure' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={pressureData}
                    margin={{ top: 20, right: 30, left: 40, bottom: 0 }}
                    onMouseMove={handleChartMouseMove}
                    onMouseLeave={handleChartMouseLeave}
                    onClick={handleChartClick}
                    style={{ cursor: 'crosshair' }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />

                    {eraBoundaries.map((era, i) => (
                      <ReferenceArea
                        key={`era-${i}`}
                        x1={era.startTick}
                        x2={era.endTick}
                        fill={ERA_COLORS[i % ERA_COLORS.length]}
                        fillOpacity={1}
                        label={{
                          value: era.era,
                          position: 'insideTopLeft',
                          fill: 'rgba(255,255,255,0.5)',
                          fontSize: 11,
                        }}
                      />
                    ))}

                    {/* Locked tick indicator */}
                    {lockedTick !== null && (
                      <ReferenceLine
                        x={lockedTick}
                        stroke="#22c55e"
                        strokeWidth={2}
                      />
                    )}

                    {/* Hover tick indicator (when not locked) */}
                    {lockedTick === null && selectedTick !== null && (
                      <ReferenceLine
                        x={selectedTick}
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                      />
                    )}

                    <XAxis dataKey="tick" stroke="#93c5fd" fontSize={11} tickLine={false} />
                    <YAxis stroke="#93c5fd" fontSize={11} tickLine={false} />
                    <Tooltip content={<SimpleTooltip />} />

                    {visiblePressures.map((id) => {
                      const colorIndex = pressureIds.indexOf(id);
                      return (
                        <Line
                          key={id}
                          type="monotone"
                          dataKey={id}
                          name={pressureData[0]?.[`${id}_name`] || id}
                          stroke={PRESSURE_COLORS[colorIndex % PRESSURE_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      );
                    })}


                    {/* Template icons - rendered as ReferenceDots for exact positioning */}
                    {templateScatterData.map((point) => (
                      <ReferenceDot
                        key={`${point.uniqueId}-${templateScatterData.length}`}
                        x={point.tick}
                        y={point.y}
                        r={0}
                        isFront={true}
                        shape={(props) => {
                          const { cx, cy } = props;
                          if (cx === undefined || cy === undefined) return null;

                          // Check selection/hover inside shape to get fresh values
                          const isSelected = point.uniqueId === selectedTemplateId;
                          const isHovered = point.uniqueId === hoveredTemplateId;
                          const size = isSelected ? 10 : isHovered ? 9 : 7;
                          const opacity = isSelected ? 1 : isHovered ? 0.9 : 0.65;

                          return (
                            <g
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleTemplateClick(point)}
                              onMouseEnter={() => handleTemplateHover(point)}
                              onMouseLeave={handleTemplateLeave}
                            >
                              <polygon
                                points={`${cx},${cy - size} ${cx - size * 0.866},${cy + size / 2} ${cx + size * 0.866},${cy + size / 2}`}
                                fill={isSelected ? '#22c55e' : isHovered ? '#4ade80' : '#22c55e'}
                                fillOpacity={opacity}
                                stroke={isSelected ? '#fff' : isHovered ? '#4ade80' : 'none'}
                                strokeWidth={isSelected ? 2 : 1}
                              />
                            </g>
                          );
                        }}
                      />
                    ))}

                    <Brush
                      dataKey="tick"
                      height={30}
                      stroke="#f59e0b"
                      fill="#0c1f2e"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : activeChart === 'population' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={populationData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />

                    {eraBoundaries.map((era, i) => (
                      <ReferenceArea
                        key={`era-pop-${i}`}
                        x1={era.startTick}
                        x2={era.endTick}
                        fill={ERA_COLORS[i % ERA_COLORS.length]}
                        fillOpacity={1}
                      />
                    ))}

                    <XAxis dataKey="tick" stroke="#93c5fd" fontSize={11} tickLine={false} />
                    <YAxis stroke="#93c5fd" fontSize={11} tickLine={false} />
                    <Tooltip />

                    {visibleEntities.map((kind) => {
                      const colorIndex = entityKinds.indexOf(kind);
                      return (
                        <Area
                          key={kind}
                          type="monotone"
                          dataKey={kind}
                          name={kind}
                          stackId="1"
                          stroke={ENTITY_COLORS[colorIndex % ENTITY_COLORS.length]}
                          fill={ENTITY_COLORS[colorIndex % ENTITY_COLORS.length]}
                          fillOpacity={0.6}
                          isAnimationActive={false}
                        />
                      );
                    })}

                    <Brush dataKey="tick" height={30} stroke="#f59e0b" fill="#0c1f2e" />
                  </AreaChart>
                </ResponsiveContainer>
) : null}
            </div>
          </div>

          {/* Right: Detail panel - shows template detail when template selected, otherwise pressure breakdown */}
          {displayedTemplate ? (
            <SingleTemplateDetailPanel
              template={displayedTemplate}
              isLocked={!!selectedTemplateId}
              onClear={handleClearTemplate}
            />
          ) : (
            <DetailPanel
              selectedTick={selectedTick}
              lockedTick={lockedTick}
              breakdownsByTick={breakdownsByTick}
              pressureIds={pressureIds}
              pressureData={pressureData}
              onUnlock={handleUnlock}
            />
          )}
        </div>
      </div>
    </div>
  );
}
