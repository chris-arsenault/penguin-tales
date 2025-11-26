/**
 * Clustering Utilities
 *
 * Domain-agnostic clustering functions for grouping similar entities.
 * Used by SimulationSystems that need to detect and form clusters
 * (e.g., meta-entity formation, faction consolidation).
 */
import { HardState } from '../types/worldTypes';
import { TemplateGraphView } from '../services/templateGraphView';
/**
 * Result of clustering operation
 */
export interface Cluster {
    /** Entities in this cluster */
    entities: HardState[];
    /** Similarity score of the cluster */
    score: number;
    /** Which criteria contributed to clustering */
    matchedCriteria: string[];
}
/**
 * Criterion types for calculating similarity between entities
 */
export type ClusterCriterionType = 'shared_relationship' | 'shared_tags' | 'temporal_proximity' | 'same_subtype' | 'same_culture' | 'custom';
/**
 * Configuration for a clustering criterion
 */
export interface ClusterCriterion {
    /** Type of criterion */
    type: ClusterCriterionType;
    /** Weight contribution to similarity score */
    weight: number;
    /** Optional threshold for this criterion */
    threshold?: number;
    /** For 'shared_relationship': the relationship kind to check */
    relationshipKind?: string;
    /** For 'shared_relationship': direction to check ('src' = this entity is src, 'dst' = this entity is dst) */
    direction?: 'src' | 'dst';
    /** For 'custom': custom predicate function */
    predicate?: (e1: HardState, e2: HardState, graphView: TemplateGraphView) => boolean;
}
/**
 * Configuration for clustering operation
 */
export interface ClusterConfig {
    /** Minimum entities required to form a cluster */
    minSize: number;
    /** Maximum entities in a cluster (optional) */
    maxSize?: number;
    /** Criteria for calculating similarity */
    criteria: ClusterCriterion[];
    /** Minimum total similarity score to be clustered together */
    minimumScore: number;
    /** Similarity threshold multiplier for adding to existing cluster (default: 0.7) */
    clusterJoinThreshold?: number;
}
/**
 * Calculate similarity score between two entities based on criteria
 */
export declare function calculateSimilarity(e1: HardState, e2: HardState, criteria: ClusterCriterion[], graphView: TemplateGraphView): {
    score: number;
    matchedCriteria: string[];
};
/**
 * Detect clusters of similar entities using greedy clustering algorithm.
 *
 * Algorithm:
 * 1. Sort entities by creation time (chronological clustering)
 * 2. For each entity, try to add to existing cluster if similar enough
 * 3. If no match, create new cluster with this entity
 * 4. Filter clusters by minimum size
 *
 * @param entities - Entities to cluster
 * @param config - Clustering configuration
 * @param graphView - Graph view for relationship queries
 * @returns Array of detected clusters
 */
export declare function detectClusters(entities: HardState[], config: ClusterConfig, graphView: TemplateGraphView): Cluster[];
/**
 * Filter entities that are eligible for clustering.
 * Excludes historical entities and meta-entities.
 *
 * @param entities - All entities to filter
 * @returns Filtered entities eligible for clustering
 */
export declare function filterClusterableEntities(entities: HardState[]): HardState[];
/**
 * Find the best cluster match for a new entity.
 * Useful for deciding which existing cluster to add a new entity to.
 *
 * @param entity - Entity to find cluster for
 * @param clusters - Existing clusters
 * @param criteria - Similarity criteria
 * @param graphView - Graph view for relationship queries
 * @param minimumScore - Minimum score to be considered a match
 * @returns Best matching cluster or undefined
 */
export declare function findBestClusterMatch(entity: HardState, clusters: Cluster[], criteria: ClusterCriterion[], graphView: TemplateGraphView, minimumScore: number): Cluster | undefined;
//# sourceMappingURL=clusteringUtils.d.ts.map