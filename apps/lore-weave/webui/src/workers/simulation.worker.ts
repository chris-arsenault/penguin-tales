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
  }
};

/**
 * Run the complete world simulation
 */
async function runSimulation(config: EngineConfig, state: HardState[]): Promise<void> {
  emitter = createWorkerEmitter();
  initialState = state;

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

// Export empty object for module compatibility
export {};
