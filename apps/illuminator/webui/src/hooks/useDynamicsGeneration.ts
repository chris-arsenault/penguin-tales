/**
 * useDynamicsGeneration - Hook for managing multi-turn dynamics generation
 *
 * Orchestrates the flow:
 * 1. Create run in IndexedDB
 * 2. Dispatch worker task (one LLM turn)
 * 3. Monitor IndexedDB for status changes (polling)
 * 4. Execute searches when worker requests them
 * 5. Collect user feedback and dispatch next turn
 * 6. Import final dynamics into worldContext
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { QueueItem, EnrichmentType } from '../lib/enrichmentTypes';
import type {
  DynamicsRun,
  DynamicsMessage,
  DynamicsSearchRequest,
} from '../lib/dynamicsGenerationTypes';
import {
  createDynamicsRun,
  getDynamicsRun,
  updateDynamicsRun,
  generateRunId,
  deleteDynamicsRun,
} from '../lib/dynamicsGenerationStorage';
import {
  executeSearches,
  type WorldSearchContext,
} from '../lib/dynamicsSearchExecutor';
import type { EntityContext, RelationshipContext } from '../lib/chronicleTypes';

// ============================================================================
// Types
// ============================================================================

export interface DynamicsGenerationConfig {
  projectId: string;
  simulationRunId: string;
  /** Static pages content (primary context) */
  staticPagesContext: string;
  /** Schema context (secondary) */
  schemaContext: string;
  /** In-memory entity data for search execution */
  entities: EntityContext[];
  relationships: RelationshipContext[];
}

export interface UseDynamicsGenerationReturn {
  /** Current run state */
  run: DynamicsRun | null;
  /** Whether a generation is active */
  isActive: boolean;
  /** Start a new dynamics generation session */
  startGeneration: (config: DynamicsGenerationConfig) => void;
  /** Submit user feedback and trigger next LLM turn */
  submitFeedback: (feedback: string) => void;
  /** Accept proposed dynamics and close the session */
  acceptDynamics: () => void;
  /** Cancel the current session */
  cancelGeneration: () => void;
}

// ============================================================================
// Hook
// ============================================================================

const POLL_INTERVAL_MS = 1000;

export function useDynamicsGeneration(
  onEnqueue: (items: Array<{
    entity: { id: string; name: string; kind: string; subtype: string; prominence: string; culture: string; status: string; description: string; tags: Record<string, unknown> };
    type: EnrichmentType;
    prompt: string;
    chronicleId?: string;
  }>) => void,
  onDynamicsAccepted?: (dynamics: DynamicsRun['proposedDynamics']) => void
): UseDynamicsGenerationReturn {
  const [run, setRun] = useState<DynamicsRun | null>(null);
  const [isActive, setIsActive] = useState(false);
  const configRef = useRef<DynamicsGenerationConfig | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  // Poll IndexedDB for run state changes
  const startPolling = useCallback((runId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const updated = await getDynamicsRun(runId);
      if (!updated) return;

      setRun(updated);

      // If worker returned search requests, execute them on the main thread
      if (updated.status === 'awaiting_searches' && updated.pendingSearches?.length) {
        const config = configRef.current;
        if (!config) return;

        const searchContext: WorldSearchContext = {
          entities: config.entities,
          relationships: config.relationships,
        };
        const results = executeSearches(updated.pendingSearches, searchContext);

        // Write results back and trigger next LLM turn
        await updateDynamicsRun(runId, {
          searchResults: results,
          pendingSearches: undefined,
          status: 'pending',
        });

        // Dispatch next worker turn
        dispatchWorkerTask(runId, config);
      }

      // Stop polling on terminal states
      if (updated.status === 'awaiting_review' || updated.status === 'complete' || updated.status === 'failed') {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  // Dispatch a worker task for one LLM turn
  const dispatchWorkerTask = useCallback((runId: string, config: DynamicsGenerationConfig) => {
    const sentinelEntity = {
      id: '__dynamics__',
      name: 'World Dynamics',
      kind: 'system',
      subtype: '',
      prominence: '',
      culture: '',
      status: 'active',
      description: '',
      tags: {},
    };

    onEnqueue([{
      entity: sentinelEntity,
      type: 'dynamicsGeneration' as EnrichmentType,
      prompt: '',
      chronicleId: runId, // Repurpose chronicleId for runId
    }]);
  }, [onEnqueue]);

  // Start a new generation session
  const startGeneration = useCallback(async (config: DynamicsGenerationConfig) => {
    configRef.current = config;
    const runId = generateRunId();

    // Create run with initial context as system message
    const initialMessage: DynamicsMessage = {
      role: 'system',
      content: buildInitialContext(config),
      timestamp: Date.now(),
    };

    const newRun = await createDynamicsRun(runId, config.projectId, config.simulationRunId);
    await updateDynamicsRun(runId, {
      messages: [initialMessage],
      status: 'pending',
    });

    const updatedRun = await getDynamicsRun(runId);
    setRun(updatedRun || newRun);
    setIsActive(true);

    // Dispatch first worker turn
    dispatchWorkerTask(runId, config);

    // Start polling
    startPolling(runId);
  }, [dispatchWorkerTask, startPolling]);

  // Submit user feedback and trigger next turn
  const submitFeedback = useCallback(async (feedback: string) => {
    if (!run || !configRef.current) return;

    await updateDynamicsRun(run.runId, {
      userFeedback: feedback,
      status: 'pending',
    });

    // Dispatch next worker turn
    dispatchWorkerTask(run.runId, configRef.current);

    // Resume polling
    startPolling(run.runId);
  }, [run, dispatchWorkerTask, startPolling]);

  // Accept proposed dynamics
  const acceptDynamics = useCallback(() => {
    if (!run?.proposedDynamics) return;

    onDynamicsAccepted?.(run.proposedDynamics);
    setIsActive(false);
    stopPolling();

    // Clean up the run record
    if (run.runId) {
      deleteDynamicsRun(run.runId).catch(() => {});
    }
  }, [run, onDynamicsAccepted, stopPolling]);

  // Cancel
  const cancelGeneration = useCallback(() => {
    setIsActive(false);
    stopPolling();
    if (run?.runId) {
      deleteDynamicsRun(run.runId).catch(() => {});
    }
    setRun(null);
  }, [run, stopPolling]);

  return {
    run,
    isActive,
    startGeneration,
    submitFeedback,
    acceptDynamics,
    cancelGeneration,
  };
}

// ============================================================================
// Context Assembly
// ============================================================================

function buildInitialContext(config: DynamicsGenerationConfig): string {
  const sections: string[] = [];

  // Primary: Static pages (lore bible)
  if (config.staticPagesContext) {
    sections.push(`=== LORE BIBLE (PRIMARY SOURCE) ===\n${config.staticPagesContext}`);
  }

  // Secondary: Schema
  if (config.schemaContext) {
    sections.push(`=== WORLD SCHEMA ===\n${config.schemaContext}`);
  }

  // Addendum: Entity summary overview (era summaries are especially valuable)
  const eras = config.entities.filter((e) => e.kind === 'era');
  if (eras.length > 0) {
    const eraSummaries = eras
      .map((e) => `- ${e.name}: ${e.summary || e.description || '(no summary)'}`)
      .join('\n');
    sections.push(`=== ERA SUMMARIES ===\n${eraSummaries}`);
  }

  // Quick entity kind breakdown
  const kindCounts: Record<string, number> = {};
  for (const e of config.entities) {
    kindCounts[e.kind] = (kindCounts[e.kind] || 0) + 1;
  }
  const breakdown = Object.entries(kindCounts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  sections.push(`=== WORLD STATE OVERVIEW ===\nEntity breakdown: ${breakdown}\nTotal entities: ${config.entities.length}`);

  return sections.join('\n\n');
}
