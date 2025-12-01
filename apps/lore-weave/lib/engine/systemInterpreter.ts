/**
 * System Interpreter
 *
 * Converts declarative system configurations (JSON) into SimulationSystem objects.
 * This enables systems to be defined as pure data in the canonry project files.
 *
 * Supported system types:
 * - connectionEvolution: Handles relationship strength changes over time
 * - graphContagion: Spreads states/relationships through network connections
 * - thresholdTrigger: Detects conditions and sets tags/pressures for templates
 */

import { SimulationSystem } from './types';
import { createConnectionEvolutionSystem, ConnectionEvolutionConfig } from '../systems/connectionEvolution';
import { createGraphContagionSystem, GraphContagionConfig } from '../systems/graphContagion';
import { createThresholdTriggerSystem, ThresholdTriggerConfig } from '../systems/thresholdTrigger';

// =============================================================================
// DECLARATIVE SYSTEM TYPES
// =============================================================================

/**
 * Union type for all declarative system configurations.
 * Each system type has a 'systemType' discriminator.
 */
export type DeclarativeSystem =
  | DeclarativeConnectionEvolutionSystem
  | DeclarativeGraphContagionSystem
  | DeclarativeThresholdTriggerSystem;

export interface DeclarativeConnectionEvolutionSystem {
  systemType: 'connectionEvolution';
  config: ConnectionEvolutionConfig;
}

export interface DeclarativeGraphContagionSystem {
  systemType: 'graphContagion';
  config: GraphContagionConfig;
}

export interface DeclarativeThresholdTriggerSystem {
  systemType: 'thresholdTrigger';
  config: ThresholdTriggerConfig;
}

// =============================================================================
// SYSTEM CREATION
// =============================================================================

/**
 * Create a SimulationSystem from a declarative configuration.
 *
 * @param declarative - The declarative system configuration
 * @returns A SimulationSystem that can be used by WorldEngine
 */
export function createSystemFromDeclarative(declarative: DeclarativeSystem): SimulationSystem {
  switch (declarative.systemType) {
    case 'connectionEvolution':
      return createConnectionEvolutionSystem(declarative.config);

    case 'graphContagion':
      return createGraphContagionSystem(declarative.config);

    case 'thresholdTrigger':
      return createThresholdTriggerSystem(declarative.config);

    default:
      // TypeScript should catch this, but just in case
      throw new Error(`Unknown system type: ${(declarative as any).systemType}`);
  }
}

/**
 * Load multiple systems from declarative configurations.
 * Filters out any invalid configs and logs warnings.
 *
 * @param declaratives - Array of declarative system configurations
 * @returns Array of SimulationSystem objects
 */
export function loadSystems(declaratives: DeclarativeSystem[]): SimulationSystem[] {
  if (!Array.isArray(declaratives)) {
    console.warn('loadSystems: expected array, got', typeof declaratives);
    return [];
  }

  return declaratives
    .filter(d => {
      if (!d || typeof d !== 'object') {
        console.warn('loadSystems: skipping invalid config', d);
        return false;
      }
      if (!d.systemType) {
        console.warn('loadSystems: skipping config without systemType', d);
        return false;
      }
      return true;
    })
    .map(d => {
      try {
        return createSystemFromDeclarative(d);
      } catch (error) {
        console.error(`Failed to create system from config:`, d, error);
        throw error;
      }
    });
}

/**
 * Check if a value is a valid declarative system configuration.
 */
export function isDeclarativeSystem(value: unknown): value is DeclarativeSystem {
  if (!value || typeof value !== 'object') return false;
  const sys = value as Record<string, unknown>;
  return (
    sys.systemType === 'connectionEvolution' ||
    sys.systemType === 'graphContagion' ||
    sys.systemType === 'thresholdTrigger'
  ) && sys.config !== undefined;
}
