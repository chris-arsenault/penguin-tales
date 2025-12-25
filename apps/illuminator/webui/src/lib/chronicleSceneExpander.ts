/**
 * Chronicle Scene Expander
 *
 * Step 2 of the pipeline: Expand each scene into narrative prose.
 * Each scene receives the full story plan + context for coherence.
 *
 * See CHRONICLE_DESIGN.md for architecture documentation.
 */

import type {
  StoryPlan,
  StoryScene,
  ChronicleGenerationContext,
  SceneExpansionResult,
} from './chronicleTypes';
import { isThreeActPlot, isFlexiblePlot } from './chronicleTypes';
import type { NarrativeStyle } from '@canonry/world-schema';

/**
 * Check if a plan is for a document-format style
 */
function isDocumentPlan(plan: StoryPlan): boolean {
  if (isFlexiblePlot(plan.plot)) {
    return plan.plot.type === 'document' ||
           'documentPurpose' in (plan.plot.raw || {});
  }
  return false;
}

function buildStoryStyleSection(style?: NarrativeStyle): string | null {
  if (!style || style.format === 'document' || !style.proseDirectives) return null;
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

function buildDocumentStyleSection(style?: NarrativeStyle): string | null {
  if (!style || style.format !== 'document' || !style.documentConfig) return null;
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
 * Build prompt for expanding a single scene
 */
export function buildScenePrompt(
  scene: StoryScene,
  sceneIndex: number,
  plan: StoryPlan,
  context: ChronicleGenerationContext,
  previousScenes: { id: string; content: string }[],
  style?: NarrativeStyle
): string {
  // Use document-specific prompt builder if this is a document plan
  if (isDocumentPlan(plan)) {
    return buildDocumentSectionPrompt(scene, sceneIndex, plan, context, previousScenes, style);
  }

  const sections: string[] = [];

  // World context
  sections.push(`# World Context
World: ${context.worldName}
${context.worldDescription ? `Description: ${context.worldDescription}` : ''}
${context.tone ? `Tone: ${context.tone}` : ''}`);

  // Story plan summary
  sections.push(`# Story Overview
Title: "${plan.title}"
Theme: ${plan.theme}
Tone: ${plan.tone}
Timespan: ${plan.setting.timespan}`);

  const styleSection = buildStoryStyleSection(style);
  if (styleSection) {
    sections.push(styleSection);
  }

  // Plot structure for reference - handle different plot types
  const plotSection = buildPlotStructureSection(plan);
  if (plotSection) {
    sections.push(plotSection);
  }

  // Characters in this scene with full context
  const sceneCharacters = plan.characters.filter((c) =>
    scene.characterIds.includes(c.entityId)
  );

  if (sceneCharacters.length > 0) {
    const characterDetails = sceneCharacters.map((char) => {
      const entity = context.entities.find((e) => e.id === char.entityId);
      if (!entity) return `- ${char.entityId} (unknown)`;

      return `## ${entity.name}
- Role: ${char.role}
- Arc: ${char.arc}
- Kind: ${entity.kind}${entity.subtype ? ` (${entity.subtype})` : ''}
- Prominence: ${entity.prominence}
- Culture: ${entity.culture || '(none)'}
- Status: ${entity.status}
${entity.enrichedDescription ? `- Description: ${entity.enrichedDescription}` : entity.description ? `- Description: ${entity.description}` : ''}`;
    });

    sections.push(`# Entities in This Scene
${characterDetails.join('\n\n')}`);
  }

  // Relevant events for this scene
  const sceneEvents = context.events.filter((e) =>
    scene.eventIds.includes(e.id)
  );

  if (sceneEvents.length > 0) {
    sections.push(`# Events to Incorporate
${sceneEvents
  .map(
    (e) => `- ${e.headline}${e.description ? `: ${e.description}` : ''}
  Type: ${e.eventKind}, Significance: ${(e.significance * 100).toFixed(0)}%
  ${e.subjectName ? `Subject: ${e.subjectName}` : ''}${e.objectName ? `, Object: ${e.objectName}` : ''}`
  )
  .join('\n')}`);
  }

  // Relationships between scene entities
  const sceneRelationships = context.relationships.filter(
    (r) =>
      scene.characterIds.includes(r.src) && scene.characterIds.includes(r.dst)
  );

  if (sceneRelationships.length > 0) {
    sections.push(`# Relationships in This Scene
${sceneRelationships
  .map((r) => `- ${r.sourceName} --[${r.kind}]--> ${r.targetName}`)
  .join('\n')}`);
  }

  // Previous scenes for continuity
  if (previousScenes.length > 0) {
    sections.push(`# Previous Scenes (for continuity)
${previousScenes
  .map((ps, i) => `## Scene ${i + 1}
${ps.content.slice(0, 500)}${ps.content.length > 500 ? '...' : ''}`)
  .join('\n\n')}`);
  }

  // This scene's requirements
  sections.push(`# SCENE ${sceneIndex + 1}: ${scene.title}

Setting: ${scene.setting}

## Scene Goal (MUST be achieved)
${scene.goal}

## Emotional Beat
This scene should build toward/express: ${scene.emotionalBeat}

## Your Task
Write 300-500 words of narrative prose for this scene.

Guidelines:
- Achieve the stated scene goal - this is your PRIMARY objective
- Honor the emotional beat (${scene.emotionalBeat})
- Stay true to each entity's established traits and narrative role
- Make the interaction between entities explicit (dialogue, action, influence)
- Incorporate the events listed above as natural plot elements
- Maintain continuity with previous scenes
- Use vivid, immersive prose befitting the world's tone
- Include dialogue where appropriate
- Reference [[Entity Name]] using wiki link syntax when mentioning entities

Write the scene prose directly. Do not include meta-commentary, scene numbers, or headers.`);

  return sections.join('\n\n');
}

/**
 * Build plot structure section based on plot type
 */
function buildPlotStructureSection(plan: StoryPlan): string | null {
  if (isThreeActPlot(plan.plot)) {
    return `# Plot Structure (for narrative arc awareness)
Inciting Incident: ${plan.plot.incitingIncident.description}
Rising Action:
${plan.plot.risingAction.map((ra, i) => `  ${i + 1}. ${ra.description}`).join('\n')}
Climax: ${plan.plot.climax.description}
Resolution: ${plan.plot.resolution.description}`;
  }

  if (isFlexiblePlot(plan.plot)) {
    const beats = plan.plot.normalizedBeats;
    if (beats.length > 0) {
      return `# Plot Structure (${plan.plot.type})
${beats.map((b, i) => `${i + 1}. ${b.description}`).join('\n')}`;
    }
  }

  return null;
}

/**
 * Build prompt for expanding a document section
 */
function buildDocumentSectionPrompt(
  scene: StoryScene,
  sceneIndex: number,
  plan: StoryPlan,
  context: ChronicleGenerationContext,
  previousSections: { id: string; content: string }[],
  style?: NarrativeStyle
): string {
  const sections: string[] = [];

  // World context
  sections.push(`# World Context
World: ${context.worldName}
${context.worldDescription ? `Description: ${context.worldDescription}` : ''}`);

  // Document overview
  const plotRaw = isFlexiblePlot(plan.plot) ? plan.plot.raw : {};
  const docPurpose = (plotRaw as Record<string, unknown>).documentPurpose || plan.theme;
  const keyPoints = (plotRaw as Record<string, unknown>).keyPoints || [];

  sections.push(`# Document Overview
Title: "${plan.title}"
Purpose: ${docPurpose}
Tone: ${plan.tone}
${Array.isArray(keyPoints) && keyPoints.length > 0 ? `Key Points:\n${(keyPoints as string[]).map((p) => `- ${p}`).join('\n')}` : ''}`);

  const docStyleSection = buildDocumentStyleSection(style);
  if (docStyleSection) {
    sections.push(docStyleSection);
  }

  // Entities mentioned in this section
  const sectionEntities = plan.characters.filter((c) =>
    scene.characterIds.includes(c.entityId)
  );

  if (sectionEntities.length > 0) {
    const entityDetails = sectionEntities.map((char) => {
      const entity = context.entities.find((e) => e.id === char.entityId);
      if (!entity) return `- ${char.entityId} (unknown)`;
      return `- **${entity.name}** (${entity.kind}): ${entity.enrichedDescription || entity.description || 'No description'}`.slice(0, 200);
    });

    sections.push(`# Entities for This Section
${entityDetails.join('\n')}`);
  }

  // Events for this section
  const sectionEvents = context.events.filter((e) =>
    scene.eventIds.includes(e.id)
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
  sections.push(`# SECTION ${sceneIndex + 1}: ${scene.title}

## Section Goal
${scene.goal}

## Tone
${scene.emotionalBeat}

## Your Task
Write the content for this document section.

Guidelines:
- Achieve the stated section goal
- Match the tone (${scene.emotionalBeat})
- Write in a style appropriate for the document type
- Reference entities by name using [[Entity Name]] wiki link syntax
- Maintain consistency with previous sections
- Do NOT include the section heading - just the content

Write the section content directly. No meta-commentary or headers.`);

  return sections.join('\n\n');
}

/**
 * Parse scene content from LLM response
 */
export function parseSceneResponse(response: string): string {
  // Clean up any markdown artifacts or meta-commentary
  let content = response.trim();

  // Remove any leading "Scene X:" headers the LLM might add
  content = content.replace(/^(Scene\s+\d+[:\s]*|#{1,3}\s*Scene\s+\d+[:\s]*)/i, '');

  // Remove any leading "Here is..." or similar preambles
  content = content.replace(
    /^(Here\s+is|Here's|Below\s+is|The\s+following\s+is)[^.]*\.\s*/i,
    ''
  );

  return content.trim();
}

/**
 * Expand a single scene with full context
 */
export async function expandScene(
  scene: StoryScene,
  sceneIndex: number,
  plan: StoryPlan,
  context: ChronicleGenerationContext,
  previousScenes: { id: string; content: string }[],
  callLLM: (prompt: string) => Promise<string>,
  style?: NarrativeStyle
): Promise<SceneExpansionResult> {
  try {
    const prompt = buildScenePrompt(
      scene,
      sceneIndex,
      plan,
      context,
      previousScenes,
      style
    );
    const response = await callLLM(prompt);
    const content = parseSceneResponse(response);

    return {
      success: true,
      sceneId: scene.id,
      content,
    };
  } catch (error) {
    return {
      success: false,
      sceneId: scene.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Expand all scenes sequentially (for continuity)
 */
export async function expandAllScenes(
  plan: StoryPlan,
  context: ChronicleGenerationContext,
  callLLM: (prompt: string) => Promise<string>,
  onSceneComplete?: (sceneId: string, content: string, index: number) => void,
  style?: NarrativeStyle
): Promise<{
  success: boolean;
  scenes: { id: string; content: string }[];
  errors: { sceneId: string; error: string }[];
}> {
  const expandedScenes: { id: string; content: string }[] = [];
  const errors: { sceneId: string; error: string }[] = [];

  // Expand scenes sequentially to maintain continuity
  for (let i = 0; i < plan.scenes.length; i++) {
    const scene = plan.scenes[i];
    const result = await expandScene(
      scene,
      i,
      plan,
      context,
      expandedScenes,
      callLLM,
      style
    );

    if (result.success && result.content) {
      expandedScenes.push({ id: scene.id, content: result.content });
      onSceneComplete?.(scene.id, result.content, i);
    } else {
      errors.push({ sceneId: scene.id, error: result.error || 'Unknown error' });
    }
  }

  return {
    success: errors.length === 0,
    scenes: expandedScenes,
    errors,
  };
}

/**
 * Update plan with expanded scene content
 */
export function updatePlanWithSceneContent(
  plan: StoryPlan,
  expandedScenes: { id: string; content: string }[]
): StoryPlan {
  const sceneContentMap = new Map(
    expandedScenes.map((s) => [s.id, s.content])
  );

  return {
    ...plan,
    scenes: plan.scenes.map((scene) => ({
      ...scene,
      generatedContent: sceneContentMap.get(scene.id) || scene.generatedContent,
    })),
  };
}
