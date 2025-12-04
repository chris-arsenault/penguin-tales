/**
 * Framework Primitives
 *
 * Defines the domain-agnostic entity kinds, relationship kinds, and status values
 * that the framework requires to function. These are the "base domain" types that
 * exist regardless of the specific world being generated.
 *
 * Domain schemas extend these with their own entity kinds, relationships, etc.
 */

import { HardState, Relationship } from '../core/worldTypes';

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
} as const;

/** Type for framework entity kinds */
export type FrameworkEntityKind = typeof FRAMEWORK_ENTITY_KINDS[keyof typeof FRAMEWORK_ENTITY_KINDS];

/** Array of all framework entity kind values */
export const FRAMEWORK_ENTITY_KIND_VALUES: readonly FrameworkEntityKind[] = Object.values(FRAMEWORK_ENTITY_KINDS);

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
  /** Entity participates in an occurrence */
  PARTICIPANT_IN: 'participant_in',
  /** Occurrence has a location epicenter */
  EPICENTER_OF: 'epicenter_of',
  /** Occurrence was triggered by an entity/event */
  TRIGGERED_BY: 'triggered_by',
} as const;

/** Type for framework relationship kinds */
export type FrameworkRelationshipKind = typeof FRAMEWORK_RELATIONSHIP_KINDS[keyof typeof FRAMEWORK_RELATIONSHIP_KINDS];

/** Array of all framework relationship kind values */
export const FRAMEWORK_RELATIONSHIP_KIND_VALUES: readonly FrameworkRelationshipKind[] = Object.values(FRAMEWORK_RELATIONSHIP_KINDS);

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
} as const;

/** Type for framework status values */
export type FrameworkStatus = typeof FRAMEWORK_STATUS[keyof typeof FRAMEWORK_STATUS];

/** Array of all framework status values */
export const FRAMEWORK_STATUS_VALUES: readonly FrameworkStatus[] = Object.values(FRAMEWORK_STATUS);

// ===========================
// TYPE GUARDS
// ===========================

/**
 * Check if an entity kind is a framework-level kind
 */
export function isFrameworkEntityKind(kind: string): kind is FrameworkEntityKind {
  return FRAMEWORK_ENTITY_KIND_VALUES.includes(kind as FrameworkEntityKind);
}

/**
 * Check if a relationship kind is a framework-level kind
 */
export function isFrameworkRelationshipKind(kind: string): kind is FrameworkRelationshipKind {
  return FRAMEWORK_RELATIONSHIP_KIND_VALUES.includes(kind as FrameworkRelationshipKind);
}

/**
 * Check if a status value is a framework-level status
 */
export function isFrameworkStatus(status: string): status is FrameworkStatus {
  return FRAMEWORK_STATUS_VALUES.includes(status as FrameworkStatus);
}

/**
 * Check if an entity is a framework-created entity
 */
export function isFrameworkEntity(entity: HardState): boolean {
  return isFrameworkEntityKind(entity.kind);
}

/**
 * Check if a relationship is a framework-created relationship
 */
export function isFrameworkRelationship(relationship: Relationship): boolean {
  return isFrameworkRelationshipKind(relationship.kind);
}

// ===========================
// FRAMEWORK SUBTYPES
// ===========================

/**
 * Subtypes that have framework-level meaning.
 * Domains should define naming profiles for these subtypes.
 */
export const FRAMEWORK_SUBTYPES = {
  /**
   * Used when naming emergent regions.
   * Domains should define naming profiles for kind:region combinations
   * to support emergent region naming in name-forge.
   */
  REGION: 'region',
} as const;

/** Type for framework subtype values */
export type FrameworkSubtype = typeof FRAMEWORK_SUBTYPES[keyof typeof FRAMEWORK_SUBTYPES];

/** Array of all framework subtype values */
export const FRAMEWORK_SUBTYPE_VALUES: readonly FrameworkSubtype[] = Object.values(FRAMEWORK_SUBTYPES);

/**
 * Check if a subtype is a framework-level subtype
 */
export function isFrameworkSubtype(subtype: string): subtype is FrameworkSubtype {
  return FRAMEWORK_SUBTYPE_VALUES.includes(subtype as FrameworkSubtype);
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
] as const;

export const FRAMEWORK_OCCURRENCE_STATUS_VALUES = [
  FRAMEWORK_STATUS.ACTIVE,
  FRAMEWORK_STATUS.HISTORICAL,
] as const;

// ===========================
// RELATIONSHIP PROPERTIES
// ===========================

/**
 * Framework relationships and their properties.
 * Used for default strength values.
 */
export const FRAMEWORK_RELATIONSHIP_PROPERTIES = {
  [FRAMEWORK_RELATIONSHIP_KINDS.SUPERSEDES]: {
    defaultStrength: 0.7,
    description: 'Era lineage (newer era supersedes older)',
  },
  [FRAMEWORK_RELATIONSHIP_KINDS.PART_OF]: {
    defaultStrength: 0.5,
    description: 'Subsumption into meta-entity',
  },
  [FRAMEWORK_RELATIONSHIP_KINDS.ACTIVE_DURING]: {
    defaultStrength: 0.3,
    description: 'Temporal association with era',
  },
  [FRAMEWORK_RELATIONSHIP_KINDS.PARTICIPANT_IN]: {
    defaultStrength: 1.0,
    description: 'Entity participates in an occurrence',
  },
  [FRAMEWORK_RELATIONSHIP_KINDS.EPICENTER_OF]: {
    defaultStrength: 1.0,
    description: 'Occurrence has a location epicenter',
  },
  [FRAMEWORK_RELATIONSHIP_KINDS.TRIGGERED_BY]: {
    defaultStrength: 0.8,
    description: 'Occurrence was triggered by entity/event',
  },
} as const;

/**
 * Get the default strength for a framework relationship kind
 */
export function getFrameworkRelationshipStrength(kind: FrameworkRelationshipKind): number {
  return FRAMEWORK_RELATIONSHIP_PROPERTIES[kind].defaultStrength;
}
