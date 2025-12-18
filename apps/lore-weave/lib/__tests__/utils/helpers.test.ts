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
  normalizeInitialState,
  addEntity,
  addRelationship,
  updateEntity,
  archiveRelationship,
  modifyRelationshipStrength,
  weightedRandom,
  rollProbability,
  canFormRelationship,
  recordRelationshipFormation,
  getConnectionWeight,
  getFactionRelationship
} from '../../utils';
import { Graph } from '../../engine/types';
import { HardState, Relationship } from '../../core/worldTypes';

// Helper function to create a mock graph with the new Graph API methods
function createMockGraph(): Graph {
  const _entities = new Map<string, HardState>();
  let _relationships: Relationship[] = [];

  return {
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
    rateLimitState: {
      currentThreshold: 1.0,
      lastCreationTick: 0,
      creationsThisEpoch: 0
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
        metaEntityConfigs: [],
        // Methods for lineage relationship checking
        isLineageRelationship: (kind: string) => ['derived_from', 'split_from', 'adjacent_to'].includes(kind),
        getExpectedDistanceRange: (kind: string) => {
          if (['derived_from', 'split_from', 'adjacent_to'].includes(kind)) {
            return { min: 0.1, max: 0.9 };
          }
          return undefined;
        },
        // Method for relationship conflict checking
        checkRelationshipConflict: (existingKinds: string[], newKind: string) => {
          // enemy_of conflicts with lover_of and vice versa
          if (newKind === 'enemy_of' && existingKinds.includes('lover_of')) return true;
          if (newKind === 'lover_of' && existingKinds.includes('enemy_of')) return true;
          return false;
        },
        // Method for relationship strength lookup
        getRelationshipStrength: (kind: string) => {
          const strengthMap: Record<string, number> = {
            member_of: 1.0,
            leader_of: 1.0,
            friend_of: 0.7,
            enemy_of: 0.8
          };
          return strengthMap[kind] ?? 0.5;
        },
        // Method for relationship category lookup
        getRelationshipCategory: (kind: string) => {
          const categoryMap: Record<string, string> = {
            member_of: 'membership',
            leader_of: 'membership',
            friend_of: 'social',
            enemy_of: 'conflict'
          };
          return categoryMap[kind] ?? 'social';
        }
      },
      targetEntitiesPerKind: 30,
      ticksPerEpoch: 10,
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
    },

    // Entity read methods
    getEntity(id: string): HardState | undefined {
      const entity = _entities.get(id);
      return entity ? { ...entity, tags: { ...entity.tags }, links: [...entity.links] } : undefined;
    },
    hasEntity(id: string): boolean {
      return _entities.has(id);
    },
    getEntityCount(): number {
      return _entities.size;
    },
    getEntities(): HardState[] {
      return Array.from(_entities.values()).map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
    },
    getEntityIds(): string[] {
      return Array.from(_entities.keys());
    },
    forEachEntity(callback: (entity: HardState, id: string) => void): void {
      _entities.forEach((entity, id) => {
        callback({ ...entity, tags: { ...entity.tags }, links: [...entity.links] }, id);
      });
    },
    findEntities(criteria: { kind?: string; subtype?: string; status?: string; prominence?: string; culture?: string; tag?: string; exclude?: string[] }): HardState[] {
      return Array.from(_entities.values())
        .filter(e => {
          if (criteria.kind && e.kind !== criteria.kind) return false;
          if (criteria.subtype && e.subtype !== criteria.subtype) return false;
          if (criteria.status && e.status !== criteria.status) return false;
          if (criteria.prominence && e.prominence !== criteria.prominence) return false;
          if (criteria.culture && e.culture !== criteria.culture) return false;
          if (criteria.tag && !(criteria.tag in e.tags)) return false;
          if (criteria.exclude && criteria.exclude.includes(e.id)) return false;
          return true;
        })
        .map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
    },
    getEntitiesByKind(kind: string): HardState[] {
      return Array.from(_entities.values())
        .filter(e => e.kind === kind)
        .map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
    },
    getConnectedEntities(entityId: string, relationKind?: string): HardState[] {
      const connectedIds = new Set<string>();
      _relationships.forEach(r => {
        if (relationKind && r.kind !== relationKind) return;
        if (r.src === entityId) connectedIds.add(r.dst);
        if (r.dst === entityId) connectedIds.add(r.src);
      });
      return Array.from(connectedIds)
        .map(id => _entities.get(id))
        .filter((e): e is HardState => e !== undefined)
        .map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
    },

    // Entity mutation methods
    createEntity(settings: any): string {
      const id = `${settings.kind}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const tags = settings.tags || {};
      const name = settings.name || `Test ${settings.kind}`;
      const entity: HardState = {
        id, kind: settings.kind, subtype: settings.subtype, name,
        description: settings.description || '', status: settings.status || 'active',
        prominence: settings.prominence || 'marginal', culture: settings.culture || 'world',
        tags, links: [], coordinates: settings.coordinates, createdAt: 10, updatedAt: 10
      };
      _entities.set(id, entity);
      return id;
    },
    updateEntity(id: string, changes: Partial<HardState>): boolean {
      const entity = _entities.get(id);
      if (!entity) return false;
      Object.assign(entity, changes);
      entity.updatedAt = this.tick;
      return true;
    },
    deleteEntity(id: string): boolean {
      return _entities.delete(id);
    },
    _loadEntity(id: string, entity: HardState): void {
      _entities.set(id, entity);
    },

    // Relationship read methods
    getRelationships(): Relationship[] {
      return [..._relationships];
    },
    getRelationshipCount(): number {
      return _relationships.length;
    },
    findRelationships(criteria: { kind?: string; src?: string; dst?: string; category?: string; minStrength?: number }): Relationship[] {
      return _relationships.filter(r => {
        if (criteria.kind && r.kind !== criteria.kind) return false;
        if (criteria.src && r.src !== criteria.src) return false;
        if (criteria.dst && r.dst !== criteria.dst) return false;
        if (criteria.minStrength !== undefined && (r.strength ?? 0.5) < criteria.minStrength) return false;
        return true;
      });
    },
    getEntityRelationships(entityId: string, direction?: 'src' | 'dst' | 'both'): Relationship[] {
      return _relationships.filter(r => {
        if (direction === 'src') return r.src === entityId;
        if (direction === 'dst') return r.dst === entityId;
        return r.src === entityId || r.dst === entityId;
      });
    },
    hasRelationship(srcId: string, dstId: string, kind?: string): boolean {
      return _relationships.some(r =>
        r.src === srcId && r.dst === dstId && (!kind || r.kind === kind)
      );
    },

    // Relationship mutation methods
    addRelationship(kind: string, srcId: string, dstId: string, strength?: number, _distanceIgnored?: number, category?: string): boolean {
      const exists = _relationships.some(r => r.src === srcId && r.dst === dstId && r.kind === kind);
      if (exists) return false;

      // Compute distance from coordinates (relationship.distance === Euclidean distance)
      const srcEntity = _entities.get(srcId);
      const dstEntity = _entities.get(dstId);
      let distance: number | undefined;
      if (srcEntity?.coordinates && dstEntity?.coordinates) {
        const dx = srcEntity.coordinates.x - dstEntity.coordinates.x;
        const dy = srcEntity.coordinates.y - dstEntity.coordinates.y;
        const dz = (srcEntity.coordinates.z ?? 0) - (dstEntity.coordinates.z ?? 0);
        distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      }

      const relationship: Relationship = { kind, src: srcId, dst: dstId, strength: strength ?? 0.5, distance, category, status: 'active' };
      _relationships.push(relationship);
      if (srcEntity) {
        srcEntity.links.push({ ...relationship });
        srcEntity.updatedAt = 10;
      }
      return true;
    },
    removeRelationship(srcId: string, dstId: string, kind: string): boolean {
      const idx = _relationships.findIndex(r => r.src === srcId && r.dst === dstId && r.kind === kind);
      if (idx >= 0) {
        _relationships.splice(idx, 1);
        const srcEntity = _entities.get(srcId);
        if (srcEntity) {
          srcEntity.links = srcEntity.links.filter(l => !(l.src === srcId && l.dst === dstId && l.kind === kind));
          srcEntity.updatedAt = 10;
        }
        return true;
      }
      return false;
    },
    _setRelationships(rels: Relationship[]): void {
      _relationships = rels;
    },
    // Test helper: load relationship directly without validation
    _loadRelationship(rel: Relationship): void {
      _relationships.push(rel);
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
    culture: 'world',
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

      graph._loadEntity(entity1.id, entity1);
      graph._loadEntity(entity2.id, entity2);
      graph._loadEntity(entity3.id, entity3);

      const npcs = findEntities(graph, { kind: 'npc' });
      expect(npcs).toHaveLength(2);
      expect(npcs.map(e => e.id)).toContain('e1');
      expect(npcs.map(e => e.id)).toContain('e2');
    });

    it('should match multiple criteria', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1', kind: 'npc', subtype: 'merchant', status: 'alive' });
      const entity2 = createMockEntity({ id: 'e2', kind: 'npc', subtype: 'merchant', status: 'dead' });

      graph._loadEntity(entity1.id, entity1);
      graph._loadEntity(entity2.id, entity2);

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

      graph._loadEntity(entity1.id, entity1);
      graph._loadEntity(entity2.id, entity2);

      const results = findEntities(graph, {});
      expect(results).toHaveLength(2);
    });
  });
});

describe('Relationship Queries', () => {
  describe('hasRelationship', () => {
    it('should return true when relationship exists', () => {
      const graph = createMockGraph();
      graph._loadRelationship({
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
      graph._loadRelationship({
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

      graph._loadEntity(entity1.id, entity1);
      graph._loadEntity(entity2.id, entity2);
      graph._loadEntity(entity3.id, entity3);

      graph._loadRelationship({ kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 });
      graph._loadRelationship({ kind: 'friend_of', src: 'e3', dst: 'e1', strength: 0.5 });

      const related = getRelated(graph, 'e1');
      expect(related).toHaveLength(2);
      expect(related.map(e => e.id)).toContain('e2');
      expect(related.map(e => e.id)).toContain('e3');
    });

    it('should filter by direction', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1' });
      const entity2 = createMockEntity({ id: 'e2' });

      graph._loadEntity(entity1.id, entity1);
      graph._loadEntity(entity2.id, entity2);

      graph._loadRelationship({ kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 });

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

      graph._loadEntity(entity1.id, entity1);
      graph._loadEntity(entity2.id, entity2);
      graph._loadEntity(entity3.id, entity3);

      graph._loadRelationship({ kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 });
      graph._loadRelationship({ kind: 'enemy_of', src: 'e1', dst: 'e3', strength: 0.7 });

      const friends = getRelated(graph, 'e1', 'friend_of');
      expect(friends).toHaveLength(1);
      expect(friends[0].id).toBe('e2');
    });

    it('should filter by strength', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1' });
      const entity2 = createMockEntity({ id: 'e2' });
      const entity3 = createMockEntity({ id: 'e3' });

      graph._loadEntity(entity1.id, entity1);
      graph._loadEntity(entity2.id, entity2);
      graph._loadEntity(entity3.id, entity3);

      graph._loadRelationship({ kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.8 });
      graph._loadRelationship({ kind: 'friend_of', src: 'e1', dst: 'e3', strength: 0.3 });

      const strongFriends = getRelated(graph, 'e1', 'friend_of', 'both', { minStrength: 0.6 });
      expect(strongFriends).toHaveLength(1);
      expect(strongFriends[0].id).toBe('e2');
    });

    it('should sort by strength when requested', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1' });
      const entity2 = createMockEntity({ id: 'e2' });
      const entity3 = createMockEntity({ id: 'e3' });

      graph._loadEntity(entity1.id, entity1);
      graph._loadEntity(entity2.id, entity2);
      graph._loadEntity(entity3.id, entity3);

      graph._loadRelationship({ kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.3 });
      graph._loadRelationship({ kind: 'friend_of', src: 'e1', dst: 'e3', strength: 0.9 });

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

      graph._loadEntity(location.id, location);
      graph._loadEntity(npc1.id, npc1);
      graph._loadEntity(npc2.id, npc2);

      graph._loadRelationship({ kind: 'resident_of', src: 'npc1', dst: 'loc1', strength: 0.3 });
      graph._loadRelationship({ kind: 'resident_of', src: 'npc2', dst: 'loc1', strength: 0.3 });

      const residents = getResidents(graph, 'loc1');
      expect(residents).toHaveLength(2);
    });
  });

  describe('getLocation', () => {
    it('should return location of NPC', () => {
      const graph = createMockGraph();
      const location = createMockEntity({ id: 'loc1', kind: 'location', name: 'Test Colony' });
      const npc = createMockEntity({ id: 'npc1' });

      graph._loadEntity(location.id, location);
      graph._loadEntity(npc.id, npc);

      graph._loadRelationship({ kind: 'resident_of', src: 'npc1', dst: 'loc1', strength: 0.3 });

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

      graph._loadEntity(faction.id, faction);
      graph._loadEntity(member1.id, member1);
      graph._loadEntity(member2.id, member2);

      graph._loadRelationship({ kind: 'member_of', src: 'npc1', dst: 'fac1', strength: 1.0 });
      graph._loadRelationship({ kind: 'member_of', src: 'npc2', dst: 'fac1', strength: 1.0 });

      const members = getFactionMembers(graph, 'fac1');
      expect(members).toHaveLength(2);
    });
  });

  describe('getFactionLeader', () => {
    it('should return faction leader', () => {
      const graph = createMockGraph();
      const faction = createMockEntity({ id: 'fac1', kind: 'faction' });
      const leader = createMockEntity({ id: 'npc1', name: 'Leader' });

      graph._loadEntity(faction.id, faction);
      graph._loadEntity(leader.id, leader);

      graph._loadRelationship({ kind: 'leader_of', src: 'npc1', dst: 'fac1', strength: 1.0 });

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

      graph._loadEntity(faction.id, faction);
      graph._loadEntity(core.id, core);
      graph._loadEntity(weak.id, weak);

      graph._loadRelationship({ kind: 'member_of', src: 'npc1', dst: 'fac1', strength: 0.9 });
      graph._loadRelationship({ kind: 'member_of', src: 'npc2', dst: 'fac1', strength: 0.5 });

      const coreMembers = getCoreFactionMembers(graph, 'fac1');
      expect(coreMembers).toHaveLength(1);
      expect(coreMembers[0].id).toBe('npc1');
    });
  });

  describe('getWeakRelationships', () => {
    it('should return only weak relationships', () => {
      const graph = createMockGraph();
      const entity = createMockEntity({ id: 'e1' });

      graph._loadEntity(entity.id, entity);

      graph._loadRelationship({ kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.2 });
      graph._loadRelationship({ kind: 'friend_of', src: 'e1', dst: 'e3', strength: 0.8 });

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
      expect(slugifyName('the great warrior')).toBe('the-great-warrior');
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

});

describe('Initial State Normalization', () => {
  describe('normalizeInitialState', () => {
    it('should add missing fields', () => {
      const entities = [
        { kind: 'npc', name: 'Test', coordinates: { x: 10, y: 20, z: 50 } }
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
        { id: 'custom-id', kind: 'npc', name: 'Test', status: 'special', coordinates: { x: 10, y: 20, z: 50 } }
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
    it('should add entity to graph', async () => {
      const graph = createMockGraph();
      const id = await addEntity(graph, {
        kind: 'npc',
        name: 'Test NPC',
        coordinates: { x: 10, y: 20 }
      });

      expect(graph.hasEntity(id)).toBe(true);
      const entity = graph.getEntity(id);
      expect(entity?.name).toBe('Test NPC');
    });

    it('should generate ID', async () => {
      const graph = createMockGraph();
      const id = await addEntity(graph, { kind: 'npc', coordinates: { x: 10, y: 20 } });
      expect(id).toMatch(/^npc-\d+-[a-z0-9]+$/);
    });

    it('should set defaults', async () => {
      const graph = createMockGraph();
      const id = await addEntity(graph, { kind: 'npc', coordinates: { x: 10, y: 20 } });
      const entity = graph.getEntity(id);

      expect(entity?.prominence).toBe('marginal');
      expect(entity?.tags).toBeDefined();
      expect(entity?.links).toEqual([]);
      expect(entity?.createdAt).toBe(graph.tick);
    });
  });

  describe('addRelationship', () => {
    it('should add relationship to graph', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph._loadEntity(e1.id, e1);
      graph._loadEntity(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2');

      const rels = graph.getRelationships();
      expect(rels).toHaveLength(1);
      expect(rels[0].kind).toBe('friend_of');
      expect(rels[0].src).toBe('e1');
      expect(rels[0].dst).toBe('e2');
    });

    it('should update entity links', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph._loadEntity(e1.id, e1);
      graph._loadEntity(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2');

      // Get the entity from the graph to check updated links
      const updatedE1 = graph.getEntity(e1.id);
      expect(updatedE1?.links).toHaveLength(1);
      expect(updatedE1?.links[0].kind).toBe('friend_of');
    });

    it('should not add duplicate relationships', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph._loadEntity(e1.id, e1);
      graph._loadEntity(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2');
      addRelationship(graph, 'friend_of', 'e1', 'e2');

      expect(graph.getRelationships()).toHaveLength(1);
    });

    it('should use default strength when not specified', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph._loadEntity(e1.id, e1);
      graph._loadEntity(e2.id, e2);

      addRelationship(graph, 'member_of', 'e1', 'e2');

      expect(graph.getRelationships()[0].strength).toBe(0.5); // default strength
    });

    it('should respect strength override', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph._loadEntity(e1.id, e1);
      graph._loadEntity(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2', 0.9);

      expect(graph.getRelationships()[0].strength).toBe(0.9);
    });

  });

  describe('updateEntity', () => {
    it('should update entity fields', () => {
      const graph = createMockGraph();
      const entity = createMockEntity({ id: 'e1', status: 'alive' });

      graph._loadEntity(entity.id, entity);

      updateEntity(graph, 'e1', { status: 'dead' });

      const updated = graph.getEntity('e1');
      expect(updated?.status).toBe('dead');
    });

    it('should update updatedAt', () => {
      const graph = createMockGraph();
      const entity = createMockEntity({ id: 'e1', updatedAt: 0 });

      graph._loadEntity(entity.id, entity);
      graph.tick = 100;

      updateEntity(graph, 'e1', { status: 'changed' });

      const updated = graph.getEntity('e1');
      expect(updated?.updatedAt).toBe(100);
    });

    it('should do nothing for nonexistent entity', () => {
      const graph = createMockGraph();
      updateEntity(graph, 'nonexistent', { status: 'changed' });
      // Should not throw
      expect(graph.getEntityCount()).toBe(0);
    });
  });

  describe('archiveRelationship', () => {
    it('should mark relationship as historical', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph._loadEntity(e1.id, e1);
      graph._loadEntity(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2');
      archiveRelationship(graph, 'e1', 'e2', 'friend_of');

      expect(graph.getRelationships()[0].status).toBe('historical');
      expect(graph.getRelationships()[0].archivedAt).toBe(graph.tick);
    });

    it('should update entity links', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph._loadEntity(e1.id, e1);
      graph._loadEntity(e2.id, e2);

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

      graph._loadEntity(e1.id, e1);
      graph._loadEntity(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2', 0.5);
      const result = modifyRelationshipStrength(graph, 'e1', 'e2', 'friend_of', 0.2);

      expect(result).toBe(true);
      expect(graph.getRelationships()[0].strength).toBe(0.7);
    });

    it('should decrease strength', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph._loadEntity(e1.id, e1);
      graph._loadEntity(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2', 0.7);
      modifyRelationshipStrength(graph, 'e1', 'e2', 'friend_of', -0.3);

      // Use toBeCloseTo for floating point comparison
      expect(graph.getRelationships()[0].strength).toBeCloseTo(0.4, 10);
    });

    it('should clamp to 0-1 range', () => {
      const graph = createMockGraph();
      const e1 = createMockEntity({ id: 'e1', links: [] });
      const e2 = createMockEntity({ id: 'e2', links: [] });

      graph._loadEntity(e1.id, e1);
      graph._loadEntity(e2.id, e2);

      addRelationship(graph, 'friend_of', 'e1', 'e2', 0.5);
      modifyRelationshipStrength(graph, 'e1', 'e2', 'friend_of', 1.0);
      expect(graph.getRelationships()[0].strength).toBe(1.0);

      modifyRelationshipStrength(graph, 'e1', 'e2', 'friend_of', -2.0);
      expect(graph.getRelationships()[0].strength).toBe(0.0);
    });

    it('should return false for nonexistent relationship', () => {
      const graph = createMockGraph();
      const result = modifyRelationshipStrength(graph, 'e1', 'e2', 'friend_of', 0.1);
      expect(result).toBe(false);
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

      graph._loadEntity(faction1.id, faction1);
      graph._loadEntity(faction2.id, faction2);

      graph._loadRelationship({ kind: 'at_war_with', src: 'f1', dst: 'f2', strength: 0.7 });

      const rel = getFactionRelationship([faction1], [faction2], graph);
      expect(rel).toBe('enemy');
    });

    it('should detect alliances', () => {
      const graph = createMockGraph();
      const faction1 = createMockEntity({ id: 'f1', kind: 'faction' });
      const faction2 = createMockEntity({ id: 'f2', kind: 'faction' });

      graph._loadEntity(faction1.id, faction1);
      graph._loadEntity(faction2.id, faction2);

      graph._loadRelationship({ kind: 'allied_with', src: 'f1', dst: 'f2', strength: 0.7 });

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

