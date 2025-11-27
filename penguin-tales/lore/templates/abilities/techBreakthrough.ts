import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core/types/engine';
import { TemplateGraphView } from '@lore-weave/core/services/templateGraphView';
import { HardState, Relationship } from '@lore-weave/core/types/worldTypes';
import { generateId } from '@lore-weave/core/utils/helpers';

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

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'faction', min: 1 }  // Need factions that control locations
      ]
    },
    affects: {
      entities: [
        { kind: 'abilities', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'practitioner_of', operation: 'create', count: { min: 1, max: 2 } },
        { kind: 'originated_in', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'derived_from', operation: 'create', count: { min: 0, max: 1 } }  // Lineage
      ]
    }
  },

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
        { kind: 'practitioner_of', category: 'institutional', probability: 1.0, comment: 'Faction adopts new tech' },
        { kind: 'originated_in', category: 'immutable_fact', probability: 1.0, comment: 'Tech originated at location' },
        { kind: 'derived_from', category: 'immutable_fact', probability: 0.8, comment: 'Tech lineage from existing tech' }
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

  canApply(graphView: TemplateGraphView): boolean {
    // Need active factions with locations (innovation requires resources)
    // FIXED: Don't filter by status='active' - use any faction
    const factions = graphView.findEntities({ kind: 'faction' });

    if (factions.length === 0) return false;

    // Check if any faction controls a location (has resources to innovate)
    return factions.some(faction =>
      graphView.getAllRelationships().some(r =>
        r.kind === 'controls' && r.src === faction.id
      )
    );
  },

  findTargets(graphView: TemplateGraphView): HardState[] {
    // Return factions that control locations
    // FIXED: Don't filter by status='active' - use any faction
    const factions = graphView.findEntities({ kind: 'faction' });

    return factions.filter(faction =>
      graphView.getAllRelationships().some(r =>
        r.kind === 'controls' && r.src === faction.id
      )
    );
  },

  expand(graphView: TemplateGraphView, target?: HardState): TemplateResult {
    if (!target || target.kind !== 'faction') {
      return {
        entities: [],
        relationships: [],
        description: 'No valid faction target'
      };
    }

    // Find location where tech is developed (faction stronghold or controlled location)
    const controlledLocations = graphView.getAllRelationships()
      .filter(r => r.kind === 'controls' && r.src === target.id)
      .map(r => graphView.getEntity(r.dst))
      .filter((e): e is HardState => !!e);

    if (controlledLocations.length === 0) {
      return {
        entities: [],
        relationships: [],
        description: `${target.name} controls no locations for innovation`
      };
    }

    const originLocation = controlledLocations[Math.floor(Math.random() * controlledLocations.length)];

    // Find existing technologies to establish lineage
    const existingTech = graphView.findEntities({ kind: 'abilities', subtype: 'technology' })
      .filter(t => t.status === 'active');

    // Find most related tech (same faction's tech, or any tech at same location)
    let parentTech: HardState | undefined;
    if (existingTech.length > 0) {
      // Prefer tech from same faction
      const factionTech = existingTech.filter(tech =>
        graphView.getAllRelationships().some(r =>
          r.kind === 'practitioner_of' && r.src === target.id && r.dst === tech.id
        )
      );

      if (factionTech.length > 0) {
        parentTech = factionTech[Math.floor(Math.random() * factionTech.length)];
      } else {
        // Otherwise, link to any existing tech
        parentTech = existingTech[Math.floor(Math.random() * existingTech.length)];
      }
    }

    // Find catalyst (leader if exists, otherwise faction)
    const leaders = graphView.getRelatedEntities( target.id, 'leader_of', 'dst');
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

    // Derive coordinates - reference the faction and origin location
    const referenceEntities = [target, originLocation];
    if (parentTech) {
      referenceEntities.push(parentTech);
    }

    const conceptualCoords = graphView.deriveCoordinates(
      referenceEntities,
      'abilities',
      'physical',
      { maxDistance: parentTech ? 0.3 : 0.5, minDistance: 0.1 }
    );

    if (!conceptualCoords) {
      throw new Error(
        `tech_breakthrough: Failed to derive coordinates for technology developed by ${target.name}. ` +
        `This indicates the coordinate system is not properly configured for 'abilities' entities.`
      );
    }

    const newTech: Partial<HardState> = {
      kind: 'abilities',
      subtype: 'technology',
      name: techName,
      description: `A ${techDesc} developed by ${target.name} at ${originLocation.name}`,
      status: 'active',
      prominence: 'recognized',
      culture: target.culture,  // Inherit culture from developing faction
      tags: { technology: true, innovation: true, [target.subtype]: true },
      coordinates: { physical: conceptualCoords },
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

    // Add lineage relationship to parent tech with incremental distance (0.1-0.3)
    if (parentTech) {
      relationships.push({
        kind: 'derived_from',
        src: techId,
        dst: parentTech.id,
        distance: 0.1 + Math.random() * 0.2,  // Incremental innovation
        strength: 0.6
      });
    }

    const lineageDesc = parentTech ? ` building on ${parentTech.name}` : '';
    return {
      entities: [newTech],
      relationships,
      description: `${catalyst.name} develops ${techName} for ${target.name} at ${originLocation.name}${lineageDesc}`
    };
  }
};
