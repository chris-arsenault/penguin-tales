import { SimulationSystem, SystemResult, ComponentPurpose } from '../engine/types';
import { Relationship } from '../core/worldTypes';
import { TemplateGraphView } from '../graph/templateGraphView';
import type { DecayRate, RelationshipKindDefinition } from '../domainInterface/domainSchema';

/**
 * Relationship Maintenance System
 *
 * Unified system for relationship lifecycle management:
 * - Decay: Reduces strength over time based on relationship kind's decayRate
 * - Reinforcement: Increases strength when entities are in proximity or share context
 * - Culling: Removes weak relationships (respecting cullable flag)
 *
 * Decay rates map to strength reduction per maintenance cycle:
 * - 'none': 0 (permanent)
 * - 'slow': 0.01 per cycle
 * - 'medium': 0.03 per cycle
 * - 'fast': 0.06 per cycle
 */

// =============================================================================
// HELPERS (internal to this system)
// =============================================================================

/** Map decay rate to strength reduction per cycle */
function getDecayAmount(rate: DecayRate): number {
  switch (rate) {
    case 'none': return 0;
    case 'slow': return 0.01;
    case 'medium': return 0.03;
    case 'fast': return 0.06;
    default: return 0.03; // default to medium
  }
}

/** Get relationship kind definition from domain schema */
function getRelationshipKindDef(
  graphView: TemplateGraphView,
  kind: string
): RelationshipKindDefinition | undefined {
  const relationshipKinds = graphView.config?.domain?.relationshipKinds;
  if (!relationshipKinds) return undefined;
  return relationshipKinds.find((rk: RelationshipKindDefinition) => rk.kind === kind);
}

/** Check if a relationship kind is cullable */
function isCullable(graphView: TemplateGraphView, kind: string): boolean {
  const def = getRelationshipKindDef(graphView, kind);
  // Default to true if not specified
  return def?.cullable !== false;
}

/** Get decay rate for a relationship kind */
function getDecayRate(graphView: TemplateGraphView, kind: string): DecayRate {
  const def = getRelationshipKindDef(graphView, kind);
  // Default to 'medium' if not specified
  return def?.decayRate ?? 'medium';
}

/** Check if two entities are in proximity (share location or faction) */
function areInProximity(graphView: TemplateGraphView, srcId: string, dstId: string): boolean {
  const srcEntity = graphView.getEntity(srcId);
  const dstEntity = graphView.getEntity(dstId);
  if (!srcEntity || !dstEntity) return false;

  // Check if they share a location
  const srcLocation = graphView.getLocation(srcId);
  const dstLocation = graphView.getLocation(dstId);
  if (srcLocation && dstLocation && srcLocation.id === dstLocation.id) {
    return true;
  }

  // Check if they share a faction membership
  const srcLinks = srcEntity.links || [];
  const dstLinks = dstEntity.links || [];

  const srcFactions = new Set(
    srcLinks
      .filter(l => l.kind === 'member_of' || l.kind === 'leader_of')
      .map(l => l.dst)
  );

  for (const link of dstLinks) {
    if ((link.kind === 'member_of' || link.kind === 'leader_of') && srcFactions.has(link.dst)) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// SYSTEM DEFINITION
// =============================================================================

export const relationshipMaintenance: SimulationSystem = {
  id: 'relationship_maintenance',
  name: 'Relationship Maintenance',

  contract: {
    purpose: ComponentPurpose.CONSTRAINT_ENFORCEMENT,
    affects: {
      relationships: [
        {
          kind: 'any',
          operation: 'delete',
          count: { min: 0, max: 100 }
        }
      ]
    }
  },

  metadata: {
    produces: {
      relationships: [],
      modifications: [
        { type: 'tags', frequency: 'common', comment: 'Decay reduces strength, reinforcement increases it' }
      ],
    },
    effects: {
      graphDensity: -0.3,
      clusterFormation: 0.1,
      diversityImpact: 0.1,
      comment: 'Maintains relationship health through decay, reinforcement, and culling',
    },
    parameters: {
      maintenanceFrequency: {
        value: 5,
        min: 1,
        max: 20,
        description: 'Run maintenance every N ticks',
      },
      cullThreshold: {
        value: 0.15,
        min: 0.0,
        max: 0.5,
        description: 'Remove cullable relationships below this strength',
      },
      gracePeriod: {
        value: 20,
        min: 0,
        max: 100,
        description: 'Don\'t decay or cull relationships younger than this many ticks',
      },
      reinforcementBonus: {
        value: 0.02,
        min: 0.0,
        max: 0.1,
        description: 'Strength increase when reinforcement conditions are met',
      },
      maxStrength: {
        value: 1.0,
        min: 0.5,
        max: 2.0,
        description: 'Maximum relationship strength',
      },
    },
    triggers: {
      graphConditions: ['Periodic maintenance cycle'],
      comment: 'Runs periodically to maintain relationship health',
    },
  },

  apply: (graphView: TemplateGraphView, modifier: number = 1.0): SystemResult => {
    const params = relationshipMaintenance.metadata?.parameters || {};

    const maintenanceFrequency = params.maintenanceFrequency?.value ?? 5;
    const cullThreshold = params.cullThreshold?.value ?? 0.15;
    const gracePeriod = params.gracePeriod?.value ?? 20;
    const reinforcementBonus = params.reinforcementBonus?.value ?? 0.02;
    const maxStrength = params.maxStrength?.value ?? 1.0;

    // Only run every N ticks
    if (graphView.tick % maintenanceFrequency !== 0) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'Relationship maintenance dormant'
      };
    }

    const allRelationships = graphView.getAllRelationships();
    const originalCount = allRelationships.length;

    let decayed = 0;
    let reinforced = 0;
    let culled = 0;

    const keptRelationships: Relationship[] = [];
    const modifiedEntityIds = new Set<string>();

    for (const rel of allRelationships) {
      const srcEntity = graphView.getEntity(rel.src);
      const dstEntity = graphView.getEntity(rel.dst);

      // Remove relationships to non-existent entities
      if (!srcEntity || !dstEntity) {
        culled++;
        continue;
      }

      // Calculate relationship age
      const age = Math.min(
        graphView.tick - srcEntity.createdAt,
        graphView.tick - dstEntity.createdAt
      );

      // Young relationships are protected
      const isYoung = age < gracePeriod;

      // Get relationship kind properties
      const decayRate = getDecayRate(graphView, rel.kind);
      const cullable = isCullable(graphView, rel.kind);

      let strength = rel.strength ?? 0.5;

      // === DECAY ===
      // Apply decay to relationships that aren't young and have decay enabled
      if (!isYoung && decayRate !== 'none') {
        const decayAmount = getDecayAmount(decayRate) * modifier;
        strength = Math.max(0, strength - decayAmount);
        decayed++;
      }

      // === REINFORCEMENT ===
      // Strengthen relationships when entities are in proximity
      if (areInProximity(graphView, rel.src, rel.dst)) {
        strength = Math.min(maxStrength, strength + reinforcementBonus * modifier);
        reinforced++;
      }

      // === CULLING ===
      // Remove weak relationships that are cullable and past grace period
      if (!isYoung && cullable && strength < cullThreshold) {
        culled++;

        // Update entity links
        if (srcEntity) {
          srcEntity.links = srcEntity.links.filter(l =>
            !(l.kind === rel.kind && l.src === rel.src && l.dst === rel.dst)
          );
          srcEntity.updatedAt = graphView.tick;
          modifiedEntityIds.add(srcEntity.id);
        }
        if (dstEntity) {
          dstEntity.updatedAt = graphView.tick;
          modifiedEntityIds.add(dstEntity.id);
        }

        continue; // Don't keep this relationship
      }

      // Update strength if changed
      if (rel.strength !== strength) {
        rel.strength = strength;
      }

      keptRelationships.push(rel);
    }

    // Update graph with maintained relationships
    graphView.setRelationships([...keptRelationships]);

    // Build description
    const parts: string[] = [];
    if (decayed > 0) parts.push(`${decayed} decayed`);
    if (reinforced > 0) parts.push(`${reinforced} reinforced`);
    if (culled > 0) parts.push(`${culled} culled`);

    const description = parts.length > 0
      ? `Relationship maintenance: ${parts.join(', ')} (${originalCount} total)`
      : `Relationship maintenance: all ${originalCount} relationships stable`;

    return {
      relationshipsAdded: [],
      entitiesModified: Array.from(modifiedEntityIds).map(id => ({
        id,
        changes: { updatedAt: graphView.tick }
      })),
      pressureChanges: {},
      description
    };
  }
};
