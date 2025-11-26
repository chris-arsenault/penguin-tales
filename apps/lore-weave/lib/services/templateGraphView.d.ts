import { Graph } from '../types/engine';
import { HardState, Relationship } from '../types/worldTypes';
import { TargetSelector } from './targetSelector';
/**
 * TemplateGraphView
 *
 * A restricted view of the Graph provided to templates during expansion.
 * This wrapper enforces correct entity selection patterns by:
 *
 * 1. Providing only read-only access to graph state
 * 2. Exposing targetSelector as the PRIMARY entity selection mechanism
 * 3. Hiding direct access to entities Map (preventing ad-hoc selection)
 * 4. Providing safe query methods for graph inspection
 *
 * Benefits:
 * - Compile-time guarantee that templates use targetSelector
 * - No more ad-hoc findEntities() calls that create super-hubs
 * - Clearer API surface for template authors
 * - Easier to maintain and refactor framework internals
 */
export declare class TemplateGraphView {
    private graph;
    readonly targetSelector: TargetSelector;
    constructor(graph: Graph, targetSelector: TargetSelector);
    /**
     * Select targets using intelligent hub-aware selection
     * This is the RECOMMENDED way to select entities for connections
     *
     * Wraps targetSelector.selectTargets() to hide internal graph access
     */
    selectTargets(kind: string, count: number, bias: import('./targetSelector').SelectionBias): import('./targetSelector').SelectionResult;
    /** Current simulation tick */
    get tick(): number;
    /** Current era */
    get currentEra(): import("..").Era;
    /** Current pressure values (read-only) */
    getPressure(pressureId: string): number;
    /** Get all pressure values as read-only map */
    getAllPressures(): ReadonlyMap<string, number>;
    /** Get engine configuration (read-only) */
    get config(): import("..").EngineConfig;
    /** Get discovery state (for location templates) */
    get discoveryState(): import("../types/worldTypes").DiscoveryState;
    /**
     * Get direct access to the internal graph.
     * Use when you need full graph access beyond what TemplateGraphView provides.
     */
    getInternalGraph(): Graph;
    /**
     * Get a specific entity by ID (returns undefined if not found)
     * Safe for templates to check specific entities they already know about
     */
    getEntity(id: string): HardState | undefined;
    /**
     * Check if an entity exists
     */
    hasEntity(id: string): boolean;
    /**
     * Get total entity count (useful for canApply checks)
     */
    getEntityCount(kind?: string, subtype?: string): number;
    /**
     * Find entities matching criteria
     *
     * NOTE: Use sparingly for canApply() checks and validation logic.
     * For entity SELECTION, use targetSelector.selectTargets() instead
     * to ensure proper hub-aware distribution.
     */
    findEntities(criteria: {
        kind?: string;
        subtype?: string;
        status?: string;
        prominence?: string;
        tag?: string;
    }): HardState[];
    /**
     * Get all relationships in the graph (read-only)
     */
    getAllRelationships(): readonly Relationship[];
    /**
     * Get relationships for a specific entity
     */
    getRelationships(entityId: string, kind?: string): Relationship[];
    /**
     * Get entities related to a specific entity
     */
    getRelatedEntities(entityId: string, relationshipKind?: string, direction?: 'src' | 'dst' | 'both'): HardState[];
    /**
     * Check if a relationship exists between two entities
     */
    hasRelationship(srcId: string, dstId: string, kind?: string): boolean;
    /**
     * Get relationship cooldown remaining ticks
     * Returns 0 if no cooldown, otherwise ticks remaining
     */
    getRelationshipCooldown(entityId: string, relationshipType: string): number;
    /**
     * Check if an entity can form a new relationship of a given type
     * (respects cooldowns)
     */
    canFormRelationship(entityId: string, relationshipType: string): boolean;
    /**
     * Get the location of an entity (follows 'resident_of' or 'located_at' links)
     */
    getLocation(entityId: string): HardState | undefined;
    /**
     * Get all members of a faction (follows 'member_of' links in reverse)
     */
    getFactionMembers(factionId: string): HardState[];
    /**
     * Get the leader of a faction (follows 'leader_of' link in reverse)
     */
    getFactionLeader(factionId: string): HardState | undefined;
}
//# sourceMappingURL=templateGraphView.d.ts.map