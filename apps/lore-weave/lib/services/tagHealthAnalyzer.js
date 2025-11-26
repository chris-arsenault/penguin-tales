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
import { getTagMetadata, tagsConflict, validateEntityTags, getConsolidationSuggestions } from '../config/tagRegistry';
/**
 * Tag Health Analyzer Service
 */
export class TagHealthAnalyzer {
    /**
     * Analyze all tag usage in the graph and generate comprehensive health report
     */
    analyzeGraph(graph) {
        const entities = Array.from(graph.entities.values());
        // Calculate coverage metrics
        const coverage = this.calculateCoverage(entities);
        // Calculate diversity metrics
        const diversity = this.calculateDiversity(entities);
        // Identify quality issues
        const issues = this.identifyIssues(entities);
        // Identify entity-level issues
        const entityIssues = this.identifyEntityIssues(entities);
        // Generate recommendations
        const recommendations = this.generateRecommendations(coverage, diversity, issues, entityIssues);
        return {
            coverage,
            diversity,
            issues,
            entityIssues,
            recommendations
        };
    }
    /**
     * Calculate coverage metrics
     * Coverage: % of entities with appropriate tag count
     */
    calculateCoverage(entities) {
        const totalEntities = entities.length;
        const entitiesWithTags = entities.filter(e => e.tags.length > 0).length;
        const entitiesWithOptimalTags = entities.filter(e => e.tags.length >= 3 && e.tags.length <= 5).length;
        return {
            totalEntities,
            entitiesWithTags,
            entitiesWithOptimalTags,
            coveragePercentage: totalEntities > 0 ? (entitiesWithTags / totalEntities) * 100 : 0,
            optimalCoveragePercentage: totalEntities > 0 ? (entitiesWithOptimalTags / totalEntities) * 100 : 0
        };
    }
    /**
     * Calculate diversity metrics using Shannon entropy
     * High entropy = tags are evenly distributed (good)
     * Low entropy = tags are concentrated on few entities (bad)
     */
    calculateDiversity(entities) {
        // Count tag occurrences
        const tagCounts = new Map();
        let totalTagInstances = 0;
        for (const entity of entities) {
            for (const tag of entity.tags) {
                // Handle dynamic location tags
                const normalizedTag = tag.startsWith('name:') ? 'name:*' : tag;
                tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
                totalTagInstances++;
            }
        }
        const uniqueTags = tagCounts.size;
        // Calculate Shannon index H = -Σ(p_i * ln(p_i))
        let shannonIndex = 0;
        for (const count of tagCounts.values()) {
            const p = count / totalTagInstances;
            if (p > 0) {
                shannonIndex -= p * Math.log(p);
            }
        }
        // Calculate evenness (normalized Shannon index)
        // Evenness = H / ln(S) where S is number of unique tags
        const maxPossibleEntropy = uniqueTags > 1 ? Math.log(uniqueTags) : 1;
        const evenness = shannonIndex / maxPossibleEntropy;
        return {
            uniqueTags,
            shannonIndex,
            evenness
        };
    }
    /**
     * Get orphan tags (used 1-2 times, below minUsage threshold)
     */
    getOrphanTags(entities) {
        const tagCounts = new Map();
        for (const entity of entities) {
            for (const tag of entity.tags) {
                const normalizedTag = tag.startsWith('name:') ? 'name:*' : tag;
                tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
            }
        }
        const orphanTags = [];
        for (const [tag, count] of tagCounts.entries()) {
            const metadata = getTagMetadata(tag);
            if (metadata && metadata.minUsage) {
                if (count < metadata.minUsage) {
                    orphanTags.push({ tag, count });
                }
            }
            else if (count <= 2) {
                // Unregistered tags used only 1-2 times
                orphanTags.push({ tag, count });
            }
        }
        return orphanTags.sort((a, b) => a.count - b.count);
    }
    /**
     * Get overused tags (exceeding maxUsage threshold)
     */
    getOverusedTags(entities) {
        const tagCounts = new Map();
        for (const entity of entities) {
            for (const tag of entity.tags) {
                const normalizedTag = tag.startsWith('name:') ? 'name:*' : tag;
                tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
            }
        }
        const overusedTags = [];
        for (const [tag, count] of tagCounts.entries()) {
            const metadata = getTagMetadata(tag);
            if (metadata?.maxUsage && count > metadata.maxUsage) {
                overusedTags.push({ tag, count, max: metadata.maxUsage });
            }
        }
        return overusedTags.sort((a, b) => b.count - a.count);
    }
    /**
     * Get entities with conflicting tags
     */
    getConflicts(entities) {
        const conflicts = [];
        for (const entity of entities) {
            const validation = validateEntityTags(entity.tags);
            if (!validation.valid) {
                for (const conflict of validation.conflicts) {
                    conflicts.push({
                        entityId: entity.id,
                        tags: entity.tags,
                        conflict
                    });
                }
            }
        }
        return conflicts;
    }
    /**
     * Identify all quality issues
     */
    identifyIssues(entities) {
        const orphanTags = this.getOrphanTags(entities);
        const overusedTags = this.getOverusedTags(entities);
        const conflicts = this.getConflicts(entities);
        // Get consolidation opportunities from registry
        const consolidationSuggestions = getConsolidationSuggestions();
        // Count actual usage of tags marked for consolidation
        const tagCounts = new Map();
        for (const entity of entities) {
            for (const tag of entity.tags) {
                const normalizedTag = tag.startsWith('name:') ? 'name:*' : tag;
                tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
            }
        }
        const consolidationOpportunities = consolidationSuggestions.map(({ from, to }) => ({
            from,
            to,
            count: tagCounts.get(from) || 0
        })).filter(c => c.count > 0);
        return {
            orphanTags,
            overusedTags,
            conflicts,
            consolidationOpportunities
        };
    }
    /**
     * Identify entity-level issues
     */
    identifyEntityIssues(entities) {
        const undertagged = [];
        const overtagged = [];
        for (const entity of entities) {
            if (entity.tags.length < 3) {
                undertagged.push(entity.id);
            }
            else if (entity.tags.length > 5) {
                // This shouldn't happen due to the 5-tag constraint, but check anyway
                overtagged.push(entity.id);
            }
        }
        return {
            undertagged,
            overtagged
        };
    }
    /**
     * Generate actionable recommendations
     */
    generateRecommendations(coverage, diversity, issues, entityIssues) {
        const recommendations = [];
        // Coverage recommendations
        if (coverage.coveragePercentage < 95) {
            recommendations.push(`Tag coverage is ${coverage.coveragePercentage.toFixed(1)}%. Consider adding tags to ${coverage.totalEntities - coverage.entitiesWithTags} entities.`);
        }
        if (coverage.optimalCoveragePercentage < 70) {
            recommendations.push(`Only ${coverage.optimalCoveragePercentage.toFixed(1)}% of entities have optimal tag count (3-5 tags). ` +
                `Target: 70%+. ${entityIssues.undertagged.length} entities need more tags.`);
        }
        // Diversity recommendations
        if (diversity.evenness < 0.6) {
            recommendations.push(`Tag distribution is uneven (evenness: ${diversity.evenness.toFixed(2)}). ` +
                `Some tags are overused while others are underused. Aim for evenness > 0.6.`);
        }
        // Orphan tag recommendations
        if (issues.orphanTags.length > 10) {
            recommendations.push(`${issues.orphanTags.length} orphan tags detected (used < minUsage). ` +
                `Consider: (1) increasing their usage, (2) removing them, or (3) adjusting minUsage thresholds.`);
        }
        // Overused tag recommendations
        if (issues.overusedTags.length > 0) {
            const topOverused = issues.overusedTags[0];
            recommendations.push(`${issues.overusedTags.length} tags exceed maxUsage. ` +
                `Top offender: "${topOverused.tag}" (${topOverused.count}/${topOverused.max}). ` +
                `Consider raising maxUsage or reducing template frequency.`);
        }
        // Conflict recommendations
        if (issues.conflicts.length > 0) {
            recommendations.push(`${issues.conflicts.length} tag conflicts detected. ` +
                `Review conflictingTags definitions in tagRegistry.ts or fix template logic.`);
        }
        // Consolidation recommendations
        if (issues.consolidationOpportunities.length > 0) {
            const totalConsolidatable = issues.consolidationOpportunities.reduce((sum, c) => sum + c.count, 0);
            recommendations.push(`${issues.consolidationOpportunities.length} tags marked for consolidation (${totalConsolidatable} total uses). ` +
                `Merge: ${issues.consolidationOpportunities.map(c => `"${c.from}" → "${c.to}"`).join(', ')}`);
        }
        // Overall health recommendation
        if (recommendations.length === 0) {
            recommendations.push('Tag health is excellent! All metrics are within target ranges.');
        }
        return recommendations;
    }
    /**
     * Get a concise summary of tag health
     */
    getSummary(report) {
        const lines = [];
        lines.push('=== TAG HEALTH SUMMARY ===');
        lines.push('');
        lines.push('COVERAGE:');
        lines.push(`  Total entities: ${report.coverage.totalEntities}`);
        lines.push(`  With tags: ${report.coverage.entitiesWithTags} (${report.coverage.coveragePercentage.toFixed(1)}%)`);
        lines.push(`  Optimal (3-5 tags): ${report.coverage.entitiesWithOptimalTags} (${report.coverage.optimalCoveragePercentage.toFixed(1)}%)`);
        lines.push('');
        lines.push('DIVERSITY:');
        lines.push(`  Unique tags: ${report.diversity.uniqueTags}`);
        lines.push(`  Shannon index: ${report.diversity.shannonIndex.toFixed(3)}`);
        lines.push(`  Evenness: ${report.diversity.evenness.toFixed(3)} (target: >0.6)`);
        lines.push('');
        lines.push('ISSUES:');
        lines.push(`  Orphan tags: ${report.issues.orphanTags.length}`);
        lines.push(`  Overused tags: ${report.issues.overusedTags.length}`);
        lines.push(`  Tag conflicts: ${report.issues.conflicts.length}`);
        lines.push(`  Consolidation opportunities: ${report.issues.consolidationOpportunities.length}`);
        lines.push('');
        lines.push('ENTITY ISSUES:');
        lines.push(`  Undertagged (<3 tags): ${report.entityIssues.undertagged.length}`);
        lines.push(`  Overtagged (>5 tags): ${report.entityIssues.overtagged.length}`);
        lines.push('');
        lines.push('RECOMMENDATIONS:');
        for (const rec of report.recommendations) {
            lines.push(`  - ${rec}`);
        }
        return lines.join('\n');
    }
    /**
     * Get detailed issue report (for debugging)
     */
    getDetailedIssues(report) {
        const lines = [];
        if (report.issues.orphanTags.length > 0) {
            lines.push('');
            lines.push('ORPHAN TAGS (used < minUsage):');
            for (const { tag, count } of report.issues.orphanTags) {
                const metadata = getTagMetadata(tag);
                const minUsage = metadata?.minUsage || 3;
                lines.push(`  ${tag.padEnd(30)} (${count}/${minUsage})`);
            }
        }
        if (report.issues.overusedTags.length > 0) {
            lines.push('');
            lines.push('OVERUSED TAGS (exceeding maxUsage):');
            for (const { tag, count, max } of report.issues.overusedTags) {
                lines.push(`  ${tag.padEnd(30)} (${count}/${max})`);
            }
        }
        if (report.issues.conflicts.length > 0) {
            lines.push('');
            lines.push('TAG CONFLICTS:');
            for (const { entityId, conflict } of report.issues.conflicts) {
                lines.push(`  Entity ${entityId}: ${conflict}`);
            }
        }
        if (report.issues.consolidationOpportunities.length > 0) {
            lines.push('');
            lines.push('CONSOLIDATION OPPORTUNITIES:');
            for (const { from, to, count } of report.issues.consolidationOpportunities) {
                lines.push(`  "${from}" → "${to}" (${count} uses)`);
            }
        }
        return lines.join('\n');
    }
    /**
     * Check if adding tags to an entity would create saturation
     */
    checkTagSaturation(graph, tagsToAdd) {
        // Count current tag usage
        const tagCounts = new Map();
        for (const entity of graph.entities.values()) {
            for (const tag of entity.tags) {
                const normalizedTag = tag.startsWith('name:') ? 'name:*' : tag;
                tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
            }
        }
        // Check which tags would exceed maxUsage
        const oversaturatedTags = [];
        for (const tag of tagsToAdd) {
            const metadata = getTagMetadata(tag);
            if (!metadata?.maxUsage)
                continue;
            const currentCount = tagCounts.get(tag) || 0;
            const newCount = currentCount + 1;
            if (newCount > metadata.maxUsage) {
                oversaturatedTags.push(tag);
            }
        }
        return {
            saturated: oversaturatedTags.length > 0,
            oversaturatedTags
        };
    }
    /**
     * Check if tags are orphans (unregistered)
     */
    checkTagOrphans(tagsToAdd) {
        const orphanTags = tagsToAdd.filter(tag => {
            const normalizedTag = tag.startsWith('name:') ? 'name:*' : tag;
            return !getTagMetadata(normalizedTag);
        });
        return {
            hasOrphans: orphanTags.length > 0,
            orphanTags
        };
    }
    /**
     * Validate tag taxonomy for conflicts
     */
    validateTagTaxonomy(entity) {
        const conflicts = [];
        for (let i = 0; i < entity.tags.length; i++) {
            for (let j = i + 1; j < entity.tags.length; j++) {
                const tag1 = entity.tags[i];
                const tag2 = entity.tags[j];
                if (tagsConflict(tag1, tag2)) {
                    conflicts.push({
                        tag1,
                        tag2,
                        reason: `${tag1} conflicts with ${tag2}`
                    });
                }
            }
        }
        return conflicts;
    }
}
//# sourceMappingURL=tagHealthAnalyzer.js.map