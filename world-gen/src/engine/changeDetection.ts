/**
 * Change Detection Module
 *
 * Detects significant changes to entities for LLM enrichment filtering.
 * Extracted from worldEngine.ts for better separation of concerns.
 */

import { HardState, Relationship } from '../types/worldTypes';
import { Graph } from '../types/engine';
import { getProminenceValue } from '../utils/helpers';

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
  const snapshot: EntitySnapshot = {
    tick: graph.tick,
    status: entity.status,
    prominence: entity.prominence,
    keyRelationshipIds: new Set(entity.links.map(l => `${l.kind}:${l.src}:${l.dst}`))
  };

  // Location-specific tracking
  if (entity.kind === 'location') {
    snapshot.residentCount = graph.relationships.filter(r =>
      r.kind === 'resident_of' && r.dst === entity.id
    ).length;

    const controller = graph.relationships.find(r =>
      (r.kind === 'stronghold_of' || r.kind === 'controls') && r.dst === entity.id
    );
    snapshot.controllerId = controller?.src;
  }

  // Faction-specific tracking
  if (entity.kind === 'faction') {
    const leader = graph.relationships.find(r =>
      r.kind === 'leader_of' && r.dst === entity.id
    );
    snapshot.leaderId = leader?.src;

    snapshot.territoryCount = graph.relationships.filter(r =>
      (r.kind === 'stronghold_of' || r.kind === 'controls') && r.src === entity.id
    ).length;

    snapshot.allyIds = new Set(
      graph.relationships
        .filter(r => r.kind === 'allied_with' && r.src === entity.id)
        .map(r => r.dst)
    );

    snapshot.enemyIds = new Set(
      graph.relationships
        .filter(r => r.kind === 'at_war_with' && r.src === entity.id)
        .map(r => r.dst)
    );
  }

  // Rule-specific tracking
  if (entity.kind === 'rules') {
    snapshot.enforcerIds = new Set(
      graph.relationships
        .filter(r => (r.kind === 'weaponized_by' || r.kind === 'kept_secret_by') && r.dst === entity.id)
        .map(r => r.src)
    );
  }

  // Ability-specific tracking
  if (entity.kind === 'abilities') {
    snapshot.practitionerCount = graph.relationships.filter(r =>
      r.kind === 'practitioner_of' && r.dst === entity.id
    ).length;

    snapshot.locationIds = new Set(
      graph.relationships
        .filter(r => r.kind === 'manifests_at' && r.src === entity.id)
        .map(r => r.dst)
    );
  }

  // NPC-specific tracking
  if (entity.kind === 'npc') {
    snapshot.leadershipIds = new Set(
      entity.links
        .filter(l => l.kind === 'leader_of')
        .map(l => l.dst)
    );
  }

  return snapshot;
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
  const currentResidents = graph.relationships.filter(r =>
    r.kind === 'resident_of' && r.dst === location.id
  );
  const residentDelta = currentResidents.length - (snapshot.residentCount || 0);
  if (Math.abs(residentDelta) >= 3) {
    changes.push(`population: ${residentDelta > 0 ? '+' : ''}${residentDelta} residents`);
  }

  // Control changes (track as dst of stronghold_of or controls)
  const currentController = graph.relationships.find(r =>
    (r.kind === 'stronghold_of' || r.kind === 'controls') && r.dst === location.id
  );
  const currentControllerId = currentController?.src;
  if (currentControllerId !== snapshot.controllerId) {
    const controller = graph.entities.get(currentControllerId || '');
    changes.push(`control: now controlled by ${controller?.name || 'none'}`);
  }

  // Prominence changes
  if (location.prominence !== snapshot.prominence) {
    changes.push(`prominence: ${snapshot.prominence} → ${location.prominence}`);
  }

  // Status changes
  if (location.status !== snapshot.status) {
    changes.push(`status: ${snapshot.status} → ${location.status}`);
  }

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
  const currentLeader = graph.relationships.find(r =>
    r.kind === 'leader_of' && r.dst === faction.id
  );
  const currentLeaderId = currentLeader?.src;
  if (currentLeaderId !== snapshot.leaderId) {
    const leader = graph.entities.get(currentLeaderId || '');
    changes.push(`leadership: ${leader?.name || 'none'} took power`);
  }

  // Territory changes (track as src of stronghold_of or controls)
  const currentTerritories = graph.relationships.filter(r =>
    (r.kind === 'stronghold_of' || r.kind === 'controls') && r.src === faction.id
  );
  const territoryDelta = currentTerritories.length - (snapshot.territoryCount || 0);
  if (territoryDelta > 0) {
    changes.push(`territory: gained ${territoryDelta} locations`);
  } else if (territoryDelta < 0) {
    changes.push(`territory: lost ${Math.abs(territoryDelta)} locations`);
  }

  // Alliance changes (track as src of allied_with)
  const currentAllies = new Set(
    graph.relationships
      .filter(r => r.kind === 'allied_with' && r.src === faction.id)
      .map(r => r.dst)
  );
  const previousAllies = snapshot.allyIds || new Set();
  const newAllies = Array.from(currentAllies).filter(id => !previousAllies.has(id));
  newAllies.forEach(allyId => {
    const ally = graph.entities.get(allyId);
    if (ally) changes.push(`alliance: allied with ${ally.name}`);
  });

  // War changes (track as src of at_war_with)
  const currentEnemies = new Set(
    graph.relationships
      .filter(r => r.kind === 'at_war_with' && r.src === faction.id)
      .map(r => r.dst)
  );
  const previousEnemies = snapshot.enemyIds || new Set();
  const newWars = Array.from(currentEnemies).filter(id => !previousEnemies.has(id));
  newWars.forEach(enemyId => {
    const enemy = graph.entities.get(enemyId);
    if (enemy) changes.push(`war: declared war on ${enemy.name}`);
  });

  // Status/prominence changes
  if (faction.status !== snapshot.status) {
    changes.push(`status: ${snapshot.status} → ${faction.status}`);
  }
  if (faction.prominence !== snapshot.prominence) {
    changes.push(`prominence: ${snapshot.prominence} → ${faction.prominence}`);
  }

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
  if (rule.status !== snapshot.status) {
    changes.push(`status: ${snapshot.status} → ${rule.status}`);
  }

  // Enforcement by factions (track as dst of weaponized_by or kept_secret_by)
  const currentEnforcers = new Set(
    graph.relationships
      .filter(r => (r.kind === 'weaponized_by' || r.kind === 'kept_secret_by') && r.dst === rule.id)
      .map(r => r.src)
  );
  const previousEnforcers = snapshot.enforcerIds || new Set();
  const newEnforcers = Array.from(currentEnforcers).filter(id => !previousEnforcers.has(id));
  newEnforcers.forEach(enforcerId => {
    const faction = graph.entities.get(enforcerId);
    if (faction) changes.push(`enforcement: ${faction.name} began enforcing this`);
  });

  // Prominence changes
  if (rule.prominence !== snapshot.prominence) {
    changes.push(`prominence: ${snapshot.prominence} → ${rule.prominence}`);
  }

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
  const currentPractitioners = graph.relationships.filter(r =>
    r.kind === 'practitioner_of' && r.dst === ability.id
  );
  const practitionerDelta = currentPractitioners.length - (snapshot.practitionerCount || 0);
  if (Math.abs(practitionerDelta) >= 3) {
    changes.push(`practitioners: ${practitionerDelta > 0 ? '+' : ''}${practitionerDelta}`);
  }

  // Spread to new locations (track as src of manifests_at)
  const currentLocations = new Set(
    graph.relationships
      .filter(r => r.kind === 'manifests_at' && r.src === ability.id)
      .map(r => r.dst)
  );
  const previousLocations = snapshot.locationIds || new Set();
  const newLocations = Array.from(currentLocations).filter(id => !previousLocations.has(id));
  newLocations.forEach(locId => {
    const location = graph.entities.get(locId);
    if (location) changes.push(`spread: now manifests at ${location.name}`);
  });

  // Prominence changes (only if notable)
  const prominenceValue = getProminenceValue(ability.prominence);
  if (ability.prominence !== snapshot.prominence && prominenceValue >= 2) {
    changes.push(`prominence: ${snapshot.prominence} → ${ability.prominence}`);
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
  const currentLeaderships = new Set(
    npc.links
      .filter(l => l.kind === 'leader_of')
      .map(l => l.dst)
  );
  const previousLeaderships = snapshot.leadershipIds || new Set();
  const newLeaderships = Array.from(currentLeaderships).filter(id => !previousLeaderships.has(id));
  newLeaderships.forEach(factionId => {
    const faction = graph.entities.get(factionId);
    if (faction) changes.push(`leadership: became leader of ${faction.name}`);
  });

  // Prominence changes
  if (npc.prominence !== snapshot.prominence) {
    changes.push(`prominence: ${snapshot.prominence} → ${npc.prominence}`);
  }

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
