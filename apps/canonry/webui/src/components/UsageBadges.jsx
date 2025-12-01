/**
 * UsageBadges - Reusable component for displaying usage indicators
 *
 * Shows badges indicating where an item is used across different tools.
 * Designed for extensibility - can show multiple badge types.
 */

import React from 'react';
import { colors, typography, spacing, radius } from '../theme';

// Badge configurations for different usage types
const BADGE_CONFIG = {
  nameforge: {
    label: 'Name Forge',
    icon: '✎',
    color: colors.accentNameForge,
    bgColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
    tooltip: 'Used in Name Forge profiles',
  },
  seed: {
    label: 'Seed',
    icon: '◉',
    color: colors.accentCosmographer,
    bgColor: 'rgba(96, 165, 250, 0.15)',
    borderColor: 'rgba(96, 165, 250, 0.4)',
    tooltip: 'Used in seed entities',
  },
  coherence: {
    label: 'Coherence',
    icon: '⚙',
    color: colors.accentCoherence,
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    tooltip: 'Used in Coherence Engine',
  },
  loreweave: {
    label: 'Lore Weave',
    icon: '◈',
    color: colors.accentSimulation,
    bgColor: 'rgba(167, 139, 250, 0.15)',
    borderColor: 'rgba(167, 139, 250, 0.4)',
    tooltip: 'Used in Lore Weave',
  },
};

const styles = {
  container: {
    display: 'inline-flex',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: `2px ${spacing.sm}`,
    borderRadius: radius.sm,
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    cursor: 'default',
    transition: 'opacity 0.15s',
  },
  badgeIcon: {
    fontSize: '10px',
  },
  badgeCount: {
    fontWeight: typography.weightSemibold,
    marginLeft: '2px',
  },
};

/**
 * UsageBadges component
 *
 * @param {Object} props
 * @param {Object} props.usage - Object with usage counts by type
 *   e.g., { nameforge: 3, cosmographer: 1 }
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
            {count > 1 && <span style={styles.badgeCount}>×{count}</span>}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Utility function to compute tag usage across tools
 *
 * @param {Array} cultures - Array of culture objects with naming.profiles
 * @param {Array} seedEntities - Array of seed entities with tags
 * @returns {Object} - Map of tag -> { nameforge: count, seed: count }
 */
export function computeTagUsage(cultures, seedEntities) {
  const usage = {};

  // Count tags used in Name Forge profiles
  (cultures || []).forEach(culture => {
    const profiles = culture.naming?.profiles || [];
    profiles.forEach(profile => {
      const groups = profile.strategyGroups || [];
      groups.forEach(group => {
        const tags = group.conditions?.tags || [];
        tags.forEach(tag => {
          if (!usage[tag]) {
            usage[tag] = {};
          }
          usage[tag].nameforge = (usage[tag].nameforge || 0) + 1;
        });
      });
    });
  });

  // Count tags used in seed entities (tags stored as { tag: true } object)
  (seedEntities || []).forEach(entity => {
    const tags = entity.tags || {};
    Object.keys(tags).forEach(tag => {
      if (!usage[tag]) {
        usage[tag] = {};
      }
      usage[tag].seed = (usage[tag].seed || 0) + 1;
    });
  });

  return usage;
}

// Backwards compatibility alias
export const computeTagUsageFromProfiles = (cultures) => computeTagUsage(cultures, []);
