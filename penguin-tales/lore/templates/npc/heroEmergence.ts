import { GrowthTemplate, TemplateResult, ComponentPurpose } from '../../../../apps/lore-weave/lib/types/engine';
import { TemplateGraphView } from '../../../../apps/lore-weave/lib/services/templateGraphView';
import { HardState, Relationship } from '../../../../apps/lore-weave/lib/types/worldTypes';
import { generateName, pickRandom, slugifyName } from '../../../../apps/lore-weave/lib/utils/helpers';
import { initializeCatalystSmart } from '../../../../apps/lore-weave/lib/utils/catalystHelpers';
import { EntityClusterBuilder } from '../../../../apps/lore-weave/lib/utils/entityClusterBuilder';

export const heroEmergence: GrowthTemplate = {
  id: 'hero_emergence',
  name: 'Hero Rises',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      pressures: [
        { name: 'conflict', threshold: 5 },  // FIXED: Lowered from 10 to 5 (conflict can be as low as 8.1)
        { name: 'external_threat', threshold: 5 }  // FIXED: Lowered from 10 to 5
      ]
    },
    affects: {
      entities: [
        { kind: 'npc', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'practitioner_of', operation: 'create', count: { min: 0, max: 1 } },
        { kind: 'resident_of', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'inspired_by', operation: 'create', count: { min: 0, max: 1 } }  // Lineage
      ],
      pressures: [
        { name: 'conflict', delta: -2 }  // Heroes reduce conflict
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'npc',
          subtype: 'hero',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'practitioner_of', category: 'cultural', probability: 0.8, comment: 'If abilities exist' },
        { kind: 'resident_of', category: 'spatial', probability: 1.0, comment: 'Hero lives in colony' },
      ],
    },
    effects: {
      graphDensity: 0.2,
      clusterFormation: 0.3,
      diversityImpact: 0.5,
      comment: 'Creates individual heroes with potential for ability practice',
    },
    tags: ['crisis-driven', 'individual'],
  },

  canApply: (graphView: TemplateGraphView) => {
    // Pressure-based trigger: need moderate conflict to spawn heroes
    const conflictPressure = graphView.getPressure('conflict') || 0;
    if (conflictPressure < 5 && graphView.getEntityCount() <= 20) {  // FIXED: Lowered from 10 to 5
      return false;
    }

    // BIDIRECTIONAL PRESSURE THRESHOLD: TOO much conflict suppresses hero creation
    // (Extreme chaos prevents training, heroes get killed before emerging)
    if (conflictPressure > 80) {
      return Math.random() < 0.3; // Only 30% chance when conflict is extreme
    }

    // SATURATION LIMIT: Check if hero count is at or above threshold
    const existingHeroes = graphView.getEntityCount('npc', 'hero');
    const targets = graphView.config.distributionTargets as any;
    const target = targets?.entities?.npc?.hero?.target || 20;
    const saturationThreshold = target * 1.5; // Allow 50% overshoot

    if (existingHeroes >= saturationThreshold) {
      return false; // Too many heroes, suppress creation
    }

    return true;
  },

  findTargets: (graphView: TemplateGraphView) => {
    const colonies = graphView.findEntities({ kind: 'location', subtype: 'colony' });
    return colonies.filter(c => c.status === 'thriving' || c.status === 'waning');
  },

  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const colony = target || pickRandom(
      graphView.findEntities({ kind: 'location', subtype: 'colony' })
    );

    if (!colony) {
      // No colony exists - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: 'Cannot create hero - no colonies exist'
      };
    }

    const hero: Partial<HardState> = {
      kind: 'npc',
      subtype: 'hero',
      name: generateName('hero'),
      description: `A brave penguin who emerged during troubled times in ${colony.name}`,
      status: 'alive',
      prominence: 'marginal', // Heroes start marginal, must earn prominence
      culture: colony.culture,  // Inherit culture from home colony
      tags: ['brave', 'emergent']
    };

    // Initialize catalyst - heroes start marginal but will gain prominence and become actors
    // Note: marginal heroes won't act yet, but system is ready when they become recognized
    const heroEntity = hero as HardState;
    heroEntity.id = 'temp'; // Temporary ID for initialization
    initializeCatalystSmart(heroEntity);

    // Use EntityClusterBuilder for cleaner relationship creation
    const cluster = new EntityClusterBuilder()
      .addEntity(hero)
      .relateToExisting(0, colony.id, 'resident_of');

    // Add ability practice relationship if abilities exist
    const abilities = graphView.findEntities({ kind: 'abilities' });
    if (abilities.length > 0) {
      cluster.relateToExisting(0, pickRandom(abilities).id, 'practitioner_of');
    }

    return cluster.buildWithDescription(`A new hero emerges in ${colony.name}`);
  }
};
