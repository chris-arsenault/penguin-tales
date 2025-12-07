/**
 * Web Worker for World Simulation
 *
 * Runs WorldEngine simulation off the main UI thread.
 * Supports two modes:
 * - Full run: Executes entire simulation with engine.run()
 * - Step mode: Executes one epoch at a time with engine.step()
 *
 * Communicates progress and results via postMessage.
 */

import { WorldEngine } from '../../../lib/engine/worldEngine';
import { SimulationEmitter } from '../../../lib/observer/SimulationEmitter';
import { validateAllConfigs, formatValidationResult } from '../../../lib/engine/configSchemaValidator';
import type {
  SimulationEvent,
  WorkerInboundMessage
} from '../../../lib/observer/types';
import type { EngineConfig } from '../../../lib/engine/types';
import type { HardState } from '../../../lib/core/worldTypes';

// Worker context
const ctx: Worker = self as unknown as Worker;

// Engine instance (persisted for step mode)
let engine: WorldEngine | null = null;
let initialState: HardState[] = [];
let emitter: SimulationEmitter | null = null;

/**
 * Create an emitter that posts messages to the main thread
 */
function createWorkerEmitter(): SimulationEmitter {
  return new SimulationEmitter((event: SimulationEvent) => {
    ctx.postMessage(event);
  });
}

/**
 * Validate configuration before starting simulation.
 * Returns true if valid, false if invalid (error already emitted).
 */
function validateConfigBeforeRun(config: EngineConfig, workerEmitter: SimulationEmitter): boolean {
  // Extract culture names from domain schema if available
  const cultures = config.domain?.cultures?.map(c =>
    typeof c === 'string' ? c : c.id
  );

  // Extract entity kinds from domain schema if available
  const entityKinds = config.domain?.entityKinds?.map(k =>
    typeof k === 'string' ? k : k.id
  );

  // Extract relationship kinds from domain schema if available
  const relationshipKinds = config.domain?.relationshipKinds?.map(k =>
    typeof k === 'string' ? k : k.id
  );

  const result = validateAllConfigs({
    templates: config.templates,
    pressures: config.pressures,
    systems: config.systems,
    eras: config.eras,
    schema: {
      cultures,
      entityKinds,
      relationshipKinds
    }
  });

  if (!result.valid) {
    workerEmitter.error({
      message: `Configuration validation failed:\n\n${formatValidationResult(result)}`,
      phase: 'validation',
      context: {
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        errors: result.errors
      }
    });
    return false;
  }

  // Log warnings but don't block
  if (result.warnings.length > 0) {
    workerEmitter.log('warn', `Configuration warnings:\n${formatValidationResult(result)}`);
  }

  return true;
}

/**
 * Handle incoming messages from main thread
 */
ctx.onmessage = async (event: MessageEvent<WorkerInboundMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'start':
      await runSimulation(message.config as EngineConfig, message.initialState);
      break;

    case 'startStepping':
      await initializeForStepping(message.config as EngineConfig, message.initialState);
      break;

    case 'step':
      await stepSimulation();
      break;

    case 'runToCompletion':
      await runToCompletion();
      break;

    case 'reset':
      resetSimulation();
      break;

    case 'abort':
      // Clear engine state
      engine = null;
      emitter = null;
      break;

    case 'exportState':
      exportCurrentState();
      break;
  }
};

/**
 * Run the complete world simulation
 */
async function runSimulation(config: EngineConfig, state: HardState[]): Promise<void> {
  emitter = createWorkerEmitter();
  initialState = state;

  // Validate configuration before starting
  if (!validateConfigBeforeRun(config, emitter)) {
    return; // Error already emitted
  }

  try {
    // Create engine with the worker emitter
    const engineConfig: EngineConfig = {
      ...config,
      emitter,
    };

    engine = new WorldEngine(engineConfig, initialState);

    // Run simulation - all events are emitted to main thread via postMessage
    await engine.run();

    // Note: complete event is emitted by WorldEngine itself

  } catch (error) {
    emitter.error({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      phase: 'simulation',
      context: {}
    });
  }
}

/**
 * Initialize for step mode without running
 * Creates engine and emits initial paused state
 */
async function initializeForStepping(config: EngineConfig, state: HardState[]): Promise<void> {
  emitter = createWorkerEmitter();
  initialState = state;

  // Validate configuration before starting
  if (!validateConfigBeforeRun(config, emitter)) {
    return; // Error already emitted
  }

  try {
    // Create engine with the worker emitter
    const engineConfig: EngineConfig = {
      ...config,
      emitter,
    };

    engine = new WorldEngine(engineConfig, initialState);

    // Emit paused state - ready for stepping
    emitter.progress({
      phase: 'paused',
      tick: engine.getGraph().tick,
      maxTicks: engineConfig.maxTicks,
      epoch: engine.getCurrentEpoch(),
      totalEpochs: engine.getTotalEpochs(),
      entityCount: engine.getGraph().getEntityCount(),
      relationshipCount: engine.getGraph().getRelationshipCount()
    });

  } catch (error) {
    emitter.error({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      phase: 'initialization',
      context: {}
    });
  }
}

/**
 * Step the simulation by one epoch
 */
async function stepSimulation(): Promise<void> {
  if (!engine || !emitter) {
    emitter?.error({
      message: 'No simulation initialized. Call start first.',
      phase: 'step',
      context: {}
    });
    return;
  }

  try {
    const hasMore = await engine.step();

    if (!hasMore) {
      // Simulation complete - complete event already emitted by finalize()
    } else {
      // Emit paused progress to indicate step completed
      emitter.progress({
        phase: 'paused',
        tick: engine.getGraph().tick,
        maxTicks: engine.getGraph().config.maxTicks,
        epoch: engine.getCurrentEpoch(),
        totalEpochs: engine.getTotalEpochs(),
        entityCount: engine.getGraph().getEntityCount(),
        relationshipCount: engine.getGraph().getRelationshipCount()
      });
    }
  } catch (error) {
    emitter.error({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      phase: 'step',
      context: {}
    });
  }
}

/**
 * Run remaining epochs to completion (from paused state)
 */
async function runToCompletion(): Promise<void> {
  if (!engine || !emitter) {
    emitter?.error({
      message: 'No simulation initialized. Call start first.',
      phase: 'runToCompletion',
      context: {}
    });
    return;
  }

  try {
    // Keep stepping until complete
    let hasMore = true;
    while (hasMore) {
      hasMore = await engine.step();
    }
    // Complete event already emitted by finalize()
  } catch (error) {
    emitter.error({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      phase: 'runToCompletion',
      context: {}
    });
  }
}

/**
 * Reset the simulation to initial state
 */
function resetSimulation(): void {
  if (!engine || !emitter) {
    emitter?.error({
      message: 'No simulation initialized. Call start first.',
      phase: 'reset',
      context: {}
    });
    return;
  }

  try {
    engine.reset(initialState);
  } catch (error) {
    emitter?.error({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      phase: 'reset',
      context: {}
    });
  }
}

/**
 * Export current state for Archivist (without finalizing simulation)
 */
function exportCurrentState(): void {
  if (!engine || !emitter) {
    emitter?.error({
      message: 'No simulation initialized. Call start first.',
      phase: 'exportState',
      context: {}
    });
    return;
  }

  try {
    const graph = engine.getGraph();
    const isComplete = engine.isComplete();

    emitter.stateExport({
      metadata: {
        tick: graph.tick,
        epoch: engine.getCurrentEpoch(),
        era: graph.currentEra.name,
        entityCount: graph.getEntityCount(),
        relationshipCount: graph.getRelationshipCount(),
        historyEventCount: graph.history.length,
        isComplete
      },
      hardState: graph.getEntities(),
      relationships: graph.getRelationships(),
      history: graph.history,
      pressures: Object.fromEntries(graph.pressures)
    });
  } catch (error) {
    emitter?.error({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      phase: 'exportState',
      context: {}
    });
  }
}

// Export empty object for module compatibility
export {};
