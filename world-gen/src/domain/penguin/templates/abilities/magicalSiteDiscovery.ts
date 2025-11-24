import { GrowthTemplate, TemplateResult, ComponentPurpose } from '../../../../types/engine';
import { TemplateGraphView } from '../../../../services/templateGraphView';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { generateId } from '../../../../utils/helpers';

/**
 * Magical Site Discovery Template
 *
 * World-level template: Discovers locations with magical properties.
 * Creates location (anomaly) + manifests_at relationship with catalyst attribution.
 *
 * Pattern: Practitioner NPC discovers → New magical location + manifestation
 * Result: Expands magical landscape, not NPC count
 */
export const magicalSiteDiscovery: GrowthTemplate = {
  id: 'magical_site_discovery',
  name: 'Magical Site Discovery',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'abilities', min: 1 }  // Need magical abilities with practitioners
      ]
    },
    affects: {
      entities: [
        { kind: 'location', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'manifests_at', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'discovered_by', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'adjacent_to', operation: 'create', count: { min: 0, max: 2 } }  // May create adjacent_to relationships
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'location',
          subtype: 'anomaly',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'recognized', probability: 1.0 }]
        }
      ],
      relationships: [
        { kind: 'manifests_at', category: 'magical', probability: 1.0, comment: 'Magic manifests at discovered location' },
        { kind: 'discovered_by', category: 'attribution', probability: 1.0, comment: 'Practitioner discovers site' }
      ]
    },
    effects: {
      graphDensity: 0.4,
      clusterFormation: 0.5,
      diversityImpact: 0.7,
      comment: 'Expands magical landscape with new anomaly locations'
    },
    parameters: {
      discoveryRate: {
        value: 0.4,
        min: 0.1,
        max: 0.8,
        description: 'How frequently practitioners discover new magical sites'
      },
      anomalyProminence: {
        value: 0.7,
        min: 0.3,
        max: 1.0,
        description: 'Starting prominence level for discovered anomalies (0.3=marginal, 1.0=renowned)'
      },
      practitionerBonus: {
        value: 0.2,
        min: 0.0,
        max: 0.5,
        description: 'Influence bonus for practitioner who discovers site'
      }
    },
    tags: ['world-level', 'magical', 'discovery']
  },

  canApply(graphView: TemplateGraphView): boolean {
    // Need magical abilities and practitioners
    // FIXED: Don't filter by status='active' - accept any status
    const magicalAbilities = graphView.findEntities({
      kind: 'abilities',
      subtype: 'magic'
    });

    if (magicalAbilities.length === 0) return false;

    // Check for practitioners
    const hasPractitioners = magicalAbilities.some(ability =>
      graphView.getAllRelationships().some(r =>
        r.kind === 'practitioner_of' && r.dst === ability.id
      )
    );

    return hasPractitioners;
  },

  findTargets(graphView: TemplateGraphView): HardState[] {
    // Return magical abilities with practitioners
    // FIXED: Don't filter by status='active' - accept any status
    const magicalAbilities = graphView.findEntities({
      kind: 'abilities',
      subtype: 'magic'
    });

    return magicalAbilities.filter(ability =>
      graphView.getAllRelationships().some(r =>
        r.kind === 'practitioner_of' && r.dst === ability.id
      )
    );
  },

  expand(graphView: TemplateGraphView, target?: HardState): TemplateResult {
    if (!target || target.kind !== 'abilities' || target.subtype !== 'magic') {
      return {
        entities: [],
        relationships: [],
        description: 'No valid magical ability target'
      };
    }

    // Find a practitioner to be the catalyst
    const practitioners = graphView.getAllRelationships()
      .filter(r => r.kind === 'practitioner_of' && r.dst === target.id)
      .map(r => graphView.getEntity(r.src))
      .filter((e): e is HardState => !!e);

    if (practitioners.length === 0) {
      return {
        entities: [],
        relationships: [],
        description: `${target.name} has no practitioners to discover sites`
      };
    }

    const catalyst = practitioners[Math.floor(Math.random() * practitioners.length)];

    // Create new magical anomaly location
    const locationId = 'will-be-assigned-0';
    const locationNames = [
      'The Shimmering Chasm',
      'Frost-Light Grotto',
      'The Whispering Ice',
      'Ethereal Shelf',
      'The Glowing Depths',
      'Mystic Ice Cavern',
      'The Frozen Aurora',
      'Spectral Basin'
    ];

    const newLocation: Partial<HardState> = {
      kind: 'location',
      subtype: 'anomaly',
      name: locationNames[Math.floor(Math.random() * locationNames.length)],
      description: `A mystical site where ${target.name} manifests with unusual intensity`,
      status: 'thriving',
      prominence: 'recognized',
      tags: ['anomaly', 'magical', target.name.toLowerCase().split(' ')[0]],
      links: []
    };

    // Create relationships
    const relationships: Relationship[] = [
      {
        kind: 'manifests_at',
        src: target.id,
        dst: locationId,
        strength: 0.8,
        catalyzedBy: catalyst.id
      },
      {
        kind: 'discovered_by',
        src: locationId,
        dst: catalyst.id,
        strength: 1.0
      }
    ];

    return {
      entities: [newLocation],
      relationships,
      description: `${catalyst.name} discovers ${newLocation.name}, where ${target.name} manifests`
    };
  }
};
