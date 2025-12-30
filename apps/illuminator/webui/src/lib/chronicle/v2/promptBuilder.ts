/**
 * Chronicle V2 Prompt Builder
 *
 * Single-shot prompt construction for both story and document formats.
 * Includes full narrative style fidelity - structure, scenes, cast rules, etc.
 */

import type {
  ChronicleGenerationContext,
  EntityContext,
  RelationshipContext,
  NarrativeEventContext,
  ChronicleTemporalContext,
} from '../chronicleTypes';
import type {
  NarrativeStyle,
  StoryNarrativeStyle,
  DocumentNarrativeStyle,
} from '@canonry/world-schema';
import type { V2SelectionResult } from './types';

// Cultural identity type for descriptive identity per culture
type CulturalDescriptiveIdentity = Record<string, Record<string, string>>;

// =============================================================================
// Entity Formatting
// =============================================================================

/**
 * Format a single entity with full details (for entry point).
 */
function formatEntityFull(e: EntityContext): string {
  const desc = e.description || e.summary || '(no description available)';
  const tags = e.tags && Object.keys(e.tags).length > 0
    ? Object.entries(e.tags).map(([k, v]) => `${k}=${v}`).join(', ')
    : null;

  const lines = [
    `Kind: ${e.kind}${e.subtype ? `/${e.subtype}` : ''}`,
    `Prominence: ${e.prominence}`,
    e.culture ? `Culture: ${e.culture}` : null,
    tags ? `Tags: ${tags}` : null,
    '',
    desc,
  ].filter((line) => line !== null);

  return lines.join('\n');
}

/**
 * Format a single entity briefly (for other characters).
 */
function formatEntityBrief(e: EntityContext): string {
  const desc = e.description || e.summary || '(no description available)';
  return `## ${e.name} (${e.kind}${e.subtype ? `/${e.subtype}` : ''})
Prominence: ${e.prominence}${e.culture ? `, Culture: ${e.culture}` : ''}
${desc}`;
}

/**
 * Format a relationship.
 */
function formatRelationship(r: RelationshipContext): string {
  return `- ${r.sourceName} --[${r.kind}]--> ${r.targetName}`;
}

/**
 * Format an event.
 */
function formatEvent(e: NarrativeEventContext): string {
  const significance = Math.round(e.significance * 100);
  const subjectLine = e.subjectName ? ` (subject: ${e.subjectName})` : '';
  const objectLine = e.objectName ? ` (object: ${e.objectName})` : '';
  const participantNames = e.participants?.map(p => p.name).filter(Boolean) ?? [];
  const uniqueParticipants = Array.from(new Set(participantNames))
    .filter(name => name !== e.subjectName && name !== e.objectName);
  const participantsLine = uniqueParticipants.length > 0
    ? ` (participants: ${uniqueParticipants.join(', ')})`
    : '';
  return `- [${e.eventKind}, ${significance}%] ${e.headline}${subjectLine}${objectLine}${participantsLine}`;
}

// =============================================================================
// Section Builders
// =============================================================================

/**
 * Build the world section of the prompt.
 * Contains world context only - style/tone guidance is handled separately.
 */
function buildWorldSection(context: ChronicleGenerationContext): string {
  const lines = [
    `# World: ${context.worldName}`,
    context.worldDescription || '',
  ].filter(Boolean);

  if (context.canonFacts && context.canonFacts.length > 0) {
    lines.push('');
    lines.push('Canon Facts:');
    for (const fact of context.canonFacts) {
      lines.push(`- ${fact}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build the entities section of the prompt.
 * Shows primary entities with full details, supporting entities briefly.
 */
function buildEntitySection(
  selection: V2SelectionResult,
  primaryEntityIds: Set<string>
): string {
  const primaryEntities = selection.entities.filter(e => primaryEntityIds.has(e.id));
  const supportingEntities = selection.entities.filter(e => !primaryEntityIds.has(e.id));

  const lines = [
    `# Characters (${selection.entities.length} total)`,
  ];

  // Primary entities get full treatment
  if (primaryEntities.length > 0) {
    lines.push('');
    lines.push('## Primary Characters');
    for (const entity of primaryEntities) {
      lines.push('');
      lines.push(`### ${entity.name}`);
      lines.push(formatEntityFull(entity));
    }
  }

  // Supporting entities get brief treatment
  if (supportingEntities.length > 0) {
    lines.push('');
    lines.push('## Supporting Characters');
    for (const entity of supportingEntities) {
      lines.push('');
      lines.push(formatEntityBrief(entity));
    }
  }

  return lines.join('\n');
}

/**
 * Build the data section (relationships + events).
 */
function buildDataSection(selection: V2SelectionResult): string {
  const lines: string[] = [];

  if (selection.relationships.length > 0) {
    lines.push('# Relationships');
    for (const rel of selection.relationships) {
      lines.push(formatRelationship(rel));
    }
  }

  if (selection.events.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('# Events');
    for (const evt of selection.events) {
      lines.push(formatEvent(evt));
    }
  }

  return lines.join('\n');
}

/**
 * Build the temporal context section.
 * Provides era information and timeline context for the chronicle.
 */
function buildTemporalSection(temporalContext: ChronicleTemporalContext | undefined): string {
  if (!temporalContext) return '';

  const lines: string[] = ['# Historical Context'];

  // Focal era
  const focal = temporalContext.focalEra;
  lines.push(`## Setting: ${focal.name}`);
  if (focal.description) {
    lines.push(focal.description);
  }
  lines.push(`Duration: ${focal.duration} ticks (ticks ${focal.startTick}–${focal.endTick})`);

  // Chronicle timeline
  lines.push('');
  lines.push('## Chronicle Timeline');
  lines.push(temporalContext.temporalDescription);
  lines.push(`Tick range: ${temporalContext.chronicleTickRange[0]}–${temporalContext.chronicleTickRange[1]}`);
  lines.push(`Scope: ${temporalContext.temporalScope}`);

  // Multi-era notice
  if (temporalContext.isMultiEra) {
    lines.push('');
    lines.push(`**Note:** This chronicle spans ${temporalContext.touchedEraIds.length} eras. Events from different eras should be woven together thoughtfully, acknowledging the passage of time.`);
  }

  // Brief era breakdown (all eras for context)
  if (temporalContext.allEras.length > 1) {
    lines.push('');
    lines.push('## Era Overview');
    for (const era of temporalContext.allEras) {
      const isFocal = era.id === focal.id;
      const marker = isFocal ? ' [FOCAL]' : '';
      const touched = temporalContext.touchedEraIds.includes(era.id) ? ' *' : '';
      lines.push(`- ${era.name}${marker}${touched}: ticks ${era.startTick}–${era.endTick} (${era.duration} ticks)`);
      if (era.description && isFocal) {
        lines.push(`  ${era.description}`);
      }
    }
    lines.push('');
    lines.push('* = era contains events in this chronicle');
  }

  return lines.join('\n');
}

/**
 * Build the name bank section.
 * Provides culture-appropriate names for invented characters.
 */
function buildNameBankSection(nameBank: Record<string, string[]> | undefined): string {
  if (!nameBank || Object.keys(nameBank).length === 0) {
    return '';
  }

  const lines: string[] = ['# Available Names for Invented Characters'];
  lines.push('If you need to invent minor characters (e.g., to represent factions), use these culture-appropriate names:');

  for (const [cultureId, names] of Object.entries(nameBank)) {
    if (names.length > 0) {
      lines.push(`- ${cultureId}: ${names.join(', ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build the cultural identities section.
 * Provides cultural context (VALUES, SPEECH, FEARS, TABOOS, etc.) for each culture
 * that appears in the chronicle's entities.
 */
function buildCulturalIdentitiesSection(
  culturalIdentities: CulturalDescriptiveIdentity | undefined,
  entities: EntityContext[]
): string {
  if (!culturalIdentities || Object.keys(culturalIdentities).length === 0) {
    return '';
  }

  // Get unique cultures from the chronicle's entities
  const entityCultures = new Set(
    entities.map(e => e.culture).filter((c): c is string => Boolean(c))
  );

  if (entityCultures.size === 0) {
    return '';
  }

  const lines: string[] = ['# Cultural Identities'];
  lines.push('How different cultures think, speak, and behave:');

  for (const cultureId of entityCultures) {
    const identity = culturalIdentities[cultureId];
    if (!identity) continue;

    lines.push('');
    lines.push(`## ${cultureId}`);

    // Include all identity fields
    for (const [key, value] of Object.entries(identity)) {
      if (value && value.trim()) {
        lines.push(`- ${key}: ${value}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Build the prose hints section.
 * Provides per-kind guidance for how to portray different entity types in narrative prose.
 * Only includes hints for kinds present in the chronicle's entities.
 */
function buildProseHintsSection(
  proseHints: Record<string, string> | undefined,
  entities: EntityContext[]
): string {
  if (!proseHints || Object.keys(proseHints).length === 0) {
    return '';
  }

  // Get unique entity kinds from the chronicle's entities
  const entityKinds = new Set(entities.map(e => e.kind));

  // Filter hints to only include kinds present in this chronicle
  const relevantHints: [string, string][] = [];
  for (const [kind, hint] of Object.entries(proseHints)) {
    if (entityKinds.has(kind) && hint.trim()) {
      relevantHints.push([kind, hint]);
    }
  }

  if (relevantHints.length === 0) {
    return '';
  }

  const lines: string[] = ['# Entity Portrayal Guidelines'];
  lines.push('When writing about different types of entities, follow these guidelines:');
  lines.push('');

  for (const [kind, hint] of relevantHints) {
    lines.push(`**${kind}**: ${hint}`);
  }

  return lines.join('\n');
}

// =============================================================================
// Story Format - Structure & Style Building
// =============================================================================

/**
 * Build the narrative structure section for story format.
 * Uses the unified narrativeInstructions field.
 */
function buildStoryStructureSection(style: StoryNarrativeStyle): string {
  const lines: string[] = ['# Narrative Structure'];

  // Scene count guidance
  if (style.pacing?.sceneCount) {
    lines.push(`Target: ${style.pacing.sceneCount.min}-${style.pacing.sceneCount.max} scenes`);
    lines.push('');
  }

  // Narrative instructions (plot structure, scenes, beats, emotional arcs)
  if (style.narrativeInstructions) {
    lines.push(style.narrativeInstructions);
  }

  return lines.join('\n');
}

/**
 * Build the unified cast section for story format.
 * Combines role expectations with character data so the LLM sees roles and characters together.
 */
function buildUnifiedCastSection(
  selection: V2SelectionResult,
  primaryEntityIds: Set<string>,
  style: StoryNarrativeStyle
): string {
  const lines: string[] = [`# Cast (${selection.entities.length} characters)`];

  // Role expectations first - so LLM knows what to look for
  if (style.roles && style.roles.length > 0) {
    lines.push('');
    lines.push('## Narrative Roles');
    lines.push('Assign characters from below to these roles:');
    for (const role of style.roles) {
      const countStr = role.count.min === role.count.max
        ? `${role.count.min}`
        : `${role.count.min}-${role.count.max}`;
      lines.push(`- **${role.role}** (${countStr}): ${role.description}`);
    }
  }

  // Primary characters
  const primaryEntities = selection.entities.filter(e => primaryEntityIds.has(e.id));
  const supportingEntities = selection.entities.filter(e => !primaryEntityIds.has(e.id));

  if (primaryEntities.length > 0) {
    lines.push('');
    lines.push('## Primary Characters');
    for (const entity of primaryEntities) {
      lines.push('');
      lines.push(`### ${entity.name}`);
      lines.push(formatEntityFull(entity));
    }
  }

  // Supporting characters
  if (supportingEntities.length > 0) {
    lines.push('');
    lines.push('## Supporting Characters');
    for (const entity of supportingEntities) {
      lines.push('');
      lines.push(formatEntityBrief(entity));
    }
  }

  return lines.join('\n');
}

/**
 * Build the event usage section for story format.
 */
function buildEventUsageSection(style: StoryNarrativeStyle): string {
  if (!style.eventInstructions) {
    return '';
  }

  return `# How to Use Events
${style.eventInstructions}`;
}

/**
 * Build the unified style section for story format.
 * Combines world tone/voice guidance with prose instructions from the narrative style.
 * This is the single location for all writing style guidance.
 */
function buildUnifiedStyleSection(
  tone: string | undefined,
  style: StoryNarrativeStyle
): string {
  const lines: string[] = [`# Writing Style`];
  let hasContent = false;

  // World tone/voice guidance (may contain detailed style instructions)
  if (tone) {
    lines.push('');
    lines.push(tone);
    hasContent = true;
  }

  // Prose instructions from narrative style (tone, dialogue, description, world elements, avoid)
  if (style.proseInstructions) {
    if (hasContent) lines.push('');
    lines.push(`## Prose: ${style.name}`);
    lines.push(style.proseInstructions);
    hasContent = true;
  }

  return hasContent ? lines.join('\n') : '';
}

/**
 * Build complete prompt for story format.
 *
 * Section order (designed for clarity):
 * 1. TASK - What to write (upfront so LLM knows the goal)
 * 2. CAST - Narrative roles + characters (unified)
 * 3. WORLD - Setting context
 * 4. CULTURAL IDENTITIES - How cultures behave
 * 5. DATA - Relationships, events, available names
 * 6. STRUCTURE - Narrative structure, event usage
 * 7. STYLE - All writing guidance (world tone + prose instructions)
 */
function buildStoryPrompt(
  context: ChronicleGenerationContext,
  selection: V2SelectionResult,
  primaryEntityIds: Set<string>,
  culturalIdentitiesSection: string,
  proseHintsSection: string,
  style: StoryNarrativeStyle
): string {
  const pacing = style.pacing;
  const wordRange = `${pacing.totalWordCount.min}-${pacing.totalWordCount.max}`;
  const sceneRange = pacing.sceneCount
    ? `${pacing.sceneCount.min}-${pacing.sceneCount.max}`
    : '4-5';

  // 1. TASK (upfront)
  const taskSection = `# Task
Write a ${wordRange} word narrative in ${sceneRange} distinct scenes.

Requirements:
- Assign the provided characters to the narrative roles defined below
- Follow the plot structure and scene progression
- Incorporate the listed events naturally into the narrative
- Characters should speak and act according to their cultural identity
- Write directly with no section headers or meta-commentary`;

  // 2. CAST (unified roles + characters)
  const castSection = buildUnifiedCastSection(selection, primaryEntityIds, style);

  // 3. WORLD (setting context only, no style)
  const worldSection = buildWorldSection(context);

  // 4. CULTURAL IDENTITIES (passed in)

  // 5. DATA (relationships, events, names)
  const dataSection = buildDataSection(selection);
  const nameBankSection = buildNameBankSection(context.nameBank);
  const temporalSection = buildTemporalSection(context.temporalContext);

  // 6. STRUCTURE (narrative structure, event usage)
  const structureSection = buildStoryStructureSection(style);
  const eventSection = buildEventUsageSection(style);

  // 7. STYLE (unified tone + prose instructions)
  const styleSection = buildUnifiedStyleSection(context.tone, style);

  // Combine sections in order
  const sections = [
    taskSection,
    castSection,
    worldSection,
    culturalIdentitiesSection,
    temporalSection,
    dataSection,
    nameBankSection,
    structureSection,
    eventSection,
    proseHintsSection,
    styleSection,
  ].filter(Boolean);

  return sections.join('\n\n');
}

// =============================================================================
// Document Format - Structure & Style Building
// =============================================================================

/**
 * Build the document structure section.
 */
function buildDocumentStructureSection(style: DocumentNarrativeStyle): string {
  const doc = style.documentConfig;
  const lines: string[] = [`# Document Type: ${doc.documentType}`];

  if (doc.contentInstructions) {
    lines.push('');
    lines.push(doc.contentInstructions);
  }

  // Document sections
  if (doc.sections && doc.sections.length > 0) {
    lines.push('');
    lines.push('## Document Sections');
    for (let i = 0; i < doc.sections.length; i++) {
      const section = doc.sections[i];
      const wordTarget = section.wordCountTarget ? ` (~${section.wordCountTarget} words)` : '';
      const optional = section.optional ? ' [optional]' : '';
      lines.push(`${i + 1}. **${section.name}**${wordTarget}${optional}`);
      lines.push(`   Purpose: ${section.purpose}`);
      if (section.contentGuidance) {
        lines.push(`   Guidance: ${section.contentGuidance}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Build the document voice and style section.
 */
function buildDocumentStyleSection(style: DocumentNarrativeStyle): string {
  const doc = style.documentConfig;
  const lines: string[] = ['# Voice & Style'];

  if (doc.voice) {
    lines.push(`Voice: ${doc.voice}`);
  }
  if (doc.toneKeywords?.length) {
    lines.push(`Tone: ${doc.toneKeywords.join(', ')}`);
  }
  if (doc.include?.length) {
    lines.push(`Include: ${doc.include.join(', ')}`);
  }
  if (doc.avoid?.length) {
    lines.push(`Avoid: ${doc.avoid.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Build the document entity/event usage section.
 */
function buildDocumentUsageSection(style: DocumentNarrativeStyle): string {
  const doc = style.documentConfig;
  const lines: string[] = [];

  if (doc.entityUsage) {
    lines.push(`# Entity Usage`);
    lines.push(doc.entityUsage);
  }

  if (doc.eventUsage) {
    if (lines.length > 0) lines.push('');
    lines.push(`# Event Usage`);
    lines.push(doc.eventUsage);
  }

  return lines.join('\n');
}

/**
 * Build complete prompt for document format.
 */
function buildDocumentPrompt(
  worldSection: string,
  entitySection: string,
  dataSection: string,
  temporalSection: string,
  nameBankSection: string,
  culturalIdentitiesSection: string,
  proseHintsSection: string,
  style: DocumentNarrativeStyle
): string {
  const doc = style.documentConfig;
  const wordRange = `${doc.wordCount.min}-${doc.wordCount.max}`;

  // Build all sections
  const structureSection = buildDocumentStructureSection(style);
  const styleSection = buildDocumentStyleSection(style);
  const usageSection = buildDocumentUsageSection(style);

  // Combine non-empty sections
  const sections = [
    worldSection,
    temporalSection,
    entitySection,
    culturalIdentitiesSection,
    nameBankSection,
    dataSection,
    structureSection,
    styleSection,
    proseHintsSection,
    usageSection,
  ].filter(Boolean);

  // Task section
  const taskSection = `# Task
Write a ${wordRange} word ${doc.documentType}.

Requirements:
- Follow the document structure and sections above
- Ground the document in the historical era and timeline provided
- Write in the specified voice and tone
- Draw from the characters and events provided
- Make the document feel authentic to the world and its time period
- Respect cultural identities: characters should speak and act according to their culture

Write the document directly. No meta-commentary.`;

  return [...sections, taskSection].join('\n\n');
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Build the V2 single-shot prompt.
 */
export function buildV2Prompt(
  context: ChronicleGenerationContext,
  style: NarrativeStyle,
  selection: V2SelectionResult
): string {
  const primaryEntityIds = new Set(context.focus?.primaryEntityIds || []);
  const culturalIdentitiesSection = buildCulturalIdentitiesSection(
    context.culturalIdentities,
    selection.entities
  );
  const proseHintsSection = buildProseHintsSection(context.proseHints, selection.entities);

  if (style.format === 'story') {
    return buildStoryPrompt(
      context,
      selection,
      primaryEntityIds,
      culturalIdentitiesSection,
      proseHintsSection,
      style as StoryNarrativeStyle
    );
  } else {
    // Document format still uses the old assembly (can be refactored later)
    const worldSection = buildWorldSection(context);
    const entitySection = buildEntitySection(selection, primaryEntityIds);
    const dataSection = buildDataSection(selection);
    const temporalSection = buildTemporalSection(context.temporalContext);
    const nameBankSection = buildNameBankSection(context.nameBank);

    return buildDocumentPrompt(
      worldSection,
      entitySection,
      dataSection,
      temporalSection,
      nameBankSection,
      culturalIdentitiesSection,
      proseHintsSection,
      style as DocumentNarrativeStyle
    );
  }
}

/**
 * Get max tokens based on word count target.
 * Rough estimate: 1 token ~= 0.75 words, plus buffer.
 */
export function getMaxTokensFromStyle(style: NarrativeStyle): number {
  const maxWords = style.format === 'story'
    ? (style as StoryNarrativeStyle).pacing.totalWordCount.max
    : (style as DocumentNarrativeStyle).documentConfig.wordCount.max;

  // Add 50% buffer for safety
  return Math.ceil(maxWords / 0.75 * 1.5);
}

/**
 * Get the system prompt for V2 generation.
 * Kept minimal - detailed guidance is in the user prompt.
 */
export function getV2SystemPrompt(style: NarrativeStyle): string {
  if (style.format === 'story') {
    return `You are a narrative writer creating vivid world lore. Write engaging prose that brings characters and their relationships to life.`;
  } else {
    const docStyle = style as DocumentNarrativeStyle;
    return `You are writing an in-universe ${docStyle.documentConfig.documentType}. Write authentically as if the document exists within the world.`;
  }
}
