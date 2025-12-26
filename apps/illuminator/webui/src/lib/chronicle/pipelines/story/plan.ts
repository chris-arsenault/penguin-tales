import type {
  ChroniclePlan,
  ChronicleGenerationContext,
  ChronicleSection,
  NarrativeFocus,
  StoryOutline,
} from '../../chronicleTypes';
import type { StoryNarrativeStyle } from '@canonry/world-schema';
import type { SelectionContext } from '../../selection';
import { parseJsonResponse } from '../../shared/jsonParsing';
import { buildReferenceLookup, resolveReference } from '../../shared/referenceResolution';
import { parsePlotStructure } from './plot';
import {
  buildWorldDataFocusSections,
  buildProseDirectivesSection,
  buildSceneTemplatesSection,
  buildRolesSection,
} from './promptSections';
import { validateFocus } from '../../pipelineTypes';

const MAX_ENTITY_LIST = 15;

export function buildPlanPrompt(
  context: ChronicleGenerationContext,
  style: StoryNarrativeStyle,
  selection: SelectionContext
): string {
  const sections: string[] = [];

  sections.push(`# World Context
World Name: ${context.worldName}
${context.worldDescription ? `Description: ${context.worldDescription}` : ''}
${context.tone ? `Tone: ${context.tone}` : ''}
${context.canonFacts.length > 0 ? `Canon Facts:\n${context.canonFacts.map((f) => `- ${f}`).join('\n')}` : ''}
`);

  sections.push(`# Narrative Style: ${style.name}
${style.description}

${buildProseDirectivesSection(style)}
`);

  sections.push(`# Entrypoint Entity (must appear in every section)
Name: ${selection.entrypoint.name}
ID: ${selection.entrypoint.id}
Kind: ${selection.entrypoint.kind}${selection.entrypoint.subtype ? ` (${selection.entrypoint.subtype})` : ''}
Prominence: ${selection.entrypoint.prominence}
Culture: ${selection.entrypoint.culture || '(none)'}
Status: ${selection.entrypoint.status}
Tags: ${Object.entries(selection.entrypoint.tags).map(([k, v]) => `${k}=${v}`).join(', ') || '(none)'}
Base Description: ${selection.entrypoint.description || '(none)'}
${selection.entrypoint.enrichedDescription ? `Enriched Description: ${selection.entrypoint.enrichedDescription}` : ''}
`);

  if (selection.requiredNeighbors.length > 0) {
    sections.push(`# Required Neighbor Entities
These entities must appear throughout the narrative alongside the entrypoint:
${selection.requiredNeighbors
  .map(
    (e) => `- ${e.name} (ID: ${e.id}, ${e.kind}${e.subtype ? `/${e.subtype}` : ''})`
  )
  .join('\n')}
`);
  }

  const entitiesToShow = selection.candidateEntities.slice(0, MAX_ENTITY_LIST);
  if (entitiesToShow.length > 0) {
    sections.push(`# Candidate Entities (filtered by style rules)
${entitiesToShow
  .map(
    (e) => `## ${e.name}
- ID: ${e.id}
- Kind: ${e.kind}${e.subtype ? ` (${e.subtype})` : ''}
- Prominence: ${e.prominence}
- Culture: ${e.culture || '(none)'}
- Status: ${e.status}
- Tags: ${Object.entries(e.tags).map(([k, v]) => `${k}=${v}`).join(', ') || '(none)'}
${e.enrichedDescription ? `- Description: ${e.enrichedDescription}` : e.description ? `- Description: ${e.description}` : ''}`
  )
  .join('\n\n')}
`);
  }

  if (selection.suggestedCast.length > 0) {
    sections.push(`# Suggested Cast Assignments
${selection.suggestedCast
  .map((c) => `- ${c.role}: ${c.entityName} (${c.entityId})`)
  .join('\n')}
`);
  }

  sections.push(buildRolesSection(style));

  if (context.relationships.length > 0) {
    const relationships = context.relationships.slice(0, 20);
    sections.push(`# Key Relationships
${relationships
  .map((r) => `- ${r.sourceName} (${r.src}) --[${r.kind}]--> ${r.targetName} (${r.dst})`)
  .join('\n')}
`);
  }

  if (selection.candidateEvents.length > 0) {
    sections.push(`# Candidate Events (filtered by style)
${style.eventRules.usageInstructions ? `Note: ${style.eventRules.usageInstructions}\n` : ''}${selection.candidateEvents
  .map(
    (e) => `## ${e.headline} [significance: ${(e.significance * 100).toFixed(0)}%]
- Event ID: ${e.id}
- Type: ${e.eventKind}
- Tick: ${e.tick}
${e.description ? `- Description: ${e.description}` : ''}
${e.subjectId ? `- Subject: ${e.subjectName} (ID: ${e.subjectId})` : ''}
${e.objectId ? `- Object: ${e.objectName} (ID: ${e.objectId})` : ''}
${e.stateChanges?.length ? `- State Changes: ${e.stateChanges.map((sc) => `${sc.entityName}.${sc.field}: ${sc.previousValue} → ${sc.newValue}`).join(', ')}` : ''}
${e.narrativeTags?.length ? `- Tags: ${e.narrativeTags.join(', ')}` : ''}`
  )
  .join('\n\n')}
`);
  }

  sections.push(...buildWorldDataFocusSections(context, style));
  sections.push(buildSceneTemplatesSection(style));

  const wordCountRange = style.pacing.totalWordCount;
  const sceneCountRange = style.pacing.sceneCount;
  const templateCount = style.sceneTemplates.length;
  const minScenes = Math.max(sceneCountRange.min, templateCount);
  const maxScenes = Math.max(sceneCountRange.max, minScenes);

  const focusSchema = `{
    "mode": "single" | "ensemble",
    "entrypointId": "${selection.entrypoint.id}",
    "primaryEntityIds": ["entity IDs that are the primary focus of the story"],
    "supportingEntityIds": ["entity IDs that support the primary focus"],
    "requiredNeighborIds": ["${selection.requiredNeighborIds.join(', ')}"],
    "selectedEntityIds": ["all entity IDs used in the narrative"],
    "selectedEventIds": ["all event IDs used in the narrative"],
    "notes": "Optional focus notes"
  }`;

  const roleExamples = style.entityRules.roles
    .slice(0, 4)
    .map((r) => `"${r.role}"`)
    .join(' | ');
  const entityRolesSchema = `{
      "entityId": "exact entity ID from the data above",
      "role": ${roleExamples} | or kind-appropriate role,
      "contribution": "How this entity functions in the narrative"
    }`;

  const emotionalArcs = style.sceneTemplates.map((t) => `"${t.emotionalArc}"`).join(' | ');
  const outlineSchema = `{
    "purpose": "Why this story matters",
    "keyPoints": ["3-7 major plot beats or turning points"],
    "era": "Era or timeframe the story is set within",
    "tone": "Tone or voice keywords",
    "theme": "Central thematic statement",
    "emotionalBeats": ["3-7 emotional shifts or beats"],
    "stakes": "Optional stakes at risk",
    "transformation": "Optional transformation or change by the end",
    "intendedImpact": "Optional intended impact on the reader"
  }`;

  sections.push(`# Your Task

Create a multi-entity story (${wordCountRange.min}-${wordCountRange.max} words total).

Focus Requirements:
- The entrypoint entity must appear in every section; it anchors the graph context and does not have to be a primary focus.
- Each section must include at least one required neighbor entity.
- Choose single vs ensemble focus and reflect it in the focus block (single = 1 primary entity, ensemble = 2+ primary entities).

You must output a JSON object with this structure:

\`\`\`json
{
  "title": "Chronicle title",
  "format": "story",
  "focus": ${focusSchema},
  "storyOutline": ${outlineSchema},
  "entityRoles": [
    ${entityRolesSchema}
  ],
  "plot": ${style.plotStructure.schemaDescription},
  "sections": [
    {
      "id": "template_id_or_bridge_1",
      "name": "Section name (use template name or an explicit bridge name)",
      "purpose": "Template purpose from the outline",
      "goal": "What this section MUST accomplish for this chronicle",
      "requiredElements": ["Elements from the template that must appear"],
      "emotionalArc": ${emotionalArcs},
      "wordCountTarget": 400,
      "proseNotes": "Prose guidance from the template",
      "entityIds": ["entity IDs of entities in section"],
      "eventIds": ["event IDs incorporated in section"]
    }
  ]
}
\`\`\`

Guidelines:
- Use ONLY entity IDs and event IDs from the data provided above
- Create ${minScenes}-${maxScenes} sections
- Use the templates provided above as the outline for your sections
- Section ids must match the template ids; use bridge_* ids only if needed to reach the target count
- Incorporate the simulation events as plot drivers
- Maintain the focus requirements in every section
- Ensure the storyOutline anchors purpose, tone, theme, and emotional beats that match the plot
- Target word count: ${wordCountRange.min}-${wordCountRange.max} words
- Dialogue ratio: ${(style.pacing.dialogueRatio.min * 100).toFixed(0)}%-${(style.pacing.dialogueRatio.max * 100).toFixed(0)}%
${style.proseDirectives.avoid.map((a) => `- Avoid: ${a}`).join('\n')}

Output ONLY the JSON, no other text.`);

  return sections.join('\n');
}

export function parsePlanResponse(
  response: string,
  context: ChronicleGenerationContext,
  style: StoryNarrativeStyle,
  selection: SelectionContext
): ChroniclePlan {
  const parsed = parseJsonResponse<Record<string, unknown>>(response);

  if (!parsed.title || typeof parsed.title !== 'string') {
    throw new Error('Plan response missing required field: title');
  }
  if (!parsed.format || typeof parsed.format !== 'string') {
    throw new Error('Plan response missing required field: format');
  }
  if (parsed.format !== style.format) {
    throw new Error(`Plan format "${parsed.format}" does not match narrative style format "${style.format}"`);
  }
  if (!parsed.focus || typeof parsed.focus !== 'object') {
    throw new Error('Plan response missing required field: focus');
  }
  if (!parsed.storyOutline || typeof parsed.storyOutline !== 'object') {
    throw new Error('Plan response missing required field: storyOutline');
  }
  if (!Array.isArray(parsed.entityRoles)) {
    throw new Error('Plan response missing required field: entityRoles');
  }
  if (!Array.isArray(parsed.sections)) {
    throw new Error('Plan response missing required field: sections');
  }
  if (!parsed.plot || typeof parsed.plot !== 'object') {
    throw new Error('Story plans must include plot');
  }

  const focus = parsed.focus as NarrativeFocus;
  if (!focus.mode || !focus.entrypointId || !Array.isArray(focus.selectedEntityIds)) {
    throw new Error('Focus block is missing required fields');
  }

  const outline = parsed.storyOutline as StoryOutline;
  if (
    !outline.purpose ||
    !outline.era ||
    !outline.tone ||
    !outline.theme ||
    typeof outline.purpose !== 'string' ||
    typeof outline.era !== 'string' ||
    typeof outline.tone !== 'string' ||
    typeof outline.theme !== 'string'
  ) {
    throw new Error('Story outline missing required fields');
  }
  if (!Array.isArray(outline.keyPoints) || !Array.isArray(outline.emotionalBeats)) {
    throw new Error('Story outline keyPoints and emotionalBeats must be arrays');
  }
  if (outline.keyPoints.length < 3 || outline.keyPoints.length > 7) {
    throw new Error('Story outline keyPoints must include 3-7 items');
  }
  if (outline.emotionalBeats.length < 3 || outline.emotionalBeats.length > 7) {
    throw new Error('Story outline emotionalBeats must include 3-7 items');
  }
  if (outline.keyPoints.some((point) => typeof point !== 'string')) {
    throw new Error('Story outline keyPoints must be strings');
  }
  if (outline.emotionalBeats.some((beat) => typeof beat !== 'string')) {
    throw new Error('Story outline emotionalBeats must be strings');
  }

  const entityRoles = parsed.entityRoles as Array<Record<string, unknown>>;
  const sections = parsed.sections as Array<Record<string, unknown>>;

  const plot = parsePlotStructure(parsed.plot as Record<string, unknown>, style);

  const entityLookup = buildReferenceLookup(
    selection.candidateEntities,
    (entity) => entity.id,
    (entity) => entity.name
  );
  const eventLookup = buildReferenceLookup(
    selection.candidateEvents,
    (event) => event.id,
    (event) => event.headline
  );
  const resolveEntityId = (value: string) => resolveReference(value, entityLookup);
  const resolveEventId = (value: string) => resolveReference(value, eventLookup);

  const resolvedFocus: NarrativeFocus = {
    ...focus,
    entrypointId: resolveEntityId(focus.entrypointId),
    primaryEntityIds: (focus.primaryEntityIds || []).map(resolveEntityId),
    supportingEntityIds: (focus.supportingEntityIds || []).map(resolveEntityId),
    requiredNeighborIds: (focus.requiredNeighborIds || []).map(resolveEntityId),
    selectedEntityIds: (focus.selectedEntityIds || []).map(resolveEntityId),
    selectedEventIds: (focus.selectedEventIds || []).map(resolveEventId),
    notes: typeof focus.notes === 'string' ? focus.notes : undefined,
  };

  const candidateEntityIds = new Set(selection.candidateEntities.map((e) => e.id));
  const candidateEventIds = new Set(selection.candidateEvents.map((e) => e.id));

  validateFocus(resolvedFocus, {
    entrypointId: selection.entrypoint.id,
    requiredNeighborIds: selection.requiredNeighborIds,
    candidateEntityIds,
    candidateEventIds,
  });

  for (const neighborId of selection.requiredNeighborIds) {
    if (!resolvedFocus.requiredNeighborIds.includes(neighborId)) {
      throw new Error(`Focus must list required neighbor: ${neighborId}`);
    }
  }

  if (resolvedFocus.mode === 'single') {
    if (resolvedFocus.primaryEntityIds.length !== 1) {
      throw new Error('Single focus mode must include exactly one primary entity');
    }
  }

  if (resolvedFocus.mode === 'ensemble') {
    if (resolvedFocus.primaryEntityIds.length < 2) {
      throw new Error('Ensemble focus must include at least two primary entities');
    }
  }

  for (const [index, element] of entityRoles.entries()) {
    if (!element.entityId || !element.role || !element.contribution) {
      throw new Error(`Entity role ${index + 1} is missing entityId, role, or contribution`);
    }
  }

  for (const [index, section] of sections.entries()) {
    if (!section.id || !section.name || !section.purpose || !section.goal) {
      throw new Error(`Section ${index + 1} is missing required fields`);
    }
    if (!Array.isArray(section.entityIds) || !Array.isArray(section.eventIds)) {
      throw new Error(`Section ${index + 1} must include entityIds and eventIds arrays`);
    }
    if (!Array.isArray(section.requiredElements)) {
      throw new Error(`Section ${index + 1} must include requiredElements`);
    }
    if (!section.emotionalArc || typeof section.emotionalArc !== 'string') {
      throw new Error(`Section ${index + 1} must include emotionalArc`);
    }
    if (typeof section.wordCountTarget !== 'number') {
      throw new Error(`Section ${index + 1} must include wordCountTarget`);
    }
    if (!section.proseNotes || typeof section.proseNotes !== 'string') {
      throw new Error(`Section ${index + 1} must include proseNotes`);
    }
  }

  const plan: ChroniclePlan = {
    id: `plan_${context.targetId}_${Date.now()}`,
    title: parsed.title,
    format: 'story',
    focus: resolvedFocus,
    plot,
    storyOutline: {
      purpose: outline.purpose,
      keyPoints: outline.keyPoints,
      era: outline.era,
      tone: outline.tone,
      theme: outline.theme,
      emotionalBeats: outline.emotionalBeats,
      stakes: outline.stakes,
      transformation: outline.transformation,
      intendedImpact: outline.intendedImpact,
    },
    sections: sections.map(
      (s) => ({
        id: s.id as string,
        name: s.name as string,
        purpose: s.purpose as string,
        goal: s.goal as string,
        entityIds: (s.entityIds as string[]).map(resolveEntityId),
        eventIds: (s.eventIds as string[]).map(resolveEventId),
        wordCountTarget: s.wordCountTarget as number,
        requiredElements: s.requiredElements as string[],
        emotionalArc: s.emotionalArc as string,
        proseNotes: s.proseNotes as string,
      })
    ),
    entityRoles: entityRoles.map((c) => ({
      entityId: resolveEntityId(c.entityId as string),
      role: c.role as string,
      contribution: c.contribution as string,
    })),
    generatedAt: Date.now(),
  };

  const sectionEntityIds = new Set<string>();
  for (const section of plan.sections) {
    for (const entityId of section.entityIds) {
      sectionEntityIds.add(entityId);
    }
  }

  for (const role of plan.entityRoles) {
    if (!candidateEntityIds.has(role.entityId)) {
      throw new Error(`Plan references unknown entity: ${role.entityId}`);
    }
  }

  for (const section of plan.sections) {
    if (!section.entityIds.includes(selection.entrypoint.id)) {
      throw new Error(`Section "${section.name}" must include entrypoint entity`);
    }
    const hasNeighbor = section.entityIds.some((id) => id !== selection.entrypoint.id);
    if (!hasNeighbor) {
      throw new Error(`Section "${section.name}" must include at least one neighbor entity`);
    }
    const hasRequiredNeighbor = section.entityIds.some((id) =>
      selection.requiredNeighborIds.includes(id)
    );
    if (!hasRequiredNeighbor) {
      throw new Error(`Section "${section.name}" must include a required neighbor entity`);
    }
    for (const entityId of section.entityIds) {
      if (!resolvedFocus.selectedEntityIds.includes(entityId)) {
        throw new Error(`Section "${section.name}" references entity outside focus: ${entityId}`);
      }
    }
    for (const evtId of section.eventIds) {
      if (!resolvedFocus.selectedEventIds.includes(evtId)) {
        throw new Error(`Section "${section.name}" references event outside focus: ${evtId}`);
      }
    }
  }

  for (const requiredNeighbor of selection.requiredNeighborIds) {
    if (!sectionEntityIds.has(requiredNeighbor)) {
      throw new Error(`Plan does not use required neighbor entity: ${requiredNeighbor}`);
    }
  }

  if (plan.sections.length === 0) {
    throw new Error('Plan contains no sections');
  }
  if (plan.entityRoles.length === 0) {
    throw new Error('Plan contains no entity roles');
  }

  const templateIds = style.sceneTemplates.map((t) => t.id);
  const sectionIds = new Set(plan.sections.map((section) => section.id));
  for (const templateId of templateIds) {
    if (!sectionIds.has(templateId)) {
      throw new Error(`Plan is missing required section template: ${templateId}`);
    }
  }

  const minSections = Math.max(style.pacing.sceneCount.min, style.sceneTemplates.length);
  const maxSections = Math.max(style.pacing.sceneCount.max, minSections);
  if (plan.sections.length < minSections || plan.sections.length > maxSections) {
    throw new Error(`Plan must include ${minSections}-${maxSections} sections`);
  }

  resolvePlotEventIds(plan.plot, resolveEventId);

  return plan;
}

export function resolvePlotEventIds(
  plot: ChroniclePlan['plot'],
  resolveEventId: (value: string) => string
): void {
  if (!plot) return;
  plot.normalizedBeats = plot.normalizedBeats.map((beat) => ({
    ...beat,
    eventIds: beat.eventIds.map(resolveEventId),
  }));

  const raw = plot.raw as Record<string, unknown>;
  if (plot.type === 'three-act') {
    const inciting = raw.inciting_incident as Record<string, unknown> | undefined;
    const rising = raw.rising_action as Array<Record<string, unknown>> | undefined;
    const climax = raw.climax as Record<string, unknown> | undefined;
    const resolution = raw.resolution as Record<string, unknown> | undefined;

    if (inciting && Array.isArray(inciting.eventIds)) {
      inciting.eventIds = inciting.eventIds.map(resolveEventId);
    }
    if (Array.isArray(rising)) {
      raw.rising_action = rising.map((beat) => ({
        ...beat,
        eventIds: Array.isArray(beat.eventIds) ? beat.eventIds.map(resolveEventId) : [],
      }));
    }
    if (climax && Array.isArray(climax.eventIds)) {
      climax.eventIds = climax.eventIds.map(resolveEventId);
    }
    if (resolution && Array.isArray(resolution.eventIds)) {
      resolution.eventIds = resolution.eventIds.map(resolveEventId);
    }
  }
}
