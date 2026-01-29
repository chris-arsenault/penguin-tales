import type {
  WorkerTask,
} from '../../lib/enrichmentTypes';
import type {
  ChronicleGenerationContext,
  ChronicleImageRefs,
  ChronicleImageRef,
  EntityImageRef,
  PromptRequestRef,
  ChronicleImageSize,
} from '../../lib/chronicleTypes';
import { analyzeConstellation, type EntityConstellation } from '../../lib/constellationAnalyzer';
import {
  synthesizePerspective,
  type PerspectiveSynthesisResult,
} from '../../lib/perspectiveSynthesizer';
import type { PerspectiveSynthesisRecord } from '../../lib/chronicleTypes';
import {
  createChronicle,
  type ChronicleRecord,
  type ChronicleGenerationVersion,
  regenerateChronicleAssembly,
  updateChronicleSummary,
  updateChronicleImageRefs,
  updateChronicleFailure,
  getChronicle,
} from '../../lib/chronicleStorage';
import { saveCostRecordWithDefaults, type CostType } from '../../lib/costStorage';
import {
  selectEntitiesV2,
  buildV2Prompt,
  getMaxTokensFromStyle,
  getV2SystemPrompt,
  DEFAULT_V2_CONFIG,
} from '../../lib/chronicle/v2';
import type { NarrativeStyle } from '@canonry/world-schema';
import { runTextCall } from '../../lib/llmTextCall';
import { getCallConfig } from './llmCallConfig';
import { stripLeadingWrapper, parseJsonObject } from './textParsing';
import type { TaskHandler, TaskContext } from './taskTypes';
import type { TaskResult } from '../types';

// ============================================================================
// Chronicle Task Execution
// ============================================================================

async function markChronicleFailure(
  chronicleId: string,
  step: string,
  reason: string
): Promise<void> {
  await updateChronicleFailure(chronicleId, step, reason);
}

/**
 * Execute a SINGLE step of chronicle generation.
 * Each step pauses for user review before proceeding to the next.
 */
async function executeEntityChronicleTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: 'Text generation not configured - missing Anthropic API key' };
  }

  const step = task.chronicleStep || 'generate_v2';
  console.log(`[Worker] Chronicle step=${step} for entity=${task.entityId}`);

  // V2 single-shot generation - primary generation path
  if (step === 'generate_v2') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for generate_v2 step' };
    }
    return executeV2GenerationStep(task, context);
  }

  // For post-generation steps, we need the existing chronicle
  if (!task.chronicleId) {
    return { success: false, error: `chronicleId required for ${step} step` };
  }

  const chronicleRecord = await getChronicle(task.chronicleId);
  if (!chronicleRecord) {
    return { success: false, error: `Chronicle ${task.chronicleId} not found` };
  }

  if (step === 'regenerate_temperature') {
    return executeTemperatureRegenerationStep(task, chronicleRecord, context);
  }

  if (step === 'summary') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for summary step' };
    }
    return executeSummaryStep(task, chronicleRecord, context);
  }

  if (step === 'image_refs') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for image refs step' };
    }
    return executeImageRefsStep(task, chronicleRecord, context);
  }

  return { success: false, error: `Unknown step: ${step}` };
}

/**
 * Regenerate chronicle content with a temperature override (no perspective synthesis).
 * Reuses stored prompts from the previous generation.
 */
async function executeTemperatureRegenerationStep(
  task: WorkerTask,
  chronicleRecord: ChronicleRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for regeneration' };
  }

  if (chronicleRecord.status === 'complete' || chronicleRecord.finalContent) {
    return { success: false, error: 'Temperature regeneration is only available before acceptance' };
  }

  const systemPrompt = chronicleRecord.generationSystemPrompt;
  const userPrompt = chronicleRecord.generationUserPrompt;
  if (!systemPrompt || !userPrompt) {
    return { success: false, error: 'Stored prompts missing; cannot regenerate this chronicle' };
  }

  const callConfig = getCallConfig(config, 'chronicle.generation');
  const temperatureRaw = typeof task.chronicleTemperature === 'number'
    ? task.chronicleTemperature
    : (chronicleRecord.generationTemperature ?? chronicleRecord.narrativeStyle?.temperature ?? 0.85);
  const temperature = Math.min(1, Math.max(0, temperatureRaw));

  const styleMaxTokens = chronicleRecord.narrativeStyle
    ? getMaxTokensFromStyle(chronicleRecord.narrativeStyle)
    : undefined;

  const generationCall = await runTextCall({
    llmClient,
    callType: 'chronicle.generation',
    callConfig,
    systemPrompt,
    prompt: userPrompt,
    temperature,
    autoMaxTokens: styleMaxTokens,
  });

  const result = generationCall.result;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: result.debug };
  }

  if (result.error || !result.text) {
    return {
      success: false,
      error: `Temperature regeneration failed: ${result.error || 'No text returned'}`,
      debug: result.debug,
    };
  }

  try {
    await regenerateChronicleAssembly(chronicleRecord.chronicleId, {
      assembledContent: result.text,
      systemPrompt,
      userPrompt,
      model: callConfig.model,
      temperature,
      cost: {
        estimated: generationCall.estimate.estimatedCost,
        actual: generationCall.usage.actualCost,
        inputTokens: generationCall.usage.inputTokens,
        outputTokens: generationCall.usage.outputTokens,
      },
    });
  } catch (err) {
    return { success: false, error: `Failed to save regenerated chronicle: ${err}` };
  }

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId: chronicleRecord.chronicleId,
    type: 'chronicleV2',
    model: callConfig.model,
    estimatedCost: generationCall.estimate.estimatedCost,
    actualCost: generationCall.usage.actualCost,
    inputTokens: generationCall.usage.inputTokens,
    outputTokens: generationCall.usage.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId: chronicleRecord.chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: generationCall.estimate.estimatedCost,
      actualCost: generationCall.usage.actualCost,
      inputTokens: generationCall.usage.inputTokens,
      outputTokens: generationCall.usage.outputTokens,
    },
    debug: result.debug,
  };
}

/**
 * V2 Single-Shot Generation
 * One LLM call to generate the complete narrative, with deterministic post-processing.
 */
async function executeV2GenerationStep(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;
  let chronicleContext = task.chronicleContext!;
  const narrativeStyle = chronicleContext.narrativeStyle;

  if (!narrativeStyle) {
    return { success: false, error: 'Narrative style is required for V2 generation' };
  }

  if (!task.chronicleId) {
    return { success: false, error: 'chronicleId required for generate_v2 step' };
  }

  const callConfig = getCallConfig(config, 'chronicle.generation');
  const chronicleId = task.chronicleId;
  console.log(`[Worker] V2 generation for chronicle=${chronicleId}, style="${narrativeStyle.name}", model=${callConfig.model}`);

  // ==========================================================================
  // PERSPECTIVE SYNTHESIS (REQUIRED)
  // ==========================================================================
  // Perspective synthesis is the ONLY code path. It:
  // 1. Analyzes entity constellation (culture mix, kind focus, themes)
  // 2. LLM selects relevant facts and provides faceted interpretations
  // 3. Assembles tone from fragments based on constellation
  // 4. Builds the final tone (assembled + brief + motifs) and facts for generation
  // ==========================================================================
  if (!chronicleContext.toneFragments || !chronicleContext.canonFactsWithMetadata) {
    return {
      success: false,
      error: 'Perspective synthesis requires toneFragments and canonFactsWithMetadata. Configure world context with structured tone and facts.',
    };
  }

  let perspectiveResult: PerspectiveSynthesisResult;
  let perspectiveRecord: PerspectiveSynthesisRecord;
  let constellation: EntityConstellation;

  {
    console.log('[Worker] Running perspective synthesis...');
    const perspectiveConfig = getCallConfig(config, 'perspective.synthesis');

    // Analyze entity constellation
    constellation = analyzeConstellation({
      entities: chronicleContext.entities,
      relationships: chronicleContext.relationships,
      events: chronicleContext.events,
      focalEra: chronicleContext.era,
    });
    console.log(`[Worker] Constellation: ${constellation.focusSummary}`);

    try {
      perspectiveResult = await synthesizePerspective(
        {
          constellation,
          entities: chronicleContext.entities,
          focalEra: chronicleContext.era,
          factsWithMetadata: chronicleContext.canonFactsWithMetadata,
          toneFragments: chronicleContext.toneFragments,
          culturalIdentities: chronicleContext.culturalIdentities,
          narrativeStyle, // Pass narrative style to weight perspective
          proseHints: chronicleContext.proseHints, // Pass prose hints for entity directives
          worldDynamics: chronicleContext.worldDynamics, // Higher-level narrative context
        },
        llmClient,
        perspectiveConfig
      );

      // Build record for storage (includes both INPUT and OUTPUT for debugging)
      perspectiveRecord = {
        generatedAt: Date.now(),
        model: perspectiveConfig.model,

        // OUTPUT (LLM response)
        brief: perspectiveResult.synthesis.brief,
        facets: perspectiveResult.synthesis.facets,
        suggestedMotifs: perspectiveResult.synthesis.suggestedMotifs,
        narrativeVoice: perspectiveResult.synthesis.narrativeVoice,
        entityDirectives: perspectiveResult.synthesis.entityDirectives,

        // INPUT (what was sent to LLM)
        constellationSummary: constellation.focusSummary,
        constellation: {
          cultures: constellation.cultures,
          kinds: constellation.kinds,
          prominentTags: constellation.prominentTags,
          dominantCulture: constellation.dominantCulture,
          cultureBalance: constellation.cultureBalance,
          relationshipKinds: constellation.relationshipKinds,
        },
        coreTone: chronicleContext.toneFragments?.core,
        narrativeStyleId: narrativeStyle.id,
        narrativeStyleName: narrativeStyle.name,
        inputFacts: chronicleContext.canonFactsWithMetadata?.map((f) => ({
          id: f.id,
          text: f.text,
          type: f.type,
        })),
        inputCulturalIdentities: chronicleContext.culturalIdentities,
        inputEntities: chronicleContext.entities.slice(0, 15).map((e) => ({
          name: e.name,
          kind: e.kind,
          culture: e.culture,
          summary: e.summary,
        })),

        // Cost
        inputTokens: perspectiveResult.usage.inputTokens,
        outputTokens: perspectiveResult.usage.outputTokens,
        actualCost: perspectiveResult.usage.actualCost,
      };

      // Build perspective section with brief and motifs
      const motifSection = perspectiveResult.synthesis.suggestedMotifs.length > 0
        ? `\n\nSUGGESTED MOTIFS (phrases that might echo through this chronicle):\n${perspectiveResult.synthesis.suggestedMotifs.map(m => `- "${m}"`).join('\n')}`
        : '';

      // Update context with synthesized perspective
      chronicleContext = {
        ...chronicleContext,
        // Replace tone with assembled tone + perspective brief + motifs
        tone:
          perspectiveResult.assembledTone +
          '\n\nPERSPECTIVE FOR THIS CHRONICLE:\n' +
          perspectiveResult.synthesis.brief +
          motifSection,
        // Replace facts with faceted facts (core truths with interpretations + contextual)
        canonFacts: perspectiveResult.facetedFacts,
        // Add synthesized narrative voice and entity directives
        narrativeVoice: perspectiveResult.synthesis.narrativeVoice,
        entityDirectives: perspectiveResult.synthesis.entityDirectives,
      };

      console.log(`[Worker] Perspective synthesis complete: ${perspectiveResult.facetedFacts.length} faceted facts, ${perspectiveResult.synthesis.suggestedMotifs.length} motifs`);
    } catch (err) {
      // Per user requirement: if LLM fails, stop the process
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[Worker] Perspective synthesis failed:', errorMessage);
      return { success: false, error: `Perspective synthesis failed: ${errorMessage}` };
    }
  }

  // Simple entity/event selection from 2-hop neighborhood
  const selection = selectEntitiesV2(chronicleContext, DEFAULT_V2_CONFIG);
  console.log(`[Worker] V2 selected ${selection.entities.length} entities, ${selection.events.length} events, ${selection.relationships.length} relationships`);

  // Build single-shot prompt
  const prompt = buildV2Prompt(chronicleContext, narrativeStyle, selection);
  const styleMaxTokens = getMaxTokensFromStyle(narrativeStyle);
  const systemPrompt = getV2SystemPrompt(narrativeStyle);
  const baseTemperature = narrativeStyle.temperature ?? 0.85;
  const temperatureA = baseTemperature;
  const temperatureB = Math.min(1.0, baseTemperature + 0.2);

  // ==========================================================================
  // VERSION A — Base temperature
  // ==========================================================================
  console.log(`[Worker] Generating Version A at temperature ${temperatureA}...`);
  const genCallA = await runTextCall({
    llmClient,
    callType: 'chronicle.generation',
    callConfig,
    systemPrompt,
    prompt,
    temperature: temperatureA,
    autoMaxTokens: styleMaxTokens,
  });

  console.log(`[Worker] V2 prompt length: ${prompt.length} chars, maxTokens: ${genCallA.budget.totalMaxTokens}`);

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: genCallA.result.debug };
  }

  if (genCallA.result.error || !genCallA.result.text) {
    return {
      success: false,
      error: `V2 generation (Version A) failed: ${genCallA.result.error || 'No text returned'}`,
      debug: genCallA.result.debug,
    };
  }

  const versionAText = genCallA.result.text;

  // ==========================================================================
  // VERSION B — Higher temperature
  // ==========================================================================
  console.log(`[Worker] Generating Version B at temperature ${temperatureB}...`);
  const genCallB = await runTextCall({
    llmClient,
    callType: 'chronicle.generation',
    callConfig,
    systemPrompt,
    prompt,
    temperature: temperatureB,
    autoMaxTokens: styleMaxTokens,
  });

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: genCallB.result.debug };
  }

  if (genCallB.result.error || !genCallB.result.text) {
    return {
      success: false,
      error: `V2 generation (Version B) failed: ${genCallB.result.error || 'No text returned'}`,
      debug: genCallB.result.debug,
    };
  }

  const versionBText = genCallB.result.text;

  // ==========================================================================
  // COMBINE — Best elements of both versions
  // ==========================================================================
  console.log('[Worker] Combining versions A and B...');
  const combineConfig = getCallConfig(config, 'chronicle.combine');
  const combineResult = await executeCombineStep(
    versionAText,
    versionBText,
    systemPrompt,
    narrativeStyle,
    llmClient,
    combineConfig,
  );

  if (isAborted()) {
    return { success: false, error: 'Task aborted' };
  }

  if (!combineResult.success || !combineResult.text) {
    // If combine fails, fall back to Version A
    console.warn(`[Worker] Combine failed (${combineResult.error}), falling back to Version A`);
  }

  const finalText = combineResult.text || versionAText;

  // Note: Wikilinks are NOT applied here - they are applied once at acceptance time
  // (in useChronicleGeneration.ts acceptChronicle) to avoid double-bracketing issues.

  // Build generation history: store both source versions
  const now = Date.now();
  const generationHistory: ChronicleGenerationVersion[] = [
    {
      versionId: `versionA_${now}`,
      generatedAt: now,
      content: versionAText,
      wordCount: versionAText.split(/\s+/).length,
      model: callConfig.model,
      temperature: temperatureA,
      systemPrompt,
      userPrompt: prompt,
      cost: {
        estimated: genCallA.estimate.estimatedCost,
        actual: genCallA.usage.actualCost,
        inputTokens: genCallA.usage.inputTokens,
        outputTokens: genCallA.usage.outputTokens,
      },
    },
    {
      versionId: `versionB_${now}`,
      generatedAt: now,
      content: versionBText,
      wordCount: versionBText.split(/\s+/).length,
      model: callConfig.model,
      temperature: temperatureB,
      systemPrompt,
      userPrompt: prompt,
      cost: {
        estimated: genCallB.estimate.estimatedCost,
        actual: genCallB.usage.actualCost,
        inputTokens: genCallB.usage.inputTokens,
        outputTokens: genCallB.usage.outputTokens,
      },
    },
  ];

  // Calculate total cost (perspective + both generations + combine)
  const combineCostActual = combineResult.usage?.actualCost ?? 0;
  const combineCostEstimated = combineResult.usage?.estimatedCost ?? 0;
  const combineCostInput = combineResult.usage?.inputTokens ?? 0;
  const combineCostOutput = combineResult.usage?.outputTokens ?? 0;

  const cost = {
    estimated:
      perspectiveResult.usage.actualCost +
      genCallA.estimate.estimatedCost +
      genCallB.estimate.estimatedCost +
      combineCostEstimated,
    actual:
      perspectiveResult.usage.actualCost +
      genCallA.usage.actualCost +
      genCallB.usage.actualCost +
      combineCostActual,
    inputTokens:
      perspectiveResult.usage.inputTokens +
      genCallA.usage.inputTokens +
      genCallB.usage.inputTokens +
      combineCostInput,
    outputTokens:
      perspectiveResult.usage.outputTokens +
      genCallA.usage.outputTokens +
      genCallB.usage.outputTokens +
      combineCostOutput,
  };

  // Save chronicle to assembled state
  try {
    const focus = chronicleContext.focus;
    const existingChronicle = await getChronicle(chronicleId);
    const roleAssignments = existingChronicle?.roleAssignments ?? focus?.roleAssignments ?? [];
    const selectedEntityIds = existingChronicle?.selectedEntityIds ?? focus?.selectedEntityIds ?? [];
    const selectedEventIds = existingChronicle?.selectedEventIds ?? focus?.selectedEventIds ?? [];
    const selectedRelationshipIds = existingChronicle?.selectedRelationshipIds ?? focus?.selectedRelationshipIds ?? [];
    const temporalContext = chronicleContext.temporalContext ?? existingChronicle?.temporalContext;

    await createChronicle(chronicleId, {
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      model: combineConfig.model,
      title: existingChronicle?.title,
      format: existingChronicle?.format || narrativeStyle.format,
      narrativeStyleId: existingChronicle?.narrativeStyleId || narrativeStyle.id,
      narrativeStyle: existingChronicle?.narrativeStyle || narrativeStyle,
      roleAssignments,
      selectedEntityIds,
      selectedEventIds,
      selectedRelationshipIds,
      entrypointId: existingChronicle?.entrypointId,
      temporalContext,
      assembledContent: finalText,
      generationHistory,
      generationSystemPrompt: systemPrompt,
      generationUserPrompt: prompt,
      generationTemperature: baseTemperature,
      generationContext: {
        worldName: chronicleContext.worldName,
        worldDescription: chronicleContext.worldDescription,
        tone: chronicleContext.tone,
        canonFacts: chronicleContext.canonFacts,
        nameBank: chronicleContext.nameBank,
        narrativeVoice: chronicleContext.narrativeVoice,
        entityDirectives: chronicleContext.entityDirectives,
      },
      selectionSummary: {
        entityCount: selection.entities.length,
        eventCount: selection.events.length,
        relationshipCount: selection.relationships.length,
      },
      perspectiveSynthesis: perspectiveRecord,
      cost,
    });
    console.log(`[Worker] Chronicle saved: ${chronicleId} (combined from T=${temperatureA} + T=${temperatureB})`);
  } catch (err) {
    return { success: false, error: `Failed to save chronicle: ${err}` };
  }

  // Record perspective synthesis cost
  const perspectiveConfig = getCallConfig(config, 'perspective.synthesis');
  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chroniclePerspective',
    model: perspectiveConfig.model,
    estimatedCost: perspectiveResult.usage.actualCost,
    actualCost: perspectiveResult.usage.actualCost,
    inputTokens: perspectiveResult.usage.inputTokens,
    outputTokens: perspectiveResult.usage.outputTokens,
  });

  // Record generation cost (both versions)
  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleV2',
    model: callConfig.model,
    estimatedCost: genCallA.estimate.estimatedCost + genCallB.estimate.estimatedCost,
    actualCost: genCallA.usage.actualCost + genCallB.usage.actualCost,
    inputTokens: genCallA.usage.inputTokens + genCallB.usage.inputTokens,
    outputTokens: genCallA.usage.outputTokens + genCallB.usage.outputTokens,
  });

  // Record combine cost
  if (combineCostActual > 0) {
    await saveCostRecordWithDefaults({
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      entityId: task.entityId,
      entityName: task.entityName,
      entityKind: task.entityKind,
      chronicleId,
      type: 'chronicleV2',
      model: combineConfig.model,
      estimatedCost: combineCostEstimated,
      actualCost: combineCostActual,
      inputTokens: combineCostInput,
      outputTokens: combineCostOutput,
    });
  }

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model: combineConfig.model,
      estimatedCost: cost.estimated,
      actualCost: cost.actual,
      inputTokens: cost.inputTokens,
      outputTokens: cost.outputTokens,
    },
    debug: genCallA.result.debug,
  };
}

// ============================================================================
// Compare + Combine Step
// ============================================================================

const COMBINE_SYSTEM_PROMPT = `You are a narrative editor combining two versions of the same chronicle into a single final version. Both versions follow the same prompt, style, and narrative structure — they differ in temperature (creative latitude).

Your job is NOT to merge or average. Your job is to CHOOSE and REWRITE: take the stronger elements from each version and produce one polished chronicle.

## Selection Criteria

Prefer whichever version has:
- **Richer world-building details** — invented names, places, customs that feel grounded
- **More surprising structural choices** — non-obvious scene ordering, interesting POV decisions
- **More natural prose** — sentences that flow without feeling templated
- **Better adherence to the narrative voice and entity directives**
- **Stronger emotional range** — not every beat should feel the same

If Version A has a better opening and Version B has a better middle, use each. If both handle the same beat differently, pick the one that reads more naturally.

## Output Rules
- Output ONLY the final chronicle text
- No commentary, no labels, no "Here is the combined version"
- Maintain the target word count of the originals
- Preserve all entity names, facts, and relationships exactly as they appear`;

interface CombineStepResult {
  success: boolean;
  text?: string;
  error?: string;
  usage?: {
    estimatedCost: number;
    actualCost: number;
    inputTokens: number;
    outputTokens: number;
  };
}

async function executeCombineStep(
  versionAText: string,
  versionBText: string,
  originalSystemPrompt: string,
  narrativeStyle: NarrativeStyle,
  llmClient: { isEnabled: () => boolean } & Record<string, unknown>,
  combineCallConfig: ReturnType<typeof getCallConfig>,
): Promise<CombineStepResult> {
  const combinePrompt = `## Original Generation Prompt Context
The following system prompt was used to generate both versions:

${originalSystemPrompt}

Style: ${narrativeStyle.name} (${narrativeStyle.format})

---

## VERSION A (lower temperature — more controlled)

${versionAText}

---

## VERSION B (higher temperature — more creative)

${versionBText}

---

## YOUR TASK

Produce the final chronicle by selecting the strongest elements from each version. Output only the chronicle text.`;

  try {
    const combineCall = await runTextCall({
      llmClient,
      callType: 'chronicle.combine',
      callConfig: combineCallConfig,
      systemPrompt: COMBINE_SYSTEM_PROMPT,
      prompt: combinePrompt,
      temperature: 0.4,
    });

    if (combineCall.result.error || !combineCall.result.text) {
      return {
        success: false,
        error: combineCall.result.error || 'No text returned from combine step',
      };
    }

    return {
      success: true,
      text: combineCall.result.text,
      usage: {
        estimatedCost: combineCall.estimate.estimatedCost,
        actualCost: combineCall.usage.actualCost,
        inputTokens: combineCall.usage.inputTokens,
        outputTokens: combineCall.usage.outputTokens,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `Combine step failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}


function buildSummaryPrompt(content: string): string {
  return `Generate a title and summary for the chronicle below.

Rules:
- Title: A compelling, evocative title (3-8 words) that captures the essence of the chronicle
- Do NOT start the title with "The". Open with a name, action, image, or phrase instead.
- Summary: 2-4 sentences summarizing the key events and outcome
- Keep both factual and faithful to the chronicle
- Mention key entities in the summary

Chronicle:
${content}

Return ONLY valid JSON in this exact format:
{"title": "...", "summary": "..."}`;
}

function formatImageRefEntities(chronicleContext: ChronicleGenerationContext): string {
  if (chronicleContext.entities.length === 0) return '(none)';

  return chronicleContext.entities
    .map((entity) => `- ${entity.id}: ${entity.name} (${entity.kind})`)
    .join('\n');
}

/**
 * Split content into roughly equal chunks for distributed image placement.
 * Splits at whitespace boundaries to avoid cutting words.
 * Returns 3-7 chunks, weighted by content length (longer = more chunks).
 */
function splitIntoChunks(content: string): Array<{ index: number; text: string; startOffset: number }> {
  // Estimate word count for chunk calculation
  const wordCount = content.split(/\s+/).length;

  // Calculate chunk count: 3-7, weighted by length
  // Under 500 words: 3 chunks, 500-1000: 4, 1000-2000: 5, 2000-3000: 6, 3000+: 7
  let baseChunkCount: number;
  if (wordCount < 500) baseChunkCount = 3;
  else if (wordCount < 1000) baseChunkCount = 4;
  else if (wordCount < 2000) baseChunkCount = 5;
  else if (wordCount < 3000) baseChunkCount = 6;
  else baseChunkCount = 7;

  // Add slight randomness: +/-1 chunk
  const randomOffset = Math.random() < 0.3 ? -1 : (Math.random() > 0.7 ? 1 : 0);
  const chunkCount = Math.max(3, Math.min(7, baseChunkCount + randomOffset));

  const targetChunkSize = Math.ceil(content.length / chunkCount);
  const chunks: Array<{ index: number; text: string; startOffset: number }> = [];

  let currentStart = 0;
  for (let i = 0; i < chunkCount; i++) {
    const targetEnd = Math.min(currentStart + targetChunkSize, content.length);

    // Find next whitespace after target end (don't cut words)
    let actualEnd = targetEnd;
    if (targetEnd < content.length) {
      // Look for whitespace within 50 chars after target
      const searchEnd = Math.min(targetEnd + 50, content.length);
      for (let j = targetEnd; j < searchEnd; j++) {
        if (/\s/.test(content[j])) {
          actualEnd = j;
          break;
        }
      }
      // If no whitespace found, use target (rare edge case)
      if (actualEnd === targetEnd && targetEnd < content.length) {
        actualEnd = targetEnd;
      }
    }

    chunks.push({
      index: i,
      text: content.substring(currentStart, actualEnd),
      startOffset: currentStart,
    });

    currentStart = actualEnd;

    // Skip leading whitespace for next chunk
    while (currentStart < content.length && /\s/.test(content[currentStart])) {
      currentStart++;
    }

    // If we've consumed all content, stop
    if (currentStart >= content.length) break;
  }

  return chunks;
}

function buildImageRefsPrompt(
  content: string,
  chronicleContext: ChronicleGenerationContext
): string {
  const entityList = formatImageRefEntities(chronicleContext);
  const chunks = splitIntoChunks(content);

  // Build chunk display with markers (full text, no truncation)
  const chunksDisplay = chunks.map((chunk, i) => {
    return `### CHUNK ${i + 1} of ${chunks.length}
${chunk.text}
---`;
  }).join('\n\n');

  return `You are adding image references to a chronicle. Your task is to identify optimal placement points for images that enhance the narrative.

## Available Entities
${entityList}

## Instructions
The chronicle has been divided into ${chunks.length} chunks. For EACH chunk, decide whether it deserves an image (0 or 1 per chunk). This ensures images are distributed throughout the narrative.

For each image, choose one type:

1. **Entity Reference** (type: "entity_ref") - Use when a specific entity is prominently featured
   - Best for: Introductions, key moments focused on a single entity

2. **Prompt Request** (type: "prompt_request") - Use for scenes involving multiple entities or environments
   - Best for: Multi-entity scenes, locations, action moments, atmospheric shots
   - REQUIRED: Include involvedEntityIds with at least one entity that appears in the scene

## Output Format
Return a JSON object. For each image placement, provide an entry with anchorText from the relevant chunk:
{
  "imageRefs": [
    {
      "type": "entity_ref",
      "entityId": "<entity id from list above>",
      "anchorText": "<exact 5-15 word phrase from the chronicle>",
      "size": "small|medium|large|full-width",
      "caption": "<optional>"
    },
    {
      "type": "prompt_request",
      "sceneDescription": "<vivid 1-2 sentence scene description>",
      "involvedEntityIds": ["<entity-id-1>", "<entity-id-2>"],
      "anchorText": "<exact 5-15 word phrase from the chronicle>",
      "size": "small|medium|large|full-width",
      "caption": "<optional>"
    }
  ]
}

## Size Guidelines
- small: 150px, supplementary/margin images
- medium: 300px, standard single-entity images
- large: 450px, key scenes
- full-width: 100%, establishing shots

## Rules
- Suggest 0 or 1 image per chunk (total 2-5 images for the whole chronicle)
- anchorText MUST be an exact phrase from that chunk's text
- entityId and involvedEntityIds MUST use IDs from the Available Entities list
- For prompt_request, involvedEntityIds MUST contain at least one entity ID
- Return valid JSON only, no markdown

## Chronicle Chunks
${chunksDisplay}`;
}

/**
 * Parse the LLM response for image refs into structured ChronicleImageRef array
 */
function parseImageRefsResponse(text: string): ChronicleImageRef[] {
  const parsed = parseJsonObject<Record<string, unknown>>(text, 'image refs response');
  const rawRefs = parsed.imageRefs;

  if (!rawRefs || !Array.isArray(rawRefs)) {
    throw new Error('imageRefs array not found in response');
  }

  const validSizes: ChronicleImageSize[] = ['small', 'medium', 'large', 'full-width'];

  return rawRefs.map((ref: Record<string, unknown>, index: number) => {
    const refId = `imgref_${Date.now()}_${index}`;
    const anchorText = typeof ref.anchorText === 'string' ? ref.anchorText : '';
    const rawSize = typeof ref.size === 'string' ? ref.size : 'medium';
    const size: ChronicleImageSize = validSizes.includes(rawSize as ChronicleImageSize)
      ? (rawSize as ChronicleImageSize)
      : 'medium';
    const caption = typeof ref.caption === 'string' ? ref.caption : undefined;

    if (ref.type === 'entity_ref') {
      const entityId = typeof ref.entityId === 'string' ? ref.entityId : '';
      if (!entityId) {
        throw new Error(`entity_ref at index ${index} missing entityId`);
      }
      return {
        refId,
        type: 'entity_ref',
        entityId,
        anchorText,
        size,
        caption,
      } as EntityImageRef;
    } else if (ref.type === 'prompt_request') {
      const sceneDescription = typeof ref.sceneDescription === 'string' ? ref.sceneDescription : '';
      if (!sceneDescription) {
        throw new Error(`prompt_request at index ${index} missing sceneDescription`);
      }
      // Parse involvedEntityIds - can be array of strings or empty
      let involvedEntityIds: string[] | undefined;
      if (Array.isArray(ref.involvedEntityIds)) {
        involvedEntityIds = ref.involvedEntityIds
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
        if (involvedEntityIds.length === 0) {
          involvedEntityIds = undefined;
        }
      }
      return {
        refId,
        type: 'prompt_request',
        sceneDescription,
        involvedEntityIds,
        anchorText,
        size,
        caption,
        status: 'pending',
      } as PromptRequestRef;
    } else {
      throw new Error(`Unknown image ref type at index ${index}: ${ref.type}`);
    }
  });
}

async function executeSummaryStep(
  task: WorkerTask,
  chronicleRecord: Awaited<ReturnType<typeof getChronicle>>,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for summary' };
  }
  if (!chronicleRecord.assembledContent) {
    return { success: false, error: 'Chronicle has no assembled content to summarize' };
  }

  const callConfig = getCallConfig(config, 'chronicle.summary');
  const chronicleId = chronicleRecord.chronicleId;
  const summaryPrompt = buildSummaryPrompt(chronicleRecord.assembledContent);
  const summaryCall = await runTextCall({
    llmClient,
    callType: 'chronicle.summary',
    callConfig,
    systemPrompt: 'You are a careful editor who writes concise, faithful summaries. Always respond with valid JSON.',
    prompt: summaryPrompt,
    temperature: 0.3,
  });
  const summaryResult = summaryCall.result;
  const debug = summaryResult.debug;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug };
  }

  if (summaryResult.error || !summaryResult.text) {
    return { success: false, error: `Summary failed: ${summaryResult.error || 'Empty response'}`, debug };
  }

  // Parse JSON response for title and summary
  let title: string | undefined;
  let summaryText: string;

  try {
    const parsed = parseJsonObject<Record<string, unknown>>(summaryResult.text, 'summary response');
    title = typeof parsed.title === 'string' ? parsed.title.trim() : undefined;
    summaryText = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    if (!summaryText) {
      return { success: false, error: 'Summary response missing summary field', debug };
    }
  } catch {
    // Fallback: treat entire response as summary (backwards compat)
    summaryText = stripLeadingWrapper(summaryResult.text).replace(/\s+/g, ' ').trim();
    if (!summaryText) {
      return { success: false, error: 'Summary response empty', debug };
    }
  }

  const summaryCost = {
    estimated: summaryCall.estimate.estimatedCost,
    actual: summaryCall.usage.actualCost,
    inputTokens: summaryCall.usage.inputTokens,
    outputTokens: summaryCall.usage.outputTokens,
  };

  await updateChronicleSummary(chronicleId, summaryText, summaryCost, callConfig.model, title);

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleSummary' as CostType,
    model: callConfig.model,
    estimatedCost: summaryCost.estimated,
    actualCost: summaryCost.actual,
    inputTokens: summaryCost.inputTokens,
    outputTokens: summaryCost.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: summaryCost.estimated,
      actualCost: summaryCost.actual,
      inputTokens: summaryCost.inputTokens,
      outputTokens: summaryCost.outputTokens,
    },
    debug,
  };
}

async function executeImageRefsStep(
  task: WorkerTask,
  chronicleRecord: Awaited<ReturnType<typeof getChronicle>>,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for image refs' };
  }
  if (!chronicleRecord.assembledContent) {
    return { success: false, error: 'Chronicle has no assembled content for image refs' };
  }

  const callConfig = getCallConfig(config, 'chronicle.imageRefs');
  const chronicleId = chronicleRecord.chronicleId;
  const chronicleContext = task.chronicleContext!;
  const imageRefsPrompt = buildImageRefsPrompt(chronicleRecord.assembledContent, chronicleContext);
  const imageRefsCall = await runTextCall({
    llmClient,
    callType: 'chronicle.imageRefs',
    callConfig,
    systemPrompt: 'You are planning draft image placements for a chronicle.',
    prompt: imageRefsPrompt,
    temperature: 0.4,
  });
  const imageRefsResult = imageRefsCall.result;
  const debug = imageRefsResult.debug;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug };
  }

  if (imageRefsResult.error || !imageRefsResult.text) {
    return { success: false, error: `Image refs failed: ${imageRefsResult.error || 'Empty response'}`, debug };
  }

  // Parse the response into structured image refs
  let parsedRefs: ChronicleImageRef[];
  try {
    parsedRefs = parseImageRefsResponse(imageRefsResult.text);
  } catch (e) {
    return {
      success: false,
      error: `Failed to parse image refs: ${e instanceof Error ? e.message : 'Unknown error'}`,
      debug,
    };
  }

  if (parsedRefs.length === 0) {
    return { success: false, error: 'No image refs found in response', debug };
  }

  // Calculate anchorIndex for each ref based on position in assembled content
  const assembledContent = chronicleRecord.assembledContent;
  for (const ref of parsedRefs) {
    if (ref.anchorText) {
      const anchorLower = ref.anchorText.toLowerCase();
      const contentLower = assembledContent.toLowerCase();
      const index = contentLower.indexOf(anchorLower);
      if (index >= 0) {
        ref.anchorIndex = index;
      }
    }
  }

  // Create structured ChronicleImageRefs object
  const imageRefs: ChronicleImageRefs = {
    refs: parsedRefs,
    generatedAt: Date.now(),
    model: callConfig.model,
  };

  const imageRefsCost = {
    estimated: imageRefsCall.estimate.estimatedCost,
    actual: imageRefsCall.usage.actualCost,
    inputTokens: imageRefsCall.usage.inputTokens,
    outputTokens: imageRefsCall.usage.outputTokens,
  };

  await updateChronicleImageRefs(chronicleId, imageRefs, imageRefsCost, callConfig.model);

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleImageRefs' as CostType,
    model: callConfig.model,
    estimatedCost: imageRefsCost.estimated,
    actualCost: imageRefsCost.actual,
    inputTokens: imageRefsCost.inputTokens,
    outputTokens: imageRefsCost.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: imageRefsCost.estimated,
      actualCost: imageRefsCost.actual,
      inputTokens: imageRefsCost.inputTokens,
      outputTokens: imageRefsCost.outputTokens,
    },
    debug,
  };
}

export const chronicleTask = {
  type: 'entityChronicle',
  execute: executeEntityChronicleTask,
} satisfies TaskHandler<WorkerTask & { type: 'entityChronicle' }>;
