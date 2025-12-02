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

/**
 * Utility function to compute schema element usage across Coherence Engine
 *
 * Analyzes generators, systems, actions, and pressures to find where
 * entity kinds, relationship kinds, subtypes, and statuses are referenced.
 *
 * @param {Object} params
 * @param {Array} params.generators - Array of generator configs
 * @param {Array} params.systems - Array of system configs
 * @param {Array} params.actions - Array of action configs
 * @param {Array} params.pressures - Array of pressure configs
 * @param {Array} params.seedEntities - Array of seed entities
 * @returns {Object} - {
 *   entityKinds: { [kindId]: { generators: [], systems: [], actions: [], pressures: [], seeds: [] } },
 *   relationshipKinds: { [kindId]: { generators: [], systems: [], actions: [] } },
 *   subtypes: { [kindId]: { [subtypeId]: { generators: [], systems: [], seeds: [] } } },
 *   statuses: { [kindId]: { [statusId]: { generators: [], systems: [] } } }
 * }
 */
export function computeSchemaUsage({
  generators = [],
  systems = [],
  actions = [],
  pressures = [],
  seedEntities = [],
}) {
  const usage = {
    entityKinds: {},
    relationshipKinds: {},
    subtypes: {},
    statuses: {},
  };

  // Helper to ensure usage entry exists
  const ensureEntityKind = (kind) => {
    if (!usage.entityKinds[kind]) {
      usage.entityKinds[kind] = { generators: [], systems: [], actions: [], pressures: [], seeds: [] };
    }
  };

  const ensureRelationshipKind = (kind) => {
    if (!usage.relationshipKinds[kind]) {
      usage.relationshipKinds[kind] = { generators: [], systems: [], actions: [] };
    }
  };

  const ensureSubtype = (entityKind, subtype) => {
    if (!usage.subtypes[entityKind]) {
      usage.subtypes[entityKind] = {};
    }
    if (!usage.subtypes[entityKind][subtype]) {
      usage.subtypes[entityKind][subtype] = { generators: [], systems: [], seeds: [] };
    }
  };

  const ensureStatus = (entityKind, status) => {
    if (!usage.statuses[entityKind]) {
      usage.statuses[entityKind] = {};
    }
    if (!usage.statuses[entityKind][status]) {
      usage.statuses[entityKind][status] = { generators: [], systems: [] };
    }
  };

  // Analyze generators
  generators.forEach((gen) => {
    const genId = gen.id || gen.name || 'unnamed';

    // Entity kinds produced (in creation array)
    const creations = gen.creation || [];
    creations.forEach((c) => {
      if (c.kind) {
        ensureEntityKind(c.kind);
        usage.entityKinds[c.kind].generators.push(genId);
      }
      if (c.kind && c.subtype) {
        ensureSubtype(c.kind, c.subtype);
        usage.subtypes[c.kind][c.subtype].generators.push(genId);
      }
    });

    // Also check legacy entityKind field
    if (gen.entityKind) {
      ensureEntityKind(gen.entityKind);
      usage.entityKinds[gen.entityKind].generators.push(genId);
    }
    if (gen.entityKind && gen.subtype) {
      ensureSubtype(gen.entityKind, gen.subtype);
      usage.subtypes[gen.entityKind][gen.subtype].generators.push(genId);
    }

    // Selection kind (the kind being selected from)
    if (gen.selection?.kind) {
      ensureEntityKind(gen.selection.kind);
      usage.entityKinds[gen.selection.kind].generators.push(genId);
    }

    // Applicability rules that reference kinds
    const checkApplicability = (rules) => {
      for (const rule of (rules || [])) {
        if (rule.kind) {
          ensureEntityKind(rule.kind);
          usage.entityKinds[rule.kind].generators.push(genId);
        }
        if (rule.rules) {
          checkApplicability(rule.rules);
        }
      }
    };
    checkApplicability(gen.applicability);

    // Relationships created (in creation or at top level)
    const relationships = gen.relationships || [];
    relationships.forEach((rel) => {
      const relKind = typeof rel === 'string' ? rel : rel.kind;
      if (relKind) {
        ensureRelationshipKind(relKind);
        usage.relationshipKinds[relKind].generators.push(genId);
      }
    });

    // Relationships in creation entries
    creations.forEach((c) => {
      if (c.lineage?.relationshipKind) {
        ensureRelationshipKind(c.lineage.relationshipKind);
        usage.relationshipKinds[c.lineage.relationshipKind].generators.push(genId);
      }
    });

    // Target entity kinds (for relationship targets)
    const targets = gen.targets || gen.targetKinds || [];
    targets.forEach((target) => {
      const targetKind = typeof target === 'string' ? target : target.kind;
      if (targetKind) {
        ensureEntityKind(targetKind);
        usage.entityKinds[targetKind].generators.push(genId);
      }
    });

    // Requirements (entity kinds in conditions)
    if (gen.requires) {
      Object.entries(gen.requires).forEach(([key, value]) => {
        if (key === 'entityKind' || key === 'kind') {
          ensureEntityKind(value);
          usage.entityKinds[value].generators.push(genId);
        }
      });
    }
  });

  // Analyze systems
  systems.forEach((sys) => {
    // Systems can have config wrapper or be flat
    const cfg = sys.config || sys;
    const sysId = cfg.id || cfg.name || sys.systemType || 'unnamed';

    // Entity kinds operated on
    if (cfg.entityKind) {
      ensureEntityKind(cfg.entityKind);
      usage.entityKinds[cfg.entityKind].systems.push(sysId);
    }

    // Source and target kinds
    ['sourceKind', 'targetKind', 'srcKind', 'dstKind'].forEach((field) => {
      if (cfg[field]) {
        ensureEntityKind(cfg[field]);
        usage.entityKinds[cfg[field]].systems.push(sysId);
      }
    });

    // Entity kinds array
    const entityKinds = cfg.entityKinds || cfg.kinds || [];
    entityKinds.forEach((kind) => {
      ensureEntityKind(kind);
      usage.entityKinds[kind].systems.push(sysId);
    });

    // Relationships created/operated on
    if (cfg.relationshipKind) {
      ensureRelationshipKind(cfg.relationshipKind);
      usage.relationshipKinds[cfg.relationshipKind].systems.push(sysId);
    }

    const relationshipKinds = cfg.relationshipKinds || cfg.relationships || [];
    relationshipKinds.forEach((rel) => {
      const relKind = typeof rel === 'string' ? rel : rel.kind;
      if (relKind) {
        ensureRelationshipKind(relKind);
        usage.relationshipKinds[relKind].systems.push(sysId);
      }
    });

    // Subtype filters
    if (cfg.entityKind && cfg.subtype) {
      ensureSubtype(cfg.entityKind, cfg.subtype);
      usage.subtypes[cfg.entityKind][cfg.subtype].systems.push(sysId);
    }

    // Status transitions
    if (cfg.entityKind && cfg.fromStatus) {
      ensureStatus(cfg.entityKind, cfg.fromStatus);
      usage.statuses[cfg.entityKind][cfg.fromStatus].systems.push(sysId);
    }
    if (cfg.entityKind && cfg.toStatus) {
      ensureStatus(cfg.entityKind, cfg.toStatus);
      usage.statuses[cfg.entityKind][cfg.toStatus].systems.push(sysId);
    }
  });

  // Analyze actions
  actions.forEach((action) => {
    const actionId = action.id || action.name || 'unnamed';

    // Actor kind
    if (action.actorKind) {
      ensureEntityKind(action.actorKind);
      usage.entityKinds[action.actorKind].actions.push(actionId);
    }

    // Target kind
    if (action.targetKind) {
      ensureEntityKind(action.targetKind);
      usage.entityKinds[action.targetKind].actions.push(actionId);
    }

    // Relationship kind created
    if (action.relationshipKind) {
      ensureRelationshipKind(action.relationshipKind);
      usage.relationshipKinds[action.relationshipKind].actions.push(actionId);
    }
  });

  // Analyze pressures
  pressures.forEach((pressure) => {
    const pressureId = pressure.id || pressure.name || 'unnamed';

    // Entity kinds affected
    const affectedKinds = pressure.affectedKinds || pressure.entityKinds || [];
    affectedKinds.forEach((kind) => {
      ensureEntityKind(kind);
      usage.entityKinds[kind].pressures.push(pressureId);
    });

    // Single entity kind
    if (pressure.entityKind) {
      ensureEntityKind(pressure.entityKind);
      usage.entityKinds[pressure.entityKind].pressures.push(pressureId);
    }
  });

  // Analyze seed entities
  seedEntities.forEach((entity) => {
    const entityLabel = entity.name || entity.id || 'unnamed seed';

    if (entity.kind) {
      ensureEntityKind(entity.kind);
      usage.entityKinds[entity.kind].seeds.push(entityLabel);
    }

    if (entity.kind && entity.subtype) {
      ensureSubtype(entity.kind, entity.subtype);
      usage.subtypes[entity.kind][entity.subtype].seeds.push(entityLabel);
    }
  });

  return usage;
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
