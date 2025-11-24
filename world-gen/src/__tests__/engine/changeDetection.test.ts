/**
 * Tests for Change Detection Module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  captureEntitySnapshot,
  detectLocationChanges,
  detectFactionChanges,
  detectRuleChanges,
  detectAbilityChanges,
  detectNPCChanges,
  detectEntityChanges,
  EntitySnapshot
} from '../../engine/changeDetection';
import { Graph } from '../../types/engine';
import { HardState, Relationship, Prominence } from '../../types/worldTypes';

// Helper function to create minimal HardState for testing
function createEntity(
  id: string,
  kind: HardState['kind'],
  subtype: string = 'default',
  status: string = 'active',
  prominence: Prominence = 'recognized',
  links: Relationship[] = []
): HardState {
  return {
    id,
    kind,
    subtype,
    name: `Test ${kind}`,
    description: '',
    status,
    prominence,
    tags: [],
    links,
    createdAt: 0,
    updatedAt: 0
  };
}

// Helper function to create minimal Graph for testing
function createGraph(
  entities: HardState[],
  relationships: Relationship[] = [],
  tick: number = 100
): Graph {
  const entityMap = new Map<string, HardState>();
  entities.forEach(e => entityMap.set(e.id, e));

  return {
    entities: entityMap,
    relationships,
    tick,
    currentEra: { id: 'test', name: 'Test Era' } as any,
    pressures: new Map(),
    history: [],
    config: {} as any,
    relationshipCooldowns: new Map(),
    loreRecords: [],
    discoveryState: {
      currentThreshold: 0,
      lastDiscoveryTick: 0,
      discoveriesThisEpoch: 0
    },
    growthMetrics: {
      relationshipsPerTick: [],
      averageGrowthRate: 0
    }
  } as Graph;
}

describe('captureEntitySnapshot', () => {
  it('should capture basic entity properties', () => {
    const entity = createEntity('entity1', 'npc', 'citizen', 'alive', 'marginal');
    const graph = createGraph([entity], [], 42);

    const snapshot = captureEntitySnapshot(entity, graph);

    expect(snapshot.tick).toBe(42);
    expect(snapshot.status).toBe('alive');
    expect(snapshot.prominence).toBe('marginal');
    expect(snapshot.keyRelationshipIds).toBeInstanceOf(Set);
  });

  it('should capture location-specific metrics', () => {
    const location = createEntity('loc1', 'location', 'colony', 'active');
    const npc1 = createEntity('npc1', 'npc', 'citizen');
    const npc2 = createEntity('npc2', 'npc', 'citizen');
    const faction = createEntity('faction1', 'faction', 'guild');

    const relationships: Relationship[] = [
      { kind: 'resident_of', src: 'npc1', dst: 'loc1' },
      { kind: 'resident_of', src: 'npc2', dst: 'loc1' },
      { kind: 'stronghold_of', src: 'faction1', dst: 'loc1' }
    ];

    const graph = createGraph([location, npc1, npc2, faction], relationships);
    const snapshot = captureEntitySnapshot(location, graph);

    expect(snapshot.residentCount).toBe(2);
    expect(snapshot.controllerId).toBe('faction1');
  });

  it('should capture faction-specific metrics', () => {
    const faction = createEntity('faction1', 'faction', 'guild');
    const leader = createEntity('npc1', 'npc', 'mayor');
    const ally = createEntity('faction2', 'faction', 'guild');
    const enemy = createEntity('faction3', 'faction', 'criminal');
    const location = createEntity('loc1', 'location', 'colony');

    const relationships: Relationship[] = [
      { kind: 'leader_of', src: 'npc1', dst: 'faction1' },
      { kind: 'allied_with', src: 'faction1', dst: 'faction2' },
      { kind: 'at_war_with', src: 'faction1', dst: 'faction3' },
      { kind: 'stronghold_of', src: 'faction1', dst: 'loc1' }
    ];

    const graph = createGraph([faction, leader, ally, enemy, location], relationships);
    const snapshot = captureEntitySnapshot(faction, graph);

    expect(snapshot.leaderId).toBe('npc1');
    expect(snapshot.territoryCount).toBe(1);
    expect(snapshot.allyIds).toContain('faction2');
    expect(snapshot.enemyIds).toContain('faction3');
  });

  it('should capture rule-specific metrics', () => {
    const rule = createEntity('rule1', 'rules', 'law');
    const faction = createEntity('faction1', 'faction', 'guild');

    const relationships: Relationship[] = [
      { kind: 'weaponized_by', src: 'faction1', dst: 'rule1' }
    ];

    const graph = createGraph([rule, faction], relationships);
    const snapshot = captureEntitySnapshot(rule, graph);

    expect(snapshot.enforcerIds).toContain('faction1');
  });

  it('should capture ability-specific metrics', () => {
    const ability = createEntity('ability1', 'abilities', 'magic');
    const npc1 = createEntity('npc1', 'npc', 'hero');
    const npc2 = createEntity('npc2', 'npc', 'hero');
    const location = createEntity('loc1', 'location', 'colony');

    const relationships: Relationship[] = [
      { kind: 'practitioner_of', src: 'npc1', dst: 'ability1' },
      { kind: 'practitioner_of', src: 'npc2', dst: 'ability1' },
      { kind: 'manifests_at', src: 'ability1', dst: 'loc1' }
    ];

    const graph = createGraph([ability, npc1, npc2, location], relationships);
    const snapshot = captureEntitySnapshot(ability, graph);

    expect(snapshot.practitionerCount).toBe(2);
    expect(snapshot.locationIds).toContain('loc1');
  });

  it('should capture NPC-specific metrics', () => {
    const npc = createEntity('npc1', 'npc', 'mayor', 'alive', 'renowned', [
      { kind: 'leader_of', src: 'npc1', dst: 'faction1' },
      { kind: 'leader_of', src: 'npc1', dst: 'faction2' }
    ]);

    const graph = createGraph([npc]);
    const snapshot = captureEntitySnapshot(npc, graph);

    expect(snapshot.leadershipIds).toContain('faction1');
    expect(snapshot.leadershipIds).toContain('faction2');
  });
});

describe('detectLocationChanges', () => {
  it('should detect population increases', () => {
    const location = createEntity('loc1', 'location', 'colony');
    const npcs = Array.from({ length: 5 }, (_, i) => createEntity(`npc${i}`, 'npc', 'citizen'));

    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'recognized',
      keyRelationshipIds: new Set(),
      residentCount: 0
    };

    const relationships: Relationship[] = npcs.map(npc => ({
      kind: 'resident_of',
      src: npc.id,
      dst: 'loc1'
    }));

    const graph = createGraph([location, ...npcs], relationships);
    const changes = detectLocationChanges(location, snapshot, graph);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toContain('population: +5 residents');
  });

  it('should detect population decreases', () => {
    const location = createEntity('loc1', 'location', 'colony');
    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'recognized',
      keyRelationshipIds: new Set(),
      residentCount: 10
    };

    const graph = createGraph([location], []); // No residents now
    const changes = detectLocationChanges(location, snapshot, graph);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toContain('population: -10 residents');
  });

  it('should not report small population changes', () => {
    const location = createEntity('loc1', 'location', 'colony');
    const npcs = [createEntity('npc1', 'npc', 'citizen'), createEntity('npc2', 'npc', 'citizen')];

    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'recognized',
      keyRelationshipIds: new Set(),
      residentCount: 0
    };

    const relationships: Relationship[] = npcs.map(npc => ({
      kind: 'resident_of',
      src: npc.id,
      dst: 'loc1'
    }));

    const graph = createGraph([location, ...npcs], relationships);
    const changes = detectLocationChanges(location, snapshot, graph);

    expect(changes).toHaveLength(0); // Change of 2 is below threshold of 3
  });

  it('should detect control changes', () => {
    const location = createEntity('loc1', 'location', 'colony');
    const faction = createEntity('faction1', 'faction', 'guild');

    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'recognized',
      keyRelationshipIds: new Set(),
      controllerId: undefined
    };

    const relationships: Relationship[] = [
      { kind: 'stronghold_of', src: 'faction1', dst: 'loc1' }
    ];

    const graph = createGraph([location, faction], relationships);
    const changes = detectLocationChanges(location, snapshot, graph);

    expect(changes).toContain('control: now controlled by Test faction');
  });

  it('should detect prominence changes', () => {
    const location = createEntity('loc1', 'location', 'colony', 'active', 'renowned');
    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'marginal',
      keyRelationshipIds: new Set()
    };

    const graph = createGraph([location]);
    const changes = detectLocationChanges(location, snapshot, graph);

    expect(changes).toContain('prominence: marginal → renowned');
  });

  it('should detect status changes', () => {
    const location = createEntity('loc1', 'location', 'colony', 'waning', 'recognized');
    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'thriving',
      prominence: 'recognized',
      keyRelationshipIds: new Set()
    };

    const graph = createGraph([location]);
    const changes = detectLocationChanges(location, snapshot, graph);

    expect(changes).toContain('status: thriving → waning');
  });
});

describe('detectFactionChanges', () => {
  it('should detect leadership changes', () => {
    const faction = createEntity('faction1', 'faction', 'guild');
    const newLeader = createEntity('npc1', 'npc', 'hero');

    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'recognized',
      keyRelationshipIds: new Set(),
      leaderId: undefined
    };

    const relationships: Relationship[] = [
      { kind: 'leader_of', src: 'npc1', dst: 'faction1' }
    ];

    const graph = createGraph([faction, newLeader], relationships);
    const changes = detectFactionChanges(faction, snapshot, graph);

    expect(changes).toContain('leadership: Test npc took power');
  });

  it('should detect territory gains', () => {
    const faction = createEntity('faction1', 'faction', 'guild');
    const locations = Array.from({ length: 3 }, (_, i) => createEntity(`loc${i}`, 'location', 'colony'));

    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'recognized',
      keyRelationshipIds: new Set(),
      territoryCount: 0
    };

    const relationships: Relationship[] = locations.map(loc => ({
      kind: 'stronghold_of',
      src: 'faction1',
      dst: loc.id
    }));

    const graph = createGraph([faction, ...locations], relationships);
    const changes = detectFactionChanges(faction, snapshot, graph);

    expect(changes).toContain('territory: gained 3 locations');
  });

  it('should detect territory losses', () => {
    const faction = createEntity('faction1', 'faction', 'guild');
    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'recognized',
      keyRelationshipIds: new Set(),
      territoryCount: 5
    };

    const graph = createGraph([faction], []); // No territories now
    const changes = detectFactionChanges(faction, snapshot, graph);

    expect(changes).toContain('territory: lost 5 locations');
  });

  it('should detect new alliances', () => {
    const faction1 = createEntity('faction1', 'faction', 'guild');
    const faction2 = createEntity('faction2', 'faction', 'guild');

    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'recognized',
      keyRelationshipIds: new Set(),
      allyIds: new Set()
    };

    const relationships: Relationship[] = [
      { kind: 'allied_with', src: 'faction1', dst: 'faction2' }
    ];

    const graph = createGraph([faction1, faction2], relationships);
    const changes = detectFactionChanges(faction1, snapshot, graph);

    expect(changes).toContain('alliance: allied with Test faction');
  });

  it('should detect new wars', () => {
    const faction1 = createEntity('faction1', 'faction', 'guild');
    const faction2 = createEntity('faction2', 'faction', 'criminal');

    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'recognized',
      keyRelationshipIds: new Set(),
      enemyIds: new Set()
    };

    const relationships: Relationship[] = [
      { kind: 'at_war_with', src: 'faction1', dst: 'faction2' }
    ];

    const graph = createGraph([faction1, faction2], relationships);
    const changes = detectFactionChanges(faction1, snapshot, graph);

    expect(changes).toContain('war: declared war on Test faction');
  });
});

describe('detectRuleChanges', () => {
  it('should skip detection for non-prominent rules', () => {
    const rule = createEntity('rule1', 'rules', 'law', 'enacted', 'marginal');
    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'proposed',
      prominence: 'marginal',
      keyRelationshipIds: new Set()
    };

    const graph = createGraph([rule]);
    const changes = detectRuleChanges(rule, snapshot, graph);

    expect(changes).toHaveLength(0); // Skipped due to low prominence
  });

  it('should detect status changes for prominent rules', () => {
    const rule = createEntity('rule1', 'rules', 'law', 'enacted', 'renowned');
    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'proposed',
      prominence: 'renowned',
      keyRelationshipIds: new Set()
    };

    const graph = createGraph([rule]);
    const changes = detectRuleChanges(rule, snapshot, graph);

    expect(changes).toContain('status: proposed → enacted');
  });

  it('should detect new enforcers', () => {
    const rule = createEntity('rule1', 'rules', 'law', 'enacted', 'recognized');
    const faction = createEntity('faction1', 'faction', 'guild');

    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'enacted',
      prominence: 'recognized',
      keyRelationshipIds: new Set(),
      enforcerIds: new Set()
    };

    const relationships: Relationship[] = [
      { kind: 'weaponized_by', src: 'faction1', dst: 'rule1' }
    ];

    const graph = createGraph([rule, faction], relationships);
    const changes = detectRuleChanges(rule, snapshot, graph);

    expect(changes).toContain('enforcement: Test faction began enforcing this');
  });

  it('should detect prominence changes', () => {
    const rule = createEntity('rule1', 'rules', 'law', 'enacted', 'renowned');
    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'enacted',
      prominence: 'recognized',
      keyRelationshipIds: new Set()
    };

    const graph = createGraph([rule]);
    const changes = detectRuleChanges(rule, snapshot, graph);

    expect(changes).toContain('prominence: recognized → renowned');
  });
});

describe('detectAbilityChanges', () => {
  it('should detect practitioner increases', () => {
    const ability = createEntity('ability1', 'abilities', 'magic');
    const npcs = Array.from({ length: 5 }, (_, i) => createEntity(`npc${i}`, 'npc', 'hero'));

    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'recognized',
      keyRelationshipIds: new Set(),
      practitionerCount: 0
    };

    const relationships: Relationship[] = npcs.map(npc => ({
      kind: 'practitioner_of',
      src: npc.id,
      dst: 'ability1'
    }));

    const graph = createGraph([ability, ...npcs], relationships);
    const changes = detectAbilityChanges(ability, snapshot, graph);

    expect(changes).toContain('practitioners: +5');
  });

  it('should detect spread to new locations', () => {
    const ability = createEntity('ability1', 'abilities', 'magic');
    const location = createEntity('loc1', 'location', 'colony');

    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'recognized',
      keyRelationshipIds: new Set(),
      locationIds: new Set()
    };

    const relationships: Relationship[] = [
      { kind: 'manifests_at', src: 'ability1', dst: 'loc1' }
    ];

    const graph = createGraph([ability, location], relationships);
    const changes = detectAbilityChanges(ability, snapshot, graph);

    expect(changes).toContain('spread: now manifests at Test location');
  });

  it('should only report prominence changes for notable abilities', () => {
    const recognizedAbility = createEntity('ability1', 'abilities', 'magic', 'active', 'recognized');
    const marginalAbility = createEntity('ability2', 'abilities', 'magic', 'active', 'marginal');

    const recognizedSnapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'marginal',
      keyRelationshipIds: new Set()
    };

    const marginalSnapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'forgotten',
      keyRelationshipIds: new Set()
    };

    const graph1 = createGraph([recognizedAbility]);
    const graph2 = createGraph([marginalAbility]);

    const changes1 = detectAbilityChanges(recognizedAbility, recognizedSnapshot, graph1);
    const changes2 = detectAbilityChanges(marginalAbility, marginalSnapshot, graph2);

    expect(changes1).toContain('prominence: marginal → recognized');
    expect(changes2).toHaveLength(0); // No prominence change reported for low prominence
  });
});

describe('detectNPCChanges', () => {
  it('should skip detection for non-renowned NPCs', () => {
    const npc = createEntity('npc1', 'npc', 'citizen', 'alive', 'recognized');
    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'alive',
      prominence: 'recognized',
      keyRelationshipIds: new Set()
    };

    const graph = createGraph([npc]);
    const changes = detectNPCChanges(npc, snapshot, graph);

    expect(changes).toHaveLength(0); // Skipped due to insufficient prominence
  });

  it('should detect leadership changes for renowned NPCs', () => {
    const npc = createEntity('npc1', 'npc', 'hero', 'alive', 'renowned', [
      { kind: 'leader_of', src: 'npc1', dst: 'faction1' }
    ]);
    const faction = createEntity('faction1', 'faction', 'guild');

    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'alive',
      prominence: 'renowned',
      keyRelationshipIds: new Set(),
      leadershipIds: new Set()
    };

    const graph = createGraph([npc, faction]);
    const changes = detectNPCChanges(npc, snapshot, graph);

    expect(changes).toContain('leadership: became leader of Test faction');
  });

  it('should detect prominence changes for mythic NPCs', () => {
    const npc = createEntity('npc1', 'npc', 'hero', 'alive', 'mythic');
    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'alive',
      prominence: 'renowned',
      keyRelationshipIds: new Set()
    };

    const graph = createGraph([npc]);
    const changes = detectNPCChanges(npc, snapshot, graph);

    expect(changes).toContain('prominence: renowned → mythic');
  });
});

describe('detectEntityChanges', () => {
  it('should route to location detection', () => {
    const location = createEntity('loc1', 'location', 'colony', 'waning');
    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'thriving',
      prominence: 'recognized',
      keyRelationshipIds: new Set()
    };

    const graph = createGraph([location]);
    const changes = detectEntityChanges(location, snapshot, graph);

    expect(changes).toContain('status: thriving → waning');
  });

  it('should route to faction detection', () => {
    const faction = createEntity('faction1', 'faction', 'guild', 'declining');
    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'ascendant',
      prominence: 'recognized',
      keyRelationshipIds: new Set()
    };

    const graph = createGraph([faction]);
    const changes = detectEntityChanges(faction, snapshot, graph);

    expect(changes).toContain('status: ascendant → declining');
  });

  it('should route to rule detection', () => {
    const rule = createEntity('rule1', 'rules', 'law', 'repealed', 'recognized');
    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'enacted',
      prominence: 'recognized',
      keyRelationshipIds: new Set()
    };

    const graph = createGraph([rule]);
    const changes = detectEntityChanges(rule, snapshot, graph);

    expect(changes).toContain('status: enacted → repealed');
  });

  it('should route to ability detection', () => {
    const ability = createEntity('ability1', 'abilities', 'magic');
    const npcs = Array.from({ length: 5 }, (_, i) => createEntity(`npc${i}`, 'npc', 'hero'));

    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'recognized',
      keyRelationshipIds: new Set(),
      practitionerCount: 0
    };

    const relationships: Relationship[] = npcs.map(npc => ({
      kind: 'practitioner_of',
      src: npc.id,
      dst: 'ability1'
    }));

    const graph = createGraph([ability, ...npcs], relationships);
    const changes = detectEntityChanges(ability, snapshot, graph);

    expect(changes).toContain('practitioners: +5');
  });

  it('should route to NPC detection', () => {
    const npc = createEntity('npc1', 'npc', 'hero', 'alive', 'mythic', [
      { kind: 'leader_of', src: 'npc1', dst: 'faction1' }
    ]);
    const faction = createEntity('faction1', 'faction', 'guild');

    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'alive',
      prominence: 'mythic',
      keyRelationshipIds: new Set(),
      leadershipIds: new Set()
    };

    const graph = createGraph([npc, faction]);
    const changes = detectEntityChanges(npc, snapshot, graph);

    expect(changes).toContain('leadership: became leader of Test faction');
  });

  it('should return empty array for unknown entity kind', () => {
    const entity = createEntity('occ1', 'occurrence' as any, 'war');
    const snapshot: EntitySnapshot = {
      tick: 90,
      status: 'active',
      prominence: 'recognized',
      keyRelationshipIds: new Set()
    };

    const graph = createGraph([entity]);
    const changes = detectEntityChanges(entity, snapshot, graph);

    expect(changes).toEqual([]);
  });
});
