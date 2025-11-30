/**
 * Domain Schema Types
 *
 * Defines the interface for domain-specific world configurations.
 * Framework code uses this interface to remain domain-agnostic.
 */

import { HardState, Relationship } from '../core/worldTypes';
import { SemanticEncoderConfig } from '../coordinates/types';

/** Decay rate for relationship strength over time */
export type DecayRate = 'none' | 'slow' | 'medium' | 'fast';

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

  /**
   * Whether this relationship can be removed by maintenance systems.
   * Set to false for immutable facts (geography, history, discoveries).
   * Default: true
   */
  cullable?: boolean;

  /**
   * How quickly this relationship's strength decays over time.
   * - 'none': Never decays (permanent relationships)
   * - 'slow': Decays slowly (structural relationships like membership)
   * - 'medium': Normal decay (social relationships)
   * - 'fast': Decays quickly (temporary alliances, economic ties)
   * Default: 'medium'
   */
  decayRate?: DecayRate;
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
 * UI styling configuration for entity kinds
 */
export interface EntityKindStyle {
  /** Display name for UI (defaults to capitalized kind) */
  displayName?: string;
  /** Hex color for visualization (e.g., '#6FB1FC') */
  color?: string;
  /** Shape for graph visualization (e.g., 'ellipse', 'diamond', 'hexagon') */
  shape?: string;
}

/**
 * Subtype definition for an entity kind
 */
export interface SubtypeDefinition {
  /** Unique identifier for this subtype */
  id: string;
  /** Human-readable name */
  name: string;
}

/**
 * Status definition for an entity kind
 */
export interface StatusDefinition {
  /** Unique identifier for this status */
  id: string;
  /** Human-readable name */
  name: string;
  /** Whether this status represents a terminal state (entity lifecycle end) */
  isTerminal: boolean;
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
  subtypes: SubtypeDefinition[];

  /** Valid status values for this entity kind */
  statuses: StatusDefinition[];

  /** Relationships required for this entity kind to be valid */
  requiredRelationships?: EntityValidationRule[];

  /**
   * Configuration for entity snapshotting and change detection.
   * Used by the enrichment system to decide when to re-enrich entities.
   */
  snapshotConfig?: SnapshotConfig;

  /** UI styling configuration for visualization */
  style?: EntityKindStyle;
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
 * UI configuration for domain visualization
 */
export interface DomainUIConfig {
  /** Icon/emoji for the world (e.g., '🐧') */
  worldIcon?: string;
  /** Ordered list of prominence levels (lowest to highest) */
  prominenceLevels?: string[];
  /** Colors for prominence levels (keyed by level name) */
  prominenceColors?: Record<string, string>;
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

  /** UI configuration for visualization */
  uiConfig?: DomainUIConfig;

  /** Name generation service (deprecated - use NameForgeService instead) */
  nameGenerator?: NameGenerator;

  /** Optional: Get relationship definition by kind */
  getRelationshipKind?(kind: string): RelationshipKindDefinition | undefined;

  /** Optional: Get entity kind definition by kind */
  getEntityKind?(kind: string): EntityKindDefinition | undefined;

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
  // SEMANTIC AXIS CONFIG
  // ===========================

  /** Optional: Configuration for semantic axis coordinate encoding */
  semanticConfig?: SemanticEncoderConfig;

  // ===========================
  // SEMANTIC RELATIONSHIP KINDS
  // ===========================

  /**
   * Relationship kinds that indicate "entity is located at location"
   * Used by framework code to find entity locations without hardcoding kinds.
   * Example: ['resident_of', 'located_at']
   */
  locationRelationshipKinds?: string[];

  /**
   * Relationship kinds that indicate "entity is member of group"
   * Example: ['member_of']
   */
  membershipRelationshipKinds?: string[];

  /**
   * Relationship kinds that indicate "entity leads group"
   * Example: ['leader_of']
   */
  leadershipRelationshipKinds?: string[];

  // ===========================
  // IMAGE GENERATION CONFIG
  // ===========================

  /** Optional: Configuration for image generation prompts */
  imageGenerationConfig?: ImageGenerationPromptConfig;
}

// ===========================
// IMAGE GENERATION CONFIG
// ===========================

/**
 * Culture-specific image generation configuration.
 * Culture is first-class - it defines the visual identity (species/appearance),
 * and kind-specific prompts build on that foundation.
 */
export interface CultureImageConfig {
  /**
   * Base visual identity for this culture (species, environment, aesthetic).
   * Example: "Anthropomorphic emperor penguin from the Aurora Stack colony"
   */
  visualIdentity: string;

  /**
   * Color palette and artistic style for this culture.
   * Example: "Warm golden aurora tones, organized composition"
   */
  styleModifiers: string;

  /**
   * Kind-specific prompts within this culture's visual identity.
   * These build ON TOP of the culture's visual identity.
   */
  kindContexts: Record<string, string>;
}

/**
 * Configuration for image generation prompts.
 * Allows domains to customize DALL-E prompts for entity visualization.
 *
 * Architecture: Culture is first-class. The visual identity flows from culture,
 * then kind-specific details layer on top. This matches how name-forge works.
 */
export interface ImageGenerationPromptConfig {
  /**
   * Base world context describing the setting.
   * Example: "Geographic atlas illustration from a frozen Antarctic world"
   */
  worldContext: string;

  /**
   * Culture-specific configurations. Culture defines the visual identity.
   * Each culture specifies its species/appearance and kind-specific prompts.
   */
  cultures: Record<string, CultureImageConfig>;

  /**
   * Per-subtype context for more specific descriptions.
   * These are additive details regardless of culture.
   */
  subtypeContexts: Record<string, string>;

  /**
   * Base style guidance for consistent art direction across all cultures.
   * Example: "Illustrated geographic atlas style, watercolor and ink aesthetic"
   */
  styleGuidance: string;

  /**
   * Instructions to prevent text in generated images.
   * Default provided if not specified.
   */
  noTextInstruction?: string;
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
  uiConfig?: DomainUIConfig;
  nameGenerator?: NameGenerator;

  constructor(config: {
    id: string;
    name: string;
    version: string;
    entityKinds: EntityKindDefinition[];
    relationshipKinds: RelationshipKindDefinition[];
    cultures: CultureDefinition[];
    uiConfig?: DomainUIConfig;
    nameGenerator?: NameGenerator;
  }) {
    this.id = config.id;
    this.name = config.name;
    this.version = config.version;
    this.entityKinds = config.entityKinds;
    this.relationshipKinds = config.relationshipKinds;
    this.cultures = config.cultures;
    this.uiConfig = config.uiConfig;
    this.nameGenerator = config.nameGenerator;
  }

  getRelationshipKind(kind: string): RelationshipKindDefinition | undefined {
    return this.relationshipKinds.find(rk => rk.kind === kind);
  }

  getEntityKind(kind: string): EntityKindDefinition | undefined {
    return this.entityKinds.find(ek => ek.kind === kind);
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
}
