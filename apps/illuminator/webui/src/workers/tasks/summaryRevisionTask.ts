/**
 * Summary Revision Worker Task
 *
 * Reads run state from IndexedDB, assembles context for the current batch
 * (world dynamics + lore + entity data), makes one LLM call per batch,
 * and writes the resulting patches back to IndexedDB.
 *
 * Each invocation handles a single batch. The UI dispatches the next batch
 * after the user reviews the current one.
 */

import type { WorkerTask } from '../../lib/enrichmentTypes';
import type { TaskContext } from './taskTypes';
import type { TaskResult } from '../types';
import type {
  SummaryRevisionLLMResponse,
  RevisionEntityContext,
} from '../../lib/summaryRevisionTypes';
import { getRevisionRun, updateRevisionRun } from '../../lib/summaryRevisionStorage';
import { runTextCall } from '../../lib/llmTextCall';
import { getCallConfig } from './llmCallConfig';
import { saveCostRecordWithDefaults, type CostType } from '../../lib/costStorage';

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a revision editor for a procedural fantasy world generation system. You receive batches of entity summaries and descriptions and suggest targeted patches — not rewrites — to improve narrative diversity and coherence.

## Your Role

You are editing existing text, not writing from scratch. The original author's voice should be preserved. You suggest specific, minimal changes that address concrete issues.

## What You Receive

1. WORLD DYNAMICS: Era-aware world facts — the active forces, tensions, and alliances operating in this world
2. LORE BIBLE: Static pages of canonical world lore (excerpts relevant to this batch's culture)
3. SCHEMA: Entity kinds and relationship kinds for reference
4. BATCH ENTITIES: A group of entities from the same culture, each with:
   - Current summary and description
   - Visual thesis (the one-sentence visual identity used for image generation — DO NOT CONTRADICT)
   - Key relationships

## Revision Guidelines

### CRITICAL: Visual Thesis Preservation
Each entity has a visual thesis — a one-sentence description of their visual appearance used for image generation. Your revisions MUST NOT change anything that would contradict the visual thesis. If the thesis says "a scarred penguin clutching a cracked shield," do not remove references to scarring or the shield from the summary/description.

### What to Fix

**1. Motif repetition within the batch**
Scan all entities in the batch. If multiple entities use the same phrase or metaphor, revise all but the one where it fits best. Common overused patterns:
- "the ice remembers" — replace with entity-specific evidence of memory (tool-marks, mineral strata, burn-scars, archival records)
- "something vast" or "something ancient" — commit to naming what it is (the dead god, corruption, a geological formation)
- "no one remembers/knows" — replace with specific cultural reasoning ("records were sealed after the Schism", "the Guild forbids discussion")
- "carries the weight of" / "haunted by" / "bears the scars of" — replace with observed behavior or visual evidence
- "learned to [verb]" — replace with culture-specific adaptation language
- "refuses to discuss" — add an observable behavior that reveals what silence conceals

**2. Vagueness where specificity would serve**
Replace generic tension descriptions with named entities, factions, locations, and events from the world dynamics. "Trade tensions between the colonies" should become "The Flipper Accord's fire-core shipments from Nightfall Shelf."

**3. Uniform emotional register**
Not every entity should feel anxious, wounded, or haunted. Vary the emotional texture: pragmatic, ambitious, curious, resigned, defiant, indifferent, obsessive.

**4. Culture-specific voice**
Entities from the same culture should share cultural markers but express them differently:
- Aurora Stack: astronomical/measurement metaphors, political accountability, aurora-light sensory details
- Nightshelf: guild/transaction language, fire-core mechanics, tunnel/depth imagery
- Orca: predatory/sensory language, whale-song, pressure-depth, alien perspective

### What NOT to Fix
- Do not rewrite descriptions from scratch
- Do not add new information not supported by the entity's relationships or world context
- Do not change the entity's fundamental identity, role, or status
- Do not add poetic flourishes or literary embellishment
- Do not change anything that would contradict the visual thesis
- If an entity's description is already good, output no patch for it

## Output Format

Output ONLY valid JSON:
{
  "patches": [
    {
      "entityId": "entity_id_here",
      "entityName": "Entity Name",
      "entityKind": "npc",
      "summary": "Revised summary text (omit this field entirely if no change needed)",
      "description": "Revised description text (omit this field entirely if no change needed)",
      "reasoning": "Brief explanation of what was changed and why"
    }
  ],
  "batchReasoning": "Overall analysis: what patterns you found across the batch, what you changed, what you left alone and why"
}

Rules:
- Only include entities that need changes. If an entity is fine, omit it from patches entirely.
- For each included entity, only include the fields that changed (summary and/or description). Omit unchanged fields.
- Keep reasoning concise — 1-2 sentences per entity.
- The batchReasoning should identify cross-entity patterns you detected and how you addressed them.`;

// ============================================================================
// Context Assembly
// ============================================================================

function buildUserPrompt(
  entities: RevisionEntityContext[],
  worldDynamicsContext: string,
  staticPagesContext: string,
  schemaContext: string,
  revisionGuidance: string,
  culture: string,
): string {
  const sections: string[] = [];

  // World dynamics
  if (worldDynamicsContext) {
    sections.push(`=== WORLD DYNAMICS ===\n${worldDynamicsContext}`);
  }

  // Lore bible (excerpt)
  if (staticPagesContext) {
    sections.push(`=== LORE BIBLE (excerpts) ===\n${staticPagesContext}`);
  }

  // Schema
  if (schemaContext) {
    sections.push(`=== SCHEMA ===\n${schemaContext}`);
  }

  // Additional revision guidance (user-editable)
  if (revisionGuidance) {
    sections.push(`=== ADDITIONAL REVISION GUIDANCE ===\n${revisionGuidance}`);
  }

  // Batch entities
  const entityLines: string[] = [];
  for (const e of entities) {
    const parts: string[] = [];
    parts.push(`### ${e.name} (${e.kind}${e.subtype ? ` / ${e.subtype}` : ''})`);
    parts.push(`ID: ${e.id}`);
    parts.push(`Prominence: ${e.prominence} | Culture: ${e.culture} | Status: ${e.status}`);

    if (e.visualThesis) {
      parts.push(`Visual Thesis (DO NOT CONTRADICT): ${e.visualThesis}`);
    }

    if (e.relationships.length > 0) {
      const relLines = e.relationships.map(
        (r) => `  - ${r.kind} → ${r.targetName} (${r.targetKind})`
      );
      parts.push(`Relationships:\n${relLines.join('\n')}`);
    }

    parts.push(`Summary: ${e.summary}`);
    parts.push(`Description: ${e.description}`);

    entityLines.push(parts.join('\n'));
  }

  sections.push(`=== BATCH: ${culture} (${entities.length} entities) ===\n\n${entityLines.join('\n\n---\n\n')}`);

  // Task instruction
  sections.push(`=== YOUR TASK ===
Review the ${entities.length} entities above from the "${culture}" culture. Identify motif repetition, vagueness, and opportunities to ground descriptions in specific world dynamics. Propose targeted patches.

Remember:
- Only patch what needs fixing. Omit entities that are already good.
- Preserve the visual thesis for every entity.
- Keep the original author's voice. Minimal targeted edits, not rewrites.`);

  return sections.join('\n\n');
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeSummaryRevisionTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: 'Text generation not configured - missing Anthropic API key' };
  }

  const runId = task.chronicleId; // Repurposing chronicleId field for runId
  if (!runId) {
    return { success: false, error: 'runId (chronicleId) required for summary revision' };
  }

  // Read current run state
  const run = await getRevisionRun(runId);
  if (!run) {
    return { success: false, error: `Revision run ${runId} not found` };
  }

  // Find the current batch
  const batchIndex = run.currentBatchIndex;
  const batch = run.batches[batchIndex];
  if (!batch || batch.status !== 'pending') {
    return { success: false, error: `No pending batch at index ${batchIndex}` };
  }

  // Mark batch as generating
  const updatedBatches = [...run.batches];
  updatedBatches[batchIndex] = { ...batch, status: 'generating' };
  await updateRevisionRun(runId, { status: 'generating', batches: updatedBatches });

  // Entity data is passed via the task prompt field as JSON
  let entities: RevisionEntityContext[];
  try {
    entities = JSON.parse(task.prompt);
  } catch {
    const errorMsg = 'Failed to parse entity context from task prompt';
    updatedBatches[batchIndex] = { ...batch, status: 'failed', error: errorMsg };
    await updateRevisionRun(runId, { status: 'batch_reviewing', batches: updatedBatches });
    return { success: false, error: errorMsg };
  }

  const callConfig = getCallConfig(config, 'revision.summary');
  const userPrompt = buildUserPrompt(
    entities,
    run.worldDynamicsContext,
    run.staticPagesContext,
    run.schemaContext,
    run.revisionGuidance,
    batch.culture,
  );

  try {
    const callResult = await runTextCall({
      llmClient,
      callType: 'revision.summary',
      callConfig,
      systemPrompt: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.5,
    });

    if (isAborted()) {
      updatedBatches[batchIndex] = { ...batch, status: 'failed', error: 'Task aborted' };
      await updateRevisionRun(runId, { status: 'failed', batches: updatedBatches });
      return { success: false, error: 'Task aborted' };
    }

    const resultText = callResult.result.text?.trim();
    if (callResult.result.error || !resultText) {
      const errorMsg = `LLM call failed: ${callResult.result.error || 'No text returned'}`;
      updatedBatches[batchIndex] = { ...batch, status: 'failed', error: errorMsg };
      await updateRevisionRun(runId, { status: 'batch_reviewing', batches: updatedBatches });
      return { success: false, error: errorMsg };
    }

    // Parse LLM response
    let parsed: SummaryRevisionLLMResponse;
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object found');
      parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.patches)) throw new Error('Missing patches array');
      if (typeof parsed.batchReasoning !== 'string') parsed.batchReasoning = '';
    } catch (err) {
      const errorMsg = `Failed to parse LLM response: ${err instanceof Error ? err.message : String(err)}`;
      updatedBatches[batchIndex] = { ...batch, status: 'failed', error: errorMsg };
      await updateRevisionRun(runId, { status: 'batch_reviewing', batches: updatedBatches });
      return { success: false, error: errorMsg };
    }

    // Update batch with patches
    updatedBatches[batchIndex] = {
      ...batch,
      status: 'complete',
      patches: parsed.patches,
      inputTokens: callResult.usage.inputTokens,
      outputTokens: callResult.usage.outputTokens,
      actualCost: callResult.usage.actualCost,
    };

    // Check if all batches are complete
    const allComplete = updatedBatches.every(
      (b) => b.status === 'complete' || b.status === 'failed'
    );

    await updateRevisionRun(runId, {
      status: allComplete ? 'run_reviewing' : 'batch_reviewing',
      batches: updatedBatches,
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
      type: 'summaryRevision' as CostType,
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
    updatedBatches[batchIndex] = { ...batch, status: 'failed', error: errorMsg };
    await updateRevisionRun(runId, { status: 'batch_reviewing', batches: updatedBatches });
    return { success: false, error: `Summary revision failed: ${errorMsg}` };
  }
}

export const summaryRevisionTask = {
  type: 'summaryRevision' as const,
  execute: executeSummaryRevisionTask,
};
