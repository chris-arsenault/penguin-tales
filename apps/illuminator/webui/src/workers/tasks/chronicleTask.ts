import type {
  WorkerTask,
  NetworkDebugInfo,
} from '../../lib/enrichmentTypes';
import type {
  ChronicleGenerationContext,
  CohesionReport,
  ChronicleImageRefs,
  ChronicleImageRef,
  EntityImageRef,
  PromptRequestRef,
  ChronicleImageSize,
} from '../../lib/chronicleTypes';
import { analyzeConstellation } from '../../lib/constellationAnalyzer';
import {
  synthesizePerspective,
  type PerspectiveSynthesisResult,
} from '../../lib/perspectiveSynthesizer';
import {
  createChronicle,
  updateChronicleCohesion,
  updateChronicleEdit,
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
import type {
  NarrativeStyle,
  StoryNarrativeStyle,
  DocumentNarrativeStyle,
} from '@canonry/world-schema';
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

  if (step === 'edit') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for edit step' };
    }
    return executeEditStep(task, chronicleRecord, context);
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

  if (step === 'validate') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for validate step' };
    }
    return executeValidateStep(task, chronicleRecord, context);
  }

  return { success: false, error: `Unknown step: ${step}` };
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

  // Perspective synthesis: if toneFragments and canonFactsWithMetadata are present,
  // synthesize a focused perspective for this chronicle
  let perspectiveResult: PerspectiveSynthesisResult | undefined;
  if (chronicleContext.toneFragments && chronicleContext.canonFactsWithMetadata) {
    console.log('[Worker] Running perspective synthesis...');
    const perspectiveConfig = getCallConfig(config, 'perspective.synthesis');

    // Analyze entity constellation
    const constellation = analyzeConstellation({
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
        },
        llmClient,
        perspectiveConfig
      );

      // Update context with synthesized perspective
      chronicleContext = {
        ...chronicleContext,
        // Replace tone with assembled tone + perspective brief
        tone: perspectiveResult.assembledTone + '\n\nPERSPECTIVE FOR THIS CHRONICLE:\n' + perspectiveResult.synthesis.brief,
        // Replace facts with faceted facts (core truths with interpretations + contextual)
        canonFacts: perspectiveResult.facetedFacts,
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
  const generationCall = await runTextCall({
    llmClient,
    callType: 'chronicle.generation',
    callConfig,
    systemPrompt,
    prompt,
    temperature: 0.7,
    autoMaxTokens: styleMaxTokens,
  });
  const result = generationCall.result;

  console.log(`[Worker] V2 prompt length: ${prompt.length} chars, maxTokens: ${generationCall.budget.totalMaxTokens}`);

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: result.debug };
  }

  if (result.error || !result.text) {
    return {
      success: false,
      error: `V2 generation failed: ${result.error || 'No text returned'}`,
      debug: result.debug,
    };
  }

  // Note: Wikilinks are NOT applied here - they are applied once at acceptance time
  // (in useChronicleGeneration.ts acceptChronicle) to avoid double-bracketing issues.

  // Calculate cost (include perspective synthesis if performed)
  const perspectiveCost = perspectiveResult?.usage || { inputTokens: 0, outputTokens: 0, actualCost: 0 };
  const cost = {
    estimated: generationCall.estimate.estimatedCost + (perspectiveResult ? perspectiveCost.actualCost : 0),
    actual: generationCall.usage.actualCost + perspectiveCost.actualCost,
    inputTokens: generationCall.usage.inputTokens + perspectiveCost.inputTokens,
    outputTokens: generationCall.usage.outputTokens + perspectiveCost.outputTokens,
  };

  // Save chronicle directly to assembled state (single-shot generation)
  try {
    const focus = chronicleContext.focus;
    const existingChronicle = await getChronicle(chronicleId);
    const roleAssignments = existingChronicle?.roleAssignments ?? focus?.roleAssignments ?? [];
    const selectedEntityIds = existingChronicle?.selectedEntityIds ?? focus?.selectedEntityIds ?? [];
    const selectedEventIds = existingChronicle?.selectedEventIds ?? focus?.selectedEventIds ?? [];
    const selectedRelationshipIds = existingChronicle?.selectedRelationshipIds ?? focus?.selectedRelationshipIds ?? [];
    // Prefer the context used to build the prompt so stored focal era matches generation.
    const temporalContext = chronicleContext.temporalContext ?? existingChronicle?.temporalContext;

    await createChronicle(chronicleId, {
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      model: callConfig.model,
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
      assembledContent: result.text,
      selectionSummary: {
        entityCount: selection.entities.length,
        eventCount: selection.events.length,
        relationshipCount: selection.relationships.length,
      },
      cost,
    });
    console.log(`[Worker] Chronicle saved: ${chronicleId}`);
  } catch (err) {
    return { success: false, error: `Failed to save chronicle: ${err}` };
  }

  // Record perspective synthesis cost if performed
  if (perspectiveResult) {
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
  }

  // Record generation cost
  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
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
      chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: cost.estimated,
      actualCost: cost.actual,
      inputTokens: cost.inputTokens,
      outputTokens: cost.outputTokens,
    },
    debug: result.debug,
  };
}

/**
 * Edit chronicle based on validation suggestions, then re-validate
 */
async function executeEditStep(
  task: WorkerTask,
  chronicleRecord: Awaited<ReturnType<typeof getChronicle>>,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for editing' };
  }

  const chronicleId = chronicleRecord.chronicleId;
  const failEdit = async (message: string, debug?: NetworkDebugInfo): Promise<TaskResult> => {
    await markChronicleFailure(chronicleId, 'edit', message);
    return { success: false, error: message, debug };
  };

  if (!chronicleRecord.assembledContent) {
    return failEdit('Chronicle has no assembled content to edit');
  }
  if (!chronicleRecord.cohesionReport) {
    return failEdit('Chronicle has no validation report to edit against');
  }

  const callConfig = getCallConfig(config, 'chronicle.edit');
  console.log(`[Worker] Editing chronicle based on validation feedback, model=${callConfig.model}...`);

  // Build edit prompt from validation issues
  const issues = chronicleRecord.cohesionReport.issues || [];
  const issueList = issues
    .map((issue, i) => `${i + 1}. [${issue.severity}] ${issue.description}\n   Suggestion: ${issue.suggestion}`)
    .join('\n\n');

  const editPrompt = `Revise the chronicle below based on the validation feedback.

## Validation Issues
${issueList || 'No specific issues identified.'}

## Original Chronicle
${chronicleRecord.assembledContent}

## Instructions
1. Address each issue while preserving the overall narrative flow
2. Maintain entity names, facts, and relationships accurately
3. Return ONLY the revised chronicle text, no explanations`;

  const editCall = await runTextCall({
    llmClient,
    callType: 'chronicle.edit',
    callConfig,
    systemPrompt: 'You are a narrative editor. Revise the chronicle to address the validation feedback while maintaining quality and consistency.',
    prompt: editPrompt,
    temperature: 0.3,
  });
  const editResult = editCall.result;
  const debug = editResult.debug;

  if (isAborted()) {
    return failEdit('Task aborted', debug);
  }

  if (editResult.error || !editResult.text) {
    return failEdit(`Edit failed: ${editResult.error || 'Empty response'}`, debug);
  }

  const editCost = {
    estimated: editCall.estimate.estimatedCost,
    actual: editCall.usage.actualCost,
    inputTokens: editCall.usage.inputTokens,
    outputTokens: editCall.usage.outputTokens,
  };

  const cleanedContent = stripLeadingWrapper(editResult.text);

  await updateChronicleEdit(chronicleId, cleanedContent, editCost);

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleRevision',
    model: callConfig.model,
    estimatedCost: editCost.estimated,
    actualCost: editCost.actual,
    inputTokens: editCost.inputTokens,
    outputTokens: editCost.outputTokens,
  });

  if (isAborted()) {
    return failEdit('Task aborted', debug);
  }

  const updatedChronicleRecord = {
    ...chronicleRecord,
    assembledContent: cleanedContent,
  };

  const validationResult = await executeValidateStep(
    task,
    updatedChronicleRecord,
    context
  );

  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error || 'Validation failed after edit',
      debug: validationResult.debug || debug,
    };
  }

  return {
    success: true,
    result: validationResult.result,
    debug: validationResult.debug || debug,
  };
}

/**
 * Build V2 validation prompt (simpler, no plan required)
 */
function buildV2ValidationPrompt(
  content: string,
  chronicleContext: ChronicleGenerationContext,
  style: NarrativeStyle
): string {
  const isStory = style.format === 'story';
  const storyStyle = isStory ? (style as StoryNarrativeStyle) : null;
  const docStyle = !isStory ? (style as DocumentNarrativeStyle) : null;

  const wordCountTarget = isStory
    ? `${storyStyle!.pacing.totalWordCount.min}-${storyStyle!.pacing.totalWordCount.max}`
    : `${docStyle!.documentConfig.wordCount.min}-${docStyle!.documentConfig.wordCount.max}`;

  const sections: string[] = [];

  // Style expectations
  sections.push(`# Style: ${style.name}
Format: ${style.format}
Target word count: ${wordCountTarget}`);

  if (isStory && storyStyle!.plotStructure) {
    sections.push(`Plot structure: ${storyStyle!.plotStructure.type}`);
  }

  if (isStory && storyStyle!.proseDirectives) {
    const pd = storyStyle!.proseDirectives;
    sections.push(`Tone: ${pd.toneKeywords?.join(', ') || 'not specified'}
Dialogue style: ${pd.dialogueStyle || 'not specified'}
${pd.avoid?.length ? `Avoid: ${pd.avoid.join(', ')}` : ''}`);
  }

  if (!isStory && docStyle!.documentConfig) {
    const dc = docStyle!.documentConfig;
    sections.push(`Document type: ${dc.documentType}
Voice: ${dc.voice || 'not specified'}
${dc.toneKeywords?.length ? `Tone: ${dc.toneKeywords.join(', ')}` : ''}
${dc.avoid?.length ? `Avoid: ${dc.avoid.join(', ')}` : ''}`);
  }

  // Available entities
  sections.push(`# Entities Provided
${chronicleContext.entities.map((e) => `- ${e.name} (${e.kind}${e.subtype ? `/${e.subtype}` : ''}, ${e.status})`).join('\n')}`);

  // Content
  sections.push(`# Chronicle Content
${content}`);

  // Task
  sections.push(`# Validation Task

Evaluate this chronicle and output a JSON cohesion report.

Check the following:

1. **Word Count**: Is the content within the target range (${wordCountTarget} words)?

2. **Style Adherence**: Does the narrative match the expected tone, format, and voice?

3. **Entity Usage**: Are entities from the provided list used appropriately? Are entity kinds (person, faction, location, etc.) treated correctly (e.g., factions are groups, not individual characters)?

4. **Narrative Coherence**: Does the chronicle flow logically? Is there a clear beginning, middle, and end?

5. **Factual Consistency**: Are entity facts (names, relationships, status) consistent throughout?

Output this exact JSON structure:

\`\`\`json
{
  "overallScore": 85,
  "checks": {
    "wordCount": { "pass": true, "notes": "Approximately 2400 words, within target range" },
    "styleAdherence": { "pass": true, "notes": "Matches the expected tone and format" },
    "entityUsage": { "pass": true, "notes": "Entities used appropriately" },
    "narrativeCoherence": { "pass": true, "notes": "Clear narrative arc" },
    "factualConsistency": { "pass": true, "notes": "Facts are consistent" }
  },
  "issues": [
    {
      "severity": "minor",
      "checkType": "entityUsage",
      "description": "Faction name interpreted as character name",
      "suggestion": "Clarify that this is a group, not an individual"
    }
  ]
}
\`\`\`

Score guidelines:
- 90-100: Excellent, minimal issues
- 75-89: Good, minor issues only
- 60-74: Acceptable, some issues to address
- Below 60: Needs significant revision

Output ONLY the JSON, no other text.`);

  return sections.join('\n\n');
}

/**
 * Parse V2 validation response into CohesionReport format
 */
function parseV2ValidationResponse(text: string): CohesionReport {
  const parsed = parseJsonObject<Record<string, unknown>>(text, 'V2 validation response');

  // Map V2 checks to V1 cohesion report format
  const checks = (parsed.checks as Record<string, unknown>) || {};
  return {
    overallScore: (parsed.overallScore as number) || 0,
    checks: {
      plotStructure: (checks.narrativeCoherence as Record<string, unknown>) || { pass: true, notes: 'N/A for V2' },
      entityConsistency: (checks.entityUsage as Record<string, unknown>) || { pass: true, notes: 'N/A for V2' },
      sectionGoals: [], // V2 doesn't have sections
      resolution: (checks.styleAdherence as Record<string, unknown>) || { pass: true, notes: 'N/A for V2' },
      factualAccuracy: (checks.factualConsistency as Record<string, unknown>) || { pass: true, notes: 'N/A for V2' },
      themeExpression: (checks.wordCount as Record<string, unknown>) || { pass: true, notes: 'N/A for V2' },
    },
    issues: (Array.isArray(parsed.issues) ? parsed.issues : []).map((issue: { severity?: string; checkType?: string; description?: string; suggestion?: string }) => ({
      severity: issue.severity || 'minor',
      checkType: issue.checkType || 'unknown',
      description: issue.description || '',
      suggestion: issue.suggestion || '',
    })),
  };
}

/**
 * Validate cohesion
 */
async function executeValidateStep(
  task: WorkerTask,
  chronicleRecord: Awaited<ReturnType<typeof getChronicle>>,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for validation' };
  }

  const chronicleId = chronicleRecord.chronicleId;
  const failValidate = async (message: string, debug?: NetworkDebugInfo): Promise<TaskResult> => {
    await markChronicleFailure(chronicleId, 'validate', message);
    return { success: false, error: message, debug };
  };

  if (!chronicleRecord.assembledContent) {
    return failValidate('Chronicle has no assembled content to validate');
  }

  const chronicleContext = task.chronicleContext!;
  const narrativeStyle = chronicleContext.narrativeStyle;
  if (!narrativeStyle) {
    return failValidate('Narrative style is required for validation');
  }

  const callConfig = getCallConfig(config, 'chronicle.validation');
  console.log(`[Worker] Validating cohesion, model=${callConfig.model}...`);
  const validationPrompt = buildV2ValidationPrompt(chronicleRecord.assembledContent, chronicleContext, narrativeStyle);
  const systemPrompt = 'You are a narrative quality evaluator. Analyze the chronicle and provide a structured assessment.';

  const validationCall = await runTextCall({
    llmClient,
    callType: 'chronicle.validation',
    callConfig,
    systemPrompt,
    prompt: validationPrompt,
    temperature: 0.3,
  });
  const validationResult = validationCall.result;
  const debug = validationResult.debug;

  if (isAborted()) {
    return failValidate('Task aborted', debug);
  }

  const validationCost = {
    estimated: validationCall.estimate.estimatedCost,
    actual: validationCall.usage.actualCost,
    inputTokens: validationCall.usage.inputTokens,
    outputTokens: validationCall.usage.outputTokens,
  };

  if (validationResult.error || !validationResult.text) {
    return failValidate(`Validation failed: ${validationResult.error || 'Empty response'}`, debug);
  }

  let cohesionReport: CohesionReport;
  try {
    cohesionReport = parseV2ValidationResponse(validationResult.text);
    cohesionReport.generatedAt = Date.now();
    cohesionReport.model = callConfig.model;
  } catch (err) {
    return failValidate(`Failed to parse validation response: ${err}`, debug);
  }

  await updateChronicleCohesion(chronicleId, cohesionReport, validationCost);
  console.log('[Worker] Validation complete');

  // Save cost record independently
  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleValidation',
    model: callConfig.model,
    estimatedCost: validationCost.estimated,
    actualCost: validationCost.actual,
    inputTokens: validationCost.inputTokens,
    outputTokens: validationCost.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: validationCost.estimated,
      actualCost: validationCost.actual,
      inputTokens: validationCost.inputTokens,
      outputTokens: validationCost.outputTokens,
    },
    debug,
  };
}

function buildSummaryPrompt(content: string): string {
  return `Generate a title and summary for the chronicle below.

Rules:
- Title: A compelling, evocative title (3-8 words) that captures the essence of the chronicle
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
