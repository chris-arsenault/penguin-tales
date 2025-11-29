/**
 * Region Configuration for Penguin Domain
 *
 * Each entity kind has its own independent 2D coordinate map with its own regions.
 * This allows physical entities (locations, NPCs) to share geographic regions,
 * while conceptual entities (rules, abilities) have abstract coordinate spaces.
 *
 * Key design principles:
 * - Each entity kind has its own coordinate map with its own regions
 * - Regions are mostly emergent (created when entities are placed)
 * - Some seed regions exist for initial entities (colonies)
 * - z coordinate represents depth: 0-30 = underwater, 30-70 = surface, 70-100 = elevated
 */

import type {
  Region,
  RegionMapperConfig,
  EmergentRegionConfig,
  EntityKindMapConfig,
  EntityKindMaps
} from '@lore-weave/core';
import {
  createKindMapConfig,
  createDefaultEmergentConfig,
  KindRegionServiceConfig
} from '@lore-weave/core';

// =============================================================================
// COLONY REGIONS
// =============================================================================

/**
 * Aurora Stack - The main trading colony on the sunlit face of Aurora Berg.
 * Center: (60, 60), z: 40-60 (surface level)
 */
const auroraStackRegion: Region = {
  id: 'aurora_stack',
  label: 'Aurora Stack',
  description: 'A vertical colony carved into the sunlit face of Aurora Berg, known for orderly terraces and bright trade banners.',
  bounds: {
    shape: 'circle',
    center: { x: 60, y: 60 },
    radius: 12
  },
  zRange: { min: 40, max: 60 },
  autoTags: ['colony', 'aurora-stack', 'trade'],
  metadata: {
    culture: 'aurora-stack',
    subtype: 'colony'
  }
};

/**
 * Nightfall Shelf - The shadowed colony on the far side of Aurora Berg.
 * Center: (30, 40), z: 35-55 (slightly lower surface)
 */
const nightfallShelfRegion: Region = {
  id: 'nightfall_shelf',
  label: 'Nightfall Shelf',
  description: 'A shadowed ledge on the far side of Aurora Berg, lit by bioluminescent ice glyphs and whispered deals.',
  bounds: {
    shape: 'circle',
    center: { x: 30, y: 40 },
    radius: 12
  },
  zRange: { min: 35, max: 55 },
  autoTags: ['colony', 'nightshelf', 'criminal'],
  metadata: {
    culture: 'nightshelf',
    subtype: 'colony'
  }
};

// =============================================================================
// GEOGRAPHIC FEATURE REGIONS
// =============================================================================

/**
 * Windward Ridge - High vantage point for communication and scouting.
 * Center: (50, 70), z: 70-90 (elevated)
 */
const windwardRidgeRegion: Region = {
  id: 'windward_ridge',
  label: 'Windward Ridge',
  description: 'A knife-edge crest of ice where the high winds carve strange patterns and carry news between colonies.',
  bounds: {
    shape: 'circle',
    center: { x: 50, y: 70 },
    radius: 8
  },
  zRange: { min: 70, max: 90 },
  autoTags: ['geographic', 'elevated', 'strategic'],
  metadata: {
    subtype: 'geographic_feature'
  }
};

/**
 * Krill Shoals - Underwater feeding grounds.
 * Center: (60, 55), z: 10-30 (underwater)
 */
const krillShoalsRegion: Region = {
  id: 'krill_shoals',
  label: 'Krill Shoals',
  description: 'Dense drifting clouds of krill that pass regularly beneath Aurora Stack, the lifeblood of its fisheries.',
  bounds: {
    shape: 'circle',
    center: { x: 60, y: 55 },
    radius: 10
  },
  zRange: { min: 10, max: 30 },
  autoTags: ['underwater', 'resource', 'krill'],
  metadata: {
    subtype: 'geographic_feature'
  }
};

// =============================================================================
// ANOMALY REGIONS
// =============================================================================

/**
 * The Glow-Fissure - Mystical anomaly beneath Nightfall Shelf.
 * Center: (30, 35), z: 0-20 (deep caverns)
 */
const glowFissureRegion: Region = {
  id: 'glow_fissure',
  label: 'The Glow-Fissure',
  description: 'A deep crack in the ice under Nightfall Shelf that pulses with otherworldly light and warps the currents.',
  bounds: {
    shape: 'circle',
    center: { x: 30, y: 35 },
    radius: 6
  },
  zRange: { min: 0, max: 20 },
  autoTags: ['anomaly', 'mystical', 'caverns'],
  metadata: {
    subtype: 'anomaly'
  }
};

// =============================================================================
// AURORA BERG (Parent Region)
// =============================================================================

/**
 * Aurora Berg - The massive iceberg that hosts all colonies.
 * This is a large rectangular region covering most of the map.
 */
const auroraBergRegion: Region = {
  id: 'aurora_berg',
  label: 'Aurora Berg',
  description: 'A towering, many-tiered iceberg whose shelves host rival super-penguin colonies.',
  bounds: {
    shape: 'rect',
    x1: 15,
    y1: 20,
    x2: 85,
    y2: 85
  },
  autoTags: ['iceberg', 'aurora-berg'],
  metadata: {
    subtype: 'iceberg'
  }
};

// =============================================================================
// EMERGENT REGION CONFIG
// =============================================================================

/**
 * Configuration for dynamically created regions (new colonies, anomalies, etc.)
 */
const emergentConfig: EmergentRegionConfig = {
  minDistanceFromExisting: 15,  // New regions must be 15+ units from existing
  defaultRadius: 10,            // Default size for new regions
  defaultZRange: { min: 35, max: 65 },  // Default to surface level
  maxAttempts: 50,              // Max attempts to find valid position
  preferredArea: {
    center: { x: 50, y: 50 },
    weight: 0.2                 // Slight preference toward center
  }
};

// =============================================================================
// REGION MAPPER CONFIG
// =============================================================================

/**
 * Complete region configuration for the penguin domain.
 */
export const penguinRegionConfig: RegionMapperConfig = {
  regions: [
    // Large parent regions first (for proper hierarchy)
    auroraBergRegion,
    // Colony regions
    auroraStackRegion,
    nightfallShelfRegion,
    // Geographic features
    windwardRidgeRegion,
    krillShoalsRegion,
    // Anomalies
    glowFissureRegion
  ],
  defaultRegionLabel: 'Frozen Wilderness',
  defaultTags: ['wilderness', 'unexplored'],
  allowEmergent: true,
  emergentConfig
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get region ID for a colony by culture name.
 */
export function getColonyRegionId(culture: string): string | undefined {
  const cultureToRegion: Record<string, string> = {
    'aurora-stack': 'aurora_stack',
    'nightshelf': 'nightfall_shelf'
  };
  return cultureToRegion[culture];
}

/**
 * Get the default z-range for an entity subtype.
 */
export function getDefaultZRangeForSubtype(subtype: string): { min: number; max: number } {
  const zRanges: Record<string, { min: number; max: number }> = {
    'colony': { min: 40, max: 60 },
    'iceberg': { min: 30, max: 70 },
    'geographic_feature': { min: 40, max: 80 },
    'anomaly': { min: 0, max: 30 },
    'merchant': { min: 40, max: 60 },
    'mayor': { min: 50, max: 60 },
    'hero': { min: 30, max: 70 },
    'outlaw': { min: 20, max: 50 },
    'orca': { min: 10, max: 40 }
  };
  return zRanges[subtype] ?? { min: 35, max: 65 };
}

/**
 * Determine appropriate region for a new colony.
 * New colonies should be placed in wilderness, far from existing colonies.
 */
export function getWildernessPlacementOptions(): {
  avoidRegions: string[];
  minDistanceFromColonies: number;
  preferredZRange: { min: number; max: number };
} {
  return {
    avoidRegions: ['aurora_stack', 'nightfall_shelf'],
    minDistanceFromColonies: 20,
    preferredZRange: { min: 40, max: 60 }
  };
}

// =============================================================================
// PER-KIND REGION CONFIGURATIONS
// =============================================================================

/**
 * Location map - geographic regions on Aurora Berg.
 * Seed regions include the initial colonies, geographic features, and anomalies.
 */
const locationMapConfig: EntityKindMapConfig = {
  entityKind: 'location',
  name: 'Aurora Berg Map',
  description: 'Geographic regions on and around Aurora Berg iceberg',
  bounds: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 }, z: { min: 0, max: 100 } },
  hasZAxis: true,
  zAxisLabel: 'Depth/Elevation',
  emergentConfig: {
    ...emergentConfig,
    minDistanceFromExisting: 15,
    defaultRadius: 10
  },
  seedRegions: [
    auroraBergRegion,
    auroraStackRegion,
    nightfallShelfRegion,
    windwardRidgeRegion,
    krillShoalsRegion,
    glowFissureRegion
  ]
};

/**
 * NPC map - where NPCs are located.
 * Seed regions mirror location regions so culture placement works.
 */
const npcMapConfig: EntityKindMapConfig = {
  entityKind: 'npc',
  name: 'Character Locations',
  description: 'Where characters live and congregate',
  bounds: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 }, z: { min: 0, max: 100 } },
  hasZAxis: true,
  zAxisLabel: 'Depth/Elevation',
  emergentConfig: {
    ...emergentConfig,
    minDistanceFromExisting: 8,
    defaultRadius: 8
  },
  seedRegions: [
    { ...auroraBergRegion, id: 'aurora_berg' },
    { ...auroraStackRegion, id: 'aurora_stack' },
    { ...nightfallShelfRegion, id: 'nightfall_shelf' },
    { ...windwardRidgeRegion, id: 'windward_ridge' },
    { ...krillShoalsRegion, id: 'krill_shoals' },
    { ...glowFissureRegion, id: 'glow_fissure' }
  ]
};

/**
 * Faction map - spheres of influence.
 * Seed regions mirror location regions so culture placement works.
 */
const factionMapConfig: EntityKindMapConfig = {
  entityKind: 'faction',
  name: 'Influence Map',
  description: 'Faction spheres of influence and territory',
  bounds: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
  hasZAxis: false,
  emergentConfig: {
    minDistanceFromExisting: 10,
    defaultRadius: 15,
    maxAttempts: 30
  },
  seedRegions: [
    { ...auroraBergRegion, id: 'aurora_berg' },
    { ...auroraStackRegion, id: 'aurora_stack' },
    { ...nightfallShelfRegion, id: 'nightfall_shelf' },
    { ...windwardRidgeRegion, id: 'windward_ridge' },
    { ...krillShoalsRegion, id: 'krill_shoals' },
    { ...glowFissureRegion, id: 'glow_fissure' }
  ]
};

/**
 * Rules map - abstract domains of governance.
 * Seed regions mirror location regions so culture placement works.
 */
const rulesMapConfig: EntityKindMapConfig = {
  entityKind: 'rules',
  name: 'Governance Domains',
  description: 'Abstract domains of laws and customs',
  bounds: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
  hasZAxis: true,
  zAxisLabel: 'Authority Level',
  emergentConfig: {
    minDistanceFromExisting: 5,
    defaultRadius: 12,
    maxAttempts: 20
  },
  seedRegions: [
    { ...auroraBergRegion, id: 'aurora_berg' },
    { ...auroraStackRegion, id: 'aurora_stack' },
    { ...nightfallShelfRegion, id: 'nightfall_shelf' },
    { ...windwardRidgeRegion, id: 'windward_ridge' },
    { ...krillShoalsRegion, id: 'krill_shoals' },
    { ...glowFissureRegion, id: 'glow_fissure' }
  ]
};

/**
 * Abilities map - conceptual space of powers.
 * Seed regions mirror location regions so culture placement works.
 */
const abilitiesMapConfig: EntityKindMapConfig = {
  entityKind: 'abilities',
  name: 'Power Domains',
  description: 'Conceptual space of abilities and powers',
  bounds: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
  hasZAxis: true,
  zAxisLabel: 'Power Level',
  emergentConfig: {
    minDistanceFromExisting: 5,
    defaultRadius: 10,
    maxAttempts: 20
  },
  seedRegions: [
    { ...auroraBergRegion, id: 'aurora_berg' },
    { ...auroraStackRegion, id: 'aurora_stack' },
    { ...nightfallShelfRegion, id: 'nightfall_shelf' },
    { ...windwardRidgeRegion, id: 'windward_ridge' },
    { ...krillShoalsRegion, id: 'krill_shoals' },
    { ...glowFissureRegion, id: 'glow_fissure' }
  ]
};

/**
 * All entity kind map configurations.
 */
export const penguinKindMaps: EntityKindMaps = {
  location: locationMapConfig,
  npc: npcMapConfig,
  faction: factionMapConfig,
  rules: rulesMapConfig,
  abilities: abilitiesMapConfig
};

/**
 * Complete kind region service configuration for penguin domain.
 */
export const penguinKindRegionConfig: KindRegionServiceConfig = {
  kindMaps: penguinKindMaps,
  defaultEmergentConfig: emergentConfig
};
