/**
 * Culture Configuration for Penguin Domain
 *
 * Defines the cultures that influence entity placement and coordination.
 * Each culture specifies:
 * - Seed regions where the culture originates
 * - Preferred semantic axes that bias placement
 * - Emergent region defaults for culture expansion
 */

import type { CultureCoordinateConfig } from '@lore-weave/core';

// =============================================================================
// AURORA STACK CULTURE
// =============================================================================

/**
 * Aurora Stack - The main trading colony on the sunlit face of Aurora Berg.
 *
 * Values: Trade, order, cooperation, light, surface
 * Home region: aurora_stack
 */
export const auroraStackCulture: CultureCoordinateConfig = {
  cultureId: 'aurora-stack',

  // Primary home region
  seedRegionIds: ['aurora_stack', 'windward_ridge', 'krill_shoals'],

  // Semantic axis biases - influences placement in conceptual space
  preferredAxes: {
    // Lawful bias (rules follow law more than chaos)
    'Order': 70,
    // Trade-focused (abilities/rules emphasize commerce)
    'Utility': 65,
    // Surface dwellers (z-axis preference)
    'Elevation': 60,
    // Cooperative tendency
    'Influence': 55
  },

  // How emergent regions are created when culture expands
  emergentDefaults: {
    labelPrefix: 'Aurora Stack',
    tags: ['aurora-stack', 'orderly', 'trade'],
    preferredArea: {
      center: { x: 60, y: 60 },
      weight: 0.3
    }
  }
};

// =============================================================================
// NIGHTSHELF CULTURE
// =============================================================================

/**
 * Nightfall Shelf - The shadowed colony known for secrets and deals.
 *
 * Values: Independence, mystery, cunning, shadow, caverns
 * Home region: nightfall_shelf
 */
export const nightshelfCulture: CultureCoordinateConfig = {
  cultureId: 'nightshelf',

  // Primary home region plus nearby mystical areas
  seedRegionIds: ['nightfall_shelf', 'glow_fissure'],

  // Semantic axis biases
  preferredAxes: {
    // Chaotic bias (rules are flexible, deals are personal)
    'Order': 30,
    // Shadow preference
    'Elevation': 40,
    // Secretive (abilities tend toward subtlety)
    'Influence': 40,
    // Self-reliance
    'Utility': 50
  },

  emergentDefaults: {
    labelPrefix: 'Shadow',
    tags: ['nightshelf', 'secretive', 'underground'],
    preferredArea: {
      center: { x: 30, y: 40 },
      weight: 0.3
    }
  }
};

// =============================================================================
// ORCA CULTURE
// =============================================================================

/**
 * Orca - External predator culture from the deep waters.
 *
 * Values: Predation, strength, the deep, hunting, pack coordination
 * No fixed home region - they range across underwater areas
 */
export const orcaCulture: CultureCoordinateConfig = {
  cultureId: 'orca',

  // Orcas don't have fixed home regions - they range the underwater zones
  // Using krill_shoals as a hunting ground reference
  seedRegionIds: ['krill_shoals'],

  // Semantic axis biases - strongly predatory, underwater
  preferredAxes: {
    // Might makes right
    'Influence': 80,
    // Deep underwater
    'Elevation': 15,
    // Highly aggressive
    'Combat': 85,
    // Pack hunters (some order, but brutal)
    'Order': 45
  },

  emergentDefaults: {
    labelPrefix: 'Orca',
    tags: ['orca', 'predator', 'underwater', 'deep'],
    preferredArea: {
      center: { x: 50, y: 50 },
      weight: 0.1 // Orcas range widely
    }
  }
};

// =============================================================================
// WORLD CULTURE
// =============================================================================

/**
 * World - Default/neutral culture for entities not tied to a specific group.
 *
 * Used for: Natural phenomena, ancient artifacts, neutral parties
 * No specific region bias - can emerge anywhere
 */
export const worldCulture: CultureCoordinateConfig = {
  cultureId: 'world',

  // World culture can spawn in any of the main regions
  seedRegionIds: ['aurora_berg'],

  // Neutral biases
  preferredAxes: {
    'Order': 50,
    'Elevation': 50,
    'Influence': 50,
    'Utility': 50
  },

  emergentDefaults: {
    labelPrefix: 'Wild',
    tags: ['wilderness', 'natural'],
    preferredArea: {
      center: { x: 50, y: 50 },
      weight: 0.1
    }
  }
};

// =============================================================================
// ALL CULTURES
// =============================================================================

/**
 * All penguin domain cultures.
 */
export const penguinCultures: CultureCoordinateConfig[] = [
  auroraStackCulture,
  nightshelfCulture,
  orcaCulture,
  worldCulture
];

/**
 * Get culture by ID.
 */
export function getCultureById(cultureId: string): CultureCoordinateConfig | undefined {
  return penguinCultures.find(c => c.cultureId === cultureId);
}

/**
 * Get all culture IDs.
 */
export function getCultureIds(): string[] {
  return penguinCultures.map(c => c.cultureId);
}
