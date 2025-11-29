import { SimulationSystem, SystemResult, ComponentPurpose } from '../engine/types';
import { Relationship } from '../core/worldTypes';
import { TemplateGraphView } from '../graph/templateGraphView';

/**
 * Relationship Culling System
 *
 * Removes weak relationships to improve performance and narrative focus.
 * Only strong, meaningful relationships survive.
 */
export const relationshipCulling: SimulationSystem = {
  id: 'relationship_culling',
  name: 'Relationship Pruning',

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

  apply: (graphView: TemplateGraphView, modifier: number = 1.0): SystemResult => {
    const params = relationshipCulling.metadata?.parameters || {};

    const cullThreshold = params.cullThreshold?.value ?? 0.15;
    const cullFrequency = params.cullFrequency?.value ?? 10;
    const gracePeriod = params.gracePeriod?.value ?? 20;

    // Get protected relationship kinds from domain schema
    // Protected = structural relationships that should never be culled
    const protectedKinds = new Set(graphView.config.domain.getProtectedRelationshipKinds?.() || []);

    // Get immutable relationship kinds from domain schema
    // Immutable = facts that don't change (spatial, discovery, etc.)
    // These are automatically protected since they don't decay naturally
    const immutableKinds = new Set(graphView.config.domain.getImmutableRelationshipKinds?.() || []);

    // Combine: all immutable relationships are also protected
    immutableKinds.forEach(kind => protectedKinds.add(kind));

    // Only run every N ticks
    if (graphView.tick % cullFrequency !== 0) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'Relationship pruning dormant'
      };
    }

    const removed: Relationship[] = [];
    const protectedBelowThreshold: { kind: string; strength: number }[] = [];
    const originalCount = graphView.getRelationshipCount();

    // Filter relationships and collect kept ones
    const keptRelationships = graphView.getAllRelationships().filter(rel => {
      // Protected kinds never get culled, but track if they're weak
      if (protectedKinds.has(rel.kind)) {
        const strength = rel.strength ?? 0.5;
        if (strength < cullThreshold) {
          protectedBelowThreshold.push({ kind: rel.kind, strength });
        }
        return true;
      }

      // Calculate relationship age (minimum age of both entities)
      const srcEntity = graphView.getEntity(rel.src);
      const dstEntity = graphView.getEntity(rel.dst);

      if (!srcEntity || !dstEntity) {
        // Remove relationships to non-existent entities
        removed.push(rel);
        return false;
      }

      const age = Math.min(
        graphView.tick - srcEntity.createdAt,
        graphView.tick - dstEntity.createdAt
      );

      // Young relationships get grace period
      if (age < gracePeriod) return true;

      // Cull if below threshold
      const strength = rel.strength ?? 0.5;
      if (strength < cullThreshold) {
        removed.push(rel);

        // Remove from entity links
        const srcEntityToUpdate = graphView.getEntity(rel.src);
        const dstEntityToUpdate = graphView.getEntity(rel.dst);
        if (srcEntityToUpdate) {
          srcEntityToUpdate.links = srcEntityToUpdate.links.filter(l =>
            !(l.kind === rel.kind && l.src === rel.src && l.dst === rel.dst)
          );
          srcEntityToUpdate.updatedAt = graphView.tick;
        }
        if (dstEntityToUpdate) {
          dstEntityToUpdate.updatedAt = graphView.tick;
        }

        return false; // Remove from graph
      }

      return true; // Keep
    });

    // Update graph with filtered relationships
    graphView.setRelationships([...keptRelationships]);

    const culledCount = removed.length;

    // Store violation data for genetic algorithm fitness evaluation
    if (protectedBelowThreshold.length > 0) {
      graphView.recordProtectedRelationshipViolation(graphView.tick, protectedBelowThreshold);
    }

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
