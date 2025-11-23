import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { pickRandom, findEntities } from '../../utils/helpers';

/**
 * Orca Combat Technique Template
 *
 * Orcas arrive with terrifying combat abilities that penguin defenders must face.
 * Creates offensive abilities linked to orca practitioners.
 */
export const orcaCombatTechnique: GrowthTemplate = {
  id: 'orca_combat_technique',
  name: 'Orca Combat Technique',

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'abilities',
          subtype: 'combat',
          count: { min: 1, max: 1 },
          prominence: [
            { level: 'recognized', probability: 0.6 },
            { level: 'renowned', probability: 0.4 }
          ],
        },
      ],
      relationships: [
        { kind: 'practitioner_of', category: 'cultural', probability: 1.0, comment: 'Orcas practice technique' },
      ],
    },
    effects: {
      graphDensity: 0.2,
      clusterFormation: 0.3,
      diversityImpact: 0.7,
      comment: 'Creates fearsome orca combat techniques',
    },
    tags: ['combat', 'external-threat', 'ability-creation'],
  },

  canApply: (graph: Graph) => {
    // Only apply if orcas exist in the world
    const orcas = findEntities(graph, { kind: 'npc', subtype: 'orca' });
    return orcas.length > 0;
  },

  findTargets: (graph: Graph) => {
    // Target orcas to give them abilities
    return findEntities(graph, { kind: 'npc', subtype: 'orca' });
  },

  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const orca = target || pickRandom(findEntities(graph, { kind: 'npc', subtype: 'orca' }));

    if (!orca) {
      return {
        entities: [],
        relationships: [],
        description: 'Cannot create orca technique - no orcas exist'
      };
    }

    // Orca combat technique names
    const techniqueNames = [
      'Crushing Dive',
      'Sonic Stun',
      'Pack Coordination',
      'Echolocation Strike',
      'Tail Slam',
      'Ice Breaker Rush',
      'Deep Ambush',
      'Thermal Shock'
    ];

    const techniqueName = pickRandom(techniqueNames);
    const prominence = Math.random() < 0.4 ? 'renowned' : 'recognized';

    const technique: Partial<HardState> = {
      kind: 'abilities',
      subtype: 'combat',
      name: techniqueName,
      description: `A devastating combat technique used by orca raiders, witnessed when ${orca.name} attacked`,
      status: 'active',
      prominence,
      tags: ['combat', 'orca', 'offensive', 'external']
    };

    const relationships: Relationship[] = [
      {
        kind: 'practitioner_of',
        src: orca.id,
        dst: 'will-be-assigned-0'
      }
    ];

    // Other orcas might also practice this technique
    const otherOrcas = findEntities(graph, { kind: 'npc', subtype: 'orca' })
      .filter(o => o.id !== orca.id);

    if (otherOrcas.length > 0 && Math.random() < 0.6) {
      const practitioner = pickRandom(otherOrcas);
      relationships.push({
        kind: 'practitioner_of',
        src: practitioner.id,
        dst: 'will-be-assigned-0'
      });
    }

    return {
      entities: [technique],
      relationships,
      description: `Orcas demonstrate the fearsome technique: ${techniqueName}`
    };
  }
};
