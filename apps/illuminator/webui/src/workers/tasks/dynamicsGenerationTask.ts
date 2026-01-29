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
  DynamicsRun,
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
3. CONVERSATION HISTORY: Previous turns, search results, and user feedback
4. SEARCH RESULTS: Entity data you requested from the world state (if any)

Your task each turn:
- Analyze the lore and any search results to identify world dynamics
- Propose dynamics as concise statements with optional culture/kind filters
- If you need more information about specific entities, relationships, or patterns, request searches
- Explain your reasoning so the user can steer

IMPORTANT: Dynamics should be DERIVED FROM THE LORE, not invented. They describe forces and patterns that the lore establishes. World state data (entity summaries, era descriptions) refines and grounds these in the actual simulation output.

For searches, you can request:
- textQuery: Search entity summaries/descriptions for keywords
- kinds: Filter by entity kind (e.g., ["npc", "artifact"])
- cultures: Filter by culture (e.g., ["nightshelf", "aurora_stack"])
- tags: Filter by tag key/value (e.g., {"role": "leader"})
- eraId: Filter by era
- connectedTo: Find entities connected to a specific entity ID

Output ONLY valid JSON in this format:
{
  "dynamics": [
    { "text": "Statement about a world dynamic", "cultures": ["culture1"], "kinds": ["kind1"] }
  ],
  "reasoning": "Explanation of your analysis and reasoning",
  "searches": [
    { "id": "search_1", "intent": "What this search is looking for", "textQuery": "keyword" }
  ],
  "complete": false
}

Set "complete": true when you believe the dynamics are comprehensive and refined.
Omit "searches" if you don't need more data this turn.
Cultures and kinds on dynamics are optional filters — omit them for universal dynamics.`;

// ============================================================================
// Context Assembly
// ============================================================================

function buildUserPrompt(run: DynamicsRun): string {
  const sections: string[] = [];

  // Rebuild conversation from messages
  for (const msg of run.messages) {
    if (msg.role === 'system') {
      sections.push(msg.content);
    } else if (msg.role === 'assistant') {
      sections.push(`=== YOUR PREVIOUS RESPONSE ===\n${msg.content}`);
    } else if (msg.role === 'user') {
      sections.push(`=== USER FEEDBACK ===\n${msg.content}`);
    } else if (msg.role === 'search_results') {
      sections.push(`=== SEARCH RESULTS ===\n${msg.content}`);
    }
  }

  // Add pending search results if the UI executed searches
  if (run.searchResults && run.searchResults.length > 0) {
    const resultText = run.searchResults.map((sr) => {
      const entries = sr.results.map((e) =>
        `  - ${e.name} (${e.kind}${e.culture ? `, ${e.culture}` : ''}): ${e.summary}`
      ).join('\n');
      return `Search "${sr.intent}" (${sr.results.length} results):\n${entries}`;
    }).join('\n\n');
    sections.push(`=== SEARCH RESULTS ===\n${resultText}`);
  }

  // Add user feedback if present
  if (run.userFeedback) {
    sections.push(`=== USER FEEDBACK ===\n${run.userFeedback}`);
  }

  // Add task instruction
  if (run.messages.length === 0) {
    // First turn — ask for initial analysis
    sections.push(`=== YOUR TASK ===
Based on the lore bible and schema above, identify the world dynamics — the macro-level forces, tensions, alliances, and behavioral patterns that drive stories in this world.

Start by proposing dynamics derived from the lore. If you need entity data to ground or refine them, include search requests.`);
  } else {
    // Subsequent turns
    sections.push(`=== YOUR TASK ===
Continue refining the world dynamics based on any new search results and user feedback. Propose updated dynamics.`);
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

    // Add search results as a message if they were provided
    if (run.searchResults && run.searchResults.length > 0) {
      const resultText = run.searchResults.map((sr) => {
        const entries = sr.results.map((e) =>
          `- ${e.name} (${e.kind}${e.culture ? `, ${e.culture}` : ''}): ${e.summary}`
        ).join('\n');
        return `Search "${sr.intent}" (${sr.results.length} results):\n${entries}`;
      }).join('\n\n');
      newMessages.push({ role: 'search_results', content: resultText, timestamp: Date.now() });
    }

    // Add user feedback as a message if provided
    if (run.userFeedback) {
      newMessages.push({ role: 'user', content: run.userFeedback, timestamp: Date.now() });
    }

    // Add assistant response
    newMessages.push({ role: 'assistant', content: resultText, timestamp: Date.now() });

    // Determine next status
    const hasSearches = parsed.searches && parsed.searches.length > 0;
    const nextStatus = hasSearches ? 'awaiting_searches' : 'awaiting_review';

    // Update run
    await updateDynamicsRun(runId, {
      status: nextStatus,
      messages: newMessages,
      proposedDynamics: parsed.dynamics,
      pendingSearches: hasSearches ? parsed.searches : undefined,
      searchResults: undefined, // Clear consumed search results
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
