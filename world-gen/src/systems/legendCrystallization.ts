import { SimulationSystem, SystemResult, Graph } from '../types/engine';
import { HardState, Relationship } from '../types/worldTypes';
import {
  findEntities,
  getRelated,
  getLocation,
  rollProbability,
  pickRandom,
  generateId
} from '../utils/helpers';

/**
 * Legend Crystallization System
 *
 * Transforms dead heroes into cultural myths. After sufficient time has passed (death_age > 50),
 * deceased high-prominence NPCs crystallize into legends:
 * - Status changes from 'dead' to 'fictional'
 * - Locations are renamed commemoratively
 * - Memorial rules are created
 * - "commemorates" relationships link myths to places/rules
 *
 * This is a DETERMINISTIC END-STATE system, not an emergent one.
 *
 * SYSTEM_IMPLEMENTATION_GUIDE compliance:
 * - Threshold-based (death_age > 50), not probability-based
 * - Includes throttling (only checks 20% of ticks)
 * - Entity modifications tracked properly
 * - No relationship formation (uses existing commemorates relationship type)
 */
export const legendCrystallization: SimulationSystem = {
  id: 'legend_crystallization',
  name: 'Legend Formation',

  metadata: {
    produces: {
      relationships: [
        { kind: 'commemorates', category: 'cultural', frequency: 'rare', comment: 'Locations/rules commemorate legends' },
        { kind: 'originated_in', category: 'spatial', frequency: 'rare', comment: 'Memorial rules originated in locations' },
      ],
      modifications: [
        { type: 'status', frequency: 'rare', comment: 'Dead NPCs become fictional legends' },
        { type: 'prominence', frequency: 'rare', comment: 'Legends gain mythic prominence' },
      ],
    },
    effects: {
      graphDensity: 0.3,
      clusterFormation: 0.4,
      diversityImpact: 0.9,
      comment: 'Transforms deceased heroes into cultural myths with memorial rules',
    },
    parameters: {
      throttleChance: {
        value: 0.2,
        min: 0.05,
        max: 0.5,
        description: 'Probability system runs each tick (threshold-based, no need to run constantly)',
      },
      crystallizationThreshold: {
        value: 50,
        min: 20,
        max: 150,
        description: 'Ticks after death before hero crystallizes into legend',
      },
    },
    triggers: {
      graphConditions: ['Dead renowned/mythic NPCs', 'death_age >= threshold'],
      comment: 'Only processes high-prominence NPCs who died long ago',
    },
  },

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const params = legendCrystallization.metadata?.parameters || {};
    const throttleChance = params.throttleChance?.value ?? 0.2;
    const CRYSTALLIZATION_THRESHOLD = params.crystallizationThreshold?.value ?? 50;

    // Throttle: Only check throttleChance% of ticks (threshold-based system doesn't need to run constantly)
    if (!rollProbability(throttleChance, modifier)) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'Legend crystallization dormant'
      };
    }

    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];
    const relationships: Relationship[] = [];
    const newEntities: Array<{ id: string; entity: Partial<HardState> }> = [];

    // Find dead NPCs with high prominence who have been dead long enough
    const deadNPCs = findEntities(graph, { kind: 'npc', status: 'dead' });

    deadNPCs.forEach(npc => {
      // Calculate death age (ticks since last update, which was death)
      const deathAge = graph.tick - npc.updatedAt;

      // Only crystallize high-prominence NPCs who have been dead long enough
      if (deathAge < CRYSTALLIZATION_THRESHOLD) return;
      if (npc.prominence !== 'renowned' && npc.prominence !== 'mythic') return;

      // === STAGE 1: Transform NPC to Fictional ===
      modifications.push({
        id: npc.id,
        changes: {
          status: 'fictional',
          prominence: 'mythic', // Legends become mythic
          description: `${npc.description} Their deeds have passed into legend, becoming larger than life.`
        }
      });

      // === STAGE 2: Commemorative Location Renaming ===
      // Find the location where the NPC died (or lived)
      const location = getLocation(graph, npc.id);
      if (location) {
        // Append commemorative suffix to location name
        const commemorativeSuffix = pickRandom([
          `(${npc.name}'s Fall)`,
          `(${npc.name}'s Rest)`,
          `(Echo of ${npc.name})`,
          `(Where ${npc.name} Fell)`,
          `(${npc.name}'s Memorial)`
        ]);

        // Only rename if not already commemorative
        if (!location.name.includes('(') && !location.name.includes(npc.name)) {
          modifications.push({
            id: location.id,
            changes: {
              name: `${location.name} ${commemorativeSuffix}`,
              description: `${location.description} This place is forever marked by the legend of ${npc.name}.`
            }
          });

          // Create commemorates relationship (location → NPC)
          relationships.push({
            kind: 'commemorates',
            src: location.id,
            dst: npc.id
          });
        }
      }

      // === STAGE 3: Memorial Rule Creation ===
      // Create a memorial rule/tradition based on the hero's archetype
      const archetypes = {
        'hero': { type: 'taboo', verb: 'Never forget', theme: 'courage' },
        'mayor': { type: 'social', verb: 'Honor the memory of', theme: 'leadership' },
        'merchant': { type: 'social', verb: 'Trade fairly in memory of', theme: 'prosperity' },
        'outlaw': { type: 'taboo', verb: 'Never speak ill of', theme: 'freedom' }
      };

      const archetype = archetypes[npc.subtype as keyof typeof archetypes] ||
                       { type: 'social', verb: 'Remember', theme: 'honor' };

      const ruleId = generateId('rule');
      const ruleName = `${archetype.verb} ${npc.name}`;

      newEntities.push({
        id: ruleId,
        entity: {
          kind: 'rules',
          subtype: archetype.type,
          name: ruleName,
          description: `A memorial tradition honoring ${npc.name}, who embodied ${archetype.theme} in life and legend.`,
          status: 'enacted',
          prominence: 'renowned',
          tags: ['memorial', npc.subtype, archetype.theme].slice(0, 10),
          createdAt: graph.tick,
          updatedAt: graph.tick
        }
      });

      // Create commemorates relationship (rule → NPC)
      relationships.push({
        kind: 'commemorates',
        src: ruleId,
        dst: npc.id
      });

      // If there's a location, also link rule to location
      if (location) {
        relationships.push({
          kind: 'originated_in',
          src: ruleId,
          dst: location.id
        });
      }
    });

    // Add new entities to graph (memorial rules)
    newEntities.forEach(({ id, entity }) => {
      const fullEntity: HardState = {
        id,
        kind: entity.kind!,
        subtype: entity.subtype!,
        name: entity.name!,
        description: entity.description!,
        status: entity.status!,
        prominence: entity.prominence!,
        tags: entity.tags!,
        links: [],
        createdAt: entity.createdAt!,
        updatedAt: entity.updatedAt!
      };
      graph.entities.set(id, fullEntity);
    });

    // Note: This system doesn't use pressure changes because crystallization is
    // a cultural process, not a pressure-driven one

    return {
      relationshipsAdded: relationships,
      entitiesModified: modifications,
      pressureChanges: {},
      description: modifications.length > 0
        ? `${modifications.filter(m => m.changes.status === 'fictional').length} heroes crystallize into legend`
        : 'No heroes ready for mythic transformation'
    };
  }
};
