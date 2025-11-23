import { GrowthTemplate, TemplateResult, Graph } from '../../../../types/engine';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { generateId, findEntities, getRelated } from '../../../../utils/helpers';

/**
 * Tech Breakthrough Template
 *
 * World-level template: Factions develop new technologies.
 * Creates abilities (technology) + practitioner_of relationship with catalyst attribution.
 *
 * Pattern: Faction/NPC innovates → New technology + adoption
 * Result: Expands technological landscape, not NPC count
 */
export const techBreakthrough: GrowthTemplate = {
  id: 'tech_breakthrough',
  name: 'Technological Breakthrough',

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'abilities',
          subtype: 'technology',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'recognized', probability: 1.0 }]
        }
      ],
      relationships: [
        { kind: 'practitioner_of', category: 'structural', probability: 1.0, comment: 'Faction adopts new tech' },
        { kind: 'originated_in', category: 'immutable_fact', probability: 1.0, comment: 'Tech originated at location' }
      ]
    },
    effects: {
      graphDensity: 0.4,
      clusterFormation: 0.5,
      diversityImpact: 0.8,
      comment: 'Expands technological capabilities'
    },
    parameters: {
      innovationRate: {
        value: 0.5,
        min: 0.2,
        max: 0.9,
        description: 'How frequently technological breakthroughs occur'
      },
      factionAdoptionBonus: {
        value: 0.15,
        min: 0.0,
        max: 0.4,
        description: 'Influence bonus for factions that develop new tech'
      },
      spreadProbability: {
        value: 0.3,
        min: 0.1,
        max: 0.7,
        description: 'Probability that allied factions also adopt the tech'
      }
    },
    tags: ['world-level', 'technological', 'innovation']
  },

  canApply(graph: Graph): boolean {
    // Need active factions with locations (innovation requires resources)
    const factions = findEntities(graph, { kind: 'faction', status: 'active' });

    if (factions.length === 0) return false;

    // Check if any faction controls a location (has resources to innovate)
    return factions.some(faction =>
      graph.relationships.some(r =>
        r.kind === 'controls' && r.src === faction.id
      )
    );
  },

  findTargets(graph: Graph): HardState[] {
    // Return factions that control locations
    const factions = findEntities(graph, { kind: 'faction', status: 'active' });

    return factions.filter(faction =>
      graph.relationships.some(r =>
        r.kind === 'controls' && r.src === faction.id
      )
    );
  },

  expand(graph: Graph, target?: HardState): TemplateResult {
    if (!target || target.kind !== 'faction') {
      return {
        entities: [],
        relationships: [],
        description: 'No valid faction target'
      };
    }

    // Find location where tech is developed (faction stronghold or controlled location)
    const controlledLocations = graph.relationships
      .filter(r => r.kind === 'controls' && r.src === target.id)
      .map(r => graph.entities.get(r.dst))
      .filter((e): e is HardState => !!e);

    if (controlledLocations.length === 0) {
      return {
        entities: [],
        relationships: [],
        description: `${target.name} controls no locations for innovation`
      };
    }

    const originLocation = controlledLocations[Math.floor(Math.random() * controlledLocations.length)];

    // Find catalyst (leader if exists, otherwise faction)
    const leaders = getRelated(graph, target.id, 'leader_of', 'dst');
    const catalyst = leaders.length > 0 ? leaders[0] : target;

    // Create new technology
    const techId = 'will-be-assigned-0';
    const techNames = [
      'Advanced Ice Drilling',
      'Thermal Preservation Arrays',
      'Echo-Location Nets',
      'Frost-Hardened Tools',
      'Glacial Navigation System',
      'Ice-Melt Refinement',
      'Sonic Fish Herding',
      'Crystalline Storage Vaults'
    ];

    const techDescriptions = [
      'breakthrough in ice manipulation',
      'innovation in resource extraction',
      'advancement in navigation',
      'development in food preservation',
      'discovery in materials science'
    ];

    const techName = techNames[Math.floor(Math.random() * techNames.length)];
    const techDesc = techDescriptions[Math.floor(Math.random() * techDescriptions.length)];

    const newTech: Partial<HardState> = {
      kind: 'abilities',
      subtype: 'technology',
      name: techName,
      description: `A ${techDesc} developed by ${target.name} at ${originLocation.name}`,
      status: 'active',
      prominence: 'recognized',
      tags: ['technology', 'innovation', target.subtype],
      links: []
    };

    // Create relationships
    const relationships: Relationship[] = [
      {
        kind: 'practitioner_of',
        src: target.id,
        dst: techId,
        strength: 0.9,
        catalyzedBy: catalyst.id
      },
      {
        kind: 'originated_in',
        src: techId,
        dst: originLocation.id,
        strength: 0.7
      }
    ];

    // If catalyst is an NPC, they're also a practitioner
    if (catalyst.kind === 'npc') {
      relationships.push({
        kind: 'practitioner_of',
        src: catalyst.id,
        dst: techId,
        strength: 1.0
      });
    }

    return {
      entities: [newTech],
      relationships,
      description: `${catalyst.name} develops ${techName} for ${target.name} at ${originLocation.name}`
    };
  }
};
