/**
 * Tracks distribution metrics and calculates deviations from targets
 */
export class DistributionTracker {
    targets;
    constructor(targets) {
        this.targets = targets;
    }
    /**
     * Measure current state of the world
     */
    measureState(graph) {
        const entities = Array.from(graph.entities.values());
        const totalEntities = entities.length;
        // Entity kind distribution
        const entityKindCounts = {};
        entities.forEach((e) => {
            entityKindCounts[e.kind] = (entityKindCounts[e.kind] || 0) + 1;
        });
        const entityKindRatios = {};
        Object.keys(entityKindCounts).forEach((kind) => {
            entityKindRatios[kind] = entityKindCounts[kind] / totalEntities;
        });
        // Entity subtype distribution (for feedback loop tracking)
        const entitySubtypeCounts = {};
        entities.forEach((e) => {
            const subtypeKey = `${e.kind}:${e.subtype}`;
            entitySubtypeCounts[subtypeKey] = (entitySubtypeCounts[subtypeKey] || 0) + 1;
        });
        // Store subtype metrics in graph for feedback analyzer access
        if (!graph.subtypeMetrics) {
            graph.subtypeMetrics = new Map();
        }
        Object.entries(entitySubtypeCounts).forEach(([key, count]) => {
            graph.subtypeMetrics.set(key, count);
        });
        // Prominence distribution
        const prominenceCounts = {
            forgotten: 0,
            marginal: 0,
            recognized: 0,
            renowned: 0,
            mythic: 0,
        };
        entities.forEach((e) => {
            prominenceCounts[e.prominence]++;
        });
        const prominenceRatios = {
            forgotten: prominenceCounts.forgotten / totalEntities,
            marginal: prominenceCounts.marginal / totalEntities,
            recognized: prominenceCounts.recognized / totalEntities,
            renowned: prominenceCounts.renowned / totalEntities,
            mythic: prominenceCounts.mythic / totalEntities,
        };
        // Prominence by kind
        const prominenceByKind = {};
        Object.keys(entityKindCounts).forEach((kind) => {
            const kindEntities = entities.filter((e) => e.kind === kind);
            const kindTotal = kindEntities.length;
            prominenceByKind[kind] = {
                forgotten: kindEntities.filter((e) => e.prominence === 'forgotten').length / kindTotal,
                marginal: kindEntities.filter((e) => e.prominence === 'marginal').length / kindTotal,
                recognized: kindEntities.filter((e) => e.prominence === 'recognized').length / kindTotal,
                renowned: kindEntities.filter((e) => e.prominence === 'renowned').length / kindTotal,
                mythic: kindEntities.filter((e) => e.prominence === 'mythic').length / kindTotal,
            };
        });
        // Relationship distribution
        const relationshipTypeCounts = {};
        graph.relationships.forEach((r) => {
            relationshipTypeCounts[r.kind] = (relationshipTypeCounts[r.kind] || 0) + 1;
        });
        const totalRelationships = graph.relationships.length;
        const relationshipTypeRatios = {};
        Object.keys(relationshipTypeCounts).forEach((kind) => {
            relationshipTypeRatios[kind] = relationshipTypeCounts[kind] / totalRelationships;
        });
        // Relationship categories
        const relationshipCategoryCounts = {};
        const relationshipCategoryRatios = {};
        Object.entries(this.targets.relationshipCategories).forEach(([category, kinds]) => {
            // Skip comment entries
            if (!Array.isArray(kinds))
                return;
            const count = kinds.reduce((sum, kind) => sum + (relationshipTypeCounts[kind] || 0), 0);
            relationshipCategoryCounts[category] = count;
            relationshipCategoryRatios[category] = totalRelationships > 0 ? count / totalRelationships : 0;
        });
        // Graph connectivity metrics
        const graphMetrics = this.calculateGraphMetrics(graph);
        return {
            tick: graph.tick,
            totalEntities,
            entityKindCounts,
            entityKindRatios,
            prominenceCounts,
            prominenceRatios,
            prominenceByKind,
            relationshipTypeCounts,
            relationshipTypeRatios,
            relationshipCategoryCounts,
            relationshipCategoryRatios,
            graphMetrics,
        };
    }
    /**
     * Calculate deviation from targets
     */
    calculateDeviation(state, eraName) {
        const globalTargets = this.targets.global;
        const eraOverrides = this.targets.perEra[eraName] || {};
        // Merge era overrides with global targets
        const effectiveTargets = this.mergeTargets(globalTargets, eraOverrides);
        // Entity kind deviation
        const entityKindDeviations = {};
        let entityKindScore = 0;
        Object.entries(effectiveTargets.entityKindDistribution.targets).forEach(([kind, target]) => {
            const actual = state.entityKindRatios[kind] || 0;
            const deviation = Math.abs(actual - target);
            entityKindDeviations[kind] = deviation;
            entityKindScore += deviation;
        });
        entityKindScore /= Object.keys(effectiveTargets.entityKindDistribution.targets).length;
        // Prominence deviation
        const prominenceDeviations = {};
        let prominenceScore = 0;
        Object.entries(globalTargets.prominenceDistribution.targets).forEach(([level, target]) => {
            const actual = state.prominenceRatios[level] || 0;
            const deviation = Math.abs(actual - target);
            prominenceDeviations[level] = deviation;
            prominenceScore += deviation;
        });
        prominenceScore /= Object.keys(globalTargets.prominenceDistribution.targets).length;
        // Relationship diversity
        const maxTypeRatio = Math.max(...Object.values(state.relationshipTypeRatios), 0);
        const typesPresent = Object.keys(state.relationshipTypeCounts).length;
        const relationshipScore = Math.max(0, maxTypeRatio - globalTargets.relationshipDistribution.maxSingleTypeRatio) +
            Math.max(0, globalTargets.relationshipDistribution.minTypesPresent - typesPresent) * 0.05;
        // Calculate category balance (should be roughly equal across categories)
        const categoryRatios = Object.values(state.relationshipCategoryRatios);
        const avgCategoryRatio = categoryRatios.reduce((a, b) => a + b, 0) / categoryRatios.length;
        const categoryBalance = categoryRatios.reduce((sum, ratio) => sum + Math.abs(ratio - avgCategoryRatio), 0);
        // Connectivity deviation
        const clusterTarget = globalTargets.graphConnectivity.targetClusters.preferred;
        const clusterDev = Math.abs(state.graphMetrics.clusters - clusterTarget) / clusterTarget;
        const densityDev = Math.abs(state.graphMetrics.intraClusterDensity -
            globalTargets.graphConnectivity.densityTargets.intraCluster) +
            Math.abs(state.graphMetrics.interClusterDensity -
                globalTargets.graphConnectivity.densityTargets.interCluster);
        const isolatedDev = Math.max(0, state.graphMetrics.isolatedNodeRatio -
            globalTargets.graphConnectivity.isolatedNodeRatio.max);
        const connectivityScore = (clusterDev + densityDev + isolatedDev) / 3;
        // Overall score (weighted average)
        const correctionStrength = this.targets.tuning.correctionStrength;
        const overall = (entityKindScore * correctionStrength.entityKind +
            prominenceScore * correctionStrength.prominence +
            relationshipScore * correctionStrength.relationship +
            connectivityScore * correctionStrength.connectivity) /
            (correctionStrength.entityKind +
                correctionStrength.prominence +
                correctionStrength.relationship +
                correctionStrength.connectivity);
        return {
            overall,
            entityKind: {
                score: entityKindScore,
                deviations: entityKindDeviations,
            },
            prominence: {
                score: prominenceScore,
                deviations: prominenceDeviations,
            },
            relationship: {
                score: relationshipScore,
                maxTypeRatio,
                typesPresent,
                categoryBalance,
            },
            connectivity: {
                score: connectivityScore,
                clusterCount: state.graphMetrics.clusters,
                densityBalance: densityDev,
                isolatedNodes: state.graphMetrics.isolatedNodes,
            },
        };
    }
    /**
     * Calculate graph connectivity metrics
     */
    calculateGraphMetrics(graph) {
        const entities = Array.from(graph.entities.values());
        const totalEntities = entities.length;
        if (totalEntities === 0) {
            return {
                clusters: 0,
                avgClusterSize: 0,
                intraClusterDensity: 0,
                interClusterDensity: 0,
                isolatedNodes: 0,
                isolatedNodeRatio: 0,
            };
        }
        // Build adjacency for cluster detection
        // Use only narrative-strong relationships (strength >= threshold), not weak spatial ones
        // This creates clusters based on narrative coherence (factions, abilities, laws)
        // not just geographic proximity
        // Threshold is configurable in distributionTargets.json
        const clusteringThreshold = this.targets.global.graphConnectivity.clusteringStrengthThreshold || 0.6;
        const adjacency = new Map();
        entities.forEach((e) => {
            adjacency.set(e.id, new Set());
        });
        graph.relationships.forEach((r) => {
            // Only use relationships with sufficient narrative strength for clustering
            // Strong relationships (member_of, leader_of, etc.) have strength >= 0.6
            // Weak spatial relationships (resident_of, adjacent_to) have strength < 0.6
            const strength = r.strength ?? 0.5; // Default to medium if not specified
            if (strength >= clusteringThreshold) {
                adjacency.get(r.src)?.add(r.dst);
                adjacency.get(r.dst)?.add(r.src); // Treat as undirected for clustering
            }
        });
        // Find connected components (simple DFS)
        const visited = new Set();
        const clusters = [];
        const dfs = (nodeId, cluster) => {
            visited.add(nodeId);
            cluster.push(nodeId);
            const neighbors = adjacency.get(nodeId) || new Set();
            neighbors.forEach((neighbor) => {
                if (!visited.has(neighbor)) {
                    dfs(neighbor, cluster);
                }
            });
        };
        entities.forEach((e) => {
            if (!visited.has(e.id)) {
                const cluster = [];
                dfs(e.id, cluster);
                clusters.push(cluster);
            }
        });
        const avgClusterSize = clusters.length > 0
            ? clusters.reduce((sum, c) => sum + c.length, 0) / clusters.length
            : 0;
        // Calculate intra-cluster density (avg density within clusters)
        let intraClusterDensity = 0;
        if (clusters.length > 0) {
            clusters.forEach((cluster) => {
                if (cluster.length > 1) {
                    const maxEdges = (cluster.length * (cluster.length - 1)) / 2;
                    const actualEdges = graph.relationships.filter((r) => cluster.includes(r.src) && cluster.includes(r.dst)).length;
                    intraClusterDensity += actualEdges / maxEdges;
                }
            });
            intraClusterDensity /= clusters.length;
        }
        // Calculate inter-cluster density
        const interClusterEdges = graph.relationships.filter((r) => {
            const srcCluster = clusters.find((c) => c.includes(r.src));
            const dstCluster = clusters.find((c) => c.includes(r.dst));
            return srcCluster !== dstCluster;
        }).length;
        const maxInterClusterEdges = clusters.length > 1
            ? clusters.reduce((sum, c1, i) => {
                return (sum +
                    clusters.slice(i + 1).reduce((s, c2) => s + c1.length * c2.length, 0));
            }, 0)
            : 1;
        const interClusterDensity = interClusterEdges / maxInterClusterEdges;
        // Count isolated nodes (no relationships)
        const isolatedNodes = entities.filter((e) => (adjacency.get(e.id)?.size || 0) === 0).length;
        const isolatedNodeRatio = isolatedNodes / totalEntities;
        return {
            clusters: clusters.length,
            avgClusterSize,
            intraClusterDensity,
            interClusterDensity,
            isolatedNodes,
            isolatedNodeRatio,
        };
    }
    /**
     * Merge era overrides with global targets
     */
    mergeTargets(global, eraOverrides) {
        const merged = JSON.parse(JSON.stringify(global));
        if (eraOverrides.entityKindDistribution) {
            Object.entries(eraOverrides.entityKindDistribution).forEach(([kind, ratio]) => {
                if (typeof ratio === 'number') {
                    merged.entityKindDistribution.targets[kind] = ratio;
                }
            });
        }
        if (eraOverrides.prominenceDistribution) {
            Object.entries(eraOverrides.prominenceDistribution).forEach(([level, ratio]) => {
                if (level !== 'comment' && typeof ratio === 'number') {
                    merged.prominenceDistribution.targets[level] = ratio;
                }
            });
        }
        return merged;
    }
}
//# sourceMappingURL=distributionTracker.js.map