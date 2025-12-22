/**
 * Web Worker for Entity Enrichment
 *
 * Runs LLM enrichment off the main UI thread with entity-level granularity.
 * Each enrichment task is a single entity operation, enabling selective re-runs.
 *
 * Communicates progress and results via postMessage.
 */

import { LLMClient, ImageGenerationClient } from '../lib/llmClient.browser';
import type { LLMConfig, ImageConfig } from '../lib/llmClient.browser';

// Worker context
const ctx: Worker = self as unknown as Worker;

// ============================================================================
// Types
// ============================================================================

export type TaskType = 'description' | 'relationship' | 'era_narrative' | 'image';
export type TaskStatus = 'pending' | 'queued' | 'running' | 'complete' | 'error' | 'skipped';
export type Prominence = 'forgotten' | 'marginal' | 'recognized' | 'renowned' | 'mythic';

export interface EnrichmentTask {
  id: string;
  type: TaskType;
  entityId: string;
  entityName: string;
  entityKind: string;
  entitySubtype: string;
  prominence: Prominence;
  culture: string;
  status: TaskStatus;
  prompt: string;
  customPrompt?: string;
  result?: EnrichmentResult;
  error?: string;
  runAt?: number;
  cached?: boolean;
}

export interface EnrichmentResult {
  text?: string;
  imageUrl?: string;
  revisedPrompt?: string;
}

export interface TaskFilter {
  entityKinds?: string[];
  minProminence?: Prominence;
  taskTypes?: TaskType[];
  status?: TaskStatus[];
}

export interface HardState {
  id: string;
  kind: string;
  subtype: string;
  name: string;
  description: string;
  status: string;
  prominence: Prominence;
  culture?: string;
  tags: Record<string, string | number | boolean>;
  links: Array<{ kind: string; src: string; dst: string }>;
  createdAt: number;
  updatedAt: number;
}

export interface DomainContext {
  worldName: string;
  worldDescription: string;
  canonFacts: string[];
  cultureNotes: Record<
    string,
    {
      namingStyle: string;
      values: string[];
      styleNotes: string;
    }
  >;
  relationshipPatterns: string[];
  conflictPatterns: string[];
  technologyNotes: string[];
  magicNotes: string[];
  geographyScale: string;
  geographyTraits: string[];
}

export interface EnrichmentConfig {
  anthropicApiKey: string;
  openaiApiKey: string;
  mode: 'off' | 'partial' | 'full';
  enrichDescriptions: boolean;
  enrichRelationships: boolean;
  enrichEraNarratives: boolean;
  generateImages: boolean;
  minProminenceForDescription: Prominence;
  minProminenceForImage: Prominence;
  batchSize: number;
  delayBetweenBatches: number;
  textModel: string;
  imageModel: string;
  imageSize: '1024x1024' | '1792x1024' | '1024x1792';
  imageQuality: 'standard' | 'hd';
}

// Inbound messages from main thread
export type WorkerInbound =
  | { type: 'init'; config: EnrichmentConfig; worldData: HardState[]; domainContext: DomainContext }
  | { type: 'runAll' }
  | { type: 'runFiltered'; filter: TaskFilter }
  | { type: 'runEntity'; entityId: string }
  | { type: 'runTask'; taskId: string }
  | { type: 'runTasks'; taskIds: string[] }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'abort' }
  | { type: 'reset'; entityIds?: string[] };

// Outbound messages to main thread
export type WorkerOutbound =
  | { type: 'queueBuilt'; tasks: EnrichmentTask[] }
  | { type: 'taskStarted'; taskId: string; entityId: string; taskType: TaskType }
  | { type: 'taskComplete'; taskId: string; entityId: string; result: EnrichmentResult }
  | { type: 'taskError'; taskId: string; entityId: string; error: string }
  | { type: 'progress'; completed: number; total: number; running: string[] }
  | { type: 'batchComplete'; completedTasks: EnrichmentTask[] }
  | { type: 'allComplete'; enrichedEntities: HardState[] }
  | { type: 'error'; message: string };

// ============================================================================
// State
// ============================================================================

let config: EnrichmentConfig | null = null;
let worldData: HardState[] = [];
let domainContext: DomainContext | null = null;
let tasks: EnrichmentTask[] = [];
let llmClient: LLMClient | null = null;
let imageClient: ImageGenerationClient | null = null;
let isPaused = false;
let isAborted = false;
let runningTaskIds: string[] = [];

const PROMINENCE_ORDER: Prominence[] = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

// ============================================================================
// Helpers
// ============================================================================

function emit(message: WorkerOutbound): void {
  ctx.postMessage(message);
}

function prominenceAtLeast(entity: Prominence, threshold: Prominence): boolean {
  return PROMINENCE_ORDER.indexOf(entity) >= PROMINENCE_ORDER.indexOf(threshold);
}

function buildPromptForEntity(entity: HardState, taskType: TaskType): string {
  const context = domainContext!;
  const cultureNote = context.cultureNotes[entity.culture || ''];

  let prompt = '';

  switch (taskType) {
    case 'description':
      prompt = `Write a compelling description for ${entity.name}, a ${entity.subtype} ${entity.kind} in ${context.worldName}.

Entity details:
- Kind: ${entity.kind}
- Subtype: ${entity.subtype}
- Prominence: ${entity.prominence}
- Culture: ${entity.culture || 'unknown'}
${cultureNote ? `- Cultural style: ${cultureNote.styleNotes}` : ''}

World context:
${context.worldDescription}

Canon facts that must not be contradicted:
${context.canonFacts.map((f) => `- ${f}`).join('\n')}

Write 2-3 sentences that capture the essence of this ${entity.kind}.`;
      break;

    case 'image':
      prompt = `Create a portrait/scene for ${entity.name}, a ${entity.subtype} ${entity.kind}.

Visual style: ${cultureNote?.styleNotes || 'fantasy illustration'}
World: ${context.worldName}
Setting: ${context.geographyTraits.join(', ')}

The image should capture their ${entity.prominence} level of importance in the world.
${entity.description ? `Description: ${entity.description}` : ''}`;
      break;

    case 'relationship':
      prompt = `Describe the relationship dynamics involving ${entity.name}.

Entity: ${entity.name} (${entity.subtype} ${entity.kind})
Prominence: ${entity.prominence}

Known relationship patterns in this world:
${context.relationshipPatterns.map((p) => `- ${p}`).join('\n')}

Conflict patterns:
${context.conflictPatterns.map((p) => `- ${p}`).join('\n')}`;
      break;

    case 'era_narrative':
      prompt = `Write a narrative summary for the era/event: ${entity.name}

Type: ${entity.subtype}
Description: ${entity.description}

World context: ${context.worldDescription}

Technology notes:
${context.technologyNotes.map((n) => `- ${n}`).join('\n')}

Magic system notes:
${context.magicNotes.map((n) => `- ${n}`).join('\n')}`;
      break;
  }

  return prompt;
}

function buildSystemPrompt(): string {
  const context = domainContext!;
  return `You are a lore writer for ${context.worldName}.
Your writing should be evocative and consistent with the world's established canon.
Keep responses concise but vivid. Focus on what makes each element unique.`;
}

function buildImagePrompt(entity: HardState): string {
  const context = domainContext!;
  const cultureNote = context.cultureNotes[entity.culture || ''];

  return `A detailed fantasy illustration of ${entity.name}, a ${entity.subtype} ${entity.kind}.
${entity.description ? `Character/scene description: ${entity.description}` : ''}
${cultureNote?.styleNotes ? `Art style: ${cultureNote.styleNotes}` : 'Style: detailed fantasy art'}
Setting: ${context.worldName} - ${context.geographyTraits.slice(0, 2).join(', ')}
Mood: ${entity.prominence === 'mythic' ? 'epic and legendary' : entity.prominence === 'renowned' ? 'notable and impressive' : 'atmospheric and fitting'}`;
}

function buildTasksForEntity(entity: HardState): EnrichmentTask[] {
  const entityTasks: EnrichmentTask[] = [];

  // Description task
  if (
    config!.enrichDescriptions &&
    prominenceAtLeast(entity.prominence, config!.minProminenceForDescription)
  ) {
    entityTasks.push({
      id: `desc_${entity.id}`,
      type: 'description',
      entityId: entity.id,
      entityName: entity.name,
      entityKind: entity.kind,
      entitySubtype: entity.subtype,
      prominence: entity.prominence,
      culture: entity.culture || '',
      status: 'pending',
      prompt: buildPromptForEntity(entity, 'description'),
    });
  }

  // Image task (higher prominence threshold)
  if (
    config!.generateImages &&
    prominenceAtLeast(entity.prominence, config!.minProminenceForImage)
  ) {
    entityTasks.push({
      id: `img_${entity.id}`,
      type: 'image',
      entityId: entity.id,
      entityName: entity.name,
      entityKind: entity.kind,
      entitySubtype: entity.subtype,
      prominence: entity.prominence,
      culture: entity.culture || '',
      status: 'pending',
      prompt: buildImagePrompt(entity),
    });
  }

  // Era narrative task (for occurrences/eras)
  if (
    config!.enrichEraNarratives &&
    (entity.kind === 'era' || entity.kind === 'occurrence')
  ) {
    entityTasks.push({
      id: `era_${entity.id}`,
      type: 'era_narrative',
      entityId: entity.id,
      entityName: entity.name,
      entityKind: entity.kind,
      entitySubtype: entity.subtype,
      prominence: entity.prominence,
      culture: entity.culture || '',
      status: 'pending',
      prompt: buildPromptForEntity(entity, 'era_narrative'),
    });
  }

  return entityTasks;
}

function filterTasks(filter: TaskFilter): EnrichmentTask[] {
  return tasks.filter((task) => {
    if (filter.entityKinds && !filter.entityKinds.includes(task.entityKind)) {
      return false;
    }
    if (filter.minProminence && !prominenceAtLeast(task.prominence, filter.minProminence)) {
      return false;
    }
    if (filter.taskTypes && !filter.taskTypes.includes(task.type)) {
      return false;
    }
    if (filter.status && !filter.status.includes(task.status)) {
      return false;
    }
    return true;
  });
}

async function executeTask(task: EnrichmentTask): Promise<void> {
  if (isAborted) return;
  while (isPaused && !isAborted) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (isAborted) return;

  task.status = 'running';
  runningTaskIds.push(task.id);
  emit({ type: 'taskStarted', taskId: task.id, entityId: task.entityId, taskType: task.type });

  try {
    const prompt = task.customPrompt || task.prompt;

    if (task.type === 'image') {
      // Image generation
      if (!imageClient?.isEnabled()) {
        throw new Error('Image generation not configured');
      }
      const result = await imageClient.generate({ prompt });
      if (result.error) {
        throw new Error(result.error);
      }
      task.result = {
        imageUrl: result.imageUrl || undefined,
        revisedPrompt: result.revisedPrompt,
      };
    } else {
      // Text generation
      if (!llmClient?.isEnabled()) {
        throw new Error('LLM not configured');
      }
      const result = await llmClient.complete({
        systemPrompt: buildSystemPrompt(),
        prompt,
        maxTokens: 512,
        temperature: 0.7,
      });
      if (result.error) {
        throw new Error(result.error);
      }
      task.result = { text: result.text };
      task.cached = result.cached;
    }

    task.status = 'complete';
    task.runAt = Date.now();
    emit({ type: 'taskComplete', taskId: task.id, entityId: task.entityId, result: task.result! });
  } catch (error) {
    task.status = 'error';
    task.error = error instanceof Error ? error.message : String(error);
    emit({ type: 'taskError', taskId: task.id, entityId: task.entityId, error: task.error });
  } finally {
    runningTaskIds = runningTaskIds.filter((id) => id !== task.id);
  }
}

async function runTaskBatch(tasksToRun: EnrichmentTask[]): Promise<void> {
  const batchSize = config?.batchSize || 6;
  const delay = config?.delayBetweenBatches || 1000;
  let completed = 0;
  const total = tasksToRun.length;

  for (let i = 0; i < tasksToRun.length; i += batchSize) {
    if (isAborted) break;

    const batch = tasksToRun.slice(i, i + batchSize);

    // Run batch in parallel
    await Promise.all(batch.map((task) => executeTask(task)));

    completed += batch.length;
    emit({
      type: 'progress',
      completed,
      total,
      running: runningTaskIds,
    });

    // Delay between batches (except for last batch)
    if (i + batchSize < tasksToRun.length && !isAborted) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Emit batch complete
  const completedTasks = tasksToRun.filter((t) => t.status === 'complete');
  emit({ type: 'batchComplete', completedTasks });
}

function buildEnrichedEntities(): HardState[] {
  // Merge enrichment results back into entities
  const entityMap = new Map(worldData.map((e) => [e.id, { ...e }]));

  for (const task of tasks) {
    if (task.status !== 'complete' || !task.result) continue;

    const entity = entityMap.get(task.entityId);
    if (!entity) continue;

    if (task.type === 'description' && task.result.text) {
      entity.description = task.result.text;
    }
    // Image URLs and other results are stored in task.result
    // and can be retrieved by the UI
  }

  return Array.from(entityMap.values());
}

// ============================================================================
// Message Handler
// ============================================================================

ctx.onmessage = async (event: MessageEvent<WorkerInbound>) => {
  const message = event.data;

  switch (message.type) {
    case 'init': {
      config = message.config;
      worldData = message.worldData;
      domainContext = message.domainContext;
      isPaused = false;
      isAborted = false;
      runningTaskIds = [];

      // Initialize clients
      llmClient = new LLMClient({
        enabled: Boolean(config.anthropicApiKey),
        apiKey: config.anthropicApiKey,
        model: config.textModel || 'claude-sonnet-4-20250514',
      });

      imageClient = new ImageGenerationClient({
        enabled: Boolean(config.openaiApiKey) && config.generateImages,
        apiKey: config.openaiApiKey,
        model: config.imageModel || 'dall-e-3',
        size: config.imageSize,
        quality: config.imageQuality,
      });

      // Build task queue
      tasks = [];
      for (const entity of worldData) {
        tasks.push(...buildTasksForEntity(entity));
      }

      emit({ type: 'queueBuilt', tasks });
      break;
    }

    case 'runAll': {
      const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'error');
      await runTaskBatch(pendingTasks);
      emit({ type: 'allComplete', enrichedEntities: buildEnrichedEntities() });
      break;
    }

    case 'runFiltered': {
      const filtered = filterTasks(message.filter).filter(
        (t) => t.status === 'pending' || t.status === 'error'
      );
      await runTaskBatch(filtered);
      emit({ type: 'allComplete', enrichedEntities: buildEnrichedEntities() });
      break;
    }

    case 'runEntity': {
      const entityTasks = tasks.filter(
        (t) => t.entityId === message.entityId && (t.status === 'pending' || t.status === 'error')
      );
      await runTaskBatch(entityTasks);
      break;
    }

    case 'runTask': {
      const task = tasks.find((t) => t.id === message.taskId);
      if (task) {
        await executeTask(task);
      }
      break;
    }

    case 'runTasks': {
      const selectedTasks = tasks.filter((t) => message.taskIds.includes(t.id));
      await runTaskBatch(selectedTasks);
      break;
    }

    case 'pause':
      isPaused = true;
      break;

    case 'resume':
      isPaused = false;
      break;

    case 'abort':
      isAborted = true;
      isPaused = false;
      break;

    case 'reset': {
      if (message.entityIds) {
        // Reset specific entities
        for (const task of tasks) {
          if (message.entityIds.includes(task.entityId)) {
            task.status = 'pending';
            task.result = undefined;
            task.error = undefined;
            task.runAt = undefined;
          }
        }
      } else {
        // Reset all
        for (const task of tasks) {
          task.status = 'pending';
          task.result = undefined;
          task.error = undefined;
          task.runAt = undefined;
        }
      }
      emit({ type: 'queueBuilt', tasks });
      break;
    }
  }
};

export {};
