import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom, pickMultiple, hasTag } from '@lore-weave/core';

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
    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    // Find existing orcas to establish lineage
    const existingOrcas = graphView.findEntities({ kind: 'npc', subtype: 'orca' });
    let relatedOrca: HardState | undefined;
    if (existingOrcas.length > 0 && Math.random() < 0.5) {
      relatedOrca = pickRandom(existingOrcas);
    }

    // Orca tags (semantic meaning derived from placement, not placement from tags)
    const orcaTags = { orca: true, raider: true, 'external-threat': true, predator: true, underwater: true };

    for (let i = 0; i < raiderCount; i++) {
      const prominence = Math.random() < 0.1 ? 'renowned'
                       : Math.random() < 0.3 ? 'recognized'
                       : 'marginal';

      // Derive coordinates spatially using orca culture
      const placementResult = graphView.deriveCoordinatesWithCulture(
        'orca',  // Orca raiders have their own culture
        'npc',
        [colony]
      );
      const baseCoords = placementResult?.coordinates;

      // Adjust z to underwater (10-30) instead of surface (70)
      const orcaCoords = baseCoords ? {
        x: baseCoords.x,
        y: baseCoords.y,
        z: 10 + Math.random() * 20  // Underwater: 10-30
      } : { x: 50, y: 50, z: 20 };

      entities.push({
        kind: 'npc',
        subtype: 'orca',
        description: `A fearsome orca raider threatening ${colony.name} from the depths`,
        status: 'alive',
        prominence,
        culture: 'orca',
        tags: orcaTags,
        coordinates: orcaCoords
      });

      // Add lineage relationship to related orca
      if (relatedOrca && i === 0) {
        relationships.push({
          kind: 'inspired_by',
          src: 'will-be-assigned-0',
          dst: relatedOrca.id,
          distance: 0.2 + Math.random() * 0.2,  // Close lineage (same pod)
          strength: 0.7
        });
      }
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

    // Orcas might also be enemies of factions
    const factions = graphView.findEntities({ kind: 'faction' });
    if (factions.length > 0 && Math.random() < 0.5) {
      relationships.push({
        kind: 'enemy_of',
        src: 'will-be-assigned-0',
        dst: pickRandom(factions).id
      });
    }

    // Give orcas combat abilities
    const combatAbilities = graphView.findEntities({ kind: 'abilities' })
      .filter(a => hasTag(a.tags, 'combat') || hasTag(a.tags, 'offensive'));

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

    const lineageDesc = relatedOrca ? ` (from ${relatedOrca.name}'s pod)` : '';
    const description = raiderCount === 1
      ? `An orca raider surfaces near ${colony.name}, threatening the colony from the depths${lineageDesc}`
      : `A pod of ${raiderCount} orca raiders threatens ${colony.name} from the underwater passages${lineageDesc}`;

    return {
      entities,
      relationships,
      description
    };
  }
};
