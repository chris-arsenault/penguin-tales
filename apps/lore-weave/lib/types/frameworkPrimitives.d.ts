/**
 * Framework Primitives
 *
 * Defines the domain-agnostic entity kinds, relationship kinds, and status values
 * that the framework requires to function. These are the "base domain" types that
 * exist regardless of the specific world being generated.
 *
 * Domain schemas extend these with their own entity kinds, relationships, etc.
 */
import { HardState, Relationship } from './worldTypes';
/**
 * Entity kinds that the framework creates and manages directly.
 * These exist in every world regardless of domain.
 */
export declare const FRAMEWORK_ENTITY_KINDS: {
    /** Time periods that structure the simulation */
    readonly ERA: "era";
    /** Events/happenings during the simulation */
    readonly OCCURRENCE: "occurrence";
};
/** Type for framework entity kinds */
export type FrameworkEntityKind = typeof FRAMEWORK_ENTITY_KINDS[keyof typeof FRAMEWORK_ENTITY_KINDS];
/** Array of all framework entity kind values */
export declare const FRAMEWORK_ENTITY_KIND_VALUES: readonly FrameworkEntityKind[];
/**
 * Relationship kinds that the framework uses for structural integrity.
 * These are the "immutable facts" that the framework needs to track.
 */
export declare const FRAMEWORK_RELATIONSHIP_KINDS: {
    /** Lineage relationship between eras (newer era supersedes older) */
    readonly SUPERSEDES: "supersedes";
    /** Subsumption relationship (entity is part of a meta-entity) */
    readonly PART_OF: "part_of";
    /** Temporal association (entity was active during an era) */
    readonly ACTIVE_DURING: "active_during";
};
/** Type for framework relationship kinds */
export type FrameworkRelationshipKind = typeof FRAMEWORK_RELATIONSHIP_KINDS[keyof typeof FRAMEWORK_RELATIONSHIP_KINDS];
/** Array of all framework relationship kind values */
export declare const FRAMEWORK_RELATIONSHIP_KIND_VALUES: readonly FrameworkRelationshipKind[];
/**
 * Status values that have framework-level meaning.
 * These indicate structural state rather than domain-specific state.
 */
export declare const FRAMEWORK_STATUS: {
    /** Entity or relationship is currently active/valid */
    readonly ACTIVE: "active";
    /** Entity or relationship has been archived (past state) */
    readonly HISTORICAL: "historical";
    /** Era-specific: currently running era */
    readonly CURRENT: "current";
    /** Era-specific: queued future era */
    readonly FUTURE: "future";
};
/** Type for framework status values */
export type FrameworkStatus = typeof FRAMEWORK_STATUS[keyof typeof FRAMEWORK_STATUS];
/** Array of all framework status values */
export declare const FRAMEWORK_STATUS_VALUES: readonly FrameworkStatus[];
/**
 * Check if an entity kind is a framework-level kind
 */
export declare function isFrameworkEntityKind(kind: string): kind is FrameworkEntityKind;
/**
 * Check if a relationship kind is a framework-level kind
 */
export declare function isFrameworkRelationshipKind(kind: string): kind is FrameworkRelationshipKind;
/**
 * Check if a status value is a framework-level status
 */
export declare function isFrameworkStatus(status: string): status is FrameworkStatus;
/**
 * Check if an entity is a framework-created entity
 */
export declare function isFrameworkEntity(entity: HardState): boolean;
/**
 * Check if a relationship is a framework-created relationship
 */
export declare function isFrameworkRelationship(relationship: Relationship): boolean;
/**
 * Subtypes for framework entity kinds.
 * Note: Era subtypes are defined by the domain (e.g., 'expansion', 'conflict')
 * but the framework needs to know they exist.
 */
export declare const FRAMEWORK_ERA_STATUS_VALUES: readonly ["current", "future", "historical"];
export declare const FRAMEWORK_OCCURRENCE_STATUS_VALUES: readonly ["active", "historical"];
/**
 * Framework relationships and their properties.
 * Used for default distance/strength values and culling behavior.
 */
export declare const FRAMEWORK_RELATIONSHIP_PROPERTIES: {
    readonly supersedes: {
        readonly defaultStrength: 0.7;
        readonly protected: true;
        readonly mutability: "immutable";
        readonly description: "Era lineage (newer era supersedes older)";
    };
    readonly part_of: {
        readonly defaultStrength: 0.5;
        readonly protected: true;
        readonly mutability: "immutable";
        readonly description: "Subsumption into meta-entity";
    };
    readonly active_during: {
        readonly defaultStrength: 0.3;
        readonly protected: false;
        readonly mutability: "immutable";
        readonly description: "Temporal association with era";
    };
};
/**
 * Get the default strength for a framework relationship kind
 */
export declare function getFrameworkRelationshipStrength(kind: FrameworkRelationshipKind): number;
/**
 * Check if a framework relationship kind is protected from culling
 */
export declare function isProtectedFrameworkRelationship(kind: string): boolean;
//# sourceMappingURL=frameworkPrimitives.d.ts.map