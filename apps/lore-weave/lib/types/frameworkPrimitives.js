/**
 * Framework Primitives
 *
 * Defines the domain-agnostic entity kinds, relationship kinds, and status values
 * that the framework requires to function. These are the "base domain" types that
 * exist regardless of the specific world being generated.
 *
 * Domain schemas extend these with their own entity kinds, relationships, etc.
 */
// ===========================
// FRAMEWORK ENTITY KINDS
// ===========================
/**
 * Entity kinds that the framework creates and manages directly.
 * These exist in every world regardless of domain.
 */
export const FRAMEWORK_ENTITY_KINDS = {
    /** Time periods that structure the simulation */
    ERA: 'era',
    /** Events/happenings during the simulation */
    OCCURRENCE: 'occurrence',
};
/** Array of all framework entity kind values */
export const FRAMEWORK_ENTITY_KIND_VALUES = Object.values(FRAMEWORK_ENTITY_KINDS);
// ===========================
// FRAMEWORK RELATIONSHIP KINDS
// ===========================
/**
 * Relationship kinds that the framework uses for structural integrity.
 * These are the "immutable facts" that the framework needs to track.
 */
export const FRAMEWORK_RELATIONSHIP_KINDS = {
    /** Lineage relationship between eras (newer era supersedes older) */
    SUPERSEDES: 'supersedes',
    /** Subsumption relationship (entity is part of a meta-entity) */
    PART_OF: 'part_of',
    /** Temporal association (entity was active during an era) */
    ACTIVE_DURING: 'active_during',
};
/** Array of all framework relationship kind values */
export const FRAMEWORK_RELATIONSHIP_KIND_VALUES = Object.values(FRAMEWORK_RELATIONSHIP_KINDS);
// ===========================
// FRAMEWORK STATUS VALUES
// ===========================
/**
 * Status values that have framework-level meaning.
 * These indicate structural state rather than domain-specific state.
 */
export const FRAMEWORK_STATUS = {
    /** Entity or relationship is currently active/valid */
    ACTIVE: 'active',
    /** Entity or relationship has been archived (past state) */
    HISTORICAL: 'historical',
    /** Era-specific: currently running era */
    CURRENT: 'current',
    /** Era-specific: queued future era */
    FUTURE: 'future',
};
/** Array of all framework status values */
export const FRAMEWORK_STATUS_VALUES = Object.values(FRAMEWORK_STATUS);
// ===========================
// TYPE GUARDS
// ===========================
/**
 * Check if an entity kind is a framework-level kind
 */
export function isFrameworkEntityKind(kind) {
    return FRAMEWORK_ENTITY_KIND_VALUES.includes(kind);
}
/**
 * Check if a relationship kind is a framework-level kind
 */
export function isFrameworkRelationshipKind(kind) {
    return FRAMEWORK_RELATIONSHIP_KIND_VALUES.includes(kind);
}
/**
 * Check if a status value is a framework-level status
 */
export function isFrameworkStatus(status) {
    return FRAMEWORK_STATUS_VALUES.includes(status);
}
/**
 * Check if an entity is a framework-created entity
 */
export function isFrameworkEntity(entity) {
    return isFrameworkEntityKind(entity.kind);
}
/**
 * Check if a relationship is a framework-created relationship
 */
export function isFrameworkRelationship(relationship) {
    return isFrameworkRelationshipKind(relationship.kind);
}
// ===========================
// FRAMEWORK ENTITY SUBTYPES
// ===========================
/**
 * Subtypes for framework entity kinds.
 * Note: Era subtypes are defined by the domain (e.g., 'expansion', 'conflict')
 * but the framework needs to know they exist.
 */
export const FRAMEWORK_ERA_STATUS_VALUES = [
    FRAMEWORK_STATUS.CURRENT,
    FRAMEWORK_STATUS.FUTURE,
    FRAMEWORK_STATUS.HISTORICAL,
];
export const FRAMEWORK_OCCURRENCE_STATUS_VALUES = [
    FRAMEWORK_STATUS.ACTIVE,
    FRAMEWORK_STATUS.HISTORICAL,
];
// ===========================
// RELATIONSHIP PROPERTIES
// ===========================
/**
 * Framework relationships and their properties.
 * Used for default distance/strength values and culling behavior.
 */
export const FRAMEWORK_RELATIONSHIP_PROPERTIES = {
    [FRAMEWORK_RELATIONSHIP_KINDS.SUPERSEDES]: {
        defaultStrength: 0.7,
        protected: true,
        mutability: 'immutable',
        description: 'Era lineage (newer era supersedes older)',
    },
    [FRAMEWORK_RELATIONSHIP_KINDS.PART_OF]: {
        defaultStrength: 0.5,
        protected: true,
        mutability: 'immutable',
        description: 'Subsumption into meta-entity',
    },
    [FRAMEWORK_RELATIONSHIP_KINDS.ACTIVE_DURING]: {
        defaultStrength: 0.3,
        protected: false,
        mutability: 'immutable',
        description: 'Temporal association with era',
    },
};
/**
 * Get the default strength for a framework relationship kind
 */
export function getFrameworkRelationshipStrength(kind) {
    return FRAMEWORK_RELATIONSHIP_PROPERTIES[kind].defaultStrength;
}
/**
 * Check if a framework relationship kind is protected from culling
 */
export function isProtectedFrameworkRelationship(kind) {
    if (!isFrameworkRelationshipKind(kind))
        return false;
    return FRAMEWORK_RELATIONSHIP_PROPERTIES[kind].protected;
}
//# sourceMappingURL=frameworkPrimitives.js.map