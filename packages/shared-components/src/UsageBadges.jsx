/**
 * UsageBadges - Reusable component for displaying usage indicators
 *
 * Shows badges indicating where an item is used across different tools.
 * Designed for extensibility - can show multiple badge types.
 */

import React from 'react';

// Badge configurations for different usage types
const BADGE_CONFIG = {
  nameforge: {
    label: 'Name Forge',
    icon: '\u270E',
    color: '#fbbf24',
    bgColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
    tooltip: 'Used in Name Forge profiles',
  },
  seed: {
    label: 'Seed',
    icon: '\u25C9',
    color: '#60a5fa',
    bgColor: 'rgba(96, 165, 250, 0.15)',
    borderColor: 'rgba(96, 165, 250, 0.4)',
    tooltip: 'Used in seed entities',
  },
  coherence: {
    label: 'Coherence',
    icon: '\u2699',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    tooltip: 'Used in Coherence Engine',
  },
  loreweave: {
    label: 'Lore Weave',
    icon: '\u25C8',
    color: '#a78bfa',
    bgColor: 'rgba(167, 139, 250, 0.15)',
    borderColor: 'rgba(167, 139, 250, 0.4)',
    tooltip: 'Used in Lore Weave',
  },
};

const styles = {
  container: {
    display: 'inline-flex',
    gap: '4px',
    flexWrap: 'wrap',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    cursor: 'default',
    transition: 'opacity 0.15s',
  },
  badgeIcon: {
    fontSize: '10px',
  },
  badgeCount: {
    fontWeight: 600,
    marginLeft: '2px',
  },
};

/**
 * UsageBadges component
 *
 * @param {Object} props
 * @param {Object} props.usage - Object with usage counts by type
 *   e.g., { nameforge: 3, coherence: 1 }
 * @param {boolean} props.compact - If true, show only icons without labels
 * @param {boolean} props.showZero - If true, show badges even when count is 0
 */
export default function UsageBadges({ usage = {}, compact = false, showZero = false }) {
  const badges = Object.entries(usage)
    .filter(([type, count]) => showZero || count > 0)
    .filter(([type]) => BADGE_CONFIG[type]);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div style={styles.container}>
      {badges.map(([type, count]) => {
        const config = BADGE_CONFIG[type];
        return (
          <span
            key={type}
            style={{
              ...styles.badge,
              backgroundColor: config.bgColor,
              border: `1px solid ${config.borderColor}`,
              color: config.color,
            }}
            title={`${config.tooltip}${count > 1 ? ` (${count} uses)` : ''}`}
          >
            <span style={styles.badgeIcon}>{config.icon}</span>
            {!compact && <span>{config.label}</span>}
            {count > 1 && <span style={styles.badgeCount}>\u00D7{count}</span>}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Get a summary of usage for an entity kind
 * @param {Object} schemaUsage - Output from computeSchemaUsage
 * @param {string} kind - Entity kind ID
 * @returns {Object} - { coherence: number } for UsageBadges component
 */
export function getEntityKindUsageSummary(schemaUsage, kind) {
  const usage = schemaUsage?.entityKinds?.[kind];
  if (!usage) return { coherence: 0 };

  const total =
    (usage.generators?.length || 0) +
    (usage.systems?.length || 0) +
    (usage.actions?.length || 0) +
    (usage.pressures?.length || 0);

  return { coherence: total };
}

/**
 * Get a summary of usage for a relationship kind
 * @param {Object} schemaUsage - Output from computeSchemaUsage
 * @param {string} kind - Relationship kind ID
 * @returns {Object} - { coherence: number } for UsageBadges component
 */
export function getRelationshipKindUsageSummary(schemaUsage, kind) {
  const usage = schemaUsage?.relationshipKinds?.[kind];
  if (!usage) return { coherence: 0 };

  const total =
    (usage.generators?.length || 0) +
    (usage.systems?.length || 0) +
    (usage.actions?.length || 0);

  return { coherence: total };
}
