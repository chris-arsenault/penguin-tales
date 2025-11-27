import { SimulationSystem, SystemResult, Graph, ComponentPurpose } from '@lore-weave/core/types/engine';
import { modifyRelationshipStrength, getLocation, getRelated } from '@lore-weave/core/utils/helpers';

/**
 * Relationship Decay System
 *
 * All relationships naturally weaken over time without reinforcement.
 * Spatial relationships decay faster, narrative relationships decay slower.
 * Proximity and shared context slow decay.
 */
export const relationshipDecay: SimulationSystem = {
  id: 'relationship_decay',
  name: 'Relationship Entropy',

  contract: {
    purpose: ComponentPurpose.STATE_MODIFICATION,
    enabledBy: {
      entityCounts: [
        { kind: 'npc', min: 1 }
      ]
    },
    affects: {
      relationships: [
        { kind: 'member_of', operation: 'delete' },
        { kind: 'leader_of', operation: 'delete' },
        { kind: 'practitioner_of', operation: 'delete' },
        { kind: 'originated_in', operation: 'delete' },
        { kind: 'founded_by', operation: 'delete' },
        { kind: 'resident_of', operation: 'delete' },
        { kind: 'located_at', operation: 'delete' },
        { kind: 'adjacent_to', operation: 'delete' },
        { kind: 'enemy_of', operation: 'delete' },
        { kind: 'at_war_with', operation: 'delete' },
        { kind: 'follower_of', operation: 'delete' },
        { kind: 'friend_of', operation: 'delete' },
        { kind: 'rival_of', operation: 'delete' }
      ]
    }
  },

  metadata: {
    produces: {
      relationships: [],
      modifications: [
        { type: 'tags', frequency: 'common', comment: 'Relationships weaken without reinforcement' }
      ],
    },
    effects: {
      graphDensity: -0.3,
      clusterFormation: -0.2,
      diversityImpact: 0.0,
      comment: 'Weakens relationships over time, reducing graph density',
    },
    parameters: {
      // Different relationship types decay at different rates
      narrativeDecayRate: {
        value: 0.01,
        min: 0.0,
        max: 0.1,
        description: 'Decay rate for narrative relationships (member_of, leader_of, practitioner_of)',
      },
      socialDecayRate: {
        value: 0.02,
        min: 0.0,
        max: 0.1,
        description: 'Decay rate for social relationships (follower_of, friend_of, rival_of)',
      },
      spatialDecayRate: {
        value: 0.05,
        min: 0.0,
        max: 0.2,
        description: 'Decay rate for spatial relationships (resident_of, adjacent_to)',
      },
      conflictDecayRate: {
        value: 0.005,
        min: 0.0,
        max: 0.05,
        description: 'Decay rate for conflict relationships (enemy_of, rival_of) - very slow',
      },

      // Proximity reduces decay
      proximityReduction: {
        value: 0.5,
        min: 0.0,
        max: 1.0,
        description: 'Decay reduction when entities in same location (0.5 = 50% slower)',
      },
      sharedFactionReduction: {
        value: 0.3,
        min: 0.0,
        max: 1.0,
        description: 'Decay reduction when entities share faction membership',
      },

      // Floor: relationships don't decay below this
      decayFloor: {
        value: 0.1,
        min: 0.0,
        max: 0.5,
        description: 'Minimum strength (relationships won\'t decay below this)',
      },
    },
    triggers: {
      graphConditions: ['All relationships decay each tick'],
      comment: 'Passive entropy - runs every tick on all relationships',
    },
  },

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const params = relationshipDecay.metadata?.parameters || {};

    // Decay rate categories
    const narrativeKinds = new Set(['member_of', 'leader_of', 'practitioner_of', 'originated_in', 'founded_by', 'mastered_by']);
    const spatialKinds = new Set(['resident_of', 'located_at', 'adjacent_to', 'contains', 'contained_by', 'slumbers_beneath']);
    const conflictKinds = new Set(['enemy_of', 'at_war_with']);

    const narrativeDecay = (params.narrativeDecayRate?.value ?? 0.01) * modifier;
    const socialDecay = (params.socialDecayRate?.value ?? 0.02) * modifier;
    const spatialDecay = (params.spatialDecayRate?.value ?? 0.05) * modifier;
    const conflictDecay = (params.conflictDecayRate?.value ?? 0.005) * modifier;
    const decayFloor = params.decayFloor?.value ?? 0.1;
    const proximityReduction = params.proximityReduction?.value ?? 0.5;
    const sharedFactionReduction = params.sharedFactionReduction?.value ?? 0.3;

    let modificationsCount = 0;

    graph.getRelationships().forEach(rel => {
      const currentStrength = rel.strength ?? 0.5;

      // Skip if already at floor
      if (currentStrength <= decayFloor) return;

      // Determine base decay rate
      let baseDecayRate: number;
      if (narrativeKinds.has(rel.kind)) {
        baseDecayRate = narrativeDecay;
      } else if (spatialKinds.has(rel.kind)) {
        baseDecayRate = spatialDecay;
      } else if (conflictKinds.has(rel.kind)) {
        baseDecayRate = conflictDecay;
      } else {
        baseDecayRate = socialDecay;
      }

      // Check proximity (same location)
      let proximityFactor = 1.0;
      const srcLocation = getLocation(graph, rel.src);
      const dstLocation = getLocation(graph, rel.dst);
      if (srcLocation && dstLocation && srcLocation.id === dstLocation.id) {
        proximityFactor = 1.0 - proximityReduction;
      }

      // Check shared faction
      let sharedFactionFactor = 1.0;
      const srcFactions = getRelated(graph, rel.src, 'member_of', 'src');
      const dstFactions = getRelated(graph, rel.dst, 'member_of', 'src');
      if (srcFactions.some(f => dstFactions.some(df => df.id === f.id))) {
        sharedFactionFactor = 1.0 - sharedFactionReduction;
      }

      // Calculate final decay
      const finalDecay = baseDecayRate * proximityFactor * sharedFactionFactor;
      const newStrength = Math.max(decayFloor, currentStrength - finalDecay);

      // Apply decay
      if (newStrength !== currentStrength) {
        rel.strength = newStrength;

        // Update entity links
        const srcEntity = graph.getEntity(rel.src);
        if (srcEntity) {
          const link = srcEntity.links.find(l =>
            l.kind === rel.kind && l.src === rel.src && l.dst === rel.dst
          );
          if (link) link.strength = newStrength;
        }

        modificationsCount++;
      }
    });

    return {
      relationshipsAdded: [],
      entitiesModified: [],
      pressureChanges: {},
      description: modificationsCount > 0
        ? `Relationships weaken without reinforcement (${modificationsCount} decayed)`
        : 'Relationship decay stable'
    };
  }
};
