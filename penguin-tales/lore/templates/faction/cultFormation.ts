import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core/types/engine';
import { TemplateGraphView } from '@lore-weave/core/graph/templateGraphView';
import { HardState, Relationship } from '@lore-weave/core/types/worldTypes';
import { pickRandom, findEntities } from '@lore-weave/core/utils/helpers';

/**
 * Cult Formation Template
 *
 * Mystical cults emerge near anomalies or where magic is present.
 * Creates cult faction, prophet leader, and 3 cultist followers.
 */
export const cultFormation: GrowthTemplate = {
  id: 'cult_formation',
  name: 'Cult Awakening',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'location', min: 1 }  // Needs anomalies OR general locations (checked in canApply)
      ],
      custom: (graphView) => {
        // Requires anomalies OR magic (checked in canApply)
        const anomalyCount = graphView.getEntityCount('location', 'anomaly');
        const magicCount = graphView.getEntityCount('abilities', 'magic');
        return (anomalyCount > 0 || magicCount > 0);
      }
    },
    affects: {
      entities: [
        { kind: 'faction', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'npc', operation: 'create', count: { min: 1, max: 2 } }  // FIXED: Prophet + up to 1 new cultist (maxCreated=ceil(1/2)=1)
      ],
      relationships: [
        { kind: 'occupies', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'leader_of', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'resident_of', operation: 'create', count: { min: 1, max: 4 } },  // Prophet + cultists
        { kind: 'member_of', operation: 'create', count: { min: 1, max: 3 } },
        { kind: 'seeks', operation: 'create', count: { min: 0, max: 1 } },
        { kind: 'practitioner_of', operation: 'create', count: { min: 0, max: 1 } }
      ],
      pressures: []
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'faction',
          subtype: 'cult',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
        {
          kind: 'npc',
          subtype: 'hero',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'occupies', category: 'spatial', probability: 1.0, comment: 'Cult occupies anomaly/location' },
        { kind: 'leader_of', category: 'political', probability: 1.0, comment: 'Prophet leads cult' },
        { kind: 'resident_of', category: 'spatial', probability: 4.0, comment: 'Prophet + 3 cultists reside' },
        { kind: 'member_of', category: 'political', probability: 3.0, comment: '3 cultists join' },
        { kind: 'seeks', category: 'cultural', probability: 0.8, comment: 'Cult seeks magic if exists' },
        { kind: 'practitioner_of', category: 'cultural', probability: 0.8, comment: 'Prophet practices magic if exists' },
      ],
    },
    effects: {
      graphDensity: 0.7,
      clusterFormation: 0.9,
      diversityImpact: 0.5,
      comment: 'Creates tight mystical clusters near anomalies',
    },
    parameters: {
      numCultists: {
        value: 1,               // Reduced from 3
        min: 1,                 // Reduced from 2
        max: 3,                 // Reduced from 8
        description: 'Number of initial cultist followers',
      },
    },
    tags: ['mystical', 'anomaly-driven', 'cluster-forming'],
  },

  canApply: (graphView: TemplateGraphView) => {
    // Prerequisite: anomalies or magic must exist
    const anomalyCount = graphView.getEntityCount('location', 'anomaly');
    const magicCount = graphView.getEntityCount('abilities', 'magic');
    if (anomalyCount === 0 && magicCount === 0) {
      return false;
    }

    // SATURATION LIMIT: Check if cult count is at or above threshold
    const existingCults = graphView.getEntityCount('faction', 'cult');
    const targets = graphView.config.distributionTargets as any;
    const target = targets?.entities?.faction?.cult?.target || 10;
    const saturationThreshold = target * 1.5; // Allow 50% overshoot (15 cults with target=10)

    if (existingCults >= saturationThreshold) {
      return false; // Too many cults, suppress creation
    }

    return true;
  },
  
  findTargets: (graphView: TemplateGraphView) => {
    const anomalies = graphView.findEntities({ kind: 'location', subtype: 'anomaly' });
    const nearbyLocations: HardState[] = [];

    anomalies.forEach(anomaly => {
      const adjacent = graphView.getRelatedEntities(anomaly.id, 'adjacent_to');
      nearbyLocations.push(...adjacent);
    });

    return [...anomalies, ...nearbyLocations];
  },
  
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    // Extract parameters from metadata
    const params = cultFormation.metadata?.parameters || {};
    const numCultists = params.numCultists?.value ?? 3;

    const location = target || pickRandom(graphView.findEntities({ kind: 'location' }));

    if (!location) {
      // No location exists - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: 'Cannot form cult - no locations exist'
      };
    }

    // Find existing cults to place new cult in conceptual space
    const existingCults = graphView.findEntities({ kind: 'faction', subtype: 'cult' });
    const nearbyMagic = graphView.findEntities({ kind: 'abilities', subtype: 'magic' });

    // Derive conceptual coordinates - place cult near location and any related magic
    const referenceEntities: HardState[] = [location];
    if (nearbyMagic.length > 0) {
      referenceEntities.push(pickRandom(nearbyMagic));
    }
    if (existingCults.length > 0) {
      // Place moderately far from existing cults (diverse mystical traditions)
      referenceEntities.push(pickRandom(existingCults));
    }

    const conceptualCoords = graphView.deriveCoordinates(
      referenceEntities,
      'faction',
      'physical',
      { maxDistance: existingCults.length > 0 ? 0.5 : 0.3, minDistance: 0.2 }  // Farther if other cults exist
    );

    if (!conceptualCoords) {
      throw new Error(
        `cult_formation: Failed to derive coordinates for cult near ${location.name}. ` +
        `This indicates the coordinate system is not properly configured for 'faction' entities.`
      );
    }

    const cult: Partial<HardState> = {
      kind: 'faction',
      subtype: 'cult',
      description: `A mystical cult drawn to the power near ${location.name}`,
      status: 'illegal',
      prominence: 'marginal',
      culture: location.culture,  // Inherit culture from location
      tags: { mystical: true, secretive: true, cult: true },
      coordinates: conceptualCoords
    };

    // Derive coordinates for prophet (NPC near cult location)
    const prophetCoords = graphView.deriveCoordinates(
      [location],
      'npc',
      'physical',
      { maxDistance: 0.2, minDistance: 0.05 }
    );

    if (!prophetCoords) {
      throw new Error(
        `cult_formation: Failed to derive coordinates for prophet near ${location.name}. ` +
        `This indicates the coordinate system is not properly configured for 'npc' entities.`
      );
    }

    const prophet: Partial<HardState> = {
      kind: 'npc',
      subtype: 'hero',
      description: `The enigmatic prophet of a mystical cult near ${location.name}`,
      status: 'alive',
      prominence: 'marginal', // Prophets start marginal
      culture: location.culture,  // Inherit culture from location
      tags: { prophet: true, mystical: true },
      coordinates: prophetCoords
    };

    // Pre-compute coordinates for potential new cultists (factory receives Graph, not TemplateGraphView)
    const newCultistCoords = graphView.deriveCoordinates(
      [location],
      'npc',
      'physical',
      { maxDistance: 0.3, minDistance: 0.1 }
    );

    if (!newCultistCoords) {
      throw new Error(
        `cult_formation: Failed to derive coordinates for potential new cultists near ${location.name}. ` +
        `This indicates the coordinate system is not properly configured for 'npc' entities.`
      );
    }

    // Use targetSelector to intelligently select cultists (prevents super-hubs)
    let cultists: HardState[] = [];
    let newCultists: Array<Partial<HardState>> = [];

    // Smart selection with hub penalties and cultural affinity
    const result = graphView.selectTargets('npc', numCultists, {
        prefer: {
          subtypes: ['merchant', 'outlaw', 'hero'],
          sameLocationAs: location.id, // Prefer local NPCs
          sameCultureAs: location.culture, // Prefer same-culture recruits
          preferenceBoost: 2.0
        },
        avoid: {
          relationshipKinds: ['member_of'], // Penalize multi-faction NPCs
          hubPenaltyStrength: 2.0, // Quadratic penalty: 1/(1+count^2)
          maxTotalRelationships: 15, // Hard cap on super-hubs
          differentCulturePenalty: 0.3 // Cross-culture recruitment is rare
        },
        createIfSaturated: {
          threshold: 0.15, // If best score < 0.15, create new NPC
          factory: () => ({
            kind: 'npc',
            subtype: pickRandom(['merchant', 'outlaw']),
            description: `A convert drawn to the cult's mystical teachings`,
            status: 'alive',
            prominence: 'marginal',
            culture: location.culture,  // Inherit culture from cult location
            tags: { cultist: true },
            coordinates: newCultistCoords
          }),
          maxCreated: Math.ceil(numCultists / 2) // Max 50% new NPCs
        },
        diversityTracking: {
          trackingId: 'cult_recruitment',
          strength: 1.5
        }
      });

    cultists = result.existing;
    newCultists = result.created;

    const relationships: Relationship[] = [
      { kind: 'occupies', src: 'will-be-assigned-0', dst: location.id },
      { kind: 'leader_of', src: 'will-be-assigned-1', dst: 'will-be-assigned-0' },
      { kind: 'resident_of', src: 'will-be-assigned-1', dst: location.id }
    ];

    // Add relationships for existing cultists
    cultists.forEach(cultist => {
      relationships.push({
        kind: 'member_of',
        src: cultist.id,
        dst: 'will-be-assigned-0'
      });
      relationships.push({
        kind: 'resident_of',
        src: cultist.id,
        dst: location.id
      });
    });

    // Add relationships for newly created cultists
    // Base index: 0=cult, 1=prophet, 2+ =new cultists
    newCultists.forEach((newCultist, index) => {
      const cultistPlaceholderId = `will-be-assigned-${2 + index}`;
      relationships.push({
        kind: 'member_of',
        src: cultistPlaceholderId,
        dst: 'will-be-assigned-0'
      });
      relationships.push({
        kind: 'resident_of',
        src: cultistPlaceholderId,
        dst: location.id
      });
    });

    const magicAbilities = graphView.findEntities({ kind: 'abilities', subtype: 'magic' });
    if (magicAbilities.length > 0) {
      const magic = magicAbilities[0];
      relationships.push({
        kind: 'seeks',
        src: 'will-be-assigned-0',
        dst: magic.id
      });
      relationships.push({
        kind: 'practitioner_of',
        src: 'will-be-assigned-1',
        dst: magic.id
      });
    }

    const totalCultists = cultists.length + newCultists.length;
    const creationNote = newCultists.length > 0
      ? ` (${newCultists.length} new converts recruited)`
      : '';

    return {
      entities: [cult, prophet, ...newCultists], // Include new cultists
      relationships,
      description: `A mystical cult forms near ${location.name} with ${totalCultists} followers${creationNote}`
    };
  }
};
