/**
 * Emergent Discovery Helpers
 *
 * Analyzes graph state to procedurally generate location discoveries.
 * No pre-defined lists - everything emerges from world conditions.
 *
 * Requires EmergentDiscoveryConfig from domain schema.
 */

import { TemplateGraphView, EmergentDiscoveryConfig, HardState, pickRandom, pickMultiple } from '@lore-weave/core';

// LocationSubtype is a domain-specific type alias
type LocationSubtype = string;

// ============================================================================
// CONFIG HELPERS
// ============================================================================

/**
 * Get discovery config from graphView. Requires domain schema to be configured.
 * @throws Error if domain schema doesn't provide emergentDiscoveryConfig
 */
function getDiscoveryConfig(graphView: TemplateGraphView): EmergentDiscoveryConfig {
  const config = graphView.config?.domain?.emergentDiscoveryConfig;
  if (!config) {
    throw new Error('EmergentDiscoveryConfig not provided by domain schema');
  }
  return config;
}

/**
 * Try to get discovery config, returning null if not available.
 * Use this for functions that should gracefully degrade.
 */
function tryGetDiscoveryConfig(graphView: TemplateGraphView): EmergentDiscoveryConfig | null {
  return graphView.config?.domain?.emergentDiscoveryConfig ?? null;
}

/**
 * Get a config value, throwing if not defined.
 */
function requireConfigValue<K extends keyof EmergentDiscoveryConfig>(
  config: EmergentDiscoveryConfig,
  key: K
): NonNullable<EmergentDiscoveryConfig[K]> {
  const value = config[key];
  if (value === undefined) {
    throw new Error(`EmergentDiscoveryConfig.${key} is required but not defined`);
  }
  return value as NonNullable<EmergentDiscoveryConfig[K]>;
}

// ============================================================================
// WORLD STATE ANALYSIS
// ============================================================================

export interface ResourceAnalysis {
  primary: 'food' | 'water' | 'shelter' | 'safety';
  severity: number; // 0-100
  specific: string; // e.g., 'fishing', 'fresh_water', 'defensible_position'
  affectedColonies: string[];
}

/**
 * Analyze resource deficit by examining colony status and population.
 * Returns null if discovery config is not available.
 */
export function analyzeResourceDeficit(graphView: TemplateGraphView): ResourceAnalysis | null {
  const config = tryGetDiscoveryConfig(graphView);
  if (!config) return null;

  const settlementSubtypes = requireConfigValue(config, 'settlementSubtypes');
  const thrivingStatuses = requireConfigValue(config, 'thrivingStatuses');
  const strugglingStatuses = requireConfigValue(config, 'strugglingStatuses');
  const foodResources = requireConfigValue(config, 'foodResources');

  const colonies = graphView.getEntities().filter(
    e => e.kind === 'location' && settlementSubtypes.includes(e.subtype)
  );

  if (colonies.length === 0) return null;

  const waningColonies = colonies.filter(c => strugglingStatuses.includes(c.status));
  const thrivingColonies = colonies.filter(c => thrivingStatuses.includes(c.status));

  // Food scarcity if colonies are waning
  if (waningColonies.length > thrivingColonies.length) {
    const scarcity = graphView.getPressure('resource_scarcity');
    return {
      primary: 'food',
      severity: scarcity,
      specific: 'fishing',
      affectedColonies: waningColonies.map(c => c.id)
    };
  }

  // Water scarcity if high population but low resources
  const npcs = graphView.getEntities().filter(e => e.kind === 'npc');
  const locationsPerNPC = colonies.length / Math.max(npcs.length, 1);
  if (locationsPerNPC < 0.1 && colonies.length > 2) {
    return {
      primary: 'water',
      severity: 60,
      specific: 'fresh_water',
      affectedColonies: colonies.map(c => c.id)
    };
  }

  // Check scarcity pressure generally
  const scarcity = graphView.getPressure('resource_scarcity');
  if (scarcity > 50) {
    return {
      primary: 'food',
      severity: scarcity,
      specific: pickRandom(foodResources),
      affectedColonies: colonies.map(c => c.id)
    };
  }

  return null;
}

export interface ConflictAnalysis {
  type: 'territorial' | 'ideological' | 'resource' | 'defensive';
  intensity: number; // 0-100
  factions: string[];
  needsAdvantage: boolean;
}

/**
 * Analyze conflict patterns to determine strategic needs
 */
export function analyzeConflictPatterns(graphView: TemplateGraphView): ConflictAnalysis | null {
  const conflictPressure = graphView.getPressure('conflict');
  if (conflictPressure < 30) return null;

  // Find active conflicts
  const allRelationships = graphView.getAllRelationships();
  const enemies = allRelationships.filter(r => r.kind === 'enemy_of' || r.kind === 'at_war_with');
  const conflicts = allRelationships.filter(r => r.kind === 'attacking');

  if (enemies.length === 0) return null;

  // Determine conflict type from graph patterns
  const resourceScarcity = graphView.getPressure('resource_scarcity');
  const culturalTension = graphView.getPressure('cultural_tension');

  let type: ConflictAnalysis['type'] = 'territorial';
  if (resourceScarcity > 50) {
    type = 'resource';
  } else if (culturalTension > 40) {
    type = 'ideological';
  } else if (conflicts.length > 0) {
    type = 'defensive';
  }

  // Find involved factions
  const factionIds = new Set<string>();
  enemies.forEach(e => {
    const srcEntity = graphView.getEntity(e.src);
    const dstEntity = graphView.getEntity(e.dst);
    if (srcEntity?.kind === 'faction') factionIds.add(e.src);
    if (dstEntity?.kind === 'faction') factionIds.add(e.dst);
  });

  return {
    type,
    intensity: conflictPressure,
    factions: Array.from(factionIds),
    needsAdvantage: conflicts.length > 2
  };
}

export interface MagicAnalysis {
  instability: number; // 0-100
  existingMagicTypes: string[];
  anomalyCount: number;
  manifestationType: 'convergence' | 'artifact' | 'phenomenon' | 'temple';
}

/**
 * Analyze magical presence and instability
 */
export function analyzeMagicPresence(graphView: TemplateGraphView): MagicAnalysis | null {
  const config = tryGetDiscoveryConfig(graphView);
  const anomalySubtype = config?.anomalySubtype ?? 'anomaly';

  const instability = graphView.getPressure('magical_instability');
  if (instability < 25) return null;

  // Find existing magic
  const magicAbilities = graphView.getEntities().filter(
    e => e.kind === 'abilities' && e.subtype === 'magic'
  );
  const anomalies = graphView.getEntities().filter(
    e => e.kind === 'location' && e.subtype === anomalySubtype
  );

  // Determine manifestation type from era and existing magic
  let manifestationType: MagicAnalysis['manifestationType'] = 'phenomenon';
  if (anomalies.length > 2) {
    manifestationType = 'convergence';
  } else if (magicAbilities.length > 3) {
    manifestationType = 'artifact';
  } else if (graphView.currentEra.id === 'expansion') {
    manifestationType = 'temple';
  }

  return {
    instability,
    existingMagicTypes: magicAbilities.map(m => m.name),
    anomalyCount: anomalies.length,
    manifestationType
  };
}

// ============================================================================
// THEME GENERATION
// ============================================================================

export interface LocationTheme {
  subtype: LocationSubtype;
  themeString: string;  // Procedurally generated like "deep_krill_channel"
  tags: string[];
  relatedTo?: string[]; // Entity IDs this relates to
}

/**
 * Generate location theme from resource needs.
 * Requires EmergentDiscoveryConfig.
 */
export function generateResourceTheme(
  analysis: ResourceAnalysis,
  era: string,
  config: EmergentDiscoveryConfig
): LocationTheme {
  const eraThemeWords = config.eraThemeWords ?? {};
  const resourceThemeWords = config.resourceThemeWords ?? {};

  // Depth modifiers based on era (from config)
  const eraWords = eraThemeWords[era];
  const depthWords = eraWords?.depthWords ?? ['underground', 'deep', 'surface'];

  // Resource types (from config)
  const resourceMap = resourceThemeWords;

  // Formation types (framework defaults - domain-agnostic)
  const formWords = ['grounds', 'channel', 'pool', 'canyon', 'valley', 'shelf', 'zone', 'field'];

  const depth = pickRandom(depthWords);
  const resource = pickRandom(resourceMap[analysis.specific] || ['resource']);
  const form = pickRandom(formWords);

  const themeString = `${depth}_${resource}_${form}`;

  return {
    subtype: 'geographic_feature',
    themeString,
    tags: ['resource', analysis.primary, analysis.specific, depth],
    relatedTo: analysis.affectedColonies
  };
}

/**
 * Generate location theme from conflict patterns
 */
export function generateStrategicTheme(analysis: ConflictAnalysis, era: string): LocationTheme {
  const advantageWords = analysis.needsAdvantage ?
    ['defensible', 'fortified', 'strategic', 'elevated'] :
    ['hidden', 'neutral', 'secret', 'isolated'];

  const formWords: Record<ConflictAnalysis['type'], string[]> = {
    'territorial': ['ridge', 'pass', 'bridge', 'crossing'],
    'defensive': ['peak', 'fortress', 'bulwark', 'rampart'],
    'resource': ['cache', 'reserve', 'depot', 'stockpile'],
    'ideological': ['sanctuary', 'refuge', 'haven', 'retreat']
  };

  const advantage = pickRandom(advantageWords);
  const form = pickRandom(formWords[analysis.type]);

  const themeString = `${advantage}_${form}`;

  return {
    subtype: 'geographic_feature',
    themeString,
    tags: ['strategic', analysis.type, advantage],
    relatedTo: analysis.factions
  };
}

/**
 * Generate location theme from magical patterns
 */
export function generateMysticalTheme(analysis: MagicAnalysis, era: string): LocationTheme {
  const intensityWords = analysis.instability > 60 ?
    ['chaotic', 'wild', 'unstable', 'volatile'] :
    ['ancient', 'dormant', 'sleeping', 'sealed'];

  const manifestationWords: Record<MagicAnalysis['manifestationType'], string[]> = {
    'convergence': ['nexus', 'focus', 'node', 'junction'],
    'artifact': ['vault', 'chamber', 'repository', 'archive'],
    'phenomenon': ['aurora', 'glow', 'shimmer', 'echo'],
    'temple': ['shrine', 'temple', 'sanctum', 'altar']
  };

  const intensity = pickRandom(intensityWords);
  const manifestation = pickRandom(manifestationWords[analysis.manifestationType]);

  const themeString = `${intensity}_${manifestation}`;

  return {
    subtype: 'anomaly',
    themeString,
    tags: ['mystical', analysis.manifestationType, intensity],
    relatedTo: []
  };
}

/**
 * Generate a neutral exploration theme.
 * Returns null if discovery config is not available.
 */
export function generateExplorationTheme(graphView: TemplateGraphView): LocationTheme | null {
  const config = tryGetDiscoveryConfig(graphView);
  if (!config) return null;

  const eraThemeWords = config.eraThemeWords ?? {};
  const era = graphView.currentEra.id;

  const geographicWords = ['shelf', 'terrace', 'ledge', 'plateau', 'hollow', 'valley'];

  // Get era-specific descriptors from config
  const eraWords = eraThemeWords[era];
  const descriptors = eraWords?.descriptors ?? ['mysterious', 'unknown', 'uncharted', 'distant'];

  const descriptor = pickRandom(descriptors);
  const geographic = pickRandom(geographicWords);

  const themeString = `${descriptor}_${geographic}`;

  return {
    subtype: 'geographic_feature',
    themeString,
    tags: ['exploration', 'neutral', descriptor],
    relatedTo: []
  };
}

// ============================================================================
// DISCOVERY PROBABILITY
// ============================================================================

/**
 * Calculate if a discovery should occur based on world state.
 * Returns false if discovery config is not available.
 */
export function shouldDiscoverLocation(graphView: TemplateGraphView): boolean {
  const config = tryGetDiscoveryConfig(graphView);
  if (!config) return false;

  const maxLocations = requireConfigValue(config, 'maxLocations');
  const maxDiscoveriesPerEpoch = requireConfigValue(config, 'maxDiscoveriesPerEpoch');
  const minTicksBetweenDiscoveries = requireConfigValue(config, 'minTicksBetweenDiscoveries');
  const explorerSubtypes = requireConfigValue(config, 'explorerSubtypes');
  const explorerActiveStatus = requireConfigValue(config, 'explorerActiveStatus');
  const eraDiscoveryModifiers = config.eraDiscoveryModifiers ?? {};

  const locationCount = graphView.getEntities().filter(
    e => e.kind === 'location'
  ).length;

  // Hard cap
  if (locationCount >= maxLocations) return false;

  // Check discovery state
  const ticksSince = graphView.tick - graphView.discoveryState.lastDiscoveryTick;
  if (ticksSince < minTicksBetweenDiscoveries) return false;

  if (graphView.discoveryState.discoveriesThisEpoch >= maxDiscoveriesPerEpoch) return false;

  // Must have explorers
  const explorers = graphView.getEntities().filter(
    e => e.kind === 'npc' &&
         explorerSubtypes.includes(e.subtype) &&
         e.status === explorerActiveStatus
  );
  if (explorers.length === 0) return false;

  // Base probability scaled by era (from config)
  const baseChance = eraDiscoveryModifiers[graphView.currentEra.id] ?? 0.10;

  return Math.random() < baseChance;
}

/**
 * Calculate theme similarity for chain discoveries
 */
export function calculateThemeSimilarity(location1: HardState, theme2: string): number {
  const tags1 = Object.keys(location1.tags || {});
  const theme2Parts = theme2.split('_');

  // Count overlapping tags
  const overlap = tags1.filter(tag => theme2Parts.includes(tag)).length;

  // Geographic proximity bonus
  const geographic = location1.subtype === 'geographic_feature' ? 1.2 : 1.0;

  // Recent creation bonus
  const recencyBonus = location1.createdAt > location1.updatedAt - 10 ? 1.3 : 1.0;

  return overlap * 0.4 * geographic * recencyBonus;
}

/**
 * Get nearby locations for adjacency
 */
export function findNearbyLocations(explorer: HardState, graphView: TemplateGraphView): HardState[] {
  // Find explorer's location
  const residenceRel = explorer.links.find(
    r => r.kind === 'resident_of' || r.kind === 'leader_of'
  );

  if (!residenceRel) return [];

  const explorerLocation = graphView.getEntity(residenceRel.dst);
  if (!explorerLocation) return [];

  // Find adjacent locations
  const adjacentIds = explorerLocation.links
    .filter(r => r.kind === 'adjacent_to' || r.kind === 'contains')
    .map(r => r.dst);

  return adjacentIds
    .map(id => graphView.getEntity(id))
    .filter((e): e is HardState => e !== undefined && e.kind === 'location');
}
