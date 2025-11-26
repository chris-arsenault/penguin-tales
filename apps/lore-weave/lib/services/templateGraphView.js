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
export class TemplateGraphView {
    graph;
    targetSelector;
    constructor(graph, targetSelector) {
        this.graph = graph;
        this.targetSelector = targetSelector;
    }
    // ============================================================================
    // TARGET SELECTION (PRIMARY INTERFACE)
    // ============================================================================
    /**
     * Select targets using intelligent hub-aware selection
     * This is the RECOMMENDED way to select entities for connections
     *
     * Wraps targetSelector.selectTargets() to hide internal graph access
     */
    selectTargets(kind, count, bias) {
        // Delegate to targetSelector with internal graph access
        return this.targetSelector.selectTargets(this.graph, kind, count, bias);
    }
    // ============================================================================
    // READ-ONLY GRAPH STATE
    // ============================================================================
    /** Current simulation tick */
    get tick() {
        return this.graph.tick;
    }
    /** Current era */
    get currentEra() {
        return this.graph.currentEra;
    }
    /** Current pressure values (read-only) */
    getPressure(pressureId) {
        return this.graph.pressures.get(pressureId) || 0;
    }
    /** Get all pressure values as read-only map */
    getAllPressures() {
        return this.graph.pressures;
    }
    /** Get engine configuration (read-only) */
    get config() {
        return this.graph.config;
    }
    /** Get discovery state (for location templates) */
    get discoveryState() {
        return this.graph.discoveryState;
    }
    /**
     * Get direct access to the internal graph.
     * Use when you need full graph access beyond what TemplateGraphView provides.
     */
    getInternalGraph() {
        return this.graph;
    }
    // ============================================================================
    // SAFE ENTITY QUERIES (NO DIRECT MAP ACCESS)
    // ============================================================================
    /**
     * Get a specific entity by ID (returns undefined if not found)
     * Safe for templates to check specific entities they already know about
     */
    getEntity(id) {
        return this.graph.entities.get(id);
    }
    /**
     * Check if an entity exists
     */
    hasEntity(id) {
        return this.graph.entities.has(id);
    }
    /**
     * Get total entity count (useful for canApply checks)
     */
    getEntityCount(kind, subtype) {
        if (!kind) {
            return this.graph.entities.size;
        }
        let count = 0;
        for (const entity of this.graph.entities.values()) {
            if (entity.kind === kind && (!subtype || entity.subtype === subtype)) {
                count++;
            }
        }
        return count;
    }
    /**
     * Find entities matching criteria
     *
     * NOTE: Use sparingly for canApply() checks and validation logic.
     * For entity SELECTION, use targetSelector.selectTargets() instead
     * to ensure proper hub-aware distribution.
     */
    findEntities(criteria) {
        const results = [];
        for (const entity of this.graph.entities.values()) {
            let matches = true;
            if (criteria.kind && entity.kind !== criteria.kind)
                matches = false;
            if (criteria.subtype && entity.subtype !== criteria.subtype)
                matches = false;
            if (criteria.status && entity.status !== criteria.status)
                matches = false;
            if (criteria.prominence && entity.prominence !== criteria.prominence)
                matches = false;
            if (criteria.tag && !entity.tags.includes(criteria.tag))
                matches = false;
            if (matches)
                results.push(entity);
        }
        return results;
    }
    /**
     * Get all relationships in the graph (read-only)
     */
    getAllRelationships() {
        return this.graph.relationships;
    }
    /**
     * Get relationships for a specific entity
     */
    getRelationships(entityId, kind) {
        const entity = this.graph.entities.get(entityId);
        if (!entity)
            return [];
        if (kind) {
            return entity.links.filter(link => link.kind === kind);
        }
        return [...entity.links];
    }
    /**
     * Get entities related to a specific entity
     */
    getRelatedEntities(entityId, relationshipKind, direction) {
        const entity = this.graph.entities.get(entityId);
        if (!entity)
            return [];
        const related = [];
        const dir = direction || 'both';
        for (const link of entity.links) {
            if (relationshipKind && link.kind !== relationshipKind)
                continue;
            if ((dir === 'src' || dir === 'both') && link.src === entityId) {
                const target = this.graph.entities.get(link.dst);
                if (target)
                    related.push(target);
            }
            if ((dir === 'dst' || dir === 'both') && link.dst === entityId) {
                const source = this.graph.entities.get(link.src);
                if (source)
                    related.push(source);
            }
        }
        return related;
    }
    /**
     * Check if a relationship exists between two entities
     */
    hasRelationship(srcId, dstId, kind) {
        const src = this.graph.entities.get(srcId);
        if (!src)
            return false;
        return src.links.some(link => {
            const kindMatches = !kind || link.kind === kind;
            const targetMatches = link.dst === dstId || link.src === dstId;
            return kindMatches && targetMatches;
        });
    }
    /**
     * Get relationship cooldown remaining ticks
     * Returns 0 if no cooldown, otherwise ticks remaining
     */
    getRelationshipCooldown(entityId, relationshipType) {
        const cooldownMap = this.graph.relationshipCooldowns.get(entityId);
        if (!cooldownMap)
            return 0;
        const lastFormationTick = cooldownMap.get(relationshipType);
        if (lastFormationTick === undefined)
            return 0;
        const cooldownPeriod = 10; // Same as defined in worldEngine
        const ticksSinceFormation = this.graph.tick - lastFormationTick;
        const ticksRemaining = cooldownPeriod - ticksSinceFormation;
        return Math.max(0, ticksRemaining);
    }
    /**
     * Check if an entity can form a new relationship of a given type
     * (respects cooldowns)
     */
    canFormRelationship(entityId, relationshipType) {
        return this.getRelationshipCooldown(entityId, relationshipType) === 0;
    }
    // ============================================================================
    // HELPER METHODS (DOMAIN-AGNOSTIC)
    // ============================================================================
    /**
     * Get the location of an entity (follows 'resident_of' or 'located_at' links)
     */
    getLocation(entityId) {
        const entity = this.graph.entities.get(entityId);
        if (!entity)
            return undefined;
        const locationLink = entity.links.find(link => link.kind === 'resident_of' || link.kind === 'located_at');
        if (!locationLink)
            return undefined;
        const locationId = locationLink.src === entityId ? locationLink.dst : locationLink.src;
        return this.graph.entities.get(locationId);
    }
    /**
     * Get all members of a faction (follows 'member_of' links in reverse)
     */
    getFactionMembers(factionId) {
        const members = [];
        for (const entity of this.graph.entities.values()) {
            if (entity.links.some(link => link.kind === 'member_of' && link.dst === factionId)) {
                members.push(entity);
            }
        }
        return members;
    }
    /**
     * Get the leader of a faction (follows 'leader_of' link in reverse)
     */
    getFactionLeader(factionId) {
        for (const entity of this.graph.entities.values()) {
            if (entity.links.some(link => link.kind === 'leader_of' && link.dst === factionId)) {
                return entity;
            }
        }
        return undefined;
    }
}
//# sourceMappingURL=templateGraphView.js.map