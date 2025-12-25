/**
 * Chronicle Plan Generator
 *
 * Step 1 of the pipeline: Generate a chronicle plan from world data.
 * Produces structured ChroniclePlan with entity roles, plot, and sections.
 *
 * See CHRONICLE_DESIGN.md for architecture documentation.
 */

import type {
  ChroniclePlan,
  ChronicleGenerationContext,
  PlotBeat,
  ChroniclePlot,
} from './chronicleTypes';
import type { NarrativeStyle } from '@canonry/world-schema';
import {
  type StyledChronicleContext,
  applyNarrativeStyle,
  buildWorldDataFocusSections,
  buildProseDirectivesSection,
  buildSceneTemplatesSection,
  buildRolesSection,
} from './narrativeStyleTransform';

/**
 * Build the prompt for chronicle plan generation with narrative style
 */
export function buildPlanPrompt(
  context: ChronicleGenerationContext,
  style: NarrativeStyle
): string {
  return buildPlanPromptCore(context, style);
}

/**
 * Core prompt builder that handles narrative style generation
 */
function buildPlanPromptCore(
  context: ChronicleGenerationContext,
  style: NarrativeStyle
): string {
  if (!style) {
    throw new Error('Narrative style is required for plan generation');
  }
  // Check if this is a document-format style
  if (style.format === 'document') {
    if (!style.documentConfig) {
      throw new Error('Document narrative styles must include documentConfig');
    }
    return buildDocumentPlanPrompt(context, style);
  }
  if (!style.plotStructure || !style.entityRules || !style.eventRules || !style.sceneTemplates || !style.pacing || !style.proseDirectives) {
    throw new Error(`Narrative style "${style.name}" is missing required narrative configuration`);
  }

  const sections: string[] = [];

  // Apply style transformations
  const styledContext: StyledChronicleContext = applyNarrativeStyle(context, style);

  // World context
  sections.push(`# World Context
World Name: ${context.worldName}
${context.worldDescription ? `Description: ${context.worldDescription}` : ''}
${context.tone ? `Tone: ${context.tone}` : ''}
${context.canonFacts.length > 0 ? `Canon Facts:\n${context.canonFacts.map((f) => `- ${f}`).join('\n')}` : ''}
`);

  // Narrative style overview
  sections.push(`# Narrative Style: ${style.name}
${style.description}

${buildProseDirectivesSection(style)}
`);

  // Target-specific context
  if (context.targetType === 'eraChronicle' && context.era) {
    sections.push(`# Era to Chronicle
Name: ${context.era.name}
Description: ${context.era.description || '(none)'}
${context.era.summary ? `Summary: ${context.era.summary}` : ''}
`);
  } else if (context.targetType === 'entityStory' && context.entity) {
    sections.push(`# Entry Point Entity (graph anchor)
Name: ${context.entity.name}
ID: ${context.entity.id}
Kind: ${context.entity.kind}${context.entity.subtype ? ` (${context.entity.subtype})` : ''}
Prominence: ${context.entity.prominence}
Culture: ${context.entity.culture || '(none)'}
Status: ${context.entity.status}
Tags: ${Object.entries(context.entity.tags).map(([k, v]) => `${k}=${v}`).join(', ') || '(none)'}
Base Description: ${context.entity.description || '(none)'}
${context.entity.enrichedDescription ? `Enriched Description: ${context.entity.enrichedDescription}` : ''}
Note: This entity must appear, but the narrative should involve multiple entities interacting; no single protagonist is required.
`);
  }

  // Entities section - filtered by style rules
  const entitiesToShow = styledContext.filteredEntities.slice(0, 15);

  if (entitiesToShow.length > 0) {
    sections.push(`# Available Entities (filtered by style rules)
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

  // Suggested cast (if styled)
  if (styledContext.suggestedCast.length > 0) {
    sections.push(`# Suggested Cast Assignments
Based on the style rules, here are suggested role assignments (you may adjust):
${styledContext.suggestedCast
  .map((c) => `- ${c.role}: ${c.entityName} (${c.entityId})`)
  .join('\n')}
`);
  }

  // Character roles (if styled)
  sections.push(buildRolesSection(style));

  // Key relationships
  const keyRelationships = context.relationships.slice(0, 20);
  if (keyRelationships.length > 0) {
    sections.push(`# Key Relationships
${keyRelationships
  .map((r) => `- ${r.sourceName} (${r.src}) --[${r.kind}]--> ${r.targetName} (${r.dst})`)
  .join('\n')}
`);
  }

  // Events section - filtered by style rules
  const eventsToShow = styledContext.filteredEvents;

  if (eventsToShow.length > 0) {
    const eventSectionTitle = `# Available Events (filtered by style: significance ${style.eventRules.significanceRange.min}-${style.eventRules.significanceRange.max})`;

    const eventUsageNote = style.eventRules.usageInstructions;

    sections.push(`${eventSectionTitle}
${eventUsageNote ? `Note: ${eventUsageNote}\n` : ''}
${eventsToShow
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

  // World data focus sections
  const worldDataSections = buildWorldDataFocusSections(context, style);
  sections.push(...worldDataSections);

  // Scene templates
  sections.push(buildSceneTemplatesSection(style));

  // Build instructions section
  sections.push(buildInstructionsSection(context, style));

  return sections.join('\n');
}

/**
 * Build the instructions section with plot schema
 */
function buildInstructionsSection(
  context: ChronicleGenerationContext,
  style: NarrativeStyle
): string {
  if (!style.pacing?.totalWordCount || !style.pacing?.sceneCount) {
    throw new Error(`Narrative style "${style.name}" is missing pacing configuration`);
  }
  if (!style.plotStructure) {
    throw new Error(`Narrative style "${style.name}" is missing plot structure`);
  }
  if (!style.entityRules) {
    throw new Error(`Narrative style "${style.name}" is missing entity rules`);
  }
  if (!style.sceneTemplates || style.sceneTemplates.length === 0) {
    throw new Error(`Narrative style "${style.name}" must define scene templates`);
  }
  if (!style.proseDirectives) {
    throw new Error(`Narrative style "${style.name}" is missing prose directives`);
  }

  // Word count targets based on style configuration
  const wordCountRange = style.pacing.totalWordCount;
  const sceneCountRange = style.pacing.sceneCount;
  const templateCount = style.sceneTemplates.length;
  const minScenes = Math.max(sceneCountRange.min, templateCount);
  const maxScenes = Math.max(sceneCountRange.max, minScenes);

  // Type-specific intro
  const typeDescriptions = {
    eraChronicle: 'a narrative chronicle of this era that foregrounds interactions among key entities and events',
    entityStory: 'a multi-entity narrative anchored on the entry point entity, emphasizing interactions and shared stakes',
  };

  // Plot schema - use style's schema
  const plotSchema = style.plotStructure.schemaDescription;
  const plotInstructions = style.plotStructure.instructions;

  // Entity role schema - includes all entity types, not just characters
  // Roles should be appropriate to entity kind
  const roleExamples = style.entityRules.roles
    .slice(0, 4)
    .map((r) => `"${r.role}"`)
    .join(' | ');
  const entityRolesSchema = `{
      "entityId": "exact entity ID from the data above",
      "role": ${roleExamples} | or kind-appropriate role (see below),
      "contribution": "How this entity functions in the narrative or document"
    }`;

  // Always include role guidance - this is critical for non-character entities
  const roleGuidance = `
ROLE GUIDANCE - Assign roles based on the entity's KIND (shown in the entity data).
Use kind-appropriate roles (e.g., actor, group, institution, artifact, place, force, event) and keep roles descriptive.
Avoid forcing a single protagonist; multiple entities can share influence.`;

  // Section schema with emotional arcs from style templates
  const emotionalArcs = style.sceneTemplates.map((t) => `"${t.emotionalArc}"`).join(' | ');

  // Build guidelines based on style
  const guidelines: string[] = [
    'Use ONLY entity IDs and event IDs from the data provided above',
    `Create ${minScenes}-${maxScenes} sections`,
    'Each section should have a clear purpose and emotional direction',
    'Incorporate the simulation events as plot drivers - they are what actually happened',
    'Entities should stay true to their described traits and prominence',
    'Include multiple distinct entities and show direct interaction between them',
    'The narrative should feel like a complete arc, not an encyclopedia entry',
  ];
  if (context.targetType === 'entityStory' && context.entity) {
    guidelines.push(`Ensure the entry point entity (${context.entity.name}) appears in entityRoles and at least one section`);
  }

  const templateGuidelines = [
    'Use the templates provided above as the outline for your sections',
    'Section ids must match the template ids; use bridge_* ids only if you must add sections to reach the target count',
  ];
  const dialogueRatio = style.pacing.dialogueRatio;
  const styledGuidelines = [
    `Follow the ${style.plotStructure.type} plot structure`,
    ...templateGuidelines,
    ...guidelines,
    `Target word count: ${wordCountRange.min}-${wordCountRange.max} words`,
    ...(dialogueRatio
      ? [
        `Dialogue ratio: ${(dialogueRatio.min * 100).toFixed(0)}%-${(dialogueRatio.max * 100).toFixed(0)}% of content`,
      ]
      : []),
    ...style.proseDirectives.avoid.map((a) => `Avoid: ${a}`),
  ];

  return `# Your Task

Create ${typeDescriptions[context.targetType]} (${wordCountRange.min}-${wordCountRange.max} words total).

Style: ${style.name}
${plotInstructions}
${roleGuidance}

You must output a JSON object with this structure:

\`\`\`json
{
  "title": "Chronicle title",
  "format": "story",
  "entityRoles": [
    ${entityRolesSchema}
  ],
  "plot": ${plotSchema},
  "scope": {
    "timeframe": "Optional timeframe if relevant to the narrative",
    "notes": "Optional scope notes"
  },
  "focus": {
    "actorIds": ["entity IDs for primary actors if relevant"],
    "groupIds": ["entity IDs for groups or institutions if relevant"],
    "conceptIds": ["entity IDs for key concepts if relevant"],
    "powerIds": ["entity IDs for powers/forces if relevant"],
    "eventIds": ["event IDs central to this chronicle"],
    "notes": "Optional focus notes"
  },
  "scope": {
    "timeframe": "Optional timeframe if the document is tied to a period",
    "notes": "Optional scope notes"
  },
  "focus": {
    "actorIds": ["entity IDs for primary actors if relevant"],
    "groupIds": ["entity IDs for groups or institutions if relevant"],
    "conceptIds": ["entity IDs for key concepts if relevant"],
    "powerIds": ["entity IDs for powers/forces if relevant"],
    "eventIds": ["event IDs central to this document"],
    "notes": "Optional focus notes"
  },
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
  ],
  "theme": "Optional theme (omit if not meaningful)",
  "tone": "Optional tone (omit if not meaningful)",
  "keyEventIds": ["All event IDs used in the narrative"]
}
\`\`\`

Guidelines:
${styledGuidelines.map((g) => `- ${g}`).join('\n')}

Output ONLY the JSON, no other text.`;
}

/**
 * Build prompt for document-format styles
 * Documents use sections instead of scenes/plot structure
 */
function buildDocumentPlanPrompt(
  context: ChronicleGenerationContext,
  style: NarrativeStyle
): string {
  const docConfig = style.documentConfig!;
  const sections: string[] = [];

  // World context
  sections.push(`# World Context
World Name: ${context.worldName}
${context.worldDescription ? `Description: ${context.worldDescription}` : ''}
${context.tone ? `Tone: ${context.tone}` : ''}
${context.canonFacts.length > 0 ? `Canon Facts:\n${context.canonFacts.map((f) => `- ${f}`).join('\n')}` : ''}
`);

  // Document type overview
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

  // Target-specific context (what the document is about)
  if (context.targetType === 'eraChronicle' && context.era) {
    sections.push(`# Subject: Era
Name: ${context.era.name}
Description: ${context.era.description || '(none)'}
${context.era.summary ? `Summary: ${context.era.summary}` : ''}
`);
  } else if (context.targetType === 'entityStory' && context.entity) {
    sections.push(`# Subject: Entity
Name: ${context.entity.name}
ID: ${context.entity.id}
Kind: ${context.entity.kind}${context.entity.subtype ? ` (${context.entity.subtype})` : ''}
Prominence: ${context.entity.prominence}
Culture: ${context.entity.culture || '(none)'}
Status: ${context.entity.status}
Tags: ${Object.entries(context.entity.tags).map(([k, v]) => `${k}=${v}`).join(', ') || '(none)'}
Base Description: ${context.entity.description || '(none)'}
${context.entity.enrichedDescription ? `Enriched Description: ${context.entity.enrichedDescription}` : ''}
`);
  }

  // Relevant entities
  const entitiesToShow = context.entities
    .filter((e) => e.prominence === 'mythic' || e.prominence === 'renowned')
    .slice(0, 10);

  if (entitiesToShow.length > 0) {
    sections.push(`# Available Entities (for reference)
${entitiesToShow
  .map(
    (e) =>
      `- ${e.name} (ID: ${e.id}, ${e.kind}): ${e.enrichedDescription || e.description || 'No description'}`
        .slice(0, 200)
  )
  .join('\n')}
`);
  }

  // Relevant events
  const eventsToShow = context.events.filter((e) => e.significance >= 0.5).slice(0, 10);
  if (eventsToShow.length > 0) {
    sections.push(`# Available Events (for reference)
${eventsToShow
  .map(
    (e) =>
      `- [${e.eventKind}] ${e.headline} (ID: ${e.id}, significance: ${(e.significance * 100).toFixed(0)}%)`
  )
  .join('\n')}
`);
  }

  // Document sections specification
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

  // Style guidance
  sections.push(`# Style Requirements
Tone: ${docConfig.toneKeywords.join(', ')}
Include: ${docConfig.include.join(', ')}
Avoid: ${docConfig.avoid.join(', ')}
${docConfig.entityUsage ? `Entity Usage: ${docConfig.entityUsage}` : ''}
${docConfig.eventUsage ? `Event Usage: ${docConfig.eventUsage}` : ''}
`);

  // Output instructions - generate a plan that aligns with the document schema
  const sectionIdList = docConfig.sections.map((s) => s.id).join(', ');

  sections.push(`# Your Task

Create a structured plan for a ${docConfig.documentType} (${docConfig.wordCount.min}-${docConfig.wordCount.max} words total).

Allowed section ids (use EXACT ids, no prefixes): ${sectionIdList}

You must output a JSON object with this structure:

\`\`\`json
{
  "title": "Document title",
  "format": "document",
  "entityRoles": [
    {
      "entityId": "entity ID from the data if referenced",
      "role": "subject | source | mentioned | authority",
      "contribution": "How this entity is used in the document"
    }
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
  ],
  "keyEventIds": ["All event IDs used in the document"]
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

function stripReferenceDecorators(value: string): string {
  return value.replace(/[\[\]]/g, '');
}

function normalizeId(value: string): string {
  return stripReferenceDecorators(value).trim().toLowerCase();
}

function normalizeName(value: string): string {
  return stripReferenceDecorators(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

type ReferenceLookup = {
  ids: Map<string, string>;
  names: Map<string, string | null>;
};

function buildReferenceLookup<T>(
  items: T[],
  getId: (item: T) => string,
  getName: (item: T) => string | undefined
): ReferenceLookup {
  const ids = new Map<string, string>();
  const names = new Map<string, string | null>();

  for (const item of items) {
    const id = getId(item);
    if (id) {
      ids.set(normalizeId(id), id);
    }
    const name = getName(item);
    if (!name) continue;
    const normalized = normalizeName(name);
    if (!names.has(normalized)) {
      names.set(normalized, id);
    } else if (names.get(normalized) !== id) {
      names.set(normalized, null);
    }
  }

  return { ids, names };
}

function resolveReference(value: string, lookup: ReferenceLookup): string {
  const rawValue = String(value);
  const directMatch = lookup.ids.get(normalizeId(rawValue));
  if (directMatch) {
    return directMatch;
  }
  const nameMatch = lookup.names.get(normalizeName(rawValue));
  return nameMatch || rawValue;
}

/**
 * Parse LLM response into ChroniclePlan
 * Handles three-act plots and style-based flexible plots
 */
export function parsePlanResponse(
  response: string,
  context: ChronicleGenerationContext,
  style: NarrativeStyle
): ChroniclePlan {
  if (!style) {
    throw new Error('Narrative style is required to parse a plan');
  }
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = response.trim();

  // Try multiple patterns for markdown code blocks
  // Pattern 1: ```json ... ``` or ``` ... ```
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else if (jsonStr.startsWith('```')) {
    // Fallback: strip leading ``` and trailing ```
    jsonStr = jsonStr.replace(/^```(?:json)?[\s\n]*/, '').replace(/```\s*$/, '').trim();
  }

  // Find the first { and last } to extract just the JSON object
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  // Fix common LLM JSON issues before first parse attempt
  let fixedJson = jsonStr;

  // 1. Remove // comments (LLM sometimes adds these)
  fixedJson = fixedJson.replace(/\/\/[^\n]*/g, '');

  // 2. Trailing commas before ] or }
  fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(fixedJson);
  } catch (firstError) {
    console.warn('[Chronicle] First JSON parse failed, attempting more fixes...');
    console.warn('[Chronicle] Error:', (firstError as Error).message);

    // More aggressive fixes
    // 3. Double commas
    fixedJson = fixedJson.replace(/,\s*,/g, ',');

    // 4. Missing commas between array elements: }\s*{ or ]\s*[
    fixedJson = fixedJson.replace(/}(\s*){/g, '},$1{');
    fixedJson = fixedJson.replace(/](\s*)\[/g, '],$1[');

    // 5. Missing commas after values: "value"\n"next" or "value"\n{ or }\n"
    // Be careful not to break "key": "value" pairs (colon must not precede)
    fixedJson = fixedJson.replace(/"(\s*\n\s*)"/g, '",$1"');
    fixedJson = fixedJson.replace(/"(\s*\n\s*){/g, '",$1{');
    fixedJson = fixedJson.replace(/}(\s*\n\s*)"/g, '},$1"');
    fixedJson = fixedJson.replace(/](\s*\n\s*)"/g, '],$1"');
    fixedJson = fixedJson.replace(/](\s*\n\s*){/g, '],$1{');

    // 6. Clean up any double commas we may have introduced
    fixedJson = fixedJson.replace(/,\s*,/g, ',');
    fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');

    // 7. Try to fix truncated JSON (add missing closing brackets)
    const openBraces = (fixedJson.match(/{/g) || []).length;
    const closeBraces = (fixedJson.match(/}/g) || []).length;
    const openBrackets = (fixedJson.match(/\[/g) || []).length;
    const closeBrackets = (fixedJson.match(/]/g) || []).length;

    // Add missing closing brackets
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      fixedJson += ']';
    }
    for (let i = 0; i < openBraces - closeBraces; i++) {
      fixedJson += '}';
    }

    try {
      parsed = JSON.parse(fixedJson);
      console.log('[Chronicle] JSON parse succeeded after fixes');
    } catch (secondError) {
      // Try one more thing: extract error position and try to fix around it
      const errMsg = (secondError as Error).message;
      const posMatch = errMsg.match(/position (\d+)/);
      if (posMatch) {
        const errorPos = parseInt(posMatch[1], 10);
        console.warn(`[Chronicle] Error at position ${errorPos}, context: "${fixedJson.substring(Math.max(0, errorPos - 50), errorPos + 50)}"`);

        // Try to find and fix the specific issue around that position
        // Often it's a missing comma
        const beforeError = fixedJson.substring(0, errorPos);
        const afterError = fixedJson.substring(errorPos);

        // If the char before is not a comma, colon, {, or [, and char after starts an element
        const lastChar = beforeError.trim().slice(-1);
        const firstChar = afterError.trim()[0];

        if ((lastChar === '"' || lastChar === '}' || lastChar === ']') &&
            (firstChar === '"' || firstChar === '{' || firstChar === '[')) {
          fixedJson = beforeError + ',' + afterError;
          console.log('[Chronicle] Inserted missing comma at error position');

          try {
            parsed = JSON.parse(fixedJson);
            console.log('[Chronicle] JSON parse succeeded after position-specific fix');
          } catch (thirdError) {
            // Give up, log debug info
            console.error('[Chronicle] JSON parse failed even after all fixes');
            console.error('[Chronicle] JSON length:', jsonStr.length);
            console.error('[Chronicle] First 500 chars:', jsonStr.substring(0, 500));
            console.error('[Chronicle] Last 500 chars:', jsonStr.substring(jsonStr.length - 500));
            throw firstError; // Throw original error
          }
        } else {
          // Log helpful debug info
          console.error('[Chronicle] JSON parse failed even after fixes');
          console.error('[Chronicle] JSON length:', jsonStr.length);
          console.error('[Chronicle] First 500 chars:', jsonStr.substring(0, 500));
          console.error('[Chronicle] Last 500 chars:', jsonStr.substring(jsonStr.length - 500));
          throw firstError; // Throw original error
        }
      } else {
        // Log helpful debug info
        console.error('[Chronicle] JSON parse failed even after fixes');
        console.error('[Chronicle] JSON length:', jsonStr.length);
        console.error('[Chronicle] First 500 chars:', jsonStr.substring(0, 500));
        console.error('[Chronicle] Last 500 chars:', jsonStr.substring(jsonStr.length - 500));
        throw firstError; // Throw original error
      }
    }
  }

  if (!parsed.title || typeof parsed.title !== 'string') {
    throw new Error('Plan response missing required field: title');
  }
  if (!parsed.format || typeof parsed.format !== 'string') {
    throw new Error('Plan response missing required field: format');
  }
  if (parsed.format !== style.format) {
    throw new Error(`Plan format "${parsed.format}" does not match narrative style format "${style.format}"`);
  }
  if (!Array.isArray(parsed.entityRoles)) {
    throw new Error('Plan response missing required field: entityRoles');
  }
  if (!Array.isArray(parsed.sections)) {
    throw new Error('Plan response missing required field: sections');
  }
  if (parsed.keyEventIds !== undefined && !Array.isArray(parsed.keyEventIds)) {
    throw new Error('Plan keyEventIds must be an array if provided');
  }

  const entityRoles = parsed.entityRoles as Array<Record<string, unknown>>;
  const sections = parsed.sections as Array<Record<string, unknown>>;
  const keyEventIds = (parsed.keyEventIds as string[]) || [];

  const theme = typeof parsed.theme === 'string' ? parsed.theme : undefined;
  const tone = typeof parsed.tone === 'string' ? parsed.tone : undefined;

  const scopeRaw = parsed.scope as Record<string, unknown> | undefined;
  if (scopeRaw !== undefined && (typeof scopeRaw !== 'object' || scopeRaw === null)) {
    throw new Error('Plan scope must be an object if provided');
  }
  const focusRaw = parsed.focus as Record<string, unknown> | undefined;
  if (focusRaw !== undefined && (typeof focusRaw !== 'object' || focusRaw === null)) {
    throw new Error('Plan focus must be an object if provided');
  }

  let plot: ChroniclePlot | undefined;
  if (parsed.plot && typeof parsed.plot === 'object') {
    plot = parsePlotStructure(parsed.plot as Record<string, unknown>, style);
  } else if (style.format === 'story') {
    throw new Error('Story plans must include plot');
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
    if (style.format === 'story') {
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
    if (style.format === 'document') {
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
  }

  // Validate and transform
  const plan: ChroniclePlan = {
    id: `plan_${context.targetId}_${Date.now()}`,
    title: parsed.title,
    format: parsed.format as 'story' | 'document',

    entityRoles: entityRoles.map((c) => ({
      entityId: c.entityId as string,
      role: c.role as string,
      contribution: c.contribution as string,
    })),

    sections: sections.map(
      (s) => ({
        id: s.id as string,
        name: s.name as string,
        purpose: s.purpose as string,
        goal: s.goal as string,
        entityIds: s.entityIds as string[],
        eventIds: s.eventIds as string[],
        wordCountTarget: s.wordCountTarget as number,
        requiredElements: (s.requiredElements as string[]) || undefined,
        emotionalArc: (s.emotionalArc as string) || undefined,
        proseNotes: (s.proseNotes as string) || undefined,
        contentGuidance: (s.contentGuidance as string) || undefined,
        optional: s.optional as boolean | undefined,
      })
    ),

    scope: scopeRaw
      ? {
        timeframe: typeof scopeRaw.timeframe === 'string' ? (scopeRaw.timeframe as string) : undefined,
        notes: typeof scopeRaw.notes === 'string' ? (scopeRaw.notes as string) : undefined,
      }
      : undefined,
    focus: focusRaw
      ? {
        actorIds: Array.isArray(focusRaw.actorIds) ? (focusRaw.actorIds as string[]) : undefined,
        groupIds: Array.isArray(focusRaw.groupIds) ? (focusRaw.groupIds as string[]) : undefined,
        conceptIds: Array.isArray(focusRaw.conceptIds) ? (focusRaw.conceptIds as string[]) : undefined,
        powerIds: Array.isArray(focusRaw.powerIds) ? (focusRaw.powerIds as string[]) : undefined,
        eventIds: Array.isArray(focusRaw.eventIds) ? (focusRaw.eventIds as string[]) : undefined,
        notes: typeof focusRaw.notes === 'string' ? (focusRaw.notes as string) : undefined,
      }
      : undefined,
    plot,
    theme,
    tone,
    keyEventIds,

    generatedAt: Date.now(),
  };

  const entityLookup = buildReferenceLookup(
    context.entities,
    (entity) => entity.id,
    (entity) => entity.name
  );
  const eventLookup = buildReferenceLookup(
    context.events,
    (event) => event.id,
    (event) => event.headline
  );
  const resolveEntityId = (value: string) => resolveReference(value, entityLookup);
  const resolveEventId = (value: string) => resolveReference(value, eventLookup);

  plan.entityRoles = plan.entityRoles.map((role) => ({
    ...role,
    entityId: resolveEntityId(role.entityId),
  }));
  plan.sections = plan.sections.map((section) => ({
    ...section,
    entityIds: section.entityIds.map(resolveEntityId),
    eventIds: section.eventIds.map(resolveEventId),
  }));
  if (plan.focus) {
    plan.focus = {
      ...plan.focus,
      actorIds: plan.focus.actorIds?.map(resolveEntityId),
      groupIds: plan.focus.groupIds?.map(resolveEntityId),
      conceptIds: plan.focus.conceptIds?.map(resolveEntityId),
      powerIds: plan.focus.powerIds?.map(resolveEntityId),
      eventIds: plan.focus.eventIds?.map(resolveEventId),
    };
  }
  plan.keyEventIds = plan.keyEventIds.map(resolveEventId);
  if (plan.plot) {
    resolvePlotEventIds(plan.plot, resolveEventId);
  }

  const contextEntityIds = new Set(context.entities.map((e) => e.id));
  const contextEventIds = new Set(context.events.map((e) => e.id));

  if (plan.sections.length === 0) {
    throw new Error('Plan contains no sections');
  }
  if (plan.entityRoles.length === 0) {
    throw new Error('Plan contains no entity roles');
  }

  for (const role of plan.entityRoles) {
    if (!contextEntityIds.has(role.entityId)) {
      throw new Error(`Plan references unknown entity: ${role.entityId}`);
    }
  }

  for (const section of plan.sections) {
    for (const entityId of section.entityIds) {
      if (!contextEntityIds.has(entityId)) {
        throw new Error(`Section "${section.name}" references unknown entity: ${entityId}`);
      }
    }
    for (const evtId of section.eventIds) {
      if (!contextEventIds.has(evtId)) {
        throw new Error(`Section "${section.name}" references unknown event: ${evtId}`);
      }
    }
  }

  if (style.format === 'document') {
    if (!style.documentConfig) {
      throw new Error('Document narrative styles must include documentConfig');
    }
    const outline = style.documentConfig.sections;
    const outlineById = new Map(outline.map((s) => [s.id, s]));
    const requiredIds = outline.filter((s) => !s.optional).map((s) => s.id);

    for (const section of plan.sections) {
      const outlineSection = outlineById.get(section.id);
      if (!outlineSection) {
        throw new Error(`Section "${section.id}" is not defined in the document outline`);
      }
      if (section.name !== outlineSection.name) {
        console.warn(
          `[Chronicle] Section "${section.id}" name "${section.name}" did not match outline "${outlineSection.name}". Aligning to outline.`
        );
        section.name = outlineSection.name;
      }
      if (section.purpose !== outlineSection.purpose) {
        section.purpose = outlineSection.purpose;
      }
      if (section.contentGuidance !== outlineSection.contentGuidance) {
        section.contentGuidance = outlineSection.contentGuidance;
      }
      if (outlineSection.wordCountTarget) {
        section.wordCountTarget = outlineSection.wordCountTarget;
      }
      section.optional = outlineSection.optional;
    }
    for (const requiredId of requiredIds) {
      if (!plan.sections.some((section) => section.id === requiredId)) {
        throw new Error(`Plan is missing required section: ${requiredId}`);
      }
    }
  }

  if (style.format === 'story') {
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
  }

  if (context.targetType === 'entityStory' && context.entity) {
    const uniqueEntities = new Set(plan.entityRoles.map((c) => c.entityId));
    if (!uniqueEntities.has(context.entity.id)) {
      throw new Error('Plan does not include the entry point entity');
    }
    if (uniqueEntities.size < 2) {
      throw new Error('Plan must include at least two distinct entities');
    }
    const hasInteractionSection = plan.sections.some((section) => section.entityIds.length >= 2);
    if (!hasInteractionSection) {
      throw new Error('Plan must include at least one section with multiple entities interacting');
    }
  }

  return plan;
}

function resolvePlotEventIds(
  plot: ChroniclePlot,
  resolveEventId: (value: string) => string
): void {
  plot.normalizedBeats = plot.normalizedBeats.map((beat) => ({
    ...beat,
    eventIds: beat.eventIds.map(resolveEventId),
  }));

  if (plot.type === 'document') {
    const raw = plot.raw as Record<string, unknown>;
    if (Array.isArray(raw.eventIds)) {
      raw.eventIds = raw.eventIds.map(resolveEventId);
    }
    return;
  }

  if (plot.type === 'three-act') {
    const raw = plot.raw as Record<string, unknown>;
    const inciting = raw.incitingIncident as Record<string, unknown> | undefined;
    const rising = raw.risingAction as Array<Record<string, unknown>> | undefined;
    const climax = raw.climax as Record<string, unknown> | undefined;
    const resolution = raw.resolution as Record<string, unknown> | undefined;

    if (inciting && Array.isArray(inciting.eventIds)) {
      inciting.eventIds = inciting.eventIds.map(resolveEventId);
    }
    if (Array.isArray(rising)) {
      raw.risingAction = rising.map((beat) => ({
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

/**
 * Parse plot structure based on the active narrative style
 */
function parsePlotStructure(
  rawPlot: Record<string, unknown>,
  style: NarrativeStyle
): ChroniclePlot {
  if (style.format === 'document') {
    return {
      type: 'document',
      raw: rawPlot,
      normalizedBeats: extractDocumentBeats(rawPlot),
    };
  }

  if (!style.plotStructure) {
    throw new Error(`Narrative style "${style.name}" is missing plot structure`);
  }

  const plotType = style.plotStructure.type;
  if (plotType === 'three-act') {
    validateThreeActPlot(rawPlot);
  }
  const normalizedBeats = extractNormalizedBeats(rawPlot, plotType);

  return {
    type: plotType,
    raw: rawPlot,
    normalizedBeats,
  };
}

/**
 * Parse three-act plot structure
 */
function validateThreeActPlot(rawPlot: Record<string, unknown>): void {
  const inciting = rawPlot.incitingIncident as Record<string, unknown> | undefined;
  const rising = rawPlot.risingAction as Array<Record<string, unknown>> | undefined;
  const climax = rawPlot.climax as Record<string, unknown> | undefined;
  const resolution = rawPlot.resolution as Record<string, unknown> | undefined;

  if (!inciting || !climax || !resolution) {
    throw new Error('Three-act plot is missing required sections');
  }

  const validateBeat = (beat: Record<string, unknown>, label: string) => {
    if (typeof beat.description !== 'string') {
      throw new Error(`Three-act plot ${label} is missing description`);
    }
    if (!Array.isArray(beat.eventIds)) {
      throw new Error(`Three-act plot ${label} is missing eventIds`);
    }
  };

  validateBeat(inciting, 'incitingIncident');
  validateBeat(climax, 'climax');
  validateBeat(resolution, 'resolution');

  if (rising && !Array.isArray(rising)) {
    throw new Error('Three-act plot risingAction must be an array');
  }
  if (Array.isArray(rising)) {
    rising.forEach((beat, index) => {
      if (typeof beat.description !== 'string') {
        throw new Error(`Three-act plot risingAction[${index}] is missing description`);
      }
      if (!Array.isArray(beat.eventIds)) {
        throw new Error(`Three-act plot risingAction[${index}] is missing eventIds`);
      }
    });
  }
}

/**
 * Extract normalized beats from a document-format plot
 */
function extractDocumentBeats(rawPlot: Record<string, unknown>): PlotBeat[] {
  const beats: PlotBeat[] = [];

  // Document purpose as first beat
  const docPurpose = rawPlot.documentPurpose as string;
  if (!docPurpose) {
    throw new Error('Document plot is missing documentPurpose');
  }
  beats.push({ description: `Purpose: ${docPurpose}`, eventIds: [] });

  // Key points as beats
  const keyPoints = rawPlot.keyPoints as string[];
  if (!Array.isArray(keyPoints)) {
    throw new Error('Document plot is missing keyPoints');
  }
  for (const point of keyPoints) {
    beats.push({ description: point, eventIds: [] });
  }

  // Event IDs
  const eventIds = rawPlot.eventIds as string[];
  if (!Array.isArray(eventIds)) {
    throw new Error('Document plot is missing eventIds');
  }
  if (eventIds.length > 0 && beats.length > 0) {
    beats[0].eventIds = eventIds;
  }

  return beats;
}

/**
 * Extract normalized beats from any plot structure type
 * This allows section expansion to work with any plot format
 */
function extractNormalizedBeats(
  rawPlot: Record<string, unknown>,
  plotType: string
): PlotBeat[] {
  const beats: PlotBeat[] = [];

  // Extract beats based on plot type
  switch (plotType) {
    case 'three-act':
      // Standard three-act extraction
      addBeatIfPresent(beats, rawPlot.inciting_incident || rawPlot.incitingIncident);
      addBeatsFromArray(beats, rawPlot.rising_action || rawPlot.risingAction);
      addBeatIfPresent(beats, rawPlot.dark_moment);
      addBeatIfPresent(beats, rawPlot.climax);
      addBeatIfPresent(beats, rawPlot.resolution);
      break;

    case 'episodic':
      // Vignettes are beats
      addBeatIfPresent(beats, { description: rawPlot.setting_the_day as string });
      const vignettes = rawPlot.vignettes as Array<Record<string, unknown>> | undefined;
      if (vignettes) {
        for (const v of vignettes) {
          beats.push({
            description: `${v.moment || ''} - ${v.insight || ''}`,
            eventIds: [],
          });
        }
      }
      addBeatIfPresent(beats, { description: rawPlot.closing_reflection as string });
      break;

    case 'mystery-reveal':
      addBeatIfPresent(beats, rawPlot.initial_situation);
      const investigation = rawPlot.investigation as Array<Record<string, unknown>> | undefined;
      if (investigation) {
        for (const clue of investigation) {
          beats.push({
            description: `Clue: ${clue.clue || ''} (${clue.significance || ''})`,
            eventIds: (clue.eventIds as string[]) || [],
          });
        }
      }
      addBeatIfPresent(beats, rawPlot.false_trail);
      addBeatIfPresent(beats, rawPlot.true_revelation);
      break;

    case 'rise-and-fall':
      addBeatIfPresent(beats, { description: rawPlot.initial_greatness as string });
      addBeatIfPresent(beats, { description: `The flaw: ${rawPlot.the_flaw || ''}` });
      addBeatsFromArray(beats, rawPlot.rise);
      addBeatIfPresent(beats, rawPlot.hubris_moment);
      addBeatsFromArray(beats, rawPlot.fall);
      addBeatIfPresent(beats, { description: rawPlot.recognition as string });
      addBeatIfPresent(beats, rawPlot.catastrophe);
      break;

    case 'circular':
      addBeatIfPresent(beats, { description: rawPlot.opening_image as string });
      addBeatsFromArray(beats, rawPlot.wandering);
      addBeatIfPresent(beats, { description: rawPlot.accumulating_meaning as string });
      addBeatIfPresent(beats, rawPlot.return);
      break;

    case 'parallel':
      addBeatIfPresent(beats, { description: rawPlot.surface_situation as string });
      addBeatIfPresent(beats, { description: rawPlot.hidden_situation as string });
      addBeatsFromArray(beats, rawPlot.thread_a);
      addBeatsFromArray(beats, rawPlot.thread_b);
      addBeatIfPresent(beats, rawPlot.convergence);
      addBeatIfPresent(beats, rawPlot.new_equilibrium);
      break;

    case 'in-medias-res':
      addBeatIfPresent(beats, rawPlot.opening_action);
      addBeatIfPresent(beats, { description: rawPlot.brief_context as string });
      addBeatsFromArray(beats, rawPlot.escalating_obstacles);
      addBeatIfPresent(beats, { description: rawPlot.false_victory_or_defeat as string });
      addBeatIfPresent(beats, rawPlot.final_confrontation);
      addBeatIfPresent(beats, rawPlot.escape_or_triumph);
      break;

    case 'accumulating':
      addBeatIfPresent(beats, rawPlot.initial_problem);
      const escalations = rawPlot.escalations as Array<Record<string, unknown>> | undefined;
      if (escalations) {
        for (const e of escalations) {
          beats.push({
            description: `Attempt: ${e.attempt || ''} → Result: ${e.result || ''}`,
            eventIds: (e.eventIds as string[]) || [],
          });
        }
      }
      addBeatIfPresent(beats, { description: rawPlot.point_of_no_return as string });
      addBeatIfPresent(beats, rawPlot.catastrophic_resolution);
      break;

    default:
      // Generic extraction: look for common patterns
      for (const [key, value] of Object.entries(rawPlot)) {
        if (Array.isArray(value)) {
          addBeatsFromArray(beats, value);
        } else if (typeof value === 'object' && value !== null) {
          addBeatIfPresent(beats, value as Record<string, unknown>);
        } else if (typeof value === 'string' && value.length > 10) {
          beats.push({ description: `${key}: ${value}`, eventIds: [] });
        }
      }
  }

  return beats;
}

/**
 * Helper to add a beat if present
 */
function addBeatIfPresent(
  beats: PlotBeat[],
  value: Record<string, unknown> | undefined | null
): void {
  if (!value) return;

  if (typeof value === 'object' && value.description) {
    beats.push({
      description: value.description as string,
      eventIds: (value.eventIds as string[]) || [],
    });
  }
}

/**
 * Helper to add beats from an array
 */
function addBeatsFromArray(
  beats: PlotBeat[],
  value: unknown
): void {
  if (!Array.isArray(value)) return;

  for (const item of value) {
    if (typeof item === 'object' && item !== null) {
      addBeatIfPresent(beats, item as Record<string, unknown>);
    }
  }
}

