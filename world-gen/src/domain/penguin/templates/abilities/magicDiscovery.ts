import { GrowthTemplate, TemplateResult, Graph } from '../../../../types/engine';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { pickRandom, findEntities } from '../../../../utils/helpers';

/**
 * Magic Discovery Template
 *
 * Heroes discover magical abilities near anomalies.
 * Creates magic abilities linked to the discoverer and manifestation location.
 */
export const magicDiscovery: GrowthTemplate = {
  id: 'magic_discovery',
  name: 'Magical Discovery',

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'abilities',
          subtype: 'magic',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'recognized', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'discoverer_of', category: 'cultural', probability: 1.0, comment: 'Hero discovers magic' },
        { kind: 'manifests_at', category: 'spatial', probability: 1.0, comment: 'Magic manifests at anomaly' },
      ],
    },
    effects: {
      graphDensity: 0.3,
      clusterFormation: 0.4,
      diversityImpact: 0.9,
      comment: 'Creates mystical abilities linked to anomalies and heroes',
    },
    tags: ['mystical', 'ability-creation'],
  },

  canApply: (graph: Graph) => {
    // Prerequisite: anomalies must exist
    const anomalies = findEntities(graph, { kind: 'location', subtype: 'anomaly' });
    if (anomalies.length === 0) {
      return false;
    }

    // BIDIRECTIONAL PRESSURE THRESHOLD: High magical instability suppresses magic discovery
    // (Too much magical energy makes new discoveries dangerous/unstable)
    const magicalInstability = graph.pressures.get('magical_instability') || 0;
    if (magicalInstability > 70) {
      return Math.random() < 0.4; // Only 40% chance when instability is very high
    }

    // SATURATION LIMIT: Check if magic count is at or above threshold
    const existingMagic = findEntities(graph, { kind: 'abilities', subtype: 'magic' });
    const targets = graph.config.distributionTargets as any;
    const target = targets?.entities?.abilities?.magic?.target || 15;
    const saturationThreshold = target * 1.5; // Allow 50% overshoot

    if (existingMagic.length >= saturationThreshold) {
      return false; // Too much magic, suppress creation
    }

    return true;
  },

  findTargets: (graph: Graph) => {
    const maxDiscoveriesPerHero = 2; // Reduced from 3 to 2 discoveries per hero
    const heroes = findEntities(graph, { kind: 'npc', subtype: 'hero' });

    // Filter out heroes who have already discovered too many abilities
    return heroes.filter(hero => {
      const discoveryCount = graph.relationships.filter(r =>
        r.kind === 'discoverer_of' && r.src === hero.id
      ).length;
      return discoveryCount < maxDiscoveriesPerHero;
    });
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const hero = target || pickRandom(findEntities(graph, { kind: 'npc', subtype: 'hero' }));
    const anomaly = pickRandom(findEntities(graph, { kind: 'location', subtype: 'anomaly' }));
    
    return {
      entities: [{
        kind: 'abilities',
        subtype: 'magic',
        name: `${pickRandom(['Frost', 'Ice', 'Glow'])} ${pickRandom(['Ward', 'Sight', 'Bond'])}`,
        description: `Mystical ability discovered by ${hero.name}`,
        status: 'emergent',
        prominence: 'recognized',
        tags: ['magic', 'mystical']
      }],
      relationships: [
        { kind: 'discoverer_of', src: hero.id, dst: 'will-be-assigned-0' },
        { kind: 'manifests_at', src: 'will-be-assigned-0', dst: anomaly.id }
      ],
      description: `${hero.name} discovers magical ability`
    };
  }
};
