import { GrowthTemplate, TemplateResult } from '@lore-weave/core/types/engine';
import { TemplateGraphView } from '@lore-weave/core/graph/templateGraphView';
import { HardState, Relationship } from '@lore-weave/core/types/worldTypes';
import { pickRandom } from '@lore-weave/core/utils/helpers';

export const outlawRecruitment: GrowthTemplate = {
  id: 'outlaw_recruitment',
  name: 'Criminal Recruitment',

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'npc',
          subtype: 'outlaw',
          count: { min: 1, max: 2 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'member_of', category: 'political', probability: 2.0, comment: '1-2 outlaws join faction' },
        { kind: 'resident_of', category: 'spatial', probability: 2.0, comment: 'Outlaws reside in stronghold/colony' },
      ],
    },
    effects: {
      graphDensity: 0.5,
      clusterFormation: 0.7,
      diversityImpact: 0.3,
      comment: 'Expands criminal faction clusters',
    },
    parameters: {
      numOutlawsMin: {
        value: 1,
        min: 1,
        max: 4,
        description: 'Minimum number of outlaws recruited',
      },
      numOutlawsMax: {
        value: 2,
        min: 2,
        max: 10,
        description: 'Maximum number of outlaws recruited',
      },
    },
    tags: ['criminal', 'faction-expansion'],
  },

  canApply: (graphView: TemplateGraphView) => {
    const criminalFactions = graphView.getEntityCount('faction', 'criminal');
    return criminalFactions > 0;
  },

  findTargets: (graphView: TemplateGraphView) => {
    return graphView.findEntities({ kind: 'faction', subtype: 'criminal' });
  },

  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const faction = target || pickRandom(graphView.findEntities({ kind: 'faction', subtype: 'criminal' }));

    if (!faction) {
      return {
        entities: [],
        relationships: [],
        description: 'Cannot recruit outlaws - no criminal factions exist'
      };
    }

    // Extract parameters from metadata
    const params = outlawRecruitment.metadata?.parameters || {};
    const numOutlawsMin = params.numOutlawsMin?.value ?? 1;
    const numOutlawsMax = params.numOutlawsMax?.value ?? 2;

    const numOutlaws = Math.floor(Math.random() * (numOutlawsMax - numOutlawsMin + 1)) + numOutlawsMin;

    // Use targetSelector to find existing NPCs or create new outlaws
    const result = graphView.selectTargets('npc', numOutlaws, {
      prefer: {
        subtypes: ['merchant', 'hero'], // People turning to crime
        preferenceBoost: 1.5
      },
      avoid: {
        relationshipKinds: ['member_of'], // Prefer NPCs not already in factions
        hubPenaltyStrength: 2.0,
        maxTotalRelationships: 12
      },
      createIfSaturated: {
        threshold: 0.2,
        factory: (gv, ctx) => ({
          kind: 'npc',
          subtype: 'outlaw',
          description: `A shady character working for ${faction.name}`,
          status: 'alive',
          prominence: 'marginal',
          culture: faction.culture,  // Inherit culture from recruiting faction
          tags: { criminal: true, recruit: true }
        }),
        maxCreated: Math.ceil(numOutlaws * 0.7) // Max 70% new
      },
      diversityTracking: {
        trackingId: 'outlaw_recruitment',
        strength: 1.5
      }
    });

    const recruitedNpcs = result.existing;
    const newOutlaws = result.created;

    // Find faction stronghold or any colony
    const controlled = graphView.getRelatedEntities(faction.id, 'controls', 'src');
    let location = controlled.length > 0 ? controlled[0] : undefined;

    // Fallback: if faction has no stronghold, use any colony
    if (!location) {
      const colonies = graphView.findEntities({ kind: 'location', subtype: 'colony' });
      location = colonies.length > 0 ? pickRandom(colonies) : undefined;
    }

    // If still no location, fail gracefully
    if (!location) {
      return {
        entities: [],
        relationships: [],
        description: `${faction.name} has nowhere to recruit outlaws`
      };
    }

    const relationships: Relationship[] = [];

    // Add relationships for recruited existing NPCs
    recruitedNpcs.forEach(npc => {
      relationships.push(
        { kind: 'member_of', src: npc.id, dst: faction.id },
        { kind: 'resident_of', src: npc.id, dst: location.id }
      );
    });

    // Add relationships for newly created outlaws
    newOutlaws.forEach((_, i) => {
      relationships.push(
        { kind: 'member_of', src: `will-be-assigned-${i}`, dst: faction.id },
        { kind: 'resident_of', src: `will-be-assigned-${i}`, dst: location.id }
      );
    });

    const totalRecruits = recruitedNpcs.length + newOutlaws.length;
    const creationNote = newOutlaws.length > 0
      ? ` (${newOutlaws.length} new outlaws created)`
      : '';

    return {
      entities: newOutlaws,
      relationships,
      description: `${faction.name} recruits ${totalRecruits} new members${creationNote}`
    };
  }
};
