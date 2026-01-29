/**
 * Dynamics Search Executor
 *
 * Runs on the main thread. Executes structured search requests
 * against in-memory world state (entities, relationships, eras).
 * Returns condensed summaries suitable for LLM context.
 */

import type {
  DynamicsSearchRequest,
  DynamicsSearchResult,
  DynamicsSearchResultEntry,
} from './dynamicsGenerationTypes';
import type { EntityContext, RelationshipContext } from './chronicleTypes';

// =============================================================================
// Types
// =============================================================================

export interface WorldSearchContext {
  entities: EntityContext[];
  relationships: RelationshipContext[];
}

// =============================================================================
// Search Execution
// =============================================================================

function matchesTextQuery(entity: EntityContext, query: string): boolean {
  const q = query.toLowerCase();
  return (
    (entity.name?.toLowerCase().includes(q)) ||
    (entity.summary?.toLowerCase().includes(q) ?? false) ||
    (entity.description?.toLowerCase().includes(q) ?? false)
  );
}

function matchesTags(entity: EntityContext, tags: Record<string, string>): boolean {
  for (const [key, value] of Object.entries(tags)) {
    const entityValue = entity.tags?.[key];
    if (entityValue === undefined) return false;
    if (value !== '*' && entityValue !== value) return false;
  }
  return true;
}

/**
 * Execute a single search request against in-memory world state.
 */
export function executeSearch(
  request: DynamicsSearchRequest,
  context: WorldSearchContext
): DynamicsSearchResult {
  let entities = [...context.entities];

  // Field filters
  if (request.kinds?.length) {
    entities = entities.filter((e) => request.kinds!.includes(e.kind));
  }
  if (request.cultures?.length) {
    entities = entities.filter((e) => e.culture && request.cultures!.includes(e.culture));
  }
  if (request.tags && Object.keys(request.tags).length > 0) {
    entities = entities.filter((e) => matchesTags(e, request.tags!));
  }
  if (request.eraId) {
    entities = entities.filter((e) => e.eraId === request.eraId);
  }

  // Graph traversal: find connected entities
  if (request.connectedTo) {
    const connectedId = request.connectedTo;
    const connectedIds = new Set<string>();
    for (const rel of context.relationships) {
      if (rel.src === connectedId) connectedIds.add(rel.dst);
      if (rel.dst === connectedId) connectedIds.add(rel.src);
    }
    entities = entities.filter((e) => connectedIds.has(e.id));
  }

  // Text search (applied last — most expensive)
  if (request.textQuery) {
    entities = entities.filter((e) => matchesTextQuery(e, request.textQuery!));
  }

  // Limit results
  const maxResults = request.maxResults || 10;
  const results: DynamicsSearchResultEntry[] = entities
    .slice(0, maxResults)
    .map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      subtype: e.subtype,
      culture: e.culture,
      summary: e.summary || e.description || '(no summary)',
    }));

  return {
    searchId: request.id,
    intent: request.intent,
    results,
  };
}

/**
 * Execute multiple search requests in sequence.
 */
export function executeSearches(
  requests: DynamicsSearchRequest[],
  context: WorldSearchContext
): DynamicsSearchResult[] {
  return requests.map((req) => executeSearch(req, context));
}
