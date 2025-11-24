import { Graph } from '../types/engine';
import { HardState, Relationship } from '../types/worldTypes';
import * as fs from 'fs';
import * as path from 'path';

// DEPRECATED: Name generation should use domain schema
// Kept for backward compatibility - templates still use this
// TODO: Refactor templates to use graph.config.domain.nameGenerator
import { penguinDomain } from '../domain/penguin/schema';

export function generateName(type: string = 'default'): string {
  // Use penguin domain for now (backward compat)
  return penguinDomain.nameGenerator.generate(type);
}

// ID generation
let idCounter = 1000;
export function generateId(prefix: string): string {
  return `${prefix}_${idCounter++}`;
}

// Random selection
export function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function pickMultiple<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, array.length));
}

// Entity finding
export function findEntities(
  graph: Graph,
  criteria: Partial<HardState>
): HardState[] {
  const results: HardState[] = [];
  
  graph.entities.forEach(entity => {
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

  graph.relationships.forEach(rel => {
    if (relationshipKind && rel.kind !== relationshipKind) return;

    // Strength filtering
    const strength = rel.strength ?? 0.5;
    if (opts.minStrength !== undefined && strength < opts.minStrength) return;
    if (opts.maxStrength !== undefined && strength > opts.maxStrength) return;

    if ((direction === 'src' || direction === 'both') && rel.src === entityId) {
      const entity = graph.entities.get(rel.dst);
      if (entity) related.push({ entity, strength });
    }

    if ((direction === 'dst' || direction === 'both') && rel.dst === entityId) {
      const entity = graph.entities.get(rel.src);
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
  return graph.relationships.some(rel =>
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
  return graph.relationships.filter(r =>
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
  const withoutNameTags = (entity.tags || []).filter(tag => !tag.startsWith('name:'));
  const base = withoutNameTags.slice(0, 4); // reserve space for name tag
  entity.tags = [...base, `name:${slug}`];
}

// Initial state normalization
export function normalizeInitialState(entities: any[]): HardState[] {
  return entities.map(entity => ({
    id: entity.id || entity.name || generateId(entity.kind || 'unknown'),
    kind: entity.kind as HardState['kind'] || 'npc',
    subtype: entity.subtype || 'merchant',
    name: entity.name || generateName(),
    description: entity.description || '',
    status: entity.status || 'alive',
    prominence: entity.prominence as HardState['prominence'] || 'marginal',
    tags: entity.tags || [],
    links: entity.links || [],
    createdAt: 0,  // Initial entities created at tick 0
    updatedAt: 0
  }));
}

// Graph modification helpers
export function addEntity(graph: Graph, entity: Partial<HardState>): string {
  const id = generateId(entity.kind || 'unknown');

  const fullEntity: HardState = {
    id,
    kind: entity.kind || 'npc',
    subtype: entity.subtype || 'merchant',
    name: entity.name || generateName(),
    description: entity.description || '',
    status: entity.status || 'alive',
    prominence: entity.prominence || 'marginal',
    tags: entity.tags || [],
    links: entity.links || [],
    createdAt: entity.createdAt || graph.tick,
    updatedAt: entity.updatedAt || graph.tick
  };

  graph.entities.set(id, fullEntity);
  return id;
}

// Relationship strength by kind (0.0 = weak/spatial, 1.0 = strong/narrative)
const RELATIONSHIP_STRENGTHS: Record<string, number> = {
  // Strong (1.0-0.8): Narrative-defining relationships
  'member_of': 1.0,           // Faction membership defines identity
  'leader_of': 1.0,           // Leadership is core narrative
  'practitioner_of': 0.9,     // Ability practice defines character
  'originated_in': 0.9,       // Rule origins are narrative anchors
  'founded_by': 0.9,          // Foundation relationships are strong
  'mastered_by': 0.9,         // Mastery is significant

  // Medium-Strong (0.7-0.6): Important but not defining
  'controls': 0.7,            // Territorial control matters
  'commemorates': 0.7,        // Cultural memory is important
  'ally_of': 0.7,             // Alliances shape story
  'enemy_of': 0.7,            // Conflicts shape story
  'follower_of': 0.6,         // Following is notable
  'manifests_at': 0.6,        // Ability manifestation locations

  // Medium (0.5-0.4): Contextual relationships
  'friend_of': 0.5,
  'rival_of': 0.5,
  'mentor_of': 0.5,
  'family_of': 0.5,
  'lover_of': 0.5,
  'weaponized_by': 0.5,       // Faction uses ability/tech
  'kept_secret_by': 0.5,      // Faction protects secret
  'adherent_of': 0.6,         // Belief/practice (weaker than practitioner)
  'stronghold_of': 0.7,       // Political control of location

  // Weak (0.3-0.1): Spatial/contextual
  'resident_of': 0.3,         // Just where they live, not who they are
  'located_at': 0.3,
  'slumbers_beneath': 0.3,    // Spatial containment
  'discovered_by': 0.2,
  'adjacent_to': 0.2,         // Just geography
  'contains': 0.2,            // Structural containment
  'contained_by': 0.2,        // Structural containment

  // Lineage relationships (immutable - set at creation)
  'derived_from': 0.6,        // Ability/rule derived from another
  'related_to': 0.5,          // Generic same-kind similarity
  'split_from': 0.8,          // Faction lineage (important)
  'supersedes': 0.7,          // Rule replacement
  'inspired_by': 0.5,         // Influence relationship

  // Default for unknown types
  'default': 0.5
};

// ===========================
// LINEAGE RELATIONSHIP IDENTIFICATION
// ===========================

// Lineage relationships that REQUIRE cognitive/ideological/spatial distance
const LINEAGE_RELATIONSHIPS = new Set([
  'derived_from',      // Cognitive distance (abilities/rules)
  'related_to',        // Cognitive distance (same-kind similarity)
  'split_from',        // Ideological distance (factions)
  'supersedes',        // Legal distance (rules)
  'inspired_by',       // Influence distance (NPCs/abilities)
  'part_of',           // Subsumption distance (meta-entities)
  'adjacent_to',       // Spatial distance (locations)
  'contains',          // Spatial distance (locations)
  'contained_by'       // Spatial distance (locations)
]);

/**
 * Check if a relationship kind requires distance (is a lineage relationship)
 */
export function isLineageRelationship(kind: string): boolean {
  return LINEAGE_RELATIONSHIPS.has(kind);
}

/**
 * Get expected distance range for a lineage relationship kind
 * Returns undefined for non-lineage relationships
 */
export function getExpectedDistanceRange(kind: string): { min: number; max: number } | undefined {
  const ranges: Record<string, { min: number; max: number }> = {
    'derived_from': { min: 0.05, max: 0.6 },    // Incremental improvement to revolutionary
    'related_to': { min: 0.3, max: 0.7 },       // Moderate similarity
    'split_from': { min: 0.15, max: 0.8 },      // Minor disagreement to radical split
    'supersedes': { min: 0.1, max: 0.5 },       // Amendment to revolutionary
    'inspired_by': { min: 0.3, max: 0.6 },      // Moderate influence
    'part_of': { min: 0.0, max: 0.3 },          // Close subsumption
    'adjacent_to': { min: 0.0, max: 0.5 },      // Close proximity to distant
    'contains': { min: 0.0, max: 0.3 },         // Direct containment is close
    'contained_by': { min: 0.0, max: 0.3 }      // Direct containment is close
  };
  return ranges[kind];
}

// Relationship categories (immutable vs mutable)
const RELATIONSHIP_CATEGORIES: Record<string, string> = {
  // Immutable (lineage and facts - set at creation, never change)
  'derived_from': 'immutable_fact',
  'related_to': 'immutable_fact',
  'split_from': 'immutable_fact',
  'supersedes': 'immutable_fact',
  'inspired_by': 'immutable_fact',
  'adjacent_to': 'immutable_fact',
  'contained_by': 'immutable_fact',
  'part_of': 'immutable_fact',
  'founded_by': 'immutable_fact',
  'created_by': 'immutable_fact',
  'discovered_by': 'immutable_fact',

  // Mutable - Political (can change strength, can be archived)
  'trades_with': 'political',
  'at_war_with': 'political',
  'ally_of': 'political',
  'allied_with': 'political',
  'enemy_of': 'political',
  'controls': 'political',
  'stronghold_of': 'political',

  // Mutable - Social (can change strength, can be archived)
  'friend_of': 'social',
  'rival_of': 'social',
  'lover_of': 'social',
  'mentor_of': 'social',
  'family_of': 'social',
  'follower_of': 'social',

  // Mutable - Institutional (can change strength, can be archived)
  'member_of': 'institutional',
  'leader_of': 'institutional',
  'practitioner_of': 'institutional',
  'adherent_of': 'institutional',
  'weaponized_by': 'institutional',
  'kept_secret_by': 'institutional',

  // Default category if not specified
  'default': 'social'
};

// Per-kind relationship warning thresholds
const RELATIONSHIP_WARNING_THRESHOLDS: Record<string, Record<string, number>> = {
  npc: {
    default: 5,        // NPCs shouldn't have too many of any single relationship type
    member_of: 3,      // NPCs rarely in more than 3 factions
    enemy_of: 5,
    ally_of: 5,
    lover_of: 2        // Keep romantic relationships limited
  },
  location: {
    default: 15,       // Locations can have many connections
    resident_of: 50,   // Colonies can have many residents
    adjacent_to: 10
  },
  faction: {
    default: 20,       // Factions can have many members and relationships
    member_of: 50,     // Factions can have many members (as dst)
    allied_to: 8,
    enemy_of: 8
  },
  rules: {
    default: 10        // Rules can apply to multiple entities
  },
  abilities: {
    default: 10        // Abilities can be practiced by multiple entities
  }
};

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
  // Check if relationship already exists
  if (hasRelationship(graph, srcId, dstId, kind)) {
    return;
  }

  // Auto-assign strength based on relationship kind, or use override
  const strength = strengthOverride ?? (RELATIONSHIP_STRENGTHS[kind] ?? RELATIONSHIP_STRENGTHS.default);

  // Auto-assign category based on relationship kind
  const category = RELATIONSHIP_CATEGORIES[kind] ?? RELATIONSHIP_CATEGORIES.default;

  // LINEAGE ENFORCEMENT: Auto-assign distance for lineage relationships if missing
  let finalDistance = distance;
  if (finalDistance === undefined && isLineageRelationship(kind)) {
    const range = getExpectedDistanceRange(kind);
    if (range) {
      finalDistance = range.min + Math.random() * (range.max - range.min);

      // Log warning for debugging (only occasionally to avoid spam)
      if (Math.random() < 0.05) {  // 5% sample rate
        console.warn(`⚠️  Auto-adding distance to ${kind} relationship (${srcId} → ${dstId}): ${finalDistance.toFixed(3)}`);
      }
    }
  }

  // Check relationship warning thresholds (per-kind, non-blocking)
  const srcEntity = graph.entities.get(srcId);
  if (srcEntity) {
    const existingOfType = srcEntity.links.filter(link => link.kind === kind).length;
    const kindThresholds = RELATIONSHIP_WARNING_THRESHOLDS[srcEntity.kind] || {};
    const threshold = kindThresholds[kind] || kindThresholds.default || 10;

    if (existingOfType >= threshold) {
      // Write to warnings log file instead of console
      const warningMessage =
        `⚠️  RELATIONSHIP WARNING (${srcEntity.kind.toUpperCase()}):\n` +
        `   Entity: ${srcEntity.name} (${srcEntity.id})\n` +
        `   Kind: ${srcEntity.kind}\n` +
        `   Relationship Type: ${kind}\n` +
        `   Current count: ${existingOfType}\n` +
        `   Warning threshold: ${threshold}\n` +
        `   Target: ${graph.entities.get(dstId)?.name || dstId}\n` +
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

  // Add relationship (always, no hard limit) with strength, distance, and category
  graph.relationships.push({ kind, src: srcId, dst: dstId, strength, distance: finalDistance, category });

  // Update entity links
  const dstEntity = graph.entities.get(dstId);

  if (srcEntity) {
    srcEntity.links.push({ kind, src: srcId, dst: dstId, strength, distance: finalDistance, category });
    srcEntity.updatedAt = graph.tick;
  }

  if (dstEntity) {
    dstEntity.updatedAt = graph.tick;
  }
}

export function updateEntity(
  graph: Graph,
  entityId: string,
  changes: Partial<HardState>
): void {
  const entity = graph.entities.get(entityId);
  if (entity) {
    Object.assign(entity, changes, { updatedAt: graph.tick });
  }
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
  const rel = graph.relationships.find(r =>
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
  const srcEntity = graph.entities.get(src);
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
  const dstEntity = graph.entities.get(dst);
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
  const rel = graph.relationships.find(r =>
    r.src === srcId && r.dst === dstId && r.kind === kind
  );

  if (!rel) return false;

  // Update strength (clamp to 0.0-1.0)
  const currentStrength = rel.strength ?? 0.5;
  rel.strength = Math.max(0.0, Math.min(1.0, currentStrength + delta));

  // Also update in entity links
  const srcEntity = graph.entities.get(srcId);
  const dstEntity = graph.entities.get(dstId);

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
  // Define mutually exclusive relationship types
  const CONTRADICTIONS: Record<string, string[]> = {
    'enemy_of': ['lover_of', 'follower_of', 'ally_of', 'allied_with'],
    'lover_of': ['enemy_of', 'rival_of'],
    'rival_of': ['lover_of', 'follower_of', 'mentor_of'],  // Can't mentor your rival
    'follower_of': ['enemy_of', 'rival_of'],
    'at_war_with': ['allied_with'],
    'mentor_of': ['rival_of'],  // Can't mentor your rival
    'searching_for': ['lover_of', 'follower_of']  // Implies absence/distance
  };

  const incompatible = CONTRADICTIONS[newKind] || [];

  // Check if any existing relationship contradicts the new one
  const existingRelationships = graph.relationships.filter(
    r => r.src === srcId && r.dst === dstId
  );

  return !existingRelationships.some(rel => incompatible.includes(rel.kind));
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
