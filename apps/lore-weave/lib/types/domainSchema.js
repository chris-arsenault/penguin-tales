/**
 * Domain Schema Types
 *
 * Defines the interface for domain-specific world configurations.
 * Framework code uses this interface to remain domain-agnostic.
 */
/**
 * Base implementation of DomainSchema with helper methods
 */
export class BaseDomainSchema {
    id;
    name;
    version;
    entityKinds;
    relationshipKinds;
    cultures;
    nameGenerator;
    relationshipConfig;
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.version = config.version;
        this.entityKinds = config.entityKinds;
        this.relationshipKinds = config.relationshipKinds;
        this.cultures = config.cultures;
        this.nameGenerator = config.nameGenerator;
        this.relationshipConfig = config.relationshipConfig;
    }
    getRelationshipKind(kind) {
        return this.relationshipKinds.find(rk => rk.kind === kind);
    }
    getEntityKind(kind) {
        return this.entityKinds.find(ek => ek.kind === kind);
    }
    getProtectedRelationshipKinds() {
        return this.relationshipKinds
            .filter(rk => rk.protected)
            .map(rk => rk.kind);
    }
    getImmutableRelationshipKinds() {
        return this.relationshipKinds
            .filter(rk => rk.mutability === 'immutable')
            .map(rk => rk.kind);
    }
    getMutableRelationshipKinds() {
        return this.relationshipKinds
            .filter(rk => rk.mutability === 'mutable')
            .map(rk => rk.kind);
    }
    getCulture(id) {
        return this.cultures.find(c => c.id === id);
    }
    getCultureIds() {
        return this.cultures.map(c => c.id);
    }
    /**
     * Validate that a relationship is allowed by this domain
     */
    validateRelationship(rel, graph) {
        const def = this.getRelationshipKind(rel.kind);
        if (!def)
            return false;
        const srcEntity = graph.entities.get(rel.src);
        const dstEntity = graph.entities.get(rel.dst);
        if (!srcEntity || !dstEntity)
            return false;
        // Check if source and destination kinds are allowed
        const srcAllowed = def.srcKinds.includes(srcEntity.kind);
        const dstAllowed = def.dstKinds.includes(dstEntity.kind);
        return srcAllowed && dstAllowed;
    }
    /**
     * Validate that an entity has all required relationships
     */
    validateEntityStructure(entity) {
        const kindDef = this.getEntityKind(entity.kind);
        if (!kindDef)
            return { valid: true, missing: [] };
        const missing = [];
        kindDef.requiredRelationships?.forEach(rule => {
            // Check condition if present
            if (rule.when && !rule.when(entity))
                return;
            // Check if entity has this relationship
            const hasRelationship = entity.links.some(l => l.kind === rule.kind);
            if (!hasRelationship) {
                missing.push(rule.kind);
            }
        });
        return {
            valid: missing.length === 0,
            missing
        };
    }
    // ===========================
    // RELATIONSHIP BEHAVIOR METHODS
    // ===========================
    /**
     * Get narrative strength for a relationship kind (0.0-1.0)
     * Reads from RelationshipKindDefinition.strength, falls back to config default
     */
    getRelationshipStrength(kind) {
        const def = this.getRelationshipKind(kind);
        if (def?.strength !== undefined) {
            return def.strength;
        }
        return this.relationshipConfig?.defaultStrength ?? 0.5;
    }
    /**
     * Get behavioral category for a relationship kind
     * Reads from RelationshipKindDefinition.category, falls back to config default
     */
    getRelationshipCategory(kind) {
        const def = this.getRelationshipKind(kind);
        if (def?.category) {
            return def.category;
        }
        return this.relationshipConfig?.defaultCategory ?? 'social';
    }
    /**
     * Get warning threshold for relationship count
     * Uses per-entity-kind limits from relationshipConfig
     */
    getRelationshipWarningThreshold(entityKind, relationshipKind) {
        const limits = this.relationshipConfig?.limits?.[entityKind];
        if (!limits) {
            return 10; // Sensible default
        }
        return limits.perKind?.[relationshipKind] ?? limits.default;
    }
    /**
     * Check if a relationship kind requires distance (is a lineage relationship)
     */
    isLineageRelationship(kind) {
        const def = this.getRelationshipKind(kind);
        return def?.isLineage === true;
    }
    /**
     * Get expected distance range for a lineage relationship kind
     * Returns undefined for non-lineage relationships
     */
    getExpectedDistanceRange(kind) {
        const def = this.getRelationshipKind(kind);
        if (!def?.isLineage)
            return undefined;
        return def.distanceRange;
    }
    /**
     * Check if a new relationship conflicts with existing relationships
     * Returns true if there is a conflict (should not create relationship)
     */
    checkRelationshipConflict(existingKinds, newKind) {
        const def = this.getRelationshipKind(newKind);
        if (!def?.conflictsWith)
            return false;
        return existingKinds.some(existing => def.conflictsWith.includes(existing));
    }
    /**
     * Get all lineage relationship kinds
     */
    getLineageRelationshipKinds() {
        return this.relationshipKinds
            .filter(rk => rk.isLineage === true)
            .map(rk => rk.kind);
    }
}
//# sourceMappingURL=domainSchema.js.map