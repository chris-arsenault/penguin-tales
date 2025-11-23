/**
 * Domain Schema Types
 *
 * Defines the interface for domain-specific world configurations.
 * Framework code uses this interface to remain domain-agnostic.
 */

import { HardState, Relationship } from './worldTypes';

/**
 * Relationship mutability classification
 * - immutable: Facts that don't change over time (spatial, structural)
 * - mutable: Relationships that naturally evolve (social, political)
 */
export type RelationshipMutability = 'immutable' | 'mutable';

/**
 * Definition of a relationship kind in the domain
 */
export interface RelationshipKindDefinition {
  /** Unique identifier for this relationship kind */
  kind: string;

  /** Human-readable description */
  description?: string;

  /** Entity kinds that can be the source of this relationship */
  srcKinds: string[];

  /** Entity kinds that can be the destination of this relationship */
  dstKinds: string[];

  /** Whether this relationship changes over time or is a permanent fact */
  mutability: RelationshipMutability;

  /** If true, this relationship should never be culled (structural integrity) */
  protected: boolean;

  /** If true, this relationship is required for entity validity */
  structural?: boolean;
}

/**
 * Validation rule for entity structure
 */
export interface EntityValidationRule {
  /** Relationship kind that must exist */
  kind: string;

  /** Optional condition - relationship only required if this returns true */
  when?: (entity: HardState) => boolean;

  /** Human-readable description of why this is required */
  description?: string;
}

/**
 * Definition of an entity kind in the domain
 */
export interface EntityKindDefinition {
  /** Unique identifier for this entity kind */
  kind: string;

  /** Human-readable description */
  description?: string;

  /** Valid subtypes for this entity kind */
  subtypes: string[];

  /** Valid status values for this entity kind */
  statusValues: string[];

  /** Relationships required for this entity kind to be valid */
  requiredRelationships?: EntityValidationRule[];

  /** Default status for new entities of this kind */
  defaultStatus?: string;
}

/**
 * Name generation strategy interface
 */
export interface NameGenerator {
  /** Generate a name for the given type/role */
  generate(type: string): string;
}

/**
 * Complete domain schema definition
 */
export interface DomainSchema {
  /** Unique identifier for this domain */
  id: string;

  /** Human-readable name */
  name: string;

  /** Domain version */
  version: string;

  /** All entity kinds supported by this domain */
  entityKinds: EntityKindDefinition[];

  /** All relationship kinds supported by this domain */
  relationshipKinds: RelationshipKindDefinition[];

  /** Name generation service */
  nameGenerator: NameGenerator;

  /** Optional: Get relationship definition by kind */
  getRelationshipKind?(kind: string): RelationshipKindDefinition | undefined;

  /** Optional: Get entity kind definition by kind */
  getEntityKind?(kind: string): EntityKindDefinition | undefined;

  /** Optional: Get all protected (non-cullable) relationship kinds */
  getProtectedRelationshipKinds?(): string[];

  /** Optional: Get all immutable relationship kinds */
  getImmutableRelationshipKinds?(): string[];

  /** Optional: Get all mutable relationship kinds */
  getMutableRelationshipKinds?(): string[];

  /** Optional: Validate that an entity has all required relationships */
  validateEntityStructure?(entity: HardState): { valid: boolean; missing: string[] };

  // ===========================
  // CATALYST SYSTEM EXTENSIONS
  // ===========================

  /** Optional: Get action domains for catalyst system */
  getActionDomains?(): any[];

  /** Optional: Get pressure-domain mappings */
  getPressureDomainMappings?(): Record<string, string[]>;

  /** Optional: Get occurrence creation triggers */
  getOccurrenceTriggers?(): Record<string, any>;

  /** Optional: Get era transition conditions */
  getEraTransitionConditions?(eraSubtype: string): any[];

  /** Optional: Get era transition effects */
  getEraTransitionEffects?(fromEra: HardState, toEra: HardState, graph: any): any;
}

/**
 * Base implementation of DomainSchema with helper methods
 */
export class BaseDomainSchema implements DomainSchema {
  id: string;
  name: string;
  version: string;
  entityKinds: EntityKindDefinition[];
  relationshipKinds: RelationshipKindDefinition[];
  nameGenerator: NameGenerator;

  constructor(config: {
    id: string;
    name: string;
    version: string;
    entityKinds: EntityKindDefinition[];
    relationshipKinds: RelationshipKindDefinition[];
    nameGenerator: NameGenerator;
  }) {
    this.id = config.id;
    this.name = config.name;
    this.version = config.version;
    this.entityKinds = config.entityKinds;
    this.relationshipKinds = config.relationshipKinds;
    this.nameGenerator = config.nameGenerator;
  }

  getRelationshipKind(kind: string): RelationshipKindDefinition | undefined {
    return this.relationshipKinds.find(rk => rk.kind === kind);
  }

  getEntityKind(kind: string): EntityKindDefinition | undefined {
    return this.entityKinds.find(ek => ek.kind === kind);
  }

  getProtectedRelationshipKinds(): string[] {
    return this.relationshipKinds
      .filter(rk => rk.protected)
      .map(rk => rk.kind);
  }

  getImmutableRelationshipKinds(): string[] {
    return this.relationshipKinds
      .filter(rk => rk.mutability === 'immutable')
      .map(rk => rk.kind);
  }

  getMutableRelationshipKinds(): string[] {
    return this.relationshipKinds
      .filter(rk => rk.mutability === 'mutable')
      .map(rk => rk.kind);
  }

  /**
   * Validate that a relationship is allowed by this domain
   */
  validateRelationship(rel: Relationship, graph: { entities: Map<string, HardState> }): boolean {
    const def = this.getRelationshipKind(rel.kind);
    if (!def) return false;

    const srcEntity = graph.entities.get(rel.src);
    const dstEntity = graph.entities.get(rel.dst);

    if (!srcEntity || !dstEntity) return false;

    // Check if source and destination kinds are allowed
    const srcAllowed = def.srcKinds.includes(srcEntity.kind);
    const dstAllowed = def.dstKinds.includes(dstEntity.kind);

    return srcAllowed && dstAllowed;
  }

  /**
   * Validate that an entity has all required relationships
   */
  validateEntityStructure(entity: HardState): { valid: boolean; missing: string[] } {
    const kindDef = this.getEntityKind(entity.kind);
    if (!kindDef) return { valid: true, missing: [] };

    const missing: string[] = [];

    kindDef.requiredRelationships?.forEach(rule => {
      // Check condition if present
      if (rule.when && !rule.when(entity)) return;

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
}
