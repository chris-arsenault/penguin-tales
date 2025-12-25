/**
 * Chronicle Context Builder
 *
 * Gathers all structured data needed for chronicle generation.
 * This ensures full entity objects + enriched descriptions flow through the pipeline.
 *
 * See CHRONICLE_DESIGN.md for architecture documentation.
 */

import type {
  ChronicleGenerationContext,
  ChronicleType,
  EntityContext,
  RelationshipContext,
  EraContext,
  NarrativeEventContext,
} from './chronicleTypes';

interface WorldData {
  hardState: Array<{
    id: string;
    name: string;
    kind: string;
    subtype?: string;
    prominence: string;
    culture?: string;
    status: string;
    tags?: Record<string, string>;
    description?: string;
    coordinates?: { x: number; y: number };
    createdAt: number;
    updatedAt: number;
    enrichment?: {
      description?: { text: string };
      eraNarrative?: { text: string };
    };
  }>;
  relationships: Array<{
    src: string;
    dst: string;
    kind: string;
    strength?: number;
  }>;
  narrativeHistory?: Array<{
    id: string;
    tick: number;
    era: string;
    eventKind: string;
    significance: number;
    headline: string;
    description?: string;
    subject?: { id: string; name: string };
    object?: { id: string; name: string };
    stateChanges?: Array<{
      entityId: string;
      entityName: string;
      field: string;
      previousValue: unknown;
      newValue: unknown;
    }>;
    narrativeTags?: string[];
  }>;
}

interface WorldContext {
  name: string;
  description: string;
  canonFacts: string[];
  tone: string;
}

/**
 * Build entity context from raw entity data
 */
function buildEntityContext(entity: WorldData['hardState'][0]): EntityContext {
  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    subtype: entity.subtype,
    prominence: entity.prominence,
    culture: entity.culture,
    status: entity.status,
    tags: entity.tags || {},
    description: entity.description,
    coordinates: entity.coordinates,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    enrichedDescription: entity.enrichment?.description?.text,
  };
}

/**
 * Build relationship context with resolved entity info
 */
function buildRelationshipContext(
  rel: WorldData['relationships'][0],
  entityMap: Map<string, WorldData['hardState'][0]>
): RelationshipContext {
  const src = entityMap.get(rel.src);
  const dst = entityMap.get(rel.dst);

  return {
    src: rel.src,
    dst: rel.dst,
    kind: rel.kind,
    strength: rel.strength,
    sourceName: src?.name || rel.src,
    sourceKind: src?.kind || 'unknown',
    targetName: dst?.name || rel.dst,
    targetKind: dst?.kind || 'unknown',
    // TODO: Add backstory from enrichment when available
    backstory: undefined,
  };
}

/**
 * Build era context from entity data
 */
function buildEraContext(entity: WorldData['hardState'][0]): EraContext {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    summary: entity.enrichment?.eraNarrative?.text,
  };
}

/**
 * Build narrative event context
 */
function buildEventContext(
  event: NonNullable<WorldData['narrativeHistory']>[0]
): NarrativeEventContext {
  return {
    id: event.id,
    tick: event.tick,
    era: event.era,
    eventKind: event.eventKind,
    significance: event.significance,
    headline: event.headline,
    description: event.description,
    subjectId: event.subject?.id,
    subjectName: event.subject?.name,
    objectId: event.object?.id,
    objectName: event.object?.name,
    stateChanges: event.stateChanges,
    narrativeTags: event.narrativeTags,
  };
}

/**
 * Build generation context for an era chronicle
 */
export function buildEraChronicleContext(
  eraId: string,
  worldData: WorldData,
  worldContext: WorldContext
): ChronicleGenerationContext {
  const entityMap = new Map(worldData.hardState.map((e) => [e.id, e]));
  const era = entityMap.get(eraId);

  if (!era || era.kind !== 'era') {
    throw new Error(`Era not found: ${eraId}`);
  }

  // Get all non-era entities
  const entities = worldData.hardState
    .filter((e) => e.kind !== 'era')
    .map(buildEntityContext);

  // Get all relationships
  const relationships = worldData.relationships.map((r) =>
    buildRelationshipContext(r, entityMap)
  );

  // Get events for this era, sorted by significance
  const events = (worldData.narrativeHistory || [])
    .filter((e) => e.era === eraId)
    .sort((a, b) => b.significance - a.significance)
    .map(buildEventContext);

  // Build description map for cross-referencing
  const existingDescriptions = new Map<string, string>();
  for (const entity of worldData.hardState) {
    const desc = entity.enrichment?.description?.text;
    if (desc) {
      existingDescriptions.set(entity.id, desc);
    }
  }

  return {
    worldName: worldContext.name || 'The World',
    worldDescription: worldContext.description || '',
    canonFacts: worldContext.canonFacts || [],
    tone: worldContext.tone || '',

    targetType: 'eraChronicle',
    targetId: eraId,

    era: buildEraContext(era),
    entities,
    relationships,
    events,

    existingDescriptions,
    existingBackstories: new Map(), // TODO: Add when backstories are tracked
  };
}

/**
 * Build generation context for an entity story
 */
export function buildEntityStoryContext(
  entityId: string,
  worldData: WorldData,
  worldContext: WorldContext
): ChronicleGenerationContext {
  const entityMap = new Map(worldData.hardState.map((e) => [e.id, e]));
  const entity = entityMap.get(entityId);

  if (!entity) {
    throw new Error(`Entity not found: ${entityId}`);
  }

  // Get all entities for context
  const entities = worldData.hardState
    .filter((e) => e.kind !== 'era')
    .map(buildEntityContext);

  // Get relationships in the entrypoint subgraph (target + direct neighbors)
  const directRelationships = worldData.relationships.filter(
    (r) => r.src === entityId || r.dst === entityId
  );
  const relatedEntityIds = new Set<string>([entityId]);
  for (const rel of directRelationships) {
    relatedEntityIds.add(rel.src);
    relatedEntityIds.add(rel.dst);
  }
  const relationships = worldData.relationships
    .filter((r) => relatedEntityIds.has(r.src) && relatedEntityIds.has(r.dst))
    .map((r) => buildRelationshipContext(r, entityMap));

  // Get events involving this entity, sorted by significance
  const events = (worldData.narrativeHistory || [])
    .filter(
      (e) =>
        e.subject?.id === entityId ||
        e.object?.id === entityId ||
        e.stateChanges?.some((sc) => sc.entityId === entityId)
    )
    .sort((a, b) => b.significance - a.significance)
    .map(buildEventContext);

  // Find the era this entity was active during
  const activeEraRel = worldData.relationships.find(
    (r) => r.src === entityId && r.kind === 'active_during'
  );
  const era = activeEraRel ? entityMap.get(activeEraRel.dst) : undefined;

  // Build description map
  const existingDescriptions = new Map<string, string>();
  for (const e of worldData.hardState) {
    const desc = e.enrichment?.description?.text;
    if (desc) {
      existingDescriptions.set(e.id, desc);
    }
  }

  return {
    worldName: worldContext.name || 'The World',
    worldDescription: worldContext.description || '',
    canonFacts: worldContext.canonFacts || [],
    tone: worldContext.tone || '',

    targetType: 'entityStory',
    targetId: entityId,

    entity: buildEntityContext(entity),
    era: era ? buildEraContext(era) : undefined,
    entities,
    relationships,
    events,

    existingDescriptions,
    existingBackstories: new Map(),
  };
}

/**
 * Build generation context for a relationship tale
 */
export function buildRelationshipTaleContext(
  srcId: string,
  dstId: string,
  worldData: WorldData,
  worldContext: WorldContext
): ChronicleGenerationContext {
  const entityMap = new Map(worldData.hardState.map((e) => [e.id, e]));
  const srcEntity = entityMap.get(srcId);
  const dstEntity = entityMap.get(dstId);

  if (!srcEntity || !dstEntity) {
    throw new Error(`Entities not found: ${srcId}, ${dstId}`);
  }

  const rel = worldData.relationships.find(
    (r) =>
      (r.src === srcId && r.dst === dstId) ||
      (r.src === dstId && r.dst === srcId)
  );

  if (!rel) {
    throw new Error(`Relationship not found between ${srcId} and ${dstId}`);
  }

  // Get all entities
  const entities = worldData.hardState
    .filter((e) => e.kind !== 'era')
    .map(buildEntityContext);

  // Get all relationships for context
  const relationships = worldData.relationships.map((r) =>
    buildRelationshipContext(r, entityMap)
  );

  // Get events involving either entity
  const events = (worldData.narrativeHistory || [])
    .filter(
      (e) =>
        e.subject?.id === srcId ||
        e.subject?.id === dstId ||
        e.object?.id === srcId ||
        e.object?.id === dstId
    )
    .sort((a, b) => b.significance - a.significance)
    .map(buildEventContext);

  // Build description map
  const existingDescriptions = new Map<string, string>();
  for (const e of worldData.hardState) {
    const desc = e.enrichment?.description?.text;
    if (desc) {
      existingDescriptions.set(e.id, desc);
    }
  }

  return {
    worldName: worldContext.name || 'The World',
    worldDescription: worldContext.description || '',
    canonFacts: worldContext.canonFacts || [],
    tone: worldContext.tone || '',

    targetType: 'relationshipTale',
    targetId: `${srcId}-${dstId}`,

    relationship: buildRelationshipContext(rel, entityMap),
    entities,
    relationships,
    events,

    existingDescriptions,
    existingBackstories: new Map(),
  };
}

/**
 * Check prerequisites for chronicle generation
 * Returns list of missing items that should be generated first
 */
export interface PrerequisiteCheck {
  ready: boolean;
  missing: {
    type: 'entityDescription' | 'eraSummary' | 'relationshipBackstory';
    id: string;
    name: string;
  }[];
}

export function checkPrerequisites(
  context: ChronicleGenerationContext
): PrerequisiteCheck {
  const missing: PrerequisiteCheck['missing'] = [];

  // For era chronicles, we need entity descriptions for prominent entities
  if (context.targetType === 'eraChronicle') {
    const prominentEntities = context.entities.filter(
      (e) => e.prominence === 'mythic' || e.prominence === 'renowned'
    );
    for (const entity of prominentEntities) {
      if (!entity.enrichedDescription) {
        missing.push({
          type: 'entityDescription',
          id: entity.id,
          name: entity.name,
        });
      }
    }
    // Era should have a summary
    if (context.era && !context.era.summary) {
      missing.push({
        type: 'eraSummary',
        id: context.era.id,
        name: context.era.name,
      });
    }
  }

  // For entity stories, we need the entity's description
  if (context.targetType === 'entityStory') {
    if (context.entity && !context.entity.enrichedDescription) {
      missing.push({
        type: 'entityDescription',
        id: context.entity.id,
        name: context.entity.name,
      });
    }
  }

  // For relationship tales, we need both entities' descriptions
  if (context.targetType === 'relationshipTale') {
    const srcId = context.relationship?.src;
    const dstId = context.relationship?.dst;
    if (srcId) {
      const src = context.entities.find((e) => e.id === srcId);
      if (src && !src.enrichedDescription) {
        missing.push({
          type: 'entityDescription',
          id: srcId,
          name: src.name,
        });
      }
    }
    if (dstId) {
      const dst = context.entities.find((e) => e.id === dstId);
      if (dst && !dst.enrichedDescription) {
        missing.push({
          type: 'entityDescription',
          id: dstId,
          name: dst.name,
        });
      }
    }
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}

/**
 * Get a summary of context for display
 */
export function summarizeContext(context: ChronicleGenerationContext): {
  entityCount: number;
  relationshipCount: number;
  eventCount: number;
  prominentEntities: string[];
  highSignificanceEvents: string[];
} {
  const prominentEntities = context.entities
    .filter((e) => e.prominence === 'mythic' || e.prominence === 'renowned')
    .map((e) => e.name)
    .slice(0, 10);

  const highSignificanceEvents = context.events
    .filter((e) => e.significance >= 0.7)
    .map((e) => e.headline)
    .slice(0, 5);

  return {
    entityCount: context.entities.length,
    relationshipCount: context.relationships.length,
    eventCount: context.events.length,
    prominentEntities,
    highSignificanceEvents,
  };
}
