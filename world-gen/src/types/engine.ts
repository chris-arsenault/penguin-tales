import { HardState, Relationship } from './worldTypes';
import { LoreIndex, LoreRecord } from './lore';
import { TemplateMetadata, SystemMetadata, DistributionTargets } from './distribution';
import { DomainSchema } from './domainSchema';

export interface LLMConfig {
  enabled: boolean;
  model: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

export type EnrichmentMode = 'off' | 'partial' | 'full';

export interface EnrichmentConfig {
  batchSize: number;
  mode: EnrichmentMode;
  maxEntityEnrichments?: number;
  maxRelationshipEnrichments?: number;
  maxEraNarratives?: number;
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

// Graph representation
export interface Graph {
  entities: Map<string, HardState>;
  relationships: Relationship[];
  tick: number;
  currentEra: Era;
  pressures: Map<string, number>;
  history: HistoryEvent[];
  config: EngineConfig;  // Reference to engine configuration
  relationshipCooldowns: Map<string, Map<string, number>>;  // entityId → (relationshipType → lastFormationTick)
  loreIndex?: LoreIndex;
  loreRecords: LoreRecord[];

  // Discovery tracking (emergent system)
  discoveryState: import('./worldTypes').DiscoveryState;

  // Relationship growth monitoring
  growthMetrics: {
    relationshipsPerTick: number[];  // Rolling window of last 20 ticks
    averageGrowthRate: number;       // Average relationships added per tick
  };

  // Subtype metrics tracking (for feedback loop validation)
  subtypeMetrics?: Map<string, number>;  // 'kind:subtype' → count

  // Protected relationship violation tracking (for genetic algorithm fitness)
  protectedRelationshipViolations?: Array<{
    tick: number;
    violations: Array<{ kind: string; strength: number }>;
  }>;

  // Meta-entity formation service
  metaEntityFormation?: import('../services/metaEntityFormation').MetaEntityFormation;
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

// Template execution context (framework services available to templates)
// DEPRECATED: No longer used - TemplateGraphView provides all services
export interface TemplateContext {
  targetSelector: import('../services/targetSelector').TargetSelector;
}

// Growth template interface
export interface GrowthTemplate {
  id: string;
  name: string;
  requiredEra?: string[];  // optional era restrictions
  metadata?: TemplateMetadata;  // Statistical metadata for distribution tuning
  contract?: ComponentContract;  // Optional: will become required after migration

  // Check if template can be applied
  // Uses TemplateGraphView for safe, restricted graph access
  canApply: (graphView: import('../services/templateGraphView').TemplateGraphView) => boolean;

  // Find valid targets for this template
  // Uses TemplateGraphView for safe, restricted graph access
  findTargets: (graphView: import('../services/templateGraphView').TemplateGraphView) => HardState[];

  // Execute the template on a target
  // Uses TemplateGraphView which includes targetSelector for entity selection
  expand: (graphView: import('../services/templateGraphView').TemplateGraphView, target?: HardState) => TemplateResult;
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
  contract?: ComponentContract;  // Optional: will become required after migration

  // Run one tick of this system
  apply: (graph: Graph, modifier: number) => SystemResult;
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

// Component Contract
// Bidirectional declaration of inputs (what enables component) and outputs (what component affects)
export interface ComponentContract {
  purpose: ComponentPurpose;

  // INPUT CONTRACT: What enables this component
  enabledBy?: {
    pressures?: Array<{ name: string; threshold: number }>;
    entityCounts?: Array<{ kind: string; subtype?: string; min: number; max?: number }>;
    era?: string[];
    custom?: (graphView: import('../services/templateGraphView').TemplateGraphView) => boolean;
  };

  // OUTPUT CONTRACT: What this component affects
  affects: {
    entities?: Array<{
      kind: string;
      subtype?: string;
      operation: 'create' | 'modify' | 'delete';
      count?: { min: number; max: number };
    }>;
    relationships?: Array<{
      kind: string;
      operation: 'create' | 'delete';
      count?: { min: number; max: number };
    }>;
    pressures?: Array<{
      name: string;
      delta?: number;
      formula?: string;
    }>;
    tags?: Array<{
      operation: 'add' | 'remove' | 'propagate';
      pattern: string;
    }>;
  };
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
    findAncestor: (graphView: import('../services/templateGraphView').TemplateGraphView, newEntity: HardState) => HardState | undefined;
    distanceRange: { min: number; max: number };
  };

  // Expected distribution
  expectedDistribution: {
    targetCount: number;
    prominenceDistribution: Record<string, number>;  // e.g., { marginal: 0.6, recognized: 0.3, renowned: 0.1 }
  };
}

// Pressure definition
export interface Pressure {
  id: string;
  name: string;
  value: number;  // 0-100
  growth: (graph: Graph) => number;  // delta per tick
  decay: number;  // natural decay per tick
  contract?: PressureContract;  // Optional: will become required after migration
}

// Engine configuration
export interface EngineConfig {
  // Domain schema (defines entity kinds, relationship kinds, validation rules)
  domain: DomainSchema;

  eras: Era[];
  templates: GrowthTemplate[];
  systems: SimulationSystem[];
  pressures: Pressure[];
  entityRegistries?: EntityOperatorRegistry[];  // Optional: will become required after migration

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
  llmConfig?: LLMConfig;
  enrichmentConfig?: EnrichmentConfig;
  loreIndex?: LoreIndex;
  distributionTargets?: DistributionTargets;  // Optional statistical distribution targets for guided template selection
}

// Meta-Entity Formation System
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
    createGovernanceFaction?: boolean;       // Create faction:political to govern (for legal codes)
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
    conflicts: Array<{ entityId: string; tags: string[]; conflict: string }>;
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
