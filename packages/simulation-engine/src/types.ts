/**
 * Simulation Engine Types
 *
 * Runtime types for the browser-based simulation engine.
 */

import type {
  SimulationConfig,
  GenerationRule,
  SimulationRule,
  EntityTemplate,
  RelationshipTemplate,
  Prominence,
} from '@canonry/world-schema';

// ============================================================================
// RUNTIME ENTITY
// ============================================================================

/**
 * A runtime entity in the simulation
 */
export interface RuntimeEntity {
  /** Unique identifier */
  id: string;
  /** Entity kind from schema */
  kind: string;
  /** Subtype from schema */
  subtype: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Current status */
  status: string;
  /** Prominence level */
  prominence: Prominence;
  /** Tags */
  tags: string[];
  /** Culture ID */
  cultureId?: string;
  /** Semantic coordinates (if using semantic planes) */
  coordinates?: { x: number; y: number };
  /** Era when created */
  createdInEra: string;
  /** Tick when created */
  createdAtTick: number;
  /** Tick when last modified */
  updatedAtTick: number;
}

/**
 * A runtime relationship in the simulation
 */
export interface RuntimeRelationship {
  /** Unique identifier */
  id: string;
  /** Relationship kind from schema */
  kind: string;
  /** Source entity ID */
  srcId: string;
  /** Target entity ID */
  dstId: string;
  /** Semantic distance (0-1) */
  distance: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Tick when created */
  createdAtTick: number;
  /** Whether this is archived (historical) */
  archived: boolean;
}

/**
 * A recorded occurrence (historical event)
 */
export interface RuntimeOccurrence {
  /** Unique identifier */
  id: string;
  /** Occurrence kind */
  kind: string;
  /** Description */
  description: string;
  /** Era when it happened */
  era: string;
  /** Tick when it happened */
  tick: number;
  /** Related entity IDs */
  entityIds: string[];
}

// ============================================================================
// SIMULATION STATE
// ============================================================================

/**
 * Complete simulation state (the graph + pressures + history)
 */
export interface SimulationState {
  /** All entities */
  entities: Map<string, RuntimeEntity>;
  /** All relationships */
  relationships: Map<string, RuntimeRelationship>;
  /** All occurrences */
  occurrences: RuntimeOccurrence[];
  /** Current pressure values */
  pressures: Map<string, number>;
  /** Current tick */
  tick: number;
  /** Current era ID */
  currentEra: string;
  /** Total entities created (for ID generation) */
  entityCounter: number;
  /** Total relationships created (for ID generation) */
  relationshipCounter: number;
  /** Total occurrences (for ID generation) */
  occurrenceCounter: number;
  /** Random seed state */
  randomState: number;
}

/**
 * Execution context for rule evaluation
 */
export interface ExecutionContext {
  /** The simulation config */
  config: SimulationConfig;
  /** Current state */
  state: SimulationState;
  /** Entities created in this rule execution (ref -> entity[]) */
  createdEntities: Map<string, RuntimeEntity[]>;
  /** Entities selected in this rule execution (ref -> entity[]) */
  selectedEntities: Map<string, RuntimeEntity[]>;
  /** Cultures available */
  cultures: Array<{ id: string; name: string }>;
  /** Eras available */
  eras: Array<{ id: string; name: string; ticks: number }>;
  /** Name generator function */
  generateName: (cultureId: string, kind: string) => string;
}

// ============================================================================
// RULE EXECUTION RESULTS
// ============================================================================

/**
 * Result of executing a rule
 */
export interface RuleExecutionResult {
  /** Rule ID */
  ruleId: string;
  /** Whether the rule fired successfully */
  success: boolean;
  /** Entities created */
  entitiesCreated: RuntimeEntity[];
  /** Relationships created */
  relationshipsCreated: RuntimeRelationship[];
  /** Occurrence recorded (if any) */
  occurrence?: RuntimeOccurrence;
  /** Pressure changes applied */
  pressureChanges: Array<{ pressureId: string; delta: number }>;
  /** Error message if failed */
  error?: string;
}

/**
 * Result of a simulation tick
 */
export interface TickResult {
  /** Tick number */
  tick: number;
  /** Era ID */
  era: string;
  /** Phase (growth or simulation) */
  phase: 'growth' | 'simulation';
  /** Rules that fired */
  rulesFired: RuleExecutionResult[];
  /** Total entities after this tick */
  totalEntities: number;
  /** Total relationships after this tick */
  totalRelationships: number;
}

/**
 * Result of completing an era
 */
export interface EraResult {
  /** Era ID */
  eraId: string;
  /** Era name */
  eraName: string;
  /** Number of ticks */
  ticks: number;
  /** Entities created during this era */
  entitiesCreated: number;
  /** Relationships created during this era */
  relationshipsCreated: number;
  /** Occurrences recorded */
  occurrences: number;
}

/**
 * Final simulation result
 */
export interface SimulationResult {
  /** Final state */
  state: SimulationState;
  /** Results per era */
  eraResults: EraResult[];
  /** Total ticks executed */
  totalTicks: number;
  /** Total entities */
  totalEntities: number;
  /** Total relationships */
  totalRelationships: number;
  /** Total occurrences */
  totalOccurrences: number;
}

// ============================================================================
// ENGINE CONFIGURATION
// ============================================================================

/**
 * Configuration for the simulation engine
 */
export interface EngineConfig {
  /** The simulation configuration */
  simulation: SimulationConfig;
  /** Era definitions from Cosmographer */
  eras: Array<{
    id: string;
    name: string;
    ticks: number;
    themes: string[];
  }>;
  /** Culture definitions */
  cultures: Array<{
    id: string;
    name: string;
  }>;
  /** Seed entities (starting state) */
  seedEntities?: RuntimeEntity[];
  /** Seed relationships (starting state) */
  seedRelationships?: RuntimeRelationship[];
  /** Name generator function */
  generateName?: (cultureId: string, kind: string) => string;
  /** Callback for tick completion */
  onTick?: (result: TickResult) => void;
  /** Callback for era completion */
  onEraComplete?: (result: EraResult) => void;
}
