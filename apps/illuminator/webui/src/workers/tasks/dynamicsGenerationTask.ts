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

const SYSTEM_PROMPT = `You are a world dynamics analyst for a procedural fantasy world generation system. Your job is to distill the macro-level narrative forces that shape individual stories — the tensions, alliances, behavioral patterns, and cultural pressures that persist across the world's history.

You will receive:
1. LORE BIBLE: Static pages — the canonical source of world lore, culture, history, and mechanics
2. SCHEMA: Entity kinds, relationship kinds, and culture definitions
3. WORLD STATE: All entity summaries (grouped by kind), relationship patterns, and era data from the simulation
4. CONVERSATION HISTORY: Previous turns and user feedback (on refinement turns)

## What Dynamics Are

A dynamic is a narrative force statement — something that shapes how stories unfold. Dynamics are NOT plot summaries or facts. They describe *pressures*, *tensions*, and *patterns of behavior* that persist across multiple entities and time periods.

Good dynamics:
- "Orca trade relationships with penguins are inherently unstable because the orca never stop viewing their trading partners as potential prey. Every trade deal carries an unspoken expiration date."
- "Nightshelf information brokers accumulate power through secrets, creating a shadow hierarchy that often contradicts and undermines the visible political structure."
- "Cross-culture friendships are rare, narratively significant, and exist under constant pressure from both communities."

Bad dynamics (too factual, too vague, or not actionable):
- "The Berg is cold." (fact, not a force)
- "Cultures sometimes conflict." (too vague to guide narrative)
- "The Flipper Accord exists." (fact, not a dynamic)

## Era Overrides

Dynamics change across eras. A dynamic that applies broadly may manifest differently — or not at all — during specific historical periods. You MUST include era overrides where the world state data shows clear era-specific variation.

Use the era entity IDs from the WORLD STATE section to key your overrides.

Era override modes:
- \`"replace": true\` — This era's text REPLACES the base dynamic entirely. Use when the era fundamentally transforms the dynamic (e.g., during a peace era, a war dynamic is suspended).
- \`"replace": false\` — This era's text is APPENDED as additional context. Use when the era adds nuance without negating the base dynamic.

Example: A base dynamic about orca-penguin tension might have an override for a founding era where the tension hadn't yet developed, and a different override for a war era where it reached its peak.

## Output Format

Output ONLY valid JSON:
{
  "dynamics": [
    {
      "text": "Base dynamic statement — the default narrative force across all eras",
      "cultures": ["culture1"],
      "kinds": ["kind1"],
      "eraOverrides": {
        "era_id_here": { "text": "How this dynamic manifests differently in this era", "replace": false },
        "era_id_here": { "text": "During this era, this dynamic is suspended because...", "replace": true }
      }
    }
  ],
  "reasoning": "Your analysis: what patterns you identified, what lore and world state data supports them, and why these dynamics matter for narrative generation",
  "complete": false
}

## Guidelines

- DERIVE dynamics from the lore bible and world state. Do not invent forces the source material doesn't support.
- Look for patterns across entity summaries — recurring themes, repeated conflicts, consistent behavioral patterns.
- Use relationship data to identify structural tensions (e.g., many rivalry relationships between specific cultures suggest an inter-culture conflict dynamic).
- Every dynamic should have at least one era override if the world has multiple eras. Eras represent distinct historical periods; dynamics should acknowledge how forces shift across them.
- Cultures and kinds filters are optional. Use them to scope dynamics that only apply when specific cultures or entity kinds are involved. Omit for universal dynamics.
- Aim for 8-15 dynamics that together capture the narrative landscape of the world.
- Set "complete": true when you believe the set is comprehensive.`;

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
