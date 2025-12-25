/**
 * Chronicle Plan Generator
 *
 * Step 1 of the pipeline: Generate a story plan from world data.
 * Produces structured StoryPlan with characters, plot, and scenes.
 *
 * See CHRONICLE_DESIGN.md for architecture documentation.
 */

import type {
  StoryPlan,
  StoryScene,
  ChronicleGenerationContext,
  PlanGenerationResult,
  PlotBeat,
  PlotStructure,
  ThreeActPlotStructure,
  FlexiblePlotStructure,
} from './chronicleTypes';
import { isThreeActPlot, isFlexiblePlot } from './chronicleTypes';
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
 * Build the prompt for story plan generation (legacy, no style)
 */
export function buildPlanPromptLegacy(context: ChronicleGenerationContext): string {
  return buildPlanPromptCore(context, undefined);
}

/**
 * Build the prompt for story plan generation with narrative style
 */
export function buildPlanPrompt(
  context: ChronicleGenerationContext,
  style?: NarrativeStyle
): string {
  return buildPlanPromptCore(context, style);
}

/**
 * Core prompt builder that handles both styled and unstyled generation
 */
function buildPlanPromptCore(
  context: ChronicleGenerationContext,
  style?: NarrativeStyle
): string {
  // Check if this is a document-format style
  if (style?.format === 'document' && style.documentConfig) {
    return buildDocumentPlanPrompt(context, style);
  }

  const sections: string[] = [];

  // Apply style transformations if provided
  let styledContext: StyledChronicleContext | undefined;
  if (style) {
    styledContext = applyNarrativeStyle(context, style);
  }

  // World context
  sections.push(`# World Context
World Name: ${context.worldName}
${context.worldDescription ? `Description: ${context.worldDescription}` : ''}
${context.tone ? `Tone: ${context.tone}` : ''}
${context.canonFacts.length > 0 ? `Canon Facts:\n${context.canonFacts.map((f) => `- ${f}`).join('\n')}` : ''}
`);

  // Narrative style overview (if using styled generation)
  if (style) {
    sections.push(`# Narrative Style: ${style.name}
${style.description}

${buildProseDirectivesSection(style)}
`);
  }

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
  } else if (context.targetType === 'relationshipTale' && context.relationship) {
    sections.push(`# Relationship to Feature
Type: ${context.relationship.kind}
Between: ${context.relationship.sourceName} (ID: ${context.relationship.src}) and ${context.relationship.targetName} (ID: ${context.relationship.dst})
${context.relationship.strength ? `Strength: ${context.relationship.strength}` : ''}
${context.relationship.backstory ? `Backstory: ${context.relationship.backstory}` : ''}
`);
  }

  // Entities section - use filtered entities if styled, otherwise prominent
  const entitiesToShow = styledContext
    ? styledContext.filteredEntities.slice(0, 15)
    : context.entities
        .filter((e) => e.prominence === 'mythic' || e.prominence === 'renowned')
        .slice(0, 15);

  if (entitiesToShow.length > 0) {
    const entitySectionTitle = styledContext
      ? '# Available Entities (filtered by style rules)'
      : '# Prominent Entities';

    sections.push(`${entitySectionTitle}
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
  if (styledContext && styledContext.suggestedCast.length > 0) {
    sections.push(`# Suggested Cast Assignments
Based on the style rules, here are suggested role assignments (you may adjust):
${styledContext.suggestedCast
  .map((c) => `- ${c.role}: ${c.entityName} (${c.entityId})`)
  .join('\n')}
`);
  }

  // Character roles (if styled)
  if (style) {
    sections.push(buildRolesSection(style));
  }

  // Key relationships
  const keyRelationships = context.relationships.slice(0, 20);
  if (keyRelationships.length > 0) {
    sections.push(`# Key Relationships
${keyRelationships
  .map((r) => `- ${r.sourceName} (${r.src}) --[${r.kind}]--> ${r.targetName} (${r.dst})`)
  .join('\n')}
`);
  }

  // Events section - use filtered events if styled, otherwise significant
  const eventsToShow = styledContext
    ? styledContext.filteredEvents
    : context.events.filter((e) => e.significance >= 0.5).slice(0, 15);

  if (eventsToShow.length > 0) {
    const eventSectionTitle = styledContext
      ? `# Available Events (filtered by style: significance ${style!.eventRules.significanceRange.min}-${style!.eventRules.significanceRange.max})`
      : '# Significant Events (from simulation)';

    const eventUsageNote = style?.eventRules.usageInstructions || '';

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

  // World data focus sections (if styled)
  if (style) {
    const worldDataSections = buildWorldDataFocusSections(context, style);
    sections.push(...worldDataSections);
  }

  // Scene templates (if styled)
  if (style) {
    sections.push(buildSceneTemplatesSection(style));
  }

  // Build instructions section
  sections.push(buildInstructionsSection(context, style, styledContext));

  return sections.join('\n');
}

/**
 * Build the instructions section with plot schema
 */
function buildInstructionsSection(
  context: ChronicleGenerationContext,
  style?: NarrativeStyle,
  styledContext?: StyledChronicleContext
): string {
  // Word count targets based on style or defaults
  const wordCountRange = style?.pacing?.totalWordCount || {
    min: context.targetType === 'eraChronicle'
      ? 1500
      : context.targetType === 'entityStory'
        ? 1000
        : 800,
    max: context.targetType === 'eraChronicle'
      ? 2500
      : context.targetType === 'entityStory'
        ? 1500
        : 1200,
  };

  const sceneCountRange = style?.pacing?.sceneCount || { min: 3, max: 5 };
  const templateCount = style?.sceneTemplates?.length || 0;
  const minScenes = Math.max(sceneCountRange.min, templateCount);
  const maxScenes = Math.max(sceneCountRange.max, minScenes);

  // Type-specific intro
  const typeDescriptions = {
    eraChronicle: 'a narrative chronicle of this era that foregrounds interactions among key entities and events',
    entityStory: 'a multi-entity narrative anchored on the entry point entity, emphasizing interactions and shared stakes',
    relationshipTale: 'a narrative about this relationship and its broader context, showing how it shapes the entities involved',
  };

  // Plot schema - use style's schema or default three-act
  let plotSchema: string;
  let plotInstructions: string;

  if (style) {
    plotSchema = style.plotStructure.schemaDescription;
    plotInstructions = style.plotStructure.instructions;
  } else {
    plotSchema = `{
    "incitingIncident": {
      "description": "What triggers the story",
      "eventIds": ["event IDs from the data that relate to this"]
    },
    "risingAction": [
      {
        "description": "A beat of rising tension",
        "eventIds": ["related event IDs"]
      }
    ],
    "climax": {
      "description": "The peak moment of conflict/revelation",
      "eventIds": ["related event IDs"]
    },
    "resolution": {
      "description": "How the story concludes",
      "eventIds": ["related event IDs"]
    }
  }`;
    plotInstructions = 'Follow the classic three-act structure with rising tension leading to a climactic moment.';
  }

  // Story elements schema - includes all entity types, not just characters
  // Roles should be appropriate to entity kind
  let storyElementsSchema: string;

  if (style) {
    const roleExamples = style.entityRules.roles
      .slice(0, 4)
      .map((r) => `"${r.role}"`)
      .join(' | ');
    storyElementsSchema = `{
      "entityId": "exact entity ID from the data above",
      "role": ${roleExamples} | or kind-appropriate role (see below),
      "arc": "Brief description of this entity's narrative function in the story"
    }`;
  } else {
    storyElementsSchema = `{
      "entityId": "exact entity ID from the data above",
      "role": "kind-appropriate role (see ROLE GUIDANCE below)",
      "arc": "Brief description of this entity's narrative function in the story"
    }`;
  }

  // Always include role guidance - this is critical for non-character entities
  const roleGuidance = `
ROLE GUIDANCE - Assign roles based on the entity's KIND (shown in the entity data):
- person/npc: "protagonist", "antagonist", "mentor", "ally", "rival", "observer", "catalyst"
- location/settlement: "setting", "destination", "sanctuary", "battleground", "origin", "backdrop"
- faction/organization: "power-broker", "opposition", "ally-faction", "background-force", "authority"
- artifact/item: "macguffin", "tool", "symbol", "catalyst", "prize", "heirloom"
- ability/power: "gift", "curse", "mystery", "weapon", "heritage", "burden"
- event/occurrence: "inciting-incident", "turning-point", "backdrop", "consequence"

IMPORTANT: Do NOT use character-centric roles like "protagonist", "companion", "supporting" for non-person entities.
A faction should be "power-broker" or "opposition", not "companion".
An ability should be "gift" or "burden", not "supporting".
Roles are descriptive only; a single protagonist is not required.`;

  // Scene schema with emotional beats from style or defaults
  let emotionalBeats: string;
  if (style && (style.sceneTemplates?.length || 0) > 0) {
    emotionalBeats = style.sceneTemplates.map((t) => `"${t.emotionalArc}"`).join(' | ');
  } else {
    emotionalBeats = '"tension" | "revelation" | "relief" | "confrontation" | "intimacy" | "loss" | "triumph" | etc.';
  }

  // Build guidelines based on style
  let guidelines: string[] = [
    'Use ONLY entity IDs and event IDs from the data provided above',
    `Create ${minScenes}-${maxScenes} scenes`,
    'Each scene should have a clear purpose (goal) and emotional direction',
    'Incorporate the simulation events as plot drivers - they are what actually happened',
    'Entities should stay true to their described traits and prominence',
    'Include multiple distinct entities and show direct interaction between them',
    'The story should feel like a complete narrative arc, not an encyclopedia entry',
  ];
  if (context.targetType === 'entityStory' && context.entity) {
    guidelines.push(`Ensure the entry point entity (${context.entity.name}) appears in storyElements and at least one scene`);
  }

  if (style) {
    const templateGuidelines = (style.sceneTemplates?.length || 0) > 0
      ? [
        'Use the scene templates provided above as the outline for your scenes',
        'Create one scene per template; add bridging scenes only if needed to reach the target count',
      ]
      : [];
    const dialogueRatio = style.pacing?.dialogueRatio;
    guidelines = [
      `Follow the ${style.plotStructure.type} plot structure`,
      ...templateGuidelines,
      ...guidelines,
      `Target word count: ${wordCountRange.min}-${wordCountRange.max} words`,
      ...(dialogueRatio
        ? [
          `Dialogue ratio: ${(dialogueRatio.min * 100).toFixed(0)}%-${(dialogueRatio.max * 100).toFixed(0)}% of content`,
        ]
        : []),
      ...(style.proseDirectives?.avoid || []).map((a) => `Avoid: ${a}`),
    ];
  }

  return `# Your Task

Create ${typeDescriptions[context.targetType]} (${wordCountRange.min}-${wordCountRange.max} words total).

${style ? `Style: ${style.name}\n${plotInstructions}` : ''}
${roleGuidance}

You must output a JSON object with this structure:

\`\`\`json
{
  "title": "Story title",
  "storyElements": [
    ${storyElementsSchema}
  ],
  "setting": {
    "eraId": "era ID if applicable",
    "locations": ["Location names"],
    "timespan": "How long the story spans (e.g., 'Three days', 'A single night')"
  },
  "plot": ${plotSchema},
  "scenes": [
    {
      "id": "scene_1",
      "title": "Scene title",
      "goal": "What this scene MUST accomplish narratively",
      "entityIds": ["entity IDs of entities in scene"],
      "eventIds": ["event IDs incorporated in scene"],
      "setting": "Where this scene takes place",
      "emotionalBeat": ${emotionalBeats}
    }
  ],
  "theme": "The central theme or message",
  "tone": "The emotional/stylistic tone",
  "keyEventIds": ["All event IDs used in the story"]
}
\`\`\`

Guidelines:
${guidelines.map((g) => `- ${g}`).join('\n')}

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
  } else if (context.targetType === 'relationshipTale' && context.relationship) {
    sections.push(`# Subject: Relationship
Type: ${context.relationship.kind}
Between: ${context.relationship.sourceName} and ${context.relationship.targetName}
${context.relationship.backstory ? `Backstory: ${context.relationship.backstory}` : ''}
`);
  }

  // Relevant entities
  const entitiesToShow = context.entities
    .filter((e) => e.prominence === 'mythic' || e.prominence === 'renowned')
    .slice(0, 10);

  if (entitiesToShow.length > 0) {
    sections.push(`# Available Entities (for reference)
${entitiesToShow
  .map((e) => `- ${e.name} (${e.kind}): ${e.enrichedDescription || e.description || 'No description'}`.slice(0, 200))
  .join('\n')}
`);
  }

  // Relevant events
  const eventsToShow = context.events.filter((e) => e.significance >= 0.5).slice(0, 10);
  if (eventsToShow.length > 0) {
    sections.push(`# Available Events (for reference)
${eventsToShow
  .map((e) => `- [${e.eventKind}] ${e.headline} (significance: ${(e.significance * 100).toFixed(0)}%)`)
  .join('\n')}
`);
  }

  // Document sections specification
  const sectionsList = docConfig.sections.map((s, i) =>
    `${i + 1}. **${s.name}** (${s.wordCountTarget || 100} words${s.optional ? ', optional' : ''})
   Purpose: ${s.purpose}
   Guidance: ${s.contentGuidance}`
  ).join('\n');

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

  // Output instructions - generate a plan that maps to our StoryPlan structure
  // We represent document sections as "scenes" for compatibility with existing pipeline
  sections.push(`# Your Task

Create a structured plan for a ${docConfig.documentType} (${docConfig.wordCount.min}-${docConfig.wordCount.max} words total).

You must output a JSON object with this structure:

\`\`\`json
{
  "title": "Document title",
  "storyElements": [
    {
      "entityId": "entity ID from the data if referenced",
      "role": "subject | source | mentioned | authority",
      "arc": "How this entity is used in the document"
    }
  ],
  "setting": {
    "eraId": "era ID if applicable",
    "locations": ["Location names referenced"],
    "timespan": "When this document was written or what period it covers"
  },
  "plot": {
    "documentPurpose": "What this document aims to accomplish",
    "keyPoints": ["Main points to convey"],
    "eventIds": ["Event IDs to incorporate"]
  },
  "scenes": [
    {
      "id": "section_1",
      "title": "Section heading (from the sections list above)",
      "goal": "What this section must accomplish",
      "entityIds": ["entity IDs mentioned in this section"],
      "eventIds": ["event IDs mentioned in this section"],
      "setting": "",
      "emotionalBeat": "informative | persuasive | cautionary | celebratory | analytical"
    }
  ],
  "theme": "The central message or purpose",
  "tone": "${docConfig.toneKeywords[0] || 'formal'}",
  "keyEventIds": ["All event IDs used in the document"]
}
\`\`\`

Guidelines:
- Create one "scene" for each required section (${docConfig.sections.filter(s => !s.optional).length} required sections)
- Each scene represents a document section, not a narrative scene
- Use entity and event IDs from the data provided
- The plot object describes the document's purpose, not a story arc
- Match the tone and style requirements exactly

Output ONLY the JSON, no other text.`);

  return sections.join('\n');
}

/**
 * Parse LLM response into StoryPlan
 * Handles both legacy three-act plots and style-based flexible plots
 */
export function parsePlanResponse(
  response: string,
  context: ChronicleGenerationContext,
  style?: NarrativeStyle
): StoryPlan {
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

  // Parse plot structure based on whether we have a narrative style
  const plot = parsePlotStructure(parsed.plot, style);

  // Validate and transform
  const plan: StoryPlan = {
    id: `plan_${context.targetId}_${Date.now()}`,
    title: parsed.title || 'Untitled',

    characters: (parsed.storyElements || []).map((c: Record<string, string>) => ({
      entityId: c.entityId,
      role: c.role || 'element',
      arc: c.arc || '',
    })),

    setting: {
      eraId: parsed.setting?.eraId || context.era?.id || '',
      locations: parsed.setting?.locations || [],
      timespan: parsed.setting?.timespan || '',
    },

    plot,

    scenes: (parsed.scenes || []).map(
      (s: Record<string, unknown>, i: number) => ({
        id: (s.id as string) || `scene_${i + 1}`,
        title: (s.title as string) || `Scene ${i + 1}`,
        goal: (s.goal as string) || '',
        characterIds: (s.entityIds as string[]) || [],
        eventIds: (s.eventIds as string[]) || [],
        setting: (s.setting as string) || '',
        emotionalBeat: (s.emotionalBeat as string) || '',
      })
    ),

    theme: parsed.theme || '',
    tone: parsed.tone || '',
    keyEventIds: parsed.keyEventIds || [],

    generatedAt: Date.now(),
  };

  return plan;
}

/**
 * Parse plot structure, handling legacy three-act, flexible styles, and documents
 */
function parsePlotStructure(
  rawPlot: Record<string, unknown> | undefined,
  style?: NarrativeStyle
): PlotStructure {
  if (!rawPlot) {
    // Return empty three-act structure as fallback
    return {
      incitingIncident: { description: '', eventIds: [] },
      risingAction: [],
      climax: { description: '', eventIds: [] },
      resolution: { description: '', eventIds: [] },
    };
  }

  // Check if this is a legacy three-act structure
  if (
    'incitingIncident' in rawPlot &&
    'climax' in rawPlot &&
    'resolution' in rawPlot
  ) {
    return parseThreeActPlot(rawPlot);
  }

  // Check if this is a document structure (has documentPurpose)
  if ('documentPurpose' in rawPlot || style?.format === 'document') {
    return {
      type: 'document',
      raw: rawPlot,
      normalizedBeats: extractDocumentBeats(rawPlot),
    };
  }

  // Otherwise, it's a flexible style-based structure
  const plotType = style?.plotStructure?.type || 'unknown';
  const normalizedBeats = extractNormalizedBeats(rawPlot, plotType);

  return {
    type: plotType,
    raw: rawPlot,
    normalizedBeats,
  };
}

/**
 * Parse legacy three-act plot structure
 */
function parseThreeActPlot(rawPlot: Record<string, unknown>): ThreeActPlotStructure {
  const inciting = rawPlot.incitingIncident as Record<string, unknown> | undefined;
  const rising = rawPlot.risingAction as Array<Record<string, unknown>> | undefined;
  const climax = rawPlot.climax as Record<string, unknown> | undefined;
  const resolution = rawPlot.resolution as Record<string, unknown> | undefined;

  return {
    incitingIncident: {
      description: (inciting?.description as string) || '',
      eventIds: (inciting?.eventIds as string[]) || [],
    },
    risingAction: (rising || []).map((ra) => ({
      description: (ra.description as string) || '',
      eventIds: (ra.eventIds as string[]) || [],
    })),
    climax: {
      description: (climax?.description as string) || '',
      eventIds: (climax?.eventIds as string[]) || [],
    },
    resolution: {
      description: (resolution?.description as string) || '',
      eventIds: (resolution?.eventIds as string[]) || [],
    },
  };
}

/**
 * Extract normalized beats from a document-format plot
 */
function extractDocumentBeats(rawPlot: Record<string, unknown>): PlotBeat[] {
  const beats: PlotBeat[] = [];

  // Document purpose as first beat
  const docPurpose = rawPlot.documentPurpose as string | undefined;
  if (docPurpose) {
    beats.push({ description: `Purpose: ${docPurpose}`, eventIds: [] });
  }

  // Key points as beats
  const keyPoints = rawPlot.keyPoints as string[] | undefined;
  if (keyPoints && Array.isArray(keyPoints)) {
    for (const point of keyPoints) {
      beats.push({ description: point, eventIds: [] });
    }
  }

  // Event IDs
  const eventIds = rawPlot.eventIds as string[] | undefined;
  if (eventIds && eventIds.length > 0 && beats.length > 0) {
    beats[0].eventIds = eventIds;
  }

  return beats;
}

/**
 * Extract normalized beats from any plot structure type
 * This allows scene expansion to work with any plot format
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

/**
 * Validate a story plan against context
 */
export function validatePlan(
  plan: StoryPlan,
  context: ChronicleGenerationContext
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const entityIds = new Set(context.entities.map((e) => e.id));
  const eventIds = new Set(context.events.map((e) => e.id));

  // Check characters reference valid entities
  for (const char of plan.characters) {
    if (!entityIds.has(char.entityId)) {
      issues.push(`Character references unknown entity: ${char.entityId}`);
    }
  }

  // Check scenes reference valid entities and events
  for (const scene of plan.scenes) {
    for (const charId of scene.characterIds) {
      if (!entityIds.has(charId)) {
        issues.push(
          `Scene "${scene.title}" references unknown entity: ${charId}`
        );
      }
    }
    for (const evtId of scene.eventIds) {
      if (!eventIds.has(evtId)) {
        issues.push(
          `Scene "${scene.title}" references unknown event: ${evtId}`
        );
      }
    }
  }

  // Basic structural checks
  if (plan.scenes.length === 0) {
    issues.push('Plan has no scenes');
  }
  if (plan.characters.length === 0) {
    issues.push('Plan has no characters');
  }

  // Check for plot content based on structure type
  if (isThreeActPlot(plan.plot)) {
    if (!plan.plot.climax.description) {
      issues.push('Plan has no climax');
    }
  } else if (isFlexiblePlot(plan.plot)) {
    if (plan.plot.normalizedBeats.length === 0) {
      issues.push('Plan has no plot beats');
    }
  }

  if (context.targetType === 'entityStory' && context.entity) {
    const uniqueEntities = new Set(plan.characters.map((c) => c.entityId));
    if (!uniqueEntities.has(context.entity.id)) {
      issues.push('Plan does not include the entry point entity');
    }
    if (uniqueEntities.size < 2) {
      issues.push('Plan includes fewer than 2 distinct entities');
    }
    const hasInteractionScene = plan.scenes.some(
      (scene) => (scene.characterIds || []).length >= 2
    );
    if (!hasInteractionScene) {
      issues.push('Plan has no scene with multiple entities interacting');
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Generate story plan (to be called by worker or direct API call)
 */
export async function generatePlan(
  context: ChronicleGenerationContext,
  callLLM: (prompt: string) => Promise<string>,
  style?: NarrativeStyle
): Promise<PlanGenerationResult> {
  try {
    const prompt = buildPlanPrompt(context, style);
    const response = await callLLM(prompt);
    const plan = parsePlanResponse(response, context, style);
    const validation = validatePlan(plan, context);

    if (!validation.valid) {
      console.warn('Plan validation issues:', validation.issues);
      // Still return plan, but with warnings
    }

    return {
      success: true,
      plan,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get a summary of the plan for display
 */
export function summarizePlan(plan: StoryPlan): {
  title: string;
  characterCount: number;
  sceneCount: number;
  protagonistName?: string;
  plotSummary: string;
  plotType?: string;
} {
  // Find protagonist-like role (various styles use different role names)
  const protagonistRoles = ['protagonist', 'hero', 'tragic-hero', 'focal-character', 'investigator', 'lover-a', 'schemer'];
  const protagonist = plan.characters.find((c) => protagonistRoles.includes(c.role));

  // Get plot summary based on structure type
  let plotSummary: string;
  let plotType: string | undefined;

  if (isThreeActPlot(plan.plot)) {
    plotSummary = plan.plot.climax.description.slice(0, 100) +
      (plan.plot.climax.description.length > 100 ? '...' : '');
    plotType = 'three-act';
  } else if (isFlexiblePlot(plan.plot)) {
    // Use the last major beat as summary (often the climax/resolution)
    const beats = plan.plot.normalizedBeats;
    const lastBeat = beats[beats.length - 1];
    plotSummary = lastBeat
      ? lastBeat.description.slice(0, 100) + (lastBeat.description.length > 100 ? '...' : '')
      : 'No plot beats';
    plotType = plan.plot.type;
  } else {
    plotSummary = 'Unknown plot structure';
  }

  return {
    title: plan.title,
    characterCount: plan.characters.length,
    sceneCount: plan.scenes.length,
    protagonistName: protagonist?.entityId,
    plotSummary,
    plotType,
  };
}
