/**
 * Clustering Utilities
 *
 * Domain-agnostic clustering functions for grouping similar entities.
 * Used by SimulationSystems that need to detect and form clusters
 * (e.g., meta-entity formation, faction consolidation).
 */
import { FRAMEWORK_STATUS } from '../types/frameworkPrimitives';
/**
 * Calculate similarity score between two entities based on criteria
 */
export function calculateSimilarity(e1, e2, criteria, graphView) {
    let score = 0;
    const matchedCriteria = [];
    for (const criterion of criteria) {
        let matches = false;
        switch (criterion.type) {
            case 'shared_relationship': {
                if (!criterion.relationshipKind)
                    break;
                const direction = criterion.direction || 'src';
                const e1Related = graphView.getRelatedEntities(e1.id, criterion.relationshipKind, direction);
                const e2Related = graphView.getRelatedEntities(e2.id, criterion.relationshipKind, direction);
                const e1RelatedIds = new Set(e1Related.map(r => r.id));
                matches = e2Related.some(r => e1RelatedIds.has(r.id));
                break;
            }
            case 'shared_tags': {
                const e1Tags = new Set(e1.tags || []);
                const e2Tags = new Set(e2.tags || []);
                const intersection = Array.from(e1Tags).filter(t => e2Tags.has(t)).length;
                const union = new Set([...e1Tags, ...e2Tags]).size;
                const jaccard = union > 0 ? intersection / union : 0;
                matches = jaccard >= (criterion.threshold || 0.3);
                break;
            }
            case 'temporal_proximity': {
                const timeDiff = Math.abs(e1.createdAt - e2.createdAt);
                matches = timeDiff <= (criterion.threshold || 30);
                break;
            }
            case 'same_subtype': {
                matches = e1.subtype === e2.subtype;
                break;
            }
            case 'same_culture': {
                matches = e1.culture === e2.culture;
                break;
            }
            case 'custom': {
                if (criterion.predicate) {
                    matches = criterion.predicate(e1, e2, graphView);
                }
                break;
            }
        }
        if (matches) {
            score += criterion.weight;
            matchedCriteria.push(criterion.type);
        }
    }
    return { score, matchedCriteria };
}
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
export function detectClusters(entities, config, graphView) {
    if (entities.length < config.minSize) {
        return [];
    }
    // Sort by creation time (cluster chronologically related entities)
    const sorted = [...entities].sort((a, b) => a.createdAt - b.createdAt);
    // Greedy clustering: try to add each entity to an existing cluster or create new one
    const clusters = [];
    const clusterJoinThreshold = config.clusterJoinThreshold ?? 0.7;
    for (const entity of sorted) {
        let addedToCluster = false;
        // Try to add to existing cluster
        for (const cluster of clusters) {
            // Check if entity is similar enough to cluster members
            let clusterScore = 0;
            let matchCount = 0;
            const allMatchedCriteria = [];
            for (const member of cluster.entities) {
                const { score, matchedCriteria } = calculateSimilarity(entity, member, config.criteria, graphView);
                if (score > 0) {
                    clusterScore += score;
                    matchCount++;
                    allMatchedCriteria.push(...matchedCriteria);
                }
            }
            // Average similarity to cluster members
            const avgSimilarity = matchCount > 0 ? clusterScore / matchCount : 0;
            // If similar enough, add to cluster
            if (avgSimilarity >= config.minimumScore * clusterJoinThreshold) {
                cluster.entities.push(entity);
                cluster.score = (cluster.score + avgSimilarity) / 2; // Update cluster score
                cluster.matchedCriteria = [...new Set([...cluster.matchedCriteria, ...allMatchedCriteria])];
                addedToCluster = true;
                break;
            }
        }
        // If not added to any cluster, create new cluster
        if (!addedToCluster) {
            clusters.push({
                entities: [entity],
                score: config.minimumScore,
                matchedCriteria: []
            });
        }
    }
    // Filter clusters by minimum size and apply maximum size
    const validClusters = clusters.filter(c => {
        if (c.entities.length < config.minSize)
            return false;
        if (config.maxSize && c.entities.length > config.maxSize) {
            // Truncate cluster to max size (keep earliest created)
            c.entities = c.entities.slice(0, config.maxSize);
        }
        return true;
    });
    return validClusters;
}
/**
 * Filter entities that are eligible for clustering.
 * Excludes historical entities and meta-entities.
 *
 * @param entities - All entities to filter
 * @returns Filtered entities eligible for clustering
 */
export function filterClusterableEntities(entities) {
    return entities.filter(e => e.status !== FRAMEWORK_STATUS.HISTORICAL &&
        !e.tags?.includes('meta-entity'));
}
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
export function findBestClusterMatch(entity, clusters, criteria, graphView, minimumScore) {
    let bestCluster;
    let bestScore = 0;
    for (const cluster of clusters) {
        let totalScore = 0;
        let count = 0;
        for (const member of cluster.entities) {
            const { score } = calculateSimilarity(entity, member, criteria, graphView);
            totalScore += score;
            count++;
        }
        const avgScore = count > 0 ? totalScore / count : 0;
        if (avgScore >= minimumScore && avgScore > bestScore) {
            bestCluster = cluster;
            bestScore = avgScore;
        }
    }
    return bestCluster;
}
//# sourceMappingURL=clusteringUtils.js.map