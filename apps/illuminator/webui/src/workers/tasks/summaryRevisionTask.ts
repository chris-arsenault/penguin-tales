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

const SYSTEM_PROMPT = `You are a revision editor for a procedural fantasy world generation system. You receive batches of entity summaries and descriptions and revise them to integrate world dynamics, improve narrative diversity, and strengthen coherence.

## Your Role

These entities were originally written one at a time with only their relationships and tags as context. They lack awareness of the world's macro-level forces, lore, and inter-group dynamics. Your job is to weave that awareness in — not by rewriting from scratch, but by substantively revising the text to reflect the world these entities exist in.

This is not copy-editing. Expect to revise most entities in each batch. A good revision integrates world dynamics by name, replaces generic tensions with specific ones, and connects isolated descriptions to the larger narrative.

## What You Receive

1. WORLD DYNAMICS: Era-aware world facts — the active forces, tensions, and alliances operating in this world. These should appear in your revisions where relevant.
2. LORE BIBLE: Static pages of canonical world lore
3. SCHEMA: Entity kinds and relationship kinds
4. BATCH ENTITIES: A group of entities from the same culture, each with current summary, description, visual thesis, and relationships

## Revision Guidelines

### CRITICAL: Visual Thesis Preservation
Each entity has a visual thesis used for image generation. Your revisions MUST NOT contradict it. If the thesis says "a scarred penguin clutching a cracked shield," keep references to scarring and the shield.

### What to Revise

**1. Integrate world dynamics**
The primary goal. Entities should reflect the forces operating in their world. If a dynamic says "The Flipper Accord binds colonies in mutual dependency," then trade-related entities should reference the Accord by name. If "Wake-Singers continue ritual activity at The Corpse Current," then nearby entities should acknowledge this threat. Thread specific dynamics into summaries and descriptions where the entity would plausibly be affected.

**2. Fix motif repetition within the batch**
If multiple entities use the same phrase or metaphor, revise all but the one where it fits best:
- "the ice remembers" — replace with entity-specific evidence (tool-marks, mineral strata, burn-scars, archival records)
- "something vast/ancient" — name what it is (the dead god, corruption, a geological formation)
- "no one remembers/knows" — give specific cultural reasoning ("records sealed after the Schism")
- "carries the weight of" / "haunted by" / "bears the scars of" — replace with observed behavior or visual evidence
- "learned to [verb]" — use culture-specific adaptation language
- "refuses to discuss" — add observable behavior that reveals what silence conceals

**3. Replace vagueness with specificity**
Replace generic tension descriptions with named entities, factions, locations, and events from the world dynamics and lore.

**4. Vary emotional register**
Not every entity should feel anxious, wounded, or haunted. Use the full range: pragmatic, ambitious, curious, resigned, defiant, indifferent, obsessive.

**5. Strengthen culture-specific voice**
- Aurora Stack: astronomical/measurement metaphors, political accountability, aurora-light sensory details
- Nightshelf: guild/transaction language, fire-core mechanics, tunnel/depth imagery
- Orca: predatory/sensory language, whale-song, pressure-depth, alien perspective

### Constraints
- Preserve the entity's fundamental identity, role, and status
- Do not contradict the visual thesis
- Do not add information unsupported by relationships or world context
- Do not add poetic flourishes beyond what exists
- If an entity genuinely needs no changes, omit it — but this should be rare given these were written without dynamics context

## Output Format

Output ONLY valid JSON:
{
  "patches": [
    {
      "entityId": "entity_id_here",
      "entityName": "Entity Name",
      "entityKind": "npc",
      "summary": "Full revised summary text (omit field if no change)",
      "description": "Full revised description text (omit field if no change)"
    }
  ]
}

Rules:
- Include most entities — these descriptions were written without world dynamics and need integration.
- For each entity, only include fields that changed. Omit unchanged fields.
- Output the complete revised text for each changed field, not a diff.`;

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
Revise the ${entities.length} entities above from the "${culture}" culture. These were written without world dynamics or lore context — integrate that context now.

For each entity, ask: does this description reflect the world forces (dynamics) that would shape this entity? If not, revise it. Also fix motif repetition across the batch and replace vagueness with specificity.

Expect to revise most entities. Preserve visual thesis. Output complete revised text for changed fields.`);

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
