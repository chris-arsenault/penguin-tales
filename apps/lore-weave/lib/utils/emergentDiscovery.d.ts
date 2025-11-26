/**
 * Emergent Discovery Helpers
 *
 * Analyzes graph state to procedurally generate location discoveries.
 * No pre-defined lists - everything emerges from world conditions.
 *
 * Requires EmergentDiscoveryConfig from domain schema.
 */
import { Graph } from '../types/engine';
import { HardState, LocationSubtype } from '../types/worldTypes';
import { EmergentDiscoveryConfig } from '../types/domainSchema';
export interface ResourceAnalysis {
    primary: 'food' | 'water' | 'shelter' | 'safety';
    severity: number;
    specific: string;
    affectedColonies: string[];
}
/**
 * Analyze resource deficit by examining colony status and population.
 * Returns null if discovery config is not available.
 */
export declare function analyzeResourceDeficit(graph: Graph): ResourceAnalysis | null;
export interface ConflictAnalysis {
    type: 'territorial' | 'ideological' | 'resource' | 'defensive';
    intensity: number;
    factions: string[];
    needsAdvantage: boolean;
}
/**
 * Analyze conflict patterns to determine strategic needs
 */
export declare function analyzeConflictPatterns(graph: Graph): ConflictAnalysis | null;
export interface MagicAnalysis {
    instability: number;
    existingMagicTypes: string[];
    anomalyCount: number;
    manifestationType: 'convergence' | 'artifact' | 'phenomenon' | 'temple';
}
/**
 * Analyze magical presence and instability
 */
export declare function analyzeMagicPresence(graph: Graph): MagicAnalysis | null;
export interface LocationTheme {
    subtype: LocationSubtype;
    themeString: string;
    tags: string[];
    relatedTo?: string[];
}
/**
 * Generate location theme from resource needs.
 * Requires EmergentDiscoveryConfig.
 */
export declare function generateResourceTheme(analysis: ResourceAnalysis, era: string, config: EmergentDiscoveryConfig): LocationTheme;
/**
 * Generate location theme from conflict patterns
 */
export declare function generateStrategicTheme(analysis: ConflictAnalysis, era: string): LocationTheme;
/**
 * Generate location theme from magical patterns
 */
export declare function generateMysticalTheme(analysis: MagicAnalysis, era: string): LocationTheme;
/**
 * Generate a neutral exploration theme.
 * Returns null if discovery config is not available.
 */
export declare function generateExplorationTheme(graph: Graph): LocationTheme | null;
/**
 * Calculate if a discovery should occur based on world state.
 * Returns false if discovery config is not available.
 */
export declare function shouldDiscoverLocation(graph: Graph): boolean;
/**
 * Calculate theme similarity for chain discoveries
 */
export declare function calculateThemeSimilarity(location1: HardState, theme2: string): number;
/**
 * Get nearby locations for adjacency
 */
export declare function findNearbyLocations(explorer: HardState, graph: Graph): HardState[];
//# sourceMappingURL=emergentDiscovery.d.ts.map