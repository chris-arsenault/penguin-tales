/**
 * Contagion Spread Module
 *
 * Dynamics module that simulates the spread of properties through
 * relationship networks. Can model epidemics, meme spread, influence,
 * cultural diffusion, or any property that transfers between connected entities.
 *
 * Examples:
 * - Disease spreading through trade relationships
 * - Ideology spreading through faction membership
 * - Skills spreading through mentorship relationships
 * - Fear spreading through proximity
 *
 * Extracted from lore-weave's diffusion and epidemic systems.
 */

import type { ContagionSpreadParams } from '@canonry/world-schema';
import type { RuntimeEntity } from '../types.js';
import type { ModuleContext, DynamicsResult, ModuleDefinition } from './registry.js';
import { moduleRegistry } from './registry.js';
import { seededRandom } from '../conditions.js';

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_PARAMS: ContagionSpreadParams = {
  transmissionRate: 0.1,
  resistanceTag: undefined,
  resistanceBonus: 0.3,
  recoveryRate: 0.05,
  transmissionRelationships: ['member_of', 'ally_of'],
  contagionTag: 'infected',
};

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Find all entities connected to an infected entity via transmission relationships
 */
function findConnectedEntities(
  sourceId: string,
  transmissionKinds: string[],
  context: ModuleContext
): RuntimeEntity[] {
  const connected: RuntimeEntity[] = [];

  for (const rel of context.state.relationships.values()) {
    if (rel.archived) continue;
    if (!transmissionKinds.includes(rel.kind)) continue;

    let targetId: string | null = null;
    if (rel.srcId === sourceId) {
      targetId = rel.dstId;
    } else if (rel.dstId === sourceId) {
      targetId = rel.srcId;
    }

    if (targetId) {
      const target = context.state.entities.get(targetId);
      if (target) {
        connected.push(target);
      }
    }
  }

  return connected;
}

/**
 * Check if an entity is infected (has the contagion tag)
 */
function isInfected(entity: RuntimeEntity, contagionTag: string): boolean {
  return entity.tags.includes(contagionTag);
}

/**
 * Check if an entity has resistance
 */
function hasResistance(entity: RuntimeEntity, resistanceTag?: string): boolean {
  if (!resistanceTag) return false;
  return entity.tags.includes(resistanceTag);
}

/**
 * Calculate transmission probability for an entity
 */
function calculateTransmissionProbability(
  entity: RuntimeEntity,
  config: ContagionSpreadParams,
  connectionStrength: number = 1.0
): number {
  let probability = config.transmissionRate * connectionStrength;

  // Reduce probability if entity has resistance
  if (hasResistance(entity, config.resistanceTag)) {
    probability *= (1 - config.resistanceBonus);
  }

  return Math.min(1.0, Math.max(0, probability));
}

/**
 * Simulate one tick of contagion spread
 *
 * @param params - Module configuration
 * @param context - Simulation context
 * @returns Dynamics result with infections and recoveries
 */
export function contagionSpread(
  params: ContagionSpreadParams,
  context: ModuleContext
): DynamicsResult {
  const config = { ...DEFAULT_PARAMS, ...params };
  const result: DynamicsResult = {
    modifications: [],
  };

  // Find all currently infected entities
  const infected: RuntimeEntity[] = [];
  for (const entity of context.state.entities.values()) {
    if (isInfected(entity, config.contagionTag)) {
      infected.push(entity);
    }
  }

  // Track new infections to avoid double-processing
  const newlyInfected = new Set<string>();
  const recovering = new Set<string>();

  // Process each infected entity for potential spread
  for (const source of infected) {
    const connected = findConnectedEntities(
      source.id,
      config.transmissionRelationships,
      context
    );

    for (const target of connected) {
      // Skip if already infected or marked for infection
      if (isInfected(target, config.contagionTag)) continue;
      if (newlyInfected.has(target.id)) continue;

      // Find the relationship to get its strength
      let connectionStrength = 1.0;
      for (const rel of context.state.relationships.values()) {
        if (rel.archived) continue;
        if (
          config.transmissionRelationships.includes(rel.kind) &&
          ((rel.srcId === source.id && rel.dstId === target.id) ||
           (rel.dstId === source.id && rel.srcId === target.id))
        ) {
          // Stronger relationships (lower distance) transmit better
          connectionStrength = 1.0 - rel.distance;
          break;
        }
      }

      const probability = calculateTransmissionProbability(target, config, connectionStrength);
      const roll = seededRandom(context.state);

      if (roll < probability) {
        newlyInfected.add(target.id);
        result.modifications!.push({
          entityId: target.id,
          changes: {
            addTags: [config.contagionTag],
          },
        });
      }
    }

    // Check for recovery
    const recoveryRoll = seededRandom(context.state);
    if (recoveryRoll < config.recoveryRate) {
      recovering.add(source.id);
      result.modifications!.push({
        entityId: source.id,
        changes: {
          removeTags: [config.contagionTag],
          // Optionally add immunity tag
          addTags: [`recovered_${config.contagionTag}`],
        },
      });
    }
  }

  return result;
}

/**
 * Count currently infected entities
 */
export function countInfected(
  context: ModuleContext,
  contagionTag: string
): number {
  let count = 0;
  for (const entity of context.state.entities.values()) {
    if (entity.tags.includes(contagionTag)) {
      count++;
    }
  }
  return count;
}

// ============================================================================
// REGISTER MODULE
// ============================================================================

const contagionSpreadModule: ModuleDefinition<ContagionSpreadParams, DynamicsResult> = {
  id: 'contagion_spread',
  name: 'Contagion Spread',
  description: 'Simulates property spread through relationship networks',
  category: 'dynamics',
  defaults: DEFAULT_PARAMS,
  execute: (params, context) => contagionSpread(params, context),
};

moduleRegistry.register(contagionSpreadModule);
