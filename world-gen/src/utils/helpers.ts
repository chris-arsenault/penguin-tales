import { Graph } from '../types/engine';
import { HardState, Relationship } from '../types/worldTypes';

// Name generation
const penguinFirstNames = [
  'Frost', 'Ice', 'Snow', 'Crystal', 'Aurora', 'Storm', 'Tide', 'Wave',
  'Glacier', 'Floe', 'Drift', 'Chill', 'Blizzard', 'Shimmer', 'Glint'
];

const penguinLastNames = [
  'beak', 'wing', 'diver', 'slider', 'walker', 'swimmer', 'fisher',
  'hunter', 'watcher', 'keeper', 'breaker', 'caller', 'singer'
];

const titles = {
  hero: ['Brave', 'Bold', 'Swift', 'Mighty'],
  mayor: ['Elder', 'Wise', 'High', 'Chief'],
  merchant: ['Trader', 'Dealer', 'Master', 'Guild'],
  outlaw: ['Shadow', 'Silent', 'Quick', 'Sly'],
  leader: ['Lord', 'Commander', 'Captain', 'Chief'],
  mystic: ['Seer', 'Oracle', 'Prophet', 'Mystic']
};

export function generateName(type: string = 'default'): string {
  const first = pickRandom(penguinFirstNames);
  const last = pickRandom(penguinLastNames);
  
  if (type in titles) {
    const title = pickRandom(titles[type as keyof typeof titles]);
    return `${title} ${first}${last}`;
  }
  
  return `${first}${last}`;
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

// Relationship helpers
export function getRelated(
  graph: Graph,
  entityId: string,
  relationshipKind?: string,
  direction: 'src' | 'dst' | 'both' = 'both'
): HardState[] {
  const related: HardState[] = [];
  
  graph.relationships.forEach(rel => {
    if (relationshipKind && rel.kind !== relationshipKind) return;
    
    if ((direction === 'src' || direction === 'both') && rel.src === entityId) {
      const entity = graph.entities.get(rel.dst);
      if (entity) related.push(entity);
    }
    
    if ((direction === 'dst' || direction === 'both') && rel.dst === entityId) {
      const entity = graph.entities.get(rel.src);
      if (entity) related.push(entity);
    }
  });
  
  return related;
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

export function addRelationship(
  graph: Graph,
  kind: string,
  srcId: string,
  dstId: string
): void {
  // Check if relationship already exists
  if (hasRelationship(graph, srcId, dstId, kind)) {
    return;
  }

  // Check relationship warning thresholds (per-kind, non-blocking)
  const srcEntity = graph.entities.get(srcId);
  if (srcEntity) {
    const existingOfType = srcEntity.links.filter(link => link.kind === kind).length;
    const kindThresholds = RELATIONSHIP_WARNING_THRESHOLDS[srcEntity.kind] || {};
    const threshold = kindThresholds[kind] || kindThresholds.default || 10;

    if (existingOfType >= threshold) {
      console.warn(
        `⚠️  RELATIONSHIP WARNING (${srcEntity.kind.toUpperCase()}):\n` +
        `   Entity: ${srcEntity.name} (${srcEntity.id})\n` +
        `   Kind: ${srcEntity.kind}\n` +
        `   Relationship Type: ${kind}\n` +
        `   Current count: ${existingOfType}\n` +
        `   Warning threshold: ${threshold}\n` +
        `   Target: ${graph.entities.get(dstId)?.name || dstId}\n` +
        `   Tick: ${graph.tick}\n` +
        `   Era: ${graph.currentEra.name}\n` +
        `   ℹ️  This is a WARNING only - relationship will still be added`
      );
    }
  }

  // Add relationship (always, no hard limit)
  graph.relationships.push({ kind, src: srcId, dst: dstId });

  // Update entity links
  const dstEntity = graph.entities.get(dstId);

  if (srcEntity) {
    srcEntity.links.push({ kind, src: srcId, dst: dstId });
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
