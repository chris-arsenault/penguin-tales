import { GrowthTemplate, TemplateResult, Graph } from '../../../../types/engine';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { generateName, pickRandom, pickMultiple, findEntities } from '../../../../utils/helpers';

export const orcaRaiderArrival: GrowthTemplate = {
  id: 'orca_raider_arrival',
  name: 'Orca Raiders Arrive',

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'npc',
          subtype: 'orca',
          count: { min: 2, max: 4 },
          prominence: [
            { level: 'marginal', probability: 0.6 },
            { level: 'recognized', probability: 0.3 },
            { level: 'renowned', probability: 0.1 }
          ],
        },
      ],
      relationships: [
        { kind: 'enemy_of', category: 'conflict', probability: 0.9, comment: 'Orcas vs colonies and heroes' },
        { kind: 'practitioner_of', category: 'cultural', probability: 0.7, comment: 'Orcas use abilities' },
      ],
    },
    effects: {
      graphDensity: 0.4,
      clusterFormation: 0.2,
      diversityImpact: 0.8,
      comment: 'Injects external threat cluster into the world',
    },
    tags: ['external-threat', 'invasion', 'cluster'],
  },

  canApply: (graph: Graph) => {
    const externalThreat = graph.pressures.get('external_threat') || 0;
    const invasionEra = graph.currentEra.id === 'invasion';

    // Only apply if invasion era OR very high external threat
    return invasionEra || externalThreat > 70;
  },

  findTargets: (graph: Graph) => {
    // Target any colony that orcas could threaten
    const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
    return colonies;
  },

  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const colony = target || pickRandom(
      findEntities(graph, { kind: 'location', subtype: 'colony' })
    );

    if (!colony) {
      return {
        entities: [],
        relationships: [],
        description: 'Cannot spawn orca raiders - no colonies exist'
      };
    }

    // Create 2-4 orca raiders
    const raiderCount = 2 + Math.floor(Math.random() * 3); // 2-4
    const orcas: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    // Orca name patterns
    const orcaNames = [
      'Blackfin', 'Razortooth', 'Deepdive', 'Sharpfin', 'Coldwater',
      'Riptide', 'Icebane', 'Frostbite', 'Shadowcrest', 'Tidehunter'
    ];

    for (let i = 0; i < raiderCount; i++) {
      const prominence = Math.random() < 0.1 ? 'renowned'
                       : Math.random() < 0.3 ? 'recognized'
                       : 'marginal';

      const orcaName = pickRandom(orcaNames);

      const orca: Partial<HardState> = {
        kind: 'npc',
        subtype: 'orca',
        name: orcaName,
        description: `A fearsome orca raider threatening ${colony.name}`,
        status: 'alive',
        prominence,
        tags: ['orca', 'raider', 'external-threat', 'predator']
      };

      orcas.push(orca);
    }

    // Find heroes and leaders to oppose the orcas
    const heroes = findEntities(graph, { kind: 'npc', subtype: 'hero' });
    const mayors = findEntities(graph, { kind: 'npc', subtype: 'mayor' });
    const defenders = [...heroes, ...mayors];

    if (defenders.length > 0) {
      const defendingPenguins = pickMultiple(defenders, Math.min(raiderCount + 1, defenders.length));

      for (let i = 0; i < raiderCount && i < defendingPenguins.length; i++) {
        relationships.push({
          kind: 'enemy_of',
          src: `will-be-assigned-${i}`,
          dst: defendingPenguins[i].id
        });
      }
    }

    // Orcas might also be enemies of factions in the colony
    const factions = findEntities(graph, { kind: 'faction' });
    if (factions.length > 0 && Math.random() < 0.5) {
      const targetFaction = pickRandom(factions);
      const randomOrca = Math.floor(Math.random() * raiderCount);
      relationships.push({
        kind: 'enemy_of',
        src: `will-be-assigned-${randomOrca}`,
        dst: targetFaction.id
      });
    }

    // Give orcas combat abilities
    const combatAbilities = findEntities(graph, { kind: 'abilities' })
      .filter(a => a.tags.includes('combat') || a.tags.includes('offensive'));

    if (combatAbilities.length > 0) {
      const ability = pickRandom(combatAbilities);
      for (let i = 0; i < raiderCount; i++) {
        if (Math.random() < 0.7) {
          relationships.push({
            kind: 'practitioner_of',
            src: `will-be-assigned-${i}`,
            dst: ability.id
          });
        }
      }
    }

    const description = raiderCount === 1
      ? `An orca raider appears near ${colony.name}, threatening the colony`
      : `A pod of ${raiderCount} orca raiders threatens ${colony.name}`;

    return {
      entities: orcas,
      relationships,
      description
    };
  }
};
