import { Graph, EngineConfig } from '../types/engine';
import { HardState, Relationship, EntityTags } from '../types/worldTypes';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// TAG UTILITIES - For working with EntityTags (KVP format)
// =============================================================================

/**
 * Merge multiple tag objects. Later tags override earlier ones.
 */
export function mergeTags(...tagSets: (EntityTags | undefined)[]): EntityTags {
  const result: EntityTags = {};
  for (const tags of tagSets) {
    if (tags) {
      Object.assign(result, tags);
    }
  }
  return result;
}

/**
 * Check if an entity has a specific tag.
 * @param tags - The entity's tags
 * @param key - The tag key to check
 * @param value - Optional: specific value to match (if not provided, checks key existence)
 */
export function hasTag(tags: EntityTags | undefined, key: string, value?: string | boolean): boolean {
  if (!tags) return false;
  if (!(key in tags)) return false;
  if (value === undefined) return true;
  return tags[key] === value;
}

/**
 * Get a tag's value, with optional default.
 */
export function getTagValue<T extends string | boolean>(
  tags: EntityTags | undefined,
  key: string,
  defaultValue?: T
): T | undefined {
  if (!tags || !(key in tags)) return defaultValue;
  return tags[key] as T;
}

/**
 * Get all tag keys that have truthy values.
 */
export function getTrueTagKeys(tags: EntityTags | undefined): string[] {
  if (!tags) return [];
  return Object.entries(tags)
    .filter(([_, value]) => value === true)
    .map(([key]) => key);
}

/**
 * Get all string-valued tags as key-value entries.
 */
export function getStringTags(tags: EntityTags | undefined): Array<[string, string]> {
  if (!tags) return [];
  return Object.entries(tags)
    .filter(([_, value]) => typeof value === 'string')
    .map(([key, value]) => [key, value as string]);
}

/**
 * Convert EntityTags (KVP) to array format for backward compatibility.
 * Boolean tags become just the key, string tags become "key:value".
 */
export function tagsToArray(tags: EntityTags | undefined): string[] {
  if (!tags) return [];
  return Object.entries(tags).map(([key, value]) => {
    if (value === true) return key;
    if (value === false) return `!${key}`; // Negated tag
    return `${key}:${value}`;
  });
}

/**
 * Convert array tags to EntityTags (KVP) format.
 * Plain strings become boolean true, "key:value" becomes string value.
 */
export function arrayToTags(arr: string[] | undefined): EntityTags {
  if (!arr) return {};
  const result: EntityTags = {};
  for (const tag of arr) {
    if (tag.startsWith('!')) {
      result[tag.slice(1)] = false;
    } else if (tag.includes(':')) {
      const [key, ...valueParts] = tag.split(':');
      result[key] = valueParts.join(':');
    } else {
      result[tag] = true;
    }
  }
  return result;
}

// ID generation
let idCounter = 1000;
export function generateId(prefix: string): string {
  return `${prefix}_${idCounter++}`;
}

// Random selection

/**
 * Fisher-Yates shuffle - produces unbiased random permutation.
 * NOTE: The previous implementation using sort(() => Math.random() - 0.5)
 * was biased and could produce non-uniform distributions.
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function pickMultiple<T>(array: T[], count: number): T[] {
  const shuffled = shuffle(array);
  return shuffled.slice(0, Math.min(count, array.length));
}

// Entity finding
export function findEntities(
  graph: Graph,
  criteria: Partial<HardState>
): HardState[] {
  const results: HardState[] = [];

  graph.forEachEntity(entity => {
    let matches = true;

    for (const [key, value] of Object.entries(criteria)) {
      if (entity[key as keyof HardState] !== value) {
        matches = false;
        break;
      }
    }

    if (matches) {
      results.push(entity);
    }
  });

  return results;
}

// Relationship query options
export interface RelationshipQueryOptions {
  minStrength?: number;      // Filter by minimum strength
  maxStrength?: number;      // Filter by maximum strength
  sortByStrength?: boolean;  // Sort by strength descending
}

// Relationship helpers
export function getRelated(
  graph: Graph,
  entityId: string,
  relationshipKind?: string,
  direction: 'src' | 'dst' | 'both' = 'both',
  options?: RelationshipQueryOptions
): HardState[] {
  const related: Array<{ entity: HardState; strength: number }> = [];
  const opts = options || {};

  graph.getRelationships().forEach(rel => {
    if (relationshipKind && rel.kind !== relationshipKind) return;

    // Strength filtering
    const strength = rel.strength ?? 0.5;
    if (opts.minStrength !== undefined && strength < opts.minStrength) return;
    if (opts.maxStrength !== undefined && strength > opts.maxStrength) return;

    if ((direction === 'src' || direction === 'both') && rel.src === entityId) {
      const entity = graph.getEntity(rel.dst);
      if (entity) related.push({ entity, strength });
    }

    if ((direction === 'dst' || direction === 'both') && rel.dst === entityId) {
      const entity = graph.getEntity(rel.src);
      if (entity) related.push({ entity, strength });
    }
  });

  // Sort by strength if requested
  if (opts.sortByStrength) {
    related.sort((a, b) => b.strength - a.strength);
  }

  return related.map(r => r.entity);
}

export function hasRelationship(
  graph: Graph,
  srcId: string,
  dstId: string,
  kind?: string
): boolean {
  return graph.getRelationships().some(rel =>
    rel.src === srcId &&
    rel.dst === dstId &&
    (!kind || rel.kind === kind)
  );
}

// Location helpers
export function getResidents(graph: Graph, locationId: string): HardState[] {
  return getRelated(graph, locationId, 'resident_of', 'dst');
}

export function getLocation(graph: Graph, npcId: string): HardState | undefined {
  const locations = getRelated(graph, npcId, 'resident_of', 'src');
  return locations[0];
}

// Faction helpers
export function getFactionMembers(graph: Graph, factionId: string): HardState[] {
  return getRelated(graph, factionId, 'member_of', 'dst');
}

export function getFactionLeader(graph: Graph, factionId: string): HardState | undefined {
  const leaders = getRelated(graph, factionId, 'leader_of', 'dst');
  return leaders[0];
}

// Strength-aware faction helpers
export function getCoreFactionMembers(graph: Graph, factionId: string): HardState[] {
  return getRelated(graph, factionId, 'member_of', 'dst', { minStrength: 0.7 });
}

export function getStrongAllies(graph: Graph, entityId: string): HardState[] {
  return getRelated(graph, entityId, 'ally_of', 'src', { minStrength: 0.6 });
}

export function getWeakRelationships(graph: Graph, entityId: string): Relationship[] {
  return graph.getRelationships().filter(r =>
    (r.src === entityId || r.dst === entityId) &&
    (r.strength ?? 0.5) < 0.3
  );
}

// Prominence helpers
export function getProminenceValue(prominence: HardState['prominence']): number {
  const values = {
    'forgotten': 0,
    'marginal': 1,
    'recognized': 2,
    'renowned': 3,
    'mythic': 4
  };
  return values[prominence] || 0;
}

export function adjustProminence(
  current: HardState['prominence'],
  delta: number
): HardState['prominence'] {
  const order: HardState['prominence'][] = [
    'forgotten', 'marginal', 'recognized', 'renowned', 'mythic'
  ];
  
  const currentIndex = order.indexOf(current);
  const newIndex = Math.max(0, Math.min(order.length - 1, currentIndex + delta));
  
  return order[newIndex];
}

// Name tag helpers (for deterministic slug tags that track final names)
export function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

export function upsertNameTag(entity: HardState, sourceName: string): void {
  const slug = slugifyName(sourceName);
  if (!entity.tags) {
    entity.tags = {};
  }
  // With KVP format, just set the name key directly
  entity.tags.name = slug;
}

// Initial state normalization
export function normalizeInitialState(entities: any[]): HardState[] {
  return entities.map((entity, index) => {
    if (!entity.name) {
      throw new Error(
        `normalizeInitialState: entity at index ${index} has no name. ` +
        `Initial state entities must have names defined in JSON.`
      );
    }
    if (!entity.coordinates) {
      throw new Error(
        `normalizeInitialState: entity "${entity.name}" at index ${index} has no coordinates. ` +
        `Initial state entities must have coordinates defined in JSON.`
      );
    }

    // Handle both old array format and new KVP format for tags
    let tags: EntityTags;
    if (Array.isArray(entity.tags)) {
      tags = arrayToTags(entity.tags);
    } else {
      tags = entity.tags || {};
    }

    return {
      id: entity.id || entity.name || generateId(entity.kind || 'unknown'),
      kind: entity.kind as HardState['kind'] || 'npc',
      subtype: entity.subtype || 'default',
      name: entity.name,
      description: entity.description || '',
      status: entity.status || 'alive',
      prominence: entity.prominence as HardState['prominence'] || 'marginal',
      culture: entity.culture || 'world',
      tags,
      links: entity.links || [],
      createdAt: 0,
      updatedAt: 0,
      coordinates: entity.coordinates
    };
  });
}

// Graph modification helpers
export function addEntity(graph: Graph, entity: Partial<HardState>): string {
  // Coordinates are required - fail loudly
  // Check for valid numeric values, not just object existence
  const coords = entity.coordinates;
  if (!coords || typeof coords.x !== 'number' || typeof coords.y !== 'number') {
    throw new Error(
      `addEntity: valid coordinates {x: number, y: number, z?: number} are required. ` +
      `Entity kind: ${entity.kind || 'unknown'}, name: ${entity.name || 'unnamed'}. ` +
      `Received: ${JSON.stringify(coords)}. ` +
      `Use addEntityInRegion() or provide valid coordinates explicitly.`
    );
  }

  // Normalize tags: handle both old array format and new KVP format
  let tags: EntityTags;
  if (Array.isArray(entity.tags)) {
    tags = arrayToTags(entity.tags);
  } else {
    tags = entity.tags || {};
  }

  // Delegate to Graph.createEntity() which enforces the contract:
  // coordinates (required) → tags → name (auto-generated if not provided)
  // Use validated coords to satisfy TypeScript (already validated above)
  const validCoords = { x: coords.x, y: coords.y, z: coords.z ?? 50 };

  return graph.createEntity({
    kind: entity.kind || 'npc',
    subtype: entity.subtype || 'default',
    coordinates: validCoords,
    tags,
    name: entity.name,  // May be undefined - createEntity will auto-generate
    description: entity.description,
    status: entity.status,
    prominence: entity.prominence,
    culture: entity.culture,
    temporal: entity.temporal
  });
}

// ===========================
// RELATIONSHIP HELPER FUNCTIONS
// ===========================

/**
 * Check if a relationship kind requires distance (is a lineage relationship).
 * Requires graph with domain schema.
 */
export function isLineageRelationship(kind: string, graph: Graph): boolean {
  if (graph.config?.domain?.isLineageRelationship) {
    return graph.config.domain.isLineageRelationship(kind);
  }
  return false; // Default: not a lineage relationship
}

/**
 * Get expected distance range for a lineage relationship kind.
 * Requires graph with domain schema.
 * Returns undefined for non-lineage relationships.
 */
export function getExpectedDistanceRange(kind: string, graph: Graph): { min: number; max: number } | undefined {
  if (graph.config?.domain?.getExpectedDistanceRange) {
    return graph.config.domain.getExpectedDistanceRange(kind);
  }
  return undefined;
}

/**
 * Get narrative strength for a relationship kind (0.0-1.0).
 * Requires graph with domain schema.
 */
export function getRelationshipStrength(kind: string, graph: Graph): number {
  if (graph.config?.domain?.getRelationshipStrength) {
    return graph.config.domain.getRelationshipStrength(kind);
  }
  return 0.5; // Default strength
}

/**
 * Get behavioral category for a relationship kind.
 * Requires graph with domain schema.
 */
export function getRelationshipCategory(kind: string, graph: Graph): string {
  if (graph.config?.domain?.getRelationshipCategory) {
    return graph.config.domain.getRelationshipCategory(kind);
  }
  return 'social'; // Default category
}

/**
 * Add a relationship between two entities.
 *
 * @param graph - The world graph
 * @param kind - Relationship type
 * @param srcId - Source entity ID
 * @param dstId - Destination entity ID
 * @param strengthOverride - Optional strength override (0.0-1.0). If not provided, auto-assigned based on kind.
 * @param distance - Optional cognitive similarity distance (0.0 = identical, 1.0 = maximally different)
 */
export function addRelationship(
  graph: Graph,
  kind: string,
  srcId: string,
  dstId: string,
  strengthOverride?: number,
  distance?: number
): void {
  // Get domain schema for configuration lookup
  const domain = graph.config?.domain;

  // Auto-assign strength based on relationship kind, or use override
  const strength = strengthOverride ?? (domain?.getRelationshipStrength?.(kind) ?? 0.5);

  // Auto-assign category based on relationship kind
  const category = domain?.getRelationshipCategory?.(kind) ?? 'social';

  // LINEAGE ENFORCEMENT: Auto-assign distance for lineage relationships if missing
  let finalDistance = distance;
  const isLineage = domain?.isLineageRelationship?.(kind) ?? false;
  if (finalDistance === undefined && isLineage) {
    const range = domain?.getExpectedDistanceRange?.(kind);
    if (range) {
      finalDistance = range.min + Math.random() * (range.max - range.min);

      // Log warning for debugging (only occasionally to avoid spam)
      if (Math.random() < 0.05) {  // 5% sample rate
        console.warn(`⚠️  Auto-adding distance to ${kind} relationship (${srcId} → ${dstId}): ${finalDistance.toFixed(3)}`);
      }
    }
  }

  // Check relationship warning thresholds (per-kind, non-blocking)
  const srcEntity = graph.getEntity(srcId);
  if (srcEntity) {
    const existingOfType = srcEntity.links.filter(link => link.kind === kind).length;

    // Use domain schema for thresholds (default: 10)
    const threshold = domain?.getRelationshipWarningThreshold?.(srcEntity.kind, kind) ?? 10;

    if (existingOfType >= threshold) {
      // Write to warnings log file instead of console
      const warningMessage =
        `⚠️  RELATIONSHIP WARNING (${srcEntity.kind.toUpperCase()}):\n` +
        `   Entity: ${srcEntity.name} (${srcEntity.id})\n` +
        `   Kind: ${srcEntity.kind}\n` +
        `   Relationship Type: ${kind}\n` +
        `   Current count: ${existingOfType}\n` +
        `   Warning threshold: ${threshold}\n` +
        `   Target: ${graph.getEntity(dstId)?.name || dstId}\n` +
        `   Tick: ${graph.tick}\n` +
        `   Era: ${graph.currentEra.name}\n` +
        `   ℹ️  This is a WARNING only - relationship will still be added\n`;

      try {
        const warningLogPath = path.join(process.cwd(), 'output', 'warnings.log');
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [Tick ${graph.tick}]\n${warningMessage}\n`;
        fs.appendFileSync(warningLogPath, logEntry);
      } catch (error) {
        // Silently fail - don't spam console with file write errors
      }
    }
  }

  // Delegate to Graph.addRelationship() which handles:
  // - Entity existence validation
  // - Duplicate checking
  // - Entity links update
  graph.addRelationship(kind, srcId, dstId, strength, finalDistance, category);
}

export function updateEntity(
  graph: Graph,
  entityId: string,
  changes: Partial<HardState>
): void {
  // Use Graph's updateEntity method to modify the actual entity, not a clone
  graph.updateEntity(entityId, changes);
}

/**
 * Add a relationship with a bounded random distance.
 * Used for lineage-based connectivity where entities link to existing same-kind entities.
 *
 * @param graph - The world graph
 * @param kind - Relationship type
 * @param srcId - Source entity ID
 * @param dstId - Destination entity ID
 * @param distanceRange - Min/max range for random distance selection
 * @param strengthOverride - Optional strength override (0.0-1.0)
 *
 * @example
 * // Incremental tech improvement (0.1-0.3 distance)
 * addRelationshipWithDistance(graph, 'derived_from', newTechId, oldTechId, { min: 0.1, max: 0.3 })
 *
 * @example
 * // Major faction split (0.6-0.8 distance)
 * addRelationshipWithDistance(graph, 'split_from', splinterId, parentId, { min: 0.6, max: 0.8 })
 */
export function addRelationshipWithDistance(
  graph: Graph,
  kind: string,
  srcId: string,
  dstId: string,
  distanceRange: { min: number; max: number },
  strengthOverride?: number
): void {
  // Validate range
  if (distanceRange.min < 0 || distanceRange.max > 1 || distanceRange.min > distanceRange.max) {
    console.warn(`Invalid distance range: [${distanceRange.min}, ${distanceRange.max}]. Using [0, 1].`);
    distanceRange = { min: 0, max: 1 };
  }

  // Calculate random distance within range
  const distance = distanceRange.min + Math.random() * (distanceRange.max - distanceRange.min);

  // Delegate to addRelationship with calculated distance
  addRelationship(graph, kind, srcId, dstId, strengthOverride, distance);
}

/**
 * Archive a relationship by marking it as historical.
 * Used for temporal tracking to maintain day 0 coherence.
 *
 * @param graph - The world graph
 * @param src - Source entity ID
 * @param dst - Destination entity ID
 * @param kind - Relationship kind to archive
 */
export function archiveRelationship(
  graph: Graph,
  src: string,
  dst: string,
  kind: string
): void {
  // Find matching active relationship in graph
  const rel = graph.getRelationships().find(r =>
    r.src === src &&
    r.dst === dst &&
    r.kind === kind &&
    r.status !== 'historical'
  );

  if (rel) {
    rel.status = 'historical';
    rel.archivedAt = graph.tick;
  }

  // Update entity links for source entity
  const srcEntity = graph.getEntity(src);
  if (srcEntity) {
    const link = srcEntity.links.find(l =>
      l.src === src &&
      l.dst === dst &&
      l.kind === kind &&
      l.status !== 'historical'
    );
    if (link) {
      link.status = 'historical';
      link.archivedAt = graph.tick;
    }
    srcEntity.updatedAt = graph.tick;
  }

  // Update destination entity's updatedAt
  const dstEntity = graph.getEntity(dst);
  if (dstEntity) {
    dstEntity.updatedAt = graph.tick;
  }
}

/**
 * Modify relationship strength by delta
 * @param delta - Amount to change strength (+/- value)
 * @returns true if relationship was modified, false if not found
 */
export function modifyRelationshipStrength(
  graph: Graph,
  srcId: string,
  dstId: string,
  kind: string,
  delta: number
): boolean {
  // Find relationship in graph
  const rel = graph.getRelationships().find(r =>
    r.src === srcId && r.dst === dstId && r.kind === kind
  );

  if (!rel) return false;

  // Update strength (clamp to 0.0-1.0)
  const currentStrength = rel.strength ?? 0.5;
  rel.strength = Math.max(0.0, Math.min(1.0, currentStrength + delta));

  // Also update in entity links
  const srcEntity = graph.getEntity(srcId);
  const dstEntity = graph.getEntity(dstId);

  if (srcEntity) {
    const link = srcEntity.links.find(l =>
      l.kind === kind && l.src === srcId && l.dst === dstId
    );
    if (link) link.strength = rel.strength;
    srcEntity.updatedAt = graph.tick;
  }

  if (dstEntity) {
    dstEntity.updatedAt = graph.tick;
  }

  return true;
}

// Validation helpers
export function validateRelationship(
  schema: any,
  srcKind: string,
  dstKind: string,
  relKind: string
): boolean {
  const allowedRelations = schema.relationships[srcKind]?.[dstKind];
  return allowedRelations?.includes(relKind) || false;
}

// Weighted random selection
export function weightedRandom<T>(
  items: T[],
  weights: number[]
): T | undefined {
  if (items.length === 0 || items.length !== weights.length) return undefined;

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }

  return items[items.length - 1];
}

/**
 * Check if a probabilistic event should occur, scaled by an era modifier.
 *
 * @param baseProbability - Base chance of the event occurring (0.0 to 1.0)
 *                         e.g., 0.3 = 30% chance
 * @param eraModifier - Era-based multiplier for the probability
 *                      > 1 increases likelihood, < 1 decreases it
 * @returns true if the event should occur
 *
 * @example
 * // 30% base chance, doubled in conflict era (modifier = 2)
 * if (rollProbability(0.3, eraModifier)) {
 *   createConflict();
 * }
 */
export function rollProbability(baseProbability: number, eraModifier: number = 1.0): boolean {
    const p = baseProbability;

    // odds scaling
    const odds = p / (1 - p);
    const scaledOdds = Math.pow(odds, eraModifier);
    const scaledP = scaledOdds / (1 + scaledOdds);

    return Math.random() < scaledP;
}

// Relationship Cooldown Management

/**
 * Check if an entity can form a new relationship of a given type based on cooldown.
 *
 * @param graph - The world graph
 * @param entityId - The entity attempting to form a relationship
 * @param relationshipType - The type of relationship (e.g., 'lover_of', 'enemy_of')
 * @param cooldownTicks - Minimum ticks that must pass between forming relationships of this type
 * @returns true if the entity is not on cooldown for this relationship type
 */
export function canFormRelationship(
  graph: Graph,
  entityId: string,
  relationshipType: string,
  cooldownTicks: number
): boolean {
  const entityCooldowns = graph.relationshipCooldowns.get(entityId);
  if (!entityCooldowns) return true;

  const lastFormationTick = entityCooldowns.get(relationshipType);
  if (lastFormationTick === undefined) return true;

  return (graph.tick - lastFormationTick) >= cooldownTicks;
}

/**
 * Record that an entity has formed a relationship, updating cooldown tracking.
 *
 * @param graph - The world graph
 * @param entityId - The entity that formed a relationship
 * @param relationshipType - The type of relationship formed
 */
export function recordRelationshipFormation(
  graph: Graph,
  entityId: string,
  relationshipType: string
): void {
  let entityCooldowns = graph.relationshipCooldowns.get(entityId);

  if (!entityCooldowns) {
    entityCooldowns = new Map();
    graph.relationshipCooldowns.set(entityId, entityCooldowns);
  }

  entityCooldowns.set(relationshipType, graph.tick);
}

/**
 * Check if a new relationship is compatible with existing relationships.
 * Prevents contradictory relationships like being both lover and enemy.
 * Uses domain schema conflictsWith.
 *
 * @param graph - The world graph
 * @param srcId - Source entity ID
 * @param dstId - Destination entity ID
 * @param newKind - The relationship kind to check
 * @returns true if the new relationship is compatible with existing ones
 */
export function areRelationshipsCompatible(
  graph: Graph,
  srcId: string,
  dstId: string,
  newKind: string
): boolean {
  // Get existing relationship kinds between these entities
  const existingRelationships = graph.getRelationships().filter(
    r => r.src === srcId && r.dst === dstId
  );
  const existingKinds = existingRelationships.map(r => r.kind);

  // Use domain schema for conflict checking
  const domain = graph.config?.domain;
  if (domain?.checkRelationshipConflict) {
    return !domain.checkRelationshipConflict(existingKinds, newKind);
  }

  // No conflicts defined - all relationships are compatible
  return true;
}

/**
 * Calculate relationship formation weight based on existing connection count.
 * Favors underconnected entities to balance network density and prevent hubs.
 *
 * @param entity - The entity to calculate weight for
 * @returns Weight multiplier (higher = more likely to form relationships)
 */
export function getConnectionWeight(entity: HardState): number {
  const connectionCount = entity.links.length;

  // Boost isolated/underconnected entities
  if (connectionCount === 0) return 3.0;    // Strongly boost isolated
  if (connectionCount <= 2) return 2.0;     // Boost underconnected (below median)
  if (connectionCount <= 5) return 1.0;     // Normal
  if (connectionCount <= 10) return 0.5;    // Reduce well-connected
  return 0.2;                               // Heavily reduce hubs (15+)
}

/**
 * Determine the relationship between two sets of factions.
 *
 * @param factions1 - First set of factions
 * @param factions2 - Second set of factions
 * @param graph - The world graph
 * @returns 'allied', 'enemy', or 'neutral'
 */
export function getFactionRelationship(
  factions1: HardState[],
  factions2: HardState[],
  graph: Graph
): 'allied' | 'enemy' | 'neutral' {
  // Check for warfare/enmity
  const atWar = factions1.some(f1 =>
    factions2.some(f2 =>
      hasRelationship(graph, f1.id, f2.id, 'at_war_with') ||
      hasRelationship(graph, f1.id, f2.id, 'enemy_of')
    )
  );
  if (atWar) return 'enemy';

  // Check for alliances
  const allied = factions1.some(f1 =>
    factions2.some(f2 => hasRelationship(graph, f1.id, f2.id, 'allied_with'))
  );
  if (allied) return 'allied';

  return 'neutral';
}

// JSON parsing utilities
/**
 * Safely parse JSON with automatic cleanup of markdown code blocks
 * Returns null if parsing fails
 */
export function parseJsonSafe<T = any>(raw: string): T | null {
  if (!raw) return null;
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// Array utilities
/**
 * Split an array into chunks of a specified size
 */
export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

// ID generation for lore records
let loreRecordCounter = 0;
/**
 * Generate unique ID for lore records with timestamp and counter
 */
export function generateLoreId(prefix: string): string {
  return `${prefix}_${Date.now()}_${loreRecordCounter++}`;
}
