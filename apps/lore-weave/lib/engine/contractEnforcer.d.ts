import { Graph, GrowthTemplate, EngineConfig } from '../types/engine';
import { TemplateGraphView } from '../services/templateGraphView';
import { HardState, Relationship } from '../types/worldTypes';
import { TagHealthAnalyzer } from '../services/tagHealthAnalyzer';
/**
 * ContractEnforcer
 *
 * Active framework enforcement that uses component contracts to:
 * 1. Filter templates based on enabledBy conditions
 * 2. Automatically add lineage relationships
 * 3. Prevent saturation of entity kinds
 * 4. Validate template results match contract declarations
 * 5. Enforce tag constraints (saturation, coverage, taxonomy)
 */
export declare class ContractEnforcer {
    private config;
    private tagAnalyzer;
    constructor(config: EngineConfig);
    /**
     * ENFORCEMENT 1: Contract-Based Template Filtering
     *
     * Checks contract.enabledBy conditions before allowing template to run.
     * This is more formal than template.canApply() and enforces framework-level rules.
     */
    checkContractEnabledBy(template: GrowthTemplate, graph: Graph, graphView: TemplateGraphView): {
        allowed: boolean;
        reason?: string;
    };
    /**
     * ENFORCEMENT 2: Automatic Lineage Enforcement
     *
     * After template creates entities, automatically adds lineage relationships
     * using the entity registry's lineage function.
     */
    enforceLineage(graph: Graph, graphView: TemplateGraphView, newEntities: HardState[]): Relationship[];
    /**
     * ENFORCEMENT 3: Registry-Based Saturation Control
     *
     * Checks if templates would create entities of kinds/subtypes that are already saturated.
     * Uses entity registries' expectedDistribution.targetCount.
     * Prefers subtype-specific registries over kind-level registries.
     */
    checkSaturation(template: GrowthTemplate, graph: Graph): {
        saturated: boolean;
        reason?: string;
    };
    /**
     * ENFORCEMENT 4: Contract Affects Validation
     *
     * After template runs, validates that actual effects match contract declarations.
     * Warns if template creates more/fewer entities or relationships than declared.
     */
    validateAffects(template: GrowthTemplate, entitiesCreated: number, relationshipsCreated: number, pressureChanges: Map<string, number>): string[];
    /**
     * ENFORCEMENT 5: Check Tag Saturation
     *
     * Before template runs, check if it would add overused tags.
     * Uses tag registry to determine expected counts per tag.
     */
    checkTagSaturation(graph: Graph, tagsToAdd: string[]): {
        saturated: boolean;
        oversaturatedTags: string[];
        reason?: string;
    };
    /**
     * ENFORCEMENT 6: Check Tag Orphans
     *
     * Warn if template creates single-use tags not in registry.
     * Legendary tags (single-use by design) are expected and don't trigger warnings.
     */
    checkTagOrphans(tagsToAdd: string[]): {
        hasOrphans: boolean;
        orphanTags: string[];
    };
    /**
     * ENFORCEMENT 7: Enforce Tag Coverage
     *
     * After entity creation, ensure it has 3-5 tags.
     * Returns suggested tags to add or remove.
     */
    enforceTagCoverage(entity: HardState, graph: Graph): {
        needsAdjustment: boolean;
        suggestion: string;
        tagsToAdd?: string[];
        tagsToRemove?: string[];
    };
    /**
     * ENFORCEMENT 8: Validate Tag Taxonomy
     *
     * Check for conflicting tags on entities (e.g., peaceful + warlike).
     * Returns conflicts if found.
     */
    validateTagTaxonomy(entity: HardState): {
        valid: boolean;
        conflicts: Array<{
            tag1: string;
            tag2: string;
            reason: string;
        }>;
    };
    /**
     * Get diagnostic info for why a template cannot run
     */
    getDiagnostic(template: GrowthTemplate, graph: Graph, graphView: TemplateGraphView): string;
    /**
     * Get tag health analyzer instance for external use
     */
    getTagAnalyzer(): TagHealthAnalyzer;
}
//# sourceMappingURL=contractEnforcer.d.ts.map