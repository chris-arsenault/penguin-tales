import { GrowthTemplate, TemplateResult, ComponentPurpose } from '../../../../types/engine';
import { TemplateGraphView } from '../../../../services/templateGraphView';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { pickRandom } from '../../../../utils/helpers';

/**
 * Colony Founding Template
 *
 * New colonies are established on icebergs as population expands.
 * Limited to 5 colonies maximum to prevent overcrowding.
 */
export const colonyFounding: GrowthTemplate = {
  id: 'colony_founding',
  name: 'Colony Foundation',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'location', min: 1 },  // Requires iceberg
        { kind: 'npc', min: 20 }       // Population threshold
      ]
    },
    affects: {
      entities: [
        { kind: 'location', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'contained_by', operation: 'create', count: { min: 1, max: 2 } }  // FIXED: May create adjacent_to relationships too
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'location',
          subtype: 'colony',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'contained_by', category: 'spatial', probability: 1.0, comment: 'Colony on iceberg' },
      ],
    },
    effects: {
      graphDensity: 0.1,
      clusterFormation: 0.3,
      diversityImpact: 0.3,
      comment: 'Adds new colony nodes for population expansion',
    },
    tags: ['expansion', 'colony-formation'],
  },

  canApply: (graphView: TemplateGraphView) => {
    const colonies = graphView.findEntities({ kind: 'location', subtype: 'colony' });
    return colonies.length < 5 && graphView.getEntityCount() > 20;
  },
  
  findTargets: (graphView: TemplateGraphView) => graphView.findEntities({ kind: 'location', subtype: 'iceberg' }),
  
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const iceberg = target || pickRandom(graphView.findEntities({ kind: 'location', subtype: 'iceberg' }));

    // Determine culture based on existing colonies on this iceberg
    // or from the majority culture of nearby colonies
    const existingColonies = graphView.findEntities({ kind: 'location', subtype: 'colony' });
    const colonyOnIceberg = existingColonies.find(c =>
      graphView.hasRelationship(c.id, iceberg.id, 'contained_by')
    );
    const culture = colonyOnIceberg?.culture || 'aurora-stack';  // Inherit from existing colony or default to aurora-stack

    return {
      entities: [{
        kind: 'location',
        subtype: 'colony',
        name: `${pickRandom(['North', 'South', 'East', 'West'])} ${pickRandom(['Haven', 'Roost', 'Perch'])}`,
        description: `New colony established on ${iceberg.name}`,
        status: 'thriving',
        prominence: 'marginal',
        culture,  // Inherit culture from nearby colony or null for new cultural territory
        tags: ['new', 'colony']
      }],
      relationships: [
        { kind: 'contained_by', src: 'will-be-assigned-0', dst: iceberg.id }
      ],
      description: `New colony founded on ${iceberg.name}`
    };
  }
};
