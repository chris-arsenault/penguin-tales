import type {
  ChroniclePlan,
  ChronicleGenerationContext,
  ChronicleSection,
  NarrativeFocus,
  DocumentOutline,
} from '../../chronicleTypes';
import type { DocumentNarrativeStyle } from '@canonry/world-schema';
import type { SelectionContext } from '../../selection';
import { parseJsonResponse } from '../../shared/jsonParsing';
import { buildReferenceLookup, resolveReference } from '../../shared/referenceResolution';
import { validateFocus } from '../../pipelineTypes';

const MAX_ENTITY_LIST = 12;

function normalizeSectionId(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

export function buildPlanPrompt(
  context: ChronicleGenerationContext,
  style: DocumentNarrativeStyle,
  selection: SelectionContext
): string {
  const docConfig = style.documentConfig;
  const sections: string[] = [];

  sections.push(`# World Context
World Name: ${context.worldName}
${context.worldDescription ? `Description: ${context.worldDescription}` : ''}
${context.tone ? `Tone: ${context.tone}` : ''}
${context.canonFacts.length > 0 ? `Canon Facts:\n${context.canonFacts.map((f) => `- ${f}`).join('\n')}` : ''}
`);

  sections.push(`# Document Type: ${style.name}
${style.description}

Format: ${docConfig.documentType}
${docConfig.voice ? `Voice: ${docConfig.voice}` : ''}
${docConfig.settingGuidance ? `Setting Guidance: ${docConfig.settingGuidance}` : ''}

Content Instructions:
${docConfig.contentInstructions}

Structure Schema:
${docConfig.structureSchema}
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
These entities must appear throughout the document alongside the entrypoint:
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
    (e) => `- ${e.name} (ID: ${e.id}, ${e.kind}): ${e.enrichedDescription || e.description || 'No description'}`
      .slice(0, 200)
  )
  .join('\n')}
`);
  }

  if (selection.candidateEvents.length > 0) {
    sections.push(`# Candidate Events (filtered by style)
${selection.candidateEvents
  .map(
    (e) => `- [${e.eventKind}] ${e.headline} (ID: ${e.id}, significance: ${(e.significance * 100).toFixed(0)}%)`
  )
  .join('\n')}
`);
  }

  const sectionsList = docConfig.sections
    .map(
      (s, i) =>
        `${i + 1}. **${s.name}** (id: ${s.id}, ${s.wordCountTarget || 100} words${s.optional ? ', optional' : ''})
   Purpose: ${s.purpose}
   Guidance: ${s.contentGuidance}`
    )
    .join('\n');

  sections.push(`# Document Sections
${sectionsList}
`);

  sections.push(`# Style Requirements
Tone: ${docConfig.toneKeywords.join(', ')}
Include: ${docConfig.include.join(', ')}
Avoid: ${docConfig.avoid.join(', ')}
${docConfig.entityUsage ? `Entity Usage: ${docConfig.entityUsage}` : ''}
${docConfig.eventUsage ? `Event Usage: ${docConfig.eventUsage}` : ''}
`);

  if (style.entityRules.roles.length > 0) {
    sections.push(`# Entity Roles
${style.entityRules.roles
  .map((role) => `- ${role.role} (${role.count.min}-${role.count.max}): ${role.description}`)
  .join('\n')}
`);
  }

  const focusSchema = `{
    "mode": "single" | "ensemble",
    "entrypointId": "${selection.entrypoint.id}",
    "primaryEntityIds": ["entity IDs that are the primary focus of the document"],
    "supportingEntityIds": ["entity IDs that support the primary focus"],
    "requiredNeighborIds": ["${selection.requiredNeighborIds.join(', ')}"],
    "selectedEntityIds": ["all entity IDs used in the document"],
    "selectedEventIds": ["all event IDs used in the document"],
    "notes": "Optional focus notes"
  }`;

  const outlineSchema = `{
    "purpose": "Why this document exists",
    "keyPoints": ["3-7 core claims or takeaways"],
    "era": "Era or timeframe the document situates itself within",
    "tone": "Tone or voice keywords",
    "veracity": "Optional truthfulness stance",
    "legitimacy": "Optional authority standing",
    "audience": "Optional intended audience",
    "authorProvenance": "Optional author or provenance",
    "biasAgenda": "Optional bias or agenda",
    "intendedOutcome": "Optional intended outcome"
  }`;
  const roleExamples = style.entityRules.roles.length > 0
    ? style.entityRules.roles.slice(0, 4).map((r) => `"${r.role}"`).join(' | ')
    : '"role"';
  const entityRolesSchema = `{
      "entityId": "entity ID from the data if referenced",
      "role": ${roleExamples} | or kind-appropriate role,
      "contribution": "How this entity is used in the document"
    }`;

  const sectionIdList = docConfig.sections.map((s) => s.id).join(', ');

  sections.push(`# Your Task

Create a structured plan for a ${docConfig.documentType} (${docConfig.wordCount.min}-${docConfig.wordCount.max} words total).

Focus Requirements:
- The entrypoint entity must appear in every section; it anchors the graph context and does not have to be a primary focus.
- Each section must include at least one required neighbor entity.
- Choose single vs ensemble focus and reflect it in the focus block (single = 1 primary entity, ensemble = 2+ primary entities).

Allowed section ids (use EXACT ids, no prefixes): ${sectionIdList}

You must output a JSON object with this structure:

\`\`\`json
{
  "title": "Document title",
  "format": "document",
  "focus": ${focusSchema},
  "documentOutline": ${outlineSchema},
  "entityRoles": [
    ${entityRolesSchema}
  ],
  "sections": [
    {
      "id": "section_id_from_outline",
      "name": "Section heading (must match the sections list above)",
      "purpose": "Purpose from the outline",
      "goal": "What this section must accomplish for this document",
      "contentGuidance": "Guidance from the outline",
      "wordCountTarget": 150,
      "optional": false,
      "entityIds": ["entity IDs mentioned in this section"],
      "eventIds": ["event IDs mentioned in this section"]
    }
  ]
}
\`\`\`

Guidelines:
- Create one section for each required section (${docConfig.sections.filter(s => !s.optional).length} required sections)
- Each section must use the section id and name from the outline above
- Use entity and event IDs from the data provided
- Match the tone and style requirements exactly

Output ONLY the JSON, no other text.`);

  return sections.join('\n');
}

export function parsePlanResponse(
  response: string,
  context: ChronicleGenerationContext,
  style: DocumentNarrativeStyle,
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
  if (!parsed.documentOutline || typeof parsed.documentOutline !== 'object') {
    throw new Error('Plan response missing required field: documentOutline');
  }
  if (!Array.isArray(parsed.entityRoles)) {
    throw new Error('Plan response missing required field: entityRoles');
  }
  if (!Array.isArray(parsed.sections)) {
    throw new Error('Plan response missing required field: sections');
  }

  const focus = parsed.focus as NarrativeFocus;
  if (!focus.mode || !focus.entrypointId || !Array.isArray(focus.selectedEntityIds)) {
    throw new Error('Focus block is missing required fields');
  }

  const outline = parsed.documentOutline as DocumentOutline;
  if (
    !outline.purpose ||
    !outline.era ||
    !outline.tone ||
    typeof outline.purpose !== 'string' ||
    typeof outline.era !== 'string' ||
    typeof outline.tone !== 'string' ||
    !Array.isArray(outline.keyPoints)
  ) {
    throw new Error('Document outline missing required fields');
  }
  if (outline.keyPoints.length < 3 || outline.keyPoints.length > 7) {
    throw new Error('Document outline keyPoints must include 3-7 items');
  }
  if (outline.keyPoints.some((point) => typeof point !== 'string')) {
    throw new Error('Document outline keyPoints must be strings');
  }

  const entityRoles = parsed.entityRoles as Array<Record<string, unknown>>;
  const sections = parsed.sections as Array<Record<string, unknown>>;

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
    if (typeof section.id !== 'string') {
      throw new Error(`Section ${index + 1} id must be a string`);
    }
    if (!Array.isArray(section.entityIds) || !Array.isArray(section.eventIds)) {
      throw new Error(`Section ${index + 1} must include entityIds and eventIds arrays`);
    }
    if (!section.contentGuidance || typeof section.contentGuidance !== 'string') {
      throw new Error(`Section ${index + 1} must include contentGuidance`);
    }
    if (typeof section.wordCountTarget !== 'number') {
      throw new Error(`Section ${index + 1} must include wordCountTarget`);
    }
    if (section.optional !== undefined && typeof section.optional !== 'boolean') {
      throw new Error(`Section ${index + 1} optional must be a boolean`);
    }
  }

  const outlineSections = style.documentConfig.sections;
  const outlineByNormalizedId = new Map(outlineSections.map((s) => [normalizeSectionId(s.id), s]));
  const requiredIds = outlineSections.filter((s) => !s.optional).map((s) => s.id);

  const sectionPlans: ChronicleSection[] = sections.map((s) => {
    const rawId = s.id as string;
    const outlineSection = outlineByNormalizedId.get(normalizeSectionId(rawId));
    if (!outlineSection) {
      throw new Error(`Section "${rawId}" is not defined in the document outline`);
    }

    return {
      id: outlineSection.id,
      name: s.name as string,
      purpose: s.purpose as string,
      goal: s.goal as string,
      entityIds: (s.entityIds as string[]).map(resolveEntityId),
      eventIds: (s.eventIds as string[]).map(resolveEventId),
      wordCountTarget: s.wordCountTarget as number,
      contentGuidance: s.contentGuidance as string,
      optional: s.optional as boolean | undefined,
    };
  });

  const plan: ChroniclePlan = {
    id: `plan_${context.targetId}_${Date.now()}`,
    title: parsed.title,
    format: 'document',
    focus: resolvedFocus,
    documentOutline: {
      purpose: outline.purpose,
      keyPoints: outline.keyPoints,
      era: outline.era,
      tone: outline.tone,
      veracity: outline.veracity,
      legitimacy: outline.legitimacy,
      audience: outline.audience,
      authorProvenance: outline.authorProvenance,
      biasAgenda: outline.biasAgenda,
      intendedOutcome: outline.intendedOutcome,
    },
    sections: sectionPlans,
    entityRoles: entityRoles.map((c) => ({
      entityId: resolveEntityId(c.entityId as string),
      role: c.role as string,
      contribution: c.contribution as string,
    })),
    generatedAt: Date.now(),
  };

  for (const role of plan.entityRoles) {
    if (!candidateEntityIds.has(role.entityId)) {
      throw new Error(`Plan references unknown entity: ${role.entityId}`);
    }
  }

  const sectionEntityIds = new Set<string>();
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
      sectionEntityIds.add(entityId);
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

  for (const requiredId of requiredIds) {
    if (!plan.sections.some((section) => section.id === requiredId)) {
      throw new Error(`Plan is missing required section: ${requiredId}`);
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

  return plan;
}
