/**
 * Tag Health Analyzer
 *
 * Analyzes tag usage across the graph to detect:
 * - Coverage: % of entities with optimal tag count (3-5 tags)
 * - Diversity: Shannon index of tag distribution
 * - Orphan tags: Tags used only 1-2 times (should have minUsage: 3)
 * - Overused tags: Tags exceeding maxUsage threshold
 * - Conflicts: Entities with conflicting tags
 * - Consolidation opportunities: Tags that should be merged
 */
import { Graph, TagHealthReport } from '../types/engine';
import { HardState } from '../types/worldTypes';
/**
 * Tag Health Analyzer Service
 */
export declare class TagHealthAnalyzer {
    /**
     * Analyze all tag usage in the graph and generate comprehensive health report
     */
    analyzeGraph(graph: Graph): TagHealthReport;
    /**
     * Calculate coverage metrics
     * Coverage: % of entities with appropriate tag count
     */
    calculateCoverage(entities: HardState[]): TagHealthReport['coverage'];
    /**
     * Calculate diversity metrics using Shannon entropy
     * High entropy = tags are evenly distributed (good)
     * Low entropy = tags are concentrated on few entities (bad)
     */
    calculateDiversity(entities: HardState[]): TagHealthReport['diversity'];
    /**
     * Get orphan tags (used 1-2 times, below minUsage threshold)
     */
    getOrphanTags(entities: HardState[]): Array<{
        tag: string;
        count: number;
    }>;
    /**
     * Get overused tags (exceeding maxUsage threshold)
     */
    getOverusedTags(entities: HardState[]): Array<{
        tag: string;
        count: number;
        max: number;
    }>;
    /**
     * Get entities with conflicting tags
     */
    getConflicts(entities: HardState[]): Array<{
        entityId: string;
        tags: string[];
        conflict: string;
    }>;
    /**
     * Identify all quality issues
     */
    private identifyIssues;
    /**
     * Identify entity-level issues
     */
    private identifyEntityIssues;
    /**
     * Generate actionable recommendations
     */
    private generateRecommendations;
    /**
     * Get a concise summary of tag health
     */
    getSummary(report: TagHealthReport): string;
    /**
     * Get detailed issue report (for debugging)
     */
    getDetailedIssues(report: TagHealthReport): string;
    /**
     * Check if adding tags to an entity would create saturation
     */
    checkTagSaturation(graph: Graph, tagsToAdd: string[]): {
        saturated: boolean;
        oversaturatedTags: string[];
    };
    /**
     * Check if tags are orphans (unregistered)
     */
    checkTagOrphans(tagsToAdd: string[]): {
        hasOrphans: boolean;
        orphanTags: string[];
    };
    /**
     * Validate tag taxonomy for conflicts
     */
    validateTagTaxonomy(entity: HardState): Array<{
        tag1: string;
        tag2: string;
        reason: string;
    }>;
}
//# sourceMappingURL=tagHealthAnalyzer.d.ts.map