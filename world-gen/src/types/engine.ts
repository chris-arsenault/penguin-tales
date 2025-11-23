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

  // Check if template can be applied
  canApply: (graph: Graph) => boolean;

  // Find valid targets for this template
  findTargets: (graph: Graph) => HardState[];

  // Execute the template on a target
  expand: (graph: Graph, target?: HardState) => TemplateResult;
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
