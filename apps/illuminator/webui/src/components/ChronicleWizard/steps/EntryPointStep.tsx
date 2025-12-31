/**
 * EntryPointStep - Step 2: Graph anchor entity selection
 *
 * Features the Story Potential Radar visualization:
 * - Filter chips for quick kind filtering
 * - Story score bar showing narrative potential
 * - Radar chart showing 5-axis potential breakdown
 * - Mini constellation showing 1-hop network preview
 */

import { useState, useMemo } from 'react';
import type { EntityContext, RelationshipContext, NarrativeEventContext } from '../../../lib/chronicleTypes';
import { useWizard } from '../WizardContext';
import {
  computeAllStoryPotentials,
  getConnectedEntities,
  getUniqueKinds,
  type EntityWithPotential,
} from '../../../lib/chronicle/storyPotential';
import {
  FilterChips,
  StoryPotentialRadarWithScore,
  StoryScoreBar,
  MiniConstellation,
} from '../visualizations';

interface EntryPointStepProps {
  entities: EntityContext[];
  relationships: RelationshipContext[];
  events: NarrativeEventContext[];
}

type SortOption = 'story-score' | 'connections' | 'name';

export default function EntryPointStep({
  entities,
  relationships,
  events,
}: EntryPointStepProps) {
  const { state, selectEntryPoint, clearEntryPoint, setIncludeErasInNeighborhood } = useWizard();
  const [selectedKinds, setSelectedKinds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('story-score');
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);

  // Compute story potentials for all entities
  const entityPotentials = useMemo(() => {
    return computeAllStoryPotentials(entities, relationships, events);
  }, [entities, relationships, events]);

  // Get available kinds for filter chips
  const availableKinds = useMemo(() => {
    return getUniqueKinds(entities);
  }, [entities]);

  // Filter and sort entities
  const filteredEntities = useMemo(() => {
    let result = [...entityPotentials.values()];

    // Apply kind filter
    if (selectedKinds.size > 0) {
      result = result.filter(e => selectedKinds.has(e.kind));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'connections':
          return b.connectionCount - a.connectionCount;
        case 'story-score':
        default:
          return b.potential.overallScore - a.potential.overallScore;
      }
    });

    return result;
  }, [entityPotentials, selectedKinds, sortBy]);

  // Get entity for detail panel (hover takes priority over selection)
  const detailEntity = useMemo(() => {
    const id = hoveredEntityId || state.entryPointId;
    if (!id) return null;
    return entityPotentials.get(id) || null;
  }, [hoveredEntityId, state.entryPointId, entityPotentials]);

  // Get connections for constellation
  const detailConnections = useMemo(() => {
    if (!detailEntity) return [];
    return getConnectedEntities(detailEntity.id, entities, relationships);
  }, [detailEntity, entities, relationships]);

  const handleSelect = (entity: EntityWithPotential) => {
    // Click again to deselect
    if (state.entryPointId === entity.id) {
      clearEntryPoint();
      return;
    }
    // Convert back to EntityContext for the wizard
    const { potential, connectionCount, eventCount, connectedKinds, eraIds, ...baseEntity } = entity;
    selectEntryPoint(baseEntity as EntityContext, entities, relationships, events);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Select Entry Point</h4>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
          Choose the central entity for your chronicle. Higher story scores indicate richer narrative potential.
        </p>
      </div>

      {/* Two column layout - fixed height to prevent jumping */}
      <div style={{ display: 'flex', gap: '20px', height: '480px' }}>
        {/* Left: Entity list */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Filter chips */}
          <div style={{ marginBottom: '12px' }}>
            <FilterChips
              options={availableKinds}
              selected={selectedKinds}
              onSelectionChange={setSelectedKinds}
              label="Filter by Kind"
            />
          </div>

          {/* Sort control and options */}
          <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="illuminator-select"
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              <option value="story-score">Sort by Story Score</option>
              <option value="connections">Sort by Connections</option>
              <option value="name">Sort by Name</option>
            </select>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={state.includeErasInNeighborhood}
                onChange={(e) => setIncludeErasInNeighborhood(e.target.checked)}
                style={{ margin: 0 }}
              />
              Include eras in neighborhood
            </label>
          </div>

          {/* Entity list - fills remaining height */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            minHeight: 0,
          }}>
            {filteredEntities.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No entities match the selected filters.
              </div>
            ) : (
              filteredEntities.map(entity => {
                const isSelected = state.entryPointId === entity.id;
                const isHovered = hoveredEntityId === entity.id;

                return (
                  <div
                    key={entity.id}
                    onClick={() => handleSelect(entity)}
                    onMouseEnter={() => setHoveredEntityId(entity.id)}
                    onMouseLeave={() => setHoveredEntityId(null)}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      background: isSelected
                        ? 'var(--accent-color)'
                        : isHovered
                        ? 'var(--bg-tertiary)'
                        : 'transparent',
                      color: isSelected ? 'white' : 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {/* Selection indicator */}
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: isSelected ? '2px solid white' : '2px solid var(--border-color)',
                      background: isSelected ? 'white' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {isSelected && (
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: 'var(--accent-color)',
                        }} />
                      )}
                    </div>

                    {/* Entity info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        <span style={{ fontWeight: 500, fontSize: '13px' }}>
                          {entity.name}
                        </span>
                        <span style={{
                          padding: '1px 6px',
                          background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                          borderRadius: '4px',
                          fontSize: '9px',
                          color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)',
                        }}>
                          {entity.kind}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                        marginTop: '2px',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                      }}>
                        <span>{entity.connectionCount} links</span>
                        <span>·</span>
                        <span>{entity.eventCount} events</span>
                        {entity.subtype && (
                          <>
                            <span>·</span>
                            <span>{entity.subtype}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Story score bar */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '2px',
                    }}>
                      <StoryScoreBar
                        score={entity.potential.overallScore}
                        width={50}
                        height={6}
                      />
                      <span style={{
                        fontSize: '9px',
                        color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                      }}>
                        {(entity.potential.overallScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Detail panel - fixed height, scrollable */}
        <div style={{
          width: '220px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          overflowY: 'auto',
          minHeight: 0,
        }}>
          {detailEntity ? (
            <>
              {/* Radar chart with score below */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
              }}>
                <StoryPotentialRadarWithScore
                  potential={detailEntity.potential}
                  size={160}
                />
              </div>

              {/* Mini constellation */}
              <div>
                <div style={{
                  fontSize: '9px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  marginBottom: '4px',
                  textAlign: 'center',
                }}>
                  1-Hop Network
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                }}>
                  <MiniConstellation
                    centerName={detailEntity.name}
                    connections={detailConnections}
                    size={150}
                  />
                </div>
                {/* Inline stats */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '16px',
                  marginTop: '4px',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                }}>
                  <span><strong>{detailEntity.connectedKinds.length}</strong> kinds</span>
                  <span><strong>{detailEntity.eraIds.length}</strong> eras</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '8px',
              border: '1px dashed var(--border-color)',
            }}>
              <div style={{ marginBottom: '8px', fontSize: '32px', opacity: 0.4 }}>
                ◎
              </div>
              <div>Hover or select an entity</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>to see its story potential</div>
            </div>
          )}
        </div>
      </div>

      {/* Selected entry point summary */}
      {state.entryPoint && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'var(--bg-tertiary)',
          borderRadius: '8px',
          border: '1px solid var(--accent-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontWeight: 500 }}>{state.entryPoint.name}</span>
            {state.entryPoint.summary && (
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                {state.entryPoint.summary}
              </p>
            )}
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
            <div style={{ fontWeight: 500, color: 'var(--accent-color)' }}>
              {state.candidates.length} candidates
            </div>
            <div>in 2-hop neighborhood</div>
          </div>
        </div>
      )}
    </div>
  );
}
