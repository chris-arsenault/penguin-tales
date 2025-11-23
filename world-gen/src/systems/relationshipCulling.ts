import { SimulationSystem, SystemResult, Graph } from '../types/engine';
import { Relationship } from '../types/worldTypes';

/**
 * Relationship Culling System
 *
 * Removes weak relationships to improve performance and narrative focus.
 * Only strong, meaningful relationships survive.
 */
export const relationshipCulling: SimulationSystem = {
  id: 'relationship_culling',
  name: 'Relationship Pruning',

  metadata: {
    produces: {
      relationships: [],
      modifications: [
        { type: 'tags', frequency: 'uncommon', comment: 'Weak relationships fade and are forgotten' }
      ],
    },
    effects: {
      graphDensity: -0.5,
      clusterFormation: 0.0,
      diversityImpact: 0.1,
      comment: 'Removes weak relationships, reducing graph size and improving narrative focus',
    },
    parameters: {
      cullThreshold: {
        value: 0.15,
        min: 0.0,
        max: 0.5,
        description: 'Remove relationships below this strength',
      },
      cullFrequency: {
        value: 10,
        min: 1,
        max: 50,
        description: 'Check for culling every N ticks',
      },
      gracePeriod: {
        value: 20,
        min: 0,
        max: 100,
        description: 'Don\'t cull relationships younger than this many ticks',
      },
    },
    triggers: {
      graphConditions: ['Relationships below cull threshold'],
      comment: 'Runs periodically to remove weak relationships',
    },
  },

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const params = relationshipCulling.metadata?.parameters || {};

    const cullThreshold = params.cullThreshold?.value ?? 0.15;
    const cullFrequency = params.cullFrequency?.value ?? 10;
    const gracePeriod = params.gracePeriod?.value ?? 20;

    // Protected relationship kinds (hardcoded - these are core narrative elements)
    const protectedKinds = new Set(['member_of', 'leader_of', 'resident_of', 'practitioner_of', 'originated_in']);

    // Only run every N ticks
    if (graph.tick % cullFrequency !== 0) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'Relationship pruning dormant'
      };
    }

    const removed: Relationship[] = [];
    const originalCount = graph.relationships.length;

    graph.relationships = graph.relationships.filter(rel => {
      // Protected kinds never get culled
      if (protectedKinds.has(rel.kind)) return true;

      // Calculate relationship age (minimum age of both entities)
      const srcEntity = graph.entities.get(rel.src);
      const dstEntity = graph.entities.get(rel.dst);

      if (!srcEntity || !dstEntity) {
        // Remove relationships to non-existent entities
        removed.push(rel);
        return false;
      }

      const age = Math.min(
        graph.tick - srcEntity.createdAt,
        graph.tick - dstEntity.createdAt
      );

      // Young relationships get grace period
      if (age < gracePeriod) return true;

      // Cull if below threshold
      const strength = rel.strength ?? 0.5;
      if (strength < cullThreshold) {
        removed.push(rel);

        // Remove from entity links
        if (srcEntity) {
          srcEntity.links = srcEntity.links.filter(l =>
            !(l.kind === rel.kind && l.src === rel.src && l.dst === rel.dst)
          );
          srcEntity.updatedAt = graph.tick;
        }
        if (dstEntity) {
          dstEntity.updatedAt = graph.tick;
        }

        return false; // Remove from graph
      }

      return true; // Keep
    });

    const culledCount = removed.length;

    return {
      relationshipsAdded: [],
      entitiesModified: [],
      pressureChanges: {},
      description: culledCount > 0
        ? `Weak relationships fade (${culledCount} of ${originalCount} culled)`
        : `All relationships above threshold (checked ${originalCount})`
    };
  }
};
