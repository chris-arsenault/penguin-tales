/**
 * Chronicle Section Expander
 *
 * Step 2 of the pipeline: Expand each section into narrative prose.
 * Each section receives the full chronicle plan + context for coherence.
 *
 * See CHRONICLE_DESIGN.md for architecture documentation.
 */

import type {
  ChroniclePlan,
  ChronicleSection,
  ChronicleGenerationContext,
} from './chronicleTypes';
import type { NarrativeStyle } from '@canonry/world-schema';

/**
 * Check if a plan is for a document-format style
 */
function isDocumentPlan(plan: ChroniclePlan): boolean {
  return plan.format === 'document';
}

function buildStoryStyleSection(style: NarrativeStyle): string {
  if (style.format === 'document') {
    throw new Error('Story style directives requested for a document narrative style');
  }
  if (!style.proseDirectives) {
    throw new Error(`Narrative style "${style.name}" is missing prose directives`);
  }
  const pd = style.proseDirectives;
  const lines: string[] = ['# Style Directives'];
  if (pd.toneKeywords?.length) lines.push(`Tone: ${pd.toneKeywords.join(', ')}`);
  if (pd.dialogueStyle) lines.push(`Dialogue: ${pd.dialogueStyle}`);
  if (pd.descriptionStyle) lines.push(`Description: ${pd.descriptionStyle}`);
  if (pd.pacingNotes) lines.push(`Pacing: ${pd.pacingNotes}`);
  if (style.pacing?.dialogueRatio) {
    lines.push(
      `Dialogue ratio: ${(style.pacing.dialogueRatio.min * 100).toFixed(0)}%-${(style.pacing.dialogueRatio.max * 100).toFixed(0)}%`
    );
  }
  if (pd.avoid?.length) lines.push(`Avoid: ${pd.avoid.join('; ')}`);
  return lines.join('\n');
}

function buildDocumentStyleSection(style: NarrativeStyle): string {
  if (style.format !== 'document' || !style.documentConfig) {
    throw new Error(`Document style directives requested for non-document style "${style.name}"`);
  }
  const doc = style.documentConfig;
  const lines: string[] = ['# Document Style'];
  if (doc.documentType) lines.push(`Type: ${doc.documentType}`);
  if (doc.voice) lines.push(`Voice: ${doc.voice}`);
  if (doc.toneKeywords?.length) lines.push(`Tone: ${doc.toneKeywords.join(', ')}`);
  if (doc.include?.length) lines.push(`Include: ${doc.include.join(', ')}`);
  if (doc.avoid?.length) lines.push(`Avoid: ${doc.avoid.join(', ')}`);
  return lines.join('\n');
}

/**
 * Build prompt for expanding a single section
 */
export function buildSectionPrompt(
  section: ChronicleSection,
  sectionIndex: number,
  plan: ChroniclePlan,
  context: ChronicleGenerationContext,
  previousSections: { id: string; content: string }[],
  style: NarrativeStyle
): string {
  // Use document-specific prompt builder if this is a document plan
  if (isDocumentPlan(plan)) {
    return buildDocumentSectionPrompt(section, sectionIndex, plan, context, previousSections, style);
  }

  const sections: string[] = [];

  // World context
  sections.push(`# World Context
World: ${context.worldName}
${context.worldDescription ? `Description: ${context.worldDescription}` : ''}
${context.tone ? `Tone: ${context.tone}` : ''}`);

  const overviewLines = [
    `Title: "${plan.title}"`,
    plan.theme ? `Theme: ${plan.theme}` : '',
    plan.tone ? `Tone: ${plan.tone}` : '',
    plan.scope?.timeframe ? `Timeframe: ${plan.scope.timeframe}` : '',
  ].filter(Boolean);

  sections.push(`# Chronicle Overview
${overviewLines.join('\n')}`);

  sections.push(buildStoryStyleSection(style));

  // Plot structure for reference - handle different plot types
  const plotSection = buildPlotStructureSection(plan);
  if (plotSection) {
    sections.push(plotSection);
  }

  // Entities in this section with full context
  const sectionRoles = plan.entityRoles.filter((role) =>
    section.entityIds.includes(role.entityId)
  );

  if (sectionRoles.length > 0) {
    const roleDetails = sectionRoles.map((role) => {
      const entity = context.entities.find((e) => e.id === role.entityId);
      if (!entity) return `- ${role.entityId} (unknown)`;

      return `## ${entity.name}
- Role: ${role.role}
- Contribution: ${role.contribution}
- Kind: ${entity.kind}${entity.subtype ? ` (${entity.subtype})` : ''}
- Prominence: ${entity.prominence}
- Culture: ${entity.culture || '(none)'}
- Status: ${entity.status}
${entity.enrichedDescription ? `- Description: ${entity.enrichedDescription}` : entity.description ? `- Description: ${entity.description}` : ''}`;
    });

    sections.push(`# Entities in This Section
${roleDetails.join('\n\n')}`);
  }

  // Relevant events for this section
  const sectionEvents = context.events.filter((e) =>
    section.eventIds.includes(e.id)
  );

  if (sectionEvents.length > 0) {
    sections.push(`# Events to Incorporate
${sectionEvents
  .map(
    (e) => `- ${e.headline}${e.description ? `: ${e.description}` : ''}
  Type: ${e.eventKind}, Significance: ${(e.significance * 100).toFixed(0)}%
  ${e.subjectName ? `Subject: ${e.subjectName}` : ''}${e.objectName ? `, Object: ${e.objectName}` : ''}`
  )
  .join('\n')}`);
  }

  // Relationships between section entities
  const sectionRelationships = context.relationships.filter(
    (r) =>
      section.entityIds.includes(r.src) && section.entityIds.includes(r.dst)
  );

  if (sectionRelationships.length > 0) {
    sections.push(`# Relationships in This Section
${sectionRelationships
  .map((r) => `- ${r.sourceName} --[${r.kind}]--> ${r.targetName}`)
  .join('\n')}`);
  }

  // Previous sections for continuity
  if (previousSections.length > 0) {
    sections.push(`# Previous Sections (for continuity)
${previousSections
  .map((ps, i) => `## Section ${i + 1}
${ps.content.slice(0, 500)}${ps.content.length > 500 ? '...' : ''}`)
  .join('\n\n')}`);
  }

  const requiredElements = section.requiredElements && section.requiredElements.length > 0
    ? section.requiredElements.map((el) => `- ${el}`).join('\n')
    : '(none)';

  // This section's requirements
  sections.push(`# SECTION ${sectionIndex + 1}: ${section.name}

## Section Purpose (from style)
${section.purpose}

## Section Goal (MUST be achieved)
${section.goal}

## Required Elements
${requiredElements}

## Emotional Arc
This section should build toward/express: ${section.emotionalArc}

${section.proseNotes ? `## Prose Notes\n${section.proseNotes}\n` : ''}
## Your Task
Write ${section.wordCountTarget ? `about ${section.wordCountTarget}` : '300-500'} words of narrative prose for this section.

Guidelines:
- Achieve the stated section goal - this is your PRIMARY objective
- Honor the emotional arc (${section.emotionalArc})
- Include the required elements listed above
- Stay true to each entity's established traits and narrative role
- Make the interaction between entities explicit (dialogue, action, influence)
- Incorporate the events listed above as natural plot elements
- Maintain continuity with previous sections
- Use vivid, immersive prose befitting the world's tone
- Include dialogue where appropriate
- Reference [[Entity Name]] using wiki link syntax when mentioning entities

Write the section prose directly. Do not include meta-commentary, section numbers, or headers.`);

  return sections.join('\n\n');
}

/**
 * Build plot structure section based on plot type
 */
function buildPlotStructureSection(plan: ChroniclePlan): string | null {
  const beats = plan.plot.normalizedBeats || [];
  if (beats.length === 0) return null;

  return `# Plot Structure (${plan.plot.type})
${beats.map((b, i) => `${i + 1}. ${b.description}`).join('\n')}`;
}

/**
 * Build prompt for expanding a document section
 */
function buildDocumentSectionPrompt(
  section: ChronicleSection,
  sectionIndex: number,
  plan: ChroniclePlan,
  context: ChronicleGenerationContext,
  previousSections: { id: string; content: string }[],
  style: NarrativeStyle
): string {
  const sections: string[] = [];

  // World context
  sections.push(`# World Context
World: ${context.worldName}
${context.worldDescription ? `Description: ${context.worldDescription}` : ''}`);

  // Document overview
  if (plan.plot.type !== 'document') {
    throw new Error('Document section expansion requires a document-format plot');
  }
  const plotRaw = plan.plot.raw as Record<string, unknown>;
  const docPurpose = plotRaw.documentPurpose as string;
  const keyPoints = plotRaw.keyPoints as string[];
  if (!docPurpose || !Array.isArray(keyPoints)) {
    throw new Error('Document plot is missing required documentPurpose or keyPoints');
  }

  sections.push(`# Document Overview
Title: "${plan.title}"
Purpose: ${docPurpose}
Tone: ${plan.tone}
  ${keyPoints.length > 0 ? `Key Points:\n${keyPoints.map((p) => `- ${p}`).join('\n')}` : ''}`);

  sections.push(buildDocumentStyleSection(style));

  // Entities mentioned in this section
  const sectionEntities = plan.entityRoles.filter((role) =>
    section.entityIds.includes(role.entityId)
  );

  if (sectionEntities.length > 0) {
    const entityDetails = sectionEntities.map((role) => {
      const entity = context.entities.find((e) => e.id === role.entityId);
      if (!entity) return `- ${role.entityId} (unknown)`;
      return `- **${entity.name}** (${entity.kind}): ${entity.enrichedDescription || entity.description || 'No description'}`.slice(0, 200);
    });

    sections.push(`# Entities for This Section
${entityDetails.join('\n')}`);
  }

  // Events for this section
  const sectionEvents = context.events.filter((e) =>
    section.eventIds.includes(e.id)
  );

  if (sectionEvents.length > 0) {
    sections.push(`# Events to Reference
${sectionEvents.map((e) => `- ${e.headline}${e.description ? `: ${e.description}` : ''}`).join('\n')}`);
  }

  // Previous sections for flow
  if (previousSections.length > 0) {
    sections.push(`# Previous Sections (for flow)
${previousSections
  .map((ps, i) => `## Section ${i + 1}
${ps.content.slice(0, 300)}${ps.content.length > 300 ? '...' : ''}`)
  .join('\n\n')}`);
  }

  // This section's requirements
  sections.push(`# SECTION ${sectionIndex + 1}: ${section.name}

## Section Purpose (from style)
${section.purpose}

## Section Goal
${section.goal}

## Content Guidance
${section.contentGuidance}

## Target Length
${section.wordCountTarget ? `${section.wordCountTarget} words` : 'Use the outline word count target'}

## Your Task
Write the content for this document section.

Guidelines:
- Achieve the stated section goal
- Write in a style appropriate for the document type
- Reference entities by name using [[Entity Name]] wiki link syntax
- Maintain consistency with previous sections
- Do NOT include the section heading - just the content

Write the section content directly. No meta-commentary or headers.`);

  return sections.join('\n\n');
}

/**
 * Parse section content from LLM response
 */
export function parseSectionResponse(response: string): string {
  // Clean up any markdown artifacts or meta-commentary
  let content = response.trim();

  // Remove any leading "Section X:" headers the LLM might add
  content = content.replace(/^(Section\s+\d+[:\s]*|#{1,3}\s*Section\s+\d+[:\s]*)/i, '');

  // Remove any leading "Here is..." or similar preambles
  content = content.replace(
    /^(Here\s+is|Here's|Below\s+is|The\s+following\s+is)[^.]*\.\s*/i,
    ''
  );

  return content.trim();
}
