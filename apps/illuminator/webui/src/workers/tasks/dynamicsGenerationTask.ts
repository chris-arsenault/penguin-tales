/**
 * Dynamics Generation Worker Task
 *
 * Reads run state from IndexedDB, assembles context (static pages + schema
 * + conversation history + search results), makes one LLM call, and writes
 * the response back to IndexedDB.
 *
 * Each invocation handles a single LLM turn. The UI re-dispatches for
 * subsequent turns after search execution or user feedback.
 */

import type { WorkerTask } from '../../lib/enrichmentTypes';
import type { TaskContext } from './taskTypes';
import type { TaskResult } from '../types';
import type {
  DynamicsLLMResponse,
  DynamicsMessage,
} from '../../lib/dynamicsGenerationTypes';
import { getDynamicsRun, updateDynamicsRun } from '../../lib/dynamicsGenerationStorage';
import { runTextCall } from '../../lib/llmTextCall';
import { getCallConfig } from './llmCallConfig';
import { saveCostRecordWithDefaults, type CostType } from '../../lib/costStorage';

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a world dynamics analyst for a procedural fantasy world generation system. Your job is to identify and articulate the macro-level dynamics — the recurring tensions, alliances, behavioral patterns, and cultural forces — that drive individual stories in this world.

You will receive:
1. LORE BIBLE: Static pages containing the primary world lore (cultures, history, mechanics)
2. SCHEMA: Entity kinds, relationship kinds, and culture definitions
3. WORLD STATE: Entity summaries grouped by kind, relationship patterns, and era descriptions from the actual simulation
4. CONVERSATION HISTORY: Previous turns and user feedback (on refinement turns)

Your task each turn:
- Analyze the lore AND the world state data to identify world dynamics
- Propose dynamics as concise statements with optional culture/kind filters
- Explain your reasoning so the user can steer

IMPORTANT: Dynamics should be DERIVED FROM THE LORE AND WORLD STATE, not invented. They describe forces and patterns that the lore establishes and the simulation data confirms. Use entity summaries, relationship patterns, and era descriptions to ground your dynamics in what actually exists in the world.

Output ONLY valid JSON in this format:
{
  "dynamics": [
    { "text": "Statement about a world dynamic", "cultures": ["culture1"], "kinds": ["kind1"] }
  ],
  "reasoning": "Explanation of your analysis and reasoning",
  "complete": false
}

Set "complete": true when you believe the dynamics are comprehensive and refined.
Cultures and kinds on dynamics are optional filters — omit them for universal dynamics.`;

// ============================================================================
// Context Assembly
// ============================================================================

function buildUserPrompt(run: { messages: DynamicsMessage[]; userFeedback?: string }): string {
  const sections: string[] = [];

  // Rebuild conversation from messages
  for (const msg of run.messages) {
    if (msg.role === 'system') {
      sections.push(msg.content);
    } else if (msg.role === 'assistant') {
      sections.push(`=== YOUR PREVIOUS RESPONSE ===\n${msg.content}`);
    } else if (msg.role === 'user') {
      sections.push(`=== USER FEEDBACK ===\n${msg.content}`);
    }
  }

  // Add user feedback if present
  if (run.userFeedback) {
    sections.push(`=== USER FEEDBACK ===\n${run.userFeedback}`);
  }

  // Add task instruction
  const isFirstTurn = run.messages.filter((m) => m.role === 'assistant').length === 0;
  if (isFirstTurn) {
    sections.push(`=== YOUR TASK ===
Based on the lore bible, schema, and world state above, identify the world dynamics — the macro-level forces, tensions, alliances, and behavioral patterns that drive stories in this world.

Use the entity summaries and relationship data to ground your dynamics in the actual simulation state.`);
  } else {
    sections.push(`=== YOUR TASK ===
Continue refining the world dynamics based on user feedback. Propose updated dynamics.`);
  }

  return sections.join('\n\n');
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeDynamicsGenerationTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: 'Text generation not configured - missing Anthropic API key' };
  }

  const runId = task.chronicleId; // Repurposing chronicleId field for runId
  if (!runId) {
    return { success: false, error: 'runId (chronicleId) required for dynamics generation' };
  }

  // Read current run state
  const run = await getDynamicsRun(runId);
  if (!run) {
    return { success: false, error: `Dynamics run ${runId} not found` };
  }

  // Mark as generating
  await updateDynamicsRun(runId, { status: 'generating' });

  const callConfig = getCallConfig(config, 'dynamics.generation');
  const userPrompt = buildUserPrompt(run);

  try {
    const callResult = await runTextCall({
      llmClient,
      callType: 'dynamics.generation',
      callConfig,
      systemPrompt: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.7,
    });

    if (isAborted()) {
      await updateDynamicsRun(runId, { status: 'failed', error: 'Task aborted' });
      return { success: false, error: 'Task aborted' };
    }

    const resultText = callResult.result.text?.trim();
    if (callResult.result.error || !resultText) {
      const errorMsg = `LLM call failed: ${callResult.result.error || 'No text returned'}`;
      await updateDynamicsRun(runId, { status: 'failed', error: errorMsg });
      return { success: false, error: errorMsg };
    }

    // Parse LLM response
    let parsed: DynamicsLLMResponse;
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object found');
      parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.dynamics)) throw new Error('Missing dynamics array');
      if (typeof parsed.reasoning !== 'string') parsed.reasoning = '';
      if (typeof parsed.complete !== 'boolean') parsed.complete = false;
    } catch (err) {
      const errorMsg = `Failed to parse LLM response: ${err instanceof Error ? err.message : String(err)}`;
      await updateDynamicsRun(runId, { status: 'failed', error: errorMsg });
      return { success: false, error: errorMsg };
    }

    // Build updated messages
    const newMessages: DynamicsMessage[] = [...run.messages];

    // Add user feedback as a message if provided
    if (run.userFeedback) {
      newMessages.push({ role: 'user', content: run.userFeedback, timestamp: Date.now() });
    }

    // Add assistant response
    newMessages.push({ role: 'assistant', content: resultText, timestamp: Date.now() });

    // Update run
    await updateDynamicsRun(runId, {
      status: 'awaiting_review',
      messages: newMessages,
      proposedDynamics: parsed.dynamics,
      userFeedback: undefined,  // Clear consumed feedback
      totalInputTokens: run.totalInputTokens + callResult.usage.inputTokens,
      totalOutputTokens: run.totalOutputTokens + callResult.usage.outputTokens,
      totalActualCost: run.totalActualCost + callResult.usage.actualCost,
    });

    // Record cost
    await saveCostRecordWithDefaults({
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      entityId: task.entityId,
      entityName: task.entityName,
      entityKind: task.entityKind,
      type: 'dynamicsGeneration' as CostType,
      model: callConfig.model,
      estimatedCost: callResult.estimate.estimatedCost,
      actualCost: callResult.usage.actualCost,
      inputTokens: callResult.usage.inputTokens,
      outputTokens: callResult.usage.outputTokens,
    });

    return {
      success: true,
      result: {
        generatedAt: Date.now(),
        model: callConfig.model,
        estimatedCost: callResult.estimate.estimatedCost,
        actualCost: callResult.usage.actualCost,
        inputTokens: callResult.usage.inputTokens,
        outputTokens: callResult.usage.outputTokens,
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await updateDynamicsRun(runId, { status: 'failed', error: errorMsg });
    return { success: false, error: `Dynamics generation failed: ${errorMsg}` };
  }
}

export const dynamicsGenerationTask = {
  type: 'dynamicsGeneration' as const,
  execute: executeDynamicsGenerationTask,
};
