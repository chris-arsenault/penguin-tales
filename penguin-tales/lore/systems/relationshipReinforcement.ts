import { SimulationSystem, SystemResult, Graph, ComponentPurpose } from '@lore-weave/core/types/engine';
import { getLocation, getRelated, modifyRelationshipStrength } from '@lore-weave/core/utils/helpers';

/**
 * Relationship Reinforcement System
 *
 * Relationships strengthen through shared experiences and proximity.
 * Creates emergent veteran bonds and deepening loyalties.
 */
export const relationshipReinforcement: SimulationSystem = {
  id: 'relationship_reinforcement',
  name: 'Relationship Bonding',

  contract: {
    purpose: ComponentPurpose.STATE_MODIFICATION,
    enabledBy: {
      entityCounts: [
        { kind: 'npc', min: 2 }
      ]
    },
    affects: {
      relationships: [
        { kind: 'member_of', operation: 'create' },
        { kind: 'leader_of', operation: 'create' },
        { kind: 'practitioner_of', operation: 'create' },
        { kind: 'resident_of', operation: 'create' },
        { kind: 'located_at', operation: 'create' },
        { kind: 'follower_of', operation: 'create' },
        { kind: 'friend_of', operation: 'create' },
        { kind: 'rival_of', operation: 'create' },
        { kind: 'enemy_of', operation: 'create' }
      ]
    }
  },

  metadata: {
    produces: {
      relationships: [],
      modifications: [
        { type: 'tags', frequency: 'common', comment: 'Relationships strengthen through shared experiences' }
      ],
    },
    effects: {
      graphDensity: 0.2,
      clusterFormation: 0.4,
      diversityImpact: 0.0,
      comment: 'Strengthens relationships through proximity and shared context',
    },
    parameters: {
      // Structural reinforcement (NEW - key parameter for protected relationships)
      structuralBonus: {
        value: 0.02,
        min: 0.0,
        max: 0.1,
        description: 'Per-tick reinforcement for structural relationships (member_of, resident_of, etc.) - keeps protected relationships strong',
      },

      // Reinforcement bonuses (conditional on proximity/faction)
      proximityBonus: {
        value: 0.03,
        min: 0.0,
        max: 0.1,
        description: 'Strength increase per tick if entities in same location',
      },
      sharedFactionBonus: {
        value: 0.02,
        min: 0.0,
        max: 0.1,
        description: 'Strength increase per tick if entities share faction',
      },
      sharedConflictBonus: {
        value: 0.05,
        min: 0.0,
        max: 0.2,
        description: 'Strength increase if both have same enemy (fighting together)',
      },

      // Cap: relationships can't exceed this
      reinforcementCap: {
        value: 1.0,
        min: 0.5,
        max: 1.0,
        description: 'Maximum strength from reinforcement',
      },
    },
    triggers: {
      graphConditions: ['Proximity', 'Shared faction', 'Shared enemies'],
      comment: 'Relationships strengthen when entities interact or share experiences',
    },
  },

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const params = relationshipReinforcement.metadata?.parameters || {};

    const structuralBonus = (params.structuralBonus?.value ?? 0.02) * modifier;
    const proximityBonus = (params.proximityBonus?.value ?? 0.03) * modifier;
    const sharedFactionBonus = (params.sharedFactionBonus?.value ?? 0.02) * modifier;
    const sharedConflictBonus = (params.sharedConflictBonus?.value ?? 0.05) * modifier;
    const reinforcementCap = params.reinforcementCap?.value ?? 1.0;

    // Define relationship categories
    const narrativeKinds = new Set(['member_of', 'leader_of', 'practitioner_of', 'originated_in', 'founded_by', 'discoverer_of']);
    const spatialKinds = new Set(['resident_of', 'located_at', 'adjacent_to', 'contains', 'contained_by', 'slumbers_beneath', 'manifests_at']);
    const structuralKinds = new Set([...narrativeKinds, ...spatialKinds]); // All structural relationships

    let modificationsCount = 0;

    graph.relationships.forEach(rel => {
      const currentStrength = rel.strength ?? 0.5;

      // Skip if already at cap
      if (currentStrength >= reinforcementCap) return;

      const srcEntity = graph.entities.get(rel.src);
      const dstEntity = graph.entities.get(rel.dst);

      if (!srcEntity || !dstEntity) return;

      let totalBonus = 0;

      // STRUCTURAL BONUS: Always applies to narrative/spatial relationships
      // This is the key parameter for keeping protected relationships strong!
      if (structuralKinds.has(rel.kind)) {
        totalBonus += structuralBonus;
      }

      // CONDITIONAL BONUSES: Apply to non-spatial relationships only
      const isSpatial = spatialKinds.has(rel.kind);

      // Proximity bonus: same location (for social relationships)
      if (!isSpatial) {
        const srcLocation = getLocation(graph, rel.src);
        const dstLocation = getLocation(graph, rel.dst);
        if (srcLocation && dstLocation && srcLocation.id === dstLocation.id) {
          totalBonus += proximityBonus;
        }
      }

      // Shared faction bonus (for social relationships)
      if (!isSpatial) {
        const srcFactions = getRelated(graph, rel.src, 'member_of', 'src');
        const dstFactions = getRelated(graph, rel.dst, 'member_of', 'src');
        if (srcFactions.some(f => dstFactions.some(df => df.id === f.id))) {
          totalBonus += sharedFactionBonus;
        }
      }

      // Shared conflict bonus (both have enemy_of to same target)
      if (!isSpatial) {
        const srcEnemies = getRelated(graph, rel.src, 'enemy_of', 'src');
        const dstEnemies = getRelated(graph, rel.dst, 'enemy_of', 'src');
        if (srcEnemies.some(e => dstEnemies.some(de => de.id === e.id))) {
          totalBonus += sharedConflictBonus;
        }
      }

      // Apply bonus
      if (totalBonus > 0) {
        const newStrength = Math.min(reinforcementCap, currentStrength + totalBonus);

        if (newStrength !== currentStrength) {
          rel.strength = newStrength;

          // Update entity links
          const link = srcEntity.links.find(l =>
            l.kind === rel.kind && l.src === rel.src && l.dst === rel.dst
          );
          if (link) link.strength = newStrength;

          modificationsCount++;
        }
      }
    });

    return {
      relationshipsAdded: [],
      entitiesModified: [],
      pressureChanges: {},
      description: modificationsCount > 0
        ? `Bonds strengthen through shared experiences (${modificationsCount} reinforced)`
        : 'Relationship bonding dormant'
    };
  }
};
