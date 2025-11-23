import { GrowthTemplate, TemplateResult, Graph } from '../../../../types/engine';
import { HardState } from '../../../../types/worldTypes';
import { findEntities, getRelated } from '../../../../utils/helpers';

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

  canApply(graph: Graph): boolean {
    // Need factions with leaders and available locations to control
    const factions = findEntities(graph, { kind: 'faction', status: 'active' });

    if (factions.length === 0) return false;

    // Check if any faction has expansion opportunities
    return factions.some(faction => {
      const controlled = graph.relationships
        .filter(r => r.kind === 'controls' && r.src === faction.id)
        .map(r => r.dst);

      // Find uncontrolled adjacent locations
      const adjacentUncontrolled = graph.relationships
        .filter(r =>
          r.kind === 'adjacent_to' &&
          controlled.includes(r.src) &&
          !controlled.includes(r.dst)
        );

      return adjacentUncontrolled.length > 0;
    });
  },

  findTargets(graph: Graph): HardState[] {
    // Return factions with expansion opportunities
    const factions = findEntities(graph, { kind: 'faction', status: 'active' });

    return factions.filter(faction => {
      const controlled = graph.relationships
        .filter(r => r.kind === 'controls' && r.src === faction.id)
        .map(r => r.dst);

      const adjacentUncontrolled = graph.relationships
        .filter(r =>
          r.kind === 'adjacent_to' &&
          controlled.includes(r.src) &&
          !controlled.includes(r.dst)
        );

      return adjacentUncontrolled.length > 0 || controlled.length === 0;
    });
  },

  expand(graph: Graph, target?: HardState): TemplateResult {
    if (!target || target.kind !== 'faction') {
      return {
        entities: [],
        relationships: [],
        description: 'No valid faction target'
      };
    }

    // Find locations this faction already controls
    const controlled = graph.relationships
      .filter(r => r.kind === 'controls' && r.src === target.id)
      .map(r => r.dst);

    // Find candidate locations (adjacent to controlled, or any if none controlled)
    let candidates: HardState[] = [];

    if (controlled.length > 0) {
      // Find adjacent uncontrolled locations
      const adjacentLocations = graph.relationships
        .filter(r =>
          r.kind === 'adjacent_to' &&
          controlled.includes(r.src)
        )
        .map(r => graph.entities.get(r.dst))
        .filter((e): e is HardState => !!e && e.kind === 'location');

      // Filter out already controlled
      candidates = adjacentLocations.filter(loc => !controlled.includes(loc.id));
    } else {
      // No controlled locations yet - can expand to any thriving location
      candidates = findEntities(graph, { kind: 'location', status: 'thriving' });
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
    const leaders = getRelated(graph, target.id, 'leader_of', 'dst');
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
