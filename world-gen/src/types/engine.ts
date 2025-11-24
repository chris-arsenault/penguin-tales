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

// Pressure definition
export interface Pressure {
  id: string;
  name: string;
  value: number;  // 0-100
  growth: (graph: Graph) => number;  // delta per tick
  decay: number;  // natural decay per tick
}

// Engine configuration
export interface EngineConfig {
  // Domain schema (defines entity kinds, relationship kinds, validation rules)
  domain: DomainSchema;

  eras: Era[];
  templates: GrowthTemplate[];
  systems: SimulationSystem[];
  pressures: Pressure[];

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
  };

  // Factory function to create meta-entity from cluster
  factory: (cluster: HardState[], graph: Graph) => Partial<HardState>;
}

export interface Cluster {
  entities: HardState[];      // Entities in this cluster
  score: number;              // Similarity score
  matchedCriteria: string[];  // Which criteria contributed to clustering
}
