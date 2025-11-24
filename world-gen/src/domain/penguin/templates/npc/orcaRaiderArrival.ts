import { GrowthTemplate, TemplateResult, ComponentPurpose } from '../../../../types/engine';
import { TemplateGraphView } from '../../../../services/templateGraphView';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { pickRandom, pickMultiple } from '../../../../utils/helpers';

export const orcaRaiderArrival: GrowthTemplate = {
  id: 'orca_raider_arrival',
  name: 'Orca Raiders Arrive',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      pressures: [
        { name: 'external_threat', threshold: 0 }  // Can trigger anytime (creates threat)
      ],
      era: ['invasion']
    },
    affects: {
      entities: [
        { kind: 'npc', operation: 'create', count: { min: 1, max: 2 } }
      ],
      relationships: [
        { kind: 'enemy_of', operation: 'create', count: { min: 1, max: 4 } },
        { kind: 'practitioner_of', operation: 'create', count: { min: 0, max: 2 } },
        { kind: 'inspired_by', operation: 'create', count: { min: 0, max: 1 } }  // Lineage (orca to orca)
      ],
      pressures: [
        { name: 'external_threat', delta: 10 },  // Orcas massively increase threat
        { name: 'conflict', delta: 5 }
      ],
      tags: [
        { operation: 'add', pattern: 'external' },
        { operation: 'add', pattern: 'invader' }
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'npc',
          subtype: 'orca',
          count: { min: 1, max: 2 },
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

  canApply: (graphView: TemplateGraphView) => {
    // Pressure-based trigger
    const externalThreat = graphView.getPressure('external_threat') || 0;
    const invasionEra = graphView.currentEra.id === 'invasion';

    if (!invasionEra && externalThreat < 70) {
      return false;
    }

    // SATURATION LIMIT: Check if orca count is at or above threshold
    const existingOrcas = graphView.getEntityCount('npc', 'orca');
    const targets = graphView.config.distributionTargets as any;
    const target = targets?.entities?.npc?.orca?.target || 5;
    const saturationThreshold = target * 1.5; // Allow 50% overshoot

    if (existingOrcas >= saturationThreshold) {
      return false; // Too many orcas, suppress creation
    }

    return true;
  },

  findTargets: (graphView: TemplateGraphView) => {
    // Target any colony that orcas could threaten
    const colonies = graphView.findEntities({ kind: 'location', subtype: 'colony' });
    return colonies;
  },

  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const colony = target || pickRandom(
      graphView.findEntities({ kind: 'location', subtype: 'colony' })
    );

    if (!colony) {
      return {
        entities: [],
        relationships: [],
        description: 'Cannot spawn orca raiders - no colonies exist'
      };
    }

    // Create 1-2 orca raiders
    const raiderCount = 1 + Math.floor(Math.random() * 2); // 1-2
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
    const heroes = graphView.findEntities({ kind: 'npc', subtype: 'hero' });
    const mayors = graphView.findEntities({ kind: 'npc', subtype: 'mayor' });
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
    const factions = graphView.findEntities({ kind: 'faction' });
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
    const combatAbilities = graphView.findEntities({ kind: 'abilities' })
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
