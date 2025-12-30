/**
 * EventResolutionStep - Step 4: Select events and relationships to include
 *
 * Shows checkboxes for relationships between assigned entities and relevant events.
 * Features temporal metrics display and filtering for era alignment.
 */

import { useState, useMemo, useEffect } from 'react';
import { useWizard } from '../WizardContext';
import {
  getRelevantRelationships,
  getRelevantEvents,
  type EventSelectionMetrics,
} from '../../../lib/chronicle/selectionWizard';

type EventSortOption = 'recommended' | 'tick' | 'significance' | 'era';

export default function EventResolutionStep() {
  const {
    state,
    toggleEvent,
    toggleRelationship,
    selectAllEvents,
    deselectAllEvents,
    selectAllRelationships,
    deselectAllRelationships,
    computeEventMetricsForSelection,
    temporalContext,
    detectedFocalEra,
    eras,
    setFocalEraOverride,
    autoFillEvents,
  } = useWizard();

  // Sort and filter state
  const [eventSortBy, setEventSortBy] = useState<EventSortOption>('recommended');
  const [focalEraOnly, setFocalEraOnly] = useState(false);
  const [eventMetrics, setEventMetrics] = useState<Map<string, EventSelectionMetrics>>(new Map());

  // Compute event metrics when data changes
  useEffect(() => {
    const metrics = computeEventMetricsForSelection();
    setEventMetrics(metrics);
  }, [computeEventMetricsForSelection]);

  // Get relevant relationships (between assigned entities)
  const relevantRelationships = useMemo(() => {
    return getRelevantRelationships(state.roleAssignments, state.candidateRelationships);
  }, [state.roleAssignments, state.candidateRelationships]);

  // Get relevant events (involving assigned entities) with filtering and sorting
  const relevantEvents = useMemo(() => {
    let events = getRelevantEvents(
      state.roleAssignments,
      state.candidateEvents,
      state.narrativeStyle?.eventRules
    );

    // Apply focal era filter
    if (focalEraOnly && temporalContext) {
      events = events.filter(e => {
        const metrics = eventMetrics.get(e.id);
        return metrics?.inFocalEra;
      });
    }

    // Sort events
    events = [...events].sort((a, b) => {
      const metricsA = eventMetrics.get(a.id);
      const metricsB = eventMetrics.get(b.id);

      switch (eventSortBy) {
        case 'tick':
          return (metricsA?.tick ?? 0) - (metricsB?.tick ?? 0);
        case 'significance':
          return (metricsB?.significance ?? 0) - (metricsA?.significance ?? 0);
        case 'era':
          // Sort by era, then by tick within era
          if (metricsA?.eraId !== metricsB?.eraId) {
            // Focal era first
            if (metricsA?.inFocalEra && !metricsB?.inFocalEra) return -1;
            if (!metricsA?.inFocalEra && metricsB?.inFocalEra) return 1;
            return (metricsA?.eraId ?? '').localeCompare(metricsB?.eraId ?? '');
          }
          return (metricsA?.tick ?? 0) - (metricsB?.tick ?? 0);
        case 'recommended':
        default:
          // Entry point involvement first, then significance
          if (metricsA?.involvesEntryPoint !== metricsB?.involvesEntryPoint) {
            return metricsA?.involvesEntryPoint ? -1 : 1;
          }
          if (metricsA?.inFocalEra !== metricsB?.inFocalEra) {
            return metricsA?.inFocalEra ? -1 : 1;
          }
          return (metricsB?.significance ?? 0) - (metricsA?.significance ?? 0);
      }
    });

    return events;
  }, [state.roleAssignments, state.candidateEvents, state.narrativeStyle, focalEraOnly, temporalContext, eventSortBy, eventMetrics]);

  // Create relationship ID
  const getRelationshipId = (r: { src: string; dst: string; kind: string }) => `${r.src}:${r.dst}:${r.kind}`;

  // Get IDs for the relevant items (what's shown in the UI)
  const relevantRelationshipIds = useMemo(() =>
    relevantRelationships.map(r => getRelationshipId(r)),
    [relevantRelationships]
  );

  const relevantEventIds = useMemo(() =>
    relevantEvents.map(e => e.id),
    [relevantEvents]
  );

  // Auto-select all on first mount if accepting defaults
  useEffect(() => {
    if (state.acceptDefaults && state.selectedRelationshipIds.size === 0 && state.selectedEventIds.size === 0) {
      selectAllRelationships(relevantRelationshipIds);
      selectAllEvents(relevantEventIds);
    }
  }, [state.acceptDefaults, state.selectedRelationshipIds.size, state.selectedEventIds.size, selectAllRelationships, selectAllEvents, relevantRelationshipIds, relevantEventIds]);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <h4 style={{ margin: '0 0 8px 0' }}>Select Events & Relationships</h4>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
              Choose which events and relationships to include in your chronicle. These provide context for the narrative.
            </p>
          </div>
          <button
            onClick={() => autoFillEvents(!focalEraOnly)}
            className="illuminator-btn"
            style={{ fontSize: '12px' }}
          >
            Auto-fill Events
          </button>
        </div>

        {/* Temporal Context Summary */}
        {temporalContext && (
          <div style={{
            padding: '10px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '6px',
            fontSize: '12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
          }}>
            <span style={{ fontWeight: 500 }}>
              Temporal Focus:
            </span>
            <select
              value={state.focalEraOverride || temporalContext.focalEra.id}
              onChange={(e) => {
                const selectedId = e.target.value;
                // If selecting the detected era, clear override
                if (detectedFocalEra && selectedId === detectedFocalEra.id) {
                  setFocalEraOverride(null);
                } else {
                  setFocalEraOverride(selectedId);
                }
              }}
              className="illuminator-select"
              style={{ padding: '2px 8px', fontSize: '11px', minWidth: '140px' }}
            >
              {eras.map(era => (
                <option key={era.id} value={era.id}>
                  {era.name}{detectedFocalEra?.id === era.id ? ' (detected)' : ''}
                </option>
              ))}
            </select>
            {state.focalEraOverride && (
              <button
                onClick={() => setFocalEraOverride(null)}
                className="illuminator-btn"
                style={{ padding: '2px 6px', fontSize: '10px' }}
                title="Reset to detected era"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Relationships */}
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Relationships ({state.selectedRelationshipIds.size}/{relevantRelationships.length})
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => selectAllRelationships(relevantRelationshipIds)}
                className="illuminator-btn"
                style={{ padding: '2px 8px', fontSize: '10px' }}
              >
                All
              </button>
              <button
                onClick={deselectAllRelationships}
                className="illuminator-btn"
                style={{ padding: '2px 8px', fontSize: '10px' }}
              >
                None
              </button>
            </div>
          </div>

          <div style={{
            maxHeight: '350px',
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
          }}>
            {relevantRelationships.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                No relationships between assigned entities.
              </div>
            ) : (
              relevantRelationships.map(rel => {
                const relId = getRelationshipId(rel);
                const isSelected = state.selectedRelationshipIds.has(relId);

                return (
                  <div
                    key={relId}
                    onClick={() => toggleRelationship(relId)}
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ marginTop: '2px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px' }}>
                        <span style={{ fontWeight: 500 }}>{rel.sourceName}</span>
                        <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>→</span>
                        <span style={{ fontWeight: 500 }}>{rel.targetName}</span>
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        marginTop: '4px',
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                      }}>
                        <span style={{
                          padding: '1px 4px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '3px',
                        }}>
                          {rel.kind}
                        </span>
                        {rel.strength !== undefined && (
                          <span>strength: {rel.strength.toFixed(2)}</span>
                        )}
                      </div>
                      {rel.backstory && (
                        <div style={{
                          marginTop: '6px',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          fontStyle: 'italic',
                        }}>
                          {rel.backstory.length > 100
                            ? rel.backstory.slice(0, 100) + '...'
                            : rel.backstory}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Events */}
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Events ({state.selectedEventIds.size}/{relevantEvents.length})
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => selectAllEvents(relevantEventIds)}
                className="illuminator-btn"
                style={{ padding: '2px 8px', fontSize: '10px' }}
              >
                All
              </button>
              <button
                onClick={deselectAllEvents}
                className="illuminator-btn"
                style={{ padding: '2px 8px', fontSize: '10px' }}
              >
                None
              </button>
            </div>
          </div>
          {/* Event sort and filter controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px',
            fontSize: '10px',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
              Sort:
              <select
                value={eventSortBy}
                onChange={(e) => setEventSortBy(e.target.value as EventSortOption)}
                className="illuminator-select"
                style={{ padding: '2px 6px', fontSize: '10px' }}
              >
                <option value="recommended">Recommended</option>
                <option value="tick">Timeline</option>
                <option value="significance">Significance</option>
                <option value="era">By Era</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={focalEraOnly}
                onChange={(e) => setFocalEraOnly(e.target.checked)}
                style={{ margin: 0 }}
              />
              Focal era only
            </label>
          </div>

          <div style={{
            maxHeight: '350px',
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
          }}>
            {relevantEvents.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                No events involving assigned entities.
              </div>
            ) : (
              relevantEvents.map(event => {
                const isSelected = state.selectedEventIds.has(event.id);
                const metrics = eventMetrics.get(event.id);

                return (
                  <div
                    key={event.id}
                    onClick={() => toggleEvent(event.id)}
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ marginTop: '2px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>
                          {event.headline}
                        </span>
                        {/* Temporal badges */}
                        {metrics?.involvesEntryPoint && (
                          <span
                            title="Involves entry point entity"
                            style={{
                              padding: '1px 4px',
                              background: 'var(--accent-color)',
                              color: 'white',
                              borderRadius: '3px',
                              fontSize: '8px',
                              fontWeight: 600,
                            }}
                          >
                            Entry
                          </span>
                        )}
                        {metrics?.inFocalEra && (
                          <span
                            title="In focal era"
                            style={{
                              padding: '1px 4px',
                              background: 'rgba(34, 197, 94, 0.2)',
                              color: 'var(--success)',
                              borderRadius: '3px',
                              fontSize: '8px',
                            }}
                          >
                            ✓ Era
                          </span>
                        )}
                        {metrics && !metrics.inFocalEra && (
                          <span
                            title={`In ${metrics.eraName} (not focal era)`}
                            style={{
                              padding: '1px 4px',
                              background: 'rgba(245, 158, 11, 0.2)',
                              color: 'var(--warning)',
                              borderRadius: '3px',
                              fontSize: '8px',
                            }}
                          >
                            ⚠ {metrics.eraName}
                          </span>
                        )}
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        marginTop: '4px',
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                      }}>
                        <span style={{
                          padding: '1px 4px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '3px',
                        }}>
                          {event.eventKind}
                        </span>
                        <span>
                          {(event.significance * 100).toFixed(0)}% sig
                        </span>
                        <span>tick {event.tick}</span>
                        {metrics && metrics.tickDistance > 0 && (
                          <span title="Distance from entry point creation">
                            Δ{metrics.tickDistance}
                          </span>
                        )}
                      </div>
                      {event.description && (
                        <div style={{
                          marginTop: '6px',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                        }}>
                          {event.description.length > 100
                            ? event.description.slice(0, 100) + '...'
                            : event.description}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: 'var(--bg-tertiary)',
        borderRadius: '8px',
        fontSize: '12px',
        color: 'var(--text-muted)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <span>
          Selected: {state.selectedRelationshipIds.size} relationships, {state.selectedEventIds.size} events
        </span>
        {temporalContext && state.selectedEventIds.size > 0 && (
          <span>
            Tick range: {temporalContext.chronicleTickRange[0]}–{temporalContext.chronicleTickRange[1]}
            {temporalContext.isMultiEra && (
              <span style={{ marginLeft: '8px', color: 'var(--warning)' }}>
                (spans {temporalContext.touchedEraIds.length} eras)
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
