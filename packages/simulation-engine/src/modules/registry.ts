/**
 * Module Registry
 *
 * Central registry for all simulation modules. Modules are parameterized
 * code blocks that can be referenced from rules by ID and configured
 * with custom parameters.
 */

import type { SimulationState, RuntimeEntity, ExecutionContext } from '../types.js';

// ============================================================================
// MODULE TYPES
// ============================================================================

/**
 * Context available to all modules
 */
export interface ModuleContext {
  /** Current simulation state */
  state: SimulationState;
  /** Full execution context (when available) */
  ctx?: ExecutionContext;
  /** Current tick */
  tick: number;
  /** Current era */
  currentEra: string;
}

/**
 * Result types for different module categories
 */
export interface ScoringResult {
  /** Score multiplier (typically 0-2, where 1 is neutral) */
  score: number;
  /** Reason for the score (for debugging) */
  reason?: string;
}

export interface PressureResult {
  /** Computed pressure value */
  value: number;
  /** Components that contributed to this value */
  components?: Record<string, number>;
}

export interface FilterResult {
  /** Whether the entity passes the filter */
  passes: boolean;
  /** Reason for rejection (if any) */
  reason?: string;
}

export interface DynamicsResult {
  /** Entities to modify */
  modifications?: Array<{
    entityId: string;
    changes: {
      status?: string;
      prominence?: string;
      addTags?: string[];
      removeTags?: string[];
    };
  }>;
  /** Relationships to modify */
  relationshipChanges?: Array<{
    relationshipId: string;
    changes: {
      distance?: number;
      archive?: boolean;
    };
  }>;
  /** New relationships to create */
  newRelationships?: Array<{
    kind: string;
    srcId: string;
    dstId: string;
    distance?: number;
  }>;
}

/**
 * Module executor signature
 */
export type ModuleExecutor<TParams, TResult> = (
  params: TParams,
  context: ModuleContext,
  ...args: unknown[]
) => TResult;

/**
 * Module definition
 */
export interface ModuleDefinition<TParams = Record<string, unknown>, TResult = unknown> {
  /** Unique module identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the module does */
  description: string;
  /** Module category */
  category: 'scoring' | 'pressure' | 'filtering' | 'dynamics' | 'social';
  /** Default parameters */
  defaults: TParams;
  /** The executor function */
  execute: ModuleExecutor<TParams, TResult>;
}

// ============================================================================
// REGISTRY
// ============================================================================

/**
 * Central module registry
 */
class ModuleRegistry {
  private modules = new Map<string, ModuleDefinition>();

  /**
   * Register a module
   */
  register<TParams, TResult>(module: ModuleDefinition<TParams, TResult>): void {
    if (this.modules.has(module.id)) {
      console.warn(`Module ${module.id} is being re-registered`);
    }
    this.modules.set(module.id, module as ModuleDefinition);
  }

  /**
   * Get a module by ID
   */
  get<TParams = Record<string, unknown>, TResult = unknown>(
    id: string
  ): ModuleDefinition<TParams, TResult> | undefined {
    return this.modules.get(id) as ModuleDefinition<TParams, TResult> | undefined;
  }

  /**
   * Execute a module by ID with parameter overrides
   */
  execute<TResult = unknown>(
    moduleId: string,
    paramOverrides: Record<string, unknown>,
    context: ModuleContext,
    ...args: unknown[]
  ): TResult {
    const module = this.modules.get(moduleId);
    if (!module) {
      throw new Error(`Module not found: ${moduleId}`);
    }

    // Merge defaults with overrides
    const params = { ...module.defaults, ...paramOverrides };

    return module.execute(params, context, ...args) as TResult;
  }

  /**
   * List all registered modules
   */
  list(): ModuleDefinition[] {
    return Array.from(this.modules.values());
  }

  /**
   * List modules by category
   */
  listByCategory(category: string): ModuleDefinition[] {
    return this.list().filter(m => m.category === category);
  }
}

// Singleton instance
export const moduleRegistry = new ModuleRegistry();
