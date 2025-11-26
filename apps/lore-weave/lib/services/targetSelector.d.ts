/**
 * Target Selector Service
 *
 * Framework-level weighted target selection that prevents super-hub formation.
 *
 * Problem: Naive target selection creates "super-hub" entities with dozens of connections,
 * making graphs unrealistic. Templates repeatedly select the same popular entities.
 *
 * Solution: Score-based selection with exponential penalties for existing connections,
 * similar to template diversity pressure. Can create new entities when all candidates
 * are oversaturated.
 */
import { Graph } from '../types/engine';
import { HardState, Prominence } from '../types/worldTypes';
/**
 * Selection bias configuration - defines preferences and penalties
 */
export interface SelectionBias {
    /** Positive preferences - boost score for entities with these attributes */
    prefer?: {
        /** Preferred subtypes (e.g., ['merchant', 'outlaw'] for cult recruitment) */
        subtypes?: string[];
        /** Preferred tags (e.g., ['mystic', 'explorer']) */
        tags?: string[];
        /** Preferred prominence levels */
        prominence?: Prominence[];
        /** Same location as reference entity (for local recruitment) */
        sameLocationAs?: string;
        /** Boost multiplier for preferred attributes (default: 2.0) */
        preferenceBoost?: number;
    };
    /** Negative penalties - reduce score for oversaturated entities */
    avoid?: {
        /** Relationship kinds to penalize (e.g., ['member_of'] to avoid multi-faction NPCs) */
        relationshipKinds?: string[];
        /** Exponential hub penalty strength (default: 1.0, higher = more aggressive) */
        hubPenaltyStrength?: number;
        /** Hard cap - never select entities with this many total relationships */
        maxTotalRelationships?: number;
        /** Exclude entities already related to this entity */
        excludeRelatedTo?: {
            entityId: string;
            relationshipKind?: string;
        };
    };
    /** Creation fallback - create new entity when all candidates are oversaturated */
    createIfSaturated?: {
        /** If best candidate score falls below this, create new entity (0-1, default: 0.1) */
        threshold: number;
        /** Factory function to create new entity */
        factory: (graph: Graph, context: SelectionContext) => Partial<HardState>;
        /** Maximum new entities to create per selection (default: count/2) */
        maxCreated?: number;
    };
    /** Diversity pressure - penalize recently selected entities */
    diversityTracking?: {
        /** Track ID for this selection type (e.g., 'cult_recruitment') */
        trackingId: string;
        /** Penalty strength (default: 1.0, uses same formula as template diversity) */
        strength?: number;
    };
}
/**
 * Context passed to creation factory
 */
export interface SelectionContext {
    /** The graph being operated on */
    graph: Graph;
    /** How many targets were requested */
    requestedCount: number;
    /** Best candidate score (to understand why creation was triggered) */
    bestCandidateScore: number;
    /** All candidates and their scores (for debugging) */
    candidates: Array<{
        entity: HardState;
        score: number;
    }>;
}
/**
 * Result of target selection
 */
export interface SelectionResult {
    /** Selected existing entities */
    existing: HardState[];
    /** Newly created entities (partial, need IDs assigned) */
    created: Array<Partial<HardState>>;
    /** Diagnostic info */
    diagnostics: {
        candidatesEvaluated: number;
        bestScore: number;
        worstScore: number;
        avgScore: number;
        creationTriggered: boolean;
        creationReason?: string;
    };
}
/**
 * Target Selector - Framework service for intelligent entity selection
 */
export declare class TargetSelector {
    private tracker;
    /**
     * Select entities using weighted scoring with hub penalties
     *
     * @param graph - World graph
     * @param kind - Entity kind to select
     * @param count - Number of entities to select
     * @param bias - Selection preferences and penalties
     * @returns Selection result with existing + created entities
     */
    selectTargets(graph: Graph, kind: string, count: number, bias?: SelectionBias): SelectionResult;
    /**
     * Score a candidate entity based on bias configuration
     * Higher score = more desirable target
     */
    private scoreCandidate;
    /**
     * Apply hard filters that completely exclude candidates
     */
    private applyHardFilters;
    /**
     * Create new entities when all candidates are oversaturated
     */
    private createNewEntities;
    private emptyResult;
    /**
     * Reset diversity tracking (call at epoch boundaries or specific events)
     */
    resetDiversityTracking(trackingId?: string): void;
}
//# sourceMappingURL=targetSelector.d.ts.map