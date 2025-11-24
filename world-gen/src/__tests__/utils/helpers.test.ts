import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateId,
  pickRandom,
  pickMultiple,
  findEntities,
  getRelated,
  hasRelationship,
  getResidents,
  getLocation,
  getFactionMembers,
  getFactionLeader,
  getCoreFactionMembers,
  getStrongAllies,
  getWeakRelationships,
  getProminenceValue,
  adjustProminence,
  slugifyName,
  upsertNameTag,
  normalizeInitialState,
  addEntity,
  addRelationship,
  updateEntity,
  addRelationshipWithDistance,
  archiveRelationship,
  modifyRelationshipStrength,
  validateRelationship,
  weightedRandom,
  rollProbability,
  canFormRelationship,
  recordRelationshipFormation,
  areRelationshipsCompatible,
  getConnectionWeight,
  getFactionRelationship,
  isLineageRelationship,
  getExpectedDistanceRange
} from '../../utils/helpers';
import { Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';

// Helper function to create a mock graph
function createMockGraph(): Graph {
  return {
    entities: new Map<string, HardState>(),
    relationships: [],
    tick: 10,
    currentEra: {
      id: 'test-era',
      name: 'Test Era',
      description: 'Test',
      templateWeights: {},
      systemModifiers: {},
    },
    pressures: new Map<string, number>(),
    history: [],
    relationshipCooldowns: new Map(),
    loreRecords: [],
    discoveryState: {
      discoveredLocations: new Set(),
      discoveredAbilities: new Set(),
      currentThreshold: 1.0,
      lastDiscoveryTick: 0,
      discoveriesThisEpoch: 0
    },
    config: {
      domain: {
        schema: {},
        templates: [],
        systems: [],
        eras: [],
        pressures: [],
        initialState: [],
        nameGenerator: { generate: () => 'Test Name' },
        actionDomains: [],
        metaEntityConfigs: []
      },
      targetEntitiesPerKind: 30,
      epochLength: 20,
      simulationTicksPerGrowth: 10,
      maxTicks: 500,
      llmEnrichment: {
        enabled: false,
        batchSize: 5,
        mode: 'off' as const
      }
    } as any,
    growthMetrics: {
      relationshipsPerTick: [],
      averageGrowthRate: 0
    }
  } as Graph;
}

// Helper function to create a mock entity
function createMockEntity(overrides: Partial<HardState> = {}): HardState {
  return {
    id: 'test-id',
    kind: 'npc',
    subtype: 'merchant',
    name: 'Test Entity',
    description: 'A test entity',
    status: 'alive',
    prominence: 'marginal',
    tags: [],
    links: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  };
}

describe('ID Generation', () => {
  describe('generateId', () => {
    it('should generate ID with prefix', () => {
      const id = generateId('npc');
      expect(id).toMatch(/^npc_\d+$/);
    });

    it('should generate sequential IDs', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');
      expect(id1).not.toBe(id2);

      const num1 = parseInt(id1.split('_')[1]);
      const num2 = parseInt(id2.split('_')[1]);
      expect(num2).toBe(num1 + 1);
    });

    it('should handle different prefixes', () => {
      const npcId = generateId('npc');
      const locationId = generateId('location');
      expect(npcId).toMatch(/^npc_/);
      expect(locationId).toMatch(/^location_/);
    });
  });
});

describe('Random Selection', () => {
  describe('pickRandom', () => {
    it('should return an element from array', () => {
      const array = [1, 2, 3, 4, 5];
      const picked = pickRandom(array);
      expect(array).toContain(picked);
    });

    it('should return only element for single-item array', () => {
      const array = [42];
      expect(pickRandom(array)).toBe(42);
    });

    it('should handle different types', () => {
      const strings = ['a', 'b', 'c'];
      const picked = pickRandom(strings);
      expect(typeof picked).toBe('string');
      expect(strings).toContain(picked);
    });
  });

  describe('pickMultiple', () => {
    it('should return requested number of elements', () => {
      const array = [1, 2, 3, 4, 5];
      const picked = pickMultiple(array, 3);
      expect(picked).toHaveLength(3);
    });

    it('should not exceed array length', () => {
      const array = [1, 2, 3];
      const picked = pickMultiple(array, 10);
      expect(picked).toHaveLength(3);
    });

    it('should return empty array when count is 0', () => {
      const array = [1, 2, 3];
      const picked = pickMultiple(array, 0);
      expect(picked).toHaveLength(0);
    });

    it('should return distinct elements', () => {
      const array = [1, 2, 3, 4, 5];
      const picked = pickMultiple(array, 3);
      const uniqueSet = new Set(picked);
      expect(uniqueSet.size).toBe(picked.length);
    });
  });

  describe('weightedRandom', () => {
    it('should return item based on weights', () => {
      const items = ['a', 'b', 'c'];
      const weights = [1, 0, 0];
      const picked = weightedRandom(items, weights);
      expect(picked).toBe('a');
    });

    it('should return undefined for empty array', () => {
      const picked = weightedRandom([], []);
      expect(picked).toBeUndefined();
    });

    it('should return undefined for mismatched arrays', () => {
      const picked = weightedRandom(['a', 'b'], [1]);
      expect(picked).toBeUndefined();
    });

    it('should handle zero total weight', () => {
      const items = ['a', 'b'];
      const weights = [0, 0];
      const picked = weightedRandom(items, weights);
      // When total weight is 0, random loop always falls through to last item
      expect(items).toContain(picked);
    });

    it('should handle equal weights', () => {
      const items = ['a', 'b', 'c'];
      const weights = [1, 1, 1];
      const picked = weightedRandom(items, weights);
      expect(items).toContain(picked);
    });
  });

  describe('rollProbability', () => {
    it('should return true for very high probability', () => {
      // With odds scaling, probability 1.0 becomes special case
      // Test with very high probability instead
      const results = Array(10).fill(0).map(() => rollProbability(0.99, 1.0));
      // Most should be true (probabilistic, so allow some false)
      const trueCount = results.filter(r => r).length;
      expect(trueCount).toBeGreaterThanOrEqual(8);
    });

    it('should return false for probability 0.0', () => {
      const results = Array(10).fill(0).map(() => rollProbability(0.0));
      expect(results.every(r => r === false)).toBe(true);
    });

    it('should scale probability with modifier', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.3);

      // Base probability 0.5 should pass at 0.3 random
      expect(rollProbability(0.5, 1.0)).toBe(true);

      vi.restoreAllMocks();
    });

    it('should handle era modifier > 1', () => {
      // With higher modifier (2.0), probability 0.3 becomes higher
      // odds = 0.3 / 0.7 ≈ 0.43
      // scaledOdds = 0.43^2 ≈ 0.18 (wait, that's wrong formula)
      // Actually: scaledOdds = odds^eraModifier = 0.43^2 ≈ 0.185
      // Let's test with mock that should pass
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      expect(rollProbability(0.3, 2.0)).toBe(true);
      vi.restoreAllMocks();
    });
  });
});

describe('Entity Finding', () => {
  describe('findEntities', () => {
    it('should find entities matching criteria', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1', kind: 'npc', subtype: 'merchant' });
      const entity2 = createMockEntity({ id: 'e2', kind: 'npc', subtype: 'hero' });
      const entity3 = createMockEntity({ id: 'e3', kind: 'location', subtype: 'colony' });

      graph.entities.set(entity1.id, entity1);
      graph.entities.set(entity2.id, entity2);
      graph.entities.set(entity3.id, entity3);

      const npcs = findEntities(graph, { kind: 'npc' });
      expect(npcs).toHaveLength(2);
      expect(npcs.map(e => e.id)).toContain('e1');
      expect(npcs.map(e => e.id)).toContain('e2');
    });

    it('should match multiple criteria', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1', kind: 'npc', subtype: 'merchant', status: 'alive' });
      const entity2 = createMockEntity({ id: 'e2', kind: 'npc', subtype: 'merchant', status: 'dead' });

      graph.entities.set(entity1.id, entity1);
      graph.entities.set(entity2.id, entity2);

      const results = findEntities(graph, { kind: 'npc', subtype: 'merchant', status: 'alive' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('e1');
    });

    it('should return empty array when no matches', () => {
      const graph = createMockGraph();
      const results = findEntities(graph, { kind: 'faction' });
      expect(results).toHaveLength(0);
    });

    it('should return all entities for empty criteria', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1' });
      const entity2 = createMockEntity({ id: 'e2' });

      graph.entities.set(entity1.id, entity1);
      graph.entities.set(entity2.id, entity2);

      const results = findEntities(graph, {});
      expect(results).toHaveLength(2);
    });
  });
});

describe('Relationship Queries', () => {
  describe('hasRelationship', () => {
    it('should return true when relationship exists', () => {
      const graph = createMockGraph();
      graph.relationships.push({
        kind: 'friend_of',
        src: 'e1',
        dst: 'e2',
        strength: 0.5
      });

      expect(hasRelationship(graph, 'e1', 'e2')).toBe(true);
    });

    it('should return false when relationship does not exist', () => {
      const graph = createMockGraph();
      expect(hasRelationship(graph, 'e1', 'e2')).toBe(false);
    });

    it('should filter by relationship kind', () => {
      const graph = createMockGraph();
      graph.relationships.push({
        kind: 'friend_of',
        src: 'e1',
        dst: 'e2',
        strength: 0.5
      });

      expect(hasRelationship(graph, 'e1', 'e2', 'friend_of')).toBe(true);
      expect(hasRelationship(graph, 'e1', 'e2', 'enemy_of')).toBe(false);
    });
  });

  describe('getRelated', () => {
    it('should find related entities in both directions', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1' });
      const entity2 = createMockEntity({ id: 'e2' });
      const entity3 = createMockEntity({ id: 'e3' });

      graph.entities.set(entity1.id, entity1);
      graph.entities.set(entity2.id, entity2);
      graph.entities.set(entity3.id, entity3);

      graph.relationships.push({ kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 });
      graph.relationships.push({ kind: 'friend_of', src: 'e3', dst: 'e1', strength: 0.5 });

      const related = getRelated(graph, 'e1');
      expect(related).toHaveLength(2);
      expect(related.map(e => e.id)).toContain('e2');
      expect(related.map(e => e.id)).toContain('e3');
    });

    it('should filter by direction', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1' });
      const entity2 = createMockEntity({ id: 'e2' });

      graph.entities.set(entity1.id, entity1);
      graph.entities.set(entity2.id, entity2);

      graph.relationships.push({ kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 });

      const srcRelated = getRelated(graph, 'e1', undefined, 'src');
      expect(srcRelated).toHaveLength(1);

      const dstRelated = getRelated(graph, 'e1', undefined, 'dst');
      expect(dstRelated).toHaveLength(0);
    });

    it('should filter by relationship kind', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1' });
      const entity2 = createMockEntity({ id: 'e2' });
      const entity3 = createMockEntity({ id: 'e3' });

      graph.entities.set(entity1.id, entity1);
      graph.entities.set(entity2.id, entity2);
      graph.entities.set(entity3.id, entity3);

      graph.relationships.push({ kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 });
      graph.relationships.push({ kind: 'enemy_of', src: 'e1', dst: 'e3', strength: 0.7 });

      const friends = getRelated(graph, 'e1', 'friend_of');
      expect(friends).toHaveLength(1);
      expect(friends[0].id).toBe('e2');
    });

    it('should filter by strength', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1' });
      const entity2 = createMockEntity({ id: 'e2' });
      const entity3 = createMockEntity({ id: 'e3' });

      graph.entities.set(entity1.id, entity1);
      graph.entities.set(entity2.id, entity2);
      graph.entities.set(entity3.id, entity3);

      graph.relationships.push({ kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.8 });
      graph.relationships.push({ kind: 'friend_of', src: 'e1', dst: 'e3', strength: 0.3 });

      const strongFriends = getRelated(graph, 'e1', 'friend_of', 'both', { minStrength: 0.6 });
      expect(strongFriends).toHaveLength(1);
      expect(strongFriends[0].id).toBe('e2');
    });

    it('should sort by strength when requested', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1' });
      const entity2 = createMockEntity({ id: 'e2' });
      const entity3 = createMockEntity({ id: 'e3' });

      graph.entities.set(entity1.id, entity1);
      graph.entities.set(entity2.id, entity2);
      graph.entities.set(entity3.id, entity3);

      graph.relationships.push({ kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.3 });
      graph.relationships.push({ kind: 'friend_of', src: 'e1', dst: 'e3', strength: 0.9 });

      const sorted = getRelated(graph, 'e1', 'friend_of', 'both', { sortByStrength: true });
      expect(sorted[0].id).toBe('e3'); // Strongest first
      expect(sorted[1].id).toBe('e2');
    });
  });

  describe('getResidents', () => {
    it('should find all residents of a location', () => {
      const graph = createMockGraph();
      const location = createMockEntity({ id: 'loc1', kind: 'location' });
      const npc1 = createMockEntity({ id: 'npc1' });
      const npc2 = createMockEntity({ id: 'npc2' });

      graph.entities.set(location.id, location);
      graph.entities.set(npc1.id, npc1);
      graph.entities.set(npc2.id, npc2);

      graph.relationships.push({ kind: 'resident_of', src: 'npc1', dst: 'loc1', strength: 0.3 });
      graph.relationships.push({ kind: 'resident_of', src: 'npc2', dst: 'loc1', strength: 0.3 });

      const residents = getResidents(graph, 'loc1');
      expect(residents).toHaveLength(2);
    });
  });

  describe('getLocation', () => {
    it('should return location of NPC', () => {
      const graph = createMockGraph();
      const location = createMockEntity({ id: 'loc1', kind: 'location', name: 'Test Colony' });
      const npc = createMockEntity({ id: 'npc1' });

      graph.entities.set(location.id, location);
      graph.entities.set(npc.id, npc);

      graph.relationships.push({ kind: 'resident_of', src: 'npc1', dst: 'loc1', strength: 0.3 });

      const loc = getLocation(graph, 'npc1');
      expect(loc?.id).toBe('loc1');
      expect(loc?.name).toBe('Test Colony');
    });

    it('should return undefined if no location', () => {
      const graph = createMockGraph();
      const loc = getLocation(graph, 'npc1');
      expect(loc).toBeUndefined();
    });
  });

  describe('getFactionMembers', () => {
    it('should find all faction members', () => {
      const graph = createMockGraph();
      const faction = createMockEntity({ id: 'fac1', kind: 'faction' });
      const member1 = createMockEntity({ id: 'npc1' });
      const member2 = createMockEntity({ id: 'npc2' });

      graph.entities.set(faction.id, faction);
      graph.entities.set(member1.id, member1);
      graph.entities.set(member2.id, member2);

      graph.relationships.push({ kind: 'member_of', src: 'npc1', dst: 'fac1', strength: 1.0 });
      graph.relationships.push({ kind: 'member_of', src: 'npc2', dst: 'fac1', strength: 1.0 });

      const members = getFactionMembers(graph, 'fac1');
      expect(members).toHaveLength(2);
    });
  });

  describe('getFactionLeader', () => {
    it('should return faction leader', () => {
      const graph = createMockGraph();
      const faction = createMockEntity({ id: 'fac1', kind: 'faction' });
      const leader = createMockEntity({ id: 'npc1', name: 'Leader' });

      graph.entities.set(faction.id, faction);
      graph.entities.set(leader.id, leader);

      graph.relationships.push({ kind: 'leader_of', src: 'npc1', dst: 'fac1', strength: 1.0 });

      const result = getFactionLeader(graph, 'fac1');
      expect(result?.id).toBe('npc1');
    });
  });

  describe('getCoreFactionMembers', () => {
    it('should return only strong members', () => {
      const graph = createMockGraph();
      const faction = createMockEntity({ id: 'fac1', kind: 'faction' });
      const core = createMockEntity({ id: 'npc1' });
      const weak = createMockEntity({ id: 'npc2' });

      graph.entities.set(faction.id, faction);
      graph.entities.set(core.id, core);
      graph.entities.set(weak.id, weak);

      graph.relationships.push({ kind: 'member_of', src: 'npc1', dst: 'fac1', strength: 0.9 });
      graph.relationships.push({ kind: 'member_of', src: 'npc2', dst: 'fac1', strength: 0.5 });

      const coreMembers = getCoreFactionMembers(graph, 'fac1');
      expect(coreMembers).toHaveLength(1);
      expect(coreMembers[0].id).toBe('npc1');
    });
  });

  describe('getWeakRelationships', () => {
    it('should return only weak relationships', () => {
      const graph = createMockGraph();
      const entity = createMockEntity({ id: 'e1' });

      graph.entities.set(entity.id, entity);

      graph.relationships.push({ kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.2 });
      graph.relationships.push({ kind: 'friend_of', src: 'e1', dst: 'e3', strength: 0.8 });

      const weak = getWeakRelationships(graph, 'e1');
      expect(weak).toHaveLength(1);
      expect(weak[0].dst).toBe('e2');
    });
  });
});

describe('Prominence Helpers', () => {
  describe('getProminenceValue', () => {
    it('should return correct numeric values', () => {
      expect(getProminenceValue('forgotten')).toBe(0);
      expect(getProminenceValue('marginal')).toBe(1);
      expect(getProminenceValue('recognized')).toBe(2);
      expect(getProminenceValue('renowned')).toBe(3);
      expect(getProminenceValue('mythic')).toBe(4);
    });

    it('should return 0 for unknown values', () => {
      expect(getProminenceValue('invalid' as any)).toBe(0);
    });
  });

  describe('adjustProminence', () => {
    it('should increase prominence', () => {
      expect(adjustProminence('forgotten', 1)).toBe('marginal');
      expect(adjustProminence('marginal', 2)).toBe('renowned');
    });

    it('should decrease prominence', () => {
      expect(adjustProminence('renowned', -2)).toBe('marginal');
      expect(adjustProminence('mythic', -1)).toBe('renowned');
    });

    it('should clamp at bottom', () => {
      expect(adjustProminence('forgotten', -5)).toBe('forgotten');
    });

    it('should clamp at top', () => {
      expect(adjustProminence('mythic', 5)).toBe('mythic');
    });

    it('should handle zero delta', () => {
      expect(adjustProminence('recognized', 0)).toBe('recognized');
    });
  });
});

describe('Name Tag Helpers', () => {
  describe('slugifyName', () => {
    it('should convert to lowercase', () => {
      expect(slugifyName('Test Name')).toBe('test-name');
    });

    it('should replace spaces with hyphens', () => {
      expect(slugifyName('the great penguin')).toBe('the-great-penguin');
    });

    it('should remove special characters', () => {
      expect(slugifyName('Test@#$Name!!!')).toBe('test-name');
    });

    it('should trim leading/trailing hyphens', () => {
      expect(slugifyName('  test  ')).toBe('test');
    });

    it('should handle empty string', () => {
      expect(slugifyName('')).toBe('unknown');
      expect(slugifyName('   ')).toBe('unknown');
    });

    it('should collapse multiple hyphens', () => {
      expect(slugifyName('test   name')).toBe('test-name');
    });
  });

  describe('upsertNameTag', () => {
    it('should add name tag to entity', () => {
      const entity = createMockEntity({ tags: [] });
      upsertNameTag(entity, 'Test Name');
      expect(entity.tags).toContain('name:test-name');
    });

    it('should replace existing name tag', () => {
      const entity = createMockEntity({ tags: ['name:old-name', 'other-tag'] });
      upsertNameTag(entity, 'New Name');
      expect(entity.tags).toContain('name:new-name');
      expect(entity.tags).not.toContain('name:old-name');
      expect(entity.tags).toContain('other-tag');
    });

    it('should limit tags to 5 total', () => {
      const entity = createMockEntity({ tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'] });
      upsertNameTag(entity, 'Test');
      expect(entity.tags).toHaveLength(5);
      expect(entity.tags[4]).toBe('name:test');
    });
  });
});

describe('Initial State Normalization', () => {
  describe('normalizeInitialState', () => {
    it('should add missing fields', () => {
      const entities = [
        { kind: 'npc', name: 'Test' }
      ];

      const normalized = normalizeInitialState(entities);
      expect(normalized[0]).toHaveProperty('id');
      expect(normalized[0]).toHaveProperty('createdAt', 0);
      expect(normalized[0]).toHaveProperty('updatedAt', 0);
      expect(normalized[0]).toHaveProperty('tags');
      expect(normalized[0]).toHaveProperty('links');
    });

    it('should preserve existing fields', () => {
      const entities = [
        { id: 'custom-id', kind: 'npc', name: 'Test', status: 'special' }
      ];

      const normalized = normalizeInitialState(entities);
      expect(normalized[0].id).toBe('custom-id');
      expect(normalized[0].status).toBe('special');
    });

    it('should handle empty array', () => {
      const normalized = normalizeInitialState([]);
      expect(normalized).toHaveLength(0);
    });
  });
});

describe('Graph Modification', () => {
  describe('addEntity', () => {
    it('should add entity to graph', () => {
      const graph = createMockGraph();
      const id = addEntity(graph, {
        kind: 'npc',
        name: 'Test NPC'
      });

      expect(graph.entities.has(id)).toBe(true);
      const entity = graph.entities.get(id);
      expect(entity?.name).toBe('Test NPC');
    });

    it('should generate ID', () => {
      const graph = createMockGraph();
      const id = addEntity(graph, { kind: 'npc' });
      expect(id).toMatch(/^npc_\d+$/);
    });

    it('should set defaults', () => {
      const graph = createMockGraph();
      const id = addEntity(graph, { kind: 'npc' });
      const entity = graph.entities.get(id);

      expect(entity?.prominence).toBe('marginal');
      expect(entity?.tags).toEqual([]);
      expect(entity?.links).toEqual([]);
      expect(entity?.createdAt).toBe(graph.tick);
    });
  });

  describe('addRelationship', () => {
    it('should add relationship to graph', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph.entities.set(e1.id, e1);
      graph.entities.set(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2');

      expect(graph.relationships).toHaveLength(1);
      expect(graph.relationships[0].kind).toBe('friend_of');
      expect(graph.relationships[0].src).toBe('e1');
      expect(graph.relationships[0].dst).toBe('e2');
    });

    it('should update entity links', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph.entities.set(e1.id, e1);
      graph.entities.set(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2');

      expect(e1.links).toHaveLength(1);
      expect(e1.links[0].kind).toBe('friend_of');
    });

    it('should not add duplicate relationships', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph.entities.set(e1.id, e1);
      graph.entities.set(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2');
      addRelationship(graph, 'friend_of', 'e1', 'e2');

      expect(graph.relationships).toHaveLength(1);
    });

    it('should auto-assign strength', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph.entities.set(e1.id, e1);
      graph.entities.set(e2.id, e2);

      addRelationship(graph, 'member_of', 'e1', 'e2');

      expect(graph.relationships[0].strength).toBe(1.0); // member_of is strong
    });

    it('should respect strength override', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph.entities.set(e1.id, e1);
      graph.entities.set(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2', 0.9);

      expect(graph.relationships[0].strength).toBe(0.9);
    });

    it('should auto-add distance for lineage relationships', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph.entities.set(e1.id, e1);
      graph.entities.set(e2.id, e2);

      addRelationship(graph, 'derived_from', 'e1', 'e2');

      expect(graph.relationships[0].distance).toBeDefined();
      expect(graph.relationships[0].distance).toBeGreaterThanOrEqual(0);
      expect(graph.relationships[0].distance).toBeLessThanOrEqual(1);
    });
  });

  describe('updateEntity', () => {
    it('should update entity fields', () => {
      const graph = createMockGraph();
      const entity = createMockEntity({ id: 'e1', status: 'alive' });

      graph.entities.set(entity.id, entity);

      updateEntity(graph, 'e1', { status: 'dead' });

      expect(entity.status).toBe('dead');
    });

    it('should update updatedAt', () => {
      const graph = createMockGraph();
      const entity = createMockEntity({ id: 'e1', updatedAt: 0 });

      graph.entities.set(entity.id, entity);
      graph.tick = 100;

      updateEntity(graph, 'e1', { status: 'changed' });

      expect(entity.updatedAt).toBe(100);
    });

    it('should do nothing for nonexistent entity', () => {
      const graph = createMockGraph();
      updateEntity(graph, 'nonexistent', { status: 'changed' });
      // Should not throw
      expect(graph.entities.size).toBe(0);
    });
  });

  describe('addRelationshipWithDistance', () => {
    it('should add relationship with random distance in range', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph.entities.set(e1.id, e1);
      graph.entities.set(e2.id, e2);

      addRelationshipWithDistance(graph, 'derived_from', 'e1', 'e2', { min: 0.3, max: 0.5 });

      const rel = graph.relationships[0];
      expect(rel.distance).toBeGreaterThanOrEqual(0.3);
      expect(rel.distance).toBeLessThanOrEqual(0.5);
    });

    it('should handle invalid range', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph.entities.set(e1.id, e1);
      graph.entities.set(e2.id, e2);

      // Should clamp to [0, 1]
      addRelationshipWithDistance(graph, 'test', 'e1', 'e2', { min: -1, max: 2 });

      expect(graph.relationships[0].distance).toBeGreaterThanOrEqual(0);
      expect(graph.relationships[0].distance).toBeLessThanOrEqual(1);
    });
  });

  describe('archiveRelationship', () => {
    it('should mark relationship as historical', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph.entities.set(e1.id, e1);
      graph.entities.set(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2');
      archiveRelationship(graph, 'e1', 'e2', 'friend_of');

      expect(graph.relationships[0].status).toBe('historical');
      expect(graph.relationships[0].archivedAt).toBe(graph.tick);
    });

    it('should update entity links', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph.entities.set(e1.id, e1);
      graph.entities.set(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2');
      archiveRelationship(graph, 'e1', 'e2', 'friend_of');

      expect(e1.links[0].status).toBe('historical');
    });
  });

  describe('modifyRelationshipStrength', () => {
    it('should increase strength', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph.entities.set(e1.id, e1);
      graph.entities.set(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2', 0.5);
      const result = modifyRelationshipStrength(graph, 'e1', 'e2', 'friend_of', 0.2);

      expect(result).toBe(true);
      expect(graph.relationships[0].strength).toBe(0.7);
    });

    it('should decrease strength', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph.entities.set(e1.id, e1);
      graph.entities.set(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2', 0.7);
      modifyRelationshipStrength(graph, 'e1', 'e2', 'friend_of', -0.3);

      // Use toBeCloseTo for floating point comparison
      expect(graph.relationships[0].strength).toBeCloseTo(0.4, 10);
    });

    it('should clamp to 0-1 range', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph.entities.set(e1.id, e1);
      graph.entities.set(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2', 0.5);
      modifyRelationshipStrength(graph, 'e1', 'e2', 'friend_of', 1.0);
      expect(graph.relationships[0].strength).toBe(1.0);

      modifyRelationshipStrength(graph, 'e1', 'e2', 'friend_of', -2.0);
      expect(graph.relationships[0].strength).toBe(0.0);
    });

    it('should return false for nonexistent relationship', () => {
      const graph = createMockGraph();
      const result = modifyRelationshipStrength(graph, 'e1', 'e2', 'friend_of', 0.1);
      expect(result).toBe(false);
    });
  });

  describe('validateRelationship', () => {
    it('should validate allowed relationship', () => {
      const schema = {
        relationships: {
          npc: {
            npc: ['friend_of', 'enemy_of']
          }
        }
      };

      expect(validateRelationship(schema, 'npc', 'npc', 'friend_of')).toBe(true);
    });

    it('should reject disallowed relationship', () => {
      const schema = {
        relationships: {
          npc: {
            npc: ['friend_of']
          }
        }
      };

      expect(validateRelationship(schema, 'npc', 'npc', 'enemy_of')).toBe(false);
    });

    it('should handle missing schema entry', () => {
      const schema = {
        relationships: {}
      };

      expect(validateRelationship(schema, 'npc', 'npc', 'friend_of')).toBe(false);
    });
  });
});

describe('Relationship Cooldowns', () => {
  describe('canFormRelationship', () => {
    it('should allow relationship when no cooldown', () => {
      const graph = createMockGraph();
      expect(canFormRelationship(graph, 'e1', 'lover_of', 10)).toBe(true);
    });

    it('should block relationship during cooldown', () => {
      const graph = createMockGraph();
      graph.tick = 50;
      recordRelationshipFormation(graph, 'e1', 'lover_of');

      graph.tick = 55; // 5 ticks later
      expect(canFormRelationship(graph, 'e1', 'lover_of', 10)).toBe(false);
    });

    it('should allow relationship after cooldown expires', () => {
      const graph = createMockGraph();
      graph.tick = 50;
      recordRelationshipFormation(graph, 'e1', 'lover_of');

      graph.tick = 61; // 11 ticks later
      expect(canFormRelationship(graph, 'e1', 'lover_of', 10)).toBe(true);
    });
  });

  describe('recordRelationshipFormation', () => {
    it('should record formation timestamp', () => {
      const graph = createMockGraph();
      graph.tick = 100;
      recordRelationshipFormation(graph, 'e1', 'friend_of');

      const cooldowns = graph.relationshipCooldowns.get('e1');
      expect(cooldowns?.get('friend_of')).toBe(100);
    });

    it('should update existing cooldown', () => {
      const graph = createMockGraph();
      graph.tick = 100;
      recordRelationshipFormation(graph, 'e1', 'friend_of');

      graph.tick = 150;
      recordRelationshipFormation(graph, 'e1', 'friend_of');

      const cooldowns = graph.relationshipCooldowns.get('e1');
      expect(cooldowns?.get('friend_of')).toBe(150);
    });
  });
});

describe('Relationship Compatibility', () => {
  describe('areRelationshipsCompatible', () => {
    it('should reject contradictory relationships', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph.entities.set(e1.id, e1);
      graph.entities.set(e2.id, e2);

      addRelationship(graph, 'lover_of', 'e1', 'e2');

      // Should reject enemy_of (contradicts lover_of)
      expect(areRelationshipsCompatible(graph, 'e1', 'e2', 'enemy_of')).toBe(false);
    });

    it('should allow compatible relationships', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph.entities.set(e1.id, e1);
      graph.entities.set(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2');

      // Should allow mentor_of (compatible with friend_of)
      expect(areRelationshipsCompatible(graph, 'e1', 'e2', 'mentor_of')).toBe(true);
    });

    it('should allow when no existing relationships', () => {
      const graph = createMockGraph();
      expect(areRelationshipsCompatible(graph, 'e1', 'e2', 'friend_of')).toBe(true);
    });
  });
});

describe('Connection Weight', () => {
  describe('getConnectionWeight', () => {
    it('should boost isolated entities', () => {
      const entity = createMockEntity({ links: [] });
      expect(getConnectionWeight(entity)).toBe(3.0);
    });

    it('should boost underconnected entities', () => {
      const entity = createMockEntity({
        links: [
          { kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 }
        ]
      });
      expect(getConnectionWeight(entity)).toBe(2.0);
    });

    it('should give normal weight for average connectivity', () => {
      const entity = createMockEntity({
        links: Array(4).fill({ kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 })
      });
      expect(getConnectionWeight(entity)).toBe(1.0);
    });

    it('should reduce weight for well-connected entities', () => {
      const entity = createMockEntity({
        links: Array(8).fill({ kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 })
      });
      expect(getConnectionWeight(entity)).toBe(0.5);
    });

    it('should heavily reduce hubs', () => {
      const entity = createMockEntity({
        links: Array(20).fill({ kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 })
      });
      expect(getConnectionWeight(entity)).toBe(0.2);
    });
  });
});

describe('Faction Relationships', () => {
  describe('getFactionRelationship', () => {
    it('should detect warfare', () => {
      const graph = createMockGraph();
      const faction1 = createMockEntity({ id: 'f1', kind: 'faction' });
      const faction2 = createMockEntity({ id: 'f2', kind: 'faction' });

      graph.entities.set(faction1.id, faction1);
      graph.entities.set(faction2.id, faction2);

      graph.relationships.push({ kind: 'at_war_with', src: 'f1', dst: 'f2', strength: 0.7 });

      const rel = getFactionRelationship([faction1], [faction2], graph);
      expect(rel).toBe('enemy');
    });

    it('should detect alliances', () => {
      const graph = createMockGraph();
      const faction1 = createMockEntity({ id: 'f1', kind: 'faction' });
      const faction2 = createMockEntity({ id: 'f2', kind: 'faction' });

      graph.entities.set(faction1.id, faction1);
      graph.entities.set(faction2.id, faction2);

      graph.relationships.push({ kind: 'allied_with', src: 'f1', dst: 'f2', strength: 0.7 });

      const rel = getFactionRelationship([faction1], [faction2], graph);
      expect(rel).toBe('allied');
    });

    it('should return neutral by default', () => {
      const graph = createMockGraph();
      const faction1 = createMockEntity({ id: 'f1', kind: 'faction' });
      const faction2 = createMockEntity({ id: 'f2', kind: 'faction' });

      const rel = getFactionRelationship([faction1], [faction2], graph);
      expect(rel).toBe('neutral');
    });
  });
});

describe('Lineage Relationships', () => {
  describe('isLineageRelationship', () => {
    it('should identify lineage relationships', () => {
      expect(isLineageRelationship('derived_from')).toBe(true);
      expect(isLineageRelationship('split_from')).toBe(true);
      expect(isLineageRelationship('adjacent_to')).toBe(true);
    });

    it('should reject non-lineage relationships', () => {
      expect(isLineageRelationship('friend_of')).toBe(false);
      expect(isLineageRelationship('member_of')).toBe(false);
    });
  });

  describe('getExpectedDistanceRange', () => {
    it('should return range for lineage relationships', () => {
      const range = getExpectedDistanceRange('derived_from');
      expect(range).toBeDefined();
      expect(range?.min).toBeGreaterThanOrEqual(0);
      expect(range?.max).toBeLessThanOrEqual(1);
      expect(range!.max).toBeGreaterThan(range!.min);
    });

    it('should return undefined for non-lineage relationships', () => {
      const range = getExpectedDistanceRange('friend_of');
      expect(range).toBeUndefined();
    });
  });
});
