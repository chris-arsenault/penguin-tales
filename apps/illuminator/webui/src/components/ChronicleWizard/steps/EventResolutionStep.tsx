/**
 * EventResolutionStep - Step 4: Select events and relationships to include
 *
 * Shows checkboxes for relationships between assigned entities and relevant events.
 */

import { useMemo, useEffect } from 'react';
import { useWizard } from '../WizardContext';
import { getRelevantRelationships, getRelevantEvents } from '../../../lib/chronicle/selectionWizard';

export default function EventResolutionStep() {
  const {
    state,
    toggleEvent,
    toggleRelationship,
    selectAllEvents,
    deselectAllEvents,
    selectAllRelationships,
    deselectAllRelationships,
  } = useWizard();

  // Get relevant relationships (between assigned entities)
  const relevantRelationships = useMemo(() => {
    return getRelevantRelationships(state.roleAssignments, state.candidateRelationships);
  }, [state.roleAssignments, state.candidateRelationships]);

  // Get relevant events (involving assigned entities)
  const relevantEvents = useMemo(() => {
    return getRelevantEvents(
      state.roleAssignments,
      state.candidateEvents,
      state.narrativeStyle?.eventRules
    );
  }, [state.roleAssignments, state.candidateEvents, state.narrativeStyle]);

  // Auto-select all on first mount if accepting defaults
  useEffect(() => {
    if (state.acceptDefaults && state.selectedRelationshipIds.size === 0 && state.selectedEventIds.size === 0) {
      selectAllRelationships();
      selectAllEvents();
    }
  }, [state.acceptDefaults, state.selectedRelationshipIds.size, state.selectedEventIds.size, selectAllRelationships, selectAllEvents]);

  // Create relationship ID
  const getRelationshipId = (r: { src: string; dst: string; kind: string }) => `${r.src}:${r.dst}:${r.kind}`;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Select Events & Relationships</h4>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
          Choose which events and relationships to include in your chronicle. These provide context for the narrative.
        </p>
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
                onClick={selectAllRelationships}
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
                onClick={selectAllEvents}
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
                      <div style={{ fontSize: '12px', fontWeight: 500 }}>
                        {event.headline}
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
                          significance: {(event.significance * 100).toFixed(0)}%
                        </span>
                        <span>tick: {event.tick}</span>
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
      }}>
        Selected: {state.selectedRelationshipIds.size} relationships, {state.selectedEventIds.size} events
      </div>
    </div>
  );
}
