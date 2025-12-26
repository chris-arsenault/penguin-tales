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
} from '../chronicleTypes';
import type {
  NarrativeStyle,
  StoryNarrativeStyle,
  DocumentNarrativeStyle,
} from '@canonry/world-schema';
import type { V2SelectionResult } from './types';

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
    `Status: ${e.status}`,
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
Status: ${e.status}, Prominence: ${e.prominence}${e.culture ? `, Culture: ${e.culture}` : ''}
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
  return `- [${e.eventKind}, ${significance}%] ${e.headline}${subjectLine}${objectLine}`;
}

// =============================================================================
// Section Builders
// =============================================================================

/**
 * Build the world section of the prompt.
 */
function buildWorldSection(context: ChronicleGenerationContext): string {
  const lines = [
    `# World: ${context.worldName}`,
    context.worldDescription || '',
    context.tone ? `Tone: ${context.tone}` : '',
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
 */
function buildEntitySection(selection: V2SelectionResult): string {
  const lines = [
    `# Characters (${selection.entities.length + 1} from local graph)`,
    '',
    `## ${selection.entrypoint.name} (graph entry point)`,
    formatEntityFull(selection.entrypoint),
  ];

  if (selection.entities.length > 0) {
    lines.push('');
    for (const entity of selection.entities) {
      lines.push(formatEntityBrief(entity));
      lines.push('');
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

// =============================================================================
// Story Format - Structure & Style Building
// =============================================================================

/**
 * Build the narrative structure section for story format.
 * Includes plot structure type, instructions, and scene progression.
 */
function buildStoryStructureSection(style: StoryNarrativeStyle): string {
  const lines: string[] = ['# Narrative Structure'];

  // Plot structure type and instructions
  if (style.plotStructure) {
    lines.push(`Type: ${style.plotStructure.type}`);
    if (style.plotStructure.instructions) {
      lines.push('');
      lines.push(style.plotStructure.instructions);
    }
  }

  // Scene progression
  if (style.pacing?.sceneCount) {
    lines.push('');
    lines.push(`## Scene Progression (${style.pacing.sceneCount.min}-${style.pacing.sceneCount.max} scenes)`);
  }

  if (style.sceneTemplates && style.sceneTemplates.length > 0) {
    if (!style.pacing?.sceneCount) {
      lines.push('');
      lines.push('## Scene Progression');
    }
    lines.push('Follow this emotional arc through the narrative:');
    for (let i = 0; i < style.sceneTemplates.length; i++) {
      const scene = style.sceneTemplates[i];
      lines.push(`${i + 1}. **${scene.name}** - ${scene.purpose}`);
      if (scene.emotionalArc) {
        lines.push(`   Emotional arc: ${scene.emotionalArc}`);
      }
      if (scene.requiredElements && scene.requiredElements.length > 0) {
        lines.push(`   Include: ${scene.requiredElements.join(', ')}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Build the cast rules section for story format.
 * Includes protagonist kind constraints and role expectations.
 */
function buildCastRulesSection(style: StoryNarrativeStyle): string {
  const lines: string[] = ['# Cast Rules'];
  let hasContent = false;

  // Protagonist kind constraints
  if (style.entityRules?.kindFilter?.protagonistKinds?.length) {
    const kinds = style.entityRules.kindFilter.protagonistKinds;
    lines.push(`Protagonist must be entity kind: ${kinds.join(' or ')}`);
    lines.push('(Factions, organizations, locations, etc. are setting elements, not protagonists)');
    hasContent = true;
  }

  // Role expectations
  if (style.entityRules?.roles && style.entityRules.roles.length > 0) {
    if (hasContent) lines.push('');
    lines.push('Expected roles in narrative:');
    for (const role of style.entityRules.roles) {
      const countStr = role.count.min === role.count.max
        ? `${role.count.min}`
        : `${role.count.min}-${role.count.max}`;
      lines.push(`- ${role.role} (${countStr}): ${role.description}`);
    }
    hasContent = true;
  }

  // Max cast size
  if (style.entityRules?.maxCastSize) {
    if (hasContent) lines.push('');
    lines.push(`Focus on ${style.entityRules.maxCastSize} or fewer characters for clarity.`);
    hasContent = true;
  }

  return hasContent ? lines.join('\n') : '';
}

/**
 * Build the event usage section for story format.
 */
function buildEventUsageSection(style: StoryNarrativeStyle): string {
  if (!style.eventRules?.usageInstructions) {
    return '';
  }

  return `# How to Use Events
${style.eventRules.usageInstructions}`;
}

/**
 * Build the world data focus section for story format.
 */
function buildWorldDataFocusSection(style: StoryNarrativeStyle): string {
  if (!style.worldDataFocus) {
    return '';
  }

  const wdf = style.worldDataFocus;
  const lines: string[] = ['# World Elements'];
  let hasContent = false;

  if (wdf.includeLocations && wdf.locationUsage) {
    lines.push(`Locations: ${wdf.locationUsage}`);
    hasContent = true;
  }
  if (wdf.includeArtifacts && wdf.artifactUsage) {
    lines.push(`Artifacts: ${wdf.artifactUsage}`);
    hasContent = true;
  }
  if (wdf.includeCulturalPractices && wdf.culturalUsage) {
    lines.push(`Culture: ${wdf.culturalUsage}`);
    hasContent = true;
  }
  if (wdf.includeEraContext && wdf.eraUsage) {
    lines.push(`Era: ${wdf.eraUsage}`);
    hasContent = true;
  }

  return hasContent ? lines.join('\n') : '';
}

/**
 * Build the prose style section for story format.
 */
function buildProseStyleSection(style: StoryNarrativeStyle): string {
  const pd = style.proseDirectives;
  if (!pd) return '';

  const lines: string[] = [`# Prose Style: ${style.name}`];

  if (pd.toneKeywords?.length) {
    lines.push(`Tone: ${pd.toneKeywords.join(', ')}`);
  }
  if (pd.dialogueStyle) {
    lines.push(`Dialogue: ${pd.dialogueStyle}`);
  }
  if (pd.descriptionStyle) {
    lines.push(`Description: ${pd.descriptionStyle}`);
  }
  if (pd.pacingNotes) {
    lines.push(`Pacing: ${pd.pacingNotes}`);
  }
  if (pd.avoid?.length) {
    lines.push(`Avoid: ${pd.avoid.join(', ')}`);
  }
  if (pd.exampleProse) {
    lines.push('');
    lines.push(`Example prose style: "${pd.exampleProse}"`);
  }

  return lines.join('\n');
}

/**
 * Build complete prompt for story format.
 */
function buildStoryPrompt(
  worldSection: string,
  entitySection: string,
  dataSection: string,
  style: StoryNarrativeStyle
): string {
  const pacing = style.pacing;
  const wordRange = `${pacing.totalWordCount.min}-${pacing.totalWordCount.max}`;
  const sceneRange = pacing.sceneCount
    ? `${pacing.sceneCount.min}-${pacing.sceneCount.max}`
    : '4-5';

  // Build all sections
  const structureSection = buildStoryStructureSection(style);
  const castSection = buildCastRulesSection(style);
  const eventSection = buildEventUsageSection(style);
  const worldFocusSection = buildWorldDataFocusSection(style);
  const proseSection = buildProseStyleSection(style);

  // Combine non-empty sections
  const sections = [
    worldSection,
    entitySection,
    dataSection,
    structureSection,
    castSection,
    eventSection,
    worldFocusSection,
    proseSection,
  ].filter(Boolean);

  // Task section
  const taskSection = `# Task
Write a ${wordRange} word narrative in ${sceneRange} distinct scenes.

Requirements:
- Follow the narrative structure type and scene progression above
- Protagonist must be an entity of the correct kind (typically a person, not a faction or location)
- Use relationships to drive tension or connection
- Incorporate events according to the usage instructions
- Feature multiple characters from the data provided

Write the narrative directly. No section headers, no meta-commentary.`;

  return [...sections, taskSection].join('\n\n');
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
    entitySection,
    dataSection,
    structureSection,
    styleSection,
    usageSection,
  ].filter(Boolean);

  // Task section
  const taskSection = `# Task
Write a ${wordRange} word ${doc.documentType}.

Requirements:
- Follow the document structure and sections above
- Write in the specified voice and tone
- Draw from the characters and events provided
- Make the document feel authentic to the world

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
  const worldSection = buildWorldSection(context);
  const entitySection = buildEntitySection(selection);
  const dataSection = buildDataSection(selection);

  if (style.format === 'story') {
    return buildStoryPrompt(
      worldSection,
      entitySection,
      dataSection,
      style as StoryNarrativeStyle
    );
  } else {
    return buildDocumentPrompt(
      worldSection,
      entitySection,
      dataSection,
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
 * Incorporates style-specific guidance.
 */
export function getV2SystemPrompt(style: NarrativeStyle): string {
  if (style.format === 'story') {
    const storyStyle = style as StoryNarrativeStyle;
    const structureType = storyStyle.plotStructure?.type || 'three-act';
    return `You are a narrative writer creating vivid world lore. Write engaging prose that brings characters and their relationships to life. Follow ${structureType} narrative structure precisely.`;
  } else {
    const docStyle = style as DocumentNarrativeStyle;
    return `You are writing an in-universe ${docStyle.documentConfig.documentType}. Write authentically as if the document exists within the world. Maintain consistent voice throughout.`;
  }
}
