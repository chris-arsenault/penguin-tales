/**
 * EntityTimeline - Expandable timeline of narrative events for an entity
 *
 * Displays events where the entity is a participant, with expand/collapse
 * to show entity-specific effects from participantEffects.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { NarrativeEvent, EntityEffect } from '@canonry/world-schema';
import type { HardState } from '../types/world.ts';

const colors = {
  bgPrimary: '#0a1929',
  bgSecondary: '#1e3a5f',
  bgTertiary: '#2d4a6f',
  border: 'rgba(59, 130, 246, 0.3)',
  textPrimary: '#ffffff',
  textSecondary: '#93c5fd',
  textMuted: '#60a5fa',
  accent: '#10b981',
  accentLight: '#34d399',
  // Effect type colors
  effectCreated: '#34d399',      // green
  effectEnded: '#f87171',        // red
  effectRelationship: '#60a5fa', // blue
  effectTag: '#a78bfa',          // purple
  effectField: '#fbbf24',        // yellow
};

const styles = {
  container: {
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },
  headerRow: {
    backgroundColor: colors.bgSecondary,
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left' as const,
    fontWeight: 600,
    color: colors.textPrimary,
    borderBottom: `1px solid ${colors.border}`,
  },
  thTick: {
    width: '60px',
  },
  thEra: {
    width: '120px',
  },
  thExpand: {
    width: '40px',
    textAlign: 'center' as const,
  },
  row: {
    borderBottom: `1px solid ${colors.border}`,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  rowHover: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  rowExpanded: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  td: {
    padding: '10px 12px',
    color: colors.textSecondary,
    verticalAlign: 'top' as const,
  },
  tdTick: {
    fontFamily: 'monospace',
    color: colors.textMuted,
  },
  tdEra: {
    color: colors.textMuted,
  },
  tdEvent: {
    lineHeight: 1.5,
  },
  tdExpand: {
    textAlign: 'center' as const,
    color: colors.textMuted,
    fontSize: '12px',
  },
  expandIcon: {
    display: 'inline-block',
    transition: 'transform 0.2s',
    userSelect: 'none' as const,
  },
  expandIconOpen: {
    transform: 'rotate(90deg)',
  },
  effectsRow: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  effectsCell: {
    padding: '8px 12px 12px 48px',
    borderBottom: `1px solid ${colors.border}`,
  },
  effectsList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  effectItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '4px 0',
    fontSize: '12px',
    lineHeight: 1.4,
  },
  effectIcon: {
    flexShrink: 0,
    width: '16px',
    textAlign: 'center' as const,
  },
  effectDescription: {
    color: colors.textSecondary,
  },
  entityLink: {
    color: colors.accent,
    cursor: 'pointer',
    borderBottom: `1px dotted ${colors.accent}`,
    textDecoration: 'none',
  },
  emptyState: {
    padding: '24px',
    textAlign: 'center' as const,
    color: colors.textMuted,
    fontStyle: 'italic' as const,
  },
  noEffects: {
    color: colors.textMuted,
    fontStyle: 'italic' as const,
    fontSize: '12px',
  },
};

/**
 * Get icon and color for an effect type
 */
function getEffectStyle(type: EntityEffect['type']): { icon: string; color: string } {
  switch (type) {
    case 'created':
      return { icon: '+', color: colors.effectCreated };
    case 'ended':
      return { icon: '×', color: colors.effectEnded };
    case 'relationship_formed':
      return { icon: '↔', color: colors.effectRelationship };
    case 'relationship_ended':
      return { icon: '↮', color: colors.effectEnded };
    case 'tag_gained':
      return { icon: '●', color: colors.effectTag };
    case 'tag_lost':
      return { icon: '○', color: colors.effectEnded };
    case 'field_changed':
      return { icon: '△', color: colors.effectField };
    default:
      return { icon: '•', color: colors.textMuted };
  }
}

/**
 * Process effect description to add wiki links for entity names
 */
function linkifyDescription(
  description: string,
  entityIndex: Map<string, HardState>,
  onNavigate: (entityId: string) => void
): React.ReactNode {
  // Find entity names in the description and wrap them in links
  // This is a simple approach - find names that exist in entityIndex
  const entityNames = Array.from(entityIndex.values())
    .map(e => ({ name: e.name, id: e.id }))
    .sort((a, b) => b.name.length - a.name.length); // Longer names first

  let result: React.ReactNode[] = [description];

  for (const { name, id } of entityNames) {
    const newResult: React.ReactNode[] = [];
    for (const part of result) {
      if (typeof part !== 'string') {
        newResult.push(part);
        continue;
      }

      const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi');
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      const segments: React.ReactNode[] = [];
      while ((match = regex.exec(part)) !== null) {
        if (match.index > lastIndex) {
          segments.push(part.slice(lastIndex, match.index));
        }
        segments.push(
          <span
            key={`${id}-${match.index}`}
            style={styles.entityLink}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(id);
            }}
          >
            {match[0]}
          </span>
        );
        lastIndex = regex.lastIndex;
      }

      if (segments.length > 0) {
        if (lastIndex < part.length) {
          segments.push(part.slice(lastIndex));
        }
        newResult.push(...segments);
      } else {
        newResult.push(part);
      }
    }
    result = newResult;
  }

  return <>{result}</>;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface EntityTimelineProps {
  events: NarrativeEvent[];
  entityId: string;
  entityIndex: Map<string, HardState>;
  onNavigate: (entityId: string) => void;
}

export default function EntityTimeline({
  events,
  entityId,
  entityIndex,
  onNavigate,
}: EntityTimelineProps) {
  // Multi-expand state: set of expanded event IDs
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  /**
   * Check if an event is "prominence-only" for this entity.
   * An event is prominence-only if ALL of its effects for this entity
   * are field_changed effects on the 'prominence' field.
   */
  const isProminenceOnlyEvent = useCallback((event: NarrativeEvent): boolean => {
    const participant = event.participantEffects?.find(p => p.entity.id === entityId);
    if (!participant || participant.effects.length === 0) return false;

    // Check if ALL effects are prominence field changes
    return participant.effects.every(
      effect => effect.type === 'field_changed' && effect.field === 'prominence'
    );
  }, [entityId]);

  // Filter and process events for this entity
  // Exclude prominence-only events (those will be shown in ProminenceTimeline)
  const relevantEvents = useMemo(() => {
    return events
      .filter(event => {
        // Check if entity appears in participantEffects
        if (!event.participantEffects?.some(p => p.entity.id === entityId)) {
          return false;
        }
        // Exclude prominence-only events
        if (isProminenceOnlyEvent(event)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.tick - b.tick); // Chronological order
  }, [events, entityId, isProminenceOnlyEvent]);

  // Get participant effects for the current entity
  const getEntityEffects = useCallback((event: NarrativeEvent): EntityEffect[] => {
    const participant = event.participantEffects?.find(p => p.entity.id === entityId);
    return participant?.effects ?? [];
  }, [entityId]);

  // Toggle expand state for an event
  const toggleExpand = useCallback((eventId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  // Get era name from entity index
  const getEraName = useCallback((eraId: string): string => {
    const era = entityIndex.get(eraId);
    return era?.name ?? eraId;
  }, [entityIndex]);

  // Render description with wiki links
  const renderDescription = useCallback((event: NarrativeEvent): React.ReactNode => {
    const description = event.description || '';
    return linkifyDescription(description, entityIndex, onNavigate);
  }, [entityIndex, onNavigate]);

  if (relevantEvents.length === 0) {
    return (
      <div style={styles.emptyState}>
        No timeline events recorded for this entity.
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        <thead>
          <tr style={styles.headerRow}>
            <th style={{ ...styles.th, ...styles.thTick }}>Tick</th>
            <th style={{ ...styles.th, ...styles.thEra }}>Era</th>
            <th style={styles.th}>Event</th>
            <th style={{ ...styles.th, ...styles.thExpand }}></th>
          </tr>
        </thead>
        <tbody>
          {relevantEvents.map(event => {
            const isExpanded = expandedIds.has(event.id);
            const effects = getEntityEffects(event);
            const canExpand = effects.length > 0;

            return (
              <React.Fragment key={event.id}>
                {/* Main event row */}
                <tr
                  style={{
                    ...styles.row,
                    ...(isExpanded ? styles.rowExpanded : {}),
                  }}
                  onClick={() => canExpand && toggleExpand(event.id)}
                  onMouseEnter={(e) => {
                    if (canExpand) {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        isExpanded ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      isExpanded ? 'rgba(16, 185, 129, 0.08)' : '';
                  }}
                >
                  <td style={{ ...styles.td, ...styles.tdTick }}>{event.tick}</td>
                  <td style={{ ...styles.td, ...styles.tdEra }}>{getEraName(event.era)}</td>
                  <td style={{ ...styles.td, ...styles.tdEvent }}>
                    {renderDescription(event)}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdExpand }}>
                    {canExpand && (
                      <span
                        style={{
                          ...styles.expandIcon,
                          ...(isExpanded ? styles.expandIconOpen : {}),
                        }}
                      >
                        ▶
                      </span>
                    )}
                  </td>
                </tr>

                {/* Expanded effects row */}
                {isExpanded && (
                  <tr style={styles.effectsRow}>
                    <td colSpan={4} style={styles.effectsCell}>
                      {effects.length > 0 ? (
                        <ul style={styles.effectsList}>
                          {effects.map((effect, idx) => {
                            const { icon, color } = getEffectStyle(effect.type);
                            return (
                              <li key={idx} style={styles.effectItem}>
                                <span style={{ ...styles.effectIcon, color }}>
                                  {icon}
                                </span>
                                <span style={styles.effectDescription}>
                                  {linkifyDescription(effect.description, entityIndex, onNavigate)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <span style={styles.noEffects}>No specific effects recorded</span>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
