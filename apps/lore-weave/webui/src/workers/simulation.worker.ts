/**
 * Web Worker for World Simulation
 *
 * Runs WorldEngine.run() off the main UI thread.
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

  if (message.type === 'start') {
    await runSimulation(message.config as EngineConfig, message.initialState);
  } else if (message.type === 'abort') {
    // TODO: Implement graceful abort via AbortController
    // For now, worker termination is handled by main thread calling worker.terminate()
  }
};

/**
 * Run the world simulation
 */
async function runSimulation(config: EngineConfig, initialState: HardState[]): Promise<void> {
  const emitter = createWorkerEmitter();

  try {
    // Create engine with the worker emitter
    const engineConfig: EngineConfig = {
      ...config,
      emitter
    };

    const engine = new WorldEngine(engineConfig, initialState);

    // Run simulation - all events are emitted to main thread via postMessage
    await engine.run();

    // Note: complete event is emitted by WorldEngine itself

  } catch (error) {
    // Emit error event
    emitter.error({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      phase: 'simulation',
      context: {}
    });
  }
}

// Export empty object for module compatibility
export {};
