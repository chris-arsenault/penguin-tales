import { GrowthTemplate } from '../types/engine';
import { pickRandom, findEntities } from '../utils/helpers';

// Simple templates for other entity types

export const rulesTemplates: GrowthTemplate[] = [
  {
    id: 'crisis_legislation',
    name: 'Crisis Law',
    canApply: (graph) => {
      const conflict = graph.pressures.get('conflict') || 0;
      const scarcity = graph.pressures.get('resource_scarcity') || 0;
      return conflict > 40 || scarcity > 40;
    },
    findTargets: (graph) => findEntities(graph, { kind: 'location', subtype: 'colony' }),
    expand: (graph, target) => {
      const colony = target || pickRandom(findEntities(graph, { kind: 'location', subtype: 'colony' }));
      const ruleType = pickRandom(['edict', 'taboo', 'social']);
      
      return {
        entities: [{
          kind: 'rules',
          subtype: ruleType,
          name: `${colony.name} ${pickRandom(['Protection', 'Rationing', 'Defense'])} ${ruleType}`,
          description: `Emergency measure enacted in ${colony.name}`,
          status: 'enacted',
          prominence: 'recognized',
          tags: ['crisis', colony.name.toLowerCase()]
        }],
        relationships: [
          { kind: 'applies_in', src: 'will-be-assigned-0', dst: colony.id }
        ],
        description: `New ${ruleType} enacted in ${colony.name}`
      };
    }
  }
];

export const abilitiesTemplates: GrowthTemplate[] = [
  {
    id: 'tech_innovation',
    name: 'Technology Development',
    canApply: (graph) => findEntities(graph, { kind: 'faction', subtype: 'company' }).length > 0,
    findTargets: (graph) => findEntities(graph, { kind: 'faction', subtype: 'company' }),
    expand: (graph, target) => {
      const faction = target || pickRandom(findEntities(graph, { kind: 'faction', subtype: 'company' }));
      
      return {
        entities: [{
          kind: 'abilities',
          subtype: 'technology',
          name: `${pickRandom(['Advanced', 'Improved', 'Enhanced'])} ${pickRandom(['Fishing', 'Ice', 'Navigation'])} Tech`,
          description: `Innovation developed by ${faction.name}`,
          status: 'discovered',
          prominence: 'marginal',
          tags: ['tech', 'innovation']
        }],
        relationships: [
          { kind: 'wields', src: faction.id, dst: 'will-be-assigned-0' }
        ],
        description: `${faction.name} develops new technology`
      };
    }
  },
  {
    id: 'magic_discovery',
    name: 'Magical Discovery',
    canApply: (graph) => findEntities(graph, { kind: 'location', subtype: 'anomaly' }).length > 0,
    findTargets: (graph) => findEntities(graph, { kind: 'npc', subtype: 'hero' }),
    expand: (graph, target) => {
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
  }
];

export const locationTemplates: GrowthTemplate[] = [
  {
    id: 'colony_founding',
    name: 'Colony Foundation',
    canApply: (graph) => {
      const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
      return colonies.length < 5 && graph.entities.size > 20;
    },
    findTargets: (graph) => findEntities(graph, { kind: 'location', subtype: 'iceberg' }),
    expand: (graph, target) => {
      const iceberg = target || pickRandom(findEntities(graph, { kind: 'location', subtype: 'iceberg' }));
      
      return {
        entities: [{
          kind: 'location',
          subtype: 'colony',
          name: `${pickRandom(['North', 'South', 'East', 'West'])} ${pickRandom(['Haven', 'Roost', 'Perch'])}`,
          description: `New colony established on ${iceberg.name}`,
          status: 'thriving',
          prominence: 'marginal',
          tags: ['new', 'colony']
        }],
        relationships: [
          { kind: 'contained_by', src: 'will-be-assigned-0', dst: iceberg.id }
        ],
        description: `New colony founded on ${iceberg.name}`
      };
    }
  },
  {
    id: 'anomaly_manifestation',
    name: 'Anomaly Appears',
    canApply: (graph) => {
      const magic = graph.pressures.get('magical_instability') || 0;
      return magic > 30 || Math.random() > 0.8;
    },
    findTargets: (graph) => findEntities(graph, { kind: 'location' }),
    expand: (graph) => {
      return {
        entities: [{
          kind: 'location',
          subtype: 'anomaly',
          name: `${pickRandom(['Shimmering', 'Frozen', 'Dark'])} ${pickRandom(['Rift', 'Vortex', 'Echo'])}`,
          description: 'A mysterious phenomenon appears',
          status: 'unspoiled',
          prominence: 'recognized',
          tags: ['anomaly', 'mysterious']
        }],
        relationships: [],
        description: 'Strange anomaly manifests'
      };
    }
  }
];

// Combine all templates
export const additionalTemplates: GrowthTemplate[] = [
  ...rulesTemplates,
  ...abilitiesTemplates,
  ...locationTemplates
];
