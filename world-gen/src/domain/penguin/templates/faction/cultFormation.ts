import { GrowthTemplate, TemplateResult, Graph } from '../../../../types/engine';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { generateName, pickRandom, findEntities } from '../../../../utils/helpers';

/**
 * Cult Formation Template
 *
 * Mystical cults emerge near anomalies or where magic is present.
 * Creates cult faction, prophet leader, and 3 cultist followers.
 */
export const cultFormation: GrowthTemplate = {
  id: 'cult_formation',
  name: 'Cult Awakening',

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'faction',
          subtype: 'cult',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
        {
          kind: 'npc',
          subtype: 'hero',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
        {
          kind: 'npc',
          subtype: 'various',
          count: { min: 3, max: 3 },
          prominence: [{ level: 'forgotten', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'occupies', category: 'spatial', probability: 1.0, comment: 'Cult occupies anomaly/location' },
        { kind: 'leader_of', category: 'political', probability: 1.0, comment: 'Prophet leads cult' },
        { kind: 'resident_of', category: 'spatial', probability: 4.0, comment: 'Prophet + 3 cultists reside' },
        { kind: 'member_of', category: 'political', probability: 3.0, comment: '3 cultists join' },
        { kind: 'follower_of', category: 'social', probability: 3.0, comment: 'Cultists follow prophet' },
        { kind: 'seeks', category: 'cultural', probability: 0.8, comment: 'Cult seeks magic if exists' },
        { kind: 'practitioner_of', category: 'cultural', probability: 0.8, comment: 'Prophet practices magic if exists' },
      ],
    },
    effects: {
      graphDensity: 0.7,
      clusterFormation: 0.9,
      diversityImpact: 0.5,
      comment: 'Creates tight mystical clusters near anomalies',
    },
    parameters: {
      numCultists: {
        value: 3,
        min: 2,
        max: 8,
        description: 'Number of initial cultist followers',
      },
    },
    tags: ['mystical', 'anomaly-driven', 'cluster-forming'],
  },

  canApply: (graph: Graph) => {
    const anomalies = findEntities(graph, { kind: 'location', subtype: 'anomaly' });
    const magic = findEntities(graph, { kind: 'abilities', subtype: 'magic' });
    return anomalies.length > 0 || magic.length > 0;
  },
  
  findTargets: (graph: Graph) => {
    const anomalies = findEntities(graph, { kind: 'location', subtype: 'anomaly' });
    const nearbyLocations: HardState[] = [];
    
    anomalies.forEach(anomaly => {
      anomaly.links
        .filter(l => l.kind === 'adjacent_to')
        .forEach(l => {
          const adjacent = graph.entities.get(l.dst);
          if (adjacent) nearbyLocations.push(adjacent);
        });
    });
    
    return [...anomalies, ...nearbyLocations];
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    // Extract parameters from metadata
    const params = cultFormation.metadata?.parameters || {};
    const numCultists = params.numCultists?.value ?? 3;

    const location = target || pickRandom(findEntities(graph, { kind: 'location' }));

    if (!location) {
      // No location exists - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: 'Cannot form cult - no locations exist'
      };
    }

    const cult: Partial<HardState> = {
      kind: 'faction',
      subtype: 'cult',
      name: `${pickRandom(['Order', 'Covenant', 'Circle'])} of the ${pickRandom(['Fissure', 'Depths', 'Ice'])}`,
      description: `A mystical cult drawn to the power near ${location.name}`,
      status: 'illegal',
      prominence: 'marginal',
      tags: ['mystical', 'secretive', 'cult']
    };

    const prophet: Partial<HardState> = {
      kind: 'npc',
      subtype: 'hero',
      name: generateName('mystic'),
      description: `The enigmatic prophet of ${cult.name}`,
      status: 'alive',
      prominence: 'marginal', // Prophets start marginal
      tags: ['prophet', 'mystic']
    };

    const cultists: Partial<HardState>[] = [];
    for (let i = 0; i < numCultists; i++) {
      cultists.push({
        kind: 'npc',
        subtype: pickRandom(['merchant', 'outlaw']),
        name: generateName(),
        description: `A devoted follower of ${cult.name}`,
        status: 'alive',
        prominence: 'forgotten',
        tags: ['cultist', 'devoted']
      });
    }
    
    const relationships: Relationship[] = [
      { kind: 'occupies', src: 'will-be-assigned-0', dst: location.id },
      { kind: 'leader_of', src: 'will-be-assigned-1', dst: 'will-be-assigned-0' },
      { kind: 'resident_of', src: 'will-be-assigned-1', dst: location.id }
    ];

    cultists.forEach((_, i) => {
      relationships.push({
        kind: 'member_of',
        src: `will-be-assigned-${i + 2}`,
        dst: 'will-be-assigned-0'
      });
      relationships.push({
        kind: 'follower_of',
        src: `will-be-assigned-${i + 2}`,
        dst: 'will-be-assigned-1'
      });
      relationships.push({
        kind: 'resident_of',
        src: `will-be-assigned-${i + 2}`,
        dst: location.id
      });
    });
    
    const magic = findEntities(graph, { kind: 'abilities', subtype: 'magic' })[0];
    if (magic) {
      relationships.push({
        kind: 'seeks',
        src: 'will-be-assigned-0',
        dst: magic.id
      });
      relationships.push({
        kind: 'practitioner_of',
        src: 'will-be-assigned-1',
        dst: magic.id
      });
    }
    
    return {
      entities: [cult, prophet, ...cultists],
      relationships,
      description: `${cult.name} forms around mystical beliefs`
    };
  }
};
