/**
 * Territorial Expansion Template
 *
 * Strategy-based template for political power expansion.
 *
 * Pipeline:
 *   1. Applicability: entity_count_min(faction, 1) AND expansion_opportunity
 *   2. Selection: by_kind(faction) with adjacent location filter
 *   3. Creation: none (relationship-only template)
 *   4. Relationships: hierarchical(controls) with catalyst attribution
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom } from '@lore-weave/core';

import {
  // Step 1: Applicability
  checkEntityCountMin,
  // Step 2: Selection
  selectByKind,
  // Step 4: Relationships
  createRelationship,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';
export const territorialExpansion: GrowthTemplate = {
  id: 'territorial_expansion',
  name: 'Territorial Expansion',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'faction', min: 1 },
        { kind: 'location', min: 2 }  // Need at least 2 locations for expansion
      ]
    },
    affects: {
      entities: [],  // No new entities created
      relationships: [
        { kind: 'controls', operation: 'create', count: { min: 1, max: 1 } }
      ],
      pressures: []
    }
  },

  metadata: {
    produces: {
      entityKinds: [],
      relationships: [
        { kind: 'controls', category: 'political', probability: 1.0, comment: 'Faction expands territorial control' }
      ]
    },
    effects: {
      graphDensity: 0.3,
      clusterFormation: 0.6,
      diversityImpact: 0.4,
      comment: 'Factions expand territory, creating political power structures'
    },
    parameters: {
      expansionAggressiveness: {
        value: 0.5,
        min: 0.2,
        max: 1.0,
        description: 'How readily factions expand into adjacent territories'
      },
      leaderProminenceBonus: {
        value: 0.3,
        min: 0.0,
        max: 0.6,
        description: 'Prominence bonus for faction leaders on successful expansion'
      }
    },
    tags: ['world-level', 'political', 'territorial']
  },

  // =========================================================================
  // STEP 1: APPLICABILITY - entity_count_min AND expansion_opportunity
  // =========================================================================
  canApply(graphView: TemplateGraphView): boolean {
    // Strategy: entity_count_min(faction, 1)
    if (!checkEntityCountMin(graphView, 'faction', undefined, 1)) {
      return false;
    }

    // Strategy: check for expansion opportunities
    const factions = selectByKind(graphView, 'faction');

    return factions.some(faction => {
      const controlled = graphView.getRelatedEntities(faction.id, 'controls', 'src');

      // Find uncontrolled adjacent locations
      const hasExpansionOpportunity = controlled.some(controlledLoc => {
        const adjacent = graphView.getRelatedEntities(controlledLoc.id, 'adjacent_to', 'src');
        return adjacent.some(adjLoc => !controlled.some(c => c.id === adjLoc.id));
      });

      return hasExpansionOpportunity;
    });
  },

  // =========================================================================
  // STEP 2: SELECTION - factions with expansion opportunities
  // =========================================================================
  findTargets(graphView: TemplateGraphView): HardState[] {
    // Strategy: by_kind(faction) with adjacent location filter
    const factions = selectByKind(graphView, 'faction');

    return factions.filter(faction => {
      const controlled = graphView.getRelatedEntities(faction.id, 'controls', 'src');

      if (controlled.length === 0) {
        // Factions with no territory can expand
        return true;
      }

      // Check if any controlled location has uncontrolled adjacent locations
      const hasExpansionOpportunity = controlled.some(controlledLoc => {
        const adjacent = graphView.getRelatedEntities(controlledLoc.id, 'adjacent_to', 'src');
        return adjacent.some(adjLoc => !controlled.some(c => c.id === adjLoc.id));
      });

      return hasExpansionOpportunity;
    });
  },

  // =========================================================================
  // STEPS 3-4: CREATION & RELATIONSHIPS
  // =========================================================================
  expand(graphView: TemplateGraphView, target?: HardState): TemplateResult {
    if (!target || target.kind !== 'faction') {
      return emptyResult('No valid faction target');
    }

    // Find locations this faction already controls
    const controlled = graphView.getRelatedEntities(target.id, 'controls', 'src');

    // Find candidate locations (adjacent to controlled, or any if none controlled)
    let candidates: HardState[] = [];

    if (controlled.length > 0) {
      // Find adjacent uncontrolled locations
      const adjacentSet = new Set<string>();
      controlled.forEach(controlledLoc => {
        const adjacent = graphView.getRelatedEntities(controlledLoc.id, 'adjacent_to', 'src');
        adjacent.forEach(adjLoc => {
          if (!controlled.some(c => c.id === adjLoc.id)) {
            adjacentSet.add(adjLoc.id);
          }
        });
      });

      candidates = Array.from(adjacentSet)
        .map(id => graphView.getEntity(id))
        .filter((e): e is HardState => !!e && e.kind === 'location');
    } else {
      // Strategy: by_kind(location) with status filter - expand to any thriving location
      candidates = selectByKind(graphView, 'location').filter(loc => loc.status === 'thriving');
    }

    if (candidates.length === 0) {
      return emptyResult(`${target.name} has no expansion opportunities`);
    }

    // Select target location
    const targetLocation = pickRandom(candidates);

    // Find catalyst (leader NPC if exists, otherwise faction itself)
    const leaders = graphView.getRelatedEntities(target.id, 'leader_of', 'dst');
    const catalyst = leaders.length > 0 ? pickRandom(leaders) : target;

    // ------- STEP 4: RELATIONSHIPS -------

    // Strategy: hierarchical(controls) with catalyst attribution
    const controlsRel = createRelationship('controls', target.id, targetLocation.id, { strength: 0.75 });
    controlsRel.catalyzedBy = catalyst.id;

    return templateResult(
      [],
      [controlsRel],
      `${target.name} expands control to ${targetLocation.name} (catalyzed by ${catalyst.name})`
    );
  }
};
