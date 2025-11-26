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
/**
 * Tracks selection history for diversity pressure
 */
class SelectionTracker {
    selectionCounts = new Map();
    track(trackingId, entityId) {
        if (!this.selectionCounts.has(trackingId)) {
            this.selectionCounts.set(trackingId, new Map());
        }
        const counts = this.selectionCounts.get(trackingId);
        counts.set(entityId, (counts.get(entityId) || 0) + 1);
    }
    getCount(trackingId, entityId) {
        return this.selectionCounts.get(trackingId)?.get(entityId) || 0;
    }
    reset(trackingId) {
        if (trackingId) {
            this.selectionCounts.delete(trackingId);
        }
        else {
            this.selectionCounts.clear();
        }
    }
}
/**
 * Target Selector - Framework service for intelligent entity selection
 */
export class TargetSelector {
    tracker = new SelectionTracker();
    /**
     * Select entities using weighted scoring with hub penalties
     *
     * @param graph - World graph
     * @param kind - Entity kind to select
     * @param count - Number of entities to select
     * @param bias - Selection preferences and penalties
     * @returns Selection result with existing + created entities
     */
    selectTargets(graph, kind, count, bias = {}) {
        // Find all candidate entities
        const candidates = Array.from(graph.entities.values())
            .filter(e => e.kind === kind);
        if (candidates.length === 0) {
            // No candidates at all - must create if factory provided
            if (bias.createIfSaturated?.factory) {
                return this.createNewEntities(graph, count, bias, []);
            }
            return this.emptyResult();
        }
        // Score all candidates
        const scored = candidates.map(entity => ({
            entity,
            score: this.scoreCandidate(graph, entity, bias)
        }));
        // Apply hard filters (maxTotalRelationships, excludeRelatedTo)
        const filtered = this.applyHardFilters(graph, scored, bias);
        // Sort by score (highest first)
        filtered.sort((a, b) => b.score - a.score);
        // Check if best candidate is below saturation threshold
        const bestScore = filtered.length > 0 ? filtered[0].score : 0;
        const threshold = bias.createIfSaturated?.threshold ?? 0.1;
        if (bestScore < threshold && bias.createIfSaturated?.factory) {
            // All candidates oversaturated - create new entities
            return this.createNewEntities(graph, count, bias, filtered);
        }
        // Select top N candidates
        const selected = filtered.slice(0, count).map(s => s.entity);
        // Track selections for diversity
        if (bias.diversityTracking?.trackingId) {
            selected.forEach(e => this.tracker.track(bias.diversityTracking.trackingId, e.id));
        }
        // Calculate diagnostics
        const scores = filtered.map(s => s.score);
        const diagnostics = {
            candidatesEvaluated: candidates.length,
            bestScore: Math.max(...scores, 0),
            worstScore: Math.min(...scores, 0),
            avgScore: scores.reduce((a, b) => a + b, 0) / scores.length || 0,
            creationTriggered: false
        };
        return {
            existing: selected,
            created: [],
            diagnostics
        };
    }
    /**
     * Score a candidate entity based on bias configuration
     * Higher score = more desirable target
     */
    scoreCandidate(graph, entity, bias) {
        let score = 1.0; // Base score
        // === POSITIVE PREFERENCES ===
        if (bias.prefer) {
            const boost = bias.prefer.preferenceBoost ?? 2.0;
            // Subtype preference
            if (bias.prefer.subtypes?.includes(entity.subtype)) {
                score *= boost;
            }
            // Tag preference
            if (bias.prefer.tags?.some(tag => entity.tags.includes(tag))) {
                score *= boost;
            }
            // Prominence preference
            if (bias.prefer.prominence?.includes(entity.prominence)) {
                score *= boost;
            }
            // Location preference (same location as reference)
            if (bias.prefer.sameLocationAs) {
                const sameLocation = entity.links.some(l => l.kind === 'resident_of' &&
                    graph.entities.get(bias.prefer.sameLocationAs)?.links.some(rl => rl.kind === 'resident_of' && rl.dst === l.dst));
                if (sameLocation) {
                    score *= boost;
                }
            }
        }
        // === NEGATIVE PENALTIES ===
        if (bias.avoid) {
            // Count penalized relationships
            let penalizedCount = 0;
            if (bias.avoid.relationshipKinds) {
                penalizedCount = entity.links.filter(l => bias.avoid.relationshipKinds.includes(l.kind)).length;
            }
            // Hub penalty - exponential penalty for high-degree nodes
            // Formula: score *= (1 / (1 + count^strength))
            // Same formula as template diversity!
            const strength = bias.avoid.hubPenaltyStrength ?? 1.0;
            if (penalizedCount > 0) {
                const penalty = 1 / (1 + Math.pow(penalizedCount, strength));
                score *= penalty;
            }
            // Total relationship penalty (general hub avoidance)
            const totalLinks = entity.links.length;
            if (totalLinks > 5) { // Only penalize if significantly connected
                const generalPenalty = 1 / (1 + Math.pow(totalLinks - 5, 0.5));
                score *= generalPenalty;
            }
        }
        // === DIVERSITY PRESSURE ===
        if (bias.diversityTracking) {
            const selectionCount = this.tracker.getCount(bias.diversityTracking.trackingId, entity.id);
            if (selectionCount > 0) {
                const strength = bias.diversityTracking.strength ?? 1.0;
                const diversityPenalty = 1 / (1 + Math.pow(selectionCount, strength));
                score *= diversityPenalty;
            }
        }
        return Math.max(0, score);
    }
    /**
     * Apply hard filters that completely exclude candidates
     */
    applyHardFilters(graph, scored, bias) {
        let filtered = scored;
        if (bias.avoid?.maxTotalRelationships !== undefined) {
            filtered = filtered.filter(s => s.entity.links.length < bias.avoid.maxTotalRelationships);
        }
        if (bias.avoid?.excludeRelatedTo) {
            const { entityId, relationshipKind } = bias.avoid.excludeRelatedTo;
            filtered = filtered.filter(s => {
                const hasRelationship = graph.relationships.some(r => (r.src === s.entity.id && r.dst === entityId ||
                    r.src === entityId && r.dst === s.entity.id) &&
                    (!relationshipKind || r.kind === relationshipKind));
                return !hasRelationship;
            });
        }
        return filtered;
    }
    /**
     * Create new entities when all candidates are oversaturated
     */
    createNewEntities(graph, count, bias, candidates) {
        const factory = bias.createIfSaturated.factory;
        const maxCreated = bias.createIfSaturated.maxCreated ?? Math.ceil(count / 2);
        const numToCreate = Math.min(count, maxCreated);
        const context = {
            graph,
            requestedCount: count,
            bestCandidateScore: candidates.length > 0 ? candidates[0].score : 0,
            candidates
        };
        const created = [];
        for (let i = 0; i < numToCreate; i++) {
            created.push(factory(graph, context));
        }
        // Fill remaining slots with best existing candidates if needed
        const remaining = count - numToCreate;
        const existing = candidates.slice(0, remaining).map(s => s.entity);
        const scores = candidates.map(s => s.score);
        return {
            existing,
            created,
            diagnostics: {
                candidatesEvaluated: candidates.length,
                bestScore: Math.max(...scores, 0),
                worstScore: Math.min(...scores, 0),
                avgScore: scores.reduce((a, b) => a + b, 0) / scores.length || 0,
                creationTriggered: true,
                creationReason: `Best score ${context.bestCandidateScore.toFixed(2)} < threshold ${bias.createIfSaturated.threshold}`
            }
        };
    }
    emptyResult() {
        return {
            existing: [],
            created: [],
            diagnostics: {
                candidatesEvaluated: 0,
                bestScore: 0,
                worstScore: 0,
                avgScore: 0,
                creationTriggered: false
            }
        };
    }
    /**
     * Reset diversity tracking (call at epoch boundaries or specific events)
     */
    resetDiversityTracking(trackingId) {
        this.tracker.reset(trackingId);
    }
}
//# sourceMappingURL=targetSelector.js.map