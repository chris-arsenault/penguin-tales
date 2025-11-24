import { GrowthTemplate, TemplateResult, ComponentPurpose } from '../../../../types/engine';
import { TemplateGraphView } from '../../../../services/templateGraphView';
import { HardState } from '../../../../types/worldTypes';

/**
 * Territorial Expansion Template
 *
 * World-level template: Factions expand control to adjacent locations.
 * Creates 'controls' relationships with catalyst attribution.
 *
 * Pattern: Faction (with leader) → seizes control → Location
 * Result: World power dynamics shift, not NPC social networks
 */
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

  canApply(graphView: TemplateGraphView): boolean {
    // Need factions with leaders and available locations to control
    const factions = graphView.findEntities({ kind: 'faction' });

    if (factions.length === 0) return false;

    // Check if any faction has expansion opportunities
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

  findTargets(graphView: TemplateGraphView): HardState[] {
    // Return factions with expansion opportunities
    const factions = graphView.findEntities({ kind: 'faction' });

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

  expand(graphView: TemplateGraphView, target?: HardState): TemplateResult {
    if (!target || target.kind !== 'faction') {
      return {
        entities: [],
        relationships: [],
        description: 'No valid faction target'
      };
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
      // No controlled locations yet - can expand to any thriving location
      candidates = graphView.findEntities({ kind: 'location', status: 'thriving' });
    }

    if (candidates.length === 0) {
      return {
        entities: [],
        relationships: [],
        description: `${target.name} has no expansion opportunities`
      };
    }

    // Select target location
    const targetLocation = candidates[Math.floor(Math.random() * candidates.length)];

    // Find catalyst (leader NPC if exists, otherwise faction itself)
    const leaders = graphView.getRelatedEntities(target.id, 'leader_of', 'dst');
    const catalyst = leaders.length > 0 ? leaders[0] : target;

    // Create controls relationship with catalyst attribution
    const controlsRel = {
      kind: 'controls',
      src: target.id,
      dst: targetLocation.id,
      strength: 0.75,
      catalyzedBy: catalyst.id
    };

    return {
      entities: [],
      relationships: [controlsRel],
      description: `${target.name} expands control to ${targetLocation.name} (catalyzed by ${catalyst.name})`
    };
  }
};
