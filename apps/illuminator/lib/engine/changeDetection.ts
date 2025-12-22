/**
 * Change Detection Module
 *
 * Detects significant changes to entities for LLM enrichment filtering.
 * Extracted from worldEngine.ts for better separation of concerns.
 */

import type { Graph, HardState, Relationship } from '../types';
import { getProminenceValue } from '../utils';

function countRelationships(
  graph: Graph,
  entityId: string,
  kind: string,
  direction: 'src' | 'dst' | 'both'
): number {
  return graph.getEntityRelationships(entityId, direction).filter(rel => rel.kind === kind).length;
}

function findRelationship(
  graph: Graph,
  entityId: string,
  kind: string,
  direction: 'src' | 'dst' | 'both'
): Relationship | undefined {
  return graph.getEntityRelationships(entityId, direction).find(rel => rel.kind === kind);
}

function getRelationshipIdSet(
  graph: Graph,
  entityId: string,
  kinds: string[],
  direction: 'src' | 'dst' | 'both'
): Set<string> {
  const ids = new Set<string>();
  graph.getEntityRelationships(entityId, direction).forEach(rel => {
    if (!kinds.includes(rel.kind)) return;
    if (direction === 'dst') {
      ids.add(rel.src);
    } else if (direction === 'src') {
      ids.add(rel.dst);
    } else {
      ids.add(rel.src === entityId ? rel.dst : rel.src);
    }
  });
  return ids;
}

/**
 * Entity snapshot for change detection
 * Tracks kind-specific metrics to enable world-centric enrichment
 */
export interface EntitySnapshot {
  // Common fields
  tick: number;
  status: string;
  prominence: string;
  keyRelationshipIds: Set<string>;

  // Location-specific
  residentCount?: number;
  controllerId?: string;

  // Faction-specific
  leaderId?: string;
  territoryCount?: number;
  allyIds?: Set<string>;
  enemyIds?: Set<string>;

  // Rule-specific
  enforcerIds?: Set<string>;

  // Ability-specific
  practitionerCount?: number;
  locationIds?: Set<string>;

  // NPC-specific
  leadershipIds?: Set<string>;
}

/**
 * Create a snapshot of an entity's current state
 */
export function captureEntitySnapshot(entity: HardState, graph: Graph): EntitySnapshot {
  const relationshipIds = graph
    .getEntityRelationships(entity.id, 'both')
    .map(rel => `${rel.kind}:${rel.src}:${rel.dst}`);

  const snapshot: EntitySnapshot = {
    tick: graph.tick,
    status: entity.status,
    prominence: entity.prominence,
    keyRelationshipIds: new Set(relationshipIds)
  };

  // Location-specific tracking
  if (entity.kind === 'location') {
    snapshot.residentCount = countRelationships(graph, entity.id, 'resident_of', 'dst');

    const controller = findRelationship(graph, entity.id, 'stronghold_of', 'dst') ||
                      findRelationship(graph, entity.id, 'controls', 'dst');
    snapshot.controllerId = controller?.src;
  }

  // Faction-specific tracking
  if (entity.kind === 'faction') {
    const leader = findRelationship(graph, entity.id, 'leader_of', 'dst');
    snapshot.leaderId = leader?.src;

    snapshot.territoryCount =
      countRelationships(graph, entity.id, 'stronghold_of', 'src') +
      countRelationships(graph, entity.id, 'controls', 'src');

    snapshot.allyIds = getRelationshipIdSet(graph, entity.id, ['allied_with'], 'src');
    snapshot.enemyIds = getRelationshipIdSet(graph, entity.id, ['at_war_with'], 'src');
  }

  // Rule-specific tracking
  if (entity.kind === 'rules') {
    snapshot.enforcerIds = getRelationshipIdSet(
      graph,
      entity.id,
      ['weaponized_by', 'kept_secret_by'],
      'dst'
    );
  }

  // Ability-specific tracking
  if (entity.kind === 'abilities') {
    snapshot.practitionerCount = countRelationships(graph, entity.id, 'practitioner_of', 'dst');
    snapshot.locationIds = getRelationshipIdSet(graph, entity.id, ['manifests_at'], 'src');
  }

  // NPC-specific tracking
  if (entity.kind === 'npc') {
    snapshot.leadershipIds = getRelationshipIdSet(graph, entity.id, ['leader_of'], 'src');
  }

  return snapshot;
}

/**
 * Helper: Detect relationship set changes
 */
function detectSetChanges(
  current: Set<string>,
  previous: Set<string>,
  graph: Graph,
  addMessage: (name: string) => string
): string[] {
  const changes: string[] = [];
  const added = Array.from(current).filter(id => !previous.has(id));
  added.forEach(id => {
    const entity = graph.getEntity(id);
    if (entity) changes.push(addMessage(entity.name));
  });
  return changes;
}

/**
 * Helper: Detect count-based changes
 */
function detectCountChange(
  current: number,
  previous: number,
  threshold: number,
  label: string,
  suffix: string = ''
): string | null {
  const delta = current - previous;
  if (Math.abs(delta) >= threshold) {
    const sign = delta > 0 ? '+' : '';
    return `${label}: ${sign}${delta}${suffix}`;
  }
  return null;
}

/**
 * Helper: Detect state changes (status/prominence)
 */
function detectStateChange(
  fieldName: string,
  current: string,
  previous: string
): string | null {
  if (current !== previous) {
    return `${fieldName}: ${previous} → ${current}`;
  }
  return null;
}

/**
 * Detect location-specific changes (Tier 1: Always enrich)
 */
export function detectLocationChanges(
  location: HardState,
  snapshot: EntitySnapshot,
  graph: Graph
): string[] {
  const changes: string[] = [];

  // Population changes (track as dst of resident_of)
  const currentResidents = graph.findRelationships({ kind: 'resident_of', dst: location.id });
  const change = detectCountChange(
    currentResidents.length,
    snapshot.residentCount || 0,
    3,
    'population',
    ' residents'
  );
  if (change) changes.push(change);

  // Control changes (track as dst of stronghold_of or controls)
  const locationRels = graph.getEntityRelationships(location.id, 'dst');
  const currentController = locationRels.find(r =>
    r.kind === 'stronghold_of' || r.kind === 'controls'
  );
  const currentControllerId = currentController?.src;
  if (currentControllerId !== snapshot.controllerId) {
    const controller = graph.getEntity(currentControllerId || '');
    changes.push(`control: now controlled by ${controller?.name || 'none'}`);
  }

  // Prominence and status changes
  const prominenceChange = detectStateChange('prominence', location.prominence, snapshot.prominence);
  if (prominenceChange) changes.push(prominenceChange);

  const statusChange = detectStateChange('status', location.status, snapshot.status);
  if (statusChange) changes.push(statusChange);

  return changes;
}

/**
 * Detect faction-specific changes (Tier 1: Always enrich)
 */
export function detectFactionChanges(
  faction: HardState,
  snapshot: EntitySnapshot,
  graph: Graph
): string[] {
  const changes: string[] = [];

  // Leadership changes (track as dst of leader_of)
  const leaderRels = graph.findRelationships({ kind: 'leader_of', dst: faction.id });
  const currentLeader = leaderRels[0];
  const currentLeaderId = currentLeader?.src;
  if (currentLeaderId !== snapshot.leaderId) {
    const leader = graph.getEntity(currentLeaderId || '');
    changes.push(`leadership: ${leader?.name || 'none'} took power`);
  }

  // Territory changes (track as src of stronghold_of or controls)
  const factionRels = graph.getEntityRelationships(faction.id, 'src');
  const currentTerritories = factionRels.filter(r =>
    r.kind === 'stronghold_of' || r.kind === 'controls'
  );
  const territoryDelta = currentTerritories.length - (snapshot.territoryCount || 0);
  if (territoryDelta > 0) {
    changes.push(`territory: gained ${territoryDelta} locations`);
  } else if (territoryDelta < 0) {
    changes.push(`territory: lost ${Math.abs(territoryDelta)} locations`);
  }

  // Alliance changes (track as src of allied_with)
  const currentAllies = new Set(
    graph.findRelationships({ kind: 'allied_with', src: faction.id })
      .map(r => r.dst)
  );
  changes.push(...detectSetChanges(
    currentAllies,
    snapshot.allyIds || new Set(),
    graph,
    (name) => `alliance: allied with ${name}`
  ));

  // War changes (track as src of at_war_with)
  const currentEnemies = new Set(
    graph.findRelationships({ kind: 'at_war_with', src: faction.id })
      .map(r => r.dst)
  );
  changes.push(...detectSetChanges(
    currentEnemies,
    snapshot.enemyIds || new Set(),
    graph,
    (name) => `war: declared war on ${name}`
  ));

  // Status and prominence changes
  const statusChange = detectStateChange('status', faction.status, snapshot.status);
  if (statusChange) changes.push(statusChange);

  const prominenceChange = detectStateChange('prominence', faction.prominence, snapshot.prominence);
  if (prominenceChange) changes.push(prominenceChange);

  return changes;
}

/**
 * Detect rule-specific changes (Tier 2: If prominent)
 */
export function detectRuleChanges(
  rule: HardState,
  snapshot: EntitySnapshot,
  graph: Graph
): string[] {
  const changes: string[] = [];

  // Only enrich if rule is prominent
  const prominenceValue = getProminenceValue(rule.prominence);
  if (prominenceValue < 2) return changes; // Skip if not 'recognized' or higher

  // Status changes (proposed → enacted → repealed → forgotten)
  const statusChange = detectStateChange('status', rule.status, snapshot.status);
  if (statusChange) changes.push(statusChange);

  // Enforcement by factions (track as dst of weaponized_by or kept_secret_by)
  const ruleRels = graph.getEntityRelationships(rule.id, 'dst');
  const currentEnforcers = new Set(
    ruleRels
      .filter(r => r.kind === 'weaponized_by' || r.kind === 'kept_secret_by')
      .map(r => r.src)
  );
  changes.push(...detectSetChanges(
    currentEnforcers,
    snapshot.enforcerIds || new Set(),
    graph,
    (name) => `enforcement: ${name} began enforcing this`
  ));

  // Prominence changes
  const prominenceChange = detectStateChange('prominence', rule.prominence, snapshot.prominence);
  if (prominenceChange) changes.push(prominenceChange);

  return changes;
}

/**
 * Detect ability-specific changes (Tier 2: If spreading)
 */
export function detectAbilityChanges(
  ability: HardState,
  snapshot: EntitySnapshot,
  graph: Graph
): string[] {
  const changes: string[] = [];

  // Practitioner count changes (track as dst of practitioner_of)
  const currentPractitioners = graph.findRelationships({ kind: 'practitioner_of', dst: ability.id });
  const change = detectCountChange(
    currentPractitioners.length,
    snapshot.practitionerCount || 0,
    3,
    'practitioners'
  );
  if (change) changes.push(change);

  // Spread to new locations (track as src of manifests_at)
  const currentLocations = new Set(
    graph.findRelationships({ kind: 'manifests_at', src: ability.id })
      .map(r => r.dst)
  );
  changes.push(...detectSetChanges(
    currentLocations,
    snapshot.locationIds || new Set(),
    graph,
    (name) => `spread: now manifests at ${name}`
  ));

  // Prominence changes (only if notable)
  const prominenceValue = getProminenceValue(ability.prominence);
  if (ability.prominence !== snapshot.prominence && prominenceValue >= 2) {
    const prominenceChange = detectStateChange('prominence', ability.prominence, snapshot.prominence);
    if (prominenceChange) changes.push(prominenceChange);
  }

  return changes;
}

/**
 * Detect NPC-specific changes (Tier 3: Only if world-significant)
 */
export function detectNPCChanges(
  npc: HardState,
  snapshot: EntitySnapshot,
  graph: Graph
): string[] {
  const changes: string[] = [];

  // Only track renowned/mythic NPCs
  const prominenceValue = getProminenceValue(npc.prominence);
  if (prominenceValue < 3) return changes; // Skip if not 'renowned' or 'mythic'

  // Leadership changes (track as src of leader_of)
  const currentLeaderships = getRelationshipIdSet(graph, npc.id, ['leader_of'], 'src');
  changes.push(...detectSetChanges(
    currentLeaderships,
    snapshot.leadershipIds || new Set(),
    graph,
    (name) => `leadership: became leader of ${name}`
  ));

  // Prominence changes
  const prominenceChange = detectStateChange('prominence', npc.prominence, snapshot.prominence);
  if (prominenceChange) changes.push(prominenceChange);

  return changes;
}

/**
 * Detect changes for any entity based on its kind
 */
export function detectEntityChanges(
  entity: HardState,
  snapshot: EntitySnapshot,
  graph: Graph
): string[] {
  switch (entity.kind) {
    case 'location':
      return detectLocationChanges(entity, snapshot, graph);
    case 'faction':
      return detectFactionChanges(entity, snapshot, graph);
    case 'rules':
      return detectRuleChanges(entity, snapshot, graph);
    case 'abilities':
      return detectAbilityChanges(entity, snapshot, graph);
    case 'npc':
      return detectNPCChanges(entity, snapshot, graph);
    default:
      return [];
  }
}
