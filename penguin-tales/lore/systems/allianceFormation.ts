import { TemplateGraphView } from '@lore-weave/core';
import { SimulationSystem, SystemResult, ComponentPurpose } from '@lore-weave/core';
import { Relationship } from '@lore-weave/core';
import { rollProbability } from '@lore-weave/core';

/**
 * Alliance Formation System
 *
 * Factions with common enemies form strategic alliances.
 * Increases stability pressure when alliances form.
 */
export const allianceFormation: SimulationSystem = {
  id: 'alliance_formation',
  name: 'Strategic Alliances',

  contract: {
    purpose: ComponentPurpose.RELATIONSHIP_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'faction', min: 3 }
      ]
    },
    affects: {
      relationships: [
        { kind: 'allied_with', operation: 'create', count: { min: 0, max: 10 } }
      ],
      pressures: [
        { name: 'stability', delta: 5 }
      ]
    }
  },

  metadata: {
    produces: {
      relationships: [
        { kind: 'allied_with', category: 'political', frequency: 'uncommon', comment: 'Factions with common enemies ally' },
      ],
      modifications: [],
    },
    effects: {
      graphDensity: 0.4,
      clusterFormation: 0.6,
      diversityImpact: 0.3,
      comment: 'Forms political alliances between factions sharing enemies',
    },
    parameters: {
      allianceBaseChance: {
        value: 0.5,
        min: 0.1,
        max: 0.9,
        description: 'Probability of alliance when common enemies exist',
      },
    },
    triggers: {
      graphConditions: ['Common enemies', 'Faction count >= 3'],
      comment: 'Requires factions with at_war_with relationships',
    },
  },

  apply: (graphView: TemplateGraphView, modifier: number = 1.0): SystemResult => {
    const params = allianceFormation.metadata?.parameters || {};
    const allianceBaseChance = params.allianceBaseChance?.value ?? 0.5;

    const relationships: Relationship[] = [];
    const factions = graphView.findEntities({ kind: 'faction' });

    factions.forEach((faction, i) => {
      factions.slice(i + 1).forEach(otherFaction => {
        // Check for common enemies (only strong/active wars count)
        const factionEnemies = graphView.getRelated(faction.id, 'at_war_with', 'src', { minStrength: 0.5 });
        const otherEnemies = graphView.getRelated(otherFaction.id, 'at_war_with', 'src', { minStrength: 0.5 });

        const commonEnemies = factionEnemies.filter(e =>
          otherEnemies.some(oe => oe.id === e.id)
        );

        // Common enemies drive alliances
        if (commonEnemies.length > 0 && rollProbability(allianceBaseChance, modifier)) {
          if (!graphView.hasRelationship(faction.id, otherFaction.id, 'allied_with')) {
            relationships.push({
              kind: 'allied_with',
              src: faction.id,
              dst: otherFaction.id
            });
          }
        }
      });
    });

    return {
      relationshipsAdded: relationships,
      entitiesModified: [],
      pressureChanges: relationships.length > 0 ? { 'stability': 5 } : {},
      description: `${relationships.length} new alliances formed`
    };
  }
};
