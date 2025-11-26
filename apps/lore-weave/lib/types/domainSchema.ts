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
 * Relationship category for behavior classification
 * - immutable_fact: Lineage and facts, set at creation, never change
 * - political: Political relationships that can change strength/be archived
 * - social: Social relationships that can change strength/be archived
 * - institutional: Membership/role relationships that can change
 */
export type RelationshipCategory = 'immutable_fact' | 'political' | 'social' | 'institutional';

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

  // ===========================
  // RELATIONSHIP BEHAVIOR CONFIG
  // ===========================

  /**
   * Narrative strength/importance of this relationship (0.0-1.0)
   * Higher values = more narratively significant
   * Default: 0.5
   */
  strength?: number;

  /**
   * Behavioral category for this relationship
   * Default: 'social'
   */
  category?: RelationshipCategory;

  /**
   * If true, this is a lineage relationship that requires cognitive/spatial distance
   */
  isLineage?: boolean;

  /**
   * Expected distance range for lineage relationships
   * Only applies when isLineage is true
   */
  distanceRange?: { min: number; max: number };

  /**
   * Relationship kinds that conflict with this one
   * (mutually exclusive - cannot exist between same entity pair)
   */
  conflictsWith?: string[];
}

/**
 * Per-entity-kind relationship limits
 * Defines warning thresholds for relationship counts
 */
export interface RelationshipLimits {
  /** Default limit for relationship types not explicitly specified */
  default: number;
  /** Per-relationship-kind limits */
  perKind?: Record<string, number>;
}

/**
 * Complete relationship configuration for a domain
 */
export interface RelationshipConfig {
  /** Per-entity-kind relationship limits */
  limits?: Record<string, RelationshipLimits>;

  /**
   * Default relationship strength for unknown kinds
   * Default: 0.5
   */
  defaultStrength?: number;

  /**
   * Default relationship category for unknown kinds
   * Default: 'social'
   */
  defaultCategory?: RelationshipCategory;
}

// ===========================
// EMERGENT DISCOVERY CONFIG
// ===========================

/**
 * Configuration for emergent location discovery system.
 * Allows domains to customize discovery behavior based on world state.
 */
export interface EmergentDiscoveryConfig {
  /**
   * Entity subtypes that represent settlements/colonies
   * Used to analyze resource needs
   * Default: ['colony']
   */
  settlementSubtypes?: string[];

  /**
   * Entity statuses that indicate a thriving settlement
   * Default: ['thriving']
   */
  thrivingStatuses?: string[];

  /**
   * Entity statuses that indicate a struggling settlement
   * Default: ['waning', 'derelict']
   */
  strugglingStatuses?: string[];

  /**
   * Entity subtypes that can discover new locations
   * Default: ['hero']
   */
  explorerSubtypes?: string[];

  /**
   * Entity status required for explorers to be active
   * Default: 'alive'
   */
  explorerActiveStatus?: string;

  /**
   * Resources that can be scarce (for resource analysis)
   * Default: ['food', 'water', 'shelter', 'safety']
   */
  resourceTypes?: string[];

  /**
   * Specific resource subtypes for food scarcity
   * Default: ['krill', 'fish', 'kelp']
   */
  foodResources?: string[];

  /**
   * Discovery probability modifiers by era ID
   * Default: { expansion: 0.15, conflict: 0.08, ... }
   */
  eraDiscoveryModifiers?: Record<string, number>;

  /**
   * Maximum locations before stopping discoveries
   * Default: 40
   */
  maxLocations?: number;

  /**
   * Maximum discoveries per epoch
   * Default: 3
   */
  maxDiscoveriesPerEpoch?: number;

  /**
   * Minimum ticks between discoveries
   * Default: 5
   */
  minTicksBetweenDiscoveries?: number;

  /**
   * Era-specific word lists for theme generation
   */
  eraThemeWords?: Record<string, {
    depthWords?: string[];
    descriptors?: string[];
  }>;

  /**
   * Resource-specific theme words for location naming
   */
  resourceThemeWords?: Record<string, string[]>;
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
 * Configuration for entity snapshot and change detection
 * Allows domains to define what triggers enrichment for each entity kind
 */
export interface SnapshotConfig {
  /**
   * Relationship kinds to track for this entity.
   * Changes in these relationships may trigger enrichment.
   */
  trackedRelationships?: Array<{
    kind: string;
    direction: 'src' | 'dst';  // Track when entity is src or dst
    countThreshold?: number;   // Minimum change in count to trigger enrichment
    trackIds?: boolean;        // Track specific related entity IDs
  }>;

  /**
   * Custom metrics to calculate for snapshots.
   * These are domain-specific computed values.
   */
  customMetrics?: Array<{
    name: string;
    /** Function to calculate the metric value from entity and graph */
    calculate: (entity: HardState, graph: any) => number | string | Set<string>;
    /** Threshold for numeric metrics (change must exceed this) */
    threshold?: number;
  }>;

  /**
   * Function to detect significant changes for this entity kind.
   * Returns array of change descriptions that warrant enrichment.
   */
  detectChanges?: (
    entity: HardState,
    snapshot: Record<string, any>,
    graph: any
  ) => string[];

  /** Minimum ticks between enrichment attempts for this kind */
  enrichmentCooldown?: number;

  /** Priority tier for enrichment (lower = higher priority) */
  enrichmentPriority?: number;
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

  /**
   * Configuration for entity snapshotting and change detection.
   * Used by the enrichment system to decide when to re-enrich entities.
   */
  snapshotConfig?: SnapshotConfig;
}

/**
 * Name generation strategy interface
 */
export interface NameGenerator {
  /** Generate a name for the given type/role */
  generate(type: string): string;
}

/**
 * Culture definition for the domain
 */
export interface CultureDefinition {
  /** Unique identifier for this culture */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of this culture */
  description?: string;

  /** Associated location (homeland) if any */
  homeland?: string;
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

  /** All cultures defined in this domain */
  cultures: CultureDefinition[];

  /** Name generation service (deprecated - use NameForgeService instead) */
  nameGenerator?: NameGenerator;

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

  /** Optional: Get culture definition by id */
  getCulture?(id: string): CultureDefinition | undefined;

  /** Optional: Get all culture ids */
  getCultureIds?(): string[];

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

  // ===========================
  // CATALYST SYSTEM - ENTITY ACTION DOMAINS
  // ===========================

  /**
   * Get action domains for an entity based on its kind and subtype.
   * This is domain-specific logic that maps entity types to their capabilities.
   * @param entity - The entity to check
   * @returns Array of action domain IDs
   */
  getActionDomainsForEntity?(entity: HardState): string[];

  // ===========================
  // RELATIONSHIP BEHAVIOR CONFIG
  // ===========================

  /** Optional: Relationship configuration (limits, defaults) */
  relationshipConfig?: RelationshipConfig;

  /** Get narrative strength for a relationship kind (0.0-1.0) */
  getRelationshipStrength?(kind: string): number;

  /** Get behavioral category for a relationship kind */
  getRelationshipCategory?(kind: string): RelationshipCategory;

  /** Get warning threshold for relationship count */
  getRelationshipWarningThreshold?(entityKind: string, relationshipKind: string): number;

  /** Check if a relationship kind requires distance (is a lineage relationship) */
  isLineageRelationship?(kind: string): boolean;

  /** Get expected distance range for a lineage relationship kind */
  getExpectedDistanceRange?(kind: string): { min: number; max: number } | undefined;

  /** Check if a new relationship conflicts with existing relationships */
  checkRelationshipConflict?(existingKinds: string[], newKind: string): boolean;

  /** Get all lineage relationship kinds */
  getLineageRelationshipKinds?(): string[];

  // ===========================
  // EMERGENT DISCOVERY CONFIG
  // ===========================

  /** Optional: Configuration for emergent location discovery system */
  emergentDiscoveryConfig?: EmergentDiscoveryConfig;
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
  cultures: CultureDefinition[];
  nameGenerator?: NameGenerator;
  relationshipConfig?: RelationshipConfig;

  constructor(config: {
    id: string;
    name: string;
    version: string;
    entityKinds: EntityKindDefinition[];
    relationshipKinds: RelationshipKindDefinition[];
    cultures: CultureDefinition[];
    nameGenerator?: NameGenerator;
    relationshipConfig?: RelationshipConfig;
  }) {
    this.id = config.id;
    this.name = config.name;
    this.version = config.version;
    this.entityKinds = config.entityKinds;
    this.relationshipKinds = config.relationshipKinds;
    this.cultures = config.cultures;
    this.nameGenerator = config.nameGenerator;
    this.relationshipConfig = config.relationshipConfig;
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

  getCulture(id: string): CultureDefinition | undefined {
    return this.cultures.find(c => c.id === id);
  }

  getCultureIds(): string[] {
    return this.cultures.map(c => c.id);
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

  // ===========================
  // RELATIONSHIP BEHAVIOR METHODS
  // ===========================

  /**
   * Get narrative strength for a relationship kind (0.0-1.0)
   * Reads from RelationshipKindDefinition.strength, falls back to config default
   */
  getRelationshipStrength(kind: string): number {
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
  getRelationshipCategory(kind: string): RelationshipCategory {
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
  getRelationshipWarningThreshold(entityKind: string, relationshipKind: string): number {
    const limits = this.relationshipConfig?.limits?.[entityKind];
    if (!limits) {
      return 10; // Sensible default
    }
    return limits.perKind?.[relationshipKind] ?? limits.default;
  }

  /**
   * Check if a relationship kind requires distance (is a lineage relationship)
   */
  isLineageRelationship(kind: string): boolean {
    const def = this.getRelationshipKind(kind);
    return def?.isLineage === true;
  }

  /**
   * Get expected distance range for a lineage relationship kind
   * Returns undefined for non-lineage relationships
   */
  getExpectedDistanceRange(kind: string): { min: number; max: number } | undefined {
    const def = this.getRelationshipKind(kind);
    if (!def?.isLineage) return undefined;
    return def.distanceRange;
  }

  /**
   * Check if a new relationship conflicts with existing relationships
   * Returns true if there is a conflict (should not create relationship)
   */
  checkRelationshipConflict(existingKinds: string[], newKind: string): boolean {
    const def = this.getRelationshipKind(newKind);
    if (!def?.conflictsWith) return false;

    return existingKinds.some(existing => def.conflictsWith!.includes(existing));
  }

  /**
   * Get all lineage relationship kinds
   */
  getLineageRelationshipKinds(): string[] {
    return this.relationshipKinds
      .filter(rk => rk.isLineage === true)
      .map(rk => rk.kind);
  }
}
