import { HardState, Relationship, EntityTags } from '../core/worldTypes';
import { TemplateMetadata, SystemMetadata, DistributionTargets } from '../statistics/types';
import { DomainSchema } from '../domainInterface/domainSchema';
import type { CoordinateContextConfig } from '../coordinates/coordinateContext';
import type { ISimulationEmitter } from '../observer/types';
import type { Culture } from '../naming/nameForgeService';

// LLM types moved to @illuminator
// import { LoreIndex, LoreRecord } from '../llm/types';
// export interface LLMConfig { ... }
// export type EnrichmentMode = 'off' | 'partial' | 'full';
// export interface EnrichmentConfig { ... }

/**
 * Interface for name generation service.
 * Implemented by NameForgeService, but defined here to avoid circular imports.
 */
export interface NameGenerationService {
  generate(
    kind: string,
    subtype: string,
    prominence: string,
    tags: string[],
    culture: string,
    context?: Record<string, string>
  ): Promise<string>;
  printStats(): void;
}

// Era definition
export interface Era {
  id: string;
  name: string;
  description: string;
  templateWeights: Record<string, number>;  // 0 = disabled, 2 = double chance
  systemModifiers: Record<string, number>;  // multipliers for system effects
  pressureModifiers?: Record<string, number>;
  specialRules?: (graph: Graph) => void;
}

/**
 * Entity creation settings
 * Framework enforces: coordinates → tags → name ordering
 */
export interface CreateEntitySettings {
  kind: string;
  subtype: string;
  coordinates: import('../coordinates/types').Point;  // REQUIRED - simple 2D+z coordinates
  tags?: EntityTags;  // Optional - defaults to {}
  name?: string;  // Optional - auto-generated from tags if not provided
  description?: string;
  status?: string;
  prominence?: import('../core/worldTypes').Prominence;
  culture?: string;
  temporal?: { startTick: number; endTick: number | null };
}

// Graph representation with controlled access
// Entity and relationship data is private - access only through methods
export interface Graph {
  // =============================================================================
  // ENTITY READ METHODS (return clones to prevent external modification)
  // =============================================================================
  getEntity(id: string): HardState | undefined;
  hasEntity(id: string): boolean;
  getEntityCount(): number;
  getEntities(): HardState[];  // Returns array of all entities
  getEntityIds(): string[];
  forEachEntity(callback: (entity: HardState, id: string) => void): void;

  // Query methods
  findEntities(criteria: EntityCriteria): HardState[];
  getEntitiesByKind(kind: string): HardState[];
  getConnectedEntities(entityId: string, relationKind?: string): HardState[];

  // =============================================================================
  // ENTITY MUTATION METHODS (framework-aware)
  // =============================================================================
  /**
   * Create a new entity with contract enforcement.
   * Enforces: coordinates (required) → tags → name (auto-generated if not provided)
   * @returns The created entity's ID
   */
  createEntity(settings: CreateEntitySettings): Promise<string>;

  /**
   * Update an existing entity's properties
   */
  updateEntity(id: string, changes: Partial<HardState>): boolean;

  /**
   * Delete an entity from the graph
   */
  deleteEntity(id: string): boolean;

  /**
   * Load a pre-existing entity (from seed data or serialized state)
   * @internal Should only be used by WorldEngine for loading initial state
   */
  _loadEntity(id: string, entity: HardState): void;

  // =============================================================================
  // RELATIONSHIP READ METHODS
  // =============================================================================
  getRelationships(): Relationship[];
  getRelationshipCount(): number;
  findRelationships(criteria: RelationshipCriteria): Relationship[];
  getEntityRelationships(entityId: string, direction?: 'src' | 'dst' | 'both'): Relationship[];
  hasRelationship(srcId: string, dstId: string, kind?: string): boolean;

  // =============================================================================
  // RELATIONSHIP MUTATION METHODS (framework-aware)
  // =============================================================================
  /**
   * Add a relationship between two entities with validation
   * @returns true if relationship was added, false if duplicate or invalid
   */
  addRelationship(kind: string, srcId: string, dstId: string, strength?: number, distance?: number, category?: string): boolean;

  /**
   * Remove a specific relationship
   */
  removeRelationship(srcId: string, dstId: string, kind: string): boolean;

  /**
   * Bulk replace relationships (used by culling system)
   * @internal Should only be used by framework systems, not templates
   */
  _setRelationships(relationships: Relationship[]): void;

  // =============================================================================
  // OTHER GRAPH STATE (non-private, direct access ok)
  // =============================================================================
  tick: number;
  currentEra: Era;
  pressures: Map<string, number>;
  history: HistoryEvent[];
  config: EngineConfig;
  relationshipCooldowns: Map<string, Map<string, number>>;
  // LLM-related fields moved to @illuminator
  // loreIndex?: LoreIndex;
  // loreRecords: LoreRecord[];
  rateLimitState: import('../core/worldTypes').RateLimitState;
  growthMetrics: {
    relationshipsPerTick: number[];
    averageGrowthRate: number;
  };
  subtypeMetrics?: Map<string, number>;
  protectedRelationshipViolations?: Array<{
    tick: number;
    violations: Array<{ kind: string; strength: number }>;
  }>;
}

// Criteria for finding entities
export interface EntityCriteria {
  kind?: string;
  subtype?: string;
  status?: string;
  prominence?: string;
  culture?: string;
  tag?: string;  // Check if entity has this tag key
  exclude?: string[];  // Entity IDs to exclude
}

// Criteria for finding relationships
export interface RelationshipCriteria {
  kind?: string;
  src?: string;
  dst?: string;
  category?: string;
  minStrength?: number;
}

// History tracking
export interface HistoryEvent {
  tick: number;
  era: string;
  type: 'growth' | 'simulation' | 'special';
  description: string;
  entitiesCreated: string[];
  relationshipsCreated: Relationship[];
  entitiesModified: string[];
}

// Growth template interface
export interface GrowthTemplate {
  id: string;
  name: string;
  requiredEra?: string[];  // optional era restrictions
  metadata?: TemplateMetadata;  // Statistical metadata for distribution tuning
  contract?: ComponentContract;

  // Check if template can be applied
  // Uses TemplateGraphView for safe, restricted graph access
  canApply: (graphView: import('../graph/templateGraphView').TemplateGraphView) => boolean;

  // Find valid targets for this template
  // Uses TemplateGraphView for safe, restricted graph access
  findTargets: (graphView: import('../graph/templateGraphView').TemplateGraphView) => HardState[];

  // Execute the template on a target
  // Uses TemplateGraphView which includes targetSelector for entity selection
  // Returns Promise to support async operations (e.g., name generation)
  expand: (graphView: import('../graph/templateGraphView').TemplateGraphView, target?: HardState) => Promise<TemplateResult> | TemplateResult;
}

export interface TemplateResult {
  entities: Partial<HardState>[];
  relationships: Relationship[];  // Can use placeholder IDs like 'will-be-assigned-0'
  description: string;
}

// Simulation system interface
export interface SimulationSystem {
  id: string;
  name: string;
  metadata?: SystemMetadata;  // Statistical metadata for distribution tuning
  contract?: ComponentContract;

  // Run one tick of this system
  // graphView provides access to graph queries AND coordinate context
  // Returns Promise to support async operations (e.g., name generation)
  apply: (graphView: import('../graph/templateGraphView').TemplateGraphView, modifier: number) => Promise<SystemResult> | SystemResult;
}

export interface SystemResult {
  relationshipsAdded: Relationship[];
  entitiesModified: Array<{
    id: string;
    changes: Partial<HardState>;
  }>;
  pressureChanges: Record<string, number>;
  description: string;
}

// Component Purpose Taxonomy
// Defines the formal purpose of each framework component
export enum ComponentPurpose {
  // Creation purposes
  ENTITY_CREATION = 'Creates entities based on prerequisites',
  RELATIONSHIP_CREATION = 'Creates relationships based on graph patterns',

  // Modification purposes
  TAG_PROPAGATION = 'Spreads tags through relationship networks',
  STATE_MODIFICATION = 'Changes entity states based on context',
  PROMINENCE_EVOLUTION = 'Adjusts entity prominence over time',

  // Signal purposes
  PRESSURE_ACCUMULATION = 'Measures graph state to produce pressure signal',

  // Control purposes
  CONSTRAINT_ENFORCEMENT = 'Enforces population/density limits',
  PHASE_TRANSITION = 'Changes era based on conditions',
  BEHAVIORAL_MODIFIER = 'Modifies template weights or system frequencies'
}

// Component Contract - DEPRECATED
// All contract functionality has been removed:
// - Input conditions: Handled via applicability rules in templateInterpreter.ts
// - Output validation: Declarative templates already define what they create
// - Lineage: Merged into placement system (use 'near_ancestor' placement type)
// This interface is kept empty for backward compatibility during migration.
export interface ComponentContract {
  // Empty - all fields removed
}

/**
 * Filter criteria for finding ancestor entities.
 * Used by 'near_ancestor' placement type.
 * All specified fields must match (AND logic).
 */
export interface AncestorFilter {
  kind: string;
  subtype?: string;
  status?: string;
  /** If true, prefer ancestors with same culture as the new entity */
  sameCulture?: boolean;
  /** If true, exclude the new entity itself from results */
  excludeSelf?: boolean;
}

// Pressure Contract
// Extended contract for pressures including sources, sinks, and equilibrium model
export interface PressureContract extends Omit<ComponentContract, 'affects'> {
  purpose: ComponentPurpose.PRESSURE_ACCUMULATION;

  // What creates this pressure
  sources: Array<{
    component: string;  // e.g., 'template.faction_splinter'
    delta?: number;     // Fixed amount
    formula?: string;   // Dynamic calculation
  }>;

  // What reduces this pressure
  sinks: Array<{
    component: string;  // e.g., 'system.peace_treaty'
    delta?: number;     // Fixed amount
    formula?: string;   // Dynamic calculation (e.g., 'value * 0.05')
  }>;

  // Override affects to be an array for pressures
  affects?: Array<{
    component: string;
    effect: 'enabler' | 'amplifier' | 'suppressor';
    threshold?: number;
    factor?: number;
  }>;

  // Expected equilibrium behavior
  equilibrium: {
    expectedRange: [number, number];  // [min, max] under normal operation
    restingPoint: number;             // Where pressure settles with no stimuli
    oscillationPeriod?: number;       // Ticks for one cycle (if oscillating)
  };
}

// Entity Operator Registry
// Declares all operators (creators, modifiers, lineage) for an entity kind
// Can be at kind-level (e.g., 'npc') or subtype-level (e.g., 'npc:hero')
export interface EntityOperatorRegistry {
  kind: string;      // e.g., 'npc', 'faction', 'abilities'
  subtype?: string;  // Optional: e.g., 'hero', 'cult', 'orca' (for subtype-specific registries)

  // Templates that create this entity
  creators: Array<{
    templateId: string;
    primary: boolean;        // Is this a primary creator or incidental?
    targetCount?: number;    // Expected entities created per activation
  }>;

  // Systems that modify this entity
  modifiers: Array<{
    systemId: string;
    operation: 'state_change' | 'tag_modification' | 'prominence_change';
  }>;

  // Lineage function (called after any creator)
  lineage: {
    relationshipKind: string;  // e.g., 'derived_from', 'related_to'
    findAncestor: (graphView: import('../graph/templateGraphView').TemplateGraphView, newEntity: HardState) => HardState | undefined;
    distanceRange: { min: number; max: number };
  };

  // Expected distribution
  expectedDistribution: {
    targetCount: number;
    prominenceDistribution: Record<string, number>;  // e.g., { marginal: 0.6, recognized: 0.3, renowned: 0.1 }
  };
}

// Pressure definition (runtime - has executable growth function)
// This is internal to WorldEngine - external code uses DeclarativePressure
export interface Pressure {
  id: string;
  name: string;
  value: number;  // 0-100
  growth: (graph: Graph) => number;  // delta per tick
  decay: number;  // natural decay per tick
  contract?: PressureContract;
}

// Engine configuration
export interface EngineConfig {
  // Domain schema (defines entity kinds, relationship kinds, validation rules)
  domain: DomainSchema;

  eras: Era[];

  // Templates - declarative JSON format from UI
  // WorldEngine converts these to runtime GrowthTemplate objects internally
  templates: import('./declarativeTypes').DeclarativeTemplate[];

  // Systems - declarative JSON format from UI or runtime SimulationSystem objects
  // WorldEngine converts declarative systems to runtime objects internally
  systems: (SimulationSystem | import('./systemInterpreter').DeclarativeSystem)[];

  // Pressures - declarative JSON format from UI
  // WorldEngine converts these to runtime Pressure objects internally
  pressures: import('./declarativePressureTypes').DeclarativePressure[];

  // Actions - declarative JSON format from UI
  // WorldEngine converts these to runtime ExecutableActionDomain objects for universalCatalyst
  actions?: import('./actionInterpreter').DeclarativeAction[];

  // Runtime action domains - populated by WorldEngine from declarative actions
  // Used by universalCatalyst system to execute agent actions
  actionDomains?: import('./actionInterpreter').ExecutableActionDomain[];

  entityRegistries?: EntityOperatorRegistry[];

  // Configuration
  epochLength: number;  // ticks per epoch
  simulationTicksPerGrowth: number;
  targetEntitiesPerKind: number;
  maxTicks: number;
  maxRelationshipsPerType: number;  // max relationships of same type per entity
  relationshipBudget?: {
    maxPerSimulationTick: number;  // Hard cap on relationships per simulation tick
    maxPerGrowthPhase: number;     // Hard cap on relationships per growth phase
  };

  // Scaling configuration
  scaleFactor?: number;  // Master scale multiplier for world size (default: 1.0)
  // LLM configuration moved to @illuminator
  // llmConfig?: LLMConfig;
  // enrichmentConfig?: EnrichmentConfig;
  // loreIndex?: LoreIndex;
  distributionTargets?: DistributionTargets;  // Optional statistical distribution targets for guided template selection

  // Tag registry for tag health analysis and validation (domain-specific)
  tagRegistry?: TagMetadata[];

  // Cultures with naming configuration (REQUIRED for name generation)
  // WorldEngine creates NameForgeService internally from cultures that have naming config
  cultures: Culture[];

  // Name generation service - created by WorldEngine from cultures, then set here
  // Graph uses this for entity name generation
  nameForgeService?: NameGenerationService;

  // Coordinate context configuration (REQUIRED for coordinate system)
  coordinateContextConfig: CoordinateContextConfig;

  // Seed relationships (optional - loaded alongside initial entities)
  // Populates entity.links at load time
  seedRelationships?: Relationship[];

  // Simulation event emitter (REQUIRED - no fallback)
  // Used to emit progress, logs, stats, and completion events
  emitter: ISimulationEmitter;
}

// Meta-entity formation config (legacy - used by validationOrchestrator)
export interface MetaEntityConfig {
  sourceKind: string;       // Entity kind to cluster (e.g., 'abilities', 'rules')
  metaKind: string;         // Meta-entity kind to create (e.g., 'school', 'legal_code')
  trigger: 'epoch_end';     // When to run meta-entity formation

  clustering: {
    minSize: number;        // Minimum entities in cluster to form meta-entity
    maxSize?: number;       // Optional maximum size
    criteria: Array<{
      type: 'shared_practitioner' | 'shared_location' | 'same_creator' | 'same_location' | 'shared_tags' | 'temporal_proximity';
      weight: number;       // Contribution to similarity score
      threshold?: number;   // Optional threshold for this criterion
    }>;
    minimumScore: number;   // Minimum similarity score to form cluster
  };

  transformation: {
    markOriginalsHistorical: boolean;       // Archive original entities' relationships
    transferRelationships: boolean;          // Transfer relationships to meta-entity
    redirectFutureRelationships: boolean;    // Future relationships go to meta-entity
    preserveOriginalLinks: boolean;          // Keep part_of links to originals
  };

  // Factory function to create meta-entity from cluster
  factory: (cluster: HardState[], graph: Graph) => Partial<HardState>;
}

export interface Cluster {
  entities: HardState[];      // Entities in this cluster
  score: number;              // Similarity score
  matchedCriteria: string[];  // Which criteria contributed to clustering
}

// Tag Taxonomy System
export interface TagMetadata {
  tag: string;                          // The tag itself
  category: 'status' | 'trait' | 'affiliation' | 'behavior' | 'theme' | 'location';
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  description: string;
  usageCount: number;                   // How many times this tag appears in tag-analysis.json
  templates: string[];                  // Which templates can apply this tag
  entityKinds: string[];                // Which entity kinds can have this tag

  // Governance rules
  minUsage?: number;                    // Minimum occurrences before tag is considered healthy
  maxUsage?: number;                    // Maximum occurrences (soft cap, for warnings)

  // Relationships with other tags
  relatedTags?: string[];               // Tags that commonly appear together
  conflictingTags?: string[];           // Tags that shouldn't coexist on same entity
  consolidateInto?: string;             // If set, this tag should be merged into another tag
}

export interface TagHealthReport {
  // Coverage metrics
  coverage: {
    totalEntities: number;
    entitiesWithTags: number;
    entitiesWithOptimalTags: number;    // 3-5 tags
    coveragePercentage: number;
    optimalCoveragePercentage: number;
  };

  // Diversity metrics
  diversity: {
    uniqueTags: number;
    shannonIndex: number;               // Entropy measure of tag distribution
    evenness: number;                   // How evenly distributed tags are (0-1)
  };

  // Quality issues
  issues: {
    orphanTags: Array<{ tag: string; count: number }>;           // Used 1-2 times
    overusedTags: Array<{ tag: string; count: number; max: number }>;
    conflicts: Array<{ entityId: string; tags: EntityTags; conflict: string }>;
    consolidationOpportunities: Array<{ from: string; to: string; count: number }>;
  };

  // Entity-level issues
  entityIssues: {
    undertagged: string[];              // Entities with < 3 tags
    overtagged: string[];               // Entities with > 5 tags (shouldn't happen due to constraint)
  };

  // Recommendations
  recommendations: string[];
}

/**
 * GraphStore - Concrete implementation of Graph with truly private storage
 *
 * Uses JavaScript private fields (#) for compile-time AND runtime enforcement.
 * External code cannot access #entities or #relationships directly.
 *
 * All read methods return clones to prevent external modification of internal state.
 * All mutations must go through designated methods.
 */
export class GraphStore implements Graph {
  // Truly private fields - not accessible outside this class
  #entities: Map<string, HardState> = new Map();
  #relationships: Relationship[] = [];

  // Public state
  tick: number = 0;
  currentEra!: Era;
  pressures: Map<string, number> = new Map();
  history: HistoryEvent[] = [];
  config!: EngineConfig;
  relationshipCooldowns: Map<string, Map<string, number>> = new Map();
  // LLM fields moved to @illuminator
  // loreIndex?: LoreIndex;
  // loreRecords: LoreRecord[] = [];
  rateLimitState: import('../core/worldTypes').RateLimitState = {
    currentThreshold: 0.5,
    lastCreationTick: 0,
    creationsThisEpoch: 0
  };
  growthMetrics: { relationshipsPerTick: number[]; averageGrowthRate: number } = {
    relationshipsPerTick: [],
    averageGrowthRate: 0
  };
  subtypeMetrics?: Map<string, number>;
  protectedRelationshipViolations?: Array<{
    tick: number;
    violations: Array<{ kind: string; strength: number }>;
  }>;

  // ===========================================================================
  // ENTITY READ METHODS
  // ===========================================================================

  getEntity(id: string): HardState | undefined {
    const entity = this.#entities.get(id);
    return entity ? { ...entity, tags: { ...entity.tags }, links: [...(entity.links || [])] } : undefined;
  }

  hasEntity(id: string): boolean {
    return this.#entities.has(id);
  }

  getEntityCount(): number {
    return this.#entities.size;
  }

  getEntities(): HardState[] {
    return Array.from(this.#entities.values()).map(e => ({
      ...e,
      tags: { ...e.tags },
      links: [...(e.links || [])]
    }));
  }

  getEntityIds(): string[] {
    return Array.from(this.#entities.keys());
  }

  forEachEntity(callback: (entity: HardState, id: string) => void): void {
    this.#entities.forEach((entity, id) => {
      // Pass clone to callback
      callback({ ...entity, tags: { ...entity.tags }, links: [...(entity.links || [])] }, id);
    });
  }

  findEntities(criteria: EntityCriteria): HardState[] {
    const results: HardState[] = [];
    for (const [id, entity] of this.#entities) {
      if (criteria.exclude?.includes(id)) continue;
      if (criteria.kind && entity.kind !== criteria.kind) continue;
      if (criteria.subtype && entity.subtype !== criteria.subtype) continue;
      if (criteria.status && entity.status !== criteria.status) continue;
      if (criteria.prominence && entity.prominence !== criteria.prominence) continue;
      if (criteria.culture && entity.culture !== criteria.culture) continue;
      if (criteria.tag && !(criteria.tag in entity.tags)) continue;
      results.push({ ...entity, tags: { ...entity.tags }, links: [...(entity.links || [])] });
    }
    return results;
  }

  getEntitiesByKind(kind: string): HardState[] {
    return this.findEntities({ kind });
  }

  getConnectedEntities(entityId: string, relationKind?: string): HardState[] {
    const connectedIds = new Set<string>();
    for (const rel of this.#relationships) {
      if (relationKind && rel.kind !== relationKind) continue;
      if (rel.src === entityId) connectedIds.add(rel.dst);
      if (rel.dst === entityId) connectedIds.add(rel.src);
    }
    return Array.from(connectedIds)
      .map(id => this.getEntity(id))
      .filter((e): e is HardState => e !== undefined);
  }

  // ===========================================================================
  // ENTITY MUTATION METHODS (framework-aware)
  // ===========================================================================

  /**
   * Create a new entity with contract enforcement.
   * Enforces: coordinates (required) → tags → name (auto-generated if not provided)
   */
  async createEntity(settings: CreateEntitySettings): Promise<string> {
    // Generate unique ID
    const id = `${settings.kind}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // COORDINATES are REQUIRED - no silent defaults
    if (!settings.coordinates) {
      throw new Error(
        `createEntity: coordinates are required for all entities. ` +
        `Entity kind: ${settings.kind}, subtype: ${settings.subtype}. ` +
        `Provide coordinates explicitly.`
      );
    }

    // Tags default to empty object
    const tags: EntityTags = settings.tags || {};

    // Auto-generate name if not provided (uses tags, so tags must be set first)
    let name = settings.name;
    if (!name) {
      const nameForge = this.config?.nameForgeService;
      if (!nameForge) {
        throw new Error(
          `createEntity: name not provided and no NameForgeService configured. ` +
          `Either provide a name or configure nameForgeService in EngineConfig.`
        );
      }
      // Convert KVP tags to array for name-forge compatibility
      const tagArray = Object.keys(tags);

      name = await nameForge.generate(
        settings.kind,
        settings.subtype,
        settings.prominence || 'marginal',
        tagArray,
        settings.culture || 'world'
      );
    }

    // Add slugified name to tags for tracking
    const slugifiedName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    tags.name = slugifiedName;

    // Build the full entity
    const entity: HardState = {
      id,
      kind: settings.kind,
      subtype: settings.subtype,
      name,
      description: settings.description || '',
      status: settings.status || 'active',
      prominence: settings.prominence || 'marginal',
      culture: settings.culture || 'world',
      tags,
      links: [],
      coordinates: settings.coordinates,
      temporal: settings.temporal,
      createdAt: this.tick,
      updatedAt: this.tick
    };

    // Check for coordinate overlap with existing entities of the same kind
    const overlapThreshold = 1.0;  // Entities within this distance are "overlapping"
    const newCoords = settings.coordinates;
    for (const existing of this.#entities.values()) {
      if (existing.kind !== settings.kind) continue;
      if (!existing.coordinates) continue;

      const dx = existing.coordinates.x - newCoords.x;
      const dy = existing.coordinates.y - newCoords.y;
      const dz = (existing.coordinates.z ?? 50) - (newCoords.z ?? 50);
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < overlapThreshold) {
        this.config.emitter?.log(
          'warn',
          `Coordinate overlap: ${settings.kind}:${settings.subtype} "${name}" ` +
          `placed at (${newCoords.x.toFixed(1)}, ${newCoords.y.toFixed(1)}, ${(newCoords.z ?? 50).toFixed(1)}) ` +
          `overlaps with existing "${existing.name}" at ` +
          `(${existing.coordinates.x.toFixed(1)}, ${existing.coordinates.y.toFixed(1)}, ${(existing.coordinates.z ?? 50).toFixed(1)}) ` +
          `[distance: ${distance.toFixed(2)}]`
        );
      }
    }

    this.#entities.set(id, entity);
    return id;
  }

  updateEntity(id: string, changes: Partial<HardState>): boolean {
    const entity = this.#entities.get(id);
    if (!entity) return false;
    Object.assign(entity, changes, { updatedAt: this.tick });
    return true;
  }

  deleteEntity(id: string): boolean {
    return this.#entities.delete(id);
  }

  /**
   * Load a pre-existing entity (from seed data or serialized state)
   * @internal Should only be used by WorldEngine for loading initial state
   */
  _loadEntity(id: string, entity: HardState): void {
    this.#entities.set(id, entity);
  }

  // ===========================================================================
  // RELATIONSHIP READ METHODS
  // ===========================================================================

  getRelationships(): Relationship[] {
    return this.#relationships.map(r => ({ ...r }));
  }

  getRelationshipCount(): number {
    return this.#relationships.length;
  }

  findRelationships(criteria: RelationshipCriteria): Relationship[] {
    return this.#relationships.filter(rel => {
      if (criteria.kind && rel.kind !== criteria.kind) return false;
      if (criteria.src && rel.src !== criteria.src) return false;
      if (criteria.dst && rel.dst !== criteria.dst) return false;
      if (criteria.category && rel.category !== criteria.category) return false;
      if (criteria.minStrength !== undefined && (rel.strength ?? 0) < criteria.minStrength) return false;
      return true;
    }).map(r => ({ ...r }));
  }

  getEntityRelationships(entityId: string, direction: 'src' | 'dst' | 'both' = 'both'): Relationship[] {
    return this.#relationships.filter(rel => {
      if (direction === 'src') return rel.src === entityId;
      if (direction === 'dst') return rel.dst === entityId;
      return rel.src === entityId || rel.dst === entityId;
    }).map(r => ({ ...r }));
  }

  hasRelationship(srcId: string, dstId: string, kind?: string): boolean {
    return this.#relationships.some(rel =>
      rel.src === srcId && rel.dst === dstId && (kind === undefined || rel.kind === kind)
    );
  }

  // ===========================================================================
  // RELATIONSHIP MUTATION METHODS (framework-aware)
  // ===========================================================================

  /**
   * Add a relationship with validation.
   * Checks for duplicates and validates that both entities exist.
   * @returns true if relationship was added, false if duplicate or invalid
   */
  addRelationship(kind: string, srcId: string, dstId: string, strength?: number, distance?: number, category?: string): boolean {
    // Validate entities exist
    if (!this.#entities.has(srcId)) {
      this.config.emitter?.log('warn', `addRelationship: source entity ${srcId} does not exist`);
      return false;
    }
    if (!this.#entities.has(dstId)) {
      this.config.emitter?.log('warn', `addRelationship: destination entity ${dstId} does not exist`);
      return false;
    }

    // Check for duplicate
    const exists = this.#relationships.some(
      r => r.src === srcId && r.dst === dstId && r.kind === kind
    );
    if (exists) {
      return false;  // Duplicate - silently skip
    }

    // Build relationship
    const relationship: Relationship = {
      kind,
      src: srcId,
      dst: dstId,
      strength: strength ?? 0.5,
      distance,
      category,
      status: 'active'
    };

    this.#relationships.push(relationship);

    // Update entity links (denormalized cache)
    const srcEntity = this.#entities.get(srcId);
    if (srcEntity) {
      srcEntity.links.push({ ...relationship });
      srcEntity.updatedAt = this.tick;
    }
    const dstEntity = this.#entities.get(dstId);
    if (dstEntity) {
      dstEntity.updatedAt = this.tick;
    }

    return true;
  }

  removeRelationship(srcId: string, dstId: string, kind: string): boolean {
    const index = this.#relationships.findIndex(
      r => r.src === srcId && r.dst === dstId && r.kind === kind
    );
    if (index === -1) return false;
    this.#relationships.splice(index, 1);

    // Also remove from entity links
    const srcEntity = this.#entities.get(srcId);
    if (srcEntity) {
      srcEntity.links = srcEntity.links.filter(
        l => !(l.src === srcId && l.dst === dstId && l.kind === kind)
      );
      srcEntity.updatedAt = this.tick;
    }
    const dstEntity = this.#entities.get(dstId);
    if (dstEntity) {
      dstEntity.updatedAt = this.tick;
    }
    return true;
  }

  /**
   * Bulk replace relationships (used by culling system)
   * @internal Should only be used by framework systems, not templates
   */
  _setRelationships(relationships: Relationship[]): void {
    this.#relationships = relationships;
    // Note: This doesn't update entity links - caller should rebuild if needed
  }

  /**
   * Create a new GraphStore with initial configuration
   */
  static create(config: EngineConfig, initialEra: Era): GraphStore {
    const store = new GraphStore();
    store.config = config;
    store.currentEra = initialEra;

    // Initialize pressures from config (declarative format uses initialValue)
    for (const pressure of config.pressures) {
      store.pressures.set(pressure.id, pressure.initialValue);
    }

    return store;
  }
}
