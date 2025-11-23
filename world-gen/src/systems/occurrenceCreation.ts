import { SimulationSystem, SystemResult, Graph } from '../types/engine';
import { HardState, Relationship } from '../types/worldTypes';
import { initializeCatalyst } from '../utils/catalystHelpers';
import { generateId } from '../utils/helpers';

/**
 * Occurrence Creation System
 *
 * Framework-level system that creates occurrence entities when domain-defined
 * conditions are met. Occurrences are second-order agents - created by first-order
 * agents, then they act with their own momentum.
 *
 * Examples:
 * - War: Faction conflicts reach threshold → war occurrence created → war escalates
 * - Magical Disaster: Corruption spreads → disaster occurrence → disaster spreads
 * - Cultural Movement: Ideology spreads → movement occurrence → movement converts factions
 * - Economic Boom: Trade routes abundant → boom occurrence → boom drives expansion
 */
export const occurrenceCreation: SimulationSystem = {
  id: 'occurrence_creation',
  name: 'Major Event Occurrences',

  metadata: {
    produces: {
      relationships: [
        { kind: 'participant_in', frequency: 'rare', comment: 'Entities become participants in occurrences' },
        { kind: 'epicenter_of', frequency: 'rare', comment: 'Occurrences have geographic epicenters' },
        { kind: 'triggered_by', frequency: 'rare', comment: 'Occurrences triggered by agents' }
      ],
      modifications: [
        { type: 'entity', frequency: 'rare', comment: 'Creates occurrence entities' }
      ]
    },
    effects: {
      graphDensity: 0.3,
      clusterFormation: 0.8,
      diversityImpact: 0.6,
      comment: 'Creates macro-level events (wars, disasters) that become agents themselves'
    },
    parameters: {
      warThreshold: {
        value: 2,
        min: 1,
        max: 5,
        description: 'Minimum at_war_with relationships to trigger war occurrence'
      },
      disasterThreshold: {
        value: 2,
        min: 1,
        max: 4,
        description: 'Minimum corruption events in one tick to trigger disaster'
      },
      movementThreshold: {
        value: 3,
        min: 2,
        max: 6,
        description: 'Minimum factions sharing ideology to trigger movement'
      },
      boomThreshold: {
        value: 4,
        min: 2,
        max: 8,
        description: 'Minimum trade routes to trigger economic boom'
      }
    },
    triggers: {
      graphConditions: [
        'Multiple faction conflicts',
        'Widespread corruption',
        'Ideology spreading',
        'Trade network density'
      ],
      comment: 'Runs every tick, creates occurrences when thresholds met'
    }
  },

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const params = occurrenceCreation.metadata?.parameters || {};
    const warThreshold = params.warThreshold?.value ?? 2;
    const disasterThreshold = params.disasterThreshold?.value ?? 2;
    const movementThreshold = params.movementThreshold?.value ?? 3;
    const boomThreshold = params.boomThreshold?.value ?? 4;

    // Get occurrence creation triggers from domain config
    const occurrenceTriggers = graph.config.domain.getOccurrenceTriggers?.() || {};

    const relationshipsAdded: Relationship[] = [];
    const entitiesModified: Array<{ id: string; changes: Partial<HardState> }> = [];
    const occurrencesCreated: HardState[] = [];

    // CONDITION 1: Create war occurrence if major faction conflicts
    const warOutcome = checkForWar(graph, warThreshold, occurrenceTriggers.war);
    if (warOutcome) {
      occurrencesCreated.push(warOutcome.occurrence);
      relationshipsAdded.push(...warOutcome.relationships);

      graph.history.push({
        tick: graph.tick,
        era: graph.currentEra.id,
        type: 'special',
        description: warOutcome.description,
        entitiesCreated: [warOutcome.occurrence.id],
        relationshipsCreated: warOutcome.relationships,
        entitiesModified: []
      });
    }

    // CONDITION 2: Create magical disaster if corruption spreads
    const disasterOutcome = checkForMagicalDisaster(graph, disasterThreshold, occurrenceTriggers.magical_disaster);
    if (disasterOutcome) {
      occurrencesCreated.push(disasterOutcome.occurrence);
      relationshipsAdded.push(...disasterOutcome.relationships);

      graph.history.push({
        tick: graph.tick,
        era: graph.currentEra.id,
        type: 'special',
        description: disasterOutcome.description,
        entitiesCreated: [disasterOutcome.occurrence.id],
        relationshipsCreated: disasterOutcome.relationships,
        entitiesModified: []
      });
    }

    // CONDITION 3: Create cultural movement if ideology spreading
    const movementOutcome = checkForCulturalMovement(graph, movementThreshold, occurrenceTriggers.cultural_movement);
    if (movementOutcome) {
      occurrencesCreated.push(movementOutcome.occurrence);
      relationshipsAdded.push(...movementOutcome.relationships);

      graph.history.push({
        tick: graph.tick,
        era: graph.currentEra.id,
        type: 'special',
        description: movementOutcome.description,
        entitiesCreated: [movementOutcome.occurrence.id],
        relationshipsCreated: movementOutcome.relationships,
        entitiesModified: []
      });
    }

    // CONDITION 4: Create economic boom if trade network abundant
    const boomOutcome = checkForEconomicBoom(graph, boomThreshold, occurrenceTriggers.economic_boom);
    if (boomOutcome) {
      occurrencesCreated.push(boomOutcome.occurrence);
      relationshipsAdded.push(...boomOutcome.relationships);

      graph.history.push({
        tick: graph.tick,
        era: graph.currentEra.id,
        type: 'special',
        description: boomOutcome.description,
        entitiesCreated: [boomOutcome.occurrence.id],
        relationshipsCreated: boomOutcome.relationships,
        entitiesModified: []
      });
    }

    // Add created occurrences to graph
    occurrencesCreated.forEach(occ => {
      graph.entities.set(occ.id, occ);
    });

    return {
      relationshipsAdded,
      entitiesModified,
      pressureChanges: {},
      description: occurrencesCreated.length > 0
        ? `Major occurrences emerge (${occurrencesCreated.length}: ${occurrencesCreated.map(o => o.name).join(', ')})`
        : 'No major occurrences this cycle'
    };
  }
};

/**
 * Check if conditions are met for war occurrence
 */
function checkForWar(
  graph: Graph,
  threshold: number,
  trigger?: any
): OccurrenceOutcome | null {
  // Find faction conflicts
  const warRelationships = graph.relationships.filter(rel =>
    rel.kind === 'at_war_with' &&
    graph.entities.get(rel.src)?.kind === 'faction' &&
    graph.entities.get(rel.dst)?.kind === 'faction'
  );

  if (warRelationships.length < threshold) return null;

  // Group conflicts - look for multi-faction wars
  const conflictClusters = findConflictClusters(graph, warRelationships);

  // Find largest cluster
  const largestCluster = conflictClusters.reduce((max, cluster) =>
    cluster.factions.length > max.factions.length ? cluster : max
  , { factions: [] as HardState[], center: null as HardState | null });

  if (largestCluster.factions.length < 2) return null;

  // Check if war occurrence already exists for this cluster
  const existingWar = Array.from(graph.entities.values()).find(e =>
    e.kind === 'occurrence' &&
    e.subtype === 'war' &&
    e.status !== 'ended' &&
    largestCluster.factions.some(f =>
      e.links.some(l => l.kind === 'participant_in' && l.dst === f.id)
    )
  );

  if (existingWar) return null; // War already exists

  // Create war occurrence
  const warId = generateId('occurrence');
  const factionNames = largestCluster.factions.slice(0, 2).map(f => f.name);
  const warName = trigger?.nameGenerator?.(factionNames) ||
    `The ${factionNames[0]}-${factionNames[1]} Conflict`;

  const warOccurrence: HardState = {
    id: warId,
    kind: 'occurrence',
    subtype: 'war',
    name: warName,
    description: `A major conflict between ${largestCluster.factions.length} factions`,
    status: 'active',
    prominence: 'recognized',
    tags: ['war', 'conflict', 'violence'],
    links: [],
    createdAt: graph.tick,
    updatedAt: graph.tick,
    temporal: {
      startTick: graph.tick,
      endTick: null
    }
  };

  // Initialize catalyst properties
  initializeCatalyst(warOccurrence, true, ['military', 'conflict_escalation', 'political'], 0.7);

  // Create participant relationships
  const relationships: Relationship[] = [];
  largestCluster.factions.forEach(faction => {
    relationships.push({
      kind: 'participant_in',
      src: faction.id,
      dst: warId,
      strength: 1.0,
      catalyzedBy: faction.id,
      createdAt: graph.tick
    });

    warOccurrence.links.push({
      kind: 'participant_in',
      src: faction.id,
      dst: warId
    });
  });

  // Add epicenter if there's a contested location
  const contestedLocation = findContestedLocation(graph, largestCluster.factions);
  if (contestedLocation) {
    relationships.push({
      kind: 'epicenter_of',
      src: warId,
      dst: contestedLocation.id,
      strength: 1.0,
      createdAt: graph.tick
    });

    warOccurrence.links.push({
      kind: 'epicenter_of',
      src: warId,
      dst: contestedLocation.id
    });
  }

  return {
    occurrence: warOccurrence,
    relationships,
    description: `${warName} erupts between ${largestCluster.factions.length} factions`
  };
}

/**
 * Check if conditions are met for magical disaster occurrence
 */
function checkForMagicalDisaster(
  graph: Graph,
  threshold: number,
  trigger?: any
): OccurrenceOutcome | null {
  // Find recent corruption events (this tick only)
  const recentCorruption = graph.relationships.filter(rel =>
    rel.kind === 'corrupted_by' &&
    rel.createdAt === graph.tick
  );

  if (recentCorruption.length < threshold) return null;

  // Check if disaster already exists
  const existingDisaster = Array.from(graph.entities.values()).find(e =>
    e.kind === 'occurrence' &&
    e.subtype === 'magical_disaster' &&
    e.status === 'active'
  );

  if (existingDisaster) return null;

  // Create disaster occurrence
  const disasterId = generateId('occurrence');
  const disasterName = trigger?.nameGenerator?.() || `The Corruption Cascade`;

  const disaster: HardState = {
    id: disasterId,
    kind: 'occurrence',
    subtype: 'magical_disaster',
    name: disasterName,
    description: `Magical corruption spreads uncontrollably`,
    status: 'active',
    prominence: 'renowned',
    tags: ['disaster', 'magic', 'corruption'],
    links: [],
    createdAt: graph.tick,
    updatedAt: graph.tick,
    temporal: {
      startTick: graph.tick,
      endTick: null
    }
  };

  initializeCatalyst(disaster, true, ['magical', 'disaster_spread'], 0.8);

  const relationships: Relationship[] = [];

  // Find epicenter (most corrupted location)
  const corruptedLocations = new Map<string, number>();
  recentCorruption.forEach(rel => {
    const locId = rel.src;
    corruptedLocations.set(locId, (corruptedLocations.get(locId) || 0) + 1);
  });

  if (corruptedLocations.size > 0) {
    const epicenterId = Array.from(corruptedLocations.entries())
      .reduce((max, [id, count]) => count > max.count ? { id, count } : max, { id: '', count: 0 })
      .id;

    relationships.push({
      kind: 'epicenter_of',
      src: disasterId,
      dst: epicenterId,
      strength: 1.0,
      createdAt: graph.tick
    });

    disaster.links.push({
      kind: 'epicenter_of',
      src: disasterId,
      dst: epicenterId
    });
  }

  return {
    occurrence: disaster,
    relationships,
    description: `${disasterName} unleashed as corruption spreads`
  };
}

/**
 * Check if conditions are met for cultural movement occurrence
 */
function checkForCulturalMovement(
  graph: Graph,
  threshold: number,
  trigger?: any
): OccurrenceOutcome | null {
  // Find rules with multiple adopters
  const ruleAdoption = new Map<string, HardState[]>();

  graph.relationships.forEach(rel => {
    if (rel.kind === 'weaponized_by' || rel.kind === 'kept_secret_by') {
      const rule = graph.entities.get(rel.dst);
      const faction = graph.entities.get(rel.src);
      if (rule && faction && rule.kind === 'rules' && faction.kind === 'faction') {
        if (!ruleAdoption.has(rule.id)) {
          ruleAdoption.set(rule.id, []);
        }
        ruleAdoption.get(rule.id)!.push(faction);
      }
    }
  });

  // Find rules with enough adopters
  const widelyAdoptedRules = Array.from(ruleAdoption.entries())
    .filter(([_, factions]) => factions.length >= threshold);

  if (widelyAdoptedRules.length === 0) return null;

  // Pick most widely adopted
  const [ruleId, factions] = widelyAdoptedRules[0];
  const rule = graph.entities.get(ruleId);
  if (!rule) return null;

  // Check if movement already exists
  const existingMovement = Array.from(graph.entities.values()).find(e =>
    e.kind === 'occurrence' &&
    e.subtype === 'cultural_movement' &&
    e.status === 'active' &&
    e.links.some(l => l.dst === ruleId)
  );

  if (existingMovement) return null;

  // Create cultural movement occurrence
  const movementId = generateId('occurrence');
  const movementName = trigger?.nameGenerator?.(rule.name) ||
    `The ${rule.name} Movement`;

  const movement: HardState = {
    id: movementId,
    kind: 'occurrence',
    subtype: 'cultural_movement',
    name: movementName,
    description: `Widespread adoption of ${rule.name}`,
    status: 'active',
    prominence: 'recognized',
    tags: ['cultural', 'ideology', 'movement'],
    links: [],
    createdAt: graph.tick,
    updatedAt: graph.tick,
    temporal: {
      startTick: graph.tick,
      endTick: null
    }
  };

  initializeCatalyst(movement, true, ['cultural', 'political'], 0.6);

  const relationships: Relationship[] = [];

  // Add participants
  factions.forEach(faction => {
    relationships.push({
      kind: 'participant_in',
      src: faction.id,
      dst: movementId,
      strength: 1.0,
      catalyzedBy: faction.id,
      createdAt: graph.tick
    });

    movement.links.push({
      kind: 'participant_in',
      src: faction.id,
      dst: movementId
    });
  });

  return {
    occurrence: movement,
    relationships,
    description: `${movementName} spreads across ${factions.length} factions`
  };
}

/**
 * Check if conditions are met for economic boom occurrence
 */
function checkForEconomicBoom(
  graph: Graph,
  threshold: number,
  trigger?: any
): OccurrenceOutcome | null {
  // Count trade-related relationships
  const tradeRoutes = graph.relationships.filter(rel =>
    rel.kind === 'trades_with' || rel.kind === 'monopolizes'
  );

  if (tradeRoutes.length < threshold) return null;

  // Check if boom already exists
  const existingBoom = Array.from(graph.entities.values()).find(e =>
    e.kind === 'occurrence' &&
    e.subtype === 'economic_boom' &&
    e.status === 'active'
  );

  if (existingBoom) return null;

  // Create economic boom occurrence
  const boomId = generateId('occurrence');
  const boomName = trigger?.nameGenerator?.() || `The Prosperity Era`;

  const boom: HardState = {
    id: boomId,
    kind: 'occurrence',
    subtype: 'economic_boom',
    name: boomName,
    description: `Economic prosperity driven by ${tradeRoutes.length} trade connections`,
    status: 'active',
    prominence: 'recognized',
    tags: ['economic', 'prosperity', 'trade'],
    links: [],
    createdAt: graph.tick,
    updatedAt: graph.tick,
    temporal: {
      startTick: graph.tick,
      endTick: null
    }
  };

  initializeCatalyst(boom, true, ['economic', 'environmental'], 0.7);

  return {
    occurrence: boom,
    relationships: [],
    description: `${boomName} begins as trade flourishes`
  };
}

/**
 * Helper: Find conflict clusters
 */
function findConflictClusters(
  graph: Graph,
  warRelationships: Relationship[]
): Array<{ factions: HardState[]; center: HardState | null }> {
  const clusters: Array<{ factions: HardState[]; center: HardState | null }> = [];

  // Simple clustering: each war relationship is a cluster
  warRelationships.forEach(rel => {
    const src = graph.entities.get(rel.src);
    const dst = graph.entities.get(rel.dst);
    if (src && dst) {
      clusters.push({
        factions: [src, dst],
        center: null
      });
    }
  });

  return clusters;
}

/**
 * Helper: Find contested location
 */
function findContestedLocation(
  graph: Graph,
  factions: HardState[]
): HardState | null {
  // Find locations controlled by different factions in conflict
  const locations = Array.from(graph.entities.values())
    .filter(e => e.kind === 'location');

  for (const loc of locations) {
    const controllers = graph.relationships
      .filter(rel => rel.kind === 'controls' && rel.dst === loc.id)
      .map(rel => rel.src);

    const inConflict = controllers.some(c1 =>
      controllers.some(c2 =>
        c1 !== c2 &&
        factions.some(f => f.id === c1) &&
        factions.some(f => f.id === c2)
      )
    );

    if (inConflict) return loc;
  }

  return null;
}

interface OccurrenceOutcome {
  occurrence: HardState;
  relationships: Relationship[];
  description: string;
}
