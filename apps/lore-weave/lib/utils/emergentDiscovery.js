/**
 * Emergent Discovery Helpers
 *
 * Analyzes graph state to procedurally generate location discoveries.
 * No pre-defined lists - everything emerges from world conditions.
 *
 * Requires EmergentDiscoveryConfig from domain schema.
 */
import { pickRandom } from './helpers';
// ============================================================================
// CONFIG HELPERS
// ============================================================================
/**
 * Get discovery config from graph. Requires domain schema to be configured.
 * @throws Error if domain schema doesn't provide emergentDiscoveryConfig
 */
function getDiscoveryConfig(graph) {
    const config = graph.config?.domain?.emergentDiscoveryConfig;
    if (!config) {
        throw new Error('EmergentDiscoveryConfig not provided by domain schema');
    }
    return config;
}
/**
 * Try to get discovery config, returning null if not available.
 * Use this for functions that should gracefully degrade.
 */
function tryGetDiscoveryConfig(graph) {
    return graph.config?.domain?.emergentDiscoveryConfig ?? null;
}
/**
 * Get a config value, throwing if not defined.
 */
function requireConfigValue(config, key) {
    const value = config[key];
    if (value === undefined) {
        throw new Error(`EmergentDiscoveryConfig.${key} is required but not defined`);
    }
    return value;
}
/**
 * Analyze resource deficit by examining colony status and population.
 * Returns null if discovery config is not available.
 */
export function analyzeResourceDeficit(graph) {
    const config = tryGetDiscoveryConfig(graph);
    if (!config)
        return null;
    const settlementSubtypes = requireConfigValue(config, 'settlementSubtypes');
    const thrivingStatuses = requireConfigValue(config, 'thrivingStatuses');
    const strugglingStatuses = requireConfigValue(config, 'strugglingStatuses');
    const foodResources = requireConfigValue(config, 'foodResources');
    const colonies = Array.from(graph.entities.values()).filter(e => e.kind === 'location' && settlementSubtypes.includes(e.subtype));
    if (colonies.length === 0)
        return null;
    const waningColonies = colonies.filter(c => strugglingStatuses.includes(c.status));
    const thrivingColonies = colonies.filter(c => thrivingStatuses.includes(c.status));
    // Food scarcity if colonies are waning
    if (waningColonies.length > thrivingColonies.length) {
        const scarcity = graph.pressures.get('resource_scarcity') || 0;
        return {
            primary: 'food',
            severity: scarcity,
            specific: 'fishing',
            affectedColonies: waningColonies.map(c => c.id)
        };
    }
    // Water scarcity if high population but low resources
    const npcs = Array.from(graph.entities.values()).filter(e => e.kind === 'npc');
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
    const scarcity = graph.pressures.get('resource_scarcity') || 0;
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
/**
 * Analyze conflict patterns to determine strategic needs
 */
export function analyzeConflictPatterns(graph) {
    const conflictPressure = graph.pressures.get('conflict') || 0;
    if (conflictPressure < 30)
        return null;
    // Find active conflicts
    const enemies = graph.relationships.filter(r => r.kind === 'enemy_of' || r.kind === 'at_war_with');
    const conflicts = graph.relationships.filter(r => r.kind === 'attacking');
    if (enemies.length === 0)
        return null;
    // Determine conflict type from graph patterns
    const resourceScarcity = graph.pressures.get('resource_scarcity') || 0;
    const culturalTension = graph.pressures.get('cultural_tension') || 0;
    let type = 'territorial';
    if (resourceScarcity > 50) {
        type = 'resource';
    }
    else if (culturalTension > 40) {
        type = 'ideological';
    }
    else if (conflicts.length > 0) {
        type = 'defensive';
    }
    // Find involved factions
    const factionIds = new Set();
    enemies.forEach(e => {
        const srcEntity = graph.entities.get(e.src);
        const dstEntity = graph.entities.get(e.dst);
        if (srcEntity?.kind === 'faction')
            factionIds.add(e.src);
        if (dstEntity?.kind === 'faction')
            factionIds.add(e.dst);
    });
    return {
        type,
        intensity: conflictPressure,
        factions: Array.from(factionIds),
        needsAdvantage: conflicts.length > 2
    };
}
/**
 * Analyze magical presence and instability
 */
export function analyzeMagicPresence(graph) {
    const instability = graph.pressures.get('magical_instability') || 0;
    if (instability < 25)
        return null;
    // Find existing magic
    const magicAbilities = Array.from(graph.entities.values()).filter(e => e.kind === 'abilities' && e.subtype === 'magic');
    const anomalies = Array.from(graph.entities.values()).filter(e => e.kind === 'location' && e.subtype === 'anomaly');
    // Determine manifestation type from era and existing magic
    let manifestationType = 'phenomenon';
    if (anomalies.length > 2) {
        manifestationType = 'convergence';
    }
    else if (magicAbilities.length > 3) {
        manifestationType = 'artifact';
    }
    else if (graph.currentEra.id === 'expansion') {
        manifestationType = 'temple';
    }
    return {
        instability,
        existingMagicTypes: magicAbilities.map(m => m.name),
        anomalyCount: anomalies.length,
        manifestationType
    };
}
/**
 * Generate location theme from resource needs.
 * Requires EmergentDiscoveryConfig.
 */
export function generateResourceTheme(analysis, era, config) {
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
export function generateStrategicTheme(analysis, era) {
    const advantageWords = analysis.needsAdvantage ?
        ['defensible', 'fortified', 'strategic', 'elevated'] :
        ['hidden', 'neutral', 'secret', 'isolated'];
    const formWords = {
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
export function generateMysticalTheme(analysis, era) {
    const intensityWords = analysis.instability > 60 ?
        ['chaotic', 'wild', 'unstable', 'volatile'] :
        ['ancient', 'dormant', 'sleeping', 'sealed'];
    const manifestationWords = {
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
export function generateExplorationTheme(graph) {
    const config = tryGetDiscoveryConfig(graph);
    if (!config)
        return null;
    const eraThemeWords = config.eraThemeWords ?? {};
    const era = graph.currentEra.id;
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
export function shouldDiscoverLocation(graph) {
    const config = tryGetDiscoveryConfig(graph);
    if (!config)
        return false;
    const maxLocations = requireConfigValue(config, 'maxLocations');
    const maxDiscoveriesPerEpoch = requireConfigValue(config, 'maxDiscoveriesPerEpoch');
    const minTicksBetweenDiscoveries = requireConfigValue(config, 'minTicksBetweenDiscoveries');
    const explorerSubtypes = requireConfigValue(config, 'explorerSubtypes');
    const explorerActiveStatus = requireConfigValue(config, 'explorerActiveStatus');
    const eraDiscoveryModifiers = config.eraDiscoveryModifiers ?? {};
    const locationCount = Array.from(graph.entities.values()).filter(e => e.kind === 'location').length;
    // Hard cap
    if (locationCount >= maxLocations)
        return false;
    // Check discovery state
    const ticksSince = graph.tick - graph.discoveryState.lastDiscoveryTick;
    if (ticksSince < minTicksBetweenDiscoveries)
        return false;
    if (graph.discoveryState.discoveriesThisEpoch >= maxDiscoveriesPerEpoch)
        return false;
    // Must have explorers
    const explorers = Array.from(graph.entities.values()).filter(e => e.kind === 'npc' &&
        explorerSubtypes.includes(e.subtype) &&
        e.status === explorerActiveStatus);
    if (explorers.length === 0)
        return false;
    // Base probability scaled by era (from config)
    const baseChance = eraDiscoveryModifiers[graph.currentEra.id] ?? 0.10;
    return Math.random() < baseChance;
}
/**
 * Calculate theme similarity for chain discoveries
 */
export function calculateThemeSimilarity(location1, theme2) {
    const tags1 = location1.tags || [];
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
export function findNearbyLocations(explorer, graph) {
    // Find explorer's location
    const residenceRel = explorer.links.find(r => r.kind === 'resident_of' || r.kind === 'leader_of');
    if (!residenceRel)
        return [];
    const explorerLocation = graph.entities.get(residenceRel.dst);
    if (!explorerLocation)
        return [];
    // Find adjacent locations
    const adjacentIds = explorerLocation.links
        .filter(r => r.kind === 'adjacent_to' || r.kind === 'contains')
        .map(r => r.dst);
    return adjacentIds
        .map(id => graph.entities.get(id))
        .filter((e) => e !== undefined && e.kind === 'location');
}
//# sourceMappingURL=emergentDiscovery.js.map