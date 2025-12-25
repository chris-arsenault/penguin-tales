/**
 * Narrative Style Transform
 *
 * Applies NarrativeStyle rules to transform ChronicleGenerationContext.
 * Filters entities, events, and prepares context based on style configuration.
 */

import type {
  ChronicleGenerationContext,
  EntityContext,
  NarrativeEventContext,
} from './chronicleTypes';
import type {
  NarrativeStyle,
  EntitySelectionRules,
  EventSelectionRules,
} from '@canonry/world-schema';

/**
 * Transformed context with style-filtered data and style metadata
 */
export interface StyledChronicleContext extends ChronicleGenerationContext {
  /** The applied narrative style */
  appliedStyle: NarrativeStyle;
  /** Filtered entities based on style rules */
  filteredEntities: EntityContext[];
  /** Filtered events based on style rules */
  filteredEvents: NarrativeEventContext[];
  /** Suggested cast assignments */
  suggestedCast: CastAssignment[];
}

export interface CastAssignment {
  role: string;
  entityId: string;
  entityName: string;
  score: number;
}

type Prominence = 'mythic' | 'renowned' | 'recognized' | 'marginal' | 'forgotten';

/**
 * Check if an entity matches prominence filter
 */
function matchesProminenceFilter(
  entity: EntityContext,
  rules: EntitySelectionRules
): boolean {
  const prominence = entity.prominence as Prominence;
  return rules.prominenceFilter.include.includes(prominence);
}

/**
 * Check if an entity matches kind filter
 */
function matchesKindFilter(
  entity: EntityContext,
  rules: EntitySelectionRules
): boolean {
  if (!rules.kindFilter) return true;

  const { include, exclude } = rules.kindFilter;

  if (exclude && exclude.includes(entity.kind)) {
    return false;
  }

  if (include && include.length > 0) {
    return include.includes(entity.kind);
  }

  return true;
}

/**
 * Check if an entity meets relationship requirements
 */
function meetsRelationshipRequirements(
  entity: EntityContext,
  relationships: ChronicleGenerationContext['relationships'],
  rules: EntitySelectionRules
): boolean {
  if (!rules.relationshipRequirements) return true;

  const { protagonistMustHave, minConnections } = rules.relationshipRequirements;

  // Count connections
  const connectionCount = relationships.filter(
    (r) => r.src === entity.id || r.dst === entity.id
  ).length;

  if (minConnections !== undefined && connectionCount < minConnections) {
    return false;
  }

  // Check for required relationship kinds
  if (protagonistMustHave && protagonistMustHave.length > 0) {
    const entityRelKinds = new Set(
      relationships
        .filter((r) => r.src === entity.id || r.dst === entity.id)
        .map((r) => r.kind)
    );
    const hasRequired = protagonistMustHave.some((kind) => entityRelKinds.has(kind));
    if (!hasRequired) {
      return false;
    }
  }

  return true;
}

/**
 * Filter entities based on style rules
 */
export function filterEntities(
  context: ChronicleGenerationContext,
  rules: EntitySelectionRules
): EntityContext[] {
  return context.entities.filter((entity) => {
    // Skip era entities
    if (entity.kind === 'era') return false;

    // Apply filters
    if (!matchesProminenceFilter(entity, rules)) return false;
    if (!matchesKindFilter(entity, rules)) return false;

    return true;
  });
}

/**
 * Score an entity for a particular role
 */
function scoreEntityForRole(
  entity: EntityContext,
  role: string,
  rules: EntitySelectionRules,
  relationships: ChronicleGenerationContext['relationships']
): number {
  let score = 0;

  // Base score from prominence
  const prominenceScores: Record<string, number> = {
    mythic: 100,
    renowned: 75,
    recognized: 50,
    marginal: 25,
    forgotten: 10,
  };
  score += prominenceScores[entity.prominence] || 0;

  // Bonus for protagonist preference
  if (
    role === 'protagonist' ||
    role === 'hero' ||
    role === 'tragic-hero' ||
    role === 'lover-a' ||
    role === 'focal-character' ||
    role === 'investigator' ||
    role === 'consciousness' ||
    role === 'schemer'
  ) {
    const prefs = rules.prominenceFilter.protagonistPreference;
    if (prefs && prefs.includes(entity.prominence as Prominence)) {
      score += 30;
    }

    // Protagonist kind preference
    if (rules.kindFilter?.protagonistKinds?.includes(entity.kind)) {
      score += 25;
    }
  }

  // Bonus for relationship density (good for schemers, political characters)
  if (role === 'schemer' || role === 'protagonist' || role === 'hero') {
    const connectionCount = relationships.filter(
      (r) => r.src === entity.id || r.dst === entity.id
    ).length;
    score += connectionCount * 5;
  }

  // Bonus for enriched description (better characterized)
  if (entity.enrichedDescription) {
    score += 15;
  }

  return score;
}

/**
 * Suggest cast assignments based on style roles
 */
export function suggestCast(
  entities: EntityContext[],
  rules: EntitySelectionRules,
  relationships: ChronicleGenerationContext['relationships']
): CastAssignment[] {
  const assignments: CastAssignment[] = [];
  const usedEntityIds = new Set<string>();

  // Score all entities for all roles
  const roleScores: Map<string, Array<{ entity: EntityContext; score: number }>> =
    new Map();

  for (const roleDef of rules.roles) {
    const scores: Array<{ entity: EntityContext; score: number }> = [];
    for (const entity of entities) {
      const score = scoreEntityForRole(entity, roleDef.role, rules, relationships);
      if (score > 0) {
        scores.push({ entity, score });
      }
    }
    scores.sort((a, b) => b.score - a.score);
    roleScores.set(roleDef.role, scores);
  }

  // Assign entities to roles greedily (higher priority roles first)
  for (const roleDef of rules.roles) {
    const scores = roleScores.get(roleDef.role) || [];
    let assigned = 0;

    for (const { entity, score } of scores) {
      if (assigned >= roleDef.count.max) break;
      if (usedEntityIds.has(entity.id)) continue;

      assignments.push({
        role: roleDef.role,
        entityId: entity.id,
        entityName: entity.name,
        score,
      });
      usedEntityIds.add(entity.id);
      assigned++;
    }
  }

  return assignments;
}

/**
 * Check if an event matches significance range
 */
function matchesSignificanceRange(
  event: NarrativeEventContext,
  rules: EventSelectionRules
): boolean {
  const { min, max } = rules.significanceRange;
  return event.significance >= min && event.significance <= max;
}

/**
 * Check if an event matches kind filters
 */
function matchesEventKindFilter(
  event: NarrativeEventContext,
  rules: EventSelectionRules
): boolean {
  if (rules.excludeKinds?.includes(event.eventKind)) {
    return false;
  }
  return true;
}

/**
 * Score an event for inclusion
 */
function scoreEvent(event: NarrativeEventContext, rules: EventSelectionRules): number {
  let score = event.significance * 100;

  // Bonus for priority kinds
  if (rules.priorityKinds?.includes(event.eventKind)) {
    score += 30;
  }

  // Bonus for priority tags
  if (rules.priorityTags && event.narrativeTags) {
    const matchingTags = event.narrativeTags.filter((tag) =>
      rules.priorityTags!.includes(tag)
    );
    score += matchingTags.length * 15;
  }

  return score;
}

/**
 * Filter and score events based on style rules
 */
export function filterEvents(
  context: ChronicleGenerationContext,
  rules: EventSelectionRules
): NarrativeEventContext[] {
  // Filter events
  const filtered = context.events.filter((event) => {
    if (!matchesSignificanceRange(event, rules)) return false;
    if (!matchesEventKindFilter(event, rules)) return false;
    return true;
  });

  // Score and sort
  const scored = filtered.map((event) => ({
    event,
    score: scoreEvent(event, rules),
  }));
  scored.sort((a, b) => b.score - a.score);

  // Limit to max events
  return scored.slice(0, rules.maxEvents).map((s) => s.event);
}

/**
 * Apply a narrative style to transform the generation context
 */
export function applyNarrativeStyle(
  context: ChronicleGenerationContext,
  style: NarrativeStyle
): StyledChronicleContext {
  // Filter entities based on style rules
  const filteredEntities = filterEntities(context, style.entityRules);

  // Filter events based on style rules
  const filteredEvents = filterEvents(context, style.eventRules);

  // Suggest cast assignments
  const suggestedCast = suggestCast(
    filteredEntities,
    style.entityRules,
    context.relationships
  );

  return {
    ...context,
    appliedStyle: style,
    filteredEntities,
    filteredEvents,
    suggestedCast,
  };
}

/**
 * Build prompt sections for world data focus
 */
export function buildWorldDataFocusSections(
  context: ChronicleGenerationContext,
  style: NarrativeStyle
): string[] {
  const sections: string[] = [];
  const focus = style.worldDataFocus;

  if (focus.includeLocations && focus.locationUsage) {
    // Find location entities
    const locations = context.entities.filter(
      (e) => e.kind === 'location' || e.kind === 'place' || e.kind === 'realm'
    );
    if (locations.length > 0) {
      sections.push(`# Locations
${focus.locationUsage}

${locations
  .slice(0, 5)
  .map((l) => `- ${l.name}: ${l.enrichedDescription || l.description || '(no description)'}`)
  .join('\n')}
`);
    }
  }

  if (focus.includeArtifacts && focus.artifactUsage) {
    const artifacts = context.entities.filter(
      (e) => e.kind === 'artifact' || e.kind === 'item' || e.kind === 'object'
    );
    if (artifacts.length > 0) {
      sections.push(`# Artifacts
${focus.artifactUsage}

${artifacts
  .slice(0, 5)
  .map((a) => `- ${a.name}: ${a.enrichedDescription || a.description || '(no description)'}`)
  .join('\n')}
`);
    }
  }

  if (focus.includeCulturalPractices && focus.culturalUsage) {
    // Extract cultural info from entities with culture
    const cultures = new Set(
      context.entities.filter((e) => e.culture).map((e) => e.culture)
    );
    if (cultures.size > 0) {
      sections.push(`# Cultural Context
${focus.culturalUsage}

Cultures present: ${Array.from(cultures).join(', ')}
`);
    }
  }

  if (focus.includeEraContext && focus.eraUsage && context.era) {
    sections.push(`# Era Context
${focus.eraUsage}

Era: ${context.era.name}
${context.era.summary || context.era.description || ''}
`);
  }

  if (focus.customFocus && focus.customFocus.length > 0) {
    sections.push(`# Additional Focus
${focus.customFocus.join('\n')}
`);
  }

  return sections;
}

/**
 * Build prose directives section for prompt
 */
export function buildProseDirectivesSection(style: NarrativeStyle): string {
  const pd = style.proseDirectives;
  const lines: string[] = ['# Writing Style Directives'];

  lines.push(`Tone: ${pd.toneKeywords.join(', ')}`);
  lines.push(`Dialogue: ${pd.dialogueStyle}`);
  lines.push(`Description: ${pd.descriptionStyle}`);
  lines.push(`Pacing: ${pd.pacingNotes}`);

  if (pd.avoid.length > 0) {
    lines.push(`Avoid: ${pd.avoid.join('; ')}`);
  }

  if (pd.exampleProse) {
    lines.push(`\nExample of desired prose style:\n"${pd.exampleProse}"`);
  }

  return lines.join('\n');
}

/**
 * Build scene templates section for prompt
 */
export function buildSceneTemplatesSection(style: NarrativeStyle): string {
  const lines: string[] = ['# Available Scene Types'];

  for (const template of style.sceneTemplates) {
    lines.push(`## ${template.name}`);
    lines.push(`Purpose: ${template.purpose}`);
    lines.push(`Emotional arc: ${template.emotionalArc}`);
    lines.push(`Required elements: ${template.requiredElements.join(', ')}`);
    lines.push(`Target words: ${template.wordCountTarget}`);
    lines.push(`Notes: ${template.proseNotes}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build role definitions section for prompt
 */
export function buildRolesSection(style: NarrativeStyle): string {
  const lines: string[] = ['# Character Roles'];

  for (const role of style.entityRules.roles) {
    lines.push(
      `- ${role.role} (${role.count.min}-${role.count.max}): ${role.description}`
    );
    if (role.selectionCriteria) {
      lines.push(`  Prefer: ${role.selectionCriteria}`);
    }
  }

  return lines.join('\n');
}
