import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState } from '../../types/worldTypes';
import { pickRandom, findEntities } from '../../utils/helpers';

/**
 * Anomaly Manifestation Template
 *
 * Strange magical phenomena appear, triggered by high magical instability.
 * Creates mysterious locations that attract cults and magic users.
 */
export const anomalyManifestation: GrowthTemplate = {
  id: 'anomaly_manifestation',
  name: 'Anomaly Appears',
  
  canApply: (graph: Graph) => {
    const magic = graph.pressures.get('magical_instability') || 0;
    return magic > 30 || Math.random() > 0.8;
  },
  
  findTargets: (graph: Graph) => findEntities(graph, { kind: 'location' }),
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    // Find a location to be adjacent to (prefer colonies for discoverability)
    const locations = findEntities(graph, { kind: 'location' });
    const nearbyLocation = target || pickRandom(locations);

    if (!nearbyLocation) {
      // No locations exist - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: 'Cannot manifest anomaly - no locations exist'
      };
    }

    const anomalyName = `${pickRandom(['Shimmering', 'Frozen', 'Dark'])} ${pickRandom(['Rift', 'Vortex', 'Echo'])}`;

    const relationships: any[] = [
      {
        kind: 'adjacent_to',
        src: 'will-be-assigned-0',
        dst: nearbyLocation.id
      }
    ];

    // If there are magic users, one might discover it
    const magicUsers = Array.from(graph.entities.values()).filter(
      e => (e.kind === 'npc' && e.tags.includes('magic')) ||
           (e.kind === 'npc' && e.links.some(l => l.kind === 'practitioner_of'))
    );

    if (magicUsers.length > 0) {
      const discoverer = pickRandom(magicUsers);
      relationships.push({
        kind: 'discovered_by',
        src: 'will-be-assigned-0',
        dst: discoverer.id
      });
    }

    return {
      entities: [{
        kind: 'location',
        subtype: 'anomaly',
        name: anomalyName,
        description: `A mysterious phenomenon near ${nearbyLocation.name}`,
        status: 'unspoiled',
        prominence: 'recognized',
        tags: ['anomaly', 'mysterious']
      }],
      relationships,
      description: `${anomalyName} manifests near ${nearbyLocation.name}`
    };
  }
};
